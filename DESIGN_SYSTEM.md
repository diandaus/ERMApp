# Design System - ERMApp

Dokumentasi ini berisi panduan tema desain utama yang digunakan di ERMApp, berdasarkan implementasi di `App.tsx`. Gunakan panduan ini sebagai referensi untuk membuat form dan komponen baru agar konsisten dengan desain keseluruhan aplikasi.

---

## 1. Color Palette (Palet Warna)

### Primary Colors (Warna Utama)
```css
/* Blue - Warna utama aplikasi */
--primary-blue: #2563eb;
--primary-blue-dark: #1e40af;
--primary-blue-hover: #1d4ed8;

/* Blue Backgrounds */
--blue-50: #eff6ff;
--blue-100: #dbeafe;
--blue-200: #e0f2fe;
--blue-300: #eef2ff;
```

### Success Colors (Warna Sukses)
```css
--success-green: #16a34a;
--success-bg: #ecfdf3;
--success-text: #166534;
```

### Warning Colors (Warna Peringatan)
```css
--warning-bg: #fef3c7;
--warning-text: #92400e;
```

### Error Colors (Warna Error)
```css
--error-red: #dc2626;
--error-red-dark: #b91c1c;
--error-red-darker: #991b1b;
--error-bg: #fef2f2;
--error-bg-alt: #fee2e2;
```

### Purple Colors (Warna Ungu)
```css
--purple-bg: #f3e8ff;
--purple-text: #6b21a8;
```

### Neutral Colors (Warna Netral)
```css
/* Grayscale */
--white: #ffffff;
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1e293b;
--gray-900: #111827;
--black: #000000;
```

### Status Colors
```css
/* Status Badge Colors */
--status-sudah-bg: #ecfdf3;
--status-sudah-text: #166534;

--status-belum-bg: #fef3c7;
--status-belum-text: #92400e;

--status-batal-bg: #fee2e2;
--status-batal-text: #991b1b;

--status-dirujuk-bg: #dbeafe;
--status-dirujuk-text: #1e40af;

--status-dirawat-bg: #f3e8ff;
--status-dirawat-text: #6b21a8;
```

---

## 2. Typography (Tipografi)

### Font Family
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Font Sizes
```css
--text-xs: 10px;    /* Extra small - untuk badge, label kecil */
--text-sm: 11px;    /* Small - untuk caption, metadata */
--text-base: 12px;  /* Base - untuk label input, teks kecil */
--text-md: 13px;    /* Medium - PALING SERING DIGUNAKAN untuk body text */
--text-lg: 14px;    /* Large - untuk heading kecil */
--text-xl: 15px;    /* Extra large - untuk heading */
--text-2xl: 16px;   /* 2X large - untuk icon */
--text-3xl: 20px;   /* 3X large - untuk heading besar */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Typography Usage Examples
```tsx
// Page Title
<h2 style={{ margin: '4px 0', fontSize: 20, fontWeight: 600 }}>
  Judul Halaman
</h2>

// Section Title
<h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
  Judul Seksi
</h3>

// Body Text (most common)
<p style={{ fontSize: 13, color: '#374151' }}>
  Teks isi konten
</p>

// Small Text / Caption
<span style={{ fontSize: 12, color: '#6b7280' }}>
  Teks kecil atau keterangan
</span>

// Label
<label style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: '#2563eb', textTransform: 'uppercase' }}>
  LABEL HEADER
</label>
```

---

## 3. Spacing (Jarak)

### Spacing Scale
```css
--space-1: 4px;
--space-2: 6px;
--space-3: 8px;
--space-4: 10px;
--space-5: 12px;
--space-6: 16px;
--space-7: 20px;
--space-8: 24px;
--space-9: 32px;
```

### Common Spacing Patterns
```tsx
// Card/Section padding
padding: 24px

// Form field margin
marginBottom: 10px atau 12px

// Gap between elements
gap: 8px, 12px, atau 16px

// Small internal spacing
padding: '6px 8px'  // vertical horizontal

// Button padding
padding: '8px 12px'
```

---

## 4. Border Radius (Kelengkungan)

```css
--radius-sm: 6px;     /* Small - untuk button kecil */
--radius-md: 8px;     /* Medium - untuk input, card kecil */
--radius-lg: 10px;    /* Large - untuk button menu */
--radius-xl: 12px;    /* Extra large - untuk card, dropdown */
--radius-2xl: 15px;   /* 2X large - untuk section utama */
--radius-3xl: 16px;   /* 3X large - untuk card besar */
--radius-round: 25px; /* Rounded - untuk search input */
--radius-pill: 999px; /* Pill - untuk button, badge */
```

---

## 5. Shadows (Bayangan)

```css
/* Small shadow - untuk button, badge */
box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);

