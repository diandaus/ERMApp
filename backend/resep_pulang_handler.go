package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------- Result types ----------

type ResepPulangItemResult struct {
	KodeBrng string  `json:"kode_brng"`
	NamaBrng string  `json:"nama_brng"`
	KodeSat  string  `json:"kode_sat"`
	Jml      float64 `json:"jml"`
	Dosis    string  `json:"dosis"`
}

type RacikanPulangDetailResult struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	KodeSat   string  `json:"kode_sat"`
	Jml       float64 `json:"jml"`
	Kandungan string  `json:"kandungan"`
}

type RacikanPulangResult struct {
	NoRacik     string                      `json:"no_racik"`
	NamaRacik   string                      `json:"nama_racik"`
	KdRacik     string                      `json:"kd_racik"`
	NmRacik     string                      `json:"nm_racik"`
	JmlDr       int                         `json:"jml_dr"`
	AturanPakai string                      `json:"aturan_pakai"`
	Keterangan  string                      `json:"keterangan"`
	Detail      []RacikanPulangDetailResult `json:"detail"`
}

type ResepPulangResult struct {
	NoPermintaan  string                `json:"no_permintaan"`
	TglPermintaan string                `json:"tgl_permintaan"`
	Jam           string                `json:"jam"`
	NoRawat       string                `json:"no_rawat"`
	KdDokter      string                `json:"kd_dokter"`
	NmDokter      string                `json:"nm_dokter"`
	Status        string                `json:"status"`
	TglValidasi   string                `json:"tgl_validasi"`
	Items         []ResepPulangItemResult `json:"items"`
	Racikan       []RacikanPulangResult   `json:"racikan"`
}

// ---------- Payload types ----------

type ResepPulangItemPayload struct {
	KodeBrng string  `json:"kode_brng"`
	Jml      float64 `json:"jml"`
	Dosis    string  `json:"dosis"`
}

type RacikanPulangDetailPayload struct {
	KodeBrng  string  `json:"kode_brng"`
	Jml       float64 `json:"jml"`
	Kandungan string  `json:"kandungan"`
}

type RacikanPulangPayload struct {
	NamaRacik   string                      `json:"nama_racik"`
	KdRacik     string                      `json:"kd_racik"`
	JmlDr       int                         `json:"jml_dr"`
	AturanPakai string                      `json:"aturan_pakai"`
	Keterangan  string                      `json:"keterangan"`
	Detail      []RacikanPulangDetailPayload `json:"detail"`
}

type SaveResepPulangPayload struct {
	NoRawat  string                  `json:"no_rawat"`
	KdDokter string                  `json:"kd_dokter"`
	Items    []ResepPulangItemPayload `json:"items"`
	Racikan  []RacikanPulangPayload   `json:"racikan"`
}

type UpdateResepPulangPayload struct {
	NoPermintaan string                  `json:"no_permintaan"`
	Items        []ResepPulangItemPayload `json:"items"`
	Racikan      []RacikanPulangPayload   `json:"racikan"`
}

// ---------- Helpers ----------

func generateNoPermintaanResepPulang(db *sql.DB, tgl string) (string, error) {
	prefix := "RP" + strings.ReplaceAll(tgl, "-", "")
	var maxSeq int
	err := db.QueryRow(`SELECT IFNULL(MAX(CONVERT(RIGHT(no_permintaan,4),SIGNED)),0) FROM permintaan_resep_pulang WHERE tgl_permintaan = ?`, tgl).Scan(&maxSeq)
	if err != nil {
		return fmt.Sprintf("%s0001", prefix), nil
	}
	return fmt.Sprintf("%s%04d", prefix, maxSeq+1), nil
}

// resolveKdRacik converts a friendly name ("Puyer") to a kd_racik code ("R01").
func resolveKdRacikPulang(db *sql.DB, kdRacik string) string {
	if len(kdRacik) <= 3 {
		return kdRacik
	}
	var found string
	if err := db.QueryRow(`SELECT kd_racik FROM metode_racik WHERE LOWER(nm_racik) = LOWER(?) LIMIT 1`, kdRacik).Scan(&found); err == nil {
		return found
	}
	return "R01"
}

