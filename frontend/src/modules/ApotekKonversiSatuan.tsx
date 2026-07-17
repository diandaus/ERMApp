import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Konversi Satuan (item #10 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Konversi" (inventory/DlgKonversi.java) —
// CRUD aturan konversi antar satuan barang, mis. "10 Ampul = 1 Box".
// Java cuma Simpan (insert) + Hapus (match kode_sat+sat_konversi), tidak
// ada Update — lihat backend/apotek_konversi_satuan_handler.go.
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
type KonversiSatuan = {
  nilai: number;
  kode_sat: string;
  nama_sat: string;
  nilai_konversi: number;
  sat_konversi: string;
  nama_sat_konversi: string;
};

export const ApotekKonversiSatuanView: React.FC = () => {
  const [items, setItems] = React.useState<KonversiSatuan[]>([]);
  const [satuanOpsi, setSatuanOpsi] = React.useState<KvOpsi[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');

  const [nilai, setNilai] = React.useState(1);
  const [kodeSat, setKodeSat] = React.useState('');
  const [nilaiKonversi, setNilaiKonversi] = React.useState(1);
  const [satKonversi, setSatKonversi] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/apotek/konversi-satuan${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`);
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
    fetch('/api/apotek/referensi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSatuanOpsi(data.satuan || []))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setNilai(1);
    setKodeSat('');
    setNilaiKonversi(1);
    setSatKonversi('');
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeSat || !satKonversi) {
      Swal.fire({ icon: 'warning', title: 'Satuan ke-1 dan ke-2 wajib dipilih' });
      return;
    }
    if (kodeSat === satKonversi) {
      Swal.fire({ icon: 'warning', title: 'Satuan ke-1 dan ke-2 tidak boleh sama' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/konversi-satuan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nilai, kode_sat: kodeSat, nilai_konversi: nilaiKonversi, sat_konversi: satKonversi }),
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

  const handleEdit = (item: KonversiSatuan) => {
    setNilai(item.nilai);
    setKodeSat(item.kode_sat);
    setNilaiKonversi(item.nilai_konversi);
    setSatKonversi(item.sat_konversi);
    setEditing(true);
  };

  const handleDelete = async (item: KonversiSatuan) => {
    const confirm = await Swal.fire({
      title: 'Hapus Konversi Ini?',
      text: `${item.nilai} ${item.nama_sat || item.kode_sat} = ${item.nilai_konversi} ${item.nama_sat_konversi || item.sat_konversi}`,
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/konversi-satuan?kode_sat=${encodeURIComponent(item.kode_sat)}&sat_konversi=${encodeURIComponent(item.sat_konversi)}`, { method: 'DELETE' });
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
        Aturan konversi antar satuan barang, mis. "10 Ampul = 1 Box" — dipakai saat menghitung stok lintas satuan.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 90 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nilai Ke-1</label>
          <input type="number" step="any" style={numberInputStyle} value={nilai} onChange={(e) => setNilai(Number(e.target.value))} />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Satuan Ke-1</label>
          <PillSelect value={kodeSat} onChange={setKodeSat} options={[{ value: '', label: '- Pilih Satuan -' }, ...satuanOpsi.map((s) => ({ value: s.kode, label: s.nama }))]} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#059669', paddingBottom: 8 }}>=</div>
        <div style={{ width: 90 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nilai Ke-2</label>
          <input type="number" step="any" style={numberInputStyle} value={nilaiKonversi} onChange={(e) => setNilaiKonversi(Number(e.target.value))} />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Satuan Ke-2</label>
          <PillSelect value={satKonversi} onChange={setSatKonversi} options={[{ value: '', label: '- Pilih Satuan -' }, ...satuanOpsi.map((s) => ({ value: s.kode, label: s.nama }))]} />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : editing ? 'Update' : '+ Tambah'}
        </button>
        {editing && (
          <button type="button" onClick={resetForm} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            Batal
          </button>
        )}
      </form>

      <input
        type="text"
        placeholder="Cari satuan..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ ...numberInputStyle, maxWidth: 280 }}
      />

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan Ke-1</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan Ke-2</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.kode_sat}-${item.sat_konversi}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nilai} {item.nama_sat || item.kode_sat}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nilai_konversi} {item.nama_sat_konversi || item.sat_konversi}</td>
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
