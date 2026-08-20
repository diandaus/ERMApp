package main

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// satu_sehat_autosend_handler.go — endpoint pengaturan utk worker kirim
// otomatis (satu_sehat_autosend_worker.go): baca/ubah saklar global +
// tuning params (satu_sehat_konfigurasi) dan saklar per-resource
// (satu_sehat_auto_send_config), dipakai halaman "Kirim Otomatis" di UI.

type autoSendResourceMeta struct {
	Label string
	Group string
}

// autoSendResourceMetaMap — label & grup PERSIS sama dgn PipelineItem di
// satu_sehat_pipeline_handler.go, supaya konsisten dgn tampilan Perjalanan
// Pasien.
var autoSendResourceMetaMap = map[string]autoSendResourceMeta{
	"encounter":                  {"Encounter (Kedatangan Pasien)", "utama"},
	"condition":                  {"Condition (Diagnosa)", "utama"},
	"procedure":                  {"Procedure (Tindakan)", "utama"},
	"allergy_intolerance":        {"AllergyIntolerance (Alergi)", "utama"},
	"medication_dispense":        {"MedicationDispense (Penyerahan Obat)", "utama"},
	"medication_statement":       {"MedicationStatement (Resep Dokter)", "utama"},
	"clinical_impression":        {"ClinicalImpression (Penilaian Klinis)", "utama"},
	"composition":                {"Composition (Asuhan Gizi/Diet)", "utama"},
	"careplan":                   {"CarePlan (Rencana Tindak Lanjut)", "utama"},
	"episode_of_care":            {"EpisodeOfCare (Antenatal Care)", "utama"},
	"immunization":               {"Immunization (Vaksinasi)", "utama"},
	"questionnaire_response":     {"QuestionnaireResponse (Telaah Resep Farmasi)", "utama"},
	"observation_ttv_suhu":       {"Observation TTV - Suhu (°C)", "observasi_ttv"},
	"observation_ttv_respirasi":  {"Observation TTV - Resp(/menit)", "observasi_ttv"},
	"observation_ttv_nadi":       {"Observation TTV - Nadi(/menit)", "observasi_ttv"},
	"observation_ttv_spo2":       {"Observation TTV - SpO2(%)", "observasi_ttv"},
	"observation_ttv_gcs":        {"Observation TTV - GCS", "observasi_ttv"},
	"observation_ttv_kesadaran":  {"Observation TTV - Kesadaran", "observasi_ttv"},
	"observation_ttv_tensi":      {"Observation TTV - Tensi(mmHg)", "observasi_ttv"},
	"observation_ttv_tb":         {"Observation TTV - TB(Cm)", "observasi_ttv"},
	"observation_ttv_bb":         {"Observation TTV - BB(Kg)", "observasi_ttv"},
	"observation_ttv_lp":         {"Observation TTV - LP(Cm)", "observasi_ttv"},
	"servicerequest_radiologi":   {"ServiceRequest Radiologi", "radiologi"},
	"specimen_radiologi":         {"Specimen Radiologi", "radiologi"},
	"observation_radiologi":      {"Observation Radiologi", "radiologi"},
	"diagnosticreport_radiologi": {"DiagnosticReport Radiologi", "radiologi"},
	"imagingstudy":               {"ImagingStudy", "radiologi"},
	"servicerequest_lab_pk":      {"ServiceRequest Lab Patologi Klinik", "lab_pk"},
	"specimen_lab_pk":            {"Specimen Lab Patologi Klinik", "lab_pk"},
	"observation_lab_pk":         {"Observation Lab Patologi Klinik", "lab_pk"},
	"diagnosticreport_lab_pk":    {"DiagnosticReport Lab Patologi Klinik", "lab_pk"},
	"servicerequest_lab_mb":      {"ServiceRequest Lab Mikrobiologi", "lab_mb"},
	"specimen_lab_mb":            {"Specimen Lab Mikrobiologi", "lab_mb"},
	"observation_lab_mb":         {"Observation Lab Mikrobiologi", "lab_mb"},
	"diagnosticreport_lab_mb":    {"DiagnosticReport Lab Mikrobiologi", "lab_mb"},
}

