# Modul Permintaan Resep — Status & Rencana Pengembangan

## Latar Belakang

Modul ini dipicu dari tab **"Permintaan Resep"** di sidebar Apotek
(`frontend/src/modules/Apotek.tsx`), tapi dirender sebagai **overlay
layar-penuh** yang menutupi seluruh halaman Apotek (`position: fixed`,
`zIndex: 10000`) — bukan konten inline di dalam card Apotek. Strukturnya
DISAMAKAN dengan `ApotekView` (sidebar 240px rounded-24 + header
breadcrumb/Tutup + body card putih rounded-24), tapi sidebar-nya
**putih/netral** (bukan gradient hijau Apotek) supaya kedua layar tetap
bisa dibedakan sekilas.

Cocok dengan dialog Khanza Desktop
`inventory/DlgDaftarPermintaanResep.java` — **dialog terbesar yang pernah
ditemui di Khanza (5515 baris)**, tab-nya sendiri bersarang (Rawat
Jalan/Rawat Inap × 8 tabel berbeda) dan 10 tombolnya masing-masing membuka
dialog terpisah yang juga substansial. Source referensi lengkap ada di
`~/khanzaibnusina/src/` (di luar repo ini, hanya untuk riset — **jangan
disalin ke repo**).

## Struktur Modul (`frontend/src/modules/PermintaanResep.tsx`)

Sidebar berisi 11 item. Item pertama, **"Daftar Resep Dokter"**, bukan
tombol datar biasa — dia adalah dropdown yang saat aktif+terbuka
menampilkan sub-item **[Rawat Jalan]** dan **[Rawat Inap]** di bawahnya,
dibungkus SATU warna latar hijau yang sama (`#059669`) sebagai satu
container (bukan dua rona berbeda). Sub-item yang sedang dipilih ditandai
panah kecil (►) + teks bold, bukan warna latar terpisah. Klik "Daftar
Resep Dokter" saat sudah aktif men-toggle buka/tutup dropdown (chevron
berputar 180°).

10 item lain masih flat placeholder (`<Placeholder title="..." />`):
Riwayat Pasien, Obat Tervalidasi, Telaah Resep, Konseling Farmasi,
Informasi Obat, Cetak Resep Awal, Resep Luar, Piutang Obat, Data Sep BPJS,
Obat Apotek Online BPJS.

## Status: SELESAI — Daftar Resep Dokter > Rawat Jalan

### Backend (`backend/permintaan_resep_handler.go`)

Padanan `tampil()` untuk `TabRawatJalan` index 0 ("Resep Ralan") di Java.

- `GET /api/permintaan-resep/ralan` — daftar resep ralan (header only,
  TANPA embed item, replikasi pola lazy-load Java). Query:
  `resep_obat` (status='ralan') INNER JOIN `reg_periksa`/`pasien`/
  `dokter`/`poliklinik`/`penjab`. Default rentang tanggal **HARI INI
  SAJA** (bukan 30 hari seperti laporan historis lain — ini dashboard
  antrean kerja aktif, bukan laporan). Filter: dokter, poli, status
  (Belum/Sudah Terlayani, dihitung dari `tgl_perawatan`), search bebas.
- `GET /api/permintaan-resep/ralan/:no_resep/items` — detail item
  (non-racikan + racikan, dengan kandungan per bahan racikan) untuk satu
  resep, dipicu klik baris. Reuse struct `ResepNonRacikan`/`ResepRacikan`/
  `ResepRacikanDetail` yang sudah ada di `resep_handler.go` (package
  `main` yang sama).
