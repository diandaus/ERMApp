package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Pengajuan Lembur, fitur BARU murni ERMApp (Khanza tidak
// punya dialog lembur — cuma kolom `presensi.lembur` INT yang dibaca
// dari portal web eksternal via Valid.panggilUrl("presensi") di
// frmUtama.java, tanpa alur approval sama sekali, jadi tidak dipakai
// ulang di sini). Alurnya standar HR: pegawai ajukan lewat HP (tanggal,
// jam mulai/selesai, keterangan) -> HRD/atasan setujui/tolak lewat
// desktop (Kepegawaian > Lembur) -> pegawai lihat status pengajuannya
// sendiri di HP.
// ============================================================================

func ensurePengajuanLemburTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS pengajuan_lembur (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			pegawai_id INT NOT NULL,
			tanggal DATE NOT NULL,
			jam_mulai TIME NOT NULL,
			jam_selesai TIME NOT NULL,
			durasi_menit INT NOT NULL DEFAULT 0,
			keterangan VARCHAR(255) NOT NULL DEFAULT '',
			status ENUM('menunggu','disetujui','ditolak') NOT NULL DEFAULT 'menunggu',
			catatan_approval VARCHAR(255) NOT NULL DEFAULT '',
			disetujui_oleh VARCHAR(100) NOT NULL DEFAULT '',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_pengajuan_lembur_pegawai FOREIGN KEY (pegawai_id)
				REFERENCES pegawai (id) ON DELETE CASCADE
		) ENGINE=InnoDB
	`)
}

func hitungDurasiLemburMenit(jamMulai, jamSelesai string) int {
	layout := "15:04:05"
	mulai, err1 := time.Parse(layout, jamMulai)
	selesai, err2 := time.Parse(layout, jamSelesai)
	if err1 != nil || err2 != nil {
		return 0
	}
	diff := selesai.Sub(mulai)
	if diff < 0 {
		diff += 24 * time.Hour // lembur lewat tengah malam
	}
	return int(diff.Minutes())
}

type LemburRow struct {
	ID              int    `json:"id"`
	NIK             string `json:"nik"`
	Nama            string `json:"nama"`
	Tanggal         string `json:"tanggal"`
	JamMulai        string `json:"jam_mulai"`
	JamSelesai      string `json:"jam_selesai"`
	DurasiMenit     int    `json:"durasi_menit"`
	Keterangan      string `json:"keterangan"`
	Status          string `json:"status"`
	CatatanApproval string `json:"catatan_approval"`
	DisetujuiOleh   string `json:"disetujui_oleh"`
	CreatedAt       string `json:"created_at"`
}

type LemburSubmitPayload struct {
	NIK        string `json:"nik" binding:"required"`
	Tanggal    string `json:"tanggal" binding:"required"`
	JamMulai   string `json:"jam_mulai" binding:"required"`
	JamSelesai string `json:"jam_selesai" binding:"required"`
	Keterangan string `json:"keterangan" binding:"required"`
}

// POST /api/lembur — pegawai ajukan lembur dari HP.
func submitLembur(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p LemburSubmitPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		id, _, _, err := resolvePegawaiID(db, p.NIK)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		durasi := hitungDurasiLemburMenit(p.JamMulai+":00", p.JamSelesai+":00")
		_, err = db.Exec(
			`INSERT INTO pengajuan_lembur (pegawai_id, tanggal, jam_mulai, jam_selesai, durasi_menit, keterangan) VALUES (?,?,?,?,?,?)`,
			id, p.Tanggal, p.JamMulai, p.JamSelesai, durasi, p.Keterangan,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengajuan lembur berhasil dikirim"})
	}
}

// GET /api/lembur/saya?nik= — riwayat pengajuan pegawai sendiri (mobile).
func getLemburSaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		id, _, _, err := resolvePegawaiID(db, nik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		rows, err := db.Query(`
			SELECT id, DATE_FORMAT(tanggal,'%Y-%m-%d'), TIME_FORMAT(jam_mulai,'%H:%i'), TIME_FORMAT(jam_selesai,'%H:%i'),
				durasi_menit, keterangan, status, catatan_approval, disetujui_oleh
			FROM pengajuan_lembur WHERE pegawai_id=? ORDER BY tanggal DESC, id DESC`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []LemburRow{}
		for rows.Next() {
			var r LemburRow
			if err := rows.Scan(&r.ID, &r.Tanggal, &r.JamMulai, &r.JamSelesai, &r.DurasiMenit, &r.Keterangan, &r.Status, &r.CatatanApproval, &r.DisetujuiOleh); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// GET /api/lembur/list?status=&tanggal_awal=&tanggal_akhir=&search= — admin (desktop).
func getLemburList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.Query("status"))
		tglAwal := strings.TrimSpace(c.Query("tanggal_awal"))
		tglAkhir := strings.TrimSpace(c.Query("tanggal_akhir"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT pengajuan_lembur.id, pegawai.nik, pegawai.nama,
				DATE_FORMAT(pengajuan_lembur.tanggal,'%Y-%m-%d'),
				TIME_FORMAT(pengajuan_lembur.jam_mulai,'%H:%i'), TIME_FORMAT(pengajuan_lembur.jam_selesai,'%H:%i'),
				pengajuan_lembur.durasi_menit, pengajuan_lembur.keterangan, pengajuan_lembur.status,
				pengajuan_lembur.catatan_approval, pengajuan_lembur.disetujui_oleh,
				DATE_FORMAT(pengajuan_lembur.created_at,'%Y-%m-%d %H:%i')
			FROM pengajuan_lembur
			INNER JOIN pegawai ON pegawai.id = pengajuan_lembur.pegawai_id
			WHERE 1=1`
		args := []interface{}{}
		if status != "" {
			query += " AND pengajuan_lembur.status = ?"
			args = append(args, status)
		}
		if tglAwal != "" {
			query += " AND pengajuan_lembur.tanggal >= ?"
			args = append(args, tglAwal)
		}
		if tglAkhir != "" {
			query += " AND pengajuan_lembur.tanggal <= ?"
			args = append(args, tglAkhir)
		}
		if search != "" {
			query += " AND (pegawai.nik LIKE ? OR pegawai.nama LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		query += " ORDER BY pengajuan_lembur.tanggal DESC, pengajuan_lembur.id DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []LemburRow{}
		for rows.Next() {
			var r LemburRow
			if err := rows.Scan(&r.ID, &r.NIK, &r.Nama, &r.Tanggal, &r.JamMulai, &r.JamSelesai, &r.DurasiMenit, &r.Keterangan, &r.Status, &r.CatatanApproval, &r.DisetujuiOleh, &r.CreatedAt); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type LemburKeputusanPayload struct {
	Catatan       string `json:"catatan"`
	DisetujuiOleh string `json:"disetujui_oleh"`
}

func putusLembur(db *sql.DB, statusBaru string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		var p LemburKeputusanPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(
			`UPDATE pengajuan_lembur SET status=?, catatan_approval=?, disetujui_oleh=? WHERE id=?`,
			statusBaru, p.Catatan, p.DisetujuiOleh, id,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengajuan tidak ditemukan"})
			return
		}
		pesan := "Pengajuan lembur disetujui"
		if statusBaru == "ditolak" {
			pesan = "Pengajuan lembur ditolak"
		}
		c.JSON(http.StatusOK, gin.H{"message": pesan})
	}
}

// PUT /api/lembur/:id/approve
func approveLembur(db *sql.DB) gin.HandlerFunc { return putusLembur(db, "disetujui") }

// PUT /api/lembur/:id/reject
func rejectLembur(db *sql.DB) gin.HandlerFunc { return putusLembur(db, "ditolak") }

// DELETE /api/lembur/:id — batalkan/hapus pengajuan (dipakai admin, atau
// pegawai membatalkan pengajuan sendiri yang masih "menunggu").
func hapusLembur(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		res, err := db.Exec(`DELETE FROM pengajuan_lembur WHERE id=?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengajuan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengajuan lembur berhasil dihapus"})
	}
}
