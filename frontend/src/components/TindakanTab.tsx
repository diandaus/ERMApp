import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputTindakan } from './ModalInputTindakan';

type TindakanTabProps = {
  patient: any;
};

export const TindakanTab: React.FC<TindakanTabProps> = ({ patient }) => {
  const [tindakanList, setTindakanList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showInputModal, setShowInputModal] = React.useState(false);

  React.useEffect(() => {
    fetchTindakanList();
  }, [patient.no_rawat]);

  const fetchTindakanList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tindakan-ralan/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const allTindakan = [
        ...(data.tindakan_dokter || []),
        ...(data.tindakan_paramedis || []),
        ...(data.tindakan_dokter_paramedis || []),
      ];

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const filtered = allTindakan.filter((item: any) => {
        if (!item.tgl_perawatan) return false;
        const tgl = item.tgl_perawatan;
        if (tgl.includes('/')) {
          const [d, m, y] = tgl.split('/');
          return `${y}-${m}-${d}` === todayStr;
        }
        if (tgl.includes('T')) {
          const d = new Date(tgl);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr;
        }
        if (tgl.includes('-')) return tgl.substring(0, 10) === todayStr;
        return false;
      });

      setTindakanList(filtered);
    } catch {
      setTindakanList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTindakan = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Tindakan?',
      text: `Apakah Anda yakin ingin menghapus tindakan "${item.nm_perawatan}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      let tglPerawatan = item.tgl_perawatan;
      if (tglPerawatan?.includes('T')) tglPerawatan = tglPerawatan.split('T')[0];

      const params = new URLSearchParams({
        no_rawat: item.no_rawat,
        kd_jenis_prw: item.kd_jenis_prw,
        tgl_perawatan: tglPerawatan,
        jam_rawat: item.jam_rawat,
        kd_dokter: item.kd_dokter,
      });

      const res = await fetch(`/api/tindakan/delete?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus tindakan');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Tindakan berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchTindakanList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus tindakan' });
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

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div>

      {/* Tombol Input Tindakan */}
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
          Input Tindakan
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat riwayat...</p>
        </div>
      )}

      {/* Riwayat Tindakan */}
      {!loading && tindakanList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tindakanList.map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4 }}>{item.nm_perawatan}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>📅 {formatDateTime(item.tgl_perawatan, item.jam_rawat)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>👨‍⚕️ {item.nm_dokter || '-'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ padding: '4px 12px', background: '#d1fae5', color: '#065f46', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {formatRupiah(item.biaya_rawat || 0)}
                  </div>
                  <button
                    onClick={() => handleDeleteTindakan(item)}
                    style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                    title="Hapus Tindakan"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Input Tindakan */}
      {showInputModal && (
        <ModalInputTindakan
          patient={patient}
          onClose={() => setShowInputModal(false)}
          onSaved={fetchTindakanList}
        />
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
