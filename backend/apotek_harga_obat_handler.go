package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Set Harga Obat (item #2 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Harga Obat" (setting/DlgSetHarga.java),
// 4 tab:
//   1. Pengaturan Harga (set_harga_obat) — mode markup: "Umum"/"Per Jenis"/
//      "Per Barang", basis harga ("Harga Beli"/"Harga Diskon"), sertakan
//      PPN ("Yes"/"No"). Cuma metadata/preferensi — TIDAK dipakai dalam
//      rumus apply di dialog Java sendiri (dibaca modul lain, mis. barang
//      masuk/pembelian) jadi kami simpan apa adanya tanpa mencoba
//      mempengaruhi kalkulasi apply di bawah.
//   2. Harga Umum (setpenjualanumum) — 10 persentase margin/"keuntungan"
//      (per tingkatan harga jual), SATU baris system-wide, dipakai kalau
//      mode = "Umum". "Terapkan" = bulk UPDATE seluruh databarang.
//   3. Harga Per Jenis (setpenjualan) — 10 persentase per kdjns (PK).
//      "Terapkan" = UPDATE databarang WHERE kdjns = ini.
//   4. Harga Per Barang (setpenjualanperbarang) — 10 persentase per
//      kode_brng (PK). "Terapkan" = UPDATE databarang WHERE kode_brng =
//      ini.
// Rumus apply (identik dgn Java): kolom_harga = ROUND(h_beli +
// (h_beli * (pct/100))) — untuk kesepuluh kolom harga jual databarang
// (ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas,
// karyawan) sekaligus, masing-masing pakai persentasenya sendiri.
// ============================================================================

// hargaPct adalah 10 kolom persentase margin yang sama dipakai
// setpenjualanumum/setpenjualan/setpenjualanperbarang.
type hargaPct struct {
	Ralan     float64 `json:"ralan"`
	Kelas1    float64 `json:"kelas1"`
	Kelas2    float64 `json:"kelas2"`
	Kelas3    float64 `json:"kelas3"`
	Utama     float64 `json:"utama"`
	Vip       float64 `json:"vip"`
	Vvip      float64 `json:"vvip"`
	BeliLuar  float64 `json:"beliluar"`
	JualBebas float64 `json:"jualbebas"`
	Karyawan  float64 `json:"karyawan"`
}

// applyHargaSQL menghasilkan klausa SET untuk UPDATE databarang, memakai
// rumus markup yang identik dengan Java (ROUND(h_beli + h_beli*pct/100)).
// args harus di-append dengan urutan: ralan, kelas1, kelas2, kelas3, utama,
// vip, vvip, beliluar, jualbebas, karyawan (10 kali).
const applyHargaSetClause = `
	ralan = ROUND(h_beli + (h_beli * (? / 100))),
	kelas1 = ROUND(h_beli + (h_beli * (? / 100))),
	kelas2 = ROUND(h_beli + (h_beli * (? / 100))),
	kelas3 = ROUND(h_beli + (h_beli * (? / 100))),
	utama = ROUND(h_beli + (h_beli * (? / 100))),
	vip = ROUND(h_beli + (h_beli * (? / 100))),
	vvip = ROUND(h_beli + (h_beli * (? / 100))),
	beliluar = ROUND(h_beli + (h_beli * (? / 100))),
	jualbebas = ROUND(h_beli + (h_beli * (? / 100))),
	karyawan = ROUND(h_beli + (h_beli * (? / 100)))
`

func (p hargaPct) args() []interface{} {
	return []interface{}{p.Ralan, p.Kelas1, p.Kelas2, p.Kelas3, p.Utama, p.Vip, p.Vvip, p.BeliLuar, p.JualBebas, p.Karyawan}
}

// ---- Tab 1: Pengaturan Harga (set_harga_obat) ------------------------------

type setHargaObat struct {
	Setharga   string `json:"setharga"`
	Hargadasar string `json:"hargadasar"`
	Ppn        string `json:"ppn"`
}

func getSetHargaObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s setHargaObat
		err := db.QueryRow(`SELECT setharga, hargadasar, ppn FROM set_harga_obat LIMIT 1`).Scan(&s.Setharga, &s.Hargadasar, &s.Ppn)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

func saveSetHargaObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body setHargaObat
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if body.Setharga != "Umum" && body.Setharga != "Per Jenis" && body.Setharga != "Per Barang" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pengaturan harga tidak valid"})
			return
		}
		if body.Hargadasar != "Harga Beli" && body.Hargadasar != "Harga Diskon" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Harga dasar tidak valid"})
			return
		}
		if body.Ppn != "Yes" && body.Ppn != "No" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "PPN tidak valid"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM set_harga_obat`); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`INSERT INTO set_harga_obat (setharga, hargadasar, ppn) VALUES (?, ?, ?)`, body.Setharga, body.Hargadasar, body.Ppn); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga berhasil disimpan"})
	}
}

// deleteSetHargaObat mengosongkan pengaturan mode harga.
func deleteSetHargaObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM set_harga_obat`); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga berhasil dihapus"})
	}
}

