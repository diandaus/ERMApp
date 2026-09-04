import React from 'react';
import Swal from 'sweetalert2';

type CatatanDokterTabProps = {
  patient: any;
};

// CatatanDokterTab — padanan tab "Catatan Dokter" di DlgRawatJalan.java
// (Khanza Desktop): log catatan bebas per kunjungan (tabel
// catatan_perawatan), terpisah dari SOAP/CPPT. Dokter otomatis memakai DPJP
// kunjungan ini (patient.kd_dokter), sama seperti KdDok3 yang di Java
// auto-terisi dari KdDok saat form dibuka — tidak perlu cari dokter manual.
export const CatatanDokterTab: React.FC<CatatanDokterTabProps> = ({ patient }) => {
  const [list, setList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [catatan, setCatatan] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pemeriksaan/catatan-dokter/${encodeURIComponent(patient.no_rawat)}`);
      const data = res.ok ? await res.json() : [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [patient.no_rawat]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSimpan = async () => {
    if (!catatan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Catatan wajib diisi!' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pemeriksaan/catatan-dokter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          kd_dokter: patient.kd_dokter || '',
          catatan: catatan.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan catatan dokter');
      }
      setCatatan('');
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Catatan?',
      text: 'Catatan ini akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        tanggal: item.tanggal,
        jam: item.jam,
        kd_dokter: item.kd_dokter,
      });
      const res = await fetch(`/api/pemeriksaan/catatan-dokter?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus catatan');
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus catatan' });
    }
  };

  return (
    <div>
      {/* Form Tambah Catatan */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, padding: 16, background: '#ffffff', marginBottom: 20 }}>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Tulis catatan dokter untuk kunjungan ini..."
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 0,
            fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10 }}>
          <button
            onClick={handleSimpan}
            disabled={saving}
            style={{
              padding: '8px 16px', background: '#1AB1E5', color: '#ffffff',
              border: 'none', borderRadius: 0, fontSize: 13, fontWeight: 400,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {saving ? 'Menyimpan...' : 'Tambah Catatan'}
          </button>
        </div>
      </div>

      {/* Riwayat Catatan */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data...</p>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 0 }}>
          Belum ada catatan dokter untuk kunjungan ini
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 0, padding: '10px 14px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  {item.tanggal} {item.jam} &middot; {item.nm_dokter || item.kd_dokter}
                </div>
                <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.catatan}</div>
              </div>
              <button
                onClick={() => handleHapus(item)}
                style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                title="Hapus Catatan"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
