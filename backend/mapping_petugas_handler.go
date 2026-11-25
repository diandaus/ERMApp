package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// mapping_petugas_handler.go — Pengaturan > "Mapping Petugas": petugas
// default per jenis input hasil (USG, Radiologi, Laboratorium PK/PA),
// supaya kolom Petugas di modal input hasil terisi otomatis dgn petugas
// unit itu (bukan akun yg sedang login, yg sering = dokter/admin).
// Satu petugas per jenis (jenis = PRIMARY KEY, simpan = upsert).
//
// Tabel BARU milik ERMApp (bukan skema Khanza), auto-dibuat via
// ensureMappingPetugasTable (CREATE TABLE IF NOT EXISTS saja).

var jenisMappingPetugas = map[string]bool{"usg": true, "radiologi": true, "lab_pk": true, "lab_pa": true}

func ensureMappingPetugasTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS erm_mapping_petugas (
			jenis VARCHAR(20) PRIMARY KEY,
			nip VARCHAR(20) NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
	return err
}

type mappingPetugasRow struct {
	Jenis string `json:"jenis"`
	Nip   string `json:"nip"`
	Nama  string `json:"nama"`
}

// GET /api/mapping-petugas — semua mapping (nama dari tabel petugas Khanza).
func getMappingPetugasList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT m.jenis, m.nip, IFNULL(p.nama, '')
			FROM erm_mapping_petugas m
			LEFT JOIN petugas p ON CONVERT(p.nip USING utf8mb4) = m.nip
			ORDER BY m.jenis`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat mapping petugas: " + err.Error()})
			return
		}
		defer rows.Close()
		list := []mappingPetugasRow{}
		for rows.Next() {
			var r mappingPetugasRow
			if rows.Scan(&r.Jenis, &r.Nip, &r.Nama) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/mapping-petugas {jenis, nip} — simpan/ganti petugas utk jenis itu.
func saveMappingPetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in struct {
			Jenis string `json:"jenis"`
			Nip   string `json:"nip"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		in.Jenis = strings.TrimSpace(in.Jenis)
		in.Nip = strings.TrimSpace(in.Nip)
		if !jenisMappingPetugas[in.Jenis] || in.Nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis dan petugas wajib diisi"})
			return
		}
		if _, err := db.Exec(`INSERT INTO erm_mapping_petugas (jenis, nip) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE nip = VALUES(nip)`, in.Jenis, in.Nip); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan mapping: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping petugas disimpan"})
	}
}

// DELETE /api/mapping-petugas/:jenis
func deleteMappingPetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM erm_mapping_petugas WHERE jenis = ?`, c.Param("jenis")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus mapping: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping petugas dihapus"})
	}
}
