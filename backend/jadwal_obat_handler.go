package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// JADWAL OBAT — pengganti digital Formulir Pemberian Obat RM.14 (kertas),
// dipakai di RawatInap.tsx (tombol "Jadwal Obat" per pasien terpilih).
//
// Jam pemberian per frekuensi (1x1..6x1) FIXED, dikonfirmasi persis dari
// foto kertas RM.14 RS — bukan tebakan. Nurse pilih frekuensi, jam otomatis
// muncul dari tabel ini dan TIDAK bisa diubah manual per pasien (sesuai SOP
// di kertas: "Jadwal ini tidak berlaku untuk antibiotik injeksi").
// ============================================================================

var jadwalObatJamMap = map[string][]string{
	"1x1": {"06:00-07:00"},
	"2x1": {"06:00-07:00", "18:00-19:00"},
	"3x1": {"06:00-07:00", "12:00-13:00", "18:00-19:00"},
	"4x1": {"06:00-07:00", "10:00-11:00", "13:00-14:00", "18:00-19:00"},
	"5x1": {"05:00-06:00", "09:00-10:00", "12:00-13:00", "15:00-16:00", "18:00-19:00"},
	"6x1": {"09:00-10:00", "13:00-14:00", "17:00-18:00", "20:00-21:00", "23:00-24:00", "01:00-02:00"},
}

// Urutan tetap biar frontend bisa render dropdown frekuensi konsisten.
var jadwalObatFrekuensiOrder = []string{"1x1", "2x1", "3x1", "4x1", "5x1", "6x1"}

