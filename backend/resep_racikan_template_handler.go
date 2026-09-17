package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// resep_racikan_template_handler.go — "Template Resep" di ResepModal.tsx
// (tab Racikan): dokter/petugas bisa simpan susunan racikan (nama racikan,
// metode racik, jumlah diminta, aturan pakai, keterangan, + daftar obat
// dgn kandungan/jumlahnya) sbg template bernama, lalu pakai lagi utk resep
// pasien lain tanpa mengetik ulang dari nol — sangat membantu utk racikan
// standar yg sering dipakai (mis. Puyer Batuk Anak).
//
// Tabel INI BARU (belum ada di skema Khanza asli), auto-dibuat via
// ensureResepRacikanTemplateTables (dipanggil sekali di main.go). Snapshot
// nama_brng/kode_sat/kapasitas ikut disimpan di detail (bukan di-join ulang
// dari databarang saat GET) — cukup utk ditampilkan di daftar/preview;
// harga/stok TIDAK disimpan krn Racikan (frontend) memang tidak menyimpan
// itu di state-nya juga (lihat komentar type RacikanDetail di
// ResepModal.tsx), disamakan saat resep disubmit oleh flow submit yg sudah
// ada (submitResepUnified), bukan tanggung jawab endpoint ini.

func ensureResepRacikanTemplateTables(db *sql.DB) error {
	const createTemplate = `
		CREATE TABLE IF NOT EXISTS resep_racikan_template (
			id INT AUTO_INCREMENT PRIMARY KEY,
			nama_template VARCHAR(100) NOT NULL,
			metode_racik VARCHAR(20),
			jml_dr INT NOT NULL DEFAULT 0,
			aturan_pakai VARCHAR(100),
			keterangan VARCHAR(100),
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	if _, err := db.Exec(createTemplate); err != nil {
		return err
	}
	const createDetail = `
		CREATE TABLE IF NOT EXISTS resep_racikan_template_detail (
			id INT AUTO_INCREMENT PRIMARY KEY,
			template_id INT NOT NULL,
			kode_brng VARCHAR(20) NOT NULL,
			nama_brng VARCHAR(100),
			kode_sat VARCHAR(10),
			kapasitas VARCHAR(20),
			kandungan VARCHAR(20),
			jml DECIMAL(10,2) NOT NULL DEFAULT 0,
			INDEX idx_template_id (template_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createDetail)
	return err
}

type resepRacikanTemplateDetail struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	KodeSat   string  `json:"kode_sat"`
	Kapasitas string  `json:"kapasitas"`
	Kandungan string  `json:"kandungan"`
	Jml       float64 `json:"jml"`
}

type resepRacikanTemplate struct {
	ID           int                          `json:"id"`
	NamaTemplate string                       `json:"nama_template"`
	MetodeRacik  string                       `json:"metode_racik"`
	JmlDr        int                          `json:"jml_dr"`
	AturanPakai  string                       `json:"aturan_pakai"`
	Keterangan   string                       `json:"keterangan"`
	Detail       []resepRacikanTemplateDetail `json:"detail"`
}

// GET /api/resep/racikan-template — daftar semua template racikan
// tersimpan (lengkap dgn detail obatnya), diurutkan nama.
func getResepRacikanTemplateList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, nama_template, IFNULL(metode_racik,''), jml_dr, IFNULL(aturan_pakai,''), IFNULL(keterangan,'')
			FROM resep_racikan_template ORDER BY nama_template
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		templates := []resepRacikanTemplate{}
		for rows.Next() {
			var t resepRacikanTemplate
			if err := rows.Scan(&t.ID, &t.NamaTemplate, &t.MetodeRacik, &t.JmlDr, &t.AturanPakai, &t.Keterangan); err == nil {
				templates = append(templates, t)
			}
		}
		rows.Close()

		for i := range templates {
			dRows, err := db.Query(`
				SELECT kode_brng, IFNULL(nama_brng,''), IFNULL(kode_sat,''), IFNULL(kapasitas,''), IFNULL(kandungan,''), jml
				FROM resep_racikan_template_detail WHERE template_id = ?
			`, templates[i].ID)
			if err != nil {
				continue
			}
			for dRows.Next() {
				var d resepRacikanTemplateDetail
				if dRows.Scan(&d.KodeBrng, &d.NamaBrng, &d.KodeSat, &d.Kapasitas, &d.Kandungan, &d.Jml) == nil {
					templates[i].Detail = append(templates[i].Detail, d)
				}
			}
			dRows.Close()
		}

		c.JSON(http.StatusOK, templates)
	}
}

// POST /api/resep/racikan-template — simpan susunan racikan saat ini
// (dipanggil tombol "Jadikan Template Resep") sbg template baru bernama.
func createResepRacikanTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input resepRacikanTemplate
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if input.NamaTemplate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama Template wajib diisi"})
			return
		}
		if len(input.Detail) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Racikan belum ada obat, tidak bisa dijadikan template"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`
			INSERT INTO resep_racikan_template (nama_template, metode_racik, jml_dr, aturan_pakai, keterangan)
			VALUES (?, ?, ?, ?, ?)
		`, input.NamaTemplate, input.MetodeRacik, input.JmlDr, input.AturanPakai, input.Keterangan)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}
		templateID, _ := res.LastInsertId()
		for _, d := range input.Detail {
			if _, err := tx.Exec(`
				INSERT INTO resep_racikan_template_detail (template_id, kode_brng, nama_brng, kode_sat, kapasitas, kandungan, jml)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, templateID, d.KodeBrng, d.NamaBrng, d.KodeSat, d.Kapasitas, d.Kandungan, d.Jml); err != nil {
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

// DELETE /api/resep/racikan-template/:id — hapus template tersimpan.
func deleteResepRacikanTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM resep_racikan_template_detail WHERE template_id = ?`, id); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`DELETE FROM resep_racikan_template WHERE id = ?`, id)
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
