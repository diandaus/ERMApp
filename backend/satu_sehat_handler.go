package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
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
	OrthancUser        string `json:"orthanc_user"`
	OrthancPass        string `json:"orthanc_pass"`
	DicomRouterName    string `json:"dicom_router_name"`
	DicomRouterHost    string `json:"dicom_router_host"`
	DicomRouterPort    string `json:"dicom_router_port"`
	DicomRouterAET     string `json:"dicom_router_aet"`
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
		// Mask secret-ish fields
		masked := cfg
		if masked.ClientSecret != "" {
			masked.ClientSecret = "***"
		}
		if masked.OrthancPass != "" {
			masked.OrthancPass = "***"
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
			"org_id":            body.OrgID,
			"client_id":         body.ClientID,
			"auth_url":          body.AuthURL,
			"fhir_url":          body.FhirURL,
			"is_production":     isProd,
			"orthanc_url":       body.OrthancURL,
			"orthanc_user":      body.OrthancUser,
			"dicom_router_name": body.DicomRouterName,
			"dicom_router_host": body.DicomRouterHost,
			"dicom_router_port": body.DicomRouterPort,
			"dicom_router_aet":  body.DicomRouterAET,
		}
		if body.ClientSecret != "" && body.ClientSecret != "***" {
			updates["client_secret"] = body.ClientSecret
		}
		if body.OrthancPass != "" && body.OrthancPass != "***" {
			updates["orthanc_pass"] = body.OrthancPass
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

		apiURL := fmt.Sprintf("%s/Patient?identifier=%s", cfg.FhirURL, url.QueryEscape("https://fhir.kemkes.go.id/id/nik|"+nik))
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

		apiURL := fmt.Sprintf("%s/Practitioner?identifier=%s", cfg.FhirURL, url.QueryEscape("https://fhir.kemkes.go.id/id/nik|"+nik))
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

		apiURL := fmt.Sprintf("%s/Patient?identifier=%s", cfg.FhirURL, url.QueryEscape("https://fhir.kemkes.go.id/id/nik|"+nik))
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
			// Struktur asli (contoh resmi Postman "Practitioner - By NIK"): province/
			// city/district/village/rw/rt semuanya NESTED di dalam satu extension
			// administrativeCode yg sama, pakai valueCode — bukan extension terpisah
			// dgn valueString spt yg tadinya diasumsikan di sini.
			if exts, ok := am["extension"].([]interface{}); ok {
				for _, e := range exts {
					em, _ := e.(map[string]interface{})
					eurl := satuSehatJSONStr(em["url"])
					if !strings.Contains(eurl, "administrativeCode") {
						continue
					}
					subExts, ok := em["extension"].([]interface{})
					if !ok {
						continue
					}
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
						case "rw":
							rw = sval
						case "rt":
							rt = sval
						}
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

// sqlDateOnly — koneksi DB dibuka dgn parseTime=true (lihat openDB), yg bikin
// driver MySQL mem-parse kolom DATE/DATETIME jadi time.Time. Kalau kolom itu
// di-SELECT MENTAH (tanpa IFNULL/CONCAT membungkusnya jadi string di sisi SQL)
// lalu di-Scan ke *string, hasilnya BUKAN "2026-08-20" tapi
// "2026-08-20T00:00:00+07:00" (format RFC3339 penuh) — ketahuan langsung dari
// respons error Satu Sehat sungguhan: "period.start" jadi
// "2026-08-20T00:00:00+07:00T09:00:00+07:00" (dobel) krn kode Go menambahkan
// lagi "T"+jam+"+07:00" di belakangnya. sqlDateOnly mengambil 10 karakter
// pertama shg aman dipakai di KEDUA kasus (string tanggal biasa maupun yg
// sudah "terkontaminasi" jadi RFC3339) sebelum digabung dgn komponen jam.
func sqlDateOnly(s string) string {
	if len(s) >= 10 {
		return s[:10]
	}
	return s
}

// ─── Encounter ──────────────────────────────────────────────────────────────
// Padanan tampil() dialog "SatuSehatEncounter.java" (rawat jalan): daftar
// reg_periksa yang SUDAH BAYAR di rentang tanggal, INNER JOIN ke
// satu_sehat_mapping_lokasi_ralan (jadi hanya poli yang SUDAH punya mapping
// lokasi Satu Sehat yang muncul — tanpa itu Encounter tidak bisa dikirim),
// LEFT JOIN satu_sehat_encounter utk lihat status sudah/belum terkirim.
// Ini baru daftar/monitoring (persis tampil() yg dikasih); logika kirim
// Encounter ke Satu Sehat (create resource) menyusul kalau referensi
// payload-nya sudah ada.

type EncounterCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	KodeDokter    string `json:"kode_dokter"`
	NamaDokter    string `json:"nama_dokter"`
	NoKtpDokter   string `json:"no_ktp_dokter"`
	KodePoli      string `json:"kode_poli"`
	NamaPoli      string `json:"nama_poli"`
	IDLokasiUnit  string `json:"id_lokasi_unit"`
	SttsRawat     string `json:"stts_rawat"`
	SttsLanjut    string `json:"stts_lanjut"`
	TanggalPulang string `json:"tanggal_pulang"`
	IDEncounter   string `json:"id_encounter"`
}

// GET /api/satu-sehat/encounter?tgl_dari=&tgl_sampai=&q= — persis tampil()
// SatuSehatEncounter.java (rawat jalan).
func getEncounterCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''),
				reg_periksa.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				IFNULL(pasien.no_ktp,''),
				reg_periksa.kd_dokter,
				pegawai.nama,
				IFNULL(pegawai.no_ktp,''),
				reg_periksa.kd_poli,
				poliklinik.nm_poli,
				IFNULL(satu_sehat_mapping_lokasi_ralan.id_lokasi_satusehat,''),
				reg_periksa.stts,
				reg_periksa.status_lanjut,
				CONCAT(reg_periksa.tgl_registrasi,'T',reg_periksa.jam_reg,'+07:00') AS pulang,
				IFNULL(satu_sehat_encounter.id_encounter,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN pegawai ON pegawai.nik = reg_periksa.kd_dokter
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN satu_sehat_mapping_lokasi_ralan ON satu_sehat_mapping_lokasi_ralan.kd_poli = poliklinik.kd_poli
			LEFT JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			WHERE reg_periksa.status_bayar = 'Sudah Bayar' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.nama LIKE ? OR poliklinik.nm_poli LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []EncounterCandidateRow{}
		for rows.Next() {
			var r EncounterCandidateRow
			if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.KodeDokter, &r.NamaDokter, &r.NoKtpDokter, &r.KodePoli, &r.NamaPoli, &r.IDLokasiUnit,
				&r.SttsRawat, &r.SttsLanjut, &r.TanggalPulang, &r.IDEncounter); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// ensureSatuSehatPasienDokterTables membuat tabel cache IHS Number pasien/
// dokter kalau belum ada. Kode lama (sendServiceRequestRadiologi) sudah
// mengasumsikan tabel satu_sehat_pasien/satu_sehat_dokter ini ada (dipakai
// buat ambil ihs_number), tapi ternyata tidak pernah benar-benar dibuat di
// skema — jadi query itu selalu gagal diam-diam. Dibuat di sini supaya kirim
// Encounter (dan otomatis juga memperbaiki fitur radiologi yg lama) bisa
// jalan; no NIK pasien/dokter dicari live ke Satu Sehat sekali lalu di-cache.
func ensureSatuSehatPasienDokterTables(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS satu_sehat_pasien (
			no_rkm_medis VARCHAR(15) NOT NULL,
			ihs_number VARCHAR(40) NOT NULL,
			PRIMARY KEY (no_rkm_medis)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`); err != nil {
		return err
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS satu_sehat_dokter (
			kd_dokter VARCHAR(20) NOT NULL,
			ihs_number VARCHAR(40) NOT NULL,
			PRIMARY KEY (kd_dokter)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`)
	return err
}

// cariIHSPatientByNIK / cariIHSPractitionerByNIK — cari IHS Number di Satu
// Sehat by NIK, dipakai resolveIHSPasien/resolveIHSDokter pas belum ada cache
// lokal. Logic sama dgn getReferensiPasienSatuSehat/getReferensiPraktisiSatuSehat,
// cuma butuh id-nya saja.
func cariIHSPatientByNIK(fhirURL, token, nik string) (string, error) {
	apiURL := fmt.Sprintf("%s/Patient?identifier=%s", fhirURL, url.QueryEscape("https://fhir.kemkes.go.id/id/nik|"+nik))
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Satu Sehat HTTP %d", resp.StatusCode)
	}
	entries, _ := result["entry"].([]interface{})
	if len(entries) == 0 {
		return "", fmt.Errorf("pasien dengan NIK %s tidak ditemukan di Satu Sehat", nik)
	}
	entry0, _ := entries[0].(map[string]interface{})
	resource, _ := entry0["resource"].(map[string]interface{})
	id := satuSehatJSONStr(resource["id"])
	if id == "" {
		return "", fmt.Errorf("ID Patient tidak ditemukan pada respons Satu Sehat")
	}
	return id, nil
}

func cariIHSPractitionerByNIK(fhirURL, token, nik string) (string, error) {
	apiURL := fmt.Sprintf("%s/Practitioner?identifier=%s", fhirURL, url.QueryEscape("https://fhir.kemkes.go.id/id/nik|"+nik))
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Satu Sehat HTTP %d", resp.StatusCode)
	}
	entries, _ := result["entry"].([]interface{})
	if len(entries) == 0 {
		return "", fmt.Errorf("dokter dengan NIK %s tidak ditemukan di Satu Sehat", nik)
	}
	entry0, _ := entries[0].(map[string]interface{})
	resource, _ := entry0["resource"].(map[string]interface{})
	id := satuSehatJSONStr(resource["id"])
	if id == "" {
		return "", fmt.Errorf("ID Practitioner tidak ditemukan pada respons Satu Sehat")
	}
	return id, nil
}

func resolveIHSPasien(db *sql.DB, fhirURL, token, noRkmMedis, nik string) (string, error) {
	var cached string
	if err := db.QueryRow(`SELECT ihs_number FROM satu_sehat_pasien WHERE no_rkm_medis = ?`, noRkmMedis).Scan(&cached); err == nil && cached != "" {
		return cached, nil
	}
	nik = strings.TrimSpace(nik)
	if nik == "" || nik == "-" {
		return "", fmt.Errorf("pasien belum punya Nomor KTP di data lokal")
	}
	ihs, err := cariIHSPatientByNIK(fhirURL, token, nik)
	if err != nil {
		return "", err
	}
	db.Exec(`INSERT INTO satu_sehat_pasien (no_rkm_medis, ihs_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE ihs_number = VALUES(ihs_number)`, noRkmMedis, ihs)
	return ihs, nil
}

func resolveIHSDokter(db *sql.DB, fhirURL, token, kdDokter, nik string) (string, error) {
	var cached string
	if err := db.QueryRow(`SELECT ihs_number FROM satu_sehat_dokter WHERE kd_dokter = ?`, kdDokter).Scan(&cached); err == nil && cached != "" {
		return cached, nil
	}
	nik = strings.TrimSpace(nik)
	if nik == "" || nik == "-" {
		return "", fmt.Errorf("dokter belum punya Nomor KTP di data lokal")
	}
	ihs, err := cariIHSPractitionerByNIK(fhirURL, token, nik)
	if err != nil {
		return "", err
	}
	db.Exec(`INSERT INTO satu_sehat_dokter (kd_dokter, ihs_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE ihs_number = VALUES(ihs_number)`, kdDokter, ihs)
	return ihs, nil
}

type encounterCodingPayload struct {
	System  string `json:"system,omitempty"`
	Code    string `json:"code,omitempty"`
	Display string `json:"display,omitempty"`
}
type encounterReferencePayload struct {
	Reference string `json:"reference"`
	Display   string `json:"display,omitempty"`
}
type encounterParticipantTypePayload struct {
	Coding []encounterCodingPayload `json:"coding"`
}
type encounterParticipantPayload struct {
	Type       []encounterParticipantTypePayload `json:"type"`
	Individual encounterReferencePayload         `json:"individual"`
}
type encounterPeriodPayload struct {
	Start string `json:"start"`
}
type encounterLocationPayload struct {
	Location encounterReferencePayload `json:"location"`
}
type encounterStatusHistoryPayload struct {
	Status string                 `json:"status"`
	Period encounterPeriodPayload `json:"period"`
}
type encounterIdentifierPayload struct {
	System string `json:"system"`
	Value  string `json:"value"`
}
type encounterCreatePayload struct {
	ResourceType    string                          `json:"resourceType"`
	Status          string                          `json:"status"`
	Class           encounterCodingPayload          `json:"class"`
	Subject         encounterReferencePayload       `json:"subject"`
	Participant     []encounterParticipantPayload   `json:"participant"`
	Period          encounterPeriodPayload          `json:"period"`
	Location        []encounterLocationPayload      `json:"location"`
	StatusHistory   []encounterStatusHistoryPayload `json:"statusHistory"`
	ServiceProvider encounterReferencePayload       `json:"serviceProvider"`
	Identifier      []encounterIdentifierPayload    `json:"identifier"`
}

// POST /api/satu-sehat/encounter/send/*no_rawat — bikin & kirim resource
// Encounter (rawat jalan/AMB) ke Satu Sehat persis payload resmi
// "POST {{base_url}}/Encounter", lalu simpan id_encounter yg dikembalikan ke
// satu_sehat_encounter supaya status "sudah terkirim" muncul di daftar.
func sendEncounterSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var (
			noRkmMedis  string
			kdDokter    string
			kdPoli      string
			periodStart string
			namaPasien  string
			nikPasien   string
			namaDokter  string
			nikDokter   string
			namaLokasi  string
			idLokasi    sql.NullString
		)
		err = db.QueryRow(`
			SELECT
				reg_periksa.no_rkm_medis, reg_periksa.kd_dokter, reg_periksa.kd_poli,
				CONCAT(reg_periksa.tgl_registrasi,'T',reg_periksa.jam_reg,'+07:00'),
				pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''),
				poliklinik.nm_poli
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN pegawai ON pegawai.nik = reg_periksa.kd_dokter
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&noRkmMedis, &kdDokter, &kdPoli, &periodStart, &namaPasien, &nikPasien, &namaDokter, &nikDokter, &namaLokasi)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data registrasi tidak ditemukan"})
			return
		}

		db.QueryRow(`SELECT id_lokasi_satusehat FROM satu_sehat_mapping_lokasi_ralan WHERE kd_poli = ?`, kdPoli).Scan(&idLokasi)
		if !idLokasi.Valid || idLokasi.String == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Poli belum punya Mapping Lokasi Satu Sehat"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number dokter: " + err.Error()})
			return
		}

		payload := encounterCreatePayload{
			ResourceType: "Encounter",
			Status:       "arrived",
			Class:        encounterCodingPayload{System: "http://terminology.hl7.org/CodeSystem/v3-ActCode", Code: "AMB", Display: "ambulatory"},
			Subject:      encounterReferencePayload{Reference: "Patient/" + ihsPasien, Display: namaPasien},
			Participant: []encounterParticipantPayload{{
				Type: []encounterParticipantTypePayload{{Coding: []encounterCodingPayload{{
					System: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", Code: "ATND", Display: "attender",
				}}}},
				Individual: encounterReferencePayload{Reference: "Practitioner/" + ihsDokter, Display: namaDokter},
			}},
			Period:   encounterPeriodPayload{Start: periodStart},
			Location: []encounterLocationPayload{{Location: encounterReferencePayload{Reference: "Location/" + idLokasi.String, Display: namaLokasi}}},
			StatusHistory: []encounterStatusHistoryPayload{{
				Status: "arrived", Period: encounterPeriodPayload{Start: periodStart},
			}},
			ServiceProvider: encounterReferencePayload{Reference: "Organization/" + cfg.OrgID},
			Identifier: []encounterIdentifierPayload{{
				System: "http://sys-ids.kemkes.go.id/encounter/" + cfg.OrgID, Value: noRawat,
			}},
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Encounter", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "encounter", noRawat, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idEncounter := satuSehatJSONStr(result["id"])
		if idEncounter == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Encounter tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_encounter (no_rawat, id_encounter) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE id_encounter = VALUES(id_encounter)
		`, noRawat, idEncounter); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Encounter terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "encounter", noRawat)

		c.JSON(http.StatusOK, gin.H{"message": "Encounter berhasil dikirim", "id_encounter": idEncounter})
	}
}

// ─── Encounter — update siklus hidup (In Progress / Discharge / Finished) ────
// Padanan endpoint resmi "Encounter - Update Inprogress/dischargeDisposition/
// Finished": semuanya PUT resource PENUH (bukan PATCH), jadi polanya selalu
// GET current resource dari Satu Sehat dulu (sumber kebenaran ada di server,
// bukan disalin ke DB lokal supaya tidak drift), lalu field yg relevan
// dimodifikasi di map JSON generik, baru di-PUT balik utuh.

func nowISO7WIB() string {
	return time.Now().In(time.FixedZone("WIB", 7*3600)).Format("2006-01-02T15:04:05+07:00")
}

func getIDEncounterByNoRawat(db *sql.DB, noRawat string) (string, error) {
	var id string
	err := db.QueryRow(`SELECT id_encounter FROM satu_sehat_encounter WHERE no_rawat = ?`, noRawat).Scan(&id)
	if err != nil || id == "" {
		return "", fmt.Errorf("Encounter untuk registrasi ini belum pernah dikirim ke Satu Sehat")
	}
	return id, nil
}

func fetchEncounterByID(fhirURL, token, id string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", fhirURL+"/Encounter/"+url.PathEscape(id), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Satu Sehat HTTP %d saat mengambil Encounter", resp.StatusCode)
	}
	return result, nil
}

func putEncounter(fhirURL, token, id string, resource map[string]interface{}) (map[string]interface{}, error) {
	bodyBytes, _ := json.Marshal(resource)
	req, _ := http.NewRequest("PUT", fhirURL+"/Encounter/"+url.PathEscape(id), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return result, fmt.Errorf("Satu Sehat HTTP %d", resp.StatusCode)
	}
	return result, nil
}

// encounterCloseLastStatusHistory menutup period.end entri statusHistory
// terakhir (kalau belum punya end) — dipanggil sebelum menambah entri baru,
// supaya histori status sebelumnya tercatat kapan berakhirnya.
func encounterCloseLastStatusHistory(resource map[string]interface{}, now string) {
	sh, _ := resource["statusHistory"].([]interface{})
	if len(sh) == 0 {
		return
	}
	last, _ := sh[len(sh)-1].(map[string]interface{})
	if last == nil {
		return
	}
	period, _ := last["period"].(map[string]interface{})
	if period == nil {
		period = map[string]interface{}{}
		last["period"] = period
	}
	if v, ok := period["end"]; !ok || v == nil || v == "" {
		period["end"] = now
	}
}

func encounterAppendStatusHistory(resource map[string]interface{}, status, start string) {
	sh, _ := resource["statusHistory"].([]interface{})
	sh = append(sh, map[string]interface{}{
		"status": status,
		"period": map[string]interface{}{"start": start},
	})
	resource["statusHistory"] = sh
}

// GET /api/satu-sehat/encounter/detail/*no_rawat — ambil status Encounter
// terkini langsung dari Satu Sehat (persis "Encounter - By ID"), dipakai
// panel detail di frontend utk nampilin status & statusHistory sebelum
// user pilih aksi lanjut (In Progress / Discharge / Finished).
func getEncounterDetailSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}
		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}
		resource, err := fetchEncounterByID(cfg.FhirURL, token, idEncounter)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": resource})
			return
		}
		c.JSON(http.StatusOK, resource)
	}
}

// POST /api/satu-sehat/encounter/inprogress/*no_rawat — persis "Encounter -
// Update Inprogress": tutup statusHistory terakhir, tambah entri in-progress
// baru, ganti status jadi in-progress.
func updateEncounterInprogress(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}
		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}
		resource, err := fetchEncounterByID(cfg.FhirURL, token, idEncounter)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": resource})
			return
		}

		now := nowISO7WIB()
		encounterCloseLastStatusHistory(resource, now)
		encounterAppendStatusHistory(resource, "in-progress", now)
		resource["status"] = "in-progress"

		updated, err := putEncounter(cfg.FhirURL, token, idEncounter, resource)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": updated})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status Encounter diubah menjadi In Progress", "resource": updated})
	}
}

// POST /api/satu-sehat/encounter/disposisi/*no_rawat — persis "Encounter -
// Update dischargeDisposition": tambah/timpa hospitalization.dischargeDisposition,
// status & statusHistory tidak diubah (sesuai contoh resmi: masih in-progress).
func updateEncounterDisposisi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			Kode    string `json:"kode"`
			Display string `json:"display"`
			Text    string `json:"text"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.Kode) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode discharge disposition wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}
		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}
		resource, err := fetchEncounterByID(cfg.FhirURL, token, idEncounter)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": resource})
			return
		}

		resource["hospitalization"] = map[string]interface{}{
			"dischargeDisposition": map[string]interface{}{
				"coding": []interface{}{
					map[string]interface{}{
						"system":  "http://terminology.hl7.org/CodeSystem/discharge-disposition",
						"code":    body.Kode,
						"display": body.Display,
					},
				},
				"text": body.Text,
			},
		}

		updated, err := putEncounter(cfg.FhirURL, token, idEncounter, resource)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": updated})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Discharge Disposition berhasil disimpan", "resource": updated})
	}
}

// POST /api/satu-sehat/encounter/finished/*no_rawat — persis "Encounter -
// Update Finished": tutup statusHistory terakhir, tambah entri finished,
// ganti status jadi finished, set period.end. Field "diagnosis" (referensi ke
// Condition) belum diisi krn resource Condition belum dibangun di ERMApp.
func updateEncounterFinished(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}
		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}
		resource, err := fetchEncounterByID(cfg.FhirURL, token, idEncounter)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": resource})
			return
		}

		now := nowISO7WIB()
		encounterCloseLastStatusHistory(resource, now)
		encounterAppendStatusHistory(resource, "finished", now)
		// entri "finished" yg baru ditambah juga langsung ditutup (start=end=now),
		// persis contoh resmi.
		if sh, ok := resource["statusHistory"].([]interface{}); ok && len(sh) > 0 {
			if last, ok := sh[len(sh)-1].(map[string]interface{}); ok {
				if period, ok := last["period"].(map[string]interface{}); ok {
					period["end"] = now
				}
			}
		}
		resource["status"] = "finished"
		if period, ok := resource["period"].(map[string]interface{}); ok {
			period["end"] = now
		} else {
			resource["period"] = map[string]interface{}{"end": now}
		}

		updated, err := putEncounter(cfg.FhirURL, token, idEncounter, resource)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "details": updated})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Encounter berhasil diselesaikan (Finished)", "resource": updated})
	}
}

// ─── Condition (diagnosis) ─────────────────────────────────────────────────
// Padanan tampil() SatuSehatCondition.java + POST /Condition resmi.
// diagnosa_pasien.kd_penyakit di Khanza SUDAH berupa kode ICD-10 langsung
// (mis. "K35.8"), jadi tidak perlu tabel mapping terpisah spt Obat/Vaksin/Lab
// — cukup INNER JOIN ke penyakit utk nama/display. satu_sehat_condition
// (tabel Khanza yg SUDAH ADA, bukan buatan ERMApp) PK-nya (no_rawat,
// kd_penyakit, status) — status di sini merujuk ke diagnosa_pasien.status
// (Ralan/Ranap), BUKAN status Encounter/Condition FHIR.

type ConditionCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	SttsRawat     string `json:"stts_rawat"`
	SttsLanjut    string `json:"stts_lanjut"`
	TanggalPulang string `json:"tanggal_pulang"`
	IDEncounter   string `json:"id_encounter"`
	KdPenyakit    string `json:"kd_penyakit"`
	NamaPenyakit  string `json:"nama_penyakit"`
	IDCondition   string `json:"id_condition"`
}

// GET /api/satu-sehat/condition?tgl_dari=&tgl_sampai=&q= — persis tampil()
// SatuSehatCondition.java: daftar diagnosa pada rentang tanggal registrasi
// yg Encounter-nya SUDAH terkirim (INNER JOIN satu_sehat_encounter — kalau
// belum, tidak muncul; kirim Encounter dulu di menu Encounter).
func getConditionCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''),
				reg_periksa.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				IFNULL(pasien.no_ktp,''),
				reg_periksa.stts,
				reg_periksa.status_lanjut,
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg) AS pulang,
				satu_sehat_encounter.id_encounter,
				diagnosa_pasien.kd_penyakit,
				IFNULL(penyakit.nm_penyakit,''),
				IFNULL(satu_sehat_condition.id_condition,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat
			INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
			LEFT JOIN satu_sehat_condition ON satu_sehat_condition.no_rawat = diagnosa_pasien.no_rawat
				AND satu_sehat_condition.kd_penyakit = diagnosa_pasien.kd_penyakit
				AND satu_sehat_condition.status = diagnosa_pasien.status
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR diagnosa_pasien.kd_penyakit LIKE ? OR penyakit.nm_penyakit LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []ConditionCandidateRow{}
		for rows.Next() {
			var r ConditionCandidateRow
			if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.SttsRawat, &r.SttsLanjut, &r.TanggalPulang, &r.IDEncounter,
				&r.KdPenyakit, &r.NamaPenyakit, &r.IDCondition); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type conditionCodeableConceptPayload struct {
	Coding []encounterCodingPayload `json:"coding"`
}
type conditionCreatePayload struct {
	ResourceType   string                            `json:"resourceType"`
	ID             string                            `json:"id,omitempty"`
	ClinicalStatus conditionCodeableConceptPayload   `json:"clinicalStatus"`
	Category       []conditionCodeableConceptPayload `json:"category"`
	Code           conditionCodeableConceptPayload   `json:"code"`
	Subject        encounterReferencePayload         `json:"subject"`
	Encounter      encounterReferencePayload         `json:"encounter"`
}

type conditionRowData struct {
	NoRkmMedis    string
	NamaPasien    string
	NikPasien     string
	NamaPenyakit  string
	StatusLanjut  string // reg_periksa.status_lanjut — inilah yg ditulis ke satu_sehat_condition.status, persis Sequel.menyimpantf2(...) di Java (kolom 7/Stts Lanjut), BUKAN diagnosa_pasien.status
	TglRegistrasi string
	TglPulang     string // CONCAT tgl_registrasi+jam_reg, dipakai di teks encounter.display
}

func fetchConditionRowData(db *sql.DB, noRawat, kdPenyakit string) (conditionRowData, error) {
	var d conditionRowData
	err := db.QueryRow(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''), IFNULL(penyakit.nm_penyakit,''),
			reg_periksa.status_lanjut, IFNULL(reg_periksa.tgl_registrasi,''), CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg)
		FROM diagnosa_pasien
		INNER JOIN reg_periksa ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
		WHERE diagnosa_pasien.no_rawat = ? AND diagnosa_pasien.kd_penyakit = ?
		LIMIT 1
	`, noRawat, kdPenyakit).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.NamaPenyakit, &d.StatusLanjut, &d.TglRegistrasi, &d.TglPulang)
	return d, err
}

// buildConditionPayload — persis format json Java BtnKirim/BtnUpdate (cuma
// beda field "id": ada di Update, tidak ada di Kirim/create — makanya
// omitempty). Teks encounter.display JUGA persis Java: "Diagnosa {nama
// pasien} selama kunjungan/dirawat dari tanggal {registrasi} sampai {pulang}".
func buildConditionPayload(id, kdPenyakit string, d conditionRowData, ihsPasien, idEncounter string) conditionCreatePayload {
	return conditionCreatePayload{
		ResourceType: "Condition",
		ID:           id,
		ClinicalStatus: conditionCodeableConceptPayload{Coding: []encounterCodingPayload{{
			System: "http://terminology.hl7.org/CodeSystem/condition-clinical", Code: "active", Display: "Active",
		}}},
		Category: []conditionCodeableConceptPayload{{Coding: []encounterCodingPayload{{
			System: "http://terminology.hl7.org/CodeSystem/condition-category", Code: "encounter-diagnosis", Display: "Encounter Diagnosis",
		}}}},
		Code: conditionCodeableConceptPayload{Coding: []encounterCodingPayload{{
			System: "http://hl7.org/fhir/sid/icd-10", Code: kdPenyakit, Display: d.NamaPenyakit,
		}}},
		Subject: encounterReferencePayload{Reference: "Patient/" + ihsPasien, Display: d.NamaPasien},
		Encounter: encounterReferencePayload{
			Reference: "Encounter/" + idEncounter,
			Display:   "Diagnosa " + d.NamaPasien + " selama kunjungan/dirawat dari tanggal " + d.TglRegistrasi + " sampai " + d.TglPulang,
		},
	}
}

// POST /api/satu-sehat/condition/send/*no_rawat — body {"kd_penyakit":"K35.8"}.
// Bikin & kirim resource Condition persis payload resmi POST /Condition
// (padanan BtnKirimActionPerformed), pakai IHS Number pasien (cache/resolve
// sama spt Encounter) dan id_encounter yg sudah tersimpan lokal.
func sendConditionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			KdPenyakit string `json:"kd_penyakit"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || strings.TrimSpace(body.KdPenyakit) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kd_penyakit wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		rowData, err := fetchConditionRowData(db, noRawat, body.KdPenyakit)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildConditionPayload("", body.KdPenyakit, rowData, ihsPasien, idEncounter)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Condition", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "condition", noRawat+"|"+body.KdPenyakit, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idCondition := satuSehatJSONStr(result["id"])
		if idCondition == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Condition tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_condition (no_rawat, kd_penyakit, status, id_condition) VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_condition = VALUES(id_condition)
		`, noRawat, body.KdPenyakit, rowData.StatusLanjut, idCondition); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Condition terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "condition", noRawat+"|"+body.KdPenyakit)

		c.JSON(http.StatusOK, gin.H{"message": "Condition berhasil dikirim", "id_condition": idCondition})
	}
}

// POST /api/satu-sehat/condition/update/*no_rawat — body {"kd_penyakit":"K35.8"}.
// Padanan BtnUpdateActionPerformed: PUT ulang resource Condition yg SUDAH
// pernah terkirim (dgn "id" disertakan di body) pakai data lokal terbaru —
// dipakai kalau diagnosa/ICD-10 dikoreksi setelah sempat dikirim.
func updateConditionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			KdPenyakit string `json:"kd_penyakit"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || strings.TrimSpace(body.KdPenyakit) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kd_penyakit wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var idCondition string
		if err := db.QueryRow(`SELECT id_condition FROM satu_sehat_condition WHERE no_rawat = ? AND kd_penyakit = ?`, noRawat, body.KdPenyakit).Scan(&idCondition); err != nil || idCondition == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Condition belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchConditionRowData(db, noRawat, body.KdPenyakit)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildConditionPayload(idCondition, body.KdPenyakit, rowData, ihsPasien, idEncounter)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Condition/"+url.PathEscape(idCondition), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "condition", noRawat+"|"+body.KdPenyakit, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "condition", noRawat+"|"+body.KdPenyakit)

		c.JSON(http.StatusOK, gin.H{"message": "Condition berhasil diperbarui", "id_condition": idCondition})
	}
}

// ─── Medication ─────────────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim/BtnUpdate SatuSehatKirimMedication.java. BEDA
// dari Encounter/Condition/Observation/Procedure: ini bukan data per
// kunjungan pasien, tapi resource MASTER DATA (katalog obat/alkes/bhp rumah
// sakit yg sudah di-mapping ke KFA di Pengaturan > Mapping Obat/Alkes/BHP) —
// jadi tidak butuh rentang tanggal atau Encounter, cukup daftar
// satu_sehat_mapping_obat INNER JOIN databarang, kirim/update per item.

type MedicationCandidateRow struct {
	ObatCode     string `json:"obat_code"`
	ObatSystem   string `json:"obat_system"`
	KodeBrng     string `json:"kode_brng"`
	ObatDisplay  string `json:"obat_display"`
	FormCode     string `json:"form_code"`
	FormSystem   string `json:"form_system"`
	FormDisplay  string `json:"form_display"`
	Status       string `json:"status"` // "active"/"inactive", persis Java: databarang.status 0/1 di-map
	IDMedication string `json:"id_medication"`
}

// GET /api/satu-sehat/medication?q= — persis tampil() SatuSehatKirimMedication.java.
func getMedicationCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(satu_sehat_mapping_obat.obat_code,''),
				satu_sehat_mapping_obat.obat_system,
				satu_sehat_mapping_obat.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''),
				IFNULL(satu_sehat_mapping_obat.form_code,''),
				IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''),
				databarang.status,
				IFNULL(satu_sehat_medication.id_medication,'')
			FROM satu_sehat_mapping_obat
			INNER JOIN databarang ON satu_sehat_mapping_obat.kode_brng = databarang.kode_brng
			LEFT JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` WHERE (satu_sehat_mapping_obat.obat_code LIKE ? OR satu_sehat_mapping_obat.kode_brng LIKE ? OR satu_sehat_mapping_obat.obat_display LIKE ? OR satu_sehat_mapping_obat.form_code LIKE ? OR satu_sehat_mapping_obat.form_display LIKE ?)`
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

		list := []MedicationCandidateRow{}
		for rows.Next() {
			var r MedicationCandidateRow
			var statusRaw string
			if err := rows.Scan(&r.ObatCode, &r.ObatSystem, &r.KodeBrng, &r.ObatDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay, &statusRaw, &r.IDMedication); err != nil {
				continue
			}
			if statusRaw == "1" {
				r.Status = "active"
			} else {
				r.Status = "inactive"
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildMedicationPayload(id string, row MedicationCandidateRow, orgID string) map[string]interface{} {
	resource := map[string]interface{}{
		"resourceType": "Medication",
		"meta":         map[string]interface{}{"profile": []interface{}{"https://fhir.kemkes.go.id/r4/StructureDefinition/Medication"}},
		"identifier": []interface{}{map[string]interface{}{
			"system": "http://sys-ids.kemkes.go.id/medication/" + orgID,
			"use":    "official",
			"value":  row.KodeBrng,
		}},
		"code": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": row.ObatSystem, "code": row.ObatCode, "display": row.ObatDisplay,
			}},
		},
		"status": row.Status,
		"form": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": row.FormSystem, "code": row.FormCode, "display": row.FormDisplay,
			}},
		},
		"extension": []interface{}{map[string]interface{}{
			"url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
			"valueCodeableConcept": map[string]interface{}{
				"coding": []interface{}{map[string]interface{}{
					"system": "http://terminology.kemkes.go.id/CodeSystem/medication-type", "code": "NC", "display": "Non-compound",
				}},
			},
		}},
	}
	if id != "" {
		resource["id"] = id
	}
	return resource
}

func fetchMedicationRow(db *sql.DB, kodeBrng string) (MedicationCandidateRow, error) {
	var r MedicationCandidateRow
	var statusRaw string
	err := db.QueryRow(`
		SELECT
			IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, satu_sehat_mapping_obat.kode_brng,
			IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''),
			IFNULL(satu_sehat_mapping_obat.form_system,''), IFNULL(satu_sehat_mapping_obat.form_display,''), databarang.status
		FROM satu_sehat_mapping_obat
		INNER JOIN databarang ON satu_sehat_mapping_obat.kode_brng = databarang.kode_brng
		WHERE satu_sehat_mapping_obat.kode_brng = ?
	`, kodeBrng).Scan(&r.ObatCode, &r.ObatSystem, &r.KodeBrng, &r.ObatDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay, &statusRaw)
	if statusRaw == "1" {
		r.Status = "active"
	} else {
		r.Status = "inactive"
	}
	return r, err
}

// POST /api/satu-sehat/medication/send/:kode_brng
func sendMedicationSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBrng := c.Param("kode_brng")
		if kodeBrng == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kode_brng wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		row, err := fetchMedicationRow(db, kodeBrng)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data mapping obat tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload := buildMedicationPayload("", row, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Medication", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idMedication := satuSehatJSONStr(result["id"])
		if idMedication == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Medication tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_medication (kode_brng, id_medication) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE id_medication = VALUES(id_medication)
		`, kodeBrng, idMedication); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Medication terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Medication berhasil dikirim", "id_medication": idMedication})
	}
}

// POST /api/satu-sehat/medication/update/:kode_brng
func updateMedicationSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBrng := c.Param("kode_brng")
		if kodeBrng == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kode_brng wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idMedication string
		if err := db.QueryRow(`SELECT id_medication FROM satu_sehat_medication WHERE kode_brng = ?`, kodeBrng).Scan(&idMedication); err != nil || idMedication == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Medication belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		row, err := fetchMedicationRow(db, kodeBrng)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data mapping obat tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload := buildMedicationPayload(idMedication, row, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Medication/"+url.PathEscape(idMedication), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Medication berhasil diperbarui", "id_medication": idMedication})
	}
}

// ─── MedicationRequest ──────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim/BtnUpdate SatuSehatKirimMedicationRequest.java.
// Butuh 3 prasyarat sudah terkirim duluan: Encounter (satu_sehat_encounter),
// Medication (satu_sehat_medication, dari Mapping Obat/Alkes/BHP), dan resep
// itu sendiri. Daftar gabungan 4 kombinasi: non-racikan/racikan × Ralan/Ranap
// (resep_dokter vs resep_dokter_racikan+detail), persis 4 query terpisah yg
// di-append ke tabel yg sama di Java (bukan SQL UNION).
//
// DUA bug nyata di source asli Khanza (branch racikan) dikoreksi di sini:
//  1. authoredOn racikan pakai literal "01" ekstra sblm "+07:00" (mis.
//     "...T10:3001+07:00" — datetime rusak); non-racikan tidak punya "01" ini.
//     Disamakan ke format bersih non-racikan.
//  2. Sequel.menyimpantf2 utk satu_sehat_medicationrequest_racikan (PK:
//     no_resep+kode_brng+no_racik) di Java salah kirim kode_brng DUA KALI
//     (harusnya no_resep, kode_brng, no_racik, id — malah no_resep, kode_brng,
//     kode_brng, id), jadi kolom no_racik ke-isi kode_brng, bukan racik. Kalau
//     direplikasi apa adanya, list join berikutnya (yg match on no_racik asli)
//     bakal selalu gagal cocok. Diperbaiki pakai no_racik yg benar.

type MedicationRequestCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	DokterPJ      string `json:"dokter_pj"`
	NoKtpPraktisi string `json:"no_ktp_praktisi"`
	IDEncounter   string `json:"id_encounter"`
	KfaCode       string `json:"kfa_code"`
	KfaSystem     string `json:"kfa_system"`
	KodeBarang    string `json:"kode_barang"`
	KfaDisplay    string `json:"kfa_display"`
	FormCode      string `json:"form_code"`
	FormSystem    string `json:"form_system"`
	FormDisplay   string `json:"form_display"`
	RouteCode     string `json:"route_code"`
	RouteSystem   string `json:"route_system"`
	RouteDisplay  string `json:"route_display"`
	DenomCode     string `json:"denominator_code"`
	DenomSystem   string `json:"denominator_system"`
	TglJamResep   string `json:"tgl_jam_resep"`
	Jumlah        string `json:"jumlah"`
	IDMedication  string `json:"id_medication"`
	AturanPakai   string `json:"aturan_pakai"`
	NoResep       string `json:"no_resep"`
	IDMedReq      string `json:"id_medicationrequest"`
	NoRacik       string `json:"no_racik"`
	Status        string `json:"status"`
}

// GET /api/satu-sehat/medication-request?tgl_dari=&tgl_sampai=&q= — persis
// tampil() SatuSehatKirimMedicationRequest.java: 4 query (non-racikan/
// racikan × Ralan/Ranap) di-append jadi satu daftar.
func getMedicationRequestCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))
		kw := "%" + keyword + "%"

		scanRow := func(rows *sql.Rows, status string, racikan bool) (MedicationRequestCandidateRow, error) {
			var r MedicationRequestCandidateRow
			var err error
			if racikan {
				err = rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.DokterPJ, &r.NoKtpPraktisi,
					&r.IDEncounter, &r.KfaCode, &r.KfaSystem, &r.KodeBarang, &r.KfaDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay,
					&r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DenomCode, &r.DenomSystem, &r.TglJamResep, &r.Jumlah,
					&r.IDMedication, &r.AturanPakai, &r.NoResep, &r.IDMedReq, &r.NoRacik)
			} else {
				err = rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.DokterPJ, &r.NoKtpPraktisi,
					&r.IDEncounter, &r.KfaCode, &r.KfaSystem, &r.KodeBarang, &r.KfaDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay,
					&r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DenomCode, &r.DenomSystem, &r.TglJamResep, &r.Jumlah,
					&r.IDMedication, &r.AturanPakai, &r.NoResep, &r.IDMedReq)
				r.NoRacik = ""
			}
			r.Status = status
			return r, err
		}

		nonRacikanQuery := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, resep_dokter.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''), IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''), IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''),
				IFNULL(satu_sehat_mapping_obat.route_display,''), IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), resep_dokter.jml, satu_sehat_medication.id_medication,
				resep_dokter.aturan_pakai, resep_dokter.no_resep, IFNULL(satu_sehat_medicationrequest.id_medicationrequest,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter ON resep_dokter.no_resep = resep_obat.no_resep
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationrequest ON satu_sehat_medicationrequest.no_resep = resep_dokter.no_resep AND satu_sehat_medicationrequest.kode_brng = resep_dokter.kode_brng
			WHERE reg_periksa.status_lanjut = ? AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		racikanQuery := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, resep_dokter_racikan_detail.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''), IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''), IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''),
				IFNULL(satu_sehat_mapping_obat.route_display,''), IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), resep_dokter_racikan_detail.jml, satu_sehat_medication.id_medication,
				resep_dokter_racikan.aturan_pakai, resep_dokter_racikan.no_resep, IFNULL(satu_sehat_medicationrequest_racikan.id_medicationrequest,''), resep_dokter_racikan_detail.no_racik
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter_racikan ON resep_dokter_racikan.no_resep = resep_obat.no_resep
			INNER JOIN resep_dokter_racikan_detail ON resep_dokter_racikan_detail.no_resep = resep_dokter_racikan.no_resep AND resep_dokter_racikan_detail.no_racik = resep_dokter_racikan.no_racik
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter_racikan_detail.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationrequest_racikan ON satu_sehat_medicationrequest_racikan.no_resep = resep_dokter_racikan_detail.no_resep
				AND satu_sehat_medicationrequest_racikan.kode_brng = resep_dokter_racikan_detail.kode_brng
				AND satu_sehat_medicationrequest_racikan.no_racik = resep_dokter_racikan_detail.no_racik
			WHERE reg_periksa.status_lanjut = ? AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		searchNonRacikan := ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR satu_sehat_mapping_obat.kode_brng LIKE ? OR satu_sehat_mapping_obat.obat_display LIKE ?)`

		result := []MedicationRequestCandidateRow{}
		branches := []struct {
			query   string
			status  string
			racikan bool
		}{
			{nonRacikanQuery, "Ralan", false},
			{nonRacikanQuery, "Ranap", false},
			{racikanQuery, "Ralan", true},
			{racikanQuery, "Ranap", true},
		}
		for _, b := range branches {
			q := b.query
			args := []interface{}{b.status, tglDari, tglSampai}
			if keyword != "" {
				q += searchNonRacikan
				args = append(args, kw, kw, kw, kw, kw, kw)
			}
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				r, err := scanRow(rows, b.status, b.racikan)
				if err != nil {
					continue
				}
				result = append(result, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": result, "total": len(result)})
	}
}

type medicationRequestRowData struct {
	NoRawat      string
	NoRkmMedis   string // key cache resolveIHSPasien
	NamaPasien   string
	NikPasien    string
	DokterNik    string // pegawai.nik — key cache resolveIHSDokter
	DokterNama   string
	NikPraktisi  string // pegawai.no_ktp
	IDEncounter  string
	ObatCode     string
	ObatSystem   string
	ObatDisplay  string
	RouteCode    string
	RouteSystem  string
	RouteDisplay string
	DenomCode    string
	DenomSystem  string
	TglJamResep  string
	Jumlah       string
	IDMedication string
	AturanPakai  string
	StatusLanjut string
}

func fetchMedicationRequestRowData(db *sql.DB, noResep, kodeBrng, noRacik string) (medicationRequestRowData, error) {
	var d medicationRequestRowData
	if noRacik == "" {
		err := db.QueryRow(`
			SELECT reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nik, pegawai.nama, IFNULL(pegawai.no_ktp,''),
				satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, IFNULL(satu_sehat_mapping_obat.obat_display,''),
				IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''), IFNULL(satu_sehat_mapping_obat.route_display,''),
				IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), resep_dokter.jml, satu_sehat_medication.id_medication,
				resep_dokter.aturan_pakai, reg_periksa.status_lanjut
			FROM resep_obat
			INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter ON resep_dokter.no_resep = resep_obat.no_resep
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			WHERE resep_obat.no_resep = ? AND resep_dokter.kode_brng = ?
			LIMIT 1
		`, noResep, kodeBrng).Scan(&d.NoRawat, &d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.DokterNik, &d.DokterNama, &d.NikPraktisi,
			&d.IDEncounter, &d.ObatCode, &d.ObatSystem, &d.ObatDisplay, &d.RouteCode, &d.RouteSystem, &d.RouteDisplay,
			&d.DenomCode, &d.DenomSystem, &d.TglJamResep, &d.Jumlah, &d.IDMedication, &d.AturanPakai, &d.StatusLanjut)
		return d, err
	}

	err := db.QueryRow(`
		SELECT reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			pegawai.nik, pegawai.nama, IFNULL(pegawai.no_ktp,''),
			satu_sehat_encounter.id_encounter,
			IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, IFNULL(satu_sehat_mapping_obat.obat_display,''),
			IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''), IFNULL(satu_sehat_mapping_obat.route_display,''),
			IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
			CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), resep_dokter_racikan_detail.jml, satu_sehat_medication.id_medication,
			resep_dokter_racikan.aturan_pakai, reg_periksa.status_lanjut
		FROM resep_dokter_racikan_detail
		INNER JOIN resep_dokter_racikan ON resep_dokter_racikan.no_resep = resep_dokter_racikan_detail.no_resep AND resep_dokter_racikan.no_racik = resep_dokter_racikan_detail.no_racik
		INNER JOIN resep_obat ON resep_obat.no_resep = resep_dokter_racikan_detail.no_resep
		INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
		INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
		INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter_racikan_detail.kode_brng
		INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
		WHERE resep_dokter_racikan_detail.no_resep = ? AND resep_dokter_racikan_detail.kode_brng = ? AND resep_dokter_racikan_detail.no_racik = ?
		LIMIT 1
	`, noResep, kodeBrng, noRacik).Scan(&d.NoRawat, &d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.DokterNik, &d.DokterNama, &d.NikPraktisi,
		&d.IDEncounter, &d.ObatCode, &d.ObatSystem, &d.ObatDisplay, &d.RouteCode, &d.RouteSystem, &d.RouteDisplay,
		&d.DenomCode, &d.DenomSystem, &d.TglJamResep, &d.Jumlah, &d.IDMedication, &d.AturanPakai, &d.StatusLanjut)
	return d, err
}

// parseAturanPakaiSigna — replikasi persis parsing "aturan_pakai" Java (mis.
// "3x1" -> split "x" -> signa1="3", signa2="1"), dipakai apa adanya
// (frequency=signa2, doseQuantity.value=signa1) krn ambigu apakah urutan ini
// bug atau memang konvensi resep lokal — TIDAK dikoreksi, beda dgn 2 bug lain
// di atas yg jelas2 salah (typo tanggal, param ganda).
func parseAturanPakaiSigna(aturanPakai string) (signa1, signa2 string) {
	parts := strings.Split(strings.ToLower(aturanPakai), "x")
	clean := func(s string) string {
		var b strings.Builder
		for _, r := range s {
			if (r >= '0' && r <= '9') || r == '.' {
				b.WriteRune(r)
			}
		}
		return b.String()
	}
	signa1, signa2 = "1", "1"
	if len(parts) > 0 {
		if v := clean(parts[0]); v != "" {
			signa1 = v
		}
	}
	if len(parts) > 1 {
		if v := clean(parts[1]); v != "" {
			signa2 = v
		}
	}
	return signa1, signa2
}

func buildMedicationRequestPayload(id, noResep, kodeBrng, noRacik string, d medicationRequestRowData, ihsPasien, ihsDokter, orgID string) map[string]interface{} {
	signa1, signa2 := parseAturanPakaiSigna(d.AturanPakai)

	prescriptionValue := noResep
	if noRacik != "" {
		prescriptionValue = noResep + "-" + noRacik
	}

	categoryCode, categoryDisplay := "outpatient", "Outpatient"
	if d.StatusLanjut == "Ranap" {
		categoryCode, categoryDisplay = "inpatient", "Inpatient"
	}

	resource := map[string]interface{}{
		"resourceType": "MedicationRequest",
		"identifier": []interface{}{
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/prescription/" + orgID, "use": "official", "value": prescriptionValue},
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/prescription-item/" + orgID, "use": "official", "value": kodeBrng},
		},
		"status": "completed",
		"intent": "order",
		"category": []interface{}{map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/CodeSystem/medicationrequest-category", "code": categoryCode, "display": categoryDisplay,
			}},
		}},
		"medicationReference": map[string]interface{}{"reference": "Medication/" + d.IDMedication, "display": d.ObatDisplay},
		"subject":             map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"encounter":           map[string]interface{}{"reference": "Encounter/" + d.IDEncounter},
		"authoredOn":          strings.ReplaceAll(d.TglJamResep, " ", "T") + "+07:00",
		"requester":           map[string]interface{}{"reference": "Practitioner/" + ihsDokter, "display": d.DokterNama},
		"dosageInstruction": []interface{}{map[string]interface{}{
			"sequence":           1,
			"patientInstruction": d.AturanPakai,
			"timing":             map[string]interface{}{"repeat": map[string]interface{}{"frequency": jsonNumberFromString(signa2), "period": 1, "periodUnit": "d"}},
			"route":              map[string]interface{}{"coding": []interface{}{map[string]interface{}{"system": d.RouteSystem, "code": d.RouteCode, "display": d.RouteDisplay}}},
			"doseAndRate": []interface{}{map[string]interface{}{
				"doseQuantity": map[string]interface{}{"value": jsonNumberFromString(signa1), "unit": d.DenomCode, "system": d.DenomSystem, "code": d.DenomCode},
			}},
		}},
		"dispenseRequest": func() map[string]interface{} {
			dr := map[string]interface{}{
				"quantity": map[string]interface{}{"value": jsonNumberFromString(d.Jumlah), "unit": d.DenomCode, "system": d.DenomSystem, "code": d.DenomCode},
			}
			if noRacik == "" {
				dr["performer"] = map[string]interface{}{"reference": "Organization/" + orgID}
			}
			return dr
		}(),
	}
	if id != "" {
		resource["id"] = id
	}
	return resource
}

// POST /api/satu-sehat/medication-request/send/:no_resep — body
// {"kode_brng":"...","no_racik":""}. no_racik kosong = non-racikan.
func sendMedicationRequestSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			KodeBrng string `json:"kode_brng"`
			NoRacik  string `json:"no_racik"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noResep == "" || strings.TrimSpace(body.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep dan kode_brng wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		rowData, err := fetchMedicationRequestRowData(db, noResep, body.KodeBrng, body.NoRacik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data resep tidak ditemukan"})
			return
		}
		if rowData.IDMedication == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Medication obat ini belum dikirim, kirim dulu di menu Medication"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload := buildMedicationRequestPayload("", noResep, body.KodeBrng, body.NoRacik, rowData, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/MedicationRequest", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idMedReq := satuSehatJSONStr(result["id"])
		if idMedReq == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID MedicationRequest tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if body.NoRacik == "" {
			_, err = db.Exec(`
				INSERT INTO satu_sehat_medicationrequest (no_resep, kode_brng, id_medicationrequest) VALUES (?, ?, ?)
				ON DUPLICATE KEY UPDATE id_medicationrequest = VALUES(id_medicationrequest)
			`, noResep, body.KodeBrng, idMedReq)
		} else {
			_, err = db.Exec(`
				INSERT INTO satu_sehat_medicationrequest_racikan (no_resep, kode_brng, no_racik, id_medicationrequest) VALUES (?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE id_medicationrequest = VALUES(id_medicationrequest)
			`, noResep, body.KodeBrng, body.NoRacik, idMedReq)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MedicationRequest terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "MedicationRequest berhasil dikirim", "id_medicationrequest": idMedReq})
	}
}

// POST /api/satu-sehat/medication-request/update/:no_resep — padanan BtnUpdateActionPerformed.
func updateMedicationRequestSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			KodeBrng string `json:"kode_brng"`
			NoRacik  string `json:"no_racik"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noResep == "" || strings.TrimSpace(body.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep dan kode_brng wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idMedReq string
		if body.NoRacik == "" {
			err = db.QueryRow(`SELECT id_medicationrequest FROM satu_sehat_medicationrequest WHERE no_resep = ? AND kode_brng = ?`, noResep, body.KodeBrng).Scan(&idMedReq)
		} else {
			err = db.QueryRow(`SELECT id_medicationrequest FROM satu_sehat_medicationrequest_racikan WHERE no_resep = ? AND kode_brng = ? AND no_racik = ?`, noResep, body.KodeBrng, body.NoRacik).Scan(&idMedReq)
		}
		if err != nil || idMedReq == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "MedicationRequest belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchMedicationRequestRowData(db, noResep, body.KodeBrng, body.NoRacik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data resep tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload := buildMedicationRequestPayload(idMedReq, noResep, body.KodeBrng, body.NoRacik, rowData, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/MedicationRequest/"+url.PathEscape(idMedReq), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "MedicationRequest berhasil diperbarui", "id_medicationrequest": idMedReq})
	}
}

// ─── MedicationDispense ─────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim SatuSehatKirimMedicationDispense.java. Sumber
// detail_pemberian_obat (obat yg BENERAN diserahkan/diberikan ke pasien,
// beda dari resep_dokter yg cuma catatan peresepan) + aturan_pakai (instruksi
// pakai per baris pemberian) + bangsal/satu_sehat_mapping_lokasi_depo_farmasi
// (lokasi Location — sudah dibangun di Pengaturan > Mapping Lokasi > Depo
// Farmasi). Butuh Encounter DAN Medication obatnya sudah terkirim; kalau ada
// MedicationRequest yg cocok (no_resep+kode_brng), otomatis ditautkan lewat
// authorizingPrescription.
//
// Payload create/update di source asli Khanza TIDAK KONSISTEN satu sama lain
// (3 hal, di sini diselaraskan pakai versi Create yg lebih masuk akal):
//  1. Update pakai identifier.system "medicationdispense"/"medicationdispense-item",
//     Create pakai "prescription"/"prescription-item" (sama konvensi dgn
//     MedicationRequest). Dipakai konsisten "prescription"/"prescription-item".
//  2. Update TIDAK menyertakan authorizingPrescription sama sekali (Create
//     menyertakan kalau MedicationRequest terkait ketemu). Disamakan: selalu
//     dicoba di keduanya.
//  3. Blok "quantity" di Update JSON-nya RUSAK SECARA SINTAKS (kurang koma
//     antara "code" dan "value" — literal string concat Java-nya salah),
//     pasti gagal di-parse server. Dipakai struktur Create yg valid.
//  4. whenPrepared/whenHandedOver di source asli (KEDUA Create & Update)
//     pakai suffix "Z" (UTC) padahal nilainya jam lokal WIB — dikonfirmasi
//     user ini memang bug, dikoreksi jadi "+07:00" spt resource lain
//     (Encounter/Condition/Observation/Procedure/MedicationRequest).

type MedicationDispenseCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	DokterPJ      string `json:"dokter_pj"`
	NoKtpPraktisi string `json:"no_ktp_praktisi"`
	IDEncounter   string `json:"id_encounter"`
	KfaCode       string `json:"kfa_code"`
	KfaSystem     string `json:"kfa_system"`
	KodeBarang    string `json:"kode_barang"`
	KfaDisplay    string `json:"kfa_display"`
	FormCode      string `json:"form_code"`
	FormSystem    string `json:"form_system"`
	FormDisplay   string `json:"form_display"`
	RouteCode     string `json:"route_code"`
	RouteSystem   string `json:"route_system"`
	RouteDisplay  string `json:"route_display"`
	DenomCode     string `json:"denominator_code"`
	DenomSystem   string `json:"denominator_system"`
	TglJamResep   string `json:"tgl_jam_resep"`
	Jumlah        string `json:"jumlah"`
	IDMedication  string `json:"id_medication"`
	AturanPakai   string `json:"aturan_pakai"`
	NoResep       string `json:"no_resep"`
	IDMedDispense string `json:"id_medicationdispense"`
	NoBatch       string `json:"no_batch"`
	NoFaktur      string `json:"no_faktur"`
	TglValidasi   string `json:"tgl_validasi"`
	Status        string `json:"status"`
	IDLocation    string `json:"id_location"`
	AsalDepo      string `json:"asal_depo"`
}

// GET /api/satu-sehat/medication-dispense?tgl_dari=&tgl_sampai=&q= — persis
// tampil() SatuSehatKirimMedicationDispense.java: 2 query (Ralan/Ranap)
// di-append jadi satu daftar.
func getMedicationDispenseCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, detail_pemberian_obat.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''), IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''), IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''),
				IFNULL(satu_sehat_mapping_obat.route_display,''), IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), detail_pemberian_obat.jml, satu_sehat_medication.id_medication,
				IFNULL(aturan_pakai.aturan,''), resep_obat.no_resep, IFNULL(satu_sehat_medicationdispense.id_medicationdispanse,''), detail_pemberian_obat.no_batch,
				detail_pemberian_obat.no_faktur, CONCAT(detail_pemberian_obat.tgl_perawatan,' ',detail_pemberian_obat.jam),
				satu_sehat_mapping_lokasi_depo_farmasi.id_lokasi_satusehat, bangsal.nm_bangsal
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN detail_pemberian_obat ON detail_pemberian_obat.no_rawat = resep_obat.no_rawat
				AND detail_pemberian_obat.tgl_perawatan = resep_obat.tgl_perawatan AND detail_pemberian_obat.jam = resep_obat.jam
			INNER JOIN aturan_pakai ON detail_pemberian_obat.no_rawat = aturan_pakai.no_rawat
				AND detail_pemberian_obat.tgl_perawatan = aturan_pakai.tgl_perawatan AND detail_pemberian_obat.jam = aturan_pakai.jam
				AND detail_pemberian_obat.kode_brng = aturan_pakai.kode_brng
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN bangsal ON bangsal.kd_bangsal = detail_pemberian_obat.kd_bangsal
			INNER JOIN satu_sehat_mapping_lokasi_depo_farmasi ON satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal = bangsal.kd_bangsal
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationdispense ON satu_sehat_medicationdispense.no_rawat = detail_pemberian_obat.no_rawat
				AND satu_sehat_medicationdispense.tgl_perawatan = detail_pemberian_obat.tgl_perawatan
				AND satu_sehat_medicationdispense.jam = detail_pemberian_obat.jam
				AND satu_sehat_medicationdispense.kode_brng = detail_pemberian_obat.kode_brng
				AND satu_sehat_medicationdispense.no_batch = detail_pemberian_obat.no_batch
				AND satu_sehat_medicationdispense.no_faktur = detail_pemberian_obat.no_faktur
			WHERE detail_pemberian_obat.status = ? AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		searchClause := ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR satu_sehat_mapping_obat.kode_brng LIKE ? OR satu_sehat_mapping_obat.obat_display LIKE ?)`
		kw := "%" + keyword + "%"

		result := []MedicationDispenseCandidateRow{}
		for _, status := range []string{"Ralan", "Ranap"} {
			q := query
			args := []interface{}{status, tglDari, tglSampai}
			if keyword != "" {
				q += searchClause
				args = append(args, kw, kw, kw, kw, kw, kw)
			}
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				var r MedicationDispenseCandidateRow
				if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.DokterPJ, &r.NoKtpPraktisi,
					&r.IDEncounter, &r.KfaCode, &r.KfaSystem, &r.KodeBarang, &r.KfaDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay,
					&r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DenomCode, &r.DenomSystem, &r.TglJamResep, &r.Jumlah,
					&r.IDMedication, &r.AturanPakai, &r.NoResep, &r.IDMedDispense, &r.NoBatch, &r.NoFaktur, &r.TglValidasi,
					&r.IDLocation, &r.AsalDepo); err != nil {
					continue
				}
				r.Status = status
				result = append(result, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": result, "total": len(result)})
	}
}

type medicationDispenseRowData struct {
	NoRkmMedis   string
	NamaPasien   string
	NikPasien    string
	DokterNik    string
	DokterNama   string
	NikPraktisi  string
	IDEncounter  string
	ObatDisplay  string
	RouteCode    string
	RouteSystem  string
	RouteDisplay string
	DenomCode    string
	DenomSystem  string
	TglJamResep  string
	Jumlah       string
	IDMedication string
	AturanPakai  string
	NoResep      string
	StatusLanjut string
	IDLocation   string
	AsalDepo     string
}

func fetchMedicationDispenseRowData(db *sql.DB, noRawat, tglPerawatan, jam, kodeBrng, noBatch, noFaktur string) (medicationDispenseRowData, error) {
	var d medicationDispenseRowData
	err := db.QueryRow(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			pegawai.nik, pegawai.nama, IFNULL(pegawai.no_ktp,''),
			satu_sehat_encounter.id_encounter, IFNULL(satu_sehat_mapping_obat.obat_display,''),
			IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''), IFNULL(satu_sehat_mapping_obat.route_display,''),
			IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
			CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan), detail_pemberian_obat.jml, satu_sehat_medication.id_medication,
			IFNULL(aturan_pakai.aturan,''), resep_obat.no_resep, reg_periksa.status_lanjut,
			satu_sehat_mapping_lokasi_depo_farmasi.id_lokasi_satusehat, bangsal.nm_bangsal
		FROM detail_pemberian_obat
		INNER JOIN resep_obat ON resep_obat.no_rawat = detail_pemberian_obat.no_rawat AND resep_obat.tgl_perawatan = detail_pemberian_obat.tgl_perawatan AND resep_obat.jam = detail_pemberian_obat.jam
		INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
		INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
		INNER JOIN aturan_pakai ON detail_pemberian_obat.no_rawat = aturan_pakai.no_rawat AND detail_pemberian_obat.tgl_perawatan = aturan_pakai.tgl_perawatan
			AND detail_pemberian_obat.jam = aturan_pakai.jam AND detail_pemberian_obat.kode_brng = aturan_pakai.kode_brng
		INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = detail_pemberian_obat.kode_brng
		INNER JOIN bangsal ON bangsal.kd_bangsal = detail_pemberian_obat.kd_bangsal
		INNER JOIN satu_sehat_mapping_lokasi_depo_farmasi ON satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal = bangsal.kd_bangsal
		INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
		WHERE detail_pemberian_obat.no_rawat = ? AND detail_pemberian_obat.tgl_perawatan = ? AND detail_pemberian_obat.jam = ?
			AND detail_pemberian_obat.kode_brng = ? AND detail_pemberian_obat.no_batch = ? AND detail_pemberian_obat.no_faktur = ?
		LIMIT 1
	`, noRawat, tglPerawatan, jam, kodeBrng, noBatch, noFaktur).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.DokterNik, &d.DokterNama, &d.NikPraktisi,
		&d.IDEncounter, &d.ObatDisplay, &d.RouteCode, &d.RouteSystem, &d.RouteDisplay, &d.DenomCode, &d.DenomSystem,
		&d.TglJamResep, &d.Jumlah, &d.IDMedication, &d.AturanPakai, &d.NoResep, &d.StatusLanjut, &d.IDLocation, &d.AsalDepo)
	return d, err
}

func buildMedicationDispensePayload(db *sql.DB, id, kodeBrng string, tglValidasi string, d medicationDispenseRowData, ihsPasien, ihsDokter, orgID string) map[string]interface{} {
	signa1, signa2 := parseAturanPakaiSigna(d.AturanPakai)

	categoryCode, categoryDisplay := "outpatient", "Outpatient"
	if d.StatusLanjut == "Ranap" {
		categoryCode, categoryDisplay = "inpatient", "Inpatient"
	}

	resource := map[string]interface{}{
		"resourceType": "MedicationDispense",
		"identifier": []interface{}{
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/prescription/" + orgID, "use": "official", "value": d.NoResep},
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/prescription-item/" + orgID, "use": "official", "value": kodeBrng},
		},
		"status": "completed",
		"category": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category", "code": categoryCode, "display": categoryDisplay,
			}},
		},
		"medicationReference": map[string]interface{}{"reference": "Medication/" + d.IDMedication, "display": d.ObatDisplay},
		"subject":             map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"context":             map[string]interface{}{"reference": "Encounter/" + d.IDEncounter},
		"performer": []interface{}{map[string]interface{}{
			"actor": map[string]interface{}{"reference": "Practitioner/" + ihsDokter, "display": d.DokterNama},
		}},
		"location":       map[string]interface{}{"reference": "Location/" + d.IDLocation, "display": d.AsalDepo},
		"quantity":       map[string]interface{}{"system": d.DenomSystem, "code": d.DenomCode, "value": jsonNumberFromString(d.Jumlah)},
		"whenPrepared":   strings.ReplaceAll(d.TglJamResep, " ", "T") + "+07:00",
		"whenHandedOver": strings.ReplaceAll(tglValidasi, " ", "T") + "+07:00",
		"dosageInstruction": []interface{}{map[string]interface{}{
			"sequence": 1,
			"text":     d.AturanPakai,
			"timing":   map[string]interface{}{"repeat": map[string]interface{}{"frequency": jsonNumberFromString(signa2), "period": 1, "periodUnit": "d"}},
			"route":    map[string]interface{}{"coding": []interface{}{map[string]interface{}{"system": d.RouteSystem, "code": d.RouteCode, "display": d.RouteDisplay}}},
			"doseAndRate": []interface{}{map[string]interface{}{
				"type": map[string]interface{}{
					"coding": []interface{}{map[string]interface{}{
						"system": "http://terminology.hl7.org/CodeSystem/dose-rate-type", "code": "ordered", "display": "Ordered",
					}},
				},
				"doseQuantity": map[string]interface{}{"value": jsonNumberFromString(signa1), "unit": d.DenomCode, "system": d.DenomSystem, "code": d.DenomCode},
			}},
		}},
	}

	var idRequest string
	db.QueryRow(`SELECT id_medicationrequest FROM satu_sehat_medicationrequest WHERE no_resep = ? AND kode_brng = ?`, d.NoResep, kodeBrng).Scan(&idRequest)
	if idRequest != "" {
		resource["authorizingPrescription"] = []interface{}{map[string]interface{}{"reference": "MedicationRequest/" + idRequest}}
	}

	// daysSupply — dihitung dari data yg sudah ada (jumlah diserahkan ÷ dosis
	// per hari), BUKAN dari kolom baru; tidak menyentuh skema Khanza sama
	// sekali. Cuma disertakan kalau kalkulasinya masuk akal (> 0).
	if qty, errQty := strconv.ParseFloat(strings.TrimSpace(d.Jumlah), 64); errQty == nil {
		s1, _ := strconv.ParseFloat(signa1, 64)
		s2, _ := strconv.ParseFloat(signa2, 64)
		if perDay := s1 * s2; perDay > 0 && qty > 0 {
			resource["daysSupply"] = map[string]interface{}{
				"value": qty / perDay, "unit": "Day", "system": "http://unitsofmeasure.org", "code": "d",
			}
		}
	}

	if id != "" {
		resource["id"] = id
	}
	return resource
}

// POST /api/satu-sehat/medication-dispense/send/*no_rawat — body
// {"tgl_perawatan":"...","jam":"...","kode_brng":"...","no_batch":"...","no_faktur":"..."}.
func sendMedicationDispenseSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			Jam          string `json:"jam"`
			KodeBrng     string `json:"kode_brng"`
			NoBatch      string `json:"no_batch"`
			NoFaktur     string `json:"no_faktur"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.Jam == "" || body.KodeBrng == "" || body.NoBatch == "" || body.NoFaktur == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		rowData, err := fetchMedicationDispenseRowData(db, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemberian obat tidak ditemukan"})
			return
		}
		if rowData.IDMedication == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Medication obat ini belum dikirim, kirim dulu di menu Medication"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		tglValidasi := body.TglPerawatan + " " + body.Jam
		payload := buildMedicationDispensePayload(db, "", body.KodeBrng, tglValidasi, rowData, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/MedicationDispense", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "medication_dispense", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idDispense := satuSehatJSONStr(result["id"])
		if idDispense == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID MedicationDispense tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_medicationdispense (no_rawat, tgl_perawatan, jam, kode_brng, no_batch, no_faktur, id_medicationdispanse) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_medicationdispanse = VALUES(id_medicationdispanse)
		`, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur, idDispense); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MedicationDispense terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "medication_dispense", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur)

		c.JSON(http.StatusOK, gin.H{"message": "MedicationDispense berhasil dikirim", "id_medicationdispense": idDispense})
	}
}

// POST /api/satu-sehat/medication-dispense/update/*no_rawat — padanan BtnUpdateActionPerformed.
func updateMedicationDispenseSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			Jam          string `json:"jam"`
			KodeBrng     string `json:"kode_brng"`
			NoBatch      string `json:"no_batch"`
			NoFaktur     string `json:"no_faktur"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.Jam == "" || body.KodeBrng == "" || body.NoBatch == "" || body.NoFaktur == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idDispense string
		if err := db.QueryRow(`
			SELECT id_medicationdispanse FROM satu_sehat_medicationdispense
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam = ? AND kode_brng = ? AND no_batch = ? AND no_faktur = ?
		`, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur).Scan(&idDispense); err != nil || idDispense == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "MedicationDispense belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchMedicationDispenseRowData(db, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemberian obat tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		tglValidasi := body.TglPerawatan + " " + body.Jam
		payload := buildMedicationDispensePayload(db, idDispense, body.KodeBrng, tglValidasi, rowData, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/MedicationDispense/"+url.PathEscape(idDispense), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "medication_dispense", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "medication_dispense", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur)

		c.JSON(http.StatusOK, gin.H{"message": "MedicationDispense berhasil diperbarui", "id_medicationdispense": idDispense})
	}
}

// ─── MedicationStatement ────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim/BtnUpdate SatuSehatKirimMedicationStatement.java.
// Strukturnya persis MedicationRequest (4 kombinasi non-racikan/racikan ×
// Ralan/Ranap, INNER JOIN Encounter+Medication), TAPI:
//  - Sumber waktu pakai resep_obat.tgl_penyerahan/jam_penyerahan (kapan obat
//    DISERAHKAN), bukan tgl_peresepan/jam_peresepan — plus filter tambahan
//    "tgl_penyerahan <> '0000-00-00'" (cuma resep yg SUDAH diserahkan).
//  - Payload TIDAK butuh Practitioner sama sekali (tidak ada requester/
//    performer) — cukup IHS pasien. informationSource-nya malah Patient
//    sendiri (bukan dokter/nakes), sesuai makna MedicationStatement (klaim
//    pasien sudah minum obat sesuai resep), bukan MedicationRequest/Dispense.
//  - identifier cuma SATU (bukan dua spt Request/Dispense), system
//    "medicationstatement" (bukan "prescription"), value = no_resep-kode_brng
//    (+ "-"+no_racik kalau racikan).
//  - Beda dari MedicationDispense: Create & Update di source Khanza-nya
//    KONSISTEN satu sama lain (tidak ada bug spt yg ditemukan di
//    MedicationDispense) — direplikasi apa adanya tanpa koreksi.

type MedicationStatementCandidateRow struct {
	TglRegistrasi   string `json:"tgl_registrasi"`
	NoRawat         string `json:"no_rawat"`
	NoRM            string `json:"no_rm"`
	NamaPasien      string `json:"nama_pasien"`
	NoKtpPasien     string `json:"no_ktp_pasien"`
	DokterPJ        string `json:"dokter_pj"`
	NoKtpPraktisi   string `json:"no_ktp_praktisi"`
	IDEncounter     string `json:"id_encounter"`
	KfaCode         string `json:"kfa_code"`
	KfaSystem       string `json:"kfa_system"`
	KodeBarang      string `json:"kode_barang"`
	KfaDisplay      string `json:"kfa_display"`
	FormCode        string `json:"form_code"`
	FormSystem      string `json:"form_system"`
	FormDisplay     string `json:"form_display"`
	RouteCode       string `json:"route_code"`
	RouteSystem     string `json:"route_system"`
	RouteDisplay    string `json:"route_display"`
	DenomCode       string `json:"denominator_code"`
	DenomSystem     string `json:"denominator_system"`
	WaktuPenyerahan string `json:"waktu_penyerahan"`
	Jumlah          string `json:"jumlah"`
	IDMedication    string `json:"id_medication"`
	AturanPakai     string `json:"aturan_pakai"`
	NoResep         string `json:"no_resep"`
	IDMedStatement  string `json:"id_medicationstatement"`
	NoRacik         string `json:"no_racik"`
	Status          string `json:"status"`
}

// GET /api/satu-sehat/medication-statement?tgl_dari=&tgl_sampai=&q= — persis
// tampil() SatuSehatKirimMedicationStatement.java: 4 query (non-racikan/
// racikan × Ralan/Ranap) di-append jadi satu daftar.
func getMedicationStatementCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))
		kw := "%" + keyword + "%"

		scanRow := func(rows *sql.Rows, status string, racikan bool) (MedicationStatementCandidateRow, error) {
			var r MedicationStatementCandidateRow
			var err error
			if racikan {
				err = rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.DokterPJ, &r.NoKtpPraktisi,
					&r.IDEncounter, &r.KfaCode, &r.KfaSystem, &r.KodeBarang, &r.KfaDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay,
					&r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DenomCode, &r.DenomSystem, &r.WaktuPenyerahan, &r.Jumlah,
					&r.IDMedication, &r.AturanPakai, &r.NoResep, &r.IDMedStatement, &r.NoRacik)
			} else {
				err = rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.DokterPJ, &r.NoKtpPraktisi,
					&r.IDEncounter, &r.KfaCode, &r.KfaSystem, &r.KodeBarang, &r.KfaDisplay, &r.FormCode, &r.FormSystem, &r.FormDisplay,
					&r.RouteCode, &r.RouteSystem, &r.RouteDisplay, &r.DenomCode, &r.DenomSystem, &r.WaktuPenyerahan, &r.Jumlah,
					&r.IDMedication, &r.AturanPakai, &r.NoResep, &r.IDMedStatement)
				r.NoRacik = ""
			}
			r.Status = status
			return r, err
		}

		nonRacikanQuery := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, resep_dokter.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''), IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''), IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''),
				IFNULL(satu_sehat_mapping_obat.route_display,''), IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan), resep_dokter.jml, satu_sehat_medication.id_medication,
				resep_dokter.aturan_pakai, resep_dokter.no_resep, IFNULL(satu_sehat_medicationstatement.id_medicationstatement,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter ON resep_dokter.no_resep = resep_obat.no_resep
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationstatement ON satu_sehat_medicationstatement.no_resep = resep_dokter.no_resep AND satu_sehat_medicationstatement.kode_brng = resep_dokter.kode_brng
			WHERE reg_periksa.status_lanjut = ? AND resep_obat.tgl_penyerahan <> '0000-00-00' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		racikanQuery := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pegawai.nama, IFNULL(pegawai.no_ktp,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_obat.obat_code,''), satu_sehat_mapping_obat.obat_system, resep_dokter_racikan_detail.kode_brng,
				IFNULL(satu_sehat_mapping_obat.obat_display,''), IFNULL(satu_sehat_mapping_obat.form_code,''), IFNULL(satu_sehat_mapping_obat.form_system,''),
				IFNULL(satu_sehat_mapping_obat.form_display,''), IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''),
				IFNULL(satu_sehat_mapping_obat.route_display,''), IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan), resep_dokter_racikan_detail.jml, satu_sehat_medication.id_medication,
				resep_dokter_racikan.aturan_pakai, resep_dokter_racikan.no_resep, IFNULL(satu_sehat_medicationstatement_racikan.id_medicationstatement,''), resep_dokter_racikan_detail.no_racik
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			INNER JOIN pegawai ON resep_obat.kd_dokter = pegawai.nik
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter_racikan ON resep_dokter_racikan.no_resep = resep_obat.no_resep
			INNER JOIN resep_dokter_racikan_detail ON resep_dokter_racikan_detail.no_resep = resep_dokter_racikan.no_resep AND resep_dokter_racikan_detail.no_racik = resep_dokter_racikan.no_racik
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter_racikan_detail.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationstatement_racikan ON satu_sehat_medicationstatement_racikan.no_resep = resep_dokter_racikan_detail.no_resep
				AND satu_sehat_medicationstatement_racikan.kode_brng = resep_dokter_racikan_detail.kode_brng
				AND satu_sehat_medicationstatement_racikan.no_racik = resep_dokter_racikan_detail.no_racik
			WHERE reg_periksa.status_lanjut = ? AND resep_obat.tgl_penyerahan <> '0000-00-00' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		searchClause := ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR satu_sehat_mapping_obat.kode_brng LIKE ? OR satu_sehat_mapping_obat.obat_display LIKE ?)`

		result := []MedicationStatementCandidateRow{}
		branches := []struct {
			query   string
			status  string
			racikan bool
		}{
			{nonRacikanQuery, "Ralan", false},
			{nonRacikanQuery, "Ranap", false},
			{racikanQuery, "Ralan", true},
			{racikanQuery, "Ranap", true},
		}
		for _, b := range branches {
			q := b.query
			args := []interface{}{b.status, tglDari, tglSampai}
			if keyword != "" {
				q += searchClause
				args = append(args, kw, kw, kw, kw, kw, kw)
			}
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				r, err := scanRow(rows, b.status, b.racikan)
				if err != nil {
					continue
				}
				result = append(result, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": result, "total": len(result)})
	}
}

type medicationStatementRowData struct {
	NoRkmMedis      string
	NamaPasien      string
	NikPasien       string
	IDEncounter     string
	ObatDisplay     string
	RouteCode       string
	RouteSystem     string
	RouteDisplay    string
	DenomCode       string
	DenomSystem     string
	WaktuPenyerahan string
	Jumlah          string
	IDMedication    string
	AturanPakai     string
	StatusLanjut    string
}

func fetchMedicationStatementRowData(db *sql.DB, noResep, kodeBrng, noRacik string) (medicationStatementRowData, error) {
	var d medicationStatementRowData
	if noRacik == "" {
		err := db.QueryRow(`
			SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				satu_sehat_encounter.id_encounter, IFNULL(satu_sehat_mapping_obat.obat_display,''),
				IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''), IFNULL(satu_sehat_mapping_obat.route_display,''),
				IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
				CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan), resep_dokter.jml, satu_sehat_medication.id_medication,
				resep_dokter.aturan_pakai, reg_periksa.status_lanjut
			FROM resep_obat
			INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN resep_dokter ON resep_dokter.no_resep = resep_obat.no_resep
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			WHERE resep_obat.no_resep = ? AND resep_dokter.kode_brng = ?
			LIMIT 1
		`, noResep, kodeBrng).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.IDEncounter, &d.ObatDisplay,
			&d.RouteCode, &d.RouteSystem, &d.RouteDisplay, &d.DenomCode, &d.DenomSystem, &d.WaktuPenyerahan, &d.Jumlah, &d.IDMedication, &d.AturanPakai, &d.StatusLanjut)
		return d, err
	}

	err := db.QueryRow(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			satu_sehat_encounter.id_encounter, IFNULL(satu_sehat_mapping_obat.obat_display,''),
			IFNULL(satu_sehat_mapping_obat.route_code,''), IFNULL(satu_sehat_mapping_obat.route_system,''), IFNULL(satu_sehat_mapping_obat.route_display,''),
			IFNULL(satu_sehat_mapping_obat.denominator_code,''), IFNULL(satu_sehat_mapping_obat.denominator_system,''),
			CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan), resep_dokter_racikan_detail.jml, satu_sehat_medication.id_medication,
			resep_dokter_racikan.aturan_pakai, reg_periksa.status_lanjut
		FROM resep_dokter_racikan_detail
		INNER JOIN resep_dokter_racikan ON resep_dokter_racikan.no_resep = resep_dokter_racikan_detail.no_resep AND resep_dokter_racikan.no_racik = resep_dokter_racikan_detail.no_racik
		INNER JOIN resep_obat ON resep_obat.no_resep = resep_dokter_racikan_detail.no_resep
		INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
		INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter_racikan_detail.kode_brng
		INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
		WHERE resep_dokter_racikan_detail.no_resep = ? AND resep_dokter_racikan_detail.kode_brng = ? AND resep_dokter_racikan_detail.no_racik = ?
		LIMIT 1
	`, noResep, kodeBrng, noRacik).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.IDEncounter, &d.ObatDisplay,
		&d.RouteCode, &d.RouteSystem, &d.RouteDisplay, &d.DenomCode, &d.DenomSystem, &d.WaktuPenyerahan, &d.Jumlah, &d.IDMedication, &d.AturanPakai, &d.StatusLanjut)
	return d, err
}

