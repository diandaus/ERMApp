package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// RiwayatPerawatan represents patient treatment history
type RiwayatPerawatan struct {
	NoRawat       string `json:"no_rawat"`
	TglRegistrasi string `json:"tgl_registrasi"`
	JamReg        string `json:"jam_reg"`
	KdPoli        string `json:"kd_poli"`
	NmPoli        string `json:"nm_poli"`
	KdDokter      string `json:"kd_dokter"`
	NmDokter      string `json:"nm_dokter"`
	StatusLanjut  string `json:"status_lanjut"`
	PngJawab      string `json:"png_jawab"`
	Stts          string `json:"stts"`
	Diagnosa      string `json:"diagnosa"`
}

// Detailed structures for complete medical history
type DetailedRiwayatPerawatan struct {
	TriasePrimer      *TriasePrimerData     `json:"triase_primer,omitempty"`
	TriaseSekunder    *TriaseSekunderData   `json:"triase_sekunder,omitempty"`
	AsuhanMedis       *AsuhanMedisData      `json:"asuhan_medis,omitempty"`
	SOAPRawatJalan    []SOAPData            `json:"soap_rawat_jalan,omitempty"`
	SOAPRanap         []SOAPData            `json:"soap_ranap,omitempty"`
	TindakanDokter    []TindakanData        `json:"tindakan_dokter,omitempty"`
	TindakanParamedis []TindakanData        `json:"tindakan_paramedis,omitempty"`
	KamarInap         []KamarInapData       `json:"kamar_inap,omitempty"`
	Radiologi         []RadiologiData       `json:"radiologi,omitempty"`
	HasilRadiologi    []HasilRadiologiData  `json:"hasil_radiologi,omitempty"`
	GambarRadiologi   []GambarRadiologiData `json:"gambar_radiologi,omitempty"`
	LabPKMB           []LabData             `json:"lab_pk_mb,omitempty"`
	LabPA             []LabPAData           `json:"lab_pa,omitempty"`
	PemberianObat     []PemberianObatData   `json:"pemberian_obat,omitempty"`
	ResepPulang       []ResepPulangData     `json:"resep_pulang,omitempty"`
	PPNObat           []BiayaData           `json:"ppn_obat,omitempty"`
	TambahanBiaya     []BiayaData           `json:"tambahan_biaya,omitempty"`
	PotonganBiaya     []BiayaData           `json:"potongan_biaya,omitempty"`
	TotalBiaya        float64               `json:"total_biaya"`
}

type TriasePrimerData struct {
	CaraMasuk            string                  `json:"cara_masuk"`
	AlatTransportasi     string                  `json:"alat_transportasi"`
	AlasanKedatangan     string                  `json:"alasan_kedatangan"`
	KeteranganKedatangan string                  `json:"keterangan_kedatangan"`
	MacamKasus           string                  `json:"macam_kasus"`
	KeluhanUtama         string                  `json:"keluhan_utama"`
	Suhu                 string                  `json:"suhu"`
	Nyeri                string                  `json:"nyeri"`
	TekananDarah         string                  `json:"tekanan_darah"`
	Nadi                 string                  `json:"nadi"`
	SaturasiO2           string                  `json:"saturasi_o2"`
	Pernapasan           string                  `json:"pernapasan"`
	KebutuhanKhusus      string                  `json:"kebutuhan_khusus"`
	Skala1               []PemeriksaanTriaseData `json:"skala1,omitempty"`
	Skala2               []PemeriksaanTriaseData `json:"skala2,omitempty"`
	Skala3               []PemeriksaanTriaseData `json:"skala3,omitempty"`
	Skala4               []PemeriksaanTriaseData `json:"skala4,omitempty"`
	Skala5               []PemeriksaanTriaseData `json:"skala5,omitempty"`
}

type PemeriksaanTriaseData struct {
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Details         []struct {
		PengkajianSkala string `json:"pengkajian_skala1"`
	} `json:"details"`
}

type TriaseSekunderData struct {
	// Similar structure to TriasePrimer
	KeluhanUtama string `json:"keluhan_utama"`
	Suhu         string `json:"suhu"`
	Nyeri        string `json:"nyeri"`
	TekananDarah string `json:"tekanan_darah"`
	Nadi         string `json:"nadi"`
	SaturasiO2   string `json:"saturasi_o2"`
	Pernapasan   string `json:"pernapasan"`
}

type AsuhanMedisData struct {
	Tanggal            string   `json:"tanggal"`
	Informasi          string   `json:"informasi"`
	KeluhanUtama       string   `json:"keluhan_utama"`
	RPD                string   `json:"rpd"`
	RPO                string   `json:"rpo"`
	StatusKehamilan    string   `json:"status_kehamilan"`
	Gravida            string   `json:"gravida"`
	Para               string   `json:"para"`
	Abortus            string   `json:"abortus"`
	HPHT               string   `json:"hpht"`
	Tekanan            string   `json:"tekanan"`
	Pupil              string   `json:"pupil"`
	Neurosensorik      string   `json:"neurosensorik"`
	Integumen          string   `json:"integumen"`
	Turgor             string   `json:"turgor"`
	Edema              string   `json:"edema"`
	Mukosa             string   `json:"mukosa"`
	Perdarahan         string   `json:"perdarahan"`
	JumlahPerdarahan   string   `json:"jumlah_perdarahan"`
	WarnaPerdarahan    string   `json:"warna_perdarahan"`
	Intoksikasi        string   `json:"intoksikasi"`
	BAB                string   `json:"bab"`
	XBAB               string   `json:"xbab"`
	KBAB               string   `json:"kbab"`
	WBAB               string   `json:"wbab"`
	BAK                string   `json:"bak"`
	XBAK               string   `json:"xbak"`
	WBAK               string   `json:"wbak"`
	LBAK               string   `json:"lbak"`
	Psikologis         string   `json:"psikologis"`
	Jiwa               string   `json:"jiwa"`
	Perilaku           string   `json:"perilaku"`
	Dilaporkan         string   `json:"dilaporkan"`
	Sebutkan           string   `json:"sebutkan"`
	Hubungan           string   `json:"hubungan"`
	TinggalDengan      string   `json:"tinggal_dengan"`
	KetTinggal         string   `json:"ket_tinggal"`
	Budaya             string   `json:"budaya"`
	KetBudaya          string   `json:"ket_budaya"`
	PendidikanPJ       string   `json:"pendidikan_pj"`
	KetPendidikanPJ    string   `json:"ket_pendidikan_pj"`
	Edukasi            string   `json:"edukasi"`
	KetEdukasi         string   `json:"ket_edukasi"`
	Kemampuan          string   `json:"kemampuan"`
	Aktifitas          string   `json:"aktifitas"`
	AlatBantu          string   `json:"alat_bantu"`
	KetBantu           string   `json:"ket_bantu"`
	Nyeri              string   `json:"nyeri"`
	Provokes           string   `json:"provokes"`
	KetProvokes        string   `json:"ket_provokes"`
	Quality            string   `json:"quality"`
	KetQuality         string   `json:"ket_quality"`
	Lokasi             string   `json:"lokasi"`
	Menyebar           string   `json:"menyebar"`
	SkalaNyeri         string   `json:"skala_nyeri"`
	Durasi             string   `json:"durasi"`
	NyeriHilang        string   `json:"nyeri_hilang"`
	KetNyeri           string   `json:"ket_nyeri"`
	PadaDokter         string   `json:"pada_dokter"`
	KetDokter          string   `json:"ket_dokter"`
	BerjalanA          string   `json:"berjalan_a"`
	BerjalanB          string   `json:"berjalan_b"`
	BerjalanC          string   `json:"berjalan_c"`
	Hasil              string   `json:"hasil"`
	Lapor              string   `json:"lapor"`
	KetLapor           string   `json:"ket_lapor"`
	Rencana            string   `json:"rencana"`
	NIP                string   `json:"nip"`
	NamaPetugas        string   `json:"nama_petugas"`
	MasalahKeperawatan []string `json:"masalah_keperawatan"`
	RencanaKeperawatan []string `json:"rencana_keperawatan"`
}

