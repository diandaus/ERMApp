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
// KEPEGAWAIAN — Presensi Mandiri (self check-in/out lewat HP) + Rekap
// Desktop, terpisah dari alur mesin fingerprint Khanza (DlgTemporaryPresensi
// .java: alat fingerprint isi `temporary_presensi`, staf HRD review manual
// lewat dialog itu baru masuk ke `rekap_presensi`). Presensi Mandiri di sini
// menulis LANGSUNG ke `rekap_presensi` (skip staging table) karena absen
// dari HP sendiri sudah otentik (foto + GPS), tidak perlu direview manual.
//
// rekap_presensi (9 kolom: id, shift, jam_datang, jam_pulang, status,
// keterlambatan, durasi, keterangan, photo) ditulis Java lewat
// "insert into rekap_presensi values(?,?,?,?,?,?,?,?,?)" (lihat
// DlgTemporaryPresensi.java baris 460/598/616) — fully positional, TAPI
// kita insert dengan nama kolom eksplisit di sini jadi aman selama TIDAK
// menambah kolom baru ke tabel ini. Field baru (lat/lng/alamat, foto
// checkout) disimpan di tabel pendamping `rekap_presensi_ext` (1:1 lewat
// composite FK (id, jam_datang)), pola yang sama dengan petugas_ext /
// pembelian_ext.
//
// Status keterlambatan (Tepat Waktu / Terlambat Toleransi / Terlambat I /
// Terlambat II / ...& PSW) memakai nilai enum yang SAMA dengan skema
// Khanza (rekap_presensi.status), tapi ambang batas menit toleransinya
// TIDAK ditemukan di source Java yang bisa diakses (logika asli ada di
// tool import fingerprint eksternal) — jadi dipakai ambang batas
// sederhana yang wajar (toleransi <=15 menit, Terlambat I <=60 menit,
// sisanya Terlambat II). Sesuaikan hitungTerlambat() kalau HRD punya
// aturan resmi yang berbeda.
//
// Jadwal shift per pegawai memakai skema Khanza yang sudah ada:
// jadwal_pegawai (id, tahun, bulan, h1..h31 = nama shift per tanggal) +
// jam_masuk (shift -> jam_masuk/jam_pulang). Kalau pegawai belum
// dijadwalkan (h<tgl> kosong), presensi tetap tercatat tapi status
// langsung "Tepat Waktu" (tidak ada acuan buat menilai telat/tidak) —
// UI mobile & rekap menampilkan catatan "Tidak ada jadwal shift".
// ============================================================================

func ensureRekapPresensiExtTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS rekap_presensi_ext (
			id INT NOT NULL,
			jam_datang DATETIME NOT NULL,
			lat_in DECIMAL(10,7) NULL,
			lng_in DECIMAL(10,7) NULL,
			alamat_in VARCHAR(255) NULL,
			lat_out DECIMAL(10,7) NULL,
			lng_out DECIMAL(10,7) NULL,
			alamat_out VARCHAR(255) NULL,
			photo_out VARCHAR(500) NULL,
			PRIMARY KEY (id, jam_datang),
			CONSTRAINT fk_rekap_presensi_ext FOREIGN KEY (id, jam_datang)
				REFERENCES rekap_presensi (id, jam_datang) ON DELETE CASCADE
		) ENGINE=InnoDB
	`)
}

// photo (kalau ada) berisi path legacy Khanza desktop apa adanya (mis.
// "pages/pegawai/photo/xxx.jpg") — BUKAN URL yang bisa diakses backend
// web ini (tidak ada static route utk folder itu, filenya juga belum
// tentu ada di server ini). Pemanggil di frontend HARUS memvalidasi
// formatnya (awalan /uploads/ atau http) sebelum dipakai sebagai <img
// src>, dan fallback ke avatar inisial kalau tidak valid.
func resolvePegawaiID(db *sql.DB, nik string) (id int, nama string, photo string, err error) {
	err = db.QueryRow(`SELECT id, nama, COALESCE(photo,'') FROM pegawai WHERE nik = ?`, nik).Scan(&id, &nama, &photo)
	return
}

// getShiftHariIni — prioritas: 1) override eksplisit di grid
// jadwal_pegawai utk tanggal itu (dipakai HRD utk pengecualian: tukar
// shift, dll), 2) fallback ke pegawai_jadwal_tetap (shift berulang,
// lihat jadwal_pegawai_handler.go) kalau overridenya kosong DAN tanggal
// ini termasuk hari_aktif jadwal tetapnya (di luar itu = libur).
func getShiftHariIni(db *sql.DB, pegawaiID int, tgl time.Time) string {
	kolomHari := fmt.Sprintf("h%d", tgl.Day())
	bulan := fmt.Sprintf("%02d", int(tgl.Month()))
	query := fmt.Sprintf(`SELECT %s FROM jadwal_pegawai WHERE id = ? AND tahun = ? AND bulan = ?`, kolomHari)
	var shift string
	if err := db.QueryRow(query, pegawaiID, tgl.Year(), bulan).Scan(&shift); err == nil {
		shift = strings.TrimSpace(shift)
		if shift != "" {
			return shift
		}
	}
	return getJadwalTetap(db, pegawaiID, tgl)
}

type jamShift struct {
	masuk  string // "HH:MM:SS"
	pulang string
}

func getJamShift(db *sql.DB, shift string) (jamShift, bool) {
	if shift == "" {
		return jamShift{}, false
	}
	var masuk, pulang string
	if err := db.QueryRow(`SELECT jam_masuk, jam_pulang FROM jam_masuk WHERE shift = ?`, shift).Scan(&masuk, &pulang); err != nil {
		return jamShift{}, false
	}
	return jamShift{masuk: masuk, pulang: pulang}, true
}

func combineTanggalJam(tgl time.Time, jam string) (time.Time, bool) {
	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", tgl.Format("2006-01-02")+" "+jam, time.Local)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func formatDurasiMenit(menit int) string {
	if menit < 0 {
		menit = 0
	}
	j := menit / 60
	m := menit % 60
	if j > 0 {
		return fmt.Sprintf("%dj %dm", j, m)
	}
	return fmt.Sprintf("%dm", m)
}

// hitungTerlambat — lihat catatan "Penyederhanaan yang disengaja" di atas
// berkas ini soal ambang batas menit.
func hitungTerlambat(jadwalMasuk time.Time, actual time.Time) (status string, keterlambatan string) {
	diff := int(actual.Sub(jadwalMasuk).Minutes())
	if diff <= 0 {
		return "Tepat Waktu", "-"
	}
	switch {
	case diff <= 15:
		status = "Terlambat Toleransi"
	case diff <= 60:
		status = "Terlambat I"
	default:
		status = "Terlambat II"
	}
	return status, formatDurasiMenit(diff)
}

// ---------------------------------------------------------------------
// GET /api/presensi/me?nik=...
// ---------------------------------------------------------------------

type PresensiHariIni struct {
	SudahCheckin    bool   `json:"sudah_checkin"`
	SudahCheckout   bool   `json:"sudah_checkout"`
	JamDatang       string `json:"jam_datang"`
	JamPulang       string `json:"jam_pulang"`
	Status          string `json:"status"`
	Keterlambatan   string `json:"keterlambatan"`
	Shift           string `json:"shift"`
	JamMasukJadwal  string `json:"jam_masuk_jadwal"`  // "HH:MM" — kosong kalau pegawai belum dijadwalkan shift hari ini
	JamPulangJadwal string `json:"jam_pulang_jadwal"` // "HH:MM"
}

type PerformaBulanIni struct {
	PersentaseKehadiran float64 `json:"persentase_kehadiran"`
	TotalHariKerja      int     `json:"total_hari_kerja"`
	TotalHariTerjadwal  int     `json:"total_hari_terjadwal"`
	RataRataJamKerja    float64 `json:"rata_rata_jam_kerja"`
}

func getPresensiMe(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		id, nama, photo, err := resolvePegawaiID(db, nik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai — hubungi admin"})
			return
		}

		today := time.Now()
		hariIni := PresensiHariIni{Shift: getShiftHariIni(db, id, today)}
		if js, ok := getJamShift(db, hariIni.Shift); ok {
			// jamShift.masuk/pulang format "HH:MM:SS" — potong ke "HH:MM" saja utk tampilan.
			if len(js.masuk) >= 5 {
				hariIni.JamMasukJadwal = js.masuk[:5]
			}
			if len(js.pulang) >= 5 {
				hariIni.JamPulangJadwal = js.pulang[:5]
			}
		}
		var jamDatang time.Time
		var jamPulang sql.NullTime
		var status, keterlambatan string
		row := db.QueryRow(`
			SELECT jam_datang, jam_pulang, status, keterlambatan
			FROM rekap_presensi
			WHERE id = ? AND DATE(jam_datang) = CURDATE()
			ORDER BY jam_datang DESC LIMIT 1`, id)
		if err := row.Scan(&jamDatang, &jamPulang, &status, &keterlambatan); err == nil {
			hariIni.SudahCheckin = true
			hariIni.JamDatang = jamDatang.Format("15:04")
			hariIni.Status = status
			hariIni.Keterlambatan = keterlambatan
			if jamPulang.Valid {
				hariIni.SudahCheckout = true
				hariIni.JamPulang = jamPulang.Time.Format("15:04")
			}
		}

		// Performa bulan berjalan — hari terjadwal dihitung dari jumlah
		// kolom h1..h31 yang tidak kosong bulan ini; kalau pegawai belum
		// punya jadwal sama sekali, dipakai jumlah hari kalender berjalan
		// (s/d hari ini) sebagai penyebut supaya tidak dibagi nol.
		bulan := fmt.Sprintf("%02d", int(today.Month()))
		totalTerjadwal := 0
		var kolomVal [31]string
		rowJadwal := db.QueryRow(`SELECT h1,h2,h3,h4,h5,h6,h7,h8,h9,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,h21,h22,h23,h24,h25,h26,h27,h28,h29,h30,h31 FROM jadwal_pegawai WHERE id=? AND tahun=? AND bulan=?`, id, today.Year(), bulan)
		scanArgs := make([]interface{}, 31)
		for i := range kolomVal {
			scanArgs[i] = &kolomVal[i]
		}
		if err := rowJadwal.Scan(scanArgs...); err == nil {
			for _, v := range kolomVal {
				if strings.TrimSpace(v) != "" {
					totalTerjadwal++
				}
			}
		}
		if totalTerjadwal == 0 {
			totalTerjadwal = today.Day()
		}

		var totalHadir int
		var rataJamKerja sql.NullFloat64
		db.QueryRow(`
			SELECT COUNT(*), AVG(TIMESTAMPDIFF(MINUTE, jam_datang, jam_pulang))
			FROM rekap_presensi
			WHERE id = ? AND YEAR(jam_datang) = ? AND MONTH(jam_datang) = ?`,
			id, today.Year(), int(today.Month())).Scan(&totalHadir, &rataJamKerja)

		performa := PerformaBulanIni{
			TotalHariKerja:     totalHadir,
			TotalHariTerjadwal: totalTerjadwal,
		}
		if totalTerjadwal > 0 {
			performa.PersentaseKehadiran = float64(totalHadir) / float64(totalTerjadwal) * 100
		}
		if rataJamKerja.Valid {
			performa.RataRataJamKerja = rataJamKerja.Float64 / 60
		}

		c.JSON(http.StatusOK, gin.H{
			"nama":     nama,
			"photo":    photo,
			"hari_ini": hariIni,
			"performa": performa,
		})
	}
}

// ---------------------------------------------------------------------
// POST /api/presensi/checkin
// ---------------------------------------------------------------------

type PresensiCheckinPayload struct {
	NIK    string  `json:"nik" binding:"required"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Alamat string  `json:"alamat"`
	Photo  string  `json:"photo"` // URL hasil /api/upload
}

