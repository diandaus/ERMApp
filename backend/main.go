package main

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
)

// Struktur data sederhana yang menyesuaikan tabel utama di database Khanza.
// Tabel yang umum dipakai:
// - poliklinik (kd_poli, nm_poli, ...)
// - dokter (kd_dokter, nm_dokter, ...)
// - penjab (kd_pj, nm_pj, ...) untuk cara bayar
// - reg_periksa, pasien (untuk pendaftaran hari ini)

type Poli struct {
	KdPoli string `json:"kd_poli"`
	NmPoli string `json:"nm_poli"`
}

type Dokter struct {
	KdDokter string `json:"kd_dokter"`
	NmDokter string `json:"nm_dokter"`
}

type Petugas struct {
	NIP  string `json:"nip"`
	Nama string `json:"nama"`
}

type Penjab struct {
	KdPj string `json:"kd_pj"`
	NmPj string `json:"nm_pj"`
}

type RegToday struct {
	NoRawat       string `json:"no_rawat"`
	NoRkmMedis    string `json:"no_rkm_medis"`
	NmPasien      string `json:"nm_pasien"`
	TglRegistrasi string `json:"tgl_registrasi"`
	JamReg        string `json:"jam_reg"`
	KdPoli        string `json:"kd_poli"`
	NmPoli        string `json:"nm_poli"`
	KdDokter      string `json:"kd_dokter"`
	NmDokter      string `json:"nm_dokter"`
	StatusLanjut  string `json:"status_lanjut"`
	Stts          string `json:"stts"`
}

// Payload sederhana untuk pendaftaran rawat jalan baru.
type NewRegistration struct {
	NoRkmMedis string `json:"no_rkm_medis" binding:"required"`
	KdPoli     string `json:"kd_poli" binding:"required"`
	KdDokter   string `json:"kd_dokter" binding:"required"`
	KdPj       string `json:"kd_pj" binding:"required"`
	PJawab     string `json:"p_jawab"`
	HubunganPj string `json:"hubunganpj"`
	AlmtPj     string `json:"almt_pj"`
	SttsDaftar string `json:"stts_daftar"`
	NoReg      string `json:"no_reg"` // opsional: dari frontend via generate-noreg
}

// Informasi singkat pasien untuk ditampilkan di form pendaftaran.
type PatientBrief struct {
	NoRkmMedis string `json:"no_rkm_medis"`
	NmPasien   string `json:"nm_pasien"`
	Jk         string `json:"jk"`
	TmpLahir   string `json:"tmp_lahir"`
	TglLahir   string `json:"tgl_lahir"`
	Agama      string `json:"agama"`
	Bahasa     string `json:"bahasa"`
	CacatFisik string `json:"cacat_fisik"`
	GolDarah   string `json:"gol_darah"`
	NmIbu      string `json:"nm_ibu"`
	SttsNikah  string `json:"stts_nikah"`
	Pnd        string `json:"pnd"`
	Alamat     string `json:"alamat"`
	Pekerjaan  string `json:"pekerjaan"`
	Umur       string `json:"umur"`
	NoTlp      string `json:"no_tlp"`
}

type RawatInapPatient struct {
	NoRawat       string  `json:"no_rawat"`
	NoRkmMedis    string  `json:"no_rkm_medis"`
	NmPasien      string  `json:"nm_pasien"`
	Umur          string  `json:"umur"`
	Alamat        string  `json:"alamat"`
	PJawab        string  `json:"p_jawab"`
	HubunganPJ    string  `json:"hubunganpj"`
	PngJawab      string  `json:"png_jawab"`
	Kamar         string  `json:"kamar"`
	TrfKamar      float64 `json:"trf_kamar"`
	DiagnosaAwal  string  `json:"diagnosa_awal"`
	DiagnosaAkhir string  `json:"diagnosa_akhir"`
	TglMasuk      string  `json:"tgl_masuk"`
	JamMasuk      string  `json:"jam_masuk"`
	TglKeluar     string  `json:"tgl_keluar"`
	JamKeluar     string  `json:"jam_keluar"`
	TtlBiaya      float64 `json:"ttl_biaya"`
	SttsPulang    string  `json:"stts_pulang"`
	Lama          string  `json:"lama"`
	NmDokter      string  `json:"nm_dokter"`
	KdDokter      string  `json:"kd_dokter"`
	KdKamar       string  `json:"kd_kamar"`
	KdBangsal     string  `json:"kd_bangsal"`
	StatusBayar   string  `json:"status_bayar"`
	Agama         string  `json:"agama"`
}

type AppUser struct {
	ID             int    `json:"id"`
	Username       string `json:"username"`
	FullName       string `json:"full_name"`
	Role           string `json:"role"`
	IsActive       bool   `json:"is_active"`
	AllowedModules string `json:"allowed_modules"`
	Nip            string `json:"nip"`
	KdDokter       string `json:"kd_dokter"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type CreateUserRequest struct {
	Username       string `json:"username" binding:"required"`
	Password       string `json:"password" binding:"required"`
	FullName       string `json:"full_name" binding:"required"`
	Role           string `json:"role" binding:"required"`
	AllowedModules string `json:"allowed_modules"`
	Nip            string `json:"nip"`       // Optional — link ke petugas.nip, dipakai auto-fill kolom Petugas di form klinis (mis. Adime Gizi)
	KdDokter       string `json:"kd_dokter"` // Optional — link ke dokter.kd_dokter, dipakai membatasi Daftar Pasien Poli (RawatJalanView di App.tsx) ke pasien milik dokter ini saja saat role = 'dokter'
}

type UpdateUserRequest struct {
	FullName       string `json:"full_name" binding:"required"`
	Role           string `json:"role" binding:"required"`
	IsActive       bool   `json:"is_active" binding:"required"`
	Password       string `json:"password"`        // Optional
	AllowedModules string `json:"allowed_modules"` // Optional
	Nip            string `json:"nip"`             // Optional — link ke petugas.nip
	KdDokter       string `json:"kd_dokter"`       // Optional — link ke dokter.kd_dokter
}

type ResetPasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

type Settings struct {
	ID              int       `json:"id"`
	NamaInstansi    string    `json:"nama_instansi"`
	Alamat          string    `json:"alamat"`
	LogoURL         string    `json:"logo_url"`
	KotaRs          string    `json:"kota_rs"`
	Kontak          string    `json:"kontak"`
	EmailRs         string    `json:"email_rs"`
	KodePpkBpjs     string    `json:"kode_ppk_bpjs"`
	KodePpkKemenkes string    `json:"kode_ppk_kemenkes"`
	NomorIzinSarana string    `json:"nomor_izin_sarana"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func hashPassword(pw string) string {
	sum := sha256.Sum256([]byte(pw))
	return fmt.Sprintf("%x", sum[:])
}

// Inisialisasi tabel user khusus web jika belum ada,
// dan buat akun admin default (admin / admin123) untuk development.
func ensureAppUsersTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS app_users (
			id INT AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(50) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			full_name VARCHAR(100) NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'pendaftaran',
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			allowed_modules VARCHAR(500) NOT NULL DEFAULT '',
			nip VARCHAR(20) NOT NULL DEFAULT ''
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	if _, err := db.Exec(createTable); err != nil {
		return err
	}

	// Migrasi untuk tabel app_users yang sudah ada sebelum kolom ini ditambahkan
	if _, err := db.Exec(
		`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS allowed_modules VARCHAR(500) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	// Migrasi kolom nip — link ke petugas.nip (Khanza), dipakai untuk
	// auto-fill kolom Petugas di form klinis (mis. Adime Gizi di
	// PemeriksaanRanap.tsx) berdasarkan user yang sedang login, bukan
	// diketik manual tiap kali.
	if _, err := db.Exec(
		`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS nip VARCHAR(20) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	// Migrasi kolom kd_dokter — link ke dokter.kd_dokter (Khanza), dipakai
	// RawatJalanView (App.tsx) untuk membatasi Daftar Pasien Poli ke pasien
	// milik dokter ybs saat role akun = 'dokter'. Terpisah dari nip di atas
	// karena dokter & petugas adalah 2 tabel identitas berbeda di Khanza.
	if _, err := db.Exec(
		`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS kd_dokter VARCHAR(20) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	// Migrasi role dari ENUM lama ke VARCHAR agar bisa diisi role custom
	if _, err := db.Exec(
		`ALTER TABLE app_users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'pendaftaran'`,
	); err != nil {
		return err
	}

	// Buat user admin default jika belum ada
	adminHash := hashPassword("admin123")
	if _, err := db.Exec(
		`INSERT IGNORE INTO app_users (username, password_hash, full_name, role, is_active)
		 VALUES (?, ?, ?, ?, 1)`,
		"admin",
		adminHash,
		"Administrator",
		"admin",
	); err != nil {
		return err
	}

	return nil
}

// Inisialisasi tabel setting_simrs_web untuk pengaturan instansi
func ensureSettingsTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS setting_simrs_web (
			id INT AUTO_INCREMENT PRIMARY KEY,
			nama_instansi VARCHAR(255) NOT NULL DEFAULT '',
			alamat TEXT NOT NULL,
			logo_url VARCHAR(500) DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	if _, err := db.Exec(createTable); err != nil {
		return err
	}

	// Migrasi kolom kota_rs — "Kota/Kabupaten RS" (padanan
	// akses.getkabupatenrs() Khanza Desktop), dipakai di blok tanda
	// tangan elektronik cetakan PDF (mis. Detail Pemberian Obat):
	// "Dikeluarkan di {nama_instansi}, Kabupaten/Kota {kota_rs}".
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS kota_rs VARCHAR(255) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	// Migrasi kolom kontak/email_rs — padanan akses.getkontakrs()/
	// getemailrs() Khanza Desktop (baris "{kontak}, E-mail : {email}" di
	// kop cetakan). kode_ppk_bpjs/kode_ppk_kemenkes — kode provider RS
	// yang ditugaskan BPJS Kesehatan & Kemenkes (Kode Fasyankes), padanan
	// akses.getkodeppk()-style field identitas RS Khanza — dipakai
	// tampilan/identitas, BUKAN kredensial API bridging (itu tetap di
	// bridging_config terpisah, mis. CONSID/SECRETKEY layanan bpjs_vclaim).
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS kontak VARCHAR(255) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS email_rs VARCHAR(255) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS kode_ppk_bpjs VARCHAR(50) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS kode_ppk_kemenkes VARCHAR(50) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	// Migrasi kolom nomor_izin_sarana — Nomor Izin Sarana (izin operasional
	// RS/sarana kesehatan dari Dinkes/Kemenkes), field identitas legal RS
	// yang belum ada padanannya di kolom-kolom sebelumnya — dipakai
	// tampilan/identitas instansi, bisa dipakai di kop cetakan resmi
	// (mis. Surat Pesanan Obat-obat Tertentu/Prekursor) kalau diperlukan.
	if _, err := db.Exec(
		`ALTER TABLE setting_simrs_web ADD COLUMN IF NOT EXISTS nomor_izin_sarana VARCHAR(100) NOT NULL DEFAULT ''`,
	); err != nil {
		return err
	}

	return nil
}

func ensureSatuSehatTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS satu_sehat_konfigurasi (
			kode VARCHAR(100) PRIMARY KEY,
			nilai TEXT NOT NULL DEFAULT '',
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS satu_sehat_servicerequest_radiologi (
			id INT AUTO_INCREMENT PRIMARY KEY,
			noorder VARCHAR(20) NOT NULL,
			kd_jenis_prw VARCHAR(20) NOT NULL,
			id_servicerequest VARCHAR(100) DEFAULT '',
			status VARCHAR(20) DEFAULT 'sent',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_order_prw (noorder, kd_jenis_prw)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS satu_sehat_mwl_radiologi (
			id INT AUTO_INCREMENT PRIMARY KEY,
			noorder VARCHAR(20) NOT NULL UNIQUE,
			accession_number VARCHAR(20) DEFAULT '',
			worklist_file VARCHAR(500) DEFAULT '',
			status VARCHAR(20) DEFAULT 'terkirim',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS satu_sehat_imagingstudy (
			id INT AUTO_INCREMENT PRIMARY KEY,
			noorder VARCHAR(20) NOT NULL UNIQUE,
			id_imagingstudy VARCHAR(100) DEFAULT '',
			status VARCHAR(30) DEFAULT 'via-dicom-router',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS erm_mapping_radiologi (
			kd_jenis_prw VARCHAR(20) PRIMARY KEY,
			code VARCHAR(50) DEFAULT '',
			system VARCHAR(200) DEFAULT '',
			display VARCHAR(200) DEFAULT '',
			modality_code VARCHAR(20) DEFAULT '',
			modality_display VARCHAR(100) DEFAULT ''
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}
	// Migrasi kolom yang mungkin belum ada di tabel lama
	migrations := []string{
		`ALTER TABLE satu_sehat_imagingstudy ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'via-dicom-router'`,
		`ALTER TABLE satu_sehat_mwl_radiologi ADD COLUMN IF NOT EXISTS accession_number VARCHAR(20) DEFAULT ''`,
		`ALTER TABLE satu_sehat_mwl_radiologi ADD COLUMN IF NOT EXISTS worklist_file VARCHAR(500) DEFAULT ''`,
		`ALTER TABLE satu_sehat_mwl_radiologi ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
		// Kolom sampel_* pada tabel Khanza yang mungkin belum ada
		`ALTER TABLE satu_sehat_mapping_radiologi ADD COLUMN IF NOT EXISTS sampel_code VARCHAR(100) DEFAULT ''`,
		`ALTER TABLE satu_sehat_mapping_radiologi ADD COLUMN IF NOT EXISTS sampel_system VARCHAR(200) DEFAULT ''`,
		`ALTER TABLE satu_sehat_mapping_radiologi ADD COLUMN IF NOT EXISTS sampel_display VARCHAR(200) DEFAULT ''`,
	}
	for _, m := range migrations {
		db.Exec(m) // abaikan error (kolom mungkin sudah ada di versi MySQL lama)
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// openDB membuka koneksi ke database MySQL.
// Untuk lokal: gunakan root tanpa password (TIDAK untuk produksi!).
func openDB() (*sql.DB, error) {
	// Bisa diganti via environment variable nanti
	user := getEnv("DB_USER", "root")
	pass := getEnv("DB_PASS", "")
	host := getEnv("DB_HOST", "127.0.0.1")
	port := getEnv("DB_PORT", "3306")
	name := getEnv("DB_NAME", "ibnusinadev")

	// clientFoundRows=true membuat RowsAffected() mengembalikan jumlah baris yang
	// COCOK dengan WHERE, bukan hanya baris yang nilainya benar-benar berubah.
	// Tanpa ini, UPDATE ke nilai yang sudah sama (mis. stts sudah 'Sudah') akan
	// melaporkan 0 rows affected walau baris ditemukan, membuat pengecekan
	// "data tidak ditemukan" di banyak handler jadi salah (false negative).
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local&tls=false&clientFoundRows=true",
		user, pass, host, port, name,
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	// Test koneksi
	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

func getEnv(key, def string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return def
}

// loadDotEnv membaca file .env di direktori yang sama dengan binary
// dan set setiap baris KEY=VALUE sebagai environment variable.
// Tidak menimpa env variable yang sudah ada.
func loadDotEnv() {
	envFile := filepath.Join(filepath.Dir(os.Args[0]), ".env")
	// fallback: coba dari working directory
	if _, err := os.Stat(envFile); os.IsNotExist(err) {
		envFile = ".env"
	}
	data, err := os.ReadFile(envFile)
	if err != nil {
		return // .env tidak wajib ada
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Hapus kutip jika ada
		val = strings.Trim(val, `"'`)
		// Tidak timpa env var yang sudah di-set
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, val)
		}
	}
	log.Println("Konfigurasi dimuat dari .env")
}

// Struct untuk data registrasi
type RegistrasiPatient struct {
	NoReg         string  `json:"no_reg"`
	NoRawat       string  `json:"no_rawat"`
	TglRegistrasi string  `json:"tgl_registrasi"`
	JamReg        string  `json:"jam_reg"`
	KdDokter      string  `json:"kd_dokter"`
	NmDokter      string  `json:"nm_dokter"`
	NoRkmMedis    string  `json:"no_rkm_medis"`
	NmPasien      string  `json:"nm_pasien"`
	Jk            string  `json:"jk"`
	Umur          string  `json:"umur"`
	NmPoli        string  `json:"nm_poli"`
	PJawab        string  `json:"p_jawab"`
	AlmtPj        string  `json:"almt_pj"`
	HubunganPj    string  `json:"hubunganpj"`
	BiayaReg      float64 `json:"biaya_reg"`
	SttsDaftar    string  `json:"stts_daftar"`
	PngJawab      string  `json:"png_jawab"`
	NoTlp         string  `json:"no_tlp"`
	Stts          string  `json:"stts"`
	StatusPoli    string  `json:"status_poli"`
	KdPoli        string  `json:"kd_poli"`
	KdPj          string  `json:"kd_pj"`
	StatusBayar   string  `json:"status_bayar"`
	NoSep         *string `json:"no_sep"` // nullable
}

// Handler untuk mendapatkan daftar registrasi
func getRegistrasiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Query parameters
		mode := c.DefaultQuery("mode", "registrasi-awal") // registrasi-awal atau rujukan-internal-poli
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		searchText := c.Query("search")

		// Set default dates if not provided
		if tglDari == "" {
			tglDari = time.Now().Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		var query string
		var args []interface{}

		if mode == "rujukan-internal-poli" {
			// Query untuk rujukan internal poli
			query = `
				SELECT
					'' as no_reg,
					IFNULL(reg_periksa.no_rawat, ''),
					IFNULL(reg_periksa.tgl_registrasi, ''),
					IFNULL(reg_periksa.jam_reg, ''),
					IFNULL(rujukan_internal_poli.kd_dokter, ''),
					IFNULL(dokter.nm_dokter, ''),
					IFNULL(reg_periksa.no_rkm_medis, ''),
					IFNULL(pasien.nm_pasien, ''),
					IFNULL(pasien.jk, ''),
					COALESCE(
						CONCAT(reg_periksa.umurdaftar, ' ', reg_periksa.sttsumur),
						CONCAT(TIMESTAMPDIFF(YEAR, pasien.tgl_lahir, CURDATE()), ' Th'),
						''
					) as umur,
					IFNULL(poliklinik.nm_poli, ''),
					IFNULL(reg_periksa.p_jawab, ''),
					IFNULL(reg_periksa.almt_pj, ''),
					IFNULL(reg_periksa.hubunganpj, ''),
					0 as biaya_reg,
					IFNULL(reg_periksa.stts_daftar, ''),
					IFNULL(penjab.png_jawab, ''),
					IFNULL(pasien.no_tlp, ''),
					IFNULL(reg_periksa.stts, ''),
					'' as status_poli,
					IFNULL(rujukan_internal_poli.kd_poli, ''),
					IFNULL(reg_periksa.kd_pj, ''),
					'' as status_bayar,
					NULL as no_sep
				FROM reg_periksa
				INNER JOIN rujukan_internal_poli ON rujukan_internal_poli.no_rawat = reg_periksa.no_rawat
				INNER JOIN dokter ON rujukan_internal_poli.kd_dokter = dokter.kd_dokter
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN poliklinik ON rujukan_internal_poli.kd_poli = poliklinik.kd_poli
				INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
			`
			args = append(args, tglDari, tglSampai)

			if searchText != "" {
				query += ` AND (
					reg_periksa.no_rawat LIKE ? OR
					reg_periksa.tgl_registrasi LIKE ? OR
					rujukan_internal_poli.kd_dokter LIKE ? OR
					dokter.nm_dokter LIKE ? OR
					reg_periksa.no_rkm_medis LIKE ? OR
					pasien.nm_pasien LIKE ? OR
					poliklinik.nm_poli LIKE ? OR
					penjab.png_jawab LIKE ?
				)`
				searchPattern := "%" + searchText + "%"
				for i := 0; i < 8; i++ {
					args = append(args, searchPattern)
				}
			}
		} else {
			// Query untuk registrasi awal
			query = `
				SELECT
					IFNULL(reg_periksa.no_reg, ''),
					IFNULL(reg_periksa.no_rawat, ''),
					IFNULL(reg_periksa.tgl_registrasi, ''),
					IFNULL(reg_periksa.jam_reg, ''),
					IFNULL(reg_periksa.kd_dokter, ''),
					IFNULL(dokter.nm_dokter, ''),
					IFNULL(reg_periksa.no_rkm_medis, ''),
					IFNULL(pasien.nm_pasien, ''),
					IFNULL(pasien.jk, ''),
					COALESCE(
						CONCAT(reg_periksa.umurdaftar, ' ', reg_periksa.sttsumur),
						CONCAT(TIMESTAMPDIFF(YEAR, pasien.tgl_lahir, CURDATE()), ' Th'),
						''
					) as umur,
					IFNULL(poliklinik.nm_poli, ''),
					IFNULL(reg_periksa.p_jawab, ''),
					IFNULL(reg_periksa.almt_pj, ''),
					IFNULL(reg_periksa.hubunganpj, ''),
					IFNULL(reg_periksa.biaya_reg, 0),
					IFNULL(reg_periksa.stts_daftar, ''),
					IFNULL(penjab.png_jawab, ''),
					IFNULL(pasien.no_tlp, ''),
					IFNULL(reg_periksa.stts, ''),
					IFNULL(reg_periksa.status_poli, ''),
					IFNULL(reg_periksa.kd_poli, ''),
					IFNULL(reg_periksa.kd_pj, ''),
					IFNULL(reg_periksa.status_bayar, ''),
					bridging_sep.no_sep
				FROM reg_periksa
				INNER JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
				INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				LEFT JOIN bridging_sep ON bridging_sep.no_rawat = reg_periksa.no_rawat
				WHERE poliklinik.kd_poli <> 'IGDK'
				AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
			`
			args = append(args, tglDari, tglSampai)

			if searchText != "" {
				query += ` AND (
					reg_periksa.no_reg LIKE ? OR
					reg_periksa.no_rawat LIKE ? OR
					reg_periksa.tgl_registrasi LIKE ? OR
					reg_periksa.kd_dokter LIKE ? OR
					dokter.nm_dokter LIKE ? OR
					reg_periksa.no_rkm_medis LIKE ? OR
					pasien.nm_pasien LIKE ? OR
					poliklinik.nm_poli LIKE ? OR
					penjab.png_jawab LIKE ?
				)`
				searchPattern := "%" + searchText + "%"
				for i := 0; i < 9; i++ {
					args = append(args, searchPattern)
				}
			}
		}

		query += " ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			log.Printf("Error query registrasi: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data registrasi"})
			return
		}
		defer rows.Close()

		patients := []RegistrasiPatient{}
		for rows.Next() {
			var p RegistrasiPatient
			err := rows.Scan(
				&p.NoReg, &p.NoRawat, &p.TglRegistrasi, &p.JamReg,
				&p.KdDokter, &p.NmDokter,
				&p.NoRkmMedis, &p.NmPasien, &p.Jk, &p.Umur,
				&p.NmPoli,
				&p.PJawab, &p.AlmtPj, &p.HubunganPj,
				&p.BiayaReg, &p.SttsDaftar,
				&p.PngJawab, &p.NoTlp,
				&p.Stts, &p.StatusPoli,
				&p.KdPoli, &p.KdPj, &p.StatusBayar,
				&p.NoSep,
			)
			if err != nil {
				log.Printf("Error scan row registrasi: %v", err)
				continue
			}
			patients = append(patients, p)
		}

		if err = rows.Err(); err != nil {
			log.Printf("Error iterating rows registrasi: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error membaca data registrasi"})
			return
		}

		c.JSON(http.StatusOK, patients)
	}
}

