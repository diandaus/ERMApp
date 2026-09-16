import React from 'react';
import { TarifLabView } from './TarifLab';

// TarifPelayananView — menu utama "Tarif Pelayanan", layout full-screen
// (sidebar + header + body) PERSIS pola ApotekView (Apotek.tsx): sidebar
// gradient dgn daftar sub-menu, header breadcrumb + tombol kembali, body
// panel putih. Cuma "Tarif Lab" yg sudah fungsional (CRUD template
// parameter template_laboratorium, lihat TarifLab.tsx) — sub-menu lain
// (Kamar/Tarif Ralan/Tarif Ranap/Tarif Rad) masih placeholder "Dalam
// Pengembangan" per permintaan user, menyusul nanti satu per satu.

type TarifTab = 'kamar' | 'tarif-ralan' | 'tarif-ranap' | 'tarif-lab' | 'tarif-rad';

const MENU: { key: TarifTab; label: string; soon?: boolean; icon: React.ReactNode }[] = [
  {
    key: 'kamar',
    label: 'Kamar',
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    ),
  },
  {
    key: 'tarif-ralan',
    label: 'Tarif Ralan',
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    key: 'tarif-ranap',
    label: 'Tarif Ranap',
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    key: 'tarif-lab',
    label: 'Tarif Lab',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3v10.5L5.5 19c-.5.9-.5 2 .5 2.5h12c1 -.5 1-1.6.5-2.5L15 13.5V3"></path>
        <path d="M6.5 16h11"></path>
        <path d="M9 3h6"></path>
      </svg>
    ),
  },
  {
    key: 'tarif-rad',
    label: 'Tarif Rad',
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="12" cy="8" r="2"></circle>
        <path d="M12 10v4"></path>
        <path d="M10 14h4"></path>
        <path d="M9 18l3-2 3 2"></path>
      </svg>
    ),
  },
];

type TarifPelayananViewProps = {
  onBack?: () => void;
};

export const TarifPelayananView: React.FC<TarifPelayananViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<TarifTab>('tarif-lab');
  const activeItem = MENU.find((m) => m.key === activeTab);

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
          background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
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
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Tarif Pelayanan
          </div>
        </div>

        {/* Menu */}
        <nav className="tarif-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
                {item.soon && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 9.5,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.18)',
                      color: 'rgba(255,255,255,0.85)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Segera
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            padding: '0 4px 16px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>
            <span style={{ color: '#5b21b6', fontWeight: 600 }}>Tarif Pelayanan</span> / {activeItem?.label}
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #5b21b6',
                background: '#5b21b6',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Ke Halaman Utama
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
          {activeTab === 'tarif-lab' ? (
            <TarifLabView />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9ca3af' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{activeItem?.label} — Dalam Pengembangan</div>
              <div style={{ fontSize: 12.5, textAlign: 'center', maxWidth: 320 }}>Fitur ini akan menyusul setelah Tarif Lab selesai.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tarif-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .tarif-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .tarif-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .tarif-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .tarif-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .tarif-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
  );
};
