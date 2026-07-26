package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PENGATURAN BPJS — Mapping Poli VCLAIM & Mapping Dokter DPJP VCLAIM.
// Padanan BPJSMapingPoli.java & BPJSMapingDokterDPJP.java (SIMRS Khanza
// Desktop, package bridging) — tabel maping_poli_bpjs & maping_dokter_dpjpvclaim
// SUDAH ADA di skema Khanza (bukan tabel baru buatan ERMApp), jadi handler ini
// cuma baca/tulis ke tabel yang sudah ada, sama seperti aplikasi desktop.
//
// Mapping Poli & Mapping Dokter DPJP: daftar persis seperti tampil() di
// BPJSMapingPoli.java / BPJSMapingDokterDPJP.java — INNER JOIN ke tabel
// mapping, jadi cuma poli/dokter yang SUDAH punya mapping yang muncul.
// Baris baru ditambahkan lewat modal Tambah (lihat BpjsPengaturan.tsx).
// ============================================================================

type MappingPoliBpjsRow struct {
	KdPoli     string `json:"kd_poli"`
	NmPoli     string `json:"nm_poli"`
	KdPoliBpjs string `json:"kd_poli_bpjs"`
	NmPoliBpjs string `json:"nm_poli_bpjs"`
}

type MappingDokterBpjsRow struct {
	KdDokter     string `json:"kd_dokter"`
	NmDokter     string `json:"nm_dokter"`
	KdDokterBpjs string `json:"kd_dokter_bpjs"`
	NmDokterBpjs string `json:"nm_dokter_bpjs"`
}

// ─── GET /api/bpjs/mapping-poli ────────────────────────────────────────────
// Cuma poli yang SUDAH punya mapping (INNER JOIN) — padanan tampil() di
// BPJSMapingPoli.java persis, termasuk field yang dicari (kd_poli_rs,
// nm_poli, kd_poli_bpjs, nm_poli_bpjs) dan urutan (ORDER BY nm_poli).

func getMappingPoliBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				m.kd_poli_rs,
				IFNULL(poliklinik.nm_poli,''),
				m.kd_poli_bpjs,
				IFNULL(m.nm_poli_bpjs,'')
			FROM maping_poli_bpjs m
			INNER JOIN poliklinik ON m.kd_poli_rs = poliklinik.kd_poli
		`
		args := []interface{}{}
		if keyword != "" {
			query += " WHERE (m.kd_poli_rs LIKE ? OR poliklinik.nm_poli LIKE ? OR m.kd_poli_bpjs LIKE ? OR m.nm_poli_bpjs LIKE ?)"
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw)
		}
		query += " ORDER BY poliklinik.nm_poli"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingPoliBpjsRow{}
		for rows.Next() {
			var r MappingPoliBpjsRow
			if err := rows.Scan(&r.KdPoli, &r.NmPoli, &r.KdPoliBpjs, &r.NmPoliBpjs); err != nil {
				continue
			}
			list = append(list, r)
		}

		c.JSON(http.StatusOK, gin.H{
			"list":  list,
			"total": len(list),
		})
	}
}

// ─── PUT /api/bpjs/mapping-poli/:kd_poli ───────────────────────────────────

func saveMappingPoliBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_poli")
		var body struct {
			KdPoliBpjs string `json:"kd_poli_bpjs"`
			NmPoliBpjs string `json:"nm_poli_bpjs"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.KdPoliBpjs) == "" || strings.TrimSpace(body.NmPoliBpjs) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode dan nama poli BPJS wajib diisi"})
			return
		}

		// kd_poli_bpjs adalah UNIQUE KEY di maping_poli_bpjs (1 kode poli
		// BPJS cuma boleh dipakai 1 poli lokal) — dicek eksplisit dulu di
		// sini karena INSERT ... ON DUPLICATE KEY UPDATE akan meng-update
		// baris LAIN yang sudah punya kd_poli_bpjs ini (bukan gagal dengan
		// error 1062) kalau dibiarkan begitu saja, jadi row yang sedang
		// disimpan bisa diam-diam tidak tersimpan sama sekali.
		var existingKdPoli string
		checkErr := db.QueryRow(`SELECT kd_poli_rs FROM maping_poli_bpjs WHERE kd_poli_bpjs = ? AND kd_poli_rs != ?`, body.KdPoliBpjs, kd).Scan(&existingKdPoli)
		if checkErr == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode poli BPJS " + body.KdPoliBpjs + " sudah dipakai untuk mapping poli " + existingKdPoli})
			return
		} else if checkErr != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": checkErr.Error()})
			return
		}

		_, err := db.Exec(`
			INSERT INTO maping_poli_bpjs (kd_poli_rs, kd_poli_bpjs, nm_poli_bpjs)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE
				kd_poli_bpjs = VALUES(kd_poli_bpjs),
				nm_poli_bpjs = VALUES(nm_poli_bpjs)
		`, kd, body.KdPoliBpjs, body.NmPoliBpjs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping poli berhasil disimpan"})
	}
}

