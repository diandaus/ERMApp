package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// DASHBOARD — statistik kunjungan pasien (hari ini/bulan ini/tahun ini) +
// perbandingan cara bayar bulan berjalan, dipakai menu "Dashboard" baru di
// sidebar (App.tsx), sebelum "Menu Utama".
// ============================================================================

type CaraBayarSlice struct {
	Label string `json:"label"`
	Total int    `json:"total"`
}

type DashboardStats struct {
	KunjunganHariIni  int              `json:"kunjungan_hari_ini"`
	KunjunganBulanIni int              `json:"kunjungan_bulan_ini"`
	KunjunganTahunIni int              `json:"kunjungan_tahun_ini"`
	CaraBayar         []CaraBayarSlice `json:"cara_bayar"`
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

		// Cara bayar — dikelompokkan jadi 4 kategori besar (UMUM/BPJS/
		// Asuransi/Lainnya) drpd per-nama-perusahaan asuransi satu-satu
		// (puluhan slice tidak enak dibaca di pie chart), scope bulan
		// berjalan spy relevan & tidak terlalu berat query-nya.
		caraBayarQuery := `
			SELECT
				CASE
					WHEN penjab.png_jawab = 'UMUM' THEN 'Umum'
					WHEN penjab.png_jawab = 'BPJS' THEN 'BPJS'
					WHEN penjab.png_jawab LIKE 'Asuransi%' THEN 'Asuransi'
					ELSE 'Lainnya'
				END AS kategori,
				COUNT(*) AS total
			FROM reg_periksa
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			WHERE YEAR(reg_periksa.tgl_registrasi) = YEAR(CURDATE()) AND MONTH(reg_periksa.tgl_registrasi) = MONTH(CURDATE())`
		caraBayarArgs := []interface{}{}
		if kdDokter != "" {
			caraBayarQuery += dokterFilter
			caraBayarArgs = append(caraBayarArgs, kdDokter)
		}
		caraBayarQuery += " GROUP BY kategori ORDER BY total DESC"

		rows, err := db.Query(caraBayarQuery, caraBayarArgs...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hitung cara bayar: " + err.Error()})
			return
		}
		defer rows.Close()

		stats.CaraBayar = []CaraBayarSlice{}
		for rows.Next() {
			var s CaraBayarSlice
			if err := rows.Scan(&s.Label, &s.Total); err != nil {
				continue
			}
			stats.CaraBayar = append(stats.CaraBayar, s)
		}

		c.JSON(http.StatusOK, stats)
	}
}
