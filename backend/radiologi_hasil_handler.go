package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// radiologi_hasil_handler.go — dipakai modul Radiologi.tsx (worklist
// departemen radiologi lintas pasien): lihat detail 1 permintaan dan input
// hasil pemeriksaan. Padanan alur "Simpan" di DlgPeriksaRadiologi.java
// (Khanza Desktop): INSERT periksa_radiologi (snapshot tarif dari
// jns_perawatan_radiologi per pemeriksaan) + INSERT hasil_radiologi (satu
// baris teks bacaan per sesi) + UPDATE permintaan_radiologi.tgl_hasil/
// jam_hasil (penanda "Sudah Diperiksa"). SENGAJA TIDAK ikut insert
// gambar_radiologi (kolom lokasi file lokal jaman Khanza Desktop) — alur
// gambar sekarang lewat PACS Orthanc (ModalityWorklist.tsx/ImagingStudy.tsx),
// jalur terpisah. Juga TIDAK posting ke jurnal akuntansi (tampjurnal di
// Khanza) — di luar cakupan modul ini, sama seperti fitur klinis lain di
// app ini (Lab/Tindakan) yang juga belum mereplikasi sisi akuntansi itu.
// Permintaan baru dibuat dari layar pasien (RadTab.tsx > ModalInputRad),
// bukan dari modul Radiologi.tsx.

type radiologiPermintaanDetailExam struct {
	KdJenisPrw string `json:"kd_jenis_prw"`
	NmPerawatan string `json:"nm_perawatan"`
}

// POST /api/radiologi/sampel/:noorder — tombol "+Sampel" di Radiologi.tsx
// (dipilih lewat modal tanggal+jam, bukan otomatis "sekarang"), padanan
// BtnSampel di DlgCariPermintaanRadiologi.java: tandai waktu pasien mulai
// diperiksa (tgl_sampel/jam_sampel), sebelum hasil bacaan diisi. Body
// tgl/jam opsional — kosong berarti pakai waktu sekarang (fallback).
func setSampelRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		var body struct {
			Tgl string `json:"tgl"`
			Jam string `json:"jam"`
		}
		_ = c.ShouldBindJSON(&body)
		now := time.Now()
		tgl := body.Tgl
		if tgl == "" {
			tgl = now.Format("2006-01-02")
		}
		jam := body.Jam
		if jam == "" {
			jam = now.Format("15:04:05")
		} else if len(jam) == 5 {
			jam += ":00" // input type="time" tanpa detik (HH:MM) -> lengkapi jadi HH:MM:SS
		}
		result, err := db.Exec(
			`UPDATE permintaan_radiologi SET tgl_sampel = ?, jam_sampel = ? WHERE noorder = ?`,
			tgl, jam, noOrder,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := result.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Waktu sampel berhasil dicatat"})
	}
}

// GET /api/radiologi/permintaan/:noorder — detail 1 permintaan (header +
// daftar pemeriksaan) buat modal Input Hasil di Radiologi.tsx.
func getPermintaanRadiologiDetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		// sudah_ada_hasil dihitung DI SQL (bukan bandingkan string tgl_hasil
		// di Go) — koneksi DB ini pakai parseTime=true, jadi kolom DATE
		// zero-value '0000-00-00' datang ke Go sbg time.Time{} (bukan literal
		// string "0000-00-00"), bikin perbandingan string di sisi Go salah
		// terus (selalu true). Pola sama persis dipakai getPermintaanRadiologiList.
		var noRawat, noRkmMedis, nmPasien, dokterPerujuk, nmDokter, status, diagnosaKlinis, informasiTambahan string
		var sudahAdaHasil bool
		err := db.QueryRow(`
			SELECT pr.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				pr.dokter_perujuk, IFNULL(dokter.nm_dokter,''), pr.status,
				IFNULL(pr.diagnosa_klinis,''), IFNULL(pr.informasi_tambahan,''),
				IF(pr.tgl_hasil='0000-00-00', 0, 1)
			FROM permintaan_radiologi pr
			INNER JOIN reg_periksa ON pr.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pr.dokter_perujuk = dokter.kd_dokter
			WHERE pr.noorder = ?
		`, noOrder).Scan(&noRawat, &noRkmMedis, &nmPasien, &dokterPerujuk, &nmDokter, &status, &diagnosaKlinis, &informasiTambahan, &sudahAdaHasil)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}

		rows, err := db.Query(`
			SELECT ppr.kd_jenis_prw, IFNULL(jpr.nm_perawatan, ppr.kd_jenis_prw)
			FROM permintaan_pemeriksaan_radiologi ppr
			LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
			WHERE ppr.noorder = ?
		`, noOrder)
		exams := []radiologiPermintaanDetailExam{}
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e radiologiPermintaanDetailExam
				if rows.Scan(&e.KdJenisPrw, &e.NmPerawatan) == nil {
					exams = append(exams, e)
				}
			}
		}

		// Dokter P.J. (Penanggung Jawab Radiologi) — default dari
		// set_pjlab.kd_dokterrad, padanan persis DlgPeriksaRadiologi.java
		// (query "select set_pjlab.kd_dokterrad from set_pjlab" saat form
		// dibuka). Tetap bisa diganti manual di frontend, ini cuma default.
		var kdDokterPj, nmDokterPj string
		db.QueryRow(`
			SELECT sp.kd_dokterrad, IFNULL(d.nm_dokter,'')
			FROM set_pjlab sp LEFT JOIN dokter d ON sp.kd_dokterrad = d.kd_dokter
			LIMIT 1
		`).Scan(&kdDokterPj, &nmDokterPj)

		c.JSON(http.StatusOK, gin.H{
			"noorder": noOrder, "no_rawat": noRawat, "no_rkm_medis": noRkmMedis, "nm_pasien": nmPasien,
			"dokter_perujuk": dokterPerujuk, "nm_dokter": nmDokter, "status": status,
			"diagnosa_klinis": diagnosaKlinis, "informasi_tambahan": informasiTambahan,
			"sudah_ada_hasil": sudahAdaHasil,
			"pemeriksaan": exams,
			"kd_dokter_pj": kdDokterPj, "nm_dokter_pj": nmDokterPj,
		})
	}
}

