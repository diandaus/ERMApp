package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// APOTEK — Penggunaan Obat (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgPenggunaObat.java — laporan READ-ONLY murni
// (tidak ada tombol Simpan/Hapus, cuma Cari/Cetak) yang menjawab "obat X
// dipakai oleh pasien mana saja, kapan, berapa banyak" — sumber datanya
// SAMA dengan Detail Pemberian Obat (`detail_pemberian_obat`), tapi
// dikelompokkan per OBAT (bukan per kunjungan/tanggal).
//
// **Penyederhanaan struktural terbesar dari Java**: prosesCari() di Java
// pakai pola JTable flat-fake-row 3 lapis (baris header per obat dari
// query databarang TERPISAH → N baris pasien per obat dari query
// detail_pemberian_obat per-obat [N+1] → baris ringkasan "Jumlah Obat :")
// DAN query resep_obat/dokter per-baris pasien (N+1 lagi di dalam N+1).
// Di sini diganti SATU query flat (JOIN semua tabel sekaligus, termasuk
// LEFT JOIN resep_obat/dokter yang di Java N+1) lalu dikelompokkan per
// kode_brng di kode Go — hasil akhir sama, query jauh lebih sedikit.
//
// **Beda perilaku yang disengaja**: Java SELALU menampilkan baris header
// utk SETIAP barang yang lolos filter Jenis/Kategori/Golongan/Cari, walau
// pemakaiannya nol di rentang tanggal (soalnya query databarang & query
// pemakaian terpisah). Di sini query dimulai DARI detail_pemberian_obat
// (bukan databarang), jadi obat dengan NOL pemakaian di rentang tanggal
// TIDAK muncul sama sekali — laporan "Penggunaan Obat" secara logis
// harusnya cuma menampilkan yang benar-benar terpakai, bukan seluruh
// katalog dengan baris kosong.
//
// **Status** (Rawat Jalan/Rawat Inap di UI) memfilter
// `detail_pemberian_obat.status`, yang nilainya literal 'Ralan'/'Ranap'
// di DB (dikonfirmasi langsung lewat data) — BUKAN join ke
// reg_periksa.status_lanjut.
// ============================================================================

type penggunaanObatPemakaian struct {
	TglPerawatan string  `json:"tgl_perawatan"`
	Jam          string  `json:"jam"`
	NoRawat      string  `json:"no_rawat"`
	NoRkmMedis   string  `json:"no_rkm_medis"`
	NmPasien     string  `json:"nm_pasien"`
	Alamat       string  `json:"alamat"`
	Jml          float64 `json:"jml"`
	AsalStok     string  `json:"asal_stok"`
	Status       string  `json:"status"`
	NoResep      string  `json:"no_resep"`
	Dokter       string  `json:"dokter"`
}

type penggunaanObatRow struct {
	KodeBrng   string                    `json:"kode_brng"`
	NamaBrng   string                    `json:"nama_brng"`
	KodeSat    string                    `json:"kode_sat"`
	JumlahObat float64                   `json:"jumlah_obat"`
	Pemakaian  []penggunaanObatPemakaian `json:"pemakaian"`
}

func getPenggunaanObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl2 == "" {
			tgl2 = time.Now().Format("2006-01-02")
		}
		if tgl1 == "" {
			tgl1 = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		status := strings.TrimSpace(c.Query("status"))        // '', 'Ralan', 'Ranap'
		kdPj := strings.TrimSpace(c.Query("kd_pj"))           // Cara Bayar
		kdBangsal := strings.TrimSpace(c.Query("kd_bangsal")) // Asal Stok
		kdjns := strings.TrimSpace(c.Query("kdjns"))          // Jenis
		kodeKategori := strings.TrimSpace(c.Query("kode_kategori"))
		kodeGolongan := strings.TrimSpace(c.Query("kode_golongan"))
		kdDokter := strings.TrimSpace(c.Query("kd_dokter")) // Dokter Peresep
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT b.kode_brng, b.nama_brng, b.kode_sat,
				d.tgl_perawatan, d.jam, d.no_rawat, rp.no_rkm_medis, p.nm_pasien,
				CONCAT(COALESCE(p.alamat,''), ', ', COALESCE(kel.nm_kel,''), ', ', COALESCE(kec.nm_kec,''), ', ', COALESCE(kab.nm_kab,''), ', ', COALESCE(prop.nm_prop,'')) AS alamat,
				d.jml, COALESCE(bg.nm_bangsal,''), d.status,
				COALESCE(r.no_resep,''), COALESCE(dok.nm_dokter,'')
			FROM detail_pemberian_obat d
			INNER JOIN databarang b ON d.kode_brng = b.kode_brng
			INNER JOIN reg_periksa rp ON d.no_rawat = rp.no_rawat
			INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
			LEFT JOIN kelurahan kel ON p.kd_kel = kel.kd_kel
			LEFT JOIN kecamatan kec ON p.kd_kec = kec.kd_kec
			LEFT JOIN kabupaten kab ON p.kd_kab = kab.kd_kab
			LEFT JOIN propinsi prop ON p.kd_prop = prop.kd_prop
			LEFT JOIN bangsal bg ON d.kd_bangsal = bg.kd_bangsal
			LEFT JOIN resep_obat r ON r.tgl_perawatan = d.tgl_perawatan AND r.jam = d.jam AND r.no_rawat = d.no_rawat
			LEFT JOIN dokter dok ON r.kd_dokter = dok.kd_dokter
			WHERE b.status = '1' AND d.tgl_perawatan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if status != "" {
			query += " AND d.status = ?"
			args = append(args, status)
		}
		if kdPj != "" {
			query += " AND rp.kd_pj = ?"
			args = append(args, kdPj)
		}
		if kdBangsal != "" {
			query += " AND d.kd_bangsal = ?"
			args = append(args, kdBangsal)
		}
		if kdjns != "" {
			query += " AND b.kdjns = ?"
			args = append(args, kdjns)
		}
		if kodeKategori != "" {
			query += " AND b.kode_kategori = ?"
			args = append(args, kodeKategori)
		}
		if kodeGolongan != "" {
			query += " AND b.kode_golongan = ?"
			args = append(args, kodeGolongan)
		}
		if kdDokter != "" {
			// dok berasal dari LEFT JOIN resep_obat/dokter (dokter peresep
			// kadang tidak ketemu, lihat catatan besar di atas) — filter
			// ini otomatis mengecualikan baris yang dok-nya NULL, efeknya
			// jadi seperti INNER JOIN utk baris yang lolos filter ini saja.
			query += " AND dok.kd_dokter = ?"
			args = append(args, kdDokter)
		}
		if search != "" {
			query += " AND (b.kode_brng LIKE ? OR b.nama_brng LIKE ?)"
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern)
		}
		query += " ORDER BY b.nama_brng, d.tgl_perawatan, d.jam"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		order := []string{}
		byKode := map[string]*penggunaanObatRow{}
		for rows.Next() {
			var kodeBrng, namaBrng, kodeSat string
			var pk penggunaanObatPemakaian
			if err := rows.Scan(&kodeBrng, &namaBrng, &kodeSat,
				&pk.TglPerawatan, &pk.Jam, &pk.NoRawat, &pk.NoRkmMedis, &pk.NmPasien,
				&pk.Alamat, &pk.Jml, &pk.AsalStok, &pk.Status,
				&pk.NoResep, &pk.Dokter); err != nil {
				continue
			}
			r, ok := byKode[kodeBrng]
			if !ok {
				r = &penggunaanObatRow{KodeBrng: kodeBrng, NamaBrng: namaBrng, KodeSat: kodeSat, Pemakaian: []penggunaanObatPemakaian{}}
				byKode[kodeBrng] = r
				order = append(order, kodeBrng)
			}
			r.Pemakaian = append(r.Pemakaian, pk)
			r.JumlahObat += pk.Jml
		}

		list := make([]*penggunaanObatRow, 0, len(order))
		for _, k := range order {
			list = append(list, byKode[k])
		}
		c.JSON(http.StatusOK, list)
	}
}