- `POST /api/permintaan-resep/ralan/:no_resep/validasi` — **padanan alur
  "Pemberian Obat" di `inventory/DlgCariObat.java`** (5429 baris,
  ditemukan setelah user menunjukkan file ini — bukan tebakan). Dipicu
  tombol "Validasi" di kolom Validasi Dashboard (cuma muncul kalau
  `tgl_validasi` masih kosong), buka modal ringkasan resep + tombol
  "Serahkan & Validasi". **BUKAN cuma stempel tanggal** — urutan asli
  Java (baris ~1550-1674 `DlgCariObat.java`) per baris obat yang
  diserahkan: (1) kurangi `gudangbarang.stok`, (2)
  `Trackobat.catatRiwayat(..., "Pemberian Obat", ...)` SEBELUM update
  stok, (3) insert `detail_obat_racikan`/`detail_pemberian_obat`
  (billing), (4) submit P-Care/BPJS kalau aktif, (5) posting jurnal
  akuntansi, (6) BARU TERAKHIR `UPDATE resep_obat SET tgl_perawatan=...`.

  **Yang diport**: (1)+(2)+(6) — kurangi stok (di depo hasil
  `resolveDepoRalan`, fallback "AP", sama fungsi yang dipakai
  `searchObat`), catat `riwayat_barang_medis` posisi "Pemberian Obat",
  baru stempel `resep_obat`. Ditambah **validasi stok cukup** (Java
  sendiri tidak menjaga ini secara eksplisit di potongan yang dibaca,
  tapi konsisten dengan prinsip "transaksi outflow fisik tidak boleh
  bikin stok minus" yang sudah dipakai `submitMutasi`/`submitReturBeli`).

  **Yang SENGAJA TIDAK diport** (dikonfirmasi user, prioritas
  dipercepat lewat penyederhanaan): (3) billing detail_obat_racikan/
  detail_pemberian_obat, (4) P-Care/BPJS, (5) jurnal akuntansi — proyek
  ini belum punya modul Keuangan/Jurnal (alasan sama Penerimaan/Retur
  Beli). Jumlah yang diserahkan = jumlah PERESEPAN PENUH dari
  `resep_dokter`/`resep_dokter_racikan_detail` (Java punya UI edit jumlah
  parsial per baris `tbObat`, di sini tidak — kalau nanti butuh
  penyerahan sebagian, endpoint perlu diperluas terima daftar item+jumlah
  dari body, bukan otomatis dari resep).

  **Sudah diuji langsung** di DB `sik` (bukan cuma type-check): potong
  stok Amoxsan 500mg 435→425 sesuai jml resep, `riwayat_barang_medis`
  tercatat benar (stok_awal/akhir match), `resep_obat` berubah status.
  Guard stok tidak cukup + rollback juga diuji (set stok jadi 3, submit
  butuh 10 → ditolak bersih, stok TIDAK berubah). Semua data test sudah
  dikembalikan ke kondisi semula setelah verifikasi.

**PENTING** — nama kolom `resep_obat.tgl_perawatan`/`jam` MENYESATKAN
(kesan "tanggal rawat"), tapi di konteks `resep_obat` dipakai Java sebagai
**"Tgl.Validasi"/"Jam Validasi"** (kapan apoteker memvalidasi resep,
BUKAN tanggal rawat pasien). Diikuti apa adanya sesuai skema asli, bukan
bug.

Jalur `DEPOAKTIFOBAT` (varian query per-depo-aktif di Java) **tidak
diport** — cuma jalur default (semua depo) yang dipakai, sama prinsip
penyederhanaan modul lain di proyek ini.

### Frontend (`TabResepRalan` di `PermintaanResep.tsx`)

Tabel dengan filter tanggal/dokter/poli/status/search, klik baris untuk
expand detail obat (non-racikan + racikan). Auto-load saat dibuka (data
harian, bukan log tak terbatas — aman di-auto-fetch, beda dari Riwayat
Obat di Apotek yang butuh klik "Cari" dulu). Kolom "Validasi" menampilkan
tombol "Validasi" (buka modal ringkasan resep + item obat, tombol "Simpan
Validasi") kalau resep belum divalidasi; setelah disimpan otomatis
refetch dan tombol berubah jadi tanggal/jam.

## Status: SELESAI — Daftar Resep Dokter > Rawat Inap (ke-6 sub-tab)

Padanan `TabRawatInap` (6 sub-tab: `tabMode3`-`tabMode8`, `tampil3()`-
`tampil8()`) di `DlgDaftarPermintaanResep.java`. Dibangun sekaligus (bukan
satu-per-giliran seperti biasa) atas pilihan user — filter
(tanggal/dokter/kamar/status/cari) dibagi rata ke ke-6 tab, persis Java
(field yang sama dipakai `tampil3()`-`tampil8()`, bukan filter terpisah
per tab).

### Backend (`backend/permintaan_resep_ranap_handler.go`)

File BARU, terpisah dari `permintaan_resep_handler.go` (versi Ralan) —
query/handler SENGAJA DIDUPLIKASI (bukan digeneralisasi lewat parameter),
mengikuti pola yang sudah dipakai proyek ini di tempat lain
(`resep_handler.go` vs `resep_ranap_handler.go`).

- **Resep Rawat Inap** (`GET /api/permintaan-resep/ranap`) — padanan
  `tampil3()`/`tabMode3`. `resep_obat` (status='ranap') JOIN
  `kamar_inap`/`kamar`/`bangsal` (bukan poliklinik seperti Ralan), filter
  `kamar_inap.stts_pulang='-'` (cuma pasien yang MASIH dirawat). Tidak ada
  kolom Penyerahan (`tabMode3` Java cuma 14 kolom berakhir di Jam
  Validasi, beda dari Ralan).
- **Detail Rawat Inap** (`GET /api/permintaan-resep/ranap/:no_resep/items`)
  — padanan `tampil4()`. Struktur PERSIS `getPermintaanResepRalanItems`,
  beda cuma fallback resolusi depo: `resolveDepoRanap` (lewat
  kamar_inap/kamar aktif pasien) bukan `resolveDepoRalan` (lewat
  poliklinik kunjungan).
- **Validasi** (`POST /api/permintaan-resep/ranap/:no_resep/validasi`) —
  padanan persis `submitPermintaanResepValidasi`, cuma filter
  `status='ranap'` + `resolveDepoRanap`. Sama urutan operasi (catat
  riwayat SEBELUM potong stok, validasi stok cukup, UPSERT racikan,
  stempel `resep_obat` TERAKHIR), sama penyederhanaan (skip billing/BPJS/
  jurnal — lihat komentar `submitPermintaanResepValidasi` untuk rincian).
  **Diuji end-to-end** terhadap DB `sik` (list, item, dan modal Validasi
  lewat browser) — data test dikembalikan ke kondisi semula setelahnya.
- **Permintaan Stok Pasien** (`GET /api/permintaan-resep/ranap-stok-pasien`
  + `.../:no_permintaan/items`) — padanan `tampil5()`/`tampil6()`. Tabel
  `permintaan_stok_obat_pasien`/`detail_permintaan_stok_obat_pasien`
  (permintaan mandiri pasien, DI LUAR resep dokter). Jadwal jam00-jam23
  (`enum('true','false')` per kolom di Java) dikemas jadi map
  `{"00":bool,...,"23":bool}` di response, ditampilkan sebagai daftar jam
  yang dicentang saja (mis. "06, 12, 18") — lebih ringkas daripada dump
  24 kolom ✓/✕ mentah ala Java, tanpa mengubah data yang disimpan.
  **READ-ONLY** — aksi validasi/serah-terimanya (`BtnPemberianObat` ->
  `DlgStokPasien.java`) BELUM diport (prioritas dipercepat menutup ke-6
  sub-tab tampilan dulu).
- **Permintaan Resep Pulang** (`GET /api/permintaan-resep/ranap-resep-pulang`
  + `.../:no_permintaan/items`) — padanan `tampil7()`/`tampil8()`. Tabel
  `permintaan_resep_pulang`/`detail_permintaan_resep_pulang` — **BEDA**
  dari `/api/resep-pulang-req` (`resep_pulang_handler.go`, sudah ada
  sebelumnya) yang untuk PERAWAT MEMBUAT permintaan baru; endpoint ini
  padanan sisi APOTEK, dashboard baca-saja atas permintaan yang sudah
  masuk. Item detailnya TIDAK ada racikan (Java cuma query
  `detail_permintaan_resep_pulang`, beda dari `resep_pulang_handler.go`
  yang punya dukungan racikan untuk tabel `resep_pulang` yang lain).
  **READ-ONLY** juga (alasan sama Stok Pasien, dialog `DlgResepPulang.java`
  belum diport).

Setiap query LIST (Resep/Stok/Pulang) dijalankan **DUA KALI** dan hasilnya
digabung (union by no_resep/no_permintaan, skip duplikat): sekali lewat
`kamar_inap` biasa, sekali lagi lewat `ranap_gabung` (pasien bayi/gabungan
yang memakai `no_rawat` ibu, lihat `rad_handler.go`) — diikuti apa adanya
dari Java supaya pasien bayi/gabungan tidak hilang dari dashboard.

Jalur `DEPOAKTIFOBAT` (varian per-depo-aktif) TIDAK diport di ke-3 List
endpoint — sama prinsip penyederhanaan modul lain di proyek ini.

### Frontend (`TabResepRanap` di `PermintaanResep.tsx`)

Satu komponen dengan strip 6 tab di atas (persis `TabRawatInap` Java),
berbagi baris filter yang sama. `ModalValidasiObat` digeneralisasi lewat
prop `kind?: 'ralan' | 'ranap'` (default `'ralan'`, tanpa breaking
existing Ralan) yang menentukan base path fetch/submit — alur & tampilan
modal PERSIS sama, cuma URL-nya beda.

## Status: BELUM — 10 Fitur Placeholder Lainnya

Urutan prioritas belum ditentukan — user yang akan memilih tiap giliran.
Berikut peta padanan Java untuk tiap fitur (semua path relatif ke
`~/khanzaibnusina/src/`, riset awal, BELUM dibaca detail satu-satu):

| Sidebar item | Padanan Java | Ukuran | Catatan |
|---|---|---|---|
| Daftar Resep Dokter — **Aksi Penyerahan Obat** ⚠️ | `BtnPenyerahanActionPerformed` (baris ~2221) di `DlgDaftarPermintaanResep.java` | bagian dari 5515 baris | **DITEMUKAN, BELUM ADA DI 10 DAFTAR SIDEBAR AWAL** — tombol terpisah dari "Obat Tervalidasi", cuma untuk resep ralan. Isinya: insert ke tabel antrian `antriapotek3` + hapus `bukti_penyerahan_resep_obat` untuk `no_resep` itu — BUKAN langsung `UPDATE resep_obat SET tgl_penyerahan=...`. Kemungkinan penulisan `tgl_penyerahan`/`jam_penyerahan` (yang sudah ditampilkan read-only di kolom "Penyerahan" pada Dashboard) terjadi lewat alur cetak bukti penyerahan terpisah — **belum ditelusuri lengkap**, perlu baca lebih lanjut sebelum diimplementasikan |
| ~~Riwayat Pasien~~ | `RMRiwayatPerawatan` (dipanggil via `BtnRiwayat`) | — | **✅ SELESAI (revisi ke-2, padanan Java persis)** — di Java, `BtnRiwayat` adalah tombol TOOLBAR (bukan tab) yang aksinya terikat ke baris resep/permintaan yang SEDANG DIPILIH di tab Daftar Resep Dokter (butuh `NoRawat`/`NoRM`/`Pasien` dari seleksi baris dulu — kalau belum ada baris dipilih, Java tampilkan `JOptionPane` "Silahkan pilih data..!!"). Percobaan pertama (cari-pasien-sendiri via `/api/pendaftaran/pasien/search`) DIKOREKSI user — bukan itu polanya. Sekarang: `selectedPasien` (no_rkm_medis+nm_pasien) di-lift ke `PermintaanResepView`, di-update oleh `TabResepRalan`/`TabResepRanap` lewat prop `onSelectPasien` tiap kali SATU BARIS resep/permintaan diklik (Resep Rawat Inap, Stok Pasien, ATAUPUN Resep Pulang — ketiganya sama-sama punya `no_rkm_medis`/`nm_pasien`), TERLEPAS dari expand/collapse-nya. Klik "Riwayat Pasien" di sidebar TIDAK memindah `activeTab` (jadi tidak pernah tersorot hijau, murni tombol aksi) — kalau `selectedPasien` ada, `RiwayatModal.tsx` langsung terbuka; kalau belum ada baris dipilih, `Swal.fire` peringatan (padanan `JOptionPane` Java). Diuji lewat browser: klik "Riwayat Pasien" tanpa pilih baris → peringatan muncul, tetap di Daftar Resep Dokter; klik baris resep (RAHMA NIA) → klik "Riwayat Pasien" → modal langsung terbuka untuk pasien itu, tutup → kembali ke baris yang masih ter-expand |
| ~~Obat Tervalidasi~~ (aksi Validasi) | `inventory/DlgCariObat.java` (5429 baris) | — | **✅ SELESAI** — AKSI "Validasi"-nya (bukan sidebar item, lihat baris di bawah) sudah diimplementasikan sebagai tombol + modal di kolom Validasi pada tab Dashboard (`submitPermintaanResepValidasi`). Kolom "K" di modal (`ModalValidasiObat.tsx`) konversi satuan kemasan/besar sungguhan (dicentang = Jumlah diisi dalam satuan kemasan, dibagi `databarang.kapasitas` sebelum potong stok/billing) — padanan persis `DlgCariObat.java` baris ~1411-1477. Ini pertama kalinya konversi satuan besar/kecil diimplementasikan di proyek ini (fitur lain seperti Penerimaan tetap tanpa konversi satuan, penyederhanaan yang disengaja). Diuji end-to-end terhadap DB `sik`: jumlah kemasan 8 ÷ kapasitas 4 = 2 satuan dasar dikurangi dari stok, terverifikasi lewat `riwayat_barang_medis` |
| ~~Obat Tervalidasi~~ (sidebar item) | `BtnPemberianObat` -> `inventory/DlgPemberianObat.java` (1791 baris) | — | **✅ SELESAI (padanan Java persis, sama pola Riwayat Pasien)** — awalnya salah diklaim "selesai" di baris di atas (padahal itu aksi Validasi yang beda, sidebar item-nya sendiri masih placeholder). Di Java, `BtnPemberianObat` adalah tombol TOOLBAR yang aksinya terikat ke baris resep yang SEDANG DIPILIH di Daftar Resep Dokter, HANYA aktif kalau Status="Sudah Terlayani" (`JOptionPane` "Silahkan pilih data yang sudah divalidasi..!!" kalau belum), lalu membuka `DlgPemberianObat` — dialog yang TERNYATA dobel fungsi sebagai mesin pemberian-obat+billing+jurnal sendiri (method `tampilPO3()` yang dipanggil bahkan TIDAK ADA di file itu, kemungkinan bug/quirk lama Khanza sendiri), nyaris duplikat `DlgCariObat` yang sudah diport jadi "Validasi". **Dikonfirmasi user (setelah ditanya eksplisit)**: BUKAN direplikasi 1:1 — cukup tombol aksi (padanan `handleRiwayatPasienClick`) yang membuka `ModalObatTervalidasi` READ-ONLY, reuse PERSIS endpoint items yang sama dipakai `ModalValidasiObat` (`getPermintaanResepRalanItems`/`RanapItems`), TANPA endpoint atau mesin billing/jurnal baru sama sekali. `selectedResep` (no_resep+kind+status+pasien) di-lift ke `PermintaanResepView`, di-update lewat prop `onSelectResep` HANYA dari toggle baris RESEP (`TabResepRalan`/tab "Resep Rawat Inap" `TabResepRanap` — bukan Stok Pasien/Resep Pulang, keduanya beda bentuk data). Diuji lewat browser: klik tanpa pilih resep → peringatan "Belum ada resep dipilih"; pilih resep Belum Terlayani → klik → peringatan "Resep belum divalidasi" (padanan persis pesan Java); pilih resep Sudah Terlayani (RIDWAN HALIM, 202605090001) → klik → modal tampil rincian obat sudah diserahkan (Ibuprofen 200mg×30 + racikan R1, Total/PPN/Total+PPN benar) |
| Telaah Resep | `inventory/InventoryTelaahResep.java` | 2116 baris | Dialog terpisah, bukan cuma tombol di dalam DlgDaftarPermintaanResep — juga dipanggil dari `DlgResepObat.java`/`DlgCariObat.java` |
| Konseling Farmasi | `rekammedis/RMKonselingFarmasi.java` | 1471 baris | — |
| Informasi Obat | `permintaan/DlgPermintaanPelayananInformasiObat.java` | 2186 baris | — |
| Cetak Resep Awal | `BtnResepAwalActionPerformed` (baris ~2809) di `DlgDaftarPermintaanResep.java` | bagian dari 5515 baris | — |
| Resep Luar | `inventory/InventoryResepLuar.java` + `inventory/InventoryCariResepLuar.java` | 1662 + 1244 baris | Dua dialog terpisah (input + cari) |
| Piutang Obat | `keuangan/KeuanganPiutangObatBelumLunas.java` | 1103 baris | Kemungkinan butuh modul Keuangan yang belum ada di proyek ini — cek dependency dulu |
| Data Sep BPJS | `BtnSEPBPJSActionPerformed` (baris ~2773), pakai `bridging.BPJSDataSEP` | bagian dari 5515 baris | Kemungkinan bisa reuse pola dari modul Bridging BPJS yang sudah ada (`BridgingBpjs.tsx`) |
| Obat Apotek Online BPJS | `BtnObat23HariBPJSActionPerformed` (baris ~2801) | bagian dari 5515 baris | "23 hari" = aturan BPJS untuk obat kronis program rujuk balik/apotek online |

## Prinsip Pengembangan Lanjutan

- **Satu fitur per giliran**, dites (type-check + curl API + verifikasi
  data riil) sebelum lanjut ke fitur berikutnya — pola yang sudah
  terbukti jalan sepanjang pembangunan modul Apotek & Permintaan Resep
  ini.
- **Baca file Java referensi dulu** sebelum desain skema/endpoint baru
  (jangan menebak) — semua ada di `~/khanzaibnusina/src/`, di luar repo.
- Cek dulu apakah fitur yang diminta **sudah ada** di bagian lain proyek
  (seperti dugaan Riwayat Pasien di atas) sebelum membangun dari nol.
- Ikuti pola "penyederhanaan yang disengaja" yang sudah konsisten dipakai
  di seluruh proyek ini: replikasi behavior Java apa adanya (termasuk
  kuirknya), skip fitur yang butuh modul lain yang belum ada (Jurnal,
  Keuangan, dll), jangan pernah ubah skema tabel native Khanza kalau bisa
  dihindari.
