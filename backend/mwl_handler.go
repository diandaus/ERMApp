package main

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type WLData struct {
	SopInstanceUID      string
	StudyInstanceUID    string
	AccessionNumber     string
	PatientName         string
	PatientID           string
	PatientBirthDate    string // YYYYMMDD
	PatientSex          string // M / F / O
	Steps               []WLStep
}

type WLStep struct {
	Modality            string
	StationAETitle      string
	StartDate           string // YYYYMMDD
	StartTime           string // HHMMSS
	PerformingPhysician string
	Description         string
	StepID              string
}

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

// POST /api/satu-sehat/mwl/send/*noorder
func sendToMWL(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		worklistDir := getKonfigurasi(db, "orthanc_worklist_dir", "/etc/orthanc/worklists")

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

		var steps []WLStep
		for rows.Next() {
			var kdJenisPrw, nmPerawatan, modalityCode string
			rows.Scan(&kdJenisPrw, &nmPerawatan, &modalityCode)
			steps = append(steps, WLStep{
				Modality:       modalityCode,
				StationAETitle: "MODALITY",
				StartDate:      strings.ReplaceAll(tglPermintaan, "-", ""),
				StartTime:      jamPermintaan,
				Description:    nmPerawatan,
				StepID:         noOrder + "-" + kdJenisPrw,
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

		wlData := WLData{
			SopInstanceUID:   generateDicomUID(),
			StudyInstanceUID: generateDicomUID(),
			AccessionNumber:  accessionNumber,
			PatientName:      nmPasien,
			PatientID:        noRkmMedis,
			PatientBirthDate: birthDate,
			PatientSex:       sex,
			Steps:            steps,
		}

		// Buat file DICOM WL
		wlBytes, err := createDicomWLFile(wlData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat file WL: " + err.Error()})
			return
		}

		// Tulis ke direktori Orthanc worklist
		if err := os.MkdirAll(worklistDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Direktori worklist tidak dapat diakses: " + err.Error()})
			return
		}
		filename := filepath.Join(worklistDir, noOrder+".wl")
		if err := os.WriteFile(filename, wlBytes, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file WL: " + err.Error()})
			return
		}

		// Simpan status ke DB
		db.Exec(`
			INSERT INTO satu_sehat_mwl_radiologi (noorder, accession_number, worklist_file, status)
			VALUES (?, ?, ?, 'terkirim')
			ON DUPLICATE KEY UPDATE
				accession_number = VALUES(accession_number),
				worklist_file = VALUES(worklist_file),
				status = 'terkirim',
				updated_at = NOW()
		`, noOrder, accessionNumber, filename)

		c.JSON(http.StatusOK, gin.H{
			"message":          "Order berhasil dikirim ke MWL",
			"noorder":          noOrder,
			"accession_number": accessionNumber,
			"filename":         filename,
			"steps":            len(steps),
		})
	}
}

// DELETE /api/satu-sehat/mwl/*noorder — hapus dari worklist (cancel)
func deleteMWLEntry(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := strings.TrimPrefix(c.Param("noorder"), "/")
		worklistDir := getKonfigurasi(db, "orthanc_worklist_dir", "/etc/orthanc/worklists")
		filename := filepath.Join(worklistDir, noOrder+".wl")
		os.Remove(filename)
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

// ─── DICOM WL File Creator ────────────────────────────────────────────────────

type dcmWriter struct {
	buf bytes.Buffer
}

func (d *dcmWriter) writeElement(group, elem uint16, vr string, val []byte) {
	// Pad value to even length
	padded := make([]byte, len(val))
	copy(padded, val)
	if len(padded)%2 != 0 {
		if vr == "UI" {
			padded = append(padded, 0x00)
		} else {
			padded = append(padded, 0x20)
		}
	}
	binary.Write(&d.buf, binary.LittleEndian, group)
	binary.Write(&d.buf, binary.LittleEndian, elem)
	d.buf.WriteString(vr)
	switch vr {
	case "OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UN", "UR", "UT":
		d.buf.Write([]byte{0x00, 0x00}) // reserved
		binary.Write(&d.buf, binary.LittleEndian, uint32(len(padded)))
	default:
		binary.Write(&d.buf, binary.LittleEndian, uint16(len(padded)))
	}
	d.buf.Write(padded)
}

func (d *dcmWriter) str(group, elem uint16, vr, val string) {
	d.writeElement(group, elem, vr, []byte(val))
}

func (d *dcmWriter) uint32Val(group, elem uint16, val uint32) {
	b := make([]byte, 4)
	binary.LittleEndian.PutUint32(b, val)
	d.writeElement(group, elem, "UL", b)
}

func (d *dcmWriter) sq(group, elem uint16, items [][]byte) {
	binary.Write(&d.buf, binary.LittleEndian, group)
	binary.Write(&d.buf, binary.LittleEndian, elem)
	d.buf.WriteString("SQ")
	d.buf.Write([]byte{0x00, 0x00})           // reserved
	d.buf.Write([]byte{0xFF, 0xFF, 0xFF, 0xFF}) // undefined length

	for _, item := range items {
		// Item tag (FFFE,E000)
		d.buf.Write([]byte{0xFE, 0xFF, 0x00, 0xE0})
		binary.Write(&d.buf, binary.LittleEndian, uint32(len(item)))
		d.buf.Write(item)
	}

	// Sequence delimiter (FFFE,E0DD)
	d.buf.Write([]byte{0xFE, 0xFF, 0xDD, 0xE0, 0x00, 0x00, 0x00, 0x00})
}

func createDicomWLFile(data WLData) ([]byte, error) {
	sopClass := "1.2.840.10008.5.1.4.31"
	transferSyntax := "1.2.840.10008.1.2.1"
	implUID := "1.2.3.999.1"

	// ── Meta header ───────────────────────────────────────────────────────────
	var meta dcmWriter
	meta.writeElement(0x0002, 0x0001, "OB", []byte{0x00, 0x01}) // FileMetaVersion
	meta.str(0x0002, 0x0002, "UI", sopClass)
	meta.str(0x0002, 0x0003, "UI", data.SopInstanceUID)
	meta.str(0x0002, 0x0010, "UI", transferSyntax)
	meta.str(0x0002, 0x0012, "UI", implUID)
	metaBytes := meta.buf.Bytes()

	// (0002,0000) group length = byte count of everything after it in meta
	var groupLen dcmWriter
	b := make([]byte, 4)
	binary.LittleEndian.PutUint32(b, uint32(len(metaBytes)))
	groupLen.writeElement(0x0002, 0x0000, "UL", b)

	// ── Dataset ───────────────────────────────────────────────────────────────
	var ds dcmWriter
	ds.str(0x0008, 0x0005, "CS", "ISO_IR 192")          // SpecificCharacterSet
	ds.str(0x0008, 0x0050, "SH", data.AccessionNumber)  // AccessionNumber
	ds.str(0x0010, 0x0010, "PN", data.PatientName)       // PatientName
	ds.str(0x0010, 0x0020, "LO", data.PatientID)         // PatientID
	ds.str(0x0010, 0x0030, "DA", data.PatientBirthDate)  // PatientBirthDate
	ds.str(0x0010, 0x0040, "CS", data.PatientSex)        // PatientSex
	ds.str(0x0020, 0x000D, "UI", data.StudyInstanceUID)  // StudyInstanceUID

	// ScheduledProcedureStepSequence (0040,0100)
	var items [][]byte
	for _, step := range data.Steps {
		var item dcmWriter
		item.str(0x0008, 0x0060, "CS", step.Modality)
		item.str(0x0040, 0x0001, "AE", step.StationAETitle)
		item.str(0x0040, 0x0002, "DA", step.StartDate)
		item.str(0x0040, 0x0003, "TM", step.StartTime)
		item.str(0x0040, 0x0006, "PN", step.PerformingPhysician)
		item.str(0x0040, 0x0007, "LO", step.Description)
		item.str(0x0040, 0x0009, "SH", step.StepID)
		items = append(items, item.buf.Bytes())
	}
	ds.sq(0x0040, 0x0100, items)
	ds.str(0x0040, 0x1001, "SH", data.AccessionNumber) // RequestedProcedureID

	// ── Assemble ──────────────────────────────────────────────────────────────
	var file bytes.Buffer
	file.Write(make([]byte, 128)) // Preamble
	file.WriteString("DICM")     // Magic
	file.Write(groupLen.buf.Bytes())
	file.Write(metaBytes)
	file.Write(ds.buf.Bytes())
	return file.Bytes(), nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func generateDicomUID() string {
	t := time.Now().UnixNano()
	r := rand.Int63n(1000000)
	uid := fmt.Sprintf("2.25.%d%06d", t, r)
	if len(uid) > 64 {
		uid = uid[:64]
	}
	return uid
}

func getKonfigurasi(db *sql.DB, kode, defaultVal string) string {
	var val string
	err := db.QueryRow(`SELECT nilai FROM satu_sehat_konfigurasi WHERE kode = ?`, kode).Scan(&val)
	if err != nil || val == "" {
		return defaultVal
	}
	return val
}
