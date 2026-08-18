package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// RESUME PERAWATAN ENDPOINT
// ============================================================================

// ResumePasien represents resume for outpatient (rawat jalan)
type ResumePasien struct {
	KdDokter             string `json:"kd_dokter"`
	NmDokter             string `json:"nm_dokter"`
	KondisiPulang        string `json:"kondisi_pulang"`
	KeluhanUtama         string `json:"keluhan_utama"`
	JalannyaPenyakit     string `json:"jalannya_penyakit"`
	PemeriksaanPenunjang string `json:"pemeriksaan_penunjang"`
	HasilLaborat         string `json:"hasil_laborat"`
	DiagnosaUtama        string `json:"diagnosa_utama"`
	KdDiagnosaUtama      string `json:"kd_diagnosa_utama"`
	DiagnosaSekunder     string `json:"diagnosa_sekunder"`
	KdDiagnosaSekunder   string `json:"kd_diagnosa_sekunder"`
	DiagnosaSekunder2    string `json:"diagnosa_sekunder2"`
	KdDiagnosaSekunder2  string `json:"kd_diagnosa_sekunder2"`
	DiagnosaSekunder3    string `json:"diagnosa_sekunder3"`
	KdDiagnosaSekunder3  string `json:"kd_diagnosa_sekunder3"`
	DiagnosaSekunder4    string `json:"diagnosa_sekunder4"`
	KdDiagnosaSekunder4  string `json:"kd_diagnosa_sekunder4"`
	ProsedurUtama        string `json:"prosedur_utama"`
	KdProsedurUtama      string `json:"kd_prosedur_utama"`
	ProsedurSekunder     string `json:"prosedur_sekunder"`
	KdProsedurSekunder   string `json:"kd_prosedur_sekunder"`
	ProsedurSekunder2    string `json:"prosedur_sekunder2"`
	KdProsedurSekunder2  string `json:"kd_prosedur_sekunder2"`
	ProsedurSekunder3    string `json:"prosedur_sekunder3"`
	KdProsedurSekunder3  string `json:"kd_prosedur_sekunder3"`
	ObatPulang           string `json:"obat_pulang"`
}

