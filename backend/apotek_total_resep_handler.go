package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Total Resep (StatCard baru di bawah "Lama Pelayanan Apotek",
// DashboardApotek.tsx). Menghitung jumlah resep (resep_obat, per no_resep)
// yang diinput dalam rentang tanggal (tgl_peresepan), dipecah per
// Rawat Jalan/Rawat Inap (resep_obat.status) dan per cara bayar
// (reg_periksa.kd_pj -> penjab.png_jawab). TIDAK mensyaratkan resep sudah
// divalidasi/diserahkan (beda dari apotek_lama_pelayanan_handler.go) —
// ini murni hitung jumlah resep masuk, bukan durasi pelayanan.
// ============================================================================

type totalResepCaraBayar struct {
	CaraBayar string `json:"cara_bayar"`
	Jml       int    `json:"jml"`
}

type totalResepGroup struct {
	Total        int                   `json:"total"`
	PerCaraBayar []totalResepCaraBayar `json:"per_cara_bayar"`
}

type totalResepResponse struct {
	Ralan totalResepGroup `json:"ralan"`
	Ranap totalResepGroup `json:"ranap"`
}

// GET /api/apotek/total-resep?tgl1=YYYY-MM-DD&tgl2=YYYY-MM-DD
func getApotekTotalResep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}

		rows, err := db.Query(`
			SELECT resep_obat.status, penjab.png_jawab, COUNT(DISTINCT resep_obat.no_resep) AS jml
			FROM resep_obat
			INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			WHERE resep_obat.tgl_peresepan <> '0000-00-00'
				AND resep_obat.tgl_peresepan BETWEEN ? AND ?
			GROUP BY resep_obat.status, penjab.png_jawab
			ORDER BY resep_obat.status, jml DESC
		`, tgl1, tgl2)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var resp totalResepResponse
		for rows.Next() {
			var status, caraBayar string
			var jml int
			if rows.Scan(&status, &caraBayar, &jml) != nil {
				continue
			}
			item := totalResepCaraBayar{CaraBayar: caraBayar, Jml: jml}
			if status == "ranap" {
				resp.Ranap.Total += jml
				resp.Ranap.PerCaraBayar = append(resp.Ranap.PerCaraBayar, item)
			} else {
				resp.Ralan.Total += jml
				resp.Ralan.PerCaraBayar = append(resp.Ralan.PerCaraBayar, item)
			}
		}
		if resp.Ralan.PerCaraBayar == nil {
			resp.Ralan.PerCaraBayar = []totalResepCaraBayar{}
		}
		if resp.Ranap.PerCaraBayar == nil {
			resp.Ranap.PerCaraBayar = []totalResepCaraBayar{}
		}

		c.JSON(http.StatusOK, resp)
	}
}
