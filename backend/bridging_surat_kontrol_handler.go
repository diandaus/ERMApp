package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING SURAT KONTROL — bagian 17 spesifikasi VClaim (kontrol lanjutan,
// bukan SPRI Rawat Inap — itu bagian 18, lihat bridging_spri_ranap_handler.go).
//   17.1 Insert Rencana Kontrol   RencanaKontrol/insert
//   17.2 Update Rencana Kontrol   RencanaKontrol/Update
//   17.3 Delete Rencana Kontrol   RencanaKontrol/Delete
//   17.4 Get Jadwal Spesialistik  RencanaKontrol/ListSpesialistik/...
//   17.5 Get Jadwal Dokter        RencanaKontrol/JadwalPraktekDokter/...
//   17.6 Get List Rencana Kontrol RencanaKontrol/ListRencanaKontrol/...
//   17.7 Get Data Surat Kontrol   RencanaKontrol/noSuratKontrol/{no}
//
// Catatan: 17.4/17.5 tetap menerima parameter jnsKontrol (1=SPRI/2=Surat
// Kontrol) sesuai dokumen VClaim asli karena keduanya endpoint PENCARIAN
// murni (proxy langsung, tidak menyentuh tabel lokal apa pun) — tapi INSERT
// & UPDATE di bagian ini (17.1/17.2) khusus Surat Kontrol, disimpan lokal ke
// bridging_surat_kontrol_bpjs. Tabel bridging_surat_pri_bpjs (PRI = Perintah
// Rawat Inap) adalah milik bagian 18, bukan bagian ini.
//
// Validasi yang butuh data jadwal praktik dokter atau poli rujukan FKTP asli
// (17.1.3/4/5/9/10, 17.2.4/5/6/9, 17.2.10, 17.3.2) tidak diterapkan di sini
// karena datanya tidak tersimpan lokal — pesan penolakan BPJS untuk skenario
// ini akan diteruskan apa adanya dari respons vclaimRequest.
// ============================================================================

type RencanaKontrolRequest struct {
	NoSuratKontrol    string `json:"no_surat_kontrol"`
	NoSep             string `json:"no_sep"`
	TglSurat          string `json:"tgl_surat"`
	TglRencanaKontrol string `json:"tgl_rencana_kontrol"`
	KdDokter          string `json:"kd_dokter"`
	NmDokter          string `json:"nm_dokter"`
	KdPoli            string `json:"kd_poli"`
	NmPoli            string `json:"nm_poli"`
	UserEntry         string `json:"user_entry"`
}

// validateRencanaKontrolCommon menerapkan validasi yang bisa dicek dari data
// lokal (format tanggal, keberadaan SEP, urutan tanggal terhadap tgl SEP &
// tgl rujukan) — dipakai bersama oleh insert (17.1) dan update (17.2).
func validateRencanaKontrolCommon(db *sql.DB, r RencanaKontrolRequest) string {
	if strings.TrimSpace(r.NoSep) == "" {
		return "Nomor SEP tidak ditemukan"
	}

	var tglsep, tglrujukan string
	err := db.QueryRow(`SELECT COALESCE(tglsep,'0000-00-00'), COALESCE(tglrujukan,'0000-00-00') FROM bridging_sep WHERE no_sep = ?`, r.NoSep).
		Scan(&tglsep, &tglrujukan)
	if err != nil {
		return "Nomor SEP tidak ditemukan"
	}

	// 17.1.6/17.2.7 — format tanggal rencana kontrol
	tglRencana, errT := time.Parse("2006-01-02", r.TglRencanaKontrol)
	if errT != nil {
		return "Tanggal tidak sesuai"
	}

	// 17.1.7/17.2.8 — tgl rencana kontrol tidak boleh <= tgl pelayanan SEP
	if tglSep, errS := time.Parse("2006-01-02", tglsep); errS == nil {
		if !tglRencana.After(tglSep) {
			return "Tanggal tidak sesuai"
		}
	}

	// 17.1.2/17.1.8/17.2.3 — tgl rencana kontrol tidak boleh melebihi masa
	// berlaku rujukan FKTP (diasumsikan 90 hari sejak tgl rujukan, memakai
	// tglrujukan SEP lokal sebagai proksi tanggal surat rujukan FKTP karena
	// tidak ada tabel rujukan FKTP terpisah yang tersimpan lokal).
	if tglRuj, errR := time.Parse("2006-01-02", tglrujukan); errR == nil && !tglRuj.IsZero() {
		if tglRencana.After(tglRuj.AddDate(0, 0, 90)) {
			return "Masa berlaku rujukan sudah berakhir"
		}
	}

	return ""
}

func upsertRencanaKontrolLocal(db *sql.DB, r RencanaKontrolRequest) error {
	_, err := db.Exec(`
		INSERT INTO bridging_surat_kontrol_bpjs (
			no_surat, no_sep, tgl_surat, tgl_rencana, kd_dokter_bpjs, nm_dokter_bpjs, kd_poli_bpjs, nm_poli_bpjs
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			no_sep=VALUES(no_sep), tgl_surat=VALUES(tgl_surat), tgl_rencana=VALUES(tgl_rencana),
			kd_dokter_bpjs=VALUES(kd_dokter_bpjs), nm_dokter_bpjs=VALUES(nm_dokter_bpjs),
			kd_poli_bpjs=VALUES(kd_poli_bpjs), nm_poli_bpjs=VALUES(nm_poli_bpjs)
	`,
		r.NoSuratKontrol, r.NoSep, r.TglSurat, r.TglRencanaKontrol, r.KdDokter, r.NmDokter, r.KdPoli, r.NmPoli,
	)
	return err
}

// getSuratKontrolList menampilkan data lokal Surat Kontrol untuk tabel UI.
func getSuratKontrolList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")

		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		rows, err := db.Query(`
			SELECT no_surat, COALESCE(no_sep,''), COALESCE(tgl_surat,'0000-00-00'), COALESCE(tgl_rencana,'0000-00-00'),
				COALESCE(kd_dokter_bpjs,''), COALESCE(nm_dokter_bpjs,''), COALESCE(kd_poli_bpjs,''), COALESCE(nm_poli_bpjs,'')
			FROM bridging_surat_kontrol_bpjs WHERE tgl_rencana BETWEEN ? AND ? ORDER BY tgl_rencana DESC LIMIT 500
		`, tglDari, tglSampai)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []RencanaKontrolRequest{}
		for rows.Next() {
			var r RencanaKontrolRequest
			if err := rows.Scan(&r.NoSuratKontrol, &r.NoSep, &r.TglSurat, &r.TglRencanaKontrol, &r.KdDokter, &r.NmDokter, &r.KdPoli, &r.NmPoli); err == nil {
				items = append(items, r)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// createRencanaKontrol menangani 17.1 Insert Rencana Kontrol.
func createRencanaKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r RencanaKontrolRequest
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if errMsg := validateRencanaKontrolCommon(db, r); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rencana_kontrol": map[string]interface{}{
					"noSep":             r.NoSep,
					"kodeDokter":        r.KdDokter,
					"poliKontrol":       r.KdPoli,
					"tglRencanaKontrol": r.TglRencanaKontrol,
					"user":              r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "RencanaKontrol/insert", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if strings.TrimSpace(r.TglSurat) == "" {
			r.TglSurat = time.Now().Format("2006-01-02")
		}
		if err := upsertRencanaKontrolLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Surat kontrol/SPRI berhasil diterbitkan", "response": result})
	}
}

// updateRencanaKontrol menangani 17.2 Update Rencana Kontrol.
func updateRencanaKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r RencanaKontrolRequest
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(r.NoSuratKontrol) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor surat kontrol tidak sesuai"})
			return
		}
		if len(strings.TrimSpace(r.NoSep)) != 19 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP tidak sesuai"})
			return
		}
		if errMsg := validateRencanaKontrolCommon(db, r); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rencana_kontrol": map[string]interface{}{
					"noSuratKontrol":    r.NoSuratKontrol,
					"noSep":             r.NoSep,
					"kodeDokter":        r.KdDokter,
					"poliKontrol":       r.KdPoli,
					"tglRencanaKontrol": r.TglRencanaKontrol,
					"user":              r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "RencanaKontrol/Update", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertRencanaKontrolLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Surat kontrol/SPRI berhasil diperbarui", "response": result})
	}
}

