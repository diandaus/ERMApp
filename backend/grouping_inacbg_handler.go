package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// grouping_inacbg_handler.go — dipakai modul GroupingInacbg.tsx (dibuka dari
// Casemix > List Klaim, klik No Rawat). Endpoint ini BARU nyediakan header
// (Data Pasien/Registrasi/Kunjungan) — bagian grouping (kirim ke aplikasi
// INA-CBG) sengaja belum ada, menyusul kalau sudah diminta.

type GroupingInacbgHeader struct {
	// Data Pasien
	NoRawat  string `json:"no_rawat"`
	NoRM     string `json:"no_rm"`
	NmPasien string `json:"nm_pasien"`
	Umur     string `json:"umur"`
	JK       string `json:"jk"`
	Alamat   string `json:"alamat"`
	// Data Registrasi
	TglRegistrasi string `json:"tgl_registrasi"`
	TanggalPulang string `json:"tanggal_pulang"`
	Poliklinik    string `json:"poliklinik"`
	Dpjp          string `json:"dpjp"`
	Status        string `json:"status"`
	Jaminan       string `json:"jaminan"`
	// Data Kunjungan
	NoSep       string `json:"no_sep"`
	NoKunjungan string `json:"no_kunjungan"`
	NoKartu     string `json:"no_kartu"`
	Tipe        string `json:"tipe"` // "RI" / "RJ"
	Cbg         string `json:"cbg"`  // hasil grouping — "-" (blm digrouping)
	DxUtama     string `json:"dx_utama"`
	ProsUtama   string `json:"pros_utama"`
	// Info Klaim
	Cob              string `json:"cob"` // "Ya" kalau bridging_sep.cob = "1..." (Coordination of Benefit)
	NaikKelas        string `json:"naik_kelas"`
	AdaRawatIntensif string `json:"ada_rawat_intensif"`
	KelasHak         string `json:"kelas_hak"`
	CaraMasuk        string `json:"cara_masuk"`
	Los              string `json:"los"`
	BeratLahir       string `json:"berat_lahir"`
	AdlScore         string `json:"adl_score"`
	CaraPulang       string `json:"cara_pulang"`
	JenisTarif       string `json:"jenis_tarif"`
	PasienTB         string `json:"pasien_tb"`
}