// ResumePasienRanap represents resume for inpatient (rawat inap)
type ResumePasienRanap struct {
	KdDokter             string `json:"kd_dokter"`
	NmDokter             string `json:"nm_dokter"`
	KdDokterPengirim     string `json:"kd_dokter_pengirim"`
	NmDokterPengirim     string `json:"nm_dokter_pengirim"`
	DiagnosaAwal         string `json:"diagnosa_awal"`
	Alasan               string `json:"alasan"`
	KeluhanUtama         string `json:"keluhan_utama"`
	PemeriksaanFisik     string `json:"pemeriksaan_fisik"`
	PemeriksaanPenunjang string `json:"pemeriksaan_penunjang"`
	HasilLaborat         string `json:"hasil_laborat"`
	ObatDiRS             string `json:"obat_di_rs"`
	DiagnosaUtama        string `json:"diagnosa_utama"`
	KdDiagnosaUtama      string `json:"kd_diagnosa_utama"`
	DiagnosaSekunder     string `json:"diagnosa_sekunder"`
	KdDiagnosaSekunder   string `json:"kd_diagnosa_sekunder"`
	DiagnosaSekunder2    string `json:"diagnosa_sekunder2"`
	KdDiagnosaSekunder2  string `json:"kd_diagnosa_sekunder2"`
	DiagnosaSekunder3    string `json:"diagnosa_sekunder3"`
	KdDiagnosaSekunder3  string `json:"kd_diagnosa_sekunder3"`
	DiagnosaSekunder4    string `json:"diagnosa_sekunder4"`
	KdDiagnosaSekunder4  string `json:"kd_diagnosa_sekunder4"`
	DiagnosaSekunder5    string `json:"diagnosa_sekunder5"`
	KdDiagnosaSekunder5  string `json:"kd_diagnosa_sekunder5"`
	ProsedurUtama        string `json:"prosedur_utama"`
	KdProsedurUtama      string `json:"kd_prosedur_utama"`
	ProsedurSekunder     string `json:"prosedur_sekunder"`
	KdProsedurSekunder   string `json:"kd_prosedur_sekunder"`
	ProsedurSekunder2    string `json:"prosedur_sekunder2"`
	KdProsedurSekunder2  string `json:"kd_prosedur_sekunder2"`
	ProsedurSekunder3    string `json:"prosedur_sekunder3"`
	KdProsedurSekunder3  string `json:"kd_prosedur_sekunder3"`
	ProsedurSekunder4    string `json:"prosedur_sekunder4"`
	KdProsedurSekunder4  string `json:"kd_prosedur_sekunder4"`
	ProsedurSekunder5    string `json:"prosedur_sekunder5"`
	KdProsedurSekunder5  string `json:"kd_prosedur_sekunder5"`
	KonsulDokter         string `json:"konsul_dokter"`
	Edukasi              string `json:"edukasi"`
	CaraKeluar           string `json:"cara_keluar"`
	KetKeluar            string `json:"ket_keluar"`
	Keadaan              string `json:"keadaan"`
	KetKeadaan           string `json:"ket_keadaan"`
	ObatPulang           string `json:"obat_pulang"`
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
				COALESCE(dokter.nm_dokter, '') as nm_dokter,
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
			LEFT JOIN dokter ON resume_pasien_ranap.kd_dokter = dokter.kd_dokter
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

// ─── POST & PUT /api/resume-ranap ─────────────────────────────────────────────

type ResumeRanapPayload struct {
	NoRawat              string `json:"no_rawat"`
	KdDokter             string `json:"kd_dokter"`
	NmDokter             string `json:"nm_dokter"`
	KdDokterPengirim     string `json:"kd_dokter_pengirim"`
	DiagnosaAwal         string `json:"diagnosa_awal"`
	Alasan               string `json:"alasan"`
	KeluhanUtama         string `json:"keluhan_utama"`
	PemeriksaanFisik     string `json:"pemeriksaan_fisik"`
	PemeriksaanPenunjang string `json:"pemeriksaan_penunjang"`
	HasilLaborat         string `json:"hasil_laborat"`
	ObatDiRS             string `json:"obat_di_rs"`
	DiagnosaUtama        string `json:"diagnosa_utama"`
	KdDiagnosaUtama      string `json:"kd_diagnosa_utama"`
	DiagnosaSekunder     string `json:"diagnosa_sekunder"`
	KdDiagnosaSekunder   string `json:"kd_diagnosa_sekunder"`
	DiagnosaSekunder2    string `json:"diagnosa_sekunder2"`
	KdDiagnosaSekunder2  string `json:"kd_diagnosa_sekunder2"`
	DiagnosaSekunder3    string `json:"diagnosa_sekunder3"`
	KdDiagnosaSekunder3  string `json:"kd_diagnosa_sekunder3"`
	DiagnosaSekunder4    string `json:"diagnosa_sekunder4"`
	KdDiagnosaSekunder4  string `json:"kd_diagnosa_sekunder4"`
	DiagnosaSekunder5    string `json:"diagnosa_sekunder5"`
	KdDiagnosaSekunder5  string `json:"kd_diagnosa_sekunder5"`
	ProsedurUtama        string `json:"prosedur_utama"`
	KdProsedurUtama      string `json:"kd_prosedur_utama"`
	ProsedurSekunder     string `json:"prosedur_sekunder"`
	KdProsedurSekunder   string `json:"kd_prosedur_sekunder"`
	ProsedurSekunder2    string `json:"prosedur_sekunder2"`
	KdProsedurSekunder2  string `json:"kd_prosedur_sekunder2"`
	ProsedurSekunder3    string `json:"prosedur_sekunder3"`
	KdProsedurSekunder3  string `json:"kd_prosedur_sekunder3"`
	ProsedurSekunder4    string `json:"prosedur_sekunder4"`
	KdProsedurSekunder4  string `json:"kd_prosedur_sekunder4"`
	ProsedurSekunder5    string `json:"prosedur_sekunder5"`
	KdProsedurSekunder5  string `json:"kd_prosedur_sekunder5"`
	KonsulDokter         string `json:"konsul_dokter"`
	Edukasi              string `json:"edukasi"`
	CaraKeluar           string `json:"cara_keluar"`
	KetKeluar            string `json:"ket_keluar"`
	Keadaan              string `json:"keadaan"`
	KetKeadaan           string `json:"ket_keadaan"`
	ObatPulang           string `json:"obat_pulang"`
}

func saveResumeRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p ResumeRanapPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.NoRawat == "" || p.KdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kd_dokter wajib diisi"})
			return
		}
		_, err := db.Exec(`
			INSERT INTO resume_pasien_ranap
				(no_rawat, kd_dokter, diagnosa_awal, alasan, keluhan_utama,
				 pemeriksaan_fisik, pemeriksaan_penunjang, hasil_laborat, obat_di_rs,
				 diagnosa_utama, kd_diagnosa_utama,
				 diagnosa_sekunder, kd_diagnosa_sekunder,
				 diagnosa_sekunder2, kd_diagnosa_sekunder2,
				 diagnosa_sekunder3, kd_diagnosa_sekunder3,
				 diagnosa_sekunder4, kd_diagnosa_sekunder4,
				 diagnosa_sekunder5, kd_diagnosa_sekunder5,
				 prosedur_utama, kd_prosedur_utama,
				 prosedur_sekunder, kd_prosedur_sekunder,
				 prosedur_sekunder2, kd_prosedur_sekunder2,
				 prosedur_sekunder3, kd_prosedur_sekunder3,
				 prosedur_sekunder4, kd_prosedur_sekunder4,
				 prosedur_sekunder5, kd_prosedur_sekunder5,
				 konsul_dokter, edukasi,
				 cara_keluar, ket_keluar, keadaan, ket_keadaan, obat_pulang)
			VALUES
				(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
			ON DUPLICATE KEY UPDATE
				kd_dokter=VALUES(kd_dokter),
				diagnosa_awal=VALUES(diagnosa_awal),
				alasan=VALUES(alasan), keluhan_utama=VALUES(keluhan_utama),
				pemeriksaan_fisik=VALUES(pemeriksaan_fisik),
				pemeriksaan_penunjang=VALUES(pemeriksaan_penunjang),
				hasil_laborat=VALUES(hasil_laborat), obat_di_rs=VALUES(obat_di_rs),
				diagnosa_utama=VALUES(diagnosa_utama), kd_diagnosa_utama=VALUES(kd_diagnosa_utama),
				diagnosa_sekunder=VALUES(diagnosa_sekunder), kd_diagnosa_sekunder=VALUES(kd_diagnosa_sekunder),
				diagnosa_sekunder2=VALUES(diagnosa_sekunder2), kd_diagnosa_sekunder2=VALUES(kd_diagnosa_sekunder2),
				diagnosa_sekunder3=VALUES(diagnosa_sekunder3), kd_diagnosa_sekunder3=VALUES(kd_diagnosa_sekunder3),
				diagnosa_sekunder4=VALUES(diagnosa_sekunder4), kd_diagnosa_sekunder4=VALUES(kd_diagnosa_sekunder4),
				diagnosa_sekunder5=VALUES(diagnosa_sekunder5), kd_diagnosa_sekunder5=VALUES(kd_diagnosa_sekunder5),
				prosedur_utama=VALUES(prosedur_utama), kd_prosedur_utama=VALUES(kd_prosedur_utama),
				prosedur_sekunder=VALUES(prosedur_sekunder), kd_prosedur_sekunder=VALUES(kd_prosedur_sekunder),
				prosedur_sekunder2=VALUES(prosedur_sekunder2), kd_prosedur_sekunder2=VALUES(kd_prosedur_sekunder2),
				prosedur_sekunder3=VALUES(prosedur_sekunder3), kd_prosedur_sekunder3=VALUES(kd_prosedur_sekunder3),
				prosedur_sekunder4=VALUES(prosedur_sekunder4), kd_prosedur_sekunder4=VALUES(kd_prosedur_sekunder4),
				prosedur_sekunder5=VALUES(prosedur_sekunder5), kd_prosedur_sekunder5=VALUES(kd_prosedur_sekunder5),
				konsul_dokter=VALUES(konsul_dokter), edukasi=VALUES(edukasi),
				cara_keluar=VALUES(cara_keluar), ket_keluar=VALUES(ket_keluar),
				keadaan=VALUES(keadaan), ket_keadaan=VALUES(ket_keadaan),
				obat_pulang=VALUES(obat_pulang)`,
			p.NoRawat, p.KdDokter, p.DiagnosaAwal, p.Alasan, p.KeluhanUtama,
			p.PemeriksaanFisik, p.PemeriksaanPenunjang, p.HasilLaborat, p.ObatDiRS,
			p.DiagnosaUtama, p.KdDiagnosaUtama,
			p.DiagnosaSekunder, p.KdDiagnosaSekunder,
			p.DiagnosaSekunder2, p.KdDiagnosaSekunder2,
			p.DiagnosaSekunder3, p.KdDiagnosaSekunder3,
			p.DiagnosaSekunder4, p.KdDiagnosaSekunder4,
			p.DiagnosaSekunder5, p.KdDiagnosaSekunder5,
			p.ProsedurUtama, p.KdProsedurUtama,
			p.ProsedurSekunder, p.KdProsedurSekunder,
			p.ProsedurSekunder2, p.KdProsedurSekunder2,
			p.ProsedurSekunder3, p.KdProsedurSekunder3,
			p.ProsedurSekunder4, p.KdProsedurSekunder4,
			p.ProsedurSekunder5, p.KdProsedurSekunder5,
			p.KonsulDokter, p.Edukasi,
			p.CaraKeluar, p.KetKeluar, p.Keadaan, p.KetKeadaan, p.ObatPulang,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Resume berhasil disimpan"})
	}
}

