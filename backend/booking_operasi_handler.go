package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KAMAR OPERASI (OK) — Jadwal Operasi, padanan menu "Jadwal Operasi" di
// DlgBookingOperasi.java (Khanza). Baca-saja di sini (booking operasi
// itu sendiri masih dibuat lewat modul lain / desktop) — cuma menyalin
// persis query tampil() Java: filter radio Menunggu / rentang tanggal /
// Proses Operasi / Selesai+rentang tanggal, plus 2 subquery per baris
// (kamar/poli rujukan & diagnosa) yang di Java dijalankan satu-satu di
// dalam loop (Sequel.cariIsi) — di sini digabung jadi correlated
// subquery dalam SATU query supaya tidak N+1.
// ============================================================================

type BookingOperasiRow struct {
	NoRawat      string `json:"no_rawat"`
	NoRKMMedis   string `json:"no_rkm_medis"`
	NamaPasien   string `json:"nama_pasien"`
	Umur         string `json:"umur"`
	JK           string `json:"jk"`
	TglLahir     string `json:"tgl_lahir"`
	AlamatPasien string `json:"alamat_pasien"`
	Tanggal      string `json:"tanggal"`
	JamMulai     string `json:"jam_mulai"`
	JamSelesai   string `json:"jam_selesai"`
	Status       string `json:"status"`
	RujukanDari  string `json:"rujukan_dari"`
	Diagnosa     string `json:"diagnosa"`
	KodeOperasi  string `json:"kode_operasi"`
	Operasi      string `json:"operasi"`
	KodeOperator string `json:"kode_operator"`
	Operator     string `json:"operator"`
	Order        string `json:"order"`
	KodeOK       string `json:"kode_ok"`
	NamaRuangOK  string `json:"nama_ruang_operasi"`
}

