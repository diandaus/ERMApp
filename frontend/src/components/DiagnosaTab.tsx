import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputDiagnosa } from './ModalInputDiagnosa';

type DiagnosaTabProps = {
  patient: any;
};

export const DiagnosaTab: React.FC<DiagnosaTabProps> = ({ patient }) => {
  const [diagnosaList, setDiagnosaList] = React.useState<any[]>([]);
  const [prosedurList, setProsedurList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showInputModal, setShowInputModal] = React.useState(false);

  React.useEffect(() => {
    fetchData();
  }, [patient.no_rawat]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [diagnosaRes, prosedurRes] = await Promise.all([
        fetch(`/api/pemeriksaan/diagnosa/${encodeURIComponent(patient.no_rawat)}`),
        fetch(`/api/pemeriksaan/prosedur/${encodeURIComponent(patient.no_rawat)}`),
      ]);
      const diagnosaData = diagnosaRes.ok ? await diagnosaRes.json() : [];
      const prosedurData = prosedurRes.ok ? await prosedurRes.json() : [];
      setDiagnosaList(Array.isArray(diagnosaData) ? diagnosaData : []);
      setProsedurList(Array.isArray(prosedurData) ? prosedurData : []);
    } catch {
      setDiagnosaList([]);
      setProsedurList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiagnosa = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Diagnosa?',
      text: `Apakah Anda yakin ingin menghapus diagnosa "${item.nm_penyakit}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const params = new URLSearchParams({ no_rawat: patient.no_rawat, kd_penyakit: item.kd_penyakit });
      const res = await fetch(`/api/pemeriksaan/diagnosa?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus diagnosa');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Diagnosa berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus diagnosa' });
    }
  };

  const handleDeleteProsedur = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Prosedur?',
      text: `Apakah Anda yakin ingin menghapus prosedur "${item.deskripsi_panjang}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const params = new URLSearchParams({ no_rawat: patient.no_rawat, kode: item.kode });
      const res = await fetch(`/api/pemeriksaan/prosedur?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus prosedur');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Prosedur berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus prosedur' });
    }
  };

  return (
    <div>
      {/* Tombol Input Diagnosa/Prosedur */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowInputModal(true)}
          style={{
            padding: '10px 20px', background: '#1AB1E5', color: '#ffffff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0891B2'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1AB1E5'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Input Diagnosa & Prosedur
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data...</p>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Diagnosa */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Diagnosa (ICD10)</div>
            {diagnosaList.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                Belum ada diagnosa untuk kunjungan ini
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {diagnosaList.map((item, idx) => (
                  <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1AB1E5' }}>{item.nm_penyakit}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {item.kd_penyakit} • {item.prioritas === 1 ? 'Diagnosa Utama' : `Diagnosa Sekunder ${item.prioritas - 1}`}
                        {item.status_penyakit && ` • ${item.status_penyakit}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDiagnosa(item)}
                      style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                      title="Hapus Diagnosa"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prosedur */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Prosedur (ICD9)</div>
            {prosedurList.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                Belum ada prosedur untuk kunjungan ini
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prosedurList.map((item, idx) => (
                  <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1AB1E5' }}>{item.deskripsi_panjang}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {item.kode} • Urutan {item.prioritas} • Jumlah {item.jumlah}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteProsedur(item)}
                      style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                      title="Hapus Prosedur"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showInputModal && (
        <ModalInputDiagnosa
          patient={patient}
          onClose={() => setShowInputModal(false)}
          onSaved={fetchData}
        />
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
