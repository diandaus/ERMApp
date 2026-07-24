package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AntrianApotek represents pharmacy queue
type AntrianApotek struct {
	ID            int       `json:"id"`
	NoAntrian     string    `json:"no_antrian"`
	NoResep       string    `json:"no_resep"`
	NoRkmMedis    string    `json:"no_rkm_medis"`
	NmPasien      string    `json:"nm_pasien"`
	JenisResep    string    `json:"jenis_resep"` // "racikan" atau "non_racikan"
	Status        string    `json:"status"`      // waiting, called, serving, done, cancelled
	TglAntrian    time.Time `json:"tgl_antrian"`
	JamDaftar     string    `json:"jam_daftar"`
	JamDipanggil  *string   `json:"jam_dipanggil"`
	DipanggilOleh *string   `json:"dipanggil_oleh"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ensureAntrianApotekTable creates table and trigger for apotek queue
func ensureAntrianApotekTable(db *sql.DB) error {
	// Create table
	tableQuery := `
	CREATE TABLE IF NOT EXISTS antrian_apotek (
		id INT AUTO_INCREMENT PRIMARY KEY,
		no_antrian VARCHAR(20) NOT NULL,
		no_resep VARCHAR(20),
		no_rkm_medis VARCHAR(15) NOT NULL,
		nm_pasien VARCHAR(100),
		jenis_resep ENUM('racikan', 'non_racikan') NOT NULL DEFAULT 'non_racikan',
		status ENUM('waiting','called','serving','done','cancelled') DEFAULT 'waiting',
		tgl_antrian DATE NOT NULL,
		jam_daftar TIME NOT NULL,
		jam_dipanggil DATETIME,
		dipanggil_oleh VARCHAR(100),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_tgl_status (tgl_antrian, status),
		INDEX idx_jenis (jenis_resep, tgl_antrian)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	_, err := db.Exec(tableQuery)
	if err != nil {
		return fmt.Errorf("gagal create table antrian_apotek: %v", err)
	}

	// Drop trigger if exists
	_, _ = db.Exec("DROP TRIGGER IF EXISTS trg_after_resep_insert")

	// Create trigger - auto generate queue when resep is submitted
	triggerQuery := `
	CREATE TRIGGER trg_after_resep_insert
	AFTER INSERT ON resep_obat
	FOR EACH ROW
	BEGIN
		DECLARE antrian_count INT;
		DECLARE new_no_antrian VARCHAR(20);
		DECLARE jenis VARCHAR(20);
		DECLARE pasien_nama VARCHAR(100);

		-- Check if this resep has racikan items
		-- If resep_dokter_racikan has entries for this no_resep, it's racikan
		IF EXISTS (SELECT 1 FROM resep_dokter_racikan WHERE no_resep = NEW.no_resep) THEN
			SET jenis = 'racikan';
		ELSE
			SET jenis = 'non_racikan';
		END IF;

		-- Get patient name
		SELECT nm_pasien INTO pasien_nama
		FROM pasien
		WHERE no_rkm_medis = (
			SELECT no_rkm_medis FROM reg_periksa WHERE no_rawat = NEW.no_rawat LIMIT 1
		) LIMIT 1;

		-- Count antrian for this type today
		SELECT COUNT(*) INTO antrian_count
		FROM antrian_apotek
		WHERE tgl_antrian = CURDATE() AND jenis_resep = jenis;

		-- Generate antrian number (R-001 for racikan, N-001 for non racikan)
		IF jenis = 'racikan' THEN
			SET new_no_antrian = CONCAT('R-', LPAD(antrian_count + 1, 3, '0'));
		ELSE
			SET new_no_antrian = CONCAT('N-', LPAD(antrian_count + 1, 3, '0'));
		END IF;

		-- Insert antrian (only once per no_resep)
		INSERT IGNORE INTO antrian_apotek
			(no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep, status, tgl_antrian, jam_daftar)
		VALUES
			(new_no_antrian, NEW.no_resep,
			(SELECT no_rkm_medis FROM reg_periksa WHERE no_rawat = NEW.no_rawat LIMIT 1),
			pasien_nama, jenis, 'waiting', CURDATE(), CURTIME());
	END;
	`

	_, err = db.Exec(triggerQuery)
	if err != nil {
		log.Printf("Warning: gagal membuat trigger antrian apotek (mungkin permission): %v", err)
		log.Printf("Sistem tetap berjalan, tapi antrian apotek harus digenerate manual")
	} else {
		log.Println("✓ Trigger auto-create antrian apotek berhasil dibuat")
	}

	// Drop trigger penyerahan if exists
	_, _ = db.Exec("DROP TRIGGER IF EXISTS trg_after_antriapotek3_insert")

	// Trigger fires when Khanza Java clicks "Penyerahan" button.
	// Java does: DELETE FROM antriapotek3; INSERT INTO antriapotek3 VALUES(no_resep,'1',no_rawat)
	// Two cases:
	//   1. Resep sudah ada di antrian_apotek (dibuat via web app) -> UPDATE jam_dipanggil
	//   2. Resep belum ada (dibuat via Khanza Java) -> INSERT record baru lalu set called
	triggerPenyerahanQuery := `
	CREATE TRIGGER trg_after_antriapotek3_insert
	AFTER INSERT ON antriapotek3
	FOR EACH ROW
	BEGIN
		DECLARE v_exists       INT DEFAULT 0;
		DECLARE v_no_rkm_medis VARCHAR(15) DEFAULT '';
		DECLARE v_nm_pasien    VARCHAR(100) DEFAULT '';
		DECLARE v_jenis        VARCHAR(20) DEFAULT 'non_racikan';
		DECLARE v_count        INT DEFAULT 0;
		DECLARE v_no_antrian   VARCHAR(20);

		SELECT COUNT(*) INTO v_exists
		FROM antrian_apotek
		WHERE no_resep = NEW.no_resep;

		IF v_exists > 0 THEN
			UPDATE antrian_apotek
			SET status         = 'called',
			    jam_dipanggil  = NOW(),
			    dipanggil_oleh = 'SIMRS Java - Penyerahan Obat',
			    updated_at     = NOW()
			WHERE no_resep = NEW.no_resep;
		ELSE
			SELECT r.no_rkm_medis, COALESCE(p.nm_pasien, '')
			INTO   v_no_rkm_medis, v_nm_pasien
			FROM   reg_periksa r
			LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
			WHERE  r.no_rawat = NEW.no_rawat
			LIMIT  1;

			IF EXISTS (SELECT 1 FROM resep_dokter_racikan WHERE no_resep = NEW.no_resep LIMIT 1) THEN
				SET v_jenis = 'racikan';
			END IF;

			SELECT COUNT(*) INTO v_count
			FROM antrian_apotek
			WHERE tgl_antrian = CURDATE() AND jenis_resep = v_jenis;

			IF v_jenis = 'racikan' THEN
				SET v_no_antrian = CONCAT('R-', LPAD(v_count + 1, 3, '0'));
			ELSE
				SET v_no_antrian = CONCAT('N-', LPAD(v_count + 1, 3, '0'));
			END IF;

			INSERT INTO antrian_apotek
				(no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
				 status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh)
			VALUES
				(v_no_antrian, NEW.no_resep, v_no_rkm_medis, v_nm_pasien, v_jenis,
				 'called', CURDATE(), CURTIME(), NOW(), 'SIMRS Java - Penyerahan Obat');
		END IF;
	END;
	`

	_, err = db.Exec(triggerPenyerahanQuery)
	if err != nil {
		log.Printf("Warning: gagal membuat trigger penyerahan apotek: %v", err)
	} else {
		log.Println("✓ Trigger auto-call penyerahan apotek berhasil dibuat")
	}

	return nil
}

// GET /api/antrian/apotek/display
// Get display data for apotek (both racikan and non-racikan)
func getAntrianApotekDisplay(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// "Hari ini" dihitung oleh MySQL sendiri (CURDATE()), BUKAN
		// time.Now() Go — trigger yang insert baris antrian_apotek juga
		// pakai CURDATE() MySQL. Kalau proses Go & server MySQL beda
		// timezone (mis. beda mesin/container), time.Now().Format(...) Go
		// bisa mismatch dengan tgl_antrian yang di-generate MySQL, bikin
		// antrian hari ini tidak ketemu di query display ini.
		var activeRacikan *AntrianApotek
		rowR := db.QueryRow(`
			SELECT id, no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_apotek
			WHERE jenis_resep = 'racikan' AND tgl_antrian = CURDATE() AND status IN ('called', 'serving')
			ORDER BY jam_dipanggil DESC
			LIMIT 1
		`)

		var ar AntrianApotek
		err := rowR.Scan(
			&ar.ID, &ar.NoAntrian, &ar.NoResep, &ar.NoRkmMedis, &ar.NmPasien,
			&ar.JenisResep, &ar.Status, &ar.TglAntrian, &ar.JamDaftar,
			&ar.JamDipanggil, &ar.DipanggilOleh, &ar.CreatedAt, &ar.UpdatedAt,
		)
		if err == nil {
			activeRacikan = &ar
		}

		// Get active antrian for non-racikan
		var activeNonRacikan *AntrianApotek
		rowN := db.QueryRow(`
			SELECT id, no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_apotek
			WHERE jenis_resep = 'non_racikan' AND tgl_antrian = CURDATE() AND status IN ('called', 'serving')
			ORDER BY jam_dipanggil DESC
			LIMIT 1
		`)

		var an AntrianApotek
		err = rowN.Scan(
			&an.ID, &an.NoAntrian, &an.NoResep, &an.NoRkmMedis, &an.NmPasien,
			&an.JenisResep, &an.Status, &an.TglAntrian, &an.JamDaftar,
			&an.JamDipanggil, &an.DipanggilOleh, &an.CreatedAt, &an.UpdatedAt,
		)
		if err == nil {
			activeNonRacikan = &an
		}

		// Get waiting list for racikan
		waitingRacikan := []AntrianApotek{}
		rowsR, err := db.Query(`
			SELECT id, no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_apotek
			WHERE jenis_resep = 'racikan' AND tgl_antrian = CURDATE() AND status = 'waiting'
			ORDER BY jam_daftar ASC
		`)
		if err == nil {
			defer rowsR.Close()
			for rowsR.Next() {
				var a AntrianApotek
				rowsR.Scan(
					&a.ID, &a.NoAntrian, &a.NoResep, &a.NoRkmMedis, &a.NmPasien,
					&a.JenisResep, &a.Status, &a.TglAntrian, &a.JamDaftar,
					&a.JamDipanggil, &a.DipanggilOleh, &a.CreatedAt, &a.UpdatedAt,
				)
				waitingRacikan = append(waitingRacikan, a)
			}
		}

		// Get waiting list for non-racikan
		waitingNonRacikan := []AntrianApotek{}
		rowsN, err := db.Query(`
			SELECT id, no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_apotek
			WHERE jenis_resep = 'non_racikan' AND tgl_antrian = CURDATE() AND status = 'waiting'
			ORDER BY jam_daftar ASC
		`)
		if err == nil {
			defer rowsN.Close()
			for rowsN.Next() {
				var a AntrianApotek
				rowsN.Scan(
					&a.ID, &a.NoAntrian, &a.NoResep, &a.NoRkmMedis, &a.NmPasien,
					&a.JenisResep, &a.Status, &a.TglAntrian, &a.JamDaftar,
					&a.JamDipanggil, &a.DipanggilOleh, &a.CreatedAt, &a.UpdatedAt,
				)
				waitingNonRacikan = append(waitingNonRacikan, a)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"racikan": gin.H{
				"active":  activeRacikan,
				"waiting": waitingRacikan,
			},
			"non_racikan": gin.H{
				"active":  activeNonRacikan,
				"waiting": waitingNonRacikan,
			},
		})
	}
}

