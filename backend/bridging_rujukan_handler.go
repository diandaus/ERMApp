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

// RiwayatRujukanRow — satu baris riwayat rujukan VClaim, kolomnya persis
// tabMode di BPJSCekRujukanKartuRS.java (Object[] row={"ICD 10","Nama
// Diagnosa","No.Rujukan","Kode Tujuan","Nama Tujuan","Tgl.Rujukan","Kode
// PPK","Nama PPK","Status"}).
type RiwayatRujukanRow struct {
	KodeDiagnosa string `json:"kode_diagnosa"`
	NamaDiagnosa string `json:"nama_diagnosa"`
	NoRujukan    string `json:"no_rujukan"`
	KodeTujuan   string `json:"kode_tujuan"`
	NamaTujuan   string `json:"nama_tujuan"`
	TglRujukan   string `json:"tgl_rujukan"`
	KodePpk      string `json:"kode_ppk"`
	NamaPpk      string `json:"nama_ppk"`
	Status       string `json:"status"`
}

func vclaimStr(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func vclaimSubMap(m map[string]interface{}, key string) map[string]interface{} {
	if v, ok := m[key].(map[string]interface{}); ok {
		return v
	}
	return map[string]interface{}{}
}

// parseRiwayatRujukanRows mem-parse respons Rujukan/List/Peserta (FKTP) atau
// Rujukan/RS/List/Peserta (FKTL) — keduanya bentuknya sama, field "rujukan"
// berisi array objek dgn sub-objek diagnosa/poliRujukan/provPerujuk, persis
// struktur yg dibaca method tampil() di Java (list.path("diagnosa")...dst).
func parseRiwayatRujukanRows(result map[string]interface{}, status string) []RiwayatRujukanRow {
	rows := []RiwayatRujukanRow{}
	list, _ := result["rujukan"].([]interface{})
	for _, item := range list {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		diagnosa := vclaimSubMap(m, "diagnosa")
		poliRujukan := vclaimSubMap(m, "poliRujukan")
		provPerujuk := vclaimSubMap(m, "provPerujuk")
		rows = append(rows, RiwayatRujukanRow{
			KodeDiagnosa: vclaimStr(diagnosa, "kode"),
			NamaDiagnosa: vclaimStr(diagnosa, "nama"),
			NoRujukan:    vclaimStr(m, "noKunjungan"),
			KodeTujuan:   vclaimStr(poliRujukan, "kode"),
			NamaTujuan:   vclaimStr(poliRujukan, "nama"),
			TglRujukan:   vclaimStr(m, "tglKunjungan"),
			KodePpk:      vclaimStr(provPerujuk, "kode"),
			NamaPpk:      vclaimStr(provPerujuk, "nama"),
			Status:       status,
		})
	}
	return rows
}

// getRiwayatRujukanVclaim — padanan persis method tampil(nomorkartu,
// namapasien) di BPJSCekRujukanKartuRS.java: gabungan riwayat rujukan FKTP
// (Rujukan/List/Peserta/{noKartu}) dan FKTL (Rujukan/RS/List/Peserta/
// {noKartu}), ditandai kolom Status masing-masing. Kalau salah satu
// panggilan gagal (mis. peserta tidak pernah dirujuk dari RS), tetap
// lanjut pakai hasil yang berhasil — cuma error kalau KEDUANYA gagal.
func getRiwayatRujukanVclaim(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noKartu := strings.TrimSpace(c.Param("no_kartu"))
		if len(noKartu) > 0 && noKartu[0] == '/' {
			noKartu = noKartu[1:]
		}
		if noKartu == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Kartu wajib diisi"})
			return
		}

		cfg, err := getVclaimConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		rows := []RiwayatRujukanRow{}

		fktp, fktpErr := vclaimRequest(cfg, http.MethodGet, "Rujukan/List/Peserta/"+noKartu, nil)
		if fktpErr == nil {
			rows = append(rows, parseRiwayatRujukanRows(fktp, "FKTP")...)
		}

		fktl, fktlErr := vclaimRequest(cfg, http.MethodGet, "Rujukan/RS/List/Peserta/"+noKartu, nil)
		if fktlErr == nil {
			rows = append(rows, parseRiwayatRujukanRows(fktl, "FKTL")...)
		}

		if fktpErr != nil && fktlErr != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": fktpErr.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"list": rows})
	}
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
