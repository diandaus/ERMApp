package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KAMAR INAP ENDPOINT
// ============================================================================

// KamarInap represents room usage data
type KamarInap struct {
	KdKamar    string  `json:"kd_kamar"`
	NmBangsal  string  `json:"nm_bangsal"`
	TglMasuk   string  `json:"tgl_masuk"`
	TglKeluar  string  `json:"tgl_keluar"`
	SttsPulang string  `json:"stts_pulang"`
	Lama       int     `json:"lama"`
	JamMasuk   string  `json:"jam_masuk"`
	JamKeluar  string  `json:"jam_keluar"`
	TtlBiaya   float64 `json:"ttl_biaya"`
}

// getKamarInap returns kamar inap data for a given no_rawat
func getKamarInap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

	query := `
		SELECT 
			kamar_inap.kd_kamar,
			bangsal.nm_bangsal,
			DATE_FORMAT(kamar_inap.tgl_masuk, '%d/%m/%Y') as tgl_masuk,
			DATE_FORMAT(kamar_inap.tgl_keluar, '%d/%m/%Y') as tgl_keluar,
			kamar_inap.stts_pulang,
			kamar_inap.lama,
			TIME_FORMAT(kamar_inap.jam_masuk, '%H:%i:%s') as jam_masuk,
			TIME_FORMAT(kamar_inap.jam_keluar, '%H:%i:%s') as jam_keluar,
				kamar_inap.ttl_biaya
			FROM kamar_inap
			INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
			INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			WHERE kamar_inap.no_rawat = ?
			ORDER BY kamar_inap.tgl_masuk, kamar_inap.jam_masuk
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var kamarList []KamarInap
		for rows.Next() {
			var item KamarInap
			if err := rows.Scan(
				&item.KdKamar,
				&item.NmBangsal,
				&item.TglMasuk,
				&item.TglKeluar,
				&item.SttsPulang,
				&item.Lama,
				&item.JamMasuk,
				&item.JamKeluar,
				&item.TtlBiaya,
			); err != nil {
				fmt.Println("Error scanning kamar inap:", err)
				continue
			}
			kamarList = append(kamarList, item)
		}

		if len(kamarList) == 0 {
			c.JSON(http.StatusOK, []KamarInap{})
			return
		}

		c.JSON(http.StatusOK, kamarList)
	}
}

