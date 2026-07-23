package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RESEP — Rawat Inap (Daftar Resep Dokter > Rawat Inap). Padanan
// TabRawatInap (6 sub-tab: tabMode3..tabMode8) di
// inventory/DlgDaftarPermintaanResep.java — lihat PERMINTAAN_RESEP_MODUL.md
// untuk peta lengkap. Struktur query/handler SENGAJA DIDUPLIKASI dari
// permintaan_resep_handler.go (versi Ralan) alih-alih digeneralisasi lewat
// parameter, mengikuti pola yang sudah dipakai proyek ini di tempat lain
// (resep_handler.go vs resep_ranap_handler.go) — supaya masing-masing jalur
// query tetap gampang dibaca berdampingan dengan method Java aslinya
// (tampil3..tampil8), tanpa percabangan kondisional yang mengaburkan.
//
// Filter dibagi rata ke SEMUA 6 sub-tab (persis Java: CrDokter2/Kamar/
// TCari/cmbStatus/DTPCari1/DTPCari2 adalah field yang SAMA dipakai
// tampil3..tampil8, bukan filter terpisah per tab) — jadi ketiga List
// endpoint (Resep Ranap/Stok Pasien/Resep Pulang) berbagi bentuk query
// param yang identik: tgl1, tgl2, dokter, kamar (nm_bangsal LIKE), status,
// search.
//
// Setiap query di Java sebenarnya dijalankan DUA KALI dan hasilnya
// digabung: sekali lewat kamar_inap biasa, sekali lagi lewat
// ranap_gabung (pasien bayi/gabungan yang memakai no_rawat ibu, lihat
// rad_handler.go). Diikuti apa adanya di sini (UNION, bukan cuma jalur
// pertama) supaya pasien bayi/gabungan tidak hilang dari dashboard.
//
// Jalur DEPOAKTIFOBAT (varian per-depo-aktif) TIDAK diport — sama prinsip
// penyederhanaan dengan modul lain di proyek ini (skip pengaturan yang
// tidak esensial untuk MVP).
// ============================================================================

type permintaanResepRanapRow struct {
	NoResep      string `json:"no_resep"`
	TglPeresepan string `json:"tgl_peresepan"`
	JamPeresepan string `json:"jam_peresepan"`
	NoRawat      string `json:"no_rawat"`
	NoRkmMedis   string `json:"no_rkm_medis"`
	NmPasien     string `json:"nm_pasien"`
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	Status       string `json:"status"`
	NmBangsal    string `json:"nm_bangsal"`
	KdBangsal    string `json:"kd_bangsal"`
	JenisBayar   string `json:"jenis_bayar"`
	TglValidasi  string `json:"tgl_validasi"`
	JamValidasi  string `json:"jam_validasi"`
}