type SOAPData struct {
	TglPerawatan string `json:"tgl_perawatan"`
	JamRawat     string `json:"jam_rawat"`
	Subjective   string `json:"subjective"`
	Objective    string `json:"objective"`
	Assessment   string `json:"assessment"`
	Planning     string `json:"planning"`
	NamaPetugas  string `json:"nama_petugas"`
}

type TindakanData struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KodeTindakan  string  `json:"kode_tindakan"`
	NamaTindakan  string  `json:"nama_tindakan"`
	BiayaTindakan float64 `json:"biaya_tindakan"`
	NamaPetugas   string  `json:"nama_petugas"`
}

type KamarInapData struct {
	TglMasuk     string  `json:"tgl_masuk"`
	JamMasuk     string  `json:"jam_masuk"`
	TglKeluar    string  `json:"tgl_keluar"`
	JamKeluar    string  `json:"jam_keluar"`
	NamaKamar    string  `json:"nama_kamar"`
	TarifKamar   float64 `json:"tarif_kamar"`
	LamaMenginap int     `json:"lama_menginap"`
}

type RadiologiData struct {
	NoOrder         string `json:"no_order"`
	TglPermintaan   string `json:"tgl_permintaan"`
	JamPermintaan   string `json:"jam_permintaan"`
	KodePemeriksaan string `json:"kode_pemeriksaan"`
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	DokterPerujuk   string `json:"dokter_perujuk"`
	Status          string `json:"status"`
}

type HasilRadiologiData struct {
	NoOrder  string `json:"no_order"`
	TglHasil string `json:"tgl_hasil"`
	JamHasil string `json:"jam_hasil"`
	Hasil    string `json:"hasil"`
}

type GambarRadiologiData struct {
	NoOrder string `json:"no_order"`
	Photo   string `json:"photo"`
}

type LabData struct {
	NoOrder       string `json:"no_order"`
	TglPermintaan string `json:"tgl_permintaan"`
	JamPermintaan string `json:"jam_permintaan"`
	Pemeriksaan   string `json:"pemeriksaan"`
	Nilai         string `json:"nilai"`
	NilaiRujukan  string `json:"nilai_rujukan"`
	Satuan        string `json:"satuan"`
	Keterangan    string `json:"keterangan"`
}

type LabPAData struct {
	NoOrder       string `json:"no_order"`
	TglPermintaan string `json:"tgl_permintaan"`
	HasilPA       string `json:"hasil_pa"`
}

type PemberianObatData struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	JamRawat     string  `json:"jam_rawat"`
	KodeObat     string  `json:"kode_obat"`
	NamaObat     string  `json:"nama_obat"`
	Dosis        string  `json:"dosis"`
	Jumlah       float64 `json:"jumlah"`
}

type ResepPulangData struct {
	NoResep     string  `json:"no_resep"`
	TglResep    string  `json:"tgl_resep"`
	KodeObat    string  `json:"kode_obat"`
	NamaObat    string  `json:"nama_obat"`
	Jumlah      float64 `json:"jumlah"`
	AturanPakai string  `json:"aturan_pakai"`
}

type BiayaData struct {
	NamaBiaya string  `json:"nama_biaya"`
	Jumlah    float64 `json:"jumlah"`
}

// PerawatanDetail represents a single treatment visit with all details
// PasienBio represents the patient's biographical/demographic data
type PasienBio struct {
	NoRkmMedis string `json:"no_rkm_medis"`
	NmPasien   string `json:"nm_pasien"`
	Alamat     string `json:"alamat"`
	Umur       string `json:"umur"`
	JK         string `json:"jk"`
	TglLahir   string `json:"tgl_lahir"`
	NmIbu      string `json:"nm_ibu"`
	GolDarah   string `json:"gol_darah"`
	SttsNikah  string `json:"stts_nikah"`
	Agama      string `json:"agama"`
	Pnd        string `json:"pnd"`
	TglDaftar  string `json:"tgl_daftar"`
}

// RiwayatPerawatanResponse wraps patient bio data with the list of registrations
type RiwayatPerawatanResponse struct {
	Pasien  PasienBio          `json:"pasien"`
	Riwayat []PerawatanDetail  `json:"riwayat"`
}

type DiagnosaPasienData struct {
	KdPenyakit string `json:"kd_penyakit"`
	NmPenyakit string `json:"nm_penyakit"`
	Prioritas  int    `json:"prioritas"`
}

type ProsedurPasienData struct {
	Kode             string `json:"kode"`
	DeskripsiPanjang string `json:"deskripsi_panjang"`
	Prioritas        int    `json:"prioritas"`
}

type PerawatanDetail struct {
	NoRawat           string                `json:"no_rawat"`
	NoReg             string                `json:"no_reg"`
	TglRegistrasi     string                `json:"tgl_registrasi"`
	JamReg            string                `json:"jam_reg"`
	NmPoli            string                `json:"nm_poli"`
	NmDokter          string                `json:"nm_dokter"`
	PngJawab          string                `json:"png_jawab"`
	StatusLanjut      string                `json:"status_lanjut"`
	DiagnosaPasien    []DiagnosaPasienData  `json:"diagnosa_pasien,omitempty"`
	ProsedurPasien    []ProsedurPasienData  `json:"prosedur_pasien,omitempty"`
	TriasePrimer      *TriasePrimerData     `json:"triase_primer,omitempty"`
	TriaseSekunder    *TriaseSekunderData   `json:"triase_sekunder,omitempty"`
	AsuhanMedis       *AsuhanMedisData      `json:"asuhan_medis,omitempty"`
	SOAPRawatJalan    []SOAPData            `json:"soap_rawat_jalan,omitempty"`
	SOAPRanap         []SOAPData            `json:"soap_ranap,omitempty"`
	TindakanDokter    []TindakanData        `json:"tindakan_dokter,omitempty"`
	TindakanParamedis []TindakanData        `json:"tindakan_paramedis,omitempty"`
	KamarInap         []KamarInapData       `json:"kamar_inap,omitempty"`
	Radiologi         []RadiologiData       `json:"radiologi,omitempty"`
	HasilRadiologi    []HasilRadiologiData  `json:"hasil_radiologi,omitempty"`
	GambarRadiologi   []GambarRadiologiData `json:"gambar_radiologi,omitempty"`
	LabPKMB           []LabData             `json:"lab_pk_mb,omitempty"`
	LabPA             []LabPAData           `json:"lab_pa,omitempty"`
	PemberianObat     []PemberianObatData   `json:"pemberian_obat,omitempty"`
	ResepPulang       []ResepPulangData     `json:"resep_pulang,omitempty"`
	PPNObat           []BiayaData           `json:"ppn_obat,omitempty"`
	TambahanBiaya     []BiayaData           `json:"tambahan_biaya,omitempty"`
	PotonganBiaya     []BiayaData           `json:"potongan_biaya,omitempty"`
	TotalBiaya        float64               `json:"total_biaya"`
}

