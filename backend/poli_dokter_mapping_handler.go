package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// MAPPING DOKTER POLIKLINIK — Admin.tsx tab "Mapping Dokter Poliklinik"
// (setelah tab Set Penggunaan Tarif). Petakan poliklinik -> dokter (bisa
// lebih dari 1 dokter per poli, mis. Poliklinik Anak -> dr. Aisyah + dr.
// Budi), dipakai RujukanInternalModal.tsx (fitur "Rujuk" di
// Pemeriksaan.tsx) supaya begitu poli dituju dipilih, dokter tujuan
// otomatis tersaring/terisi — dokter tidak perlu cari manual lagi.
// ============================================================================

func ensurePoliDokterMappingTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS poli_dokter_mapping (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kd_poli VARCHAR(10) NOT NULL,
			kd_dokter VARCHAR(20) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_poli_dokter (kd_poli, kd_dokter),
			INDEX idx_kd_poli (kd_poli)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`)
	if err != nil {
		return fmt.Errorf("gagal bikin tabel poli_dokter_mapping: %v", err)
	}
	return nil
}

type PoliDokterMappingItem struct {
	ID       int    `json:"id"`
	KdPoli   string `json:"kd_poli"`
	NmPoli   string `json:"nm_poli"`
	KdDokter string `json:"kd_dokter"`
	NmDokter string `json:"nm_dokter"`
}

// getPoliDokterMappingList — GET /api/poli-dokter-mapping, daftar lengkap
// (join ke poliklinik/dokter biar dapat nama, bukan cuma kode) buat tabel
// di tab Admin.
func getPoliDokterMappingList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT m.id, m.kd_poli, COALESCE(pl.nm_poli, ''), m.kd_dokter, COALESCE(d.nm_dokter, '')
			FROM poli_dokter_mapping m
			LEFT JOIN poliklinik pl ON pl.kd_poli = m.kd_poli
			LEFT JOIN dokter d ON d.kd_dokter = m.kd_dokter
			ORDER BY pl.nm_poli, d.nm_dokter
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil mapping: " + err.Error()})
			return
		}
		defer rows.Close()

		items := []PoliDokterMappingItem{}
		for rows.Next() {
			var it PoliDokterMappingItem
			if err := rows.Scan(&it.ID, &it.KdPoli, &it.NmPoli, &it.KdDokter, &it.NmDokter); err != nil {
				continue
			}
			items = append(items, it)
		}
		c.JSON(http.StatusOK, items)
	}
}

// getPoliDokterMappingByPoli — GET /api/poli-dokter-mapping/by-poli/:kd_poli,
// dipakai RujukanInternalModal.tsx: begitu poli dituju dipilih, tarik
// dokter yg sudah dipetakan ke poli itu (bisa 0/1/lebih dari 1 hasil).
func getPoliDokterMappingByPoli(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPoli := c.Param("kd_poli")
		rows, err := db.Query(`
			SELECT m.id, m.kd_poli, COALESCE(pl.nm_poli, ''), m.kd_dokter, COALESCE(d.nm_dokter, '')
			FROM poli_dokter_mapping m
			LEFT JOIN poliklinik pl ON pl.kd_poli = m.kd_poli
			LEFT JOIN dokter d ON d.kd_dokter = m.kd_dokter
			WHERE m.kd_poli = ?
			ORDER BY d.nm_dokter
		`, kdPoli)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil mapping: " + err.Error()})
			return
		}
		defer rows.Close()

		items := []PoliDokterMappingItem{}
		for rows.Next() {
			var it PoliDokterMappingItem
			if err := rows.Scan(&it.ID, &it.KdPoli, &it.NmPoli, &it.KdDokter, &it.NmDokter); err != nil {
				continue
			}
			items = append(items, it)
		}
		c.JSON(http.StatusOK, items)
	}
}

type AddPoliDokterMappingPayload struct {
	KdPoli   string `json:"kd_poli" binding:"required"`
	KdDokter string `json:"kd_dokter" binding:"required"`
}

func addPoliDokterMapping(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AddPoliDokterMappingPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
			return
		}
		res, err := db.Exec(`INSERT INTO poli_dokter_mapping (kd_poli, kd_dokter) VALUES (?, ?)`, req.KdPoli, req.KdDokter)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Dokter ini sudah dipetakan ke poli tsb"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan mapping: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

func hapusPoliDokterMapping(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec(`DELETE FROM poli_dokter_mapping WHERE id = ?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus mapping: " + err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}
