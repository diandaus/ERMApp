package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// uploadFotoOrthancRadiologi — padanan btnUploudActionPerformed di Khanza
// lama (RMRiwayatPerawatan.java): ambil SATU gambar preview instance DICOM
// dari Orthanc, simpan ke webapps/radiologi/pages/upload (via
// WriteWebappsFile — persis mekanisme uploadBerkasRawat/berkas_handler.go),
// lalu catat lokasinya di tabel gambar_radiologi.
//
// Beda dari Khanza: kita ambil format PNG (default endpoint preview
// Orthanc, /instances/:id/preview), bukan JPG hasil AmbilJpg2() — supaya
// ekstensi file & isi kontennya konsisten, tidak menambah kompleksitas
// negosiasi Accept header cuma demi nama ekstensi.
//
// tgl_periksa/jam dari gambar_radiologi (PK: no_rawat, tgl_periksa, jam,
// lokasi_gambar) diambil dari baris hasil_radiologi TERBARU utk no_rawat
// itu (bukan dari permintaan_radiologi) — skema tabelnya identik
// (no_rawat, tgl_periksa, jam), jadi foto ini nempel ke hasil pemeriksaan
// yg baru saja disimpan. Kalau belum ada hasil tersimpan sama sekali,
// tolak dgn pesan jelas (user harus Simpan Hasil dulu).
//
// BEDA dari btnUploudActionPerformed Khanza (yg DELETE SEMUA foto lama
// tanpa filter lokasi_gambar sebelum insert, jadi 1 hasil cuma bisa punya
// 1 foto) — di sini satu order/hasil radiologi BISA punya BEBERAPA foto
// sekaligus (tiap kartu di grid Orthanc py tombol Upload sendiri2), krn
// nama file SUDAH unik per instance Orthanc (instanceId.png). DELETE
// cuma di-scope ke lokasi_gambar yg SAMA (bukan seluruh no_rawat+tgl+jam)
// — upload ulang foto yg SAMA menggantikan barisnya sendiri (idempotent),
// upload foto LAIN dari order yg sama tidak menghapus foto2 sebelumnya.
func uploadFotoOrthancRadiologi(db *sql.DB, cfg KhanzaWebappsConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			NoOrder    string `json:"noorder" binding:"required"`
			InstanceID string `json:"instance_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var noRawat string
		if err := db.QueryRow(`SELECT no_rawat FROM permintaan_radiologi WHERE noorder = ?`, req.NoOrder).Scan(&noRawat); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan radiologi tidak ditemukan"})
			return
		}

		var tglPeriksa, jam string
		err := db.QueryRow(`
			SELECT DATE_FORMAT(tgl_periksa,'%Y-%m-%d'), jam FROM hasil_radiologi
			WHERE no_rawat = ? ORDER BY tgl_periksa DESC, jam DESC LIMIT 1
		`, noRawat).Scan(&tglPeriksa, &jam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Simpan Hasil Pemeriksaan dulu sebelum upload foto"})
			return
		}

		orthanc := newOrthancClient(db)
		imgData, status, err := orthanc.do("GET", "/instances/"+req.InstanceID+"/preview", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal mengambil gambar dari Orthanc: " + err.Error()})
			return
		}
		if status != 200 {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Orthanc HTTP %d saat ambil gambar", status)})
			return
		}

		fileName := req.InstanceID + ".png"
		if err := WriteWebappsFile(cfg, "radiologi/pages/upload", fileName, imgData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file ke server webapps: " + err.Error()})
			return
		}
		lokasiGambar := "pages/upload/" + fileName

		if _, err := db.Exec(
			`DELETE FROM gambar_radiologi WHERE no_rawat = ? AND tgl_periksa = ? AND jam = ? AND lokasi_gambar = ?`,
			noRawat, tglPeriksa, jam, lokasiGambar,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus foto lama: " + err.Error()})
			return
		}
		if _, err := db.Exec(
			`INSERT INTO gambar_radiologi (no_rawat, tgl_periksa, jam, lokasi_gambar) VALUES (?, ?, ?, ?)`,
			noRawat, tglPeriksa, jam, lokasiGambar,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ke database: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Foto berhasil diupload ke server", "lokasi_gambar": lokasiGambar})
	}
}
