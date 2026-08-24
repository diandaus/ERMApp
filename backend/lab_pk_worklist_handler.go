package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// lab_pk_worklist_handler.go — dipakai modul LaboratoriumPK.tsx (worklist
// departemen Laboratorium PK lintas pasien). Padanan DlgCariPermintaanLab.java
// (Khanza Desktop) utk daftar/cari, ditambah alur input hasil (padanan
// DlgPeriksaLab.java, tidak ada di source yang dikirim tapi mengikuti pola
// yang sudah dipakai Radiologi: INSERT periksa_lab (snapshot tarif per
// pemeriksaan dari jns_perawatan_lab) + INSERT detail_periksa_lab (nilai per
// parameter, snapshot dari template_laboratorium) + UPDATE
// permintaan_lab.tgl_hasil/jam_hasil (penanda "Sudah Diperiksa"). SENGAJA
// TIDAK posting ke jurnal akuntansi, sama seperti modul klinis lain di app
// ini (Radiologi/Tindakan). Permintaan baru dibuat dari layar pasien
// (LabTab.tsx > ModalInputLab.tsx), bukan dari modul ini.

type permintaanLabPKQueueRow struct {
	NoOrder           string `json:"noorder"`
	TglPermintaan     string `json:"tgl_permintaan"`
	JamPermintaan     string `json:"jam_permintaan"`
	NoRawat           string `json:"no_rawat"`
	NoRkmMedis        string `json:"no_rkm_medis"`
	NmPasien          string `json:"nm_pasien"`
	KdDokter          string `json:"kd_dokter"`
	NmDokter          string `json:"nm_dokter"`
	Status            string `json:"status"` // "Belum Diperiksa" / "Sudah Diperiksa"
	DiagnosisKlinis   string `json:"diagnosa_klinis"`
	Rawat             string `json:"rawat"` // 'ralan'/'ranap' — permintaan_lab.status mentah
	TglSampel         string `json:"tgl_sampel"`
	JamSampel         string `json:"jam_sampel"`
	KdPj              string `json:"kd_pj"`
	PngJawab          string `json:"png_jawab"`
	InformasiTambahan string `json:"informasi_tambahan"`
	Ruang             string `json:"ruang"` // poli (ralan) atau kamar+bangsal (ranap)
	TglHasil          string `json:"tgl_hasil"`
	JamHasil          string `json:"jam_hasil"`
	Pemeriksaan       string `json:"pemeriksaan"` // nama jenis pemeriksaan, digabung koma
}

