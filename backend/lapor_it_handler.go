package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// Lapor IT — fitur BARU murni ERMApp (tidak ada di Khanza). Alurnya: pegawai
// lapor kendala IT (hardware/software/jaringan/printer/lainnya) lewat HP,
// lengkap dgn lokasi, deskripsi, & foto opsional -> staf IT proses/selesaikan/
// tolak lewat modul "IT Support" desktop -> pegawai lihat status laporannya
// sendiri di HP.
// ============================================================================

func ensureLaporItTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS lapor_it (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			pegawai_id INT NOT NULL,
			kategori ENUM('hardware','software','jaringan','printer','lainnya') NOT NULL DEFAULT 'lainnya',
			lokasi VARCHAR(100) NOT NULL DEFAULT '',
			judul VARCHAR(150) NOT NULL DEFAULT '',
			deskripsi TEXT,
			foto VARCHAR(255) NOT NULL DEFAULT '',
			status ENUM('menunggu','diproses','selesai','ditolak') NOT NULL DEFAULT 'menunggu',
			catatan_penyelesaian VARCHAR(255) NOT NULL DEFAULT '',
			ditangani_oleh VARCHAR(100) NOT NULL DEFAULT '',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_lapor_it_pegawai FOREIGN KEY (pegawai_id)
				REFERENCES pegawai (id) ON DELETE CASCADE
		) ENGINE=InnoDB
	`)
}

var kategoriLaporIt = map[string]bool{
	"hardware": true, "software": true, "jaringan": true, "printer": true, "lainnya": true,
}

type LaporItRow struct {
	ID                  int    `json:"id"`
	NIK                 string `json:"nik"`
	Nama                string `json:"nama"`
	Departemen          string `json:"departemen"`
	Kategori            string `json:"kategori"`
	Lokasi              string `json:"lokasi"`
	Judul               string `json:"judul"`
	Deskripsi           string `json:"deskripsi"`
	Foto                string `json:"foto"`
	Status              string `json:"status"`
	CatatanPenyelesaian string `json:"catatan_penyelesaian"`
	DitanganiOleh       string `json:"ditangani_oleh"`
	CreatedAt           string `json:"created_at"`
}

type LaporItSubmitPayload struct {
	NIK       string `json:"nik" binding:"required"`
	Kategori  string `json:"kategori" binding:"required"`
	Lokasi    string `json:"lokasi" binding:"required"`
	Judul     string `json:"judul" binding:"required"`
	Deskripsi string `json:"deskripsi"`
	Foto      string `json:"foto"`
}

// POST /api/lapor-it — pegawai lapor kendala IT dari HP.
func submitLaporIt(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p LaporItSubmitPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !kategoriLaporIt[p.Kategori] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kategori tidak valid"})
			return
		}
		id, _, _, err := resolvePegawaiID(db, p.NIK)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		_, err = db.Exec(
			`INSERT INTO lapor_it (pegawai_id, kategori, lokasi, judul, deskripsi, foto) VALUES (?,?,?,?,?,?)`,
			id, p.Kategori, p.Lokasi, p.Judul, p.Deskripsi, p.Foto,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Laporan berhasil dikirim ke tim IT"})
	}
}

const laporItSelectCols = `
	lapor_it.id, pegawai.nik, pegawai.nama,
	lapor_it.kategori, lapor_it.lokasi, lapor_it.judul, lapor_it.deskripsi, lapor_it.foto,
	lapor_it.status, lapor_it.catatan_penyelesaian, lapor_it.ditangani_oleh,
	DATE_FORMAT(lapor_it.created_at,'%Y-%m-%d %H:%i')`

func scanLaporItRows(rows *sql.Rows) []LaporItRow {
	list := []LaporItRow{}
	for rows.Next() {
		var r LaporItRow
		if err := rows.Scan(&r.ID, &r.NIK, &r.Nama, &r.Kategori, &r.Lokasi, &r.Judul, &r.Deskripsi, &r.Foto,
			&r.Status, &r.CatatanPenyelesaian, &r.DitanganiOleh, &r.CreatedAt); err == nil {
			list = append(list, r)
		}
	}
	return list
}

// GET /api/lapor-it/saya?nik= — riwayat laporan pegawai sendiri (mobile).
func getLaporItSaya(db *sql.DB) gin.HandlerFunc {
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
		rows, err := db.Query(`
			SELECT `+laporItSelectCols+`
			FROM lapor_it INNER JOIN pegawai ON pegawai.id = lapor_it.pegawai_id
			WHERE lapor_it.pegawai_id = ? ORDER BY lapor_it.id DESC`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanLaporItRows(rows))
	}
}

// GET /api/lapor-it/list?status=&kategori=&search= — admin/staf IT (desktop).
func getLaporItList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.Query("status"))
		kategori := strings.TrimSpace(c.Query("kategori"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT ` + laporItSelectCols + `
			FROM lapor_it INNER JOIN pegawai ON pegawai.id = lapor_it.pegawai_id
			WHERE 1=1`
		args := []interface{}{}
		if status != "" {
			query += " AND lapor_it.status = ?"
			args = append(args, status)
		}
		if kategori != "" {
			query += " AND lapor_it.kategori = ?"
			args = append(args, kategori)
		}
		if search != "" {
			query += " AND (pegawai.nik LIKE ? OR pegawai.nama LIKE ? OR lapor_it.judul LIKE ? OR lapor_it.lokasi LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like, like, like)
		}
		query += " ORDER BY lapor_it.id DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanLaporItRows(rows))
	}
}

type LaporItKeputusanPayload struct {
	Catatan       string `json:"catatan"`
	DitanganiOleh string `json:"ditangani_oleh"`
}

func putusLaporIt(db *sql.DB, statusBaru string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		var p LaporItKeputusanPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(
			`UPDATE lapor_it SET status=?, catatan_penyelesaian=?, ditangani_oleh=? WHERE id=?`,
			statusBaru, p.Catatan, p.DitanganiOleh, id,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Laporan tidak ditemukan"})
			return
		}
		pesan := map[string]string{
			"diproses": "Laporan ditandai sedang diproses",
			"selesai":  "Laporan ditandai selesai",
			"ditolak":  "Laporan ditolak",
		}[statusBaru]
		c.JSON(http.StatusOK, gin.H{"message": pesan})
	}
}

// PUT /api/lapor-it/:id/proses
func prosesLaporIt(db *sql.DB) gin.HandlerFunc { return putusLaporIt(db, "diproses") }

// PUT /api/lapor-it/:id/selesai
func selesaiLaporIt(db *sql.DB) gin.HandlerFunc { return putusLaporIt(db, "selesai") }

// PUT /api/lapor-it/:id/tolak
func tolakLaporIt(db *sql.DB) gin.HandlerFunc { return putusLaporIt(db, "ditolak") }

// DELETE /api/lapor-it/:id — batalkan laporan (pegawai membatalkan laporan
// sendiri yang masih "menunggu", atau staf IT menghapus).
func hapusLaporIt(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id tidak valid"})
			return
		}
		res, err := db.Exec(`DELETE FROM lapor_it WHERE id=?`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Laporan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Laporan berhasil dihapus"})
	}
}
