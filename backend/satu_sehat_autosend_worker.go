package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// satu_sehat_autosend_worker.go — worker latar belakang yang secara berkala
// (default tiap 20 detik) mengecek data yang sudah layak dikirim tapi belum
// dikirim ke Satu Sehat, lalu mengirimnya otomatis tanpa perlu klik manual di
// UI. Sengaja dibangun sbg loopback HTTP client ke endpoint /api/satu-sehat/...
// milik sendiri (bukan panggil fungsi Go secara langsung) supaya jalur kode
// yg dipakai PERSIS SAMA dgn tombol manual "Kirim" di tiap halaman — termasuk
// pencatatan error ke satu_sehat_kirim_error yg sudah ada di situ.
//
// Query "apa yg belum terkirim" dijalankan langsung ke database (lewat
// endpoint GET candidates yg sudah ada), jadi otomatis menangkap data yg
// diinput dari SIMRS Khanza (Java) maupun dari ERMApp sendiri — keduanya
// nulis ke tabel MySQL yg sama, worker ini tidak peduli siapa yg menulis.
//
// Diproses bertahap per "tahap" spy resource yg butuh prasyarat (Condition->
// ClinicalImpression, ServiceRequest->Specimen->Observation->
// DiagnosticReport) tidak dicoba sebelum prasyaratnya sendiri terkirim di
// siklus yg sama.
//
// Default OFF (baik saklar global maupun per-resource) — harus dinyalakan
// sengaja lewat tabel satu_sehat_konfigurasi (kode 'auto_send_enabled') dan
// satu_sehat_auto_send_config (kolom enabled per resource_key).

type autoSendSettings struct {
	Enabled         bool
	IntervalSeconds int
	WindowDays      int
	CooldownMinutes int
	MaxPerCycle     int
}

func getAutoSendSettings(db *sql.DB) autoSendSettings {
	s := autoSendSettings{Enabled: false, IntervalSeconds: 20, WindowDays: 3, CooldownMinutes: 15, MaxPerCycle: 50}
	rows, err := db.Query(`SELECT kode, nilai FROM satu_sehat_konfigurasi WHERE kode IN ('auto_send_enabled','auto_send_interval_detik','auto_send_window_hari','auto_send_cooldown_menit','auto_send_max_per_siklus')`)
	if err != nil {
		return s
	}
	defer rows.Close()
	for rows.Next() {
		var kode, nilai string
		rows.Scan(&kode, &nilai)
		switch kode {
		case "auto_send_enabled":
			s.Enabled = nilai == "1"
		case "auto_send_interval_detik":
			if v, err := strconv.Atoi(nilai); err == nil && v > 0 {
				s.IntervalSeconds = v
			}
		case "auto_send_window_hari":
			if v, err := strconv.Atoi(nilai); err == nil && v > 0 {
				s.WindowDays = v
			}
		case "auto_send_cooldown_menit":
			if v, err := strconv.Atoi(nilai); err == nil && v > 0 {
				s.CooldownMinutes = v
			}
		case "auto_send_max_per_siklus":
			if v, err := strconv.Atoi(nilai); err == nil && v > 0 {
				s.MaxPerCycle = v
			}
		}
	}
	return s
}

func isResourceAutoSendEnabled(db *sql.DB, resourceKey string) bool {
	var enabled int
	err := db.QueryRow(`SELECT enabled FROM satu_sehat_auto_send_config WHERE resource_key = ?`, resourceKey).Scan(&enabled)
	if err != nil {
		return false // belum ada baris = anggap belum sengaja dinyalakan
	}
	return enabled == 1
}

// inKirimErrorCooldown true kalau instance ini baru gagal dlm X menit
// terakhir — dipakai spy worker tidak coba kirim ulang data yg sama tiap
// siklus selama satu_sehat_kirim_error masih "hangat".
func inKirimErrorCooldown(db *sql.DB, resourceKey, refKey string, cooldownMinutes int) bool {
	var updatedAt time.Time
	err := db.QueryRow(`SELECT updated_at FROM satu_sehat_kirim_error WHERE resource_key = ? AND ref_key = ?`, resourceKey, refKey).Scan(&updatedAt)
	if err != nil {
		return false
	}
	return time.Since(updatedAt) < time.Duration(cooldownMinutes)*time.Minute
}

