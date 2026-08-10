package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ensurePetugasTable — str_sipa (Surat Tanda Registrasi / Surat Izin
// Praktik Apoteker) TIDAK ditambahkan sebagai kolom baru di tabel
// petugas. DlgPetugas.java menyimpan lewat Sequel.menyimpan(table,
// value, sama, i, a), yang membangun SQL "insert into petugas values
// (?,?,...)" TANPA daftar nama kolom (fully positional) — jumlah
// placeholder-nya (13) harus persis sama dengan jumlah kolom tabel.
// Menambah kolom baru di petugas akan membuat INSERT lama itu gagal
// dengan "Column count doesn't match value count", padahal Khanza Java
// desktop masih dipakai paralel di database yang sama. Jadi field
// khusus ERMApp ini disimpan di tabel pendamping terpisah (1:1 lewat
// nip), supaya tabel petugas tetap persis 13 kolom seperti aslinya.
func ensurePetugasTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS petugas_ext (
			nip VARCHAR(20) NOT NULL PRIMARY KEY,
			str_sipa VARCHAR(50) NOT NULL DEFAULT '',
			CONSTRAINT petugas_ext_ibfk_1 FOREIGN KEY (nip) REFERENCES petugas (nip) ON UPDATE CASCADE ON DELETE CASCADE
		)`)
	return err
}

type PetugasDetail struct {
	NIP       string `json:"nip"`
	Nama      string `json:"nama"`
	JK        string `json:"jk"`
	TmpLahir  string `json:"tmp_lahir"`
	TglLahir  string `json:"tgl_lahir"`
	GolDarah  string `json:"gol_darah"`
	Agama     string `json:"agama"`
	SttsNikah string `json:"stts_nikah"`
	Alamat    string `json:"alamat"`
	KdJbtn    string `json:"kd_jbtn"`
	NmJbtn    string `json:"nm_jbtn"`
	NoTelp    string `json:"no_telp"`
	Email     string `json:"email"`
	StrSipa   string `json:"str_sipa"`
}

// GET /api/petugas/list — padanan tampil()/prosesCari() di DlgPetugas.java
// (Khanza), join ke jabatan utk nama jabatan. DlgPetugas.java sendiri
// tidak punya toggle nonaktif (selalu status='1') — parameter `status` di
// sini tambahan ERMApp supaya ada layar "Petugas Nonaktif" (lihat
// restorePetugas/hapusPetugasPermanen di bawah), default tetap '1'
// (aktif) kalau parameternya tidak dikirim, sama seperti perilaku lama.
func getPetugasList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.DefaultQuery("status", "1"))
		jk := strings.TrimSpace(c.DefaultQuery("jk", ""))
		golDarah := strings.TrimSpace(c.DefaultQuery("gol_darah", ""))
		sttsNikah := strings.TrimSpace(c.DefaultQuery("stts_nikah", ""))
		search := strings.TrimSpace(c.DefaultQuery("search", ""))

		query := `
			SELECT
				petugas.nip, petugas.nama, COALESCE(petugas.jk,'') AS jk,
				COALESCE(petugas.tmp_lahir,'') AS tmp_lahir,
				COALESCE(DATE_FORMAT(petugas.tgl_lahir,'%Y-%m-%d'),'') AS tgl_lahir,
				COALESCE(petugas.gol_darah,'') AS gol_darah,
				COALESCE(petugas.agama,'') AS agama,
				COALESCE(petugas.stts_nikah,'') AS stts_nikah,
				COALESCE(petugas.alamat,'') AS alamat,
				COALESCE(petugas.kd_jbtn,'') AS kd_jbtn,
				COALESCE(jabatan.nm_jbtn,'') AS nm_jbtn,
				COALESCE(petugas.no_telp,'') AS no_telp,
				COALESCE(petugas.email,'') AS email,
				COALESCE(petugas_ext.str_sipa,'') AS str_sipa
			FROM petugas
			INNER JOIN jabatan ON jabatan.kd_jbtn = petugas.kd_jbtn
			LEFT JOIN petugas_ext ON petugas_ext.nip = petugas.nip
			WHERE petugas.status = ?`

		args := []interface{}{status}

		if jk != "" {
			query += " AND petugas.jk = ?"
			args = append(args, jk)
		}
		if golDarah != "" {
			query += " AND petugas.gol_darah = ?"
			args = append(args, golDarah)
		}
		if sttsNikah != "" {
			query += " AND petugas.stts_nikah = ?"
			args = append(args, sttsNikah)
		}
		if search != "" {
			query += ` AND (petugas.nip LIKE ? OR petugas.nama LIKE ? OR petugas.tmp_lahir LIKE ?
				OR petugas.alamat LIKE ? OR petugas.agama LIKE ? OR jabatan.nm_jbtn LIKE ?)`
			like := "%" + search + "%"
			args = append(args, like, like, like, like, like, like)
		}

		query += " ORDER BY petugas.nip"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []PetugasDetail{}
		for rows.Next() {
			var p PetugasDetail
			if err := rows.Scan(
				&p.NIP, &p.Nama, &p.JK, &p.TmpLahir, &p.TglLahir,
				&p.GolDarah, &p.Agama, &p.SttsNikah, &p.Alamat,
				&p.KdJbtn, &p.NmJbtn, &p.NoTelp, &p.Email, &p.StrSipa,
			); err != nil {
				continue
			}
			list = append(list, p)
		}
		c.JSON(http.StatusOK, list)
	}
}

type JabatanOpsi struct {
	KdJbtn string `json:"kd_jbtn"`
	NmJbtn string `json:"nm_jbtn"`
}

// GET /api/jabatan/opsi — padanan DlgCariJabatan.java, dipakai dropdown
// pemilihan jabatan di form Petugas.
func getJabatanOpsi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT kd_jbtn, nm_jbtn FROM jabatan ORDER BY nm_jbtn`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []JabatanOpsi{}
		for rows.Next() {
			var j JabatanOpsi
			if err := rows.Scan(&j.KdJbtn, &j.NmJbtn); err != nil {
				continue
			}
			list = append(list, j)
		}
		c.JSON(http.StatusOK, list)
	}
}

