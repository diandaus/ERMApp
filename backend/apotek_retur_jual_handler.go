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
// APOTEK — Retur dari Pembeli (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgReturJual.java — kebalikan dari Retur ke
// Suplier: barang yang sudah DIJUAL (Jual Bebas, tabel `penjualan`/
// `detailjual`) dikembalikan oleh pembeli, MENAMBAH stok balik.
//
// PENTING — beda alur dari Retur Beli (yang browse per-suplier lintas
// faktur): di sini user cari-per-NOTA (`nota_jual`) dulu, baru pilih barang
// dari nota itu. Alasannya `penjualan.no_rkm_medis` SERING '-' (placeholder
// pembeli anonim/Jual Bebas, BUKAN pasien terdaftar — banyak pembeli
// berbeda berbagi kode yang sama), jadi "pilih pembeli dulu" seperti Retur
// Beli tidak masuk akal di sini; yang realistis adalah pembeli datang bawa
// struk (nota_jual), makanya satu retur = SATU nota_jual saja (beda dari
// Retur Beli yang boleh campur banyak faktur dalam satu retur).
//
// PENTING — TIDAK ADA fitur "Penjualan/Jual Bebas" (pembuatan nota_jual
// baru) di proyek web ini sampai saat ini (grep backend/: nihil handler
// submitPenjualan). Jadi data `penjualan`/`detailjual` yang bisa diretur di
// sini SEPENUHNYA warisan Khanza Desktop (historis, tidak bertambah lewat
// web app) — beda dari Retur Beli yang datanya terus bertambah lewat fitur
// Penerimaan yang SUDAH ada. Kalau nanti fitur Jual Bebas dibangun di web
// app, modul ini otomatis ikut terpakai tanpa perubahan (tetap baca dari
// tabel yang sama).
//
// Tabel:
//   returjual (no_retur_jual PK, tgl_retur, nip, no_rkm_medis WAJIB FK ke
//     pasien — termasuk baris placeholder no_rkm_medis='-' untuk pembeli
//     anonim, kd_bangsal)
//   detreturjual (no_retur_jual, nota_jual, kode_brng, kode_sat, jml_jual,
//     h_jual, jml_retur, h_retur, subtotal, no_batch, no_faktur — FK
//     no_retur_jual ON DELETE CASCADE ke returjual, sama pola cascade
//     dengan detreturbeli/detailbeli, no_batch & no_faktur NOT NULL tanpa
//     batch tracking jadi selalu '').
//
// **Rumus per baris**: subtotal = jml_retur * h_retur.
//
// **No. Retur** digenerate SERVER-SIDE: prefix "RJ"+YYYYMMDD, 3 digit urut
// per tanggal — pola sama persis generateNoReturBeli/generateNoFakturPenerimaan.
//
// **TIDAK ada validasi stok saat submit** (beda dari Retur Beli yang
// mengurangi stok): menambah stok tidak pernah bikin negatif, sama
// prinsipnya dengan submitPenerimaan.
//
// **Penyederhanaan yang disengaja** (pola sama modul lain): tanpa integrasi
// Jurnal/akuntansi, tanpa konversi satuan besar/kecil, tanpa pelacakan
// batch, TIDAK memvalidasi jml_retur terhadap sisa yang belum diretur dari
// nota yang sama (boleh retur melebihi jml_jual kalau user salah isi —
// sama seperti submitPenerimaan yang juga tidak menjaga hal serupa; ini
// laporan operasional bukan sistem kontrol persediaan bertingkat).
// posisi riwayat_barang_medis = "Retur Jual" (enum Khanza asli, lihat
// POSISI_OPTIONS di ApotekRiwayatBarangMedis.tsx).
// ============================================================================

type returJualNotaOpsi struct {
	NotaJual   string `json:"nota_jual"`
	Tanggal    string `json:"tanggal"`
	NoRkmMedis string `json:"no_rkm_medis"`
	NmPasien   string `json:"nm_pasien"`
	JnsJual    string `json:"jns_jual"`
}

