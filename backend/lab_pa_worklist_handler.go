package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// Detail permintaan + input hasil (padanan getPermintaanLabPKDetail/
// saveHasilLabPK di lab_pk_worklist_handler.go) — dipakai ModalHasilLabPA.tsx.
// ============================================================================

type labPAPermintaanDetailExam struct {
	KdJenisPrw  string `json:"kd_jenis_prw"`
	NmPerawatan string `json:"nm_perawatan"`
}

type labPAHasilItem struct {
	KdJenisPrw     string `json:"kd_jenis_prw"`
	DiagnosaKlinik string `json:"diagnosa_klinik"`
	Makroskopik    string `json:"makroskopik"`
	Mikroskopik    string `json:"mikroskopik"`
	Kesimpulan     string `json:"kesimpulan"`
	Kesan          string `json:"kesan"`
}

// GET /api/lab-pa/permintaan/:noorder — detail 1 permintaan PA (header +
// daftar pemeriksaan + hasil yg sudah pernah diisi kalau ada), padanan
// PERSIS getPermintaanLabPKDetail.
func getPermintaanLabPADetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		var noRawat, noRkmMedis, nmPasien, umur, dokterPerujuk, nmDokter, status, diagnosaKlinis, informasiTambahan string
		var sudahAdaHasil bool
		err := db.QueryRow(`
			SELECT pl.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				COALESCE(
					CONCAT(reg_periksa.umurdaftar, ' ', reg_periksa.sttsumur),
					CONCAT(TIMESTAMPDIFF(YEAR, pasien.tgl_lahir, CURDATE()), ' Th'),
					''
				) as umur,
				pl.dokter_perujuk, IFNULL(dokter.nm_dokter,''), pl.status,
				IFNULL(pl.diagnosa_klinis,''), IFNULL(pl.informasi_tambahan,''),
				IF(pl.tgl_hasil='0000-00-00', 0, 1)
			FROM permintaan_labpa pl
			INNER JOIN reg_periksa ON pl.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
			WHERE pl.noorder = ?
		`, noOrder).Scan(&noRawat, &noRkmMedis, &nmPasien, &umur, &dokterPerujuk, &nmDokter, &status, &diagnosaKlinis, &informasiTambahan, &sudahAdaHasil)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab PA tidak ditemukan"})
			return
		}

		rows, err := db.Query(`
			SELECT ppl.kd_jenis_prw, IFNULL(jpl.nm_perawatan, ppl.kd_jenis_prw)
			FROM permintaan_pemeriksaan_labpa ppl
			LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
			WHERE ppl.noorder = ?
		`, noOrder)
		exams := []labPAPermintaanDetailExam{}
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e labPAPermintaanDetailExam
				if rows.Scan(&e.KdJenisPrw, &e.NmPerawatan) == nil {
					exams = append(exams, e)
				}
			}
		}

		// Dokter P.J. (Penanggung Jawab Lab) — default dari set_pjlab.kd_dokterlab,
		// sama pola dgn PK. Tetap bisa diganti manual di frontend.
		var kdDokterPj, nmDokterPj string
		db.QueryRow(`
			SELECT sp.kd_dokterlab, IFNULL(d.nm_dokter,'')
			FROM set_pjlab sp LEFT JOIN dokter d ON sp.kd_dokterlab = d.kd_dokter
			LIMIT 1
		`).Scan(&kdDokterPj, &nmDokterPj)

		// Hasil yang sudah pernah diisi (kalau ada) — prefill per kd_jenis_prw,
		// diambil dari sesi tgl_periksa/jam TERBARU (sama pola PK, tapi
		// dicocokkan via kd_jenis_prw krn detail_periksa_labpa bukan per-baris
		// parameter spt lab PK, melainkan 1 baris hasil per pemeriksaan).
		hasilList := []labPAHasilItem{}
		if sudahAdaHasil {
			hRows, err := db.Query(`
				SELECT kd_jenis_prw, IFNULL(diagnosa_klinik,''), IFNULL(makroskopik,''), IFNULL(mikroskopik,''), IFNULL(kesimpulan,''), IFNULL(kesan,'')
				FROM detail_periksa_labpa
				WHERE no_rawat = ?
				ORDER BY tgl_periksa DESC, jam DESC
			`, noRawat)
			if err == nil {
				defer hRows.Close()
				for hRows.Next() {
					var h labPAHasilItem
					if hRows.Scan(&h.KdJenisPrw, &h.DiagnosaKlinik, &h.Makroskopik, &h.Mikroskopik, &h.Kesimpulan, &h.Kesan) == nil {
						hasilList = append(hasilList, h)
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder": noOrder, "no_rawat": noRawat, "no_rkm_medis": noRkmMedis, "nm_pasien": nmPasien, "umur": umur,
			"dokter_perujuk": dokterPerujuk, "nm_dokter": nmDokter, "status": status,
			"diagnosa_klinis": diagnosaKlinis, "informasi_tambahan": informasiTambahan,
			"sudah_ada_hasil": sudahAdaHasil,
			"pemeriksaan":     exams,
			"kd_dokter_pj":    kdDokterPj, "nm_dokter_pj": nmDokterPj,
			"hasil": hasilList,
		})
	}
}

