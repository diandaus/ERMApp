package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// BRIDGING ANTREAN RS — Antrian RS/Mobile JKN. Memakai base URL & kredensial
// "Mobile JKN (RS)" yang sama dengan HFIS (getHfisConfig/hfisRequest di
// bridging_hfis_handler.go — skema signature & envelope-nya identik, jadi
// direuse langsung di sini alih-alih diduplikasi).
//
//	Tambah Antrean   POST antrean/add
//
// Disimpan lokal ke tabel referensi_mobilejkn_bpjs, yang sudah ada di skema
// Khanza dan field-nya persis cocok dengan payload Antrean RS (tabel ini juga
// dipakai fitur Mobile JKN lain yang sudah punya tempat sendiri di sidebar
// Bridging: referensi_mobilejkn_bpjs_batal untuk Batal Antrean,
// referensi_mobilejkn_bpjs_taskid untuk Task Id Mobile JKN).
// ============================================================================

type AntreanRs struct {
	KodeBooking      string `json:"kodebooking"`
	JenisPasien      string `json:"jenispasien"` // "JKN" / "NON JKN"
	NomorKartu       string `json:"nomorkartu"`
	Nik              string `json:"nik"`
	NoHp             string `json:"nohp"`
	KodePoli         string `json:"kodepoli"`
	NamaPoli         string `json:"namapoli"`
	PasienBaru       int    `json:"pasienbaru"` // 1 (Ya) / 0 (Tidak)
	NoRawat          string `json:"no_rawat"`
	Norm             string `json:"norm"`
	TanggalPeriksa   string `json:"tanggalperiksa"`
	KodeDokter       string `json:"kodedokter"`
	NamaDokter       string `json:"namadokter"`
	JamPraktek       string `json:"jampraktek"`
	JenisKunjungan   int    `json:"jeniskunjungan"` // 1 Rujukan FKTP / 2 Rujukan Internal / 3 Kontrol / 4 Rujukan Antar RS
	NomorReferensi   string `json:"nomorreferensi"`
	NomorAntrean     string `json:"nomorantrean"`
	AngkaAntrean     int    `json:"angkaantrean"`
	EstimasiDilayani int64  `json:"estimasidilayani"` // epoch milliseconds
	SisaKuotaJkn     int    `json:"sisakuotajkn"`
	KuotaJkn         int    `json:"kuotajkn"`
	SisaKuotaNonJkn  int    `json:"sisakuotanonjkn"`
	KuotaNonJkn      int    `json:"kuotanonjkn"`
	Keterangan       string `json:"keterangan"`
}

func jenisKunjunganEnumText(j int) string {
	switch j {
	case 2:
		return "2 (Rujukan Internal)"
	case 3:
		return "3 (Kontrol)"
	case 4:
		return "4 (Rujukan Antar RS)"
	default:
		return "1 (Rujukan FKTP)"
	}
}

