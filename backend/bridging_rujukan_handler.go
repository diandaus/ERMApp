package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING RUJUKAN — pencarian rujukan online RJTL (SEP dari rujukan Faskes I
// atau Faskes II), dipakai sebelum membuat SEP supaya poli/DPJP terisi sesuai
// data rujukan (tidak bisa diubah manual, sesuai aturan BPJS).
//
// Endpoint dasar VClaim yang dipakai (jenis="1" Faskes I / "2" Faskes II):
//   Rujukan/{noRujukan}            Rujukan/Peserta/{noKartu}          (Faskes I)
//   RS/Rujukan/{noRujukan}         RS/Rujukan/Peserta/{noKartu}       (Faskes II)
// ============================================================================

func vclaimRujukanPath(jenis, mode, id string) string {
	prefix := "Rujukan"
	if jenis == "2" {
		prefix = "RS/Rujukan"
	}
	if mode == "kartu" {
		return prefix + "/Peserta/" + id
	}
	return prefix + "/" + id
}

// searchRujukan mencari rujukan online berdasarkan No. Rujukan atau No. Kartu,
// untuk Faskes I maupun Faskes II (query param jenis & mode menentukan endpoint).
func searchRujukan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := strings.TrimSpace(c.Param("id"))
		if len(id) > 0 && id[0] == '/' {
			id = id[1:]
		}
		jenis := c.DefaultQuery("jenis", "1")
		mode := c.DefaultQuery("mode", "rujukan")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := vclaimRujukanPath(jenis, mode, id)
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"rujukan": result})
	}
}
