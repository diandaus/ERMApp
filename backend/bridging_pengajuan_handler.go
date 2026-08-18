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
// BRIDGING PENGAJUAN PENJAMINAN — bagian 11 spesifikasi VClaim:
//   11.1 Pengajuan Penjaminan   {BASE URL}/{Service Name}/SEP/pengajuanSEP
//     - RITL backdate (>3x24 jam sejak masuk rawat)
//     - RJTL backdate
//     - Persetujuan SEP tanpa validasi fingerprint
//   11.2 Aproval Penjaminan     {BASE URL}/{Service Name}/Sep/aprovalSEP
//     - Aproval fingerprint (self-service lewat VClaim)
//     - Aproval backdate TIDAK bisa self-service — harus hubungi Kantor
//       Cabang (KC) BPJS, jadi di sini cukup ditampilkan pesan info tanpa
//       memanggil BPJS.
//
// Tabel bridging_pengajuan_penjaminan tidak ada di skema Khanza — dibuat baru
// di sini untuk menyimpan riwayat pengajuan (dipakai juga untuk validasi
// 11.1.4: cegah pengajuan dobel untuk no. kartu + jenis + tanggal yang sama).
// ============================================================================

func ensureBridgingPengajuanTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS bridging_pengajuan_penjaminan (
			id INT AUTO_INCREMENT PRIMARY KEY,
			no_sep VARCHAR(40) NOT NULL DEFAULT '',
			no_kartu VARCHAR(25) NOT NULL DEFAULT '',
			nama_pasien VARCHAR(100) NOT NULL DEFAULT '',
			jenis_pengajuan ENUM('ritl_backdate','rjtl_backdate','tanpa_fingerprint') NOT NULL,
			tgl_pengajuan DATE NOT NULL,
			tgl_masuk DATE DEFAULT NULL,
			alasan VARCHAR(500) NOT NULL DEFAULT '',
			status ENUM('diajukan','disetujui','ditolak') NOT NULL DEFAULT 'diajukan',
			catatan_approval VARCHAR(500) NOT NULL DEFAULT '',
			respon_bpjs TEXT,
			user_entry VARCHAR(50) NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			KEY idx_dedup (no_kartu, jenis_pengajuan, tgl_pengajuan)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createTable)
	return err
}

type PengajuanPenjaminan struct {
	ID             int    `json:"id"`
	NoSep          string `json:"no_sep"`
	NoKartu        string `json:"no_kartu"`
	NamaPasien     string `json:"nama_pasien"`
	JenisPengajuan string `json:"jenis_pengajuan"`
	TglPengajuan   string `json:"tgl_pengajuan"`
	TglMasuk       string `json:"tgl_masuk"`
	// TglSep/JnsPelayanan — dikirim ke BPJS (t_sep.tglSep/jnsPelayanan),
	// TIDAK disimpan ke tabel lokal (cukup no_kartu+jenis+tgl_pengajuan utk
	// dedup 11.1.4) — beda dari TglPengajuan (tanggal STAF mengajukan,
	// dipakai validasi 11.1.5) dan TglMasuk (dipakai validasi 11.1.1 RITL).
	TglSep          string `json:"tgl_sep"`
	JnsPelayanan    string `json:"jns_pelayanan"`
	Alasan          string `json:"alasan"`
	Status          string `json:"status"`
	CatatanApproval string `json:"catatan_approval"`
	UserEntry       string `json:"user_entry"`
	CreatedAt       string `json:"created_at"`
}

