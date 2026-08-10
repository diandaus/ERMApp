import React from 'react';
import { PegawaiView } from './Pegawai';
import { PetugasView } from './Petugas';
import { DokterView } from './Dokter';
import { PresensiRekapView } from './PresensiRekap';
import { JadwalPegawaiView } from './JadwalPegawai';
import { RekapKehadiranView } from './RekapKehadiran';
import { PengumumanKepegawaianView } from './PengumumanKepegawaian';
import { LemburKepegawaianView } from './LemburKepegawaian';
import { PengajuanCutiKepegawaianView } from './PengajuanCutiKepegawaian';

type KepegawaianTab = 'data-pegawai' | 'petugas' | 'dokter' | 'presensi' | 'jadwal-pegawai' | 'rekap-kehadiran' | 'pengajuan-cuti' | 'pengumuman' | 'lembur';

const MENU: { key: KepegawaianTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'data-pegawai',
    label: 'Data Pegawai',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    key: 'petugas',
    label: 'Petugas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <circle cx="9" cy="10" r="2"></circle>
        <path d="M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3"></path>
        <path d="M14 9h4"></path>
        <path d="M14 13h4"></path>
      </svg>
    ),
  },
  {
    key: 'dokter',
    label: 'Dokter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v6a4 4 0 0 0 8 0V3"></path>
        <path d="M10 15v2a4 4 0 0 0 8 0v-3a6 6 0 0 0-3-5.2"></path>
        <circle cx="20" cy="10" r="1.5"></circle>
      </svg>
    ),
  },
  {
    key: 'presensi',
    label: 'Presensi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>
    ),
  },
  {
    key: 'jadwal-pegawai',
    label: 'Jadwal Pegawai',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>
        <path d="M8 15h.01"></path><path d="M12 15h.01"></path><path d="M16 15h.01"></path>
      </svg>
    ),
  },
  {
    key: 'rekap-kehadiran',
    label: 'Rekap Kehadiran',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <path d="M16 2v4"></path>
        <path d="M8 2v4"></path>
        <path d="M3 10h18"></path>
        <path d="m9 16 2 2 4-4"></path>
      </svg>
    ),
  },
  {
    key: 'pengajuan-cuti',
    label: 'Pengajuan Cuti',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <path d="M16 2v4"></path>
        <path d="M8 2v4"></path>
        <path d="M3 10h18"></path>
        <path d="M9 16h6"></path>
      </svg>
    ),
  },
  {
    key: 'pengumuman',
    label: 'Pengumuman',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 14v-3z"></path>
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
      </svg>
    ),
  },
  {
    key: 'lembur',
    label: 'Lembur',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8"></circle>
        <path d="M12 9v4l2.5 2.5"></path>
        <path d="M9 2h6"></path>
      </svg>
    ),
  },
];

type KepegawaianViewProps = {
  onBack?: () => void;
};

export const KepegawaianView: React.FC<KepegawaianViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<KepegawaianTab>('data-pegawai');
  const activeLabel = MENU.find((m) => m.key === activeTab)?.label || '';

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
          background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Kepegawaian
          </div>
        </div>

        {/* Menu */}
        <nav className="kepegawaian-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
          <div style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>
            <span style={{ color: '#4338ca', fontWeight: 600 }}>Kepegawaian</span> / {activeLabel}
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #4338ca',
                background: '#4338ca',
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
          {activeTab === 'data-pegawai' && <PegawaiView />}
          {activeTab === 'petugas' && <PetugasView />}
          {activeTab === 'dokter' && <DokterView />}
          {activeTab === 'presensi' && <PresensiRekapView />}
          {activeTab === 'jadwal-pegawai' && <JadwalPegawaiView />}
          {activeTab === 'rekap-kehadiran' && <RekapKehadiranView />}
          {activeTab === 'pengajuan-cuti' && <PengajuanCutiKepegawaianView />}
          {activeTab === 'pengumuman' && <PengumumanKepegawaianView />}
          {activeTab === 'lembur' && <LemburKepegawaianView />}
        </div>
      </div>

      <style>{`
        .kepegawaian-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .kepegawaian-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .kepegawaian-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .kepegawaian-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .kepegawaian-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .kepegawaian-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
  );
};