// ---- Tab 2: Harga Umum (setpenjualanumum) ----------------------------------

func getHargaUmum(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p hargaPct
		err := db.QueryRow(`SELECT ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan FROM setpenjualanumum LIMIT 1`).
			Scan(&p.Ralan, &p.Kelas1, &p.Kelas2, &p.Kelas3, &p.Utama, &p.Vip, &p.Vvip, &p.BeliLuar, &p.JualBebas, &p.Karyawan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

func saveHargaUmum(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p hargaPct
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM setpenjualanumum`); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`
			INSERT INTO setpenjualanumum (ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, p.args()...); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga umum berhasil disimpan"})
	}
}

// terapkanHargaUmum menerapkan persentase setpenjualanumum ke SELURUH baris
// databarang (tanpa filter) — identik dengan tombol "Update" di tab "Harga
// Umum" Java (ppUPdate1ActionPerformed).
func terapkanHargaUmum(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p hargaPct
		err := db.QueryRow(`SELECT ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan FROM setpenjualanumum LIMIT 1`).
			Scan(&p.Ralan, &p.Kelas1, &p.Kelas2, &p.Kelas3, &p.Utama, &p.Vip, &p.Vvip, &p.BeliLuar, &p.JualBebas, &p.Karyawan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pengaturan harga umum belum diatur"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE databarang SET `+applyHargaSetClause, p.args()...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		c.JSON(http.StatusOK, gin.H{"message": "Harga berhasil diterapkan ke seluruh barang", "affected": n})
	}
}

// deleteHargaUmum mengosongkan pengaturan harga umum.
func deleteHargaUmum(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM setpenjualanumum`); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga umum berhasil dihapus"})
	}
}

// ---- Tab 3: Harga Per Jenis (setpenjualan) ---------------------------------

type hargaPerJenis struct {
	Kdjns   string `json:"kdjns"`
	NmJenis string `json:"nm_jenis"`
	hargaPct
}

func getHargaPerJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT sp.kdjns, COALESCE(j.nama,''), sp.ralan, sp.kelas1, sp.kelas2, sp.kelas3, sp.utama, sp.vip, sp.vvip, sp.beliluar, sp.jualbebas, sp.karyawan
			FROM setpenjualan sp
			LEFT JOIN jenis j ON j.kdjns = sp.kdjns
			ORDER BY j.nama
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []hargaPerJenis{}
		for rows.Next() {
			var h hargaPerJenis
			if rows.Scan(&h.Kdjns, &h.NmJenis, &h.Ralan, &h.Kelas1, &h.Kelas2, &h.Kelas3, &h.Utama, &h.Vip, &h.Vvip, &h.BeliLuar, &h.JualBebas, &h.Karyawan) == nil {
				items = append(items, h)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func upsertHargaPerJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body hargaPerJenis
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Kdjns) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis barang wajib diisi"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM setpenjualan WHERE kdjns = ?`, body.Kdjns); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		args := append(body.hargaPct.args(), body.Kdjns)
		if _, err := tx.Exec(`
			INSERT INTO setpenjualan (ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan, kdjns)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, args...); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga per jenis berhasil disimpan"})
	}
}

func deleteHargaPerJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdjns := strings.TrimSpace(c.Param("kdjns"))
		res, err := db.Exec(`DELETE FROM setpenjualan WHERE kdjns = ?`, kdjns)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga per jenis berhasil dihapus"})
	}
}

// terapkanHargaPerJenis menerapkan persentase setpenjualan ke databarang
// WHERE kdjns = ini saja — identik dgn tombol "Update" tab "Per Jenis
// Barang" Java (ppUPdateActionPerformed).
func terapkanHargaPerJenis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdjns := strings.TrimSpace(c.Param("kdjns"))
		var p hargaPct
		err := db.QueryRow(`SELECT ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan FROM setpenjualan WHERE kdjns = ?`, kdjns).
			Scan(&p.Ralan, &p.Kelas1, &p.Kelas2, &p.Kelas3, &p.Utama, &p.Vip, &p.Vvip, &p.BeliLuar, &p.JualBebas, &p.Karyawan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengaturan harga untuk jenis ini belum ada"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		args := append(p.args(), kdjns)
		res, err := db.Exec(`UPDATE databarang SET `+applyHargaSetClause+` WHERE kdjns = ?`, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		c.JSON(http.StatusOK, gin.H{"message": "Harga berhasil diterapkan ke barang jenis ini", "affected": n})
	}
}

// ---- Tab 4: Harga Per Barang (setpenjualanperbarang) -----------------------

type hargaPerBarang struct {
	KodeBrng string `json:"kode_brng"`
	NamaBrng string `json:"nama_brng"`
	hargaPct
}

func getHargaPerBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT sp.kode_brng, COALESCE(b.nama_brng,''), sp.ralan, sp.kelas1, sp.kelas2, sp.kelas3, sp.utama, sp.vip, sp.vvip, sp.beliluar, sp.jualbebas, sp.karyawan
			FROM setpenjualanperbarang sp
			LEFT JOIN databarang b ON b.kode_brng = sp.kode_brng
			WHERE 1=1
		`
		args := []interface{}{}
		if search != "" {
			query += " AND (b.nama_brng LIKE ? OR sp.kode_brng LIKE ?)"
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
		items := []hargaPerBarang{}
		for rows.Next() {
			var h hargaPerBarang
			if rows.Scan(&h.KodeBrng, &h.NamaBrng, &h.Ralan, &h.Kelas1, &h.Kelas2, &h.Kelas3, &h.Utama, &h.Vip, &h.Vvip, &h.BeliLuar, &h.JualBebas, &h.Karyawan) == nil {
				items = append(items, h)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func upsertHargaPerBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body hargaPerBarang
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.KodeBrng) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Barang wajib diisi"})
			return
		}
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM setpenjualanperbarang WHERE kode_brng = ?`, body.KodeBrng); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		args := append(body.hargaPct.args(), body.KodeBrng)
		if _, err := tx.Exec(`
			INSERT INTO setpenjualanperbarang (ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan, kode_brng)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, args...); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga per barang berhasil disimpan"})
	}
}

func deleteHargaPerBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		res, err := db.Exec(`DELETE FROM setpenjualanperbarang WHERE kode_brng = ?`, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengaturan harga per barang berhasil dihapus"})
	}
}

// terapkanHargaPerBarang menerapkan persentase setpenjualanperbarang ke
// databarang WHERE kode_brng = ini saja — identik dgn tombol "Update" tab
// "Per Barang" Java (ppUPdate2ActionPerformed).
func terapkanHargaPerBarang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kode := strings.TrimSpace(c.Param("kode"))
		var p hargaPct
		err := db.QueryRow(`SELECT ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan FROM setpenjualanperbarang WHERE kode_brng = ?`, kode).
			Scan(&p.Ralan, &p.Kelas1, &p.Kelas2, &p.Kelas3, &p.Utama, &p.Vip, &p.Vvip, &p.BeliLuar, &p.JualBebas, &p.Karyawan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengaturan harga untuk barang ini belum ada"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		args := append(p.args(), kode)
		res, err := db.Exec(`UPDATE databarang SET `+applyHargaSetClause+` WHERE kode_brng = ?`, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		c.JSON(http.StatusOK, gin.H{"message": "Harga berhasil diterapkan ke barang ini", "affected": n})
	}
}