// getAntreanRsList menampilkan data lokal antrean untuk tabel UI.
func getAntreanRsList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		search := c.Query("search")
		kodeBooking := strings.TrimSpace(c.Query("kodebooking"))

		var query string
		var args []interface{}

		// namapoli/namadokter di-resolve lewat LEFT JOIN ke
		// maping_poli_bpjs/maping_dokter_dpjpvclaim — tabel
		// referensi_mobilejkn_bpjs sendiri cuma menyimpan kode mentahnya
		// (kodepoli/kodedokter), pola sama yang sudah dipakai
		// getReferensiMobileJkn. Ditambahkan supaya prefill modal "Tambah
		// Antrean" (dipanggil dari AntreanRs.tsx & ReferensiPendaftaranMobileJkn.tsx
		// lewat parameter kodebooking di bawah) bisa otomatis mengisi Nama
		// Poli/Nama Dokter, bukan cuma kodenya — sebelumnya field ini
		// sengaja dikosongkan dengan pesan "isi manual" karena endpoint ini
		// belum melakukan resolusi nama sama sekali.
		const selectCols = `nobooking, COALESCE(no_rawat,''), COALESCE(nomorkartu,''), COALESCE(nik,''), COALESCE(nohp,''),
					COALESCE(kodepoli,''), pasienbaru, COALESCE(norm,''), COALESCE(tanggalperiksa,'0000-00-00'),
					COALESCE(kodedokter,''), COALESCE(jampraktek,''), COALESCE(jeniskunjungan,''),
					COALESCE(nomorreferensi,''), COALESCE(nomorantrean,''), COALESCE(angkaantrean,''),
					COALESCE(estimasidilayani,''), sisakuotajkn, kuotajkn, sisakuotanonjkn, kuotanonjkn, status,
					COALESCE(mp.nm_poli_bpjs,''), COALESCE(md.nm_dokter_bpjs,'')`
		const joinCols = `FROM referensi_mobilejkn_bpjs
				LEFT JOIN maping_poli_bpjs mp ON mp.kd_poli_bpjs = referensi_mobilejkn_bpjs.kodepoli
				LEFT JOIN maping_dokter_dpjpvclaim md ON md.kd_dokter_bpjs = referensi_mobilejkn_bpjs.kodedokter`

		if kodeBooking != "" {
			// Lookup exact satu baris by kodebooking, LINTAS TANGGAL (dipakai
			// untuk prefill modal "Tambah Antrean" ulang saat BPJS menolak
			// update dengan "Kode Booking tidak ditemukan" — booking-nya bisa
			// jadi dari tanggal berapa pun, jadi filter tanggal harus dilewati).
			query = `SELECT ` + selectCols + ` ` + joinCols + ` WHERE referensi_mobilejkn_bpjs.nobooking = ?`
			args = []interface{}{kodeBooking}
		} else {
			if tglDari == "" {
				tglDari = time.Now().Format("2006-01-02")
			}
			if tglSampai == "" {
				tglSampai = tglDari
			}

			query = `SELECT ` + selectCols + ` ` + joinCols + ` WHERE referensi_mobilejkn_bpjs.tanggalperiksa BETWEEN ? AND ?`
			args = []interface{}{tglDari, tglSampai}
			if search != "" {
				query += ` AND (referensi_mobilejkn_bpjs.nobooking LIKE ? OR referensi_mobilejkn_bpjs.norm LIKE ? OR referensi_mobilejkn_bpjs.nomorkartu LIKE ? OR referensi_mobilejkn_bpjs.nik LIKE ?)`
				pattern := "%" + search + "%"
				args = append(args, pattern, pattern, pattern, pattern)
			}
		}
		query += ` ORDER BY referensi_mobilejkn_bpjs.tanggalperiksa DESC, referensi_mobilejkn_bpjs.nobooking DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type row struct {
			KodeBooking      string `json:"kodebooking"`
			NoRawat          string `json:"no_rawat"`
			NomorKartu       string `json:"nomorkartu"`
			Nik              string `json:"nik"`
			NoHp             string `json:"nohp"`
			KodePoli         string `json:"kodepoli"`
			PasienBaru       string `json:"pasienbaru"`
			Norm             string `json:"norm"`
			TanggalPeriksa   string `json:"tanggalperiksa"`
			KodeDokter       string `json:"kodedokter"`
			JamPraktek       string `json:"jampraktek"`
			JenisKunjungan   string `json:"jeniskunjungan"`
			NomorReferensi   string `json:"nomorreferensi"`
			NomorAntrean     string `json:"nomorantrean"`
			AngkaAntrean     string `json:"angkaantrean"`
			EstimasiDilayani string `json:"estimasidilayani"`
			SisaKuotaJkn     int    `json:"sisakuotajkn"`
			KuotaJkn         int    `json:"kuotajkn"`
			SisaKuotaNonJkn  int    `json:"sisakuotanonjkn"`
			KuotaNonJkn      int    `json:"kuotanonjkn"`
			Status           string `json:"status"`
			NamaPoli         string `json:"namapoli"`
			NamaDokter       string `json:"namadokter"`
		}
		items := []row{}
		for rows.Next() {
			var r row
			if err := rows.Scan(
				&r.KodeBooking, &r.NoRawat, &r.NomorKartu, &r.Nik, &r.NoHp,
				&r.KodePoli, &r.PasienBaru, &r.Norm, &r.TanggalPeriksa,
				&r.KodeDokter, &r.JamPraktek, &r.JenisKunjungan,
				&r.NomorReferensi, &r.NomorAntrean, &r.AngkaAntrean,
				&r.EstimasiDilayani, &r.SisaKuotaJkn, &r.KuotaJkn, &r.SisaKuotaNonJkn, &r.KuotaNonJkn, &r.Status,
				&r.NamaPoli, &r.NamaDokter,
			); err != nil {
				continue
			}
			items = append(items, r)
		}
		c.JSON(http.StatusOK, items)
	}
}

// addAntreanRs menangani "Tambah Antrean" (POST antrean/add).
func addAntreanRs(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AntreanRs
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodeBooking) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}
		if strings.TrimSpace(req.KodePoli) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
			return
		}
		if strings.TrimSpace(req.Norm) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. RM wajib diisi"})
			return
		}
		if strings.TrimSpace(req.TanggalPeriksa) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal periksa wajib diisi"})
			return
		}
		kodeDokterInt, errD := strconv.Atoi(strings.TrimSpace(req.KodeDokter))
		if errD != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode dokter tidak sesuai"})
			return
		}
		if req.JenisKunjungan < 1 || req.JenisKunjungan > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis kunjungan tidak sesuai"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := createAntreanRsBpjs(db, cfg, req, kodeDokterInt)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errAntreanBpjsGateway) {
				status = http.StatusBadGateway
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Antrean berhasil ditambahkan", "response": result})
	}
}

// errAntreanBpjsGateway menandai error yang berasal dari panggilan ke BPJS
// (bukan dari DB lokal) — dipakai createAntreanRsBpjs supaya pemanggil bisa
// membedakan status HTTP yang tepat (502 vs 500) tanpa mengecek isi pesan.
var errAntreanBpjsGateway = errors.New("bpjs gateway error")

// createAntreanRsBpjs memanggil "Tambah Antrean" (POST antrean/add) ke BPJS
// lalu menyimpan hasilnya ke referensi_mobilejkn_bpjs. Dipakai bersama oleh
// handler manual (addAntreanRs, lewat form staf) dan worker antrean queue
// otomatis (bridging_antrean_worker.go) supaya logikanya tidak dobel.
func createAntreanRsBpjs(db *sql.DB, cfg *vclaimConfig, req AntreanRs, kodeDokterInt int) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"kodebooking":      req.KodeBooking,
		"jenispasien":      req.JenisPasien,
		"nomorkartu":       req.NomorKartu,
		"nik":              req.Nik,
		"nohp":             req.NoHp,
		"kodepoli":         req.KodePoli,
		"namapoli":         req.NamaPoli,
		"pasienbaru":       req.PasienBaru,
		"norm":             req.Norm,
		"tanggalperiksa":   req.TanggalPeriksa,
		"kodedokter":       kodeDokterInt,
		"namadokter":       req.NamaDokter,
		"jampraktek":       req.JamPraktek,
		"jeniskunjungan":   req.JenisKunjungan,
		"nomorreferensi":   req.NomorReferensi,
		"nomorantrean":     req.NomorAntrean,
		"angkaantrean":     req.AngkaAntrean,
		"estimasidilayani": req.EstimasiDilayani,
		"sisakuotajkn":     req.SisaKuotaJkn,
		"kuotajkn":         req.KuotaJkn,
		"sisakuotanonjkn":  req.SisaKuotaNonJkn,
		"kuotanonjkn":      req.KuotaNonJkn,
		"keterangan":       req.Keterangan,
	}
	bodyJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	result, err := hfisRequest(cfg, http.MethodPost, "antrean/add", bodyJSON)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", errAntreanBpjsGateway, err.Error())
	}

	_, dbErr := db.Exec(`
		INSERT INTO referensi_mobilejkn_bpjs (
			nobooking, no_rawat, nomorkartu, nik, nohp, kodepoli, pasienbaru, norm,
			tanggalperiksa, kodedokter, jampraktek, jeniskunjungan, nomorreferensi,
			nomorantrean, angkaantrean, estimasidilayani, sisakuotajkn, kuotajkn,
			sisakuotanonjkn, kuotanonjkn, status, validasi, statuskirim
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum', NOW(), 'Sudah')
		ON DUPLICATE KEY UPDATE
			no_rawat=COALESCE(VALUES(no_rawat), no_rawat), nomorkartu=VALUES(nomorkartu), nik=VALUES(nik), nohp=VALUES(nohp),
			kodepoli=VALUES(kodepoli), pasienbaru=VALUES(pasienbaru), norm=VALUES(norm),
			tanggalperiksa=VALUES(tanggalperiksa), kodedokter=VALUES(kodedokter), jampraktek=VALUES(jampraktek),
			jeniskunjungan=VALUES(jeniskunjungan), nomorreferensi=VALUES(nomorreferensi),
			nomorantrean=VALUES(nomorantrean), angkaantrean=VALUES(angkaantrean),
			estimasidilayani=VALUES(estimasidilayani), sisakuotajkn=VALUES(sisakuotajkn), kuotajkn=VALUES(kuotajkn),
			sisakuotanonjkn=VALUES(sisakuotanonjkn), kuotanonjkn=VALUES(kuotanonjkn), statuskirim='Sudah'
	`,
		req.KodeBooking, nullIfEmptyStr(req.NoRawat), req.NomorKartu, req.Nik, req.NoHp, req.KodePoli,
		strconv.Itoa(req.PasienBaru), req.Norm, req.TanggalPeriksa, req.KodeDokter, req.JamPraktek,
		jenisKunjunganEnumText(req.JenisKunjungan), req.NomorReferensi, req.NomorAntrean,
		strconv.Itoa(req.AngkaAntrean), strconv.FormatInt(req.EstimasiDilayani, 10),
		req.SisaKuotaJkn, req.KuotaJkn, req.SisaKuotaNonJkn, req.KuotaNonJkn,
	)
	if dbErr != nil {
		return nil, dbErr
	}

	return result, nil
}

// getAntreanPrefillByNoRawat menyiapkan data awal utk modal "Tambah Antrean"
// manual — dipicu dari Registrasi > [BPJS] > Tambah Antrean, dipakai staf
// utk kunjungan yg antrean BPJS-nya gagal/belum sempat dibuat otomatis oleh
// worker (mis. SEP diinput sebelum trigger ada, HFIS sempat down, atau
// pasien NON JKN yg memang tidak lewat trigger SEP sama sekali).
//
// Tahap 1: kalau baris bridging_antrean_queue sudah ada (dibuat trigger
// trg_after_bridging_sep_insert_antrean_bpjs saat SEP disimpan, mungkin
// berstatus 'error'), pakai field yg SUDAH diresolve di situ — paling
// akurat krn identik dgn yg dipakai worker otomatis (bridging_antrean_worker.go).
// Tahap 2 (fallback, kalau baris queue belum ada — mis. pasien NON JKN):
// resolve langsung dari reg_periksa + pasien + tabel mapping BPJS.
// Tahap 3: best-effort lengkapi jampraktek/kuota/no.antrean dari HFIS
// Jadwal Dokter + hitung lokal, pola SAMA PERSIS dgn processAntreanQueueItem
// (lookupJadwalDokterHfis, estimasiDilayaniMillis di bridging_antrean_worker.go)
// — kegagalan di tahap ini TIDAK menggagalkan prefill, field terkait
// dibiarkan kosong utk diisi manual staf.
func getAntreanPrefillByNoRawat(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := strings.TrimPrefix(c.Param("no_rawat"), "/")
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var (
			noRkmMedis, tglRegistrasi, statusPoli                     string
			kodePoliBpjs, namaPoliBpjs, kodeDokterBpjs, namaDokterBpjs string
			noKartu, noRujukan                                        string
			jenisKunjungan                                            = 1
		)

		errQ := db.QueryRow(`
			SELECT no_rkm_medis, DATE_FORMAT(tgl_registrasi, '%Y-%m-%d'), COALESCE(status_poli,''),
				COALESCE(kodepoli_bpjs,''), COALESCE(namapoli_bpjs,''),
				COALESCE(kodedokter_bpjs,''), COALESCE(namadokter_bpjs,''),
				COALESCE(no_peserta,''), COALESCE(no_rujukan,''), jeniskunjungan
			FROM bridging_antrean_queue WHERE no_rawat = ?
		`, noRawat).Scan(&noRkmMedis, &tglRegistrasi, &statusPoli,
			&kodePoliBpjs, &namaPoliBpjs, &kodeDokterBpjs, &namaDokterBpjs,
			&noKartu, &noRujukan, &jenisKunjungan)

		if errQ != nil {
			var kdPoli, kdDokter string
			err := db.QueryRow(`
				SELECT no_rkm_medis, DATE_FORMAT(tgl_registrasi, '%Y-%m-%d'), COALESCE(status_poli,''), kd_poli, kd_dokter
				FROM reg_periksa WHERE no_rawat = ?
			`, noRawat).Scan(&noRkmMedis, &tglRegistrasi, &statusPoli, &kdPoli, &kdDokter)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
				return
			}
			db.QueryRow(`SELECT kd_poli_bpjs, nm_poli_bpjs FROM maping_poli_bpjs WHERE kd_poli_rs = ?`, kdPoli).Scan(&kodePoliBpjs, &namaPoliBpjs)
			db.QueryRow(`SELECT kd_dokter_bpjs, nm_dokter_bpjs FROM maping_dokter_dpjpvclaim WHERE kd_dokter = ?`, kdDokter).Scan(&kodeDokterBpjs, &namaDokterBpjs)
			db.QueryRow(`SELECT COALESCE(no_kartu,''), COALESCE(no_rujukan,'') FROM bridging_sep WHERE no_rawat = ?`, noRawat).Scan(&noKartu, &noRujukan)
			if noRujukan != "" {
				jenisKunjungan = 1
			} else {
				jenisKunjungan = 3
			}
		}

		var nmPasien, nik, nohp, noPeserta string
		db.QueryRow(`SELECT nm_pasien, COALESCE(no_ktp,''), COALESCE(no_tlp,''), COALESCE(no_peserta,'') FROM pasien WHERE no_rkm_medis = ?`, noRkmMedis).
			Scan(&nmPasien, &nik, &nohp, &noPeserta)
		if noKartu == "" {
			noKartu = noPeserta
		}
		jenisPasien := "NON JKN"
		if noKartu != "" {
			jenisPasien = "JKN"
		}
		pasienBaru := 0
		if statusPoli == "Baru" {
			pasienBaru = 1
		}

		resp := gin.H{
			"kodebooking":      strings.ReplaceAll(noRawat, "/", ""),
			"no_rawat":         noRawat,
			"nama_pasien":      nmPasien,
			"jenispasien":      jenisPasien,
			"nomorkartu":       noKartu,
			"nik":              nik,
			"nohp":             nohp,
			"kodepoli":         kodePoliBpjs,
			"namapoli":         namaPoliBpjs,
			"pasienbaru":       pasienBaru,
			"norm":             noRkmMedis,
			"tanggalperiksa":   tglRegistrasi,
			"kodedokter":       kodeDokterBpjs,
			"namadokter":       namaDokterBpjs,
			"jeniskunjungan":   jenisKunjungan,
			"nomorreferensi":   noRujukan,
			"jampraktek":       "",
			"nomorantrean":     "",
			"angkaantrean":     0,
			"estimasidilayani": int64(0),
			"sisakuotajkn":     0,
			"kuotajkn":         0,
			"sisakuotanonjkn":  0,
			"kuotanonjkn":      0,
			"keterangan":       "",
			"warning":          "",
		}

		if kodePoliBpjs == "" {
			resp["warning"] = "Kode poli belum terpetakan ke BPJS (cek Pengaturan > Bridging BPJS > Mapping Poli)"
		} else if kodeDokterBpjs == "" {
			resp["warning"] = "Kode dokter belum terpetakan ke BPJS (cek Pengaturan > Bridging BPJS > Mapping Dokter)"
		} else if cfg, errCfg := getHfisConfig(db); errCfg == nil {
			if jampraktek, kapasitas, errJ := lookupJadwalDokterHfis(cfg, kodePoliBpjs, tglRegistrasi, kodeDokterBpjs); errJ == nil {
				var sudahAda int
				db.QueryRow(`
					SELECT COUNT(*) FROM referensi_mobilejkn_bpjs
					WHERE kodedokter = ? AND tanggalperiksa = ? AND status <> 'Batal'
				`, kodeDokterBpjs, tglRegistrasi).Scan(&sudahAda)
				angkaAntrean := sudahAda + 1
				sisaKuota := kapasitas - angkaAntrean
				if sisaKuota < 0 {
					sisaKuota = 0
				}
				resp["jampraktek"] = jampraktek
				resp["nomorantrean"] = fmt.Sprintf("%s-%03d", kodePoliBpjs, angkaAntrean)
				resp["angkaantrean"] = angkaAntrean
				resp["estimasidilayani"] = estimasiDilayaniMillis(tglRegistrasi, jampraktek, angkaAntrean)
				resp["sisakuotajkn"] = sisaKuota
				resp["kuotajkn"] = kapasitas
			} else {
				resp["warning"] = "Jampraktek/kuota tidak bisa diambil otomatis: " + errJ.Error()
			}
		}

		c.JSON(http.StatusOK, resp)
	}
}

// ============================================================================
// ANTREAN FARMASI — antrean pengambilan obat (POST antrean/farmasi/add).
// Tidak ada tabel Khanza siap pakai untuk ini (beda dari antrean utama yang
// sudah punya referensi_mobilejkn_bpjs), jadi dibuat tabel lokal baru
// bridging_antrean_farmasi. Tidak diberi foreign key ke
// referensi_mobilejkn_bpjs(nobooking) supaya tetap bisa dicatat walau
// kodebooking induknya berasal dari antrean yang dibuat di luar aplikasi ini.
// ============================================================================

func ensureAntreanFarmasiTable(db *sql.DB) error {
	const createTable = `
		CREATE TABLE IF NOT EXISTS bridging_antrean_farmasi (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kodebooking VARCHAR(20) NOT NULL,
			jenisresep ENUM('racikan','non racikan') NOT NULL,
			nomorantrean INT NOT NULL,
			keterangan VARCHAR(200) NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			KEY idx_kodebooking (kodebooking)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	_, err := db.Exec(createTable)
	return err
}

type AntreanFarmasi struct {
	ID           int    `json:"id"`
	KodeBooking  string `json:"kodebooking"`
	JenisResep   string `json:"jenisresep"` // "racikan" / "non racikan"
	NomorAntrean int    `json:"nomorantrean"`
	Keterangan   string `json:"keterangan"`
	CreatedAt    string `json:"created_at"`
}

// getAntreanFarmasiList menampilkan data lokal antrean farmasi untuk tabel UI.
func getAntreanFarmasiList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBooking := c.Query("kodebooking")

		query := `SELECT id, kodebooking, jenisresep, nomorantrean, keterangan, created_at FROM bridging_antrean_farmasi`
		args := []interface{}{}
		if kodeBooking != "" {
			query += ` WHERE kodebooking = ?`
			args = append(args, kodeBooking)
		}
		query += ` ORDER BY created_at DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []AntreanFarmasi{}
		for rows.Next() {
			var a AntreanFarmasi
			if err := rows.Scan(&a.ID, &a.KodeBooking, &a.JenisResep, &a.NomorAntrean, &a.Keterangan, &a.CreatedAt); err == nil {
				items = append(items, a)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

// addAntreanFarmasi menangani "Tambah Antrean Farmasi" (POST antrean/farmasi/add).
func addAntreanFarmasi(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AntreanFarmasi
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodeBooking) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}
		if req.JenisResep != "racikan" && req.JenisResep != "non racikan" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis resep tidak sesuai"})
			return
		}
		if req.NomorAntrean <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor antrean wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"kodebooking":  req.KodeBooking,
			"jenisresep":   req.JenisResep,
			"nomorantrean": req.NomorAntrean,
			"keterangan":   req.Keterangan,
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodPost, "antrean/farmasi/add", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if _, err := db.Exec(
			`INSERT INTO bridging_antrean_farmasi (kodebooking, jenisresep, nomorantrean, keterangan) VALUES (?, ?, ?, ?)`,
			req.KodeBooking, req.JenisResep, req.NomorAntrean, req.Keterangan,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Antrean farmasi berhasil ditambahkan", "response": result})
	}
}

// ============================================================================
// UPDATE WAKTU ANTREAN — mengirim waktu tunggu/waktu layan per tahap
// (POST antrean/updatewaktu). Disimpan lokal ke referensi_mobilejkn_bpjs_taskid
// (sudah ada di skema Khanza, PK (no_rawat, taskid)) — no_rawat diambil dari
// baris antrean induknya (referensi_mobilejkn_bpjs.nobooking = kodebooking).
// Kalau no_rawat kosong (antrean tidak ditautkan ke no_rawat lokal), update
// tetap dikirim ke BPJS tapi tidak dicatat lokal — bukan alasan untuk gagal
// mengingat BPJS-nya sendiri sudah berhasil menerima.
//
// Validasi urutan taskid sesuai catatan spesifikasi: harus dikirim berurutan
// (taskid tidak boleh mundur dari yang terakhir tercatat) dan waktu taskid
// yang lebih besar harus lebih besar dari waktu taskid sebelumnya. Task 99
// (tidak hadir/batal) dikecualikan dari validasi urutan karena bisa terjadi
// kapan saja.
// ============================================================================

var validTaskIds = map[int]bool{1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 99: true}

type UpdateWaktuAntreanRequest struct {
	KodeBooking string `json:"kodebooking"`
	TaskId      int    `json:"taskid"`
	Waktu       int64  `json:"waktu"` // epoch milliseconds
	JenisResep  string `json:"jenisresep"`
}

// validateTaskIdSequence mengembalikan pesan error kalau urutan taskid atau
// waktu tidak konsisten dengan taskid yang sudah tercatat lokal sebelumnya
// untuk no_rawat yang sama.
func validateTaskIdSequence(db *sql.DB, noRawat string, taskId int, waktuMs int64) string {
	if taskId == 99 || strings.TrimSpace(noRawat) == "" {
		return ""
	}
	rows, err := db.Query(`SELECT taskid, waktu FROM referensi_mobilejkn_bpjs_taskid WHERE no_rawat = ? AND taskid != '99'`, noRawat)
	if err != nil {
		return ""
	}
	defer rows.Close()

	maxTaskId := 0
	var maxWaktu time.Time
	for rows.Next() {
		var taskIdStr string
		var waktu time.Time
		if err := rows.Scan(&taskIdStr, &waktu); err != nil {
			continue
		}
		t, errT := strconv.Atoi(taskIdStr)
		if errT == nil && t > maxTaskId {
			maxTaskId = t
			maxWaktu = waktu
		}
	}

	if taskId < maxTaskId {
		return "Urutan Task Id tidak sesuai, harus dikirim berurutan"
	}
	if taskId > maxTaskId && maxTaskId > 0 {
		newWaktu := time.UnixMilli(waktuMs)
		if !newWaktu.After(maxWaktu) {
			return "Waktu Task Id harus lebih besar dari Task Id sebelumnya"
		}
	}
	return ""
}

// updateWaktuAntrean menangani "Update Waktu Antrean" (POST antrean/updatewaktu).
func updateWaktuAntrean(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req UpdateWaktuAntreanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodeBooking) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}
		if !validTaskIds[req.TaskId] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Task Id tidak sesuai"})
			return
		}
		if req.Waktu <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu wajib diisi"})
			return
		}

		var noRawat string
		db.QueryRow(`SELECT COALESCE(no_rawat,'') FROM referensi_mobilejkn_bpjs WHERE nobooking = ?`, req.KodeBooking).Scan(&noRawat)

		if errMsg := validateTaskIdSequence(db, noRawat, req.TaskId, req.Waktu); errMsg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"kodebooking": req.KodeBooking,
			"taskid":      req.TaskId,
			"waktu":       req.Waktu,
		}
		if strings.TrimSpace(req.JenisResep) != "" {
			payload["jenisresep"] = req.JenisResep
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodPost, "antrean/updatewaktu", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		if noRawat != "" {
			waktu := time.UnixMilli(req.Waktu)
			db.Exec(
				`INSERT INTO referensi_mobilejkn_bpjs_taskid (no_rawat, taskid, waktu) VALUES (?, ?, ?)
				 ON DUPLICATE KEY UPDATE waktu = VALUES(waktu)`,
				noRawat, strconv.Itoa(req.TaskId), waktu,
			)
		}

		c.JSON(http.StatusOK, gin.H{"message": "Waktu antrean berhasil dikirim", "response": result})
	}
}

// ============================================================================
// BATAL ANTREAN — POST antrean/batal. Disimpan lokal ke
// referensi_mobilejkn_bpjs_batal (sudah ada di skema Khanza). Tabel ini
// punya foreign key ke referensi_mobilejkn_bpjs(nobooking) dan
// pasien(no_rkm_medis) — jadi kodebooking yang dibatalkan harus sudah
// tercatat lokal dari alur Tambah Antrean (norm-nya pun harus pasien yang
// valid), kalau tidak pembatalan cukup dikirim ke BPJS tanpa dicatat lokal.
// ============================================================================

type BatalAntreanRequest struct {
	KodeBooking string `json:"kodebooking"`
	Keterangan  string `json:"keterangan"`
}

// batalAntrean menangani "Batal Antrean" (POST antrean/batal).
func batalAntrean(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req BatalAntreanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodeBooking) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}
		if strings.TrimSpace(req.Keterangan) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Keterangan/alasan pembatalan wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payload := map[string]interface{}{
			"kodebooking": req.KodeBooking,
			"keterangan":  req.Keterangan,
		}
		bodyJSON, err := json.Marshal(payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodPost, "antrean/batal", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		var noRawat, norm, nomorReferensi string
		errLookup := db.QueryRow(
			`SELECT COALESCE(no_rawat,''), COALESCE(norm,''), COALESCE(nomorreferensi,'') FROM referensi_mobilejkn_bpjs WHERE nobooking = ?`,
			req.KodeBooking,
		).Scan(&noRawat, &norm, &nomorReferensi)
		if errLookup == nil && norm != "" {
			db.Exec(
				`INSERT INTO referensi_mobilejkn_bpjs_batal (no_rkm_medis, no_rawat_batal, nomorreferensi, tanggalbatal, keterangan, statuskirim, nobooking)
				 VALUES (?, ?, ?, NOW(), ?, 'Sudah', ?)
				 ON DUPLICATE KEY UPDATE keterangan=VALUES(keterangan), tanggalbatal=VALUES(tanggalbatal), statuskirim='Sudah'`,
				norm, nullIfEmptyStr(noRawat), nomorReferensi, req.Keterangan, req.KodeBooking,
			)
			db.Exec(`UPDATE referensi_mobilejkn_bpjs SET status = 'Batal' WHERE nobooking = ?`, req.KodeBooking)
		}

		c.JSON(http.StatusOK, gin.H{"message": "Antrean berhasil dibatalkan", "response": result})
	}
}

// getListTaskAntrean menangani "List Waktu Task Id" (POST antrean/getlisttask) —
// menampilkan riwayat waktu task id yang sudah dikirim ke BPJS untuk satu
// kodebooking.
func getListTaskAntrean(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			KodeBooking string `json:"kodebooking"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid"})
			return
		}
		if strings.TrimSpace(req.KodeBooking) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bodyJSON, err := json.Marshal(map[string]interface{}{"kodebooking": req.KodeBooking})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodPost, "antrean/getlisttask", bodyJSON)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"list_task": result})
	}
}

