package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING PESERTA — pencarian kepesertaan BPJS (VClaim), dipakai untuk
// validasi status aktif/non-aktif sebelum membuat SEP.
// Menggunakan getVclaimConfig/vclaimRequest dari bridging_sep_handler.go.
// ============================================================================

// searchPesertaByNoKartu — {BASE URL}/Peserta/nokartu/{noKartu}/tglSEP/{tglSep}
func searchPesertaByNoKartu(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noKartu := strings.TrimSpace(c.Param("no_kartu"))
		if len(noKartu) > 0 && noKartu[0] == '/' {
			noKartu = noKartu[1:]
		}
		tglSep := c.Query("tgl_sep")
		if noKartu == "" || tglSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu dan Tgl SEP wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Peserta/nokartu/" + noKartu + "/tglSEP/" + tglSep
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"peserta": result})
	}
}

// searchPesertaByNik — {BASE URL}/Peserta/nik/{nik}/tglSEP/{tglSep}
func searchPesertaByNik(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Param("nik"))
		if len(nik) > 0 && nik[0] == '/' {
			nik = nik[1:]
		}
		tglSep := c.Query("tgl_sep")
		if nik == "" || tglSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "NIK dan Tgl SEP wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Peserta/nik/" + nik + "/tglSEP/" + tglSep
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"peserta": result})
	}
}
