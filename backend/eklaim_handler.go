package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// eklaim_handler.go — fondasi integrasi Web Service E-Klaim (grouper resmi
// iDRG/INACBG Kemenkes, sistem TERPISAH dari Khanza — lihat kode caller
// Java wsinacbg.php yg sudah dikonfirmasi user, dan manual resmi
// "Web Service E-Klaim Untuk Build 5.10.x" yg dikirim user). BARU
// menyediakan modul enkripsi + 1 method pertama ("Membuat klaim baru")
// sbg fondasi teruji — 33 method lainnya (Set/Get Diagnosa Prosedur iDRG,
// Grouping iDRG/INACBG, Finalisasi, Kirim Klaim, dst) DAN state machine
// alur wajib (25 kriteria: iDRG dulu baru INACBG) menyusul.
//
// Kredensial (URL + Encryption Key) dibaca dari setting_bridging (kode
// 'eklaim') — pola SAMA persis dgn getBpjsConfigByKode (VClaim dkk),
// dikelola lewat Admin.tsx > Pengaturan Bridging (perlu ditambah entry
// BRIDGING_DEFS di frontend, belum termasuk di sini).

// base64LikeRe — validasi cepat "teksnya kemungkinan base64" (alfabet
// base64 + whitespace) sebelum dicoba dekripsi — lihat pemakaian di
// eklaimRequestTimeout.
var base64LikeRe = regexp.MustCompile(`^[A-Za-z0-9+/=\s]*$`)

type eklaimConfig struct {
	URL       string
	Key       string // hex, 64 karakter = 256-bit
	PayorID   string // Payplan ID dari E-Klaim > Setup > Jaminan, tetap per-RS
	PayorCd   string // Code Payplan tsb, mis. "JKN"
	KodeTarif string // mis. "DS" — tetap per-RS, jarang beda antar klaim
}

func getEklaimConfig(db *sql.DB) (*eklaimConfig, error) {
	var configJSON string
	if err := db.QueryRow(`SELECT COALESCE(config,'{}') FROM setting_bridging WHERE kode = 'eklaim'`).Scan(&configJSON); err != nil {
		return nil, fmt.Errorf("konfigurasi bridging E-Klaim tidak ditemukan")
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(configJSON), &m); err != nil {
		return nil, fmt.Errorf("konfigurasi E-Klaim tidak valid")
	}
	cfg := &eklaimConfig{URL: strings.TrimRight(m["URL"], "/"), Key: m["KEY"], PayorID: m["PAYOR_ID"], PayorCd: m["PAYOR_CD"], KodeTarif: m["KODE_TARIF"]}
	if cfg.URL == "" || cfg.Key == "" {
		return nil, fmt.Errorf("URL dan Encryption Key E-Klaim belum diisi di Pengaturan Bridging")
	}
	return cfg, nil
}

