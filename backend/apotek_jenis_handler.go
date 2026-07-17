package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Jenis Obat/Alkes/BHP (item #11 dari 13 sub-menu Pengaturan).
// Cocok dengan dialog Khanza Desktop "Jenis" (inventory/DlgJenis.java) —
// CRUD master jenis barang (Suntik, Tablet, Salep, dll). Tabel native
// Khanza `jenis` yang sama dipakai referensi dropdown "Jenis" di Data
// Barang (apotek_barang_handler.go, getApotekReferensi).
//
// Tabel: jenis (kdjns char(4) PK, nama, keterangan) — pola identik
// Industri Farmasi: tidak ada kolom status, kode boleh diganti lewat
// "Ganti", baris "-" placeholder FK disaring dari list/CRUD di sini.
// Guard tambahan (tidak ada di Java): tolak ganti-kode/hapus kalau kdjns
// masih dipakai databarang.kdjns.
// ============================================================================

type jenisBarang struct {
	Kdjns      string `json:"kdjns"`
	Nama       string `json:"nama"`
	Keterangan string `json:"keterangan"`
}

func getJenisList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kdjns, COALESCE(nama,''), COALESCE(keterangan,'') FROM jenis WHERE kdjns <> '-'`
		args := []interface{}{}
		if search != "" {
			query += " AND (kdjns LIKE ? OR nama LIKE ? OR keterangan LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []jenisBarang{}
		for rows.Next() {
			var j jenisBarang
			if rows.Scan(&j.Kdjns, &j.Nama, &j.Keterangan) == nil {
				items = append(items, j)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b jenisBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kdjns) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode jenis wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama jenis wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM jenis WHERE kdjns = ?`, b.Kdjns).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(`INSERT INTO jenis (kdjns, nama, keterangan) VALUES (?, ?, ?)`, b.Kdjns, b.Nama, b.Keterangan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jenis barang berhasil ditambahkan"})
	}
}

// updateJenis — kdjns BOLEH diganti (mengikuti Java), tapi ditolak kalau
// kode lama masih dipakai databarang.kdjns dan kode barunya beda dari
// kode lama.
func updateJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b jenisBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kdjns) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode jenis wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama jenis wajib diisi"})
			return
		}

		if b.Kdjns != kodeLama {
			var dipakai int
			db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kdjns = ?`, kodeLama).Scan(&dipakai)
			if dipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai barang lain, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM jenis WHERE kdjns = ?`, b.Kdjns).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai jenis lain"})
				return
			}
		}

		res, err := db.Exec(`UPDATE jenis SET kdjns=?, nama=?, keterangan=? WHERE kdjns=?`, b.Kdjns, b.Nama, b.Keterangan, kodeLama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jenis barang berhasil diperbarui"})
	}
}

// deleteJenis — ditolak kalau masih dipakai databarang.kdjns (tidak ada
// kolom status di tabel ini).
func deleteJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var dipakai int
		db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kdjns = ?`, kode).Scan(&dipakai)
		if dipakai > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai barang lain, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM jenis WHERE kdjns = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jenis barang berhasil dihapus"})
	}
}
