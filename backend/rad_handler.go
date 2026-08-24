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

		// Saklar Set Penggunaan Tarif (set_tarif.cara_bayar_radiologi/
		// kelas_radiologi, lihat set_tarif_handler.go) — padanan
		// DlgPeriksaRadiologi.java yang baca set_tarif saat dialog dibuka
		// lalu pilih salah satu dari 4 varian query (Yes/Yes = filter
		// keduanya, Yes/No = kd_pj saja, No/Yes = kelas saja, No/No = tanpa
		// filter). Kalau baris set_tarif belum ada, default ke "Yes" utk
		// KEDUA saklar (padanan persis fallback Java saat rsset_tarif tidak
		// punya baris) — filter tetap aktif by default, bukan langsung
		// terbuka lebar, supaya tidak mendadak menampilkan semua tarif
		// tanpa sepengetahuan admin.
		caraBayarAktif, kelasAktif := "Yes", "Yes"
		db.QueryRow(`SELECT cara_bayar_radiologi, kelas_radiologi FROM set_tarif LIMIT 1`).Scan(&caraBayarAktif, &kelasAktif)

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

		// Filter berdasarkan kd_pj — HANYA kalau saklar "Per Jenis Bayar
		// Radiologi" aktif (Yes) DAN kd_pj pasien dikirim.
		if caraBayarAktif == "Yes" && kdPj != "" {
			query += " AND (jns_perawatan_radiologi.kd_pj = ? OR jns_perawatan_radiologi.kd_pj = '-')"
			args = append(args, kdPj)
		}

		// Filter berdasarkan kelas — HANYA kalau saklar "Per Kelas
		// Radiologi" aktif (Yes) DAN kelas pasien dikirim.
		if kelasAktif == "Yes" && kelas != "" {
			query += " AND (jns_perawatan_radiologi.kelas = ? OR jns_perawatan_radiologi.kelas = '-')"
			args = append(args, kelas)
		}

		// Filter berdasarkan search (kode atau nama)
		if search != "" {
			query += " AND (jns_perawatan_radiologi.kd_jenis_prw LIKE ? OR jns_perawatan_radiologi.nm_perawatan LIKE ?)"
			searchPattern := "%" + search + "%"
			args = append(args, searchPattern, searchPattern)
		}

		query += " ORDER BY jns_perawatan_radiologi.kd_jenis_prw LIMIT 50"

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

type permintaanRadiologiQueueRow struct {
	NoOrder           string `json:"noorder"`
	TglPermintaan     string `json:"tgl_permintaan"`
	JamPermintaan     string `json:"jam_permintaan"`
	NoRawat           string `json:"no_rawat"`
	NoRkmMedis        string `json:"no_rkm_medis"`
	NmPasien          string `json:"nm_pasien"`
	KdDokter          string `json:"kd_dokter"`
	NmDokter          string `json:"nm_dokter"`
	Status            string `json:"status"`
	DiagnosisKlinis   string `json:"diagnosa_klinis"`
	Rawat             string `json:"rawat"` // 'ralan'/'ranap' — permintaan_radiologi.status mentah
	TglSampel         string `json:"tgl_sampel"`
	JamSampel         string `json:"jam_sampel"`
	KdPj              string `json:"kd_pj"`
	PngJawab          string `json:"png_jawab"`
	InformasiTambahan string `json:"informasi_tambahan"`
	Ruang             string `json:"ruang"` // poli (ralan) atau kamar+bangsal (ranap)
	TglHasil          string `json:"tgl_hasil"`
	JamHasil          string `json:"jam_hasil"`
	Pemeriksaan       string `json:"pemeriksaan"` // nama jenis pemeriksaan, digabung koma
}

