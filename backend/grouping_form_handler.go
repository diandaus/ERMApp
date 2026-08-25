package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// grouping_form_handler.go — data form tab "Grouping" di GroupingInacbg.tsx.
// Layoutnya mengikuti tampilan aplikasi E-Klaim (grouper resmi Kemenkes/
// BPJS, sistem TERPISAH — Khanza cuma mengirim data ke sana lewat
// webservice terenkripsi AES-256-CBC, lihat webapps/inacbg/conf/wsinacbg.php
// referensi user). Endpoint ini BARU nyediakan ringkasan/preview form dari
// data yang SUDAH ada di app ini (bridging_sep, reg_periksa, kamar_inap,
// dpjp_ranap, diagnosa/prosedur) — BELUM mengirim apa pun ke E-Klaim
// (tombol Kirim di frontend sengaja dinonaktifkan dulu). Field yang tidak
// punya sumber data jelas di skema Khanza (ADL Score, Jenis Tarif/kelas
// RS, Pasien TB, breakdown tarif per kategori) sengaja dikosongkan/0,
// bukan ditebak — form-nya tetap bisa diisi manual oleh staf spt E-Klaim
// aslinya.

type GroupingFormData struct {
	// Ringkasan (strip atas)
	TanggalMasuk  string `json:"tanggal_masuk"`
	TanggalPulang string `json:"tanggal_pulang"`
	Jaminan       string `json:"jaminan"`
	NoSep         string `json:"no_sep"`
	Tipe          string `json:"tipe"` // "RI" / "RJ"

	// Form
	NoPeserta    string `json:"no_peserta"`
	Cob          bool   `json:"cob"`
	JenisRawat   string `json:"jenis_rawat"` // "jalan" / "inap"
	NaikKelas    bool   `json:"naik_kelas"`
	KelasHak     string `json:"kelas_hak"` // "1" / "2" / "3"
	TglMasukJam  string `json:"tgl_masuk_jam"`
	TglPulangJam string `json:"tgl_pulang_jam"`
	Umur         string `json:"umur"`
	CaraMasuk    string `json:"cara_masuk"`
	Los          int    `json:"los"`
	BeratLahir   string `json:"berat_lahir"`
	CaraPulang   string `json:"cara_pulang"`
	Dpjp         string `json:"dpjp"`

	// Perkiraan awal Tarif RS per komponen, dihitung dari billing — tetap
	// bisa diedit manual di form (bukan dikunci), sekadar starting point spy
	// coder tidak isi dari nol. Padanan persis query di klaimbarumanual.php.
	TarifRs map[string]float64 `json:"tarif_rs"`

	// Diagnosa/Prosedur iDRG auto dari diagnosa_pasien/prosedur_pasien (coding
	// yg sudah diisi dokter/perawat di RM), format sama persis dgn yg dikirim
	// ke E-Klaim (dipisah '#'). Tetap bisa diedit manual sblm klik Grup iDRG.
	DiagnosaIdrg string `json:"diagnosa_idrg"`
	ProsedurIdrg string `json:"prosedur_idrg"`
}