func presensiCheckin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PresensiCheckinPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		id, _, _, err := resolvePegawaiID(db, p.NIK)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai — hubungi admin"})
			return
		}

		var sudahAda int
		db.QueryRow(`SELECT COUNT(*) FROM rekap_presensi WHERE id=? AND DATE(jam_datang)=CURDATE() AND jam_pulang IS NULL`, id).Scan(&sudahAda)
		if sudahAda > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Anda sudah check-in hari ini dan belum check-out"})
			return
		}

		now := time.Now()
		shift := getShiftHariIni(db, id, now)
		status := "Tepat Waktu"
		keterlambatan := "-"
		if js, ok := getJamShift(db, shift); ok {
			if jadwalMasuk, ok2 := combineTanggalJam(now, js.masuk); ok2 {
				status, keterlambatan = hitungTerlambat(jadwalMasuk, now)
			}
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = tx.Exec(`
			INSERT INTO rekap_presensi (id, shift, jam_datang, jam_pulang, status, keterlambatan, durasi, keterangan, photo)
			VALUES (?, ?, ?, NULL, ?, ?, '-', 'Presensi Mandiri (Mobile)', ?)`,
			id, nullableShift(shift), now, status, keterlambatan, p.Photo)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = tx.Exec(`
			INSERT INTO rekap_presensi_ext (id, jam_datang, lat_in, lng_in, alamat_in)
			VALUES (?, ?, ?, ?, ?)`,
			id, now, p.Lat, p.Lng, p.Alamat)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Check-in berhasil", "status": status, "keterlambatan": keterlambatan, "jam": now.Format("15:04")})
	}
}

