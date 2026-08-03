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
// APOTEK — Input Penjualan Obat & BHP (tab utama modul Apotek). Cocok
// dengan inventory/DlgPenjualan.java (btnInputPenjualan di frmUtama.java,
// bagian non-racikan/non-resep saja — jalur verifikasi_penjualan_di_kasir
// ="No" sehingga stok LANGSUNG berkurang saat simpan, TANPA menunggu
// pembayaran di Kasir terpisah, karena modul Kasir tidak ada di proyek
// ini).
//
// Penjualan = transaksi jual LANGSUNG (Jual Bebas/OTC) di depo Apotek,
// BUKAN dari resep dokter (beda dari alur Resep/PermintaanResep yang
// sudah ada) — pembeli SERING bukan pasien terdaftar (walk-in, anonim),
// makanya `no_rkm_medis` selalu '-' placeholder di sini (sama pola
// dengan yang didokumentasikan di apotek_retur_jual_handler.go), dan
// `nm_pasien` cukup nama bebas yang diketik kasir. Retur dari Pembeli
// (apotek_retur_jual_handler.go) MEMBACA nota_jual/detailjual yang
// dibuat handler ini — sebelum ini tabel itu cuma warisan Khanza
// Desktop, sekarang bisa terus bertambah lewat web app juga.
//
// **Rumus per baris** (persis getData() di DlgPenjualan.java):
//   subtotal = jumlah * h_jual
//   bsr_dis  = subtotal * (dis% / 100)
//   total    = subtotal - bsr_dis
// **Rumus header**: penjualan TIDAK punya kolom subtotal/tagihan
// tersendiri (beda dari pembelian) — cuma kolom `ppn` (nominal, bukan
// persen) yang dihitung dari total semua baris setelah diskon, sama pola
// hitungnya dengan submitPenerimaan, tapi disimpan sebagai satu angka.
// Total keseluruhan nota selalu diturunkan saat baca (SUM(detailjual.total)
// WHERE nota_jual=?), bukan disimpan redundan.
//
// Tabel:
//   penjualan (nota_jual PK, tgl_jual, nip, no_rkm_medis, nm_pasien,
//     keterangan, jns_jual enum, ongkir, ppn, status enum, kd_bangsal,
//     kd_rek, nama_bayar)
//   detailjual (nota_jual, kode_brng, kode_sat, h_jual, h_beli, jumlah,
//     subtotal, dis, bsr_dis, tambahan, embalase, tuslah, aturan_pakai,
//     total, no_batch, no_faktur — TIDAK ada FK formal ON DELETE CASCADE
//     di skema Khanza aslinya utk tabel ini, beda dari detailbeli/
//     detreturjual, jadi kalau nanti ada fitur hapus nota, baris ini
//     harus dihapus manual juga)
//
// **No.Nota** digenerate SERVER-SIDE: prefix "PJ"+YYYYMMDD, 3 digit urut
// per tanggal — pola sama persis generateNoFakturPenerimaan/
// generateNoReturJual.
//
// **Penyederhanaan yang disengaja** (pola sama modul lain):
//   - TIDAK ada racikan (tbObatRacikan/tbDetailObatRacikan di Java,
//     obat_racikan_jual/detail_obat_racikan_jual) — cuma obat/BHP satuan
//     langsung, sama seperti fitur non-resep lain di proyek ini.
//   - TIDAK ada member/loyalty pembeli (kdmem/nmmem di Java) — nm_pasien
//     cukup teks bebas, no_rkm_medis selalu '-'.
//   - TIDAK ada batch (`aktifkanbatch`, `data_batch`) — no_batch/
//     no_faktur di detailjual selalu ''.
//   - TIDAK ada integrasi Kasir/Jurnal — verifikasi_penjualan_di_kasir
//     dianggap selalu "No": stok berkurang LANGSUNG saat simpan (kd_rek
//     NULL, sama seperti Penerimaan).
//   - TIDAK ada validasi stok cukup/tidak sebelum mengurangi (sama pola
//     dengan seluruh modul Apotek lain di proyek ini yang juga tidak
//     menjaga hal ini).
//   - h_beli per baris diisi dari databarang.h_beli SAAT itu (snapshot
//     harga pokok untuk keperluan laporan margin di masa depan), TIDAK
//     bisa diedit user.
//
// posisi riwayat_barang_medis = "Penjualan" (sudah ada di POSISI_OPTIONS
// ApotekRiwayatBarangMedis.tsx sebagai opsi filter, tapi sebelum ini
// tidak ada handler manapun yang benar-benar menulis posisi tsb).
// ============================================================================