func getPengajuanPenjaminanList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		search := c.Query("search")

		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		query := `
			SELECT id, no_sep, no_kartu, nama_pasien, jenis_pengajuan, tgl_pengajuan,
				COALESCE(tgl_masuk,'0000-00-00'), alasan, status, catatan_approval, user_entry, created_at
			FROM bridging_pengajuan_penjaminan
			WHERE tgl_pengajuan BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if search != "" {
			query += ` AND (no_sep LIKE ? OR no_kartu LIKE ? OR nama_pasien LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += ` ORDER BY created_at DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []PengajuanPenjaminan{}
		for rows.Next() {
			var p PengajuanPenjaminan
			if err := rows.Scan(
				&p.ID, &p.NoSep, &p.NoKartu, &p.NamaPasien, &p.JenisPengajuan, &p.TglPengajuan,
				&p.TglMasuk, &p.Alasan, &p.Status, &p.CatatanApproval, &p.UserEntry, &p.CreatedAt,
			); err != nil {
				continue
			}
			items = append(items, p)
		}
		c.JSON(http.StatusOK, items)
	}
}

// submitPengajuanPenjaminan menangani 11.1 Pengajuan Penjaminan.
func submitPengajuanPenjaminan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PengajuanPenjaminan
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(p.NoKartu) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu wajib diisi"})
			return
		}
		if p.JenisPengajuan != "ritl_backdate" && p.JenisPengajuan != "rjtl_backdate" && p.JenisPengajuan != "tanpa_fingerprint" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pengajuan tidak sesuai"})
			return
		}
		if strings.TrimSpace(p.TglPengajuan) == "" {
			p.TglPengajuan = time.Now().Format("2006-01-02")
		}
		if strings.TrimSpace(p.TglSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tgl. SEP wajib diisi"})
			return
		}
		if p.JnsPelayanan != "1" && p.JnsPelayanan != "2" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pelayanan tidak sesuai"})
			return
		}

		// 11.1.5 — tgl pengajuan tidak boleh melebihi tanggal hari ini
		if tglPengajuan, err := time.Parse("2006-01-02", p.TglPengajuan); err == nil {
			today, _ := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
			if tglPengajuan.After(today) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pengajuan tidak sesuai"})
				return
			}
		}

		// 11.1.1 — RITL backdate hanya berlaku kalau sudah lebih dari 3x24 jam sejak tgl masuk
		if p.JenisPengajuan == "ritl_backdate" {
			if strings.TrimSpace(p.TglMasuk) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal masuk rawat wajib diisi untuk pengajuan RITL backdate"})
				return
			}
			tglMasuk, errM := time.Parse("2006-01-02", p.TglMasuk)
			tglPengajuan, errP := time.Parse("2006-01-02", p.TglPengajuan)
			if errM == nil && errP == nil && tglPengajuan.Sub(tglMasuk) < 72*time.Hour {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Pengajuan RITL backdate hanya berlaku jika lebih dari 3x24 jam sejak tanggal masuk"})
				return
			}
		}

		// 11.1.4 — no. kartu sudah dibuatkan jenis pengajuan yang sama di tanggal yang sama
		var dupCount int
		if err := db.QueryRow(
			`SELECT COUNT(*) FROM bridging_pengajuan_penjaminan WHERE no_kartu = ? AND jenis_pengajuan = ? AND tgl_pengajuan = ? AND status <> 'ditolak'`,
			p.NoKartu, p.JenisPengajuan, p.TglPengajuan,
		).Scan(&dupCount); err == nil && dupCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Peserta sudah dibuatkan pengajuan backdate/finger print"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Spec resmi VClaim 11.1 Pengajuan Penjaminan: jnsPengajuan cuma 2
		// nilai (1=backdate, 2=finger print) — RITL/RJTL backdate SAMA-SAMA
		// kirim "1" ke BPJS, bedanya cuma di validasi LOKAL 11.1.1 (RITL
		// wajib >3x24 jam) yg sudah dicek di atas.
		jnsPengajuan := map[string]string{"ritl_backdate": "1", "rjtl_backdate": "1", "tanpa_fingerprint": "2"}[p.JenisPengajuan]
		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_sep": map[string]interface{}{
					"noKartu":      p.NoKartu,
					"tglSep":       p.TglSep,
					"jnsPelayanan": p.JnsPelayanan,
					"jnsPengajuan": jnsPengajuan,
					"keterangan":   p.Alasan,
					"user":         p.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, bpjsErr := vclaimRequest(cfg, http.MethodPost, "SEP/pengajuanSEP", bodyJSON)

		respJSON := ""
		status := "diajukan"
		catatan := ""
		if bpjsErr != nil {
			status = "ditolak"
			catatan = bpjsErr.Error()
		} else if resultBytes, errM := json.Marshal(result); errM == nil {
			respJSON = string(resultBytes)
		}

		_, dbErr := db.Exec(`
			INSERT INTO bridging_pengajuan_penjaminan (
				no_sep, no_kartu, nama_pasien, jenis_pengajuan, tgl_pengajuan, tgl_masuk,
				alasan, status, catatan_approval, respon_bpjs, user_entry
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			p.NoSep, p.NoKartu, p.NamaPasien, p.JenisPengajuan, p.TglPengajuan, nullIfEmptyDate(p.TglMasuk),
			p.Alasan, status, catatan, respJSON, p.UserEntry,
		)
		if dbErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": dbErr.Error()})
			return
		}

		if bpjsErr != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": bpjsErr.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengajuan penjaminan berhasil dikirim", "response": result})
	}
}

