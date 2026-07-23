package main

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetJenisTindakan - Mendapatkan daftar jenis tindakan/perawatan
func GetJenisTindakan(c *gin.Context, db *sql.DB) {
	search := c.Query("search")
	kdPj := c.Query("kd_pj")
	kdPoli := c.Query("kd_poli")

	// Saklar Set Penggunaan Tarif (set_tarif.cara_bayar_ralan/poli_ralan,
	// lihat set_tarif_handler.go) — padanan mekanisme yang sudah diport
	// utk Lab/Radiologi (getJenisPerawatanLab/getJenisPerawatanRadiologi):
	// filter kd_pj/kd_poli cuma aktif kalau saklarnya "Yes". Default "Yes"
	// kalau baris set_tarif belum ada (padanan fallback Java saat
	// rsset_tarif tidak punya baris).
	caraBayarAktif, poliAktif := "Yes", "Yes"
	db.QueryRow(`SELECT cara_bayar_ralan, poli_ralan FROM set_tarif LIMIT 1`).Scan(&caraBayarAktif, &poliAktif)

	query := `
		SELECT
			jns_perawatan.kd_jenis_prw,
			jns_perawatan.nm_perawatan,
			kategori_perawatan.nm_kategori,
			jns_perawatan.total_byrdr,
			jns_perawatan.material,
			jns_perawatan.bhp,
			jns_perawatan.tarif_tindakandr,
			jns_perawatan.tarif_tindakanpr,
			jns_perawatan.kso,
			jns_perawatan.menejemen
		FROM jns_perawatan
		INNER JOIN kategori_perawatan ON jns_perawatan.kd_kategori = kategori_perawatan.kd_kategori
		WHERE jns_perawatan.total_byrdr > 0
			AND jns_perawatan.status = '1'
	`

	args := []interface{}{}

	// Filter berdasarkan kd_pj — HANYA kalau saklar "Per Jenis Bayar
	// Ralan" aktif (Yes) DAN kd_pj pasien dikirim.
	if caraBayarAktif == "Yes" && kdPj != "" {
		query += " AND (jns_perawatan.kd_pj = ? OR jns_perawatan.kd_pj = '-')"
		args = append(args, kdPj)
	}

	// Filter berdasarkan kd_poli — HANYA kalau saklar "Per Poli Ralan"
	// aktif (Yes) DAN kd_poli pasien dikirim.
	if poliAktif == "Yes" && kdPoli != "" {
		query += " AND (jns_perawatan.kd_poli = ? OR jns_perawatan.kd_poli = '-')"
		args = append(args, kdPoli)
	}

	// Add search filter
	if search != "" {
		query += " AND (jns_perawatan.kd_jenis_prw LIKE ? OR jns_perawatan.nm_perawatan LIKE ? OR kategori_perawatan.nm_kategori LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY jns_perawatan.nm_perawatan LIMIT 50"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Error querying jenis tindakan: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jenis tindakan"})
		return
	}
	defer rows.Close()

	// Initialize with empty array instead of nil to prevent null JSON response
	result := make([]map[string]interface{}, 0)

	for rows.Next() {
		var kdJenisPrw, nmPerawatan, nmKategori string
		var totalDr, material, bhp, tarifDr, tarifPr, kso, menejemen float64

		if err := rows.Scan(
			&kdJenisPrw, &nmPerawatan, &nmKategori,
			&totalDr, &material, &bhp, &tarifDr, &tarifPr, &kso, &menejemen,
		); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		result = append(result, map[string]interface{}{
			"kd_jenis_prw":      kdJenisPrw,
			"nm_perawatan":      nmPerawatan,
			"nm_kategori":       nmKategori,
			"total_byrdr":       totalDr,
			"material":          material,
			"bhp":               bhp,
			"tarif_tindakandr":  tarifDr,
			"tarif_tindakanpr":  tarifPr,
			"kso":               kso,
			"menejemen":         menejemen,
		})
	}

	c.JSON(http.StatusOK, result)
}