// getDashboardWaktuTunggu menangani "Dashboard Per Tanggal"
// (GET dashboard/waktutunggu/tanggal/{tanggal}/waktu/{rs|server}) —
// menampilkan rata-rata waktu tunggu/layan tiap tahap (task 1-6) per poli
// pada satu tanggal, dicatat sisi RS atau sisi server BPJS.
func getDashboardWaktuTunggu(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		waktu := c.DefaultQuery("waktu", "rs")
		if tanggal == "" {
			tanggal = time.Now().Format("2006-01-02")
		}
		if waktu != "rs" && waktu != "server" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter waktu harus rs atau server"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "dashboard/waktutunggu/tanggal/" + tanggal + "/waktu/" + waktu
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"dashboard": result})
	}
}

// getDashboardWaktuTungguBulan menangani "Dashboard Per Bulan"
// (GET dashboard/waktutunggu/bulan/{bulan}/tahun/{tahun}/waktu/{rs|server}) —
// sama seperti getDashboardWaktuTunggu tapi direkap per bulan, bukan per
// tanggal.
func getDashboardWaktuTungguBulan(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		bulan := c.DefaultQuery("bulan", now.Format("01"))
		tahun := c.DefaultQuery("tahun", now.Format("2006"))
		waktu := c.DefaultQuery("waktu", "rs")

		bulanInt, errB := strconv.Atoi(bulan)
		if errB != nil || bulanInt < 1 || bulanInt > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bulan tidak sesuai"})
			return
		}
		if len(tahun) != 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tahun tidak sesuai"})
			return
		}
		if waktu != "rs" && waktu != "server" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter waktu harus rs atau server"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := fmt.Sprintf("dashboard/waktutunggu/bulan/%02d/tahun/%s/waktu/%s", bulanInt, tahun, waktu)
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"dashboard": result})
	}
}

