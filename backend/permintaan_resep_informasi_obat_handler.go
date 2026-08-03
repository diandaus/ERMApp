package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RESEP — Informasi Obat (Pelayanan Informasi Obat/PIO). Padanan
// permintaan/DlgPermintaanPelayananInformasiObat.java (2213 baris),
// dipanggil dari BtnInformasiObat di DlgDaftarPermintaanResep.java atas
// baris resep/kunjungan (no_rawat) yang sedang dipilih — tombol toolbar
// dengan pola yang SAMA dengan BtnKonselingFarmasi, jadi di sini dibuatkan
// dedicated tab "Informasi Obat" dengan layar cari sendiri, IDENTIK
// strukturnya dengan Telaah Resep/Konseling Farmasi (lihat komentar di
// permintaan_resep_telaah_handler.go & konseling_farmasi_handler.go).
//
// BEDA PENTING dari Telaah/Konseling: PK tabel `pelayanan_informasi_obat`
// adalah no_permintaan (BUKAN no_resep/no_rawat) — satu kunjungan
// (no_rawat) BISA punya banyak pertanyaan PIO (satu per telepon/tanya
// pasien/dst.), masing-masing dijawab terpisah lewat `jawaban_pio_apoteker`
// (PK-nya juga no_permintaan, LEFT JOIN 1:1). Makanya endpoint di sini
// list-based (banyak entri per no_rawat) — getInformasiObatList mengganti
// pola get/upsert tunggal ala getKonselingFarmasi.
//
// no_permintaan di-generate dengan pola PERSIS autoNomor() Java: prefix
// "PIO"+tanggal(YYYYMMDD), 4 digit urut per tanggal (MAX suffix existing+1)
// — lihat generateNoPermintaanObat di apotek_permintaan_handler.go untuk
// pola sama (prefix "PM", 3 digit) yang jadi rujukan konvensi proyek ini.
// SATU DEVIASI DISENGAJA dari query Java: lookup MAX suffix di sini pakai
// `DATE(tanggal)=?` (bukan `tanggal=?` mentah seperti Java) karena kolom
// `tanggal` DATETIME (bukan DATE seperti permintaan_medis) — perbandingan
// string mentah ala Java cuma cocok jam 00:00:00, nyaris selalu gagal
// mendeteksi nomor urut hari itu (kemungkinan quirk/bug lama Khanza
// sendiri, bukan alur yang sengaja kami tiru — sama semangat catatan di
// permintaan_resep_telaah_handler.go).
// ============================================================================

type informasiObatItem struct {
	NoPermintaan              string `json:"no_permintaan"`
	NoRawat                   string `json:"no_rawat"`
	Tanggal                   string `json:"tanggal"`
	Metode                    string `json:"metode"`
	Penanya                   string `json:"penanya"`
	StatusPenanya             string `json:"status_penanya"`
	NoTelpPenanya             string `json:"no_telp_penanya"`
	JenisPertanyaan           string `json:"jenis_pertanyaan"`
	KeteranganJenisPertanyaan string `json:"keterangan_jenis_pertanyaan"`
	UraianPertanyaan          string `json:"uraian_pertanyaan"`
	SudahDijawab              bool   `json:"sudah_dijawab"`
	TanggalJawab              string `json:"tanggal_jawab"`
	MetodeJawab               string `json:"metode_jawab"`
	PenyampaianJawaban        string `json:"penyampaian_jawaban"`
	Jawaban                   string `json:"jawaban"`
	Referensi                 string `json:"referensi"`
	NipApoteker               string `json:"nip_apoteker"`
	NamaApoteker              string `json:"nama_apoteker"`
}