func insertRacikanPulang(tx *sql.Tx, db *sql.DB, noPerm string, racikanList []RacikanPulangPayload) error {
	for i, rac := range racikanList {
		noRacik := fmt.Sprintf("%02d", i+1)
		kdRacik := resolveKdRacikPulang(db, rac.KdRacik)
		jmlDr := rac.JmlDr
		if jmlDr <= 0 {
			jmlDr = 1
		}
		_, err := tx.Exec(`INSERT INTO resep_pulang_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			noPerm, noRacik, rac.NamaRacik, kdRacik, jmlDr, rac.AturanPakai, rac.Keterangan)
		if err != nil {
			return fmt.Errorf("gagal simpan racikan: %w", err)
		}
		for _, det := range rac.Detail {
			_, err = tx.Exec(`INSERT INTO resep_pulang_racikan_detail (no_resep, no_racik, kode_brng, jml, kandungan) VALUES (?, ?, ?, ?, ?)`,
				noPerm, noRacik, det.KodeBrng, det.Jml, det.Kandungan)
			if err != nil {
				return fmt.Errorf("gagal simpan bahan racikan: %w", err)
			}
		}
	}
	return nil
}

func deleteRacikanPulang(tx *sql.Tx, noPerm string) error {
	if _, err := tx.Exec(`DELETE FROM resep_pulang_racikan_detail WHERE no_resep = ?`, noPerm); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM resep_pulang_racikan WHERE no_resep = ?`, noPerm); err != nil {
		return err
	}
	return nil
}

// ---------- Handlers ----------

// getResepPulang membaca resep pulang yang sudah divalidasi apotek (dari tabel resep_pulang)
func getResepPulang(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat required"})
			return
		}
		rows, err := db.Query(`
			SELECT rp.kode_brng, COALESCE(db.nama_brng, rp.kode_brng) as nama_brng,
				COALESCE(db.kode_sat,'') as kode_sat, rp.jml_barang, rp.harga, rp.total,
				rp.dosis, rp.tanggal, rp.jam
			FROM resep_pulang rp
			LEFT JOIN databarang db ON rp.kode_brng = db.kode_brng
			WHERE rp.no_rawat = ?
			ORDER BY rp.tanggal DESC, rp.jam DESC`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		var result []map[string]interface{}
		for rows.Next() {
			var kodeBrng, namaBrng, kodeSat, dosis, tanggal, jam string
			var jml, harga, total float64
			if err := rows.Scan(&kodeBrng, &namaBrng, &kodeSat, &jml, &harga, &total, &dosis, &tanggal, &jam); err != nil {
				continue
			}
			result = append(result, map[string]interface{}{
				"kode_brng": kodeBrng, "nama_brng": namaBrng, "kode_sat": kodeSat,
				"jml": jml, "harga": harga, "total": total,
				"dosis": dosis, "tanggal": tanggal, "jam": jam,
			})
		}
		if result == nil {
			result = []map[string]interface{}{}
		}
		c.JSON(http.StatusOK, result)
	}
}

