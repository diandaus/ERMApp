package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// satu_sehat_pipeline_handler.go — fitur "Perjalanan Pasien Satu Sehat":
// menelusuri satu kunjungan (no_rawat) dari datang sampai pulang, lalu
// menampilkan status pengiriman setiap resource FHIR yang berlaku untuk
// kunjungan itu (sudah terkirim / belum, dan kalau belum kenapa). Ini murni
// pengecekan pasif terhadap data lokal (tabel sumber vs tabel tracking
// satu_sehat_*) — TIDAK memanggil API Satu Sehat sama sekali, supaya aman
// dipakai untuk memantau tanpa risiko duplikasi kirim.

type PipelineItem struct {
	Key       string             `json:"key"`
	Label     string             `json:"label"`
	Group     string             `json:"group"`
	Total     int                `json:"total"`
	Sent      int                `json:"sent"`
	Status    string             `json:"status"` // terkirim | sebagian | belum_terkirim | tidak_ada_data | menunggu_prasyarat
	Reason    string             `json:"reason,omitempty"`
	LastError *PipelineErrorInfo `json:"last_error,omitempty"`
}

type PipelineErrorInfo struct {
	HTTPStatus int    `json:"http_status"`
	Body       string `json:"body"`
	UpdatedAt  string `json:"updated_at"`
}

// logSatuSehatKirimError menyimpan respons error TERAKHIR dari Satu Sehat utk
// satu instance resource (dipanggil dari sendXSatuSehat/updateXSatuSehat
// begitu resp.StatusCode bukan 200/201), supaya Perjalanan Pasien bisa
// menampilkan kenapa gagal, bukan cuma "belum terkirim". resourceKey harus
// PERSIS sama dgn PipelineItem.Key (mis. "encounter", "observation_ttv_suhu",
// "servicerequest_lab_pk") spy lastSatuSehatKirimError bisa menemukannya.
func logSatuSehatKirimError(db *sql.DB, resourceKey, refKey, noRawat string, httpStatus int, body []byte) {
	db.Exec(`
		INSERT INTO satu_sehat_kirim_error (resource_key, ref_key, no_rawat, http_status, response_body)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE no_rawat = VALUES(no_rawat), http_status = VALUES(http_status),
			response_body = VALUES(response_body), updated_at = CURRENT_TIMESTAMP
	`, resourceKey, refKey, noRawat, httpStatus, string(body))
}

// clearSatuSehatKirimError dipanggil begitu kirim/update resource itu
// BERHASIL, supaya error lama tidak terus nyangkut walau datanya sudah
// terkirim (mis. gagal karena mapping belum ada, lalu berhasil setelah
// mapping dilengkapi dan dikirim ulang).
func clearSatuSehatKirimError(db *sql.DB, resourceKey, refKey string) {
	db.Exec(`DELETE FROM satu_sehat_kirim_error WHERE resource_key = ? AND ref_key = ?`, resourceKey, refKey)
}

// lastSatuSehatKirimError dipakai getSatuSehatPipelineDetail — ambil error
// TERBARU utk satu resourceKey pada satu kunjungan (no_rawat), tanpa peduli
// instance mana persisnya (kd_penyakit/noorder/no_resep dst) yg gagal.
func lastSatuSehatKirimError(db *sql.DB, resourceKey, noRawat string) *PipelineErrorInfo {
	var info PipelineErrorInfo
	err := db.QueryRow(`
		SELECT http_status, response_body, updated_at FROM satu_sehat_kirim_error
		WHERE resource_key = ? AND no_rawat = ? ORDER BY updated_at DESC LIMIT 1
	`, resourceKey, noRawat).Scan(&info.HTTPStatus, &info.Body, &info.UpdatedAt)
	if err != nil {
		return nil
	}
	return &info
}

