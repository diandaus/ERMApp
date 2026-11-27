package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// tablet_rilis_handler.go — pembaruan aplikasi ERM Tablet (Flutter) tanpa
// Play Store: admin mengunggah APK baru lewat web (Pengaturan > Aplikasi
// Tablet) beserta versi & build number (= versionCode Android, angka
// setelah "+" di pubspec.yaml). Tablet memanggil GET /api/tablet/rilis/
// terbaru, membandingkan build_number dgn miliknya, lalu mengunduh APK dari
// /uploads/tablet/... dan membuka installer Android.
//
// Tabel BARU milik ERMApp, auto-dibuat via ensureTabletRilisTable
// (CREATE TABLE IF NOT EXISTS saja, tidak menyentuh tabel Khanza).

const tabletRilisDir = "./uploads/tablet"

func ensureTabletRilisTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS erm_tablet_rilis (
			id INT AUTO_INCREMENT PRIMARY KEY,
			versi VARCHAR(30) NOT NULL,
			build_number INT NOT NULL,
			catatan TEXT NOT NULL,
			file_name VARCHAR(150) NOT NULL,
			ukuran BIGINT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uk_build_number (build_number)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
	return err
}

type tabletRilis struct {
	ID          int    `json:"id"`
	Versi       string `json:"versi"`
	BuildNumber int    `json:"build_number"`
	Catatan     string `json:"catatan"`
	URL         string `json:"url"`
	Ukuran      int64  `json:"ukuran"`
	Tanggal     string `json:"tanggal"`
}

const tabletRilisSelect = `SELECT id, versi, build_number, catatan, file_name, ukuran,
	DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') FROM erm_tablet_rilis`

func scanTabletRilis(sc interface{ Scan(...any) error }) (tabletRilis, error) {
	var r tabletRilis
	var fileName string
	err := sc.Scan(&r.ID, &r.Versi, &r.BuildNumber, &r.Catatan, &fileName, &r.Ukuran, &r.Tanggal)
	r.URL = "/uploads/tablet/" + fileName
	return r, err
}

// GET /api/tablet/rilis — daftar semua rilis (terbaru dulu).
func getTabletRilisList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(tabletRilisSelect + ` ORDER BY build_number DESC`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat rilis: " + err.Error()})
			return
		}
		defer rows.Close()
		list := []tabletRilis{}
		for rows.Next() {
			if r, err := scanTabletRilis(rows); err == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// GET /api/tablet/rilis/terbaru — rilis dgn build_number tertinggi.
// Belum ada rilis -> {"ada": false} (bukan 404, supaya tablet tdk anggap error).
func getTabletRilisTerbaru(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		r, err := scanTabletRilis(db.QueryRow(tabletRilisSelect + ` ORDER BY build_number DESC LIMIT 1`))
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{"ada": false})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat rilis: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ada": true, "rilis": r})
	}
}

// POST /api/tablet/rilis (multipart: apk, versi, build_number, catatan)
func createTabletRilis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		versi := strings.TrimSpace(c.PostForm("versi"))
		catatan := strings.TrimSpace(c.PostForm("catatan"))
		build, err := strconv.Atoi(strings.TrimSpace(c.PostForm("build_number")))
		if versi == "" || err != nil || build <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Versi dan build number (angka > 0) wajib diisi"})
			return
		}
		file, err := c.FormFile("apk")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File APK wajib diunggah"})
			return
		}
		if strings.ToLower(filepath.Ext(file.Filename)) != ".apk" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File harus berekstensi .apk"})
			return
		}
		var maxBuild sql.NullInt64
		_ = db.QueryRow(`SELECT MAX(build_number) FROM erm_tablet_rilis`).Scan(&maxBuild)
		if maxBuild.Valid && int64(build) <= maxBuild.Int64 {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Build number harus lebih besar dari rilis terakhir (%d)", maxBuild.Int64)})
			return
		}
		if err := os.MkdirAll(tabletRilisDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat folder rilis"})
			return
		}
		fileName := fmt.Sprintf("erm_tablet_%d.apk", build)
		if err := c.SaveUploadedFile(file, filepath.Join(tabletRilisDir, fileName)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan APK: " + err.Error()})
			return
		}
		res, err := db.Exec(`INSERT INTO erm_tablet_rilis (versi, build_number, catatan, file_name, ukuran) VALUES (?, ?, ?, ?, ?)`,
			versi, build, catatan, fileName, file.Size)
		if err != nil {
			_ = os.Remove(filepath.Join(tabletRilisDir, fileName))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan rilis: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		c.JSON(http.StatusOK, gin.H{"id": id, "message": "Rilis tersimpan"})
	}
}

// DELETE /api/tablet/rilis/:id — hapus rilis + file APK-nya.
func deleteTabletRilis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var fileName string
		if err := db.QueryRow(`SELECT file_name FROM erm_tablet_rilis WHERE id = ?`, c.Param("id")).Scan(&fileName); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Rilis tidak ditemukan"})
			return
		}
		if _, err := db.Exec(`DELETE FROM erm_tablet_rilis WHERE id = ?`, c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus rilis: " + err.Error()})
			return
		}
		_ = os.Remove(filepath.Join(tabletRilisDir, filepath.Base(fileName)))
		c.JSON(http.StatusOK, gin.H{"message": "Rilis dihapus"})
	}
}
