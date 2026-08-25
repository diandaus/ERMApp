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

type eklaimConfig struct {
	URL string
	Key string // hex, 64 karakter = 256-bit
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
	cfg := &eklaimConfig{URL: strings.TrimRight(m["URL"], "/"), Key: m["KEY"]}
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
// {"metadata":{"method":...},"data":{...}}, encrypt seluruh JSON-nya jadi
// body POST mentah (bukan multipart/form field), lalu buang wrapper
// "----BEGIN/END ENCRYPTED DATA----" dari respons sebelum decrypt —
// PERSIS contoh curl PHP resmi di manual.
func eklaimRequest(cfg *eklaimConfig, method string, data map[string]interface{}) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"metadata": map[string]interface{}{"method": method},
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

	client := &http.Client{Timeout: 30 * time.Second}
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
	decrypted, err := eklaimDecrypt(strings.TrimSpace(text), cfg.Key)
	if err != nil {
		return nil, fmt.Errorf("gagal dekripsi respons E-Klaim: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("respons E-Klaim bukan JSON valid: %s", decrypted)
	}
	return result, nil
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

		result, err := eklaimRequest(cfg, "new_claim", map[string]interface{}{
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
		c.JSON(http.StatusOK, result)
	}
}
