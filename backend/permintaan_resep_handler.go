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
// PERMINTAAN RESEP — modul baru level-atas (sejajar Apotek/Bridging di
// sidebar utama, DI BAWAH menu Dashboard), full-screen dengan sidebar
// sendiri (frontend/src/modules/PermintaanResep.tsx). Cocok dengan dialog
// Khanza Desktop inventory/DlgDaftarPermintaanResep.java — dialog PALING
// besar yang pernah kami temui (5515 baris), tab-nya sendiri bersarang
// (Rawat Jalan/Rawat Inap × banyak sub-tab) dan 10 tombolnya masing-masing
// membuka dialog terpisah yang juga substansial (Telaah Resep, Konseling
// Farmasi, Resep Luar, Piutang Obat, dll).
//
// **FASE 1 (saat ini)**: HANYA tab "Dashboard" — padanan tampil() untuk
// TabRawatJalan index 0 ("Resep Ralan") di Java, yaitu antrean resep rawat
// jalan yang masuk ke apotek. 10 tab lain (Riwayat Pasien, Obat
// Tervalidasi, Telaah Resep, Konseling Farmasi, Informasi Obat, Cetak
// Resep Awal, Resep Luar, Piutang Obat, Data Sep BPJS, Obat Apotek Online
// BPJS) masih placeholder — digarap satu-satu di giliran berikutnya, sama
// pola inkremental yang dipakai membangun modul Apotek sepanjang sesi ini.
//
// **Replikasi query Java** (method tampil(), jalur DEPOAKTIFOBAT kosong —
// satu-satunya jalur yang kami port, sama prinsip dengan modul lain yang
// skip varian "per-depo aktif" kalau settingnya tidak esensial untuk MVP):
//   resep_obat INNER JOIN reg_periksa (no_rawat) INNER JOIN pasien
//   (no_rkm_medis) INNER JOIN dokter (kd_dokter) INNER JOIN poliklinik
//   (kd_poli, lewat reg_periksa) INNER JOIN penjab (kd_pj, lewat
//   reg_periksa — "Jenis Bayar"/png_jawab) WHERE status='ralan' AND
//   tgl_peresepan<>'0000-00-00' AND tgl_peresepan BETWEEN ? AND ?.
//
// **Status** dihitung persis seperti Java:
//   IF(tgl_perawatan='0000-00-00','Belum Terlayani','Sudah Terlayani')
// PENTING — nama kolom `resep_obat.tgl_perawatan`/`jam` MENYESATKAN (kesan
// "tanggal rawat"), tapi di konteks resep_obat dipakai Java sebagai
// "Tgl.Validasi"/"Jam Validasi" (kapan apotek memvalidasi resep ini,
// BUKAN tanggal rawat pasien) — kolom yang sama, arti berbeda tergantung
// tabel. Diikuti apa adanya (bukan bug, memang begitu skema aslinya).
//
// **Default rentang tanggal: HARI INI SAJA** (bukan 30 hari seperti
// laporan historis lain di proyek ini) — halaman ini dashboard ANTREAN
// KERJA aktif (apoteker perlu lihat resep masuk hari ini), bukan laporan
// historis, jadi default sempit lebih masuk akal di sini. `tgl_peresepan`
// juga tidak ber-index (sama seperti riwayat_barang_medis), tapi karena
// defaultnya HANYA satu hari (bukan rentang panjang tanpa batas), risiko
// full-scan-nya jauh lebih kecil — jumlah resep per hari di satu RS wajar
// terbatas (ratusan, bukan jutaan baris terakumulasi bertahun-tahun).
//
// **Detail item TIDAK di-embed** di daftar utama (replikasi pola lazy-load
// Java: tbDetailResepRalan baru terisi setelah baris diklik) — endpoint
// terpisah getPermintaanResepRalanItems, query non-racikan/racikan
// PERSIS sama dengan yang dipakai getRiwayatResep (resep_handler.go),
// reuse struct ResepNonRacikan/ResepRacikan/ResepRacikanDetail yang sudah
// ada di file itu (package main yang sama, tidak perlu didefinisikan
// ulang).
// ============================================================================

