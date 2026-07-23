import React from 'react';

// ============================================================================
// APOTEK — Obat Kadaluarsa (tab utama modul Apotek). TIDAK ADA padanan di
// Khanza Desktop — fitur baru (istilah umum farmasi "ED"/Expired Date).
// Laporan READ-ONLY murni, sama pola dengan Darurat Stok. Lihat
// backend/apotek_obat_kadaluarsa_handler.go untuk kenapa sumber datanya
// `databarang.expire` (per-item), bukan `detailbeli.kadaluarsa` (per-batch
// pembelian, nyaris kosong di data riil).
//
// Beda dari Riwayat Obat/Darurat Stok: AUTO-LOAD saat dibuka (data
// terikat ukuran katalog barang ~2000 baris, bukan log transaksi yang bisa
// tumbuh tanpa batas — sudah terbukti cepat di Darurat Stok, dan laporan
// monitoring ED memang harus langsung kelihatan begitu tab dibuka).
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

type ObatKadaluarsaRow = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jenis: string;
  expire: string;
  hari_tersisa: number;
  stok_saat_ini: number;
};

const statusBadge = (hariTersisa: number): { label: string; bg: string; fg: string } => {
  if (hariTersisa < 0) return { label: `Kadaluarsa ${Math.abs(hariTersisa)} hari lalu`, bg: '#fef2f2', fg: '#dc2626' };
  if (hariTersisa <= 30) return { label: `${hariTersisa} hari lagi`, bg: '#fef2f2', fg: '#dc2626' };
  return { label: `${hariTersisa} hari lagi`, bg: '#fffbeb', fg: '#d97706' };
};

export const ApotekObatKadaluarsaView: React.FC = () => {
  const [searchText, setSearchText] = React.useState('');
  const [hari, setHari] = React.useState('90');
  const [items, setItems] = React.useState<ObatKadaluarsaRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/obat-kadaluarsa?hari=${encodeURIComponent(hari || '90')}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, hari]);

  const isFirst = React.useRef(true);
  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      fetchData();
      return;
    }
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, hari]);

  const sudahKadaluarsa = items.filter((i) => i.hari_tersisa < 0).length;
  const akanKadaluarsa = items.length - sudahKadaluarsa;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="Kode / Nama Barang / Jenis..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Ambang (hari)</label>
          <input type="number" step="1" min="1" style={inputStyle} value={hari} onChange={(e) => setHari(e.target.value)} />
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>
          {loading ? 'Memuat...' : `${items.length} barang — `}
          {!loading && sudahKadaluarsa > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>{sudahKadaluarsa} sudah kadaluarsa</span>}
          {!loading && sudahKadaluarsa > 0 && akanKadaluarsa > 0 && ', '}
          {!loading && akanKadaluarsa > 0 && <span style={{ color: '#d97706', fontWeight: 600 }}>{akanKadaluarsa} akan kadaluarsa</span>}
        </span>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Saat Ini</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl. Kadaluarsa</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#059669' }}>Aman — tidak ada barang mendekati/sudah kadaluarsa dalam {hari || 90} hari</td></tr>
            ) : (
              items.map((item, index) => {
                const badge = statusBadge(item.hari_tersisa);
                return (
                  <tr key={item.kode_brng} style={{ background: item.hari_tersisa < 0 ? '#fef2f2' : index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 600 }}>{item.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.satuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.jenis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{item.stok_saat_ini}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.expire.slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.fg }}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
