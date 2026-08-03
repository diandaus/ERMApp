package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ensurePreviewObatPengaturanTable membuat tabel preview_obat_pengaturan
// jika belum ada — pengaturan tunggal (satu baris) yang menentukan basis
// harga obat yang ditampilkan di "Obat & BHP" pada Preview Billing
// (PreviewBilling.tsx / computeBillingPreview di biaya_handler.go):
// "jual" (detail_pemberian_obat.biaya_obat, harga jual ke pasien — default,
// sama seperti sebelumnya) atau "modal" (detail_pemberian_obat.h_beli,
// harga beli/modal apotek).
func ensurePreviewObatPengaturanTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS preview_obat_pengaturan (
			id INT AUTO_INCREMENT PRIMARY KEY,
			mode VARCHAR(10) NOT NULL DEFAULT 'jual',
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`
	if _, err := db.Exec(createTable); err != nil {
		return err
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM preview_obat_pengaturan`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		_, err := db.Exec(`INSERT INTO preview_obat_pengaturan (id, mode) VALUES (1, 'jual')`)
		return err
	}
	return nil
}

// getPreviewObatMode mengambil basis harga obat yang aktif ("jual" atau
// "modal") — dipakai computeBillingPreview (biaya_handler.go). Default
// "jual" kalau baris pengaturan belum ada/gagal dibaca (aman, sama seperti
// perilaku sebelum fitur ini ada).
func getPreviewObatMode(db *sql.DB) string {
	var mode string
	if err := db.QueryRow(`SELECT mode FROM preview_obat_pengaturan ORDER BY id LIMIT 1`).Scan(&mode); err != nil {
		return "jual"
	}
	if mode != "modal" {
		return "jual"
	}
	return mode
}

// getPreviewObatPengaturan mengembalikan basis harga obat yang aktif saat ini.
func getPreviewObatPengaturan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"mode": getPreviewObatMode(db)})
	}
}

// SavePreviewObatPengaturanPayload adalah payload utk mengganti basis harga obat.
type SavePreviewObatPengaturanPayload struct {
	Mode string `json:"mode" binding:"required,oneof=jual modal"`
}

// savePreviewObatPengaturan mengganti basis harga obat ("jual"/"modal").
func savePreviewObatPengaturan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload SavePreviewObatPengaturanPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid, mode harus 'jual' atau 'modal'"})
			return
		}

		if _, err := db.Exec(`UPDATE preview_obat_pengaturan SET mode = ? WHERE id = 1`, payload.Mode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan Set Preview Obat berhasil disimpan", "mode": payload.Mode})
	}
}