// getPermintaanResepRanap — padanan tampil3()/tabMode3 (tab "Resep Rawat
// Inap"). Beda dari Ralan: JOIN kamar_inap/kamar/bangsal (bukan
// poliklinik), filter kamar_inap.stts_pulang='-' (cuma pasien yang MASIH
// dirawat, sudah pulang tidak muncul di antrean kerja ini) dan
// resep_obat.status='ranap'. Tidak ada kolom Penyerahan (tabMode3 Java
// cuma 14 kolom berakhir di Jam Validasi — beda dari tabMode Ralan yang
// juga punya tgl_penyerahan/jam_penyerahan) jadi TIDAK diikutkan di sini.
func getPermintaanResepRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		dokter := strings.TrimSpace(c.Query("dokter"))
		kamar := strings.TrimSpace(c.Query("kamar"))
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		selectCols := `
			resep_obat.no_resep, resep_obat.tgl_peresepan, resep_obat.jam_peresepan,
			resep_obat.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, resep_obat.kd_dokter, dokter.nm_dokter,
			IF(resep_obat.tgl_perawatan='0000-00-00','Belum Terlayani','Sudah Terlayani') AS status,
			bangsal.nm_bangsal, kamar.kd_bangsal, penjab.png_jawab,
			IF(resep_obat.tgl_perawatan='0000-00-00','',resep_obat.tgl_perawatan) AS tgl_validasi,
			IF(resep_obat.jam='00:00:00','',resep_obat.jam) AS jam_validasi
		`
		buildQuery := func(viaGabung bool) (string, []interface{}) {
			joinNoRawat := "reg_periksa.no_rawat = resep_obat.no_rawat"
			joinKamar := "reg_periksa.no_rawat = kamar_inap.no_rawat"
			extraJoin := ""
			if viaGabung {
				extraJoin = " INNER JOIN ranap_gabung ON ranap_gabung.no_rawat2 = resep_obat.no_rawat"
				joinKamar = "ranap_gabung.no_rawat = kamar_inap.no_rawat"
			}
			q := `SELECT ` + selectCols + `
				FROM resep_obat` + extraJoin + `
				INNER JOIN reg_periksa ON ` + joinNoRawat + `
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN dokter ON resep_obat.kd_dokter = dokter.kd_dokter
				INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				INNER JOIN kamar_inap ON ` + joinKamar + `
				INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
				INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
				WHERE resep_obat.status = 'ranap' AND resep_obat.tgl_peresepan <> '0000-00-00'
					AND kamar_inap.stts_pulang = '-'
					AND resep_obat.tgl_peresepan BETWEEN ? AND ?
			`
			args := []interface{}{tgl1, tgl2}
			if dokter != "" {
				q += " AND dokter.nm_dokter LIKE ?"
				args = append(args, "%"+dokter+"%")
			}
			if kamar != "" {
				q += " AND bangsal.nm_bangsal LIKE ?"
				args = append(args, "%"+kamar+"%")
			}
			if search != "" {
				q += ` AND (resep_obat.no_resep LIKE ? OR resep_obat.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
					OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR penjab.png_jawab LIKE ?)`
				pattern := "%" + search + "%"
				args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
			}
			q += " GROUP BY resep_obat.no_resep ORDER BY resep_obat.tgl_peresepan DESC, resep_obat.jam_peresepan DESC"
			return q, args
		}

		list := []permintaanResepRanapRow{}
		seen := map[string]bool{}
		scanInto := func(q string, args []interface{}) error {
			rows, err := db.Query(q, args...)
			if err != nil {
				return err
			}
			defer rows.Close()
			for rows.Next() {
				var r permintaanResepRanapRow
				if rows.Scan(&r.NoResep, &r.TglPeresepan, &r.JamPeresepan, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
					&r.KdDokter, &r.NmDokter, &r.Status, &r.NmBangsal, &r.KdBangsal, &r.JenisBayar,
					&r.TglValidasi, &r.JamValidasi) == nil {
					if seen[r.NoResep] {
						continue
					}
					if status == "" || status == r.Status {
						seen[r.NoResep] = true
						list = append(list, r)
					}
				}
			}
			return nil
		}

		q1, args1 := buildQuery(false)
		if err := scanInto(q1, args1); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		q2, args2 := buildQuery(true)
		if err := scanInto(q2, args2); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, list)
	}
}

