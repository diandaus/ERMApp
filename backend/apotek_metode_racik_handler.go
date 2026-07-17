package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Metode Racik (item #9 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Metode Racik"
// (inventory/DlgMetodeRacik.java) — CRUD master metode racikan obat
// (Puyer, Sirup, Salep, Kapsul, dll).
//
// Tabel: metode_racik (kd_racik varchar(3) PK, nm_racik) — pola identik
// Satuan Barang: tidak ada kolom status, kode boleh diganti lewat
// "Ganti", tidak ada baris "-" placeholder (tabel ini TIDAK dipakai
// sebagai referensi dropdown FK di Data Barang, beda dari
// Satuan/Industri Farmasi).
//
// BEDA PENTING dari sub-fitur master lain di modul ini: tabel ini
// SUDAH dikonsumsi fitur Resep yang ada (bukan orphaned) —
// resep_ranap_handler.go sudah LEFT JOIN metode_racik lewat
// resep_dokter_racikan.kd_racik untuk menampilkan nama metode racik di
// riwayat resep racikan rawat inap, dan saveResepRanap me-resolve
// kd_racik dari nama (mis. "Puyer") kalau frontend kirim nama alih-alih
// kode. Guard tambahan (tidak ada di Java): tolak ganti-kode/hapus kalau
// kd_racik masih dipakai resep_dokter_racikan.kd_racik, supaya riwayat
// resep racikan yang sudah ada tidak kehilangan referensi.
// ============================================================================

type metodeRacik struct {
	KdRacik string `json:"kd_racik"`
	NmRacik string `json:"nm_racik"`
}

func getMetodeRacikList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kd_racik, COALESCE(nm_racik,'') FROM metode_racik WHERE 1=1`
		args := []interface{}{}
		if search != "" {
			query += " AND (kd_racik LIKE ? OR nm_racik LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY nm_racik"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []metodeRacik{}
		for rows.Next() {
			var m metodeRacik
			if rows.Scan(&m.KdRacik, &m.NmRacik) == nil {
				items = append(items, m)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createMetodeRacik(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b metodeRacik
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KdRacik) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode racik wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NmRacik) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama racik wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM metode_racik WHERE kd_racik = ?`, b.KdRacik).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(`INSERT INTO metode_racik (kd_racik, nm_racik) VALUES (?, ?)`, b.KdRacik, b.NmRacik)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Metode racik berhasil ditambahkan"})
	}
}

func countMetodeRacikUsage(db *sql.DB, kode string) int {
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM resep_dokter_racikan WHERE kd_racik = ?`, kode).Scan(&n)
	return n
}

// updateMetodeRacik — kd_racik BOLEH diganti (mengikuti Java), tapi
// ditolak kalau kode lama masih dipakai resep_dokter_racikan.kd_racik
// dan kode barunya beda dari kode lama.
func updateMetodeRacik(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b metodeRacik
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KdRacik) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode racik wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NmRacik) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama racik wajib diisi"})
			return
		}

		if b.KdRacik != kodeLama {
			if countMetodeRacikUsage(db, kodeLama) > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai riwayat resep racikan, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM metode_racik WHERE kd_racik = ?`, b.KdRacik).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai metode racik lain"})
				return
			}
		}

		res, err := db.Exec(`UPDATE metode_racik SET kd_racik=?, nm_racik=? WHERE kd_racik=?`, b.KdRacik, b.NmRacik, kodeLama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Metode racik berhasil diperbarui"})
	}
}

// deleteMetodeRacik — ditolak kalau masih dipakai
// resep_dokter_racikan.kd_racik (tidak ada kolom status di tabel ini).
func deleteMetodeRacik(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if countMetodeRacikUsage(db, kode) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai riwayat resep racikan, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM metode_racik WHERE kd_racik = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Metode racik berhasil dihapus"})
	}
}
