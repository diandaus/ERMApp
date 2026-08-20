package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type MappingRadiologiRow struct {
	KdJenisPrw    string `json:"kd_jenis_prw"`
	NmPerawatan   string `json:"nm_perawatan"`
	Code          string `json:"code"`
	System        string `json:"system"`
	Display       string `json:"display"`
	SampelCode    string `json:"sampel_code"`
	SampelSystem  string `json:"sampel_system"`
	SampelDisplay string `json:"sampel_display"`
}

type LoincResult struct {
	LoincNum   string `json:"loinc_num"`
	LongName   string `json:"long_common_name"`
	ShortName  string `json:"short_name"`
	Component  string `json:"component"`
	Property   string `json:"property"`
	TimeAspect string `json:"time_aspct"`
	System     string `json:"system"`
	ScaleType  string `json:"scale_typ"`
	MethodType string `json:"method_typ"`
	Class      string `json:"class"`
	Status     string `json:"status"`
}

// ─── GET /api/mapping/radiologi ───────────────────────────────────────────────
// Daftar semua jenis perawatan radiologi + status mapping LOINC

func getMappingRadiologiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := c.Query("q")

		query := `
			SELECT
				jpr.kd_jenis_prw,
				IFNULL(jpr.nm_perawatan,'') as nm_perawatan,
				IFNULL(m.code,'') as code,
				IFNULL(m.system,'') as system,
				IFNULL(m.display,'') as display,
				IFNULL(m.sampel_code,'') as sampel_code,
				IFNULL(m.sampel_system,'') as sampel_system,
				IFNULL(m.sampel_display,'') as sampel_display
			FROM jns_perawatan_radiologi jpr
			LEFT JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = jpr.kd_jenis_prw
			WHERE jpr.status = '1'
		`
		args := []interface{}{}
		if keyword != "" {
			query += " AND (jpr.nm_perawatan LIKE ? OR jpr.kd_jenis_prw LIKE ?)"
			args = append(args, "%"+keyword+"%", "%"+keyword+"%")
		}
		query += " ORDER BY jpr.nm_perawatan"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingRadiologiRow{}
		for rows.Next() {
			var r MappingRadiologiRow
			rows.Scan(&r.KdJenisPrw, &r.NmPerawatan, &r.Code, &r.System, &r.Display,
				&r.SampelCode, &r.SampelSystem, &r.SampelDisplay)
			list = append(list, r)
		}

		// Ringkasan
		total := len(list)
		sudah := 0
		for _, r := range list {
			if r.Code != "" {
				sudah++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"list":   list,
			"total":  total,
			"sudah":  sudah,
			"belum":  total - sudah,
		})
	}
}

// ─── PUT /api/mapping/radiologi/:kd_jenis_prw ────────────────────────────────
// Simpan/update mapping ke satu_sehat_mapping_radiologi

func saveMappingRadiologiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_jenis_prw")
		var body MappingRadiologiRow
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Gunakan code/system/display yang sama untuk sampel jika tidak diisi
		if body.SampelCode == "" {
			body.SampelCode = body.Code
		}
		if body.SampelSystem == "" {
			body.SampelSystem = body.System
		}
		if body.SampelDisplay == "" {
			body.SampelDisplay = body.Display
		}

		_, err := db.Exec(`
			INSERT INTO satu_sehat_mapping_radiologi
				(kd_jenis_prw, code, system, display, sampel_code, sampel_system, sampel_display)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				code           = VALUES(code),
				system         = VALUES(system),
				display        = VALUES(display),
				sampel_code    = VALUES(sampel_code),
				sampel_system  = VALUES(sampel_system),
				sampel_display = VALUES(sampel_display)
		`, kd, body.Code, body.System, body.Display,
			body.SampelCode, body.SampelSystem, body.SampelDisplay)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping berhasil disimpan"})
	}
}

// ─── DELETE /api/mapping/radiologi/:kd_jenis_prw ─────────────────────────────

func deleteMappingRadiologiSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_jenis_prw")
		db.Exec(`DELETE FROM satu_sehat_mapping_radiologi WHERE kd_jenis_prw = ?`, kd)
		c.JSON(http.StatusOK, gin.H{"message": "Mapping dihapus"})
	}
}

