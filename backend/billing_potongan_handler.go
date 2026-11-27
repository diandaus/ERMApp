package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// billing_potongan_handler.go — Potongan Biaya per kunjungan (tab Billing
// ERM Tablet), mis. dokter menggratiskan konsultasi. Memakai tabel KHANZA
// `pengurangan_biaya` (no_rawat, nama_pengurangan, besar_pengurangan) —
// padanan input Potongan di DlgBilingRalan.java: tarif & jasa medis asli
// TIDAK diubah, potongan tampil sbg kelompok "Potongan Biaya" (negatif) di
// billing (computeBillingPreview) & mengurangi total.
//
// Kalau nota SUDAH disimpan kasir (ada baris di tabel billing), billing
// yg tampil adalah nota tersimpan itu — potongan baru tidak akan ikut,
// jadi penambahan/penghapusan DITOLAK dgn pesan jelas (kasir yg harus
// mengubah lewat billing).

type potonganBiayaItem struct {
	Nama  string  `json:"nama"`
	Besar float64 `json:"besar"`
}

func notaBillingTersimpan(db *sql.DB, noRawat string) bool {
	var n int
	_ = db.QueryRow(`SELECT COUNT(*) FROM billing WHERE no_rawat = ?`, noRawat).Scan(&n)
	return n > 0
}

// GET /api/billing/potongan/*no_rawat
func getPotonganBiaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		rows, err := db.Query(`SELECT nama_pengurangan, IFNULL(besar_pengurangan, 0)
			FROM pengurangan_biaya WHERE no_rawat = ? ORDER BY nama_pengurangan`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat potongan biaya: " + err.Error()})
			return
		}
		defer rows.Close()
		list := []potonganBiayaItem{}
		for rows.Next() {
			var it potonganBiayaItem
			if rows.Scan(&it.Nama, &it.Besar) == nil {
				list = append(list, it)
			}
		}
		c.JSON(http.StatusOK, gin.H{"nota_tersimpan": notaBillingTersimpan(db, noRawat), "potongan": list})
	}
}

// POST /api/billing/potongan {no_rawat, nama, besar} — nama sama = besar diganti.
func savePotonganBiaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in struct {
			NoRawat string  `json:"no_rawat"`
			Nama    string  `json:"nama"`
			Besar   float64 `json:"besar"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		in.NoRawat = strings.TrimSpace(in.NoRawat)
		in.Nama = strings.TrimSpace(in.Nama)
		if in.NoRawat == "" || in.Nama == "" || in.Besar <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keterangan dan besar potongan (> 0) wajib diisi"})
			return
		}
		if len([]rune(in.Nama)) > 60 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keterangan potongan maksimal 60 karakter"})
			return
		}
		if notaBillingTersimpan(db, in.NoRawat) {
			c.JSON(http.StatusConflict, gin.H{"error": "Nota billing kunjungan ini sudah disimpan kasir — potongan diubah lewat kasir"})
			return
		}
		if _, err := db.Exec(`INSERT INTO pengurangan_biaya (no_rawat, nama_pengurangan, besar_pengurangan)
			VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE besar_pengurangan = VALUES(besar_pengurangan)`,
			in.NoRawat, in.Nama, in.Besar); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan potongan biaya: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Potongan biaya tersimpan"})
	}
}

// DELETE /api/billing/potongan?no_rawat=&nama=
func deletePotonganBiaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		nama := c.Query("nama")
		if noRawat == "" || nama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan nama wajib diisi"})
			return
		}
		if notaBillingTersimpan(db, noRawat) {
			c.JSON(http.StatusConflict, gin.H{"error": "Nota billing kunjungan ini sudah disimpan kasir — potongan diubah lewat kasir"})
			return
		}
		if _, err := db.Exec(`DELETE FROM pengurangan_biaya WHERE no_rawat = ? AND nama_pengurangan = ?`, noRawat, nama); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus potongan biaya: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Potongan biaya dihapus"})
	}
}
