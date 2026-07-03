package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Struktur untuk jenis perawatan radiologi
type JenisPerawatanRadiologi struct {
	KdJenisPrw  string `json:"kd_jenis_prw"`
	NmPerawatan string `json:"nm_perawatan"`
	Status      string `json:"status"`
	KdPj        string `json:"kd_pj"`
	Kelas       string `json:"kelas"`
}

// Struktur untuk permintaan radiologi
type PermintaanRadiologi struct {
	NoOrder           string   `json:"noorder"`
	NoRawat           string   `json:"no_rawat"`
	TglPermintaan     string   `json:"tgl_permintaan"`
	JamPermintaan     string   `json:"jam_permintaan"`
	TglSampel         string   `json:"tgl_sampel"`
	JamSampel         string   `json:"jam_sampel"`
	TglHasil          string   `json:"tgl_hasil"`
	JamHasil          string   `json:"jam_hasil"`
	DokterPerujuk     string   `json:"dokter_perujuk"`
	Status            string   `json:"status"`
	InformasiTambahan string   `json:"informasi_tambahan"`
	DiagnosisKlinis   string   `json:"diagnosis_klinis"`
	PemeriksaanList   []string `json:"pemeriksaan_list"` // kd_jenis_prw yang dipilih
}

// Get daftar jenis perawatan radiologi
func getJenisPerawatanRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("search")
		kdPj := c.Query("kd_pj")
		kelas := c.Query("kelas")

		query := `
			SELECT
				jns_perawatan_radiologi.kd_jenis_prw,
				jns_perawatan_radiologi.nm_perawatan,
				jns_perawatan_radiologi.status,
				IFNULL(jns_perawatan_radiologi.kd_pj, '-') as kd_pj,
				IFNULL(jns_perawatan_radiologi.kelas, '-') as kelas
			FROM jns_perawatan_radiologi
			WHERE jns_perawatan_radiologi.status = '1'
		`

		args := []interface{}{}

		// Filter berdasarkan kd_pj jika ada
		if kdPj != "" {
			query += " AND (jns_perawatan_radiologi.kd_pj = ? OR jns_perawatan_radiologi.kd_pj = '-')"
			args = append(args, kdPj)
		}

		// Filter berdasarkan kelas jika ada
		if kelas != "" {
			query += " AND (jns_perawatan_radiologi.kelas = ? OR jns_perawatan_radiologi.kelas = '-')"
			args = append(args, kelas)
		}

		// Filter berdasarkan search (kode atau nama)
		if search != "" {
			query += " AND (jns_perawatan_radiologi.kd_jenis_prw LIKE ? OR jns_perawatan_radiologi.nm_perawatan LIKE ?)"
			searchPattern := "%" + search + "%"
			args = append(args, searchPattern, searchPattern)
		}

		query += " ORDER BY jns_perawatan_radiologi.kd_jenis_prw"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jenis perawatan radiologi", "details": err.Error()})
			return
		}
		defer rows.Close()

		var results []JenisPerawatanRadiologi
		for rows.Next() {
			var item JenisPerawatanRadiologi
			err := rows.Scan(
				&item.KdJenisPrw,
				&item.NmPerawatan,
				&item.Status,
				&item.KdPj,
				&item.Kelas,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data", "details": err.Error()})
				return
			}
			results = append(results, item)
		}

		if results == nil {
			results = []JenisPerawatanRadiologi{}
		}

		c.JSON(http.StatusOK, results)
	}
}

// Generate nomor order radiologi
func generateNoOrderRadiologi(db *sql.DB) (string, error) {
	now := time.Now()
	prefix := fmt.Sprintf("RAD%s", now.Format("20060102")) // RAD20231210

	var lastNoOrder sql.NullString
	query := `SELECT noorder FROM permintaan_radiologi WHERE noorder LIKE ? ORDER BY noorder DESC LIMIT 1`
	err := db.QueryRow(query, prefix+"%").Scan(&lastNoOrder)

	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	sequence := 1
	if lastNoOrder.Valid && len(lastNoOrder.String) >= len(prefix)+4 {
		fmt.Sscanf(lastNoOrder.String[len(prefix):], "%d", &sequence)
		sequence++
	}

	noOrder := fmt.Sprintf("%s%04d", prefix, sequence)
	return noOrder, nil
}

