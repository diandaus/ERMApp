# 📋 API Dokumentasi - Modul Laboratorium

## Overview
API untuk mengelola permintaan pemeriksaan laboratorium (PK - Patologi Klinik dan PA - Patologi Anatomi) pada aplikasi ERMApp.

---

## 🔗 Endpoints

### 1. **Get Jenis Perawatan Lab**
Mendapatkan daftar jenis pemeriksaan lab berdasarkan kategori (PK/PA)

**Endpoint:** `GET /api/lab/jenis-perawatan`

**Query Parameters:**
- `kategori` (required): `PK` atau `PA`
- `search` (optional): Keyword pencarian
- `kd_pj` (optional): Kode penjab/cara bayar
- `kelas` (optional): Kelas rawat

**Response Example:**
```json
[
  {
    "kd_jenis_prw": "PK001",
    "nm_perawatan": "Darah Lengkap",
    "kategori": "PK",
    "status": "1",
    "kd_pj": "A01",
    "kelas": "1"
  }
]
```

---

### 2. **Get Template Laboratorium**
Mendapatkan detail pemeriksaan berdasarkan jenis perawatan

**Endpoint:** `GET /api/lab/template`

**Query Parameters:**
- `kd_jenis_prw` (required): Kode jenis perawatan
- `search` (optional): Keyword pencarian

**Response Example:**
```json
[
  {
    "id_template": "TPL001",
    "pemeriksaan": "Hemoglobin",
    "satuan": "g/dL",
    "nilai_rujukan_ld": "12.0",
    "nilai_rujukan_la": "16.0",
    "nilai_rujukan_pd": "13.0",
    "nilai_rujukan_pa": "17.0",
    "kd_jenis_prw": "PK001"
  }
]
```

---

### 3. **Simpan Permintaan Lab PK**
Menyimpan permintaan pemeriksaan laboratorium Patologi Klinik

**Endpoint:** `POST /api/lab/permintaan-pk`

**Request Body:**
```json
{
  "no_rawat": "2025/01/09/001",
  "kd_dokter": "DR001",
  "status_lanjut": "ralan",
  "diagnosa_klinis": "Suspect Anemia",
  "informasi_tambahan": "Pasien mengeluh lemas",
  "pemeriksaan_list": ["PK001", "PK002"],
  "detail_pemeriksaan": ["TPL001", "TPL002"]
}
```

**Response Example:**
```json
{
  "message": "Permintaan lab PK berhasil disimpan",
  "noorder": "PK202501090001",
  "tgl_permintaan": "2025-01-09",
  "jam_permintaan": "10:30:15"
}
```

---

### 4. **Simpan Permintaan Lab PA**
Menyimpan permintaan pemeriksaan laboratorium Patologi Anatomi

**Endpoint:** `POST /api/lab/permintaan-pa`

**Request Body:**
```json
{
  "no_rawat": "2025/01/09/001",
  "kd_dokter": "DR001",
  "status_lanjut": "ralan",
  "diagnosa_klinis": "Suspect Tumor",
  "informasi_tambahan": "Biopsi jaringan payudara",
  "pemeriksaan_list": ["PA001"],
  "tgl_pengambilan_bahan": "2025-01-09",
  "diperoleh_dengan": "Biopsi",
  "lokasi_pengambilan": "Payudara kanan",
  "diawetkan": "Formalin 10%",
  "dilakukan_pa": "Lab Patologi RS",
  "tgl_pa": "2025-01-10",
  "nomor_pa": "PA2025001",
  "diagnosa_pa": ""
}
```

**Response Example:**
```json
{
  "message": "Permintaan lab PA berhasil disimpan",
  "noorder": "PA202501090001",
  "tgl_permintaan": "2025-01-09",
  "jam_permintaan": "10:30:15"
}
```

---

### 5. **Get Riwayat Lab PK**
Mendapatkan riwayat permintaan lab PK berdasarkan nomor rawat

**Endpoint:** `GET /api/lab/riwayat-pk/:no_rawat`

