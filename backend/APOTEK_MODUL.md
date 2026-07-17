# Modul Apotek — Status & Rencana Pengembangan

## Latar Belakang

Modul Apotek dibangun dengan pola tampilan yang sama seperti Bridging BPJS
(`frontend/src/modules/BridgingBpjs.tsx`) — sidebar gradient + daftar tab +
footer "Pengaturan", dibuka full-screen (lepas dari shell aplikasi) lewat
menu sidebar utama "Farmasi". Warna sidebar hijau (`#10b981`/`#059669`)
untuk membedakan dari Bridging BPJS yang biru.

Dipasang di `frontend/src/modules/App.tsx`, menggantikan placeholder
"Farmasi" yang lama (`case 'farmasi'`), dengan pola full-screen overlay yang
sama persis seperti `BridgingBpjsView` dipakai dari `Bridging.tsx`.

Semua tabel yang dipakai adalah tabel **native Khanza** (bukan buatan kami
sendiri seperti tabel `bridging_*`) — jadi tidak perlu `ensureXTable`
migrasi apa pun, tinggal `SELECT`/`INSERT`/`UPDATE` langsung.

## Struktur Modul (`frontend/src/modules/Apotek.tsx`)

Tab: **Dashboard** (overview) | **Data Barang** | **Stok Opname** |
**Mutasi Obat & BHP** | **Permintaan Obat & BHP** | **Penerimaan Obat & BHP** |
**Riwayat Obat, Alkes & BHP** | *(footer)* **Pengaturan**.

## Status: SELESAI — Tab "Data Barang"

### Backend (`backend/apotek_barang_handler.go`, baru)

Tabel utama: `databarang` (master item obat/BHP/alkes, 2013 baris di data
dev). Tabel referensi (semua native Khanza, sudah terisi):

| Tabel | Kolom kode/nama | Dipakai untuk |
|---|---|---|
| `kodesatuan` | `kode_sat` / `satuan` | Satuan Besar **dan** Satuan Kecil (tabel yang sama, dipakai dua kali) |
| `jenis` | `kdjns` / `nama` | Jenis (mis. "OBAT NON ORAL", kode `JB02`) |
| `industrifarmasi` | `kode_industri` / `nama_industri` | Industri/Pabrik |
| `kategori_barang` | `kode` / `nama` | Kategori |
| `golongan_barang` | `kode` / `nama` | Golongan |
| `gudangbarang` | `kode_brng`, `kd_bangsal`, `stok`, dll (PK majemuk) | Sumber **total stok live** (`SUM(stok)` per `kode_brng`, lintas bangsal & batch) |

**Penting — semua kolom referensi di `databarang` adalah FOREIGN KEY**
(`kode_satbesar`, `kode_sat`, `kdjns`, `kode_industri`, `kode_kategori`,
`kode_golongan`) ke tabel-tabel di atas. **Tidak boleh string kosong** —
kalau tidak diisi, harus `"-"` (baris placeholder yang sudah ada di semua
tabel referensi tsb, sengaja disediakan Khanza untuk kasus "belum
diklasifikasikan"). Ditangani lewat helper `fkOrDash()` di
`createDataBarang`/`updateDataBarang` — dropdown frontend kirim `""` kalau
kosong, backend yang mengonversi ke `"-"` sebelum `INSERT`/`UPDATE`. Kalau
menambah field baru yang juga FK ke tabel referensi, jangan lupa pola yang
sama.

Endpoint:
- `GET /api/apotek/barang/list` — daftar (parameter `search`, `status`),
  di-`JOIN` ke semua tabel referensi + subquery `SUM(stok)` dari
  `gudangbarang`, urut nama, `LIMIT 500`.
- `GET /api/apotek/referensi` — lima daftar dropdown sekali panggil
  (`{satuan, jenis, industri, kategori, golongan}`), baris `"-"` sengaja
  disaring (`WHERE kode <> '-'`) supaya tidak muncul sebagai opsi.
- `POST /api/apotek/barang` — tambah baru. `kode_brng` adalah primary key
  **manual** (staf yang mengetik, bukan auto increment) — dicek dulu belum
  dipakai.
- `PUT /api/apotek/barang/:kode` — update (kode_brng tidak bisa diubah).
- `DELETE /api/apotek/barang/:kode` — **ditolak** kalau
  `gudangbarang.stok <> 0` untuk kode itu (supaya tidak meninggalkan data
  stok/mutasi yatim) — pesan error menyarankan nonaktifkan (`status='0'`)
  lewat update saja, bukan hapus.

### Frontend (`frontend/src/modules/ApotekDataBarang.tsx`, baru)

- Toolbar: cari kode/nama, filter status.
- Tabel: kode, nama, jenis, satuan, harga beli, harga ralan, **total
  stok** (merah+tebal kalau `total_stok <= stokminimal`), status, aksi
  (Edit/Hapus).
- Modal tambah/edit — **diubah mengikuti tampilan asli Khanza Desktop**
  (`DlgBarang.java`, referensi Java diberikan user), bukan lagi pola generik
  `default_card.md`: layout 2 kolom bergaya "pill row" (label rata kanan
  lebar tetap + input/`PillSelect` pill penuh + tombol paperclip dekoratif),
  identik pola visualnya dengan modal Input SEP (`BpjsSep.tsx`), warna
  disesuaikan tema hijau Apotek (`#059669`). Field harga (11 total) tidak
  lagi dipisah ke section "Harga" tersendiri — disebar langsung ke kedua
  kolom persis urutan pada dialog Khanza asli.
- **Dropdown pakai `PillSelect`** (ikon stepper bulat) — gaya yang sama
  dipakai modal Input SEP (`BpjsSep.tsx`), warna disesuaikan tema hijau
  Apotek (`#059669`, BPJS pakai biru `#2563eb`). Primitif-nya **diduplikasi**
  ke file ini (bukan diimpor dari `BpjsSep.tsx`) supaya tidak berisiko
  mengubah form SEP yang sudah teruji — kalau nanti dipakai di tab
  lain (Stok Opname, Mutasi), pertimbangkan ekstrak ke file komponen
  bersama (`frontend/src/components/`) supaya tidak triple-duplikasi.

### Temuan dari `DlgBarang.java` (dialog asli Khanza Desktop)

User menyediakan source Java dialog aslinya (`DlgBarang.java`, ditaruh di
root proyek untuk referensi) untuk memastikan modal Data Barang benar-benar
cocok dengan Khanza, bukan tebakan. Tiga temuan penting:

1. **"Kandungan" bukan kolom baru** — itu cuma label UI untuk kolom
   `letak_barang` yang sudah ada (`Valid.textKosong(Letak, "Kandungan")` di
   Java, variabel `Letak` terikat ke `letak_barang`). Tidak ada perubahan
   skema sama sekali — sesuai aturan baku sejak insiden `no_laporan_polisi`
   (jangan pernah ubah struktur tabel native Khanza kalau bisa dihindari).
2. **Field "Status" TIDAK PERNAH muncul di form tambah/edit** — baik INSERT
   (26 kolom posisional, `status` hardcode `"1"`) maupun UPDATE di Java sama
   sekali tidak menyertakan `status`. Tombol "Hapus" di daftar Khanza
   sebenarnya cuma `UPDATE databarang SET status='0'` (nonaktifkan, bukan
   `DELETE` beneran) — semua query daftar Khanza filter `WHERE status='1'`.
   Diikuti di frontend: field Status dihapus dari modal, tombol Aksi tabel
   diganti `handleToggleStatus` (Aktifkan/Nonaktifkan lewat endpoint PUT
   yang sudah ada, tidak perlu endpoint baru).
3. **Checkbox "Tanggal Kadaluwarsa"** (`ChkKadaluarsa` di Java) mengontrol
   apakah `expire` diisi tanggal beneran atau default `"0000-00-00"` kalau
   tidak dicentang. Diikuti di frontend lewat state `expireEnabled`: dicek
   otomatis saat edit (`hasExpire = !!item.expire && !expire.startsWith('0000-00-00')`),
   dan `handleSave` mengirim `expire: ''` kalau checkbox tidak dicentang.

### Verifikasi yang sudah dilakukan

Diuji end-to-end lewat `curl` di database dev (`ibnusinadev`, lokal):
create → update → muncul benar di list (join referensi & status resolve
dengan benar) → delete. Ketemu & diperbaiki bug FK constraint (lihat di
atas) lewat pengujian ini. `tsc --noEmit` bersih.

## Status Tab Lainnya

### Tab "Stok Opname" — SELESAI

Cocok dengan **dua** dialog Khanza Desktop terpisah:
- **"Stok Opname" input** (`inventory/DlgInputStok.java`) — form INPUT
  sebenarnya, satu-satunya yang punya tombol Simpan.
- **"Stok Opname" laporan** (`inventory/DlgStokOpname.java`) — cuma
  laporan/riwayat READ-ONLY (Cari/Hapus/Cetak), **TIDAK ADA tombol
  Simpan sama sekali** — sempat mengecoh di awal karena nama filenya
  seolah "yang utama" padahal itu cuma laporan.

`dapuropname`/`ipsrsopname`/`tokoopname` (varian untuk modul dapur/gizi,
IPSRS/maintenance, toko/general store) **tidak dipakai** — di luar
scope Apotek.

Tabel `opname` (kode_brng, h_beli, tanggal, stok, `real`, selisih,
nomihilang, lebih, nomilebih, keterangan, kd_bangsal, no_batch,
no_faktur — PK majemuk kelimanya) adalah **LOG hasil opname**, bukan
sumber stok — stok sesungguhnya tetap di `gudangbarang.stok`.

**Rumus Java** (`BtnSimpanActionPerformed` di `DlgInputStok.java`,
disalin persis):
```
kurang = stok_sistem - real_hitung_fisik
kurang > 0  → selisih (kekurangan/hilang) = kurang, lebih = 0
kurang <= 0 → selisih = 0, lebih (kelebihan) = -kurang
nomihilang = selisih * h_beli
nomilebih  = lebih * h_beli
```
Simpan opname **juga langsung meng-overwrite `gudangbarang.stok`**
dengan nilai `real` — staf mengoreksi stok sistem supaya sama dengan
stok fisik. Ini beneran mengubah stok asli, bukan cuma catatan —
makanya frontend selalu minta konfirmasi SweetAlert sebelum submit.

**Penyederhanaan yang disengaja** dari versi Java:
- Harga dasar nominal **selalu pakai `databarang.h_beli`** — Java punya
  opsi "HPPFARMASI" per-batch dari `data_batch` (nama kolom dinamis,
  default `"dasar"`), tidak kami port karena itu config app-level Khanza
  (`koneksiDB.HPPFARMASI()`) yang tidak ada padanannya di proyek ini.
- Tidak ada pembedaan tab "Belum Opname"/"Sudah Opname" per tanggal
  seperti subquery Java (`kode_brng not in (select ... from opname
  where tanggal=? and kd_bangsal=?)`) — staf bisa opname ulang kapan
  saja, baris terakhir yang berlaku (delete-lalu-insert per item).
- **UPDATE (retrofit, lihat bagian "Riwayat Obat, Alkes & BHP" di
  bawah)**: `Trackobat.catatRiwayat` awalnya TIDAK diport (opname sendiri
  sudah tercatat di tabel `opname`) — tapi begitu tab laporan "Riwayat
  Obat, Alkes & BHP" mulai dibangun, ini diretrofit lewat
  `catatRiwayatBarangMedis` (posisi `"Opname"`, dipanggil tepat sebelum
  `UPDATE gudangbarang`, persis titik & urutan Java) supaya laporan itu
  benar-benar mencerminkan aktivitas Stok Opname dari web app.
- **Hapus riwayat opname (DELETE) cuma menghapus baris log `opname`,
  TIDAK mengembalikan `gudangbarang.stok`** — ini **identik** dengan
  Java (`DlgStokOpname.java` Hapus cuma `Valid.hapusTable`, tidak ada
  logika revert stok) — diverifikasi lewat testing (lihat di bawah).

Backend: `backend/apotek_stok_opname_handler.go` — 4 endpoint:
- `GET /api/apotek/stok-opname/items?kd_bangsal=&search=` — daftar
  **SELURUH barang aktif** (`databarang.status='1'`), **`kd_bangsal`
  OPSIONAL** (bukan wajib). `LEFT JOIN gudangbarang` (bukan `INNER
  JOIN`), stok fallback `0` kalau `kd_bangsal` kosong ATAU barang itu
  belum pernah distok di lokasi tsb — dipakai juga untuk "menambah"
  barang baru ke suatu depo (isi Real, sisanya otomatis: kurang =
  0-real → tercatat sebagai "lebih"/kelebihan, stok baru langsung
  dibuat). Query juga JOIN `jenis` dan hitung `expire` (kolom `Jenis` &
  `Kadaluwarsa` di frontend).
  **Riwayat perbaikan** (2 iterasi, keduanya dikonfirmasi user memberi
  potongan source Java asli — bukan tebakan):
  1. Percobaan pertama salah pakai `INNER JOIN gudangbarang` (cuma
     nampilin barang yang sudah pernah distok, beda-beda tiap depo).
  2. User tunjukkan `tampil()` asli di `DlgInputStok.java`: listing awal
     itu SELECT dari `databarang` (JOIN `jenis`) TANPA join
     `gudangbarang` sama sekali dan TANPA butuh Lokasi dipilih dulu —
     `stok` di-hardcode `0` untuk semua baris di titik ini (`tabMode.addRow(...,0,0,0,0,0,...)`),
     baru dikoreksi ke nilai sungguhan per baris setelah staf pilih
     Lokasi. Endpoint di sini diselaraskan: `kd_bangsal` jadi opsional
     (bukan wajib), frontend fetch item list langsung saat tab dibuka
     tanpa nunggu Lokasi dipilih (lihat catatan frontend di bawah).
- `POST /api/apotek/stok-opname` — body `{kd_bangsal, tanggal,
  keterangan, items[]}`, hitung rumus di atas server-side per item,
  transaksi: delete-lalu-insert `opname` + update (atau insert kalau
  baris `gudangbarang` belum ada) `gudangbarang.stok`.
- `GET /api/apotek/stok-opname/riwayat?tgl1=&tgl2=&kd_bangsal=&search=`
  — laporan riwayat (JOIN `opname`+`databarang`+`bangsal`+`kodesatuan`),
  default 30 hari terakhir kalau `tgl1`/`tgl2` tidak dikirim supaya
  tidak full-scan.
- `DELETE /api/apotek/stok-opname` (query param, bukan path, karena PK
  majemuk 5 kolom) — hapus satu baris riwayat, TIDAK revert stok.

**Catatan implementasi**: kolom `real` adalah **reserved word** di
MySQL/MariaDB (tipe data `REAL`) — sempat bikin `Error 1064` saat INSERT
pertama kali dicoba (`... near 'real, selisih, ...'`), diperbaiki dengan
membungkus jadi `` `real` `` (backtick) di statement INSERT-nya. Kolom
lain yang qualified via alias tabel (`o.real`) tidak bermasalah.

Frontend: `frontend/src/modules/ApotekStokOpname.tsx` — 2 sub-tab
meniru pemisahan dua dialog Java di atas: **"Input Opname"** (tabel
barang **langsung tampil begitu tab dibuka**, tidak nunggu Lokasi
dipilih — kolom Kode/Nama/Jenis/Satuan/No. Batch+Faktur/Kadaluwarsa/
Stok Sistem/Real/Selisih/Lebih; kolom "Real" bisa diisi live, selisih/
lebih terhitung otomatis di frontend saat mengetik, sebelum submit;
Lokasi tetap **wajib dipilih sebelum tombol "Simpan Opname"** ditekan
[divalidasi frontend & backend] karena hasil opname harus tahu depo
tujuannya, tapi tidak menghalangi staf melihat katalog dulu — begitu
Lokasi dipilih/diganti, list difetch ulang supaya kolom "Stok Sistem"
menampilkan angka sungguhan di lokasi itu, bukan `0`) dan **"Riwayat
Opname"** (filter rentang tanggal + lokasi + cari, tabel hasil JOIN,
tombol Hapus per baris dengan teks konfirmasi yang menjelaskan stok
TIDAK dikembalikan).
Dipasang sebagai **tab utama modul Apotek** (`Apotek.tsx`, bukan
sub-menu Pengaturan) menggantikan placeholder lama.

