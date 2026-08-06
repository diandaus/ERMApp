package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Darurat Stok (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgDaruratStok.java — laporan READ-ONLY murni
// (tidak ada tombol Simpan/Hapus sama sekali di Java, cuma Cari/Cetak,
// sama pola dengan DlgRiwayatBarangMedis.java) yang menampilkan barang
// yang stok live-nya SUDAH TURUN ke titik/di bawah `databarang.stokminimal`
// — daftar "perlu segera dipesan ulang".
//
// **Replikasi query Java persis** (prosesCari() di DlgDaruratStok.java):
//   1. databarang INNER JOIN kodesatuan (kode_sat) INNER JOIN jenis (kdjns)
//      WHERE status='1' AND (kode_brng/nama_brng/jenis.nama LIKE search).
//      Perhatikan INNER JOIN (bukan LEFT) — Java memang begitu, jadi barang
//      yang kode_sat/kdjns-nya nyasar ke baris "-" placeholder TETAP ikut
//      (karena baris "-" itu sendiri ada di kodesatuan/jenis), tapi barang
//      dengan kode_sat/kdjns yang benar-benar tidak match apa pun akan
//      hilang dari laporan — bukan bug, diikuti apa adanya.
//   2. Untuk TIAP baris, Java query terpisah (N+1) SUM(gudangbarang.stok)
//      INNER JOIN bangsal WHERE bangsal.status='1' (HANYA lokasi aktif —
//      beda dari SUM total_stok di Data Barang yang tidak filter status
//      bangsal) AND no_batch='' AND no_faktur='' (jalur aktifkanbatch="no",
//      satu-satunya jalur yang kami port, sama seperti modul lain) AND
//      kode_brng=?. Diport sebagai correlated subquery per baris (SQL,
//      bukan N+1 di Go) — hasil akhir identik, cuma dieksekusi di sisi DB.
//   3. Baris HANYA ditampilkan kalau stok_saat_ini <= stokminimal.
//      PENTING: `stokminimal` nullable di skema, dan Java baca lewat
//      `rs.getDouble("stokminimal")` — JDBC mengembalikan 0.0 untuk kolom
//      SQL NULL (bukan exception/null), jadi barang tanpa stokminimal
//      diperlakukan seolah minimalnya 0 (baru masuk laporan kalau stok
//      live-nya <= 0). Direplikasi dengan `COALESCE(stokminimal,0)` di
//      HAVING — kalau dibiarkan `<= stokminimal` mentah, SQL akan
//      mengecualikan baris NULL sama sekali (semantik SQL vs JDBC beda,
//      salah satu perangkap yang gampang kelewat kalau tidak hati-hati).
//
// TIDAK ada tab "Buat"/transaksi baru — murni laporan, sama seperti
// Riwayat Obat. Frontend TIDAK auto-load saat dibuka (replikasi Java:
// tabel kosong sampai user isi kata kunci atau klik Cari), pola yang
// sudah dipakai di ApotekRiwayatBarangMedis.tsx.
// ============================================================================

type daruratStokRow struct {
	KodeBrng    string  `json:"kode_brng"`
	NamaBrng    string  `json:"nama_brng"`
	Satuan      string  `json:"satuan"`
	Jenis       string  `json:"jenis"`
	StokMinimal float64 `json:"stok_minimal"`
	StokSaatIni float64 `json:"stok_saat_ini"`
}

func getDaruratStok(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT b.kode_brng, b.nama_brng, COALESCE(s.satuan,''), COALESCE(j.nama,''),
				COALESCE(b.stokminimal,0) AS stok_minimal,
				COALESCE((
					SELECT SUM(g.stok) FROM gudangbarang g
					INNER JOIN bangsal bg ON bg.kd_bangsal = g.kd_bangsal
					WHERE bg.status='1' AND g.no_batch='' AND g.no_faktur='' AND g.kode_brng = b.kode_brng
				), 0) AS stok_saat_ini
			FROM databarang b
			INNER JOIN kodesatuan s ON b.kode_sat = s.kode_sat
			INNER JOIN jenis j ON b.kdjns = j.kdjns
			WHERE b.status = '1'
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ? OR j.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " HAVING stok_saat_ini <= stok_minimal ORDER BY b.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []daruratStokRow{}
		for rows.Next() {
			var r daruratStokRow
			if rows.Scan(&r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.Jenis, &r.StokMinimal, &r.StokSaatIni) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// updateStokMinimal — TIDAK ada padanannya di Java (DlgDaruratStok.java
// murni laporan, tidak ada tombol edit sama sekali di sana; ubah
// stokminimal biasanya lewat form Data Barang terpisah) — field baru di
// app ini supaya staf bisa langsung koreksi ambang darurat stok dari
// laporan yang sama tempat mereka menyadari nilainya kurang pas, tanpa
// harus pindah ke modul Data Barang.
func updateStokMinimal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBrng := c.Param("kode_brng")
		var body struct {
			StokMinimal float64 `json:"stok_minimal"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.StokMinimal < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Stok minimal tidak valid"})
			return
		}
		res, err := db.Exec(`UPDATE databarang SET stokminimal=? WHERE kode_brng=?`, body.StokMinimal, kodeBrng)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Barang tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Stok minimal berhasil diperbarui"})
	}
}