func buildMedicationStatementPayload(id, noResep, kodeBrng, noRacik string, d medicationStatementRowData, ihsPasien, orgID string) map[string]interface{} {
	signa1, signa2 := parseAturanPakaiSigna(d.AturanPakai)

	identValue := noResep + "-" + kodeBrng
	if noRacik != "" {
		identValue = noResep + "-" + kodeBrng + "-" + noRacik
	}

	categoryCode, categoryDisplay := "outpatient", "Outpatient"
	if d.StatusLanjut == "Ranap" {
		categoryCode, categoryDisplay = "inpatient", "Inpatient"
	}

	resource := map[string]interface{}{
		"resourceType": "MedicationStatement",
		"identifier": []interface{}{
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/medicationstatement/" + orgID, "use": "official", "value": identValue},
		},
		"status": "completed",
		"category": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/CodeSystem/medication-statement-category", "code": categoryCode, "display": categoryDisplay,
			}},
		},
		"medicationReference": map[string]interface{}{"reference": "Medication/" + d.IDMedication, "display": d.ObatDisplay},
		"subject":             map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"dosage": []interface{}{map[string]interface{}{
			"text":   d.AturanPakai,
			"timing": map[string]interface{}{"repeat": map[string]interface{}{"frequency": jsonNumberFromString(signa2), "period": 1, "periodUnit": "d"}},
			"route":  map[string]interface{}{"coding": []interface{}{map[string]interface{}{"system": d.RouteSystem, "code": d.RouteCode, "display": d.RouteDisplay}}},
			"doseAndRate": []interface{}{map[string]interface{}{
				"doseQuantity": map[string]interface{}{"value": jsonNumberFromString(signa1), "unit": d.DenomCode, "system": d.DenomSystem, "code": d.DenomCode},
			}},
		}},
		"dateAsserted":      strings.ReplaceAll(d.WaktuPenyerahan, " ", "T") + "+07:00",
		"informationSource": map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"context":           map[string]interface{}{"reference": "Encounter/" + d.IDEncounter},
		"note":              []interface{}{map[string]interface{}{"text": "Pasien sudah memahami aturan pakai yang dijelaskan oleh petugas & Obat sudah diserahkan ke pasien"}},
	}
	if id != "" {
		resource["id"] = id
	}
	return resource
}

// POST /api/satu-sehat/medication-statement/send/:no_resep — body
// {"kode_brng":"...","no_racik":""}.
func sendMedicationStatementSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			KodeBrng string `json:"kode_brng"`
			NoRacik  string `json:"no_racik"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noResep == "" || strings.TrimSpace(body.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep dan kode_brng wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM resep_obat WHERE no_resep = ? LIMIT 1`, noResep).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		rowData, err := fetchMedicationStatementRowData(db, noResep, body.KodeBrng, body.NoRacik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data resep tidak ditemukan"})
			return
		}
		if rowData.IDMedication == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Medication obat ini belum dikirim, kirim dulu di menu Medication"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildMedicationStatementPayload("", noResep, body.KodeBrng, body.NoRacik, rowData, ihsPasien, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/MedicationStatement", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "medication_statement", noResep+"|"+body.KodeBrng+"|"+body.NoRacik, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idStatement := satuSehatJSONStr(result["id"])
		if idStatement == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID MedicationStatement tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if body.NoRacik == "" {
			_, err = db.Exec(`
				INSERT INTO satu_sehat_medicationstatement (no_resep, kode_brng, id_medicationstatement) VALUES (?, ?, ?)
				ON DUPLICATE KEY UPDATE id_medicationstatement = VALUES(id_medicationstatement)
			`, noResep, body.KodeBrng, idStatement)
		} else {
			_, err = db.Exec(`
				INSERT INTO satu_sehat_medicationstatement_racikan (no_resep, kode_brng, no_racik, id_medicationstatement) VALUES (?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE id_medicationstatement = VALUES(id_medicationstatement)
			`, noResep, body.KodeBrng, body.NoRacik, idStatement)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MedicationStatement terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "medication_statement", noResep+"|"+body.KodeBrng+"|"+body.NoRacik)

		c.JSON(http.StatusOK, gin.H{"message": "MedicationStatement berhasil dikirim", "id_medicationstatement": idStatement})
	}
}

// POST /api/satu-sehat/medication-statement/update/:no_resep — padanan BtnUpdateActionPerformed.
func updateMedicationStatementSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			KodeBrng string `json:"kode_brng"`
			NoRacik  string `json:"no_racik"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noResep == "" || strings.TrimSpace(body.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep dan kode_brng wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM resep_obat WHERE no_resep = ? LIMIT 1`, noResep).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idStatement string
		if body.NoRacik == "" {
			err = db.QueryRow(`SELECT id_medicationstatement FROM satu_sehat_medicationstatement WHERE no_resep = ? AND kode_brng = ?`, noResep, body.KodeBrng).Scan(&idStatement)
		} else {
			err = db.QueryRow(`SELECT id_medicationstatement FROM satu_sehat_medicationstatement_racikan WHERE no_resep = ? AND kode_brng = ? AND no_racik = ?`, noResep, body.KodeBrng, body.NoRacik).Scan(&idStatement)
		}
		if err != nil || idStatement == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "MedicationStatement belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchMedicationStatementRowData(db, noResep, body.KodeBrng, body.NoRacik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data resep tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildMedicationStatementPayload(idStatement, noResep, body.KodeBrng, body.NoRacik, rowData, ihsPasien, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/MedicationStatement/"+url.PathEscape(idStatement), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "medication_statement", noResep+"|"+body.KodeBrng+"|"+body.NoRacik, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "medication_statement", noResep+"|"+body.KodeBrng+"|"+body.NoRacik)

		c.JSON(http.StatusOK, gin.H{"message": "MedicationStatement berhasil diperbarui", "id_medicationstatement": idStatement})
	}
}

// ─── AllergyIntolerance ─────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim/BtnUpdate SatuSehatKirimAllergyIntolerance.java.
// Sumbernya field bebas teks pemeriksaan_ralan/ranap.alergi (BUKAN kode
// terstruktur) — Khanza aslinya mencocokkan teks itu ke katalog kata kunci
// SNOMED CT lokal di file ./cache/alergisatusehat.iyem (ketemu di disk,
// diporting APA ADANYA ke bawah sbg allergiKeywordMap, 178 entri, first-match-
// wins persis logic Java: dicari.contains(keyword), case-sensitive). Kalau
// tidak ada kata kunci yg cocok di teks alerginya, Java diam-diam skip baris
// itu (tidak ada capaian sama sekali) — di sini SENGAJA beda: dikembalikan
// error jelas ke user drpd diam-diam gagal, supaya user tahu perlu tambah
// kata kunci baru ke katalog kalau memang terminologi lokalnya belum ada.

type allergiKeywordEntry struct {
	Keyword       string
	Category      string
	CodingSystem  string
	CodingCode    string
	CodingDisplay string
	Text          string
}

var allergiKeywordMap = []allergiKeywordEntry{
	{"roti", "food", "http://snomed.info/sct", "89811004", "Gluten", "Alergi bahan gluten, khususnya ketika makan roti gandum"},
	{"gandum", "food", "http://snomed.info/sct", "89811004", "Gluten", "Alergi bahan gluten, khususnya ketika makan roti gandum"},
	{"gluten", "food", "http://snomed.info/sct", "89811004", "Gluten", "Alergi bahan gluten, khususnya ketika makan roti gandum"},
	{"tepung", "food", "http://snomed.info/sct", "89811004", "Gluten", "Alergi bahan gluten, khususnya ketika makan roti gandum"},
	{"sereal", "food", "http://snomed.info/sct", "89811004", "Gluten", "Alergi bahan gluten, khususnya ketika makan roti gandum"},
	{"kacang tanah", "food", "http://snomed.info/sct", "406455002", "Peanut", "Alergi kacang tanah dan olahannya"},
	{"selai kacang", "food", "http://snomed.info/sct", "406455002", "Peanut", "Alergi kacang tanah dan olahannya"},
	{"groundnut", "food", "http://snomed.info/sct", "406455002", "Peanut", "Alergi kacang tanah dan olahannya"},
	{"peanut", "food", "http://snomed.info/sct", "406455002", "Peanut", "Alergi kacang tanah dan olahannya"},
	{"almond", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"kenari", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"mede", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"pistachio", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"hazelnut", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"kacang pohon", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"walnut", "food", "http://snomed.info/sct", "735029006", "Tree nut", "Alergi kacang pohon (almond, kenari, mede, pistachio)"},
	{"susu", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"keju", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"yogurt", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"mentega", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"laktosa", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"dairy", "food", "http://snomed.info/sct", "227183005", "Milk protein", "Alergi protein susu sapi (susu, keju, yogurt)"},
	{"telur", "food", "http://snomed.info/sct", "102263004", "Eggs", "Alergi telur ayam dan olahannya"},
	{"putih telur", "food", "http://snomed.info/sct", "102263004", "Eggs", "Alergi telur ayam dan olahannya"},
	{"kuning telur", "food", "http://snomed.info/sct", "102263004", "Eggs", "Alergi telur ayam dan olahannya"},
	{"egg", "food", "http://snomed.info/sct", "102263004", "Eggs", "Alergi telur ayam dan olahannya"},
	{"udang", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"kerang", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"kepiting", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"lobster", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"cumi", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"seafood", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"hasil laut", "food", "http://snomed.info/sct", "44027008", "Seafood", "Alergi makanan laut (kerang, udang, kepiting, lobster)"},
	{"ikan", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"salmon", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"tuna", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"lele", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"mujair", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"bandeng", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"cakalang", "food", "http://snomed.info/sct", "227037002", "Fish", "Alergi ikan (salmon, tuna, cod, tilapia)"},
	{"kedelai", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"tahu", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"tempe", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"susu kedelai", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"tofu", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"soy", "food", "http://snomed.info/sct", "256349002", "Soya bean", "Alergi kedelai dan produk kedelai (tempe, tahu, susu kedelai)"},
	{"wijen", "food", "http://snomed.info/sct", "57126000", "Sesame seed", "Alergi biji wijen, minyak wijen, dan tahini"},
	{"biji wijen", "food", "http://snomed.info/sct", "57126000", "Sesame seed", "Alergi biji wijen, minyak wijen, dan tahini"},
	{"minyak wijen", "food", "http://snomed.info/sct", "57126000", "Sesame seed", "Alergi biji wijen, minyak wijen, dan tahini"},
	{"tahini", "food", "http://snomed.info/sct", "57126000", "Sesame seed", "Alergi biji wijen, minyak wijen, dan tahini"},
	{"sesame", "food", "http://snomed.info/sct", "57126000", "Sesame seed", "Alergi biji wijen, minyak wijen, dan tahini"},
	{"terigu", "food", "http://snomed.info/sct", "412071004", "Wheat", "Alergi gandum dan produk berbahan tepung terigu"},
	{"wheat", "food", "http://snomed.info/sct", "412071004", "Wheat", "Alergi gandum dan produk berbahan tepung terigu"},
	{"pasta", "food", "http://snomed.info/sct", "412071004", "Wheat", "Alergi gandum dan produk berbahan tepung terigu"},
	{"mie", "food", "http://snomed.info/sct", "412071004", "Wheat", "Alergi gandum dan produk berbahan tepung terigu"},
	{"biskuit", "food", "http://snomed.info/sct", "412071004", "Wheat", "Alergi gandum dan produk berbahan tepung terigu"},
	{"amoksisilin", "medication", "http://snomed.info/sct", "372687004", "Amoxicillin", "Alergi amoksisilin golongan antibiotik penisilin"},
	{"amoxicillin", "medication", "http://snomed.info/sct", "372687004", "Amoxicillin", "Alergi amoksisilin golongan antibiotik penisilin"},
	{"ampisilin", "medication", "http://snomed.info/sct", "372687004", "Amoxicillin", "Alergi amoksisilin golongan antibiotik penisilin"},
	{"penisilin", "medication", "http://snomed.info/sct", "764146007", "Penicillin", "Alergi penisilin dan seluruh turunan golongannya"},
	{"penicillin", "medication", "http://snomed.info/sct", "764146007", "Penicillin", "Alergi penisilin dan seluruh turunan golongannya"},
	{"sefalosporin", "medication", "http://snomed.info/sct", "372687004", "Cephalosporin", "Alergi sefalosporin (cefixime, cefadroxil, ceftriaxone)"},
	{"cefixime", "medication", "http://snomed.info/sct", "372687004", "Cephalosporin", "Alergi sefalosporin (cefixime, cefadroxil, ceftriaxone)"},
	{"cefadroxil", "medication", "http://snomed.info/sct", "372687004", "Cephalosporin", "Alergi sefalosporin (cefixime, cefadroxil, ceftriaxone)"},
	{"ceftriaxone", "medication", "http://snomed.info/sct", "372687004", "Cephalosporin", "Alergi sefalosporin (cefixime, cefadroxil, ceftriaxone)"},
	{"cefuroxime", "medication", "http://snomed.info/sct", "372687004", "Cephalosporin", "Alergi sefalosporin (cefixime, cefadroxil, ceftriaxone)"},
	{"ibuprofen", "medication", "http://snomed.info/sct", "387207008", "Ibuprofen", "Alergi ibuprofen dan golongan NSAID"},
	{"brufen", "medication", "http://snomed.info/sct", "387207008", "Ibuprofen", "Alergi ibuprofen dan golongan NSAID"},
	{"advil", "medication", "http://snomed.info/sct", "387207008", "Ibuprofen", "Alergi ibuprofen dan golongan NSAID"},
	{"NSAID", "medication", "http://snomed.info/sct", "387207008", "Ibuprofen", "Alergi ibuprofen dan golongan NSAID"},
	{"anti nyeri", "medication", "http://snomed.info/sct", "387207008", "Ibuprofen", "Alergi ibuprofen dan golongan NSAID"},
	{"aspirin", "medication", "http://snomed.info/sct", "387458008", "Aspirin", "Alergi aspirin / asetosal dan turunan salisilat"},
	{"asetosal", "medication", "http://snomed.info/sct", "387458008", "Aspirin", "Alergi aspirin / asetosal dan turunan salisilat"},
	{"salisilat", "medication", "http://snomed.info/sct", "387458008", "Aspirin", "Alergi aspirin / asetosal dan turunan salisilat"},
	{"sulfonamida", "medication", "http://snomed.info/sct", "363528007", "Sulfonamide", "Alergi sulfonamida (kotrimoksazol, sulfametoksazol)"},
	{"kotrimoksazol", "medication", "http://snomed.info/sct", "363528007", "Sulfonamide", "Alergi sulfonamida (kotrimoksazol, sulfametoksazol)"},
	{"sulfametoksazol", "medication", "http://snomed.info/sct", "363528007", "Sulfonamide", "Alergi sulfonamida (kotrimoksazol, sulfametoksazol)"},
	{"bactrim", "medication", "http://snomed.info/sct", "363528007", "Sulfonamide", "Alergi sulfonamida (kotrimoksazol, sulfametoksazol)"},
	{"kodein", "medication", "http://snomed.info/sct", "372691009", "Codeine", "Alergi kodein dan golongan opioid"},
	{"codeine", "medication", "http://snomed.info/sct", "372691009", "Codeine", "Alergi kodein dan golongan opioid"},
	{"opioid", "medication", "http://snomed.info/sct", "372691009", "Codeine", "Alergi kodein dan golongan opioid"},
	{"morfin", "medication", "http://snomed.info/sct", "372691009", "Codeine", "Alergi kodein dan golongan opioid"},
	{"tramadol", "medication", "http://snomed.info/sct", "372691009", "Codeine", "Alergi kodein dan golongan opioid"},
	{"warfarin", "medication", "http://snomed.info/sct", "372756006", "Warfarin", "Reaksi alergi terhadap warfarin (antikoagulan oral)"},
	{"simarc", "medication", "http://snomed.info/sct", "372756006", "Warfarin", "Reaksi alergi terhadap warfarin (antikoagulan oral)"},
	{"antikoagulan", "medication", "http://snomed.info/sct", "372756006", "Warfarin", "Reaksi alergi terhadap warfarin (antikoagulan oral)"},
	{"pengencer darah", "medication", "http://snomed.info/sct", "372756006", "Warfarin", "Reaksi alergi terhadap warfarin (antikoagulan oral)"},
	{"metformin", "medication", "http://snomed.info/sct", "387467008", "Metformin", "Intoleransi atau alergi metformin (obat diabetes oral)"},
	{"glucophage", "medication", "http://snomed.info/sct", "387467008", "Metformin", "Intoleransi atau alergi metformin (obat diabetes oral)"},
	{"antidiabetik", "medication", "http://snomed.info/sct", "387467008", "Metformin", "Intoleransi atau alergi metformin (obat diabetes oral)"},
	{"karbamazepin", "medication", "http://snomed.info/sct", "372894003", "Carbamazepine", "Alergi karbamazepin (antikonvulsan, stabilisator mood)"},
	{"carbamazepine", "medication", "http://snomed.info/sct", "372894003", "Carbamazepine", "Alergi karbamazepin (antikonvulsan, stabilisator mood)"},
	{"tegretol", "medication", "http://snomed.info/sct", "372894003", "Carbamazepine", "Alergi karbamazepin (antikonvulsan, stabilisator mood)"},
	{"epilepsi", "medication", "http://snomed.info/sct", "372894003", "Carbamazepine", "Alergi karbamazepin (antikonvulsan, stabilisator mood)"},
	{"kejang", "medication", "http://snomed.info/sct", "372894003", "Carbamazepine", "Alergi karbamazepin (antikonvulsan, stabilisator mood)"},
	{"kloramfenikol", "medication", "http://snomed.info/sct", "387105006", "Chloramphenicol", "Alergi kloramfenikol (antibiotik spektrum luas)"},
	{"chloramphenicol", "medication", "http://snomed.info/sct", "387105006", "Chloramphenicol", "Alergi kloramfenikol (antibiotik spektrum luas)"},
	{"tetes mata", "medication", "http://snomed.info/sct", "387105006", "Chloramphenicol", "Alergi kloramfenikol (antibiotik spektrum luas)"},
	{"tetrasiklin", "medication", "http://snomed.info/sct", "372840008", "Tetracycline", "Alergi tetrasiklin (antibiotik doksisiklin, minosiklin)"},
	{"tetracycline", "medication", "http://snomed.info/sct", "372840008", "Tetracycline", "Alergi tetrasiklin (antibiotik doksisiklin, minosiklin)"},
	{"doksisiklin", "medication", "http://snomed.info/sct", "372840008", "Tetracycline", "Alergi tetrasiklin (antibiotik doksisiklin, minosiklin)"},
	{"minosiklin", "medication", "http://snomed.info/sct", "372840008", "Tetracycline", "Alergi tetrasiklin (antibiotik doksisiklin, minosiklin)"},
	{"vibramycin", "medication", "http://snomed.info/sct", "372840008", "Tetracycline", "Alergi tetrasiklin (antibiotik doksisiklin, minosiklin)"},
	{"serbuk sari", "environment", "http://snomed.info/sct", "256259004", "Pollen", "Alergi serbuk sari bunga (pollinosis / rinitis alergi musiman)"},
	{"pollen", "environment", "http://snomed.info/sct", "256259004", "Pollen", "Alergi serbuk sari bunga (pollinosis / rinitis alergi musiman)"},
	{"rinitis", "environment", "http://snomed.info/sct", "256259004", "Pollen", "Alergi serbuk sari bunga (pollinosis / rinitis alergi musiman)"},
	{"bersin", "environment", "http://snomed.info/sct", "256259004", "Pollen", "Alergi serbuk sari bunga (pollinosis / rinitis alergi musiman)"},
	{"pollinosis", "environment", "http://snomed.info/sct", "256259004", "Pollen", "Alergi serbuk sari bunga (pollinosis / rinitis alergi musiman)"},
	{"tungau", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"debu", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"debu rumah", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"dust mite", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"kasur", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"bantal", "environment", "http://snomed.info/sct", "84163006", "House dust mite", "Alergi tungau debu rumah (Dermatophagoides spp.)"},
	{"kucing", "environment", "http://snomed.info/sct", "260152009", "Cat dander", "Alergi bulu dan protein kucing (Fel d 1)"},
	{"bulu kucing", "environment", "http://snomed.info/sct", "260152009", "Cat dander", "Alergi bulu dan protein kucing (Fel d 1)"},
	{"cat dander", "environment", "http://snomed.info/sct", "260152009", "Cat dander", "Alergi bulu dan protein kucing (Fel d 1)"},
	{"anjing", "environment", "http://snomed.info/sct", "256440009", "Dog dander", "Alergi bulu dan protein anjing (Can f 1, Can f 2)"},
	{"bulu anjing", "environment", "http://snomed.info/sct", "256440009", "Dog dander", "Alergi bulu dan protein anjing (Can f 1, Can f 2)"},
	{"dog dander", "environment", "http://snomed.info/sct", "256440009", "Dog dander", "Alergi bulu dan protein anjing (Can f 1, Can f 2)"},
	{"kecoak", "environment", "http://snomed.info/sct", "84333007", "Cockroach", "Alergi kecoak (Blo t 5, Per a 1)"},
	{"lipas", "environment", "http://snomed.info/sct", "84333007", "Cockroach", "Alergi kecoak (Blo t 5, Per a 1)"},
	{"cockroach", "environment", "http://snomed.info/sct", "84333007", "Cockroach", "Alergi kecoak (Blo t 5, Per a 1)"},
	{"jamur", "environment", "http://snomed.info/sct", "105824000", "Mold", "Alergi jamur / kapang (Aspergillus, Alternaria, Cladosporium)"},
	{"kapang", "environment", "http://snomed.info/sct", "105824000", "Mold", "Alergi jamur / kapang (Aspergillus, Alternaria, Cladosporium)"},
	{"mold", "environment", "http://snomed.info/sct", "105824000", "Mold", "Alergi jamur / kapang (Aspergillus, Alternaria, Cladosporium)"},
	{"aspergillus", "environment", "http://snomed.info/sct", "105824000", "Mold", "Alergi jamur / kapang (Aspergillus, Alternaria, Cladosporium)"},
	{"alternaria", "environment", "http://snomed.info/sct", "105824000", "Mold", "Alergi jamur / kapang (Aspergillus, Alternaria, Cladosporium)"},
	{"lateks", "environment", "http://snomed.info/sct", "256245006", "Latex", "Alergi lateks / karet alam (sarung tangan, balon, kateter)"},
	{"karet", "environment", "http://snomed.info/sct", "256245006", "Latex", "Alergi lateks / karet alam (sarung tangan, balon, kateter)"},
	{"latex", "environment", "http://snomed.info/sct", "256245006", "Latex", "Alergi lateks / karet alam (sarung tangan, balon, kateter)"},
	{"sarung tangan", "environment", "http://snomed.info/sct", "256245006", "Latex", "Alergi lateks / karet alam (sarung tangan, balon, kateter)"},
	{"lebah", "environment", "http://snomed.info/sct", "9104001", "Bee venom protein", "Alergi sengatan lebah dan tawon (Hymenoptera venom)"},
	{"tawon", "environment", "http://snomed.info/sct", "9104001", "Bee venom protein", "Alergi sengatan lebah dan tawon (Hymenoptera venom)"},
	{"sengatan", "environment", "http://snomed.info/sct", "9104001", "Bee venom protein", "Alergi sengatan lebah dan tawon (Hymenoptera venom)"},
	{"bee", "environment", "http://snomed.info/sct", "9104001", "Bee venom protein", "Alergi sengatan lebah dan tawon (Hymenoptera venom)"},
	{"wasp", "environment", "http://snomed.info/sct", "9104001", "Bee venom protein", "Alergi sengatan lebah dan tawon (Hymenoptera venom)"},
	{"nikel", "environment", "http://snomed.info/sct", "256464006", "Nickel", "Alergi kontak nikel (perhiasan, sabuk, kancing logam)"},
	{"nickel", "environment", "http://snomed.info/sct", "256464006", "Nickel", "Alergi kontak nikel (perhiasan, sabuk, kancing logam)"},
	{"logam", "environment", "http://snomed.info/sct", "256464006", "Nickel", "Alergi kontak nikel (perhiasan, sabuk, kancing logam)"},
	{"perhiasan", "environment", "http://snomed.info/sct", "256464006", "Nickel", "Alergi kontak nikel (perhiasan, sabuk, kancing logam)"},
	{"sabuk", "environment", "http://snomed.info/sct", "256464006", "Nickel", "Alergi kontak nikel (perhiasan, sabuk, kancing logam)"},
	{"rumput", "environment", "http://snomed.info/sct", "116797008", "Grass pollen", "Alergi serbuk sari rumput (Timothy grass, Bermuda grass)"},
	{"serbuk rumput", "environment", "http://snomed.info/sct", "116797008", "Grass pollen", "Alergi serbuk sari rumput (Timothy grass, Bermuda grass)"},
	{"grass pollen", "environment", "http://snomed.info/sct", "116797008", "Grass pollen", "Alergi serbuk sari rumput (Timothy grass, Bermuda grass)"},
	{"darah", "biologic", "http://snomed.info/sct", "116154003", "Blood product", "Alergi produk darah / reaksi transfusi"},
	{"transfusi", "biologic", "http://snomed.info/sct", "116154003", "Blood product", "Alergi produk darah / reaksi transfusi"},
	{"blood product", "biologic", "http://snomed.info/sct", "116154003", "Blood product", "Alergi produk darah / reaksi transfusi"},
	{"plasma", "biologic", "http://snomed.info/sct", "116154003", "Blood product", "Alergi produk darah / reaksi transfusi"},
	{"trombosit", "biologic", "http://snomed.info/sct", "116154003", "Blood product", "Alergi produk darah / reaksi transfusi"},
	{"vaksin", "biologic", "http://snomed.info/sct", "59037007", "Vaccine allergy", "Reaksi alergi terhadap vaksin berbasis telur (influenza)"},
	{"imunisasi", "biologic", "http://snomed.info/sct", "59037007", "Vaccine allergy", "Reaksi alergi terhadap vaksin berbasis telur (influenza)"},
	{"influenza", "biologic", "http://snomed.info/sct", "59037007", "Vaccine allergy", "Reaksi alergi terhadap vaksin berbasis telur (influenza)"},
	{"vaccine", "biologic", "http://snomed.info/sct", "59037007", "Vaccine allergy", "Reaksi alergi terhadap vaksin berbasis telur (influenza)"},
	{"parfum", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"wewangian", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"fragrans", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"kosmetik", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"deodoran", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"pewangi", "other", "http://snomed.info/sct", "406460000", "Perfume", "Alergi parfum dan fragrans (kosmetik, deterjen pewangi)"},
	{"kontras", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"iodin", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"iodine", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"CT scan", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"rontgen", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"angiografi", "other", "http://snomed.info/sct", "762766007", "Iodinated contrast medium", "Alergi kontras iodin untuk radiologi (CT scan, angiografi)"},
	{"klorheksidin", "other", "http://snomed.info/sct", "52416002", "Chlorhexidine", "Alergi klorheksidin (antiseptik luka dan obat kumur)"},
	{"chlorhexidine", "other", "http://snomed.info/sct", "52416002", "Chlorhexidine", "Alergi klorheksidin (antiseptik luka dan obat kumur)"},
	{"antiseptik", "other", "http://snomed.info/sct", "52416002", "Chlorhexidine", "Alergi klorheksidin (antiseptik luka dan obat kumur)"},
	{"betadine", "other", "http://snomed.info/sct", "52416002", "Chlorhexidine", "Alergi klorheksidin (antiseptik luka dan obat kumur)"},
	{"obat kumur", "other", "http://snomed.info/sct", "52416002", "Chlorhexidine", "Alergi klorheksidin (antiseptik luka dan obat kumur)"},
	{"pengawet", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
	{"sulfit", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
	{"benzoat", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
	{"paraben", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
	{"makanan kemasan", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
	{"additif", "other", "http://snomed.info/sct", "256440009", "Food preservative", "Alergi pengawet makanan (sulfit, benzoat, paraben)"},
}

var allergiCleaner = strings.NewReplacer("\r\n", "", "\r", "", "\n", "", "\t", "")

// matchAlergiKeyword — persis logic Java: first-match-wins substring search
// (case-sensitive) di allergiKeywordMap.
func matchAlergiKeyword(alergiText string) *allergiKeywordEntry {
	cleaned := allergiCleaner.Replace(alergiText)
	for i := range allergiKeywordMap {
		if strings.Contains(cleaned, allergiKeywordMap[i].Keyword) {
			return &allergiKeywordMap[i]
		}
	}
	return nil
}

type AllergyIntoleranceCandidateRow struct {
	TglRegistrasi        string `json:"tgl_registrasi"`
	NoRawat              string `json:"no_rawat"`
	NoRM                 string `json:"no_rm"`
	NamaPasien           string `json:"nama_pasien"`
	NoKtpPasien          string `json:"no_ktp_pasien"`
	IDEncounter          string `json:"id_encounter"`
	Alergi               string `json:"alergi"`
	Petugas              string `json:"petugas"`
	NoKtpPraktisi        string `json:"no_ktp_praktisi"`
	TglPerawatan         string `json:"tgl_perawatan"`
	JamRawat             string `json:"jam_rawat"`
	IDAllergyIntolerance string `json:"id_allergy_intolerance"`
	Status               string `json:"status"`
}

// GET /api/satu-sehat/allergy-intolerance?tgl_dari=&tgl_sampai=&q= — persis
// tampil() SatuSehatKirimAllergyIntolerance.java: 2 query (Ralan/Ranap)
// di-append jadi satu daftar, sumber pemeriksaan_ralan/ranap.alergi.
func getAllergyIntoleranceCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				satu_sehat_encounter.id_encounter, %[1]s.alergi,
				IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
				IFNULL(%[1]s.tgl_perawatan,''), IFNULL(%[1]s.jam_rawat,''),
				IFNULL(satu_sehat_allergy_intolerance.id_allergy_intolerance,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN %[1]s ON %[1]s.no_rawat = reg_periksa.no_rawat
			LEFT JOIN pegawai ON pegawai.nik = %[1]s.nip
			LEFT JOIN satu_sehat_allergy_intolerance ON satu_sehat_allergy_intolerance.no_rawat = %[1]s.no_rawat
				AND satu_sehat_allergy_intolerance.tgl_perawatan = %[1]s.tgl_perawatan
				AND satu_sehat_allergy_intolerance.jam_rawat = %[1]s.jam_rawat
				AND satu_sehat_allergy_intolerance.status = ?
			WHERE %[1]s.alergi <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		searchClause := ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.no_ktp LIKE ? OR pegawai.nama LIKE ?)`
		kw := "%" + keyword + "%"

		result := []AllergyIntoleranceCandidateRow{}
		for _, sumberTable := range []string{"pemeriksaan_ralan", "pemeriksaan_ranap"} {
			status := "Ralan"
			if sumberTable == "pemeriksaan_ranap" {
				status = "Ranap"
			}
			q := fmt.Sprintf(query, sumberTable)
			args := []interface{}{status, tglDari, tglSampai}
			if keyword != "" {
				q += searchClause
				args = append(args, kw, kw, kw, kw, kw, kw)
			}
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				var r AllergyIntoleranceCandidateRow
				if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.IDEncounter, &r.Alergi,
					&r.Petugas, &r.NoKtpPraktisi, &r.TglPerawatan, &r.JamRawat, &r.IDAllergyIntolerance); err != nil {
					continue
				}
				r.Status = status
				result = append(result, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": result, "total": len(result)})
	}
}

type allergyIntoleranceRowData struct {
	NoRkmMedis    string
	NamaPasien    string
	NikPasien     string
	DokterNik     string
	DokterNama    string
	NikPraktisi   string
	IDEncounter   string
	Alergi        string
	TglRegistrasi string
}

func fetchAllergyIntoleranceRowData(db *sql.DB, noRawat, tglPerawatan, jamRawat, statusLanjut string) (allergyIntoleranceRowData, error) {
	sumberTable := "pemeriksaan_ralan"
	if statusLanjut == "Ranap" {
		sumberTable = "pemeriksaan_ranap"
	}
	var d allergyIntoleranceRowData
	query := fmt.Sprintf(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			IFNULL(pegawai.nik,''), IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
			satu_sehat_encounter.id_encounter, %[1]s.alergi,
			CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg)
		FROM %[1]s
		INNER JOIN reg_periksa ON %[1]s.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
		LEFT JOIN pegawai ON pegawai.nik = %[1]s.nip
		WHERE %[1]s.no_rawat = ? AND %[1]s.tgl_perawatan = ? AND %[1]s.jam_rawat = ?
		LIMIT 1
	`, sumberTable)
	err := db.QueryRow(query, noRawat, tglPerawatan, jamRawat).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien,
		&d.DokterNik, &d.DokterNama, &d.NikPraktisi, &d.IDEncounter, &d.Alergi, &d.TglRegistrasi)
	return d, err
}

func buildAllergyIntolerancePayload(id, noRawat, tglPerawatan, jamRawat string, d allergyIntoleranceRowData, entry *allergiKeywordEntry, ihsPasien, ihsDokter, orgID string) map[string]interface{} {
	resource := map[string]interface{}{
		"resourceType": "AllergyIntolerance",
		"identifier": []interface{}{
			map[string]interface{}{"system": "http://sys-ids.kemkes.go.id/allergy/" + orgID, "use": "official", "value": noRawat},
		},
		"clinicalStatus": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active", "display": "Active",
			}},
		},
		"verificationStatus": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed", "display": "Confirmed",
			}},
		},
		"category": []interface{}{entry.Category},
		"code": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": entry.CodingSystem, "code": entry.CodingCode, "display": entry.CodingDisplay,
			}},
			"text": entry.Text,
		},
		"patient": map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + d.IDEncounter,
			"display":   "Kunjungan " + d.NamaPasien + " pada tanggal " + d.TglRegistrasi + " dengan nomor kunjungan " + noRawat,
		},
		"recordedDate": strings.ReplaceAll(tglPerawatan+" "+jamRawat, " ", "T") + "+07:00",
		"recorder":     map[string]interface{}{"reference": "Practitioner/" + ihsDokter, "display": d.DokterNama},
	}
	if id != "" {
		resource["id"] = id
	}
	return resource
}

