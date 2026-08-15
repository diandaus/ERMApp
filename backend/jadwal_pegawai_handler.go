package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Jadwal Pegawai, padanan kepegawaian/DlgJadwalPegawai.java
// (Khanza). Grid spreadsheet: baris = pegawai, kolom = tanggal 1..31
// dalam bulan yang dipilih, tiap sel diisi nama shift (dari tabel
// `jam_masuk`) atau kosong. Dipakai sebagai sumber jadwal shift oleh
// fitur Presensi Mandiri (backend/presensi_handler.go, getShiftHariIni)
// utk menghitung status Terlambat/PSW.
//
// DlgJadwalPegawai.java menyimpan lewat Sequel.menyimpan2("jadwal_pegawai",
// "?,?,...", 34, ...) — insert-atau-update 34 kolom positional (id, tahun,
// bulan, h1..h31) PER PEGAWAI PER BULAN sekali jalan (bukan per sel). Di
// sini disederhanakan pakai native "INSERT ... ON DUPLICATE KEY UPDATE"
// MySQL (primary key komposit id+tahun+bulan sudah ada di skema Khanza),
// jadi satu query per baris, TANPA perlu dua langkah try-insert/catch-
// update seperti Java. Tabel jadwal_pegawai TIDAK ditambah kolom apa pun
// di sini — cuma pakai 34 kolom yang sudah ada.
//
// pegawai_jadwal_tetap — TAMBAHAN di luar skema Khanza (bukan companion
// legacy, murni fitur baru ERMApp): shift berulang per pegawai (mis.
// "Budi selalu Pagi, Senin-Jumat" utk staf kantor, atau "Sari selalu
// Malam, 7 hari" utk staf IGD) yang berlaku otomatis TANPA perlu diisi
// manual ke grid jadwal_pegawai tiap bulan. `hari_aktif` menyimpan CSV
// nomor hari ISO (1=Senin..7=Minggu, lihat isoWeekday) tempat jadwal ini
// berlaku — di luar hari itu dianggap libur meski shift-nya diisi.
// Prioritas dibaca getShiftHariIni (presensi_handler.go) &
// getJadwalPegawaiList di bawah: 1) jadwal_pegawai.h<tgl> kalau diisi
// eksplisit (override — dipakai utk pengecualian: tukar shift, dll),
// 2) fallback ke pegawai_jadwal_tetap KALAU hari itu termasuk
// hari_aktif-nya. Tabel `pegawai` TIDAK ditambah kolom (juga ditulis
// positional oleh Java, lihat DlgPetugas.java baris 844,
// Sequel.menyimpanignore 34 kolom) — dibuat tabel terpisah, pola yang
// sama dgn petugas_ext/rekap_presensi_ext.
//
// ensureShiftColumnsVarchar — migrasi ENUM->VARCHAR(30) utk kolom nama
// shift di 4 tabel (jam_masuk.shift, jadwal_pegawai.h1..h31,
// rekap_presensi.shift, temporary_presensi.shift). Awalnya nama shift
// dibatasi ke 60 slot ENUM yang di-hardcode Khanza (lihat
// DlgJamMasuk.java baris 369 — combobox-nya JUGA hardcode daftar yang
// sama persis, jadi batasan itu bukan sesuatu yang ERMApp buat sendiri).
// Setelah migrasi ini, nama shift bebas (VARCHAR) supaya bisa
// ditambah/di-rename bebas dari ERMApp — konsekuensinya nama custom
// TIDAK akan muncul di combobox Khanza desktop (hardcode, bukan baca
// skema DB), tapi data & kompatibilitas Java tetap aman krn VARCHAR
// menerima superset penuh dari nilai ENUM lama (tidak ada data yang
// hilang/berubah). Idempotent: cek dulu tipe kolom saat ini via
// information_schema, cuma jalan kalau masih enum.
// ============================================================================