// ─── DELETE /api/bpjs/mapping-poli/:kd_poli ────────────────────────────────

func deleteMappingPoliBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_poli")
		db.Exec(`DELETE FROM maping_poli_bpjs WHERE kd_poli_rs = ?`, kd)
		c.JSON(http.StatusOK, gin.H{"message": "Mapping poli dihapus"})
	}
}

// ─── GET /api/bpjs/mapping-dokter ──────────────────────────────────────────
// Cuma dokter yang SUDAH punya mapping (INNER JOIN) — padanan tampil() di
// BPJSMapingDokterDPJP.java, sama polanya dengan getMappingPoliBpjs di atas.

func getMappingDokterBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				m.kd_dokter,
				IFNULL(dokter.nm_dokter,''),
				IFNULL(m.kd_dokter_bpjs,''),
				IFNULL(m.nm_dokter_bpjs,'')
			FROM maping_dokter_dpjpvclaim m
			INNER JOIN dokter ON m.kd_dokter = dokter.kd_dokter
		`
		args := []interface{}{}
		if keyword != "" {
			query += " WHERE (m.kd_dokter LIKE ? OR dokter.nm_dokter LIKE ? OR m.kd_dokter_bpjs LIKE ? OR m.nm_dokter_bpjs LIKE ?)"
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw)
		}
		query += " ORDER BY dokter.nm_dokter"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []MappingDokterBpjsRow{}
		for rows.Next() {
			var r MappingDokterBpjsRow
			if err := rows.Scan(&r.KdDokter, &r.NmDokter, &r.KdDokterBpjs, &r.NmDokterBpjs); err != nil {
				continue
			}
			list = append(list, r)
		}

		c.JSON(http.StatusOK, gin.H{
			"list":  list,
			"total": len(list),
		})
	}
}

// ─── PUT /api/bpjs/mapping-dokter/:kd_dokter ───────────────────────────────

func saveMappingDokterBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_dokter")
		var body struct {
			KdDokterBpjs string `json:"kd_dokter_bpjs"`
			NmDokterBpjs string `json:"nm_dokter_bpjs"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(body.KdDokterBpjs) == "" || strings.TrimSpace(body.NmDokterBpjs) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode dan nama dokter BPJS wajib diisi"})
			return
		}

		// Tidak seperti maping_poli_bpjs, kd_dokter_bpjs di sini TIDAK unique
		// (beberapa dokter lokal boleh dipetakan ke kode DPJP BPJS yang sama)
		// — mengikuti constraint asli tabel maping_dokter_dpjpvclaim.
		_, err := db.Exec(`
			INSERT INTO maping_dokter_dpjpvclaim (kd_dokter, kd_dokter_bpjs, nm_dokter_bpjs)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE
				kd_dokter_bpjs = VALUES(kd_dokter_bpjs),
				nm_dokter_bpjs = VALUES(nm_dokter_bpjs)
		`, kd, body.KdDokterBpjs, body.NmDokterBpjs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Mapping dokter DPJP berhasil disimpan"})
	}
}

// ─── DELETE /api/bpjs/mapping-dokter/:kd_dokter ────────────────────────────

func deleteMappingDokterBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kd := c.Param("kd_dokter")
		db.Exec(`DELETE FROM maping_dokter_dpjpvclaim WHERE kd_dokter = ?`, kd)
		c.JSON(http.StatusOK, gin.H{"message": "Mapping dokter DPJP dihapus"})
	}
}