/* Medium shadow - untuk dropdown, modal kecil */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

/* Large shadow - untuk card, modal */
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);

/* Extra large shadow - untuk login card */
box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
```

---

## 6. Component Styles (Gaya Komponen)

### 6.1 Buttons

#### Primary Button
```tsx
<button
  style={{
    padding: '8px 12px',
    borderRadius: 999,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.2s ease'
  }}
>
  Primary Button
</button>
```

#### Success Button
```tsx
<button
  style={{
    padding: '8px 12px',
    borderRadius: 999,
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500
  }}
>
  Success Button
</button>
```

#### Danger Button (for delete/critical actions)
```tsx
<button
  style={{
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: '#ef4444',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500
  }}
>
  Hapus
</button>
```

#### Secondary/Outline Button
```tsx
<button
  style={{
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #2563eb',
    background: '#ffffff',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    transition: 'all 0.2s ease'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = '#2563eb';
    e.currentTarget.style.color = '#ffffff';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = '#ffffff';
    e.currentTarget.style.color = '#2563eb';
  }}
>
  Outline Button
</button>
```

#### Disabled Button
```tsx
<button
  disabled={true}
  style={{
    padding: '8px 12px',
    borderRadius: 999,
    border: 'none',
    background: '#9ca3af',
    color: '#fff',
    cursor: 'default',
    fontSize: 13,
    fontWeight: 600
  }}
>
  Disabled
</button>
```

### 6.2 Input Fields

#### Text Input
```tsx
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
    Label
  </label>
  <input
    type="text"
    placeholder="Placeholder text"
    style={{
      width: '100%',
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid #d1d5db',
      fontSize: 13,
      outline: 'none'
    }}
  />
</div>
```

#### Select Dropdown
```tsx
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
    Pilih Opsi
  </label>
  <select
    style={{
      width: '100%',
      padding: '6px 8px',
      borderRadius: 8,
      border: '1px solid #d1d5db',
      fontSize: 13
    }}
  >
    <option value="">Pilih...</option>
    <option value="1">Opsi 1</option>
  </select>
</div>
```

#### Date Input
```tsx
<input
  type="date"
  style={{
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 12,
    boxSizing: 'border-box'
  }}
/>
```

#### Search Input with Icon
```tsx
<div style={{ position: 'relative', width: 250 }}>
  <div style={{
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    zIndex: 1
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  </div>
  <input
    type="text"
    placeholder="Cari..."
    style={{
      width: '100%',
      padding: '6px 12px 6px 34px',
      borderRadius: 25,
      border: '1px solid #d1d5db',
      fontSize: 12,
      outline: 'none'
    }}
  />
</div>
```

### 6.3 Cards & Sections

#### Main Section Card
```tsx
<section
  style={{
    background: '#ffffff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
    border: '1px solid #e5e7eb'
  }}
>
  {/* Content */}
</section>
```

#### Form Container
```tsx
<form
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontSize: 13
  }}
>
  {/* Form fields */}
</form>
```

#### Info Box (Success)
```tsx
<div
  style={{
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    background: '#ecfdf3',
    color: '#166534',
    fontSize: 13
  }}
>
  Pesan sukses di sini
</div>
```

#### Error Box
```tsx
<div
  style={{
    marginBottom: 10,
    padding: 8,
    borderRadius: 8,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13
  }}
>
  Pesan error di sini
</div>
```

### 6.4 Status Badges

```tsx
// Status Badge - Sudah
<span
  style={{
    padding: '2px 8px',
    borderRadius: 999,
    background: '#ecfdf3',
    color: '#166534',
    fontSize: 11,
    fontWeight: 500
  }}
>
  Sudah
</span>

// Status Badge - Belum
<span
  style={{
    padding: '2px 8px',
    borderRadius: 999,
    background: '#fef3c7',
    color: '#92400e',
    fontSize: 11,
    fontWeight: 500
  }}
>
  Belum
</span>

// Status Badge - Batal
<span
  style={{
    padding: '2px 8px',
    borderRadius: 999,
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: 11,
    fontWeight: 500
  }}
>
  Batal
</span>

// Role Badge
<span
  style={{
    padding: '2px 8px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#2563eb',
    fontSize: 10,
    fontWeight: 600
  }}
>
  Admin
