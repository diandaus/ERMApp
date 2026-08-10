import React from 'react';
import Swal from 'sweetalert2';

type JamMasukRow = { shift: string; jam_masuk: string; jam_pulang: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (shift: string) => void;
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const lStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, marginBottom: 3, color: '#374151', fontWeight: 500,
};

// Modal Pilih Shift — dipakai di JadwalPegawai.tsx menggantikan <select>
// biasa, sekaligus jadi tempat kelola daftar shift (jam_masuk): tambah
// (nama bebas), edit jam SEKALIGUS nama (rename, di-cascade backend ke
// semua jadwal yang merujuk nama lama), dan hapus (ditolak backend kalau
// shift-nya masih dipakai di jadwal manapun).
export const ModalPilihShift: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [list, setList] = React.useState<JamMasukRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'list' | 'tambah' | 'edit'>('list');
  const [editShiftLama, setEditShiftLama] = React.useState('');
  const [formShift, setFormShift] = React.useState('');
  const [formJamMasuk, setFormJamMasuk] = React.useState('');
  const [formJamPulang, setFormJamPulang] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jam-masuk/opsi');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setView('list');
      setSearch('');
      fetchList();
    }
  }, [isOpen, fetchList]);

  const openTambah = () => {
    setFormShift('');
    setFormJamMasuk('');
    setFormJamPulang('');
    setView('tambah');
  };

  const openEdit = (row: JamMasukRow) => {
    setEditShiftLama(row.shift);
    setFormShift(row.shift);
    setFormJamMasuk(row.jam_masuk.slice(0, 5));
    setFormJamPulang(row.jam_pulang.slice(0, 5));
    setView('edit');
  };

  const handleSimpanTambah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formShift || !formJamMasuk || !formJamPulang) return;
    setSaving(true);
    try {
      const res = await fetch('/api/jam-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: formShift, jam_masuk: formJamMasuk, jam_pulang: formJamPulang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah shift');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: `Shift ${formShift} ditambahkan`, confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      setView('list');
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSaving(false);
    }
  };

  const handleSimpanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formShift || !formJamMasuk || !formJamPulang) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jam-masuk/${encodeURIComponent(editShiftLama)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: formShift, jam_masuk: formJamMasuk, jam_pulang: formJamPulang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui shift');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || `Shift ${formShift} diperbarui`, confirmButtonColor: '#4338ca', timer: 1800, showConfirmButton: false });
      setView('list');
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (row: JamMasukRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Shift?',
      html: `Shift <strong>${row.shift}</strong> (${row.jam_masuk.slice(0, 5)}-${row.jam_pulang.slice(0, 5)}) akan dihapus.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/jam-masuk/${encodeURIComponent(row.shift)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { Swal.fire({ icon: 'error', title: 'Tidak Bisa Dihapus', text: data.error || 'Gagal menghapus shift', confirmButtonColor: '#4338ca' }); return; }
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Shift dihapus', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan saat menghapus', confirmButtonColor: '#4338ca' });
    }
  };

  if (!isOpen) return null;

  const filtered = list.filter(r => r.shift.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px', position: 'relative',
          width: '90%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {view === 'list' ? 'Pilih Shift' : view === 'tambah' ? 'Tambah Shift' : `Edit Shift — ${formShift}`}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #d1d5db', padding: 12, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {view === 'list' ? (
            <>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Cari nama shift..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={openTambah}
                  style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: '#4338ca', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  + Tambah
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Memuat data shift...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Tidak ada shift ditemukan</div>
                ) : (
                  filtered.map(row => (
                    <div
                      key={row.shift}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f3f4f6', borderRadius: 8, transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { onSelect(row.shift); onClose(); }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{row.shift}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{row.jam_masuk.slice(0, 5)} – {row.jam_pulang.slice(0, 5)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        title="Edit jam"
                        style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHapus(row)}
                        title="Hapus shift"
                        style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="16" height="16" viewBox="0 0 24 24">
                          <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : view === 'tambah' ? (
            <form onSubmit={handleSimpanTambah} style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lStyle}>Nama Shift <span style={{ color: '#ef4444' }}>*</span></label>
                <input required type="text" maxLength={30} placeholder="Mis. Shift Pagi Kantor" value={formShift} onChange={e => setFormShift(e.target.value)} style={iStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lStyle}>Jam Masuk <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required type="time" value={formJamMasuk} onChange={e => setFormJamMasuk(e.target.value)} style={iStyle} />
                </div>
                <div>
                  <label style={lStyle}>Jam Pulang <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required type="time" value={formJamPulang} onChange={e => setFormJamPulang(e.target.value)} style={iStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setView('list')} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#a5b4fc' : '#4338ca', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSimpanEdit} style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lStyle}>Nama Shift <span style={{ color: '#ef4444' }}>*</span></label>
                <input required type="text" maxLength={30} value={formShift} onChange={e => setFormShift(e.target.value)} style={iStyle} />
                {formShift !== editShiftLama && formShift !== '' && (
                  <div style={{ fontSize: 10, color: '#d97706', marginTop: 4 }}>
                    Mengganti nama akan otomatis memperbarui semua jadwal yang memakai "{editShiftLama}".
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lStyle}>Jam Masuk <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required type="time" value={formJamMasuk} onChange={e => setFormJamMasuk(e.target.value)} style={iStyle} />
                </div>
                <div>
                  <label style={lStyle}>Jam Pulang <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required type="time" value={formJamPulang} onChange={e => setFormJamPulang(e.target.value)} style={iStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setView('list')} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#a5b4fc' : '#4338ca', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
