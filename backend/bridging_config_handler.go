package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

type BridgingConfig struct {
	Kode    string            `json:"kode"`
	Nama    string            `json:"nama"`
	Grp     string            `json:"grp"`
	Enabled bool              `json:"enabled"`
	Config  map[string]string `json:"config"`
}

// ensureSettingBridgingTable membuat tabel setting_bridging kalau belum ada
// (mis. instalasi Khanza yang belum punya migrasi ini) — dipakai Pengaturan
// Bridging di Admin.tsx untuk menyimpan kredensial semua layanan bridging
// (BPJS VClaim, HFIS/Mobile JKN, Satu Sehat, dll).
func ensureSettingBridgingTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS setting_bridging (
			kode VARCHAR(50) NOT NULL,
			nama VARCHAR(100) NOT NULL,
			grp VARCHAR(50) NOT NULL DEFAULT '',
			enabled TINYINT(1) NOT NULL DEFAULT 1,
			config TEXT NOT NULL DEFAULT '{}',
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (kode)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createTable)
	return err
}

func getBridgingConfigs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT kode, nama, grp, enabled, COALESCE(config,'{}') FROM setting_bridging ORDER BY grp, kode`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []BridgingConfig
		for rows.Next() {
			var b BridgingConfig
			var configJSON string
			if err := rows.Scan(&b.Kode, &b.Nama, &b.Grp, &b.Enabled, &configJSON); err != nil {
				continue
			}
			b.Config = make(map[string]string)
			if configJSON != "" {
				_ = json.Unmarshal([]byte(configJSON), &b.Config)
			}
			list = append(list, b)
		}
		if list == nil {
			list = []BridgingConfig{}
		}
		c.JSON(http.StatusOK, list)
	}
}

func saveBridgingConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b BridgingConfig
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if b.Kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kode wajib diisi"})
			return
		}
		if b.Config == nil {
			b.Config = map[string]string{}
		}
		configJSON, _ := json.Marshal(b.Config)
		_, err := db.Exec(`
			INSERT INTO setting_bridging (kode, nama, grp, enabled, config)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				nama=VALUES(nama), grp=VALUES(grp), enabled=VALUES(enabled), config=VALUES(config)`,
			b.Kode, b.Nama, b.Grp, b.Enabled, string(configJSON),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi bridging berhasil disimpan"})
	}
}

func deleteBridgingConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := c.Param("kode")
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kode wajib diisi"})
			return
		}
		_, err := db.Exec(`DELETE FROM setting_bridging WHERE kode = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi bridging berhasil dihapus"})
	}
}
