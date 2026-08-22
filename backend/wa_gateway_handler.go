package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// wa_gateway_handler.go — jembatan ke servis Node.js terpisah (wa-gateway/,
// pakai Baileys/WhatsApp Web tidak resmi, GRATIS — bukan WhatsApp Business
// API resmi yang berbayar per pesan) buat kirim notifikasi WhatsApp, mis.
// hasil pemeriksaan radiologi ke pasien. Kredensial (URL servis + API key)
// disimpan lewat mekanisme Pengaturan Bridging yang sudah ada
// (setting_bridging, kode 'wa_gateway') — reuse getBridgingConfigs/
// saveBridgingConfig & UI Admin.tsx, TIDAK bikin tabel/endpoint config baru.

// getWaGatewayConfig membaca URL & API key servis wa-gateway dari
// setting_bridging (kode 'wa_gateway').
func getWaGatewayConfig(db *sql.DB) (url, apiKey string, err error) {
	var configJSON string
	err = db.QueryRow(`SELECT COALESCE(config,'{}') FROM setting_bridging WHERE kode = 'wa_gateway'`).Scan(&configJSON)
	if err != nil {
		return "", "", errors.New("konfigurasi WhatsApp Gateway belum diatur (Admin > Pengaturan Bridging)")
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(configJSON), &m); err != nil {
		return "", "", errors.New("konfigurasi WhatsApp Gateway tidak valid")
	}
	url = strings.TrimRight(m["URL"], "/")
	apiKey = m["APIKEY"]
	if url == "" {
		return "", "", errors.New("URL WhatsApp Gateway belum diisi di Pengaturan Bridging")
	}
	return url, apiKey, nil
}

// waGatewayRequest — helper generik proxy ke servis wa-gateway.
func waGatewayRequest(db *sql.DB, method, path string, body []byte) (int, []byte, error) {
	url, apiKey, err := getWaGatewayConfig(db)
	if err != nil {
		return 0, nil, err
	}
	req, err := http.NewRequest(method, url+path, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, errors.New("gagal menghubungi WhatsApp Gateway: " + err.Error())
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, err
	}
	return resp.StatusCode, raw, nil
}

// sendWhatsAppMessage — fungsi generik siap pakai fitur lain (mis. tombol
// "Kirim Ke WA" di hasil radiologi, notifikasi antrian, dst) begitu
// dikembangkan. TIDAK dipanggil dari endpoint manapun saat ini.
func sendWhatsAppMessage(db *sql.DB, to, message string) error {
	body, _ := json.Marshal(map[string]string{"to": to, "message": message})
	status, raw, err := waGatewayRequest(db, http.MethodPost, "/send", body)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		json.Unmarshal(raw, &errResp)
		if errResp.Error != "" {
			return errors.New(errResp.Error)
		}
		return errors.New("WhatsApp Gateway menolak permintaan")
	}
	return nil
}

// GET /api/wa-gateway/status — dipakai Admin > Pengaturan WhatsApp Gateway
// buat cek status koneksi (terhubung/belum, nomor yg dipakai).
func getWaGatewayStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status, raw, err := waGatewayRequest(db, http.MethodGet, "/status", nil)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.Data(status, "application/json", raw)
	}
}

// GET /api/wa-gateway/qr — dipakai halaman pairing buat ambil QR code
// (base64 PNG) yg mau di-scan pakai HP.
func getWaGatewayQR(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status, raw, err := waGatewayRequest(db, http.MethodGet, "/qr", nil)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.Data(status, "application/json", raw)
	}
}

// POST /api/wa-gateway/logout — putuskan sesi WhatsApp yg sedang login,
// dipakai tombol "Ganti Nomor" di halaman pairing.
func postWaGatewayLogout(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status, raw, err := waGatewayRequest(db, http.MethodPost, "/logout", nil)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.Data(status, "application/json", raw)
	}
}
