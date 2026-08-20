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

// orthancFindIDs/orthancFindExpanded — wrapper /tools/find yg SELALU cek
// status code (bukan cuma error jaringan). Sebelumnya status code dari
// /tools/find dibuang begitu saja di semua pemanggil — kalau Orthanc menolak
// request (401 salah username/password, 400 format query salah, dst),
// responsnya BUKAN array JSON valid, jadi json.Unmarshal gagal diam-diam dan
// hasilnya kebaca sbg "0 studi ditemukan" — padahal requestnya gagal total.
// Ini bikin fitur pencarian ACSN/preview selalu bilang "belum ditemukan"
// walau datanya jelas ada di Orthanc (mis. Username/Password Orthanc salah).
func truncateOrthancMsg(b []byte) string {
	s := string(b)
	if len(s) > 200 {
		return s[:200] + "..."
	}
	return s
}

func orthancFindIDs(orthanc *orthancClient, query map[string]interface{}) ([]string, error) {
	resp, status, err := orthanc.do("POST", "/tools/find", query)
	if err != nil {
		return nil, err
	}
	if status != 200 {
		return nil, fmt.Errorf("Orthanc HTTP %d saat /tools/find (cek URL/Username/Password Orthanc di tab Konfigurasi) — %s", status, truncateOrthancMsg(resp))
	}
	var ids []string
	if err := json.Unmarshal(resp, &ids); err != nil {
		return nil, fmt.Errorf("respons /tools/find tidak valid: %v", err)
	}
	return ids, nil
}

func orthancFindExpanded(orthanc *orthancClient, query map[string]interface{}) ([]map[string]interface{}, error) {
	resp, status, err := orthanc.do("POST", "/tools/find", query)
	if err != nil {
		return nil, err
	}
	if status != 200 {
		return nil, fmt.Errorf("Orthanc HTTP %d saat /tools/find (cek URL/Username/Password Orthanc di tab Konfigurasi) — %s", status, truncateOrthancMsg(resp))
	}
	var studies []map[string]interface{}
	if err := json.Unmarshal(resp, &studies); err != nil {
		return nil, fmt.Errorf("respons /tools/find tidak valid: %v", err)
	}
	return studies, nil
}

// lazyModifyPACS — sinkronisasi tag DICOM di Orthanc sebelum kirim ke Satu Sehat.
// Kegagalan TIDAK menghentikan proses; hanya mengembalikan pesan log.
func lazyModifyPACS(db *sql.DB, noOrder, noRkmMedis, nmPasien, tglLahir, jk, tglPermintaan, studyDesc string) string {
	orthanc := newOrthancClient(db)

	// Cari study by AccessionNumber = noorder
	studies, err := orthancFindExpanded(orthanc, map[string]interface{}{
		"Level":  "Study",
		"Query":  map[string]string{"AccessionNumber": noOrder},
		"Expand": true,
		"Limit":  1,
	})
	if err != nil {
		return "PACS sync skip: " + err.Error()
	}

	// Fallback: cari by PatientID + StudyDate
	if len(studies) == 0 {
		dicomDate := strings.ReplaceAll(tglPermintaan, "-", "")
		studies2, err2 := orthancFindExpanded(orthanc, map[string]interface{}{
			"Level":  "Study",
			"Query":  map[string]string{"PatientID": noRkmMedis, "StudyDate": dicomDate},
			"Expand": true,
			"Limit":  1,
		})
		if err2 != nil {
			return "PACS sync skip: " + err2.Error()
		}
		studies = studies2
	}

	if len(studies) == 0 {
		return "PACS sync skip: study belum ada di Orthanc"
	}

	studyID, _ := studies[0]["ID"].(string)
	if studyID == "" {
		return "PACS sync skip: ID study tidak valid"
	}

	return applyAccessionTags(orthanc, studyID, noOrder, noRkmMedis, nmPasien, tglLahir, jk, studyDesc)
}

