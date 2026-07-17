package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Stok Opname (tab utama modul Apotek, bukan bagian Pengaturan).
// Cocok dengan dialog Khanza Desktop "Stok Opname"
// (inventory/DlgInputStok.java — form INPUT sebenarnya; DlgStokOpname.java
// cuma laporan/riwayat READ-ONLY, tidak ada tombol Simpan sama sekali).
//
// Tabel `opname` (kode_brng, h_beli, tanggal, stok, real, selisih,
// nomihilang, lebih, nomilebih, keterangan, kd_bangsal, no_batch,
// no_faktur — PK majemuk kode_brng+tanggal+kd_bangsal+no_batch+no_faktur)
// adalah LOG hasil opname, bukan sumber stok — stok sesungguhnya tetap di
// `gudangbarang.stok`.
//
// Rumus Java (BtnSimpanActionPerformed di DlgInputStok.java, disalin
// persis):
//   kurang = stok_sistem - real_hitung_fisik
//   kurang > 0  → selisih (kekurangan/hilang) = kurang, lebih = 0
//   kurang <= 0 → selisih = 0, lebih (kelebihan) = -kurang
//   nomihilang = selisih * h_beli
//   nomilebih  = lebih * h_beli
// Simpan opname JUGA langsung meng-overwrite gudangbarang.stok dengan
// nilai `real` (staf mengoreksi stok sistem supaya sama dengan stok
// fisik) — INI YANG MEMBUAT STOK ASLI BERUBAH, bukan cuma catatan.
//
// Penyederhanaan yang disengaja dari versi Java (didokumentasikan di
// APOTEK_MODUL.md):
//   - Harga dasar nominal SELALU pakai databarang.h_beli — Java punya opsi
//     "HPPFARMASI" per-batch dari data_batch (kolom dinamis, default
//     "dasar"), tidak kami port karena itu app-level config Khanza yang
//     tidak ada padanannya di sini.
//   - Tidak ada pembedaan tab "Belum Opname"/"Sudah Opname" per tanggal —
//     staf bisa opname ulang kapan saja, baris terakhir yang berlaku
//     (upsert).
//   - UPDATE (retrofit): Trackobat.catatRiwayat SEKARANG diport lewat
//     catatRiwayatBarangMedis (apotek_riwayat_barang_medis.go), dipanggil
//     tepat sebelum UPDATE gudangbarang persis titik & urutan Java —
//     dibutuhkan supaya tab "Riwayat Obat, Alkes & BHP" bisa menampilkan
//     aktivitas Stok Opname dari web app, bukan cuma data lama Khanza
//     Desktop. Java (DlgStokOpname.java) TIDAK memanggil catatRiwayat
//     saat Hapus riwayat opname — jadi endpoint DELETE di bawah tetap
//     tidak menulis ke riwayat_barang_medis, identik Java.
//   - Hapus riwayat opname (DELETE) cuma menghapus baris log `opname`,
//     TIDAK mengembalikan gudangbarang.stok — identik dengan Java
//     (DlgStokOpname.java Hapus cuma delete baris, tidak ada logika
//     revert stok).
// ============================================================================

type stokOpnameItem struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	Jenis    string  `json:"jenis"`
	Satuan   string  `json:"satuan"`
	NoBatch  string  `json:"no_batch"`
	NoFaktur string  `json:"no_faktur"`
	HBeli    float64 `json:"h_beli"`
	Stok     float64 `json:"stok"`
	Expire   string  `json:"expire"`
}

