package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// ASUHAN MEDIS IGD ENDPOINT
// ============================================================================

// AsuhanMedisIGDDetail represents detailed asuhan medis IGD data
type AsuhanMedisIGDDetail struct {
	Tanggal      string `json:"tanggal"`
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	Anamnesis    string `json:"anamnesis"`
	Hubungan     string `json:"hubungan"`
	KeluhanUtama string `json:"keluhan_utama"`
	RPS          string `json:"rps"`
	RPK          string `json:"rpk"`
	RPD          string `json:"rpd"`
	RPO          string `json:"rpo"`
	Alergi       string `json:"alergi"`
	Keadaan      string `json:"keadaan"`
	GCS          string `json:"gcs"`
	Kesadaran    string `json:"kesadaran"`
	TD           string `json:"td"`
	Nadi         string `json:"nadi"`
	RR           string `json:"rr"`
	Suhu         string `json:"suhu"`
	SpO          string `json:"spo"`
	BB           string `json:"bb"`
	TB           string `json:"tb"`
	Kepala       string `json:"kepala"`
	Mata         string `json:"mata"`
	Gigi         string `json:"gigi"`
	Leher        string `json:"leher"`
	Thoraks      string `json:"thoraks"`
	Abdomen      string `json:"abdomen"`
	Ekstremitas  string `json:"ekstremitas"`
	Genital      string `json:"genital"`
	KetFisik     string `json:"ket_fisik"`
	KetLokalis   string `json:"ket_lokalis"`
	EKG          string `json:"ekg"`
	Rad          string `json:"rad"`
	Lab          string `json:"lab"`
	Diagnosis    string `json:"diagnosis"`
	Tata         string `json:"tata"`
}

// getAsuhanMedisIGD returns asuhan medis IGD data for a given no_rawat
func getAsuhanMedisIGD(db *sql.DB) gin.HandlerFunc {
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
			DATE_FORMAT(penilaian_medis_igd.tanggal, '%d/%m/%Y %H:%i:%s') as tanggal,
			penilaian_medis_igd.kd_dokter,
				penilaian_medis_igd.anamnesis,
				COALESCE(penilaian_medis_igd.hubungan, '') as hubungan,
				COALESCE(penilaian_medis_igd.keluhan_utama, '') as keluhan_utama,
				COALESCE(penilaian_medis_igd.rps, '') as rps,
				COALESCE(penilaian_medis_igd.rpk, '') as rpk,
				COALESCE(penilaian_medis_igd.rpd, '') as rpd,
				COALESCE(penilaian_medis_igd.rpo, '') as rpo,
				COALESCE(penilaian_medis_igd.alergi, '') as alergi,
				COALESCE(penilaian_medis_igd.keadaan, '') as keadaan,
				COALESCE(penilaian_medis_igd.gcs, '') as gcs,
				COALESCE(penilaian_medis_igd.kesadaran, '') as kesadaran,
				COALESCE(penilaian_medis_igd.td, '') as td,
				COALESCE(penilaian_medis_igd.nadi, '') as nadi,
				COALESCE(penilaian_medis_igd.rr, '') as rr,
				COALESCE(penilaian_medis_igd.suhu, '') as suhu,
				COALESCE(penilaian_medis_igd.spo, '') as spo,
				COALESCE(penilaian_medis_igd.bb, '') as bb,
				COALESCE(penilaian_medis_igd.tb, '') as tb,
				COALESCE(penilaian_medis_igd.kepala, '') as kepala,
				COALESCE(penilaian_medis_igd.mata, '') as mata,
				COALESCE(penilaian_medis_igd.gigi, '') as gigi,
				COALESCE(penilaian_medis_igd.leher, '') as leher,
				COALESCE(penilaian_medis_igd.thoraks, '') as thoraks,
				COALESCE(penilaian_medis_igd.abdomen, '') as abdomen,
				COALESCE(penilaian_medis_igd.ekstremitas, '') as ekstremitas,
				COALESCE(penilaian_medis_igd.genital, '') as genital,
				COALESCE(penilaian_medis_igd.ket_fisik, '') as ket_fisik,
				COALESCE(penilaian_medis_igd.ket_lokalis, '') as ket_lokalis,
				COALESCE(penilaian_medis_igd.ekg, '') as ekg,
				COALESCE(penilaian_medis_igd.rad, '') as rad,
				COALESCE(penilaian_medis_igd.lab, '') as lab,
				COALESCE(penilaian_medis_igd.diagnosis, '') as diagnosis,
				COALESCE(penilaian_medis_igd.tata, '') as tata,
				dokter.nm_dokter
			FROM penilaian_medis_igd
			INNER JOIN dokter ON penilaian_medis_igd.kd_dokter = dokter.kd_dokter
			WHERE penilaian_medis_igd.no_rawat = ?
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var asuhanList []AsuhanMedisIGDDetail
		for rows.Next() {
			var asuhan AsuhanMedisIGDDetail
			err := rows.Scan(
				&asuhan.Tanggal,
				&asuhan.KdDokter,
				&asuhan.Anamnesis,
				&asuhan.Hubungan,
				&asuhan.KeluhanUtama,
				&asuhan.RPS,
				&asuhan.RPK,
				&asuhan.RPD,
				&asuhan.RPO,
				&asuhan.Alergi,
				&asuhan.Keadaan,
				&asuhan.GCS,
				&asuhan.Kesadaran,
				&asuhan.TD,
				&asuhan.Nadi,
				&asuhan.RR,
				&asuhan.Suhu,
				&asuhan.SpO,
				&asuhan.BB,
				&asuhan.TB,
				&asuhan.Kepala,
				&asuhan.Mata,
				&asuhan.Gigi,
				&asuhan.Leher,
				&asuhan.Thoraks,
				&asuhan.Abdomen,
				&asuhan.Ekstremitas,
				&asuhan.Genital,
				&asuhan.KetFisik,
				&asuhan.KetLokalis,
				&asuhan.EKG,
				&asuhan.Rad,
				&asuhan.Lab,
				&asuhan.Diagnosis,
				&asuhan.Tata,
				&asuhan.NmDokter,
			)
			if err != nil {
				continue
			}
			asuhanList = append(asuhanList, asuhan)
		}

		c.JSON(http.StatusOK, asuhanList)
	}
}

