package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PEMERIKSAAN RAWAT INAP ENDPOINT
// ============================================================================

// PemeriksaanRanapDetail represents SOAP data for rawat inap
type PemeriksaanRanapDetail struct {
	TglPerawatan string `json:"tgl_perawatan"`
	JamRawat     string `json:"jam_rawat"`
	SuhuTubuh    string `json:"suhu_tubuh"`
	Tensi        string `json:"tensi"`
	Nadi         string `json:"nadi"`
	Respirasi    string `json:"respirasi"`
	Tinggi       string `json:"tinggi"`
	Berat        string `json:"berat"`
	SpO2         string `json:"spo2"`
	GCS          string `json:"gcs"`
	Kesadaran    string `json:"kesadaran"`
	Keluhan      string `json:"keluhan"`
	Pemeriksaan  string `json:"pemeriksaan"`
	Alergi       string `json:"alergi"`
	RTL          string `json:"rtl"`
	Penilaian    string `json:"penilaian"`
	Instruksi    string `json:"instruksi"`
	Evaluasi     string `json:"evaluasi"`
	NIP          string `json:"nip"`
	Nama         string `json:"nama"`
	Jbtn         string `json:"jbtn"`
}

// getPemeriksaanRanap returns pemeriksaan ranap (SOAP) data for a given no_rawat
func getPemeriksaanRanap(db *sql.DB) gin.HandlerFunc {
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
			DATE_FORMAT(pemeriksaan_ranap.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(pemeriksaan_ranap.jam_rawat, '%H:%i:%s') as jam_rawat,
				COALESCE(pemeriksaan_ranap.suhu_tubuh, '') as suhu_tubuh,
				COALESCE(pemeriksaan_ranap.tensi, '') as tensi,
				COALESCE(pemeriksaan_ranap.nadi, '') as nadi,
				COALESCE(pemeriksaan_ranap.respirasi, '') as respirasi,
				COALESCE(pemeriksaan_ranap.tinggi, '') as tinggi,
				COALESCE(pemeriksaan_ranap.berat, '') as berat,
				COALESCE(pemeriksaan_ranap.spo2, '') as spo2,
				COALESCE(pemeriksaan_ranap.gcs, '') as gcs,
				COALESCE(pemeriksaan_ranap.kesadaran, '') as kesadaran,
				COALESCE(pemeriksaan_ranap.keluhan, '') as keluhan,
				COALESCE(pemeriksaan_ranap.pemeriksaan, '') as pemeriksaan,
				COALESCE(pemeriksaan_ranap.alergi, '') as alergi,
				COALESCE(pemeriksaan_ranap.rtl, '') as rtl,
				COALESCE(pemeriksaan_ranap.penilaian, '') as penilaian,
				COALESCE(pemeriksaan_ranap.instruksi, '') as instruksi,
				COALESCE(pemeriksaan_ranap.evaluasi, '') as evaluasi,
				pemeriksaan_ranap.nip,
				pegawai.nama,
				pegawai.jbtn
			FROM pemeriksaan_ranap
			INNER JOIN pegawai ON pemeriksaan_ranap.nip = pegawai.nik
			WHERE pemeriksaan_ranap.no_rawat = ?
			ORDER BY pemeriksaan_ranap.tgl_perawatan DESC, pemeriksaan_ranap.jam_rawat DESC
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var pemeriksaanList []PemeriksaanRanapDetail
		for rows.Next() {
			var p PemeriksaanRanapDetail
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

// ── POST /api/pemeriksaan-ranap ───────────────────────────────────────────────

type SoapRanapPayload struct {
	NoRawat      string `json:"no_rawat"`
	TglPerawatan string `json:"tgl_perawatan"`
	JamRawat     string `json:"jam_rawat"`
	SuhuTubuh    string `json:"suhu_tubuh"`
	Tensi        string `json:"tensi"`
	Nadi         string `json:"nadi"`
	Respirasi    string `json:"respirasi"`
	Tinggi       string `json:"tinggi"`
	Berat        string `json:"berat"`
	SpO2         string `json:"spo2"`
	GCS          string `json:"gcs"`
	Kesadaran    string `json:"kesadaran"`
	Keluhan      string `json:"keluhan"`
	Pemeriksaan  string `json:"pemeriksaan"`
	Alergi       string `json:"alergi"`
	RTL          string `json:"rtl"`
	Penilaian    string `json:"penilaian"`
	Instruksi    string `json:"instruksi"`
	Evaluasi     string `json:"evaluasi"`
	NIP          string `json:"nip"`
}

func savePemeriksaanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p SoapRanapPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.TglPerawatan == "" {
			p.TglPerawatan = time.Now().Format("2006-01-02")
		}
		if p.JamRawat == "" {
			p.JamRawat = time.Now().Format("15:04:05")
		}
		_, err := db.Exec(`
			INSERT INTO pemeriksaan_ranap
				(no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
				 tinggi, berat, spo2, gcs, kesadaran, keluhan, pemeriksaan, alergi,
				 rtl, penilaian, instruksi, evaluasi, nip)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			p.NoRawat, p.TglPerawatan, p.JamRawat, p.SuhuTubuh, p.Tensi, p.Nadi, p.Respirasi,
			p.Tinggi, p.Berat, p.SpO2, p.GCS, p.Kesadaran, p.Keluhan, p.Pemeriksaan, p.Alergi,
			p.RTL, p.Penilaian, p.Instruksi, p.Evaluasi, p.NIP,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "SOAP berhasil disimpan"})
	}
}

// ── PUT /api/pemeriksaan-ranap ────────────────────────────────────────────────

func updatePemeriksaanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p SoapRanapPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_, err := db.Exec(`
			UPDATE pemeriksaan_ranap SET
				suhu_tubuh=?, tensi=?, nadi=?, respirasi=?, tinggi=?, berat=?,
				spo2=?, gcs=?, kesadaran=?, keluhan=?, pemeriksaan=?, alergi=?,
				rtl=?, penilaian=?, instruksi=?, evaluasi=?, nip=?
			WHERE no_rawat=? AND tgl_perawatan=? AND jam_rawat=?`,
			p.SuhuTubuh, p.Tensi, p.Nadi, p.Respirasi, p.Tinggi, p.Berat,
			p.SpO2, p.GCS, p.Kesadaran, p.Keluhan, p.Pemeriksaan, p.Alergi,
			p.RTL, p.Penilaian, p.Instruksi, p.Evaluasi, p.NIP,
			p.NoRawat, p.TglPerawatan, p.JamRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "SOAP berhasil diupdate"})
	}
}

// ── DELETE /api/pemeriksaan-ranap ─────────────────────────────────────────────

func deletePemeriksaanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat      := c.Query("no_rawat")
		tglPerawatan := c.Query("tgl_perawatan")
		jamRawat     := c.Query("jam_rawat")
		if noRawat == "" || tglPerawatan == "" || jamRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam_rawat wajib diisi"})
			return
		}
		_, err := db.Exec(
			`DELETE FROM pemeriksaan_ranap WHERE no_rawat=? AND tgl_perawatan=? AND jam_rawat=?`,
			noRawat, tglPerawatan, jamRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "SOAP berhasil dihapus"})
	}
}
