package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Mutasi Obat & BHP (tab utama modul Apotek). Cocok dengan
// inventory/DlgMutasiBarang.java (form INPUT, satu-satunya yang punya
// tombol Simpan) + inventory/DlgPindahGudang.java (laporan/riwayat +
// tombol Hapus).
//
// Tabel `mutasibarang` (kode_brng, jml, harga, kd_bangsaldari,
// kd_bangsalke, tanggal, keterangan, no_batch, no_faktur — PK majemuk
// kode_brng+kd_bangsaldari+kd_bangsalke+tanggal+no_batch+no_faktur)
// adalah LOG mutasi — TAPI beda dari tabel `opname`, aksi Simpan/Hapus
// mutasi SELALU mengubah gudangbarang.stok DUA sisi sekaligus (asal
// berkurang, tujuan bertambah), dan meng-hapus riwayat JUGA REVERT
// stok (kebalikan dari Stok Opname yang hapus riwayatnya tidak revert
// — lihat DlgPindahGudang.java method hapus(), beda dari
// DlgStokOpname.java).
//
// Rumus Java (BtnSimpanActionPerformed di DlgMutasiBarang.java, jalur
// aktifkanbatch="no" — nilai default, satu-satunya yang diport):
//   INSERT mutasibarang (..., no_batch='', no_faktur='')
//   UPDATE gudangbarang SET stok = stok - jml WHERE kode_brng=? AND
//     kd_bangsal=kd_bangsaldari AND no_batch='' AND no_faktur=''
//   UPDATE gudangbarang SET stok = stok + jml WHERE kode_brng=? AND
//     kd_bangsal=kd_bangsalke AND no_batch='' AND no_faktur=''
//
// Penyederhanaan yang disengaja dari versi Java (pola sama dengan
// Stok Opname, didokumentasikan di APOTEK_MODUL.md):
//   - Harga dasar nominal SELALU pakai databarang.h_beli (bukan opsi
//     HPPFARMASI per-batch dari data_batch).
//   - Tidak mereplikasi Trackobat.catatRiwayat — mutasi sendiri sudah
//     tercatat di tabel `mutasibarang`.
//   - Tidak ada alur "Permintaan Medis" (tampil(String nopermintaan) di
//     Java, mengisi form dari permintaan_medis/detail_permintaan_medis
//     yang sudah disetujui) — di luar scope, staf input mutasi manual.
//   - Tidak melacak batch (aktifkanbatch="no" — sama seperti Stok
//     Opname): gudangbarang selalu dikunci ke no_batch='' AND
//     no_faktur=''.
// ============================================================================

type mutasiItem struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	Satuan    string  `json:"satuan"`
	HBeli     float64 `json:"h_beli"`
	StokAsal  float64 `json:"stok_asal"`
	StokTujuan float64 `json:"stok_tujuan"`
	Expire    string  `json:"expire"`
}

// getMutasiItems menampilkan barang yang BISA dimutasi dari kd_bangsal_dari
// — beda dari Stok Opname yang selalu menampilkan SELURUH katalog aktif,
// di sini HARUS ada stok>0 di lokasi asal (persis tampil() di
// DlgMutasiBarang.java: "gudangbarang.stok>0 and gudangbarang.kd_bangsal=?"
// jalur aktifkanbatch="no") — masuk akal karena tidak mungkin memindahkan
// barang yang stoknya nol di lokasi asal. kd_bangsal_dari WAJIB diisi
// (kalau kosong, endpoint mengembalikan daftar kosong, bukan error, supaya
// frontend bisa langsung fetch ulang begitu staf pilih Dari tanpa perlu
// state loading terpisah).
func getMutasiItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdBangsalDari := strings.TrimSpace(c.Query("kd_bangsal_dari"))
		kdBangsalKe := strings.TrimSpace(c.Query("kd_bangsal_ke"))
		search := strings.TrimSpace(c.Query("search"))

		if kdBangsalDari == "" {
			c.JSON(http.StatusOK, []mutasiItem{})
			return
		}

		query := `
			SELECT b.kode_brng, b.nama_brng, COALESCE(s.satuan,''), b.h_beli, gbd.stok, COALESCE(gbk.stok,0),
				IF(b.expire IS NULL OR b.expire = '0000-00-00', '', b.expire)
			FROM databarang b
			INNER JOIN gudangbarang gbd ON gbd.kode_brng = b.kode_brng AND gbd.kd_bangsal = ? AND gbd.no_batch = '' AND gbd.no_faktur = ''
			LEFT JOIN gudangbarang gbk ON gbk.kode_brng = b.kode_brng AND gbk.kd_bangsal = ? AND gbk.no_batch = '' AND gbk.no_faktur = ''
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			WHERE b.status = '1' AND gbd.stok > 0
		`
		args := []interface{}{kdBangsalDari, kdBangsalKe}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY b.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []mutasiItem{}
		for rows.Next() {
			var it mutasiItem
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.HBeli, &it.StokAsal, &it.StokTujuan, &it.Expire) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

type mutasiSubmitItem struct {
	KodeBrng string  `json:"kode_brng"`
	HBeli    float64 `json:"h_beli"`
	Jml      float64 `json:"jml"`
}

