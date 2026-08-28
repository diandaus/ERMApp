package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// akun_peruri_handler.go — CRUD "Data Pengguna" Peruri (Bridging > Peruri >
// Data Pengguna, frontend/src/modules/AkunPeruri.tsx). Tabel akun_peruri
// SUDAH ADA duluan di DB ibnusinadev (dicopy manual ke DB sik) — skema di
// sini PERSIS SHOW CREATE TABLE aslinya, ensureAkunPeruriTable cuma jaga2
// utk instalasi baru yg belum punya tabelnya sama sekali.
//
// email dipakai sbg primary key ASLI tabel ini (bukan id auto-increment)
// — dipakai juga sbg URL param di endpoint detail/update/delete.

func ensureAkunPeruriTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS akun_peruri (
			name VARCHAR(100) NOT NULL,
			phone VARCHAR(15) NOT NULL,
			email VARCHAR(100) NOT NULL,
			type ENUM('INDIVIDUAL','User') NOT NULL,
			ktp VARCHAR(20) NOT NULL,
			ktp_photo LONGTEXT NOT NULL,
			address TEXT NOT NULL,
			city VARCHAR(100) NOT NULL,
			province VARCHAR(100) NOT NULL,
			gender ENUM('M','F') NOT NULL,
			place_of_birth VARCHAR(100) NOT NULL,
			date_of_birth DATE NOT NULL,
			org_unit VARCHAR(100) NOT NULL,
			work_unit VARCHAR(100) NOT NULL,
			position VARCHAR(100) NOT NULL,
			PRIMARY KEY (email)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createTable)
	return err
}

type akunPeruriPayload struct {
	Name         string `json:"name" binding:"required"`
	Phone        string `json:"phone" binding:"required"`
	Email        string `json:"email" binding:"required"`
	Type         string `json:"type" binding:"required"`
	KTP          string `json:"ktp" binding:"required"`
	KTPPhoto     string `json:"ktp_photo"`
	Address      string `json:"address"`
	City         string `json:"city"`
	Province     string `json:"province"`
	Gender       string `json:"gender" binding:"required"`
	PlaceOfBirth string `json:"place_of_birth"`
	DateOfBirth  string `json:"date_of_birth"`
	OrgUnit      string `json:"org_unit"`
	WorkUnit     string `json:"work_unit"`
	Position     string `json:"position"`
}

