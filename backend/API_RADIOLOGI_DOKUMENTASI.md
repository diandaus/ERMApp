# API Radiologi - Dokumentasi

Dokumentasi lengkap endpoint API untuk modul Radiologi di ERMApp.

## Base URL
```
http://localhost:8080/api/radiologi
```

---

## 1. Get Jenis Perawatan Radiologi

Mengambil daftar jenis pemeriksaan radiologi yang tersedia.

### Endpoint
```
GET /api/radiologi/jenis-perawatan
```

### Query Parameters
| Parameter | Type | Required | Deskripsi |
|-----------|------|----------|-----------|
| `search` | string | No | Kata kunci pencarian (kode atau nama pemeriksaan) |
| `kd_pj` | string | No | Kode penanggung jawab / cara bayar |
| `kelas` | string | No | Kelas perawatan |

### Response Success (200 OK)
```json
[
  {
    "kd_jenis_prw": "3.1.1.1",
    "nm_perawatan": "THORAX PA",
    "status": "1",
    "kd_pj": "-",
    "kelas": "-"
  },
  {
    "kd_jenis_prw": "3.1.1.2",
    "nm_perawatan": "THORAX AP/LATERAL",
    "status": "1",
    "kd_pj": "BPJ",
    "kelas": "1"
  }
]
```

### Response Error (500 Internal Server Error)
```json
{
  "error": "Gagal mengambil data jenis perawatan radiologi",
  "details": "error message"
}
```

### Contoh Request
```bash
# Get semua pemeriksaan radiologi
curl "http://localhost:8080/api/radiologi/jenis-perawatan"

# Search pemeriksaan dengan kata kunci "thorax"
curl "http://localhost:8080/api/radiologi/jenis-perawatan?search=thorax"

# Filter berdasarkan cara bayar BPJS
curl "http://localhost:8080/api/radiologi/jenis-perawatan?kd_pj=BPJ"

# Filter berdasarkan kelas 1
curl "http://localhost:8080/api/radiologi/jenis-perawatan?kelas=1"

# Kombinasi filter
curl "http://localhost:8080/api/radiologi/jenis-perawatan?search=thorax&kd_pj=BPJ&kelas=1"
```

---

## 2. Create Permintaan Radiologi

Menyimpan permintaan pemeriksaan radiologi baru.

### Endpoint
```
POST /api/radiologi/permintaan
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "no_rawat": "2023/12/10/000001",
  "kd_dokter": "DR001",
  "status_lanjut": "ralan",
  "diagnosis_klinis": "Suspek Pneumonia",
  "informasi_tambahan": "Pasien batuk sejak 3 hari yang lalu",
  "pemeriksaan_list": [
    "3.1.1.1",
    "3.1.1.2"
  ],
  "tgl_permintaan": "2023-12-10",
  "jam_permintaan": "14:30:00"
}
```

### Request Body Schema
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| `no_rawat` | string | Yes | Nomor rawat pasien |
| `kd_dokter` | string | No | Kode dokter yang meminta |
| `status_lanjut` | string | No | Status lanjut (ralan/ranap) |
| `diagnosis_klinis` | string | Yes | Diagnosis klinis / indikasi pemeriksaan |
| `informasi_tambahan` | string | No | Informasi tambahan |
| `pemeriksaan_list` | array[string] | Yes | Array kode jenis pemeriksaan (kd_jenis_prw) |
| `tgl_permintaan` | string | Yes | Tanggal permintaan (YYYY-MM-DD) |
| `jam_permintaan` | string | Yes | Jam permintaan (HH:MM:SS) |

### Response Success (200 OK)
```json
{
  "message": "Permintaan radiologi berhasil disimpan",
  "noorder": "RAD202312100001"
}
```

### Response Error (400 Bad Request)
```json
{
  "error": "Diagnosis Klinis wajib diisi"
}
```

### Response Error (500 Internal Server Error)
```json
{
  "error": "Gagal menyimpan permintaan radiologi",
  "details": "error message"
}
```

### Contoh Request
```bash
curl -X POST http://localhost:8080/api/radiologi/permintaan \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2023/12/10/000001",
    "kd_dokter": "DR001",
    "status_lanjut": "ralan",
    "diagnosis_klinis": "Suspek Pneumonia",
    "informasi_tambahan": "Pasien batuk sejak 3 hari yang lalu",
    "pemeriksaan_list": ["3.1.1.1", "3.1.1.2"],
    "tgl_permintaan": "2023-12-10",
    "jam_permintaan": "14:30:00"
  }'
```

---

## 3. Get Riwayat Permintaan Radiologi

Mengambil riwayat permintaan radiologi berdasarkan nomor rawat.

### Endpoint
```
GET /api/radiologi/riwayat/:no_rawat
```

### Path Parameters
| Parameter | Type | Required | Deskripsi |
|-----------|------|----------|-----------|
| `no_rawat` | string | Yes | Nomor rawat pasien (bisa mengandung slash `/`) |