func getRiwayatPerawatan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRKMedis := c.Param("no_rkm_medis")

		// Get patient biographical data
		var bio PasienBio
		err := db.QueryRow(`
			SELECT
				no_rkm_medis,
				COALESCE(nm_pasien, '') as nm_pasien,
				COALESCE(alamat, '') as alamat,
				COALESCE(umur, '') as umur,
				COALESCE(jk, '') as jk,
				COALESCE(DATE_FORMAT(tgl_lahir, '%d-%m-%Y'), '') as tgl_lahir,
				COALESCE(nm_ibu, '') as nm_ibu,
				COALESCE(gol_darah, '') as gol_darah,
				COALESCE(stts_nikah, '') as stts_nikah,
				COALESCE(agama, '') as agama,
				COALESCE(pnd, '') as pnd,
				COALESCE(DATE_FORMAT(tgl_daftar, '%d-%m-%Y'), '') as tgl_daftar
			FROM pasien
			WHERE no_rkm_medis = ?
		`, noRKMedis).Scan(
			&bio.NoRkmMedis, &bio.NmPasien, &bio.Alamat, &bio.Umur, &bio.JK,
			&bio.TglLahir, &bio.NmIbu, &bio.GolDarah, &bio.SttsNikah,
			&bio.Agama, &bio.Pnd, &bio.TglDaftar,
		)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pasien tidak ditemukan"})
			return
		}

		// Get the 5 most recent no_rawat for this patient
		rows, err := db.Query(`
			SELECT
				rp.no_rawat,
				COALESCE(rp.no_reg, '') as no_reg,
				DATE_FORMAT(rp.tgl_registrasi, '%d/%m/%Y') as tgl_registrasi,
				TIME_FORMAT(rp.jam_reg, '%H:%i:%s') as jam_reg,
				COALESCE(pol.nm_poli, '') as nm_poli,
				COALESCE(dok.nm_dokter, '') as nm_dokter,
				COALESCE(pj.png_jawab, '') as png_jawab,
				COALESCE(rp.status_lanjut, '') as status_lanjut
			FROM reg_periksa rp
			LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
			LEFT JOIN dokter dok ON rp.kd_dokter = dok.kd_dokter
			LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
			WHERE rp.no_rkm_medis = ?
			ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC
			LIMIT 5
		`, noRKMedis)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var perawatanList []PerawatanDetail
		for rows.Next() {
			var perawatan PerawatanDetail
			err := rows.Scan(
				&perawatan.NoRawat,
				&perawatan.NoReg,
				&perawatan.TglRegistrasi,
				&perawatan.JamReg,
				&perawatan.NmPoli,
				&perawatan.NmDokter,
				&perawatan.PngJawab,
				&perawatan.StatusLanjut,
			)
			if err != nil {
				fmt.Println("Error scanning perawatan:", err)
				continue
			}

			// Build detailed medical history for this no_rawat
			// Get Diagnosa & Prosedur
			perawatan.DiagnosaPasien = getDiagnosaPasienData(db, perawatan.NoRawat)
			perawatan.ProsedurPasien = getProsedurPasienData(db, perawatan.NoRawat)

			// Get Triase Primer
			perawatan.TriasePrimer = getTriasePrimerData(db, perawatan.NoRawat)

			// Get Triase Sekunder
			perawatan.TriaseSekunder = getTriaseSekunderData(db, perawatan.NoRawat)

			// Get Asuhan Medis IGD
			perawatan.AsuhanMedis = getAsuhanMedisIGDData(db, perawatan.NoRawat)

			// Get SOAP Rawat Jalan
			perawatan.SOAPRawatJalan = getSOAPData(db, perawatan.NoRawat, "Ralan")

			// Get SOAP Ranap
			perawatan.SOAPRanap = getSOAPData(db, perawatan.NoRawat, "Ranap")

			// Get Radiologi
			perawatan.Radiologi = getRadiologiData(db, perawatan.NoRawat)

			// Get Lab PK/MB
			perawatan.LabPKMB = getLabData(db, perawatan.NoRawat)

			// Calculate total biaya (simplified - you may need to sum from billing tables)
			perawatan.TotalBiaya = 0

			perawatanList = append(perawatanList, perawatan)
		}

		c.JSON(http.StatusOK, RiwayatPerawatanResponse{Pasien: bio, Riwayat: perawatanList})
	}
}

// getDiagnosaPasienData fetches ICD-10 diagnoses for a given no_rawat
func getDiagnosaPasienData(db *sql.DB, noRawat string) []DiagnosaPasienData {
	rows, err := db.Query(`
		SELECT dp.kd_penyakit, COALESCE(p.nm_penyakit, ''), dp.prioritas
		FROM diagnosa_pasien dp
		LEFT JOIN penyakit p ON dp.kd_penyakit = p.kd_penyakit
		WHERE dp.no_rawat = ?
		ORDER BY dp.prioritas
	`, noRawat)
	if err != nil {
		return []DiagnosaPasienData{}
	}
	defer rows.Close()

	var list []DiagnosaPasienData
	for rows.Next() {
		var d DiagnosaPasienData
		if err := rows.Scan(&d.KdPenyakit, &d.NmPenyakit, &d.Prioritas); err != nil {
			continue
		}
		list = append(list, d)
	}
	return list
}

// getProsedurPasienData fetches ICD-9 procedures for a given no_rawat
func getProsedurPasienData(db *sql.DB, noRawat string) []ProsedurPasienData {
	rows, err := db.Query(`
		SELECT pp.kode, COALESCE(i.deskripsi_panjang, ''), pp.prioritas
		FROM prosedur_pasien pp
		LEFT JOIN icd9 i ON pp.kode = i.kode
		WHERE pp.no_rawat = ?
		ORDER BY pp.prioritas
	`, noRawat)
	if err != nil {
		return []ProsedurPasienData{}
	}
	defer rows.Close()

	var list []ProsedurPasienData
	for rows.Next() {
		var p ProsedurPasienData
		if err := rows.Scan(&p.Kode, &p.DeskripsiPanjang, &p.Prioritas); err != nil {
			continue
		}
		list = append(list, p)
	}
	return list
}

