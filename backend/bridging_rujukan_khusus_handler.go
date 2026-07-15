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
// BRIDGING RUJUKAN KHUSUS — bagian 19 spesifikasi VClaim: Perpanjangan
// Rujukan Khusus (mis. program kronis Hemodialisa/HD) yang masa berlakunya
// terbatas dan perlu diperpanjang berkala. Disimpan lokal ke tabel Khanza
// yang sudah ada dan persis cocok: bridging_rujukan_bpjs_khusus (induk) +
// bridging_rujukan_bpjs_khusus_diagnosa + bridging_rujukan_bpjs_khusus_prosedur
// (anak, status diagnosa 'P'=primer/'S'=sekunder).
//   19.1 Perpanjangan Rujukan Khusus HD   Rujukan/Khusus/insert
//   19.2 Hapus Perpanjangan Rujukan Khusus Rujukan/Khusus/delete
//   19.3 Get List Perpanjangan Rujukan Khusus Rujukan/Khusus/List/Bulan/{b}/Tahun/{t}
// ============================================================================

type DiagnosaKhusus struct {
	Status string `json:"status"` // "P" primer / "S" sekunder
	Kode   string `json:"kode"`
	Nama   string `json:"nama"`
}

type ProsedurKhusus struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

type RujukanKhususRequest struct {
	NoRujukan       string           `json:"no_rujukan"`
	NoKartu         string           `json:"no_kartu"`
	NamaPeserta     string           `json:"nama_peserta"`
	TglRujukanAwal  string           `json:"tgl_rujukan_awal"`
	TglRujukanAkhir string           `json:"tgl_rujukan_akhir"` // tgl akhir masa berlaku baru setelah diperpanjang
	TglAkhirLama    string           `json:"tgl_akhir_lama"`    // opsional: tgl akhir masa berlaku sebelumnya, dipakai utk 19.1.2
	KdPoliTerakhir  string           `json:"kd_poli_terakhir"`
	NmPoliTerakhir  string           `json:"nm_poli_terakhir"`
	Diagnosa        []DiagnosaKhusus `json:"diagnosa"`
	Prosedur        []ProsedurKhusus `json:"prosedur"`
	UserEntry       string           `json:"user_entry"`
}

// validateRujukanKhususBeforePerpanjang menerapkan validasi 19.1.1-19.1.6
// yang bisa dicek dari data lokal/input. Kecocokan diagnosa/prosedur
// terhadap daftar resmi program rujukan khusus BPJS (bagian dari 19.1.4 &
// 19.1.5) tidak diverifikasi di sini — hanya presence-check; keputusan akhir
// tetap ada di BPJS saat request dikirim.
func validateRujukanKhususBeforePerpanjang(db *sql.DB, r RujukanKhususRequest) string {
	// 19.1.1 — nomor rujukan wajib diisi
	if strings.TrimSpace(r.NoRujukan) == "" {
		return "Nomor rujukan tidak ditemukan"
	}

	// 19.1.2 — masa berlaku (lama) sudah habis lebih dari 7 hari
	if strings.TrimSpace(r.TglAkhirLama) != "" {
		if tglAkhirLama, err := time.Parse("2006-01-02", r.TglAkhirLama); err == nil {
			today, _ := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
			if today.After(tglAkhirLama.AddDate(0, 0, 7)) {
				return "Masa berlaku sudah lebih dari 7 hari"
			}
		}
	}

	// 19.1.3 — poli terakhir harus poli HD (Hemodialisa)
	if strings.TrimSpace(r.KdPoliTerakhir) == "" {
		return "Poli terakhir bukan HD"
	}
	poli := strings.ToLower(r.NmPoliTerakhir)
	if !strings.Contains(poli, "hd") && !strings.Contains(poli, "hemodialisa") && !strings.Contains(poli, "hemodialisis") {
		return "Poli terakhir bukan HD"
	}

	// 19.1.4 — diagnosa primer wajib diisi
	hasPrimer := false
	for _, d := range r.Diagnosa {
		if d.Status == "P" && strings.TrimSpace(d.Kode) != "" {
			hasPrimer = true
			break
		}
	}
	if !hasPrimer {
		return "Diagnosa tidak sesuai"
	}

	// 19.1.5 — prosedur wajib diisi
	if len(r.Prosedur) == 0 {
		return "Prosedur tidak sesuai"
	}
	for _, p := range r.Prosedur {
		if strings.TrimSpace(p.Kode) == "" {
			return "Prosedur tidak sesuai"
		}
	}

	// 19.1.6 — rujukan yang belum berakhir tidak boleh diperpanjang lagi
	var tglBerakhir string
	err := db.QueryRow(`SELECT COALESCE(tglrujukan_berakhir,'0000-00-00') FROM bridging_rujukan_bpjs_khusus WHERE no_rujukan = ?`, r.NoRujukan).Scan(&tglBerakhir)
	if err == nil {
		if tglB, errB := time.Parse("2006-01-02", tglBerakhir); errB == nil {
			today, _ := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
			if !tglB.Before(today) {
				return "Nomor rujukan masih berlaku"
			}
		}
	}

	return ""
}

