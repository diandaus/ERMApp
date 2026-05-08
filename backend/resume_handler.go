package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// RESUME PERAWATAN ENDPOINT
// ============================================================================

// ResumePasien represents resume for outpatient (rawat jalan)
type ResumePasien struct {
	KdDokter              string `json:"kd_dokter"`
	NmDokter              string `json:"nm_dokter"`
	KondisiPulang         string `json:"kondisi_pulang"`
	KeluhanUtama          string `json:"keluhan_utama"`
	JalannyaPenyakit      string `json:"jalannya_penyakit"`
	PemeriksaanPenunjang  string `json:"pemeriksaan_penunjang"`
	HasilLaborat          string `json:"hasil_laborat"`
	DiagnosaUtama         string `json:"diagnosa_utama"`
	KdDiagnosaUtama       string `json:"kd_diagnosa_utama"`
	DiagnosaSekunder      string `json:"diagnosa_sekunder"`
	KdDiagnosaSekunder    string `json:"kd_diagnosa_sekunder"`
	DiagnosaSekunder2     string `json:"diagnosa_sekunder2"`
	KdDiagnosaSekunder2   string `json:"kd_diagnosa_sekunder2"`
	DiagnosaSekunder3     string `json:"diagnosa_sekunder3"`
	KdDiagnosaSekunder3   string `json:"kd_diagnosa_sekunder3"`
	DiagnosaSekunder4     string `json:"diagnosa_sekunder4"`
	KdDiagnosaSekunder4   string `json:"kd_diagnosa_sekunder4"`
	ProsedurUtama         string `json:"prosedur_utama"`
	KdProsedurUtama       string `json:"kd_prosedur_utama"`
	ProsedurSekunder      string `json:"prosedur_sekunder"`
	KdProsedurSekunder    string `json:"kd_prosedur_sekunder"`
	ProsedurSekunder2     string `json:"prosedur_sekunder2"`
	KdProsedurSekunder2   string `json:"kd_prosedur_sekunder2"`
	ProsedurSekunder3     string `json:"prosedur_sekunder3"`
	KdProsedurSekunder3   string `json:"kd_prosedur_sekunder3"`
	ObatPulang            string `json:"obat_pulang"`
}

// ResumePasienRanap represents resume for inpatient (rawat inap)
type ResumePasienRanap struct {
	KdDokter              string `json:"kd_dokter"`
	NmDokter              string `json:"nm_dokter"`
	DiagnosaAwal          string `json:"diagnosa_awal"`
	Alasan                string `json:"alasan"`
	KeluhanUtama          string `json:"keluhan_utama"`
	PemeriksaanFisik      string `json:"pemeriksaan_fisik"`
	PemeriksaanPenunjang  string `json:"pemeriksaan_penunjang"`
	HasilLaborat          string `json:"hasil_laborat"`
	ObatDiRS              string `json:"obat_di_rs"`
	DiagnosaUtama         string `json:"diagnosa_utama"`
	KdDiagnosaUtama       string `json:"kd_diagnosa_utama"`
	DiagnosaSekunder      string `json:"diagnosa_sekunder"`
	KdDiagnosaSekunder    string `json:"kd_diagnosa_sekunder"`
	DiagnosaSekunder2     string `json:"diagnosa_sekunder2"`
	KdDiagnosaSekunder2   string `json:"kd_diagnosa_sekunder2"`
	DiagnosaSekunder3     string `json:"diagnosa_sekunder3"`
	KdDiagnosaSekunder3   string `json:"kd_diagnosa_sekunder3"`
	DiagnosaSekunder4     string `json:"diagnosa_sekunder4"`
	KdDiagnosaSekunder4   string `json:"kd_diagnosa_sekunder4"`
	DiagnosaSekunder5     string `json:"diagnosa_sekunder5"`
	KdDiagnosaSekunder5   string `json:"kd_diagnosa_sekunder5"`
	ProsedurUtama         string `json:"prosedur_utama"`
	KdProsedurUtama       string `json:"kd_prosedur_utama"`
	ProsedurSekunder      string `json:"prosedur_sekunder"`
	KdProsedurSekunder    string `json:"kd_prosedur_sekunder"`
	ProsedurSekunder2     string `json:"prosedur_sekunder2"`
	KdProsedurSekunder2   string `json:"kd_prosedur_sekunder2"`
	ProsedurSekunder3     string `json:"prosedur_sekunder3"`
	KdProsedurSekunder3   string `json:"kd_prosedur_sekunder3"`
	ProsedurSekunder4     string `json:"prosedur_sekunder4"`
	KdProsedurSekunder4   string `json:"kd_prosedur_sekunder4"`
	ProsedurSekunder5     string `json:"prosedur_sekunder5"`
	KdProsedurSekunder5   string `json:"kd_prosedur_sekunder5"`
	KonsulDokter          string `json:"konsul_dokter"`
	Edukasi               string `json:"edukasi"`
	CaraKeluar            string `json:"cara_keluar"`
	KetKeluar             string `json:"ket_keluar"`
	Keadaan               string `json:"keadaan"`
	KetKeadaan            string `json:"ket_keadaan"`
	ObatPulang            string `json:"obat_pulang"`
}

