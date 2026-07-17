package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Pengaturan Depo (item #1 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Oto Lokasi" (setting/DlgSetOtoLokasi.java,
// dibuka lewat tombol "Set Oto Lokasi" di menu utama), yang punya 3 tab:
//   1. Pengaturan Lokasi (set_lokasi)     — asal stok yang ditampilkan
//      apotek: stok utama obat atau stok per-bangsal. HANYA SATU baris
//      diperbolehkan sistem-wide (dicek Java lewat row count sebelum
//      insert) — "edit" di Java sebenarnya delete lalu insert ulang.
//   2. Pengaturan Depo Ralan (set_depo_ralan) — depo obat per poliklinik
//      rawat jalan. PK majemuk (kd_poli, kd_bangsal).
//   3. Pengaturan Depo Ranap (set_depo_ranap) — depo obat per bangsal
//      rawat inap. PK majemuk (kd_bangsal, kd_depo).
// kd_bangsal/kd_depo di ketiganya mengacu ke tabel `bangsal` yang sama
// (termasuk baris "AP"=Apotek, "GD"=Gudang yang biasa dipakai sebagai
// depo) — bukan tabel referensi terpisah.
// ============================================================================

// resolveDepoRalan/resolveDepoRanap — dipakai fitur resep (resep_handler.go,
// resep_ranap_handler.go) untuk benar-benar membaca Pengaturan Depo saat
// mencari stok obat, alih-alih hardcode "AP". Balik "" kalau no_rawat kosong
// atau belum ada pengaturan untuk poli/bangsal kunjungan itu — caller yang
// menentukan fallback (biasanya "AP").

// resolveDepoRalan mencari depo obat rawat jalan lewat poliklinik kunjungan
// (reg_periksa.kd_poli -> set_depo_ralan.kd_bangsal).
func resolveDepoRalan(db *sql.DB, noRawat string) string {
	if strings.TrimSpace(noRawat) == "" {
		return ""
	}
	var kdBangsal string
	err := db.QueryRow(`
		SELECT sdr.kd_bangsal
		FROM reg_periksa rp
		INNER JOIN set_depo_ralan sdr ON sdr.kd_poli = rp.kd_poli
		WHERE rp.no_rawat = ?
		LIMIT 1
	`, noRawat).Scan(&kdBangsal)
	if err != nil {
		return ""
	}
	return kdBangsal
}

// resolveDepoRanap mencari depo obat rawat inap lewat bangsal/kamar aktif
// pasien saat ini (kamar_inap -> kamar.kd_bangsal -> set_depo_ranap.kd_depo).
// Diurutkan tgl_masuk/jam_masuk terbaru untuk menangani kasus pasien pindah
// kamar selama dirawat.
func resolveDepoRanap(db *sql.DB, noRawat string) string {
	if strings.TrimSpace(noRawat) == "" {
		return ""
	}
	var kdDepo string
	err := db.QueryRow(`
		SELECT sdr.kd_depo
		FROM kamar_inap ki
		INNER JOIN kamar k ON k.kd_kamar = ki.kd_kamar
		INNER JOIN set_depo_ranap sdr ON sdr.kd_bangsal = k.kd_bangsal
		WHERE ki.no_rawat = ?
		ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC
		LIMIT 1
	`, noRawat).Scan(&kdDepo)
	if err != nil {
		return ""
	}
	return kdDepo
}

type depoOpsiKv struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

// getApotekPengaturanDepoOpsi menyediakan daftar bangsal & poliklinik untuk
// dropdown ketiga sub-tab Pengaturan Depo, sekali panggil.
func getApotekPengaturanDepoOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		bangsal := []depoOpsiKv{}
		rows, err := db.Query(`SELECT kd_bangsal, nm_bangsal FROM bangsal WHERE kd_bangsal <> '-' AND status = '1' ORDER BY nm_bangsal`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var k depoOpsiKv
				if rows.Scan(&k.Kode, &k.Nama) == nil {
					bangsal = append(bangsal, k)
				}
			}
		}

		poliklinik := []depoOpsiKv{}
		rows2, err := db.Query(`SELECT kd_poli, nm_poli FROM poliklinik WHERE kd_poli <> '-' AND status = '1' ORDER BY nm_poli`)
		if err == nil {
			defer rows2.Close()
			for rows2.Next() {
				var k depoOpsiKv
				if rows2.Scan(&k.Kode, &k.Nama) == nil {
					poliklinik = append(poliklinik, k)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"bangsal": bangsal, "poliklinik": poliklinik})
	}
}

// ---- Tab 1: Pengaturan Lokasi (set_lokasi) --------------------------------

type setLokasi struct {
	KdBangsal string `json:"kd_bangsal"`
	NmBangsal string `json:"nm_bangsal"`
	AsalStok  string `json:"asal_stok"`
}

// getApotekLokasi mengembalikan satu-satunya baris set_lokasi (atau null
// kalau belum pernah diatur).
func getApotekLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var l setLokasi
		err := db.QueryRow(`
			SELECT sl.kd_bangsal, COALESCE(b.nm_bangsal,''), sl.asal_stok
			FROM set_lokasi sl LEFT JOIN bangsal b ON b.kd_bangsal = sl.kd_bangsal
			LIMIT 1
		`).Scan(&l.KdBangsal, &l.NmBangsal, &l.AsalStok)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, l)
	}
}

