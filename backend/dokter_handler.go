package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Dokter, padanan kepegawaian/DlgDokter.java (Khanza).
// dokter.kd_dokter punya FK ke pegawai.nik (sama persis pola petugas.nip
// -> pegawai.nik) — jadi Tambah Dokter mengharuskan pilih pegawai yang
// SUDAH ADA lewat ModalCariPegawai, bukan bikin pegawai dummy baru
// seperti Java (yang insert-ignore ke pegawai dgn data "-").
//
// PENTING: tabel `dokter` TIDAK PERNAH BOLEH ditambah kolom baru.
// DlgDokter.java menyimpan lewat Sequel.menyimpan2("dokter",
// "'...','...',...", "Kode Dokter"), yang membangun SQL
// "insert into dokter values (?,?,...)" TANPA daftar nama kolom (fully
// positional, 15 nilai persis = 15 kolom tabel saat ini) — pelajaran
// yang sama dengan petugas/petugas_ext (lihat backend/petugas_handler.go).
// Untungnya tabel `dokter` yang ada SUDAH punya semua 14 kolom form
// DlgDokter.java + status, jadi tidak perlu tabel pendamping sama sekali
// untuk fitur ini.
//
// Khanza juga punya dialog restore resmi (DlgRestoreDokter.java, menu
// "Data Sampah" di DlgDokter.java) — restore cuma UPDATE status='1',
// TIDAK menyentuh pegawai.stts_aktif lagi (beda dari Hapus, lihat
// hapusDokter). Hapus Permanen TIDAK ada di Java, tapi ditambahkan di
// sini konsisten dengan fitur Petugas — dokter.kd_dokter direferensikan
// puluhan tabel transaksi lain, jadi hampir selalu akan ditolak FK
// constraint kalau dokternya pernah dipakai (itu perilaku yang benar).
// ============================================================================

type DokterDetail struct {
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	JK           string `json:"jk"`
	TmpLahir     string `json:"tmp_lahir"`
	TglLahir     string `json:"tgl_lahir"`
	GolDrh       string `json:"gol_drh"`
	Agama        string `json:"agama"`
	AlmtTgl      string `json:"almt_tgl"`
	NoTelp       string `json:"no_telp"`
	Email        string `json:"email"`
	SttsNikah    string `json:"stts_nikah"`
	KdSps        string `json:"kd_sps"`
	NmSps        string `json:"nm_sps"`
	Alumni       string `json:"alumni"`
	NoIjnPraktek string `json:"no_ijn_praktek"`
}

