package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// peruri_handler.go — konfigurasi kredensial & endpoint API gateway PERURI
// (tanda tangan elektronik/e-meterai), diatur dari Bridging > Peruri >
// Pengaturan (frontend/src/modules/Peruri.tsx). Pola tabel kode/nilai per
// baris — sama persis dengan satu_sehat_konfigurasi (lihat
// backend/satu_sehat_handler.go) — dipilih drpd struct Go bertingkat krn
// field-nya banyak (~40 URL API per kategori signing) dan sewaktu-waktu
// bisa nambah lagi tanpa migrasi kolom baru, cukup tambah baris.

func ensurePeruriKonfigurasiTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS peruri_konfigurasi (
			kode VARCHAR(80) NOT NULL PRIMARY KEY,
			nilai TEXT NOT NULL,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createTable)
	return err
}

// getPeruriConfigMap — versi internal getPeruriConfig TANPA masking, dipakai
// handler lain (mis. testPeruriJWT) yg genuinely butuh API_KEY asli utk
// manggil server Peruri, bukan cuma ditampilkan ke browser.
func getPeruriConfigMap(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query(`SELECT kode, nilai FROM peruri_konfigurasi`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]string{}
	for rows.Next() {
		var kode, nilai string
		if err := rows.Scan(&kode, &nilai); err != nil {
			continue
		}
		result[kode] = nilai
	}
	return result, nil
}

// GET /api/peruri/config — balikin semua kode/nilai sbg object JSON datar
// ({"API_KEY": "...", "SYSTEM_ID": "...", "JWT_GET_TOKEN": "...", ...}).
// API_KEY di-mask ("***") kalau sudah terisi — sama pola dgn client_secret
// Satu Sehat (getConfigSatuSehat) — biar tidak balik ke browser dlm bentuk
// plain text tiap kali form dibuka.
func getPeruriConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if v, ok := result["API_KEY"]; ok && v != "" {
			result["API_KEY"] = "***"
		}
		if v, ok := result["JWT_TOKEN"]; ok && v != "" {
			result["JWT_TOKEN"] = "***"
		}
		c.JSON(http.StatusOK, result)
	}
}

