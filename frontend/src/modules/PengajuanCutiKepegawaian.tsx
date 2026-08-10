import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';

type CutiIzinRow = {
  no_pengajuan: string; tanggal: string; tanggal_awal: string; tanggal_akhir: string;
  nik: string; nama: string; departemen: string; urgensi: string; alamat: string;
  jumlah: number; kepentingan: string; nik_pj: string; nama_pj: string; status: string;
  catatan_approval: string; disetujui_oleh: string;
};

const KATEGORI_OPTIONS = [
  { value: '', label: 'Cuti & Izin' },
  { value: 'cuti', label: 'Cuti saja' },
  { value: 'izin', label: 'Izin saja' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'Proses Pengajuan', label: 'Proses Pengajuan' },
  { value: 'Disetujui', label: 'Disetujui' },
  { value: 'Ditolak', label: 'Ditolak' },
];

const statusStyle = (s: string) => {
  switch (s) {
    case 'Disetujui': return { bg: '#dcfce7', color: '#166534' };
    case 'Ditolak':   return { bg: '#fee2e2', color: '#991b1b' };
    default:          return { bg: '#fef9c3', color: '#854d0e' };
  }
};

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

// Pengajuan Cuti & Izin (Kepegawaian) — padanan PengajuanCutiAdmin.java
// (Khanza). Satu tabel `pengajuan_cuti` yang sama dipakai utk Cuti dan
// Izin (beda cuma nilai `urgensi`, lihat backend/cuti_izin_handler.go).
export const PengajuanCutiKepegawaianView: React.FC = () => {
  const [kategori, setKategori] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [tanggalAwal, setTanggalAwal] = React.useState('');
  const [tanggalAkhir, setTanggalAkhir] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<CutiIzinRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kategori) params.set('kategori', kategori);
      if (status) params.set('status', status);
      if (tanggalAwal) params.set('tanggal_awal', tanggalAwal);
      if (tanggalAkhir) params.set('tanggal_akhir', tanggalAkhir);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/pengajuan-cuti/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data pengajuan cuti/izin');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [kategori, status, tanggalAwal, tanggalAkhir, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const handleApprove = async (row: CutiIzinRow) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Setujui Pengajuan?',
      html: `<strong>${row.nama}</strong> — ${row.tanggal_awal} s/d ${row.tanggal_akhir} (${row.jumlah} hari, ${row.urgensi})`,
      input: 'text',
      inputPlaceholder: 'Catatan (opsional)',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Setujui',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/pengajuan-cuti/${row.no_pengajuan}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan: result.value || '', disetujui_oleh: getCurrentPetugas() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengajuan disetujui', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const handleReject = async (row: CutiIzinRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Tolak Pengajuan?',
      html: `<strong>${row.nama}</strong> — ${row.tanggal_awal} s/d ${row.tanggal_akhir}`,
      input: 'text',
      inputPlaceholder: 'Alasan penolakan',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      inputValidator: (value) => (!value ? 'Alasan penolakan wajib diisi' : undefined),
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/pengajuan-cuti/${row.no_pengajuan}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan: result.value, disetujui_oleh: getCurrentPetugas() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menolak pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengajuan ditolak', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const handleHapus = async (row: CutiIzinRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Pengajuan?',
      html: `Pengajuan <strong>${row.nama}</strong> (${row.tanggal_awal} s/d ${row.tanggal_akhir}) akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/pengajuan-cuti/${row.no_pengajuan}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengajuan dihapus', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select value={kategori} onChange={e => setKategori(e.target.value)} style={filterSelectStyle}>
            {KATEGORI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <StepperIcon />
        </div>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={filterSelectStyle}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <StepperIcon />
        </div>
        <input type="date" value={tanggalAwal} onChange={e => setTanggalAwal(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>s/d</span>
        <input type="date" value={tanggalAkhir} onChange={e => setTanggalAkhir(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }} />
        <input
          type="text"
          placeholder="Cari NIK / nama..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 200, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['No. Pengajuan', 'NIP', 'Nama', 'Departemen', 'Tanggal', 'Jumlah', 'Jenis', 'Keperluan', 'PJ Pengganti', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada pengajuan cuti/izin</td></tr>
            ) : (
              list.map((row, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const st = statusStyle(row.status);
                return (
                  <tr key={row.no_pengajuan} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 10 }}>{row.no_pengajuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4338ca', whiteSpace: 'nowrap' }}>{row.nik}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{row.nama}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.departemen || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.tanggal_awal} – {row.tanggal_akhir}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' }}>{row.jumlah}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.urgensi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', maxWidth: 180 }}>
                      {row.kepentingan}
                      {row.catatan_approval && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                          Catatan{row.disetujui_oleh ? ` (${row.disetujui_oleh})` : ''}: {row.catatan_approval}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.nama_pj || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {row.status === 'Proses Pengajuan' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(row)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#fff', color: '#059669', fontSize: 10, fontWeight: 600, cursor: 'pointer', marginRight: 4 }}
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(row)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Tolak
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleHapus(row)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                        >
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
          {list.length} pengajuan
        </div>
      )}
    </section>
  );
};