// GET /api/casemix/grouping-form/:no_rawat
func getGroupingForm(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var f GroupingFormData
		var statusLanjut, kdDokterReg, noRkmMedis, tglLahir string
		var tglRegistrasi, jamReg string
		err := db.QueryRow(`
			SELECT reg_periksa.status_lanjut, reg_periksa.kd_dokter, reg_periksa.no_rkm_medis,
				COALESCE(pasien.tgl_lahir,''),
				DATE_FORMAT(reg_periksa.tgl_registrasi,'%Y-%m-%d'), COALESCE(reg_periksa.jam_reg,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&statusLanjut, &kdDokterReg, &noRkmMedis, &tglLahir, &tglRegistrasi, &jamReg)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
			return
		}

		f.Umur = umurTahunLengkap(tglLahir)
		f.JenisRawat = "jalan"
		f.Tipe = "RJ"
		if strings.EqualFold(statusLanjut, "ranap") {
			f.JenisRawat = "inap"
			f.Tipe = "RI"
		}
		f.TglMasukJam = strings.TrimSpace(tglRegistrasi + " " + jamReg)
		f.TanggalMasuk = tglRegistrasi

		// DPJP — prioritas dpjp_ranap (bisa lebih dari satu, digabung koma),
		// fallback ke dokter reg_periksa kalau ranap tanpa dpjp_ranap atau
		// kunjungan ralan (sama pola nm_dokter2/nm_dokter di klaimbarumanual.php).
		var dpjpList string
		db.QueryRow(`
			SELECT COALESCE(GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', '), '')
			FROM dpjp_ranap dr INNER JOIN dokter d ON dr.kd_dokter = d.kd_dokter
			WHERE dr.no_rawat = ?
		`, noRawat).Scan(&dpjpList)
		if dpjpList != "" {
			f.Dpjp = dpjpList
		} else {
			db.QueryRow(`SELECT COALESCE(nm_dokter,'') FROM dokter WHERE kd_dokter = ?`, kdDokterReg).Scan(&f.Dpjp)
		}

		// Kamar inap terbaru (ranap) — tanggal masuk/keluar & status pulang.
		if f.JenisRawat == "inap" {
			var tglMasuk, jamMasuk, tglKeluar, jamKeluar, sttsPulang string
			db.QueryRow(`
				SELECT DATE_FORMAT(tgl_masuk,'%Y-%m-%d'), COALESCE(jam_masuk,''),
					IF(tgl_keluar IS NULL OR tgl_keluar='0000-00-00','',DATE_FORMAT(tgl_keluar,'%Y-%m-%d')), COALESCE(jam_keluar,''),
					COALESCE(stts_pulang,'')
				FROM kamar_inap WHERE no_rawat = ? ORDER BY tgl_masuk DESC, jam_masuk DESC LIMIT 1
			`, noRawat).Scan(&tglMasuk, &jamMasuk, &tglKeluar, &jamKeluar, &sttsPulang)
			if tglMasuk != "" {
				f.TanggalMasuk = tglMasuk
				f.TglMasukJam = strings.TrimSpace(tglMasuk + " " + jamMasuk)
			}
			if tglKeluar != "" {
				f.TanggalPulang = tglKeluar
				f.TglPulangJam = strings.TrimSpace(tglKeluar + " " + jamKeluar)
				f.Los = losHari(f.TanggalMasuk, tglKeluar)
			}
			f.CaraPulang = sttsPulang
		}

		// pasien_bayi.berat_badan — cuma ada utk pasien bayi/neonatus,
		// kosong (dianggap "-" di frontend) kalau bukan.
		var beratBadan sql.NullString
		db.QueryRow(`SELECT berat_badan FROM pasien_bayi WHERE no_rkm_medis = ?`, noRkmMedis).Scan(&beratBadan)
		if beratBadan.Valid {
			f.BeratLahir = beratBadan.String
		}

		// bridging_sep — kalau SEP sudah diterbitkan, sebagian besar field
		// form ini prefill dari sana (persis field yg dipakai
		// klaimbarumanual.php sblm dikirim ke E-Klaim).
		var noKartu, pngJawab, cobRaw, klsRawat, klsNaik, asalRujukan string
		errSep := db.QueryRow(`
			SELECT bs.no_kartu, COALESCE(pj.png_jawab,''), bs.cob, bs.klsrawat, bs.klsnaik, bs.asal_rujukan
			FROM bridging_sep bs
			LEFT JOIN reg_periksa rp ON rp.no_rawat = bs.no_rawat
			LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
			WHERE bs.no_rawat = ? LIMIT 1
		`, noRawat).Scan(&noKartu, &pngJawab, &cobRaw, &klsRawat, &klsNaik, &asalRujukan)
		if errSep == nil {
			f.NoPeserta = noKartu
			f.Jaminan = pngJawab
			f.Cob = enumLeadingDigit(cobRaw, "0") == "1"
			f.KelasHak = klsRawat
			f.NaikKelas = strings.TrimSpace(klsNaik) != ""
			f.CaraMasuk = caraMasukLabel(asalRujukan)
		}
		db.QueryRow(`SELECT no_sep FROM bridging_sep WHERE no_rawat = ? LIMIT 1`, noRawat).Scan(&f.NoSep)
		if f.Jaminan == "" {
			// Fallback kalau belum ada SEP — ambil penjamin langsung dari
			// reg_periksa spy Jaminan tidak kosong total.
			db.QueryRow(`
				SELECT COALESCE(penjab.png_jawab,'') FROM reg_periksa
				LEFT JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				WHERE reg_periksa.no_rawat = ?
			`, noRawat).Scan(&f.Jaminan)
		}

		f.TarifRs = computeTarifRs(db, noRawat)
		f.DiagnosaIdrg, f.ProsedurIdrg = computeIdrgCoding(db, noRawat)

		c.JSON(http.StatusOK, f)
	}
}

// computeIdrgCoding — susun string Diagnosa/Prosedur iDRG dari
// diagnosa_pasien/prosedur_pasien (coding yg sudah diisi di RM), padanan
// PERSIS query "Diagnosa IDRG"/"Prosedur IDRG" di klaimbarumanual.php:
// diurut prioritas, digabung '#'. Untuk prosedur, jumlah>1 ditambahkan sbg
// suffix "+N" (jumlah=1 tidak ditambah suffix — str_replace("+1","",...) di
// sumber aslinya menghapusnya).
func computeIdrgCoding(db *sql.DB, noRawat string) (string, string) {
	var diagnosa []string
	rowsD, err := db.Query(`SELECT kd_penyakit FROM diagnosa_pasien WHERE no_rawat = ? ORDER BY prioritas ASC`, noRawat)
	if err == nil {
		defer rowsD.Close()
		for rowsD.Next() {
			var kd string
			if rowsD.Scan(&kd) == nil {
				diagnosa = append(diagnosa, kd)
			}
		}
	}

	var prosedur []string
	rowsP, err := db.Query(`SELECT kode, jumlah FROM prosedur_pasien WHERE no_rawat = ? ORDER BY prioritas ASC`, noRawat)
	if err == nil {
		defer rowsP.Close()
		for rowsP.Next() {
			var kode, jumlah string
			if rowsP.Scan(&kode, &jumlah) == nil {
				suffix := strings.ReplaceAll("+"+jumlah, "+1", "")
				prosedur = append(prosedur, kode+suffix)
			}
		}
	}

	return strings.Join(diagnosa, "#"), strings.Join(prosedur, "#")
}

// computeTarifRs — breakdown Tarif RS per komponen dari tabel billing,
// padanan PERSIS query di klaimbarumanual.php (Khanza) supaya angka yg
// muncul sama dgn yg biasa dipakai coder di aplikasi lama. tenaga_ahli,
// rawat_intensif, alkes, tarif_poli_eks memang di-hardcode 0 di sumbernya
// juga (tidak ada mapping billing-nya) — tetap 0 di sini, isi manual.
func computeTarifRs(db *sql.DB, noRawat string) map[string]float64 {
	sum := func(where string) float64 {
		var v sql.NullFloat64
		if err := db.QueryRow(`SELECT SUM(totalbiaya) FROM billing WHERE no_rawat = ? AND `+where, noRawat).Scan(&v); err != nil {
			return 0
		}
		return v.Float64
	}

	prosedurNonBedah := sum(`nm_perawatan LIKE '%PNB%'`)
	prosedurBedah := sum(`nm_perawatan LIKE '%PB%'`)
	konsultasi := sum(`(nm_perawatan LIKE '%KONSUL%' OR nm_perawatan LIKE '%(KSL)%')`)
	keperawatan := sum(`(status = 'Ranap Paramedis' OR status = 'Ralan Paramedis') AND nm_perawatan LIKE '%(TDP)%'`)
	penunjang := sum(`(status = 'Ranap Paramedis' OR status = 'Ralan Paramedis') AND nm_perawatan LIKE '%(PNG)%'`)
	radiologi := sum(`status = 'Radiologi'`)
	laboratorium := sum(`status = 'Laborat'`)
	pelayananDarah := sum(`(nm_perawatan LIKE '%DRH%' OR nm_perawatan LIKE '%(DRH)%')`)
	rehabilitasi := sum(`status = 'Ralan Dokter Paramedis' AND nm_perawatan LIKE '%terapi%'`) +
		sum(`status = 'Ranap Dokter Paramedis' AND nm_perawatan LIKE '%terapi%'`)

	var biayaReg sql.NullFloat64
	db.QueryRow(`SELECT biaya_reg FROM reg_periksa WHERE no_rawat = ?`, noRawat).Scan(&biayaReg)
	kamar := sum(`status = 'Kamar'`) + biayaReg.Float64

	obatKronis := sum(`nm_perawatan LIKE '%kronis%' AND status = 'Obat'`)
	obatKemoterapi := sum(`nm_perawatan LIKE '%kemo%' AND status = 'Obat'`)
	obat := sum(`status = 'Obat'`) + sum(`status = 'Retur Obat'`) + sum(`status = 'Resep Pulang'`) - obatKronis - obatKemoterapi

	bmhp := sum(`status = 'Tambahan'`)
	sewaAlat := sum(`nm_perawatan LIKE '%(ALM)%' AND status IN ('Ralan Paramedis','Ranap Paramedis','Ralan Dokter Paramedis','Ranap Dokter Paramedis','Ralan Dokter','Ranap Dokter')`)

	return map[string]float64{
		"prosedur_non_bedah": prosedurNonBedah,
		"prosedur_bedah":     prosedurBedah,
		"konsultasi":         konsultasi,
		"tenaga_ahli":        0,
		"keperawatan":        keperawatan,
		"penunjang":          penunjang,
		"radiologi":          radiologi,
		"laboratorium":       laboratorium,
		"pelayanan_darah":    pelayananDarah,
		"rehabilitasi":       rehabilitasi,
		"kamar":              kamar,
		"rawat_intensif":     0,
		"obat":               obat,
		"obat_kronis":        obatKronis,
		"obat_kemoterapi":    obatKemoterapi,
		"alkes":              0,
		"bmhp":               bmhp,
		"sewa_alat":          sewaAlat,
	}
}

func caraMasukLabel(asalRujukan string) string {
	switch {
	case strings.Contains(asalRujukan, "Faskes 1"):
		return "Rujukan FKTP"
	case strings.Contains(asalRujukan, "Faskes 2"):
		return "Rujukan FKRTL"
	case asalRujukan == "":
		return ""
	default:
		return "Lainnya"
	}
}

func losHari(tglMasuk, tglKeluar string) int {
	m, err1 := time.Parse("2006-01-02", tglMasuk)
	k, err2 := time.Parse("2006-01-02", tglKeluar)
	if err1 != nil || err2 != nil {
		return 0
	}
	d := int(k.Sub(m).Hours() / 24)
	if d < 0 {
		return 0
	}
	return d
}

// umurTahunLengkap — "X tahun" (huruf kecil semua, beda dari umurTahunSaja
// di grouping_inacbg_handler.go yg formatnya "X Th") sesuai tampilan form
// E-Klaim di screenshot ("33 tahun").
func umurTahunLengkap(tglLahir string) string {
	u := umurTahunSaja(tglLahir)
	if u == "-" {
		return "-"
	}
	return strings.Replace(u, " Th", " tahun", 1)
}