// POST /api/satu-sehat/allergy-intolerance/send/*no_rawat — body
// {"tgl_perawatan":"...","jam_rawat":"...","status_lanjut":"Ralan|Ranap"}.
func sendAllergyIntoleranceSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			JamRawat     string `json:"jam_rawat"`
			StatusLanjut string `json:"status_lanjut"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.StatusLanjut == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		rowData, err := fetchAllergyIntoleranceRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan tidak ditemukan"})
			return
		}

		entry := matchAlergiKeyword(rowData.Alergi)
		if entry == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada kata kunci yang cocok di katalog alergi lokal untuk teks: \"" + rowData.Alergi + "\" — perlu ditambahkan ke katalog dulu"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload := buildAllergyIntolerancePayload("", noRawat, body.TglPerawatan, body.JamRawat, rowData, entry, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/AllergyIntolerance", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "allergy_intolerance", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idAllergy := satuSehatJSONStr(result["id"])
		if idAllergy == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID AllergyIntolerance tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_allergy_intolerance (no_rawat, tgl_perawatan, jam_rawat, status, id_allergy_intolerance) VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_allergy_intolerance = VALUES(id_allergy_intolerance)
		`, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut, idAllergy); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "AllergyIntolerance terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "allergy_intolerance", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "AllergyIntolerance berhasil dikirim", "id_allergy_intolerance": idAllergy})
	}
}

// POST /api/satu-sehat/allergy-intolerance/update/*no_rawat — padanan BtnUpdateActionPerformed.
func updateAllergyIntoleranceSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			JamRawat     string `json:"jam_rawat"`
			StatusLanjut string `json:"status_lanjut"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.StatusLanjut == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idAllergy string
		if err := db.QueryRow(`
			SELECT id_allergy_intolerance FROM satu_sehat_allergy_intolerance
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND status = ?
		`, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut).Scan(&idAllergy); err != nil || idAllergy == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "AllergyIntolerance belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchAllergyIntoleranceRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan tidak ditemukan"})
			return
		}

		entry := matchAlergiKeyword(rowData.Alergi)
		if entry == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada kata kunci yang cocok di katalog alergi lokal untuk teks: \"" + rowData.Alergi + "\" — perlu ditambahkan ke katalog dulu"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.DokterNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload := buildAllergyIntolerancePayload(idAllergy, noRawat, body.TglPerawatan, body.JamRawat, rowData, entry, ihsPasien, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/AllergyIntolerance/"+url.PathEscape(idAllergy), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "allergy_intolerance", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "allergy_intolerance", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "AllergyIntolerance berhasil diperbarui", "id_allergy_intolerance": idAllergy})
	}
}

// ─── Procedure ──────────────────────────────────────────────────────────────
// Padanan tampil() + BtnKirim/BtnUpdate SatuSehatKirimProcedure.java:
// prosedur_pasien.kode di Khanza SUDAH berupa kode ICD-9-CM langsung, INNER
// JOIN ke icd9 utk deskripsi_panjang (nama prosedur/display). Beda dari
// Condition/Observation: TIDAK ada field performer/practitioner sama sekali
// di payload Procedure ini — cuma subject+encounter+performedPeriod.

type ProcedureCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	SttsRawat     string `json:"stts_rawat"`
	SttsLanjut    string `json:"stts_lanjut"`
	TanggalPulang string `json:"tanggal_pulang"`
	IDEncounter   string `json:"id_encounter"`
	KodeICD9      string `json:"kode_icd9"`
	NamaProsedur  string `json:"nama_prosedur"`
	IDProcedure   string `json:"id_procedure"`
}

// GET /api/satu-sehat/procedure?tgl_dari=&tgl_sampai=&q= — persis tampil()
// SatuSehatKirimProcedure.java. Format tanggal (kolom 1/8) ISO
// "yyyy-mm-ddTHH:mm:ss+07:00" persis Java (beda dari Condition yg pakai
// spasi) krn dipakai langsung sbg performedPeriod.start/end saat kirim.
func getProcedureCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				CONCAT(reg_periksa.tgl_registrasi,'T',reg_periksa.jam_reg,'+07:00'),
				reg_periksa.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				IFNULL(pasien.no_ktp,''),
				reg_periksa.stts,
				reg_periksa.status_lanjut,
				CONCAT(reg_periksa.tgl_registrasi,'T',reg_periksa.jam_reg,'+07:00'),
				satu_sehat_encounter.id_encounter,
				prosedur_pasien.kode,
				IFNULL(icd9.deskripsi_panjang,''),
				IFNULL(satu_sehat_procedure.id_procedure,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN prosedur_pasien ON prosedur_pasien.no_rawat = reg_periksa.no_rawat
			INNER JOIN icd9 ON prosedur_pasien.kode = icd9.kode
			LEFT JOIN satu_sehat_procedure ON satu_sehat_procedure.no_rawat = prosedur_pasien.no_rawat
				AND satu_sehat_procedure.kode = prosedur_pasien.kode
				AND satu_sehat_procedure.status = prosedur_pasien.status
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR prosedur_pasien.kode LIKE ? OR icd9.deskripsi_panjang LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []ProcedureCandidateRow{}
		for rows.Next() {
			var r ProcedureCandidateRow
			if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.SttsRawat, &r.SttsLanjut, &r.TanggalPulang, &r.IDEncounter,
				&r.KodeICD9, &r.NamaProsedur, &r.IDProcedure); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type procedureRowData struct {
	NoRkmMedis    string
	NamaPasien    string
	NikPasien     string
	NamaProsedur  string
	StatusLanjut  string
	TglRegistrasi string // sudah format ISO T+07:00, persis performedPeriod.start
	TglPulang     string // sudah format ISO T+07:00, persis performedPeriod.end
}

func fetchProcedureRowData(db *sql.DB, noRawat, kodeICD9 string) (procedureRowData, error) {
	var d procedureRowData
	err := db.QueryRow(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''), IFNULL(icd9.deskripsi_panjang,''),
			reg_periksa.status_lanjut,
			CONCAT(reg_periksa.tgl_registrasi,'T',reg_periksa.jam_reg,'+07:00')
		FROM prosedur_pasien
		INNER JOIN reg_periksa ON prosedur_pasien.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		INNER JOIN icd9 ON prosedur_pasien.kode = icd9.kode
		WHERE prosedur_pasien.no_rawat = ? AND prosedur_pasien.kode = ?
		LIMIT 1
	`, noRawat, kodeICD9).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.NamaProsedur, &d.StatusLanjut, &d.TglRegistrasi)
	d.TglPulang = d.TglRegistrasi // sama persis Java: performedPeriod.start/end keduanya dari concat tgl_registrasi+jam_reg yg sama
	return d, err
}

func buildProcedurePayload(id, kodeICD9 string, d procedureRowData, ihsPasien, idEncounter string) map[string]interface{} {
	resource := map[string]interface{}{
		"resourceType": "Procedure",
		"status":       "completed",
		"category": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://snomed.info/sct", "code": "103693007", "display": "Diagnostic procedure",
			}},
			"text": "Diagnostic procedure",
		},
		"code": map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://hl7.org/fhir/sid/icd-9-cm", "code": kodeICD9, "display": d.NamaProsedur,
			}},
		},
		"subject": map[string]interface{}{"reference": "Patient/" + ihsPasien, "display": d.NamaPasien},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display":   "Prosedur " + d.NamaPasien + " selama kunjungan/dirawat dari tanggal " + d.TglRegistrasi + " sampai " + d.TglPulang,
		},
		"performedPeriod": map[string]interface{}{"start": d.TglRegistrasi, "end": d.TglPulang},
	}
	if id != "" {
		resource["id"] = id
	}
	return resource
}

// POST /api/satu-sehat/procedure/send/*no_rawat — body {"kode_icd9":"..."}.
func sendProcedureSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			KodeICD9 string `json:"kode_icd9"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || strings.TrimSpace(body.KodeICD9) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kode_icd9 wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		rowData, err := fetchProcedureRowData(db, noRawat, body.KodeICD9)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data prosedur tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildProcedurePayload("", body.KodeICD9, rowData, ihsPasien, idEncounter)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Procedure", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "procedure", noRawat+"|"+body.KodeICD9+"|"+rowData.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idProcedure := satuSehatJSONStr(result["id"])
		if idProcedure == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Procedure tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_procedure (no_rawat, kode, status, id_procedure) VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_procedure = VALUES(id_procedure)
		`, noRawat, body.KodeICD9, rowData.StatusLanjut, idProcedure); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Procedure terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "procedure", noRawat+"|"+body.KodeICD9+"|"+rowData.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "Procedure berhasil dikirim", "id_procedure": idProcedure})
	}
}

// POST /api/satu-sehat/procedure/update/*no_rawat — padanan BtnUpdateActionPerformed.
func updateProcedureSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			KodeICD9 string `json:"kode_icd9"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || strings.TrimSpace(body.KodeICD9) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kode_icd9 wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var idProcedure string
		if err := db.QueryRow(`SELECT id_procedure FROM satu_sehat_procedure WHERE no_rawat = ? AND kode = ?`, noRawat, body.KodeICD9).Scan(&idProcedure); err != nil || idProcedure == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Procedure belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchProcedureRowData(db, noRawat, body.KodeICD9)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data prosedur tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildProcedurePayload(idProcedure, body.KodeICD9, rowData, ihsPasien, idEncounter)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Procedure/"+url.PathEscape(idProcedure), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "procedure", noRawat+"|"+body.KodeICD9+"|"+rowData.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "procedure", noRawat+"|"+body.KodeICD9+"|"+rowData.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "Procedure berhasil diperbarui", "id_procedure": idProcedure})
	}
}

// ─── Observation TTV (tanda-tanda vital) ───────────────────────────────────
// Padanan SatuSehatKirimObservationTTV.java: 10 jenis TTV (Suhu, Respirasi,
// Nadi, SpO2, GCS, Kesadaran, Tensi, TB, BB, LP), sumber data
// pemeriksaan_ralan/pemeriksaan_ranap (LP cuma ada di pemeriksaan_ralan —
// pemeriksaan_ranap tidak punya kolom lingkar_perut). "Petugas/Dokter/
// Praktisi" di-resolve dari pemeriksaan_ralan/ranap.nip = pegawai.nik (satu
// kolom nip menampung kd_dokter ATAU nip petugas, keduanya match ke
// pegawai.nik) — makanya resolveIHSDokter yg sudah ada (awalnya utk dokter
// Encounter) dipakai ulang apa adanya di sini, cukup ganti argumennya.
//
// Semua 10 jenis diproses lewat 1 set handler generik yg dipandu peta
// observationTTVDefs, supaya tidak menduplikasi 10x kode yg 90% sama.

type observationTTVDef struct {
	Kolom          string // kolom nilai di pemeriksaan_ralan/pemeriksaan_ranap
	Table          string // nama tabel satu_sehat_observationttv* (SUDAH ADA di skema)
	Label          string // label kolom nilai di UI, mis. "Suhu (°C)"
	HasRanap       bool   // false cuma utk LP (pemeriksaan_ranap tidak punya lingkar_perut)
	EncounterLabel string // dipakai di teks encounter.display: "Pemeriksaan Fisik {label} di ..."
}

var observationTTVDefs = map[string]observationTTVDef{
	"suhu":      {"suhu_tubuh", "satu_sehat_observationttvsuhu", "Suhu (°C)", true, "Suhu Badan"},
	"respirasi": {"respirasi", "satu_sehat_observationttvrespirasi", "Resp(/menit)", true, "Respirasi"},
	"nadi":      {"nadi", "satu_sehat_observationttvnadi", "Nadi(/menit)", true, "Nadi"},
	"spo2":      {"spo2", "satu_sehat_observationttvspo2", "SpO2(%)", true, "SpO2"},
	"gcs":       {"gcs", "satu_sehat_observationttvgcs", "GCS", true, "GCS"},
	"kesadaran": {"kesadaran", "satu_sehat_observationttvkesadaran", "Kesadaran", true, "Kesadaran"},
	"tensi":     {"tensi", "satu_sehat_observationttvtensi", "Tensi(mmHg)", true, "Tensi"},
	"tb":        {"tinggi", "satu_sehat_observationttvtb", "TB(Cm)", true, "Tinggi Badan"},
	"bb":        {"berat", "satu_sehat_observationttvbb", "BB(Kg)", true, "Berat Badan"},
	"lp":        {"lingkar_perut", "satu_sehat_observationttvlp", "LP(Cm)", false, "Lingkar Perut"},
}

type ObservationTTVRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	SttsRawat     string `json:"stts_rawat"`
	SttsLanjut    string `json:"stts_lanjut"`
	TanggalPulang string `json:"tanggal_pulang"`
	IDEncounter   string `json:"id_encounter"`
	Nilai         string `json:"nilai"`
	Petugas       string `json:"petugas"`
	NoKtpPraktisi string `json:"no_ktp_praktisi"`
	TglPerawatan  string `json:"tgl_perawatan"`
	JamRawat      string `json:"jam_rawat"`
	IDObservation string `json:"id_observation"`
}

// GET /api/satu-sehat/observation-ttv/:jenis?tgl_dari=&tgl_sampai=&q= —
// persis tampil{jenis}() Java: 2 query terpisah (pemeriksaan_ralan dgn
// status literal 'Ralan', pemeriksaan_ranap dgn 'Ranap'), digabung jadi satu
// daftar — bukan SQL UNION, replikasi persis pola Java (dua executeQuery
// beda tabel, di-append ke tabel yg sama).
func getObservationTTVCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationTTVDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis observasi tidak dikenal"})
			return
		}
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		fetchBranch := func(sumberTable, statusLiteral string) ([]ObservationTTVRow, error) {
			query := fmt.Sprintf(`
				SELECT
					IFNULL(reg_periksa.tgl_registrasi,''),
					reg_periksa.no_rawat,
					reg_periksa.no_rkm_medis,
					pasien.nm_pasien,
					IFNULL(pasien.no_ktp,''),
					reg_periksa.stts,
					CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
					satu_sehat_encounter.id_encounter,
					%[1]s.%[2]s,
					IFNULL(pegawai.nama,''),
					IFNULL(pegawai.no_ktp,''),
					IFNULL(%[1]s.tgl_perawatan,''),
					IFNULL(%[1]s.jam_rawat,''),
					IFNULL(%[3]s.id_observation,'')
				FROM reg_periksa
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
				INNER JOIN %[1]s ON %[1]s.no_rawat = reg_periksa.no_rawat
				LEFT JOIN pegawai ON pegawai.nik = %[1]s.nip
				LEFT JOIN %[3]s ON %[3]s.no_rawat = %[1]s.no_rawat
					AND %[3]s.tgl_perawatan = %[1]s.tgl_perawatan
					AND %[3]s.jam_rawat = %[1]s.jam_rawat
					AND %[3]s.status = ?
				WHERE %[1]s.%[2]s <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
			`, sumberTable, def.Kolom, def.Table)

			args := []interface{}{statusLiteral, tglDari, tglSampai}
			if keyword != "" {
				query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.no_ktp LIKE ? OR pegawai.nama LIKE ? OR reg_periksa.stts LIKE ?)`
				kw := "%" + keyword + "%"
				for i := 0; i < 7; i++ {
					args = append(args, kw)
				}
			}

			rows, err := db.Query(query, args...)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			list := []ObservationTTVRow{}
			for rows.Next() {
				var r ObservationTTVRow
				if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.SttsRawat,
					&r.TanggalPulang, &r.IDEncounter, &r.Nilai, &r.Petugas, &r.NoKtpPraktisi, &r.TglPerawatan, &r.JamRawat, &r.IDObservation); err != nil {
					continue
				}
				r.SttsLanjut = statusLiteral
				list = append(list, r)
			}
			return list, nil
		}

		result, err := fetchBranch("pemeriksaan_ralan", "Ralan")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if def.HasRanap {
			listRanap, err := fetchBranch("pemeriksaan_ranap", "Ranap")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			result = append(result, listRanap...)
		}

		c.JSON(http.StatusOK, gin.H{"list": result, "total": len(result), "label": def.Label})
	}
}

func replaceStatusLanjutLabel(s string) string {
	s = strings.ReplaceAll(s, "Ralan", "Rawat Jalan/IGD")
	s = strings.ReplaceAll(s, "Ranap", "Rawat Inap")
	return s
}

func vitalSignsCategory() []interface{} {
	return []interface{}{map[string]interface{}{
		"coding": []interface{}{map[string]interface{}{
			"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs", "display": "Vital Signs",
		}},
	}}
}

func loincCodeableConcept(code, display string) map[string]interface{} {
	return map[string]interface{}{
		"coding": []interface{}{map[string]interface{}{"system": "http://loinc.org", "code": code, "display": display}},
	}
}

func ucumQuantity(value, unit, code string) map[string]interface{} {
	return map[string]interface{}{
		"value": jsonNumberFromString(value), "unit": unit, "system": "http://unitsofmeasure.org", "code": code,
	}
}

func jsonNumberFromString(s string) interface{} {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return f
}

// buildObservationTTVPayload — persis payload BtnKirim/BtnUpdate Java per
// jenis TTV (LOINC/SNOMED code, unit, struktur value beda-beda per jenis:
// GCS tanpa "unit", Kesadaran pakai valueCodeableConcept bukan valueQuantity,
// Tensi berupa panel 2 component). idObs kosong = create (POST), terisi =
// update (PUT, field "id" disertakan). SATU koreksi disengaja dari bug asli
// Khanza: Nadi seharusnya "beats/minute" (bukan "breaths/minute" — itu punya
// Respirasi, kelihatannya salah copy-paste di source aslinya).
func buildObservationTTVPayload(jenis, idObs, nilai, namaPasien, ihsPasien, ihsPraktisi, idEncounter, sttsLanjut, tglPerawatan, jamRawat string) (map[string]interface{}, error) {
	def, ok := observationTTVDefs[jenis]
	if !ok {
		return nil, fmt.Errorf("jenis observasi tidak dikenal")
	}

	resource := map[string]interface{}{
		"resourceType": "Observation",
		"status":       "final",
		"subject":      map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"performer":    []interface{}{map[string]interface{}{"reference": "Practitioner/" + ihsPraktisi}},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display":   "Pemeriksaan Fisik " + def.EncounterLabel + " di " + replaceStatusLanjutLabel(sttsLanjut) + ", Pasien " + namaPasien + " Pada Tanggal " + tglPerawatan + " Jam " + jamRawat,
		},
		"effectiveDateTime": tglPerawatan + "T" + jamRawat + "+07:00",
	}
	if idObs != "" {
		resource["id"] = idObs
	}

	nilaiBersih := strings.ReplaceAll(nilai, ",", ".")

	switch jenis {
	case "suhu":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("8310-5", "Body temperature")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "degree Celsius", "Cel")
	case "respirasi":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("9279-1", "Respiratory rate")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "breaths/minute", "/min")
	case "nadi":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("8867-4", "Heart rate")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "beats/minute", "/min")
	case "spo2":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("59408-5", "Oxygen saturation")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "percent saturation", "%")
	case "gcs":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("9269-2", "Glasgow coma score total")
		resource["valueQuantity"] = map[string]interface{}{
			"value":  jsonNumberFromString(nilaiBersih),
			"system": "http://unitsofmeasure.org",
			"code":   "{score}",
		}
	case "kesadaran":
		resource["category"] = []interface{}{map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "exam", "display": "Exam",
			}},
		}}
		resource["code"] = map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://snomed.info/sct", "code": "1104441000000107",
				"display": "ACVPU (Alert Confusion Voice Pain Unresponsive) scale score",
			}},
		}
		acvpu := nilai
		acvpu = strings.ReplaceAll(acvpu, "Compos Mentis", "Alert")
		acvpu = strings.ReplaceAll(acvpu, "Somnolence", "Voice")
		acvpu = strings.ReplaceAll(acvpu, "Sopor", "Pain")
		acvpu = strings.ReplaceAll(acvpu, "Coma", "Unresponsive")
		resource["valueCodeableConcept"] = map[string]interface{}{"text": acvpu}
	case "tensi":
		resource["category"] = vitalSignsCategory()
		resource["code"] = map[string]interface{}{
			"coding": []interface{}{map[string]interface{}{
				"system": "http://loinc.org", "code": "35094-2", "display": "Blood pressure panel",
			}},
			"text": "Blood pressure systolic & diastolic",
		}
		parts := strings.SplitN(nilai, "/", 2)
		sistole, diastole := "0", "0"
		if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
			sistole = strings.TrimSpace(parts[0])
		}
		if len(parts) > 1 && strings.TrimSpace(parts[1]) != "" {
			diastole = strings.TrimSpace(parts[1])
		}
		resource["component"] = []interface{}{
			map[string]interface{}{
				"code":          map[string]interface{}{"coding": []interface{}{map[string]interface{}{"system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure"}}},
				"valueQuantity": ucumQuantity(sistole, "mmHg", "mm[Hg]"),
			},
			map[string]interface{}{
				"code":          map[string]interface{}{"coding": []interface{}{map[string]interface{}{"system": "http://loinc.org", "code": "8462-4", "display": "Diastolic blood pressure"}}},
				"valueQuantity": ucumQuantity(diastole, "mmHg", "mm[Hg]"),
			},
		}
	case "tb":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("8302-2", "Body height")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "centimeter", "cm")
	case "bb":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("29463-7", "Body Weight")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "kilogram", "kg")
	case "lp":
		resource["category"] = vitalSignsCategory()
		resource["code"] = loincCodeableConcept("8280-0", "Waist Circumference at umbilicus by Tape measure")
		resource["valueQuantity"] = ucumQuantity(nilaiBersih, "centimeter", "cm")
	default:
		return nil, fmt.Errorf("jenis observasi tidak dikenal")
	}

	return resource, nil
}

type observationTTVRowData struct {
	NoRkmMedis  string
	NamaPasien  string
	NikPasien   string // pasien.no_ktp
	Nilai       string
	PegawaiNik  string // pegawai.nik — dipakai jd key cache resolveIHSDokter
	NikPraktisi string // pegawai.no_ktp
}

func fetchObservationTTVRowData(db *sql.DB, jenis, noRawat, tglPerawatan, jamRawat, sttsLanjut string) (observationTTVRowData, error) {
	def := observationTTVDefs[jenis]
	sumberTable := "pemeriksaan_ralan"
	if sttsLanjut == "Ranap" {
		sumberTable = "pemeriksaan_ranap"
	}
	var d observationTTVRowData
	query := fmt.Sprintf(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''), %[1]s.%[2]s, IFNULL(pegawai.nik,''), IFNULL(pegawai.no_ktp,'')
		FROM %[1]s
		INNER JOIN reg_periksa ON %[1]s.no_rawat = reg_periksa.no_rawat
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		LEFT JOIN pegawai ON pegawai.nik = %[1]s.nip
		WHERE %[1]s.no_rawat = ? AND %[1]s.tgl_perawatan = ? AND %[1]s.jam_rawat = ?
		LIMIT 1
	`, sumberTable, def.Kolom)
	err := db.QueryRow(query, noRawat, tglPerawatan, jamRawat).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.Nilai, &d.PegawaiNik, &d.NikPraktisi)
	return d, err
}

// POST /api/satu-sehat/observation-ttv/:jenis/send/*no_rawat — body
// {"tgl_perawatan":"...","jam_rawat":"...","status_lanjut":"Ralan|Ranap"}.
// Baris TTV diidentifikasi 4 kolom (no_rawat+tgl_perawatan+jam_rawat+status)
// krn satu no_rawat bisa punya banyak kali pengukuran, beda dgn Encounter/
// Condition yg cukup 1-2 kolom.
func sendObservationTTV(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationTTVDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis observasi tidak dikenal"})
			return
		}
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			JamRawat     string `json:"jam_rawat"`
			StatusLanjut string `json:"status_lanjut"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.StatusLanjut == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		rowData, err := fetchObservationTTVRowData(db, jenis, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPraktisi, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.PegawaiNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload, err := buildObservationTTVPayload(jenis, "", rowData.Nilai, rowData.NamaPasien, ihsPasien, ihsPraktisi, idEncounter, body.StatusLanjut, body.TglPerawatan, body.JamRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Observation", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_ttv_"+jenis, noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idObservation := satuSehatJSONStr(result["id"])
		if idObservation == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Observation tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(fmt.Sprintf(`
			INSERT INTO %s (no_rawat, tgl_perawatan, jam_rawat, status, id_observation) VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_observation = VALUES(id_observation)
		`, def.Table), noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut, idObservation); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Observation terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "observation_ttv_"+jenis, noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil dikirim", "id_observation": idObservation})
	}
}

// POST /api/satu-sehat/observation-ttv/:jenis/update/*no_rawat — padanan
// BtnUpdateActionPerformed: PUT ulang resource yg SUDAH pernah terkirim.
func updateObservationTTV(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationTTVDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis observasi tidak dikenal"})
			return
		}
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var body struct {
			TglPerawatan string `json:"tgl_perawatan"`
			JamRawat     string `json:"jam_rawat"`
			StatusLanjut string `json:"status_lanjut"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.StatusLanjut == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var idObservation string
		err = db.QueryRow(fmt.Sprintf(`SELECT id_observation FROM %s WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND status = ?`, def.Table),
			noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut).Scan(&idObservation)
		if err != nil || idObservation == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Observation belum pernah dikirim, gunakan Kirim terlebih dahulu"})
			return
		}

		rowData, err := fetchObservationTTVRowData(db, jenis, noRawat, body.TglPerawatan, body.JamRawat, body.StatusLanjut)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, rowData.NoRkmMedis, rowData.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPraktisi, err := resolveIHSDokter(db, cfg.FhirURL, token, rowData.PegawaiNik, rowData.NikPraktisi)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number praktisi: " + err.Error()})
			return
		}

		payload, err := buildObservationTTVPayload(jenis, idObservation, rowData.Nilai, rowData.NamaPasien, ihsPasien, ihsPraktisi, idEncounter, body.StatusLanjut, body.TglPerawatan, body.JamRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Observation/"+url.PathEscape(idObservation), bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_ttv_"+jenis, noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "observation_ttv_"+jenis, noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.StatusLanjut)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil diperbarui", "id_observation": idObservation})
	}
}

// ─── ServiceRequest Radiologi ─────────────────────────────────────────────────
//
// Padanan SatuSehatKirimServiceRequestRadiologi.java. Beda dgn versi lama di
// file ini, ada 3 perbaikan penting hasil cocokkan ulang ke Java:
//  1. Identitas dokter perujuk: Java TIDAK pakai permintaan_radiologi.dokter_perujuk
//     (join ke tabel `dokter`, yg TIDAK punya kolom NIK sama sekali — jadi IHS
//     dokter dari jalur itu tidak akan pernah bisa di-resolve). Java pakai
//     reg_periksa.kd_dokter -> pegawai (nik=kd_dokter, no_ktp=NIK asli), persis
//     pola resolveIHSDokter yg dipakai semua resource lain di file ini.
//  2. Identifier: Java cuma kirim SATU identifier sistem "acsn", value =
//     noorder (setelah "PR" dibuang) + kd_jenis_prw — DIKONFIRMASI ulang lewat
//     data produksi riil di Orthanc yg sudah terkirim ke Satu Sehat (mis.
//     "202605250002THRX-1"), jadi dipakai apa adanya (bukan noOrder polos
//     seperti sebelumnya, lihat khanzaAccessionNumber di dicom_handler.go —
//     ACSN ini HARUS sama persis dgn AccessionNumber tag di studi Orthanc
//     supaya DICOM Router bisa menghubungkan ImagingStudy ke ServiceRequest).
//  3. Granularitas: Java kirim SATU ServiceRequest per baris tabel (= per
//     pemeriksaan), bukan sekali jalan utk semua pemeriksaan dlm satu order.
//     Endpoint send/update di sini diubah jadi per (noorder, kd_jenis_prw) —
//     jadi ACSN per pemeriksaan selalu unambiguous (kdJenisPrw sudah pasti).
type serviceRequestRadiologiPayloadResult struct {
	Payload       map[string]interface{}
	NoRkmMedis    string
	NmPasien      string
	TglLahir      string
	JK            string
	TglPermintaan string
	NmPerawatan   string
}

func buildServiceRequestRadiologiPayload(db *sql.DB, cfg SatuSehatConfig, token, noOrder, kdJenisPrw string) (*serviceRequestRadiologiPayloadResult, error) {
	var (
		noRawat, noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter            string
		idEncounter                                sql.NullString
		tglPermintaan, jamPermintaan, diagnosa     string
		tglSampel, jamSampel                       sql.NullString
		tglLahir, jk                               sql.NullString
		nmPerawatan, code, system, display         string
	)
	err := db.QueryRow(`
		SELECT
			rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''), IFNULL(p.tgl_lahir,''), p.jk,
			rp.kd_dokter, IFNULL(peg.nama,''), IFNULL(peg.no_ktp,''),
			se.id_encounter,
			IFNULL(pr.tgl_permintaan,''), IFNULL(pr.jam_permintaan,'00:00:00'), IFNULL(pr.diagnosa_klinis,''),
			IFNULL(pr.tgl_sampel,''), pr.jam_sampel,
			IFNULL(jpr.nm_perawatan,''), IFNULL(m.code,''), IFNULL(m.system,''), IFNULL(m.display,'')
		FROM permintaan_radiologi pr
		INNER JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN pegawai peg ON peg.nik = rp.kd_dokter
		LEFT JOIN satu_sehat_encounter se ON se.no_rawat = pr.no_rawat
		INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder AND ppr.kd_jenis_prw = ?
		LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
		LEFT JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = ppr.kd_jenis_prw
		WHERE pr.noorder = ?
	`, kdJenisPrw, noOrder).Scan(
		&noRawat, &noRkmMedis, &namaPasien, &nikPasien, &tglLahir, &jk,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglPermintaan, &jamPermintaan, &diagnosa,
		&tglSampel, &jamSampel,
		&nmPerawatan, &code, &system, &display,
	)
	if err != nil {
		return nil, fmt.Errorf("Data order/pemeriksaan radiologi tidak ditemukan")
	}
	if code == "" {
		return nil, fmt.Errorf("Pemeriksaan '%s' belum punya Mapping Radiologi (kode SNOMED CT/LOINC)", nmPerawatan)
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number dokter: %s", err.Error())
	}

	jam := jamPermintaan
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	authoredOn := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglPermintaan), jam)
	occurrenceDateTime := authoredOn
	if tglSampel.Valid && tglSampel.String != "" && tglSampel.String != "0000-00-00" {
		jamS := jamSampel.String
		if jamS == "" || jamS == "00:00:00" {
			jamS = "08:00:00"
		}
		occurrenceDateTime = fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglSampel.String), jamS)
	}

	// ACSN (system "acsn") = noorder (prefix "PR" dibuang) + kd_jenis_prw,
	// SAMA persis dgn AccessionNumber tag yg ditulis ke studi Orthanc (lihat
	// khanzaAccessionNumber di dicom_handler.go) — supaya Satu Sehat/DICOM
	// Router bisa menghubungkan ServiceRequest ini ke ImagingStudy-nya.
	// Karena kdJenisPrw di fungsi ini sudah spesifik per pemeriksaan, ACSN-nya
	// selalu unambiguous walau satu order radiologi py >1 pemeriksaan.
	// Identifier "servicerequest" = kunci unik lokal per-pemeriksaan (beda dari
	// acsn, dipakai app ini sendiri utk tracking, bukan utk pencocokan Orthanc).
	payload := map[string]interface{}{
		"resourceType": "ServiceRequest",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/servicerequest/" + cfg.OrgID, "value": noOrder + "." + kdJenisPrw},
			{
				"system": "http://sys-ids.kemkes.go.id/acsn/" + cfg.OrgID,
				"type": map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "ACSN"},
					},
				},
				"use":   "usual",
				"value": strings.ReplaceAll(noOrder, "PR", "") + kdJenisPrw,
			},
		},
		"status":   "active",
		"intent":   "original-order",
		"priority": "routine",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://snomed.info/sct", "code": "363679005", "display": "Imaging"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": system, "code": code, "display": display},
			},
			"text": nmPerawatan,
		},
		"subject":            map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"occurrenceDateTime": occurrenceDateTime,
		"authoredOn":         authoredOn,
		"requester": map[string]interface{}{
			"reference": "Practitioner/" + ihsDokter,
			"display":   namaDokter,
		},
		"performer": []map[string]interface{}{
			{"reference": "Organization/" + cfg.OrgID, "display": "Ruang Radiologi/Petugas Radiologi"},
		},
	}
	if idEncounter.Valid && idEncounter.String != "" {
		payload["encounter"] = map[string]interface{}{
			"reference": "Encounter/" + idEncounter.String,
			"display": fmt.Sprintf("Permintaan %s atas nama pasien %s No.RM %s No.Rawat %s, pada tanggal %s",
				nmPerawatan, namaPasien, noRkmMedis, noRawat, tglPermintaan),
		}
	}
	if diagnosa != "" && diagnosa != "-" {
		payload["reasonCode"] = []map[string]interface{}{{"text": diagnosa}}
	}

	return &serviceRequestRadiologiPayloadResult{
		Payload:       payload,
		NoRkmMedis:    noRkmMedis,
		NmPasien:      namaPasien,
		TglLahir:      tglLahir.String,
		JK:            jk.String,
		TglPermintaan: tglPermintaan,
		NmPerawatan:   nmPerawatan,
	}, nil
}

// GET /api/satu-sehat/servicerequest-radiologi-candidates
func getServiceRequestRadiologiCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))
		q := c.Query("q")

		query := `
			SELECT
				rp.no_rawat, rp.no_rkm_medis, p.nm_pasien,
				IFNULL(peg.nama,'') as nama_dokter,
				IFNULL(se.id_encounter,'') as id_encounter,
				pr.noorder, IFNULL(pr.tgl_permintaan,''), IFNULL(pr.jam_permintaan,'00:00:00') as jam_permintaan,
				IFNULL(pr.diagnosa_klinis,'') as diagnosa_klinis,
				ppr.kd_jenis_prw, IFNULL(jpr.nm_perawatan,'') as nm_perawatan,
				IFNULL(sr.id_servicerequest,'') as id_servicerequest
			FROM reg_periksa rp
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			INNER JOIN pegawai peg ON peg.nik = rp.kd_dokter
			LEFT JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
			INNER JOIN permintaan_radiologi pr ON pr.no_rawat = rp.no_rawat
			INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
			LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
			INNER JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = ppr.kd_jenis_prw
			LEFT JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder = ppr.noorder AND sr.kd_jenis_prw = ppr.kd_jenis_prw
			WHERE rp.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if q != "" {
			query += ` AND (rp.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR jpr.nm_perawatan LIKE ? OR pr.noorder LIKE ?)`
			like := "%" + q + "%"
			args = append(args, like, like, like, like, like)
		}
		query += " ORDER BY pr.tgl_permintaan DESC, pr.noorder DESC, ppr.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Row struct {
			NoRawat          string `json:"no_rawat"`
			NoRM             string `json:"no_rm"`
			NamaPasien       string `json:"nama_pasien"`
			NamaDokter       string `json:"nama_dokter"`
			IDEncounter      string `json:"id_encounter"`
			NoOrder          string `json:"noorder"`
			TglPermintaan    string `json:"tgl_permintaan"`
			JamPermintaan    string `json:"jam_permintaan"`
			DiagnosaKlinis   string `json:"diagnosa_klinis"`
			KdJenisPrw       string `json:"kd_jenis_prw"`
			NmPerawatan      string `json:"nm_perawatan"`
			IDServiceRequest string `json:"id_servicerequest"`
		}
		list := []Row{}
		for rows.Next() {
			var r Row
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NamaDokter, &r.IDEncounter,
				&r.NoOrder, &r.TglPermintaan, &r.JamPermintaan, &r.DiagnosaKlinis,
				&r.KdJenisPrw, &r.NmPerawatan, &r.IDServiceRequest); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// POST /api/satu-sehat/servicerequest-radiologi/send/*noorder?kd_jenis_prw=xxx
func sendServiceRequestRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

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

		built, err := buildServiceRequestRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(built.Payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/ServiceRequest", bytes.NewReader(payloadBytes))
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
			logSatuSehatKirimError(db, "servicerequest_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idSR, _ := result["id"].(string)
		if idSR != "" {
			db.Exec(`
				INSERT INTO satu_sehat_servicerequest_radiologi (noorder, kd_jenis_prw, id_servicerequest)
				VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_servicerequest = VALUES(id_servicerequest)
			`, noOrder, kdJenisPrw, idSR)
		}
		clearSatuSehatKirimError(db, "servicerequest_radiologi", noOrder+"|"+kdJenisPrw)

		// Best-effort: sinkronisasi tag DICOM di Orthanc (kegagalan tidak menggagalkan proses)
		pacsMsg := lazyModifyPACS(db, noOrder, built.NoRkmMedis, built.NmPasien, built.TglLahir, built.JK, built.TglPermintaan, built.NmPerawatan)

		c.JSON(http.StatusOK, gin.H{
			"message":           "ServiceRequest berhasil dikirim",
			"id_servicerequest": idSR,
			"pacs_sync":         pacsMsg,
		})
	}
}

// POST /api/satu-sehat/servicerequest-radiologi/update/*noorder?kd_jenis_prw=xxx
func updateServiceRequestRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idSR string
		err = db.QueryRow(`SELECT id_servicerequest FROM satu_sehat_servicerequest_radiologi WHERE noorder = ? AND kd_jenis_prw = ? AND id_servicerequest != ''`, noOrder, kdJenisPrw).Scan(&idSR)
		if err != nil || idSR == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ServiceRequest belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		built, err := buildServiceRequestRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		built.Payload["id"] = idSR

		payloadBytes, _ := json.Marshal(built.Payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/ServiceRequest/"+idSR, bytes.NewReader(payloadBytes))
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
			logSatuSehatKirimError(db, "servicerequest_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "servicerequest_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "ServiceRequest berhasil diupdate", "id_servicerequest": idSR})
	}
}

// ─── ServiceRequest Lab (PK/MB) ────────────────────────────────────────────────
//
// Padanan SatuSehatKirimServiceRequestLabPK.java & ...LabMB.java — dua kelas
// Java yg strukturnya identik persis, cuma beda nama tabel (permintaan_lab vs
// permintaan_labmb dst). Digeneralisasi jadi satu handler ber-parameter
// "jenis" (pk/mb), sama seperti pola Observation TTV.
type serviceRequestLabDef struct {
	PermintaanTable string
	DetailTable     string
	TrackingTable   string
	OrgDisplay      string
}

var serviceRequestLabDefs = map[string]serviceRequestLabDef{
	"pk": {"permintaan_lab", "permintaan_detail_permintaan_lab", "satu_sehat_servicerequest_lab", "Ruang Laborat/Petugas Laborat"},
	"mb": {"permintaan_labmb", "permintaan_detail_permintaan_labmb", "satu_sehat_servicerequest_lab_mb", "Ruang Laborat/Petugas Laborat"},
}

