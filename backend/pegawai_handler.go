package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type PegawaiDetail struct {
	NIK           string `json:"nik"`
	Nama          string `json:"nama"`
	JK            string `json:"jk"`
	Jbtn          string `json:"jbtn"`
	JnjJabatan    string `json:"jnj_jabatan"`
	KodeKelompok  string `json:"kode_kelompok"`
	KodeResiko    string `json:"kode_resiko"`
	KodeEmergency string `json:"kode_emergency"`
	Departemen    string `json:"departemen"`
	Bidang        string `json:"bidang"`
	SttsWP        string `json:"stts_wp"`
	SttsKerja     string `json:"stts_kerja"`
	Npwp          string `json:"npwp"`
	Pendidikan    string `json:"pendidikan"`
	TmpLahir      string `json:"tmp_lahir"`
	TglLahir      string `json:"tgl_lahir"`
	Alamat        string `json:"alamat"`
	Kota          string `json:"kota"`
	MulaiKerja    string `json:"mulai_kerja"`
	MsKerja       string `json:"ms_kerja"`
	Indexins      string `json:"indexins"`
	Bpd           string `json:"bpd"`
	Rekening      string `json:"rekening"`
	SttsAktif     string `json:"stts_aktif"`
	Wajibmasuk    int    `json:"wajibmasuk"`
	MulaiKontrak  string `json:"mulai_kontrak"`
	NoKTP         string `json:"no_ktp"`
	Email         string `json:"email"`
	Photo         string `json:"photo"`
}

func getPegawaiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search    := strings.TrimSpace(c.DefaultQuery("search", ""))
		sttsAktif := strings.TrimSpace(c.DefaultQuery("stts_aktif", ""))
		dept      := strings.TrimSpace(c.DefaultQuery("departemen", ""))

		query := `
			SELECT
				nik,
				nama,
				COALESCE(jk,'') AS jk,
				COALESCE(jbtn,'') AS jbtn,
				COALESCE(jnj_jabatan,'') AS jnj_jabatan,
				COALESCE(kode_kelompok,'') AS kode_kelompok,
				COALESCE(kode_resiko,'') AS kode_resiko,
				COALESCE(kode_emergency,'') AS kode_emergency,
				COALESCE(departemen,'') AS departemen,
				COALESCE(bidang,'') AS bidang,
				COALESCE(stts_wp,'') AS stts_wp,
				COALESCE(stts_kerja,'') AS stts_kerja,
				COALESCE(npwp,'') AS npwp,
				COALESCE(pendidikan,'') AS pendidikan,
				COALESCE(tmp_lahir,'') AS tmp_lahir,
				COALESCE(DATE_FORMAT(tgl_lahir,'%Y-%m-%d'),'') AS tgl_lahir,
				COALESCE(alamat,'') AS alamat,
				COALESCE(kota,'') AS kota,
				COALESCE(DATE_FORMAT(mulai_kerja,'%Y-%m-%d'),'') AS mulai_kerja,
				COALESCE(ms_kerja,'') AS ms_kerja,
				COALESCE(indexins,'') AS indexins,
				COALESCE(bpd,'') AS bpd,
				COALESCE(rekening,'') AS rekening,
				COALESCE(stts_aktif,'') AS stts_aktif,
				COALESCE(wajibmasuk,0) AS wajibmasuk,
				COALESCE(DATE_FORMAT(mulai_kontrak,'%Y-%m-%d'),'') AS mulai_kontrak,
				COALESCE(no_ktp,'') AS no_ktp,
				COALESCE(email,'') AS email,
				COALESCE(photo,'') AS photo
			FROM pegawai
			WHERE 1=1`

		args := []interface{}{}

		if search != "" {
			query += " AND (nama LIKE ? OR nik LIKE ? OR jbtn LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like, like)
		}
		if sttsAktif != "" {
			query += " AND stts_aktif = ?"
			args = append(args, sttsAktif)
		}
		if dept != "" {
			query += " AND departemen = ?"
			args = append(args, dept)
		}

		query += " ORDER BY nama LIMIT 500"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []PegawaiDetail
		for rows.Next() {
			var p PegawaiDetail
			if err := rows.Scan(
				&p.NIK, &p.Nama, &p.JK, &p.Jbtn, &p.JnjJabatan,
				&p.KodeKelompok, &p.KodeResiko, &p.KodeEmergency,
				&p.Departemen, &p.Bidang, &p.SttsWP, &p.SttsKerja,
				&p.Npwp, &p.Pendidikan, &p.TmpLahir, &p.TglLahir,
				&p.Alamat, &p.Kota, &p.MulaiKerja, &p.MsKerja,
				&p.Indexins, &p.Bpd, &p.Rekening, &p.SttsAktif,
				&p.Wajibmasuk, &p.MulaiKontrak, &p.NoKTP, &p.Email, &p.Photo,
			); err != nil {
				continue
			}
			list = append(list, p)
		}
		if list == nil {
			list = []PegawaiDetail{}
		}
		c.JSON(http.StatusOK, list)
	}
}

