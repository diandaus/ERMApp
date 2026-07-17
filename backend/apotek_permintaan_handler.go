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
// APOTEK — Permintaan Obat & BHP (tab utama modul Apotek). Cocok dengan
// inventory/DlgPermintaan.java (form buat permintaan baru, satu-satunya
// yang punya tombol Simpan) + inventory/DlgCariPermintaan.java (daftar +
// klik-kanan untuk Setujui/Tolak/Hapus).
//
// Alur bisnis (diverifikasi dari kolom INSERT & DlgMutasiBarang.tampil
// (String nopermintaan) yang dipanggil saat approve):
//   - Satu depo/bangsal ("Asal Permintaan" = permintaan_medis.kd_bangsal)
//     membuat permintaan barang, DITUJUKAN KE depo lain ("Ditujukan Ke" =
//     permintaan_medis.kd_bangsaltujuan, biasanya gudang utama) yang
//     diharapkan memasok barangnya. Status awal selalu 'Baru'.
//   - Depo tujuan me-review lalu SETUJUI via Mutasi: ini men-trigger
//     Mutasi Obat & BHP dengan kd_bangsal_dari = kd_bangsaltujuan (si
//     pemasok) dan kd_bangsal_ke = kd_bangsal (si peminta) — KEBALIKAN
//     penamaan dari sudut pandang form permintaan, jadi field-nya
//     ditukar saat dipetakan ke Mutasi. Setelah Mutasi berhasil, status
//     permintaan otomatis jadi 'Disetujui'.
//   - Java juga punya jalur approve "Disetujui (Stok Keluar)" lewat
//     DlgPengeluaranApotek (pengeluaran/dispensing langsung tanpa
//     mutasi) — TIDAK diport, karena modul Pengeluaran Apotek itu
//     sendiri belum ada di proyek ini (di luar scope Permintaan).
//   - Tolak (status='Tidak Disetujui') cuma update status, tidak ada
//     efek stok apa pun.
//   - Hapus permintaan: Java kodenya cuma satu DELETE ke permintaan_medis
//     (kelihatan seperti bakal meninggalkan detail_permintaan_medis
//     yatim) — TAPI diverifikasi lewat SHOW CREATE TABLE, kolom
//     detail_permintaan_medis.no_permintaan sudah ON DELETE CASCADE di
//     level skema DB, jadi Java-nya sendiri sebenarnya sudah aman (bukan
//     bug yang perlu "diperbaiki"). Kode kami di bawah tetap eksplisit
//     menghapus detailnya sendiri (bukan hanya bergantung ke cascade)
//     supaya independen dari asumsi skema DB kalau suatu saat FK-nya
//     berubah.
//
// Tabel:
//   permintaan_medis (no_permintaan PK, kd_bangsal, nip, tanggal, status
//     enum('Baru','Disetujui','Tidak Disetujui'), kd_bangsaltujuan)
//   detail_permintaan_medis (no_permintaan, kode_brng, kode_sat, jumlah,
//     keterangan — tidak ada PK eksplisit di skema Khanza, jadi baris
//     dianggap identik lewat kombinasi no_permintaan+kode_brng)
//
// Penyederhanaan yang disengaja (pola sama dengan Stok Opname & Mutasi):
//   - Item picker untuk bikin permintaan baru TIDAK menampilkan
//     kolom Jenis/Kategori/Golongan seperti tabel Java (kode_brng,
//     nama_brng, kode_sat/satuan saja) — field itu di Java murni untuk
//     filter pencarian di form Cari, sudah tercover oleh `search` biasa
//     di endpoint kami.
//   - No.Permintaan digenerate SERVER-SIDE (bukan dipercaya dari
//     payload klien) dengan rumus identik Java: "PM"+YYYYMMDD+3 digit
//     urut per tanggal (MAX(RIGHT(no_permintaan,3))+1) — dilakukan di
//     dalam transaksi yang sama dengan INSERT supaya tidak race
//     condition antar dua permintaan di tanggal yang sama.
// ============================================================================

type permintaanBarangOpsi struct {
	KodeBrng string `json:"kode_brng"`
	NamaBrng string `json:"nama_brng"`
	KodeSat  string `json:"kode_sat"`
	Satuan   string `json:"satuan"`
}

func getPermintaanBarangOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `
			SELECT b.kode_brng, b.nama_brng, b.kode_sat, COALESCE(s.satuan,'')
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
		items := []permintaanBarangOpsi{}
		for rows.Next() {
			var it permintaanBarangOpsi
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Satuan) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

type pegawaiOpsi struct {
	Nik  string `json:"nik"`
	Nama string `json:"nama"`
}

func getPermintaanPegawaiOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		query := `SELECT nik, nama FROM pegawai WHERE stts_aktif = 'AKTIF'`
		args := []interface{}{}
		if search != "" {
			query += " AND (nik LIKE ? OR nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := []pegawaiOpsi{}
		for rows.Next() {
			var it pegawaiOpsi
			if rows.Scan(&it.Nik, &it.Nama) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// generateNoPermintaanObat meniru autoNomor() di DlgPermintaan.java persis:
// prefix "PM"+YYYYMMDD, lalu 3 digit urut per tanggal (MAX suffix
// existing + 1). Dipanggil di DALAM transaksi (pakai tx, bukan db)
// supaya konsisten dengan INSERT yang menyusul.
func generateNoPermintaanObat(tx *sql.Tx, tanggal string) (string, error) {
	t, err := time.Parse("2006-01-02", tanggal)
	if err != nil {
		return "", fmt.Errorf("format tanggal tidak valid")
	}
	prefix := "PM" + t.Format("20060102")
	var maxSuffix int
	err = tx.QueryRow(
		`SELECT IFNULL(MAX(CAST(RIGHT(no_permintaan,3) AS UNSIGNED)),0) FROM permintaan_medis WHERE tanggal=?`,
		tanggal,
	).Scan(&maxSuffix)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1), nil
}

type permintaanSubmitItem struct {
	KodeBrng   string  `json:"kode_brng"`
	KodeSat    string  `json:"kode_sat"`
	Jumlah     float64 `json:"jumlah"`
	Keterangan string  `json:"keterangan"`
}

// submitPermintaan membuat permintaan baru (status 'Baru') — padanan
// BtnSimpanActionPerformed di DlgPermintaan.java.
func submitPermintaan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			KdBangsal       string                  `json:"kd_bangsal"`
			KdBangsalTujuan string                  `json:"kd_bangsal_tujuan"`
			Nip             string                  `json:"nip"`
			Tanggal         string                  `json:"tanggal"`
			Items           []permintaanSubmitItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(body.KdBangsal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asal Permintaan wajib diisi"})
			return
		}
		if strings.TrimSpace(body.KdBangsalTujuan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ditujukan Ke wajib diisi"})
			return
		}
		if body.KdBangsal == body.KdBangsalTujuan {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asal Permintaan dan Ditujukan Ke harus berbeda"})
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
		items := make([]permintaanSubmitItem, 0, len(body.Items))
		for _, it := range body.Items {
			if it.Jumlah > 0 {
				items = append(items, it)
			}
		}
		if len(items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah permintaannya"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		noPermintaan, err := generateNoPermintaanObat(tx, body.Tanggal)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO permintaan_medis (no_permintaan, kd_bangsal, nip, tanggal, status, kd_bangsaltujuan) VALUES (?, ?, ?, ?, 'Baru', ?)`,
			noPermintaan, body.KdBangsal, body.Nip, body.Tanggal, body.KdBangsalTujuan,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		for _, it := range items {
			if _, err := tx.Exec(
				`INSERT INTO detail_permintaan_medis (no_permintaan, kode_brng, kode_sat, jumlah, keterangan) VALUES (?, ?, ?, ?, ?)`,
				noPermintaan, it.KodeBrng, it.KodeSat, it.Jumlah, it.Keterangan,
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
		c.JSON(http.StatusOK, gin.H{"message": "Permintaan berhasil disimpan", "no_permintaan": noPermintaan})
	}
}

type permintaanDetailItem struct {
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	Satuan     string  `json:"satuan"`
	Jumlah     float64 `json:"jumlah"`
	Keterangan string  `json:"keterangan"`
}

type permintaanRiwayat struct {
	NoPermintaan    string                  `json:"no_permintaan"`
	Tanggal         string                  `json:"tanggal"`
	KdBangsal       string                  `json:"kd_bangsal"`
	NmBangsal       string                  `json:"nm_bangsal"`
	Nip             string                  `json:"nip"`
	NmPegawai       string                  `json:"nm_pegawai"`
	Status          string                  `json:"status"`
	KdBangsalTujuan string                  `json:"kd_bangsal_tujuan"`
	NmBangsalTujuan string                  `json:"nm_bangsal_tujuan"`
	Items           []permintaanDetailItem `json:"items"`
}