// POST /api/antrian/apotek/call-patient
// Call specific patient by no_resep — dipicu tombol "Panggil" di baris
// resep pada Daftar Resep Dokter (PermintaanResep.tsx), supaya layar
// display pasien (DisplayAntrianApotek.tsx, yang polling endpoint ini
// lewat GET .../display) ikut memanggil, bukan cuma bunyi lokal di
// komputer petugas. jenis_resep TIDAK diminta dari frontend (dulu wajib,
// tapi belum ada pemanggil yang benar-benar tahu nilainya) — no_resep
// sudah cukup unik untuk cari baris antrian_apotek yang tepat.
// petugas_nip/petugas_nama SENGAJA opsional (cuma dipakai untuk kolom
// audit dipanggil_oleh) — akun generik/belum di-link NIP tidak boleh
// gagal memanggil pasien cuma karena field ini kosong.
func callPatientApotek(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoResep     string `json:"no_resep" binding:"required"`
			PetugasNIP  string `json:"petugas_nip"`
			PetugasNama string `json:"petugas_nama"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		now := time.Now()

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
			return
		}
		defer tx.Rollback()

		// Find patient queue (can be called multiple times) — tgl_antrian =
		// CURDATE() MySQL, bukan time.Now() Go, sama alasan dgn getAntrianApotekDisplay.
		var antrian AntrianApotek
		row := tx.QueryRow(`
			SELECT id, no_antrian, no_resep, no_rkm_medis, nm_pasien, jenis_resep,
			       status, tgl_antrian, jam_daftar, jam_dipanggil, dipanggil_oleh,
			       created_at, updated_at
			FROM antrian_apotek
			WHERE no_resep = ? AND tgl_antrian = CURDATE()
			  AND status IN ('waiting', 'called', 'serving')
			LIMIT 1
		`, req.NoResep)

		err = row.Scan(
			&antrian.ID, &antrian.NoAntrian, &antrian.NoResep, &antrian.NoRkmMedis,
			&antrian.NmPasien, &antrian.JenisResep, &antrian.Status, &antrian.TglAntrian,
			&antrian.JamDaftar, &antrian.JamDipanggil, &antrian.DipanggilOleh,
			&antrian.CreatedAt, &antrian.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			tx.Rollback()
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Resep tidak ditemukan dalam antrian atau sudah selesai",
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get queue"})
			return
		}

		// Update status to 'called' and timestamp
		jamDipanggil := now.Format("2006-01-02 15:04:05")
		dipanggilOleh := req.PetugasNama
		if req.PetugasNIP != "" {
			dipanggilOleh = fmt.Sprintf("%s - %s", req.PetugasNIP, req.PetugasNama)
		}
		if dipanggilOleh == "" {
			dipanggilOleh = "Permintaan Resep"
		}

		_, err = tx.Exec(`
			UPDATE antrian_apotek
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

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit"})
			return
		}

		antrian.Status = "called"
		antrian.JamDipanggil = &jamDipanggil
		antrian.DipanggilOleh = &dipanggilOleh

		c.JSON(http.StatusOK, gin.H{
			"message": "Antrian apotek berhasil dipanggil",
			"antrian": antrian,
		})
	}
}

// PUT /api/antrian/apotek/:id/status
// Update status antrian apotek
func updateAntrianApotekStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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
			UPDATE antrian_apotek
			SET status = ?, updated_at = NOW()
			WHERE id = ?
		`, req.Status, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Status antrian apotek berhasil diupdate",
		})
	}
}
