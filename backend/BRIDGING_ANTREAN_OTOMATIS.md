# Antrean BPJS Otomatis — Status & Rencana Pengembangan

## Latar Belakang

Pendaftaran pasien (`reg_periksa`) bisa masuk lewat **dua aplikasi berbeda**:

- **Khanza Java Desktop** — dipakai loket pendaftaran saat ini.
- **Web ERMApp** ini.

Karena itu, deteksi "perlu antrean BPJS baru" tidak bisa digantungkan ke
handler API web ini saja (tidak akan ke-trigger kalau dilakukan lewat Java
Desktop). Solusinya harus di **level database**: trigger MySQL
`AFTER INSERT`, yang jalan berapa pun aplikasi yang melakukan INSERT — pola
ini sudah dipakai lebih dulu di `antrian_handler.go`
(`trg_after_reg_periksa_insert`, untuk antrian_poli lokal) dan
`antrian_apotek_handler.go` (`trg_after_resep_insert`).

**Koreksi penting terhadap desain awal**: iterasi pertama memasang trigger
di `reg_periksa` (saat pasien pertama kali daftar). Ini salah — user
mengoreksi bahwa di Khanza Java Desktop, "Tambah Antrean" BPJS **terjadi
bersamaan dengan SIMPAN SEP / Pembuatan SEP**, bukan saat pendaftaran awal.
Alasannya: field wajib `jeniskunjungan` (rujukan FKTP vs kontrol) dan
`nomorreferensi` baru pasti diketahui begitu SEP dibuat (kolom `no_rujukan`
di tabel `bridging_sep`) — belum ada di saat `reg_periksa` diinsert. Desain
final memindahkan trigger ke tabel **`bridging_sep`**, yang juga merupakan
tabel Khanza asli yang dipakai bersama oleh kedua aplikasi (SEP yang dibuat
lewat Java Desktop maupun lewat fitur SEP di web ini sama-sama masuk ke
tabel ini).

Trigger MySQL **tidak bisa memanggil API HTTP** (BPJS) secara langsung — jadi
alurnya dipecah dua tahap:

1. **Trigger** (`trg_after_bridging_sep_insert_antrean_bpjs`) mencatat
   kandidat ke tabel antrian `bridging_antrean_queue`, status `pending`.
2. **Worker Go** (`bridging_antrean_worker.go`, background goroutine, poll
   tiap 30 detik) membaca tabel itu, melengkapi data yang belum ada (jam
   praktek & kuota dari HFIS, nomor antrean, kodebooking), lalu memanggil
   `createAntreanRsBpjs` — fungsi yang diekstrak dari `addAntreanRs` (dipakai
   bersama oleh handler manual "Tambah Antrean" dan worker ini, supaya
   logika panggil-BPJS-nya tidak dobel).

## Status: SUDAH SELESAI (tabel, trigger, dan worker — semua sudah jalan di produksi)

### 1. Tabel `bridging_antrean_queue`

File: `backend/bridging_antrean_queue_handler.go` — fungsi
`ensureBridgingAntreanQueueTable(db)`, dipanggil di `main.go` saat startup.

| Kolom | Keterangan |
|---|---|
| `no_rawat` | PK unik |
| `no_sep` | No. SEP yang memicu baris ini |
| `no_rkm_medis` | No. RM pasien |
| `kd_poli` | Kode poli versi RS (buat referensi/debug) |
| `kodepoli_bpjs`, `namapoli_bpjs` | Sudah dipetakan lewat `maping_poli_bpjs` **di dalam trigger** |
| `kodedokter_bpjs`, `namadokter_bpjs` | Diambil langsung dari `bridging_sep.kddpjp`/`nmdpdjp` — kolom ini di `bridging_sep` **sudah** berisi kode dokter versi BPJS (dipakai VClaim Insert SEP), jadi tidak perlu mapping ulang |
| `tgl_registrasi`, `jam_reg`, `status_poli` | Dari `reg_periksa` (join by `no_rawat`) |
| `kd_pj`, `no_peserta` | Kode penjamin & no. kartu BPJS (`no_peserta` diambil dari `bridging_sep.no_kartu`, bukan `pasien.no_peserta`, supaya konsisten dengan SEP yang bersangkutan) |
| `no_rujukan` | Dari `bridging_sep.no_rujukan` |
| `jeniskunjungan` | Resolved di trigger: ada `no_rujukan` → `1` (Rujukan FKTP), tidak ada → `3` (Kontrol) |
| `status` | `pending` \| `processing` \| `done` \| `error` |
| `keterangan` | Pesan error terakhir (diisi worker) |
| `kodebooking` | Diisi worker setelah BPJS berhasil membuat antrean |
| `created_at`, `processed_at` | Timestamp |