func ensureJadwalObatTable(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS jadwal_obat (
			id INT AUTO_INCREMENT PRIMARY KEY,
			no_rawat VARCHAR(20) NOT NULL,
			nama_obat VARCHAR(255) NOT NULL,
			sumber VARCHAR(10) NOT NULL DEFAULT 'manual',
			frekuensi VARCHAR(10) NOT NULL,
			tgl_mulai DATE NOT NULL,
			status VARCHAR(15) NOT NULL DEFAULT 'aktif',
			created_by VARCHAR(100) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_no_rawat (no_rawat)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`); err != nil {
		return fmt.Errorf("gagal bikin tabel jadwal_obat: %v", err)
	}

	// jadwal_obat_tanda — cuma diisi (INSERT) saat perawat betulan menandai
	// V/T/K/A satu slot; slot yg belum ditandai TIDAK punya baris di sini
	// (dianggap kosong oleh frontend), jadi tabel tidak perlu di-seed
	// puluhan baris kosong per hari.
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS jadwal_obat_tanda (
			id INT AUTO_INCREMENT PRIMARY KEY,
			jadwal_obat_id INT NOT NULL,
			tanggal DATE NOT NULL,
			slot_index TINYINT NOT NULL,
			tanda VARCHAR(1) NOT NULL,
			catatan VARCHAR(255) NOT NULL DEFAULT '',
			marked_by VARCHAR(100) NOT NULL DEFAULT '',
			marked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_slot (jadwal_obat_id, tanggal, slot_index),
			INDEX idx_jadwal (jadwal_obat_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`); err != nil {
		return fmt.Errorf("gagal bikin tabel jadwal_obat_tanda: %v", err)
	}

	// jadwal_obat_alergi — kolom "ALERGI OBAT" di kertas RM.14: daftar nama
	// obat yg diketahui bikin alergi pasien ini, dipilih dari modal Resep
	// yg sama dgn "Dari Resep" (bukan free-text). 1 baris per obat, bisa
	// lebih dari satu. Sengaja tabel terpisah dari pemeriksaan_ranap.alergi
	// (punya modul SOAP/Asuhan Medis sendiri) biar tombol "Input Alergi" di
	// sini tidak menimpa data modul lain.
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS jadwal_obat_alergi (
			id INT AUTO_INCREMENT PRIMARY KEY,
			no_rawat VARCHAR(20) NOT NULL,
			nama_obat VARCHAR(255) NOT NULL,
			created_by VARCHAR(100) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_no_rawat (no_rawat)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`); err != nil {
		return fmt.Errorf("gagal bikin tabel jadwal_obat_alergi: %v", err)
	}

	return nil
}

type JadwalObatTandaCell struct {
	Tanda    string `json:"tanda"`
	Catatan  string `json:"catatan"`
	MarkedBy string `json:"marked_by"`
	MarkedAt string `json:"marked_at"`
}

type JadwalObatItem struct {
	ID        int      `json:"id"`
	NoRawat   string   `json:"no_rawat"`
	NamaObat  string   `json:"nama_obat"`
	Sumber    string   `json:"sumber"`
	Frekuensi string   `json:"frekuensi"`
	TglMulai  string   `json:"tgl_mulai"`
	Status    string   `json:"status"`
	CreatedBy string   `json:"created_by"`
	JamList   []string `json:"jam_list"`
	// Tanda — tanggal (YYYY-MM-DD) -> slot_index -> cell. Slot yg belum
	// ditandai tidak ada di map ini (frontend render kosong/klik utk isi).
	Tanda map[string]map[int]JadwalObatTandaCell `json:"tanda"`
}

// getJadwalObatFrekuensiRef — GET /api/jadwal-obat/frekuensi-ref, dipakai
// frontend utk render tabel acuan jam & dropdown frekuensi tanpa duplikat
// tabel ini di TypeScript (satu sumber kebenaran: backend).
func getJadwalObatFrekuensiRef(c *gin.Context) {
	type refItem struct {
		Frekuensi string   `json:"frekuensi"`
		JamList   []string `json:"jam_list"`
	}
	result := make([]refItem, 0, len(jadwalObatFrekuensiOrder))
	for _, f := range jadwalObatFrekuensiOrder {
		result = append(result, refItem{Frekuensi: f, JamList: jadwalObatJamMap[f]})
	}
	c.JSON(http.StatusOK, result)
}

func getJadwalObatList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))

		rows, err := db.Query(`
			SELECT id, no_rawat, nama_obat, sumber, frekuensi, tgl_mulai, status, created_by
			FROM jadwal_obat
			WHERE no_rawat = ?
			ORDER BY status = 'aktif' DESC, created_at DESC
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil daftar obat: " + err.Error()})
			return
		}

		items := []JadwalObatItem{}
		idToIdx := map[int]int{}
		for rows.Next() {
			var it JadwalObatItem
			var tglMulai time.Time
			if err := rows.Scan(&it.ID, &it.NoRawat, &it.NamaObat, &it.Sumber, &it.Frekuensi, &tglMulai, &it.Status, &it.CreatedBy); err != nil {
				continue
			}
			it.TglMulai = tglMulai.Format("2006-01-02")
			it.JamList = jadwalObatJamMap[it.Frekuensi]
			it.Tanda = map[string]map[int]JadwalObatTandaCell{}
			idToIdx[it.ID] = len(items)
			items = append(items, it)
		}
		rows.Close()

		if len(items) == 0 {
			c.JSON(http.StatusOK, items)
			return
		}

		// Ambil semua tanda dalam rentang tanggal sekaligus (1 query),
		// bukan per-obat, biar tidak N+1.
		tandaRows, err := db.Query(`
			SELECT jadwal_obat_id, tanggal, slot_index, tanda, catatan, marked_by, marked_at
			FROM jadwal_obat_tanda
			WHERE jadwal_obat_id IN (SELECT id FROM jadwal_obat WHERE no_rawat = ?)
			  AND tanggal BETWEEN ? AND ?
		`, noRawat, tglDari, tglSampai)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil tanda obat: " + err.Error()})
			return
		}
		defer tandaRows.Close()

		for tandaRows.Next() {
			var jadwalObatID, slotIndex int
			var tanggal, markedAt time.Time
			var cell JadwalObatTandaCell
			if err := tandaRows.Scan(&jadwalObatID, &tanggal, &slotIndex, &cell.Tanda, &cell.Catatan, &cell.MarkedBy, &markedAt); err != nil {
				continue
			}
			idx, ok := idToIdx[jadwalObatID]
			if !ok {
				continue
			}
			cell.MarkedAt = markedAt.Format("2006-01-02 15:04:05")
			tglKey := tanggal.Format("2006-01-02")
			if items[idx].Tanda[tglKey] == nil {
				items[idx].Tanda[tglKey] = map[int]JadwalObatTandaCell{}
			}
			items[idx].Tanda[tglKey][slotIndex] = cell
		}

		c.JSON(http.StatusOK, items)
	}
}

type CreateJadwalObatPayload struct {
	NoRawat   string `json:"no_rawat" binding:"required"`
	NamaObat  string `json:"nama_obat" binding:"required"`
	Sumber    string `json:"sumber"` // 'resep' | 'manual'
	Frekuensi string `json:"frekuensi" binding:"required"`
	TglMulai  string `json:"tgl_mulai"`
	CreatedBy string `json:"created_by"`
}

func createJadwalObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateJadwalObatPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
			return
		}
		if _, ok := jadwalObatJamMap[req.Frekuensi]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Frekuensi tidak dikenal: " + req.Frekuensi})
			return
		}
		if req.Sumber != "resep" {
			req.Sumber = "manual"
		}
		if req.TglMulai == "" {
			req.TglMulai = time.Now().Format("2006-01-02")
		}

		res, err := db.Exec(`
			INSERT INTO jadwal_obat (no_rawat, nama_obat, sumber, frekuensi, tgl_mulai, created_by)
			VALUES (?, ?, ?, ?, ?, ?)
		`, req.NoRawat, req.NamaObat, req.Sumber, req.Frekuensi, req.TglMulai, req.CreatedBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan jadwal obat: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		c.JSON(http.StatusCreated, gin.H{"id": id, "jam_list": jadwalObatJamMap[req.Frekuensi]})
	}
}

// hentikanJadwalObat — soft-stop (bukan hapus permanen), histori tanda
// tetap tersimpan utuh.
func hentikanJadwalObat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec(`UPDATE jadwal_obat SET status = 'dihentikan' WHERE id = ?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hentikan obat: " + err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}

type MarkJadwalObatTandaPayload struct {
	JadwalObatID int    `json:"jadwal_obat_id" binding:"required"`
	Tanggal      string `json:"tanggal" binding:"required"`
	SlotIndex    int    `json:"slot_index"`
	Tanda        string `json:"tanda" binding:"required"` // V/T/K/A
	Catatan      string `json:"catatan"`
	MarkedBy     string `json:"marked_by"`
}

func markJadwalObatTanda(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MarkJadwalObatTandaPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
			return
		}
		validTanda := map[string]bool{"V": true, "T": true, "K": true, "A": true}
		if !validTanda[req.Tanda] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanda harus salah satu dari V/T/K/A"})
			return
		}

		_, err := db.Exec(`
			INSERT INTO jadwal_obat_tanda (jadwal_obat_id, tanggal, slot_index, tanda, catatan, marked_by)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE tanda = VALUES(tanda), catatan = VALUES(catatan), marked_by = VALUES(marked_by), marked_at = CURRENT_TIMESTAMP
		`, req.JadwalObatID, req.Tanggal, req.SlotIndex, req.Tanda, req.Catatan, req.MarkedBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan tanda: " + err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}

// unmarkJadwalObatTanda — hapus tanda satu slot (batalkan tanda yg salah
// input), dipakai tombol "Hapus tanda" di sel yg sudah ditandai.
func unmarkJadwalObatTanda(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		jadwalObatID := c.Query("jadwal_obat_id")
		tanggal := c.Query("tanggal")
		slotIndex := c.Query("slot_index")
		if jadwalObatID == "" || tanggal == "" || slotIndex == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "jadwal_obat_id, tanggal, slot_index wajib diisi"})
			return
		}
		if _, err := db.Exec(`
			DELETE FROM jadwal_obat_tanda WHERE jadwal_obat_id = ? AND tanggal = ? AND slot_index = ?
		`, jadwalObatID, tanggal, slotIndex); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus tanda: " + err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}

type JadwalObatAlergiItem struct {
	ID        int    `json:"id"`
	NoRawat   string `json:"no_rawat"`
	NamaObat  string `json:"nama_obat"`
	CreatedBy string `json:"created_by"`
	CreatedAt string `json:"created_at"`
}

func getJadwalObatAlergiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		rows, err := db.Query(`
			SELECT id, no_rawat, nama_obat, created_by, created_at
			FROM jadwal_obat_alergi WHERE no_rawat = ? ORDER BY created_at DESC
		`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil daftar alergi: " + err.Error()})
			return
		}
		defer rows.Close()

		items := []JadwalObatAlergiItem{}
		for rows.Next() {
			var it JadwalObatAlergiItem
			var createdAt time.Time
			if err := rows.Scan(&it.ID, &it.NoRawat, &it.NamaObat, &it.CreatedBy, &createdAt); err != nil {
				continue
			}
			it.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
			items = append(items, it)
		}
		c.JSON(http.StatusOK, items)
	}
}

type AddJadwalObatAlergiPayload struct {
	NoRawat   string `json:"no_rawat" binding:"required"`
	NamaObat  string `json:"nama_obat" binding:"required"`
	CreatedBy string `json:"created_by"`
}

func addJadwalObatAlergi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AddJadwalObatAlergiPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
			return
		}
		res, err := db.Exec(`
			INSERT INTO jadwal_obat_alergi (no_rawat, nama_obat, created_by) VALUES (?, ?, ?)
		`, req.NoRawat, req.NamaObat, req.CreatedBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan alergi: " + err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

// hapusJadwalObatAlergi — hapus 1 baris alergi (salah pilih obat).
func hapusJadwalObatAlergi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec(`DELETE FROM jadwal_obat_alergi WHERE id = ?`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus alergi: " + err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}
