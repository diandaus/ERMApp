package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING HFIS — Health Facilities Information System, aplikasi referensi
// fasilitas kesehatan BPJS (poli, dokter, jadwal dokter) yang dipakai untuk
// keperluan booking Antrian RS/Mobile JKN. HFIS memakai base URL & kredensial
// yang sama dengan "Mobile JKN (RS)" (kode 'bpjs_mobilejkn' di
// setting_bridging) — tidak ada slot kredensial terpisah di Pengaturan
// Bridging. Skema signature-nya sama persis dengan VClaim (X-cons-id/
// X-timestamp/X-signature/user_key, HMAC-SHA256 + AES-256-CBC memakai
// vclaimSignature/vclaimDecrypt yang sudah ada).
//
// Bentuk amplop respons HFIS BEDA dari VClaim: field "metadata" (huruf kecil
// semua, VClaim pakai "metaData") dan "code" berupa angka (1 = OK), bukan
// string "200" — makanya dipakai parser terpisah (hfisRequest), bukan
// vclaimRequest.
// ============================================================================

func getHfisConfig(db *sql.DB) (*vclaimConfig, error) {
	return getBpjsConfigByKode(db, "bpjs_mobilejkn", "Mobile JKN (RS)")
}

// hfisRequest melakukan request ke endpoint HFIS dan mendekripsi field
// "response" pada body hasil — reuse vclaimSignature/vclaimDecrypt karena
// skema kriptonya identik dengan VClaim, hanya bentuk amplop metadata-nya
// yang berbeda.
func hfisRequest(cfg *vclaimConfig, method, path string, bodyJSON []byte) (map[string]interface{}, error) {
	timestamp := strconv.FormatInt(time.Now().Unix()-1420070400, 10)
	signature := vclaimSignature(cfg.ConsID, cfg.SecretKey, timestamp)

	url := cfg.URL + "/" + strings.TrimLeft(path, "/")
	req, err := http.NewRequest(method, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("x-cons-id", cfg.ConsID)
	req.Header.Set("x-timestamp", timestamp)
	req.Header.Set("x-signature", signature)
	req.Header.Set("user_key", cfg.UserKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi server HFIS: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		MetaData struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"metadata"`
		Response interface{} `json:"response"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("respon HFIS tidak dikenali: %s", string(raw))
	}

	// Kode sukses HFIS tidak konsisten antar endpoint pada dokumen resminya —
	// referensi poli/dokter memakai 1, referensi jadwal dokter memakai 200 —
	// jadi keduanya diterima sebagai sukses di sini.
	if envelope.MetaData.Code != 1 && envelope.MetaData.Code != 200 {
		return nil, fmt.Errorf("HFIS menolak: %s (kode %d)", envelope.MetaData.Message, envelope.MetaData.Code)
	}

	respStr, ok := envelope.Response.(string)
	if !ok || respStr == "" {
		// Sebagian endpoint HFIS mengembalikan response sudah dalam bentuk
		// objek JSON polos (tidak terenkripsi) — kalau begitu, pakai apa adanya.
		if envelope.Response != nil {
			if m, ok := envelope.Response.(map[string]interface{}); ok {
				return m, nil
			}
		}
		return map[string]interface{}{}, nil
	}
	decrypted, err := vclaimDecrypt(respStr, cfg.ConsID, cfg.SecretKey, timestamp)
	if err != nil {
		return nil, fmt.Errorf("gagal dekripsi respon HFIS: %w", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("hasil dekripsi bukan JSON valid: %w", err)
	}
	return result, nil
}

// getReferensiPoliHfis menangani "Referensi Poli HFIS" (GET ref/poli) —
// menampilkan daftar poli/subspesialis yang terdaftar di Aplikasi HFIS.
func getReferensiPoliHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodGet, "ref/poli", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"poli": result})
	}
}

// getReferensiDokterHfis menangani "Referensi Dokter HFIS" (GET ref/dokter) —
// menampilkan daftar dokter yang terdaftar di Aplikasi HFIS.
func getReferensiDokterHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodGet, "ref/dokter", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"dokter": result})
	}
}