func buildServiceRequestLabPayload(db *sql.DB, cfg SatuSehatConfig, token, jenis, noOrder string, idTemplate int, kdJenisPrw string) (map[string]interface{}, error) {
	def, ok := serviceRequestLabDefs[jenis]
	if !ok {
		return nil, fmt.Errorf("Jenis lab tidak dikenal: %s", jenis)
	}

	var (
		noRawat, noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter            string
		idEncounter                                sql.NullString
		tglPermintaan, jamPermintaan, diagnosa     string
		tglSampel, jamSampel                       sql.NullString
		nmPerawatan, code, system, display         string
	)
	query := fmt.Sprintf(`
		SELECT
			rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
			rp.kd_dokter, IFNULL(peg.nama,''), IFNULL(peg.no_ktp,''),
			se.id_encounter,
			IFNULL(pl.tgl_permintaan,''), IFNULL(pl.jam_permintaan,'00:00:00'), IFNULL(pl.diagnosa_klinis,''),
			IFNULL(pl.tgl_sampel,''), pl.jam_sampel,
			IFNULL(tl.Pemeriksaan,''), IFNULL(m.code,''), IFNULL(m.system,''), IFNULL(m.display,'')
		FROM %s pl
		INNER JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN pegawai peg ON peg.nik = rp.kd_dokter
		LEFT JOIN satu_sehat_encounter se ON se.no_rawat = pl.no_rawat
		INNER JOIN %s dpl ON dpl.noorder = pl.noorder AND dpl.id_template = ? AND dpl.kd_jenis_prw = ?
		LEFT JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
		LEFT JOIN satu_sehat_mapping_lab m ON m.id_template = dpl.id_template
		WHERE pl.noorder = ?
	`, def.PermintaanTable, def.DetailTable)
	err := db.QueryRow(query, idTemplate, kdJenisPrw, noOrder).Scan(
		&noRawat, &noRkmMedis, &namaPasien, &nikPasien,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglPermintaan, &jamPermintaan, &diagnosa,
		&tglSampel, &jamSampel,
		&nmPerawatan, &code, &system, &display,
	)
	if err != nil {
		return nil, fmt.Errorf("Data order/pemeriksaan lab tidak ditemukan")
	}
	if code == "" {
		return nil, fmt.Errorf("Pemeriksaan '%s' belum punya Mapping Laboratorium (kode LOINC)", nmPerawatan)
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number dokter: %s", err.Error())
	}

	jam := jamPermintaan
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	authoredOn := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglPermintaan), jam)
	occurrenceDateTime := authoredOn
	if tglSampel.Valid && tglSampel.String != "" && tglSampel.String != "0000-00-00" {
		jamS := jamSampel.String
		if jamS == "" || jamS == "00:00:00" {
			jamS = "08:00:00"
		}
		occurrenceDateTime = fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglSampel.String), jamS)
	}
	srValue := noOrder + "." + kdJenisPrw

	payload := map[string]interface{}{
		"resourceType": "ServiceRequest",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/servicerequest/" + cfg.OrgID, "value": srValue},
		},
		"status":   "active",
		"intent":   "original-order",
		"priority": "routine",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://snomed.info/sct", "code": "108252007", "display": "Laboratory procedure"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": system, "code": code, "display": display},
			},
			"text": nmPerawatan,
		},
		"subject":            map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"occurrenceDateTime": occurrenceDateTime,
		"authoredOn":         authoredOn,
		"requester": map[string]interface{}{
			"reference": "Practitioner/" + ihsDokter,
			"display":   namaDokter,
		},
		"performer": []map[string]interface{}{
			{"reference": "Organization/" + cfg.OrgID, "display": def.OrgDisplay},
		},
	}
	if idEncounter.Valid && idEncounter.String != "" {
		payload["encounter"] = map[string]interface{}{
			"reference": "Encounter/" + idEncounter.String,
			"display": fmt.Sprintf("Permintaan %s atas nama pasien %s No.RM %s No.Rawat %s, pada tanggal %s",
				nmPerawatan, namaPasien, noRkmMedis, noRawat, tglPermintaan),
		}
	}
	if diagnosa != "" && diagnosa != "-" {
		payload["reasonCode"] = []map[string]interface{}{{"text": diagnosa}}
	}

	return payload, nil
}

// GET /api/satu-sehat/servicerequest-lab/:jenis
func getServiceRequestLabCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := serviceRequestLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))
		q := c.Query("q")

		query := fmt.Sprintf(`
			SELECT
				rp.no_rawat, rp.no_rkm_medis, p.nm_pasien,
				IFNULL(peg.nama,'') as nama_dokter,
				IFNULL(se.id_encounter,'') as id_encounter,
				pl.noorder, IFNULL(pl.tgl_permintaan,''), IFNULL(pl.jam_permintaan,'00:00:00') as jam_permintaan,
				IFNULL(pl.diagnosa_klinis,'') as diagnosa_klinis,
				dpl.id_template, dpl.kd_jenis_prw, IFNULL(tl.Pemeriksaan,'') as nm_perawatan,
				IFNULL(sr.id_servicerequest,'') as id_servicerequest
			FROM reg_periksa rp
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			INNER JOIN pegawai peg ON peg.nik = rp.kd_dokter
			LEFT JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
			INNER JOIN %s pl ON pl.no_rawat = rp.no_rawat
			INNER JOIN %s dpl ON dpl.noorder = pl.noorder
			LEFT JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
			INNER JOIN satu_sehat_mapping_lab m ON m.id_template = dpl.id_template
			LEFT JOIN %s sr ON sr.noorder = dpl.noorder AND sr.id_template = dpl.id_template AND sr.kd_jenis_prw = dpl.kd_jenis_prw
			WHERE rp.tgl_registrasi BETWEEN ? AND ?
		`, def.PermintaanTable, def.DetailTable, def.TrackingTable)
		args := []interface{}{tglDari, tglSampai}
		if q != "" {
			query += ` AND (rp.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR tl.Pemeriksaan LIKE ? OR pl.noorder LIKE ?)`
			like := "%" + q + "%"
			args = append(args, like, like, like, like, like)
		}
		query += " ORDER BY pl.tgl_permintaan DESC, pl.noorder DESC, dpl.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Row struct {
			NoRawat          string `json:"no_rawat"`
			NoRM             string `json:"no_rm"`
			NamaPasien       string `json:"nama_pasien"`
			NamaDokter       string `json:"nama_dokter"`
			IDEncounter      string `json:"id_encounter"`
			NoOrder          string `json:"noorder"`
			TglPermintaan    string `json:"tgl_permintaan"`
			JamPermintaan    string `json:"jam_permintaan"`
			DiagnosaKlinis   string `json:"diagnosa_klinis"`
			IDTemplate       int    `json:"id_template"`
			KdJenisPrw       string `json:"kd_jenis_prw"`
			NmPerawatan      string `json:"nm_perawatan"`
			IDServiceRequest string `json:"id_servicerequest"`
		}
		list := []Row{}
		for rows.Next() {
			var r Row
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NamaDokter, &r.IDEncounter,
				&r.NoOrder, &r.TglPermintaan, &r.JamPermintaan, &r.DiagnosaKlinis,
				&r.IDTemplate, &r.KdJenisPrw, &r.NmPerawatan, &r.IDServiceRequest); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// POST /api/satu-sehat/servicerequest-lab/:jenis/send/*noorder?id_template=&kd_jenis_prw=
func sendServiceRequestLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := serviceRequestLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + strconv.Itoa(idTemplate) + "|" + kdJenisPrw

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

		payload, err := buildServiceRequestLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/ServiceRequest", bytes.NewReader(payloadBytes))
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
			logSatuSehatKirimError(db, "servicerequest_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idSR, _ := result["id"].(string)
		if idSR != "" {
			db.Exec(fmt.Sprintf(`
				INSERT INTO %s (noorder, id_template, kd_jenis_prw, id_servicerequest)
				VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id_servicerequest = VALUES(id_servicerequest)
			`, def.TrackingTable), noOrder, idTemplate, kdJenisPrw, idSR)
		}
		clearSatuSehatKirimError(db, "servicerequest_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "ServiceRequest berhasil dikirim", "id_servicerequest": idSR})
	}
}

// POST /api/satu-sehat/servicerequest-lab/:jenis/update/*noorder?id_template=&kd_jenis_prw=
func updateServiceRequestLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := serviceRequestLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + strconv.Itoa(idTemplate) + "|" + kdJenisPrw

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idSR string
		err = db.QueryRow(fmt.Sprintf(`SELECT id_servicerequest FROM %s WHERE noorder = ? AND id_template = ? AND kd_jenis_prw = ? AND id_servicerequest != ''`, def.TrackingTable),
			noOrder, idTemplate, kdJenisPrw).Scan(&idSR)
		if err != nil || idSR == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ServiceRequest belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildServiceRequestLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idSR

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/ServiceRequest/"+idSR, bytes.NewReader(payloadBytes))
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
			logSatuSehatKirimError(db, "servicerequest_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "servicerequest_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "ServiceRequest berhasil diupdate", "id_servicerequest": idSR})
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

// ─── Specimen Radiologi ─────────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimSpecimenRadiologi.java. Prasyarat: ServiceRequest
// Radiologi utk pemeriksaan itu SUDAH terkirim. Sumber kode "type" bukan dari
// erm_mapping_radiologi (tabel lokal terpisah, kosong — lihat catatan di
// buildServiceRequestRadiologiPayload) tapi dari satu_sehat_mapping_radiologi
// (tabel yg sama dipakai menu "Mapping Radiologi" yg live), kolom
// sampel_code/sampel_system/sampel_display.
//
// Catatan: Java py DUA blok query IDENTIK persis di tampil() (bug copy-paste,
// bukan pola Ralan/Ranap seperti resource lain — radiologi tidak butuh split
// itu). Kalau direplikasi apa adanya, setiap baris akan muncul dobel di UI.
// Saya query sekali saja.
type specimenRadiologiRow struct {
	NoRawat          string `json:"no_rawat"`
	NoRM             string `json:"no_rm"`
	NamaPasien       string `json:"nama_pasien"`
	NoKtpPasien      string `json:"no_ktp_pasien"`
	NoOrder          string `json:"noorder"`
	TglSampel        string `json:"tgl_sampel"`
	NmPerawatan      string `json:"nm_perawatan"`
	SampelCode       string `json:"sampel_code"`
	SampelSystem     string `json:"sampel_system"`
	SampelDisplay    string `json:"sampel_display"`
	IDServiceRequest string `json:"id_servicerequest"`
	KdJenisPrw       string `json:"kd_jenis_prw"`
	IDSpecimen       string `json:"id_specimen"`
}

// GET /api/satu-sehat/specimen-radiologi
func getSpecimenRadiologiCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				pr.noorder, CONCAT(pr.tgl_sampel,' ',pr.jam_sampel) as tgl_sampel,
				IFNULL(jpr.nm_perawatan,''),
				IFNULL(m.sampel_code,''), IFNULL(m.sampel_system,''), IFNULL(m.sampel_display,''),
				sr.id_servicerequest, ppr.kd_jenis_prw,
				IFNULL(sp.id_specimen,'') as id_specimen
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN permintaan_radiologi pr ON pr.no_rawat = reg_periksa.no_rawat
			INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
			INNER JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
			INNER JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = jpr.kd_jenis_prw
			INNER JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder = ppr.noorder AND sr.kd_jenis_prw = ppr.kd_jenis_prw
			LEFT JOIN satu_sehat_specimen_radiologi sp ON sp.noorder = sr.noorder AND sp.kd_jenis_prw = sr.kd_jenis_prw
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR jpr.nm_perawatan LIKE ? OR m.sampel_code LIKE ? OR pr.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 7; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY pr.tgl_sampel DESC, pr.noorder DESC, ppr.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []specimenRadiologiRow{}
		for rows.Next() {
			var r specimenRadiologiRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NoOrder, &r.TglSampel,
				&r.NmPerawatan, &r.SampelCode, &r.SampelSystem, &r.SampelDisplay,
				&r.IDServiceRequest, &r.KdJenisPrw, &r.IDSpecimen); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildSpecimenRadiologiPayload(db *sql.DB, cfg SatuSehatConfig, token, noOrder, kdJenisPrw string) (map[string]interface{}, error) {
	var (
		noRkmMedis, namaPasien, nikPasien       string
		tglSampel, jamSampel                    sql.NullString
		sampelCode, sampelSystem, sampelDisplay string
		idServiceRequest                        string
	)
	err := db.QueryRow(`
		SELECT rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
			IFNULL(pr.tgl_sampel,''), pr.jam_sampel,
			IFNULL(m.sampel_code,''), IFNULL(m.sampel_system,''), IFNULL(m.sampel_display,''),
			IFNULL(sr.id_servicerequest,'')
		FROM permintaan_radiologi pr
		INNER JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder AND ppr.kd_jenis_prw = ?
		LEFT JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = ppr.kd_jenis_prw
		LEFT JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder = pr.noorder AND sr.kd_jenis_prw = ppr.kd_jenis_prw
		WHERE pr.noorder = ?
	`, kdJenisPrw, noOrder).Scan(&noRkmMedis, &namaPasien, &nikPasien, &tglSampel, &jamSampel,
		&sampelCode, &sampelSystem, &sampelDisplay, &idServiceRequest)
	if err != nil {
		return nil, fmt.Errorf("Data order/pemeriksaan radiologi tidak ditemukan")
	}
	if sampelCode == "" {
		return nil, fmt.Errorf("Pemeriksaan ini belum punya Mapping Sampel (Sampel Code/System/Display) di menu Mapping Radiologi")
	}
	if idServiceRequest == "" {
		return nil, fmt.Errorf("ServiceRequest untuk pemeriksaan ini belum dikirim")
	}
	if !tglSampel.Valid || tglSampel.String == "" || tglSampel.String == "0000-00-00" {
		return nil, fmt.Errorf("Tanggal sampel belum diisi untuk order ini")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}

	jam := jamSampel.String
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	receivedTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglSampel.String), jam)

	return map[string]interface{}{
		"resourceType": "Specimen",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/specimen/" + cfg.OrgID, "value": noOrder + "." + kdJenisPrw},
		},
		"status": "available",
		"type": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": sampelSystem, "code": sampelCode, "display": sampelDisplay},
			},
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   namaPasien,
		},
		"request": []map[string]interface{}{
			{"reference": "ServiceRequest/" + idServiceRequest},
		},
		"receivedTime": receivedTime,
	}, nil
}

// POST /api/satu-sehat/specimen-radiologi/send/*noorder?kd_jenis_prw=xxx
func sendSpecimenRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

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

		payload, err := buildSpecimenRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Specimen", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "specimen_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idSpecimen, _ := result["id"].(string)
		if idSpecimen != "" {
			db.Exec(`
				INSERT INTO satu_sehat_specimen_radiologi (noorder, kd_jenis_prw, id_specimen)
				VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_specimen = VALUES(id_specimen)
			`, noOrder, kdJenisPrw, idSpecimen)
		}
		clearSatuSehatKirimError(db, "specimen_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "Specimen berhasil dikirim", "id_specimen": idSpecimen})
	}
}

// POST /api/satu-sehat/specimen-radiologi/update/*noorder?kd_jenis_prw=xxx
func updateSpecimenRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idSpecimen string
		err = db.QueryRow(`SELECT id_specimen FROM satu_sehat_specimen_radiologi WHERE noorder = ? AND kd_jenis_prw = ? AND id_specimen != ''`, noOrder, kdJenisPrw).Scan(&idSpecimen)
		if err != nil || idSpecimen == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specimen belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildSpecimenRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idSpecimen

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Specimen/"+idSpecimen, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "specimen_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "specimen_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "Specimen berhasil diupdate", "id_specimen": idSpecimen})
	}
}

// ─── Specimen Lab (PK/MB) ───────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimSpecimenLabPK.java & ...LabMB.java (identik strukturnya,
// beda nama tabel) — digeneralisasi via parameter "jenis" (pk/mb), sama pola
// dgn ServiceRequest Lab. Beda dari Radiologi: identifier value pakai
// noorder+"."+id_template (BUKAN kd_jenis_prw), krn satu specimen lab bisa
// dipakai bersama utk beberapa item pemeriksaan dalam template yg sama.
type specimenLabDef struct {
	PermintaanTable     string
	DetailTable         string
	ServiceRequestTable string
	TrackingTable       string
}

var specimenLabDefs = map[string]specimenLabDef{
	"pk": {"permintaan_lab", "permintaan_detail_permintaan_lab", "satu_sehat_servicerequest_lab", "satu_sehat_specimen_lab"},
	"mb": {"permintaan_labmb", "permintaan_detail_permintaan_labmb", "satu_sehat_servicerequest_lab_mb", "satu_sehat_specimen_lab_mb"},
}

type specimenLabRow struct {
	NoRawat          string `json:"no_rawat"`
	NoRM             string `json:"no_rm"`
	NamaPasien       string `json:"nama_pasien"`
	NoKtpPasien      string `json:"no_ktp_pasien"`
	NoOrder          string `json:"noorder"`
	TglSampel        string `json:"tgl_sampel"`
	NmPerawatan      string `json:"nm_perawatan"`
	SampelCode       string `json:"sampel_code"`
	SampelSystem     string `json:"sampel_system"`
	SampelDisplay    string `json:"sampel_display"`
	IDServiceRequest string `json:"id_servicerequest"`
	IDTemplate       int    `json:"id_template"`
	KdJenisPrw       string `json:"kd_jenis_prw"`
	IDSpecimen       string `json:"id_specimen"`
}

// GET /api/satu-sehat/specimen-lab/:jenis
func getSpecimenLabCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := specimenLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := fmt.Sprintf(`
			SELECT
				rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
				pl.noorder, CONCAT(pl.tgl_sampel,' ',pl.jam_sampel) as tgl_sampel,
				IFNULL(tl.Pemeriksaan,''),
				IFNULL(m.sampel_code,''), IFNULL(m.sampel_system,''), IFNULL(m.sampel_display,''),
				sr.id_servicerequest, dpl.id_template, dpl.kd_jenis_prw,
				IFNULL(sp.id_specimen,'') as id_specimen
			FROM reg_periksa rp
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			INNER JOIN %s pl ON pl.no_rawat = rp.no_rawat
			INNER JOIN %s dpl ON dpl.noorder = pl.noorder
			INNER JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
			INNER JOIN satu_sehat_mapping_lab m ON m.id_template = tl.id_template
			INNER JOIN %s sr ON sr.noorder = dpl.noorder AND sr.id_template = dpl.id_template AND sr.kd_jenis_prw = dpl.kd_jenis_prw
			LEFT JOIN %s sp ON sp.noorder = sr.noorder AND sp.id_template = sr.id_template AND sp.kd_jenis_prw = sr.kd_jenis_prw
			WHERE rp.tgl_registrasi BETWEEN ? AND ?
		`, def.PermintaanTable, def.DetailTable, def.ServiceRequestTable, def.TrackingTable)
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (rp.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR tl.Pemeriksaan LIKE ? OR m.sampel_code LIKE ? OR pl.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 6; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY pl.tgl_sampel DESC, pl.noorder DESC, dpl.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []specimenLabRow{}
		for rows.Next() {
			var r specimenLabRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NoOrder, &r.TglSampel,
				&r.NmPerawatan, &r.SampelCode, &r.SampelSystem, &r.SampelDisplay,
				&r.IDServiceRequest, &r.IDTemplate, &r.KdJenisPrw, &r.IDSpecimen); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildSpecimenLabPayload(db *sql.DB, cfg SatuSehatConfig, token, jenis, noOrder string, idTemplate int, kdJenisPrw string) (map[string]interface{}, error) {
	def, ok := specimenLabDefs[jenis]
	if !ok {
		return nil, fmt.Errorf("Jenis lab tidak dikenal: %s", jenis)
	}

	var (
		noRkmMedis, namaPasien, nikPasien       string
		tglSampel, jamSampel                    sql.NullString
		sampelCode, sampelSystem, sampelDisplay string
		idServiceRequest                        string
	)
	query := fmt.Sprintf(`
		SELECT rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
			IFNULL(pl.tgl_sampel,''), pl.jam_sampel,
			IFNULL(m.sampel_code,''), IFNULL(m.sampel_system,''), IFNULL(m.sampel_display,''),
			IFNULL(sr.id_servicerequest,'')
		FROM %s pl
		INNER JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN %s dpl ON dpl.noorder = pl.noorder AND dpl.id_template = ? AND dpl.kd_jenis_prw = ?
		LEFT JOIN satu_sehat_mapping_lab m ON m.id_template = dpl.id_template
		LEFT JOIN %s sr ON sr.noorder = pl.noorder AND sr.id_template = dpl.id_template AND sr.kd_jenis_prw = dpl.kd_jenis_prw
		WHERE pl.noorder = ?
	`, def.PermintaanTable, def.DetailTable, def.ServiceRequestTable)
	err := db.QueryRow(query, idTemplate, kdJenisPrw, noOrder).Scan(&noRkmMedis, &namaPasien, &nikPasien, &tglSampel, &jamSampel,
		&sampelCode, &sampelSystem, &sampelDisplay, &idServiceRequest)
	if err != nil {
		return nil, fmt.Errorf("Data order/pemeriksaan lab tidak ditemukan")
	}
	if sampelCode == "" {
		return nil, fmt.Errorf("Pemeriksaan ini belum punya Mapping Sampel di menu Mapping Laboratorium")
	}
	if idServiceRequest == "" {
		return nil, fmt.Errorf("ServiceRequest untuk pemeriksaan ini belum dikirim")
	}
	if !tglSampel.Valid || tglSampel.String == "" || tglSampel.String == "0000-00-00" {
		return nil, fmt.Errorf("Tanggal sampel belum diisi untuk order ini")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}

	jam := jamSampel.String
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	receivedTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglSampel.String), jam)

	return map[string]interface{}{
		"resourceType": "Specimen",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/specimen/" + cfg.OrgID, "value": fmt.Sprintf("%s.%d", noOrder, idTemplate)},
		},
		"status": "available",
		"type": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": sampelSystem, "code": sampelCode, "display": sampelDisplay},
			},
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   namaPasien,
		},
		"request": []map[string]interface{}{
			{"reference": "ServiceRequest/" + idServiceRequest},
		},
		"receivedTime": receivedTime,
	}, nil
}

// POST /api/satu-sehat/specimen-lab/:jenis/send/*noorder?id_template=&kd_jenis_prw=
func sendSpecimenLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := specimenLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

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

		payload, err := buildSpecimenLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Specimen", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "specimen_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idSpecimen, _ := result["id"].(string)
		if idSpecimen != "" {
			db.Exec(fmt.Sprintf(`
				INSERT INTO %s (noorder, kd_jenis_prw, id_template, id_specimen)
				VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id_specimen = VALUES(id_specimen)
			`, def.TrackingTable), noOrder, kdJenisPrw, idTemplate, idSpecimen)
		}
		clearSatuSehatKirimError(db, "specimen_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "Specimen berhasil dikirim", "id_specimen": idSpecimen})
	}
}

// POST /api/satu-sehat/specimen-lab/:jenis/update/*noorder?id_template=&kd_jenis_prw=
func updateSpecimenLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := specimenLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idSpecimen string
		err = db.QueryRow(fmt.Sprintf(`SELECT id_specimen FROM %s WHERE noorder = ? AND id_template = ? AND kd_jenis_prw = ? AND id_specimen != ''`, def.TrackingTable),
			noOrder, idTemplate, kdJenisPrw).Scan(&idSpecimen)
		if err != nil || idSpecimen == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specimen belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildSpecimenLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idSpecimen

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Specimen/"+idSpecimen, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "specimen_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "specimen_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "Specimen berhasil diupdate", "id_specimen": idSpecimen})
	}
}

// ─── Observation Radiologi ──────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimObservationRadiologi.java. Prasyarat: Specimen utk
// pemeriksaan itu SUDAH terkirim, DAN hasil bacaan radiologi (periksa_radiologi
// + hasil_radiologi) sudah diinput petugas. "hasil" dikirim sbg valueString
// (teks bebas), BUKAN valueQuantity — persis Java. Join ke periksa_radiologi/
// hasil_radiologi dicocokkan lewat (no_rawat, tgl_periksa, jam) TANPA
// kd_jenis_prw (kolom itu memang tidak ada di kunci join Java) — jadi satu
// hasil bacaan bisa dipakai bersama utk lebih dari satu pemeriksaan kalau
// dicatat pada tgl_periksa+jam yg sama persis. Ini bawaan skema Khanza.
//
// Catatan: sama seperti Specimen Radiologi, Java py 2 blok query IDENTIK di
// tampil() (bug copy-paste) — saya query sekali saja.
type observationRadiologiRow struct {
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	NoOrder       string `json:"noorder"`
	TglHasil      string `json:"tgl_hasil"`
	NmPerawatan   string `json:"nm_perawatan"`
	Hasil         string `json:"hasil"`
	KdJenisPrw    string `json:"kd_jenis_prw"`
	IDSpecimen    string `json:"id_specimen"`
	NamaPetugas   string `json:"nama_petugas"`
	IDEncounter   string `json:"id_encounter"`
	IDObservation string `json:"id_observation"`
}

const observationRadiologiListJoins = `
	FROM reg_periksa
	INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
	INNER JOIN permintaan_radiologi ON permintaan_radiologi.no_rawat = reg_periksa.no_rawat
	INNER JOIN permintaan_pemeriksaan_radiologi ON permintaan_pemeriksaan_radiologi.noorder = permintaan_radiologi.noorder
	INNER JOIN jns_perawatan_radiologi ON jns_perawatan_radiologi.kd_jenis_prw = permintaan_pemeriksaan_radiologi.kd_jenis_prw
	INNER JOIN satu_sehat_mapping_radiologi ON satu_sehat_mapping_radiologi.kd_jenis_prw = jns_perawatan_radiologi.kd_jenis_prw
	INNER JOIN satu_sehat_specimen_radiologi ON satu_sehat_specimen_radiologi.noorder = permintaan_pemeriksaan_radiologi.noorder
		AND satu_sehat_specimen_radiologi.kd_jenis_prw = permintaan_pemeriksaan_radiologi.kd_jenis_prw
	INNER JOIN periksa_radiologi ON periksa_radiologi.no_rawat = permintaan_radiologi.no_rawat
		AND periksa_radiologi.tgl_periksa = permintaan_radiologi.tgl_hasil
		AND periksa_radiologi.jam = permintaan_radiologi.jam_hasil
		AND periksa_radiologi.dokter_perujuk = permintaan_radiologi.dokter_perujuk
	INNER JOIN hasil_radiologi ON hasil_radiologi.no_rawat = periksa_radiologi.no_rawat
		AND hasil_radiologi.tgl_periksa = periksa_radiologi.tgl_periksa
		AND hasil_radiologi.jam = periksa_radiologi.jam
	INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
	INNER JOIN pegawai ON periksa_radiologi.kd_dokter = pegawai.nik
`

// GET /api/satu-sehat/observation-radiologi
func getObservationRadiologiCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				permintaan_radiologi.noorder, CONCAT(permintaan_radiologi.tgl_hasil,' ',permintaan_radiologi.jam_hasil) as tgl_hasil,
				IFNULL(jns_perawatan_radiologi.nm_perawatan,''), hasil_radiologi.hasil,
				permintaan_pemeriksaan_radiologi.kd_jenis_prw, satu_sehat_specimen_radiologi.id_specimen,
				IFNULL(pegawai.nama,''), satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_observation_radiologi.id_observation,'')
		` + observationRadiologiListJoins + `
			LEFT JOIN satu_sehat_observation_radiologi ON satu_sehat_observation_radiologi.noorder = satu_sehat_specimen_radiologi.noorder
				AND satu_sehat_observation_radiologi.kd_jenis_prw = satu_sehat_specimen_radiologi.kd_jenis_prw
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR jns_perawatan_radiologi.nm_perawatan LIKE ? OR permintaan_radiologi.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 5; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY permintaan_radiologi.tgl_hasil DESC, permintaan_radiologi.noorder DESC, permintaan_pemeriksaan_radiologi.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []observationRadiologiRow{}
		for rows.Next() {
			var r observationRadiologiRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NoOrder, &r.TglHasil,
				&r.NmPerawatan, &r.Hasil, &r.KdJenisPrw, &r.IDSpecimen, &r.NamaPetugas, &r.IDEncounter, &r.IDObservation); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildObservationRadiologiPayload(db *sql.DB, cfg SatuSehatConfig, token, noOrder, kdJenisPrw string) (map[string]interface{}, error) {
	var (
		noRawat, noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter            string
		idEncounter                                string
		tglHasil, jamHasil                         string
		nmPerawatan, code, system, display, hasil  string
		idSpecimen                                 string
	)
	err := db.QueryRow(`
		SELECT
			reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			periksa_radiologi.kd_dokter, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
			satu_sehat_encounter.id_encounter,
			IFNULL(permintaan_radiologi.tgl_hasil,''), IFNULL(permintaan_radiologi.jam_hasil,'00:00:00'),
			IFNULL(jns_perawatan_radiologi.nm_perawatan,''), IFNULL(satu_sehat_mapping_radiologi.code,''),
			IFNULL(satu_sehat_mapping_radiologi.system,''), IFNULL(satu_sehat_mapping_radiologi.display,''),
			hasil_radiologi.hasil, satu_sehat_specimen_radiologi.id_specimen
	`+observationRadiologiListJoins+`
		WHERE permintaan_radiologi.noorder = ? AND permintaan_pemeriksaan_radiologi.kd_jenis_prw = ?
		LIMIT 1
	`, noOrder, kdJenisPrw).Scan(
		&noRawat, &noRkmMedis, &namaPasien, &nikPasien,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglHasil, &jamHasil, &nmPerawatan, &code, &system, &display, &hasil, &idSpecimen,
	)
	if err != nil {
		return nil, fmt.Errorf("Data hasil pemeriksaan radiologi tidak ditemukan (pastikan Specimen sudah dikirim dan hasil sudah diinput)")
	}
	if idSpecimen == "" {
		return nil, fmt.Errorf("Specimen untuk pemeriksaan ini belum dikirim")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number petugas: %s", err.Error())
	}

	jam := jamHasil
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	effectiveDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglHasil), jam)

	return map[string]interface{}{
		"resourceType": "Observation",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/observation/" + cfg.OrgID, "value": noOrder + "." + kdJenisPrw},
		},
		"status": "final",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "imaging", "display": "Imaging"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": system, "code": code, "display": display},
			},
		},
		"subject":   map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"performer": []map[string]interface{}{{"reference": "Practitioner/" + ihsDokter}},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display": fmt.Sprintf("Hasil Pemeriksaan Radiologi %s No.Rawat %s, Atas Nama Pasien %s, No.RM %s, Pada Tanggal %s",
				nmPerawatan, noRawat, namaPasien, noRkmMedis, tglHasil+" "+jamHasil),
		},
		"specimen":          map[string]interface{}{"reference": "Specimen/" + idSpecimen},
		"effectiveDateTime": effectiveDateTime,
		"valueString":       cleanClinicalImpressionText(hasil),
	}, nil
}

// POST /api/satu-sehat/observation-radiologi/send/*noorder?kd_jenis_prw=xxx
func sendObservationRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

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

		payload, err := buildObservationRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Observation", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idObservation, _ := result["id"].(string)
		if idObservation != "" {
			db.Exec(`
				INSERT INTO satu_sehat_observation_radiologi (noorder, kd_jenis_prw, id_observation)
				VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_observation = VALUES(id_observation)
			`, noOrder, kdJenisPrw, idObservation)
		}
		clearSatuSehatKirimError(db, "observation_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil dikirim", "id_observation": idObservation})
	}
}

// POST /api/satu-sehat/observation-radiologi/update/*noorder?kd_jenis_prw=xxx
func updateObservationRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idObservation string
		err = db.QueryRow(`SELECT id_observation FROM satu_sehat_observation_radiologi WHERE noorder = ? AND kd_jenis_prw = ? AND id_observation != ''`, noOrder, kdJenisPrw).Scan(&idObservation)
		if err != nil || idObservation == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Observation belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildObservationRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idObservation

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Observation/"+idObservation, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "observation_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil diupdate", "id_observation": idObservation})
	}
}

// ─── Observation Lab (PK/MB) ────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimObservationLabPK.java & ...LabMB.java. Keduanya
// berbagi TABEL HASIL yg sama (periksa_lab/detail_periksa_lab, dibedakan
// lewat kolom periksa_lab.kategori 'PK'/'MB') tapi Java sendiri TIDAK
// memfilter kategori itu di JOIN — cakupan PK vs MB murni ditentukan dari
// permintaan_lab vs permintaan_labmb. Direplikasi apa adanya (tanpa filter
// kategori tambahan) supaya konsisten dgn Java.
type observationLabDef struct {
	PermintaanTable string
	DetailTable     string
	SpecimenTable   string
	TrackingTable   string
}

var observationLabDefs = map[string]observationLabDef{
	"pk": {"permintaan_lab", "permintaan_detail_permintaan_lab", "satu_sehat_specimen_lab", "satu_sehat_observation_lab"},
	"mb": {"permintaan_labmb", "permintaan_detail_permintaan_labmb", "satu_sehat_specimen_lab_mb", "satu_sehat_observation_lab_mb"},
}

type observationLabRow struct {
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	NoOrder       string `json:"noorder"`
	TglHasil      string `json:"tgl_hasil"`
	NmPerawatan   string `json:"nm_perawatan"`
	Hasil         string `json:"hasil"`
	IDTemplate    int    `json:"id_template"`
	KdJenisPrw    string `json:"kd_jenis_prw"`
	IDSpecimen    string `json:"id_specimen"`
	NamaPetugas   string `json:"nama_petugas"`
	IDEncounter   string `json:"id_encounter"`
	IDObservation string `json:"id_observation"`
}

func observationLabHasilText(nilai, satuan, nilaiRujukan, keterangan string) string {
	s := "Hasil Lab : " + nilai + " " + satuan + ", Nilai Rujukan : " + nilaiRujukan
	if keterangan != "" {
		s += ", Keterangan : " + keterangan
	}
	return cleanClinicalImpressionText(s)
}

// GET /api/satu-sehat/observation-lab/:jenis
func getObservationLabCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := fmt.Sprintf(`
			SELECT
				rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
				pl.noorder, CONCAT(pl.tgl_hasil,' ',pl.jam_hasil) as tgl_hasil,
				IFNULL(tl.Pemeriksaan,''), dpl.nilai, IFNULL(tl.satuan,''), dpl.nilai_rujukan, dpl.keterangan,
				pdpl.id_template, sp.id_specimen, IFNULL(pegawai.nama,''), se.id_encounter,
				IFNULL(ob.id_observation,''), dpl.kd_jenis_prw
			FROM reg_periksa rp
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			INNER JOIN %s pl ON pl.no_rawat = rp.no_rawat
			INNER JOIN %s pdpl ON pdpl.noorder = pl.noorder
			INNER JOIN template_laboratorium tl ON tl.id_template = pdpl.id_template
			INNER JOIN satu_sehat_mapping_lab m ON m.id_template = tl.id_template
			INNER JOIN %s sp ON sp.noorder = pdpl.noorder AND sp.id_template = pdpl.id_template AND sp.kd_jenis_prw = pdpl.kd_jenis_prw
			INNER JOIN periksa_lab ON periksa_lab.no_rawat = pl.no_rawat AND periksa_lab.tgl_periksa = pl.tgl_hasil
				AND periksa_lab.jam = pl.jam_hasil AND periksa_lab.dokter_perujuk = pl.dokter_perujuk
			INNER JOIN detail_periksa_lab dpl ON dpl.no_rawat = periksa_lab.no_rawat AND dpl.tgl_periksa = periksa_lab.tgl_periksa AND dpl.jam = periksa_lab.jam
			LEFT JOIN %s ob ON ob.noorder = sp.noorder AND ob.id_template = sp.id_template AND ob.kd_jenis_prw = sp.kd_jenis_prw
			INNER JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
			INNER JOIN pegawai ON periksa_lab.kd_dokter = pegawai.nik
			WHERE rp.tgl_registrasi BETWEEN ? AND ?
		`, def.PermintaanTable, def.DetailTable, def.SpecimenTable, def.TrackingTable)
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (rp.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR tl.Pemeriksaan LIKE ? OR pl.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 5; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY pl.tgl_hasil DESC, pl.noorder DESC, dpl.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []observationLabRow{}
		for rows.Next() {
			var r observationLabRow
			var nilai, satuan, nilaiRujukan, keterangan string
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NoOrder, &r.TglHasil,
				&r.NmPerawatan, &nilai, &satuan, &nilaiRujukan, &keterangan,
				&r.IDTemplate, &r.IDSpecimen, &r.NamaPetugas, &r.IDEncounter, &r.IDObservation, &r.KdJenisPrw); err != nil {
				continue
			}
			r.Hasil = observationLabHasilText(nilai, satuan, nilaiRujukan, keterangan)
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildObservationLabPayload(db *sql.DB, cfg SatuSehatConfig, token, jenis, noOrder string, idTemplate int, kdJenisPrw string) (map[string]interface{}, error) {
	def, ok := observationLabDefs[jenis]
	if !ok {
		return nil, fmt.Errorf("Jenis lab tidak dikenal: %s", jenis)
	}

	var (
		noRawat, noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter            string
		idEncounter                                string
		tglHasil, jamHasil                         string
		nmPerawatan, code, system, display         string
		nilai, satuan, nilaiRujukan, keterangan    string
		idSpecimen                                 string
	)
	query := fmt.Sprintf(`
		SELECT
			rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
			periksa_lab.kd_dokter, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
			se.id_encounter,
			IFNULL(pl.tgl_hasil,''), IFNULL(pl.jam_hasil,'00:00:00'),
			IFNULL(tl.Pemeriksaan,''), IFNULL(m.code,''), IFNULL(m.system,''), IFNULL(m.display,''),
			dpl.nilai, IFNULL(tl.satuan,''), dpl.nilai_rujukan, dpl.keterangan,
			sp.id_specimen
		FROM %s pl
		INNER JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN %s pdpl ON pdpl.noorder = pl.noorder AND pdpl.id_template = ? AND pdpl.kd_jenis_prw = ?
		INNER JOIN template_laboratorium tl ON tl.id_template = pdpl.id_template
		LEFT JOIN satu_sehat_mapping_lab m ON m.id_template = pdpl.id_template
		INNER JOIN %s sp ON sp.noorder = pdpl.noorder AND sp.id_template = pdpl.id_template AND sp.kd_jenis_prw = pdpl.kd_jenis_prw
		INNER JOIN periksa_lab ON periksa_lab.no_rawat = pl.no_rawat AND periksa_lab.tgl_periksa = pl.tgl_hasil
			AND periksa_lab.jam = pl.jam_hasil AND periksa_lab.dokter_perujuk = pl.dokter_perujuk
		INNER JOIN detail_periksa_lab dpl ON dpl.no_rawat = periksa_lab.no_rawat AND dpl.tgl_periksa = periksa_lab.tgl_periksa
			AND dpl.jam = periksa_lab.jam AND dpl.kd_jenis_prw = pdpl.kd_jenis_prw
		INNER JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
		INNER JOIN pegawai ON periksa_lab.kd_dokter = pegawai.nik
		WHERE pl.noorder = ?
		LIMIT 1
	`, def.PermintaanTable, def.DetailTable, def.SpecimenTable)
	err := db.QueryRow(query, idTemplate, kdJenisPrw, noOrder).Scan(
		&noRawat, &noRkmMedis, &namaPasien, &nikPasien,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglHasil, &jamHasil, &nmPerawatan, &code, &system, &display,
		&nilai, &satuan, &nilaiRujukan, &keterangan, &idSpecimen,
	)
	if err != nil {
		return nil, fmt.Errorf("Data hasil pemeriksaan lab tidak ditemukan (pastikan Specimen sudah dikirim dan hasil sudah diinput)")
	}
	if idSpecimen == "" {
		return nil, fmt.Errorf("Specimen untuk pemeriksaan ini belum dikirim")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number petugas: %s", err.Error())
	}

	jam := jamHasil
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	effectiveDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglHasil), jam)

	return map[string]interface{}{
		"resourceType": "Observation",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/observation/" + cfg.OrgID, "value": fmt.Sprintf("%s.%d", noOrder, idTemplate)},
		},
		"status": "final",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory", "display": "Laboratory"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": system, "code": code, "display": display},
			},
		},
		"subject":   map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"performer": []map[string]interface{}{{"reference": "Practitioner/" + ihsDokter}},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display": fmt.Sprintf("Hasil Pemeriksaan Lab %s No.Rawat %s, Atas Nama Pasien %s, No.RM %s, Pada Tanggal %s",
				nmPerawatan, noRawat, namaPasien, noRkmMedis, tglHasil+" "+jamHasil),
		},
		"specimen":          map[string]interface{}{"reference": "Specimen/" + idSpecimen},
		"effectiveDateTime": effectiveDateTime,
		"valueString":       observationLabHasilText(nilai, satuan, nilaiRujukan, keterangan),
	}, nil
}

