# Tanda Tangan Elektronik (Peruri) — Dokumentasi Alur & Pola Integrasi

Dokumen ini menjelaskan alur lengkap Tanda Tangan Elektronik (TTE) via Peruri
yang sudah dipakai di modul **Radiologi** (`ModalHasilRadiologi.tsx` +
`backend/peruri_handler.go`), ditulis sebagai **pola umum** supaya bisa
direplikasi ke modul lain yang juga butuh TTE + auto-upload berkas (mis. **Lab**,
dan modul lain di masa depan) — bukan dokumentasi khusus Radiologi saja.

Referensi asli: aplikasi desktop Khanza Java (`ApiPeruri.java`,
`JwtPeruri.java`, `QRCodePositionHelper.java`, dan handler2 seperti
`MnKirimDanTandaTanganActionPerformed`, `MnGeneratePDFActionPerformed`,
`MnDonwloadDokumenActionPerformed` di berbagai form Khanza).

---

## 1. Ringkasan Alur (End-to-End)

```
1. Generate PDF (pdf-lib, di frontend)
   └─ Sisipkan tag "#A#" di posisi TTD yg diinginkan (dinamis)
   └─ Hitung SIGN_BOX (lowerLeftX/Y, upperRightX/Y) dari posisi tag itu

2. Send Document  → POST /api/peruri/send-document-tmp
   └─ Upload PDF + SIGN_BOX + teraImage: "QR-DETECSI"
   └─ Dapat orderId

3. Cek sesi OTP tervalidasi (tracking_tte_session)
   ├─ Kalau MASIH AKTIF (< 24 jam & status='Aktif') → lompat ke langkah 5
   └─ Kalau TIDAK → lanjut langkah 4

4. Get OTP + Validate OTP
   └─ POST /api/peruri/get-otp     (kirim kode OTP ke email dokter)
   └─ [user input kode OTP di dialog]
   └─ POST /api/peruri/validate-otp (simpan sesi ke tracking_tte_session)

5. Signing         → POST /api/peruri/signing (orderId saja)

6. (Opsional) Download + auto-upload
   └─ POST /api/peruri/download-document (orderId + no_rawat)
   └─ Backend decode base64Document, tulis ke webapps/berkasrawat/pages/upload
```

Referensi implementasi lengkap: `frontend/src/components/ModalHasilRadiologi.tsx`
(fungsi `buildRadiologiPdfUntukTtd`, `handleTandaTangan`, `handleMintaOtpUlang`,
`handleDownloadDokumen`) dan `backend/peruri_handler.go`.

---

## 2. Posisi Koordinat TTD — Teknik Tag `#A#` (Dinamis)

**Masalah**: Peruri butuh 4 koordinat eksplisit (`lowerLeftX/Y`, `upperRightX/Y`)
untuk `signer`, bukan cuma "taruh di bawah kotak X". Khanza sendiri
(`QRCodePositionHelper.java`, pakai PDFBox) mendeteksi ini dengan cara:
generate PDF dulu (isi tag teks `#TTD#` atau custom spt `#A#`), lalu **scan
ulang** file PDF yang sudah jadi untuk cari posisi piksel tag itu, baru hitung
box di sekitarnya.

**Di ERMApp** kita generate PDF sendiri via `pdf-lib` (bukan lewat Jasper
Report terpisah seperti Khanza) — jadi **tidak perlu scan ulang**. Urutannya:

1. Tentukan `(tagX, tagY)` — posisi di mana tag akan digambar (bisa dinamis,
   mis. mengikuti tinggi kotak Hasil Pemeriksaan; bisa juga fixed).
2. Gambar teks `#A#` (kecil, abu-abu, penanda visual) tepat di `(tagX, tagY)`.
3. Hitung `SIGN_BOX` **LANGSUNG** dari `(tagX, tagY)` pakai formula PERSIS
   `QRCodePositionHelper.java`:

```ts
const QR_WIDTH = 40;   // radiologi pakai 40x40 (default Khanza 35x34, QR_WIDTH/QR_HEIGHT)
const QR_HEIGHT = 40;
const centeredX = tagX - QR_WIDTH / 2 + 5;   // offset +5 ke kanan, persis Java
const centeredY = tagY - QR_HEIGHT / 2;
const SIGN_BOX = {
  lowerLeftX: Math.trunc(centeredX),
  lowerLeftY: Math.trunc(centeredY),
  upperRightX: Math.trunc(centeredX) + QR_WIDTH,
  upperRightY: Math.trunc(centeredY) + QR_HEIGHT,
  page: '1',
};
```