// getPermintaanResepRanapItems — padanan tampil4()/tabMode4 (tab "Detail
// Rawat Inap") DAN panel item di modal Validasi ranap. Struktur query
// PERSIS getPermintaanResepRalanItems (resep_handler.go/
// permintaan_resep_handler.go) — bedanya HANYA fallback resolusi depo:
// resolveDepoRanap (lewat kamar_inap/kamar aktif pasien) bukan
// resolveDepoRalan (lewat poliklinik kunjungan).
func getPermintaanResepRanapItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		hargaCol := tarifHargaColumn(c.Query("tarif"))
		kdBangsalOverride := strings.TrimSpace(c.Query("kd_bangsal"))

		result := struct {
			NoRawat    string            `json:"no_rawat"`
			KdBangsal  string            `json:"kd_bangsal"`
			NmBangsal  string            `json:"nm_bangsal"`
			Total      float64           `json:"total"`
			Ppn        float64           `json:"ppn"`
			TotalPpn   float64           `json:"total_ppn"`
			NonRacikan []ResepNonRacikan `json:"non_racikan"`
			Racikan    []ResepRacikan    `json:"racikan"`
		}{
			NonRacikan: []ResepNonRacikan{},
			Racikan:    []ResepRacikan{},
		}

		db.QueryRow(`SELECT no_rawat FROM resep_obat WHERE no_resep=?`, noResep).Scan(&result.NoRawat)
		if kdBangsalOverride != "" {
			result.KdBangsal = kdBangsalOverride
		} else {
			result.KdBangsal = resolveDepoRanap(db, result.NoRawat)
		}
		if result.KdBangsal == "" {
			result.KdBangsal = "AP"
		}
		db.QueryRow(`SELECT COALESCE(nm_bangsal,'') FROM bangsal WHERE kd_bangsal=?`, result.KdBangsal).Scan(&result.NmBangsal)

		var embalaseDefault, tuslahDefault float64
		db.QueryRow(`SELECT COALESCE(embalase_per_obat,0), COALESCE(tuslah_per_obat,0) FROM set_embalase LIMIT 1`).Scan(&embalaseDefault, &tuslahDefault)

		refCols := `COALESCE(j.nama,''), COALESCE(b.h_beli,0),
			COALESCE((SELECT SUM(g.stok) FROM gudangbarang g WHERE g.kode_brng=b.kode_brng AND g.kd_bangsal=? AND g.no_batch='' AND g.no_faktur=''),0),
			COALESCE(ind.nama_industri,''), COALESCE(kat.nama,''), COALESCE(gol.nama,''),
			IF(b.expire IS NULL OR b.expire='0000-00-00','',b.expire),
			COALESCE(NULLIF(b.kapasitas,0),1)`
		refJoins := `
			LEFT JOIN jenis j ON b.kdjns = j.kdjns
			LEFT JOIN industrifarmasi ind ON b.kode_industri = ind.kode_industri
			LEFT JOIN kategori_barang kat ON b.kode_kategori = kat.kode
			LEFT JOIN golongan_barang gol ON b.kode_golongan = gol.kode
		`

		rowsNonRacikan, err := db.Query(`
			SELECT resep_dokter.kode_brng, COALESCE(b.nama_brng,''), COALESCE(resep_dokter.jml,0),
				COALESCE(b.kode_sat,''), COALESCE(resep_dokter.aturan_pakai,''), COALESCE(b.`+hargaCol+`,0), `+refCols+`
			FROM resep_dokter
			INNER JOIN databarang b ON resep_dokter.kode_brng = b.kode_brng
			`+refJoins+`
			WHERE resep_dokter.no_resep = ?
			ORDER BY b.nama_brng
		`, result.KdBangsal, noResep)
		if err == nil {
			defer rowsNonRacikan.Close()
			for rowsNonRacikan.Next() {
				var item ResepNonRacikan
				if rowsNonRacikan.Scan(&item.KodeBrng, &item.NamaBrng, &item.Jml, &item.KodeSat, &item.AturanPakai, &item.HJual,
					&item.JenisObat, &item.HBeli, &item.Stok, &item.NamaIndustri, &item.Kategori, &item.Golongan, &item.Kadaluarsa, &item.Kapasitas) == nil {
					item.Embalase = embalaseDefault
					item.Tuslah = tuslahDefault
					item.NoBatch = "-"
					item.NoFaktur = "-"
					item.Subtotal = item.Jml*item.HJual + item.Embalase + item.Tuslah
					result.Total += item.Subtotal
					result.NonRacikan = append(result.NonRacikan, item)
				}
			}
		}

		rowsRacikan, err := db.Query(`
			SELECT resep_dokter_racikan.no_racik, resep_dokter_racikan.nama_racik, resep_dokter_racikan.kd_racik,
				COALESCE(metode_racik.nm_racik,''), resep_dokter_racikan.jml_dr, resep_dokter_racikan.aturan_pakai,
				resep_dokter_racikan.keterangan
			FROM resep_dokter_racikan
			LEFT JOIN metode_racik ON resep_dokter_racikan.kd_racik = metode_racik.kd_racik
			WHERE resep_dokter_racikan.no_resep = ?
			ORDER BY resep_dokter_racikan.no_racik
		`, noResep)
		if err == nil {
			defer rowsRacikan.Close()
			for rowsRacikan.Next() {
				var racikan ResepRacikan
				if rowsRacikan.Scan(&racikan.NoRacik, &racikan.NamaRacik, &racikan.KdRacik, &racikan.MetodeRacik,
					&racikan.JmlDr, &racikan.AturanPakai, &racikan.Keterangan) != nil {
					continue
				}
				racikan.Detail = []ResepRacikanDetail{}

				detailRows, err := db.Query(`
					SELECT resep_dokter_racikan_detail.kode_brng, COALESCE(b.nama_brng,''),
						COALESCE(resep_dokter_racikan_detail.p1,0), COALESCE(resep_dokter_racikan_detail.jml,0),
						COALESCE(b.kode_sat,''), COALESCE(b.`+hargaCol+`,0), `+refCols+`
					FROM resep_dokter_racikan_detail
					INNER JOIN databarang b ON resep_dokter_racikan_detail.kode_brng = b.kode_brng
					`+refJoins+`
					WHERE resep_dokter_racikan_detail.no_resep = ? AND resep_dokter_racikan_detail.no_racik = ?
					ORDER BY b.nama_brng
				`, result.KdBangsal, noResep, racikan.NoRacik)
				if err == nil {
					for detailRows.Next() {
						var d ResepRacikanDetail
						if detailRows.Scan(&d.KodeBrng, &d.NamaBrng, &d.Kandungan, &d.Jml, &d.KodeSat, &d.HJual,
							&d.JenisObat, &d.HBeli, &d.Stok, &d.NamaIndustri, &d.Kategori, &d.Golongan, &d.Kadaluarsa, &d.Kapasitas) == nil {
							d.Embalase = embalaseDefault
							d.Tuslah = tuslahDefault
							d.NoBatch = "-"
							d.NoFaktur = "-"
							d.Subtotal = d.Jml*d.HJual + d.Embalase + d.Tuslah
							result.Total += d.Subtotal
							racikan.Detail = append(racikan.Detail, d)
						}
					}
					detailRows.Close()
				}
				result.Racikan = append(result.Racikan, racikan)
			}
		}

		result.Ppn = result.Total * 0.11
		result.TotalPpn = result.Total + result.Ppn

		c.JSON(http.StatusOK, result)
	}
}