// applyAccessionTags — bagian "tulis tag ke Orthanc" yg dipisah dari
// lazyModifyPACS supaya bisa dipakai ulang oleh setAccessionNumberPACS
// (jalur otomatis, cuma 1 studi kandidat) MAUPUN confirmAccessionNumberPACS
// (jalur konfirmasi manual, user sudah pilih studyID-nya sendiri dari daftar
// kandidat — lihat getAccessionCandidatesPACS).
func applyAccessionTags(orthanc *orthancClient, studyID, noOrder, noRkmMedis, nmPasien, tglLahir, jk, studyDesc string) string {
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

// POST /api/satu-sehat/dicom/set-accession/*noorder — tombol "Kirim ACSN ke
// PACS Orthanc" berdiri sendiri (sebelumnya lazyModifyPACS cuma jalan diam-
// diam sbg efek samping saat kirim ServiceRequest). No.Permintaan Radiologi
// (noorder) dipakai sbg AccessionNumber, dicocokkan ke study Orthanc yg
// gambarnya sudah ada tapi ACSN-nya belum diisi/salah (dicari lewat
// PatientID+StudyDate kalau AccessionNumber belum ketemu), lalu tag studinya
// ditimpa (Replace) via Orthanc REST /studies/{id}/modify.
type radiologyOrderInfo struct {
	NoRkmMedis    string
	NmPasien      string
	TglLahir      string
	JK            string
	TglPermintaan string
	StudyDesc     string
}

func fetchRadiologyOrderInfo(db *sql.DB, noOrder string) (radiologyOrderInfo, error) {
	var info radiologyOrderInfo
	var tglLahir, jk sql.NullString
	err := db.QueryRow(`
		SELECT IFNULL(rp.no_rkm_medis,''), IFNULL(p.nm_pasien,''), p.tgl_lahir, p.jk, IFNULL(pr.tgl_permintaan,'')
		FROM permintaan_radiologi pr
		LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
		LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
		WHERE pr.noorder = ?
	`, noOrder).Scan(&info.NoRkmMedis, &info.NmPasien, &tglLahir, &jk, &info.TglPermintaan)
	if err != nil {
		return info, err
	}
	info.TglLahir = tglLahir.String
	info.JK = jk.String
	db.QueryRow(`
		SELECT GROUP_CONCAT(IFNULL(jpr.nm_perawatan, ppr.kd_jenis_prw) SEPARATOR ', ')
		FROM permintaan_pemeriksaan_radiologi ppr
		LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
		WHERE ppr.noorder = ?
	`, noOrder).Scan(&info.StudyDesc)
	return info, nil
}

type AccessionCandidate struct {
	StudyID       string `json:"study_id"`
	SeriesID      string `json:"series_id"`
	PatientID     string `json:"patient_id"`
	Modality      string `json:"modality"`
	StudyDate     string `json:"study_date"`
	InstanceCount int    `json:"instance_count"`
	WebViewerURL  string `json:"webviewer_url"`
}

// buildAccessionCandidates — susun daftar kandidat studi utk dipilih manual
// (satu baris per series, persis granularitas tab "Integrasi Orthanc" di
// Khanza Java yg nampilin kolom UUID Pasien/ID Studies/ID Series).
func buildAccessionCandidates(db *sql.DB, orthanc *orthancClient, studyIDs []string) []AccessionCandidate {
	orthancURL := getKonfigurasi(db, "orthanc_url", "http://localhost:8042")
	candidates := []AccessionCandidate{}
	for _, sid := range studyIDs {
		detailResp, _, err := orthanc.do("GET", "/studies/"+sid, nil)
		if err != nil {
			continue
		}
		var detail struct {
			Series               []string `json:"Series"`
			PatientMainDicomTags struct {
				PatientID string `json:"PatientID"`
			} `json:"PatientMainDicomTags"`
			MainDicomTags struct {
				StudyDate string `json:"StudyDate"`
			} `json:"MainDicomTags"`
		}
		json.Unmarshal(detailResp, &detail)

		for _, serID := range detail.Series {
			serResp, _, err := orthanc.do("GET", "/series/"+serID, nil)
			if err != nil {
				continue
			}
			var ser struct {
				Instances     []string `json:"Instances"`
				MainDicomTags struct {
					Modality string `json:"Modality"`
				} `json:"MainDicomTags"`
			}
			json.Unmarshal(serResp, &ser)
			candidates = append(candidates, AccessionCandidate{
				StudyID:       sid,
				SeriesID:      serID,
				PatientID:     detail.PatientMainDicomTags.PatientID,
				Modality:      ser.MainDicomTags.Modality,
				StudyDate:     detail.MainDicomTags.StudyDate,
				InstanceCount: len(ser.Instances),
				WebViewerURL:  strings.TrimRight(orthancURL, "/") + "/web-viewer/app/viewer.html?series=" + serID,
			})
		}
	}
	return candidates
}

func setAccessionNumberPACS(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		info, err := fetchRadiologyOrderInfo(db, noOrder)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order radiologi tidak ditemukan"})
			return
		}
		orthanc := newOrthancClient(db)

		// Tahap 1 — sudah ada studi yg AccessionNumber-nya = noOrder?
		studyIDs, err := orthancFindIDs(orthanc, map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{"AccessionNumber": noOrder},
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}
		if len(studyIDs) > 0 {
			result := applyAccessionTags(orthanc, studyIDs[0], noOrder, info.NoRkmMedis, info.NmPasien, info.TglLahir, info.JK, info.StudyDesc)
			c.JSON(http.StatusOK, gin.H{"message": result})
			return
		}

		// Tahap 2 — cari by PatientID + StudyDate, TANPA batas jumlah, spy
		// ketahuan kalau ternyata ada >1 studi kandidat (jangan asal pilih).
		if info.NoRkmMedis == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Studi belum ditemukan di Orthanc (No.RM pasien tidak tersedia utk pencarian ulang)"})
			return
		}
		dicomDate := strings.ReplaceAll(info.TglPermintaan, "-", "")
		candidateIDs, err := orthancFindIDs(orthanc, map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{"PatientID": info.NoRkmMedis, "StudyDate": dicomDate},
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}

		if len(candidateIDs) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Studi utk pasien ini belum ditemukan di Orthanc (sudah dicoba by AccessionNumber & by No.RM+tanggal)"})
			return
		}
		if len(candidateIDs) == 1 {
			result := applyAccessionTags(orthanc, candidateIDs[0], noOrder, info.NoRkmMedis, info.NmPasien, info.TglLahir, info.JK, info.StudyDesc)
			c.JSON(http.StatusOK, gin.H{"message": result})
			return
		}

		// Ambigu — >1 studi ketemu utk No.RM+tanggal yg sama, jangan asal
		// pilih (persis kasus tab "Integrasi Orthanc" Khanza yg nampilin >1
		// baris utk 1 No.RM). Kembalikan daftar kandidat, biar user pilih
		// manual lewat confirmAccessionNumberPACS.
		candidates := buildAccessionCandidates(db, orthanc, candidateIDs)
		c.JSON(http.StatusOK, gin.H{
			"ambiguous":  true,
			"message":    fmt.Sprintf("Ditemukan %d studi utk No.RM %s di tanggal %s — pilih salah satu", len(candidateIDs), info.NoRkmMedis, info.TglPermintaan),
			"candidates": candidates,
		})
	}
}

