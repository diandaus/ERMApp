package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// orthancClient — helper untuk panggil Orthanc REST API
type orthancClient struct {
	baseURL string
	user    string
	pass    string
	http    *http.Client
}

func newOrthancClient(db *sql.DB) *orthancClient {
	return &orthancClient{
		baseURL: getKonfigurasi(db, "orthanc_url", "http://localhost:8042"),
		user:    getKonfigurasi(db, "orthanc_user", "orthanc"),
		pass:    getKonfigurasi(db, "orthanc_pass", "orthanc"),
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (o *orthancClient) do(method, path string, body interface{}) ([]byte, int, error) {
	var reqBody io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, o.baseURL+path, reqBody)
	if err != nil {
		return nil, 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.SetBasicAuth(o.user, o.pass)
	resp, err := o.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return data, resp.StatusCode, nil
}

// lazyModifyPACS — sinkronisasi tag DICOM di Orthanc sebelum kirim ke Satu Sehat.
// Kegagalan TIDAK menghentikan proses; hanya mengembalikan pesan log.
func lazyModifyPACS(db *sql.DB, noOrder, noRkmMedis, nmPasien, tglLahir, jk, tglPermintaan, studyDesc string) string {
	orthanc := newOrthancClient(db)

	// Cari study by AccessionNumber = noorder
	findResp, _, err := orthanc.do("POST", "/tools/find", map[string]interface{}{
		"Level":  "Study",
		"Query":  map[string]string{"AccessionNumber": noOrder},
		"Expand": true,
		"Limit":  1,
	})
	if err != nil {
		return "PACS sync skip: " + err.Error()
	}

	var studies []map[string]interface{}
	json.Unmarshal(findResp, &studies)

	// Fallback: cari by PatientID + StudyDate
	if len(studies) == 0 {
		dicomDate := strings.ReplaceAll(tglPermintaan, "-", "")
		findResp2, _, _ := orthanc.do("POST", "/tools/find", map[string]interface{}{
			"Level":  "Study",
			"Query":  map[string]string{"PatientID": noRkmMedis, "StudyDate": dicomDate},
			"Expand": true,
			"Limit":  1,
		})
		json.Unmarshal(findResp2, &studies)
	}

	if len(studies) == 0 {
		return "PACS sync skip: study belum ada di Orthanc"
	}

	studyID, _ := studies[0]["ID"].(string)
	if studyID == "" {
		return "PACS sync skip: ID study tidak valid"
	}

	sex := "O"
	switch strings.ToUpper(jk) {
	case "L":
		sex = "M"
	case "P":
		sex = "F"
	}

	replaceTags := map[string]string{
		"PatientID":        noRkmMedis,
		"PatientName":      strings.ToUpper(nmPasien),
		"PatientBirthDate": strings.ReplaceAll(tglLahir, "-", ""),
		"PatientSex":       sex,
		"AccessionNumber":  noOrder,
		"StudyDescription": studyDesc,
	}

	_, status, err := orthanc.do("POST", "/studies/"+studyID+"/modify", map[string]interface{}{
		"Replace":    replaceTags,
		"KeepSource": false,
		"Force":      true,
	})
	if err != nil {
		return "PACS sync error: " + err.Error()
	}
	if status != 200 {
		// Fallback: AccessionNumber + StudyDescription saja (tanpa patient tags)
		orthanc.do("POST", "/studies/"+studyID+"/modify", map[string]interface{}{
			"Replace":    map[string]string{"AccessionNumber": noOrder, "StudyDescription": studyDesc},
			"KeepSource": false,
			"Force":      true,
		})
		return fmt.Sprintf("PACS sync: partial modify (full gagal HTTP %d)", status)
	}
	return "PACS sync OK: tag DICOM diperbarui (" + studyID[:8] + "...)"
}

// POST /api/satu-sehat/dicom/send/*noorder
// Cari study di Orthanc berdasarkan AccessionNumber lalu kirim ke DICOM Router
func sendDicomToSatuSehat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		orthanc := newOrthancClient(db)
		dicomRouterName := getKonfigurasi(db, "dicom_router_name", "DICOM_ROUTER")

		// Step 1 — Pastikan DICOM Router terdaftar di Orthanc
		_, status, err := orthanc.do("GET", "/modalities/"+dicomRouterName, nil)
		if err != nil || status == 404 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Modality '%s' belum terdaftar di Orthanc. Tambahkan dulu di orthanc.json.", dicomRouterName),
				"hint": "Lihat panduan konfigurasi di bawah",
			})
			return
		}

		// Step 2 — Cari study di Orthanc berdasarkan AccessionNumber = noorder
		findBody := map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{
				"AccessionNumber": noOrder,
			},
		}
		findResp, _, err := orthanc.do("POST", "/tools/find", findBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}

		var studyIDs []string
		json.Unmarshal(findResp, &studyIDs)

		if len(studyIDs) == 0 {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   fmt.Sprintf("Study dengan AccessionNumber '%s' tidak ditemukan di Orthanc", noOrder),
				"hint":    "Pastikan gambar DICOM sudah dikirim dari mesin CR AGFA ke Orthanc",
			})
			return
		}

		// Step 3 — Ambil detail study untuk info response
		type StudyInfo struct {
			ID          string `json:"ID"`
			PatientName string `json:"PatientName"`
			StudyDate   string `json:"StudyDate"`
			Modality    string `json:"Modality"`
		}
		var studyInfoList []StudyInfo
		for _, sid := range studyIDs {
			detailResp, _, _ := orthanc.do("GET", "/studies/"+sid, nil)
			var detail map[string]interface{}
			json.Unmarshal(detailResp, &detail)
			info := StudyInfo{ID: sid}
			if main, ok := detail["MainDicomTags"].(map[string]interface{}); ok {
				if v, ok := main["StudyDate"].(string); ok {
					info.StudyDate = v
				}
			}
			if pt, ok := detail["PatientMainDicomTags"].(map[string]interface{}); ok {
				if v, ok := pt["PatientName"].(string); ok {
					info.PatientName = v
				}
			}
			studyInfoList = append(studyInfoList, info)
		}

		// Step 4 — Perintahkan Orthanc kirim ke DICOM Router
		storeBody := map[string]interface{}{
			"Resources": studyIDs,
		}
		storeResp, storeStatus, err := orthanc.do("POST", "/modalities/"+dicomRouterName+"/store", storeBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mengirim ke DICOM Router: " + err.Error()})
			return
		}

		if storeStatus != 200 {
			var errDetail interface{}
			json.Unmarshal(storeResp, &errDetail)
			c.JSON(http.StatusBadGateway, gin.H{
				"error":   fmt.Sprintf("Orthanc gagal kirim ke DICOM Router (HTTP %d)", storeStatus),
				"details": errDetail,
			})
			return
		}

		// Step 5 — Catat di DB bahwa DICOM sudah dikirim
		db.Exec(`
			INSERT INTO satu_sehat_imagingstudy (noorder, id_imagingstudy)
			VALUES (?, 'via-dicom-router')
			ON DUPLICATE KEY UPDATE id_imagingstudy = IF(id_imagingstudy = '' OR id_imagingstudy IS NULL, 'via-dicom-router', id_imagingstudy)
		`, noOrder)

		c.JSON(http.StatusOK, gin.H{
			"message":  "DICOM berhasil dikirim ke DICOM Router → Satu Sehat",
			"noorder":  noOrder,
			"studies":  studyInfoList,
			"count":    len(studyIDs),
		})
	}
}

