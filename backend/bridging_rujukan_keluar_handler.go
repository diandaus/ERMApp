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
// BRIDGING RUJUKAN KELUAR — bagian 13 spesifikasi VClaim: pembuatan rujukan
// dari fasilitas ini ke fasilitas lain (berbeda dari bridging_rujukan_handler.go
// yang mencari rujukan MASUK dari Faskes I/II saat membuat SEP).
//
//   13.1 Pembuatan Rujukan   Rujukan/2.0/insert
//   13.2 Edit Rujukan        Rujukan/2.0/Update
//   13.3 Get List Spesialistik Rujukan
//        Rujukan/ListSpesialistik/PPKRujukan/{ppk}/TglRujukan/{tgl}
//   13.4 Get List Sarana Rujukan
//        Rujukan/ListSarana/PPKRujukan/{ppk}
//   13.5 Get List/Detail Rujukan Keluar (Rujukan/Keluar/...) — di sini dipakai
//        untuk cek-silang satu rujukan terhadap BPJS (13.5.2/13.5.3); daftar
//        rujukan yang ditampilkan di UI memakai data lokal tabel
//        bridging_rujukan_bpjs (yang memang sudah ada di skema Khanza dan
//        persis cocok dengan field-field rujukan keluar).
// ============================================================================

type BridgingRujukanKeluar struct {
	NoRujukan           string `json:"no_rujukan"`
	NoSep               string `json:"no_sep"`
	TglRujukan          string `json:"tgl_rujukan"`
	TglRencanaKunjungan string `json:"tgl_rencana_kunjungan"`
	PpkDirujuk          string `json:"ppk_dirujuk"`
	NmPpkDirujuk        string `json:"nm_ppk_dirujuk"`
	JnsPelayanan        string `json:"jns_pelayanan"`
	Catatan             string `json:"catatan"`
	DiagRujukan         string `json:"diag_rujukan"`
	NamaDiagRujukan     string `json:"nama_diag_rujukan"`
	TipeRujukan         string `json:"tipe_rujukan"` // "0" Penuh / "1" Partial / "2" Rujuk Balik
	PoliRujukan         string `json:"poli_rujukan"`
	NamaPoliRujukan     string `json:"nama_poli_rujukan"`
	UserEntry           string `json:"user_entry"`
}

func tipeRujukanEnumText(kode string) string {
	switch kode {
	case "1":
		return "1. Partial"
	case "2":
		return "2. Rujuk Balik"
	default:
		return "0. Penuh"
	}
}

func getRujukanKeluarList(db *sql.DB) gin.HandlerFunc {
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
			SELECT no_rujukan, COALESCE(no_sep,''), COALESCE(tglRujukan,'0000-00-00'), tglRencanaKunjungan,
				COALESCE(ppkDirujuk,''), COALESCE(nm_ppkDirujuk,''), COALESCE(jnsPelayanan,''),
				COALESCE(catatan,''), COALESCE(diagRujukan,''), COALESCE(nama_diagRujukan,''),
				COALESCE(tipeRujukan,''), COALESCE(poliRujukan,''), COALESCE(nama_poliRujukan,''), COALESCE(` + "`user`" + `,'')
			FROM bridging_rujukan_bpjs
			WHERE tglRujukan BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if search != "" {
			query += ` AND (no_rujukan LIKE ? OR no_sep LIKE ? OR nm_ppkDirujuk LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += ` ORDER BY tglRujukan DESC, no_rujukan DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []BridgingRujukanKeluar{}
		for rows.Next() {
			var r BridgingRujukanKeluar
			if err := rows.Scan(
				&r.NoRujukan, &r.NoSep, &r.TglRujukan, &r.TglRencanaKunjungan,
				&r.PpkDirujuk, &r.NmPpkDirujuk, &r.JnsPelayanan,
				&r.Catatan, &r.DiagRujukan, &r.NamaDiagRujukan,
				&r.TipeRujukan, &r.PoliRujukan, &r.NamaPoliRujukan, &r.UserEntry,
			); err != nil {
				continue
			}
			items = append(items, r)
		}
		c.JSON(http.StatusOK, items)
	}
}

