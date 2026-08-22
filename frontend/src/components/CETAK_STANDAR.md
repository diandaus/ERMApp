# Standar Ukuran & Pola Form Cetak

Dokumen referensi untuk fitur cetak (hasil pemeriksaan, resep, kwitansi, dll)
di ERMApp. Konvensi di sini diambil dari `ModalHasilRadiologi.tsx`
(`handleCetak`) — cetak Hasil Pemeriksaan Radiologi — hasil dari iterasi
berkali-kali menyamakan tampilan dengan cetakan Khanza (Java). Tujuannya
supaya fitur cetak berikutnya (resep, kwitansi, surat rujukan, dsb) konsisten
tanpa perlu meraba-raba ukuran dari nol.

Implementasi rujukan: `frontend/src/components/ModalHasilRadiologi.tsx` fungsi
`handleCetak`. Backend rujukan: `backend/radiologi_hasil_handler.go` fungsi
`getCetakHasilRadiologi`.

## 1. Mekanisme cetak

Pola baku di codebase ini (dipakai juga di `DetailPemberianObat.tsx`,
`PreviewBilling.tsx`, dan modul-modul Apotek lain):

```js
const printWindow = window.open('', '_blank', 'width=900,height=1000');
printWindow.document.write(htmlString);
printWindow.document.close();
printWindow.focus();
printWindow.onload = () => printWindow.print();
```

- **Bukan** generate PDF sisi server — tidak ada library PDF di project ini.
  User cetak fisik atau pilih "Simpan sebagai PDF" dari dialog print browser.
- **Bukan** QZ Tray — QZ Tray dikhususkan untuk cetak label/etiket berulang
  (etiket obat) yang butuh cetak diam-diam tanpa dialog. Form dokumen (hasil
  periksa, resep, dsb) selalu lewat `window.print()`.
- Data diambil lewat `fetch` ke endpoint backend yang menyusun HTML string
  di frontend, bukan backend mengembalikan HTML jadi.

## 2. Sumber data kop surat

`GET /api/admin/settings` (tabel `setting_simrs_web`) → field yang dipakai:
`nama_instansi`, `alamat`, `logo_url`, `kota_rs`, `kontak`, `email_rs`.

```js
const logoSrc = settings.logo_url
  ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
  : '';
```

Urutan alamat: alamat dulu, baris berikutnya kontak+email (email digabung ke
baris kontak, bukan baris terpisah sendiri).

## 3. Font

```css
body { font-family: Tahoma, Arial, sans-serif; font-size: 11pt; color: #000; }
```

- Font utama **Tahoma**, fallback Arial/sans-serif. Tahoma dipakai karena
  cetakan Khanza (aplikasi Java lama, jalan di Windows) pakai Tahoma — biar
  mirip. **Catatan**: Tahoma adalah font bawaan Windows/MS Office, tidak
  tersedia default di macOS. Hasil render di Mac (preview browser) bisa
  beda dengan hasil cetak sebenarnya di server/PC Windows — ini bukan bug,
  cukup diverifikasi langsung di mesin Windows kalau ragu.
- **Ukuran (setara point Microsoft Word, BUKAN `<font size="N">` HTML
  legacy)** — selalu pakai CSS `font-size: Xpt`, jangan atribut `<font
  size>` (skala relatif browser, tidak sama dengan pt):

  | Elemen | Ukuran |
  |---|---|
  | Nama instansi (`.rs-nama`) | 14pt |
  | Alamat/kontak/email instansi (`.rs-alamat`) | 9pt |
  | Judul dokumen (`.judul`) | 12pt |
  | Isi body / tabel info / kotak hasil / blok ttd | 11pt |

- **Tidak ada bold, tidak ada underline** di mana pun pada form cetak ini —
  termasuk label field, nama Penanggung Jawab/Petugas di blok tanda tangan,
  dan label "Hasil Pemeriksaan :". Sudah eksplisit dihapus semua per
  permintaan user; jangan tambahkan lagi di form cetak baru kecuali diminta.

## 4. Margin halaman (kertas ke tulisan pertama)

