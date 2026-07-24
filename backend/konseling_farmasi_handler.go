package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RESEP — Konseling Farmasi. Padanan rekammedis/RMKonselingFarmasi.java
// (dipanggil dari BtnKonselingFarmasi di DlgDaftarPermintaanResep.java, sama
// baris toolbar dengan BtnRiwayat/BtnPemberianObat — bekerja atas
// PASIEN/RESEP yang sedang dipilih di Daftar Resep Dokter). Di React ini
// dibuatkan tab sidebar sendiri "Konseling Farmasi" dengan layar cari
// sendiri (sama pola dengan Telaah Resep, sesuai preferensi user
// sebelumnya: dedicated tab + search screen, bukan tombol per-baris).
//
// Tabel `konseling_farmasi`: PK no_rawat (SATU catatan konseling per
// kunjungan/no_rawat, FK ke reg_periksa ON DELETE/UPDATE CASCADE) — beda
// dari Telaah Resep yang PK-nya no_resep. Java punya Simpan(INSERT-only)
// + Ganti(UPDATE-only) terpisah; di sini SENGAJA disatukan jadi satu
// UPSERT (INSERT ... ON DUPLICATE KEY UPDATE) — pola sama dengan Telaah
// Resep, menghindari kuirk Java yang gagal senyap kalau baris belum ada
// saat "Ganti" dipanggil.
//
// Field TglLahir/JK di form Java cuma tampilan konteks (bukan kolom yang
// disimpan ke konseling_farmasi) — sudah tersedia dari ResepRalanRow yang
// dikirim dari layar Daftar Resep Dokter, jadi tidak perlu di-query ulang
// di sini. `tanggal` diisi otomatis NOW() tiap simpan (padanan
// Tanggal/Jam/Menit/Detik picker Java yang di web ini disederhanakan jadi
// otomatis, sama pola dengan Telaah Resep/Penyerahan Resep).
// ============================================================================

type konselingFarmasi struct {
	NoRawat        string `json:"no_rawat"`
	Tanggal        string `json:"tanggal"`
	Diagnosa       string `json:"diagnosa"`
	ObatPemakaian  string `json:"obat_pemakaian"`
	RiwayatAlergi  string `json:"riwayat_alergi"`
	Keluhan        string `json:"keluhan"`
	PernahDatang   string `json:"pernah_datang"`
	TindakLanjut   string `json:"tindak_lanjut"`
	Nip            string `json:"nip"`
	NamaPetugas    string `json:"nama_petugas"`
	SudahKonseling bool   `json:"sudah_konseling"`
}

func konselingFarmasiDefault(noRawat string) konselingFarmasi {
	return konselingFarmasi{
		NoRawat:      noRawat,
		PernahDatang: "Tidak",
	}
}

// getKonselingFarmasi — padanan getData()/pengisian form saat baris
// dipilih di tbObat Java. Kalau belum pernah ada catatan untuk no_rawat
// ini, kembalikan default kosong (SudahKonseling=false) supaya frontend
// tahu ini entri baru, bukan error.
func getKonselingFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var k konselingFarmasi
		err := db.QueryRow(
			`SELECT k.no_rawat, k.tanggal, COALESCE(k.diagnosa,''), COALESCE(k.obat_pemakaian,''),
				COALESCE(k.riwayat_alergi,''), COALESCE(k.keluhan,''), COALESCE(k.pernah_datang,'Tidak'),
				COALESCE(k.tindak_lanjut,''), k.nip, COALESCE(p.nama,'')
			FROM konseling_farmasi k
			LEFT JOIN petugas p ON p.nip = k.nip
			WHERE k.no_rawat = ?`,
			noRawat,
		).Scan(&k.NoRawat, &k.Tanggal, &k.Diagnosa, &k.ObatPemakaian, &k.RiwayatAlergi, &k.Keluhan,
			&k.PernahDatang, &k.TindakLanjut, &k.Nip, &k.NamaPetugas)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, konselingFarmasiDefault(noRawat))
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		k.SudahKonseling = true
		c.JSON(http.StatusOK, k)
	}
}

// saveKonselingFarmasi — padanan simpan()+ganti() Java, disatukan jadi
// UPSERT. Validasi wajib isi SAMA seperti BtnSimpanActionPerformed Java:
// no_rawat, petugas(nip), diagnosa, obat_pemakaian, keluhan, tindak_lanjut
// — riwayat_alergi & pernah_datang TIDAK wajib (replikasi persis, bukan
// dikuatkan).
func saveKonselingFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body konselingFarmasi
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payload tidak valid"})
			return
		}
		body.NoRawat = strings.TrimSpace(body.NoRawat)
		body.Nip = strings.TrimSpace(body.Nip)
		body.Diagnosa = strings.TrimSpace(body.Diagnosa)
		body.ObatPemakaian = strings.TrimSpace(body.ObatPemakaian)
		body.Keluhan = strings.TrimSpace(body.Keluhan)
		body.TindakLanjut = strings.TrimSpace(body.TindakLanjut)

		if body.NoRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum dipilih"})
			return
		}
		if body.Nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas/Apoteker wajib diisi"})
			return
		}
		if body.Diagnosa == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Diagnosa wajib diisi"})
			return
		}
		if body.ObatPemakaian == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama Obat, Dosis & Cara Pemakaian wajib diisi"})
			return
		}
		if body.Keluhan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keluhan wajib diisi"})
			return
		}
		if body.TindakLanjut == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tindak Lanjut wajib diisi"})
			return
		}
		if body.PernahDatang != "Ya" {
			body.PernahDatang = "Tidak"
		}

		_, err := db.Exec(
			`INSERT INTO konseling_farmasi (no_rawat, tanggal, diagnosa, obat_pemakaian, riwayat_alergi, keluhan, pernah_datang, tindak_lanjut, nip)
			 VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE tanggal=NOW(), diagnosa=VALUES(diagnosa), obat_pemakaian=VALUES(obat_pemakaian),
				riwayat_alergi=VALUES(riwayat_alergi), keluhan=VALUES(keluhan), pernah_datang=VALUES(pernah_datang),
				tindak_lanjut=VALUES(tindak_lanjut), nip=VALUES(nip)`,
			body.NoRawat, body.Diagnosa, body.ObatPemakaian, body.RiwayatAlergi, body.Keluhan, body.PernahDatang, body.TindakLanjut, body.Nip,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
