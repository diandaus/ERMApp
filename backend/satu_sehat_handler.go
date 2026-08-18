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
	OrgID              string `json:"org_id"`
	ClientID           string `json:"client_id"`
	ClientSecret       string `json:"client_secret"`
	AuthURL            string `json:"auth_url"`
	FhirURL            string `json:"fhir_url"`
	IsProduction       bool   `json:"is_production"`
	OrthancURL         string `json:"orthanc_url"`
	OrthancWorklistDir string `json:"orthanc_worklist_dir"`
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

// ─── Referensi Praktisi & Pasien ───────────────────────────────────────────────
// Padanan SatuSehatReferensiPraktisi.java / SatuSehatReferensiPasien.java: cek
// NIK langsung ke FHIR Practitioner/Patient Satu Sehat (bukan tabel lokal, jadi
// hasil selalu real-time dari server Satu Sehat).

type ReferensiPraktisiRow struct {
	KodePraktisi string `json:"kode_praktisi"`
	NamaPraktisi string `json:"nama_praktisi"`
}

// GET /api/satu-sehat/referensi/praktisi?nik=... — persis tampil()
// SatuSehatReferensiPraktisi.java: Practitioner?identifier=.../nik|{nik},
// loop entry -> resource.name[] (satu resource bisa punya beberapa nama).
func getReferensiPraktisiSatuSehat(db *sql.DB) gin.HandlerFunc {
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

		apiURL := fmt.Sprintf("%s/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|%s", cfg.FhirURL, url.QueryEscape(nik))
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

		list := []ReferensiPraktisiRow{}
		entries, _ := result["entry"].([]interface{})
		for _, e := range entries {
			entry, _ := e.(map[string]interface{})
			resource, _ := entry["resource"].(map[string]interface{})
			if resource == nil {
				continue
			}
			id := satuSehatJSONStr(resource["id"])
			names, _ := resource["name"].([]interface{})
			for _, n := range names {
				name, _ := n.(map[string]interface{})
				text := satuSehatJSONStr(name["text"])
				if text == "" {
					continue
				}
				list = append(list, ReferensiPraktisiRow{KodePraktisi: id, NamaPraktisi: text})
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type ReferensiPasienItem struct {
	Item string `json:"item"`
	Data string `json:"data"`
}

// GET /api/satu-sehat/referensi/pasien?nik=... — persis tampil()
// SatuSehatReferensiPasien.java (via SatuSehatCekNIK): Patient?identifier=.../nik|{nik},
// diuraikan jadi daftar Item/Data. Kelurahan/Kecamatan/Kabupaten/Propinsi
// ditampilkan sebagai kode administratif mentah dari Satu Sehat — ERMApp tidak
// punya tabel padanan kode wilayah Kemendagri utk resolve jadi nama seperti di
// Khanza (villagename/districtname/cityname/provincename), jadi hanya kode yg tersedia.
func getReferensiPasienSatuSehat(db *sql.DB) gin.HandlerFunc {
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

		entries, _ := result["entry"].([]interface{})
		if len(entries) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pasien dengan NIK tersebut tidak ditemukan di Satu Sehat"})
			return
		}
		entry0, _ := entries[0].(map[string]interface{})
		resource, _ := entry0["resource"].(map[string]interface{})

		idPasien := satuSehatJSONStr(resource["id"])

		noKtp := ""
		if idents, ok := resource["identifier"].([]interface{}); ok {
			for _, it := range idents {
				m, _ := it.(map[string]interface{})
				if strings.Contains(satuSehatJSONStr(m["system"]), "nik") {
					noKtp = satuSehatJSONStr(m["value"])
					break
				}
			}
		}

		nama := ""
		if names, ok := resource["name"].([]interface{}); ok && len(names) > 0 {
			m, _ := names[0].(map[string]interface{})
			nama = satuSehatJSONStr(m["text"])
		}

		tglLahir := satuSehatJSONStr(resource["birthDate"])

		gender := satuSehatJSONStr(resource["gender"])
		switch gender {
		case "male":
			gender = "Laki-laki"
		case "female":
			gender = "Perempuan"
		}

		statusNikah := ""
		if ms, ok := resource["maritalStatus"].(map[string]interface{}); ok {
			if codings, ok := ms["coding"].([]interface{}); ok && len(codings) > 0 {
				cm, _ := codings[0].(map[string]interface{})
				statusNikah = satuSehatJSONStr(cm["display"])
				if statusNikah == "" {
					statusNikah = satuSehatJSONStr(cm["code"])
				}
			}
			if statusNikah == "" {
				statusNikah = satuSehatJSONStr(ms["text"])
			}
		}

		alamat, rt, rw, kelurahan, kecamatan, kabupaten, propinsi, kodePos := "", "", "", "", "", "", "", ""
		if addrs, ok := resource["address"].([]interface{}); ok && len(addrs) > 0 {
			am, _ := addrs[0].(map[string]interface{})
			if lines, ok := am["line"].([]interface{}); ok {
				parts := []string{}
				for _, l := range lines {
					if s := satuSehatJSONStr(l); s != "" {
						parts = append(parts, s)
					}
				}
				alamat = strings.Join(parts, ", ")
			}
			kodePos = satuSehatJSONStr(am["postalCode"])
			if exts, ok := am["extension"].([]interface{}); ok {
				for _, e := range exts {
					em, _ := e.(map[string]interface{})
					eurl := satuSehatJSONStr(em["url"])
					switch {
					case strings.Contains(eurl, "administrativeCode"):
						if subExts, ok := em["extension"].([]interface{}); ok {
							for _, se := range subExts {
								sm, _ := se.(map[string]interface{})
								sval := satuSehatJSONStr(sm["valueCode"])
								switch satuSehatJSONStr(sm["url"]) {
								case "province":
									propinsi = sval
								case "city":
									kabupaten = sval
								case "district":
									kecamatan = sval
								case "village":
									kelurahan = sval
								}
							}
						}
					case strings.HasSuffix(strings.ToLower(eurl), "/rt"):
						rt = satuSehatJSONStr(em["valueString"])
					case strings.HasSuffix(strings.ToLower(eurl), "/rw"):
						rw = satuSehatJSONStr(em["valueString"])
					}
				}
			}
		}

		noHp, email := "", ""
		if telecoms, ok := resource["telecom"].([]interface{}); ok {
			for _, t := range telecoms {
				tm, _ := t.(map[string]interface{})
				sys := satuSehatJSONStr(tm["system"])
				val := satuSehatJSONStr(tm["value"])
				if sys == "phone" && noHp == "" {
					noHp = val
				} else if sys == "email" && email == "" {
					email = val
				}
			}
		}

		list := []ReferensiPasienItem{
			{"ID Pasien", idPasien},
			{"Nomor KTP", noKtp},
			{"Nama", nama},
			{"Tanggal Lahir", tglLahir},
			{"Jenis Kelamin", gender},
			{"Status Pernikahan", statusNikah},
			{"Alamat Rumah", alamat},
			{"R.T.", rt},
			{"R.W.", rw},
			{"Kelurahan", kelurahan},
			{"Kecamatan", kecamatan},
			{"Kabupaten", kabupaten},
			{"Propinsi", propinsi},
			{"Kode P.O.S.", kodePos},
			{"Nomor HP", noHp},
			{"E-Mail", email},
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

func satuSehatJSONStr(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
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

// ============================================================================
// PENGATURAN SATU SEHAT — Mapping Organisasi. Padanan RMCariHasilRadiologi-
// style dialog (DlgMappingOrganisasiSatuSehat.java): tabel
// satu_sehat_mapping_departemen (dep_id, id_organisasi_satusehat) SUDAH ADA
// di skema (bukan tabel baru buatan ERMApp), INNER JOIN ke departemen persis
// tampil() Java — cuma departemen yang SUDAH punya mapping yang muncul di
// daftar utama; departemen yang belum di-mapping ditambahkan lewat
// "Tambah Mapping" (lihat getDepartemenBelumMappingSatuSehat).
// ============================================================================

type MappingOrganisasiRow struct {
	DepID                 string `json:"dep_id"`
	NamaDepartemen        string `json:"nama_departemen"`
	IDOrganisasiSatuSehat string `json:"id_organisasi_satusehat"`
}

// GET /api/satu-sehat/mapping-organisasi?q= — persis tampil()
// DlgMappingOrganisasiSatuSehat.java: cari di dep_id, departemen.nama,
// id_organisasi_satusehat; urut nama departemen.
func getMappingOrganisasiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				satu_sehat_mapping_departemen.dep_id,
				departemen.nama,
				satu_sehat_mapping_departemen.id_organisasi_satusehat
			FROM satu_sehat_mapping_departemen
			INNER JOIN departemen ON satu_sehat_mapping_departemen.dep_id = departemen.dep_id
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` WHERE (satu_sehat_mapping_departemen.dep_id LIKE ? OR departemen.nama LIKE ? OR satu_sehat_mapping_departemen.id_organisasi_satusehat LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw)
		}
		query += " ORDER BY departemen.nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingOrganisasiRow{}
		for rows.Next() {
			var r MappingOrganisasiRow
			if err := rows.Scan(&r.DepID, &r.NamaDepartemen, &r.IDOrganisasiSatuSehat); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/departemen-belum-mapping — daftar departemen lokal yg
// BELUM punya baris di satu_sehat_mapping_departemen, dipakai dropdown
// "Tambah Mapping" (departemen cuma ada segelintir, jadi dropdown biasa
// cukup, tidak perlu search-as-you-type spt mapping poli/dokter BPJS).
func getDepartemenBelumMappingSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT departemen.dep_id, departemen.nama
			FROM departemen
			LEFT JOIN satu_sehat_mapping_departemen ON departemen.dep_id = satu_sehat_mapping_departemen.dep_id
			WHERE satu_sehat_mapping_departemen.dep_id IS NULL
			ORDER BY departemen.nama
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type DepItem struct {
			DepID string `json:"dep_id"`
			Nama  string `json:"nama"`
		}
		list := []DepItem{}
		for rows.Next() {
			var d DepItem
			if err := rows.Scan(&d.DepID, &d.Nama); err == nil {
				list = append(list, d)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

// PUT /api/satu-sehat/mapping-organisasi/:dep_id
func saveMappingOrganisasiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		dep := c.Param("dep_id")
		var body struct {
			IDOrganisasiSatuSehat string `json:"id_organisasi_satusehat"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.IDOrganisasiSatuSehat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID Organisasi Satu Sehat wajib diisi"})
			return
		}

		// id_organisasi_satusehat UNIQUE di satu_sehat_mapping_departemen —
		// dicek eksplisit dulu (sama alasannya dgn saveMappingPoliBpjs):
		// INSERT ... ON DUPLICATE KEY UPDATE akan diam-diam meng-update
		// baris departemen LAIN yang sudah pakai ID ini kalau tidak dicegat.
		var existingDep string
		checkErr := db.QueryRow(`SELECT dep_id FROM satu_sehat_mapping_departemen WHERE id_organisasi_satusehat = ? AND dep_id != ?`, body.IDOrganisasiSatuSehat, dep).Scan(&existingDep)
		if checkErr == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "ID Organisasi " + body.IDOrganisasiSatuSehat + " sudah dipakai untuk departemen " + existingDep})
			return
		} else if checkErr != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": checkErr.Error()})
			return
		}

		_, err := db.Exec(`
			INSERT INTO satu_sehat_mapping_departemen (dep_id, id_organisasi_satusehat)
			VALUES (?, ?)
			ON DUPLICATE KEY UPDATE id_organisasi_satusehat = VALUES(id_organisasi_satusehat)
		`, dep, body.IDOrganisasiSatuSehat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping organisasi berhasil disimpan"})
	}
}