```css
@page { margin-top: 14px; }
body { padding: 0 16px 16px; }
```

⚠️ **Jangan atur margin kertas lewat `padding` di `<body>`** — percobaan
awal (`body { padding-top: ... }`) ternyata "tidak terasa" bedanya, karena
dialog print Chrome (opsi Margin = "Default") sudah menerapkan margin
bawaan browser sendiri (~0.4"–1", jauh lebih besar dari beberapa px
`padding`), dan `padding` `<body>` cuma menambah jarak DI DALAM area itu —
bukan mengubah margin kertas fisiknya. Yang betul-betul mengatur jarak
kertas ↔ konten adalah rule `@page { margin: ... }` di `<style>` — dibaca
Chrome sebagai margin kertas fisik saat opsi Margin di dialog print =
"Default".

⚠️ **Jangan pakai shorthand `@page { margin: Xpx; }` kalau cuma mau ubah
satu sisi.** Shorthand ini langsung menimpa margin bawaan browser di
**keempat sisi sekaligus** — kiri/kanan/bawah yang tadinya ikut default
browser (bukan nilai kecil seperti 16px) jadi ikut berubah tanpa diminta.
Kalau cuma mau ubah satu sisi, set property spesifiknya saja
(`margin-top`, `margin-right`, dst) — sisi lain yang tidak disebut tetap
memakai default browser, tidak ikut ke-reset.

Konvensi form Radiologi saat ini (kombinasi `@page` untuk atas +
`padding` body untuk sisi lain, supaya kiri/kanan/bawah tidak ikut
berubah dari kebiasaan lama):

- **Atas: 14px** — murni dari `@page { margin-top: 14px; }` (tidak pakai
  `padding-top` di body lagi, karena itu sudah dibuktikan tidak
  berpengaruh terhadap margin kertas asli).
- **Kiri/kanan/bawah**: tetap seperti semula — `body { padding: 0 16px
  16px; }` (16px kiri+kanan+bawah) di ATAS margin default browser yang
  tidak disentuh oleh `@page` untuk sisi-sisi ini.

## 5. Kop surat (logo + nama + alamat instansi)

```html
<table width="100%" align="center" border="0" class="tbl_form" cellspacing="0" cellpadding="0">
  <tr>
    <td width="15%">${logoSrc ? `<img width="65" height="65" src="${logoSrc}" />` : ''}</td>
    <td width="70%">
      <center>
        <div class="rs-nama">${settings.nama_instansi}</div>
        <div class="rs-alamat">${settings.alamat}${kontakEmail ? `<br/>${kontakEmail}` : ''}</div>
      </center>
    </td>
    <td width="15%"></td>
  </tr>
</table>
<hr/>
<center><div class="judul">JUDUL DOKUMEN</div></center>
```

- Rasio kolom kop: **15% / 70% / 15%** (logo / nama+alamat / kosong,
  simetris biar teks tetap center terhadap halaman).
- Logo **65×65px**.
- `<hr/>` polos (`border-top: 1px solid #000`) sebagai pembatas kop dan judul.

## 6. Tabel info (data pasien/transaksi) — `table-layout: fixed` + `<colgroup>`

Dipakai supaya lebar kolom presisi dan konsisten di semua baris, tidak
auto-sizing mengikuti isi (yang bikin baris satu ke baris lain lebar
kolomnya beda-beda).

```css
table.info { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 10px; font-size: 11pt; }
table.info td { padding: 2px 4px; vertical-align: top; }
table.info td.label { white-space: nowrap; }
table.info td.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
table.info td.nowrap { white-space: nowrap; }
```

Struktur baris: 2 kolom info berdampingan, masing-masing `label / : / value`
(6 `<td>` per baris):

```html
<table class="info">
  <colgroup>
    <col style="width:14%"><col style="width:2%"><col style="width:36%">
    <col style="width:20%"><col style="width:2%"><col style="width:26%">
  </colgroup>
  <tr>
    <td class="label">Label Kiri</td><td class="sep">:</td><td>Value</td>
    <td class="label">Label Kanan</td><td class="sep">:</td><td class="nowrap">Value</td>
  </tr>
  ...
</table>
```

