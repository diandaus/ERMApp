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
// APOTEK — Retur ke Suplier (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgReturBeli.java — kebalikan dari Penerimaan
// (DlgPembelian.java): barang yang SUDAH diterima dari suplier dikembalikan
// (misalnya rusak/kadaluwarsa/salah kirim), MENGURANGI stok, direferensikan
// ke `no_faktur` pembelian asal per baris.
//
// Tabel:
//   returbeli (no_retur_beli PK, tgl_retur, nip, kode_suplier, kd_bangsal)
//   detreturbeli (no_retur_beli, no_faktur, kode_brng, kode_sat, h_beli,
//     jml_beli, h_retur, jml_retur, total, no_batch, jml_retur2 — FK
//     no_retur_beli ON DELETE CASCADE ke returbeli, jadi hapus riwayat
//     cukup DELETE ke returbeli saja, sama seperti pola detailbeli/pembelian
//     di apotek_penerimaan_handler.go).
//
// **Rumus per baris**: total = jml_retur * h_retur.
//
// **No. Retur** digenerate SERVER-SIDE: prefix "RB"+YYYYMMDD, 3 digit urut
// per tanggal (MAX(RIGHT(no_retur_beli,3))+1) — pola sama persis
// generateNoFakturPenerimaan di apotek_penerimaan_handler.go.
//
// **Validasi stok saat submit**: TIDAK seperti Penerimaan (yang boleh minus
// saat hapus, karena itu revert historis), retur di sini adalah keluarnya
// barang FISIK ke suplier — divalidasi stok saat ini >= jml_retur per
// baris, sama prinsipnya dengan submitMutasi di apotek_mutasi_handler.go
// (transaksi yang benar-benar memindahkan/mengeluarkan barang tidak boleh
// bikin stok minus).
//
// **Penyederhanaan yang disengaja** (pola sama modul lain): tanpa integrasi
// Jurnal/akuntansi, tanpa konversi satuan besar/kecil, tanpa pelacakan
// batch (`no_batch` selalu ''), posisi riwayat_barang_medis = "Retur Beli"
// (enum Khanza asli, lihat POSISI_OPTIONS di ApotekRiwayatBarangMedis.tsx).
// ============================================================================

type returBeliBarangOpsi struct {
	NoFaktur string  `json:"no_faktur"`
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Satuan   string  `json:"satuan"`
	HBeli    float64 `json:"h_beli"`
	JmlBeli  float64 `json:"jml_beli"`
	Stok     float64 `json:"stok"`
}

// getReturBeliBarangOpsi mencari baris pembelian (per suplier+lokasi) yang
// bisa diretur — padanan tampil daftar barang di DlgReturBeli.java yang
// mengacu ke detailbeli milik faktur-faktur suplier tsb.
func getReturBeliBarangOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeSuplier := strings.TrimSpace(c.Query("kode_suplier"))
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal"))
		search := strings.TrimSpace(c.Query("search"))
		if kodeSuplier == "" || kdBangsal == "" {
			c.JSON(http.StatusOK, []returBeliBarangOpsi{})
			return
		}

		query := `
			SELECT d.no_faktur, d.kode_brng, COALESCE(b.nama_brng,''), d.kode_sat, COALESCE(s.satuan,''),
				d.h_beli, d.jumlah, COALESCE(gb.stok,0)
			FROM detailbeli d
			INNER JOIN pembelian p ON p.no_faktur = d.no_faktur
			LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
			LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
			LEFT JOIN gudangbarang gb ON gb.kode_brng = d.kode_brng AND gb.kd_bangsal = p.kd_bangsal AND gb.no_batch = '' AND gb.no_faktur = ''
			WHERE p.kode_suplier = ? AND p.kd_bangsal = ?
		`
		args := []interface{}{kodeSuplier, kdBangsal}
		if search != "" {
			query += " AND (d.kode_brng LIKE ? OR b.nama_brng LIKE ? OR d.no_faktur LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY p.tgl_beli DESC, d.kode_brng"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []returBeliBarangOpsi{}
		for rows.Next() {
			var it returBeliBarangOpsi
			if rows.Scan(&it.NoFaktur, &it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan, &it.HBeli, &it.JmlBeli, &it.Stok) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoReturBeli meniru pola autoNomor() di generateNoFakturPenerimaan:
// prefix "RB"+YYYYMMDD, 3 digit urut per tanggal. Dipanggil DALAM transaksi.
func generateNoReturBeli(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "RB" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_retur_beli,3) AS UNSIGNED)),0) FROM returbeli WHERE tgl_retur=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

