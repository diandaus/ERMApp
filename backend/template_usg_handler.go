package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// template_usg_handler.go — template hasil USG (modal Input Hasil
// Pemeriksaan USG): checkbox "Jadikan template" saat Simpan membuat
// template dari isi form (Hasil, Kesimpulan/Kesan, Saran/Anjuran); tombol
// "Template" membuka daftar template utk mengisi form. Per dokter
// (dokter poliklinik pasien = Penanggung Jawab USG).
//
// Tabel BARU milik ERMApp, auto-dibuat via ensureTemplateUsgTable
// (CREATE TABLE IF NOT EXISTS saja, tidak menyentuh tabel Khanza).

func ensureTemplateUsgTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS erm_template_usg (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kd_dokter VARCHAR(20) NOT NULL,
			nama_template VARCHAR(100) NOT NULL,
			hasil TEXT NOT NULL,
			kesan TEXT NOT NULL,
			saran TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_kd_dokter (kd_dokter)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
	return err
}

type templateUsg struct {
	ID           int    `json:"id"`
	KdDokter     string `json:"kd_dokter"`
	NamaTemplate string `json:"nama_template"`
	Hasil        string `json:"hasil"`
	Kesan        string `json:"kesan"`
	Saran        string `json:"saran"`
}

// GET /api/radiologi/template-usg?kd_dokter=xxx
func getTemplateUsg(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT id, kd_dokter, nama_template, hasil, kesan, saran
			FROM erm_template_usg WHERE kd_dokter = ? ORDER BY nama_template`, strings.TrimSpace(c.Query("kd_dokter")))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat template USG: " + err.Error()})
			return
		}
		defer rows.Close()
		list := []templateUsg{}
		for rows.Next() {
			var t templateUsg
			if rows.Scan(&t.ID, &t.KdDokter, &t.NamaTemplate, &t.Hasil, &t.Kesan, &t.Saran) == nil {
				list = append(list, t)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/radiologi/template-usg {kd_dokter, nama_template, hasil, kesan, saran}
func createTemplateUsg(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in templateUsg
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		in.KdDokter = strings.TrimSpace(in.KdDokter)
		in.NamaTemplate = strings.TrimSpace(in.NamaTemplate)
		in.Hasil = strings.TrimSpace(in.Hasil)
		in.Kesan = strings.TrimSpace(in.Kesan)
		in.Saran = strings.TrimSpace(in.Saran)
		if in.KdDokter == "" || in.NamaTemplate == "" || (in.Hasil == "" && in.Kesan == "" && in.Saran == "") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter, nama template dan isi wajib diisi"})
			return
		}
		res, err := db.Exec(`INSERT INTO erm_template_usg (kd_dokter, nama_template, hasil, kesan, saran) VALUES (?, ?, ?, ?, ?)`,
			in.KdDokter, in.NamaTemplate, in.Hasil, in.Kesan, in.Saran)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan template USG: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		in.ID = int(id)
		c.JSON(http.StatusOK, in)
	}
}

// DELETE /api/radiologi/template-usg/:id
func deleteTemplateUsg(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM erm_template_usg WHERE id = ?`, c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus template USG: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Template USG dihapus"})
	}
}
