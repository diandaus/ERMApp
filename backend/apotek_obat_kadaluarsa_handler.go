package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Obat Kadaluarsa (tab utama modul Apotek). TIDAK ADA padanan di
// Khanza Desktop (bukan hasil porting dialog Java manapun) — fitur baru,
// istilah umum farmasi ("ED"/Expired Date). Laporan READ-ONLY, sama pola
// dengan Darurat Stok (tanpa Simpan/Hapus, murni monitoring).
//
// **Sumber data: `databarang.expire`** (kolom per-ITEM, satu tanggal per
// kode_brng), BUKAN `detailbeli.kadaluarsa` (kolom per BATCH pembelian,
// diisi form Penerimaan) — sengaja dipilih setelah audit data riil:
// `databarang.expire` terisi 728/2013 baris (36%, dipelihara aktif RS ini
// selama bertahun-tahun, rentang 2015-2026), sedangkan `detailbeli.kadaluarsa`
// nyaris kosong. Ini konsisten dengan penyederhanaan project-wide "tanpa
// pelacakan batch" (`no_batch` selalu '' di semua modul lain) — satu
// tanggal ED per item adalah representasi yang realistis dipakai RS ini,
// bukan per-batch presisi yang memang tidak pernah dilacak di web app ini.
//
// **Filter `stok_saat_ini > 0` WAJIB** (tidak bisa dimatikan) — beda dari
// Darurat Stok yang menampilkan stok=0 juga. Alasan: expire di sini
// merepresentasikan batch TERAKHIR yang pernah diterima; begitu stok
// habis, tanggal itu jadi tidak relevan lagi (order berikutnya akan punya
// ED baru) — menampilkannya cuma bikin noise di laporan yang harusnya
// actionable (barang yang MASIH ada di rak dan perlu ditindaklanjuti).
//
// **Kategori** dihitung dari `DATEDIFF(expire, CURDATE())`:
//   - Sudah Kadaluarsa: hari_tersisa < 0
//   - Akan Kadaluarsa: 0 <= hari_tersisa <= parameter `hari` (default 90)
// Barang dengan hari_tersisa > `hari` tidak ikut ditampilkan.
// ============================================================================

type obatKadaluarsaRow struct {
	KodeBrng    string  `json:"kode_brng"`
	NamaBrng    string  `json:"nama_brng"`
	Satuan      string  `json:"satuan"`
	Jenis       string  `json:"jenis"`
	Expire      string  `json:"expire"`
	HariTersisa int     `json:"hari_tersisa"`
	StokSaatIni float64 `json:"stok_saat_ini"`
}

func getObatKadaluarsa(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		hari, err := strconv.Atoi(strings.TrimSpace(c.Query("hari")))
		if err != nil || hari <= 0 {
			hari = 90
		}

		query := `
			SELECT b.kode_brng, b.nama_brng, COALESCE(s.satuan,''), COALESCE(j.nama,''),
				b.expire, DATEDIFF(b.expire, CURDATE()) AS hari_tersisa,
				COALESCE((
					SELECT SUM(g.stok) FROM gudangbarang g
					INNER JOIN bangsal bg ON bg.kd_bangsal = g.kd_bangsal
					WHERE bg.status='1' AND g.no_batch='' AND g.no_faktur='' AND g.kode_brng = b.kode_brng
				), 0) AS stok_saat_ini
			FROM databarang b
			INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
			INNER JOIN jenis j ON b.kdjns = j.kdjns
			WHERE b.status = '1' AND b.expire IS NOT NULL AND b.expire <> '0000-00-00'
				AND DATEDIFF(b.expire, CURDATE()) <= ?
		`
		args := []interface{}{hari}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR j.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " HAVING stok_saat_ini > 0 ORDER BY b.expire ASC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []obatKadaluarsaRow{}
		for rows.Next() {
			var r obatKadaluarsaRow
			if rows.Scan(&r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.Jenis, &r.Expire, &r.HariTersisa, &r.StokSaatIni) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}