// getAntreanPendaftaranTanggal menangani "Antrean Per Tanggal"
// (GET antrean/pendaftaran/tanggal/{tanggal}) — menampilkan seluruh
// pendaftaran antrean (dari semua sumber, termasuk Mobile JKN) yang
// tercatat di sisi BPJS untuk satu tanggal, dipakai untuk cek-silang
// terhadap data lokal.
func getAntreanPendaftaranTanggal(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tanggal := strings.TrimSpace(c.Query("tanggal"))
		if tanggal == "" {
			tanggal = time.Now().Format("2006-01-02")
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "antrean/pendaftaran/tanggal/" + tanggal
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"pendaftaran": result})
	}
}

// getAntreanPendaftaranKodeBooking menangani "Antrean Per Kode Booking"
// (GET antrean/pendaftaran/kodebooking/{kodebooking}) — sama seperti
// getAntreanPendaftaranTanggal tapi dicari berdasarkan satu kodebooking,
// dipakai untuk cek-silang satu antrean tertentu terhadap data BPJS.
func getAntreanPendaftaranKodeBooking(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodeBooking := strings.TrimPrefix(c.Param("kodebooking"), "/")
		if kodeBooking == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode booking wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "antrean/pendaftaran/kodebooking/" + kodeBooking
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"pendaftaran": result})
	}
}

