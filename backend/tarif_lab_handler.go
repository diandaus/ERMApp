package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// tarif_lab_handler.go — CRUD "Tarif Lab" (menu Tarif Pelayanan > Tarif Lab),
// padanan DlgTemplateLaboratorium.java (Khanza Desktop): kelola parameter
// (baris) template_laboratorium per satu kd_jenis_prw (kode pemeriksaan).
// Biaya Item TIDAK bisa diedit user (persis isCellEditable Java, kolom index
// 13 dikunci) — dihitung backend sbg jumlah 7 komponen biaya lainnya.

// TarifLabTemplateRow — satu baris parameter template_laboratorium, semua
// kolom yg tampil/diedit di dialog (urutan sama dgn tabMode Java).
type TarifLabTemplateRow struct {
	IDTemplate     int     `json:"id_template"`
	KdJenisPrw     string  `json:"kd_jenis_prw"`
	Pemeriksaan    string  `json:"pemeriksaan"`
	Satuan         string  `json:"satuan"`
	NilaiRujukanLD string  `json:"nilai_rujukan_ld"`
	NilaiRujukanLA string  `json:"nilai_rujukan_la"`
	NilaiRujukanPD string  `json:"nilai_rujukan_pd"`
	NilaiRujukanPA string  `json:"nilai_rujukan_pa"`
	BagianRs       float64 `json:"bagian_rs"`
	Bhp            float64 `json:"bhp"`
	BagianPerujuk  float64 `json:"bagian_perujuk"`
	BagianDokter   float64 `json:"bagian_dokter"`
	BagianLaborat  float64 `json:"bagian_laborat"`
	Kso            float64 `json:"kso"`
	Menejemen      float64 `json:"menejemen"`
	BiayaItem      float64 `json:"biaya_item"`
	Urut           int     `json:"urut"`
}

// TarifLabListRow — satu baris tabel utama "Tarif Lab" (jns_perawatan_lab
// join penjab), padanan PERSIS kolom tabMode/tampil() DlgHargaLab.java:
// P|Kode Periksa|Nama Pemeriksaan|Jasa Sarana|Paket BHP|J.M. Perujuk|
// J.M. Dokter|J.M. Petugas|K.S.O.|Menejemen|Total Tarif|Jenis Bayar|Kelas|
// Kategori. Satu baris = kombinasi (kd_jenis_prw, kd_pj) — satu pemeriksaan
// bisa muncul beberapa kali kalau tarifnya beda per jenis bayar/cara bayar.
type TarifLabListRow struct {
	KdJenisPrw           string  `json:"kd_jenis_prw"`
	NmPerawatan          string  `json:"nm_perawatan"`
	BagianRs             float64 `json:"bagian_rs"`
	Bhp                  float64 `json:"bhp"`
	TarifPerujuk         float64 `json:"tarif_perujuk"`
	TarifTindakanDokter  float64 `json:"tarif_tindakan_dokter"`
	TarifTindakanPetugas float64 `json:"tarif_tindakan_petugas"`
	Kso                  float64 `json:"kso"`
	Menejemen            float64 `json:"menejemen"`
	TotalByr             float64 `json:"total_byr"`
	KdPj                 string  `json:"kd_pj"`
	PngJawab             string  `json:"png_jawab"`
	Kelas                string  `json:"kelas"`
	Kategori             string  `json:"kategori"`
}

// tarifLabCreateInput — payload form "+ Tambah Tarif Lab". kd_pj & kategori
// wajib diisi (FK ke penjab / dipakai filter tab PK-PA di tempat lain),
// total_byr dihitung ULANG di backend (jumlah 7 komponen tarif) — nilai yg
// dikirim frontend diabaikan, sama prinsip dgn Biaya Item di
// template_laboratorium (jangan percaya angka total dari client).
type tarifLabCreateInput struct {
	KdJenisPrw           string  `json:"kd_jenis_prw" binding:"required"`
	NmPerawatan          string  `json:"nm_perawatan" binding:"required"`
	KdPj                 string  `json:"kd_pj" binding:"required"`
	Kelas                string  `json:"kelas"`
	Kategori             string  `json:"kategori" binding:"required"`
	BagianRs             float64 `json:"bagian_rs"`
	Bhp                  float64 `json:"bhp"`
	TarifPerujuk         float64 `json:"tarif_perujuk"`
	TarifTindakanDokter  float64 `json:"tarif_tindakan_dokter"`
	TarifTindakanPetugas float64 `json:"tarif_tindakan_petugas"`
	Kso                  float64 `json:"kso"`
	Menejemen            float64 `json:"menejemen"`
}

