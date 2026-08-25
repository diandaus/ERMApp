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
- ✅ Method #1 "Membuat klaim baru" (`POST /api/bridging/eklaim/new-claim`).
- ✅ Kredensial (URL + Encryption Key) via Admin.tsx > Pengaturan Bridging
  (kode `eklaim`), sama pola dgn BPJS VClaim dkk.
- ⏳ 33 method lainnya (Set/Get Diagnosa Prosedur iDRG & INACBG, Grouping
  Stage 1/2, Finalisasi, Import iDRG→INACBG, Kirim/Cetak Klaim, dst) —
  belum dibangun.
- ⏳ State machine tab Grouping (urutan tombol Final/Edit Ulang sesuai 25
  kriteria di atas) — tab yang ada sekarang masih form ringkasan statis,
  belum ikuti alur ini.
- ⏳ Import tabel kode ICD dari 2 file tsv — belum diputuskan.
