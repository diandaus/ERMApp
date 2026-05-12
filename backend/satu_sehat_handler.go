package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Structs ─────────────────────────────────────────────────────────────────

type SatuSehatConfig struct {
	OrgID               string `json:"org_id"`
	ClientID            string `json:"client_id"`
	ClientSecret        string `json:"client_secret"`
	AuthURL             string `json:"auth_url"`
	FhirURL             string `json:"fhir_url"`
	IsProduction        bool   `json:"is_production"`
	OrthancURL          string `json:"orthanc_url"`
	OrthancWorklistDir  string `json:"orthanc_worklist_dir"`
}

type ImagingStudyItem struct {
	NoOrder         string                    `json:"noorder"`
	NoRawat         string                    `json:"no_rawat"`
	TglPermintaan   string                    `json:"tgl_permintaan"`
	JamPermintaan   string                    `json:"jam_permintaan"`
	NmPasien        string                    `json:"nm_pasien"`
	NoRkmMedis      string                    `json:"no_rkm_medis"`
	NmDokter        string                    `json:"nm_dokter"`
	DiagnosisKlinis string                    `json:"diagnosis_klinis"`
	Status          string                    `json:"status"`
	IDImagingStudy  *string                   `json:"id_imagingstudy"`
	IDEncounter     *string                   `json:"id_encounter"`
	Pemeriksaan     []ImagingStudyPemeriksaan `json:"pemeriksaan"`
}

type ImagingStudyPemeriksaan struct {
	KdJenisPrw      string  `json:"kd_jenis_prw"`
	NmPerawatan     string  `json:"nm_perawatan"`
	Code            *string `json:"code"`
	System          *string `json:"system"`
	Display         *string `json:"display"`
	ModalityCode    *string `json:"modality_code"`
	ModalityDisplay *string `json:"modality_display"`
}

type MappingRadiologi struct {
	KdJenisPrw      string `json:"kd_jenis_prw"`
	NmPerawatan     string `json:"nm_perawatan"`
	Code            string `json:"code"`
	System          string `json:"system"`
	Display         string `json:"display"`
	ModalityCode    string `json:"modality_code"`
	ModalityDisplay string `json:"modality_display"`
}

// ─── Config Handlers ─────────────────────────────────────────────────────────

// GET /api/satu-sehat/config
func getConfigSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getSatuSehatConfig(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		// Mask client secret
		masked := cfg
		if masked.ClientSecret != "" {
			masked.ClientSecret = "***"
		}
		c.JSON(http.StatusOK, masked)
	}
}

// POST /api/satu-sehat/config
func saveConfigSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body SatuSehatConfig
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		isProd := "0"
		if body.IsProduction {
			isProd = "1"
		}

		updates := map[string]string{
			"org_id":               body.OrgID,
			"client_id":            body.ClientID,
			"auth_url":             body.AuthURL,
			"fhir_url":             body.FhirURL,
			"is_production":        isProd,
			"orthanc_url":          body.OrthancURL,
			"orthanc_worklist_dir": body.OrthancWorklistDir,
		}
		if body.ClientSecret != "" && body.ClientSecret != "***" {
			updates["client_secret"] = body.ClientSecret
		}

		for kode, nilai := range updates {
			_, err := db.Exec(`
				INSERT INTO satu_sehat_konfigurasi (kode, nilai) VALUES (?, ?)
				ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)
			`, kode, nilai)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi: " + err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi berhasil disimpan"})
	}
}

// POST /api/satu-sehat/test-connection
func testConnectionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi belum lengkap"})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Koneksi berhasil", "token_length": len(token)})
	}
}

// GET /api/satu-sehat/patient?nik=...
func searchPatientSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIK wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		apiURL := fmt.Sprintf("%s/Patient?identifier=https://fhir.kemkes.go.id/id/nik|%s", cfg.FhirURL, url.QueryEscape(nik))
		req, _ := http.NewRequest("GET", apiURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)

		if resp.StatusCode != 200 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

// ─── ServiceRequest Radiologi ─────────────────────────────────────────────────

