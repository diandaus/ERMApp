package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Khanza AES-CBC key & IV (dari EnkripsiAES.java)
const khanzaAESKey = "Bar12345Bar12345"
const khanzaAESIV = "sayangsamakhanza"

// khanzaDecrypt mendekripsi nilai AES/CBC/PKCS5 dari database.xml Khanza.
func khanzaDecrypt(encrypted string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher([]byte(khanzaAESKey))
	if err != nil {
		return "", err
	}
	if len(data)%aes.BlockSize != 0 {
		return "", fmt.Errorf("ciphertext bukan kelipatan block size")
	}
	mode := cipher.NewCBCDecrypter(block, []byte(khanzaAESIV))
	mode.CryptBlocks(data, data)
	// Hapus PKCS5 padding
	pad := int(data[len(data)-1])
	if pad < 1 || pad > aes.BlockSize {
		return "", fmt.Errorf("padding tidak valid")
	}
	return string(data[:len(data)-pad]), nil
}

// xmlProperties memetakan struktur Java Properties XML.
type xmlProperties struct {
	Entries []xmlEntry `xml:"entry"`
}
type xmlEntry struct {
	Key   string `xml:"key,attr"`
	Value string `xml:",chardata"`
}

// readKhanzaDatabaseXML membaca database.xml Khanza dan mengembalikan map key→value.
// Nilai terenkripsi (HOST, PORT, USER, PAS, HOSTHYBRIDWEB, dll) sudah di-decrypt.
func readKhanzaDatabaseXML(path string) (map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	// Hapus DOCTYPE declaration agar xml.Unmarshal tidak error
	rawStr := string(raw)
	if idx := strings.Index(rawStr, "?>"); idx >= 0 {
		after := rawStr[idx+2:]
		if dIdx := strings.Index(after, "<!DOCTYPE"); dIdx >= 0 {
			end := strings.Index(after[dIdx:], ">")
			if end >= 0 {
				after = after[:dIdx] + after[dIdx+end+1:]
			}
		}
		rawStr = rawStr[:idx+2] + after
	}

	var props xmlProperties
	if err := xml.Unmarshal([]byte(rawStr), &props); err != nil {
		return nil, fmt.Errorf("gagal parse XML: %w", err)
	}

	// Key yang perlu di-decrypt
	encryptedKeys := map[string]bool{
		"HOST": true, "PORT": true, "DATABASE": true, "USER": true, "PAS": true,
		"HOSTHYBRIDWEB": true, "USERHYBRIDWEB": true, "PASHYBRIDWEB": true,
	}

	result := make(map[string]string)
	for _, e := range props.Entries {
		val := strings.TrimSpace(e.Value)
		if encryptedKeys[e.Key] && val != "" {
			if dec, err := khanzaDecrypt(val); err == nil {
				result[e.Key] = dec
			} else {
				result[e.Key] = val // simpan asli jika gagal decrypt
			}
		} else {
			result[e.Key] = val
		}
	}
	return result, nil
}

// KhanzaWebappsConfig menyimpan URL webapps dan path filesystem (jika lokal).
type KhanzaWebappsConfig struct {
	URL       string // http://host:port/webapps
	LocalPath string // /path/ke/webapps (jika sama server, untuk static serve)
	IsRemote  bool   // true jika host bukan localhost
}

// LoadKhanzaWebappsConfig menentukan URL webapps Khanza dengan urutan prioritas:
//  1. KHANZA_WEBAPPS_URL (env) — override manual
//  2. KHANZA_DATABASE_XML (env) — baca & decrypt database.xml
//  3. KHANZA_WEBAPPS_PATH (env) — path filesystem lokal
//  4. Fallback: /var/www/html/webapps
func LoadKhanzaWebappsConfig() KhanzaWebappsConfig {
	// [1] Override URL manual
	if u := strings.TrimSpace(os.Getenv("KHANZA_WEBAPPS_URL")); u != "" {
		return KhanzaWebappsConfig{URL: u, IsRemote: true}
	}

	// [2] Baca dari database.xml
	if xmlPath := strings.TrimSpace(os.Getenv("KHANZA_DATABASE_XML")); xmlPath != "" {
		cfg, err := readKhanzaDatabaseXML(xmlPath)
		if err == nil {
			host := cfg["HOSTHYBRIDWEB"]
			port := cfg["PORTWEB"]
			web := cfg["HYBRIDWEB"]
			if host == "" {
				host = "localhost"
			}
			if port == "" {
				port = "80"
			}
			if web == "" {
				web = "webapps"
			}
			webappsURL := fmt.Sprintf("http://%s:%s/%s", host, port, web)
			isRemote := host != "localhost" && host != "127.0.0.1"
			localPath := strings.TrimSpace(os.Getenv("KHANZA_WEBAPPS_PATH"))
			fmt.Printf("[KhanzaConfig] database.xml → %s (remote=%v, localPath=%q)\n", webappsURL, isRemote, localPath)
			return KhanzaWebappsConfig{URL: webappsURL, LocalPath: localPath, IsRemote: isRemote}
		} else {
			fmt.Printf("[KhanzaConfig] Gagal baca database.xml: %v\n", err)
		}
	}

	// [3] Path filesystem lokal dari env
	if p := strings.TrimSpace(os.Getenv("KHANZA_WEBAPPS_PATH")); p != "" {
		fmt.Printf("[KhanzaConfig] KHANZA_WEBAPPS_PATH → %s\n", p)
		return KhanzaWebappsConfig{LocalPath: p, IsRemote: false}
	}

	// [4] Fallback default Linux
	fallback := "/var/www/html/webapps"
	fmt.Printf("[KhanzaConfig] Fallback → %s\n", fallback)
	return KhanzaWebappsConfig{LocalPath: fallback, IsRemote: false}
}

