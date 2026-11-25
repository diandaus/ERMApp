package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// usg_riwayat_handler.go — card "Riwayat USG Sebelumnya" di tab Pemeriksaan
// USG (RadTab.tsx kategoriUsg): hasil USG pasien yg SAMA (no_rkm_medis)
// dari kunjungan SEBELUMNYA (no_rawat lain, tanggal <= kunjungan ini),
// terbaru dulu, beserta gambar (gambar_radiologi) tiap sesi.
// Atribusi "USG" PERSIS getRadiologi kategori=usg: hasil_radiologi tidak
// punya kd_jenis_prw → EXISTS periksa_radiologi (no_rawat,tgl,jam) yg
// nm_perawatan LIKE 'USG%'.

type usgRiwayatItem struct {
	NoRawat    string   `json:"no_rawat"`
	TglPeriksa string   `json:"tgl_periksa"`
	Jam        string   `json:"jam"`
	Hasil      string   `json:"hasil"`
	NmDokter   string   `json:"nm_dokter"`
	Gambar     []string `json:"gambar"`
}

// GET /api/radiologi/usg-riwayat?no_rawat=...&limit=10
func getUsgRiwayat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimSpace(c.Query("no_rawat"))
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}
		rows, err := db.Query(`
			SELECT h.no_rawat, DATE_FORMAT(h.tgl_periksa, '%d/%m/%Y'), TIME_FORMAT(h.jam, '%H:%i:%s'),
				DATE_FORMAT(h.tgl_periksa, '%Y-%m-%d'), h.hasil,
				IFNULL((SELECT d.nm_dokter FROM periksa_radiologi pr3
					INNER JOIN dokter d ON d.kd_dokter = pr3.kd_dokter
					WHERE pr3.no_rawat = h.no_rawat AND pr3.tgl_periksa = h.tgl_periksa AND pr3.jam = h.jam LIMIT 1), '')
			FROM hasil_radiologi h
			INNER JOIN reg_periksa r ON r.no_rawat = h.no_rawat
			INNER JOIN reg_periksa rc ON rc.no_rawat = ?
			WHERE r.no_rkm_medis = rc.no_rkm_medis
				AND h.no_rawat <> rc.no_rawat
				AND h.tgl_periksa <= rc.tgl_registrasi
				AND EXISTS (
					SELECT 1 FROM periksa_radiologi pr2
					INNER JOIN jns_perawatan_radiologi jpr2 ON pr2.kd_jenis_prw = jpr2.kd_jenis_prw
					WHERE pr2.no_rawat = h.no_rawat AND pr2.tgl_periksa = h.tgl_periksa AND pr2.jam = h.jam
						AND jpr2.nm_perawatan LIKE 'USG%'
				)
			ORDER BY h.tgl_periksa DESC, h.jam DESC
			LIMIT 10`, noRawat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat riwayat USG: " + err.Error()})
			return
		}
		type key struct{ noRawat, tglISO, jam string }
		items := []usgRiwayatItem{}
		keys := []key{}
		for rows.Next() {
			var it usgRiwayatItem
			var tglISO string
			if rows.Scan(&it.NoRawat, &it.TglPeriksa, &it.Jam, &tglISO, &it.Hasil, &it.NmDokter) == nil {
				it.Gambar = []string{}
				items = append(items, it)
				keys = append(keys, key{it.NoRawat, tglISO, it.Jam})
			}
		}
		rows.Close()

		for i, k := range keys {
			gr, err := db.Query(`SELECT lokasi_gambar FROM gambar_radiologi
				WHERE no_rawat = ? AND tgl_periksa = ? AND jam = ? ORDER BY lokasi_gambar`, k.noRawat, k.tglISO, k.jam)
			if err != nil {
				continue
			}
			for gr.Next() {
				var lok string
				if gr.Scan(&lok) == nil && lok != "" {
					items[i].Gambar = append(items[i].Gambar, lok)
				}
			}
			gr.Close()
		}
		c.JSON(http.StatusOK, items)
	}
}
