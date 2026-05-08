package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Struktur data antrian
type AntrianPoli struct {
	ID            int       `json:"id"`
	NoAntrian     string    `json:"no_antrian"`
	NoRkmMedis    string    `json:"no_rkm_medis"`
	NmPasien      string    `json:"nm_pasien"`
	KdPoli        string    `json:"kd_poli"`
	NmPoli        string    `json:"nm_poli"`
	Status        string    `json:"status"` // waiting, called, serving, done, cancelled
	TglAntrian    string    `json:"tgl_antrian"`
	JamDaftar     string    `json:"jam_daftar"`
	JamDipanggil  *string   `json:"jam_dipanggil"`
	DipangggilOleh *string  `json:"dipanggil_oleh"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Request body untuk memanggil antrian
type CallAntrianRequest struct {
	KdPoli        string `json:"kd_poli" binding:"required"`
	PetugasNIP    string `json:"petugas_nip" binding:"required"`
	PetugasNama   string `json:"petugas_nama" binding:"required"`
}

// Ensure table antrian_poli exists
func ensureAntrianPoliTable(db *sql.DB) error {
	// 1. Create table
	query := `
	CREATE TABLE IF NOT EXISTS antrian_poli (
		id INT AUTO_INCREMENT PRIMARY KEY,
		no_antrian VARCHAR(20) NOT NULL,
		no_rkm_medis VARCHAR(15) NOT NULL,
		nm_pasien VARCHAR(100) NOT NULL,
		kd_poli VARCHAR(10) NOT NULL,
		nm_poli VARCHAR(50) NOT NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'waiting',
		tgl_antrian DATE NOT NULL,
		jam_daftar TIME NOT NULL,
		jam_dipanggil DATETIME NULL,
		dipanggil_oleh VARCHAR(100) NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_poli_status (kd_poli, status),
		INDEX idx_tgl_poli (tgl_antrian, kd_poli),
		INDEX idx_status (status),
		INDEX idx_no_rkm (no_rkm_medis)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(query)
	if err != nil {
		return fmt.Errorf("error creating antrian_poli table: %v", err)
	}

	// 2. Create trigger untuk auto-insert antrian saat registrasi
	// Drop trigger jika sudah ada
	db.Exec("DROP TRIGGER IF EXISTS trg_after_reg_periksa_insert")

	triggerQuery := `
	CREATE TRIGGER trg_after_reg_periksa_insert
	AFTER INSERT ON reg_periksa
	FOR EACH ROW
	BEGIN
		DECLARE v_nm_pasien VARCHAR(100);
		DECLARE v_nm_poli VARCHAR(50);
		DECLARE v_no_antrian VARCHAR(20);
		DECLARE v_urut INT;

		-- Hanya untuk rawat jalan (status_lanjut = 'Ralan')
		IF NEW.status_lanjut = 'Ralan' THEN
			-- Ambil nama pasien
			SELECT nm_pasien INTO v_nm_pasien
			FROM pasien
			WHERE no_rkm_medis = NEW.no_rkm_medis
			LIMIT 1;

			-- Ambil nama poli
			SELECT nm_poli INTO v_nm_poli
			FROM poliklinik
			WHERE kd_poli = NEW.kd_poli
			LIMIT 1;

			-- Generate nomor antrian
			-- Format: huruf pertama poli + nomor urut (A-001, S-005, dll)
			SELECT IFNULL(MAX(CAST(SUBSTRING(no_antrian, 3) AS UNSIGNED)), 0) + 1
			INTO v_urut
			FROM antrian_poli
			WHERE kd_poli = NEW.kd_poli
			  AND tgl_antrian = NEW.tgl_registrasi;

			-- Generate format: A-001, S-001, dll
			SET v_no_antrian = CONCAT(
				UPPER(SUBSTRING(v_nm_poli, 1, 1)),
				'-',
				LPAD(v_urut, 3, '0')
			);

			-- Insert ke antrian_poli
			INSERT INTO antrian_poli (
				no_antrian,
				no_rkm_medis,
				nm_pasien,
				kd_poli,
				nm_poli,
				status,
				tgl_antrian,
				jam_daftar
			) VALUES (
				v_no_antrian,
				NEW.no_rkm_medis,
				v_nm_pasien,
				NEW.kd_poli,
				v_nm_poli,
				'waiting',
				NEW.tgl_registrasi,
				NEW.jam_reg
			);
		END IF;
	END;
	`
	_, err = db.Exec(triggerQuery)
	if err != nil {
		// Jika trigger gagal, log saja tapi tidak fatal
		log.Printf("Warning: gagal membuat trigger antrian (mungkin permission): %v", err)
		log.Printf("Sistem tetap berjalan, tapi antrian harus digenerate manual")
	} else {
		log.Println("✓ Trigger auto-create antrian berhasil dibuat")
	}

	return nil
}

// GET /api/antrian/poli/:kd_poli/display
// Mendapatkan data untuk display antrian (1 aktif yang dipanggil + list waiting)
func getAntrianPoliDisplay(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPoli := c.Param("kd_poli")
		today := time.Now().Format("2006-01-02")

		// Get antrian yang sedang dipanggil (called atau serving)
		var activeAntrian *AntrianPoli
		activeQuery := `
			SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_poli
			WHERE kd_poli = ? AND tgl_antrian = ? AND status IN ('called', 'serving')
			ORDER BY jam_dipanggil DESC
			LIMIT 1
		`
		row := db.QueryRow(activeQuery, kdPoli, today)
		var antrian AntrianPoli
		err := row.Scan(
			&antrian.ID, &antrian.NoAntrian, &antrian.NoRkmMedis, &antrian.NmPasien,
			&antrian.KdPoli, &antrian.NmPoli, &antrian.Status, &antrian.TglAntrian,
			&antrian.JamDaftar, &antrian.JamDipanggil, &antrian.DipangggilOleh,
			&antrian.CreatedAt, &antrian.UpdatedAt,
		)
		if err == nil {
			activeAntrian = &antrian
		}

		// Get list antrian yang waiting
		waitingQuery := `
			SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_poli
			WHERE kd_poli = ? AND tgl_antrian = ? AND status = 'waiting'
			ORDER BY jam_daftar ASC
		`
		rows, err := db.Query(waitingQuery, kdPoli, today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		waitingList := []AntrianPoli{}
		for rows.Next() {
			var a AntrianPoli
			err := rows.Scan(
				&a.ID, &a.NoAntrian, &a.NoRkmMedis, &a.NmPasien,
				&a.KdPoli, &a.NmPoli, &a.Status, &a.TglAntrian,
				&a.JamDaftar, &a.JamDipanggil, &a.DipangggilOleh,
				&a.CreatedAt, &a.UpdatedAt,
			)
			if err != nil {
				continue
			}
			waitingList = append(waitingList, a)
		}

		c.JSON(http.StatusOK, gin.H{
			"active":  activeAntrian,
			"waiting": waitingList,
		})
	}
}

// GET /api/antrian/poli/all-display
// Mendapatkan data untuk display semua poli (untuk carousel)
func getAllPoliAntrianDisplay(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		today := time.Now().Format("2006-01-02")

		// Get semua poli yang ada antrian hari ini
		query := `
			SELECT DISTINCT kd_poli, nm_poli
			FROM antrian_poli
			WHERE tgl_antrian = ?
			ORDER BY kd_poli
		`
		rows, err := db.Query(query, today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type PoliAntrian struct {
			KdPoli     string         `json:"kd_poli"`
			NmPoli     string         `json:"nm_poli"`
			Active     *AntrianPoli   `json:"active"`
			Waiting    []AntrianPoli  `json:"waiting"`
		}

		poliList := []PoliAntrian{}
		for rows.Next() {
			var kdPoli, nmPoli string
			if err := rows.Scan(&kdPoli, &nmPoli); err != nil {
				continue
			}

			// Get active antrian untuk poli ini
			var activeAntrian *AntrianPoli
			activeQuery := `
				SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
				       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
				       created_at, updated_at
				FROM antrian_poli
				WHERE kd_poli = ? AND tgl_antrian = ? AND status IN ('called', 'serving')
				ORDER BY jam_dipanggil DESC
				LIMIT 1
			`
			row := db.QueryRow(activeQuery, kdPoli, today)
			var antrian AntrianPoli
			err := row.Scan(
				&antrian.ID, &antrian.NoAntrian, &antrian.NoRkmMedis, &antrian.NmPasien,
				&antrian.KdPoli, &antrian.NmPoli, &antrian.Status, &antrian.TglAntrian,
				&antrian.JamDaftar, &antrian.JamDipanggil, &antrian.DipangggilOleh,
				&antrian.CreatedAt, &antrian.UpdatedAt,
			)
			if err == nil {
				activeAntrian = &antrian
			}

			// Get waiting antrian untuk poli ini
			waitingQuery := `
				SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
				       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
				       created_at, updated_at
				FROM antrian_poli
				WHERE kd_poli = ? AND tgl_antrian = ? AND status = 'waiting'
				ORDER BY jam_daftar ASC
				LIMIT 5
			`
			waitingRows, err := db.Query(waitingQuery, kdPoli, today)
			if err != nil {
				continue
			}

			waitingList := []AntrianPoli{}
			for waitingRows.Next() {
				var a AntrianPoli
				err := waitingRows.Scan(
					&a.ID, &a.NoAntrian, &a.NoRkmMedis, &a.NmPasien,
					&a.KdPoli, &a.NmPoli, &a.Status, &a.TglAntrian,
					&a.JamDaftar, &a.JamDipanggil, &a.DipangggilOleh,
					&a.CreatedAt, &a.UpdatedAt,
				)
				if err != nil {
					continue
				}
				waitingList = append(waitingList, a)
			}
			waitingRows.Close()

			poliList = append(poliList, PoliAntrian{
				KdPoli:  kdPoli,
				NmPoli:  nmPoli,
				Active:  activeAntrian,
				Waiting: waitingList,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"poli_list": poliList,
		})
	}
}

// GET /api/antrian/poli/:kd_poli/waiting
// Mendapatkan list antrian yang menunggu untuk panel petugas
func getWaitingAntrian(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kdPoli := c.Param("kd_poli")
		today := time.Now().Format("2006-01-02")

		query := `
			SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_poli
			WHERE kd_poli = ? AND tgl_antrian = ? AND status = 'waiting'
			ORDER BY jam_daftar ASC
		`
		rows, err := db.Query(query, kdPoli, today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		antrianList := []AntrianPoli{}
		for rows.Next() {
			var a AntrianPoli
			err := rows.Scan(
				&a.ID, &a.NoAntrian, &a.NoRkmMedis, &a.NmPasien,
				&a.KdPoli, &a.NmPoli, &a.Status, &a.TglAntrian,
				&a.JamDaftar, &a.JamDipanggil, &a.DipangggilOleh,
				&a.CreatedAt, &a.UpdatedAt,
			)
			if err != nil {
				continue
			}
			antrianList = append(antrianList, a)
		}

		c.JSON(http.StatusOK, gin.H{
			"antrian": antrianList,
		})
	}
}

// POST /api/antrian/poli/call-next
// Memanggil antrian berikutnya
func callNextAntrian(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CallAntrianRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		today := time.Now().Format("2006-01-02")
		now := time.Now()

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
			return
		}
		defer tx.Rollback()

		// 1. Update antrian yang sedang dipanggil menjadi 'done'
		_, err = tx.Exec(`
			UPDATE antrian_poli
			SET status = 'done', updated_at = NOW()
			WHERE kd_poli = ? AND tgl_antrian = ? AND status IN ('called', 'serving')
		`, req.KdPoli, today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update previous queue"})
			return
		}

		// 2. Ambil antrian berikutnya yang waiting
		var nextAntrian AntrianPoli
		row := tx.QueryRow(`
			SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_poli
			WHERE kd_poli = ? AND tgl_antrian = ? AND status = 'waiting'
			ORDER BY jam_daftar ASC
			LIMIT 1
		`, req.KdPoli, today)

		err = row.Scan(
			&nextAntrian.ID, &nextAntrian.NoAntrian, &nextAntrian.NoRkmMedis, &nextAntrian.NmPasien,
			&nextAntrian.KdPoli, &nextAntrian.NmPoli, &nextAntrian.Status, &nextAntrian.TglAntrian,
			&nextAntrian.JamDaftar, &nextAntrian.JamDipanggil, &nextAntrian.DipangggilOleh,
			&nextAntrian.CreatedAt, &nextAntrian.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			tx.Rollback()
			c.JSON(http.StatusOK, gin.H{
				"message": "Tidak ada antrian yang menunggu",
				"antrian": nil,
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get next queue"})
			return
		}

		// 3. Update status antrian menjadi 'called'
		jamDipanggil := now.Format("2006-01-02 15:04:05")
		dipanggilOleh := fmt.Sprintf("%s - %s", req.PetugasNIP, req.PetugasNama)

		_, err = tx.Exec(`
			UPDATE antrian_poli
			SET status = 'called',
			    jam_dipanggil = ?,
			    dipanggil_oleh = ?,
			    updated_at = NOW()
			WHERE id = ?
		`, jamDipanggil, dipanggilOleh, nextAntrian.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to call queue"})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
			return
		}

		// Update data untuk response
		nextAntrian.Status = "called"
		nextAntrian.JamDipanggil = &jamDipanggil
		nextAntrian.DipangggilOleh = &dipanggilOleh

		c.JSON(http.StatusOK, gin.H{
			"message": "Antrian berhasil dipanggil",
			"antrian": nextAntrian,
		})
	}
}

// PUT /api/antrian/poli/:id/status
// Update status antrian (untuk mark sebagai serving atau done)
func updateAntrianStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate status
		validStatuses := map[string]bool{
			"waiting":   true,
			"called":    true,
			"serving":   true,
			"done":      true,
			"cancelled": true,
		}
		if !validStatuses[req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
			return
		}

		_, err := db.Exec(`
			UPDATE antrian_poli
			SET status = ?, updated_at = NOW()
			WHERE id = ?
		`, req.Status, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Status antrian berhasil diupdate",
		})
	}
}