// DELETE /api/satu-sehat/mapping-organisasi/:dep_id
func deleteMappingOrganisasiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		dep := c.Param("dep_id")
		if _, err := db.Exec(`DELETE FROM satu_sehat_mapping_departemen WHERE dep_id = ?`, dep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping organisasi berhasil dihapus"})
	}
}

// ============================================================================
// PENGATURAN SATU SEHAT — Mapping Lokasi. Padanan SatuSehatMapingLokasi.java:
// 8 kategori lokasi (Poli/Ralan, Kamar/Ranap, Ruang OK, Ruang Lab PK, Ruang
// Lab PA, Ruang Lab MB, Ruang Radiologi, Depo Farmasi), tabel-tabel
// satu_sehat_mapping_lokasi_* SUDAH ADA di skema (bukan tabel baru). Tiap
// baris lokasi WAJIB terhubung ke satu_sehat_mapping_departemen via
// id_organisasi_satusehat (FK implisit, bukan dep_id langsung) — jadi
// Mapping Organisasi harus diisi dulu sebelum bisa menambah mapping lokasi.
//
// 3 kategori (Poli/Ralan, Kamar/Ranap, Depo Farmasi) terhubung ke SATU
// tabel referensi lokal (poliklinik / kamar+bangsal / bangsal) via kode
// unit — tampil() Java-nya INNER JOIN + search 4 kolom (dep_id/nama
// departemen/nama unit/kode unit). 5 kategori lain (Ruang OK/Lab PK/Lab
// PA/Lab MB/Radiologi) TIDAK terhubung ke unit lokal apa pun (lokasi
// global RS, biasanya cuma 1 baris) — tampil() Java-nya TANPA search sama
// sekali, jadi endpointnya juga tidak menerima parameter pencarian.
// ============================================================================

