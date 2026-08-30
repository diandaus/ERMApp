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
	KdJenisPrw  string `json:"kd_jenis_prw"`
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

		// Hasil terakhir — dipakai tombol "Lihat Hasil" di Radiologi.tsx
		// supaya modal langsung menampilkan bacaan yg sudah pernah diisi
		// (bukan textarea kosong), diambil dari hasil_radiologi berdasarkan
		// no_rawat, baris terbaru.
		var hasilTerakhir string
		if sudahAdaHasil {
			db.QueryRow(`
				SELECT hasil FROM hasil_radiologi WHERE no_rawat = ?
				ORDER BY tgl_periksa DESC, jam DESC LIMIT 1
			`, noRawat).Scan(&hasilTerakhir)
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder": noOrder, "no_rawat": noRawat, "no_rkm_medis": noRkmMedis, "nm_pasien": nmPasien,
			"dokter_perujuk": dokterPerujuk, "nm_dokter": nmDokter, "status": status,
			"diagnosa_klinis": diagnosaKlinis, "informasi_tambahan": informasiTambahan,
			"sudah_ada_hasil": sudahAdaHasil,
			"pemeriksaan":     exams,
			"kd_dokter_pj":    kdDokterPj, "nm_dokter_pj": nmDokterPj,
			"hasil_terakhir": hasilTerakhir,
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
	// DokterPerujuk — opsional, dikirim dari ModalCariDokter kalau petugas
	// mengoreksi dokter perujuk yg salah di data permintaan asal (fitur
	// baru di ModalHasilRadiologi.tsx). Kosong = pakai nilai yg sudah ada
	// di permintaan_radiologi (perilaku lama, tidak berubah).
	DokterPerujuk string `json:"dokter_perujuk"`
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
		dokterPerujukDikoreksi := req.DokterPerujuk != "" && req.DokterPerujuk != dokterPerujuk
		if dokterPerujukDikoreksi {
			dokterPerujuk = req.DokterPerujuk
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

		if dokterPerujukDikoreksi {
			if _, err := tx.Exec(`UPDATE permintaan_radiologi SET dokter_perujuk = ? WHERE noorder = ?`, dokterPerujuk, req.NoOrder); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update dokter perujuk: " + err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Hasil pemeriksaan radiologi berhasil disimpan"})
	}
}

