# API Documentation - Obat & Resep

Backend telah ditambahkan dengan 3 endpoint baru untuk mengelola obat dan resep.

## 📋 Table of Contents

1. [Search Obat](#1-search-obat)
2. [Submit Resep](#2-submit-resep)
3. [Get Riwayat Resep](#3-get-riwayat-resep)

---

## 1. Search Obat

Endpoint untuk mencari obat berdasarkan nama/kode.

### Request

```
GET /api/obat/search
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` or `q` | string | ✅ Yes | - | Kata kunci pencarian (minimal 2 karakter) |
| `kd_bangsal` | string | ❌ No | `APK` | Kode bangsal/gudang (APK = Apotek) |
| `markup` | float | ❌ No | `0` | Persentase markup harga (contoh: 0.1 = 10%) |
| `stok_kosong` | string | ❌ No | `no` | Tampilkan obat stok kosong? (`yes` / `no`) |

### Response

**Success (200 OK)**

```json
[
  {
    "kode_brng": "OBT001",
    "nama_brng": "PARACETAMOL 500MG TAB",
    "jenis_obat": "OBAT",
    "kode_sat": "TABLET",
    "harga": 500,
    "letak_barang": "RAK-A1",
    "nama_industri": "KIMIA FARMA",
    "h_beli": 450,
    "kapasitas": "10",
    "stok": 100
  }
]
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Query minimal 2 karakter"
}
```

**Error (500 Internal Server Error)**

```json
{
  "success": false,
  "message": "Gagal mencari obat: [error detail]"
}
```

### cURL Example

```bash
# Basic search
curl "http://localhost:8080/api/obat/search?query=para"

# Search dengan markup 10%
curl "http://localhost:8080/api/obat/search?query=para&markup=0.1"

# Search dari bangsal tertentu
curl "http://localhost:8080/api/obat/search?query=para&kd_bangsal=GD001"

# Tampilkan juga obat stok kosong
curl "http://localhost:8080/api/obat/search?query=para&stok_kosong=yes"
```

---

## 2. Submit Resep

Endpoint untuk menyimpan resep (non-racikan dan/atau racikan).

### Request

```
POST /api/resep/submit
```

### Request Body

```json
{
  "no_rawat": "2025/11/29/001",
  "kd_dokter": "D001",
  "non_racikan": [
    {
      "kode_brng": "OBT001",
      "jml": 10,
      "aturan_pakai": "3x1 sehari setelah makan"
    }
  ],
  "racikan": [
    {
      "nama_racikan": "Racikan Batuk",
      "keterangan": "Racikan untuk batuk kering",
      "metode_racik": "Puyer",
      "jml_dr": 10,
      "aturan_pakai": "3x1 sehari",
      "detail": [
        {
          "kode_brng": "OBT002",
          "kandungan": "200",
          "jml": 2.5
        },
        {
          "kode_brng": "OBT003",
          "kandungan": "1/3",
          "jml": 0.33
        }
      ]
    }
  ]
}
```

### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `no_rawat` | string | ✅ Yes | Nomor rawat pasien |
| `kd_dokter` | string | ❌ No | Kode dokter (optional, akan auto-detect dari reg_periksa) |
| `non_racikan` | array | ❌ No | Array obat non-racikan |
| `non_racikan[].kode_brng` | string | ✅ Yes (if non_racikan exists) | Kode barang obat |
| `non_racikan[].jml` | float | ✅ Yes (if non_racikan exists) | Jumlah obat |
| `non_racikan[].aturan_pakai` | string | ✅ Yes (if non_racikan exists) | Aturan pakai (contoh: "3x1 sehari") |
| `racikan` | array | ❌ No | Array obat racikan |
| `racikan[].nama_racikan` | string | ✅ Yes (if racikan exists) | Nama racikan |
| `racikan[].keterangan` | string | ❌ No | Keterangan tambahan |
| `racikan[].metode_racik` | string | ❌ No | Metode racik (Kapsul/Puyer/Sirup/Salep/Krim) |
| `racikan[].jml_dr` | int | ✅ Yes (if racikan exists) | Jumlah racikan |
| `racikan[].aturan_pakai` | string | ✅ Yes (if racikan exists) | Aturan pakai |
| `racikan[].detail` | array | ✅ Yes (if racikan exists) | Detail obat dalam racikan |
| `racikan[].detail[].kode_brng` | string | ✅ Yes | Kode barang obat |
| `racikan[].detail[].kandungan` | string | ✅ Yes | Kandungan (bisa angka atau pecahan, contoh: "200" atau "1/3") |
| `racikan[].detail[].jml` | float | ✅ Yes | Jumlah (auto-calculated di frontend) |

### Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Resep berhasil disimpan",
  "no_resep": "202512030001"
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Invalid request: [validation error]"
}
```

```json
{
  "success": false,
  "message": "Dokter tidak ditemukan untuk pasien ini"
}
```

**Error (500 Internal Server Error)**

```json
{
  "success": false,
  "message": "Gagal menyimpan resep: [error detail]"
}
```

### cURL Example

```bash
# Submit non-racikan only
curl -X POST http://localhost:8080/api/resep/submit \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2025/11/29/001",
    "non_racikan": [
      {
        "kode_brng": "OBT001",
        "jml": 10,
        "aturan_pakai": "3x1 sehari"
      }
    ]
  }'

# Submit racikan only
curl -X POST http://localhost:8080/api/resep/submit \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2025/11/29/001",
    "racikan": [
      {
        "nama_racikan": "Racikan Batuk",
        "metode_racik": "Puyer",
        "jml_dr": 10,
        "aturan_pakai": "3x1 sehari",
        "detail": [
          {
            "kode_brng": "OBT002",
            "kandungan": "200",
            "jml": 2.5
          }
        ]
      }
    ]
  }'

