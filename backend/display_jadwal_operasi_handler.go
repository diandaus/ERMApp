package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// display_jadwal_operasi_handler.go — data utk "Display Jadwal Operasi"
// (Anjungan & Antrian), padanan PERSIS webapps/jadwaloperasi.php +
// data_operasi.php Khanza: booking operasi HARI INI (urut jam mulai) +
// tarif kamar per kelas utk running text "Tarif Kamar Umum" di footer.
//
// Tanpa login (sama dgn display antrian lain — dibuka di layar TV/anjungan).
// Kolom = PHP (No.Rawat, umur, J.K., jam, status, operasi, operator, ruang)
// + nama pasien (permintaan user; No.RM tetap tidak dikirim).

type displayOperasiRow struct {
	NoRawat    string `json:"no_rawat"`
	NmPasien   string `json:"nm_pasien"`
	Umur       string `json:"umur"`
	JK         string `json:"jk"`
	JamMulai   string `json:"jam_mulai"`
	JamSelesai string `json:"jam_selesai"`
	Status     string `json:"status"`
	Operasi    string `json:"operasi"`
	Operator   string `json:"operator"`
	RuangOK    string `json:"ruang_ok"`
}

type displayTarifKamar struct {
	Kelas    string  `json:"kelas"`
	TrfKamar float64 `json:"trf_kamar"`
}

// GET /api/display/jadwal-operasi
func getDisplayJadwalOperasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tanggal := time.Now().Format("2006-01-02")
		rows, err := db.Query(`
			SELECT booking_operasi.no_rawat, IFNULL(pasien.nm_pasien, ''),
				CONCAT(reg_periksa.umurdaftar, ' ', reg_periksa.sttsumur) AS umur,
				IFNULL(pasien.jk, ''),
				IFNULL(TIME_FORMAT(booking_operasi.jam_mulai, '%H:%i:%s'), ''),
				IFNULL(TIME_FORMAT(booking_operasi.jam_selesai, '%H:%i:%s'), ''),
				IFNULL(booking_operasi.status, ''),
				IFNULL(paket_operasi.nm_perawatan, ''),
				IFNULL(dokter.nm_dokter, ''),
				IFNULL(ruang_ok.nm_ruang_ok, '')
			FROM booking_operasi
			INNER JOIN reg_periksa ON booking_operasi.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN paket_operasi ON booking_operasi.kode_paket = paket_operasi.kode_paket
			INNER JOIN dokter ON booking_operasi.kd_dokter = dokter.kd_dokter
			INNER JOIN ruang_ok ON booking_operasi.kd_ruang_ok = ruang_ok.kd_ruang_ok
			WHERE booking_operasi.tanggal = ?
			ORDER BY booking_operasi.tanggal, booking_operasi.jam_mulai`, tanggal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat jadwal operasi: " + err.Error()})
			return
		}
		defer rows.Close()
		data := []displayOperasiRow{}
		for rows.Next() {
			var r displayOperasiRow
			if err := rows.Scan(&r.NoRawat, &r.NmPasien, &r.Umur, &r.JK, &r.JamMulai, &r.JamSelesai, &r.Status, &r.Operasi, &r.Operator, &r.RuangOK); err != nil {
				continue
			}
			data = append(data, r)
		}

		// Tarif kamar per kelas (PHP: GROUP BY kelas tanpa agregat — di sini
		// MIN() supaya aman dgn ONLY_FULL_GROUP_BY).
		tarif := []displayTarifKamar{}
		if tr, err := db.Query(`SELECT kelas, MIN(trf_kamar) FROM kamar WHERE statusdata = '1' GROUP BY kelas ORDER BY kelas`); err == nil {
			defer tr.Close()
			for tr.Next() {
				var t displayTarifKamar
				if tr.Scan(&t.Kelas, &t.TrfKamar) == nil {
					tarif = append(tarif, t)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"tanggal": tanggal, "data": data, "tarif_kamar": tarif})
	}
}
