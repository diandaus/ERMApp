package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Tab "Diagnosa" di Khanza Java (laporan/PanelDiagnosa.java, dipakai
// DlgRawatJalan.java) menggabungkan input Diagnosa ICD10 (diagnosa_pasien)
// dan Prosedur ICD9 (prosedur_pasien) dalam satu panel. Padanan di sini
// dipisah jadi 2 kelompok endpoint tapi tetap satu file & satu tab modal,
// sesuai perilaku aslinya. Kd_diagnosa_utama/sekunder di resume_pasien
// (auto-cascade saat simpan di Java) SENGAJA tidak direplikasi dulu -
// Resume Medis di app ini tetap diisi manual terpisah seperti sekarang.

// --- Diagnosa (ICD10) ---

// PenyakitOption — field PERSIS kolom penyakit (DESCRIBE, dicek langsung
// ke DB) + Kategori/CiriUmum di-JOIN dari kategori_penyakit (kd_ktg),
// PERSIS grid pencarian ICD10 referensi Khanza Desktop (kolom Kode|Nama
// Penyakit|Ciri-ciri Penyakit|Keterangan|Kategori|Ciri-ciri Umum|VC|AP|
// Ast|IM yg dikasih user via screenshot).
type PenyakitOption struct {
	KdPenyakit string `json:"kd_penyakit"`
	NmPenyakit string `json:"nm_penyakit"`
	CiriCiri   string `json:"ciri_ciri"`
	Keterangan string `json:"keterangan"`
	Kategori   string `json:"kategori"`
	CiriUmum   string `json:"ciri_umum"`
	ValidCode  string `json:"validcode"`
	Accpdx     string `json:"accpdx"`
	Asterisk   string `json:"asterisk"`
	Im         string `json:"im"`
}

func searchPenyakit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		baseQuery := `
			SELECT
				penyakit.kd_penyakit, COALESCE(penyakit.nm_penyakit, ''),
				COALESCE(penyakit.ciri_ciri, ''), COALESCE(penyakit.keterangan, ''),
				COALESCE(kategori_penyakit.nm_kategori, ''), COALESCE(kategori_penyakit.ciri_umum, ''),
				penyakit.validcode, penyakit.accpdx, penyakit.asterisk, penyakit.im
			FROM penyakit
			LEFT JOIN kategori_penyakit ON kategori_penyakit.kd_ktg = penyakit.kd_ktg
		`
		var rows *sql.Rows
		var err error
		if q == "" {
			// Kosong -> tampilkan daftar awal (dipakai saat modal baru
			// dibuka, sebelum user mengetik apapun).
			rows, err = db.Query(baseQuery+` ORDER BY penyakit.kd_penyakit LIMIT 50`)
		} else {
			rows, err = db.Query(baseQuery+`
				WHERE penyakit.kd_penyakit LIKE ? OR penyakit.nm_penyakit LIKE ?
				ORDER BY penyakit.kd_penyakit
				LIMIT 50
			`, "%"+q+"%", "%"+q+"%")
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []PenyakitOption{}
		for rows.Next() {
			var p PenyakitOption
			if err := rows.Scan(&p.KdPenyakit, &p.NmPenyakit, &p.CiriCiri, &p.Keterangan, &p.Kategori, &p.CiriUmum, &p.ValidCode, &p.Accpdx, &p.Asterisk, &p.Im); err != nil {
				continue
			}
			items = append(items, p)
		}
		c.JSON(http.StatusOK, items)
	}
}

// DiagnosaPasienItem — Status/Kasus(status_penyakit)/Urut(prioritas)
// PERSIS grid "Diagnosa Tersimpan" referensi Khanza Desktop (screenshot
// user): Kode|Nama Penyakit|Status|Kasus|Urut.
type DiagnosaPasienItem struct {
	KdPenyakit     string `json:"kd_penyakit"`
	NmPenyakit     string `json:"nm_penyakit"`
	Status         string `json:"status"`
	Prioritas      int    `json:"prioritas"`
	StatusPenyakit string `json:"status_penyakit"`
}

func getDiagnosaPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		rows, err := db.Query(`
			SELECT dp.kd_penyakit, COALESCE(p.nm_penyakit, ''), dp.status, dp.prioritas, dp.status_penyakit
			FROM diagnosa_pasien dp
			LEFT JOIN penyakit p ON dp.kd_penyakit = p.kd_penyakit
			WHERE dp.no_rawat = ? AND dp.status = 'Ralan'
			ORDER BY dp.prioritas
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []DiagnosaPasienItem{}
		for rows.Next() {
			var d DiagnosaPasienItem
			var statusPenyakit sql.NullString
			if err := rows.Scan(&d.KdPenyakit, &d.NmPenyakit, &d.Status, &d.Prioritas, &statusPenyakit); err != nil {
				continue
			}
			d.StatusPenyakit = statusPenyakit.String
			items = append(items, d)
		}
		c.JSON(http.StatusOK, items)
	}
}

func saveDiagnosaPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			NoRawat    string `json:"no_rawat" binding:"required"`
			NoRkmMedis string `json:"no_rkm_medis" binding:"required"`
			KdPenyakit string `json:"kd_penyakit" binding:"required"`
			Prioritas  int    `json:"prioritas"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if payload.Prioritas <= 0 {
			var maxPrioritas sql.NullInt64
			db.QueryRow(`SELECT MAX(prioritas) FROM diagnosa_pasien WHERE no_rawat = ? AND status = 'Ralan'`, payload.NoRawat).Scan(&maxPrioritas)
			payload.Prioritas = int(maxPrioritas.Int64) + 1
		}

		// Padanan cek Java: kalau kd_penyakit ini sudah pernah didiagnosa
		// pasien (RM sama) di kunjungan manapun sebelumnya -> "Lama",
		// kalau belum pernah -> "Baru".
		var existingCount int
		db.QueryRow(`
			SELECT COUNT(*) FROM diagnosa_pasien dp
			INNER JOIN reg_periksa rp ON dp.no_rawat = rp.no_rawat
			WHERE rp.no_rkm_medis = ? AND dp.kd_penyakit = ?
		`, payload.NoRkmMedis, payload.KdPenyakit).Scan(&existingCount)
		statusPenyakit := "Baru"
		if existingCount > 0 {
			statusPenyakit = "Lama"
		}

		_, err := db.Exec(`
			INSERT INTO diagnosa_pasien (no_rawat, kd_penyakit, status, prioritas, status_penyakit)
			VALUES (?, ?, 'Ralan', ?, ?)
		`, payload.NoRawat, payload.KdPenyakit, payload.Prioritas, statusPenyakit)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Diagnosa ini sudah ada untuk kunjungan ini"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Diagnosa berhasil disimpan"})
	}
}

func deleteDiagnosaPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		kdPenyakit := c.Query("kd_penyakit")
		if noRawat == "" || kdPenyakit == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kd_penyakit wajib diisi"})
			return
		}
		_, err := db.Exec(`DELETE FROM diagnosa_pasien WHERE no_rawat = ? AND kd_penyakit = ? AND status = 'Ralan'`, noRawat, kdPenyakit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Diagnosa berhasil dihapus"})
	}
}

// --- Prosedur (ICD9) ---

// Icd9Option — field PERSIS kolom icd9 (DESCRIBE, dicek langsung ke DB),
// PERSIS grid pencarian ICD9 referensi Khanza Desktop (kolom Kode|
// Deskripsi Panjang|Deskripsi Pendek|VC|AP|IM|Urut|Jml yg dikasih user
// via screenshot).
type Icd9Option struct {
	Kode             string `json:"kode"`
	DeskripsiPanjang string `json:"deskripsi_panjang"`
	DeskripsiPendek  string `json:"deskripsi_pendek"`
	ValidCode        string `json:"validcode"`
	Accpdx           string `json:"accpdx"`
	Im               string `json:"im"`
}