### ⚠️ WAJIB: koordinat harus INTEGER

Ini **penyebab utama** error `[4012] Gagal melakukan proses penandatanganan`
yang berulang kali muncul saat development. `pageHeight` A4 di pdf-lib itu
`841.89` (bukan bilangan bulat), jadi variabel `y` (posisi vertikal berjalan)
selalu jadi desimal — kalau `SIGN_BOX` dihitung dari situ tanpa dibulatkan,
nilainya jadi desimal (mis. `87.5`) dan **dikirim ke Peruri sbg string
desimal**, yang ditolak diam-diam dengan error generik. Java
`QRCodePositionHelper.java` eksplisit `(int) centeredX` sebelum
`String.valueOf(...)` — **jangan lupakan ini** kalau bikin modul TTE baru.

### Kesalahan yang PERNAH terjadi (jangan diulang)

- **Urutan terbalik**: box dihitung duluan (independen), tag ditaruh di
  dalamnya — SALAH. Yang benar: tag dulu, box di-*center* dari situ.
- **Namespace API campuran dianggap masalah** — TERNYATA BUKAN. Lihat §4.
- **`teraImage: QR-DETECSI` dianggap penyebab error** — TERNYATA BUKAN
  (sudah dites dilepas, error `[4012]` tetap sama). Field ini aman dipakai
  terus, referensi Khanza (`ApiPeruri.java`) SELALU menyertakannya.

---

## 3. Field Wajib di Signer (Send Document)

```json
{
  "isVisualSign": "YES",
  "lowerLeftX": "...", "lowerLeftY": "...",
  "upperRightX": "...", "upperRightY": "...",
  "page": "1",
  "certificateLevel": "NOT_CERTIFIED",
  "varLocation": "Sigli",
  "varReason": "Signed",
  "teraImage": "QR-DETECSI"
}
```

`varLocation` isi nama kota RS (bukan hardcode "Jakarta" — itu bug lama yg
sudah diperbaiki). `teraImage: "QR-DETECSI"` mengganti visual stample TTE
Peruri jadi bentuk QR/barcode (bukan stample sertifikat biasa) — SELALU
disertakan, tidak perlu jadi opsional.

**TIDAK ADA langkah "Set Signature Position" terpisah** — posisi TTD sudah
cukup dikirim di payload `signer` pada Send Document itu sendiri. (Ada API
`setSignature` terpisah di namespace `digitalSignatureFullJwtSandbox`, tapi
TIDAK dipakai di alur session — referensi Khanza `MnKirimDanTandaTangan...`
tidak pernah memanggilnya.)

---

## 4. Namespace API — Jangan Diotak-atik Tanpa Bukti Baru

Endpoint yang TERBUKTI BERHASIL di production:

| Fungsi | Namespace | Config key (`peruri_konfigurasi`) |
|---|---|---|
| Send Document | `digitalSignatureSession` **atau** `digitalSignatureFullJwtSandbox` (keduanya terbukti jalan) | `SINGLE_SEND_DOCUMENT` |
| Session Initiate (Get OTP) | `digitalSignatureSession` | `SESSION_INITIATE` |
| Session Validation | `digitalSignatureSession` | `SESSION_VALIDATION` |
| Signing Session | `digitalSignatureSession` | `SESSION_SIGNING` |
| Download Document | `digitalSignatureSession` **atau** `digitalSignatureFullJwtSandbox` | `SINGLE_DOWNLOAD_DOCUMENT` |
| Check Certificate | `digitalSignatureSession` | `CERT_CHECK_BY_EMAIL` |

Host production: `apg.peruri.co.id:9055` (BUKAN sandbox `apgdev...19044`).
`SYSTEM_ID` production: `RSI-IBNUSINA-SIGLI` (kredensial lain di Pengaturan
Peruri, bukan disimpan di dokumen ini).

**Jangan asumsikan** "namespace harus seragam semua" tanpa error konkret yang
membuktikannya — riwayat debugging menunjukkan ini BUKAN sumber masalah,
padahal sempat dicurigai berkali-kali dan menghabiskan banyak waktu.

---

## 5. Header Authorization

