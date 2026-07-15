package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING REFERENSI — proxy generik ke seluruh endpoint referensi/* VClaim
// (Diagnosa, Dokter, Poli, Faskes, Procedure, Kelas Rawat, Ruang Rawat,
// Spesialistik, Cara Keluar, Pasca Pulang, Propinsi, Kabupaten, Kecamatan,
// DPJP RJTL/RITL, dll). Data referensi ini nanti dipakai sebagai
// dropdown/lookup saat mengisi & mencetak SEP.
//
// Satu handler generik dipakai untuk semua jenis karena polanya sama persis:
// GET referensi/{path...} lalu didekripsi dengan skema VClaim yang sama.
// ============================================================================

func getReferensiBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := strings.TrimPrefix(c.Param("path"), "/")
		if path == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Path referensi wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "referensi/"+path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": result})
	}
}