// ─── DELETE /api/resume-ranap ─────────────────────────────────────────────────

func deleteResumeRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		_, err := db.Exec(`DELETE FROM resume_pasien_ranap WHERE no_rawat = ?`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Resume berhasil dihapus"})
	}
}

// ============================================================================
// RIWAYAT UTK RefBtn "referensi" DI ModalInputResume.tsx (Radiologi, Lab, Obat)
// Padanan RMCariHasilRadiologi.java / RMCariHasilLaborat.java /
// RMCariJumlahObat.java — masing2 endpoint tabel legacy tunggal (bukan
// UNION spt getRiwayatPemeriksaan), jadi tidak perlu whitelist kolom krn
// tidak ada parameter field dinamis.
// ============================================================================

type RiwayatRadiologiRow struct {
	TglPeriksa string `json:"tgl_periksa"`
	Jam        string `json:"jam"`
	Hasil      string `json:"hasil"`
}

// GET /api/riwayat-radiologi/:no_rawat?search=
func getRiwayatHasilRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `SELECT DATE_FORMAT(tgl_periksa,'%d/%m/%Y'), TIME_FORMAT(jam,'%H:%i:%s'), COALESCE(hasil,'')
			FROM hasil_radiologi WHERE no_rawat = ?`
		args := []interface{}{noRawat}
		if search != "" {
			like := "%" + search + "%"
			query += " AND (tgl_periksa LIKE ? OR hasil LIKE ?)"
			args = append(args, like, like)
		}
		query += " ORDER BY tgl_periksa, jam"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []RiwayatRadiologiRow{}
		for rows.Next() {
			var r RiwayatRadiologiRow
			if err := rows.Scan(&r.TglPeriksa, &r.Jam, &r.Hasil); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type RiwayatLaboratRow struct {
	TglPeriksa   string `json:"tgl_periksa"`
	Jam          string `json:"jam"`
	Pemeriksaan  string `json:"pemeriksaan"`
	Nilai        string `json:"nilai"`
	NilaiRujukan string `json:"nilai_rujukan"`
}

// GET /api/riwayat-laborat/:no_rawat?search=
func getRiwayatLaborat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `SELECT DATE_FORMAT(detail_periksa_lab.tgl_periksa,'%d/%m/%Y'), TIME_FORMAT(detail_periksa_lab.jam,'%H:%i:%s'),
			COALESCE(template_laboratorium.Pemeriksaan,''), COALESCE(detail_periksa_lab.nilai,''), COALESCE(detail_periksa_lab.nilai_rujukan,'')
			FROM detail_periksa_lab
			INNER JOIN template_laboratorium ON detail_periksa_lab.id_template = template_laboratorium.id_template
			WHERE detail_periksa_lab.no_rawat = ?`
		args := []interface{}{noRawat}
		if search != "" {
			like := "%" + search + "%"
			query += " AND (detail_periksa_lab.tgl_periksa LIKE ? OR template_laboratorium.Pemeriksaan LIKE ?)"
			args = append(args, like, like)
		}
		query += " ORDER BY detail_periksa_lab.tgl_periksa, detail_periksa_lab.jam"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []RiwayatLaboratRow{}
		for rows.Next() {
			var r RiwayatLaboratRow
			if err := rows.Scan(&r.TglPeriksa, &r.Jam, &r.Pemeriksaan, &r.Nilai, &r.NilaiRujukan); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type RiwayatObatRanapRow struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	Jam          string  `json:"jam"`
	NamaBarang   string  `json:"nama_brng"`
	Jml          float64 `json:"jml"`
	KodeSat      string  `json:"kode_sat"`
}

// GET /api/riwayat-obat-ranap/:no_rawat?search=
func getRiwayatObatRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `SELECT DATE_FORMAT(detail_pemberian_obat.tgl_perawatan,'%d/%m/%Y'), TIME_FORMAT(detail_pemberian_obat.jam,'%H:%i:%s'),
			COALESCE(databarang.nama_brng,''), detail_pemberian_obat.jml, COALESCE(databarang.kode_sat,'')
			FROM detail_pemberian_obat
			INNER JOIN databarang ON detail_pemberian_obat.kode_brng = databarang.kode_brng
			WHERE detail_pemberian_obat.no_rawat = ?`
		args := []interface{}{noRawat}
		if search != "" {
			like := "%" + search + "%"
			query += " AND (detail_pemberian_obat.tgl_perawatan LIKE ? OR databarang.nama_brng LIKE ?)"
			args = append(args, like, like)
		}
		query += " ORDER BY detail_pemberian_obat.tgl_perawatan, detail_pemberian_obat.jam"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []RiwayatObatRanapRow{}
		for rows.Next() {
			var r RiwayatObatRanapRow
			if err := rows.Scan(&r.TglPerawatan, &r.Jam, &r.NamaBarang, &r.Jml, &r.KodeSat); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// GET /api/dpjp-ranap/:no_rawat — dipakai isi otomatis field DPJP di
// ModalInputResume.tsx. DPJP disimpan terpisah dari reg_periksa.kd_dokter
// (yg dipakai utk "Dokter IGD"/dokter pengirim) di tabel dpjp_ranap —
// padanan pola fallback yg sudah dipakai di resep_handler.go (dpjp_ranap
// diutamakan, satu pasien bisa saja punya >1 DPJP jadi diambil salah satu).
func getDpjpRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		var kdDokter, nmDokter string
		err := db.QueryRow(`
			SELECT dr.kd_dokter, COALESCE(d.nm_dokter,'')
			FROM dpjp_ranap dr
			LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
			WHERE dr.no_rawat = ?
			LIMIT 1
		`, noRawat).Scan(&kdDokter, &nmDokter)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"kd_dokter": "", "nm_dokter": ""})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kd_dokter": kdDokter, "nm_dokter": nmDokter})
	}
}

// GET /api/dokter-pengirim/:no_rawat — dipakai isi otomatis field
// "Dokter IGD" di ModalInputResume.tsx. Sumbernya reg_periksa.kd_dokter
// (dokter yg mendaftarkan/merujuk pasien saat masuk), BEDA dari DPJP
// (dpjp_ranap, lihat getDpjpRanap) — sebelumnya field ini keliru dikira
// bisa dipakai dari `patient.kd_dokter` di frontend, padahal field itu
// isinya DPJP juga (lihat getRawatInapList), jadi sering kosong krn tidak
// semua pasien sudah punya baris dpjp_ranap.
func getDokterPengirim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		var kdDokter, nmDokter string
		err := db.QueryRow(`
			SELECT reg_periksa.kd_dokter, COALESCE(dokter.nm_dokter,'')
			FROM reg_periksa
			LEFT JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
			WHERE reg_periksa.no_rawat = ?
			LIMIT 1
		`, noRawat).Scan(&kdDokter, &nmDokter)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"kd_dokter": "", "nm_dokter": ""})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kd_dokter": kdDokter, "nm_dokter": nmDokter})
	}
}
