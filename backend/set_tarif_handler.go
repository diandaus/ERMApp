package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// SET PENGGUNAAN TARIF — padanan setting/DlgSetTarif.java. Satu baris
// pengaturan system-wide (tabel `set_tarif`, SELALU tepat satu baris, tidak
// pernah kosong/banyak baris — beda dari set_embalase yang dibuat lewat
// delete+insert tiap Simpan) berisi 11 saklar Yes/No yang mengontrol apakah
// berbagai menu pemeriksaan/tarif di modul lain (Ralan/Ranap/Lab/Radiologi/
// Operasi) difilter berdasarkan poli/ruang/jenis-bayar/kelas pasien.
//
// FASE INI: cuma CRUD pengaturannya (baca+simpan ke-11 saklar). BELUM
// menghubungkan saklar ini ke query filter yang sesungguhnya di modul lain
// (mis. getJenisPerawatanRadiologi di rad_handler.go) — itu pekerjaan
// terpisah per modul, menyusul kalau diminta.
// ============================================================================

type SetTarif struct {
	PoliRalan          string `json:"poli_ralan"`
	CaraBayarRalan     string `json:"cara_bayar_ralan"`
	RuangRanap         string `json:"ruang_ranap"`
	CaraBayarRanap     string `json:"cara_bayar_ranap"`
	CaraBayarLab       string `json:"cara_bayar_lab"`
	CaraBayarRadiologi string `json:"cara_bayar_radiologi"`
	CaraBayarOperasi   string `json:"cara_bayar_operasi"`
	KelasRanap         string `json:"kelas_ranap"`
	KelasLab           string `json:"kelas_lab"`
	KelasRadiologi     string `json:"kelas_radiologi"`
	KelasOperasi       string `json:"kelas_operasi"`
}

// getSetTarif — padanan tampil() di DlgSetTarif.java. Baris di set_tarif
// selalu ada (dikonfirmasi lewat DB `sik`), tapi tetap dijaga defensif:
// kalau somehow kosong, balikkan default "No" semua (penyederhanaan —
// Java sendiri default sebagian saklar ke "Yes" saat baris kosong, tapi
// itu cuma dibaca inline per-dialog yang belum kita port di turn ini).
func getSetTarif(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s SetTarif
		err := db.QueryRow(`
			SELECT poli_ralan, cara_bayar_ralan, ruang_ranap, cara_bayar_ranap,
				cara_bayar_lab, cara_bayar_radiologi, COALESCE(cara_bayar_operasi, 'No'),
				kelas_ranap, kelas_lab, kelas_radiologi, kelas_operasi
			FROM set_tarif LIMIT 1
		`).Scan(
			&s.PoliRalan, &s.CaraBayarRalan, &s.RuangRanap, &s.CaraBayarRanap,
			&s.CaraBayarLab, &s.CaraBayarRadiologi, &s.CaraBayarOperasi,
			&s.KelasRanap, &s.KelasLab, &s.KelasRadiologi, &s.KelasOperasi,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, SetTarif{
				PoliRalan: "No", CaraBayarRalan: "No", RuangRanap: "No", CaraBayarRanap: "No",
				CaraBayarLab: "No", CaraBayarRadiologi: "No", CaraBayarOperasi: "No",
				KelasRanap: "No", KelasLab: "No", KelasRadiologi: "No", KelasOperasi: "No",
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

// yesNo — whitelist ketat, kolom enum('Yes','No') di DB akan menolak nilai
// lain juga, tapi divalidasi lebih dulu di sini supaya pesan errornya jelas.
func yesNo(v string) string {
	if v == "Yes" {
		return "Yes"
	}
	return "No"
}

// saveSetTarif — padanan simpan() di DlgSetTarif.java. Baris set_tarif
// SELALU sudah ada (bukan delete+insert seperti set_embalase), jadi cukup
// UPDATE tanpa WHERE (memang cuma satu baris system-wide, tidak ada PK).
func saveSetTarif(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body SetTarif
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid"})
			return
		}

		res, err := db.Exec(`
			UPDATE set_tarif SET
				poli_ralan = ?, cara_bayar_ralan = ?, ruang_ranap = ?, cara_bayar_ranap = ?,
				cara_bayar_lab = ?, cara_bayar_radiologi = ?, cara_bayar_operasi = ?,
				kelas_ranap = ?, kelas_lab = ?, kelas_radiologi = ?, kelas_operasi = ?
		`,
			yesNo(body.PoliRalan), yesNo(body.CaraBayarRalan), yesNo(body.RuangRanap), yesNo(body.CaraBayarRanap),
			yesNo(body.CaraBayarLab), yesNo(body.CaraBayarRadiologi), yesNo(body.CaraBayarOperasi),
			yesNo(body.KelasRanap), yesNo(body.KelasLab), yesNo(body.KelasRadiologi), yesNo(body.KelasOperasi),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Baris seharusnya selalu ada — kalau ternyata 0 baris ter-UPDATE
		// (misal DB baru tanpa seed set_tarif), insert satu baris sekarang.
		if n, _ := res.RowsAffected(); n == 0 {
			_, err := db.Exec(`
				INSERT INTO set_tarif (
					poli_ralan, cara_bayar_ralan, ruang_ranap, cara_bayar_ranap,
					cara_bayar_lab, cara_bayar_radiologi, cara_bayar_operasi,
					kelas_ranap, kelas_lab, kelas_radiologi, kelas_operasi
				) VALUES (?,?,?,?,?,?,?,?,?,?,?)
			`,
				yesNo(body.PoliRalan), yesNo(body.CaraBayarRalan), yesNo(body.RuangRanap), yesNo(body.CaraBayarRanap),
				yesNo(body.CaraBayarLab), yesNo(body.CaraBayarRadiologi), yesNo(body.CaraBayarOperasi),
				yesNo(body.KelasRanap), yesNo(body.KelasLab), yesNo(body.KelasRadiologi), yesNo(body.KelasOperasi),
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan tarif berhasil disimpan"})
	}
}