// submitMutasi memindahkan stok sekaligus untuk beberapa barang dari satu
// lokasi ke lokasi lain (satu sesi = satu kd_bangsal_dari + kd_bangsal_ke +
// tanggal + keterangan). Jumlah divalidasi ULANG terhadap stok_asal
// TERKINI di server (bukan cuma percaya angka dari frontend) supaya tidak
// terjadi stok minus kalau ada mutasi lain yang sudah lebih dulu commit
// sejak frontend memuat daftar — Java sendiri tidak punya masalah ini
// karena satu aplikasi desktop dipakai satu staf per sesi, tapi web bisa
// diakses banyak tab/user bersamaan.
func submitMutasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsalDari string              `json:"kd_bangsal_dari"`
			KdBangsalKe   string              `json:"kd_bangsal_ke"`
			Tanggal       string              `json:"tanggal"`
			Keterangan    string              `json:"keterangan"`
			Petugas       string              `json:"petugas"`
			Items         []mutasiSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KdBangsalDari) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lokasi asal (Dari) wajib diisi"})
			return
		}
		if strings.TrimSpace(body.KdBangsalKe) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lokasi tujuan (Ke) wajib diisi"})
			return
		}
		if body.KdBangsalDari == body.KdBangsalKe {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lokasi Dari dan Ke harus berbeda"})
			return
		}
		if strings.TrimSpace(body.Tanggal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal wajib diisi"})
			return
		}
		if strings.TrimSpace(body.Keterangan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keterangan wajib diisi"})
			return
		}
		if len(body.Items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah mutasinya"})
			return
		}

		var nmDari, nmKe string
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, body.KdBangsalDari).Scan(&nmDari)
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, body.KdBangsalKe).Scan(&nmKe)
		keteranganRiwayat := fmt.Sprintf("%s, dari %s ke %s", body.Keterangan, nmDari, nmKe)

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		affected := 0
		for _, it := range body.Items {
			if it.Jml <= 0 {
				continue
			}

			var stokAsal float64
			var namaBrng string
			err := tx.QueryRow(
				`SELECT gb.stok, b.nama_brng FROM gudangbarang gb INNER JOIN databarang b ON b.kode_brng = gb.kode_brng
				 WHERE gb.kode_brng=? AND gb.kd_bangsal=? AND gb.no_batch='' AND gb.no_faktur=''`,
				it.KodeBrng, body.KdBangsalDari,
			).Scan(&stokAsal, &namaBrng)
			if err != nil || stokAsal < it.Jml {
				tx.Rollback()
				msg := fmt.Sprintf("Stok %s tidak mencukupi untuk dimutasi", it.KodeBrng)
				if namaBrng != "" {
					msg = fmt.Sprintf("Stok %s (%s) tidak mencukupi untuk dimutasi", namaBrng, it.KodeBrng)
				}
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}

			if _, err := tx.Exec(
				`INSERT INTO mutasibarang (kode_brng, jml, harga, kd_bangsaldari, kd_bangsalke, tanggal, keterangan, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?, ?, ?, '', '')`,
				it.KodeBrng, it.Jml, it.HBeli, body.KdBangsalDari, body.KdBangsalKe, body.Tanggal, body.Keterangan,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, 0, it.Jml, "Mutasi", body.Petugas, body.KdBangsalDari, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.Jml, it.KodeBrng, body.KdBangsalDari,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, it.Jml, 0, "Mutasi", body.Petugas, body.KdBangsalKe, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.Jml, it.KodeBrng, body.KdBangsalKe,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if _, err := tx.Exec(
					`INSERT INTO gudangbarang (kode_brng, kd_bangsal, stok, no_batch, no_faktur) VALUES (?, ?, ?, '', '')`,
					it.KodeBrng, body.KdBangsalKe, it.Jml,
				); err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			}
			affected++
		}

		if affected == 0 {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah mutasinya"})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mutasi berhasil disimpan, stok sistem sudah dipindahkan", "affected": affected})
	}
}

type mutasiRiwayat struct {
	KodeBrng      string  `json:"kode_brng"`
	NamaBrng      string  `json:"nama_brng"`
	Satuan        string  `json:"satuan"`
	Jml           float64 `json:"jml"`
	Harga         float64 `json:"harga"`
	Total         float64 `json:"total"`
	Tanggal       string  `json:"tanggal"`
	Keterangan    string  `json:"keterangan"`
	KdBangsalDari string  `json:"kd_bangsal_dari"`
	NmBangsalDari string  `json:"nm_bangsal_dari"`
	KdBangsalKe   string  `json:"kd_bangsal_ke"`
	NmBangsalKe   string  `json:"nm_bangsal_ke"`
	NoBatch       string  `json:"no_batch"`
	NoFaktur      string  `json:"no_faktur"`
}