func getResepPulangReq(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat required"})
			return
		}

		rows, err := db.Query(`
			SELECT
				ps.no_permintaan,
				COALESCE(CAST(ps.tgl_permintaan AS CHAR), '0000-00-00') as tgl_permintaan,
				COALESCE(CAST(ps.jam AS CHAR), '00:00:00') as jam,
				ps.no_rawat,
				ps.kd_dokter,
				COALESCE(d.nm_dokter, '') as nm_dokter,
				ps.status,
				COALESCE(CAST(ps.tgl_validasi AS CHAR), '0000-00-00') as tgl_validasi
			FROM permintaan_resep_pulang ps
			LEFT JOIN dokter d ON ps.kd_dokter = d.kd_dokter
			WHERE ps.no_rawat = ?
			ORDER BY ps.tgl_permintaan DESC, ps.jam DESC`, noRawat)
		if err != nil {
			log.Printf("getResepPulangReq error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []ResepPulangResult
		var keys []string
		resepMap := map[string]*ResepPulangResult{}

		for rows.Next() {
			var r ResepPulangResult
			if err := rows.Scan(&r.NoPermintaan, &r.TglPermintaan, &r.Jam, &r.NoRawat, &r.KdDokter, &r.NmDokter, &r.Status, &r.TglValidasi); err != nil {
				continue
			}
			r.Items = []ResepPulangItemResult{}
			r.Racikan = []RacikanPulangResult{}
			resepMap[r.NoPermintaan] = &r
			keys = append(keys, r.NoPermintaan)
		}
		rows.Close()

		if len(keys) == 0 {
			c.JSON(http.StatusOK, []ResepPulangResult{})
			return
		}

		placeholders := strings.Repeat("?,", len(keys))
		placeholders = placeholders[:len(placeholders)-1]
		args := make([]interface{}, len(keys))
		for i, v := range keys {
			args[i] = v
		}

		// Fetch non-racikan items
		itemRows, err := db.Query(fmt.Sprintf(`
			SELECT dp.no_permintaan, dp.kode_brng,
				COALESCE(db.nama_brng, dp.kode_brng) as nama_brng,
				COALESCE(db.kode_sat, '') as kode_sat,
				COALESCE(dp.jml, 0) as jml,
				COALESCE(dp.dosis, '') as dosis
			FROM detail_permintaan_resep_pulang dp
			LEFT JOIN databarang db ON dp.kode_brng = db.kode_brng
			WHERE dp.no_permintaan IN (%s)`, placeholders), args...)
		if err == nil {
			defer itemRows.Close()
			for itemRows.Next() {
				var noPerm string
				var it ResepPulangItemResult
				if err := itemRows.Scan(&noPerm, &it.KodeBrng, &it.NamaBrng, &it.KodeSat, &it.Jml, &it.Dosis); err != nil {
					continue
				}
				if r, ok := resepMap[noPerm]; ok {
					r.Items = append(r.Items, it)
				}
			}
		}

		// Fetch racikan headers (using no_permintaan as no_resep)
		racMap := map[string]map[string]*RacikanPulangResult{} // noPerm → noRacik → racikan
		racRows, err := db.Query(fmt.Sprintf(`
			SELECT rpr.no_resep, rpr.no_racik, rpr.nama_racik, rpr.kd_racik,
				COALESCE(mr.nm_racik, rpr.kd_racik) as nm_racik,
				rpr.jml_dr, rpr.aturan_pakai, rpr.keterangan
			FROM resep_pulang_racikan rpr
			LEFT JOIN metode_racik mr ON rpr.kd_racik = mr.kd_racik
			WHERE rpr.no_resep IN (%s)
			ORDER BY rpr.no_resep, rpr.no_racik`, placeholders), args...)
		if err == nil {
			defer racRows.Close()
			for racRows.Next() {
				var noPerm string
				var r RacikanPulangResult
				if err := racRows.Scan(&noPerm, &r.NoRacik, &r.NamaRacik, &r.KdRacik, &r.NmRacik, &r.JmlDr, &r.AturanPakai, &r.Keterangan); err != nil {
					continue
				}
				r.Detail = []RacikanPulangDetailResult{}
				if racMap[noPerm] == nil {
					racMap[noPerm] = map[string]*RacikanPulangResult{}
				}
				tmp := r
				racMap[noPerm][r.NoRacik] = &tmp
			}
		}

		// Fetch racikan detail (ingredients)
		detArgs := make([]interface{}, len(keys))
		copy(detArgs, args)
		detRows, err := db.Query(fmt.Sprintf(`
			SELECT rprd.no_resep, rprd.no_racik, rprd.kode_brng,
				COALESCE(db.nama_brng, rprd.kode_brng) as nama_brng,
				COALESCE(db.kode_sat, '') as kode_sat,
				COALESCE(rprd.jml, 0) as jml,
				COALESCE(rprd.kandungan, '') as kandungan
			FROM resep_pulang_racikan_detail rprd
			LEFT JOIN databarang db ON rprd.kode_brng = db.kode_brng
			WHERE rprd.no_resep IN (%s)`, placeholders), detArgs...)
		if err == nil {
			defer detRows.Close()
			for detRows.Next() {
				var noPerm, noRacik string
				var det RacikanPulangDetailResult
				if err := detRows.Scan(&noPerm, &noRacik, &det.KodeBrng, &det.NamaBrng, &det.KodeSat, &det.Jml, &det.Kandungan); err != nil {
					continue
				}
				if pm, ok := racMap[noPerm]; ok {
					if rac, ok := pm[noRacik]; ok {
						rac.Detail = append(rac.Detail, det)
					}
				}
			}
		}

		// Merge racikan into resepMap
		for noPerm, racByNo := range racMap {
			if r, ok := resepMap[noPerm]; ok {
				for _, noRacik := range sortedKeys(racByNo) {
					r.Racikan = append(r.Racikan, *racByNo[noRacik])
				}
			}
		}

		for _, k := range keys {
			if r, ok := resepMap[k]; ok {
				list = append(list, *r)
			}
		}
		if list == nil {
			list = []ResepPulangResult{}
		}
		c.JSON(http.StatusOK, list)
	}
}

