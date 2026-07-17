package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Satuan Barang (item #8 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Satuan" (inventory/DlgSatuan.java) — CRUD
// master satuan barang (Tablet, Ampul, Botol, dll). Tabel native Khanza
// `kodesatuan` yang sama dipakai referensi dropdown "Satuan Besar" &
// "Satuan Kecil" (dua kali, tabel yang sama) di Data Barang
// (apotek_barang_handler.go, getApotekReferensi).
//
// Tabel: kodesatuan (kode_sat char(4) PK, satuan) — paling sederhana di
// antara semua sub-fitur (cuma 2 kolom). Sama seperti Industri
// Farmasi/Suplier: tidak ada kolom status, kode boleh diganti lewat
// "Ganti" (Valid.editTable Java: SET satuan=?,kode_sat=? WHERE
// kode_sat=? lama). Baris "-" adalah placeholder FK "belum diisi"
// (dipakai fkOrDash() di Data Barang untuk kode_satbesar & kode_sat) —
// disaring dari list/CRUD di sini.
//
// Guard tambahan (tidak ada di Java, konsisten dengan pola
// apotek_industri_farmasi_handler.go / apotek_suplier_handler.go): tolak
// ganti-kode/hapus kalau kode_sat masih dipakai databarang.kode_sat ATAU
// databarang.kode_satbesar (dua kolom FK berbeda, tabel referensi sama).
// ============================================================================

type satuanBarang struct {
	KodeSat string `json:"kode_sat"`
	Satuan  string `json:"satuan"`
}

func getSatuanBarangList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kode_sat, COALESCE(satuan,'') FROM kodesatuan WHERE kode_sat <> '-'`
		args := []interface{}{}
		if search != "" {
			query += " AND (kode_sat LIKE ? OR satuan LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY satuan"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []satuanBarang{}
		for rows.Next() {
			var s satuanBarang
			if rows.Scan(&s.KodeSat, &s.Satuan) == nil {
				items = append(items, s)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createSatuanBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b satuanBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeSat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode satuan wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Satuan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama satuan wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM kodesatuan WHERE kode_sat = ?`, b.KodeSat).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(`INSERT INTO kodesatuan (kode_sat, satuan) VALUES (?, ?)`, b.KodeSat, b.Satuan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Satuan barang berhasil ditambahkan"})
	}
}

func countSatuanUsage(db *sql.DB, kode string) int {
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_sat = ? OR kode_satbesar = ?`, kode, kode).Scan(&n)
	return n
}

// updateSatuanBarang — kode_sat BOLEH diganti (mengikuti Java), tapi
// ditolak kalau kode lama masih dipakai databarang.kode_sat/kode_satbesar
// dan kode barunya beda dari kode lama.
func updateSatuanBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b satuanBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeSat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode satuan wajib diisi"})
			return
		}
		if strings.TrimSpace(b.Satuan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama satuan wajib diisi"})
			return
		}

		if b.KodeSat != kodeLama {
			if countSatuanUsage(db, kodeLama) > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai barang lain, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM kodesatuan WHERE kode_sat = ?`, b.KodeSat).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai satuan lain"})
				return
			}
		}

		res, err := db.Exec(`UPDATE kodesatuan SET kode_sat=?, satuan=? WHERE kode_sat=?`, b.KodeSat, b.Satuan, kodeLama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Satuan barang berhasil diperbarui"})
	}
}

// deleteSatuanBarang — ditolak kalau masih dipakai
// databarang.kode_sat/kode_satbesar (tidak ada kolom status di tabel ini).
func deleteSatuanBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if countSatuanUsage(db, kode) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai barang lain, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM kodesatuan WHERE kode_sat = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Satuan barang berhasil dihapus"})
	}
}
