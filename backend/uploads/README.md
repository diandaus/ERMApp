# Folder Upload Gambar

Folder ini digunakan untuk menyimpan gambar yang ditampilkan di aplikasi ERMApp.

## Struktur Folder

```
uploads/
└── images/
    ├── asuhan-medis-igd/    # Gambar untuk Asuhan Medis IGD
    ├── radiologi/            # Gambar untuk Pemeriksaan Radiologi
    └── labpa/                # Gambar untuk Pemeriksaan Lab PA (Patologi Anatomi)
```

## Cara Menggunakan

### 1. Gambar Asuhan Medis IGD

**Lokasi folder:**
```
backend/uploads/images/asuhan-medis-igd/
```

**Cara akses di frontend:**
- URL: `/asuhan-medis-igd/nama-file.jpg`
- Contoh: `/asuhan-medis-igd/gambar-lokalis-001.jpg`

**Cara menyimpan:**
1. Simpan file gambar ke folder `backend/uploads/images/asuhan-medis-igd/`
2. Gunakan nama file yang unik (misalnya: `no_rawat-tanggal-deskripsi.jpg`)
3. Format yang didukung: JPG, PNG, GIF, WebP

**Contoh:**
```bash
# Simpan gambar ke folder
cp gambar-lokalis.jpg backend/uploads/images/asuhan-medis-igd/2025-11-29-001-lokalis.jpg
```

### 2. Gambar Radiologi

**Lokasi folder:**
```
backend/uploads/images/radiologi/
```

**Cara akses di frontend:**
- URL: `/radiologi/nama-file.jpg`
- Contoh: `/radiologi/thorax-pa-001.jpg`

**Cara menyimpan:**
1. Simpan file gambar ke folder `backend/uploads/images/radiologi/`
2. Nama file harus sesuai dengan field `lokasi_gambar` di tabel `gambar_radiologi` di database

### 3. Gambar Lab PA (Patologi Anatomi)

**Lokasi folder:**
```
backend/uploads/images/labpa/
```

**Cara akses di frontend:**
- URL: `/labpa/nama-file.jpg`
- Contoh: `/labpa/histopatologi-001.jpg`

**Cara menyimpan:**
1. Simpan file gambar ke folder `backend/uploads/images/labpa/`
2. Nama file harus sesuai dengan field `photo` di tabel `detail_periksa_labpa_gambar` di database

## Catatan Penting

1. **Path Relatif**: Semua path adalah relatif terhadap folder `backend/`
2. **Naming Convention**: Gunakan nama file yang deskriptif dan unik
3. **Ukuran File**: Disarankan maksimal 5MB per file untuk performa optimal
4. **Format**: Format yang didukung: JPG, JPEG, PNG, GIF, WebP
5. **Permission**: Pastikan folder memiliki permission yang tepat untuk read/write

## Troubleshooting

### Gambar tidak muncul
1. Pastikan file sudah disimpan di folder yang benar
2. Pastikan nama file sesuai dengan yang ada di database (untuk radiologi dan labpa)
3. Pastikan backend sudah di-restart setelah menambahkan static file serving
4. Cek console browser untuk error 404

### Permission Error
```bash
# Berikan permission read untuk folder
chmod -R 755 backend/uploads/images/
```

## Contoh Integrasi dengan Database

Jika Anda ingin menyimpan path gambar di database untuk Asuhan Medis IGD, Anda bisa menambahkan field baru:

```sql
ALTER TABLE penilaian_medis_igd 
ADD COLUMN gambar_lokalis VARCHAR(255) DEFAULT NULL;
```

Kemudian simpan path relatif:
```sql
UPDATE penilaian_medis_igd 
SET gambar_lokalis = 'asuhan-medis-igd/2025-11-29-001-lokalis.jpg'
WHERE no_rawat = '2025/11/29/001';
```

Di frontend, gunakan:
```tsx
<img src={`/${item.gambar_lokalis}`} alt="Gambar Lokalis" />
```