// rekap_presensi.shift adalah enum NOT NULL tanpa nilai kosong valid —
// kalau pegawai belum dijadwalkan, dipakai nilai enum pertama ("Pagi")
// hanya sebagai placeholder penyimpanan; keterangan tetap mencatat tidak
// ada jadwal lewat status "Tepat Waktu" apa adanya (tidak ada dasar utk
// menilai telat).
func nullableShift(shift string) string {
	if shift == "" {
		return "Pagi"
	}
	return shift
}

// ---------------------------------------------------------------------
// POST /api/presensi/checkout
// ---------------------------------------------------------------------

type PresensiCheckoutPayload struct {
	NIK    string  `json:"nik" binding:"required"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Alamat string  `json:"alamat"`
	Photo  string  `json:"photo"`
}

func presensiCheckout(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PresensiCheckoutPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		id, _, _, err := resolvePegawaiID(db, p.NIK)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai — hubungi admin"})
			return
		}

		var jamDatang time.Time
		var status string
		var shift string
		errRow := db.QueryRow(`
			SELECT jam_datang, status, shift FROM rekap_presensi
			WHERE id=? AND DATE(jam_datang)=CURDATE() AND jam_pulang IS NULL
			ORDER BY jam_datang DESC LIMIT 1`, id).Scan(&jamDatang, &status, &shift)
		if errRow != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Belum check-in hari ini"})
			return
		}

		now := time.Now()
		durasiMenit := int(now.Sub(jamDatang).Minutes())
		durasi := formatDurasiMenit(durasiMenit)

		if js, ok := getJamShift(db, shift); ok {
			if jadwalPulang, ok2 := combineTanggalJam(jamDatang, js.pulang); ok2 {
				if jadwalMasuk, ok3 := combineTanggalJam(jamDatang, js.masuk); ok3 && jadwalPulang.Before(jadwalMasuk) {
					jadwalPulang = jadwalPulang.AddDate(0, 0, 1)
				}
				if now.Before(jadwalPulang) && !strings.Contains(status, "PSW") {
					status = status + " & PSW"
				}
			}
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = tx.Exec(`UPDATE rekap_presensi SET jam_pulang=?, durasi=?, status=? WHERE id=? AND jam_datang=?`,
			now, durasi, status, id, jamDatang)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = tx.Exec(`UPDATE rekap_presensi_ext SET lat_out=?, lng_out=?, alamat_out=?, photo_out=? WHERE id=? AND jam_datang=?`,
			p.Lat, p.Lng, p.Alamat, p.Photo, id, jamDatang)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Check-out berhasil", "status": status, "durasi": durasi, "jam": now.Format("15:04")})
	}
}

// ---------------------------------------------------------------------
// GET /api/presensi/riwayat?nik=&bulan=&tahun=
// ---------------------------------------------------------------------

type RiwayatPresensiRow struct {
	Tanggal       string `json:"tanggal"`
	Shift         string `json:"shift"`
	JamDatang     string `json:"jam_datang"`
	JamPulang     string `json:"jam_pulang"`
	Status        string `json:"status"`
	Keterlambatan string `json:"keterlambatan"`
	Durasi        string `json:"durasi"`
}

func getPresensiRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		id, _, _, err := resolvePegawaiID(db, nik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		now := time.Now()
		bulan := c.DefaultQuery("bulan", fmt.Sprintf("%d", int(now.Month())))
		tahun := c.DefaultQuery("tahun", fmt.Sprintf("%d", now.Year()))
		bulanI, _ := strconv.Atoi(bulan)
		tahunI, _ := strconv.Atoi(tahun)

		rows, err := db.Query(`
			SELECT DATE_FORMAT(jam_datang,'%Y-%m-%d'), shift, DATE_FORMAT(jam_datang,'%H:%i'),
				COALESCE(DATE_FORMAT(jam_pulang,'%H:%i'),''), status, keterlambatan, COALESCE(durasi,'-')
			FROM rekap_presensi
			WHERE id=? AND YEAR(jam_datang)=? AND MONTH(jam_datang)=?
			ORDER BY jam_datang DESC`, id, tahunI, bulanI)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []RiwayatPresensiRow{}
		for rows.Next() {
			var r RiwayatPresensiRow
			if err := rows.Scan(&r.Tanggal, &r.Shift, &r.JamDatang, &r.JamPulang, &r.Status, &r.Keterlambatan, &r.Durasi); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// ---------------------------------------------------------------------
// GET /api/presensi/rekap?tanggal_awal=&tanggal_akhir=&search=
// (Rekap desktop utk HRD — semua pegawai)
// ---------------------------------------------------------------------

type RekapPresensiRow struct {
	NIK           string `json:"nik"`
	Nama          string `json:"nama"`
	Tanggal       string `json:"tanggal"`
	Shift         string `json:"shift"`
	JamDatang     string `json:"jam_datang"`
	JamPulang     string `json:"jam_pulang"`
	Status        string `json:"status"`
	Keterlambatan string `json:"keterlambatan"`
	Durasi        string `json:"durasi"`
}

func getPresensiRekap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglAwal := strings.TrimSpace(c.DefaultQuery("tanggal_awal", time.Now().Format("2006-01-02")))
		tglAkhir := strings.TrimSpace(c.DefaultQuery("tanggal_akhir", time.Now().Format("2006-01-02")))
		search := strings.TrimSpace(c.DefaultQuery("search", ""))

		query := `
			SELECT pegawai.nik, pegawai.nama, DATE_FORMAT(rekap_presensi.jam_datang,'%Y-%m-%d'),
				rekap_presensi.shift, DATE_FORMAT(rekap_presensi.jam_datang,'%H:%i'),
				COALESCE(DATE_FORMAT(rekap_presensi.jam_pulang,'%H:%i'),''),
				rekap_presensi.status, rekap_presensi.keterlambatan, COALESCE(rekap_presensi.durasi,'-')
			FROM rekap_presensi
			INNER JOIN pegawai ON pegawai.id = rekap_presensi.id
			WHERE DATE(rekap_presensi.jam_datang) BETWEEN ? AND ?`
		args := []interface{}{tglAwal, tglAkhir}
		if search != "" {
			query += ` AND (pegawai.nik LIKE ? OR pegawai.nama LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		query += ` ORDER BY rekap_presensi.jam_datang DESC`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []RekapPresensiRow{}
		for rows.Next() {
			var r RekapPresensiRow
			if err := rows.Scan(&r.NIK, &r.Nama, &r.Tanggal, &r.Shift, &r.JamDatang, &r.JamPulang, &r.Status, &r.Keterlambatan, &r.Durasi); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// ---------------------------------------------------------------------
// GET /api/presensi/jadwal?nik=&bulan=&tahun=
// Jadwal shift pegawai satu bulan penuh (read-only), dari skema Khanza
// jadwal_pegawai (h1..h31) + jam_masuk. TIDAK ada UI utk mengedit
// jadwal di sini — itu di luar cakupan fitur Presensi Mandiri, HRD
// mengatur jadwal shift lewat menu Khanza yang sudah ada.
// ---------------------------------------------------------------------

type JadwalHarianRow struct {
	Tanggal         string `json:"tanggal"`
	Shift           string `json:"shift"`
	JamMasuk        string `json:"jam_masuk"`
	JamPulang       string `json:"jam_pulang"`
	KeteranganLibur string `json:"keterangan_libur"` // nama hari libur (Kalender Libur Otomatis) kalau tanggal ini hari libur, kosong kalau bukan
}

func getPresensiJadwal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		id, _, _, err := resolvePegawaiID(db, nik)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		now := time.Now()
		bulanQ := c.DefaultQuery("bulan", fmt.Sprintf("%d", int(now.Month())))
		tahunQ := c.DefaultQuery("tahun", fmt.Sprintf("%d", now.Year()))
		bulanI, _ := strconv.Atoi(bulanQ)
		tahunI, _ := strconv.Atoi(tahunQ)
		if bulanI < 1 || bulanI > 12 {
			bulanI = int(now.Month())
		}
		bulan := fmt.Sprintf("%02d", bulanI)

		var kolomVal [31]string
		rowJadwal := db.QueryRow(`SELECT h1,h2,h3,h4,h5,h6,h7,h8,h9,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,h21,h22,h23,h24,h25,h26,h27,h28,h29,h30,h31 FROM jadwal_pegawai WHERE id=? AND tahun=? AND bulan=?`, id, tahunI, bulan)
		scanArgs := make([]interface{}, 31)
		for i := range kolomVal {
			scanArgs[i] = &kolomVal[i]
		}
		rowJadwal.Scan(scanArgs...) // kalau tidak ketemu, kolomVal tetap semua string kosong

		// Cache jam_masuk/jam_pulang per nama shift supaya tidak query
		// berulang utk shift yang sama di banyak tanggal.
		jamCache := map[string]jamShift{}
		jumlahHari := time.Date(tahunI, time.Month(bulanI)+1, 0, 0, 0, 0, 0, time.Local).Day()

		// Ambil semua hari libur bulan ini SEKALIGUS (bukan query per-tanggal
		// dalam loop) — dipakai murni utk keterangan visual "tanggal merah"
		// di tab Jadwal. Ditampilkan ke SEMUA pegawai apa adanya (termasuk
		// staf shift/rotasi yg tetap masuk sesuai jadwalnya di hari itu) —
		// beda dari getJadwalTetap yg cuma PENGARUHI shift pegawai reguler,
		// ini cuma INFORMASI "hari ini tanggal merah", tidak mengubah shift.
		liburBulanIni := map[string]string{}
		liburRows, errLibur := db.Query(`SELECT DATE_FORMAT(tanggal,'%Y-%m-%d'), keterangan FROM hari_libur WHERE YEAR(tanggal) = ? AND MONTH(tanggal) = ?`, tahunI, bulanI)
		if errLibur == nil {
			defer liburRows.Close()
			for liburRows.Next() {
				var tglLibur, ket string
				if liburRows.Scan(&tglLibur, &ket) == nil {
					liburBulanIni[tglLibur] = ket
				}
			}
		}

		list := make([]JadwalHarianRow, 0, jumlahHari)
		for d := 1; d <= jumlahHari; d++ {
			shift := ""
			if d <= 31 {
				shift = strings.TrimSpace(kolomVal[d-1])
			}
			tglHari := time.Date(tahunI, time.Month(bulanI), d, 0, 0, 0, 0, time.Local)
			if shift == "" {
				shift = getJadwalTetap(db, id, tglHari)
			}
			tglStr := fmt.Sprintf("%04d-%02d-%02d", tahunI, bulanI, d)
			row := JadwalHarianRow{
				Tanggal:         tglStr,
				Shift:           shift,
				KeteranganLibur: liburBulanIni[tglStr],
			}
			if shift != "" {
				js, ok := jamCache[shift]
				if !ok {
					js, ok = getJamShift(db, shift)
					jamCache[shift] = js
				}
				if ok {
					row.JamMasuk = js.masuk
					row.JamPulang = js.pulang
				}
			}
			list = append(list, row)
		}
		c.JSON(http.StatusOK, list)
	}
}

// ---------------------------------------------------------------------
// Tab "Saya" > Profil (PresensiMobile.tsx) — no_telp/email TIDAK ada di
// tabel `pegawai` (itu cuma identitas dasar bersama), tapi memang sudah
// ada sbg kolom asli di `petugas` DAN `dokter` (dua tabel identitas
// terpisah di Khanza per role) — jadi dicoba `petugas` dulu (WHERE
// nip=nik), fallback ke `dokter` (WHERE kd_dokter=nik), TANPA perlu
// tabel baru sama sekali.
// ---------------------------------------------------------------------

type PresensiProfil struct {
	NIK        string `json:"nik"`
	Nama       string `json:"nama"`
	NoTelp     string `json:"no_telp"`
	Email      string `json:"email"`
	Departemen string `json:"departemen"`
	Photo      string `json:"photo"`
}

// GET /api/presensi/profil?nik=
func getPresensiProfil(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		var p PresensiProfil
		p.NIK = nik
		err := db.QueryRow(`
			SELECT pegawai.nama, COALESCE(departemen.nama, pegawai.departemen, ''), COALESCE(pegawai.photo,'')
			FROM pegawai
			LEFT JOIN departemen ON departemen.dep_id = pegawai.departemen
			WHERE pegawai.nik = ?`, nik).Scan(&p.Nama, &p.Departemen, &p.Photo)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data pegawai tidak ditemukan"})
			return
		}

		if err := db.QueryRow(`SELECT COALESCE(no_telp,''), COALESCE(email,'') FROM petugas WHERE nip = ?`, nik).Scan(&p.NoTelp, &p.Email); err != nil {
			db.QueryRow(`SELECT COALESCE(no_telp,''), COALESCE(email,'') FROM dokter WHERE kd_dokter = ?`, nik).Scan(&p.NoTelp, &p.Email)
		}

		c.JSON(http.StatusOK, p)
	}
}

// PUT /api/presensi/profil/foto — ganti foto profil (upload dulu lewat
// /api/upload yang sudah ada, lalu kirim URL-nya ke sini). pegawai.photo
// kolom asli Khanza, UPDATE-only jadi aman thd insert positional Java.
func updatePresensiProfilFoto(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p struct {
			NIK   string `json:"nik" binding:"required"`
			Photo string `json:"photo" binding:"required"`
		}
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE pegawai SET photo=? WHERE nik=?`, p.Photo, p.NIK)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pegawai tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Foto profil berhasil diperbarui"})
	}
}
