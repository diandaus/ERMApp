package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Suplier Obat/Alkes/BHP (item #7 dari 13 sub-menu Pengaturan).
// Cocok dengan dialog Khanza Desktop "Supplier" (inventory/InventorySuplier.java)
// — CRUD master data pemasok obat/alkes/BHP, tabel native Khanza
// `datasuplier`. Beda dari `industrifarmasi`: TIDAK ada baris "-"
// placeholder (tidak dipakai sebagai FK dropdown di Data Barang), tapi
// DIPAKAI sebagai FK di `pembelian.kode_suplier` (transaksi pembelian).
//
// Tabel: datasuplier (kode_suplier char(5) PK, nama_suplier, alamat,
// kota, no_telp, nama_bank, rekening) — sama seperti Industri Farmasi:
// tidak ada kolom status (tidak ada nonaktifkan), dan kode BOLEH diganti
// lewat "Ganti" di Java. Kami ikuti perilaku ganti-kode itu, tapi
// tambahkan guard FK (tolak kalau kode masih dipakai
// pembelian.kode_suplier) — pengaman yang tidak ada di Java, konsisten
// dengan pola apotek_industri_farmasi_handler.go.
// ============================================================================

type suplier struct {
	KodeSuplier string `json:"kode_suplier"`
	NamaSuplier string `json:"nama_suplier"`
	Alamat      string `json:"alamat"`
	Kota        string `json:"kota"`
	NoTelp      string `json:"no_telp"`
	NamaBank    string `json:"nama_bank"`
	Rekening    string `json:"rekening"`
}

func getSuplierList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT kode_suplier, COALESCE(nama_suplier,''), COALESCE(alamat,''), COALESCE(kota,''),
				COALESCE(no_telp,''), COALESCE(nama_bank,''), COALESCE(rekening,'')
			FROM datasuplier
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (kode_suplier LIKE ? OR nama_suplier LIKE ? OR alamat LIKE ? OR kota LIKE ? OR no_telp LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY nama_suplier"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []suplier{}
		for rows.Next() {
			var s suplier
			if rows.Scan(&s.KodeSuplier, &s.NamaSuplier, &s.Alamat, &s.Kota, &s.NoTelp, &s.NamaBank, &s.Rekening) == nil {
				items = append(items, s)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createSuplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b suplier
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeSuplier) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NamaSuplier) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama suplier wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM datasuplier WHERE kode_suplier = ?`, b.KodeSuplier).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(
			`INSERT INTO datasuplier (kode_suplier, nama_suplier, alamat, kota, no_telp, nama_bank, rekening) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			b.KodeSuplier, b.NamaSuplier, b.Alamat, b.Kota, b.NoTelp, b.NamaBank, b.Rekening,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Suplier berhasil ditambahkan"})
	}
}

// updateSuplier — kode_suplier BOLEH diganti (mengikuti Java), tapi
// ditolak kalau kode lama masih dipakai pembelian.kode_suplier dan kode
// barunya beda dari kode lama (supaya tidak meninggalkan FK yatim).
func updateSuplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b suplier
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeSuplier) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NamaSuplier) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama suplier wajib diisi"})
			return
		}

		if b.KodeSuplier != kodeLama {
			var dipakai int
			db.QueryRow(`SELECT COUNT(*) FROM pembelian WHERE kode_suplier = ?`, kodeLama).Scan(&dipakai)
			if dipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai transaksi pembelian, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM datasuplier WHERE kode_suplier = ?`, b.KodeSuplier).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai suplier lain"})
				return
			}
		}

		res, err := db.Exec(
			`UPDATE datasuplier SET kode_suplier=?, nama_suplier=?, alamat=?, kota=?, no_telp=?, nama_bank=?, rekening=? WHERE kode_suplier=?`,
			b.KodeSuplier, b.NamaSuplier, b.Alamat, b.Kota, b.NoTelp, b.NamaBank, b.Rekening, kodeLama,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Suplier berhasil diperbarui"})
	}
}

// deleteSuplier — ditolak kalau masih dipakai pembelian.kode_suplier
// (tidak ada kolom status di tabel ini untuk nonaktifkan).
func deleteSuplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var dipakai int
		db.QueryRow(`SELECT COUNT(*) FROM pembelian WHERE kode_suplier = ?`, kode).Scan(&dipakai)
		if dipakai > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai transaksi pembelian, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM datasuplier WHERE kode_suplier = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Suplier berhasil dihapus"})
	}
}
