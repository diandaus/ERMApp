package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KALENDER LIBUR OTOMATIS — hari libur nasional/cuti bersama disinkron dari
// API publik (api-hari-libur.vercel.app, gratis tanpa API key, sumbernya
// dari SKB resmi pemerintah), TIDAK perlu diketik ulang manual tiap tahun.
// Libur perusahaan (kebijakan internal, mis. cuti bersama HUT perusahaan)
// ditambahkan manual lewat endpoint terpisah, tersimpan di tabel yang sama.
//
// Titik integrasi ke jadwal kerja: getJadwalTetap (jadwal_pegawai_handler.go)
// — CUMA pegawai dgn hari_aktif PERSIS Senin-Jumat ("1,2,3,4,5", pola shift
// reguler/kantor) yang otomatis libur di tanggal merah. Pegawai shift/rotasi
// (hari_aktif 7 hari, Senin-Sabtu, atau pola custom lain — mis. staf IGD
// Pagi/Siang/Malam) TIDAK terpengaruh, tetap jalan sesuai rotasinya —
// dipilih user krn tidak perlu tambah kolom/pengaturan baru per pegawai,
// cukup dari pola hari_aktif yang sudah ada. Jadwal_pegawai.h<tgl> yang
// diisi EKSPLISIT (override manual per tanggal) tetap menang di atas semua
// ini, sama seperti prioritas yang sudah ada sebelumnya.
// ============================================================================

const hariAktifRegulerSeninJumat = "1,2,3,4,5"

func ensureHariLiburTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS hari_libur (
			id INT AUTO_INCREMENT PRIMARY KEY,
			tanggal DATE NOT NULL,
			keterangan VARCHAR(200) NOT NULL,
			jenis ENUM('nasional','cuti_bersama','perusahaan') NOT NULL DEFAULT 'perusahaan',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_tanggal (tanggal)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
}

type HariLiburRow struct {
	ID         int    `json:"id"`
	Tanggal    string `json:"tanggal"`
	Keterangan string `json:"keterangan"`
	Jenis      string `json:"jenis"`
}

// isHariLibur — dipakai getJadwalTetap utk cek apakah suatu tanggal hari
// libur (nasional/cuti bersama/perusahaan, tidak dibedakan — ketiganya
// sama-sama bikin pegawai shift reguler otomatis libur).
func isHariLibur(db *sql.DB, tgl time.Time) bool {
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM hari_libur WHERE tanggal = ?`, tgl.Format("2006-01-02")).Scan(&count)
	return count > 0
}

// isHariAktifRegulerSeninJumat — pegawai dianggap "shift reguler" (ikut
// otomatis libur di tanggal merah) HANYA kalau hari_aktif-nya PERSIS
// Senin-Jumat, tidak lebih tidak kurang. Dibandingkan sbg set supaya urutan
// digit di CSV tidak berpengaruh (mis. "5,1,2,3,4" tetap dianggap sama).
func isHariAktifRegulerSeninJumat(hariAktif string) bool {
	parts := strings.Split(hariAktif, ",")
	if len(parts) != 5 {
		return false
	}
	seen := map[string]bool{}
	for _, p := range parts {
		seen[strings.TrimSpace(p)] = true
	}
	for _, h := range []string{"1", "2", "3", "4", "5"} {
		if !seen[h] {
			return false
		}
	}
	return len(seen) == 5
}

// GET /api/hari-libur?tahun=&bulan= — bulan opsional (kosong = satu tahun penuh).
func getHariLiburList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tahun := strings.TrimSpace(c.Query("tahun"))
		bulan := strings.TrimSpace(c.Query("bulan"))
		if tahun == "" {
			tahun = strconv.Itoa(time.Now().Year())
		}

		query := `SELECT id, DATE_FORMAT(tanggal,'%Y-%m-%d'), keterangan, jenis FROM hari_libur WHERE YEAR(tanggal) = ?`
		args := []interface{}{tahun}
		if bulan != "" {
			query += ` AND MONTH(tanggal) = ?`
			args = append(args, bulan)
		}
		query += ` ORDER BY tanggal`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []HariLiburRow{}
		for rows.Next() {
			var r HariLiburRow
			if err := rows.Scan(&r.ID, &r.Tanggal, &r.Keterangan, &r.Jenis); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/hari-libur/sync?tahun= — tarik hari libur nasional & cuti
// bersama dari API publik, upsert ke tabel lokal. Sengaja TIDAK dipanggil
// otomatis tiap request (butuh koneksi luar, bisa lambat/gagal) — dipicu
// manual oleh HR sekali per tahun (atau kapan saja mau refresh), hasilnya
// tersimpan lokal jadi pemakaian sehari-hari (cek jadwal kerja) tidak
// tergantung API luar sama sekali.
func syncHariLiburNasional(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tahun := strings.TrimSpace(c.Query("tahun"))
		if tahun == "" {
			tahun = strconv.Itoa(time.Now().Year())
		}
		tahunInt, err := strconv.Atoi(tahun)
		if err != nil || tahunInt < 2000 || tahunInt > 2100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tahun tidak valid"})
			return
		}

		url := "https://api-hari-libur.vercel.app/api?year=" + tahun
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Get(url)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi sumber data hari libur: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		raw, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if resp.StatusCode != 200 {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Sumber data hari libur merespons error (HTTP " + strconv.Itoa(resp.StatusCode) + ")"})
			return
		}

		var envelope struct {
			Status string `json:"status"`
			Data   []struct {
				Date        string `json:"date"`
				Description string `json:"description"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &envelope); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Respons sumber data hari libur tidak dikenali"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		count := 0
		for _, item := range envelope.Data {
			if item.Date == "" || item.Description == "" {
				continue
			}
			jenis := "nasional"
			if strings.HasPrefix(item.Description, "Cuti Bersama") {
				jenis = "cuti_bersama"
			}
			if _, err := tx.Exec(
				`INSERT INTO hari_libur (tanggal, keterangan, jenis) VALUES (?, ?, ?)
				 ON DUPLICATE KEY UPDATE keterangan = VALUES(keterangan), jenis = VALUES(jenis)`,
				item.Date, item.Description, jenis,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			count++
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Hari libur tahun " + tahun + " berhasil disinkron", "jumlah": count})
	}
}

type TambahHariLiburPayload struct {
	Tanggal    string `json:"tanggal" binding:"required"`
	Keterangan string `json:"keterangan" binding:"required"`
}

// POST /api/hari-libur — tambah libur perusahaan manual (jenis selalu
// 'perusahaan' — hari libur nasional/cuti bersama HANYA lewat sync,
// supaya tidak campur aduk sumbernya & tidak ketimpa tiap sync berikutnya).
func tambahHariLibur(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p TambahHariLiburPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		p.Keterangan = strings.TrimSpace(p.Keterangan)
		if p.Keterangan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keterangan wajib diisi"})
			return
		}
		if _, err := time.Parse("2006-01-02", p.Tanggal); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal tidak valid (format YYYY-MM-DD)"})
			return
		}

		_, err := db.Exec(`INSERT INTO hari_libur (tanggal, keterangan, jenis) VALUES (?, ?, 'perusahaan')`, p.Tanggal, p.Keterangan)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Tanggal ini sudah tercatat sebagai hari libur"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Hari libur berhasil ditambahkan"})
	}
}

// DELETE /api/hari-libur/:id
func hapusHariLibur(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		res, err := db.Exec(`DELETE FROM hari_libur WHERE id = ?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Hari libur tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Hari libur berhasil dihapus"})
	}
}