// getPermintaanRadiologiList — antrean permintaan radiologi lintas pasien.
// Padanan tampil()/tampil3() di DlgCariPermintaanRadiologi.java (Khanza
// Desktop) yg punya 2 tab terpisah Rawat Jalan/Rawat Inap — di sini
// disatukan jadi SATU query dgn kolom "ruang" yg computed beda sumber
// tergantung pr.status (poliklinik utk ralan, kamar_inap TERBARU+bangsal
// utk ranap, fallback 'Ranap Gabung' kalau kamar tidak ketemu — sama
// persis pola ki_last/ranap_gabung Khanza), supaya tidak perlu duplikasi
// query spt aslinya. Filter `rawat=ralan|ranap` opsional (dipakai tab
// Radiologi.tsx); kalau kosong, kembalikan KEDUANYA gabung — perilaku lama
// yg masih dipakai PresensiMobile.tsx "Radiologi" quick-view (tanpa
// query param sama sekali). "Belum Diperiksa"/"Sudah Diperiksa" dihitung
// dari tgl_hasil='0000-00-00', persis pola Lab/Resep.
func getPermintaanRadiologiList(db *sql.DB) gin.HandlerFunc {
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
		rawat := c.Query("rawat")

		query := `
			SELECT pr.noorder, DATE_FORMAT(pr.tgl_permintaan,'%Y-%m-%d'), IF(pr.jam_permintaan='00:00:00','',pr.jam_permintaan),
				pr.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				pr.dokter_perujuk, IFNULL(dokter.nm_dokter,'-'),
				IF(pr.tgl_hasil='0000-00-00','Belum Diperiksa','Sudah Diperiksa') AS status,
				IFNULL(pr.diagnosa_klinis,''), pr.status,
				IF(pr.tgl_sampel='0000-00-00','',DATE_FORMAT(pr.tgl_sampel,'%Y-%m-%d')), IF(pr.jam_sampel='00:00:00','',pr.jam_sampel),
				reg_periksa.kd_pj, IFNULL(penjab.png_jawab,''), IFNULL(pr.informasi_tambahan,''),
				CASE WHEN pr.status='ranap' THEN CONCAT(IFNULL(ki_last.kd_kamar,''),' ',IFNULL(bangsal.nm_bangsal,'Ranap Gabung'))
					ELSE IFNULL(poliklinik.nm_poli,'') END AS ruang,
				IF(pr.tgl_hasil='0000-00-00','',DATE_FORMAT(pr.tgl_hasil,'%Y-%m-%d')), IF(pr.jam_hasil='00:00:00','',pr.jam_hasil),
				IFNULL(prw.pemeriksaan,'')
			FROM permintaan_radiologi pr
			INNER JOIN reg_periksa ON pr.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pr.dokter_perujuk = dokter.kd_dokter
			LEFT JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			LEFT JOIN (
				SELECT kamar_inap.no_rawat, kamar_inap.kd_kamar FROM kamar_inap
				INNER JOIN (SELECT no_rawat, MAX(CONCAT(tgl_masuk,' ',jam_masuk)) AS max_masuk FROM kamar_inap GROUP BY no_rawat) latest
					ON kamar_inap.no_rawat = latest.no_rawat AND CONCAT(kamar_inap.tgl_masuk,' ',kamar_inap.jam_masuk) = latest.max_masuk
			) ki_last ON reg_periksa.no_rawat = ki_last.no_rawat
			LEFT JOIN kamar ON ki_last.kd_kamar = kamar.kd_kamar
			LEFT JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			LEFT JOIN (
				SELECT ppr.noorder, GROUP_CONCAT(IFNULL(jpr.nm_perawatan, ppr.kd_jenis_prw) SEPARATOR ', ') AS pemeriksaan
				FROM permintaan_pemeriksaan_radiologi ppr
				LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
				GROUP BY ppr.noorder
			) prw ON pr.noorder = prw.noorder
			WHERE pr.tgl_permintaan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if rawat == "ralan" || rawat == "ranap" {
			query += " AND pr.status = ?"
			args = append(args, rawat)
		}
		if search != "" {
			query += ` AND (pr.noorder LIKE ? OR pr.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR pr.diagnosa_klinis LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY pr.tgl_permintaan DESC, pr.jam_permintaan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []permintaanRadiologiQueueRow{}
		for rows.Next() {
			var r permintaanRadiologiQueueRow
			if rows.Scan(&r.NoOrder, &r.TglPermintaan, &r.JamPermintaan, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.KdDokter, &r.NmDokter, &r.Status, &r.DiagnosisKlinis, &r.Rawat,
				&r.TglSampel, &r.JamSampel, &r.KdPj, &r.PngJawab, &r.InformasiTambahan, &r.Ruang,
				&r.TglHasil, &r.JamHasil, &r.Pemeriksaan) == nil {
				if status == "" || status == r.Status {
					list = append(list, r)
				}
			}
		}
		c.JSON(http.StatusOK, list)
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
				IFNULL(pr.diagnosa_klinis, '') as diagnosa_klinis,
				IF(pr.tgl_hasil='0000-00-00', '', DATE_FORMAT(pr.tgl_hasil, '%Y-%m-%d')) as tgl_hasil
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
			NoOrder           string                   `json:"noorder"`
			NoRawat           string                   `json:"no_rawat"`
			TglPermintaan     string                   `json:"tgl_permintaan"`
			JamPermintaan     string                   `json:"jam_permintaan"`
			KdDokter          string                   `json:"kd_dokter"`
			NmDokter          string                   `json:"nm_dokter"`
			Status            string                   `json:"status"`
			InformasiTambahan string                   `json:"informasi_tambahan"`
			DiagnosisKlinis   string                   `json:"diagnosa_klinis"`
			TglHasil          string                   `json:"tgl_hasil"`
			DetailPemeriksaan []map[string]interface{} `json:"detail_pemeriksaan"`
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
				&item.TglHasil,
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
