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
// APOTEK — Penerimaan Obat & BHP (tab utama modul Apotek). Cocok dengan
// inventory/DlgPembelian.java (form transaksi pembelian/penerimaan barang
// dari supplier, satu-satunya yang punya tombol Simpan) +
// inventory/DlgCariPembelian.java (daftar riwayat + klik-kanan Hapus).
//
// Penerimaan = transaksi PEMBELIAN dari supplier yang LANGSUNG menambah
// stok (`gudangbarang.stok += jumlah`) di lokasi penerima — beda dari
// Permintaan (yang cuma dokumen permintaan internal antar depo, baru
// mengubah stok setelah disetujui lewat Mutasi) dan beda dari Mutasi
// (yang memindah stok antar dua lokasi INTERNAL, bukan dari luar rumah
// sakit).
//
// **Rumus per baris** (persis getData() di DlgPembelian.java):
//   subtotal = jumlah * h_beli
//   besardis = subtotal * (dis% / 100)
//   total    = subtotal - besardis
// **Rumus header**:
//   total1 (subtotal)  = SUM(subtotal semua baris)
//   potongan           = SUM(besardis semua baris)
//   total2             = total1 - potongan
//   ppn                = (ppn% / 100) * total2
//   tagihan            = total2 + ppn
//
// Tabel:
//   pembelian (no_faktur PK, kode_suplier, nip, tgl_beli, total1,
//     potongan, total2, ppn, tagihan, kd_bangsal, kd_rek)
//   detailbeli (no_faktur, kode_brng, kode_sat, jumlah, h_beli, subtotal,
//     dis, besardis, total, no_batch, jumlah2, kadaluarsa — FK no_faktur
//     ON DELETE CASCADE ke pembelian, JADI TIDAK PERLU DELETE manual
//     terpisah saat hapus riwayat, beda dari kesan awal saat baca Java
//     yang topeng-nya cuma satu DELETE ke tabel pembelian saja: itu
//     bukan bug Java, cascade-nya memang sudah ditangani di level skema
//     DB, bukan di level kode aplikasi).
//
// **No.Faktur** digenerate SERVER-SIDE, rumus identik autoNomor() di
// Java: prefix "PG"+YYYYMMDD, 3 digit urut per tanggal
// (MAX(RIGHT(no_faktur,3))+1), dalam transaksi yang sama dengan INSERT.
//
// **Hapus riwayat REVERT stok** (`gudangbarang.stok -= jumlah`) — persis
// ppHapusActionPerformed di DlgCariPembelian.java, TANPA guard stok tidak
// boleh minus (Java sendiri juga tidak menjaga ini, jadi kami samakan
// perilakunya — beda dari submitMutasi/setujuiPermintaan yang memang ada
// validasi stok karena itu PEMINDAHAN antar lokasi yang harus konsisten,
// sementara di sini cuma REVERT satu transaksi yang secara logis boleh
// bikin stok "seolah belum pernah diterima").
//
// **Penyederhanaan yang disengaja** (pola sama modul lain):
//   - TIDAK ada integrasi Jurnal/akuntansi (tampjurnal, AkunBayar,
//     jur.simpanJurnal) — modul Keuangan/Jurnal tidak ada di proyek ini
//     sama sekali, kolom `kd_rek` di `pembelian` cukup diisi NULL.
//   - TIDAK ada konversi satuan besar/kecil (SatuanBeli/isi/hargabesar
//     di Java, beli per-dus dikonversi ke pcs) — harga & jumlah selalu
//     dalam satuan dasar `databarang.kode_sat`, `jumlah2` (kolom
//     "jumlah setelah konversi" di Java) selalu SAMA dengan `jumlah`.
//   - TIDAK melacak batch (`aktifkanbatch="no"`, `no_batch` selalu '')
//     dan TIDAK insert ke `data_batch` — pola sama Stok Opname/Mutasi.
//   - TIDAK update `databarang.h_beli`/harga jual (checkbox "update
//     harga" per baris di Java, `simpanbatch()`) — di luar scope,
//     manajemen harga jual adalah fitur terpisah yang bisa memengaruhi
//     modul lain (Kasir, Resep) kalau diubah sembarangan; harga beli
//     per transaksi cukup tersimpan di `detailbeli.h_beli` sebagai
//     riwayat harga, tanpa mengubah master `databarang`.
//
// UPDATE (retrofit): Trackobat.catatRiwayat SEKARANG diport lewat
// catatRiwayatBarangMedis (apotek_riwayat_barang_medis.go), posisi
// "Pengadaan" (BUKAN "Penerimaan" — nama enum itu dipakai fitur Khanza
// lain yang tidak kami port; dialog yang benar-benar kami port di sini,
// DlgPembelian.java, memang menulis posisi="Pengadaan"), dipanggil tepat
// sebelum tiap UPDATE gudangbarang persis titik & urutan Java.
// ============================================================================