func sortedKeys(m map[string]*RacikanPulangResult) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	// Simple sort for 2-char numeric keys like "01","02"
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[i] > keys[j] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	return keys
}

func saveResepPulangReq(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload SaveResepPulangPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if payload.NoRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		if len(payload.Items) == 0 && len(payload.Racikan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal satu obat atau racikan wajib diisi"})
			return
		}

		loc, _ := time.LoadLocation("Asia/Jakarta")
		now := time.Now().In(loc)
		tgl := now.Format("2006-01-02")
		jam := now.Format("15:04:05")

		noPerm, err := generateNoPermintaanResepPulang(db, tgl)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate no_permintaan"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		_, err = tx.Exec(`
			INSERT INTO permintaan_resep_pulang
				(no_permintaan, tgl_permintaan, jam, no_rawat, kd_dokter, status, tgl_validasi, jam_validasi)
			VALUES (?, ?, ?, ?, ?, 'Belum', '0000-00-00', '00:00:00')`,
			noPerm, tgl, jam, payload.NoRawat, payload.KdDokter,
		)
		if err != nil {
			log.Printf("insert permintaan_resep_pulang error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan permintaan: " + err.Error()})
			return
		}

		for _, item := range payload.Items {
			_, err = tx.Exec(`INSERT INTO detail_permintaan_resep_pulang (no_permintaan, kode_brng, jml, dosis) VALUES (?, ?, ?, ?)`,
				noPerm, item.KodeBrng, item.Jml, item.Dosis)
			if err != nil {
				log.Printf("insert detail_permintaan_resep_pulang error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan obat: " + err.Error()})
				return
			}
		}

		if err := insertRacikanPulang(tx, db, noPerm, payload.Racikan); err != nil {
			log.Printf("insert racikan pulang error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Resep pulang berhasil disimpan", "no_permintaan": noPerm})
	}
}

func updateResepPulangReq(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload UpdateResepPulangPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if payload.NoPermintaan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_permintaan wajib diisi"})
			return
		}
		if len(payload.Items) == 0 && len(payload.Racikan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal satu obat atau racikan wajib diisi"})
			return
		}

		var status string
		err := db.QueryRow(`SELECT status FROM permintaan_resep_pulang WHERE no_permintaan = ?`, payload.NoPermintaan).Scan(&status)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan tidak ditemukan"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if status == "Sudah" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Resep pulang sudah divalidasi apotek, tidak dapat diubah"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(`DELETE FROM detail_permintaan_resep_pulang WHERE no_permintaan = ?`, payload.NoPermintaan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus detail lama: " + err.Error()})
			return
		}
		if err := deleteRacikanPulang(tx, payload.NoPermintaan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus racikan lama: " + err.Error()})
			return
		}

		for _, item := range payload.Items {
			_, err = tx.Exec(`INSERT INTO detail_permintaan_resep_pulang (no_permintaan, kode_brng, jml, dosis) VALUES (?, ?, ?, ?)`,
				payload.NoPermintaan, item.KodeBrng, item.Jml, item.Dosis)
			if err != nil {
				log.Printf("update detail_permintaan_resep_pulang error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan obat: " + err.Error()})
				return
			}
		}

		if err := insertRacikanPulang(tx, db, payload.NoPermintaan, payload.Racikan); err != nil {
			log.Printf("update racikan pulang error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Resep pulang berhasil diperbarui", "no_permintaan": payload.NoPermintaan})
	}
}

func deleteResepPulangReq(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPerm := c.Query("no_permintaan")
		if noPerm == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_permintaan required"})
			return
		}

		var status string
		err := db.QueryRow(`SELECT status FROM permintaan_resep_pulang WHERE no_permintaan = ?`, noPerm).Scan(&status)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan tidak ditemukan"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if status == "Sudah" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Resep pulang sudah divalidasi apotek, tidak dapat dihapus"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(`DELETE FROM detail_permintaan_resep_pulang WHERE no_permintaan = ?`, noPerm); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if err := deleteRacikanPulang(tx, noPerm); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM permintaan_resep_pulang WHERE no_permintaan = ?`, noPerm); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Resep pulang berhasil dihapus"})
	}
}
