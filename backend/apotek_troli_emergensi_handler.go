package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Troli Emergensi. TIDAK ADA padanan di Khanza Desktop — fitur baru.
// Troli emergensi (kereta obat darurat, biasanya satu per ruangan: IGD, ICU,
// OK, dst) direpresentasikan sbg baris `bangsal` biasa (sama seperti AP/GD/
// kamar rawat inap) — stoknya sendiri sudah otomatis tercatat di
// `gudangbarang` begitu ada transaksi (mutasi/penerimaan) ke kd_bangsal itu,
// TIDAK perlu mesin stok baru.
//
// Yang baru cuma tabel registry kecil `set_troli_emergensi` — daftar bangsal
// MANA SAJA yang statusnya "troli emergensi" (dibedakan dari kamar rawat
// inap/depo lain yang juga sama-sama baris `bangsal`), supaya tab ini bisa
// gabungkan stok dari SEMUA troli sekaligus jadi satu tabel (kolom "Lokasi
// Troli" = nm_bangsal), sesuai keputusan user: bisa lebih dari satu troli,
// ditampilkan gabung bukan pilih satu-satu. User yang menambahkan baris
// `bangsal`-nya sendiri (lewat menu master bangsal yang sudah ada) — di sini
// cuma menandai bangsal mana yang mau dianggap troli.
// ============================================================================

func ensureTroliEmergensiTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS set_troli_emergensi (
			kd_bangsal VARCHAR(20) NOT NULL PRIMARY KEY,
			keterangan VARCHAR(200) NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
}

type troliLokasiRow struct {
	KdBangsal  string `json:"kd_bangsal"`
	NmBangsal  string `json:"nm_bangsal"`
	Keterangan string `json:"keterangan"`
}

// GET /api/apotek/troli-emergensi — daftar lokasi yang sudah ditandai troli.
func getTroliEmergensiLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT ste.kd_bangsal, COALESCE(b.nm_bangsal,''), ste.keterangan
			FROM set_troli_emergensi ste
			LEFT JOIN bangsal b ON b.kd_bangsal = ste.kd_bangsal
			ORDER BY b.nm_bangsal
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []troliLokasiRow{}
		for rows.Next() {
			var r troliLokasiRow
			if rows.Scan(&r.KdBangsal, &r.NmBangsal, &r.Keterangan) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/apotek/troli-emergensi — tandai satu bangsal sbg troli emergensi.
func tambahTroliEmergensiLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsal  string `json:"kd_bangsal"`
			Keterangan string `json:"keterangan"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.KdBangsal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bangsal wajib dipilih"})
			return
		}
		_, err := db.Exec(`INSERT INTO set_troli_emergensi (kd_bangsal, keterangan) VALUES (?, ?)`, body.KdBangsal, strings.TrimSpace(body.Keterangan))
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Lokasi ini sudah ditandai sebagai troli emergensi"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Lokasi troli emergensi berhasil ditambahkan"})
	}
}

// DELETE /api/apotek/troli-emergensi?kd_bangsal= — batal tandai (TIDAK
// menghapus bangsal/stoknya, cuma keluar dari daftar troli).
func hapusTroliEmergensiLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdBangsal := c.Query("kd_bangsal")
		if kdBangsal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_bangsal wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM set_troli_emergensi WHERE kd_bangsal = ?`, kdBangsal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Lokasi tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Lokasi troli emergensi dihapus dari daftar"})
	}
}

type troliStokRow struct {
	KdBangsal  string  `json:"kd_bangsal"`
	NmBangsal  string  `json:"nm_bangsal"`
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	Satuan     string  `json:"satuan"`
	Jenis      string  `json:"jenis"`
	Stok       float64 `json:"stok"`
	Kadaluarsa string  `json:"kadaluarsa"`
}

// GET /api/apotek/troli-emergensi/stok?search= — stok gabungan SEMUA lokasi
// yang sudah ditandai troli, satu baris per (lokasi, barang). Sengaja TANPA
// filter stok>0 — troli yang kosong (perlu diisi ulang) justru informasi
// paling penting utk ditindaklanjuti, bukan disembunyikan.
func getTroliEmergensiStok(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT g.kd_bangsal, COALESCE(b.nm_bangsal,''), g.kode_brng, d.nama_brng,
				COALESCE(s.satuan,''), COALESCE(j.nama,''), g.stok,
				COALESCE(NULLIF(d.expire, '0000-00-00'), '') AS kadaluarsa
			FROM gudangbarang g
			INNER JOIN set_troli_emergensi ste ON ste.kd_bangsal = g.kd_bangsal
			LEFT JOIN bangsal b ON b.kd_bangsal = g.kd_bangsal
			INNER JOIN databarang d ON d.kode_brng = g.kode_brng
			LEFT JOIN kodesatuan s ON d.kode_sat = s.kode_sat
			LEFT JOIN jenis j ON d.kdjns = j.kdjns
			WHERE g.no_batch = '' AND g.no_faktur = ''
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (d.kode_brng LIKE ? OR d.nama_brng LIKE ? OR b.nm_bangsal LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY b.nm_bangsal, d.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []troliStokRow{}
		for rows.Next() {
			var r troliStokRow
			if rows.Scan(&r.KdBangsal, &r.NmBangsal, &r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.Jenis, &r.Stok, &r.Kadaluarsa) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}
