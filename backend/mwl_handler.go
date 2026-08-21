package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Handlers ─────────────────────────────────────────────────────────────────

type MWLCandidateRow struct {
	NoOrder         string   `json:"noorder"`
	NoRawat         string   `json:"no_rawat"`
	TglPermintaan   string   `json:"tgl_permintaan"`
	JamPermintaan   string   `json:"jam_permintaan"`
	NmPasien        string   `json:"nm_pasien"`
	NoRkmMedis      string   `json:"no_rkm_medis"`
	NmDokter        string   `json:"nm_dokter"`
	DiagnosaKlinis  string   `json:"diagnosa_klinis"`
	Pemeriksaan     []string `json:"pemeriksaan"`
	MWLStatus       string   `json:"mwl_status"`
	AccessionNumber string   `json:"accession_number"`
}

// GET /api/satu-sehat/mwl?tgl_dari=&tgl_sampai=&q=&status= — daftar order
// radiologi + status pengiriman ke Modality Worklist Orthanc. AccessionNumber
// diisi otomatis oleh sendToMWL (tidak pernah diketik manual), formatnya
// noorder+kd_jenis_prw kalau order cuma py 1 jenis pemeriksaan — lihat
// khanzaAccessionNumber di dicom_handler.go.
func getMWLCandidates(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))
		keyword := strings.TrimSpace(c.Query("q"))
		statusFilter := c.Query("status")

		query := `
			SELECT
				pr.noorder, pr.no_rawat, IFNULL(pr.tgl_permintaan,''), IFNULL(pr.jam_permintaan,'') as jam_permintaan,
				IFNULL(p.nm_pasien,'') as nm_pasien, IFNULL(rp.no_rkm_medis,'') as no_rkm_medis,
				IFNULL(d.nm_dokter,'') as nm_dokter, IFNULL(pr.diagnosa_klinis,'') as diagnosa_klinis,
				IFNULL(mwl.status,'') as mwl_status, IFNULL(mwl.accession_number,'') as accession_number
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
			LEFT JOIN satu_sehat_mwl_radiologi mwl ON mwl.noorder = pr.noorder
			WHERE pr.tgl_permintaan BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (pr.noorder LIKE ? OR pr.no_rawat LIKE ? OR p.nm_pasien LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw)
		}
		switch statusFilter {
		case "terkirim":
			query += ` AND mwl.status = 'terkirim'`
		case "belum":
			query += ` AND (mwl.status IS NULL OR mwl.status <> 'terkirim')`
		}
		query += " ORDER BY pr.tgl_permintaan DESC, pr.noorder DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MWLCandidateRow{}
		for rows.Next() {
			var r MWLCandidateRow
			if err := rows.Scan(&r.NoOrder, &r.NoRawat, &r.TglPermintaan, &r.JamPermintaan,
				&r.NmPasien, &r.NoRkmMedis, &r.NmDokter, &r.DiagnosaKlinis,
				&r.MWLStatus, &r.AccessionNumber); err != nil {
				continue
			}
			list = append(list, r)
		}
		for i := range list {
			pRows, err := db.Query(`
				SELECT IFNULL(jpr.nm_perawatan, ppr.kd_jenis_prw)
				FROM permintaan_pemeriksaan_radiologi ppr
				LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
				WHERE ppr.noorder = ?
			`, list[i].NoOrder)
			if err != nil {
				list[i].Pemeriksaan = []string{}
				continue
			}
			for pRows.Next() {
				var nm string
				pRows.Scan(&nm)
				list[i].Pemeriksaan = append(list[i].Pemeriksaan, nm)
			}
			pRows.Close()
			if list[i].Pemeriksaan == nil {
				list[i].Pemeriksaan = []string{}
			}
		}

		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// POST /api/satu-sehat/mwl/send/*noorder — bikin entry Modality Worklist lewat
// REST API Orthanc (POST /worklists/create, plugin Worklists v0.9+ dgn
// "SaveInOrthancDatabase": true di orthanc.json). Dulu ditulis sbg file .wl ke
// filesystem lokal tempat backend Go ini jalan — pecah kalau Orthanc-nya di
// server LAIN (kasus nyata di sini: app di 192.168.1.220, Orthanc di
// 192.168.1.174, tidak ada network share). Lewat REST API, worklist tersimpan
// langsung di database Orthanc, tidak butuh akses filesystem sama sekali.
func sendToMWL(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		// Ambil data order + pasien
		var (
			noRawat       string
			tglPermintaan string
			jamPermintaan string
			noRkmMedis    string
			nmPasien      string
			tglLahir      sql.NullString
			jk            sql.NullString
		)
		err := db.QueryRow(`
			SELECT
				pr.no_rawat,
				pr.tgl_permintaan,
				IFNULL(TIME_FORMAT(pr.jam_permintaan,'%H%i%s'),'080000') as jam,
				IFNULL(rp.no_rkm_medis,'') as no_rkm_medis,
				IFNULL(p.nm_pasien,'UNKNOWN') as nm_pasien,
				p.tgl_lahir,
				p.jk
			FROM permintaan_radiologi pr
			LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat
			LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			WHERE pr.noorder = ?
		`, noOrder).Scan(&noRawat, &tglPermintaan, &jamPermintaan, &noRkmMedis, &nmPasien, &tglLahir, &jk)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
			return
		}

		// Ambil daftar pemeriksaan + modality dari mapping
		rows, err := db.Query(`
			SELECT
				ppr.kd_jenis_prw,
				IFNULL(jpr.nm_perawatan,'') as nm_perawatan,
				IFNULL(m.modality_code,'DX') as modality_code
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

		type mwlStep struct {
			Modality                           string `json:"Modality"`
			ScheduledStationAETitle            string `json:"ScheduledStationAETitle"`
			ScheduledProcedureStepStartDate    string `json:"ScheduledProcedureStepStartDate"`
			ScheduledProcedureStepStartTime    string `json:"ScheduledProcedureStepStartTime"`
			ScheduledProcedureStepDescription  string `json:"ScheduledProcedureStepDescription"`
			ScheduledProcedureStepID           string `json:"ScheduledProcedureStepID"`
		}
		var steps []mwlStep
		for rows.Next() {
			var kdJenisPrw, nmPerawatan, modalityCode string
			rows.Scan(&kdJenisPrw, &nmPerawatan, &modalityCode)
			steps = append(steps, mwlStep{
				Modality:                          modalityCode,
				ScheduledStationAETitle:           "MODALITY",
				ScheduledProcedureStepStartDate:   strings.ReplaceAll(tglPermintaan, "-", ""),
				ScheduledProcedureStepStartTime:   jamPermintaan,
				ScheduledProcedureStepDescription: nmPerawatan,
				ScheduledProcedureStepID:          noOrder + "-" + kdJenisPrw,
			})
		}
		if len(steps) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada pemeriksaan untuk order ini"})
			return
		}

		// Konversi jenis kelamin Khanza (L/P) → DICOM (M/F)
		sex := "O"
		if jk.Valid {
			switch strings.ToUpper(jk.String) {
			case "L":
				sex = "M"
			case "P":
				sex = "F"
			}
		}

		// Konversi tanggal lahir
		birthDate := ""
		if tglLahir.Valid && tglLahir.String != "" && tglLahir.String != "0000-00-00" {
			birthDate = strings.ReplaceAll(tglLahir.String, "-", "")
		}

		accessionNumber := khanzaAccessionNumber(db, noOrder)

		tags := map[string]interface{}{
			"PatientID":                      noRkmMedis,
			"PatientName":                    nmPasien,
			"PatientBirthDate":               birthDate,
			"PatientSex":                     sex,
			"AccessionNumber":                accessionNumber,
			"RequestedProcedureID":           accessionNumber,
			"ScheduledProcedureStepSequence": steps,
		}

		orthanc := newOrthancClient(db)
		resp, status, err := orthanc.do("POST", "/worklists/create", map[string]interface{}{"Tags": tags})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi Orthanc: " + err.Error()})
			return
		}
		if status != 200 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Orthanc HTTP %d saat /worklists/create — %s", status, truncateOrthancMsg(resp))})
			return
		}
		var created struct {
			ID string `json:"ID"`
		}
		json.Unmarshal(resp, &created)

		// Simpan status ke DB — worklist_file skrg nyimpen ID worklist Orthanc
		// (dulu path file lokal), dipakai lagi utk DELETE /worklists/{id}.
		db.Exec(`
			INSERT INTO satu_sehat_mwl_radiologi (noorder, accession_number, worklist_file, status)
			VALUES (?, ?, ?, 'terkirim')
			ON DUPLICATE KEY UPDATE
				accession_number = VALUES(accession_number),
				worklist_file = VALUES(worklist_file),
				status = 'terkirim',
				updated_at = NOW()
		`, noOrder, accessionNumber, created.ID)

		c.JSON(http.StatusOK, gin.H{
			"message":          "Order berhasil dikirim ke MWL",
			"noorder":          noOrder,
			"accession_number": accessionNumber,
			"worklist_id":      created.ID,
			"steps":            len(steps),
		})
	}
}

