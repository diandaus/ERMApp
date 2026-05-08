# ResepModal Component - Documentation

## Overview

ResepModal adalah komponen React yang dikonversi dari Vue.js untuk mengelola input resep obat di aplikasi ERM (Electronic Medical Record). Komponen ini mendukung dua jenis resep:

1. **Non-Racikan** - Obat yang tidak dicampur
2. **Racikan** - Obat yang dicampur/diracik

## Features

### 1. Tab Non-Racikan
- ✅ Pencarian obat dengan autocomplete dropdown
- ✅ Menampilkan informasi lengkap obat (kode, nama, satuan, stok, harga)
- ✅ Form input jumlah dan aturan pakai
- ✅ Daftar obat yang dipilih dengan editing inline
- ✅ Hapus obat dari daftar

### 2. Tab Racikan
- ✅ Input informasi racikan (nama, keterangan, metode, jumlah, aturan pakai)
- ✅ Pencarian obat untuk racikan
- ✅ Form input kandungan dengan auto-kalkulasi jumlah
- ✅ Support input pecahan (contoh: 2/3)
- ✅ Daftar obat dalam racikan
- ✅ Hapus obat dari racikan

### 3. Riwayat Resep
- ✅ Modal terpisah untuk melihat riwayat resep pasien
- ✅ Menampilkan detail resep non-racikan dan racikan
- ✅ Fitur copy resep ke form input
- ✅ Filter dan tampilan yang informatif

### 4. Modal Nested
- ✅ Modal input obat non-racikan (popup kecil)
- ✅ Modal input obat racikan dengan info kapasitas
- ✅ Modal riwayat resep (full screen)

## File Structure

```
frontend/src/components/
├── ResepModal.tsx              # Main component
├── ResepModal.css              # Styling
├── ResepModalExample.tsx       # Usage example
└── README_RESEP_MODAL.md      # This file
```

## Installation & Setup

### 1. Import Component

```tsx
import { ResepModal } from './components/ResepModal';
```

### 2. Add State

```tsx
const [showResepModal, setShowResepModal] = React.useState(false);
```

### 3. Render Modal

```tsx
{showResepModal && (
  <ResepModal
    patient={patient}
    onClose={() => setShowResepModal(false)}
  />
)}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `patient` | `object` | Yes | Data pasien yang akan menerima resep |
| `onClose` | `function` | Yes | Callback function saat modal ditutup |

### Patient Object Structure

```typescript
{
  no_rkm_medis: string;     // No. Rekam Medis
  nm_pasien: string;        // Nama Pasien
  no_rawat: string;         // No. Rawat
  tgl_registrasi: string;   // Tanggal Registrasi
  jam_reg: string;          // Jam Registrasi
  nm_poli: string;          // Nama Poliklinik
  nm_dokter: string;        // Nama Dokter
  umur: string;             // Umur Pasien
  stts: string;             // Status
  png_jawab: string;        // Penanggung Jawab
  kd_dokter: string;        // Kode Dokter
}
```

## API Integration

### Required API Endpoints

Anda perlu membuat endpoint berikut di backend:

#### 1. Search Obat
```
GET /api/obat/search?query={searchTerm}

Response:
[
  {
    kode_brng: string;
    nama_brng: string;
    kode_sat: string;
    stok: number;
    harga: number;
    jenis_obat?: string;
    nama_industri?: string;
    kapasitas?: string;
  }
]
```

#### 2. Get Riwayat Resep
```
GET /api/resep/history/{no_rkm_medis}

Response:
[
  {
    no_resep: string;
    tgl_peresepan: string;
    jam_peresepan: string;
    no_rawat: string;
    nm_dokter: string;
    status: string;
    status_asal: string;
    non_racikan?: [
      {
        kode_brng: string;
        nama_brng: string;
        jml: number;
        kode_sat: string;
        aturan_pakai: string;
      }
    ];
    racikan?: [
      {
        no_racik: string;
        nama_racik: string;
        metode: string;
        jml_dr: number;
        aturan_pakai: string;
        detail: [
          {
            kode_brng: string;
            nama_brng: string;
            jml: number;
            kode_sat: string;
          }
        ];
      }
    ];
  }
]
```

#### 3. Submit Resep (To Be Implemented)
```
POST /api/resep/submit

Request Body (Non-Racikan):
{
  no_rawat: string;
  no_rkm_medis: string;
  kd_dokter: string;
  obat: [
    {
      kode_brng: string;
      jml: number;
      aturan_pakai: string;
    }
  ]
}

