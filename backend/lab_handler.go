package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Struktur untuk jenis perawatan lab
type JenisPerawatanLab struct {
	KdJenisPrw  string `json:"kd_jenis_prw"`
	NmPerawatan string `json:"nm_perawatan"`
	Kategori    string `json:"kategori"`
	Status      string `json:"status"`
	KdPj        string `json:"kd_pj"`
	Kelas       string `json:"kelas"`
}

// Struktur untuk template laboratorium
type TemplateLab struct {
	IDTemplate     string `json:"id_template"`
	Pemeriksaan    string `json:"pemeriksaan"`
	Satuan         string `json:"satuan"`
	NilaiRujukanLD string `json:"nilai_rujukan_ld"`
	NilaiRujukanLA string `json:"nilai_rujukan_la"`
	NilaiRujukanPD string `json:"nilai_rujukan_pd"`
	NilaiRujukanPA string `json:"nilai_rujukan_pa"`
	KdJenisPrw     string `json:"kd_jenis_prw"`
}

// Struktur untuk permintaan lab PK
type PermintaanLabPK struct {
	NoOrder           string   `json:"noorder"`
	NoRawat           string   `json:"no_rawat"`
	TglPermintaan     string   `json:"tgl_permintaan"`
	JamPermintaan     string   `json:"jam_permintaan"`
	KdDokter          string   `json:"kd_dokter"`
	StatusLanjut      string   `json:"status_lanjut"`
	InformasiTambahan string   `json:"informasi_tambahan"`
	DiagnosisKlinis   string   `json:"diagnosis_klinis"`
	PemeriksaanList   []string `json:"pemeriksaan_list"`   // kd_jenis_prw yang dipilih
	DetailPemeriksaan []string `json:"detail_pemeriksaan"` // id_template yang dipilih
}

// Struktur untuk permintaan lab PA
type PermintaanLabPA struct {
	NoOrder             string   `json:"noorder"`
	NoRawat             string   `json:"no_rawat"`
	TglPermintaan       string   `json:"tgl_permintaan"`
	JamPermintaan       string   `json:"jam_permintaan"`
	KdDokter            string   `json:"kd_dokter"`
	StatusLanjut        string   `json:"status_lanjut"`
	InformasiTambahan   string   `json:"informasi_tambahan"`
	DiagnosisKlinis     string   `json:"diagnosis_klinis"`
	TglPengambilanBahan string   `json:"tgl_pengambilan_bahan"`
	DiperolehDengan     string   `json:"diperoleh_dengan"`
	LokasiPengambilan   string   `json:"lokasi_pengambilan"`
	Diawetkan           string   `json:"diawetkan"`
	DilakukanPA         string   `json:"dilakukan_pa"`
	TglPA               string   `json:"tgl_pa"`
	NomorPA             string   `json:"nomor_pa"`
	DiagnosaPA          string   `json:"diagnosa_pa"`
	PemeriksaanList     []string `json:"pemeriksaan_list"`
}

// Get daftar jenis perawatan lab berdasarkan kategori (PK/PA)
func getJenisPerawatanLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kategori := c.Query("kategori") // PK atau PA
		search := c.Query("search")
		kdPj := c.Query("kd_pj")
		kelas := c.Query("kelas")

		if kategori == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter kategori wajib diisi (PK/PA)"})
			return
		}

		// Saklar Set Penggunaan Tarif (set_tarif.cara_bayar_lab/kelas_lab,
		// lihat set_tarif_handler.go) — padanan persis mekanisme yang
		// sudah diport untuk Radiologi di getJenisPerawatanRadiologi
		// (rad_handler.go): filter kd_pj/kelas cuma aktif kalau saklarnya
		// "Yes". Default "Yes" kalau baris set_tarif belum ada (padanan
		// fallback Java saat rsset_tarif tidak punya baris).
		caraBayarAktif, kelasAktif := "Yes", "Yes"
		db.QueryRow(`SELECT cara_bayar_lab, kelas_lab FROM set_tarif LIMIT 1`).Scan(&caraBayarAktif, &kelasAktif)

		query := `
			SELECT
				jns_perawatan_lab.kd_jenis_prw,
				jns_perawatan_lab.nm_perawatan,
				jns_perawatan_lab.kategori,
				jns_perawatan_lab.status,
				jns_perawatan_lab.kd_pj,
				IFNULL(jns_perawatan_lab.kelas, '-') as kelas
			FROM jns_perawatan_lab
			WHERE jns_perawatan_lab.kategori = ?
			  AND jns_perawatan_lab.status = '1'
		`

		args := []interface{}{kategori}

		// Filter berdasarkan kd_pj — HANYA kalau saklar "Per Jenis Bayar
		// Laborat" aktif (Yes) DAN kd_pj pasien dikirim.
		if caraBayarAktif == "Yes" && kdPj != "" {
			query += " AND (jns_perawatan_lab.kd_pj = ? OR jns_perawatan_lab.kd_pj = '-')"
			args = append(args, kdPj)
		}

		// Filter berdasarkan kelas — HANYA kalau saklar "Per Kelas
		// Laborat" aktif (Yes) DAN kelas pasien dikirim.
		if kelasAktif == "Yes" && kelas != "" {
			query += " AND (jns_perawatan_lab.kelas = ? OR jns_perawatan_lab.kelas = '-')"
			args = append(args, kelas)
		}

		// Filter search
		if search != "" {
			query += " AND (jns_perawatan_lab.kd_jenis_prw LIKE ? OR jns_perawatan_lab.nm_perawatan LIKE ?)"
			searchPattern := "%" + search + "%"
			args = append(args, searchPattern, searchPattern)
		}

		query += " ORDER BY jns_perawatan_lab.nm_perawatan"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []JenisPerawatanLab
		for rows.Next() {
			var item JenisPerawatanLab
			if err := rows.Scan(
				&item.KdJenisPrw,
				&item.NmPerawatan,
				&item.Kategori,
				&item.Status,
				&item.KdPj,
				&item.Kelas,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, items)
	}
}