// getAntreanPendaftaranAktif menangani "Antrean Belum Dilayani"
// (GET antrean/pendaftaran/aktif) — sama seperti getAntreanPendaftaranTanggal
// tapi tanpa parameter, menampilkan seluruh antrean yang masih aktif
// (belum selesai dilayani) di sisi BPJS.
func getAntreanPendaftaranAktif(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := hfisRequest(cfg, http.MethodGet, "antrean/pendaftaran/aktif", nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"pendaftaran": result})
	}
}

// getAntreanPendaftaranFilter menangani "Antrean Belum Dilayani Per Poli Per
// Dokter Per Hari Per Jam Praktek"
// (GET antrean/pendaftaran/kodepoli/{kodepoli}/kodedokter/{kodedokter}/hari/{hari}/jampraktek/{jampraktek}).
func getAntreanPendaftaranFilter(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		kodePoli := strings.TrimSpace(c.Query("kode_poli"))
		kodeDokter := strings.TrimSpace(c.Query("kode_dokter"))
		hari := strings.TrimSpace(c.Query("hari"))
		jamPraktek := strings.TrimSpace(c.Query("jampraktek"))
		if kodePoli == "" || kodeDokter == "" || hari == "" || jamPraktek == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli, kode dokter, hari, dan jam praktek wajib diisi"})
			return
		}

		cfg, err := getHfisConfig(db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		path := "antrean/pendaftaran/kodepoli/" + kodePoli + "/kodedokter/" + kodeDokter + "/hari/" + hari + "/jampraktek/" + jamPraktek
		result, err := hfisRequest(cfg, http.MethodGet, path, nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"pendaftaran": result})
	}
}

