package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// TINDAKAN RAWAT JALAN ENDPOINT
// ============================================================================

// TindakanRalanDokter represents tindakan rawat jalan by doctor
type TindakanRalanDokter struct {
	NoRawat         string  `json:"no_rawat"`
	TglPerawatan    string  `json:"tgl_perawatan"`
	JamRawat        string  `json:"jam_rawat"`
	KdJenisPrw      string  `json:"kd_jenis_prw"`
	NmPerawatan     string  `json:"nm_perawatan"`
	KdDokter        string  `json:"kd_dokter"`
	NmDokter        string  `json:"nm_dokter"`
	Material        float64 `json:"material"`
	BHP             float64 `json:"bhp"`
	TarifTindakanDr float64 `json:"tarif_tindakandr"`
	KSO             float64 `json:"kso"`
	Menejemen       float64 `json:"menejemen"`
	BiayaRawat      float64 `json:"biaya_rawat"`
}

// TindakanRalanParamedis represents tindakan rawat jalan by paramedis
type TindakanRalanParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	Nip           string  `json:"nip"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRalanDokterParamedis represents tindakan rawat jalan by doctor and paramedis
type TindakanRalanDokterParamedis struct {
	TglPerawatan  string  `json:"tgl_perawatan"`
	JamRawat      string  `json:"jam_rawat"`
	KdJenisPrw    string  `json:"kd_jenis_prw"`
	NmPerawatan   string  `json:"nm_perawatan"`
	KdDokter      string  `json:"kd_dokter"`
	NmDokter      string  `json:"nm_dokter"`
	Nip           string  `json:"nip"`
	NamaParamedis string  `json:"nama_paramedis"`
	BiayaRawat    float64 `json:"biaya_rawat"`
}

// TindakanRalanResponse represents the complete tindakan rawat jalan data response
type TindakanRalanResponse struct {
	TindakanDokter          []TindakanRalanDokter          `json:"tindakan_dokter"`
	TindakanParamedis       []TindakanRalanParamedis       `json:"tindakan_paramedis"`
	TindakanDokterParamedis []TindakanRalanDokterParamedis `json:"tindakan_dokter_paramedis"`
}

// getTindakanRalan returns tindakan rawat jalan data for a given no_rawat
func getTindakanRalan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := TindakanRalanResponse{
			TindakanDokter:          []TindakanRalanDokter{},
			TindakanParamedis:       []TindakanRalanParamedis{},
			TindakanDokterParamedis: []TindakanRalanDokterParamedis{},
		}

		// ====================================================================
		// 1. GET TINDAKAN RAWAT JALAN DOKTER
		// ====================================================================
	queryDokter := `
		SELECT
			rawat_jl_dr.no_rawat,
			rawat_jl_dr.tgl_perawatan,
			rawat_jl_dr.jam_rawat,
			rawat_jl_dr.kd_jenis_prw,
			jns_perawatan.nm_perawatan,
			rawat_jl_dr.kd_dokter,
			dokter.nm_dokter,
			rawat_jl_dr.material,
			rawat_jl_dr.bhp,
			rawat_jl_dr.tarif_tindakandr,
			rawat_jl_dr.kso,
			rawat_jl_dr.menejemen,
			rawat_jl_dr.biaya_rawat
			FROM rawat_jl_dr
			INNER JOIN jns_perawatan ON rawat_jl_dr.kd_jenis_prw = jns_perawatan.kd_jenis_prw
			INNER JOIN dokter ON rawat_jl_dr.kd_dokter = dokter.kd_dokter
			WHERE rawat_jl_dr.no_rawat = ?
			ORDER BY rawat_jl_dr.tgl_perawatan DESC, rawat_jl_dr.jam_rawat DESC
		`

		rowsDokter, err := db.Query(queryDokter, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ralan dokter:", err)
		} else {
			defer rowsDokter.Close()

			for rowsDokter.Next() {
				var item TindakanRalanDokter
				if err := rowsDokter.Scan(
					&item.NoRawat,
					&item.TglPerawatan,
					&item.JamRawat,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.KdDokter,
					&item.NmDokter,
					&item.Material,
					&item.BHP,
					&item.TarifTindakanDr,
					&item.KSO,
					&item.Menejemen,
					&item.BiayaRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ralan dokter:", err)
					continue
				}
				response.TindakanDokter = append(response.TindakanDokter, item)
			}
		}

		// ====================================================================
		// 2. GET TINDAKAN RAWAT JALAN PARAMEDIS
		// ====================================================================
	queryParamedis := `
		SELECT 
			rawat_jl_pr.kd_jenis_prw,
			jns_perawatan.nm_perawatan,
			petugas.nip,
			petugas.nama,
			rawat_jl_pr.biaya_rawat,
			DATE_FORMAT(rawat_jl_pr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_jl_pr.jam_rawat, '%H:%i:%s') as jam_rawat
			FROM rawat_jl_pr
			INNER JOIN jns_perawatan ON rawat_jl_pr.kd_jenis_prw = jns_perawatan.kd_jenis_prw
			INNER JOIN petugas ON rawat_jl_pr.nip = petugas.nip
			WHERE rawat_jl_pr.no_rawat = ?
			ORDER BY rawat_jl_pr.tgl_perawatan, rawat_jl_pr.jam_rawat
		`

		rowsParamedis, err := db.Query(queryParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ralan paramedis:", err)
		} else {
			defer rowsParamedis.Close()

			for rowsParamedis.Next() {
				var item TindakanRalanParamedis
				if err := rowsParamedis.Scan(
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.Nip,
					&item.NamaParamedis,
					&item.BiayaRawat,
					&item.TglPerawatan,
					&item.JamRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ralan paramedis:", err)
					continue
				}
				response.TindakanParamedis = append(response.TindakanParamedis, item)
			}
		}

		// ====================================================================
		// 3. GET TINDAKAN RAWAT JALAN DOKTER & PARAMEDIS
		// ====================================================================
	queryDokterParamedis := `
		SELECT 
			rawat_jl_drpr.kd_jenis_prw,
			jns_perawatan.nm_perawatan,
			rawat_jl_drpr.kd_dokter,
			dokter.nm_dokter,
			petugas.nip,
			petugas.nama,
			rawat_jl_drpr.biaya_rawat,
			DATE_FORMAT(rawat_jl_drpr.tgl_perawatan, '%d/%m/%Y') as tgl_perawatan,
			TIME_FORMAT(rawat_jl_drpr.jam_rawat, '%H:%i:%s') as jam_rawat
			FROM rawat_jl_drpr
			INNER JOIN jns_perawatan ON rawat_jl_drpr.kd_jenis_prw = jns_perawatan.kd_jenis_prw
			INNER JOIN dokter ON rawat_jl_drpr.kd_dokter = dokter.kd_dokter
			INNER JOIN petugas ON rawat_jl_drpr.nip = petugas.nip
			WHERE rawat_jl_drpr.no_rawat = ?
			ORDER BY rawat_jl_drpr.tgl_perawatan, rawat_jl_drpr.jam_rawat
		`

		rowsDokterParamedis, err := db.Query(queryDokterParamedis, noRawat)
		if err != nil {
			fmt.Println("Error querying tindakan ralan dokter paramedis:", err)
		} else {
			defer rowsDokterParamedis.Close()

			for rowsDokterParamedis.Next() {
				var item TindakanRalanDokterParamedis
				if err := rowsDokterParamedis.Scan(
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.KdDokter,
					&item.NmDokter,
					&item.Nip,
					&item.NamaParamedis,
					&item.BiayaRawat,
					&item.TglPerawatan,
					&item.JamRawat,
				); err != nil {
					fmt.Println("Error scanning tindakan ralan dokter paramedis:", err)
					continue
				}
				response.TindakanDokterParamedis = append(response.TindakanDokterParamedis, item)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