// eklaimEncrypt — AES-256-CBC + signature HMAC-SHA256 (10 byte pertama) +
// base64 (chunk_split tiap 76 karakter) — PERSIS fungsi inacbg_encrypt()
// di manual resmi (bagian III. ENKRIPSI/DEKRIPSI).
func eklaimEncrypt(data []byte, keyHex string) (string, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil || len(key) != 32 {
		return "", fmt.Errorf("encryption key harus 256-bit (64 karakter hex)")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	iv := make([]byte, aes.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}
	padded := pkcs7Pad(data, aes.BlockSize)
	encrypted := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(encrypted, padded)

	mac := hmac.New(sha256.New, key)
	mac.Write(encrypted)
	signature := mac.Sum(nil)[:10]

	combined := append(append(append([]byte{}, signature...), iv...), encrypted...)
	encoded := base64.StdEncoding.EncodeToString(combined)
	return chunkSplit(encoded, 76, "\r\n"), nil
}

// eklaimDecrypt — kebalikan eklaimEncrypt, verifikasi signature dulu
// (against padding oracle attack, persis catatan di manual).
func eklaimDecrypt(str string, keyHex string) (string, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil || len(key) != 32 {
		return "", fmt.Errorf("encryption key harus 256-bit (64 karakter hex)")
	}
	decoded, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return "", fmt.Errorf("base64 tidak valid: %w", err)
	}
	if len(decoded) < 10+aes.BlockSize {
		return "", fmt.Errorf("data terenkripsi terlalu pendek")
	}
	signature := decoded[:10]
	ivBytes := decoded[10 : 10+aes.BlockSize]
	encrypted := decoded[10+aes.BlockSize:]
	if len(encrypted) == 0 || len(encrypted)%aes.BlockSize != 0 {
		return "", fmt.Errorf("panjang data terenkripsi tidak valid")
	}

	mac := hmac.New(sha256.New, key)
	mac.Write(encrypted)
	calcSignature := mac.Sum(nil)[:10]
	if !hmac.Equal(signature, calcSignature) {
		return "", fmt.Errorf("signature tidak cocok (key salah atau data korup)")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	decrypted := make([]byte, len(encrypted))
	cipher.NewCBCDecrypter(block, ivBytes).CryptBlocks(decrypted, encrypted)
	unpadded, err := pkcs7Unpad(decrypted)
	if err != nil {
		return "", err
	}
	return string(unpadded), nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padLen := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padLen)}, padLen)...)
}

func pkcs7Unpad(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data kosong")
	}
	padLen := int(data[len(data)-1])
	if padLen == 0 || padLen > len(data) {
		return nil, fmt.Errorf("padding tidak valid")
	}
	return data[:len(data)-padLen], nil
}

func chunkSplit(s string, chunkLen int, sep string) string {
	var b strings.Builder
	for i := 0; i < len(s); i += chunkLen {
		end := i + chunkLen
		if end > len(s) {
			end = len(s)
		}
		b.WriteString(s[i:end])
		b.WriteString(sep)
	}
	return b.String()
}

// eklaimRequest — kirim satu method ke web service E-Klaim: bangun
// {"metadata":{"method":...,...extraMetadata},"data":{...}}, encrypt
// seluruh JSON-nya jadi body POST mentah (bukan multipart/form field),
// lalu buang wrapper "----BEGIN/END ENCRYPTED DATA----" dari respons
// sebelum decrypt — PERSIS contoh curl PHP resmi di manual. extraMetadata
// dipakai method spt "grouper" yg butuh "stage"/"grouper" di metadata
// (bukan di data) — boleh nil kalau tidak perlu.
func eklaimRequest(cfg *eklaimConfig, method string, extraMetadata map[string]interface{}, data map[string]interface{}) (map[string]interface{}, error) {
	return eklaimRequestTimeout(cfg, method, extraMetadata, data, 30*time.Second)
}

