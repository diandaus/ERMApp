package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Pemesanan (Surat Pemesanan ke Supplier). Cocok dengan
// inventory/InventorySuratPemesanan.java (form buat surat pemesanan, satu-
// satunya yang punya tombol Simpan) + inventory/DlgCariSuratPemesanan.java
// (daftar riwayat pemesanan).
//
// BEDA MENDASAR dari Penerimaan (apotek_penerimaan_handler.go): Pemesanan
// hanyalah DOKUMEN PERMINTAAN BARANG ke supplier — TIDAK PERNAH mengubah
// stok (`gudangbarang`) sama sekali, persis Java (BtnSimpanActionPerformed
// di InventorySuratPemesanan.java tidak menyentuh gudangbarang atau
// Trackobat sedikit pun). Stok baru bertambah nanti saat barang betul-betul
// diterima lewat alur Penerimaan (`pembelian`/`detailbeli`) yang terpisah.
// Field `status` ('Proses Pesan' -> 'Sudah Datang') di sini murni penanda
// administratif progres pemesanan, TIDAK otomatis terhubung/trigger apa pun
// ke tabel Penerimaan — user tetap input Penerimaan secara manual saat
// barang datang (sama seperti Khanza: kedua dialog itu independen, tidak
// ada FK atau kode yang menghubungkan keduanya).
//
// **Rumus per baris** (persis tampil2()/BtnSimpanActionPerformed di
// InventorySuratPemesanan.java):
//   subtotal = jumlah * h_pesan
//   besardis = subtotal * (dis% / 100)
//   total    = subtotal - besardis
// **Rumus header**:
//   total1 (subtotal)  = SUM(subtotal semua baris)
//   potongan           = SUM(besardis semua baris)
//   total2             = total1 - potongan
//   ppn                = (ppn% / 100) * total2
//   tagihan            = total2 + ppn + meterai
//
// Tabel:
//   surat_pemesanan_medis (no_pemesanan PK, kode_suplier, nip, tanggal,
//     total1, potongan, total2, ppn, meterai, tagihan, status)
//   detail_surat_pemesanan_medis (no_pemesanan, kode_brng, kode_sat,
//     jumlah, h_pesan, subtotal, dis, besardis, total, jumlah2 — FK
//     no_pemesanan ON DELETE CASCADE ke surat_pemesanan_medis, jadi hapus
//     riwayat cukup DELETE tabel induk saja, sama pola dengan
//     pembelian/detailbeli).
//
// **No.Pemesanan** digenerate SERVER-SIDE, rumus identik autoNomor() di
// Java: prefix "SPM"+YYMMDD (urutan tahun-bulan-tanggal, BUKAN
// tanggal-bulan-tahun — dikonfirmasi lewat data riil di DB, mis.
// "SPM260225001" untuk tanggal 2026-02-25), 3 digit urut per tanggal
// (MAX(RIGHT(no_pemesanan,3))+1), dalam transaksi yang sama dengan INSERT.
//
// **Penyederhanaan yang disengaja** (pola sama modul lain):
//   - TIDAK ada konversi satuan besar/kecil (SatuanBeli/isi/isibesar di
//     Java tbDokter kolom 1/11/12, dipakai buat konversi dus->pcs) — harga
//     & jumlah selalu dalam satuan dasar `databarang.kode_sat`, `jumlah2`
//     (kolom "Jml.Stok" Java) selalu SAMA dengan `jumlah`, sama pola
//     dengan Penerimaan.
//   - TIDAK ada cetak Jasper dgn tanda tangan ganda Apoteker+Kabid.Keu
//     (BtnPrint5ActionPerformed, pakai DlgCariPegawai picker) — cetak di
//     sini pola print-HTML browser yang sudah dipakai modul lain
//     (DetailPemberianObat.tsx dkk), tanda tangan cukup satu (petugas yang
//     sedang login), tanpa QR/e-signature karena surat pemesanan ini
//     dokumen internal ke supplier, bukan dokumen medis pasien.
// ============================================================================

