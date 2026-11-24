package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// display_informasi_handler.go — data utk "Display Layanan Informasi"
// (Anjungan & Antrian), padanan PERSIS webapps/bed5.php +
// data_jadwal_kamar.php Khanza:
//   - Jadwal Praktek Dokter HARI INI (jadwal.hari_kerja = nama hari
//     Indonesia kapital, AKHAD utk Minggu — sama dgn PHP).
//   - Daftar Ruang Rawat Inap per kelas: jumlah bed, terisi (status ISI),
//     kosong (status KOSONG) — hanya kamar statusdata='1'.
//   - Tarif kamar per kelas utk running text footer.
// Tanpa login (layar TV/anjungan).

type displayJadwalDokter struct {
	NmDokter   string `json:"nm_dokter"`
	NmPoli     string `json:"nm_poli"`
	JamMulai   string `json:"jam_mulai"`
	JamSelesai string `json:"jam_selesai"`
}

type displayKamarKelas struct {
	Kelas     string `json:"kelas"`
	NamaKamar string `json:"nama_kamar"` // diisi khusus Kelas Utama (ICU, NICU, ...)
	Total     int    `json:"total"`
	Isi       int    `json:"isi"`
	Kosong    int    `json:"kosong"`
}

var hariKerjaKhanza = map[time.Weekday]string{
	time.Sunday: "AKHAD", time.Monday: "SENIN", time.Tuesday: "SELASA", time.Wednesday: "RABU",
	time.Thursday: "KAMIS", time.Friday: "JUMAT", time.Saturday: "SABTU",
}

// GET /api/display/informasi
func getDisplayInformasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		hari := hariKerjaKhanza[time.Now().Weekday()]

		jadwal := []displayJadwalDokter{}
		rows, err := db.Query(`
			SELECT dokter.nm_dokter, poliklinik.nm_poli,
				IFNULL(TIME_FORMAT(jadwal.jam_mulai, '%H:%i'), ''), IFNULL(TIME_FORMAT(jadwal.jam_selesai, '%H:%i'), '')
			FROM jadwal
			INNER JOIN dokter ON dokter.kd_dokter = jadwal.kd_dokter
			INNER JOIN poliklinik ON jadwal.kd_poli = poliklinik.kd_poli
			WHERE jadwal.hari_kerja = ?
			ORDER BY jadwal.jam_mulai, dokter.nm_dokter`, hari)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat jadwal dokter: " + err.Error()})
			return
		}
		for rows.Next() {
			var j displayJadwalDokter
			if rows.Scan(&j.NmDokter, &j.NmPoli, &j.JamMulai, &j.JamSelesai) == nil {
				jadwal = append(jadwal, j)
			}
		}
		rows.Close()

		// Satu query (bukan 3 query per kelas spt PHP) — hasilnya sama.
		// KHUSUS Kelas Utama: yg ditampilkan HANYA ruang ICU & NICU, dgn
		// label nama ruangnya ("ICU"/"NICU", bukan "Kelas Utama"); kamar
		// Kelas Utama lain disembunyikan. Ruang dikenali dari nama bangsal
		// (atau kode kamar) yg MENGANDUNG "NICU" / "ICU" — NICU dicek dulu
		// krn "NICU" juga mengandung "ICU". Kelas lain tetap per kelas spt PHP.
		kamar := []displayKamarKelas{}
		if kr, err := db.Query(`
			SELECT x.kelas, x.nama_kamar, COUNT(*), SUM(x.status = 'ISI'), SUM(x.status = 'KOSONG')
			FROM (
				SELECT k.kelas, k.status,
					CASE
						WHEN k.kelas <> 'Kelas Utama' THEN ''
						WHEN UPPER(CONCAT(IFNULL(b.nm_bangsal, ''), ' ', k.kd_kamar)) LIKE '%NICU%' THEN 'NICU'
						WHEN UPPER(CONCAT(IFNULL(b.nm_bangsal, ''), ' ', k.kd_kamar)) LIKE '%ICU%' THEN 'ICU'
						ELSE NULL
					END AS nama_kamar
				FROM kamar k
				LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
				WHERE k.statusdata = '1'
			) x
			WHERE x.nama_kamar IS NOT NULL
			GROUP BY x.kelas, x.nama_kamar
			ORDER BY x.kelas = 'Kelas Utama', x.kelas, x.nama_kamar`); err == nil {
			for kr.Next() {
				var k displayKamarKelas
				if kr.Scan(&k.Kelas, &k.NamaKamar, &k.Total, &k.Isi, &k.Kosong) == nil {
					kamar = append(kamar, k)
				}
			}
			kr.Close()
		}

		tarif := []displayTarifKamar{}
		if tr, err := db.Query(`SELECT kelas, MIN(trf_kamar) FROM kamar WHERE statusdata = '1' GROUP BY kelas ORDER BY kelas`); err == nil {
			for tr.Next() {
				var t displayTarifKamar
				if tr.Scan(&t.Kelas, &t.TrfKamar) == nil {
					tarif = append(tarif, t)
				}
			}
			tr.Close()
		}

		c.JSON(http.StatusOK, gin.H{"hari": hari, "jadwal_dokter": jadwal, "kamar": kamar, "tarif_kamar": tarif})
	}
}
