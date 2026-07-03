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

type ObatRanapResult struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	KodeSat   string  `json:"kode_sat"`
	Stok      float64 `json:"stok"`
	NoBatch   string  `json:"no_batch"`
	NoFaktur  string  `json:"no_faktur"`
	HargaJual float64 `json:"harga_jual"`
	HBeli     float64 `json:"h_beli"`
	Kapasitas float64 `json:"kapasitas"`
}

// Item non-racikan dari resep_dokter
type ResepNonRacikanItem struct {
	KodeBrng   string  `json:"kode_brng"`
	NamaBrng   string  `json:"nama_brng"`
	KodeSat    string  `json:"kode_sat"`
	Jml        float64 `json:"jml"`
	AturanPakai string `json:"aturan_pakai"`
}

// Header racikan dari resep_dokter_racikan
type ResepRacikanItem struct {
	NoRacik    string                    `json:"no_racik"`
	NamaRacik  string                    `json:"nama_racik"`
	KdRacik    string                    `json:"kd_racik"`
	NmRacik    string                    `json:"nm_racik"`
	JmlDr      int                       `json:"jml_dr"`
	AturanPakai string                   `json:"aturan_pakai"`
	Keterangan string                    `json:"keterangan"`
	Detail     []ResepRacikanDetailItem  `json:"detail"`
}

// Ingredient racikan dari resep_dokter_racikan_detail
type ResepRacikanDetailItem struct {
	KodeBrng  string  `json:"kode_brng"`
	NamaBrng  string  `json:"nama_brng"`
	KodeSat   string  `json:"kode_sat"`
	Jml       float64 `json:"jml"`
	Kandungan string  `json:"kandungan"`
}

type ResepRanapResult struct {
	NoResep      string                `json:"no_resep"`
	TglPeresepan string                `json:"tgl_peresepan"`
	JamPeresepan string                `json:"jam_peresepan"`
	NoRawat      string                `json:"no_rawat"`
	KdDokter     string                `json:"kd_dokter"`
	NmDokter     string                `json:"nm_dokter"`
	TglPerawatan string                `json:"tgl_perawatan"` // '0000-00-00' = belum tervalidasi
	NonRacikan   []ResepNonRacikanItem `json:"non_racikan"`
	Racikan      []ResepRacikanItem    `json:"racikan"`
}

// Payload dari frontend
type RacikanDetailPayload struct {
	KodeBrng  string  `json:"kode_brng"`
	Jml       float64 `json:"jml"`
	Kandungan string  `json:"kandungan"`
}

type RacikanPayload struct {
	NamaRacik   string                 `json:"nama_racikan"`
	KdRacik     string                 `json:"metode_racik"`
	JmlDr       int                    `json:"jml_dr"`
	AturanPakai string                 `json:"aturan_pakai"`
	Keterangan  string                 `json:"keterangan"`
	Detail      []RacikanDetailPayload `json:"detail"`
}

type NonRacikanPayload struct {
	KodeBrng   string  `json:"kode_brng"`
	Jml        float64 `json:"jml"`
	AturanPakai string `json:"aturan_pakai"`
}

type SaveResepRanapPayload struct {
	NoRawat    string              `json:"no_rawat"`
	KdDokter   string              `json:"kd_dokter"`
	NonRacikan []NonRacikanPayload `json:"non_racikan"`
	Racikan    []RacikanPayload    `json:"racikan"`
}

// kdApotek mengembalikan bangsal apotek utama — tempat stok obat ranap diambil.
func kdApotek(db *sql.DB) string {
	var kd string
	row := db.QueryRow(`
		SELECT kd_bangsal FROM gudangbarang
		WHERE kd_bangsal IN ('AP','GD')
		GROUP BY kd_bangsal
		ORDER BY SUM(stok) DESC
		LIMIT 1`)
	if err := row.Scan(&kd); err != nil || kd == "" {
		return "AP"
	}
	return kd
}

func searchObatRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := strings.TrimSpace(c.Query("search"))
		if search == "" {
			c.JSON(http.StatusOK, []ObatRanapResult{})
			return
		}

		apotek := kdApotek(db)
		like := "%" + search + "%"

		rows, err := db.Query(`
			SELECT
				db.kode_brng,
				db.nama_brng,
				COALESCE(db.kode_sat, '') as kode_sat,
				COALESCE(SUM(gb.stok), 0) as stok,
				COALESCE(MIN(NULLIF(gb.no_batch, '')), '') as no_batch,
				COALESCE(MIN(NULLIF(gb.no_faktur, '')), '') as no_faktur,
				COALESCE(db.kelas1, 0) as harga_jual,
				COALESCE(db.h_beli, 0) as h_beli,
				COALESCE(db.kapasitas, 0) as kapasitas
			FROM databarang db
			LEFT JOIN gudangbarang gb ON db.kode_brng = gb.kode_brng AND gb.kd_bangsal = ?
			WHERE db.status = '1'
			AND (db.nama_brng LIKE ? OR db.kode_brng LIKE ?)
			GROUP BY db.kode_brng, db.nama_brng, db.kode_sat, db.kelas1, db.h_beli, db.kapasitas
			ORDER BY stok DESC, db.nama_brng
			LIMIT 50`, apotek, like, like)
		if err != nil {
			log.Printf("searchObatRanap error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var results []ObatRanapResult
		for rows.Next() {
			var o ObatRanapResult
			if err := rows.Scan(&o.KodeBrng, &o.NamaBrng, &o.KodeSat, &o.Stok, &o.NoBatch, &o.NoFaktur, &o.HargaJual, &o.HBeli, &o.Kapasitas); err != nil {
				continue
			}
			results = append(results, o)
		}
		if results == nil {
			results = []ObatRanapResult{}
		}
		c.JSON(http.StatusOK, results)
	}
}