// ─── Master Data ─────────────────────────────────────────────────────────────

type MasterKodeNama struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

type MasterIndexins struct {
	Kode   string `json:"kode"`
	Persen string `json:"persen"`
}

type PegawaiMasterData struct {
	Departemen      []MasterKodeNama `json:"departemen"`
	Bidang          []string         `json:"bidang"`
	Pendidikan      []string         `json:"pendidikan"`
	JnjJabatan      []MasterKodeNama `json:"jnj_jabatan"`
	KelompokJabatan []MasterKodeNama `json:"kelompok_jabatan"`
	ResikoKerja     []MasterKodeNama `json:"resiko_kerja"`
	EmergencyIndex  []MasterKodeNama `json:"emergency_index"`
	SttsWP          []MasterKodeNama `json:"stts_wp"`
	SttsKerja       []MasterKodeNama `json:"stts_kerja"`
	Indexins        []MasterIndexins `json:"indexins"`
	Bank            []string         `json:"bank"`
}

func getPegawaiMaster(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		m := PegawaiMasterData{
			Departemen: []MasterKodeNama{}, Bidang: []string{}, Pendidikan: []string{},
			JnjJabatan: []MasterKodeNama{}, KelompokJabatan: []MasterKodeNama{},
			ResikoKerja: []MasterKodeNama{}, EmergencyIndex: []MasterKodeNama{},
			SttsWP: []MasterKodeNama{}, SttsKerja: []MasterKodeNama{},
			Indexins: []MasterIndexins{}, Bank: []string{},
		}

		scanKodeNama := func(q string) []MasterKodeNama {
			rows, err := db.Query(q)
			if err != nil { return []MasterKodeNama{} }
			defer rows.Close()
			var out []MasterKodeNama
			for rows.Next() {
				var v MasterKodeNama
				if rows.Scan(&v.Kode, &v.Nama) == nil { out = append(out, v) }
			}
			if out == nil { return []MasterKodeNama{} }
			return out
		}

		scanStr := func(q string) []string {
			rows, err := db.Query(q)
			if err != nil { return []string{} }
			defer rows.Close()
			var out []string
			for rows.Next() {
				var v string
				if rows.Scan(&v) == nil { out = append(out, v) }
			}
			if out == nil { return []string{} }
			return out
		}

		m.Departemen      = scanKodeNama("SELECT dep_id, nama FROM departemen ORDER BY dep_id")
		m.Bidang          = scanStr("SELECT nama FROM bidang ORDER BY nama")
		m.Pendidikan      = scanStr("SELECT tingkat FROM pendidikan ORDER BY tingkat")
		m.JnjJabatan      = scanKodeNama("SELECT kode, nama FROM jnj_jabatan ORDER BY kode")
		m.KelompokJabatan = scanKodeNama("SELECT kode_kelompok, nama_kelompok FROM kelompok_jabatan ORDER BY nama_kelompok")
		m.ResikoKerja     = scanKodeNama("SELECT kode_resiko, nama_resiko FROM resiko_kerja ORDER BY nama_resiko")
		m.EmergencyIndex  = scanKodeNama("SELECT kode_emergency, nama_emergency FROM emergency_index ORDER BY nama_emergency")
		m.SttsWP          = scanKodeNama("SELECT stts, ktg FROM stts_wp ORDER BY stts")
		m.SttsKerja       = scanKodeNama("SELECT stts, ktg FROM stts_kerja ORDER BY stts")
		m.Bank            = scanStr("SELECT namabank FROM bank ORDER BY namabank")

		// indexins: dep_id + persen
		rows, err := db.Query("SELECT dep_id, persen FROM indexins ORDER BY dep_id")
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var v MasterIndexins
				if rows.Scan(&v.Kode, &v.Persen) == nil { m.Indexins = append(m.Indexins, v) }
			}
		}
		if m.Indexins == nil { m.Indexins = []MasterIndexins{} }

		c.JSON(http.StatusOK, m)
	}
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