// POST /api/satu-sehat/observation-lab/:jenis/send/*noorder?id_template=&kd_jenis_prw=
func sendObservationLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

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

		payload, err := buildObservationLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Observation", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idObservation, _ := result["id"].(string)
		if idObservation != "" {
			db.Exec(fmt.Sprintf(`
				INSERT INTO %s (noorder, kd_jenis_prw, id_template, id_observation)
				VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id_observation = VALUES(id_observation)
			`, def.TrackingTable), noOrder, kdJenisPrw, idTemplate, idObservation)
		}
		clearSatuSehatKirimError(db, "observation_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil dikirim", "id_observation": idObservation})
	}
}

// POST /api/satu-sehat/observation-lab/:jenis/update/*noorder?id_template=&kd_jenis_prw=
func updateObservationLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := observationLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idObservation string
		err = db.QueryRow(fmt.Sprintf(`SELECT id_observation FROM %s WHERE noorder = ? AND id_template = ? AND kd_jenis_prw = ? AND id_observation != ''`, def.TrackingTable),
			noOrder, idTemplate, kdJenisPrw).Scan(&idObservation)
		if err != nil || idObservation == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Observation belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildObservationLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idObservation

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Observation/"+idObservation, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "observation_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "observation_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "Observation berhasil diupdate", "id_observation": idObservation})
	}
}

// ─── DiagnosticReport Radiologi ─────────────────────────────────────────────────
//
// Padanan SatuSehatKirimDiagnosticReportRadiologi.java. Prasyarat: Observation
// Radiologi utk pemeriksaan itu SUDAH terkirim (yg berarti ServiceRequest &
// Specimen juga sudah, krn Observation sendiri butuh Specimen). Ini resource
// TERAKHIR dlm rantai radiologi: ServiceRequest -> Specimen -> Observation ->
// DiagnosticReport, isinya rujukan ke ketiganya + "conclusion" dari
// hasil_radiologi.hasil (sama field yg jadi valueString Observation).
//
// Catatan: sama seperti Specimen/Observation Radiologi, Java py 2 blok query
// IDENTIK di tampil() — saya query sekali saja.
type diagnosticReportRadiologiRow struct {
	NoRawat            string `json:"no_rawat"`
	NoRM               string `json:"no_rm"`
	NamaPasien         string `json:"nama_pasien"`
	NoKtpPasien        string `json:"no_ktp_pasien"`
	NamaDokter         string `json:"nama_dokter"`
	IDEncounter        string `json:"id_encounter"`
	NoOrder            string `json:"noorder"`
	TglHasil           string `json:"tgl_hasil"`
	DiagnosaKlinis     string `json:"diagnosa_klinis"`
	NmPerawatan        string `json:"nm_perawatan"`
	IDServiceRequest   string `json:"id_servicerequest"`
	KdJenisPrw         string `json:"kd_jenis_prw"`
	IDSpecimen         string `json:"id_specimen"`
	IDObservation      string `json:"id_observation"`
	IDDiagnosticReport string `json:"id_diagnosticreport"`
	Hasil              string `json:"hasil"`
}

const diagnosticReportRadiologiJoins = `
	FROM reg_periksa
	INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
	INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
	INNER JOIN permintaan_radiologi ON permintaan_radiologi.no_rawat = reg_periksa.no_rawat
	INNER JOIN permintaan_pemeriksaan_radiologi ON permintaan_pemeriksaan_radiologi.noorder = permintaan_radiologi.noorder
	INNER JOIN jns_perawatan_radiologi ON jns_perawatan_radiologi.kd_jenis_prw = permintaan_pemeriksaan_radiologi.kd_jenis_prw
	INNER JOIN satu_sehat_mapping_radiologi ON satu_sehat_mapping_radiologi.kd_jenis_prw = jns_perawatan_radiologi.kd_jenis_prw
	INNER JOIN satu_sehat_servicerequest_radiologi ON satu_sehat_servicerequest_radiologi.noorder = permintaan_pemeriksaan_radiologi.noorder
		AND satu_sehat_servicerequest_radiologi.kd_jenis_prw = permintaan_pemeriksaan_radiologi.kd_jenis_prw
	INNER JOIN satu_sehat_specimen_radiologi ON satu_sehat_servicerequest_radiologi.noorder = satu_sehat_specimen_radiologi.noorder
		AND satu_sehat_servicerequest_radiologi.kd_jenis_prw = satu_sehat_specimen_radiologi.kd_jenis_prw
	INNER JOIN periksa_radiologi ON periksa_radiologi.no_rawat = permintaan_radiologi.no_rawat
		AND periksa_radiologi.tgl_periksa = permintaan_radiologi.tgl_hasil
		AND periksa_radiologi.jam = permintaan_radiologi.jam_hasil
		AND periksa_radiologi.dokter_perujuk = permintaan_radiologi.dokter_perujuk
	INNER JOIN hasil_radiologi ON hasil_radiologi.no_rawat = periksa_radiologi.no_rawat
		AND hasil_radiologi.tgl_periksa = periksa_radiologi.tgl_periksa
		AND hasil_radiologi.jam = periksa_radiologi.jam
	INNER JOIN satu_sehat_observation_radiologi ON satu_sehat_specimen_radiologi.noorder = satu_sehat_observation_radiologi.noorder
		AND satu_sehat_specimen_radiologi.kd_jenis_prw = satu_sehat_observation_radiologi.kd_jenis_prw
	INNER JOIN pegawai ON periksa_radiologi.kd_dokter = pegawai.nik
`

// GET /api/satu-sehat/diagnosticreport-radiologi
func getDiagnosticReportRadiologiCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				IFNULL(pegawai.nama,''), satu_sehat_encounter.id_encounter,
				permintaan_radiologi.noorder, CONCAT(permintaan_radiologi.tgl_hasil,' ',permintaan_radiologi.jam_hasil) as tgl_hasil,
				IFNULL(permintaan_radiologi.diagnosa_klinis,''), IFNULL(jns_perawatan_radiologi.nm_perawatan,''),
				satu_sehat_servicerequest_radiologi.id_servicerequest, permintaan_pemeriksaan_radiologi.kd_jenis_prw,
				satu_sehat_specimen_radiologi.id_specimen, satu_sehat_observation_radiologi.id_observation,
				IFNULL(satu_sehat_diagnosticreport_radiologi.id_diagnosticreport,''), hasil_radiologi.hasil
		` + diagnosticReportRadiologiJoins + `
			LEFT JOIN satu_sehat_diagnosticreport_radiologi ON satu_sehat_servicerequest_radiologi.noorder = satu_sehat_diagnosticreport_radiologi.noorder
				AND satu_sehat_servicerequest_radiologi.kd_jenis_prw = satu_sehat_diagnosticreport_radiologi.kd_jenis_prw
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pegawai.nama LIKE ? OR jns_perawatan_radiologi.nm_perawatan LIKE ? OR permintaan_radiologi.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 6; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY permintaan_radiologi.tgl_hasil DESC, permintaan_radiologi.noorder DESC, permintaan_pemeriksaan_radiologi.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []diagnosticReportRadiologiRow{}
		for rows.Next() {
			var r diagnosticReportRadiologiRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NamaDokter, &r.IDEncounter,
				&r.NoOrder, &r.TglHasil, &r.DiagnosaKlinis, &r.NmPerawatan,
				&r.IDServiceRequest, &r.KdJenisPrw, &r.IDSpecimen, &r.IDObservation,
				&r.IDDiagnosticReport, &r.Hasil); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildDiagnosticReportRadiologiPayload(db *sql.DB, cfg SatuSehatConfig, token, noOrder, kdJenisPrw string) (map[string]interface{}, error) {
	var (
		noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter   string
		idEncounter                       string
		tglHasil, jamHasil                string
		code, system, display             string
		idServiceRequest, idSpecimen      string
		idObservation, hasil              string
	)
	err := db.QueryRow(`
		SELECT
			reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			periksa_radiologi.kd_dokter, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
			satu_sehat_encounter.id_encounter,
			IFNULL(permintaan_radiologi.tgl_hasil,''), IFNULL(permintaan_radiologi.jam_hasil,'00:00:00'),
			IFNULL(satu_sehat_mapping_radiologi.code,''), IFNULL(satu_sehat_mapping_radiologi.system,''), IFNULL(satu_sehat_mapping_radiologi.display,''),
			satu_sehat_servicerequest_radiologi.id_servicerequest, satu_sehat_specimen_radiologi.id_specimen,
			satu_sehat_observation_radiologi.id_observation, hasil_radiologi.hasil
	`+diagnosticReportRadiologiJoins+`
		WHERE permintaan_radiologi.noorder = ? AND permintaan_pemeriksaan_radiologi.kd_jenis_prw = ?
		LIMIT 1
	`, noOrder, kdJenisPrw).Scan(
		&noRkmMedis, &namaPasien, &nikPasien,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglHasil, &jamHasil, &code, &system, &display,
		&idServiceRequest, &idSpecimen, &idObservation, &hasil,
	)
	if err != nil {
		return nil, fmt.Errorf("Data hasil pemeriksaan radiologi tidak ditemukan (pastikan Observation sudah dikirim)")
	}
	if idObservation == "" {
		return nil, fmt.Errorf("Observation untuk pemeriksaan ini belum dikirim")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number petugas: %s", err.Error())
	}

	jam := jamHasil
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	effectiveDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglHasil), jam)

	return map[string]interface{}{
		"resourceType": "DiagnosticReport",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/diagnostic/" + cfg.OrgID + "/rad", "use": "official", "value": noOrder + "." + kdJenisPrw},
		},
		"status": "final",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "RAD", "display": "Radiology"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"code": code, "display": display, "system": system},
			},
		},
		"subject":           map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"encounter":         map[string]interface{}{"reference": "Encounter/" + idEncounter},
		"effectiveDateTime": effectiveDateTime,
		"issued":            effectiveDateTime,
		"performer":         []map[string]interface{}{{"reference": "Practitioner/" + ihsDokter}},
		"specimen":          []map[string]interface{}{{"reference": "Specimen/" + idSpecimen}},
		"result":            []map[string]interface{}{{"reference": "Observation/" + idObservation}},
		"basedOn":           []map[string]interface{}{{"reference": "ServiceRequest/" + idServiceRequest}},
		"conclusion":        cleanClinicalImpressionText(hasil),
	}, nil
}

// POST /api/satu-sehat/diagnosticreport-radiologi/send/*noorder?kd_jenis_prw=xxx
func sendDiagnosticReportRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

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

		payload, err := buildDiagnosticReportRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/DiagnosticReport", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "diagnosticreport_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idDR, _ := result["id"].(string)
		if idDR != "" {
			db.Exec(`
				INSERT INTO satu_sehat_diagnosticreport_radiologi (noorder, kd_jenis_prw, id_diagnosticreport)
				VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_diagnosticreport = VALUES(id_diagnosticreport)
			`, noOrder, kdJenisPrw, idDR)
		}
		clearSatuSehatKirimError(db, "diagnosticreport_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "DiagnosticReport berhasil dikirim", "id_diagnosticreport": idDR})
	}
}

// POST /api/satu-sehat/diagnosticreport-radiologi/update/*noorder?kd_jenis_prw=xxx
func updateDiagnosticReportRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		if noOrder == "" || kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idDR string
		err = db.QueryRow(`SELECT id_diagnosticreport FROM satu_sehat_diagnosticreport_radiologi WHERE noorder = ? AND kd_jenis_prw = ? AND id_diagnosticreport != ''`, noOrder, kdJenisPrw).Scan(&idDR)
		if err != nil || idDR == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "DiagnosticReport belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildDiagnosticReportRadiologiPayload(db, cfg, token, noOrder, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idDR

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/DiagnosticReport/"+idDR, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "diagnosticreport_radiologi", noOrder+"|"+kdJenisPrw, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "diagnosticreport_radiologi", noOrder+"|"+kdJenisPrw)

		c.JSON(http.StatusOK, gin.H{"message": "DiagnosticReport berhasil diupdate", "id_diagnosticreport": idDR})
	}
}

// ─── DiagnosticReport Lab (PK/MB) ───────────────────────────────────────────────
//
// Padanan SatuSehatKirimDiagnosticReportLabPK.java & ...LabMB.java.
// "conclusion" bersumber dari saran_kesan_lab.kesan (tabel BARU, dishare
// PK/MB persis periksa_lab/detail_periksa_lab). Identifier system Java utk
// KEDUA varian sama-sama pakai suffix "/lab" (bukan "/pk" atau "/mb") —
// direplikasi apa adanya, bukan salah ketik saya.
type diagnosticReportLabDef struct {
	PermintaanTable     string
	DetailTable         string
	ServiceRequestTable string
	SpecimenTable       string
	ObservationTable    string
	TrackingTable       string
}

var diagnosticReportLabDefs = map[string]diagnosticReportLabDef{
	"pk": {"permintaan_lab", "permintaan_detail_permintaan_lab", "satu_sehat_servicerequest_lab", "satu_sehat_specimen_lab", "satu_sehat_observation_lab", "satu_sehat_diagnosticreport_lab"},
	"mb": {"permintaan_labmb", "permintaan_detail_permintaan_labmb", "satu_sehat_servicerequest_lab_mb", "satu_sehat_specimen_lab_mb", "satu_sehat_observation_lab_mb", "satu_sehat_diagnosticreport_lab_mb"},
}

type diagnosticReportLabRow struct {
	NoRawat            string `json:"no_rawat"`
	NoRM               string `json:"no_rm"`
	NamaPasien         string `json:"nama_pasien"`
	NoKtpPasien        string `json:"no_ktp_pasien"`
	NamaDokter         string `json:"nama_dokter"`
	IDEncounter        string `json:"id_encounter"`
	NoOrder            string `json:"noorder"`
	TglHasil           string `json:"tgl_hasil"`
	DiagnosaKlinis     string `json:"diagnosa_klinis"`
	NmPerawatan        string `json:"nm_perawatan"`
	IDServiceRequest   string `json:"id_servicerequest"`
	IDTemplate         int    `json:"id_template"`
	KdJenisPrw         string `json:"kd_jenis_prw"`
	IDSpecimen         string `json:"id_specimen"`
	IDObservation      string `json:"id_observation"`
	IDDiagnosticReport string `json:"id_diagnosticreport"`
	Kesan              string `json:"kesan"`
}

// GET /api/satu-sehat/diagnosticreport-lab/:jenis
func getDiagnosticReportLabCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := diagnosticReportLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := fmt.Sprintf(`
			SELECT
				rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
				IFNULL(pegawai.nama,''), se.id_encounter,
				pl.noorder, CONCAT(pl.tgl_hasil,' ',pl.jam_hasil) as tgl_hasil,
				IFNULL(pl.diagnosa_klinis,''), IFNULL(tl.Pemeriksaan,''),
				sr.id_servicerequest, pdpl.id_template, pdpl.kd_jenis_prw,
				sp.id_specimen, ob.id_observation,
				IFNULL(dr.id_diagnosticreport,''), IFNULL(skl.kesan,'')
			FROM reg_periksa rp
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			INNER JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
			INNER JOIN %s pl ON pl.no_rawat = rp.no_rawat
			INNER JOIN %s pdpl ON pdpl.noorder = pl.noorder
			INNER JOIN template_laboratorium tl ON tl.id_template = pdpl.id_template
			INNER JOIN satu_sehat_mapping_lab m ON m.id_template = tl.id_template
			INNER JOIN %s sr ON sr.noorder = pdpl.noorder AND sr.id_template = pdpl.id_template AND sr.kd_jenis_prw = pdpl.kd_jenis_prw
			INNER JOIN %s sp ON sp.noorder = sr.noorder AND sp.id_template = sr.id_template AND sp.kd_jenis_prw = sr.kd_jenis_prw
			INNER JOIN periksa_lab ON periksa_lab.no_rawat = pl.no_rawat AND periksa_lab.tgl_periksa = pl.tgl_hasil
				AND periksa_lab.jam = pl.jam_hasil AND periksa_lab.dokter_perujuk = pl.dokter_perujuk
			INNER JOIN saran_kesan_lab skl ON skl.no_rawat = periksa_lab.no_rawat AND skl.tgl_periksa = periksa_lab.tgl_periksa AND skl.jam = periksa_lab.jam
			INNER JOIN %s ob ON ob.noorder = sp.noorder AND ob.id_template = sp.id_template AND ob.kd_jenis_prw = sp.kd_jenis_prw
			LEFT JOIN %s dr ON dr.noorder = sr.noorder AND dr.id_template = sr.id_template AND dr.kd_jenis_prw = sr.kd_jenis_prw
			INNER JOIN pegawai ON periksa_lab.kd_dokter = pegawai.nik
			WHERE rp.tgl_registrasi BETWEEN ? AND ?
		`, def.PermintaanTable, def.DetailTable, def.ServiceRequestTable, def.SpecimenTable, def.ObservationTable, def.TrackingTable)
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (rp.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR pegawai.nama LIKE ? OR tl.Pemeriksaan LIKE ? OR pl.noorder LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 6; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY pl.tgl_hasil DESC, pl.noorder DESC, pdpl.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []diagnosticReportLabRow{}
		for rows.Next() {
			var r diagnosticReportLabRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.NamaDokter, &r.IDEncounter,
				&r.NoOrder, &r.TglHasil, &r.DiagnosaKlinis, &r.NmPerawatan,
				&r.IDServiceRequest, &r.IDTemplate, &r.KdJenisPrw, &r.IDSpecimen, &r.IDObservation,
				&r.IDDiagnosticReport, &r.Kesan); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func buildDiagnosticReportLabPayload(db *sql.DB, cfg SatuSehatConfig, token, jenis, noOrder string, idTemplate int, kdJenisPrw string) (map[string]interface{}, error) {
	def, ok := diagnosticReportLabDefs[jenis]
	if !ok {
		return nil, fmt.Errorf("Jenis lab tidak dikenal: %s", jenis)
	}

	var (
		noRkmMedis, namaPasien, nikPasien string
		kdDokter, namaDokter, nikDokter   string
		idEncounter                       string
		tglHasil, jamHasil                string
		code, system, display             string
		idServiceRequest, idSpecimen      string
		idObservation, kesan              string
	)
	query := fmt.Sprintf(`
		SELECT
			rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,''),
			periksa_lab.kd_dokter, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
			se.id_encounter,
			IFNULL(pl.tgl_hasil,''), IFNULL(pl.jam_hasil,'00:00:00'),
			IFNULL(m.code,''), IFNULL(m.system,''), IFNULL(m.display,''),
			sr.id_servicerequest, sp.id_specimen, ob.id_observation, IFNULL(skl.kesan,'')
		FROM %s pl
		INNER JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
		INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
		INNER JOIN %s pdpl ON pdpl.noorder = pl.noorder AND pdpl.id_template = ? AND pdpl.kd_jenis_prw = ?
		LEFT JOIN satu_sehat_mapping_lab m ON m.id_template = pdpl.id_template
		INNER JOIN %s sr ON sr.noorder = pdpl.noorder AND sr.id_template = pdpl.id_template AND sr.kd_jenis_prw = pdpl.kd_jenis_prw
		INNER JOIN %s sp ON sp.noorder = sr.noorder AND sp.id_template = sr.id_template AND sp.kd_jenis_prw = sr.kd_jenis_prw
		INNER JOIN periksa_lab ON periksa_lab.no_rawat = pl.no_rawat AND periksa_lab.tgl_periksa = pl.tgl_hasil
			AND periksa_lab.jam = pl.jam_hasil AND periksa_lab.dokter_perujuk = pl.dokter_perujuk
		LEFT JOIN saran_kesan_lab skl ON skl.no_rawat = periksa_lab.no_rawat AND skl.tgl_periksa = periksa_lab.tgl_periksa AND skl.jam = periksa_lab.jam
		INNER JOIN %s ob ON ob.noorder = sp.noorder AND ob.id_template = sp.id_template AND ob.kd_jenis_prw = sp.kd_jenis_prw
		INNER JOIN satu_sehat_encounter se ON se.no_rawat = rp.no_rawat
		INNER JOIN pegawai ON periksa_lab.kd_dokter = pegawai.nik
		WHERE pl.noorder = ?
		LIMIT 1
	`, def.PermintaanTable, def.DetailTable, def.ServiceRequestTable, def.SpecimenTable, def.ObservationTable)
	err := db.QueryRow(query, idTemplate, kdJenisPrw, noOrder).Scan(
		&noRkmMedis, &namaPasien, &nikPasien,
		&kdDokter, &namaDokter, &nikDokter, &idEncounter,
		&tglHasil, &jamHasil, &code, &system, &display,
		&idServiceRequest, &idSpecimen, &idObservation, &kesan,
	)
	if err != nil {
		return nil, fmt.Errorf("Data hasil pemeriksaan lab tidak ditemukan (pastikan Observation sudah dikirim)")
	}
	if idObservation == "" {
		return nil, fmt.Errorf("Observation untuk pemeriksaan ini belum dikirim")
	}

	ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, noRkmMedis, nikPasien)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number pasien: %s", err.Error())
	}
	ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, kdDokter, nikDokter)
	if err != nil {
		return nil, fmt.Errorf("Gagal mendapatkan IHS Number petugas: %s", err.Error())
	}

	jam := jamHasil
	if jam == "" || jam == "00:00:00" {
		jam = "08:00:00"
	}
	effectiveDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglHasil), jam)

	return map[string]interface{}{
		"resourceType": "DiagnosticReport",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/diagnostic/" + cfg.OrgID + "/lab", "use": "official", "value": noOrder + "." + kdJenisPrw},
		},
		"status": "final",
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "LAB", "display": "Laboratory"},
			}},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"code": code, "display": display, "system": system},
			},
		},
		"subject":           map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"encounter":         map[string]interface{}{"reference": "Encounter/" + idEncounter},
		"effectiveDateTime": effectiveDateTime,
		"issued":            effectiveDateTime,
		"performer":         []map[string]interface{}{{"reference": "Practitioner/" + ihsDokter}},
		"specimen":          []map[string]interface{}{{"reference": "Specimen/" + idSpecimen}},
		"result":            []map[string]interface{}{{"reference": "Observation/" + idObservation}},
		"basedOn":           []map[string]interface{}{{"reference": "ServiceRequest/" + idServiceRequest}},
		"conclusion":        cleanClinicalImpressionText(kesan),
	}, nil
}

// POST /api/satu-sehat/diagnosticreport-lab/:jenis/send/*noorder?id_template=&kd_jenis_prw=
func sendDiagnosticReportLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := diagnosticReportLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

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

		payload, err := buildDiagnosticReportLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/DiagnosticReport", bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "diagnosticreport_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		idDR, _ := result["id"].(string)
		if idDR != "" {
			db.Exec(fmt.Sprintf(`
				INSERT INTO %s (noorder, kd_jenis_prw, id_template, id_diagnosticreport)
				VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id_diagnosticreport = VALUES(id_diagnosticreport)
			`, def.TrackingTable), noOrder, kdJenisPrw, idTemplate, idDR)
		}
		clearSatuSehatKirimError(db, "diagnosticreport_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "DiagnosticReport berhasil dikirim", "id_diagnosticreport": idDR})
	}
}

// POST /api/satu-sehat/diagnosticreport-lab/:jenis/update/*noorder?id_template=&kd_jenis_prw=
func updateDiagnosticReportLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Param("jenis")
		def, ok := diagnosticReportLabDefs[jenis]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis lab tidak dikenal (gunakan pk/mb)"})
			return
		}
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		kdJenisPrw := c.Query("kd_jenis_prw")
		idTemplate, _ := strconv.Atoi(c.Query("id_template"))
		if noOrder == "" || kdJenisPrw == "" || idTemplate == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder, id_template, dan kd_jenis_prw wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(fmt.Sprintf(`SELECT no_rawat FROM %s WHERE noorder = ? LIMIT 1`, def.PermintaanTable), noOrder).Scan(&noRawatLookup)
		refKey := noOrder + "|" + kdJenisPrw + "|" + strconv.Itoa(idTemplate)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idDR string
		err = db.QueryRow(fmt.Sprintf(`SELECT id_diagnosticreport FROM %s WHERE noorder = ? AND id_template = ? AND kd_jenis_prw = ? AND id_diagnosticreport != ''`, def.TrackingTable),
			noOrder, idTemplate, kdJenisPrw).Scan(&idDR)
		if err != nil || idDR == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "DiagnosticReport belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payload, err := buildDiagnosticReportLabPayload(db, cfg, token, jenis, noOrder, idTemplate, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idDR

		payloadBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/DiagnosticReport/"+idDR, bytes.NewReader(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "diagnosticreport_lab_"+jenis, refKey, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": string(respBody)})
			return
		}
		clearSatuSehatKirimError(db, "diagnosticreport_lab_"+jenis, refKey)

		c.JSON(http.StatusOK, gin.H{"message": "DiagnosticReport berhasil diupdate", "id_diagnosticreport": idDR})
	}
}

// ─── ClinicalImpression ────────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimClinicalImpression.java. Prasyarat: Encounter DAN
// Condition (diagnosa) utk no_rawat itu SUDAH terkirim, plus pemeriksaan_ralan/
// ranap.penilaian sudah diisi (assessment dokter). Persis pola Ralan/Ranap
// 2-cabang query terpisah spt Condition/Observation. Satu baris = kombinasi
// (kunjungan+waktu periksa) × (satu diagnosa) — kalau satu kunjungan py >1
// diagnosa, Java (dan skema tabel satu_sehat_clinicalimpression yg PK-nya
// TIDAK menyertakan kd_penyakit) memang menghasilkan >1 baris/ClinicalImpression
// terpisah utk waktu periksa yg sama, masing2 nunjuk 1 Condition lewat
// "finding". Ini bawaan skema Khanza, bukan sesuatu yg saya ubah di sini.
//
// Catatan: Java py bug copy-paste di cabang Ranap — label status di kolom
// tabMode di-hardcode "Ralan" walau itu query utk pemeriksaan_ranap. Di Go
// ini saya pakai label yg benar ("Ranap") krn field itu dipakai sbg status
// asli utk gating & PK lokal (satu_sehat_clinicalimpression.status), bukan
// cuma teks tampilan.
type ClinicalImpressionCandidateRow struct {
	TglRegistrasi        string `json:"tgl_registrasi"`
	NoRawat              string `json:"no_rawat"`
	NoRM                 string `json:"no_rm"`
	NamaPasien           string `json:"nama_pasien"`
	NoKtpPasien          string `json:"no_ktp_pasien"`
	SttsRawat            string `json:"stts_rawat"`
	Status               string `json:"status"`
	TglRegistrasiJamReg  string `json:"tgl_registrasi_jam_reg"`
	IDEncounter          string `json:"id_encounter"`
	Deskripsi            string `json:"deskripsi"`
	Penilaian            string `json:"penilaian"`
	NamaPetugas          string `json:"nama_petugas"`
	NoKtpPetugas         string `json:"no_ktp_petugas"`
	TglPerawatan         string `json:"tgl_perawatan"`
	JamRawat             string `json:"jam_rawat"`
	KdPenyakit           string `json:"kd_penyakit"`
	NamaPenyakit         string `json:"nama_penyakit"`
	IDCondition          string `json:"id_condition"`
	IDClinicalImpression string `json:"id_clinicalimpression"`
}

// GET /api/satu-sehat/clinical-impression
func getClinicalImpressionCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		branchQuery := func(pemeriksaanTable, status string) (string, []interface{}) {
			q := fmt.Sprintf(`
				SELECT
					IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis,
					pasien.nm_pasien, IFNULL(pasien.no_ktp,''), reg_periksa.stts,
					CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg) AS pulang,
					satu_sehat_encounter.id_encounter,
					pegawai.nama, IFNULL(pegawai.no_ktp,''),
					IFNULL(pe.tgl_perawatan,''), pe.jam_rawat, pe.penilaian, IFNULL(pe.keluhan,''), IFNULL(pe.pemeriksaan,''),
					satu_sehat_condition.kd_penyakit, IFNULL(penyakit.nm_penyakit,''), IFNULL(satu_sehat_condition.id_condition,''),
					IFNULL(sci.id_clinicalimpression,'')
				FROM reg_periksa
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
				INNER JOIN satu_sehat_condition ON satu_sehat_condition.no_rawat = reg_periksa.no_rawat AND satu_sehat_condition.status = ?
				INNER JOIN penyakit ON penyakit.kd_penyakit = satu_sehat_condition.kd_penyakit
				INNER JOIN %s pe ON pe.no_rawat = reg_periksa.no_rawat
				INNER JOIN pegawai ON pegawai.nik = pe.nip
				LEFT JOIN satu_sehat_clinicalimpression sci ON sci.no_rawat = pe.no_rawat
					AND sci.tgl_perawatan = pe.tgl_perawatan AND sci.jam_rawat = pe.jam_rawat AND sci.status = ?
				WHERE pe.penilaian <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
			`, pemeriksaanTable)
			args := []interface{}{status, status, tglDari, tglSampai}
			if keyword != "" {
				q += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.no_ktp LIKE ? OR pegawai.nama LIKE ? OR reg_periksa.stts LIKE ?)`
				kw := "%" + keyword + "%"
				for i := 0; i < 7; i++ {
					args = append(args, kw)
				}
			}
			return q, args
		}

		list := []ClinicalImpressionCandidateRow{}
		branches := []struct{ table, status string }{
			{"pemeriksaan_ralan", "Ralan"},
			{"pemeriksaan_ranap", "Ranap"},
		}
		for _, b := range branches {
			q, args := branchQuery(b.table, b.status)
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				var r ClinicalImpressionCandidateRow
				var keluhan, pemeriksaan string
				if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.SttsRawat,
					&r.TglRegistrasiJamReg, &r.IDEncounter, &r.NamaPetugas, &r.NoKtpPetugas,
					&r.TglPerawatan, &r.JamRawat, &r.Penilaian, &keluhan, &pemeriksaan,
					&r.KdPenyakit, &r.NamaPenyakit, &r.IDCondition, &r.IDClinicalImpression); err != nil {
					continue
				}
				r.Deskripsi = keluhan + ", " + pemeriksaan
				r.Status = b.status
				list = append(list, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func cleanClinicalImpressionText(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "<br>")
	s = strings.ReplaceAll(s, "\n\r", "<br>")
	s = strings.ReplaceAll(s, "\r", "<br>")
	s = strings.ReplaceAll(s, "\n", "<br>")
	s = strings.ReplaceAll(s, "\t", " ")
	return s
}

type clinicalImpressionRowData struct {
	NoRkmMedis          string
	NamaPasien          string
	NikPasien           string
	TglRegistrasiJamReg string
	Keluhan             string
	Pemeriksaan         string
	Penilaian           string
	NipPetugas          string
	NikPetugas          string
	KdPenyakit          string
	NamaPenyakit        string
	IDCondition         string
}

func fetchClinicalImpressionRowData(db *sql.DB, noRawat, tglPerawatan, jamRawat, status, kdPenyakit string) (clinicalImpressionRowData, error) {
	var d clinicalImpressionRowData
	pemeriksaanTable := "pemeriksaan_ralan"
	if status == "Ranap" {
		pemeriksaanTable = "pemeriksaan_ranap"
	}
	query := fmt.Sprintf(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg),
			IFNULL(pe.keluhan,''), IFNULL(pe.pemeriksaan,''), pe.penilaian, pe.nip, IFNULL(pegawai.no_ktp,''),
			satu_sehat_condition.kd_penyakit, IFNULL(penyakit.nm_penyakit,''), IFNULL(satu_sehat_condition.id_condition,'')
		FROM %s pe
		INNER JOIN reg_periksa ON reg_periksa.no_rawat = pe.no_rawat
		INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
		INNER JOIN pegawai ON pegawai.nik = pe.nip
		INNER JOIN satu_sehat_condition ON satu_sehat_condition.no_rawat = pe.no_rawat
			AND satu_sehat_condition.status = ? AND satu_sehat_condition.kd_penyakit = ?
		INNER JOIN penyakit ON penyakit.kd_penyakit = satu_sehat_condition.kd_penyakit
		WHERE pe.no_rawat = ? AND pe.tgl_perawatan = ? AND pe.jam_rawat = ?
		LIMIT 1
	`, pemeriksaanTable)
	err := db.QueryRow(query, status, kdPenyakit, noRawat, tglPerawatan, jamRawat).Scan(
		&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.TglRegistrasiJamReg,
		&d.Keluhan, &d.Pemeriksaan, &d.Penilaian, &d.NipPetugas, &d.NikPetugas,
		&d.KdPenyakit, &d.NamaPenyakit, &d.IDCondition,
	)
	return d, err
}

// buildClinicalImpressionPayload — persis format json Java BtnKirim/BtnUpdate,
// ditambah "problem" dan "investigation" (2 field yg ada di contoh resmi tapi
// tidak ada di Java Khanza — lihat catatan di fetchClinicalImpressionInvestigations).
// "assessor" TIDAK py display (beda dgn "requester" resource lain) — persis
// Java, tidak ditambah krn tidak ada di source.
// clinicalImpressionIdentifierSanitizer — identifier FHIR harus 1 string
// tanpa karakter yg berarti struktural di no_rawat ("/") atau jam (":").
var clinicalImpressionIdentifierSanitizer = strings.NewReplacer("/", "", ":", "", " ", "")

// fetchClinicalImpressionInvestigations — mengumpulkan semua DiagnosticReport
// (Radiologi/Lab PK/Lab MB) yg SUDAH terkirim utk no_rawat yg sama dgn
// ClinicalImpression ini, dipasangkan dgn Observation-nya (kalau ada), utk
// mengisi field "investigation". TIDAK ada relasi eksplisit di skema Khanza
// antara pemeriksaan_ralan/ranap (sumber ClinicalImpression) dgn order
// radiologi/lab tertentu — jadi dicocokkan lewat kesamaan no_rawat (satu
// kunjungan), bukan lewat FK langsung. Kalau kunjungan itu tidak py
// DiagnosticReport terkirim sama sekali, field ini dilewati (bukan array
// kosong) spy tidak mengklaim ada investigasi yg sebenarnya tidak ada.
func fetchClinicalImpressionInvestigations(db *sql.DB, noRawat string) []map[string]interface{} {
	type invRow struct {
		Label              string
		IDDiagnosticReport string
		IDObservation      sql.NullString
	}
	var rows []invRow

	radRows, err := db.Query(`
		SELECT IFNULL(jpr.nm_perawatan,''), dr.id_diagnosticreport, ob.id_observation
		FROM satu_sehat_diagnosticreport_radiologi dr
		INNER JOIN permintaan_radiologi pr ON pr.noorder = dr.noorder
		LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = dr.kd_jenis_prw
		LEFT JOIN satu_sehat_observation_radiologi ob ON ob.noorder = dr.noorder AND ob.kd_jenis_prw = dr.kd_jenis_prw
		WHERE pr.no_rawat = ? AND dr.id_diagnosticreport != ''
	`, noRawat)
	if err == nil {
		for radRows.Next() {
			var r invRow
			radRows.Scan(&r.Label, &r.IDDiagnosticReport, &r.IDObservation)
			rows = append(rows, r)
		}
		radRows.Close()
	}

	labDefs := []struct {
		DRTable, PermintaanTable, ObsTable string
	}{
		{"satu_sehat_diagnosticreport_lab", "permintaan_lab", "satu_sehat_observation_lab"},
		{"satu_sehat_diagnosticreport_lab_mb", "permintaan_labmb", "satu_sehat_observation_lab_mb"},
	}
	for _, ld := range labDefs {
		q := fmt.Sprintf(`
			SELECT IFNULL(tl.Pemeriksaan,''), dr.id_diagnosticreport, ob.id_observation
			FROM %s dr
			INNER JOIN %s pl ON pl.noorder = dr.noorder
			LEFT JOIN template_laboratorium tl ON tl.id_template = dr.id_template
			LEFT JOIN %s ob ON ob.noorder = dr.noorder AND ob.id_template = dr.id_template AND ob.kd_jenis_prw = dr.kd_jenis_prw
			WHERE pl.no_rawat = ? AND dr.id_diagnosticreport != ''
		`, ld.DRTable, ld.PermintaanTable, ld.ObsTable)
		labRows, err := db.Query(q, noRawat)
		if err != nil {
			continue
		}
		for labRows.Next() {
			var r invRow
			labRows.Scan(&r.Label, &r.IDDiagnosticReport, &r.IDObservation)
			rows = append(rows, r)
		}
		labRows.Close()
	}

	investigations := []map[string]interface{}{}
	for _, r := range rows {
		items := []map[string]interface{}{
			{"reference": "DiagnosticReport/" + r.IDDiagnosticReport},
		}
		if r.IDObservation.Valid && r.IDObservation.String != "" {
			items = append(items, map[string]interface{}{"reference": "Observation/" + r.IDObservation.String})
		}
		investigations = append(investigations, map[string]interface{}{
			"code": map[string]interface{}{"text": r.Label},
			"item": items,
		})
	}
	return investigations
}

