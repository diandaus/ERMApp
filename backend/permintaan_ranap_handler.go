package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RANAP — padanan permintaan/DlgPermintaanRanap.java (Khanza):
// booking kamar rawat inap SEBELUM pasien benar-benar dipindah ke
// kamar_inap (masuk kamar). Simpan ke `permintaan_ranap` (5 kolom
// positional persis Sequel.menyimpantf di Java: no_rawat, tanggal,
// kd_kamar, diagnosa, catatan — TIDAK BOLEH ditambah kolom apa pun),
// lalu tandai kamar.status='DIBOOKING' (bukan langsung 'ISI', krn
// pasien belum benar-benar masuk kamar — itu terjadi di alur Kamar
// Inap terpisah).
// ============================================================================

type PermintaanRanapPasienInfo struct {
	NoRawat    string `json:"no_rawat"`
	NoRKMMedis string `json:"no_rkm_medis"`
	NamaPasien string `json:"nama_pasien"`
	JK         string `json:"jk"`
	Umur       string `json:"umur"`
	NoTelp     string `json:"no_telp"`
	CaraBayar  string `json:"cara_bayar"`
	Poli       string `json:"poli"`
	KdDokter   string `json:"kd_dokter"`
	Dokter     string `json:"dokter"`
}

// GET /api/permintaan-ranap/pasien/:no_rawat — data ringkas pasien +
// registrasi utk pre-fill form (padanan getData()/setNoRm() di Java,
// dipanggil dari tombol "Permintaan Ranap" pada baris pasien terpilih).
func getPermintaanRanapPasienInfo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		var r PermintaanRanapPasienInfo
		err := db.QueryRow(`
			SELECT reg_periksa.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, pasien.jk,
				CONCAT(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur), COALESCE(pasien.no_tlp,''),
				penjab.png_jawab, poliklinik.nm_poli, reg_periksa.kd_dokter, dokter.nm_dokter
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(
			&r.NoRawat, &r.NoRKMMedis, &r.NamaPasien, &r.JK, &r.Umur, &r.NoTelp,
			&r.CaraBayar, &r.Poli, &r.KdDokter, &r.Dokter,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Data registrasi pasien tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, r)
	}
}

type KamarOption struct {
	KdKamar   string  `json:"kd_kamar"`
	KdBangsal string  `json:"kd_bangsal"`
	NmBangsal string  `json:"nm_bangsal"`
	Kelas     string  `json:"kelas"`
	TrfKamar  float64 `json:"trf_kamar"`
	Status    string  `json:"status"`
}

// GET /api/kamar/list?search=&status= — padanan tampil() DlgKamar.java
// (dibuka dari btnKamarActionPerformed), dipakai picker kamar di
// ModalPermintaanRanap.tsx. `status` kosong = semua status (padanan
// pilihan "Semua" di combo Java), diisi mis. "KOSONG" utk filter kamar
// yg benar-benar tersedia.
func getKamarList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		status := strings.TrimSpace(c.Query("status"))

		query := `
			SELECT kamar.kd_kamar, kamar.kd_bangsal, bangsal.nm_bangsal, kamar.kelas, COALESCE(kamar.trf_kamar,0), kamar.status
			FROM kamar
			INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			WHERE kamar.statusdata = '1'`
		args := []interface{}{}
		if status != "" {
			query += " AND kamar.status = ?"
			args = append(args, status)
		}
		if search != "" {
			query += ` AND (kamar.kd_kamar LIKE ? OR kamar.kd_bangsal LIKE ? OR bangsal.nm_bangsal LIKE ? OR kamar.kelas LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like, like, like)
		}
		query += " ORDER BY bangsal.nm_bangsal, kamar.kd_kamar"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []KamarOption{}
		for rows.Next() {
			var k KamarOption
			if err := rows.Scan(&k.KdKamar, &k.KdBangsal, &k.NmBangsal, &k.Kelas, &k.TrfKamar, &k.Status); err == nil {
				list = append(list, k)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type PermintaanRanapRow struct {
	NoRawat    string  `json:"no_rawat"`
	NoRKMMedis string  `json:"no_rkm_medis"`
	NamaPasien string  `json:"nama_pasien"`
	JK         string  `json:"jk"`
	Umur       string  `json:"umur"`
	NoTelp     string  `json:"no_telp"`
	CaraBayar  string  `json:"cara_bayar"`
	Poli       string  `json:"poli"`
	Dokter     string  `json:"dokter"`
	Tanggal    string  `json:"tanggal"`
	KdKamar    string  `json:"kd_kamar"`
	KdBangsal  string  `json:"kd_bangsal"`
	NmBangsal  string  `json:"nm_bangsal"`
	TrfKamar   float64 `json:"trf_kamar"`
	Diagnosa   string  `json:"diagnosa"`
	Catatan    string  `json:"catatan"`
	KdDokter   string  `json:"kd_dokter"`
}

// GET /api/permintaan-ranap/list?filter=menunggu|sudah-masuk&tanggal_awal=&tanggal_akhir=&search=
//
// Padanan persis tampil() DlgPermintaanRanap.java:
//   - menunggu    (R1): permintaan_ranap yg no_rawat-nya BELUM ada di kamar_inap
//   - sudah-masuk (R2): permintaan_ranap yg no_rawat-nya SUDAH ada di kamar_inap,
//     DAN tanggal booking-nya (permintaan_ranap.tanggal, bukan tgl_masuk
//     kamar_inap) di dalam rentang tanggal_awal..tanggal_akhir — sama persis
//     kondisi Java, WAJIB isi rentang tanggal utk filter ini.
func getPermintaanRanapList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		filter := strings.TrimSpace(c.Query("filter"))
		tglAwal := strings.TrimSpace(c.Query("tanggal_awal"))
		tglAkhir := strings.TrimSpace(c.Query("tanggal_akhir"))
		search := strings.TrimSpace(c.Query("search"))

		var whereStatus string
		switch filter {
		case "menunggu":
			whereStatus = "permintaan_ranap.no_rawat NOT IN (SELECT DISTINCT kamar_inap.no_rawat FROM kamar_inap)"
		case "sudah-masuk":
			if tglAwal == "" || tglAkhir == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Rentang tanggal wajib diisi"})
				return
			}
			whereStatus = "permintaan_ranap.no_rawat IN (SELECT DISTINCT kamar_inap.no_rawat FROM kamar_inap) AND permintaan_ranap.tanggal BETWEEN ? AND ?"
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Filter tidak valid"})
			return
		}

		query := `
			SELECT permintaan_ranap.no_rawat, reg_periksa.no_rkm_medis, pasien.nm_pasien, pasien.jk,
				CONCAT(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur), COALESCE(pasien.no_tlp,''),
				penjab.png_jawab, poliklinik.nm_poli, dokter.nm_dokter,
				DATE_FORMAT(permintaan_ranap.tanggal,'%Y-%m-%d'), permintaan_ranap.kd_kamar, kamar.kd_bangsal,
				bangsal.nm_bangsal, COALESCE(kamar.trf_kamar,0), COALESCE(permintaan_ranap.diagnosa,''),
				COALESCE(permintaan_ranap.catatan,''), reg_periksa.kd_dokter
			FROM permintaan_ranap
			INNER JOIN reg_periksa ON permintaan_ranap.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			INNER JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN kamar ON permintaan_ranap.kd_kamar = kamar.kd_kamar
			INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			WHERE ` + whereStatus

		args := []interface{}{}
		if filter == "sudah-masuk" {
			args = append(args, tglAwal, tglAkhir)
		}
		if search != "" {
			query += ` AND (permintaan_ranap.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ?
				OR penjab.png_jawab LIKE ? OR poliklinik.nm_poli LIKE ? OR dokter.nm_dokter LIKE ?
				OR bangsal.nm_bangsal LIKE ? OR permintaan_ranap.diagnosa LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like, like, like, like, like, like, like)
		}
		query += " ORDER BY permintaan_ranap.tanggal"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []PermintaanRanapRow{}
		for rows.Next() {
			var r PermintaanRanapRow
			if err := rows.Scan(
				&r.NoRawat, &r.NoRKMMedis, &r.NamaPasien, &r.JK, &r.Umur, &r.NoTelp,
				&r.CaraBayar, &r.Poli, &r.Dokter,
				&r.Tanggal, &r.KdKamar, &r.KdBangsal, &r.NmBangsal, &r.TrfKamar, &r.Diagnosa,
				&r.Catatan, &r.KdDokter,
			); err != nil {
				continue
			}
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "count": len(list)})
	}
}

type PermintaanRanapPayload struct {
	NoRawat  string `json:"no_rawat" binding:"required"`
	Tanggal  string `json:"tanggal" binding:"required"`
	KdKamar  string `json:"kd_kamar" binding:"required"`
	Diagnosa string `json:"diagnosa" binding:"required"`
	Catatan  string `json:"catatan"`
}

// POST /api/permintaan-ranap — padanan BtnSimpanActionPerformed
// DlgPermintaanRanap.java.
func createPermintaanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PermintaanRanapPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(
			`INSERT INTO permintaan_ranap (no_rawat, tanggal, kd_kamar, diagnosa, catatan) VALUES (?,?,?,?,?)`,
			p.NoRawat, p.Tanggal, p.KdKamar, p.Diagnosa, p.Catatan,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`UPDATE kamar SET status='DIBOOKING' WHERE kd_kamar=?`, p.KdKamar); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Permintaan rawat inap berhasil disimpan"})
	}
}