type PetugasPayload struct {
	NIP       string `json:"nip"`
	Nama      string `json:"nama"`
	JK        string `json:"jk"`
	TmpLahir  string `json:"tmp_lahir"`
	TglLahir  string `json:"tgl_lahir"`
	GolDarah  string `json:"gol_darah"`
	Agama     string `json:"agama"`
	SttsNikah string `json:"stts_nikah"`
	Alamat    string `json:"alamat"`
	KdJbtn    string `json:"kd_jbtn"`
	NoTelp    string `json:"no_telp"`
	Email     string `json:"email"`
	StrSipa   string `json:"str_sipa"`
}

// POST /api/petugas — tambah petugas baru. petugas.nip punya FK ke
// pegawai.nik, jadi NIP wajib sudah terdaftar sebagai pegawai (dipilih
// lewat ModalCariPegawai yang sudah ada) — beda dari Java yang
// insert-ignore ke pegawai dgn data dummy "-" lalu insert ke petugas,
// di sini pegawai-nya harus data asli yang sudah ada.
func tambahPetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PetugasPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.NIP == "" || p.Nama == "" || p.KdJbtn == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIP, nama, dan jabatan wajib diisi"})
			return
		}
		_, err := db.Exec(`
			INSERT INTO petugas (nip, nama, jk, tmp_lahir, tgl_lahir, gol_darah, agama, stts_nikah, alamat, kd_jbtn, no_telp, email, status)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'1')`,
			p.NIP, p.Nama, p.JK, p.TmpLahir, nullableDate(p.TglLahir), p.GolDarah, p.Agama, p.SttsNikah, p.Alamat, p.KdJbtn, p.NoTelp, p.Email,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "NIP sudah terdaftar sebagai petugas"})
				return
			}
			if strings.Contains(strings.ToLower(err.Error()), "foreign key constraint") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "NIP tidak ditemukan pada data Pegawai — pilih pegawai terlebih dahulu"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		db.Exec(`INSERT INTO petugas_ext (nip, str_sipa) VALUES (?,?) ON DUPLICATE KEY UPDATE str_sipa=VALUES(str_sipa)`, p.NIP, p.StrSipa)
		c.JSON(http.StatusOK, gin.H{"message": "Petugas berhasil ditambahkan"})
	}
}

func editPetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nip := c.Param("nip")
		if nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nip wajib diisi"})
			return
		}
		var p PetugasPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Nama == "" || p.KdJbtn == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nama dan jabatan wajib diisi"})
			return
		}
		_, err := db.Exec(`
			UPDATE petugas SET
				nama=?, jk=?, tmp_lahir=?, tgl_lahir=?, gol_darah=?, agama=?, stts_nikah=?, alamat=?, kd_jbtn=?, no_telp=?, email=?
			WHERE nip=?`,
			p.Nama, p.JK, p.TmpLahir, nullableDate(p.TglLahir), p.GolDarah, p.Agama, p.SttsNikah, p.Alamat, p.KdJbtn, p.NoTelp, p.Email,
			nip,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		db.Exec(`INSERT INTO petugas_ext (nip, str_sipa) VALUES (?,?) ON DUPLICATE KEY UPDATE str_sipa=VALUES(str_sipa)`, nip, p.StrSipa)
		c.JSON(http.StatusOK, gin.H{"message": "Petugas berhasil diperbarui"})
	}
}

// DELETE /api/petugas/:nip — soft delete (status='0'), padanan
// BtnHapusActionPerformed di DlgPetugas.java.
func hapusPetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nip := c.Param("nip")
		if nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nip wajib diisi"})
			return
		}
		_, err := db.Exec(`UPDATE petugas SET status='0' WHERE nip=?`, nip)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Petugas berhasil dihapus"})
	}
}

// PUT /api/petugas/:nip/restore — kebalikan hapusPetugas, kembalikan
// status jadi '1' supaya muncul lagi di daftar aktif.
func restorePetugas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nip := c.Param("nip")
		if nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nip wajib diisi"})
			return
		}
		res, err := db.Exec(`UPDATE petugas SET status='1' WHERE nip=?`, nip)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Petugas tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Petugas berhasil dipulihkan"})
	}
}

// DELETE /api/petugas/:nip/permanent — hapus baris sungguhan (bukan
// toggle status). petugas.nip direferensikan FK oleh RATUSAN tabel lain
// di skema Khanza (hampir semua modul transaksi punya kolom nip), jadi
// ini HAMPIR SELALU akan gagal dengan foreign key constraint kalau
// petugas itu pernah dipakai di transaksi apa pun — itu memang perilaku
// yang benar (mencegah data transaksi kehilangan referensinya), bukan
// bug. Errornya ditangkap dan diberi pesan yang jelas alih-alih
// membocorkan pesan SQL mentah ke user.
func hapusPetugasPermanen(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nip := c.Param("nip")
		if nip == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nip wajib diisi"})
			return
		}
		res, err := db.Exec(`DELETE FROM petugas WHERE nip=?`, nip)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "foreign key constraint") {
				c.JSON(http.StatusConflict, gin.H{"error": "Petugas ini tidak bisa dihapus permanen karena masih direferensikan di data transaksi lain (mis. resep, pembelian, dll). Data akan tetap nonaktif."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Petugas tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Petugas berhasil dihapus permanen"})
	}
}