type hasilRadiologiExamInput struct {
	KdJenisPrw    string `json:"kd_jenis_prw"`
	Proyeksi      string `json:"proyeksi"`
	KV            string `json:"kV"`
	MAS           string `json:"mAS"`
	FFD           string `json:"FFD"`
	BSF           string `json:"BSF"`
	Inak          string `json:"inak"`
	JmlPenyinaran string `json:"jml_penyinaran"`
	Dosis         string `json:"dosis"`
}

type saveHasilRadiologiRequest struct {
	NoOrder     string                    `json:"noorder" binding:"required"`
	NoRawat     string                    `json:"no_rawat" binding:"required"`
	Nip         string                    `json:"nip" binding:"required"`
	KdDokter    string                    `json:"kd_dokter" binding:"required"`
	Pemeriksaan []hasilRadiologiExamInput `json:"pemeriksaan"`
	Hasil       string                    `json:"hasil"`
	Tgl         string                    `json:"tgl"` // opsional — kosong = waktu sekarang (checkbox "Otomatis" di frontend)
	Jam         string                    `json:"jam"`
}

// POST /api/radiologi/hasil — simpan hasil pemeriksaan radiologi.
func saveHasilRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req saveHasilRadiologiRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Pemeriksaan) == 0 && strings.TrimSpace(req.Hasil) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Isi minimal satu pemeriksaan atau hasil bacaan"})
			return
		}

		var dokterPerujuk, statusLower string
		if err := db.QueryRow(`SELECT dokter_perujuk, status FROM permintaan_radiologi WHERE noorder = ?`, req.NoOrder).
			Scan(&dokterPerujuk, &statusLower); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}
		// periksa_radiologi.status enum-nya 'Ranap'/'Ralan' (kapital),
		// permintaan_radiologi.status 'ralan'/'ranap' (huruf kecil) — beda
		// casing yg sudah ada dari skema Khanza asli, disamakan di sini.
		statusPeriksa := "Ralan"
		if strings.EqualFold(statusLower, "ranap") {
			statusPeriksa = "Ranap"
		}

		now := time.Now()
		tglPeriksa := req.Tgl
		if tglPeriksa == "" {
			tglPeriksa = now.Format("2006-01-02")
		}
		jam := req.Jam
		if jam == "" {
			jam = now.Format("15:04:05")
		} else if len(jam) == 5 {
			jam += ":00" // input type="time" tanpa detik (HH:MM) -> lengkapi jadi HH:MM:SS
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		for _, exam := range req.Pemeriksaan {
			var bagianRs, bhp, tarifPerujuk, tarifTindakanDokter, tarifTindakanPetugas, kso, menejemen, totalByr float64
			err := tx.QueryRow(`
				SELECT IFNULL(bagian_rs,0), bhp, tarif_perujuk, tarif_tindakan_dokter,
					IFNULL(tarif_tindakan_petugas,0), IFNULL(kso,0), IFNULL(menejemen,0), IFNULL(total_byr,0)
				FROM jns_perawatan_radiologi WHERE kd_jenis_prw = ?
			`, exam.KdJenisPrw).Scan(&bagianRs, &bhp, &tarifPerujuk, &tarifTindakanDokter, &tarifTindakanPetugas, &kso, &menejemen, &totalByr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pemeriksaan " + exam.KdJenisPrw + " tidak ditemukan"})
				return
			}

			_, err = tx.Exec(`
				INSERT INTO periksa_radiologi (
					no_rawat, nip, kd_jenis_prw, tgl_periksa, jam, dokter_perujuk,
					bagian_rs, bhp, tarif_perujuk, tarif_tindakan_dokter, tarif_tindakan_petugas,
					kso, menejemen, biaya, kd_dokter, status,
					proyeksi, kV, mAS, FFD, BSF, inak, jml_penyinaran, dosis
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, req.NoRawat, req.Nip, exam.KdJenisPrw, tglPeriksa, jam, dokterPerujuk,
				bagianRs, bhp, tarifPerujuk, tarifTindakanDokter, tarifTindakanPetugas,
				kso, menejemen, totalByr, req.KdDokter, statusPeriksa,
				exam.Proyeksi, exam.KV, exam.MAS, exam.FFD, exam.BSF, exam.Inak, exam.JmlPenyinaran, exam.Dosis,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pemeriksaan " + exam.KdJenisPrw + ": " + err.Error()})
				return
			}
		}

		if strings.TrimSpace(req.Hasil) != "" {
			_, err = tx.Exec(`
				INSERT INTO hasil_radiologi (no_rawat, tgl_periksa, jam, hasil) VALUES (?, ?, ?, ?)
			`, req.NoRawat, tglPeriksa, jam, req.Hasil)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan hasil bacaan: " + err.Error()})
				return
			}
		}

		_, err = tx.Exec(`UPDATE permintaan_radiologi SET tgl_hasil = ?, jam_hasil = ? WHERE noorder = ?`, tglPeriksa, jam, req.NoOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status permintaan: " + err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Hasil pemeriksaan radiologi berhasil disimpan"})
	}
}