func ensureShiftColumnsVarchar(db *sql.DB) {
	var dataType string
	err := db.QueryRow(`
		SELECT DATA_TYPE FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jam_masuk' AND COLUMN_NAME = 'shift'
	`).Scan(&dataType)
	if err != nil || dataType != "enum" {
		return // sudah termigrasi (atau tabel belum ada — biarkan gagal senyap, sama seperti ensureX lain)
	}

	db.Exec(`ALTER TABLE jam_masuk MODIFY COLUMN shift VARCHAR(30) NOT NULL`)
	for _, kolom := range jadwalHariKolom {
		db.Exec(fmt.Sprintf(`ALTER TABLE jadwal_pegawai MODIFY COLUMN %s VARCHAR(30) NOT NULL DEFAULT ''`, kolom))
	}
	db.Exec(`ALTER TABLE rekap_presensi MODIFY COLUMN shift VARCHAR(30) NOT NULL`)
	db.Exec(`ALTER TABLE temporary_presensi MODIFY COLUMN shift VARCHAR(30) NOT NULL`)
}

var jadwalHariKolom = []string{
	"h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10",
	"h11", "h12", "h13", "h14", "h15", "h16", "h17", "h18", "h19", "h20",
	"h21", "h22", "h23", "h24", "h25", "h26", "h27", "h28", "h29", "h30", "h31",
}

const hariAktifSetiapHari = "1,2,3,4,5,6,7"

func ensurePegawaiJadwalTetapTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS pegawai_jadwal_tetap (
			id INT NOT NULL PRIMARY KEY,
			shift VARCHAR(20) NOT NULL,
			hari_aktif VARCHAR(20) NOT NULL DEFAULT '` + hariAktifSetiapHari + `',
			CONSTRAINT fk_pegawai_jadwal_tetap_pegawai FOREIGN KEY (id)
				REFERENCES pegawai (id) ON DELETE CASCADE
		) ENGINE=InnoDB
	`)
}

// isoWeekday — 1=Senin..7=Minggu (beda dari time.Weekday() Go yang
// 0=Minggu..6=Sabtu), dipakai supaya konsisten dgn hari_aktif & JS
// getDay() di frontend (0=Minggu juga, tinggal geser sama).
func isoWeekday(t time.Time) int {
	w := int(t.Weekday())
	if w == 0 {
		return 7
	}
	return w
}

// getJadwalTetap — dipakai getShiftHariIni (presensi_handler.go) sebagai
// fallback saat jadwal_pegawai.h<tgl> kosong/tidak ada, HANYA kalau
// tanggal `tgl` termasuk hari_aktif jadwal tetapnya (kalau tidak,
// dianggap hari libur -> "").
func getJadwalTetap(db *sql.DB, pegawaiID int, tgl time.Time) string {
	var shift, hariAktif string
	if err := db.QueryRow(`SELECT shift, hari_aktif FROM pegawai_jadwal_tetap WHERE id = ?`, pegawaiID).Scan(&shift, &hariAktif); err != nil {
		return ""
	}
	hariIni := strconv.Itoa(isoWeekday(tgl))
	for _, h := range strings.Split(hariAktif, ",") {
		if strings.TrimSpace(h) == hariIni {
			return shift
		}
	}
	return ""
}

type JadwalPegawaiRow struct {
	ID               int        `json:"id"`
	NIK              string     `json:"nik"`
	Nama             string     `json:"nama"`
	Pendidikan       string     `json:"pendidikan"`
	Departemen       string     `json:"departemen"`
	JadwalTetapShift string     `json:"jadwal_tetap_shift"`
	JadwalTetapHari  string     `json:"jadwal_tetap_hari"`
	H                [31]string `json:"h"`
}

// GET /api/jadwal-pegawai/list?tahun=&bulan=&departemen=&search=
func getJadwalPegawaiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tahun := strings.TrimSpace(c.Query("tahun"))
		bulan := strings.TrimSpace(c.Query("bulan"))
		departemen := strings.TrimSpace(c.Query("departemen"))
		search := strings.TrimSpace(c.Query("search"))
		if tahun == "" || bulan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tahun dan bulan wajib diisi"})
			return
		}

		query := `
			SELECT pegawai.id, pegawai.nik, pegawai.nama, COALESCE(pegawai.pendidikan,''), COALESCE(pegawai.departemen,''),
				COALESCE(pegawai_jadwal_tetap.shift,''), COALESCE(pegawai_jadwal_tetap.hari_aktif,'')
			FROM pegawai
			LEFT JOIN pegawai_jadwal_tetap ON pegawai_jadwal_tetap.id = pegawai.id
			WHERE pegawai.stts_aktif <> 'KELUAR'`
		args := []interface{}{}
		if departemen != "" {
			query += " AND pegawai.departemen = ?"
			args = append(args, departemen)
		}
		if search != "" {
			query += " AND (pegawai.nik LIKE ? OR pegawai.nama LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		query += " ORDER BY pegawai.nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []JadwalPegawaiRow{}
		for rows.Next() {
			var r JadwalPegawaiRow
			if err := rows.Scan(&r.ID, &r.NIK, &r.Nama, &r.Pendidikan, &r.Departemen, &r.JadwalTetapShift, &r.JadwalTetapHari); err != nil {
				continue
			}
			list = append(list, r)
		}

		// Ambil jadwal h1..h31 per pegawai (kalau ada baris jadwal_pegawai
		// utk tahun/bulan itu) — query terpisah per pegawai, sama seperti
		// pola Java (ps2 di dalam loop), wajar krn jumlah pegawai per
		// halaman biasanya kecil.
		selectCols := strings.Join(jadwalHariKolom, ",")
		for i := range list {
			var h [31]string
			scanArgs := make([]interface{}, 31)
			for j := range h {
				scanArgs[j] = &h[j]
			}
			row := db.QueryRow(fmt.Sprintf(`SELECT %s FROM jadwal_pegawai WHERE id=? AND tahun=? AND bulan=?`, selectCols), list[i].ID, tahun, bulan)
			if err := row.Scan(scanArgs...); err == nil {
				list[i].H = h
			}
		}

		c.JSON(http.StatusOK, list)
	}
}

type JadwalPegawaiSaveRow struct {
	ID int        `json:"id" binding:"required"`
	H  [31]string `json:"h"`
}

type JadwalPegawaiSavePayload struct {
	Tahun string                 `json:"tahun" binding:"required"`
	Bulan string                 `json:"bulan" binding:"required"`
	Rows  []JadwalPegawaiSaveRow `json:"rows" binding:"required"`
}

// PUT /api/jadwal-pegawai — simpan sekelompok baris (pegawai) sekaligus
// utk satu tahun/bulan, padanan BtnSimpanActionPerformed di
// DlgJadwalPegawai.java (loop semua baris yang tampil, upsert tiap
// baris).
func saveJadwalPegawai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p JadwalPegawaiSavePayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(p.Rows) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada baris untuk disimpan"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		placeholders := strings.Repeat("?,", 34)
		placeholders = placeholders[:len(placeholders)-1]
		updateClause := make([]string, len(jadwalHariKolom))
		for i, kol := range jadwalHariKolom {
			updateClause[i] = fmt.Sprintf("%s=VALUES(%s)", kol, kol)
		}
		query := fmt.Sprintf(
			`INSERT INTO jadwal_pegawai (id, tahun, bulan, %s) VALUES (%s) ON DUPLICATE KEY UPDATE %s`,
			strings.Join(jadwalHariKolom, ","), placeholders, strings.Join(updateClause, ","),
		)

		for _, row := range p.Rows {
			args := make([]interface{}, 0, 34)
			args = append(args, row.ID, p.Tahun, p.Bulan)
			for _, v := range row.H {
				args = append(args, v)
			}
			if _, err := tx.Exec(query, args...); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jadwal berhasil disimpan"})
	}
}

// DELETE /api/jadwal-pegawai/:id?tahun=&bulan= — hapus jadwal satu
// pegawai utk satu bulan, padanan BtnHapusActionPerformed.
func deleteJadwalPegawai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		tahun := c.Query("tahun")
		bulan := c.Query("bulan")
		if tahun == "" || bulan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tahun dan bulan wajib diisi"})
			return
		}
		if _, err := db.Exec(`DELETE FROM jadwal_pegawai WHERE id=? AND tahun=? AND bulan=?`, id, tahun, bulan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jadwal berhasil dihapus"})
	}
}

type JamMasukOpsi struct {
	Shift     string `json:"shift"`
	JamMasuk  string `json:"jam_masuk"`
	JamPulang string `json:"jam_pulang"`
}

// GET /api/jam-masuk/opsi — daftar shift utk picker sel jadwal, padanan
// DlgJamMasuk.java (dialog kecil yang dibuka Java saat pilih shift per
// sel, lihat tbJadwalKeyPressed).
func getJamMasukOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT shift, jam_masuk, jam_pulang FROM jam_masuk ORDER BY shift`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []JamMasukOpsi{}
		for rows.Next() {
			var j JamMasukOpsi
			if err := rows.Scan(&j.Shift, &j.JamMasuk, &j.JamPulang); err == nil {
				list = append(list, j)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

type JamMasukPayload struct {
	Shift     string `json:"shift" binding:"required"`
	JamMasuk  string `json:"jam_masuk" binding:"required"`
	JamPulang string `json:"jam_pulang" binding:"required"`
}

// POST /api/jam-masuk — tambah shift baru dgn nama bebas (kolom `shift`
// sudah VARCHAR sejak ensureShiftColumnsVarchar, tidak lagi dibatasi
// daftar enum Khanza).
func tambahJamMasuk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p JamMasukPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		p.Shift = strings.TrimSpace(p.Shift)
		if p.Shift == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama shift wajib diisi"})
			return
		}
		if len(p.Shift) > 30 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama shift maksimal 30 karakter"})
			return
		}
		_, err := db.Exec(`INSERT INTO jam_masuk (shift, jam_masuk, jam_pulang) VALUES (?, ?, ?)`, p.Shift, p.JamMasuk, p.JamPulang)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Shift ini sudah ada"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Shift berhasil ditambahkan"})
	}
}