**Bug: satu barang tampil dobel (beda No. Batch) — SUDAH DIPERBAIKI,
dan perbaikan pertama sempat salah arah.** User melaporkan: di Khanza
Desktop asli, pilih Lokasi apapun, satu barang cuma tampil SATU kali —
sementara versi kami tampil berkali-kali (satu baris per baris
`gudangbarang` yang ada, kalau barang itu punya banyak batch). Perbaikan
pertama saya (menampilkan No. Batch + No. Faktur berdampingan supaya
"kelihatan beda") **salah arah** — itu cuma nyembunyiin gejalanya, bukan
akar masalahnya. User lalu tunjukkan potongan `getData()` di
`DlgInputStok.java`: untuk `aktifkanbatch="no"` (nilai default), query
stok Java **selalu** kunci ke
`kode_brng+kd_bangsal+no_batch=''+no_faktur=''` (baris "tanpa batch") —
baris `gudangbarang` batch-tracked lainnya **sama sekali diabaikan**,
bukan dijumlah atau ditampilkan terpisah. Diperbaiki dengan menambah
syarat `AND gb.no_batch = '' AND gb.no_faktur = ''` di `LEFT JOIN
gudangbarang` (`getStokOpnameItems`) — sekarang satu `kode_brng` selalu
tepat satu baris per lokasi, persis Khanza Desktop. Kolom "No. Batch /
Faktur" yang sempat ditambahkan di tabel Input Opname **dihapus lagi**
karena sekarang selalu kosong (tidak informatif lagi). Diverifikasi
lewat `curl`: barang `2018003` di `AP` yang tadinya tampil 4x (1 baris
tanpa batch + 3 baris batch) sekarang tampil tepat 1x dengan
`stok=49` (cuma baris tanpa batch).

**Bug: daftar kepotong di tengah alfabet (barang "Z..." hilang) — SUDAH
DIPERBAIKI.** User bandingkan langsung screenshot Khanza Desktop (scroll
sampai "Zyloric 300 mg" di baris terakhir daftar) dengan versi web yang
cuma sampai huruf "E" (`Elasticband/Tensocrepe...`) padahal database-nya
sama persis. Sebabnya: query `getStokOpnameItems` sempat dikasih `ORDER
BY nama_brng LIMIT 500` (jaga-jaga performa) — karena diurutkan alfabetis
dan katalog aktifnya 2013 item, batas 500 itu otomatis motong semua
barang setelah sekitar huruf "E". Java (`tampil()` di `DlgInputStok.java`)
sama sekali tidak membatasi jumlah baris — semua barang aktif dimuat
sekaligus ke tabel (didesain untuk desktop app lokal/LAN, bukan web).
Diperbaiki dengan **menghapus `LIMIT`-nya sepenuhnya** — endpoint
sekarang selalu mengembalikan seluruh `databarang.status='1'` (terverifikasi
lewat `curl`: 2013 baris tanpa filter, "Zyloric" muncul). Konsekuensinya:
payload `GET /items` tanpa filter search jadi lebih besar (~2000 baris
JSON) — dianggap wajar mengikuti pola Java yang juga memuat semuanya
sekaligus, dan staf biasanya mempersempit lewat kotak pencarian di
frontend untuk kerja sehari-hari.

**Nilai "Real" yang sudah diisi TIDAK boleh hilang saat list refresh**
(ganti Lokasi atau ketik pencarian) — ditemukan lewat potongan
`tampil2()` di `DlgInputStok.java` yang user tunjukkan: Java eksplisit
menyimpan dulu isi kolom Real semua baris yang tidak kosong ke array
terpisah SEBELUM tabel di-`Valid.tabelKosong()` lalu dibangun ulang dari
cache/hasil pencarian, baru mengembalikan baris-baris yang sudah diisi
itu ke posisi awal tabel. Implementasi kami sebelumnya SALAH — tiap
`fetchItems()` (dipicu ganti `searchText` atau `kdBangsal`, keduanya
dependency `useCallback`) langsung `data.map(it => ({...it, real: ''}))`,
me-reset SEMUA baris termasuk yang sedang staf isi. Diperbaiki dengan
menggabungkan hasil fetch baru dengan nilai `real` dari state lama
(dicocokkan lewat key `kode_brng+no_batch+no_faktur`) alih-alih reset
kosong — padanan React dari pola simpan-lalu-kembalikan Java, walau
caranya beda (array sementara vs functional state update). Keterbatasan
yang **disengaja dan identik** dengan Java: kalau sebuah baris sempat
tersaring hilang dari hasil pencarian sebelum nilai Real-nya "diserap"
balik, nilainya tetap hilang — Java sendiri juga cuma menyimpan snapshot
tabel yang sedang tampil saat itu, bukan penyimpanan permanen terpisah.

**Dua temuan lagi dari `getData()`** (user tunjukkan potongan sumber
Java yang menghitung ulang stok/selisih/lebih per baris saat sel
"Real" diedit/baris dipilih):
1. **Kalau Lokasi kosong, SEMUA kolom Real ikut dikosongkan** —
   `if(nmgudang.getText().trim().equals("")){ for(...)
   tbDokter.setValueAt("",index,0); }`. Masuk akal: begitu Lokasi
   dikosongkan lagi (staf batal pilih), stok yang tampil kembali jadi
   placeholder `0` untuk semua baris, jadi Real yang sudah diisi
   otomatis tidak berarti lagi (selisih/lebih-nya cuma menghitung
   terhadap `0`, bukan stok sungguhan). Diikuti di frontend: logika
   merge `real` di `fetchItems` sekarang cek `kdBangsal` dulu — kalau
   kosong, semua baris direset ke `real: ''` alih-alih ikut dipertahankan.
2. **Ada total nominal berjalan** (label `LTotal`/`LTotal1` di Java,
   dihitung ulang tiap `getData()` dengan menjumlah kolom
   `nomihilang`/`nomilebih` seluruh baris) — ditambahkan sebagai
   ringkasan "Total Hilang"/"Total Lebih" (format Rupiah, warna
   merah/hijau) di sebelah indikator "N barang siap disimpan", dihitung
   `reduce` atas seluruh baris yang sudah diisi Real, supaya staf bisa
   melihat total dampak nominal sebelum menekan Simpan — bukan cuma per
   baris.

**Diuji end-to-end lewat `curl` di database dev** (hati-hati karena
fitur ini beneran mengubah stok sungguhan): dicatat dulu stok asli
barang test (`B000001033`, stok=90) → submit opname dengan real=85 →
verifikasi baris `opname` tersimpan dengan `selisih=5`,
`nomihilang=550` (5×110, sesuai rumus) → verifikasi `gudangbarang.stok`
benar-benar berubah jadi 85 → query riwayat menampilkan baris yang baru
disimpan dengan benar → hapus riwayat → verifikasi baris `opname` hilang
TAPI `gudangbarang.stok` **tetap 85** (bukti perilaku "tidak revert"
identik Java) → **stok manual dikembalikan ke 90** lewat `UPDATE`
langsung supaya data dev tidak tertinggal berubah dari sebelum
pengujian.

**Dropdown filter di tombol "Tampilkan"** (Input Opname) — tombol yang
tadinya cuma memicu `fetchItems()` sekarang jadi trigger dropdown (pola
`filterDropdownRef` + `showFilterDropdown` + listener `mousedown` dari
`RawatJalan.tsx` untuk container/klik-di-luar-tutup; isi menu &
struktur submenunya sendiri disesuaikan dengan screenshot context-menu
"Urutkan Data Berdasar" Khanza Desktop asli yang ditunjukkan user, bukan
sekadar dropdown `<select>` seperti percobaan pertama). Isinya:
- **Bersihkan Jumlah** — kosongkan semua kolom Real (`setRows` map ke
  `real: ''`), padanan tombol Batal per-baris Java tapi sekaligus semua
  baris.
