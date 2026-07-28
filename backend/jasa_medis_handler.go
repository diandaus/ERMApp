package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ensureJasaMedisTable membuat tabel jasa_medis jika belum ada. Tabel ini
// baru (bukan tabel Khanza yang sudah ada) — daftar master jenis jasa medis
// beserta persentasenya, diinput manual lewat Casemix > Pengaturan > Jasa
// Medis. Nilai jasa medis per pasien BUKAN nominal tetap, tapi persentase
// yang dikalikan ke nilai klaim_inacbg pasien tsb (mis. 20% dari klaim
// INACBG) — dipakai untuk menghitung kolom "Jasa Medis" di Monitoring Biaya
// Klaim BPJS (KlaimInacbg.tsx) pada langkah berikutnya. Tiap baris jasa
// medis bisa dikaitkan ke satu DPJP tertentu (kd_dokter, merujuk ke tabel
// dokter Khanza yang sudah ada) supaya perhitungannya bisa langsung
// berdasarkan DPJP pasien — kd_dokter kosong berarti berlaku umum/semua DPJP.
func ensureJasaMedisTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS jasa_medis (
			id INT AUTO_INCREMENT PRIMARY KEY,
			nama_jasa VARCHAR(150) NOT NULL,
			persentase DECIMAL(5,2) NOT NULL DEFAULT 0,
			kd_dokter VARCHAR(20) NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`
	if _, err := db.Exec(createTable); err != nil {
		return err
	}
	// Migrasi untuk instalasi yang tabelnya sudah terlanjur dibuat dengan
	// skema lama (sebelum kolom persentase/kd_dokter ditambahkan).
	migrations := []string{
		`ALTER TABLE jasa_medis ADD COLUMN IF NOT EXISTS persentase DECIMAL(5,2) NOT NULL DEFAULT 0`,
		`ALTER TABLE jasa_medis ADD COLUMN IF NOT EXISTS kd_dokter VARCHAR(20) NOT NULL DEFAULT ''`,
	}
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return err
		}
	}
	return nil
}

// JasaMedisItem merepresentasikan satu baris master jenis jasa medis.
type JasaMedisItem struct {
	ID         int     `json:"id"`
	NamaJasa   string  `json:"nama_jasa"`
	Persentase float64 `json:"persentase"`
	KdDokter   string  `json:"kd_dokter"`
	NmDokter   string  `json:"nm_dokter"`
}

// getJasaMedisList mengambil daftar master jasa medis, opsional difilter
// dengan keyword pencarian nama jasa (?q=). Nama DPJP di-JOIN dari tabel
// dokter yang sudah ada supaya frontend tidak perlu query terpisah.
func getJasaMedisList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := c.Query("q")

		query := `
			SELECT jasa_medis.id, jasa_medis.nama_jasa, jasa_medis.persentase,
				jasa_medis.kd_dokter, COALESCE(dokter.nm_dokter, '') AS nm_dokter
			FROM jasa_medis
			LEFT JOIN dokter ON jasa_medis.kd_dokter = dokter.kd_dokter
			WHERE 1=1`
		var args []interface{}
		if keyword != "" {
			query += ` AND jasa_medis.nama_jasa LIKE ?`
			args = append(args, "%"+keyword+"%")
		}
		query += ` ORDER BY jasa_medis.nama_jasa`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []JasaMedisItem{}
		for rows.Next() {
			var it JasaMedisItem
			if err := rows.Scan(&it.ID, &it.NamaJasa, &it.Persentase, &it.KdDokter, &it.NmDokter); err != nil {
				continue
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, items)
	}
}

// SaveJasaMedisPayload adalah payload untuk membuat/mengubah satu jenis jasa medis.
type SaveJasaMedisPayload struct {
	NamaJasa   string  `json:"nama_jasa" binding:"required"`
	Persentase float64 `json:"persentase"`
	KdDokter   string  `json:"kd_dokter"`
}

// createJasaMedis menambah satu jenis jasa medis baru.
func createJasaMedis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload SaveJasaMedisPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}

		result, err := db.Exec(
			`INSERT INTO jasa_medis (nama_jasa, persentase, kd_dokter) VALUES (?, ?, ?)`,
			payload.NamaJasa, payload.Persentase, payload.KdDokter,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		id, _ := result.LastInsertId()
		c.JSON(http.StatusOK, gin.H{"message": "Jasa medis berhasil ditambahkan", "id": id})
	}
}

// updateJasaMedis mengubah nama/persentase/DPJP satu jenis jasa medis berdasarkan id.
func updateJasaMedis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var payload SaveJasaMedisPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}

		if _, err := db.Exec(
			`UPDATE jasa_medis SET nama_jasa = ?, persentase = ?, kd_dokter = ? WHERE id = ?`,
			payload.NamaJasa, payload.Persentase, payload.KdDokter, id,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Jasa medis berhasil diperbarui"})
	}
}

// deleteJasaMedis menghapus satu jenis jasa medis berdasarkan id.
func deleteJasaMedis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if _, err := db.Exec(`DELETE FROM jasa_medis WHERE id = ?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Jasa medis berhasil dihapus"})
	}
}