// GET /api/akun-peruri?search= — daftar ringkas TANPA ktp_photo (base64,
// bisa besar) — cuma flag has_ktp_photo. Foto asli diambil terpisah lewat
// endpoint detail (GET /api/akun-peruri/:email) saat benar2 dibutuhkan
// (mis. tombol "Lihat Foto KTP").
func getAkunPeruriList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		// DATE_FORMAT di SQL, bukan scan langsung kolom DATE ke string — koneksi
		// DB ini pakai parseTime=true, jadi date_of_birth datang sbg time.Time
		// (bukan literal "YYYY-MM-DD"), pola sama persis dgn bug yg sudah
		// diperbaiki di getPermintaanRadiologiList/getCetakHasilRadiologi.
		query := `
			SELECT name, phone, email, type, ktp, address, city, province, gender,
				place_of_birth, DATE_FORMAT(date_of_birth,'%Y-%m-%d'), org_unit, work_unit, position,
				(ktp_photo <> '') AS has_ktp_photo
			FROM akun_peruri`
		args := []interface{}{}
		if search != "" {
			query += ` WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR ktp LIKE ?`
			like := "%" + search + "%"
			args = append(args, like, like, like, like)
		}
		query += ` ORDER BY name`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type row struct {
			Name         string `json:"name"`
			Phone        string `json:"phone"`
			Email        string `json:"email"`
			Type         string `json:"type"`
			KTP          string `json:"ktp"`
			Address      string `json:"address"`
			City         string `json:"city"`
			Province     string `json:"province"`
			Gender       string `json:"gender"`
			PlaceOfBirth string `json:"place_of_birth"`
			DateOfBirth  string `json:"date_of_birth"`
			OrgUnit      string `json:"org_unit"`
			WorkUnit     string `json:"work_unit"`
			Position     string `json:"position"`
			HasKTPPhoto  bool   `json:"has_ktp_photo"`
		}
		list := []row{}
		for rows.Next() {
			var r row
			if err := rows.Scan(&r.Name, &r.Phone, &r.Email, &r.Type, &r.KTP, &r.Address, &r.City, &r.Province,
				&r.Gender, &r.PlaceOfBirth, &r.DateOfBirth, &r.OrgUnit, &r.WorkUnit, &r.Position, &r.HasKTPPhoto); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// GET /api/akun-peruri/:email — detail satu akun TERMASUK ktp_photo asli.
func getAkunPeruriDetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := c.Param("email")
		var p akunPeruriPayload
		err := db.QueryRow(`
			SELECT name, phone, email, type, ktp, ktp_photo, address, city, province,
				gender, place_of_birth, DATE_FORMAT(date_of_birth,'%Y-%m-%d'), org_unit, work_unit, position
			FROM akun_peruri WHERE email = ?`, email,
		).Scan(&p.Name, &p.Phone, &p.Email, &p.Type, &p.KTP, &p.KTPPhoto, &p.Address, &p.City, &p.Province,
			&p.Gender, &p.PlaceOfBirth, &p.DateOfBirth, &p.OrgUnit, &p.WorkUnit, &p.Position)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun Peruri tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

// POST /api/akun-peruri — tambah akun baru.
func createAkunPeruri(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p akunPeruriPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_, err := db.Exec(`
			INSERT INTO akun_peruri
				(name, phone, email, type, ktp, ktp_photo, address, city, province,
				 gender, place_of_birth, date_of_birth, org_unit, work_unit, position)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			p.Name, p.Phone, p.Email, p.Type, p.KTP, p.KTPPhoto, p.Address, p.City, p.Province,
			p.Gender, p.PlaceOfBirth, nullableDate(p.DateOfBirth), p.OrgUnit, p.WorkUnit, p.Position,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Email ini sudah terdaftar"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Akun Peruri berhasil ditambahkan"})
	}
}

// PUT /api/akun-peruri/:email — edit akun. ktp_photo dilewati (TIDAK
// ditimpa kosong) kalau frontend tidak mengirim foto baru — form edit
// biasanya tidak selalu upload ulang foto KTP tiap simpan.
func updateAkunPeruri(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := c.Param("email")
		var p akunPeruriPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var res sql.Result
		var err error
		if p.KTPPhoto != "" {
			res, err = db.Exec(`
				UPDATE akun_peruri SET
					name=?, phone=?, type=?, ktp=?, ktp_photo=?, address=?, city=?, province=?,
					gender=?, place_of_birth=?, date_of_birth=?, org_unit=?, work_unit=?, position=?
				WHERE email=?`,
				p.Name, p.Phone, p.Type, p.KTP, p.KTPPhoto, p.Address, p.City, p.Province,
				p.Gender, p.PlaceOfBirth, nullableDate(p.DateOfBirth), p.OrgUnit, p.WorkUnit, p.Position, email,
			)
		} else {
			res, err = db.Exec(`
				UPDATE akun_peruri SET
					name=?, phone=?, type=?, ktp=?, address=?, city=?, province=?,
					gender=?, place_of_birth=?, date_of_birth=?, org_unit=?, work_unit=?, position=?
				WHERE email=?`,
				p.Name, p.Phone, p.Type, p.KTP, p.Address, p.City, p.Province,
				p.Gender, p.PlaceOfBirth, nullableDate(p.DateOfBirth), p.OrgUnit, p.WorkUnit, p.Position, email,
			)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun Peruri tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Akun Peruri berhasil diperbarui"})
	}
}

// DELETE /api/akun-peruri/:email
func deleteAkunPeruri(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := c.Param("email")
		res, err := db.Exec(`DELETE FROM akun_peruri WHERE email = ?`, email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun Peruri tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Akun Peruri berhasil dihapus"})
	}
}