type returBeliSubmitItem struct {
	NoFaktur string  `json:"no_faktur"`
	KodeBrng string  `json:"kode_brng"`
	KodeSat  string  `json:"kode_sat"`
	HBeli    float64 `json:"h_beli"`
	JmlBeli  float64 `json:"jml_beli"`
	HRetur   float64 `json:"h_retur"`
	JmlRetur float64 `json:"jml_retur"`
}

// submitReturBeli mencatat retur baru DAN langsung mengurangi stok —
// padanan BtnSimpanActionPerformed di DlgReturBeli.java.
func submitReturBeli(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KodeSuplier string                 `json:"kode_suplier"`
			Nip         string                 `json:"nip"`
			Tanggal     string                 `json:"tanggal"`
			KdBangsal   string                 `json:"kd_bangsal"`
			Petugas     string                 `json:"petugas"`
			Items       []returBeliSubmitItem `json:"items"`
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
		items := make([]returBeliSubmitItem, 0, len(body.Items))
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

		noReturBeli, err := generateNoReturBeli(tx, body.Tanggal)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var namaSuplier string
		tx.QueryRow(`SELECT nama_suplier FROM datasuplier WHERE kode_suplier=?`, body.KodeSuplier).Scan(&namaSuplier)

		if _, err := tx.Exec(
			`INSERT INTO returbeli (no_retur_beli, tgl_retur, nip, kode_suplier, kd_bangsal) VALUES (?, ?, ?, ?, ?)`,
			noReturBeli, body.Tanggal, body.Nip, body.KodeSuplier, body.KdBangsal,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var totalRetur float64
		for _, it := range items {
			var namaBrng string
			var stokSaatIni float64
			err := tx.QueryRow(
				`SELECT COALESCE(b.nama_brng,''), COALESCE(gb.stok,0) FROM databarang b
				 LEFT JOIN gudangbarang gb ON gb.kode_brng = b.kode_brng AND gb.kd_bangsal = ? AND gb.no_batch = '' AND gb.no_faktur = ''
				 WHERE b.kode_brng = ?`,
				body.KdBangsal, it.KodeBrng,
			).Scan(&namaBrng, &stokSaatIni)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if stokSaatIni < it.JmlRetur {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Stok %s tidak cukup untuk retur (stok saat ini: %g)", namaBrng, stokSaatIni)})
				return
			}

			total := it.JmlRetur * it.HRetur
			totalRetur += total
			if _, err := tx.Exec(
				`INSERT INTO detreturbeli (no_retur_beli, no_faktur, kode_brng, kode_sat, h_beli, jml_beli, h_retur, jml_retur, total, no_batch, jml_retur2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
				noReturBeli, it.NoFaktur, it.KodeBrng, it.KodeSat, it.HBeli, it.JmlBeli, it.HRetur, it.JmlRetur, total, it.JmlRetur,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			keteranganRiwayat := strings.TrimSpace(fmt.Sprintf("%s %s (dari %s)", noReturBeli, namaSuplier, it.NoFaktur))
			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, 0, it.JmlRetur, "Retur Beli", body.Petugas, body.KdBangsal, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.JmlRetur, it.KodeBrng, body.KdBangsal,
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
		c.JSON(http.StatusOK, gin.H{"message": "Retur berhasil disimpan, stok sudah dikurangi", "no_retur_beli": noReturBeli, "total_retur": totalRetur})
	}
}

type returBeliDetailItem struct {
	NoFaktur string  `json:"no_faktur"`
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	Satuan   string  `json:"satuan"`
	HBeli    float64 `json:"h_beli"`
	JmlBeli  float64 `json:"jml_beli"`
	HRetur   float64 `json:"h_retur"`
	JmlRetur float64 `json:"jml_retur"`
	Total    float64 `json:"total"`
}

type returBeliRiwayat struct {
	NoReturBeli string                 `json:"no_retur_beli"`
	Tanggal     string                 `json:"tanggal"`
	KodeSuplier string                 `json:"kode_suplier"`
	NamaSuplier string                 `json:"nama_suplier"`
	Nip         string                 `json:"nip"`
	NamaPetugas string                 `json:"nama_petugas"`
	KdBangsal   string                 `json:"kd_bangsal"`
	NmBangsal   string                 `json:"nm_bangsal"`
	Total       float64                `json:"total"`
	Items       []returBeliDetailItem `json:"items"`
}

// getReturBeliRiwayat — daftar retur + item per baris (embed), default 30
// hari terakhir — padanan tampil() di DlgCariReturBeli.java.
func getReturBeliRiwayat(db *sql.DB) gin.HandlerFunc {
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
			SELECT r.no_retur_beli, r.tgl_retur, r.kode_suplier, COALESCE(sp.nama_suplier,''), r.nip, COALESCE(pg.nama,''),
				r.kd_bangsal, COALESCE(b.nm_bangsal,'')
			FROM returbeli r
			LEFT JOIN datasuplier sp ON sp.kode_suplier = r.kode_suplier
			LEFT JOIN petugas pg ON pg.nip = r.nip
			LEFT JOIN bangsal b ON b.kd_bangsal = r.kd_bangsal
			WHERE r.tgl_retur BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND r.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if kodeSuplier != "" {
			query += " AND r.kode_suplier = ?"
			args = append(args, kodeSuplier)
		}
		if search != "" {
			query += " AND (r.no_retur_beli LIKE ? OR sp.nama_suplier LIKE ? OR pg.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY r.tgl_retur DESC, r.no_retur_beli DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []returBeliRiwayat{}
		for rows.Next() {
			var r returBeliRiwayat
			if rows.Scan(&r.NoReturBeli, &r.Tanggal, &r.KodeSuplier, &r.NamaSuplier, &r.Nip, &r.NamaPetugas,
				&r.KdBangsal, &r.NmBangsal) == nil {
				r.Items = []returBeliDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.no_faktur, d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.h_beli, d.jml_beli, d.h_retur, d.jml_retur, d.total
				 FROM detreturbeli d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.no_retur_beli = ? ORDER BY d.kode_brng`,
				list[i].NoReturBeli,
			)
			if err != nil {
				continue
			}
			for itemRows.Next() {
				var it returBeliDetailItem
				if itemRows.Scan(&it.NoFaktur, &it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.HBeli, &it.JmlBeli, &it.HRetur, &it.JmlRetur, &it.Total) == nil {
					list[i].Items = append(list[i].Items, it)
					list[i].Total += it.Total
				}
			}
			itemRows.Close()
		}

		c.JSON(http.StatusOK, list)
	}
}

