package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// OBAT & RESEP ENDPOINTS
// ============================================================================

// ObatSearchResult represents search result for medicine
type ObatSearchResult struct {
	KodeBrng     string  `json:"kode_brng"`
	NamaBrng     string  `json:"nama_brng"`
	JenisObat    string  `json:"jenis_obat"`
	KodeSat      string  `json:"kode_sat"`
	Harga        float64 `json:"harga"`
	LetakBarang  string  `json:"letak_barang"`
	NamaIndustri string  `json:"nama_industri"`
	HBeli        float64 `json:"h_beli"`
	Kapasitas    string  `json:"kapasitas"`
	Stok         float64 `json:"stok"`
}

// searchObat searches for medicine in inventory
func searchObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.DefaultQuery("query", c.DefaultQuery("q", ""))
		// kd_bangsal (depo obat) diresolve lewat Pengaturan Depo Ralan
		// (set_depo_ralan, berdasarkan poliklinik kunjungan) kalau tidak
		// dikirim eksplisit — baru fallback ke Lokasi Stok Utama Obat
		// (set_lokasi), baru "AP" kalau itu jg belum pernah diatur.
		kdBangsal := c.Query("kd_bangsal")
		if kdBangsal == "" {
			kdBangsal = resolveDepoRalan(db, c.Query("no_rawat"))
		}
		if kdBangsal == "" {
			kdBangsal = resolveLokasiUtamaObat(db)
		}
		if kdBangsal == "" {
			kdBangsal = "AP"
		}
		markupStr := c.DefaultQuery("markup", "0")
		stokKosong := c.DefaultQuery("stok_kosong", "no")
		jenisKelas := c.DefaultQuery("jenis_kelas", "Rawat Jalan") // Default: Rawat Jalan

		if len(query) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Query minimal 2 karakter",
			})
			return
		}

		// Parse markup
		var markup float64
		fmt.Sscanf(markupStr, "%f", &markup)

		// Build stock filter
		stokFilter := ""
		if stokKosong != "yes" {
			stokFilter = " AND (gudangbarang.stok > 0 OR gudangbarang.stok IS NULL)"
		}

		// Determine price column based on jenis_kelas
		hargaColumn := "databarang.ralan"
		switch jenisKelas {
		case "Karyawan":
			hargaColumn = "databarang.karyawan"
		case "Rawat Jalan":
			hargaColumn = "databarang.ralan"
		case "Beli Luar":
			hargaColumn = "databarang.beliluar"
		case "Kelas 1":
			hargaColumn = "databarang.kelas1"
		case "Kelas 2":
			hargaColumn = "databarang.kelas2"
		case "Kelas 3":
			hargaColumn = "databarang.kelas3"
		case "VIP":
			hargaColumn = "databarang.vip"
		case "VVIP":
			hargaColumn = "databarang.vvip"
		case "Utama/BPJS":
			hargaColumn = "databarang.utama"
		}

		// Query obat
		querySQL := `
			SELECT
				databarang.kode_brng,
				databarang.nama_brng,
				jenis.nama as jenis_obat,
				databarang.kode_sat,
				` + hargaColumn + ` as harga,
				databarang.letak_barang,
				COALESCE(industrifarmasi.nama_industri, '') as nama_industri,
				databarang.h_beli,
				databarang.kapasitas,
				COALESCE(gudangbarang.stok, 0) as stok
			FROM databarang
			INNER JOIN jenis ON databarang.kdjns = jenis.kdjns
			LEFT JOIN industrifarmasi ON databarang.kode_industri = industrifarmasi.kode_industri
			LEFT JOIN gudangbarang ON databarang.kode_brng = gudangbarang.kode_brng
				AND gudangbarang.kd_bangsal = ?
			WHERE databarang.status = '1'
				AND (databarang.nama_brng LIKE ? OR databarang.kode_brng LIKE ?)` + stokFilter + `
			ORDER BY databarang.nama_brng
			LIMIT 50
		`

		searchPattern := "%" + query + "%"
		rows, err := db.Query(querySQL, kdBangsal, searchPattern, searchPattern)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mencari obat: " + err.Error(),
			})
			return
		}
		defer rows.Close()

		var results []ObatSearchResult
		for rows.Next() {
			var item ObatSearchResult
			var namaIndustri, letakBarang sql.NullString

			err := rows.Scan(
				&item.KodeBrng,
				&item.NamaBrng,
				&item.JenisObat,
				&item.KodeSat,
				&item.Harga,
				&letakBarang,
				&namaIndustri,
				&item.HBeli,
				&item.Kapasitas,
				&item.Stok,
			)
			if err != nil {
				continue
			}

			item.LetakBarang = letakBarang.String
			item.NamaIndustri = namaIndustri.String

			// Apply markup
			if markup > 0 {
				item.Harga = item.HBeli + (item.HBeli * markup)
			}

			results = append(results, item)
		}

		c.JSON(http.StatusOK, results)
	}
}

