import React from 'react';
import { DashboardApotekView } from './DashboardApotek';
import { ApotekDataBarangView } from './ApotekDataBarang';
import { ApotekPengaturanView } from './ApotekPengaturan';
import { ApotekStokOpnameView } from './ApotekStokOpname';
import { ApotekMutasiView } from './ApotekMutasi';
import { ApotekPermintaanView } from './ApotekPermintaan';
import { ApotekPenerimaanView } from './ApotekPenerimaan';
import { PengadaanView } from './Pengadaan';
import { PemesananApotekView } from './PemesananApotek';
import { PenggunaanObatView } from './PenggunaanObat';
import { ApotekPenjualanView } from './ApotekPenjualan';
import { ApotekReturBeliView } from './ApotekReturBeli';
import { ApotekReturJualView } from './ApotekReturJual';
import { ApotekRiwayatBarangMedisView } from './ApotekRiwayatBarangMedis';
import { ApotekDaruratStokView } from './ApotekDaruratStok';
import { ApotekObatKadaluarsaView } from './ApotekObatKadaluarsa';
import { DetailPemberianObatView } from './DetailPemberianObat';
import { PermintaanResepView } from './PermintaanResep';

type ApotekTab = 'overview' | 'data-barang' | 'stok-opname' | 'mutasi' | 'permintaan' | 'permintaan-resep' | 'penerimaan' | 'pengadaan' | 'pemesanan' | 'penggunaan-obat' | 'penjualan' | 'retur-beli' | 'retur-jual' | 'darurat-stok' | 'obat-kadaluarsa' | 'riwayat-barang-medis' | 'detail-pemberian-obat' | 'pengaturan';