// GET /api/booking-operasi/list?filter=menunggu|proses|selesai|tanggal&tanggal_awal=&tanggal_akhir=&search=
//
// filter persis 4 radio button Java (R1..R4):
//   - menunggu  (R1): status='Menunggu', tanpa rentang tanggal
//   - tanggal   (R2): SEMUA status, tapi WAJIB rentang tanggal_awal..tanggal_akhir
//   - proses    (R4): status='Proses Operasi', tanpa rentang tanggal
//   - selesai   (R3): status='Selesai' DAN rentang tanggal_awal..tanggal_akhir
func getBookingOperasiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		filter := strings.TrimSpace(c.Query("filter"))
		tglAwal := strings.TrimSpace(c.Query("tanggal_awal"))
		tglAkhir := strings.TrimSpace(c.Query("tanggal_akhir"))
		search := strings.TrimSpace(c.Query("search"))

		var whereStatus string
		switch filter {
		case "menunggu":
			whereStatus = "booking_operasi.status = 'Menunggu'"
		case "proses":
			whereStatus = "booking_operasi.status = 'Proses Operasi'"
		case "selesai":
			if tglAwal == "" || tglAkhir == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Rentang tanggal wajib diisi"})
				return
			}
			whereStatus = "booking_operasi.status = 'Selesai' AND booking_operasi.tanggal BETWEEN ? AND ?"
		case "tanggal":
			if tglAwal == "" || tglAkhir == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Rentang tanggal wajib diisi"})
				return
			}
			whereStatus = "booking_operasi.tanggal BETWEEN ? AND ?"
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Filter tidak valid"})
			return
		}

		query := `
			SELECT booking_operasi.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien,
				CONCAT(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur) AS umur, pasien.jk,
				COALESCE(DATE_FORMAT(pasien.tgl_lahir,'%Y-%m-%d'),''), COALESCE(pasien.alamat,''),
				DATE_FORMAT(booking_operasi.tanggal,'%Y-%m-%d'), booking_operasi.jam_mulai, COALESCE(booking_operasi.jam_selesai,''),
				booking_operasi.status, booking_operasi.kode_paket, paket_operasi.nm_perawatan,
				booking_operasi.kd_dokter, dokter.nm_dokter, booking_operasi.kd_ruang_ok, ruang_ok.nm_ruang_ok,
				poliklinik.nm_poli,
				(SELECT bangsal.nm_bangsal FROM kamar_inap
					INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
					INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
					WHERE kamar_inap.no_rawat = booking_operasi.no_rawat
					ORDER BY kamar_inap.tgl_masuk DESC LIMIT 1) AS nm_bangsal,
				(SELECT CONCAT(diagnosa_pasien.kd_penyakit,' ',penyakit.nm_penyakit) FROM diagnosa_pasien
					INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
					WHERE diagnosa_pasien.no_rawat = booking_operasi.no_rawat LIMIT 1) AS diagnosa
			FROM booking_operasi
			INNER JOIN reg_periksa ON booking_operasi.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN paket_operasi ON booking_operasi.kode_paket = paket_operasi.kode_paket
			INNER JOIN dokter ON booking_operasi.kd_dokter = dokter.kd_dokter
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN ruang_ok ON booking_operasi.kd_ruang_ok = ruang_ok.kd_ruang_ok
			WHERE ` + whereStatus

		args := []interface{}{}
		if filter == "selesai" || filter == "tanggal" {
			args = append(args, tglAwal, tglAkhir)
		}
		if search != "" {
			query += ` AND (booking_operasi.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR booking_operasi.status LIKE ? OR dokter.nm_dokter LIKE ?
				OR paket_operasi.nm_perawatan LIKE ? OR ruang_ok.nm_ruang_ok LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like, like, like, like, like, like)
		}
		query += " ORDER BY booking_operasi.tanggal, booking_operasi.jam_mulai"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []BookingOperasiRow{}
		for rows.Next() {
			var r BookingOperasiRow
			var nmPoli, nmBangsal sql.NullString
			var diagnosa sql.NullString
			if err := rows.Scan(
				&r.NoRawat, &r.NoRKMMedis, &r.NamaPasien, &r.Umur, &r.JK,
				&r.TglLahir, &r.AlamatPasien,
				&r.Tanggal, &r.JamMulai, &r.JamSelesai,
				&r.Status, &r.KodeOperasi, &r.Operasi,
				&r.KodeOperator, &r.Operator, &r.KodeOK, &r.NamaRuangOK,
				&nmPoli, &nmBangsal, &diagnosa,
			); err != nil {
				continue
			}
			// Sama seperti tampil() Java: kalau ada baris kamar_inap (Ranap),
			// "Rujukan Dari" pakai nama bangsal; kalau tidak ada sama sekali
			// (Ralan), fallback ke nama poliklinik.
			if nmBangsal.Valid && nmBangsal.String != "" {
				r.RujukanDari = nmBangsal.String
				r.Order = "Ranap"
			} else {
				r.RujukanDari = nmPoli.String
				r.Order = "Ralan"
			}
			r.Diagnosa = diagnosa.String
			list = append(list, r)
		}

		c.JSON(http.StatusOK, gin.H{"list": list, "count": len(list)})
	}
}

// UpdateBookingOperasiPayload — jam_mulai termasuk PRIMARY KEY komposit
// booking_operasi (no_rawat, kode_paket, tanggal, jam_mulai), jadi WHERE
// clause pakai JamMulaiLama (nilai asli sebelum diedit) buat cari
// barisnya, baru SET ke jam_mulai/jam_selesai/status yang baru. Tidak
// ada tabel lain yang FK ke booking_operasi (dicek information_schema),
// jadi aman diubah di tempat.
type UpdateBookingOperasiPayload struct {
	NoRawat      string `json:"no_rawat" binding:"required"`
	KodePaket    string `json:"kode_paket" binding:"required"`
	Tanggal      string `json:"tanggal" binding:"required"`
	JamMulaiLama string `json:"jam_mulai_lama" binding:"required"`
	JamMulai     string `json:"jam_mulai" binding:"required"`
	JamSelesai   string `json:"jam_selesai"`
	Status       string `json:"status" binding:"required"`
}

// PUT /api/booking-operasi/update — dipicu dari modal "Menunggu" di
// tabel Jadwal Operasi: update jam mulai/selesai & status booking.
func updateBookingOperasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p UpdateBookingOperasiPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Status != "Menunggu" && p.Status != "Proses Operasi" && p.Status != "Selesai" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid"})
			return
		}

		var jamSelesai interface{}
		if strings.TrimSpace(p.JamSelesai) != "" {
			jamSelesai = p.JamSelesai
		}

		res, err := db.Exec(
			`UPDATE booking_operasi SET jam_mulai=?, jam_selesai=?, status=?
			 WHERE no_rawat=? AND kode_paket=? AND tanggal=? AND jam_mulai=?`,
			p.JamMulai, jamSelesai, p.Status,
			p.NoRawat, p.KodePaket, p.Tanggal, p.JamMulaiLama,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data booking operasi tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jadwal operasi berhasil diperbarui"})
	}
}
