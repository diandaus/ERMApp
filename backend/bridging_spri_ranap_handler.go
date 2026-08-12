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
// BRIDGING SPRI RAWAT INAP — bagian 18 spesifikasi VClaim: Surat Perintah
// Rawat Inap (SPRI), diterbitkan SEBELUM SEP RITL dibuat (patokan tanggal
// rencana masuk rawat inap). Beda dari bagian 17 (Surat Kontrol lanjutan) —
// SPRI punya endpoint insert/update sendiri (InsertSPRI/UpdateSPRI, bukan
// insert/Update generik RencanaKontrol), disimpan lokal ke
// bridging_surat_pri_bpjs (PRI = Perintah Rawat Inap, sudah ada di skema
// Khanza, persis cocok dengan field-field SPRI).
//   18.1 Insert Rencana Rawat Inap  RencanaKontrol/InsertSPRI
//   18.2 Update Rencana Rawat Inap  RencanaKontrol/UpdateSPRI
//
// Validasi kode poli/kode dokter (18.1.3/18.1.4/18.2.3/18.2.4) di sini hanya
// memastikan field terisi — pengecekan "sesuai" penuh terhadap referensi
// BPJS/jadwal dokter asli butuh panggilan live yang tidak dilakukan di sini;
// pesan penolakan BPJS untuk skenario itu akan diteruskan apa adanya.
// ============================================================================

type SpriRanapRequest struct {
	NoSuratSpri     string `json:"no_surat_spri"`
	NoKartu         string `json:"no_kartu"`
	NoRawat         string `json:"no_rawat"`
	NoSep           string `json:"no_sep"`
	Diagnosa        string `json:"diagnosa"`
	TglSurat        string `json:"tgl_surat"`
	TglRencanaRanap string `json:"tgl_rencana_ranap"`
	KdDokter        string `json:"kd_dokter"`
	NmDokter        string `json:"nm_dokter"`
	KdPoli          string `json:"kd_poli"`
	NmPoli          string `json:"nm_poli"`
	UserEntry       string `json:"user_entry"`
}

// validateSpriRanapCommon menerapkan validasi yang bisa dicek dari data
// lokal, dipakai bersama oleh insert (18.1) dan update (18.2):
//   - 18.1.1/18.2.1 (untuk insert: no. kartu wajib diisi; untuk update: SPRI
//     harus sudah ada — dicek terpisah di masing-masing handler)
//   - 18.1.2/18.2.2: tgl rencana RI harus lebih dari 1 bulan dan kurang dari
//     6 bulan sejak tgl pembuatan SPRI
//   - 18.1.3/18.2.3: kode poli wajib diisi
//   - 18.1.4/18.2.4: kode dokter wajib diisi
func validateSpriRanapCommon(r SpriRanapRequest) string {
	tglSurat, errS := time.Parse("2006-01-02", r.TglSurat)
	tglRencana, errR := time.Parse("2006-01-02", r.TglRencanaRanap)
	if errS != nil || errR != nil {
		return "Tanggal tidak sesuai"
	}
	batasMin := tglSurat.AddDate(0, 1, 0)
	batasMaks := tglSurat.AddDate(0, 6, 0)
	if tglRencana.Before(batasMin) || tglRencana.After(batasMaks) {
		return "Tanggal tidak sesuai"
	}
	if strings.TrimSpace(r.KdPoli) == "" {
		return "Kode poli tidak sesuai"
	}
	if strings.TrimSpace(r.KdDokter) == "" {
		return "Kode dokter tidak sesuai"
	}
	return ""
}

func upsertSpriRanapLocal(db *sql.DB, r SpriRanapRequest) error {
	_, err := db.Exec(`
		INSERT INTO bridging_surat_pri_bpjs (
			no_surat, no_rawat, no_kartu, no_sep, diagnosa, tgl_surat, tgl_rencana,
			kd_dokter_bpjs, nm_dokter_bpjs, kd_poli_bpjs, nm_poli_bpjs
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			no_rawat=VALUES(no_rawat), no_kartu=VALUES(no_kartu), no_sep=VALUES(no_sep),
			diagnosa=VALUES(diagnosa), tgl_surat=VALUES(tgl_surat), tgl_rencana=VALUES(tgl_rencana),
			kd_dokter_bpjs=VALUES(kd_dokter_bpjs), nm_dokter_bpjs=VALUES(nm_dokter_bpjs),
			kd_poli_bpjs=VALUES(kd_poli_bpjs), nm_poli_bpjs=VALUES(nm_poli_bpjs)
	`,
		r.NoSuratSpri, r.NoRawat, r.NoKartu, r.NoSep, r.Diagnosa, r.TglSurat, r.TglRencanaRanap,
		r.KdDokter, r.NmDokter, r.KdPoli, r.NmPoli,
	)
	return err
}

