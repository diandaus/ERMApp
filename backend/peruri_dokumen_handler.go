package main

import (
	"net/http"
	"os"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
)

// peruri_dokumen_handler.go — "Lihat Dokumen" di Peruri.tsx: daftar file
// dibaca LANGSUNG dari server webapps (bukan dari tabel DB manapun — ERMApp
// tidak mencatat riwayat auto-upload TTE di database sendiri, lihat
// downloadPeruriDocument di peruri_handler.go yg cuma nulis file fisiknya
// tanpa insert baris apa pun). Cuma didukung mode LOKAL (backend & webapps
// satu server, KhanzaWebappsConfig.IsRemote=false) — mode remote dibalas
// error jelas krn server webapps Khanza tidak py endpoint listing bawaan.

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
			c.JSON(http.StatusNotImplemented, gin.H{
				"error": "Server webapps mode REMOTE — daftar file tidak bisa dibaca langsung dari sini (server Khanza tidak menyediakan endpoint listing folder). Cek langsung lewat file manager/FTP di server webapps tsb, folder: " + relDir,
			})
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

// DELETE /api/peruri/dokumen?folder=berkasrawat|radiologi&name=xxx.pdf —
// hapus SATU file fisik dari server webapps (mode lokal saja, sama batasan
// dgn listPeruriDokumen). "name" divalidasi ketat (tanpa "/" atau "..") jadi
// tidak bisa dipakai keluar dari folder yg diizinkan (path traversal).
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
			c.JSON(http.StatusNotImplemented, gin.H{
				"error": "Server webapps mode REMOTE — file tidak bisa dihapus langsung dari sini. Hapus manual lewat file manager/FTP di server webapps tsb, folder: " + relDir,
			})
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
