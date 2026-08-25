package main

import (
	"database/sql"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// berkas_klaim_tte_handler.go — dipakai tab "Berkas Klaim" di
// GroupingInacbg.tsx. Padanan PERSIS tampilMultiplePdf() + tombol
// "Tampilkan Berkas" (MnTampilkanBerkasActionPerformed) di aplikasi
// desktop Khanza Java — dikonfirmasi DUA KALI oleh user: pertama lewat
// jawaban langsung ("folder berkasrawat yang sama dengan upload manual"),
// kedua lewat kode caller asli (pathFile = "berkasrawat/pages/upload").
// Jadi dokumen resmi hasil TTE (SEP_/Gruper_/Resume_/dst) itu BUKAN
// tercatat di tabel manapun — cukup file mentah di folder yang SAMA
// dgn upload manual (berkas_digital_perawatan), dicek keberadaannya
// langsung via HEAD/filesystem berdasarkan pola nama file, bukan query DB.
//
// tracking_dokumen_ttd (dipakai utk cari file Hasil Lab per-order) TIDAK
// ADA di database dev lokal (schema TTE belum ke-include di dump dev) —
// tabel ini ADA di server produksi RS (dikonfirmasi user), jadi query di
// bawah tidak bisa dites di sini, cuma ditranskripsi persis dari Java.

type BerkasKlaimPdfItem struct {
	Label string `json:"label"`
	Url   string `json:"url"`
	// Tag — label pendek per JENIS berkas (bukan per halaman), dipakai
	// frontend utk deretan pill "SEP / SPRI / Awal_Medis_IGD / Lab-.../
	// dst" di atas card Halaman PDF.
	Tag string `json:"tag"`
}

// jenisBerkasKlaim — urutan & prefix nama file PERSIS array jenisBerkas
// di tampilMultiplePdf() Java.
var jenisBerkasKlaim = []string{
	"SEP_", "Gruper_", "Resume_", "RiwayatPerawatan_", "SKDP_", "SPRI_",
	"Awal_Medis_IGD_", "Triase_", "Lab_", "Radiologi_", "Billing_",
	"LaporanOperasi_", "LaporanAnastesi_",
}

// tanpaSuffixSigned — jenis berkas dari bridging BPJS/Kemenkes tidak perlu
// _signed (sudah sah dari sumbernya), sama persis kondisi di Java.
func tanpaSuffixSigned(jenis string) bool {
	switch jenis {
	case "SEP_", "Gruper_", "SKDP_", "Billing_", "SPRI_":
		return true
	}
	return false
}

// GET /api/casemix/berkas-klaim-tte/:no_rawat
func getBerkasKlaimTte(db *sql.DB, cfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		noRawatFormatted := strings.ReplaceAll(noRawat, "/", "_")
		noRawatNoSlash := strings.ReplaceAll(noRawat, "/", "")
		uploadDir := WebappsUploadDir(cfg) // .../berkasrawat/pages/upload (filesystem lokal)
		baseURL := ""
		client := &http.Client{Timeout: 5 * time.Second}
		if cfg.IsRemote {
			baseURL = strings.TrimRight(cfg.URL, "/") + "/berkasrawat/pages/upload"
		}

		items := []BerkasKlaimPdfItem{}

		checkAndAdd := func(label, tag, fileName string) {
			if cfg.IsRemote {
				// Cek keberadaan file langsung ke server webapps (HEAD, backend
				// ke backend, satu jaringan LAN — selalu bisa). TAPI url yg
				// dikirim ke FRONTEND pakai path relatif "/berkasrawat/..." biar
				// browser tetap request ke domain aplikasi ini sendiri, lalu
				// diteruskan lewat reverse proxy (registerWebappsSubRoute) —
				// bukan URL absolut ke IP LAN internal server webapps yg tidak
				// bisa dijangkau browser dari luar jaringan RS.
				url := baseURL + "/" + fileName
				req, err := http.NewRequest(http.MethodHead, url, nil)
				if err != nil {
					return
				}
				resp, err := client.Do(req)
				if err != nil {
					return
				}
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK && resp.ContentLength >= 100 {
					items = append(items, BerkasKlaimPdfItem{Label: label, Url: "/berkasrawat/pages/upload/" + fileName, Tag: tag})
				}
				return
			}
			// Lokal (dev / server sama) — file diserve app ini sendiri lewat
			// static route /berkasrawat yg sudah terdaftar (RegisterKhanzaWebappsRoutes),
			// jadi cek langsung ke filesystem, bukan HTTP round-trip ke diri sendiri.
			info, err := os.Stat(uploadDir + "/" + fileName)
			if err != nil || info.Size() < 100 {
				return
			}
			items = append(items, BerkasKlaimPdfItem{Label: label, Url: "/berkasrawat/pages/upload/" + fileName, Tag: tag})
		}

		for _, jenis := range jenisBerkasKlaim {
			var fileName string
			if tanpaSuffixSigned(jenis) {
				fileName = jenis + noRawatFormatted + ".pdf"
			} else {
				fileName = jenis + noRawatFormatted + "_signed.pdf"
			}
			label := strings.TrimSpace(strings.ReplaceAll(jenis, "_", " ")) + " " + noRawat
			// Tag pendek — "Lab_" khusus dpt akhiran "-" (nyambung ke
			// noorder pada hasil lab per-order di bawah), jenis lain cuma
			// buang underscore trailing.
			tag := strings.TrimSuffix(jenis, "_")
			if jenis == "Lab_" {
				tag = "Lab-"
			}
			checkAndAdd(label, tag, fileName)

			// Sesudah Lab_ generic, muat lab per-order (tracking_dokumen_ttd)
			// — persis posisi & logic blok "if (jenis.equals("Lab_"))" di Java.
			if jenis == "Lab_" {
				rows, err := db.Query(`
					SELECT nama_dokumen FROM tracking_dokumen_ttd
					WHERE no_rawat=? AND nama_dokumen LIKE 'Hasil_Lab%' AND status_ttd='Sudah'
					GROUP BY nama_dokumen ORDER BY MAX(tgl_kirim) ASC
				`, noRawat)
				if err == nil {
					for rows.Next() {
						var namaDokumen string
						if rows.Scan(&namaDokumen) != nil {
							continue
						}
						afterPrefix := strings.TrimPrefix(namaDokumen, "Hasil_Lab_")
						noorder := strings.TrimSuffix(afterPrefix, "_"+noRawatNoSlash+".pdf")
						signedFileName := "Lab_" + noRawatFormatted + "_" + noorder + "_signed.pdf"
						checkAndAdd("Hasil Lab - No. "+noorder, "Lab-"+noorder, signedFileName)
					}
					rows.Close()
				}
			}
		}

		c.JSON(http.StatusOK, items)
	}
}