// getPermintaanLabPKList — antrean permintaan lab PK lintas pasien. Padanan
// tampil() di DlgCariPermintaanLab.java, ditambah tab Rawat Jalan/Rawat Inap
// (Java yang dikirim hardcode status='ralan' saja) supaya konsisten dgn
// Radiologi.tsx.
func getPermintaanLabPKList(db *sql.DB) gin.HandlerFunc {
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
			SELECT pl.noorder, DATE_FORMAT(pl.tgl_permintaan,'%Y-%m-%d'), IF(pl.jam_permintaan='00:00:00','',pl.jam_permintaan),
				pl.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				pl.dokter_perujuk, IFNULL(dokter.nm_dokter,'-'),
				IF(pl.tgl_hasil='0000-00-00','Belum Diperiksa','Sudah Diperiksa') AS status,
				IFNULL(pl.diagnosa_klinis,''), pl.status,
				IF(pl.tgl_sampel='0000-00-00','',DATE_FORMAT(pl.tgl_sampel,'%Y-%m-%d')), IF(pl.jam_sampel='00:00:00','',pl.jam_sampel),
				reg_periksa.kd_pj, IFNULL(penjab.png_jawab,''), IFNULL(pl.informasi_tambahan,''),
				CASE WHEN pl.status='ranap' THEN CONCAT(IFNULL(ki_last.kd_kamar,''),' ',IFNULL(bangsal.nm_bangsal,'Ranap Gabung'))
					ELSE IFNULL(poliklinik.nm_poli,'') END AS ruang,
				IF(pl.tgl_hasil='0000-00-00','',DATE_FORMAT(pl.tgl_hasil,'%Y-%m-%d')), IF(pl.jam_hasil='00:00:00','',pl.jam_hasil),
				IFNULL(prw.pemeriksaan,'')
			FROM permintaan_lab pl
			INNER JOIN reg_periksa ON pl.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
			LEFT JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			LEFT JOIN (
				SELECT kamar_inap.no_rawat, kamar_inap.kd_kamar FROM kamar_inap
				INNER JOIN (SELECT no_rawat, MAX(CONCAT(tgl_masuk,' ',jam_masuk)) AS max_masuk FROM kamar_inap GROUP BY no_rawat) latest
					ON kamar_inap.no_rawat = latest.no_rawat AND CONCAT(kamar_inap.tgl_masuk,' ',kamar_inap.jam_masuk) = latest.max_masuk
			) ki_last ON reg_periksa.no_rawat = ki_last.no_rawat
			LEFT JOIN kamar ON ki_last.kd_kamar = kamar.kd_kamar
			LEFT JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
			LEFT JOIN (
				SELECT ppl.noorder, GROUP_CONCAT(IFNULL(jpl.nm_perawatan, ppl.kd_jenis_prw) SEPARATOR ', ') AS pemeriksaan
				FROM permintaan_pemeriksaan_lab ppl
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
		list := []permintaanLabPKQueueRow{}
		for rows.Next() {
			var r permintaanLabPKQueueRow
			if rows.Scan(&r.NoOrder, &r.TglPermintaan, &r.JamPermintaan, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.KdDokter, &r.NmDokter, &r.Status, &r.DiagnosisKlinis, &r.Rawat,
				&r.TglSampel, &r.JamSampel, &r.KdPj, &r.PngJawab, &r.InformasiTambahan, &r.Ruang,
				&r.TglHasil, &r.JamHasil, &r.Pemeriksaan) == nil {
				if status == "" || status == r.Status {
					list = append(list, r)
				}
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// POST /api/lab-pk/sampel/:noorder — tombol "+Sampel" di LaboratoriumPK.tsx,
// padanan WindowAmbilSampel di DlgCariPermintaanLab.java: tandai waktu
// sampel diambil (tgl_sampel/jam_sampel), sebelum hasil diisi. Body tgl/jam
// opsional — kosong berarti pakai waktu sekarang.
func setSampelLabPK(db *sql.DB) gin.HandlerFunc {
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
			`UPDATE permintaan_lab SET tgl_sampel = ?, jam_sampel = ? WHERE noorder = ?`,
			tgl, jam, noOrder,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := result.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Waktu sampel berhasil dicatat"})
	}
}

type labPKPermintaanDetailExam struct {
	KdJenisPrw  string `json:"kd_jenis_prw"`
	NmPerawatan string `json:"nm_perawatan"`
}

// GET /api/lab-pk/permintaan/:noorder — detail 1 permintaan (header + daftar
// pemeriksaan) buat modal Input Hasil di LaboratoriumPK.tsx. Daftar
// parameter per pemeriksaan (template_laboratorium) dimuat terpisah di
// frontend lewat /api/lab/template?kd_jenis_prw= yang sudah ada (dipakai
// juga ModalInputLab.tsx), supaya tidak duplikasi logic gabung template.
func getPermintaanLabPKDetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}
		// sudah_ada_hasil dihitung DI SQL (bukan bandingkan string tgl_hasil di
		// Go) — koneksi DB ini pakai parseTime=true, jadi kolom DATE zero-value
		// '0000-00-00' datang ke Go sbg time.Time{} (bukan literal string
		// "0000-00-00"), bikin perbandingan string di sisi Go salah terus.
		var noRawat, noRkmMedis, nmPasien, dokterPerujuk, nmDokter, status, diagnosaKlinis, informasiTambahan string
		var sudahAdaHasil bool
		err := db.QueryRow(`
			SELECT pl.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien,
				pl.dokter_perujuk, IFNULL(dokter.nm_dokter,''), pl.status,
				IFNULL(pl.diagnosa_klinis,''), IFNULL(pl.informasi_tambahan,''),
				IF(pl.tgl_hasil='0000-00-00', 0, 1)
			FROM permintaan_lab pl
			INNER JOIN reg_periksa ON pl.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
			WHERE pl.noorder = ?
		`, noOrder).Scan(&noRawat, &noRkmMedis, &nmPasien, &dokterPerujuk, &nmDokter, &status, &diagnosaKlinis, &informasiTambahan, &sudahAdaHasil)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab tidak ditemukan"})
			return
		}

		rows, err := db.Query(`
			SELECT ppl.kd_jenis_prw, IFNULL(jpl.nm_perawatan, ppl.kd_jenis_prw)
			FROM permintaan_pemeriksaan_lab ppl
			LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
			WHERE ppl.noorder = ?
		`, noOrder)
		exams := []labPKPermintaanDetailExam{}
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e labPKPermintaanDetailExam
				if rows.Scan(&e.KdJenisPrw, &e.NmPerawatan) == nil {
					exams = append(exams, e)
				}
			}
		}

		// Dokter P.J. (Penanggung Jawab Lab) — default dari
		// set_pjlab.kd_dokterlab. Tetap bisa diganti manual di frontend.
		var kdDokterPj, nmDokterPj string
		db.QueryRow(`
			SELECT sp.kd_dokterlab, IFNULL(d.nm_dokter,'')
			FROM set_pjlab sp LEFT JOIN dokter d ON sp.kd_dokterlab = d.kd_dokter
			LIMIT 1
		`).Scan(&kdDokterPj, &nmDokterPj)

		// Hasil yang sudah pernah diisi (kalau ada) — dipakai modal "Lihat
		// Hasil" utk prefill nilai per parameter, dicocokkan di frontend
		// berdasarkan nama Pemeriksaan (sama sumber tabel template_laboratorium
		// spt daftar parameter, jadi namanya pasti sama persis).
		type hasilNilaiItem struct {
			Pemeriksaan string `json:"pemeriksaan"`
			Nilai       string `json:"nilai"`
			Keterangan  string `json:"keterangan"`
		}
		hasilNilai := []hasilNilaiItem{}
		if sudahAdaHasil {
			hRows, err := db.Query(`
				SELECT tl.Pemeriksaan, dpl.nilai, dpl.keterangan
				FROM detail_periksa_lab dpl
				INNER JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
				WHERE dpl.no_rawat = ?
				ORDER BY dpl.tgl_periksa DESC, dpl.jam DESC
			`, noRawat)
			if err == nil {
				defer hRows.Close()
				for hRows.Next() {
					var h hasilNilaiItem
					if hRows.Scan(&h.Pemeriksaan, &h.Nilai, &h.Keterangan) == nil {
						hasilNilai = append(hasilNilai, h)
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"noorder": noOrder, "no_rawat": noRawat, "no_rkm_medis": noRkmMedis, "nm_pasien": nmPasien,
			"dokter_perujuk": dokterPerujuk, "nm_dokter": nmDokter, "status": status,
			"diagnosa_klinis": diagnosaKlinis, "informasi_tambahan": informasiTambahan,
			"sudah_ada_hasil": sudahAdaHasil,
			"pemeriksaan":     exams,
			"kd_dokter_pj":    kdDokterPj, "nm_dokter_pj": nmDokterPj,
			"hasil_nilai": hasilNilai,
		})
	}
}