// ensurePemesananTable — migrasi kolom TAMBAHAN di tabel Khanza yang
// sudah ada (surat_pemesanan_medis/detail_surat_pemesanan_medis TIDAK
// dibuat oleh app ini, jadi TIDAK ada CREATE TABLE di sini, cuma ALTER
// TABLE ADD COLUMN IF NOT EXISTS, sama pola dengan ensureSettingsTable):
//   - surat_pemesanan_medis.jenis_surat — 'obat_tertentu' atau
//     'prekursor', field baru yang TIDAK ada padanannya di Khanza (Java
//     tidak membedakan 2 jenis surat ini), dipakai supaya "Cari Surat
//     Pemesanan" tahu format tabel/cetak mana yang harus dipakai saat
//     menampilkan ulang riwayat.
//   - detail_surat_pemesanan_medis.zat_aktif_json — daftar {zat_aktif,
//     bentuk_kekuatan} per baris obat, disimpan sebagai JSON (BUKAN
//     tabel anak terpisah) karena satu obat kombinasi (mis. pseudoefedrin
//     HCl + triprolidin) bisa punya >1 pasangan zat aktif, dan data ini
//     PURE tampilan/cetak (tidak pernah di-query/filter terpisah), jadi
//     JSON di satu kolom lebih sederhana daripada bikin tabel relasi
//     baru untuk data yang aksesnya SELALU utuh per-baris.
func ensurePemesananTable(db *sql.DB) error {
	if _, err := db.Exec(
		`ALTER TABLE surat_pemesanan_medis ADD COLUMN IF NOT EXISTS jenis_surat VARCHAR(20) NOT NULL DEFAULT 'obat_tertentu'`,
	); err != nil {
		return err
	}
	if _, err := db.Exec(
		`ALTER TABLE detail_surat_pemesanan_medis ADD COLUMN IF NOT EXISTS zat_aktif_json TEXT NULL`,
	); err != nil {
		return err
	}
	// kode_industri — pihak yang DITUJU surat (industrifarmasi/PBF),
	// padanan kolom "Nama Industri Farmasi" di layar cari-industri
	// InventorySuratPemesanan.java, TAPI BUKAN kode_suplier (yang FK ke
	// datasuplier, namespace kode beda — "S0001" vs "I0001"). Nullable,
	// TANPA FK constraint eksplisit (pola sama kolom tambahan lain di app
	// ini) supaya ALTER TABLE ini aman diulang tanpa perlu menangani
	// constraint-already-exists di MySQL versi lama.
	if _, err := db.Exec(
		`ALTER TABLE surat_pemesanan_medis ADD COLUMN IF NOT EXISTS kode_industri CHAR(5) DEFAULT NULL`,
	); err != nil {
		return err
	}
	return nil
}

type pemesananIndustriOpsi struct {
	KodeIndustri string `json:"kode_industri"`
	NamaIndustri string `json:"nama_industri"`
	Alamat       string `json:"alamat"`
	Kota         string `json:"kota"`
	NoTelp       string `json:"no_telp"`
}

