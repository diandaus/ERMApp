package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Konversi Satuan (item #10 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Konversi" (inventory/DlgKonversi.java) —
// CRUD aturan konversi antar satuan barang, mis. "10 Ampul = 1 Box".
//
// Tabel: konver_sat (nilai double, kode_sat char(4), nilai_konversi
// double, sat_konversi char(4) — PK majemuk keempatnya). kode_sat &
// sat_konversi FK ke kodesatuan (tabel yang sama dipakai Satuan Barang).
// Dibaca sebagai: `nilai` satuan `kode_sat` = `nilai_konversi` satuan
// `sat_konversi`.
//
// Java (Simpan/Hapus, TIDAK ada Update) validasi kode_sat != sat_konversi
// (tidak boleh konversi ke satuan yang sama). Hapus di Java match by
// kode_sat+sat_konversi saja (bukan 4 kolom PK penuh) — diikuti persis di
// sini. Tidak ada tombol Update di Java; backend tetap sediakan upsert
// (delete match kode_sat+sat_konversi, lalu insert) di endpoint POST yang
// sama supaya edit tidak perlu 2 langkah manual, konsisten dengan pola
// Set Harga Obat Ralan/Ranap.
// ============================================================================

type konversiSatuan struct {
	Nilai           float64 `json:"nilai"`
	KodeSat         string  `json:"kode_sat"`
	NamaSat         string  `json:"nama_sat"`
	NilaiKonversi   float64 `json:"nilai_konversi"`
	SatKonversi     string  `json:"sat_konversi"`
	NamaSatKonversi string  `json:"nama_sat_konversi"`
}

func getKonversiSatuanList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT k.nilai, k.kode_sat, COALESCE(s1.satuan,''), k.nilai_konversi, k.sat_konversi, COALESCE(s2.satuan,'')
			FROM konver_sat k
			LEFT JOIN kodesatuan s1 ON s1.kode_sat = k.kode_sat
			LEFT JOIN kodesatuan s2 ON s2.kode_sat = k.sat_konversi
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (k.kode_sat LIKE ? OR k.sat_konversi LIKE ? OR s1.satuan LIKE ? OR s2.satuan LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY s1.satuan, s2.satuan"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []konversiSatuan{}
		for rows.Next() {
			var k konversiSatuan
			if rows.Scan(&k.Nilai, &k.KodeSat, &k.NamaSat, &k.NilaiKonversi, &k.SatKonversi, &k.NamaSatKonversi) == nil {
				items = append(items, k)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// upsertKonversiSatuan — lihat catatan di kepala file: Java cuma insert,
// kami tambahkan delete-dulu (match kode_sat+sat_konversi, sama seperti
// Hapus di Java) supaya bisa dipakai untuk "mengubah" nilai konversi
// tanpa 2 langkah manual.
func upsertKonversiSatuan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body konversiSatuan
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KodeSat) == "" || strings.TrimSpace(body.SatKonversi) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Satuan ke-1 dan ke-2 wajib diisi"})
			return
		}
		if body.KodeSat == body.SatKonversi {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Satuan ke-1 dan ke-2 tidak boleh sama"})
			return
		}
		if body.Nilai <= 0 || body.NilaiKonversi <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nilai satuan wajib diisi dan lebih dari 0"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM konver_sat WHERE kode_sat = ? AND sat_konversi = ?`, body.KodeSat, body.SatKonversi); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(
			`INSERT INTO konver_sat (nilai, kode_sat, nilai_konversi, sat_konversi) VALUES (?, ?, ?, ?)`,
			body.Nilai, body.KodeSat, body.NilaiKonversi, body.SatKonversi,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Konversi satuan berhasil disimpan"})
	}
}

// deleteKonversiSatuan — match by kode_sat+sat_konversi saja, identik
// dengan Hapus di Java (bukan 4 kolom PK penuh).
func deleteKonversiSatuan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeSat := c.Query("kode_sat")
		satKonversi := c.Query("sat_konversi")
		if kodeSat == "" || satKonversi == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Satuan ke-1 dan ke-2 wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM konver_sat WHERE kode_sat = ? AND sat_konversi = ?`, kodeSat, satKonversi)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Konversi satuan berhasil dihapus"})
	}
}
