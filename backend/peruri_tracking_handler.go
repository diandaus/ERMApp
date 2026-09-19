package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// peruri_tracking_handler.go — catat riwayat kirim/tanda-tangan dokumen TTE
// ke tabel tracking_dokumen_ttd, PERSIS pola INSERT/UPDATE di
// MnSendSigningDokumenActionPerformed (Khanza Desktop, class Radiologi —
// tabelnya dipakai lintas modul TTE termasuk Lab PK). Tabel ini dibaca lagi
// oleh getBerkasKlaimTte (berkas_klaim_tte_handler.go) utk menentukan file
// "Hasil_Lab_<noorder>_<no_rawat>.pdf" mana yg statusnya SUDAH ditandatangani,
// SEBELUM dicek keberadaan file signed-nya di folder berkasrawat. TANPA
// baris ini, dokumen yg sudah terupload fisik pun TIDAK PERNAH muncul di tab
// Berkas Klaim — inilah akar masalah yg dilaporkan user utk hasil Lab PK.
//
// Skema tabel (ditranskripsi dari source Java, tabel TIDAK ada di DB dev —
// dikonfirmasi ADA di server produksi RS):
//
//	tracking_dokumen_ttd(no_rawat, nama_dokumen, tgl_kirim, order_id,
//	                     status_ttd, keterangan, user_pengirim, email_ttd)
//
// Endpoint ini SENGAJA generik (bukan spesifik Lab PK) dan opsional dipanggil
// — modul TTE lain (mis. Radiologi) bisa pakai jalur yg sama kalau nanti
// butuh integrasi Berkas Klaim serupa.

type peruriTrackingKirimInput struct {
	NoRawat      string `json:"no_rawat" binding:"required"`
	NamaDokumen  string `json:"nama_dokumen" binding:"required"`
	OrderID      string `json:"order_id" binding:"required"`
	UserPengirim string `json:"user_pengirim"`
	EmailTtd     string `json:"email_ttd"`
}

// POST /api/peruri/tracking/kirim — dipanggil begitu sendDocument Peruri
// sukses dapat orderId (SEBELUM proses OTP/signing) — status awal "Belum",
// persis kondisi Java setelah INSERT sukses tapi belum masuk blok signing.
func createPeruriTrackingKirim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input peruriTrackingKirimInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		_, err := db.Exec(`
			INSERT INTO tracking_dokumen_ttd
				(no_rawat, nama_dokumen, tgl_kirim, order_id, status_ttd, keterangan, user_pengirim, email_ttd)
			VALUES (?, ?, NOW(), ?, 'Belum', 'Dokumen telah dikirim ke Peruri', ?, ?)
		`, input.NoRawat, input.NamaDokumen, input.OrderID, input.UserPengirim, input.EmailTtd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat tracking dokumen: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GET /api/peruri/tracking/order-id?no_rawat=...&nama_dokumen=... — cari
// order_id TERAKHIR yg statusnya "Sudah" utk no_rawat (+nama_dokumen kalau
// disertakan, wajib utk Lab krn satu no_rawat bisa punya BEBERAPA No.Order
// lab berbeda). Persis query di MnDonwloadDokumenActionPerformed Java —
// dipakai tombol Download supaya TETAP AKTIF & bisa diklik ulang di sesi
// modal manapun (buka lagi modal ini besok pun tetap bisa download), TIDAK
// bergantung pada state di memori (lastTteOrderId) yg hilang begitu modal
// ditutup/browser di-refresh.
func getPeruriTrackingOrderID(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Query("no_rawat")
		namaDokumen := c.Query("nama_dokumen")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		query := `SELECT order_id FROM tracking_dokumen_ttd WHERE no_rawat=? AND status_ttd='Sudah'`
		args := []interface{}{noRawat}
		if namaDokumen != "" {
			query += ` AND nama_dokumen=?`
			args = append(args, namaDokumen)
		}
		query += ` ORDER BY tgl_kirim DESC LIMIT 1`

		var orderID string
		if err := db.QueryRow(query, args...).Scan(&orderID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dokumen belum ditandatangani atau Order ID tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"order_id": orderID})
	}
}

// POST /api/peruri/tracking/sukses — dipanggil begitu signingSession Peruri
// sukses, tandai status_ttd='Sudah' — inilah baris yg dicari getBerkasKlaimTte.
func updatePeruriTrackingSukses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			OrderID string `json:"order_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid: " + err.Error()})
			return
		}
		res, err := db.Exec(`
			UPDATE tracking_dokumen_ttd SET status_ttd='Sudah', keterangan='Dokumen telah ditandatangani'
			WHERE order_id=?
		`, input.OrderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update tracking dokumen: " + err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tracking dokumen tidak ditemukan utk order_id ini"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
