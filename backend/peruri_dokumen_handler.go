package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// peruri_dokumen_handler.go — "Lihat Dokumen" di Peruri.tsx: daftar/hapus
// file dibaca LANGSUNG dari server webapps (bukan dari tabel DB manapun —
// ERMApp tidak mencatat riwayat auto-upload TTE di database sendiri, lihat
// downloadPeruriDocument di peruri_handler.go yg cuma nulis file fisiknya
// tanpa insert baris apa pun).
//
// Mode LOKAL (backend & webapps satu server): baca/hapus filesystem
// langsung. Mode REMOTE (server terpisah): server Khanza TIDAK py endpoint
// listing/hapus bawaan (cuma upload.php utk terima file, satu arah) — jadi
// dipanggil 2 script PHP kecil tambahan, list_files.php & delete_file.php
// (sumbernya ada di ../webapps-scripts/, salinan jg ditaruh di komentar
// paling bawah file ini biar gampang dicek tanpa buka file lain), yg PERLU
// ditaruh manual oleh admin di ROOT webapps (folder yg sama dgn upload.php
// yg sudah ada). Polanya PERSIS sama dgn upload.php (query param "doc",
// tanpa autentikasi tambahan — sama level keamanan dgn upload.php yg sudah
// lama jalan di produksi).

// peruriDokumenFolders — sub-folder yg boleh dibaca lewat fitur ini, dibatasi
// whitelist (bukan terima path bebas dari user) sbg pencegahan path
// traversal paling awal, sebelum validasi "..".
var peruriDokumenFolders = map[string]string{
	"berkasrawat": "berkasrawat/pages/upload",
	"radiologi":   "radiologi/pages/upload",
}

type peruriDokumenFile struct {
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modified_at"`
	Url        string `json:"url"`
}

// GET /api/peruri/dokumen/list?folder=berkasrawat|radiologi&search=...
func listPeruriDokumen(webappsCfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		folderKey := c.DefaultQuery("folder", "berkasrawat")
		relDir, ok := peruriDokumenFolders[folderKey]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter folder tidak dikenal"})
			return
		}
		search := strings.ToLower(strings.TrimSpace(c.Query("search")))

		if webappsCfg.IsRemote {
			files, err := listPeruriDokumenRemote(webappsCfg, relDir, search)
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"dir": relDir, "files": files, "count": len(files)})
			return
		}

		base := webappsCfg.LocalPath
		if base == "" {
			base = "/var/www/html/webapps"
		}
		fullDir := base + "/" + relDir

		entries, err := os.ReadDir(fullDir)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca folder " + fullDir + ": " + err.Error()})
			return
		}

		files := []peruriDokumenFile{}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			// index.php — placeholder anti-directory-listing bawaan Khanza di
			// tiap folder upload (bukan dokumen sungguhan), disaring dari daftar.
			if strings.EqualFold(e.Name(), "index.php") {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(e.Name()), search) {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			// URL statis — sama route yg didaftarkan RegisterKhanzaWebappsRoutes
			// (mis. GET /berkasrawat/pages/upload/xxx.pdf), jadi file bisa
			// langsung dibuka/diunduh dari browser tanpa endpoint tambahan.
			files = append(files, peruriDokumenFile{
				Name:       e.Name(),
				Size:       info.Size(),
				ModifiedAt: info.ModTime().Format("2006-01-02 15:04:05"),
				Url:        "/" + relDir + "/" + e.Name(),
			})
		}
		sort.Slice(files, func(i, j int) bool { return files[i].ModifiedAt > files[j].ModifiedAt })

		c.JSON(http.StatusOK, gin.H{"dir": fullDir, "files": files, "count": len(files)})
	}
}