// upsertRujukanKhususLocal menyimpan hasil perpanjangan ke tabel
// bridging_rujukan_bpjs_khusus. Tabel ini punya foreign key ke
// bridging_rujukan_bpjs(no_rujukan) — kalau rujukan aslinya tidak dibuat
// lewat fitur "Rujukan Keluar" (bagian 13) di aplikasi ini (mis. rujukan
// khusus FKTP yang sudah ada sebelumnya di BPJS), baris induk itu belum
// tentu ada secara lokal, jadi di sini disediakan (INSERT IGNORE) dengan
// data minimal supaya constraint FK terpenuhi tanpa menimpa data asli yang
// sudah ada.
func upsertRujukanKhususLocal(db *sql.DB, r RujukanKhususRequest) error {
	tglAwal := r.TglRujukanAwal
	if strings.TrimSpace(tglAwal) == "" {
		tglAwal = time.Now().Format("2006-01-02")
	}
	if _, err := db.Exec(
		`INSERT IGNORE INTO bridging_rujukan_bpjs (no_rujukan, tglRujukan, tglRencanaKunjungan) VALUES (?, ?, ?)`,
		r.NoRujukan, tglAwal, tglAwal,
	); err != nil {
		return err
	}

	_, err := db.Exec(`
		INSERT INTO bridging_rujukan_bpjs_khusus (no_rujukan, nokapst, nmpst, tglrujukan_awal, tglrujukan_berakhir)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			nokapst=VALUES(nokapst), nmpst=VALUES(nmpst),
			tglrujukan_awal=VALUES(tglrujukan_awal), tglrujukan_berakhir=VALUES(tglrujukan_berakhir)
	`, r.NoRujukan, r.NoKartu, r.NamaPeserta, nullIfEmptyDate(r.TglRujukanAwal), nullIfEmptyDate(r.TglRujukanAkhir))
	if err != nil {
		return err
	}

	if _, err := db.Exec(`DELETE FROM bridging_rujukan_bpjs_khusus_diagnosa WHERE no_rujukan = ?`, r.NoRujukan); err != nil {
		return err
	}
	for _, d := range r.Diagnosa {
		if strings.TrimSpace(d.Kode) == "" {
			continue
		}
		if _, err := db.Exec(
			`INSERT INTO bridging_rujukan_bpjs_khusus_diagnosa (no_rujukan, status, kode_diagnosa, nama_diagnosa) VALUES (?, ?, ?, ?)`,
			r.NoRujukan, d.Status, d.Kode, d.Nama,
		); err != nil {
			return err
		}
	}

	if _, err := db.Exec(`DELETE FROM bridging_rujukan_bpjs_khusus_prosedur WHERE no_rujukan = ?`, r.NoRujukan); err != nil {
		return err
	}
	for _, p := range r.Prosedur {
		if strings.TrimSpace(p.Kode) == "" {
			continue
		}
		if _, err := db.Exec(
			`INSERT INTO bridging_rujukan_bpjs_khusus_prosedur (no_rujukan, kode_prosedur, nama_prosedur) VALUES (?, ?, ?)`,
			r.NoRujukan, p.Kode, p.Nama,
		); err != nil {
			return err
		}
	}

	return nil
}