// getPermintaanRiwayat — daftar permintaan + item per baris (embed,
// bukan endpoint terpisah, supaya frontend tidak perlu N+1 request) —
// padanan tampil() di DlgCariPermintaan.java, disederhanakan (tanpa
// filter Jenis/Kategori/Golongan yang di Java, cukup search bebas +
// filter status + rentang tanggal).
func getPermintaanRiwayat(db *sql.DB) gin.HandlerFunc {
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
			SELECT pm.no_permintaan, pm.tanggal, pm.kd_bangsal, COALESCE(b.nm_bangsal,''), pm.nip, COALESCE(p.nama,''),
				pm.status, pm.kd_bangsaltujuan, COALESCE(bt.nm_bangsal,'')
			FROM permintaan_medis pm
			LEFT JOIN bangsal b ON b.kd_bangsal = pm.kd_bangsal
			LEFT JOIN bangsal bt ON bt.kd_bangsal = pm.kd_bangsaltujuan
			LEFT JOIN pegawai p ON p.nik = pm.nip
			WHERE pm.tanggal BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if kdBangsal != "" {
			query += " AND (pm.kd_bangsal = ? OR pm.kd_bangsaltujuan = ?)"
			args = append(args, kdBangsal, kdBangsal)
		}
		if status != "" {
			query += " AND pm.status = ?"
			args = append(args, status)
		}
		if search != "" {
			query += " AND (pm.no_permintaan LIKE ? OR b.nm_bangsal LIKE ? OR p.nama LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += " ORDER BY pm.tanggal DESC, pm.no_permintaan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []permintaanRiwayat{}
		for rows.Next() {
			var r permintaanRiwayat
			if rows.Scan(&r.NoPermintaan, &r.Tanggal, &r.KdBangsal, &r.NmBangsal, &r.Nip, &r.NmPegawai,
				&r.Status, &r.KdBangsalTujuan, &r.NmBangsalTujuan) == nil {
				r.Items = []permintaanDetailItem{}
				list = append(list, r)
			}
		}

		for i := range list {
			itemRows, err := db.Query(
				`SELECT d.kode_brng, COALESCE(b.nama_brng,''), COALESCE(s.satuan,''), d.jumlah, COALESCE(d.keterangan,'')
				 FROM detail_permintaan_medis d
				 LEFT JOIN databarang b ON b.kode_brng = d.kode_brng
				 LEFT JOIN kodesatuan s ON s.kode_sat = d.kode_sat
				 WHERE d.no_permintaan = ? ORDER BY d.kode_brng`,
				list[i].NoPermintaan,
			)
			if err != nil {
				continue
			}
			for itemRows.Next() {
				var it permintaanDetailItem
				if itemRows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Satuan, &it.Jumlah, &it.Keterangan) == nil {
					list[i].Items = append(list[i].Items, it)
				}
			}
			itemRows.Close()
		}

		c.JSON(http.StatusOK, list)
	}
}

// updatePermintaanStatus — padanan ppTidakDisetujuiActionPerformed
// (Tolak) di DlgCariPermintaan.java: cuma update status, tidak ada efek
// stok apa pun. Menyetujui lewat Mutasi TIDAK lewat endpoint ini,
// tapi lewat setujuiPermintaan di bawah (butuh transaksi mutasi juga).
func updatePermintaanStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := c.Param("no_permintaan")
		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Status != "Tidak Disetujui" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid"})
			return
		}
		var current string
		if err := db.QueryRow(`SELECT status FROM permintaan_medis WHERE no_permintaan=?`, noPermintaan).Scan(&current); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan tidak ditemukan"})
			return
		}
		if current != "Baru" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan sudah divalidasi sebelumnya"})
			return
		}
		if _, err := db.Exec(`UPDATE permintaan_medis SET status='Tidak Disetujui' WHERE no_permintaan=?`, noPermintaan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Permintaan ditolak"})
	}
}

type permintaanSetujuiItem struct {
	KodeBrng string  `json:"kode_brng"`
	HBeli    float64 `json:"h_beli"`
	Jml      float64 `json:"jml"`
}