type MappingLokasiUnitRow struct {
	KodeUnit              string `json:"kode_unit"`
	NamaUnit              string `json:"nama_unit"`
	IDLokasiSatuSehat     string `json:"id_lokasi_satusehat"`
	Longitude             string `json:"longitude"`
	Latitude              string `json:"latitude"`
	Altitude              string `json:"altitude"`
	DepID                 string `json:"dep_id"`
	NamaDepartemen        string `json:"nama_departemen"`
	IDOrganisasiSatuSehat string `json:"id_organisasi_satusehat"`
}

type mappingLokasiUnitDef struct {
	table        string
	pkCol        string
	joinSQL      string
	kodeUnitExpr string
	namaUnitExpr string
	searchExprs  []string
	unitListSQL  string
}

// Kunci map ini dipakai sbg segmen URL (:kategori) — hardcode di Go & FE,
// bukan dari input user, jadi aman diselipkan langsung ke query string.
var mappingLokasiUnitDefs = map[string]mappingLokasiUnitDef{
	"ralan": {
		table:        "satu_sehat_mapping_lokasi_ralan",
		pkCol:        "kd_poli",
		joinSQL:      "INNER JOIN poliklinik ON satu_sehat_mapping_lokasi_ralan.kd_poli = poliklinik.kd_poli",
		kodeUnitExpr: "satu_sehat_mapping_lokasi_ralan.kd_poli",
		namaUnitExpr: "poliklinik.nm_poli",
		searchExprs:  []string{"poliklinik.nm_poli", "satu_sehat_mapping_lokasi_ralan.kd_poli"},
		unitListSQL: `
			SELECT poliklinik.kd_poli, poliklinik.nm_poli
			FROM poliklinik
			LEFT JOIN satu_sehat_mapping_lokasi_ralan ON poliklinik.kd_poli = satu_sehat_mapping_lokasi_ralan.kd_poli
			WHERE satu_sehat_mapping_lokasi_ralan.kd_poli IS NULL
			ORDER BY poliklinik.nm_poli
		`,
	},
	"ranap": {
		table:        "satu_sehat_mapping_lokasi_ranap",
		pkCol:        "kd_kamar",
		joinSQL:      "INNER JOIN kamar ON satu_sehat_mapping_lokasi_ranap.kd_kamar = kamar.kd_kamar INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal",
		kodeUnitExpr: "satu_sehat_mapping_lokasi_ranap.kd_kamar",
		namaUnitExpr: "bangsal.nm_bangsal",
		searchExprs:  []string{"bangsal.nm_bangsal", "satu_sehat_mapping_lokasi_ranap.kd_kamar"},
		unitListSQL: `
			SELECT kamar.kd_kamar, CONCAT(kamar.kd_kamar, ' - ', bangsal.nm_bangsal)
			FROM kamar
			INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			LEFT JOIN satu_sehat_mapping_lokasi_ranap ON kamar.kd_kamar = satu_sehat_mapping_lokasi_ranap.kd_kamar
			WHERE satu_sehat_mapping_lokasi_ranap.kd_kamar IS NULL
			ORDER BY bangsal.nm_bangsal, kamar.kd_kamar
		`,
	},
	"depo-farmasi": {
		table:        "satu_sehat_mapping_lokasi_depo_farmasi",
		pkCol:        "kd_bangsal",
		joinSQL:      "INNER JOIN bangsal ON satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal = bangsal.kd_bangsal",
		kodeUnitExpr: "satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal",
		namaUnitExpr: "bangsal.nm_bangsal",
		searchExprs:  []string{"bangsal.nm_bangsal", "satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal"},
		unitListSQL: `
			SELECT bangsal.kd_bangsal, bangsal.nm_bangsal
			FROM bangsal
			LEFT JOIN satu_sehat_mapping_lokasi_depo_farmasi ON bangsal.kd_bangsal = satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal
			WHERE satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal IS NULL
			ORDER BY bangsal.nm_bangsal
		`,
	},
}

