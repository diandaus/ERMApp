package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// peruri_selesai_handler.go — submenu Peruri "Lihat Dokumen / Selesai":
// daftar dokumen yg SUDAH ditandatangani (tracking_dokumen_ttd.status_ttd =
// 'Sudah'). Tabel ini dipakai bersama semua modul TTE (Ringkasan Perawatan,
// Hasil Lab, Hasil Radiologi, juga Khanza Desktop), jadi semua jenis
// dokumen ikut tampil; jenisnya ditebak dari awalan nama_dokumen.
//
// Penandatangan dicocokkan dari email_ttd ke dokter.email (tracking tidak
// menyimpan kd_dokter). Tanggal yg difilter = tgl_kirim (tanggal signing
// tidak disimpan terpisah; kirim & tanda tangan normalnya di waktu yg sama).
//
// tracking_dokumen_ttd TIDAK ada di DB dev → dibalas data kosong +
// tte_tersedia=false (sama dgn Perlu Diproses).

type peruriSelesaiRow struct {
	NoRawat      string `json:"no_rawat"`
	NamaDokumen  string `json:"nama_dokumen"`
	JenisDokumen string `json:"jenis_dokumen"`
	TglKirim     string `json:"tgl_kirim"`
	OrderID      string `json:"order_id"`
	EmailTtd     string `json:"email_ttd"`
	UserPengirim string `json:"user_pengirim"`
	NoRkmMedis   string `json:"no_rkm_medis"`
	NmPasien     string `json:"nm_pasien"`
	StatusLanjut string `json:"status_lanjut"`
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	PngJawab     string `json:"png_jawab"`
}

// jenisDokumenSQL — HARUS sinkron dgn awalan nama dokumen di frontend:
// Ringkasan_Perawatan_ (peruriTteRingkasan.ts), Hasil_Lab_
// (ModalHasilLabPK.tsx), Radiologi_ (ModalHasilRadiologi.tsx).
const jenisDokumenSQL = `CASE
	WHEN t.nama_dokumen LIKE 'Ringkasan\_Perawatan\_%' THEN 'Ringkasan Perawatan'
	WHEN t.nama_dokumen LIKE 'Hasil\_Lab\_%' THEN 'Hasil Lab'
	WHEN t.nama_dokumen LIKE 'Radiologi\_%' THEN 'Hasil Radiologi'
	ELSE 'Lainnya' END`

// GET /api/peruri/selesai?tgl_awal=YYYY-MM-DD&tgl_akhir=YYYY-MM-DD
//
//	&jenis=Semua|Ralan|Ranap&kd_dokter=...&kd_pj=...&jenis_dokumen=...&search=...
func getPeruriSelesai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglAwal := c.Query("tgl_awal")
		tglAkhir := c.Query("tgl_akhir")
		if _, err := time.Parse("2006-01-02", tglAwal); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_awal tidak valid (format YYYY-MM-DD)"})
			return
		}
		if _, err := time.Parse("2006-01-02", tglAkhir); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl_akhir tidak valid (format YYYY-MM-DD)"})
			return
		}
		if !trackingDokumenTtdExists(db) {
			c.JSON(http.StatusOK, gin.H{"data": []peruriSelesaiRow{}, "tte_tersedia": false})
			return
		}

		// Dokter penandatangan: email_ttd → dokter.email. Subquery LIMIT 1
		// supaya 1 dokumen tidak dobel kalau ada >1 data dokter dgn email sama.
		kdDokterSQL := `(SELECT d.kd_dokter FROM dokter d WHERE d.email = t.email_ttd AND t.email_ttd <> '' ORDER BY d.status DESC, d.kd_dokter LIMIT 1)`
		query := `
			SELECT x.* FROM (
				SELECT t.no_rawat, IFNULL(t.nama_dokumen, '') AS nama_dokumen, ` + jenisDokumenSQL + ` AS jenis_dokumen,
					IFNULL(DATE_FORMAT(t.tgl_kirim, '%Y-%m-%d %H:%i:%s'), '') AS tgl_kirim,
					IFNULL(t.order_id, '') AS order_id, IFNULL(t.email_ttd, '') AS email_ttd,
					IFNULL(t.user_pengirim, '') AS user_pengirim,
					IFNULL(r.no_rkm_medis, '') AS no_rkm_medis, IFNULL(p.nm_pasien, '') AS nm_pasien,
					IFNULL(r.status_lanjut, '') AS status_lanjut,
					IFNULL(r.kd_pj, '') AS kd_pj, IFNULL(pj.png_jawab, '') AS png_jawab,
					IFNULL(` + kdDokterSQL + `, '') AS kd_dokter
				FROM tracking_dokumen_ttd t
				LEFT JOIN reg_periksa r ON r.no_rawat = t.no_rawat
				LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
				LEFT JOIN penjab pj ON pj.kd_pj = r.kd_pj
				WHERE t.status_ttd = 'Sudah' AND t.tgl_kirim >= ? AND t.tgl_kirim < DATE_ADD(?, INTERVAL 1 DAY)
			) x`
		args := []interface{}{tglAwal, tglAkhir}

		where := []string{}
		if jenis := c.DefaultQuery("jenis", "Semua"); jenis == "Ralan" || jenis == "Ranap" {
			where = append(where, `x.status_lanjut = ?`)
			args = append(args, jenis)
		}
		if kd := strings.TrimSpace(c.Query("kd_dokter")); kd != "" {
			where = append(where, `x.kd_dokter = ?`)
			args = append(args, kd)
		}
		if kdPj := strings.TrimSpace(c.Query("kd_pj")); kdPj != "" {
			where = append(where, `x.kd_pj = ?`)
			args = append(args, kdPj)
		}
		if jd := strings.TrimSpace(c.Query("jenis_dokumen")); jd != "" && jd != "Semua" {
			where = append(where, `x.jenis_dokumen = ?`)
			args = append(args, jd)
		}
		if search := strings.TrimSpace(c.Query("search")); search != "" {
			like := "%" + search + "%"
			where = append(where, `(x.no_rawat LIKE ? OR x.no_rkm_medis LIKE ? OR x.nm_pasien LIKE ? OR x.nama_dokumen LIKE ?)`)
			args = append(args, like, like, like, like)
		}
		if len(where) > 0 {
			query += ` WHERE ` + strings.Join(where, ` AND `)
		}
		query = `SELECT y.no_rawat, y.nama_dokumen, y.jenis_dokumen, y.tgl_kirim, y.order_id, y.email_ttd, y.user_pengirim,
				y.no_rkm_medis, y.nm_pasien, y.status_lanjut, y.kd_dokter, IFNULL(d.nm_dokter, ''), y.png_jawab
			FROM (` + query + `) y LEFT JOIN dokter d ON d.kd_dokter = y.kd_dokter
			ORDER BY IFNULL(d.nm_dokter, y.email_ttd), y.tgl_kirim DESC LIMIT 5000`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data: " + err.Error()})
			return
		}
		defer rows.Close()

		data := []peruriSelesaiRow{}
		for rows.Next() {
			var r peruriSelesaiRow
			if err := rows.Scan(&r.NoRawat, &r.NamaDokumen, &r.JenisDokumen, &r.TglKirim, &r.OrderID, &r.EmailTtd,
				&r.UserPengirim, &r.NoRkmMedis, &r.NmPasien, &r.StatusLanjut, &r.KdDokter, &r.NmDokter, &r.PngJawab); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
				return
			}
			data = append(data, r)
		}
		c.JSON(http.StatusOK, gin.H{"data": data, "tte_tersedia": true})
	}
}