type penerimaanBarangOpsi struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Satuan   string  `json:"satuan"`
	HBeli    float64 `json:"h_beli"`
}

func getPenerimaanBarangOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT b.kode_brng, b.nama_brng, b.kode_sat, COALESCE(s.satuan,''), b.h_beli
			FROM databarang b
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			WHERE b.status = '1'
		`
		args := []interface{}{}
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
		items := []penerimaanBarangOpsi{}
		for rows.Next() {
			var it penerimaanBarangOpsi
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan, &it.HBeli) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoFakturPenerimaan meniru autoNomor() di DlgPembelian.java:
// prefix "PG"+YYYYMMDD, 3 digit urut per tanggal. Dipanggil di DALAM
// transaksi (pakai tx) supaya konsisten dengan INSERT yang menyusul.
func generateNoFakturPenerimaan(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "PG" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_faktur,3) AS UNSIGNED)),0) FROM pembelian WHERE tgl_beli=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

type penerimaanSubmitItem struct {
	KodeBrng string  `json:"kode_brng"`
	KodeSat  string  `json:"kode_sat"`
	Jumlah   float64 `json:"jumlah"`
	HBeli    float64 `json:"h_beli"`
	Dis      float64 `json:"dis"`
	Kadaluwarsa string `json:"kadaluwarsa"`
}

// submitPenerimaan mencatat transaksi pembelian/penerimaan baru DAN
// langsung menambah stok — padanan BtnSimpanActionPerformed di
// DlgPembelian.java (jalur aktifkanbatch="no", tanpa Jurnal/AkunBayar).
func submitPenerimaan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KodeSuplier string                  `json:"kode_suplier"`
			Nip         string                  `json:"nip"`
			Tanggal     string                  `json:"tanggal"`
			KdBangsal   string                  `json:"kd_bangsal"`
			PpnPercent  float64                 `json:"ppn_percent"`
			Petugas     string                  `json:"petugas"`
			Items       []penerimaanSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KodeSuplier) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Supplier wajib diisi"})
			return
		}
		if strings.TrimSpace(body.Nip) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas wajib diisi"})
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
		items := make([]penerimaanSubmitItem, 0, len(body.Items))
		for _, it := range body.Items {
			if it.Jumlah > 0 {
				items = append(items, it)
			}
		}
		if len(items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah penerimaannya"})
			return
		}

		var total1, potongan float64
		type computedItem struct {
			it       penerimaanSubmitItem
			subtotal float64
			besardis float64
			total    float64
		}
		computed := make([]computedItem, 0, len(items))
		for _, it := range items {
			subtotal := it.Jumlah * it.HBeli
			besardis := subtotal * (it.Dis / 100)
			total := subtotal - besardis
			total1 += subtotal
			potongan += besardis
			computed = append(computed, computedItem{it, subtotal, besardis, total})
		}
		total2 := total1 - potongan
		ppn := (body.PpnPercent / 100) * total2
		tagihan := total2 + ppn

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		noFaktur, err := generateNoFakturPenerimaan(tx, body.Tanggal)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var namaSuplier string
		tx.QueryRow(`SELECT nama_suplier FROM datasuplier WHERE kode_suplier=?`, body.KodeSuplier).Scan(&namaSuplier)
		keteranganRiwayat := strings.TrimSpace(noFaktur + " " + namaSuplier)

		if _, err := tx.Exec(
			`INSERT INTO pembelian (no_faktur, kode_suplier, nip, tgl_beli, total1, potongan, total2, ppn, tagihan, kd_bangsal, kd_rek) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
			noFaktur, body.KodeSuplier, body.Nip, body.Tanggal, total1, potongan, total2, ppn, tagihan, body.KdBangsal,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		for _, ci := range computed {
			var kadaluwarsa interface{}
			if strings.TrimSpace(ci.it.Kadaluwarsa) != "" {
				kadaluwarsa = ci.it.Kadaluwarsa
			}
			if _, err := tx.Exec(
				`INSERT INTO detailbeli (no_faktur, kode_brng, kode_sat, jumlah, h_beli, subtotal, dis, besardis, total, no_batch, jumlah2, kadaluarsa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
				noFaktur, ci.it.KodeBrng, ci.it.KodeSat, ci.it.Jumlah, ci.it.HBeli, ci.subtotal, ci.it.Dis, ci.besardis, ci.total, ci.it.Jumlah, kadaluwarsa,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, ci.it.KodeBrng, ci.it.Jumlah, 0, "Pengadaan", body.Petugas, body.KdBangsal, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				ci.it.Jumlah, ci.it.KodeBrng, body.KdBangsal,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if _, err := tx.Exec(
					`INSERT INTO gudangbarang (kode_brng, kd_bangsal, stok, no_batch, no_faktur) VALUES (?, ?, ?, '', '')`,
					ci.it.KodeBrng, body.KdBangsal, ci.it.Jumlah,
				); err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Penerimaan berhasil disimpan, stok sudah bertambah", "no_faktur": noFaktur, "tagihan": tagihan})
	}
}

type penerimaanDetailItem struct {
	KodeBrng    string  `json:"kode_brng"`
	NamaBrng    string  `json:"nama_brng"`
	Satuan      string  `json:"satuan"`
	Jumlah      float64 `json:"jumlah"`
	HBeli       float64 `json:"h_beli"`
	Subtotal    float64 `json:"subtotal"`
	Dis         float64 `json:"dis"`
	Besardis    float64 `json:"besardis"`
	Total       float64 `json:"total"`
	Kadaluwarsa string  `json:"kadaluwarsa"`
}

type penerimaanRiwayat struct {
	NoFaktur    string                  `json:"no_faktur"`
	Tanggal     string                  `json:"tanggal"`
	KodeSuplier string                  `json:"kode_suplier"`
	NamaSuplier string                  `json:"nama_suplier"`
	Nip         string                  `json:"nip"`
	NamaPetugas string                  `json:"nama_petugas"`
	KdBangsal   string                  `json:"kd_bangsal"`
	NmBangsal   string                  `json:"nm_bangsal"`
	Total1      float64                 `json:"total1"`
	Potongan    float64                 `json:"potongan"`
	Total2      float64                 `json:"total2"`
	Ppn         float64                 `json:"ppn"`
	Tagihan     float64                 `json:"tagihan"`
	Items       []penerimaanDetailItem `json:"items"`
}

// getPenerimaanRiwayat — daftar penerimaan + item per baris (embed) —
// padanan tampil() di DlgCariPembelian.java, disederhanakan (tanpa
// filter Jenis/Kategori/Golongan, cukup search bebas + filter lokasi/
// supplier + rentang tanggal). Default 30 hari terakhir.
func getPenerimaanRiwayat(db *sql.DB) gin.HandlerFunc {
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
		kodeSuplier := strings.TrimSpace(c.Query("kode_suplier"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT p.no_faktur, p.tgl_beli, p.kode_suplier, COALESCE(sp.nama_suplier,''), p.nip, COALESCE(pg.nama,''),
				p.kd_bangsal, COALESCE(b.nm_bangsal,''), p.total1, p.potongan, p.total2, p.ppn, p.tagihan
			FROM pembelian p
			LEFT JOIN datasuplier sp ON sp.kode_suplier = p.kode_suplier
			LEFT JOIN petugas pg ON pg.nip = p.nip
			LEFT JOIN bangsal b ON b.kd_bangsal = p.kd_bangsal
			WHERE p.tgl_beli BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND p.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if kodeSuplier != "" {
			query += " AND p.kode_suplier = ?"
			args = append(args, kodeSuplier)
		}
		if search != "" {
			query += " AND (p.no_faktur LIKE ? OR sp.nama_suplier LIKE ? OR pg.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY p.tgl_beli DESC, p.no_faktur DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []penerimaanRiwayat{}
		for rows.Next() {
			var r penerimaanRiwayat
			if rows.Scan(&r.NoFaktur, &r.Tanggal, &r.KodeSuplier, &r.NamaSuplier, &r.Nip, &r.NamaPetugas,
				&r.KdBangsal, &r.NmBangsal, &r.Total1, &r.Potongan, &r.Total2, &r.Ppn, &r.Tagihan) == nil {
				r.Items = []penerimaanDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.jumlah, d.h_beli, d.subtotal, d.dis, d.besardis, d.total,
					IF(d.kadaluarsa IS NULL OR d.kadaluarsa='0000-00-00', '', d.kadaluarsa)
				 FROM detailbeli d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.no_faktur = ? ORDER BY d.kode_brng`,
				list[i].NoFaktur,
			)
			if err != nil {
				continue
			}
			for itemRows.Next() {
				var it penerimaanDetailItem
				if itemRows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.Jumlah, &it.HBeli, &it.Subtotal, &it.Dis, &it.Besardis, &it.Total, &it.Kadaluwarsa) == nil {
					list[i].Items = append(list[i].Items, it)
				}
			}
			itemRows.Close()
		}

		c.JSON(http.StatusOK, list)
	}
}