// getReturJualNotaOpsi mencari nota penjualan (di lokasi tertentu) yang
// bisa jadi rujukan retur — dibatasi LIMIT 30 + wajib kd_bangsal supaya
// tidak scan seluruh histori penjualan tanpa arah (pelajaran yang sama
// dari investigasi performa Riwayat Obat: jangan biarkan query tanpa
// filter jelas jalan bebas di tabel yang bisa tumbuh besar).
func getReturJualNotaOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal"))
		search := strings.TrimSpace(c.Query("search"))
		if kdBangsal == "" {
			c.JSON(http.StatusOK, []returJualNotaOpsi{})
			return
		}

		query := `
			SELECT p.nota_jual, p.tgl_jual, COALESCE(p.no_rkm_medis,''), COALESCE(p.nm_pasien,''), COALESCE(p.jns_jual,'')
			FROM penjualan p
			WHERE p.kd_bangsal = ?
		`
		args := []interface{}{kdBangsal}
		if search != "" {
			query += " AND (p.nota_jual LIKE ? OR p.nm_pasien LIKE ? OR p.no_rkm_medis LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY p.tgl_jual DESC LIMIT 30"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []returJualNotaOpsi{}
		for rows.Next() {
			var it returJualNotaOpsi
			if rows.Scan(&it.NotaJual, &it.Tanggal, &it.NoRkmMedis, &it.NmPasien, &it.JnsJual) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

type returJualItemOpsi struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Satuan   string  `json:"satuan"`
	HJual    float64 `json:"h_jual"`
	JmlJual  float64 `json:"jml_jual"`
	Stok     float64 `json:"stok"`
}

// getReturJualNotaItems mengambil baris barang di satu nota_jual, plus
// stok saat ini di lokasi nota tsb — dipakai untuk isi tabel pilih barang
// setelah user memilih satu nota dari getReturJualNotaOpsi.
func getReturJualNotaItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		notaJual := c.Param("nota_jual")

		var kdBangsal string
		if err := db.QueryRow(`SELECT kd_bangsal FROM penjualan WHERE nota_jual=?`, notaJual).Scan(&kdBangsal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Nota penjualan tidak ditemukan"})
			return
		}

		rows, err := db.Query(
			`SELECT d.kode_brng, COALESCE(b.nama_brng,''), d.kode_sat, COALESCE(s.satuan,''), d.h_jual, d.jumlah, COALESCE(gb.stok,0)
			 FROM detailjual d
			 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
			 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
			 LEFT JOIN gudangbarang gb ON gb.kode_brng = d.kode_brng AND gb.kd_bangsal = ? AND gb.no_batch = '' AND gb.no_faktur = ''
			 WHERE d.nota_jual = ? ORDER BY d.kode_brng`,
			kdBangsal, notaJual,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []returJualItemOpsi{}
		for rows.Next() {
			var it returJualItemOpsi
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan, &it.HJual, &it.JmlJual, &it.Stok) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoReturJual meniru pola generateNoReturBeli/generateNoFakturPenerimaan:
// prefix "RJ"+YYYYMMDD, 3 digit urut per tanggal. Dipanggil DALAM transaksi.
func generateNoReturJual(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "RJ" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_retur_jual,3) AS UNSIGNED)),0) FROM returjual WHERE tgl_retur=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

type returJualSubmitItem struct {
	KodeBrng string  `json:"kode_brng"`
	KodeSat  string  `json:"kode_sat"`
	HJual    float64 `json:"h_jual"`
	JmlJual  float64 `json:"jml_jual"`
	HRetur   float64 `json:"h_retur"`
	JmlRetur float64 `json:"jml_retur"`
}