// getMutasiRiwayat — laporan riwayat mutasi, padanan tampil() di
// DlgPindahGudang.java (JOIN databarang + bangsal dua kali untuk Dari/Ke,
// rentang tanggal). Default 30 hari terakhir kalau tgl1/tgl2 tidak
// dikirim, supaya tidak full-scan (pola sama dengan Stok Opname).
// kd_bangsal (kalau diisi) mencocokkan SALAH SATU dari Dari ATAU Ke —
// staf ingin lihat semua mutasi yang menyentuh satu lokasi, baik sebagai
// asal maupun tujuan.
func getMutasiRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT m.kode_brng, b.nama_brng, COALESCE(s.satuan,''), m.jml, m.harga, (m.jml * m.harga) AS total,
				DATE_FORMAT(m.tanggal, '%Y-%m-%d %H:%i:%s'), m.keterangan, m.kd_bangsaldari, COALESCE(bd.nm_bangsal,''), m.kd_bangsalke, COALESCE(bk.nm_bangsal,''),
				m.no_batch, m.no_faktur
			FROM mutasibarang m
			INNER JOIN databarang b ON b.kode_brng = m.kode_brng
			INNER JOIN bangsal bd ON bd.kd_bangsal = m.kd_bangsaldari
			INNER JOIN bangsal bk ON bk.kd_bangsal = m.kd_bangsalke
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			WHERE m.tanggal BETWEEN ? AND ?
		`
		args := []interface{}{tgl1 + " 00:00:00", tgl2 + " 23:59:59"}
		if kdBangsal != "" {
			query += " AND (m.kd_bangsaldari = ? OR m.kd_bangsalke = ?)"
			args = append(args, kdBangsal, kdBangsal)
		}
		if search != "" {
			query += " AND (m.kode_brng LIKE ? OR b.nama_brng LIKE ? OR m.keterangan LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY m.tanggal DESC, b.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []mutasiRiwayat{}
		for rows.Next() {
			var r mutasiRiwayat
			if rows.Scan(&r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.Jml, &r.Harga, &r.Total,
				&r.Tanggal, &r.Keterangan, &r.KdBangsalDari, &r.NmBangsalDari, &r.KdBangsalKe, &r.NmBangsalKe,
				&r.NoBatch, &r.NoFaktur) == nil {
				items = append(items, r)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// deleteMutasiRiwayat menghapus satu baris log mutasi DAN me-REVERT stok
// di kedua sisi (stok asal ditambah kembali, stok tujuan dikurangi) —
// PERILAKU INI BEDA DARI Stok Opname (yang hapus riwayatnya TIDAK revert
// stok). Ini persis method hapus() di DlgPindahGudang.java jalur
// aktifkanbatch="no": menambah stok kd_bangsaldari, mengurangi stok
// kd_bangsalke, baru menghapus baris mutasibarang-nya.
func deleteMutasiRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBrng := c.Query("kode_brng")
		tanggal := c.Query("tanggal")
		kdBangsalDari := c.Query("kd_bangsal_dari")
		kdBangsalKe := c.Query("kd_bangsal_ke")
		noBatch := c.Query("no_batch")
		noFaktur := c.Query("no_faktur")
		petugas := c.Query("petugas")
		if kodeBrng == "" || tanggal == "" || kdBangsalDari == "" || kdBangsalKe == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}

		var jml float64
		var keterangan string
		err := db.QueryRow(
			`SELECT jml, keterangan FROM mutasibarang WHERE kode_brng=? AND tanggal=? AND kd_bangsaldari=? AND kd_bangsalke=? AND no_batch=? AND no_faktur=?`,
			kodeBrng, tanggal, kdBangsalDari, kdBangsalKe, noBatch, noFaktur,
		).Scan(&jml, &keterangan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var nmDari, nmKe string
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, kdBangsalDari).Scan(&nmDari)
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, kdBangsalKe).Scan(&nmKe)
		keteranganRiwayat := fmt.Sprintf("%s, dari %s ke %s", keterangan, nmDari, nmKe)

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`DELETE FROM mutasibarang WHERE kode_brng=? AND tanggal=? AND kd_bangsaldari=? AND kd_bangsalke=? AND no_batch=? AND no_faktur=?`,
			kodeBrng, tanggal, kdBangsalDari, kdBangsalKe, noBatch, noFaktur,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := catatRiwayatBarangMedis(tx, kodeBrng, jml, 0, "Mutasi", petugas, kdBangsalDari, "Hapus", "", "", keteranganRiwayat); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(
			`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
			jml, kodeBrng, kdBangsalDari,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := catatRiwayatBarangMedis(tx, kodeBrng, 0, jml, "Mutasi", petugas, kdBangsalKe, "Hapus", "", "", keteranganRiwayat); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(
			`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
			jml, kodeBrng, kdBangsalKe,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Riwayat mutasi berhasil dihapus, stok sistem sudah dikembalikan ke kedua lokasi"})
	}
}

// getMutasiHariIni — statistik ringan untuk StatCard "Mutasi Hari Ini" di
// DashboardApotek.tsx, padanan getPenjualanHariIni (apotek_penjualan_handler.go):
// cuma hitung baris mutasibarang hari ini, bukan reuse getMutasiRiwayat.
func getMutasiHariIni(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var count int
		err := db.QueryRow(`SELECT COUNT(*) FROM mutasibarang WHERE DATE(tanggal) = CURDATE()`).Scan(&count)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}