func autoSendBaseURL() string {
	addr := getEnv("APP_ADDR", ":8080")
	if strings.HasPrefix(addr, ":") {
		return "http://localhost" + addr
	}
	return "http://" + addr
}

// autoSendGetList GET ke endpoint sendiri, decode field "list" ke rows (harus
// pointer ke slice struct dgn json tag yg sesuai).
func autoSendGetList(client *http.Client, listURL string, rows interface{}) error {
	resp, err := client.Get(listURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var wrapper struct {
		List json.RawMessage `json:"list"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
		return err
	}
	return json.Unmarshal(wrapper.List, rows)
}

// autoSendPost POST ke endpoint sendiri (body nil kalau tak perlu body).
// Return true kalau berhasil (HTTP 200/201). Kegagalan SUDAH otomatis
// tercatat di satu_sehat_kirim_error oleh handler tujuan sendiri, jadi di
// sini cukup lanjut ke instance berikutnya, tidak perlu re-parse error.
func autoSendPost(client *http.Client, postURL string, body interface{}) bool {
	var reader *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader([]byte{})
	}
	req, err := http.NewRequest("POST", postURL, reader)
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[auto-send] gagal hubungi %s: %v", postURL, err)
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200 || resp.StatusCode == 201
}

// autoSendLoop kerangka umum "utk tiap baris: kalau ID kosong & tidak lagi
// cooldown, kirim" yg dipakai berulang oleh semua processXAutoSend di bawah,
// spy 22 resource tidak masing-masing menulis ulang skeleton loop yg sama.
func autoSendLoop(db *sql.DB, resourceKey string, s autoSendSettings, n int, refKeyAt func(i int) string, isUnsentAt func(i int) bool, sendAt func(i int) bool) (attempted, sent int) {
	for i := 0; i < n; i++ {
		if attempted >= s.MaxPerCycle {
			break
		}
		if !isUnsentAt(i) {
			continue
		}
		if inKirimErrorCooldown(db, resourceKey, refKeyAt(i), s.CooldownMinutes) {
			continue
		}
		attempted++
		if sendAt(i) {
			sent++
		}
		time.Sleep(300 * time.Millisecond)
	}
	return
}

func splitTglJam(combined string) (tgl, jam string) {
	parts := strings.SplitN(combined, " ", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return combined, ""
}

var observationTTVJenisList = []string{"suhu", "respirasi", "nadi", "spo2", "gcs", "kesadaran", "tensi", "tb", "bb", "lp"}
var labJenisList = []string{"pk", "mb"}

// ─── Tahap 1 — fondasi ───────────────────────────────────────────────────

func processEncounterAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "encounter"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat     string `json:"no_rawat"`
		IDEncounter string `json:"id_encounter"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/encounter?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar encounter: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat },
		func(i int) bool { return rows[i].IDEncounter == "" },
		func(i int) bool {
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/encounter/send/%s", baseURL, rows[i].NoRawat), nil)
		},
	)
}

// ─── Tahap 2 — cuma butuh Encounter ──────────────────────────────────────

func processConditionAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "condition"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat     string `json:"no_rawat"`
		KdPenyakit  string `json:"kd_penyakit"`
		IDCondition string `json:"id_condition"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/condition?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar condition: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].KdPenyakit },
		func(i int) bool { return rows[i].IDCondition == "" },
		func(i int) bool {
			body := map[string]string{"kd_penyakit": rows[i].KdPenyakit}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/condition/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processObservationTTVAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	for _, jenis := range observationTTVJenisList {
		key := "observation_ttv_" + jenis
		if !isResourceAutoSendEnabled(db, key) {
			continue
		}
		var rows []struct {
			NoRawat       string `json:"no_rawat"`
			SttsLanjut    string `json:"stts_lanjut"`
			TglPerawatan  string `json:"tgl_perawatan"`
			JamRawat      string `json:"jam_rawat"`
			IDObservation string `json:"id_observation"`
		}
		if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/observation-ttv/%s?tgl_dari=%s&tgl_sampai=%s", baseURL, jenis, dari, sampai), &rows); err != nil {
			log.Printf("[auto-send] gagal ambil daftar observation-ttv/%s: %v", jenis, err)
			continue
		}
		a, sN := autoSendLoop(db, key, s, len(rows),
			func(i int) string {
				return rows[i].NoRawat + "|" + rows[i].TglPerawatan + "|" + rows[i].JamRawat + "|" + rows[i].SttsLanjut
			},
			func(i int) bool { return rows[i].IDObservation == "" },
			func(i int) bool {
				body := map[string]string{"tgl_perawatan": rows[i].TglPerawatan, "jam_rawat": rows[i].JamRawat, "status_lanjut": rows[i].SttsLanjut}
				return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/observation-ttv/%s/send/%s", baseURL, jenis, rows[i].NoRawat), body)
			},
		)
		attempted += a
		sent += sN
	}
	return
}

func processProcedureAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "procedure"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat     string `json:"no_rawat"`
		SttsLanjut  string `json:"stts_lanjut"`
		KodeICD9    string `json:"kode_icd9"`
		IDProcedure string `json:"id_procedure"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/procedure?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar procedure: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].KodeICD9 + "|" + rows[i].SttsLanjut },
		func(i int) bool { return rows[i].IDProcedure == "" },
		func(i int) bool {
			body := map[string]string{"kode_icd9": rows[i].KodeICD9}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/procedure/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processAllergyIntoleranceAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "allergy_intolerance"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat              string `json:"no_rawat"`
		Status               string `json:"status"`
		TglPerawatan         string `json:"tgl_perawatan"`
		JamRawat             string `json:"jam_rawat"`
		IDAllergyIntolerance string `json:"id_allergy_intolerance"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/allergy-intolerance?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar allergy-intolerance: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].TglPerawatan + "|" + rows[i].JamRawat + "|" + rows[i].Status },
		func(i int) bool { return rows[i].IDAllergyIntolerance == "" },
		func(i int) bool {
			body := map[string]string{"tgl_perawatan": rows[i].TglPerawatan, "jam_rawat": rows[i].JamRawat, "status_lanjut": rows[i].Status}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/allergy-intolerance/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processMedicationDispenseAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "medication_dispense"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat       string `json:"no_rawat"`
		KodeBarang    string `json:"kode_barang"`
		NoBatch       string `json:"no_batch"`
		NoFaktur      string `json:"no_faktur"`
		TglValidasi   string `json:"tgl_validasi"`
		IDMedDispense string `json:"id_medicationdispense"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/medication-dispense?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar medication-dispense: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string {
			tgl, jam := splitTglJam(rows[i].TglValidasi)
			return rows[i].NoRawat + "|" + tgl + "|" + jam + "|" + rows[i].KodeBarang + "|" + rows[i].NoBatch + "|" + rows[i].NoFaktur
		},
		func(i int) bool { return rows[i].IDMedDispense == "" },
		func(i int) bool {
			tgl, jam := splitTglJam(rows[i].TglValidasi)
			body := map[string]string{"tgl_perawatan": tgl, "jam": jam, "kode_brng": rows[i].KodeBarang, "no_batch": rows[i].NoBatch, "no_faktur": rows[i].NoFaktur}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/medication-dispense/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processMedicationStatementAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "medication_statement"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat        string `json:"no_rawat"`
		NoResep        string `json:"no_resep"`
		KodeBarang     string `json:"kode_barang"`
		NoRacik        string `json:"no_racik"`
		IDMedStatement string `json:"id_medicationstatement"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/medication-statement?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar medication-statement: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoResep + "|" + rows[i].KodeBarang + "|" + rows[i].NoRacik },
		func(i int) bool { return rows[i].IDMedStatement == "" },
		func(i int) bool {
			body := map[string]string{"kode_brng": rows[i].KodeBarang, "no_racik": rows[i].NoRacik}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/medication-statement/send/%s", baseURL, rows[i].NoResep), body)
		},
	)
}

func processCompositionAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "composition"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat       string `json:"no_rawat"`
		Tanggal       string `json:"tanggal"`
		IDComposition string `json:"id_composition"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/composition?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar composition: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].Tanggal },
		func(i int) bool { return rows[i].IDComposition == "" },
		func(i int) bool {
			body := map[string]string{"tanggal": rows[i].Tanggal}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/composition/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processCarePlanAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "careplan"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat      string `json:"no_rawat"`
		Status       string `json:"status"`
		TglPerawatan string `json:"tgl_perawatan"`
		JamRawat     string `json:"jam_rawat"`
		IDCarePlan   string `json:"id_careplan"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/careplan?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar careplan: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].TglPerawatan + "|" + rows[i].JamRawat + "|" + rows[i].Status },
		func(i int) bool { return rows[i].IDCarePlan == "" },
		func(i int) bool {
			body := map[string]string{"tgl_perawatan": rows[i].TglPerawatan, "jam_rawat": rows[i].JamRawat, "status": rows[i].Status}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/careplan/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processEpisodeOfCareAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "episode_of_care"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat         string `json:"no_rawat"`
		KdPenyakit      string `json:"kd_penyakit"`
		Status          string `json:"status"`
		IDEpisodeOfCare string `json:"id_episodeofcare"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/episode-of-care?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar episode-of-care: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].KdPenyakit + "|" + rows[i].Status },
		func(i int) bool { return rows[i].IDEpisodeOfCare == "" },
		func(i int) bool {
			body := map[string]string{"kd_penyakit": rows[i].KdPenyakit, "status": rows[i].Status}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/episode-of-care/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processImmunizationAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "immunization"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat        string `json:"no_rawat"`
		KodeBrng       string `json:"kode_brng"`
		NoBatch        string `json:"no_batch"`
		NoFaktur       string `json:"no_faktur"`
		TglPerawatan   string `json:"tgl_perawatan"`
		Jam            string `json:"jam"`
		IDImmunization string `json:"id_immunization"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/immunization?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar immunization: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string {
			return rows[i].NoRawat + "|" + rows[i].TglPerawatan + "|" + rows[i].Jam + "|" + rows[i].KodeBrng + "|" + rows[i].NoBatch + "|" + rows[i].NoFaktur
		},
		func(i int) bool { return rows[i].IDImmunization == "" },
		func(i int) bool {
			body := map[string]string{"tgl_perawatan": rows[i].TglPerawatan, "jam": rows[i].Jam, "kode_brng": rows[i].KodeBrng, "no_batch": rows[i].NoBatch, "no_faktur": rows[i].NoFaktur}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/immunization/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

func processQuestionnaireResponseAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "questionnaire_response"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoResep string `json:"no_resep"`
		IDQR    string `json:"id_questionresponse"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/qr-telaah-farmasi?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar qr-telaah-farmasi: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoResep },
		func(i int) bool { return rows[i].IDQR == "" },
		func(i int) bool {
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/qr-telaah-farmasi/send/%s", baseURL, rows[i].NoResep), nil)
		},
	)
}

