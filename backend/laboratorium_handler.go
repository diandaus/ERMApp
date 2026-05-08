package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// LABORATORIUM ENDPOINT
// ============================================================================

// LabItem represents a single lab examination item
type LabItem struct {
	KdJenisPrw   string             `json:"kd_jenis_prw"`
	NmPerawatan  string             `json:"nm_perawatan"`
	NmDokter     string             `json:"nm_dokter"`
	NamaPetugas  string             `json:"nama_petugas"`
	Biaya        float64            `json:"biaya"`
	DetailItems  []LabDetailItem    `json:"detail_items,omitempty"`
	Kesan        string             `json:"kesan,omitempty"`
	Saran        string             `json:"saran,omitempty"`
}

// LabDetailItem represents detail item within a lab examination
type LabDetailItem struct {
	Pemeriksaan   string  `json:"pemeriksaan"`
	Nilai         string  `json:"nilai"`
	Satuan        string  `json:"satuan"`
	NilaiRujukan  string  `json:"nilai_rujukan"`
	BiayaItem     float64 `json:"biaya_item"`
	Keterangan    string  `json:"keterangan"` // "L" = Low (blue), "H" = High (red), "T" = Title (bold), "" = normal
}

// LabGroup represents a group of lab examinations at a specific date/time
type LabGroup struct {
	TglPeriksa    string    `json:"tgl_periksa"`
	Jam           string    `json:"jam"`
	Items         []LabItem `json:"items"`
	TglPeriksaRaw string    `json:"-"` // Raw date for internal queries
	JamRaw        string    `json:"-"` // Raw time for internal queries
}

// LabPAItem represents a PA (Pathology Anatomy) examination
type LabPAItem struct {
	TglPeriksa      string  `json:"tgl_periksa"`
	Jam             string  `json:"jam"`
	KdJenisPrw      string  `json:"kd_jenis_prw"`
	NmPerawatan     string  `json:"nm_perawatan"`
	NmDokter        string  `json:"nm_dokter"`
	NamaPetugas     string  `json:"nama_petugas"`
	Biaya           float64 `json:"biaya"`
	DiagnosaKlinik  string  `json:"diagnosa_klinik,omitempty"`
	Makroskopik     string  `json:"makroskopik,omitempty"`
	Mikroskopik     string  `json:"mikroskopik,omitempty"`
	Kesimpulan      string  `json:"kesimpulan,omitempty"`
	Kesan           string  `json:"kesan,omitempty"`
	Photo           string  `json:"photo,omitempty"`
	TglPeriksaRaw   string  `json:"-"` // Raw date for internal queries
	JamRaw          string  `json:"-"` // Raw time for internal queries
}

// LabResponse represents the complete lab data response
type LabResponse struct {
	LabPKMB []LabGroup  `json:"lab_pkmb"` // PK & MB (non-PA)
	LabPA   []LabPAItem `json:"lab_pa"`   // PA
}