**Path Parameters:**
- `no_rawat`: Nomor rawat pasien (URL encoded)

**Response Example:**
```json
[
  {
    "noorder": "PK202501090001",
    "no_rawat": "2025/01/09/001",
    "tgl_permintaan": "2025-01-09",
    "jam_permintaan": "10:30:15",
    "tgl_hasil": "0000-00-00",
    "jam_hasil": "00:00:00",
    "dokter_perujuk": "DR001",
    "nm_dokter": "dr. John Doe, Sp.PD",
    "status": "ralan",
    "informasi_tambahan": "Pasien mengeluh lemas",
    "diagnosa_klinis": "Suspect Anemia",
    "detail_pemeriksaan": [
      {
        "kd_jenis_prw": "PK001",
        "nm_perawatan": "Darah Lengkap",
        "stts_bayar": "Belum"
      }
    ]
  }
]
```

---

### 6. **Get Riwayat Lab PA**
Mendapatkan riwayat permintaan lab PA berdasarkan nomor rawat

**Endpoint:** `GET /api/lab/riwayat-pa/:no_rawat`

**Path Parameters:**
- `no_rawat`: Nomor rawat pasien (URL encoded)

**Response Example:**
```json
[
  {
    "noorder": "PA202501090001",
    "no_rawat": "2025/01/09/001",
    "tgl_permintaan": "2025-01-09",
    "jam_permintaan": "10:30:15",
    "tgl_hasil": "0000-00-00",
    "jam_hasil": "00:00:00",
    "dokter_perujuk": "DR001",
    "nm_dokter": "dr. John Doe, Sp.PD",
    "status": "ralan",
    "informasi_tambahan": "Biopsi jaringan payudara",
    "diagnosa_klinis": "Suspect Tumor",
    "tgl_pengambilan_bahan": "2025-01-09",
    "diperoleh_dari": "Biopsi",
    "lokasi_pengambilan": "Payudara kanan",
    "diawetkan": "Formalin 10%",
    "detail_pemeriksaan": [
      {
        "kd_jenis_prw": "PA001",
        "nm_perawatan": "Histopatologi",
        "stts_bayar": "Belum"
      }
    ]
  }
]
```

---

## 🗄️ Database Schema

### Tabel: `jns_perawatan_lab`
Menyimpan master jenis pemeriksaan laboratorium

| Column | Type | Description |
|--------|------|-------------|
| kd_jenis_prw | VARCHAR | Kode jenis perawatan (PK) |
| nm_perawatan | VARCHAR | Nama pemeriksaan |
| kategori | ENUM('PK','PA','MB') | Kategori lab |
| status | ENUM('0','1') | Status aktif |
| kd_pj | VARCHAR | Kode penjab |
| kelas | VARCHAR | Kelas rawat |

### Tabel: `template_laboratorium`
Menyimpan template detail pemeriksaan

| Column | Type | Description |
|--------|------|-------------|
| id_template | VARCHAR | ID template (PK) |
| kd_jenis_prw | VARCHAR | Kode jenis perawatan (FK) |
| Pemeriksaan | VARCHAR | Nama pemeriksaan |
| satuan | VARCHAR | Satuan hasil |
| nilai_rujukan_ld | VARCHAR | Nilai rujukan laki dewasa |
| nilai_rujukan_la | VARCHAR | Nilai rujukan laki anak |
| nilai_rujukan_pd | VARCHAR | Nilai rujukan perempuan dewasa |
| nilai_rujukan_pa | VARCHAR | Nilai rujukan perempuan anak |
| urut | INT | Urutan tampil |

### Tabel: `permintaan_lab`
Menyimpan header permintaan lab PK