Request Body (Racikan):
{
  no_rawat: string;
  no_rkm_medis: string;
  kd_dokter: string;
  racikan: {
    nama_racikan: string;
    keterangan: string;
    metode_racik: string;
    jml_dr: number;
    aturan_pakai: string;
    detail: [
      {
        kode_brng: string;
        kandungan: string;
        jml: number;
      }
    ]
  }
}
```

## Integration Example with Pemeriksaan.tsx

### Step 1: Import Component
Add at the top of `Pemeriksaan.tsx`:

```tsx
import { ResepModal } from '../components/ResepModal';
```

### Step 2: Add State
Add after other state declarations (around line 16):

```tsx
const [showResepModal, setShowResepModal] = React.useState(false);
```

### Step 3: Modify handleSubmit
Replace the success callback (around line 150):

```tsx
// Before:
if (result.isConfirmed) {
  setActiveTab('cppt');
}

// After:
if (result.isConfirmed) {
  setShowResepModal(true);
}
```

### Step 4: Add Modal Component
Add before closing `</section>` tag (at the end of return statement):

```tsx
{showResepModal && (
  <ResepModal
    patient={patient}
    onClose={() => setShowResepModal(false)}
  />
)}
```

## Key Differences from Vue.js

### State Management
**Vue.js:**
```javascript
data() {
  return {
    activeResepTab: 'non-racikan'
  }
}
```

**React:**
```tsx
const [activeResepTab, setActiveResepTab] = React.useState('non-racikan');
```

### Event Handling
**Vue.js:**
```html
<button @click="cariObat">Cari</button>
```

**React:**
```tsx
<button onClick={cariObat}>Cari</button>
```

### Conditional Rendering
**Vue.js:**
```html
<div v-if="showModal">...</div>
```

**React:**
```tsx
{showModal && <div>...</div>}
```

### List Rendering
**Vue.js:**
```html
<tr v-for="(obat, index) in obatList" :key="index">
```

**React:**
```tsx
{obatList.map((obat, index) => (
  <tr key={index}>
))}
```

### Two-Way Binding
**Vue.js:**
```html
<input v-model="searchObat">
```

**React:**
```tsx
<input
  value={searchObat}
  onChange={(e) => setSearchObat(e.target.value)}
>
```

## Styling

Komponen menggunakan CSS terpisah (`ResepModal.css`) yang mendukung:

- ✅ Responsive design
- ✅ Bootstrap-like utility classes
- ✅ Smooth animations
- ✅ Modal overlay dengan blur background
- ✅ Gradient headers
- ✅ Hover effects

## Features to Implement

Saat ini ada beberapa TODO yang perlu diimplementasikan:

1. **Submit Resep Non-Racikan** (line 291)
   - Integrasi dengan API backend
   - Validasi data sebelum submit
   - Handle response dan error

2. **Submit Resep Racikan** (line 307)
   - Integrasi dengan API backend
   - Validasi data racikan
   - Handle response dan error

3. **Fetch Riwayat Resep** (line 327)
   - Sudah ada struktur, tinggal sesuaikan dengan API backend
   - Handle loading state
   - Handle error state

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Notes

1. **Image Path**: Pastikan file `/images/pharmacy (2).png` tersedia di public folder
2. **SweetAlert2**: Komponen menggunakan `sweetalert2` untuk notifications
3. **Bootstrap CSS**: Komponen menggunakan Bootstrap-like classes tapi dengan custom CSS
4. **Type Safety**: Semua types sudah didefinisikan dengan TypeScript

## Troubleshooting

### Modal tidak muncul
- Pastikan `showResepModal` state bernilai `true`
- Check z-index di CSS (.modal-overlay z-index: 9999)

### Dropdown obat tidak muncul
- Pastikan API endpoint `/api/obat/search` sudah berjalan
- Check network tab di browser developer tools
- Pastikan `showObatDropdown` state bernilai `true`

### Styling tidak muncul
- Pastikan import `./ResepModal.css` ada di component
- Check bahwa file CSS sudah ada di folder yang benar

### TypeScript errors
- Pastikan semua dependencies sudah terinstall
- Run `npm install` jika ada missing dependencies

## License

Part of ERMApp - Internal Use Only

## Support

Untuk pertanyaan atau issue, silakan hubungi tim development.