func getAturanPakai(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT DISTINCT aturan_pakai FROM resep_dokter
			WHERE aturan_pakai IS NOT NULL AND TRIM(aturan_pakai) != ''
			GROUP BY TRIM(aturan_pakai)
			ORDER BY COUNT(*) DESC
			LIMIT 20`)
		if err != nil {
			c.JSON(http.StatusOK, []string{})
			return
		}
		defer rows.Close()

		var list []string
		for rows.Next() {
			var s string
			if err := rows.Scan(&s); err == nil {
				list = append(list, strings.TrimSpace(s))
			}
		}
		if list == nil {
			list = []string{}
		}
		c.JSON(http.StatusOK, list)
	}
}

func getResepRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat required"})
			return
		}

		// Ambil header resep_obat ranap
		rows, err := db.Query(`
			SELECT
				ro.no_resep,
				COALESCE(CAST(ro.tgl_peresepan AS CHAR), '0000-00-00') as tgl_peresepan,
				COALESCE(CAST(ro.jam_peresepan AS CHAR), '00:00:00') as jam_peresepan,
				ro.no_rawat,
				ro.kd_dokter,
				COALESCE(d.nm_dokter, '') as nm_dokter,
				COALESCE(CAST(ro.tgl_perawatan AS CHAR), '0000-00-00') as tgl_perawatan
			FROM resep_obat ro
			LEFT JOIN dokter d ON ro.kd_dokter = d.kd_dokter
			WHERE ro.no_rawat = ? AND ro.status = 'ranap'
			ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC`, noRawat)
		if err != nil {
			log.Printf("getResepRanap header error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var resepList []ResepRanapResult
		noResepList := []string{}
		resepMap := map[string]*ResepRanapResult{}

		for rows.Next() {
			var r ResepRanapResult
			if err := rows.Scan(&r.NoResep, &r.TglPeresepan, &r.JamPeresepan, &r.NoRawat, &r.KdDokter, &r.NmDokter, &r.TglPerawatan); err != nil {
				continue
			}
			r.NonRacikan = []ResepNonRacikanItem{}
			r.Racikan = []ResepRacikanItem{}
			resepMap[r.NoResep] = &r
			noResepList = append(noResepList, r.NoResep)
		}
		rows.Close()

		if len(noResepList) == 0 {
			c.JSON(http.StatusOK, []ResepRanapResult{})
			return
		}

		// Ambil non-racikan dari resep_dokter
		placeholders := strings.Repeat("?,", len(noResepList))
		placeholders = placeholders[:len(placeholders)-1]
		args := make([]interface{}, len(noResepList))
		for i, v := range noResepList {
			args[i] = v
		}

		nrRows, err := db.Query(fmt.Sprintf(`
			SELECT rd.no_resep, rd.kode_brng,
				COALESCE(db.nama_brng, rd.kode_brng) as nama_brng,
				COALESCE(db.kode_sat, '') as kode_sat,
				COALESCE(rd.jml, 0) as jml,
				COALESCE(rd.aturan_pakai, '') as aturan_pakai
			FROM resep_dokter rd
			LEFT JOIN databarang db ON rd.kode_brng = db.kode_brng
			WHERE rd.no_resep IN (%s)`, placeholders), args...)
		if err != nil {
			log.Printf("getResepRanap non-racikan error: %v", err)
		} else {
			defer nrRows.Close()
			for nrRows.Next() {
				var noResep string
				var item ResepNonRacikanItem
				if err := nrRows.Scan(&noResep, &item.KodeBrng, &item.NamaBrng, &item.KodeSat, &item.Jml, &item.AturanPakai); err != nil {
					continue
				}
				if r, ok := resepMap[noResep]; ok {
					r.NonRacikan = append(r.NonRacikan, item)
				}
			}
		}

		// Ambil racikan header dari resep_dokter_racikan
		rackRows, err := db.Query(fmt.Sprintf(`
			SELECT rdr.no_resep, rdr.no_racik, rdr.nama_racik, rdr.kd_racik,
				COALESCE(mr.nm_racik, rdr.kd_racik) as nm_racik,
				rdr.jml_dr, rdr.aturan_pakai, rdr.keterangan
			FROM resep_dokter_racikan rdr
			LEFT JOIN metode_racik mr ON rdr.kd_racik = mr.kd_racik
			WHERE rdr.no_resep IN (%s)`, placeholders), args...)
		if err != nil {
			log.Printf("getResepRanap racikan error: %v", err)
		} else {
			defer rackRows.Close()
			for rackRows.Next() {
				var noResep string
				var item ResepRacikanItem
				if err := rackRows.Scan(&noResep, &item.NoRacik, &item.NamaRacik, &item.KdRacik, &item.NmRacik, &item.JmlDr, &item.AturanPakai, &item.Keterangan); err != nil {
					continue
				}
				item.Detail = []ResepRacikanDetailItem{}
				if r, ok := resepMap[noResep]; ok {
					r.Racikan = append(r.Racikan, item)
				}
			}
		}

		// Ambil racikan detail dari resep_dokter_racikan_detail
		rackDetRows, err := db.Query(fmt.Sprintf(`
			SELECT rdrd.no_resep, rdrd.no_racik, rdrd.kode_brng,
				COALESCE(db.nama_brng, rdrd.kode_brng) as nama_brng,
				COALESCE(db.kode_sat, '') as kode_sat,
				COALESCE(rdrd.jml, 0) as jml,
				COALESCE(rdrd.kandungan, '') as kandungan
			FROM resep_dokter_racikan_detail rdrd
			LEFT JOIN databarang db ON rdrd.kode_brng = db.kode_brng
			WHERE rdrd.no_resep IN (%s)`, placeholders), args...)
		if err != nil {
			log.Printf("getResepRanap racikan detail error: %v", err)
		} else {
			defer rackDetRows.Close()
			for rackDetRows.Next() {
				var noResep, noRacik string
				var det ResepRacikanDetailItem
				if err := rackDetRows.Scan(&noResep, &noRacik, &det.KodeBrng, &det.NamaBrng, &det.KodeSat, &det.Jml, &det.Kandungan); err != nil {
					continue
				}
				if r, ok := resepMap[noResep]; ok {
					for i := range r.Racikan {
						if r.Racikan[i].NoRacik == noRacik {
							r.Racikan[i].Detail = append(r.Racikan[i].Detail, det)
							break
						}
					}
				}
			}
		}

		for _, key := range noResepList {
			if r, ok := resepMap[key]; ok {
				resepList = append(resepList, *r)
			}
		}
		if resepList == nil {
			resepList = []ResepRanapResult{}
		}
		c.JSON(http.StatusOK, resepList)
	}
}

func generateNoResepRanap(db *sql.DB, tgl string) (string, error) {
	prefix := strings.ReplaceAll(tgl, "-", "")
	var maxResep sql.NullString
	err := db.QueryRow(`SELECT MAX(no_resep) FROM resep_obat WHERE no_resep LIKE ?`, prefix+"%").Scan(&maxResep)
	if err != nil || !maxResep.Valid {
		return fmt.Sprintf("%s0001", prefix), nil
	}
	s := maxResep.String
	if len(s) < 12 {
		return fmt.Sprintf("%s0001", prefix), nil
	}
	var seq int
	fmt.Sscanf(s[len(s)-4:], "%d", &seq)
	return fmt.Sprintf("%s%04d", prefix, seq+1), nil
}

func saveResepRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload SaveResepRanapPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if payload.NoRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		if len(payload.NonRacikan) == 0 && len(payload.Racikan) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "minimal satu obat harus diisi"})
			return
		}

		loc, _ := time.LoadLocation("Asia/Jakarta")
		now := time.Now().In(loc)
		tgl := now.Format("2006-01-02")
		jam := now.Format("15:04:05")

		noResep, err := generateNoResepRanap(db, tgl)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate no_resep"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		// Header resep_obat — tgl_perawatan='0000-00-00' berarti belum divalidasi apotek
		_, err = tx.Exec(`
			INSERT INTO resep_obat
				(no_resep, tgl_peresepan, jam_peresepan, no_rawat, kd_dokter, status,
				 tgl_perawatan, jam, tgl_penyerahan, jam_penyerahan)
			VALUES (?, ?, ?, ?, ?, 'ranap', '0000-00-00', '00:00:00', '0000-00-00', '00:00:00')`,
			noResep, tgl, jam, payload.NoRawat, payload.KdDokter,
		)
		if err != nil {
			log.Printf("insert resep_obat error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan resep: " + err.Error()})
			return
		}

		// Non-racikan → resep_dokter
		for _, item := range payload.NonRacikan {
			_, err = tx.Exec(`
				INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
				VALUES (?, ?, ?, ?)`,
				noResep, item.KodeBrng, item.Jml, item.AturanPakai,
			)
			if err != nil {
				log.Printf("insert resep_dokter error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan obat: " + err.Error()})
				return
			}
		}

		// Racikan → resep_dokter_racikan + resep_dokter_racikan_detail
		for idx, racik := range payload.Racikan {
			noRacik := fmt.Sprintf("%d", idx+1)
			namaRacik := racik.NamaRacik
			if namaRacik == "" {
				namaRacik = fmt.Sprintf("R%d", idx+1)
			}
			// Resolve kd_racik: jika frontend kirim nama ("Puyer", "Kapsul", dll), lookup ke metode_racik
			kdRacik := racik.KdRacik
			if len(kdRacik) > 3 {
				var found string
				if err := db.QueryRow(`SELECT kd_racik FROM metode_racik WHERE LOWER(nm_racik) = LOWER(?) LIMIT 1`, kdRacik).Scan(&found); err == nil {
					kdRacik = found
				} else {
					kdRacik = "R01"
				}
			}
			if kdRacik == "" {
				kdRacik = "R01"
			}

			_, err = tx.Exec(`
				INSERT INTO resep_dokter_racikan
					(no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				noResep, noRacik, namaRacik, kdRacik, racik.JmlDr, racik.AturanPakai, racik.Keterangan,
			)
			if err != nil {
				log.Printf("insert resep_dokter_racikan error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan racikan: " + err.Error()})
				return
			}

			for _, det := range racik.Detail {
				_, err = tx.Exec(`
					INSERT INTO resep_dokter_racikan_detail
						(no_resep, no_racik, kode_brng, jml, kandungan)
					VALUES (?, ?, ?, ?, ?)`,
					noResep, noRacik, det.KodeBrng, det.Jml, det.Kandungan,
				)
				if err != nil {
					log.Printf("insert resep_dokter_racikan_detail error: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan detail racikan: " + err.Error()})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Resep berhasil disimpan", "no_resep": noResep})
	}
}

func deleteResepRanap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noResep := c.Query("no_resep")
		if noResep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_resep required"})
			return
		}

		// Cek status — jangan hapus yang sudah divalidasi apotek
		var tglPerawatan string
		err := db.QueryRow(`SELECT tgl_perawatan FROM resep_obat WHERE no_resep = ? AND status = 'ranap'`, noResep).Scan(&tglPerawatan)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Resep tidak ditemukan"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tglPerawatan != "0000-00-00" && tglPerawatan != "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Resep sudah divalidasi apotek, tidak dapat dihapus"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(`DELETE FROM resep_dokter_racikan_detail WHERE no_resep = ?`, noResep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM resep_dokter_racikan WHERE no_resep = ?`, noResep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM resep_dokter WHERE no_resep = ?`, noResep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if _, err := tx.Exec(`DELETE FROM resep_obat WHERE no_resep = ?`, noResep); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Resep berhasil dihapus"})
	}
}