func buildClinicalImpressionPayload(db *sql.DB, id, noRawat, tglPerawatan, jamRawat string, d clinicalImpressionRowData, ihsPasien, idEncounter, ihsDokter, orgID string) map[string]interface{} {
	effectiveDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglPerawatan), jamRawat)
	identifierValue := clinicalImpressionIdentifierSanitizer.Replace(noRawat + "." + tglPerawatan + "." + jamRawat + "." + d.KdPenyakit)
	conditionRef := map[string]interface{}{"reference": "Condition/" + d.IDCondition}
	payload := map[string]interface{}{
		"resourceType": "ClinicalImpression",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/clinicalimpression/" + orgID, "use": "official", "value": identifierValue},
		},
		"status":      "completed",
		"description": cleanClinicalImpressionText(d.Keluhan + ", " + d.Pemeriksaan),
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   d.NamaPasien,
		},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display":   fmt.Sprintf("Kunjungan %s pada tanggal %s dengan nomor kunjungan %s", d.NamaPasien, d.TglRegistrasiJamReg, noRawat),
		},
		"effectiveDateTime": effectiveDateTime,
		"date":              effectiveDateTime,
		"assessor":          map[string]interface{}{"reference": "Practitioner/" + ihsDokter},
		"problem":           []map[string]interface{}{conditionRef},
		"summary":           cleanClinicalImpressionText(d.Penilaian),
		"finding": []map[string]interface{}{
			{
				"itemCodeableConcept": map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": "http://hl7.org/fhir/sid/icd-10", "code": d.KdPenyakit, "display": d.NamaPenyakit},
					},
				},
				"itemReference": conditionRef,
			},
		},
		"prognosisCodeableConcept": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.kemkes.go.id/CodeSystem/clinical-term", "code": "PR000001", "display": "Prognosis"},
			}},
		},
	}
	if investigations := fetchClinicalImpressionInvestigations(db, noRawat); len(investigations) > 0 {
		payload["investigation"] = investigations
	}
	if id != "" {
		payload["id"] = id
	}
	return payload
}

type clinicalImpressionRequestBody struct {
	TglPerawatan string `json:"tgl_perawatan"`
	JamRawat     string `json:"jam_rawat"`
	Status       string `json:"status"`
	KdPenyakit   string `json:"kd_penyakit"`
}

// POST /api/satu-sehat/clinical-impression/send/*no_rawat
func sendClinicalImpressionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body clinicalImpressionRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.KdPenyakit == "" ||
			(body.Status != "Ralan" && body.Status != "Ranap") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam_rawat, status, dan kd_penyakit wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchClinicalImpressionRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.Status, body.KdPenyakit)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan/diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildClinicalImpressionPayload(db, "", noRawat, body.TglPerawatan, body.JamRawat, d, ihsPasien, idEncounter, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/ClinicalImpression", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "clinical_impression", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idClinicalImpression := satuSehatJSONStr(result["id"])
		if idClinicalImpression == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID ClinicalImpression tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_clinicalimpression (no_rawat, tgl_perawatan, jam_rawat, status, id_clinicalimpression)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_clinicalimpression = VALUES(id_clinicalimpression)
		`, noRawat, body.TglPerawatan, body.JamRawat, body.Status, idClinicalImpression); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ClinicalImpression terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "clinical_impression", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "ClinicalImpression berhasil dikirim", "id_clinicalimpression": idClinicalImpression})
	}
}

// POST /api/satu-sehat/clinical-impression/update/*no_rawat
func updateClinicalImpressionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body clinicalImpressionRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.TglPerawatan == "" || body.JamRawat == "" || body.KdPenyakit == "" ||
			(body.Status != "Ralan" && body.Status != "Ranap") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam_rawat, status, dan kd_penyakit wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idClinicalImpression string
		err = db.QueryRow(`
			SELECT id_clinicalimpression FROM satu_sehat_clinicalimpression
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND status = ? AND id_clinicalimpression != ''
		`, noRawat, body.TglPerawatan, body.JamRawat, body.Status).Scan(&idClinicalImpression)
		if err != nil || idClinicalImpression == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ClinicalImpression belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchClinicalImpressionRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.Status, body.KdPenyakit)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan/diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildClinicalImpressionPayload(db, idClinicalImpression, noRawat, body.TglPerawatan, body.JamRawat, d, ihsPasien, idEncounter, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/ClinicalImpression/"+idClinicalImpression, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "clinical_impression", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "clinical_impression", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "ClinicalImpression berhasil diupdate", "id_clinicalimpression": idClinicalImpression})
	}
}

// ─── Composition ────────────────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimDiet.java — dikonfirmasi user: menu "Composition" di
// Satu Sehat memang dibangun dari catatan instruksi diet/gizi (catatan_adime_gizi),
// dibungkus sbg dokumen FHIR Composition (bukan NutritionOrder), persis contoh
// resmi: type "Discharge summary", section "Discharge diet (narrative)" berisi
// teks instruksi diet. Tabel tracking lokal REUSE satu_sehat_diet (sudah ada di
// skema Khanza, PK no_rawat+tanggal) — kolom id_diet menyimpan ID Composition.
//
// Beda dari resource lain: Composition.identifier itu OBJECT TUNGGAL di FHIR
// (bukan array) — dikonfirmasi dari contoh resmi. "date" juga cuma tanggal
// (bukan datetime+timezone) sesuai contoh resmi.
type CompositionCandidateRow struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NoKtpPasien   string `json:"no_ktp_pasien"`
	IDEncounter   string `json:"id_encounter"`
	Instruksi     string `json:"instruksi"`
	NamaPetugas   string `json:"nama_petugas"`
	NoKtpPetugas  string `json:"no_ktp_petugas"`
	Tanggal       string `json:"tanggal"`
	StatusLanjut  string `json:"status_lanjut"`
	IDComposition string `json:"id_composition"`
}

// GET /api/satu-sehat/composition
func getCompositionCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis,
				pasien.nm_pasien, IFNULL(pasien.no_ktp,''), satu_sehat_encounter.id_encounter,
				catatan_adime_gizi.instruksi, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
				IFNULL(catatan_adime_gizi.tanggal,''), reg_periksa.status_lanjut,
				IFNULL(satu_sehat_diet.id_diet,'') as id_composition
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN catatan_adime_gizi ON catatan_adime_gizi.no_rawat = reg_periksa.no_rawat
			INNER JOIN pegawai ON catatan_adime_gizi.nip = pegawai.nik
			LEFT JOIN satu_sehat_diet ON satu_sehat_diet.no_rawat = catatan_adime_gizi.no_rawat
				AND satu_sehat_diet.tanggal = catatan_adime_gizi.tanggal
			WHERE catatan_adime_gizi.instruksi <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.no_ktp LIKE ? OR pegawai.nama LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 6; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY catatan_adime_gizi.tanggal DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []CompositionCandidateRow{}
		for rows.Next() {
			var r CompositionCandidateRow
			if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien, &r.IDEncounter,
				&r.Instruksi, &r.NamaPetugas, &r.NoKtpPetugas, &r.Tanggal, &r.StatusLanjut, &r.IDComposition); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type compositionRowData struct {
	NoRkmMedis          string
	NamaPasien          string
	NikPasien           string
	NipPetugas          string
	NikPetugas          string
	NamaPetugas         string
	StatusLanjut        string
	Instruksi           string
	TglRegistrasiJamReg string
}

func fetchCompositionRowData(db *sql.DB, noRawat, tanggal string) (compositionRowData, error) {
	var d compositionRowData
	err := db.QueryRow(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			catatan_adime_gizi.nip, IFNULL(pegawai.no_ktp,''), IFNULL(pegawai.nama,''),
			reg_periksa.status_lanjut, catatan_adime_gizi.instruksi,
			CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg)
		FROM catatan_adime_gizi
		INNER JOIN reg_periksa ON reg_periksa.no_rawat = catatan_adime_gizi.no_rawat
		INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
		INNER JOIN pegawai ON pegawai.nik = catatan_adime_gizi.nip
		WHERE catatan_adime_gizi.no_rawat = ? AND catatan_adime_gizi.tanggal = ?
		LIMIT 1
	`, noRawat, tanggal).Scan(
		&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien,
		&d.NipPetugas, &d.NikPetugas, &d.NamaPetugas,
		&d.StatusLanjut, &d.Instruksi, &d.TglRegistrasiJamReg,
	)
	return d, err
}

var compositionIdentifierSanitizer = strings.NewReplacer("/", "", ":", "", " ", "")

func buildCompositionPayload(id, noRawat, tanggal string, d compositionRowData, ihsPasien, idEncounter, ihsDokter, orgID string) map[string]interface{} {
	identifierValue := compositionIdentifierSanitizer.Replace(noRawat + "." + tanggal)
	title := "Resume Medis Rawat Jalan"
	if d.StatusLanjut == "Ranap" {
		title = "Resume Medis Rawat Inap"
	}
	tglOnly := tanggal
	if len(tglOnly) >= 10 {
		tglOnly = tglOnly[:10]
	}

	payload := map[string]interface{}{
		"resourceType": "Composition",
		"identifier": map[string]interface{}{
			"system": "http://sys-ids.kemkes.go.id/composition/" + orgID,
			"value":  identifierValue,
		},
		"status": "final",
		"type": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": "http://loinc.org", "code": "18842-5", "display": "Discharge summary"},
			},
		},
		"category": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://loinc.org", "code": "LP173421-1", "display": "Report"},
			}},
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   d.NamaPasien,
		},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display":   fmt.Sprintf("Kunjungan %s pada tanggal %s dengan nomor kunjungan %s", d.NamaPasien, d.TglRegistrasiJamReg, noRawat),
		},
		"date": tglOnly,
		"author": []map[string]interface{}{
			{"reference": "Practitioner/" + ihsDokter, "display": d.NamaPetugas},
		},
		"title":     title,
		"custodian": map[string]interface{}{"reference": "Organization/" + orgID},
		"section": []map[string]interface{}{
			{
				"code": map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": "http://loinc.org", "code": "42344-2", "display": "Discharge diet (narrative)"},
					},
				},
				"text": map[string]interface{}{
					"status": "additional",
					"div":    cleanClinicalImpressionText(d.Instruksi),
				},
			},
		},
	}
	if id != "" {
		payload["id"] = id
	}
	return payload
}

type compositionRequestBody struct {
	Tanggal string `json:"tanggal"`
}

// POST /api/satu-sehat/composition/send/*no_rawat — body {"tanggal":"2026-08-06 00:00:00"}
func sendCompositionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body compositionRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.Tanggal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan tanggal wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchCompositionRowData(db, noRawat, body.Tanggal)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data catatan instruksi diet/gizi tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildCompositionPayload("", noRawat, body.Tanggal, d, ihsPasien, idEncounter, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Composition", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "composition", noRawat+"|"+body.Tanggal, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idComposition := satuSehatJSONStr(result["id"])
		if idComposition == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Composition tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_diet (no_rawat, tanggal, id_diet) VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE id_diet = VALUES(id_diet)
		`, noRawat, body.Tanggal, idComposition); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Composition terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "composition", noRawat+"|"+body.Tanggal)

		c.JSON(http.StatusOK, gin.H{"message": "Composition berhasil dikirim", "id_composition": idComposition})
	}
}

// POST /api/satu-sehat/composition/update/*no_rawat — body {"tanggal":"2026-08-06 00:00:00"}
func updateCompositionSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body compositionRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || body.Tanggal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan tanggal wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idComposition string
		err = db.QueryRow(`SELECT id_diet FROM satu_sehat_diet WHERE no_rawat = ? AND tanggal = ? AND id_diet != ''`, noRawat, body.Tanggal).Scan(&idComposition)
		if err != nil || idComposition == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Composition belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchCompositionRowData(db, noRawat, body.Tanggal)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data catatan instruksi diet/gizi tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildCompositionPayload(idComposition, noRawat, body.Tanggal, d, ihsPasien, idEncounter, ihsDokter, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Composition/"+idComposition, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "composition", noRawat+"|"+body.Tanggal, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "composition", noRawat+"|"+body.Tanggal)

		c.JSON(http.StatusOK, gin.H{"message": "Composition berhasil diupdate", "id_composition": idComposition})
	}
}

// ─── Immunization ───────────────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimVaksin.java. Sumber data: detail_pemberian_obat (sama
// tabel yg jadi sumber MedicationDispense), dipetakan lewat satu_sehat_mapping_vaksin
// (kode_brng -> vaksin/route/dose), aturan_pakai (dosis/no dipakai sbg
// doseNumberPositiveInt — hasil ekstrak angka dari teks bebas, bawaan Java,
// bukan field terstruktur "dosis ke berapa dalam seri imunisasi"), dan
// satu_sehat_mapping_lokasi_ralan+poliklinik utk lokasi pemberian. Hanya
// baris dgn no_batch terisi yg muncul (persis WHERE Java).
//
// Perbaikan dari Java: expirationDate diambil via Sequel.cariIsi() dgn STRING
// CONCATENATION SQL (celah injection, walau cuma baca data lokal) — di sini
// pakai parameterized query. doseNumberPositiveInt: Java strip semua char
// selain digit+titik dari `aturan` lalu masukkan APA ADANYA ke JSON (kalau
// `aturan` tidak mengandung digit sama sekali, hasilnya JSON tidak valid —
// "doseNumberPositiveInt" tanpa nilai). Di sini diekstrak angka pertama dgn
// regex, dan kalau tidak ketemu, dikembalikan error jelas alih-alih
// mengirim payload rusak.
type ImmunizationCandidateRow struct {
	TglRegistrasi  string `json:"tgl_registrasi"`
	NoRawat        string `json:"no_rawat"`
	NoRM           string `json:"no_rm"`
	NamaPasien     string `json:"nama_pasien"`
	NoKtpPasien    string `json:"no_ktp_pasien"`
	SttsRawat      string `json:"stts_rawat"`
	StatusLanjut   string `json:"status_lanjut"`
	IDEncounter    string `json:"id_encounter"`
	VaksinDisplay  string `json:"vaksin_display"`
	KodeBrng       string `json:"kode_brng"`
	NoBatch        string `json:"no_batch"`
	TglPerawatan   string `json:"tgl_perawatan"`
	Jam            string `json:"jam"`
	NamaDokter     string `json:"nama_dokter"`
	IDImmunization string `json:"id_immunization"`
	NoFaktur       string `json:"no_faktur"`
}

// GET /api/satu-sehat/immunization
func getImmunizationCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				reg_periksa.stts, reg_periksa.status_lanjut, satu_sehat_encounter.id_encounter,
				IFNULL(satu_sehat_mapping_vaksin.vaksin_display,''), satu_sehat_mapping_vaksin.kode_brng,
				detail_pemberian_obat.no_batch, IFNULL(detail_pemberian_obat.tgl_perawatan,''), detail_pemberian_obat.jam,
				IFNULL(pegawai.nama,''), IFNULL(satu_sehat_immunization.id_immunization,''), detail_pemberian_obat.no_faktur
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN detail_pemberian_obat ON detail_pemberian_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN satu_sehat_mapping_vaksin ON satu_sehat_mapping_vaksin.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN aturan_pakai ON aturan_pakai.tgl_perawatan = detail_pemberian_obat.tgl_perawatan AND aturan_pakai.jam = detail_pemberian_obat.jam
				AND aturan_pakai.no_rawat = detail_pemberian_obat.no_rawat AND aturan_pakai.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN satu_sehat_mapping_lokasi_ralan ON satu_sehat_mapping_lokasi_ralan.kd_poli = reg_periksa.kd_poli
			INNER JOIN poliklinik ON poliklinik.kd_poli = satu_sehat_mapping_lokasi_ralan.kd_poli
			INNER JOIN pegawai ON reg_periksa.kd_dokter = pegawai.nik
			LEFT JOIN satu_sehat_immunization ON satu_sehat_immunization.no_rawat = detail_pemberian_obat.no_rawat
				AND satu_sehat_immunization.tgl_perawatan = detail_pemberian_obat.tgl_perawatan
				AND satu_sehat_immunization.jam = detail_pemberian_obat.jam
				AND satu_sehat_immunization.kode_brng = detail_pemberian_obat.kode_brng
				AND satu_sehat_immunization.no_batch = detail_pemberian_obat.no_batch
				AND satu_sehat_immunization.no_faktur = detail_pemberian_obat.no_faktur
			WHERE detail_pemberian_obat.no_batch <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR satu_sehat_mapping_vaksin.kode_brng LIKE ? OR satu_sehat_mapping_vaksin.vaksin_display LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY detail_pemberian_obat.tgl_perawatan DESC, detail_pemberian_obat.jam DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []ImmunizationCandidateRow{}
		for rows.Next() {
			var r ImmunizationCandidateRow
			if err := rows.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.SttsRawat, &r.StatusLanjut, &r.IDEncounter, &r.VaksinDisplay, &r.KodeBrng,
				&r.NoBatch, &r.TglPerawatan, &r.Jam, &r.NamaDokter, &r.IDImmunization, &r.NoFaktur); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type immunizationRowData struct {
	NoRkmMedis     string
	NikPasien      string
	KdDokter       string
	NikDokter      string
	NamaDokter     string
	IDLokasi       string
	NamaPoli       string
	VaksinCode     string
	VaksinSystem   string
	VaksinDisplay  string
	RouteCode      string
	RouteSystem    string
	RouteDisplay   string
	DoseCode       string
	DoseSystem     string
	DoseUnit       string
	Jml            float64
	Aturan         string
	ExpirationDate string
}

func fetchImmunizationRowData(db *sql.DB, noRawat, tglPerawatan, jam, kodeBrng, noBatch, noFaktur string) (immunizationRowData, error) {
	var d immunizationRowData
	err := db.QueryRow(`
		SELECT
			reg_periksa.no_rkm_medis, IFNULL(pasien.no_ktp,''),
			reg_periksa.kd_dokter, IFNULL(pegawai.no_ktp,''), IFNULL(pegawai.nama,''),
			satu_sehat_mapping_lokasi_ralan.id_lokasi_satusehat, poliklinik.nm_poli,
			IFNULL(satu_sehat_mapping_vaksin.vaksin_code,''), satu_sehat_mapping_vaksin.vaksin_system, IFNULL(satu_sehat_mapping_vaksin.vaksin_display,''),
			IFNULL(satu_sehat_mapping_vaksin.route_code,''), IFNULL(satu_sehat_mapping_vaksin.route_system,''), IFNULL(satu_sehat_mapping_vaksin.route_display,''),
			IFNULL(satu_sehat_mapping_vaksin.dose_quantity_code,''), IFNULL(satu_sehat_mapping_vaksin.dose_quantity_system,''), IFNULL(satu_sehat_mapping_vaksin.dose_quantity_unit,''),
			detail_pemberian_obat.jml, IFNULL(aturan_pakai.aturan,'')
		FROM detail_pemberian_obat
		INNER JOIN reg_periksa ON reg_periksa.no_rawat = detail_pemberian_obat.no_rawat
		INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
		INNER JOIN pegawai ON pegawai.nik = reg_periksa.kd_dokter
		INNER JOIN satu_sehat_mapping_vaksin ON satu_sehat_mapping_vaksin.kode_brng = detail_pemberian_obat.kode_brng
		INNER JOIN satu_sehat_mapping_lokasi_ralan ON satu_sehat_mapping_lokasi_ralan.kd_poli = reg_periksa.kd_poli
		INNER JOIN poliklinik ON poliklinik.kd_poli = satu_sehat_mapping_lokasi_ralan.kd_poli
		LEFT JOIN aturan_pakai ON aturan_pakai.tgl_perawatan = detail_pemberian_obat.tgl_perawatan AND aturan_pakai.jam = detail_pemberian_obat.jam
			AND aturan_pakai.no_rawat = detail_pemberian_obat.no_rawat AND aturan_pakai.kode_brng = detail_pemberian_obat.kode_brng
		WHERE detail_pemberian_obat.no_rawat = ? AND detail_pemberian_obat.tgl_perawatan = ? AND detail_pemberian_obat.jam = ?
			AND detail_pemberian_obat.kode_brng = ? AND detail_pemberian_obat.no_batch = ? AND detail_pemberian_obat.no_faktur = ?
		LIMIT 1
	`, noRawat, tglPerawatan, jam, kodeBrng, noBatch, noFaktur).Scan(
		&d.NoRkmMedis, &d.NikPasien, &d.KdDokter, &d.NikDokter, &d.NamaDokter,
		&d.IDLokasi, &d.NamaPoli,
		&d.VaksinCode, &d.VaksinSystem, &d.VaksinDisplay,
		&d.RouteCode, &d.RouteSystem, &d.RouteDisplay,
		&d.DoseCode, &d.DoseSystem, &d.DoseUnit,
		&d.Jml, &d.Aturan,
	)
	if err != nil {
		return d, err
	}
	db.QueryRow(`SELECT tgl_kadaluarsa FROM data_batch WHERE no_batch = ? AND kode_brng = ? AND no_faktur = ?`,
		noBatch, kodeBrng, noFaktur).Scan(&d.ExpirationDate)
	return d, nil
}

var immunizationDoseNumberPattern = regexp.MustCompile(`[0-9]+`)

func buildImmunizationPayload(id, noRawat, tglPerawatan, jam, noBatch string, d immunizationRowData, ihsPasien, idEncounter, ihsDokter string) (map[string]interface{}, error) {
	doseNumberStr := immunizationDoseNumberPattern.FindString(d.Aturan)
	if doseNumberStr == "" {
		return nil, fmt.Errorf("Tidak bisa menentukan nomor dosis dari aturan pakai '%s' — perlu format yang mengandung angka", d.Aturan)
	}
	doseNumber, err := strconv.Atoi(doseNumberStr)
	if err != nil || doseNumber <= 0 {
		return nil, fmt.Errorf("Nomor dosis hasil ekstrak dari aturan pakai '%s' tidak valid", d.Aturan)
	}

	occurrenceDateTime := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglPerawatan), jam)

	payload := map[string]interface{}{
		"resourceType": "Immunization",
		"status":       "completed",
		"vaccineCode": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": d.VaksinSystem, "code": d.VaksinCode, "display": d.VaksinDisplay},
			},
		},
		"patient":            map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"encounter":          map[string]interface{}{"reference": "Encounter/" + idEncounter},
		"occurrenceDateTime": occurrenceDateTime,
		"expirationDate":     d.ExpirationDate,
		"recorded":           occurrenceDateTime,
		"primarySource":      true,
		"location": map[string]interface{}{
			"reference": "Location/" + d.IDLokasi,
			"display":   d.NamaPoli,
		},
		"lotNumber": noBatch,
		"route": map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": d.RouteSystem, "code": d.RouteCode, "display": d.RouteDisplay},
			},
		},
		"doseQuantity": map[string]interface{}{
			"value":  d.Jml,
			"unit":   d.DoseUnit,
			"system": d.DoseSystem,
			"code":   d.DoseCode,
		},
		"performer": []map[string]interface{}{
			{
				"function": map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": "http://terminology.hl7.org/CodeSystem/v2-0443", "code": "AP", "display": "Administering Provider"},
					},
				},
				"actor": map[string]interface{}{"reference": "Practitioner/" + ihsDokter},
			},
		},
		"reasonCode": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.kemkes.go.id/CodeSystem/immunization-reason", "code": "IM-Program", "display": "Imunisasi Program"},
			}},
		},
		"protocolApplied": []map[string]interface{}{
			{"doseNumberPositiveInt": doseNumber},
		},
	}
	if id != "" {
		payload["id"] = id
	}
	return payload, nil
}

type immunizationRequestBody struct {
	TglPerawatan string `json:"tgl_perawatan"`
	Jam          string `json:"jam"`
	KodeBrng     string `json:"kode_brng"`
	NoBatch      string `json:"no_batch"`
	NoFaktur     string `json:"no_faktur"`
}

func (b immunizationRequestBody) valid() bool {
	return b.TglPerawatan != "" && b.Jam != "" && b.KodeBrng != "" && b.NoBatch != "" && b.NoFaktur != ""
}

// POST /api/satu-sehat/immunization/send/*no_rawat
func sendImmunizationSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body immunizationRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam, kode_brng, no_batch, dan no_faktur wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchImmunizationRowData(db, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemberian vaksin tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.KdDokter, d.NikDokter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number dokter: " + err.Error()})
			return
		}

		payload, err := buildImmunizationPayload("", noRawat, body.TglPerawatan, body.Jam, body.NoBatch, d, ihsPasien, idEncounter, ihsDokter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/Immunization", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "immunization", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idImmunization := satuSehatJSONStr(result["id"])
		if idImmunization == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID Immunization tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_immunization (no_rawat, tgl_perawatan, jam, kode_brng, no_batch, no_faktur, id_immunization)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_immunization = VALUES(id_immunization)
		`, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur, idImmunization); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Immunization terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "immunization", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur)

		c.JSON(http.StatusOK, gin.H{"message": "Immunization berhasil dikirim", "id_immunization": idImmunization})
	}
}

// POST /api/satu-sehat/immunization/update/*no_rawat
func updateImmunizationSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body immunizationRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam, kode_brng, no_batch, dan no_faktur wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idImmunization string
		err = db.QueryRow(`
			SELECT id_immunization FROM satu_sehat_immunization
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam = ? AND kode_brng = ? AND no_batch = ? AND no_faktur = ? AND id_immunization != ''
		`, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur).Scan(&idImmunization)
		if err != nil || idImmunization == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Immunization belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchImmunizationRowData(db, noRawat, body.TglPerawatan, body.Jam, body.KodeBrng, body.NoBatch, body.NoFaktur)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pemberian vaksin tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsDokter, err := resolveIHSDokter(db, cfg.FhirURL, token, d.KdDokter, d.NikDokter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number dokter: " + err.Error()})
			return
		}

		payload, err := buildImmunizationPayload(idImmunization, noRawat, body.TglPerawatan, body.Jam, body.NoBatch, d, ihsPasien, idEncounter, ihsDokter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/Immunization/"+idImmunization, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "immunization", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "immunization", noRawat+"|"+body.TglPerawatan+"|"+body.Jam+"|"+body.KodeBrng+"|"+body.NoBatch+"|"+body.NoFaktur)

		c.JSON(http.StatusOK, gin.H{"message": "Immunization berhasil diupdate", "id_immunization": idImmunization})
	}
}

// ─── QuestionnaireResponse Telaah Farmasi ──────────────────────────────────────
//
// Padanan SatuSehatKirimQRTelaahFarmasi.java. Sumber: telaah_farmasi (form
// telaah resep + telaah obat sblm penyerahan, diisi apoteker), keyed murni
// no_resep (tanpa Ralan/Ranap split, tanpa tgl_perawatan/jam — beda dari
// resource lain). "author"/petugas telaah = telaah_farmasi.nip (APOTEKER yg
// menelaah), BUKAN dokter peresep. Tidak ada field "questionnaire" (URL
// canonical form) di Java — tidak saya tambahkan krn tidak py referensi resmi
// utk itu, konsisten dgn prinsip tidak mengarang data.
type qrTelaahFarmasiData struct {
	TglRegistrasi string `json:"tgl_registrasi"`
	NoRawat       string `json:"no_rawat"`
	NoRM          string `json:"no_rm"`
	NamaPasien    string `json:"nama_pasien"`
	NikPasien     string `json:"no_ktp_pasien"`
	NamaPetugas   string `json:"nama_petugas"`
	NikPetugas    string `json:"no_ktp_petugas"`
	NipPetugas    string `json:"-"`
	IDEncounter   string `json:"id_encounter"`
	TglPeresepan  string `json:"tgl_peresepan"`
	JamPeresepan  string `json:"jam_peresepan"`
	NoResep       string `json:"no_resep"`
	IDQR          string `json:"id_questionresponse"`

	RespIdentifikasiPasien     string `json:"resep_identifikasi_pasien"`
	RespKetIdentifikasiPasien  string `json:"resep_ket_identifikasi_pasien"`
	RespTepatObat              string `json:"resep_tepat_obat"`
	RespKetTepatObat           string `json:"resep_ket_tepat_obat"`
	RespTepatDosis             string `json:"resep_tepat_dosis"`
	RespKetTepatDosis          string `json:"resep_ket_tepat_dosis"`
	RespTepatCaraPemberian     string `json:"resep_tepat_cara_pemberian"`
	RespKetTepatCaraPemberian  string `json:"resep_ket_tepat_cara_pemberian"`
	RespTepatWaktuPemberian    string `json:"resep_tepat_waktu_pemberian"`
	RespKetTepatWaktuPemberian string `json:"resep_ket_tepat_waktu_pemberian"`
	RespDuplikasiObat          string `json:"resep_ada_tidak_duplikasi_obat"`
	RespKetDuplikasiObat       string `json:"resep_ket_ada_tidak_duplikasi_obat"`
	RespInteraksiObat          string `json:"resep_interaksi_obat"`
	RespKetInteraksiObat       string `json:"resep_ket_interaksi_obat"`
	RespKontraIndikasiObat     string `json:"resep_kontra_indikasi_obat"`
	RespKetKontraIndikasiObat  string `json:"resep_ket_kontra_indikasi_obat"`
	ObatTepatPasien            string `json:"obat_tepat_pasien"`
	ObatTepatObat              string `json:"obat_tepat_obat"`
	ObatTepatDosis             string `json:"obat_tepat_dosis"`
	ObatTepatCaraPemberian     string `json:"obat_tepat_cara_pemberian"`
	ObatTepatWaktuPemberian    string `json:"obat_tepat_waktu_pemberian"`
}

const qrTelaahFarmasiSelectCols = `
	IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
	IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''), telaah_farmasi.nip,
	satu_sehat_encounter.id_encounter, IFNULL(resep_obat.tgl_peresepan,''), IFNULL(resep_obat.jam_peresepan,'00:00:00'),
	resep_obat.no_resep, IFNULL(satu_sehat_questionresponse_telaah_farmasi.id_questionresponse,''),
	IFNULL(telaah_farmasi.resep_identifikasi_pasien,''), IFNULL(telaah_farmasi.resep_ket_identifikasi_pasien,''),
	IFNULL(telaah_farmasi.resep_tepat_obat,''), IFNULL(telaah_farmasi.resep_ket_tepat_obat,''),
	IFNULL(telaah_farmasi.resep_tepat_dosis,''), IFNULL(telaah_farmasi.resep_ket_tepat_dosis,''),
	IFNULL(telaah_farmasi.resep_tepat_cara_pemberian,''), IFNULL(telaah_farmasi.resep_ket_tepat_cara_pemberian,''),
	IFNULL(telaah_farmasi.resep_tepat_waktu_pemberian,''), IFNULL(telaah_farmasi.resep_ket_tepat_waktu_pemberian,''),
	IFNULL(telaah_farmasi.resep_ada_tidak_duplikasi_obat,''), IFNULL(telaah_farmasi.resep_ket_ada_tidak_duplikasi_obat,''),
	IFNULL(telaah_farmasi.resep_interaksi_obat,''), IFNULL(telaah_farmasi.resep_ket_interaksi_obat,''),
	IFNULL(telaah_farmasi.resep_kontra_indikasi_obat,''), IFNULL(telaah_farmasi.resep_ket_kontra_indikasi_obat,''),
	IFNULL(telaah_farmasi.obat_tepat_pasien,''), IFNULL(telaah_farmasi.obat_tepat_obat,''),
	IFNULL(telaah_farmasi.obat_tepat_dosis,''), IFNULL(telaah_farmasi.obat_tepat_cara_pemberian,''),
	IFNULL(telaah_farmasi.obat_tepat_waktu_pemberian,'')
`

const qrTelaahFarmasiJoins = `
	FROM reg_periksa
	INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
	INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
	INNER JOIN telaah_farmasi ON telaah_farmasi.no_resep = resep_obat.no_resep
	INNER JOIN pegawai ON telaah_farmasi.nip = pegawai.nik
	INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
	LEFT JOIN satu_sehat_questionresponse_telaah_farmasi ON satu_sehat_questionresponse_telaah_farmasi.no_resep = resep_obat.no_resep
`

func scanQRTelaahFarmasi(rows *sql.Rows) (qrTelaahFarmasiData, error) {
	var d qrTelaahFarmasiData
	err := rows.Scan(
		&d.TglRegistrasi, &d.NoRawat, &d.NoRM, &d.NamaPasien, &d.NikPasien,
		&d.NamaPetugas, &d.NikPetugas, &d.NipPetugas,
		&d.IDEncounter, &d.TglPeresepan, &d.JamPeresepan,
		&d.NoResep, &d.IDQR,
		&d.RespIdentifikasiPasien, &d.RespKetIdentifikasiPasien,
		&d.RespTepatObat, &d.RespKetTepatObat,
		&d.RespTepatDosis, &d.RespKetTepatDosis,
		&d.RespTepatCaraPemberian, &d.RespKetTepatCaraPemberian,
		&d.RespTepatWaktuPemberian, &d.RespKetTepatWaktuPemberian,
		&d.RespDuplikasiObat, &d.RespKetDuplikasiObat,
		&d.RespInteraksiObat, &d.RespKetInteraksiObat,
		&d.RespKontraIndikasiObat, &d.RespKetKontraIndikasiObat,
		&d.ObatTepatPasien, &d.ObatTepatObat,
		&d.ObatTepatDosis, &d.ObatTepatCaraPemberian, &d.ObatTepatWaktuPemberian,
	)
	return d, err
}

// GET /api/satu-sehat/qr-telaah-farmasi
func getQRTelaahFarmasiCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		query := "SELECT " + qrTelaahFarmasiSelectCols + qrTelaahFarmasiJoins + `
			WHERE resep_obat.tgl_peresepan BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR resep_obat.no_resep LIKE ? OR pegawai.no_ktp LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 6; i++ {
				args = append(args, kw)
			}
		}
		query += " ORDER BY resep_obat.tgl_peresepan DESC, resep_obat.no_resep DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []qrTelaahFarmasiData{}
		for rows.Next() {
			d, err := scanQRTelaahFarmasi(rows)
			if err != nil {
				continue
			}
			list = append(list, d)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

func fetchQRTelaahFarmasiData(db *sql.DB, noResep string) (qrTelaahFarmasiData, error) {
	query := "SELECT " + qrTelaahFarmasiSelectCols + qrTelaahFarmasiJoins + `
		WHERE resep_obat.no_resep = ?
		LIMIT 1
	`
	rows, err := db.Query(query, noResep)
	if err != nil {
		return qrTelaahFarmasiData{}, err
	}
	defer rows.Close()
	if !rows.Next() {
		return qrTelaahFarmasiData{}, sql.ErrNoRows
	}
	return scanQRTelaahFarmasi(rows)
}

func qrItem(linkID, text, value string) map[string]interface{} {
	return map[string]interface{}{
		"linkId": linkID,
		"text":   text,
		"answer": []map[string]interface{}{{"valueString": value}},
	}
}

func buildQRTelaahFarmasiPayload(id string, d qrTelaahFarmasiData, ihsPasien, ihsPetugas string) map[string]interface{} {
	authored := fmt.Sprintf("%sT%s+07:00", sqlDateOnly(d.TglPeresepan), d.JamPeresepan)
	payload := map[string]interface{}{
		"resourceType": "QuestionnaireResponse",
		"status":       "completed",
		"authored":     authored,
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   d.NamaPasien,
		},
		"source":    map[string]interface{}{"reference": "Patient/" + ihsPasien},
		"encounter": map[string]interface{}{"reference": "Encounter/" + d.IDEncounter},
		"author": map[string]interface{}{
			"reference": "Practitioner/" + ihsPetugas,
			"display":   d.NamaPetugas,
		},
		"item": []map[string]interface{}{
			{
				"linkId": "identitas",
				"text":   "Identitas",
				"item": []map[string]interface{}{
					qrItem("no-rawat", "No. Rawat", d.NoRawat),
					qrItem("no-rm", "No. RM", d.NoRM),
					qrItem("no-resep", "No. Resep", d.NoResep),
				},
			},
			{
				"linkId": "telaah-resep",
				"text":   "Telaah Resep",
				"item": []map[string]interface{}{
					qrItem("tr-1-tepat-identifikasi-pasien", "1. Tepat Identifikasi Pasien", d.RespIdentifikasiPasien),
					qrItem("tr-1-tepat-identifikasi-pasien-ket", "Keterangan", d.RespKetIdentifikasiPasien),
					qrItem("tr-2-tepat-obat", "2. Tepat Obat", d.RespTepatObat),
					qrItem("tr-2-tepat-obat-ket", "Keterangan", d.RespKetTepatObat),
					qrItem("tr-3-tepat-dosis", "3. Tepat Dosis", d.RespTepatDosis),
					qrItem("tr-3-tepat-dosis-ket", "Keterangan", d.RespKetTepatDosis),
					qrItem("tr-4-tepat-cara-pemberian", "4. Tepat Cara Pemberian", d.RespTepatCaraPemberian),
					qrItem("tr-4-tepat-cara-pemberian-ket", "Keterangan", d.RespKetTepatCaraPemberian),
					qrItem("tr-5-tepat-waktu-pemberian", "5. Tepat Waktu Pemberian", d.RespTepatWaktuPemberian),
					qrItem("tr-5-tepat-waktu-pemberian-ket", "Keterangan", d.RespKetTepatWaktuPemberian),
					qrItem("tr-6-duplikasi-obat", "6. Ada Tidak Duplikasi Obat", d.RespDuplikasiObat),
					qrItem("tr-6-duplikasi-obat-ket", "Keterangan", d.RespKetDuplikasiObat),
					qrItem("tr-7-interaksi-obat", "7. Interaksi Obat", d.RespInteraksiObat),
					qrItem("tr-7-interaksi-obat-ket", "Keterangan", d.RespKetInteraksiObat),
					qrItem("tr-8-kontra-indikasi-obat", "8. Kontra Indikasi Obat", d.RespKontraIndikasiObat),
					qrItem("tr-8-kontra-indikasi-obat-ket", "Keterangan", d.RespKetKontraIndikasiObat),
				},
			},
			{
				"linkId": "telaah-obat",
				"text":   "Telaah Obat",
				"item": []map[string]interface{}{
					qrItem("to-1-tepat-pasien", "1. Tepat Pasien", d.ObatTepatPasien),
					qrItem("to-2-tepat-obat", "2. Tepat Obat", d.ObatTepatObat),
					qrItem("to-3-tepat-dosis", "3. Tepat Dosis", d.ObatTepatDosis),
					qrItem("to-4-tepat-cara-pemberian", "4. Tepat Cara Pemberian", d.ObatTepatCaraPemberian),
					qrItem("to-5-tepat-waktu-pemberian", "5. Tepat Waktu Pemberian", d.ObatTepatWaktuPemberian),
				},
			},
		},
	}
	if id != "" {
		payload["id"] = id
	}
	return payload
}

// POST /api/satu-sehat/qr-telaah-farmasi/send/:no_resep
func sendQRTelaahFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		if noResep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		d, err := fetchQRTelaahFarmasiData(db, noResep)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data telaah farmasi tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRM, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPetugas, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildQRTelaahFarmasiPayload("", d, ihsPasien, ihsPetugas)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/QuestionnaireResponse", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "questionnaire_response", noResep, d.NoRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idQR := satuSehatJSONStr(result["id"])
		if idQR == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID QuestionnaireResponse tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_questionresponse_telaah_farmasi (no_resep, id_questionresponse) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE id_questionresponse = VALUES(id_questionresponse)
		`, noResep, idQR); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "QuestionnaireResponse terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "questionnaire_response", noResep)

		c.JSON(http.StatusOK, gin.H{"message": "QuestionnaireResponse berhasil dikirim", "id_questionresponse": idQR})
	}
}

