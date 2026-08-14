import React from 'react';
import Swal from 'sweetalert2';
import { ModalTambahPegawai } from '../components/ModalTambahPegawai';

type Pegawai = {
  nik: string; nama: string; jk: string; jbtn: string;
  jnj_jabatan: string; kode_kelompok: string; kode_resiko: string; kode_emergency: string;
  departemen: string; bidang: string; stts_wp: string; stts_kerja: string;
  npwp: string; pendidikan: string; tmp_lahir: string; tgl_lahir: string;
  alamat: string; kota: string; mulai_kerja: string; ms_kerja: string;
  indexins: string; bpd: string; rekening: string; stts_aktif: string;
  wajibmasuk: number; mulai_kontrak: string; no_ktp: string; email: string; photo: string;
};

const STATUSES = ['AKTIF', 'CUTI', 'KELUAR', 'TENAGA LUAR'] as const;

const StepperIcon: React.FC = () => (
  <span
    style={{
      width: 16, height: 16, borderRadius: '50%', background: '#4338ca',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </span>
);

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'AKTIF':       return { bg: '#dcfce7', color: '#166534', label: 'Aktif' };
    case 'CUTI':        return { bg: '#fef9c3', color: '#854d0e', label: 'Cuti' };
    case 'KELUAR':      return { bg: '#fee2e2', color: '#991b1b', label: 'Keluar' };
    case 'TENAGA LUAR': return { bg: '#ede9fe', color: '#5b21b6', label: 'Tenaga Luar' };
    default:            return { bg: '#f3f4f6', color: '#374151', label: status || '-' };
  }
};