// POST /api/satu-sehat/servicerequest-radiologi/send/:noorder
func sendServiceRequestRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		// Ambil data order radiologi
		var (
			noRawat        string
			tglPermintaan  string
			jamPermintaan  string
			dokterPerujuk  string
			diagnosaKlinis string
			idEncounter    sql.NullString
			noRkmMedis     string
			nmPasien       string
			tglLahir       sql.NullString
			jk             sql.NullString
			nmDokter       string
			ihsNumber      sql.NullString
			ihsDokter      sql.NullString
		)
		err = db.QueryRow(`
			SELECT
				pr.no_rawat,
				pr.tgl_permintaan,
				IFNULL(pr.jam_permintaan,'00:00:00') as jam_permintaan,
				IFNULL(pr.dokter_perujuk,'') as dokter_perujuk,
				IFNULL(pr.diagnosa_klinis,'') as diagnosa_klinis,
				se.id_encounter,
				IFNULL(rp.no_rkm_medis,'') as no_rkm_medis,
				IFNULL(p.nm_pasien,'') as nm_pasien,
				p.tgl_lahir,
				p.jk,
				IFNULL(d.nm_dokter,'') as nm_dokter
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
			LEFT JOIN satu_sehat_encounter se ON se.no_rawat = pr.no_rawat
			WHERE pr.noorder = ?
		`, noOrder).Scan(&noRawat, &tglPermintaan, &jamPermintaan, &dokterPerujuk, &diagnosaKlinis,
			&idEncounter, &noRkmMedis, &nmPasien, &tglLahir, &jk, &nmDokter)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data order radiologi tidak ditemukan"})
			return
		}

		// IHS number pasien dan dokter perujuk
		db.QueryRow(`SELECT ihs_number FROM satu_sehat_pasien WHERE no_rkm_medis = ?`, noRkmMedis).Scan(&ihsNumber)
		db.QueryRow(`SELECT ihs_number FROM satu_sehat_dokter WHERE kd_dokter = ?`, dokterPerujuk).Scan(&ihsDokter)

		// Ambil daftar pemeriksaan untuk order ini
		rows, err := db.Query(`
			SELECT
				ppr.kd_jenis_prw,
				IFNULL(jpr.nm_perawatan,'') as nm_perawatan,
				IFNULL(m.code,'') as code,
				IFNULL(m.system,'') as system,
				IFNULL(m.display,'') as display
			FROM permintaan_pemeriksaan_radiologi ppr
			LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
			LEFT JOIN erm_mapping_radiologi m ON ppr.kd_jenis_prw = m.kd_jenis_prw
			WHERE ppr.noorder = ?
		`, noOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type PemeriksaanItem struct {
			KdJenisPrw  string
			NmPerawatan string
			Code        string
			System      string
			Display     string
		}
		var pemeriksaanList []PemeriksaanItem
		for rows.Next() {
			var p PemeriksaanItem
			rows.Scan(&p.KdJenisPrw, &p.NmPerawatan, &p.Code, &p.System, &p.Display)
			pemeriksaanList = append(pemeriksaanList, p)
		}
		if len(pemeriksaanList) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada pemeriksaan untuk order ini"})
			return
		}

		// ── PRE-STEP: Lazy Modify — sinkronisasi tag DICOM di Orthanc ────────
		var descList []string
		for _, p := range pemeriksaanList {
			descList = append(descList, p.NmPerawatan)
		}
		tglLahirStr := ""
		if tglLahir.Valid {
			tglLahirStr = tglLahir.String
		}
		jkStr := ""
		if jk.Valid {
			jkStr = jk.String
		}
		pacsMsg := lazyModifyPACS(db, noOrder, noRkmMedis, nmPasien, tglLahirStr, jkStr, tglPermintaan, strings.Join(descList, ", "))

		// Dapatkan token
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		jam := jamPermintaan
		if jam == "00:00:00" || jam == "" {
			jam = "08:00:00"
		}
		authoredOn := fmt.Sprintf("%sT%s+07:00", tglPermintaan, jam)

		// Kirim satu ServiceRequest per pemeriksaan
		type SendResult struct {
			KdJenisPrw       string `json:"kd_jenis_prw"`
			NmPerawatan      string `json:"nm_perawatan"`
			IDServiceRequest string `json:"id_servicerequest"`
			Error            string `json:"error,omitempty"`
		}
		results := []SendResult{}

		for _, p := range pemeriksaanList {
			// Cek apakah sudah terkirim
			var existingID sql.NullString
			db.QueryRow(`SELECT id_servicerequest FROM satu_sehat_servicerequest_radiologi WHERE noorder = ? AND kd_jenis_prw = ?`, noOrder, p.KdJenisPrw).Scan(&existingID)
			if existingID.Valid && existingID.String != "" {
				results = append(results, SendResult{KdJenisPrw: p.KdJenisPrw, NmPerawatan: p.NmPerawatan, IDServiceRequest: existingID.String})
				continue
			}

			payload := map[string]interface{}{
				"resourceType": "ServiceRequest",
				"identifier": []map[string]interface{}{
					{
						"system": fmt.Sprintf("http://sys-ids.kemkes.go.id/servicerequest/%s", cfg.OrgID),
						"value":  fmt.Sprintf("%s.%s", noOrder, p.KdJenisPrw),
					},
					{
						"system": fmt.Sprintf("http://sys-ids.kemkes.go.id/acsn/%s", cfg.OrgID),
						"value":  noOrder,
					},
				},
				"status": "active",
				"intent": "order",
				"category": []map[string]interface{}{
					{
						"coding": []map[string]interface{}{
							{
								"system":  "http://snomed.info/sct",
								"code":    "363679005",
								"display": "Imaging",
							},
						},
					},
				},
				"authoredOn": authoredOn,
			}

			// Code pemeriksaan
			if p.Code != "" {
				payload["code"] = map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": p.System, "code": p.Code, "display": p.Display},
					},
					"text": p.NmPerawatan,
				}
			} else {
				payload["code"] = map[string]interface{}{"text": p.NmPerawatan}
			}

			// Diagnosis / reason
			if diagnosaKlinis != "" && diagnosaKlinis != "-" {
				payload["reasonCode"] = []map[string]interface{}{
					{"text": diagnosaKlinis},
				}
			}

			// Subject (pasien)
			if ihsNumber.Valid && ihsNumber.String != "" {
				payload["subject"] = map[string]string{"reference": "Patient/" + ihsNumber.String}
			} else {
				payload["subject"] = map[string]string{"display": "Pasien " + noRkmMedis}
			}

			// Encounter
			if idEncounter.Valid && idEncounter.String != "" {
				payload["encounter"] = map[string]string{"reference": "Encounter/" + idEncounter.String}
			}

			// Requester (dokter perujuk)
			if ihsDokter.Valid && ihsDokter.String != "" {
				payload["requester"] = map[string]interface{}{
					"reference": "Practitioner/" + ihsDokter.String,
					"display":   nmDokter,
				}
			}

			// Performer (organisasi radiologi)
			if cfg.OrgID != "" {
				payload["performer"] = []map[string]interface{}{
					{
						"reference": "Organization/" + cfg.OrgID,
						"display":   "Ruang Radiologi",
					},
				}
			}

			payloadBytes, _ := json.Marshal(payload)
			apiURL := cfg.FhirURL + "/ServiceRequest"
			req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(payloadBytes))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)

			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				results = append(results, SendResult{KdJenisPrw: p.KdJenisPrw, NmPerawatan: p.NmPerawatan, Error: err.Error()})
				continue
			}
			respBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode != 200 && resp.StatusCode != 201 {
				results = append(results, SendResult{KdJenisPrw: p.KdJenisPrw, NmPerawatan: p.NmPerawatan, Error: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))})
				continue
			}

			var fhirResp map[string]interface{}
			json.Unmarshal(respBody, &fhirResp)
			idSR, _ := fhirResp["id"].(string)

			if idSR != "" {
				db.Exec(`
					INSERT INTO satu_sehat_servicerequest_radiologi (noorder, kd_jenis_prw, id_servicerequest)
					VALUES (?, ?, ?)
					ON DUPLICATE KEY UPDATE id_servicerequest = VALUES(id_servicerequest)
				`, noOrder, p.KdJenisPrw, idSR)
			}

			results = append(results, SendResult{KdJenisPrw: p.KdJenisPrw, NmPerawatan: p.NmPerawatan, IDServiceRequest: idSR})
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder":   noOrder,
			"pacs_sync": pacsMsg,
			"results":   results,
		})
	}
}