// getPemesananIndustriOpsi — daftar Industri Farmasi/PBF yang bisa
// dituju surat pesanan, padanan PERSIS query tampil() picker "Cari
// Industri Farmasi" di InventorySuratPemesanan.java (select * from
// industrifarmasi order by nama_industri) — sengaja TIDAK ditambah
// filter status/aktif supaya perilaku sama dengan Java (tabel
// industrifarmasi memang tidak punya kolom status).
func getPemesananIndustriOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT kode_industri, COALESCE(nama_industri,''), COALESCE(alamat,''), COALESCE(kota,''), COALESCE(no_telp,'') FROM industrifarmasi`
		args := []interface{}{}
		if search != "" {
			query += " WHERE (kode_industri LIKE ? OR nama_industri LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY nama_industri"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []pemesananIndustriOpsi{}
		for rows.Next() {
			var it pemesananIndustriOpsi
			if rows.Scan(&it.KodeIndustri, &it.NamaIndustri, &it.Alamat, &it.Kota, &it.NoTelp) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// zatAktifLine — satu pasang Zat Aktif + Bentuk/Kekuatan Sediaan,
// dipakai baik saat submit (dari form) maupun saat baca riwayat (utk
// cetak ulang). Lihat catatan zat_aktif_json di ensurePemesananTable.
type zatAktifLine struct {
	ZatAktif       string `json:"zat_aktif"`
	BentukKekuatan string `json:"bentuk_kekuatan"`
}

type pemesananBarangOpsi struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	KodeSat   string  `json:"kode_sat"`
	Satuan    string  `json:"satuan"`
	HBeli     float64 `json:"h_beli"`
	Kapasitas float64 `json:"kapasitas"`
}

func getPemesananBarangOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT b.kode_brng, b.nama_brng, b.kode_sat, COALESCE(s.satuan,''), b.h_beli, b.kapasitas
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
		items := []pemesananBarangOpsi{}
		for rows.Next() {
			var it pemesananBarangOpsi
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan, &it.HBeli, &it.Kapasitas) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoPemesanan meniru autoNomor() di InventorySuratPemesanan.java:
// prefix "SPM"+YYMMDD, 3 digit urut per tanggal. Dipanggil di DALAM
// transaksi (pakai tx) supaya konsisten dengan INSERT yang menyusul.
func generateNoPemesanan(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "SPM" + t.Format("060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_pemesanan,3) AS UNSIGNED)),0) FROM surat_pemesanan_medis WHERE tanggal=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

// getPemesananNextNo — preview No.Surat berikutnya (rumus sama dengan
// generateNoPemesanan) SUPAYA field "No. Surat" di form bisa langsung
// terisi otomatis begitu tanggal dipilih, TANPA transaksi/insert (murni
// query baca). Nomor final tetap divalidasi ulang saat submitPemesanan
// (kolom no_pemesanan PK), jadi race condition antar dua user yang
// menyimpan bersamaan pada tanggal sama akan gagal dengan pesan jelas,
// bukan bikin data korup.
func getPemesananNextNo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		if tanggal == "" {
			tanggal = time.Now().Format("2006-01-02")
		}
		t, err := time.Parse("2006-01-02", tanggal)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
		prefix := "SPM" + t.Format("060102")
		var maxSuffix int
		if err := db.QueryRow(
			`SELECT IFNULL(MAX(CAST(RIGHT(no_pemesanan,3) AS UNSIGNED)),0) FROM surat_pemesanan_medis WHERE tanggal=?`,
			tanggal,
		).Scan(&maxSuffix); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"no_pemesanan": fmt.Sprintf("%s%03d", prefix, maxSuffix+1)})
	}
}

type pemesananSubmitItem struct {
	KodeBrng     string         `json:"kode_brng"`
	KodeSat      string         `json:"kode_sat"`
	Jumlah       float64        `json:"jumlah"`
	HPesan       float64        `json:"h_pesan"`
	Dis          float64        `json:"dis"`
	ZatAktifList []zatAktifLine `json:"zat_aktif_list"`
}

// submitPemesanan mencatat surat pemesanan baru — padanan
// BtnSimpanActionPerformed di InventorySuratPemesanan.java. TIDAK
// menyentuh stok sama sekali (lihat catatan besar di atas).
func submitPemesanan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NoPemesanan  string                `json:"no_pemesanan"`
			JenisSurat   string                `json:"jenis_surat"`
			KodeIndustri string                `json:"kode_industri"`
			Nip          string                `json:"nip"`
			Tanggal      string                `json:"tanggal"`
			PpnPercent   float64               `json:"ppn_percent"`
			Meterai      float64               `json:"meterai"`
			Items        []pemesananSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if body.JenisSurat != "obat_tertentu" && body.JenisSurat != "prekursor" {
			body.JenisSurat = "obat_tertentu"
		}
		if strings.TrimSpace(body.KodeIndustri) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama Industri yang dituju wajib diisi"})
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
		items := make([]pemesananSubmitItem, 0, len(body.Items))
		for _, it := range body.Items {
			if it.Jumlah > 0 {
				items = append(items, it)
			}
		}
		if len(items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah pemesanannya"})
			return
		}

		var total1, potongan float64
		type computedItem struct {
			it       pemesananSubmitItem
			subtotal float64
			besardis float64
			total    float64
		}
		computed := make([]computedItem, 0, len(items))
		for _, it := range items {
			subtotal := it.Jumlah * it.HPesan
			besardis := subtotal * (it.Dis / 100)
			total := subtotal - besardis
			total1 += subtotal
			potongan += besardis
			computed = append(computed, computedItem{it, subtotal, besardis, total})
		}
		total2 := total1 - potongan
		ppn := (body.PpnPercent / 100) * total2
		tagihan := total2 + ppn + body.Meterai

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		noPemesanan := strings.TrimSpace(body.NoPemesanan)
		if noPemesanan == "" {
			noPemesanan, err = generateNoPemesanan(tx, body.Tanggal)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		} else {
			var exists int
			tx.QueryRow(`SELECT COUNT(*) FROM surat_pemesanan_medis WHERE no_pemesanan=?`, noPemesanan).Scan(&exists)
			if exists > 0 {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "No. Surat " + noPemesanan + " sudah dipakai, silakan ganti nomor"})
				return
			}
		}

		if _, err := tx.Exec(
			`INSERT INTO surat_pemesanan_medis (no_pemesanan, kode_industri, nip, tanggal, total1, potongan, total2, ppn, meterai, tagihan, status, jenis_surat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Proses Pesan', ?)`,
			noPemesanan, body.KodeIndustri, body.Nip, body.Tanggal, total1, potongan, total2, ppn, body.Meterai, tagihan, body.JenisSurat,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		for _, ci := range computed {
			// Baris zat aktif kosong (zat_aktif & bentuk_kekuatan dua-duanya
			// blank) tidak disimpan — biasanya cuma placeholder baris pertama
			// yang tidak sempat diisi user.
			lines := make([]zatAktifLine, 0, len(ci.it.ZatAktifList))
			for _, l := range ci.it.ZatAktifList {
				if strings.TrimSpace(l.ZatAktif) == "" && strings.TrimSpace(l.BentukKekuatan) == "" {
					continue
				}
				lines = append(lines, l)
			}
			var zatAktifJSON interface{}
			if len(lines) > 0 {
				b, err := json.Marshal(lines)
				if err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				zatAktifJSON = string(b)
			}

			if _, err := tx.Exec(
				`INSERT INTO detail_surat_pemesanan_medis (no_pemesanan, kode_brng, kode_sat, jumlah, h_pesan, subtotal, dis, besardis, total, jumlah2, zat_aktif_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				noPemesanan, ci.it.KodeBrng, ci.it.KodeSat, ci.it.Jumlah, ci.it.HPesan, ci.subtotal, ci.it.Dis, ci.besardis, ci.total, ci.it.Jumlah, zatAktifJSON,
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
		c.JSON(http.StatusOK, gin.H{"message": "Surat pemesanan berhasil disimpan", "no_pemesanan": noPemesanan, "tagihan": tagihan})
	}
}

type pemesananDetailItem struct {
	KodeBrng     string         `json:"kode_brng"`
	NamaBrng     string         `json:"nama_brng"`
	Satuan       string         `json:"satuan"`
	Jumlah       float64        `json:"jumlah"`
	HPesan       float64        `json:"h_pesan"`
	Subtotal     float64        `json:"subtotal"`
	Dis          float64        `json:"dis"`
	Besardis     float64        `json:"besardis"`
	Total        float64        `json:"total"`
	ZatAktifList []zatAktifLine `json:"zat_aktif_list"`
}

type pemesananRiwayat struct {
	NoPemesanan    string                `json:"no_pemesanan"`
	JenisSurat     string                `json:"jenis_surat"`
	Tanggal        string                `json:"tanggal"`
	KodeIndustri   string                `json:"kode_industri"`
	NamaIndustri   string                `json:"nama_industri"`
	AlamatIndustri string                `json:"alamat_industri"`
	KotaIndustri   string                `json:"kota_industri"`
	TelpIndustri   string                `json:"telp_industri"`
	Nip            string                `json:"nip"`
	NamaPetugas    string                `json:"nama_petugas"`
	AlamatPetugas  string                `json:"alamat_petugas"`
	JabatanPetugas string                `json:"jabatan_petugas"`
	SipaPetugas    string                `json:"sipa_petugas"`
	Total1         float64               `json:"total1"`
	Potongan       float64               `json:"potongan"`
	Total2         float64               `json:"total2"`
	Ppn            float64               `json:"ppn"`
	Meterai        float64               `json:"meterai"`
	Tagihan        float64               `json:"tagihan"`
	Status         string                `json:"status"`
	Items          []pemesananDetailItem `json:"items"`
}

// getPemesananRiwayat — daftar surat pemesanan + item per baris (embed) —
// padanan tampil() di DlgCariSuratPemesanan.java, disederhanakan jadi JSON
// terstruktur bersih (bukan flat fake-row JTable seperti Java) + filter
// rentang tanggal/supplier/petugas/status/cari bebas. Default 30 hari
// terakhir.
func getPemesananRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		kodeIndustri := strings.TrimSpace(c.Query("kode_industri"))
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT sp.no_pemesanan, sp.jenis_surat, sp.tanggal,
				sp.kode_industri, COALESCE(ind.nama_industri,''), COALESCE(ind.alamat,''), COALESCE(ind.kota,''), COALESCE(ind.no_telp,''),
				sp.nip, COALESCE(pg.nama,''), COALESCE(pg.alamat,''), COALESCE(jb.nm_jbtn,''), COALESCE(pe.str_sipa,''),
				sp.total1, sp.potongan, sp.total2, sp.ppn, sp.meterai, sp.tagihan, sp.status
			FROM surat_pemesanan_medis sp
			LEFT JOIN industrifarmasi ind ON ind.kode_industri = sp.kode_industri
			LEFT JOIN petugas pg ON pg.nip = sp.nip
			LEFT JOIN jabatan jb ON jb.kd_jbtn = pg.kd_jbtn
			LEFT JOIN petugas_ext pe ON pe.nip = pg.nip
			WHERE sp.tanggal BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kodeIndustri != "" {
			query += " AND sp.kode_industri = ?"
			args = append(args, kodeIndustri)
		}
		if status != "" {
			query += " AND sp.status = ?"
			args = append(args, status)
		}
		if search != "" {
			query += " AND (sp.no_pemesanan LIKE ? OR ind.nama_industri LIKE ? OR pg.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY sp.tanggal DESC, sp.no_pemesanan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []pemesananRiwayat{}
		for rows.Next() {
			var r pemesananRiwayat
			var kodeIndustriN sql.NullString
			if rows.Scan(&r.NoPemesanan, &r.JenisSurat, &r.Tanggal,
				&kodeIndustriN, &r.NamaIndustri, &r.AlamatIndustri, &r.KotaIndustri, &r.TelpIndustri,
				&r.Nip, &r.NamaPetugas, &r.AlamatPetugas, &r.JabatanPetugas, &r.SipaPetugas,
				&r.Total1, &r.Potongan, &r.Total2, &r.Ppn, &r.Meterai, &r.Tagihan, &r.Status) == nil {
				r.KodeIndustri = kodeIndustriN.String
				r.Items = []pemesananDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.jumlah, d.h_pesan, d.subtotal, d.dis, d.besardis, d.total, d.zat_aktif_json
				 FROM detail_surat_pemesanan_medis d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.no_pemesanan = ? ORDER BY d.kode_brng`,
				list[i].NoPemesanan,
			)
			if err != nil {
				continue
			}
			for itemRows.Next() {
				var it pemesananDetailItem
				var zatAktifJSON sql.NullString
				if itemRows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.Jumlah, &it.HPesan, &it.Subtotal, &it.Dis, &it.Besardis, &it.Total, &zatAktifJSON) == nil {
					it.ZatAktifList = []zatAktifLine{}
					if zatAktifJSON.Valid && zatAktifJSON.String != "" {
						json.Unmarshal([]byte(zatAktifJSON.String), &it.ZatAktifList)
					}
					list[i].Items = append(list[i].Items, it)
				}
			}
			itemRows.Close()
		}

		c.JSON(http.StatusOK, list)
	}
}

// updateStatusPemesanan menandai surat pemesanan sebagai "Sudah Datang" —
// murni penanda administratif, TIDAK mengubah stok (lihat catatan besar
// di atas berkas ini).
func updateStatusPemesanan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPemesanan := c.Param("no_pemesanan")
		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || (body.Status != "Proses Pesan" && body.Status != "Sudah Datang") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid"})
			return
		}
		res, err := db.Exec(`UPDATE surat_pemesanan_medis SET status=? WHERE no_pemesanan=?`, body.Status, noPemesanan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat pemesanan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status berhasil diperbarui"})
	}
}

// deletePemesanan — hapus surat pemesanan. detail_surat_pemesanan_medis
// terhapus otomatis lewat FK ON DELETE CASCADE, tidak perlu DELETE manual
// terpisah (sama pola dengan Penerimaan). Tidak ada revert stok karena
// Pemesanan memang tidak pernah mengubah stok.
func deletePemesanan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPemesanan := c.Param("no_pemesanan")
		res, err := db.Exec(`DELETE FROM surat_pemesanan_medis WHERE no_pemesanan=?`, noPemesanan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat pemesanan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Surat pemesanan berhasil dihapus"})
	}
}
