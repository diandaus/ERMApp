package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type AdimeRow struct {
	NoRawat     string `json:"no_rawat"`
	Tanggal     string `json:"tanggal"`
	Asesmen     string `json:"asesmen"`
	Diagnosis   string `json:"diagnosis"`
	Intervensi  string `json:"intervensi"`
	Monitoring  string `json:"monitoring"`
	Evaluasi    string `json:"evaluasi"`
	Instruksi   string `json:"instruksi"`
	NIP         string `json:"nip"`
	NamaPetugas string `json:"nama_petugas"`
}

type AdimePayload struct {
	NoRawat    string `json:"no_rawat"`
	Tanggal    string `json:"tanggal"`
	Asesmen    string `json:"asesmen"`
	Diagnosis  string `json:"diagnosis"`
	Intervensi string `json:"intervensi"`
	Monitoring string `json:"monitoring"`
	Evaluasi   string `json:"evaluasi"`
	Instruksi  string `json:"instruksi"`
	NIP        string `json:"nip"`
}

// ─── GET /api/adime/:no_rawat ─────────────────────────────────────────────────

func getAdime(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		rows, err := db.Query(`
			SELECT
				catatan_adime_gizi.no_rawat,
				DATE_FORMAT(catatan_adime_gizi.tanggal, '%d/%m/%Y %H:%i:%s') as tanggal,
				COALESCE(catatan_adime_gizi.asesmen,   '') as asesmen,
				COALESCE(catatan_adime_gizi.diagnosis,  '') as diagnosis,
				COALESCE(catatan_adime_gizi.intervensi, '') as intervensi,
				COALESCE(catatan_adime_gizi.monitoring, '') as monitoring,
				COALESCE(catatan_adime_gizi.evaluasi,   '') as evaluasi,
				COALESCE(catatan_adime_gizi.instruksi,  '') as instruksi,
				COALESCE(catatan_adime_gizi.nip,        '') as nip,
				COALESCE(petugas.nama,                  '') as nama_petugas
			FROM catatan_adime_gizi
			LEFT JOIN petugas ON catatan_adime_gizi.nip = petugas.nip
			WHERE catatan_adime_gizi.no_rawat = ?
			ORDER BY catatan_adime_gizi.tanggal DESC`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []AdimeRow{}
		for rows.Next() {
			var r AdimeRow
			rows.Scan(&r.NoRawat, &r.Tanggal, &r.Asesmen, &r.Diagnosis,
				&r.Intervensi, &r.Monitoring, &r.Evaluasi, &r.Instruksi,
				&r.NIP, &r.NamaPetugas)
			list = append(list, r)
		}
		c.JSON(http.StatusOK, list)
	}
}

// ─── POST /api/adime ──────────────────────────────────────────────────────────

func saveAdime(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p AdimePayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if p.Tanggal == "" {
			p.Tanggal = time.Now().Format("2006-01-02 15:04:05")
		}

		var nipVal interface{}
		if p.NIP != "" {
			nipVal = p.NIP
		}
		_, err := db.Exec(`
			INSERT INTO catatan_adime_gizi
				(no_rawat, tanggal, asesmen, diagnosis, intervensi, monitoring, evaluasi, instruksi, nip)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.NoRawat, p.Tanggal, p.Asesmen, p.Diagnosis,
			p.Intervensi, p.Monitoring, p.Evaluasi, p.Instruksi, nipVal,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ADIME Gizi berhasil disimpan"})
	}
}

// ─── PUT /api/adime ───────────────────────────────────────────────────────────

func updateAdime(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p AdimePayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var nipValU interface{}
		if p.NIP != "" {
			nipValU = p.NIP
		}
		_, err := db.Exec(`
			UPDATE catatan_adime_gizi SET
				asesmen=?, diagnosis=?, intervensi=?, monitoring=?, evaluasi=?, instruksi=?, nip=?
			WHERE no_rawat=? AND DATE_FORMAT(tanggal, '%d/%m/%Y %H:%i:%s')=?`,
			p.Asesmen, p.Diagnosis, p.Intervensi, p.Monitoring, p.Evaluasi, p.Instruksi, nipValU,
			p.NoRawat, p.Tanggal,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ADIME Gizi berhasil diupdate"})
	}
}

// ─── DELETE /api/adime ────────────────────────────────────────────────────────

func deleteAdime(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		tanggal  := c.Query("tanggal")
		if noRawat == "" || tanggal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan tanggal wajib diisi"})
			return
		}
		_, err := db.Exec(
			`DELETE FROM catatan_adime_gizi WHERE no_rawat=? AND DATE_FORMAT(tanggal, '%d/%m/%Y %H:%i:%s')=?`,
			noRawat, tanggal,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ADIME Gizi berhasil dihapus"})
	}
}