// Get detail template laboratorium berdasarkan kd_jenis_prw
func getTemplateLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdJenisPrw := c.Query("kd_jenis_prw")
		search := c.Query("search")

		if kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter kd_jenis_prw wajib diisi"})
			return
		}

		query := `
			SELECT
				id_template,
				Pemeriksaan,
				IFNULL(satuan, '') as satuan,
				IFNULL(nilai_rujukan_ld, '') as nilai_rujukan_ld,
				IFNULL(nilai_rujukan_la, '') as nilai_rujukan_la,
				IFNULL(nilai_rujukan_pd, '') as nilai_rujukan_pd,
				IFNULL(nilai_rujukan_pa, '') as nilai_rujukan_pa,
				kd_jenis_prw
			FROM template_laboratorium
			WHERE kd_jenis_prw = ?
		`

		args := []interface{}{kdJenisPrw}

		if search != "" {
			query += " AND Pemeriksaan LIKE ?"
			args = append(args, "%"+search+"%")
		}

		query += " ORDER BY urut"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []TemplateLab
		for rows.Next() {
			var item TemplateLab
			if err := rows.Scan(
				&item.IDTemplate,
				&item.Pemeriksaan,
				&item.Satuan,
				&item.NilaiRujukanLD,
				&item.NilaiRujukanLA,
				&item.NilaiRujukanPD,
				&item.NilaiRujukanPA,
				&item.KdJenisPrw,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, items)
	}
}

// Generate nomor permintaan lab otomatis
func generateNoPermintaan(db *sql.DB, tglPermintaan, prefix string) (string, error) {
	tglFormatted := tglPermintaan // format YYYY-MM-DD
	prefixWithDate := prefix + tglFormatted[0:4] + tglFormatted[5:7] + tglFormatted[8:10]

	var maxNo sql.NullInt64
	query := fmt.Sprintf(`
		SELECT MAX(CONVERT(RIGHT(noorder, 4), SIGNED))
		FROM permintaan_lab%s
		WHERE tgl_permintaan = ?
	`, func() string {
		if prefix == "PA" {
			return "pa"
		} else if prefix == "MB" {
			return "mb"
		}
		return ""
	}())

	err := db.QueryRow(query, tglPermintaan).Scan(&maxNo)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	nextNo := 1
	if maxNo.Valid {
		nextNo = int(maxNo.Int64) + 1
	}

	noPermintaan := fmt.Sprintf("%s%04d", prefixWithDate, nextNo)
	return noPermintaan, nil
}

