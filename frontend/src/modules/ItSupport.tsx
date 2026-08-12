import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';

type LaporItRow = {
  id: number; nik: string; nama: string; departemen: string;
  kategori: string; lokasi: string; judul: string; deskripsi: string; foto: string;
  status: 'menunggu' | 'diproses' | 'selesai' | 'ditolak';
  catatan_penyelesaian: string; ditangani_oleh: string; created_at: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'ditolak', label: 'Ditolak' },
];

const KATEGORI_OPTIONS = [
  { value: '', label: 'Semua Kategori' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'jaringan', label: 'Jaringan' },
  { value: 'printer', label: 'Printer' },
  { value: 'lainnya', label: 'Lainnya' },
];

const statusStyle = (s: string) => {
  switch (s) {
    case 'diproses': return { bg: '#dbeafe', color: '#1e40af', label: 'Diproses' };
    case 'selesai':  return { bg: '#dcfce7', color: '#166534', label: 'Selesai' };
    case 'ditolak':  return { bg: '#fee2e2', color: '#991b1b', label: 'Ditolak' };
    default:         return { bg: '#fef9c3', color: '#854d0e', label: 'Menunggu' };
  }
};

const kategoriLabel = (v: string) => KATEGORI_OPTIONS.find((k) => k.value === v)?.label || v;

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 18, height: 18, borderRadius: '50%', background: '#4338ca',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const filterSelectStyle: React.CSSProperties = {
  padding: '6px 28px 6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 12, outline: 'none', background: '#ffffff', appearance: 'none',
  WebkitAppearance: 'none', cursor: 'pointer',
};

// Lapor IT — fitur baru murni ERMApp. Pegawai lapor kendala IT lewat HP
// (PresensiMobile.tsx > LaporItView), staf IT proses/selesaikan/tolak di sini.
export const ItSupportView: React.FC = () => {
  const [status, setStatus] = React.useState('');
  const [kategori, setKategori] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<LaporItRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (kategori) params.set('kategori', kategori);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/lapor-it/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data laporan IT');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [status, kategori, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const ubahStatus = async (row: LaporItRow, aksi: 'proses' | 'selesai' | 'tolak') => {
    const konfirmasi: Record<typeof aksi, { title: string; input?: 'text'; wajibCatatan: boolean; confirmColor: string; confirmText: string }> = {
      proses: { title: 'Proses laporan ini?', wajibCatatan: false, confirmColor: '#2563eb', confirmText: 'Proses' },
      selesai: { title: 'Tandai laporan selesai?', input: 'text', wajibCatatan: false, confirmColor: '#059669', confirmText: 'Selesai' },
      tolak: { title: 'Tolak laporan ini?', input: 'text', wajibCatatan: true, confirmColor: '#dc2626', confirmText: 'Tolak' },
    };
    const cfg = konfirmasi[aksi];
    const result = await Swal.fire({
      icon: aksi === 'tolak' ? 'warning' : 'question',
      title: cfg.title,
      html: `<strong>${row.judul}</strong><br/>${row.nama} — ${kategoriLabel(row.kategori)}, ${row.lokasi}`,
      input: cfg.input,
      inputPlaceholder: aksi === 'tolak' ? 'Alasan penolakan' : 'Catatan penyelesaian (opsional)',
      showCancelButton: true,
      confirmButtonColor: cfg.confirmColor,
      cancelButtonColor: '#6b7280',
      confirmButtonText: cfg.confirmText,
      cancelButtonText: 'Batal',
      inputValidator: cfg.wajibCatatan ? (value) => (!value ? 'Alasan penolakan wajib diisi' : undefined) : undefined,
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lapor-it/${row.id}/${aksi}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan: result.value || '', ditangani_oleh: getCurrentPetugas() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const handleHapus = async (row: LaporItRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Laporan?',
      html: `Laporan <strong>${row.judul}</strong> (${row.nama}) akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lapor-it/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus laporan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Laporan dihapus', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  return (
    <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h2 style={{ margin: 0 }}>IT Support</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0' }}>Daftar laporan kendala IT dari pegawai — proses, selesaikan, atau tolak.</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={filterSelectStyle}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <StepperIcon />
        </div>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select value={kategori} onChange={e => setKategori(e.target.value)} style={filterSelectStyle}>
            {KATEGORI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <StepperIcon />
        </div>
        <input
          type="text"
          placeholder="Cari NIK / nama / judul / lokasi..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 240, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['NIP', 'Nama', 'Kategori', 'Lokasi', 'Laporan', 'Tanggal', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada laporan IT</td></tr>
            ) : (
              list.map((row, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const st = statusStyle(row.status);
                return (
                  <tr key={row.id} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4338ca', whiteSpace: 'nowrap' }}>{row.nik}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {row.nama}
                      {row.departemen && <div style={{ fontSize: 10, color: '#9ca3af' }}>{row.departemen}</div>}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{kategoriLabel(row.kategori)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.lokasi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', maxWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        {row.foto && (
                          <img
                            src={row.foto}
                            alt="Foto kendala"
                            onClick={() => window.open(row.foto, '_blank')}
                            style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{row.judul}</div>
                          {row.deskripsi && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{row.deskripsi}</div>}
                          {row.catatan_penyelesaian && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              Catatan{row.ditangani_oleh ? ` (${row.ditangani_oleh})` : ''}: {row.catatan_penyelesaian}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.created_at}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {row.status === 'menunggu' && (
                        <>
                          <button type="button" onClick={() => ubahStatus(row, 'proses')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 10, fontWeight: 600, cursor: 'pointer', marginRight: 4 }}>
                            Proses
                          </button>
                          <button type="button" onClick={() => ubahStatus(row, 'tolak')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Tolak
                          </button>
                        </>
                      )}
                      {row.status === 'diproses' && (
                        <>
                          <button type="button" onClick={() => ubahStatus(row, 'selesai')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#fff', color: '#059669', fontSize: 10, fontWeight: 600, cursor: 'pointer', marginRight: 4 }}>
                            Selesai
                          </button>
                          <button type="button" onClick={() => ubahStatus(row, 'tolak')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Tolak
                          </button>
                        </>
                      )}
                      {(row.status === 'selesai' || row.status === 'ditolak') && (
                        <button type="button" onClick={() => handleHapus(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          Hapus
                        </button>
                      )}
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
          {list.length} laporan
        </div>
      )}
    </section>
  );
};