# Submit both non-racikan and racikan
curl -X POST http://localhost:8080/api/resep/submit \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2025/11/29/001",
    "kd_dokter": "D001",
    "non_racikan": [
      {
        "kode_brng": "OBT001",
        "jml": 10,
        "aturan_pakai": "3x1 sehari"
      }
    ],
    "racikan": [
      {
        "nama_racikan": "Racikan Batuk",
        "metode_racik": "Puyer",
        "jml_dr": 10,
        "aturan_pakai": "3x1 sehari",
        "detail": [
          {
            "kode_brng": "OBT002",
            "kandungan": "200",
            "jml": 2.5
          }
        ]
      }
    ]
  }'
```

---

## 3. Get Riwayat Resep

Endpoint untuk mengambil riwayat resep berdasarkan nomor rekam medis pasien.

### Request

```
GET /api/resep/history/:no_rkm_medis
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `no_rkm_medis` | string | ✅ Yes | Nomor rekam medis pasien |

### Response

**Success (200 OK)**

```json
[
  {
    "no_resep": "202512030001",
    "tgl_peresepan": "2025-12-03",
    "jam_peresepan": "10:30:00",
    "no_rawat": "2025/11/29/001",
    "no_rkm_medis": "000001",
    "nm_pasien": "John Doe",
    "nm_dokter": "Dr. Jane Smith",
    "kd_dokter": "D001",
    "status": "Sudah Terlayani",
    "status_asal": "Rawat Jalan",
    "non_racikan": [
      {
        "kode_brng": "OBT001",
        "nama_brng": "PARACETAMOL 500MG TAB",
        "jml": 10,
        "kode_sat": "TABLET",
        "aturan_pakai": "3x1 sehari setelah makan"
      }
    ],
    "racikan": [
      {
        "no_racik": 1,
        "nama_racik": "Racikan Batuk",
        "kd_racik": "RC001",
        "metode": "Puyer",
        "jml_dr": 10,
        "aturan_pakai": "3x1 sehari",
        "keterangan": "Racikan untuk batuk kering",
        "detail": [
          {
            "kode_brng": "OBT002",
            "nama_brng": "DEXTROMETHORPHAN 15MG",
            "jml": 2.5,
            "kode_sat": "TABLET"
          }
        ]
      }
    ]
  }
]
```

**Error (500 Internal Server Error)**

```json
{
  "success": false,
  "message": "Gagal mengambil riwayat resep: [error detail]"
}
```

### cURL Example

```bash
# Get riwayat resep
curl "http://localhost:8080/api/resep/history/000001"
```

---

## 📊 Database Tables

### Tables Modified/Used:

