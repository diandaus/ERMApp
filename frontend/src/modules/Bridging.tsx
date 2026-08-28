import React from 'react';
import { SatuSehatView } from './SatuSehat';
import { BridgingBpjsView } from './BridgingBpjs';
import { PeruriView } from './Peruri';

type BridgingTab = 'bpjs' | 'satu-sehat' | 'orthanc' | 'peruri';

const TABS: { key: BridgingTab; label: string; icon: string }[] = [
  { key: 'bpjs', label: 'BPJS', icon: '🏥' },
  { key: 'satu-sehat', label: 'Satu Sehat', icon: '🏛️' },
  { key: 'orthanc', label: 'Orthanc', icon: '🩻' },
  { key: 'peruri', label: 'Peruri', icon: '🔏' },
];

export const BridgingView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<BridgingTab | null>(null);

  // BPJS & Satu Sehat punya layout sendiri (sidebar + full layar), lepas dari
  // shell aplikasi sepenuhnya — persis pola PemeriksaanRanapView yang dibuka
  // dari RawatInap.tsx.
  if (activeTab === 'bpjs') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
        <BridgingBpjsView onBack={() => setActiveTab(null)} />
      </div>
    );
  }
  if (activeTab === 'satu-sehat') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
        <SatuSehatView onBack={() => setActiveTab(null)} />
      </div>
    );
  }
  if (activeTab === 'peruri') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
        <PeruriView onBack={() => setActiveTab(null)} />
      </div>
    );
  }

  // Sub-halaman penuh setelah salah satu kartu diklik — grid tidak lagi terlihat.
  // Kembali ke grid dengan klik menu "Bridging" di sidebar (bukan tombol kembali).
  if (activeTab) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'orthanc' && (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              Fitur Bridging Orthanc akan dikembangkan nanti.
            </div>
          )}
        </div>
      </section>
    );
  }

  // Grid kartu — persis pola halaman Menu Utama (default_card.md), bisa
  // bertambah kartu lain nanti tinggal tambah entri di array TABS.
  return (
    <div
      style={{
        background: '#F3F4F6',
        borderRadius: 20,
        padding: '35px 6px 6px 6px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400,
        }}
      >
        Bridging
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
            gap: 4,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 8px 10px',
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                {tab.icon}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#111827',
                  lineHeight: 1.35,
                  wordBreak: 'break-word',
                }}
              >
                {tab.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
