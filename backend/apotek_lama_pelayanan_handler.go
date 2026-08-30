package main

import (
	"database/sql"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Diagram Lama Pelayanan (StatCard "Fitur Dashboard Apotek" di
// DashboardApotek.tsx). Cocok dengan tampil() di dialog Khanza Desktop
// (report "Lama Pelayanan Apotek", sekelas dengan DlgLamaPelayananApotek.java
// — bukan dialog terpisah di proyek ini, langsung jadi panel di Dashboard
// Apotek). Query & rumus durasi PERSIS Java: 3 durasi dihitung dari
// resep_obat per resep —
//   durasi_validasi   = tgl_perawatan+jam           MINUS tgl_peresepan+jam_peresepan
//   durasi_penyerahan = tgl_penyerahan+jam_penyerahan MINUS tgl_perawatan+jam
//   durasi_pelayanan  = tgl_penyerahan+jam_penyerahan MINUS tgl_peresepan+jam_peresepan
// (dalam menit). PENTING — sama seperti getPermintaanResepRalan
// (permintaan_resep_handler.go): kolom resep_obat.tgl_perawatan/jam
// MENYESATKAN namanya, tapi di sini artinya "kapan apotek memvalidasi
// resep", BUKAN tanggal rawat pasien.
//
// Java menaruh baris ringkasan (rata-rata + 4 bucket "0-15 Menit"/">15-30"/
// ">30-60"/">60 Menit" per durasi) sebagai BARIS TABEL TAMBAHAN di
// tabMode (hack JTable) — di sini dipisah rapi jadi objek `summary`
// tersendiri, dikonsumsi frontend utk render diagram batang + angka
// rata-rata di atas tabel detail (bukan baris tabel palsu).
// ============================================================================

type lamaPelayananRow struct {
	NoRkmMedis       string  `json:"no_rkm_medis"`
	NmPasien         string  `json:"nm_pasien"`
	NmDokter         string  `json:"nm_dokter"`
	NmPoli           string  `json:"nm_poli"`
	Peresepan        string  `json:"peresepan"`
	Validasi         string  `json:"validasi"`
	Penyerahan       string  `json:"penyerahan"`
	DurasiValidasi   float64 `json:"durasi_validasi"`
	DurasiPenyerahan float64 `json:"durasi_penyerahan"`
	DurasiPelayanan  float64 `json:"durasi_pelayanan"`
	IsRacikan        bool    `json:"is_racikan"`
}

type lamaPelayananBucket struct {
	B15    int `json:"b15"`
	B30    int `json:"b30"`
	B60    int `json:"b60"`
	Over60 int `json:"over60"`
}

func bucketAdd(b *lamaPelayananBucket, menit float64) {
	switch {
	case menit <= 15:
		b.B15++
	case menit <= 30:
		b.B30++
	case menit <= 60:
		b.B60++
	default:
		b.Over60++
	}
}

type lamaPelayananSummary struct {
	Count            int                 `json:"count"`
	RataValidasi     float64             `json:"rata_validasi"`
	RataPenyerahan   float64             `json:"rata_penyerahan"`
	RataPelayanan    float64             `json:"rata_pelayanan"`
	BucketValidasi   lamaPelayananBucket `json:"bucket_validasi"`
	BucketPenyerahan lamaPelayananBucket `json:"bucket_penyerahan"`
	BucketPelayanan  lamaPelayananBucket `json:"bucket_pelayanan"`
}

// lamaPelayananAccumulator — akumulator rata-rata + bucket per kelompok
// (Non-Racikan / Racikan), dipakai supaya getApotekLamaPelayanan cukup
// looping rows sekali sambil membagi baris ke 2 kelompok berdasarkan
// is_racikan (EXISTS di resep_dokter_racikan).
type lamaPelayananAccumulator struct {
	count                                             int
	sumValidasi, sumPenyerahan, sumPelayanan          float64
	bucketValidasi, bucketPenyerahan, bucketPelayanan lamaPelayananBucket
}

func (a *lamaPelayananAccumulator) add(r lamaPelayananRow) {
	a.count++
	a.sumValidasi += r.DurasiValidasi
	a.sumPenyerahan += r.DurasiPenyerahan
	a.sumPelayanan += r.DurasiPelayanan
	bucketAdd(&a.bucketValidasi, r.DurasiValidasi)
	bucketAdd(&a.bucketPenyerahan, r.DurasiPenyerahan)
	bucketAdd(&a.bucketPelayanan, r.DurasiPelayanan)
}

func (a *lamaPelayananAccumulator) summary() lamaPelayananSummary {
	s := lamaPelayananSummary{
		Count:            a.count,
		BucketValidasi:   a.bucketValidasi,
		BucketPenyerahan: a.bucketPenyerahan,
		BucketPelayanan:  a.bucketPelayanan,
	}
	if a.count > 0 {
		n := float64(a.count)
		s.RataValidasi = round2(a.sumValidasi / n)
		s.RataPenyerahan = round2(a.sumPenyerahan / n)
		s.RataPelayanan = round2(a.sumPelayanan / n)
	}
	return s
}

type lamaPelayananResponse struct {
	Items             []lamaPelayananRow   `json:"items"`
	SummaryNonRacikan lamaPelayananSummary `json:"summary_non_racikan"`
	SummaryRacikan    lamaPelayananSummary `json:"summary_racikan"`
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func getApotekLamaPelayanan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien, dokter.nm_dokter, poliklinik.nm_poli,
				CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan) AS peresepan,
				CONCAT(resep_obat.tgl_perawatan,' ',resep_obat.jam) AS validasi,
				CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan) AS penyerahan,
				ROUND(TIMESTAMPDIFF(SECOND,
					CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan),
					CONCAT(resep_obat.tgl_perawatan,' ',resep_obat.jam)
				)/60, 2) AS durasi_validasi,
				ROUND(TIMESTAMPDIFF(SECOND,
					CONCAT(resep_obat.tgl_perawatan,' ',resep_obat.jam),
					CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan)
				)/60, 2) AS durasi_penyerahan,
				ROUND(TIMESTAMPDIFF(SECOND,
					CONCAT(resep_obat.tgl_peresepan,' ',resep_obat.jam_peresepan),
					CONCAT(resep_obat.tgl_penyerahan,' ',resep_obat.jam_penyerahan)
				)/60, 2) AS durasi_pelayanan,
				EXISTS (SELECT 1 FROM resep_dokter_racikan rdr WHERE rdr.no_resep = resep_obat.no_resep) AS is_racikan
			FROM reg_periksa
			INNER JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN resep_obat ON reg_periksa.no_rawat = resep_obat.no_rawat
			WHERE resep_obat.tgl_peresepan <> '0000-00-00'
				AND resep_obat.tgl_penyerahan <> '0000-00-00'
				AND resep_obat.tgl_perawatan <> '0000-00-00'
				AND resep_obat.tgl_peresepan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if search != "" {
			query += " AND (poliklinik.nm_poli LIKE ? OR dokter.nm_dokter LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY resep_obat.tgl_peresepan, resep_obat.jam_peresepan"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []lamaPelayananRow{}
		var accNonRacikan, accRacikan lamaPelayananAccumulator
		for rows.Next() {
			var r lamaPelayananRow
			if rows.Scan(
				&r.NoRkmMedis, &r.NmPasien, &r.NmDokter, &r.NmPoli,
				&r.Peresepan, &r.Validasi, &r.Penyerahan,
				&r.DurasiValidasi, &r.DurasiPenyerahan, &r.DurasiPelayanan,
				&r.IsRacikan,
			) == nil {
				items = append(items, r)
				if r.IsRacikan {
					accRacikan.add(r)
				} else {
					accNonRacikan.add(r)
				}
			}
		}

		c.JSON(http.StatusOK, lamaPelayananResponse{
			Items:             items,
			SummaryNonRacikan: accNonRacikan.summary(),
			SummaryRacikan:    accRacikan.summary(),
		})
	}
}