// finalize menetapkan Status/Reason berdasar Total/Sent yg sudah dihitung,
// dan prereqOK/prereqReason (mis. "Encounter belum terkirim") yg dicek
// terpisah oleh masing-masing pemanggil sesuai gating aslinya di
// getXCandidates masing-masing resource.
func (it *PipelineItem) finalize(prereqOK bool, prereqReason string, db *sql.DB, noRawat string) {
	if it.Total == 0 {
		it.Status = "tidak_ada_data"
		return
	}
	if !prereqOK {
		it.Status = "menunggu_prasyarat"
		it.Reason = prereqReason
		return
	}
	switch {
	case it.Sent == 0:
		it.Status = "belum_terkirim"
		it.Reason = "Ada data tapi belum pernah dikirim ke Satu Sehat"
		it.LastError = lastSatuSehatKirimError(db, it.Key, noRawat)
	case it.Sent < it.Total:
		it.Status = "sebagian"
		it.Reason = fmt.Sprintf("%d dari %d data belum terkirim", it.Total-it.Sent, it.Total)
		it.LastError = lastSatuSehatKirimError(db, it.Key, noRawat)
	default:
		it.Status = "terkirim"
	}
}

// countSentRows menjalankan query yg SELECT-nya persis 1 kolom (id resource,
// '' kalau belum terkirim), lalu menghitung total baris vs baris yg id-nya
// sudah terisi.
func countSentRows(db *sql.DB, query string, args ...interface{}) (total, sent int, err error) {
	rows, err := db.Query(query, args...)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var id sql.NullString
		if scanErr := rows.Scan(&id); scanErr != nil {
			continue
		}
		total++
		if id.Valid && strings.TrimSpace(id.String) != "" {
			sent++
		}
	}
	return total, sent, rows.Err()
}

// GET /api/satu-sehat/pipeline?tgl_dari=&tgl_sampai=&q= — daftar kunjungan
// utk dicari (mirip daftar Encounter), dipakai sbg pintu masuk sebelum lihat
// detail perjalanan satu kunjungan.
func getSatuSehatPipelineList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		tglDari := c.DefaultQuery("tgl_dari", time.Now().Format("2006-01-02"))
		tglSampai := c.DefaultQuery("tgl_sampai", time.Now().Format("2006-01-02"))
		keyword := strings.TrimSpace(c.Query("q"))

		query := `
			SELECT
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.jam_reg, reg_periksa.no_rawat,
				reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pegawai.nama,''),
				IFNULL(poliklinik.nm_poli,''), reg_periksa.stts, reg_periksa.status_lanjut,
				IFNULL(satu_sehat_encounter.id_encounter,'')
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN pegawai ON pegawai.nik = reg_periksa.kd_dokter
			LEFT JOIN poliklinik ON poliklinik.kd_poli = reg_periksa.kd_poli
			LEFT JOIN satu_sehat_encounter ON satu_sehat_encounter.no_rawat = reg_periksa.no_rawat
			WHERE reg_periksa.tgl_registrasi BETWEEN ? AND ?
		`
		args := []interface{}{tglDari, tglSampai}
		if keyword != "" {
			query += ` AND (reg_periksa.no_rawat LIKE ? OR reg_periksa.no_rkm_medis LIKE ? OR pasien.nm_pasien LIKE ? OR pegawai.nama LIKE ?)`
			kw := "%" + keyword + "%"
			args = append(args, kw, kw, kw, kw)
		}
		query += " ORDER BY reg_periksa.tgl_registrasi DESC, reg_periksa.jam_reg DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type row struct {
			TglRegistrasi string `json:"tgl_registrasi"`
			JamReg        string `json:"jam_reg"`
			NoRawat       string `json:"no_rawat"`
			NoRM          string `json:"no_rm"`
			NamaPasien    string `json:"nama_pasien"`
			NamaDokter    string `json:"nama_dokter"`
			NamaPoli      string `json:"nama_poli"`
			SttsRawat     string `json:"stts_rawat"`
			SttsLanjut    string `json:"stts_lanjut"`
			IDEncounter   string `json:"id_encounter"`
		}
		list := []row{}
		for rows.Next() {
			var r row
			if err := rows.Scan(&r.TglRegistrasi, &r.JamReg, &r.NoRawat, &r.NoRM, &r.NamaPasien,
				&r.NamaDokter, &r.NamaPoli, &r.SttsRawat, &r.SttsLanjut, &r.IDEncounter); err != nil {
				continue
			}
			r.TglRegistrasi = sqlDateOnly(r.TglRegistrasi)
			list = append(list, r)
		}
		c.JSON(http.StatusOK, gin.H{"list": list, "total": len(list)})
	}
}

