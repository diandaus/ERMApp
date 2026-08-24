package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// TINDAKAN RAWAT INAP ENDPOINT
// ============================================================================

// TindakanRanapDokter represents tindakan rawat inap by doctor
type TindakanRanapDokter struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	JamRawat     string  `json:"jam_rawat"`
	KdJenisPrw   string  `json:"kd_jenis_prw"`
	NmPerawatan  string  `json:"nm_perawatan"`
	KdDokter     string  `json:"kd_dokter"`
	NmDokter     string  `json:"nm_dokter"`
	BiayaRawat   float64 `json:"biaya_rawat"`
}

// TindakanRanapParamedis represents tindakan rawat inap by paramedis
type TindakanRanapParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	Nip           string  `json:"nip"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRanapDokterParamedis represents tindakan rawat inap by doctor and paramedis
type TindakanRanapDokterParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	KdDokter      string  `json:"kd_dokter"`
	NmDokter      string  `json:"nm_dokter"`
	Nip           string  `json:"nip"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRanapResponse represents the complete tindakan rawat inap data response
type TindakanRanapResponse struct {
	TindakanDokter          []TindakanRanapDokter          `json:"tindakan_dokter"`
	TindakanParamedis       []TindakanRanapParamedis       `json:"tindakan_paramedis"`
	TindakanDokterParamedis []TindakanRanapDokterParamedis `json:"tindakan_dokter_paramedis"`
}

