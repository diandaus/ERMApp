package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// list_klaim_handler.go — dipakai modul ListKlaimInacbg.tsx (Casemix > List
// Klaim): daftar kunjungan yang SUDAH punya SEP, sbg langkah awal sebelum
// pengajuan klaim INACBG (beda dari KlaimInacbg.tsx yg fokus ke rekap
// nilai klaim rawat inap). Datanya diambil dari tabel bridging_sep yang
// sudah ada (diisi lewat modul Bridging > SEP) — TIDAK ada tabel/endpoint
// input baru, cuma tampilan worklist dgn kolom padanan "List Klaim" Khanza
// Desktop, ditambah tgl_registrasi dari reg_periksa (bridging_sep sendiri
// tidak menyimpan tanggal registrasi).
//
// jnspelayanan di bridging_sep: "1" = Rawat Inap, "2" = Rawat Jalan (sama
// persis konvensi yg sudah dipakai BpjsSep.tsx/getBridgingSepList).
//
// CATATAN: kolom "Status Klaim" (checkpoint lokal + live get_claim_data per
// SEP ke E-Klaim) pernah ada di sini tapi DIHAPUS — panggilan live per baris
// bikin List Klaim jadi sangat lambat menampilkan pasien, jadi lebih baik
// tidak ada drpd ada tapi bikin worklist ini tidak nyaman dipakai.

type ListKlaimRow struct {
	NoRawat  string `json:"no_rawat"`
	NoRM     string `json:"no_rm"`
	NmPasien string `json:"nm_pasien"`
	Unit     string `json:"unit"`
	// Kamar — khusus tab Rawat Inap (kd_kamar + nm_bangsal TERBARU dari
	// kamar_inap, bukan nmpolitujuan spt Unit di tab Rawat Jalan). Selalu
	// dihitung terlepas dari `jenis` supaya query 1 bentuk saja, frontend
	// yang pilih kolom mana ditampilkan per tab.
	Kamar     string `json:"kamar"`
	NmDokter  string `json:"nm_dokter"`
	NoSep     string `json:"no_sep"`
	TglSep    string `json:"tgl_sep"`
	TglRegis  string `json:"tgl_regis"`
	TglPulang string `json:"tgl_pulang"`
}

// GET /api/casemix/list-klaim?jenis=ralan|ranap&tgl_dari=&tgl_sampai=&search=
// Default rentang tanggal (kalau tgl_dari/tgl_sampai kosong): 30 hari
// terakhir — sama seperti default getBridgingSepListFromTable, konsisten
// karena sumber datanya sama (bridging_sep).
func getListKlaim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Query("jenis")
		jnsPelayanan := "2" // default ralan
		if jenis == "ranap" {
			jnsPelayanan = "1"
		}

		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}
		search := c.Query("search")

		query := `
			SELECT
				bs.no_rawat, COALESCE(bs.nomr,''), COALESCE(bs.nama_pasien,''),
				COALESCE(bs.nmpolitujuan,''),
				COALESCE((
					SELECT CONCAT(IFNULL(k.kd_kamar,''), ' ', IFNULL(b.nm_bangsal,''))
					FROM kamar_inap ki
					LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
					LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
					WHERE ki.no_rawat = bs.no_rawat
					ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 1
				), '') AS kamar,
				COALESCE(bs.nmdpdjp,''),
				bs.no_sep, DATE_FORMAT(bs.tglsep,'%Y-%m-%d'),
				COALESCE(DATE_FORMAT(rp.tgl_registrasi,'%Y-%m-%d'),''),
				COALESCE((
					SELECT IF(ki2.tgl_keluar IS NULL OR ki2.tgl_keluar = '0000-00-00', '', DATE_FORMAT(ki2.tgl_keluar,'%Y-%m-%d'))
					FROM kamar_inap ki2
					WHERE ki2.no_rawat = bs.no_rawat
					ORDER BY ki2.tgl_masuk DESC, ki2.jam_masuk DESC LIMIT 1
				), '') AS tgl_pulang
			FROM bridging_sep bs
			LEFT JOIN reg_periksa rp ON rp.no_rawat = bs.no_rawat
			WHERE bs.jnspelayanan = ? AND bs.tglsep BETWEEN ? AND ?`
		args := []interface{}{jnsPelayanan, tglDari, tglSampai}

		if search != "" {
			query += ` AND (bs.no_rawat LIKE ? OR bs.no_sep LIKE ? OR bs.nomr LIKE ? OR bs.nama_pasien LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern)
		}
		query += ` ORDER BY bs.tglsep DESC, bs.no_sep DESC LIMIT 1000`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []ListKlaimRow{}
		for rows.Next() {
			var r ListKlaimRow
			if err := rows.Scan(&r.NoRawat, &r.NoRM, &r.NmPasien, &r.Unit, &r.Kamar, &r.NmDokter,
				&r.NoSep, &r.TglSep, &r.TglRegis, &r.TglPulang); err == nil {
				list = append(list, r)
			}
		}

		c.JSON(http.StatusOK, list)
	}
}
