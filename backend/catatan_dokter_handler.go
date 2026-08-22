package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Tab "Catatan Dokter" — padanan tbCatatan/tabModeCatatan di
// DlgRawatJalan.java (Khanza Desktop): log catatan bebas per kunjungan,
// disimpan ke tabel catatan_perawatan (kolom: tanggal, jam, no_rawat,
// kd_dokter, catatan — kunci komposit no_rawat+tanggal+jam+kd_dokter, tanpa
// kolom id/auto-increment, persis skema aslinya). Beda dgn SOAP/CPPT: ini
// cuma catatan singkat berformat log (append-only di UI ini, TIDAK ada
// edit — Khanza desktop punya edit dgn batas 48 jam, disederhanakan di sini
// jadi tambah + hapus saja).

type CatatanDokterItem struct {
	Tanggal  string `json:"tanggal"`
	Jam      string `json:"jam"`
	KdDokter string `json:"kd_dokter"`
	NmDokter string `json:"nm_dokter"`
	Catatan  string `json:"catatan"`
}

func getCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		rows, err := db.Query(`
			SELECT cp.tanggal, cp.jam, cp.kd_dokter, COALESCE(d.nm_dokter, ''), cp.catatan
			FROM catatan_perawatan cp
			LEFT JOIN dokter d ON cp.kd_dokter = d.kd_dokter
			WHERE cp.no_rawat = ?
			ORDER BY cp.tanggal DESC, cp.jam DESC
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []CatatanDokterItem{}
		for rows.Next() {
			var it CatatanDokterItem
			var tanggal time.Time
			if err := rows.Scan(&tanggal, &it.Jam, &it.KdDokter, &it.NmDokter, &it.Catatan); err != nil {
				continue
			}
			it.Tanggal = tanggal.Format("2006-01-02")
			items = append(items, it)
		}
		c.JSON(http.StatusOK, items)
	}
}

func saveCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			NoRawat  string `json:"no_rawat" binding:"required"`
			KdDokter string `json:"kd_dokter" binding:"required"`
			Catatan  string `json:"catatan" binding:"required"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(payload.Catatan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Catatan wajib diisi"})
			return
		}

		now := time.Now()
		_, err := db.Exec(
			`INSERT INTO catatan_perawatan (tanggal, jam, no_rawat, kd_dokter, catatan) VALUES (?, ?, ?, ?, ?)`,
			now.Format("2006-01-02"), now.Format("15:04:05"), payload.NoRawat, payload.KdDokter, payload.Catatan,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Catatan dokter berhasil disimpan"})
	}
}

func deleteCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		tanggal := c.Query("tanggal")
		jam := c.Query("jam")
		kdDokter := c.Query("kd_dokter")
		if noRawat == "" || tanggal == "" || jam == "" || kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tanggal, jam, dan kd_dokter wajib diisi"})
			return
		}
		_, err := db.Exec(
			`DELETE FROM catatan_perawatan WHERE no_rawat = ? AND tanggal = ? AND jam = ? AND kd_dokter = ?`,
			noRawat, tanggal, jam, kdDokter,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Catatan dokter berhasil dihapus"})
	}
}
