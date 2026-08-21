package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ============================================================================
// WORKER ANTREAN BPJS OTOMATIS — memproses baris "pending" di
// bridging_antrean_queue (diisi oleh trigger trg_after_bridging_sep_insert_antrean_bpjs,
// lihat bridging_antrean_queue_handler.go) dengan memanggil BPJS
// "Tambah Antrean" (createAntreanRsBpjs, di bridging_antrean_handler.go).
//
// Trigger MySQL tidak bisa memanggil HTTP API, jadi ia hanya menitipkan
// identitas kunjungan (no_rawat, kd_poli/dokter versi BPJS, no_rujukan, dst).
// Worker inilah yang melengkapi sisanya:
//   - jampraktek & kapasitas kuota: dari HFIS "Referensi Jadwal Dokter"
//     (data ini milik BPJS, bukan tabel lokal — harus tanya live).
//   - nomor antrean & sisa kuota hari itu: dihitung sendiri oleh RS dari
//     berapa banyak antrean yang sudah dibuat untuk dokter+tanggal yang
//     sama (referensi_mobilejkn_bpjs) — sesuai spec Tambah Antrean, field
//     ini memang tanggung jawab RS melaporkan, bukan dihitung BPJS.
//   - kodebooking: dibuat deterministik dari no_rawat (unik per kunjungan).
// ============================================================================

const (
	antreanQueuePollInterval   = 30 * time.Second
	antreanQueueBatchSize      = 20
	antreanQueueMenitPerPasien = 10 // estimasi kasar durasi per pasien, dipakai hitung estimasidilayani
	antreanQueueKeteranganUmum = "Antrean dibuat otomatis oleh sistem saat SEP diterbitkan."
)

// startAntreanQueueWorker menjalankan loop background pemroses queue.
// Dipanggil sekali dari main() saat startup.
func startAntreanQueueWorker(db *sql.DB) {
	go func() {
		for {
			processAntreanQueueBatch(db)
			time.Sleep(antreanQueuePollInterval)
		}
	}()
	log.Println("✓ Worker antrean BPJS otomatis berjalan (poll tiap", antreanQueuePollInterval, ")")
}

func processAntreanQueueBatch(db *sql.DB) {
	if !isAntreanOtomatisEnabled(db) {
		// Dimatikan lewat tab "Antrean Otomatis" (mis. staf sedang pakai
		// fitur Tambah Antrean bawaan Khanza Desktop) — baris tetap masuk
		// antrian (trigger tidak tahu soal saklar ini) tapi dibiarkan
		// 'pending' sampai dinyalakan lagi, supaya tidak ada yang hilang.
		return
	}

	rows, err := db.Query(`SELECT id FROM bridging_antrean_queue WHERE status = 'pending' ORDER BY id LIMIT ?`, antreanQueueBatchSize)
	if err != nil {
		log.Printf("antrean-queue: gagal ambil daftar pending: %v", err)
		return
	}
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()

	for _, id := range ids {
		processAntreanQueueItem(db, id)
	}
}

// antreanQueueRow adalah baris bridging_antrean_queue yang sudah diklaim
// (status diubah ke 'processing') dan siap dilengkapi lalu dikirim ke BPJS.
type antreanQueueRow struct {
	NoRawat        string
	NoRkmMedis     string
	KdPoli         sql.NullString
	KodePoliBpjs   sql.NullString
	NamaPoliBpjs   sql.NullString
	KodeDokterBpjs sql.NullString
	NamaDokterBpjs sql.NullString
	TglRegistrasi  string
	JamReg         sql.NullString
	StatusPoli     sql.NullString
	NoPeserta      sql.NullString
	NoRujukan      sql.NullString
	JenisKunjungan int
}