</span>
```

### 6.5 Tables

```tsx
<div
  style={{
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'auto',
    maxHeight: 600
  }}
>
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 12
    }}
  >
    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
      <tr>
        <th style={{
          padding: '8px',
          textAlign: 'left',
          borderBottom: '2px solid #e5e7eb',
          fontWeight: 600,
          color: '#374151'
        }}>
          Header 1
        </th>
        {/* More headers */}
      </tr>
    </thead>
    <tbody>
      <tr style={{ background: '#ffffff' }}>
        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
          Data
        </td>
        {/* More cells */}
      </tr>
      {/* Alternating row color */}
      <tr style={{ background: '#f9fafb' }}>
        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
          Data
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 6.6 Tabs

```tsx
<div
  style={{
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    borderBottom: '2px solid #e5e7eb',
    alignItems: 'flex-end',
    flexWrap: 'wrap'
  }}
>
  {/* Active Tab */}
  <button
    style={{
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: '3px solid #2563eb',
      color: '#2563eb',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'all 0.2s'
    }}
  >
    Tab Aktif
  </button>

  {/* Inactive Tab */}
  <button
    style={{
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: '3px solid transparent',
      color: '#6b7280',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 400,
      transition: 'all 0.2s'
    }}
  >
    Tab Tidak Aktif
  </button>
</div>
```

### 6.7 Dropdowns

```tsx
<div
  style={{
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    padding: 12,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    zIndex: 100,
    minWidth: 180
  }}
>
  {/* Dropdown items */}
  <button
    style={{
      display: 'block',
      width: '100%',
      padding: '8px 12px',
      border: 'none',
      background: 'transparent',
      color: '#374151',
      fontSize: 12,
      textAlign: 'left',
      cursor: 'pointer',
      borderRadius: 8,
      transition: 'all 0.15s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#dbeafe';
      e.currentTarget.style.color = '#2563eb';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = '#374151';
    }}
  >
    Menu Item
  </button>
</div>
```

### 6.8 Modal / Large Dropdown

```tsx
<div
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  }}
>
  <div
    style={{
      background: '#ffffff',
      borderRadius: 16,
      padding: 24,
      maxWidth: 500,
      width: '90%',
      boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
      border: '1px solid #e5e7eb'
    }}
  >
    {/* Modal content */}
  </div>
</div>
```

---

## 7. Layout Components

### 7.1 Page Header
```tsx
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  }}
>
  <div>
    <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 20, fontWeight: 600 }}>
      Judul Halaman
    </h2>
    <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
      Deskripsi singkat halaman
    </p>
  </div>
  <button>{/* Action button */}</button>
</div>
```

### 7.2 Sidebar Menu Item
```tsx
<button
  style={{
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    marginBottom: 4,
    borderRadius: 10,
    border: 'none',
    background: '#2563eb',  // active
    color: '#ffffff',       // active
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,        // active (400 for inactive)
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    transition: 'all 0.2s ease'
  }}
>
  <span style={{ fontSize: 16 }}>🏥</span>
  <span>Menu Item</span>
</button>
```

### 7.3 User Avatar Button
```tsx
<button
  style={{
    width: 32,
    height: 32,
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #2563eb, #1e40af)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'scale(1.05)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = 'none';
  }}
>
  AB
</button>
```

---

## 8. Background & Gradients

### Main Background
```tsx
// Login page background
background: 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)'

// Main content background
background: '#F9FAFB'

// Card/Section background
background: '#ffffff'

// Form background
background: '#f9fafb'
```

### Gradient Buttons
```tsx
// User avatar gradient
background: 'linear-gradient(135deg, #2563eb, #1e40af)'
```

---

## 9. Icons

### SVG Icon Style
```tsx
// Primary icon (blue)
<svg
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="#2563eb"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  {/* icon paths */}
</svg>

// Current color icon (inherits parent color)
<svg
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2.5"
>
  {/* icon paths */}
</svg>
```

---

## 10. Transitions & Hover Effects

### Button Hover
```tsx
transition: 'all 0.2s ease'

onMouseEnter={(e) => {
  e.currentTarget.style.background = '#2563eb';
  e.currentTarget.style.color = '#ffffff';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.background = '#ffffff';
  e.currentTarget.style.color = '#2563eb';
}}
```

### Hover for Sidebar Menu (inactive)
```tsx
onMouseEnter={(e) => {
  if (!active) {
    e.currentTarget.style.background = '#f3f4f6';
  }
}}
onMouseLeave={(e) => {
  if (!active) {
    e.currentTarget.style.background = 'transparent';
  }
}}
```