| Column | Type | Description |
|--------|------|-------------|
| noorder | VARCHAR | Nomor permintaan (PK) |
| no_rawat | VARCHAR | Nomor rawat (FK) |
| tgl_permintaan | DATE | Tanggal permintaan |
| jam_permintaan | TIME | Jam permintaan |
| tgl_sampel | DATE | Tanggal pengambilan sampel |
| jam_sampel | TIME | Jam pengambilan sampel |
| tgl_hasil | DATE | Tanggal hasil |
| jam_hasil | TIME | Jam hasil |
| dokter_perujuk | VARCHAR | Kode dokter (FK) |
| status | VARCHAR | Status rawat |
| informasi_tambahan | TEXT | Informasi tambahan |
| diagnosa_klinis | TEXT | Diagnosis klinis |

### Tabel: `permintaan_pemeriksaan_lab`
Menyimpan detail pemeriksaan lab PK

| Column | Type | Description |
|--------|------|-------------|
| noorder | VARCHAR | Nomor permintaan (FK) |
| kd_jenis_prw | VARCHAR | Kode jenis perawatan (FK) |
| stts_bayar | ENUM('Belum','Sudah') | Status pembayaran |

### Tabel: `permintaan_detail_permintaan_lab`
Menyimpan detail template pemeriksaan lab PK

| Column | Type | Description |
|--------|------|-------------|
| noorder | VARCHAR | Nomor permintaan (FK) |
| kd_jenis_prw | VARCHAR | Kode jenis perawatan (FK) |
| id_template | VARCHAR | ID template (FK) |
| stts_bayar | ENUM('Belum','Sudah') | Status pembayaran |

### Tabel: `permintaan_labpa`
Menyimpan header permintaan lab PA (struktur mirip `permintaan_lab` dengan tambahan field PA)

### Tabel: `permintaan_pemeriksaan_labpa`
Menyimpan detail pemeriksaan lab PA

---

## 🚀 Auto Generate Nomor Permintaan

Format nomor permintaan:
- **Lab PK**: `PK` + `YYYYMMDD` + `NNNN` (contoh: `PK202501090001`)
- **Lab PA**: `PA` + `YYYYMMDD` + `NNNN` (contoh: `PA202501090001`)
- **Lab MB**: `MB` + `YYYYMMDD` + `NNNN` (contoh: `MB202501090001`)

Nomor urut di-reset setiap hari.

---

## ⚠️ Error Handling

### Status Codes:
- `200 OK`: Request berhasil
- `201 Created`: Data berhasil disimpan
- `400 Bad Request`: Parameter tidak valid
- `404 Not Found`: Data tidak ditemukan
- `500 Internal Server Error`: Error server

### Error Response Format:
```json
{
  "error": "Deskripsi error"
}
```

---

## 📝 Notes

1. Semua endpoint lab menggunakan prefix `/api/lab`
2. Parameter `no_rawat` harus di-encode saat digunakan di URL path
3. Field `tgl_permintaan` dan `jam_permintaan` akan otomatis di-set jika tidak dikirim
4. Nomor permintaan (`noorder`) di-generate otomatis oleh sistem
5. Field `status_lanjut` umumnya berisi `ralan` (rawat jalan) atau `ranap` (rawat inap)

---

## 🧪 Testing Example

### cURL Example - Get Jenis Perawatan PK:
```bash
curl -X GET "http://localhost:8080/api/lab/jenis-perawatan?kategori=PK&search=darah"
```

### cURL Example - Simpan Permintaan Lab PK:
```bash
curl -X POST http://localhost:8080/api/lab/permintaan-pk \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2025/01/09/001",
    "kd_dokter": "DR001",
    "status_lanjut": "ralan",
    "diagnosa_klinis": "Suspect Anemia",
    "informasi_tambahan": "Pasien mengeluh lemas",
    "pemeriksaan_list": ["PK001"],
    "detail_pemeriksaan": []
  }'
```

### cURL Example - Get Riwayat Lab PK:
```bash
curl -X GET "http://localhost:8080/api/lab/riwayat-pk/2025%2F01%2F09%2F001"
```

---

**Last Updated:** 2025-12-09
**Version:** 1.0.0
**Author:** ERMApp Development Team