// saveApotekLokasi meniru perilaku "Simpan"/"Edit" Java: karena cuma boleh
// satu baris system-wide, selalu bersihkan baris lama lalu insert baru
// (dibungkus transaksi supaya tidak sempat kosong kalau insert gagal).
func saveApotekLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsal string `json:"kd_bangsal"`
			AsalStok  string `json:"asal_stok"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KdBangsal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode lokasi wajib diisi"})
			return
		}
		if body.AsalStok != "Gunakan Stok Utama Obat" && body.AsalStok != "Gunakan Stok Bangsal" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asal stok tidak valid"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM set_lokasi`); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`INSERT INTO set_lokasi (kd_bangsal, asal_stok) VALUES (?, ?)`, body.KdBangsal, body.AsalStok); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan lokasi berhasil disimpan"})
	}
}

// deleteApotekLokasi mengosongkan pengaturan lokasi.
func deleteApotekLokasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM set_lokasi`); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan lokasi berhasil dihapus"})
	}
}

// ---- Tab 2: Pengaturan Depo Ralan (set_depo_ralan) -------------------------

type depoRalan struct {
	KdPoli    string `json:"kd_poli"`
	NmPoli    string `json:"nm_poli"`
	KdBangsal string `json:"kd_bangsal"`
	NmBangsal string `json:"nm_bangsal"`
}

func getApotekDepoRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT sdr.kd_poli, p.nm_poli, sdr.kd_bangsal, b.nm_bangsal
			FROM set_depo_ralan sdr
			INNER JOIN poliklinik p ON p.kd_poli = sdr.kd_poli
			INNER JOIN bangsal b ON b.kd_bangsal = sdr.kd_bangsal
			ORDER BY p.nm_poli
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []depoRalan{}
		for rows.Next() {
			var d depoRalan
			if rows.Scan(&d.KdPoli, &d.NmPoli, &d.KdBangsal, &d.NmBangsal) == nil {
				items = append(items, d)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createApotekDepoRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdPoli    string `json:"kd_poli"`
			KdBangsal string `json:"kd_bangsal"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.KdPoli == "" || body.KdBangsal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Poliklinik dan depo wajib diisi"})
			return
		}
		_, err := db.Exec(`INSERT INTO set_depo_ralan (kd_poli, kd_bangsal) VALUES (?, ?)`, body.KdPoli, body.KdBangsal)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Poliklinik ini sudah punya pengaturan depo dengan lokasi tersebut"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat jalan berhasil ditambahkan"})
	}
}

func updateApotekDepoRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			OrigKdPoli    string `json:"orig_kd_poli"`
			OrigKdBangsal string `json:"orig_kd_bangsal"`
			KdPoli        string `json:"kd_poli"`
			KdBangsal     string `json:"kd_bangsal"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.KdPoli == "" || body.KdBangsal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Poliklinik dan depo wajib diisi"})
			return
		}
		res, err := db.Exec(
			`UPDATE set_depo_ralan SET kd_poli=?, kd_bangsal=? WHERE kd_poli=? AND kd_bangsal=?`,
			body.KdPoli, body.KdBangsal, body.OrigKdPoli, body.OrigKdBangsal,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat jalan berhasil diperbarui"})
	}
}

func deleteApotekDepoRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPoli := c.Query("kd_poli")
		kdBangsal := c.Query("kd_bangsal")
		if kdPoli == "" || kdBangsal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Poliklinik dan depo wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM set_depo_ralan WHERE kd_poli=? AND kd_bangsal=?`, kdPoli, kdBangsal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat jalan berhasil dihapus"})
	}
}

// ---- Tab 3: Pengaturan Depo Ranap (set_depo_ranap) --------------------------

type depoRanap struct {
	KdBangsal string `json:"kd_bangsal"`
	NmBangsal string `json:"nm_bangsal"`
	KdDepo    string `json:"kd_depo"`
	NmDepo    string `json:"nm_depo"`
}

func getApotekDepoRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT sdr.kd_bangsal, b.nm_bangsal, sdr.kd_depo, d.nm_bangsal
			FROM set_depo_ranap sdr
			INNER JOIN bangsal b ON b.kd_bangsal = sdr.kd_bangsal
			INNER JOIN bangsal d ON d.kd_bangsal = sdr.kd_depo
			ORDER BY b.nm_bangsal
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []depoRanap{}
		for rows.Next() {
			var d depoRanap
			if rows.Scan(&d.KdBangsal, &d.NmBangsal, &d.KdDepo, &d.NmDepo) == nil {
				items = append(items, d)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createApotekDepoRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsal string `json:"kd_bangsal"`
			KdDepo    string `json:"kd_depo"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.KdBangsal == "" || body.KdDepo == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bangsal dan depo wajib diisi"})
			return
		}
		_, err := db.Exec(`INSERT INTO set_depo_ranap (kd_bangsal, kd_depo) VALUES (?, ?)`, body.KdBangsal, body.KdDepo)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Bangsal ini sudah punya pengaturan depo dengan lokasi tersebut"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat inap berhasil ditambahkan"})
	}
}

func updateApotekDepoRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			OrigKdBangsal string `json:"orig_kd_bangsal"`
			OrigKdDepo    string `json:"orig_kd_depo"`
			KdBangsal     string `json:"kd_bangsal"`
			KdDepo        string `json:"kd_depo"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.KdBangsal == "" || body.KdDepo == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bangsal dan depo wajib diisi"})
			return
		}
		res, err := db.Exec(
			`UPDATE set_depo_ranap SET kd_bangsal=?, kd_depo=? WHERE kd_bangsal=? AND kd_depo=?`,
			body.KdBangsal, body.KdDepo, body.OrigKdBangsal, body.OrigKdDepo,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat inap berhasil diperbarui"})
	}
}

func deleteApotekDepoRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdBangsal := c.Query("kd_bangsal")
		kdDepo := c.Query("kd_depo")
		if kdBangsal == "" || kdDepo == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bangsal dan depo wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM set_depo_ranap WHERE kd_bangsal=? AND kd_depo=?`, kdBangsal, kdDepo)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Depo rawat inap berhasil dihapus"})
	}
}
