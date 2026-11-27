package main

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// tablet_akses_handler.go — Hak Akses ERM Tablet per akun (Pengaturan >
// Aplikasi Tablet > Atur Hak Akses Tablet di web). Disimpan sbg daftar
// kunci menu/tab yg DINONAKTIFKAN (mis. "menu.igd", "ralan.billing",
// "ranap.rad") — akun tanpa baris = semua aktif, jadi akun lama & akun baru
// tidak berubah perilakunya sampai admin mengaturnya.
//
// Tabel BARU milik ERMApp, auto-dibuat via ensureTabletAksesTable
// (CREATE TABLE IF NOT EXISTS saja, tidak menyentuh tabel Khanza).

func ensureTabletAksesTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS erm_tablet_akses (
			user_id INT NOT NULL PRIMARY KEY,
			nonaktif TEXT NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
	return err
}

func pecahKunciAkses(s string) []string {
	out := []string{}
	for _, k := range strings.Split(s, ",") {
		if k = strings.TrimSpace(k); k != "" {
			out = append(out, k)
		}
	}
	return out
}

// GET /api/tablet/akses — semua akun yg sudah diatur: [{user_id, nonaktif:[...]}]
func getTabletAksesList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT user_id, nonaktif FROM erm_tablet_akses`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat hak akses tablet: " + err.Error()})
			return
		}
		defer rows.Close()
		type item struct {
			UserID   int      `json:"user_id"`
			Nonaktif []string `json:"nonaktif"`
		}
		list := []item{}
		for rows.Next() {
			var it item
			var s string
			if rows.Scan(&it.UserID, &s) == nil {
				it.Nonaktif = pecahKunciAkses(s)
				list = append(list, it)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// GET /api/tablet/akses/:user_id — dipakai tablet saat login/start.
func getTabletAkses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("user_id"))
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id tidak valid"})
			return
		}
		var s string
		err = db.QueryRow(`SELECT nonaktif FROM erm_tablet_akses WHERE user_id = ?`, id).Scan(&s)
		if err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat hak akses tablet: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user_id": id, "nonaktif": pecahKunciAkses(s)})
	}
}

// PUT /api/tablet/akses/:user_id {nonaktif:[...]} — kosong = semua aktif.
func saveTabletAkses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("user_id"))
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id tidak valid"})
			return
		}
		var in struct {
			Nonaktif []string `json:"nonaktif"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		uniq := map[string]bool{}
		for _, k := range in.Nonaktif {
			k = strings.TrimSpace(k)
			if k != "" && !strings.Contains(k, ",") {
				uniq[k] = true
			}
		}
		keys := make([]string, 0, len(uniq))
		for k := range uniq {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		if len(keys) == 0 {
			if _, err := db.Exec(`DELETE FROM erm_tablet_akses WHERE user_id = ?`, id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
				return
			}
		} else if _, err := db.Exec(`INSERT INTO erm_tablet_akses (user_id, nonaktif) VALUES (?, ?)
			ON DUPLICATE KEY UPDATE nonaktif = VALUES(nonaktif)`, id, strings.Join(keys, ",")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Hak akses tablet tersimpan", "nonaktif": keys})
	}
}