type JamMasukEditPayload struct {
	Shift     string `json:"shift" binding:"required"` // nama baru (boleh sama dgn nama lama = tidak rename)
	JamMasuk  string `json:"jam_masuk" binding:"required"`
	JamPulang string `json:"jam_pulang" binding:"required"`
}

// PUT /api/jam-masuk/:shift — edit jam masuk/pulang, DAN nama shift
// (rename) kalau `shift` di body beda dari :shift di URL. Rename di-
// cascade dalam satu transaksi ke semua tabel yang menyimpan nama shift
// sbg string apa adanya (bukan FK sungguhan): jadwal_pegawai.h1..h31,
// rekap_presensi.shift, pegawai_jadwal_tetap.shift, temporary_presensi
// .shift — supaya tidak ada jadwal yang jadi "yatim" merujuk nama lama
// yang sudah tidak ada.
func editJamMasuk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		shiftLama := c.Param("shift")
		var p JamMasukEditPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		shiftBaru := strings.TrimSpace(p.Shift)
		if shiftBaru == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama shift wajib diisi"})
			return
		}
		if len(shiftBaru) > 30 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama shift maksimal 30 karakter"})
			return
		}

		if shiftBaru == shiftLama {
			res, err := db.Exec(`UPDATE jam_masuk SET jam_masuk=?, jam_pulang=? WHERE shift=?`, p.JamMasuk, p.JamPulang, shiftLama)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n, _ := res.RowsAffected(); n == 0 {
				c.JSON(http.StatusNotFound, gin.H{"error": "Shift tidak ditemukan"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Shift berhasil diperbarui"})
			return
		}

		// Rename — pastikan nama baru belum dipakai shift lain dulu.
		var sudahAda int
		db.QueryRow(`SELECT COUNT(*) FROM jam_masuk WHERE shift = ?`, shiftBaru).Scan(&sudahAda)
		if sudahAda > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Nama shift '%s' sudah dipakai", shiftBaru)})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		res, err := tx.Exec(`UPDATE jam_masuk SET shift=?, jam_masuk=?, jam_pulang=? WHERE shift=?`, shiftBaru, p.JamMasuk, p.JamPulang, shiftLama)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Shift tidak ditemukan"})
			return
		}
		for _, kolom := range jadwalHariKolom {
			if _, err := tx.Exec(fmt.Sprintf(`UPDATE jadwal_pegawai SET %s=? WHERE %s=?`, kolom, kolom), shiftBaru, shiftLama); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if _, err := tx.Exec(`UPDATE rekap_presensi SET shift=? WHERE shift=?`, shiftBaru, shiftLama); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`UPDATE pegawai_jadwal_tetap SET shift=? WHERE shift=?`, shiftBaru, shiftLama); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`UPDATE temporary_presensi SET shift=? WHERE shift=?`, shiftBaru, shiftLama); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Shift berhasil diganti nama dari '%s' menjadi '%s'", shiftLama, shiftBaru)})
	}
}

