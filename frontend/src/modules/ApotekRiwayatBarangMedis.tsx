import React from 'react';

// ============================================================================
// APOTEK — Riwayat Obat, Alkes & BHP (tab utama modul Apotek). Cocok
// dengan dialog Khanza Desktop inventory/DlgRiwayatBarangMedis.java —
// laporan READ-ONLY murni (tidak ada tombol Simpan/Hapus di Java sama
// sekali, cuma Cari/Cetak) atas tabel log `riwayat_barang_medis`, yang
// diisi lewat catatRiwayatBarangMedis di backend/apotek_riwayat_barang_medis.go
// — dipanggil dari Stok Opname, Mutasi, Penerimaan, dan approve
// Permintaan (retrofit, lihat komentar di file itu untuk detail).
// ============================================================================

const pillSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 32px 7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#ffffff',
  color: '#111827',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: '#059669',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const PillSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={pillSelectStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

type KvOpsi = { kode: string; nama: string };

const POSISI_OPTIONS = [
  'Pemberian Obat',
  'Pengadaan',
  'Penerimaan',
  'Piutang',
  'Retur Beli',
  'Retur Jual',
  'Retur Piutang',
  'Mutasi',
  'Opname',
  'Resep Pulang',
  'Retur Pasien',
  'Stok Pasien Ranap',
  'Pengambilan Medis',
  'Penjualan',
  'Stok Keluar',
  'Hibah',
];

const posisiColor = (posisi: string) => {
  if (posisi === 'Mutasi') return '#2563eb';
  if (posisi === 'Opname') return '#d97706';
  if (posisi === 'Pengadaan' || posisi === 'Penerimaan' || posisi === 'Hibah') return '#059669';
  return '#6b7280';
};

type RiwayatRow = {
  kode_brng: string;
  nama_brng: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  stok_akhir: number;
  posisi: string;
  tanggal: string;
  jam: string;
  petugas: string;
  kd_bangsal: string;
  nm_bangsal: string;
  status: string;
  no_batch: string;
  no_faktur: string;
  keterangan: string;
};

export const ApotekRiwayatBarangMedisView: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [posisi, setPosisi] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);
  const [items, setItems] = React.useState<RiwayatRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const fetchRiwayat = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/riwayat-barang-medis?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdBangsal) url += `&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (posisi) url += `&posisi=${encodeURIComponent(posisi)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, kdBangsal, posisi, searchText]);

  const isFirstSearch = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      fetchRiwayat();
      return;
    }
    const t = setTimeout(() => fetchRiwayat(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  React.useEffect(() => {
    fetchRiwayat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgl1, tgl2, kdBangsal, posisi]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Posisi</label>
          <PillSelect value={posisi} onChange={setPosisi} options={[{ value: '', label: 'Semua Posisi' }, ...POSISI_OPTIONS.map((p) => ({ value: p, label: p }))]} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="Kode / nama barang / petugas / no.faktur / keterangan..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{items.length} baris</span>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal / Jam</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Barang</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Awal</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Masuk</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Keluar</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Akhir</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Posisi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada riwayat pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.kode_brng}-${item.tanggal}-${item.jam}-${item.kd_bangsal}-${index}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {item.tanggal.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{item.jam}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ color: '#111827' }}>{item.nama_brng || item.kode_brng}</div>
                    <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{item.kode_brng}</div>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{item.stok_awal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.masuk > 0 ? '#059669' : '#374151', fontWeight: item.masuk > 0 ? 600 : 400 }}>
                    {item.masuk > 0 ? `+${item.masuk}` : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.keluar > 0 ? '#dc2626' : '#374151', fontWeight: item.keluar > 0 ? 600 : 400 }}>
                    {item.keluar > 0 ? `-${item.keluar}` : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#111827', fontWeight: 600 }}>{item.stok_akhir}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: posisiColor(item.posisi), fontWeight: 600 }}>{item.posisi}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal || item.kd_bangsal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.petugas || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: item.status === 'Hapus' ? '#fef2f2' : '#ecfdf5', color: item.status === 'Hapus' ? '#dc2626' : '#059669' }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{item.keterangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