// setujuiPermintaan — padanan ppDisetujuiActionPerformed ("Disetujui
// (Mutasi)") di DlgCariPermintaan.java + BtnSimpanActionPerformed di
// DlgMutasiBarang.java (dipanggil dengan nomorpermintaan terisi).
// kd_bangsal_dari mutasi = kd_bangsaltujuan permintaan (si pemasok),
// kd_bangsal_ke mutasi = kd_bangsal permintaan (si peminta) — field-nya
// TERTUKAR dari sudut pandang form permintaan, lihat komentar di atas.
// Logika stok server-side (validasi ulang stok_asal, upsert
// gudangbarang) SENGAJA diduplikasi dari submitMutasi di
// apotek_mutasi_handler.go alih-alih dipanggil langsung — mengikuti
// pola satu file per fitur yang sudah dipakai di seluruh modul ini,
// dan supaya transaksi mutasi + update status permintaan bisa 100%
// atomic dalam SATU db.Begin().
func setujuiPermintaan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := c.Param("no_permintaan")
		var body struct {
			Tanggal    string                  `json:"tanggal"`
			Keterangan string                  `json:"keterangan"`
			Petugas    string                  `json:"petugas"`
			Items      []permintaanSetujuiItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah mutasinya"})
			return
		}

		var status, kdBangsal, kdBangsalTujuan string
		if err := db.QueryRow(
			`SELECT status, kd_bangsal, kd_bangsaltujuan FROM permintaan_medis WHERE no_permintaan=?`,
			noPermintaan,
		).Scan(&status, &kdBangsal, &kdBangsalTujuan); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan tidak ditemukan"})
			return
		}
		if status != "Baru" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan sudah divalidasi sebelumnya"})
			return
		}

		kdMutasiDari := kdBangsalTujuan // si pemasok
		kdMutasiKe := kdBangsal         // si peminta

		var nmDari, nmKe string
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, kdMutasiDari).Scan(&nmDari)
		db.QueryRow(`SELECT nm_bangsal FROM bangsal WHERE kd_bangsal=?`, kdMutasiKe).Scan(&nmKe)
		keteranganRiwayat := fmt.Sprintf("%s, dari %s ke %s", body.Keterangan, nmDari, nmKe)

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		affected := 0
		for _, it := range body.Items {
			if it.Jml <= 0 {
				continue
			}
			var stokAsal float64
			var namaBrng string
			err := tx.QueryRow(
				`SELECT gb.stok, b.nama_brng FROM gudangbarang gb INNER JOIN databarang b ON b.kode_brng = gb.kode_brng
				 WHERE gb.kode_brng=? AND gb.kd_bangsal=? AND gb.no_batch='' AND gb.no_faktur=''`,
				it.KodeBrng, kdMutasiDari,
			).Scan(&stokAsal, &namaBrng)
			if err != nil || stokAsal < it.Jml {
				tx.Rollback()
				msg := fmt.Sprintf("Stok %s tidak mencukupi untuk memenuhi permintaan ini", it.KodeBrng)
				if namaBrng != "" {
					msg = fmt.Sprintf("Stok %s (%s) tidak mencukupi untuk memenuhi permintaan ini", namaBrng, it.KodeBrng)
				}
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}

			if _, err := tx.Exec(
				`INSERT INTO mutasibarang (kode_brng, jml, harga, kd_bangsaldari, kd_bangsalke, tanggal, keterangan, no_batch, no_faktur) VALUES (?, ?, ?, ?, ?, ?, ?, '', '')`,
				it.KodeBrng, it.Jml, it.HBeli, kdMutasiDari, kdMutasiKe, body.Tanggal, body.Keterangan,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, 0, it.Jml, "Mutasi", body.Petugas, kdMutasiDari, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.Jml, it.KodeBrng, kdMutasiDari,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if err := catatRiwayatBarangMedis(tx, it.KodeBrng, it.Jml, 0, "Mutasi", body.Petugas, kdMutasiKe, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok + ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				it.Jml, it.KodeBrng, kdMutasiKe,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if _, err := tx.Exec(
					`INSERT INTO gudangbarang (kode_brng, kd_bangsal, stok, no_batch, no_faktur) VALUES (?, ?, ?, '', '')`,
					it.KodeBrng, kdMutasiKe, it.Jml,
				); err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			}
			affected++
		}

		if affected == 0 {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada barang yang diisi jumlah mutasinya"})
			return
		}

		if _, err := tx.Exec(`UPDATE permintaan_medis SET status='Disetujui' WHERE no_permintaan=?`, noPermintaan); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Permintaan disetujui, stok sudah dimutasi", "affected": affected})
	}
}

// deletePermintaan — Hapus permintaan_medis SEKALIGUS
// detail_permintaan_medis-nya (deviasi disengaja dari Java, lihat
// komentar di kepala file).
func deletePermintaan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := c.Param("no_permintaan")
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`DELETE FROM permintaan_medis WHERE no_permintaan=?`, noPermintaan)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan tidak ditemukan"})
			return
		}
		if _, err := tx.Exec(`DELETE FROM detail_permintaan_medis WHERE no_permintaan=?`, noPermintaan); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Permintaan berhasil dihapus"})
	}
}
