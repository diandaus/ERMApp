package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Set Harga Obat Ralan (item #3 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Harga Obat Ralan"
// (setting/DlgSetHargaObatRalan.java) — dialog kecil, cuma 1 tabel:
// `set_harga_obat_ralan` (kd_pj FK ke `penjab`, hargajual = persentase
// "% dari Harga Beli"). Beda scope dari "Set Harga Obat"
// (apotek_harga_obat_handler.go, keyed jenis/barang) — ini keyed per CARA
// BAYAR (penjab: Umum/BPJS/Asuransi/dll), khusus rawat jalan.
// Java cuma punya tombol Simpan (INSERT) + Hapus (DELETE by kd_pj), TIDAK
// ada tombol Update maupun mekanisme "Terapkan" ke databarang — beda dari
// Set Harga Obat. Kami tetap sediakan upsert (delete-lalu-insert) di satu
// endpoint POST supaya user tidak perlu 2 langkah manual (hapus dulu baru
// simpan lagi) untuk mengubah nilai kd_pj yang sudah ada — hasil akhirnya
// identik, cuma lebih ringkas.
// ============================================================================

type hargaObatRalan struct {
	KdPj      string  `json:"kd_pj"`
	PngJawab  string  `json:"png_jawab"`
	HargaJual float64 `json:"hargajual"`
}

// getHargaObatRalanPenjabOpsi menyediakan daftar cara bayar (penjab) untuk
// dropdown, baris "-" placeholder disaring sama seperti referensi lain.
func getHargaObatRalanPenjabOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		items := []depoOpsiKv{}
		rows, err := db.Query(`SELECT kd_pj, png_jawab FROM penjab WHERE kd_pj <> '-' AND status = '1' ORDER BY png_jawab`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var k depoOpsiKv
				if rows.Scan(&k.Kode, &k.Nama) == nil {
					items = append(items, k)
				}
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func getHargaObatRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT sr.kd_pj, p.png_jawab, sr.hargajual
			FROM set_harga_obat_ralan sr
			INNER JOIN penjab p ON p.kd_pj = sr.kd_pj
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (p.png_jawab LIKE ? OR sr.kd_pj LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY p.png_jawab"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []hargaObatRalan{}
		for rows.Next() {
			var h hargaObatRalan
			if rows.Scan(&h.KdPj, &h.PngJawab, &h.HargaJual) == nil {
				items = append(items, h)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// upsertHargaObatRalan — lihat catatan di kepala file: Java cuma insert,
// kami tambahkan delete-dulu supaya bisa dipakai juga untuk "mengubah"
// nilai kd_pj yang sudah ada tanpa 2 langkah manual.
func upsertHargaObatRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body hargaObatRalan
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.KdPj) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cara bayar wajib dipilih"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM set_harga_obat_ralan WHERE kd_pj = ?`, body.KdPj); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`INSERT INTO set_harga_obat_ralan (kd_pj, hargajual) VALUES (?, ?)`, body.KdPj, body.HargaJual); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Harga obat ralan berhasil disimpan"})
	}
}

func deleteHargaObatRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPj := strings.TrimSpace(c.Param("kdpj"))
		res, err := db.Exec(`DELETE FROM set_harga_obat_ralan WHERE kd_pj = ?`, kdPj)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Harga obat ralan berhasil dihapus"})
	}
}