// deleteRencanaKontrol menangani 17.3 Delete Rencana Kontrol dan SPRI.
func deleteRencanaKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSurat := strings.TrimPrefix(c.Param("no_surat"), "/")
		if noSurat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Surat kontrol tidak sesuai"})
			return
		}
		user := c.DefaultQuery("user", "ermapp")

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rencana_kontrol": map[string]interface{}{
					"noSuratKontrol": noSurat,
					"user":           user,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodDelete, "RencanaKontrol/Delete", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if _, err := db.Exec(`DELETE FROM bridging_surat_kontrol_bpjs WHERE no_surat = ?`, noSurat); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Surat kontrol/SPRI berhasil dihapus", "response": result})
	}
}

// getJadwalSpesialistikKontrol menangani 17.4 Get Jadwal Spesialistik.
func getJadwalSpesialistikKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jnsKontrol := c.Query("jns_kontrol")
		nomor := strings.TrimSpace(c.Query("nomor"))
		tgl := strings.TrimSpace(c.Query("tgl_rencana_kontrol"))
		if tgl == "" {
			tgl = time.Now().Format("2006-01-02")
		}

		// 17.4.2 — jnsKontrol=1 (SPRI): nomor harus 13 digit (no. kartu)
		if jnsKontrol == "1" && len(nomor) != 13 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu tidak sesuai"})
			return
		}
		// 17.4.3 — jnsKontrol=2 (surat kontrol): nomor harus 20 digit (no. SEP)
		if jnsKontrol == "2" && len(nomor) != 20 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP tidak sesuai"})
			return
		}

		// 17.4.1 — untuk jnsKontrol=2, tgl rencana kontrol tidak boleh
		// melebihi masa berlaku rujukan FKTP (proksi: tglrujukan SEP lokal + 90 hari)
		if jnsKontrol == "2" {
			var tglrujukan string
			if err := db.QueryRow(`SELECT COALESCE(tglrujukan,'0000-00-00') FROM bridging_sep WHERE no_sep = ?`, nomor).Scan(&tglrujukan); err == nil {
				if tglRuj, errR := time.Parse("2006-01-02", tglrujukan); errR == nil && !tglRuj.IsZero() {
					if tglRencana, errT := time.Parse("2006-01-02", tgl); errT == nil && tglRencana.After(tglRuj.AddDate(0, 0, 90)) {
						c.JSON(http.StatusBadRequest, gin.H{"error": "Masa berlaku rujukan sudah berakhir"})
						return
					}
				}
			}
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "RencanaKontrol/ListSpesialistik/JnsKontrol/" + jnsKontrol + "/nomor/" + nomor + "/TglRencanaKontrol/" + tgl
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"spesialistik": result})
	}
}

