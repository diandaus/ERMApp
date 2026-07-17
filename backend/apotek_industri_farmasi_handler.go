package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Industri Farmasi (item #6 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Industri Farmasi"
// (inventory/DlgIndustriFarmasi.java) — CRUD master data pabrik/distributor
// obat, tabel native Khanza `industrifarmasi` yang juga sudah dipakai
// sebagai referensi dropdown "Industri / Pabrik" di Data Barang
// (apotek_barang_handler.go, getApotekReferensi).
//
// Tabel: industrifarmasi (kode_industri char(5) PK, nama_industri,
// alamat, kota, no_telp) — TIDAK ada kolom status (beda dari databarang),
// jadi tidak ada konsep nonaktifkan di Khanza untuk tabel ini, cuma
// hapus beneran. Baris "-" adalah placeholder "belum diisi" dipakai FK
// kolom databarang.kode_industri (lihat fkOrDash di
// apotek_barang_handler.go) — disaring dari list/CRUD di sini karena
// bukan data industri sungguhan.
//
// Kode (kode_industri) diinput manual oleh staf (bukan auto increment),
// dan Java MENGIZINKAN kode diubah lewat "Ganti" (SET kode_industri=?
// WHERE kode_industri=? lama) — beda dari Data Barang yang PK-nya
// immutable. Kami ikuti perilaku itu, tapi tambahkan guard: tolak
// hapus/ganti-kode kalau kode itu masih dipakai databarang.kode_industri
// (FK), supaya tidak meninggalkan referensi yatim/rusak — pengaman ini
// tidak ada di Java tapi konsisten dengan pola pengaman lain di modul
// ini (lihat deleteDataBarang).
// ============================================================================

type industriFarmasi struct {
	KodeIndustri string `json:"kode_industri"`
	NamaIndustri string `json:"nama_industri"`
	Alamat       string `json:"alamat"`
	Kota         string `json:"kota"`
	NoTelp       string `json:"no_telp"`
}

func getIndustriFarmasiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT kode_industri, COALESCE(nama_industri,''), COALESCE(alamat,''), COALESCE(kota,''), COALESCE(no_telp,'')
			FROM industrifarmasi
			WHERE kode_industri <> '-'
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (kode_industri LIKE ? OR nama_industri LIKE ? OR alamat LIKE ? OR kota LIKE ? OR no_telp LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY nama_industri"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []industriFarmasi{}
		for rows.Next() {
			var i industriFarmasi
			if rows.Scan(&i.KodeIndustri, &i.NamaIndustri, &i.Alamat, &i.Kota, &i.NoTelp) == nil {
				items = append(items, i)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createIndustriFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b industriFarmasi
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeIndustri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NamaIndustri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama industri farmasi wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM industrifarmasi WHERE kode_industri = ?`, b.KodeIndustri).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah dipakai"})
			return
		}
		_, err := db.Exec(
			`INSERT INTO industrifarmasi (kode_industri, nama_industri, alamat, kota, no_telp) VALUES (?, ?, ?, ?, ?)`,
			b.KodeIndustri, b.NamaIndustri, b.Alamat, b.Kota, b.NoTelp,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Industri farmasi berhasil ditambahkan"})
	}
}

// updateIndustriFarmasi — kode_industri BOLEH diganti (mengikuti Java),
// tapi ditolak kalau kode lama masih dipakai databarang.kode_industri
// dan kode barunya beda dari kode lama (supaya tidak meninggalkan FK
// yatim di databarang).
func updateIndustriFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeLama := strings.TrimSpace(c.Param("kode"))
		if kodeLama == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var b industriFarmasi
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeIndustri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NamaIndustri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama industri farmasi wajib diisi"})
			return
		}

		if b.KodeIndustri != kodeLama {
			var dipakai int
			db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_industri = ?`, kodeLama).Scan(&dipakai)
			if dipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode masih dipakai barang lain, tidak bisa diganti"})
				return
			}
			var kodeBaruDipakai int
			db.QueryRow(`SELECT COUNT(*) FROM industrifarmasi WHERE kode_industri = ?`, b.KodeIndustri).Scan(&kodeBaruDipakai)
			if kodeBaruDipakai > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode baru sudah dipakai industri farmasi lain"})
				return
			}
		}

		res, err := db.Exec(
			`UPDATE industrifarmasi SET kode_industri=?, nama_industri=?, alamat=?, kota=?, no_telp=? WHERE kode_industri=?`,
			b.KodeIndustri, b.NamaIndustri, b.Alamat, b.Kota, b.NoTelp, kodeLama,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Industri farmasi berhasil diperbarui"})
	}
}

// deleteIndustriFarmasi — ditolak kalau masih dipakai databarang.kode_industri
// (tidak ada kolom status di tabel ini untuk nonaktifkan, jadi cuma bisa
// hapus beneran atau tidak sama sekali).
func deleteIndustriFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode wajib diisi"})
			return
		}
		var dipakai int
		db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_industri = ?`, kode).Scan(&dipakai)
		if dipakai > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Masih dipakai barang lain, tidak bisa dihapus"})
			return
		}
		res, err := db.Exec(`DELETE FROM industrifarmasi WHERE kode_industri = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Industri farmasi berhasil dihapus"})
	}
}