// DELETE /api/jam-masuk/:shift — hapus shift, DITOLAK kalau masih
// dipakai di jadwal_pegawai (kolom h1..h31), pegawai_jadwal_tetap, atau
// rekap_presensi — karena kolom-kolom itu cuma VARCHAR biasa (bukan FK
// sungguhan ke jam_masuk.shift), MySQL tidak akan mencegah penghapusan
// sendiri, jadi dicek manual di sini supaya tidak ada jadwal yang jadi
// "yatim" (merujuk shift yang
// sudah tidak ada di jam_masuk).
func hapusJamMasuk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		shift := c.Param("shift")

		hKolomCheck := make([]string, len(jadwalHariKolom))
		for i, k := range jadwalHariKolom {
			hKolomCheck[i] = fmt.Sprintf("SUM(%s = ?) ", k)
		}
		var totalJadwal int
		args := make([]interface{}, len(jadwalHariKolom))
		for i := range args {
			args[i] = shift
		}
		row := db.QueryRow(fmt.Sprintf(`SELECT COALESCE(SUM(x), 0) FROM (SELECT %s AS x FROM jadwal_pegawai) t`, strings.Join(hKolomCheck, "+")), args...)
		row.Scan(&totalJadwal)

		var totalTetap, totalRekap int
		db.QueryRow(`SELECT COUNT(*) FROM pegawai_jadwal_tetap WHERE shift = ?`, shift).Scan(&totalTetap)
		db.QueryRow(`SELECT COUNT(*) FROM rekap_presensi WHERE shift = ?`, shift).Scan(&totalRekap)

		if totalJadwal > 0 || totalTetap > 0 || totalRekap > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf(
				"Shift ini masih dipakai (%d jadwal harian, %d jadwal tetap, %d riwayat presensi) — hapus/ganti dulu pemakaiannya sebelum menghapus shift.",
				totalJadwal, totalTetap, totalRekap,
			)})
			return
		}

		res, err := db.Exec(`DELETE FROM jam_masuk WHERE shift = ?`, shift)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Shift tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Shift berhasil dihapus"})
	}
}

type PegawaiJadwalTetapPayload struct {
	IDs       []int  `json:"ids" binding:"required"`
	Shift     string `json:"shift" binding:"required"`
	HariAktif []int  `json:"hari_aktif" binding:"required"` // 1=Senin..7=Minggu
}