// deletePenerimaan — hapus riwayat penerimaan DAN revert stok (subtract
// balik jumlah yang pernah diterima) — padanan ppHapusActionPerformed di
// DlgCariPembelian.java. detailbeli terhapus otomatis lewat FK ON DELETE
// CASCADE, tidak perlu DELETE manual terpisah.
func deletePenerimaan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noFaktur := c.Param("no_faktur")
		petugas := c.Query("petugas")

		var kdBangsal string
		if err := db.QueryRow(`SELECT kd_bangsal FROM pembelian WHERE no_faktur=?`, noFaktur).Scan(&kdBangsal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Penerimaan tidak ditemukan"})
			return
		}

		rows, err := db.Query(`SELECT kode_brng, jumlah FROM detailbeli WHERE no_faktur=?`, noFaktur)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type line struct {
			kodeBrng string
			jumlah   float64
		}
		var lines []line
		for rows.Next() {
			var l line
			if rows.Scan(&l.kodeBrng, &l.jumlah) == nil {
				lines = append(lines, l)
			}
		}
		rows.Close()

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, l := range lines {
			if err := catatRiwayatBarangMedis(tx, l.kodeBrng, 0, l.jumlah, "Pengadaan", petugas, kdBangsal, "Hapus", "", "", noFaktur); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				l.jumlah, l.kodeBrng, kdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`DELETE FROM pembelian WHERE no_faktur=?`, noFaktur); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Penerimaan berhasil dihapus, stok sistem sudah dikembalikan"})
	}
}