// GET /api/satu-sehat/servicerequest-radiologi/:noorder — cek status ServiceRequest
func getServiceRequestRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		rows, err := db.Query(`
			SELECT
				ssr.kd_jenis_prw,
				IFNULL(jpr.nm_perawatan,'') as nm_perawatan,
				IFNULL(ssr.id_servicerequest,'') as id_servicerequest
			FROM satu_sehat_servicerequest_radiologi ssr
			LEFT JOIN jns_perawatan_radiologi jpr ON ssr.kd_jenis_prw = jpr.kd_jenis_prw
			WHERE ssr.noorder = ?
		`, noOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Item struct {
			KdJenisPrw       string `json:"kd_jenis_prw"`
			NmPerawatan      string `json:"nm_perawatan"`
			IDServiceRequest string `json:"id_servicerequest"`
		}
		items := []Item{}
		for rows.Next() {
			var item Item
			rows.Scan(&item.KdJenisPrw, &item.NmPerawatan, &item.IDServiceRequest)
			items = append(items, item)
		}
		c.JSON(http.StatusOK, items)
	}
}

// ─── Monitoring Radiologi ─────────────────────────────────────────────────────

// GET /api/satu-sehat/monitoring/radiologi
func getMonitoringRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))

		rows, err := db.Query(`
			SELECT
				pr.noorder,
				pr.no_rawat,
				pr.tgl_permintaan,
				IFNULL(p.nm_pasien,'') as nm_pasien,
				IFNULL(rp.no_rkm_medis,'') as no_rkm_medis,
				IFNULL(mwl.status,'') as mwl_status,
				COUNT(DISTINCT ppr.kd_jenis_prw) as sr_total,
				COUNT(DISTINCT ssr.kd_jenis_prw) as sr_done,
				IFNULL(si.id_imagingstudy,'') as imagingstudy_id,
				IFNULL(si.status,'') as imagingstudy_status
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN satu_sehat_mwl_radiologi mwl ON mwl.noorder = pr.noorder
			LEFT JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
			LEFT JOIN satu_sehat_servicerequest_radiologi ssr
				ON ssr.noorder = ppr.noorder AND ssr.kd_jenis_prw = ppr.kd_jenis_prw
				AND ssr.id_servicerequest != ''
			LEFT JOIN satu_sehat_imagingstudy si ON si.noorder = pr.noorder
			WHERE pr.tgl_permintaan BETWEEN ? AND ?
			GROUP BY pr.noorder, pr.no_rawat, pr.tgl_permintaan, nm_pasien, no_rkm_medis,
				mwl_status, imagingstudy_id, imagingstudy_status
			ORDER BY pr.tgl_permintaan DESC, pr.noorder DESC
		`, tglDari, tglSampai)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type MonitorItem struct {
			NoOrder            string `json:"noorder"`
			NoRawat            string `json:"no_rawat"`
			TglPermintaan      string `json:"tgl_permintaan"`
			NmPasien           string `json:"nm_pasien"`
			NoRkmMedis         string `json:"no_rkm_medis"`
			MWLStatus          string `json:"mwl_status"`
			SRTotal            int    `json:"sr_total"`
			SRDone             int    `json:"sr_done"`
			ImagingStudyID     string `json:"imagingstudy_id"`
			ImagingStudyStatus string `json:"imagingstudy_status"`
		}
		type Summary struct {
			Total       int `json:"total"`
			MWLDone     int `json:"mwl_done"`
			SRDone      int `json:"sr_done"`
			ImagingDone int `json:"imaging_done"`
		}

		items := []MonitorItem{}
		sum := Summary{}
		for rows.Next() {
			var item MonitorItem
			rows.Scan(&item.NoOrder, &item.NoRawat, &item.TglPermintaan, &item.NmPasien,
				&item.NoRkmMedis, &item.MWLStatus, &item.SRTotal, &item.SRDone,
				&item.ImagingStudyID, &item.ImagingStudyStatus)
			items = append(items, item)
			sum.Total++
			if item.MWLStatus != "" {
				sum.MWLDone++
			}
			if item.SRDone > 0 && item.SRDone >= item.SRTotal {
				sum.SRDone++
			}
			if item.ImagingStudyID != "" {
				sum.ImagingDone++
			}
		}

		c.JSON(http.StatusOK, gin.H{"orders": items, "summary": sum})
	}
}

