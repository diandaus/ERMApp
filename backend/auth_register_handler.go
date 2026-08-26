package main

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// CariPegawaiRegistrasiResult — hasil pencarian identitas pegawai lewat
// NIP atau No. HP, dipakai di halaman "Daftar" (LoginView > RegisterView)
// supaya calon user tinggal konfirmasi data dirinya sebelum bikin akun,
// bukan ketik semua data dari nol.
type CariPegawaiRegistrasiResult struct {
	NIP            string `json:"nip"`
	Nama           string `json:"nama"`
	Departemen     string `json:"departemen"`
	SudahTerdaftar bool   `json:"sudah_terdaftar"`
}

// GET /api/auth/cari-pegawai?q=<NIP atau NIK KTP> — dipanggil dari
// halaman pendaftaran akun mandiri. Cocokkan PERSIS (bukan LIKE) langsung
// ke pegawai.nik ATAU pegawai.no_ktp — SENGAJA baca dari `pegawai`
// langsung (bukan JOIN dari `petugas` spt sebelumnya) krn ada pegawai yg
// memang tidak dimasukkan ke tabel `petugas` (mis. belum dibuatkan akses
// aplikasi Khanza) tapi tetap perlu bisa daftar akun Presensi Mandiri.
// pegawai.nik adalah identitas master (petugas.nip & dokter.kd_dokter
// sama2 FK ke pegawai.nik), jadi baca langsung dari sini justru lebih
// lengkap, bukan kurang akurat. Hanya status AKTIF/CUTI yg boleh daftar —
// KELUAR/TENAGA LUAR/NON AKTIF diblokir.
func cariPegawaiRegistrasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIP atau NIK KTP wajib diisi"})
			return
		}

		var result CariPegawaiRegistrasiResult
		err := db.QueryRow(
			`SELECT nik, nama, COALESCE(departemen, '')
			 FROM pegawai
			 WHERE stts_aktif IN ('AKTIF', 'CUTI') AND (nik = ? OR no_ktp = ?)
			 LIMIT 1`,
			q, q,
		).Scan(&result.NIP, &result.Nama, &result.Departemen)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Data pegawai tidak ditemukan. Periksa kembali NIP atau NIK KTP, atau hubungi bagian Umum/Kepegawaian."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var existingCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM app_users WHERE nip = ?`, result.NIP).Scan(&existingCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		result.SudahTerdaftar = existingCount > 0

		c.JSON(http.StatusOK, result)
	}
}