### 2. Trigger `trg_after_bridging_sep_insert_antrean_bpjs`

Jalan setelah setiap `INSERT` ke `bridging_sep`. Syarat supaya masuk antrian:

1. `jnspelayanan = '2'` (SEP rawat jalan — dikonfirmasi dari spec resmi
   Insert SEP 2.0: `"1"` = Rawat Inap, `"2"` = Rawat Jalan, kebalikan dari
   asumsi awal saat trigger ini pertama dibuat; sudah diperbaiki).
2. Join ke `reg_periksa` by `no_rawat`, dan `kd_poli <> 'IGDK'` — kunjungan
   **IGD dikecualikan**. Antrean RS/Mobile JKN adalah sistem antrean untuk
   kunjungan poli **terjadwal**, bukan pasien gawat darurat yang datang
   tanpa antre. Konsisten dengan pengecualian `IGDK` yang sudah dipakai di
   query daftar SEP (`main.go`, `WHERE poliklinik.kd_poli <> 'IGDK'`).
3. `kd_pj` (dari `reg_periksa`) yang penjaminnya **persis** `BPJS` di tabel
   `penjab` (`png_jawab = 'BPJS' AND status = '1'`) — sengaja bukan
   `LIKE '%BPJS%'` supaya `BPJS TK` (Ketenagakerjaan) tidak ikut kepilih.
4. `kd_poli` punya pemetaan di `maping_poli_bpjs` (kalau tidak ada mapping,
   dilewati — tidak ada cara membuat antrean tanpa kode poli BPJS).
5. **Belum ada** booking Mobile JKN di tanggal yang sama (dicek ke
   `referensi_mobilejkn_bpjs` by `norm` + `tanggalperiksa`) — supaya pasien
   yang sudah booking sendiri lewat aplikasi Mobile JKN **tidak** dibuatkan
   antrean duplikat. Fitur ini murni untuk kasus **walk-in**.

`jeniskunjungan` ditentukan otomatis dari `bridging_sep.no_rujukan`: kalau
terisi → `1` (Rujukan FKTP) dengan `nomorreferensi` = nomor rujukan itu;
kalau kosong → `3` (Kontrol) dengan `nomorreferensi` kosong. Ini yang
membuat pemindahan trigger ke `bridging_sep` penting — data ini memang
belum ada di titik pendaftaran awal.

### 3. Worker `bridging_antrean_worker.go`

Goroutine background (`startAntreanQueueWorker`, dipanggil dari `main.go`
setelah `ensureBridgingAntreanQueueTable`), poll tiap 30 detik
(`antreanQueuePollInterval`), maksimal 20 baris per batch
(`antreanQueueBatchSize`). Untuk tiap baris `pending`:

1. **Klaim** baris (`UPDATE ... SET status='processing' WHERE status='pending'`)
   supaya aman kalau proses tumpang tindih (mis. restart di tengah jalan).
2. Ambil `nik`/`nohp` pasien dari tabel `pasien` (`no_ktp`/`no_tlp`).
3. **Jam praktek & kuota** — tanya **live ke HFIS**
   (`jadwaldokter/kodepoli/{kodepoli}/tanggal/{tanggal}`, endpoint yang sama
   dipakai tab "Referensi Jadwal Dokter"): cari entri yang `kodedokter`-nya
   cocok dan tidak libur, ambil field `jadwal` (mis. `"16:45-19:00"`) sebagai
   `jampraktek`, dan `kapasitaspasien` sebagai `kuotajkn`. Kalau tidak
   ketemu (jadwal dokter itu belum terdaftar/disetujui BPJS untuk tanggal
   itu) → baris ditandai `error`, **tidak** menebak.