// getTindakanRanap returns tindakan rawat inap data for a given no_rawat
func getTindakanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := TindakanRanapResponse{
			TindakanDokter:          []TindakanRanapDokter{},
			TindakanParamedis:       []TindakanRanapParamedis{},
			TindakanDokterParamedis: []TindakanRanapDokterParamedis{},
		}

		// ====================================================================
		// 1. GET TINDAKAN RAWAT INAP DOKTER
		// ====================================================================
	queryDokter := `
		SELECT
			DATE_FORMAT(rawat_inap_dr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_dr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_dr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				rawat_inap_dr.kd_dokter,
				dokter.nm_dokter,
				rawat_inap_dr.biaya_rawat
			FROM rawat_inap_dr
			INNER JOIN jns_perawatan_inap ON rawat_inap_dr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN dokter ON rawat_inap_dr.kd_dokter = dokter.kd_dokter
			WHERE rawat_inap_dr.no_rawat = ?
			ORDER BY rawat_inap_dr.tgl_perawatan, rawat_inap_dr.jam_rawat
		`

		rowsDokter, err := db.Query(queryDokter, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap dokter:", err)
		} else {
			defer rowsDokter.Close()

			for rowsDokter.Next() {
				var item TindakanRanapDokter
				if err := rowsDokter.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.KdDokter,
					&item.NmDokter,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap dokter:", err)
					continue
				}
				response.TindakanDokter = append(response.TindakanDokter, item)
			}
		}

		// ====================================================================
		// 2. GET TINDAKAN RAWAT INAP PARAMEDIS
		// ====================================================================
	queryParamedis := `
		SELECT
			DATE_FORMAT(rawat_inap_pr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_pr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_pr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				rawat_inap_pr.nip,
				petugas.nama,
				rawat_inap_pr.biaya_rawat
			FROM rawat_inap_pr
			INNER JOIN jns_perawatan_inap ON rawat_inap_pr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN petugas ON rawat_inap_pr.nip = petugas.nip
			WHERE rawat_inap_pr.no_rawat = ?
			ORDER BY rawat_inap_pr.tgl_perawatan, rawat_inap_pr.jam_rawat
		`

		rowsParamedis, err := db.Query(queryParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap paramedis:", err)
		} else {
			defer rowsParamedis.Close()

			for rowsParamedis.Next() {
				var item TindakanRanapParamedis
				if err := rowsParamedis.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.Nip,
					&item.NamaParamedis,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap paramedis:", err)
					continue
				}
				response.TindakanParamedis = append(response.TindakanParamedis, item)
			}
		}

		// ====================================================================
		// 3. GET TINDAKAN RAWAT INAP DOKTER & PARAMEDIS
		// ====================================================================
	queryDokterParamedis := `
		SELECT
			DATE_FORMAT(rawat_inap_drpr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_drpr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_drpr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				rawat_inap_drpr.kd_dokter,
				dokter.nm_dokter,
				rawat_inap_drpr.nip,
				petugas.nama,
				rawat_inap_drpr.biaya_rawat
			FROM rawat_inap_drpr
			INNER JOIN jns_perawatan_inap ON rawat_inap_drpr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN dokter ON rawat_inap_drpr.kd_dokter = dokter.kd_dokter
			INNER JOIN petugas ON rawat_inap_drpr.nip = petugas.nip
			WHERE rawat_inap_drpr.no_rawat = ?
			ORDER BY rawat_inap_drpr.tgl_perawatan, rawat_inap_drpr.jam_rawat
		`

		rowsDokterParamedis, err := db.Query(queryDokterParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap dokter paramedis:", err)
		} else {
			defer rowsDokterParamedis.Close()

			for rowsDokterParamedis.Next() {
				var item TindakanRanapDokterParamedis
				if err := rowsDokterParamedis.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.KdDokter,
					&item.NmDokter,
					&item.Nip,
					&item.NamaParamedis,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap dokter paramedis:", err)
					continue
				}
				response.TindakanDokterParamedis = append(response.TindakanDokterParamedis, item)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetJenisTindakanRanap — padanan GetJenisTindakan (tindakan_handler.go) tapi
// query jns_perawatan_inap (tarif rawat inap, skema beda dari jns_perawatan:
// discope per kd_pj + kd_bangsal + kelas, bukan per kd_pj + kd_poli). Cuma
// butuh no_rawat dari frontend — kd_pj/kd_bangsal/kelas pasien dicari
// sendiri di sini (kamar_inap AKTIF terbaru, padanan getInfoRawatRadiologi
// di rad_handler.go), supaya frontend tidak perlu fetch info-rawat terpisah
// dulu sebelum bisa cari jenis tindakan.
func GetJenisTindakanRanap(c *gin.Context, db *sql.DB) {
	noRawat := c.Query("no_rawat")
	search := c.Query("search")

	var kdPj, kdBangsal, kelas string
	if noRawat != "" {
		db.QueryRow(`SELECT IFNULL(kd_pj,'') FROM reg_periksa WHERE no_rawat=? LIMIT 1`, noRawat).Scan(&kdPj)
		db.QueryRow(`
			SELECT kamar.kd_bangsal, kamar.kelas
			FROM kamar_inap
			INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
			WHERE kamar_inap.no_rawat = ? AND kamar_inap.stts_pulang = '-'
			ORDER BY STR_TO_DATE(CONCAT(kamar_inap.tgl_masuk,' ',kamar_inap.jam_masuk),'%Y-%m-%d %H:%i:%s') DESC
			LIMIT 1
		`, noRawat).Scan(&kdBangsal, &kelas)
	}

	// Saklar Set Penggunaan Tarif (set_tarif.cara_bayar_ranap/ruang_ranap/
	// kelas_ranap) — sama pola dgn GetJenisTindakan (kd_pj/kd_poli ralan).
	// Default "Yes" utk semua saklar kalau baris set_tarif belum ada.
	caraBayarAktif, ruangAktif, kelasAktif := "Yes", "Yes", "Yes"
	db.QueryRow(`SELECT cara_bayar_ranap, ruang_ranap, kelas_ranap FROM set_tarif LIMIT 1`).
		Scan(&caraBayarAktif, &ruangAktif, &kelasAktif)

	query := `
		SELECT
			jns_perawatan_inap.kd_jenis_prw,
			jns_perawatan_inap.nm_perawatan,
			kategori_perawatan.nm_kategori,
			jns_perawatan_inap.total_byrdr,
			jns_perawatan_inap.material,
			jns_perawatan_inap.bhp,
			jns_perawatan_inap.tarif_tindakandr,
			jns_perawatan_inap.tarif_tindakanpr,
			jns_perawatan_inap.kso,
			jns_perawatan_inap.menejemen
		FROM jns_perawatan_inap
		INNER JOIN kategori_perawatan ON jns_perawatan_inap.kd_kategori = kategori_perawatan.kd_kategori
		WHERE jns_perawatan_inap.total_byrdr > 0
			AND jns_perawatan_inap.status = '1'
	`

	args := []interface{}{}

	if caraBayarAktif == "Yes" && kdPj != "" {
		query += " AND (jns_perawatan_inap.kd_pj = ? OR jns_perawatan_inap.kd_pj = '-')"
		args = append(args, kdPj)
	}
	if ruangAktif == "Yes" && kdBangsal != "" {
		query += " AND (jns_perawatan_inap.kd_bangsal = ? OR jns_perawatan_inap.kd_bangsal = '-')"
		args = append(args, kdBangsal)
	}
	if kelasAktif == "Yes" && kelas != "" {
		query += " AND (jns_perawatan_inap.kelas = ? OR jns_perawatan_inap.kelas = '-')"
		args = append(args, kelas)
	}

	if search != "" {
		query += " AND (jns_perawatan_inap.kd_jenis_prw LIKE ? OR jns_perawatan_inap.nm_perawatan LIKE ? OR kategori_perawatan.nm_kategori LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY jns_perawatan_inap.nm_perawatan LIMIT 50"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Error querying jenis tindakan ranap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jenis tindakan"})
		return
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		var kdJenisPrw, nmPerawatan, nmKategori string
		var totalDr, material, bhp, tarifDr, tarifPr, kso, menejemen float64

		if err := rows.Scan(
			&kdJenisPrw, &nmPerawatan, &nmKategori,
			&totalDr, &material, &bhp, &tarifDr, &tarifPr, &kso, &menejemen,
		); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		result = append(result, map[string]interface{}{
			"kd_jenis_prw":     kdJenisPrw,
			"nm_perawatan":     nmPerawatan,
			"nm_kategori":      nmKategori,
			"total_byrdr":      totalDr,
			"material":         material,
			"bhp":              bhp,
			"tarif_tindakandr": tarifDr,
			"tarif_tindakanpr": tarifPr,
			"kso":              kso,
			"menejemen":        menejemen,
		})
	}

	c.JSON(http.StatusOK, result)
}

// SimpanTindakanRanap — padanan SimpanTindakan (tindakan_handler.go) tapi
// insert ke rawat_inap_dr (skema kolom identik dgn rawat_jl_dr, cuma beda
// nama tabel — konsekuensi Khanza memisahkan tabel ralan/ranap meski
// strukturnya sama).
func SimpanTindakanRanap(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		KdDokter        string  `json:"kd_dokter"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanDr float64 `json:"tarif_tindakandr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.KdDokter == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, dan Kode Dokter wajib diisi"})
		return
	}

	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	_, err := db.Exec(`
		INSERT INTO rawat_inap_dr (
			no_rawat, kd_jenis_prw, kd_dokter,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakandr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		payload.NoRawat, payload.KdJenisPrw, payload.KdDokter,
		payload.TglPerawatan, payload.JamRawat,
		payload.Material, payload.BHP, payload.TarifTindakanDr, payload.KSO, payload.Menejemen, payload.BiayaRawat,
	)
	if err != nil {
		log.Printf("Error inserting tindakan ranap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// SimpanTindakanRanapPetugas — padanan SimpanTindakanPetugas, insert ke
// rawat_inap_pr (PK majemuk no_rawat+kd_jenis_prw+nip+tgl+jam).
func SimpanTindakanRanapPetugas(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		Nip             string  `json:"nip"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanPr float64 `json:"tarif_tindakanpr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.Nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, dan Petugas wajib diisi"})
		return
	}

	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	_, err := db.Exec(`
		INSERT INTO rawat_inap_pr (
			no_rawat, kd_jenis_prw, nip,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakanpr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		payload.NoRawat, payload.KdJenisPrw, payload.Nip,
		payload.TglPerawatan, payload.JamRawat,
		payload.Material, payload.BHP, payload.TarifTindakanPr, payload.KSO, payload.Menejemen, payload.BiayaRawat,
	)
	if err != nil {
		log.Printf("Error inserting tindakan ranap petugas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// SimpanTindakanRanapDrPr — padanan SimpanTindakanDrPr, insert ke
// rawat_inap_drpr (PK majemuk no_rawat+kd_jenis_prw+kd_dokter+nip+tgl+jam).
func SimpanTindakanRanapDrPr(c *gin.Context, db *sql.DB) {
	var payload struct {
		NoRawat         string  `json:"no_rawat"`
		KdJenisPrw      string  `json:"kd_jenis_prw"`
		KdDokter        string  `json:"kd_dokter"`
		Nip             string  `json:"nip"`
		TglPerawatan    string  `json:"tgl_perawatan"`
		JamRawat        string  `json:"jam_rawat"`
		Material        float64 `json:"material"`
		BHP             float64 `json:"bhp"`
		TarifTindakanDr float64 `json:"tarif_tindakandr"`
		TarifTindakanPr float64 `json:"tarif_tindakanpr"`
		KSO             float64 `json:"kso"`
		Menejemen       float64 `json:"menejemen"`
		BiayaRawat      float64 `json:"biaya_rawat"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
		return
	}

	if payload.NoRawat == "" || payload.KdJenisPrw == "" || payload.KdDokter == "" || payload.Nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Rawat, Kode Jenis Perawatan, Dokter, dan Petugas wajib diisi"})
		return
	}

	if payload.TglPerawatan == "" {
		payload.TglPerawatan = time.Now().Format("2006-01-02")
	}
	if payload.JamRawat == "" {
		payload.JamRawat = time.Now().Format("15:04:05")
	}

	_, err := db.Exec(`
		INSERT INTO rawat_inap_drpr (
			no_rawat, kd_jenis_prw, kd_dokter, nip,
			tgl_perawatan, jam_rawat,
			material, bhp, tarif_tindakandr, tarif_tindakanpr, kso, menejemen, biaya_rawat
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		payload.NoRawat, payload.KdJenisPrw, payload.KdDokter, payload.Nip,
		payload.TglPerawatan, payload.JamRawat,
		payload.Material, payload.BHP, payload.TarifTindakanDr, payload.TarifTindakanPr, payload.KSO, payload.Menejemen, payload.BiayaRawat,
	)
	if err != nil {
		log.Printf("Error inserting tindakan ranap dr+pr: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tindakan berhasil disimpan",
		"data": map[string]interface{}{
			"no_rawat":      payload.NoRawat,
			"kd_jenis_prw":  payload.KdJenisPrw,
			"tgl_perawatan": payload.TglPerawatan,
			"jam_rawat":     payload.JamRawat,
		},
	})
}

// DeleteTindakanRanap — padanan DeleteTindakan, hapus dari rawat_inap_dr.
func DeleteTindakanRanap(c *gin.Context, db *sql.DB) {
	noRawat := c.Query("no_rawat")
	kdJenisPrw := c.Query("kd_jenis_prw")
	tglPerawatan := c.Query("tgl_perawatan")
	jamRawat := c.Query("jam_rawat")
	kdDokter := c.Query("kd_dokter")

	if noRawat == "" || kdJenisPrw == "" || tglPerawatan == "" || jamRawat == "" || kdDokter == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter tidak lengkap"})
		return
	}

	result, err := db.Exec(`
		DELETE FROM rawat_inap_dr
		WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_perawatan = ? AND jam_rawat = ? AND kd_dokter = ?
	`, noRawat, kdJenisPrw, tglPerawatan, jamRawat, kdDokter)
	if err != nil {
		log.Printf("Error deleting tindakan ranap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tindakan"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus"})
}

// DeleteTindakanRanapPetugas — padanan DeleteTindakanPetugas, hapus dari
// rawat_inap_pr.
func DeleteTindakanRanapPetugas(c *gin.Context, db *sql.DB) {
	noRawat := c.Query("no_rawat")
	kdJenisPrw := c.Query("kd_jenis_prw")
	tglPerawatan := c.Query("tgl_perawatan")
	jamRawat := c.Query("jam_rawat")
	nip := c.Query("nip")

	if noRawat == "" || kdJenisPrw == "" || tglPerawatan == "" || jamRawat == "" || nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter tidak lengkap"})
		return
	}

	result, err := db.Exec(`
		DELETE FROM rawat_inap_pr
		WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_perawatan = ? AND jam_rawat = ? AND nip = ?
	`, noRawat, kdJenisPrw, tglPerawatan, jamRawat, nip)
	if err != nil {
		log.Printf("Error deleting tindakan ranap petugas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tindakan"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus"})
}

// DeleteTindakanRanapDokterPetugas — padanan DeleteTindakanDokterPetugas,
// hapus dari rawat_inap_drpr.
func DeleteTindakanRanapDokterPetugas(c *gin.Context, db *sql.DB) {
	noRawat := c.Query("no_rawat")
	kdJenisPrw := c.Query("kd_jenis_prw")
	tglPerawatan := c.Query("tgl_perawatan")
	jamRawat := c.Query("jam_rawat")
	kdDokter := c.Query("kd_dokter")
	nip := c.Query("nip")

	if noRawat == "" || kdJenisPrw == "" || tglPerawatan == "" || jamRawat == "" || kdDokter == "" || nip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter tidak lengkap"})
		return
	}

	result, err := db.Exec(`
		DELETE FROM rawat_inap_drpr
		WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_perawatan = ? AND jam_rawat = ? AND kd_dokter = ? AND nip = ?
	`, noRawat, kdJenisPrw, tglPerawatan, jamRawat, kdDokter, nip)
	if err != nil {
		log.Printf("Error deleting tindakan ranap dokter petugas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tindakan"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus"})
}

