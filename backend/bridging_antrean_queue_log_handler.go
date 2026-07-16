package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// LOG & SAKLAR ANTREAN BPJS OTOMATIS — dipakai tab "Antrean Otomatis" di
// Bridging BPJS supaya staf bisa: (1) lihat isi bridging_antrean_queue
// (apa yang sudah/belum diproses worker, dan kenapa kalau gagal), (2)
// menyalakan/mematikan worker-nya, (3) menandai satu baris "sudah ditangani
// manual" (mis. staf sengaja pakai fitur Tambah Antrean bawaan Khanza
// Desktop untuk kunjungan itu, supaya worker tidak ikut memprosesnya dan
// bikin antrean dobel di BPJS), dan (4) memproses ulang baris yang gagal.
// ============================================================================

const antreanOtomatisSettingKode = "bridging_antrean_otomatis"

// isAntreanOtomatisEnabled dicek worker (bridging_antrean_worker.go) sebelum
// memproses tiap batch. Default MATI kalau baris pengaturan belum pernah
// disimpan — fitur ini belum pernah diuji end-to-end dengan SEP sungguhan,
// jadi sengaja tidak aktif sampai staf menyalakannya sendiri.
func isAntreanOtomatisEnabled(db *sql.DB) bool {
	var enabled bool
	err := db.QueryRow(`SELECT enabled FROM setting_bridging WHERE kode = ?`, antreanOtomatisSettingKode).Scan(&enabled)
	if err != nil {
		return false
	}
	return enabled
}

func getAntreanOtomatisStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"enabled": isAntreanOtomatisEnabled(db)})
	}
}

func setAntreanOtomatisStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		_, err := db.Exec(`
			INSERT INTO setting_bridging (kode, nama, grp, enabled, config)
			VALUES (?, 'Antrean BPJS Otomatis', 'bpjs', ?, '{}')
			ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
		`, antreanOtomatisSettingKode, req.Enabled)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan berhasil disimpan", "enabled": req.Enabled})
	}
}

// AntreanQueueRow adalah satu baris bridging_antrean_queue untuk ditampilkan
// di tabel log tab "Antrean Otomatis".
type AntreanQueueRow struct {
	ID             int     `json:"id"`
	NoRawat        string  `json:"no_rawat"`
	NoSep          string  `json:"no_sep"`
	NoRkmMedis     string  `json:"no_rkm_medis"`
	KdPoli         string  `json:"kd_poli"`
	KodePoliBpjs   string  `json:"kodepoli_bpjs"`
	NamaPoliBpjs   string  `json:"namapoli_bpjs"`
	KodeDokterBpjs string  `json:"kodedokter_bpjs"`
	NamaDokterBpjs string  `json:"namadokter_bpjs"`
	TglRegistrasi  string  `json:"tgl_registrasi"`
	NoRujukan      string  `json:"no_rujukan"`
	JenisKunjungan int     `json:"jeniskunjungan"`
	Status         string  `json:"status"`
	Keterangan     string  `json:"keterangan"`
	KodeBooking    string  `json:"kodebooking"`
	CreatedAt      string  `json:"created_at"`
	ProcessedAt    *string `json:"processed_at"`
}

func getAntreanQueueList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status")
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		search := c.Query("search")

		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		query := `
			SELECT id, no_rawat, COALESCE(no_sep,''), no_rkm_medis, COALESCE(kd_poli,''),
				COALESCE(kodepoli_bpjs,''), COALESCE(namapoli_bpjs,''), COALESCE(kodedokter_bpjs,''),
				COALESCE(namadokter_bpjs,''), COALESCE(tgl_registrasi,'0000-00-00'), COALESCE(no_rujukan,''),
				jeniskunjungan, status, COALESCE(keterangan,''), COALESCE(kodebooking,''),
				created_at, processed_at
			FROM bridging_antrean_queue
			WHERE tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if status != "" {
			query += ` AND status = ?`
			args = append(args, status)
		}
		if search != "" {
			query += ` AND (no_rawat LIKE ? OR no_rkm_medis LIKE ? OR kodebooking LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += ` ORDER BY id DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []AntreanQueueRow{}
		for rows.Next() {
			var r AntreanQueueRow
			var processedAt sql.NullString
			if err := rows.Scan(&r.ID, &r.NoRawat, &r.NoSep, &r.NoRkmMedis, &r.KdPoli,
				&r.KodePoliBpjs, &r.NamaPoliBpjs, &r.KodeDokterBpjs, &r.NamaDokterBpjs,
				&r.TglRegistrasi, &r.NoRujukan, &r.JenisKunjungan, &r.Status, &r.Keterangan,
				&r.KodeBooking, &r.CreatedAt, &processedAt); err != nil {
				continue
			}
			if processedAt.Valid {
				r.ProcessedAt = &processedAt.String
			}
			items = append(items, r)
		}
		c.JSON(http.StatusOK, items)
	}
}

// skipAntreanQueueItem menandai satu baris "sudah ditangani manual" (mis.
// staf sudah bikin antreannya sendiri lewat Khanza Desktop) supaya worker
// tidak memprosesnya lagi.
func skipAntreanQueueItem(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
			return
		}
		res, err := db.Exec(`
			UPDATE bridging_antrean_queue
			SET status = 'skipped', keterangan = 'Ditandai sudah dibuat manual oleh staf', processed_at = NOW()
			WHERE id = ? AND status IN ('pending', 'error')
		`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Baris tidak ditemukan atau sudah diproses"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Baris ditandai sudah ditangani manual"})
	}
}

// retryAntreanQueueItem mengembalikan baris 'error'/'skipped' ke 'pending'
// supaya dicoba lagi oleh worker pada siklus berikutnya.
func retryAntreanQueueItem(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
			return
		}
		res, err := db.Exec(`
			UPDATE bridging_antrean_queue
			SET status = 'pending', keterangan = NULL, processed_at = NULL
			WHERE id = ? AND status IN ('error', 'skipped')
		`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Baris tidak ditemukan atau bukan status error/skipped"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Baris akan dicoba ulang"})
	}
}