// POST /api/tarif-lab/jenis-perawatan — tambah baris baru Tarif Lab
// (jns_perawatan_lab). kd_jenis_prw jadi primary key, jadi WAJIB unik —
// satu pemeriksaan yg tarifnya beda per jenis bayar disimpan sbg baris
// terpisah dgn kd_jenis_prw beda (persis data existing, mis. "101-K.3"
// CITO vs "102-K.2" reguler utk exam yg sama).
func createTarifLabJenisPerawatan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input tarifLabCreateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}

		var exists int
		db.QueryRow(`SELECT COUNT(*) FROM jns_perawatan_lab WHERE kd_jenis_prw = ?`, input.KdJenisPrw).Scan(&exists)
		if exists > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Periksa \"" + input.KdJenisPrw + "\" sudah dipakai"})
			return
		}

		totalByr := input.BagianRs + input.Bhp + input.TarifPerujuk + input.TarifTindakanDokter + input.TarifTindakanPetugas + input.Kso + input.Menejemen

		_, err := db.Exec(`
			INSERT INTO jns_perawatan_lab (
				kd_jenis_prw, nm_perawatan, kd_pj, kelas, kategori, status,
				bagian_rs, bhp, tarif_perujuk, tarif_tindakan_dokter, tarif_tindakan_petugas,
				kso, menejemen, total_byr
			) VALUES (?, ?, ?, ?, ?, '1', ?, ?, ?, ?, ?, ?, ?, ?)
		`, input.KdJenisPrw, input.NmPerawatan, input.KdPj, input.Kelas, input.Kategori,
			input.BagianRs, input.Bhp, input.TarifPerujuk, input.TarifTindakanDokter, input.TarifTindakanPetugas,
			input.Kso, input.Menejemen, totalByr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "total_byr": totalByr})
	}
}

// PUT /api/tarif-lab/jenis-perawatan/:kd_jenis_prw — edit baris Tarif Lab yg
// sudah ada. Dibuka dari kolom checkbox "P" di tabel utama TarifLab.tsx:
// centang PERSIS SATU baris lalu klik "+ Tambah Tarif Lab" -> modal terisi
// data baris itu (mode edit, bukan tambah baru). kd_jenis_prw TIDAK ikut
// diubah di sini (dipakai sbg kunci URL, sama alasan NIK readOnly di form
// Pegawai) — kalau mau ganti kode, hapus baris lama & buat baris baru.
func updateTarifLabJenisPerawatan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdJenisPrw := c.Param("kd_jenis_prw")
		if kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_jenis_prw wajib diisi"})
			return
		}
		var input tarifLabCreateInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}

		totalByr := input.BagianRs + input.Bhp + input.TarifPerujuk + input.TarifTindakanDokter + input.TarifTindakanPetugas + input.Kso + input.Menejemen

		res, err := db.Exec(`
			UPDATE jns_perawatan_lab SET
				nm_perawatan=?, kd_pj=?, kelas=?, kategori=?,
				bagian_rs=?, bhp=?, tarif_perujuk=?, tarif_tindakan_dokter=?, tarif_tindakan_petugas=?,
				kso=?, menejemen=?, total_byr=?
			WHERE kd_jenis_prw=?
		`, input.NmPerawatan, input.KdPj, input.Kelas, input.Kategori,
			input.BagianRs, input.Bhp, input.TarifPerujuk, input.TarifTindakanDokter, input.TarifTindakanPetugas,
			input.Kso, input.Menejemen, totalByr, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tarif Lab tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "total_byr": totalByr})
	}
}

