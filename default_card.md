# Default Card Pattern — ERMApp

Pola card standar yang digunakan di seluruh aplikasi. Gunakan sebagai acuan saat membuat halaman atau modal baru.

---

## 1. Halaman / View (non-modal)

```tsx
<div style={{
  background: '#F3F4F6',
  borderRadius: 20,
  padding: '35px 6px 6px 6px',
  position: 'relative',
}}>
  {/* Header Title */}
  <div style={{
    position: 'absolute',
    top: 0, left: 0, right: 0,
    padding: '12px 20px',
    color: '#000000',
    fontSize: 13,
    fontWeight: 400,
  }}>
    Judul Halaman
  </div>

  {/* White Card Content */}
  <div style={{
    background: '#ffffff',
    borderRadius: 16,
    border: '1px solid #d1d5db',
    padding: '12px',
  }}>
    {/* konten */}
  </div>
</div>
```

---

## 2. Modal / Dialog

```tsx
{/* Overlay */}
<div style={{
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
}} onClick={onClose}>

  {/* Modal Container */}
  <div style={{
    background: '#F3F4F6',
    borderRadius: 20,
    padding: '35px 8px 8px 8px',
    position: 'relative',
    maxWidth: 1000,
    width: '85%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }} onClick={e => e.stopPropagation()}>

    {/* Header — title + close button dalam satu baris flex, sejajar vertikal.
        Jangan pisah jadi dua elemen absolute yang saling menumpuk — elemen yang
        dirender belakangan akan menutupi & memblokir klik elemen di bawahnya. */}
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      padding: '8px 16px 8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>
        Judul Modal
      </span>
      <button type="button" onClick={onClose} style={{
        background: 'transparent',
        border: 'none',
        fontSize: 20,
        cursor: 'pointer',
        color: '#6b7280',
        padding: 0,
        lineHeight: 1,
      }}>×</button>
    </div>

    {/* White Card Content — scroll di sini saja, bukan di Modal Container,
        supaya header tidak ikut ter-scroll (tetap terlihat/fixed di atas). */}
    <div style={{
      background: '#ffffff',
      borderRadius: 16,
      border: '1px solid #d1d5db',
      padding: '12px',
      overflowY: 'auto',
      flex: 1,
      minHeight: 0,
    }}>
      {/* konten form */}

      {/* Footer Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onClose} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#dc2626', color: '#fff', cursor: 'pointer',
          fontSize: 12, fontWeight: 500,
        }}>Tutup</button>
        <button type="submit" style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#2563eb', color: '#fff', cursor: 'pointer',
          fontSize: 12, fontWeight: 500,
        }}>Simpan</button>
      </div>
    </div>
  </div>
</div>
```

---

## 3. Tab Navigation

### Segmented Control (default)
Digunakan di Registrasi, AntrianDashboard, ResepModal.

```tsx
<div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
  {tabs.map(tab => (
    <button key={tab} onClick={() => setActive(tab)} style={{
      padding: '6px 24px',
      borderRadius: 8,
      border: activeTab === tab ? '1px solid #2563eb' : '1px solid transparent',
      background: activeTab === tab ? '#ffffff' : 'transparent',
      color: activeTab === tab ? '#2563eb' : '#6b7280',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: activeTab === tab ? 600 : 400,
      transition: 'all 0.2s ease',
    }}>
      {tab}
    </button>
  ))}
</div>
```

### Underline Tab (alternatif)
Digunakan di PemeriksaanRanap, RawatJalan.

```tsx
<div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e5e7eb' }}>
  <button onClick={() => setActive(tab)} style={{
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    borderBottom: activeTab === tab ? '3px solid #1AB1E5' : '3px solid transparent',
    color: activeTab === tab ? '#1AB1E5' : '#6b7280',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    transition: 'all 0.2s',
  }}>
    Label Tab
  </button>
</div>
```

---

## 4. Tombol Aksi Standar

| Aksi    | Background | Contoh                          |
|---------|------------|---------------------------------|
| Simpan  | `#2563eb`  | `background: '#2563eb'`         |
| Tutup   | `#dc2626`  | `background: '#dc2626'`         |
| Info    | `#0ea5e9`  | `background: '#0ea5e9'`         |
| Sukses  | `#16a34a`  | `background: '#16a34a'`         |
| Netral  | `#6b7280`  | `background: '#6b7280'`         |

Semua tombol: `borderRadius: 8`, `fontSize: 12`, `fontWeight: 500`, `color: '#fff'`, `border: 'none'`

---

## 5. No. RM Button

```tsx
<span onClick={...} style={{
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 6,
  border: '1px solid #2563eb',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 11,
  background: '#2563eb',
}}>
  {no_rkm_medis}
</span>
```

---

## 6. Icon Cari / Pilih (Paperclip)

```tsx
<button type="button" onClick={...} style={{
  padding: '2px 2px', border: 'none',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
}}>
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
    viewBox="0 0 24 24" fill="none" stroke="#6b7280"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
</button>
```
