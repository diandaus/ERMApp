package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PEMERIKSAAN SUMMARY — agregasi ringkas 1 kunjungan (no_rawat) utk modal
// "Lihat Pemeriksaan" di tabel "Antrian per Tanggal Mobile JKN"
// (AntreanRs.tsx): identitas pasien + SOAP/CPPT + permintaan
// laboratorium + permintaan radiologi + permintaan resep, digabung 1
// endpoint drpd frontend nge-fetch 4x terpisah.
//
// Sumber data (semua reuse tabel yg sudah ada, tidak ada tabel baru):
//   - SOAP/CPPT: pemeriksaan_ralan (rawat jalan/poli) — SAMA dgn dipakai
//     /api/pemeriksaan/soap-history, cuma di sini nip di-resolve ke nama
//     lewat JOIN pegawai (pemeriksaan_ralan.nip = pegawai.nik).
//   - Lab: permintaan_lab (Patologi Klinik) + detail nama pemeriksaan dari
//     permintaan_pemeriksaan_lab/jns_perawatan_lab (pola nama pemeriksaan
//     sama persis getRiwayatLabPK). status di SINI DIHITUNG dari tgl_hasil
//     kosong/tidak (pola sudahAdaHasil() di LabTab.tsx) — BUKAN dari kolom
//     permintaan_lab.status, yang ternyata cuma enum('ralan','ranap')
//     (flag jenis kunjungan, bukan progres pemeriksaan sama sekali).
//     Permintaan Lab PA (Patologi Anatomi, tabel permintaan_labpa) BELUM
//     diikutkan — jenis pemeriksaan PA referensi kode-nya belum
//     jelas/terverifikasi (tidak ada tabel jns_perawatan_pa terpisah, dan
//     data uji lokal kosong sama sekali utk dicek), jadi sengaja
//     dilewatkan drpd salah nampilin nama pemeriksaan. Menyusul kalau
//     dibutuhkan & sudah bisa diverifikasi.
//   - Radiologi: permintaan_radiologi + detail dari
//     permintaan_pemeriksaan_radiologi/jns_perawatan_radiologi (nama
//     pemeriksaan pola sama persis getRiwayatRadiologi; status dihitung
//     dari tgl_hasil spt lab di atas — sama alasannya, pola RadTab.tsx).
//   - Resep: resep_obat, status dihitung sama persis pola dipakai
//     getPermintaanResepRalan (tgl_perawatan kosong = "Belum Terlayani").
// ============================================================================

type PemeriksaanSoapItem struct {
	Tanggal string `json:"tanggal"`
	Jam     string `json:"jam"`
	Dokter  string `json:"dokter"`
}

type PemeriksaanLabItem struct {
	Tanggal         string `json:"tanggal"`
	Jam             string `json:"jam"`
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Status          string `json:"status"`
}

type PemeriksaanRadItem struct {
	Tanggal         string `json:"tanggal"`
	Jam             string `json:"jam"`
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Status          string `json:"status"`
}

type PemeriksaanResepItem struct {
	Tanggal string `json:"tanggal"`
	Jam     string `json:"jam"`
	Status  string `json:"status"`
}

type PemeriksaanSummary struct {
	NoRawat    string                 `json:"no_rawat"`
	NoRkmMedis string                 `json:"no_rkm_medis"`
	NmPasien   string                 `json:"nm_pasien"`
	Soap       []PemeriksaanSoapItem  `json:"soap"`
	Lab        []PemeriksaanLabItem   `json:"lab"`
	Radiologi  []PemeriksaanRadItem   `json:"radiologi"`
	Resep      []PemeriksaanResepItem `json:"resep"`
}