// POST /api/satu-sehat/dicom/set-accession-confirm/*noorder?study_id=X —
// dipanggil setelah user PILIH MANUAL salah satu studi kandidat dari respons
// ambiguous setAccessionNumberPACS di atas.
func confirmAccessionNumberPACS(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		studyID := c.Query("study_id")
		if noOrder == "" || studyID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder dan study_id wajib diisi"})
			return
		}
		info, err := fetchRadiologyOrderInfo(db, noOrder)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order radiologi tidak ditemukan"})
			return
		}
		orthanc := newOrthancClient(db)
		result := applyAccessionTags(orthanc, studyID, noOrder, info.NoRkmMedis, info.NmPasien, info.TglLahir, info.JK, info.StudyDesc)
		if strings.HasPrefix(result, "PACS sync error") {
			c.JSON(http.StatusBadGateway, gin.H{"error": result})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": result})
	}
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
				"hint":  "Lihat panduan konfigurasi di bawah",
			})
			return
		}

		// Step 2 — Cari study di Orthanc berdasarkan AccessionNumber = noorder
		studyIDs, err := orthancFindIDs(orthanc, map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{
				"AccessionNumber": noOrder,
			},
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}

		if len(studyIDs) == 0 {
			c.JSON(http.StatusNotFound, gin.H{
				"error": fmt.Sprintf("Study dengan AccessionNumber '%s' tidak ditemukan di Orthanc", noOrder),
				"hint":  "Pastikan gambar DICOM sudah dikirim dari mesin CR AGFA ke Orthanc",
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
			"message": "DICOM berhasil dikirim ke DICOM Router → Satu Sehat",
			"noorder": noOrder,
			"studies": studyInfoList,
			"count":   len(studyIDs),
		})
	}
}

