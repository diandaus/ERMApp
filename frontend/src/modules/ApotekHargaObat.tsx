import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Set Harga Obat (item #2 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Set Harga Obat" (setting/DlgSetHarga.java),
// 4 sub-tab: Pengaturan Harga, Harga Umum, Harga Per Jenis, Harga Per
// Barang. Lihat backend/apotek_harga_obat_handler.go untuk rumus apply
// (ROUND(h_beli + h_beli*pct/100), identik dengan Java).
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
  style?: React.CSSProperties;
}> = ({ value, onChange, options, style }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', ...style }}>
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

type HargaPct = {
  ralan: number;
  kelas1: number;
  kelas2: number;
  kelas3: number;
  utama: number;
  vip: number;
  vvip: number;
  beliluar: number;
  jualbebas: number;
  karyawan: number;
};

const emptyPct = (): HargaPct => ({
  ralan: 0, kelas1: 0, kelas2: 0, kelas3: 0, utama: 0, vip: 0, vvip: 0, beliluar: 0, jualbebas: 0, karyawan: 0,
});

// Label "keuntungan" persis urutan & teks dialog Khanza Desktop.
const PCT_FIELDS: { key: keyof HargaPct; label: string }[] = [
  { key: 'ralan', label: 'Keuntungan di Rawat Jalan' },
  { key: 'kelas1', label: 'Keuntungan di Ranap Kelas 1' },
  { key: 'kelas2', label: 'Keuntungan di Ranap Kelas 2' },
  { key: 'kelas3', label: 'Keuntungan di Ranap Kelas 3' },
  { key: 'utama', label: 'Keuntungan di Ranap Kelas Utama' },
  { key: 'vip', label: 'Keuntungan di Ranap Kelas VIP' },
  { key: 'vvip', label: 'Keuntungan di Ranap Kelas VVIP' },
  { key: 'beliluar', label: 'Keuntungan Jika Beli dari Apotek Lain' },
  { key: 'jualbebas', label: 'Keuntungan di Penjualan Bebas' },
  { key: 'karyawan', label: 'Keuntungan Jika Pasien/Pembeli Karyawan' },
];

const PctForm: React.FC<{ value: HargaPct; onChange: (v: HargaPct) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
    {PCT_FIELDS.map((f) => (
      <div key={f.key}>
        <label style={{ display: 'block', fontSize: 11.5, color: '#374151', marginBottom: 4 }}>{f.label} (%)</label>
        <input
          type="number"
          step="any"
          style={numberInputStyle}
          value={value[f.key]}
          onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
        />
      </div>
    ))}
  </div>
);

// ---- Tab: Pengaturan Harga (set_harga_obat) --------------------------------

const TabPengaturanHarga: React.FC = () => {
  const [setharga, setSetharga] = React.useState('Umum');
  const [hargadasar, setHargadasar] = React.useState('Harga Beli');
  const [ppn, setPpn] = React.useState('No');
  const [saved, setSaved] = React.useState<{ setharga: string; hargadasar: string; ppn: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/pengaturan');
      const data = await res.json();
      setSaved(data || null);
      if (data) {
        setSetharga(data.setharga);
        setHargadasar(data.hargadasar);
        setPpn(data.ppn);
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
      const res = await fetch('/api/apotek/harga-obat/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setharga, hargadasar, ppn }),
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
      title: 'Hapus Pengaturan Harga?',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch('/api/apotek/harga-obat/pengaturan', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
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
        Menentukan cara harga jual obat dihitung: berlaku umum untuk semua barang, per jenis barang, atau per barang
        tertentu — beserta harga dasar dan apakah PPN pembelian disertakan.
      </div>
      <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Harga Obat yang Digunakan</label>
          <PillSelect
            value={setharga}
            onChange={setSetharga}
            options={[
              { value: 'Umum', label: 'Umum' },
              { value: 'Per Jenis', label: 'Per Jenis' },
              { value: 'Per Barang', label: 'Per Barang' },
            ]}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Asal Harga Jual Obat</label>
          <PillSelect
            value={hargadasar}
            onChange={setHargadasar}
            options={[
              { value: 'Harga Beli', label: 'Harga Beli' },
              { value: 'Harga Diskon', label: 'Harga Diskon' },
            ]}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Sertakan PPN Pembelian</label>
          <PillSelect
            value={ppn}
            onChange={setPpn}
            options={[
              { value: 'Yes', label: 'Ya' },
              { value: 'No', label: 'Tidak' },
            ]}
          />
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Harga Obat yang Digunakan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Asal Harga Jual Obat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Sertakan PPN Pembelian</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!saved ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
            ) : (
              <tr>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{saved.setharga}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{saved.hargadasar}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{saved.ppn === 'Yes' ? 'Ya' : 'Tidak'}</td>
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

// ---- Tab: Harga Umum (setpenjualanumum) ------------------------------------

const TabHargaUmum: React.FC = () => {
  const [pct, setPct] = React.useState<HargaPct>(emptyPct());
  const [saved, setSaved] = React.useState<HargaPct | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/umum');
      const data = await res.json();
      setSaved(data || null);
      if (data) setPct(data);
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
      const res = await fetch('/api/apotek/harga-obat/umum', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pct),
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

  const handleTerapkan = async () => {
    const confirm = await Swal.fire({
      title: 'Terapkan ke Seluruh Barang?',
      text: 'Harga jual SELURUH obat/alkes/BHP akan dihitung ulang dari harga beli memakai persentase ini. Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Terapkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setApplying(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/umum/terapkan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${data.message} (${data.affected} barang)`, timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setApplying(false);
    }
  };

  const handleDelete = async () => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Harga Umum?',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch('/api/apotek/harga-obat/umum', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
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
        Persentase keuntungan yang berlaku untuk semua barang (dipakai kalau "Harga Obat yang Digunakan" = Umum).
        Harga jual = harga beli + (harga beli × persentase / 100).
      </div>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PctForm value={pct} onChange={setPct} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button"
            onClick={handleTerapkan}
            disabled={applying}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: applying ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {applying ? 'Menerapkan...' : 'Terapkan ke Semua Obat'}
          </button>
        </div>
      </form>

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Ralan %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Kelas 1 %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Kelas 2 %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Kelas 3 %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Utama %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>VIP %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>VVIP %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Beli Luar %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jual Bebas %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Karyawan %</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!saved ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
            ) : (
              <tr>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.ralan}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.kelas1}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.kelas2}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.kelas3}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.utama}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.vip}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.vvip}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.beliluar}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.jualbebas}%</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{saved.karyawan}%</td>
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

