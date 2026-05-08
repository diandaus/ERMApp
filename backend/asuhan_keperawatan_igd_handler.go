package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// ASUHAN KEPERAWATAN IGD ENDPOINT
// ============================================================================

// AsuhanKeperawatanIGDDetail represents detailed asuhan keperawatan IGD data
type AsuhanKeperawatanIGDDetail struct {
	Tanggal           string   `json:"tanggal"`
	Informasi         string   `json:"informasi"`
	KeluhanUtama      string   `json:"keluhan_utama"`
	RPD               string   `json:"rpd"`
	RPO               string   `json:"rpo"`
	StatusKehamilan   string   `json:"status_kehamilan"`
	Gravida           string   `json:"gravida"`
	Para              string   `json:"para"`
	Abortus           string   `json:"abortus"`
	HPHT              string   `json:"hpht"`
	Tekanan           string   `json:"tekanan"`
	Pupil             string   `json:"pupil"`
	Neurosensorik     string   `json:"neurosensorik"`
	Integumen         string   `json:"integumen"`
	Turgor            string   `json:"turgor"`
	Edema             string   `json:"edema"`
	Mukosa            string   `json:"mukosa"`
	Perdarahan        string   `json:"perdarahan"`
	JumlahPerdarahan  string   `json:"jumlah_perdarahan"`
	WarnaPerdarahan   string   `json:"warna_perdarahan"`
	Intoksikasi       string   `json:"intoksikasi"`
	BAB               string   `json:"bab"`
	XBAB              string   `json:"xbab"`
	KBAB              string   `json:"kbab"`
	WBAB              string   `json:"wbab"`
	BAK               string   `json:"bak"`
	XBAK              string   `json:"xbak"`
	WBAK              string   `json:"wbak"`
	LBAK              string   `json:"lbak"`
	Psikologis        string   `json:"psikologis"`
	Jiwa              string   `json:"jiwa"`
	Perilaku          string   `json:"perilaku"`
	Dilaporkan        string   `json:"dilaporkan"`
	Sebutkan          string   `json:"sebutkan"`
	Hubungan          string   `json:"hubungan"`
	TinggalDengan     string   `json:"tinggal_dengan"`
	KetTinggal        string   `json:"ket_tinggal"`
	Budaya            string   `json:"budaya"`
	KetBudaya         string   `json:"ket_budaya"`
	PendidikanPJ      string   `json:"pendidikan_pj"`
	KetPendidikanPJ   string   `json:"ket_pendidikan_pj"`
	Edukasi           string   `json:"edukasi"`
	KetEdukasi        string   `json:"ket_edukasi"`
	Kemampuan         string   `json:"kemampuan"`
	Aktifitas         string   `json:"aktifitas"`
	AlatBantu         string   `json:"alat_bantu"`
	KetBantu          string   `json:"ket_bantu"`
	Nyeri             string   `json:"nyeri"`
	Provokes          string   `json:"provokes"`
	KetProvokes       string   `json:"ket_provokes"`
	Quality           string   `json:"quality"`
	KetQuality        string   `json:"ket_quality"`
	Lokasi            string   `json:"lokasi"`
	Menyebar          string   `json:"menyebar"`
	SkalaNyeri        string   `json:"skala_nyeri"`
	Durasi            string   `json:"durasi"`
	NyeriHilang       string   `json:"nyeri_hilang"`
	KetNyeri          string   `json:"ket_nyeri"`
	PadaDokter        string   `json:"pada_dokter"`
	KetDokter         string   `json:"ket_dokter"`
	BerjalanA         string   `json:"berjalan_a"`
	BerjalanB         string   `json:"berjalan_b"`
	BerjalanC         string   `json:"berjalan_c"`
	Hasil             string   `json:"hasil"`
	Lapor             string   `json:"lapor"`
	KetLapor          string   `json:"ket_lapor"`
	Rencana           string   `json:"rencana"`
	NIP               string   `json:"nip"`
	NamaPetugas       string   `json:"nama_petugas"`
	MasalahKeperawatan []string `json:"masalah_keperawatan"`
	RencanaKeperawatan []string `json:"rencana_keperawatan"`
}

// getAsuhanKeperawatanIGD returns asuhan keperawatan IGD data for a given no_rawat
func getAsuhanKeperawatanIGD(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		query := `
			SELECT
				penilaian_awal_keperawatan_igd.tanggal,
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
				penilaian_awal_keperawatan_igd.nip,
				petugas.nama
			FROM penilaian_awal_keperawatan_igd
			INNER JOIN petugas ON penilaian_awal_keperawatan_igd.nip = petugas.nip
			WHERE penilaian_awal_keperawatan_igd.no_rawat = ?
		`

		var asuhan AsuhanKeperawatanIGDDetail
		err := db.QueryRow(query, noRawat).Scan(
			&asuhan.Tanggal,
			&asuhan.Informasi,
			&asuhan.KeluhanUtama,
			&asuhan.RPD,
			&asuhan.RPO,
			&asuhan.StatusKehamilan,
			&asuhan.Gravida,
			&asuhan.Para,
			&asuhan.Abortus,
			&asuhan.HPHT,
			&asuhan.Tekanan,
			&asuhan.Pupil,
			&asuhan.Neurosensorik,
			&asuhan.Integumen,
			&asuhan.Turgor,
			&asuhan.Edema,
			&asuhan.Mukosa,
			&asuhan.Perdarahan,
			&asuhan.JumlahPerdarahan,
			&asuhan.WarnaPerdarahan,
			&asuhan.Intoksikasi,
			&asuhan.BAB,
			&asuhan.XBAB,
			&asuhan.KBAB,
			&asuhan.WBAB,
			&asuhan.BAK,
			&asuhan.XBAK,
			&asuhan.WBAK,
			&asuhan.LBAK,
			&asuhan.Psikologis,
			&asuhan.Jiwa,
			&asuhan.Perilaku,
			&asuhan.Dilaporkan,
			&asuhan.Sebutkan,
			&asuhan.Hubungan,
			&asuhan.TinggalDengan,
			&asuhan.KetTinggal,
			&asuhan.Budaya,
			&asuhan.KetBudaya,
			&asuhan.PendidikanPJ,
			&asuhan.KetPendidikanPJ,
			&asuhan.Edukasi,
			&asuhan.KetEdukasi,
			&asuhan.Kemampuan,
			&asuhan.Aktifitas,
			&asuhan.AlatBantu,
			&asuhan.KetBantu,
			&asuhan.Nyeri,
			&asuhan.Provokes,
			&asuhan.KetProvokes,
			&asuhan.Quality,
			&asuhan.KetQuality,
			&asuhan.Lokasi,
			&asuhan.Menyebar,
			&asuhan.SkalaNyeri,
			&asuhan.Durasi,
			&asuhan.NyeriHilang,
			&asuhan.KetNyeri,
			&asuhan.PadaDokter,
			&asuhan.KetDokter,
			&asuhan.BerjalanA,
			&asuhan.BerjalanB,
			&asuhan.BerjalanC,
			&asuhan.Hasil,
			&asuhan.Lapor,
			&asuhan.KetLapor,
			&asuhan.Rencana,
			&asuhan.NIP,
			&asuhan.NamaPetugas,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
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

		c.JSON(http.StatusOK, asuhan)
	}
}