// Handler untuk mendapatkan daftar pasien rawat inap
func getRawatInapList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Query parameters
		status := c.DefaultQuery("status", "belum-pulang") // belum-pulang atau sudah-pulang
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		searchText := c.Query("search")
		statusBayar := c.DefaultQuery("status_bayar", "")
		bangsal := c.Query("bangsal")
		kdDokter := c.Query("kd_dokter")

		// Build WHERE clause
		whereClause := "WHERE 1=1"
		var args []interface{}

		if status == "belum-pulang" {
			whereClause += " AND kamar_inap.stts_pulang='-'"
		} else if status == "sudah-pulang" && tglDari != "" && tglSampai != "" {
			whereClause += " AND kamar_inap.tgl_keluar BETWEEN '" + tglDari + "' AND '" + tglSampai + "'"
		} else if tglDari != "" && tglSampai != "" {
			whereClause += " AND kamar_inap.tgl_masuk BETWEEN '" + tglDari + "' AND '" + tglSampai + "'"
		}

		if statusBayar != "" && statusBayar != "Semua" {
			whereClause += " AND reg_periksa.status_bayar LIKE '%" + statusBayar + "%'"
		}

		if bangsal != "" {
			whereClause += " AND bangsal.nm_bangsal = '" + bangsal + "'"
		}

		if searchText != "" {
			whereClause += " AND (kamar_inap.no_rawat LIKE '%" + searchText + "%' OR " +
				"reg_periksa.no_rkm_medis LIKE '%" + searchText + "%' OR " +
				"pasien.nm_pasien LIKE '%" + searchText + "%' OR " +
				"kamar_inap.kd_kamar LIKE '%" + searchText + "%' OR " +
				"bangsal.nm_bangsal LIKE '%" + searchText + "%' OR " +
				"kamar_inap.diagnosa_awal LIKE '%" + searchText + "%' OR " +
				"kamar_inap.diagnosa_akhir LIKE '%" + searchText + "%' OR " +
				"EXISTS (SELECT 1 FROM dpjp_ranap dr_search " +
				"INNER JOIN dokter d_search ON dr_search.kd_dokter = d_search.kd_dokter " +
				"WHERE dr_search.no_rawat = kamar_inap.no_rawat AND d_search.nm_dokter LIKE '%" + searchText + "%') OR " +
				"penjab.png_jawab LIKE '%" + searchText + "%')"
		}

		// Dokter hanya boleh melihat pasien yang dia sendiri jadi DPJP-nya.
		// Petugas/role lain tetap melihat semua pasien (tidak difilter).
		if kdDokter != "" {
			whereClause += " AND EXISTS (SELECT 1 FROM dpjp_ranap dr_filter WHERE dr_filter.no_rawat = kamar_inap.no_rawat AND dr_filter.kd_dokter = ?)"
			args = append(args, kdDokter)
		}

		// Main query
		query := `
			SELECT
				kamar_inap.no_rawat,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				CONCAT(pasien.alamat, ', ', kelurahan.nm_kel, ', ', kecamatan.nm_kec, ', ', kabupaten.nm_kab) AS alamat,
				reg_periksa.p_jawab,
				reg_periksa.hubunganpj,
				penjab.png_jawab,
				CONCAT(kamar_inap.kd_kamar, ' ', bangsal.nm_bangsal) AS kamar,
				kamar_inap.trf_kamar,
				kamar_inap.diagnosa_awal,
				kamar_inap.diagnosa_akhir,
				kamar_inap.tgl_masuk,
				kamar_inap.jam_masuk,
				IF(kamar_inap.tgl_keluar='0000-00-00', '', kamar_inap.tgl_keluar) AS tgl_keluar,
				IF(kamar_inap.jam_keluar='00:00:00', '', kamar_inap.jam_keluar) AS jam_keluar,
				kamar_inap.ttl_biaya,
				kamar_inap.stts_pulang,
				kamar_inap.lama,
				COALESCE((SELECT GROUP_CONCAT(DISTINCT d_dpjp.nm_dokter SEPARATOR ', ')
					FROM dpjp_ranap dr
					INNER JOIN dokter d_dpjp ON dr.kd_dokter = d_dpjp.kd_dokter
					WHERE dr.no_rawat = kamar_inap.no_rawat), '') AS nm_dokter,
				COALESCE((SELECT GROUP_CONCAT(DISTINCT dr.kd_dokter SEPARATOR ', ')
					FROM dpjp_ranap dr
					WHERE dr.no_rawat = kamar_inap.no_rawat), '') AS kd_dokter,
				kamar_inap.kd_kamar,
				kamar.kd_bangsal,
				reg_periksa.status_bayar,
				CONCAT(reg_periksa.umurdaftar, ' ', reg_periksa.sttsumur) AS umur,
				pasien.agama
			FROM kamar_inap
			INNER JOIN reg_periksa ON kamar_inap.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
			INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			INNER JOIN kelurahan ON pasien.kd_kel = kelurahan.kd_kel
			INNER JOIN kecamatan ON pasien.kd_kec = kecamatan.kd_kec
			INNER JOIN kabupaten ON pasien.kd_kab = kabupaten.kd_kab
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			` + whereClause + `
			ORDER BY kamar_inap.tgl_masuk DESC, kamar_inap.jam_masuk DESC
			LIMIT 1000
		`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query failed: " + err.Error()})
			return
		}
		defer rows.Close()

		var patients []RawatInapPatient
		for rows.Next() {
			var p RawatInapPatient
			err := rows.Scan(
				&p.NoRawat, &p.NoRkmMedis, &p.NmPasien, &p.Alamat,
				&p.PJawab, &p.HubunganPJ, &p.PngJawab, &p.Kamar,
				&p.TrfKamar, &p.DiagnosaAwal, &p.DiagnosaAkhir,
				&p.TglMasuk, &p.JamMasuk, &p.TglKeluar, &p.JamKeluar,
				&p.TtlBiaya, &p.SttsPulang, &p.Lama, &p.NmDokter,
				&p.KdDokter, &p.KdKamar, &p.KdBangsal, &p.StatusBayar, &p.Umur, &p.Agama,
			)
			if err != nil {
				log.Printf("Error scanning row: %v", err)
				continue
			}
			patients = append(patients, p)
		}

		if err = rows.Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error reading rows: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, patients)
	}
}

