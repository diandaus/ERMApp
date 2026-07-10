import React from 'react';
import Swal from 'sweetalert2';
import { khanzaRadiologiUrl } from '../utils/khanzaUrl';
import { ModalInputRad } from './ModalInputRad';

type RadTabProps = {
  patient: any;
};

export const RadTab: React.FC<RadTabProps> = ({ patient }) => {
  const [showInputModal, setShowInputModal] = React.useState(false);

  const [riwayatRad, setRiwayatRad] = React.useState<any[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = React.useState(false);

  type RadiologiData = { pemeriksaan: any[]; hasil: any[]; gambar: any[] };
  const [radiolojiData, setRadiolojiData] = React.useState<RadiologiData>({ pemeriksaan: [], hasil: [], gambar: [] });
  const [loadingRadiologi, setLoadingRadiologi] = React.useState(false);
  const [gambarModal, setGambarModal] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchRiwayatRadiologi();
    fetchRadiolojiData();
  }, [patient.no_rawat]);

  const fetchRadiolojiData = async () => {
    setLoadingRadiologi(true);
    try {
      const res = await fetch(`/api/radiologi-data/${encodeURIComponent(patient.no_rawat)}`);
      if (res.ok) {
        const data = await res.json();
        setRadiolojiData({
          pemeriksaan: Array.isArray(data.pemeriksaan) ? data.pemeriksaan : [],
          hasil: Array.isArray(data.hasil) ? data.hasil : [],
          gambar: Array.isArray(data.gambar) ? data.gambar : [],
        });
      }
    } catch { /* silent */ }
    finally { setLoadingRadiologi(false); }
  };

  const fetchRiwayatRadiologi = async () => {
    setLoadingRiwayat(true);
    try {
      const res = await fetch(`/api/radiologi/riwayat/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRiwayatRad(Array.isArray(data) ? data : []);
    } catch {
      setRiwayatRad([]);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const handleDeleteRadiologi = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Radiologi?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus permintaan radiologi');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan radiologi berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchRiwayatRadiologi();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus permintaan radiologi' });
    }
  };

  const formatDateTime = (tgl: string, jam: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';
    let date = '';
    if (tgl.includes('T')) {
      const d = new Date(tgl);
      date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } else if (tgl.includes('-') && tgl.length >= 10) {
      const [y, m, d] = tgl.split('-');
      date = `${d.substring(0, 2)}/${m}/${y}`;
    } else {
      date = tgl;
    }
    return jam && jam !== '00:00:00' ? `${date} ${jam}` : date;
  };

  const hasRadiologiData = radiolojiData.pemeriksaan.length > 0 || radiolojiData.hasil.length > 0 || radiolojiData.gambar.length > 0;

  return (
    <div>

      {/* Tombol Buat Permintaan */}
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
          Buat Permintaan Radiologi
        </button>
      </div>

      {/* Loading state */}
      {(loadingRiwayat || loadingRadiologi) && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data radiologi...</p>
        </div>
      )}

      {/* Riwayat Permintaan Radiologi */}
      {!loadingRiwayat && riwayatRad.length > 0 && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {riwayatRad.map((item, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4 }}>No. Permintaan: {item.noorder}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(item.tgl_permintaan, item.jam_permintaan)}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{item.nm_dokter || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      padding: '4px 12px',
                      background: item.status === 'ralan' ? '#10b981' : '#f59e0b',
                      color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    }}>
                      {item.status === 'ralan' ? 'Ralan' : 'Pending'}
                    </div>
                    <button
                      onClick={() => handleDeleteRadiologi(item.noorder)}
                      style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                      title="Hapus Permintaan"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Diagnosis:</strong> {item.diagnosa_klinis}</div>
                {item.informasi_tambahan && (
                  <div style={{ fontSize: 13, marginBottom: 8, color: '#6b7280' }}><strong>Info Tambahan:</strong> {item.informasi_tambahan}</div>
                )}
                {item.detail_pemeriksaan?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Detail Pemeriksaan:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {item.detail_pemeriksaan.map((d: any, i: number) => (
                        <div key={i} style={{ padding: '4px 10px', background: '#e0f2fe', border: '1px solid #1AB1E5', borderRadius: 6, fontSize: 11, color: '#0891B2' }}>
                          {d.nm_perawatan || d.kd_jenis_prw}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Pemeriksaan Radiologi */}
      {!loadingRadiologi && hasRadiologiData && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
           Data Pemeriksaan Radiologi
            <button onClick={fetchRadiolojiData} style={{ marginLeft: 'auto', padding: '4px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              ↻ Refresh
            </button>
          </h4>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {/* SEKSI 1 — Pemeriksaan Radiologi */}
                <tr>
                  <td colSpan={7} style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '8px 14px', borderBottom: '1px solid #bfdbfe' }}>
                    Pemeriksaan Radiologi
                  </td>
                </tr>
                {radiolojiData.pemeriksaan.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '14px 16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      Belum ada data pemeriksaan
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr style={{ background: '#f3f4f6' }}>
                      {['No.', 'Tanggal/Jam', 'Kode', 'Nama Pemeriksaan', 'Dokter PJ', 'Petugas', 'Biaya'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 10px', textAlign: i === 6 ? 'right' : 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                    {radiolojiData.pemeriksaan.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 10px', color: '#6b7280' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{p.tgl_periksa}{p.jam ? ' ' + p.jam : ''}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#1AB1E5' }}>{p.kd_jenis_prw}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 500, color: '#111827' }}>{p.nm_perawatan}</div>
                          {p.proyeksi && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.proyeksi}</div>}
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{p.nm_dokter || '-'}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{p.nama_petugas || '-'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {p.biaya > 0 ? 'Rp ' + Number(p.biaya).toLocaleString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* SEKSI 2 — Bacaan/Hasil Radiologi */}
                <tr>
                  <td colSpan={7} style={{ fontSize: 13, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '8px 14px', borderBottom: '1px solid #a7f3d0' }}>
                    Bacaan / Hasil Radiologi
                  </td>
                </tr>
                {radiolojiData.hasil.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '14px 16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      Belum ada hasil bacaan
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Tanggal/Jam</th>
                      <th colSpan={5} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Hasil</th>
                    </tr>
                    {radiolojiData.hasil.map((h, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 10px', color: '#6b7280', verticalAlign: 'top' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{h.tgl_periksa}{h.jam ? ' ' + h.jam : ''}</td>
                        <td colSpan={5} style={{ padding: '8px 10px', lineHeight: 1.6 }}>
                          {h.hasil ? h.hasil.split('\n').map((line: string, li: number) => (
                            <React.Fragment key={li}>{line}{li < h.hasil.split('\n').length - 1 && <br />}</React.Fragment>
                          )) : '-'}
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* SEKSI 3 — Gambar Radiologi */}
                <tr>
                  <td colSpan={7} style={{ fontSize: 13, fontWeight: 700, color: '#7c2d12', background: '#ffedd5', padding: '8px 14px', borderBottom: '1px solid #fed7aa' }}>
                    Gambar Radiologi
                  </td>
                </tr>
                {radiolojiData.gambar.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '14px 16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      Belum ada gambar
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Tanggal/Jam</th>
                      <th colSpan={5} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Gambar</th>
                    </tr>
                    {radiolojiData.gambar.map((g, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fff7ed')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 10px', color: '#6b7280', verticalAlign: 'top' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{g.tgl_periksa}{g.jam ? ' ' + g.jam : ''}</td>
                        <td colSpan={5} style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                          {g.lokasi_gambar ? (
                            <a
                              href={khanzaRadiologiUrl(g.lokasi_gambar)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); setGambarModal(khanzaRadiologiUrl(g.lokasi_gambar)); }}
                            >
                              <img
                                src={khanzaRadiologiUrl(g.lokasi_gambar)}
                                alt="Gambar Radiologi"
                                style={{ width: '100%', maxWidth: 450, height: 'auto', cursor: 'zoom-in', border: '1px solid #e5e7eb', borderRadius: 4 }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Radiologi */}
      {showInputModal && (
        <ModalInputRad
          patient={patient}
          onClose={() => setShowInputModal(false)}
          onSaved={fetchRiwayatRadiologi}
        />
      )}

      {/* Modal Gambar Radiologi */}
      {gambarModal && (
        <div
          onClick={() => setGambarModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}
        >
          <img
            src={gambarModal}
            alt="Gambar Radiologi"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setGambarModal(null)}
            style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >✕</button>
        </div>
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
