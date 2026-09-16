package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// lab_pk_hasil_template_handler.go — "Template Hasil Pemeriksaan" di modal
// Input Data Hasil Periksa Laboratorium PK (ModalHasilLabPK.tsx): user bisa
// menyimpan set nilai Hasil (semua parameter dlm satu pemeriksaan, mis.
// "Darah Lengkap" atau "Morfologi Sel Darah Tepi*") sbg template bernama,
// lalu klik utk langsung mengisi ulang form (autofill) — tinggal edit yg
// beda saja, bukan ketik ulang dari nol. Sangat membantu utk pemeriksaan yg
// hasilnya narasi panjang & berulang (mis. Morfologi).
//
// Tabel INI BARU (belum ada di skema Khanza asli), auto-dibuat via
// ensureLabPkHasilTemplateTables (dipanggil sekali di main.go).

func ensureLabPkHasilTemplateTables(db *sql.DB) error {
	const createTemplate = `
		CREATE TABLE IF NOT EXISTS lab_pk_hasil_template (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kd_jenis_prw VARCHAR(20) NOT NULL,
			nama_template VARCHAR(100) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_kd_jenis_prw (kd_jenis_prw)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	if _, err := db.Exec(createTemplate); err != nil {
		return err
	}
	const createDetail = `
		CREATE TABLE IF NOT EXISTS lab_pk_hasil_template_detail (
			id INT AUTO_INCREMENT PRIMARY KEY,
			template_id INT NOT NULL,
			id_template INT NOT NULL,
			nilai TEXT,
			keterangan VARCHAR(50),
			INDEX idx_template_id (template_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createDetail)
	return err
}

// IDTemplate string (bukan int) — frontend meneruskan apa adanya nilai
// id_template dari GET /api/lab/template (TemplateLab.IDTemplate di
// lab_handler.go JUGA string, bukan int), sama akar penyebab & solusi dgn
// bug serupa di hasilLabPKDetailInput (lab_pk_worklist_handler.go). Cukup
// dipakai sbg parameter SQL (WHERE/INSERT id_template=?), driver otomatis
// convert ke kolom INT.
type labPkHasilTemplateDetail struct {
	IDTemplate string `json:"id_template"`
	Nilai      string `json:"nilai"`
	Keterangan string `json:"keterangan"`
}

type labPkHasilTemplate struct {
	ID           int                        `json:"id"`
	KdJenisPrw   string                     `json:"kd_jenis_prw"`
	NamaTemplate string                     `json:"nama_template"`
	Details      []labPkHasilTemplateDetail `json:"details"`
}

// GET /api/lab-pk/hasil-template?kd_jenis_prw=xxx — daftar template
// tersimpan (lengkap dgn detail nilainya) utk satu kode pemeriksaan.
func getLabPkHasilTemplateList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdJenisPrw := c.Query("kd_jenis_prw")
		if kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter kd_jenis_prw wajib diisi"})
			return
		}

		rows, err := db.Query(`
			SELECT id, kd_jenis_prw, nama_template FROM lab_pk_hasil_template
			WHERE kd_jenis_prw = ? ORDER BY nama_template
		`, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		templates := []labPkHasilTemplate{}
		for rows.Next() {
			var t labPkHasilTemplate
			if err := rows.Scan(&t.ID, &t.KdJenisPrw, &t.NamaTemplate); err == nil {
				templates = append(templates, t)
			}
		}
		rows.Close()

		for i := range templates {
			dRows, err := db.Query(`
				SELECT id_template, IFNULL(nilai,''), IFNULL(keterangan,'')
				FROM lab_pk_hasil_template_detail WHERE template_id = ?
			`, templates[i].ID)
			if err != nil {
				continue
			}
			for dRows.Next() {
				var d labPkHasilTemplateDetail
				if dRows.Scan(&d.IDTemplate, &d.Nilai, &d.Keterangan) == nil {
					templates[i].Details = append(templates[i].Details, d)
				}
			}
			dRows.Close()
		}

		c.JSON(http.StatusOK, templates)
	}
}

// POST /api/lab-pk/hasil-template — simpan nilai form saat ini sbg template
// baru bernama, siap dipakai ulang utk pasien lain dgn pemeriksaan yg sama.
func createLabPkHasilTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input labPkHasilTemplate
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if input.KdJenisPrw == "" || input.NamaTemplate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Pemeriksaan dan Nama Template wajib diisi"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`INSERT INTO lab_pk_hasil_template (kd_jenis_prw, nama_template) VALUES (?, ?)`, input.KdJenisPrw, input.NamaTemplate)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}
		templateID, _ := res.LastInsertId()
		for _, d := range input.Details {
			if _, err := tx.Exec(`
				INSERT INTO lab_pk_hasil_template_detail (template_id, id_template, nilai, keterangan) VALUES (?, ?, ?, ?)
			`, templateID, d.IDTemplate, d.Nilai, d.Keterangan); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan detail: " + err.Error()})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		input.ID = int(templateID)
		c.JSON(http.StatusOK, input)
	}
}

// DELETE /api/lab-pk/hasil-template/:id — hapus template tersimpan.
func deleteLabPkHasilTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM lab_pk_hasil_template_detail WHERE template_id = ?`, id); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`DELETE FROM lab_pk_hasil_template WHERE id = ?`, id)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Template tidak ditemukan"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
