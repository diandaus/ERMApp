package main

import (
	"database/sql"
	"net/http"
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
	SudahTerdaftar bool   `json:"sudah_terdaftar"`
}

// GET /api/auth/cari-pegawai?q=<NIP atau No. HP> — dipanggil dari
// halaman pendaftaran akun mandiri. Cocokkan PERSIS (bukan LIKE) ke
// petugas.nip ATAU petugas.no_telp — NIP/No.HP dipakai sbg identitas
// unik pencarian di sini, beda dari pencarian bebas di /api/petugas/list.
func cariPegawaiRegistrasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIP atau No. HP wajib diisi"})
			return
		}

		var result CariPegawaiRegistrasiResult
		err := db.QueryRow(
			`SELECT petugas.nip, petugas.nama
			 FROM petugas
			 WHERE petugas.status = '1' AND (petugas.nip = ? OR petugas.no_telp = ?)
			 LIMIT 1`,
			q, q,
		).Scan(&result.NIP, &result.Nama)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Data pegawai tidak ditemukan. Periksa kembali NIP atau No. HP, atau hubungi bagian Umum/Kepegawaian."})
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

// POST /api/auth/register — bikin akun app_users mandiri buat pegawai,
// dipicu dari halaman "Daftar" di LoginView. NIP divalidasi ULANG ke
// tabel petugas di sini (bukan cuma percaya hasil cariPegawaiRegistrasi
// sebelumnya di sisi client) supaya tidak bisa didaftarkan pakai NIP
// sembarangan lewat panggilan API langsung. Akun langsung aktif
// (is_active=1) tapi allowed_modules dikunci HANYA ke modul Kepegawaian
// (Presensi Mandiri, Cuti/Izin, dst) — bukan modul RM pasien/billing/dll
// — supaya pendaftaran mandiri tidak otomatis kebuka akses ke data
// medis/keuangan RS. Username = NIP (staf sudah pasti hafal NIP sendiri,
// tidak perlu field username terpisah di form pendaftaran).
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
		err := db.QueryRow(`SELECT nama FROM petugas WHERE nip = ? AND status = '1' LIMIT 1`, nip).Scan(&nama)
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

		hash := hashPassword(req.Password)
		_, err = db.Exec(
			`INSERT INTO app_users (username, password_hash, full_name, role, is_active, allowed_modules, nip, departemen)
			 VALUES (?, ?, ?, 'pegawai', 1, 'menu-utama,kepegawaian', ?, ?)`,
			nip, hash, nama, nip, departemen,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Pendaftaran berhasil, silakan masuk", "username": nip})
	}
}