- **Rasio kolom kiri:kanan default = 52:48** (14%+2%+36% vs 20%+2%+26%).
  Ini hasil akhir setelah iterasi 50:50 → 55:45 → 52:48 — pakai ini sebagai
  titik awal, geser hanya kalau label di dokumen baru jelas lebih
  panjang/pendek dari radiologi.
- Lebar tiap kolom label ditentukan **manual per panjang teks label
  terpanjang di kolom itu**, bukan otomatis. Kalau ganti label, cek dulu
  label mana yang paling panjang di kolom tsb dan sesuaikan `%`-nya.
- Baris terakhir yang isinya panjang (mis. field "Pemeriksaan"/"Keterangan")
  pakai `colspan="4"` supaya melebar penuh ke kolom kanan.

### Kapan pakai `.truncate` vs `.nowrap`

- **`.truncate`** (ellipsis `...`) — untuk field yang **boleh** dipotong
  kalau kepanjangan (mis. Alamat). Wajib pasang `title="..."` di `<td>`
  yang sama supaya isi lengkap kelihatan saat hover/tooltip. **Penting**:
  `max-width: 0` WAJIB ada di CSS-nya — tanpa ini, `text-overflow: ellipsis`
  di dalam sel tabel `table-layout:fixed` diam-diam tidak berfungsi.
- **`.nowrap`** (tanpa `overflow:hidden`) — untuk field yang **tidak boleh**
  terpotong maupun turun baris, dan lebih baik melebihi margin kolom
  daripada kehilangan teks (mis. nama Penanggung Jawab / Dokter Pengirim).
  Teks akan tumpang tindih visual ke kolom sebelahnya kalau kepanjangan,
  tapi tidak pernah hilang/wrap.

### ⚠️ Yang JANGAN dicoba: shrink-to-fit label dengan `width:1%`