// GET /api/satu-sehat/mapping-lokasi/:kategori?q=
func getMappingLokasiUnit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		def, ok := mappingLokasiUnitDefs[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := fmt.Sprintf(`
			SELECT %s, %s, %s.id_lokasi_satusehat, %s.longitude, %s.latitude, %s.altittude,
				satu_sehat_mapping_departemen.dep_id, departemen.nama, %s.id_organisasi_satusehat
			FROM %s
			%s
			INNER JOIN satu_sehat_mapping_departemen ON %s.id_organisasi_satusehat = satu_sehat_mapping_departemen.id_organisasi_satusehat
			INNER JOIN departemen ON satu_sehat_mapping_departemen.dep_id = departemen.dep_id
		`, def.kodeUnitExpr, def.namaUnitExpr, def.table, def.table, def.table, def.table, def.table, def.table, def.joinSQL, def.table)

		args := []interface{}{}
		if keyword != "" {
			conds := []string{"satu_sehat_mapping_departemen.dep_id LIKE ?", "departemen.nama LIKE ?"}
			kw := "%" + keyword + "%"
			args = append(args, kw, kw)
			for _, expr := range def.searchExprs {
				conds = append(conds, expr+" LIKE ?")
				args = append(args, kw)
			}
			query += " WHERE (" + strings.Join(conds, " OR ") + ")"
		}
		query += " ORDER BY departemen.nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingLokasiUnitRow{}
		for rows.Next() {
			var r MappingLokasiUnitRow
			if err := rows.Scan(&r.KodeUnit, &r.NamaUnit, &r.IDLokasiSatuSehat, &r.Longitude, &r.Latitude, &r.Altitude, &r.DepID, &r.NamaDepartemen, &r.IDOrganisasiSatuSehat); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/mapping-lokasi/:kategori/unit-belum-mapping
func getUnitBelumMappingLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		def, ok := mappingLokasiUnitDefs[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		rows, err := db.Query(def.unitListSQL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type UnitItem struct {
			Kode string `json:"kode"`
			Nama string `json:"nama"`
		}
		list := []UnitItem{}
		for rows.Next() {
			var u UnitItem
			if err := rows.Scan(&u.Kode, &u.Nama); err == nil {
				list = append(list, u)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

type mappingLokasiBody struct {
	IDLokasiSatuSehat     string `json:"id_lokasi_satusehat"`
	Longitude             string `json:"longitude"`
	Latitude              string `json:"latitude"`
	Altitude              string `json:"altitude"`
	IDOrganisasiSatuSehat string `json:"id_organisasi_satusehat"`
}

// cekOrganisasiSatuSehatAda — id_organisasi_satusehat di tabel lokasi TIDAK
// punya FK constraint sungguhan ke satu_sehat_mapping_departemen (cuma
// dihubungkan lewat INNER JOIN di query tampil()), jadi dicek manual di
// sini supaya staf tidak bisa menyimpan mapping lokasi yg mengacu ke ID
// organisasi yg belum pernah dibuat di Mapping Organisasi.
func cekOrganisasiSatuSehatAda(db *sql.DB, idOrganisasi string) error {
	var depCheck string
	err := db.QueryRow(`SELECT dep_id FROM satu_sehat_mapping_departemen WHERE id_organisasi_satusehat = ?`, idOrganisasi).Scan(&depCheck)
	if err == sql.ErrNoRows {
		return fmt.Errorf("ID Organisasi Satu Sehat belum ada di Mapping Organisasi — tambahkan dulu di sana")
	}
	return err
}

// PUT /api/satu-sehat/mapping-lokasi/:kategori/:kode
func saveMappingLokasiUnit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		def, ok := mappingLokasiUnitDefs[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		kode := c.Param("kode")

		var body mappingLokasiBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.IDLokasiSatuSehat) == "" || strings.TrimSpace(body.IDOrganisasiSatuSehat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID Lokasi dan Organisasi Satu Sehat wajib diisi"})
			return
		}
		if err := cekOrganisasiSatuSehatAda(db, body.IDOrganisasiSatuSehat); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// id_lokasi_satusehat UNIQUE di sebagian tabel (ralan/ranap/depo_farmasi)
		var existingKode string
		checkQuery := fmt.Sprintf(`SELECT %s FROM %s WHERE id_lokasi_satusehat = ? AND %s != ?`, def.pkCol, def.table, def.pkCol)
		checkErr := db.QueryRow(checkQuery, body.IDLokasiSatuSehat, kode).Scan(&existingKode)
		if checkErr == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "ID Lokasi " + body.IDLokasiSatuSehat + " sudah dipakai untuk " + existingKode})
			return
		} else if checkErr != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": checkErr.Error()})
			return
		}

		upsertQuery := fmt.Sprintf(`
			INSERT INTO %s (%s, id_lokasi_satusehat, longitude, latitude, altittude, id_organisasi_satusehat)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				id_lokasi_satusehat = VALUES(id_lokasi_satusehat),
				longitude = VALUES(longitude),
				latitude = VALUES(latitude),
				altittude = VALUES(altittude),
				id_organisasi_satusehat = VALUES(id_organisasi_satusehat)
		`, def.table, def.pkCol)
		if _, err := db.Exec(upsertQuery, kode, body.IDLokasiSatuSehat, body.Longitude, body.Latitude, body.Altitude, body.IDOrganisasiSatuSehat); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping lokasi berhasil disimpan"})
	}
}

