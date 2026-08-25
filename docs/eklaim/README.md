# Referensi Integrasi E-Klaim (iDRG/INACBG)

File-file di folder ini adalah dokumen resmi Kemenkes yang jadi acuan
pengembangan Grouping INACBG (`frontend/src/modules/GroupingInacbg.tsx`,
`backend/eklaim_handler.go`).

- **`Manual Web Service 5.10.x(komplementer posman collection).pdf`** —
  manual resmi 81 halaman: skema enkripsi AES-256-CBC + HMAC-SHA256
  (bagian III), katalog 34 method web service (bagian IV), daftar kode
  error & ungroupable (V-VI), alur integrasi dasar (VII).
- **`DO 25 Kriteria Pengembangan Sistem IT Uji Coba iDRG.xlsx`** — checklist
  25 kriteria wajib yang mendefinisikan urutan alur kerja (state machine):
  **iDRG dulu, baru INACBG** (bukan sebaliknya) — lihat ringkasan alur di
  bawah.
- **`Code Systems INACBG.tsv`** (23rb baris) dan
  **`code_system_idrg_20260619.tsv`** (47rb baris) — tabel kode ICD-9-CM/
  ICD-10 resmi (kolom validcode/im/accpdx dipakai validasi coding), lebih
  lengkap/baru dari tabel `icd9`/`penyakit` bawaan Khanza. Belum di-import
  ke database — perlu keputusan terpisah kalau mau dipakai menggantikan/
  melengkapi tabel yang ada.
- **`E-KLAIM IDRG.postman_collection.txt`** — cuma berisi link ke workspace
  Postman publik (`https://www.postman.com/pusbikes/e-klaim/overview`),
  belum di-export jadi file collection asli.

## Ringkasan alur wajib (dari 25 Kriteria)

1. Input form pengajuan klaim → **Grouping iDRG** dulu (bukan INACBG).
2. Set Diagnosa/Prosedur iDRG → Grouping iDRG Stage 1 & 2.
3. Kalau valid (bukan ungroupable) → tombol **Final iDRG** muncul.
4. Final iDRG → form jadi read-only, tombol **Edit Ulang iDRG** muncul.
5. Setelah iDRG final → input **INACBG** baru muncul.
6. **Import Coding iDRG → INACBG** (tombol/fungsi import keseluruhan).
7. Set Diagnosa/Prosedur INACBG → Grouping INACBG Stage 1 & 2.
8. Kalau valid → tombol **Final INACBG** muncul → Final → Edit Ulang INACBG.
9. Setelah INACBG final → tombol **Final Klaim** muncul → Final Klaim.
10. Setelah Klaim final → tombol **Kirim Klaim** & **Cetak Klaim** muncul,
    tombol Edit Ulang iDRG/INACBG hilang.
11. SIMRS wajib simpan semua data yang terkirim ke & direspons oleh E-Klaim
    (audit trail, termasuk mapping billing RS ke billing group E-Klaim).

## Status implementasi

- ✅ Modul enkripsi (`eklaimEncrypt`/`eklaimDecrypt`) — teruji round-trip.
- ✅ `eklaimRequest()` helper (bangun payload → encrypt → POST → strip
  wrapper → decrypt respons).
- ✅ Kredensial (URL + Encryption Key) via Admin.tsx > Pengaturan Bridging
  (kode `eklaim`), sama pola dgn BPJS VClaim dkk.