// GET /api/satu-sehat/auto-send/settings
func getAutoSendSettingsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		s := getAutoSendSettings(db)

		rows, err := db.Query(`SELECT resource_key, enabled FROM satu_sehat_auto_send_config`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type resourceItem struct {
			ResourceKey string `json:"resource_key"`
			Label       string `json:"label"`
			Group       string `json:"group"`
			Enabled     bool   `json:"enabled"`
		}
		items := []resourceItem{}
		for rows.Next() {
			var key string
			var enabled int
			if err := rows.Scan(&key, &enabled); err != nil {
				continue
			}
			meta := autoSendResourceMetaMap[key]
			items = append(items, resourceItem{ResourceKey: key, Label: meta.Label, Group: meta.Group, Enabled: enabled == 1})
		}

		c.JSON(http.StatusOK, gin.H{
			"enabled":        s.Enabled,
			"interval_detik": s.IntervalSeconds,
			"window_hari":    s.WindowDays,
			"cooldown_menit": s.CooldownMinutes,
			"max_per_siklus": s.MaxPerCycle,
			"resources":      items,
		})
	}
}

// PUT /api/satu-sehat/auto-send/settings — body {enabled, interval_detik,
// window_hari, cooldown_menit, max_per_siklus}.
func updateAutoSendSettingsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Enabled       bool `json:"enabled"`
			IntervalDetik int  `json:"interval_detik"`
			WindowHari    int  `json:"window_hari"`
			CooldownMenit int  `json:"cooldown_menit"`
			MaxPerSiklus  int  `json:"max_per_siklus"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if body.IntervalDetik <= 0 || body.WindowHari <= 0 || body.CooldownMenit <= 0 || body.MaxPerSiklus <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Semua parameter angka harus lebih besar dari 0"})
			return
		}

		enabledVal := "0"
		if body.Enabled {
			enabledVal = "1"
		}
		kv := map[string]string{
			"auto_send_enabled":        enabledVal,
			"auto_send_interval_detik": strconv.Itoa(body.IntervalDetik),
			"auto_send_window_hari":    strconv.Itoa(body.WindowHari),
			"auto_send_cooldown_menit": strconv.Itoa(body.CooldownMenit),
			"auto_send_max_per_siklus": strconv.Itoa(body.MaxPerSiklus),
		}
		for kode, nilai := range kv {
			if _, err := db.Exec(`
				INSERT INTO satu_sehat_konfigurasi (kode, nilai) VALUES (?, ?)
				ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)
			`, kode, nilai); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan kirim otomatis disimpan"})
	}
}

// PUT /api/satu-sehat/auto-send/resource/:resource_key — body {enabled}.
func updateAutoSendResourceHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		resourceKey := c.Param("resource_key")
		if _, ok := autoSendResourceMetaMap[resourceKey]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "resource_key tidak dikenal"})
			return
		}
		var body struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		enabledVal := 0
		if body.Enabled {
			enabledVal = 1
		}
		if _, err := db.Exec(`
			INSERT INTO satu_sehat_auto_send_config (resource_key, enabled) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
		`, resourceKey, enabledVal); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Tersimpan"})
	}
}

// PUT /api/satu-sehat/auto-send/resource-group/:group — body {enabled},
// nyalakan/matikan semua resource dlm satu grup sekaligus (tombol "Aktifkan
// Semua"/"Nonaktifkan Semua" per grup di UI).
func updateAutoSendResourceGroupHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		group := c.Param("group")
		var body struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		enabledVal := 0
		if body.Enabled {
			enabledVal = 1
		}
		count := 0
		for key, meta := range autoSendResourceMetaMap {
			if meta.Group != group {
				continue
			}
			if _, err := db.Exec(`
				INSERT INTO satu_sehat_auto_send_config (resource_key, enabled) VALUES (?, ?)
				ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
			`, key, enabledVal); err == nil {
				count++
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Tersimpan", "count": count})
	}
}