// DELETE /api/satu-sehat/mapping-lokasi/:kategori/:kode
func deleteMappingLokasiUnit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		def, ok := mappingLokasiUnitDefs[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		query := fmt.Sprintf(`DELETE FROM %s WHERE %s = ?`, def.table, def.pkCol)
		if _, err := db.Exec(query, c.Param("kode")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping lokasi berhasil dihapus"})
	}
}

type MappingLokasiGlobalRow struct {
	IDLokasiSatuSehat     string `json:"id_lokasi_satusehat"`
	Longitude             string `json:"longitude"`
	Latitude              string `json:"latitude"`
	Altitude              string `json:"altitude"`
	DepID                 string `json:"dep_id"`
	NamaDepartemen        string `json:"nama_departemen"`
	IDOrganisasiSatuSehat string `json:"id_organisasi_satusehat"`
}

var mappingLokasiGlobalTables = map[string]string{
	"ruang-ok":        "satu_sehat_mapping_lokasi_ruangok",
	"ruang-lab-pk":    "satu_sehat_mapping_lokasi_ruanglab",
	"ruang-lab-pa":    "satu_sehat_mapping_lokasi_ruanglabpa",
	"ruang-lab-mb":    "satu_sehat_mapping_lokasi_ruanglabmb",
	"ruang-radiologi": "satu_sehat_mapping_lokasi_ruangrad",
}

// GET /api/satu-sehat/mapping-lokasi-global/:kategori — persis tampil()
// Java utk Ruang OK/Lab PK/Lab PA/Lab MB/Radiologi: TANPA search sama sekali.
func getMappingLokasiGlobal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		table, ok := mappingLokasiGlobalTables[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		query := fmt.Sprintf(`
			SELECT %s.id_lokasi_satusehat, %s.longitude, %s.latitude, %s.altittude,
				satu_sehat_mapping_departemen.dep_id, departemen.nama, %s.id_organisasi_satusehat
			FROM %s
			INNER JOIN satu_sehat_mapping_departemen ON %s.id_organisasi_satusehat = satu_sehat_mapping_departemen.id_organisasi_satusehat
			INNER JOIN departemen ON satu_sehat_mapping_departemen.dep_id = departemen.dep_id
		`, table, table, table, table, table, table, table)

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingLokasiGlobalRow{}
		for rows.Next() {
			var r MappingLokasiGlobalRow
			if err := rows.Scan(&r.IDLokasiSatuSehat, &r.Longitude, &r.Latitude, &r.Altitude, &r.DepID, &r.NamaDepartemen, &r.IDOrganisasiSatuSehat); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// POST /api/satu-sehat/mapping-lokasi-global/:kategori — PK-nya
// id_lokasi_satusehat sendiri (bukan kode unit lokal), jadi selalu INSERT
// baris baru, bukan upsert-by-existing-kode spt kategori unit.
func createMappingLokasiGlobal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		table, ok := mappingLokasiGlobalTables[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		var body mappingLokasiBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.IDLokasiSatuSehat) == "" || strings.TrimSpace(body.IDOrganisasiSatuSehat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID Lokasi dan Organisasi Satu Sehat wajib diisi"})
			return
		}
		if err := cekOrganisasiSatuSehatAda(db, body.IDOrganisasiSatuSehat); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		insertQuery := fmt.Sprintf(`INSERT INTO %s (id_lokasi_satusehat, longitude, latitude, altittude, id_organisasi_satusehat) VALUES (?, ?, ?, ?, ?)`, table)
		if _, err := db.Exec(insertQuery, body.IDLokasiSatuSehat, body.Longitude, body.Latitude, body.Altitude, body.IDOrganisasiSatuSehat); err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "ID Lokasi Satu Sehat sudah dipakai"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping lokasi berhasil ditambahkan"})
	}
}

// DELETE /api/satu-sehat/mapping-lokasi-global/:kategori/:id_lokasi
func deleteMappingLokasiGlobal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		table, ok := mappingLokasiGlobalTables[c.Param("kategori")]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori tidak dikenal"})
			return
		}
		query := fmt.Sprintf(`DELETE FROM %s WHERE id_lokasi_satusehat = ?`, table)
		if _, err := db.Exec(query, c.Param("id_lokasi")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping lokasi berhasil dihapus"})
	}
}

// ============================================================================
// PENGATURAN SATU SEHAT — Mapping Vaksin. Padanan
// SatuSehatMapingVaksin.java: tabel satu_sehat_mapping_vaksin SUDAH ADA di
// skema, INNER JOIN ke databarang (item obat/alkes/BHP master — 2000+ baris,
// jadi picker "Tambah" pakai search-as-you-type, BUKAN dropdown biasa spt
// Mapping Organisasi/Lokasi yg cuma segelintir opsi).
// ============================================================================

type MappingVaksinRow struct {
	VaksinCode         string `json:"vaksin_code"`
	VaksinSystem       string `json:"vaksin_system"`
	KodeBrng           string `json:"kode_brng"`
	NamaBrng           string `json:"nama_brng"`
	VaksinDisplay      string `json:"vaksin_display"`
	RouteCode          string `json:"route_code"`
	RouteSystem        string `json:"route_system"`
	RouteDisplay       string `json:"route_display"`
	DoseQuantityCode   string `json:"dose_quantity_code"`
	DoseQuantitySystem string `json:"dose_quantity_system"`
	DoseQuantityUnit   string `json:"dose_quantity_unit"`
}