// ─── GET /api/mapping/loinc/search ───────────────────────────────────────────
// Proxy ke LOINC API — hindari CORS dan simpan kredensial di server

func searchLoinc(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := strings.TrimSpace(c.Query("q"))
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter q wajib diisi"})
			return
		}

		user := getKonfigurasi(db, "loinc_username", "")
		pass := getKonfigurasi(db, "loinc_password", "")
		if user == "" || pass == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kredensial LOINC belum dikonfigurasi (loinc_username / loinc_password)"})
			return
		}

		// LOINC FHIR R4 — ValueSet $expand
		apiURL := "https://fhir.loinc.org/ValueSet/$expand?url=http://loinc.org/vs&filter=" +
			url.QueryEscape(query) + "&count=20"
		req, err := http.NewRequest("GET", apiURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		creds := base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
		req.Header.Set("Authorization", "Basic "+creds)
		req.Header.Set("Accept", "application/fhir+json")

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi LOINC API: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode == 401 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Kredensial LOINC tidak valid — periksa username/password"})
			return
		}
		if resp.StatusCode != 200 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("LOINC API HTTP %d: %s", resp.StatusCode, string(body)[:min(200, len(body))])})
			return
		}

		// Parse FHIR ValueSet response: { "expansion": { "contains": [{code, display, extension:[]}] } }
		var raw map[string]interface{}
		json.Unmarshal(body, &raw)

		results := []map[string]interface{}{}
		if expansion, ok := raw["expansion"].(map[string]interface{}); ok {
			if contains, ok := expansion["contains"].([]interface{}); ok {
				for _, item := range contains {
					entry, ok := item.(map[string]interface{})
					if !ok {
						continue
					}
					code := strVal(entry, "code")
					if code == "" {
						continue
					}
					display := strVal(entry, "display")

					result := map[string]interface{}{
						"loinc_num":        code,
						"long_common_name": display,
						"short_name":       display,
						"component":        "",
						"class":            "",
						"scale_typ":        "",
						"method_typ":       "",
						"status":           "ACTIVE",
					}

					// Ambil properti dari extensions FHIR
					if exts, ok := entry["extension"].([]interface{}); ok {
						for _, ext := range exts {
							e, ok := ext.(map[string]interface{})
							if !ok {
								continue
							}
							extURL := strVal(e, "url")
							val := strVal(e, "valueString")
							switch extURL {
							case "http://loinc.org/property/COMPONENT":
								result["component"] = val
							case "http://loinc.org/property/CLASS":
								result["class"] = val
							case "http://loinc.org/property/SCALE_TYP":
								result["scale_typ"] = val
							case "http://loinc.org/property/METHOD_TYP":
								result["method_typ"] = val
							case "http://loinc.org/property/STATUS":
								result["status"] = val
							}
						}
					}
					results = append(results, result)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"results": results,
			"count":   len(results),
		})
	}
}

// ─── GET/POST /api/mapping/loinc/config ──────────────────────────────────────

func getLoincConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := getKonfigurasi(db, "loinc_username", "")
		hasPwd := getKonfigurasi(db, "loinc_password", "") != ""
		c.JSON(http.StatusOK, gin.H{
			"loinc_username":    user,
			"loinc_password_ok": hasPwd,
		})
	}
}

func saveLoincConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Username string `json:"loinc_username"`
			Password string `json:"loinc_password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		db.Exec(`INSERT INTO satu_sehat_konfigurasi (kode, nilai) VALUES ('loinc_username',?)
			ON DUPLICATE KEY UPDATE nilai=VALUES(nilai)`, body.Username)
		if body.Password != "" && body.Password != "***" {
			db.Exec(`INSERT INTO satu_sehat_konfigurasi (kode, nilai) VALUES ('loinc_password',?)
				ON DUPLICATE KEY UPDATE nilai=VALUES(nilai)`, body.Password)
		}
		c.JSON(http.StatusOK, gin.H{"message": "Kredensial LOINC disimpan"})
	}
}

// ─── Helper ───────────────────────────────────────────────────────────────────

func strVal(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