// getReferensiMobileJkn menangani tab "Referensi Pendaftaran Mobile JKN"
// — padanan tampil() di dialog Java asli (nama file tidak diketahui,
// tapi query-nya diberikan langsung oleh user, dikutip verbatim di
// bawah). BEDA PENTING dari percobaan pertama fitur ini (yang salah
// menyamakannya dengan bridging/BPJSAntreanPerTanggal.java): dialog ini
// TIDAK memanggil BPJS sama sekali — murni baca tabel LOKAL
// `referensi_mobilejkn_bpjs` (JOIN `pasien` by norm=no_rkm_medis untuk
// nama pasien), dengan kodepoli/kodedokter di-resolve ke nama BPJS-nya
// lewat lookup terpisah per baris ke `maping_poli_bpjs`/
// `maping_dokter_dpjpvclaim` (bukan JOIN langsung — direplikasi sebagai
// LEFT JOIN di sini, hasilnya sama tapi satu query alih-alih N+1).
// Tidak ada panel statistik SEP Terbit/capaian sama sekali di dialog
// ini — itu murni bagian dari fitur lain (BPJSAntreanPerTanggal.java)
// yang salah dikira jadi tab yang sama.
func getReferensiMobileJkn(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tgl1 := strings.TrimSpace(c.Query("tgl1"))
		tgl2 := strings.TrimSpace(c.Query("tgl2"))
		if tgl1 == "" || tgl2 == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tgl1 dan tgl2 wajib diisi"})
			return
		}
		search := strings.TrimSpace(c.Query("search"))

		query := `
			SELECT r.no_rawat, r.norm, COALESCE(p.nm_pasien,''), r.nohp, r.nomorkartu, r.nik, r.tanggalperiksa,
				COALESCE(mp.nm_poli_bpjs, r.kodepoli), COALESCE(md.nm_dokter_bpjs, r.kodedokter), r.jampraktek,
				r.jeniskunjungan, r.nomorreferensi, r.status,
				IF(r.validasi IS NULL OR r.validasi = '0000-00-00 00:00:00', '', r.validasi), r.nobooking
			FROM referensi_mobilejkn_bpjs r
			INNER JOIN pasien p ON r.norm = p.no_rkm_medis
			LEFT JOIN maping_poli_bpjs mp ON mp.kd_poli_bpjs = r.kodepoli
			LEFT JOIN maping_dokter_dpjpvclaim md ON md.kd_dokter_bpjs = r.kodedokter
			WHERE r.tanggalperiksa BETWEEN ? AND ?
		`
		args := []interface{}{tgl1, tgl2}
		if search != "" {
			query += ` AND (r.no_rawat LIKE ? OR r.norm LIKE ? OR p.nm_pasien LIKE ? OR r.nohp LIKE ? OR r.nomorkartu LIKE ?
				OR r.nik LIKE ? OR r.jeniskunjungan LIKE ? OR r.nomorreferensi LIKE ? OR r.status LIKE ?)`
			pattern := "%" + search + "%"
			for i := 0; i < 9; i++ {
				args = append(args, pattern)
			}
		}
		query += " ORDER BY r.tanggalperiksa"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type referensiMobileJknRow struct {
			NoRawat        string `json:"no_rawat"`
			Norm           string `json:"norm"`
			NmPasien       string `json:"nm_pasien"`
			Nohp           string `json:"nohp"`
			Nomorkartu     string `json:"nomorkartu"`
			Nik            string `json:"nik"`
			Tanggalperiksa string `json:"tanggalperiksa"`
			NamaPoli       string `json:"nama_poli"`
			NamaDokter     string `json:"nama_dokter"`
			Jampraktek     string `json:"jampraktek"`
			Jeniskunjungan string `json:"jeniskunjungan"`
			Nomorreferensi string `json:"nomorreferensi"`
			Status         string `json:"status"`
			Validasi       string `json:"validasi"`
			Nobooking      string `json:"nobooking"`
		}
		list := []referensiMobileJknRow{}
		for rows.Next() {
			var r referensiMobileJknRow
			if rows.Scan(&r.NoRawat, &r.Norm, &r.NmPasien, &r.Nohp, &r.Nomorkartu, &r.Nik, &r.Tanggalperiksa,
				&r.NamaPoli, &r.NamaDokter, &r.Jampraktek, &r.Jeniskunjungan, &r.Nomorreferensi,
				&r.Status, &r.Validasi, &r.Nobooking) == nil {
				list = append(list, r)
			}
		}
		c.JSON(http.StatusOK, list)
	}
}