// listPeruriDokumenRemote — panggil list_files.php di server webapps (lihat
// isi script di bawah), sama pola URL dgn WriteWebappsFile (?doc=<relDir>/).
func listPeruriDokumenRemote(webappsCfg KhanzaWebappsConfig, relDir, search string) ([]peruriDokumenFile, error) {
	listURL := strings.TrimRight(webappsCfg.URL, "/") + "/list_files.php?doc=" + url.QueryEscape(strings.TrimRight(relDir, "/")+"/")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(listURL)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi server webapps (%s): %w", listURL, err)
	}
	defer resp.Body.Close()

	var remote struct {
		Files []struct {
			Name       string `json:"name"`
			Size       int64  `json:"size"`
			ModifiedAt string `json:"modified_at"`
		} `json:"files"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&remote); err != nil {
		return nil, fmt.Errorf("respons list_files.php tidak valid (kemungkinan script belum terpasang di server webapps — lihat komentar peruri_dokumen_handler.go): %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		if remote.Error != "" {
			return nil, fmt.Errorf("%s", remote.Error)
		}
		return nil, fmt.Errorf("list_files.php membalas status %d", resp.StatusCode)
	}

	files := []peruriDokumenFile{}
	for _, f := range remote.Files {
		if strings.EqualFold(f.Name, "index.php") {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(f.Name), search) {
			continue
		}
		files = append(files, peruriDokumenFile{
			Name: f.Name, Size: f.Size, ModifiedAt: f.ModifiedAt,
			Url: "/" + relDir + "/" + f.Name,
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].ModifiedAt > files[j].ModifiedAt })
	return files, nil
}

// DELETE /api/peruri/dokumen?folder=berkasrawat|radiologi&name=xxx.pdf —
// hapus SATU file fisik dari server webapps. "name" divalidasi ketat (tanpa
// "/" atau "..") jadi tidak bisa dipakai keluar dari folder yg diizinkan
// (path traversal).
func deletePeruriDokumen(webappsCfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		folderKey := c.Query("folder")
		relDir, ok := peruriDokumenFolders[folderKey]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter folder tidak dikenal"})
			return
		}
		name := c.Query("name")
		if name == "" || strings.ContainsAny(name, "/\\") || strings.Contains(name, "..") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama file tidak valid"})
			return
		}
		if strings.EqualFold(name, "index.php") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File ini tidak boleh dihapus"})
			return
		}

		if webappsCfg.IsRemote {
			if err := deletePeruriDokumenRemote(webappsCfg, relDir, name); err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}

		base := webappsCfg.LocalPath
		if base == "" {
			base = "/var/www/html/webapps"
		}
		fullPath := base + "/" + relDir + "/" + name

		if err := os.Remove(fullPath); err != nil {
			if os.IsNotExist(err) {
				c.JSON(http.StatusNotFound, gin.H{"error": "File tidak ditemukan"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus file: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// deletePeruriDokumenRemote — panggil delete_file.php di server webapps
// (lihat isi script di bawah). POST (bukan GET) supaya tidak ke-trigger
// tidak sengaja oleh link prefetch/crawler.
func deletePeruriDokumenRemote(webappsCfg KhanzaWebappsConfig, relDir, name string) error {
	delURL := strings.TrimRight(webappsCfg.URL, "/") + "/delete_file.php?doc=" +
		url.QueryEscape(strings.TrimRight(relDir, "/")+"/") + "&name=" + url.QueryEscape(name)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(delURL, "application/x-www-form-urlencoded", nil)
	if err != nil {
		return fmt.Errorf("gagal menghubungi server webapps (%s): %w", delURL, err)
	}
	defer resp.Body.Close()

	var remote struct {
		Success bool   `json:"success"`
		Error   string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&remote); err != nil {
		return fmt.Errorf("respons delete_file.php tidak valid (kemungkinan script belum terpasang di server webapps — lihat komentar peruri_dokumen_handler.go): %w", err)
	}
	if resp.StatusCode != http.StatusOK || !remote.Success {
		if remote.Error != "" {
			return fmt.Errorf("%s", remote.Error)
		}
		return fmt.Errorf("delete_file.php membalas status %d", resp.StatusCode)
	}
	return nil
}

// ============================================================================
// Script PHP yg WAJIB ditaruh manual oleh admin di ROOT webapps (folder yg
// sama dgn upload.php yg sudah ada di produksi) supaya "Lihat Dokumen" jalan
// di mode REMOTE. Tanpa ini, list/hapus mode remote akan gagal dgn pesan
// "respons tidak valid (kemungkinan script belum terpasang)".
//
// ---- list_files.php ----
// <?php
// header('Content-Type: application/json');
// $doc = isset($_GET['doc']) ? $_GET['doc'] : '';
// $dir = rtrim($doc, '/');
// if ($dir === '' || strpos($dir, '..') !== false) {
//     http_response_code(400);
//     echo json_encode(['error' => 'Parameter doc tidak valid']);
//     exit;
// }
// if (!is_dir($dir)) {
//     http_response_code(404);
//     echo json_encode(['error' => 'Folder tidak ditemukan: ' . $dir]);
//     exit;
// }
// $files = [];
// foreach (scandir($dir) as $name) {
//     if ($name === '.' || $name === '..' || strcasecmp($name, 'index.php') === 0) continue;
//     $path = $dir . '/' . $name;
//     if (is_dir($path)) continue;
//     $files[] = [
//         'name' => $name,
//         'size' => filesize($path),
//         'modified_at' => date('Y-m-d H:i:s', filemtime($path)),
//     ];
// }
// echo json_encode(['files' => $files]);
//
// ---- delete_file.php ----
// <?php
// header('Content-Type: application/json');
// $doc = isset($_GET['doc']) ? $_GET['doc'] : '';
// $name = isset($_GET['name']) ? $_GET['name'] : '';
// $dir = rtrim($doc, '/');
// if ($dir === '' || strpos($dir, '..') !== false || $name === '' || strpos($name, '/') !== false || strpos($name, '..') !== false) {
//     http_response_code(400);
//     echo json_encode(['error' => 'Parameter tidak valid']);
//     exit;
// }
// if (strcasecmp($name, 'index.php') === 0) {
//     http_response_code(400);
//     echo json_encode(['error' => 'File ini tidak boleh dihapus']);
//     exit;
// }
// $path = $dir . '/' . $name;
// if (!file_exists($path)) {
//     http_response_code(404);
//     echo json_encode(['error' => 'File tidak ditemukan']);
//     exit;
// }
// if (unlink($path)) {
//     echo json_encode(['success' => true]);
// } else {
//     http_response_code(500);
//     echo json_encode(['error' => 'Gagal menghapus file']);
// }
// ============================================================================
