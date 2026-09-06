package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// DASHBOARD — statistik kunjungan pasien (hari ini/bulan ini/tahun ini, total
// keseluruhan RS) + perbandingan cara bayar per periode yg sama, dipecah jadi
// 2 card terpisah: Pasien Poliklinik/Rawat Jalan (status_lanjut='Ralan') dan
// Pasien Rawat Inap (status_lanjut='Ranap'). Dipakai menu "Dashboard" baru di
// sidebar (App.tsx), sebelum "Menu Utama".
// ============================================================================

type CaraBayarSlice struct {
	Label string `json:"label"`
	Total int    `json:"total"`
}

type DashboardStats struct {
	KunjunganHariIni  int `json:"kunjungan_hari_ini"`
	KunjunganBulanIni int `json:"kunjungan_bulan_ini"`
	KunjunganTahunIni int `json:"kunjungan_tahun_ini"`

	CaraBayarPoliHariIni   []CaraBayarSlice `json:"cara_bayar_poli_hari_ini"`
	CaraBayarPoliBulanIni  []CaraBayarSlice `json:"cara_bayar_poli_bulan_ini"`
	CaraBayarPoliTahunIni  []CaraBayarSlice `json:"cara_bayar_poli_tahun_ini"`
	CaraBayarRanapHariIni  []CaraBayarSlice `json:"cara_bayar_ranap_hari_ini"`
	CaraBayarRanapBulanIni []CaraBayarSlice `json:"cara_bayar_ranap_bulan_ini"`
	CaraBayarRanapTahunIni []CaraBayarSlice `json:"cara_bayar_ranap_tahun_ini"`
}

// queryCaraBayar — dikelompokkan jadi 4 kategori besar (UMUM/BPJS/
// Asuransi/Lainnya) drpd per-nama-perusahaan asuransi satu-satu (puluhan
// slice tidak enak dibaca di pie chart). whereClause diisi filter periode +
// status_lanjut (+ filter kd_dokter kalau ada), args berisi parameternya.
func queryCaraBayar(db *sql.DB, whereClause string, args []interface{}) ([]CaraBayarSlice, error) {
	// Tampilkan apa adanya nama cara bayar (penjab.png_jawab) — TIDAK
	// dikelompokkan paksa ke 4 kategori besar lagi, biar cara bayar apa saja
	// yg benar-benar dipakai (2 macam, 5 macam, dst) muncul semua.
	query := `
		SELECT penjab.png_jawab AS kategori, COUNT(*) AS total
		FROM reg_periksa
		INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
		WHERE ` + whereClause + `
		GROUP BY penjab.png_jawab
		ORDER BY total DESC`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []CaraBayarSlice{}
	for rows.Next() {
		var s CaraBayarSlice
		if err := rows.Scan(&s.Label, &s.Total); err != nil {
			continue
		}
		result = append(result, s)
	}
	return result, nil
}

// buildCaraBayarWhere — gabungkan filter periode + status_lanjut ('Ralan'
// utk poliklinik/rawat jalan, 'Ranap' utk rawat inap) + kd_dokter opsional.
func buildCaraBayarWhere(periodeCond string, statusLanjut string, kdDokter string) (string, []interface{}) {
	where := periodeCond + " AND reg_periksa.status_lanjut = ?"
	args := []interface{}{statusLanjut}
	if kdDokter != "" {
		where += " AND reg_periksa.kd_dokter = ?"
		args = append(args, kdDokter)
	}
	return where, args
}

func getDashboardStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats DashboardStats

		// kd_dokter — jika diisi (user login role dokter, username = kd_dokter),
		// dashboard di-scope hanya ke kunjungan dokter tsb saja.
		kdDokter := c.Query("kd_dokter")
		dokterFilter := ""
		if kdDokter != "" {
			dokterFilter = " AND reg_periksa.kd_dokter = ?"
		}

		hariArgs := []interface{}{}
		hariQuery := "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = CURDATE()"
		if kdDokter != "" {
			hariQuery += dokterFilter
			hariArgs = append(hariArgs, kdDokter)
		}
		if err := db.QueryRow(hariQuery, hariArgs...).Scan(&stats.KunjunganHariIni); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung kunjungan hari ini: " + err.Error()})
			return
		}

		bulanArgs := []interface{}{}
		bulanQuery := "SELECT COUNT(*) FROM reg_periksa WHERE YEAR(tgl_registrasi) = YEAR(CURDATE()) AND MONTH(tgl_registrasi) = MONTH(CURDATE())"
		if kdDokter != "" {
			bulanQuery += dokterFilter
			bulanArgs = append(bulanArgs, kdDokter)
		}
		if err := db.QueryRow(bulanQuery, bulanArgs...).Scan(&stats.KunjunganBulanIni); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung kunjungan bulan ini: " + err.Error()})
			return
		}

		tahunArgs := []interface{}{}
		tahunQuery := "SELECT COUNT(*) FROM reg_periksa WHERE YEAR(tgl_registrasi) = YEAR(CURDATE())"
		if kdDokter != "" {
			tahunQuery += dokterFilter
			tahunArgs = append(tahunArgs, kdDokter)
		}
		if err := db.QueryRow(tahunQuery, tahunArgs...).Scan(&stats.KunjunganTahunIni); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung kunjungan tahun ini: " + err.Error()})
			return
		}

		// Cara bayar dihitung utk 3 periode (hari ini/bulan ini/tahun ini) x
		// 2 status_lanjut (Ralan=Poliklinik/Rawat Jalan, Ranap=Rawat Inap) —
		// semua dikirim sekaligus, frontend tinggal render tanpa request ulang.
		periodeConds := map[string]string{
			"hari":  "reg_periksa.tgl_registrasi = CURDATE()",
			"bulan": "YEAR(reg_periksa.tgl_registrasi) = YEAR(CURDATE()) AND MONTH(reg_periksa.tgl_registrasi) = MONTH(CURDATE())",
			"tahun": "YEAR(reg_periksa.tgl_registrasi) = YEAR(CURDATE())",
		}

		where, args := buildCaraBayarWhere(periodeConds["hari"], "Ralan", kdDokter)
		poliHariIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar poliklinik hari ini: " + err.Error()})
			return
		}
		stats.CaraBayarPoliHariIni = poliHariIni

		where, args = buildCaraBayarWhere(periodeConds["bulan"], "Ralan", kdDokter)
		poliBulanIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar poliklinik bulan ini: " + err.Error()})
			return
		}
		stats.CaraBayarPoliBulanIni = poliBulanIni

		where, args = buildCaraBayarWhere(periodeConds["tahun"], "Ralan", kdDokter)
		poliTahunIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar poliklinik tahun ini: " + err.Error()})
			return
		}
		stats.CaraBayarPoliTahunIni = poliTahunIni

		where, args = buildCaraBayarWhere(periodeConds["hari"], "Ranap", kdDokter)
		ranapHariIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar rawat inap hari ini: " + err.Error()})
			return
		}
		stats.CaraBayarRanapHariIni = ranapHariIni

		where, args = buildCaraBayarWhere(periodeConds["bulan"], "Ranap", kdDokter)
		ranapBulanIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar rawat inap bulan ini: " + err.Error()})
			return
		}
		stats.CaraBayarRanapBulanIni = ranapBulanIni

		where, args = buildCaraBayarWhere(periodeConds["tahun"], "Ranap", kdDokter)
		ranapTahunIni, err := queryCaraBayar(db, where, args)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar rawat inap tahun ini: " + err.Error()})
			return
		}
		stats.CaraBayarRanapTahunIni = ranapTahunIni

		c.JSON(http.StatusOK, stats)
	}
}