// GET /api/satu-sehat/mapping-vaksin?q= — persis tampil()
// SatuSehatMapingVaksin.java: cari di kode_brng/nama_brng/vaksin_code/
// vaksin_display/route_display; urut vaksin_code.
func getMappingVaksinSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				COALESCE(satu_sehat_mapping_vaksin.vaksin_code,''),
				satu_sehat_mapping_vaksin.vaksin_system,
				satu_sehat_mapping_vaksin.kode_brng,
				databarang.nama_brng,
				COALESCE(satu_sehat_mapping_vaksin.vaksin_display,''),
				COALESCE(satu_sehat_mapping_vaksin.route_code,''),
				COALESCE(satu_sehat_mapping_vaksin.route_system,''),
				COALESCE(satu_sehat_mapping_vaksin.route_display,''),
				COALESCE(satu_sehat_mapping_vaksin.dose_quantity_code,''),
				COALESCE(satu_sehat_mapping_vaksin.dose_quantity_system,''),
				COALESCE(satu_sehat_mapping_vaksin.dose_quantity_unit,'')
			FROM satu_sehat_mapping_vaksin
			INNER JOIN databarang ON satu_sehat_mapping_vaksin.kode_brng = databarang.kode_brng
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` WHERE (satu_sehat_mapping_vaksin.kode_brng LIKE ? OR databarang.nama_brng LIKE ? OR satu_sehat_mapping_vaksin.vaksin_code LIKE ? OR satu_sehat_mapping_vaksin.vaksin_display LIKE ? OR satu_sehat_mapping_vaksin.route_display LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw, kw)
		}
		query += " ORDER BY satu_sehat_mapping_vaksin.vaksin_code"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingVaksinRow{}
		for rows.Next() {
			var r MappingVaksinRow
			if err := rows.Scan(&r.VaksinCode, &r.VaksinSystem, &r.KodeBrng, &r.NamaBrng, &r.VaksinDisplay, &r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DoseQuantityCode, &r.DoseQuantitySystem, &r.DoseQuantityUnit); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/mapping-vaksin/cari-obat?q= — search-as-you-type
// item databarang yg BELUM ada di satu_sehat_mapping_vaksin, dipakai
// picker "Tambah Mapping" (databarang 2000+ baris, tidak praktis pakai
// dropdown biasa spt Mapping Organisasi/Lokasi).
func cariObatBelumMappingVaksin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))
		if keyword == "" {
			c.JSON(http.StatusOK, gin.H{"list": []interface{}{}})
			return
		}
		rows, err := db.Query(`
			SELECT databarang.kode_brng, databarang.nama_brng
			FROM databarang
			LEFT JOIN satu_sehat_mapping_vaksin ON databarang.kode_brng = satu_sehat_mapping_vaksin.kode_brng
			WHERE satu_sehat_mapping_vaksin.kode_brng IS NULL
				AND (databarang.kode_brng LIKE ? OR databarang.nama_brng LIKE ?)
			ORDER BY databarang.nama_brng
			LIMIT 30
		`, "%"+keyword+"%", "%"+keyword+"%")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type ObatItem struct {
			KodeBrng string `json:"kode_brng"`
			NamaBrng string `json:"nama_brng"`
		}
		list := []ObatItem{}
		for rows.Next() {
			var o ObatItem
			if err := rows.Scan(&o.KodeBrng, &o.NamaBrng); err == nil {
				list = append(list, o)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

// PUT /api/satu-sehat/mapping-vaksin/:kode_brng
func saveMappingVaksinSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := c.Param("kode_brng")
		var body struct {
			VaksinCode         string `json:"vaksin_code"`
			VaksinSystem       string `json:"vaksin_system"`
			VaksinDisplay      string `json:"vaksin_display"`
			RouteCode          string `json:"route_code"`
			RouteSystem        string `json:"route_system"`
			RouteDisplay       string `json:"route_display"`
			DoseQuantityCode   string `json:"dose_quantity_code"`
			DoseQuantitySystem string `json:"dose_quantity_system"`
			DoseQuantityUnit   string `json:"dose_quantity_unit"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.VaksinCode) == "" || strings.TrimSpace(body.VaksinSystem) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Vaksin Code dan Vaksin System wajib diisi"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO satu_sehat_mapping_vaksin (
				kode_brng, vaksin_code, vaksin_system, vaksin_display,
				route_code, route_system, route_display,
				dose_quantity_code, dose_quantity_system, dose_quantity_unit
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				vaksin_code = VALUES(vaksin_code),
				vaksin_system = VALUES(vaksin_system),
				vaksin_display = VALUES(vaksin_display),
				route_code = VALUES(route_code),
				route_system = VALUES(route_system),
				route_display = VALUES(route_display),
				dose_quantity_code = VALUES(dose_quantity_code),
				dose_quantity_system = VALUES(dose_quantity_system),
				dose_quantity_unit = VALUES(dose_quantity_unit)
		`, kode, body.VaksinCode, body.VaksinSystem, body.VaksinDisplay, body.RouteCode, body.RouteSystem, body.RouteDisplay, body.DoseQuantityCode, body.DoseQuantitySystem, body.DoseQuantityUnit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping vaksin berhasil disimpan"})
	}
}

// DELETE /api/satu-sehat/mapping-vaksin/:kode_brng
func deleteMappingVaksinSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM satu_sehat_mapping_vaksin WHERE kode_brng = ?`, c.Param("kode_brng")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping vaksin berhasil dihapus"})
	}
}

// ============================================================================
// PENGATURAN SATU SEHAT — Mapping Obat/Alkes/BHP. Padanan
// SatuSehatMapingObat.java: tabel satu_sehat_mapping_obat INNER JOIN
// databarang — pola persis Mapping Vaksin (databarang 2000+ baris, picker
// "Tambah" search-as-you-type), cuma beda kolom (KFA code/system/display,
// form, numerator/denominator, route).
// ============================================================================

type MappingObatRow struct {
	ObatCode          string `json:"obat_code"`
	ObatSystem        string `json:"obat_system"`
	KodeBrng          string `json:"kode_brng"`
	NamaBrng          string `json:"nama_brng"`
	ObatDisplay       string `json:"obat_display"`
	FormCode          string `json:"form_code"`
	FormSystem        string `json:"form_system"`
	FormDisplay       string `json:"form_display"`
	NumeratorCode     string `json:"numerator_code"`
	NumeratorSystem   string `json:"numerator_system"`
	DenominatorCode   string `json:"denominator_code"`
	DenominatorSystem string `json:"denominator_system"`
	RouteCode         string `json:"route_code"`
	RouteSystem       string `json:"route_system"`
	RouteDisplay      string `json:"route_display"`
}

