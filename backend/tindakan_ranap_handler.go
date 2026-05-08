package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// TINDAKAN RAWAT INAP ENDPOINT
// ============================================================================

// TindakanRanapDokter represents tindakan rawat inap by doctor
type TindakanRanapDokter struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	JamRawat     string  `json:"jam_rawat"`
	KdJenisPrw   string  `json:"kd_jenis_prw"`
	NmPerawatan  string  `json:"nm_perawatan"`
	NmDokter     string  `json:"nm_dokter"`
	BiayaRawat   float64 `json:"biaya_rawat"`
}

// TindakanRanapParamedis represents tindakan rawat inap by paramedis
type TindakanRanapParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRanapDokterParamedis represents tindakan rawat inap by doctor and paramedis
type TindakanRanapDokterParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	NmDokter      string  `json:"nm_dokter"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRanapResponse represents the complete tindakan rawat inap data response
type TindakanRanapResponse struct {
	TindakanDokter          []TindakanRanapDokter          `json:"tindakan_dokter"`
	TindakanParamedis       []TindakanRanapParamedis       `json:"tindakan_paramedis"`
	TindakanDokterParamedis []TindakanRanapDokterParamedis `json:"tindakan_dokter_paramedis"`
}

// getTindakanRanap returns tindakan rawat inap data for a given no_rawat
func getTindakanRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := TindakanRanapResponse{
			TindakanDokter:          []TindakanRanapDokter{},
			TindakanParamedis:       []TindakanRanapParamedis{},
			TindakanDokterParamedis: []TindakanRanapDokterParamedis{},
		}

		// ====================================================================
		// 1. GET TINDAKAN RAWAT INAP DOKTER
		// ====================================================================
	queryDokter := `
		SELECT 
			DATE_FORMAT(rawat_inap_dr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_dr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_dr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				dokter.nm_dokter,
				rawat_inap_dr.biaya_rawat
			FROM rawat_inap_dr
			INNER JOIN jns_perawatan_inap ON rawat_inap_dr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN dokter ON rawat_inap_dr.kd_dokter = dokter.kd_dokter
			WHERE rawat_inap_dr.no_rawat = ?
			ORDER BY rawat_inap_dr.tgl_perawatan, rawat_inap_dr.jam_rawat
		`

		rowsDokter, err := db.Query(queryDokter, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap dokter:", err)
		} else {
			defer rowsDokter.Close()

			for rowsDokter.Next() {
				var item TindakanRanapDokter
				if err := rowsDokter.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.NmDokter,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap dokter:", err)
					continue
				}
				response.TindakanDokter = append(response.TindakanDokter, item)
			}
		}

		// ====================================================================
		// 2. GET TINDAKAN RAWAT INAP PARAMEDIS
		// ====================================================================
	queryParamedis := `
		SELECT 
			DATE_FORMAT(rawat_inap_pr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_pr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_pr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				petugas.nama,
				rawat_inap_pr.biaya_rawat
			FROM rawat_inap_pr
			INNER JOIN jns_perawatan_inap ON rawat_inap_pr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN petugas ON rawat_inap_pr.nip = petugas.nip
			WHERE rawat_inap_pr.no_rawat = ?
			ORDER BY rawat_inap_pr.tgl_perawatan, rawat_inap_pr.jam_rawat
		`

		rowsParamedis, err := db.Query(queryParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap paramedis:", err)
		} else {
			defer rowsParamedis.Close()

			for rowsParamedis.Next() {
				var item TindakanRanapParamedis
				if err := rowsParamedis.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.NamaParamedis,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap paramedis:", err)
					continue
				}
				response.TindakanParamedis = append(response.TindakanParamedis, item)
			}
		}

		// ====================================================================
		// 3. GET TINDAKAN RAWAT INAP DOKTER & PARAMEDIS
		// ====================================================================
	queryDokterParamedis := `
		SELECT 
			DATE_FORMAT(rawat_inap_drpr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_inap_drpr.jam_rawat, '%H:%i:%s') as jam_rawat,
				rawat_inap_drpr.kd_jenis_prw,
				jns_perawatan_inap.nm_perawatan,
				dokter.nm_dokter,
				petugas.nama,
				rawat_inap_drpr.biaya_rawat
			FROM rawat_inap_drpr
			INNER JOIN jns_perawatan_inap ON rawat_inap_drpr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
			INNER JOIN dokter ON rawat_inap_drpr.kd_dokter = dokter.kd_dokter
			INNER JOIN petugas ON rawat_inap_drpr.nip = petugas.nip
			WHERE rawat_inap_drpr.no_rawat = ?
			ORDER BY rawat_inap_drpr.tgl_perawatan, rawat_inap_drpr.jam_rawat
		`

		rowsDokterParamedis, err := db.Query(queryDokterParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ranap dokter paramedis:", err)
		} else {
			defer rowsDokterParamedis.Close()

			for rowsDokterParamedis.Next() {
				var item TindakanRanapDokterParamedis
				if err := rowsDokterParamedis.Scan(
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.NmDokter,
					&item.NamaParamedis,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ranap dokter paramedis:", err)
					continue
				}
				response.TindakanDokterParamedis = append(response.TindakanDokterParamedis, item)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