// ============================================================================
// RESEP ENDPOINTS
// ============================================================================

// submitResep saves prescription (non-racikan and/or racikan)
func submitResep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			NoRawat    string `json:"no_rawat" binding:"required"`
			KdDokter   string `json:"kd_dokter"`
			NonRacikan []struct {
				KodeBrng    string  `json:"kode_brng" binding:"required"`
				Jml         float64 `json:"jml" binding:"required"`
				AturanPakai string  `json:"aturan_pakai" binding:"required"`
			} `json:"non_racikan"`
			Racikan []struct {
				NamaRacikan string `json:"nama_racikan" binding:"required"`
				Keterangan  string `json:"keterangan"`
				MetodeRacik string `json:"metode_racik"`
				// JmlDr (Jml.Racik/Bungkus, "kps") sengaja TIDAK required —
				// dokter kadang isi Jumlah obat (mis. 4 tab) duluan sebelum
				// farmasi menentukan jumlah kapsul/bungkus racikannya;
				// dibiarkan 0 di sini, bukan diblokir saat simpan.
				JmlDr       int    `json:"jml_dr"`
				AturanPakai string `json:"aturan_pakai" binding:"required"`
				Detail      []struct {
					KodeBrng string `json:"kode_brng" binding:"required"`
					// Kandungan juga tidak required — sama alasan spt JmlDr
					// di atas, tidak selalu bisa dihitung otomatis kalau
					// JmlDr belum diisi (lihat hitungKandunganObatRacikan
					// di ResepModal.tsx).
					Kandungan string  `json:"kandungan"`
					Jml       float64 `json:"jml" binding:"required"`
				} `json:"detail" binding:"required"`
			} `json:"racikan"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid request: " + err.Error(),
			})
			return
		}

		// Validate at least one resep
		if len(payload.NonRacikan) == 0 && len(payload.Racikan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Minimal harus ada 1 resep (non-racikan atau racikan)",
			})
			return
		}

		// Auto-detect kd_dokter if not provided
		if payload.KdDokter == "" {
			var kdDokter sql.NullString
			// Try from dpjp_ranap first, then reg_periksa
			err := db.QueryRow(`
				SELECT COALESCE(
					(SELECT kd_dokter FROM dpjp_ranap WHERE no_rawat = ? LIMIT 1),
					(SELECT kd_dokter FROM reg_periksa WHERE no_rawat = ?)
				) as kd_dokter
			`, payload.NoRawat, payload.NoRawat).Scan(&kdDokter)

			if err != nil || !kdDokter.Valid || kdDokter.String == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"message": "Dokter tidak ditemukan untuk pasien ini",
				})
				return
			}
			payload.KdDokter = kdDokter.String
		}

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal memulai transaksi: " + err.Error(),
			})
			return
		}
		defer tx.Rollback()

		// Generate no_resep (format: YYYYMMDDXXXX)
		var noResep string
		now := time.Now()
		prefix := now.Format("20060102")

		var lastNo int
		err = tx.QueryRow(`
			SELECT COALESCE(MAX(CAST(SUBSTRING(no_resep, 9) AS UNSIGNED)), 0)
			FROM resep_obat
			WHERE no_resep LIKE ?
		`, prefix+"%").Scan(&lastNo)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal generate no_resep: " + err.Error(),
			})
			return
		}

		noResep = fmt.Sprintf("%s%04d", prefix, lastNo+1)

		// Auto-detect status (ralan/ranap)
		var status string
		err = tx.QueryRow(`
			SELECT status_lanjut FROM reg_periksa WHERE no_rawat = ?
		`, payload.NoRawat).Scan(&status)

		if err != nil {
			status = "ralan" // default
		}

		// Normalize status to lowercase for comparison
		statusLower := strings.ToLower(status)

		// Insert resep_obat header
		tglPeresepan := now.Format("2006-01-02")
		jamPeresepan := now.Format("15:04:05")

		_, err = tx.Exec(`
			INSERT INTO resep_obat (
				no_resep, tgl_perawatan, jam, no_rawat, kd_dokter,
				tgl_peresepan, jam_peresepan, status,
				tgl_penyerahan, jam_penyerahan
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, noResep, "0000-00-00", "00:00:00", payload.NoRawat, payload.KdDokter,
			tglPeresepan, jamPeresepan, status,
			"0000-00-00", "00:00:00")

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal menyimpan header resep: " + err.Error(),
			})
			return
		}

		// Insert non-racikan
		for _, item := range payload.NonRacikan {
			// Use jml directly from payload
			// The frontend should already send the correct quantity
			_, err = tx.Exec(`
				INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
				VALUES (?, ?, ?, ?)
			`, noResep, item.KodeBrng, item.Jml, item.AturanPakai)

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal menyimpan resep non-racikan: " + err.Error(),
				})
				return
			}
		}

		// Insert racikan
		for racikIdx, racikan := range payload.Racikan {
			noRacik := racikIdx + 1

			// Get kd_racik from metode_racik
			var kdRacik string
			if racikan.MetodeRacik != "" {
				err = tx.QueryRow(`SELECT kd_racik FROM metode_racik WHERE nm_racik = ?`, racikan.MetodeRacik).Scan(&kdRacik)
				if err != nil {
					// If not found, use first available kd_racik as default
					err = tx.QueryRow(`SELECT kd_racik FROM metode_racik ORDER BY kd_racik LIMIT 1`).Scan(&kdRacik)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{
							"success": false,
							"message": "Tidak ada metode racik yang tersedia di database",
						})
						return
					}
				}
			} else {
				// If metode_racik is empty, use first available kd_racik as default
				err = tx.QueryRow(`SELECT kd_racik FROM metode_racik ORDER BY kd_racik LIMIT 1`).Scan(&kdRacik)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"success": false,
						"message": "Tidak ada metode racik yang tersedia di database",
					})
					return
				}
			}

			_, err = tx.Exec(`
				INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, noResep, noRacik, racikan.NamaRacikan, kdRacik, racikan.JmlDr, racikan.AturanPakai, racikan.Keterangan)

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal menyimpan racikan: " + err.Error(),
				})
				return
			}

			// Insert racikan detail
			for _, detail := range racikan.Detail {
				// p1 kolom DOUBLE — Kandungan boleh dibiarkan kosong (lihat
				// komentar di atas struct Detail), jadi string kosong HARUS
				// dikonversi ke NULL dulu (bukan dikirim apa adanya),
				// kalau tidak driver MySQL gagal parse "" jadi double
				// (Error 1366: Incorrect double value: '' for column p1).
				var p1 interface{}
				if detail.Kandungan != "" {
					if v, convErr := strconv.ParseFloat(detail.Kandungan, 64); convErr == nil {
						p1 = v
					}
				}
				// Use jml directly from payload
				_, err = tx.Exec(`
					INSERT INTO resep_dokter_racikan_detail (no_resep, no_racik, kode_brng, p1, jml)
					VALUES (?, ?, ?, ?, ?)
				`, noResep, noRacik, detail.KodeBrng, p1, detail.Jml)

				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"success": false,
						"message": "Gagal menyimpan detail racikan: " + err.Error(),
					})
					return
				}
			}
		}

		// Auto-update RTL (Planning) field if status is ralan (case-insensitive)
		if statusLower == "ralan" {
			// Build resep text sesuai format Khanza Java
			resepText := "Resep : \n"

			// Add non-racikan items (format: nama_brng Jumlah jml Aturan Pakai aturan_pakai)
			for _, item := range payload.NonRacikan {
				var namaBrng string
				errNama := tx.QueryRow(`SELECT nama_brng FROM databarang WHERE kode_brng = ?`, item.KodeBrng).Scan(&namaBrng)
				if errNama == nil {
					// Format jml: jika decimal, tampilkan dengan 2 desimal, jika integer tampilkan tanpa desimal
					jmlStr := fmt.Sprintf("%.0f", item.Jml)
					if item.Jml != float64(int64(item.Jml)) {
						jmlStr = fmt.Sprintf("%.2f", item.Jml)
					}
					resepText += fmt.Sprintf("%s Jumlah %s Aturan Pakai %s\n", namaBrng, jmlStr, item.AturanPakai)
				}
			}

			// Add racikan items (format: no_racik. nama_racik Jumlah jml_dr metode Aturan Pakai aturan_pakai)
			for idx, racikan := range payload.Racikan {
				noRacik := idx + 1
				metodeRacik := racikan.MetodeRacik // Use directly from payload
				resepText += fmt.Sprintf("%d. %s Jumlah %d %s Aturan Pakai %s\n",
					noRacik, racikan.NamaRacikan, racikan.JmlDr, metodeRacik, racikan.AturanPakai)

				// Add racikan details (format: -- nama_brng jml)
				for _, detail := range racikan.Detail {
					var namaBrng string
					errNama := tx.QueryRow(`SELECT nama_brng FROM databarang WHERE kode_brng = ?`, detail.KodeBrng).Scan(&namaBrng)
					if errNama == nil {
						// Format jml: jika decimal, tampilkan dengan 2 desimal, jika integer tampilkan tanpa desimal
						jmlStr := fmt.Sprintf("%.0f", detail.Jml)
						if detail.Jml != float64(int64(detail.Jml)) {
							jmlStr = fmt.Sprintf("%.2f", detail.Jml)
						}
						resepText += fmt.Sprintf("-- %s %s\n", namaBrng, jmlStr)
					}
				}
			}

			// Update RTL field - get latest record first with proper formatting
			// Sesuai Khanza Java: filter by no_rawat AND nip (kd_dokter)
			// Get latest record - use DATE_FORMAT and TIME_FORMAT to get proper format
			// Filter by no_rawat AND nip (kd_dokter) seperti di Khanza Java
			var tglPerawatanStr, jamRawatStr string
			err = tx.QueryRow(`
				SELECT 
					DATE_FORMAT(tgl_perawatan, '%Y-%m-%d') as tgl_perawatan,
					TIME_FORMAT(jam_rawat, '%H:%i:%s') as jam_rawat
				FROM pemeriksaan_ralan
				WHERE no_rawat = ? AND nip = ?
				ORDER BY tgl_perawatan DESC, jam_rawat DESC
				LIMIT 1
			`, payload.NoRawat, payload.KdDokter).Scan(&tglPerawatanStr, &jamRawatStr)

			if err == nil && tglPerawatanStr != "" && jamRawatStr != "" {
				// Update using formatted values directly
				// MySQL will automatically convert the formatted string to match DATE and TIME columns
				// Filter by no_rawat, tgl_perawatan, jam_rawat, AND nip (seperti Khanza Java)
				result, errUpdate := tx.Exec(`
					UPDATE pemeriksaan_ralan
					SET rtl = CONCAT(COALESCE(rtl, ''), ' ', ?)
					WHERE no_rawat = ? 
						AND tgl_perawatan = ?
						AND jam_rawat = ?
						AND nip = ?
				`, resepText, payload.NoRawat, tglPerawatanStr, jamRawatStr, payload.KdDokter)

				if errUpdate != nil {
					// Log error but don't fail the transaction
					fmt.Printf("Warning: Failed to update RTL field: %v\n", errUpdate)
				} else {
					rowsAffected, _ := result.RowsAffected()
					if rowsAffected == 0 {
						// Check if record exists
						var count int
						errCheck := tx.QueryRow(`
							SELECT COUNT(*) FROM pemeriksaan_ralan WHERE no_rawat = ? AND nip = ?
						`, payload.NoRawat, payload.KdDokter).Scan(&count)

						if errCheck == nil {
							if count == 0 {
								fmt.Printf("Warning: No pemeriksaan_ralan record found for no_rawat=%s, nip=%s\n", payload.NoRawat, payload.KdDokter)
							} else {
								fmt.Printf("Warning: No rows updated for RTL. no_rawat=%s, nip=%s, tgl_perawatan=%s, jam_rawat=%s (found %d records, but WHERE clause didn't match)\n",
									payload.NoRawat, payload.KdDokter, tglPerawatanStr, jamRawatStr, count)
							}
						} else {
							fmt.Printf("Warning: No rows updated for RTL. no_rawat=%s, nip=%s\n", payload.NoRawat, payload.KdDokter)
						}
					}
				}
			} else {
				if err != nil {
					// Log error but don't fail the transaction
					fmt.Printf("Warning: No pemeriksaan_ralan found for no_rawat=%s, nip=%s. Error: %v\n",
						payload.NoRawat, payload.KdDokter, err)
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal menyimpan resep: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"message":  "Resep berhasil disimpan",
			"no_resep": noResep,
		})
	}
}

// ResepNonRacikan represents non-compound medication
type ResepNonRacikan struct {
	KodeBrng    string  `json:"kode_brng"`
	NamaBrng    string  `json:"nama_brng"`
	Jml         float64 `json:"jml"`
	KodeSat     string  `json:"kode_sat"`
	AturanPakai string  `json:"aturan_pakai"`
	// Field di bawah cuma diisi getPermintaanResepRalanItems (padanan
	// kolom tbObat DlgCariObat.java untuk modal validasi/ModalValidasiObat.tsx
	// — TIDAK dipakai/diisi getRiwayatResep), jadi tetap nilai default
	// (0/'') di endpoint lain yang reuse struct ini.
	HJual        float64 `json:"h_jual"`
	Subtotal     float64 `json:"subtotal"`
	JenisObat    string  `json:"jenis_obat"`
	Embalase     float64 `json:"embalase"`
	Tuslah       float64 `json:"tuslah"`
	Stok         float64 `json:"stok"`
	NamaIndustri string  `json:"nama_industri"`
	HBeli        float64 `json:"h_beli"`
	Kategori     string  `json:"kategori"`
	Golongan     string  `json:"golongan"`
	// No.Batch/No.Faktur SELALU '-' — proyek ini tidak melacak batch
	// (stok selalu digabung di baris no_batch=''/no_faktur='', sama pola
	// dengan semua modul lain, lihat PERMINTAAN_RESEP_MODUL.md). Bukan
	// field yang benar-benar dari Java, cuma placeholder tampilan supaya
	// kolomnya tetap ada tapi jujur "tidak dilacak", bukan data palsu.
	NoBatch    string `json:"no_batch"`
	NoFaktur   string `json:"no_faktur"`
	Kadaluarsa string `json:"kadaluarsa"`
	// Kapasitas — "isi per kemasan", dipakai kolom K (konversi satuan
	// besar/kecil) di ModalValidasiObat.tsx: padanan persis IFNULL(
	// databarang.kapasitas,1) yang dibaca DlgCariObat.java sebelum
	// membagi jumlah yang diinput dengan kapasitas ini (K dicentang =
	// jumlah diinput dalam satuan kemasan, bukan satuan dasar).
	Kapasitas float64 `json:"kapasitas"`
}

// ResepRacikanDetail represents detail of compound medication
type ResepRacikanDetail struct {
	KodeBrng     string  `json:"kode_brng"`
	NamaBrng     string  `json:"nama_brng"`
	Kandungan    string  `json:"kandungan"`
	Jml          float64 `json:"jml"`
	KodeSat      string  `json:"kode_sat"`
	HJual        float64 `json:"h_jual"`
	Subtotal     float64 `json:"subtotal"`
	JenisObat    string  `json:"jenis_obat"`
	Embalase     float64 `json:"embalase"`
	Tuslah       float64 `json:"tuslah"`
	Stok         float64 `json:"stok"`
	NamaIndustri string  `json:"nama_industri"`
	HBeli        float64 `json:"h_beli"`
	Kategori     string  `json:"kategori"`
	Golongan     string  `json:"golongan"`
	NoBatch      string  `json:"no_batch"`
	NoFaktur     string  `json:"no_faktur"`
	Kapasitas    float64 `json:"kapasitas"`
	Kadaluarsa   string  `json:"kadaluarsa"`
}

// ResepRacikan represents compound medication
type ResepRacikan struct {
	NoRacik     int                  `json:"no_racik"`
	NamaRacik   string               `json:"nama_racik"`
	KdRacik     string               `json:"kd_racik"`
	MetodeRacik string               `json:"metode_racik"`
	JmlDr       int                  `json:"jml_dr"`
	AturanPakai string               `json:"aturan_pakai"`
	Keterangan  string               `json:"keterangan"`
	Detail      []ResepRacikanDetail `json:"detail"`
}

// Resep represents prescription data
type Resep struct {
	NoResep       string            `json:"no_resep"`
	TglPeresepan  string            `json:"tgl_peresepan"`
	JamPeresepan  string            `json:"jam_peresepan"`
	TglPenyerahan string            `json:"tgl_penyerahan"`
	JamPenyerahan string            `json:"jam_penyerahan"`
	TglPerawatan  string            `json:"tgl_perawatan"`
	Jam           string            `json:"jam"`
	NoRawat       string            `json:"no_rawat"`
	NoRkm         string            `json:"no_rkm_medis"`
	NmPasien      string            `json:"nm_pasien"`
	NmDokter      string            `json:"nm_dokter"`
	KdDokter      string            `json:"kd_dokter"`
	Status        string            `json:"status"`      // Status terlayani: 'belum' atau 'sudah' (dari tgl_perawatan)
	StatusAsal    string            `json:"status_asal"` // Status asal: 'ralan' atau 'ranap'
	NonRacikan    []ResepNonRacikan `json:"non_racikan"`
	Racikan       []ResepRacikan    `json:"racikan"`
}

// getRiwayatResep returns prescription history for a patient
// Support query parameter: today=true (untuk filter hari ini saja)
func getRiwayatResep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRkmMedis := c.Param("no_rkm_medis")
		todayOnly := c.DefaultQuery("today", "false")

		if noRkmMedis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rkm_medis is required"})
			return
		}

		// Build date filter
		dateFilter := ""
		if todayOnly == "true" {
			today := time.Now().Format("2006-01-02")
			dateFilter = " AND resep_obat.tgl_peresepan = '" + today + "'"
		}

		// Query untuk mendapatkan header resep
		// Status dihitung dari tgl_perawatan seperti di Khanza Java
		queryResep := `
			SELECT
				resep_obat.no_resep,
				DATE_FORMAT(resep_obat.tgl_peresepan, '%Y-%m-%d') as tgl_peresepan,
				TIME_FORMAT(resep_obat.jam_peresepan, '%H:%i:%s') as jam_peresepan,
				IF(resep_obat.tgl_penyerahan='0000-00-00' OR resep_obat.tgl_penyerahan IS NULL, '', DATE_FORMAT(resep_obat.tgl_penyerahan, '%Y-%m-%d')) as tgl_penyerahan,
				IF(resep_obat.jam_penyerahan='00:00:00' OR resep_obat.jam_penyerahan IS NULL, '', TIME_FORMAT(resep_obat.jam_penyerahan, '%H:%i:%s')) as jam_penyerahan,
				IF(resep_obat.tgl_perawatan='0000-00-00' OR resep_obat.tgl_perawatan IS NULL, '', DATE_FORMAT(resep_obat.tgl_perawatan, '%Y-%m-%d')) as tgl_perawatan,
				IF(resep_obat.jam='00:00:00' OR resep_obat.jam IS NULL, '', TIME_FORMAT(resep_obat.jam, '%H:%i:%s')) as jam,
				reg_periksa.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				dokter.nm_dokter,
				resep_obat.kd_dokter,
				IF(resep_obat.tgl_perawatan='0000-00-00' OR resep_obat.tgl_perawatan IS NULL, 'belum', 'sudah') as status,
				resep_obat.status as status_asal
			FROM resep_obat
			INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN dokter ON resep_obat.kd_dokter = dokter.kd_dokter
			WHERE reg_periksa.no_rkm_medis = ?` + dateFilter + `
			ORDER BY resep_obat.tgl_peresepan DESC, resep_obat.jam_peresepan DESC
		`

		rowsResep, err := db.Query(queryResep, noRkmMedis)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data resep: " + err.Error()})
			return
		}
		defer rowsResep.Close()

		var resepList []Resep
		for rowsResep.Next() {
			var resep Resep
			var status sql.NullString
			var statusAsal sql.NullString

			err := rowsResep.Scan(
				&resep.NoResep,
				&resep.TglPeresepan,
				&resep.JamPeresepan,
				&resep.TglPenyerahan,
				&resep.JamPenyerahan,
				&resep.TglPerawatan,
				&resep.Jam,
				&resep.NoRawat,
				&resep.NoRkm,
				&resep.NmPasien,
				&resep.NmDokter,
				&resep.KdDokter,
				&status,
				&statusAsal,
			)
			if err != nil {
				continue
			}

			resep.Status = status.String         // Status terlayani: 'belum' atau 'sudah'
			resep.StatusAsal = statusAsal.String // Status asal: 'ralan' atau 'ranap'

			// Inisialisasi arrays
			resep.NonRacikan = []ResepNonRacikan{}
			resep.Racikan = []ResepRacikan{}

			// ================================================================
			// 1. GET NON-RACIKAN
			// ================================================================
			queryNonRacikan := `
				SELECT
					resep_dokter.kode_brng,
					databarang.nama_brng,
					resep_dokter.jml,
					databarang.kode_sat,
					resep_dokter.aturan_pakai
				FROM resep_dokter
				INNER JOIN databarang ON resep_dokter.kode_brng = databarang.kode_brng
				WHERE resep_dokter.no_resep = ?
				ORDER BY databarang.nama_brng
			`

			rowsNonRacikan, err := db.Query(queryNonRacikan, resep.NoResep)
			if err == nil {
				defer rowsNonRacikan.Close()

				for rowsNonRacikan.Next() {
					var item ResepNonRacikan
					var jml, aturanPakai sql.NullString

					err := rowsNonRacikan.Scan(
						&item.KodeBrng,
						&item.NamaBrng,
						&jml,
						&item.KodeSat,
						&aturanPakai,
					)
					if err != nil {
						continue
					}

					// Convert jml to float64
					if jml.Valid {
						var jmlFloat float64
						if _, err := fmt.Sscanf(jml.String, "%f", &jmlFloat); err == nil {
							item.Jml = jmlFloat
						}
					}

					item.AturanPakai = aturanPakai.String
					resep.NonRacikan = append(resep.NonRacikan, item)
				}
			}

			// ================================================================
			// 2. GET RACIKAN
			// ================================================================
			queryRacikan := `
				SELECT
					resep_dokter_racikan.no_racik,
					resep_dokter_racikan.nama_racik,
					resep_dokter_racikan.kd_racik,
					metode_racik.nm_racik as metode_racik,
					resep_dokter_racikan.jml_dr,
					resep_dokter_racikan.aturan_pakai,
					resep_dokter_racikan.keterangan
				FROM resep_dokter_racikan
				LEFT JOIN metode_racik ON resep_dokter_racikan.kd_racik = metode_racik.kd_racik
				WHERE resep_dokter_racikan.no_resep = ?
				ORDER BY resep_dokter_racikan.no_racik
			`

			rowsRacikan, err := db.Query(queryRacikan, resep.NoResep)
			if err == nil {
				defer rowsRacikan.Close()

				for rowsRacikan.Next() {
					var racikan ResepRacikan
					var metodeRacik, aturanPakai, keterangan sql.NullString

					err := rowsRacikan.Scan(
						&racikan.NoRacik,
						&racikan.NamaRacik,
						&racikan.KdRacik,
						&metodeRacik,
						&racikan.JmlDr,
						&aturanPakai,
						&keterangan,
					)
					if err != nil {
						continue
					}

					racikan.MetodeRacik = metodeRacik.String
					racikan.AturanPakai = aturanPakai.String
					racikan.Keterangan = keterangan.String
					racikan.Detail = []ResepRacikanDetail{}

					// Get detail racikan
					queryDetail := `
						SELECT
							resep_dokter_racikan_detail.kode_brng,
							databarang.nama_brng,
							resep_dokter_racikan_detail.p1 as kandungan,
							resep_dokter_racikan_detail.jml,
							databarang.kode_sat,
							COALESCE(databarang.kapasitas, 0)
						FROM resep_dokter_racikan_detail
						INNER JOIN databarang ON resep_dokter_racikan_detail.kode_brng = databarang.kode_brng
						WHERE resep_dokter_racikan_detail.no_resep = ?
							AND resep_dokter_racikan_detail.no_racik = ?
						ORDER BY databarang.nama_brng
					`

					rowsDetail, err := db.Query(queryDetail, resep.NoResep, racikan.NoRacik)
					if err == nil {
						defer rowsDetail.Close()

						for rowsDetail.Next() {
							var detail ResepRacikanDetail
							var kandungan, jml sql.NullString

							err := rowsDetail.Scan(
								&detail.KodeBrng,
								&detail.NamaBrng,
								&kandungan,
								&jml,
								&detail.KodeSat,
								&detail.Kapasitas,
							)
							if err != nil {
								continue
							}

							detail.Kandungan = kandungan.String

							// Convert jml to float64
							if jml.Valid {
								var jmlFloat float64
								if _, err := fmt.Sscanf(jml.String, "%f", &jmlFloat); err == nil {
									detail.Jml = jmlFloat
								}
							}

							racikan.Detail = append(racikan.Detail, detail)
						}
					}

					resep.Racikan = append(resep.Racikan, racikan)
				}
			}

			resepList = append(resepList, resep)
		}

		c.JSON(http.StatusOK, resepList)
	}
}

// deleteResep menghapus resep jika belum terlayani
// Sesuai logika Khanza Java: hanya bisa hapus jika status = "Belum Terlayani"
func deleteResep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")

		if noResep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep is required"})
			return
		}

		// Cek apakah resep ada dan ambil statusnya
		// Gunakan logika yang sama dengan getRiwayatResep untuk konsistensi
		var status sql.NullString
		err := db.QueryRow(`
			SELECT IF(tgl_perawatan='0000-00-00' OR tgl_perawatan IS NULL, 'belum', 'sudah') as status
			FROM resep_obat 
			WHERE no_resep = ?
		`, noResep).Scan(&status)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Resep tidak ditemukan"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa status resep: " + err.Error()})
			return
		}

		// Validasi: hanya bisa hapus jika belum terlayani
		// Status "sudah" berarti resep sudah tervalidasi
		if status.Valid && status.String == "sudah" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Resep sudah tervalidasi",
				"message": "Resep sudah tervalidasi, tidak dapat dihapus",
			})
			return
		}

		// Ambil data resep sebelum dihapus untuk update RTL
		var noRawat, kdDokter string
		err = db.QueryRow(`
			SELECT no_rawat, kd_dokter 
			FROM resep_obat 
			WHERE no_resep = ?
		`, noResep).Scan(&noRawat, &kdDokter)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data resep: " + err.Error()})
			return
		}

		// Format resep text untuk dihapus dari RTL (sama seperti saat simpan)
		resepText := "Resep : \n"

		// Get non-racikan items
		rowsNonRacikan, err := db.Query(`
			SELECT databarang.nama_brng, resep_dokter.jml, resep_dokter.aturan_pakai
			FROM resep_dokter
			INNER JOIN databarang ON resep_dokter.kode_brng = databarang.kode_brng
			WHERE resep_dokter.no_resep = ?
		`, noResep)

		if err == nil {
			defer rowsNonRacikan.Close()
			for rowsNonRacikan.Next() {
				var namaBrng, aturanPakai string
				var jml float64
				if err := rowsNonRacikan.Scan(&namaBrng, &jml, &aturanPakai); err == nil {
					jmlStr := fmt.Sprintf("%.0f", jml)
					if jml != float64(int64(jml)) {
						jmlStr = fmt.Sprintf("%.2f", jml)
					}
					resepText += fmt.Sprintf("%s Jumlah %s Aturan Pakai %s\n", namaBrng, jmlStr, aturanPakai)
				}
			}
		}

		// Get racikan items
		rowsRacikan, err := db.Query(`
			SELECT resep_dokter_racikan.no_racik, resep_dokter_racikan.nama_racik, 
				metode_racik.nm_racik as metode, resep_dokter_racikan.jml_dr, 
				resep_dokter_racikan.aturan_pakai
			FROM resep_dokter_racikan
			INNER JOIN metode_racik ON resep_dokter_racikan.kd_racik = metode_racik.kd_racik
			WHERE resep_dokter_racikan.no_resep = ?
			ORDER BY resep_dokter_racikan.no_racik
		`, noResep)

		if err == nil {
			defer rowsRacikan.Close()
			for rowsRacikan.Next() {
				var noRacik int
				var namaRacik, metode, aturanPakai string
				var jmlDr int
				if err := rowsRacikan.Scan(&noRacik, &namaRacik, &metode, &jmlDr, &aturanPakai); err == nil {
					resepText += fmt.Sprintf("%d. %s Jumlah %d %s Aturan Pakai %s\n",
						noRacik, namaRacik, jmlDr, metode, aturanPakai)

					// Get racikan details
					rowsDetail, err := db.Query(`
						SELECT databarang.nama_brng, resep_dokter_racikan_detail.jml
						FROM resep_dokter_racikan_detail
						INNER JOIN databarang ON resep_dokter_racikan_detail.kode_brng = databarang.kode_brng
						WHERE resep_dokter_racikan_detail.no_resep = ? 
							AND resep_dokter_racikan_detail.no_racik = ?
					`, noResep, noRacik)

					if err == nil {
						defer rowsDetail.Close()
						for rowsDetail.Next() {
							var namaBrng string
							var jml float64
							if err := rowsDetail.Scan(&namaBrng, &jml); err == nil {
								jmlStr := fmt.Sprintf("%.0f", jml)
								if jml != float64(int64(jml)) {
									jmlStr = fmt.Sprintf("%.2f", jml)
								}
								resepText += fmt.Sprintf("-- %s %s\n", namaBrng, jmlStr)
							}
						}
					}
				}
			}
		}

		// Mulai transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi: " + err.Error()})
			return
		}
		defer tx.Rollback()

		// Hapus resep (akan cascade ke resep_dokter karena foreign key)
		result, err := tx.Exec("DELETE FROM resep_obat WHERE no_resep = ?", noResep)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus resep: " + err.Error()})
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa hasil penghapusan: " + err.Error()})
			return
		}

		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Resep tidak ditemukan"})
			return
		}

		// Update RTL di pemeriksaan_ralan: hapus teks resep dari kolom rtl
		// Hanya jika status adalah "ralan"
		var statusLanjut string
		err = tx.QueryRow(`
			SELECT status_lanjut FROM reg_periksa WHERE no_rawat = ?
		`, noRawat).Scan(&statusLanjut)

		if err == nil && strings.ToLower(statusLanjut) == "ralan" {
			// Get latest record untuk update RTL
			var tglPerawatanStr, jamRawatStr string
			err = tx.QueryRow(`
				SELECT 
					DATE_FORMAT(tgl_perawatan, '%Y-%m-%d') as tgl_perawatan,
					TIME_FORMAT(jam_rawat, '%H:%i:%s') as jam_rawat
				FROM pemeriksaan_ralan
				WHERE no_rawat = ? AND nip = ?
				ORDER BY tgl_perawatan DESC, jam_rawat DESC
				LIMIT 1
			`, noRawat, kdDokter).Scan(&tglPerawatanStr, &jamRawatStr)

			if err == nil && tglPerawatanStr != "" && jamRawatStr != "" {
				// Hapus teks resep dari RTL menggunakan REPLACE
				// Escape special characters untuk MySQL
				resepTextEscaped := strings.ReplaceAll(resepText, "\\", "\\\\")
				resepTextEscaped = strings.ReplaceAll(resepTextEscaped, "%", "\\%")
				resepTextEscaped = strings.ReplaceAll(resepTextEscaped, "_", "\\_")

				_, errUpdate := tx.Exec(`
					UPDATE pemeriksaan_ralan
					SET rtl = REPLACE(rtl, ?, '')
					WHERE no_rawat = ? 
						AND tgl_perawatan = ?
						AND jam_rawat = ?
						AND nip = ?
				`, resepText, noRawat, tglPerawatanStr, jamRawatStr, kdDokter)

				if errUpdate != nil {
					// Log error but don't fail the transaction
					fmt.Printf("Warning: Failed to remove resep text from RTL field: %v\n", errUpdate)
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Resep berhasil dihapus",
		})
	}
}