// DELETE /api/tarif-lab/jenis-perawatan — hapus banyak baris sekaligus,
// dipakai tombol "Hapus Terpilih" saat >=1 baris dicentang di kolom "P"
// (beda dari kolom "P" tunggal -> edit di atas: fungsi centang MULTI baris
// SENGAJA khusus utk hapus massal, bukan utk ditampilkan ke modal).
func deleteTarifLabJenisPerawatanBulk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			KdJenisPrw []string `json:"kd_jenis_prw" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if len(input.KdJenisPrw) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu baris"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		deleted := 0
		for _, kd := range input.KdJenisPrw {
			res, err := tx.Exec(`DELETE FROM jns_perawatan_lab WHERE kd_jenis_prw = ?`, kd)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus " + kd + ": " + err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n > 0 {
				deleted++
			}
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "deleted": deleted})
	}
}

// GET /api/tarif-lab/list?search=... — daftar utama Tarif Lab, padanan
// method tampil() di DlgHargaLab.java (SELECT jns_perawatan_lab INNER JOIN
// penjab, status='1', search across kd_jenis_prw/nm_perawatan/kelas/
// png_jawab/kategori, ORDER BY kd_jenis_prw).
func getTarifLabList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("search")

		query := `
			SELECT jns_perawatan_lab.kd_jenis_prw, jns_perawatan_lab.nm_perawatan,
				IFNULL(jns_perawatan_lab.bagian_rs,0), IFNULL(jns_perawatan_lab.bhp,0),
				IFNULL(jns_perawatan_lab.tarif_perujuk,0), IFNULL(jns_perawatan_lab.tarif_tindakan_dokter,0),
				IFNULL(jns_perawatan_lab.tarif_tindakan_petugas,0), IFNULL(jns_perawatan_lab.kso,0),
				IFNULL(jns_perawatan_lab.menejemen,0), IFNULL(jns_perawatan_lab.total_byr,0),
				jns_perawatan_lab.kd_pj, penjab.png_jawab, IFNULL(jns_perawatan_lab.kelas,'-'), jns_perawatan_lab.kategori
			FROM jns_perawatan_lab
			INNER JOIN penjab ON penjab.kd_pj = jns_perawatan_lab.kd_pj
			WHERE jns_perawatan_lab.status = '1'
		`
		args := []interface{}{}
		if search != "" {
			query += ` AND (jns_perawatan_lab.kd_jenis_prw LIKE ? OR jns_perawatan_lab.nm_perawatan LIKE ?
				OR jns_perawatan_lab.kelas LIKE ? OR penjab.png_jawab LIKE ? OR jns_perawatan_lab.kategori LIKE ?)`
			p := "%" + search + "%"
			args = append(args, p, p, p, p, p)
		}
		query += ` ORDER BY jns_perawatan_lab.kd_jenis_prw`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []TarifLabListRow{}
		for rows.Next() {
			var it TarifLabListRow
			if err := rows.Scan(
				&it.KdJenisPrw, &it.NmPerawatan, &it.BagianRs, &it.Bhp, &it.TarifPerujuk,
				&it.TarifTindakanDokter, &it.TarifTindakanPetugas, &it.Kso, &it.Menejemen,
				&it.TotalByr, &it.KdPj, &it.PngJawab, &it.Kelas, &it.Kategori,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, items)
	}
}

// GET /api/tarif-lab/template?kd_jenis_prw=xxx — daftar lengkap parameter
// (semua kolom, termasuk komponen biaya) utk satu kode pemeriksaan.
func getTarifLabTemplateList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdJenisPrw := c.Query("kd_jenis_prw")
		if kdJenisPrw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter kd_jenis_prw wajib diisi"})
			return
		}

		rows, err := db.Query(`
			SELECT id_template, kd_jenis_prw, Pemeriksaan, IFNULL(satuan,''),
				IFNULL(nilai_rujukan_ld,''), IFNULL(nilai_rujukan_la,''),
				IFNULL(nilai_rujukan_pd,''), IFNULL(nilai_rujukan_pa,''),
				IFNULL(bagian_rs,0), IFNULL(bhp,0), IFNULL(bagian_perujuk,0),
				IFNULL(bagian_dokter,0), IFNULL(bagian_laborat,0), IFNULL(kso,0),
				IFNULL(menejemen,0), IFNULL(biaya_item,0), IFNULL(urut,0)
			FROM template_laboratorium
			WHERE kd_jenis_prw = ?
			ORDER BY urut, id_template
		`, kdJenisPrw)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []TarifLabTemplateRow{}
		for rows.Next() {
			var it TarifLabTemplateRow
			if err := rows.Scan(
				&it.IDTemplate, &it.KdJenisPrw, &it.Pemeriksaan, &it.Satuan,
				&it.NilaiRujukanLD, &it.NilaiRujukanLA, &it.NilaiRujukanPD, &it.NilaiRujukanPA,
				&it.BagianRs, &it.Bhp, &it.BagianPerujuk, &it.BagianDokter, &it.BagianLaborat,
				&it.Kso, &it.Menejemen, &it.BiayaItem, &it.Urut,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, items)
	}
}

func hitungBiayaItem(r TarifLabTemplateRow) float64 {
	return r.BagianRs + r.Bhp + r.BagianPerujuk + r.BagianDokter + r.BagianLaborat + r.Kso + r.Menejemen
}

// POST /api/tarif-lab/template — tambah baris parameter baru. urut otomatis
// diisi urutan berikutnya (MAX(urut)+1) utk kd_jenis_prw tsb, persis
// perilaku BtnTambah Java (baris baru selalu masuk ke urutan paling akhir).
func createTarifLabTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input TarifLabTemplateRow
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if input.KdJenisPrw == "" || input.Pemeriksaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Pemeriksaan dan Nama Pemeriksaan wajib diisi"})
			return
		}

		var nextUrut int
		db.QueryRow(`SELECT IFNULL(MAX(urut),0)+1 FROM template_laboratorium WHERE kd_jenis_prw = ?`, input.KdJenisPrw).Scan(&nextUrut)
		biayaItem := hitungBiayaItem(input)

		res, err := db.Exec(`
			INSERT INTO template_laboratorium (
				kd_jenis_prw, Pemeriksaan, satuan, nilai_rujukan_ld, nilai_rujukan_la,
				nilai_rujukan_pd, nilai_rujukan_pa, bagian_rs, bhp, bagian_perujuk,
				bagian_dokter, bagian_laborat, kso, menejemen, biaya_item, urut
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, input.KdJenisPrw, input.Pemeriksaan, input.Satuan, input.NilaiRujukanLD, input.NilaiRujukanLA,
			input.NilaiRujukanPD, input.NilaiRujukanPA, input.BagianRs, input.Bhp, input.BagianPerujuk,
			input.BagianDokter, input.BagianLaborat, input.Kso, input.Menejemen, biayaItem, nextUrut)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}
		newID, _ := res.LastInsertId()

		input.IDTemplate = int(newID)
		input.BiayaItem = biayaItem
		input.Urut = nextUrut
		c.JSON(http.StatusOK, input)
	}
}