// getInformasiObatList — padanan tampil() Java, disederhanakan jadi
// "semua entri PIO milik satu no_rawat" (dipanggil dari ModalInformasiObat
// saat dibuka atas baris resep tertentu), bukan pencarian lintas-pasien
// dengan filter tanggal/R1/R2 seperti dialog aslinya — filter belum/sudah
// dijawab sudah ditangani di level tab lewat sdh_informasi_obat pada
// ResepRalanRow (lihat getPermintaanResepRalan di permintaan_resep_handler.go).
func getInformasiObatList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		rows, err := db.Query(`
			SELECT pio.no_permintaan, pio.no_rawat, pio.tanggal, COALESCE(pio.metode,''), COALESCE(pio.penanya,''),
				COALESCE(pio.status_penanya,''), COALESCE(pio.no_telp_penanya,''), COALESCE(pio.jenis_pertanyaan,''),
				COALESCE(pio.keterangan_jenis_pertanyaan,''), COALESCE(pio.uraian_pertanyaan,''),
				IF(j.no_permintaan IS NULL,0,1) AS sudah_dijawab,
				COALESCE(j.tanggal_jawab,''), COALESCE(j.metode,''), COALESCE(j.penyampaian_jawaban,''),
				COALESCE(j.jawaban,''), COALESCE(j.referensi,''), COALESCE(j.nip,''), COALESCE(p.nama,'')
			FROM pelayanan_informasi_obat pio
			LEFT JOIN jawaban_pio_apoteker j ON j.no_permintaan = pio.no_permintaan
			LEFT JOIN petugas p ON p.nip = j.nip
			WHERE pio.no_rawat = ?
			ORDER BY pio.tanggal DESC
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []informasiObatItem{}
		for rows.Next() {
			var it informasiObatItem
			if rows.Scan(
				&it.NoPermintaan, &it.NoRawat, &it.Tanggal, &it.Metode, &it.Penanya,
				&it.StatusPenanya, &it.NoTelpPenanya, &it.JenisPertanyaan,
				&it.KeteranganJenisPertanyaan, &it.UraianPertanyaan, &it.SudahDijawab,
				&it.TanggalJawab, &it.MetodeJawab, &it.PenyampaianJawaban,
				&it.Jawaban, &it.Referensi, &it.NipApoteker, &it.NamaApoteker,
			) == nil {
				list = append(list, it)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// generateNoPermintaanInformasiObat — lihat catatan deviasi DATE(tanggal)
// di komentar berkas ini.
func generateNoPermintaanInformasiObat(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "PIO" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_permintaan,4) AS UNSIGNED)),0) FROM pelayanan_informasi_obat WHERE DATE(tanggal)=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%04d", prefix, maxSuffix+1), nil
}

// createInformasiObat — padanan BtnSimpanActionPerformed (bagian
// pertanyaan/pelayanan_informasi_obat saja; jawaban ditangani terpisah
// lewat saveJawabanPio, konsisten dengan skema 2-tabel PK berbeda).
// Validasi wajib isi SAMA seperti Java: Penanya, No.Telp, Uraian
// Pertanyaan (no_rawat dari konteks resep yang dipilih, bukan input user).
func createInformasiObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body informasiObatItem
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		body.NoRawat = strings.TrimSpace(body.NoRawat)
		body.Penanya = strings.TrimSpace(body.Penanya)
		body.NoTelpPenanya = strings.TrimSpace(body.NoTelpPenanya)
		body.UraianPertanyaan = strings.TrimSpace(body.UraianPertanyaan)
		body.KeteranganJenisPertanyaan = strings.TrimSpace(body.KeteranganJenisPertanyaan)

		if body.NoRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum dipilih"})
			return
		}
		if body.Penanya == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Penanya wajib diisi"})
			return
		}
		if body.NoTelpPenanya == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Telp wajib diisi"})
			return
		}
		if body.UraianPertanyaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Uraian Pertanyaan wajib diisi"})
			return
		}
		if body.Metode == "" {
			body.Metode = "Lisan"
		}
		if body.StatusPenanya == "" {
			body.StatusPenanya = "Pasien"
		}
		if body.JenisPertanyaan == "" {
			body.JenisPertanyaan = "Lain-lain"
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		noPermintaan, err := generateNoPermintaanInformasiObat(tx, time.Now().Format("2006-01-02"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		_, err = tx.Exec(
			`INSERT INTO pelayanan_informasi_obat (no_permintaan, no_rawat, tanggal, metode, penanya, status_penanya, no_telp_penanya, jenis_pertanyaan, keterangan_jenis_pertanyaan, uraian_pertanyaan)
			 VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
			noPermintaan, body.NoRawat, body.Metode, body.Penanya, body.StatusPenanya, body.NoTelpPenanya,
			body.JenisPertanyaan, body.KeteranganJenisPertanyaan, body.UraianPertanyaan,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pertanyaan berhasil disimpan", "no_permintaan": noPermintaan})
	}
}

