import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';

type PengumumanRow = {
  id: number; judul: string; isi: string; prioritas: 'info' | 'penting' | 'urgent';
  tanggal: string; aktif: boolean; dibuat_oleh: string;
};

const PRIORITAS_OPSI: { value: PengumumanRow['prioritas']; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'penting', label: 'Penting' },
  { value: 'urgent', label: 'Urgent' },
];

const prioritasStyle = (p: string) => {
  switch (p) {
    case 'urgent':  return { bg: '#fee2e2', color: '#991b1b' };
    case 'penting': return { bg: '#fef9c3', color: '#854d0e' };
    default:        return { bg: '#dbeafe', color: '#1d4ed8' };
  }
};

const iStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const lStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, marginBottom: 3, color: '#374151', fontWeight: 500,
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type FormState = {
  id?: number; judul: string; isi: string; prioritas: PengumumanRow['prioritas']; tanggal: string; aktif: boolean;
};
const EMPTY_FORM: FormState = { judul: '', isi: '', prioritas: 'info', tanggal: todayStr(), aktif: true };

// Pengumuman (Kepegawaian) — fitur baru murni ERMApp (tidak ada padanan
// di Khanza). Dikelola di sini oleh HRD/admin, ditampilkan sbg kartu
// "Pengumuman/Informasi Penting" di Home tab aplikasi mobile Presensi
// Mandiri (PresensiMobile.tsx) — cuma yang berstatus Aktif yang tampil.
export const PengumumanKepegawaianView: React.FC = () => {
  const [list, setList] = React.useState<PengumumanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterAktif, setFilterAktif] = React.useState<'' | '1' | '0'>('');
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterAktif) params.set('aktif', filterAktif);
      const res = await fetch(`/api/pengumuman?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data pengumuman');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterAktif]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const openTambah = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (row: PengumumanRow) => {
    setForm({ id: row.id, judul: row.judul, isi: row.isi, prioritas: row.prioritas, tanggal: row.tanggal, aktif: row.aktif });
    setShowModal(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim() || !form.isi.trim() || !form.tanggal) {
      Swal.fire({ icon: 'warning', title: 'Judul, isi, dan tanggal wajib diisi', confirmButtonColor: '#4338ca' });
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id != null;
      const url = isEdit ? `/api/pengumuman/${form.id}` : '/api/pengumuman';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: form.judul, isi: form.isi, prioritas: form.prioritas, tanggal: form.tanggal,
          aktif: form.aktif, dibuat_oleh: getCurrentPetugas(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengumuman');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: `Pengumuman ${isEdit ? 'diperbarui' : 'ditambahkan'}`, confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      setShowModal(false);
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: PengumumanRow) => {
    try {
      const res = await fetch(`/api/pengumuman/${row.id}/toggle`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const handleHapus = async (row: PengumumanRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Pengumuman?',
      html: `Pengumuman <strong>${row.judul}</strong> akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/pengumuman/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengumuman');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengumuman dihapus', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  return (<>
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 3 }}>
          {([{ v: '', label: 'Semua' }, { v: '1', label: 'Aktif' }, { v: '0', label: 'Nonaktif' }] as const).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterAktif(v)}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: filterAktif === v ? '1px solid #d1d5db' : 'none',
                background: filterAktif === v ? '#ffffff' : 'transparent',
                color: filterAktif === v ? '#111827' : '#6b7280',
                cursor: 'pointer', fontSize: 12, fontWeight: filterAktif === v ? 500 : 400,
                boxShadow: filterAktif === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openTambah}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: '#4338ca', color: '#ffffff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Pengumuman
        </button>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['Judul', 'Prioritas', 'Tanggal', 'Dibuat Oleh', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengumuman</td></tr>
            ) : (
              list.map((row, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const pst = prioritasStyle(row.prioritas);
                return (
                  <tr key={row.id} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#111827', maxWidth: 260 }}>
                      {row.judul}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.isi}</div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: pst.bg, color: pst.color }}>
                        {PRIORITAS_OPSI.find(o => o.value === row.prioritas)?.label || row.prioritas}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.tanggal}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.dibuat_oleh || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(row)}
                        style={{
                          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                          background: row.aktif ? '#dcfce7' : '#f3f4f6', color: row.aktif ? '#166534' : '#6b7280',
                        }}
                      >
                        {row.aktif ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        title="Edit"
                        style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', marginRight: 4 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHapus(row)}
                        title="Hapus"
                        style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="15" height="15" viewBox="0 0 24 24">
                          <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
                        </svg>
                      </button>
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
          {list.length} pengumuman
        </div>
      )}
    </section>

    {showModal && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        onClick={() => setShowModal(false)}
      >
        <div
          style={{ background: '#f9fafb', borderRadius: 16, padding: '40px 8px 8px', position: 'relative', width: '95%', maxWidth: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{form.id != null ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</span>
            <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            <form onSubmit={handleSimpan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={lStyle}>Judul <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={form.judul} onChange={e => setForm(p => ({ ...p, judul: e.target.value }))} placeholder="Judul pengumuman" maxLength={150} style={iStyle} />
                </div>
                <div>
                  <label style={lStyle}>Isi <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea value={form.isi} onChange={e => setForm(p => ({ ...p, isi: e.target.value }))} placeholder="Isi pengumuman" rows={4} style={{ ...iStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lStyle}>Prioritas</label>
                    <select value={form.prioritas} onChange={e => setForm(p => ({ ...p, prioritas: e.target.value as PengumumanRow['prioritas'] }))} style={iStyle}>
                      {PRIORITAS_OPSI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Tanggal <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} style={iStyle} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.aktif} onChange={e => setForm(p => ({ ...p, aktif: e.target.checked }))} />
                  Tampilkan (Aktif)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#a5b4fc' : '#4338ca', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
  </>);
};
