import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Set Harga Obat Ranap (item #4 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Harga Obat Ranap"
// (setting/DlgSetHargaObatRanap.java) — sama pola dengan Set Harga Obat
// Ralan (ApotekHargaObatRalan.tsx), tapi PK majemuk (kd_pj, kelas) karena
// ranap punya persentase berbeda per kelas kamar. Java cuma Simpan (insert)
// + Hapus, tidak ada Update/Terapkan — lihat backend/apotek_harga_obat_ranap_handler.go.
// ============================================================================

const pillSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 32px 7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#ffffff',
  color: '#111827',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
};

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: '#059669',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const PillSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={pillSelectStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

type KvOpsi = { kode: string; nama: string };
type HargaObatRanap = { kd_pj: string; png_jawab: string; kelas: string; hargajual: number };

export const ApotekHargaObatRanapView: React.FC = () => {
  const [items, setItems] = React.useState<HargaObatRanap[]>([]);
  const [penjabOpsi, setPenjabOpsi] = React.useState<KvOpsi[]>([]);
  const [kelasOpsi, setKelasOpsi] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');

  const [kdPj, setKdPj] = React.useState('');
  const [kelas, setKelas] = React.useState('');
  const [hargajual, setHargajual] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/apotek/harga-obat-ranap${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  React.useEffect(() => {
    fetch('/api/apotek/harga-obat-ralan/penjab-opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPenjabOpsi(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/apotek/harga-obat-ranap/kelas-opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setKelasOpsi(list);
        if (list.length > 0) setKelas((prev) => prev || list[0]);
      })
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setKdPj('');
    setKelas(kelasOpsi[0] || '');
    setHargajual(0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdPj) {
      Swal.fire({ icon: 'warning', title: 'Cara bayar wajib dipilih' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/harga-obat-ranap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_pj: kdPj, kelas, hargajual }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      resetForm();
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: HargaObatRanap) => {
    setKdPj(item.kd_pj);
    setKelas(item.kelas);
    setHargajual(item.hargajual);
  };

  const handleDelete = async (item: HargaObatRanap) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Ini?',
      text: `${item.png_jawab} — ${item.kelas}`,
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/harga-obat-ranap?kd_pj=${encodeURIComponent(item.kd_pj)}&kelas=${encodeURIComponent(item.kelas)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Persentase harga jual obat rawat inap dari harga beli, berbeda per cara bayar (Umum, BPJS, Asuransi, dll) dan
        per kelas kamar.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cara Bayar</label>
          <PillSelect
            value={kdPj}
            onChange={setKdPj}
            options={[{ value: '', label: '- Pilih Cara Bayar -' }, ...penjabOpsi.map((p) => ({ value: p.kode, label: p.nama }))]}
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Kelas Kamar</label>
          <PillSelect value={kelas} onChange={setKelas} options={kelasOpsi.map((k) => ({ value: k, label: k }))} />
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Harga Obat (% dari Harga Beli)</label>
          <input type="number" step="any" style={numberInputStyle} value={hargajual} onChange={(e) => setHargajual(Number(e.target.value))} />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
        {kdPj && (
          <button type="button" onClick={resetForm} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            Batal
          </button>
        )}
      </form>

      <input
        type="text"
        placeholder="Cari cara bayar..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ ...numberInputStyle, maxWidth: 280 }}
      />

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Cara Bayar</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kelas Kamar</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Harga Obat (%)</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.kd_pj}-${item.kelas}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.png_jawab}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.kelas}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.hargajual}%</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => handleEdit(item)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(item)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