// POST /api/antrian/poli/generate-from-registrasi
// Generate antrian dari data registrasi hari ini (untuk testing)
func generateAntrianFromRegistrasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		today := time.Now().Format("2006-01-02")

		// Hapus antrian hari ini dulu (untuk fresh start)
		_, err := db.Exec("DELETE FROM antrian_poli WHERE tgl_antrian = ?", today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear old queue"})
			return
		}

		// Generate antrian dari reg_periksa hari ini
		query := `
			INSERT INTO antrian_poli
				(no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli, status, tgl_antrian, jam_daftar)
			SELECT
				CONCAT(UPPER(SUBSTR(p.nm_poli, 1, 1)), '-',
					LPAD(ROW_NUMBER() OVER (PARTITION BY r.kd_poli ORDER BY r.jam_reg), 3, '0')) as no_antrian,
				r.no_rkm_medis,
				pas.nm_pasien,
				r.kd_poli,
				p.nm_poli,
				'waiting' as status,
				r.tgl_registrasi,
				r.jam_reg
			FROM reg_periksa r
			JOIN pasien pas ON r.no_rkm_medis = pas.no_rkm_medis
			JOIN poliklinik p ON r.kd_poli = p.kd_poli
			WHERE r.tgl_registrasi = ? AND r.status_lanjut = 'Ralan'
			ORDER BY r.kd_poli, r.jam_reg
		`
		result, err := db.Exec(query, today)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		affected, _ := result.RowsAffected()

		c.JSON(http.StatusOK, gin.H{
			"message": "Antrian berhasil digenerate dari registrasi",
			"count":   affected,
		})
	}
}