type saveHasilLabPARequest struct {
	NoOrder     string           `json:"noorder" binding:"required"`
	NoRawat     string           `json:"no_rawat" binding:"required"`
	Nip         string           `json:"nip" binding:"required"`
	KdDokter    string           `json:"kd_dokter" binding:"required"`
	Pemeriksaan []labPAHasilItem `json:"pemeriksaan"`
	Tgl         string           `json:"tgl"` // opsional — kosong = waktu sekarang
	Jam         string           `json:"jam"`
}

// POST /api/lab-pa/hasil — simpan hasil pemeriksaan lab PA. Utk tiap
// pemeriksaan: INSERT periksa_lab (snapshot tarif dari jns_perawatan_lab,
// kategori='PA') + INSERT/UPDATE detail_periksa_labpa (diagnosa_klinik/
// makroskopik/mikroskopik/kesimpulan/kesan). Terakhir UPDATE
// permintaan_labpa.tgl_hasil/jam_hasil. Padanan PERSIS saveHasilLabPK, cuma
// beda badan hasilnya (narasi PA, bukan nilai parameter numerik).
func saveHasilLabPA(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req saveHasilLabPARequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Pemeriksaan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Isi minimal satu pemeriksaan"})
			return
		}

		var dokterPerujuk, statusLower string
		if err := db.QueryRow(`SELECT dokter_perujuk, status FROM permintaan_labpa WHERE noorder = ?`, req.NoOrder).
			Scan(&dokterPerujuk, &statusLower); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab PA tidak ditemukan"})
			return
		}
		// periksa_lab.status enum-nya 'Ranap'/'Ralan' (kapital),
		// permintaan_labpa.status 'ralan'/'ranap' (huruf kecil) — sama pola
		// beda casing dgn PK, disamakan di sini.
		statusPeriksa := "Ralan"
		if strings.EqualFold(statusLower, "ranap") {
			statusPeriksa = "Ranap"
		}

		now := time.Now()
		tglPeriksa := req.Tgl
		if tglPeriksa == "" {
			tglPeriksa = now.Format("2006-01-02")
		}
		jam := req.Jam
		if jam == "" {
			jam = now.Format("15:04:05")
		} else if len(jam) == 5 {
			jam += ":00"
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		for _, exam := range req.Pemeriksaan {
			var bagianRs, bhp, tarifPerujuk, tarifTindakanDokter, tarifTindakanPetugas, kso, menejemen, totalByr float64
			err := tx.QueryRow(`
				SELECT IFNULL(bagian_rs,0), bhp, tarif_perujuk, tarif_tindakan_dokter,
					IFNULL(tarif_tindakan_petugas,0), IFNULL(kso,0), IFNULL(menejemen,0), IFNULL(total_byr,0)
				FROM jns_perawatan_lab WHERE kd_jenis_prw = ?
			`, exam.KdJenisPrw).Scan(&bagianRs, &bhp, &tarifPerujuk, &tarifTindakanDokter, &tarifTindakanPetugas, &kso, &menejemen, &totalByr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis pemeriksaan " + exam.KdJenisPrw + " tidak ditemukan"})
				return
			}

			_, err = tx.Exec(`
				INSERT INTO periksa_lab (
					no_rawat, nip, kd_jenis_prw, tgl_periksa, jam, dokter_perujuk,
					bagian_rs, bhp, tarif_perujuk, tarif_tindakan_dokter, tarif_tindakan_petugas,
					kso, menejemen, biaya, kd_dokter, status, kategori
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PA')
				ON DUPLICATE KEY UPDATE
					bagian_rs=VALUES(bagian_rs), bhp=VALUES(bhp), tarif_perujuk=VALUES(tarif_perujuk),
					tarif_tindakan_dokter=VALUES(tarif_tindakan_dokter), tarif_tindakan_petugas=VALUES(tarif_tindakan_petugas),
					kso=VALUES(kso), menejemen=VALUES(menejemen), biaya=VALUES(biaya),
					kd_dokter=VALUES(kd_dokter), status=VALUES(status)
			`, req.NoRawat, req.Nip, exam.KdJenisPrw, tglPeriksa, jam, dokterPerujuk,
				bagianRs, bhp, tarifPerujuk, tarifTindakanDokter, tarifTindakanPetugas,
				kso, menejemen, totalByr, req.KdDokter, statusPeriksa,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pemeriksaan " + exam.KdJenisPrw + ": " + err.Error()})
				return
			}

			_, err = tx.Exec(`
				INSERT INTO detail_periksa_labpa (
					no_rawat, kd_jenis_prw, tgl_periksa, jam,
					diagnosa_klinik, makroskopik, mikroskopik, kesimpulan, kesan
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE
					diagnosa_klinik=VALUES(diagnosa_klinik), makroskopik=VALUES(makroskopik),
					mikroskopik=VALUES(mikroskopik), kesimpulan=VALUES(kesimpulan), kesan=VALUES(kesan)
			`, req.NoRawat, exam.KdJenisPrw, tglPeriksa, jam,
				exam.DiagnosaKlinik, exam.Makroskopik, exam.Mikroskopik, exam.Kesimpulan, exam.Kesan,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan detail hasil: " + err.Error()})
				return
			}
		}

		_, err = tx.Exec(`UPDATE permintaan_labpa SET tgl_hasil = ?, jam_hasil = ? WHERE noorder = ?`, tglPeriksa, jam, req.NoOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status permintaan: " + err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Hasil pemeriksaan lab PA berhasil disimpan"})
	}
}