// POST /api/casemix/berkas-klaim-tte/save — simpan PDF (mis. hasil "Cetak
// Klaim"/claim_print E-Klaim, atau PDF Billing) sbg file "<jenis><no_rawat>
// [_signed].pdf" di folder fisik yg sama dgn TTE (berkasrawat/pages/upload),
// TANPA tabel DB — persis konvensi jenisBerkasKlaim di atas, jadi otomatis
// kedeteksi getBerkasKlaimTte tanpa perlu langkah tambahan. "jenis" WAJIB
// salah satu dari jenisBerkasKlaim (whitelist, bukan bebas dari client).
func saveBerkasKlaimTte(cfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.PostForm("no_rawat")
		jenis := c.PostForm("jenis")
		if noRawat == "" || jenis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan jenis wajib diisi"})
			return
		}
		dikenal := false
		for _, j := range jenisBerkasKlaim {
			if j == jenis {
				dikenal = true
				break
			}
		}
		if !dikenal {
			c.JSON(http.StatusBadRequest, gin.H{"error": "jenis berkas tidak dikenal: " + jenis})
			return
		}

		file, _, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File tidak ditemukan"})
			return
		}
		defer file.Close()

		buf, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file"})
			return
		}

		suffix := ".pdf"
		if !tanpaSuffixSigned(jenis) {
			suffix = "_signed.pdf"
		}
		fileName := jenis + strings.ReplaceAll(noRawat, "/", "_") + suffix
		if err := WriteWebappsFile(cfg, "berkasrawat/pages/upload", fileName, buf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Berkas berhasil disimpan", "file_name": fileName})
	}
}