// getRujukanKhususList menampilkan data lokal perpanjangan rujukan khusus
// untuk tabel UI, termasuk ringkasan diagnosa/prosedur per baris.
func getRujukanKhususList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("search")

		query := `SELECT no_rujukan, COALESCE(nokapst,''), COALESCE(nmpst,''), COALESCE(tglrujukan_awal,'0000-00-00'), COALESCE(tglrujukan_berakhir,'0000-00-00') FROM bridging_rujukan_bpjs_khusus`
		args := []interface{}{}
		if search != "" {
			query += ` WHERE no_rujukan LIKE ? OR nokapst LIKE ? OR nmpst LIKE ?`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += ` ORDER BY tglrujukan_berakhir DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []RujukanKhususRequest{}
		for rows.Next() {
			var r RujukanKhususRequest
			if err := rows.Scan(&r.NoRujukan, &r.NoKartu, &r.NamaPeserta, &r.TglRujukanAwal, &r.TglRujukanAkhir); err != nil {
				continue
			}
			items = append(items, r)
		}
		c.JSON(http.StatusOK, items)
	}
}

// createRujukanKhusus menangani 19.1 Perpanjangan Rujukan Khusus HD.
func createRujukanKhusus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r RujukanKhususRequest
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if errMsg := validateRujukanKhususBeforePerpanjang(db, r); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		diagnosaPayload := make([]map[string]interface{}, 0, len(r.Diagnosa))
		for _, d := range r.Diagnosa {
			diagnosaPayload = append(diagnosaPayload, map[string]interface{}{
				"status": d.Status,
				"kode":   d.Kode,
			})
		}
		prosedurPayload := make([]map[string]interface{}, 0, len(r.Prosedur))
		for _, p := range r.Prosedur {
			prosedurPayload = append(prosedurPayload, map[string]interface{}{"kode": p.Kode})
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_rujukan_khusus": map[string]interface{}{
					"noRujukan": r.NoRujukan,
					"noKartu":   r.NoKartu,
					"poli":      r.KdPoliTerakhir,
					"diagnosa":  diagnosaPayload,
					"prosedur":  prosedurPayload,
					"user":      r.UserEntry,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "Rujukan/Khusus/insert", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertRujukanKhususLocal(db, r); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Rujukan khusus berhasil diperpanjang", "response": result})
	}
}

// deleteRujukanKhusus menangani 19.2 Hapus Perpanjangan Rujukan Khusus.
func deleteRujukanKhusus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRujukan := strings.TrimPrefix(c.Param("no_rujukan"), "/")
		if noRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan tidak ditemukan"})
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
				"t_rujukan_khusus": map[string]interface{}{
					"noRujukan": noRujukan,
					"user":      user,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodDelete, "Rujukan/Khusus/delete", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		db.Exec(`DELETE FROM bridging_rujukan_bpjs_khusus_diagnosa WHERE no_rujukan = ?`, noRujukan)
		db.Exec(`DELETE FROM bridging_rujukan_bpjs_khusus_prosedur WHERE no_rujukan = ?`, noRujukan)
		if _, err := db.Exec(`DELETE FROM bridging_rujukan_bpjs_khusus WHERE no_rujukan = ?`, noRujukan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Perpanjangan rujukan khusus berhasil dihapus", "response": result})
	}
}

// getBpjsListRujukanKhusus menangani 19.3 Get List Perpanjangan Rujukan Khusus.
func getBpjsListRujukanKhusus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		bulan := c.DefaultQuery("bulan", now.Format("01"))
		tahun := c.DefaultQuery("tahun", now.Format("2006"))

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Rujukan/Khusus/List/Bulan/" + bulan + "/Tahun/" + tahun
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"list": result})
	}
}