// POST /api/peruri/config — terima object JSON datar kode:nilai, upsert
// tiap key jadi satu baris. API_KEY dilewati kalau kosong/"***" (dianggap
// "tidak diubah oleh user", sama pola dgn client_secret Satu Sehat) —
// supaya tombol Simpan tidak menimpa API key yg sudah tersimpan jadi
// string mask "***" secara tidak sengaja.
func savePeruriConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body map[string]string
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		for kode, nilai := range body {
			if kode == "API_KEY" && (nilai == "" || nilai == "***") {
				continue
			}
			_, err := db.Exec(`
				INSERT INTO peruri_konfigurasi (kode, nilai) VALUES (?, ?)
				ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
				kode, nilai,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi: " + err.Error()})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi Peruri berhasil disimpan"})
	}
}

// peruriCallAPI — helper generik POST ke gateway Peruri: header
// x-Gateway-APIKey + Content-Type: application/json SELALU disertakan.
// bearerToken diisi JWT (dari getPeruriJWTCached) utk API Generate
// Certificate & Digital Signature (dikirim sbg "Authorization: Bearer
// <jwt>") — dikonfirmasi WAJIB dari dokumentasi Get JSON Web Token:
// "...digunakan sbg parameter Authorization Bearer Token di Service
// untuk proses Generate Certificate dan Digital Signature". Kosongkan
// bearerToken ("") HANYA utk API Generate JWT itu sendiri (belum ada
// token utk dikirim saat baru mau minta token). Contoh curl PERURI yg
// nulis "--header 'Authorization;'" (nilai kosong) TERNYATA cuma
// placeholder Postman yg lupa diisi, BUKAN instruksi kirim kosong —
// dikonfirmasi dari error nyata "Unauthorized application request" saat
// dikirim kosong.
// Balikin RAW response upstream (status code + body di-parse JSON kalau
// bisa) — BUKAN field ter-parse tertentu, krn skema response sukses
// PERURI per-endpoint belum semuanya dikonfirmasi; raw response tetap
// berguna utk diagnosa & jadi acuan pas nanti parsing field asli dibangun
// satu-satu.
func peruriCallAPI(url, apiKey, bearerToken string, body interface{}) (int, interface{}, error) {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return 0, nil, err
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("x-Gateway-APIKey", apiKey)
	req.Header.Set("Content-Type", "application/json")
	if bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+bearerToken)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, err
	}

	var parsed interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		parsed = string(raw)
	}
	return resp.StatusCode, parsed, nil
}

// peruriJWTTimeLayout — format expiredDate di response Generate JWT, mis.
// "2026-08-29 13:47:49" (dikonfirmasi dari hasil tes langsung, BUKAN dari
// dokumentasi tertulis — user paste raw response-nya).
const peruriJWTTimeLayout = "2006-01-02 15:04:05"

// peruriJWTResponse — skema response sukses "Generate JSON Web Token",
// dikonfirmasi dari hasil tes langsung:
//
//	{"data": {"jwt": "...", "expiredDate": "2026-08-29 13:47:49"},
//	 "resultCode": "0", "resultDesc": "Success"}
type peruriJWTResponse struct {
	Data struct {
		JWT         string `json:"jwt"`
		ExpiredDate string `json:"expiredDate"`
	} `json:"data"`
	ResultCode string `json:"resultCode"`
	ResultDesc string `json:"resultDesc"`
}

// getPeruriJWTCached — JWT Peruri berlaku 24 jam (dikonfirmasi user
// langsung, bukan cuma asumsi) — jadi TIDAK generate token baru tiap
// dipanggil. Token & waktu kadaluarsa disimpan di peruri_konfigurasi
// (kode JWT_TOKEN/JWT_EXPIRED_AT) dan dipakai ulang selama belum lewat
// expiredDate (dikurangi buffer 5 menit biar tidak kepepet expired di
// tengah request yg butuh token itu). Generate baru HANYA kalau belum
// pernah generate atau sudah/hampir expired. Dipakai testPeruriJWT (test
// koneksi Dashboard) DAN nanti endpoint lain yg butuh Authorization
// Bearer JWT (mis. Generate Certificate).
func getPeruriJWTCached(db *sql.DB, cfg map[string]string) (token, expiredAt string, freshlyGenerated bool, err error) {
	apiKey := cfg["API_KEY"]
	systemID := cfg["SYSTEM_ID"]
	url := cfg["JWT_GET_TOKEN"]
	if apiKey == "" || systemID == "" || url == "" {
		return "", "", false, fmt.Errorf("URL Generate JWT, x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan")
	}

	if cachedToken := cfg["JWT_TOKEN"]; cachedToken != "" {
		if parsedExpiry, errParse := time.ParseInLocation(peruriJWTTimeLayout, cfg["JWT_EXPIRED_AT"], time.Local); errParse == nil {
			if time.Now().Add(5 * time.Minute).Before(parsedExpiry) {
				return cachedToken, cfg["JWT_EXPIRED_AT"], false, nil
			}
		}
	}

	var reqBody struct {
		Param struct {
			SystemID string `json:"systemId"`
		} `json:"param"`
	}
	reqBody.Param.SystemID = systemID

	_, parsed, errCall := peruriCallAPI(url, apiKey, "", reqBody)
	if errCall != nil {
		return "", "", false, fmt.Errorf("gagal menghubungi server Peruri: %w", errCall)
	}
	raw, _ := json.Marshal(parsed)
	var resp peruriJWTResponse
	if errUnmarshal := json.Unmarshal(raw, &resp); errUnmarshal != nil || resp.Data.JWT == "" {
		return "", "", false, fmt.Errorf("respons Generate JWT tidak dikenali: %s", string(raw))
	}
	if resp.ResultCode != "0" {
		return "", "", false, fmt.Errorf("Generate JWT gagal: %s", resp.ResultDesc)
	}

	_, _ = db.Exec(`INSERT INTO peruri_konfigurasi (kode, nilai) VALUES ('JWT_TOKEN', ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, resp.Data.JWT)
	_, _ = db.Exec(`INSERT INTO peruri_konfigurasi (kode, nilai) VALUES ('JWT_EXPIRED_AT', ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`, resp.Data.ExpiredDate)

	return resp.Data.JWT, resp.Data.ExpiredDate, true, nil
}

// peruriBearerToken — pembungkus tipis getPeruriJWTCached, dipakai semua
// endpoint Generate Certificate/Digital Signature yg butuh Authorization
// Bearer JWT (bukan Generate JWT itu sendiri) — cuma butuh token-nya,
// bukan expiredAt/freshlyGenerated.
func peruriBearerToken(db *sql.DB, cfg map[string]string) (string, error) {
	token, _, _, err := getPeruriJWTCached(db, cfg)
	return token, err
}

// POST /api/peruri/test-jwt — tombol "Generate JWT" di Dashboard. Reuse
// token tersimpan kalau masih berlaku (lihat getPeruriJWTCached) — TIDAK
// generate baru tiap diklik, cuma laporkan token yg lagi dipakai +
// kadaluarsanya. Klik ulang setelah lewat 24 jam baru genuinely generate
// token baru.
func testPeruriJWT(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		token, expiredAt, fresh, err := getPeruriJWTCached(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"jwt":               token,
			"expired_at":        expiredAt,
			"freshly_generated": fresh,
		})
	}
}