// POST /api/satu-sehat/qr-telaah-farmasi/update/:no_resep
func updateQRTelaahFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		if noResep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idQR string
		err = db.QueryRow(`SELECT id_questionresponse FROM satu_sehat_questionresponse_telaah_farmasi WHERE no_resep = ? AND id_questionresponse != ''`, noResep).Scan(&idQR)
		if err != nil || idQR == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "QuestionnaireResponse belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		d, err := fetchQRTelaahFarmasiData(db, noResep)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data telaah farmasi tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRM, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPetugas, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildQRTelaahFarmasiPayload(idQR, d, ihsPasien, ihsPetugas)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/QuestionnaireResponse/"+idQR, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "questionnaire_response", noResep, d.NoRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "questionnaire_response", noResep)

		c.JSON(http.StatusOK, gin.H{"message": "QuestionnaireResponse berhasil diupdate", "id_questionresponse": idQR})
	}
}

// ─── CarePlan ───────────────────────────────────────────────────────────────────
//
// Padanan SatuSehatKirimCarePlan.java. Sumber: pemeriksaan_ralan.rtl /
// pemeriksaan_ranap.rtl (Rencana Tindak Lanjut), pola Ralan/Ranap 2-cabang
// sama seperti ClinicalImpression — kali ini TANPA bug copy-paste label
// (Java benar menulis literal "Ranap" utk cabang Ranap).
//
// Catatan: CarePlan.identifier di FHIR juga OBJECT TUNGGAL (spt Composition),
// dan Java isi value-nya CUMA no_rawat (tanpa tanggal/jam) — artinya kalau
// satu kunjungan py >1 entri rencana perawatan di waktu berbeda, semuanya
// berbagi identifier yg sama. Direplikasi apa adanya, bukan saya ubah.
type CarePlanCandidateRow struct {
	TglRegistrasiJamReg string `json:"tgl_registrasi_jam_reg"`
	TglRegistrasi       string `json:"tgl_registrasi"`
	NoRawat             string `json:"no_rawat"`
	NoRM                string `json:"no_rm"`
	NamaPasien          string `json:"nama_pasien"`
	NoKtpPasien         string `json:"no_ktp_pasien"`
	IDEncounter         string `json:"id_encounter"`
	Rtl                 string `json:"rtl"`
	NamaPetugas         string `json:"nama_petugas"`
	NoKtpPetugas        string `json:"no_ktp_petugas"`
	TglPerawatan        string `json:"tgl_perawatan"`
	JamRawat            string `json:"jam_rawat"`
	IDCarePlan          string `json:"id_careplan"`
	Status              string `json:"status"`
}

// GET /api/satu-sehat/careplan
func getCarePlanCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))

		branchQuery := func(pemeriksaanTable, status string) (string, []interface{}) {
			q := fmt.Sprintf(`
				SELECT
					CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg), IFNULL(reg_periksa.tgl_registrasi,''),
					reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
					satu_sehat_encounter.id_encounter, pe.rtl, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
					IFNULL(pe.tgl_perawatan,''), pe.jam_rawat, IFNULL(sc.id_careplan,'')
				FROM reg_periksa
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
				INNER JOIN %s pe ON pe.no_rawat = reg_periksa.no_rawat
				INNER JOIN pegawai ON pe.nip = pegawai.nik
				LEFT JOIN satu_sehat_careplan sc ON sc.no_rawat = pe.no_rawat
					AND sc.tgl_perawatan = pe.tgl_perawatan AND sc.jam_rawat = pe.jam_rawat AND sc.status = ?
				WHERE pe.rtl <> '' AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
			`, pemeriksaanTable)
			args := []interface{}{status, tglDari, tglSampai}
			if keyword != "" {
				q += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR pegawai.no_ktp LIKE ? OR pegawai.nama LIKE ?)`
				kw := "%" + keyword + "%"
				for i := 0; i < 6; i++ {
					args = append(args, kw)
				}
			}
			return q, args
		}

		list := []CarePlanCandidateRow{}
		branches := []struct{ table, status string }{
			{"pemeriksaan_ralan", "Ralan"},
			{"pemeriksaan_ranap", "Ranap"},
		}
		for _, b := range branches {
			q, args := branchQuery(b.table, b.status)
			rows, err := db.Query(q, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for rows.Next() {
				var r CarePlanCandidateRow
				if err := rows.Scan(&r.TglRegistrasiJamReg, &r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
					&r.IDEncounter, &r.Rtl, &r.NamaPetugas, &r.NoKtpPetugas,
					&r.TglPerawatan, &r.JamRawat, &r.IDCarePlan); err != nil {
					continue
				}
				r.Status = b.status
				list = append(list, r)
			}
			rows.Close()
		}

		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type carePlanRowData struct {
	NoRkmMedis          string
	NamaPasien          string
	NikPasien           string
	NipPetugas          string
	NikPetugas          string
	NamaPetugas         string
	Rtl                 string
	TglRegistrasiJamReg string
}

func fetchCarePlanRowData(db *sql.DB, noRawat, tglPerawatan, jamRawat, status string) (carePlanRowData, error) {
	var d carePlanRowData
	pemeriksaanTable := "pemeriksaan_ralan"
	if status == "Ranap" {
		pemeriksaanTable = "pemeriksaan_ranap"
	}
	query := fmt.Sprintf(`
		SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
			pe.nip, IFNULL(pegawai.no_ktp,''), IFNULL(pegawai.nama,''), pe.rtl,
			CONCAT(reg_periksa.tgl_registrasi,' ',reg_periksa.jam_reg)
		FROM %s pe
		INNER JOIN reg_periksa ON reg_periksa.no_rawat = pe.no_rawat
		INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
		INNER JOIN pegawai ON pegawai.nik = pe.nip
		WHERE pe.no_rawat = ? AND pe.tgl_perawatan = ? AND pe.jam_rawat = ?
		LIMIT 1
	`, pemeriksaanTable)
	err := db.QueryRow(query, noRawat, tglPerawatan, jamRawat).Scan(
		&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien,
		&d.NipPetugas, &d.NikPetugas, &d.NamaPetugas, &d.Rtl,
		&d.TglRegistrasiJamReg,
	)
	return d, err
}

func buildCarePlanPayload(id, noRawat, tglPerawatan, jamRawat, status string, d carePlanRowData, ihsPasien, idEncounter, ihsPraktisi, orgID string) map[string]interface{} {
	category := map[string]interface{}{
		"coding": []map[string]interface{}{
			{"system": "http://snomed.info/sct", "code": "736271009", "display": "Outpatient care plan"},
		},
	}
	if status == "Ranap" {
		category = map[string]interface{}{
			"coding": []map[string]interface{}{
				{"system": "http://snomed.info/sct", "code": "736353004", "display": "Inpatient care plan"},
			},
		}
	}

	payload := map[string]interface{}{
		"resourceType": "CarePlan",
		"identifier": map[string]interface{}{
			"system": "http://sys-ids.kemkes.go.id/careplan/" + orgID,
			"value":  noRawat,
		},
		"title":       "Instruksi Medik dan Keperawatan Pasien",
		"status":      "active",
		"category":    []map[string]interface{}{category},
		"intent":      "plan",
		"description": cleanClinicalImpressionText(d.Rtl),
		"subject": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   d.NamaPasien,
		},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + idEncounter,
			"display":   fmt.Sprintf("Kunjungan %s pada tanggal %s dengan nomor kunjungan %s", d.NamaPasien, d.TglRegistrasiJamReg, noRawat),
		},
		"created": fmt.Sprintf("%sT%s+07:00", sqlDateOnly(tglPerawatan), jamRawat),
		"author": map[string]interface{}{
			"reference": "Practitioner/" + ihsPraktisi,
			"display":   d.NamaPetugas,
		},
	}
	if id != "" {
		payload["id"] = id
	}
	return payload
}

type carePlanRequestBody struct {
	TglPerawatan string `json:"tgl_perawatan"`
	JamRawat     string `json:"jam_rawat"`
	Status       string `json:"status"`
}

func (b carePlanRequestBody) valid() bool {
	return b.TglPerawatan != "" && b.JamRawat != "" && (b.Status == "Ralan" || b.Status == "Ranap")
}

// POST /api/satu-sehat/careplan/send/*no_rawat
func sendCarePlanSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body carePlanRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam_rawat, dan status wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchCarePlanRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.Status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data rencana perawatan tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPraktisi, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildCarePlanPayload("", noRawat, body.TglPerawatan, body.JamRawat, body.Status, d, ihsPasien, idEncounter, ihsPraktisi, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/CarePlan", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "careplan", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idCarePlan := satuSehatJSONStr(result["id"])
		if idCarePlan == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID CarePlan tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_careplan (no_rawat, tgl_perawatan, jam_rawat, status, id_careplan)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_careplan = VALUES(id_careplan)
		`, noRawat, body.TglPerawatan, body.JamRawat, body.Status, idCarePlan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "CarePlan terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "careplan", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "CarePlan berhasil dikirim", "id_careplan": idCarePlan})
	}
}

// POST /api/satu-sehat/careplan/update/*no_rawat
func updateCarePlanSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body carePlanRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, tgl_perawatan, jam_rawat, dan status wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idCarePlan string
		err = db.QueryRow(`
			SELECT id_careplan FROM satu_sehat_careplan
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND status = ? AND id_careplan != ''
		`, noRawat, body.TglPerawatan, body.JamRawat, body.Status).Scan(&idCarePlan)
		if err != nil || idCarePlan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "CarePlan belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		idEncounter, err := getIDEncounterByNoRawat(db, noRawat)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		d, err := fetchCarePlanRowData(db, noRawat, body.TglPerawatan, body.JamRawat, body.Status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data rencana perawatan tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}
		ihsPraktisi, err := resolveIHSDokter(db, cfg.FhirURL, token, d.NipPetugas, d.NikPetugas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number petugas: " + err.Error()})
			return
		}

		payload := buildCarePlanPayload(idCarePlan, noRawat, body.TglPerawatan, body.JamRawat, body.Status, d, ihsPasien, idEncounter, ihsPraktisi, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/CarePlan/"+idCarePlan, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "careplan", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "careplan", noRawat+"|"+body.TglPerawatan+"|"+body.JamRawat+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "CarePlan berhasil diupdate", "id_careplan": idCarePlan})
	}
}

// ─── EpisodeOfCare ──────────────────────────────────────────────────────────────
//
// TIDAK ADA padanan Java Khanza (belum pernah dibangun oleh Khanza). Dibangun
// dari draft tampil() yg diberikan user (mengganti nama tabel tracking
// "satu_sehat_episode_of_care" -> "satu_sehat_episodeofcare" yg memang sudah
// ada di skema, dan melengkapi kolomnya) + payload disusun sendiri dari
// contoh resmi Kemenkes utk resourceType EpisodeOfCare.
//
// Sumber: diagnosa_pasien difilter kd_penyakit LIKE '%O%' (bab ICD-10 "O" =
// Pregnancy, childbirth and the puerperium) — jadi fitur ini scope-nya
// EPISODE KEHAMILAN/PERSALINAN, bukan EpisodeOfCare generik (Khanza tidak
// punya modul "program" lain yg terstruktur, spt TB, HIV, dst yg bisa
// dipakai sbg sumber data serupa). Ralan pakai pemeriksaan_ralan (tgl_perawatan
// +jam_rawat sbg akhir period), Ranap pakai kamar_inap (tgl_keluar+jam_keluar).
// Wajib Condition (diagnosa) utk kd_penyakit itu SUDAH terkirim, krn
// "diagnosis.condition" butuh id_condition asli.
//
// 2 hal yg SENGAJA saya putuskan sendiri (tidak ada referensi resmi/Java):
//  1. "type" (kode program spt "TB-SO" di contoh resmi) — DILEWATI. Tidak ada
//     kode resmi utk "program kehamilan" yg saya pegang, drpd menebak kode yg
//     mungkin salah, field opsional ini saya kosongkan.
//  2. "statusHistory" — DILEWATI, dan "status" selalu "finished" (bukan
//     transisi active->finished spt contoh resmi) krn kita kirim data
//     retrospektif dari kunjungan yg sudah terjadi, tidak py data status
//     historis multi-tahap yg jujur utk direpresentasikan.
type EpisodeOfCareCandidateRow struct {
	TglRegistrasi   string `json:"tgl_registrasi"`
	NoRawat         string `json:"no_rawat"`
	NoRM            string `json:"no_rm"`
	NamaPasien      string `json:"nama_pasien"`
	NoKtpPasien     string `json:"no_ktp_pasien"`
	SttsRawat       string `json:"stts_rawat"`
	SttsLanjut      string `json:"stts_lanjut"`
	TanggalPulang   string `json:"tanggal_pulang"`
	IDEncounter     string `json:"id_encounter"`
	KdPenyakit      string `json:"kd_penyakit"`
	NamaPenyakit    string `json:"nama_penyakit"`
	IDEpisodeOfCare string `json:"id_episodeofcare"`
	Status          string `json:"status"`
}

// GET /api/satu-sehat/episode-of-care
func getEpisodeOfCareCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := strings.TrimSpace(c.Query("tgl_dari"))
		tglSampai := strings.TrimSpace(c.Query("tgl_sampai"))
		if tglDari == "" || tglSampai == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal dari dan sampai wajib diisi"})
			return
		}
		keyword := strings.TrimSpace(c.Query("q"))
		statusFilter := c.Query("status") // "terkirim" | "belum" | ""

		list := []EpisodeOfCareCandidateRow{}

		// Ralan: tgl_perawatan pemeriksaan_ralan dipakai sbg rentang & akhir period.
		queryRalan := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				reg_periksa.stts, reg_periksa.status_lanjut,
				CONCAT(pemeriksaan_ralan.tgl_perawatan,'T',pemeriksaan_ralan.jam_rawat,'+07:00') as pulang,
				satu_sehat_encounter.id_encounter, diagnosa_pasien.kd_penyakit, IFNULL(penyakit.nm_penyakit,''),
				IFNULL(satu_sehat_episodeofcare.id_episodeofcare,'') as id_episodeofcare
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN pemeriksaan_ralan ON pemeriksaan_ralan.no_rawat = reg_periksa.no_rawat
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat AND diagnosa_pasien.status = 'Ralan'
			INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
			LEFT JOIN satu_sehat_episodeofcare ON satu_sehat_episodeofcare.no_rawat = diagnosa_pasien.no_rawat
				AND satu_sehat_episodeofcare.kd_penyakit = diagnosa_pasien.kd_penyakit AND satu_sehat_episodeofcare.status = diagnosa_pasien.status
			WHERE pemeriksaan_ralan.tgl_perawatan BETWEEN ? AND ? AND diagnosa_pasien.kd_penyakit LIKE '%O%'
		`
		argsRalan := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			queryRalan += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR diagnosa_pasien.kd_penyakit LIKE ? OR penyakit.nm_penyakit LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				argsRalan = append(argsRalan, kw)
			}
		}
		switch statusFilter {
		case "terkirim":
			queryRalan += " AND satu_sehat_episodeofcare.id_episodeofcare IS NOT NULL AND satu_sehat_episodeofcare.id_episodeofcare != ''"
		case "belum":
			queryRalan += " AND (satu_sehat_episodeofcare.id_episodeofcare IS NULL OR satu_sehat_episodeofcare.id_episodeofcare = '')"
		}

		rowsRalan, err := db.Query(queryRalan, argsRalan...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for rowsRalan.Next() {
			var r EpisodeOfCareCandidateRow
			if err := rowsRalan.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.SttsRawat, &r.SttsLanjut, &r.TanggalPulang, &r.IDEncounter,
				&r.KdPenyakit, &r.NamaPenyakit, &r.IDEpisodeOfCare); err != nil {
				continue
			}
			r.Status = "Ralan"
			list = append(list, r)
		}
		rowsRalan.Close()

		// Ranap: tgl_keluar kamar_inap dipakai sbg rentang & akhir period.
		queryRanap := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				reg_periksa.stts, reg_periksa.status_lanjut,
				CONCAT(kamar_inap.tgl_keluar,'T',kamar_inap.jam_keluar,'+07:00') as pulang,
				satu_sehat_encounter.id_encounter, diagnosa_pasien.kd_penyakit, IFNULL(penyakit.nm_penyakit,''),
				IFNULL(satu_sehat_episodeofcare.id_episodeofcare,'') as id_episodeofcare
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN kamar_inap ON kamar_inap.no_rawat = reg_periksa.no_rawat
			INNER JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat AND diagnosa_pasien.status = 'Ranap'
			INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
			LEFT JOIN satu_sehat_episodeofcare ON satu_sehat_episodeofcare.no_rawat = diagnosa_pasien.no_rawat
				AND satu_sehat_episodeofcare.kd_penyakit = diagnosa_pasien.kd_penyakit AND satu_sehat_episodeofcare.status = diagnosa_pasien.status
			WHERE kamar_inap.tgl_keluar BETWEEN ? AND ? AND diagnosa_pasien.kd_penyakit LIKE '%O%'
		`
		argsRanap := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			queryRanap += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pasien.no_ktp LIKE ? OR diagnosa_pasien.kd_penyakit LIKE ? OR penyakit.nm_penyakit LIKE ? OR reg_periksa.stts LIKE ? OR reg_periksa.status_lanjut LIKE ?)`
			kw := "%" + keyword + "%"
			for i := 0; i < 8; i++ {
				argsRanap = append(argsRanap, kw)
			}
		}
		switch statusFilter {
		case "terkirim":
			queryRanap += " AND satu_sehat_episodeofcare.id_episodeofcare IS NOT NULL AND satu_sehat_episodeofcare.id_episodeofcare != ''"
		case "belum":
			queryRanap += " AND (satu_sehat_episodeofcare.id_episodeofcare IS NULL OR satu_sehat_episodeofcare.id_episodeofcare = '')"
		}

		rowsRanap, err := db.Query(queryRanap, argsRanap...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for rowsRanap.Next() {
			var r EpisodeOfCareCandidateRow
			if err := rowsRanap.Scan(&r.TglRegistrasi, &r.NoRawat, &r.NoRM, &r.NamaPasien, &r.NoKtpPasien,
				&r.SttsRawat, &r.SttsLanjut, &r.TanggalPulang, &r.IDEncounter,
				&r.KdPenyakit, &r.NamaPenyakit, &r.IDEpisodeOfCare); err != nil {
				continue
			}
			r.Status = "Ranap"
			list = append(list, r)
		}
		rowsRanap.Close()

		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

type episodeOfCareRowData struct {
	NoRkmMedis  string
	NamaPasien  string
	NikPasien   string
	Pulang      string // dipakai sbg period.start & statusHistory[0].period.start, persis draft Java
	IDEncounter string
}

func fetchEpisodeOfCareRowData(db *sql.DB, noRawat, kdPenyakit, status string) (episodeOfCareRowData, error) {
	var d episodeOfCareRowData
	var query string
	if status == "Ranap" {
		query = `
			SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				CONCAT(kamar_inap.tgl_keluar,'T',kamar_inap.jam_keluar,'+07:00'),
				IFNULL(satu_sehat_encounter.id_encounter,'')
			FROM reg_periksa
			INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
			INNER JOIN kamar_inap ON kamar_inap.no_rawat = reg_periksa.no_rawat
			INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat AND diagnosa_pasien.kd_penyakit = ? AND diagnosa_pasien.status = 'Ranap'
			LEFT JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			WHERE reg_periksa.no_rawat = ?
			LIMIT 1
		`
	} else {
		query = `
			SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				CONCAT(pemeriksaan_ralan.tgl_perawatan,'T',pemeriksaan_ralan.jam_rawat,'+07:00'),
				IFNULL(satu_sehat_encounter.id_encounter,'')
			FROM reg_periksa
			INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
			INNER JOIN pemeriksaan_ralan ON pemeriksaan_ralan.no_rawat = reg_periksa.no_rawat
			INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = reg_periksa.no_rawat AND diagnosa_pasien.kd_penyakit = ? AND diagnosa_pasien.status = 'Ralan'
			LEFT JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			WHERE reg_periksa.no_rawat = ?
			LIMIT 1
		`
	}
	err := db.QueryRow(query, kdPenyakit, noRawat).Scan(&d.NoRkmMedis, &d.NamaPasien, &d.NikPasien, &d.Pulang, &d.IDEncounter)
	return d, err
}

// buildEpisodeOfCarePayload — dibangun ulang persis draft BtnKirimActionPerformed
// yg diberikan user (bukan lagi versi awal saya). Perbedaan penting dari versi
// awal: "identifier.value" cuma no_rawat (bukan no_rawat+kd_penyakit), "status"
// selalu "active" (bukan "finished"), ADA "statusHistory" & "type" (kode "ANC" —
// Antenatal Care, krn fitur ini scope-nya diagnosa bab ICD-10 "O"/kehamilan),
// "period" cuma py "start" (tanpa "end"), dan TIDAK ADA "diagnosis"/"careManager"
// sama sekali — draft Java menghitung ID praktisi tapi ternyata tidak pernah
// dipakai di JSON akhir (kode mati), jadi tidak direplikasi.
func buildEpisodeOfCarePayload(id, noRawat string, d episodeOfCareRowData, ihsPasien, orgID string) map[string]interface{} {
	payload := map[string]interface{}{
		"resourceType": "EpisodeOfCare",
		"identifier": []map[string]interface{}{
			{"system": "http://sys-ids.kemkes.go.id/episode-of-care/" + orgID, "value": noRawat},
		},
		"status": "active",
		"statusHistory": []map[string]interface{}{
			{"status": "active", "period": map[string]interface{}{"start": d.Pulang}},
		},
		"type": []map[string]interface{}{
			{"coding": []map[string]interface{}{
				{"system": "http://terminology.kemkes.go.id/CodeSystem/episodeofcare-type", "code": "ANC", "display": "Antenatal Care"},
			}},
		},
		"patient": map[string]interface{}{
			"reference": "Patient/" + ihsPasien,
			"display":   d.NamaPasien,
		},
		"managingOrganization": map[string]interface{}{"reference": "Organization/" + orgID},
		"period": map[string]interface{}{
			"start": d.Pulang,
		},
	}
	if id != "" {
		payload["id"] = id
	}
	return payload
}

type episodeOfCareRequestBody struct {
	KdPenyakit string `json:"kd_penyakit"`
	Status     string `json:"status"`
}

func (b episodeOfCareRequestBody) valid() bool {
	return b.KdPenyakit != "" && (b.Status == "Ralan" || b.Status == "Ranap")
}

// POST /api/satu-sehat/episode-of-care/send/*no_rawat
func sendEpisodeOfCareSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body episodeOfCareRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, kd_penyakit, dan status wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		d, err := fetchEpisodeOfCareRowData(db, noRawat, body.KdPenyakit, body.Status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildEpisodeOfCarePayload("", noRawat, d, ihsPasien, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", cfg.FhirURL+"/EpisodeOfCare", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var result map[string]interface{}
		json.Unmarshal(respBody, &result)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			logSatuSehatKirimError(db, "episode_of_care", noRawat+"|"+body.KdPenyakit+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}

		idEOC := satuSehatJSONStr(result["id"])
		if idEOC == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "ID EpisodeOfCare tidak ditemukan pada respons Satu Sehat", "details": result})
			return
		}

		if _, err := db.Exec(`
			INSERT INTO satu_sehat_episodeofcare (no_rawat, kd_penyakit, status, id_episodeofcare, id_encounter)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE id_episodeofcare = VALUES(id_episodeofcare)
		`, noRawat, body.KdPenyakit, body.Status, idEOC, d.IDEncounter); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "EpisodeOfCare terkirim tapi gagal menyimpan status lokal: " + err.Error()})
			return
		}
		clearSatuSehatKirimError(db, "episode_of_care", noRawat+"|"+body.KdPenyakit+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "EpisodeOfCare berhasil dikirim", "id_episodeofcare": idEOC})
	}
}

// POST /api/satu-sehat/episode-of-care/update/*no_rawat
func updateEpisodeOfCareSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		var body episodeOfCareRequestBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if noRawat == "" || !body.valid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, kd_penyakit, dan status wajib diisi"})
			return
		}

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idEOC string
		err = db.QueryRow(`
			SELECT id_episodeofcare FROM satu_sehat_episodeofcare
			WHERE no_rawat = ? AND kd_penyakit = ? AND status = ? AND id_episodeofcare != ''
		`, noRawat, body.KdPenyakit, body.Status).Scan(&idEOC)
		if err != nil || idEOC == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "EpisodeOfCare belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		d, err := fetchEpisodeOfCareRowData(db, noRawat, body.KdPenyakit, body.Status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data diagnosa tidak ditemukan"})
			return
		}

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		ihsPasien, err := resolveIHSPasien(db, cfg.FhirURL, token, d.NoRkmMedis, d.NikPasien)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendapatkan IHS Number pasien: " + err.Error()})
			return
		}

		payload := buildEpisodeOfCarePayload(idEOC, noRawat, d, ihsPasien, cfg.OrgID)

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PUT", cfg.FhirURL+"/EpisodeOfCare/"+idEOC, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			var result map[string]interface{}
			json.Unmarshal(respBody, &result)
			logSatuSehatKirimError(db, "episode_of_care", noRawat+"|"+body.KdPenyakit+"|"+body.Status, noRawat, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode), "details": result})
			return
		}
		clearSatuSehatKirimError(db, "episode_of_care", noRawat+"|"+body.KdPenyakit+"|"+body.Status)

		c.JSON(http.StatusOK, gin.H{"message": "EpisodeOfCare berhasil diupdate", "id_episodeofcare": idEOC})
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
				IFNULL(pr.tgl_permintaan,''),
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
				IFNULL(pr.tgl_permintaan,''),
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

// buildImagingStudyPayload menyusun payload FHIR ImagingStudy untuk satu noorder.
// Dipakai bersama oleh sendImagingStudy (POST) dan updateImagingStudy (PUT).
func buildImagingStudyPayload(db *sql.DB, cfg SatuSehatConfig, noOrder string) (map[string]interface{}, error) {
	var item ImagingStudyItem
	var idEncounterStr string
	err := db.QueryRow(`
		SELECT
			pr.noorder, pr.no_rawat, IFNULL(pr.tgl_permintaan,''),
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
		return nil, fmt.Errorf("Data permintaan radiologi tidak ditemukan")
	}

	// IHS number pasien
	var ihsNumber sql.NullString
	db.QueryRow(`SELECT ihs_number FROM satu_sehat_pasien WHERE no_rkm_medis = ?`, item.NoRkmMedis).Scan(&ihsNumber)

	// Pemeriksaan + modality
	detailRows, err := db.Query(`
		SELECT ppr.kd_jenis_prw,
			IFNULL(m.modality_code, 'DX') as modality_code,
			IFNULL(m.modality_display, 'Digital Radiography') as modality_display,
			IFNULL(jpr.nm_perawatan, IFNULL(m.display, '')) as nm_perawatan
		FROM permintaan_pemeriksaan_radiologi ppr
		LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
		LEFT JOIN erm_mapping_radiologi m ON ppr.kd_jenis_prw = m.kd_jenis_prw
		WHERE ppr.noorder = ?
	`, noOrder)
	if err != nil {
		return nil, err
	}
	defer detailRows.Close()

	type SeriesInfo struct {
		ModalityCode    string
		ModalityDisplay string
		KdJenisPrw      string
		NmPerawatan     string
	}
	var seriesList []SeriesInfo
	var descParts []string
	for detailRows.Next() {
		var s SeriesInfo
		detailRows.Scan(&s.KdJenisPrw, &s.ModalityCode, &s.ModalityDisplay, &s.NmPerawatan)
		seriesList = append(seriesList, s)
		if s.NmPerawatan != "" {
			descParts = append(descParts, s.NmPerawatan)
		}
	}
	if len(seriesList) == 0 {
		return nil, fmt.Errorf("Tidak ada pemeriksaan untuk order ini")
	}

	// ServiceRequest yang sudah terkirim untuk order ini -> basedOn
	srRows, err := db.Query(`
		SELECT id_servicerequest FROM satu_sehat_servicerequest_radiologi
		WHERE noorder = ? AND id_servicerequest != ''
	`, noOrder)
	var basedOn []map[string]interface{}
	if err == nil {
		defer srRows.Close()
		for srRows.Next() {
			var id string
			srRows.Scan(&id)
			basedOn = append(basedOn, map[string]interface{}{"reference": "ServiceRequest/" + id})
		}
	}

	encRef := ""
	if idEncounterStr != "" {
		encRef = "Encounter/" + idEncounterStr
	}
	patRef := ""
	if ihsNumber.Valid && ihsNumber.String != "" {
		patRef = "Patient/" + ihsNumber.String
	}

	// UID study/series/instance dibuat deterministik dari OrgID+noorder, supaya
	// tetap sama antara pengiriman awal (POST) dan pembaruan (PUT).
	baseUID := fmt.Sprintf("2.16.840.1.113883.%s.%s", cfg.OrgID, noOrder)

	series := []map[string]interface{}{}
	for i, s := range seriesList {
		series = append(series, map[string]interface{}{
			"uid":    fmt.Sprintf("%s.%d", baseUID, i+1),
			"number": i + 1,
			"modality": map[string]interface{}{
				"system":  "http://dicom.nema.org/resources/ontology/DCM",
				"code":    s.ModalityCode,
				"display": s.ModalityDisplay,
			},
			"numberOfInstances": 1,
			"instance": []map[string]interface{}{
				{
					"uid": fmt.Sprintf("%s.%d.1", baseUID, i+1),
					"sopClass": map[string]interface{}{
						"system": "urn:ietf:rfc:3986",
						"code":   "urn:oid:1.2.840.10008.5.1.4.1.1.1",
					},
					"number": 1,
				},
			},
		})
	}

	payload := map[string]interface{}{
		"resourceType": "ImagingStudy",
		"identifier": []map[string]interface{}{
			{
				"use": "usual",
				"type": map[string]interface{}{
					"coding": []map[string]interface{}{
						{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "ACSN"},
					},
				},
				"system": "http://sys-ids.kemkes.go.id/acsn/" + cfg.OrgID,
				"value":  khanzaAccessionNumber(db, noOrder),
			},
			{
				"system": "urn:dicom:uid",
				"value":  "urn:oid:" + baseUID,
			},
		},
		"status":            "available",
		"numberOfSeries":    len(series),
		"numberOfInstances": len(series),
		"series":            series,
	}
	if len(basedOn) > 0 {
		payload["basedOn"] = basedOn
	}
	if len(descParts) > 0 {
		payload["description"] = strings.Join(descParts, ", ")
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
		payload["started"] = fmt.Sprintf("%sT%s+07:00", sqlDateOnly(item.TglPermintaan), jam)
	}

	return payload, nil
}

// POST /api/satu-sehat/imaging-study/send/:noorder
func sendImagingStudy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		payload, err := buildImagingStudyPayload(db, cfg, noOrder)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
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
			logSatuSehatKirimError(db, "imagingstudy", noOrder, noRawatLookup, resp.StatusCode, respBody)
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
		clearSatuSehatKirimError(db, "imagingstudy", noOrder)

		c.JSON(http.StatusOK, gin.H{
			"message":         "ImagingStudy berhasil dikirim",
			"id_imagingstudy": idImagingStudy,
		})
	}
}

// POST /api/satu-sehat/imaging-study/update/:noorder
func updateImagingStudy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		var noRawatLookup string
		db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ? LIMIT 1`, noOrder).Scan(&noRawatLookup)

		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}

		var idImagingStudy string
		err = db.QueryRow(`SELECT id_imagingstudy FROM satu_sehat_imagingstudy WHERE noorder = ? AND id_imagingstudy != ''`, noOrder).Scan(&idImagingStudy)
		if err != nil || idImagingStudy == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ImagingStudy belum pernah dikirim, tidak bisa diupdate"})
			return
		}

		payload, err := buildImagingStudyPayload(db, cfg, noOrder)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		payload["id"] = idImagingStudy

		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		payloadBytes, _ := json.Marshal(payload)
		apiURL := cfg.FhirURL + "/ImagingStudy/" + idImagingStudy
		req, _ := http.NewRequest("PUT", apiURL, bytes.NewReader(payloadBytes))
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
			logSatuSehatKirimError(db, "imagingstudy", noOrder, noRawatLookup, resp.StatusCode, respBody)
			c.JSON(http.StatusBadGateway, gin.H{
				"error":   fmt.Sprintf("Satu Sehat HTTP %d", resp.StatusCode),
				"details": string(respBody),
			})
			return
		}
		clearSatuSehatKirimError(db, "imagingstudy", noOrder)

		c.JSON(http.StatusOK, gin.H{
			"message":         "ImagingStudy berhasil diupdate",
			"id_imagingstudy": idImagingStudy,
		})
	}
}

// POST /api/satu-sehat/imaging-study/verify/*noorder — cek langsung ke Satu
// Sehat apakah ImagingStudy utk order ini SUDAH terbentuk (dipakai utk jalur
// "Kirim via DICOM Router", karena Router yg POST ImagingStudy-nya sendiri ke
// Satu Sehat secara async — backend ini cuma tahu file DICOM-nya berhasil
// diteruskan, tidak pernah dapat ID ASLI resource yg terbentuk). Query pakai
// identifier ACSN persis dokumentasi resmi Satu Sehat:
// GET /ImagingStudy?identifier=http://sys-ids.kemkes.go.id/acsn/{OrgID}|{ACSN}
// Kalau ketemu, ID ImagingStudy ASLI dari Satu Sehat disimpan menggantikan
// sentinel lokal 'via-dicom-router', supaya status di UI akurat.
func verifyImagingStudySatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		cfg, err := getSatuSehatConfig(db)
		if err != nil || cfg.ClientID == "" || cfg.OrgID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konfigurasi Satu Sehat belum lengkap"})
			return
		}
		token, err := getSatuSehatToken(cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan token: " + err.Error()})
			return
		}

		identifier := "http://sys-ids.kemkes.go.id/acsn/" + cfg.OrgID + "|" + khanzaAccessionNumber(db, noOrder)
		apiURL := fmt.Sprintf("%s/ImagingStudy?identifier=%s", cfg.FhirURL, url.QueryEscape(identifier))
		req, _ := http.NewRequest("GET", apiURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Satu Sehat: " + err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)

		var bundle struct {
			Entry []struct {
				Resource struct {
					ID string `json:"id"`
				} `json:"resource"`
			} `json:"entry"`
		}
		json.Unmarshal(respBody, &bundle)

		if resp.StatusCode != 200 || len(bundle.Entry) == 0 {
			c.JSON(http.StatusOK, gin.H{"found": false, "message": "Belum ditemukan di Satu Sehat (kemungkinan DICOM Router belum selesai memproses, coba cek lagi beberapa saat lagi)"})
			return
		}

		realID := bundle.Entry[0].Resource.ID
		if realID == "" {
			c.JSON(http.StatusOK, gin.H{"found": false, "message": "Ditemukan tapi ID resource kosong"})
			return
		}

		db.Exec(`
			INSERT INTO satu_sehat_imagingstudy (noorder, id_imagingstudy) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE id_imagingstudy = VALUES(id_imagingstudy)
		`, noOrder, realID)

		c.JSON(http.StatusOK, gin.H{"found": true, "id_imagingstudy": realID})
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
		case "orthanc_user":
			cfg.OrthancUser = nilai
		case "orthanc_pass":
			cfg.OrthancPass = nilai
		case "dicom_router_name":
			cfg.DicomRouterName = nilai
		case "dicom_router_host":
			cfg.DicomRouterHost = nilai
		case "dicom_router_port":
			cfg.DicomRouterPort = nilai
		case "dicom_router_aet":
			cfg.DicomRouterAET = nilai
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
// cariTemplateBelumMappingLab — persis query tampil() di Java lama (JOIN
// jns_perawatan_lab spy dapat kd_jenis_prw/nm_perawatan = "kelompok
// pemeriksaan"nya, mis. "DARAH LENGKAP"), krn nama detail tes sendiri
// (Pemeriksaan, mis. "Leukosit") sering muncul di BANYAK kelompok berbeda —
// tanpa kolom kelompoknya user tidak bisa bedakan mau pilih yang mana.
// Ditambah filter "belum mapping" (khusus kebutuhan modal Tambah Mapping
// kita, tidak ada di Java aslinya) spy tidak menampilkan yg sudah dipetakan.
func cariTemplateBelumMappingLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				template_laboratorium.kd_jenis_prw,
				jns_perawatan_lab.nm_perawatan,
				template_laboratorium.id_template,
				template_laboratorium.Pemeriksaan,
				IFNULL(template_laboratorium.satuan,'')
			FROM template_laboratorium
			INNER JOIN jns_perawatan_lab ON jns_perawatan_lab.kd_jenis_prw = template_laboratorium.kd_jenis_prw
			LEFT JOIN satu_sehat_mapping_lab ON template_laboratorium.id_template = satu_sehat_mapping_lab.id_template
			WHERE jns_perawatan_lab.status = '1'
				AND satu_sehat_mapping_lab.id_template IS NULL
		`
		args := []interface{}{}
		if keyword != "" {
			query += ` AND (template_laboratorium.id_template LIKE ? OR template_laboratorium.Pemeriksaan LIKE ?
				OR jns_perawatan_lab.nm_perawatan LIKE ? OR template_laboratorium.kd_jenis_prw LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw)
		}
		query += ` ORDER BY template_laboratorium.kd_jenis_prw, template_laboratorium.id_template, template_laboratorium.urut LIMIT 300`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type TemplateItem struct {
			KdJenisPrw  string `json:"kd_jenis_prw"`
			NmPerawatan string `json:"nm_perawatan"`
			IDTemplate  int    `json:"id_template"`
			Pemeriksaan string `json:"pemeriksaan"`
			Satuan      string `json:"satuan"`
		}
		list := []TemplateItem{}
		for rows.Next() {
			var o TemplateItem
			if err := rows.Scan(&o.KdJenisPrw, &o.NmPerawatan, &o.IDTemplate, &o.Pemeriksaan, &o.Satuan); err == nil {
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
