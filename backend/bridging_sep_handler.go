package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING SEP — penyimpanan lokal (tabel bridging_sep, sudah ada di skema
// Khanza) + pemanggilan API BPJS VClaim "Insert SEP".
//
// Alur: staf input data SEP secara lokal dulu (tanpa panggil BPJS) lewat
// saveBridgingSepLocal, baru kalau sudah siap & kredensial VClaim terisi di
// Pengaturan Bridging, klik "Kirim ke BPJS" yang memanggil sendSepToBpjs.
// ============================================================================

// BridgingSep merepresentasikan satu baris di tabel bridging_sep (field-field
// yang relevan untuk Insert SEP; kolom lain di tabel dibiarkan default).
type BridgingSep struct {
	NoSep          string `json:"no_sep"`
	NoRawat        string `json:"no_rawat"`
	Tglsep         string `json:"tglsep"`
	Tglrujukan     string `json:"tglrujukan"`
	NoRujukan      string `json:"no_rujukan"`
	Kdppkrujukan   string `json:"kdppkrujukan"`
	Nmppkrujukan   string `json:"nmppkrujukan"`
	Kdppkpelayanan string `json:"kdppkpelayanan"`
	Nmppkpelayanan string `json:"nmppkpelayanan"`
	Jnspelayanan   string `json:"jnspelayanan"`
	Catatan        string `json:"catatan"`
	Diagawal       string `json:"diagawal"`
	Nmdiagnosaawal string `json:"nmdiagnosaawal"`
	Kdpolitujuan   string `json:"kdpolitujuan"`
	Nmpolitujuan   string `json:"nmpolitujuan"`
	Klsrawat       string `json:"klsrawat"`
	Nomr           string `json:"nomr"`
	NamaPasien     string `json:"nama_pasien"`
	TanggalLahir   string `json:"tanggal_lahir"`
	Peserta        string `json:"peserta"`
	Jkel           string `json:"jkel"`
	NoKartu        string `json:"no_kartu"`
	Kddpjp         string `json:"kddpjp"`
	Nmdpdjp        string `json:"nmdpdjp"`
	Noskdp         string `json:"noskdp"`
	Klsnaik        string `json:"klsnaik"`
	Pembiayaan     string `json:"pembiayaan"`
	Pjnaikkelas    string `json:"pjnaikkelas"`
	// Kecelakaan Lalu Lintas (KLL) / Jasa Raharja
	Lakalantas    string `json:"lakalantas"`
	Kdprop        string `json:"kdprop"`
	Nmprop        string `json:"nmprop"`
	Kdkab         string `json:"kdkab"`
	Nmkab         string `json:"nmkab"`
	Kdkec         string `json:"kdkec"`
	Nmkec         string `json:"nmkec"`
	Tglkkl        string `json:"tglkkl"`
	Keterangankkl string `json:"keterangankkl"`
	Suplesi       string `json:"suplesi"`
	NoSepSuplesi  string `json:"no_sep_suplesi"`
	// Wajib diisi untuk update SEP (8.4/8.5)
	Notelep      string `json:"notelep"`
	UserEntry    string `json:"user_entry"`
	SudahDikirim bool   `json:"sudah_dikirim"`
	// Field tambahan VClaim SEP 2.0 — kolomnya sudah ada di tabel
	// bridging_sep sejak awal, baru diekspos di form Input SEP sekarang.
	AsalRujukan      string `json:"asal_rujukan"`     // "1" Faskes 1 / "2" Faskes 2 (RS)
	Eksekutif        string `json:"eksekutif"`        // "1" = Ya
	Cob              string `json:"cob"`              // Coordination of Benefit, "1" = Ya
	Katarak          string `json:"katarak"`          // "1" = Ya
	TujuanKunjungan  string `json:"tujuankunjungan"`  // "0" Normal / "1" / "2"
	FlagProsedur     string `json:"flagprosedur"`     // "" / "0" / "1"
	Penunjang        string `json:"penunjang"`        // "" / "1".."12"
	AsesmenPelayanan string `json:"asesmenpelayanan"` // "" / "1".."5"
	KdDpjpLayanan    string `json:"kddpjplayanan"`
	NmDpjpLayanan    string `json:"nmdpjplayanan"`
	// TglPulang — diisi lewat modal Update Tanggal Pulang (updateTglPulangSep),
	// ditambahkan di sini supaya ikut tampil di tabel daftar SEP (kolom
	// "Tanggal Pulang" di BPJSDataSEP.java).
	TglPulang string `json:"tglpulang"`
}

// bridgingSepSelectCols adalah daftar kolom yang dipakai bersama oleh semua
// query SELECT ke tabel bridging_sep (list, ambil-satu-untuk-kirim, dsb).
// Kolom "user" perlu backtick karena bentrok dengan kata kunci SQL.
const bridgingSepSelectCols = `
	no_sep, no_rawat, tglsep, COALESCE(tglrujukan,'0000-00-00'), COALESCE(no_rujukan,''),
	COALESCE(kdppkrujukan,''), COALESCE(nmppkrujukan,''), COALESCE(kdppkpelayanan,''), COALESCE(nmppkpelayanan,''),
	COALESCE(jnspelayanan,''), COALESCE(catatan,''), COALESCE(diagawal,''), COALESCE(nmdiagnosaawal,''),
	COALESCE(kdpolitujuan,''), COALESCE(nmpolitujuan,''), COALESCE(klsrawat,''),
	COALESCE(nomr,''), COALESCE(nama_pasien,''), COALESCE(tanggal_lahir,'0000-00-00'), COALESCE(peserta,''),
	COALESCE(jkel,''), COALESCE(no_kartu,''),
	COALESCE(kddpjp,''), COALESCE(nmdpdjp,''), COALESCE(noskdp,''), COALESCE(klsnaik,''),
	COALESCE(pembiayaan,''), COALESCE(pjnaikkelas,''),
	COALESCE(lakalantas,''), COALESCE(kdprop,''), COALESCE(nmprop,''), COALESCE(kdkab,''), COALESCE(nmkab,''),
	COALESCE(kdkec,''), COALESCE(nmkec,''), COALESCE(tglkkl,'0000-00-00'), COALESCE(keterangankkl,''),
	COALESCE(suplesi,''), COALESCE(no_sep_suplesi,''), COALESCE(notelep,''), COALESCE(` + "`user`" + `,''),
	COALESCE(asal_rujukan,''), COALESCE(eksekutif,''), COALESCE(cob,''), COALESCE(katarak,''),
	COALESCE(tujuankunjungan,''), COALESCE(flagprosedur,''), COALESCE(penunjang,''), COALESCE(asesmenpelayanan,''),
	COALESCE(kddpjplayanan,''), COALESCE(nmdpjplayanan,''),
	COALESCE(tglpulang,'0000-00-00 00:00:00')
`

type sepRowScanner interface {
	Scan(dest ...interface{}) error
}

// scanBridgingSepRow memindahkan hasil query bridgingSepSelectCols ke struct
// BridgingSep — dipakai baik untuk sql.Rows (list) maupun sql.Row (ambil satu).
func scanBridgingSepRow(row sepRowScanner, s *BridgingSep) error {
	return row.Scan(
		&s.NoSep, &s.NoRawat, &s.Tglsep, &s.Tglrujukan, &s.NoRujukan,
		&s.Kdppkrujukan, &s.Nmppkrujukan, &s.Kdppkpelayanan, &s.Nmppkpelayanan,
		&s.Jnspelayanan, &s.Catatan, &s.Diagawal, &s.Nmdiagnosaawal,
		&s.Kdpolitujuan, &s.Nmpolitujuan, &s.Klsrawat,
		&s.Nomr, &s.NamaPasien, &s.TanggalLahir, &s.Peserta, &s.Jkel, &s.NoKartu,
		&s.Kddpjp, &s.Nmdpdjp, &s.Noskdp, &s.Klsnaik, &s.Pembiayaan, &s.Pjnaikkelas,
		&s.Lakalantas, &s.Kdprop, &s.Nmprop, &s.Kdkab, &s.Nmkab,
		&s.Kdkec, &s.Nmkec, &s.Tglkkl, &s.Keterangankkl,
		&s.Suplesi, &s.NoSepSuplesi, &s.Notelep, &s.UserEntry,
		&s.AsalRujukan, &s.Eksekutif, &s.Cob, &s.Katarak,
		&s.TujuanKunjungan, &s.FlagProsedur, &s.Penunjang, &s.AsesmenPelayanan,
		&s.KdDpjpLayanan, &s.NmDpjpLayanan, &s.TglPulang,
	)
}

// getBridgingSepListFromTable adalah isi bersama getBridgingSepList (tabel
// bridging_sep) & getBridgingSepInternalList (tabel bridging_sep_internal —
// fallback lokal saat Insert SEP ke BPJS gagal, lihat BPJSDataSEP.java
// insertSEP(); skema kolomnya identik dengan bridging_sep). Nama tabel
// selalu berasal dari kode di sini, bukan input pengguna, jadi aman
// digabung langsung ke query.
func getBridgingSepListFromTable(db *sql.DB, table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		search := c.Query("search")

		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		query := `SELECT ` + bridgingSepSelectCols + ` FROM ` + table + ` WHERE tglsep BETWEEN ? AND ?`
		args := []interface{}{tglDari, tglSampai}
		if search != "" {
			query += ` AND (no_sep LIKE ? OR no_rawat LIKE ? OR nama_pasien LIKE ? OR nomr LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern, pattern)
		}
		query += ` ORDER BY tglsep DESC, no_sep DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []BridgingSep{}
		for rows.Next() {
			var s BridgingSep
			if err := scanBridgingSepRow(rows, &s); err != nil {
				continue
			}
			s.SudahDikirim = true // ada di tabel = sudah tercatat (lokal atau terkirim)
			items = append(items, s)
		}
		c.JSON(http.StatusOK, items)
	}
}

func getBridgingSepList(db *sql.DB) gin.HandlerFunc {
	return getBridgingSepListFromTable(db, "bridging_sep")
}

// getBridgingSepByNoRawat — ambil SATU SEP lokal persis berdasarkan
// no_rawat (exact match, beda dari getBridgingSepList yang search-nya LIKE
// dan bisa multi-hasil). Dipakai tombol "[BPJS] > Cetak SEP" di Pendaftaran
// — kalau kunjungan ini belum pernah diinput SEP-nya, 404 (staf diarahkan
// input SEP dulu lewat modul Bridging > SEP, bukan langsung dikosongkan).
func getBridgingSepByNoRawat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		row := db.QueryRow(`SELECT `+bridgingSepSelectCols+` FROM bridging_sep WHERE no_rawat = ? LIMIT 1`, noRawat)
		var s BridgingSep
		if err := scanBridgingSepRow(row, &s); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "SEP belum diterbitkan untuk kunjungan ini"})
			return
		}
		s.SudahDikirim = true
		c.JSON(http.StatusOK, s)
	}
}