const MENU: { key: ApotekTab; label: string; icon: React.ReactNode }[] = [
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
    key: 'penjualan',
    label: 'Input Penjualan Obat & BHP',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
    ),
  },
  {
    key: 'permintaan-resep',
    label: 'Permintaan Resep',
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
    key: 'data-barang',
    label: 'Data Barang',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
        <path d="M3.3 7 12 12l8.7-5"></path>
        <path d="M12 22V12"></path>
      </svg>
    ),
  },
  {
    key: 'stok-opname',
    label: 'Stok Opname',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
  },
  {
    key: 'mutasi',
    label: 'Mutasi Obat & BHP',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3 21 7 17 11"></path>
        <path d="M3 7h18"></path>
        <path d="M7 21 3 17 7 13"></path>
        <path d="M21 17H3"></path>
      </svg>
    ),
  },
  {
    key: 'permintaan',
    label: 'Permintaan Obat & BHP',
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
    key: 'penerimaan',
    label: 'Penerimaan Obat & BHP',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"></path>
        <path d="M12 15V3"></path>
        <path d="m7 10 5 5 5-5"></path>
      </svg>
    ),
  },
  {
    key: 'pengadaan',
    label: 'Pengadaan',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1"></rect>
      </svg>
    ),
  },
  {
    key: 'pemesanan',
    label: 'Pemesanan',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1"></circle>
        <circle cx="19" cy="21" r="1"></circle>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
      </svg>
    ),
  },
  {
    key: 'penggunaan-obat',
    label: 'Penggunaan Obat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path>
        <path d="m8.5 8.5 7 7"></path>
        <path d="M9 12.5 12.5 9"></path>
      </svg>
    ),
  },
  {
    key: 'retur-beli',
    label: 'Retur ke Suplier',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14 4 9l5-5"></path>
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path>
      </svg>
    ),
  },
  {
    key: 'retur-jual',
    label: 'Retur dari Pembeli',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14 20 9l-5-5"></path>
        <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"></path>
      </svg>
    ),
  },
  {
    key: 'darurat-stok',
    label: 'Darurat Stok',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
      </svg>
    ),
  },
  {
    key: 'obat-kadaluarsa',
    label: 'Obat Kadaluarsa',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3.5 2"></path>
      </svg>
    ),
  },
  {
    key: 'riwayat-barang-medis',
    label: 'Riwayat Obat, Alkes & BHP',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5"></path>
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
        <path d="M12 7v5l4 2"></path>
      </svg>
    ),
  },
  {
    key: 'detail-pemberian-obat',
    label: 'Detail Pemberian Obat',
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
// bawah sidebar (bukan bagian dari daftar navigasi utama) — pola yang
// sama dipakai BridgingBpjs.tsx.
const SETTINGS_ITEM: { key: ApotekTab; label: string; icon: React.ReactNode } = {
  key: 'pengaturan',
  label: 'Pengaturan',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

type ApotekViewProps = {
  onBack?: () => void;
};

export const ApotekView: React.FC<ApotekViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<ApotekTab>('overview');
  const activeLabel = [...MENU, SETTINGS_ITEM].find((m) => m.key === activeTab)?.label || '';

  // Ingat tab Apotek terakhir sebelum masuk ke Permintaan Resep (overlay
  // full-screen terpisah), supaya tombol back di PermintaanResepView
  // kembali ke tab yang sama persis (mis. "Input Penjualan Obat & BHP"),
  // bukan selalu reset ke Dashboard.
  const permintaanResepReturnTab = React.useRef<ApotekTab>('overview');
  React.useEffect(() => {
    if (activeTab !== 'permintaan-resep') {
      permintaanResepReturnTab.current = activeTab;
    }
  }, [activeTab]);
  const [resepRalanBelumCount, setResepRalanBelumCount] = React.useState(0);
  const [resepRanapBelumCount, setResepRanapBelumCount] = React.useState(0);
  const resepBelumTerlayaniCount = resepRalanBelumCount + resepRanapBelumCount;

  // Running text "Permintaan Resep Baru" — dihitung dari resep_obat yang
  // belum divalidasi/dilayani apotek (status "Belum Terlayani", padanan
  // status yang sama dipakai PermintaanResep.tsx), Ralan & Ranap dihitung
  // terpisah supaya bisa ditampilkan rinciannya. Auto-refresh tiap 10
  // detik (dipercepat dari 30 detik supaya badge lebih responsif).
  React.useEffect(() => {
    const fetchCount = () => {
      const statusQS = `status=${encodeURIComponent('Belum Terlayani')}`;
      fetch(`/api/permintaan-resep/ralan?${statusQS}`).then((res) => (res.ok ? res.json() : [])).catch(() => [])
        .then((data) => setResepRalanBelumCount(Array.isArray(data) ? data.length : 0));
      fetch(`/api/permintaan-resep/ranap?${statusQS}`).then((res) => (res.ok ? res.json() : [])).catch(() => [])
        .then((data) => setResepRanapBelumCount(Array.isArray(data) ? data.length : 0));
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Badge "Permintaan Obat & BHP" — dihitung dari permintaan_medis yang
  // masih berstatus "Baru" (belum disetujui/ditolak, padanan status yang
  // sama dipakai ApotekPermintaan.tsx), sama pola dengan badge Permintaan
  // Resep di atas.
  const [permintaanBaruCount, setPermintaanBaruCount] = React.useState(0);
  React.useEffect(() => {
    const fetchCount = () => {
      fetch(`/api/apotek/permintaan/riwayat?status=${encodeURIComponent('Baru')}`).then((res) => (res.ok ? res.json() : [])).catch(() => [])
        .then((data) => setPermintaanBaruCount(Array.isArray(data) ? data.length : 0));
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
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
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
              <path d="M10.5 20.5 20.5 10.5a4.95 4.95 0 1 0-7-7L3.5 13.5a4.95 4.95 0 1 0 7 7Z"></path>
              <path d="m8.5 8.5 7 7"></path>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Apotek
          </div>
        </div>

        {/* Menu — scrollbar disembunyikan default, cuma tampil tipis saat
            hover; padanan bpjs-sidebar-nav di BridgingBpjs.tsx (native
            scrollbar Windows/Chrome selalu tampil tebal karena bukan
            overlay scrollbar seperti Mac). */}
        <nav className="apotek-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const active = activeTab === item.key;
            const badgeCount =
              item.key === 'permintaan-resep' ? resepBelumTerlayaniCount :
              item.key === 'permintaan' ? permintaanBaruCount :
              0;
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
                {badgeCount > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 9,
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: 10.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {badgeCount}
                  </span>
                )}
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
          <div style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>Apotek</span> / {activeLabel}
          </div>

          {resepBelumTerlayaniCount > 0 && (() => {
            const runningText = `⚠ ${resepBelumTerlayaniCount} Permintaan Resep baru belum dilayani/divalidasi (Rawat Jalan: ${resepRalanBelumCount}, Rawat Inap: ${resepRanapBelumCount}) — klik untuk membuka Permintaan Resep`;
            return (
              <div
                onClick={() => setActiveTab('permintaan-resep')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  margin: '0 16px',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: '6px 0',
                  cursor: 'pointer',
                }}
                title="Klik untuk buka Permintaan Resep"
              >
                <style>{`
                  @keyframes apotekRunningText {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                  }
                `}</style>
                {/* Dua salinan teks berdampingan, digeser tepat -50% dari
                    lebar total (= lebar satu salinan) — begitu salinan
                    pertama hilang di kiri, salinan kedua sudah pas
                    menempati posisi awal, jadi looping mulus tanpa jeda/
                    lompatan, teks langsung "muncul" dari kanan real-time. */}
                <div
                  style={{
                    display: 'flex',
                    width: 'max-content',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#92400e',
                    animation: 'apotekRunningText 14s linear infinite',
                  }}
                >
                  <span style={{ paddingRight: 64 }}>{runningText}</span>
                  <span style={{ paddingRight: 64 }} aria-hidden="true">{runningText}</span>
                </div>
              </div>
            );
          })()}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #059669',
                background: '#059669',
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

        {/* Body — tab "penjualan" & "overview" (Dashboard) sengaja dilepas
            dari panel putih ini (background/shadow/borderRadius ditiadakan)
            supaya card-card mereka duduk langsung di background abu-abu
            halaman, benar-benar independen, bukan bersarang di dalam panel
            bersama yang dipakai tab-tab Apotek lain. Padding tetap dipakai
            utk overview (StatCard butuh jarak dari tepi), beda dari
            penjualan yang padding-nya 0 karena sudah diatur sendiri oleh
            layout kiri/kanannya. */}
        <div
          style={{
            padding: activeTab === 'penjualan' ? 0 : 24,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: activeTab === 'penjualan' || activeTab === 'overview' ? 'transparent' : '#ffffff',
            borderRadius: activeTab === 'penjualan' || activeTab === 'overview' ? 0 : 24,
            boxShadow: activeTab === 'penjualan' || activeTab === 'overview' ? 'none' : '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          {activeTab === 'overview' && (
            <DashboardApotekView
              onNavigateStokMenipis={() => setActiveTab('darurat-stok')}
              onNavigatePenjualan={() => setActiveTab('penjualan')}
              onNavigatePenerimaan={() => setActiveTab('penerimaan')}
              onNavigateKadaluarsa={() => setActiveTab('obat-kadaluarsa')}
              onNavigateStokOpname={() => setActiveTab('stok-opname')}
              onNavigateMutasi={() => setActiveTab('mutasi')}
            />
          )}
          {activeTab === 'data-barang' && <ApotekDataBarangView />}
          {activeTab === 'stok-opname' && <ApotekStokOpnameView />}
          {activeTab === 'mutasi' && <ApotekMutasiView />}
          {activeTab === 'permintaan' && <ApotekPermintaanView />}
          {activeTab === 'penerimaan' && <ApotekPenerimaanView />}
          {activeTab === 'pengadaan' && <PengadaanView />}
          {activeTab === 'pemesanan' && <PemesananApotekView />}
          {activeTab === 'penggunaan-obat' && <PenggunaanObatView />}
          {activeTab === 'penjualan' && <ApotekPenjualanView />}
          {activeTab === 'retur-beli' && <ApotekReturBeliView />}
          {activeTab === 'retur-jual' && <ApotekReturJualView />}
          {activeTab === 'darurat-stok' && <ApotekDaruratStokView />}
          {activeTab === 'obat-kadaluarsa' && <ApotekObatKadaluarsaView />}
          {activeTab === 'riwayat-barang-medis' && <ApotekRiwayatBarangMedisView />}
          {activeTab === 'detail-pemberian-obat' && <DetailPemberianObatView />}
          {activeTab === 'pengaturan' && <ApotekPengaturanView />}
        </div>
      </div>

      <style>{`
        .apotek-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .apotek-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .apotek-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .apotek-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .apotek-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .apotek-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
    {activeTab === 'permintaan-resep' && <PermintaanResepView onClose={() => setActiveTab(permintaanResepReturnTab.current)} />}
    </>
  );
};