// approvalPengajuanPenjaminan menangani 11.2 Aproval Penjaminan.
func approvalPengajuanPenjaminan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			ID      int    `json:"id"`
			NoSep   string `json:"no_sep"`
			NoKartu string `json:"no_kartu"`
			User    string `json:"user_entry"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if body.ID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data pengajuan tidak ditemukan"})
			return
		}

		var jenisPengajuan, noSep, noKartu, status string
		err := db.QueryRow(
			`SELECT jenis_pengajuan, no_sep, no_kartu, status FROM bridging_pengajuan_penjaminan WHERE id = ?`,
			body.ID,
		).Scan(&jenisPengajuan, &noSep, &noKartu, &status)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pengajuan tidak ditemukan"})
			return
		}
		if status == "disetujui" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pengajuan sudah disetujui sebelumnya"})
			return
		}

		// 11.2.2 — aproval backdate tidak bisa self-service, harus hubungi KC
		if jenisPengajuan == "ritl_backdate" || jenisPengajuan == "rjtl_backdate" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Aproval backdate harus menghubungi Kantor Cabang (KC) BPJS"})
			return
		}

		if body.NoSep == "" {
			body.NoSep = noSep
		}
		if body.NoKartu == "" {
			body.NoKartu = noKartu
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 11.2.1 — aproval penjaminan fingerprint
		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_aproval": map[string]interface{}{
					"noKartu": body.NoKartu,
					"noSep":   body.NoSep,
					"user":    body.User,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, bpjsErr := vclaimRequest(cfg, http.MethodPost, "Sep/aprovalSEP", bodyJSON)
		if bpjsErr != nil {
			db.Exec(`UPDATE bridging_pengajuan_penjaminan SET status='ditolak', catatan_approval=? WHERE id=?`, bpjsErr.Error(), body.ID)
			c.JSON(http.StatusBadGateway, gin.H{"error": bpjsErr.Error()})
			return
		}

		if _, err := db.Exec(
			`UPDATE bridging_pengajuan_penjaminan SET status='disetujui', catatan_approval='Disetujui via fingerprint' WHERE id=?`,
			body.ID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Penjaminan berhasil disetujui", "response": result})
	}
}

// AprovalSepRequest — body POST /api/bridging/sep/aproval-langsung.
type AprovalSepRequest struct {
	NoKartu      string `json:"no_kartu"`
	NamaPasien   string `json:"nama_pasien"`
	TglSep       string `json:"tgl_sep"`
	JnsPelayanan string `json:"jns_pelayanan"`
	// JnsPengajuan opsional — sesuai spec resmi: kalau kosong/tidak
	// dikirim, BPJS default ke "1" (Aproval Backdate); kalau diisi, aproval
	// mengikuti jenis itu ("1"=backdate, "2"=finger print). Tombol "Aproval
	// SEP Finger" di ModalPengajuanSEP.tsx selalu kirim "2" eksplisit.
	JnsPengajuan string `json:"jns_pengajuan"`
	Keterangan   string `json:"keterangan"`
	UserEntry    string `json:"user_entry"`
}

// aprovalSepLangsung menangani 11.2 Aproval Penjaminan versi "langsung dari
// form SEP" (dipicu tombol di ModalPengajuanSEP.tsx), BEDA dari
// approvalPengajuanPenjaminan di atas yang meng-approve baris pengajuan yg
// SUDAH ada di tabel lokal (dipakai modul daftar BpjsPengajuanPenjaminan.tsx)
// — di sini tidak perlu ada pengajuan lokal sebelumnya, staf langsung minta
// aproval ke BPJS dgn data dari form SEP yg sedang dibuka. Tetap dicatat ke
// tabel bridging_pengajuan_penjaminan (status langsung 'disetujui') supaya
// riwayatnya tetap kelihatan di daftar yang sama.
func aprovalSepLangsung(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body AprovalSepRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.NoKartu) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu wajib diisi"})
			return
		}
		if strings.TrimSpace(body.TglSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tgl. SEP wajib diisi"})
			return
		}
		if body.JnsPelayanan != "1" && body.JnsPelayanan != "2" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pelayanan tidak sesuai"})
			return
		}
		if body.JnsPengajuan != "" && body.JnsPengajuan != "1" && body.JnsPengajuan != "2" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pengajuan tidak sesuai"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tSep := map[string]interface{}{
			"noKartu":      body.NoKartu,
			"tglSep":       body.TglSep,
			"jnsPelayanan": body.JnsPelayanan,
			"keterangan":   body.Keterangan,
			"user":         body.UserEntry,
		}
		if body.JnsPengajuan != "" {
			tSep["jnsPengajuan"] = body.JnsPengajuan
		}
		bodyJSON, err := json.Marshal(map[string]interface{}{"request": map[string]interface{}{"t_sep": tSep}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, bpjsErr := vclaimRequest(cfg, http.MethodPost, "Sep/aprovalSEP", bodyJSON)

		respJSON := ""
		status := "disetujui"
		catatan := "Disetujui langsung dari form SEP"
		if bpjsErr != nil {
			status = "ditolak"
			catatan = bpjsErr.Error()
		} else if resultBytes, errM := json.Marshal(result); errM == nil {
			respJSON = string(resultBytes)
		}

		jenisPengajuanLokal := "tanpa_fingerprint"
		if body.JnsPengajuan == "1" {
			jenisPengajuanLokal = "ritl_backdate"
		}
		db.Exec(`
			INSERT INTO bridging_pengajuan_penjaminan (
				no_kartu, nama_pasien, jenis_pengajuan, tgl_pengajuan,
				alasan, status, catatan_approval, respon_bpjs, user_entry
			) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)
		`,
			body.NoKartu, body.NamaPasien, jenisPengajuanLokal,
			body.Keterangan, status, catatan, respJSON, body.UserEntry,
		)

		if bpjsErr != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": bpjsErr.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Aproval SEP berhasil dikirim ke BPJS", "response": result})
	}
}

// getPersetujuanSepList menangani "List Data Persetujuan SEP New"
// (GET Sep/persetujuanSEP/list/bulan/{bulan}/tahun/{tahun}) — laporan
// bulanan riwayat pengajuan/aproval SEP backdate & finger print LANGSUNG
// dari BPJS (beda dari tabel lokal bridging_pengajuan_penjaminan yang cuma
// mencatat apa yang diajukan lewat aplikasi ini; endpoint ini otoritatif
// dari sisi BPJS, termasuk pengajuan yang mungkin dibuat lewat kanal lain).
func getPersetujuanSepList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		bulan := strings.TrimSpace(c.Query("bulan"))
		tahun := strings.TrimSpace(c.Query("tahun"))
		if bulan == "" || tahun == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bulan dan tahun wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Sep/persetujuanSEP/list/bulan/" + bulan + "/tahun/" + tahun
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}
