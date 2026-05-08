package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// RADIOLOGI ENDPOINT
// ============================================================================

// RadiologiPemeriksaan represents a radiology examination
type RadiologiPemeriksaan struct {
	TglPeriksa   string  `json:"tgl_periksa"`
	Jam          string  `json:"jam"`
	KdJenisPrw   string  `json:"kd_jenis_prw"`
	NmPerawatan  string  `json:"nm_perawatan"`
	NmDokter     string  `json:"nm_dokter"`
	NamaPetugas  string  `json:"nama_petugas"`
	Biaya        float64 `json:"biaya"`
	Proyeksi     string  `json:"proyeksi"` // Combined string with kV, mAS, FFD, etc.
}

// RadiologiHasil represents radiology examination results
type RadiologiHasil struct {
	TglPeriksa string `json:"tgl_periksa"`
	Jam        string `json:"jam"`
	Hasil      string `json:"hasil"`
}

// RadiologiGambar represents radiology images
type RadiologiGambar struct {
	TglPeriksa   string `json:"tgl_periksa"`
	Jam          string `json:"jam"`
	LokasiGambar string `json:"lokasi_gambar"`
}

// RadiologiResponse represents the complete radiologi data response
type RadiologiResponse struct {
	Pemeriksaan []RadiologiPemeriksaan `json:"pemeriksaan"`
	Hasil       []RadiologiHasil       `json:"hasil"`
	Gambar      []RadiologiGambar      `json:"gambar"`
}

// getRadiologi returns radiology data for a given no_rawat
func getRadiologi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := RadiologiResponse{
			Pemeriksaan: []RadiologiPemeriksaan{},
			Hasil:       []RadiologiHasil{},
			Gambar:      []RadiologiGambar{},
		}

		// ====================================================================
		// 1. GET PEMERIKSAAN RADIOLOGI
		// ====================================================================
	queryPemeriksaan := `
		SELECT 
			DATE_FORMAT(periksa_radiologi.tgl_periksa, '%d/%m/%Y') as tgl_periksa,
			TIME_FORMAT(periksa_radiologi.jam, '%H:%i:%s') as jam,
				periksa_radiologi.kd_jenis_prw,
				jns_perawatan_radiologi.nm_perawatan,
				petugas.nama,
				periksa_radiologi.biaya,
				dokter.nm_dokter,
				CONCAT(
					IF(periksa_radiologi.proyeksi<>'', CONCAT('Proyeksi : ', periksa_radiologi.proyeksi, ', '), ''),
					IF(periksa_radiologi.kV<>'', CONCAT('kV : ', periksa_radiologi.kV, ', '), ''),
					IF(periksa_radiologi.mAS<>'', CONCAT('mAS : ', periksa_radiologi.mAS, ', '), ''),
					IF(periksa_radiologi.FFD<>'', CONCAT('FFD : ', periksa_radiologi.FFD, ', '), ''),
					IF(periksa_radiologi.BSF<>'', CONCAT('BSF : ', periksa_radiologi.BSF, ', '), ''),
					IF(periksa_radiologi.inak<>'', CONCAT('Inak : ', periksa_radiologi.inak, ', '), ''),
					IF(periksa_radiologi.jml_penyinaran<>'', CONCAT('Jml Penyinaran : ', periksa_radiologi.jml_penyinaran, ', '), ''),
					IF(periksa_radiologi.dosis<>'', CONCAT('Dosis Radiasi : ', periksa_radiologi.dosis), '')
				) as proyeksi
			FROM periksa_radiologi
			INNER JOIN jns_perawatan_radiologi ON periksa_radiologi.kd_jenis_prw = jns_perawatan_radiologi.kd_jenis_prw
			INNER JOIN petugas ON periksa_radiologi.nip = petugas.nip
			INNER JOIN dokter ON periksa_radiologi.kd_dokter = dokter.kd_dokter
			WHERE periksa_radiologi.no_rawat = ?
			ORDER BY periksa_radiologi.tgl_periksa, periksa_radiologi.jam
		`

		rowsPemeriksaan, err := db.Query(queryPemeriksaan, noRawat)
		if err != nil {
			fmt.Println("Error querying pemeriksaan radiologi:", err)
		} else {
			defer rowsPemeriksaan.Close()

			for rowsPemeriksaan.Next() {
				var item RadiologiPemeriksaan
				if err := rowsPemeriksaan.Scan(
					&item.TglPeriksa,
					&item.Jam,
					&item.KdJenisPrw,
					&item.NmPerawatan,
					&item.NamaPetugas,
					&item.Biaya,
					&item.NmDokter,
					&item.Proyeksi,
				); err != nil {
					fmt.Println("Error scanning pemeriksaan radiologi:", err)
					continue
				}

				// Trim trailing comma and space from proyeksi
				item.Proyeksi = strings.TrimSuffix(strings.TrimSpace(item.Proyeksi), ",")

				response.Pemeriksaan = append(response.Pemeriksaan, item)
			}
		}

		// ====================================================================
		// 2. GET HASIL RADIOLOGI
		// ====================================================================
	queryHasil := `
		SELECT DATE_FORMAT(tgl_periksa, '%d/%m/%Y') as tgl_periksa, TIME_FORMAT(jam, '%H:%i:%s') as jam, hasil
		FROM hasil_radiologi
		WHERE no_rawat = ?
		ORDER BY tgl_periksa, jam
	`

		rowsHasil, err := db.Query(queryHasil, noRawat)
		if err != nil {
			fmt.Println("Error querying hasil radiologi:", err)
		} else {
			defer rowsHasil.Close()

			for rowsHasil.Next() {
				var item RadiologiHasil
				if err := rowsHasil.Scan(
					&item.TglPeriksa,
					&item.Jam,
					&item.Hasil,
				); err != nil {
					fmt.Println("Error scanning hasil radiologi:", err)
					continue
				}
				response.Hasil = append(response.Hasil, item)
			}
		}

		// ====================================================================
		// 3. GET GAMBAR RADIOLOGI
		// ====================================================================
	queryGambar := `
		SELECT DATE_FORMAT(tgl_periksa, '%d/%m/%Y') as tgl_periksa, TIME_FORMAT(jam, '%H:%i:%s') as jam, lokasi_gambar
		FROM gambar_radiologi
		WHERE no_rawat = ?
		ORDER BY tgl_periksa, jam
	`

		rowsGambar, err := db.Query(queryGambar, noRawat)
		if err != nil {
			fmt.Println("Error querying gambar radiologi:", err)
		} else {
			defer rowsGambar.Close()

			for rowsGambar.Next() {
				var item RadiologiGambar
				if err := rowsGambar.Scan(
					&item.TglPeriksa,
					&item.Jam,
					&item.LokasiGambar,
				); err != nil {
					fmt.Println("Error scanning gambar radiologi:", err)
					continue
				}
				response.Gambar = append(response.Gambar, item)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