// peruriSigner — posisi & atribut tanda tangan visual, persis field
// "signer" di curl sendDocument (Single Signing).
type peruriSigner struct {
	Email            string `json:"email,omitempty"`
	IsVisualSign     string `json:"isVisualSign"`
	LowerLeftX       string `json:"lowerLeftX"`
	LowerLeftY       string `json:"lowerLeftY"`
	UpperRightX      string `json:"upperRightX"`
	UpperRightY      string `json:"upperRightY"`
	Page             string `json:"page"`
	CertificateLevel string `json:"certificateLevel"`
	VarLocation      string `json:"varLocation"`
	VarReason        string `json:"varReason"`
}

// POST /api/peruri/send-document — panggil API "Send Document" PERURI
// (Single Signing, langkah 1 dari 5 di alur Digital Signature: Send
// Document -> Set Signature Position -> [server kirim OTP] -> Input OTP
// (signing) -> Download Document). Persis contoh curl:
//
//	POST {{url}}/digitalSignatureFullJwtSandbox/1.0/sendDocument/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"param": {"email", "payload": {"fileName","base64Document","signer":[...]}, "systemId", "orderType"}}
//
// email/fileName/base64Document/signer/orderType dikirim dari frontend
// (bagian dari alur upload dokumen, blm ada UI-nya — endpoint ini dulu
// yg disiapkan). URL & API Key & System ID diambil dari Pengaturan, sama
// pola dgn testPeruriJWT.
func sendPeruriDocument(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			Email          string         `json:"email" binding:"required"`
			FileName       string         `json:"fileName" binding:"required"`
			Base64Document string         `json:"base64Document" binding:"required"`
			Signer         []peruriSigner `json:"signer" binding:"required"`
			OrderType      string         `json:"orderType"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if reqIn.OrderType == "" {
			reqIn.OrderType = "INDIVIDUAL"
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SINGLE_SEND_DOCUMENT"]
		apiKey := cfg["API_KEY"]
		systemID := cfg["SYSTEM_ID"]
		if url == "" || apiKey == "" || systemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Send Document (Single Signing), x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				Email   string `json:"email"`
				Payload struct {
					FileName       string         `json:"fileName"`
					Base64Document string         `json:"base64Document"`
					Signer         []peruriSigner `json:"signer"`
				} `json:"payload"`
				SystemID  string `json:"systemId"`
				OrderType string `json:"orderType"`
			} `json:"param"`
		}
		reqBody.Param.Email = reqIn.Email
		reqBody.Param.Payload.FileName = reqIn.FileName
		reqBody.Param.Payload.Base64Document = reqIn.Base64Document
		reqBody.Param.Payload.Signer = reqIn.Signer
		reqBody.Param.SystemID = systemID
		reqBody.Param.OrderType = reqIn.OrderType

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/set-signature — panggil API "Set Signature" PERURI
// (Single Signing, langkah 2: Set Signature Position — dipanggil setelah
// sendDocument dapat orderId; sukses -> Peruri kirim OTP ke penandatangan).
// Persis contoh curl:
//
//	POST {{url}}/digitalSignatureFullJwtSandbox/1.0/setSignature/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"requestSetSignature": {"orderId", "signer": {...}}}
//
// Beda dari sendDocument: envelope body-nya "requestSetSignature" (bukan
// "param"), dan "signer" di sini SATU objek (bukan array) — reuse struct
// peruriSigner yg sama, field "email" (omitempty) sengaja tidak dikirim
// krn tidak ada di contoh curl ini.
func setPeruriSignature(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			OrderID string       `json:"orderId" binding:"required"`
			Signer  peruriSigner `json:"signer" binding:"required"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SINGLE_SET_SIGNATURE"]
		apiKey := cfg["API_KEY"]
		if url == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Set Signature (Single Signing) dan x-Gateway-APIKey wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			RequestSetSignature struct {
				OrderID string       `json:"orderId"`
				Signer  peruriSigner `json:"signer"`
			} `json:"requestSetSignature"`
		}
		reqBody.RequestSetSignature.OrderID = reqIn.OrderID
		reqBody.RequestSetSignature.Signer = reqIn.Signer

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/get-otp — langkah 3 (Get OTP) di alur Digital Signature.
// PERURI mengimplementasikan ini lewat API "Session Initiate" (bukan
// endpoint terpisah bernama getOtp) — panggilan ini yg bikin Peruri
// mengirim kode OTP ke penandatangan lewat email/SMS/WhatsApp sesuai flag.
// Persis contoh curl:
//
//	POST {{url}}/digitalSignatureSession/1.0/sessionInitiate/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"param": {"email","systemId","sendEmail","sendSms","sendWhatsapp"}}
//
// URL diambil dari kode SESSION_INITIATE (grup "Signing Session" di
// Pengaturan). sendEmail/sendSms/sendWhatsapp default "1" (sama spt
// contoh curl) kalau tidak dikirim frontend.
func getPeruriOtp(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			Email        string `json:"email" binding:"required"`
			SendEmail    string `json:"sendEmail"`
			SendSms      string `json:"sendSms"`
			SendWhatsapp string `json:"sendWhatsapp"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if reqIn.SendEmail == "" {
			reqIn.SendEmail = "1"
		}
		if reqIn.SendSms == "" {
			reqIn.SendSms = "1"
		}
		if reqIn.SendWhatsapp == "" {
			reqIn.SendWhatsapp = "1"
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SESSION_INITIATE"]
		apiKey := cfg["API_KEY"]
		systemID := cfg["SYSTEM_ID"]
		if url == "" || apiKey == "" || systemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Session Initiate (Signing Session), x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				Email        string `json:"email"`
				SystemID     string `json:"systemId"`
				SendEmail    string `json:"sendEmail"`
				SendSms      string `json:"sendSms"`
				SendWhatsapp string `json:"sendWhatsapp"`
			} `json:"param"`
		}
		reqBody.Param.Email = reqIn.Email
		reqBody.Param.SystemID = systemID
		reqBody.Param.SendEmail = reqIn.SendEmail
		reqBody.Param.SendSms = reqIn.SendSms
		reqBody.Param.SendWhatsapp = reqIn.SendWhatsapp

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/validate-otp — langkah "Input OTP" di alur Digital
// Signature: validasi kode OTP yg diketik user thd sesi yg dibuat waktu
// getPeruriOtp (Session Initiate). PERURI menyebutnya "Session
// Validation". Persis contoh curl:
//
//	POST {{url}}/digitalSignatureSession/1.0/sessionValidation/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"param": {"email","systemId","tokenSession","otpCode","duration"}}
//
// tokenSession — didapat dari response getPeruriOtp (Session Initiate),
// HARUS dikirim frontend (bukan disimpan di config, krn ini sesi
// per-transaksi, bukan kredensial statis). "duration" — angka dalam
// MENIT, masa berlaku sesi tervalidasi (user konfirmasi bisa diatur
// sampai 24 jam) — default "1440" (24 jam) kalau frontend tidak
// mengirim nilai sendiri.
func validatePeruriOtp(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			Email        string `json:"email" binding:"required"`
			TokenSession string `json:"tokenSession" binding:"required"`
			OtpCode      string `json:"otpCode" binding:"required"`
			Duration     string `json:"duration"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if reqIn.Duration == "" {
			reqIn.Duration = "1440"
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SESSION_VALIDATION"]
		apiKey := cfg["API_KEY"]
		systemID := cfg["SYSTEM_ID"]
		if url == "" || apiKey == "" || systemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Session Validation (Signing Session), x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				Email        string `json:"email"`
				SystemID     string `json:"systemId"`
				TokenSession string `json:"tokenSession"`
				OtpCode      string `json:"otpCode"`
				Duration     string `json:"duration"`
			} `json:"param"`
		}
		reqBody.Param.Email = reqIn.Email
		reqBody.Param.SystemID = systemID
		reqBody.Param.TokenSession = reqIn.TokenSession
		reqBody.Param.OtpCode = reqIn.OtpCode
		reqBody.Param.Duration = reqIn.Duration

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/signing — langkah terakhir sebelum Download Document di
// alur Digital Signature: eksekusi tanda tangan atas orderId yg OTP-nya
// sudah tervalidasi (validatePeruriOtp). PERURI menyebutnya "Signing
// Session". Persis contoh curl:
//
//	POST {{url}}/digitalSignatureSession/1.0/signingSession/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"param": {"orderId"}}
//
// Beda dari signing() di diagram alur awal (yg butuh OTP+Token langsung) —
// versi Session ini cukup orderId saja, krn validasi OTP-nya sudah
// dipisah ke langkah validatePeruriOtp sebelumnya (sesi tervalidasi
// dipakai ulang sampai "duration" abis, bukan re-submit OTP tiap signing).
func signPeruriDocument(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			OrderID string `json:"orderId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SESSION_SIGNING"]
		apiKey := cfg["API_KEY"]
		if url == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Signing Session dan x-Gateway-APIKey wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				OrderID string `json:"orderId"`
			} `json:"param"`
		}
		reqBody.Param.OrderID = reqIn.OrderID

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/download-document — langkah terakhir di alur Digital
// Signature: ambil dokumen hasil tanda tangan (base64) atas orderId yg
// sudah selesai di-signing. Persis contoh curl:
//
//	POST {{url}}/digitalSignatureFullJwtSandbox/1.0/downloadDocument/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: (kosong)
//	Body: {"param": {"orderId"}}
func downloadPeruriDocument(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			OrderID string `json:"orderId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SINGLE_DOWNLOAD_DOCUMENT"]
		apiKey := cfg["API_KEY"]
		if url == "" || apiKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Download Document (Single Signing) dan x-Gateway-APIKey wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBodyDl struct {
			Param struct {
				OrderID string `json:"orderId"`
			} `json:"param"`
		}
		reqBodyDl.Param.OrderID = reqIn.OrderID

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBodyDl)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/send-document-tmp — versi sendPeruriDocument yg terima
// file PDF langsung lewat multipart upload (bukan base64 sudah jadi di
// JSON body) — dipakai tombol "Tanda Tangan" di modal hasil pemeriksaan
// (mis. ModalHasilRadiologi.tsx). PDF yg diupload disimpan SEMENTARA di
// folder tmp_peruri/, dibaca & di-encode base64, dikirim ke sendDocument
// Peruri, lalu file tmp-nya DIHAPUS OTOMATIS (defer os.Remove) begitu
// handler ini selesai — TIDAK PERNAH tersimpan permanen di server, beda
// dari /api/upload yg memang untuk file permanen.
func sendPeruriDocumentFromFile(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File PDF wajib diupload"})
			return
		}
		email := c.PostForm("email")
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email penandatangan wajib diisi"})
			return
		}

		var signer peruriSigner
		signer.IsVisualSign = defVal(c.PostForm("isVisualSign"), "YES")
		signer.LowerLeftX = c.PostForm("lowerLeftX")
		signer.LowerLeftY = c.PostForm("lowerLeftY")
		signer.UpperRightX = c.PostForm("upperRightX")
		signer.UpperRightY = c.PostForm("upperRightY")
		signer.Page = defVal(c.PostForm("page"), "1")
		signer.CertificateLevel = defVal(c.PostForm("certificateLevel"), "NOT_CERTIFIED")
		signer.VarLocation = c.PostForm("varLocation")
		signer.VarReason = defVal(c.PostForm("varReason"), "Signed")
		orderType := defVal(c.PostForm("orderType"), "INDIVIDUAL")

		tmpDir := "./tmp_peruri"
		if err := os.MkdirAll(tmpDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan folder sementara"})
			return
		}
		tmpName := fmt.Sprintf("peruri_%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		tmpPath := filepath.Join(tmpDir, tmpName)
		if err := c.SaveUploadedFile(file, tmpPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file sementara"})
			return
		}
		defer os.Remove(tmpPath)

		raw, err := os.ReadFile(tmpPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file sementara"})
			return
		}
		base64Doc := base64.StdEncoding.EncodeToString(raw)

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["SINGLE_SEND_DOCUMENT"]
		apiKey := cfg["API_KEY"]
		systemID := cfg["SYSTEM_ID"]
		if url == "" || apiKey == "" || systemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Send Document (Single Signing), x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				Email   string `json:"email"`
				Payload struct {
					FileName       string         `json:"fileName"`
					Base64Document string         `json:"base64Document"`
					Signer         []peruriSigner `json:"signer"`
				} `json:"payload"`
				SystemID  string `json:"systemId"`
				OrderType string `json:"orderType"`
			} `json:"param"`
		}
		reqBody.Param.Email = email
		reqBody.Param.Payload.FileName = file.Filename
		reqBody.Param.Payload.Base64Document = base64Doc
		reqBody.Param.Payload.Signer = []peruriSigner{signer}
		reqBody.Param.SystemID = systemID
		reqBody.Param.OrderType = orderType

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}