// createRujukanKeluar menangani 13.1 Pembuatan Rujukan (Rujukan/2.0/insert).
func createRujukanKeluar(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r BridgingRujukanKeluar
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(r.NoSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}

		// 13.1.6 — tgl rujukan tidak boleh kosong
		if strings.TrimSpace(r.TglRujukan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal rujukan tidak sesuai"})
			return
		}
		tglRujukan, errTR := time.Parse("2006-01-02", r.TglRujukan)
		if errTR != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal rujukan tidak sesuai"})
			return
		}

		var tglsep, jnspelayananSep string
		err := db.QueryRow(`SELECT COALESCE(tglsep,'0000-00-00'), COALESCE(jnspelayanan,'') FROM bridging_sep WHERE no_sep = ?`, r.NoSep).
			Scan(&tglsep, &jnspelayananSep)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SEP lokal tidak ditemukan"})
			return
		}
		if tglSep, errS := time.Parse("2006-01-02", tglsep); errS == nil {
			// 13.1.4 — tgl rujukan tidak boleh kurang dari tgl SEP
			if tglRujukan.Before(tglSep) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal rujukan tidak sesuai"})
				return
			}
			// 13.1.5 — untuk SEP RJTL (jnspelayanan="1"), tgl rujukan tidak boleh lebih dari tgl SEP
			if jnspelayananSep == "1" && tglRujukan.After(tglSep) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal rujukan tidak sesuai"})
				return
			}
		}

		// 13.1.7 — validasi double rujukan (satu SEP hanya boleh dirujuk sekali)
		var dupCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM bridging_rujukan_bpjs WHERE no_sep = ?`, r.NoSep).Scan(&dupCount); err == nil && dupCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Peserta sudah dirujuk"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rujukan": map[string]interface{}{
					"noSep":        r.NoSep,
					"tglRujukan":   r.TglRujukan,
					"tglRencana":   r.TglRencanaKunjungan,
					"ppkDirujuk":   r.PpkDirujuk,
					"jnsPelayanan": r.JnsPelayanan,
					"catatan":      r.Catatan,
					"diagRujukan":  r.DiagRujukan,
					"tipeRujukan":  r.TipeRujukan,
					"poliRujukan":  r.PoliRujukan,
					"user":         r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "Rujukan/2.0/insert", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertRujukanKeluarLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Rujukan berhasil dibuat", "response": result})
	}
}

func upsertRujukanKeluarLocal(db *sql.DB, r BridgingRujukanKeluar) error {
	_, err := db.Exec(`
		INSERT INTO bridging_rujukan_bpjs (
			no_rujukan, no_sep, tglRujukan, tglRencanaKunjungan, ppkDirujuk, nm_ppkDirujuk,
			jnsPelayanan, catatan, diagRujukan, nama_diagRujukan, tipeRujukan,
			poliRujukan, nama_poliRujukan, `+"`user`"+`
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			no_sep=VALUES(no_sep), tglRujukan=VALUES(tglRujukan), tglRencanaKunjungan=VALUES(tglRencanaKunjungan),
			ppkDirujuk=VALUES(ppkDirujuk), nm_ppkDirujuk=VALUES(nm_ppkDirujuk),
			jnsPelayanan=VALUES(jnsPelayanan), catatan=VALUES(catatan), diagRujukan=VALUES(diagRujukan),
			nama_diagRujukan=VALUES(nama_diagRujukan), tipeRujukan=VALUES(tipeRujukan),
			poliRujukan=VALUES(poliRujukan), nama_poliRujukan=VALUES(nama_poliRujukan), `+"`user`"+`=VALUES(`+"`user`"+`)
	`,
		r.NoRujukan, r.NoSep, nullIfEmptyDate(r.TglRujukan), r.TglRencanaKunjungan, r.PpkDirujuk, r.NmPpkDirujuk,
		r.JnsPelayanan, r.Catatan, r.DiagRujukan, r.NamaDiagRujukan, tipeRujukanEnumText(r.TipeRujukan),
		r.PoliRujukan, r.NamaPoliRujukan, r.UserEntry,
	)
	return err
}

// updateRujukanKeluar menangani 13.2 Edit Rujukan (Rujukan/2.0/Update).
// Validasi 13.2.8 (rujukan tidak bisa diedit karena sudah dibuatkan SEP di
// RS rujukan, butuh status remote yang tidak disimpan lokal) tidak
// diterapkan di sini; pesan penolakan BPJS akan diteruskan apa adanya.
func updateRujukanKeluar(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r BridgingRujukanKeluar
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(r.NoRujukan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rujukan wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rujukan": map[string]interface{}{
					"noRujukan":    r.NoRujukan,
					"noSep":        r.NoSep,
					"ppkDirujuk":   r.PpkDirujuk,
					"jnsPelayanan": r.JnsPelayanan,
					"catatan":      r.Catatan,
					"diagRujukan":  r.DiagRujukan,
					"tipeRujukan":  r.TipeRujukan,
					"poliRujukan":  r.PoliRujukan,
					"user":         r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "Rujukan/2.0/Update", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertRujukanKeluarLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Rujukan berhasil diperbarui", "response": result})
	}
}

// getListSpesialistikRujukan menangani 13.3 Get List Spesialistik Rujukan.
func getListSpesialistikRujukan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ppk := strings.TrimPrefix(c.Param("ppk"), "/")
		tgl := strings.TrimSpace(c.Query("tgl_rujukan"))
		if ppk == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK wajib diisi"})
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

		path := "Rujukan/ListSpesialistik/PPKRujukan/" + ppk + "/TglRujukan/" + tgl
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"spesialistik": result})
	}
}

// getListSaranaRujukan menangani 13.4 Get List Sarana Rujukan.
func getListSaranaRujukan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ppk := strings.TrimPrefix(c.Param("ppk"), "/")
		if ppk == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Rujukan/ListSarana/PPKRujukan/" + ppk
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"sarana": result})
	}
}

// getRujukanKeluarDetailBpjs menangani 13.5.2/13.5.3 — ambil detail satu
// rujukan langsung dari BPJS (Rujukan/Keluar/{noRujukan}) untuk cek-silang
// terhadap data lokal; pesan "rujukan tidak ditemukan" (13.5.3) diteruskan
// apa adanya dari respons vclaimRequest.
func getRujukanKeluarDetailBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRujukan := strings.TrimPrefix(c.Param("no_rujukan"), "/")
		if noRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rujukan wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "Rujukan/Keluar/"+noRujukan, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"rujukan": result})
	}
}