// PUT /api/pegawai-jadwal-tetap — set jadwal tetap (shift + hari aktif)
// utk banyak pegawai sekaligus (mis. HRD filter Departemen=IGD, centang
// beberapa pegawai, terapkan "Pagi, 7 hari" ke semuanya; atau utk staf
// kantor "08:00-17:00, Senin-Jumat" sekali klik).
func setPegawaiJadwalTetapBulk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PegawaiJadwalTetapPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(p.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada pegawai yang dipilih"})
			return
		}
		if len(p.HariAktif) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu hari aktif"})
			return
		}
		hariStr := make([]string, len(p.HariAktif))
		for i, h := range p.HariAktif {
			if h < 1 || h > 7 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "hari_aktif harus antara 1 (Senin) - 7 (Minggu)"})
				return
			}
			hariStr[i] = strconv.Itoa(h)
		}
		hariAktifCSV := strings.Join(hariStr, ",")

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, id := range p.IDs {
			if _, err := tx.Exec(
				`INSERT INTO pegawai_jadwal_tetap (id, shift, hari_aktif) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE shift=VALUES(shift), hari_aktif=VALUES(hari_aktif)`,
				id, p.Shift, hariAktifCSV,
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
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Jadwal tetap berhasil diterapkan ke %d pegawai", len(p.IDs))})
	}
}

type PegawaiJadwalTanggalPayload struct {
	IDs     []int  `json:"ids" binding:"required"`
	Tahun   string `json:"tahun" binding:"required"`
	Bulan   string `json:"bulan" binding:"required"`
	Tanggal []int  `json:"tanggal" binding:"required"` // hari dlm bulan, 1-31
	Shift   string `json:"shift" binding:"required"`
}

// PUT /api/pegawai-jadwal-tanggal — set shift ke TANGGAL KALENDER
// spesifik (bukan hari berulang spt pegawai_jadwal_tetap) utk banyak
// pegawai sekaligus — dipakai staf shift rotasi (mis. jaga malam
// tanggal 15 & 22 doang, bukan tiap minggu). Nulis ke jadwal_pegawai
// (grid h1..h31 yang sama dgn saveJadwalPegawai di atas), TAPI cuma
// UPDATE kolom h<tanggal> yang dipilih per query (bukan upsert 31 kolom
// sekaligus) — supaya tanggal lain yang sudah keisi di bulan yg sama
// (dari sesi bulk-assign lain, atau grid manual) TIDAK ikut tertimpa
// kosong.
func setJadwalPegawaiTanggalBulk(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PegawaiJadwalTanggalPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(p.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada pegawai yang dipilih"})
			return
		}
		if len(p.Tanggal) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu tanggal"})
			return
		}
		for _, d := range p.Tanggal {
			if d < 1 || d > 31 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal harus antara 1-31"})
				return
			}
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, id := range p.IDs {
			for _, d := range p.Tanggal {
				kolom := jadwalHariKolom[d-1]
				query := fmt.Sprintf(
					`INSERT INTO jadwal_pegawai (id, tahun, bulan, %s) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE %s=VALUES(%s)`,
					kolom, kolom, kolom,
				)
				if _, err := tx.Exec(query, id, p.Tahun, p.Bulan, p.Shift); err != nil {
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
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Jadwal tanggal berhasil diterapkan ke %d pegawai", len(p.IDs))})
	}
}

// DELETE /api/pegawai-jadwal-tetap/:id — hapus jadwal tetap (pegawai
// kembali tidak punya jadwal otomatis, harus diisi manual per hari lewat
// grid kalau perlu).
func deletePegawaiJadwalTetap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		if _, err := db.Exec(`DELETE FROM pegawai_jadwal_tetap WHERE id=?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Jadwal tetap berhasil dihapus"})
	}
}