// GET /api/satu-sehat/mapping-obat?q= — persis tampil()
// SatuSehatMapingObat.java: cari di kode_brng/nama_brng/obat_code/
// obat_display/form_display; urut obat_code.
func getMappingObatSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				COALESCE(satu_sehat_mapping_obat.obat_code,''),
				satu_sehat_mapping_obat.obat_system,
				satu_sehat_mapping_obat.kode_brng,
				databarang.nama_brng,
				COALESCE(satu_sehat_mapping_obat.obat_display,''),
				COALESCE(satu_sehat_mapping_obat.form_code,''),
				COALESCE(satu_sehat_mapping_obat.form_system,''),
				COALESCE(satu_sehat_mapping_obat.form_display,''),
				COALESCE(satu_sehat_mapping_obat.numerator_code,''),
				COALESCE(satu_sehat_mapping_obat.numerator_system,''),
				COALESCE(satu_sehat_mapping_obat.denominator_code,''),
				COALESCE(satu_sehat_mapping_obat.denominator_system,''),
				COALESCE(satu_sehat_mapping_obat.route_code,''),
				COALESCE(satu_sehat_mapping_obat.route_system,''),
				COALESCE(satu_sehat_mapping_obat.route_display,'')
			FROM satu_sehat_mapping_obat
			INNER JOIN databarang ON satu_sehat_mapping_obat.kode_brng = databarang.kode_brng
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` WHERE (satu_sehat_mapping_obat.kode_brng LIKE ? OR databarang.nama_brng LIKE ? OR satu_sehat_mapping_obat.obat_code LIKE ? OR satu_sehat_mapping_obat.obat_display LIKE ? OR satu_sehat_mapping_obat.form_display LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw, kw)
		}
		query += " ORDER BY satu_sehat_mapping_obat.obat_code"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingObatRow{}
		for rows.Next() {
			var r MappingObatRow
			if err := rows.Scan(&r.ObatCode, &r.ObatSystem, &r.KodeBrng, &r.NamaBrng, &r.ObatDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay, &r.NumeratorCode, &r.NumeratorSystem, &r.DenominatorCode, &r.DenominatorSystem, &r.RouteCode, &r.RouteSystem, &r.RouteDisplay); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/mapping-obat/cari-obat?q= — search-as-you-type item
// databarang yg BELUM ada di satu_sehat_mapping_obat, dipakai picker
// "Tambah Mapping" (sama alasan dgn cariObatBelumMappingVaksin).
func cariBarangBelumMappingObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))
		if keyword == "" {
			c.JSON(http.StatusOK, gin.H{"list": []interface{}{}})
			return
		}
		rows, err := db.Query(`
			SELECT databarang.kode_brng, databarang.nama_brng
			FROM databarang
			LEFT JOIN satu_sehat_mapping_obat ON databarang.kode_brng = satu_sehat_mapping_obat.kode_brng
			WHERE satu_sehat_mapping_obat.kode_brng IS NULL
				AND (databarang.kode_brng LIKE ? OR databarang.nama_brng LIKE ?)
			ORDER BY databarang.nama_brng
			LIMIT 30
		`, "%"+keyword+"%", "%"+keyword+"%")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type BarangItem struct {
			KodeBrng string `json:"kode_brng"`
			NamaBrng string `json:"nama_brng"`
		}
		list := []BarangItem{}
		for rows.Next() {
			var o BarangItem
			if err := rows.Scan(&o.KodeBrng, &o.NamaBrng); err == nil {
				list = append(list, o)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

// PUT /api/satu-sehat/mapping-obat/:kode_brng
func saveMappingObatSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := c.Param("kode_brng")
		var body struct {
			ObatCode          string `json:"obat_code"`
			ObatSystem        string `json:"obat_system"`
			ObatDisplay       string `json:"obat_display"`
			FormCode          string `json:"form_code"`
			FormSystem        string `json:"form_system"`
			FormDisplay       string `json:"form_display"`
			NumeratorCode     string `json:"numerator_code"`
			NumeratorSystem   string `json:"numerator_system"`
			DenominatorCode   string `json:"denominator_code"`
			DenominatorSystem string `json:"denominator_system"`
			RouteCode         string `json:"route_code"`
			RouteSystem       string `json:"route_system"`
			RouteDisplay      string `json:"route_display"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.ObatCode) == "" || strings.TrimSpace(body.ObatSystem) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "KFA Code dan KFA System wajib diisi"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO satu_sehat_mapping_obat (
				kode_brng, obat_code, obat_system, obat_display,
				form_code, form_system, form_display,
				numerator_code, numerator_system, denominator_code, denominator_system,
				route_code, route_system, route_display
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				obat_code = VALUES(obat_code),
				obat_system = VALUES(obat_system),
				obat_display = VALUES(obat_display),
				form_code = VALUES(form_code),
				form_system = VALUES(form_system),
				form_display = VALUES(form_display),
				numerator_code = VALUES(numerator_code),
				numerator_system = VALUES(numerator_system),
				denominator_code = VALUES(denominator_code),
				denominator_system = VALUES(denominator_system),
				route_code = VALUES(route_code),
				route_system = VALUES(route_system),
				route_display = VALUES(route_display)
		`, kode, body.ObatCode, body.ObatSystem, body.ObatDisplay, body.FormCode, body.FormSystem, body.FormDisplay, body.NumeratorCode, body.NumeratorSystem, body.DenominatorCode, body.DenominatorSystem, body.RouteCode, body.RouteSystem, body.RouteDisplay)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping obat berhasil disimpan"})
	}
}

// DELETE /api/satu-sehat/mapping-obat/:kode_brng
func deleteMappingObatSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM satu_sehat_mapping_obat WHERE kode_brng = ?`, c.Param("kode_brng")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping obat berhasil dihapus"})
	}
}