### Hover for Danger Actions
```tsx
onMouseEnter={(e) => {
  e.currentTarget.style.background = '#fef2f2';
  e.currentTarget.style.color = '#ef4444';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = '#374151';
}}
```

---

## 11. Login Page Design

```tsx
<div
  style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }}
>
  <div
    style={{
      width: 360,
      maxWidth: '90%',
      background: '#ffffff',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 20px 40px rgba(15,23,42,0.15)',
      border: '1px solid rgba(148,163,184,0.25)'
    }}
  >
    {/* Login form content */}
  </div>
</div>
```

---

## 12. Best Practices

### Consistency Rules
1. **Selalu gunakan warna dari palet yang sudah ditentukan**
2. **Font size yang paling sering digunakan: 13px** untuk body text
3. **Border radius: 8px untuk input, 12px untuk card, 999px untuk button**
4. **Spacing: gunakan kelipatan 4px (4, 8, 12, 16, 24, dll)**
5. **Shadow: sesuaikan dengan ukuran komponen (kecil → medium → large)**

### Hover States
- Semua elemen interaktif (button, link, menu) harus punya hover state
- Gunakan `transition: 'all 0.2s ease'` untuk animasi smooth
- Hover pada button outline: background jadi solid, color jadi white

### Form Design
- Label selalu di atas input field
- Font size label: 12px
- Font size input: 13px
- Input padding: `'6px 10px'` atau `'6px 8px'`
- Margin bottom antar field: 10px atau 12px

### Table Design
- Sticky header dengan `position: 'sticky', top: 0`
- Alternating row colors: white (#ffffff) dan gray-50 (#f9fafb)
- Border pada cell: `borderBottom: '1px solid #e5e7eb'`
- Header border lebih tebal: `borderBottom: '2px solid #e5e7eb'`

### Status Colors
- **Sudah/Success**: Green (#ecfdf3 bg, #166534 text)
- **Belum/Warning**: Yellow (#fef3c7 bg, #92400e text)
- **Batal/Error**: Red (#fee2e2 bg, #991b1b text)
- **Dirujuk**: Blue (#dbeafe bg, #1e40af text)
- **Dirawat**: Purple (#f3e8ff bg, #6b21a8 text)

---

## 13. Example: Complete Form Component

```tsx
const ExampleForm = () => {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 20, fontWeight: 600 }}>
            Judul Form
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
            Deskripsi singkat form ini
          </p>
        </div>
        <button
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            border: 'none',
            background: '#16a34a',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Form */}
      <form
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          padding: 16,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 13,
          marginBottom: 16
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Field 1
          </label>
          <input
            type="text"
            placeholder="Contoh input"
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Field 2
          </label>
          <select
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13
            }}
          >
            <option value="">Pilih...</option>
            <option value="1">Opsi 1</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="submit"
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Simpan
          </button>
        </div>
      </form>

      {/* Table */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          overflow: 'auto',
          maxHeight: 600
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12
          }}
        >
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
                Kolom 1
              </th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
                Kolom 2
              </th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Data 1</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Data 2</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#ecfdf3',
                    color: '#166534',
                    fontSize: 11,
                    fontWeight: 500
                  }}
                >
                  Aktif
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
```

---

## 14. Quick Reference: Common Patterns

### Primary Blue Button
```tsx
padding: '8px 12px', borderRadius: 999, border: 'none',
background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600
```

### Success Green Button
```tsx
padding: '8px 12px', borderRadius: 999, border: 'none',
background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 500
```

### Outline Button
```tsx
padding: '4px 8px', borderRadius: 6, border: '1px solid #2563eb',
background: '#ffffff', color: '#2563eb', fontSize: 11, fontWeight: 500
```

### Input Field
```tsx
width: '100%', padding: '6px 10px', borderRadius: 8,
border: '1px solid #d1d5db', fontSize: 13
```

### Section Card
```tsx
background: '#ffffff', borderRadius: 16, padding: 24,
boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb'
```

### Success Message
```tsx
padding: 10, borderRadius: 8, background: '#ecfdf3',
color: '#166534', fontSize: 13
```

### Error Message
```tsx
padding: 10, borderRadius: 8, background: '#fef2f2',
color: '#b91c1c', fontSize: 13
```

---

**Catatan:** Dokumentasi ini dibuat berdasarkan analisis kode di `App.tsx`. Untuk konsistensi, selalu rujuk ke dokumentasi ini saat membuat komponen atau form baru di aplikasi ERMApp.

**Terakhir diperbarui:** 4 Maret 2026