func processAntreanQueueItem(db *sql.DB, id int) {
	// Klaim baris dulu (pending -> processing) supaya aman kalau dipanggil
	// tumpang tindih (misalnya restart di tengah proses sebelumnya).
	res, err := db.Exec(`UPDATE bridging_antrean_queue SET status = 'processing' WHERE id = ? AND status = 'pending'`, id)
	if err != nil {
		log.Printf("antrean-queue #%d: gagal klaim baris: %v", id, err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return // sudah diproses/diklaim proses lain
	}

	var q antreanQueueRow
	err = db.QueryRow(`
		SELECT no_rawat, no_rkm_medis, kd_poli, kodepoli_bpjs, namapoli_bpjs, kodedokter_bpjs, namadokter_bpjs,
			tgl_registrasi, jam_reg, status_poli, no_peserta, no_rujukan, jeniskunjungan
		FROM bridging_antrean_queue WHERE id = ?
	`, id).Scan(&q.NoRawat, &q.NoRkmMedis, &q.KdPoli, &q.KodePoliBpjs, &q.NamaPoliBpjs, &q.KodeDokterBpjs, &q.NamaDokterBpjs,
		&q.TglRegistrasi, &q.JamReg, &q.StatusPoli, &q.NoPeserta, &q.NoRujukan, &q.JenisKunjungan)
	if err != nil {
		markAntreanQueueError(db, id, "gagal baca data antrian: "+err.Error())
		return
	}

	if !q.KodePoliBpjs.Valid || q.KodePoliBpjs.String == "" {
		markAntreanQueueError(db, id, "kode poli BPJS belum terpetakan (cek tabel maping_poli_bpjs)")
		return
	}
	if !q.KodeDokterBpjs.Valid || strings.TrimSpace(q.KodeDokterBpjs.String) == "" {
		markAntreanQueueError(db, id, "kode dokter BPJS kosong pada SEP (kddpjp)")
		return
	}
	kodeDokterInt, errD := strconv.Atoi(strings.TrimSpace(q.KodeDokterBpjs.String))
	if errD != nil {
		markAntreanQueueError(db, id, "kode dokter BPJS tidak valid: "+q.KodeDokterBpjs.String)
		return
	}

	cfg, err := getHfisConfig(db)
	if err != nil {
		markAntreanQueueError(db, id, "kredensial Mobile JKN (RS) belum diisi: "+err.Error())
		return
	}

	var nik, nohp string
	db.QueryRow(`SELECT COALESCE(no_ktp,''), COALESCE(no_tlp,'') FROM pasien WHERE no_rkm_medis = ? LIMIT 1`, q.NoRkmMedis).Scan(&nik, &nohp)

	jampraktek, kapasitas, err := lookupJadwalDokterHfis(cfg, q.KodePoliBpjs.String, q.TglRegistrasi, q.KodeDokterBpjs.String)
	if err != nil {
		markAntreanQueueError(db, id, err.Error())
		return
	}

	// angkaAntrean = nomor antrian FISIK yg sudah dibuat saat registrasi
	// (antrian_poli, lihat lookupNomorAntrianLokal di bridging_antrean_handler.go)
	// — persis "nomorreg" Khanza Java, BUKAN dihitung ulang via COUNT(*)
	// khusus BPJS (referensi_mobilejkn_bpjs sudah tidak diisi antrean
	// on-site sama sekali lagi, jadi COUNT(*) ke situ tidak relevan lagi).
	angkaAntrean, nomorAntreanLokal, foundAntrean := lookupNomorAntrianLokal(db, q.NoRkmMedis, q.KdPoli.String, q.TglRegistrasi, q.JamReg.String)
	if !foundAntrean {
		angkaAntrean = 1
	}
	sisaKuota := kapasitas - angkaAntrean
	if sisaKuota < 0 {
		sisaKuota = 0
	}
	nomorAntrean := nomorAntreanLokal
	if nomorAntrean == "" {
		nomorAntrean = fmt.Sprintf("%s-%03d", q.KodePoliBpjs.String, angkaAntrean)
	}

	pasienBaru := 0
	if q.StatusPoli.Valid && q.StatusPoli.String == "Baru" {
		pasienBaru = 1
	}

	req := AntreanRs{
		// kodebooking = no_rawat APA ADANYA (dgn "/") — dikonfirmasi dari
		// log produksi Khanza Java (SimpanAntrianOnSite & Update Waktu
		// Antrean sama-sama kirim no_rawat mentah sbg kodebooking). Aman
		// dikirim apa adanya krn tidak disimpan ke kolom lokal manapun lagi.
		KodeBooking:      q.NoRawat,
		JenisPasien:      "JKN",
		NomorKartu:       q.NoPeserta.String,
		Nik:              nik,
		NoHp:             nohp,
		KodePoli:         q.KodePoliBpjs.String,
		NamaPoli:         q.NamaPoliBpjs.String,
		PasienBaru:       pasienBaru,
		NoRawat:          q.NoRawat,
		Norm:             q.NoRkmMedis,
		TanggalPeriksa:   q.TglRegistrasi,
		KodeDokter:       q.KodeDokterBpjs.String,
		NamaDokter:       q.NamaDokterBpjs.String,
		JamPraktek:       jampraktek,
		JenisKunjungan:   q.JenisKunjungan,
		NomorReferensi:   q.NoRujukan.String,
		NomorAntrean:     nomorAntrean,
		AngkaAntrean:     angkaAntrean,
		EstimasiDilayani: estimasiDilayaniMillis(q.TglRegistrasi, jampraktek, angkaAntrean),
		SisaKuotaJkn:     sisaKuota,
		KuotaJkn:         kapasitas,
		// Khanza Java tidak membedakan kuota JKN vs Non JKN — diisi angka
		// SAMA persis dgn kolom JKN (rumus identik), bukan nol.
		SisaKuotaNonJkn: sisaKuota,
		KuotaNonJkn:     kapasitas,
		Keterangan:      antreanQueueKeteranganUmum,
	}

	if _, err := createAntreanRsBpjs(cfg, req, kodeDokterInt); err != nil {
		markAntreanQueueError(db, id, "BPJS menolak: "+err.Error())
		return
	}

	db.Exec(`UPDATE bridging_antrean_queue SET status = 'done', kodebooking = ?, processed_at = NOW() WHERE id = ?`, req.KodeBooking, id)
	log.Printf("antrean-queue #%d: antrean %s berhasil dibuat (kodebooking %s)", id, q.NoRawat, req.KodeBooking)
}

func markAntreanQueueError(db *sql.DB, id int, msg string) {
	if len(msg) > 250 {
		msg = msg[:250]
	}
	db.Exec(`UPDATE bridging_antrean_queue SET status = 'error', keterangan = ?, processed_at = NOW() WHERE id = ?`, msg, id)
	log.Printf("antrean-queue #%d: gagal — %s", id, msg)
}

// lookupJadwalDokterHfis menanyakan jadwal praktik dokter HARI ITU ke HFIS
// (GET jadwaldokter/kodepoli/{kodepoli}/tanggal/{tanggal} — endpoint yang
// sama dipakai tab "Referensi Jadwal Dokter" di Bridging BPJS), lalu
// mencari baris yang kodedokter-nya cocok dan tidak libur. "jadwal" (mis.
// "16:45-19:00") dipakai sebagai jampraktek, "kapasitaspasien" sebagai
// kuota JKN hari itu.
func lookupJadwalDokterHfis(cfg *vclaimConfig, kodePoliBpjs, tanggal, kodeDokterBpjs string) (jampraktek string, kapasitas int, err error) {
	path := "jadwaldokter/kodepoli/" + kodePoliBpjs + "/tanggal/" + tanggal
	result, err := hfisRequest(cfg, http.MethodGet, path, nil)
	if err != nil {
		return "", 0, fmt.Errorf("gagal ambil jadwal dokter HFIS: %w", err)
	}

	listRaw, _ := result["list"].([]interface{})
	target := strings.TrimSpace(kodeDokterBpjs)
	for _, item := range listRaw {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if hfisNumberToString(m["kodedokter"]) != target {
			continue
		}
		if libur, _ := m["libur"].(float64); libur == 1 {
			continue
		}
		jadwalStr, _ := m["jadwal"].(string)
		if jadwalStr == "" {
			continue
		}
		kap := 0
		if kf, ok := m["kapasitaspasien"].(float64); ok {
			kap = int(kf)
		}
		return jadwalStr, kap, nil
	}

	return "", 0, fmt.Errorf(
		"jadwal dokter (kode %s) tidak ditemukan di HFIS untuk poli %s tanggal %s — pastikan jadwal sudah didaftarkan & disetujui BPJS",
		kodeDokterBpjs, kodePoliBpjs, tanggal,
	)
}

// hfisNumberToString menyeragamkan field numerik hasil decode JSON generik
// (selalu float64 di Go) jadi string tanpa notasi desimal/eksponensial,
// supaya bisa dibandingkan apa adanya dengan kode dokter versi string.
func hfisNumberToString(v interface{}) string {
	switch t := v.(type) {
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case string:
		return strings.TrimSpace(t)
	default:
		return fmt.Sprintf("%v", t)
	}
}

// estimasiDilayaniMillis memperkirakan waktu pasien akan dilayani (epoch
// milliseconds, field wajib "estimasidilayani") dari jam mulai praktek +
// (urutan-1) x rata-rata durasi per pasien. Kalau jampraktek tidak bisa
// diparse, fallback ke "sekarang" supaya tetap ada nilai valid dikirim.
func estimasiDilayaniMillis(tanggal, jampraktek string, urutan int) int64 {
	jamMulai := strings.SplitN(jampraktek, "-", 2)[0]
	if jamMulai == "" {
		jamMulai = "08:00"
	}
	t, err := time.ParseInLocation("2006-01-02 15:04", tanggal+" "+jamMulai, time.Local)
	if err != nil {
		return time.Now().Add(time.Duration(urutan) * antreanQueueMenitPerPasien * time.Minute).UnixMilli()
	}
	return t.Add(time.Duration(urutan-1) * antreanQueueMenitPerPasien * time.Minute).UnixMilli()
}