// Helper function to get SOAP data
func getSOAPData(db *sql.DB, noRawat string, statusLanjut string) []SOAPData {
	query := `
		SELECT
			DATE_FORMAT(tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			jam_rawat,
			COALESCE(keluhan, '') as subjective,
			COALESCE(pemeriksaan, '') as objective,
			COALESCE(penilaian, '') as assessment,
			COALESCE(rtl, '') as planning,
			COALESCE(nip, '') as nip
		FROM pemeriksaan_ralan
		WHERE no_rawat = ?
		ORDER BY tgl_perawatan DESC, jam_rawat DESC
	`

	if statusLanjut == "Ranap" {
		query = `
			SELECT
				DATE_FORMAT(tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
				jam_rawat,
				COALESCE(keluhan, '') as subjective,
				COALESCE(pemeriksaan, '') as objective,
				COALESCE(penilaian, '') as assessment,
				COALESCE(rtl, '') as planning,
				COALESCE(nip, '') as nip
			FROM pemeriksaan_ranap
			WHERE no_rawat = ?
			ORDER BY tgl_perawatan DESC, jam_rawat DESC
		`
	}

	rows, err := db.Query(query, noRawat)
	if err != nil {
		return []SOAPData{}
	}
	defer rows.Close()

	var soapList []SOAPData
	for rows.Next() {
		var soap SOAPData
		var nip string
		err := rows.Scan(
			&soap.TglPerawatan,
			&soap.JamRawat,
			&soap.Subjective,
			&soap.Objective,
			&soap.Assessment,
			&soap.Planning,
			&nip,
		)
		if err != nil {
			continue
		}

		// Get petugas name from NIP
		soap.NamaPetugas = getPetugasName(db, nip)
		soapList = append(soapList, soap)
	}

	return soapList
}

// Helper function to get petugas name
func getPetugasName(db *sql.DB, nip string) string {
	var nama string
	// Try pegawai table first
	err := db.QueryRow("SELECT nama FROM pegawai WHERE nik = ?", nip).Scan(&nama)
	if err == nil {
		return nama
	}

	// Try dokter table
	err = db.QueryRow("SELECT nm_dokter FROM dokter WHERE kd_dokter = ?", nip).Scan(&nama)
	if err == nil {
		return nama
	}

	return nip
}

// Helper function to get radiologi data
func getRadiologiData(db *sql.DB, noRawat string) []RadiologiData {
	query := `
		SELECT
			pr.noorder as no_order,
			DATE_FORMAT(pr.tgl_periksa, '%d/%m/%Y') as tgl_permintaan,
			pr.jam as jam_permintaan,
			pr.kd_jenis_prw as kode_pemeriksaan,
			COALESCE(jr.nm_perawatan, '') as nama_pemeriksaan,
			COALESCE(d.nm_dokter, '') as dokter_perujuk,
			COALESCE(pr.stts, 'Belum') as status
		FROM permintaan_radiologi pr
		LEFT JOIN jns_perawatan_radiologi jr ON pr.kd_jenis_prw = jr.kd_jenis_prw
		LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
		WHERE pr.no_rawat = ?
		ORDER BY pr.tgl_periksa DESC, pr.jam DESC
	`

	rows, err := db.Query(query, noRawat)
	if err != nil {
		fmt.Println("Error getting radiologi:", err)
		return []RadiologiData{}
	}
	defer rows.Close()

	var radList []RadiologiData
	for rows.Next() {
		var rad RadiologiData
		err := rows.Scan(
			&rad.NoOrder,
			&rad.TglPermintaan,
			&rad.JamPermintaan,
			&rad.KodePemeriksaan,
			&rad.NamaPemeriksaan,
			&rad.DokterPerujuk,
			&rad.Status,
		)
		if err != nil {
			continue
		}
		radList = append(radList, rad)
	}

	return radList
}

// Helper function to get lab data
func getLabData(db *sql.DB, noRawat string) []LabData {
	query := `
		SELECT
			pl.noorder as no_order,
			DATE_FORMAT(pl.tgl_periksa, '%d/%m/%Y') as tgl_permintaan,
			pl.jam as jam_permintaan,
			COALESCE(pt.Pemeriksaan, '') as pemeriksaan,
			COALESCE(pd.nilai, '') as nilai,
			COALESCE(pt.nilai_rujukan_ld, '') as nilai_rujukan,
			COALESCE(pt.satuan, '') as satuan,
			COALESCE(pd.keterangan, '') as keterangan
		FROM permintaan_lab pl
		LEFT JOIN periksa_lab pd ON pl.noorder = pd.noorder
		LEFT JOIN template_laboratorium pt ON pd.id_template = pt.id_template
		WHERE pl.no_rawat = ?
		ORDER BY pl.tgl_periksa DESC, pl.jam DESC
	`

	rows, err := db.Query(query, noRawat)
	if err != nil {
		fmt.Println("Error getting lab:", err)
		return []LabData{}
	}
	defer rows.Close()

	var labList []LabData
	for rows.Next() {
		var lab LabData
		err := rows.Scan(
			&lab.NoOrder,
			&lab.TglPermintaan,
			&lab.JamPermintaan,
			&lab.Pemeriksaan,
			&lab.Nilai,
			&lab.NilaiRujukan,
			&lab.Satuan,
			&lab.Keterangan,
		)
		if err != nil {
			continue
		}
		labList = append(labList, lab)
	}

	return labList
}

// Helper function to get Triase Primer data
func getTriasePrimerData(db *sql.DB, noRawat string) *TriasePrimerData {
	query := `
		SELECT
			COALESCE(data_triase_igdprimer.keluhan_utama, '') as keluhan_utama,
			COALESCE(data_triase_igdprimer.kebutuhan_khusus, '') as kebutuhan_khusus,
			COALESCE(data_triase_igd.tekanan_darah, '') as tekanan_darah,
			COALESCE(data_triase_igd.nadi, '') as nadi,
			COALESCE(data_triase_igd.pernapasan, '') as pernapasan,
			COALESCE(data_triase_igd.suhu, '') as suhu,
			COALESCE(data_triase_igd.saturasi_o2, '') as saturasi_o2,
			COALESCE(data_triase_igd.nyeri, '') as nyeri,
			COALESCE(data_triase_igd.cara_masuk, '') as cara_masuk,
			COALESCE(data_triase_igd.alat_transportasi, '') as alat_transportasi,
			COALESCE(data_triase_igd.alasan_kedatangan, '') as alasan_kedatangan,
			COALESCE(data_triase_igd.keterangan_kedatangan, '') as keterangan_kedatangan,
			COALESCE(master_triase_macam_kasus.macam_kasus, '') as macam_kasus
		FROM data_triase_igdprimer
		INNER JOIN data_triase_igd ON data_triase_igd.no_rawat = data_triase_igdprimer.no_rawat
		INNER JOIN master_triase_macam_kasus ON data_triase_igd.kode_kasus = master_triase_macam_kasus.kode_kasus
		WHERE data_triase_igd.no_rawat = ?
	`

	var triase TriasePrimerData
	err := db.QueryRow(query, noRawat).Scan(
		&triase.KeluhanUtama,
		&triase.KebutuhanKhusus,
		&triase.TekananDarah,
		&triase.Nadi,
		&triase.Pernapasan,
		&triase.Suhu,
		&triase.SaturasiO2,
		&triase.Nyeri,
		&triase.CaraMasuk,
		&triase.AlatTransportasi,
		&triase.AlasanKedatangan,
		&triase.KeteranganKedatangan,
		&triase.MacamKasus,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil // No triase primer data
		}
		fmt.Println("Error getting triase primer:", err)
		return nil
	}

	// Get skala data
	triase.Skala1 = getTriaseSkalaData(db, noRawat, 1)
	triase.Skala2 = getTriaseSkalaData(db, noRawat, 2)
	triase.Skala3 = getTriaseSkalaData(db, noRawat, 3)
	triase.Skala4 = getTriaseSkalaData(db, noRawat, 4)
	triase.Skala5 = getTriaseSkalaData(db, noRawat, 5)

	return &triase
}