// ============================================================================
// PENGATURAN SATU SEHAT — Mapping Tindakan Laboratorium PK & MB. Padanan
// SatuSehatMapingLab.java: tabel satu_sehat_mapping_lab INNER JOIN
// template_laboratorium (id_template PK/FK) — pola sama dgn Mapping Vaksin/
// Obat (template_laboratorium 2000+ baris, picker "Tambah" search-as-you-type),
// cuma id_template numeric (int) bukan varchar spt kode_brng/vaksin.
// ============================================================================

type MappingLabRow struct {
	PeriksaCode        string `json:"periksa_code"`
	PemeriksaanSystem  string `json:"pemeriksaan_system"`
	IDTemplate         int    `json:"id_template"`
	DetailPemeriksaan  string `json:"detail_pemeriksaan"`
	PemeriksaanDisplay string `json:"pemeriksaan_display"`
	SampelCode         string `json:"sampel_code"`
	SampelSystem       string `json:"sampel_system"`
	SampelDisplay      string `json:"sampel_display"`
}

// GET /api/satu-sehat/mapping-lab?q= — persis tampil() SatuSehatMapingLab.java:
// cari di id_template/Pemeriksaan/code/display; urut code.
func getMappingLabSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				COALESCE(satu_sehat_mapping_lab.code,''),
				satu_sehat_mapping_lab.system,
				satu_sehat_mapping_lab.id_template,
				template_laboratorium.Pemeriksaan,
				COALESCE(satu_sehat_mapping_lab.display,''),
				satu_sehat_mapping_lab.sampel_code,
				satu_sehat_mapping_lab.sampel_system,
				satu_sehat_mapping_lab.sampel_display
			FROM satu_sehat_mapping_lab
			INNER JOIN template_laboratorium ON satu_sehat_mapping_lab.id_template = template_laboratorium.id_template
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` WHERE (satu_sehat_mapping_lab.id_template LIKE ? OR template_laboratorium.Pemeriksaan LIKE ? OR satu_sehat_mapping_lab.code LIKE ? OR satu_sehat_mapping_lab.display LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw)
		}
		query += " ORDER BY satu_sehat_mapping_lab.code"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingLabRow{}
		for rows.Next() {
			var r MappingLabRow
			if err := rows.Scan(&r.PeriksaCode, &r.PemeriksaanSystem, &r.IDTemplate, &r.DetailPemeriksaan, &r.PemeriksaanDisplay, &r.SampelCode, &r.SampelSystem, &r.SampelDisplay); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/mapping-lab/cari-template?q= — search-as-you-type item
// template_laboratorium yg BELUM ada di satu_sehat_mapping_lab, dipakai picker
// "Tambah Mapping" (sama alasan dgn cariObatBelumMappingVaksin/cariBarangBelumMappingObat).
func cariTemplateBelumMappingLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))
		if keyword == "" {
			c.JSON(http.StatusOK, gin.H{"list": []interface{}{}})
			return
		}
		rows, err := db.Query(`
			SELECT template_laboratorium.id_template, template_laboratorium.Pemeriksaan
			FROM template_laboratorium
			LEFT JOIN satu_sehat_mapping_lab ON template_laboratorium.id_template = satu_sehat_mapping_lab.id_template
			WHERE satu_sehat_mapping_lab.id_template IS NULL
				AND (template_laboratorium.id_template LIKE ? OR template_laboratorium.Pemeriksaan LIKE ?)
			ORDER BY template_laboratorium.Pemeriksaan
			LIMIT 30
		`, "%"+keyword+"%", "%"+keyword+"%")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type TemplateItem struct {
			IDTemplate  int    `json:"id_template"`
			Pemeriksaan string `json:"pemeriksaan"`
		}
		list := []TemplateItem{}
		for rows.Next() {
			var o TemplateItem
			if err := rows.Scan(&o.IDTemplate, &o.Pemeriksaan); err == nil {
				list = append(list, o)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": list})
	}
}

// PUT /api/satu-sehat/mapping-lab/:id_template
func saveMappingLabSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idTemplate := c.Param("id_template")
		var body struct {
			Code          string `json:"code"`
			System        string `json:"system"`
			Display       string `json:"display"`
			SampelCode    string `json:"sampel_code"`
			SampelSystem  string `json:"sampel_system"`
			SampelDisplay string `json:"sampel_display"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.System) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pemeriksaan System wajib diisi"})
			return
		}
		if strings.TrimSpace(body.SampelCode) == "" || strings.TrimSpace(body.SampelSystem) == "" || strings.TrimSpace(body.SampelDisplay) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Sampel Code, Sampel System, dan Sampel Display wajib diisi"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO satu_sehat_mapping_lab (
				id_template, code, system, display, sampel_code, sampel_system, sampel_display
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				code = VALUES(code),
				system = VALUES(system),
				display = VALUES(display),
				sampel_code = VALUES(sampel_code),
				sampel_system = VALUES(sampel_system),
				sampel_display = VALUES(sampel_display)
		`, idTemplate, body.Code, body.System, body.Display, body.SampelCode, body.SampelSystem, body.SampelDisplay)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping laboratorium berhasil disimpan"})
	}
}

// DELETE /api/satu-sehat/mapping-lab/:id_template
func deleteMappingLabSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM satu_sehat_mapping_lab WHERE id_template = ?`, c.Param("id_template")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping laboratorium berhasil dihapus"})
	}
}