// registerWebappsSubRoute mendaftarkan satu sub-folder webapps (misal: "radiologi", "berkasrawat").
// Jika remote → reverse proxy; jika lokal → static file serving.
func registerWebappsSubRoute(r *gin.Engine, cfg KhanzaWebappsConfig, sub string) {
	localBase := cfg.LocalPath
	if localBase == "" {
		localBase = "/var/www/html/webapps"
	}
	route := "/" + sub

	if cfg.IsRemote {
		remoteURL := cfg.URL + "/" + sub
		target, err := url.Parse(remoteURL)
		if err != nil {
			fmt.Printf("[KhanzaConfig] URL tidak valid untuk /%s, fallback static\n", sub)
			r.Static(route, localBase+"/"+sub)
			return
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			// req.URL.Path masih berisi prefix route (mis. "/radiologi/pages/upload/...")
			// karena Gin tidak menghapus prefix pada wildcard route. Buang prefix itu
			// lalu sambung ke path target (mis. "/webapps/radiologi") agar tidak dobel.
			req.URL.Path = target.Path + strings.TrimPrefix(req.URL.Path, route)
			req.Host = target.Host
		}
		r.GET(route+"/*path", func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})
		fmt.Printf("[KhanzaConfig] /%s → reverse proxy ke %s\n", sub, remoteURL)
	} else {
		r.Static(route, localBase+"/"+sub)
		fmt.Printf("[KhanzaConfig] /%s → static %s/%s\n", sub, localBase, sub)
	}
}

// RegisterKhanzaWebappsRoutes mendaftarkan semua route file statis Khanza webapps.
func RegisterKhanzaWebappsRoutes(r *gin.Engine, cfg KhanzaWebappsConfig) {
	registerWebappsSubRoute(r, cfg, "radiologi")
	registerWebappsSubRoute(r, cfg, "berkasrawat")
}

// WebappsUploadDir mengembalikan path direktori upload berkasrawat di filesystem lokal.
// Dipakai HANYA saat cfg.IsRemote=false (backend & webapps satu server) —
// kalau remote, upload harus lewat WriteWebappsFile (upload.php), BUKAN
// tulis langsung ke disk lokal (disk backend beda dgn disk webapps).
func WebappsUploadDir(cfg KhanzaWebappsConfig) string {
	base := cfg.LocalPath
	if base == "" {
		base = "/var/www/html/webapps"
	}
	return base + "/berkasrawat/pages/upload"
}

// WriteWebappsFile menyimpan file ke webapps/<relDir>/<fileName>. Kalau
// cfg.IsRemote (backend & webapps di server terpisah) — kirim lewat
// upload.php di server webapps, PERSIS mekanisme UploadPDF() di aplikasi
// desktop Khanza Java (auto-upload PDF SEP yg sudah terbukti jalan di
// produksi): POST multipart ke "<webappsURL>/upload.php?doc=<relDir>",
// field "file" = isi berkas. Kalau tidak remote (satu server), langsung
// tulis ke disk lokal seperti sebelumnya.
func WriteWebappsFile(cfg KhanzaWebappsConfig, relDir, fileName string, data []byte) error {
	if cfg.IsRemote {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		part, err := w.CreateFormFile("file", fileName)
		if err != nil {
			return err
		}
		if _, err := part.Write(data); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}

		// upload.php di server webapps concat "$location.$name" TANPA slash
		// pemisah (dikonfirmasi baca source-nya langsung) — jadi "doc" WAJIB
		// diakhiri "/", kalau tidak nama file nyambung ke nama folder.
		uploadURL := strings.TrimRight(cfg.URL, "/") + "/upload.php?doc=" + strings.TrimRight(relDir, "/") + "/"
		req, err := http.NewRequest(http.MethodPost, uploadURL, &buf)
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", w.FormDataContentType())
		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal terhubung ke server webapps (%s): %w", uploadURL, err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("upload.php di server webapps membalas status %d", resp.StatusCode)
		}
		return nil
	}

	dir := cfg.LocalPath
	if dir == "" {
		dir = "/var/www/html/webapps"
	}
	fullDir := dir + "/" + relDir
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		return err
	}
	return os.WriteFile(fullDir+"/"+fileName, data, 0644)
}
