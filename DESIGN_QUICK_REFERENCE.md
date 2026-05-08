# Quick Reference - Design System ERMApp

Panduan cepat untuk developer. Untuk dokumentasi lengkap, lihat [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

---

## 🎨 Warna Paling Sering Digunakan

```tsx
// Primary
#2563eb   // Blue utama (button, link, highlight)
#1e40af   // Blue dark (hover, gradient)
#dbeafe   // Blue light background

// Success
#16a34a   // Green button
#ecfdf3   // Success message bg
#166534   // Success text

// Error
#dc2626   // Error/delete button
#fef2f2   // Error message bg
#b91c1c   // Error text

// Neutral
#ffffff   // White
#f9fafb   // Gray 50 (form bg, alt row)
#e5e7eb   // Gray 200 (border)
#d1d5db   // Gray 300 (input border)
#6b7280   // Gray 500 (caption text)
#374151   // Gray 700 (body text)
```

---

## 📏 Spacing Cepat

```tsx
4px   // space-1 (gap kecil)
8px   // space-3 (gap normal)
12px  // space-5 (margin field)
16px  // space-6 (gap besar)
24px  // space-8 (padding card)
```

---

## 🔤 Font Size

```tsx
10px  // Badge, label kecil
11px  // Button kecil, caption
12px  // Label input
13px  // MOST COMMON - body text, button
14px  // Heading kecil
20px  // Heading besar
```

---

## 🔘 Border Radius

```tsx
6px   // Button kecil
8px   // Input, dropdown
12px  // Card, table
16px  // Section card
999px // Pill button, badge
```

---

## ☁️ Shadows

```tsx
// Button/small
'0 2px 4px rgba(37, 99, 235, 0.2)'

// Dropdown/modal
'0 4px 12px rgba(0, 0, 0, 0.1)'

// Card/section
'0 10px 30px rgba(15, 23, 42, 0.08)'
```

---

## 📦 Copy-Paste Components

### Primary Button
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
    fontWeight: 600
  }}
>
  Button Text
</button>
```

### Success Button
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
  Success
</button>
```

### Outline Button
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
    fontWeight: 500
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
  Outline
</button>
```

### Input Field
```tsx
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
    Label
  </label>
  <input
    type="text"
    style={{
      width: '100%',
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid #d1d5db',
      fontSize: 13
    }}
  />
</div>
```

### Select Dropdown
```tsx
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
</select>
```

### Section Card
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
  {/* content */}
</section>
```

### Form Container
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
  {/* form fields */}
</form>
```

### Success Message
```tsx
<div
  style={{
    padding: 10,
    borderRadius: 8,
    background: '#ecfdf3',
    color: '#166534',
    fontSize: 13,
    marginBottom: 12
  }}
>
  Success message
</div>
```

### Error Message
```tsx
<div
  style={{
    padding: 8,
    borderRadius: 8,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 10
  }}
>
  Error message
</div>
```

### Status Badge
```tsx
{/* Success */}
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

{/* Warning */}
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

{/* Error */}
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
```

### Table
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
        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
          Header
        </th>
      </tr>
    </thead>
    <tbody>
      <tr style={{ background: '#ffffff' }}>
        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
          Data
        </td>
      </tr>
      {/* Alternating row */}
      <tr style={{ background: '#f9fafb' }}>
        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
          Data
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Tab Navigation
```tsx
<div
  style={{
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    borderBottom: '2px solid #e5e7eb'
  }}
>
  {/* Active */}
  <button
    style={{
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: '3px solid #2563eb',
      color: '#2563eb',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }}
  >
    Active Tab
  </button>

  {/* Inactive */}
  <button
    style={{
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: '3px solid transparent',
      color: '#6b7280',
      fontSize: 13,
      fontWeight: 400,
      cursor: 'pointer'
    }}
  >
    Inactive Tab
  </button>
</div>
```

### Page Header
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
      Page Title
    </h2>
    <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
      Description
    </p>
  </div>
  <button>{/* action button */}</button>
</div>
```

---

## 🔧 Menggunakan Design Tokens (TypeScript)

### Import
```tsx
import designTokens from '../styles/designTokens';

// Destructure yang dibutuhkan
const { colors, typography, spacing, componentStyles } = designTokens;
```

### Contoh Penggunaan
```tsx
// Gunakan component styles yang sudah ada
<button style={componentStyles.button.primary}>
  Submit
</button>

// Atau custom dengan tokens
<div
  style={{
    color: colors.primary.blue,
    fontSize: typography.fontSize.md,
    padding: spacing[4],
    borderRadius: borderRadius.md,
  }}
>
  Custom styled
</div>

// Helper functions
const statusStyle = designTokens.getStatusStyle('Sudah');
<span style={{ background: statusStyle.bg, color: statusStyle.color }}>
  {statusStyle.label}
</span>
```

---

## 📋 Checklist Form Baru

Saat membuat form baru, pastikan:

- [ ] Gunakan `#2563eb` untuk button utama
- [ ] Font size body text: `13px`
- [ ] Input border: `1px solid #d1d5db`
- [ ] Input border radius: `8px`
- [ ] Card padding: `24px`
- [ ] Card border radius: `16px`
- [ ] Spacing antar field: `10px` atau `12px`
- [ ] Label font size: `12px`
- [ ] Hover state pada button
- [ ] Error message dengan bg `#fef2f2` dan text `#b91c1c`
- [ ] Success message dengan bg `#ecfdf3` dan text `#166534`

---

## 🚀 Quick Start

1. **Lihat contoh lengkap**: Buka `frontend/src/components/ExampleForm.tsx`
2. **Copy paste component**: Gunakan snippets di atas
3. **Konsultasi design tokens**: Import dari `frontend/src/styles/designTokens.ts`
4. **Dokumentasi lengkap**: Lihat `DESIGN_SYSTEM.md`

---

## 💡 Tips

- **Font size paling sering**: 13px untuk body text
- **Warna paling sering**: #2563eb (blue), #16a34a (green), #6b7280 (gray text)
- **Border radius paling sering**: 8px (input), 12px (card kecil), 16px (section)
- **Button padding**: `8px 12px` dengan border radius `999px`
- **Hover**: Selalu gunakan `transition: 'all 0.2s ease'`

---

**File terkait:**
- 📖 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Dokumentasi lengkap
- 💾 [designTokens.ts](./frontend/src/styles/designTokens.ts) - Design tokens TypeScript
- 📝 [ExampleForm.tsx](./frontend/src/components/ExampleForm.tsx) - Contoh implementasi
- 🎨 [App.tsx](./frontend/src/modules/App.tsx) - Source implementasi asli