// Simpan permintaan lab PK dengan retry mechanism
func simpanPermintaanLabPK(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload PermintaanLabPK
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		// Validasi
		if payload.NoRawat == "" || payload.DiagnosisKlinis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat dan Diagnosis Klinis wajib diisi"})
			return
		}

		if len(payload.PemeriksaanList) == 0 && len(payload.DetailPemeriksaan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu pemeriksaan"})
			return
		}

		// Set default values
		if payload.TglPermintaan == "" {
			payload.TglPermintaan = time.Now().Format("2006-01-02")
		}
		if payload.JamPermintaan == "" {
			payload.JamPermintaan = time.Now().Format("15:04:05")
		}

		// Retry mechanism (maksimal 4 kali seperti di Java)
		var noPermintaan string
		var txErr error
		maxRetries := 4

		for retry := 0; retry < maxRetries; retry++ {
			// Generate nomor permintaan
			var err error
			noPermintaan, err = generateNoPermintaan(db, payload.TglPermintaan, "PK")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate nomor permintaan: " + err.Error()})
				return
			}

			// Begin transaction
			tx, err := db.Begin()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Insert ke permintaan_lab
			insertQuery := `
				INSERT INTO permintaan_lab
				(noorder, no_rawat, tgl_permintaan, jam_permintaan, tgl_sampel, jam_sampel,
				 tgl_hasil, jam_hasil, dokter_perujuk, status, informasi_tambahan, diagnosa_klinis)
				VALUES (?, ?, ?, ?, '0000-00-00', '00:00:00', '0000-00-00', '00:00:00', ?, ?, ?, ?)
			`

			_, err = tx.Exec(
				insertQuery,
				noPermintaan,
				payload.NoRawat,
				payload.TglPermintaan,
				payload.JamPermintaan,
				payload.KdDokter,
				payload.StatusLanjut,
				payload.InformasiTambahan,
				payload.DiagnosisKlinis,
			)

			// Jika duplicate key, rollback dan retry
			if err != nil && (err.Error() == "Error 1062" || containsString(err.Error(), "Duplicate entry")) {
				tx.Rollback()
				continue // Retry dengan nomor baru
			}

			if err != nil {
				tx.Rollback()
				txErr = err
				break
			}

			// Insert ke permintaan_pemeriksaan_lab
			for _, kdJenisPrw := range payload.PemeriksaanList {
				_, err = tx.Exec(
					"INSERT INTO permintaan_pemeriksaan_lab (noorder, kd_jenis_prw, stts_bayar) VALUES (?, ?, 'Belum')",
					noPermintaan,
					kdJenisPrw,
				)
				if err != nil {
					tx.Rollback()
					txErr = err
					break
				}
			}

			if txErr != nil {
				break
			}

			// Insert ke permintaan_detail_permintaan_lab (untuk detail template)
			for _, idTemplate := range payload.DetailPemeriksaan {
				if idTemplate == "" {
					continue
				}
				// Get kd_jenis_prw from template
				var kdJenisPrw string
				err = tx.QueryRow("SELECT kd_jenis_prw FROM template_laboratorium WHERE id_template = ?", idTemplate).Scan(&kdJenisPrw)
				if err != nil {
					continue
				}

				_, err = tx.Exec(
					"INSERT INTO permintaan_detail_permintaan_lab (noorder, kd_jenis_prw, id_template, stts_bayar) VALUES (?, ?, ?, 'Belum')",
					noPermintaan,
					kdJenisPrw,
					idTemplate,
				)
				if err != nil {
					tx.Rollback()
					txErr = err
					break
				}
			}

			if txErr != nil {
				break
			}

			// Commit transaction
			if err := tx.Commit(); err == nil {
				// Berhasil, keluar dari retry loop
				c.JSON(http.StatusCreated, gin.H{
					"message":        "Permintaan lab PK berhasil disimpan",
					"noorder":        noPermintaan,
					"tgl_permintaan": payload.TglPermintaan,
					"jam_permintaan": payload.JamPermintaan,
				})
				return
			}

			tx.Rollback()
		}

		// Jika sampai sini berarti semua retry gagal
		if txErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan permintaan setelah " + fmt.Sprint(maxRetries) + " kali percobaan: " + txErr.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan permintaan setelah " + fmt.Sprint(maxRetries) + " kali percobaan"})
		}
	}
}

