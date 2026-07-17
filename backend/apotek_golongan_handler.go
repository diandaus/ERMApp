package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Golongan Obat/Alkes/BHP (item #13 dari 13 sub-menu Pengaturan,
// TERAKHIR). Cocok dengan dialog Khanza Desktop "Golongan"
// (inventory/DlgGolongan.java) — CRUD master golongan barang
// (Psikotropika, Narkotika, Obat Bebas, BHP, dll). Tabel native Khanza
// `golongan_barang` yang sama dipakai referensi dropdown "Golongan" di
// Data Barang (apotek_barang_handler.go, getApotekReferensi).
//
// Tabel: golongan_barang (kode char(4) PK, nama) — pola identik
// Kategori/Satuan Barang/Metode Racik: tidak ada kolom status, kode
// boleh diganti lewat "Ganti", baris "-" placeholder FK disaring dari
// list/CRUD di sini. Guard tambahan (tidak ada di Java): tolak
// ganti-kode/hapus kalau kode masih dipakai databarang.kode_golongan.
// ============================================================================

type golonganBarang struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

func getGolonganList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kode, COALESCE(nama,'') FROM golongan_barang WHERE kode <> '-'`
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
		items := []golonganBarang{}
		for rows.Next() {
			var g golonganBarang
			if rows.Scan(&g.Kode, &g.Nama) == nil {
				items = append(items, g)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createGolongan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b golonganBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode golongan wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama golongan wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM golongan_barang WHERE kode = ?`, b.Kode).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(`INSERT INTO golongan_barang (kode, nama) VALUES (?, ?)`, b.Kode, b.Nama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Golongan barang berhasil ditambahkan"})
	}
}

// updateGolongan — kode BOLEH diganti (mengikuti Java), tapi ditolak
// kalau kode lama masih dipakai databarang.kode_golongan dan kode
// barunya beda dari kode lama.
func updateGolongan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b golonganBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.Kode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode golongan wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Nama) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama golongan wajib diisi"})
			return
		}

		if b.Kode != kodeLama {
			var dipakai int
			db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_golongan = ?`, kodeLama).Scan(&dipakai)
			if dipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai barang lain, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM golongan_barang WHERE kode = ?`, b.Kode).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai golongan lain"})
				return
			}
		}

		res, err := db.Exec(`UPDATE golongan_barang SET kode=?, nama=? WHERE kode=?`, b.Kode, b.Nama, kodeLama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Golongan barang berhasil diperbarui"})
	}
}

// deleteGolongan — ditolak kalau masih dipakai databarang.kode_golongan
// (tidak ada kolom status di tabel ini).
func deleteGolongan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var dipakai int
		db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_golongan = ?`, kode).Scan(&dipakai)
		if dipakai > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai barang lain, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM golongan_barang WHERE kode = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Golongan barang berhasil dihapus"})
	}
}