// ---- Tab: Harga Per Jenis (setpenjualan) -----------------------------------

type KvOpsi = { kode: string; nama: string };
type HargaPerJenis = HargaPct & { kdjns: string; nm_jenis: string };

const TabHargaPerJenis: React.FC = () => {
  const [items, setItems] = React.useState<HargaPerJenis[]>([]);
  const [jenisOpsi, setJenisOpsi] = React.useState<KvOpsi[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [kdjns, setKdjns] = React.useState('');
  const [pct, setPct] = React.useState<HargaPct>(emptyPct());
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [applyingKdjns, setApplyingKdjns] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/per-jenis');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchItems();
    fetch('/api/apotek/referensi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setJenisOpsi(data.jenis || []))
      .catch(() => {});
  }, [fetchItems]);

  const resetForm = () => {
    setKdjns('');
    setPct(emptyPct());
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdjns) {
      Swal.fire({ icon: 'warning', title: 'Jenis barang wajib dipilih' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/per-jenis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kdjns, ...pct }),
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

  const handleEdit = (item: HargaPerJenis) => {
    setKdjns(item.kdjns);
    setPct({ ralan: item.ralan, kelas1: item.kelas1, kelas2: item.kelas2, kelas3: item.kelas3, utama: item.utama, vip: item.vip, vvip: item.vvip, beliluar: item.beliluar, jualbebas: item.jualbebas, karyawan: item.karyawan });
    setEditing(true);
  };

  const handleDelete = async (item: HargaPerJenis) => {
    const confirm = await Swal.fire({ title: 'Hapus Pengaturan Ini?', text: item.nm_jenis, showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/harga-obat/per-jenis/${encodeURIComponent(item.kdjns)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const handleTerapkan = async (item: HargaPerJenis) => {
    const confirm = await Swal.fire({
      title: 'Terapkan ke Barang Jenis Ini?',
      text: `Harga jual seluruh barang jenis "${item.nm_jenis}" akan dihitung ulang dari harga beli.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Terapkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setApplyingKdjns(item.kdjns);
    try {
      const res = await fetch(`/api/apotek/harga-obat/per-jenis/${encodeURIComponent(item.kdjns)}/terapkan`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${data.message} (${data.affected} barang)`, timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setApplyingKdjns(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Persentase keuntungan berbeda per jenis barang (dipakai kalau "Harga Obat yang Digunakan" = Per Jenis).
      </div>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ minWidth: 240, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis Barang</label>
          <PillSelect
            value={kdjns}
            onChange={setKdjns}
            options={[{ value: '', label: '- Pilih Jenis -' }, ...jenisOpsi.map((j) => ({ value: j.kode, label: j.nama }))]}
            style={editing ? { opacity: 0.6, pointerEvents: 'none' } : {}}
          />
        </div>
        <PctForm value={pct} onChange={setPct} />
        <div style={{ display: 'flex', gap: 8 }}>
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
        </div>
      </form>

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Barang</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Ralan %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Karyawan %</th>
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
                <tr key={item.kdjns} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_jenis || item.kdjns}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.ralan}%</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.karyawan}%</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => handleEdit(item)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTerapkan(item)}
                        disabled={applyingKdjns === item.kdjns}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: applyingKdjns === item.kdjns ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {applyingKdjns === item.kdjns ? 'Menerapkan...' : 'Terapkan'}
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

// ---- Tab: Harga Per Barang (setpenjualanperbarang) -------------------------

type HargaPerBarang = HargaPct & { kode_brng: string; nama_brng: string };
type ObatOpsi = { kode_brng: string; nama_brng: string };

const TabHargaPerBarang: React.FC = () => {
  const [items, setItems] = React.useState<HargaPerBarang[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');

  const [kodeBrng, setKodeBrng] = React.useState('');
  const [namaBrng, setNamaBrng] = React.useState('');
  const [pct, setPct] = React.useState<HargaPct>(emptyPct());
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [applyingKode, setApplyingKode] = React.useState<string | null>(null);

  const [obatQuery, setObatQuery] = React.useState('');
  const [obatOpsi, setObatOpsi] = React.useState<ObatOpsi[]>([]);
  const [showObatDropdown, setShowObatDropdown] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/apotek/harga-obat/per-barang${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`);
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
    if (obatQuery.trim().length < 2) {
      setObatOpsi([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/apotek/barang/list?search=${encodeURIComponent(obatQuery)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setObatOpsi(Array.isArray(data) ? data.slice(0, 20) : []))
        .catch(() => setObatOpsi([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [obatQuery]);

  const resetForm = () => {
    setKodeBrng('');
    setNamaBrng('');
    setObatQuery('');
    setPct(emptyPct());
    setEditing(false);
  };

  const pilihObat = (o: ObatOpsi) => {
    setKodeBrng(o.kode_brng);
    setNamaBrng(o.nama_brng);
    setObatQuery(o.nama_brng);
    setShowObatDropdown(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeBrng) {
      Swal.fire({ icon: 'warning', title: 'Barang wajib dipilih lewat pencarian' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/harga-obat/per-barang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_brng: kodeBrng, ...pct }),
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

  const handleEdit = (item: HargaPerBarang) => {
    setKodeBrng(item.kode_brng);
    setNamaBrng(item.nama_brng);
    setObatQuery(item.nama_brng);
    setPct({ ralan: item.ralan, kelas1: item.kelas1, kelas2: item.kelas2, kelas3: item.kelas3, utama: item.utama, vip: item.vip, vvip: item.vvip, beliluar: item.beliluar, jualbebas: item.jualbebas, karyawan: item.karyawan });
    setEditing(true);
  };

  const handleDelete = async (item: HargaPerBarang) => {
    const confirm = await Swal.fire({ title: 'Hapus Pengaturan Ini?', text: item.nama_brng, showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/harga-obat/per-barang/${encodeURIComponent(item.kode_brng)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const handleTerapkan = async (item: HargaPerBarang) => {
    const confirm = await Swal.fire({
      title: 'Terapkan ke Barang Ini?',
      text: `Harga jual "${item.nama_brng}" akan dihitung ulang dari harga beli.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Terapkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setApplyingKode(item.kode_brng);
    try {
      const res = await fetch(`/api/apotek/harga-obat/per-barang/${encodeURIComponent(item.kode_brng)}/terapkan`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setApplyingKode(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Persentase keuntungan khusus untuk barang tertentu (dipakai kalau "Harga Obat yang Digunakan" = Per Barang).
      </div>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Barang/Alkes/BHP</label>
          <input
            type="text"
            placeholder="Ketik nama atau kode barang..."
            value={obatQuery}
            disabled={editing}
            onChange={(e) => { setObatQuery(e.target.value); setShowObatDropdown(true); if (!editing) { setKodeBrng(''); setNamaBrng(''); } }}
            onFocus={() => setShowObatDropdown(true)}
            style={{ ...numberInputStyle, background: editing ? '#f3f4f6' : '#fff' }}
          />
          {showObatDropdown && obatOpsi.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {obatOpsi.map((o) => (
                <div
                  key={o.kode_brng}
                  onClick={() => pilihObat(o)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  <strong>{o.kode_brng}</strong> — {o.nama_brng}
                </div>
              ))}
            </div>
          )}
        </div>
        <PctForm value={pct} onChange={setPct} />
        <div style={{ display: 'flex', gap: 8 }}>
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
        </div>
      </form>

      <input
        type="text"
        placeholder="Cari di daftar pengaturan..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ ...numberInputStyle, maxWidth: 280 }}
      />

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Barang</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Ralan %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Karyawan %</th>
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
                <tr key={item.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_brng || item.kode_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.ralan}%</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.karyawan}%</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => handleEdit(item)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTerapkan(item)}
                        disabled={applyingKode === item.kode_brng}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: applyingKode === item.kode_brng ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {applyingKode === item.kode_brng ? 'Menerapkan...' : 'Terapkan'}
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

// ---- Shell Set Harga Obat (gabung 4 sub-tab di atas) -----------------------

export const ApotekHargaObatView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'pengaturan' | 'umum' | 'per-jenis' | 'per-barang'>('pengaturan');

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'pengaturan', label: 'Pengaturan Harga' },
    { key: 'umum', label: 'Harga Umum' },
    { key: 'per-jenis', label: 'Harga Per Jenis' },
    { key: 'per-barang', label: 'Harga Per Barang' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: subTab === t.key ? '#059669' : '#6b7280',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'pengaturan' && <TabPengaturanHarga />}
      {subTab === 'umum' && <TabHargaUmum />}
      {subTab === 'per-jenis' && <TabHargaPerJenis />}
      {subTab === 'per-barang' && <TabHargaPerBarang />}
    </div>
  );
};