// GET /api/satu-sehat/dicom/studies/*noorder
// Cek apakah study sudah ada di Orthanc untuk noorder ini
func getDicomStudies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		orthanc := newOrthancClient(db)

		findBody := map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{"AccessionNumber": noOrder},
		}
		findResp, _, err := orthanc.do("POST", "/tools/find", findBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		var studyIDs []string
		json.Unmarshal(findResp, &studyIDs)

		type StudySummary struct {
			OrthancID   string `json:"orthanc_id"`
			PatientName string `json:"patient_name"`
			StudyDate   string `json:"study_date"`
			Modalities  string `json:"modalities"`
			Instances   int    `json:"instances"`
		}

		results := []StudySummary{}
		for _, sid := range studyIDs {
			detailResp, _, _ := orthanc.do("GET", "/studies/"+sid, nil)
			var detail map[string]interface{}
			json.Unmarshal(detailResp, &detail)

			s := StudySummary{OrthancID: sid}
			if main, ok := detail["MainDicomTags"].(map[string]interface{}); ok {
				if v, ok := main["StudyDate"].(string); ok {
					s.StudyDate = v
				}
				if v, ok := main["ModalitiesInStudy"].(string); ok {
					s.Modalities = v
				}
			}
			if pt, ok := detail["PatientMainDicomTags"].(map[string]interface{}); ok {
				if v, ok := pt["PatientName"].(string); ok {
					s.PatientName = v
				}
			}
			if series, ok := detail["Series"].([]interface{}); ok {
				s.Instances = len(series)
			}
			results = append(results, s)
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder": noOrder,
			"found":   len(results) > 0,
			"studies": results,
		})
	}
}

// POST /api/satu-sehat/dicom/register-router
// Daftarkan DICOM Router ke Orthanc secara programatik
func registerDicomRouterToOrthanc(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orthanc := newOrthancClient(db)
		routerName := getKonfigurasi(db, "dicom_router_name", "DICOM_ROUTER")
		routerHost := getKonfigurasi(db, "dicom_router_host", "localhost")
		routerPort := getKonfigurasi(db, "dicom_router_port", "11112")
		routerAET := getKonfigurasi(db, "dicom_router_aet", "DICOMROUTER")

		// Orthanc REST API untuk tambah modality dinamis (Orthanc 1.9+)
		body := map[string]interface{}{
			"AET":  routerAET,
			"Host": routerHost,
			"Port": func() int {
				port := 11112
				fmt.Sscanf(routerPort, "%d", &port)
				return port
			}(),
		}

		_, status, err := orthanc.do("PUT", "/modalities/"+routerName, body)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}
		if status != 200 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Orthanc HTTP %d — mungkin versi Orthanc tidak support API ini", status),
				"hint":  "Edit manual /etc/orthanc/orthanc.json dan tambahkan bagian DicomModalities",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("DICOM Router '%s' berhasil didaftarkan ke Orthanc", routerName),
			"aet":     routerAET,
			"host":    routerHost,
			"port":    routerPort,
		})
	}
}
