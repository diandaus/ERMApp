package main

import (
	"context"
	"database/sql"
	"log"
	"regexp"
	"strings"
)

// startup_trigger.go — pasang trigger MySQL saat startup TANPA berisiko
// membekukan database production.
//
// INSIDEN 2026-11-09: dulu tiap start backend menjalankan
// "DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ..." di tabel Khanza yg ramai
// (reg_periksa, resep_obat, antriapotek3, bridging_sep). DDL trigger butuh
// metadata lock EXCLUSIVE atas tabelnya. Kebetulan ada sesi Khanza Desktop
// yg masih memegang transaksi terbuka di reg_periksa → DROP TRIGGER menunggu
// tanpa batas (default lock_wait_timeout MySQL = 1 tahun), dan SEMUA query
// Khanza lain ke reg_periksa ikut antre di belakang DDL itu → registrasi,
// resep, lab, booking operasi di seluruh RS macet, backend ERMApp sendiri
// tidak pernah sampai membuka port 8080.
//
// Aturan baru:
//  1. Kalau trigger di DB sudah IDENTIK dgn versi di kode → tidak ada DDL
//     sama sekali (kondisi normal hampir di setiap restart).
//  2. Kalau perlu diganti → DDL dijalankan di koneksi khusus dgn
//     lock_wait_timeout pendek. Tabel sedang terkunci → gagal cepat, dicatat
//     sbg peringatan, trigger LAMA tetap terpasang, backend tetap jalan.
//     Trigger baru terpasang di restart berikutnya saat tabel sepi.

const startupDDLLockWaitSeconds = 5

var multiSpace = regexp.MustCompile(`\s+`)

// normalizeSQLBody — samakan format sebelum dibandingkan: spasi/tab/newline
// diciutkan, huruf kecil, dan ";" di ujung dibuang (MySQL menyimpan
// ACTION_STATEMENT tanpa ";" penutup, sedangkan teks di kode "END;").
func normalizeSQLBody(s string) string {
	s = strings.ToLower(strings.TrimSpace(multiSpace.ReplaceAllString(s, " ")))
	return strings.TrimSpace(strings.TrimSuffix(s, ";"))
}

// triggerBodyFromCreate — ambil badan trigger (mulai dari BEGIN) dari teks
// CREATE TRIGGER, sebanding dgn kolom ACTION_STATEMENT di
// information_schema.TRIGGERS.
func triggerBodyFromCreate(createSQL string) string {
	upper := strings.ToUpper(createSQL)
	idx := strings.Index(upper, "FOR EACH ROW")
	if idx < 0 {
		return createSQL
	}
	return createSQL[idx+len("FOR EACH ROW"):]
}

func triggerExists(db *sql.DB, name string) (bool, string, error) {
	var body string
	err := db.QueryRow(`SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS
		WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?`, name).Scan(&body)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}
	return true, body, nil
}

// execDDLWithLockTimeout — jalankan DDL berurutan di SATU koneksi yg
// lock_wait_timeout-nya dipendekkan, lalu dikembalikan ke default sebelum
// koneksi balik ke pool (variabel SESSION menempel di koneksi pool).
func execDDLWithLockTimeout(db *sql.DB, stmts ...string) error {
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, "SET SESSION lock_wait_timeout = ?", startupDDLLockWaitSeconds); err != nil {
		return err
	}
	defer conn.ExecContext(ctx, "SET SESSION lock_wait_timeout = DEFAULT")
	for _, s := range stmts {
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	return nil
}

// ensureTrigger — pastikan trigger `name` terpasang sesuai createSQL.
// Tidak pernah fatal: kegagalan cuma di-log.
func ensureTrigger(db *sql.DB, name, createSQL string) {
	exists, body, err := triggerExists(db, name)
	if err != nil {
		log.Printf("Warning: gagal cek trigger %s: %v", name, err)
		return
	}
	if exists && normalizeSQLBody(body) == normalizeSQLBody(triggerBodyFromCreate(createSQL)) {
		log.Printf("✓ Trigger %s sudah terpasang (tidak diubah)", name)
		return
	}
	if err := execDDLWithLockTimeout(db, "DROP TRIGGER IF EXISTS "+name, createSQL); err != nil {
		if exists {
			log.Printf("Warning: trigger %s TIDAK diperbarui (tabel sedang dipakai / %v) — versi lama tetap aktif, dicoba lagi saat restart berikutnya", name, err)
		} else {
			log.Printf("Warning: gagal membuat trigger %s: %v — fitur yg bergantung trigger ini tidak jalan sampai restart berikutnya berhasil", name, err)
		}
		return
	}
	log.Printf("✓ Trigger %s dipasang/diperbarui", name)
}

// dropTriggerIfExists — hapus trigger usang HANYA kalau memang masih ada
// (kalau sudah tidak ada, tidak menyentuh tabel sama sekali).
func dropTriggerIfExists(db *sql.DB, name string) {
	exists, _, err := triggerExists(db, name)
	if err != nil || !exists {
		return
	}
	if err := execDDLWithLockTimeout(db, "DROP TRIGGER IF EXISTS "+name); err != nil {
		log.Printf("Warning: gagal hapus trigger usang %s: %v (dicoba lagi saat restart berikutnya)", name, err)
		return
	}
	log.Printf("✓ Trigger usang %s dihapus", name)
}