**SEMUA** endpoint Digital Signature/Certificate (`sendDocument`,
`sessionInitiate`, `sessionValidation`, `signingSession`,
`downloadDocument`, `checkCertificate`) butuh `Authorization: Bearer <JWT>`
— **WALAUPUN** contoh curl dari dokumentasi Peruri menampilkan
`Authorization;` (kosong, placeholder Postman). Cuma endpoint **Generate
JWT itu sendiri** (`jwt/1.0/getJsonWebToken/v1`) yang TIDAK pakai
Authorization header. Ini dikonfirmasi via screenshot dokumentasi resmi
Peruri, bukan tebakan. Lihat `peruriBearerToken()`/`peruriCallAPI()` di
`peruri_handler.go`.

---

## 6. Cache Sesi OTP 24 Jam — Tabel `tracking_tte_session`

Supaya dokter TIDAK diminta OTP ulang setiap kali menandatangani dokumen
baru (selama masih dalam 24 jam), pakai tabel **legacy** (sudah ada dari
Khanza, kolom `email, token_session, tgl_session, status`, ditambah `id`
AUTO_INCREMENT PRIMARY KEY):

- **Setelah `validate-otp` sukses** → `INSERT` baris baru
  `(email, token_session, tgl_session=NOW(), status='Aktif')`. Sifatnya
  **append-only** (log), bukan upsert.
- **Sebelum minta OTP baru** (`GET /api/peruri/session-status?email=...`) →
  cari baris **TERBARU** (`ORDER BY id DESC LIMIT 1`) dgn `status='Aktif'`
  untuk email itu. Kalau `tgl_session` masih dalam jendela 24 jam
  (`trackingTteSessionWindow` di `peruri_handler.go`) → `valid: true`,
  frontend **lompat langsung ke Signing** tanpa dialog OTP.
- **Kalau sudah lewat 24 jam** → baris itu (dan sisanya untuk email itu)
  **DIHAPUS** saat dicek (bukan diubah jadi status `Expired`) — supaya
  tabel tidak menumpuk baris basi selamanya.
- **Saat `get-otp` dipanggil lagi** (baik pertama kali atau via tombol
  "Minta OTP Ulang") → baris `Aktif` LAMA utk email itu dihapus dulu,
  supaya tidak ada 2 baris `Aktif` nyangkut bareng.

⚠️ **Sesi "Aktif" di DB tidak menjamin sesi itu masih valid di sisi
Peruri** (Peruri bisa saja sudah expire lebih cepat dari yang kita
kira). Kalau `signingSession` gagal dan pesan errornya menyinggung
"otp"/"session"/"expired" (case-insensitive), JANGAN dianggap bug — ini
kasus wajar yang juga ditangani di kode Khanza (mereka menampilkan
"Masa berlaku OTP sudah habis, silakan klik dulu Kirim OTP"). Lihat blok
`try/catch` di `handleTandaTangan` yang mendeteksi pola ini dan
mengarahkan user klik tombol **"Minta OTP Ulang"**.

Channel pengiriman OTP: **email-only** (`sendSms:'0', sendWhatsapp:'0'`),
BUKAN ke 3 channel sekaligus — sesuai referensi Khanza.

---

## 7. Kode Error Resmi API Signing Peruri

`resultCode` **WAJIB** ditampilkan ke user (bukan cuma `resultDesc`, yg
kadang berupa placeholder rusak spt `%docSigningOutput/errorMessage%`).
Lihat `PERURI_SIGNING_ERROR_MAP` di `ModalHasilRadiologi.tsx`:

| Kode | Arti |
|---|---|
| `0` | Sukses |
| `01` | OTP tidak valid/gagal |
| `02` | Expired key |
| `03` | Dokumen sudah kadaluarsa / sudah pernah ditandatangani |
| `4001` | Sertifikat elektronik belum tersedia |
| `4003` | Worker Peruri belum tersedia |
| `4004` | Worker Peruri bermasalah |
| `4005` | Spesimen tanda tangan tidak ditemukan |
| `4006` | Gagal mengambil base64 spesimen |
| `4007` | Gagal menambahkan visibility penandatangan |
| `4008` | Gagal mengubah visibility penandatangan |
| `4009` | File tidak ditemukan |
| `4012` | Gagal melakukan proses penandatanganan (server Peruri) |
| `4014` | Koordinat penandatanganan tidak ditemukan |
| `4015` | Gagal generate Peruri Tera (stample) |
| `4017` | Gagal generate kode QR |
| `4026` | Gagal memvalidasi token dan OTP |
| `F` | Pre-sign/Signing Failed — cek parameter |

---

## 8. Download + Auto-Upload ke `berkasrawat`