// GET /api/radiologi/cetak/:noorder — data cetak "HASIL PEMERIKSAAN
// RADIOLOGI", padanan BtnPrint1ActionPerformed di
// DlgCariPeriksaRadiologi.java (Khanza Desktop). Berbeda dari Khanza (yg
// user pilih baris periksa_radiologi spesifik dari tabel), di sini SELALU
// ambil sesi periksa TERBARU (tgl_periksa+jam terakhir) utk no_rawat itu —
// konsisten dgn konsep "hasil_terakhir" yg sudah dipakai tombol Lihat
// Hasil. Layout PDF-nya (kop RS, info 2 kolom, kotak hasil, tanda tangan
// 2 kolom dgn QR) dirender di frontend (window.print(), reuse pola
// DetailPemberianObat.tsx) — endpoint ini cuma nyediakan datanya.
func getCetakHasilRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		var noRawat, dokterPerujukOrder string
		if err := db.QueryRow(`SELECT no_rawat, dokter_perujuk FROM permintaan_radiologi WHERE noorder = ?`, noOrder).
			Scan(&noRawat, &dokterPerujukOrder); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}

		// DATE_FORMAT di SQL, bukan bandingkan/parse string tanggal mentah di
		// Go — koneksi DB ini pakai parseTime=true, kolom DATE mentah datang
		// sbg time.Time (bukan literal "YYYY-MM-DD"), bikin tglPeriksa salah
		// format terus kalau di-scan langsung ke string. Sama persis bug yg
		// sudah diperbaiki di getPermintaanRadiologiList/Detail.
		var tglPeriksa, jam string
		if err := db.QueryRow(`
			SELECT DATE_FORMAT(tgl_periksa,'%Y-%m-%d'), jam FROM periksa_radiologi WHERE no_rawat = ?
			ORDER BY tgl_periksa DESC, jam DESC LIMIT 1
		`, noRawat).Scan(&tglPeriksa, &jam); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Belum ada hasil pemeriksaan untuk order ini"})
			return
		}

		rows, err := db.Query(`
			SELECT jpr.nm_perawatan, pr.kd_dokter, IFNULL(dpj.nm_dokter,''), pr.nip,
				pr.dokter_perujuk, IFNULL(dperujuk.nm_dokter,'')
			FROM periksa_radiologi pr
			LEFT JOIN jns_perawatan_radiologi jpr ON pr.kd_jenis_prw = jpr.kd_jenis_prw
			LEFT JOIN dokter dpj ON pr.kd_dokter = dpj.kd_dokter
			LEFT JOIN dokter dperujuk ON pr.dokter_perujuk = dperujuk.kd_dokter
			WHERE pr.no_rawat = ? AND pr.tgl_periksa = ? AND pr.jam = ?
		`, noRawat, tglPeriksa, jam)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var pemeriksaanList []string
		var kdDokterPj, nmDokterPj, nip, dokterPerujuk, nmDokterPerujuk string
		for rows.Next() {
			var nmPerawatan string
			if rows.Scan(&nmPerawatan, &kdDokterPj, &nmDokterPj, &nip, &dokterPerujuk, &nmDokterPerujuk) == nil {
				if nmPerawatan != "" {
					pemeriksaanList = append(pemeriksaanList, nmPerawatan)
				}
			}
		}
		rows.Close()
		if len(pemeriksaanList) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Belum ada hasil pemeriksaan untuk order ini"})
			return
		}
		// dokter_perujuk bisa kosong di periksa_radiologi lama — fallback ke
		// punya permintaan_radiologi (dokterPerujukOrder), lookup ulang namanya.
		if dokterPerujuk == "" {
			dokterPerujuk = dokterPerujukOrder
			db.QueryRow(`SELECT IFNULL(nm_dokter,'') FROM dokter WHERE kd_dokter = ?`, dokterPerujuk).Scan(&nmDokterPerujuk)
		}

		var nmPetugas string
		db.QueryRow(`SELECT IFNULL(nama,'') FROM petugas WHERE nip = ?`, nip).Scan(&nmPetugas)

		// Email dokter P.J. — dipakai fitur Tanda Tangan Elektronik Peruri
		// (ModalHasilRadiologi.tsx), penandatangan dokumen ini SELALU dokter
		// penanggung jawab (bukan petugas radiografer).
		var emailDokterPj string
		db.QueryRow(`SELECT IFNULL(email,'') FROM dokter WHERE kd_dokter = ?`, kdDokterPj).Scan(&emailDokterPj)

		var hasil string
		db.QueryRow(`SELECT hasil FROM hasil_radiologi WHERE no_rawat = ? AND tgl_periksa = ? AND jam = ?`, noRawat, tglPeriksa, jam).Scan(&hasil)

		var noRkmMedis, nmPasien, jk, tglLahir, alamat string
		db.QueryRow(`
			SELECT pasien.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.jk,''), IFNULL(pasien.tgl_lahir,''),
				CONCAT_WS(', ', NULLIF(pasien.alamat,''), kelurahan.nm_kel, kecamatan.nm_kec, kabupaten.nm_kab)
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN kelurahan ON pasien.kd_kel = kelurahan.kd_kel
			LEFT JOIN kecamatan ON pasien.kd_kec = kecamatan.kd_kec
			LEFT JOIN kabupaten ON pasien.kd_kab = kabupaten.kd_kab
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&noRkmMedis, &nmPasien, &jk, &tglLahir, &alamat)

		// Poli/Ruang — persis pola CASE WHEN di getPermintaanRadiologiList
		// (ralan: poliklinik registrasi, ranap: kamar+bangsal terbaru).
		// poliLabel dikirim terpisah dari nilainya ("Kamar" utk ranap, "Poli"
		// utk ralan/poliklinik) — dipakai frontend (ModalHasilRadiologi.tsx,
		// buildRadiologiPdfUntukTtd) buat label baris info yg sesuai, bukan
		// selalu "Poli" walau sebenarnya kamar rawat inap.
		var poli, poliLabel string
		var statusLanjut string
		db.QueryRow(`SELECT status_lanjut FROM reg_periksa WHERE no_rawat = ?`, noRawat).Scan(&statusLanjut)
		if strings.EqualFold(statusLanjut, "ranap") {
			poliLabel = "Kamar"
			var kdKamar, nmBangsal string
			db.QueryRow(`SELECT kd_kamar FROM kamar_inap WHERE no_rawat = ? ORDER BY tgl_masuk DESC, jam_masuk DESC LIMIT 1`, noRawat).Scan(&kdKamar)
			if kdKamar != "" {
				db.QueryRow(`SELECT nm_bangsal FROM bangsal INNER JOIN kamar ON bangsal.kd_bangsal = kamar.kd_bangsal WHERE kamar.kd_kamar = ?`, kdKamar).Scan(&nmBangsal)
				poli = strings.TrimSpace(kdKamar + " " + nmBangsal)
			} else {
				poli = "Ranap Gabung"
			}
		} else {
			poliLabel = "Poli"
			db.QueryRow(`
				SELECT IFNULL(poliklinik.nm_poli,'') FROM reg_periksa
				LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
				WHERE reg_periksa.no_rawat = ?
			`, noRawat).Scan(&poli)
		}

		tglFormatted := tglPeriksa
		if t, err := time.Parse("2006-01-02", tglPeriksa); err == nil {
			tglFormatted = t.Format("02-01-2006")
		}

		c.JSON(http.StatusOK, gin.H{
			"no_periksa":             noOrder,
			"no_rm":                  noRkmMedis,
			"nama_pasien":            nmPasien,
			"jk":                     jk,
			"tgl_lahir":              tglLahir,
			"alamat":                 alamat,
			"pemeriksaan":            strings.Join(pemeriksaanList, ", "),
			"penanggung_jawab":       nmDokterPj,
			"kd_penanggung_jawab":    kdDokterPj,
			"email_penanggung_jawab": emailDokterPj,
			"dokter_pengirim":        nmDokterPerujuk,
			"tgl_pemeriksaan":        tglFormatted,
			"jam_pemeriksaan":        jam,
			"poli":                   poli,
			"poli_label":             poliLabel,
			"hasil":                  hasil,
			"petugas_nip":            nip,
			"petugas_nama":           nmPetugas,
		})
	}
}