// deleteReturBeli — hapus riwayat retur DAN revert stok (tambah balik
// jumlah yang pernah diretur) — padanan ppHapusActionPerformed di
// DlgCariReturBeli.java. detreturbeli terhapus otomatis lewat FK ON DELETE
// CASCADE, tidak perlu DELETE manual terpisah.
func deleteReturBeli(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noReturBeli := c.Param("no_retur_beli")
		petugas := c.Query("petugas")

		var kdBangsal string
		if err := db.QueryRow(`SELECT kd_bangsal FROM returbeli WHERE no_retur_beli=?`, noReturBeli).Scan(&kdBangsal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Retur tidak ditemukan"})
			return
		}

		rows, err := db.Query(`SELECT kode_brng, no_faktur, jml_retur FROM detreturbeli WHERE no_retur_beli=?`, noReturBeli)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type line struct {
			kodeBrng string
			noFaktur string
			jmlRetur float64
		}
		var lines []line
		for rows.Next() {
			var l line
			if rows.Scan(&l.kodeBrng, &l.noFaktur, &l.jmlRetur) == nil {
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
			keteranganRiwayat := strings.TrimSpace(fmt.Sprintf("%s (dari %s)", noReturBeli, l.noFaktur))
			if err := catatRiwayatBarangMedis(tx, l.kodeBrng, l.jmlRetur, 0, "Retur Beli", petugas, kdBangsal, "Hapus", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				l.jmlRetur, l.kodeBrng, kdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`DELETE FROM returbeli WHERE no_retur_beli=?`, noReturBeli); err != nil {
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