// Helper function untuk check string contains
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Simpan permintaan lab PA dengan retry mechanism
func simpanPermintaanLabPA(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload PermintaanLabPA
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		// Validasi
		if payload.NoRawat == "" || payload.DiagnosisKlinis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat dan Diagnosis Klinis wajib diisi"})
			return
		}

		if len(payload.PemeriksaanList) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu pemeriksaan"})
			return
		}

		// Set default values
		if payload.TglPermintaan == "" {
			payload.TglPermintaan = time.Now().Format("2006-01-02")
		}
		if payload.JamPermintaan == "" {
			payload.JamPermintaan = time.Now().Format("15:04:05")
		}
		if payload.TglPengambilanBahan == "" {
			payload.TglPengambilanBahan = time.Now().Format("2006-01-02")
		}
		if payload.TglPA == "" {
			payload.TglPA = "0000-00-00"
		}

		// Retry mechanism (maksimal 4 kali seperti di Java)
		var noPermintaan string
		var txErr error
		maxRetries := 4

		for retry := 0; retry < maxRetries; retry++ {
			// Generate nomor permintaan
			var err error
			noPermintaan, err = generateNoPermintaan(db, payload.TglPermintaan, "PA")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate nomor permintaan: " + err.Error()})
				return
			}

			// Begin transaction
			tx, err := db.Begin()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Insert ke permintaan_labpa
			insertQuery := `
				INSERT INTO permintaan_labpa
				(noorder, no_rawat, tgl_permintaan, jam_permintaan, tgl_sampel, jam_sampel,
				 tgl_hasil, jam_hasil, dokter_perujuk, status, informasi_tambahan, diagnosa_klinis,
				 pengambilan_bahan, diperoleh_dengan, lokasi_jaringan, diawetkan_dengan,
				 pernah_dilakukan_di, tanggal_pa_sebelumnya, nomor_pa_sebelumnya, diagnosa_pa_sebelumnya)
				VALUES (?, ?, ?, ?, '0000-00-00', '00:00:00', '0000-00-00', '00:00:00', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`

			_, err = tx.Exec(
				insertQuery,
				noPermintaan,
				payload.NoRawat,
				payload.TglPermintaan,
				payload.JamPermintaan,
				payload.KdDokter,
				payload.StatusLanjut,
				payload.InformasiTambahan,
				payload.DiagnosisKlinis,
				payload.TglPengambilanBahan,
				payload.DiperolehDengan,
				payload.LokasiPengambilan,
				payload.Diawetkan,
				payload.DilakukanPA,
				payload.TglPA,
				payload.NomorPA,
				payload.DiagnosaPA,
			)

			// Jika duplicate key, rollback dan retry
			if err != nil && (err.Error() == "Error 1062" || containsString(err.Error(), "Duplicate entry")) {
				tx.Rollback()
				continue // Retry dengan nomor baru
			}

			if err != nil {
				tx.Rollback()
				txErr = err
				break
			}

			// Insert ke permintaan_pemeriksaan_labpa
			for _, kdJenisPrw := range payload.PemeriksaanList {
				_, err = tx.Exec(
					"INSERT INTO permintaan_pemeriksaan_labpa (noorder, kd_jenis_prw, stts_bayar) VALUES (?, ?, 'Belum')",
					noPermintaan,
					kdJenisPrw,
				)
				if err != nil {
					tx.Rollback()
					txErr = err
					break
				}
			}

			if txErr != nil {
				break
			}

			// Commit transaction
			if err := tx.Commit(); err == nil {
				// Berhasil, keluar dari retry loop
				c.JSON(http.StatusCreated, gin.H{
					"message":        "Permintaan lab PA berhasil disimpan",
					"noorder":        noPermintaan,
					"tgl_permintaan": payload.TglPermintaan,
					"jam_permintaan": payload.JamPermintaan,
				})
				return
			}

			tx.Rollback()
		}

		// Jika sampai sini berarti semua retry gagal
		if txErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan permintaan PA setelah " + fmt.Sprint(maxRetries) + " kali percobaan: " + txErr.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan permintaan PA setelah " + fmt.Sprint(maxRetries) + " kali percobaan"})
		}
	}
}

type permintaanLabQueueRow struct {
	NoOrder         string `json:"noorder"`
	TglPermintaan   string `json:"tgl_permintaan"`
	JamPermintaan   string `json:"jam_permintaan"`
	NoRawat         string `json:"no_rawat"`
	NoRkmMedis      string `json:"no_rkm_medis"`
	NmPasien        string `json:"nm_pasien"`
	KdDokter        string `json:"kd_dokter"`
	NmDokter        string `json:"nm_dokter"`
	Status          string `json:"status"`
	DiagnosisKlinis string `json:"diagnosa_klinis"`
}

