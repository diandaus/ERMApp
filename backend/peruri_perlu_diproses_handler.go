package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// peruri_perlu_diproses_handler.go — submenu Peruri "Lihat Dokumen / Perlu
// Diproses": daftar SEMUA pasien (reg_periksa, bukan Batal) dalam rentang
// tanggal registrasi, dikelompokkan per dokter di frontend. Dokter:
//   - Ralan → reg_periksa.kd_dokter
//   - Ranap → DPJP dari dpjp_ranap; pasien dgn >1 DPJP muncul di bawah
//     MASING-MASING DPJP. Kalau belum ada baris dpjp_ranap, fallback ke
//     reg_periksa.kd_dokter supaya pasien tidak hilang dari daftar.
//
// Status TTE diambil dari tracking_dokumen_ttd KALAU tabelnya ada (tabel ini
// ada di produksi tapi TIDAK ada di DB dev — lihat peruri_tracking_handler.go),
// kalau tidak ada kolom jumlah dokumen dikembalikan 0 dan tte_tersedia=false.

type peruriPerluDiprosesRow struct {
	NoRawat       string `json:"no_rawat"`
	NoRkmMedis    string `json:"no_rkm_medis"`
	NmPasien      string `json:"nm_pasien"`
	TglRegistrasi string `json:"tgl_registrasi"`
	JamReg        string `json:"jam_reg"`
	StatusLanjut  string `json:"status_lanjut"`
	KdDokter      string `json:"kd_dokter"`
	NmDokter      string `json:"nm_dokter"`
	NmPoli        string `json:"nm_poli"`
	PngJawab      string `json:"png_jawab"`
	DokSudah      int    `json:"dok_sudah"`
	DokBelum      int    `json:"dok_belum"`
}

func trackingDokumenTtdExists(db *sql.DB) bool {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = DATABASE() AND table_name = 'tracking_dokumen_ttd'`).Scan(&n)
	return err == nil && n > 0
}

// GET /api/peruri/perlu-diproses?tgl_awal=YYYY-MM-DD&tgl_akhir=YYYY-MM-DD
//
//	&jenis=Semua|Ralan|Ranap&kd_dokter=...&search=...
func getPeruriPerluDiproses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglAwal := c.Query("tgl_awal")
		tglAkhir := c.Query("tgl_akhir")
		if _, err := time.Parse("2006-01-02", tglAwal); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_awal tidak valid (format YYYY-MM-DD)"})
			return
		}
		if _, err := time.Parse("2006-01-02", tglAkhir); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_akhir tidak valid (format YYYY-MM-DD)"})
			return
		}
		jenis := c.DefaultQuery("jenis", "Semua")
		kdDokter := strings.TrimSpace(c.Query("kd_dokter"))
		search := strings.TrimSpace(c.Query("search"))

		tteTersedia := trackingDokumenTtdExists(db)
		tteCols := `0, 0`
		if tteTersedia {
			tteCols = `
				(SELECT COUNT(*) FROM tracking_dokumen_ttd t WHERE t.no_rawat = r.no_rawat AND t.status_ttd = 'Sudah'),
				(SELECT COUNT(*) FROM tracking_dokumen_ttd t WHERE t.no_rawat = r.no_rawat AND t.status_ttd <> 'Sudah')`
		}

		query := `
			SELECT r.no_rawat, r.no_rkm_medis, IFNULL(p.nm_pasien, ''),
				DATE_FORMAT(r.tgl_registrasi, '%Y-%m-%d'), IFNULL(TIME_FORMAT(r.jam_reg, '%H:%i:%s'), ''),
				r.status_lanjut, IFNULL(dp.kd_dokter, r.kd_dokter), IFNULL(d.nm_dokter, ''),
				IFNULL(pl.nm_poli, ''), IFNULL(pj.png_jawab, ''),
				` + tteCols + `
			FROM reg_periksa r
			LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
			LEFT JOIN dpjp_ranap dp ON dp.no_rawat = r.no_rawat AND r.status_lanjut = 'Ranap'
			LEFT JOIN dokter d ON d.kd_dokter = IFNULL(dp.kd_dokter, r.kd_dokter)
			LEFT JOIN poliklinik pl ON pl.kd_poli = r.kd_poli
			LEFT JOIN penjab pj ON pj.kd_pj = r.kd_pj
			WHERE r.tgl_registrasi BETWEEN ? AND ? AND r.stts <> 'Batal'`
		args := []interface{}{tglAwal, tglAkhir}
		if jenis == "Ralan" || jenis == "Ranap" {
			query += ` AND r.status_lanjut = ?`
			args = append(args, jenis)
		}
		if kdDokter != "" {
			query += ` AND IFNULL(dp.kd_dokter, r.kd_dokter) = ?`
			args = append(args, kdDokter)
		}
		if search != "" {
			like := "%" + search + "%"
			query += ` AND (r.no_rawat LIKE ? OR r.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ?)`
			args = append(args, like, like, like)
		}
		query += ` ORDER BY d.nm_dokter, r.tgl_registrasi, r.jam_reg LIMIT 5000`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data: " + err.Error()})
			return
		}
		defer rows.Close()

		data := []peruriPerluDiprosesRow{}
		for rows.Next() {
			var r peruriPerluDiprosesRow
			if err := rows.Scan(&r.NoRawat, &r.NoRkmMedis, &r.NmPasien, &r.TglRegistrasi, &r.JamReg,
				&r.StatusLanjut, &r.KdDokter, &r.NmDokter, &r.NmPoli, &r.PngJawab, &r.DokSudah, &r.DokBelum); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
				return
			}
			data = append(data, r)
		}
		c.JSON(http.StatusOK, gin.H{"data": data, "tte_tersedia": tteTersedia})
	}
}
