import React from 'react';
import { ApotekLamaPelayananView } from './ApotekLamaPelayanan';

// Tab "Dashboard" (key 'overview') di sidebar Apotek — dipisah dari
// Apotek.tsx supaya file induk tidak terus membengkak tiap tab baru
// ditambahkan (pola sama dengan ApotekDataBarang.tsx dkk, masing-masing
// sub-halaman modul Apotek sudah punya file sendiri; Dashboard tinggal
// satu-satunya yang masih inline sebelum dipindah di sini).
// stokMenipisCount/penjualanHariIniCount di-fetch sendiri di sini (bukan
// dari Apotek.tsx) karena cuma dipakai oleh StatCard masing-masing — beda
// dari resepBelumTerlayaniCount yang tetap tinggal di Apotek.tsx karena
// juga dipakai running-text banner sidebar.

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; onClick?: () => void }> = ({ label, value, icon, onClick }) => (
  <div
    onClick={onClick}
    style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, cursor: onClick ? 'pointer' : 'default' }}
  >
    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e6f7ee', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value}</div>
  </div>
);

// KADALUARSA_HARI — ambang "akan kadaluarsa" utk StatCard, 7 bulan
// (7×30 hari) dikirim sebagai query ?hari= ke /api/apotek/obat-kadaluarsa
// (endpoint yang sama dipakai tab "Obat Kadaluarsa", defaultnya 90 hari —
// di dashboard sengaja lebih longgar/dini supaya apoteker lihat peringatan
// lebih awal).
const KADALUARSA_HARI = 210;

type DashboardApotekProps = {
  onNavigateStokMenipis: () => void;
  onNavigatePenjualan: () => void;
  onNavigatePenerimaan: () => void;
  onNavigateKadaluarsa: () => void;
  onNavigateStokOpname: () => void;
  onNavigateMutasi: () => void;
};

export const DashboardApotekView: React.FC<DashboardApotekProps> = ({
  onNavigateStokMenipis,
  onNavigatePenjualan,
  onNavigatePenerimaan,
  onNavigateKadaluarsa,
  onNavigateStokOpname,
  onNavigateMutasi,
}) => {
  const [stokMenipisCount, setStokMenipisCount] = React.useState<number | null>(null);
  const [penjualanHariIniCount, setPenjualanHariIniCount] = React.useState<number | null>(null);
  const [penerimaanHariIniCount, setPenerimaanHariIniCount] = React.useState<number | null>(null);
  const [kadaluarsaCount, setKadaluarsaCount] = React.useState<number | null>(null);
  const [stokOpnameBulanIniCount, setStokOpnameBulanIniCount] = React.useState<number | null>(null);
  const [mutasiHariIniCount, setMutasiHariIniCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch('/api/apotek/darurat-stok')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStokMenipisCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
    fetch('/api/apotek/penjualan/hari-ini')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPenjualanHariIniCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => {});
    fetch('/api/apotek/penerimaan/hari-ini')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPenerimaanHariIniCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => {});
    fetch(`/api/apotek/obat-kadaluarsa?hari=${KADALUARSA_HARI}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setKadaluarsaCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
    fetch('/api/apotek/stok-opname/bulan-ini')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStokOpnameBulanIniCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => {});
    fetch('/api/apotek/mutasi/hari-ini')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMutasiHariIniCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => {});
  }, []);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard
          label="Penjualan Hari Ini"
          value={penjualanHariIniCount === null ? '-' : String(penjualanHariIniCount)}
          onClick={onNavigatePenjualan}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>}
        />
        <StatCard
          label="Penerimaan"
          value={penerimaanHariIniCount === null ? '-' : String(penerimaanHariIniCount)}
          onClick={onNavigatePenerimaan}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"></path><path d="M12 15V3"></path><path d="m7 10 5 5 5-5"></path></svg>}
        />
        <StatCard
          label="Stok Menipis"
          value={stokMenipisCount === null ? '-' : String(stokMenipisCount)}
          onClick={onNavigateStokMenipis}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path></svg>}
        />
        <StatCard
          label="Kadaluarsa (7 Bulan)"
          value={kadaluarsaCount === null ? '-' : String(kadaluarsaCount)}
          onClick={onNavigateKadaluarsa}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>}
        />
        <StatCard
          label="Stok Opname Bulan Ini"
          value={stokOpnameBulanIniCount === null ? '-' : String(stokOpnameBulanIniCount)}
          onClick={onNavigateStokOpname}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"></path></svg>}
        />
        <StatCard
          label="Mutasi Hari Ini"
          value={mutasiHariIniCount === null ? '-' : String(mutasiHariIniCount)}
          onClick={onNavigateMutasi}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3 21 7 17 11"></path><path d="M3 7h18"></path><path d="M7 21 3 17 7 13"></path><path d="M21 17H3"></path></svg>}
        />
      </div>
      <ApotekLamaPelayananView />
    </>
  );
};