// getPermintaanLabList — antrean permintaan lab PK lintas pasien (padanan
// getPermintaanResepRalan di permintaan_resep_handler.go, dipakai utk
// tampilan mobile "Lab" quick-view). Cuma kategori PK (permintaan_lab) yg
// diport dulu — PA (permintaan_labpa) tabelnya terpisah, menyusul kalau
// dibutuhkan, sama pola inkremental "Fase 1" yg dipakai Permintaan Resep.
// "Belum Diperiksa"/"Sudah Diperiksa" dihitung dari tgl_hasil='0000-00-00',
// persis pola tgl_perawatan resep_obat.
func getPermintaanLabList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := c.Query("tgl1")
		tgl2 := c.Query("tgl2")
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		status := c.Query("status")
		search := c.Query("search")

		query := `
			SELECT pl.noorder, pl.tgl_permintaan, pl.jam_permintaan,
				pl.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				pl.dokter_perujuk, IFNULL(dokter.nm_dokter,'-'),
				IF(pl.tgl_hasil='0000-00-00','Belum Diperiksa','Sudah Diperiksa') AS status,
				IFNULL(pl.diagnosa_klinis,'')
			FROM permintaan_lab pl
			INNER JOIN reg_periksa ON pl.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
			WHERE pl.tgl_permintaan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if search != "" {
			query += ` AND (pl.noorder LIKE ? OR pl.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []permintaanLabQueueRow{}
		for rows.Next() {
			var r permintaanLabQueueRow
			if rows.Scan(&r.NoOrder, &r.TglPermintaan, &r.JamPermintaan, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.KdDokter, &r.NmDokter, &r.Status, &r.DiagnosisKlinis) == nil {
				if status == "" || status == r.Status {
					list = append(list, r)
				}
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// Get riwayat permintaan lab PK berdasarkan no_rawat
func getRiwayatLabPK(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		// Remove leading slash from wildcard parameter
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		query := `
			SELECT
				pl.noorder,
				pl.no_rawat,
				pl.tgl_permintaan,
				pl.jam_permintaan,
				pl.tgl_hasil,
				pl.jam_hasil,
				pl.dokter_perujuk,
				d.nm_dokter,
				pl.status,
				pl.informasi_tambahan,
				pl.diagnosa_klinis
			FROM permintaan_lab pl
			LEFT JOIN dokter d ON pl.dokter_perujuk = d.kd_dokter
			WHERE pl.no_rawat = ?
			ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []map[string]interface{}
		for rows.Next() {
			var noorder, noRawatDB, tglPermintaan, jamPermintaan, tglHasil, jamHasil string
			var dokterPerujuk, nmDokter, status, infoTambahan, diagnosisKlinis string

			if err := rows.Scan(
				&noorder, &noRawatDB, &tglPermintaan, &jamPermintaan,
				&tglHasil, &jamHasil, &dokterPerujuk, &nmDokter,
				&status, &infoTambahan, &diagnosisKlinis,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Get detail pemeriksaan
			detailQuery := `
				SELECT
					ppl.kd_jenis_prw,
					jpl.nm_perawatan,
					ppl.stts_bayar
				FROM permintaan_pemeriksaan_lab ppl
				LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
				WHERE ppl.noorder = ?
			`
			detailRows, _ := db.Query(detailQuery, noorder)
			var details []map[string]interface{}
			for detailRows.Next() {
				var kdJenisPrw, nmPerawatan, sttsBayar string
				detailRows.Scan(&kdJenisPrw, &nmPerawatan, &sttsBayar)
				details = append(details, map[string]interface{}{
					"kd_jenis_prw": kdJenisPrw,
					"nm_perawatan": nmPerawatan,
					"stts_bayar":   sttsBayar,
				})
			}
			detailRows.Close()

			items = append(items, map[string]interface{}{
				"noorder":            noorder,
				"no_rawat":           noRawatDB,
				"tgl_permintaan":     tglPermintaan,
				"jam_permintaan":     jamPermintaan,
				"tgl_hasil":          tglHasil,
				"jam_hasil":          jamHasil,
				"dokter_perujuk":     dokterPerujuk,
				"nm_dokter":          nmDokter,
				"status":             status,
				"informasi_tambahan": infoTambahan,
				"diagnosa_klinis":    diagnosisKlinis,
				"detail_pemeriksaan": details,
			})
		}

		c.JSON(http.StatusOK, items)
	}
}

// Get riwayat permintaan lab PA berdasarkan no_rawat
func getRiwayatLabPA(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		// Remove leading slash from wildcard parameter
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		query := `
			SELECT
				pl.noorder,
				pl.no_rawat,
				pl.tgl_permintaan,
				pl.jam_permintaan,
				pl.tgl_hasil,
				pl.jam_hasil,
				pl.dokter_perujuk,
				d.nm_dokter,
				pl.status,
				pl.informasi_tambahan,
				pl.diagnosa_klinis,
				pl.pengambilan_bahan,
				pl.diperoleh_dengan,
				pl.lokasi_jaringan,
				pl.diawetkan_dengan
			FROM permintaan_labpa pl
			LEFT JOIN dokter d ON pl.dokter_perujuk = d.kd_dokter
			WHERE pl.no_rawat = ?
			ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []map[string]interface{}
		for rows.Next() {
			var noorder, noRawatDB, tglPermintaan, jamPermintaan, tglHasil, jamHasil string
			var dokterPerujuk, nmDokter, status, infoTambahan, diagnosisKlinis string
			var tglBahan, diperoleh, lokasi, diawetkan string

			if err := rows.Scan(
				&noorder, &noRawatDB, &tglPermintaan, &jamPermintaan,
				&tglHasil, &jamHasil, &dokterPerujuk, &nmDokter,
				&status, &infoTambahan, &diagnosisKlinis,
				&tglBahan, &diperoleh, &lokasi, &diawetkan,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Get detail pemeriksaan
			detailQuery := `
				SELECT
					ppl.kd_jenis_prw,
					jpl.nm_perawatan,
					ppl.stts_bayar
				FROM permintaan_pemeriksaan_labpa ppl
				LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
				WHERE ppl.noorder = ?
			`
			detailRows, _ := db.Query(detailQuery, noorder)
			var details []map[string]interface{}
			for detailRows.Next() {
				var kdJenisPrw, nmPerawatan, sttsBayar string
				detailRows.Scan(&kdJenisPrw, &nmPerawatan, &sttsBayar)
				details = append(details, map[string]interface{}{
					"kd_jenis_prw": kdJenisPrw,
					"nm_perawatan": nmPerawatan,
					"stts_bayar":   sttsBayar,
				})
			}
			detailRows.Close()

			items = append(items, map[string]interface{}{
				"noorder":               noorder,
				"no_rawat":              noRawatDB,
				"tgl_permintaan":        tglPermintaan,
				"jam_permintaan":        jamPermintaan,
				"tgl_hasil":             tglHasil,
				"jam_hasil":             jamHasil,
				"dokter_perujuk":        dokterPerujuk,
				"nm_dokter":             nmDokter,
				"status":                status,
				"informasi_tambahan":    infoTambahan,
				"diagnosa_klinis":       diagnosisKlinis,
				"tgl_pengambilan_bahan": tglBahan,
				"diperoleh_dari":        diperoleh,
				"lokasi_pengambilan":    lokasi,
				"diawetkan":             diawetkan,
				"detail_pemeriksaan":    details,
			})
		}

		c.JSON(http.StatusOK, items)
	}
}

// Get hasil lab detail lengkap berdasarkan noorder dan tanggal/jam
func getHasilLabDetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kategori := c.Query("kategori") // PK atau PA
		noRawat := c.Query("no_rawat")
		tglPeriksa := c.Query("tgl_periksa")
		jamPeriksa := c.Query("jam")

		if kategori == "" || noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kategori wajib diisi"})
			return
		}

		// Query untuk mendapatkan data periksa_lab (hasil yang sudah selesai)
		var queryPeriksa string
		if kategori == "PK" {
			queryPeriksa = `
				SELECT DISTINCT
					pl.no_rawat,
					pl.tgl_periksa,
					pl.jam,
					pl.kd_jenis_prw,
					jpl.nm_perawatan,
					pl.biaya,
					pl.dokter_perujuk,
					d.nm_dokter,
					rp.no_rkm_medis,
					p.nm_pasien,
					pet.nama as nm_petugas,
					pj.png_jawab
				FROM periksa_lab pl
				LEFT JOIN jns_perawatan_lab jpl ON pl.kd_jenis_prw = jpl.kd_jenis_prw
				LEFT JOIN dokter d ON pl.kd_dokter = d.kd_dokter
				LEFT JOIN reg_periksa rp ON pl.no_rawat = rp.no_rawat
				LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
				LEFT JOIN petugas pet ON pl.nip = pet.nip
				LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
				WHERE pl.no_rawat = ? AND pl.kategori = 'PK'
			`
		} else {
			// Khanza tidak punya tabel header "periksa_labpa" terpisah seperti PK.
			// Hasil PA langsung tersimpan di detail_periksa_labpa (laporan naratif),
			// jadi tabel itu sendiri yang jadi sumber "sudah diperiksa". Info dokter/
			// pasien diambil dari permintaan_labpa & reg_periksa.
			queryPeriksa = `
				SELECT DISTINCT
					pl.no_rawat,
					pl.tgl_periksa,
					pl.jam,
					pl.kd_jenis_prw,
					jpl.nm_perawatan,
					0 as biaya,
					req.dokter_perujuk,
					d.nm_dokter,
					rp.no_rkm_medis,
					p.nm_pasien,
					'' as nm_petugas,
					pj.png_jawab
				FROM detail_periksa_labpa pl
				LEFT JOIN jns_perawatan_lab jpl ON pl.kd_jenis_prw = jpl.kd_jenis_prw
				LEFT JOIN permintaan_labpa req ON pl.no_rawat = req.no_rawat
				LEFT JOIN dokter d ON req.dokter_perujuk = d.kd_dokter
				LEFT JOIN reg_periksa rp ON pl.no_rawat = rp.no_rawat
				LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
				LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
				WHERE pl.no_rawat = ?
			`
		}

		if tglPeriksa != "" && jamPeriksa != "" {
			queryPeriksa += " AND pl.tgl_periksa = ? AND pl.jam = ?"
		}

		queryPeriksa += " GROUP BY pl.kd_jenis_prw ORDER BY pl.tgl_periksa DESC, pl.jam DESC"

		var rows *sql.Rows
		var err error

		if tglPeriksa != "" && jamPeriksa != "" {
			rows, err = db.Query(queryPeriksa, noRawat, tglPeriksa, jamPeriksa)
		} else {
			rows, err = db.Query(queryPeriksa, noRawat)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var hasilList []map[string]interface{}
		var totalBiaya float64

		// Info header (ambil dari baris pertama)
		var headerInfo map[string]interface{}

		for rows.Next() {
			var noRawatDB, tglPeriksa, jam, kdJenisPrw, nmPerawatan string
			var biaya float64
			var dokterPerujuk, nmDokter, noRkm, nmPasien, nmPetugas, pngJawab sql.NullString

			err := rows.Scan(
				&noRawatDB, &tglPeriksa, &jam, &kdJenisPrw, &nmPerawatan, &biaya,
				&dokterPerujuk, &nmDokter, &noRkm, &nmPasien, &nmPetugas, &pngJawab,
			)
			if err != nil {
				continue
			}

			// Set header info (hanya sekali)
			if headerInfo == nil {
				headerInfo = map[string]interface{}{
					"no_rawat":       noRawatDB,
					"no_rkm_medis":   noRkm.String,
					"nm_pasien":      nmPasien.String,
					"tgl_periksa":    tglPeriksa,
					"jam":            jam,
					"nm_dokter":      nmDokter.String,
					"nm_petugas":     nmPetugas.String,
					"png_jawab":      pngJawab.String,
					"dokter_perujuk": dokterPerujuk.String,
				}
			}

			totalBiaya += biaya

			var detailItems []map[string]interface{}

			if kategori == "PK" {
				// PK: hasil berupa nilai per-item mengacu template_laboratorium
				detailQuery := `
					SELECT
						tl.Pemeriksaan,
						dpl.nilai,
						tl.satuan,
						dpl.nilai_rujukan,
						dpl.biaya_item,
						dpl.keterangan
					FROM detail_periksa_lab dpl
					INNER JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
					WHERE dpl.no_rawat = ? AND dpl.kd_jenis_prw = ? AND dpl.tgl_periksa = ? AND dpl.jam = ?
					ORDER BY tl.urut
				`
				detailRows, err := db.Query(detailQuery, noRawatDB, kdJenisPrw, tglPeriksa, jam)
				if err != nil {
					continue
				}
				for detailRows.Next() {
					var pemeriksaan, nilai, satuan, nilaiRujukan, keterangan string
					var biayaItemDetail float64

					detailRows.Scan(&pemeriksaan, &nilai, &satuan, &nilaiRujukan, &biayaItemDetail, &keterangan)
					totalBiaya += biayaItemDetail

					detailItems = append(detailItems, map[string]interface{}{
						"pemeriksaan":   pemeriksaan,
						"nilai":         nilai,
						"satuan":        satuan,
						"nilai_rujukan": nilaiRujukan,
						"biaya_item":    biayaItemDetail,
						"keterangan":    keterangan,
					})
				}
				detailRows.Close()
			} else {
				// PA: hasilnya laporan naratif (bukan nilai per-item), disimpan
				// langsung sebagai kolom di detail_periksa_labpa (tanpa template).
				var diagnosaKlinik, makroskopik, mikroskopik, kesimpulan, kesan sql.NullString
				err := db.QueryRow(
					`SELECT diagnosa_klinik, makroskopik, mikroskopik, kesimpulan, kesan
					 FROM detail_periksa_labpa
					 WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_periksa = ? AND jam = ?`,
					noRawatDB, kdJenisPrw, tglPeriksa, jam,
				).Scan(&diagnosaKlinik, &makroskopik, &mikroskopik, &kesimpulan, &kesan)
				if err == nil {
					addNarrative := func(label, val string) {
						if val == "" {
							return
						}
						detailItems = append(detailItems, map[string]interface{}{
							"pemeriksaan":   label,
							"nilai":         val,
							"satuan":        "",
							"nilai_rujukan": "",
							"biaya_item":    0.0,
							"keterangan":    "",
						})
					}
					addNarrative("Diagnosa Klinik", diagnosaKlinik.String)
					addNarrative("Makroskopik", makroskopik.String)
					addNarrative("Mikroskopik", mikroskopik.String)
					addNarrative("Kesimpulan", kesimpulan.String)
					addNarrative("Kesan", kesan.String)
				}
			}

			hasilList = append(hasilList, map[string]interface{}{
				"kd_jenis_prw": kdJenisPrw,
				"nm_perawatan": nmPerawatan,
				"tgl_periksa":  tglPeriksa,
				"jam":          jam,
				"biaya":        biaya,
				"detail":       detailItems,
			})
		}

		// Ambil saran dan kesan jika ada. Khanza cuma punya tabel saran_kesan_lab
		// untuk PK — kesan PA sudah ikut tampil sebagai baris naratif di atas.
		var saran, kesan string
		if kategori == "PK" {
			saranQuery := "SELECT saran, kesan FROM saran_kesan_lab WHERE no_rawat = ?"
			if tglPeriksa != "" && jamPeriksa != "" {
				saranQuery += " AND tgl_periksa = ? AND jam = ?"
				db.QueryRow(saranQuery, noRawat, tglPeriksa, jamPeriksa).Scan(&saran, &kesan)
			} else {
				db.QueryRow(saranQuery, noRawat).Scan(&saran, &kesan)
			}
		}

		response := map[string]interface{}{
			"header":      headerInfo,
			"hasil":       hasilList,
			"total_biaya": totalBiaya,
			"saran":       saran,
			"kesan":       kesan,
		}

		c.JSON(http.StatusOK, response)
	}
}

// deletePermintaanLabPK - Delete permintaan lab PK by noorder
func deletePermintaanLabPK(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noorder := c.Param("noorder")

		if noorder == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "No order is required",
			})
			return
		}

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to start transaction: " + err.Error(),
			})
			return
		}
		defer tx.Rollback()

		// Delete detail permintaan lab first
		_, err = tx.Exec("DELETE FROM permintaan_detail_permintaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete detail permintaan: " + err.Error(),
			})
			return
		}

		// Delete permintaan pemeriksaan lab
		_, err = tx.Exec("DELETE FROM permintaan_pemeriksaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete pemeriksaan lab: " + err.Error(),
			})
			return
		}

		// Delete permintaan lab header
		_, err = tx.Exec("DELETE FROM permintaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete permintaan lab: " + err.Error(),
			})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to commit transaction: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Permintaan lab PK berhasil dihapus",
		})
	}
}