// lab_pa_worklist_handler.go — dipakai modul LaboratoriumPA.tsx (worklist
// departemen Laboratorium PA lintas pasien). Padanan PERSIS pola
// lab_pk_worklist_handler.go (getPermintaanLabPKList/setSampelLabPK) tapi
// sumber tabelnya permintaan_labpa/permintaan_pemeriksaan_labpa (bukan
// permintaan_lab/permintaan_pemeriksaan_lab) — kolom2 KHAS PA (pengambilan
// bahan, diperoleh dengan, lokasi jaringan, diawetkan dengan, riwayat PA
// sebelumnya) ikut ditampilkan sesuai header tabel Khanza Desktop yg
// dikirim user. Permintaan baru dibuat dari layar pasien (LabTab.tsx >
// ModalInputLab.tsx), bukan dari modul ini. Input hasil PA (Diagnosa
// Klinis/Makroskopik/Mikroskopik/Kesimpulan/Kesan) menyusul terpisah.

type permintaanLabPAQueueRow struct {
	NoOrder              string `json:"noorder"`
	NoRawat              string `json:"no_rawat"`
	NoRkmMedis           string `json:"no_rkm_medis"`
	NmPasien             string `json:"nm_pasien"`
	TglPermintaan        string `json:"tgl_permintaan"`
	JamPermintaan        string `json:"jam_permintaan"`
	TglSampel            string `json:"tgl_sampel"`
	JamSampel            string `json:"jam_sampel"`
	TglHasil             string `json:"tgl_hasil"`
	JamHasil             string `json:"jam_hasil"`
	KdDokter             string `json:"kd_dokter"` // dokter_perujuk, mentah
	NmDokter             string `json:"nm_dokter"`
	PoliRegistrasi       string `json:"poli_registrasi"`
	InformasiTambahan    string `json:"informasi_tambahan"`
	DiagnosisKlinis      string `json:"diagnosa_klinis"`
	KdPj                 string `json:"kd_pj"`
	PngJawab             string `json:"png_jawab"`
	TglBahan             string `json:"tgl_pengambilan_bahan"`
	DiperolehDengan      string `json:"diperoleh_dengan"`
	LokasiJaringan       string `json:"lokasi_jaringan"`
	DiawetkanDengan      string `json:"diawetkan_dengan"`
	PernahDilakukanDi    string `json:"pernah_dilakukan_di"`
	TanggalPaSebelumnya  string `json:"tanggal_pa_sebelumnya"`
	NomorPaSebelumnya    string `json:"nomor_pa_sebelumnya"`
	DiagnosaPaSebelumnya string `json:"diagnosa_pa_sebelumnya"`
	Rawat                string `json:"rawat"` // 'ralan'/'ranap' — permintaan_labpa.status mentah
	Pemeriksaan          string `json:"pemeriksaan"`
}

