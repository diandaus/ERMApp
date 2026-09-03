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
      {/* Tombol Input Diagnosa/Prosedur — rata kiri, ukuran/gaya PERSIS
          "Input Resep" di ResepTab.tsx (padding 8px 16px, radius 0,
          fontSize 13) — per permintaan user, ganti dari versi lama (rata
          kanan, radius 4, lebih besar). */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowInputModal(true)}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0891B2'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1AB1E5'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <div style={{ fontSize: 12, fontWeight: 400, color: '#374151', marginBottom: 8 }}>Diagnosa (ICD10)</div>
            {diagnosaList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Diagnosa</div>
                <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada diagnosa untuk kunjungan ini.</div>
              </div>
            ) : (
              // Tabel "Diagnosa Tersimpan" PERSIS referensi Khanza Desktop
              // (screenshot user): Kode|Nama Penyakit|Status|Kasus|Urut —
              // ganti dari kartu list lama, kolom Aksi ditambahkan di kanan
              // utk tombol Hapus (tidak ada di referensi, tapi tetap perlu).
              <div style={{ border: '1px solid #d1d5db', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        {(['Kode', 'Nama Penyakit', 'Status', 'Kasus', 'Urut', 'Aksi'] as const).map((h) => (
                          <th key={h} style={{ padding: '8px 10px', fontWeight: 400, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', width: h === 'Nama Penyakit' ? '100%' : h === 'Kode' ? undefined : '1%', textAlign: h === 'Urut' || h === 'Aksi' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosaList.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', whiteSpace: 'nowrap' }}>{item.kd_penyakit}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', width: '100%' }}>{item.nm_penyakit}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', whiteSpace: 'nowrap', width: '1%' }}>{item.status || 'Ralan'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', whiteSpace: 'nowrap', width: '1%' }}>{item.status_penyakit || '-'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>{item.prioritas}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>
                            <button
                              onClick={() => handleDeleteDiagnosa(item)}
                              style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 400, cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                              title="Hapus Diagnosa"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Prosedur */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 400, color: '#374151', marginBottom: 8 }}>Prosedur (ICD9)</div>
            {prosedurList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Prosedur</div>
                <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada prosedur untuk kunjungan ini.</div>
              </div>
            ) : (
              // Tabel "Prosedur Tersimpan" PERSIS referensi Khanza Desktop
              // (screenshot user): Kode|Nama Prosedur|Status|Urut|Jml — ganti
              // dari kartu list lama, kolom Aksi ditambahkan di kanan utk
              // tombol Hapus (tidak ada di referensi, tapi tetap perlu).
              <div style={{ border: '1px solid #d1d5db', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        {(['Kode', 'Nama Prosedur', 'Status', 'Urut', 'Jml', 'Aksi'] as const).map((h) => (
                          <th key={h} style={{ padding: '8px 10px', fontWeight: 400, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', width: h === 'Nama Prosedur' ? '100%' : h === 'Kode' ? undefined : '1%', textAlign: h === 'Urut' || h === 'Jml' || h === 'Aksi' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prosedurList.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', whiteSpace: 'nowrap' }}>{item.kode}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', width: '100%' }}>{item.deskripsi_panjang}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', whiteSpace: 'nowrap', width: '1%' }}>{item.status || 'Ralan'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>{item.prioritas}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#111827', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>{item.jumlah}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}>
                            <button
                              onClick={() => handleDeleteProsedur(item)}
                              style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 400, cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                              title="Hapus Prosedur"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
