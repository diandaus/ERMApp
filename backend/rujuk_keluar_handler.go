package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// rujuk_keluar_handler.go — listing "Rujuk Keluar" (tab kedua di modal Rujuk,
// frontend/src/components/RujukanInternalModal.tsx), padanan persis
// tampil()/DlgRujuk.java Khanza Desktop: tabel rujukan (tabel `rujuk`) yg
// dikirim ke faskes/tempat lain, filter rentang tgl_rujuk + pencarian bebas
// lintas kolom (no_rujuk/no_rawat/no_rkm_medis/nm_pasien/rujuk_ke/
// keterangan_diagnosa/kd_dokter/nm_dokter).

type rujukKeluarRow struct {
	NoRujuk            string `json:"no_rujuk"`
	NoRawat            string `json:"no_rawat"`
	NoRkmMedis         string `json:"no_rkm_medis"`
	NmPasien           string `json:"nm_pasien"`
	RujukKe            string `json:"rujuk_ke"`
	TglRujuk           string `json:"tgl_rujuk"`
	Jam                string `json:"jam"`
	KeteranganDiagnosa string `json:"keterangan_diagnosa"`
	KdDokter           string `json:"kd_dokter"`
	NmDokter           string `json:"nm_dokter"`
	KatRujuk           string `json:"kat_rujuk"`
	Ambulance          string `json:"ambulance"`
	Keterangan         string `json:"keterangan"`
}

// GET /api/rujuk-keluar/list?tgl1=YYYY-MM-DD&tgl2=YYYY-MM-DD&search=...
func getRujukKeluarList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := c.Query("tgl1")
		tgl2 := c.Query("tgl2")
		if tgl1 == "" || tgl2 == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl1 dan tgl2 wajib diisi"})
			return
		}
		search := "%" + c.Query("search") + "%"

		rows, err := db.Query(`
			SELECT rujuk.no_rujuk, rujuk.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien,
				rujuk.rujuk_ke, DATE_FORMAT(rujuk.tgl_rujuk,'%Y-%m-%d'), IFNULL(rujuk.jam,''),
				IFNULL(rujuk.keterangan_diagnosa,''), rujuk.kd_dokter, IFNULL(dokter.nm_dokter,''),
				IFNULL(rujuk.kat_rujuk,''), IFNULL(rujuk.ambulance,''), IFNULL(rujuk.keterangan,'')
			FROM rujuk
			INNER JOIN reg_periksa ON rujuk.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN dokter ON rujuk.kd_dokter = dokter.kd_dokter
			WHERE rujuk.tgl_rujuk BETWEEN ? AND ?
				AND (rujuk.no_rujuk LIKE ? OR rujuk.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ?
					OR pasien.nm_pasien LIKE ? OR rujuk.rujuk_ke LIKE ? OR rujuk.keterangan_diagnosa LIKE ?
					OR rujuk.kd_dokter LIKE ? OR dokter.nm_dokter LIKE ?)
			ORDER BY rujuk.no_rujuk
		`, tgl1, tgl2, search, search, search, search, search, search, search, search)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []rujukKeluarRow{}
		for rows.Next() {
			var r rujukKeluarRow
			if err := rows.Scan(
				&r.NoRujuk, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien, &r.RujukKe, &r.TglRujuk, &r.Jam,
				&r.KeteranganDiagnosa, &r.KdDokter, &r.NmDokter, &r.KatRujuk, &r.Ambulance, &r.Keterangan,
			); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/rujuk-keluar/simpan — simpan rujukan keluar baru utk pasien yg
// modal-nya sedang dibuka (form langsung tampil di tab Rujuk Keluar, bukan
// dialog terpisah). no_rujuk digenerate otomatis (format "R" + 9 digit,
// persis pola no_rujuk yg sudah ada di data: R000000001, R000000002, ...).
func saveRujukKeluar(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoRawat            string `json:"no_rawat" binding:"required"`
			RujukKe            string `json:"rujuk_ke" binding:"required"`
			TglRujuk           string `json:"tgl_rujuk" binding:"required"`
			Jam                string `json:"jam"`
			KeteranganDiagnosa string `json:"keterangan_diagnosa"`
			KdDokter           string `json:"kd_dokter" binding:"required"`
			KatRujuk           string `json:"kat_rujuk"`
			Ambulance          string `json:"ambulance"`
			Keterangan         string `json:"keterangan"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Jam == "" {
			req.Jam = time.Now().Format("15:04:05")
		} else if len(req.Jam) == 5 {
			req.Jam += ":00" // input type="time" tanpa detik (HH:MM) -> lengkapi jadi HH:MM:SS
		}
		if req.KatRujuk == "" {
			req.KatRujuk = "-"
		}
		if req.Ambulance == "" {
			req.Ambulance = "-"
		}

		var lastNo string
		db.QueryRow(`SELECT no_rujuk FROM rujuk ORDER BY no_rujuk DESC LIMIT 1`).Scan(&lastNo)
		nextNum := 1
		if n, err := strconv.Atoi(strings.TrimPrefix(lastNo, "R")); err == nil {
			nextNum = n + 1
		}
		noRujuk := fmt.Sprintf("R%09d", nextNum)

		_, err := db.Exec(`
			INSERT INTO rujuk (no_rujuk, no_rawat, rujuk_ke, tgl_rujuk, jam, keterangan_diagnosa, kd_dokter, kat_rujuk, ambulance, keterangan)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, noRujuk, req.NoRawat, req.RujukKe, req.TglRujuk, req.Jam, req.KeteranganDiagnosa, req.KdDokter, req.KatRujuk, req.Ambulance, req.Keterangan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan rujuk keluar: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Rujuk keluar berhasil disimpan", "no_rujuk": noRujuk})
	}
}