type hasilLabPKDetailInput struct {
	IdTemplate int    `json:"id_template" binding:"required"`
	Nilai      string `json:"nilai"`
	Keterangan string `json:"keterangan"`
}

type hasilLabPKExamInput struct {
	KdJenisPrw string                  `json:"kd_jenis_prw" binding:"required"`
	Detail     []hasilLabPKDetailInput `json:"detail"`
}

type saveHasilLabPKRequest struct {
	NoOrder     string                `json:"noorder" binding:"required"`
	NoRawat     string                `json:"no_rawat" binding:"required"`
	Nip         string                `json:"nip" binding:"required"`
	KdDokter    string                `json:"kd_dokter" binding:"required"`
	Pemeriksaan []hasilLabPKExamInput `json:"pemeriksaan"`
	Tgl         string                `json:"tgl"` // opsional — kosong = waktu sekarang
	Jam         string                `json:"jam"`
}

// POST /api/lab-pk/hasil — simpan hasil pemeriksaan lab PK. Utk tiap
// pemeriksaan: INSERT periksa_lab (snapshot tarif dari jns_perawatan_lab,
// kategori='PK') + INSERT detail_periksa_lab per parameter (snapshot biaya
// dari template_laboratorium, nilai_rujukan dipilih otomatis dari kolom
// LD/LA/PD/PA sesuai jenis kelamin+umur pasien — padanan logic Khanza yg
// menampilkan nilai rujukan sesuai kategori pasien, bukan keempatnya
// sekaligus). Terakhir UPDATE permintaan_lab.tgl_hasil/jam_hasil.
func saveHasilLabPK(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req saveHasilLabPKRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Pemeriksaan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Isi minimal satu pemeriksaan"})
			return
		}

		var dokterPerujuk, statusLower string
		if err := db.QueryRow(`SELECT dokter_perujuk, status FROM permintaan_lab WHERE noorder = ?`, req.NoOrder).
			Scan(&dokterPerujuk, &statusLower); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab tidak ditemukan"})
			return
		}
		// periksa_lab.status enum-nya 'Ranap'/'Ralan' (kapital),
		// permintaan_lab.status 'ralan'/'ranap' (huruf kecil) — beda casing
		// dari skema Khanza asli, disamakan di sini.
		statusPeriksa := "Ralan"
		if strings.EqualFold(statusLower, "ranap") {
			statusPeriksa = "Ranap"
		}

		// Kunci pemilihan nilai_rujukan: L/P (jenis kelamin) + D/A (dewasa
		// >=18th / anak <18th, dihitung dari tgl_lahir). Dipakai memilih salah
		// satu dari 4 kolom nilai_rujukan_ld/la/pd/pa di template_laboratorium
		// per baris parameter, bukan menampilkan keempatnya.
		rujukanKey := "ld"
		var jk, tglLahir string
		if db.QueryRow(`
			SELECT IFNULL(pasien.jk,''), IFNULL(pasien.tgl_lahir,'')
			FROM reg_periksa INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			WHERE reg_periksa.no_rawat = ?
		`, req.NoRawat).Scan(&jk, &tglLahir) == nil {
			dewasa := true
			if t, err := time.Parse("2006-01-02", tglLahir); err == nil {
				age := time.Since(t).Hours() / 24 / 365.25
				dewasa = age >= 18
			}
			switch {
			case jk == "L" && dewasa:
				rujukanKey = "ld"
			case jk == "L" && !dewasa:
				rujukanKey = "la"
			case jk == "P" && dewasa:
				rujukanKey = "pd"
			case jk == "P" && !dewasa:
				rujukanKey = "pa"
			}
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
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PK')
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

			for _, d := range exam.Detail {
				var bagianRsT, bhpT, bagianPerujukT, bagianDokterT, bagianLaboratT, ksoT, menejemenT, biayaItemT float64
				var rujLd, rujLa, rujPd, rujPa string
				err := tx.QueryRow(`
					SELECT IFNULL(bagian_rs,0), bhp, IFNULL(bagian_perujuk,0), IFNULL(bagian_dokter,0), IFNULL(bagian_laborat,0),
						IFNULL(kso,0), IFNULL(menejemen,0), biaya_item,
						nilai_rujukan_ld, nilai_rujukan_la, nilai_rujukan_pd, nilai_rujukan_pa
					FROM template_laboratorium WHERE id_template = ?
				`, d.IdTemplate).Scan(&bagianRsT, &bhpT, &bagianPerujukT, &bagianDokterT, &bagianLaboratT, &ksoT, &menejemenT, &biayaItemT,
					&rujLd, &rujLa, &rujPd, &rujPa)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter template tidak ditemukan"})
					return
				}
				nilaiRujukan := map[string]string{"ld": rujLd, "la": rujLa, "pd": rujPd, "pa": rujPa}[rujukanKey]
				if nilaiRujukan == "" {
					// Fallback kalau kolom yang dipilih kosong (data admin belum
					// lengkap) — pakai yang pertama tersedia drpd kosong total.
					for _, v := range []string{rujLd, rujLa, rujPd, rujPa} {
						if v != "" {
							nilaiRujukan = v
							break
						}
					}
				}

				_, err = tx.Exec(`
					INSERT INTO detail_periksa_lab (
						no_rawat, kd_jenis_prw, tgl_periksa, jam, id_template,
						nilai, nilai_rujukan, keterangan,
						bagian_rs, bhp, bagian_perujuk, bagian_dokter, bagian_laborat, kso, menejemen, biaya_item
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON DUPLICATE KEY UPDATE nilai=VALUES(nilai), nilai_rujukan=VALUES(nilai_rujukan), keterangan=VALUES(keterangan)
				`, req.NoRawat, exam.KdJenisPrw, tglPeriksa, jam, d.IdTemplate,
					d.Nilai, nilaiRujukan, d.Keterangan,
					bagianRsT, bhpT, bagianPerujukT, bagianDokterT, bagianLaboratT, ksoT, menejemenT, biayaItemT,
				)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan detail hasil: " + err.Error()})
					return
				}
			}
		}

		_, err = tx.Exec(`UPDATE permintaan_lab SET tgl_hasil = ?, jam_hasil = ? WHERE noorder = ?`, tglPeriksa, jam, req.NoOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status permintaan: " + err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Hasil pemeriksaan lab PK berhasil disimpan"})
	}
}