func main() {
	loadDotEnv()

	// Set timezone to Asia/Jakarta (WIB)
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err == nil {
		time.Local = loc
	}

	db, err := openDB()
	if err != nil {
		log.Fatalf("gagal konek database: %v", err)
	}
	defer db.Close()

	if err := ensureAppUsersTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel user: %v", err)
	}

	if err := ensureSettingsTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel settings: %v", err)
	}

	if err := ensureAntrianPoliTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel antrian_poli: %v", err)
	}

	if err := ensureAntrianApotekTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel antrian_apotek: %v", err)
	}

	if err := ensureDisplaySettingsTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel display_settings: %v", err)
	}

	if err := ensureSettingBridgingTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel setting_bridging: %v", err)
	}

	if err := ensureBridgingPengajuanTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel bridging_pengajuan_penjaminan: %v", err)
	}

	if err := ensureBridgingAntreanQueueTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel bridging_antrean_queue: %v", err)
	}
	startAntreanQueueWorker(db)

	if err := ensureAntreanFarmasiTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel bridging_antrean_farmasi: %v", err)
	}

	if err := ensureKlaimInacbgTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel klaim_inacbg: %v", err)
	}

	if err := ensureJasaMedisTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel jasa_medis: %v", err)
	}

	if err := ensurePreviewBillingPengaturanTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel preview_billing_pengaturan: %v", err)
	}

	if err := ensurePreviewObatPengaturanTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel preview_obat_pengaturan: %v", err)
	}

	if err := ensurePemesananTable(db); err != nil {
		log.Fatalf("gagal inisialisasi kolom surat_pemesanan_medis: %v", err)
	}

	if err := ensurePetugasTable(db); err != nil {
		log.Fatalf("gagal inisialisasi kolom petugas: %v", err)
	}

	if err := ensurePembelianExtTable(db); err != nil {
		log.Fatalf("gagal inisialisasi tabel pembelian_ext: %v", err)
	}

	ensureRekapPresensiExtTable(db)
	ensureShiftColumnsVarchar(db)
	ensurePegawaiJadwalTetapTable(db)
	ensurePengumumanTable(db)
	ensurePengajuanLemburTable(db)
	ensurePengajuanCutiExtTable(db)

	r := gin.Default()

	// CORS middleware untuk mengizinkan request dari frontend
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Static file serving untuk gambar
	// Serve gambar asuhan medis IGD
	r.Static("/asuhan-medis-igd", "./uploads/images/asuhan-medis-igd")
	// Serve file statis Khanza webapps (radiologi, berkasrawat, dll)
	khanzaCfg := LoadKhanzaWebappsConfig()
	RegisterKhanzaWebappsRoutes(r, khanzaCfg)
	// Serve gambar lab PA (jika ada)
	r.Static("/labpa", "./uploads/images/labpa")
	// Serve gambar umum
	r.Static("/images", "./uploads/images")
	// Serve uploads untuk logo instansi dan file lainnya
	r.Static("/uploads", "./uploads")

	// Health check: untuk cek bahwa API & DB jalan
	r.GET("/api/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "DB tidak bisa diakses",
				"detail":  err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"db":     "connected",
		})
	})

	// Contoh endpoint awal: masih dipertahankan untuk debugging sederhana
	r.GET("/api/example", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Backend SIMRS Go sudah jalan",
		})
	})

	// === Auth sederhana untuk aplikasi web ===
	r.POST("/api/auth/login", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username dan password wajib diisi"})
			return
		}

		hashed := hashPassword(req.Password)

		var user AppUser
		var isActiveInt int
		var allowedModules sql.NullString
		err := db.QueryRow(
			`SELECT id, username, full_name, role, is_active, allowed_modules, nip, kd_dokter
			 FROM app_users
			 WHERE username = ? AND password_hash = ?
			 LIMIT 1`,
			req.Username,
			hashed,
		).Scan(
			&user.ID,
			&user.Username,
			&user.FullName,
			&user.Role,
			&isActiveInt,
			&allowedModules,
			&user.Nip,
			&user.KdDokter,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau password salah"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if isActiveInt == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akun tidak aktif"})
			return
		}

		user.IsActive = isActiveInt == 1
		if allowedModules.Valid {
			user.AllowedModules = allowedModules.String
		}

		c.JSON(http.StatusOK, gin.H{
			"user": user,
		})
	})

	// === Admin: manajemen user aplikasi (sementara tanpa middleware, harap hanya dipakai oleh role admin) ===
	r.GET("/api/admin/users", func(c *gin.Context) {
		rows, err := db.Query(`SELECT id, username, full_name, role, is_active, allowed_modules, nip, kd_dokter FROM app_users ORDER BY id`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var users []AppUser
		for rows.Next() {
			var u AppUser
			var isActiveInt int
			var allowedModules sql.NullString
			if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.Role, &isActiveInt, &allowedModules, &u.Nip, &u.KdDokter); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			u.IsActive = isActiveInt == 1
			if allowedModules.Valid {
				u.AllowedModules = allowedModules.String
			}
			users = append(users, u)
		}

		c.JSON(http.StatusOK, users)
	})

	r.POST("/api/admin/users", func(c *gin.Context) {
		var req CreateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data user tidak lengkap"})
			return
		}

		hash := hashPassword(req.Password)
		_, err := db.Exec(
			`INSERT INTO app_users (username, password_hash, full_name, role, is_active, allowed_modules, nip, kd_dokter)
			 VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
			req.Username,
			hash,
			req.FullName,
			req.Role,
			req.AllowedModules,
			req.Nip,
			req.KdDokter,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.Status(http.StatusCreated)
	})

	r.PUT("/api/admin/users/:id", func(c *gin.Context) {
		var req UpdateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data user tidak lengkap"})
			return
		}

		id := c.Param("id")
		isActiveInt := 0
		if req.IsActive {
			isActiveInt = 1
		}

		// Build UPDATE query dynamically based on what fields are provided
		if req.Password != "" {
			// Update with password
			hash := hashPassword(req.Password)
			if _, err := db.Exec(
				`UPDATE app_users SET full_name = ?, role = ?, is_active = ?, password_hash = ?, allowed_modules = ?, nip = ?, kd_dokter = ? WHERE id = ?`,
				req.FullName,
				req.Role,
				isActiveInt,
				hash,
				req.AllowedModules,
				req.Nip,
				req.KdDokter,
				id,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		} else {
			// Update without password
			if _, err := db.Exec(
				`UPDATE app_users SET full_name = ?, role = ?, is_active = ?, allowed_modules = ?, nip = ?, kd_dokter = ? WHERE id = ?`,
				req.FullName,
				req.Role,
				isActiveInt,
				req.AllowedModules,
				req.Nip,
				req.KdDokter,
				id,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		c.Status(http.StatusOK)
	})

	r.POST("/api/admin/users/:id/reset-password", func(c *gin.Context) {
		var req ResetPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password baru wajib diisi"})
			return
		}

		id := c.Param("id")
		hash := hashPassword(req.Password)

		if _, err := db.Exec(
			`UPDATE app_users SET password_hash = ? WHERE id = ?`,
			hash,
			id,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.Status(http.StatusOK)
	})

	r.DELETE("/api/admin/users/:id", func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec(`DELETE FROM app_users WHERE id = ?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusOK)
	})

	// POST ganti password sendiri — beda dari /api/admin/users/:id/reset-password
	// (admin-only, reset ke nilai default tanpa perlu tahu password lama):
	// endpoint ini dipakai user BIASA (non-admin) lewat menu "Pengaturan" ->
	// Ganti Password, WAJIB tahu password lama dulu sebelum bisa ganti.
	r.POST("/api/auth/change-password", func(c *gin.Context) {
		var req struct {
			ID          int    `json:"id" binding:"required"`
			OldPassword string `json:"old_password" binding:"required"`
			NewPassword string `json:"new_password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password lama dan baru wajib diisi"})
			return
		}

		var currentHash string
		if err := db.QueryRow(`SELECT password_hash FROM app_users WHERE id = ?`, req.ID).Scan(&currentHash); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
			return
		}
		if currentHash != hashPassword(req.OldPassword) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Password lama salah"})
			return
		}

		if _, err := db.Exec(`UPDATE app_users SET password_hash = ? WHERE id = ?`, hashPassword(req.NewPassword), req.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusOK)
	})

	// GET settings instansi
	r.GET("/api/admin/settings", func(c *gin.Context) {
		var settings Settings
		err := db.QueryRow(`
			SELECT id, nama_instansi, alamat, logo_url, kota_rs, kontak, email_rs, kode_ppk_bpjs, kode_ppk_kemenkes, nomor_izin_sarana, created_at, updated_at
			FROM setting_simrs_web
			LIMIT 1
		`).Scan(
			&settings.ID,
			&settings.NamaInstansi,
			&settings.Alamat,
			&settings.LogoURL,
			&settings.KotaRs,
			&settings.Kontak,
			&settings.EmailRs,
			&settings.KodePpkBpjs,
			&settings.KodePpkKemenkes,
			&settings.NomorIzinSarana,
			&settings.CreatedAt,
			&settings.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			// Return default empty settings if no row exists
			c.JSON(http.StatusOK, gin.H{
				"nama_instansi":     "",
				"alamat":            "",
				"logo_url":          "",
				"kota_rs":           "",
				"kontak":            "",
				"email_rs":          "",
				"kode_ppk_bpjs":     "",
				"kode_ppk_kemenkes": "",
				"nomor_izin_sarana": "",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, settings)
	})

	// POST settings instansi
	r.POST("/api/admin/settings", func(c *gin.Context) {
		namaInstansi := c.PostForm("nama_instansi")
		alamat := c.PostForm("alamat")
		kotaRs := c.PostForm("kota_rs")
		kontak := c.PostForm("kontak")
		emailRs := c.PostForm("email_rs")
		kodePpkBpjs := c.PostForm("kode_ppk_bpjs")
		kodePpkKemenkes := c.PostForm("kode_ppk_kemenkes")
		nomorIzinSarana := c.PostForm("nomor_izin_sarana")

		if namaInstansi == "" || alamat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama instansi dan alamat wajib diisi"})
			return
		}

		var logoURL string
		file, err := c.FormFile("logo")

		if err == nil && file != nil {
			// Create uploads directory if it doesn't exist
			uploadsDir := "./uploads"
			if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
				if err := os.MkdirAll(uploadsDir, 0755); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat direktori uploads"})
					return
				}
			}

			// Generate unique filename
			ext := filepath.Ext(file.Filename)
			filename := fmt.Sprintf("logo_%d%s", time.Now().Unix(), ext)
			filepath := filepath.Join(uploadsDir, filename)

			// Save file
			src, err := file.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka file"})
				return
			}
			defer src.Close()

			dst, err := os.Create(filepath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file"})
				return
			}
			defer dst.Close()

			if _, err = io.Copy(dst, src); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyalin file"})
				return
			}

			logoURL = "/uploads/" + filename
		}

		// Check if settings already exist
		var existingID int
		err = db.QueryRow(`SELECT id FROM setting_simrs_web LIMIT 1`).Scan(&existingID)

		if err == sql.ErrNoRows {
			// Insert new settings
			_, err = db.Exec(`
				INSERT INTO setting_simrs_web (nama_instansi, alamat, logo_url, kota_rs, kontak, email_rs, kode_ppk_bpjs, kode_ppk_kemenkes, nomor_izin_sarana, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			`, namaInstansi, alamat, logoURL, kotaRs, kontak, emailRs, kodePpkBpjs, kodePpkKemenkes, nomorIzinSarana)
		} else if err == nil {
			// Update existing settings
			if logoURL != "" {
				_, err = db.Exec(`
					UPDATE setting_simrs_web
					SET nama_instansi = ?, alamat = ?, logo_url = ?, kota_rs = ?, kontak = ?, email_rs = ?, kode_ppk_bpjs = ?, kode_ppk_kemenkes = ?, nomor_izin_sarana = ?, updated_at = NOW()
					WHERE id = ?
				`, namaInstansi, alamat, logoURL, kotaRs, kontak, emailRs, kodePpkBpjs, kodePpkKemenkes, nomorIzinSarana, existingID)
			} else {
				_, err = db.Exec(`
					UPDATE setting_simrs_web
					SET nama_instansi = ?, alamat = ?, kota_rs = ?, kontak = ?, email_rs = ?, kode_ppk_bpjs = ?, kode_ppk_kemenkes = ?, nomor_izin_sarana = ?, updated_at = NOW()
					WHERE id = ?
				`, namaInstansi, alamat, kotaRs, kontak, emailRs, kodePpkBpjs, kodePpkKemenkes, nomorIzinSarana, existingID)
			}
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":           "Pengaturan berhasil disimpan",
			"nama_instansi":     namaInstansi,
			"alamat":            alamat,
			"logo_url":          logoURL,
			"kota_rs":           kotaRs,
			"kontak":            kontak,
			"email_rs":          emailRs,
			"kode_ppk_bpjs":     kodePpkBpjs,
			"kode_ppk_kemenkes": kodePpkKemenkes,
			"nomor_izin_sarana": nomorIzinSarana,
		})
	})

	// === Endpoint untuk User Management ===

	// GET /api/dokter - Mengambil semua dokter dengan status aktif
	r.GET("/api/dokter", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")

		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`
				SELECT kd_dokter, nm_dokter
				FROM dokter
				WHERE status = '1' AND (kd_dokter LIKE ? OR nm_dokter LIKE ?)
				ORDER BY nm_dokter
				LIMIT 100
			`, "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`
				SELECT kd_dokter, nm_dokter
				FROM dokter
				WHERE status = '1'
				ORDER BY nm_dokter
				LIMIT 100
			`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var dokters []Dokter
		for rows.Next() {
			var d Dokter
			if err := rows.Scan(&d.KdDokter, &d.NmDokter); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			dokters = append(dokters, d)
		}

		c.JSON(http.StatusOK, dokters)
	})

	// GET /api/petugas - Mengambil semua petugas
	r.GET("/api/petugas", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")

		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`
				SELECT nip, nama
				FROM petugas
				WHERE status = '1' AND (nip LIKE ? OR nama LIKE ?)
				ORDER BY nama
				LIMIT 100
			`, "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`
				SELECT nip, nama
				FROM petugas
				WHERE status = '1'
				ORDER BY nama
				LIMIT 100
			`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var petugasList []Petugas
		for rows.Next() {
			var p Petugas
			if err := rows.Scan(&p.NIP, &p.Nama); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			petugasList = append(petugasList, p)
		}

		c.JSON(http.StatusOK, petugasList)
	})

	// Fitur Petugas (Kepegawaian) — list/tambah/edit/hapus lengkap,
	// padanan DlgPetugas.java, terpisah dari GET /api/petugas ringan
	// di atas (yang cuma nip+nama utk typeahead).
	r.GET("/api/petugas/list", getPetugasList(db))
	r.POST("/api/petugas", tambahPetugas(db))
	r.PUT("/api/petugas/:nip", editPetugas(db))
	r.DELETE("/api/petugas/:nip", hapusPetugas(db))
	r.PUT("/api/petugas/:nip/restore", restorePetugas(db))
	r.DELETE("/api/petugas/:nip/permanent", hapusPetugasPermanen(db))
	r.GET("/api/jabatan/opsi", getJabatanOpsi(db))

	// Fitur Dokter (Kepegawaian) — list/tambah/edit/hapus lengkap,
	// padanan DlgDokter.java, terpisah dari GET /api/dokter ringan
	// di atas (yang cuma kd_dokter+nama utk typeahead).
	r.GET("/api/dokter/list", getDokterList(db))
	r.POST("/api/dokter", tambahDokter(db))
	r.PUT("/api/dokter/:kd_dokter", editDokter(db))
	r.DELETE("/api/dokter/:kd_dokter", hapusDokter(db))
	r.PUT("/api/dokter/:kd_dokter/restore", restoreDokter(db))
	r.DELETE("/api/dokter/:kd_dokter/permanent", hapusDokterPermanen(db))
	r.GET("/api/spesialis/opsi", getSpesialisOpsi(db))

	// Fitur Presensi Mandiri (Kepegawaian) — self check-in/out lewat HP
	// (mobile) + rekap desktop utk HRD, lihat catatan lengkap di
	// backend/presensi_handler.go.
	r.GET("/api/presensi/me", getPresensiMe(db))
	r.POST("/api/presensi/checkin", presensiCheckin(db))
	r.POST("/api/presensi/checkout", presensiCheckout(db))
	r.GET("/api/presensi/riwayat", getPresensiRiwayat(db))
	r.GET("/api/presensi/rekap", getPresensiRekap(db))
	r.GET("/api/presensi/jadwal", getPresensiJadwal(db))
	r.GET("/api/presensi/profil", getPresensiProfil(db))
	r.PUT("/api/presensi/profil/foto", updatePresensiProfilFoto(db))

	// Fitur Jadwal Pegawai (Kepegawaian) — grid shift bulanan, padanan
	// DlgJadwalPegawai.java. Sumber jadwal yang dipakai getShiftHariIni
	// di atas (Presensi Mandiri).
	r.GET("/api/jadwal-pegawai/list", getJadwalPegawaiList(db))
	r.PUT("/api/jadwal-pegawai", saveJadwalPegawai(db))
	r.DELETE("/api/jadwal-pegawai/:id", deleteJadwalPegawai(db))
	r.GET("/api/jam-masuk/opsi", getJamMasukOpsi(db))
	r.GET("/api/rekap-kehadiran/list", getRekapKehadiranList(db))

	// Fitur Pengumuman (Kepegawaian) — fitur baru murni ERMApp, lihat
	// backend/pengumuman_handler.go.
	r.GET("/api/pengumuman", getPengumumanList(db))
	r.POST("/api/pengumuman", tambahPengumuman(db))
	r.PUT("/api/pengumuman/:id", editPengumuman(db))
	r.PUT("/api/pengumuman/:id/toggle", toggleAktifPengumuman(db))
	r.DELETE("/api/pengumuman/:id", hapusPengumuman(db))

	// Fitur Pengajuan Lembur (Kepegawaian) — fitur baru murni ERMApp,
	// lihat backend/lembur_handler.go.
	r.POST("/api/lembur", submitLembur(db))
	r.GET("/api/lembur/saya", getLemburSaya(db))
	r.GET("/api/lembur/list", getLemburList(db))
	r.PUT("/api/lembur/:id/approve", approveLembur(db))
	r.PUT("/api/lembur/:id/reject", rejectLembur(db))
	r.DELETE("/api/lembur/:id", hapusLembur(db))

	// Fitur Pengajuan Cuti & Izin (Kepegawaian) — padanan
	// PengajuanCutiPegawai.java/PengajuanCutiAdmin.java, lihat
	// backend/cuti_izin_handler.go.
	r.POST("/api/pengajuan-cuti", submitCutiIzin(db))
	r.GET("/api/pengajuan-cuti/saya", getCutiIzinSaya(db))
	r.GET("/api/pengajuan-cuti/list", getCutiIzinList(db))
	r.PUT("/api/pengajuan-cuti/:no_pengajuan/approve", approveCutiIzin(db))
	r.PUT("/api/pengajuan-cuti/:no_pengajuan/reject", rejectCutiIzin(db))
	r.DELETE("/api/pengajuan-cuti/:no_pengajuan", hapusCutiIzin(db))
	r.POST("/api/jam-masuk", tambahJamMasuk(db))
	r.PUT("/api/jam-masuk/:shift", editJamMasuk(db))
	r.DELETE("/api/jam-masuk/:shift", hapusJamMasuk(db))
	r.PUT("/api/pegawai-jadwal-tetap", setPegawaiJadwalTetapBulk(db))
	r.DELETE("/api/pegawai-jadwal-tetap/:id", deletePegawaiJadwalTetap(db))

	// GET /api/pegawai - Mengambil semua pegawai
	r.GET("/api/pegawai", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")

		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`
				SELECT nik, nama, COALESCE(jbtn,'') as jbtn
				FROM pegawai
				WHERE stts_aktif = 'AKTIF' AND (nik LIKE ? OR nama LIKE ? OR jbtn LIKE ?)
				ORDER BY nama
				LIMIT 100
			`, "%"+search+"%", "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`
				SELECT nik, nama, COALESCE(jbtn,'') as jbtn
				FROM pegawai
				WHERE stts_aktif = 'AKTIF'
				ORDER BY nama
				LIMIT 100
			`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type PegawaiRow struct {
			NIK  string `json:"nik"`
			Nama string `json:"nama"`
			Jbtn string `json:"jbtn"`
		}
		var list []PegawaiRow
		for rows.Next() {
			var p PegawaiRow
			if err := rows.Scan(&p.NIK, &p.Nama, &p.Jbtn); err != nil {
				continue
			}
			list = append(list, p)
		}
		if list == nil {
			list = []PegawaiRow{}
		}
		c.JSON(http.StatusOK, list)
	})

	// === Modul Kepegawaian ===
	r.GET("/api/admin/bridging", getBridgingConfigs(db))
	r.POST("/api/admin/bridging", saveBridgingConfig(db))
	r.DELETE("/api/admin/bridging/:kode", deleteBridgingConfig(db))

	r.GET("/api/pegawai/list", getPegawaiList(db))
	r.GET("/api/pegawai/departemen", getPegawaiDepartemen(db))
	r.PUT("/api/pegawai/status", updatePegawaiStatus(db))
	r.POST("/api/pegawai", tambahPegawai(db))
	r.PUT("/api/pegawai/:nik", editPegawai(db))
	r.DELETE("/api/pegawai/:nik", hapusPegawai(db))
	r.GET("/api/pegawai/master", getPegawaiMaster(db))

	// === Modul Pendaftaran (baca data dari skema Khanza) ===

	// Daftar poli (tabel: poliklinik)
	r.GET("/api/pendaftaran/poli", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")
		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`SELECT kd_poli, nm_poli FROM poliklinik WHERE kd_poli LIKE ? OR nm_poli LIKE ? ORDER BY nm_poli LIMIT 50`, "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`SELECT kd_poli, nm_poli FROM poliklinik ORDER BY nm_poli LIMIT 50`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []Poli
		for rows.Next() {
			var p Poli
			if err := rows.Scan(&p.KdPoli, &p.NmPoli); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, p)
		}

		c.JSON(http.StatusOK, items)
	})

	// Search poli by kode
	r.GET("/api/pendaftaran/poli/:kd_poli", func(c *gin.Context) {
		kdPoli := c.Param("kd_poli")
		var kdPoliRes, nmPoliRes string
		var registrasi sql.NullFloat64
		err := db.QueryRow(`SELECT kd_poli, nm_poli, registrasi FROM poliklinik WHERE kd_poli = ?`, kdPoli).Scan(&kdPoliRes, &nmPoliRes, &registrasi)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Poliklinik tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"kd_poli":    kdPoliRes,
			"nm_poli":    nmPoliRes,
			"registrasi": registrasi.Float64,
		})
	})

	// Daftar dokter (tabel: dokter)
	r.GET("/api/pendaftaran/dokter", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")
		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`SELECT kd_dokter, nm_dokter FROM dokter WHERE status = '1' AND (kd_dokter LIKE ? OR nm_dokter LIKE ?) ORDER BY nm_dokter LIMIT 50`, "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`SELECT kd_dokter, nm_dokter FROM dokter WHERE status = '1' ORDER BY nm_dokter LIMIT 50`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []Dokter
		for rows.Next() {
			var d Dokter
			if err := rows.Scan(&d.KdDokter, &d.NmDokter); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, d)
		}

		c.JSON(http.StatusOK, items)
	})

	// Search dokter by kode
	r.GET("/api/pendaftaran/dokter/:kd_dokter", func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		var d Dokter
		err := db.QueryRow(`SELECT kd_dokter, nm_dokter FROM dokter WHERE kd_dokter = ?`, kdDokter).Scan(&d.KdDokter, &d.NmDokter)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Dokter tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, d)
	})

	// Daftar penjamin / cara bayar (tabel: penjab)
	// Di skema Khanza, nama penjamin biasanya ada di kolom png_jawab.
	r.GET("/api/pendaftaran/penjab", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")
		var rows *sql.Rows
		var err error

		if search != "" {
			rows, err = db.Query(`SELECT kd_pj, png_jawab AS nm_pj FROM penjab WHERE status='1' AND (kd_pj LIKE ? OR png_jawab LIKE ?) ORDER BY png_jawab LIMIT 50`, "%"+search+"%", "%"+search+"%")
		} else {
			rows, err = db.Query(`SELECT kd_pj, png_jawab AS nm_pj FROM penjab WHERE status='1' ORDER BY png_jawab LIMIT 50`)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []Penjab
		for rows.Next() {
			var p Penjab
			if err := rows.Scan(&p.KdPj, &p.NmPj); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, p)
		}

		c.JSON(http.StatusOK, items)
	})

	// Daftar bangsal aktif (semua bangsal RS, bukan cuma depo Apotek —
	// beda dari /api/apotek/pengaturan/depo/opsi) — dipakai filter "Asal
	// Stok" di Penggunaan Obat, dan bisa dipakai fitur lain yang butuh
	// daftar bangsal umum.
	r.GET("/api/bangsal/opsi", func(c *gin.Context) {
		rows, err := db.Query(`SELECT kd_bangsal, COALESCE(nm_bangsal,'') FROM bangsal WHERE status='1' ORDER BY nm_bangsal`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		type bangsalOpsi struct {
			KdBangsal string `json:"kd_bangsal"`
			NmBangsal string `json:"nm_bangsal"`
		}
		items := []bangsalOpsi{}
		for rows.Next() {
			var b bangsalOpsi
			if rows.Scan(&b.KdBangsal, &b.NmBangsal) == nil {
				items = append(items, b)
			}
		}
		c.JSON(http.StatusOK, items)
	})

	// Cari pasien (search by no_rkm_medis atau nm_pasien)
	r.GET("/api/pendaftaran/pasien/search", func(c *gin.Context) {
		q := c.DefaultQuery("q", "")
		if len(q) < 3 {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}

		searchPattern := "%" + q + "%"
		query := `
			SELECT
				no_rkm_medis,
				nm_pasien,
				jk,
				alamat,
				tgl_lahir
			FROM pasien
			WHERE no_rkm_medis LIKE ? OR nm_pasien LIKE ?
			ORDER BY nm_pasien
			LIMIT 50
		`

		rows, err := db.Query(query, searchPattern, searchPattern)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type PasienSearch struct {
			NoRkmMedis string `json:"no_rkm_medis"`
			NmPasien   string `json:"nm_pasien"`
			Jk         string `json:"jk"`
			Alamat     string `json:"alamat"`
			TglLahir   string `json:"tgl_lahir"`
		}

		var items []PasienSearch
		for rows.Next() {
			var p PasienSearch
			if err := rows.Scan(&p.NoRkmMedis, &p.NmPasien, &p.Jk, &p.Alamat, &p.TglLahir); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, p)
		}

		c.JSON(http.StatusOK, items)
	})

	// List semua pasien dengan data lengkap
	r.GET("/api/pendaftaran/pasien/list", func(c *gin.Context) {
		search := c.DefaultQuery("search", "")
		limit := c.DefaultQuery("limit", "100")

		searchPattern := "%" + search + "%"
		query := `
			SELECT
				p.no_rkm_medis,
				p.nm_pasien,
				p.no_ktp,
				p.jk,
				p.tmp_lahir,
				p.tgl_lahir,
				p.nm_ibu,
				p.alamat,
				p.gol_darah,
				p.pekerjaan,
				p.stts_nikah,
				p.agama,
				p.tgl_daftar,
				p.no_tlp,
				p.umur,
				p.pnd,
				p.keluarga,
				p.namakeluarga,
				pj.png_jawab,
				p.no_peserta,
				p.pekerjaanpj,
				p.alamatpj,
				p.nip,
				p.email,
				p.cacat_fisik,
				CASE
					WHEN DATE(p.tgl_daftar) = CURDATE() THEN 'BARU'
					ELSE 'LAMA'
				END as status
			FROM pasien p
			LEFT JOIN penjab pj ON p.kd_pj = pj.kd_pj
			WHERE p.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ? OR p.no_ktp LIKE ? OR p.alamat LIKE ?
			ORDER BY p.no_rkm_medis DESC
			LIMIT ?
		`

		rows, err := db.Query(query, searchPattern, searchPattern, searchPattern, searchPattern, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type PasienFull struct {
			NoRkmMedis   string `json:"no_rkm_medis"`
			NmPasien     string `json:"nm_pasien"`
			NoKTP        string `json:"no_ktp"`
			Jk           string `json:"jk"`
			TmpLahir     string `json:"tmp_lahir"`
			TglLahir     string `json:"tgl_lahir"`
			NmIbu        string `json:"nm_ibu"`
			Alamat       string `json:"alamat"`
			GolDarah     string `json:"gol_darah"`
			Pekerjaan    string `json:"pekerjaan"`
			SttsNikah    string `json:"stts_nikah"`
			Agama        string `json:"agama"`
			TglDaftar    string `json:"tgl_daftar"`
			NoTlp        string `json:"no_tlp"`
			Umur         string `json:"umur"`
			Pnd          string `json:"pnd"`
			Keluarga     string `json:"keluarga"`
			NamaKeluarga string `json:"namakeluarga"`
			PngJawab     string `json:"png_jawab"`
			NoPeserta    string `json:"no_peserta"`
			PekerjaanPJ  string `json:"pekerjaanpj"`
			AlamatPJ     string `json:"alamatpj"`
			NIP          string `json:"nip"`
			Email        string `json:"email"`
			CacatFisik   string `json:"cacat_fisik"`
			Status       string `json:"status"`
		}

		var items []PasienFull
		for rows.Next() {
			var p PasienFull
			if err := rows.Scan(
				&p.NoRkmMedis, &p.NmPasien, &p.NoKTP, &p.Jk, &p.TmpLahir, &p.TglLahir,
				&p.NmIbu, &p.Alamat, &p.GolDarah, &p.Pekerjaan, &p.SttsNikah, &p.Agama,
				&p.TglDaftar, &p.NoTlp, &p.Umur, &p.Pnd, &p.Keluarga, &p.NamaKeluarga,
				&p.PngJawab, &p.NoPeserta, &p.PekerjaanPJ, &p.AlamatPJ, &p.NIP, &p.Email, &p.CacatFisik,
				&p.Status,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, p)
		}

		c.JSON(http.StatusOK, items)
	})

	// Daftar pendaftaran hari ini (reg_periksa + pasien + poliklinik + dokter)
	r.GET("/api/pendaftaran/today", func(c *gin.Context) {
		const q = `
			SELECT 
				r.no_rawat,
				r.no_rkm_medis,
				p.nm_pasien,
				r.tgl_registrasi,
				r.jam_reg,
				r.kd_poli,
				pl.nm_poli,
				r.kd_dokter,
				d.nm_dokter,
				r.status_lanjut,
				r.stts
			FROM reg_periksa r
			JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
			JOIN poliklinik pl ON r.kd_poli = pl.kd_poli
			JOIN dokter d ON r.kd_dokter = d.kd_dokter
			WHERE r.tgl_registrasi = CURDATE()
			ORDER BY r.jam_reg
		`

		rows, err := db.Query(q)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []RegToday
		for rows.Next() {
			var rToday RegToday
			if err := rows.Scan(
				&rToday.NoRawat,
				&rToday.NoRkmMedis,
				&rToday.NmPasien,
				&rToday.TglRegistrasi,
				&rToday.JamReg,
				&rToday.KdPoli,
				&rToday.NmPoli,
				&rToday.KdDokter,
				&rToday.NmDokter,
				&rToday.StatusLanjut,
				&rToday.Stts,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			items = append(items, rToday)
		}

		c.JSON(http.StatusOK, items)
	})

	// Cek data pasien berdasarkan No. RM (tabel: pasien)
	r.GET("/api/pendaftaran/pasien/:no_rkm_medis", func(c *gin.Context) {
		noRkmMedis := c.Param("no_rkm_medis")
		if noRkmMedis == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rkm_medis wajib diisi"})
			return
		}

		const q = `
			SELECT 
				pasien.no_rkm_medis,
				pasien.nm_pasien,
				pasien.jk,
				pasien.tmp_lahir,
				pasien.tgl_lahir,
				pasien.agama,
				COALESCE(bahasa_pasien.nama_bahasa, '') as nama_bahasa,
				COALESCE(cacat_fisik.nama_cacat, '') as nama_cacat,
				pasien.gol_darah,
				pasien.nm_ibu,
				pasien.stts_nikah,
				pasien.pnd,
				CONCAT(
					COALESCE(pasien.alamat, ''),
					', ',
					COALESCE(kelurahan.nm_kel, ''),
					', ',
					COALESCE(kecamatan.nm_kec, ''),
					', ',
					COALESCE(kabupaten.nm_kab, '')
				) as alamat,
				pasien.pekerjaan,
				COALESCE(pasien.umur, '') as umur,
				COALESCE(pasien.no_tlp, '') as no_tlp
			FROM pasien
			LEFT JOIN bahasa_pasien ON bahasa_pasien.id = pasien.bahasa_pasien
			LEFT JOIN cacat_fisik ON cacat_fisik.id = pasien.cacat_fisik
			LEFT JOIN kelurahan ON pasien.kd_kel = kelurahan.kd_kel
			LEFT JOIN kecamatan ON pasien.kd_kec = kecamatan.kd_kec
			LEFT JOIN kabupaten ON pasien.kd_kab = kabupaten.kd_kab
			WHERE pasien.no_rkm_medis = ?
			LIMIT 1
		`

		var p PatientBrief
		if err := db.QueryRow(q, noRkmMedis).Scan(
			&p.NoRkmMedis,
			&p.NmPasien,
			&p.Jk,
			&p.TmpLahir,
			&p.TglLahir,
			&p.Agama,
			&p.Bahasa,
			&p.CacatFisik,
			&p.GolDarah,
			&p.NmIbu,
			&p.SttsNikah,
			&p.Pnd,
			&p.Alamat,
			&p.Pekerjaan,
			&p.Umur,
			&p.NoTlp,
		); err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Pasien tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, p)
	})

	// Input pendaftaran rawat jalan baru (insert ke reg_periksa)
	r.POST("/api/pendaftaran/register", func(c *gin.Context) {
		var payload NewRegistration
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		now := time.Now()
		tgl := now.Format("2006-01-02")
		jam := now.Format("15:04:05")

		// Validasi 1: Cek apakah pasien sedang dalam masa perawatan di kamar inap
		var kamarInapCount int
		if err := db.QueryRow(
			`SELECT COUNT(pasien.no_rkm_medis) FROM pasien
			INNER JOIN reg_periksa ON reg_periksa.no_rkm_medis=pasien.no_rkm_medis
			INNER JOIN kamar_inap ON reg_periksa.no_rawat=kamar_inap.no_rawat
			WHERE kamar_inap.stts_pulang='-' AND pasien.no_rkm_medis=?`,
			payload.NoRkmMedis,
		).Scan(&kamarInapCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if kamarInapCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Pasien sedang dalam masa perawatan di kamar inap.",
			})
			return
		}

		// Validasi 2: Cegah duplikasi: pasien yang sama, poli yang sama, tanggal yang sama.
		var dupCount int
		if err := db.QueryRow(
			`SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis = ? AND kd_poli = ? AND tgl_registrasi = ?`,
			payload.NoRkmMedis,
			payload.KdPoli,
			tgl,
		).Scan(&dupCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if dupCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Pasien sudah terdaftar di poli ini untuk hari ini",
			})
			return
		}

		// Validasi 3: Cek kuota dokter untuk hari ini
		var regCount int
		if err := db.QueryRow(
			`SELECT COUNT(reg_periksa.no_rawat) FROM reg_periksa
			WHERE reg_periksa.kd_dokter=? AND reg_periksa.tgl_registrasi=?`,
			payload.KdDokter,
			tgl,
		).Scan(&regCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Ambil kuota dokter dari jadwal (jika ada)
		var kuota sql.NullInt64
		var namaDokter string
		if err := db.QueryRow(
			`SELECT dokter.nm_dokter, IFNULL(jadwal.kuota, 999) as kuota
			FROM dokter
			LEFT JOIN jadwal ON dokter.kd_dokter = jadwal.kd_dokter
			WHERE dokter.kd_dokter = ? LIMIT 1`,
			payload.KdDokter,
		).Scan(&namaDokter, &kuota); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dokter"})
			return
		}

		// Jika kuota valid, cek apakah sudah penuh
		if kuota.Valid && regCount >= int(kuota.Int64) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Kuota dokter %s untuk hari ini sudah penuh (%d/%d)", namaDokter, regCount, kuota.Int64),
			})
			return
		}

		// Gunakan no_reg dari frontend jika disediakan, jika tidak generate sendiri
		noReg := payload.NoReg
		if noReg == "" {
			var lastNoReg sql.NullInt64
			if err := db.QueryRow(
				`SELECT IFNULL(MAX(CONVERT(no_reg, SIGNED)), 0) FROM reg_periksa
				 WHERE kd_dokter = ? AND kd_poli = ? AND tgl_registrasi = ?`,
				payload.KdDokter, payload.KdPoli, tgl,
			).Scan(&lastNoReg); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			noReg = fmt.Sprintf("%03d", lastNoReg.Int64+1)
		}

		// Format no_rawat: YYYY/MM/DD/000001 (6 digit, kompatibel dengan Khanza)
		var maxNoRawat int
		db.QueryRow(
			`SELECT IFNULL(MAX(CONVERT(RIGHT(no_rawat, 6), SIGNED)), 0)
			 FROM reg_periksa WHERE tgl_registrasi = ?`, tgl,
		).Scan(&maxNoRawat)
		noRawat := fmt.Sprintf("%s/%06d", now.Format("2006/01/02"), maxNoRawat+1)

		// Ambil biaya registrasi dari poliklinik dan tgl_lahir pasien untuk hitung umur
		var biayaReg float64
		if err := db.QueryRow(
			`SELECT IFNULL(registrasi, 0) FROM poliklinik WHERE kd_poli = ?`,
			payload.KdPoli,
		).Scan(&biayaReg); err != nil {
			biayaReg = 0
		}

		var tglLahirStr sql.NullString
		db.QueryRow(`SELECT tgl_lahir FROM pasien WHERE no_rkm_medis = ?`, payload.NoRkmMedis).Scan(&tglLahirStr)

		umurDaftar := 0
		sttsUmur := "Th"
		if tglLahirStr.Valid && tglLahirStr.String != "" && tglLahirStr.String != "0000-00-00" {
			if tglLahir, err := time.Parse("2006-01-02", tglLahirStr.String[:10]); err == nil {
				years := now.Year() - tglLahir.Year()
				if now.Month() < tglLahir.Month() || (now.Month() == tglLahir.Month() && now.Day() < tglLahir.Day()) {
					years--
				}
				if years < 1 {
					months := int(now.Month()) - int(tglLahir.Month())
					if months < 0 {
						months += 12
					}
					umurDaftar = months
					sttsUmur = "Bln"
				} else {
					umurDaftar = years
					sttsUmur = "Th"
				}
			}
		}

		statusLanjut := "Ralan"
		stts := "Belum"

		const insertQ = `
			INSERT INTO reg_periksa
			(no_reg, no_rawat, tgl_registrasi, jam_reg, kd_dokter, kd_poli, no_rkm_medis, status_lanjut, kd_pj, biaya_reg, stts, p_jawab, hubunganpj, almt_pj, stts_daftar, umurdaftar, sttsumur, status_bayar)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`

		if _, err := db.Exec(
			insertQ,
			noReg,
			noRawat,
			tgl,
			jam,
			payload.KdDokter,
			payload.KdPoli,
			payload.NoRkmMedis,
			statusLanjut,
			payload.KdPj,
			biayaReg,
			stts,
			payload.PJawab,
			payload.HubunganPj,
			payload.AlmtPj,
			payload.SttsDaftar,
			umurDaftar,
			sttsUmur,
			"Belum Bayar",
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message":        "Pendaftaran berhasil disimpan",
			"no_reg":         noReg,
			"no_rawat":       noRawat,
			"tgl_registrasi": tgl,
			"jam_reg":        jam,
			"biaya_reg":      biayaReg,
		})
	})

	// Update status reg_periksa menjadi "Sudah" (setelah pemeriksaan selesai)
	// Menggunakan wildcard route untuk handle no_rawat dengan format YYYY/MM/DD/NNN
	r.PUT("/api/pendaftaran/update-status/*no_rawat", func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		// Remove leading slash dari wildcard parameter
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		// Update stts menjadi "Sudah"
		const updateQ = `UPDATE reg_periksa SET stts = ? WHERE no_rawat = ?`
		result, err := db.Exec(updateQ, "Sudah", noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data reg_periksa tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Status berhasil diupdate menjadi 'Sudah'",
			"no_rawat": noRawat,
			"stts":     "Sudah",
		})
	})

	// === Modul Rawat Jalan ===

	// Simpan Rujukan Poli Internal
	r.POST("/api/rujukan-internal/simpan", func(c *gin.Context) {
		var payload struct {
			NoRawat  string `json:"no_rawat" binding:"required"`
			KdDokter string `json:"kd_dokter" binding:"required"`
			KdPoli   string `json:"kd_poli" binding:"required"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		// Cek apakah sudah ada rujukan untuk no_rawat ini
		var existingCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM rujukan_internal_poli WHERE no_rawat = ?`, payload.NoRawat).Scan(&existingCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if existingCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sudah memiliki rujukan internal untuk no_rawat ini"})
			return
		}

		// Insert rujukan
		if _, err := db.Exec(`INSERT INTO rujukan_internal_poli (no_rawat, kd_dokter, kd_poli) VALUES (?, ?, ?)`, payload.NoRawat, payload.KdDokter, payload.KdPoli); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message":  "Rujukan internal berhasil disimpan",
			"no_rawat": payload.NoRawat,
		})
	})

	// Tab 1: Poli Hari Ini - Pasien yang mendaftar langsung ke poli (bukan rujukan internal)
	r.GET("/api/rawat-jalan/poli-today", func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))

		const q = `
			SELECT
				reg_periksa.no_reg,
				reg_periksa.no_rawat,
				DATE_FORMAT(reg_periksa.tgl_registrasi, '%d/%m/%Y') AS tgl_registrasi,
				reg_periksa.jam_reg,
				reg_periksa.kd_dokter,
				dokter.nm_dokter,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				poliklinik.nm_poli,
				reg_periksa.p_jawab,
				reg_periksa.almt_pj,
				reg_periksa.hubunganpj,
				reg_periksa.biaya_reg,
				reg_periksa.stts,
				penjab.png_jawab,
				CONCAT(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur) AS umur,
				reg_periksa.status_bayar,
				reg_periksa.status_poli,
				reg_periksa.kd_pj,
				reg_periksa.kd_poli,
				pasien.no_tlp
			FROM reg_periksa
			INNER JOIN dokter ON reg_periksa.kd_dokter=dokter.kd_dokter
			INNER JOIN pasien ON reg_periksa.no_rkm_medis=pasien.no_rkm_medis
			INNER JOIN poliklinik ON reg_periksa.kd_poli=poliklinik.kd_poli
			INNER JOIN penjab ON reg_periksa.kd_pj=penjab.kd_pj
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
			  AND reg_periksa.status_lanjut='Ralan'
			ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC
		`

		rows, err := db.Query(q, tglDari, tglSampai)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []map[string]interface{}
		for rows.Next() {
			var noReg, noRawat, tglReg, jamReg, kdDokter, nmDokter string
			var noRkm, nmPasien, nmPoli string
			var pjawab, almtPj, hubunganPj sql.NullString
			var biayaReg sql.NullFloat64
			var stts, pngJawab, statusBayar, statusPoli string
			var umur sql.NullString
			var kdPj, kdPoli string
			var noTlp sql.NullString

			if err := rows.Scan(
				&noReg, &noRawat, &tglReg, &jamReg, &kdDokter, &nmDokter,
				&noRkm, &nmPasien, &nmPoli, &pjawab, &almtPj, &hubunganPj,
				&biayaReg, &stts, &pngJawab, &umur, &statusBayar, &statusPoli,
				&kdPj, &kdPoli, &noTlp,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			items = append(items, map[string]interface{}{
				"no_reg":         noReg,
				"no_rawat":       noRawat,
				"tgl_registrasi": tglReg,
				"jam_reg":        jamReg,
				"kd_dokter":      kdDokter,
				"nm_dokter":      nmDokter,
				"no_rkm_medis":   noRkm,
				"nm_pasien":      nmPasien,
				"nm_poli":        nmPoli,
				"p_jawab":        pjawab.String,
				"almt_pj":        almtPj.String,
				"hubunganpj":     hubunganPj.String,
				"biaya_reg":      biayaReg.Float64,
				"stts":           stts,
				"png_jawab":      pngJawab,
				"umur":           umur.String,
				"status_bayar":   statusBayar,
				"status_poli":    statusPoli,
				"kd_pj":          kdPj,
				"kd_poli":        kdPoli,
				"no_tlp":         noTlp.String,
			})
		}

		c.JSON(http.StatusOK, items)
	})

	// Tab 2: Rujukan Poli Internal - Pasien yang dirujuk dari poli lain
	r.GET("/api/rawat-jalan/rujukan-internal", func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))

		const q = `
			SELECT
				reg_periksa.no_rawat,
				DATE_FORMAT(reg_periksa.tgl_registrasi, '%d/%m/%Y') AS tgl_registrasi,
				reg_periksa.jam_reg,
				rujukan_internal_poli.kd_dokter,
				dokter.nm_dokter,
				reg_periksa.no_rkm_medis,
				pasien.nm_pasien,
				poliklinik.nm_poli,
				reg_periksa.p_jawab,
				reg_periksa.almt_pj,
				reg_periksa.hubunganpj,
				reg_periksa.stts,
				penjab.png_jawab,
				rujukan_internal_poli.kd_poli,
				CONCAT(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur) AS umur,
				reg_periksa.kd_pj,
				pasien.no_tlp,
				reg_periksa.status_bayar,
				reg_periksa.status_poli
			FROM reg_periksa
			INNER JOIN rujukan_internal_poli ON rujukan_internal_poli.no_rawat=reg_periksa.no_rawat
			INNER JOIN dokter ON rujukan_internal_poli.kd_dokter=dokter.kd_dokter
			INNER JOIN pasien ON reg_periksa.no_rkm_medis=pasien.no_rkm_medis
			INNER JOIN poliklinik ON rujukan_internal_poli.kd_poli=poliklinik.kd_poli
			INNER JOIN penjab ON reg_periksa.kd_pj=penjab.kd_pj
			WHERE reg_periksa.status_lanjut='Ralan'
			  AND reg_periksa.tgl_registrasi BETWEEN ? AND ?
			ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC
		`

		rows, err := db.Query(q, tglDari, tglSampai)
		if err != nil {
			// Jika tabel rujukan_internal_poli tidak ada, return empty array
			c.JSON(http.StatusOK, []map[string]interface{}{})
			return
		}
		defer rows.Close()

		var items []map[string]interface{}
		for rows.Next() {
			var noRawat, tglReg, jamReg, kdDokter, nmDokter string
			var noRkm, nmPasien, nmPoli string
			var pjawab, almtPj, hubunganPj sql.NullString
			var stts, pngJawab, kdPoli, kdPj string
			var umur sql.NullString
			var noTlp sql.NullString
			var statusBayar, statusPoli string

			if err := rows.Scan(
				&noRawat, &tglReg, &jamReg, &kdDokter, &nmDokter,
				&noRkm, &nmPasien, &nmPoli, &pjawab, &almtPj, &hubunganPj,
				&stts, &pngJawab, &kdPoli, &umur, &kdPj, &noTlp,
				&statusBayar, &statusPoli,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			items = append(items, map[string]interface{}{
				"no_rawat":       noRawat,
				"tgl_registrasi": tglReg,
				"jam_reg":        jamReg,
				"kd_dokter":      kdDokter,
				"nm_dokter":      nmDokter,
				"no_rkm_medis":   noRkm,
				"nm_pasien":      nmPasien,
				"nm_poli":        nmPoli,
				"p_jawab":        pjawab.String,
				"almt_pj":        almtPj.String,
				"hubunganpj":     hubunganPj.String,
				"stts":           stts,
				"png_jawab":      pngJawab,
				"kd_poli":        kdPoli,
				"umur":           umur.String,
				"kd_pj":          kdPj,
				"no_tlp":         noTlp.String,
				"status_bayar":   statusBayar,
				"status_poli":    statusPoli,
			})
		}

		c.JSON(http.StatusOK, items)
	})

	// Update Status Periksa
	r.PUT("/api/rawat-jalan/update-status", func(c *gin.Context) {
		var payload struct {
			NoRawat string `json:"no_rawat" binding:"required"`
			Status  string `json:"status" binding:"required"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Update status di tabel reg_periksa
		query := "UPDATE reg_periksa SET stts = ? WHERE no_rawat = ?"
		result, err := db.Exec(query, payload.Status, payload.NoRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate status: " + err.Error()})
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengecek hasil update: " + err.Error()})
			return
		}

		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "No rawat tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Status berhasil diupdate",
			"no_rawat": payload.NoRawat,
			"status":   payload.Status,
		})
	})

	// === Modul Pemeriksaan (SOAP) ===

	// Get SOAP History for a patient
	r.GET("/api/pemeriksaan/soap-history/*no_rawat", func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		// Remove leading slash from wildcard parameter
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		const q = `
			SELECT
				no_rawat,
				tgl_perawatan,
				jam_rawat,
				suhu_tubuh,
				tensi,
				nadi,
				respirasi,
				tinggi,
				berat,
				spo2,
				gcs,
				kesadaran,
				keluhan,
				pemeriksaan,
				alergi,
				lingkar_perut,
				rtl,
				penilaian,
				instruksi,
				evaluasi,
				nip
			FROM pemeriksaan_ralan
			WHERE no_rawat = ?
			ORDER BY tgl_perawatan DESC, jam_rawat DESC
		`

		rows, err := db.Query(q, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var items []map[string]interface{}
		for rows.Next() {
			var noRawat, tglPerawatan, jamRawat string
			var suhuTubuh, tensi, nadi, respirasi, tinggi, berat sql.NullString
			var spo2, gcs, kesadaran sql.NullString
			var keluhan, pemeriksaan, alergi, lingkarPerut sql.NullString
			var rtl, penilaian, instruksi, evaluasi, nip sql.NullString

			if err := rows.Scan(
				&noRawat, &tglPerawatan, &jamRawat,
				&suhuTubuh, &tensi, &nadi, &respirasi, &tinggi, &berat,
				&spo2, &gcs, &kesadaran,
				&keluhan, &pemeriksaan, &alergi, &lingkarPerut,
				&rtl, &penilaian, &instruksi, &evaluasi, &nip,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			items = append(items, map[string]interface{}{
				"no_rawat":      noRawat,
				"tgl_perawatan": tglPerawatan,
				"jam_rawat":     jamRawat,
				"suhu_tubuh":    suhuTubuh.String,
				"tensi":         tensi.String,
				"nadi":          nadi.String,
				"respirasi":     respirasi.String,
				"tinggi":        tinggi.String,
				"berat":         berat.String,
				"spo2":          spo2.String,
				"gcs":           gcs.String,
				"kesadaran":     kesadaran.String,
				"keluhan":       keluhan.String,
				"pemeriksaan":   pemeriksaan.String,
				"alergi":        alergi.String,
				"lingkar_perut": lingkarPerut.String,
				"rtl":           rtl.String,
				"penilaian":     penilaian.String,
				"instruksi":     instruksi.String,
				"evaluasi":      evaluasi.String,
				"nip":           nip.String,
			})
		}

		c.JSON(http.StatusOK, items)
	})

	// Get SOAPIE History for a patient with filter options
	// Similar to Java code: tampilSoapi() method
	r.GET("/api/pemeriksaan/riwayat-soapie/:no_rkm_medis", func(c *gin.Context) {
		noRkm := c.Param("no_rkm_medis")
		filterType := c.DefaultQuery("filter", "last5") // last5, all, dateRange, specific
		dateFrom := c.Query("date_from")
		dateTo := c.Query("date_to")
		specificNoRawat := c.Query("no_rawat")

		// Build query based on filter type
		var regQuery string
		var args []interface{}

		switch filterType {
		case "last5":
			regQuery = `
				SELECT no_reg, no_rawat, tgl_registrasi, status_lanjut
				FROM reg_periksa
				WHERE stts <> 'Batal' AND no_rkm_medis = ?
				ORDER BY tgl_registrasi DESC
				LIMIT 5
			`
			args = []interface{}{noRkm}
		case "all":
			regQuery = `
				SELECT no_reg, no_rawat, tgl_registrasi, status_lanjut
				FROM reg_periksa
				WHERE stts <> 'Batal' AND no_rkm_medis = ?
				ORDER BY tgl_registrasi
			`
			args = []interface{}{noRkm}
		case "dateRange":
			if dateFrom == "" || dateTo == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "date_from and date_to required for dateRange filter"})
				return
			}
			regQuery = `
				SELECT no_reg, no_rawat, tgl_registrasi, status_lanjut
				FROM reg_periksa
				WHERE stts <> 'Batal' AND no_rkm_medis = ?
				AND tgl_registrasi BETWEEN ? AND ?
				ORDER BY tgl_registrasi
			`
			args = []interface{}{noRkm, dateFrom, dateTo}
		case "specific":
			if specificNoRawat == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat required for specific filter"})
				return
			}
			regQuery = `
				SELECT no_reg, no_rawat, tgl_registrasi, status_lanjut
				FROM reg_periksa
				WHERE stts <> 'Batal' AND no_rkm_medis = ? AND no_rawat = ?
			`
			args = []interface{}{noRkm, specificNoRawat}
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filter type"})
			return
		}

		// Execute registration query
		regRows, err := db.Query(regQuery, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer regRows.Close()

		type SoapieItem struct {
			TglPerawatan string `json:"tgl_perawatan"`
			JamRawat     string `json:"jam_rawat"`
			SuhuTubuh    string `json:"suhu_tubuh"`
			Tensi        string `json:"tensi"`
			Nadi         string `json:"nadi"`
			Respirasi    string `json:"respirasi"`
			Tinggi       string `json:"tinggi"`
			Berat        string `json:"berat"`
			GCS          string `json:"gcs"`
			SpO2         string `json:"spo2"`
			Kesadaran    string `json:"kesadaran"`
			Keluhan      string `json:"keluhan"`
			Pemeriksaan  string `json:"pemeriksaan"`
			Alergi       string `json:"alergi"`
			LingkarPerut string `json:"lingkar_perut"`
			RTL          string `json:"rtl"`
			Penilaian    string `json:"penilaian"`
			Instruksi    string `json:"instruksi"`
			Evaluasi     string `json:"evaluasi"`
			NIP          string `json:"nip"`
			Nama         string `json:"nama"`
			Jabatan      string `json:"jbtn"`
		}

		type Registration struct {
			NoReg         string       `json:"no_reg"`
			NoRawat       string       `json:"no_rawat"`
			TglRegistrasi string       `json:"tgl_registrasi"`
			StatusLanjut  string       `json:"status_lanjut"`
			Soapie        []SoapieItem `json:"soapie"`
		}

		var results []Registration

		for regRows.Next() {
			var reg Registration
			if err := regRows.Scan(&reg.NoReg, &reg.NoRawat, &reg.TglRegistrasi, &reg.StatusLanjut); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Get SOAPIE data from pemeriksaan_ralan
			ralanQuery := `
				SELECT pemeriksaan_ralan.tgl_perawatan, pemeriksaan_ralan.jam_rawat,
					pemeriksaan_ralan.suhu_tubuh, pemeriksaan_ralan.tensi, pemeriksaan_ralan.nadi,
					pemeriksaan_ralan.respirasi, pemeriksaan_ralan.tinggi, pemeriksaan_ralan.berat,
					pemeriksaan_ralan.gcs, pemeriksaan_ralan.spo2, pemeriksaan_ralan.kesadaran,
					pemeriksaan_ralan.keluhan, pemeriksaan_ralan.pemeriksaan, pemeriksaan_ralan.alergi,
					pemeriksaan_ralan.lingkar_perut, pemeriksaan_ralan.rtl, pemeriksaan_ralan.penilaian,
					pemeriksaan_ralan.instruksi, pemeriksaan_ralan.evaluasi, pemeriksaan_ralan.nip,
					pegawai.nama, pegawai.jbtn
				FROM pemeriksaan_ralan
				INNER JOIN pegawai ON pemeriksaan_ralan.nip = pegawai.nik
				WHERE pemeriksaan_ralan.no_rawat = ?
				ORDER BY pemeriksaan_ralan.tgl_perawatan, pemeriksaan_ralan.jam_rawat
			`

			ralanRows, err := db.Query(ralanQuery, reg.NoRawat)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			var soapieItems []SoapieItem
			for ralanRows.Next() {
				var item SoapieItem
				var suhuTubuh, tensi, nadi, respirasi, tinggi, berat sql.NullString
				var gcs, spo2, kesadaran, keluhan, pemeriksaan, alergi sql.NullString
				var lingkarPerut, rtl, penilaian, instruksi, evaluasi sql.NullString
				var nama, jabatan sql.NullString

				if err := ralanRows.Scan(
					&item.TglPerawatan, &item.JamRawat,
					&suhuTubuh, &tensi, &nadi, &respirasi, &tinggi, &berat,
					&gcs, &spo2, &kesadaran,
					&keluhan, &pemeriksaan, &alergi, &lingkarPerut,
					&rtl, &penilaian, &instruksi, &evaluasi, &item.NIP,
					&nama, &jabatan,
				); err != nil {
					ralanRows.Close()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}

				item.SuhuTubuh = suhuTubuh.String
				item.Tensi = tensi.String
				item.Nadi = nadi.String
				item.Respirasi = respirasi.String
				item.Tinggi = tinggi.String
				item.Berat = berat.String
				item.GCS = gcs.String
				item.SpO2 = spo2.String
				item.Kesadaran = kesadaran.String
				item.Keluhan = keluhan.String
				item.Pemeriksaan = pemeriksaan.String
				item.Alergi = alergi.String
				item.LingkarPerut = lingkarPerut.String
				item.RTL = rtl.String
				item.Penilaian = penilaian.String
				item.Instruksi = instruksi.String
				item.Evaluasi = evaluasi.String
				item.Nama = nama.String
				item.Jabatan = jabatan.String

				soapieItems = append(soapieItems, item)
			}
			ralanRows.Close()

			// Get SOAPIE data from pemeriksaan_ranap
			ranapQuery := `
				SELECT pemeriksaan_ranap.tgl_perawatan, pemeriksaan_ranap.jam_rawat,
					pemeriksaan_ranap.suhu_tubuh, pemeriksaan_ranap.tensi, pemeriksaan_ranap.nadi,
					pemeriksaan_ranap.respirasi, pemeriksaan_ranap.tinggi, pemeriksaan_ranap.berat,
					pemeriksaan_ranap.gcs, pemeriksaan_ranap.spo2, pemeriksaan_ranap.kesadaran,
					pemeriksaan_ranap.keluhan, pemeriksaan_ranap.pemeriksaan, pemeriksaan_ranap.alergi,
					'', pemeriksaan_ranap.rtl, pemeriksaan_ranap.penilaian,
					pemeriksaan_ranap.instruksi, pemeriksaan_ranap.evaluasi, pemeriksaan_ranap.nip,
					pegawai.nama, pegawai.jbtn
				FROM pemeriksaan_ranap
				INNER JOIN pegawai ON pemeriksaan_ranap.nip = pegawai.nik
				WHERE pemeriksaan_ranap.no_rawat = ?
				ORDER BY pemeriksaan_ranap.tgl_perawatan, pemeriksaan_ranap.jam_rawat
			`

			ranapRows, err := db.Query(ranapQuery, reg.NoRawat)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			for ranapRows.Next() {
				var item SoapieItem
				var suhuTubuh, tensi, nadi, respirasi, tinggi, berat sql.NullString
				var gcs, spo2, kesadaran, keluhan, pemeriksaan, alergi sql.NullString
				var lingkarPerut, rtl, penilaian, instruksi, evaluasi sql.NullString
				var nama, jabatan sql.NullString

				if err := ranapRows.Scan(
					&item.TglPerawatan, &item.JamRawat,
					&suhuTubuh, &tensi, &nadi, &respirasi, &tinggi, &berat,
					&gcs, &spo2, &kesadaran,
					&keluhan, &pemeriksaan, &alergi, &lingkarPerut,
					&rtl, &penilaian, &instruksi, &evaluasi, &item.NIP,
					&nama, &jabatan,
				); err != nil {
					ranapRows.Close()
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}

				item.SuhuTubuh = suhuTubuh.String
				item.Tensi = tensi.String
				item.Nadi = nadi.String
				item.Respirasi = respirasi.String
				item.Tinggi = tinggi.String
				item.Berat = berat.String
				item.GCS = gcs.String
				item.SpO2 = spo2.String
				item.Kesadaran = kesadaran.String
				item.Keluhan = keluhan.String
				item.Pemeriksaan = pemeriksaan.String
				item.Alergi = alergi.String
				item.LingkarPerut = lingkarPerut.String
				item.RTL = rtl.String
				item.Penilaian = penilaian.String
				item.Instruksi = instruksi.String
				item.Evaluasi = evaluasi.String
				item.Nama = nama.String
				item.Jabatan = jabatan.String

				soapieItems = append(soapieItems, item)
			}
			ranapRows.Close()

			reg.Soapie = soapieItems
			results = append(results, reg)
		}

		c.JSON(http.StatusOK, results)
	})

	// Save SOAP
	r.POST("/api/pemeriksaan/soap", func(c *gin.Context) {
		var payload struct {
			NoRawat      string `json:"no_rawat" binding:"required"`
			TglPerawatan string `json:"tgl_perawatan" binding:"required"`
			JamRawat     string `json:"jam_rawat" binding:"required"`
			SuhuTubuh    string `json:"suhu_tubuh"`
			Tensi        string `json:"tensi"`
			Nadi         string `json:"nadi"`
			Respirasi    string `json:"respirasi"`
			Tinggi       string `json:"tinggi"`
			Berat        string `json:"berat"`
			SpO2         string `json:"spo2"`
			GCS          string `json:"gcs"`
			Kesadaran    string `json:"kesadaran"`
			Keluhan      string `json:"keluhan" binding:"required"`
			Pemeriksaan  string `json:"pemeriksaan" binding:"required"`
			Alergi       string `json:"alergi"`
			LingkarPerut string `json:"lingkar_perut"`
			RTL          string `json:"rtl"`
			Penilaian    string `json:"penilaian" binding:"required"`
			Instruksi    string `json:"instruksi"`
			Evaluasi     string `json:"evaluasi"`
			NIP          string `json:"nip" binding:"required"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		// Validasi at least one field is filled
		if payload.Keluhan == "" && payload.Pemeriksaan == "" && payload.SuhuTubuh == "" &&
			payload.Tensi == "" && payload.Alergi == "" && payload.Tinggi == "" &&
			payload.Berat == "" && payload.Respirasi == "" && payload.Nadi == "" &&
			payload.GCS == "" && payload.RTL == "" && payload.Penilaian == "" &&
			payload.Instruksi == "" && payload.SpO2 == "" && payload.Evaluasi == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal satu field harus diisi"})
			return
		}

		const insertQ = `
			INSERT INTO pemeriksaan_ralan
			(no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
			 tinggi, berat, spo2, gcs, kesadaran, keluhan, pemeriksaan, alergi,
			 lingkar_perut, rtl, penilaian, instruksi, evaluasi, nip)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`

		if _, err := db.Exec(
			insertQ,
			payload.NoRawat,
			payload.TglPerawatan,
			payload.JamRawat,
			payload.SuhuTubuh,
			payload.Tensi,
			payload.Nadi,
			payload.Respirasi,
			payload.Tinggi,
			payload.Berat,
			payload.SpO2,
			payload.GCS,
			payload.Kesadaran,
			payload.Keluhan,
			payload.Pemeriksaan,
			payload.Alergi,
			payload.LingkarPerut,
			payload.RTL,
			payload.Penilaian,
			payload.Instruksi,
			payload.Evaluasi,
			payload.NIP,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "SOAP berhasil disimpan",
		})
	})

	// Update SOAP
	r.PUT("/api/pemeriksaan/soap", func(c *gin.Context) {
		var payload struct {
			NoRawat      string `json:"no_rawat" binding:"required"`
			TglPerawatan string `json:"tgl_perawatan" binding:"required"`
			JamRawat     string `json:"jam_rawat" binding:"required"`
			SuhuTubuh    string `json:"suhu_tubuh"`
			Tensi        string `json:"tensi"`
			Nadi         string `json:"nadi"`
			Respirasi    string `json:"respirasi"`
			Tinggi       string `json:"tinggi"`
			Berat        string `json:"berat"`
			SpO2         string `json:"spo2"`
			GCS          string `json:"gcs"`
			Kesadaran    string `json:"kesadaran"`
			Keluhan      string `json:"keluhan" binding:"required"`
			Pemeriksaan  string `json:"pemeriksaan" binding:"required"`
			Alergi       string `json:"alergi"`
			LingkarPerut string `json:"lingkar_perut"`
			RTL          string `json:"rtl"`
			Penilaian    string `json:"penilaian" binding:"required"`
			Instruksi    string `json:"instruksi"`
			Evaluasi     string `json:"evaluasi"`
			NIP          string `json:"nip" binding:"required"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap atau tidak valid"})
			return
		}

		// Validasi at least one field is filled
		if payload.Keluhan == "" && payload.Pemeriksaan == "" && payload.SuhuTubuh == "" &&
			payload.Tensi == "" && payload.Alergi == "" && payload.Tinggi == "" &&
			payload.Berat == "" && payload.Respirasi == "" && payload.Nadi == "" &&
			payload.GCS == "" && payload.RTL == "" && payload.Penilaian == "" &&
			payload.Instruksi == "" && payload.SpO2 == "" && payload.Evaluasi == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal satu field harus diisi"})
			return
		}

		const updateQ = `
			UPDATE pemeriksaan_ralan
			SET suhu_tubuh = ?, tensi = ?, nadi = ?, respirasi = ?,
				tinggi = ?, berat = ?, spo2 = ?, gcs = ?, kesadaran = ?,
				keluhan = ?, pemeriksaan = ?, alergi = ?, lingkar_perut = ?,
				rtl = ?, penilaian = ?, instruksi = ?, evaluasi = ?, nip = ?
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
		`

		result, err := db.Exec(
			updateQ,
			payload.SuhuTubuh,
			payload.Tensi,
			payload.Nadi,
			payload.Respirasi,
			payload.Tinggi,
			payload.Berat,
			payload.SpO2,
			payload.GCS,
			payload.Kesadaran,
			payload.Keluhan,
			payload.Pemeriksaan,
			payload.Alergi,
			payload.LingkarPerut,
			payload.RTL,
			payload.Penilaian,
			payload.Instruksi,
			payload.Evaluasi,
			payload.NIP,
			payload.NoRawat,
			payload.TglPerawatan,
			payload.JamRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SOAP tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "SOAP berhasil diupdate",
		})
	})

	// Delete SOAP - menggunakan query parameter untuk menghindari masalah encoding
	r.DELETE("/api/pemeriksaan/soap", func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		tglPerawatan := c.Query("tgl_perawatan")
		jamRawat := c.Query("jam_rawat")

		if noRawat == "" || tglPerawatan == "" || jamRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter no_rawat, tgl_perawatan, dan jam_rawat wajib diisi"})
			return
		}

		const deleteQ = `
			DELETE FROM pemeriksaan_ralan
			WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
		`

		result, err := db.Exec(deleteQ, noRawat, tglPerawatan, jamRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SOAP tidak ditemukan"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "SOAP berhasil dihapus",
		})
	})

	// ============================================================================
	// OBAT & RESEP ENDPOINTS
	// ============================================================================
	// Endpoint Search Obat (untuk modal resep)
	r.GET("/api/obat/search", searchObat(db))

	// Endpoint Resep History (sudah diimplementasikan dengan support today filter)
	r.GET("/api/resep/history/:no_rkm_medis", getRiwayatResep(db))

	// Endpoint Submit Resep
	r.POST("/api/resep/submit", submitResep(db))

	// Endpoint Delete Resep (hanya bisa hapus jika belum terlayani)
	r.DELETE("/api/resep/:no_resep", deleteResep(db))
	// ============================================================================
	// LABORATORIUM ENDPOINTS
	// ============================================================================

	// Get jenis perawatan lab (PK/PA)
	r.GET("/api/lab/jenis-perawatan", getJenisPerawatanLab(db))

	// Get template laboratorium
	r.GET("/api/lab/template", getTemplateLab(db))

	// Simpan permintaan lab
	r.POST("/api/lab/permintaan-pk", simpanPermintaanLabPK(db))
	r.POST("/api/lab/permintaan-pa", simpanPermintaanLabPA(db))

	// Get riwayat permintaan lab (gunakan wildcard untuk handle slash di no_rawat)
	r.GET("/api/lab/riwayat-pk/*no_rawat", getRiwayatLabPK(db))
	r.GET("/api/lab/riwayat-pa/*no_rawat", getRiwayatLabPA(db))

	// Delete permintaan lab
	r.DELETE("/api/lab/permintaan-pk/:noorder", deletePermintaanLabPK(db))
	r.DELETE("/api/lab/permintaan-pa/:noorder", deletePermintaanLabPA(db))

	// Get hasil lab detail lengkap
	r.GET("/api/lab/hasil-detail", getHasilLabDetail(db))

	// ============================================================================
	// RADIOLOGI ENDPOINTS
	// ============================================================================

	// Info rawat pasien untuk radiologi (replicates Khanza isRawat())
	r.GET("/api/radiologi/info-rawat/*no_rawat", getInfoRawatRadiologi(db))

	// Get jenis perawatan radiologi
	r.GET("/api/radiologi/jenis-perawatan", getJenisPerawatanRadiologi(db))

	// Simpan permintaan radiologi
	r.POST("/api/radiologi/permintaan", createPermintaanRadiologi(db))

	// Get riwayat permintaan radiologi (gunakan wildcard untuk handle slash di no_rawat)
	r.GET("/api/radiologi/riwayat/*no_rawat", getRiwayatRadiologi(db))

	// Riwayat Perawatan endpoint
	r.GET("/api/riwayat-perawatan/:no_rkm_medis", getRiwayatPerawatan(db))
	// Delete permintaan radiologi
	r.DELETE("/api/radiologi/permintaan/:noorder", deletePermintaanRadiologi(db))

	// Triase IGD endpoint
	r.GET("/api/triase-igd/*no_rawat", getTriaseIGD(db))

	// Asuhan Medis IGD endpoint
	r.GET("/api/asuhan-medis-igd/*no_rawat", getAsuhanMedisIGD(db))

	// Pemeriksaan Rawat Jalan endpoint
	r.GET("/api/pemeriksaan-ralan/*no_rawat", getPemeriksaanRalan(db))

	// Diagnosa (ICD10) & Prosedur (ICD9) — tab "Diagnosa" di Pemeriksaan
	r.GET("/api/penyakit/search", searchPenyakit(db))
	r.GET("/api/icd9/search", searchIcd9(db))
	r.GET("/api/pemeriksaan/diagnosa/*no_rawat", getDiagnosaPasien(db))
	r.POST("/api/pemeriksaan/diagnosa", saveDiagnosaPasien(db))
	r.DELETE("/api/pemeriksaan/diagnosa", deleteDiagnosaPasien(db))
	r.GET("/api/pemeriksaan/prosedur/*no_rawat", getProsedurPasien(db))
	r.POST("/api/pemeriksaan/prosedur", saveProsedurPasien(db))
	r.DELETE("/api/pemeriksaan/prosedur", deleteProsedurPasien(db))

	// Pemeriksaan Rawat Inap endpoints
	r.GET("/api/pemeriksaan-ranap/*no_rawat", getPemeriksaanRanap(db))
	r.POST("/api/pemeriksaan-ranap", savePemeriksaanRanap(db))
	r.PUT("/api/pemeriksaan-ranap", updatePemeriksaanRanap(db))
	r.DELETE("/api/pemeriksaan-ranap", deletePemeriksaanRanap(db))

	// ADIME Gizi endpoints
	r.GET("/api/adime/*no_rawat", getAdime(db))
	r.POST("/api/adime", saveAdime(db))
	r.PUT("/api/adime", updateAdime(db))
	r.DELETE("/api/adime", deleteAdime(db))

	// Asuhan Keperawatan IGD endpoint
	r.GET("/api/asuhan-keperawatan-igd/*no_rawat", getAsuhanKeperawatanIGD(db))

	// Laboratorium endpoint
	r.GET("/api/laboratorium/*no_rawat", getLaboratorium(db))

	// Radiologi Data endpoint (untuk riwayat perawatan lengkap)
	r.GET("/api/radiologi-data/*no_rawat", getRadiologi(db))

	// Berkas Digital Perawatan
	r.GET("/api/berkas-rawat/master", getMasterBerkas(db))
	r.GET("/api/berkas-rawat/list/*no_rawat", listBerkasRawat(db))
	r.POST("/api/berkas-rawat/upload", uploadBerkasRawat(db, khanzaCfg))
	r.DELETE("/api/berkas-rawat", deleteBerkasRawat(db, khanzaCfg))

	// Tindakan Rawat Jalan endpoint
	r.GET("/api/tindakan-ralan/*no_rawat", getTindakanRalan(db))
	r.GET("/api/tindakan/jenis-perawatan", func(c *gin.Context) {
		GetJenisTindakan(c, db)
	})
	r.POST("/api/tindakan/simpan", func(c *gin.Context) {
		SimpanTindakan(c, db)
	})
	r.POST("/api/tindakan/simpan-petugas", func(c *gin.Context) {
		SimpanTindakanPetugas(c, db)
	})
	r.POST("/api/tindakan/simpan-drpr", func(c *gin.Context) {
		SimpanTindakanDrPr(c, db)
	})
	r.DELETE("/api/tindakan/delete", func(c *gin.Context) {
		DeleteTindakan(c, db)
	})
	r.DELETE("/api/tindakan/delete-petugas", func(c *gin.Context) {
		DeleteTindakanPetugas(c, db)
	})
	r.DELETE("/api/tindakan/delete-dokter-petugas", func(c *gin.Context) {
		DeleteTindakanDokterPetugas(c, db)
	})

	// Tindakan Rawat Inap endpoint
	r.GET("/api/tindakan-ranap/*no_rawat", getTindakanRanap(db))

	// Kamar Inap endpoint
	r.GET("/api/kamar-inap/*no_rawat", getKamarInap(db))

	// Rawat Inap List endpoint (daftar pasien rawat inap)
	r.GET("/api/rawat-inap/list", getRawatInapList(db))

	// Klaim INACBG endpoints
	r.GET("/api/klaim-inacbg/list", getKlaimInacbgList(db))
	r.POST("/api/klaim-inacbg", saveKlaimInacbg(db))

	r.GET("/api/jasa-medis", getJasaMedisList(db))
	r.POST("/api/jasa-medis", createJasaMedis(db))
	r.PUT("/api/jasa-medis/:id", updateJasaMedis(db))
	r.DELETE("/api/jasa-medis/:id", deleteJasaMedis(db))

	r.GET("/api/preview-billing-pengaturan", getPreviewBillingPengaturan(db))
	r.PUT("/api/preview-billing-pengaturan/:kategori", savePreviewBillingKategori(db))

	r.GET("/api/preview-obat-pengaturan", getPreviewObatPengaturan(db))
	r.PUT("/api/preview-obat-pengaturan", savePreviewObatPengaturan(db))

	// Bridging SEP (BPJS VClaim) endpoints
	r.GET("/api/bridging/sep/list", getBridgingSepList(db))
	r.GET("/api/bridging/sep/count-today", getBridgingSepCountToday(db))
	r.POST("/api/bridging/sep", saveBridgingSepLocal(db))
	r.POST("/api/bridging/sep/insert", insertSepToBpjs(db))
	r.POST("/api/bridging/sep/kirim/*no_sep", sendSepToBpjs(db))
	r.PUT("/api/bridging/sep/update", updateSepToBpjs(db))
	r.DELETE("/api/bridging/sep/*no_sep", deleteSepFromBpjs(db))
	r.GET("/api/bridging/sep-internal/list", getBridgingSepInternalList(db))
	r.DELETE("/api/bridging/sep-internal/*no_sep", deleteSepInternalFromBpjs(db))
	r.GET("/api/bridging/sep/suplesi/*no_kartu", getSepSuplesi(db))
	r.GET("/api/bridging/sep/kll-induk/*no_kartu", getSepKllIndukList(db))
	r.PUT("/api/bridging/sep/update-tgl-pulang", updateTglPulangSep(db))
	r.GET("/api/bridging/sep/cari/*no_sep", searchSepBpjs(db))
	r.GET("/api/bridging/sep-internal/cari/*no_sep", searchSepInternalBpjs(db))
	r.GET("/api/bridging/sep/monitoring", getMonitoringSep(db))
	r.GET("/api/bridging/sep/monitoring-klaim", getMonitoringKlaim(db))
	r.GET("/api/bridging/sep/klaim-count-today", getKlaimCountToday(db))

	// Bridging Peserta (BPJS VClaim) endpoints
	r.GET("/api/bridging/peserta/nokartu/*no_kartu", searchPesertaByNoKartu(db))
	r.GET("/api/bridging/peserta/nik/*nik", searchPesertaByNik(db))

	// Bridging Referensi (BPJS VClaim) — proxy generik referensi/*
	r.GET("/api/bridging/referensi/*path", getReferensiBpjs(db))

	// Bridging Rujukan Online (BPJS VClaim)
	r.GET("/api/bridging/rujukan/*id", searchRujukan(db))

	// Bridging Pengajuan & Aproval Penjaminan (BPJS VClaim)
	r.GET("/api/bridging/pengajuan-penjaminan/list", getPengajuanPenjaminanList(db))
	r.POST("/api/bridging/pengajuan-penjaminan", submitPengajuanPenjaminan(db))
	r.POST("/api/bridging/pengajuan-penjaminan/approval", approvalPengajuanPenjaminan(db))

	// Bridging Rujukan Keluar — Pembuatan/Edit Rujukan (BPJS VClaim)
	r.GET("/api/bridging/rujukan-keluar/list", getRujukanKeluarList(db))
	r.POST("/api/bridging/rujukan-keluar", createRujukanKeluar(db))
	r.PUT("/api/bridging/rujukan-keluar", updateRujukanKeluar(db))
	r.GET("/api/bridging/rujukan-keluar/bpjs/*no_rujukan", getRujukanKeluarDetailBpjs(db))
	r.GET("/api/bridging/rujukan-spesialistik/*ppk", getListSpesialistikRujukan(db))
	r.GET("/api/bridging/rujukan-sarana/*ppk", getListSaranaRujukan(db))

	// Bridging Surat Kontrol / SPRI (BPJS VClaim)
	r.GET("/api/bridging/surat-kontrol/list", getSuratKontrolList(db))
	r.POST("/api/bridging/surat-kontrol", createRencanaKontrol(db))
	r.PUT("/api/bridging/surat-kontrol", updateRencanaKontrol(db))
	r.DELETE("/api/bridging/surat-kontrol/*no_surat", deleteRencanaKontrol(db))
	r.GET("/api/bridging/surat-kontrol/jadwal-spesialistik", getJadwalSpesialistikKontrol(db))
	r.GET("/api/bridging/surat-kontrol/jadwal-dokter", getJadwalDokterKontrol(db))
	r.GET("/api/bridging/surat-kontrol/bpjs-list", getBpjsListRencanaKontrol(db))
	r.GET("/api/bridging/surat-kontrol/detail/*no_surat", getDetailSuratKontrolBpjs(db))

	// Bridging SPRI Rawat Inap (BPJS VClaim)
	r.GET("/api/bridging/spri-ranap/list", getSpriRanapList(db))
	r.POST("/api/bridging/spri-ranap", createSpriRanap(db))
	r.PUT("/api/bridging/spri-ranap", updateSpriRanap(db))

	// Bridging Perpanjangan Rujukan Khusus (BPJS VClaim)
	r.GET("/api/bridging/rujukan-khusus/list", getRujukanKhususList(db))
	r.POST("/api/bridging/rujukan-khusus", createRujukanKhusus(db))
	r.DELETE("/api/bridging/rujukan-khusus/*no_rujukan", deleteRujukanKhusus(db))
	r.GET("/api/bridging/rujukan-khusus/bpjs-list", getBpjsListRujukanKhusus(db))

	// Bridging HFIS (BPJS)
	r.GET("/api/bridging/hfis/referensi/poli", getReferensiPoliHfis(db))
	r.GET("/api/bridging/hfis/referensi/dokter", getReferensiDokterHfis(db))
	r.GET("/api/bridging/hfis/referensi/jadwal-dokter/:kode_poli", getJadwalDokterHfis(db))
	r.POST("/api/bridging/hfis/jadwal-dokter/update", updateJadwalDokterHfis(db))
	r.GET("/api/bridging/hfis/referensi/poli-fp", getReferensiPoliFpHfis(db))
	r.GET("/api/bridging/hfis/referensi/pasien-fp", getReferensiPasienFpHfis(db))

	// Bridging Antrean RS / Mobile JKN (BPJS)
	r.GET("/api/bridging/antrean/list", getAntreanRsList(db))
	r.POST("/api/bridging/antrean", addAntreanRs(db))
	r.GET("/api/bridging/antrean-farmasi/list", getAntreanFarmasiList(db))
	r.POST("/api/bridging/antrean-farmasi", addAntreanFarmasi(db))
	r.POST("/api/bridging/antrean/update-waktu", updateWaktuAntrean(db))
	r.POST("/api/bridging/antrean/batal", batalAntrean(db))
	r.POST("/api/bridging/antrean/list-task", getListTaskAntrean(db))
	r.GET("/api/bridging/antrean/dashboard", getDashboardWaktuTunggu(db))
	r.GET("/api/bridging/antrean/dashboard-bulan", getDashboardWaktuTungguBulan(db))
	r.GET("/api/bridging/antrean/pendaftaran-tanggal", getAntreanPendaftaranTanggal(db))
	r.GET("/api/bridging/antrean/pendaftaran-booking/*kodebooking", getAntreanPendaftaranKodeBooking(db))
	r.GET("/api/bridging/antrean/pendaftaran-aktif", getAntreanPendaftaranAktif(db))
	r.GET("/api/bridging/antrean/pendaftaran-filter", getAntreanPendaftaranFilter(db))
	r.GET("/api/bridging/referensi-mobilejkn", getReferensiMobileJkn(db))
	r.GET("/api/bridging/antrean/taskid-list", getAntreanTaskIdList(db))

	// Antrean BPJS Otomatis — saklar & log tab "Antrean Otomatis"
	r.GET("/api/bridging/antrean-queue/status", getAntreanOtomatisStatus(db))
	r.PUT("/api/bridging/antrean-queue/status", setAntreanOtomatisStatus(db))
	r.GET("/api/bridging/antrean-queue", getAntreanQueueList(db))
	r.POST("/api/bridging/antrean-queue/:id/skip", skipAntreanQueueItem(db))
	r.POST("/api/bridging/antrean-queue/:id/retry", retryAntreanQueueItem(db))

	// Apotek — Data Barang
	r.GET("/api/apotek/barang/list", getDataBarangList(db))
	r.GET("/api/apotek/referensi", getApotekReferensi(db))
	r.POST("/api/apotek/barang", createDataBarang(db))
	r.PUT("/api/apotek/barang/:kode", updateDataBarang(db))
	r.DELETE("/api/apotek/barang/:kode", deleteDataBarang(db))

	// Apotek — Pengaturan Depo (Set Oto Lokasi: Lokasi, Depo Ralan, Depo Ranap)
	r.GET("/api/apotek/pengaturan/depo/opsi", getApotekPengaturanDepoOpsi(db))
	r.GET("/api/apotek/pengaturan/lokasi", getApotekLokasi(db))
	r.PUT("/api/apotek/pengaturan/lokasi", saveApotekLokasi(db))
	r.DELETE("/api/apotek/pengaturan/lokasi", deleteApotekLokasi(db))
	r.GET("/api/apotek/pengaturan/depo-ralan", getApotekDepoRalan(db))
	r.POST("/api/apotek/pengaturan/depo-ralan", createApotekDepoRalan(db))
	r.PUT("/api/apotek/pengaturan/depo-ralan", updateApotekDepoRalan(db))
	r.DELETE("/api/apotek/pengaturan/depo-ralan", deleteApotekDepoRalan(db))
	r.GET("/api/apotek/pengaturan/depo-ranap", getApotekDepoRanap(db))
	r.POST("/api/apotek/pengaturan/depo-ranap", createApotekDepoRanap(db))
	r.PUT("/api/apotek/pengaturan/depo-ranap", updateApotekDepoRanap(db))
	r.DELETE("/api/apotek/pengaturan/depo-ranap", deleteApotekDepoRanap(db))

	// Apotek — Set Harga Obat (Pengaturan Harga, Harga Umum/Per Jenis/Per Barang)
	r.GET("/api/apotek/harga-obat/pengaturan", getSetHargaObat(db))
	r.PUT("/api/apotek/harga-obat/pengaturan", saveSetHargaObat(db))
	r.DELETE("/api/apotek/harga-obat/pengaturan", deleteSetHargaObat(db))
	r.GET("/api/apotek/harga-obat/umum", getHargaUmum(db))
	r.PUT("/api/apotek/harga-obat/umum", saveHargaUmum(db))
	r.DELETE("/api/apotek/harga-obat/umum", deleteHargaUmum(db))
	r.POST("/api/apotek/harga-obat/umum/terapkan", terapkanHargaUmum(db))
	r.GET("/api/apotek/harga-obat/per-jenis", getHargaPerJenis(db))
	r.POST("/api/apotek/harga-obat/per-jenis", upsertHargaPerJenis(db))
	r.DELETE("/api/apotek/harga-obat/per-jenis/:kdjns", deleteHargaPerJenis(db))
	r.POST("/api/apotek/harga-obat/per-jenis/:kdjns/terapkan", terapkanHargaPerJenis(db))
	r.GET("/api/apotek/harga-obat/per-barang", getHargaPerBarang(db))
	r.POST("/api/apotek/harga-obat/per-barang", upsertHargaPerBarang(db))
	r.DELETE("/api/apotek/harga-obat/per-barang/:kode", deleteHargaPerBarang(db))
	r.POST("/api/apotek/harga-obat/per-barang/:kode/terapkan", terapkanHargaPerBarang(db))

	// Apotek — Set Harga Obat Ralan (persentase markup per cara bayar, rawat jalan)
	r.GET("/api/apotek/harga-obat-ralan/penjab-opsi", getHargaObatRalanPenjabOpsi(db))
	r.GET("/api/apotek/harga-obat-ralan", getHargaObatRalan(db))
	r.POST("/api/apotek/harga-obat-ralan", upsertHargaObatRalan(db))
	r.DELETE("/api/apotek/harga-obat-ralan/:kdpj", deleteHargaObatRalan(db))

	// Apotek — Set Harga Obat Ranap (persentase markup per cara bayar x kelas kamar, rawat inap)
	r.GET("/api/apotek/harga-obat-ranap/kelas-opsi", getHargaObatRanapKelasOpsi)
	r.GET("/api/apotek/harga-obat-ranap", getHargaObatRanap(db))
	r.POST("/api/apotek/harga-obat-ranap", upsertHargaObatRanap(db))
	r.DELETE("/api/apotek/harga-obat-ranap", deleteHargaObatRanap(db))

	// Apotek — Set Embalase dan Tuslah
	r.GET("/api/apotek/embalase-tuslah", getSetEmbalase(db))
	r.PUT("/api/apotek/embalase-tuslah", saveSetEmbalase(db))
	r.DELETE("/api/apotek/embalase-tuslah", deleteSetEmbalase(db))

	// Pengaturan — Set Penggunaan Tarif (set_tarif)
	r.GET("/api/pengaturan/tarif", getSetTarif(db))
	r.PUT("/api/pengaturan/tarif", saveSetTarif(db))

	// Apotek — Industri Farmasi (master data pabrik/distributor obat)
	r.GET("/api/apotek/industri-farmasi", getIndustriFarmasiList(db))
	r.POST("/api/apotek/industri-farmasi", createIndustriFarmasi(db))
	r.PUT("/api/apotek/industri-farmasi/:kode", updateIndustriFarmasi(db))
	r.DELETE("/api/apotek/industri-farmasi/:kode", deleteIndustriFarmasi(db))

	// Apotek — Suplier Obat/Alkes/BHP
	r.GET("/api/apotek/suplier", getSuplierList(db))
	r.POST("/api/apotek/suplier", createSuplier(db))
	r.PUT("/api/apotek/suplier/:kode", updateSuplier(db))
	r.DELETE("/api/apotek/suplier/:kode", deleteSuplier(db))

	// Apotek — Satuan Barang
	r.GET("/api/apotek/satuan-barang", getSatuanBarangList(db))
	r.POST("/api/apotek/satuan-barang", createSatuanBarang(db))
	r.PUT("/api/apotek/satuan-barang/:kode", updateSatuanBarang(db))
	r.DELETE("/api/apotek/satuan-barang/:kode", deleteSatuanBarang(db))

	// Apotek — Metode Racik
	r.GET("/api/apotek/metode-racik", getMetodeRacikList(db))
	r.POST("/api/apotek/metode-racik", createMetodeRacik(db))
	r.PUT("/api/apotek/metode-racik/:kode", updateMetodeRacik(db))
	r.DELETE("/api/apotek/metode-racik/:kode", deleteMetodeRacik(db))

	// Apotek — Konversi Satuan
	r.GET("/api/apotek/konversi-satuan", getKonversiSatuanList(db))
	r.POST("/api/apotek/konversi-satuan", upsertKonversiSatuan(db))
	r.DELETE("/api/apotek/konversi-satuan", deleteKonversiSatuan(db))

	// Apotek — Jenis Obat/Alkes/BHP
	r.GET("/api/apotek/jenis", getJenisList(db))
	r.POST("/api/apotek/jenis", createJenis(db))
	r.PUT("/api/apotek/jenis/:kode", updateJenis(db))
	r.DELETE("/api/apotek/jenis/:kode", deleteJenis(db))

	// Apotek — Kategori Obat/Alkes/BHP
	r.GET("/api/apotek/kategori", getKategoriList(db))
	r.POST("/api/apotek/kategori", createKategori(db))
	r.PUT("/api/apotek/kategori/:kode", updateKategori(db))
	r.DELETE("/api/apotek/kategori/:kode", deleteKategori(db))

	// Apotek — Golongan Obat/Alkes/BHP
	r.GET("/api/apotek/golongan", getGolonganList(db))
	r.POST("/api/apotek/golongan", createGolongan(db))
	r.PUT("/api/apotek/golongan/:kode", updateGolongan(db))
	r.DELETE("/api/apotek/golongan/:kode", deleteGolongan(db))

	// Apotek — Stok Opname
	r.GET("/api/apotek/stok-opname/items", getStokOpnameItems(db))
	r.POST("/api/apotek/stok-opname", submitStokOpname(db))
	r.GET("/api/apotek/stok-opname/riwayat", getStokOpnameRiwayat(db))
	r.DELETE("/api/apotek/stok-opname", deleteStokOpnameRiwayat(db))
	r.GET("/api/apotek/stok-opname/bulan-ini", getStokOpnameBulanIni(db))

	// Apotek — Mutasi Obat & BHP
	r.GET("/api/apotek/mutasi/items", getMutasiItems(db))
	r.POST("/api/apotek/mutasi", submitMutasi(db))
	r.GET("/api/apotek/mutasi/riwayat", getMutasiRiwayat(db))
	r.DELETE("/api/apotek/mutasi", deleteMutasiRiwayat(db))
	r.GET("/api/apotek/mutasi/hari-ini", getMutasiHariIni(db))

	// Apotek — Permintaan Obat & BHP
	r.GET("/api/apotek/permintaan/barang-opsi", getPermintaanBarangOpsi(db))
	r.GET("/api/apotek/permintaan/pegawai-opsi", getPermintaanPegawaiOpsi(db))
	r.POST("/api/apotek/permintaan", submitPermintaan(db))
	r.GET("/api/apotek/permintaan/riwayat", getPermintaanRiwayat(db))
	r.PUT("/api/apotek/permintaan/:no_permintaan/status", updatePermintaanStatus(db))
	r.POST("/api/apotek/permintaan/:no_permintaan/setujui", setujuiPermintaan(db))
	r.DELETE("/api/apotek/permintaan/:no_permintaan", deletePermintaan(db))

	// Apotek — Penerimaan Obat & BHP
	r.GET("/api/apotek/penerimaan/barang-opsi", getPenerimaanBarangOpsi(db))
	r.GET("/api/apotek/penerimaan/next-faktur", getPenerimaanNextFaktur(db))
	r.POST("/api/apotek/penerimaan", submitPenerimaan(db))
	r.GET("/api/apotek/penerimaan/riwayat", getPenerimaanRiwayat(db))
	r.DELETE("/api/apotek/penerimaan/:no_faktur", deletePenerimaan(db))
	r.GET("/api/apotek/penerimaan/hari-ini", getPenerimaanHariIni(db))

	// Apotek — Pemesanan (Surat Pemesanan ke Supplier)
	r.GET("/api/apotek/pemesanan/barang-opsi", getPemesananBarangOpsi(db))
	r.GET("/api/apotek/pemesanan/industri-opsi", getPemesananIndustriOpsi(db))
	r.GET("/api/apotek/pemesanan/next-no", getPemesananNextNo(db))
	r.POST("/api/apotek/pemesanan", submitPemesanan(db))
	r.GET("/api/apotek/pemesanan/riwayat", getPemesananRiwayat(db))
	r.PUT("/api/apotek/pemesanan/:no_pemesanan/status", updateStatusPemesanan(db))
	r.DELETE("/api/apotek/pemesanan/:no_pemesanan", deletePemesanan(db))

	// Apotek — Penggunaan Obat
	r.GET("/api/apotek/penggunaan-obat", getPenggunaanObat(db))

	// Input Penjualan Obat & BHP
	r.GET("/api/apotek/penjualan/barang-opsi", getPenjualanBarangOpsi(db))
	r.GET("/api/apotek/penjualan/akun-bayar-opsi", getAkunBayarOpsi(db))
	r.GET("/api/apotek/penjualan/next-nota", getNextNotaJual(db))
	r.POST("/api/apotek/penjualan", submitPenjualan(db))
	r.GET("/api/apotek/penjualan/riwayat", getPenjualanRiwayat(db))
	r.DELETE("/api/apotek/penjualan/:nota_jual", deletePenjualan(db))
	r.GET("/api/apotek/penjualan/hari-ini", getPenjualanHariIni(db))

	// Apotek — Riwayat Obat, Alkes & BHP
	r.GET("/api/apotek/riwayat-barang-medis", getRiwayatBarangMedis(db))

	// Apotek — Retur ke Suplier
	r.GET("/api/apotek/retur-beli/barang-opsi", getReturBeliBarangOpsi(db))
	r.POST("/api/apotek/retur-beli", submitReturBeli(db))
	r.GET("/api/apotek/retur-beli/riwayat", getReturBeliRiwayat(db))
	r.DELETE("/api/apotek/retur-beli/:no_retur_beli", deleteReturBeli(db))

	// Apotek — Retur dari Pembeli
	r.GET("/api/apotek/retur-jual/nota-opsi", getReturJualNotaOpsi(db))
	r.GET("/api/apotek/retur-jual/nota/:nota_jual/items", getReturJualNotaItems(db))
	r.POST("/api/apotek/retur-jual", submitReturJual(db))
	r.GET("/api/apotek/retur-jual/riwayat", getReturJualRiwayat(db))
	r.DELETE("/api/apotek/retur-jual/:no_retur_jual", deleteReturJual(db))

	// Apotek — Darurat Stok
	r.GET("/api/apotek/darurat-stok", getDaruratStok(db))
	r.PUT("/api/apotek/darurat-stok/:kode_brng/stok-minimal", updateStokMinimal(db))
	r.GET("/api/apotek/lama-pelayanan", getApotekLamaPelayanan(db))
	r.GET("/api/apotek/detail-pemberian-obat", getApotekDetailPemberianObat(db))
	r.GET("/api/apotek/detail-pemberian-obat/items", getApotekDetailPemberianObatItems(db))

	// Apotek — Obat Kadaluarsa
	r.GET("/api/apotek/obat-kadaluarsa", getObatKadaluarsa(db))

	// Permintaan Resep — Dashboard (Resep Ralan)
	r.GET("/api/permintaan-resep/ralan", getPermintaanResepRalan(db))
	r.GET("/api/permintaan-resep/ralan/:no_resep/items", getPermintaanResepRalanItems(db))
	r.POST("/api/permintaan-resep/ralan/:no_resep/validasi", submitPermintaanResepValidasi(db))
	r.POST("/api/permintaan-resep/penyerahan", submitPenyerahanResep(db))
	r.GET("/api/permintaan-resep/telaah/:no_resep", getTelaahFarmasi(db))
	r.POST("/api/permintaan-resep/telaah", saveTelaahFarmasi(db))
	r.GET("/api/permintaan-resep/konseling", getKonselingFarmasi(db))
	r.POST("/api/permintaan-resep/konseling", saveKonselingFarmasi(db))
	r.GET("/api/permintaan-resep/informasi-obat", getInformasiObatList(db))
	r.POST("/api/permintaan-resep/informasi-obat", createInformasiObat(db))
	r.POST("/api/permintaan-resep/informasi-obat/jawaban", saveJawabanPio(db))
	r.DELETE("/api/permintaan-resep/informasi-obat/:no_permintaan", deleteInformasiObat(db))

	// Permintaan Resep — Dashboard Rawat Inap (Resep Ranap, Stok Pasien, Resep Pulang)
	r.GET("/api/permintaan-resep/ranap", getPermintaanResepRanap(db))
	r.GET("/api/permintaan-resep/ranap/:no_resep/items", getPermintaanResepRanapItems(db))
	r.POST("/api/permintaan-resep/ranap/:no_resep/validasi", submitPermintaanResepValidasiRanap(db))
	r.GET("/api/permintaan-resep/ranap-stok-pasien", getPermintaanStokPasienRanap(db))
	r.GET("/api/permintaan-resep/ranap-stok-pasien/:no_permintaan/items", getPermintaanStokPasienItems(db))
	r.GET("/api/permintaan-resep/ranap-resep-pulang", getPermintaanResepPulangRanap(db))
	r.GET("/api/permintaan-resep/ranap-resep-pulang/:no_permintaan/items", getPermintaanResepPulangRanapItems(db))

	// Registrasi List endpoint
	r.GET("/api/registrasi/list", getRegistrasiList(db))
	r.DELETE("/api/registrasi/*no_rawat", deleteRegistrasi(db))

	// Satu Sehat endpoints
	r.GET("/api/satu-sehat/config", getConfigSatuSehat(db))
	r.POST("/api/satu-sehat/config", saveConfigSatuSehat(db))
	r.POST("/api/satu-sehat/test-connection", testConnectionSatuSehat(db))
	r.GET("/api/satu-sehat/patient", searchPatientSatuSehat(db))
	r.GET("/api/satu-sehat/imaging-study", getImagingStudyList(db))
	r.POST("/api/satu-sehat/imaging-study/send/*noorder", sendImagingStudy(db))
	r.GET("/api/satu-sehat/mapping/radiologi", getMappingRadiologi(db))
	r.PUT("/api/satu-sehat/mapping/radiologi/:kd_jenis_prw", updateMappingRadiologi(db))
	r.POST("/api/satu-sehat/mapping/import-khanza", importMappingFromKhanza(db))
	r.POST("/api/satu-sehat/servicerequest-radiologi/send/*noorder", sendServiceRequestRadiologi(db))
	r.GET("/api/satu-sehat/servicerequest-radiologi/*noorder", getServiceRequestRadiologi(db))
	r.POST("/api/satu-sehat/mwl/send/*noorder", sendToMWL(db))
	r.DELETE("/api/satu-sehat/mwl/*noorder", deleteMWLEntry(db))
	r.GET("/api/satu-sehat/mwl/status/*noorder", getMWLStatus(db))
	r.GET("/api/satu-sehat/dicom/studies/*noorder", getDicomStudies(db))
	r.POST("/api/satu-sehat/dicom/send/*noorder", sendDicomToSatuSehat(db))
	r.POST("/api/satu-sehat/dicom/register-router", registerDicomRouterToOrthanc(db))
	r.GET("/api/satu-sehat/monitoring/radiologi", getMonitoringRadiologi(db))

	// Mapping Satu Sehat
	r.GET("/api/mapping/radiologi", getMappingRadiologiSatuSehat(db))
	r.PUT("/api/mapping/radiologi/:kd_jenis_prw", saveMappingRadiologiSatuSehat(db))
	r.DELETE("/api/mapping/radiologi/:kd_jenis_prw", deleteMappingRadiologiSatuSehat(db))
	r.GET("/api/mapping/loinc/search", searchLoinc(db))
	r.GET("/api/mapping/loinc/config", getLoincConfig(db))
	r.POST("/api/mapping/loinc/config", saveLoincConfig(db))

	// Pengaturan BPJS — Mapping Poli VCLAIM & Mapping Dokter DPJP VCLAIM
	// (padanan BPJSMapingPoli.java & BPJSMapingDokterDPJP.java di SIMRS
	// Khanza Desktop, tabel maping_poli_bpjs & maping_dokter_dpjpvclaim
	// sudah ada di skema Khanza).
	r.GET("/api/bpjs/mapping-poli", getMappingPoliBpjs(db))
	r.PUT("/api/bpjs/mapping-poli/:kd_poli", saveMappingPoliBpjs(db))
	r.DELETE("/api/bpjs/mapping-poli/:kd_poli", deleteMappingPoliBpjs(db))
	r.GET("/api/bpjs/mapping-dokter", getMappingDokterBpjs(db))
	r.PUT("/api/bpjs/mapping-dokter/:kd_dokter", saveMappingDokterBpjs(db))
	r.DELETE("/api/bpjs/mapping-dokter/:kd_dokter", deleteMappingDokterBpjs(db))

	// Generate Nomor Registrasi endpoints
	r.POST("/api/registrasi/generate-noreg", generateNoReg(db))
	r.POST("/api/registrasi/generate-norawat", generateNoRawat(db))

	// Pemberian Obat endpoint
	r.GET("/api/obat-data/*no_rawat", getObat(db))

	// Resep Pulang endpoint
	r.GET("/api/resep-pulang/*no_rawat", getResepPulang(db))

	// Biaya endpoint
	r.GET("/api/biaya/*no_rawat", getBiaya(db))

	// Billing Preview endpoint
	r.GET("/api/billing-preview/*no_rawat", getBillingPreview(db))
	r.GET("/api/detail-pemberian-obat/*no_rawat", getDetailPemberianObat(db))
	r.GET("/api/detail-periksa-lab/*no_rawat", getDetailPeriksaLab(db))

	// Resume Perawatan endpoints
	r.GET("/api/resume/*no_rawat", getResume(db))
	r.POST("/api/resume-ranap", saveResumeRanap(db))
	r.PUT("/api/resume-ranap", saveResumeRanap(db))
	r.DELETE("/api/resume-ranap", deleteResumeRanap(db))

	// === Resep Ranap Endpoints ===
	r.GET("/api/resep-ranap/obat", searchObatRanap(db))
	r.GET("/api/resep-ranap/aturan-pakai", getAturanPakai(db))
	r.GET("/api/resep-ranap/list", getResepRanap(db))
	r.POST("/api/resep-ranap", saveResepRanap(db))
	r.DELETE("/api/resep-ranap", deleteResepRanap(db))

	// === Resep Pulang (permintaan dokter ke apotek) ===
	r.GET("/api/resep-pulang-req/list", getResepPulangReq(db))
	r.POST("/api/resep-pulang-req", saveResepPulangReq(db))
	r.PUT("/api/resep-pulang-req", updateResepPulangReq(db))
	r.DELETE("/api/resep-pulang-req", deleteResepPulangReq(db))

	// === Antrian Poli Endpoints ===
	// Display endpoints (no auth required, untuk TV display)
	r.GET("/api/antrian/poli/:kd_poli/display", getAntrianPoliDisplay(db))
	r.GET("/api/antrian/poli/all-display", getAllPoliAntrianDisplay(db))

	// Panel petugas endpoints
	r.GET("/api/antrian/poli/:kd_poli/waiting", getWaitingAntrian(db))
	r.POST("/api/antrian/poli/call-next", callNextAntrian(db))
	r.POST("/api/antrian/poli/call-patient", callSpecificPatient(db)) // Dokter klik no antrian
	r.PUT("/api/antrian/poli/:id/status", updateAntrianStatus(db))

	// Generate antrian dari registrasi (untuk testing/reset harian)
	r.POST("/api/antrian/poli/generate-from-registrasi", generateAntrianFromRegistrasi(db))

	// === Antrian Apotek Endpoints ===
	// Display endpoint untuk TV display apotek
	r.GET("/api/antrian/apotek/display", getAntrianApotekDisplay(db))

	// Panel petugas apotek endpoints
	r.POST("/api/antrian/apotek/call-patient", callPatientApotek(db))
	r.PUT("/api/antrian/apotek/:id/status", updateAntrianApotekStatus(db))

	// === Display Settings Endpoints ===
	r.GET("/api/settings/display", getDisplaySettings(db))
	r.PUT("/api/settings/display", updateDisplaySettings(db))

	// === File Upload Endpoints ===
	r.POST("/api/upload", uploadFile)
	r.DELETE("/api/upload/:filename", deleteUploadedFile)

	addr := getEnv("APP_ADDR", ":8080")
	log.Printf("Server berjalan di %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("gagal menjalankan server: %v", err)
	}
}