4. **Nomor antrean & sisa kuota** — spec resmi "Tambah Antrean" mewajibkan
   RS sendiri yang melaporkan nomor urut & sisa kuota (bukan dihitung BPJS).
   Worker menghitungnya dari jumlah baris `referensi_mobilejkn_bpjs` yang
   sudah ada untuk `kodedokter` + tanggal yang sama (tidak termasuk yang
   `Batal`) → `angkaantrean = jumlah + 1`, `sisakuotajkn = kuota - angkaantrean`.
5. **`kodebooking`** dibuat deterministik dari `no_rawat`
   (`"2026/07/15/000015"` → `"20260715000015"`) — unik per kunjungan,
   mudah ditelusuri balik, tanpa perlu tabel sequence terpisah.
6. Panggil `createAntreanRsBpjs` (fungsi hasil ekstraksi dari `addAntreanRs`
   di `bridging_antrean_handler.go`) — request ke BPJS + upsert lokal ke
   `referensi_mobilejkn_bpjs` dalam satu fungsi yang sama dipakai handler
   manual.
7. Sukses → `status='done'` + `kodebooking`. Gagal (di langkah mana pun) →
   `status='error'` + `keterangan` (pesan error, dipotong 250 karakter).

### Verifikasi yang sudah dilakukan

- Tabel, trigger lama (`reg_periksa`, sudah dihapus), dan trigger baru
  (`bridging_sep`) sudah dicek langsung ke **database produksi**
  (192.168.1.220 / `ibnusina`) lewat `SHOW TRIGGERS` dan
  `DESCRIBE bridging_antrean_queue` — semua sesuai desain final.
- Endpoint HFIS jadwal dokter dicoba langsung (`curl` ke
  `/api/bridging/hfis/referensi/jadwal-dokter/INT?tanggal=2026-07-16`) untuk
  mengonfirmasi bentuk response asli (field `jadwal`, `kodedokter`,
  `kapasitaspasien`, `libur`, dll) sebelum dipakai di `lookupJadwalDokterHfis`.
- Worker sudah jalan (`✓ Worker antrean BPJS otomatis berjalan`) tapi
  **belum diuji end-to-end dengan SEP sungguhan** — sengaja tidak disimulasi
  dengan data palsu karena satu siklus penuh berarti benar-benar memanggil
  BPJS "Tambah Antrean" (membuat booking nyata). Verifikasi end-to-end
  sebaiknya menunggu SEP asli berikutnya dibuat (lewat Java Desktop atau web
  ini), lalu cek `bridging_antrean_queue` (harus jadi `status='done'` dengan
  `kodebooking` terisi, atau `status='error'` dengan pesan jelas kalau ada
  yang perlu diperbaiki).

### 4. Saklar on/off + halaman log (tab "Antrean Otomatis")

Karena worker berjalan otomatis tiap kali SEP rawat jalan BPJS disimpan
(lewat Java Desktop maupun web ini), staf perlu cara untuk **mematikannya
sementara** kalau sedang sengaja memakai fitur "Tambah Antrean" bawaan
Khanza Desktop untuk kunjungan tertentu — supaya tidak dobel dikirim ke
BPJS — dan cara untuk **melihat riwayat/status** apa yang sudah/belum
diproses.

- **Saklar**: disimpan di `setting_bridging` (kode
  `bridging_antrean_otomatis`, kolom `enabled`) — pola tabel yang sama
  dipakai kredensial bridging lain. `isAntreanOtomatisEnabled(db)` dicek
  worker di awal tiap batch (`bridging_antrean_worker.go`); **default MATI**
  kalau baris pengaturan belum pernah disimpan (fitur belum diuji
  end-to-end). Saat mati, trigger tetap menulis ke queue seperti biasa
  (trigger tidak tahu-menahu soal saklar ini) — baris hanya dibiarkan
  `pending` sampai staf menyalakan lagi, supaya tidak ada kunjungan yang
  "hilang" dari catatan.
- **Endpoint** (`bridging_antrean_queue_log_handler.go`):
  - `GET/PUT /api/bridging/antrean-queue/status` — baca/ubah saklar.
  - `GET /api/bridging/antrean-queue` — daftar log (filter `status`,
    `tgl_dari`, `tgl_sampai`, `search`).
  - `POST /api/bridging/antrean-queue/:id/skip` — tandai `pending`/`error`
    jadi `skipped` ("Ditandai sudah dibuat manual oleh staf") — dipakai
    kalau staf sudah bikin antreannya sendiri lewat Khanza Desktop.
  - `POST /api/bridging/antrean-queue/:id/retry` — kembalikan `error`/
    `skipped` ke `pending` supaya dicoba lagi oleh worker.
