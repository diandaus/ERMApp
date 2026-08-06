import React from 'react';
import Swal from 'sweetalert2';
import { ModalTambahPetugas } from '../components/ModalTambahPetugas';

type Petugas = {
  nip: string; nama: string; jk: string; tmp_lahir: string; tgl_lahir: string;
  gol_darah: string; agama: string; stts_nikah: string; alamat: string;
  kd_jbtn: string; nm_jbtn: string; no_telp: string; email: string; str_sipa: string;
};

const JK_OPTIONS = [
  { value: '', label: 'Semua J.K.' },
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
];
const GD_OPTIONS = ['', 'A', 'B', 'O', 'AB', '-'];
const STTS_OPTIONS = ['', 'BELUM MENIKAH', 'MENIKAH', 'JANDA', 'DUDHA'];

export const PetugasView: React.FC = () => {
  const [searchText, setSearchText] = React.useState('');
  const [jk, setJk] = React.useState('');
  const [golDarah, setGolDarah] = React.useState('');
  const [sttsNikah, setSttsNikah] = React.useState('');
  const [list, setList] = React.useState<Petugas[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Petugas | null>(null);
  const [showTambahModal, setShowTambahModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchText) params.set('search', searchText);
      if (jk) params.set('jk', jk);
      if (golDarah) params.set('gol_darah', golDarah);
      if (sttsNikah) params.set('stts_nikah', sttsNikah);
      const res = await fetch(`/api/petugas/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data petugas');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, jk, golDarah, sttsNikah]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  return (<>
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={jk} onChange={e => setJk(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
            {JK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={golDarah} onChange={e => setGolDarah(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
            {GD_OPTIONS.map(v => <option key={v} value={v}>{v === '' ? 'Semua Gol. Darah' : v}</option>)}
          </select>
          <select value={sttsNikah} onChange={e => setSttsNikah(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
            {STTS_OPTIONS.map(v => <option key={v} value={v}>{v === '' ? 'Semua Status Nikah' : v}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Edit Button */}
          <button
            type="button"
            onClick={() => {
              if (!selected) {
                Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Silakan pilih petugas terlebih dahulu', confirmButtonColor: '#4338ca' });
                return;
              }
              setEditData({ ...selected });
              setShowTambahModal(true);
            }}
            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Hapus Button */}
          <button
            type="button"
            onClick={async () => {
              if (!selected) {
                Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Silakan pilih petugas terlebih dahulu', confirmButtonColor: '#4338ca' });
                return;
              }
              const result = await Swal.fire({
                icon: 'warning',
                title: 'Konfirmasi Hapus',
                html: `Apakah Anda yakin ingin menghapus data petugas:<br><strong>${selected.nama}</strong><br>(${selected.nip})?`,
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Ya, Hapus',
                cancelButtonText: 'Batal'
              });
              if (result.isConfirmed) {
                try {
                  const res = await fetch(`/api/petugas/${encodeURIComponent(selected.nip)}`, { method: 'DELETE' });
                  const data = await res.json();
                  if (!res.ok) { Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || 'Gagal menghapus data', confirmButtonColor: '#4338ca' }); return; }
                  Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data petugas berhasil dihapus', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
                  setSelected(null);
                  fetchList();
                } catch {
                  Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan saat menghapus', confirmButtonColor: '#4338ca' });
                }
              }
            }}
            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="20" height="20" viewBox="0 0 24 24">
              <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
            </svg>
          </button>

          <button
            type="button"
            onClick={() => { setEditData(null); setShowTambahModal(true); }}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#4338ca', color: '#ffffff',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Petugas
          </button>
          <input
            type="text"
            placeholder="Cari NIP / nama / jabatan..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 220, outline: 'none' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['NIP', 'Nama Petugas', 'J.K.', 'Tmp.Lahir', 'Tgl.Lahir', 'G.D.', 'Agama', 'Stts.Nikah', 'Alamat', 'Jabatan', 'STR/SIPA', 'No.Telp', 'Email'].map((h) => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Tidak ada data petugas</td></tr>
            ) : (
              list.map((p, index) => {
                const isSelected = selected?.nip === p.nip;
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                return (
                  <tr
                    key={p.nip}
                    onClick={() => setSelected(p)}
                    style={{ background: isSelected ? '#e0e7ff' : baseBg, cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fef3c7'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = baseBg; }}
                  >
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4338ca', whiteSpace: 'nowrap' }}>{p.nip}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.nama}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.jk === 'P' ? 'P' : 'L'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.tmp_lahir || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.tgl_lahir || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.gol_darah || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.agama || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.stts_nikah || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.alamat || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.nm_jbtn || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.str_sipa || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.no_telp || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{p.email || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {list.length} petugas ditemukan
        </div>
      )}
    </section>

    <ModalTambahPetugas
      isOpen={showTambahModal}
      onClose={() => { setShowTambahModal(false); setEditData(null); }}
      onSuccess={fetchList}
      editData={editData}
    />
  </>);
};