- **Tampilkan Semua Stok** / **Tampilkan Belum Diopname** / **Tampilkan
  Sudah Diopname** — tiga pilihan `opnameFilter` (`'semua' | 'belum' |
  'sudah'`), membedakan baris murni dari kolom "Real" terisi/kosong di
  client (bukan query tanggal-scoped seperti Java — lihat
  penyederhanaan poin 2 di atas: staf boleh opname ulang kapan saja,
  jadi "sudah/belum" di sini artinya "sudah/belum diisi di sesi kerja
  saat ini", bukan "sudah/belum pernah diopname historis").
- **Urutkan Data Berdasar** — item submenu (flyout ke kanan saat
  di-hover, `showSortSubmenu`, posisi `left: 100%`), 8 pilihan persis
  urutan di screenshot referensi: Kode Barang Descending/Ascending,
  Nama Barang Descending/Ascending, Kategori Ascending/Descending,
  Satuan Descending/Ascending — tiap pilihan set `sortBy` (`'nama' |
  'kode' | 'kategori' | 'satuan'`, "Kategori" dipetakan ke kolom
  `jenis`) dan `sortDir` (`'asc' | 'desc'`) sekaligus. Item "Tampilkan
  Data Batch N Bulan Terakhir" di screenshot Java **tidak diikutkan** —
  di luar scope karena implementasi kami tidak melacak batch (lihat
  penyederhanaan `aktifkanbatch="no"` di atas).

Semua fitur dihitung murni client-side lewat `displayRows` (`useMemo`
atas `rows` + `opnameFilter` + `sortBy` + `sortDir`) — tidak ada
endpoint baru, karena seluruh katalog aktif sudah termuat di `rows`.
Tabel & input "Real" membaca/menulis lewat `displayRows`, bukan `rows`
langsung, jadi `setReal` identity-based (key
`kode_brng+no_batch+no_faktur`, fungsi `rowKey` yang sama dipakai
merge-preserve) supaya penomoran baris tetap benar walau urutan/subset
tabel berubah akibat sort/filter. Total Hilang/Lebih & counter "N siap
disimpan" tetap dihitung dari `rows` penuh (bukan `displayRows`) secara
sengaja — nominalnya harus mencerminkan semua baris yang sudah diisi,
bukan cuma yang lagi kelihatan di layar setelah difilter.

### Tab "Mutasi Obat & BHP" — SELESAI

Cocok dengan **dua** dialog Khanza Desktop terpisah (pola sama dengan Stok
Opname): **"Mutasi Antar Gudang"** input (`inventory/DlgMutasiBarang.java`
— form INPUT sebenarnya, satu-satunya yang punya tombol Simpan) dan
**riwayat mutasi** (`inventory/DlgPindahGudang.java` — laporan + tombol
Hapus, dipanggil dari BtnCari di form input).

Tabel `mutasibarang` (kode_brng, jml, harga, kd_bangsaldari, kd_bangsalke,
tanggal, keterangan, no_batch, no_faktur — PK majemuk keenamnya) adalah
LOG mutasi. **Beda penting dari tabel `opname`**: Simpan mutasi mengubah
`gudangbarang.stok` di DUA sisi sekaligus (asal berkurang, tujuan
bertambah) — dan **Hapus riwayat mutasi JUSTRU MEREVERT stok di kedua
sisi** (asal ditambah kembali, tujuan dikurangi), **kebalikan dari
perilaku Stok Opname** (yang hapus riwayatnya tidak menyentuh stok sama
sekali). Ini diverifikasi langsung dari method `hapus()` di
`DlgPindahGudang.java` — beda dari `DlgStokOpname.java` yang cuma delete
baris log tanpa logika revert.

**Rumus Java** (`BtnSimpanActionPerformed` di `DlgMutasiBarang.java`,
jalur `aktifkanbatch="no"` — nilai default, satu-satunya yang diport,
sama seperti Stok Opname):
```
INSERT mutasibarang (..., no_batch='', no_faktur='')
UPDATE gudangbarang SET stok = stok - jml WHERE kode_brng=? AND kd_bangsal=kd_bangsaldari AND no_batch='' AND no_faktur=''
UPDATE gudangbarang SET stok = stok + jml WHERE kode_brng=? AND kd_bangsal=kd_bangsalke AND no_batch='' AND no_faktur=''
```
(insert baris `gudangbarang` baru kalau barang belum pernah ada di lokasi
tujuan — padanan pola upsert yang sama dipakai di Stok Opname.)

**Penyederhanaan yang disengaja** dari versi Java (pola sama dengan Stok
Opname):
- Harga dasar nominal selalu pakai `databarang.h_beli` (bukan opsi
  HPPFARMASI per-batch dari `data_batch`).
- **UPDATE (retrofit)**: `Trackobat.catatRiwayat` awalnya TIDAK diport —
  diretrofit lewat `catatRiwayatBarangMedis` (posisi `"Mutasi"`, DUA
  panggilan per item — satu di lokasi Dari sebelum dikurangi, satu di
  lokasi Ke sebelum ditambah, persis urutan Java) begitu tab "Riwayat
  Obat, Alkes & BHP" mulai dibangun. Lihat bagian itu untuk detail.
- Alur "Permintaan Medis" (`tampil(String nopermintaan)` di Java,
  auto-isi form Mutasi dari `permintaan_medis`/`detail_permintaan_medis`
  yang sudah disetujui) awalnya di luar scope di sini — **SEKARANG SUDAH
  ADA** sebagai tab terpisah "Permintaan Obat & BHP" (lihat bagian
  tersendiri di bawah), yang meng-encapsulate logika mutasi ini lewat
  endpoint `setujuiPermintaan` sendiri (duplikasi logika, bukan
  memanggil `submitMutasi` langsung — lihat penjelasan di bagian
  Permintaan).
- Tidak melacak batch (`aktifkanbatch="no"`) — `gudangbarang` selalu
  dikunci ke `no_batch='' AND no_faktur=''`.

**Beda penting dari Stok Opname soal daftar barang**: endpoint items DI
SINI **wajib** ada `kd_bangsal_dari` (kalau kosong, mengembalikan daftar
kosong, bukan error) dan HANYA menampilkan barang yang **stoknya > 0** di
lokasi asal tsb — persis `tampil()` di `DlgMutasiBarang.java`
("gudangbarang.stok>0 and gudangbarang.kd_bangsal=?"). Ini beda dari Stok
Opname yang selalu menampilkan SELURUH katalog aktif tanpa syarat lokasi
— masuk akal karena tidak mungkin memindahkan barang yang stoknya nol di
sumbernya.

Backend: `backend/apotek_mutasi_handler.go` — 4 endpoint:
- `GET /api/apotek/mutasi/items?kd_bangsal_dari=&kd_bangsal_ke=&search=`
  — daftar barang berstok>0 di `kd_bangsal_dari` (INNER JOIN
  `gudangbarang`, bukan LEFT), plus `stok_tujuan` (LEFT JOIN ke
  `kd_bangsal_ke`, fallback `0` kalau belum diisi/belum ada barisnya).
- `POST /api/apotek/mutasi` — body `{kd_bangsal_dari, kd_bangsal_ke,
  tanggal, keterangan, items[]}`. **Validasi ulang stok_asal TERKINI di
  server** (bukan cuma percaya angka dari payload frontend) sebelum
  INSERT+UPDATE per item dalam satu transaksi — beda dari Java yang tidak
  perlu validasi ini karena satu desktop app dipakai satu staf per sesi,
  sementara web bisa diakses banyak tab/user bersamaan sehingga stok bisa
  sudah berubah sejak daftar terakhir difetch. Diuji lewat `curl`: request
  jml=9999 (melebihi stok asal 49) ditolak dengan pesan jelas, transaksi
  di-rollback, stok tidak berubah sama sekali.
- `GET /api/apotek/mutasi/riwayat?tgl1=&tgl2=&kd_bangsal=&search=` —
  laporan riwayat (JOIN `mutasibarang`+`databarang`+`bangsal` DUA KALI
  untuk Dari & Ke), default 30 hari terakhir kalau `tgl1`/`tgl2` tidak
  dikirim (pola sama Stok Opname). `kd_bangsal` (kalau diisi) mencocokkan
  SALAH SATU dari Dari ATAU Ke. Kolom `tanggal` sengaja diformat eksplisit
  lewat `DATE_FORMAT(...,'%Y-%m-%d %H:%i:%s')` di SQL (bukan mengandalkan
  konversi default driver Go dari `DATETIME`) supaya nilainya predictable
  dan bisa dipakai lagi persis sebagai parameter `tanggal` saat Hapus
  (`mutasibarang.tanggal` itu `DATETIME`, beda dari `opname.tanggal` yang
  cuma `DATE`).
- `DELETE /api/apotek/mutasi` (query param, bukan path, karena PK majemuk
  6 kolom) — hapus satu baris riwayat **DAN REVERT stok di kedua lokasi**
  (lihat penjelasan di atas) — beda paling penting dari perilaku Hapus di
  Stok Opname.

Frontend: `frontend/src/modules/ApotekMutasi.tsx` — 2 sub-tab meniru
pemisahan dua dialog Java di atas: **"Input Mutasi"** (pilih Dari/Ke/
Tanggal/Keterangan, tabel barang muncul begitu Dari dipilih — kolom
Jml/Kode/Nama/Satuan/Harga/Total/Stok Asal/Stok Tujuan/Kadaluwarsa;
mengetik Jml dihitung otomatis Total = Jml×Harga di frontend; ganti Dari
otomatis mengosongkan semua Jml yang sudah diisi — Stok Asal-nya sudah
tidak relevan lagi begitu lokasi asal berubah, padanan aturan "Lokasi
kosong wipe Real" di Stok Opname yang digeneralisasi; validasi Jml
melebihi Stok Asal muncul saat blur kolom, Swal warning + reset ke kosong,
padanan `tbDokterMouseClicked` di Java yang reset+alert kalau jumlah
melebihi stok tersedia) dan **"Riwayat Mutasi"** (filter rentang tanggal +
lokasi Dari/Ke + cari, tabel hasil JOIN, tombol Hapus per baris dengan
teks konfirmasi yang EKSPLISIT menjelaskan stok AKAN dikembalikan ke
kedua lokasi — beda pesan dari Stok Opname yang menjelaskan stok TIDAK
dikembalikan).
Dipasang sebagai tab utama modul Apotek (`Apotek.tsx`) menggantikan
placeholder lama.

**Diuji end-to-end lewat `curl` di database dev** (hati-hati karena fitur
ini beneran mengubah stok sungguhan di dua lokasi sekaligus): dicatat dulu
stok asli barang test (`2018003`, AP=49, GD=1546) → submit mutasi jml=2
dari AP ke GD → verifikasi `mutasibarang` tersimpan (`total=475714`,
sesuai jml×harga) → verifikasi `gudangbarang.stok` AP jadi 47, GD jadi
1548 (persis rumus dua-sisi) → riwayat menampilkan baris baru dengan
`tanggal` terformat rapi (`"2026-07-17 00:00:00"`) → hapus riwayat →
verifikasi baris `mutasibarang` hilang DAN `gudangbarang.stok` kembali
tepat ke AP=49, GD=1546 (bukti perilaku revert, beda dari Stok Opname) →
test tambahan: submit jml=9999 (melebihi stok asal) ditolak dengan pesan
jelas, stok tidak berubah sama sekali (bukti validasi server-side
bekerja).

### Tab "Permintaan Obat & BHP" — SELESAI

Cocok dengan **dua** dialog Khanza Desktop terpisah: **"Permintaan"** input
(`inventory/DlgPermintaan.java` — form buat permintaan baru, satu-satunya
yang punya tombol Simpan) dan **"Cari Permintaan"**
(`inventory/DlgCariPermintaan.java` — daftar semua permintaan + klik-kanan
untuk Setujui/Tolak/Hapus).

**Alur bisnis** (diverifikasi dari urutan kolom `INSERT` di
`BtnSimpanActionPerformed` Java + `DlgMutasiBarang.tampil(String
nopermintaan)` yang dipanggil saat approve — bukan tebakan dari nama
field, karena nama field Java ("Ditujukan Ke" vs "Asal Permintaan")
sendiri berlawanan arah dengan makna kolomnya):
- Satu depo/bangsal ("Asal Permintaan" = `permintaan_medis.kd_bangsal`)
  membuat permintaan barang, **ditujukan ke** depo lain ("Ditujukan Ke" =
  `permintaan_medis.kd_bangsaltujuan`, biasanya gudang utama) yang
  diharapkan memasoknya. Status awal selalu `'Baru'`.
- Depo tujuan me-review lalu **Setujui (Mutasi)**: ini memicu Mutasi
  Obat & BHP dengan `kd_bangsal_dari` = `kd_bangsaltujuan` permintaan (si
  pemasok) dan `kd_bangsal_ke` = `kd_bangsal` permintaan (si peminta) —
  **field-nya tertukar** dari sudut pandang form permintaan ke sudut
  pandang Mutasi. Begitu Mutasi berhasil, status permintaan otomatis
  jadi `'Disetujui'`.
- Java juga punya jalur approve **"Disetujui (Stok Keluar)"** lewat
  `DlgPengeluaranApotek` (dispensing langsung tanpa mutasi antar-gudang)
  — **TIDAK diport**, karena modul Pengeluaran Apotek itu sendiri belum
  ada di proyek ini (di luar scope; kalau nanti dibuat, jalur approve ini
  bisa ditambahkan sebagai opsi kedua).
- **Tolak** (`status='Tidak Disetujui'`) cuma update status, tidak ada
  efek stok apa pun — identik Java.
- **Hapus permintaan**: kode Java `ppHapusActionPerformed` cuma satu
  `DELETE` ke `permintaan_medis` (kelihatan seperti bakal meninggalkan
  `detail_permintaan_medis` yatim) — tapi diverifikasi lewat
  `SHOW CREATE TABLE`, kolom `detail_permintaan_medis.no_permintaan`
  sudah `ON DELETE CASCADE` di level skema DB, jadi Java-nya sendiri
  sebenarnya sudah aman (**bukan bug**, koreksi dari catatan sebelumnya
  di dokumen ini yang sempat salah menyebut ini "orphan"). Endpoint kami
  tetap eksplisit menghapus baris detail sendiri (bukan cuma bergantung
  ke cascade DB) supaya independen dari asumsi skema kalau FK-nya
  berubah suatu saat.

**Tabel**: `permintaan_medis` (`no_permintaan` PK, `kd_bangsal`, `nip`,
`tanggal`, `status` enum `'Baru'|'Disetujui'|'Tidak Disetujui'`,
`kd_bangsaltujuan`) dan `detail_permintaan_medis` (`no_permintaan`,
`kode_brng`, `kode_sat`, `jumlah`, `keterangan`).

**No.Permintaan** digenerate **server-side** (bukan dipercaya dari
payload klien), rumus identik `autoNomor()` di Java: prefix
`"PM"+YYYYMMDD`, lalu 3 digit urut per tanggal
(`MAX(RIGHT(no_permintaan,3))+1`) — dijalankan di DALAM transaksi yang
sama dengan `INSERT` supaya tidak race condition antar dua permintaan di
tanggal yang sama. Diverifikasi lewat `curl`: permintaan pertama di
tanggal tertentu dapat `...001`, permintaan kedua di tanggal yang sama
dapat `...002` walau yang pertama sudah ditolak (urutan nomor tidak
"dikembalikan" — sama seperti Java yang murni `MAX+1`, bukan mengisi
celah nomor yang kosong).

**Penyederhanaan yang disengaja**:
- Item picker untuk bikin permintaan baru cuma tampilkan
  kode/nama/satuan barang (tanpa kolom Jenis/Kategori/Golongan seperti
  tabel Java) — field itu di Java murni untuk memperkaya filter
  pencarian, sudah tercover oleh `search` bebas di endpoint kami.

Backend: `backend/apotek_permintaan_handler.go` — 7 endpoint:
- `GET /api/apotek/permintaan/barang-opsi?search=` — daftar barang aktif
  untuk dipilih (tanpa join stok, karena stok baru relevan saat approve).
- `GET /api/apotek/permintaan/pegawai-opsi?search=` — daftar pegawai
  `stts_aktif='AKTIF'` untuk field Petugas.
- `POST /api/apotek/permintaan` — body `{kd_bangsal, kd_bangsal_tujuan,
  nip, tanggal, items[]}`, generate No.Permintaan + `INSERT`
  `permintaan_medis`+`detail_permintaan_medis` dalam satu transaksi.
- `GET /api/apotek/permintaan/riwayat?tgl1=&tgl2=&kd_bangsal=&status=&search=`
  — daftar permintaan (header) dengan `items[]` di-embed langsung per
  baris (query detail terpisah per header, bukan JOIN datar seperti Java,
  supaya JSON-nya rapi per-permintaan alih-alih baris kosong pemisah ala
  Swing table) — default 30 hari terakhir. `kd_bangsal` (kalau diisi)
  mencocokkan SALAH SATU dari Asal ATAU Tujuan (pola sama Mutasi).
- `PUT /api/apotek/permintaan/:no_permintaan/status` — Tolak (hanya
  terima `status: "Tidak Disetujui"`), menolak kalau status bukan
  `'Baru'` (sudah pernah divalidasi — pesan sama dengan Java
  `"Data permintaan sudah divalidasi...!!"`).
- `POST /api/apotek/permintaan/:no_permintaan/setujui` — Setujui via
  Mutasi: body `{tanggal, keterangan, items[]}`. Logika stok
  (validasi ulang stok_asal live, `INSERT mutasibarang`, `UPDATE`/`INSERT`
  `gudangbarang` dua sisi) **sengaja diduplikasi** dari `submitMutasi` di
  `apotek_mutasi_handler.go` alih-alih dipanggil langsung — mengikuti
  pola satu file mandiri per fitur yang sudah dipakai di seluruh modul
  ini, dan supaya transaksi Mutasi + `UPDATE status='Disetujui'` bisa
  100% atomic dalam satu `db.Begin()` (kalau salah satu item gagal
  karena stok kurang, SEMUANYA di-rollback termasuk status permintaan
  tetap `'Baru'`).
- `DELETE /api/apotek/permintaan/:no_permintaan` — hapus permintaan +
  detail (lihat deviasi di atas).

Frontend: `frontend/src/modules/ApotekPermintaan.tsx` — 2 sub-tab meniru
pemisahan dua dialog Java: **"Buat Permintaan"** (pilih Asal/Ditujukan
Ke/Petugas/Tanggal, tabel katalog barang muncul begitu tab dibuka —
staf isi kolom Jumlah + Keterangan opsional per baris, validasi guard
sebelum isi Jumlah [blink merah] kalau Asal/Ditujukan Ke/Petugas belum
lengkap, pola identik `guardRealFocus`/`guardJmlFocus` di Stok
Opname/Mutasi) dan **"Daftar Permintaan"** (filter tanggal + lokasi +
status + cari, baris bisa diklik untuk expand/collapse melihat detail
barangnya, badge warna per status, tombol Setujui/Tolak/Hapus muncul
kalau status masih `'Baru'`, cuma Hapus yang tetap tersedia untuk status
lain). Tombol **"Setujui (Mutasi)"** membuka modal review: fetch live
`stok_asal`/`h_beli` lewat endpoint Mutasi yang SUDAH ADA
(`GET /api/apotek/mutasi/items?kd_bangsal_dari=<tujuan>&kd_bangsal_ke=<asal>`,
di-filter client-side ke kode_brng yang diminta) — staf bisa
menyesuaikan jumlah yang benar-benar disetujui (default = jumlah
diminta) sebelum menekan "Setujui & Proses Mutasi", baris dengan stok
asal kurang dari jumlah yang diisi ditandai merah sebagai peringatan
visual sebelum submit (validasi final tetap di server).
Dipasang sebagai tab utama modul Apotek (`Apotek.tsx`).

**Diuji end-to-end lewat `curl` di database dev**: buat permintaan
`AP→GD` (jml=3) → dapat `no_permintaan="PM20260717001"` (format persis
Java) → Tolak → verifikasi status `'Tidak Disetujui'` → buat permintaan
kedua di tanggal sama → dapat `"...002"` (bukti urutan nomor tidak
mundur walau permintaan pertama sudah ditolak) → Setujui (Mutasi) jml=5
→ verifikasi `gudangbarang.stok` AP naik 49→54 dan GD turun 1546→1541
(persis arah "tujuan memasok asal") dan status permintaan otomatis jadi
`'Disetujui'` → hapus kedua baris test → verifikasi
`permintaan_medis`+`detail_permintaan_medis` bersih (0 baris) dan stok
manual dikembalikan ke nilai asal (AP=49, GD=1546) supaya data dev tidak
tertinggal berubah.

### Tab "Penerimaan Obat & BHP" — SELESAI

Cocok dengan **dua** dialog Khanza Desktop terpisah: **"Pembelian"**
(`inventory/DlgPembelian.java` — form transaksi pembelian/penerimaan dari
supplier, satu-satunya yang punya tombol Simpan) dan **"Cari Pembelian"**
(`inventory/DlgCariPembelian.java` — daftar riwayat + klik-kanan Hapus).
Nama tabnya "Penerimaan" (bukan "Pembelian") karena dari sudut pandang
gudang/apotek ini adalah **transaksi PENERIMAAN barang dari luar rumah
sakit** yang langsung menambah stok — beda dari Mutasi (pindah stok antar
lokasi INTERNAL) dan beda dari Permintaan (dokumen internal yang baru
mengubah stok setelah disetujui lewat Mutasi).

**Rumus per baris** (persis `getData()` di `DlgPembelian.java`):
```
subtotal = jumlah * h_beli
besardis = subtotal * (dis% / 100)
total    = subtotal - besardis
```
**Rumus header**:
```
total1 (subtotal) = SUM(subtotal semua baris)
potongan          = SUM(besardis semua baris)
total2            = total1 - potongan
ppn               = (ppn% / 100) * total2
tagihan           = total2 + ppn
```
Diverifikasi persis lewat `curl`: 10×`h_beli 237857` dengan diskon 5% dan
PPN 11% menghasilkan `tagihan=2508202.065`, cocok dihitung manual
step-by-step.

**Tabel**: `pembelian` (`no_faktur` PK, `kode_suplier`, `nip`, `tgl_beli`,
`total1`, `potongan`, `total2`, `ppn`, `tagihan`, `kd_bangsal`, `kd_rek`)
dan `detailbeli` (`no_faktur`, `kode_brng`, `kode_sat`, `jumlah`,
`h_beli`, `subtotal`, `dis`, `besardis`, `total`, `no_batch`, `jumlah2`,
`kadaluarsa`). **Penting**: `detailbeli.no_faktur` punya FK
`ON DELETE CASCADE` ke `pembelian` di level skema DB — jadi hapus baris
`pembelian` otomatis membersihkan `detailbeli`-nya tanpa perlu `DELETE`
manual terpisah (diverifikasi lewat `SHOW CREATE TABLE` DAN lewat test
`curl`: hapus faktur test, `detailbeli` langsung 0 baris).

**No.Faktur** digenerate server-side, rumus identik `autoNomor()` Java:
prefix `"PG"+YYYYMMDD` + 3 digit urut per tanggal
(`MAX(RIGHT(no_faktur,3))+1`), dalam transaksi yang sama dengan `INSERT`
(pola sama persis dengan No.Permintaan di fitur Permintaan, cuma beda
prefix "PG" vs "PM" dan tabel sumbernya).

**Hapus riwayat REVERT stok** (`gudangbarang.stok -= jumlah`) — persis
`ppHapusActionPerformed` di `DlgCariPembelian.java`, **TANPA guard stok
tidak boleh minus** (Java sendiri juga tidak menjaga ini, jadi endpoint
kami disamakan — beda dari `submitMutasi`/`setujuiPermintaan` yang memang
ada validasi stok karena itu **pemindahan** antar lokasi yang harus
konsisten dua sisi, sementara di sini cuma revert SATU transaksi yang
secara logis boleh membuat stok "seolah belum pernah diterima", bahkan
kalau sudah keburu terpakai oleh transaksi lain sesudahnya).

**Penyederhanaan yang disengaja** (pola sama modul lain):
- **Tidak ada integrasi Jurnal/akuntansi** (`tampjurnal`, `AkunBayar`,
  `jur.simpanJurnal` di Java) — modul Keuangan/Jurnal tidak ada sama
  sekali di proyek ini, kolom `kd_rek` di `pembelian` cukup diisi `NULL`.
- **Tidak ada konversi satuan besar/kecil** (`SatuanBeli`/`isi`/
  `hargabesar` di Java, beli per-dus otomatis dikonversi ke satuan
  kecil/pcs) — harga & jumlah selalu dalam satuan dasar
  `databarang.kode_sat`; kolom `jumlah2` (Java: "jumlah setelah
  konversi") selalu SAMA dengan `jumlah`.
- **Tidak melacak batch** (`aktifkanbatch="no"`, `no_batch` selalu `''`)
  dan **tidak insert ke `data_batch`** — pola sama Stok Opname/Mutasi/
  Permintaan.
- **Tidak update `databarang.h_beli`/harga jual** (checkbox "update
  harga" per baris + `simpanbatch()` di Java) — di luar scope sengaja:
  manajemen harga jual adalah fitur terpisah yang bisa memengaruhi modul
  lain (Kasir, Resep) kalau diubah sembarangan tanpa pertimbangan lebih
  lanjut; harga beli per transaksi cukup tersimpan sebagai riwayat di
  `detailbeli.h_beli`, tidak mengubah master `databarang`.

Backend: `backend/apotek_penerimaan_handler.go` — 4 endpoint:
- `GET /api/apotek/penerimaan/barang-opsi?search=` — daftar barang aktif
  + `h_beli` (dipakai sebagai default harga yang bisa diubah staf saat
  input, beda dari Permintaan yang tidak butuh harga sama sekali).
- `POST /api/apotek/penerimaan` — body `{kode_suplier, nip, tanggal,
  kd_bangsal, ppn_percent, items[]}`, hitung rumus di atas server-side,
  generate No.Faktur, `INSERT` `pembelian`+`detailbeli` dan
  `UPDATE`/`INSERT` `gudangbarang` (tambah stok) semua dalam satu
  transaksi.
- `GET /api/apotek/penerimaan/riwayat?tgl1=&tgl2=&kd_bangsal=&kode_suplier=&search=`
  — daftar penerimaan (header) dengan `items[]` di-embed per baris
  (pola sama Permintaan), default 30 hari terakhir.
- `DELETE /api/apotek/penerimaan/:no_faktur` — revert stok tiap baris
  lalu hapus header (`detailbeli` ikut lewat cascade DB).

Reuse endpoint yang SUDAH ADA (tidak bikin baru): `GET /api/apotek/suplier`
(picker Supplier, dari fitur Pengaturan → Data Supplier) dan
`GET /api/petugas` (picker Petugas — **beda tabel dari Permintaan**:
`pembelian.nip` ber-FK ke tabel `petugas`, sementara
`permintaan_medis.nip` ber-FK ke tabel `pegawai` — dua tabel kepegawaian
terpisah di skema native Khanza, bukan salah ketik; endpoint yang dipilih
mengikuti FK constraint masing-masing tabel, diverifikasi lewat
`SHOW CREATE TABLE`).

Frontend: `frontend/src/modules/ApotekPenerimaan.tsx` — 2 sub-tab meniru
pemisahan dua dialog Java: **"Terima Barang"** (pilih Supplier/Petugas/
Lokasi/Tanggal/PPN%, tabel katalog barang muncul begitu tab dibuka — staf
isi Jumlah + boleh ubah Harga Beli (prefill dari `databarang.h_beli`) +
Diskon% + Kadaluwarsa opsional per baris, kolom Total per baris dihitung
live, ringkasan Tagihan ditampilkan di toolbar sebelum Simpan, guard
blink-merah kalau Supplier/Petugas/Lokasi belum lengkap saat isi Jumlah —
pola identik fitur-fitur Apotek lainnya) dan **"Riwayat Penerimaan"**
(filter tanggal + lokasi + cari, baris bisa diklik untuk expand/collapse
detail barang + ringkasan Subtotal/Potongan/PPN/Tagihan, tombol Hapus per
baris dengan teks konfirmasi yang menjelaskan stok AKAN dikurangi
kembali). Dipasang sebagai tab utama modul Apotek (`Apotek.tsx`).

**Diuji end-to-end lewat `curl` di database dev**: terima barang `2018003`
di `AP` (jml=10, harga=237857, diskon=5%, PPN=11%) → dapat
`no_faktur="PG20260717001"` (format persis Java) dan `tagihan=2508202.065`
(cocok hitung manual) → verifikasi `gudangbarang.stok` AP naik 49→59 →
riwayat menampilkan baris baru dengan detail item lengkap → hapus riwayat
→ verifikasi stok kembali tepat ke 49 DAN `pembelian`+`detailbeli` bersih
(0 baris masing-masing, bukti cascade DB bekerja) supaya data dev tidak
tertinggal berubah.

### Tab "Riwayat Obat, Alkes & BHP" — SELESAI

Cocok dengan `inventory/DlgRiwayatBarangMedis.java` — laporan **READ-ONLY
MURNI** (Java sama sekali tidak punya tombol Simpan/Hapus, cuma
Cari/Cetak) atas tabel log `riwayat_barang_medis`.

**Latar belakang penting**: tabel ini diisi lewat
`inventory/riwayatobat.java` method `catatRiwayat(...)`, dipanggil dari
SETIAP fitur yang mengubah `gudangbarang.stok` (Opname, Mutasi,
Pembelian/Pengadaan, approve Permintaan) — **SEBELUM** `UPDATE
gudangbarang`-nya sendiri dieksekusi, supaya `stok_awal` yang tercatat
adalah nilai sungguhan sesaat sebelum perubahan.

**Retrofit (keputusan disengaja, dikonfirmasi user)**: keempat fitur stok
lain di modul ini (Stok Opname, Mutasi, Penerimaan, approve Permintaan)
TADINYA sengaja tidak memanggil `Trackobat.catatRiwayat`
(didokumentasikan waktu itu sebagai "di luar scope"). Begitu tab laporan
ini mulai dibangun, itu jadi masalah nyata: laporan bakal SELALU KOSONG
dari aktivitas web app, cuma menampilkan riwayat lama dari Khanza Desktop
yang beku (443 baris data historis di DB dev, murni dari pemakaian
aplikasi desktop sebelumnya). Diputuskan untuk SEKALIGUS retrofit
pemanggilan `catatRiwayatBarangMedis` (helper baru di
`backend/apotek_riwayat_barang_medis.go`) ke keempat handler yang sudah
ada, PERSIS titik & urutan panggilan Java (sebelum `UPDATE
gudangbarang`), supaya laporan ini benar-benar mencerminkan aktivitas web
app ke depannya:
- **Stok Opname** (`submitStokOpname`): posisi `"Opname"`, satu panggilan
  per item, SEBELUM `UPDATE gudangbarang`. **Kuirk Java direplikasi
  persis** (bukan "diperbaiki"): untuk posisi `"Opname"`,
  `riwayatobat.catatRiwayat` memaksa `keluar=0` dan `stok_akhir=masuk`
  (BUKAN hasil rumus `stok_awal+masuk-keluar`) — karena parameter `masuk`
  yang dikirim untuk Opname memang sudah berisi nilai "Real" (hasil
  hitung fisik) itu sendiri, bukan delta. `DlgStokOpname.java` (laporan
  riwayat opname, beda dari `DlgInputStok.java`) TIDAK memanggil
  `catatRiwayat` saat Hapus — jadi `deleteStokOpnameRiwayat` tetap tidak
  menulis ke `riwayat_barang_medis`, identik Java.
- **Mutasi** (`submitMutasi` + `deleteMutasiRiwayat`): posisi `"Mutasi"`,
  DUA panggilan per item tiap aksi — satu di lokasi Dari (keluar) SEBELUM
  dikurangi, satu di lokasi Ke (masuk) SEBELUM ditambah (kebalikan arah
  masuk/keluar saat Hapus, karena stok direvert). Keterangan diformat
  persis Java: `"{keterangan}, dari {nmDari} ke {nmKe}"`.
- **Penerimaan** (`submitPenerimaan` + `deletePenerimaan`): posisi
  **`"Pengadaan"`** (BUKAN `"Penerimaan"` — nama tab web kita "Penerimaan"
  tapi dialog Java yang benar-benar diport, `DlgPembelian.java`, menulis
  posisi `"Pengadaan"`; enum `"Penerimaan"` di skema DB dipakai fitur
  Khanza lain yang tidak kami port). Keterangan saat Simpan:
  `"{no_faktur} {nama_suplier}"`; saat Hapus cuma `"{no_faktur}"` (tanpa
  nama supplier) — beda format ini diverifikasi langsung dari dua lokasi
  kode Java yang berbeda (`DlgPembelian.java` vs `DlgCariPembelian.java`).
- **Permintaan** (`setujuiPermintaan`): posisi `"Mutasi"` (karena approve
  Permintaan secara internal ADALAH transaksi Mutasi — lihat bagian
  Permintaan di atas), pola sama persis dengan Mutasi.
- Permintaan itu sendiri (buat/tolak/hapus) TIDAK menulis riwayat —
  `DlgPermintaan.java` tidak pernah memanggil `Trackobat` sama sekali,
  cuma alur approve-nya (yang menjelma jadi Mutasi) yang menulis.

**"petugas"** di semua panggilan di atas SELALU merujuk ke padanan
`akses.getkode()` Java (operator yang sedang login menekan Simpan/Hapus)
— **BUKAN** field bisnis "Petugas"/`nip` yang sudah ada di form
Penerimaan/Permintaan (staf yang tercatat bertanggung jawab atas
transaksi, konsepnya beda). Frontend mengirim identitas user yang sedang
login (`full_name`/`username` dari `localStorage['ermapp_user']`, lewat
utility baru `frontend/src/utils/currentUser.ts` fungsi
`getCurrentPetugas()`) sebagai parameter terpisah `petugas` di setiap
request Simpan/Hapus pada keempat fitur di atas.

Backend: `backend/apotek_riwayat_barang_medis.go`:
- `catatRiwayatBarangMedis(tx, ...)` — helper INTERNAL (bukan HTTP
  handler), dipanggil dari 4 file handler lain di dalam transaksi yang
  sama dengan perubahan stoknya. Query `stok_awal` LIVE dari
  `gudangbarang` di dalam transaksi (bukan dipercaya dari parameter
  pemanggil) — konsisten dengan Java yang juga query ulang di dalam
  `riwayatobat.catatRiwayat`, bukan menerima stok_awal sebagai parameter.
- `GET /api/apotek/riwayat-barang-medis?tgl1=&tgl2=&kd_bangsal=&kode_brng=&posisi=&search=`
  — laporan read-only, padanan `prosesCari()` di
  `DlgRiwayatBarangMedis.java` (JOIN `databarang`+`bangsal`, rentang
  tanggal default 30 hari terakhir, search bebas lintas kolom). Tambahan
  filter `posisi` (dropdown 16 kategori transaksi persis enum kolomnya)
  tidak ada secara eksplisit di form Java (yang cuma punya search bebas
  `TCari`), tapi masuk akal ditambahkan sebagai quality-of-life karena
  sudah tersedia sebagai kolom terindeks.

Frontend: `frontend/src/modules/ApotekRiwayatBarangMedis.tsx` — SATU
halaman (tidak ada sub-tab, sesuai Java yang cuma satu dialog laporan):
filter Dari/s.d. Tanggal + Lokasi + Posisi + Cari, tabel dengan kolom
Tanggal/Jam, Barang, Stok Awal, Masuk (+hijau), Keluar (-merah), Stok
Akhir (tebal), Posisi (warna per kategori: biru=Mutasi,
oranye=Opname, hijau=Pengadaan/Hibah, abu=lainnya), Lokasi, Petugas,
Status (badge hijau=Simpan/merah=Hapus), Keterangan. Murni read-only,
tidak ada tombol Hapus/Edit sama sekali (identik Java — tidak ada
`BtnSimpan`/`BtnHapus` di `DlgRiwayatBarangMedis.java`, cuma
`BtnCari`/`BtnPrint`).
Dipasang sebagai tab utama modul Apotek (`Apotek.tsx`).

**Diuji end-to-end lewat `curl` di database dev**, satu per satu untuk
keempat fitur yang di-retrofit (item test `2018003`, lokasi `AP`↔`GD`):
- Stok Opname: `real=45` dari `stok=49` → baris riwayat
  `stok_awal=49, masuk=45, keluar=0, stok_akhir=45` (bukti kuirk Opname
  direplikasi persis, bukan pakai rumus biasa).
- Mutasi Simpan: `jml=3` AP→GD → DUA baris riwayat
  (`AP: masuk=0,keluar=3,stok_akhir=46` dan `GD:
  masuk=3,keluar=0,stok_akhir=1549`), keterangan
  `"..., dari Apotek ke GUDANG"` → Hapus → DUA baris riwayat status
  `"Hapus"` dengan masuk/keluar terbalik, stok kembali tepat 49/1546.
- Penerimaan Simpan: `jumlah=7` di AP → baris riwayat
  `stok_awal=49,masuk=7,stok_akhir=56`, keterangan
  `"PG20260717001 AAM"` → Hapus → baris riwayat status `"Hapus"`,
  keterangan cuma `"PG20260717001"` (tanpa nama suplier, sesuai
  perbedaan format Simpan vs Hapus di atas), stok kembali 49.
- Permintaan Setujui: `jml=4` diminta AP dari GD → approve → DUA baris
  riwayat posisi `"Mutasi"` (GD berkurang, AP bertambah), keterangan
  `"..., dari GUDANG ke Apotek"`.
Semua data test (stok, baris `opname`/`mutasibarang`/`pembelian`/
`detailbeli`/`permintaan_medis`/`detail_permintaan_medis`/
`riwayat_barang_medis`) dibersihkan/dikembalikan ke nilai asal setelah
pengujian supaya data dev tidak tertinggal berubah.

### Tab "Dashboard" (Overview) — BELUM DIKERJAKAN

Sudah ada 4 kartu statistik tapi **masih dummy** (`-`): Jenis Barang, Stok
Menipis, Stok Opname Bulan Ini, Mutasi Hari Ini. Pola pengisian data asli
sudah ada contohnya di Bridging BPJS (`BridgingBpjs.tsx`, kartu "SEP Terbit
Hari Ini"/"Klaim Terkirim" — lihat `BRIDGING_ANTREAN_OTOMATIS.md` kalau
perlu referensi pola serupa) — sekarang tab Stok Opname (tabel `opname`)
DAN tab Mutasi (tabel `mutasibarang`) sudah ada data asli, tinggal buat
endpoint count sederhana untuk kartu "Stok Opname Bulan Ini" dan "Mutasi
Hari Ini".

### Tab "Pengaturan" — 13 sub-menu master data — SEMUA SELESAI

Dikerjakan **berurutan satu per satu** sesuai daftar dari user (bukan
sekaligus, supaya tiap tabel Khanza yang belum dikenal bisa dicek dulu
skemanya sebelum diimplementasikan). Semua 13 item sudah selesai:

1. **Pengaturan Depo — SELESAI** (lihat detail di bawah)
2. **Set Harga Obat — SELESAI** (lihat detail di bawah)
3. **Set Harga Obat Ralan — SELESAI** (lihat detail di bawah)
4. **Set Harga Obat Ranap — SELESAI** (lihat detail di bawah)
5. **Set Embalase dan Tuslah — SELESAI** (lihat detail di bawah)
6. **Industri Farmasi — SELESAI** (lihat detail di bawah)
7. **Suplier Obat/Alkes/BHP — SELESAI** (lihat detail di bawah)
8. **Satuan Barang — SELESAI** (lihat detail di bawah)
9. **Metode Racik — SELESAI** (lihat detail di bawah)
10. **Konversi Satuan — SELESAI** (lihat detail di bawah)
11. **Jenis Obat/Alkes/BHP — SELESAI** (lihat detail di bawah)
12. **Kategori Obat/Alkes/BHP — SELESAI** (lihat detail di bawah)
13. **Golongan Obat/Alkes/BHP — SELESAI** (lihat detail di bawah)

Shell-nya (`ApotekPengaturanView` di `ApotekPengaturan.tsx`) menampilkan
daftar ke-13 item ini sebagai sub-navigasi kiri di dalam tab Pengaturan
— semua sekarang `ready: true` di `SETTING_LIST`, jadi titik abu-abu
penanda "belum siap" sudah tidak muncul lagi di menu manapun.

#### Sub-fitur #1 — Pengaturan Depo (SELESAI)

Cocok dengan dialog Khanza Desktop **"Set Oto Lokasi"**
(`setting/DlgSetOtoLokasi.java`, dibuka dari tombol besar "Set Oto Lokasi"
di menu utama — bukan dari menu Apotek eksplisit, tapi secara fungsi ini
memang pengaturan depo/lokasi apotek). Dialog Java-nya punya 3 tab, ketiganya
diimplementasikan:

| Tab | Tabel Khanza | PK | Catatan |
|---|---|---|---|
| Pengaturan Lokasi | `set_lokasi` | `kd_bangsal` (tanpa constraint unik di DB, tapi Java **cuma izinkan 1 baris system-wide** — dicek row count sebelum insert) | `asal_stok` enum `'Gunakan Stok Utama Obat'` / `'Gunakan Stok Bangsal'`. "Edit" di Java = delete lalu insert ulang — ditiru di backend lewat `saveApotekLokasi` (transaksi: `DELETE FROM set_lokasi` lalu `INSERT`, jadi PUT selalu berlaku sebagai upsert). |
| Pengaturan Depo Ralan | `set_depo_ralan` | majemuk `(kd_poli, kd_bangsal)` | Satu poliklinik rawat jalan → satu depo obat. |
| Pengaturan Depo Ranap | `set_depo_ranap` | majemuk `(kd_bangsal, kd_depo)` | Satu bangsal/kamar rawat inap → satu depo obat. |

`kd_bangsal`/`kd_depo` di ketiga tabel di atas **sama-sama mengacu ke
tabel `bangsal`** (bukan tabel depo terpisah) — termasuk baris `"AP"`
(Apotek) dan `"GD"` (Gudang) yang di data dev dipakai sebagai depo.
`kd_poli` mengacu ke `poliklinik`. Ditemukan lewat `grep -rl
"set_depo_ralan\|set_depo_ranap"` di source Java Khanza
(`/Users/firdaus/khanzaibnusina/src/setting/DlgSetOtoLokasi.java`), bukan
tebakan skema.

Backend: `backend/apotek_pengaturan_depo_handler.go` — endpoint
`GET /api/apotek/pengaturan/depo/opsi` (daftar bangsal+poliklinik untuk
dropdown), lalu `GET/PUT/DELETE /api/apotek/pengaturan/lokasi` dan
`GET/POST/PUT/DELETE /api/apotek/pengaturan/depo-ralan` /
`depo-ranap` (query param `kd_poli`/`kd_bangsal`/`kd_depo` untuk DELETE,
body `{orig_..., ...}` untuk PUT karena PK majemuk). Diuji end-to-end
lewat `curl`: create → update → delete, ketiga tab.

Frontend: `frontend/src/modules/ApotekPengaturan.tsx` — form inline
(bukan modal) di atas tabel per tab, pola `PillSelect` yang sama
diduplikasi lagi dari `ApotekDataBarang.tsx`.

#### Sub-fitur #2 — Set Harga Obat (SELESAI)

Cocok dengan dialog Khanza Desktop **"Set Harga Obat"**
(`setting/DlgSetHarga.java`), 4 tab, semuanya diimplementasikan:

| Tab | Tabel Khanza | PK | Catatan |
|---|---|---|---|
| Pengaturan Harga | `set_harga_obat` | tanpa PK, cuma 1 baris (pola sama seperti `set_lokasi` — delete lalu insert ulang tiap simpan) | 3 kolom enum: `setharga` (`Umum`/`Per Jenis`/`Per Barang` — menentukan mode markup mana yang "berlaku"), `hargadasar` (`Harga Beli`/`Harga Diskon`), `ppn` (`Yes`/`No`). **Cuma metadata** — Java sendiri tidak pernah membaca 2 kolom terakhir di rumus apply manapun (kemungkinan dipakai modul pembelian/barang masuk yang beda), jadi kami simpan apa adanya tanpa mencoba mempengaruhi kalkulasi. |
| Harga Umum | `setpenjualanumum` | tanpa PK, 1 baris | 10 kolom persentase margin ("keuntungan") per tingkatan harga jual (ralan, kelas1/2/3, utama, vip, vvip, beliluar, jualbebas, karyawan). "Terapkan" = `UPDATE databarang` **tanpa WHERE** (seluruh barang). |
| Harga Per Jenis | `setpenjualan` | `kdjns` | Sama 10 kolom persentase, per jenis barang. "Terapkan" = `UPDATE databarang WHERE kdjns=...`. |
| Harga Per Barang | `setpenjualanperbarang` | `kode_brng` | Sama 10 kolom persentase, per barang spesifik. "Terapkan" = `UPDATE databarang WHERE kode_brng=...`. |

Rumus apply (disalin persis dari Java, `ppUPdateActionPerformed` dkk.):
`kolom_harga = ROUND(h_beli + (h_beli * (persen/100)))` — dihitung untuk
kesepuluh kolom harga jual `databarang` sekaligus (masing-masing pakai
persentasenya sendiri), selalu berbasis `h_beli` (harga beli), tidak
peduli setting `hargadasar`.

Backend: `backend/apotek_harga_obat_handler.go` — helper bersama
`hargaPct` (struct 10 kolom + `applyHargaSetClause` konstanta SQL dipakai
ulang di ketiga endpoint "terapkan"). Endpoint `GET/PUT
/api/apotek/harga-obat/pengaturan`, `GET/PUT /api/apotek/harga-obat/umum`
+ `POST .../umum/terapkan`, `GET/POST/DELETE
/api/apotek/harga-obat/per-jenis[/:kdjns]` + `POST .../:kdjns/terapkan`,
sama polanya untuk `per-barang[/:kode]`.

Frontend: `frontend/src/modules/ApotekHargaObat.tsx` — 4 sub-tab dengan
pola sama seperti `ApotekPengaturan.tsx` (form inline + tabel), plus
tombol "Terapkan" per baris (dan "Terapkan ke Semua Obat" di tab Umum)
yang selalu minta konfirmasi SweetAlert dulu karena langsung mengubah
harga jual sungguhan di `databarang` — tidak bisa dibatalkan. Tab Per
Barang punya pencarian obat live (debounce 300ms ke
`/api/apotek/barang/list`) karena katalognya besar (2000+ item), beda
dari Per Jenis yang cukup dropdown (jumlah jenis sedikit, sama seperti
dropdown referensi Data Barang).

Diuji end-to-end lewat `curl` di database dev: untuk ketiga scope
(Umum/Per Jenis/Per Barang) — ubah persentase, jalankan "terapkan",
verifikasi lewat `mysql` bahwa `databarang.ralan` benar-benar berubah
sesuai rumus (mis. h_beli 6050 × 1.3 → 7865), lalu **selalu dikembalikan
ke persentase asal (20%) dan di-apply ulang** supaya data harga dev tidak
tertinggal berubah dari sebelum pengujian.

#### Sub-fitur #3 — Set Harga Obat Ralan (SELESAI)

Cocok dengan dialog Khanza Desktop **"Set Harga Obat Ralan"**
(`setting/DlgSetHargaObatRalan.java`) — dialog kecil, cuma 1 tabel:

| Tabel | PK | Kolom |
|---|---|---|
| `set_harga_obat_ralan` | `kd_pj` (FK ke `penjab`) | `hargajual` (double, "% dari Harga Beli") |

**Beda scope** dari "Set Harga Obat" (sub-fitur #2 di atas, keyed
jenis/barang) — ini keyed per **cara bayar** (`penjab`: Umum, BPJS,
Asuransi, dll), khusus rawat jalan. Dua fitur ini independen satu sama
lain di Khanza (tidak saling menimpa).

**Beda penting dari pola CRUD lain di modul ini**: Java cuma punya tombol
**Simpan** (`INSERT`) dan **Hapus** (`DELETE ... WHERE kd_pj=...`) —
**TIDAK ada tombol Update**, dan **TIDAK ada mekanisme "Terapkan"** ke
`databarang` sama sekali (dicek lewat `grep` menyeluruh di file Java-nya,
cuma ada 1 query tulis: `INSERT`). Backend
(`backend/apotek_harga_obat_ralan_handler.go`) tetap menyediakan upsert
(delete lalu insert dalam 1 transaksi) di endpoint `POST` yang sama,
supaya user tidak perlu 2 langkah manual (hapus dulu baru simpan lagi)
untuk mengubah nilai `kd_pj` yang sudah ada — hasil akhir di database
identik dengan alur asli Java, cuma lebih ringkas dari sisi UI. Karena
tidak ada "Terapkan", nilai persentase di tabel ini kemungkinan dibaca
langsung saat proses billing/perhitungan harga obat rawat jalan
(bukan lewat bulk-update `databarang` seperti sub-fitur #2) — **belum
ditelusuri lebih lanjut modul mana yang membacanya** (di luar scope
"bangun settingnya dulu", sama seperti Pengaturan Depo yang awalnya juga
"menggantung" sebelum disambungkan ke fitur Resep).

Endpoint: `GET /api/apotek/harga-obat-ralan/penjab-opsi` (dropdown cara
bayar, baris `-` disaring), `GET /api/apotek/harga-obat-ralan` (list +
`search`, JOIN `penjab`), `POST` (upsert), `DELETE /:kdpj`.

Frontend: `frontend/src/modules/ApotekHargaObatRalan.tsx` — form inline +
tabel, pola sama seperti tab-tab lain di modul Pengaturan.

Diuji end-to-end lewat `curl`: create → upsert (ubah nilai kd_pj yang
sama) → search → delete, tabel kembali kosong seperti sebelum pengujian.

#### Sub-fitur #4 — Set Harga Obat Ranap (SELESAI)

Cocok dengan dialog Khanza Desktop **"Set Harga Obat Ranap"**
(`setting/DlgSetHargaObatRanap.java`) — pola identik dengan Set Harga
Obat Ralan (sub-fitur #3), bedanya PK **majemuk** karena ranap punya
persentase berbeda per kelas kamar:

| Tabel | PK | Kolom |
|---|---|---|
| `set_harga_obat_ranap` | `(kd_pj, kelas)` | `hargajual` (double, "% dari Harga Beli") |

`kelas` adalah `enum('Kelas 1','Kelas 2','Kelas 3','Kelas Utama','Kelas VIP','Kelas VVIP')`
— persis daftar dropdown "Kelas Kamar" di Java, disimpan sebagai
`kelasRanapOptions` di backend dan divalidasi (`isKelasRanapValid`)
sebelum insert. Sama seperti Ralan: Java cuma Simpan (insert) + Hapus,
tidak ada Update/Terapkan — backend tetap sediakan upsert (delete match
`kd_pj`+`kelas`, lalu insert) di endpoint `POST` yang sama supaya edit
tidak perlu 2 langkah manual.

Backend: `backend/apotek_harga_obat_ranap_handler.go`. Endpoint `GET
/api/apotek/harga-obat-ranap/kelas-opsi` (6 pilihan kelas tetap), `GET
/api/apotek/harga-obat-ranap` (list + `search`, JOIN `penjab`), `POST`
(upsert), `DELETE` (query param `kd_pj`+`kelas`, bukan path param,
karena PK majemuk). **Dropdown cara bayar dipakai ulang** dari endpoint
Ralan (`/api/apotek/harga-obat-ralan/penjab-opsi`) — sama sumber data,
tidak perlu endpoint terpisah.

Frontend: `frontend/src/modules/ApotekHargaObatRanap.tsx` — form inline +
tabel (kolom tambahan "Kelas Kamar" dibanding versi Ralan), pola sama.

Diuji end-to-end lewat `curl`: create 2 baris `kd_pj` sama dengan `kelas`
berbeda (memastikan PK majemuk bekerja, tidak saling menimpa) → upsert
salah satu (ubah nilai) → search → delete satu-satu by `kd_pj`+`kelas`,
tabel kembali kosong seperti sebelum pengujian.

#### Sub-fitur #5 — Set Embalase dan Tuslah (SELESAI)

Cocok dengan dialog Khanza Desktop **"Set Embalase & Tuslah"**
(`setting/DlgSetEmbalase.java`) — paling sederhana di antara semua
sub-fitur Pengaturan Apotek: 1 tabel, 1 baris system-wide, 2 kolom
**nominal Rupiah** (bukan persentase seperti Set Harga Obat):

| Tabel | PK | Kolom |
|---|---|---|
| `set_embalase` | tanpa PK, cuma 1 baris (pola sama seperti `set_lokasi`/`set_harga_obat`) | `embalase_per_obat` (biaya kemasan), `tuslah_per_obat` (biaya jasa racik) |

Sama seperti `set_lokasi`: Java cuma izinkan 1 baris system-wide (dicek
row count sebelum insert), "Edit" = delete lalu insert ulang — di
backend disatukan jadi satu endpoint `PUT` yang selalu upsert.

Backend: `backend/apotek_embalase_tuslah_handler.go` —
`GET/PUT/DELETE /api/apotek/embalase-tuslah`.

Frontend: `frontend/src/modules/ApotekEmbalaseTuslah.tsx` — form 2 input
nominal + tabel 1 baris (format Rupiah), pola sama seperti Pengaturan
Lokasi/Pengaturan Harga.

Diuji end-to-end lewat `curl`: GET (data dev asli 500/500) → PUT ubah
nilai → GET (berubah) → DELETE → GET (null) → **selalu dikembalikan ke
nilai asli (500/500)** di akhir supaya data dev tidak tertinggal berubah.

#### Sub-fitur #6 — Industri Farmasi (SELESAI)

Cocok dengan dialog Khanza Desktop **"Industri Farmasi"**
(`inventory/DlgIndustriFarmasi.java`) — CRUD master data pabrik/
distributor obat. Tabel yang sama persis dipakai sebagai referensi
dropdown "Industri / Pabrik" di Data Barang
(`apotek_barang_handler.go`), jadi menambah/mengedit di sini langsung
berefek ke pilihan dropdown itu.

| Tabel | PK | Kolom |
|---|---|---|
| `industrifarmasi` | `kode_industri` (manual, staf yang input, char(5)) | `nama_industri`, `alamat`, `kota`, `no_telp` |

Dua hal penting yang beda dari pola CRUD master lain di modul ini:

1. **Tidak ada kolom `status`** di tabel ini (beda dari `databarang`) —
   jadi tidak ada konsep nonaktifkan, cuma hapus beneran atau tidak sama
   sekali.
2. **Kode boleh diganti** lewat tombol "Ganti" di Java (`UPDATE
   industrifarmasi SET kode_industri=? WHERE kode_industri=?`) — beda
   dari Data Barang yang `kode_brng`-nya immutable setelah dibuat. Kami
   ikuti perilaku ini, tapi tambahkan **pengaman yang tidak ada di
   Jawa**: tolak ganti-kode/hapus kalau kode itu masih dipakai
   `databarang.kode_industri` (FK), supaya tidak meninggalkan referensi
   yatim — konsisten dengan pola pengaman `deleteDataBarang` yang sudah
   ada.

Baris `"-"` (placeholder FK "belum diisi", dipakai `fkOrDash()` di Data
Barang) disaring dari list/CRUD di sini karena bukan data industri
sungguhan.

Backend: `backend/apotek_industri_farmasi_handler.go` — `GET
/api/apotek/industri-farmasi` (list + `search` di kode/nama/alamat/kota/
no_telp), `POST` (create, cek kode belum dipakai), `PUT /:kode` (update,
termasuk ganti kode + guard FK), `DELETE /:kode` (guard FK).

Frontend: `frontend/src/modules/ApotekIndustriFarmasi.tsx` — pola
`default_card.md` standar (toolbar cari + tombol tambah, tabel, modal
tambah/edit sederhana) — tidak perlu gaya pill Khanza karena tidak ada
referensi tampilan spesifik untuk dialog ini.

Diuji end-to-end lewat `curl`: create → search → **update dengan ganti
kode** (sempat ketemu isu testing: kode baru "ITEST2" [6 karakter]
ke-*truncate* MySQL jadi "ITEST" karena kolomnya `char(5)` — bukan bug,
cuma testing salah pakai kode >5 karakter; diulang dengan kode 5 karakter
dan berhasil ganti) → **guard FK teruji**: percobaan hapus `I0001` yang
masih dipakai 5 baris `databarang` ditolak dengan pesan error yang jelas
→ delete baris test (tidak dipakai) berhasil, tabel bersih kembali.

#### Sub-fitur #7 — Suplier Obat/Alkes/BHP (SELESAI)

Cocok dengan dialog Khanza Desktop **"Supplier"**
(`inventory/InventorySuplier.java`) — CRUD master data pemasok obat/
alkes/BHP. Pola identik dengan Industri Farmasi (sub-fitur #6): kode
manual, boleh diganti lewat "Ganti", tidak ada kolom `status`.

| Tabel | PK | Kolom |
|---|---|---|
| `datasuplier` | `kode_suplier` (manual, char(5)) | `nama_suplier`, `alamat`, `kota`, `no_telp`, `nama_bank`, `rekening` |

Beda dari Industri Farmasi: **tidak ada baris `"-"` placeholder** (tabel
ini tidak dipakai sebagai referensi dropdown FK di Data Barang), tapi
**dipakai sebagai FK di `pembelian.kode_suplier`** (transaksi
pembelian/purchase order). Guard yang sama diterapkan: tolak ganti-kode
atau hapus kalau `kode_suplier` masih dipakai di `pembelian` — pengaman
tambahan yang tidak ada di Java, konsisten dengan pola
`apotek_industri_farmasi_handler.go`.

Backend: `backend/apotek_suplier_handler.go` — `GET /api/apotek/suplier`
(list + `search`), `POST` (create), `PUT /:kode` (update + ganti kode +
guard FK ke `pembelian`), `DELETE /:kode` (guard FK).

Frontend: `frontend/src/modules/ApotekSuplier.tsx` — pola
`default_card.md` standar, sama seperti Industri Farmasi tapi dengan 2
field tambahan (Nama Bank, No. Rekening).

Diuji end-to-end lewat `curl`: create → search → update dengan ganti
kode (berhasil) → guard FK teruji (percobaan hapus `S0001` yang dipakai
tabel `pembelian` ditolak) → delete baris test (tidak dipakai) berhasil,
tabel bersih kembali.

#### Sub-fitur #8 — Satuan Barang (SELESAI)

Cocok dengan dialog Khanza Desktop **"Satuan"** (`inventory/DlgSatuan.java`)
— CRUD paling sederhana di antara semua sub-fitur master data (cuma 2
kolom). Tabel yang sama dipakai referensi dropdown "Satuan Besar" **dan**
"Satuan Kecil" (dua kali, tabel yang sama) di Data Barang.

| Tabel | PK | Kolom |
|---|---|---|
| `kodesatuan` | `kode_sat` (manual, char(4)) | `satuan` |

Pola sama seperti Industri Farmasi/Suplier: tidak ada kolom `status`,
kode boleh diganti lewat "Ganti" (Java: `Valid.editTable` dengan
`satuan=?,kode_sat=?`), baris `"-"` placeholder disaring dari list/CRUD.
Guard tambahan (tidak ada di Java): tolak ganti-kode/hapus kalau kode
masih dipakai `databarang.kode_sat` **atau** `databarang.kode_satbesar`
(dua kolom FK berbeda yang sama-sama menunjuk tabel referensi ini).

Backend: `backend/apotek_satuan_barang_handler.go` — helper
`countSatuanUsage` mengecek kedua kolom FK sekaligus.

Frontend: `frontend/src/modules/ApotekSatuanBarang.tsx` — pola
`default_card.md` standar, form paling ringkas (cuma 2 field).

Diuji end-to-end lewat `curl`: create → search (baris `"-"` terbukti
tersaring) → rename → guard FK teruji (percobaan hapus `TAB` yang
dipakai 623 baris `databarang` ditolak) → delete baris test berhasil,
tabel bersih kembali.

#### Sub-fitur #9 — Metode Racik (SELESAI)

Cocok dengan dialog Khanza Desktop **"Metode Racik"**
(`inventory/DlgMetodeRacik.java`) — CRUD master metode racikan obat
(Puyer, Sirup, Salep, Kapsul, dll). Pola identik Satuan Barang: kode
manual boleh diganti, tidak ada kolom `status`, tidak ada baris `"-"`
placeholder (tabel ini tidak dipakai sebagai referensi dropdown FK di
Data Barang).

| Tabel | PK | Kolom |
|---|---|---|
| `metode_racik` | `kd_racik` (manual, varchar(3)) | `nm_racik` |

**Beda penting dari sub-fitur master lain**: tabel ini **sudah
dikonsumsi fitur Resep yang ada** (bukan orphaned seperti kebanyakan
sub-fitur Pengaturan lain sebelum disambungkan) — `resep_ranap_handler.go`
sudah `LEFT JOIN metode_racik` lewat `resep_dokter_racikan.kd_racik`
untuk menampilkan nama metode racik di riwayat resep racikan rawat inap,
dan `saveResepRanap` bahkan me-resolve `kd_racik` dari nama (mis.
"Puyer") kalau frontend mengirim nama alih-alih kode. Guard tambahan
(tidak ada di Java): tolak ganti-kode/hapus kalau `kd_racik` masih
dipakai `resep_dokter_racikan.kd_racik`, supaya riwayat resep racikan
yang sudah ada tidak kehilangan referensi.

Backend: `backend/apotek_metode_racik_handler.go`.

Frontend: `frontend/src/modules/ApotekMetodeRacik.tsx` — pola
`default_card.md` standar, form 2 field.

Diuji end-to-end lewat `curl`: create → search → rename → guard FK
teruji (percobaan hapus `R01` yang dipakai 21 baris
`resep_dokter_racikan` ditolak) → delete baris test berhasil, tabel
bersih kembali.

#### Sub-fitur #10 — Konversi Satuan (SELESAI)

Cocok dengan dialog Khanza Desktop **"Konversi"**
(`inventory/DlgKonversi.java`) — CRUD aturan konversi antar satuan
barang, mis. "10 Ampul = 1 Box".

| Tabel | PK | Kolom |
|---|---|---|
| `konver_sat` | majemuk `(nilai, kode_sat, nilai_konversi, sat_konversi)` | `kode_sat`/`sat_konversi` FK ke `kodesatuan` |

Sama seperti Set Harga Obat Ralan/Ranap: Java cuma **Simpan (insert) +
Hapus**, **tidak ada Update**. Hapus di Java match `kode_sat`+
`sat_konversi` saja (bukan 4 kolom PK penuh) — diikuti persis di
backend. Validasi Java: `kode_sat` tidak boleh sama dengan
`sat_konversi` (tidak bisa konversi ke satuan yang sama) — diikuti di
backend dan frontend. Backend tetap sediakan upsert (delete match
`kode_sat`+`sat_konversi`, lalu insert) di endpoint `POST` yang sama
supaya edit tidak perlu 2 langkah manual.

Backend: `backend/apotek_konversi_satuan_handler.go` — list di-JOIN ke
`kodesatuan` dua kali (untuk nama kedua satuan) meskipun query asli Java
tidak melakukan ini (cuma tampilkan kode mentah) — penambahan murni
kosmetik untuk keterbacaan, konsisten dengan pola CRUD lain di modul ini.

Frontend: `frontend/src/modules/ApotekKonversiSatuan.tsx` — form
"[nilai] [satuan] = [nilai] [satuan]" pakai dropdown `PillSelect` untuk
kedua satuan (reuse `/api/apotek/referensi`), tabel + Edit/Hapus.

Diuji end-to-end lewat `curl`: validasi satuan-sama ditolak → create →
search (nama satuan hasil JOIN benar) → upsert (ubah nilai pasangan yang
sama) → delete, tabel bersih kembali seperti sebelum pengujian.

#### Sub-fitur #11 — Jenis Obat/Alkes/BHP (SELESAI)

Cocok dengan dialog Khanza Desktop **"Jenis"** (`inventory/DlgJenis.java`)
— CRUD master jenis barang (Suntik, Tablet, Salep, dll). Tabel yang sama
dipakai referensi dropdown "Jenis" di Data Barang.

| Tabel | PK | Kolom |
|---|---|---|
| `jenis` | `kdjns` (manual, char(4)) | `nama`, `keterangan` |

Pola identik Industri Farmasi: tidak ada kolom `status`, kode boleh
diganti lewat "Ganti", baris `"-"` placeholder disaring dari list/CRUD.
Guard tambahan (tidak ada di Java): tolak ganti-kode/hapus kalau `kdjns`
masih dipakai `databarang.kdjns`.

Backend: `backend/apotek_jenis_handler.go`.

Frontend: `frontend/src/modules/ApotekJenis.tsx` — pola `default_card.md`
standar, form 3 field (Kode, Nama, Keterangan).

Diuji end-to-end lewat `curl`: create → search (baris `"-"` tersaring) →
rename → guard FK teruji (percobaan hapus `J001` yang dipakai
`databarang` ditolak) → delete baris test berhasil, tabel bersih
kembali.

#### Sub-fitur #12 — Kategori Obat/Alkes/BHP (SELESAI)

Cocok dengan dialog Khanza Desktop **"Kategori"**
(`inventory/DlgKategori.java`) — CRUD master kategori barang
(Formularium RS, Generik, Fornas, dll). Tabel yang sama dipakai
referensi dropdown "Kategori" di Data Barang.

| Tabel | PK | Kolom |
|---|---|---|
| `kategori_barang` | `kode` (manual, char(4)) | `nama` |

Pola identik Satuan Barang/Metode Racik (2 kolom, paling ringkas): tidak
ada kolom `status`, kode boleh diganti lewat "Ganti", baris `"-"`
placeholder disaring dari list/CRUD. Guard tambahan (tidak ada di Java):
tolak ganti-kode/hapus kalau `kode` masih dipakai
`databarang.kode_kategori`.

Backend: `backend/apotek_kategori_handler.go`.

Frontend: `frontend/src/modules/ApotekKategori.tsx` — pola
`default_card.md` standar, form 2 field.

Diuji end-to-end lewat `curl`: create → search (baris `"-"` tersaring) →
rename → guard FK teruji (percobaan hapus `K04` yang dipakai 5 baris
`databarang` ditolak) → delete baris test berhasil, tabel bersih
kembali.

#### Sub-fitur #13 — Golongan Obat/Alkes/BHP (SELESAI, item terakhir)

Cocok dengan dialog Khanza Desktop **"Golongan"**
(`inventory/DlgGolongan.java`) — CRUD master golongan barang
(Psikotropika, Narkotika, Obat Bebas, BHP, dll). Tabel yang sama dipakai
referensi dropdown "Golongan" di Data Barang.

| Tabel | PK | Kolom |
|---|---|---|
| `golongan_barang` | `kode` (manual, char(4)) | `nama` |

Pola identik Kategori/Satuan Barang/Metode Racik (2 kolom): tidak ada
kolom `status`, kode boleh diganti lewat "Ganti", baris `"-"`
placeholder disaring dari list/CRUD. Guard tambahan (tidak ada di Java):
tolak ganti-kode/hapus kalau `kode` masih dipakai
`databarang.kode_golongan`.

Backend: `backend/apotek_golongan_handler.go`.

Frontend: `frontend/src/modules/ApotekGolongan.tsx` — pola
`default_card.md` standar, form 2 field.

Diuji end-to-end lewat `curl`: create → search (baris `"-"` tersaring) →
rename → guard FK teruji (percobaan hapus `G07` yang dipakai 1 baris
`databarang` ditolak) → delete baris test berhasil, tabel bersih
kembali.

**Ini adalah item ke-13 (terakhir) dari daftar Pengaturan Apotek —
seluruh sub-menu Pengaturan sudah selesai diimplementasikan.**

#### Pengaturan Depo — dipakai (dikonsumsi) oleh fitur Resep

Awalnya ketiga tabel ini "menggantung" — dibuat tapi tidak ada fitur lain
yang membacanya. Sudah disambungkan ke input resep (`Pemeriksaan.tsx` /
`PemeriksaanRanap.tsx`, lewat `ResepModal.tsx`), yang sebelumnya **hardcode**
`kd_bangsal='AP'` (ralan, `resep_handler.go:35`) atau auto-pilih AP/GD
dengan stok terbanyak lewat `kdApotek()` (ranap, `resep_ranap_handler.go`,
sama sekali tidak peduli bangsal pasien sebenarnya).

Dua helper baru di `apotek_pengaturan_depo_handler.go`:
- `resolveDepoRalan(db, noRawat)` — `reg_periksa.kd_poli` (dari `no_rawat`)
  → `set_depo_ralan.kd_bangsal`. Dipakai `searchObat` (`resep_handler.go`)
  sebagai prioritas pertama sebelum fallback ke `"AP"`.
- `resolveDepoRanap(db, noRawat)` — bangsal/kamar aktif pasien
  (`kamar_inap.kd_kamar` → `kamar.kd_bangsal`, ambil baris `tgl_masuk`
  terbaru untuk menangani pindah kamar) → `set_depo_ranap.kd_depo`.
  Dipakai `kdApotek()` (`resep_ranap_handler.go`) sebagai prioritas
  pertama sebelum fallback ke logika lama (pilih AP/GD stok terbanyak).

Keduanya balik `""` kalau `no_rawat` kosong atau belum ada pengaturan —
fallback lama tetap jalan seperti sebelumnya, jadi kalau staf belum
sempat isi Pengaturan Depo, behavior persis seperti sebelum perubahan ini
(tidak ada regresi untuk RS yang belum pakai fitur ini).

Frontend `ResepModal.tsx` sekarang mengirim `no_rawat` di keempat
pemanggilan pencarian obat (`/api/obat/search` dan
`/api/resep-ranap/obat`, masing-masing dipanggil dari tab non-racikan dan
racikan). Prop `kdBangsal` yang sebelumnya dikirim `PemeriksaanRanap.tsx`
tapi **tidak pernah dipakai** di dalam `ResepModal.tsx` (dead code) sudah
dihapus — resolusi depo sekarang sepenuhnya di backend lewat `no_rawat`,
lebih bisa diandalkan daripada prop yang bisa saja basi.

Diuji end-to-end lewat `curl`: set mapping depo ralan (poli → GD) dan
depo ranap (bangsal → GD), bandingkan hasil `stok` sebelum/sesudah
mapping diset (angka stok beda, membuktikan JOIN memang pakai depo hasil
resolve) — lalu mapping test dihapus lagi.

## Referensi Kode Terkait

- `backend/apotek_barang_handler.go` — CRUD Data Barang + referensi.
- `backend/apotek_pengaturan_depo_handler.go` — CRUD Pengaturan Depo
  (Lokasi, Depo Ralan, Depo Ranap) + helper `resolveDepoRalan`/
  `resolveDepoRanap` yang dikonsumsi fitur Resep.
- `backend/apotek_harga_obat_handler.go` — CRUD Set Harga Obat
  (Pengaturan Harga, Harga Umum/Per Jenis/Per Barang) + rumus "terapkan".
- `backend/apotek_harga_obat_ralan_handler.go` — CRUD Set Harga Obat
  Ralan (persentase per cara bayar, khusus rawat jalan).
- `backend/apotek_harga_obat_ranap_handler.go` — CRUD Set Harga Obat
  Ranap (persentase per cara bayar x kelas kamar, khusus rawat inap).
- `backend/apotek_embalase_tuslah_handler.go` — CRUD Set Embalase dan
  Tuslah (nominal Rupiah, 1 baris system-wide).
- `backend/apotek_industri_farmasi_handler.go` — CRUD Industri Farmasi
  (juga dipakai referensi dropdown Data Barang), termasuk guard FK
  ganti-kode/hapus.
- `backend/apotek_suplier_handler.go` — CRUD Suplier Obat/Alkes/BHP,
  guard FK ke `pembelian.kode_suplier`.
- `backend/apotek_satuan_barang_handler.go` — CRUD Satuan Barang (juga
  dipakai referensi dropdown Data Barang), guard FK ke dua kolom
  `databarang.kode_sat`/`kode_satbesar`.
- `backend/apotek_metode_racik_handler.go` — CRUD Metode Racik, guard FK
  ke `resep_dokter_racikan.kd_racik` (sudah dikonsumsi fitur Resep Ranap
  yang ada).
- `backend/apotek_konversi_satuan_handler.go` — CRUD Konversi Satuan
  (PK majemuk 4 kolom, upsert via delete+insert seperti Set Harga Obat
  Ralan/Ranap).
- `backend/apotek_jenis_handler.go` — CRUD Jenis Obat/Alkes/BHP (juga
  dipakai referensi dropdown Data Barang), guard FK ke `databarang.kdjns`.
- `backend/apotek_kategori_handler.go` — CRUD Kategori Obat/Alkes/BHP
  (juga dipakai referensi dropdown Data Barang), guard FK ke
  `databarang.kode_kategori`.
- `backend/apotek_golongan_handler.go` — CRUD Golongan Obat/Alkes/BHP
  (juga dipakai referensi dropdown Data Barang), guard FK ke
  `databarang.kode_golongan`. Item terakhir dari 13 sub-menu Pengaturan.
- `backend/apotek_stok_opname_handler.go` — tab utama Stok Opname (input
  + riwayat), langsung mengoreksi `gudangbarang.stok`.
- `backend/resep_handler.go` (`searchObat`) & `backend/resep_ranap_handler.go`
  (`kdApotek`/`searchObatRanap`) — konsumen Pengaturan Depo saat mencari
  stok obat untuk resep.
- `frontend/src/components/ResepModal.tsx` — modal input resep (dipakai
  Pemeriksaan.tsx & PemeriksaanRanap.tsx), sekarang kirim `no_rawat` ke
  pencarian obat supaya depo ter-resolve di backend.
- `frontend/src/modules/Apotek.tsx` — shell sidebar+tab modul Apotek.
- `frontend/src/modules/ApotekDataBarang.tsx` — tab Data Barang.
- `frontend/src/modules/ApotekPengaturan.tsx` — tab Pengaturan (shell
  13 sub-menu + implementasi Pengaturan Depo).
- `frontend/src/modules/ApotekHargaObat.tsx` — implementasi Set Harga
  Obat (4 sub-tab), dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekHargaObatRalan.tsx` — implementasi Set
  Harga Obat Ralan, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekHargaObatRanap.tsx` — implementasi Set
  Harga Obat Ranap, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekEmbalaseTuslah.tsx` — implementasi Set
  Embalase dan Tuslah, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekIndustriFarmasi.tsx` — implementasi
  Industri Farmasi, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekSuplier.tsx` — implementasi Suplier
  Obat/Alkes/BHP, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekSatuanBarang.tsx` — implementasi Satuan
  Barang, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekMetodeRacik.tsx` — implementasi Metode
  Racik, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekKonversiSatuan.tsx` — implementasi
  Konversi Satuan, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekJenis.tsx` — implementasi Jenis
  Obat/Alkes/BHP, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekKategori.tsx` — implementasi Kategori
  Obat/Alkes/BHP, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekGolongan.tsx` — implementasi Golongan
  Obat/Alkes/BHP, dirender dari `ApotekPengaturan.tsx`.
- `frontend/src/modules/ApotekStokOpname.tsx` — tab utama Stok Opname
  (2 sub-tab: Input Opname, Riwayat Opname), dirender dari `Apotek.tsx`.
- `frontend/src/modules/App.tsx` — pemasangan `ApotekView` di menu
  sidebar "Farmasi" (`case 'farmasi'`).
- `frontend/src/modules/BpjsSep.tsx` — sumber pola `PillSelect`/dropdown
  bergaya Khanza yang diduplikasi ke `ApotekDataBarang.tsx` dan
  `ApotekPengaturan.tsx`.
- `default_card.md` (root proyek) — pola card/modal/tabel standar yang
  dipakai modal Data Barang.
- `/Users/firdaus/khanzaibnusina/src/setting/DlgSetOtoLokasi.java` —
  referensi Java dialog "Set Oto Lokasi" (sumber kebenaran Pengaturan
  Depo).
- `/Users/firdaus/khanzaibnusina/src/setting/DlgSetHarga.java` —
  referensi Java dialog "Set Harga Obat" (sumber kebenaran Set Harga
  Obat).
- `/Users/firdaus/khanzaibnusina/src/setting/DlgSetHargaObatRalan.java` —
  referensi Java dialog "Set Harga Obat Ralan" (sumber kebenaran Set
  Harga Obat Ralan).
- `/Users/firdaus/khanzaibnusina/src/setting/DlgSetHargaObatRanap.java` —
  referensi Java dialog "Set Harga Obat Ranap" (sumber kebenaran Set
  Harga Obat Ranap).
- `/Users/firdaus/khanzaibnusina/src/setting/DlgSetEmbalase.java` —
  referensi Java dialog "Set Embalase & Tuslah" (sumber kebenaran Set
  Embalase dan Tuslah).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgIndustriFarmasi.java` —
  referensi Java dialog "Industri Farmasi" (sumber kebenaran Industri
  Farmasi).
- `/Users/firdaus/khanzaibnusina/src/inventory/InventorySuplier.java` —
  referensi Java dialog "Supplier" (sumber kebenaran Suplier
  Obat/Alkes/BHP).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgSatuan.java` —
  referensi Java dialog "Satuan" (sumber kebenaran Satuan Barang).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgMetodeRacik.java` —
  referensi Java dialog "Metode Racik" (sumber kebenaran Metode Racik).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgKonversi.java` —
  referensi Java dialog "Konversi" (sumber kebenaran Konversi Satuan).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgJenis.java` —
  referensi Java dialog "Jenis" (sumber kebenaran Jenis Obat/Alkes/BHP).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgKategori.java` —
  referensi Java dialog "Kategori" (sumber kebenaran Kategori
  Obat/Alkes/BHP).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgGolongan.java` —
  referensi Java dialog "Golongan" (sumber kebenaran Golongan
  Obat/Alkes/BHP).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgInputStok.java` —
  referensi Java form input Stok Opname (sumber kebenaran rumus
  selisih/lebih/nomihilang/nomilebih & alur koreksi
  `gudangbarang.stok`).
- `/Users/firdaus/khanzaibnusina/src/inventory/DlgStokOpname.java` —
  referensi Java laporan riwayat Stok Opname (read-only, tidak ada
  Simpan).