// eklaimRequestTimeout — sama persis eklaimRequest, cuma timeout-nya bisa
// diatur per pemanggil. Dipakai list_klaim_handler.go (cek status BANYAK
// SEP sekaligus, live ke E-Klaim) supaya satu SEP yg lambat/gagal tidak
// bikin seluruh List Klaim nunggu sampai 30 detik.
func eklaimRequestTimeout(cfg *eklaimConfig, method string, extraMetadata map[string]interface{}, data map[string]interface{}, timeout time.Duration) (map[string]interface{}, error) {
	metadata := map[string]interface{}{"method": method}
	for k, v := range extraMetadata {
		metadata[k] = v
	}
	payload := map[string]interface{}{
		"metadata": metadata,
		"data":     data,
	}
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	encryptedBody, err := eklaimEncrypt(jsonBytes, cfg.Key)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest(http.MethodPost, cfg.URL, strings.NewReader(encryptedBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi server E-Klaim: %w", err)
	}
	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	text := strings.TrimSpace(string(rawBody))
	if strings.HasPrefix(text, "----BEGIN ENCRYPTED DATA----") {
		lines := strings.Split(text, "\n")
		if len(lines) >= 3 {
			text = strings.Join(lines[1:len(lines)-1], "")
		}
	}
	text = strings.TrimSpace(text)
	// Kadang server E-Klaim sendiri lagi bermasalah (mis. database internalnya
	// penuh koneksi) dan balas pesan error POLOS, bukan payload terenkripsi
	// (dikonfirmasi nyata: "Connect Error (1040) Too many connections") —
	// deteksi dini pakai validasi karakter base64 spy pesannya jelas ("server
	// E-Klaim bermasalah") drpd nyasar jadi "base64 tidak valid" yg
	// membingungkan (seolah bug di kita, padahal bukan).
	if !base64LikeRe.MatchString(text) {
		return nil, fmt.Errorf("server E-Klaim membalas error (bukan respons terenkripsi, kemungkinan server E-Klaim sedang bermasalah/sibuk): %s", text)
	}
	decrypted, err := eklaimDecrypt(text, cfg.Key)
	if err != nil {
		return nil, fmt.Errorf("gagal dekripsi respons E-Klaim: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("respons E-Klaim bukan JSON valid: %s", decrypted)
	}
	return result, nil
}

// eklaimResultOk — cek metadata.message=="Ok" / code==200, persis kondisi
// sukses yg dipakai UpdateDataKlaim()/BuatKlaimBaru() dkk di wsinacbg.php
// (Khanza) sblm nulis checkpoint lokal (inacbg_klaim_baru dkk).
func eklaimResultOk(result map[string]interface{}) bool {
	meta, _ := result["metadata"].(map[string]interface{})
	if meta == nil {
		return false
	}
	if msg, _ := meta["message"].(string); msg == "Ok" {
		return true
	}
	if code, ok := meta["code"].(float64); ok && code == 200 {
		return true
	}
	return false
}

// asString — field respons E-Klaim kadang string kadang angka (JSON number)
// tergantung server; kolom checkpoint lokal semuanya varchar.
func asString(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	default:
		return ""
	}
}

// writeInacbgKlaimBaru/writeInacbgDataTerkirim/writeInacbgGroupingStage12 —
// checkpoint lokal PERSIS tabel & kondisi yg dipakai Khanza Java/PHP
// (wsinacbg.php: BuatKlaimBaru/UpdateDataKlaim2/GroupingStage12) supaya
// status klaim di List Klaim (list_klaim_handler.go) akurat baik utk klaim
// yg diproses lewat Khanza lama maupun lewat GroupingInacbg.tsx (web baru)
// — dua-duanya nulis ke tabel yg sama, satu sumber kebenaran.
func writeInacbgKlaimBaru(db *sql.DB, noSep string, resp map[string]interface{}) {
	if noSep == "" {
		return
	}
	db.Exec(`
		INSERT INTO inacbg_klaim_baru (no_sep, patient_id, admission_id, hospital_admission_id)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE patient_id=VALUES(patient_id), admission_id=VALUES(admission_id), hospital_admission_id=VALUES(hospital_admission_id)
	`, noSep, asString(resp["patient_id"]), asString(resp["admission_id"]), asString(resp["hospital_admission_id"]))
}

func writeInacbgDataTerkirim(db *sql.DB, noSep, coderNik string) {
	if noSep == "" {
		return
	}
	db.Exec(`
		INSERT INTO inacbg_data_terkirim (no_sep, nik) VALUES (?, ?)
		ON DUPLICATE KEY UPDATE nik=VALUES(nik)
	`, noSep, coderNik)
}

func writeInacbgGroupingStage12(db *sql.DB, noSep string, respInacbg map[string]interface{}) {
	if noSep == "" || respInacbg == nil {
		return
	}
	cbg, _ := respInacbg["cbg"].(map[string]interface{})
	if cbg == nil {
		return
	}
	tarif, _ := respInacbg["tariff"].(float64)
	db.Exec(`
		INSERT INTO inacbg_grouping_stage12 (no_sep, code_cbg, deskripsi, tarif) VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE code_cbg=VALUES(code_cbg), deskripsi=VALUES(deskripsi), tarif=VALUES(tarif)
	`, noSep, asString(cbg["code"]), asString(cbg["description"]), tarif)
}

// POST /api/bridging/eklaim/new-claim
// Body: {"no_rawat": "..."}
// Padanan method #1 "Membuat klaim baru (dan registrasi pasien jika belum
// ada)" — datanya diambil dari bridging_sep (SEP harus sudah diterbitkan
// dulu). Endpoint pertama sbg uji coba modul enkripsi di atas.
func postEklaimNewClaim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoRawat string `json:"no_rawat" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		cfg, err := getEklaimConfig(db)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		var noKartu, noSep, nomr, namaPasien, tglLahir, jkel string
		err = db.QueryRow(`
			SELECT COALESCE(no_kartu,''), no_sep, COALESCE(nomr,''), COALESCE(nama_pasien,''),
				COALESCE(tanggal_lahir,'0000-00-00'), COALESCE(jkel,'')
			FROM bridging_sep WHERE no_rawat = ? LIMIT 1
		`, req.NoRawat).Scan(&noKartu, &noSep, &nomr, &namaPasien, &tglLahir, &jkel)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "SEP belum diterbitkan untuk kunjungan ini — buat SEP dulu lewat Bridging > SEP"})
			return
		}

		gender := 2 // 1=Laki-laki, 2=Perempuan, persis contoh manual
		if jkel == "L" {
			gender = 1
		}
		tglLahirFormatted := tglLahir + " 00:00:00"
		if t, errParse := time.Parse("2006-01-02", tglLahir); errParse == nil {
			tglLahirFormatted = t.Format("2006-01-02") + " 00:00:00"
		}

		result, err := eklaimRequest(cfg, "new_claim", nil, map[string]interface{}{
			"nomor_kartu": noKartu,
			"nomor_sep":   noSep,
			"nomor_rm":    nomr,
			"nama_pasien": namaPasien,
			"tgl_lahir":   tglLahirFormatted,
			"gender":      gender,
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		if eklaimResultOk(result) {
			resp, _ := result["response"].(map[string]interface{})
			writeInacbgKlaimBaru(db, noSep, resp)
		}
		c.JSON(http.StatusOK, result)
	}
}

// resolveNoSep — ambil no_sep dari bridging_sep berdasarkan no_rawat,
// dipakai semua endpoint eklaim_handler.go yg butuh nomor_sep tapi cuma
// dikasih no_rawat dari frontend (lebih natural drpd staf harus tahu no
// SEP-nya persis).
func resolveNoSep(db *sql.DB, noRawat string) (string, error) {
	var noSep string
	if err := db.QueryRow(`SELECT no_sep FROM bridging_sep WHERE no_rawat = ? LIMIT 1`, noRawat).Scan(&noSep); err != nil {
		return "", fmt.Errorf("SEP belum diterbitkan untuk kunjungan ini — buat SEP dulu lewat Bridging > SEP")
	}
	return noSep, nil
}

// eklaimProxy — handler generik utk method2 E-Klaim yg cuma butuh
// {no_rawat, ...field data lain} diteruskan APA ADANYA ke web service
// sbg objek "data" (nomor_sep di-resolve otomatis dari bridging_sep kalau
// body tidak sudah menyertakan nomor_sep sendiri). Dipakai method #4-8 &
// #11-13 (set_claim_data, idrg_diagnosa_set/get, idrg_procedure_set/get,
// idrg_grouper_final/reedit, idrg_to_inacbg_import) — SENGAJA tidak bikin
// struct Go terpisah per method krn spec resminya method #4 saja punya
// 30+ field opsional (ventilator/apgar/persalinan/dll) yg gampang basi
// kalau diduplikasi manual di sini; caller (nanti frontend) yg tahu
// persis field apa yg mau dikirim, sesuai dokumentasi resmi di docs/eklaim/.
func eklaimProxy(db *sql.DB, method string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if body == nil {
			body = map[string]interface{}{}
		}

		cfg, err := getEklaimConfig(db)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		noRawat, _ := body["no_rawat"].(string)
		delete(body, "no_rawat")
		if _, hasSep := body["nomor_sep"]; !hasSep && noRawat != "" {
			noSep, err := resolveNoSep(db, noRawat)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			body["nomor_sep"] = noSep
		}

		// Payor ID/Code & Kode Tarif tetap per-RS (Payor dari Setup > Jaminan
		// di aplikasi E-Klaim, Kode Tarif dari kelas RS), jadi bukan diisi
		// ulang tiap klaim di form — ambil dari Pengaturan Bridging kalau
		// frontend tidak mengirimkannya sendiri.
		if method == "set_claim_data" {
			if _, has := body["payor_id"]; !has && cfg.PayorID != "" {
				body["payor_id"] = cfg.PayorID
			}
			if _, has := body["payor_cd"]; !has && cfg.PayorCd != "" {
				body["payor_cd"] = cfg.PayorCd
			}
			if _, has := body["kode_tarif"]; !has && cfg.KodeTarif != "" {
				body["kode_tarif"] = cfg.KodeTarif
			}
		}

		result, err := eklaimRequest(cfg, method, nil, body)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		if method == "set_claim_data" && eklaimResultOk(result) {
			noSep, _ := body["nomor_sep"].(string)
			coderNik, _ := body["coder_nik"].(string)
			writeInacbgDataTerkirim(db, noSep, coderNik)
		}
		c.JSON(http.StatusOK, result)
	}
}

// POST /api/bridging/eklaim/idrg/grouping atau .../inacbg/grouping
// Body: {"no_rawat": "...", "stage": 1|2, "topup_codes"/"special_cmg": "code1#code2"}
// Padanan method #9-10 (Grouping iDRG) DAN #16-17 (Grouping INACBG) — dua
// pasangan method yg strukturnya SAMA PERSIS (cuma beda "grouper":
// "idrg"/"inacbg" & nama field stage-2: topup_codes vs special_cmg),
// makanya digabung 1 handler param grouperType. Dipisah dari eklaimProxy
// krn "stage"/"grouper" masuk METADATA (bukan data spt method lain), dan
// format tipe stage-nya beda antara contoh stage 1 (int) vs stage 2
// (string) di manual — ditranskripsi literal apa adanya.
func postEklaimGrouping(db *sql.DB, grouperType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoRawat    string `json:"no_rawat" binding:"required"`
			Stage      int    `json:"stage" binding:"required"`
			TopupCodes string `json:"topup_codes"`
			SpecialCmg string `json:"special_cmg"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Stage != 1 && req.Stage != 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "stage harus 1 atau 2"})
			return
		}

		cfg, err := getEklaimConfig(db)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		noSep, err := resolveNoSep(db, req.NoRawat)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		data := map[string]interface{}{"nomor_sep": noSep}
		var stageMeta interface{} = req.Stage // stage 1: dikirim sbg int, persis contoh manual
		if req.Stage == 2 {
			stageMeta = "2" // stage 2: dikirim sbg string, persis contoh manual
			if grouperType == "idrg" {
				data["topup_codes"] = req.TopupCodes
			} else {
				data["special_cmg"] = req.SpecialCmg
			}
		}

		result, err := eklaimRequest(cfg, "grouper", map[string]interface{}{
			"stage":   stageMeta,
			"grouper": grouperType,
		}, data)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		if grouperType == "inacbg" && req.Stage == 1 && eklaimResultOk(result) {
			respInacbg, _ := result["response_inacbg"].(map[string]interface{})
			writeInacbgGroupingStage12(db, noSep, respInacbg)
		}
		c.JSON(http.StatusOK, result)
	}
}