// POST /api/tarif-lab/template/copy — "Copy Template" di menu dropdown Nama
// Pemeriksaan (TarifLab.tsx): salin SEMUA baris parameter template_laboratorium
// dari satu kd_jenis_prw (sumber) ke kd_jenis_prw lain (tujuan yg dipilih user
// lewat notifikasi Swal). Baris tujuan yg sudah ada DIHAPUS dulu (bukan
// ditambah/duplikat) supaya hasilnya persis salinan sumber, bukan campuran.
func copyTarifLabTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			FromKdJenisPrw string `json:"from_kd_jenis_prw" binding:"required"`
			ToKdJenisPrw   string `json:"to_kd_jenis_prw" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if input.FromKdJenisPrw == input.ToKdJenisPrw {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pemeriksaan tujuan harus berbeda dari sumber"})
			return
		}

		rows, err := db.Query(`
			SELECT Pemeriksaan, IFNULL(satuan,''), IFNULL(nilai_rujukan_ld,''), IFNULL(nilai_rujukan_la,''),
				IFNULL(nilai_rujukan_pd,''), IFNULL(nilai_rujukan_pa,''), IFNULL(bagian_rs,0), IFNULL(bhp,0),
				IFNULL(bagian_perujuk,0), IFNULL(bagian_dokter,0), IFNULL(bagian_laborat,0),
				IFNULL(kso,0), IFNULL(menejemen,0), IFNULL(biaya_item,0), urut
			FROM template_laboratorium WHERE kd_jenis_prw = ? ORDER BY urut
		`, input.FromKdJenisPrw)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type srcRow struct {
			pemeriksaan, satuan, ld, la, pd, pa                                            string
			bagianRs, bhp, bagianPerujuk, bagianDokter, bagianLaborat, kso, mnj, biayaItem float64
			urut                                                                           int
		}
		src := []srcRow{}
		for rows.Next() {
			var r srcRow
			if rows.Scan(&r.pemeriksaan, &r.satuan, &r.ld, &r.la, &r.pd, &r.pa,
				&r.bagianRs, &r.bhp, &r.bagianPerujuk, &r.bagianDokter, &r.bagianLaborat,
				&r.kso, &r.mnj, &r.biayaItem, &r.urut) == nil {
				src = append(src, r)
			}
		}
		rows.Close()
		if len(src) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pemeriksaan sumber belum punya template parameter"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM template_laboratorium WHERE kd_jenis_prw = ?`, input.ToKdJenisPrw); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus template lama tujuan: " + err.Error()})
			return
		}
		for _, r := range src {
			if _, err := tx.Exec(`
				INSERT INTO template_laboratorium (
					kd_jenis_prw, Pemeriksaan, satuan, nilai_rujukan_ld, nilai_rujukan_la,
					nilai_rujukan_pd, nilai_rujukan_pa, bagian_rs, bhp, bagian_perujuk,
					bagian_dokter, bagian_laborat, kso, menejemen, biaya_item, urut
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, input.ToKdJenisPrw, r.pemeriksaan, r.satuan, r.ld, r.la, r.pd, r.pa,
				r.bagianRs, r.bhp, r.bagianPerujuk, r.bagianDokter, r.bagianLaborat,
				r.kso, r.mnj, r.biayaItem, r.urut); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyalin: " + err.Error()})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "copied": len(src)})
	}
}

// PUT /api/tarif-lab/template/:id — edit baris parameter yang sudah ada.
func updateTarifLabTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var input TarifLabTemplateRow
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		if input.Pemeriksaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama Pemeriksaan wajib diisi"})
			return
		}
		biayaItem := hitungBiayaItem(input)

		_, err := db.Exec(`
			UPDATE template_laboratorium SET
				Pemeriksaan=?, satuan=?, nilai_rujukan_ld=?, nilai_rujukan_la=?,
				nilai_rujukan_pd=?, nilai_rujukan_pa=?, bagian_rs=?, bhp=?, bagian_perujuk=?,
				bagian_dokter=?, bagian_laborat=?, kso=?, menejemen=?, biaya_item=?, urut=?
			WHERE id_template = ?
		`, input.Pemeriksaan, input.Satuan, input.NilaiRujukanLD, input.NilaiRujukanLA,
			input.NilaiRujukanPD, input.NilaiRujukanPA, input.BagianRs, input.Bhp, input.BagianPerujuk,
			input.BagianDokter, input.BagianLaborat, input.Kso, input.Menejemen, biayaItem, input.Urut, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengedit: " + err.Error()})
			return
		}

		input.BiayaItem = biayaItem
		c.JSON(http.StatusOK, input)
	}
}

// DELETE /api/tarif-lab/template/:id — hapus satu baris parameter, persis
// BtnHapus Java (langsung hapus DB begitu diklik, bukan batch).
func deleteTarifLabTemplate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		res, err := db.Exec(`DELETE FROM template_laboratorium WHERE id_template = ?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus: " + err.Error()})
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