// SimpanTindakan - Simpan tindakan rawat jalan dokter
func SimpanTindakan(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		KdDokter        string  `json:"kd_dokter"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanDr float64 `json:"tarif_tindakandr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	// Validasi required fields
	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.KdDokter == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, dan Kode Dokter wajib diisi"})
		return
	}

	// Use current date/time if not provided
	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	// Insert into rawat_jl_dr table
	query := `
		INSERT INTO rawat_jl_dr (
			no_rawat, kd_jenis_prw, kd_dokter,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakandr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := db.Exec(
		query,
		payload.NoRawat,
		payload.KdJenisPrw,
		payload.KdDokter,
		payload.TglPerawatan,
		payload.JamRawat,
		payload.Material,
		payload.BHP,
		payload.TarifTindakanDr,
		payload.KSO,
		payload.Menejemen,
		payload.BiayaRawat,
	)

	if err != nil {
		log.Printf("Error inserting tindakan: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// SimpanTindakanPetugas — padanan SimpanTindakan tapi utk tab "Penanganan
// Petugas" (tindakan yang ditangani perawat/petugas, bukan dokter).
// Insert ke rawat_jl_pr (PK majemuk no_rawat+kd_jenis_prw+nip+tgl+jam,
// beda dari rawat_jl_dr yang pakai kd_dokter). tarif_tindakanpr diambil
// dari payload (harusnya jns_perawatan.tarif_tindakanpr, bukan
// total_byrdr yang konteksnya "Total Bayar DOKTER" — beda kolom, beda
// makna, jadi TIDAK dipakai ulang di sini seperti SimpanTindakan).
func SimpanTindakanPetugas(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		Nip             string  `json:"nip"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanPr float64 `json:"tarif_tindakanpr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.Nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, dan Petugas wajib diisi"})
		return
	}

	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	_, err := db.Exec(`
		INSERT INTO rawat_jl_pr (
			no_rawat, kd_jenis_prw, nip,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakanpr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		payload.NoRawat, payload.KdJenisPrw, payload.Nip,
		payload.TglPerawatan, payload.JamRawat,
		payload.Material, payload.BHP, payload.TarifTindakanPr, payload.KSO, payload.Menejemen, payload.BiayaRawat,
	)
	if err != nil {
		log.Printf("Error inserting tindakan petugas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// SimpanTindakanDrPr — padanan SimpanTindakan tapi utk tab "Penanganan
// Dokter & Petugas" (ditangani BERSAMA). Insert ke rawat_jl_drpr (PK
// majemuk no_rawat+kd_jenis_prw+kd_dokter+nip+tgl+jam), simpan tarif dr
// DAN pr sekaligus (biaya_rawat = jumlah keduanya, penyederhanaan yang
// disengaja — proyek ini belum punya modul Keuangan/Jurnal utk hitung
// pembagian yang lebih rinci, sama pola dengan modul lain).
func SimpanTindakanDrPr(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		KdDokter        string  `json:"kd_dokter"`
		Nip             string  `json:"nip"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanDr float64 `json:"tarif_tindakandr"`
		TarifTindakanPr float64 `json:"tarif_tindakanpr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.KdDokter == "" || payload.Nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, Dokter, dan Petugas wajib diisi"})
		return
	}

	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	_, err := db.Exec(`
		INSERT INTO rawat_jl_drpr (
			no_rawat, kd_jenis_prw, kd_dokter, nip,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakandr, tarif_tindakanpr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		payload.NoRawat, payload.KdJenisPrw, payload.KdDokter, payload.Nip,
		payload.TglPerawatan, payload.JamRawat,
		payload.Material, payload.BHP, payload.TarifTindakanDr, payload.TarifTindakanPr, payload.KSO, payload.Menejemen, payload.BiayaRawat,
	)
	if err != nil {
		log.Printf("Error inserting tindakan dr+pr: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// DeleteTindakan - Hapus tindakan rawat jalan dokter
func DeleteTindakan(c *gin.Context, db *sql.DB) {
	noRawat := c.Query("no_rawat")
	kdJenisPrw := c.Query("kd_jenis_prw")
	tglPerawatan := c.Query("tgl_perawatan")
	jamRawat := c.Query("jam_rawat")
	kdDokter := c.Query("kd_dokter")

	if noRawat == "" || kdJenisPrw == "" || tglPerawatan == "" || jamRawat == "" || kdDokter == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter tidak lengkap"})
		return
	}

	// Delete from rawat_jl_dr
	query := `
		DELETE FROM rawat_jl_dr
		WHERE no_rawat = ?
			AND kd_jenis_prw = ?
			AND tgl_perawatan = ?
			AND jam_rawat = ?
			AND kd_dokter = ?
	`

	result, err := db.Exec(query, noRawat, kdJenisPrw, tglPerawatan, jamRawat, kdDokter)
	if err != nil {
		log.Printf("Error deleting tindakan: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tindakan"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil dihapus",
	})
}
