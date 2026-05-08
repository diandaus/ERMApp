package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PEMBERIAN OBAT ENDPOINT
// ============================================================================

// PemberianObat represents medication given to patient
type PemberianObat struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	Jam          string  `json:"jam"`
	KodeBrng     string  `json:"kode_brng"`
	NamaBrng     string  `json:"nama_brng"`
	Jml          float64 `json:"jml"`
	KodeSat      string  `json:"kode_sat"`
	AturanPakai  string  `json:"aturan_pakai"`
	Total        float64 `json:"total"`
}

// ReturObat represents returned medication
type ReturObat struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Jumlah   float64 `json:"jumlah"`
	Total    float64 `json:"total"`
}

// ObatResponse represents the complete obat data response
type ObatResponse struct {
	PemberianObat []PemberianObat `json:"pemberian_obat"`
	ReturObat     []ReturObat     `json:"retur_obat"`
}

// getObat returns pemberian obat and retur obat data for a given no_rawat
func getObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := ObatResponse{
			PemberianObat: []PemberianObat{},
			ReturObat:     []ReturObat{},
		}

		// ====================================================================
		// 1. GET PEMBERIAN OBAT
		// ====================================================================
	queryPemberian := `
		SELECT 
			DATE_FORMAT(detail_pemberian_obat.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(detail_pemberian_obat.jam, '%H:%i:%s') as jam,
				databarang.kode_sat,
				detail_pemberian_obat.kode_brng,
				detail_pemberian_obat.jml,
				detail_pemberian_obat.total,
				databarang.nama_brng
			FROM detail_pemberian_obat
			INNER JOIN databarang ON detail_pemberian_obat.kode_brng = databarang.kode_brng
			WHERE detail_pemberian_obat.no_rawat = ?
			ORDER BY detail_pemberian_obat.tgl_perawatan, detail_pemberian_obat.jam
		`

		rowsPemberian, err := db.Query(queryPemberian, noRawat)
		if err != nil {
			fmt.Println("Error querying pemberian obat:", err)
		} else {
			defer rowsPemberian.Close()

			for rowsPemberian.Next() {
				var item PemberianObat
				if err := rowsPemberian.Scan(
					&item.TglPerawatan,
					&item.Jam,
					&item.KodeSat,
					&item.KodeBrng,
					&item.Jml,
					&item.Total,
					&item.NamaBrng,
				); err != nil {
					fmt.Println("Error scanning pemberian obat:", err)
					continue
				}

				// Get aturan pakai for this item
				var aturan sql.NullString
				queryAturan := `
					SELECT aturan 
					FROM aturan_pakai 
					WHERE tgl_perawatan = ? 
						AND jam = ? 
						AND no_rawat = ? 
						AND kode_brng = ?
				`
				err := db.QueryRow(queryAturan, item.TglPerawatan, item.Jam, noRawat, item.KodeBrng).Scan(&aturan)
				if err == nil && aturan.Valid {
					item.AturanPakai = aturan.String
				} else {
					item.AturanPakai = ""
				}

				response.PemberianObat = append(response.PemberianObat, item)
			}
		}

		// ====================================================================
		// 2. GET RETUR OBAT
		// ====================================================================
		queryRetur := `
			SELECT 
				databarang.kode_brng,
				databarang.nama_brng,
				detreturjual.kode_sat,
				(detreturjual.jml_retur * -1) as jumlah,
				(detreturjual.subtotal * -1) as total
			FROM detreturjual
			INNER JOIN databarang ON detreturjual.kode_brng = databarang.kode_brng
			INNER JOIN returjual ON returjual.no_retur_jual = detreturjual.no_retur_jual
			WHERE returjual.no_retur_jual LIKE ?
			ORDER BY databarang.nama_brng
		`

		rowsRetur, err := db.Query(queryRetur, "%"+noRawat+"%")
		if err != nil {
			fmt.Println("Error querying retur obat:", err)
		} else {
			defer rowsRetur.Close()

			for rowsRetur.Next() {
				var item ReturObat
				if err := rowsRetur.Scan(
					&item.KodeBrng,
					&item.NamaBrng,
					&item.KodeSat,
					&item.Jumlah,
					&item.Total,
				); err != nil {
					fmt.Println("Error scanning retur obat:", err)
					continue
				}
				response.ReturObat = append(response.ReturObat, item)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}
