package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
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
	COALESCE(suplesi,''), COALESCE(no_sep_suplesi,''), COALESCE(notelep,''), COALESCE(` + "`user`" + `,'')
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
	)
}

func getBridgingSepList(db *sql.DB) gin.HandlerFunc {
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

		query := `SELECT ` + bridgingSepSelectCols + ` FROM bridging_sep WHERE tglsep BETWEEN ? AND ?`
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
			s.SudahDikirim = true // ada di bridging_sep = sudah tercatat (lokal atau terkirim)
			items = append(items, s)
		}
		c.JSON(http.StatusOK, items)
	}
}

// upsertBridgingSepLocal menyimpan/mengubah satu baris bridging_sep secara
// lokal (upsert berdasarkan no_sep) — dipakai baik oleh saveBridgingSepLocal
// (simpan draft) maupun updateSepToBpjs (sinkron lokal setelah update BPJS
// berhasil). Field Suplesi memakai konvensi "0"/"1" (bukan teks enum
// "0. Tidak"/"1.Ya" apa adanya di kolom MySQL) supaya lebih sederhana dipakai
// dari sisi Go/JSON; di sini baru dipetakan ke teks enum aslinya.
func upsertBridgingSepLocal(db *sql.DB, s BridgingSep) error {
	suplesiVal := "0. Tidak"
	if s.Suplesi == "1" || strings.EqualFold(s.Suplesi, "1.ya") || strings.EqualFold(s.Suplesi, "1. ya") {
		suplesiVal = "1.Ya"
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
			tglkkl, keterangankkl, suplesi, no_sep_suplesi, notelep, `+"`user`"+`
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			no_sep_suplesi=VALUES(no_sep_suplesi), notelep=VALUES(notelep), `+"`user`"+`=VALUES(`+"`user`"+`)
	`,
		s.NoSep, s.NoRawat, nullIfEmptyDate(s.Tglsep), nullIfEmptyDate(s.Tglrujukan), s.NoRujukan,
		s.Kdppkrujukan, s.Nmppkrujukan, s.Kdppkpelayanan, s.Nmppkpelayanan,
		s.Jnspelayanan, s.Catatan, s.Diagawal, s.Nmdiagnosaawal,
		s.Kdpolitujuan, s.Nmpolitujuan, s.Klsrawat,
		s.Nomr, s.NamaPasien, nullIfEmptyDate(s.TanggalLahir), s.Peserta, s.Jkel, s.NoKartu,
		s.Kddpjp, s.Nmdpdjp, s.Noskdp, s.Klsnaik, s.Pembiayaan, s.Pjnaikkelas,
		nullIfEmptyStr(s.Lakalantas), s.Kdprop, s.Nmprop, s.Kdkab, s.Nmkab, s.Kdkec, s.Nmkec,
		s.Tglkkl, s.Keterangankkl, suplesiVal, s.NoSepSuplesi, s.Notelep, s.UserEntry,
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
//   - Kalau rawat inap (jnsPelayanan=2): No. SKDP/SPRI wajib diisi
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
	if s.Jnspelayanan == "2" && strings.TrimSpace(s.Noskdp) == "" {
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
	cfg := &vclaimConfig{URL: strings.TrimRight(m["URL"], "/"), ConsID: m["CONSID"], SecretKey: m["SECRETKEY"], UserKey: m["USERKEY"]}
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

// vclaimDecryptKey menurunkan key AES dari MD5(consID+secretKey+timestamp) —
// hasil MD5 dipakai sebagai STRING HEX 32 karakter (bukan raw bytes), sesuai
// skema yang didokumentasikan BPJS di seluruh SDK resminya.
func vclaimDecryptKey(consID, secretKey, timestamp string) []byte {
	sum := md5.Sum([]byte(consID + secretKey + timestamp))
	return []byte(hex.EncodeToString(sum[:]))
}

// vclaimDecrypt mendekripsi field "response" (base64 AES-256-CBC, IV nol,
// padding PKCS7) yang dikembalikan API VClaim.
func vclaimDecrypt(cipherB64, consID, secretKey, timestamp string) (string, error) {
	key := vclaimDecryptKey(consID, secretKey, timestamp)
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
	iv := make([]byte, aes.BlockSize) // IV nol, sesuai skema resmi BPJS
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
	return string(plain), nil
}

// vclaimRequest melakukan request ke endpoint VClaim dan mendekripsi field
// "response" pada body hasil. method: "GET" atau "POST". path relatif
// terhadap base URL (mis. "/SEP/2.0.0" untuk Insert SEP, tanpa slash awal).
func vclaimRequest(cfg *vclaimConfig, method, path string, bodyJSON []byte) (map[string]interface{}, error) {
	timestamp := strconv.FormatInt(time.Now().Unix()-1420070400, 10) // epoch offset ala VClaim (detik sejak 1 Jan 2015)
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
		return nil, fmt.Errorf("gagal dekripsi respon BPJS: %w", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("hasil dekripsi bukan JSON valid: %w", err)
	}
	return result, nil
}

// sendSepToBpjs mengirim data SEP lokal ke BPJS VClaim (Insert SEP).
// Bentuk payload nested mengikuti struktur field tabel bridging_sep, yang
// dirancang mengikuti request resmi VClaim — perlu diverifikasi ulang
// terhadap dokumen/Postman collection VClaim terbaru saat kredensial asli
// sudah tersedia, karena BPJS cukup sering merevisi detail nesting-nya.
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

		tSep := map[string]interface{}{
			"noKartu":      s.NoKartu,
			"tglSep":       s.Tglsep,
			"ppkPelayanan": s.Kdppkpelayanan,
			"jnsPelayanan": s.Jnspelayanan,
			"klsRawat": map[string]interface{}{
				"klsRawatHak":     s.Klsrawat,
				"klsRawatNaik":    s.Klsnaik,
				"pembiayaan":      s.Pembiayaan,
				"penanggungJawab": s.Pjnaikkelas,
			},
			"noMr": s.Nomr,
			"rujukan": map[string]interface{}{
				"asalRujukan": "1",
				"tglRujukan":  s.Tglrujukan,
				"noRujukan":   s.NoRujukan,
				"ppkRujukan":  s.Kdppkrujukan,
			},
			"catatan":  s.Catatan,
			"diagAwal": s.Diagawal,
			"poli": map[string]interface{}{
				"tujuan":    s.Kdpolitujuan,
				"eksekutif": "0",
			},
			"skdp": map[string]interface{}{
				"noSurat":  s.Noskdp,
				"kodeDpjp": s.Kddpjp,
			},
			"dpjpLayan": s.Kddpjp,
			"noTelp":    s.Notelep,
			"user":      "ermapp",
		}
		// 6.1.6/6.1.7 — SEP KLL (Jasa Raharja): sertakan jaminan lakalantas
		// kalau field lakalantas <> "0" diisi.
		if s.Lakalantas != "" && s.Lakalantas != "0" {
			tSep["jaminan"] = map[string]interface{}{
				"lakaLantas": map[string]interface{}{
					"lakaLantas":   s.Lakalantas,
					"kdPropinsi":   s.Kdprop,
					"kdKabupaten":  s.Kdkab,
					"kdKecamatan":  s.Kdkec,
					"tglKejadian":  s.Tglkkl,
					"keterangan":   s.Keterangankkl,
					"suplesi":      s.Suplesi,
					"noSepSuplesi": s.NoSepSuplesi,
				},
			}
		}
		payload := map[string]interface{}{
			"request": map[string]interface{}{
				"t_sep": tSep,
			},
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "SEP/2.0.0", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dikirim ke BPJS", "response": result})
	}
}

// ============================================================================
// Bagian 6.2 — Get SEP Suplesi, bagian 8 — Update SEP, bagian 9 — Hapus SEP,
// bagian 10 — Hapus SEP Internal.
// ============================================================================

// getSepSuplesi menampilkan data SEP suplesi (Jasa Raharja) berdasarkan No.
// SEP induk & tanggal pelayanan (6.2 Get SEP Suplesi).
func getSepSuplesi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := c.Param("no_sep")
		if len(noSep) > 0 && noSep[0] == '/' {
			noSep = noSep[1:]
		}
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
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

		path := "sep/JasaRaharja/Suplesi/" + noSep + "/tglPelayanan/" + tglPelayanan
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"suplesi": result})
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
		if strings.TrimSpace(s.UserEntry) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User entry tidak sesuai"})
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

		tSep := map[string]interface{}{
			"noSep":        s.NoSep,
			"noKartu":      s.NoKartu,
			"tglSep":       s.Tglsep,
			"ppkPelayanan": s.Kdppkpelayanan,
			"jnsPelayanan": s.Jnspelayanan,
			"klsRawat": map[string]interface{}{
				"klsRawatHak":     s.Klsrawat,
				"klsRawatNaik":    s.Klsnaik,
				"pembiayaan":      s.Pembiayaan,
				"penanggungJawab": s.Pjnaikkelas,
			},
			"noMr": s.Nomr,
			"rujukan": map[string]interface{}{
				"asalRujukan": "1",
				"tglRujukan":  s.Tglrujukan,
				"noRujukan":   s.NoRujukan,
				"ppkRujukan":  s.Kdppkrujukan,
			},
			"catatan":  s.Catatan,
			"diagAwal": s.Diagawal,
			"poli": map[string]interface{}{
				"tujuan":    s.Kdpolitujuan,
				"eksekutif": "0",
			},
			"skdp": map[string]interface{}{
				"noSurat":  s.Noskdp,
				"kodeDpjp": s.Kddpjp,
			},
			"dpjpLayan": s.Kddpjp,
			"noTelp":    s.Notelep,
			"user":      s.UserEntry,
		}
		payload := map[string]interface{}{"request": map[string]interface{}{"t_sep": tSep}}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodPost, "SEP/2.0/update", bodyJSON)
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
		user := strings.TrimSpace(c.Query("user"))
		if user == "" {
			user = "ermapp"
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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
		user := strings.TrimSpace(c.Query("user"))
		if user == "" {
			user = "ermapp"
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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
