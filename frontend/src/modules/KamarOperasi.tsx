import React from 'react';
import { JadwalOperasiView } from './JadwalOperasi';
import { PenandaanOperasiView } from './PenandaanOperasi';
import { LaporanOperasiView } from './LaporanOperasi';

// Menu sidebar masih minim — item lain menyusul sesuai kebutuhan yang
// akan diberitahu kemudian, tinggal tambah entri baru di MENU + tab
// baru di KamarOperasiTab, persis pola BridgingBpjs.tsx/Apotek.tsx.
type KamarOperasiTab = 'overview' | 'jadwal-operasi' | 'penandaan-operasi' | 'laporan-operasi' | 'pengaturan';

const MENU: { key: KamarOperasiTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'overview',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
      </svg>
    ),
  },
  {
    key: 'jadwal-operasi',
    label: 'Jadwal Operasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    key: 'penandaan-operasi',
    label: 'Penandaan Operasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
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
];

// Dipisah dari MENU utama, ditampilkan sebagai footer di bagian paling
// bawah sidebar (bukan bagian dari daftar navigasi utama) — sama
// seperti BridgingBpjs.tsx/Apotek.tsx.
const SETTINGS_ITEM: { key: KamarOperasiTab; label: string; icon: React.ReactNode } = {
  key: 'pengaturan',
  label: 'Pengaturan',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff' }}>
    Fitur {title} akan dikembangkan nanti.
  </div>
);

type KamarOperasiViewProps = {
  onBack?: () => void;
};

export const KamarOperasiView: React.FC<KamarOperasiViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<KamarOperasiTab>('overview');
  const activeLabel = [...MENU, SETTINGS_ITEM].find((m) => m.key === activeTab)?.label || '';

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
          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Kamar Operasi (OK)
          </div>
        </div>

        {/* Menu — scrollbar disembunyikan default, cuma muncul tipis saat
            hover, sama seperti BridgingBpjs.tsx/Apotek.tsx (lihat komentar
            di sana soal scrollbar native Windows/Chrome). */}
        <nav className="kamar-operasi-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
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
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer — Pengaturan, terpisah dari daftar menu utama */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
          {(() => {
            const active = activeTab === SETTINGS_ITEM.key;
            return (
              <button
                type="button"
                onClick={() => setActiveTab(SETTINGS_ITEM.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
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
                {SETTINGS_ITEM.icon}
                {SETTINGS_ITEM.label}
              </button>
            );
          })()}
        </div>
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
            <span style={{ color: '#ec4899', fontWeight: 600 }}>Kamar Operasi (OK)</span> / {activeLabel}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #ec4899',
                background: '#ec4899',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Tutup
            </button>
          )}
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
          {activeTab === 'overview' && <Placeholder title="Dashboard Kamar Operasi (OK)" />}
          {activeTab === 'jadwal-operasi' && <JadwalOperasiView />}
          {activeTab === 'penandaan-operasi' && <PenandaanOperasiView />}
          {activeTab === 'laporan-operasi' && <LaporanOperasiView />}
          {activeTab === 'pengaturan' && <Placeholder title="Pengaturan Kamar Operasi (OK)" />}
        </div>
      </div>

      <style>{`
        .kamar-operasi-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .kamar-operasi-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .kamar-operasi-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .kamar-operasi-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .kamar-operasi-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .kamar-operasi-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
  );
};