// ─── ImagingStudy ─────────────────────────────────────────────────────────────

// GET /api/satu-sehat/imaging-study
func getImagingStudyList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))
		statusFilter := c.Query("status")

		query := `
			SELECT
				pr.noorder,
				pr.no_rawat,
				pr.tgl_permintaan,
				IFNULL(pr.jam_permintaan, '') as jam_permintaan,
				IFNULL(p.nm_pasien, '') as nm_pasien,
				IFNULL(rp.no_rkm_medis, '') as no_rkm_medis,
				IFNULL(d.nm_dokter, '') as nm_dokter,
				IFNULL(pr.diagnosa_klinis, '') as diagnosis_klinis,
				IFNULL(pr.status, '') as status,
				si.id_imagingstudy,
				se.id_encounter
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
			LEFT JOIN satu_sehat_imagingstudy si ON si.noorder = pr.noorder
			LEFT JOIN satu_sehat_encounter se ON se.no_rawat = pr.no_rawat
			WHERE pr.tgl_permintaan BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}

		switch statusFilter {
		case "terkirim":
			query += " AND si.id_imagingstudy IS NOT NULL"
		case "belum":
			query += " AND si.id_imagingstudy IS NULL"
		}

		query += " ORDER BY pr.tgl_permintaan DESC, pr.noorder DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []ImagingStudyItem{}
		for rows.Next() {
			var item ImagingStudyItem
			if err := rows.Scan(
				&item.NoOrder, &item.NoRawat, &item.TglPermintaan, &item.JamPermintaan,
				&item.NmPasien, &item.NoRkmMedis, &item.NmDokter, &item.DiagnosisKlinis,
				&item.Status, &item.IDImagingStudy, &item.IDEncounter,
			); err != nil {
				continue
			}

			detailRows, err := db.Query(`
				SELECT
					ppr.kd_jenis_prw,
					IFNULL(jpr.nm_perawatan, '') as nm_perawatan,
					m.code, m.system, m.display,
					m.modality_code, m.modality_display
				FROM permintaan_pemeriksaan_radiologi ppr
				LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
				LEFT JOIN erm_mapping_radiologi m ON ppr.kd_jenis_prw = m.kd_jenis_prw
				WHERE ppr.noorder = ?
			`, item.NoOrder)
			if err == nil {
				defer detailRows.Close()
				for detailRows.Next() {
					var p ImagingStudyPemeriksaan
					detailRows.Scan(&p.KdJenisPrw, &p.NmPerawatan, &p.Code, &p.System, &p.Display, &p.ModalityCode, &p.ModalityDisplay)
					item.Pemeriksaan = append(item.Pemeriksaan, p)
				}
			}
			if item.Pemeriksaan == nil {
				item.Pemeriksaan = []ImagingStudyPemeriksaan{}
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, items)
	}
}

// POST /api/satu-sehat/imaging-study/send/:noorder
func sendImagingStudy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var item ImagingStudyItem
		var idEncounterStr string
		err = db.QueryRow(`
			SELECT
				pr.noorder, pr.no_rawat, pr.tgl_permintaan,
				IFNULL(pr.jam_permintaan, '00:00:00') as jam_permintaan,
				IFNULL(p.nm_pasien, '') as nm_pasien,
				IFNULL(rp.no_rkm_medis, '') as no_rkm_medis,
				IFNULL(se.id_encounter, '') as id_encounter
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN satu_sehat_encounter se ON se.no_rawat = pr.no_rawat
			WHERE pr.noorder = ?
		`, noOrder).Scan(
			&item.NoOrder, &item.NoRawat, &item.TglPermintaan, &item.JamPermintaan,
			&item.NmPasien, &item.NoRkmMedis, &idEncounterStr,
		)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data permintaan radiologi tidak ditemukan"})
			return
		}
		item.IDEncounter = &idEncounterStr

		// IHS number pasien
		var ihsNumber sql.NullString
		db.QueryRow(`SELECT ihs_number FROM satu_sehat_pasien WHERE no_rkm_medis = ?`, item.NoRkmMedis).Scan(&ihsNumber)

		// Pemeriksaan + modality
		detailRows, _ := db.Query(`
			SELECT ppr.kd_jenis_prw,
				IFNULL(m.modality_code, 'DX') as modality_code,
				IFNULL(m.modality_display, 'Digital Radiography') as modality_display,
				IFNULL(m.code, '') as code,
				IFNULL(m.display, '') as display
			FROM permintaan_pemeriksaan_radiologi ppr
			LEFT JOIN erm_mapping_radiologi m ON ppr.kd_jenis_prw = m.kd_jenis_prw
			WHERE ppr.noorder = ?
		`, noOrder)
		defer detailRows.Close()

		type SeriesInfo struct {
			ModalityCode    string
			ModalityDisplay string
			KdJenisPrw      string
		}
		var seriesList []SeriesInfo
		for detailRows.Next() {
			var s SeriesInfo
			var code, display string
			detailRows.Scan(&s.KdJenisPrw, &s.ModalityCode, &s.ModalityDisplay, &code, &display)
			seriesList = append(seriesList, s)
		}
		if len(seriesList) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada pemeriksaan untuk order ini"})
			return
		}

		encRef := ""
		if idEncounterStr != "" {
			encRef = "Encounter/" + idEncounterStr
		}
		patRef := ""
		if ihsNumber.Valid && ihsNumber.String != "" {
			patRef = "Patient/" + ihsNumber.String
		}

		baseUID := fmt.Sprintf("2.16.840.1.113883.%s.%s", cfg.OrgID, noOrder)

		series := []map[string]interface{}{}
		for i, s := range seriesList {
			series = append(series, map[string]interface{}{
				"uid":    fmt.Sprintf("urn:oid:%s.%d", baseUID, i+1),
				"number": i + 1,
				"modality": map[string]interface{}{
					"system":  "http://dicom.nema.org/resources/ontology/DCM",
					"code":    s.ModalityCode,
					"display": s.ModalityDisplay,
				},
				"numberOfInstances": 1,
				"instance": []map[string]interface{}{
					{
						"uid": fmt.Sprintf("urn:oid:%s.%d.1", baseUID, i+1),
						"sopClass": map[string]interface{}{
							"system": "urn:ietf:rfc:3986",
							"code":   "urn:oid:1.2.840.10008.5.1.4.1.1.1",
						},
					},
				},
			})
		}

		payload := map[string]interface{}{
			"resourceType":      "ImagingStudy",
			"status":            "available",
			"numberOfSeries":    len(series),
			"numberOfInstances": len(series),
			"series":            series,
		}
		if patRef != "" {
			payload["subject"] = map[string]string{"reference": patRef}
		}
		if encRef != "" {
			payload["encounter"] = map[string]string{"reference": encRef}
		}
		if item.TglPermintaan != "" {
			jam := item.JamPermintaan
			if jam == "00:00:00" || jam == "" {
				jam = "08:00:00"
			}
			payload["started"] = fmt.Sprintf("%sT%s+07:00", item.TglPermintaan, jam)
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		apiURL := cfg.FhirURL + "/ImagingStudy"
		req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			c.JSON(http.StatusBadGateway, gin.H{
				"error":   fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode),
				"details": string(respBody),
			})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idImagingStudy, _ := result["id"].(string)
		if idImagingStudy != "" {
			db.Exec(`
				INSERT INTO satu_sehat_imagingstudy (noorder, id_imagingstudy)
				VALUES (?, ?) ON DUPLICATE KEY UPDATE id_imagingstudy = VALUES(id_imagingstudy)
			`, noOrder, idImagingStudy)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":         "ImagingStudy berhasil dikirim",
			"id_imagingstudy": idImagingStudy,
		})
	}
}

// ─── Mapping Radiologi ────────────────────────────────────────────────────────

// GET /api/satu-sehat/mapping/radiologi
func getMappingRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT
				jpr.kd_jenis_prw,
				IFNULL(jpr.nm_perawatan, '') as nm_perawatan,
				IFNULL(m.code, '') as code,
				IFNULL(m.system, '') as system,
				IFNULL(m.display, '') as display,
				IFNULL(m.modality_code, '') as modality_code,
				IFNULL(m.modality_display, '') as modality_display
			FROM jns_perawatan_radiologi jpr
			LEFT JOIN erm_mapping_radiologi m ON jpr.kd_jenis_prw = m.kd_jenis_prw
			WHERE jpr.status = '1'
			ORDER BY jpr.kd_jenis_prw
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		results := []MappingRadiologi{}
		for rows.Next() {
			var m MappingRadiologi
			rows.Scan(&m.KdJenisPrw, &m.NmPerawatan, &m.Code, &m.System, &m.Display, &m.ModalityCode, &m.ModalityDisplay)
			results = append(results, m)
		}
		c.JSON(http.StatusOK, results)
	}
}

// PUT /api/satu-sehat/mapping/radiologi/:kd_jenis_prw
func updateMappingRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdJenisPrw := c.Param("kd_jenis_prw")
		var body MappingRadiologi
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := db.Exec(`
			INSERT INTO erm_mapping_radiologi (kd_jenis_prw, code, system, display, modality_code, modality_display)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				code = VALUES(code),
				system = VALUES(system),
				display = VALUES(display),
				modality_code = VALUES(modality_code),
				modality_display = VALUES(modality_display)
		`, kdJenisPrw, body.Code, body.System, body.Display, body.ModalityCode, body.ModalityDisplay)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping berhasil disimpan"})
	}
}

// POST /api/satu-sehat/mapping/import-khanza
// Baca satu_sehat_mapping_radiologi (tabel Khanza) lalu salin ke erm_mapping_radiologi.
// Hanya mengisi kolom code/system/display; modality_code tidak ditimpa jika sudah ada.
func importMappingFromKhanza(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT
				k.kd_jenis_prw,
				IFNULL(k.code,'') as code,
				IFNULL(k.system,'') as system,
				IFNULL(k.display,'') as display
			FROM satu_sehat_mapping_radiologi k
			WHERE k.code != '' AND k.code IS NOT NULL
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal baca tabel Khanza: " + err.Error()})
			return
		}
		defer rows.Close()

		type Row struct{ KdJenisPrw, Code, System, Display string }
		var imported, skipped int
		for rows.Next() {
			var r Row
			rows.Scan(&r.KdJenisPrw, &r.Code, &r.System, &r.Display)
			if r.Code == "" {
				skipped++
				continue
			}
			// INSERT ... ON DUPLICATE KEY: jika sudah ada, hanya update code/system/display
			// tidak menimpa modality_code/modality_display yang sudah diisi user
			_, err := db.Exec(`
				INSERT INTO erm_mapping_radiologi (kd_jenis_prw, code, system, display)
				VALUES (?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE
					code    = IF(VALUES(code) != '', VALUES(code), code),
					system  = IF(VALUES(system) != '', VALUES(system), system),
					display = IF(VALUES(display) != '', VALUES(display), display)
			`, r.KdJenisPrw, r.Code, r.System, r.Display)
			if err == nil {
				imported++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  fmt.Sprintf("Import selesai: %d prosedur diimport, %d dilewati", imported, skipped),
			"imported": imported,
			"skipped":  skipped,
		})
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func getSatuSehatConfig(db *sql.DB) (SatuSehatConfig, error) {
	var cfg SatuSehatConfig
	rows, err := db.Query(`SELECT kode, nilai FROM satu_sehat_konfigurasi`)
	if err != nil {
		return cfg, err
	}
	defer rows.Close()

	for rows.Next() {
		var kode, nilai string
		rows.Scan(&kode, &nilai)
		switch kode {
		case "org_id":
			cfg.OrgID = nilai
		case "client_id":
			cfg.ClientID = nilai
		case "client_secret":
			cfg.ClientSecret = nilai
		case "auth_url":
			cfg.AuthURL = nilai
		case "fhir_url":
			cfg.FhirURL = nilai
		case "is_production":
			cfg.IsProduction = nilai == "1"
		case "orthanc_url":
			cfg.OrthancURL = nilai
		case "orthanc_worklist_dir":
			cfg.OrthancWorklistDir = nilai
		}
	}

	if cfg.AuthURL == "" {
		cfg.AuthURL = "https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1"
	}
	if cfg.FhirURL == "" {
		cfg.FhirURL = "https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1"
	}
	return cfg, nil
}

func getSatuSehatToken(cfg SatuSehatConfig) (string, error) {
	authURL := cfg.AuthURL + "/accesstoken?grant_type=client_credentials"
	body := fmt.Sprintf("client_id=%s&client_secret=%s",
		url.QueryEscape(cfg.ClientID),
		url.QueryEscape(cfg.ClientSecret),
	)
	req, _ := http.NewRequest("POST", authURL, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	token, ok := result["access_token"].(string)
	if !ok || token == "" {
		return "", fmt.Errorf("token tidak diterima dari server")
	}
	return token, nil
}
