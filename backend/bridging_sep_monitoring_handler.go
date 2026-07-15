package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING SEP — Pencarian & Monitoring (bagian 14 & 15 spesifikasi VClaim):
//   14.1 SEP Induk       GET SEP/{noSep}
//   14.2 SEP Internal    GET SEP/Internal/{noSep}
//   15   Monitoring SEP  GET Monitoring/Kunjungan/Tanggal/{tgl}/JnsPelayanan/{jns}
// Pesan "SEP tidak ditemukan" (14.1.2/14.2.2) dan "data tidak ditemukan"
// (15.2) diteruskan apa adanya dari respons vclaimRequest.
// ============================================================================

// searchSepBpjs menangani 14.1 Pencarian SEP Induk.
func searchSepBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := strings.TrimPrefix(c.Param("no_sep"), "/")
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "SEP/"+noSep, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"sep": result})
	}
}

// searchSepInternalBpjs menangani 14.2 Pencarian SEP Internal.
func searchSepInternalBpjs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noSep := strings.TrimPrefix(c.Param("no_sep"), "/")
		if noSep == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. SEP wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := vclaimRequest(cfg, http.MethodGet, "SEP/Internal/"+noSep, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"sep_internal": result})
	}
}

// getMonitoringSep menangani bagian 15 Monitoring SEP/Klaim.
func getMonitoringSep(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl := strings.TrimSpace(c.Query("tgl"))
		if tgl == "" {
			tgl = time.Now().Format("2006-01-02")
		}
		jnsPelayanan := c.DefaultQuery("jns_pelayanan", "2")

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Monitoring/Kunjungan/Tanggal/" + tgl + "/JnsPelayanan/" + jnsPelayanan
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"monitoring": result})
	}
}
