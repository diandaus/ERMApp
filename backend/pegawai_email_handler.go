package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GET /api/pegawai/:nik/email — lookup email generik by NIK, dipakai fitur
// Tanda Tangan Elektronik Peruri utk modul yg penandatangannya BUKAN selalu
// dokter (mis. Triase IGD: "Dokter/Petugas IGD" bisa perawat/petugas biasa,
// disimpan sbg nik = username akun yg login, lihat ModalInputTriase.tsx).
// Beda dari getDokterEmail (dokter_handler.go, khusus kd_dokter): endpoint
// ini coba petugas.nip dulu, fallback ke dokter.kd_dokter, lalu pegawai.nik
// — PERSIS pola fallback getPresensiProfil (presensi_handler.go).
func getPegawaiEmail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := c.Param("nik")
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		var nama, email string
		err := db.QueryRow(`SELECT nama, IFNULL(email,'') FROM petugas WHERE nip = ?`, nik).Scan(&nama, &email)
		if err != nil {
			err = db.QueryRow(`SELECT nm_dokter, IFNULL(email,'') FROM dokter WHERE kd_dokter = ?`, nik).Scan(&nama, &email)
		}
		if err != nil {
			err = db.QueryRow(`SELECT nama, IFNULL(email,'') FROM pegawai WHERE nik = ?`, nik).Scan(&nama, &email)
		}
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pegawai/petugas/dokter tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"nik": nik, "nama": nama, "email": email})
	}
}
