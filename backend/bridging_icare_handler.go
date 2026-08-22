package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var icareKodeDokterNumeric = regexp.MustCompile(`^[0-9]+$`)

// getIcareRiwayat — padanan method tampil() di dialog "Riwayat Perawatan
// ICare FKTL BPJS" Khanza Desktop (bridging.ICareRiwayatPerawatan): POST
// {URL}/validate dgn body {"param": <NIK/No.Kartu>, "kodedokter": <kode
// dokter BPJS, angka tanpa kutip>}, signature & dekripsi respons memakai
// skema yg sama dgn VClaim/HFIS (vclaimRequest). Field "param" & "kodedokter"
// di Khanza diisi manual lewat dua menu terpisah (by NIK / by No.Kartu) +
// lookup mapping dokter; di sini disatukan jadi satu endpoint yg melakukan
// lookup itu sendiri dari no_rkm_medis & kd_dokter, supaya tombol "ICare" di
// Pemeriksaan.tsx cukup kirim identitas kunjungan tanpa perlu tahu no_ktp/
// no_peserta/kode dokter BPJS pasien secara langsung.
//
// PENTING: hasil dekripsi respons I-Care BUKAN daftar riwayat berbentuk JSON
// (spt Histori Pelayanan VClaim), melainkan cuma field "url" — sebuah URL
// sesi (SSO) ke halaman riwayat pelayanan yg di-hosting BPJS sendiri, yg di
// Khanza Desktop ditampilkan lewat embedded WebView. Endpoint ini meneruskan
// URL itu apa adanya; frontend yg memutuskan cara menampilkannya (iframe/tab
// baru) — lihat IcareRiwayatModal.tsx.
func getIcareRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRkmMedis := strings.TrimSpace(c.Query("no_rkm_medis"))
		kdDokter := strings.TrimSpace(c.Query("kd_dokter"))
		if noRkmMedis == "" || kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. RM dan kode dokter wajib diisi"})
			return
		}

		var noKtp, noPeserta string
		err := db.QueryRow(`SELECT COALESCE(no_ktp,''), COALESCE(no_peserta,'') FROM pasien WHERE no_rkm_medis = ?`, noRkmMedis).Scan(&noKtp, &noPeserta)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak ditemukan"})
			return
		}
		param := strings.TrimSpace(noPeserta)
		if param == "" {
			param = strings.TrimSpace(noKtp)
		}
		if param == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki No. Kartu BPJS atau NIK"})
			return
		}

		var kodeDokterBpjs string
		err = db.QueryRow(`SELECT kd_dokter_bpjs FROM maping_dokter_dpjpvclaim WHERE kd_dokter = ?`, kdDokter).Scan(&kodeDokterBpjs)
		kodeDokterBpjs = strings.TrimSpace(kodeDokterBpjs)
		if err != nil || kodeDokterBpjs == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter belum terdaftar di mapping dokter BPJS (Master BPJS > Mapping Dokter)"})
			return
		}
		if !icareKodeDokterNumeric.MatchString(kodeDokterBpjs) {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Kode dokter BPJS pada mapping tidak valid: " + kodeDokterBpjs})
			return
		}

		cfg, err := getBpjsConfigByKode(db, "bpjs_icare", "I-Care BPJS")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bodyJSON := []byte(fmt.Sprintf(`{"param":%q,"kodedokter":%s}`, param, kodeDokterBpjs))
		result, err := vclaimRequest(cfg, http.MethodPost, "validate", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		url, _ := result["url"].(string)
		url = strings.TrimSpace(url)
		if url == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Respon I-Care tidak berisi URL riwayat pelayanan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"url": url})
	}
}
