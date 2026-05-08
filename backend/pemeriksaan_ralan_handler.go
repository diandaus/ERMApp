package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PEMERIKSAAN RAWAT JALAN ENDPOINT
// ============================================================================

// PemeriksaanRalanDetail represents SOAP data for rawat jalan
type PemeriksaanRalanDetail struct {
	TglPerawatan  string `json:"tgl_perawatan"`
	JamRawat      string `json:"jam_rawat"`
	SuhuTubuh     string `json:"suhu_tubuh"`
	Tensi         string `json:"tensi"`
	Nadi          string `json:"nadi"`
	Respirasi     string `json:"respirasi"`
	Tinggi        string `json:"tinggi"`
	Berat         string `json:"berat"`
	SpO2          string `json:"spo2"`
	GCS           string `json:"gcs"`
	Kesadaran     string `json:"kesadaran"`
	Keluhan       string `json:"keluhan"`
	Pemeriksaan   string `json:"pemeriksaan"`
	Alergi        string `json:"alergi"`
	LingkarPerut  string `json:"lingkar_perut"`
	RTL           string `json:"rtl"`
	Penilaian     string `json:"penilaian"`
	Instruksi     string `json:"instruksi"`
	Evaluasi      string `json:"evaluasi"`
	NIP           string `json:"nip"`
	Nama          string `json:"nama"`
	Jbtn          string `json:"jbtn"`
}

// getPemeriksaanRalan returns pemeriksaan ralan (SOAP) data for a given no_rawat
func getPemeriksaanRalan(db *sql.DB) gin.HandlerFunc {
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
			DATE_FORMAT(pemeriksaan_ralan.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(pemeriksaan_ralan.jam_rawat, '%H:%i:%s') as jam_rawat,
				COALESCE(pemeriksaan_ralan.suhu_tubuh, '') as suhu_tubuh,
				COALESCE(pemeriksaan_ralan.tensi, '') as tensi,
				COALESCE(pemeriksaan_ralan.nadi, '') as nadi,
				COALESCE(pemeriksaan_ralan.respirasi, '') as respirasi,
				COALESCE(pemeriksaan_ralan.tinggi, '') as tinggi,
				COALESCE(pemeriksaan_ralan.berat, '') as berat,
				COALESCE(pemeriksaan_ralan.spo2, '') as spo2,
				COALESCE(pemeriksaan_ralan.gcs, '') as gcs,
				COALESCE(pemeriksaan_ralan.kesadaran, '') as kesadaran,
				COALESCE(pemeriksaan_ralan.keluhan, '') as keluhan,
				COALESCE(pemeriksaan_ralan.pemeriksaan, '') as pemeriksaan,
				COALESCE(pemeriksaan_ralan.alergi, '') as alergi,
				COALESCE(pemeriksaan_ralan.lingkar_perut, '') as lingkar_perut,
				COALESCE(pemeriksaan_ralan.rtl, '') as rtl,
				COALESCE(pemeriksaan_ralan.penilaian, '') as penilaian,
				COALESCE(pemeriksaan_ralan.instruksi, '') as instruksi,
				COALESCE(pemeriksaan_ralan.evaluasi, '') as evaluasi,
				pemeriksaan_ralan.nip,
				pegawai.nama,
				pegawai.jbtn
			FROM pemeriksaan_ralan
			INNER JOIN pegawai ON pemeriksaan_ralan.nip = pegawai.nik
			WHERE pemeriksaan_ralan.no_rawat = ?
			ORDER BY pemeriksaan_ralan.tgl_perawatan, pemeriksaan_ralan.jam_rawat
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var pemeriksaanList []PemeriksaanRalanDetail
		for rows.Next() {
			var p PemeriksaanRalanDetail
			err := rows.Scan(
				&p.TglPerawatan,
				&p.JamRawat,
				&p.SuhuTubuh,
				&p.Tensi,
				&p.Nadi,
				&p.Respirasi,
				&p.Tinggi,
				&p.Berat,
				&p.SpO2,
				&p.GCS,
				&p.Kesadaran,
				&p.Keluhan,
				&p.Pemeriksaan,
				&p.Alergi,
				&p.LingkarPerut,
				&p.RTL,
				&p.Penilaian,
				&p.Instruksi,
				&p.Evaluasi,
				&p.NIP,
				&p.Nama,
				&p.Jbtn,
			)
			if err != nil {
				continue
			}
			pemeriksaanList = append(pemeriksaanList, p)
		}

		c.JSON(http.StatusOK, pemeriksaanList)
	}
}

