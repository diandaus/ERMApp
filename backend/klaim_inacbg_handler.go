package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ensureKlaimInacbgTable membuat tabel klaim_inacbg jika belum ada.
// Tabel ini HANYA menyimpan nilai klaim INACBG yang diinput manual oleh
// petugas per no_rawat — semua data lain (pasien, dokter DPJP, biaya obat/
// lab/radiologi, billing) ditarik langsung dari tabel Khanza yang sudah ada.
func ensureKlaimInacbgTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS klaim_inacbg (
			no_rawat VARCHAR(17) NOT NULL PRIMARY KEY,
			klaim_inacbg DECIMAL(15,2) NOT NULL DEFAULT 0,
			catatan VARCHAR(255) NOT NULL DEFAULT '',
			input_oleh VARCHAR(100) NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`
	_, err := db.Exec(createTable)
	return err
}

// KlaimInacbgItem merepresentasikan satu baris rekap klaim per pasien rawat inap.
type KlaimInacbgItem struct {
	NoRawat        string  `json:"no_rawat"`
	NoRkmMedis     string  `json:"no_rkm_medis"`
	NmPasien       string  `json:"nm_pasien"`
	NmDokter       string  `json:"nm_dokter"`
	Diagnosa       string  `json:"diagnosa"`
	BiayaObat      float64 `json:"biaya_obat"`
	BiayaLab       float64 `json:"biaya_lab"`
	BiayaRadiologi float64 `json:"biaya_radiologi"`
	Billing        float64 `json:"billing"`
	Selisih        float64 `json:"selisih"`
	KlaimInacbg    float64 `json:"klaim_inacbg"`
}

// getKlaimInacbgList mengambil rekap klaim INACBG pasien rawat inap dalam
// rentang tanggal masuk tertentu. Biaya obat/lab/radiologi diagregasi dari
// tabel transaksi Khanza; nilai klaim INACBG diambil dari tabel manual
// klaim_inacbg (default 0 jika belum diinput).
func getKlaimInacbgList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		searchText := c.Query("search")

		if tglDari == "" {
			tglDari = time.Now().Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		query := `
			SELECT
				kamar_inap.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				COALESCE((
					SELECT GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', ')
					FROM dpjp_ranap dr
					INNER JOIN dokter d ON dr.kd_dokter = d.kd_dokter
					WHERE dr.no_rawat = kamar_inap.no_rawat
				), '') AS nm_dokter,
				COALESCE(
					NULLIF((SELECT rpr.diagnosa_utama FROM resume_pasien_ranap rpr WHERE rpr.no_rawat = kamar_inap.no_rawat), ''),
					kamar_inap.diagnosa_awal,
					''
				) AS diagnosa,
				COALESCE((
					SELECT SUM(dpo.total) FROM detail_pemberian_obat dpo
					WHERE dpo.no_rawat = kamar_inap.no_rawat AND dpo.status = 'Ranap'
				), 0) AS biaya_obat,
				COALESCE((
					SELECT SUM(pl.biaya) FROM periksa_lab pl
					WHERE pl.no_rawat = kamar_inap.no_rawat AND pl.status = 'Ranap'
				), 0) AS biaya_lab,
				COALESCE((
					SELECT SUM(pr.biaya) FROM periksa_radiologi pr
					WHERE pr.no_rawat = kamar_inap.no_rawat AND pr.status = 'Ranap'
				), 0) AS biaya_radiologi,
				(
					COALESCE(reg_periksa.biaya_reg, 0)
					+ COALESCE(kamar_inap.ttl_biaya, 0)
					+ COALESCE((SELECT SUM(rid.biaya_rawat) FROM rawat_inap_dr rid WHERE rid.no_rawat = kamar_inap.no_rawat), 0)
					+ COALESCE((SELECT SUM(rip.biaya_rawat) FROM rawat_inap_pr rip WHERE rip.no_rawat = kamar_inap.no_rawat), 0)
					+ COALESCE((SELECT SUM(ridp.biaya_rawat) FROM rawat_inap_drpr ridp WHERE ridp.no_rawat = kamar_inap.no_rawat), 0)
					+ COALESCE((SELECT SUM(dpo.total) FROM detail_pemberian_obat dpo WHERE dpo.no_rawat = kamar_inap.no_rawat AND dpo.status = 'Ranap'), 0)
					+ COALESCE((SELECT SUM(pl.biaya) FROM periksa_lab pl WHERE pl.no_rawat = kamar_inap.no_rawat AND pl.status = 'Ranap'), 0)
					+ COALESCE((SELECT SUM(pr.biaya) FROM periksa_radiologi pr WHERE pr.no_rawat = kamar_inap.no_rawat AND pr.status = 'Ranap'), 0)
				) AS billing,
				COALESCE(klaim_inacbg.klaim_inacbg, 0) AS klaim_inacbg
			FROM kamar_inap
			INNER JOIN reg_periksa ON kamar_inap.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN klaim_inacbg ON klaim_inacbg.no_rawat = kamar_inap.no_rawat
			WHERE kamar_inap.tgl_masuk BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}

		if searchText != "" {
			query += ` AND (
				kamar_inap.no_rawat LIKE ? OR
				reg_periksa.no_rkm_medis LIKE ? OR
				pasien.nm_pasien LIKE ? OR
				kamar_inap.diagnosa_awal LIKE ? OR
				kamar_inap.diagnosa_akhir LIKE ? OR
				EXISTS (
					SELECT 1 FROM dpjp_ranap dr2
					INNER JOIN dokter d2 ON dr2.kd_dokter = d2.kd_dokter
					WHERE dr2.no_rawat = kamar_inap.no_rawat AND d2.nm_dokter LIKE ?
				)
			)`
			pattern := "%" + searchText + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
		}

		query += " ORDER BY kamar_inap.tgl_masuk DESC, kamar_inap.jam_masuk DESC LIMIT 1000"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []KlaimInacbgItem{}
		for rows.Next() {
			var it KlaimInacbgItem
			if err := rows.Scan(
				&it.NoRawat, &it.NoRkmMedis, &it.NmPasien, &it.NmDokter, &it.Diagnosa,
				&it.BiayaObat, &it.BiayaLab, &it.BiayaRadiologi, &it.Billing, &it.KlaimInacbg,
			); err != nil {
				continue
			}
			it.Selisih = it.Billing - it.KlaimInacbg
			if it.NmDokter == "" {
				it.NmDokter = "Tanpa DPJP"
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, items)
	}
}

// SaveKlaimInacbgPayload adalah payload untuk input/update manual nilai klaim.
type SaveKlaimInacbgPayload struct {
	NoRawat     string  `json:"no_rawat" binding:"required"`
	KlaimInacbg float64 `json:"klaim_inacbg"`
	Catatan     string  `json:"catatan"`
	InputOleh   string  `json:"input_oleh"`
}

// saveKlaimInacbg menyimpan atau memperbarui nilai klaim INACBG manual
// untuk satu no_rawat (upsert berdasarkan primary key no_rawat).
func saveKlaimInacbg(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload SaveKlaimInacbgPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}

		const q = `
			INSERT INTO klaim_inacbg (no_rawat, klaim_inacbg, catatan, input_oleh)
			VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				klaim_inacbg = VALUES(klaim_inacbg),
				catatan = VALUES(catatan),
				input_oleh = VALUES(input_oleh)
		`
		if _, err := db.Exec(q, payload.NoRawat, payload.KlaimInacbg, payload.Catatan, payload.InputOleh); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Klaim INACBG berhasil disimpan", "no_rawat": payload.NoRawat})
	}
}