// ResumeResponse represents the complete resume data response
type ResumeResponse struct {
	ResumePasien      *ResumePasien      `json:"resume_pasien,omitempty"`
	ResumePasienRanap *ResumePasienRanap `json:"resume_pasien_ranap,omitempty"`
}

// getResume returns resume data for a given no_rawat
func getResume(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := ResumeResponse{}

		// ====================================================================
		// 1. GET RESUME PASIEN (RAWAT JALAN)
		// ====================================================================
		queryResume := `
			SELECT 
				resume_pasien.kd_dokter,
				dokter.nm_dokter,
				COALESCE(resume_pasien.kondisi_pulang, '') as kondisi_pulang,
				COALESCE(resume_pasien.keluhan_utama, '') as keluhan_utama,
				COALESCE(resume_pasien.jalannya_penyakit, '') as jalannya_penyakit,
				COALESCE(resume_pasien.pemeriksaan_penunjang, '') as pemeriksaan_penunjang,
				COALESCE(resume_pasien.hasil_laborat, '') as hasil_laborat,
				COALESCE(resume_pasien.diagnosa_utama, '') as diagnosa_utama,
				COALESCE(resume_pasien.kd_diagnosa_utama, '') as kd_diagnosa_utama,
				COALESCE(resume_pasien.diagnosa_sekunder, '') as diagnosa_sekunder,
				COALESCE(resume_pasien.kd_diagnosa_sekunder, '') as kd_diagnosa_sekunder,
				COALESCE(resume_pasien.diagnosa_sekunder2, '') as diagnosa_sekunder2,
				COALESCE(resume_pasien.kd_diagnosa_sekunder2, '') as kd_diagnosa_sekunder2,
				COALESCE(resume_pasien.diagnosa_sekunder3, '') as diagnosa_sekunder3,
				COALESCE(resume_pasien.kd_diagnosa_sekunder3, '') as kd_diagnosa_sekunder3,
				COALESCE(resume_pasien.diagnosa_sekunder4, '') as diagnosa_sekunder4,
				COALESCE(resume_pasien.kd_diagnosa_sekunder4, '') as kd_diagnosa_sekunder4,
				COALESCE(resume_pasien.prosedur_utama, '') as prosedur_utama,
				COALESCE(resume_pasien.kd_prosedur_utama, '') as kd_prosedur_utama,
				COALESCE(resume_pasien.prosedur_sekunder, '') as prosedur_sekunder,
				COALESCE(resume_pasien.kd_prosedur_sekunder, '') as kd_prosedur_sekunder,
				COALESCE(resume_pasien.prosedur_sekunder2, '') as prosedur_sekunder2,
				COALESCE(resume_pasien.kd_prosedur_sekunder2, '') as kd_prosedur_sekunder2,
				COALESCE(resume_pasien.prosedur_sekunder3, '') as prosedur_sekunder3,
				COALESCE(resume_pasien.kd_prosedur_sekunder3, '') as kd_prosedur_sekunder3,
				COALESCE(resume_pasien.obat_pulang, '') as obat_pulang
			FROM resume_pasien
			INNER JOIN dokter ON resume_pasien.kd_dokter = dokter.kd_dokter
			WHERE resume_pasien.no_rawat = ?
		`

		var resume ResumePasien
		err := db.QueryRow(queryResume, noRawat).Scan(
			&resume.KdDokter, &resume.NmDokter, &resume.KondisiPulang, &resume.KeluhanUtama,
			&resume.JalannyaPenyakit, &resume.PemeriksaanPenunjang, &resume.HasilLaborat,
			&resume.DiagnosaUtama, &resume.KdDiagnosaUtama,
			&resume.DiagnosaSekunder, &resume.KdDiagnosaSekunder,
			&resume.DiagnosaSekunder2, &resume.KdDiagnosaSekunder2,
			&resume.DiagnosaSekunder3, &resume.KdDiagnosaSekunder3,
			&resume.DiagnosaSekunder4, &resume.KdDiagnosaSekunder4,
			&resume.ProsedurUtama, &resume.KdProsedurUtama,
			&resume.ProsedurSekunder, &resume.KdProsedurSekunder,
			&resume.ProsedurSekunder2, &resume.KdProsedurSekunder2,
			&resume.ProsedurSekunder3, &resume.KdProsedurSekunder3,
			&resume.ObatPulang,
		)

		if err == nil {
			response.ResumePasien = &resume
		} else if err != sql.ErrNoRows {
			fmt.Println("Error querying resume pasien:", err)
		}

		// ====================================================================
		// 2. GET RESUME PASIEN RANAP (RAWAT INAP)
		// ====================================================================
		queryResumeRanap := `
			SELECT 
				resume_pasien_ranap.kd_dokter,
				dokter.nm_dokter,
				COALESCE(resume_pasien_ranap.diagnosa_awal, '') as diagnosa_awal,
				COALESCE(resume_pasien_ranap.alasan, '') as alasan,
				COALESCE(resume_pasien_ranap.keluhan_utama, '') as keluhan_utama,
				COALESCE(resume_pasien_ranap.pemeriksaan_fisik, '') as pemeriksaan_fisik,
				COALESCE(resume_pasien_ranap.pemeriksaan_penunjang, '') as pemeriksaan_penunjang,
				COALESCE(resume_pasien_ranap.hasil_laborat, '') as hasil_laborat,
				COALESCE(resume_pasien_ranap.obat_di_rs, '') as obat_di_rs,
				COALESCE(resume_pasien_ranap.diagnosa_utama, '') as diagnosa_utama,
				COALESCE(resume_pasien_ranap.kd_diagnosa_utama, '') as kd_diagnosa_utama,
				COALESCE(resume_pasien_ranap.diagnosa_sekunder, '') as diagnosa_sekunder,
				COALESCE(resume_pasien_ranap.kd_diagnosa_sekunder, '') as kd_diagnosa_sekunder,
				COALESCE(resume_pasien_ranap.diagnosa_sekunder2, '') as diagnosa_sekunder2,
				COALESCE(resume_pasien_ranap.kd_diagnosa_sekunder2, '') as kd_diagnosa_sekunder2,
				COALESCE(resume_pasien_ranap.diagnosa_sekunder3, '') as diagnosa_sekunder3,
				COALESCE(resume_pasien_ranap.kd_diagnosa_sekunder3, '') as kd_diagnosa_sekunder3,
				COALESCE(resume_pasien_ranap.diagnosa_sekunder4, '') as diagnosa_sekunder4,
				COALESCE(resume_pasien_ranap.kd_diagnosa_sekunder4, '') as kd_diagnosa_sekunder4,
				COALESCE(resume_pasien_ranap.diagnosa_sekunder5, '') as diagnosa_sekunder5,
				COALESCE(resume_pasien_ranap.kd_diagnosa_sekunder5, '') as kd_diagnosa_sekunder5,
				COALESCE(resume_pasien_ranap.prosedur_utama, '') as prosedur_utama,
				COALESCE(resume_pasien_ranap.kd_prosedur_utama, '') as kd_prosedur_utama,
				COALESCE(resume_pasien_ranap.prosedur_sekunder, '') as prosedur_sekunder,
				COALESCE(resume_pasien_ranap.kd_prosedur_sekunder, '') as kd_prosedur_sekunder,
				COALESCE(resume_pasien_ranap.prosedur_sekunder2, '') as prosedur_sekunder2,
				COALESCE(resume_pasien_ranap.kd_prosedur_sekunder2, '') as kd_prosedur_sekunder2,
				COALESCE(resume_pasien_ranap.prosedur_sekunder3, '') as prosedur_sekunder3,
				COALESCE(resume_pasien_ranap.kd_prosedur_sekunder3, '') as kd_prosedur_sekunder3,
				COALESCE(resume_pasien_ranap.prosedur_sekunder4, '') as prosedur_sekunder4,
				COALESCE(resume_pasien_ranap.kd_prosedur_sekunder4, '') as kd_prosedur_sekunder4,
				COALESCE(resume_pasien_ranap.prosedur_sekunder5, '') as prosedur_sekunder5,
				COALESCE(resume_pasien_ranap.kd_prosedur_sekunder5, '') as kd_prosedur_sekunder5,
				COALESCE(resume_pasien_ranap.konsul_dokter, '') as konsul_dokter,
				COALESCE(resume_pasien_ranap.edukasi, '') as edukasi,
				COALESCE(resume_pasien_ranap.cara_keluar, '') as cara_keluar,
				COALESCE(resume_pasien_ranap.ket_keluar, '') as ket_keluar,
				COALESCE(resume_pasien_ranap.keadaan, '') as keadaan,
				COALESCE(resume_pasien_ranap.ket_keadaan, '') as ket_keadaan,
				COALESCE(resume_pasien_ranap.obat_pulang, '') as obat_pulang
			FROM resume_pasien_ranap
			INNER JOIN dokter ON resume_pasien_ranap.kd_dokter = dokter.kd_dokter
			WHERE resume_pasien_ranap.no_rawat = ?
		`

		var resumeRanap ResumePasienRanap
		err = db.QueryRow(queryResumeRanap, noRawat).Scan(
			&resumeRanap.KdDokter, &resumeRanap.NmDokter,
			&resumeRanap.DiagnosaAwal, &resumeRanap.Alasan, &resumeRanap.KeluhanUtama,
			&resumeRanap.PemeriksaanFisik, &resumeRanap.PemeriksaanPenunjang, &resumeRanap.HasilLaborat,
			&resumeRanap.ObatDiRS,
			&resumeRanap.DiagnosaUtama, &resumeRanap.KdDiagnosaUtama,
			&resumeRanap.DiagnosaSekunder, &resumeRanap.KdDiagnosaSekunder,
			&resumeRanap.DiagnosaSekunder2, &resumeRanap.KdDiagnosaSekunder2,
			&resumeRanap.DiagnosaSekunder3, &resumeRanap.KdDiagnosaSekunder3,
			&resumeRanap.DiagnosaSekunder4, &resumeRanap.KdDiagnosaSekunder4,
			&resumeRanap.DiagnosaSekunder5, &resumeRanap.KdDiagnosaSekunder5,
			&resumeRanap.ProsedurUtama, &resumeRanap.KdProsedurUtama,
			&resumeRanap.ProsedurSekunder, &resumeRanap.KdProsedurSekunder,
			&resumeRanap.ProsedurSekunder2, &resumeRanap.KdProsedurSekunder2,
			&resumeRanap.ProsedurSekunder3, &resumeRanap.KdProsedurSekunder3,
			&resumeRanap.ProsedurSekunder4, &resumeRanap.KdProsedurSekunder4,
			&resumeRanap.ProsedurSekunder5, &resumeRanap.KdProsedurSekunder5,
			&resumeRanap.KonsulDokter, &resumeRanap.Edukasi,
			&resumeRanap.CaraKeluar, &resumeRanap.KetKeluar,
			&resumeRanap.Keadaan, &resumeRanap.KetKeadaan,
			&resumeRanap.ObatPulang,
		)

		if err == nil {
			response.ResumePasienRanap = &resumeRanap
		} else if err != sql.ErrNoRows {
			fmt.Println("Error querying resume pasien ranap:", err)
		}

		// Return empty response if no data found
		if response.ResumePasien == nil && response.ResumePasienRanap == nil {
			c.JSON(http.StatusOK, gin.H{})
			return
		}

		c.JSON(http.StatusOK, response)
	}
}