1. **resep_obat** - Header resep
2. **resep_dokter** - Detail obat non-racikan
3. **resep_dokter_racikan** - Header racikan
4. **resep_dokter_racikan_detail** - Detail obat dalam racikan
5. **databarang** - Master data obat
6. **gudangbarang** - Stok obat per gudang/bangsal
7. **jenis** - Jenis obat
8. **industrifarmasi** - Industri farmasi
9. **metode_racik** - Metode racik

### Auto-Generated Fields:

- **no_resep**: Format YYYYMMDDXXXX (contoh: 202512030001)
- **tgl_peresepan**: Auto-filled dengan tanggal hari ini
- **jam_peresepan**: Auto-filled dengan jam sekarang
- **status**: Auto-detect dari reg_periksa (ralan/ranap)
- **kd_dokter**: Auto-detect dari dpjp_ranap atau reg_periksa jika tidak disediakan

---

## 🔧 Frontend Integration

Update ResepModal.tsx untuk menggunakan endpoint yang benar:

```typescript
// Search obat
const cariObatNonRacikan = async () => {
  const response = await fetch(
    `/api/obat/search?query=${encodeURIComponent(searchObatNonRacikan)}`
  );
  const data = await response.json();
  setObatList(data || []);
};

// Submit resep
const submitResepUnified = async () => {
  const payload = {
    no_rawat: patient.no_rawat,
    kd_dokter: patient.kd_dokter,
    non_racikan: activeResepTab === 'non-racikan' ? resepNonRacikan : [],
    racikan: activeResepTab === 'racikan' ? [racikan] : []
  };

  const response = await fetch('/api/resep/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.success) {
    Swal.fire('Berhasil!', result.message, 'success');
  }
};

// Get riwayat resep
const openModalRiwayatResep = async () => {
  const response = await fetch(
    `/api/resep/history/${patient.no_rkm_medis}`
  );
  const data = await response.json();
  setRiwayatResep(data || []);
};
```

---

## 🧪 Testing

### Test dengan database kosong:

```bash
# Akan return empty array []
curl "http://localhost:8080/api/obat/search?query=para"
curl "http://localhost:8080/api/resep/history/000001"
```

### Test submit resep:

1. Pastikan ada data di tabel `reg_periksa` dengan `no_rawat` yang valid
2. Pastikan ada data dokter di tabel `dokter`
3. Pastikan ada data obat di tabel `databarang` dan `gudangbarang`

---

## 📝 Notes

1. **Markup**: Harga dihitung dengan formula: `h_beli + (h_beli * markup)`
2. **Kapasitas**: Jumlah obat disimpan sebagai `jml / kapasitas` di database
3. **Kandungan Racikan**: Mendukung angka (200) dan pecahan (1/3, 2/3)
4. **Transaction**: Submit resep menggunakan database transaction untuk memastikan data konsisten
5. **Auto-detect Dokter**: Sistem akan mencari kd_dokter dari dpjp_ranap -> reg_periksa jika tidak disediakan
6. **Status**: Auto-detect status pasien (ralan/ranap) dari reg_periksa

---

## ⚠️ Troubleshooting

### Obat tidak ditemukan saat search

- Cek apakah ada data di tabel `gudangbarang` dengan `kd_bangsal` yang sesuai
- Cek apakah obat memiliki `status = '1'` di tabel `databarang`
- Coba gunakan parameter `stok_kosong=yes` untuk melihat obat dengan stok 0

### Submit resep gagal dengan error "Dokter tidak ditemukan"

- Pastikan ada data di tabel `reg_periksa` dengan `no_rawat` yang sesuai
- Atau sertakan `kd_dokter` dalam request body

### Riwayat resep kosong

- Pastikan ada data di tabel `resep_obat` dengan `tgl_peresepan != '0000-00-00'`
- Cek apakah `no_rkm_medis` benar

---

## 🔐 Security Notes

- ❌ Endpoint belum ada authentication/authorization
- ❌ Belum ada validasi stok saat submit resep
- ❌ Belum ada validasi duplikasi resep
- ✅ Menggunakan parameterized queries untuk mencegah SQL injection
- ✅ Menggunakan database transaction

**TODO untuk production:**
- Tambahkan middleware authentication
- Tambahkan validasi stok sebelum submit
- Tambahkan rate limiting
- Tambahkan logging yang lebih detail
