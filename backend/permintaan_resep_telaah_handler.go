package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RESEP — Aksi "Telaah Resep" (checklist tinjauan farmasi
// sebelum obat diserahkan). Cocok dengan inventory/InventoryTelaahResep.java
// (2155 baris) — dialog terpisah yang juga dipanggil dari DlgResepObat.java/
// DlgCariObat.java (bukan cuma dari DlgDaftarPermintaanResep.java).
//
// Isinya 2 kelompok pertanyaan Ya/Tidak (skala "7 Benar" farmasi klinis
// standar RS di Indonesia):
//   Telaah Resep (8 item, MASING-MASING punya kolom keterangan bebas):
//     1. Tepat Identifikasi Pasien   5. Tepat Waktu Pemberian
//     2. Tepat Obat                  6. Ada/Tidak Duplikasi Obat
//     3. Tepat Dosis                 7. Interaksi Obat
//     4. Tepat Cara Pemberian        8. Kontra Indikasi Obat
//   Telaah Obat (5 item, TANPA keterangan — sesuai skema tabel):
//     1. Tepat Pasien   3. Tepat Dosis   5. Tepat Waktu Pemberian
//     2. Tepat Obat     4. Tepat Cara Pemberian
//
// Tabel: telaah_farmasi (no_resep PK, 8×2 kolom resep_*/resep_ket_*, 5
// kolom obat_*, nip — semua Ya/Tidak enum kecuali kolom ket_ yang bebas
// teks, lihat DESCRIBE asli di riset sebelum implementasi).
//
// **Penyederhanaan yang disengaja**: Java punya 2 tombol terpisah —
// "Simpan" (Sequel.menyimpantf, INSERT — dipakai utk telaah baru, dari
// dialog pencarian/tambah terpisah) dan "Edit"/"Ganti" (Sequel.mengedittf,
// UPDATE MURNI tanpa fallback insert — bahkan tidak ditemukan jalur INSERT
// lain di seluruh source Java untuk tabel ini di luar BtnSimpan, jadi
// "Edit" di Java SECARA DIAM-DIAM GAGAL kalau baris belum pernah dibuat
// lewat Simpan dulu — kemungkinan quirk/bug lama Khanza sendiri, BUKAN
// alur yang sengaja kami tiru). Di sini cuma SATU aksi "Simpan" yang
// selalu benar (INSERT ... ON DUPLICATE KEY UPDATE) — modal dibuka
// langsung dari baris resep yang sudah pasti ada (no_resep, no_rawat,
// nama pasien sudah di tangan React, tidak perlu validasi "textKosong"
// terpisah seperti Java).
// ============================================================================

type telaahFarmasi struct {
	NoResep                       string `json:"no_resep"`
	ResepIdentifikasiPasien       string `json:"resep_identifikasi_pasien"`
	ResepKetIdentifikasiPasien    string `json:"resep_ket_identifikasi_pasien"`
	ResepTepatObat                string `json:"resep_tepat_obat"`
	ResepKetTepatObat             string `json:"resep_ket_tepat_obat"`
	ResepTepatDosis               string `json:"resep_tepat_dosis"`
	ResepKetTepatDosis            string `json:"resep_ket_tepat_dosis"`
	ResepTepatCaraPemberian       string `json:"resep_tepat_cara_pemberian"`
	ResepKetTepatCaraPemberian    string `json:"resep_ket_tepat_cara_pemberian"`
	ResepTepatWaktuPemberian      string `json:"resep_tepat_waktu_pemberian"`
	ResepKetTepatWaktuPemberian   string `json:"resep_ket_tepat_waktu_pemberian"`
	ResepAdaTidakDuplikasiObat    string `json:"resep_ada_tidak_duplikasi_obat"`
	ResepKetAdaTidakDuplikasiObat string `json:"resep_ket_ada_tidak_duplikasi_obat"`
	ResepInteraksiObat            string `json:"resep_interaksi_obat"`
	ResepKetInteraksiObat         string `json:"resep_ket_interaksi_obat"`
	ResepKontraIndikasiObat       string `json:"resep_kontra_indikasi_obat"`
	ResepKetKontraIndikasiObat    string `json:"resep_ket_kontra_indikasi_obat"`
	ObatTepatPasien               string `json:"obat_tepat_pasien"`
	ObatTepatObat                 string `json:"obat_tepat_obat"`
	ObatTepatDosis                string `json:"obat_tepat_dosis"`
	ObatTepatCaraPemberian        string `json:"obat_tepat_cara_pemberian"`
	ObatTepatWaktuPemberian       string `json:"obat_tepat_waktu_pemberian"`
	Nip                           string `json:"nip"`
	NamaPetugas                   string `json:"nama_petugas"`
	SudahAda                      bool   `json:"sudah_ada"`
}

// telaahDefault — "Ya" utk semua field Ya/Tidak (padanan default index-0
// DefaultComboBoxModel Java, {"Ya","Tidak"}) saat belum pernah ditelaah.
func telaahDefault(noResep string) telaahFarmasi {
	return telaahFarmasi{
		NoResep:                    noResep,
		ResepIdentifikasiPasien:    "Ya",
		ResepTepatObat:             "Ya",
		ResepTepatDosis:            "Ya",
		ResepTepatCaraPemberian:    "Ya",
		ResepTepatWaktuPemberian:   "Ya",
		ResepAdaTidakDuplikasiObat: "Ya",
		ResepInteraksiObat:         "Ya",
		ResepKontraIndikasiObat:    "Ya",
		ObatTepatPasien:            "Ya",
		ObatTepatObat:              "Ya",
		ObatTepatDosis:             "Ya",
		ObatTepatCaraPemberian:     "Ya",
		ObatTepatWaktuPemberian:    "Ya",
	}
}

func getTelaahFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := strings.TrimPrefix(c.Param("no_resep"), "/")

		var t telaahFarmasi
		var ketIdent, ketObat, ketDosis, ketCara, ketWaktu, ketDup, ketInteraksi, ketKontra, nip, namaPetugas sql.NullString
		err := db.QueryRow(`
			SELECT tf.no_resep, tf.resep_identifikasi_pasien, tf.resep_ket_identifikasi_pasien,
				tf.resep_tepat_obat, tf.resep_ket_tepat_obat, tf.resep_tepat_dosis, tf.resep_ket_tepat_dosis,
				tf.resep_tepat_cara_pemberian, tf.resep_ket_tepat_cara_pemberian,
				tf.resep_tepat_waktu_pemberian, tf.resep_ket_tepat_waktu_pemberian,
				tf.resep_ada_tidak_duplikasi_obat, tf.resep_ket_ada_tidak_duplikasi_obat,
				tf.resep_interaksi_obat, tf.resep_ket_interaksi_obat,
				tf.resep_kontra_indikasi_obat, tf.resep_ket_kontra_indikasi_obat,
				tf.obat_tepat_pasien, tf.obat_tepat_obat, tf.obat_tepat_dosis,
				tf.obat_tepat_cara_pemberian, tf.obat_tepat_waktu_pemberian,
				tf.nip, COALESCE(pg.nama,'')
			FROM telaah_farmasi tf
			LEFT JOIN petugas pg ON pg.nip = tf.nip
			WHERE tf.no_resep = ?
		`, noResep).Scan(
			&t.NoResep, &t.ResepIdentifikasiPasien, &ketIdent,
			&t.ResepTepatObat, &ketObat, &t.ResepTepatDosis, &ketDosis,
			&t.ResepTepatCaraPemberian, &ketCara,
			&t.ResepTepatWaktuPemberian, &ketWaktu,
			&t.ResepAdaTidakDuplikasiObat, &ketDup,
			&t.ResepInteraksiObat, &ketInteraksi,
			&t.ResepKontraIndikasiObat, &ketKontra,
			&t.ObatTepatPasien, &t.ObatTepatObat, &t.ObatTepatDosis,
			&t.ObatTepatCaraPemberian, &t.ObatTepatWaktuPemberian,
			&nip, &namaPetugas,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, telaahDefault(noResep))
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		t.ResepKetIdentifikasiPasien = ketIdent.String
		t.ResepKetTepatObat = ketObat.String
		t.ResepKetTepatDosis = ketDosis.String
		t.ResepKetTepatCaraPemberian = ketCara.String
		t.ResepKetTepatWaktuPemberian = ketWaktu.String
		t.ResepKetAdaTidakDuplikasiObat = ketDup.String
		t.ResepKetInteraksiObat = ketInteraksi.String
		t.ResepKetKontraIndikasiObat = ketKontra.String
		t.Nip = nip.String
		t.NamaPetugas = namaPetugas.String
		t.SudahAda = true
		c.JSON(http.StatusOK, t)
	}
}

func saveTelaahFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body telaahFarmasi
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.NoResep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Resep wajib diisi"})
			return
		}
		if strings.TrimSpace(body.Nip) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas wajib diisi"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO telaah_farmasi (
				no_resep, resep_identifikasi_pasien, resep_ket_identifikasi_pasien,
				resep_tepat_obat, resep_ket_tepat_obat, resep_tepat_dosis, resep_ket_tepat_dosis,
				resep_tepat_cara_pemberian, resep_ket_tepat_cara_pemberian,
				resep_tepat_waktu_pemberian, resep_ket_tepat_waktu_pemberian,
				resep_ada_tidak_duplikasi_obat, resep_ket_ada_tidak_duplikasi_obat,
				resep_interaksi_obat, resep_ket_interaksi_obat,
				resep_kontra_indikasi_obat, resep_ket_kontra_indikasi_obat,
				obat_tepat_pasien, obat_tepat_obat, obat_tepat_dosis,
				obat_tepat_cara_pemberian, obat_tepat_waktu_pemberian, nip
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				resep_identifikasi_pasien=VALUES(resep_identifikasi_pasien),
				resep_ket_identifikasi_pasien=VALUES(resep_ket_identifikasi_pasien),
				resep_tepat_obat=VALUES(resep_tepat_obat), resep_ket_tepat_obat=VALUES(resep_ket_tepat_obat),
				resep_tepat_dosis=VALUES(resep_tepat_dosis), resep_ket_tepat_dosis=VALUES(resep_ket_tepat_dosis),
				resep_tepat_cara_pemberian=VALUES(resep_tepat_cara_pemberian),
				resep_ket_tepat_cara_pemberian=VALUES(resep_ket_tepat_cara_pemberian),
				resep_tepat_waktu_pemberian=VALUES(resep_tepat_waktu_pemberian),
				resep_ket_tepat_waktu_pemberian=VALUES(resep_ket_tepat_waktu_pemberian),
				resep_ada_tidak_duplikasi_obat=VALUES(resep_ada_tidak_duplikasi_obat),
				resep_ket_ada_tidak_duplikasi_obat=VALUES(resep_ket_ada_tidak_duplikasi_obat),
				resep_interaksi_obat=VALUES(resep_interaksi_obat), resep_ket_interaksi_obat=VALUES(resep_ket_interaksi_obat),
				resep_kontra_indikasi_obat=VALUES(resep_kontra_indikasi_obat),
				resep_ket_kontra_indikasi_obat=VALUES(resep_ket_kontra_indikasi_obat),
				obat_tepat_pasien=VALUES(obat_tepat_pasien), obat_tepat_obat=VALUES(obat_tepat_obat),
				obat_tepat_dosis=VALUES(obat_tepat_dosis), obat_tepat_cara_pemberian=VALUES(obat_tepat_cara_pemberian),
				obat_tepat_waktu_pemberian=VALUES(obat_tepat_waktu_pemberian), nip=VALUES(nip)
		`,
			body.NoResep, body.ResepIdentifikasiPasien, body.ResepKetIdentifikasiPasien,
			body.ResepTepatObat, body.ResepKetTepatObat, body.ResepTepatDosis, body.ResepKetTepatDosis,
			body.ResepTepatCaraPemberian, body.ResepKetTepatCaraPemberian,
			body.ResepTepatWaktuPemberian, body.ResepKetTepatWaktuPemberian,
			body.ResepAdaTidakDuplikasiObat, body.ResepKetAdaTidakDuplikasiObat,
			body.ResepInteraksiObat, body.ResepKetInteraksiObat,
			body.ResepKontraIndikasiObat, body.ResepKetKontraIndikasiObat,
			body.ObatTepatPasien, body.ObatTepatObat, body.ObatTepatDosis,
			body.ObatTepatCaraPemberian, body.ObatTepatWaktuPemberian, body.Nip,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Telaah resep berhasil disimpan"})
	}
}