// processImagingStudyAutoSend — beda dari resource lain, GET /imaging-study
// mengembalikan array JSON polos (bukan {"list":...}), jadi tidak pakai
// autoSendGetList. Kirim-nya juga BUKAN lewat /imaging-study/send (jalur
// manual yg mengarang UID DICOM sendiri), tapi lewat /dicom/send — Orthanc
// diteruskan ke DICOM Router Satu Sehat yg resmi, spy ImagingStudy yg
// terbentuk di Satu Sehat berasal dari studi DICOM ASLI, bukan data karangan.
// Lihat ImagingStudy.tsx utk penjelasan dua jalur ini di sisi UI.
func processImagingStudyAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "imagingstudy"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoOrder        string `json:"noorder"`
		IDImagingStudy string `json:"id_imagingstudy"`
	}
	resp, err := client.Get(fmt.Sprintf("%s/api/satu-sehat/imaging-study?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai))
	if err != nil {
		log.Printf("[auto-send] gagal ambil daftar imaging-study: %v", err)
		return
	}
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		log.Printf("[auto-send] gagal decode daftar imaging-study: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoOrder },
		func(i int) bool { return rows[i].IDImagingStudy == "" },
		func(i int) bool {
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/dicom/send/%s", baseURL, rows[i].NoOrder), nil)
		},
	)
}

func processServiceRequestRadiologiAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "servicerequest_radiologi"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoOrder          string `json:"noorder"`
		KdJenisPrw       string `json:"kd_jenis_prw"`
		IDServiceRequest string `json:"id_servicerequest"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/servicerequest-radiologi-candidates?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar servicerequest-radiologi: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw },
		func(i int) bool { return rows[i].IDServiceRequest == "" },
		func(i int) bool {
			sendURL := fmt.Sprintf("%s/api/satu-sehat/servicerequest-radiologi/send/%s?kd_jenis_prw=%s", baseURL, rows[i].NoOrder, url.QueryEscape(rows[i].KdJenisPrw))
			return autoSendPost(client, sendURL, nil)
		},
	)
}

func processServiceRequestLabAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	for _, jenis := range labJenisList {
		key := "servicerequest_lab_" + jenis
		if !isResourceAutoSendEnabled(db, key) {
			continue
		}
		var rows []struct {
			NoOrder          string `json:"noorder"`
			IDTemplate       int    `json:"id_template"`
			KdJenisPrw       string `json:"kd_jenis_prw"`
			IDServiceRequest string `json:"id_servicerequest"`
		}
		if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/servicerequest-lab/%s?tgl_dari=%s&tgl_sampai=%s", baseURL, jenis, dari, sampai), &rows); err != nil {
			log.Printf("[auto-send] gagal ambil daftar servicerequest-lab/%s: %v", jenis, err)
			continue
		}
		a, sN := autoSendLoop(db, key, s, len(rows),
			func(i int) string { return rows[i].NoOrder + "|" + strconv.Itoa(rows[i].IDTemplate) + "|" + rows[i].KdJenisPrw },
			func(i int) bool { return rows[i].IDServiceRequest == "" },
			func(i int) bool {
				sendURL := fmt.Sprintf("%s/api/satu-sehat/servicerequest-lab/%s/send/%s?id_template=%d&kd_jenis_prw=%s", baseURL, jenis, rows[i].NoOrder, rows[i].IDTemplate, url.QueryEscape(rows[i].KdJenisPrw))
				return autoSendPost(client, sendURL, nil)
			},
		)
		attempted += a
		sent += sN
	}
	return
}

// ─── Tahap 3 — butuh Condition ───────────────────────────────────────────

func processClinicalImpressionAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "clinical_impression"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoRawat              string `json:"no_rawat"`
		Status               string `json:"status"`
		TglPerawatan         string `json:"tgl_perawatan"`
		JamRawat             string `json:"jam_rawat"`
		KdPenyakit           string `json:"kd_penyakit"`
		IDClinicalImpression string `json:"id_clinicalimpression"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/clinical-impression?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar clinical-impression: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoRawat + "|" + rows[i].TglPerawatan + "|" + rows[i].JamRawat + "|" + rows[i].Status },
		func(i int) bool { return rows[i].IDClinicalImpression == "" },
		func(i int) bool {
			body := map[string]string{"tgl_perawatan": rows[i].TglPerawatan, "jam_rawat": rows[i].JamRawat, "status": rows[i].Status, "kd_penyakit": rows[i].KdPenyakit}
			return autoSendPost(client, fmt.Sprintf("%s/api/satu-sehat/clinical-impression/send/%s", baseURL, rows[i].NoRawat), body)
		},
	)
}

