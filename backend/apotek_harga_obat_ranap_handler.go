package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Set Harga Obat Ranap (item #4 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Harga Obat Ranap"
// (setting/DlgSetHargaObatRanap.java) — sama polanya dengan Set Harga Obat
// Ralan (apotek_harga_obat_ralan_handler.go), tapi PK majemuk (kd_pj, kelas)
// karena rawat inap punya persentase berbeda per kelas kamar. Java cuma
// Simpan (insert) + Hapus, TIDAK ada Update/Terapkan — sama seperti Ralan.
// ============================================================================

// KELAS_RANAP — nilai enum kolom `kelas` di set_harga_obat_ranap, persis
// urutan dropdown "Kelas Kamar" di dialog Java.
var kelasRanapOptions = []string{"Kelas 1", "Kelas 2", "Kelas 3", "Kelas Utama", "Kelas VIP", "Kelas VVIP"}

func isKelasRanapValid(kelas string) bool {
	for _, k := range kelasRanapOptions {
		if k == kelas {
			return true
		}
	}
	return false
}

type hargaObatRanap struct {
	KdPj      string  `json:"kd_pj"`
	PngJawab  string  `json:"png_jawab"`
	Kelas     string  `json:"kelas"`
	HargaJual float64 `json:"hargajual"`
}

func getHargaObatRanapKelasOpsi(c *gin.Context) {
	c.JSON(http.StatusOK, kelasRanapOptions)
}

func getHargaObatRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT sr.kd_pj, p.png_jawab, sr.kelas, sr.hargajual
			FROM set_harga_obat_ranap sr
			INNER JOIN penjab p ON p.kd_pj = sr.kd_pj
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (p.png_jawab LIKE ? OR sr.kd_pj LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY p.png_jawab, sr.kelas"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []hargaObatRanap{}
		for rows.Next() {
			var h hargaObatRanap
			if rows.Scan(&h.KdPj, &h.PngJawab, &h.Kelas, &h.HargaJual) == nil {
				items = append(items, h)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// upsertHargaObatRanap — sama seperti Ralan, Java cuma insert; kami
// tambahkan delete-dulu (match kd_pj+kelas) supaya bisa dipakai untuk
// "mengubah" nilai tanpa 2 langkah manual.
func upsertHargaObatRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body hargaObatRanap
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.KdPj) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cara bayar wajib dipilih"})
			return
		}
		if !isKelasRanapValid(body.Kelas) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kelas kamar tidak valid"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM set_harga_obat_ranap WHERE kd_pj = ? AND kelas = ?`, body.KdPj, body.Kelas); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`INSERT INTO set_harga_obat_ranap (kd_pj, kelas, hargajual) VALUES (?, ?, ?)`, body.KdPj, body.Kelas, body.HargaJual); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Harga obat ranap berhasil disimpan"})
	}
}

func deleteHargaObatRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPj := c.Query("kd_pj")
		kelas := c.Query("kelas")
		if kdPj == "" || kelas == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cara bayar dan kelas wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM set_harga_obat_ranap WHERE kd_pj = ? AND kelas = ?`, kdPj, kelas)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Harga obat ranap berhasil dihapus"})
	}
}