// Helper function to get Triase Sekunder data
func getTriaseSekunderData(db *sql.DB, noRawat string) *TriaseSekunderData {
	query := `
		SELECT
			COALESCE(data_triase_igdsekunder.anamnesa_singkat, '') as keluhan_utama,
			COALESCE(data_triase_igd.tekanan_darah, '') as tekanan_darah,
			COALESCE(data_triase_igd.nadi, '') as nadi,
			COALESCE(data_triase_igd.pernapasan, '') as pernapasan,
			COALESCE(data_triase_igd.suhu, '') as suhu,
			COALESCE(data_triase_igd.saturasi_o2, '') as saturasi_o2,
			COALESCE(data_triase_igd.nyeri, '') as nyeri
		FROM data_triase_igdsekunder
		INNER JOIN data_triase_igd ON data_triase_igd.no_rawat = data_triase_igdsekunder.no_rawat
		WHERE data_triase_igd.no_rawat = ?
	`

	var triase TriaseSekunderData
	err := db.QueryRow(query, noRawat).Scan(
		&triase.KeluhanUtama,
		&triase.TekananDarah,
		&triase.Nadi,
		&triase.Pernapasan,
		&triase.Suhu,
		&triase.SaturasiO2,
		&triase.Nyeri,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil // No triase sekunder data
		}
		fmt.Println("Error getting triase sekunder:", err)
		return nil
	}

	return &triase
}

// Helper function to get Triase Skala data (1-5)
func getTriaseSkalaData(db *sql.DB, noRawat string, skala int) []PemeriksaanTriaseData {
	tableName := fmt.Sprintf("data_triase_igddetail_skala%d", skala)
	masterTableName := fmt.Sprintf("master_triase_skala%d", skala)
	skalaField := fmt.Sprintf("kode_skala%d", skala)
	pengkajianField := fmt.Sprintf("pengkajian_skala%d", skala)

	query := fmt.Sprintf(`
		SELECT
			master_triase_pemeriksaan.kode_pemeriksaan,
			master_triase_pemeriksaan.nama_pemeriksaan
		FROM master_triase_pemeriksaan
		INNER JOIN %s ON master_triase_pemeriksaan.kode_pemeriksaan = %s.kode_pemeriksaan
		INNER JOIN %s ON %s.%s = %s.%s
		WHERE %s.no_rawat = ?
		GROUP BY master_triase_pemeriksaan.kode_pemeriksaan
		ORDER BY master_triase_pemeriksaan.kode_pemeriksaan
	`, masterTableName, masterTableName, tableName, masterTableName, skalaField, tableName, skalaField, tableName)

	rows, err := db.Query(query, noRawat)
	if err != nil {
		return []PemeriksaanTriaseData{}
	}
	defer rows.Close()

	var pemeriksaanList []PemeriksaanTriaseData
	for rows.Next() {
		var pemeriksaan PemeriksaanTriaseData
		var kodePemeriksaan string

		err := rows.Scan(&kodePemeriksaan, &pemeriksaan.NamaPemeriksaan)
		if err != nil {
			continue
		}

		// Get detail pengkajian for this pemeriksaan
		detailQuery := fmt.Sprintf(`
			SELECT %s.%s
			FROM %s
			INNER JOIN %s ON %s.%s = %s.%s
			WHERE %s.kode_pemeriksaan = ? AND %s.no_rawat = ?
			ORDER BY %s.%s
		`, masterTableName, pengkajianField, masterTableName, tableName,
			masterTableName, skalaField, tableName, skalaField,
			masterTableName, tableName, tableName, skalaField)

		detailRows, err := db.Query(detailQuery, kodePemeriksaan, noRawat)
		if err == nil {
			defer detailRows.Close()
			for detailRows.Next() {
				var pengkajian string
				if err := detailRows.Scan(&pengkajian); err == nil {
					detail := struct {
						PengkajianSkala string `json:"pengkajian_skala1"`
					}{
						PengkajianSkala: pengkajian,
					}
					pemeriksaan.Details = append(pemeriksaan.Details, detail)
				}
			}
		}

		pemeriksaanList = append(pemeriksaanList, pemeriksaan)
	}

	return pemeriksaanList
}

