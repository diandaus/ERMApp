package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Struct untuk request generate nomor
type GenerateNoRegRequest struct {
	TglRegistrasi string `json:"tgl_registrasi"` // Format: YYYY-MM-DD
	KdDokter      string `json:"kd_dokter"`
	KdPoli        string `json:"kd_poli"`
	BaseNoReg     string `json:"base_no_reg"`  // "booking" atau ""
	UrutNoReg     string `json:"urut_no_reg"`  // "poli", "dokter", "dokter + poli"
}

type GenerateNoRawatRequest struct {
	TglRegistrasi string `json:"tgl_registrasi"` // Format: YYYY-MM-DD
}

type GenerateNoRegResponse struct {
	NoReg string `json:"no_reg"`
}

type GenerateNoRawatResponse struct {
	NoRawat string `json:"no_rawat"`
}

// Handler untuk generate No. Reg
func generateNoReg(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GenerateNoRegRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Default values
		if req.BaseNoReg == "" {
			req.BaseNoReg = "" // non-booking
		}
		if req.UrutNoReg == "" {
			req.UrutNoReg = "poli"
		}

		var maxNo int
		var query string

		// Logic based on BASENOREG and URUTNOREG
		if req.BaseNoReg == "booking" {
			// Mode booking: bandingkan booking_registrasi dan reg_periksa
			switch req.UrutNoReg {
			case "poli":
				// Max dari booking_registrasi
				queryBooking := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM booking_registrasi
					WHERE kd_poli = ? AND tanggal_periksa = ?
				`
				var maxBooking int
				db.QueryRow(queryBooking, req.KdPoli, req.TglRegistrasi).Scan(&maxBooking)

				// Max dari reg_periksa
				queryReg := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_poli = ? AND tgl_registrasi = ?
				`
				var maxReg int
				db.QueryRow(queryReg, req.KdPoli, req.TglRegistrasi).Scan(&maxReg)

				// Pilih yang lebih besar
				if maxBooking >= maxReg {
					maxNo = maxBooking
				} else {
					maxNo = maxReg
				}

			case "dokter":
				// Max dari booking_registrasi
				queryBooking := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM booking_registrasi
					WHERE kd_dokter = ? AND tanggal_periksa = ?
				`
				var maxBooking int
				db.QueryRow(queryBooking, req.KdDokter, req.TglRegistrasi).Scan(&maxBooking)

				// Max dari reg_periksa
				queryReg := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_dokter = ? AND tgl_registrasi = ?
				`
				var maxReg int
				db.QueryRow(queryReg, req.KdDokter, req.TglRegistrasi).Scan(&maxReg)

				// Pilih yang lebih besar
				if maxBooking >= maxReg {
					maxNo = maxBooking
				} else {
					maxNo = maxReg
				}

			case "dokter + poli":
				// Max dari booking_registrasi
				queryBooking := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM booking_registrasi
					WHERE kd_dokter = ? AND kd_poli = ? AND tanggal_periksa = ?
				`
				var maxBooking int
				db.QueryRow(queryBooking, req.KdDokter, req.KdPoli, req.TglRegistrasi).Scan(&maxBooking)

				// Max dari reg_periksa
				queryReg := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_dokter = ? AND kd_poli = ? AND tgl_registrasi = ?
				`
				var maxReg int
				db.QueryRow(queryReg, req.KdDokter, req.KdPoli, req.TglRegistrasi).Scan(&maxReg)

				// Pilih yang lebih besar
				if maxBooking >= maxReg {
					maxNo = maxBooking
				} else {
					maxNo = maxReg
				}

			default:
				// Default: same as poli
				queryBooking := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM booking_registrasi
					WHERE kd_poli = ? AND tanggal_periksa = ?
				`
				var maxBooking int
				db.QueryRow(queryBooking, req.KdPoli, req.TglRegistrasi).Scan(&maxBooking)

				queryReg := `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_poli = ? AND tgl_registrasi = ?
				`
				var maxReg int
				db.QueryRow(queryReg, req.KdPoli, req.TglRegistrasi).Scan(&maxReg)

				if maxBooking >= maxReg {
					maxNo = maxBooking
				} else {
					maxNo = maxReg
				}
			}
		} else {
			// Mode non-booking: hanya dari reg_periksa
			switch req.UrutNoReg {
			case "global":
				query = `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE tgl_registrasi = ?
				`
				db.QueryRow(query, req.TglRegistrasi).Scan(&maxNo)

			case "poli":
				query = `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_poli = ? AND tgl_registrasi = ?
				`
				db.QueryRow(query, req.KdPoli, req.TglRegistrasi).Scan(&maxNo)

			case "dokter":
				query = `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_dokter = ? AND tgl_registrasi = ?
				`
				db.QueryRow(query, req.KdDokter, req.TglRegistrasi).Scan(&maxNo)

			case "dokter + poli":
				query = `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_dokter = ? AND kd_poli = ? AND tgl_registrasi = ?
				`
				db.QueryRow(query, req.KdDokter, req.KdPoli, req.TglRegistrasi).Scan(&maxNo)

			default:
				query = `
					SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0)
					FROM reg_periksa
					WHERE kd_dokter = ? AND tgl_registrasi = ?
				`
				db.QueryRow(query, req.KdDokter, req.TglRegistrasi).Scan(&maxNo)
			}
		}

		// Increment dan format 3 digit (001, 002, 003, ...)
		nextNo := maxNo + 1
		noReg := fmt.Sprintf("%03d", nextNo)

		c.JSON(http.StatusOK, GenerateNoRegResponse{
			NoReg: noReg,
		})
	}
}

// Handler untuk generate No. Rawat
func generateNoRawat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GenerateNoRawatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Parse tanggal registrasi
		tglReg, err := time.Parse("2006-01-02", req.TglRegistrasi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
			return
		}

		// Format: YYYY/MM/DD/XXXXXX (6 digit)
		datePrefix := tglReg.Format("2006/01/02")

		// Query untuk mendapatkan nomor terbesar pada tanggal yang sama
		query := `
			SELECT IFNULL(MAX(CONVERT(RIGHT(no_rawat, 6), SIGNED)), 0)
			FROM reg_periksa
			WHERE tgl_registrasi = ?
		`

		var maxNo int
		err = db.QueryRow(query, req.TglRegistrasi).Scan(&maxNo)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Increment dan format 6 digit (000001, 000002, ...)
		nextNo := maxNo + 1
		noRawat := fmt.Sprintf("%s/%06d", datePrefix, nextNo)

		c.JSON(http.StatusOK, GenerateNoRawatResponse{
			NoRawat: noRawat,
		})
	}
}

// Handler untuk hapus data registrasi
func deleteRegistrasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rawat tidak boleh kosong"})
			return
		}

		// Cek apakah pasien sudah di kamar inap (tidak boleh dihapus)
		var kamarCount int
		db.QueryRow(`SELECT COUNT(*) FROM kamar_inap WHERE no_rawat = ?`, noRawat).Scan(&kamarCount)
		if kamarCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus: pasien sudah masuk kamar inap"})
			return
		}

		// Cek apakah sudah ada tindakan/pemeriksaan
		var soapCount int
		db.QueryRow(`SELECT COUNT(*) FROM soap WHERE no_rawat = ?`, noRawat).Scan(&soapCount)
		if soapCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus: sudah ada data pemeriksaan"})
			return
		}

		result, err := db.Exec(`DELETE FROM reg_periksa WHERE no_rawat = ?`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data registrasi: " + err.Error()})
			return
		}

		rows, _ := result.RowsAffected()
		if rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data registrasi tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Data registrasi berhasil dihapus"})
	}
}
