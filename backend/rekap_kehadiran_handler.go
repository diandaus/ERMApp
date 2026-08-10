package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Rekap Kehadiran, padanan kepegawaian/DlgKehadiran.java
// (Khanza). Laporan agregat BULANAN per pegawai (beda dari tab Presensi
// yang menampilkan LOG harian mentah) — total hari hadir, breakdown
// shift, breakdown status keterlambatan, total keterlambatan/durasi,
// wajib masuk, dan % kehadiran.
//
// Java menghitung tiap kolom lewat ~9 query terpisah PER PEGAWAI di
// dalam loop (N+1) — di sini disatukan jadi agregasi SQL (GROUP BY)
// sekali jalan supaya jauh lebih efisien, hasilnya tetap sama.
//
// Dua penyimpangan disengaja dari Java (lihat komentar inline):
// 1. Kolom "Terlambat I" Java pakai `status LIKE '%Terlambat I%'` yang
//    SECARA TIDAK SENGAJA juga match "Terlambat II" (karena "Terlambat
//    II" mengandung substring "Terlambat I"), makanya Java menambal
//    dgn mengurangi count Terlambat II lagi. Di sini match persis by
//    value (IN (...)) jadi tidak perlu tambal-sulam begitu.
// 2. wajibmasuk=0 di Java JATUH ke kode mati (else-if terakhir kondisinya
//    sama dgn else-if sebelumnya, tidak pernah tercapai) sehingga
//    wajibmasuk tetap 0 utk kasus paling umum (default pegawai baru) —
//    ini jelas bug (hint teks di form Pegawai bilang "0=normal" tapi
//    kodenya tidak pernah menghitung itu). Di sini diimplementasikan
//    sesuai maksud aslinya: 0 -> jumlahHari - liburAkhad - liburHariRaya.
// ============================================================================

type RekapKehadiranRow struct {
	NIK           string  `json:"nik"`
	Nama          string  `json:"nama"`
	Departemen    string  `json:"departemen"`
	Hadir         int     `json:"hadir"`
	Pagi          int     `json:"pagi"`
	Siang         int     `json:"siang"`
	Malam         int     `json:"malam"`
	TepatWaktu    int     `json:"tepat_waktu"`
	Toleransi     int     `json:"toleransi"`
	TerlambatI    int     `json:"terlambat_1"`
	TerlambatII   int     `json:"terlambat_2"`
	Keterlambatan string  `json:"keterlambatan"`
	Durasi        string  `json:"durasi"`
	WajibMasuk    int     `json:"wajib_masuk"`
	PersenHadir   float64 `json:"persen_hadir"`
}

func hitungHariAkhad(tahun, bulan int) int {
	count := 0
	jumlahHari := time.Date(tahun, time.Month(bulan)+1, 0, 0, 0, 0, 0, time.Local).Day()
	for d := 1; d <= jumlahHari; d++ {
		if time.Date(tahun, time.Month(bulan), d, 0, 0, 0, 0, time.Local).Weekday() == time.Sunday {
			count++
		}
	}
	return count
}

// parseDurasiMenit — kebalikan formatDurasiMenit (presensi_handler.go):
// "1j 30m" -> 90, "45m" -> 45, "-"/"" -> 0. JUGA menangani format lama
// "HH:MM:SS" (data seed/legacy dari sebelum Presensi Mandiri dibangun,
// mis. hasil import fingerprint Khanza) supaya total tidak understate
// kalau ada baris lama tercampur baris baru.
func parseDurasiMenit(s string) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return 0
	}
	if strings.Contains(s, ":") {
		var h, m, sec int
		if n, _ := fmt.Sscanf(s, "%d:%d:%d", &h, &m, &sec); n >= 2 {
			return h*60 + m
		}
		return 0
	}
	jPart, mPart := 0, 0
	if idx := strings.Index(s, "j"); idx != -1 {
		fmt.Sscanf(strings.TrimSpace(s[:idx]), "%d", &jPart)
		rest := strings.TrimSpace(s[idx+1:])
		if mIdx := strings.Index(rest, "m"); mIdx != -1 {
			fmt.Sscanf(strings.TrimSpace(rest[:mIdx]), "%d", &mPart)
		}
	} else if mIdx := strings.Index(s, "m"); mIdx != -1 {
		fmt.Sscanf(strings.TrimSpace(s[:mIdx]), "%d", &mPart)
	}
	return jPart*60 + mPart
}