// getBridgingSepCountToday menghitung jumlah SEP yang tglsep-nya hari ini —
// dipakai kartu "SEP Terbit Hari Ini" di Overview Bridging BPJS. Query
// ringan (COUNT saja), sengaja terpisah dari getBridgingSepList supaya
// tidak perlu narik 52 kolom cuma buat angka.
func getBridgingSepCountToday(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM bridging_sep WHERE tglsep = CURDATE()`).Scan(&count); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// getBridgingSepInternalList menampilkan daftar SEP Internal (tab "Data SEP
// Internal") — kolomnya sama persis dengan tab "Data SEP" (tabModeInternal
// di BPJSDataSEP.java identik dengan tabMode).
func getBridgingSepInternalList(db *sql.DB) gin.HandlerFunc {
	return getBridgingSepListFromTable(db, "bridging_sep_internal")
}

// upsertBridgingSepLocal menyimpan/mengubah satu baris bridging_sep secara
// lokal (upsert berdasarkan no_sep) — dipakai baik oleh saveBridgingSepLocal
// (simpan draft) maupun updateSepToBpjs (sinkron lokal setelah update BPJS
// berhasil). Field Suplesi memakai konvensi "0"/"1" (bukan teks enum
// "0. Tidak"/"1.Ya" apa adanya di kolom MySQL) supaya lebih sederhana dipakai
// dari sisi Go/JSON; di sini baru dipetakan ke teks enum aslinya.
// tidakYaEnumText memetakan pilihan checkbox sederhana ("1" / "") dari
// frontend ke teks enum lengkap dipakai kolom-kolom tipe "0. Tidak"/"1.Ya"
// di tabel bridging_sep (suplesi, eksekutif, cob, katarak).
func tidakYaEnumText(v string) string {
	if v == "1" || strings.EqualFold(v, "1.ya") || strings.EqualFold(v, "1. ya") {
		return "1.Ya"
	}
	return "0. Tidak"
}

// asalRujukanEnumText memetakan kode sederhana ("1"/"2") ke teks enum
// lengkap kolom asal_rujukan. Default Faskes 1 kalau kosong.
func asalRujukanEnumText(v string) string {
	if strings.HasPrefix(strings.TrimSpace(v), "2") {
		return "2. Faskes 2(RS)"
	}
	return "1. Faskes 1"
}

func upsertBridgingSepLocal(db *sql.DB, s BridgingSep) error {
	suplesiVal := tidakYaEnumText(s.Suplesi)
	eksekutifVal := tidakYaEnumText(s.Eksekutif)
	cobVal := tidakYaEnumText(s.Cob)
	katarakVal := tidakYaEnumText(s.Katarak)
	asalRujukanVal := asalRujukanEnumText(s.AsalRujukan)
	tujuanKunjunganVal := s.TujuanKunjungan
	if tujuanKunjunganVal == "" {
		tujuanKunjunganVal = "0"
	}
	_, err := db.Exec(`
		INSERT INTO bridging_sep (
			no_sep, no_rawat, tglsep, tglrujukan, no_rujukan,
			kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan,
			jnspelayanan, catatan, diagawal, nmdiagnosaawal,
			kdpolitujuan, nmpolitujuan, klsrawat,
			nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu,
			kddpjp, nmdpdjp, noskdp, klsnaik, pembiayaan, pjnaikkelas,
			lakalantas, kdprop, nmprop, kdkab, nmkab, kdkec, nmkec,
			tglkkl, keterangankkl, suplesi, no_sep_suplesi, notelep, `+"`user`"+`,
			asal_rujukan, eksekutif, cob, katarak,
			tujuankunjungan, flagprosedur, penunjang, asesmenpelayanan,
			kddpjplayanan, nmdpjplayanan
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			no_rawat=VALUES(no_rawat), tglsep=VALUES(tglsep), tglrujukan=VALUES(tglrujukan), no_rujukan=VALUES(no_rujukan),
			kdppkrujukan=VALUES(kdppkrujukan), nmppkrujukan=VALUES(nmppkrujukan),
			kdppkpelayanan=VALUES(kdppkpelayanan), nmppkpelayanan=VALUES(nmppkpelayanan),
			jnspelayanan=VALUES(jnspelayanan), catatan=VALUES(catatan), diagawal=VALUES(diagawal), nmdiagnosaawal=VALUES(nmdiagnosaawal),
			kdpolitujuan=VALUES(kdpolitujuan), nmpolitujuan=VALUES(nmpolitujuan), klsrawat=VALUES(klsrawat),
			nomr=VALUES(nomr), nama_pasien=VALUES(nama_pasien), tanggal_lahir=VALUES(tanggal_lahir),
			peserta=VALUES(peserta), jkel=VALUES(jkel), no_kartu=VALUES(no_kartu),
			kddpjp=VALUES(kddpjp), nmdpdjp=VALUES(nmdpdjp), noskdp=VALUES(noskdp),
			klsnaik=VALUES(klsnaik), pembiayaan=VALUES(pembiayaan), pjnaikkelas=VALUES(pjnaikkelas),
			lakalantas=VALUES(lakalantas), kdprop=VALUES(kdprop), nmprop=VALUES(nmprop),
			kdkab=VALUES(kdkab), nmkab=VALUES(nmkab), kdkec=VALUES(kdkec), nmkec=VALUES(nmkec),
			tglkkl=VALUES(tglkkl), keterangankkl=VALUES(keterangankkl), suplesi=VALUES(suplesi),
			no_sep_suplesi=VALUES(no_sep_suplesi), notelep=VALUES(notelep), `+"`user`"+`=VALUES(`+"`user`"+`),
			asal_rujukan=VALUES(asal_rujukan), eksekutif=VALUES(eksekutif), cob=VALUES(cob), katarak=VALUES(katarak),
			tujuankunjungan=VALUES(tujuankunjungan), flagprosedur=VALUES(flagprosedur), penunjang=VALUES(penunjang),
			asesmenpelayanan=VALUES(asesmenpelayanan), kddpjplayanan=VALUES(kddpjplayanan), nmdpjplayanan=VALUES(nmdpjplayanan)
	`,
		s.NoSep, s.NoRawat, nullIfEmptyDate(s.Tglsep), nullIfEmptyDate(s.Tglrujukan), s.NoRujukan,
		s.Kdppkrujukan, s.Nmppkrujukan, s.Kdppkpelayanan, s.Nmppkpelayanan,
		s.Jnspelayanan, s.Catatan, s.Diagawal, s.Nmdiagnosaawal,
		s.Kdpolitujuan, s.Nmpolitujuan, s.Klsrawat,
		s.Nomr, s.NamaPasien, nullIfEmptyDate(s.TanggalLahir), s.Peserta, s.Jkel, s.NoKartu,
		s.Kddpjp, s.Nmdpdjp, s.Noskdp, s.Klsnaik, s.Pembiayaan, s.Pjnaikkelas,
		nullIfEmptyStr(s.Lakalantas), s.Kdprop, s.Nmprop, s.Kdkab, s.Nmkab, s.Kdkec, s.Nmkec,
		s.Tglkkl, s.Keterangankkl, suplesiVal, s.NoSepSuplesi, s.Notelep, s.UserEntry,
		asalRujukanVal, eksekutifVal, cobVal, katarakVal,
		tujuanKunjunganVal, s.FlagProsedur, s.Penunjang, s.AsesmenPelayanan,
		s.KdDpjpLayanan, s.NmDpjpLayanan,
	)
	return err
}

func saveBridgingSepLocal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s BridgingSep
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(s.NoSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}
		if strings.TrimSpace(s.NoRawat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rawat wajib diisi"})
			return
		}

		if err := upsertBridgingSepLocal(db, s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil disimpan", "no_sep": s.NoSep})
	}
}

// validateSepBeforeKirim menerapkan validasi wajib sebelum SEP dikirim ke
// BPJS, sesuai skenario "message box" yang didokumentasikan pada spesifikasi
// UAT SEP RJTL/RITL/KLL (rujukan online, offline, rawat inap, kecelakaan
// lalu lintas) serta validasi umum SEP (bagian 7):
//   - DPJP tidak boleh kosong
//   - No. Rujukan tidak boleh kosong
//   - Kalau naik kelas rawat diisi: pembiayaan & penanggung jawab wajib
//     diisi, dan kenaikan maksimal 1 tingkat di atas hak kelas peserta
//   - Kalau rawat inap (jnsPelayanan=1): No. SKDP/SPRI wajib diisi
//   - Kelas rawat harus 1/2/3 (7.6); tgl SEP tidak boleh > hari ini (7.1);
//     tgl rujukan tidak boleh > tgl SEP (7.3); diagnosa katarak harus poli
//     mata (7.8)
//   - Lakalantas/KLL (6.1.1-6.1.5, 6.1.8): lakalantas harus 0/1/2/3; kalau
//     KLL (lakalantas<>0) kode propinsi/kabupaten/kecamatan wajib diisi dan
//     tgl kejadian tidak boleh > tgl SEP; kalau suplesi diisi, no. SEP
//     suplesi wajib diisi
//
// Validasi yang butuh status/riwayat sisi BPJS (7.2 tgl TMT peserta, 7.4
// backdate approval, 7.5 status RITL belum pulang, 7.7 info potensi PRB,
// 7.9 IRM ke-3 dalam 7 hari) tidak diterapkan di sini karena data tersebut
// tidak tersimpan lokal — pesan penolakan BPJS untuk skenario ini akan
// diteruskan apa adanya dari respons vclaimRequest saat dikirim.
func validateSepBeforeKirim(s BridgingSep) string {
	if strings.TrimSpace(s.Kddpjp) == "" {
		return "DPJP kosong"
	}
	if strings.TrimSpace(s.NoRujukan) == "" {
		return "Nomor rujukan kosong"
	}
	if strings.TrimSpace(s.Klsnaik) != "" {
		if strings.TrimSpace(s.Pembiayaan) == "" || strings.TrimSpace(s.Pjnaikkelas) == "" {
			return "Pembiayaan dan penanggung jawab naik kelas kosong atau tidak sesuai"
		}
		hak, errHak := strconv.Atoi(s.Klsrawat)
		naik, errNaik := strconv.Atoi(s.Klsnaik)
		if errHak == nil && errNaik == nil && (hak-naik) > 1 {
			return "Kelas rawat lebih dari 1 kelas di atas kelas hak peserta"
		}
	}
	// jnsPelayanan: "1" = Rawat Inap, "2" = Rawat Jalan — dikonfirmasi dari
	// spec resmi Insert SEP 2.0 (contoh request memakai jnsPelayanan="1"
	// dengan catatan "testinsert RI"), BUKAN kebalikannya seperti asumsi
	// awal form ini.
	if s.Jnspelayanan == "1" && strings.TrimSpace(s.Noskdp) == "" {
		return "SPRI/SKDP kosong atau tidak sesuai"
	}

	// 7.6 — kelas rawat harus 1/2/3
	if s.Klsrawat != "" && s.Klsrawat != "1" && s.Klsrawat != "2" && s.Klsrawat != "3" {
		return "Kelas rawat tidak sesuai"
	}

	// 7.1 — tgl SEP tidak boleh melebihi tanggal pembuatan SEP (hari ini)
	if tglSep, err := time.Parse("2006-01-02", s.Tglsep); err == nil {
		today, _ := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
		if tglSep.After(today) {
			return "Tanggal SEP melebihi tanggal pembuatan SEP"
		}
	}

	// 7.3 — tgl rujukan tidak boleh melebihi tgl SEP
	if s.Tglrujukan != "" && s.Tglrujukan != "0000-00-00" {
		if tglRuj, errR := time.Parse("2006-01-02", s.Tglrujukan); errR == nil {
			if tglSep, errS := time.Parse("2006-01-02", s.Tglsep); errS == nil && tglRuj.After(tglSep) {
				return "Tanggal rujukan melebihi tanggal SEP"
			}
		}
	}

	// 7.8 — pelayanan katarak harus poli mata
	if strings.Contains(strings.ToLower(s.Nmdiagnosaawal), "katarak") &&
		!strings.Contains(strings.ToLower(s.Nmpolitujuan), "mata") {
		return "Pelayanan katarak harus poli mata"
	}

	// 6.1.2-6.1.5 — validasi lakalantas / KLL (Jasa Raharja)
	if strings.TrimSpace(s.Lakalantas) != "" {
		if s.Lakalantas != "0" && s.Lakalantas != "1" && s.Lakalantas != "2" && s.Lakalantas != "3" {
			return "Lakalantas tidak sesuai"
		}
		if s.Lakalantas != "0" {
			if strings.TrimSpace(s.Kdprop) == "" {
				return "Kode propinsi kosong"
			}
			if strings.TrimSpace(s.Kdkab) == "" {
				return "Kode kabupaten/kota kosong"
			}
			if strings.TrimSpace(s.Kdkec) == "" {
				return "Kode kecamatan kosong"
			}
			// 6.1.1 — tgl kejadian tidak boleh melebihi tgl SEP
			if s.Tglkkl != "" && s.Tglkkl != "0000-00-00" {
				if tglKkl, errK := time.Parse("2006-01-02", s.Tglkkl); errK == nil {
					if tglSep, errS := time.Parse("2006-01-02", s.Tglsep); errS == nil && tglKkl.After(tglSep) {
						return "Tanggal kejadian lebih dari tanggal SEP"
					}
				}
			}
		}
	}

	// 6.1.8 — suplesi diisi tapi no. SEP suplesi kosong
	if s.Suplesi == "1" || strings.EqualFold(s.Suplesi, "1.ya") || strings.EqualFold(s.Suplesi, "1. ya") {
		if strings.TrimSpace(s.NoSepSuplesi) == "" {
			return "No. SEP suplesi tidak ditemukan"
		}
	}

	return ""
}

func nullIfEmptyDate(s string) interface{} {
	if strings.TrimSpace(s) == "" || s == "0000-00-00" {
		return nil
	}
	return s
}

func nullIfEmptyStr(s string) interface{} {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

// sepRequiresFingerprint menentukan apakah poli tujuan SEP termasuk salah
// satu dari 4 spesialistik yang mewajibkan validasi sidik jari sebelum SEP
// diterbitkan (bagian 16): Mata, Jantung, IRM (Instalasi Rehabilitasi
// Medik/fisioterapi), dan Hemodialisa. Deteksi berbasis substring nama poli
// karena kode poli lokal tidak selalu sama dengan kode referensi BPJS.
func sepRequiresFingerprint(nmPoliTujuan string) bool {
	poli := strings.ToLower(nmPoliTujuan)
	keywords := []string{"mata", "jantung", "irm", "rehabilitasi medik", "fisioterapi", "hemodialisa", "hemodialisis"}
	for _, kw := range keywords {
		if strings.Contains(poli, kw) {
			return true
		}
	}
	return false
}

// ============================================================================
// Pemanggilan API BPJS VClaim — signature & enkripsi mengikuti skema resmi
// yang dipakai di seluruh endpoint VClaim (sama untuk SEP/Rujukan/Peserta/dll).
// BELUM diuji terhadap API BPJS sungguhan — perlu Cons ID & Secret Key asli
// di Pengaturan Bridging (kode: bpjs_vclaim) untuk verifikasi end-to-end.
// ============================================================================

type vclaimConfig struct {
	URL       string
	ConsID    string
	SecretKey string
	UserKey   string
	// UserCode — kode staf pendek (≤9 karakter, tanpa spasi) yang dikirim
	// sebagai field "user" ke VClaim Insert/Update SEP. Di Khanza Desktop
	// ini otomatis dari user yang sedang login (akses.getkode()), bukan
	// diketik manual per SEP (BPJSDataSEP.java: user=akses.getkode()...).
	// ERMApp belum punya konsep sesi multi-user, jadi sementara diambil
	// dari satu nilai config bersama; fallback "ermapp" kalau belum diisi.
	UserCode string
}

func getVclaimConfig(db *sql.DB) (*vclaimConfig, error) {
	return getBpjsConfigByKode(db, "bpjs_vclaim", "BPJS VClaim")
}

// getBpjsConfigByKode membaca konfigurasi URL/Consumer ID/Secret Key untuk
// layanan REST BPJS mana pun yang memakai skema signature/enkripsi yang sama
// (VClaim, HFIS, dll) dari tabel setting_bridging, dibedakan lewat kolom kode.
func getBpjsConfigByKode(db *sql.DB, kode, labelUntukPesan string) (*vclaimConfig, error) {
	var configJSON string
	err := db.QueryRow(`SELECT COALESCE(config,'{}') FROM setting_bridging WHERE kode = ?`, kode).Scan(&configJSON)
	if err != nil {
		return nil, fmt.Errorf("konfigurasi bridging %s tidak ditemukan", kode)
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(configJSON), &m); err != nil {
		return nil, fmt.Errorf("konfigurasi %s tidak valid", kode)
	}
	cfg := &vclaimConfig{URL: strings.TrimRight(m["URL"], "/"), ConsID: m["CONSID"], SecretKey: m["SECRETKEY"], UserKey: m["USERKEY"], UserCode: m["USERCODE"]}
	if cfg.URL == "" || cfg.ConsID == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("URL, Consumer ID, dan Secret Key %s belum diisi di Pengaturan Bridging", labelUntukPesan)
	}
	// User Key belum tentu diisi di semua layanan (baru ada kolomnya di
	// Pengaturan Bridging untuk VClaim) — fallback ke Secret Key seperti
	// sebelum kolom ini ada, supaya layanan lain (HFIS/Mobile JKN) tetap jalan.
	if cfg.UserKey == "" {
		cfg.UserKey = cfg.SecretKey
	}
	return cfg, nil
}

// vclaimSignature menghasilkan X-signature: base64(HMAC-SHA256(consID&timestamp, secretKey)).
func vclaimSignature(consID, secretKey, timestamp string) string {
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(consID + "&" + timestamp))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// vclaimDecrypt mendekripsi field "response" (base64 AES-256-CBC, padding
// PKCS7) yang dikembalikan API VClaim/HFIS, lalu mendekompresi hasilnya
// (format LZString — BPJS mengompres JSON sebelum dienkripsi, jadi plaintext
// AES bukan JSON siap pakai). Key = 32 byte mentah dari
// SHA-256(consID+secretKey+timestamp); IV = 16 byte pertama dari digest
// SHA-256 yang sama — dikonfirmasi dari implementasi PHP (mlite) yang
// terbukti berhasil di production, BUKAN dari skema MD5+IV-nol yang
// sebelumnya dipakai di sini (salah, menyebabkan hasil dekripsi acak).
func vclaimDecrypt(cipherB64, consID, secretKey, timestamp string) (string, error) {
	sum := sha256.Sum256([]byte(consID + secretKey + timestamp))
	key := sum[:]
	iv := sum[:aes.BlockSize]

	ciphertext, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return "", fmt.Errorf("gagal decode base64: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("gagal inisialisasi AES: %w", err)
	}
	if len(ciphertext)%aes.BlockSize != 0 {
		return "", errors.New("panjang ciphertext tidak valid")
	}
	mode := cipher.NewCBCDecrypter(block, iv)
	plain := make([]byte, len(ciphertext))
	mode.CryptBlocks(plain, ciphertext)

	// Buang PKCS7 padding
	if len(plain) == 0 {
		return "", errors.New("hasil dekripsi kosong")
	}
	padLen := int(plain[len(plain)-1])
	if padLen > 0 && padLen <= aes.BlockSize && padLen <= len(plain) {
		plain = plain[:len(plain)-padLen]
	}

	decompressed, err := lzDecompressFromEncodedURIComponent(string(plain))
	if err != nil {
		return "", fmt.Errorf("gagal dekompresi LZString: %w", err)
	}
	return decompressed, nil
}

// vclaimRequest melakukan request ke endpoint VClaim dan mendekripsi field
// "response" pada body hasil. method: "GET" atau "POST". path relatif
// terhadap base URL (mis. "/SEP/2.0.0" untuk Insert SEP, tanpa slash awal).
func vclaimRequest(cfg *vclaimConfig, method, path string, bodyJSON []byte) (map[string]interface{}, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10) // Unix timestamp polos (detik sejak 1 Jan 1970), sesuai skema resmi VClaim
	signature := vclaimSignature(cfg.ConsID, cfg.SecretKey, timestamp)

	url := cfg.URL + "/" + strings.TrimLeft(path, "/")
	req, err := http.NewRequest(method, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("X-cons-id", cfg.ConsID)
	req.Header.Set("X-timestamp", timestamp)
	req.Header.Set("X-signature", signature)
	req.Header.Set("user_key", cfg.UserKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi server BPJS: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		MetaData struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"metaData"`
		Response interface{} `json:"response"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("respon BPJS tidak dikenali: %s", string(raw))
	}

	if envelope.MetaData.Code != "200" && envelope.MetaData.Code != "" {
		return nil, fmt.Errorf("BPJS menolak: %s (kode %s)", envelope.MetaData.Message, envelope.MetaData.Code)
	}

	respStr, ok := envelope.Response.(string)
	if !ok || respStr == "" {
		return map[string]interface{}{}, nil
	}
	decrypted, err := vclaimDecrypt(respStr, cfg.ConsID, cfg.SecretKey, timestamp)
	if err != nil {
		// Tidak semua endpoint VClaim mengembalikan "response" terenkripsi —
		// mis. SEP/2.0/update & SEP/2.0/delete mengembalikannya sebagai
		// STRING POLOS (dikonfirmasi dari dokumen resmi: contoh respons
		// update cuma `"response": "1101R0070420V000017"`, echo No. SEP,
		// bukan ciphertext). metaData.code sudah dipastikan "200" di atas
		// (sukses), jadi kegagalan dekripsi di sini BUKAN berarti request-nya
		// gagal — teruskan apa adanya di bawah key "raw" alih-alih dianggap
		// error (yang sebelumnya bikin Update/Delete SEP selalu dilaporkan
		// gagal padahal BPJS sudah menerimanya).
		return map[string]interface{}{"raw": respStr}, nil
	}
	parsed, err := parseDecryptedJSON(decrypted)
	if err != nil {
		// Sama halnya kalau berhasil didekripsi tapi hasilnya bukan JSON
		// valid — tetap bukan kegagalan request, teruskan sebagai teks.
		return map[string]interface{}{"raw": decrypted}, nil
	}
	return parsed, nil
}

// parseDecryptedJSON mem-parse hasil dekripsi (yang sudah didekompresi
// LZString) sebagai JSON. Sebagian endpoint VClaim/HFIS mengembalikan objek
// ({"list":[...], ...}) tapi sebagian lain (mis. antrean/pendaftaran/aktif)
// mengembalikan ARRAY polos di root — dibungkus jadi {"list": [...]} supaya
// pemanggil (yang selalu mengharapkan map[string]interface{}, dan frontend
// yang selalu membaca field "list") tetap konsisten untuk kedua bentuk.
func parseDecryptedJSON(decrypted string) (map[string]interface{}, error) {
	var asMap map[string]interface{}
	if err := json.Unmarshal([]byte(decrypted), &asMap); err == nil {
		return asMap, nil
	}
	var asArray []interface{}
	if err := json.Unmarshal([]byte(decrypted), &asArray); err == nil {
		return map[string]interface{}{"list": asArray}, nil
	}
	return nil, fmt.Errorf("hasil dekripsi bukan JSON valid: %s", decrypted)
}

// enumLeadingDigit mengambil digit kode pendek ("0"/"1"/"2", dst) dari teks
// enum lengkap yang dipakai kolom MySQL (mis. "1.Ya" -> "1", "2. Faskes
// 2(RS)" -> "2") untuk dikirim ke payload BPJS, yang memang cuma mau kode
// pendeknya. Fallback dipakai kalau field kosong.
func enumLeadingDigit(v, fallback string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return fallback
	}
	return string(v[0])
}

// firstNonEmpty mengembalikan a kalau tidak kosong, selain itu b.
func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

// sepUserCode menghasilkan field "user" payload SEP — meniru aturan Khanza
// Desktop (BPJSDataSEP.java: user=akses.getkode().replace(" ","").substring(0,9),
// diambil dari user yang SEDANG LOGIN, bukan nilai statis). ERMApp sudah
// punya manajemen user (app_users) — frontend mengirim username staf yang
// login lewat field user_entry (lihat BpjsSep.tsx, dibaca dari localStorage
// "ermapp_user"), diprioritaskan di sini. Fallback ke config bersama
// (setting_bridging bpjs_vclaim, field USERCODE) kalau frontend belum
// mengirimnya, lalu "ermapp" kalau keduanya kosong.
func sepUserCode(cfg *vclaimConfig, requestUser string) string {
	code := strings.ReplaceAll(strings.TrimSpace(requestUser), " ", "")
	if code == "" {
		code = strings.ReplaceAll(strings.TrimSpace(cfg.UserCode), " ", "")
	}
	if code == "" {
		return "ermapp"
	}
	if len(code) > 9 {
		code = code[:9]
	}
	return code
}

// buildJaminanPayload menyusun blok "jaminan" — SELALU dikirim (bukan cuma
// saat lakalantas diisi seperti asumsi awal kami), lakaLantas berupa string
// digit langsung (bukan objek bersarang), dan "noLP" cuma ada di payload
// INSERT (tidak dikirim lagi saat update). Persis BPJSDataSEP.java.
func buildJaminanPayload(s BridgingSep, includeNoLP bool) map[string]interface{} {
	jaminan := map[string]interface{}{
		"lakaLantas": enumLeadingDigit(s.Lakalantas, "0"),
		"penjamin": map[string]interface{}{
			"tglKejadian": strings.ReplaceAll(s.Tglkkl, "0000-00-00", ""),
			"keterangan":  s.Keterangankkl,
			"suplesi": map[string]interface{}{
				"suplesi":      enumLeadingDigit(s.Suplesi, "0"),
				"noSepSuplesi": s.NoSepSuplesi,
				"lokasiLaka": map[string]interface{}{
					"kdPropinsi":  s.Kdprop,
					"kdKabupaten": s.Kdkab,
					"kdKecamatan": s.Kdkec,
				},
			},
		},
	}
	if includeNoLP {
		// No. Laporan Polisi tidak lagi disimpan lokal (kolomnya sempat
		// ditambahkan lalu dibatalkan karena bikin SIMRS Khanza Desktop
		// gagal simpan SEP — insert-nya berbasis posisi kolom, jadi kolom
		// baru di tengah tabel menggeser semuanya). Dikirim kosong dulu.
		jaminan["noLP"] = ""
	}
	return jaminan
}

// buildSepInsertPayload menyusun payload "t_sep" untuk POST SEP/2.0/insert,
// PERSIS mengikuti BPJSDataSEP.java (Khanza Desktop, method insertSEP()) —
// beberapa nama & bentuk field ternyata beda dari asumsi awal kami:
// "noMR" (bukan "noMr"), "cob"/"katarak" objek bersarang berisi field
// senama (bukan string langsung), "tujuanKunj"/"flagProcedure"/
// "kdPenunjang"/"assesmentPel" (bukan nama deskriptif yang kami tebak),
// "skdp.kodeDPJP" (bukan "kodeDpjp"). "user" diambil dari config, bukan
// form (lihat sepUserCode).
func buildSepInsertPayload(s BridgingSep, userCode string) map[string]interface{} {
	tujuanKunj := firstNonEmpty(s.TujuanKunjungan, "0")

	// flagProcedure & kdPenunjang WAJIB kosong kalau tujuanKunj="0" (Normal)
	// — dikonfirmasi dari spec resmi ("diisi \"\" jika tujuanKunj = \"0\"").
	// Dipaksa kosong di sini (bukan cuma mengandalkan form) supaya kombinasi
	// yang tidak valid tidak pernah terkirim ke BPJS.
	flagProcedure := s.FlagProsedur
	kdPenunjang := s.Penunjang
	if tujuanKunj == "0" {
		flagProcedure = ""
		kdPenunjang = ""
	}

	// dpjpLayan TIDAK diisi kalau jnsPelayanan="1" (Rawat Inap) — dikonfirmasi
	// dari spec resmi. dpjpLayan sebelumnya juga sempat salah dipetakan ke
	// Kddpjp yang sama dengan skdp.kodeDPJP — kolom kddpjplayanan memang
	// untuk DPJP layanan yang bisa beda dari DPJP di SKDP.
	dpjpLayan := ""
	if s.Jnspelayanan != "1" {
		dpjpLayan = firstNonEmpty(s.KdDpjpLayanan, s.Kddpjp)
	}

	return map[string]interface{}{
		"noKartu":      s.NoKartu,
		"tglSep":       s.Tglsep,
		"ppkPelayanan": s.Kdppkpelayanan,
		// jnsPelayanan: "1" = Rawat Inap, "2" = Rawat Jalan — dikonfirmasi
		// dari spec resmi (contoh request jnsPelayanan="1" + catatan
		// "testinsert RI"), BUKAN kebalikannya seperti asumsi awal form ini.
		"jnsPelayanan": s.Jnspelayanan,
		"klsRawat": map[string]interface{}{
			"klsRawatHak":     s.Klsrawat,
			"klsRawatNaik":    s.Klsnaik,
			"pembiayaan":      s.Pembiayaan,
			"penanggungJawab": s.Pjnaikkelas,
		},
		"noMR": s.Nomr,
		"rujukan": map[string]interface{}{
			"asalRujukan": enumLeadingDigit(s.AsalRujukan, "1"),
			"tglRujukan":  s.Tglrujukan,
			"noRujukan":   s.NoRujukan,
			"ppkRujukan":  s.Kdppkrujukan,
		},
		"catatan":  s.Catatan,
		"diagAwal": s.Diagawal,
		"poli": map[string]interface{}{
			"tujuan":    s.Kdpolitujuan,
			"eksekutif": enumLeadingDigit(s.Eksekutif, "0"),
		},
		"cob":           map[string]interface{}{"cob": enumLeadingDigit(s.Cob, "0")},
		"katarak":       map[string]interface{}{"katarak": enumLeadingDigit(s.Katarak, "0")},
		"jaminan":       buildJaminanPayload(s, true),
		"tujuanKunj":    tujuanKunj,
		"flagProcedure": flagProcedure,
		"kdPenunjang":   kdPenunjang,
		"assesmentPel":  s.AsesmenPelayanan,
		"skdp": map[string]interface{}{
			"noSurat":  s.Noskdp,
			"kodeDPJP": s.Kddpjp,
		},
		"dpjpLayan": dpjpLayan,
		"noTelp":    s.Notelep,
		"user":      userCode,
	}
}

// buildSepUpdatePayload menyusun payload "t_sep" untuk PUT SEP/2.0/update,
// persis BPJSDataSEP.java (BtnEditActionPerformed()) — sengaja TIDAK
// menyertakan field yang tidak bisa diubah lagi setelah SEP terbit
// (noKartu, tglSep, ppkPelayanan, jnsPelayanan, rujukan, tujuanKunj,
// flagProcedure, kdPenunjang, assesmentPel, skdp, noLP) — beda dari insert.
func buildSepUpdatePayload(s BridgingSep, userCode string) map[string]interface{} {
	return map[string]interface{}{
		"noSep": s.NoSep,
		"klsRawat": map[string]interface{}{
			"klsRawatHak":     s.Klsrawat,
			"klsRawatNaik":    s.Klsnaik,
			"pembiayaan":      s.Pembiayaan,
			"penanggungJawab": s.Pjnaikkelas,
		},
		"noMR":     s.Nomr,
		"catatan":  s.Catatan,
		"diagAwal": s.Diagawal,
		"poli": map[string]interface{}{
			"tujuan":    s.Kdpolitujuan,
			"eksekutif": enumLeadingDigit(s.Eksekutif, "0"),
		},
		"cob":       map[string]interface{}{"cob": enumLeadingDigit(s.Cob, "0")},
		"katarak":   map[string]interface{}{"katarak": enumLeadingDigit(s.Katarak, "0")},
		"jaminan":   buildJaminanPayload(s, false),
		"dpjpLayan": firstNonEmpty(s.KdDpjpLayanan, s.Kddpjp),
		"noTelp":    s.Notelep,
		"user":      userCode,
	}
}

// sendSepToBpjs mengirim data SEP lokal ke BPJS VClaim (Insert SEP).
// doInsertSepToBpjs memanggil BPJS Insert SEP (POST SEP/2.0/insert), lalu
// menyimpan hasilnya lokal memakai No. SEP SESUNGGUHNYA yang dikembalikan
// BPJS (response.sep.noSep) — BUKAN nilai s.NoSep yang mungkin sudah
// terisi sebelumnya. Ini BEDA dari asumsi awal kami: VClaim Insert SEP
// TIDAK menerima noSep sebagai input sama sekali (lihat BPJSDataSEP.java,
// method insertSEP() — noSep baru ada setelah response berhasil didekripsi).
// Kalau s.NoSep sebelumnya sudah terisi (baris lama/legacy) dan ternyata
// beda dari yang baru dikembalikan, baris lama itu dihapus supaya tidak
// ada data pasien yang sama dobel dengan dua No. SEP berbeda.
func doInsertSepToBpjs(db *sql.DB, cfg *vclaimConfig, s BridgingSep) (string, map[string]interface{}, error) {
	tSep := buildSepInsertPayload(s, sepUserCode(cfg, s.UserEntry))
	bodyJSON, err := json.Marshal(map[string]interface{}{"request": map[string]interface{}{"t_sep": tSep}})
	if err != nil {
		return "", nil, err
	}

	result, err := vclaimRequest(cfg, http.MethodPost, "SEP/2.0/insert", bodyJSON)
	if err != nil {
		return "", nil, err
	}

	sepObj, _ := result["sep"].(map[string]interface{})
	noSepBaru, _ := sepObj["noSep"].(string)
	noSepBaru = strings.TrimSpace(noSepBaru)
	if noSepBaru == "" {
		return "", result, errors.New("BPJS tidak mengembalikan No. SEP pada response")
	}

	noSepLama := s.NoSep
	s.NoSep = noSepBaru
	if err := upsertBridgingSepLocal(db, s); err != nil {
		return "", nil, err
	}
	if noSepLama != "" && noSepLama != noSepBaru {
		db.Exec(`DELETE FROM bridging_sep WHERE no_sep = ?`, noSepLama)
	}
	return noSepBaru, result, nil
}

// insertSepToBpjs menangani "Simpan" SEP baru langsung dari form Input SEP
// (tanpa No. SEP — field itu sudah dihapus dari UI karena memang bukan
// input, No. SEP resminya datang dari BPJS). Menggantikan alur lama
// (saveBridgingSepLocal draft lokal dulu, baru "Kirim ke BPJS" terpisah)
// yang keliru mengasumsikan No. SEP diketik manual di awal.
func insertSepToBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s BridgingSep
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(s.NoRawat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rawat wajib diisi"})
			return
		}
		if strings.TrimSpace(s.NoKartu) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu BPJS wajib diisi"})
			return
		}
		if errMsg := validateSepBeforeKirim(s); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		// 16.1.1 — poli mata/jantung/IRM/hemodialisa wajib validasi sidik jari
		// sebelum SEP diterbitkan, dikonfirmasi lewat query param dari UI.
		fingerprintVerified := c.Query("fingerprint_verified") == "1" || c.Query("fingerprint_verified") == "true"
		if sepRequiresFingerprint(s.Nmpolitujuan) && !fingerprintVerified {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum melakukan validasi sidik jari"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		noSepBaru, result, err := doInsertSepToBpjs(db, cfg, s)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dibuat di BPJS", "no_sep": noSepBaru, "response": result})
	}
}

// sendSepToBpjs mengirim SEP lokal yang SUDAH ADA (baris lama, mis. dari
// draft manual sebelum alur ini diperbaiki) sebagai Insert SEP ke BPJS —
// dipakai tombol "Kirim ke BPJS" di tabel. Nomor SEP lokal lama (kalau ada)
// hanya dipakai untuk lookup baris; yang dikirim ke BPJS tetap Insert murni
// (lihat doInsertSepToBpjs), dan baris lokal di-migrasi ke No. SEP asli
// yang dikembalikan BPJS setelah berhasil.
func sendSepToBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := c.Param("no_sep")
		if len(noSep) > 0 && noSep[0] == '/' {
			noSep = noSep[1:]
		}
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}

		var s BridgingSep
		row := db.QueryRow(`SELECT `+bridgingSepSelectCols+` FROM bridging_sep WHERE no_sep = ?`, noSep)
		err := scanBridgingSepRow(row, &s)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SEP lokal tidak ditemukan, simpan dulu sebelum dikirim"})
			return
		}

		if errMsg := validateSepBeforeKirim(s); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		// 16.1.1 — poli mata/jantung/IRM/hemodialisa wajib validasi sidik jari
		// (finger print) sebelum SEP diterbitkan. Tidak ada alat sidik jari
		// yang terintegrasi di sini, jadi konfirmasi validasi dilakukan lewat
		// query param fingerprint_verified=1 (dikonfirmasi dari sisi UI).
		fingerprintVerified := c.Query("fingerprint_verified") == "1" || c.Query("fingerprint_verified") == "true"
		if sepRequiresFingerprint(s.Nmpolitujuan) && !fingerprintVerified {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Belum melakukan validasi sidik jari"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		noSepBaru, result, err := doInsertSepToBpjs(db, cfg, s)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dikirim ke BPJS", "no_sep": noSepBaru, "response": result})
	}
}

// ============================================================================
// Bagian 6.2 — Get SEP Suplesi, bagian 8 — Update SEP, bagian 9 — Hapus SEP,
// bagian 10 — Hapus SEP Internal.
// ============================================================================

// getSepSuplesi menampilkan data potensi SEP sebagai Suplesi Jasa Raharja
// (6.2 Get SEP Suplesi / Pencarian Potensi Suplesi Jasa Raharja) berdasarkan
// No. KARTU PESERTA & tanggal pelayanan/SEP — BUKAN No. SEP seperti asumsi
// awal di sini (dikonfirmasi dari spec resmi: "Parameter 1: No.Kartu
// Peserta"). Respons berisi daftar `jaminan` (kandidat SEP suplesi terkait).
func getSepSuplesi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noKartu := c.Param("no_kartu")
		if len(noKartu) > 0 && noKartu[0] == '/' {
			noKartu = noKartu[1:]
		}
		if noKartu == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu Peserta wajib diisi"})
			return
		}
		tglPelayanan := strings.TrimSpace(c.Query("tgl_pelayanan"))
		if tglPelayanan == "" {
			tglPelayanan = time.Now().Format("2006-01-02")
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "sep/JasaRaharja/Suplesi/" + noKartu + "/tglPelayanan/" + tglPelayanan
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"suplesi": result})
	}
}

// getSepKllIndukList menangani Pencarian Data Induk Kecelakaan (GET
// sep/KllInduk/List/{noKartu}) — daftar SEP induk KLL (Kecelakaan Lalu
// Lintas) milik satu peserta (No. Kartu Peserta), dipakai supaya staf bisa
// memilih kasus KLL yang sudah ada (bukan ketik manual) saat membuat SEP
// suplesi/lanjutan — otomatis mengisi lokasi kejadian (propinsi/kabupaten/
// kecamatan), tanggal kejadian, dan keterangan.
func getSepKllIndukList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noKartu := c.Param("no_kartu")
		if len(noKartu) > 0 && noKartu[0] == '/' {
			noKartu = noKartu[1:]
		}
		if noKartu == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu Peserta wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "sep/KllInduk/List/"+noKartu, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kll_induk": result})
	}
}

// updateSepToBpjs memperbarui SEP yang sudah ada, baik ke BPJS VClaim
// (SEP/2.0/update) maupun secara lokal setelah update BPJS berhasil.
// Validasi field wajib mengikuti 8.1-8.5 (kelas rawat, no MR, diagnosa awal,
// no HP, user entry tidak boleh kosong) ditambah validasi umum SEP yang sama
// dipakai saat insert (validateSepBeforeKirim). Validasi status SEP di sisi
// BPJS (8.6-8.10 — SEP sudah FPK/verif layak/disetujui/sudah dirujuk, butuh
// status remote yang tidak disimpan lokal) tidak diterapkan di sini; pesan
// penolakan BPJS untuk skenario ini akan diteruskan apa adanya.
func updateSepToBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s BridgingSep
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(s.NoSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}
		// 8.1 - 8.5
		if strings.TrimSpace(s.Klsrawat) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kelas rawat tidak sesuai"})
			return
		}
		if strings.TrimSpace(s.Nomr) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor MR tidak sesuai"})
			return
		}
		if strings.TrimSpace(s.Diagawal) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Diagnosa tidak sesuai"})
			return
		}
		if strings.TrimSpace(s.Notelep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor HP tidak sesuai"})
			return
		}
		if errMsg := validateSepBeforeKirim(s); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tSep := buildSepUpdatePayload(s, sepUserCode(cfg, s.UserEntry))
		payload := map[string]interface{}{"request": map[string]interface{}{"t_sep": tSep}}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// BPJSDataSEP.java memanggil SEP/2.0/update dengan HttpMethod.PUT
		// (bukan POST seperti sebelumnya di sini).
		result, err := vclaimRequest(cfg, http.MethodPut, "SEP/2.0/update", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if err := upsertBridgingSepLocal(db, s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil diperbarui", "response": result})
	}
}

// deleteSepFromBpjs menghapus SEP di BPJS VClaim (SEP/2.0/delete) sekaligus
// data lokalnya. Validasi status SEP di sisi BPJS (9.2-9.4 — sudah dirujuk ke
// RS lain, sudah dibuatkan surat kontrol, punya SEP internal — butuh status
// remote yang tidak disimpan lokal) tidak diterapkan di sini; pesan
// penolakan BPJS untuk skenario ini akan diteruskan apa adanya.
func deleteSepFromBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := c.Param("no_sep")
		if len(noSep) > 0 && noSep[0] == '/' {
			noSep = noSep[1:]
		}
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// "user" diambil dari staf yang sedang login (dikirim frontend lewat
		// query param, sama seperti Insert/Update SEP), fallback ke config
		// bersama lalu "ermapp" — lihat sepUserCode.
		user := sepUserCode(cfg, c.Query("user"))

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_sep": map[string]interface{}{
					"noSep": noSep,
					"user":  user,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodDelete, "SEP/2.0/delete", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if _, err := db.Exec(`DELETE FROM bridging_sep WHERE no_sep = ?`, noSep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dihapus", "response": result})
	}
}

// deleteSepInternalFromBpjs menghapus SEP internal (rujukan internal antar
// poli dalam kunjungan yang sama) di BPJS VClaim (SEP/internal/delete)
// sekaligus data lokalnya di tabel bridging_sep_internal. Validasi 10.2 (SEP
// induk sudah dirujuk ke RS lain, butuh status remote) tidak diterapkan di
// sini; pesan penolakan BPJS akan diteruskan apa adanya.
func deleteSepInternalFromBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := c.Param("no_sep")
		if len(noSep) > 0 && noSep[0] == '/' {
			noSep = noSep[1:]
		}
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP internal wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		user := sepUserCode(cfg, c.Query("user"))

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_sep": map[string]interface{}{
					"noSep": noSep,
					"user":  user,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodDelete, "SEP/internal/delete", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if _, err := db.Exec(`DELETE FROM bridging_sep_internal WHERE no_sep = ?`, noSep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP internal berhasil dihapus", "response": result})
	}
}

// ============================================================================
// Bagian 12 — Update Tanggal Pulang (SEP/2.0/updtglplg).
// ============================================================================

// updateTglPulangSepRequest merepresentasikan body untuk update tanggal
// pulang. NoSuratKematian & NoLaporanPolisi tidak disimpan ke tabel
// bridging_sep (kolom itu tidak ada di skema Khanza aslinya) — keduanya
// hanya dipakai untuk validasi lokal (12.5/12.6) dan diteruskan ke payload
// BPJS, sedangkan yang disimpan lokal cukup tglpulang.
type updateTglPulangSepRequest struct {
	NoSep           string `json:"no_sep"`
	TglPulang       string `json:"tgl_pulang"`
	CaraPulang      string `json:"cara_pulang"`
	NoSuratKematian string `json:"no_surat_kematian"`
	NoLaporanPolisi string `json:"no_laporan_polisi"`
	User            string `json:"user_entry"`
}

// updateTglPulangSep menangani bagian 12 UPDATE TANGGAL PULANG. Validasi:
//   - 12.2: tgl pulang tidak boleh melebihi tanggal hari ini
//   - 12.3: tgl pulang tidak boleh lebih kecil dari tanggal SEP
//   - 12.5: cara pulang meninggal (kode "4" — kode referensi Cara Keluar
//     BPJS) wajib mengisi no. surat kematian minimal 5 karakter
//   - 12.6: SEP KLL (lakalantas terisi & <> "0") wajib mengisi no. laporan
//     polisi minimal 5 karakter
//
// Validasi 12.4 (status sudah dirujuk, butuh status remote yang tidak
// disimpan lokal) tidak diterapkan di sini; pesan penolakan BPJS untuk
// skenario ini akan diteruskan apa adanya.
func updateTglPulangSep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateTglPulangSepRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.NoSep) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}
		if strings.TrimSpace(req.TglPulang) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pulang wajib diisi"})
			return
		}

		var tglsep, lakalantas string
		err := db.QueryRow(`SELECT COALESCE(tglsep,'0000-00-00'), COALESCE(lakalantas,'') FROM bridging_sep WHERE no_sep = ?`, req.NoSep).
			Scan(&tglsep, &lakalantas)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SEP lokal tidak ditemukan"})
			return
		}

		tglPulang, errTP := time.Parse("2006-01-02", req.TglPulang)
		if errTP != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pulang tidak sesuai"})
			return
		}

		// 12.2 — tgl pulang tidak boleh melebihi tanggal hari ini
		today, _ := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
		if tglPulang.After(today) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pulang tidak sesuai"})
			return
		}

		// 12.3 — tgl pulang tidak boleh lebih kecil dari tanggal SEP
		if tglSep, errS := time.Parse("2006-01-02", tglsep); errS == nil && tglPulang.Before(tglSep) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pulang tidak sesuai"})
			return
		}

		// 12.5 — cara pulang meninggal (kode "4") wajib no. surat kematian >= 5 karakter
		if req.CaraPulang == "4" && len(strings.TrimSpace(req.NoSuratKematian)) < 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor surat meninggal minimal 5 karakter"})
			return
		}

		// 12.6 — SEP KLL wajib no. laporan polisi >= 5 karakter
		if lakalantas != "" && lakalantas != "0" && len(strings.TrimSpace(req.NoLaporanPolisi)) < 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor laporan polisi minimal 5 karakter"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_sep": map[string]interface{}{
					"noSep":       req.NoSep,
					"tglPulang":   req.TglPulang,
					"carapulang":  req.CaraPulang,
					"noSurat":     req.NoSuratKematian,
					"noLapPolisi": req.NoLaporanPolisi,
					"user":        req.User,
				},
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "SEP/2.0/updtglplg", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if _, err := db.Exec(`UPDATE bridging_sep SET tglpulang = ? WHERE no_sep = ?`, req.TglPulang, req.NoSep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Tanggal pulang berhasil diperbarui", "response": result})
	}
}
