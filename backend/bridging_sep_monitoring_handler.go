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
//   16   Data Klaim      GET Monitoring/Klaim/Tanggal/{tglPulang}/JnsPelayanan/{jns}/Status/{status}
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

// getMonitoringKlaim menangani bagian 16 Data Klaim (GET
// Monitoring/Klaim/Tanggal/{tglPulang}/JnsPelayanan/{jnsPelayanan}/Status/{status}).
// jnsPelayanan: "1" = Rawat Inap, "2" = Rawat Jalan (sama seperti Insert/
// Update SEP). status: "1" Proses Verifikasi, "2" Pending Verifikasi,
// "3" Klaim.
func getMonitoringKlaim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglPulang := strings.TrimSpace(c.Query("tgl_pulang"))
		if tglPulang == "" {
			tglPulang = time.Now().Format("2006-01-02")
		}
		jnsPelayanan := c.DefaultQuery("jns_pelayanan", "2")
		status := c.DefaultQuery("status", "1")

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "Monitoring/Klaim/Tanggal/" + tglPulang + "/JnsPelayanan/" + jnsPelayanan + "/Status/" + status
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"klaim": result})
	}
}

// HistoriPelayananRow — satu baris histori pelayanan VClaim, kolomnya
// persis tabMode di dialog Histori Pelayanan BPJS (Object[] row={"No.",
// "Diagnosa","Jenis Pelayanan","Kelas Rawat","Nama Peserta","No.Kartu",
// "No.SEP","No.Rujukan","Poli","PPK Pelayanan","Pulang SEP","Tgl.SEP"}).
// "No." (nomor urut) tidak disertakan di sini — itu murni index tampilan,
// diberi frontend saat render tabel.
type HistoriPelayananRow struct {
	Diagnosa       string `json:"diagnosa"`
	JenisPelayanan string `json:"jenis_pelayanan"`
	KelasRawat     string `json:"kelas_rawat"`
	NamaPeserta    string `json:"nama_peserta"`
	NoKartu        string `json:"no_kartu"`
	NoSep          string `json:"no_sep"`
	NoRujukan      string `json:"no_rujukan"`
	Poli           string `json:"poli"`
	PpkPelayanan   string `json:"ppk_pelayanan"`
	TglPulangSep   string `json:"tgl_pulang_sep"`
	TglSep         string `json:"tgl_sep"`
}

func jenisPelayananEnumText(v string) string {
	switch v {
	case "1":
		return "Rawat Inap"
	case "2":
		return "Rawat Jalan"
	default:
		return v
	}
}

// getHistoriPelayananVclaim — padanan persis method tampil(nomorrujukan) di
// dialog Histori Pelayanan BPJS: GET monitoring/HistoriPelayanan/NoKartu/
// {noKartu}/tglMulai/{tglMulai}/tglAkhir/{tglAkhir} (parameter Java bernama
// "nomorrujukan" tapi isinya sebenarnya No. Kartu peserta, sesuai path
// URL-nya — bukan No. Rujukan).
func getHistoriPelayananVclaim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noKartu := strings.TrimSpace(c.Param("no_kartu"))
		if len(noKartu) > 0 && noKartu[0] == '/' {
			noKartu = noKartu[1:]
		}
		if noKartu == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu wajib diisi"})
			return
		}
		tglMulai := strings.TrimSpace(c.Query("tgl_mulai"))
		if tglMulai == "" {
			tglMulai = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		tglAkhir := strings.TrimSpace(c.Query("tgl_akhir"))
		if tglAkhir == "" {
			tglAkhir = time.Now().Format("2006-01-02")
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "monitoring/HistoriPelayanan/NoKartu/" + noKartu + "/tglMulai/" + tglMulai + "/tglAkhir/" + tglAkhir
		result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		rows := []HistoriPelayananRow{}
		list, _ := result["histori"].([]interface{})
		for _, item := range list {
			m, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			rows = append(rows, HistoriPelayananRow{
				Diagnosa:       vclaimStr(m, "diagnosa"),
				JenisPelayanan: jenisPelayananEnumText(vclaimStr(m, "jnsPelayanan")),
				KelasRawat:     vclaimStr(m, "kelasRawat"),
				NamaPeserta:    vclaimStr(m, "namaPeserta"),
				NoKartu:        vclaimStr(m, "noKartu"),
				NoSep:          vclaimStr(m, "noSep"),
				NoRujukan:      vclaimStr(m, "noRujukan"),
				Poli:           vclaimStr(m, "poli"),
				PpkPelayanan:   vclaimStr(m, "ppkPelayanan"),
				TglPulangSep:   vclaimStr(m, "tglPlgSep"),
				TglSep:         vclaimStr(m, "tglSep"),
			})
		}

		c.JSON(http.StatusOK, gin.H{"list": rows})
	}
}

// getKlaimCountToday menghitung jumlah klaim berstatus "Klaim" (3 — sudah
// difinalisasi) dengan tglPulang hari ini, gabungan Rawat Inap + Rawat
// Jalan — dipakai kartu "Klaim Terkirim" di Overview Bridging BPJS. Beda
// dari "SEP Terbit Hari Ini" (query tabel lokal), ini panggilan LIVE ke
// BPJS (2x, satu per jenis pelayanan) karena tidak ada tabel lokal yang
// menyimpan status klaim. Kalau BPJS menolak salah satu (mis. memang tidak
// ada data utk kombinasi tanggal/jenis/status itu — BPJS balas error, bukan
// list kosong), dilewati saja, bukan dianggap gagal total.
func getKlaimCountToday(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tgl := time.Now().Format("2006-01-02")
		total := 0
		for _, jns := range []string{"1", "2"} {
			path := "Monitoring/Klaim/Tanggal/" + tgl + "/JnsPelayanan/" + jns + "/Status/3"
			result, err := vclaimRequest(cfg, http.MethodGet, path, nil)
			if err != nil {
				continue
			}
			if list, ok := result["klaim"].([]interface{}); ok {
				total += len(list)
			}
		}
		c.JSON(http.StatusOK, gin.H{"count": total})
	}
}