type permintaanResepRalanRow struct {
	NoResep            string `json:"no_resep"`
	TglPeresepan       string `json:"tgl_peresepan"`
	JamPeresepan       string `json:"jam_peresepan"`
	NoRawat            string `json:"no_rawat"`
	NoRkmMedis         string `json:"no_rkm_medis"`
	NmPasien           string `json:"nm_pasien"`
	KdDokter           string `json:"kd_dokter"`
	NmDokter           string `json:"nm_dokter"`
	Status             string `json:"status"`
	NmPoli             string `json:"nm_poli"`
	KdPoli             string `json:"kd_poli"`
	JenisBayar         string `json:"jenis_bayar"`
	TglValidasi        string `json:"tgl_validasi"`
	JamValidasi        string `json:"jam_validasi"`
	TglPenyerahan      string `json:"tgl_penyerahan"`
	JamPenyerahan      string `json:"jam_penyerahan"`
	SdhTelaah          bool   `json:"sdh_telaah"`
	SdhKonseling       bool   `json:"sdh_konseling"`
	SdhInformasiObat   bool   `json:"sdh_informasi_obat"`
	AdaPioBelumDijawab bool   `json:"ada_pio_belum_dijawab"`
}

func getPermintaanResepRalan(db *sql.DB) gin.HandlerFunc {
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
		poli := strings.TrimSpace(c.Query("poli"))
		status := strings.TrimSpace(c.Query("status"))
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT resep_obat.no_resep, resep_obat.tgl_peresepan, resep_obat.jam_peresepan,
				resep_obat.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien, resep_obat.kd_dokter, dokter.nm_dokter,
				IF(resep_obat.tgl_perawatan='0000-00-00','Belum Terlayani','Sudah Terlayani') AS status,
				poliklinik.nm_poli, reg_periksa.kd_poli, penjab.png_jawab,
				IF(resep_obat.tgl_perawatan='0000-00-00','',resep_obat.tgl_perawatan) AS tgl_validasi,
				IF(resep_obat.jam='00:00:00','',resep_obat.jam) AS jam_validasi,
				IF(resep_obat.tgl_penyerahan='0000-00-00','',resep_obat.tgl_penyerahan) AS tgl_penyerahan,
				IF(resep_obat.jam_penyerahan='00:00:00','',resep_obat.jam_penyerahan) AS jam_penyerahan,
				IF(telaah_farmasi.no_resep IS NULL,0,1) AS sdh_telaah,
				IF(konseling_farmasi.no_rawat IS NULL,0,1) AS sdh_konseling,
				EXISTS(SELECT 1 FROM pelayanan_informasi_obat pio WHERE pio.no_rawat = resep_obat.no_rawat) AS sdh_informasi_obat,
				EXISTS(
					SELECT 1 FROM pelayanan_informasi_obat pio2
					LEFT JOIN jawaban_pio_apoteker j2 ON j2.no_permintaan = pio2.no_permintaan
					WHERE pio2.no_rawat = resep_obat.no_rawat AND j2.no_permintaan IS NULL
				) AS ada_pio_belum_dijawab
			FROM resep_obat
			INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			INNER JOIN dokter ON resep_obat.kd_dokter = dokter.kd_dokter
			INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli
			INNER JOIN penjab ON reg_periksa.kd_pj = penjab.kd_pj
			LEFT JOIN telaah_farmasi ON telaah_farmasi.no_resep = resep_obat.no_resep
			LEFT JOIN konseling_farmasi ON konseling_farmasi.no_rawat = resep_obat.no_rawat
			WHERE resep_obat.status = 'ralan' AND resep_obat.tgl_peresepan <> '0000-00-00'
				AND resep_obat.tgl_peresepan BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if dokter != "" {
			query += " AND dokter.nm_dokter LIKE ?"
			args = append(args, "%"+dokter+"%")
		}
		if poli != "" {
			query += " AND poliklinik.nm_poli LIKE ?"
			args = append(args, "%"+poli+"%")
		}
		if search != "" {
			query += ` AND (resep_obat.no_resep LIKE ? OR resep_obat.no_rawat LIKE ? OR pasien.no_rkm_medis LIKE ?
				OR pasien.nm_pasien LIKE ? OR dokter.nm_dokter LIKE ? OR penjab.png_jawab LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern)
		}
		query += " ORDER BY resep_obat.tgl_peresepan DESC, resep_obat.jam_peresepan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		list := []permintaanResepRalanRow{}
		for rows.Next() {
			var r permintaanResepRalanRow
			if rows.Scan(&r.NoResep, &r.TglPeresepan, &r.JamPeresepan, &r.NoRawat, &r.NoRkmMedis, &r.NmPasien,
				&r.KdDokter, &r.NmDokter, &r.Status, &r.NmPoli, &r.KdPoli, &r.JenisBayar,
				&r.TglValidasi, &r.JamValidasi, &r.TglPenyerahan, &r.JamPenyerahan, &r.SdhTelaah, &r.SdhKonseling,
				&r.SdhInformasiObat, &r.AdaPioBelumDijawab) == nil {
				if status == "" || status == r.Status {
					list = append(list, r)
				}
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// getPermintaanResepRalanItems — padanan getData()/pengisian tbDetailResepRalan
// DAN panel "Data Obat, Alkes & BHP Medis" di DlgCariObat.java, dipicu klik
// satu baris di daftar utama ATAU buka ModalValidasiObat. Query non-racikan/
// racikan identik dengan yang dipakai getRiwayatResep di resep_handler.go,
// ditambah h_jual/subtotal per baris (harga tarif "Rawat Jalan" =
// databarang.ralan, sama kolom yang dipakai searchObat) dan info header
// (no_rawat, depo hasil resolveDepoRalan, Total/PPN/Total+PPN) untuk
// ditampilkan di modal — SEKADAR TAMPILAN, tidak diposting ke jurnal
// akuntansi mana pun (proyek ini belum punya modul Keuangan, lihat catatan
// penyederhanaan di submitPermintaanResepValidasi). PPN dihitung tetap 11%
// (Khanza tidak menyimpan PPN per resep, beda dari Penerimaan yang punya
// input ppn_percent manual per transaksi pembelian).
// tarifHargaColumn — padanan persis kolom harga per pilihan combo
// "Jeniskelas" di DlgCariObat.java (Tarif). Whitelist ketat karena nama
// kolom di-interpolasi langsung ke SQL (bukan parameter terikat).
func tarifHargaColumn(tarif string) string {
	switch tarif {
	case "Karyawan":
		return "karyawan"
	case "Beli Luar":
		return "beliluar"
	case "Utama/BPJS":
		return "utama"
	default: // "Rawat Jalan" atau kosong
		return "ralan"
	}
}

func getPermintaanResepRalanItems(db *sql.DB) gin.HandlerFunc {
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
			// Depo dipilih manual lewat dropdown Depo di ModalValidasiObat.tsx
			// (bukan hasil resolveDepoRalan otomatis) — padanan user mengganti
			// combo Depo di DlgCariObat.java.
			result.KdBangsal = kdBangsalOverride
		} else {
			result.KdBangsal = resolveDepoRalan(db, result.NoRawat)
		}
		if result.KdBangsal == "" {
			result.KdBangsal = "AP"
		}
		db.QueryRow(`SELECT COALESCE(nm_bangsal,'') FROM bangsal WHERE kd_bangsal=?`, result.KdBangsal).Scan(&result.NmBangsal)

		// Default Emb/Tsl per baris — padanan Set Embalase & Tuslah
		// (setting/DlgSetEmbalase.java, satu nilai system-wide), dipakai
		// sebagai nilai AWAL yang bisa diedit per baris di
		// ModalValidasiObat.tsx (bukan disimpan per baris di DB, Khanza
		// juga tidak punya kolom itu di resep_dokter).
		var embalaseDefault, tuslahDefault float64
		db.QueryRow(`SELECT COALESCE(embalase_per_obat,0), COALESCE(tuslah_per_obat,0) FROM set_embalase LIMIT 1`).Scan(&embalaseDefault, &tuslahDefault)

		// databarang.expire tanggal SATU per item (bukan per-batch, sama
		// prinsip dengan fitur Obat Kadaluarsa Apotek) — dipakai untuk
		// kolom "Kadaluarsa". No.Batch/No.Faktur SELALU '-' (tidak
		// dilacak, lihat komentar struct ResepNonRacikan).
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

// submitPermintaanResepValidasi — padanan alur "Pemberian Obat" di
// inventory/DlgCariObat.java (BUKAN cuma stempel tanggal seperti versi
// awal endpoint ini). Ditemukan lewat pembacaan ulang DlgCariObat.java
// (5429 baris): `resep_obat.tgl_perawatan`/`jam` ("Tgl.Validasi"/"Jam
// Validasi" di Dashboard) di Java HANYA ditulis SEBAGAI EFEK SAMPING dari
// transaksi pemberian obat yang sesungguhnya — bukan aksi berdiri
// sendiri. Urutan asli Java per baris obat yang diserahkan (baris
// ~1550-1674):
//  1. UPDATE gudangbarang SET stok = stok - jumlah
//  2. Trackobat.catatRiwayat(..., "Pemberian Obat", ...) — SEBELUM update
//     stok (urutan sama seperti catatRiwayatBarangMedis di modul Apotek)
//  3. INSERT detail_obat_racikan/detail_pemberian_obat (rincian harga
//     jual & HPP untuk akuntansi)
//  4. Kalau P-Care aktif: submit obat ke BPJS
//  5. Hitung total jual/HPP → posting jurnal (tampjurnal, Suspen Piutang
//     Obat Ralan, Pendapatan Obat, HPP Persediaan)
//  6. BARU TERAKHIR, kalau semua sukses: UPDATE resep_obat SET
//     tgl_perawatan=..., jam=...
//
// **Penyederhanaan yang disengaja** (dikonfirmasi user, prioritas
// dipercepat): jalur (3) detail_obat_racikan/detail_pemberian_obat
// (piutang/billing per obat) DAN (4) P-Care/BPJS DAN (5) jurnal akuntansi
// TIDAK diport — proyek ini memang belum punya modul Keuangan/Jurnal
// (sama alasan dengan Penerimaan/Retur Beli yang juga skip integrasi
// jurnal). Yang diport HANYA (1)+(2) — potong stok + catat riwayat — dan
// (6) — stempel resep_obat. Jumlah yang diserahkan = jumlah PERESEPAN
// PENUH dari resep_dokter/resep_dokter_racikan_detail (tanpa UI edit
// jumlah parsial seperti tbObat.getValueAt(i,1) yang bisa diubah manual
// di Java) — kalau nanti butuh penyerahan sebagian, endpoint ini perlu
// diperluas terima daftar item+jumlah dari body request, bukan otomatis
// dari resep.
//
// Validasi stok cukup DITAMBAHKAN (Java sendiri TIDAK menjaga ini secara
// eksplisit di potongan yang dibaca) — konsisten dengan prinsip "transaksi
// yang benar-benar mengeluarkan barang fisik tidak boleh bikin stok
// minus" yang sudah dipakai submitMutasi/submitReturBeli.
//
// UPDATE: jumlah yang diserahkan sekarang BOLEH diedit dari frontend
// (ModalValidasiObat, kolom Jumlah bisa double-click) — kalau body.Items
// dikirim (non-kosong), dipakai APA ADANYA sebagai jumlah yang dipotong
// dari stok (BUKAN lagi otomatis re-query jumlah peresepan penuh dari
// resep_dokter/resep_dokter_racikan_detail). Ini padanan tbObat yang
// editable di DlgCariObat.java (getValueAt(i,1) bisa diubah manual sebelum
// simpan) — kalau body.Items kosong (klien lama/tidak kirim), fallback ke
// jumlah peresepan penuh seperti sebelumnya.
func submitPermintaanResepValidasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Param("no_resep")
		var body struct {
			Petugas string `json:"petugas"`
			Items   []struct {
				KodeBrng string  `json:"kode_brng"`
				Jml      float64 `json:"jml"`
			} `json:"items"`
			// RacikanHeaders — edit inline Nama Racikan/Metode Racik/Jml.Racik/
			// Aturan Pakai/Keterangan di tabel master racikan (ModalValidasiObat.tsx),
			// disimpan ke resep_dokter_racikan bareng transaksi validasi.
			RacikanHeaders []struct {
				NoRacik     int     `json:"no_racik"`
				NamaRacik   string  `json:"nama_racik"`
				KdRacik     string  `json:"kd_racik"`
				JmlDr       float64 `json:"jml_dr"`
				AturanPakai string  `json:"aturan_pakai"`
				Keterangan  string  `json:"keterangan"`
			} `json:"racikan_headers"`
			// DeletedRacikan — no_racik yang dihapus lewat tombol "Hapus" di
			// tabel master racikan (ModalValidasiObat.tsx). resep_dokter_racikan_detail
			// TIDAK punya FK cascade ke resep_dokter_racikan (cuma ke resep_obat/
			// databarang), jadi detailnya harus dihapus manual juga.
			DeletedRacikan []int `json:"deleted_racikan"`
			// KdBangsal — Depo dipilih manual lewat dropdown Depo di
			// ModalValidasiObat.tsx. Kalau kosong, fallback ke resolveDepoRalan
			// otomatis seperti sebelumnya.
			KdBangsal string `json:"kd_bangsal"`
		}
		c.ShouldBindJSON(&body)

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var noRawat, tglPeresepan string
		if err := tx.QueryRow(`SELECT no_rawat, tgl_peresepan FROM resep_obat WHERE no_resep=? AND status='ralan'`, noResep).
			Scan(&noRawat, &tglPeresepan); err != nil {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{"error": "Resep ralan tidak ditemukan"})
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
			kdBangsal = resolveDepoRalan(db, noRawat)
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
			// UPSERT — racikan baru (dari tombol "+ Tambah Racikan" di
			// ModalValidasiObat.tsx) belum ada baris di resep_dokter_racikan,
			// jadi INSERT; racikan lama diUPDATE seperti biasa.
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