- ✅ **Semua 34 method** sudah ada endpoint-nya di
  `backend/eklaim_handler.go` (lihat tabel route di bawah). Sebagian besar
  lewat `eklaimProxy()` generik (passthrough `{no_rawat, ...data}`),
  Grouping (iDRG #9-10 & INACBG #16-17) lewat `postEklaimGrouping()`
  khusus krn `stage`/`grouper` di metadata bukan data.
- ✅ **State machine tab Grouping** (`GroupingFormView` di
  `frontend/src/modules/GroupingInacbg.tsx`) — mengikuti urutan wajib 25
  kriteria: Buat Klaim Baru → Data Klaim (tarif) → Grouping iDRG → Final
  iDRG → Import ke INACBG → Grouping INACBG → Final INACBG → Final Klaim
  → Kirim/Cetak. Tombol tiap tahap cuma muncul kalau tahap sebelumnya
  sudah selesai, sesuai kriteria #7-24.
- ✅ **Terverifikasi live ke server E-Klaim produksi** (`192.168.1.10`,
  2026-08-25): `new_claim`, `generate_claim_number`, `get_claim_data` —
  pipeline enkripsi/request/respons terbukti benar end-to-end.
- ⚠️ **Method lain (termasuk `send_claim_individual`/"Kirim Klaim")
  belum pernah dites sungguhan** — sengaja tidak dicoba asal-asalan krn
  efeknya nyata (kirim klaim betulan ke data center BPJS/Kemenkes, bukan
  operasi baca yg aman diulang). Jalur teknisnya sama persis dgn method
  yg sudah terverifikasi (`eklaimProxy` generik), jadi kemungkinan besar
  jalan, tapi belum ada bukti langsung.
- ✅ State (`stage`) di `GroupingFormView` disinkron dari `get_claim_data`
  (method #24) tiap halaman dibuka — kalau klaim utk SEP itu sudah pernah
  dibuat sebelumnya, form otomatis lompat ke tahap yang sesuai (idrg_input/
  idrg_grouped/idrg_final/inacbg_grouped/inacbg_final/klaim_final) dan
  isi ulang diagnosa/prosedur/hasil grouping/tarif dari respons server.
  "Buat Klaim Baru" juga sudah toleran kalau E-Klaim membalas "Duplikasi
  nomor SEP" (klaim memang sudah ada) — dianggap sukses, bukan error.
  ⚠️ Deteksi `klaim_status_cd === 'final'` untuk tahap `klaim_final` masih
  tebakan berdasar pola `status_cd` di iDRG/INACBG grouper (manual resmi
  tidak kasih contoh respons `get_claim_data` utk klaim yang sudah final)
  — perlu diverifikasi begitu ada klaim yang benar-benar difinalisasi.
  **Dikonfirmasi dari server produksi nyata (2026-08-25)**: `grouper.
  response_idrg` SELALU ada sbg object placeholder (`status_cd:"normal"`,
  `total_cost_weight:"0"`, tanpa `drg_code`) walau grouping belum pernah
  dijalankan — beda dari contoh di manual. Deteksi "sudah di-grouping"
  jadi dipakai kemunculan `drg_code`/`cbg.code`, bukan sekadar objeknya
  ada.
- ⏳ Import tabel kode ICD dari 2 file tsv (lokal, autocomplete pencarian
  diagnosa/prosedur) — belum diputuskan/dibangun. Saat ini staf isi kode
  diagnosa/prosedur iDRG & INACBG manual (dipisah tanda `#`), belum ada
  UI pencarian pakai method #28-31.
- ⏳ Field opsional method #4 (ventilator, apgar, persalinan/delivery,
  dializer_single_use, alteplase_ind, kantong_darah, bayi_lahir_status_cd)
  belum ada UI-nya — endpoint backend menerima passthrough apa saja lewat
  `eklaimProxy`, tapi `GroupingFormView` baru kirim field inti.

## Daftar route backend (34 method)

| # | Method resmi | Route |
|---|---|---|
| 1 | new_claim | `POST /api/bridging/eklaim/new-claim` |
| 4 | set_claim_data | `POST /api/bridging/eklaim/update-klaim` |
| 5-6 | idrg_diagnosa_set/get | `.../idrg/diagnosa/set`, `/get` |
| 7-8 | idrg_procedure_set / inacbg_procedure_get* | `.../idrg/prosedur/set`, `/get` |
| 9-10 | grouper (idrg) | `.../idrg/grouping` |
| 11-12 | idrg_grouper_final/reedit | `.../idrg/final`, `/reedit` |
| 13 | idrg_to_inacbg_import | `.../idrg/import-to-inacbg` |
| 14-15 | inacbg_diagnosa_set / inacbg_procedure_set | `.../inacbg/diagnosa/set`, `/prosedur/set` |
| 16-17 | grouper (inacbg) | `.../inacbg/grouping` |
| 18-19 | inacbg_grouper_final/reedit | `.../inacbg/final`, `/reedit` |
| 20-21 | claim_final / reedit_claim | `.../klaim/final`, `/reedit` |
| 22-23 | send_claim / send_claim_individual | `.../klaim/kirim-kolektif`, `/kirim-individual` |
| 24-25 | get_claim_data / get_claim_status | `.../klaim/detail`, `/status` |
| 26-27 | delete_claim / claim_print | `.../klaim/hapus`, `/cetak` |
| 28-29 | search_diagnosis_inagrouper / search_procedures_inagrouper | `.../cari/diagnosa-idrg`, `/prosedur-idrg` |
| 30-31 | search_diagnosis / search_procedures | `.../cari/diagnosa-inacbg`, `/prosedur-inacbg` |
| 32 | generate_claim_number | `.../generate-nomor-klaim` |
| 33-34 | sitb_validate / sitb_invalidate | `.../sitb/validasi`, `/batal` |

\* Method #8 "Get Prosedur iDRG" — manual resmi menuliskan nama method
`inacbg_procedure_get` (bukan `idrg_procedure_get`) baik di request
maupun response contohnya. Kemungkinan salah ketik di dokumen asli,
ditranskripsi apa adanya — perlu diverifikasi ke server nyata.