// submitPermintaanResepValidasiRanap — padanan persis
// submitPermintaanResepValidasi (permintaan_resep_handler.go) untuk resep
// ranap. Satu-satunya beda struktural: filter `status='ranap'` (bukan
// 'ralan') dan fallback resolusi depo lewat resolveDepoRanap (bukan
// resolveDepoRalan) — payload request & urutan operasi (catat riwayat SEBELUM
// potong stok, validasi stok cukup, UPSERT racikan, stempel resep_obat
// TERAKHIR) identik, lihat komentar lengkap di submitPermintaanResepValidasi
// untuk rincian penyederhanaan yang disengaja (skip billing/BPJS/jurnal).
func submitPermintaanResepValidasiRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			Petugas string `json:"petugas"`
			Items   []struct {
				KodeBrng string  `json:"kode_brng"`
				Jml      float64 `json:"jml"`
			} `json:"items"`
			RacikanHeaders []struct {
				NoRacik     int     `json:"no_racik"`
				NamaRacik   string  `json:"nama_racik"`
				KdRacik     string  `json:"kd_racik"`
				JmlDr       float64 `json:"jml_dr"`
				AturanPakai string  `json:"aturan_pakai"`
				Keterangan  string  `json:"keterangan"`
			} `json:"racikan_headers"`
			DeletedRacikan []int  `json:"deleted_racikan"`
			KdBangsal      string `json:"kd_bangsal"`
		}
		c.ShouldBindJSON(&body)

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var noRawat, tglPeresepan string
		if err := tx.QueryRow(`SELECT no_rawat, tgl_peresepan FROM resep_obat WHERE no_resep=? AND status='ranap'`, noResep).
			Scan(&noRawat, &tglPeresepan); err != nil {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Resep ranap tidak ditemukan"})
			return
		}

		var noRkmMedis, nmPasien string
		tx.QueryRow(`
			SELECT reg_periksa.no_rkm_medis, pasien.nm_pasien
			FROM reg_periksa INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&noRkmMedis, &nmPasien)

		kdBangsal := strings.TrimSpace(body.KdBangsal)
		if kdBangsal == "" {
			kdBangsal = resolveDepoRanap(db, noRawat)
		}
		if kdBangsal == "" {
			kdBangsal = "AP"
		}
		keteranganRiwayat := strings.TrimSpace(noRawat + " " + noRkmMedis + " " + nmPasien)

		type dispenseLine struct {
			kodeBrng string
			jml      float64
		}
		var lines []dispenseLine

		if len(body.Items) > 0 {
			for _, it := range body.Items {
				if it.Jml > 0 && strings.TrimSpace(it.KodeBrng) != "" {
					lines = append(lines, dispenseLine{kodeBrng: it.KodeBrng, jml: it.Jml})
				}
			}
		} else {
			nonRacikanRows, err := tx.Query(`SELECT kode_brng, COALESCE(jml,0) FROM resep_dokter WHERE no_resep=?`, noResep)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for nonRacikanRows.Next() {
				var l dispenseLine
				if nonRacikanRows.Scan(&l.kodeBrng, &l.jml) == nil && l.jml > 0 {
					lines = append(lines, l)
				}
			}
			nonRacikanRows.Close()

			racikanRows, err := tx.Query(`SELECT kode_brng, COALESCE(jml,0) FROM resep_dokter_racikan_detail WHERE no_resep=?`, noResep)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for racikanRows.Next() {
				var l dispenseLine
				if racikanRows.Scan(&l.kodeBrng, &l.jml) == nil && l.jml > 0 {
					lines = append(lines, l)
				}
			}
			racikanRows.Close()
		}

		if len(lines) == 0 {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Resep ini tidak punya baris obat untuk diserahkan"})
			return
		}

		for _, l := range lines {
			var namaBrng string
			var stokSaatIni float64
			if err := tx.QueryRow(`
				SELECT COALESCE(b.nama_brng,''), COALESCE(gb.stok,0) FROM databarang b
				LEFT JOIN gudangbarang gb ON gb.kode_brng = b.kode_brng AND gb.kd_bangsal = ? AND gb.no_batch = '' AND gb.no_faktur = ''
				WHERE b.kode_brng = ?
			`, kdBangsal, l.kodeBrng).Scan(&namaBrng, &stokSaatIni); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if stokSaatIni < l.jml {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Stok %s di %s tidak cukup untuk diserahkan (stok saat ini: %g, dibutuhkan: %g)", namaBrng, kdBangsal, stokSaatIni, l.jml)})
				return
			}

			if err := catatRiwayatBarangMedis(tx, l.kodeBrng, 0, l.jml, "Pemberian Obat", body.Petugas, kdBangsal, "Simpan", "", "", keteranganRiwayat); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(
				`UPDATE gudangbarang SET stok = stok - ? WHERE kode_brng=? AND kd_bangsal=? AND no_batch='' AND no_faktur=''`,
				l.jml, l.kodeBrng, kdBangsal,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		for _, noRacik := range body.DeletedRacikan {
			if _, err := tx.Exec(`DELETE FROM resep_dokter_racikan_detail WHERE no_resep=? AND no_racik=?`, noResep, noRacik); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if _, err := tx.Exec(`DELETE FROM resep_dokter_racikan WHERE no_resep=? AND no_racik=?`, noResep, noRacik); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		for _, rh := range body.RacikanHeaders {
			if strings.TrimSpace(rh.KdRacik) == "" {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Racikan #%d belum punya Metode Racik yang valid", rh.NoRacik)})
				return
			}
			if _, err := tx.Exec(
				`INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE nama_racik=VALUES(nama_racik), kd_racik=VALUES(kd_racik), jml_dr=VALUES(jml_dr),
				 	aturan_pakai=VALUES(aturan_pakai), keterangan=VALUES(keterangan)`,
				noResep, rh.NoRacik, strings.TrimSpace(rh.NamaRacik), rh.KdRacik, rh.JmlDr, rh.AturanPakai, rh.Keterangan,
			); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if _, err := tx.Exec(`UPDATE resep_obat SET tgl_perawatan = CURDATE(), jam = CURTIME() WHERE no_resep = ?`, noResep); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Obat berhasil diserahkan, stok sudah dikurangi", "kd_bangsal": kdBangsal, "jumlah_item": len(lines)})
	}
}

// ============================================================================
// PERMINTAAN STOK PASIEN (tabMode5/tabMode6, tampil5/tampil6) — permintaan
// stok obat mandiri milik pasien ranap (bukan dari resep dokter, tabel
// terpisah permintaan_stok_obat_pasien). READ-ONLY di sini: aksi
// validasi/serah-terimanya (BtnPemberianObat -> DlgStokPasien.java) BELUM
// diport, dashboard ini murni pemantauan (dikonfirmasi user, prioritas
// dipercepat menutup ke-6 sub-tab dulu). Detail per baris menyertakan
// jadwal jam00-jam23 (centang jam berapa saja obat harus diberikan per
// hari, kolom enum('true','false') di detail_permintaan_stok_obat_pasien).
// ============================================================================

type permintaanStokPasienRow struct {
	NoPermintaan  string `json:"no_permintaan"`
	TglPermintaan string `json:"tgl_permintaan"`
	Jam           string `json:"jam"`
	NoRawat       string `json:"no_rawat"`
	NoRkmMedis    string `json:"no_rkm_medis"`
	NmPasien      string `json:"nm_pasien"`
	KdDokter      string `json:"kd_dokter"`
	NmDokter      string `json:"nm_dokter"`
	Status        string `json:"status"`
	NmBangsal     string `json:"nm_bangsal"`
	KdBangsal     string `json:"kd_bangsal"`
	JenisBayar    string `json:"jenis_bayar"`
}

func getPermintaanStokPasienRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		dokter := strings.TrimSpace(c.Query("dokter"))
		kamar := strings.TrimSpace(c.Query("kamar"))
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		selectCols := `
			permintaan_stok_obat_pasien.no_permintaan, permintaan_stok_obat_pasien.tgl_permintaan, permintaan_stok_obat_pasien.jam,
			permintaan_stok_obat_pasien.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, permintaan_stok_obat_pasien.kd_dokter, dokter.nm_dokter,
			IF(permintaan_stok_obat_pasien.status='Belum','Belum Terlayani','Sudah Terlayani') AS status,
			bangsal.nm_bangsal, kamar.kd_bangsal, penjab.png_jawab
		`
		buildQuery := func(viaGabung bool) (string, []interface{}) {
			joinNoRawat := "reg_periksa.no_rawat = permintaan_stok_obat_pasien.no_rawat"
			joinKamar := "reg_periksa.no_rawat = kamar_inap.no_rawat"
			extraJoin := ""
			if viaGabung {
				extraJoin = " INNER JOIN ranap_gabung ON ranap_gabung.no_rawat2 = permintaan_stok_obat_pasien.no_rawat"
				joinKamar = "ranap_gabung.no_rawat = kamar_inap.no_rawat"
			}
			q := `SELECT ` + selectCols + `
				FROM permintaan_stok_obat_pasien` + extraJoin + `
				INNER JOIN reg_periksa ON ` + joinNoRawat + `
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN dokter ON permintaan_stok_obat_pasien.kd_dokter = dokter.kd_dokter
				INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				INNER JOIN kamar_inap ON ` + joinKamar + `
				INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
				INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
				WHERE kamar_inap.stts_pulang = '-' AND permintaan_stok_obat_pasien.tgl_permintaan BETWEEN ? AND ?
			`
			args := []interface{}{tgl1, tgl2}
			if dokter != "" {
				q += " AND dokter.nm_dokter LIKE ?"
				args = append(args, "%"+dokter+"%")
			}
			if kamar != "" {
				q += " AND bangsal.nm_bangsal LIKE ?"
				args = append(args, "%"+kamar+"%")
			}
			if search != "" {
				q += ` AND (permintaan_stok_obat_pasien.no_permintaan LIKE ? OR permintaan_stok_obat_pasien.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
					OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR penjab.png_jawab LIKE ?)`
				pattern := "%" + search + "%"
				args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
			}
			q += " GROUP BY permintaan_stok_obat_pasien.no_permintaan ORDER BY permintaan_stok_obat_pasien.tgl_permintaan DESC, permintaan_stok_obat_pasien.jam DESC"
			return q, args
		}

		list := []permintaanStokPasienRow{}
		seen := map[string]bool{}
		scanInto := func(q string, args []interface{}) error {
			rows, err := db.Query(q, args...)
			if err != nil {
				return err
			}
			defer rows.Close()
			for rows.Next() {
				var r permintaanStokPasienRow
				if rows.Scan(&r.NoPermintaan, &r.TglPermintaan, &r.Jam, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
					&r.KdDokter, &r.NmDokter, &r.Status, &r.NmBangsal, &r.KdBangsal, &r.JenisBayar) == nil {
					if seen[r.NoPermintaan] {
						continue
					}
					if status == "" || status == r.Status {
						seen[r.NoPermintaan] = true
						list = append(list, r)
					}
				}
			}
			return nil
		}

		q1, args1 := buildQuery(false)
		if err := scanInto(q1, args1); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		q2, args2 := buildQuery(true)
		if err := scanInto(q2, args2); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, list)
	}
}

type stokPasienItem struct {
	KodeBrng    string          `json:"kode_brng"`
	NamaBrng    string          `json:"nama_brng"`
	Jml         float64         `json:"jml"`
	KodeSat     string          `json:"kode_sat"`
	AturanPakai string          `json:"aturan_pakai"`
	Jadwal      map[string]bool `json:"jadwal"` // key "00".."23" -> dicentang atau tidak
}

// getPermintaanStokPasienItems — padanan tampil6()/tabMode6. jam00-jam23
// disimpan Java sebagai enum('true','false') per kolom (24 kolom terpisah,
// bukan bitmask) — diikuti apa adanya, cuma dikemas jadi map di response
// biar gampang dirender sebagai grid centang di frontend.
func getPermintaanStokPasienItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := c.Param("no_permintaan")
		rows, err := db.Query(`
			SELECT databarang.kode_brng, COALESCE(databarang.nama_brng,''), COALESCE(detail_permintaan_stok_obat_pasien.jml,0),
				COALESCE(databarang.kode_sat,''), COALESCE(detail_permintaan_stok_obat_pasien.aturan_pakai,''),
				detail_permintaan_stok_obat_pasien.jam00, detail_permintaan_stok_obat_pasien.jam01, detail_permintaan_stok_obat_pasien.jam02,
				detail_permintaan_stok_obat_pasien.jam03, detail_permintaan_stok_obat_pasien.jam04, detail_permintaan_stok_obat_pasien.jam05,
				detail_permintaan_stok_obat_pasien.jam06, detail_permintaan_stok_obat_pasien.jam07, detail_permintaan_stok_obat_pasien.jam08,
				detail_permintaan_stok_obat_pasien.jam09, detail_permintaan_stok_obat_pasien.jam10, detail_permintaan_stok_obat_pasien.jam11,
				detail_permintaan_stok_obat_pasien.jam12, detail_permintaan_stok_obat_pasien.jam13, detail_permintaan_stok_obat_pasien.jam14,
				detail_permintaan_stok_obat_pasien.jam15, detail_permintaan_stok_obat_pasien.jam16, detail_permintaan_stok_obat_pasien.jam17,
				detail_permintaan_stok_obat_pasien.jam18, detail_permintaan_stok_obat_pasien.jam19, detail_permintaan_stok_obat_pasien.jam20,
				detail_permintaan_stok_obat_pasien.jam21, detail_permintaan_stok_obat_pasien.jam22, detail_permintaan_stok_obat_pasien.jam23
			FROM detail_permintaan_stok_obat_pasien
			INNER JOIN databarang ON detail_permintaan_stok_obat_pasien.kode_brng = databarang.kode_brng
			WHERE detail_permintaan_stok_obat_pasien.no_permintaan = ?
			ORDER BY databarang.kode_brng
		`, noPermintaan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []stokPasienItem{}
		for rows.Next() {
			var it stokPasienItem
			jamVals := make([]string, 24)
			scanArgs := []interface{}{&it.KodeBrng, &it.NamaBrng, &it.Jml, &it.KodeSat, &it.AturanPakai}
			for i := range jamVals {
				scanArgs = append(scanArgs, &jamVals[i])
			}
			if rows.Scan(scanArgs...) != nil {
				continue
			}
			it.Jadwal = map[string]bool{}
			for i, v := range jamVals {
				it.Jadwal[fmt.Sprintf("%02d", i)] = v == "true"
			}
			items = append(items, it)
		}
		c.JSON(http.StatusOK, items)
	}
}

// ============================================================================
// PERMINTAAN RESEP PULANG — DASHBOARD (tabMode7/tabMode8, tampil7/tampil8).
// BEDA dari /api/resep-pulang-req (resep_pulang_handler.go, yang sudah ada
// sebelumnya di proyek ini) — endpoint itu untuk PERAWAT MEMBUAT permintaan
// resep pulang baru (tabel permintaan_resep_pulang juga, hanya lewat form
// input terpisah). Endpoint di bawah ini PADANAN sisi APOTEK: dashboard
// baca-saja atas permintaan yang sudah masuk, sama pola dengan Resep
// Rawat Inap/Permintaan Stok Pasien di atas. Item detailnya (tampil8) TIDAK
// menyertakan racikan (Java cuma query detail_permintaan_resep_pulang,
// beda dari resep_pulang_handler.go yang punya dukungan racikan untuk
// tabel resep_pulang yang lain) — diikuti apa adanya.
// ============================================================================

type permintaanResepPulangDashRow struct {
	NoPermintaan  string `json:"no_permintaan"`
	TglPermintaan string `json:"tgl_permintaan"`
	Jam           string `json:"jam"`
	NoRawat       string `json:"no_rawat"`
	NoRkmMedis    string `json:"no_rkm_medis"`
	NmPasien      string `json:"nm_pasien"`
	KdDokter      string `json:"kd_dokter"`
	NmDokter      string `json:"nm_dokter"`
	Status        string `json:"status"`
	NmBangsal     string `json:"nm_bangsal"`
	KdBangsal     string `json:"kd_bangsal"`
	JenisBayar    string `json:"jenis_bayar"`
}

func getPermintaanResepPulangRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		dokter := strings.TrimSpace(c.Query("dokter"))
		kamar := strings.TrimSpace(c.Query("kamar"))
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		selectCols := `
			permintaan_resep_pulang.no_permintaan, permintaan_resep_pulang.tgl_permintaan, permintaan_resep_pulang.jam,
			permintaan_resep_pulang.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, permintaan_resep_pulang.kd_dokter, dokter.nm_dokter,
			IF(permintaan_resep_pulang.status='Belum','Belum Terlayani','Sudah Terlayani') AS status,
			bangsal.nm_bangsal, kamar.kd_bangsal, penjab.png_jawab
		`
		buildQuery := func(viaGabung bool) (string, []interface{}) {
			joinNoRawat := "reg_periksa.no_rawat = permintaan_resep_pulang.no_rawat"
			joinKamar := "reg_periksa.no_rawat = kamar_inap.no_rawat"
			extraJoin := ""
			if viaGabung {
				extraJoin = " INNER JOIN ranap_gabung ON ranap_gabung.no_rawat2 = permintaan_resep_pulang.no_rawat"
				joinKamar = "ranap_gabung.no_rawat = kamar_inap.no_rawat"
			}
			q := `SELECT ` + selectCols + `
				FROM permintaan_resep_pulang` + extraJoin + `
				INNER JOIN reg_periksa ON ` + joinNoRawat + `
				INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
				INNER JOIN dokter ON permintaan_resep_pulang.kd_dokter = dokter.kd_dokter
				INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
				INNER JOIN kamar_inap ON ` + joinKamar + `
				INNER JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
				INNER JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
				WHERE kamar_inap.stts_pulang = '-' AND permintaan_resep_pulang.tgl_permintaan BETWEEN ? AND ?
			`
			args := []interface{}{tgl1, tgl2}
			if dokter != "" {
				q += " AND dokter.nm_dokter LIKE ?"
				args = append(args, "%"+dokter+"%")
			}
			if kamar != "" {
				q += " AND bangsal.nm_bangsal LIKE ?"
				args = append(args, "%"+kamar+"%")
			}
			if search != "" {
				q += ` AND (permintaan_resep_pulang.no_permintaan LIKE ? OR permintaan_resep_pulang.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
					OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR penjab.png_jawab LIKE ?)`
				pattern := "%" + search + "%"
				args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
			}
			q += " GROUP BY permintaan_resep_pulang.no_permintaan ORDER BY permintaan_resep_pulang.tgl_permintaan DESC, permintaan_resep_pulang.jam DESC"
			return q, args
		}

		list := []permintaanResepPulangDashRow{}
		seen := map[string]bool{}
		scanInto := func(q string, args []interface{}) error {
			rows, err := db.Query(q, args...)
			if err != nil {
				return err
			}
			defer rows.Close()
			for rows.Next() {
				var r permintaanResepPulangDashRow
				if rows.Scan(&r.NoPermintaan, &r.TglPermintaan, &r.Jam, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
					&r.KdDokter, &r.NmDokter, &r.Status, &r.NmBangsal, &r.KdBangsal, &r.JenisBayar) == nil {
					if seen[r.NoPermintaan] {
						continue
					}
					if status == "" || status == r.Status {
						seen[r.NoPermintaan] = true
						list = append(list, r)
					}
				}
			}
			return nil
		}

		q1, args1 := buildQuery(false)
		if err := scanInto(q1, args1); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		q2, args2 := buildQuery(true)
		if err := scanInto(q2, args2); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, list)
	}
}

type resepPulangDashItem struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	Jml      float64 `json:"jml"`
	KodeSat  string  `json:"kode_sat"`
	Dosis    string  `json:"dosis"`
}

func getPermintaanResepPulangRanapItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPermintaan := c.Param("no_permintaan")
		rows, err := db.Query(`
			SELECT databarang.kode_brng, COALESCE(databarang.nama_brng,''), COALESCE(detail_permintaan_resep_pulang.jml,0),
				COALESCE(databarang.kode_sat,''), COALESCE(detail_permintaan_resep_pulang.dosis,'')
			FROM detail_permintaan_resep_pulang
			INNER JOIN databarang ON detail_permintaan_resep_pulang.kode_brng = databarang.kode_brng
			WHERE detail_permintaan_resep_pulang.no_permintaan = ?
			ORDER BY databarang.kode_brng
		`, noPermintaan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []resepPulangDashItem{}
		for rows.Next() {
			var it resepPulangDashItem
			if rows.Scan(&it.KodeBrng, &it.NamaBrng, &it.Jml, &it.KodeSat, &it.Dosis) == nil {
				items = append(items, it)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}