// getPermintaanLabPAList — antrean permintaan lab PA lintas pasien, dgn tab
// Rawat Jalan/Rawat Inap (padanan persis getPermintaanLabPKList).
func getPermintaanLabPAList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := c.Query("tgl1")
		tgl2 := c.Query("tgl2")
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		status := c.Query("status")
		search := c.Query("search")
		rawat := c.Query("rawat")

		query := `
			SELECT pl.noorder, pl.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				DATE_FORMAT(pl.tgl_permintaan,'%Y-%m-%d'), IF(pl.jam_permintaan='00:00:00','',pl.jam_permintaan),
				IF(pl.tgl_sampel='0000-00-00','',DATE_FORMAT(pl.tgl_sampel,'%Y-%m-%d')), IF(pl.jam_sampel='00:00:00','',pl.jam_sampel),
				IF(pl.tgl_hasil='0000-00-00','',DATE_FORMAT(pl.tgl_hasil,'%Y-%m-%d')), IF(pl.jam_hasil='00:00:00','',pl.jam_hasil),
				pl.dokter_perujuk, IFNULL(dokter.nm_dokter,'-'),
				IFNULL(poliklinik.nm_poli,''), IFNULL(pl.informasi_tambahan,''), IFNULL(pl.diagnosa_klinis,''),
				reg_periksa.kd_pj, IFNULL(penjab.png_jawab,''),
				IF(pl.pengambilan_bahan='0000-00-00','',DATE_FORMAT(pl.pengambilan_bahan,'%Y-%m-%d')),
				IFNULL(pl.diperoleh_dengan,''), IFNULL(pl.lokasi_jaringan,''), IFNULL(pl.diawetkan_dengan,''),
				IFNULL(pl.pernah_dilakukan_di,''),
				IF(pl.tanggal_pa_sebelumnya='0000-00-00','',DATE_FORMAT(pl.tanggal_pa_sebelumnya,'%Y-%m-%d')),
				IFNULL(pl.nomor_pa_sebelumnya,''), IFNULL(pl.diagnosa_pa_sebelumnya,''),
				pl.status, IFNULL(prw.pemeriksaan,'')
			FROM permintaan_labpa pl
			INNER JOIN reg_periksa ON pl.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
			LEFT JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			LEFT JOIN (
				SELECT ppl.noorder, GROUP_CONCAT(IFNULL(jpl.nm_perawatan, ppl.kd_jenis_prw) SEPARATOR ', ') AS pemeriksaan
				FROM permintaan_pemeriksaan_labpa ppl
				LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
				GROUP BY ppl.noorder
			) prw ON pl.noorder = prw.noorder
			WHERE pl.tgl_permintaan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if rawat == "ralan" || rawat == "ranap" {
			query += " AND pl.status = ?"
			args = append(args, rawat)
		}
		if search != "" {
			query += ` AND (pl.noorder LIKE ? OR pl.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR pl.diagnosa_klinis LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []permintaanLabPAQueueRow{}
		for rows.Next() {
			var r permintaanLabPAQueueRow
			var statusHasil string
			if rows.Scan(&r.NoOrder, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.TglPermintaan, &r.JamPermintaan, &r.TglSampel, &r.JamSampel, &r.TglHasil, &r.JamHasil,
				&r.KdDokter, &r.NmDokter, &r.PoliRegistrasi, &r.InformasiTambahan, &r.DiagnosisKlinis,
				&r.KdPj, &r.PngJawab, &r.TglBahan, &r.DiperolehDengan, &r.LokasiJaringan, &r.DiawetkanDengan,
				&r.PernahDilakukanDi, &r.TanggalPaSebelumnya, &r.NomorPaSebelumnya, &r.DiagnosaPaSebelumnya,
				&r.Rawat, &r.Pemeriksaan) == nil {
				statusHasil = "Belum Diperiksa"
				if r.TglHasil != "" {
					statusHasil = "Sudah Diperiksa"
				}
				if status == "" || status == statusHasil {
					list = append(list, r)
				}
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/lab-pa/sampel/:noorder — tombol "+Sampel" di LaboratoriumPA.tsx,
// padanan setSampelLabPK tapi utk permintaan_labpa.
func setSampelLabPA(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		var body struct {
			Tgl string `json:"tgl"`
			Jam string `json:"jam"`
		}
		_ = c.ShouldBindJSON(&body)
		now := time.Now()
		tgl := body.Tgl
		if tgl == "" {
			tgl = now.Format("2006-01-02")
		}
		jam := body.Jam
		if jam == "" {
			jam = now.Format("15:04:05")
		} else if len(jam) == 5 {
			jam += ":00"
		}
		result, err := db.Exec(
			`UPDATE permintaan_labpa SET tgl_sampel = ?, jam_sampel = ? WHERE noorder = ?`,
			tgl, jam, noOrder,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := result.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab PA tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Waktu sampel berhasil dicatat"})
	}
}