// GET /api/dokter/list — padanan tampil()/prosesCari() di DlgDokter.java,
// join ke spesialis utk nama spesialis. Parameter `status` (default '1')
// dan restore/hapus-permanen adalah tambahan ERMApp — lihat komentar di
// atas.
func getDokterList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.DefaultQuery("status", "1"))
		jk := strings.TrimSpace(c.DefaultQuery("jk", ""))
		golDrh := strings.TrimSpace(c.DefaultQuery("gol_drh", ""))
		sttsNikah := strings.TrimSpace(c.DefaultQuery("stts_nikah", ""))
		search := strings.TrimSpace(c.DefaultQuery("search", ""))

		query := `
			SELECT
				dokter.kd_dokter, dokter.nm_dokter, COALESCE(dokter.jk,'') AS jk,
				COALESCE(dokter.tmp_lahir,'') AS tmp_lahir,
				COALESCE(DATE_FORMAT(dokter.tgl_lahir,'%Y-%m-%d'),'') AS tgl_lahir,
				COALESCE(dokter.gol_drh,'') AS gol_drh,
				COALESCE(dokter.agama,'') AS agama,
				COALESCE(dokter.almt_tgl,'') AS almt_tgl,
				COALESCE(dokter.no_telp,'') AS no_telp,
				COALESCE(dokter.email,'') AS email,
				COALESCE(dokter.stts_nikah,'') AS stts_nikah,
				COALESCE(dokter.kd_sps,'') AS kd_sps,
				COALESCE(spesialis.nm_sps,'') AS nm_sps,
				COALESCE(dokter.alumni,'') AS alumni,
				COALESCE(dokter.no_ijn_praktek,'') AS no_ijn_praktek
			FROM dokter
			LEFT JOIN spesialis ON spesialis.kd_sps = dokter.kd_sps
			WHERE dokter.status = ?`

		args := []interface{}{status}

		if jk != "" {
			query += " AND dokter.jk = ?"
			args = append(args, jk)
		}
		if golDrh != "" {
			query += " AND dokter.gol_drh = ?"
			args = append(args, golDrh)
		}
		if sttsNikah != "" {
			query += " AND dokter.stts_nikah = ?"
			args = append(args, sttsNikah)
		}
		if search != "" {
			query += ` AND (dokter.kd_dokter LIKE ? OR dokter.nm_dokter LIKE ? OR dokter.tmp_lahir LIKE ?
				OR dokter.almt_tgl LIKE ? OR dokter.agama LIKE ? OR spesialis.nm_sps LIKE ? OR dokter.no_ijn_praktek LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like, like, like, like, like, like)
		}

		query += " ORDER BY dokter.kd_dokter"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []DokterDetail{}
		for rows.Next() {
			var d DokterDetail
			if err := rows.Scan(
				&d.KdDokter, &d.NmDokter, &d.JK, &d.TmpLahir, &d.TglLahir,
				&d.GolDrh, &d.Agama, &d.AlmtTgl, &d.NoTelp, &d.Email,
				&d.SttsNikah, &d.KdSps, &d.NmSps, &d.Alumni, &d.NoIjnPraktek,
			); err != nil {
				continue
			}
			list = append(list, d)
		}
		c.JSON(http.StatusOK, list)
	}
}

type SpesialisOpsi struct {
	KdSps string `json:"kd_sps"`
	NmSps string `json:"nm_sps"`
}

// GET /api/spesialis/opsi — dropdown pemilihan spesialis di form Dokter.
func getSpesialisOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT kd_sps, nm_sps FROM spesialis ORDER BY nm_sps`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []SpesialisOpsi{}
		for rows.Next() {
			var s SpesialisOpsi
			if err := rows.Scan(&s.KdSps, &s.NmSps); err != nil {
				continue
			}
			list = append(list, s)
		}
		c.JSON(http.StatusOK, list)
	}
}

type DokterPayload struct {
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	JK           string `json:"jk"`
	TmpLahir     string `json:"tmp_lahir"`
	TglLahir     string `json:"tgl_lahir"`
	GolDrh       string `json:"gol_drh"`
	Agama        string `json:"agama"`
	AlmtTgl      string `json:"almt_tgl"`
	NoTelp       string `json:"no_telp"`
	Email        string `json:"email"`
	SttsNikah    string `json:"stts_nikah"`
	KdSps        string `json:"kd_sps"`
	Alumni       string `json:"alumni"`
	NoIjnPraktek string `json:"no_ijn_praktek"`
}