// Create permintaan radiologi
func createPermintaanRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req PermintaanRadiologi

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid", "details": err.Error()})
			return
		}

		// Validasi input wajib
		if req.NoRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat wajib diisi"})
			return
		}

		if req.DiagnosisKlinis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Diagnosis Klinis wajib diisi"})
			return
		}

		if len(req.PemeriksaanList) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu pemeriksaan"})
			return
		}

		// Generate nomor order
		noOrder, err := generateNoOrderRadiologi(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate nomor order", "details": err.Error()})
			return
		}
		req.NoOrder = noOrder

		// Begin transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi", "details": err.Error()})
			return
		}
		defer tx.Rollback()

		// Insert ke tabel permintaan_radiologi
		queryInsertPermintaan := `
			INSERT INTO permintaan_radiologi (
				noorder, no_rawat, tgl_permintaan, jam_permintaan,
				tgl_sampel, jam_sampel, tgl_hasil, jam_hasil,
				dokter_perujuk, status, informasi_tambahan, diagnosa_klinis
			) VALUES (?, ?, ?, ?, '0000-00-00', '00:00:00', '0000-00-00', '00:00:00', ?, ?, ?, ?)
		`

		_, err = tx.Exec(queryInsertPermintaan,
			req.NoOrder,
			req.NoRawat,
			req.TglPermintaan,
			req.JamPermintaan,
			req.DokterPerujuk,
			req.Status,
			req.InformasiTambahan,
			req.DiagnosisKlinis,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan permintaan radiologi", "details": err.Error()})
			return
		}

		// Insert detail pemeriksaan ke tabel permintaan_pemeriksaan_radiologi
		queryInsertDetail := `
			INSERT INTO permintaan_pemeriksaan_radiologi (
				noorder, kd_jenis_prw
			) VALUES (?, ?)
		`

		for _, kdJenisPrw := range req.PemeriksaanList {
			_, err = tx.Exec(queryInsertDetail, req.NoOrder, kdJenisPrw)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan detail pemeriksaan", "details": err.Error()})
				return
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Permintaan radiologi berhasil disimpan",
			"noorder": req.NoOrder,
		})
	}
}