- **Frontend**: tab baru **"Antrean Otomatis"** di sidebar Bridging BPJS
  (`frontend/src/modules/AntreanOtomatis.tsx`, didaftarkan di
  `BridgingBpjs.tsx`) — toggle di bagian atas, tabel log dengan filter
  tanggal/status/pencarian, dan tombol "Proses Ulang"/"Sudah Manual" per
  baris.

Sudah dicoba lewat `curl` end-to-end: status default `false`, bisa
diubah ke `true` dan kembali ke `false`, endpoint list mengembalikan array
kosong (belum ada data). Dikembalikan ke `false` (mati) setelah pengujian —
staf yang menyalakan lewat UI kalau sudah siap.

## Yang Masih Perlu Diperhatikan

- **Retry**: baris `status='error'` saat ini **tidak** dicoba ulang otomatis
  (mis. kalau BPJS gateway timeout sesaat, bukan ditolak permanen). Belum
  ada UI untuk melihat/retry manual baris error dari tab Bridging Antrean RS
  — perlu ditambahkan kalau di praktiknya banyak baris nyangkut di `error`.
- **Rawat inap (Ranap)**: trigger ini hanya mencakup SEP rawat jalan
  (`jnspelayanan='2'`). Ranap (`jnspelayanan='1'`) belum dicakup —
  kemungkinan memang tidak relevan (Ranap biasanya tidak pakai antrean
  poli), tapi belum dikonfirmasi.
- **IGD**: dikecualikan (`kd_poli <> 'IGDK'`). Kalau suatu saat ada kode poli
  IGD tambahan, pengecualian ini perlu diperluas.
- **Estimasi durasi per pasien** (`antreanQueueMenitPerPasien = 10` menit,
  dipakai hitung `estimasidilayani`) adalah asumsi kasar, bukan dari data
  jadwal riil. Bisa disesuaikan kalau ada data rata-rata durasi per poli.

## Belum Dikerjakan: Update Waktu Tunggu / Task-Id Realtime

Ini separuh kedua dari kebutuhan awal ("auto-update waktu-tunggu
realtime") — belum dibahas mendalam atau dikerjakan. Rekomendasi awal: pola
**outbox** juga — tulis baris ke tabel antrian tiap ada perubahan status
pemeriksaan (mis. pasien dipanggil, mulai diperiksa, selesai), lalu worker
terpisah yang memanggil `antrean/updatewaktu` ke BPJS. Karena bagian ini
(pemeriksaan/resep) memang terjadi di web ERMApp ini (bukan di Java
Desktop), triggernya bisa lebih sederhana — cukup hook langsung di handler
Go yang sudah ada, tidak wajib trigger MySQL. **Belum ada desain detail
atau kode untuk bagian ini.**

## Referensi Kode Terkait

- `backend/bridging_antrean_queue_handler.go` — tabel + trigger.
- `backend/bridging_antrean_worker.go` — worker pemroses queue.
- `backend/bridging_antrean_handler.go` — `createAntreanRsBpjs` (diekstrak
  dari `addAntreanRs`, dipakai bersama handler manual & worker) dan
  `addAntreanRs` sendiri (handler HTTP "Tambah Antrean" manual).
- `backend/antrian_handler.go` — pola asli trigger `AFTER INSERT` yang ditiru.
- `backend/bridging_hfis_handler.go` — kredensial & request helper Mobile
  JKN (RS)/HFIS (`getHfisConfig`, `hfisRequest`) yang dipakai bersama oleh
  Antrean RS & HFIS.
- Tabel Khanza yang sudah ada dan relevan: `bridging_sep`, `maping_poli_bpjs`,
  `referensi_mobilejkn_bpjs`, `penjab`, `pasien`.
- Tabel `maping_dokter_dpjpvclaim` **tidak jadi dipakai** worker — ternyata
  tidak perlu, karena `bridging_sep.kddpjp` sudah berisi kode dokter versi
  BPJS langsung.
