package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// template_catatan_dokter_handler.go — card "Template Catatan" di tab
// Catatan Dokter (Pemeriksaan): dokter menyimpan teks catatan yg sering
// dipakai sbg template bernama (per dokter), lalu klik "Pakai" utk mengisi
// form catatan — tinggal edit yg beda saja.
//
// Tabel INI BARU (belum ada di skema Khanza asli), auto-dibuat via
// ensureTemplateCatatanDokterTable (dipanggil sekali di main.go). Hanya
// CREATE TABLE IF NOT EXISTS pd tabel milik ERMApp sendiri — tidak
// menyentuh tabel Khanza.

func ensureTemplateCatatanDokterTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS template_catatan_dokter (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kd_dokter VARCHAR(20) NOT NULL,
			nama_template VARCHAR(100) NOT NULL,
			isi TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_kd_dokter (kd_dokter)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
	return err
}

type templateCatatanDokter struct {
	ID           int    `json:"id"`
	KdDokter     string `json:"kd_dokter"`
	NamaTemplate string `json:"nama_template"`
	Isi          string `json:"isi"`
}

// GET /api/pemeriksaan/template-catatan-dokter?kd_dokter=xxx
func getTemplateCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := strings.TrimSpace(c.Query("kd_dokter"))
		list := []templateCatatanDokter{}
		rows, err := db.Query(`SELECT id, kd_dokter, nama_template, isi FROM template_catatan_dokter
			WHERE kd_dokter = ? ORDER BY nama_template`, kd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat template: " + err.Error()})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var t templateCatatanDokter
			if rows.Scan(&t.ID, &t.KdDokter, &t.NamaTemplate, &t.Isi) == nil {
				list = append(list, t)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/pemeriksaan/template-catatan-dokter {kd_dokter, nama_template, isi}
func createTemplateCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in templateCatatanDokter
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		in.KdDokter = strings.TrimSpace(in.KdDokter)
		in.NamaTemplate = strings.TrimSpace(in.NamaTemplate)
		in.Isi = strings.TrimSpace(in.Isi)
		if in.KdDokter == "" || in.NamaTemplate == "" || in.Isi == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter, nama template dan isi wajib diisi"})
			return
		}
		res, err := db.Exec(`INSERT INTO template_catatan_dokter (kd_dokter, nama_template, isi) VALUES (?, ?, ?)`,
			in.KdDokter, in.NamaTemplate, in.Isi)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan template: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		in.ID = int(id)
		c.JSON(http.StatusOK, in)
	}
}

// DELETE /api/pemeriksaan/template-catatan-dokter/:id
func deleteTemplateCatatanDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM template_catatan_dokter WHERE id = ?`, c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus template: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Template dihapus"})
	}
}