// submitReturJual mencatat retur baru DAN langsung menambah stok —
// padanan BtnSimpanActionPerformed di DlgReturJual.java. no_rkm_medis &
// kd_bangsal di-resolve SERVER-SIDE dari nota_jual (bukan dipercaya dari
// body), supaya konsisten dengan nota aslinya walau client mengirim data
// yang salah/basi.
func submitReturJual(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NotaJual string                 `json:"nota_jual"`
			Nip      string                 `json:"nip"`
			Tanggal  string                 `json:"tanggal"`
			Petugas  string                 `json:"petugas"`
			Items    []returJualSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.NotaJual) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nota penjualan wajib dipilih"})
			return
		}
		if strings.TrimSpace(body.Nip) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas wajib diisi"})
			return
		}
		if strings.TrimSpace(body.Tanggal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal wajib diisi"})
			return
		}
		items := make([]returJualSubmitItem, 0, len(body.Items))
		for _, it := range body.Items {
			if it.JmlRetur > 0 {
				items = append(items, it)
			}
		}
		if len(items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah retur-nya"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var noRkmMedis, kdBangsal, nmPasien string
		if err := tx.QueryRow(`SELECT COALESCE(no_rkm_medis,''), kd_bangsal, COALESCE(nm_pasien,'') FROM penjualan WHERE nota_jual=?`, body.NotaJual).
			Scan(&noRkmMedis, &kdBangsal, &nmPasien); err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nota penjualan tidak ditemukan"})
			return
		}

		noReturJual, err := generateNoReturJual(tx, body.Tanggal)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO returjual (no_retur_jual, tgl_retur, nip, no_rkm_medis, kd_bangsal) VALUES (?, ?, ?, ?, ?)`,
			noReturJual, body.Tanggal, body.Nip, noRkmMedis, kdBangsal,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		keteranganRiwayat := strings.TrimSpace(fmt.Sprintf("%s %s (dari %s)", noReturJual, nmPasien, body.NotaJual))

		var totalRetur float64
		for _, it := range items {
			subtotal := it.JmlRetur * it.HRetur
			totalRetur += subtotal
			if _, err := tx.Exec(
				`INSERT INTO detreturjual (no_retur_jual, nota_jual, kode_brng, kode_sat, jml_jual, h_jual, jml_retur, h_retur, subtotal, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')`,
				noReturJual, body.NotaJual, it.KodeBrng, it.KodeSat, it.JmlJual, it.HJual, it.JmlRetur, it.HRetur, subtotal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, it.JmlRetur, 0, "Retur Jual", body.Petugas, kdBangsal, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.JmlRetur, it.KodeBrng, kdBangsal,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if _, err := tx.Exec(
					`INSERT INTO gudangbarang (kode_brng, kd_bangsal, stok, no_batch, no_faktur) VALUES (?, ?, ?, '', '')`,
					it.KodeBrng, kdBangsal, it.JmlRetur,
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
		c.JSON(http.StatusOK, gin.H{"message": "Retur berhasil disimpan, stok sudah ditambahkan", "no_retur_jual": noReturJual, "total_retur": totalRetur})
	}
}

type returJualDetailItem struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	Satuan   string  `json:"satuan"`
	HJual    float64 `json:"h_jual"`
	JmlJual  float64 `json:"jml_jual"`
	HRetur   float64 `json:"h_retur"`
	JmlRetur float64 `json:"jml_retur"`
	Subtotal float64 `json:"subtotal"`
}

type returJualRiwayat struct {
	NoReturJual string                 `json:"no_retur_jual"`
	Tanggal     string                 `json:"tanggal"`
	NotaJual    string                 `json:"nota_jual"`
	NoRkmMedis  string                 `json:"no_rkm_medis"`
	NmPasien    string                 `json:"nm_pasien"`
	Nip         string                 `json:"nip"`
	NamaPetugas string                 `json:"nama_petugas"`
	KdBangsal   string                 `json:"kd_bangsal"`
	NmBangsal   string                 `json:"nm_bangsal"`
	Total       float64                `json:"total"`
	Items       []returJualDetailItem `json:"items"`
}