// getStokOpnameItems menampilkan SELURUH barang aktif (databarang.status='1'),
// PERSIS seperti tampil() awal di Java (DlgInputStok.java) — daftar
// muncul langsung dari databarang TANPA perlu Lokasi dipilih dulu (Java
// bahkan hardcode stok=0 di listing awal ini, baru dikoreksi per baris
// setelah staf pilih Lokasi). kd_bangsal di sini OPSIONAL: kalau kosong,
// LEFT JOIN gudangbarang otomatis tidak match apa pun (kd_bangsal asli
// tidak pernah string kosong) sehingga stok tetap fallback ke 0 — sama
// hasilnya dengan listing awal Java tanpa perlu percabangan query
// terpisah. Begitu Lokasi dipilih/diganti di frontend, endpoint ini
// dipanggil ulang dengan kd_bangsal terisi untuk menampilkan stok sistem
// yang sebenarnya di lokasi itu (fallback ke 0 kalau barang itu belum
// pernah distok di sana — juga dipakai untuk "menambah" barang baru ke
// suatu depo).
//
// PENTING — JOIN gudangbarang HARUS dibatasi no_batch='' AND no_faktur=''
// (baris "tanpa batch"): terungkap lewat getData() di Java yang user
// tunjukkan — untuk aktifkanbatch="no" (nilai default), query stok Java
// SELALU kunci ke kombinasi kode_brng+kd_bangsal+no_batch=''+no_faktur='',
// mengabaikan baris gudangbarang batch-tracked lainnya sepenuhnya (bukan
// menjumlahkannya, bukan menampilkannya). Tanpa syarat ini, satu kode_brng
// dengan beberapa baris batch di gudangbarang bakal ikut ter-LEFT JOIN
// berkali-kali (satu baris per batch) sehingga nama barang yang sama
// tampil dobel — persis yang dilaporkan user, sementara Khanza Desktop
// asli cuma tampil sekali per barang.
func getStokOpnameItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT b.kode_brng, b.nama_brng, COALESCE(j.nama,''), COALESCE(s.satuan,''), COALESCE(gb.no_batch,''), COALESCE(gb.no_faktur,''), b.h_beli, COALESCE(gb.stok,0),
				IF(b.expire IS NULL OR b.expire = '0000-00-00', '', b.expire)
			FROM databarang b
			LEFT JOIN gudangbarang gb ON gb.kode_brng = b.kode_brng AND gb.kd_bangsal = ? AND gb.no_batch = '' AND gb.no_faktur = ''
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			LEFT JOIN jenis j ON j.kdjns = b.kdjns
			WHERE b.status = '1'
		`
		args := []interface{}{kdBangsal}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		// TANPA LIMIT — identik Java (tampil() di DlgInputStok.java memuat
		// SEMUA barang aktif sekaligus ke tabel, tidak ada pagination/cap
		// sama sekali). Sempat ada LIMIT 500 di sini yang bikin daftar
		// kepotong di tengah alfabet (barang "Z..." seperti "Zyloric"
		// hilang) — ditemukan lewat perbandingan langsung user terhadap
		// Khanza Desktop yang scroll sampai akhir daftar tanpa terpotong.
		query += " ORDER BY b.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []stokOpnameItem{}
		for rows.Next() {
			var it stokOpnameItem
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Jenis, &it.Satuan, &it.NoBatch, &it.NoFaktur, &it.HBeli, &it.Stok, &it.Expire) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

type stokOpnameSubmitItem struct {
	KodeBrng string  `json:"kode_brng"`
	NoBatch  string  `json:"no_batch"`
	NoFaktur string  `json:"no_faktur"`
	HBeli    float64 `json:"h_beli"`
	Stok     float64 `json:"stok"`
	Real     float64 `json:"real"`
}

// submitStokOpname menyimpan hasil opname sekaligus untuk beberapa
// barang (satu sesi opname = satu kd_bangsal + tanggal + keterangan),
// dan langsung mengoreksi gudangbarang.stok — identik alur Java.
func submitStokOpname(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsal  string                 `json:"kd_bangsal"`
			Tanggal    string                 `json:"tanggal"`
			Keterangan string                 `json:"keterangan"`
			Petugas    string                 `json:"petugas"`
			Items      []stokOpnameSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KdBangsal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lokasi wajib diisi"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi hasil hitungnya"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		affected := 0
		for _, it := range body.Items {
			kurang := it.Stok - it.Real
			var selisih, lebih, nomihilang, nomilebih float64
			if kurang > 0 {
				selisih = kurang
				nomihilang = selisih * it.HBeli
			} else {
				lebih = -kurang
				nomilebih = lebih * it.HBeli
			}

			if _, err := tx.Exec(
				`DELETE FROM opname WHERE kode_brng=? AND tanggal=? AND kd_bangsal=? AND no_batch=? AND no_faktur=?`,
				it.KodeBrng, body.Tanggal, body.KdBangsal, it.NoBatch, it.NoFaktur,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				"INSERT INTO opname (kode_brng, h_beli, tanggal, stok, `real`, selisih, nomihilang, lebih, nomilebih, keterangan, kd_bangsal, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				it.KodeBrng, it.HBeli, body.Tanggal, it.Stok, it.Real, selisih, nomihilang, lebih, nomilebih, body.Keterangan, body.KdBangsal, it.NoBatch, it.NoFaktur,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, it.Real, 0, "Opname", body.Petugas, body.KdBangsal, "Simpan", it.NoBatch, it.NoFaktur, body.Keterangan); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			res, err := tx.Exec(
				`UPDATE gudangbarang SET stok=? WHERE kode_brng=? AND kd_bangsal=? AND no_batch=? AND no_faktur=?`,
				it.Real, it.KodeBrng, body.KdBangsal, it.NoBatch, it.NoFaktur,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if _, err := tx.Exec(
					`INSERT INTO gudangbarang (kode_brng, kd_bangsal, stok, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?)`,
					it.KodeBrng, body.KdBangsal, it.Real, it.NoBatch, it.NoFaktur,
				); err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			}
			affected++
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Stok opname berhasil disimpan, stok sistem sudah dikoreksi", "affected": affected})
	}
}

type stokOpnameRiwayat struct {
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	Satuan     string  `json:"satuan"`
	HBeli      float64 `json:"h_beli"`
	Tanggal    string  `json:"tanggal"`
	Stok       float64 `json:"stok"`
	Real       float64 `json:"real"`
	Selisih    float64 `json:"selisih"`
	Lebih      float64 `json:"lebih"`
	TotalReal  float64 `json:"total_real"`
	Nomihilang float64 `json:"nomihilang"`
	Nomilebih  float64 `json:"nomilebih"`
	Keterangan string  `json:"keterangan"`
	KdBangsal  string  `json:"kd_bangsal"`
	NmBangsal  string  `json:"nm_bangsal"`
	NoBatch    string  `json:"no_batch"`
	NoFaktur   string  `json:"no_faktur"`
}

// getStokOpnameRiwayat — laporan riwayat opname, padanan tab "cari" di
// DlgStokOpname.java (JOIN databarang+bangsal, rentang tanggal). Default
// 30 hari terakhir kalau tgl1/tgl2 tidak dikirim, supaya tidak full scan.
func getStokOpnameRiwayat(db *sql.DB) gin.HandlerFunc {
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
			SELECT o.kode_brng, b.nama_brng, COALESCE(s.satuan,''), o.h_beli, o.tanggal, o.stok, o.real,
				o.selisih, o.lebih, (o.real * o.h_beli) AS total_real, o.nomihilang, o.nomilebih,
				o.keterangan, o.kd_bangsal, COALESCE(bg.nm_bangsal,''), o.no_batch, o.no_faktur
			FROM opname o
			INNER JOIN databarang b ON b.kode_brng = o.kode_brng
			INNER JOIN bangsal bg ON bg.kd_bangsal = o.kd_bangsal
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			WHERE o.tanggal BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND o.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if search != "" {
			query += " AND (o.kode_brng LIKE ? OR b.nama_brng LIKE ? OR o.keterangan LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY o.tanggal DESC, b.nama_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []stokOpnameRiwayat{}
		for rows.Next() {
			var r stokOpnameRiwayat
			if rows.Scan(&r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.HBeli, &r.Tanggal, &r.Stok, &r.Real,
				&r.Selisih, &r.Lebih, &r.TotalReal, &r.Nomihilang, &r.Nomilebih,
				&r.Keterangan, &r.KdBangsal, &r.NmBangsal, &r.NoBatch, &r.NoFaktur) == nil {
				items = append(items, r)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// deleteStokOpnameRiwayat menghapus SATU baris log opname — TIDAK
// mengembalikan gudangbarang.stok, identik perilaku Java (Hapus di
// DlgStokOpname.java cuma delete baris riwayat).
func deleteStokOpnameRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBrng := c.Query("kode_brng")
		tanggal := c.Query("tanggal")
		kdBangsal := c.Query("kd_bangsal")
		noBatch := c.Query("no_batch")
		noFaktur := c.Query("no_faktur")
		if kodeBrng == "" || tanggal == "" || kdBangsal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap"})
			return
		}
		res, err := db.Exec(
			`DELETE FROM opname WHERE kode_brng=? AND tanggal=? AND kd_bangsal=? AND no_batch=? AND no_faktur=?`,
			kodeBrng, tanggal, kdBangsal, noBatch, noFaktur,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Riwayat opname berhasil dihapus (stok sistem TIDAK dikembalikan, sesuai perilaku Khanza Desktop)"})
	}
}