// deletePermintaanLabPA - Delete permintaan lab PA by noorder
func deletePermintaanLabPA(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noorder := c.Param("noorder")

		if noorder == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "No order is required",
			})
			return
		}

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to start transaction: " + err.Error(),
			})
			return
		}
		defer tx.Rollback()

		// Delete detail permintaan lab PA first
		_, err = tx.Exec("DELETE FROM permintaan_detail_permintaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete detail permintaan: " + err.Error(),
			})
			return
		}

		// Delete permintaan pemeriksaan lab PA
		_, err = tx.Exec("DELETE FROM permintaan_pemeriksaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete pemeriksaan lab: " + err.Error(),
			})
			return
		}

		// Delete permintaan lab header
		_, err = tx.Exec("DELETE FROM permintaan_lab WHERE noorder = ?", noorder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to delete permintaan lab: " + err.Error(),
			})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to commit transaction: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Permintaan lab PA berhasil dihapus",
		})
	}
}

// ============================================================================
// DETAIL PERIKSA LAB (Klaim INACBG -> klik "Laboratorium") — rincian
// pemeriksaan lab rawat inap (status='Ranap') per no_rawat. Sama scope dgn
// SUM yang dipakai getKlaimInacbgList (klaim_inacbg_handler.go) utk kolom
// Laboratorium, padanan pola getDetailPemberianObat (obat_handler.go).
// ============================================================================