// getJadwalDokterKontrol menangani 17.5 Get Jadwal Dokter.
func getJadwalDokterKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jnsKontrol := c.DefaultQuery("jns_kontrol", "2")
		kdPoli := strings.TrimSpace(c.Query("kd_poli"))
		tgl := strings.TrimSpace(c.Query("tgl_rencana_kontrol"))
		if kdPoli == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
			return
		}
		if tgl == "" {
			tgl = time.Now().Format("2006-01-02")
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "RencanaKontrol/JadwalPraktekDokter/JnsKontrol/" + jnsKontrol + "/KdPoli/" + kdPoli + "/TglRencanaKontrol/" + tgl
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"jadwal_dokter": result})
	}
}

// getBpjsListRencanaKontrol menangani 17.6 Get List SEP Rencana Kontrol/SPRI.
func getBpjsListRencanaKontrol(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglAwal := c.Query("tgl_awal")
		tglAkhir := c.Query("tgl_akhir")
		filter := c.DefaultQuery("filter", "1")
		if tglAwal == "" {
			tglAwal = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if tglAkhir == "" {
			tglAkhir = time.Now().Format("2006-01-02")
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "RencanaKontrol/ListRencanaKontrol/tglAwal/" + tglAwal + "/tglAkhir/" + tglAkhir + "/filter/" + filter
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"list": result})
	}
}

// getDetailSuratKontrolBpjs menangani 17.7 Get Data Surat Kontrol/SPRI.
func getDetailSuratKontrolBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSurat := strings.TrimPrefix(c.Param("no_surat"), "/")
		if noSurat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Surat kontrol tidak sesuai"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "RencanaKontrol/noSuratKontrol/"+noSurat, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"surat_kontrol": result})
	}
}