### Response Success (200 OK)
```json
[
  {
    "noorder": "RAD202312100001",
    "no_rawat": "2023/12/10/000001",
    "tgl_permintaan": "2023-12-10",
    "jam_permintaan": "14:30:00",
    "kd_dokter": "DR001",
    "nm_dokter": "dr. John Doe, Sp.PD",
    "status": "ralan",
    "informasi_tambahan": "Pasien batuk sejak 3 hari yang lalu",
    "diagnosa_klinis": "Suspek Pneumonia",
    "detail_pemeriksaan": [
      {
        "kd_jenis_prw": "3.1.1.1",
        "nm_perawatan": "THORAX PA"
      },
      {
        "kd_jenis_prw": "3.1.1.2",
        "nm_perawatan": "THORAX AP/LATERAL"
      }
    ]
  }
]
```

### Response Error (400 Bad Request)
```json
{
  "error": "No rawat wajib diisi"
}
```

### Response Error (500 Internal Server Error)
```json
{
  "error": "Gagal mengambil riwayat radiologi",
  "details": "error message"
}
```

### Contoh Request
```bash
# Format no_rawat dengan slash akan di-encode otomatis
curl "http://localhost:8080/api/radiologi/riwayat/2023/12/10/000001"

# Atau dengan encode manual
curl "http://localhost:8080/api/radiologi/riwayat/2023%2F12%2F10%2F000001"
```

---

## 4. Delete Permintaan Radiologi

Menghapus permintaan radiologi berdasarkan nomor order.

### Endpoint
```
DELETE /api/radiologi/permintaan/:noorder
```

### Path Parameters
| Parameter | Type | Required | Deskripsi |
|-----------|------|----------|-----------|
| `noorder` | string | Yes | Nomor order permintaan radiologi |

### Response Success (200 OK)
```json
{
  "message": "Permintaan radiologi berhasil dihapus"
}
```

### Response Error (400 Bad Request)
```json
{
  "error": "No order wajib diisi"
}
```

### Response Error (404 Not Found)
```json
{
  "error": "Permintaan radiologi tidak ditemukan"
}
```

### Response Error (500 Internal Server Error)
```json
{
  "error": "Gagal menghapus permintaan radiologi",
  "details": "error message"
}
```

### Contoh Request
```bash
curl -X DELETE "http://localhost:8080/api/radiologi/permintaan/RAD202312100001"
```

---

## Struktur Database

### Tabel `jns_perawatan_radiologi`

Menyimpan master data jenis pemeriksaan radiologi.

```sql
CREATE TABLE jns_perawatan_radiologi (
  kd_jenis_prw VARCHAR(15) PRIMARY KEY,
  nm_perawatan VARCHAR(80),
  status ENUM('0','1') DEFAULT '1',
  kd_pj VARCHAR(3),
  kelas VARCHAR(10),
  INDEX idx_status (status),
  INDEX idx_kd_pj (kd_pj),
  INDEX idx_kelas (kelas)
);
```

**Kolom:**
- `kd_jenis_prw`: Kode unik jenis pemeriksaan
- `nm_perawatan`: Nama pemeriksaan radiologi
- `status`: Status aktif ('1' = aktif, '0' = tidak aktif)
- `kd_pj`: Kode penanggung jawab / cara bayar ('-' = semua)
- `kelas`: Kelas perawatan ('-' = semua)

### Tabel `permintaan_radiologi`

Menyimpan header permintaan radiologi.

```sql
CREATE TABLE permintaan_radiologi (
  noorder VARCHAR(15) PRIMARY KEY,
  no_rawat VARCHAR(17),
  tgl_permintaan DATE,
  jam_permintaan TIME,
  kd_dokter VARCHAR(20),
  status_lanjut ENUM('ralan','ranap'),
  informasi_tambahan TEXT,
  diagnosa_klinis TEXT,
  INDEX idx_no_rawat (no_rawat),
  INDEX idx_tgl_permintaan (tgl_permintaan),
  FOREIGN KEY (no_rawat) REFERENCES reg_periksa(no_rawat) ON DELETE CASCADE,
  FOREIGN KEY (kd_dokter) REFERENCES dokter(kd_dokter)
);
```

**Kolom:**
- `noorder`: Nomor order unik (format: RAD{YYYYMMDD}{0001})
- `no_rawat`: Nomor rawat pasien (FK ke reg_periksa)
- `tgl_permintaan`: Tanggal permintaan
- `jam_permintaan`: Jam permintaan
- `kd_dokter`: Kode dokter yang meminta (FK ke dokter)
- `status_lanjut`: Status rawat inap/jalan
- `informasi_tambahan`: Catatan tambahan
- `diagnosa_klinis`: Diagnosis klinis / indikasi pemeriksaan

### Tabel `permintaan_pemeriksaan_radiologi`

Menyimpan detail pemeriksaan yang diminta.

```sql
CREATE TABLE permintaan_pemeriksaan_radiologi (
  noorder VARCHAR(15),
  kd_jenis_prw VARCHAR(15),
  PRIMARY KEY (noorder, kd_jenis_prw),
  FOREIGN KEY (noorder) REFERENCES permintaan_radiologi(noorder) ON DELETE CASCADE,
  FOREIGN KEY (kd_jenis_prw) REFERENCES jns_perawatan_radiologi(kd_jenis_prw)
);
```