// ============================================================================
// TASK ID MOBILE JKN — riwayat waktu task id (1-7, 99) yang sudah dikirim ke
// BPJS lintas semua kode booking, dibaca dari tabel lokal
// referensi_mobilejkn_bpjs_taskid (di-join ke referensi_mobilejkn_bpjs lewat
// no_rawat untuk menampilkan konteks booking/poli/no. antrean).
// ============================================================================

type AntreanTaskIdRow struct {
	NoRawat        string `json:"no_rawat"`
	TaskId         string `json:"taskid"`
	Waktu          string `json:"waktu"`
	KodeBooking    string `json:"kodebooking"`
	Norm           string `json:"norm"`
	KodePoli       string `json:"kodepoli"`
	TanggalPeriksa string `json:"tanggalperiksa"`
	NomorAntrean   string `json:"nomorantrean"`
	Status         string `json:"status"`
}

// getAntreanTaskIdList menampilkan riwayat lokal Task Id Mobile JKN untuk
// tabel UI, dengan filter rentang tanggal (berdasarkan waktu taskid) dan
// pencarian bebas (kode booking/no. RM).
func getAntreanTaskIdList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.Query("tgl_dari")
		tglSampai := c.Query("tgl_sampai")
		search := c.Query("search")

		if tglDari == "" {
			tglDari = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		}
		if tglSampai == "" {
			tglSampai = time.Now().Format("2006-01-02")
		}

		query := `
			SELECT t.no_rawat, t.taskid, t.waktu,
				COALESCE(r.nobooking,''), COALESCE(r.norm,''), COALESCE(r.kodepoli,''),
				COALESCE(r.tanggalperiksa,'0000-00-00'), COALESCE(r.nomorantrean,''), COALESCE(r.status,'')
			FROM referensi_mobilejkn_bpjs_taskid t
			LEFT JOIN referensi_mobilejkn_bpjs r ON r.no_rawat = t.no_rawat
			WHERE DATE(t.waktu) BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if search != "" {
			query += ` AND (r.nobooking LIKE ? OR r.norm LIKE ? OR t.no_rawat LIKE ?)`
			pattern := "%" + search + "%"
			args = append(args, pattern, pattern, pattern)
		}
		query += ` ORDER BY t.waktu DESC LIMIT 500`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []AntreanTaskIdRow{}
		for rows.Next() {
			var r AntreanTaskIdRow
			if err := rows.Scan(
				&r.NoRawat, &r.TaskId, &r.Waktu,
				&r.KodeBooking, &r.Norm, &r.KodePoli,
				&r.TanggalPeriksa, &r.NomorAntrean, &r.Status,
			); err != nil {
				continue
			}
			items = append(items, r)
		}
		c.JSON(http.StatusOK, items)
	}
}