// DELETE /api/satu-sehat/mwl/*noorder — hapus dari worklist (cancel), lewat
// REST API Orthanc (worklist_file kolom nyimpen ID worklist Orthanc, bukan
// path file lokal lagi — lihat sendToMWL).
func deleteMWLEntry(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		var worklistID string
		db.QueryRow(`SELECT worklist_file FROM satu_sehat_mwl_radiologi WHERE noorder=?`, noOrder).Scan(&worklistID)
		if worklistID != "" {
			orthanc := newOrthancClient(db)
			orthanc.do("DELETE", "/worklists/"+worklistID, nil)
		}
		db.Exec(`UPDATE satu_sehat_mwl_radiologi SET status='dibatalkan' WHERE noorder=?`, noOrder)
		c.JSON(http.StatusOK, gin.H{"message": "Worklist entry dihapus"})
	}
}

// GET /api/satu-sehat/mwl/status/*noorder — cek status MWL untuk satu order
func getMWLStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		var status, createdAt sql.NullString
		db.QueryRow(`SELECT status, created_at FROM satu_sehat_mwl_radiologi WHERE noorder=?`, noOrder).
			Scan(&status, &createdAt)
		c.JSON(http.StatusOK, gin.H{
			"noorder":    noOrder,
			"status":     status.String,
			"created_at": createdAt.String,
		})
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func getKonfigurasi(db *sql.DB, kode, defaultVal string) string {
	var val string
	err := db.QueryRow(`SELECT nilai FROM satu_sehat_konfigurasi WHERE kode = ?`, kode).Scan(&val)
	if err != nil || val == "" {
		return defaultVal
	}
	return val
}
