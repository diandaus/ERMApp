package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// inacbg_coder_nik — tabel bawaan Khanza yg maps NIK pegawai ke No. IK
// (nomor izin kerja) coder yg terdaftar di E-Klaim. Query persis padanan
// dari tampil() di aplikasi Java Khanza (klaimbarumanual.php punya
// pasangannya di sisi web), cuma ditambah filter cari via nik juga.
type CoderNikItem struct {
	NIK  string `json:"nik"`
	Nama string `json:"nama"`
	NoIK string `json:"no_ik"`
}

func getEklaimCoderNikList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := c.DefaultQuery("q", "")
		base := `
			SELECT inacbg_coder_nik.nik, pegawai.nama, COALESCE(inacbg_coder_nik.no_ik,'')
			FROM inacbg_coder_nik
			INNER JOIN pegawai ON inacbg_coder_nik.nik = pegawai.nik
		`
		var rows *sql.Rows
		var err error
		if q != "" {
			like := "%" + q + "%"
			rows, err = db.Query(base+` WHERE pegawai.nama LIKE ? OR inacbg_coder_nik.no_ik LIKE ? OR inacbg_coder_nik.nik LIKE ? ORDER BY pegawai.nama`, like, like, like)
		} else {
			rows, err = db.Query(base + ` ORDER BY pegawai.nama`)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []CoderNikItem{}
		for rows.Next() {
			var it CoderNikItem
			if err := rows.Scan(&it.NIK, &it.Nama, &it.NoIK); err != nil {
				continue
			}
			list = append(list, it)
		}
		c.JSON(http.StatusOK, list)
	}
}

// saveEklaimCoderNik — tambah (NIK belum ada di inacbg_coder_nik) atau edit
// (NIK sudah ada, update No. IK-nya) dlm satu endpoint upsert.
func saveEklaimCoderNik(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NIK  string `json:"nik" binding:"required"`
			NoIK string `json:"no_ik" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var cek string
		if err := db.QueryRow(`SELECT nik FROM pegawai WHERE nik = ?`, req.NIK).Scan(&cek); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "NIK pegawai tidak ditemukan"})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO inacbg_coder_nik (nik, no_ik) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE no_ik = VALUES(no_ik)
		`, req.NIK, req.NoIK); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
