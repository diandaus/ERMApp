package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Set Embalase dan Tuslah (item #5 dari 13 sub-menu Pengaturan).
// Cocok dengan dialog Khanza Desktop "Set Embalase & Tuslah"
// (setting/DlgSetEmbalase.java) — dialog paling sederhana di antara semua
// sub-fitur Pengaturan Apotek: 1 tabel, 1 baris system-wide, 2 kolom
// nominal Rupiah (bukan persentase seperti Set Harga Obat).
//
// Tabel: set_embalase (embalase_per_obat double NOT NULL,
// tuslah_per_obat double NULL) — tanpa PK, sama seperti set_lokasi/
// set_harga_obat: Java cuma izinkan 1 baris system-wide (dicek row count
// sebelum insert), "Edit" = delete lalu insert ulang.
// ============================================================================

type setEmbalase struct {
	EmbalasePerObat float64 `json:"embalase_per_obat"`
	TuslahPerObat   float64 `json:"tuslah_per_obat"`
}

func getSetEmbalase(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s setEmbalase
		err := db.QueryRow(`SELECT embalase_per_obat, tuslah_per_obat FROM set_embalase LIMIT 1`).Scan(&s.EmbalasePerObat, &s.TuslahPerObat)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

// saveSetEmbalase — sama seperti set_lokasi/set_harga_obat: selalu bersihkan
// baris lama lalu insert baru (meniru gabungan tombol Simpan/Edit Java yang
// keduanya berujung ke "1 baris terbaru menang").
func saveSetEmbalase(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body setEmbalase
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM set_embalase`); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`INSERT INTO set_embalase (embalase_per_obat, tuslah_per_obat) VALUES (?, ?)`, body.EmbalasePerObat, body.TuslahPerObat); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Embalase & tuslah berhasil disimpan"})
	}
}

func deleteSetEmbalase(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM set_embalase`); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Embalase & tuslah berhasil dihapus"})
	}
}