type PegawaiPayload struct {
	NIK           string `json:"nik"`
	Nama          string `json:"nama"`
	JK            string `json:"jk"`
	Jbtn          string `json:"jbtn"`
	JnjJabatan    string `json:"jnj_jabatan"`
	KodeKelompok  string `json:"kode_kelompok"`
	KodeResiko    string `json:"kode_resiko"`
	KodeEmergency string `json:"kode_emergency"`
	Departemen    string `json:"departemen"`
	Bidang        string `json:"bidang"`
	SttsWP        string `json:"stts_wp"`
	SttsKerja     string `json:"stts_kerja"`
	Npwp          string `json:"npwp"`
	Pendidikan    string `json:"pendidikan"`
	TmpLahir      string `json:"tmp_lahir"`
	TglLahir      string `json:"tgl_lahir"`
	Alamat        string `json:"alamat"`
	Kota          string `json:"kota"`
	MulaiKerja    string `json:"mulai_kerja"`
	MsKerja       string `json:"ms_kerja"`
	Indexins      string `json:"indexins"`
	Bpd           string `json:"bpd"`
	Rekening      string `json:"rekening"`
	SttsAktif     string `json:"stts_aktif"`
	Wajibmasuk    int    `json:"wajibmasuk"`
	MulaiKontrak  string `json:"mulai_kontrak"`
	NoKTP         string `json:"no_ktp"`
	Email         string `json:"email"`
}

func defVal(v, def string) string {
	if v == "" { return def }
	return v
}

func nullableDate(v string) interface{} {
	if v == "" || v == "0000-00-00" { return nil }
	return v
}

func tambahPegawai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p PegawaiPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.NIK == "" || p.Nama == "" || p.JK == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIK, Nama, dan Jenis Kelamin wajib diisi"})
			return
		}
		if p.SttsAktif == "" { p.SttsAktif = "AKTIF" }
		if p.TglLahir == ""  { p.TglLahir = "1990-01-01" }
		if p.MulaiKerja == "" { p.MulaiKerja = "2000-01-01" }
		if p.MsKerja == ""   { p.MsKerja = "<1" }

		_, err := db.Exec(`
			INSERT INTO pegawai
				(nik, nama, jk, jbtn, jnj_jabatan, kode_kelompok, kode_resiko, kode_emergency,
				 departemen, bidang, stts_wp, stts_kerja, npwp, pendidikan, gapok,
				 tmp_lahir, tgl_lahir, alamat, kota, mulai_kerja, ms_kerja,
				 indexins, bpd, rekening, stts_aktif, wajibmasuk, pengurang,
				 indek, cuti_diambil, dankes, mulai_kontrak, no_ktp, email)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,0,0,0,0,?,?,?)`,
			p.NIK, p.Nama, p.JK,
			defVal(p.Jbtn, "-"),
			defVal(p.JnjJabatan, "-"),
			defVal(p.KodeKelompok, "-"),
			defVal(p.KodeResiko, "-"),
			defVal(p.KodeEmergency, "-"),
			defVal(p.Departemen, "-"),
			defVal(p.Bidang, "-"),
			defVal(p.SttsWP, "-"),
			defVal(p.SttsKerja, "-"),
			p.Npwp,
			defVal(p.Pendidikan, "-"),
			p.TmpLahir, p.TglLahir, p.Alamat, p.Kota, p.MulaiKerja,
			p.MsKerja,
			defVal(p.Indexins, "-"),
			defVal(p.Bpd, "-"),
			p.Rekening,
			p.SttsAktif,
			p.Wajibmasuk,
			nullableDate(p.MulaiKontrak),
			p.NoKTP, p.Email,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "NIK sudah terdaftar"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pegawai berhasil ditambahkan"})
	}
}