// ─── Tahap 4 — butuh ServiceRequest ──────────────────────────────────────

func processSpecimenRadiologiAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "specimen_radiologi"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoOrder    string `json:"noorder"`
		KdJenisPrw string `json:"kd_jenis_prw"`
		IDSpecimen string `json:"id_specimen"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/specimen-radiologi?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar specimen-radiologi: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw },
		func(i int) bool { return rows[i].IDSpecimen == "" },
		func(i int) bool {
			sendURL := fmt.Sprintf("%s/api/satu-sehat/specimen-radiologi/send/%s?kd_jenis_prw=%s", baseURL, rows[i].NoOrder, url.QueryEscape(rows[i].KdJenisPrw))
			return autoSendPost(client, sendURL, nil)
		},
	)
}

func processSpecimenLabAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	for _, jenis := range labJenisList {
		key := "specimen_lab_" + jenis
		if !isResourceAutoSendEnabled(db, key) {
			continue
		}
		var rows []struct {
			NoOrder    string `json:"noorder"`
			KdJenisPrw string `json:"kd_jenis_prw"`
			IDTemplate int    `json:"id_template"`
			IDSpecimen string `json:"id_specimen"`
		}
		if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/specimen-lab/%s?tgl_dari=%s&tgl_sampai=%s", baseURL, jenis, dari, sampai), &rows); err != nil {
			log.Printf("[auto-send] gagal ambil daftar specimen-lab/%s: %v", jenis, err)
			continue
		}
		a, sN := autoSendLoop(db, key, s, len(rows),
			func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw + "|" + strconv.Itoa(rows[i].IDTemplate) },
			func(i int) bool { return rows[i].IDSpecimen == "" },
			func(i int) bool {
				sendURL := fmt.Sprintf("%s/api/satu-sehat/specimen-lab/%s/send/%s?id_template=%d&kd_jenis_prw=%s", baseURL, jenis, rows[i].NoOrder, rows[i].IDTemplate, url.QueryEscape(rows[i].KdJenisPrw))
				return autoSendPost(client, sendURL, nil)
			},
		)
		attempted += a
		sent += sN
	}
	return
}

// ─── Tahap 5 — butuh Specimen ────────────────────────────────────────────

func processObservationRadiologiAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "observation_radiologi"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoOrder       string `json:"noorder"`
		KdJenisPrw    string `json:"kd_jenis_prw"`
		IDObservation string `json:"id_observation"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/observation-radiologi?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar observation-radiologi: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw },
		func(i int) bool { return rows[i].IDObservation == "" },
		func(i int) bool {
			sendURL := fmt.Sprintf("%s/api/satu-sehat/observation-radiologi/send/%s?kd_jenis_prw=%s", baseURL, rows[i].NoOrder, url.QueryEscape(rows[i].KdJenisPrw))
			return autoSendPost(client, sendURL, nil)
		},
	)
}

func processObservationLabAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	for _, jenis := range labJenisList {
		key := "observation_lab_" + jenis
		if !isResourceAutoSendEnabled(db, key) {
			continue
		}
		var rows []struct {
			NoOrder       string `json:"noorder"`
			KdJenisPrw    string `json:"kd_jenis_prw"`
			IDTemplate    int    `json:"id_template"`
			IDObservation string `json:"id_observation"`
		}
		if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/observation-lab/%s?tgl_dari=%s&tgl_sampai=%s", baseURL, jenis, dari, sampai), &rows); err != nil {
			log.Printf("[auto-send] gagal ambil daftar observation-lab/%s: %v", jenis, err)
			continue
		}
		a, sN := autoSendLoop(db, key, s, len(rows),
			func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw + "|" + strconv.Itoa(rows[i].IDTemplate) },
			func(i int) bool { return rows[i].IDObservation == "" },
			func(i int) bool {
				sendURL := fmt.Sprintf("%s/api/satu-sehat/observation-lab/%s/send/%s?id_template=%d&kd_jenis_prw=%s", baseURL, jenis, rows[i].NoOrder, rows[i].IDTemplate, url.QueryEscape(rows[i].KdJenisPrw))
				return autoSendPost(client, sendURL, nil)
			},
		)
		attempted += a
		sent += sN
	}
	return
}

// ─── Tahap 6 — butuh Observation ─────────────────────────────────────────

func processDiagnosticReportRadiologiAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	const key = "diagnosticreport_radiologi"
	if !isResourceAutoSendEnabled(db, key) {
		return
	}
	var rows []struct {
		NoOrder            string `json:"noorder"`
		KdJenisPrw         string `json:"kd_jenis_prw"`
		IDDiagnosticReport string `json:"id_diagnosticreport"`
	}
	if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/diagnosticreport-radiologi?tgl_dari=%s&tgl_sampai=%s", baseURL, dari, sampai), &rows); err != nil {
		log.Printf("[auto-send] gagal ambil daftar diagnosticreport-radiologi: %v", err)
		return
	}
	return autoSendLoop(db, key, s, len(rows),
		func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw },
		func(i int) bool { return rows[i].IDDiagnosticReport == "" },
		func(i int) bool {
			sendURL := fmt.Sprintf("%s/api/satu-sehat/diagnosticreport-radiologi/send/%s?kd_jenis_prw=%s", baseURL, rows[i].NoOrder, url.QueryEscape(rows[i].KdJenisPrw))
			return autoSendPost(client, sendURL, nil)
		},
	)
}

