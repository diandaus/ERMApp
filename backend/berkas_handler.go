package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type MasterBerkas struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

type BerkasItem struct {
	NoRawat     string `json:"no_rawat"`
	Kode        string `json:"kode"`
	NamaBerkas  string `json:"nama_berkas"`
	LokasiFile  string `json:"lokasi_file"`
	NamaFile    string `json:"nama_file"`
	Ekstensi    string `json:"ekstensi"`
}

// getMasterBerkas returns all document types from master_berkas_digital.
func getMasterBerkas(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT kode, IFNULL(nama,'') FROM master_berkas_digital ORDER BY kode`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []MasterBerkas
		for rows.Next() {
			var m MasterBerkas
			rows.Scan(&m.Kode, &m.Nama)
			list = append(list, m)
		}
		if list == nil {
			list = []MasterBerkas{}
		}
		c.JSON(http.StatusOK, list)
	}
}

// listBerkasRawat returns all uploaded files for a given no_rawat.
func listBerkasRawat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		rows, err := db.Query(`
			SELECT b.no_rawat, b.kode, IFNULL(m.nama,''), b.lokasi_file
			FROM berkas_digital_perawatan b
			LEFT JOIN master_berkas_digital m ON b.kode = m.kode
			WHERE b.no_rawat = ?
			ORDER BY m.nama, b.lokasi_file
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []BerkasItem
		for rows.Next() {
			var item BerkasItem
			rows.Scan(&item.NoRawat, &item.Kode, &item.NamaBerkas, &item.LokasiFile)
			item.NamaFile = filepath.Base(item.LokasiFile)
			item.Ekstensi = strings.ToLower(strings.TrimPrefix(filepath.Ext(item.NamaFile), "."))
			list = append(list, item)
		}
		if list == nil {
			list = []BerkasItem{}
		}
		c.JSON(http.StatusOK, list)
	}
}

// uploadBerkasRawat handles multipart file upload, saves to webapps/berkasrawat/pages/upload/,
// and inserts a record into berkas_digital_perawatan.
func uploadBerkasRawat(db *sql.DB, cfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.PostForm("no_rawat")
		kode := c.PostForm("kode")
		if noRawat == "" || kode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat dan kode wajib diisi"})
			return
		}

		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File tidak ditemukan"})
			return
		}
		defer file.Close()

		// Sanitize filename — ganti spasi & karakter berbahaya dengan underscore
		originalName := filepath.Base(header.Filename)
		ext := strings.ToLower(filepath.Ext(originalName))
		baseName := strings.TrimSuffix(originalName, filepath.Ext(originalName))
		// Ganti spasi dan karakter non-alphanumeric (kecuali - _) dengan _
		safeBase := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
				return r
			}
			return '_'
		}, baseName)
		safeName := fmt.Sprintf("%s_%s%s", safeBase, time.Now().Format("20060102_150405"), ext)

		// Simpan ke direktori upload Khanza berkasrawat
		uploadDir := WebappsUploadDir(cfg)
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat direktori upload"})
			return
		}

		destPath := filepath.Join(uploadDir, safeName)
		buf := make([]byte, header.Size)
		if _, err := file.Read(buf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file"})
			return
		}
		if err := os.WriteFile(destPath, buf, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file"})
			return
		}

		// Lokasi relatif seperti yang Khanza simpan: pages/upload/filename
		lokasiFile := "pages/upload/" + safeName

		_, err = db.Exec(
			`INSERT INTO berkas_digital_perawatan (no_rawat, kode, lokasi_file) VALUES (?, ?, ?)`,
			noRawat, kode, lokasiFile,
		)
		if err != nil {
			// Hapus file jika insert DB gagal
			os.Remove(destPath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ke database: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "Berkas berhasil diupload",
			"lokasi_file":  lokasiFile,
			"nama_file":    safeName,
		})
	}
}

// deleteBerkasRawat menghapus record dari DB dan file dari filesystem.
func deleteBerkasRawat(db *sql.DB, cfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoRawat    string `json:"no_rawat"`
			Kode       string `json:"kode"`
			LokasiFile string `json:"lokasi_file"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.NoRawat == "" || req.LokasiFile == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat, kode, dan lokasi_file wajib diisi"})
			return
		}

		// Hapus dari DB
		res, err := db.Exec(
			`DELETE FROM berkas_digital_perawatan WHERE no_rawat=? AND kode=? AND lokasi_file=?`,
			req.NoRawat, req.Kode, req.LokasiFile,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if rows, _ := res.RowsAffected(); rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Berkas tidak ditemukan"})
			return
		}

		// Hapus file dari filesystem (hanya jika lokal)
		if !cfg.IsRemote {
			base := cfg.LocalPath
			if base == "" {
				base = "/var/www/html/webapps"
			}
			filePath := filepath.Join(base, "berkasrawat", req.LokasiFile)
			os.Remove(filePath) // abaikan error jika file sudah tidak ada
		}

		c.JSON(http.StatusOK, gin.H{"message": "Berkas berhasil dihapus"})
	}
}