// POST /api/dokter — tambah dokter baru. kd_dokter wajib sudah terdaftar
// sebagai pegawai (dokter.kd_dokter -> pegawai.nik FK) — dipilih lewat
// ModalCariPegawai yang sudah ada, beda dari Java yang insert-ignore ke
// pegawai dgn data dummy "-".
func tambahDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p DokterPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.KdDokter == "" || p.NmDokter == "" || p.KdSps == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Dokter, nama, dan spesialis wajib diisi"})
			return
		}
		_, err := db.Exec(`
			INSERT INTO dokter (kd_dokter, nm_dokter, jk, tmp_lahir, tgl_lahir, gol_drh, agama, almt_tgl, no_telp, email, stts_nikah, kd_sps, alumni, no_ijn_praktek, status)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
			p.KdDokter, p.NmDokter, p.JK, p.TmpLahir, nullableDate(p.TglLahir), p.GolDrh, p.Agama, p.AlmtTgl, p.NoTelp, p.Email, p.SttsNikah, p.KdSps, p.Alumni, p.NoIjnPraktek,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Kode Dokter sudah terdaftar"})
				return
			}
			if strings.Contains(strings.ToLower(err.Error()), "foreign key constraint") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Dokter tidak ditemukan pada data Pegawai — pilih pegawai terlebih dahulu"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Dokter berhasil ditambahkan"})
	}
}

func editDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		if kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_dokter wajib diisi"})
			return
		}
		var p DokterPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.NmDokter == "" || p.KdSps == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nama dan spesialis wajib diisi"})
			return
		}
		_, err := db.Exec(`
			UPDATE dokter SET
				nm_dokter=?, jk=?, tmp_lahir=?, tgl_lahir=?, gol_drh=?, agama=?, almt_tgl=?, no_telp=?, email=?, stts_nikah=?, kd_sps=?, alumni=?, no_ijn_praktek=?
			WHERE kd_dokter=?`,
			p.NmDokter, p.JK, p.TmpLahir, nullableDate(p.TglLahir), p.GolDrh, p.Agama, p.AlmtTgl, p.NoTelp, p.Email, p.SttsNikah, p.KdSps, p.Alumni, p.NoIjnPraktek,
			kdDokter,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Dokter berhasil diperbarui"})
	}
}

// DELETE /api/dokter/:kd_dokter — soft delete (status='0'), padanan
// BtnHapusActionPerformed di DlgDokter.java — Java JUGA menandai
// pegawai.stts_aktif='KELUAR' saat dokter dihapus, disamakan di sini.
func hapusDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		if kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_dokter wajib diisi"})
			return
		}
		if _, err := db.Exec(`UPDATE dokter SET status='0' WHERE kd_dokter=?`, kdDokter); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		db.Exec(`UPDATE pegawai SET stts_aktif='KELUAR' WHERE nik=?`, kdDokter)
		c.JSON(http.StatusOK, gin.H{"message": "Dokter berhasil dihapus"})
	}
}

// PUT /api/dokter/:kd_dokter/restore — kebalikan hapusDokter, padanan
// DlgRestoreDokter.java (menu "Data Sampah") — cuma UPDATE status='1',
// TIDAK mengembalikan pegawai.stts_aktif (Java sendiri juga tidak
// melakukan itu di restore).
func restoreDokter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		if kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_dokter wajib diisi"})
			return
		}
		res, err := db.Exec(`UPDATE dokter SET status='1' WHERE kd_dokter=?`, kdDokter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dokter tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Dokter berhasil dipulihkan"})
	}
}

// DELETE /api/dokter/:kd_dokter/permanent — hapus baris sungguhan, TIDAK
// ada di Java (ditambahkan konsisten dengan fitur Petugas). kd_dokter
// direferensikan puluhan tabel transaksi lain, jadi ini hampir selalu
// akan gagal dengan foreign key constraint kalau dokternya pernah
// dipakai — itu perilaku yang benar, bukan bug.
func hapusDokterPermanen(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		if kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_dokter wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM dokter WHERE kd_dokter=?`, kdDokter)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "foreign key constraint") {
				c.JSON(http.StatusConflict, gin.H{"error": "Dokter ini tidak bisa dihapus permanen karena masih direferensikan di data transaksi lain (mis. registrasi, tindakan, dll). Data akan tetap nonaktif."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dokter tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Dokter berhasil dihapus permanen"})
	}
}

// GET /api/dokter/:kd_dokter/email — lookup ringan satu dokter (nama +
// email), dipakai fitur Tanda Tangan Elektronik Peruri (mis.
// ModalHasilRadiologi.tsx) utk ambil email dokter yg SEDANG dipilih di
// form (state React kd_dokter_pj), BUKAN dari endpoint /cetak/:noorder
// (yg balikin data sesi TERSIMPAN terakhir di DB — bisa beda dari dokter
// yg baru saja dipilih user di form tapi belum di-"Simpan Hasil").
func getDokterEmail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdDokter := c.Param("kd_dokter")
		if kdDokter == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kd_dokter wajib diisi"})
			return
		}
		var nmDokter, email string
		if err := db.QueryRow(`SELECT nm_dokter, IFNULL(email,'') FROM dokter WHERE kd_dokter = ?`, kdDokter).Scan(&nmDokter, &email); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dokter tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kd_dokter": kdDokter, "nm_dokter": nmDokter, "email": email})
	}
}