// GET /api/satu-sehat/dicom/studies/*noorder
// Cek apakah study sudah ada di Orthanc untuk noorder ini
func getDicomStudies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		orthanc := newOrthancClient(db)

		studyIDs, err := orthancFindIDs(orthanc, map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{"AccessionNumber": noOrder},
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

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

// GET /api/satu-sehat/dicom/preview-list/*noorder — daftar instance DICOM
// (Study -> Series -> Instance) dari Orthanc utk AccessionNumber = noorder,
// dipakai modal galeri foto di ModalityWorklist.tsx. Tiap instance ID
// dipakai frontend minta gambar lewat /dicom/preview-image/:instanceId
// (di-proxy, jadi kredensial Orthanc tidak perlu diketahui browser).
func getDicomPreviewList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		orthanc := newOrthancClient(db)

		studyIDs, err := orthancFindIDs(orthanc, map[string]interface{}{
			"Level": "Study",
			"Query": map[string]string{"AccessionNumber": noOrder},
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}

		// Fallback: kalau AccessionNumber belum ketemu (mis. studi lama yg
		// ACSN-nya belum pernah dibetulkan lewat "Kirim ACSN"), cari lebih
		// longgar by PatientID = No.RM — persis pola tbListDicom di Khanza
		// Java lama, yg nampilin SEMUA series pasien itu (lintas kunjungan)
		// biar user pilih sendiri series yg benar dari daftar.
		searchMode := "accession_number"
		if len(studyIDs) == 0 {
			var noRkmMedis string
			db.QueryRow(`
				SELECT IFNULL(rp.no_rkm_medis,'')
				FROM permintaan_radiologi pr
				LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
				WHERE pr.noorder = ?
			`, noOrder).Scan(&noRkmMedis)
			if noRkmMedis != "" {
				fallbackIDs, err2 := orthancFindIDs(orthanc, map[string]interface{}{
					"Level": "Study",
					"Query": map[string]string{"PatientID": noRkmMedis},
				})
				if err2 != nil {
					c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err2.Error()})
					return
				}
				studyIDs = fallbackIDs
				searchMode = "patient_id"
			}
		}

		if len(studyIDs) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Studi dengan AccessionNumber '" + noOrder + "' belum ditemukan di Orthanc (sudah dicoba cari ulang lewat No.RM juga)"})
			return
		}

		type InstanceInfo struct {
			ID       string `json:"id"`
			SeriesID string `json:"series_id"`
			Modality string `json:"modality"`
		}
		// SeriesInfo.WebViewerURL — link ke plugin Web Viewer Orthanc
		// (/web-viewer/app/viewer.html?series=...), viewer DICOM interaktif
		// penuh (zoom/pan/window-level/scroll slice) — persis yg dipakai
		// btnDicomActionPerformed/OrthancDICOM.java di Khanza lama. Dibuka di
		// tab baru dari frontend, BUKAN di-iframe, supaya browser yg urus
		// prompt Basic Auth ke Orthanc secara native (sama seperti embedded
		// browser di Java dulu).
		type SeriesInfo struct {
			SeriesID      string `json:"series_id"`
			Modality      string `json:"modality"`
			StudyDate     string `json:"study_date"`
			InstanceCount int    `json:"instance_count"`
			WebViewerURL  string `json:"webviewer_url"`
		}
		orthancURL := getKonfigurasi(db, "orthanc_url", "http://localhost:8042")
		instances := []InstanceInfo{}
		seriesList := []SeriesInfo{}

		for _, sid := range studyIDs {
			detailResp, _, err := orthanc.do("GET", "/studies/"+sid, nil)
			if err != nil {
				continue
			}
			var detail struct {
				Series        []string `json:"Series"`
				MainDicomTags struct {
					StudyDate string `json:"StudyDate"`
				} `json:"MainDicomTags"`
			}
			json.Unmarshal(detailResp, &detail)

			for _, serID := range detail.Series {
				serResp, _, err := orthanc.do("GET", "/series/"+serID, nil)
				if err != nil {
					continue
				}
				var ser struct {
					Instances     []string `json:"Instances"`
					MainDicomTags struct {
						Modality string `json:"Modality"`
					} `json:"MainDicomTags"`
				}
				json.Unmarshal(serResp, &ser)
				for _, instID := range ser.Instances {
					instances = append(instances, InstanceInfo{ID: instID, SeriesID: serID, Modality: ser.MainDicomTags.Modality})
				}
				seriesList = append(seriesList, SeriesInfo{
					SeriesID:      serID,
					Modality:      ser.MainDicomTags.Modality,
					StudyDate:     detail.MainDicomTags.StudyDate,
					InstanceCount: len(ser.Instances),
					WebViewerURL:  strings.TrimRight(orthancURL, "/") + "/web-viewer/app/viewer.html?series=" + serID,
				})
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder":     noOrder,
			"search_mode": searchMode,
			"total":       len(instances),
			"instances":   instances,
			"series":      seriesList,
		})
	}
}

// GET /api/satu-sehat/dicom/preview-image/:instanceId — proxy gambar PNG
// preview satu instance DICOM dari Orthanc (kredensial Orthanc dipegang
// backend, tidak pernah bocor ke browser).
func getDicomPreviewImage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		instanceID := c.Param("instanceId")
		if instanceID == "" {
			c.Status(http.StatusBadRequest)
			return
		}
		orthanc := newOrthancClient(db)
		data, status, err := orthanc.do("GET", "/instances/"+instanceID+"/preview", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}
		if status != 200 {
			c.JSON(status, gin.H{"error": fmt.Sprintf("Orthanc HTTP %d", status)})
			return
		}
		c.Data(http.StatusOK, "image/png", data)
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