export const PegawaiView: React.FC = () => {
  const [searchText, setSearchText]             = React.useState('');
  const [sttsAktif, setSttsAktif]               = React.useState('AKTIF');
  const [departemen, setDepartemen]             = React.useState('');
  const [pegawaiList, setPegawaiList]           = React.useState<Pegawai[]>([]);
  const [departemenList, setDepartemenList]     = React.useState<{ kode: string; nama: string }[]>([]);
  const [loading, setLoading]                   = React.useState(false);
  const [error, setError]                       = React.useState<string | null>(null);
  const [selectedPegawai, setSelectedPegawai]   = React.useState<Pegawai | null>(null);
  const [showTambahModal, setShowTambahModal]         = React.useState(false);
  const [editData, setEditData]                       = React.useState<any>(null);
  const [showFilterDropdown, setShowFilterDropdown]   = React.useState(false);
  const [showStatusDropdown, setShowStatusDropdown]   = React.useState<string | null>(null);
  const [statusDropdownPos, setStatusDropdownPos]     = React.useState<{ top: number; left: number; alignBottom: boolean } | null>(null);
  const filterRef       = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  const handleChangeStatus = async (nik: string, newStatus: string) => {
    try {
      const res = await fetch('/api/pegawai/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, stts_aktif: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');
      setPegawaiList(prev => prev.map(p => p.nik === nik ? { ...p, stts_aktif: newStatus } : p));
      if (selectedPegawai?.nik === nik) setSelectedPegawai(prev => prev ? { ...prev, stts_aktif: newStatus } : prev);
      setShowStatusDropdown(null);
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Status diubah menjadi ${getStatusStyle(newStatus).label}`, confirmButtonColor: '#2563eb', timer: 1500, showConfirmButton: false });
    } catch (e) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    }
  };

  const fetchPegawai = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchText) params.set('search', searchText);
      if (sttsAktif)  params.set('stts_aktif', sttsAktif);
      if (departemen) params.set('departemen', departemen);
      const res = await fetch(`/api/pegawai/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data pegawai');
      const data = await res.json();
      setPegawaiList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setPegawaiList([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, sttsAktif, departemen]);

  React.useEffect(() => { fetchPegawai(); }, [fetchPegawai]);

  React.useEffect(() => {
    fetch('/api/pegawai/departemen')
      .then(r => r.json())
      .then(d => setDepartemenList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!showFilterDropdown) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  React.useEffect(() => {
    if (!showStatusDropdown) return;
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusDropdown]);


  return (<>
    {/* Content Section — langsung di atas background, tanpa card */}
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          {/* Tab: status aktif */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
            {['AKTIF', 'CUTI', 'KELUAR', 'TENAGA LUAR', ''].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSttsAktif(s)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: sttsAktif === s ? '1px solid #d1d5db' : 'none',
                  background: sttsAktif === s ? '#ffffff' : 'transparent',
                  color: sttsAktif === s ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: sttsAktif === s ? 500 : 400,
                  transition: 'all 0.2s ease',
                  boxShadow: sttsAktif === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {s === '' ? 'Semua' : s === 'TENAGA LUAR' ? 'Tenaga Luar' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search + Filter + Tambah */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Edit Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedPegawai) {
                  Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Silakan pilih pegawai terlebih dahulu', confirmButtonColor: '#2563eb' });
                  return;
                }
                setEditData({ ...selectedPegawai });
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
                if (!selectedPegawai) {
                  Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Silakan pilih pegawai terlebih dahulu', confirmButtonColor: '#2563eb' });
                  return;
                }
                const result = await Swal.fire({
                  icon: 'warning',
                  title: 'Konfirmasi Hapus',
                  html: `Apakah Anda yakin ingin menghapus data pegawai:<br><strong>${selectedPegawai.nama}</strong><br>(${selectedPegawai.nik})?`,
                  showCancelButton: true,
                  confirmButtonColor: '#dc2626',
                  cancelButtonColor: '#6b7280',
                  confirmButtonText: 'Ya, Hapus',
                  cancelButtonText: 'Batal'
                });
                if (result.isConfirmed) {
                  try {
                    const res = await fetch(`/api/pegawai/${encodeURIComponent(selectedPegawai.nik)}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (!res.ok) { Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || 'Gagal menghapus data', confirmButtonColor: '#2563eb' }); return; }
                    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data pegawai berhasil dihapus', confirmButtonColor: '#2563eb', timer: 1500, showConfirmButton: false });
                    setSelectedPegawai(null);
                    fetchPegawai();
                  } catch {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan saat menghapus', confirmButtonColor: '#2563eb' });
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
              Tambah Pegawai
            </button>
            <input
              type="text"
              placeholder="Cari nama / NIK / jabatan..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 240, outline: 'none' }}
            />

            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowFilterDropdown(v => !v)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: departemen ? '#2563eb' : '#ffffff',
                  color: departemen ? '#ffffff' : '#374151',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <span>Departemen</span>
                <StepperIcon />
              </button>

              {showFilterDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 160, padding: 4
                }}>
                  {[{ kode: '', nama: 'Semua Departemen' }, ...departemenList].map(d => (
                    <div
                      key={d.kode}
                      onClick={() => { setDepartemen(d.kode); setShowFilterDropdown(false); }}
                      style={{
                        padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6,
                        background: departemen === d.kode ? '#dbeafe' : 'transparent',
                        color: departemen === d.kode ? '#1d4ed8' : '#374151',
                        fontWeight: departemen === d.kode ? 500 : 400
                      }}
                    >
                      {d.nama}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                {['NIK', 'Nama', 'Jabatan', 'Departemen', 'Mulai Kerja', 'Pendidikan', 'Kota', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</td></tr>
              ) : pegawaiList.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Tidak ada data pegawai</td></tr>
              ) : (
                pegawaiList.map((p, index) => {
                  const isSelected = selectedPegawai?.nik === p.nik;
                  const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                  return (
                    <tr
                      key={p.nik}
                      onClick={() => setSelectedPegawai(p)}
                      style={{ background: isSelected ? '#dbeafe' : baseBg, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fef3c7'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = baseBg; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                        {p.nik}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 12, color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {p.nama}
                          <span style={{ fontSize: 10, fontWeight: 600, color: p.jk === 'Wanita' ? '#db2777' : '#2563eb', background: p.jk === 'Wanita' ? '#fce7f3' : '#dbeafe', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                            {p.jk === 'Wanita' ? 'P' : 'L'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {p.jbtn || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {p.departemen || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {p.mulai_kerja || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {p.pendidikan || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {p.kota || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (showStatusDropdown === p.nik) {
                              setShowStatusDropdown(null);
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              setStatusDropdownPos({
                                top: spaceBelow > 120 ? rect.bottom + 4 : rect.top,
                                left: rect.right,
                                alignBottom: spaceBelow <= 120,
                              });
                              setShowStatusDropdown(p.nik);
                            }
                          }}
                          style={{
                            padding: '2px 8px', borderRadius: 999, border: 'none',
                            background: getStatusStyle(p.stts_aktif).bg,
                            color: getStatusStyle(p.stts_aktif).color,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {getStatusStyle(p.stts_aktif).label}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {showStatusDropdown === p.nik
                              ? <polyline points="18 15 12 9 6 15" />
                              : <polyline points="6 9 12 15 18 9" />}
                          </svg>
                        </button>
                        {showStatusDropdown === p.nik && statusDropdownPos && (
                          <div
                            ref={statusDropdownRef}
                            style={{
                              position: 'fixed',
                              top: statusDropdownPos.top,
                              left: statusDropdownPos.left,
                              transform: statusDropdownPos.alignBottom ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                              background: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: 8,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              zIndex: 9999,
                              minWidth: 140,
                              overflow: 'hidden'
                            }}
                          >
                            {STATUSES.map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleChangeStatus(p.nik, status)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  width: '100%', padding: '8px 12px',
                                  border: 'none', textAlign: 'left', cursor: 'pointer',
                                  background: p.stts_aktif === status ? '#dbeafe' : 'transparent',
                                  color: p.stts_aktif === status ? '#2563eb' : '#374151',
                                  fontSize: 12, fontWeight: p.stts_aktif === status ? 600 : 400
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = p.stts_aktif === status ? '#dbeafe' : 'transparent'; }}
                              >
                                <span style={{
                                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                  background: getStatusStyle(status).color
                                }} />
                                {getStatusStyle(status).label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      {/* Total info */}
      {!loading && pegawaiList.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {pegawaiList.length} pegawai ditemukan
        </div>
      )}
    </section>

    {/* Fixed bottom drawer — detail pegawai */}
    {selectedPegawai && (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        borderRadius: '16px 16px 0 0',
        padding: '14px 24px 18px',
        animation: 'slideUp 0.2s ease'
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{selectedPegawai.nama}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{selectedPegawai.nik} · {selectedPegawai.jbtn || '-'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPegawai(null)}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#f9fafb', fontSize: 16, cursor: 'pointer',
              color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0
            }}
          >×</button>
        </div>

        {/* Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px 20px' }}>
          {([
            ['Jenis Kelamin', selectedPegawai.jk],
            ['Departemen',    selectedPegawai.departemen],
            ['Bidang',        selectedPegawai.bidang],
            ['Jenis Jabatan', selectedPegawai.jnj_jabatan],
            ['Status Kerja',  selectedPegawai.stts_kerja],
            ['Status Aktif',  selectedPegawai.stts_aktif],
            ['Pendidikan',    selectedPegawai.pendidikan],
            ['Tempat Lahir',  selectedPegawai.tmp_lahir],
            ['Tgl Lahir',     selectedPegawai.tgl_lahir],
            ['Mulai Kerja',   selectedPegawai.mulai_kerja],
            ['Kota',          selectedPegawai.kota],
            ['Alamat',        selectedPegawai.alamat],
            ['No KTP',        selectedPegawai.no_ktp],
            ['Email',         selectedPegawai.email],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 1 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#111827', wordBreak: 'break-word' }}>{value || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    <ModalTambahPegawai
      isOpen={showTambahModal}
      onClose={() => { setShowTambahModal(false); setEditData(null); }}
      onSuccess={fetchPegawai}
      editData={editData}
    />
  </> );
};