// saveJawabanPio — padanan BtnSimpanJawabanActionPerformed. Java punya
// Simpan(INSERT-only)/Ganti(UPDATE-only) terpisah lewat menyimpantf yang
// otomatis fallback update-jika-insert-gagal; di sini disatukan jadi satu
// UPSERT eksplisit (INSERT ... ON DUPLICATE KEY UPDATE), pola sama dengan
// saveTelaahFarmasi/saveKonselingFarmasi.
func saveJawabanPio(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NoPermintaan       string `json:"no_permintaan"`
			TanggalJawab       string `json:"tanggal_jawab"`
			Metode             string `json:"metode"`
			PenyampaianJawaban string `json:"penyampaian_jawaban"`
			Jawaban            string `json:"jawaban"`
			Referensi          string `json:"referensi"`
			Nip                string `json:"nip"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		body.NoPermintaan = strings.TrimSpace(body.NoPermintaan)
		body.TanggalJawab = strings.TrimSpace(body.TanggalJawab)
		body.Jawaban = strings.TrimSpace(body.Jawaban)
		body.Referensi = strings.TrimSpace(body.Referensi)
		body.Nip = strings.TrimSpace(body.Nip)

		if body.NoPermintaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Permintaan wajib diisi"})
			return
		}
		if body.Nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Apoteker wajib diisi"})
			return
		}
		if body.Jawaban == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jawaban wajib diisi"})
			return
		}
		if body.Referensi == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Referensi wajib diisi"})
			return
		}
		if body.Metode == "" {
			body.Metode = "Lisan"
		}
		if body.PenyampaianJawaban == "" {
			body.PenyampaianJawaban = "Segera"
		}

		// tanggal_jawab opsional — kalau dikirim (checkbox "Waktu Sekarang"
		// dimatikan di ModalJawabPio.tsx, user edit manual), pakai nilai itu;
		// kalau kosong, biarkan MySQL isi NOW() seperti sebelumnya.
		var err error
		if body.TanggalJawab != "" {
			_, err = db.Exec(
				`INSERT INTO jawaban_pio_apoteker (no_permintaan, tanggal_jawab, metode, penyampaian_jawaban, jawaban, referensi, nip)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE tanggal_jawab=VALUES(tanggal_jawab), metode=VALUES(metode), penyampaian_jawaban=VALUES(penyampaian_jawaban),
					jawaban=VALUES(jawaban), referensi=VALUES(referensi), nip=VALUES(nip)`,
				body.NoPermintaan, body.TanggalJawab, body.Metode, body.PenyampaianJawaban, body.Jawaban, body.Referensi, body.Nip,
			)
		} else {
			_, err = db.Exec(
				`INSERT INTO jawaban_pio_apoteker (no_permintaan, tanggal_jawab, metode, penyampaian_jawaban, jawaban, referensi, nip)
				 VALUES (?, NOW(), ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE tanggal_jawab=NOW(), metode=VALUES(metode), penyampaian_jawaban=VALUES(penyampaian_jawaban),
					jawaban=VALUES(jawaban), referensi=VALUES(referensi), nip=VALUES(nip)`,
				body.NoPermintaan, body.Metode, body.PenyampaianJawaban, body.Jawaban, body.Referensi, body.Nip,
			)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jawaban berhasil disimpan"})
	}
}

// deleteInformasiObat — padanan BtnHapusActionPerformed Java
// (`delete from pelayanan_informasi_obat where no_permintaan=?`, dipanggil
// atas baris yang sedang dipilih di tbObat). jawaban_pio_apoteker punya FK
// no_permintaan ON DELETE CASCADE ke pelayanan_informasi_obat, jadi
// jawabannya (kalau sudah ada) ikut terhapus otomatis tanpa query
// terpisah.
func deleteInformasiObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := strings.TrimSpace(c.Param("no_permintaan"))
		if noPermintaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_permintaan wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM pelayanan_informasi_obat WHERE no_permintaan = ?`, noPermintaan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pertanyaan berhasil dihapus"})
	}
}