type cetakHasilLabPKItem struct {
	KdJenisPrw   string `json:"kd_jenis_prw"`
	NmPerawatan  string `json:"nm_perawatan"`
	Pemeriksaan  string `json:"pemeriksaan"`
	Hasil        string `json:"hasil"`
	Satuan       string `json:"satuan"`
	NilaiRujukan string `json:"nilai_rujukan"`
	Keterangan   string `json:"keterangan"`
}

// GET /api/lab-pk/cetak/:noorder — data cetak "HASIL PEMERIKSAAN
// LABORATORIUM", padanan getCetakHasilRadiologi (radiologi_hasil_handler.go)
// tapi hasilnya tabel per parameter (detail_periksa_lab + template_laboratorium)
// bukan teks bebas. Selalu ambil sesi periksa_lab TERBARU utk no_rawat ini
// (konsisten dgn pola "hasil terakhir" radiologi), bukan noorder yg sedang
// dibuka — supaya cetak ulang tetap benar walau permintaan ini sudah lama.
func getCetakHasilLabPK(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noOrder := c.Param("noorder")
		if noOrder == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "noorder wajib diisi"})
			return
		}

		var noRawat, dokterPerujukOrder string
		if err := db.QueryRow(`SELECT no_rawat, dokter_perujuk FROM permintaan_lab WHERE noorder = ?`, noOrder).
			Scan(&noRawat, &dokterPerujukOrder); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan lab tidak ditemukan"})
			return
		}

		var tglPeriksa, jam string
		if err := db.QueryRow(`
			SELECT DATE_FORMAT(tgl_periksa,'%Y-%m-%d'), jam FROM periksa_lab WHERE no_rawat = ?
			ORDER BY tgl_periksa DESC, jam DESC LIMIT 1
		`, noRawat).Scan(&tglPeriksa, &jam); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Belum ada hasil pemeriksaan untuk order ini"})
			return
		}

		rows, err := db.Query(`
			SELECT pl.kd_jenis_prw, IFNULL(jpl.nm_perawatan, pl.kd_jenis_prw),
				pl.kd_dokter, IFNULL(dpj.nm_dokter,''), pl.nip,
				pl.dokter_perujuk, IFNULL(dperujuk.nm_dokter,'')
			FROM periksa_lab pl
			LEFT JOIN jns_perawatan_lab jpl ON pl.kd_jenis_prw = jpl.kd_jenis_prw
			LEFT JOIN dokter dpj ON pl.kd_dokter = dpj.kd_dokter
			LEFT JOIN dokter dperujuk ON pl.dokter_perujuk = dperujuk.kd_dokter
			WHERE pl.no_rawat = ? AND pl.tgl_periksa = ? AND pl.jam = ?
		`, noRawat, tglPeriksa, jam)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type examMeta struct{ kdJenisPrw, nmPerawatan string }
		var exams []examMeta
		var kdDokterPj, nmDokterPj, nip, dokterPerujuk, nmDokterPerujuk string
		for rows.Next() {
			var e examMeta
			if rows.Scan(&e.kdJenisPrw, &e.nmPerawatan, &kdDokterPj, &nmDokterPj, &nip, &dokterPerujuk, &nmDokterPerujuk) == nil {
				exams = append(exams, e)
			}
		}
		rows.Close()
		if len(exams) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Belum ada hasil pemeriksaan untuk order ini"})
			return
		}
		if dokterPerujuk == "" {
			dokterPerujuk = dokterPerujukOrder
			db.QueryRow(`SELECT IFNULL(nm_dokter,'') FROM dokter WHERE kd_dokter = ?`, dokterPerujuk).Scan(&nmDokterPerujuk)
		}

		var nmPetugas string
		db.QueryRow(`SELECT IFNULL(nama,'') FROM petugas WHERE nip = ?`, nip).Scan(&nmPetugas)

		items := []cetakHasilLabPKItem{}
		for _, e := range exams {
			dRows, err := db.Query(`
				SELECT tl.Pemeriksaan, dpl.nilai, IFNULL(tl.satuan,''), dpl.nilai_rujukan, dpl.keterangan
				FROM detail_periksa_lab dpl
				INNER JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
				WHERE dpl.no_rawat = ? AND dpl.kd_jenis_prw = ? AND dpl.tgl_periksa = ? AND dpl.jam = ?
			`, noRawat, e.kdJenisPrw, tglPeriksa, jam)
			if err != nil {
				continue
			}
			for dRows.Next() {
				var it cetakHasilLabPKItem
				if dRows.Scan(&it.Pemeriksaan, &it.Hasil, &it.Satuan, &it.NilaiRujukan, &it.Keterangan) == nil {
					it.KdJenisPrw = e.kdJenisPrw
					it.NmPerawatan = e.nmPerawatan
					items = append(items, it)
				}
			}
			dRows.Close()
		}

		var noRkmMedis, nmPasien, jk, tglLahir, alamat string
		db.QueryRow(`
			SELECT pasien.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.jk,''), IFNULL(pasien.tgl_lahir,''),
				CONCAT_WS(', ', NULLIF(pasien.alamat,''), kelurahan.nm_kel, kecamatan.nm_kec, kabupaten.nm_kab)
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN kelurahan ON pasien.kd_kel = kelurahan.kd_kel
			LEFT JOIN kecamatan ON pasien.kd_kec = kecamatan.kd_kec
			LEFT JOIN kabupaten ON pasien.kd_kab = kabupaten.kd_kab
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&noRkmMedis, &nmPasien, &jk, &tglLahir, &alamat)

		var poli string
		var statusLanjut string
		db.QueryRow(`SELECT status_lanjut FROM reg_periksa WHERE no_rawat = ?`, noRawat).Scan(&statusLanjut)
		if strings.EqualFold(statusLanjut, "ranap") {
			var kdKamar, nmBangsal string
			db.QueryRow(`SELECT kd_kamar FROM kamar_inap WHERE no_rawat = ? ORDER BY tgl_masuk DESC, jam_masuk DESC LIMIT 1`, noRawat).Scan(&kdKamar)
			if kdKamar != "" {
				db.QueryRow(`SELECT nm_bangsal FROM bangsal INNER JOIN kamar ON bangsal.kd_bangsal = kamar.kd_bangsal WHERE kamar.kd_kamar = ?`, kdKamar).Scan(&nmBangsal)
				poli = strings.TrimSpace(kdKamar + " " + nmBangsal)
			} else {
				poli = "Ranap Gabung"
			}
		} else {
			db.QueryRow(`
				SELECT IFNULL(poliklinik.nm_poli,'') FROM reg_periksa
				LEFT JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
				WHERE reg_periksa.no_rawat = ?
			`, noRawat).Scan(&poli)
		}

		tglFormatted := tglPeriksa
		if t, err := time.Parse("2006-01-02", tglPeriksa); err == nil {
			tglFormatted = t.Format("02-01-2006")
		}

		c.JSON(http.StatusOK, gin.H{
			"no_periksa":          noOrder,
			"no_rm":               noRkmMedis,
			"nama_pasien":         nmPasien,
			"jk":                  jk,
			"tgl_lahir":           tglLahir,
			"alamat":              alamat,
			"penanggung_jawab":    nmDokterPj,
			"kd_penanggung_jawab": kdDokterPj,
			"dokter_pengirim":     nmDokterPerujuk,
			"tgl_pemeriksaan":     tglFormatted,
			"jam_pemeriksaan":     jam,
			"poli":                poli,
			"hasil":               items,
			"petugas_nip":         nip,
			"petugas_nama":        nmPetugas,
		})
	}
}
