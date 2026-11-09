package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// peruri_dokumen_pasien_handler.go — data dokumen pasien yg AKAN di-TTE dari
// submenu Peruri "Lihat Dokumen / Perlu Diproses" (tombol mata). PDF-nya
// dirakit di frontend (pdf-lib, pola sama buildHasilLabPKPdfUntukTtd);
// backend cuma kumpulkan datanya per no_rawat: identitas pasien, SOAP
// (pemeriksaan_ralan + pemeriksaan_ranap), diagnosa, prosedur, tindakan,
// obat, lab, radiologi, kamar (ranap).
//
// Isi/format dokumen MASIH AWAL — sengaja dibuat lebar dulu, nanti dirapikan
// bertahap. Tiap seksi selain identitas pasien best-effort: kalau query satu
// seksi gagal (mis. tabel/kolom beda di server lain), seksi itu dikosongkan
// dan nama seksinya dicatat di "peringatan", dokumen tetap bisa dibuka.

// queryRowsAsMaps — jalankan query, balikin tiap baris sbg map kolom→string
// (NULL jadi ""). Dipakai krn seksi dokumen ini cuma utk ditampilkan.
func queryRowsAsMaps(db *sql.DB, query string, args ...interface{}) ([]map[string]string, error) {
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	result := []map[string]string{}
	for rows.Next() {
		vals := make([]sql.NullString, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		m := make(map[string]string, len(cols))
		for i, col := range cols {
			m[col] = vals[i].String
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// GET /api/peruri/dokumen-pasien?no_rawat=...
func getPeruriDokumenPasien(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		pasienRows, err := queryRowsAsMaps(db, `
			SELECT r.no_rawat, r.no_rkm_medis, p.nm_pasien, p.jk, p.tmp_lahir,
				DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') AS tgl_lahir, p.alamat, p.no_peserta,
				CONCAT(r.umurdaftar, ' ', r.sttsumur) AS umur,
				DATE_FORMAT(r.tgl_registrasi, '%Y-%m-%d') AS tgl_registrasi, TIME_FORMAT(r.jam_reg, '%H:%i:%s') AS jam_reg,
				r.status_lanjut, r.kd_dokter, d.nm_dokter, pl.nm_poli, pj.png_jawab
			FROM reg_periksa r
			LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
			LEFT JOIN dokter d ON d.kd_dokter = r.kd_dokter
			LEFT JOIN poliklinik pl ON pl.kd_poli = r.kd_poli
			LEFT JOIN penjab pj ON pj.kd_pj = r.kd_pj
			WHERE r.no_rawat = ?`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data pasien: " + err.Error()})
			return
		}
		if len(pasienRows) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "No. rawat tidak ditemukan"})
			return
		}

		peringatan := []string{}
		section := func(nama, query string) []map[string]string {
			args := make([]interface{}, strings.Count(query, "?"))
			for i := range args {
				args[i] = noRawat
			}
			rows, err := queryRowsAsMaps(db, query, args...)
			if err != nil {
				peringatan = append(peringatan, nama+": "+err.Error())
				return []map[string]string{}
			}
			return rows
		}

		resp := gin.H{
			"pasien": pasienRows[0],
			"dpjp": section("DPJP", `
				SELECT dp.kd_dokter, d.nm_dokter FROM dpjp_ranap dp
				LEFT JOIN dokter d ON d.kd_dokter = dp.kd_dokter
				WHERE dp.no_rawat = ? ORDER BY d.nm_dokter`),
			"kamar": section("Kamar", `
				SELECT ki.kd_kamar, b.nm_bangsal, DATE_FORMAT(ki.tgl_masuk, '%Y-%m-%d') AS tgl_masuk,
					TIME_FORMAT(ki.jam_masuk, '%H:%i') AS jam_masuk,
					IF(ki.tgl_keluar = '0000-00-00', '', DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d')) AS tgl_keluar,
					ki.lama, ki.stts_pulang, ki.diagnosa_awal, ki.diagnosa_akhir
				FROM kamar_inap ki
				LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar
				LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
				WHERE ki.no_rawat = ? ORDER BY ki.tgl_masuk, ki.jam_masuk`),
			// section() mengisi SEMUA "?" dgn no_rawat, jadi filter ditaruh di
			// tiap cabang UNION (bukan di luar) supaya pakai index no_rawat.
			"soap": section("SOAP", `
				SELECT s.* FROM (
					SELECT 'Ralan' AS jenis, pr.no_rawat, DATE_FORMAT(pr.tgl_perawatan, '%Y-%m-%d') AS tgl_perawatan,
						TIME_FORMAT(pr.jam_rawat, '%H:%i') AS jam_rawat, pr.suhu_tubuh, pr.tensi, pr.nadi, pr.respirasi,
						pr.tinggi, pr.berat, pr.spo2, pr.gcs, pr.kesadaran, pr.keluhan, pr.pemeriksaan, pr.alergi,
						pr.penilaian, pr.rtl, pr.instruksi, pr.evaluasi, pr.nip, pg.nama AS nama_petugas
					FROM pemeriksaan_ralan pr LEFT JOIN pegawai pg ON pg.nik = pr.nip WHERE pr.no_rawat = ?
					UNION ALL
					SELECT 'Ranap', pi.no_rawat, DATE_FORMAT(pi.tgl_perawatan, '%Y-%m-%d'),
						TIME_FORMAT(pi.jam_rawat, '%H:%i'), pi.suhu_tubuh, pi.tensi, pi.nadi, pi.respirasi,
						pi.tinggi, pi.berat, pi.spo2, pi.gcs, pi.kesadaran, pi.keluhan, pi.pemeriksaan, pi.alergi,
						pi.penilaian, pi.rtl, pi.instruksi, pi.evaluasi, pi.nip, pg.nama
					FROM pemeriksaan_ranap pi LEFT JOIN pegawai pg ON pg.nik = pi.nip WHERE pi.no_rawat = ?
				) s ORDER BY s.tgl_perawatan, s.jam_rawat`),
			"diagnosa": section("Diagnosa", `
				SELECT dp.kd_penyakit, py.nm_penyakit, dp.status, dp.prioritas
				FROM diagnosa_pasien dp LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
				WHERE dp.no_rawat = ? ORDER BY dp.status, dp.prioritas`),
			"prosedur": section("Prosedur", `
				SELECT pp.kode, i.deskripsi_panjang, pp.status, pp.prioritas
				FROM prosedur_pasien pp LEFT JOIN icd9 i ON i.kode = pp.kode
				WHERE pp.no_rawat = ? ORDER BY pp.status, pp.prioritas`),
			"tindakan": section("Tindakan", `
				SELECT t.* FROM (
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d') AS tgl, TIME_FORMAT(x.jam_rawat, '%H:%i') AS jam,
						j.nm_perawatan, d.nm_dokter AS pelaksana
					FROM rawat_jl_dr x LEFT JOIN jns_perawatan j ON j.kd_jenis_prw = x.kd_jenis_prw LEFT JOIN dokter d ON d.kd_dokter = x.kd_dokter
					WHERE x.no_rawat = ?
					UNION ALL
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d'), TIME_FORMAT(x.jam_rawat, '%H:%i'),
						j.nm_perawatan, pg.nama
					FROM rawat_jl_pr x LEFT JOIN jns_perawatan j ON j.kd_jenis_prw = x.kd_jenis_prw LEFT JOIN pegawai pg ON pg.nik = x.nip
					WHERE x.no_rawat = ?
					UNION ALL
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d'), TIME_FORMAT(x.jam_rawat, '%H:%i'),
						j.nm_perawatan, CONCAT(IFNULL(d.nm_dokter, ''), ' / ', IFNULL(pg.nama, ''))
					FROM rawat_jl_drpr x LEFT JOIN jns_perawatan j ON j.kd_jenis_prw = x.kd_jenis_prw
						LEFT JOIN dokter d ON d.kd_dokter = x.kd_dokter LEFT JOIN pegawai pg ON pg.nik = x.nip
					WHERE x.no_rawat = ?
					UNION ALL
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d'), TIME_FORMAT(x.jam_rawat, '%H:%i'),
						j.nm_perawatan, d.nm_dokter
					FROM rawat_inap_dr x LEFT JOIN jns_perawatan_inap j ON j.kd_jenis_prw = x.kd_jenis_prw LEFT JOIN dokter d ON d.kd_dokter = x.kd_dokter
					WHERE x.no_rawat = ?
					UNION ALL
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d'), TIME_FORMAT(x.jam_rawat, '%H:%i'),
						j.nm_perawatan, pg.nama
					FROM rawat_inap_pr x LEFT JOIN jns_perawatan_inap j ON j.kd_jenis_prw = x.kd_jenis_prw LEFT JOIN pegawai pg ON pg.nik = x.nip
					WHERE x.no_rawat = ?
					UNION ALL
					SELECT x.no_rawat, DATE_FORMAT(x.tgl_perawatan, '%Y-%m-%d'), TIME_FORMAT(x.jam_rawat, '%H:%i'),
						j.nm_perawatan, CONCAT(IFNULL(d.nm_dokter, ''), ' / ', IFNULL(pg.nama, ''))
					FROM rawat_inap_drpr x LEFT JOIN jns_perawatan_inap j ON j.kd_jenis_prw = x.kd_jenis_prw
						LEFT JOIN dokter d ON d.kd_dokter = x.kd_dokter LEFT JOIN pegawai pg ON pg.nik = x.nip
					WHERE x.no_rawat = ?
				) t ORDER BY t.tgl, t.jam`),
			"obat": section("Obat", `
				SELECT DATE_FORMAT(o.tgl_perawatan, '%Y-%m-%d') AS tgl, TIME_FORMAT(o.jam, '%H:%i') AS jam,
					b.nama_brng, o.jml, b.kode_sat, o.status
				FROM detail_pemberian_obat o LEFT JOIN databarang b ON b.kode_brng = o.kode_brng
				WHERE o.no_rawat = ? ORDER BY o.tgl_perawatan, o.jam`),
			"lab": section("Laboratorium", `
				SELECT DATE_FORMAT(l.tgl_periksa, '%Y-%m-%d') AS tgl, TIME_FORMAT(l.jam, '%H:%i') AS jam,
					j.nm_perawatan, d.nm_dokter
				FROM periksa_lab l LEFT JOIN jns_perawatan_lab j ON j.kd_jenis_prw = l.kd_jenis_prw
				LEFT JOIN dokter d ON d.kd_dokter = l.kd_dokter
				WHERE l.no_rawat = ? ORDER BY l.tgl_periksa, l.jam`),
			"radiologi": section("Radiologi", `
				SELECT DATE_FORMAT(rd.tgl_periksa, '%Y-%m-%d') AS tgl, TIME_FORMAT(rd.jam, '%H:%i') AS jam,
					j.nm_perawatan, d.nm_dokter
				FROM periksa_radiologi rd LEFT JOIN jns_perawatan_radiologi j ON j.kd_jenis_prw = rd.kd_jenis_prw
				LEFT JOIN dokter d ON d.kd_dokter = rd.kd_dokter
				WHERE rd.no_rawat = ? ORDER BY rd.tgl_periksa, rd.jam`),
		}
		resp["peringatan"] = peringatan
		c.JSON(http.StatusOK, resp)
	}
}