func getSpriRanapList(db *sql.DB) gin.HandlerFunc {
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
			SELECT no_surat, COALESCE(no_rawat,''), COALESCE(no_kartu,''), COALESCE(no_sep,''), COALESCE(diagnosa,''),
				COALESCE(tgl_surat,'0000-00-00'), COALESCE(tgl_rencana,'0000-00-00'),
				COALESCE(kd_dokter_bpjs,''), COALESCE(nm_dokter_bpjs,''), COALESCE(kd_poli_bpjs,''), COALESCE(nm_poli_bpjs,'')
			FROM bridging_surat_pri_bpjs WHERE tgl_rencana BETWEEN ? AND ? ORDER BY tgl_rencana DESC LIMIT 500
		`, tglDari, tglSampai)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []SpriRanapRequest{}
		for rows.Next() {
			var r SpriRanapRequest
			if err := rows.Scan(&r.NoSuratSpri, &r.NoRawat, &r.NoKartu, &r.NoSep, &r.Diagnosa, &r.TglSurat, &r.TglRencanaRanap, &r.KdDokter, &r.NmDokter, &r.KdPoli, &r.NmPoli); err == nil {
				items = append(items, r)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// SpriPasienRow — satu baris SPRI JOIN identitas pasien (lewat reg_periksa +
// pasien LIVE, bukan bridging_sep — SPRI diterbitkan SEBELUM SEP RITL ada,
// jadi belum tentu punya baris bridging_sep utk di-JOIN), kolomnya persis
// tabMode di dialog "Pilih dari SPRI Rawat Inap" (Object[]{"No.Rawat",
// "No.Kartu","No.RM","Nama Pasien","Tgl.Lahir","J.K.","Diagnosa","Tgl.Surat",
// "No.Surat","Tgl.Kontrol","Kode Dokter","Nama Dokter/Sepesialis","Kode
// Poli","Nama Poli/Unit"} + no_sep, dipakai R2 di Java tapi tidak dikasih
// header — tetap disertakan di sini, tidak ada ruginya).
type SpriPasienRow struct {
	NoRawat      string `json:"no_rawat"`
	NoKartu      string `json:"no_kartu"`
	Nomr         string `json:"nomr"`
	NamaPasien   string `json:"nama_pasien"`
	TanggalLahir string `json:"tanggal_lahir"`
	Jkel         string `json:"jkel"`
	Diagnosa     string `json:"diagnosa"`
	TglSurat     string `json:"tgl_surat"`
	NoSurat      string `json:"no_surat"`
	TglRencana   string `json:"tgl_rencana"`
	KdDokterBpjs string `json:"kd_dokter_bpjs"`
	NmDokterBpjs string `json:"nm_dokter_bpjs"`
	KdPoliBpjs   string `json:"kd_poli_bpjs"`
	NmPoliBpjs   string `json:"nm_poli_bpjs"`
	NoSep        string `json:"no_sep"`
}

// getSpriPasienList — dipakai modal "Pilih dari SPRI Rawat Inap" di
// ModalPengajuanSEP.tsx. mode="surat" (padanan radio R1 di Java) filter &
// urut berdasar tgl_surat; mode="kontrol" (padanan R2) filter & urut
// berdasar tgl_rencana — dateCol dipilih dari whitelist tetap di Go, bukan
// diselipkan langsung dari query param, jadi aman dari SQL injection.
// search (padanan TCari) mencocokkan no_rawat/no_kartu/no_rkm_medis/
// nm_pasien/no_surat/nm_poli_bpjs/nm_dokter_bpjs, sama persis 7 kolom yg
// dicek Java.
func getSpriPasienList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		mode := c.DefaultQuery("mode", "surat")
		dateCol := "bridging_surat_pri_bpjs.tgl_surat"
		if mode == "kontrol" {
			dateCol = "bridging_surat_pri_bpjs.tgl_rencana"
		}

		tglDari := c.Query("tgl_dari")
		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		tglSampai := c.Query("tgl_sampai")
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT bridging_surat_pri_bpjs.no_rawat, COALESCE(bridging_surat_pri_bpjs.no_kartu,''), COALESCE(reg_periksa.no_rkm_medis,''),
				COALESCE(pasien.nm_pasien,''), COALESCE(pasien.tgl_lahir,'0000-00-00'), COALESCE(pasien.jk,''),
				COALESCE(bridging_surat_pri_bpjs.diagnosa,''), COALESCE(bridging_surat_pri_bpjs.tgl_surat,'0000-00-00'),
				bridging_surat_pri_bpjs.no_surat, COALESCE(bridging_surat_pri_bpjs.tgl_rencana,'0000-00-00'),
				COALESCE(bridging_surat_pri_bpjs.kd_dokter_bpjs,''), COALESCE(bridging_surat_pri_bpjs.nm_dokter_bpjs,''),
				COALESCE(bridging_surat_pri_bpjs.kd_poli_bpjs,''), COALESCE(bridging_surat_pri_bpjs.nm_poli_bpjs,''),
				COALESCE(bridging_surat_pri_bpjs.no_sep,'')
			FROM reg_periksa
			INNER JOIN bridging_surat_pri_bpjs ON bridging_surat_pri_bpjs.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			WHERE ` + dateCol + ` BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if search != "" {
			query += ` AND (bridging_surat_pri_bpjs.no_rawat LIKE ? OR bridging_surat_pri_bpjs.no_kartu LIKE ? OR reg_periksa.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR bridging_surat_pri_bpjs.no_surat LIKE ? OR bridging_surat_pri_bpjs.nm_poli_bpjs LIKE ?
				OR bridging_surat_pri_bpjs.nm_dokter_bpjs LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY " + dateCol

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []SpriPasienRow{}
		for rows.Next() {
			var r SpriPasienRow
			if err := rows.Scan(
				&r.NoRawat, &r.NoKartu, &r.Nomr, &r.NamaPasien, &r.TanggalLahir, &r.Jkel, &r.Diagnosa,
				&r.TglSurat, &r.NoSurat, &r.TglRencana, &r.KdDokterBpjs, &r.NmDokterBpjs, &r.KdPoliBpjs, &r.NmPoliBpjs, &r.NoSep,
			); err == nil {
				items = append(items, r)
			}
		}
		c.JSON(http.StatusOK, gin.H{"list": items})
	}
}