// jnsJualKolomHarga memetakan jns_jual (enum kolom `penjualan.jns_jual`)
// ke kolom harga per kategori di `databarang` — Khanza menyimpan harga
// jual per payer/jenis-transaksi terpisah (bukan satu h_jual tunggal),
// makanya harga yang dipakai berubah tergantung jns_jual yang dipilih.
var jnsJualKolomHarga = map[string]string{
	"Jual Bebas":  "jualbebas",
	"Karyawan":    "karyawan",
	"Beli Luar":   "beliluar",
	"Rawat Jalan": "ralan",
	"Kelas 1":     "kelas1",
	"Kelas 2":     "kelas2",
	"Kelas 3":     "kelas3",
	"Utama/BPJS":  "utama",
	"VIP":         "vip",
	"VVIP":        "vvip",
}

// getAkunBayarOpsi — daftar metode pembayaran (`akun_bayar.nama_bayar`
// jadi FK wajib di `penjualan.nama_bayar`, tidak bisa isi bebas seperti
// "Tunai" — harus persis salah satu nilai di tabel ini).
func getAkunBayarOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT nama_bayar FROM akun_bayar ORDER BY nama_bayar`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []string{}
		for rows.Next() {
			var nama string
			if rows.Scan(&nama) == nil {
				items = append(items, nama)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

type penjualanBarangOpsi struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Satuan   string  `json:"satuan"`
	HJual    float64 `json:"h_jual"`
	HBeli    float64 `json:"h_beli"`
	Stok     float64 `json:"stok"`
}

// getPenjualanBarangOpsi — stok yang ditampilkan (kolom "Stok") diambil
// dari gudangbarang DI LOKASI (kd_bangsal) yang sedang dipilih di form,
// no_batch/no_faktur='' (tanpa pelacakan batch, sama pola modul Apotek
// lain) — kalau kd_bangsal belum dipilih/kosong, stok tampil 0 (bukan
// stok gabungan semua lokasi, supaya tidak menyesatkan user pilih jumlah
// melebihi yang benar-benar ada di lokasi itu).
func getPenjualanBarangOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		jnsJual := strings.TrimSpace(c.Query("jns_jual"))
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal"))
		kolomHarga, ok := jnsJualKolomHarga[jnsJual]
		if !ok {
			kolomHarga = "jualbebas"
		}
		query := fmt.Sprintf(`
			SELECT b.kode_brng, b.nama_brng, b.kode_sat, COALESCE(s.satuan,''), COALESCE(b.%s,0), COALESCE(b.h_beli,0),
				COALESCE(g.stok,0)
			FROM databarang b
			LEFT JOIN kodesatuan s ON s.kode_sat = b.kode_sat
			LEFT JOIN gudangbarang g ON g.kode_brng = b.kode_brng AND g.kd_bangsal = ? AND g.no_batch = '' AND g.no_faktur = ''
			WHERE b.status = '1'
		`, kolomHarga)
		args := []interface{}{kdBangsal}
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
		items := []penjualanBarangOpsi{}
		for rows.Next() {
			var it penjualanBarangOpsi
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan, &it.HJual, &it.HBeli, &it.Stok) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoNotaJual: prefix "PJ"+YYYYMMDD, 3 digit urut per tanggal —
// pola sama persis generateNoFakturPenerimaan/generateNoReturJual.
func generateNoNotaJual(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "PJ" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(nota_jual,3) AS UNSIGNED)),0) FROM penjualan WHERE tgl_jual=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

// getNextNotaJual — preview No. Nota yang AKAN dipakai kalau simpan
// sekarang, padanan autoNomor() yang di Java langsung tampil begitu
// dialog dibuka (bukan nunggu sampai user klik Simpan). Read-only, tidak
// mengunci/reserve apapun — kalau ada transaksi lain nyelip sebelum user
// ini benar-benar simpan, nomornya bisa geser (sama seperti Java, cuma
// preview bukan jaminan).
func getNextNotaJual(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		if tanggal == "" {
			tanggal = time.Now().Format("2006-01-02")
		}
		t, err := time.Parse("2006-01-02", tanggal)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format tanggal tidak valid"})
			return
		}
		prefix := "PJ" + t.Format("20060102")
		var maxSuffix int
		if err := db.QueryRow(
			`SELECT IFNULL(MAX(CAST(RIGHT(nota_jual,3) AS UNSIGNED)),0) FROM penjualan WHERE tgl_jual=?`,
			tanggal,
		).Scan(&maxSuffix); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"nota_jual": fmt.Sprintf("%s%03d", prefix, maxSuffix+1)})
	}
}

type penjualanSubmitItem struct {
	KodeBrng string  `json:"kode_brng"`
	KodeSat  string  `json:"kode_sat"`
	Jumlah   float64 `json:"jumlah"`
	HJual    float64 `json:"h_jual"`
	HBeli    float64 `json:"h_beli"`
	Dis      float64 `json:"dis"`
}

// submitPenjualan mencatat transaksi penjualan bebas baru DAN langsung
// mengurangi stok — padanan BtnSimpanActionPerformed di DlgPenjualan.java
// jalur verifikasi_penjualan_di_kasir="No" (tanpa racikan/member/batch).
func submitPenjualan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NmPasien   string                `json:"nm_pasien"`
			JnsJual    string                `json:"jns_jual"`
			Nip        string                `json:"nip"`
			Tanggal    string                `json:"tanggal"`
			KdBangsal  string                `json:"kd_bangsal"`
			PpnPercent float64               `json:"ppn_percent"`
			NamaBayar  string                `json:"nama_bayar"`
			Status     string                `json:"status"`
			Keterangan string                `json:"keterangan"`
			Petugas    string                `json:"petugas"`
			Items      []penjualanSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
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
		jnsJual := strings.TrimSpace(body.JnsJual)
		if jnsJual == "" {
			jnsJual = "Jual Bebas"
		}
		status := strings.TrimSpace(body.Status)
		if status == "" {
			status = "Sudah Dibayar"
		}
		namaBayar := strings.TrimSpace(body.NamaBayar)
		if namaBayar == "" {
			namaBayar = "Bayar Cash"
		}
		nmPasien := strings.TrimSpace(body.NmPasien)
		if nmPasien == "" {
			nmPasien = "Umum"
		}

		items := make([]penjualanSubmitItem, 0, len(body.Items))
		for _, it := range body.Items {
			if it.Jumlah > 0 {
				items = append(items, it)
			}
		}
		if len(items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah penjualannya"})
			return
		}

		var total2 float64
		type computedItem struct {
			it       penjualanSubmitItem
			subtotal float64
			bsrDis   float64
			total    float64
		}
		computed := make([]computedItem, 0, len(items))
		for _, it := range items {
			subtotal := it.Jumlah * it.HJual
			bsrDis := subtotal * (it.Dis / 100)
			total := subtotal - bsrDis
			total2 += total
			computed = append(computed, computedItem{it, subtotal, bsrDis, total})
		}
		ppn := (body.PpnPercent / 100) * total2
		tagihan := total2 + ppn

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		notaJual, err := generateNoNotaJual(tx, body.Tanggal)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO penjualan (nota_jual, tgl_jual, nip, no_rkm_medis, nm_pasien, keterangan, jns_jual, ongkir, ppn, status, kd_bangsal, kd_rek, nama_bayar) VALUES (?, ?, ?, '-', ?, ?, ?, 0, ?, ?, ?, NULL, ?)`,
			notaJual, body.Tanggal, body.Nip, nmPasien, body.Keterangan, jnsJual, ppn, status, body.KdBangsal, namaBayar,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		keteranganRiwayat := strings.TrimSpace(notaJual + " " + nmPasien)

		for _, ci := range computed {
			if _, err := tx.Exec(
				`INSERT INTO detailjual (nota_jual, kode_brng, kode_sat, h_jual, h_beli, jumlah, subtotal, dis, bsr_dis, tambahan, embalase, tuslah, aturan_pakai, total, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, '', ?, '', '')`,
				notaJual, ci.it.KodeBrng, ci.it.KodeSat, ci.it.HJual, ci.it.HBeli, ci.it.Jumlah, ci.subtotal, ci.it.Dis, ci.bsrDis, ci.total,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, ci.it.KodeBrng, 0, ci.it.Jumlah, "Penjualan", body.Petugas, body.KdBangsal, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				ci.it.Jumlah, ci.it.KodeBrng, body.KdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Penjualan berhasil disimpan, stok sudah berkurang", "nota_jual": notaJual, "tagihan": tagihan})
	}
}

