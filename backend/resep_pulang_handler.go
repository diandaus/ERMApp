package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// RESEP PULANG ENDPOINT
// ============================================================================

// ResepPulang represents prescription given when patient is discharged
type ResepPulang struct {
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	Dosis      string  `json:"dosis"`
	JmlBarang  float64 `json:"jml_barang"`
	KodeSat    string  `json:"kode_sat"`
	Total      float64 `json:"total"`
}

// getResepPulang returns resep pulang data for a given no_rawat
func getResepPulang(db *sql.DB) gin.HandlerFunc {
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
				resep_pulang.kode_brng,
				databarang.nama_brng,
				resep_pulang.dosis,
				resep_pulang.jml_barang,
				databarang.kode_sat,
				resep_pulang.total
			FROM resep_pulang
			INNER JOIN databarang ON resep_pulang.kode_brng = databarang.kode_brng
			WHERE resep_pulang.no_rawat = ?
			ORDER BY databarang.nama_brng
		`

		rows, err := db.Query(query, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var resepList []ResepPulang
		for rows.Next() {
			var item ResepPulang
			if err := rows.Scan(
				&item.KodeBrng,
				&item.NamaBrng,
				&item.Dosis,
				&item.JmlBarang,
				&item.KodeSat,
				&item.Total,
			); err != nil {
				fmt.Println("Error scanning resep pulang:", err)
				continue
			}
			resepList = append(resepList, item)
		}

		if len(resepList) == 0 {
			c.JSON(http.StatusOK, []ResepPulang{})
			return
		}

		c.JSON(http.StatusOK, resepList)
	}
}