func editPegawai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := c.Param("nik")
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		var p PegawaiPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Nama == "" || p.JK == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama dan Jenis Kelamin wajib diisi"})
			return
		}
		if p.MsKerja == ""   { p.MsKerja = "<1" }
		if p.SttsAktif == "" { p.SttsAktif = "AKTIF" }

		_, err := db.Exec(`
			UPDATE pegawai SET
				nama=?, jk=?, jbtn=?,
				jnj_jabatan=?, kode_kelompok=?, kode_resiko=?, kode_emergency=?,
				departemen=?, bidang=?,
				stts_wp=?, stts_kerja=?,
				npwp=?, pendidikan=?,
				tmp_lahir=?, tgl_lahir=?, alamat=?, kota=?,
				mulai_kerja=?, ms_kerja=?,
				indexins=?, bpd=?, rekening=?,
				stts_aktif=?, wajibmasuk=?, mulai_kontrak=?,
				no_ktp=?, email=?
			WHERE nik=?`,
			p.Nama, p.JK, defVal(p.Jbtn, "-"),
			defVal(p.JnjJabatan, "-"), defVal(p.KodeKelompok, "-"),
			defVal(p.KodeResiko, "-"), defVal(p.KodeEmergency, "-"),
			defVal(p.Departemen, "-"), defVal(p.Bidang, "-"),
			defVal(p.SttsWP, "-"), defVal(p.SttsKerja, "-"),
			p.Npwp, defVal(p.Pendidikan, "-"),
			p.TmpLahir, defVal(p.TglLahir, "1990-01-01"), p.Alamat, p.Kota,
			defVal(p.MulaiKerja, "2000-01-01"), p.MsKerja,
			defVal(p.Indexins, "-"), defVal(p.Bpd, "-"), p.Rekening,
			p.SttsAktif, p.Wajibmasuk, nullableDate(p.MulaiKontrak),
			p.NoKTP, p.Email,
			nik,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Sinkronisasi ke tabel dokter dan petugas (best-effort, seperti Khanza)
		jkShort := "L"
		if strings.EqualFold(p.JK, "Wanita") { jkShort = "P" }
		db.Exec(`UPDATE dokter SET nm_dokter=?, jk=?, tmp_lahir=?, tgl_lahir=?, almt_tgl=? WHERE kd_dokter=?`,
			p.Nama, jkShort, p.TmpLahir, p.TglLahir, p.Alamat, nik)
		db.Exec(`UPDATE petugas SET nama=?, jk=?, tmp_lahir=?, tgl_lahir=?, alamat=? WHERE nip=?`,
			p.Nama, jkShort, p.TmpLahir, p.TglLahir, p.Alamat, nik)

		c.JSON(http.StatusOK, gin.H{"message": "Pegawai berhasil diperbarui"})
	}
}

func hapusPegawai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := c.Param("nik")
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		_, err := db.Exec(`DELETE FROM pegawai WHERE nik = ?`, nik)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pegawai berhasil dihapus"})
	}
}

func updatePegawaiStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NIK       string `json:"nik"`
			SttsAktif string `json:"stts_aktif"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if body.NIK == "" || body.SttsAktif == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik dan stts_aktif wajib diisi"})
			return
		}
		allowed := map[string]bool{"AKTIF": true, "CUTI": true, "KELUAR": true, "TENAGA LUAR": true}
		if !allowed[body.SttsAktif] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status tidak valid"})
			return
		}
		_, err := db.Exec(`UPDATE pegawai SET stts_aktif = ? WHERE nik = ?`, body.SttsAktif, body.NIK)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status berhasil diperbarui"})
	}
}

func getPegawaiDepartemen(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT DISTINCT COALESCE(departemen,'') AS departemen FROM pegawai WHERE departemen != '' AND departemen != '-' ORDER BY departemen`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		var list []string
		for rows.Next() {
			var d string
			if err := rows.Scan(&d); err != nil { continue }
			list = append(list, d)
		}
		if list == nil { list = []string{} }
		c.JSON(http.StatusOK, list)
	}
}
