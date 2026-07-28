package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ensurePreviewBillingPengaturanTable membuat tabel preview_billing_pengaturan
// jika belum ada. Tabel ini baru (bukan tabel Khanza yang sudah ada) — dipakai
// utk menyimpan kategori biaya mana saja yang DISEMBUNYIKAN dari Preview
// Billing (PreviewBilling.tsx / computeBillingPreview di biaya_handler.go).
// Cuma menyimpan kategori yang di-nonaktifkan (tampil=0); kategori yang tidak
// ada barisnya di tabel ini dianggap tampil (default aman kalau admin belum
// pernah mengatur apa-apa).
func ensurePreviewBillingPengaturanTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS preview_billing_pengaturan (
			kategori VARCHAR(100) NOT NULL PRIMARY KEY,
			tampil TINYINT(1) NOT NULL DEFAULT 1,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`
	_, err := db.Exec(createTable)
	return err
}

// fixedPreviewBillingKategori adalah kategori biaya di Preview Billing yang
// BUKAN berasal dari tabel kategori_perawatan (Registrasi, Kamar Inap,
// Pemeriksaan Lab/Radiologi, Obat & BHP) — lihat computeBillingPreview di
// biaya_handler.go utk urutan & label persis yang dipakai di sana.
var fixedPreviewBillingKategori = []string{
	"Registrasi",
	"Kamar Inap",
	"Pemeriksaan Lab",
	"Pemeriksaan Radiologi",
	"Obat & BHP",
}

// PreviewBillingKategoriItem merepresentasikan satu kategori biaya beserta
// status tampil/sembunyikan-nya di Preview Billing.
type PreviewBillingKategoriItem struct {
	Kategori string `json:"kategori"`
	Tampil   bool   `json:"tampil"`
}

// getPreviewBillingHiddenSet mengambil set nama kategori yang tampil=0 —
// dipakai computeBillingPreview (biaya_handler.go) utk memutuskan kategori
// mana yang dilewati saat menyusun rincian biaya.
func getPreviewBillingHiddenSet(db *sql.DB) map[string]bool {
	hidden := map[string]bool{}
	rows, err := db.Query(`SELECT kategori FROM preview_billing_pengaturan WHERE tampil = 0`)
	if err != nil {
		return hidden
	}
	defer rows.Close()
	for rows.Next() {
		var k string
		if rows.Scan(&k) == nil {
			hidden[k] = true
		}
	}
	return hidden
}

// getPreviewBillingPengaturan mengembalikan daftar SEMUA kategori biaya yang
// bisa diatur (kategori tetap + kategori dinamis dari kategori_perawatan)
// beserta status tampilnya saat ini.
func getPreviewBillingPengaturan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		hidden := getPreviewBillingHiddenSet(db)

		names := append([]string{}, fixedPreviewBillingKategori...)
		rows, err := db.Query(`SELECT nm_kategori FROM kategori_perawatan ORDER BY nm_kategori`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var nm string
			if rows.Scan(&nm) == nil && nm != "" {
				names = append(names, nm)
			}
		}

		items := make([]PreviewBillingKategoriItem, 0, len(names))
		for _, nm := range names {
			items = append(items, PreviewBillingKategoriItem{Kategori: nm, Tampil: !hidden[nm]})
		}

		c.JSON(http.StatusOK, items)
	}
}

// SavePreviewBillingKategoriPayload adalah payload utk mengubah status
// tampil satu kategori biaya di Preview Billing.
type SavePreviewBillingKategoriPayload struct {
	Tampil bool `json:"tampil"`
}

// savePreviewBillingKategori mengubah status tampil/sembunyikan satu
// kategori biaya (upsert berdasarkan nama kategori).
func savePreviewBillingKategori(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kategori := c.Param("kategori")

		var payload SavePreviewBillingKategoriPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}

		tampilInt := 0
		if payload.Tampil {
			tampilInt = 1
		}

		const q = `
			INSERT INTO preview_billing_pengaturan (kategori, tampil)
			VALUES (?, ?)
			ON DUPLICATE KEY UPDATE tampil = VALUES(tampil)
		`
		if _, err := db.Exec(q, kategori, tampilInt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan Preview Billing berhasil disimpan"})
	}
}