func hitungWajibMasuk(db *sql.DB, pegawaiID, wajibmasukRaw, tahun, bulan, jumlahHari, liburAkhad, liburHariRaya int) int {
	switch {
	case wajibmasukRaw == -1:
		return 0
	case wajibmasukRaw == -2:
		return jumlahHari - 4
	case wajibmasukRaw == -3:
		return jumlahHari - 2 - liburHariRaya
	case wajibmasukRaw == -4:
		return jumlahHari - liburAkhad
	case wajibmasukRaw == -5:
		kolomExpr := make([]string, len(jadwalHariKolom))
		for i, k := range jadwalHariKolom {
			kolomExpr[i] = fmt.Sprintf("IF(%s='',0,1)", k)
		}
		var count sql.NullInt64
		q := fmt.Sprintf(`SELECT %s FROM jadwal_pegawai WHERE id=? AND tahun=? AND bulan=?`, strings.Join(kolomExpr, "+"))
		db.QueryRow(q, pegawaiID, tahun, fmt.Sprintf("%02d", bulan)).Scan(&count)
		return int(count.Int64)
	case wajibmasukRaw == 0:
		return jumlahHari - liburAkhad - liburHariRaya
	default:
		return wajibmasukRaw
	}
}

// GET /api/rekap-kehadiran/list?tahun=&bulan=&departemen=&stts_kerja=&search=
func getRekapKehadiranList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tahunQ := strings.TrimSpace(c.Query("tahun"))
		bulanQ := strings.TrimSpace(c.Query("bulan"))
		departemen := strings.TrimSpace(c.Query("departemen"))
		sttsKerja := strings.TrimSpace(c.Query("stts_kerja"))
		search := strings.TrimSpace(c.Query("search"))
		if tahunQ == "" || bulanQ == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tahun dan bulan wajib diisi"})
			return
		}
		tahun, _ := strconv.Atoi(tahunQ)
		bulan, _ := strconv.Atoi(bulanQ)
		if bulan < 1 || bulan > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bulan tidak valid"})
			return
		}

		query := `
			SELECT pegawai.id, pegawai.nik, pegawai.nama, COALESCE(departemen.nama, pegawai.departemen, ''), COALESCE(pegawai.wajibmasuk, 0)
			FROM pegawai
			LEFT JOIN departemen ON departemen.dep_id = pegawai.departemen
			WHERE pegawai.stts_aktif <> 'KELUAR'`
		args := []interface{}{}
		if departemen != "" {
			query += " AND pegawai.departemen = ?"
			args = append(args, departemen)
		}
		if sttsKerja != "" {
			query += " AND pegawai.stts_kerja = ?"
			args = append(args, sttsKerja)
		}
		if search != "" {
			query += " AND (pegawai.nik LIKE ? OR pegawai.nama LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		query += " ORDER BY pegawai.nama"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type pegawaiBaris struct {
			id         int
			nik, nama  string
			departemen string
			wajibmasuk int
		}
		var pegawaiList []pegawaiBaris
		for rows.Next() {
			var p pegawaiBaris
			if err := rows.Scan(&p.id, &p.nik, &p.nama, &p.departemen, &p.wajibmasuk); err == nil {
				pegawaiList = append(pegawaiList, p)
			}
		}
		rows.Close()

		awalBulan := fmt.Sprintf("%04d-%02d-01", tahun, bulan)
		akhirBulan := fmt.Sprintf("%04d-%02d-01", tahun, bulan+1)
		if bulan == 12 {
			akhirBulan = fmt.Sprintf("%04d-01-01", tahun+1)
		}

		// Agregasi hitungan (hadir/shift/status) sekali jalan utk semua
		// pegawai bulan ini — jauh lebih efisien drpd query per pegawai
		// spt Java.
		type agregat struct {
			hadir, pagi, siang, malam                      int
			tepatWaktu, toleransi, terlambatI, terlambatII int
		}
		agregatMap := map[int]*agregat{}
		aggRows, err := db.Query(`
			SELECT id,
				COUNT(*),
				SUM(CASE WHEN shift LIKE '%Pagi%' THEN 1 ELSE 0 END),
				SUM(CASE WHEN shift LIKE '%Siang%' THEN 1 ELSE 0 END),
				SUM(CASE WHEN shift LIKE '%Malam%' THEN 1 ELSE 0 END),
				SUM(CASE WHEN status IN ('Tepat Waktu','Tepat Waktu & PSW') THEN 1 ELSE 0 END),
				SUM(CASE WHEN status IN ('Terlambat Toleransi','Terlambat Toleransi & PSW') THEN 1 ELSE 0 END),
				SUM(CASE WHEN status IN ('Terlambat I','Terlambat I & PSW') THEN 1 ELSE 0 END),
				SUM(CASE WHEN status IN ('Terlambat II','Terlambat II & PSW') THEN 1 ELSE 0 END)
			FROM rekap_presensi
			WHERE jam_datang >= ? AND jam_datang < ?
			GROUP BY id`, awalBulan, akhirBulan)
		if err == nil {
			for aggRows.Next() {
				var id int
				a := &agregat{}
				if aggRows.Scan(&id, &a.hadir, &a.pagi, &a.siang, &a.malam, &a.tepatWaktu, &a.toleransi, &a.terlambatI, &a.terlambatII) == nil {
					agregatMap[id] = a
				}
			}
			aggRows.Close()
		}

		// Total keterlambatan & durasi — dijumlah manual di Go krn
		// formatnya string custom ("1j 30m"/"-"), bukan MySQL TIME.
		type totalMenit struct{ keterlambatan, durasi int }
		totalMap := map[int]*totalMenit{}
		durRows, err := db.Query(`SELECT id, keterlambatan, durasi FROM rekap_presensi WHERE jam_datang >= ? AND jam_datang < ?`, awalBulan, akhirBulan)
		if err == nil {
			for durRows.Next() {
				var id int
				var ket, dur string
				if durRows.Scan(&id, &ket, &dur) == nil {
					t, ok := totalMap[id]
					if !ok {
						t = &totalMenit{}
						totalMap[id] = t
					}
					t.keterlambatan += parseDurasiMenit(ket)
					t.durasi += parseDurasiMenit(dur)
				}
			}
			durRows.Close()
		}

		var liburHariRaya int
		db.QueryRow(`SELECT COUNT(*) FROM set_hari_libur WHERE tanggal >= ? AND tanggal < ?`, awalBulan, akhirBulan).Scan(&liburHariRaya)
		liburAkhad := hitungHariAkhad(tahun, bulan)
		jumlahHari := time.Date(tahun, time.Month(bulan+1), 0, 0, 0, 0, 0, time.Local).Day()

		list := make([]RekapKehadiranRow, 0, len(pegawaiList))
		for _, p := range pegawaiList {
			a := agregatMap[p.id]
			if a == nil {
				a = &agregat{}
			}
			t := totalMap[p.id]
			if t == nil {
				t = &totalMenit{}
			}
			wajibMasuk := hitungWajibMasuk(db, p.id, p.wajibmasuk, tahun, bulan, jumlahHari, liburAkhad, liburHariRaya)
			persenHadir := 0.0
			if wajibMasuk > 0 {
				persenHadir = float64(a.hadir) / float64(wajibMasuk) * 100
			}
			list = append(list, RekapKehadiranRow{
				NIK: p.nik, Nama: p.nama, Departemen: p.departemen,
				Hadir: a.hadir, Pagi: a.pagi, Siang: a.siang, Malam: a.malam,
				TepatWaktu: a.tepatWaktu, Toleransi: a.toleransi, TerlambatI: a.terlambatI, TerlambatII: a.terlambatII,
				Keterlambatan: formatDurasiMenit(t.keterlambatan), Durasi: formatDurasiMenit(t.durasi),
				WajibMasuk: wajibMasuk, PersenHadir: persenHadir,
			})
		}

		c.JSON(http.StatusOK, list)
	}
}
