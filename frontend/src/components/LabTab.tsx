import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputLab } from './ModalInputLab';

type LabTabProps = {
  patient: any;
};

export const LabTab: React.FC<LabTabProps> = ({ patient }) => {
  const [showInputModal, setShowInputModal] = React.useState(false);

  const [riwayatPK, setRiwayatPK] = React.useState<any[]>([]);
  const [riwayatPA, setRiwayatPA] = React.useState<any[]>([]);
  const [loadingRiwayatPK, setLoadingRiwayatPK] = React.useState(false);
  const [loadingRiwayatPA, setLoadingRiwayatPA] = React.useState(false);

  const [showModalHasil, setShowModalHasil] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [hasilLabData, setHasilLabData] = React.useState<any>(null);

  const [hasilPeriksa, setHasilPeriksa] = React.useState<any[]>([]);
  const [loadingHasilPeriksa, setLoadingHasilPeriksa] = React.useState(false);

  React.useEffect(() => {
    fetchRiwayatPK();
    fetchRiwayatPA();
    fetchHasilPeriksa();
  }, [patient.no_rawat]);

  const fetchHasilPeriksa = async () => {
    setLoadingHasilPeriksa(true);
    try {
      const noRawat = encodeURIComponent(patient.no_rawat);
      const [resPK, resPA] = await Promise.all([
        fetch(`/api/lab/hasil-detail?kategori=PK&no_rawat=${noRawat}`),
        fetch(`/api/lab/hasil-detail?kategori=PA&no_rawat=${noRawat}`),
      ]);
      const [dataPK, dataPA] = await Promise.all([
        resPK.ok ? resPK.json() : null,
        resPA.ok ? resPA.json() : null,
      ]);
      const gabungan = [
        ...(dataPK?.hasil || []).map((item: any) => ({ ...item, kategori: 'pk' })),
        ...(dataPA?.hasil || []).map((item: any) => ({ ...item, kategori: 'pa' })),
      ];
      gabungan.sort((a, b) => `${b.tgl_periksa} ${b.jam}`.localeCompare(`${a.tgl_periksa} ${a.jam}`));
      setHasilPeriksa(gabungan);
    } catch {
      setHasilPeriksa([]);
    } finally {
      setLoadingHasilPeriksa(false);
    }
  };

  const filterToday = (data: any[]) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return data.filter((item: any) => {
      if (!item.tgl_permintaan) return false;
      if (item.tgl_permintaan.includes('T')) {
        const d = new Date(item.tgl_permintaan);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr;
      }
      if (item.tgl_permintaan.includes('-')) {
        return item.tgl_permintaan.split(' ')[0] === todayStr;
      }
      return false;
    });
  };

  const fetchRiwayatPK = async () => {
    setLoadingRiwayatPK(true);
    try {
      const res = await fetch(`/api/lab/riwayat-pk/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRiwayatPK(filterToday(Array.isArray(data) ? data : []));
    } catch {
      setRiwayatPK([]);
    } finally {
      setLoadingRiwayatPK(false);
    }
  };

  const fetchRiwayatPA = async () => {
    setLoadingRiwayatPA(true);
    try {
      const res = await fetch(`/api/lab/riwayat-pa/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRiwayatPA(filterToday(Array.isArray(data) ? data : []));
    } catch {
      setRiwayatPA([]);
    } finally {
      setLoadingRiwayatPA(false);
    }
  };

  const handleDeleteLabPK = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PK?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lab/permintaan-pk/${encodeURIComponent(noorder)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus permintaan lab');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan lab PK berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchRiwayatPK();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus permintaan lab' });
    }
  };

  const handleDeleteLabPA = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PA?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lab/permintaan-pa/${encodeURIComponent(noorder)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus permintaan lab');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan lab PA berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchRiwayatPA();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus permintaan lab' });
    }
  };

  const handleLihatHasil = async (item: any, kategori: 'pk' | 'pa') => {
    setSelectedOrder(item);
    setHasilLabData({ detail_pemeriksaan: item.detail_pemeriksaan || [] });
    setShowModalHasil(true);
    try {
      const res = await fetch(
        `/api/lab/hasil-detail?noorder=${item.noorder}&kategori=${kategori.toUpperCase()}&no_rawat=${encodeURIComponent(patient.no_rawat)}`
      );
      if (res.ok) setHasilLabData(await res.json());
    } catch {}
  };

  const closeModalHasil = () => {
    setShowModalHasil(false);
    setSelectedOrder(null);
    setHasilLabData(null);
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

  const handleSaved = () => {
    fetchRiwayatPK();
    fetchRiwayatPA();
  };

  return (
    <div>

      {/* Tombol Buat Permintaan */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowInputModal(true)}
          style={{
            padding: '10px 20px',
            background: '#1AB1E5',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0891B2'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1AB1E5'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Buat Permintaan Lab
        </button>
      </div>

      {/* Loading state */}
      {(loadingRiwayatPK || loadingRiwayatPA || loadingHasilPeriksa) && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data laboratorium...</p>
        </div>
      )}

      {/* Riwayat Permintaan Lab */}
      {!loadingRiwayatPK && !loadingRiwayatPA && (riwayatPK.length > 0 || riwayatPA.length > 0) && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ...riwayatPK.map((item) => ({ item, kategori: 'pk' as const })),
              ...riwayatPA.map((item) => ({ item, kategori: 'pa' as const })),
            ].map(({ item, kategori }, idx) => (
              <RiwayatCard
                key={idx}
                item={item}
                kategori={kategori}
                onDelete={() => (kategori === 'pk' ? handleDeleteLabPK(item.noorder) : handleDeleteLabPA(item.noorder))}
                onLihatHasil={() => handleLihatHasil(item, kategori)}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hasil Periksa Laboratorium */}
      {!loadingHasilPeriksa && hasilPeriksa.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2v6.5L3 20a1 1 0 0 0 .9 1.5h16.2a1 1 0 0 0 .9-1.5L15 8.5V2"></path>
              <path d="M9 2h6"></path>
              <path d="M7 15h10"></path>
            </svg>
            Hasil Periksa Laboratorium
          </h4>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1AB1E5', color: 'white' }}>
                  {['Tanggal', 'Nama Tindakan', 'Hasil', 'Nilai Rujukan', 'Keterangan'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Nama Tindakan' ? 'left' : 'center', fontSize: 12, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasilPeriksa.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr style={{ background: '#f0f9ff' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {formatDateTime(item.tgl_periksa, item.jam)}
                      </td>
                      <td colSpan={4} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1AB1E5' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, marginRight: 8,
                          background: item.kategori === 'pk' ? '#e0f2fe' : '#f3e8ff',
                          color: item.kategori === 'pk' ? '#0891B2' : '#7c3aed',
                        }}>
                          {item.kategori === 'pk' ? 'LAB PK' : 'LAB PA'}
                        </span>
                        {item.nm_perawatan}
                      </td>
                    </tr>
                    {item.detail?.length > 0 ? item.detail.map((d: any, di: number) => (
                      <tr key={di} style={{ background: '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                        <td></td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>{d.pemeriksaan}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151', textAlign: 'center', fontWeight: 500 }}>{d.nilai || '-'} {d.satuan}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.nilai_rujukan || '-'} {d.satuan}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.keterangan || '-'}</td>
                      </tr>
                    )) : (
                      <tr style={{ background: '#ffffff' }}>
                        <td></td>
                        <td colSpan={4} style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Belum ada hasil detail</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Lab */}
      {showInputModal && (
        <ModalInputLab
          patient={patient}
          onClose={() => setShowInputModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Modal Hasil Lab */}
      {showModalHasil && selectedOrder && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
          onClick={closeModalHasil}
        >
          <div
            style={{
              background: '#ffffff', borderRadius: 12, padding: 24,
              maxWidth: 800, width: '100%', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>🔬 Hasil Pemeriksaan Lab</h3>
              <button
                onClick={closeModalHasil}
                style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >
                ✕ Tutup
              </button>
            </div>

            {hasilLabData?.header && (
              <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['No. Rawat', hasilLabData.header.no_rawat],
                    ['No. RM', hasilLabData.header.no_rkm_medis],
                    ['Nama Pasien', hasilLabData.header.nm_pasien],
                    ['Cara Bayar', hasilLabData.header.png_jawab],
                    ['Tanggal Pemeriksaan', formatDateTime(hasilLabData.header.tgl_periksa, hasilLabData.header.jam)],
                    ['Dokter', hasilLabData.header.nm_dokter],
                    ['Petugas Lab', hasilLabData.header.nm_petugas || '-'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Detail Pemeriksaan:</div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1AB1E5', color: 'white' }}>
                    {['Pemeriksaan', 'Hasil', 'Satuan', 'Nilai Rujukan', 'Keterangan'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Pemeriksaan' ? 'left' : 'center', fontSize: 12, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!hasilLabData?.hasil || hasilLabData.hasil.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                        {hasilLabData?.detail_pemeriksaan?.length > 0
                          ? 'Menampilkan daftar permintaan pemeriksaan. Hasil lab belum tersedia.'
                          : 'Belum ada data pemeriksaan'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {hasilLabData.hasil.map((item: any, idx: number) => (
                        <React.Fragment key={idx}>
                          <tr style={{ background: '#f0f9ff' }}>
                            <td colSpan={5} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1AB1E5' }}>
                              {item.nm_perawatan} (Rp {item.biaya?.toLocaleString() || 0})
                            </td>
                          </tr>
                          {item.detail?.length > 0 ? item.detail.map((d: any, di: number) => (
                            <tr key={di} style={{ background: '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '8px 12px 8px 24px', fontSize: 12, color: '#374151' }}>{d.pemeriksaan}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151', textAlign: 'center', fontWeight: 500 }}>{d.nilai || '-'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.satuan || '-'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.nilai_rujukan || '-'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.keterangan || '-'}</td>
                            </tr>
                          )) : (
                            <tr style={{ background: '#ffffff' }}>
                              <td colSpan={5} style={{ padding: '8px 12px 8px 24px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Belum ada hasil detail</td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {hasilLabData.total_biaya > 0 && (
                        <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                          <td colSpan={5} style={{ padding: 12, fontSize: 13, color: '#111827', textAlign: 'right' }}>
                            Total Biaya: Rp {hasilLabData.total_biaya.toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {(hasilLabData?.kesan || hasilLabData?.saran) && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {hasilLabData.kesan && (
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>Kesan:</div>
                    <div style={{ fontSize: 12, color: '#166534' }}>{hasilLabData.kesan}</div>
                  </div>
                )}
                {hasilLabData.saran && (
                  <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, border: '1px solid #fbbf24' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Saran:</div>
                    <div style={{ fontSize: 12, color: '#92400e' }}>{hasilLabData.saran}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};

type RiwayatCardProps = {
  item: any;
  kategori: 'pk' | 'pa';
  onDelete: () => void;
  onLihatHasil: () => void;
  formatDateTime: (tgl: string, jam: string) => string;
};

const RiwayatCard: React.FC<RiwayatCardProps> = ({ item, kategori, onDelete, onLihatHasil, formatDateTime }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#ffffff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
            background: kategori === 'pk' ? '#e0f2fe' : '#f3e8ff',
            color: kategori === 'pk' ? '#0891B2' : '#7c3aed',
          }}>
            {kategori === 'pk' ? 'LAB PK' : 'LAB PA'}
          </span>
          No. Permintaan: {item.noorder}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(item.tgl_permintaan, item.jam_permintaan)}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{item.nm_dokter || '-'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            padding: '4px 12px',
            background: item.status === 'ralan' ? '#10b981' : '#f59e0b',
            color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 600,
          }}>
            {item.status === 'ralan' ? 'Ralan' : 'Pending'}
          </div>
          <button
            onClick={onDelete}
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
        <button
          onClick={onLihatHasil}
          style={{ padding: '6px 12px', background: '#ffffff', color: '#1AB1E5', border: '1.5px solid #1AB1E5', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#e0f2fe'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#ffffff'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          Lihat Hasil
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
);