// Helper function to get Asuhan Medis IGD data
func getAsuhanMedisIGDData(db *sql.DB, noRawat string) *AsuhanMedisData {
	query := `
		SELECT
			COALESCE(DATE_FORMAT(penilaian_awal_keperawatan_igd.tanggal, '%d/%m/%Y %H:%i:%s'), '') as tanggal,
			COALESCE(penilaian_awal_keperawatan_igd.informasi, '') as informasi,
			COALESCE(penilaian_awal_keperawatan_igd.keluhan_utama, '') as keluhan_utama,
			COALESCE(penilaian_awal_keperawatan_igd.rpd, '') as rpd,
			COALESCE(penilaian_awal_keperawatan_igd.rpo, '') as rpo,
			COALESCE(penilaian_awal_keperawatan_igd.status_kehamilan, '') as status_kehamilan,
			COALESCE(penilaian_awal_keperawatan_igd.gravida, '') as gravida,
			COALESCE(penilaian_awal_keperawatan_igd.para, '') as para,
			COALESCE(penilaian_awal_keperawatan_igd.abortus, '') as abortus,
			COALESCE(penilaian_awal_keperawatan_igd.hpht, '') as hpht,
			COALESCE(penilaian_awal_keperawatan_igd.tekanan, '') as tekanan,
			COALESCE(penilaian_awal_keperawatan_igd.pupil, '') as pupil,
			COALESCE(penilaian_awal_keperawatan_igd.neurosensorik, '') as neurosensorik,
			COALESCE(penilaian_awal_keperawatan_igd.integumen, '') as integumen,
			COALESCE(penilaian_awal_keperawatan_igd.turgor, '') as turgor,
			COALESCE(penilaian_awal_keperawatan_igd.edema, '') as edema,
			COALESCE(penilaian_awal_keperawatan_igd.mukosa, '') as mukosa,
			COALESCE(penilaian_awal_keperawatan_igd.perdarahan, '') as perdarahan,
			COALESCE(penilaian_awal_keperawatan_igd.jumlah_perdarahan, '') as jumlah_perdarahan,
			COALESCE(penilaian_awal_keperawatan_igd.warna_perdarahan, '') as warna_perdarahan,
			COALESCE(penilaian_awal_keperawatan_igd.intoksikasi, '') as intoksikasi,
			COALESCE(penilaian_awal_keperawatan_igd.bab, '') as bab,
			COALESCE(penilaian_awal_keperawatan_igd.xbab, '') as xbab,
			COALESCE(penilaian_awal_keperawatan_igd.kbab, '') as kbab,
			COALESCE(penilaian_awal_keperawatan_igd.wbab, '') as wbab,
			COALESCE(penilaian_awal_keperawatan_igd.bak, '') as bak,
			COALESCE(penilaian_awal_keperawatan_igd.xbak, '') as xbak,
			COALESCE(penilaian_awal_keperawatan_igd.wbak, '') as wbak,
			COALESCE(penilaian_awal_keperawatan_igd.lbak, '') as lbak,
			COALESCE(penilaian_awal_keperawatan_igd.psikologis, '') as psikologis,
			COALESCE(penilaian_awal_keperawatan_igd.jiwa, '') as jiwa,
			COALESCE(penilaian_awal_keperawatan_igd.perilaku, '') as perilaku,
			COALESCE(penilaian_awal_keperawatan_igd.dilaporkan, '') as dilaporkan,
			COALESCE(penilaian_awal_keperawatan_igd.sebutkan, '') as sebutkan,
			COALESCE(penilaian_awal_keperawatan_igd.hubungan, '') as hubungan,
			COALESCE(penilaian_awal_keperawatan_igd.tinggal_dengan, '') as tinggal_dengan,
			COALESCE(penilaian_awal_keperawatan_igd.ket_tinggal, '') as ket_tinggal,
			COALESCE(penilaian_awal_keperawatan_igd.budaya, '') as budaya,
			COALESCE(penilaian_awal_keperawatan_igd.ket_budaya, '') as ket_budaya,
			COALESCE(penilaian_awal_keperawatan_igd.pendidikan_pj, '') as pendidikan_pj,
			COALESCE(penilaian_awal_keperawatan_igd.ket_pendidikan_pj, '') as ket_pendidikan_pj,
			COALESCE(penilaian_awal_keperawatan_igd.edukasi, '') as edukasi,
			COALESCE(penilaian_awal_keperawatan_igd.ket_edukasi, '') as ket_edukasi,
			COALESCE(penilaian_awal_keperawatan_igd.kemampuan, '') as kemampuan,
			COALESCE(penilaian_awal_keperawatan_igd.aktifitas, '') as aktifitas,
			COALESCE(penilaian_awal_keperawatan_igd.alat_bantu, '') as alat_bantu,
			COALESCE(penilaian_awal_keperawatan_igd.ket_bantu, '') as ket_bantu,
			COALESCE(penilaian_awal_keperawatan_igd.nyeri, '') as nyeri,
			COALESCE(penilaian_awal_keperawatan_igd.provokes, '') as provokes,
			COALESCE(penilaian_awal_keperawatan_igd.ket_provokes, '') as ket_provokes,
			COALESCE(penilaian_awal_keperawatan_igd.quality, '') as quality,
			COALESCE(penilaian_awal_keperawatan_igd.ket_quality, '') as ket_quality,
			COALESCE(penilaian_awal_keperawatan_igd.lokasi, '') as lokasi,
			COALESCE(penilaian_awal_keperawatan_igd.menyebar, '') as menyebar,
			COALESCE(penilaian_awal_keperawatan_igd.skala_nyeri, '') as skala_nyeri,
			COALESCE(penilaian_awal_keperawatan_igd.durasi, '') as durasi,
			COALESCE(penilaian_awal_keperawatan_igd.nyeri_hilang, '') as nyeri_hilang,
			COALESCE(penilaian_awal_keperawatan_igd.ket_nyeri, '') as ket_nyeri,
			COALESCE(penilaian_awal_keperawatan_igd.pada_dokter, '') as pada_dokter,
			COALESCE(penilaian_awal_keperawatan_igd.ket_dokter, '') as ket_dokter,
			COALESCE(penilaian_awal_keperawatan_igd.berjalan_a, '') as berjalan_a,
			COALESCE(penilaian_awal_keperawatan_igd.berjalan_b, '') as berjalan_b,
			COALESCE(penilaian_awal_keperawatan_igd.berjalan_c, '') as berjalan_c,
			COALESCE(penilaian_awal_keperawatan_igd.hasil, '') as hasil,
			COALESCE(penilaian_awal_keperawatan_igd.lapor, '') as lapor,
			COALESCE(penilaian_awal_keperawatan_igd.ket_lapor, '') as ket_lapor,
			COALESCE(penilaian_awal_keperawatan_igd.rencana, '') as rencana,
			COALESCE(penilaian_awal_keperawatan_igd.nip, '') as nip,
			COALESCE(petugas.nama, '') as nama
		FROM penilaian_awal_keperawatan_igd
		INNER JOIN petugas ON penilaian_awal_keperawatan_igd.nip = petugas.nip
		WHERE penilaian_awal_keperawatan_igd.no_rawat = ?
	`

	var asuhan AsuhanMedisData
	err := db.QueryRow(query, noRawat).Scan(
		&asuhan.Tanggal, &asuhan.Informasi, &asuhan.KeluhanUtama, &asuhan.RPD, &asuhan.RPO,
		&asuhan.StatusKehamilan, &asuhan.Gravida, &asuhan.Para, &asuhan.Abortus, &asuhan.HPHT,
		&asuhan.Tekanan, &asuhan.Pupil, &asuhan.Neurosensorik, &asuhan.Integumen, &asuhan.Turgor,
		&asuhan.Edema, &asuhan.Mukosa, &asuhan.Perdarahan, &asuhan.JumlahPerdarahan, &asuhan.WarnaPerdarahan,
		&asuhan.Intoksikasi, &asuhan.BAB, &asuhan.XBAB, &asuhan.KBAB, &asuhan.WBAB,
		&asuhan.BAK, &asuhan.XBAK, &asuhan.WBAK, &asuhan.LBAK,
		&asuhan.Psikologis, &asuhan.Jiwa, &asuhan.Perilaku, &asuhan.Dilaporkan, &asuhan.Sebutkan,
		&asuhan.Hubungan, &asuhan.TinggalDengan, &asuhan.KetTinggal, &asuhan.Budaya, &asuhan.KetBudaya,
		&asuhan.PendidikanPJ, &asuhan.KetPendidikanPJ, &asuhan.Edukasi, &asuhan.KetEdukasi,
		&asuhan.Kemampuan, &asuhan.Aktifitas, &asuhan.AlatBantu, &asuhan.KetBantu,
		&asuhan.Nyeri, &asuhan.Provokes, &asuhan.KetProvokes, &asuhan.Quality, &asuhan.KetQuality,
		&asuhan.Lokasi, &asuhan.Menyebar, &asuhan.SkalaNyeri, &asuhan.Durasi,
		&asuhan.NyeriHilang, &asuhan.KetNyeri, &asuhan.PadaDokter, &asuhan.KetDokter,
		&asuhan.BerjalanA, &asuhan.BerjalanB, &asuhan.BerjalanC, &asuhan.Hasil,
		&asuhan.Lapor, &asuhan.KetLapor, &asuhan.Rencana, &asuhan.NIP, &asuhan.NamaPetugas,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil // No asuhan medis IGD data
		}
		fmt.Println("Error getting asuhan medis IGD:", err)
		return nil
	}

	// Get masalah keperawatan
	masalahRows, err := db.Query(`
		SELECT master_masalah_keperawatan_igd.nama_masalah
		FROM master_masalah_keperawatan_igd
		INNER JOIN penilaian_awal_keperawatan_igd_masalah
			ON penilaian_awal_keperawatan_igd_masalah.kode_masalah = master_masalah_keperawatan_igd.kode_masalah
		WHERE penilaian_awal_keperawatan_igd_masalah.no_rawat = ?
		ORDER BY penilaian_awal_keperawatan_igd_masalah.kode_masalah
	`, noRawat)

	if err == nil {
		defer masalahRows.Close()
		for masalahRows.Next() {
			var masalah string
			if err := masalahRows.Scan(&masalah); err == nil {
				asuhan.MasalahKeperawatan = append(asuhan.MasalahKeperawatan, masalah)
			}
		}
	}

	// Get rencana keperawatan
	rencanaRows, err := db.Query(`
		SELECT master_rencana_keperawatan_igd.rencana_keperawatan
		FROM master_rencana_keperawatan_igd
		INNER JOIN penilaian_awal_keperawatan_ralan_rencana_igd
			ON penilaian_awal_keperawatan_ralan_rencana_igd.kode_rencana = master_rencana_keperawatan_igd.kode_rencana
		WHERE penilaian_awal_keperawatan_ralan_rencana_igd.no_rawat = ?
		ORDER BY penilaian_awal_keperawatan_ralan_rencana_igd.kode_rencana
	`, noRawat)

	if err == nil {
		defer rencanaRows.Close()
		for rencanaRows.Next() {
			var rencana string
			if err := rencanaRows.Scan(&rencana); err == nil {
				asuhan.RencanaKeperawatan = append(asuhan.RencanaKeperawatan, rencana)
			}
		}
	}

	return &asuhan
}

