package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Riwayat Obat, Alkes & BHP (tab utama modul Apotek). Cocok
// dengan inventory/DlgRiwayatBarangMedis.java — laporan READ-ONLY murni
// (tidak ada tombol Simpan/Hapus sama sekali di Java, cuma Cari/Cetak)
// atas tabel log `riwayat_barang_medis`.
//
// Tabel ini diisi lewat inventory/riwayatobat.java method catatRiwayat(),
// dipanggil dari SETIAP fitur yang mengubah gudangbarang.stok (Opname,
// Mutasi, Pembelian/Pengadaan, dll) — SEBELUM UPDATE gudangbarang-nya
// sendiri dieksekusi, supaya stok_awal yang tercatat adalah nilai
// sungguhan sesaat sebelum perubahan.
//
// PENTING — retrofit dari penyederhanaan sebelumnya: keempat fitur stok
// lain di modul ini (Stok Opname, Mutasi, Penerimaan, approve
// Permintaan) TADINYA sengaja tidak memanggil Trackobat.catatRiwayat
// (didokumentasikan waktu itu sebagai "di luar scope"). Begitu tab
// laporan ini mulai dibangun, itu jadi masalah nyata: laporan bakal
// selalu kosong dari aktivitas web app, cuma menampilkan riwayat lama
// dari Khanza Desktop yang beku. Diputuskan (dikonfirmasi user) untuk
// SEKALIGUS retrofit pemanggilan catatRiwayatBarangMedis (helper di file
// ini) ke keempat handler tsb, persis titik & urutan panggilan di Java.
//
// catatRiwayatBarangMedis() di bawah adalah padanan riwayatobat.java:
// query stok_awal LIVE dari gudangbarang (bukan dipercaya dari parameter
// pemanggil, supaya konsisten dengan Java yang juga query ulang),
// hitung stok_akhir = stok_awal + masuk - keluar, KECUALI untuk
// posisi="Opname" yang punya kasus khusus di Java: stok_akhir DIPAKSA
// SAMA DENGAN `masuk` (bukan hasil rumus) — replikasi persis kuirk itu,
// bukan "diperbaiki", karena `masuk` yang dikirim untuk Opname memang
// sudah berisi nilai "Real" (hasil hitung fisik) itu sendiri, bukan
// delta perubahan.
//
// "petugas" di sini SELALU merujuk ke padanan akses.getkode() Java
// (operator yang sedang login menekan Simpan/Hapus) — BUKAN field bisnis
// "Petugas"/nip yang sudah ada di form Penerimaan/Permintaan (yang punya
// arti berbeda: staf yang tercatat bertanggung jawab atas transaksi,
// bisa jadi bukan operator yang login). Frontend mengirim identitas user
// yang sedang login (dari localStorage `ermapp_user`) sebagai parameter
// terpisah "petugas" di tiap request Simpan/Hapus.
// ============================================================================

// catatRiwayatBarangMedis mencatat satu baris log — dipanggil di DALAM
// transaksi yang sama dengan perubahan stoknya, SEBELUM UPDATE
// gudangbarang dieksekusi (urutan ini penting, sama seperti Java).
func catatRiwayatBarangMedis(tx *sql.Tx, kodeBrng string, masuk, keluar float64, posisi, petugas, kdBangsal, status, noBatch, noFaktur, keterangan string) error {
	var stokAwal float64
	err := tx.QueryRow(
		`SELECT stok FROM gudangbarang WHERE kode_brng=? AND kd_bangsal=? AND no_batch=? AND no_faktur=?`,
		kodeBrng, kdBangsal, noBatch, noFaktur,
	).Scan(&stokAwal)
	if err == sql.ErrNoRows {
		stokAwal = 0
	} else if err != nil {
		return err
	}

	stokAkhir := stokAwal + masuk - keluar
	loggedMasuk, loggedKeluar := masuk, keluar
	if posisi == "Opname" {
		loggedKeluar = 0
		stokAkhir = masuk
	}

	trunc := func(s string, n int) string {
		if len(s) > n {
			return s[:n]
		}
		return s
	}

	_, err = tx.Exec(
		`INSERT INTO riwayat_barang_medis (kode_brng, stok_awal, masuk, keluar, stok_akhir, posisi, tanggal, jam, petugas, kd_bangsal, status, no_batch, no_faktur, keterangan)
		 VALUES (?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?)`,
		kodeBrng, stokAwal, loggedMasuk, loggedKeluar, stokAkhir, posisi, trunc(petugas, 20), kdBangsal, status, trunc(noBatch, 20), trunc(noFaktur, 20), trunc(keterangan, 100),
	)
	return err
}

type riwayatBarangMedisRow struct {
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	StokAwal   float64 `json:"stok_awal"`
	Masuk      float64 `json:"masuk"`
	Keluar     float64 `json:"keluar"`
	StokAkhir  float64 `json:"stok_akhir"`
	Posisi     string  `json:"posisi"`
	Tanggal    string  `json:"tanggal"`
	Jam        string  `json:"jam"`
	Petugas    string  `json:"petugas"`
	KdBangsal  string  `json:"kd_bangsal"`
	NmBangsal  string  `json:"nm_bangsal"`
	Status     string  `json:"status"`
	NoBatch    string  `json:"no_batch"`
	NoFaktur   string  `json:"no_faktur"`
	Keterangan string  `json:"keterangan"`
}

// getRiwayatBarangMedis — padanan prosesCari() di
// DlgRiwayatBarangMedis.java: laporan read-only, filter rentang tanggal
// (wajib di Java, default 30 hari terakhir di sini kalau tidak dikirim),
// lokasi, kode/nama barang, dan search bebas lintas kolom.
func getRiwayatBarangMedis(db *sql.DB) gin.HandlerFunc {
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
		kodeBrng := strings.TrimSpace(c.Query("kode_brng"))
		posisi := strings.TrimSpace(c.Query("posisi"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT r.kode_brng, COALESCE(b.nama_brng,''), r.stok_awal, r.masuk, r.keluar, r.stok_akhir,
				r.posisi, r.tanggal, r.jam, COALESCE(r.petugas,''), r.kd_bangsal, COALESCE(bg.nm_bangsal,''),
				r.status, r.no_batch, r.no_faktur, r.keterangan
			FROM riwayat_barang_medis r
			LEFT JOIN databarang b ON b.kode_brng = r.kode_brng
			LEFT JOIN bangsal bg ON bg.kd_bangsal = r.kd_bangsal
			WHERE r.tanggal BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND r.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if kodeBrng != "" {
			query += " AND r.kode_brng = ?"
			args = append(args, kodeBrng)
		}
		if posisi != "" {
			query += " AND r.posisi = ?"
			args = append(args, posisi)
		}
		if search != "" {
			query += ` AND (r.kode_brng LIKE ? OR b.nama_brng LIKE ? OR r.petugas LIKE ? OR bg.nm_bangsal LIKE ?
				OR r.no_batch LIKE ? OR r.no_faktur LIKE ? OR r.keterangan LIKE ? OR r.posisi LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY r.tanggal DESC, r.jam DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []riwayatBarangMedisRow{}
		for rows.Next() {
			var r riwayatBarangMedisRow
			if rows.Scan(&r.KodeBrng, &r.NamaBrng, &r.StokAwal, &r.Masuk, &r.Keluar, &r.StokAkhir,
				&r.Posisi, &r.Tanggal, &r.Jam, &r.Petugas, &r.KdBangsal, &r.NmBangsal,
				&r.Status, &r.NoBatch, &r.NoFaktur, &r.Keterangan) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}
