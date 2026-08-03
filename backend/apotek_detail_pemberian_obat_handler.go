package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Detail Pemberian Obat (menu baru di sidebar Apotek.tsx,
// frontend/src/modules/DetailPemberianObat.tsx). Laporan READ-ONLY:
// daftar pasien yang OBATNYA SUDAH DISERAHKAN (bukan cuma diresepkan)
// dalam rentang tanggal tertentu, dipisah 2 tab Rawat Jalan/Rawat Inap.
//
// PENTING — Ralan dan Ranap SUMBER DATANYA BEDA TABEL, bukan cuma beda
// filter status seperti /api/permintaan-resep/ralan|ranap:
//   - Ralan: resep_obat (status='ralan'), filter tgl_penyerahan = kapan
//     apotek menyerahkan obat ke pasien di loket — alur peresepan biasa.
//   - Ranap: detail_pemberian_obat (BUKAN resep_obat!), filter
//     tgl_perawatan = kapan obat diberikan dari stok bangsal ke pasien.
//     Ditemukan lewat investigasi bug: resep_obat.status='ranap' di
//     database nyata praktis SELALU KOSONG tgl_penyerahan-nya (obat
//     rawat inap tidak lewat alur "penyerahan resep" apotek loket sama
//     sekali) — pemberian obat rawat inap sungguhan tercatat di
//     detail_pemberian_obat (tabel yang sama dipakai
//     inventory/DlgPemberianObat.java di Khanza Desktop). detail_pemberian_obat
//     PER-ITEM OBAT (bisa banyak baris per pasien per hari), jadi
//     di-GROUP BY no_rawat+tanggal supaya jadi satu baris per pasien per
//     hari, sesuai bentuk "daftar pasien" yang diminta.
//   - detail_pemberian_obat.kd_bangsal = DEPO asal obat (mis. "AP" =
//     Apotek), BUKAN ruangan pasien — kolom "Ruangan" di sini tetap
//     diambil dari kamar_inap/kamar/bangsal (ruangan pasien SESUNGGUHNYA
//     saat itu), lewat subquery ke kamar_inap TERAKHIR (ORDER BY
//     tgl_masuk DESC LIMIT 1) supaya aman kalau pasien pernah pindah
//     kamar (hindari baris hasil JOIN yang berlipat).
//
// Struktur query gabungan reg_periksa/pasien/dokter/penjab tetap sama
// prinsipnya dengan permintaan_resep_handler.go — PENYEDERHANAAN yang
// disengaja: TIDAK ikutkan UNION ranap_gabung (pasien bayi/gabungan) &
// TIDAK filter kamar_inap.stts_pulang (laporan historis harus tetap
// menampilkan pasien yang sudah pulang), sama prinsip penyederhanaan
// yang dipakai modul lain di proyek ini.
// ============================================================================

type detailPemberianObatRow struct {
	NoResep       string `json:"no_resep"`
	NoRawat       string `json:"no_rawat"`
	NoRkmMedis    string `json:"no_rkm_medis"`
	NmPasien      string `json:"nm_pasien"`
	NmDokter      string `json:"nm_dokter"`
	NmLokasi      string `json:"nm_lokasi"`
	KdPj          string `json:"kd_pj"`
	JenisBayar    string `json:"jenis_bayar"`
	TglPenyerahan string `json:"tgl_penyerahan"`
	JamPenyerahan string `json:"jam_penyerahan"`
}

func getApotekDetailPemberianObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kind := strings.TrimSpace(c.Query("kind"))
		if kind != "ranap" {
			kind = "ralan"
		}
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().Format("2006-01-02")
		}
		kdPj := strings.TrimSpace(c.Query("kd_pj"))
		search := strings.TrimSpace(c.Query("search"))

		var query string
		var isRanap bool
		if kind == "ranap" {
			isRanap = true
			query = `
				SELECT detail_pemberian_obat.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, dokter.nm_dokter,
					COALESCE((
						SELECT bangsal.nm_bangsal
						FROM kamar_inap
						INNER JOIN kamar ON kamar.kd_kamar = kamar_inap.kd_kamar
						INNER JOIN bangsal ON bangsal.kd_bangsal = kamar.kd_bangsal
						WHERE kamar_inap.no_rawat = detail_pemberian_obat.no_rawat
						ORDER BY kamar_inap.tgl_masuk DESC LIMIT 1
					), '') AS nm_bangsal,
					penjab.kd_pj, penjab.png_jawab,
					MIN(detail_pemberian_obat.tgl_perawatan) AS tgl_perawatan,
					MIN(detail_pemberian_obat.jam) AS jam
				FROM detail_pemberian_obat
				INNER JOIN reg_periksa ON reg_periksa.no_rawat = detail_pemberian_obat.no_rawat
				INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
				INNER JOIN dokter ON dokter.kd_dokter = reg_periksa.kd_dokter
				INNER JOIN penjab ON penjab.kd_pj = reg_periksa.kd_pj
				WHERE detail_pemberian_obat.tgl_perawatan BETWEEN ? AND ?
			`
		} else {
			query = `
				SELECT resep_obat.no_resep, resep_obat.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, dokter.nm_dokter,
					poliklinik.nm_poli, penjab.kd_pj, penjab.png_jawab,
					resep_obat.tgl_penyerahan, resep_obat.jam_penyerahan
				FROM resep_obat
				INNER JOIN reg_periksa ON reg_periksa.no_rawat = resep_obat.no_rawat
				INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
				INNER JOIN dokter ON dokter.kd_dokter = resep_obat.kd_dokter
				INNER JOIN poliklinik ON poliklinik.kd_poli = reg_periksa.kd_poli
				INNER JOIN penjab ON penjab.kd_pj = reg_periksa.kd_pj
				WHERE resep_obat.status = 'ralan' AND resep_obat.tgl_penyerahan BETWEEN ? AND ?
			`
		}
		args := []interface{}{tgl1, tgl2}
		if kdPj != "" {
			query += " AND penjab.kd_pj = ?"
			args = append(args, kdPj)
		}
		if search != "" {
			query += " AND (pasien.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		if isRanap {
			// Satu baris per obat di detail_pemberian_obat -> dikelompokkan
			// jadi satu baris per pasien per hari, sesuai bentuk "daftar
			// pasien" (lihat komentar di atas berkas ini).
			query += " GROUP BY detail_pemberian_obat.no_rawat, DATE(detail_pemberian_obat.tgl_perawatan) ORDER BY jam"
		} else {
			query += " ORDER BY resep_obat.jam_penyerahan"
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []detailPemberianObatRow{}
		for rows.Next() {
			var r detailPemberianObatRow
			if isRanap {
				if rows.Scan(
					&r.NoRawat, &r.NoRkmMedis, &r.NmPasien, &r.NmDokter,
					&r.NmLokasi, &r.KdPj, &r.JenisBayar,
					&r.TglPenyerahan, &r.JamPenyerahan,
				) == nil {
					r.NoResep = r.NoRawat + "-" + r.TglPenyerahan
					list = append(list, r)
				}
				continue
			}
			if rows.Scan(
				&r.NoResep, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien, &r.NmDokter,
				&r.NmLokasi, &r.KdPj, &r.JenisBayar,
				&r.TglPenyerahan, &r.JamPenyerahan,
			) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// detailPemberianObatItemRow — satu baris obat/alkes yang diberikan,
// padanan PERSIS 16 kolom tabModePO di inventory/DlgPemberianObat.java
// ("Tgl.Beri"/"Jam Beri"/.../"No.Faktur"). Dipakai tombol "Lihat" di
// baris Rawat Inap (DetailPemberianObat.tsx) — no_rawat+tanggal yang
// diklik itulah kunci pengelompokan yang sama dipakai GROUP BY di
// getApotekDetailPemberianObat.
type detailPemberianObatItemRow struct {
	TglBeri    string  `json:"tgl_beri"`
	JamBeri    string  `json:"jam_beri"`
	NoRawat    string  `json:"no_rawat"`
	NoRkmMedis string  `json:"no_rkm_medis"`
	NmPasien   string  `json:"nm_pasien"`
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	Satuan     string  `json:"satuan"`
	Embalase   float64 `json:"embalase"`
	Tuslah     float64 `json:"tuslah"`
	Jml        float64 `json:"jml"`
	BiayaObat  float64 `json:"biaya_obat"`
	Total      float64 `json:"total"`
	HBeli      float64 `json:"h_beli"`
	Gudang     string  `json:"gudang"`
	NoBatch    string  `json:"no_batch"`
	NoFaktur   string  `json:"no_faktur"`
}

func getApotekDetailPemberianObatItems(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		if noRawat == "" || tanggal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan tanggal wajib diisi"})
			return
		}

		rows, err := db.Query(`
			SELECT detail_pemberian_obat.tgl_perawatan, detail_pemberian_obat.jam, detail_pemberian_obat.no_rawat,
				pasien.no_rkm_medis, pasien.nm_pasien,
				detail_pemberian_obat.kode_brng, COALESCE(databarang.nama_brng,''), COALESCE(kodesatuan.satuan,''),
				detail_pemberian_obat.embalase, detail_pemberian_obat.tuslah, detail_pemberian_obat.jml,
				detail_pemberian_obat.biaya_obat, detail_pemberian_obat.total, detail_pemberian_obat.h_beli,
				COALESCE(bangsal.nm_bangsal, detail_pemberian_obat.kd_bangsal, ''),
				detail_pemberian_obat.no_batch, detail_pemberian_obat.no_faktur
			FROM detail_pemberian_obat
			INNER JOIN reg_periksa ON reg_periksa.no_rawat = detail_pemberian_obat.no_rawat
			INNER JOIN pasien ON pasien.no_rkm_medis = reg_periksa.no_rkm_medis
			LEFT JOIN databarang ON databarang.kode_brng = detail_pemberian_obat.kode_brng
			LEFT JOIN kodesatuan ON kodesatuan.kode_sat = databarang.kode_sat
			LEFT JOIN bangsal ON bangsal.kd_bangsal = detail_pemberian_obat.kd_bangsal
			WHERE detail_pemberian_obat.no_rawat = ? AND DATE(detail_pemberian_obat.tgl_perawatan) = ?
			ORDER BY detail_pemberian_obat.jam
		`, noRawat, tanggal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []detailPemberianObatItemRow{}
		for rows.Next() {
			var r detailPemberianObatItemRow
			if rows.Scan(
				&r.TglBeri, &r.JamBeri, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.KodeBrng, &r.NamaBrng, &r.Satuan, &r.Embalase, &r.Tuslah, &r.Jml,
				&r.BiayaObat, &r.Total, &r.HBeli, &r.Gudang, &r.NoBatch, &r.NoFaktur,
			) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}