Padanan `MnDonwloadDokumenActionPerformed` Khanza:

1. Ambil `orderId` dari signing terakhir (state `lastTteOrderId` di
   frontend — TIDAK disimpan permanen, cuma di sesi modal berjalan).
2. `POST /api/peruri/download-document` dengan `{ orderId, no_rawat }`.
3. Backend (`downloadPeruriDocument`) decode `response.data.base64Document`
   (field ini **terkonfirmasi** dari kode Java Khanza — bukan tebakan lagi),
   lalu tulis fisik ke `webapps/berkasrawat/pages/upload/<NamaFile>.pdf`
   lewat `WriteWebappsFile()` yang sudah ada (mekanisme sama dgn upload
   manual berkas rawat) — **TANPA** insert ke tabel `berkas_digital_perawatan`
   (sesuai kode Java aslinya, yang cuma taruh fisik file).
4. Nama file: `<Modul>_<no_rawat digantikan '_' utk '/'>_signed.pdf`
   (radiologi: `Radiologi_...`). **Ganti prefix ini per modul** kalau
   direplikasi ke Lab dll, supaya tidak tabrakan nama file.
5. `no_rawat` OPSIONAL di request — kalau kosong, endpoint cuma balikin
   base64-nya tanpa auto-upload (endpoint ini generik, dipakai lintas
   modul).

---

## 9. Cara Replikasi ke Modul Lain (mis. Lab)

Langkah untuk modul BARU yang butuh TTE:

1. **Generate PDF hasil** modul itu (pdf-lib), sisipkan tag `#A#` di posisi
   TTD yg diinginkan, hitung `SIGN_BOX` PERSIS pola §2 (jangan lupa
   `Math.trunc`).
2. Panggil endpoint Peruri yang **SUDAH GENERIK** (tidak perlu dibuat
   ulang per modul):
   - `POST /api/peruri/send-document-tmp` (multipart, terima file PDF +
     field posisi langsung — lihat `sendPeruriDocumentFromFile` di
     `peruri_handler.go`)
   - `POST /api/peruri/get-otp`, `/api/peruri/validate-otp`,
     `/api/peruri/signing`, `/api/peruri/download-document`,
     `GET /api/peruri/session-status`
   - Semua endpoint ini **TIDAK spesifik Radiologi** — bisa dipanggil
     langsung dari modul Lab dll tanpa endpoint baru.
3. Kalau butuh auto-upload ke `berkasrawat` dgn nama file berbeda, kirim
   `no_rawat` di body `download-document` — backend akan otomatis susun
   nama file `<PrefixModul>_<no_rawat>_signed.pdf`. **Kalau prefix perlu
   dibedakan per modul** (bukan selalu "Radiologi_"), update
   `downloadPeruriDocument` di `peruri_handler.go` supaya terima parameter
   prefix dari frontend (belum diimplementasikan — saat ini hardcode
   "Radiologi_", karena baru dipakai 1 modul; sesuaikan begitu modul kedua
   butuh prefix berbeda).
4. Reuse pola UI: `showOtpDialog`, `showProcessing`/`hideProcessing`,
   tombol "Minta OTP Ulang" (skip-OTP kalau sesi masih aktif), tombol
   Download overlay — semua di `ModalHasilRadiologi.tsx` bisa dijadikan
   referensi copy-paste utk modal modul lain.

---

## 10. Checklist Debugging Kalau TTE Gagal Lagi

1. **Cek kode error** (`[xxxx]`) — cocokkan ke tabel §7 dulu sebelum
   menebak-nebak.
2. **Cek apakah koordinat SIGN_BOX bilangan bulat** — kalau ada perubahan
   baru pada perhitungan posisi, pastikan `Math.trunc()`/`Math.round()`
   tetap dipakai di titik akhir sebelum dikirim sbg string.
3. **Cek apakah ini lewat jalur skip-OTP** (sesi direuse) atau OTP fresh —
   kalau errornya CUMA muncul pas skip-OTP, curigai §6 (sesi Peruri sudah
   expired duluan meski DB masih bilang `Aktif`), BUKAN soal koordinat.
4. **Jangan curigai namespace API dulu** — itu sudah terbukti BUKAN
   penyebab (§4), kecuali ada bukti baru yang konkret.
5. Kalau masih buntu, tempel `resultCode` + `resultDesc` PERSIS (jangan
   diringkas) dan bandingkan lagi ke kode Java Khanza yg relevan.