**Kolom:**
- `noorder`: Nomor order (FK ke permintaan_radiologi)
- `kd_jenis_prw`: Kode jenis pemeriksaan (FK ke jns_perawatan_radiologi)

---

## Nomor Order Format

Nomor order radiologi dihasilkan otomatis dengan format:

```
RAD{YYYYMMDD}{XXXX}
```

**Contoh:**
- `RAD202312100001` - Order pertama pada 10 Desember 2023
- `RAD202312100002` - Order kedua pada 10 Desember 2023
- `RAD202312110001` - Order pertama pada 11 Desember 2023

**Algoritma:**
1. Ambil tanggal hari ini dalam format YYYYMMDD
2. Cari nomor order terakhir dengan prefix yang sama
3. Increment sequence number (4 digit)
4. Gabungkan prefix + sequence

---

## Error Handling

Semua endpoint mengikuti konvensi error handling standar:

### Client Errors (4xx)
- **400 Bad Request**: Parameter tidak valid atau data wajib tidak lengkap
- **404 Not Found**: Data yang dicari tidak ditemukan

### Server Errors (5xx)
- **500 Internal Server Error**: Error pada server atau database

### Format Error Response
```json
{
  "error": "Pesan error yang user-friendly",
  "details": "Detail teknis error (opsional)"
}
```

---

## Best Practices

### 1. Validasi Input
- Selalu validasi `diagnosis_klinis` dan `pemeriksaan_list` sebelum submit
- Pastikan `no_rawat` valid dan ada di database
- Gunakan format tanggal dan jam yang benar

### 2. Error Handling
- Tangani semua kemungkinan error response
- Tampilkan pesan error yang informatif ke user
- Log error untuk debugging

### 3. Performance
- Gunakan debouncing untuk search input
- Limit jumlah data yang ditampilkan dengan pagination (jika diperlukan)
- Cache data master jenis pemeriksaan jika tidak sering berubah

### 4. Security
- Validasi user permission sebelum create/delete
- Sanitize input untuk mencegah SQL injection
- Gunakan HTTPS untuk production

---

## Frontend Integration

### Contoh Penggunaan di React

```typescript
// Fetch jenis perawatan radiologi
const fetchPemeriksaanRadiologi = async (search: string, kdPj: string) => {
  const params = new URLSearchParams({
    search,
    kd_pj: kdPj
  });

  const response = await fetch(`/api/radiologi/jenis-perawatan?${params}`);
  const data = await response.json();
  return data;
};

// Create permintaan radiologi
const createPermintaan = async (payload: any) => {
  const response = await fetch('/api/radiologi/permintaan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
};

// Get riwayat
const fetchRiwayat = async (noRawat: string) => {
  const response = await fetch(
    `/api/radiologi/riwayat/${encodeURIComponent(noRawat)}`
  );
  return response.json();
};

// Delete permintaan
const deletePermintaan = async (noOrder: string) => {
  const response = await fetch(
    `/api/radiologi/permintaan/${encodeURIComponent(noOrder)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
};
```

---

## Testing

### Test Data

**Jenis Perawatan Radiologi:**
```sql
INSERT INTO jns_perawatan_radiologi (kd_jenis_prw, nm_perawatan, status, kd_pj, kelas) VALUES
('3.1.1.1', 'THORAX PA', '1', '-', '-'),
('3.1.1.2', 'THORAX AP/LATERAL', '1', '-', '-'),
('3.1.2.1', 'ABDOMEN 1 POSISI', '1', '-', '-'),
('3.1.2.2', 'ABDOMEN 2 POSISI', '1', '-', '-'),
('3.1.3.1', 'KEPALA AP/LATERAL', '1', 'BPJ', '1'),
('3.1.4.1', 'USG ABDOMEN', '1', '-', '-');
```

### Test Cases

1. **Get Jenis Perawatan**
   - ✓ Get all jenis perawatan
   - ✓ Search dengan keyword "thorax"
   - ✓ Filter berdasarkan kd_pj
   - ✓ Filter berdasarkan kelas
   - ✓ Kombinasi filter

2. **Create Permintaan**
   - ✓ Create dengan data lengkap
   - ✗ Create tanpa diagnosis_klinis (expect 400)
   - ✗ Create tanpa pemeriksaan_list (expect 400)
   - ✗ Create dengan no_rawat invalid (expect 500)

3. **Get Riwayat**
   - ✓ Get riwayat dengan no_rawat valid
   - ✓ Get riwayat dengan no_rawat tidak ada (expect [])
   - ✗ Get riwayat tanpa no_rawat (expect 400)

4. **Delete Permintaan**
   - ✓ Delete dengan noorder valid
   - ✗ Delete dengan noorder tidak ada (expect 404)
   - ✗ Delete tanpa noorder (expect 400)

---

## Changelog

### Version 1.0.0 (2023-12-10)
- Initial release
- Implementasi CRUD permintaan radiologi
- Master data jenis perawatan radiologi
- Integrasi dengan sistem Khanza