// getLaboratorium returns lab data for a given no_rawat
func getLaboratorium(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		response := LabResponse{
			LabPKMB: []LabGroup{},
			LabPA:   []LabPAItem{},
		}

		// ====================================================================
		// 1. GET LAB PK & MB (non-PA)
		// ====================================================================
	queryGroups := `
		SELECT 
			tgl_periksa,
			jam,
			DATE_FORMAT(tgl_periksa, '%d/%m/%Y') as tgl_periksa_fmt,
			TIME_FORMAT(jam, '%H:%i:%s') as jam_fmt
		FROM periksa_lab 
		WHERE kategori <> 'PA' AND no_rawat = ?
		GROUP BY CONCAT(no_rawat, tgl_periksa, jam)
		ORDER BY tgl_periksa, jam
	`

	rowsGroups, err := db.Query(queryGroups, noRawat)
	if err != nil {
		fmt.Println("Error querying lab groups:", err)
	} else {
		defer rowsGroups.Close()

		for rowsGroups.Next() {
			var group LabGroup
			if err := rowsGroups.Scan(&group.TglPeriksaRaw, &group.JamRaw, &group.TglPeriksa, &group.Jam); err != nil {
				fmt.Println("Error scanning lab group:", err)
				continue
			}

				// Get items for this group
				queryItems := `
					SELECT 
						periksa_lab.kd_jenis_prw,
						jns_perawatan_lab.nm_perawatan,
						petugas.nama,
						periksa_lab.biaya,
						dokter.nm_dokter
					FROM periksa_lab
					INNER JOIN jns_perawatan_lab ON periksa_lab.kd_jenis_prw = jns_perawatan_lab.kd_jenis_prw
					INNER JOIN petugas ON periksa_lab.nip = petugas.nip
					INNER JOIN dokter ON periksa_lab.kd_dokter = dokter.kd_dokter
					WHERE periksa_lab.kategori <> 'PA' 
						AND periksa_lab.no_rawat = ?
						AND periksa_lab.tgl_periksa = ?
						AND periksa_lab.jam = ?
				`

				rowsItems, err := db.Query(queryItems, noRawat, group.TglPeriksaRaw, group.JamRaw)
				if err != nil {
					fmt.Println("Error querying lab items:", err)
					continue
				}

				for rowsItems.Next() {
					var item LabItem
					if err := rowsItems.Scan(
						&item.KdJenisPrw,
						&item.NmPerawatan,
						&item.NamaPetugas,
						&item.Biaya,
						&item.NmDokter,
					); err != nil {
						fmt.Println("Error scanning lab item:", err)
						continue
					}

					// Get detail items
					queryDetails := `
						SELECT 
							template_laboratorium.Pemeriksaan,
							detail_periksa_lab.nilai,
							template_laboratorium.satuan,
							detail_periksa_lab.nilai_rujukan,
							detail_periksa_lab.biaya_item,
							detail_periksa_lab.keterangan
						FROM detail_periksa_lab
						INNER JOIN template_laboratorium ON detail_periksa_lab.id_template = template_laboratorium.id_template
						WHERE detail_periksa_lab.no_rawat = ?
							AND detail_periksa_lab.kd_jenis_prw = ?
							AND detail_periksa_lab.tgl_periksa = ?
							AND detail_periksa_lab.jam = ?
						ORDER BY detail_periksa_lab.kd_jenis_prw, template_laboratorium.urut
					`

					rowsDetails, err := db.Query(queryDetails, noRawat, item.KdJenisPrw, group.TglPeriksaRaw, group.JamRaw)
					if err != nil {
						fmt.Println("Error querying lab details:", err)
					} else {
						for rowsDetails.Next() {
							var detail LabDetailItem
							if err := rowsDetails.Scan(
								&detail.Pemeriksaan,
								&detail.Nilai,
								&detail.Satuan,
								&detail.NilaiRujukan,
								&detail.BiayaItem,
								&detail.Keterangan,
							); err != nil {
								fmt.Println("Error scanning lab detail:", err)
								continue
							}
							item.DetailItems = append(item.DetailItems, detail)
						}
						rowsDetails.Close()
					}

					group.Items = append(group.Items, item)
				}
				rowsItems.Close()

				// Get kesan & saran for this group
				var kesan, saran sql.NullString
				queryKesanSaran := `
					SELECT saran, kesan 
					FROM saran_kesan_lab 
					WHERE no_rawat = ? AND tgl_periksa = ? AND jam = ?
				`
				err = db.QueryRow(queryKesanSaran, noRawat, group.TglPeriksaRaw, group.JamRaw).Scan(&saran, &kesan)
				if err == nil {
					// Add kesan & saran to the last item in the group
					if len(group.Items) > 0 {
						lastIdx := len(group.Items) - 1
						if kesan.Valid {
							group.Items[lastIdx].Kesan = kesan.String
						}
						if saran.Valid {
							group.Items[lastIdx].Saran = saran.String
						}
					}
				}

				response.LabPKMB = append(response.LabPKMB, group)
			}
		}

		// ====================================================================
		// 2. GET LAB PA
		// ====================================================================
	queryPA := `
		SELECT 
			periksa_lab.tgl_periksa,
			periksa_lab.jam,
			DATE_FORMAT(periksa_lab.tgl_periksa, '%d/%m/%Y') as tgl_periksa_fmt,
			TIME_FORMAT(periksa_lab.jam, '%H:%i:%s') as jam_fmt,
			periksa_lab.kd_jenis_prw,
			jns_perawatan_lab.nm_perawatan,
			petugas.nama,
			periksa_lab.biaya,
			dokter.nm_dokter
		FROM periksa_lab
		INNER JOIN jns_perawatan_lab ON periksa_lab.kd_jenis_prw = jns_perawatan_lab.kd_jenis_prw
		INNER JOIN petugas ON periksa_lab.nip = petugas.nip
		INNER JOIN dokter ON periksa_lab.kd_dokter = dokter.kd_dokter
		WHERE periksa_lab.kategori = 'PA' AND periksa_lab.no_rawat = ?
		ORDER BY periksa_lab.tgl_periksa, periksa_lab.jam
	`

	rowsPA, err := db.Query(queryPA, noRawat)
	if err != nil {
		fmt.Println("Error querying lab PA:", err)
	} else {
		defer rowsPA.Close()

		for rowsPA.Next() {
			var paItem LabPAItem
			if err := rowsPA.Scan(
				&paItem.TglPeriksaRaw,
				&paItem.JamRaw,
				&paItem.TglPeriksa,
				&paItem.Jam,
					&paItem.KdJenisPrw,
					&paItem.NmPerawatan,
					&paItem.NamaPetugas,
					&paItem.Biaya,
					&paItem.NmDokter,
				); err != nil {
					fmt.Println("Error scanning lab PA:", err)
					continue
				}

				// Get PA details
				var diagnosa, makro, mikro, kesimpulan, kesan sql.NullString
				queryPADetail := `
					SELECT diagnosa_klinik, makroskopik, mikroskopik, kesimpulan, kesan
					FROM detail_periksa_labpa
					WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_periksa = ? AND jam = ?
				`
				err := db.QueryRow(queryPADetail, noRawat, paItem.KdJenisPrw, paItem.TglPeriksaRaw, paItem.JamRaw).Scan(
					&diagnosa, &makro, &mikro, &kesimpulan, &kesan,
				)
				if err == nil {
					if diagnosa.Valid {
						paItem.DiagnosaKlinik = diagnosa.String
					}
					if makro.Valid {
						paItem.Makroskopik = makro.String
					}
					if mikro.Valid {
						paItem.Mikroskopik = mikro.String
					}
					if kesimpulan.Valid {
						paItem.Kesimpulan = kesimpulan.String
					}
					if kesan.Valid {
						paItem.Kesan = kesan.String
					}

					// Get photo if exists
					var photo sql.NullString
					queryPhoto := `
						SELECT photo 
						FROM detail_periksa_labpa_gambar
						WHERE no_rawat = ? AND kd_jenis_prw = ? AND tgl_periksa = ? AND jam = ?
					`
					err = db.QueryRow(queryPhoto, noRawat, paItem.KdJenisPrw, paItem.TglPeriksaRaw, paItem.JamRaw).Scan(&photo)
					if err == nil && photo.Valid {
						paItem.Photo = photo.String
					}
				}

				response.LabPA = append(response.LabPA, paItem)
			}
		}

		c.JSON(http.StatusOK, response)
	}
}