Trik CSS umum "gabung label+titik dua jadi satu sel, `width:1%;
white-space:nowrap`" untuk auto-shrink kolom label **TIDAK bekerja** di
sini — sudah dicoba dan hasilnya teks label & value tumpang tindih/rusak
(karena ada `<colgroup>` eksplisit yang sudah mengunci lebar kolom lain).
Kalau butuh label lebih rapat ke titik dua, cukup **kecilkan persentase
lebar kolom label** secara manual di `<colgroup>`, jangan pakai trik
shrink-to-fit otomatis di struktur tabel yang sudah punya `<colgroup>`.

## 7. Kotak hasil / isi bebas panjang

```css
.hasil-box { border: 1px solid #333; border-radius: 4px; padding: 10px; min-height: 100px; margin-top: 6px; font-size: 11pt; line-height: 1.6; }
```

Border radius **4px** untuk kotak-kotak konten (bukan 2px — sempat dicoba
2px lalu diubah ke 4px per permintaan user).

Isi multi-baris di-split per `\n` lalu tiap baris jadi `<div>` sendiri
(baris kosong pakai `&nbsp;` supaya tetap kelihatan tinggi barisnya):

```js
const html = (data.isi || '-').split('\n').map(line => `<div>${line || '&nbsp;'}</div>`).join('');
```

## 8. Blok tanda tangan (QR code + nama)

```css
.ttd { width: 45%; text-align: center; font-size: 11pt; }
```

```html
<table width="100%" style="margin-top:24px;">
  <tr>
    <td></td>
    <td class="ttd">Tgl.Cetak : ${tanggalCetak}</td>
  </tr>
  <tr>
    <td class="ttd">
      <div>Label Jabatan Kiri</div>
      ${qr ? `<img src="${qr}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
      <div>${nama || '-'}</div>
    </td>
    <td class="ttd">
      <div>Label Jabatan Kanan</div>
      ${qr2 ? `<img src="${qr2}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
      <div>${nama2 || '-'}</div>
    </td>
  </tr>
</table>
```

- `.ttd` lebar **45%** per kolom (menyisakan gap tengah).
- "Tgl.Cetak" jadi **baris tabel terpisah** di atas blok ttd, sejajar
  (center) dengan kolom ttd kanan — bukan digabung ke dalam salah satu sel
  ttd.
- QR code ditampilkan **65×65px**, tapi di-generate 80px (lihat §9) — beri
  fallback `<div style="height:65px;"></div>` kalau QR gagal dibuat, supaya
  layout tidak "loncat" naik.
- Kalau QR/foto tidak ada, tetap render placeholder kosong setinggi ukuran
  aslinya (jangan `display:none` — bikin baris nama ikut naik dan tidak
  sejajar dengan kolom sebelahnya).

## 9. QR code tanda tangan elektronik

Pakai package `qrcode` (npm, sudah ada di `frontend/package.json`) — full
client-side, tanpa network call:

```js
import QRCode from 'qrcode';

const finger =
  `Dikeluarkan di ${settings.nama_instansi}, Kabupaten/Kota ${settings.kota_rs}\n` +
  `Ditandatangani secara elektronik oleh ${nama}\n` +
  `ID ${idPegawai}\n${tanggalCetak}`;

const qr = await QRCode.toDataURL(finger, { width: 80, margin: 1 });
```

- Generate di **80px**, tampilkan di **65px** (lihat §8).
- Bungkus dengan `try/catch` — kalau QR gagal generate, tetap lanjut cetak
  tanpa QR (jangan sampai gagal generate QR menggagalkan seluruh cetak).
- Format teks payload QR selalu 4 baris seperti di atas: instansi+kota,
  nama penandatangan, ID pegawai, tanggal+jam cetak.

## 10. Tanggal & jam cetak

```js
const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
```

Format: `DD-MM-YYYY HH:mm:ss`, locale `id-ID`.

## 11. Kolom `DATE` dari backend — hindari bug `parseTime`

Kalau endpoint backend men-scan kolom `DATE`/`DATETIME` MySQL langsung ke
Go `string` tanpa dibungkus fungsi SQL, nilainya akan keluar sebagai
timestamp RFC3339 (`2026-03-12T00:00:00+07:00`) alih-alih tanggal polos
(`12-03-2026`) — karena DSN pakai `parseTime=true` dan driver otomatis
mengonversi kolom `DATE` mentah ke `time.Time`. Sudah kejadian berkali-kali
di handler radiologi. **Selalu** bungkus kolom tanggal di query SQL:

```sql
DATE_FORMAT(tgl_periksa, '%Y-%m-%d') AS tgl_periksa
```

Fungsi/ekspresi SQL melewati auto-parsing driver, jadi hasilnya tetap
string biasa.

## 12. Ringkasan cepat (checklist form cetak baru)

- [ ] `window.open` + `document.write` + `printWindow.onload = () =>
      printWindow.print()` — bukan PDF library, bukan QZ Tray.
- [ ] Kop: logo 65×65, rasio 15/70/15, nama instansi 14pt, alamat 9pt.
- [ ] Judul dokumen 12pt, center, di bawah `<hr/>`.
- [ ] Body/tabel/kotak isi 11pt, font Tahoma/Arial/sans-serif, **tanpa
      bold, tanpa underline**.
- [ ] Tabel info: `table-layout:fixed` + `<colgroup>` persentase manual,
      mulai dari rasio 52:48 kiri:kanan, sesuaikan `%` label per panjang
      teks. Field yang boleh terpotong → `.truncate` (+ `max-width:0` +
      `title=`); field yang harus tetap sebaris → `.nowrap`. **Jangan**
      pakai trik shrink-to-fit `width:1%` di tabel yang sudah punya
      `<colgroup>`.
- [ ] Kotak konten: `border-radius: 4px`.
- [ ] Blok ttd: kolom 45% lebar, QR 65×65 (generate di 80px via `qrcode`
      npm package, bungkus `try/catch`), placeholder kosong setinggi QR
      kalau tidak ada foto/QR.
- [ ] Semua kolom `DATE`/`DATETIME` dari SQL dibungkus `DATE_FORMAT(...)`.
- [ ] Data kop surat dari `GET /api/admin/settings`.