// GET /api/casemix/grouping-inacbg/:no_rawat
func getGroupingInacbgHeader(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var h GroupingInacbgHeader
		h.NoRawat = noRawat
		var tglLahir, jkRaw, statusLanjut, pngJawab, kdDokterReg string
		var tglRegistrasi, jamReg string
		err := db.QueryRow(`
			SELECT pasien.no_rkm_medis, pasien.nm_pasien, COALESCE(pasien.tgl_lahir,''), COALESCE(pasien.jk,''),
				COALESCE(pasien.alamat,''),
				DATE_FORMAT(reg_periksa.tgl_registrasi,'%Y-%m-%d'), COALESCE(reg_periksa.jam_reg,''),
				COALESCE(poliklinik.nm_poli,''), COALESCE(dokter.nm_dokter,''),
				reg_periksa.status_lanjut, COALESCE(penjab.png_jawab,''),
				COALESCE(reg_periksa.no_reg,''), reg_periksa.kd_dokter
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			LEFT JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
			LEFT JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&h.NoRM, &h.NmPasien, &tglLahir, &jkRaw, &h.Alamat,
			&tglRegistrasi, &jamReg, &h.Poliklinik, &h.Dpjp, &statusLanjut, &pngJawab, &h.NoKunjungan, &kdDokterReg)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
			return
		}

		// DPJP — prioritas dpjp_ranap (bisa lebih dari satu, digabung koma),
		// fallback ke dokter reg_periksa (sudah terisi di atas) kalau
		// ranap tanpa dpjp_ranap atau kunjungan ralan.
		var dpjpList string
		db.QueryRow(`
			SELECT COALESCE(GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', '), '')
			FROM dpjp_ranap dr INNER JOIN dokter d ON dr.kd_dokter = d.kd_dokter
			WHERE dr.no_rawat = ?
		`, noRawat).Scan(&dpjpList)
		if dpjpList != "" {
			h.Dpjp = dpjpList
		}

		h.Umur = umurTahunSaja(tglLahir)
		if jkRaw == "L" {
			h.JK = "Laki-Laki"
		} else if jkRaw == "P" {
			h.JK = "Perempuan"
		}
		h.TglRegistrasi = strings.TrimSpace(tglRegistrasi + " " + jamReg)
		h.Status = statusLanjut
		if pngJawab != "" {
			h.Status = statusLanjut + " (" + pngJawab + ")"
		}
		h.Jaminan = pngJawab
		h.Tipe = "RJ"
		if strings.EqualFold(statusLanjut, "ranap") {
			h.Tipe = "RI"
		}
		h.Cbg = "-"

		// No.SEP + No.Kartu dari SEP kalau sudah pernah diterbitkan
		// (bridging_sep) — dipakai sbg fallback tampilan, TIDAK menimpa
		// Dx/Pros Utama dari diagnosa_pasien/prosedur_pasien di bawah kalau
		// keduanya sudah ada (itu yg jadi acuan resmi grouping).
		var cobRaw, klsRawat, klsNaik, asalRujukan string
		db.QueryRow(`
			SELECT no_sep, COALESCE(no_kartu,''), IF(tglpulang IS NULL OR tglpulang='0000-00-00 00:00:00','',DATE_FORMAT(tglpulang,'%Y-%m-%d')),
				COALESCE(cob,''), COALESCE(klsrawat,''), COALESCE(klsnaik,''), COALESCE(asal_rujukan,'')
			FROM bridging_sep WHERE no_rawat = ? LIMIT 1
		`, noRawat).Scan(&h.NoSep, &h.NoKartu, &h.TanggalPulang, &cobRaw, &klsRawat, &klsNaik, &asalRujukan)
		if enumLeadingDigit(cobRaw, "0") == "1" {
			h.Cob = "Ya"
		}
		if strings.TrimSpace(klsNaik) != "" {
			h.NaikKelas = "Ya"
		}
		h.KelasHak = klsRawat
		h.CaraMasuk = caraMasukLabel(asalRujukan)
		h.AdlScore = "Sub Acute : - / Chronic : -"

		// Tanggal Pulang — utamakan kamar_inap (ranap, lebih akurat drpd
		// bridging_sep.tglpulang yg kadang belum diupdate), fallback ke
		// nilai dari bridging_sep di atas kalau ralan/blm ada kamar_inap.
		// LOS & Cara Pulang jg dari kamar_inap terbaru (khusus ranap).
		if h.Tipe == "RI" {
			var tglMasuk, tglKeluar, sttsPulang string
			db.QueryRow(`
				SELECT DATE_FORMAT(tgl_masuk,'%Y-%m-%d'),
					IF(tgl_keluar IS NULL OR tgl_keluar='0000-00-00','',DATE_FORMAT(tgl_keluar,'%Y-%m-%d')),
					COALESCE(stts_pulang,'')
				FROM kamar_inap WHERE no_rawat = ? ORDER BY tgl_masuk DESC, jam_masuk DESC LIMIT 1
			`, noRawat).Scan(&tglMasuk, &tglKeluar, &sttsPulang)
			if tglKeluar != "" {
				h.TanggalPulang = tglKeluar
				h.Los = strconv.Itoa(losHari(tglMasuk, tglKeluar)) + " hari"
			}
			h.CaraPulang = sttsPulang
		}

		// pasien_bayi.berat_badan — cuma ada utk pasien bayi/neonatus.
		var beratBadan sql.NullString
		db.QueryRow(`SELECT berat_badan FROM pasien_bayi WHERE no_rkm_medis = ?`, h.NoRM).Scan(&beratBadan)
		if beratBadan.Valid {
			h.BeratLahir = beratBadan.String
		}

		var dxKode, dxNama string
		if db.QueryRow(`
			SELECT dp.kd_penyakit, COALESCE(p.nm_penyakit,'')
			FROM diagnosa_pasien dp LEFT JOIN penyakit p ON dp.kd_penyakit = p.kd_penyakit
			WHERE dp.no_rawat = ? AND dp.prioritas = 1
			LIMIT 1
		`, noRawat).Scan(&dxKode, &dxNama) == nil && dxKode != "" {
			h.DxUtama = dxKode + " - " + dxNama
		}

		var prKode, prNama string
		if db.QueryRow(`
			SELECT pp.kode, COALESCE(i.deskripsi_panjang,'')
			FROM prosedur_pasien pp LEFT JOIN icd9 i ON pp.kode = i.kode
			WHERE pp.no_rawat = ? AND pp.prioritas = 1
			LIMIT 1
		`, noRawat).Scan(&prKode, &prNama) == nil && prKode != "" {
			h.ProsUtama = prKode + " - " + prNama
		}

		c.JSON(http.StatusOK, h)
	}
}

// umurTahunSaja — cuma "X Th" (bukan format lengkap "X Th Y Bl Z Hr" spt di
// cetak Radiologi/Lab) sesuai tampilan header GroupingInacbg.tsx.
func umurTahunSaja(tglLahir string) string {
	if tglLahir == "" || tglLahir == "0000-00-00" {
		return "-"
	}
	t, err := time.Parse("2006-01-02", tglLahir)
	if err != nil {
		return "-"
	}
	now := time.Now()
	years := now.Year() - t.Year()
	if now.Month() < t.Month() || (now.Month() == t.Month() && now.Day() < t.Day()) {
		years--
	}
	return strconv.Itoa(years) + " Th"
}