// ============================================================================
// Laporan Penjualan — sub-tab riwayat, padanan DlgCariPenjualan.java.
// `penjualan` TIDAK punya kolom total/tagihan tersendiri (beda dari
// `pembelian`), jadi tagihan per nota diturunkan saat baca:
// tagihan = SUM(detailjual.total WHERE nota_jual=?) + penjualan.ppn.
//
// Filter status bayar (Sudah Dibayar/Belum Dibayar) sengaja cuma ada di
// sini (bukan di form Input Penjualan) — status transaksi baru selalu
// default "Sudah Dibayar" server-side (lihat submitPenjualan), sesuai
// sifat Jual Bebas/OTC yang dianggap selalu lunas saat itu juga.
// ============================================================================

type penjualanDetailItem struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	Satuan   string  `json:"satuan"`
	Jumlah   float64 `json:"jumlah"`
	HJual    float64 `json:"h_jual"`
	Subtotal float64 `json:"subtotal"`
	Dis      float64 `json:"dis"`
	BsrDis   float64 `json:"bsr_dis"`
	Total    float64 `json:"total"`
}

type penjualanRiwayat struct {
	NotaJual    string                `json:"nota_jual"`
	Tanggal     string                `json:"tanggal"`
	NmPasien    string                `json:"nm_pasien"`
	JnsJual     string                `json:"jns_jual"`
	Nip         string                `json:"nip"`
	NamaPetugas string                `json:"nama_petugas"`
	KdBangsal   string                `json:"kd_bangsal"`
	NmBangsal   string                `json:"nm_bangsal"`
	NamaBayar   string                `json:"nama_bayar"`
	Status      string                `json:"status"`
	Keterangan  string                `json:"keterangan"`
	Ppn         float64               `json:"ppn"`
	Tagihan     float64               `json:"tagihan"`
	Items       []penjualanDetailItem `json:"items"`
}