// GET /api/satu-sehat/pipeline/detail/*no_rawat — checklist lengkap semua
// resource FHIR yg berlaku utk satu kunjungan, sudah terkirim sampai mana
// dan kenapa kalau belum.
func getSatuSehatPipelineDetail(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noRawat := c.Param("no_rawat")
		if len(noRawat) > 0 && noRawat[0] == '/' {
			noRawat = noRawat[1:]
		}
		if noRawat == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no_rawat wajib diisi"})
			return
		}

		var base struct {
			NoRkmMedis    string
			NamaPasien    string
			NoKtpPasien   string
			KdDokter      string
			NamaDokter    string
			NoKtpDokter   string
			KdPoli        string
			NamaPoli      string
			TglRegistrasi string
			JamReg        string
			SttsRawat     string
			SttsLanjut    string
		}
		err := db.QueryRow(`
			SELECT
				reg_periksa.no_rkm_medis, pasien.nm_pasien, IFNULL(pasien.no_ktp,''),
				reg_periksa.kd_dokter, IFNULL(pegawai.nama,''), IFNULL(pegawai.no_ktp,''),
				reg_periksa.kd_poli, IFNULL(poliklinik.nm_poli,''),
				IFNULL(reg_periksa.tgl_registrasi,''), reg_periksa.jam_reg, reg_periksa.stts, reg_periksa.status_lanjut
			FROM reg_periksa
			INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis
			LEFT JOIN pegawai ON pegawai.nik = reg_periksa.kd_dokter
			LEFT JOIN poliklinik ON poliklinik.kd_poli = reg_periksa.kd_poli
			WHERE reg_periksa.no_rawat = ?
		`, noRawat).Scan(&base.NoRkmMedis, &base.NamaPasien, &base.NoKtpPasien, &base.KdDokter, &base.NamaDokter,
			&base.NoKtpDokter, &base.KdPoli, &base.NamaPoli, &base.TglRegistrasi, &base.JamReg, &base.SttsRawat, &base.SttsLanjut)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan (no_rawat) tidak ditemukan"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		base.TglRegistrasi = sqlDateOnly(base.TglRegistrasi)

		pemeriksaanTable := "pemeriksaan_ralan"
		if base.SttsLanjut == "Ranap" {
			pemeriksaanTable = "pemeriksaan_ranap"
		}

		items := []PipelineItem{}

		// --- Encounter ---
		var idEncounter string
		db.QueryRow(`SELECT IFNULL(id_encounter,'') FROM satu_sehat_encounter WHERE no_rawat = ?`, noRawat).Scan(&idEncounter)
		encounterSent := idEncounter != ""
		encItem := PipelineItem{Key: "encounter", Label: "Encounter (Kedatangan Pasien)", Group: "utama", Total: 1}
		if encounterSent {
			encItem.Sent = 1
			encItem.Status = "terkirim"
		} else {
			var idLokasi sql.NullString
			db.QueryRow(`SELECT id_lokasi_satusehat FROM satu_sehat_mapping_lokasi_ralan WHERE kd_poli = ?`, base.KdPoli).Scan(&idLokasi)
			switch {
			case !idLokasi.Valid || idLokasi.String == "":
				encItem.Status = "belum_terkirim"
				encItem.Reason = "Poli '" + base.NamaPoli + "' belum punya Mapping Lokasi Satu Sehat"
			case base.NoKtpPasien == "" || base.NoKtpPasien == "-":
				encItem.Status = "belum_terkirim"
				encItem.Reason = "Pasien belum punya Nomor KTP di data lokal"
			case base.NoKtpDokter == "" || base.NoKtpDokter == "-":
				encItem.Status = "belum_terkirim"
				encItem.Reason = "Dokter penanggung jawab belum punya Nomor KTP di data lokal"
			default:
				encItem.Status = "belum_terkirim"
				encItem.Reason = "Belum pernah dikirim ke Satu Sehat"
				encItem.LastError = lastSatuSehatKirimError(db, encItem.Key, noRawat)
			}
		}
		items = append(items, encItem)

		// --- Condition (diagnosa) ---
		condTotal, condSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_condition.id_condition,'')
			FROM diagnosa_pasien
			INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
			LEFT JOIN satu_sehat_condition ON satu_sehat_condition.no_rawat = diagnosa_pasien.no_rawat
				AND satu_sehat_condition.kd_penyakit = diagnosa_pasien.kd_penyakit
				AND satu_sehat_condition.status = diagnosa_pasien.status
			WHERE diagnosa_pasien.no_rawat = ?
		`, noRawat)
		condItem := PipelineItem{Key: "condition", Label: "Condition (Diagnosa)", Group: "utama", Total: condTotal, Sent: condSent}
		condItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, condItem)
		conditionSentAny := condSent > 0

		// --- Observation TTV (10 jenis tanda vital) ---
		for _, jenis := range []string{"suhu", "respirasi", "nadi", "spo2", "gcs", "kesadaran", "tensi", "tb", "bb", "lp"} {
			def := observationTTVDefs[jenis]
			total, sent, _ := countSentRows(db, fmt.Sprintf(`
				SELECT IFNULL(%[2]s.id_observation,'')
				FROM %[1]s
				LEFT JOIN %[2]s ON %[2]s.no_rawat = %[1]s.no_rawat
					AND %[2]s.tgl_perawatan = %[1]s.tgl_perawatan AND %[2]s.jam_rawat = %[1]s.jam_rawat
					AND %[2]s.status = ?
				WHERE %[1]s.no_rawat = ? AND %[1]s.%[3]s <> ''
			`, pemeriksaanTable, def.Table, def.Kolom), base.SttsLanjut, noRawat)
			it := PipelineItem{Key: "observation_ttv_" + jenis, Label: "Observation TTV - " + def.Label, Group: "observasi_ttv", Total: total, Sent: sent}
			it.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
			items = append(items, it)
		}

		// --- Procedure ---
		procTotal, procSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_procedure.id_procedure,'')
			FROM prosedur_pasien
			INNER JOIN icd9 ON prosedur_pasien.kode = icd9.kode
			LEFT JOIN satu_sehat_procedure ON satu_sehat_procedure.no_rawat = prosedur_pasien.no_rawat
				AND satu_sehat_procedure.kode = prosedur_pasien.kode AND satu_sehat_procedure.status = prosedur_pasien.status
			WHERE prosedur_pasien.no_rawat = ?
		`, noRawat)
		procItem := PipelineItem{Key: "procedure", Label: "Procedure (Tindakan)", Group: "utama", Total: procTotal, Sent: procSent}
		procItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, procItem)

		// --- AllergyIntolerance ---
		allergyTotal, allergySent, _ := countSentRows(db, fmt.Sprintf(`
			SELECT IFNULL(satu_sehat_allergy_intolerance.id_allergy_intolerance,'')
			FROM %[1]s
			LEFT JOIN satu_sehat_allergy_intolerance ON satu_sehat_allergy_intolerance.no_rawat = %[1]s.no_rawat
				AND satu_sehat_allergy_intolerance.tgl_perawatan = %[1]s.tgl_perawatan
				AND satu_sehat_allergy_intolerance.jam_rawat = %[1]s.jam_rawat
				AND satu_sehat_allergy_intolerance.status = ?
			WHERE %[1]s.no_rawat = ? AND %[1]s.alergi <> ''
		`, pemeriksaanTable), base.SttsLanjut, noRawat)
		allergyItem := PipelineItem{Key: "allergy_intolerance", Label: "AllergyIntolerance (Alergi)", Group: "utama", Total: allergyTotal, Sent: allergySent}
		allergyItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, allergyItem)

		// --- MedicationDispense (obat yg diserahkan) ---
		mdTotal, mdSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_medicationdispense.id_medicationdispanse,'')
			FROM resep_obat
			INNER JOIN detail_pemberian_obat ON detail_pemberian_obat.no_rawat = resep_obat.no_rawat
				AND detail_pemberian_obat.tgl_perawatan = resep_obat.tgl_perawatan AND detail_pemberian_obat.jam = resep_obat.jam
			INNER JOIN aturan_pakai ON aturan_pakai.no_rawat = detail_pemberian_obat.no_rawat
				AND aturan_pakai.tgl_perawatan = detail_pemberian_obat.tgl_perawatan AND aturan_pakai.jam = detail_pemberian_obat.jam
				AND aturan_pakai.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN bangsal ON bangsal.kd_bangsal = detail_pemberian_obat.kd_bangsal
			INNER JOIN satu_sehat_mapping_lokasi_depo_farmasi ON satu_sehat_mapping_lokasi_depo_farmasi.kd_bangsal = bangsal.kd_bangsal
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationdispense ON satu_sehat_medicationdispense.no_rawat = detail_pemberian_obat.no_rawat
				AND satu_sehat_medicationdispense.tgl_perawatan = detail_pemberian_obat.tgl_perawatan
				AND satu_sehat_medicationdispense.jam = detail_pemberian_obat.jam
				AND satu_sehat_medicationdispense.kode_brng = detail_pemberian_obat.kode_brng
				AND satu_sehat_medicationdispense.no_batch = detail_pemberian_obat.no_batch
				AND satu_sehat_medicationdispense.no_faktur = detail_pemberian_obat.no_faktur
			WHERE resep_obat.no_rawat = ?
		`, noRawat)
		mdItem := PipelineItem{Key: "medication_dispense", Label: "MedicationDispense (Penyerahan Obat)", Group: "utama", Total: mdTotal, Sent: mdSent}
		if mdTotal == 0 {
			var rawResepCount int
			db.QueryRow(`SELECT COUNT(*) FROM detail_pemberian_obat WHERE no_rawat = ?`, noRawat).Scan(&rawResepCount)
			mdItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
			if rawResepCount > 0 {
				mdItem.Status = "menunggu_prasyarat"
				mdItem.Reason = "Ada obat yg diserahkan tapi belum ada Mapping Obat/Lokasi Depo Farmasi Satu Sehat yg cocok"
			}
		} else {
			mdItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		}
		items = append(items, mdItem)

		// --- MedicationStatement (resep dokter, non-racikan + racikan) ---
		msTotal, msSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_medicationstatement.id_medicationstatement,'')
			FROM resep_obat
			INNER JOIN resep_dokter ON resep_dokter.no_resep = resep_obat.no_resep
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationstatement ON satu_sehat_medicationstatement.no_resep = resep_dokter.no_resep
				AND satu_sehat_medicationstatement.kode_brng = resep_dokter.kode_brng
			WHERE resep_obat.no_rawat = ? AND resep_obat.tgl_penyerahan <> '0000-00-00'
		`, noRawat)
		msRacikanTotal, msRacikanSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_medicationstatement_racikan.id_medicationstatement,'')
			FROM resep_obat
			INNER JOIN resep_dokter_racikan ON resep_dokter_racikan.no_resep = resep_obat.no_resep
			INNER JOIN resep_dokter_racikan_detail ON resep_dokter_racikan_detail.no_resep = resep_dokter_racikan.no_resep
				AND resep_dokter_racikan_detail.no_racik = resep_dokter_racikan.no_racik
			INNER JOIN satu_sehat_mapping_obat ON satu_sehat_mapping_obat.kode_brng = resep_dokter_racikan_detail.kode_brng
			INNER JOIN satu_sehat_medication ON satu_sehat_medication.kode_brng = satu_sehat_mapping_obat.kode_brng
			LEFT JOIN satu_sehat_medicationstatement_racikan ON satu_sehat_medicationstatement_racikan.no_resep = resep_dokter_racikan.no_resep
				AND satu_sehat_medicationstatement_racikan.kode_brng = resep_dokter_racikan_detail.kode_brng
				AND satu_sehat_medicationstatement_racikan.no_racik = resep_dokter_racikan_detail.no_racik
			WHERE resep_obat.no_rawat = ? AND resep_obat.tgl_penyerahan <> '0000-00-00'
		`, noRawat)
		msItem := PipelineItem{
			Key: "medication_statement", Label: "MedicationStatement (Resep Dokter)", Group: "utama",
			Total: msTotal + msRacikanTotal, Sent: msSent + msRacikanSent,
		}
		msItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, msItem)

		// --- ClinicalImpression (butuh Condition sudah terkirim) ---
		ciTotal, ciSent, _ := countSentRows(db, fmt.Sprintf(`
			SELECT IFNULL(satu_sehat_clinicalimpression.id_clinicalimpression,'')
			FROM %[1]s pe
			LEFT JOIN satu_sehat_clinicalimpression ON satu_sehat_clinicalimpression.no_rawat = pe.no_rawat
				AND satu_sehat_clinicalimpression.tgl_perawatan = pe.tgl_perawatan
				AND satu_sehat_clinicalimpression.jam_rawat = pe.jam_rawat
				AND satu_sehat_clinicalimpression.status = ?
			WHERE pe.no_rawat = ? AND pe.penilaian <> ''
		`, pemeriksaanTable), base.SttsLanjut, noRawat)
		ciItem := PipelineItem{Key: "clinical_impression", Label: "ClinicalImpression (Penilaian Klinis)", Group: "utama", Total: ciTotal, Sent: ciSent}
		ciItem.finalize(conditionSentAny, "Menunggu Condition (diagnosa) terkirim terlebih dahulu", db, noRawat)
		items = append(items, ciItem)

		// --- Composition (Diet/ADIME Gizi) ---
		compTotal, compSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_diet.id_diet,'')
			FROM catatan_adime_gizi
			LEFT JOIN satu_sehat_diet ON satu_sehat_diet.no_rawat = catatan_adime_gizi.no_rawat
				AND satu_sehat_diet.tanggal = catatan_adime_gizi.tanggal
			WHERE catatan_adime_gizi.no_rawat = ? AND catatan_adime_gizi.instruksi <> ''
		`, noRawat)
		compItem := PipelineItem{Key: "composition", Label: "Composition (Asuhan Gizi/Diet)", Group: "utama", Total: compTotal, Sent: compSent}
		compItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, compItem)

		// --- CarePlan ---
		cpTotal, cpSent, _ := countSentRows(db, fmt.Sprintf(`
			SELECT IFNULL(satu_sehat_careplan.id_careplan,'')
			FROM %[1]s pe
			LEFT JOIN satu_sehat_careplan ON satu_sehat_careplan.no_rawat = pe.no_rawat
				AND satu_sehat_careplan.tgl_perawatan = pe.tgl_perawatan AND satu_sehat_careplan.jam_rawat = pe.jam_rawat
				AND satu_sehat_careplan.status = ?
			WHERE pe.no_rawat = ? AND pe.rtl <> ''
		`, pemeriksaanTable), base.SttsLanjut, noRawat)
		cpItem := PipelineItem{Key: "careplan", Label: "CarePlan (Rencana Tindak Lanjut)", Group: "utama", Total: cpTotal, Sent: cpSent}
		cpItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, cpItem)

		// --- EpisodeOfCare (khusus diagnosa Bab O - Kehamilan/ANC) ---
		var eocQuery string
		if base.SttsLanjut == "Ranap" {
			eocQuery = `
				SELECT IFNULL(satu_sehat_episodeofcare.id_episodeofcare,'')
				FROM kamar_inap
				INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = kamar_inap.no_rawat AND diagnosa_pasien.status = 'Ranap'
				LEFT JOIN satu_sehat_episodeofcare ON satu_sehat_episodeofcare.no_rawat = diagnosa_pasien.no_rawat
					AND satu_sehat_episodeofcare.kd_penyakit = diagnosa_pasien.kd_penyakit AND satu_sehat_episodeofcare.status = diagnosa_pasien.status
				WHERE kamar_inap.no_rawat = ? AND diagnosa_pasien.kd_penyakit LIKE '%O%'
			`
		} else {
			eocQuery = `
				SELECT IFNULL(satu_sehat_episodeofcare.id_episodeofcare,'')
				FROM pemeriksaan_ralan
				INNER JOIN diagnosa_pasien ON diagnosa_pasien.no_rawat = pemeriksaan_ralan.no_rawat AND diagnosa_pasien.status = 'Ralan'
				LEFT JOIN satu_sehat_episodeofcare ON satu_sehat_episodeofcare.no_rawat = diagnosa_pasien.no_rawat
					AND satu_sehat_episodeofcare.kd_penyakit = diagnosa_pasien.kd_penyakit AND satu_sehat_episodeofcare.status = diagnosa_pasien.status
				WHERE pemeriksaan_ralan.no_rawat = ? AND diagnosa_pasien.kd_penyakit LIKE '%O%'
			`
		}
		eocTotal, eocSent, _ := countSentRows(db, eocQuery, noRawat)
		eocItem := PipelineItem{Key: "episode_of_care", Label: "EpisodeOfCare (Antenatal Care)", Group: "utama", Total: eocTotal, Sent: eocSent}
		eocItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, eocItem)

		// --- Immunization ---
		immTotal, immSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_immunization.id_immunization,'')
			FROM detail_pemberian_obat
			INNER JOIN satu_sehat_mapping_vaksin ON satu_sehat_mapping_vaksin.kode_brng = detail_pemberian_obat.kode_brng
			INNER JOIN aturan_pakai ON aturan_pakai.tgl_perawatan = detail_pemberian_obat.tgl_perawatan
				AND aturan_pakai.jam = detail_pemberian_obat.jam AND aturan_pakai.no_rawat = detail_pemberian_obat.no_rawat
				AND aturan_pakai.kode_brng = detail_pemberian_obat.kode_brng
			LEFT JOIN satu_sehat_immunization ON satu_sehat_immunization.no_rawat = detail_pemberian_obat.no_rawat
				AND satu_sehat_immunization.tgl_perawatan = detail_pemberian_obat.tgl_perawatan
				AND satu_sehat_immunization.jam = detail_pemberian_obat.jam
				AND satu_sehat_immunization.kode_brng = detail_pemberian_obat.kode_brng
				AND satu_sehat_immunization.no_batch = detail_pemberian_obat.no_batch
				AND satu_sehat_immunization.no_faktur = detail_pemberian_obat.no_faktur
			WHERE detail_pemberian_obat.no_rawat = ? AND detail_pemberian_obat.no_batch <> ''
		`, noRawat)
		immItem := PipelineItem{Key: "immunization", Label: "Immunization (Vaksinasi)", Group: "utama", Total: immTotal, Sent: immSent}
		immItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, immItem)

		// --- QuestionnaireResponse (Telaah Resep Farmasi) ---
		qrTotal, qrSent, _ := countSentRows(db, `
			SELECT IFNULL(satu_sehat_questionresponse_telaah_farmasi.id_questionresponse,'')
			FROM resep_obat
			INNER JOIN telaah_farmasi ON telaah_farmasi.no_resep = resep_obat.no_resep
			LEFT JOIN satu_sehat_questionresponse_telaah_farmasi ON satu_sehat_questionresponse_telaah_farmasi.no_resep = resep_obat.no_resep
			WHERE resep_obat.no_rawat = ?
		`, noRawat)
		qrItem := PipelineItem{Key: "questionnaire_response", Label: "QuestionnaireResponse (Telaah Resep Farmasi)", Group: "utama", Total: qrTotal, Sent: qrSent}
		qrItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, qrItem)

		// --- Radiologi (ServiceRequest -> Specimen -> Observation -> DiagnosticReport -> ImagingStudy) ---
		radBase := `
			FROM permintaan_radiologi pr
			INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
			INNER JOIN satu_sehat_mapping_radiologi m ON m.kd_jenis_prw = ppr.kd_jenis_prw
			LEFT JOIN %s t ON t.noorder = ppr.noorder AND t.kd_jenis_prw = ppr.kd_jenis_prw
			WHERE pr.no_rawat = ?
		`
		srRadTotal, srRadSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_servicerequest,'') "+radBase, "satu_sehat_servicerequest_radiologi"), noRawat)
		srRadItem := PipelineItem{Key: "servicerequest_radiologi", Label: "ServiceRequest Radiologi", Group: "radiologi", Total: srRadTotal, Sent: srRadSent}
		srRadItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, srRadItem)

		specRadTotal, specRadSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_specimen,'') "+radBase, "satu_sehat_specimen_radiologi"), noRawat)
		specRadItem := PipelineItem{Key: "specimen_radiologi", Label: "Specimen Radiologi", Group: "radiologi", Total: specRadTotal, Sent: specRadSent}
		specRadItem.finalize(srRadSent > 0, "Menunggu ServiceRequest Radiologi terkirim terlebih dahulu", db, noRawat)
		items = append(items, specRadItem)

		obsRadTotal, obsRadSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_observation,'') "+radBase, "satu_sehat_observation_radiologi"), noRawat)
		obsRadItem := PipelineItem{Key: "observation_radiologi", Label: "Observation Radiologi", Group: "radiologi", Total: obsRadTotal, Sent: obsRadSent}
		obsRadItem.finalize(specRadSent > 0, "Menunggu Specimen Radiologi terkirim terlebih dahulu", db, noRawat)
		items = append(items, obsRadItem)

		drRadTotal, drRadSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_diagnosticreport,'') "+radBase, "satu_sehat_diagnosticreport_radiologi"), noRawat)
		drRadItem := PipelineItem{Key: "diagnosticreport_radiologi", Label: "DiagnosticReport Radiologi", Group: "radiologi", Total: drRadTotal, Sent: drRadSent}
		drRadItem.finalize(obsRadSent > 0, "Menunggu Observation Radiologi terkirim terlebih dahulu", db, noRawat)
		items = append(items, drRadItem)

		imgTotal, imgSent, _ := countSentRows(db, `
			SELECT IFNULL(si.id_imagingstudy,'')
			FROM permintaan_radiologi pr
			LEFT JOIN satu_sehat_imagingstudy si ON si.noorder = pr.noorder
			WHERE pr.no_rawat = ?
		`, noRawat)
		imgItem := PipelineItem{Key: "imagingstudy", Label: "ImagingStudy", Group: "radiologi", Total: imgTotal, Sent: imgSent}
		imgItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
		items = append(items, imgItem)

		// --- Lab PK & MB (ServiceRequest -> Specimen -> Observation -> DiagnosticReport) ---
		for jenis, label := range map[string]string{"pk": "Patologi Klinik", "mb": "Mikrobiologi"} {
			permintaanTable := serviceRequestLabDefs[jenis].PermintaanTable
			detailTable := serviceRequestLabDefs[jenis].DetailTable

			labBase := fmt.Sprintf(`
				FROM %s pl
				INNER JOIN %s dpl ON dpl.noorder = pl.noorder
				INNER JOIN satu_sehat_mapping_lab m ON m.id_template = dpl.id_template
				LEFT JOIN %%s t ON t.noorder = dpl.noorder AND t.kd_jenis_prw = dpl.kd_jenis_prw
				WHERE pl.no_rawat = ?
			`, permintaanTable, detailTable)

			srTotal, srSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_servicerequest,'') "+labBase, serviceRequestLabDefs[jenis].TrackingTable), noRawat)
			srItem := PipelineItem{Key: "servicerequest_lab_" + jenis, Label: "ServiceRequest Lab " + label, Group: "lab_" + jenis, Total: srTotal, Sent: srSent}
			srItem.finalize(encounterSent, "Menunggu Encounter terkirim terlebih dahulu", db, noRawat)
			items = append(items, srItem)

			specTotal, specSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_specimen,'') "+labBase, specimenLabDefs[jenis].TrackingTable), noRawat)
			specItem := PipelineItem{Key: "specimen_lab_" + jenis, Label: "Specimen Lab " + label, Group: "lab_" + jenis, Total: specTotal, Sent: specSent}
			specItem.finalize(srSent > 0, "Menunggu ServiceRequest Lab "+label+" terkirim terlebih dahulu", db, noRawat)
			items = append(items, specItem)

			obsTotal, obsSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_observation,'') "+labBase, observationLabDefs[jenis].TrackingTable), noRawat)
			obsItem := PipelineItem{Key: "observation_lab_" + jenis, Label: "Observation Lab " + label, Group: "lab_" + jenis, Total: obsTotal, Sent: obsSent}
			obsItem.finalize(specSent > 0, "Menunggu Specimen Lab "+label+" terkirim terlebih dahulu", db, noRawat)
			items = append(items, obsItem)

			drTotal, drSent, _ := countSentRows(db, fmt.Sprintf("SELECT IFNULL(t.id_diagnosticreport,'') "+labBase, diagnosticReportLabDefs[jenis].TrackingTable), noRawat)
			drItem := PipelineItem{Key: "diagnosticreport_lab_" + jenis, Label: "DiagnosticReport Lab " + label, Group: "lab_" + jenis, Total: drTotal, Sent: drSent}
			drItem.finalize(obsSent > 0, "Menunggu Observation Lab "+label+" terkirim terlebih dahulu", db, noRawat)
			items = append(items, drItem)
		}

		c.JSON(http.StatusOK, gin.H{
			"no_rawat":       noRawat,
			"no_rkm_medis":   base.NoRkmMedis,
			"nama_pasien":    base.NamaPasien,
			"nama_dokter":    base.NamaDokter,
			"nama_poli":      base.NamaPoli,
			"tgl_registrasi": base.TglRegistrasi,
			"jam_reg":        base.JamReg,
			"stts_rawat":     base.SttsRawat,
			"stts_lanjut":    base.SttsLanjut,
			"id_encounter":   idEncounter,
			"items":          items,
		})
	}
}
