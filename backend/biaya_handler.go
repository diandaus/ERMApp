package main

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

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


// ============================================================================
// BILLING PREVIEW ENDPOINT
// ============================================================================

// BillingRow represents one line item in the itemized billing printout
type BillingRow struct {
	No          string  `json:"no"`
	NmPerawatan string  `json:"nm_perawatan"`
	Pemisah     string  `json:"pemisah"`
	Biaya       float64 `json:"biaya"`
	Jumlah      float64 `json:"jumlah"`
	Tambahan    float64 `json:"tambahan"`
	TotalBiaya  float64 `json:"totalbiaya"`
}

// getBillingPreview returns the ordered itemized billing rows for a no_rawat,
// used to render the print-style billing preview (mirrors Khanza's tampilBilling()).
// Jika belum pernah digenerate ke tabel billing (mis. pasien belum dibuka di kasir),
// dihitung langsung dari tabel transaksi (versi ringkas per kategori) — mirip logic
// isRawat() di DlgBilingRanap.java saat i<=0, tapi tanpa detail per-baris & tanpa
// pengaturan on/off pengaturanbillingranap.
func getBillingPreview(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}

		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat is required"})
			return
		}

		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM billing WHERE no_rawat = ?`, noRawat).Scan(&count); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if count > 0 {
			items, err := fetchStoredBillingRows(db, noRawat)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, items)
			return
		}

		items, err := computeBillingPreview(db, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, items)
	}
}

func fetchStoredBillingRows(db *sql.DB, noRawat string) ([]BillingRow, error) {
	query := `
		SELECT no, nm_perawatan, pemisah, biaya, jumlah, tambahan, totalbiaya
		FROM billing
		WHERE no_rawat = ?
		ORDER BY noindex
	`
	rows, err := db.Query(query, noRawat)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []BillingRow{}
	for rows.Next() {
		var r BillingRow
		if err := rows.Scan(&r.No, &r.NmPerawatan, &r.Pemisah, &r.Biaya, &r.Jumlah, &r.Tambahan, &r.TotalBiaya); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, nil
}

// computeBillingPreview menghitung ringkasan biaya per kategori langsung dari
// tabel transaksi (belum ada nomor nota / belum digenerate ke tabel billing).
func computeBillingPreview(db *sql.DB, noRawat string) ([]BillingRow, error) {
	items := []BillingRow{}

	var noRkmMedis, namaPasien, alamatPasien, umurDaftar, sttsUmur string
	var kdKamar, tglRegistrasi, jamReg, tglKeluar, jamKeluar sql.NullString
	var lama sql.NullFloat64
	var biayaReg sql.NullFloat64

	headerQuery := `
		SELECT
			reg_periksa.no_rkm_medis,
			pasien.nm_pasien,
			reg_periksa.umurdaftar,
			reg_periksa.sttsumur,
			reg_periksa.biaya_reg,
			DATE_FORMAT(reg_periksa.tgl_registrasi, '%e %M %Y') AS tgl_reg_fmt,
			reg_periksa.jam_reg,
			kamar_inap.kd_kamar,
			IF(kamar_inap.tgl_keluar = '0000-00-00', NULL, DATE_FORMAT(kamar_inap.tgl_keluar, '%e %M %Y')) AS tgl_keluar_fmt,
			kamar_inap.jam_keluar,
			(SELECT SUM(ki.lama) FROM kamar_inap ki WHERE ki.no_rawat = reg_periksa.no_rawat) AS lama,
			COALESCE((
				SELECT CONCAT(pasien.alamat, ', ', kelurahan.nm_kel, ', ', kecamatan.nm_kec, ', ', kabupaten.nm_kab)
				FROM kelurahan, kecamatan, kabupaten
				WHERE pasien.kd_kel = kelurahan.kd_kel AND pasien.kd_kec = kecamatan.kd_kec AND pasien.kd_kab = kabupaten.kd_kab
			), pasien.alamat) AS alamat_lengkap
		FROM reg_periksa
		INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
		LEFT JOIN kamar_inap ON reg_periksa.no_rawat = kamar_inap.no_rawat
		WHERE reg_periksa.no_rawat = ?
		ORDER BY kamar_inap.tgl_keluar DESC
		LIMIT 1
	`
	var tglRegFmt sql.NullString
	err := db.QueryRow(headerQuery, noRawat).Scan(
		&noRkmMedis, &namaPasien, &umurDaftar, &sttsUmur, &biayaReg,
		&tglRegFmt, &jamReg, &kdKamar, &tglKeluar, &jamKeluar, &lama, &alamatPasien,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	tglRegistrasi = tglRegFmt

	var bangsalKamar string
	if kdKamar.Valid && kdKamar.String != "" {
		db.QueryRow(`
			SELECT CONCAT(kamar.kd_kamar, ', ', bangsal.nm_bangsal)
			FROM kamar INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			WHERE kamar.kd_kamar = ?
		`, kdKamar.String).Scan(&bangsalKamar)
	}

	addInfo := func(label, value string) {
		items = append(items, BillingRow{No: label, NmPerawatan: ": " + value})
	}

	addInfo("No.Nota", "-")
	addInfo("Bangsal/Kamar", bangsalKamar)
	keluarStr := "-"
	if tglKeluar.Valid && jamKeluar.Valid {
		keluarStr = tglKeluar.String + " " + jamKeluar.String
	}
	lamaStr := "0"
	if lama.Valid {
		lamaStr = formatAngkaGo(lama.Float64)
	}
	addInfo("Tgl.Perawatan", tglRegistrasi.String+" "+jamReg.String+" s.d. "+keluarStr+" ( "+lamaStr+" Hari )")
	addInfo("No.R.M.", noRkmMedis)
	addInfo("Nama Pasien", namaPasien+" ("+umurDaftar+sttsUmur+")")
	addInfo("Alamat Pasien", alamatPasien)

	addItem := func(label string, biaya, jumlah, tambahan, total float64) {
		items = append(items, BillingRow{No: "", NmPerawatan: label, Pemisah: ":", Biaya: biaya, Jumlah: jumlah, Tambahan: tambahan, TotalBiaya: total})
	}
	addSubtotal := func(label string, total float64) {
		items = append(items, BillingRow{No: "", NmPerawatan: "Total " + label + " : " + formatRupiahText(total)})
	}

	if biayaReg.Valid && biayaReg.Float64 != 0 {
		items = append(items, BillingRow{No: "Registrasi", NmPerawatan: ":", TotalBiaya: biayaReg.Float64})
	}

	// Ruang / Kamar
	kamarRows, err := db.Query(`
		SELECT kamar.kd_kamar, bangsal.nm_bangsal, kamar_inap.trf_kamar, kamar_inap.lama, kamar_inap.ttl_biaya
		FROM kamar_inap
		INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
		INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
		WHERE kamar_inap.no_rawat = ?
	`, noRawat)
	if err == nil {
		var kamarSubtotal float64
		hasKamar := false
		for kamarRows.Next() {
			var kdKamar, nmBangsal string
			var trfKamar, lamaKamar, ttlBiaya float64
			if err := kamarRows.Scan(&kdKamar, &nmBangsal, &trfKamar, &lamaKamar, &ttlBiaya); err != nil {
				continue
			}
			if !hasKamar {
				items = append(items, BillingRow{No: "Ruang", NmPerawatan: ":"})
				hasKamar = true
			}
			addItem(kdKamar+", "+nmBangsal, trfKamar, lamaKamar, 0, ttlBiaya)
			kamarSubtotal += ttlBiaya
		}
		kamarRows.Close()
		if kamarSubtotal > 0 {
			addSubtotal("Kamar Inap", kamarSubtotal)
		}
	}

	// Rincian Biaya per kategori perawatan (Tindakan Dokter/Paramedis/Dokter+Paramedis)
	x := 1
	kategoriRows, err := db.Query(`SELECT kd_kategori, nm_kategori FROM kategori_perawatan`)
	if err == nil {
		type kategoriRow struct{ kd, nm string }
		var kategoriList []kategoriRow
		for kategoriRows.Next() {
			var k kategoriRow
			if err := kategoriRows.Scan(&k.kd, &k.nm); err == nil {
				kategoriList = append(kategoriList, k)
			}
		}
		kategoriRows.Close()

		firstKategori := true
		for _, kat := range kategoriList {
			var subtotal float64
			var rowsOut []BillingRow

			drRows, _ := db.Query(`
				SELECT jns_perawatan_inap.nm_perawatan, MAX(rawat_inap_dr.biaya_rawat), COUNT(*), SUM(rawat_inap_dr.biaya_rawat)
				FROM rawat_inap_dr
				INNER JOIN jns_perawatan_inap ON rawat_inap_dr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
				WHERE rawat_inap_dr.no_rawat = ? AND jns_perawatan_inap.kd_kategori = ?
				GROUP BY rawat_inap_dr.kd_jenis_prw
			`, noRawat, kat.kd)
			if drRows != nil {
				for drRows.Next() {
					var nm string
					var unit, jml, total float64
					if drRows.Scan(&nm, &unit, &jml, &total) == nil {
						rowsOut = append(rowsOut, BillingRow{NmPerawatan: nm, Pemisah: ":", Biaya: unit, Jumlah: jml, TotalBiaya: total})
						subtotal += total
					}
				}
				drRows.Close()
			}

			drprRows, _ := db.Query(`
				SELECT jns_perawatan_inap.nm_perawatan, MAX(rawat_inap_drpr.biaya_rawat), COUNT(*), SUM(rawat_inap_drpr.biaya_rawat)
				FROM rawat_inap_drpr
				INNER JOIN jns_perawatan_inap ON rawat_inap_drpr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
				WHERE rawat_inap_drpr.no_rawat = ? AND jns_perawatan_inap.kd_kategori = ?
				GROUP BY rawat_inap_drpr.kd_jenis_prw
			`, noRawat, kat.kd)
			if drprRows != nil {
				for drprRows.Next() {
					var nm string
					var unit, jml, total float64
					if drprRows.Scan(&nm, &unit, &jml, &total) == nil {
						rowsOut = append(rowsOut, BillingRow{NmPerawatan: nm, Pemisah: ":", Biaya: unit, Jumlah: jml, TotalBiaya: total})
						subtotal += total
					}
				}
				drprRows.Close()
			}

			prRows, _ := db.Query(`
				SELECT jns_perawatan_inap.nm_perawatan, jns_perawatan_inap.total_byrpr, COUNT(*), (jns_perawatan_inap.total_byrpr * COUNT(*))
				FROM rawat_inap_pr
				INNER JOIN jns_perawatan_inap ON rawat_inap_pr.kd_jenis_prw = jns_perawatan_inap.kd_jenis_prw
				WHERE rawat_inap_pr.no_rawat = ? AND jns_perawatan_inap.kd_kategori = ?
				GROUP BY rawat_inap_pr.kd_jenis_prw, jns_perawatan_inap.total_byrpr
			`, noRawat, kat.kd)
			if prRows != nil {
				for prRows.Next() {
					var nm string
					var unit, jml, total float64
					if prRows.Scan(&nm, &unit, &jml, &total) == nil {
						rowsOut = append(rowsOut, BillingRow{NmPerawatan: nm, Pemisah: ":", Biaya: unit, Jumlah: jml, TotalBiaya: total})
						subtotal += total
					}
				}
				prRows.Close()
			}

			if len(rowsOut) == 0 {
				continue
			}
			if firstKategori {
				items = append(items, BillingRow{No: "Rincian Biaya", NmPerawatan: ":"})
				firstKategori = false
			}
			items = append(items, BillingRow{No: strconv.Itoa(x) + ". " + kat.nm, NmPerawatan: ":"})
			x++
			items = append(items, rowsOut...)
			addSubtotal(kat.nm, subtotal)
		}
	}

	// Pemeriksaan Lab
	labRows, err := db.Query(`
		SELECT jns_perawatan_lab.nm_perawatan, MAX(periksa_lab.biaya), COUNT(*), SUM(periksa_lab.biaya)
		FROM periksa_lab
		INNER JOIN jns_perawatan_lab ON periksa_lab.kd_jenis_prw = jns_perawatan_lab.kd_jenis_prw
		WHERE periksa_lab.no_rawat = ? AND periksa_lab.status = 'Ranap'
		GROUP BY periksa_lab.kd_jenis_prw
	`, noRawat)
	if err == nil {
		var subtotal float64
		hasLab := false
		for labRows.Next() {
			var nm string
			var unit, jml, total float64
			if labRows.Scan(&nm, &unit, &jml, &total) != nil {
				continue
			}
			if !hasLab {
				items = append(items, BillingRow{No: strconv.Itoa(x) + ". Pemeriksaan Lab", NmPerawatan: ":"})
				x++
				hasLab = true
			}
			addItem(nm, unit, jml, 0, total)
			subtotal += total
		}
		labRows.Close()
		if subtotal > 0 {
			addSubtotal("Periksa Lab", subtotal)
		}
	}

	// Pemeriksaan Radiologi
	radRows, err := db.Query(`
		SELECT jns_perawatan_radiologi.nm_perawatan, MAX(periksa_radiologi.biaya), COUNT(*), SUM(periksa_radiologi.biaya)
		FROM periksa_radiologi
		INNER JOIN jns_perawatan_radiologi ON periksa_radiologi.kd_jenis_prw = jns_perawatan_radiologi.kd_jenis_prw
		WHERE periksa_radiologi.no_rawat = ? AND periksa_radiologi.status = 'Ranap'
		GROUP BY periksa_radiologi.kd_jenis_prw
	`, noRawat)
	if err == nil {
		var subtotal float64
		hasRad := false
		for radRows.Next() {
			var nm string
			var unit, jml, total float64
			if radRows.Scan(&nm, &unit, &jml, &total) != nil {
				continue
			}
			if !hasRad {
				items = append(items, BillingRow{No: strconv.Itoa(x) + ". Pemeriksaan Radiologi", NmPerawatan: ":"})
				x++
				hasRad = true
			}
			addItem(nm, unit, jml, 0, total)
			subtotal += total
		}
		radRows.Close()
		if subtotal > 0 {
			addSubtotal("Periksa Radiologi", subtotal)
		}
	}

	// Obat & BHP
	obatRows, err := db.Query(`
		SELECT databarang.nama_brng, jenis.nama, detail_pemberian_obat.biaya_obat,
			SUM(detail_pemberian_obat.jml) AS jml,
			SUM(detail_pemberian_obat.embalase + detail_pemberian_obat.tuslah) AS tambahan,
			(SUM(detail_pemberian_obat.total) - SUM(detail_pemberian_obat.embalase + detail_pemberian_obat.tuslah)) AS total
		FROM detail_pemberian_obat
		INNER JOIN databarang ON detail_pemberian_obat.kode_brng = databarang.kode_brng
		INNER JOIN jenis ON databarang.kdjns = jenis.kdjns
		WHERE detail_pemberian_obat.no_rawat = ? AND detail_pemberian_obat.status = 'Ranap'
		GROUP BY databarang.kode_brng, detail_pemberian_obat.biaya_obat
		ORDER BY jenis.nama
	`, noRawat)
	if err == nil {
		var subtotal float64
		hasObat := false
		for obatRows.Next() {
			var namaBrng, namaJenis string
			var biayaObat, jml, tambahan, total float64
			if obatRows.Scan(&namaBrng, &namaJenis, &biayaObat, &jml, &tambahan, &total) != nil {
				continue
			}
			if !hasObat {
				items = append(items, BillingRow{No: strconv.Itoa(x) + ". Obat & BHP", NmPerawatan: ":"})
				x++
				hasObat = true
			}
			addItem(namaBrng+" ("+namaJenis+")", biayaObat, jml, tambahan, total+tambahan)
			subtotal += total + tambahan
		}
		obatRows.Close()
		if subtotal > 0 {
			addSubtotal("Obat & BHP", subtotal)
		}
	}

	return items, nil
}

func formatAngkaGo(n float64) string {
	if n == float64(int64(n)) {
		return strconv.FormatInt(int64(n), 10)
	}
	return strconv.FormatFloat(n, 'f', 1, 64)
}

// formatRupiahText memformat angka jadi teks pemisah ribuan koma tanpa desimal
// (mis. 1363033 -> "1,363,033"), dipakai untuk teks subtotal "Total X : Y".
func formatRupiahText(n float64) string {
	rounded := int64(math.Round(n))
	neg := rounded < 0
	if neg {
		rounded = -rounded
	}
	s := strconv.FormatInt(rounded, 10)
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	parts = append([]string{s}, parts...)
	result := strings.Join(parts, ",")
	if neg {
		result = "-" + result
	}
	return result
}