// ============================================================================
// TRIASE IGD ENDPOINT
// ============================================================================

// TriaseIGDResponse represents the complete triase IGD data
type TriaseIGDResponse struct {
	TriasePrimer   *TriaseIGDPrimerDetail   `json:"triase_primer,omitempty"`
	TriaseSekunder *TriaseIGDSekunderDetail `json:"triase_sekunder,omitempty"`
}

type TriaseIGDPrimerDetail struct {
	CaraMasuk            string                    `json:"cara_masuk"`
	AlatTransportasi     string                    `json:"alat_transportasi"`
	AlasanKedatangan     string                    `json:"alasan_kedatangan"`
	KeteranganKedatangan string                    `json:"keterangan_kedatangan"`
	MacamKasus           string                    `json:"macam_kasus"`
	KeluhanUtama         string                    `json:"keluhan_utama"`
	Suhu                 string                    `json:"suhu"`
	Nyeri                string                    `json:"nyeri"`
	TekananDarah         string                    `json:"tekanan_darah"`
	Nadi                 string                    `json:"nadi"`
	SaturasiO2           string                    `json:"saturasi_o2"`
	Pernapasan           string                    `json:"pernapasan"`
	KebutuhanKhusus      string                    `json:"kebutuhan_khusus"`
	Skala1               []PemeriksaanTriaseDetail `json:"skala1,omitempty"`
	Skala2               []PemeriksaanTriaseDetail `json:"skala2,omitempty"`
	Plan                 string                    `json:"plan"`
	TanggalTriase        string                    `json:"tanggaltriase"`
	Catatan              string                    `json:"catatan"`
	NIK                  string                    `json:"nik"`
	Nama                 string                    `json:"nama"`
}

type TriaseIGDSekunderDetail struct {
	CaraMasuk            string                    `json:"cara_masuk"`
	AlatTransportasi     string                    `json:"alat_transportasi"`
	AlasanKedatangan     string                    `json:"alasan_kedatangan"`
	KeteranganKedatangan string                    `json:"keterangan_kedatangan"`
	MacamKasus           string                    `json:"macam_kasus"`
	AnamesaSingkat       string                    `json:"anamnesa_singkat"`
	Suhu                 string                    `json:"suhu"`
	Nyeri                string                    `json:"nyeri"`
	TekananDarah         string                    `json:"tekanan_darah"`
	Nadi                 string                    `json:"nadi"`
	SaturasiO2           string                    `json:"saturasi_o2"`
	Pernapasan           string                    `json:"pernapasan"`
	Skala3               []PemeriksaanTriaseDetail `json:"skala3,omitempty"`
	Skala4               []PemeriksaanTriaseDetail `json:"skala4,omitempty"`
	Skala5               []PemeriksaanTriaseDetail `json:"skala5,omitempty"`
	Plan                 string                    `json:"plan"`
	TanggalTriase        string                    `json:"tanggaltriase"`
	Catatan              string                    `json:"catatan"`
	NIK                  string                    `json:"nik"`
	Nama                 string                    `json:"nama"`
}

type PemeriksaanTriaseDetail struct {
	NamaPemeriksaan string                       `json:"nama_pemeriksaan"`
	Details         []PemeriksaanTriaseDetailRow `json:"details"`
}

type PemeriksaanTriaseDetailRow struct {
	PengkajianSkala1 string `json:"pengkajian_skala1,omitempty"`
	PengkajianSkala2 string `json:"pengkajian_skala2,omitempty"`
	PengkajianSkala3 string `json:"pengkajian_skala3,omitempty"`
	PengkajianSkala4 string `json:"pengkajian_skala4,omitempty"`
	PengkajianSkala5 string `json:"pengkajian_skala5,omitempty"`
}

// getTriaseIGD returns triase IGD data for a given no_rawat
func getTriaseIGD(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := TriaseIGDResponse{}

		// Get Triase Primer
		response.TriasePrimer = getTriaseIGDPrimerDetail(db, noRawat)

		// Get Triase Sekunder
		response.TriaseSekunder = getTriaseIGDSekunderDetail(db, noRawat)

		// Return data even if both are nil (empty response)
		c.JSON(http.StatusOK, response)
	}
}

// getTriaseIGDPrimerDetail gets detailed triase primer data including all skala
func getTriaseIGDPrimerDetail(db *sql.DB, noRawat string) *TriaseIGDPrimerDetail {
	query := `
		SELECT
			COALESCE(data_triase_igd.cara_masuk, '') as cara_masuk,
			COALESCE(data_triase_igd.alat_transportasi, '') as alat_transportasi,
			COALESCE(data_triase_igd.alasan_kedatangan, '') as alasan_kedatangan,
			COALESCE(data_triase_igd.keterangan_kedatangan, '') as keterangan_kedatangan,
			COALESCE(master_triase_macam_kasus.macam_kasus, '') as macam_kasus,
			COALESCE(data_triase_igdprimer.keluhan_utama, '') as keluhan_utama,
			COALESCE(data_triase_igd.suhu, '') as suhu,
			COALESCE(data_triase_igd.nyeri, '') as nyeri,
			COALESCE(data_triase_igd.tekanan_darah, '') as tekanan_darah,
			COALESCE(data_triase_igd.nadi, '') as nadi,
			COALESCE(data_triase_igd.saturasi_o2, '') as saturasi_o2,
			COALESCE(data_triase_igd.pernapasan, '') as pernapasan,
			COALESCE(data_triase_igdprimer.kebutuhan_khusus, '') as kebutuhan_khusus,
			COALESCE(data_triase_igdprimer.plan, '') as plan,
			COALESCE(data_triase_igdprimer.tanggaltriase, '') as tanggaltriase,
			COALESCE(data_triase_igdprimer.catatan, '') as catatan,
			COALESCE(data_triase_igdprimer.nik, '') as nik,
			COALESCE(pegawai.nama, '') as nama
		FROM data_triase_igdprimer
		INNER JOIN data_triase_igd ON data_triase_igd.no_rawat = data_triase_igdprimer.no_rawat
		INNER JOIN master_triase_macam_kasus ON data_triase_igd.kode_kasus = master_triase_macam_kasus.kode_kasus
		INNER JOIN pegawai ON data_triase_igdprimer.nik = pegawai.nik
		WHERE data_triase_igd.no_rawat = ?
	`

	var triase TriaseIGDPrimerDetail
	err := db.QueryRow(query, noRawat).Scan(
		&triase.CaraMasuk,
		&triase.AlatTransportasi,
		&triase.AlasanKedatangan,
		&triase.KeteranganKedatangan,
		&triase.MacamKasus,
		&triase.KeluhanUtama,
		&triase.Suhu,
		&triase.Nyeri,
		&triase.TekananDarah,
		&triase.Nadi,
		&triase.SaturasiO2,
		&triase.Pernapasan,
		&triase.KebutuhanKhusus,
		&triase.Plan,
		&triase.TanggalTriase,
		&triase.Catatan,
		&triase.NIK,
		&triase.Nama,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		fmt.Println("Error getting triase primer detail:", err)
		return nil
	}

	// Get skala 1 and 2
	triase.Skala1 = getTriaseSkalaDetail(db, noRawat, 1)
	triase.Skala2 = getTriaseSkalaDetail(db, noRawat, 2)

	return &triase
}

