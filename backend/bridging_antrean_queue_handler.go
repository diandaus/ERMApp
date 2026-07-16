package main

import (
	"database/sql"
	"fmt"
	"log"
)

// ============================================================================
// ANTREAN BPJS OTOMATIS — tabel antrean queue + trigger MySQL.
//
// Pendaftaran pasien (reg_periksa) bisa masuk lewat DUA aplikasi berbeda:
// Khanza Java Desktop (yang dipakai loket saat ini) atau web ERMApp ini.
// Karena itu deteksi "perlu antrean BPJS baru" tidak bisa digantungkan ke
// handler API web ini saja (tidak akan ke-trigger kalau dilakukan lewat Java
// desktop) — harus di level database, memakai trigger AFTER INSERT, persis
// pola trg_after_reg_periksa_insert yang sudah ada di ensureAntrianPoliTable
// (antrian_handler.go).
//
// PENTING — titik pemicu (bukan saat pendaftaran, tapi saat SEP disimpan):
// di Khanza Java Desktop, "Tambah Antrean" BPJS terjadi bersamaan dengan
// SIMPAN SEP / Pembuatan SEP — BUKAN saat pasien pertama kali daftar
// (reg_periksa). Alasannya: field wajib jeniskunjungan & nomorreferensi
// (rujukan FKTP vs kontrol) baru pasti diketahui begitu SEP dibuat (kolom
// no_rujukan di tabel bridging_sep), belum ada di saat reg_periksa
// diinsert. Trigger versi awal (di reg_periksa) sudah diganti dengan
// trigger di bridging_sep supaya konsisten dengan alur kerja nyata ini.
//
// Trigger hanya MENCATAT ke tabel antrian bridging_antrean_queue (status
// 'pending'); trigger tidak bisa memanggil API BPJS langsung. Pemrosesan
// (lookup jadwal dokter HFIS utk jampraktek & kapasitas, generate nomor
// antrean, lalu panggil createAntreanRsBpjs) dilakukan oleh worker Go
// terpisah (bridging_antrean_worker.go).
// ============================================================================