// getJadwalDokterHfis menangani "Referensi Jadwal Dokter HFIS"
// (GET jadwaldokter/kodepoli/{kodePoli}/tanggal/{tanggal}) — menampilkan
// jadwal praktik dokter per poli & tanggal yang terdaftar di Aplikasi HFIS.
func getJadwalDokterHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodePoli := strings.TrimSpace(c.Param("kode_poli"))
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		if kodePoli == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
			return
		}
		if tanggal == "" {
			tanggal = time.Now().Format("2006-01-02")
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "jadwaldokter/kodepoli/" + kodePoli + "/tanggal/" + tanggal
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"jadwal_dokter": result})
	}
}

// HfisJadwalItem merepresentasikan satu baris jam praktik pada payload
// update jadwal dokter HFIS.
type HfisJadwalItem struct {
	Hari  string `json:"hari"`
	Buka  string `json:"buka"`
	Tutup string `json:"tutup"`
}

// UpdateJadwalDokterHfisRequest persis mengikuti bentuk request resmi HFIS
// (tanpa pembungkus "request" seperti VClaim) — dikirim apa adanya sebagai
// body POST jadwaldokter/updatejadwaldokter.
type UpdateJadwalDokterHfisRequest struct {
	KodePoli         string           `json:"kodepoli"`
	KodeSubspesialis string           `json:"kodesubspesialis"`
	KodeDokter       int              `json:"kodedokter"`
	Jadwal           []HfisJadwalItem `json:"jadwal"`
}

// updateJadwalDokterHfis menangani "Update Jadwal Dokter"
// (POST jadwaldokter/updatejadwaldokter). Perubahan yang berhasil dikirim
// masih menunggu aproval BPJS (manual oleh kantor cabang jam 20.01-00.00,
// atau otomatis oleh sistem H+1 kalau belum diaproval sampai jam 00.00) —
// jadi respons sukses di sini berarti "terkirim", bukan "langsung aktif".
func updateJadwalDokterHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req UpdateJadwalDokterHfisRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodePoli) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
			return
		}
		if strings.TrimSpace(req.KodeSubspesialis) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode subspesialis wajib diisi"})
			return
		}
		if req.KodeDokter <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode dokter wajib diisi"})
			return
		}
		if len(req.Jadwal) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal wajib diisi minimal 1 hari"})
			return
		}
		for _, j := range req.Jadwal {
			hari, errH := strconv.Atoi(j.Hari)
			if errH != nil || hari < 1 || hari > 8 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Hari tidak sesuai"})
				return
			}
			if strings.TrimSpace(j.Buka) == "" || strings.TrimSpace(j.Tutup) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Jam buka/tutup wajib diisi"})
				return
			}
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bodyJSON, err := json.Marshal(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodPost, "jadwaldokter/updatejadwaldokter", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Perubahan jadwal dokter berhasil dikirim, menunggu aproval BPJS", "response": result})
	}
}

// getReferensiPoliFpHfis menangani "Referensi Poli Finger Print"
// (GET ref/poli/fp) — menampilkan daftar poli yang mewajibkan validasi
// sidik jari (finger print) sebelum SEP diterbitkan, sesuai Aplikasi HFIS.
func getReferensiPoliFpHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodGet, "ref/poli/fp", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"poli_fp": result})
	}
}

// getReferensiPasienFpHfis menangani "Referensi Pasien Finger Print"
// (GET ref/pasien/fp/identitas/{nik/noka}/noidentitas/{noidentitas}) —
// menampilkan status pendaftaran sidik jari (finger print) satu pasien
// berdasarkan NIK atau nomor kartu BPJS.
func getReferensiPasienFpHfis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jenis := c.Query("jenis")
		noIdentitas := strings.TrimSpace(c.Query("no_identitas"))
		if jenis != "nik" && jenis != "noka" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis identitas tidak sesuai"})
			return
		}
		if noIdentitas == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor identitas wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "ref/pasien/fp/identitas/" + jenis + "/noidentitas/" + noIdentitas
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"pasien_fp": result})
	}
}
