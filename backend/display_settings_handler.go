package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// DisplaySettings represents display configuration
type DisplaySettings struct {
	ID                 int    `json:"id"`
	NamaRS             string `json:"nama_rs"`
	LogoURL            string `json:"logo_url"`
	VideoURL           string `json:"video_url"`
	RunningTextPoli    string `json:"running_text_poli"`
	RunningTextApotek  string `json:"running_text_apotek"`
	BackgroundColorPoli string `json:"background_color_poli"`
	BackgroundColorApotek string `json:"background_color_apotek"`
	PollingInterval    int    `json:"polling_interval"` // in seconds
	TTSEnabled         bool   `json:"tts_enabled"`
	TTSRate            float64 `json:"tts_rate"`
	TTSPitch           float64 `json:"tts_pitch"`
	TTSVolume          float64 `json:"tts_volume"`
}

// ensureDisplaySettingsTable creates table and default settings
func ensureDisplaySettingsTable(db *sql.DB) error {
	// Create table
	tableQuery := `
	CREATE TABLE IF NOT EXISTS display_settings (
		id INT AUTO_INCREMENT PRIMARY KEY,
		nama_rs VARCHAR(200) NOT NULL DEFAULT 'NAMA RUMAH SAKIT',
		logo_url TEXT,
		video_url TEXT,
		running_text_poli TEXT DEFAULT 'SELAMAT DATANG DI RUMAH SAKIT',
		running_text_apotek TEXT DEFAULT 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
		background_color_poli VARCHAR(20) DEFAULT '#1565c0',
		background_color_apotek VARCHAR(20) DEFAULT '#000000',
		polling_interval INT DEFAULT 3,
		tts_enabled BOOLEAN DEFAULT TRUE,
		tts_rate DECIMAL(3,2) DEFAULT 0.85,
		tts_pitch DECIMAL(3,2) DEFAULT 1.00,
		tts_volume DECIMAL(3,2) DEFAULT 1.00,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	_, err := db.Exec(tableQuery)
	if err != nil {
		return fmt.Errorf("gagal create table display_settings: %v", err)
	}

	// Insert default settings if not exists
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM display_settings").Scan(&count)
	if err != nil {
		return fmt.Errorf("gagal check display_settings: %v", err)
	}

	if count == 0 {
		defaultQuery := `
		INSERT INTO display_settings
		(nama_rs, running_text_poli, running_text_apotek)
		VALUES
		('NAMA RUMAH SAKIT',
		 'SELAMAT DATANG DI RUMAH SAKIT - SILAHKAN MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
		 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA - TERIMA KASIH')
		`
		_, err = db.Exec(defaultQuery)
		if err != nil {
			log.Printf("Warning: gagal insert default settings: %v", err)
		} else {
			log.Println("✓ Default display settings created")
		}
	}

	log.Println("✓ Display settings table ensured")
	return nil
}

// GET /api/settings/display
// Get current display settings
func getDisplaySettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var settings DisplaySettings

		row := db.QueryRow(`
			SELECT id, nama_rs, COALESCE(logo_url, ''), COALESCE(video_url, ''),
			       running_text_poli, running_text_apotek,
			       background_color_poli, background_color_apotek,
			       polling_interval, tts_enabled, tts_rate, tts_pitch, tts_volume
			FROM display_settings
			ORDER BY id DESC
			LIMIT 1
		`)

		err := row.Scan(
			&settings.ID, &settings.NamaRS, &settings.LogoURL, &settings.VideoURL,
			&settings.RunningTextPoli, &settings.RunningTextApotek,
			&settings.BackgroundColorPoli, &settings.BackgroundColorApotek,
			&settings.PollingInterval, &settings.TTSEnabled,
			&settings.TTSRate, &settings.TTSPitch, &settings.TTSVolume,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Settings not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, settings)
	}
}

// PUT /api/settings/display
// Update display settings
func updateDisplaySettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req DisplaySettings
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Update or insert settings
		query := `
		INSERT INTO display_settings
		(id, nama_rs, logo_url, video_url, running_text_poli, running_text_apotek,
		 background_color_poli, background_color_apotek, polling_interval,
		 tts_enabled, tts_rate, tts_pitch, tts_volume)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			nama_rs = VALUES(nama_rs),
			logo_url = VALUES(logo_url),
			video_url = VALUES(video_url),
			running_text_poli = VALUES(running_text_poli),
			running_text_apotek = VALUES(running_text_apotek),
			background_color_poli = VALUES(background_color_poli),
			background_color_apotek = VALUES(background_color_apotek),
			polling_interval = VALUES(polling_interval),
			tts_enabled = VALUES(tts_enabled),
			tts_rate = VALUES(tts_rate),
			tts_pitch = VALUES(tts_pitch),
			tts_volume = VALUES(tts_volume),
			updated_at = NOW()
		`

		_, err := db.Exec(query,
			req.NamaRS, req.LogoURL, req.VideoURL,
			req.RunningTextPoli, req.RunningTextApotek,
			req.BackgroundColorPoli, req.BackgroundColorApotek,
			req.PollingInterval, req.TTSEnabled,
			req.TTSRate, req.TTSPitch, req.TTSVolume,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Display settings updated successfully",
		})
	}
}