type RegisterRequest struct {
	NIP        string `json:"nip" binding:"required"`
	Departemen string `json:"departemen" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

// ensureDepartemenRoleTable — tabel OVERRIDE kode departemen (sama dgn
// departemen.dep_id) -> role app_users, dipakai roleFromDepartemen saat
// pendaftaran akun mandiri. Cuma menyimpan pengecualian yg role-nya HARUS
// tetap nama baku yg sudah dipakai fitur lain di aplikasi (DG/DS =
// "dokter" — biar dapat gating kd_dokter di Daftar Pasien Poli dkk; REG =
// "pendaftaran"; FARM = "farmasi") — bukan daftar semua departemen.
// Departemen LAIN yg tidak ada di sini otomatis dapat role sendiri
// diturunkan dari NAMA departemen (lihat roleFromDepartemen), jadi
// departemen baru yg nanti ditambah admin lewat Khanza otomatis kebagian
// role sendiri juga tanpa perlu update kode/tabel ini secara manual.
func ensureDepartemenRoleTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS departemen_role (
			kode VARCHAR(10) NOT NULL PRIMARY KEY,
			role VARCHAR(50) NOT NULL DEFAULT 'pegawai'
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	if _, err := db.Exec(createTable); err != nil {
		return err
	}

	override := map[string]string{
		"DG":   "dokter",
		"DS":   "dokter",
		"FARM": "farmasi",
		"REG":  "pendaftaran",
	}
	for kode, role := range override {
		if _, err := db.Exec(`INSERT IGNORE INTO departemen_role (kode, role) VALUES (?, ?)`, kode, role); err != nil {
			return err
		}
	}
	return nil
}

// slugRoleRe — dipakai slugifyRole ubah nama departemen jadi role
// (lowercase, spasi/tanda baca jadi underscore tunggal).
var slugRoleRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugifyRole(nama string) string {
	slug := strings.Trim(slugRoleRe.ReplaceAllString(strings.ToLower(strings.TrimSpace(nama)), "_"), "_")
	if slug == "" {
		return "pegawai"
	}
	return slug
}

// roleFromDepartemen — 1) cek override eksplisit di departemen_role dulu
// (dokter/farmasi/pendaftaran — role yg PUNYA arti fungsional di aplikasi,
// lihat komentar ensureDepartemenRoleTable); 2) kalau tidak ada override,
// role diturunkan OTOMATIS dari `departemen.nama` (tabel master Khanza yg
// sudah ada, mis. "RADIOLOGI" -> role "radiologi", "REKAM MEDIS" -> role
// "rekam_medis") — jadi tiap departemen baru otomatis kebagian role
// sendiri, admin tidak perlu tambah role manual tiap ada departemen baru;
// 3) fallback 'pegawai' kalau kode departemennya sama sekali tidak
// dikenal (tidak ada di tabel departemen).
func roleFromDepartemen(db *sql.DB, kodeDepartemen string) string {
	kode := strings.ToUpper(strings.TrimSpace(kodeDepartemen))
	if kode == "" {
		return "pegawai"
	}

	var override string
	if err := db.QueryRow(`SELECT role FROM departemen_role WHERE kode = ?`, kode).Scan(&override); err == nil && override != "" {
		return override
	}

	var nama string
	if err := db.QueryRow(`SELECT nama FROM departemen WHERE dep_id = ?`, kode).Scan(&nama); err != nil || nama == "" {
		return "pegawai"
	}
	return slugifyRole(nama)
}

// POST /api/auth/register — bikin akun app_users mandiri buat pegawai,
// dipicu dari halaman "Daftar" di LoginView. NIP divalidasi ULANG ke
// tabel pegawai di sini (bukan cuma percaya hasil cariPegawaiRegistrasi
// sebelumnya di sisi client) supaya tidak bisa didaftarkan pakai NIP
// sembarangan lewat panggilan API langsung. Akun langsung aktif
// (is_active=1), role diturunkan dari departemen yg dipilih (lihat
// roleFromDepartemen di atas, default 'pegawai' kalau tidak dipetakan),
// tapi allowed_modules TETAP dikunci HANYA ke modul Kepegawaian (Presensi
// Mandiri, Cuti/Izin, dst) — bukan modul RM pasien/billing/dll — supaya
// pendaftaran mandiri tidak otomatis kebuka akses ke data medis/keuangan
// RS TERLEPAS dari role apa yg didapat (role di sini cuma menentukan
// label/gating ringan spt kd_dokter linking, bukan buka allowed_modules
// baru). Username = NIP (staf sudah pasti hafal NIP sendiri, tidak perlu
// field username terpisah di form pendaftaran).
func registerAkunMandiri(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data pendaftaran tidak lengkap"})
			return
		}
		nip := strings.TrimSpace(req.NIP)
		departemen := strings.TrimSpace(req.Departemen)
		if len(req.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kata sandi minimal 6 karakter"})
			return
		}

		var nama string
		err := db.QueryRow(`SELECT nama FROM pegawai WHERE nik = ? AND stts_aktif IN ('AKTIF', 'CUTI') LIMIT 1`, nip).Scan(&nama)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{"error": "NIP pegawai tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var existingCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM app_users WHERE nip = ? OR username = ?`, nip, nip).Scan(&existingCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if existingCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "NIP ini sudah terdaftar. Silakan masuk, atau hubungi admin kalau lupa kata sandi."})
			return
		}

		role := roleFromDepartemen(db, departemen)

		hash := hashPassword(req.Password)
		_, err = db.Exec(
			`INSERT INTO app_users (username, password_hash, full_name, role, is_active, allowed_modules, nip, departemen, akun_mandiri)
			 VALUES (?, ?, ?, ?, 1, 'menu-utama,kepegawaian', ?, ?, 1)`,
			nip, hash, nama, role, nip, departemen,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Pendaftaran berhasil, silakan masuk", "username": nip})
	}
}