// POST /api/peruri/check-certificate — tombol "Sertifikat" di daftar Data
// Pengguna (AkunPeruri.tsx), cek status sertifikat digital penandatangan
// berdasarkan email. Persis contoh curl:
//
//	POST {{url}}/digitalSignatureFullJwtSandbox/1.0/checkCertificate/v1
//	Header: x-Gateway-APIKey, Content-Type: application/json, Authorization: Bearer <jwt>
//	Body: {"param": {"email","systemId"}}
//
// URL diambil dari kode CERT_CHECK_BY_EMAIL (grup "Generate Certificate"
// di Pengaturan).
func checkPeruriCertificate(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reqIn struct {
			Email string `json:"email" binding:"required"`
		}
		if err := c.ShouldBindJSON(&reqIn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		cfg, err := getPeruriConfigMap(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		url := cfg["CERT_CHECK_BY_EMAIL"]
		apiKey := cfg["API_KEY"]
		systemID := cfg["SYSTEM_ID"]
		if url == "" || apiKey == "" || systemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "URL Check Certificate By Email (Generate Certificate), x-Gateway-APIKey, dan System ID wajib diisi dulu di Pengaturan"})
			return
		}

		var reqBody struct {
			Param struct {
				Email    string `json:"email"`
				SystemID string `json:"systemId"`
			} `json:"param"`
		}
		reqBody.Param.Email = reqIn.Email
		reqBody.Param.SystemID = systemID

		bearerToken, err := peruriBearerToken(db, cfg)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mendapatkan JWT: " + err.Error()})
			return
		}
		statusCode, parsed, err := peruriCallAPI(url, apiKey, bearerToken, reqBody)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal menghubungi server Peruri: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status_code": statusCode, "response": parsed})
	}
}