// Get riwayat permintaan radiologi berdasarkan no_rawat
func getRiwayatRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")

		// Remove leading slash from wildcard parameter
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No rawat wajib diisi"})
			return
		}

		query := `
			SELECT
				pr.noorder,
				pr.no_rawat,
				pr.tgl_permintaan,
				IF(pr.jam_permintaan='00:00:00', '', pr.jam_permintaan) as jam_permintaan,
				pr.dokter_perujuk,
				IFNULL(d.nm_dokter, '-') as nm_dokter,
				pr.status,
				IFNULL(pr.informasi_tambahan, '') as informasi_tambahan,
				IFNULL(pr.diagnosa_klinis, '') as diagnosa_klinis
			FROM permintaan_radiologi pr
			LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
			WHERE pr.no_rawat = ?
			ORDER BY pr.tgl_permintaan DESC, pr.jam_permintaan DESC
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil riwayat radiologi", "details": err.Error()})
			return
		}
		defer rows.Close()

		type RiwayatRadiologi struct {
			NoOrder           string                        `json:"noorder"`
			NoRawat           string                        `json:"no_rawat"`
			TglPermintaan     string                        `json:"tgl_permintaan"`
			JamPermintaan     string                        `json:"jam_permintaan"`
			KdDokter          string                        `json:"kd_dokter"`
			NmDokter          string                        `json:"nm_dokter"`
			Status            string                        `json:"status"`
			InformasiTambahan string                        `json:"informasi_tambahan"`
			DiagnosisKlinis   string                        `json:"diagnosa_klinis"`
			DetailPemeriksaan []map[string]interface{}      `json:"detail_pemeriksaan"`
		}

		var results []RiwayatRadiologi
		for rows.Next() {
			var item RiwayatRadiologi
			err := rows.Scan(
				&item.NoOrder,
				&item.NoRawat,
				&item.TglPermintaan,
				&item.JamPermintaan,
				&item.KdDokter,
				&item.NmDokter,
				&item.Status,
				&item.InformasiTambahan,
				&item.DiagnosisKlinis,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data", "details": err.Error()})
				return
			}

			// Get detail pemeriksaan untuk setiap permintaan
			queryDetail := `
				SELECT
					ppr.kd_jenis_prw,
					jpr.nm_perawatan
				FROM permintaan_pemeriksaan_radiologi ppr
				LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
				WHERE ppr.noorder = ?
			`

			detailRows, err := db.Query(queryDetail, item.NoOrder)
			if err == nil {
				defer detailRows.Close()
				var details []map[string]interface{}
				for detailRows.Next() {
					var kdJenisPrw, nmPerawatan string
					if err := detailRows.Scan(&kdJenisPrw, &nmPerawatan); err == nil {
						details = append(details, map[string]interface{}{
							"kd_jenis_prw": kdJenisPrw,
							"nm_perawatan": nmPerawatan,
						})
					}
				}
				item.DetailPemeriksaan = details
			}

			results = append(results, item)
		}

		if results == nil {
			results = []RiwayatRadiologi{}
		}

		c.JSON(http.StatusOK, results)
	}
}

// getInfoRawatRadiologi replicates Khanza Java isRawat() logic.
// Returns status (ranap/ralan), kelas, kamar code, and nama_kamar for the patient.
func getInfoRawatRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var statusLanjut string
		if err := db.QueryRow(
			`SELECT IFNULL(status_lanjut,'Ralan') FROM reg_periksa WHERE no_rawat=? LIMIT 1`, noRawat,
		).Scan(&statusLanjut); err != nil {
			statusLanjut = "Ralan"
		}

		if statusLanjut == "Ranap" {
			// Khanza: cek ranap_gabung — pasien bayi/gabungan memakai no_rawat ibu
			var noRawatIbu string
			db.QueryRow(`SELECT IFNULL(no_rawat,'') FROM ranap_gabung WHERE no_rawat2=? LIMIT 1`, noRawat).Scan(&noRawatIbu)
			noRawatLookup := noRawat
			if noRawatIbu != "" {
				noRawatLookup = noRawatIbu
			}

			var kamar, kelas, nmBangsal string
			db.QueryRow(
				`SELECT IFNULL(kd_kamar,'') FROM kamar_inap WHERE no_rawat=? ORDER BY tgl_masuk DESC LIMIT 1`,
				noRawatLookup,
			).Scan(&kamar)

			db.QueryRow(`
				SELECT kamar.kelas FROM kamar
				INNER JOIN kamar_inap ON kamar.kd_kamar=kamar_inap.kd_kamar
				WHERE kamar_inap.no_rawat=? AND kamar_inap.stts_pulang='-'
				ORDER BY STR_TO_DATE(CONCAT(kamar_inap.tgl_masuk,' ',kamar_inap.jam_masuk),'%Y-%m-%d %H:%i:%s') DESC LIMIT 1`,
				noRawatLookup,
			).Scan(&kelas)

			db.QueryRow(`
				SELECT IFNULL(bangsal.nm_bangsal,'') FROM bangsal
				INNER JOIN kamar ON bangsal.kd_bangsal=kamar.kd_bangsal
				WHERE kamar.kd_kamar=? LIMIT 1`, kamar,
			).Scan(&nmBangsal)

			namaKamar := kamar
			if nmBangsal != "" {
				namaKamar = kamar + ", " + nmBangsal
			}

			c.JSON(http.StatusOK, gin.H{
				"status":     "ranap",
				"kelas":      kelas,
				"kamar":      kamar,
				"nama_kamar": namaKamar,
			})
			return
		}

		// Ralan
		var nmPoli string
		db.QueryRow(`
			SELECT IFNULL(poliklinik.nm_poli,'') FROM poliklinik
			INNER JOIN reg_periksa ON poliklinik.kd_poli=reg_periksa.kd_poli
			WHERE reg_periksa.no_rawat=? LIMIT 1`, noRawat,
		).Scan(&nmPoli)

		c.JSON(http.StatusOK, gin.H{
			"status":     "ralan",
			"kelas":      "Rawat Jalan",
			"kamar":      "Poli",
			"nama_kamar": nmPoli,
		})
	}
}

// Delete permintaan radiologi
func deletePermintaanRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")

		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No order wajib diisi"})
			return
		}

		// Begin transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi", "details": err.Error()})
			return
		}
		defer tx.Rollback()

		// Delete detail pemeriksaan dulu
		queryDeleteDetail := `DELETE FROM permintaan_pemeriksaan_radiologi WHERE noorder = ?`
		_, err = tx.Exec(queryDeleteDetail, noOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus detail pemeriksaan", "details": err.Error()})
			return
		}

		// Delete permintaan radiologi
		queryDeletePermintaan := `DELETE FROM permintaan_radiologi WHERE noorder = ?`
		result, err := tx.Exec(queryDeletePermintaan, noOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus permintaan radiologi", "details": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Permintaan radiologi berhasil dihapus",
		})
	}
}
