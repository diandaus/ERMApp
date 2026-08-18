import React from 'react';

// BpjsPersetujuanSep — "List Data Persetujuan SEP New"
// (Sep/persetujuanSEP/list/bulan/{bulan}/tahun/{tahun}): laporan bulanan
// riwayat pengajuan/aproval SEP backdate & finger print LANGSUNG dari BPJS
// (bukan tabel lokal), murni read-only. Endpoint: GET
// /api/bridging/sep/persetujuan-list?bulan=&tahun= (backend:
// getPersetujuanSepList di bridging_pengajuan_handler.go).

type PersetujuanSepRow = {
  noKartu: string;
  nama: string;
  tglsep: string;
  jnspelayanan: string;
  persetujuan: string;
  status: string;
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#ffffff',
};

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
  { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

const formatTglSep = (tgl: string) => {
  if (!tgl) return '-';
  const [y, m, d] = tgl.split('-');
  return y && m && d ? `${d}/${m}/${y}` : tgl;
};

export const BpjsPersetujuanSepView: React.FC = () => {
  const now = new Date();
  const [bulan, setBulan] = React.useState(now.getMonth() + 1);
  const [tahun, setTahun] = React.useState(now.getFullYear());
  const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<PersetujuanSepRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bridging/sep/persetujuan-list?bulan=${bulan}&tahun=${tahun}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data persetujuan SEP');
      const list = data?.list;
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => (item.noKartu || '').toLowerCase().includes(q) || (item.nama || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} style={{ ...inputStyle, width: 150 }}>
            {BULAN_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} style={{ ...inputStyle, width: 110 }}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Cari No. Kartu / Nama"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
        </div>
        <button
          type="button"
          onClick={fetchItems}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Kartu</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl. SEP</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jns. Pelayanan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Persetujuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data persetujuan SEP untuk periode ini</td></tr>
            ) : (
              filtered.map((item, index) => (
                <tr key={`${item.noKartu}-${index}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.noKartu}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTglSep(item.tglsep)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.jnspelayanan || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.persetujuan || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      {item.status || '-'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