func getPemeriksaanSummary(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var summary PemeriksaanSummary
		summary.NoRawat = noRawat

		err := db.QueryRow(
			`SELECT reg_periksa.no_rkm_medis, COALESCE(pasien.nm_pasien, '')
			 FROM reg_periksa
			 LEFT JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			 WHERE reg_periksa.no_rawat = ?`,
			noRawat,
		).Scan(&summary.NoRkmMedis, &summary.NmPasien)
		if err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// --- SOAP/CPPT ---
		soapRows, err := db.Query(
			`SELECT pemeriksaan_ralan.tgl_perawatan, pemeriksaan_ralan.jam_rawat, COALESCE(pegawai.nama, '')
			 FROM pemeriksaan_ralan
			 LEFT JOIN pegawai ON pemeriksaan_ralan.nip = pegawai.nik
			 WHERE pemeriksaan_ralan.no_rawat = ?
			 ORDER BY pemeriksaan_ralan.tgl_perawatan DESC, pemeriksaan_ralan.jam_rawat DESC`,
			noRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for soapRows.Next() {
			var item PemeriksaanSoapItem
			if err := soapRows.Scan(&item.Tanggal, &item.Jam, &item.Dokter); err == nil {
				summary.Soap = append(summary.Soap, item)
			}
		}
		soapRows.Close()

		// --- Permintaan Laboratorium (PK) ---
		// status di sini BUKAN kolom permintaan_lab.status (itu cuma flag
		// ralan/ranap, bukan progres pemeriksaan) — dihitung dari tgl_hasil
		// kosong/tidak, sama persis pola dipakai LabTab.tsx (sudahAdaHasil).
		labRows, err := db.Query(
			`SELECT noorder, tgl_permintaan, jam_permintaan,
			 IF(tgl_hasil='0000-00-00' OR tgl_hasil IS NULL, 'Menunggu Hasil', 'Selesai') AS status
			 FROM permintaan_lab WHERE no_rawat = ? ORDER BY tgl_permintaan DESC, jam_permintaan DESC`,
			noRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type labRow struct {
			noorder, tanggal, jam, status string
		}
		var labList []labRow
		for labRows.Next() {
			var r labRow
			if err := labRows.Scan(&r.noorder, &r.tanggal, &r.jam, &r.status); err == nil {
				labList = append(labList, r)
			}
		}
		labRows.Close()
		for _, r := range labList {
			var namaPemeriksaan sql.NullString
			db.QueryRow(
				`SELECT GROUP_CONCAT(jpl.nm_perawatan SEPARATOR ', ')
				 FROM permintaan_pemeriksaan_lab ppl
				 LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
				 WHERE ppl.noorder = ?`,
				r.noorder,
			).Scan(&namaPemeriksaan)
			summary.Lab = append(summary.Lab, PemeriksaanLabItem{
				Tanggal:         r.tanggal,
				Jam:             r.jam,
				NamaPemeriksaan: namaPemeriksaan.String,
				Status:          r.status,
			})
		}

		// --- Permintaan Radiologi ---
		// status dihitung sama persis pola lab di atas (tgl_hasil, bukan
		// kolom permintaan_radiologi.status yg cuma flag ralan/ranap) —
		// padanan RadTab.tsx.
		radRows, err := db.Query(
			`SELECT noorder, tgl_permintaan, jam_permintaan,
			 IF(tgl_hasil='0000-00-00' OR tgl_hasil IS NULL, 'Menunggu Hasil', 'Selesai') AS status
			 FROM permintaan_radiologi WHERE no_rawat = ? ORDER BY tgl_permintaan DESC, jam_permintaan DESC`,
			noRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var radList []labRow
		for radRows.Next() {
			var r labRow
			if err := radRows.Scan(&r.noorder, &r.tanggal, &r.jam, &r.status); err == nil {
				radList = append(radList, r)
			}
		}
		radRows.Close()
		for _, r := range radList {
			var namaPemeriksaan sql.NullString
			db.QueryRow(
				`SELECT GROUP_CONCAT(jpr.nm_perawatan SEPARATOR ', ')
				 FROM permintaan_pemeriksaan_radiologi ppr
				 LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
				 WHERE ppr.noorder = ?`,
				r.noorder,
			).Scan(&namaPemeriksaan)
			summary.Radiologi = append(summary.Radiologi, PemeriksaanRadItem{
				Tanggal:         r.tanggal,
				Jam:             r.jam,
				NamaPemeriksaan: namaPemeriksaan.String,
				Status:          r.status,
			})
		}

		// --- Permintaan Resep ---
		// Status dihitung sama persis pola getPermintaanResepRalan:
		// tgl_perawatan kosong ('0000-00-00') = belum divalidasi/dilayani
		// farmasi.
		resepRows, err := db.Query(
			`SELECT tgl_peresepan, jam_peresepan,
			 IF(tgl_perawatan='0000-00-00','Belum Terlayani','Sudah Terlayani') AS status
			 FROM resep_obat WHERE no_rawat = ? ORDER BY tgl_peresepan DESC, jam_peresepan DESC`,
			noRawat,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for resepRows.Next() {
			var item PemeriksaanResepItem
			if err := resepRows.Scan(&item.Tanggal, &item.Jam, &item.Status); err == nil {
				summary.Resep = append(summary.Resep, item)
			}
		}
		resepRows.Close()

		c.JSON(http.StatusOK, summary)
	}
}
