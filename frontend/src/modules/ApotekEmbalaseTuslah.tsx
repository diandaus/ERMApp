import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Set Embalase dan Tuslah (item #5 dari 13 sub-menu Pengaturan).
// Cocok dengan dialog Khanza Desktop "Set Embalase & Tuslah"
// (setting/DlgSetEmbalase.java) — paling sederhana di antara sub-fitur
// Pengaturan Apotek lain: 1 baris system-wide, 2 nominal Rupiah (bukan
// persentase). Lihat backend/apotek_embalase_tuslah_handler.go.
// ============================================================================

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

type SetEmbalase = { embalase_per_obat: number; tuslah_per_obat: number };

export const ApotekEmbalaseTuslahView: React.FC = () => {
  const [embalase, setEmbalase] = React.useState(0);
  const [tuslah, setTuslah] = React.useState(0);
  const [saved, setSaved] = React.useState<SetEmbalase | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/embalase-tuslah');
      const data = await res.json();
      setSaved(data || null);
      if (data) {
        setEmbalase(data.embalase_per_obat);
        setTuslah(data.tuslah_per_obat);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/embalase-tuslah', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embalase_per_obat: embalase, tuslah_per_obat: tuslah }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await fetchData();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Embalase & Tuslah?',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch('/api/apotek/embalase-tuslah', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      setEmbalase(0);
      setTuslah(0);
      await fetchData();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  if (loading) return <div style={{ color: '#6b7280', fontSize: 13 }}>Memuat...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Biaya embalase (kemasan) dan tuslah (jasa peracikan) per obat, ditambahkan ke tagihan resep. Hanya satu
        pengaturan yang berlaku di seluruh sistem — menyimpan yang baru akan menggantikan yang lama.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Biaya Embalase Obat (Rp)</label>
          <input type="number" step="any" style={numberInputStyle} value={embalase} onChange={(e) => setEmbalase(Number(e.target.value))} />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Biaya Tuslah Obat (Rp)</label>
          <input type="number" step="any" style={numberInputStyle} value={tuslah} onChange={(e) => setTuslah(Number(e.target.value))} />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Biaya Embalase Obat</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Biaya Tuslah Obat</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!saved ? (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
            ) : (
              <tr>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Rp {saved.embalase_per_obat.toLocaleString('id-ID')}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Rp {saved.tuslah_per_obat.toLocaleString('id-ID')}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleDelete}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
