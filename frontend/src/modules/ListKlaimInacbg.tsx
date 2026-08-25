import React from 'react';
import { GroupingInacbgView } from './GroupingInacbg';

// ListKlaimInacbg.tsx — tab "List Klaim" di Casemix, worklist kunjungan yang
// sudah punya SEP (langkah awal sblm pengajuan klaim INACBG), beda dari
// KlaimInacbg.tsx yg fokus ke rekap NILAI klaim rawat inap. Datanya dari
// tabel bridging_sep yang sudah diisi lewat modul Bridging > SEP (lihat
// GET /api/casemix/list-klaim di backend/list_klaim_handler.go) — tidak ada
// input baru di sini, murni tampilan + filter tanggal/pencarian.

type ListKlaimRow = {
  no_rawat: string; no_rm: string; nm_pasien: string; unit: string; kamar: string;
  nm_dokter: string; no_sep: string; tgl_sep: string; tgl_regis: string; tgl_pulang: string;
  status_klaim: string;
};

// Badge warna per tahap Status Klaim — checkpoint lokal Khanza
// (inacbg_klaim_baru/inacbg_data_terkirim/inacbg_grouping_stage1[2]),
// diurutkan makin hijau/tegas makin lanjut prosesnya.
const STATUS_KLAIM_STYLE: Record<string, { bg: string; color: string }> = {
  'Belum Diproses': { bg: '#f3f4f6', color: '#6b7280' },
  'Klaim Dibuat': { bg: '#fef3c7', color: '#92400e' },
  'Data Klaim Terkirim': { bg: '#dbeafe', color: '#1e40af' },
  'Sudah Grouping INACBG': { bg: '#dcfce7', color: '#166534' },
};

type Jenis = 'ralan' | 'ranap';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const filterInputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
};

// Tab Rawat Jalan tampilkan Unit + Nama Dokter; tab Rawat Inap tampilkan
// Kamar sbg gantinya (tanpa Nama Dokter) — sesuai kolom List Klaim Khanza
// Desktop yang beda antara dua tab ini.
const COLUMNS_RALAN = ['No Rawat', 'No RM', 'Nama Pasien', 'Unit', 'Nama Dokter', 'No SEP', 'Tgl SEP', 'Tgl. Regis', 'Tgl Pulang', 'Status Klaim'];
const COLUMNS_RANAP = ['No Rawat', 'No RM', 'Nama Pasien', 'Kamar', 'No SEP', 'Tgl SEP', 'Tgl. Regis', 'Tgl Pulang', 'Status Klaim'];

export const ListKlaimInacbgView: React.FC = () => {
  const [jenis, setJenis] = React.useState<Jenis>('ralan');
  const [tglDari, setTglDari] = React.useState(todayStr());
  const [tglSampai, setTglSampai] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<ListKlaimRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNoRawat, setSelectedNoRawat] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('jenis', jenis);
      params.set('tgl_dari', tglDari);
      params.set('tgl_sampai', tglSampai);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/casemix/list-klaim?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data List Klaim');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [jenis, tglDari, tglSampai, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const columns = jenis === 'ranap' ? COLUMNS_RANAP : COLUMNS_RALAN;

  // GroupingInacbgView sudah full-bleed sendiri (position:fixed inset:0) —
  // lepas dari shell/card Casemix, tidak perlu dibungkus lagi di sini.
  if (selectedNoRawat) {
    return <GroupingInacbgView noRawat={selectedNoRawat} onBack={() => setSelectedNoRawat(null)} />;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Rawat Jalan / Rawat Inap */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexShrink: 0, borderBottom: '1px solid #e5e7eb' }}>
        {([['ralan', 'Rawat Jalan'], ['ranap', 'Rawat Inap']] as [Jenis, string][]).map(([key, label]) => {
          const active = jenis === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setJenis(key)}
              style={{
                padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                background: 'transparent', color: active ? '#2563eb' : '#6b7280', fontWeight: active ? 600 : 400,
                fontSize: 13, cursor: 'pointer', marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={tglDari} onChange={e => setTglDari(e.target.value)} style={filterInputStyle} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s/d</span>
          <input type="date" value={tglSampai} onChange={e => setTglSampai(e.target.value)} style={filterInputStyle} />
        </div>
        <input
          type="text"
          placeholder="Cari No Rawat / No SEP / No RM / Nama..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 260, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {columns.map((h) => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Tidak ada data SEP pada rentang tanggal ini</td></tr>
            ) : (
              list.map((r, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                return (
                  <tr key={`${r.no_rawat}-${r.no_sep}`} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <button
                        type="button" onClick={() => setSelectedNoRawat(r.no_rawat)}
                        style={{ padding: '2px 10px', borderRadius: 2, border: 'none', background: '#2563eb', color: '#ffffff', fontSize: 12, fontWeight: 400, cursor: 'pointer' }}
                      >
                        {r.no_rawat}
                      </button>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.no_rm || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nm_pasien || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{(jenis === 'ranap' ? r.kamar : r.unit) || '-'}</td>
                    {jenis === 'ralan' && (
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.nm_dokter || '-'}</td>
                    )}
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.no_sep || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.tgl_sep || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.tgl_regis || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.tgl_pulang || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 2, fontSize: 11, fontWeight: 400,
                        background: (STATUS_KLAIM_STYLE[r.status_klaim] || STATUS_KLAIM_STYLE['Belum Diproses']).bg,
                        color: (STATUS_KLAIM_STYLE[r.status_klaim] || STATUS_KLAIM_STYLE['Belum Diproses']).color,
                      }}>
                        {r.status_klaim || 'Belum Diproses'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {list.length} data SEP
        </div>
      )}
    </section>
  );
};
