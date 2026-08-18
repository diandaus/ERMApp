import React from 'react';
import type { BookingOperasiRow } from './JadwalOperasi';

// ============================================================================
// KAMAR OPERASI (OK) — Detail Operasi Pasien, dibuka penuh layar dari klik
// No.Rawat di tabel JadwalOperasi.tsx (persis pola PemeriksaanRanapView
// dibuka dari RawatInap.tsx — bungkus position:fixed-nya ada di pemanggil,
// bukan di sini). Berisi dokumentasi khas kamar operasi: Site Marking,
// Laporan Operasi, Anestesi & Sedasi, Monitoring — belum ada skema
// backend/tabel utk field-field itu (menyusul sesuai spesifikasi), jadi
// tab-tab itu masih placeholder. Info pasien & operasi (data row yg sama
// dgn tabel, tidak perlu fetch ulang) semuanya ditaruh di kartu sidebar,
// bukan tab tersendiri lagi.
// ============================================================================

type Tab = 'site-marking' | 'laporan-operasi' | 'anestesi-sedasi' | 'monitoring';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'site-marking',
    label: 'Site Marking',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="4"></circle>
        <line x1="12" y1="2" x2="12" y2="5"></line>
        <line x1="12" y1="19" x2="12" y2="22"></line>
        <line x1="2" y1="12" x2="5" y2="12"></line>
        <line x1="19" y1="12" x2="22" y2="12"></line>
      </svg>
    ),
  },
  {
    key: 'laporan-operasi',
    label: 'Laporan Operasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>
        <path d="M14 2v6h6"></path>
        <path d="M9 15h6"></path>
        <path d="M9 11h6"></path>
      </svg>
    ),
  },
  {
    key: 'anestesi-sedasi',
    label: 'Anestesi & Sedasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 2 4 4"></path>
        <path d="m17 7 3-3"></path>
        <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"></path>
        <path d="m9 11 4 4"></path>
        <path d="m5 19-3 3"></path>
      </svg>
    ),
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    ),
  },
];

const tanggalIndo = (isoTanggal: string) => {
  const [y, m, d] = isoTanggal.split('-');
  if (!y || !m || !d) return isoTanggal;
  return `${d}-${m}-${y}`;
};

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff' }}>
    Formulir {title} sedang dalam pengembangan.
  </div>
);

type DetailOperasiPasienViewProps = {
  row: BookingOperasiRow;
  onBack: () => void;
};

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ fontSize: 12, color: '#374151' }}>{label} : {value || '-'}</div>
);

// Shell sidebar+header+body DIDUPLIKASI dari Apotek.tsx/BridgingBpjs.tsx
// (bukan diimpor) — pola yg sama dipakai di semua modul bersidebar di
// app ini, tiap file menyalin sendiri supaya tidak saling mempengaruhi.
export const DetailOperasiPasienView: React.FC<DetailOperasiPasienViewProps> = ({ row, onBack }) => {
  const [tab, setTab] = React.useState<Tab>('site-marking');
  const activeLabel = TABS.find((t) => t.key === tab)?.label || '';

  return (
    <section
      style={{
        background: '#F3F4F6',
        padding: 20,
        height: '100%',
        display: 'flex',
        gap: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Avatar + nama — di atas card, langsung di atas background
            gradient sidebar (bukan di dalam card putih lagi). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, padding: '8px 8px 16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 10, textAlign: 'center' }}>
            {row.nama_pasien}
          </div>
        </div>

        {/* Kartu info pasien & operasi — semua data (identitas pasien +
            detail booking operasi, sebelumnya di tab "Informasi Pasien"
            terpisah) ditaruh di sini. */}
        <div style={{ background: '#ffffff', borderRadius: 16, padding: '16px', marginBottom: 16, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', maxHeight: '70%' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <InfoLine label="No. Rawat" value={row.no_rawat} />
            <InfoLine label="No RM" value={row.no_rkm_medis} />
            <InfoLine label="Umur/Jk" value={`${row.umur}/${row.jk === 'L' ? 'Laki-laki' : row.jk === 'P' ? 'Perempuan' : '-'}`} />
            <InfoLine label="Alamat" value={row.alamat_pasien} />
          </div>

          <div style={{ width: '100%', borderTop: '1px solid #e5e7eb', margin: '14px 0' }} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <InfoLine label="Rujukan Dari" value={row.rujukan_dari} />
            <InfoLine label="Order" value={row.order} />
            <InfoLine label="Diagnosa" value={row.diagnosa} />
            <InfoLine label="Tanggal" value={tanggalIndo(row.tanggal)} />
            <InfoLine
              label="Jam"
              value={`${row.jam_mulai.slice(0, 5)}${row.jam_selesai && row.jam_selesai !== '00:00:00' ? ` - ${row.jam_selesai.slice(0, 5)}` : ''}`}
            />
            <InfoLine label="Ruang OK" value={`${row.kode_ok} - ${row.nama_ruang_operasi}`} />
            <InfoLine label="Operator" value={row.operator} />
            <InfoLine label="Operasi" value={row.operasi} />
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header — langsung di atas background, tanpa card */}
        <div
          style={{
            padding: '0 4px 16px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.no_rawat}</span> / {activeLabel}
          </div>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Kembali
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          <Placeholder title={activeLabel} />
        </div>
      </div>
    </section>
  );
};