// getTriaseIGDSekunderDetail gets detailed triase sekunder data including all skala
func getTriaseIGDSekunderDetail(db *sql.DB, noRawat string) *TriaseIGDSekunderDetail {
	query := `
		SELECT
			COALESCE(data_triase_igd.cara_masuk, '') as cara_masuk,
			COALESCE(data_triase_igd.alat_transportasi, '') as alat_transportasi,
			COALESCE(data_triase_igd.alasan_kedatangan, '') as alasan_kedatangan,
			COALESCE(data_triase_igd.keterangan_kedatangan, '') as keterangan_kedatangan,
			COALESCE(master_triase_macam_kasus.macam_kasus, '') as macam_kasus,
			COALESCE(data_triase_igdsekunder.anamnesa_singkat, '') as anamnesa_singkat,
			COALESCE(data_triase_igd.suhu, '') as suhu,
			COALESCE(data_triase_igd.nyeri, '') as nyeri,
			COALESCE(data_triase_igd.tekanan_darah, '') as tekanan_darah,
			COALESCE(data_triase_igd.nadi, '') as nadi,
			COALESCE(data_triase_igd.saturasi_o2, '') as saturasi_o2,
			COALESCE(data_triase_igd.pernapasan, '') as pernapasan,
			COALESCE(data_triase_igdsekunder.plan, '') as plan,
			COALESCE(data_triase_igdsekunder.tanggaltriase, '') as tanggaltriase,
			COALESCE(data_triase_igdsekunder.catatan, '') as catatan,
			COALESCE(data_triase_igdsekunder.nik, '') as nik,
			COALESCE(pegawai.nama, '') as nama
		FROM data_triase_igdsekunder
		INNER JOIN data_triase_igd ON data_triase_igd.no_rawat = data_triase_igdsekunder.no_rawat
		INNER JOIN master_triase_macam_kasus ON data_triase_igd.kode_kasus = master_triase_macam_kasus.kode_kasus
		INNER JOIN pegawai ON data_triase_igdsekunder.nik = pegawai.nik
		WHERE data_triase_igd.no_rawat = ?
	`

	var triase TriaseIGDSekunderDetail
	err := db.QueryRow(query, noRawat).Scan(
		&triase.CaraMasuk,
		&triase.AlatTransportasi,
		&triase.AlasanKedatangan,
		&triase.KeteranganKedatangan,
		&triase.MacamKasus,
		&triase.AnamesaSingkat,
		&triase.Suhu,
		&triase.Nyeri,
		&triase.TekananDarah,
		&triase.Nadi,
		&triase.SaturasiO2,
		&triase.Pernapasan,
		&triase.Plan,
		&triase.TanggalTriase,
		&triase.Catatan,
		&triase.NIK,
		&triase.Nama,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		fmt.Println("Error getting triase sekunder detail:", err)
		return nil
	}

	// Get skala 3, 4, and 5
	triase.Skala3 = getTriaseSkalaDetail(db, noRawat, 3)
	triase.Skala4 = getTriaseSkalaDetail(db, noRawat, 4)
	triase.Skala5 = getTriaseSkalaDetail(db, noRawat, 5)

	return &triase
}

// getTriaseSkalaDetail gets pemeriksaan and details for a specific skala (1-5)
func getTriaseSkalaDetail(db *sql.DB, noRawat string, skala int) []PemeriksaanTriaseDetail {
	tableName := fmt.Sprintf("data_triase_igddetail_skala%d", skala)
	masterTableName := fmt.Sprintf("master_triase_skala%d", skala)
	skalaField := fmt.Sprintf("kode_skala%d", skala)
	pengkajianField := fmt.Sprintf("pengkajian_skala%d", skala)

	// Query to get unique pemeriksaan for this skala
	query := fmt.Sprintf(`
		SELECT
			master_triase_pemeriksaan.kode_pemeriksaan,
			master_triase_pemeriksaan.nama_pemeriksaan
		FROM master_triase_pemeriksaan
		INNER JOIN %s ON master_triase_pemeriksaan.kode_pemeriksaan = %s.kode_pemeriksaan
		INNER JOIN %s ON %s.%s = %s.%s
		WHERE %s.no_rawat = ?
		GROUP BY master_triase_pemeriksaan.kode_pemeriksaan
		ORDER BY master_triase_pemeriksaan.kode_pemeriksaan
	`, masterTableName, masterTableName, tableName, masterTableName, skalaField, tableName, skalaField, tableName)

	rows, err := db.Query(query, noRawat)
	if err != nil {
		return []PemeriksaanTriaseDetail{}
	}
	defer rows.Close()

	var pemeriksaanList []PemeriksaanTriaseDetail
	for rows.Next() {
		var pemeriksaan PemeriksaanTriaseDetail
		var kodePemeriksaan string

		err := rows.Scan(&kodePemeriksaan, &pemeriksaan.NamaPemeriksaan)
		if err != nil {
			continue
		}

		// Get detail pengkajian for this pemeriksaan
		detailQuery := fmt.Sprintf(`
			SELECT %s.%s
			FROM %s
			INNER JOIN %s ON %s.%s = %s.%s
			WHERE %s.kode_pemeriksaan = ? AND %s.no_rawat = ?
			ORDER BY %s.%s
		`, masterTableName, pengkajianField, masterTableName, tableName,
			masterTableName, skalaField, tableName, skalaField,
			masterTableName, tableName, tableName, skalaField)

		detailRows, err := db.Query(detailQuery, kodePemeriksaan, noRawat)
		if err == nil {
			defer detailRows.Close()
			for detailRows.Next() {
				var pengkajian string
				if err := detailRows.Scan(&pengkajian); err == nil {
					detail := PemeriksaanTriaseDetailRow{}
					switch skala {
					case 1:
						detail.PengkajianSkala1 = pengkajian
					case 2:
						detail.PengkajianSkala2 = pengkajian
					case 3:
						detail.PengkajianSkala3 = pengkajian
					case 4:
						detail.PengkajianSkala4 = pengkajian
					case 5:
						detail.PengkajianSkala5 = pengkajian
					}
					pemeriksaan.Details = append(pemeriksaan.Details, detail)
				}
			}
		}

		pemeriksaanList = append(pemeriksaanList, pemeriksaan)
	}

	return pemeriksaanList
}
