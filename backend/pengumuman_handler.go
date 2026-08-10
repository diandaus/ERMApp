package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Pengumuman, fitur BARU murni ERMApp (tidak ada padanan di
// Khanza). Dikelola HRD/admin lewat sidebar Kepegawaian > Pengumuman,
// ditampilkan sbg kartu "Pengumuman/Informasi Penting" di Home tab
// aplikasi mobile Presensi Mandiri (PresensiMobile.tsx) — hanya yang
// `aktif=1` yang tampil di HP.
// ============================================================================

func ensurePengumumanTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS pengumuman (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			judul VARCHAR(150) NOT NULL,
			isi TEXT NOT NULL,
			prioritas ENUM('info','penting','urgent') NOT NULL DEFAULT 'info',
			tanggal DATE NOT NULL,
			aktif TINYINT(1) NOT NULL DEFAULT 1,
			dibuat_oleh VARCHAR(100) NOT NULL DEFAULT '',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB
	`)
}

type PengumumanRow struct {
	ID         int    `json:"id"`
	Judul      string `json:"judul"`
	Isi        string `json:"isi"`
	Prioritas  string `json:"prioritas"`
	Tanggal    string `json:"tanggal"`
	Aktif      bool   `json:"aktif"`
	DibuatOleh string `json:"dibuat_oleh"`
}

// GET /api/pengumuman?aktif=1 (mobile) atau tanpa filter (admin, semua)
func getPengumumanList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		aktifQ := strings.TrimSpace(c.Query("aktif"))
		query := `SELECT id, judul, isi, prioritas, DATE_FORMAT(tanggal,'%Y-%m-%d'), aktif, dibuat_oleh FROM pengumuman WHERE 1=1`
		args := []interface{}{}
		if aktifQ != "" {
			query += " AND aktif = ?"
			args = append(args, aktifQ == "1")
		}
		query += " ORDER BY tanggal DESC, id DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []PengumumanRow{}
		for rows.Next() {
			var p PengumumanRow
			if err := rows.Scan(&p.ID, &p.Judul, &p.Isi, &p.Prioritas, &p.Tanggal, &p.Aktif, &p.DibuatOleh); err == nil {
				list = append(list, p)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type PengumumanPayload struct {
	Judul      string `json:"judul" binding:"required"`
	Isi        string `json:"isi" binding:"required"`
	Prioritas  string `json:"prioritas"`
	Tanggal    string `json:"tanggal" binding:"required"`
	Aktif      *bool  `json:"aktif"`
	DibuatOleh string `json:"dibuat_oleh"`
}

func tambahPengumuman(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PengumumanPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Prioritas == "" {
			p.Prioritas = "info"
		}
		aktif := true
		if p.Aktif != nil {
			aktif = *p.Aktif
		}
		_, err := db.Exec(
			`INSERT INTO pengumuman (judul, isi, prioritas, tanggal, aktif, dibuat_oleh) VALUES (?,?,?,?,?,?)`,
			p.Judul, p.Isi, p.Prioritas, p.Tanggal, aktif, p.DibuatOleh,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengumuman berhasil ditambahkan"})
	}
}

func editPengumuman(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		var p PengumumanPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Prioritas == "" {
			p.Prioritas = "info"
		}
		aktif := true
		if p.Aktif != nil {
			aktif = *p.Aktif
		}
		res, err := db.Exec(
			`UPDATE pengumuman SET judul=?, isi=?, prioritas=?, tanggal=?, aktif=? WHERE id=?`,
			p.Judul, p.Isi, p.Prioritas, p.Tanggal, aktif, id,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengumuman berhasil diperbarui"})
	}
}

// PUT /api/pengumuman/:id/toggle — aktifkan/nonaktifkan cepat tanpa buka form edit.
func toggleAktifPengumuman(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		res, err := db.Exec(`UPDATE pengumuman SET aktif = NOT aktif WHERE id=?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status pengumuman berhasil diubah"})
	}
}

func hapusPengumuman(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		res, err := db.Exec(`DELETE FROM pengumuman WHERE id=?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengumuman berhasil dihapus"})
	}
}