func ensureBridgingAntreanQueueTable(db *sql.DB) error {
	// 0. Bersihkan trigger versi lama (dulu di reg_periksa, sudah tidak dipakai).
	db.Exec("DROP TRIGGER IF EXISTS trg_after_reg_periksa_insert_antrean_bpjs")

	// 1. Tabel antrian permintaan "Tambah Antrean BPJS" yang perlu diproses.
	// Kolom *_bpjs (kodepoli_bpjs, kodedokter_bpjs, dst) sengaja sudah
	// resolved/dipetakan di level trigger (lewat maping_poli_bpjs, dan
	// kddpjp di bridging_sep yang memang sudah berisi kode dokter versi
	// BPJS — dipakai VClaim Insert SEP) supaya worker tidak perlu query
	// mapping lagi, cukup baca kolom ini langsung.
	query := `
	CREATE TABLE IF NOT EXISTS bridging_antrean_queue (
		id INT AUTO_INCREMENT PRIMARY KEY,
		no_rawat VARCHAR(17) NOT NULL,
		no_sep VARCHAR(40) NULL,
		no_rkm_medis VARCHAR(15) NOT NULL,
		kd_poli CHAR(5) NULL,
		kodepoli_bpjs VARCHAR(15) NULL,
		namapoli_bpjs VARCHAR(40) NULL,
		kodedokter_bpjs VARCHAR(20) NULL,
		namadokter_bpjs VARCHAR(250) NULL,
		tgl_registrasi DATE NULL,
		jam_reg TIME NULL,
		status_poli VARCHAR(10) NULL,
		kd_pj CHAR(3) NULL,
		no_peserta VARCHAR(25) NULL,
		no_rujukan VARCHAR(40) NULL,
		jeniskunjungan INT NOT NULL DEFAULT 3,
		status VARCHAR(20) NOT NULL DEFAULT 'pending',
		keterangan VARCHAR(255) NULL,
		kodebooking VARCHAR(20) NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		processed_at DATETIME NULL,
		UNIQUE KEY uniq_no_rawat (no_rawat),
		INDEX idx_status (status)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	if _, err := db.Exec(query); err != nil {
		return fmt.Errorf("error creating bridging_antrean_queue table: %v", err)
	}

	// 2. Trigger: setiap SEP baru (jnspelayanan '2' = rawat jalan — DIKONFIRMASI
	// dari spec resmi Insert SEP 2.0: "1" = Rawat Inap, "2" = Rawat Jalan,
	// kebalikan dari asumsi awal saat trigger ini pertama dibuat) untuk
	// kunjungan dengan penjamin BPJS (via reg_periksa.kd_pj -> penjab), BUKAN
	// IGD (kd_poli <> 'IGDK' — konsisten dgn pengecualian IGDK di query
	// daftar SEP main.go), yang punya pemetaan poli ke BPJS
	// (maping_poli_bpjs), dan BELUM punya booking Mobile JKN pada tanggal
	// yang sama (belum ada di referensi_mobilejkn_bpjs) — dimasukkan ke
	// antrian. jeniskunjungan ditentukan dari ada/tidaknya no_rujukan di
	// SEP: ada rujukan -> 1 (Rujukan FKTP), tidak ada -> 3 (Kontrol).
	db.Exec("DROP TRIGGER IF EXISTS trg_after_bridging_sep_insert_antrean_bpjs")

	triggerQuery := `
	CREATE TRIGGER trg_after_bridging_sep_insert_antrean_bpjs
	AFTER INSERT ON bridging_sep
	FOR EACH ROW
	BEGIN
		DECLARE v_kd_poli CHAR(5);
		DECLARE v_tgl_registrasi DATE;
		DECLARE v_jam_reg TIME;
		DECLARE v_status_poli VARCHAR(10);
		DECLARE v_kd_pj CHAR(3);
		DECLARE v_is_bpjs INT DEFAULT 0;
		DECLARE v_kodepoli_bpjs VARCHAR(15);
		DECLARE v_namapoli_bpjs VARCHAR(40);
		DECLARE v_sudah_booking INT DEFAULT 0;
		DECLARE v_jeniskunjungan INT DEFAULT 3;

		IF NEW.jnspelayanan = '2' THEN
			SELECT kd_poli, tgl_registrasi, jam_reg, status_poli, kd_pj
			INTO v_kd_poli, v_tgl_registrasi, v_jam_reg, v_status_poli, v_kd_pj
			FROM reg_periksa WHERE no_rawat = NEW.no_rawat LIMIT 1;

			IF v_kd_poli IS NOT NULL AND v_kd_poli <> 'IGDK' THEN
				SELECT COUNT(*) INTO v_is_bpjs
				FROM penjab
				WHERE kd_pj = v_kd_pj AND png_jawab = 'BPJS' AND status = '1';

				IF v_is_bpjs > 0 THEN
					SELECT kd_poli_bpjs, nm_poli_bpjs INTO v_kodepoli_bpjs, v_namapoli_bpjs
					FROM maping_poli_bpjs WHERE kd_poli_rs = v_kd_poli LIMIT 1;

					IF v_kodepoli_bpjs IS NOT NULL THEN
						SELECT COUNT(*) INTO v_sudah_booking
						FROM referensi_mobilejkn_bpjs
						WHERE norm = NEW.nomr AND tanggalperiksa = v_tgl_registrasi;

						IF v_sudah_booking = 0 THEN
							IF NEW.no_rujukan IS NOT NULL AND NEW.no_rujukan <> '' THEN
								SET v_jeniskunjungan = 1;
							ELSE
								SET v_jeniskunjungan = 3;
							END IF;

							INSERT IGNORE INTO bridging_antrean_queue (
								no_rawat, no_sep, no_rkm_medis, kd_poli, kodepoli_bpjs, namapoli_bpjs,
								kodedokter_bpjs, namadokter_bpjs, tgl_registrasi, jam_reg, status_poli,
								kd_pj, no_peserta, no_rujukan, jeniskunjungan, status
							) VALUES (
								NEW.no_rawat, NEW.no_sep, NEW.nomr, v_kd_poli, v_kodepoli_bpjs, v_namapoli_bpjs,
								NEW.kddpjp, NEW.nmdpdjp, v_tgl_registrasi, v_jam_reg, v_status_poli,
								v_kd_pj, NEW.no_kartu, NEW.no_rujukan, v_jeniskunjungan, 'pending'
							);
						END IF;
					END IF;
				END IF;
			END IF;
		END IF;
	END;
	`
	if _, err := db.Exec(triggerQuery); err != nil {
		log.Printf("Warning: gagal membuat trigger antrean BPJS otomatis (mungkin permission): %v", err)
		log.Printf("Sistem tetap berjalan, tapi antrean BPJS harus dibuat manual")
	} else {
		log.Println("✓ Trigger auto-queue antrean BPJS berhasil dibuat")
	}

	return nil
}