// createSpriRanap menangani 18.1 Insert Rencana Rawat Inap.
func createSpriRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r SpriRanapRequest
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		// 18.1.1 — noka wajib diisi (validasi "aktif" butuh panggilan live Peserta, tidak dicek di sini)
		if strings.TrimSpace(r.NoKartu) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu tidak sesuai"})
			return
		}
		if strings.TrimSpace(r.TglSurat) == "" {
			r.TglSurat = time.Now().Format("2006-01-02")
		}
		if errMsg := validateSpriRanapCommon(r); errMsg != "" {
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
				"t_spri": map[string]interface{}{
					"noKartu":         r.NoKartu,
					"kodeDokter":      r.KdDokter,
					"poliTujuan":      r.KdPoli,
					"diagnosa":        r.Diagnosa,
					"tglRencanaRanap": r.TglRencanaRanap,
					"user":            r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "RencanaKontrol/InsertSPRI", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertSpriRanapLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SPRI berhasil diterbitkan", "response": result})
	}
}

// updateSpriRanap menangani 18.2 Update Rencana Rawat Inap.
func updateSpriRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r SpriRanapRequest
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(r.NoSuratSpri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SPRI tidak sesuai"})
			return
		}

		// 18.2.1 — SPRI harus sudah ada secara lokal
		var existingNoSep string
		err := db.QueryRow(`SELECT COALESCE(no_sep,'') FROM bridging_surat_pri_bpjs WHERE no_surat = ?`, r.NoSuratSpri).Scan(&existingNoSep)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak sesuai"})
			return
		}

		// 18.2.5 — SPRI sudah dipakai untuk menerbitkan SEP Rawat Inap tidak
		// bisa diupdate lagi (dicek lewat bridging_sep.noskdp yang menyimpan
		// no. SPRI/SKDP saat SEP RITL dibuat, lihat BpjsSep.tsx field "SKDP/SPRI").
		// jnspelayanan="1" = Rawat Inap (dikonfirmasi dari spec resmi Insert
		// SEP 2.0, kebalikan dari asumsi awal).
		var sepCount int
		if err := db.QueryRow(
			`SELECT COUNT(*) FROM bridging_sep WHERE noskdp = ? AND jnspelayanan = '1'`, r.NoSuratSpri,
		).Scan(&sepCount); err == nil && sepCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SPRI sudah digunakan"})
			return
		}

		if strings.TrimSpace(r.TglSurat) == "" {
			r.TglSurat = time.Now().Format("2006-01-02")
		}
		if errMsg := validateSpriRanapCommon(r); errMsg != "" {
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
				"t_spri": map[string]interface{}{
					"noSuratSpri":     r.NoSuratSpri,
					"noKartu":         r.NoKartu,
					"kodeDokter":      r.KdDokter,
					"poliTujuan":      r.KdPoli,
					"diagnosa":        r.Diagnosa,
					"tglRencanaRanap": r.TglRencanaRanap,
					"user":            r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "RencanaKontrol/UpdateSPRI", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertSpriRanapLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SPRI berhasil diperbarui", "response": result})
	}
}