// POST /api/antrian/poli/call-patient
// Memanggil pasien spesifik berdasarkan no_rkm_medis (untuk dokter yang klik nomor antrian)
func callSpecificPatient(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoRkmMedis    string `json:"no_rkm_medis" binding:"required"`
			KdPoli        string `json:"kd_poli" binding:"required"`
			PetugasNIP    string `json:"petugas_nip" binding:"required"`
			PetugasNama   string `json:"petugas_nama" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		today := time.Now().Format("2006-01-02")
		now := time.Now()

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
			return
		}
		defer tx.Rollback()

		// 1. Cari antrian pasien yang diminta (bisa waiting, called, atau serving)
		// Pasien bisa dipanggil berulang kali sampai status menjadi 'done'
		var antrian AntrianPoli
		row := tx.QueryRow(`
			SELECT id, no_antrian, no_rkm_medis, nm_pasien, kd_poli, nm_poli,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_poli
			WHERE no_rkm_medis = ? AND kd_poli = ? AND tgl_antrian = ?
			  AND status IN ('waiting', 'called', 'serving')
			LIMIT 1
		`, req.NoRkmMedis, req.KdPoli, today)

		err = row.Scan(
			&antrian.ID, &antrian.NoAntrian, &antrian.NoRkmMedis, &antrian.NmPasien,
			&antrian.KdPoli, &antrian.NmPoli, &antrian.Status, &antrian.TglAntrian,
			&antrian.JamDaftar, &antrian.JamDipanggil, &antrian.DipangggilOleh,
			&antrian.CreatedAt, &antrian.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Pasien tidak ditemukan dalam antrian atau sudah selesai (done)",
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get patient queue"})
			return
		}

		// 2. Update status antrian menjadi 'called' dan update jam dipanggil
		//    (Pasien bisa dipanggil berulang kali, jam_dipanggil akan terus diupdate)
		jamDipanggil := now.Format("2006-01-02 15:04:05")
		dipanggilOleh := fmt.Sprintf("%s - %s", req.PetugasNIP, req.PetugasNama)

		_, err = tx.Exec(`
			UPDATE antrian_poli
			SET status = 'called',
			    jam_dipanggil = ?,
			    dipanggil_oleh = ?,
			    updated_at = NOW()
			WHERE id = ?
		`, jamDipanggil, dipanggilOleh, antrian.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to call patient"})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
			return
		}

		// Update data untuk response
		antrian.Status = "called"
		antrian.JamDipanggil = &jamDipanggil
		antrian.DipangggilOleh = &dipanggilOleh

		c.JSON(http.StatusOK, gin.H{
			"message": "Pasien berhasil dipanggil",
			"antrian": antrian,
		})
	}
}