func processDiagnosticReportLabAutoSend(db *sql.DB, client *http.Client, baseURL, dari, sampai string, s autoSendSettings) (attempted, sent int) {
	for _, jenis := range labJenisList {
		key := "diagnosticreport_lab_" + jenis
		if !isResourceAutoSendEnabled(db, key) {
			continue
		}
		var rows []struct {
			NoOrder            string `json:"noorder"`
			KdJenisPrw         string `json:"kd_jenis_prw"`
			IDTemplate         int    `json:"id_template"`
			IDDiagnosticReport string `json:"id_diagnosticreport"`
		}
		if err := autoSendGetList(client, fmt.Sprintf("%s/api/satu-sehat/diagnosticreport-lab/%s?tgl_dari=%s&tgl_sampai=%s", baseURL, jenis, dari, sampai), &rows); err != nil {
			log.Printf("[auto-send] gagal ambil daftar diagnosticreport-lab/%s: %v", jenis, err)
			continue
		}
		a, sN := autoSendLoop(db, key, s, len(rows),
			func(i int) string { return rows[i].NoOrder + "|" + rows[i].KdJenisPrw + "|" + strconv.Itoa(rows[i].IDTemplate) },
			func(i int) bool { return rows[i].IDDiagnosticReport == "" },
			func(i int) bool {
				sendURL := fmt.Sprintf("%s/api/satu-sehat/diagnosticreport-lab/%s/send/%s?id_template=%d&kd_jenis_prw=%s", baseURL, jenis, rows[i].NoOrder, rows[i].IDTemplate, url.QueryEscape(rows[i].KdJenisPrw))
				return autoSendPost(client, sendURL, nil)
			},
		)
		attempted += a
		sent += sN
	}
	return
}

// ─── Loop utama ───────────────────────────────────────────────────────────

// startSatuSehatAutoSendWorker dipanggil sekali dari main() sbg goroutine
// terpisah (`go startSatuSehatAutoSendWorker(db)`). Berjalan selamanya,
// membaca ulang pengaturan tiap siklus (jadi perubahan saklar/interval di DB
// langsung berlaku di siklus berikutnya, tanpa perlu restart backend).
func startSatuSehatAutoSendWorker(db *sql.DB) {
	baseURL := autoSendBaseURL()
	client := &http.Client{Timeout: 60 * time.Second}
	log.Printf("[auto-send] worker dimulai, base URL: %s", baseURL)

	for {
		s := getAutoSendSettings(db)
		if s.Enabled {
			runAutoSendCycleSafe(db, client, baseURL, s)
		}
		time.Sleep(time.Duration(s.IntervalSeconds) * time.Second)
	}
}

func runAutoSendCycleSafe(db *sql.DB, client *http.Client, baseURL string, s autoSendSettings) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[auto-send] panic tertangkap dlm satu siklus, dilewati: %v", r)
		}
	}()
	runAutoSendCycle(db, client, baseURL, s)
}

func runAutoSendCycle(db *sql.DB, client *http.Client, baseURL string, s autoSendSettings) {
	sampai := time.Now().Format("2006-01-02")
	dari := time.Now().AddDate(0, 0, -s.WindowDays).Format("2006-01-02")

	totalAttempted, totalSent := 0, 0
	stage := func(fn func() (int, int)) {
		a, sN := fn()
		totalAttempted += a
		totalSent += sN
	}

	// Tahap 1
	stage(func() (int, int) { return processEncounterAutoSend(db, client, baseURL, dari, sampai, s) })

	// Tahap 2 (butuh Encounter)
	stage(func() (int, int) { return processConditionAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processObservationTTVAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processProcedureAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processAllergyIntoleranceAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processMedicationDispenseAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processMedicationStatementAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processCompositionAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processCarePlanAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processEpisodeOfCareAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processImmunizationAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processQuestionnaireResponseAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processImagingStudyAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processServiceRequestRadiologiAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processServiceRequestLabAutoSend(db, client, baseURL, dari, sampai, s) })

	// Tahap 3 (butuh Condition)
	stage(func() (int, int) { return processClinicalImpressionAutoSend(db, client, baseURL, dari, sampai, s) })

	// Tahap 4 (butuh ServiceRequest)
	stage(func() (int, int) { return processSpecimenRadiologiAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processSpecimenLabAutoSend(db, client, baseURL, dari, sampai, s) })

	// Tahap 5 (butuh Specimen)
	stage(func() (int, int) { return processObservationRadiologiAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processObservationLabAutoSend(db, client, baseURL, dari, sampai, s) })

	// Tahap 6 (butuh Observation)
	stage(func() (int, int) { return processDiagnosticReportRadiologiAutoSend(db, client, baseURL, dari, sampai, s) })
	stage(func() (int, int) { return processDiagnosticReportLabAutoSend(db, client, baseURL, dari, sampai, s) })

	if totalAttempted > 0 {
		log.Printf("[auto-send] siklus selesai: %d dicoba, %d berhasil terkirim", totalAttempted, totalSent)
	}
}