func searchIcd9(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		baseQuery := `SELECT kode, COALESCE(deskripsi_panjang, ''), COALESCE(deskripsi_pendek, ''), validcode, accpdx, im FROM icd9`
		var rows *sql.Rows
		var err error
		if q == "" {
			rows, err = db.Query(baseQuery + ` ORDER BY kode LIMIT 50`)
		} else {
			rows, err = db.Query(baseQuery+`
				WHERE kode LIKE ? OR deskripsi_panjang LIKE ?
				ORDER BY kode
				LIMIT 50
			`, "%"+q+"%", "%"+q+"%")
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []Icd9Option{}
		for rows.Next() {
			var i Icd9Option
			if err := rows.Scan(&i.Kode, &i.DeskripsiPanjang, &i.DeskripsiPendek, &i.ValidCode, &i.Accpdx, &i.Im); err != nil {
				continue
			}
			items = append(items, i)
		}
		c.JSON(http.StatusOK, items)
	}
}

// ProsedurPasienItem — Status/Urut(prioritas)/Jml(jumlah) PERSIS grid
// "Prosedur Tersimpan" referensi Khanza Desktop (screenshot user): Kode|
// Nama Prosedur|Status|Urut|Jml.
type ProsedurPasienItem struct {
	Kode             string `json:"kode"`
	DeskripsiPanjang string `json:"deskripsi_panjang"`
	Status           string `json:"status"`
	Prioritas        int    `json:"prioritas"`
	Jumlah           string `json:"jumlah"`
}

func getProsedurPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		rows, err := db.Query(`
			SELECT pp.kode, COALESCE(i.deskripsi_panjang, ''), pp.status, pp.prioritas, pp.jumlah
			FROM prosedur_pasien pp
			LEFT JOIN icd9 i ON pp.kode = i.kode
			WHERE pp.no_rawat = ? AND pp.status = 'Ralan'
			ORDER BY pp.prioritas
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []ProsedurPasienItem{}
		for rows.Next() {
			var p ProsedurPasienItem
			if err := rows.Scan(&p.Kode, &p.DeskripsiPanjang, &p.Status, &p.Prioritas, &p.Jumlah); err != nil {
				continue
			}
			items = append(items, p)
		}
		c.JSON(http.StatusOK, items)
	}
}

func saveProsedurPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			NoRawat   string `json:"no_rawat" binding:"required"`
			Kode      string `json:"kode" binding:"required"`
			Prioritas int    `json:"prioritas"`
			Jumlah    string `json:"jumlah"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if payload.Prioritas <= 0 {
			var maxPrioritas sql.NullInt64
			db.QueryRow(`SELECT MAX(prioritas) FROM prosedur_pasien WHERE no_rawat = ? AND status = 'Ralan'`, payload.NoRawat).Scan(&maxPrioritas)
			payload.Prioritas = int(maxPrioritas.Int64) + 1
		}
		if payload.Jumlah == "" {
			payload.Jumlah = "1"
		}

		_, err := db.Exec(`
			INSERT INTO prosedur_pasien (no_rawat, kode, status, prioritas, jumlah)
			VALUES (?, ?, 'Ralan', ?, ?)
		`, payload.NoRawat, payload.Kode, payload.Prioritas, payload.Jumlah)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Prosedur ini sudah ada untuk kunjungan ini"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Prosedur berhasil disimpan"})
	}
}

func deleteProsedurPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		kode := c.Query("kode")
		if noRawat == "" || kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kode wajib diisi"})
			return
		}
		_, err := db.Exec(`DELETE FROM prosedur_pasien WHERE no_rawat = ? AND kode = ? AND status = 'Ralan'`, noRawat, kode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Prosedur berhasil dihapus"})
	}
}