// saveAsuhanMedisIGDRequest — field & urutan PERSIS simpan() di
// RMPenilaianAwalMedisIGD.java (Sequel.menyimpantf ke tabel
// penilaian_medis_igd, 36 kolom termasuk no_rawat). no_rawat PRIMARY KEY
// (tanpa upsert di Java — BtnSimpan utk baru, BtnEdit/ganti() terpisah utk
// koreksi baris yg sudah ada; endpoint ini padanan BtnSimpan/simpan() SAJA,
// jadi kirim balik error jelas kalau no_rawat sudah py data sebelumnya).
type saveAsuhanMedisIGDRequest struct {
	NoRawat      string `json:"no_rawat" binding:"required"`
	Tanggal      string `json:"tanggal" binding:"required"`
	KdDokter     string `json:"kd_dokter" binding:"required"`
	Anamnesis    string `json:"anamnesis" binding:"required"`
	Hubungan     string `json:"hubungan"`
	KeluhanUtama string `json:"keluhan_utama" binding:"required"`
	RPS          string `json:"rps" binding:"required"`
	RPD          string `json:"rpd" binding:"required"`
	RPK          string `json:"rpk" binding:"required"`
	RPO          string `json:"rpo" binding:"required"`
	Alergi       string `json:"alergi"`
	Keadaan      string `json:"keadaan" binding:"required"`
	GCS          string `json:"gcs"`
	Kesadaran    string `json:"kesadaran" binding:"required"`
	TD           string `json:"td"`
	Nadi         string `json:"nadi"`
	RR           string `json:"rr"`
	Suhu         string `json:"suhu"`
	SpO          string `json:"spo"`
	BB           string `json:"bb"`
	TB           string `json:"tb"`
	Kepala       string `json:"kepala" binding:"required"`
	Mata         string `json:"mata" binding:"required"`
	Gigi         string `json:"gigi" binding:"required"`
	Leher        string `json:"leher" binding:"required"`
	Thoraks      string `json:"thoraks" binding:"required"`
	Abdomen      string `json:"abdomen" binding:"required"`
	Genital      string `json:"genital" binding:"required"`
	Ekstremitas  string `json:"ekstremitas" binding:"required"`
	KetFisik     string `json:"ket_fisik"`
	KetLokalis   string `json:"ket_lokalis"`
	EKG          string `json:"ekg"`
	Rad          string `json:"rad"`
	Lab          string `json:"lab"`
	Diagnosis    string `json:"diagnosis"`
	Tata         string `json:"tata"`
}

// saveAsuhanMedisIGD — POST /api/asuhan-medis-igd/simpan, padanan
// BtnSimpanActionPerformed -> simpan() di RMPenilaianAwalMedisIGD.java.
func saveAsuhanMedisIGD(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req saveAsuhanMedisIGDRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
			return
		}

		_, err := db.Exec(`
			INSERT INTO penilaian_medis_igd (
				no_rawat, tanggal, kd_dokter, anamnesis, hubungan, keluhan_utama, rps, rpd, rpk, rpo, alergi,
				keadaan, gcs, kesadaran, td, nadi, rr, suhu, spo, bb, tb,
				kepala, mata, gigi, leher, thoraks, abdomen, genital, ekstremitas,
				ket_fisik, ket_lokalis, ekg, rad, lab, diagnosis, tata
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			req.NoRawat, req.Tanggal, req.KdDokter, req.Anamnesis, req.Hubungan, req.KeluhanUtama, req.RPS, req.RPD, req.RPK, req.RPO, req.Alergi,
			req.Keadaan, req.GCS, req.Kesadaran, req.TD, req.Nadi, req.RR, req.Suhu, req.SpO, req.BB, req.TB,
			req.Kepala, req.Mata, req.Gigi, req.Leher, req.Thoraks, req.Abdomen, req.Genital, req.Ekstremitas,
			req.KetFisik, req.KetLokalis, req.EKG, req.Rad, req.Lab, req.Diagnosis, req.Tata,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Data awal medis untuk kunjungan ini sudah tersimpan sebelumnya."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Awal medis berhasil disimpan"})
	}
}
