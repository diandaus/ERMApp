package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BIAYA ENDPOINT
// ============================================================================

// TambahanBiaya represents additional charges
type TambahanBiaya struct {
	NamaBiaya  string  `json:"nama_biaya"`
	BesarBiaya float64 `json:"besar_biaya"`
}

// PotonganBiaya represents discounts
type PotonganBiaya struct {
	NamaPengurangan  string  `json:"nama_pengurangan"`
	BesarPengurangan float64 `json:"besar_pengurangan"`
}

// BiayaResponse represents the complete biaya data response
type BiayaResponse struct {
	PPNObat         float64           `json:"ppn_obat"`
	TambahanBiaya   []TambahanBiaya   `json:"tambahan_biaya"`
	PotonganBiaya   []PotonganBiaya   `json:"potongan_biaya"`
	TotalBiaya      float64           `json:"total_biaya"`
}

// getBiaya returns biaya summary data for a given no_rawat
func getBiaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := BiayaResponse{
			PPNObat:       0,
			TambahanBiaya: []TambahanBiaya{},
			PotonganBiaya: []PotonganBiaya{},
			TotalBiaya:    0,
		}

		// ====================================================================
		// 1. GET PPN OBAT
		// ====================================================================
		var ppnObat sql.NullFloat64
		queryPPN := `
			SELECT totalbiaya 
			FROM billing 
			WHERE nm_perawatan = 'PPN Obat' 
				AND status = 'Obat' 
				AND no_rawat = ?
		`
		err := db.QueryRow(queryPPN, noRawat).Scan(&ppnObat)
		if err == nil && ppnObat.Valid {
			response.PPNObat = ppnObat.Float64
		}

		// ====================================================================
		// 2. GET TAMBAHAN BIAYA
		// ====================================================================
		queryTambahan := `
			SELECT nama_biaya, besar_biaya 
			FROM tambahan_biaya 
			WHERE no_rawat = ?
			ORDER BY nama_biaya
		`

		rowsTambahan, err := db.Query(queryTambahan, noRawat)
		if err != nil {
			fmt.Println("Error querying tambahan biaya:", err)
		} else {
			defer rowsTambahan.Close()

			for rowsTambahan.Next() {
				var item TambahanBiaya
				if err := rowsTambahan.Scan(&item.NamaBiaya, &item.BesarBiaya); err != nil {
					fmt.Println("Error scanning tambahan biaya:", err)
					continue
				}
				response.TambahanBiaya = append(response.TambahanBiaya, item)
			}
		}

		// ====================================================================
		// 3. GET POTONGAN BIAYA
		// ====================================================================
		queryPotongan := `
			SELECT nama_pengurangan, (-1 * besar_pengurangan) as besar_pengurangan
			FROM pengurangan_biaya 
			WHERE no_rawat = ?
			ORDER BY nama_pengurangan
		`

		rowsPotongan, err := db.Query(queryPotongan, noRawat)
		if err != nil {
			fmt.Println("Error querying potongan biaya:", err)
		} else {
			defer rowsPotongan.Close()

			for rowsPotongan.Next() {
				var item PotonganBiaya
				if err := rowsPotongan.Scan(&item.NamaPengurangan, &item.BesarPengurangan); err != nil {
					fmt.Println("Error scanning potongan biaya:", err)
					continue
				}
				response.PotonganBiaya = append(response.PotonganBiaya, item)
			}
		}

		// ====================================================================
		// 4. CALCULATE TOTAL BIAYA
		// Note: Total biaya should be calculated from all billing items
		// This is a simplified version - you may need to adjust based on your requirements
		// ====================================================================
		var totalBiaya sql.NullFloat64
		queryTotal := `
			SELECT SUM(totalbiaya) as total
			FROM billing
			WHERE no_rawat = ?
		`
		err = db.QueryRow(queryTotal, noRawat).Scan(&totalBiaya)
		if err == nil && totalBiaya.Valid {
			response.TotalBiaya = totalBiaya.Float64
		}

		// Add tambahan biaya to total
		for _, item := range response.TambahanBiaya {
			response.TotalBiaya += item.BesarBiaya
		}

		// Add potongan biaya (already negative) to total
		for _, item := range response.PotonganBiaya {
			response.TotalBiaya += item.BesarPengurangan
		}

		c.JSON(http.StatusOK, response)
	}
}

