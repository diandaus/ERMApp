package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Kategori Obat/Alkes/BHP (item #12 dari 13 sub-menu Pengaturan).
// Cocok dengan dialog Khanza Desktop "Kategori" (inventory/DlgKategori.java)
// — CRUD master kategori barang (Formularium RS, Generik, Fornas, dll).
// Tabel native Khanza `kategori_barang` yang sama dipakai referensi
// dropdown "Kategori" di Data Barang (apotek_barang_handler.go,
// getApotekReferensi).
//
// Tabel: kategori_barang (kode char(4) PK, nama) — pola identik Satuan
// Barang/Metode Racik: tidak ada kolom status, kode boleh diganti lewat
// "Ganti", baris "-" placeholder FK disaring dari list/CRUD di sini.
// Guard tambahan (tidak ada di Java): tolak ganti-kode/hapus kalau kode
// masih dipakai databarang.kode_kategori.
// ============================================================================

type kategoriBarang struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

func getKategoriList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kode, COALESCE(nama,'') FROM kategori_barang WHERE kode <> '-'`
		args := []interface{}{}
		if search != "" {
			query += " AND (kode LIKE ? OR nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []kategoriBarang{}
		for rows.Next() {
			var k kategoriBarang
			if rows.Scan(&k.Kode, &k.Nama) == nil {
				items = append(items, k)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createKategori(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b kategoriBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kategori wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM kategori_barang WHERE kode = ?`, b.Kode).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(`INSERT INTO kategori_barang (kode, nama) VALUES (?, ?)`, b.Kode, b.Nama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Kategori barang berhasil ditambahkan"})
	}
}

// updateKategori — kode BOLEH diganti (mengikuti Java), tapi ditolak
// kalau kode lama masih dipakai databarang.kode_kategori dan kode
// barunya beda dari kode lama.
func updateKategori(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b kategoriBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kategori wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori wajib diisi"})
			return
		}

		if b.Kode != kodeLama {
			var dipakai int
			db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_kategori = ?`, kodeLama).Scan(&dipakai)
			if dipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai barang lain, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM kategori_barang WHERE kode = ?`, b.Kode).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai kategori lain"})
				return
			}
		}

		res, err := db.Exec(`UPDATE kategori_barang SET kode=?, nama=? WHERE kode=?`, b.Kode, b.Nama, kodeLama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Kategori barang berhasil diperbarui"})
	}
}

// deleteKategori — ditolak kalau masih dipakai databarang.kode_kategori
// (tidak ada kolom status di tabel ini).
func deleteKategori(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var dipakai int
		db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_kategori = ?`, kode).Scan(&dipakai)
		if dipakai > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai barang lain, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM kategori_barang WHERE kode = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Kategori barang berhasil dihapus"})
	}
}