// DetailPeriksaLabItem merepresentasikan satu baris pemeriksaan lab.
type DetailPeriksaLabItem struct {
	TglPeriksa  string  `json:"tgl_periksa"`
	Jam         string  `json:"jam"`
	NmPerawatan string  `json:"nm_perawatan"`
	Biaya       float64 `json:"biaya"`
}

// getDetailPeriksaLab mengambil rincian pemeriksaan lab rawat inap
// (status='Ranap') untuk satu no_rawat, dipakai modal ModalDetailPeriksaLab.
func getDetailPeriksaLab(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		query := `
			SELECT
				DATE_FORMAT(pl.tgl_periksa, '%d/%m/%Y') as tgl_periksa,
				TIME_FORMAT(pl.jam, '%H:%i:%s') as jam,
				jpl.nm_perawatan,
				pl.biaya
			FROM periksa_lab pl
			INNER JOIN jns_perawatan_lab jpl ON pl.kd_jenis_prw = jpl.kd_jenis_prw
			WHERE pl.no_rawat = ? AND pl.status = 'Ranap'
			ORDER BY pl.tgl_periksa, pl.jam, jpl.nm_perawatan
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []DetailPeriksaLabItem{}
		for rows.Next() {
			var it DetailPeriksaLabItem
			if err := rows.Scan(&it.TglPeriksa, &it.Jam, &it.NmPerawatan, &it.Biaya); err != nil {
				continue
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, items)
	}
}