// getReturJualRiwayat — daftar retur + item per baris (embed), default 30
// hari terakhir — padanan tampil() di DlgCariReturJual.java.
func getReturJualRiwayat(db *sql.DB) gin.HandlerFunc {
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
			SELECT r.no_retur_jual, r.tgl_retur,
				COALESCE((SELECT dj.nota_jual FROM detreturjual dj WHERE dj.no_retur_jual = r.no_retur_jual LIMIT 1), ''),
				r.no_rkm_medis, COALESCE(ps.nm_pasien,''),
				r.nip, COALESCE(pg.nama,''), r.kd_bangsal, COALESCE(b.nm_bangsal,'')
			FROM returjual r
			LEFT JOIN pasien ps ON ps.no_rkm_medis = r.no_rkm_medis
			LEFT JOIN petugas pg ON pg.nip = r.nip
			LEFT JOIN bangsal b ON b.kd_bangsal = r.kd_bangsal
			WHERE r.tgl_retur BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND r.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if search != "" {
			query += " AND (r.no_retur_jual LIKE ? OR ps.nm_pasien LIKE ? OR pg.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY r.tgl_retur DESC, r.no_retur_jual DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []returJualRiwayat{}
		for rows.Next() {
			var r returJualRiwayat
			if rows.Scan(&r.NoReturJual, &r.Tanggal, &r.NotaJual, &r.NoRkmMedis, &r.NmPasien,
				&r.Nip, &r.NamaPetugas, &r.KdBangsal, &r.NmBangsal) == nil {
				r.Items = []returJualDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.h_jual, d.jml_jual, d.h_retur, d.jml_retur, d.subtotal
				 FROM detreturjual d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.no_retur_jual = ? ORDER BY d.kode_brng`,
				list[i].NoReturJual,
			)
			if err != nil {
				continue
			}
			for itemRows.Next() {
				var it returJualDetailItem
				if itemRows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.HJual, &it.JmlJual, &it.HRetur, &it.JmlRetur, &it.Subtotal) == nil {
					list[i].Items = append(list[i].Items, it)
					list[i].Total += it.Subtotal
				}
			}
			itemRows.Close()
		}

		c.JSON(http.StatusOK, list)
	}
}

// deleteReturJual — hapus riwayat retur DAN revert stok (kurangi balik
// jumlah yang pernah ditambahkan) — padanan ppHapusActionPerformed di
// DlgCariReturJual.java. TANPA guard stok tidak boleh minus (Java sendiri
// juga tidak menjaga ini untuk aksi hapus/revert, sama pola dengan
// deletePenerimaan). detreturjual terhapus otomatis lewat FK ON DELETE
// CASCADE.
func deleteReturJual(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noReturJual := c.Param("no_retur_jual")
		petugas := c.Query("petugas")

		var kdBangsal string
		if err := db.QueryRow(`SELECT kd_bangsal FROM returjual WHERE no_retur_jual=?`, noReturJual).Scan(&kdBangsal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Retur tidak ditemukan"})
			return
		}

		rows, err := db.Query(`SELECT kode_brng, jml_retur FROM detreturjual WHERE no_retur_jual=?`, noReturJual)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type line struct {
			kodeBrng string
			jmlRetur float64
		}
		var lines []line
		for rows.Next() {
			var l line
			if rows.Scan(&l.kodeBrng, &l.jmlRetur) == nil {
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
			if err := catatRiwayatBarangMedis(tx, l.kodeBrng, 0, l.jmlRetur, "Retur Jual", petugas, kdBangsal, "Hapus", "", "", noReturJual); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				l.jmlRetur, l.kodeBrng, kdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`DELETE FROM returjual WHERE no_retur_jual=?`, noReturJual); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Retur berhasil dihapus, stok sistem sudah dikembalikan"})
	}
}
