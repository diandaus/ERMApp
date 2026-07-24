package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PERMINTAAN RESEP — Aksi "Penyerahan" (kolom Penyerahan di Daftar Resep
// Dokter). Cocok dengan BtnPenyerahanActionPerformed di
// DlgDaftarPermintaanResep.java, yang di Khanza Desktop membuka jendela
// browser terpisah ke webapps/penyerahanresep/index.php?act=Kamera untuk
// ambil foto bukti serah-terima obat pakai webcam.
//
// **Penyederhanaan yang disengaja**: Java melewati tabel antrian
// sementara `antriapotek3` (insert 1 baris no_resep+no_rawat sebelum
// buka popup, dibaca lagi oleh kamera.php lewat "SELECT * FROM
// antriapotek3" tanpa WHERE — makanya cuma bisa 1 penyerahan aktif dalam
// satu waktu di Java) — cuma untuk mengoper `no_resep`/`no_rawat` antar
// window terpisah, karena PHP itu sendiri (proses request baru) tidak
// bisa akses state React/Java secara langsung. Di sini TIDAK PERLU:
// `no_resep` sudah ada di tangan React (row yang diklik), modal kamera
// dibuka di halaman yang sama, jadi `antriapotek3` dilewati sepenuhnya —
// hasil akhirnya identik (baris di bukti_penyerahan_resep_obat +
// resep_obat.tgl_penyerahan/jam_penyerahan ke-update), cuma jalurnya
// lebih pendek.
//
// Foto diupload lewat endpoint generik /api/upload (multipart) yang
// sudah ada di upload_handler.go — hasilnya (`/uploads/xxx.jpg`) dikirim
// sebagai `photo` ke endpoint ini, BUKAN base64 data URI langsung (beda
// dari storeImage.php Java yang terima base64 lalu decode sendiri).
//
// Tabel:
//   bukti_penyerahan_resep_obat (no_resep PK, photo varchar500 — path
//     relatif, di sini diisi path /uploads/... dari upload_handler.go)
//   resep_obat.tgl_penyerahan/jam_penyerahan — sudah ada, dibaca
//     read-only oleh getPermintaanResepRalan (kolom "Penyerahan" di
//     Dashboard); endpoint inilah yang PERTAMA KALI benar-benar
//     menulisnya.
//
// **Duplikat**: no_resep adalah PRIMARY KEY di bukti_penyerahan_resep_obat
// (Khanza cuma izinkan SATU bukti foto per resep) — padanan pesan error
// "Gagal, kemungkinan sudah dilakukan penyerahan resep sebelumnya ..!!"
// di storeImage.php direplikasi lewat deteksi duplicate-key MySQL.
// ============================================================================

func submitPenyerahanResep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			NoResep string `json:"no_resep" binding:"required"`
			Photo   string `json:"photo" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO bukti_penyerahan_resep_obat (no_resep, photo) VALUES (?, ?)`,
			body.NoResep, body.Photo,
		); err != nil {
			tx.Rollback()
			if strings.Contains(err.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "Gagal, kemungkinan sudah dilakukan penyerahan resep sebelumnya"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			`UPDATE resep_obat SET tgl_penyerahan = CURDATE(), jam_penyerahan = CURTIME() WHERE no_resep = ?`,
			body.NoResep,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Tandai baris antrian_apotek (kalau ada) jadi 'done' — tanpa ini,
		// antrian_apotek.status tidak pernah diset 'done' di manapun di
		// codebase, jadi baris yang sudah waiting/called akan terus muncul
		// di layar display (DisplayAntrianApotek.tsx) walau obatnya sudah
		// benar-benar diserahkan lewat modal ini. Dibiarkan silent kalau
		// tidak ada baris cocok (resep dibuat sebelum trigger auto-insert
		// terpasang, atau memang belum sempat masuk antrian).
		if _, err := tx.Exec(
			`UPDATE antrian_apotek SET status = 'done', updated_at = NOW()
			 WHERE no_resep = ? AND tgl_antrian = CURDATE() AND status IN ('waiting', 'called', 'serving')`,
			body.NoResep,
		); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Penyerahan resep berhasil disimpan"})
	}
}