// getPenjualanRiwayat — daftar nota penjualan + item per baris (embed) —
// padanan tampil() di DlgCariPenjualan.java, disederhanakan (search bebas
// + filter lokasi/status + rentang tanggal). Default 30 hari terakhir.
func getPenjualanRiwayat(db *sql.DB) gin.HandlerFunc {
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
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT p.nota_jual, p.tgl_jual, COALESCE(p.nm_pasien,''), COALESCE(p.jns_jual,''), p.nip, COALESCE(pg.nama,''),
				p.kd_bangsal, COALESCE(b.nm_bangsal,''), COALESCE(p.nama_bayar,''), COALESCE(p.status,''), COALESCE(p.keterangan,''), p.ppn
			FROM penjualan p
			LEFT JOIN petugas pg ON pg.nip = p.nip
			LEFT JOIN bangsal b ON b.kd_bangsal = p.kd_bangsal
			WHERE p.tgl_jual BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND p.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if status != "" {
			query += " AND p.status = ?"
			args = append(args, status)
		}
		if search != "" {
			query += " AND (p.nota_jual LIKE ? OR p.nm_pasien LIKE ? OR pg.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY p.tgl_jual DESC, p.nota_jual DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []penjualanRiwayat{}
		for rows.Next() {
			var r penjualanRiwayat
			if rows.Scan(&r.NotaJual, &r.Tanggal, &r.NmPasien, &r.JnsJual, &r.Nip, &r.NamaPetugas,
				&r.KdBangsal, &r.NmBangsal, &r.NamaBayar, &r.Status, &r.Keterangan, &r.Ppn) == nil {
				r.Items = []penjualanDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.jumlah, d.h_jual, d.subtotal, d.dis, d.bsr_dis, d.total
				 FROM detailjual d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.nota_jual = ? ORDER BY d.kode_brng`,
				list[i].NotaJual,
			)
			if err != nil {
				continue
			}
			var total float64
			for itemRows.Next() {
				var it penjualanDetailItem
				if itemRows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.Jumlah, &it.HJual, &it.Subtotal, &it.Dis, &it.BsrDis, &it.Total) == nil {
					list[i].Items = append(list[i].Items, it)
					total += it.Total
				}
			}
			itemRows.Close()
			list[i].Tagihan = total + list[i].Ppn
		}

		c.JSON(http.StatusOK, list)
	}
}

// deletePenjualan — hapus nota penjualan DAN revert stok (kembalikan
// jumlah yang pernah dijual) — padanan hapus riwayat di
// DlgCariPenjualan.java. detailjual TIDAK punya FK ON DELETE CASCADE ke
// penjualan (beda dari detailbeli/detreturjual), jadi dihapus manual
// dulu sebelum header-nya.
func deletePenjualan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		notaJual := c.Param("nota_jual")
		petugas := c.Query("petugas")

		var kdBangsal string
		if err := db.QueryRow(`SELECT kd_bangsal FROM penjualan WHERE nota_jual=?`, notaJual).Scan(&kdBangsal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Penjualan tidak ditemukan"})
			return
		}

		rows, err := db.Query(`SELECT kode_brng, jumlah FROM detailjual WHERE nota_jual=?`, notaJual)
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
			if err := catatRiwayatBarangMedis(tx, l.kodeBrng, l.jumlah, 0, "Penjualan", petugas, kdBangsal, "Hapus", "", "", notaJual); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				l.jumlah, l.kodeBrng, kdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`DELETE FROM detailjual WHERE nota_jual=?`, notaJual); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM penjualan WHERE nota_jual=?`, notaJual); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Penjualan berhasil dihapus, stok sudah dikembalikan"})
	}
}

// getPenjualanHariIni — statistik ringan untuk StatCard "Penjualan Hari
// Ini" di DashboardApotek.tsx. Cuma hitung jumlah transaksi (nota_jual)
// hari ini, BUKAN reuse getPenjualanRiwayat (yang N+1 query detail item
// per nota) — terlalu berat untuk sekadar angka di dashboard.
func getPenjualanHariIni(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var count int
		err := db.QueryRow(`SELECT COUNT(*) FROM penjualan WHERE tgl_jual = CURDATE()`).Scan(&count)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}
