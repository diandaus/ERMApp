package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// triase_igd_handler.go — endpoint SIMPAN utk Triase IGD (form Input Triase
// di PemeriksaanIGD.tsx / ModalInputTriase.tsx), TERPISAH dari
// riwayat_handler.go yang cuma baca (getTriaseIGD dkk, dipakai RiwayatModal
// nampilin data lama Khanza Desktop).
//
// Baru mencakup header data_triase_igd (Tgl.Kunjungan, Cara Masuk,
// Transportasi, Alasan Kedatangan, Keterangan, Kode/Macam Kasus) — kolom
// vitals (tekanan_darah, nadi, pernapasan, suhu, saturasi_o2, nyeri) dan
// tabel survey primer/sekunder/skala menyusul di iterasi berikutnya.
// ============================================================================

type masterTriaseMacamKasus struct {
	KodeKasus  string `json:"kode_kasus"`
	MacamKasus string `json:"macam_kasus"`
}

// GET /api/triase-igd-macam-kasus — daftar master utk dropdown "Macam
// Kasus". Path SENGAJA tanpa "/triase-igd/" bersarang — route GET
// /api/triase-igd/*no_rawat (riwayat_handler.go, getTriaseIGD) sudah
// pakai wildcard di situ, Gin panic kalau ditaruh static sibling di
// bawah prefix yang sama.
func getMasterTriaseMacamKasus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT kode_kasus, macam_kasus FROM master_triase_macam_kasus ORDER BY kode_kasus`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []masterTriaseMacamKasus{}
		for rows.Next() {
			var m masterTriaseMacamKasus
			if rows.Scan(&m.KodeKasus, &m.MacamKasus) == nil {
				list = append(list, m)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type masterTriaseSkalaItem struct {
	KodePemeriksaan string `json:"kode_pemeriksaan"`
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	KodeSkala       string `json:"kode_skala"`
	Pengkajian      string `json:"pengkajian"`
}

// GET /api/triase-igd-skala/:n (n=1..5) — checklist master utk tab Skala
// N (padanan tbSkala1..5/TabSkala1dan2/TabSkala3dan4dan5 di
// RMTriaseIGD.java). Beda dari Java yg 2 langkah (pilih kategori
// "Pemeriksaan" di tbPemeriksaan dulu baru tbSkalaN kefilter) — di sini
// SEKALIGUS dikirim semua item + nama_pemeriksaan-nya per skala,
// dikelompokkan di frontend, supaya tidak perlu klik kategori satu-satu
// (datanya kecil, cuma ~12-14 baris per skala).
func getMasterTriaseSkala(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		n := c.Param("n")
		if n != "1" && n != "2" && n != "3" && n != "4" && n != "5" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "skala harus 1-5"})
			return
		}

		// n divalidasi whitelist di atas sebelum diinterpolasi ke query —
		// aman dari SQL injection, tapi TETAP butuh Sprintf krn nama
		// tabel/kolom (master_triase_skalaN.kode_skalaN/pengkajian_skalaN)
		// tidak bisa jadi parameter placeholder ?.
		query := fmt.Sprintf(`
			SELECT master_triase_pemeriksaan.kode_pemeriksaan, master_triase_pemeriksaan.nama_pemeriksaan,
				master_triase_skala%s.kode_skala%s, master_triase_skala%s.pengkajian_skala%s
			FROM master_triase_skala%s
			INNER JOIN master_triase_pemeriksaan ON master_triase_pemeriksaan.kode_pemeriksaan = master_triase_skala%s.kode_pemeriksaan
			ORDER BY master_triase_pemeriksaan.kode_pemeriksaan, master_triase_skala%s.kode_skala%s
		`, n, n, n, n, n, n, n, n)

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []masterTriaseSkalaItem{}
		for rows.Next() {
			var it masterTriaseSkalaItem
			if rows.Scan(&it.KodePemeriksaan, &it.NamaPemeriksaan, &it.KodeSkala, &it.Pengkajian) == nil {
				list = append(list, it)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// saveTriaseRequest — payload POST /api/triase-igd/simpan, PERSIS field
// yg divalidasi di BtnSimpanActionPerformed (RMTriaseIGD.java): header
// data_triase_igd + satu jalur (Primer ATAU Sekunder, field union krn
// hanya SALAH SATU yg dikirim per request — sesuai Java yg juga hanya
// menyimpan jalur dari TabTriase yg aktif saat tombol Simpan diklik) +
// checklist skala dari SATU sub-tab yg aktif (Skala 1 ATAU 2 utk Primer;
// 3, 4, ATAU 5 utk Sekunder — Java: TabSkala1dan2/TabSkala3dan4dan5).
type saveTriaseRequest struct {
	NoRawat              string `json:"no_rawat" binding:"required"`
	TglKunjungan         string `json:"tgl_kunjungan" binding:"required"`
	JamKunjungan         string `json:"jam_kunjungan" binding:"required"`
	CaraMasuk            string `json:"cara_masuk" binding:"required"`
	AlatTransportasi     string `json:"alat_transportasi" binding:"required"`
	AlasanKedatangan     string `json:"alasan_kedatangan" binding:"required"`
	KeteranganKedatangan string `json:"keterangan_kedatangan" binding:"required"`
	KodeKasus            string `json:"kode_kasus" binding:"required"`

	Jalur string `json:"jalur" binding:"required"` // "primer" | "sekunder"

	// Vitals — data_triase_igd.tekanan_darah/nadi/pernapasan/suhu/saturasi_o2/nyeri
	Tensi     string `json:"tensi" binding:"required"`
	Nadi      string `json:"nadi" binding:"required"`
	Respirasi string `json:"respirasi" binding:"required"`
	Suhu      string `json:"suhu" binding:"required"`
	Saturasi  string `json:"saturasi" binding:"required"`
	Nyeri     string `json:"nyeri" binding:"required"`

	PetugasNik string `json:"petugas_nik" binding:"required"`
	Plan       string `json:"plan" binding:"required"`
	TglTriase  string `json:"tgl_triase" binding:"required"`
	JamTriase  string `json:"jam_triase" binding:"required"`
	Catatan    string `json:"catatan" binding:"required"`

	KeluhanUtama    string `json:"keluhan_utama"`    // wajib jika Jalur=="primer"
	KebutuhanKhusus string `json:"kebutuhan_khusus"` // wajib jika Jalur=="primer"
	AnamnesaSingkat string `json:"anamnesa_singkat"` // wajib jika Jalur=="sekunder"

	SkalaNomor int      `json:"skala_nomor" binding:"required"` // 1/2 (primer) atau 3/4/5 (sekunder)
	SkalaKode  []string `json:"skala_kode" binding:"required"`  // minimal 1 (Valid.textKosong di Java jg wajibkan ini)
}

// POST /api/triase-igd/simpan
func saveTriaseIGD(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req saveTriaseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.Jalur != "primer" && req.Jalur != "sekunder" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "jalur harus 'primer' atau 'sekunder'"})
			return
		}
		if req.Jalur == "primer" {
			if strings.TrimSpace(req.KeluhanUtama) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Keluhan Utama wajib diisi"})
				return
			}
			if req.KebutuhanKhusus == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kebutuhan Khusus wajib diisi"})
				return
			}
			if req.SkalaNomor != 1 && req.SkalaNomor != 2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "skala_nomor harus 1 atau 2 utk jalur primer"})
				return
			}
		} else {
			if strings.TrimSpace(req.AnamnesaSingkat) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Anamnesa Singkat wajib diisi"})
				return
			}
			if req.SkalaNomor != 3 && req.SkalaNomor != 4 && req.SkalaNomor != 5 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "skala_nomor harus 3, 4, atau 5 utk jalur sekunder"})
				return
			}
		}
		if len(req.SkalaKode) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 checklist Skala harus dicentang"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rollback := func(msg string) {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		}

		// 1. Header data_triase_igd — 13 kolom, PERSIS urutan Java
		// (Sequel.menyimpantf("data_triase_igd", ..., 13, ...)).
		_, err = tx.Exec(`
			INSERT INTO data_triase_igd
				(no_rawat, tgl_kunjungan, cara_masuk, alat_transportasi, alasan_kedatangan,
				 keterangan_kedatangan, kode_kasus, tekanan_darah, nadi, pernapasan, suhu, saturasi_o2, nyeri)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, req.NoRawat, req.TglKunjungan+" "+req.JamKunjungan+":00", req.CaraMasuk, req.AlatTransportasi,
			req.AlasanKedatangan, req.KeteranganKedatangan, req.KodeKasus,
			req.Tensi, req.Nadi, req.Respirasi, req.Suhu, req.Saturasi, req.Nyeri)
		if err != nil {
			rollback("Gagal menyimpan data_triase_igd: " + err.Error())
			return
		}

		tanggalTriase := req.TglTriase + " " + req.JamTriase + ":00"

		if req.Jalur == "primer" {
			// 2a. data_triase_igdprimer — 7 kolom.
			_, err = tx.Exec(`
				INSERT INTO data_triase_igdprimer
					(no_rawat, keluhan_utama, kebutuhan_khusus, catatan, plan, tanggaltriase, nik)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, req.NoRawat, req.KeluhanUtama, req.KebutuhanKhusus, req.Catatan, req.Plan, tanggalTriase, req.PetugasNik)
			if err != nil {
				rollback("Gagal menyimpan data_triase_igdprimer: " + err.Error())
				return
			}
		} else {
			// 2b. data_triase_igdsekunder — 6 kolom.
			_, err = tx.Exec(`
				INSERT INTO data_triase_igdsekunder
					(no_rawat, anamnesa_singkat, catatan, plan, tanggaltriase, nik)
				VALUES (?, ?, ?, ?, ?, ?)
			`, req.NoRawat, req.AnamnesaSingkat, req.Catatan, req.Plan, tanggalTriase, req.PetugasNik)
			if err != nil {
				rollback("Gagal menyimpan data_triase_igdsekunder: " + err.Error())
				return
			}
		}

		// 3. Checklist skala — data_triase_igddetail_skalaN (no_rawat, kode_skalaN),
		// satu baris per item yg dicentang di sub-tab yg aktif.
		detailTable := fmt.Sprintf("data_triase_igddetail_skala%d", req.SkalaNomor)
		kodeCol := fmt.Sprintf("kode_skala%d", req.SkalaNomor)
		insertDetailQuery := fmt.Sprintf(`INSERT INTO %s (no_rawat, %s) VALUES (?, ?)`, detailTable, kodeCol)
		for _, kode := range req.SkalaKode {
			if _, err = tx.Exec(insertDetailQuery, req.NoRawat, kode); err != nil {
				rollback(fmt.Sprintf("Gagal menyimpan %s: %s", detailTable, err.Error()))
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Triase berhasil disimpan"})
	}
}
