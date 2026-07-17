package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Data Barang (tabel Khanza asli `databarang`, master item obat/
// BHP/alkes). Dipakai tab "Data Barang" di modul Apotek
// (frontend/src/modules/Apotek.tsx). Referensi kode terkait yang sudah ada
// di skema Khanza: kodesatuan (satuan besar & kecil), jenis (kdjns),
// industrifarmasi, kategori_barang, golongan_barang, dan gudangbarang untuk
// total stok saat ini (SUM per kode_brng, lintas bangsal/batch).
// ============================================================================

// DataBarang merepresentasikan satu baris databarang, ditambah field
// tampilan hasil JOIN (nama satuan/jenis/industri/kategori/golongan, total
// stok) yang read-only — tidak ikut disimpan saat create/update.
type DataBarang struct {
	KodeBrng     string  `json:"kode_brng"`
	NamaBrng     string  `json:"nama_brng"`
	KodeSatBesar string  `json:"kode_satbesar"`
	KodeSat      string  `json:"kode_sat"`
	LetakBarang  string  `json:"letak_barang"`
	Dasar        float64 `json:"dasar"`
	HBeli        float64 `json:"h_beli"`
	Ralan        float64 `json:"ralan"`
	Kelas1       float64 `json:"kelas1"`
	Kelas2       float64 `json:"kelas2"`
	Kelas3       float64 `json:"kelas3"`
	Utama        float64 `json:"utama"`
	Vip          float64 `json:"vip"`
	Vvip         float64 `json:"vvip"`
	BeliLuar     float64 `json:"beliluar"`
	JualBebas    float64 `json:"jualbebas"`
	Karyawan     float64 `json:"karyawan"`
	StokMinimal  float64 `json:"stokminimal"`
	Kdjns        string  `json:"kdjns"`
	Isi          float64 `json:"isi"`
	Kapasitas    float64 `json:"kapasitas"`
	Expire       string  `json:"expire"`
	Status       string  `json:"status"`
	KodeIndustri string  `json:"kode_industri"`
	KodeKategori string  `json:"kode_kategori"`
	KodeGolongan string  `json:"kode_golongan"`

	// Field tampilan (hasil JOIN), read-only.
	NamaSatBesar string  `json:"nama_satbesar"`
	NamaSat      string  `json:"nama_sat"`
	NamaJenis    string  `json:"nama_jenis"`
	NamaIndustri string  `json:"nama_industri"`
	NamaKategori string  `json:"nama_kategori"`
	NamaGolongan string  `json:"nama_golongan"`
	TotalStok    float64 `json:"total_stok"`
}

// getDataBarangList menampilkan daftar Data Barang, dengan pencarian
// kode/nama dan filter status. Total stok dihitung live dari gudangbarang
// (SUM lintas bangsal & batch) supaya daftar ini juga berguna sebagai
// gambaran stok kasar tanpa perlu buka tab Stok Opname.
func getDataBarangList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		status := c.Query("status")

		query := `
			SELECT b.kode_brng, b.nama_brng, b.kode_satbesar, b.kode_sat, COALESCE(b.letak_barang,''),
				b.dasar, b.h_beli, b.ralan, b.kelas1, b.kelas2, b.kelas3, b.utama, b.vip, b.vvip,
				b.beliluar, b.jualbebas, b.karyawan, b.stokminimal, COALESCE(b.kdjns,''), b.isi, b.kapasitas,
				COALESCE(b.expire, '0000-00-00'), b.status, COALESCE(b.kode_industri,''),
				COALESCE(b.kode_kategori,''), COALESCE(b.kode_golongan,''),
				COALESCE(sb.satuan,''), COALESCE(sk.satuan,''), COALESCE(j.nama,''), COALESCE(ind.nama_industri,''),
				COALESCE(kat.nama,''), COALESCE(gol.nama,''), COALESCE(stok.total_stok, 0)
			FROM databarang b
			LEFT JOIN kodesatuan sb ON sb.kode_sat = b.kode_satbesar
			LEFT JOIN kodesatuan sk ON sk.kode_sat = b.kode_sat
			LEFT JOIN jenis j ON j.kdjns = b.kdjns
			LEFT JOIN industrifarmasi ind ON ind.kode_industri = b.kode_industri
			LEFT JOIN kategori_barang kat ON kat.kode = b.kode_kategori
			LEFT JOIN golongan_barang gol ON gol.kode = b.kode_golongan
			LEFT JOIN (SELECT kode_brng, SUM(stok) AS total_stok FROM gudangbarang GROUP BY kode_brng) stok
				ON stok.kode_brng = b.kode_brng
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		if status != "" {
			query += " AND b.status = ?"
			args = append(args, status)
		}
		query += " ORDER BY b.nama_brng LIMIT 500"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []DataBarang{}
		for rows.Next() {
			var b DataBarang
			if err := rows.Scan(
				&b.KodeBrng, &b.NamaBrng, &b.KodeSatBesar, &b.KodeSat, &b.LetakBarang,
				&b.Dasar, &b.HBeli, &b.Ralan, &b.Kelas1, &b.Kelas2, &b.Kelas3, &b.Utama, &b.Vip, &b.Vvip,
				&b.BeliLuar, &b.JualBebas, &b.Karyawan, &b.StokMinimal, &b.Kdjns, &b.Isi, &b.Kapasitas,
				&b.Expire, &b.Status, &b.KodeIndustri, &b.KodeKategori, &b.KodeGolongan,
				&b.NamaSatBesar, &b.NamaSat, &b.NamaJenis, &b.NamaIndustri, &b.NamaKategori, &b.NamaGolongan, &b.TotalStok,
			); err != nil {
				continue
			}
			items = append(items, b)
		}
		c.JSON(http.StatusOK, items)
	}
}

// kvRef adalah satu baris tabel referensi kecil (kode + nama), dipakai
// mengisi dropdown di form Data Barang.
type kvRef struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

func queryKvRef(db *sql.DB, query string) []kvRef {
	items := []kvRef{}
	rows, err := db.Query(query)
	if err != nil {
		return items
	}
	defer rows.Close()
	for rows.Next() {
		var k kvRef
		if err := rows.Scan(&k.Kode, &k.Nama); err == nil {
			items = append(items, k)
		}
	}
	return items
}

// getApotekReferensi menampilkan semua tabel referensi kecil yang dipakai
// dropdown form Data Barang, digabung satu response supaya frontend cukup
// sekali panggil saat modal dibuka.
func getApotekReferensi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"satuan":   queryKvRef(db, `SELECT kode_sat, satuan FROM kodesatuan WHERE kode_sat <> '-' ORDER BY satuan`),
			"jenis":    queryKvRef(db, `SELECT kdjns, nama FROM jenis WHERE kdjns <> '-' ORDER BY nama`),
			"industri": queryKvRef(db, `SELECT kode_industri, nama_industri FROM industrifarmasi WHERE kode_industri <> '-' ORDER BY nama_industri`),
			"kategori": queryKvRef(db, `SELECT kode, nama FROM kategori_barang WHERE kode <> '-' ORDER BY nama`),
			"golongan": queryKvRef(db, `SELECT kode, nama FROM golongan_barang WHERE kode <> '-' ORDER BY nama`),
		})
	}
}

// fkOrDash mengembalikan "-" kalau v kosong — kolom referensi di databarang
// (kode_satbesar, kode_sat, kdjns, kode_industri, kode_kategori,
// kode_golongan) semuanya FOREIGN KEY ke tabel referensinya masing-masing
// dan TIDAK BOLEH string kosong, cuma boleh kode asli atau "-" (baris
// placeholder "belum diisi" yang sudah ada di tiap tabel referensi Khanza).
func fkOrDash(v string) string {
	if strings.TrimSpace(v) == "" {
		return "-"
	}
	return v
}

// createDataBarang menambahkan barang baru. kode_brng jadi primary key
// manual (bukan auto increment, sama seperti kode_brng di databarang asli
// Khanza) — dicek dulu belum dipakai.
func createDataBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b DataBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode barang wajib diisi"})
			return
		}
		if strings.TrimSpace(b.NamaBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama barang wajib diisi"})
			return
		}
		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM databarang WHERE kode_brng = ?`, b.KodeBrng).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode barang sudah dipakai"})
			return
		}
		if b.Status == "" {
			b.Status = "1"
		}

		_, err := db.Exec(`
			INSERT INTO databarang (
				kode_brng, nama_brng, kode_satbesar, kode_sat, letak_barang, dasar, h_beli, ralan,
				kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan, stokminimal,
				kdjns, isi, kapasitas, expire, status, kode_industri, kode_kategori, kode_golongan
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			b.KodeBrng, b.NamaBrng, fkOrDash(b.KodeSatBesar), fkOrDash(b.KodeSat), b.LetakBarang, b.Dasar, b.HBeli, b.Ralan,
			b.Kelas1, b.Kelas2, b.Kelas3, b.Utama, b.Vip, b.Vvip, b.BeliLuar, b.JualBebas, b.Karyawan, b.StokMinimal,
			fkOrDash(b.Kdjns), b.Isi, b.Kapasitas, nullIfEmptyDate(b.Expire), b.Status, fkOrDash(b.KodeIndustri), fkOrDash(b.KodeKategori), fkOrDash(b.KodeGolongan),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Barang berhasil ditambahkan"})
	}
}

// updateDataBarang memperbarui barang yang sudah ada. kode_brng (primary
// key) tidak bisa diubah lewat sini.
func updateDataBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode barang wajib diisi"})
			return
		}
		var b DataBarang
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(b.NamaBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama barang wajib diisi"})
			return
		}

		res, err := db.Exec(`
			UPDATE databarang SET
				nama_brng=?, kode_satbesar=?, kode_sat=?, letak_barang=?, dasar=?, h_beli=?, ralan=?,
				kelas1=?, kelas2=?, kelas3=?, utama=?, vip=?, vvip=?, beliluar=?, jualbebas=?, karyawan=?, stokminimal=?,
				kdjns=?, isi=?, kapasitas=?, expire=?, status=?, kode_industri=?, kode_kategori=?, kode_golongan=?
			WHERE kode_brng = ?
		`,
			b.NamaBrng, fkOrDash(b.KodeSatBesar), fkOrDash(b.KodeSat), b.LetakBarang, b.Dasar, b.HBeli, b.Ralan,
			b.Kelas1, b.Kelas2, b.Kelas3, b.Utama, b.Vip, b.Vvip, b.BeliLuar, b.JualBebas, b.Karyawan, b.StokMinimal,
			fkOrDash(b.Kdjns), b.Isi, b.Kapasitas, nullIfEmptyDate(b.Expire), b.Status, fkOrDash(b.KodeIndustri), fkOrDash(b.KodeKategori), fkOrDash(b.KodeGolongan),
			kode,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Barang tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Barang berhasil diperbarui"})
	}
}

// deleteDataBarang menghapus barang — ditolak kalau masih ada baris stok
// (gudangbarang.stok <> 0) supaya tidak ninggalin data mutasi/stok yatim;
// staf disarankan menonaktifkan (status='0') saja lewat updateDataBarang
// untuk kasus itu.
func deleteDataBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		if kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode barang wajib diisi"})
			return
		}

		var stokCount int
		db.QueryRow(`SELECT COUNT(*) FROM gudangbarang WHERE kode_brng = ? AND stok <> 0`, kode).Scan(&stokCount)
		if stokCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Barang masih memiliki stok, tidak bisa dihapus — nonaktifkan saja"})
			return
		}

		res, err := db.Exec(`DELETE FROM databarang WHERE kode_brng = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Barang tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Barang berhasil dihapus"})
	}
}
