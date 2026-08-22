import React from 'react';
import Swal from 'sweetalert2';
import { ApotekHargaObatView } from './ApotekHargaObat';
import { ApotekHargaObatRalanView } from './ApotekHargaObatRalan';
import { ApotekHargaObatRanapView } from './ApotekHargaObatRanap';
import { ApotekEmbalaseTuslahView } from './ApotekEmbalaseTuslah';
import { ApotekIndustriFarmasiView } from './ApotekIndustriFarmasi';
import { ApotekSuplierView } from './ApotekSuplier';
import { ApotekSatuanBarangView } from './ApotekSatuanBarang';
import { ApotekMetodeRacikView } from './ApotekMetodeRacik';
import { ApotekKonversiSatuanView } from './ApotekKonversiSatuan';
import { ApotekJenisView } from './ApotekJenis';
import { ApotekKategoriView } from './ApotekKategori';
import { ApotekGolonganView } from './ApotekGolongan';
import { ApotekPengaturanPrinterView } from './ApotekPengaturanPrinter';

// ============================================================================
// APOTEK — Pengaturan (footer tab). 13 sub-menu master data direncanakan;
// dikerjakan berurutan satu per satu. Baru #1 "Pengaturan Depo" yang siap —
// sisanya tampil sebagai placeholder "Belum tersedia" sampai giliran
// masing-masing dikerjakan (skema tabelnya juga belum dicek).
// Cocok dengan dialog Khanza Desktop "Set Oto Lokasi"
// (setting/DlgSetOtoLokasi.java) — 3 sub-tab: Pengaturan Lokasi, Pengaturan
// Depo Ralan, Pengaturan Depo Ranap. Lihat backend/apotek_pengaturan_depo_handler.go.
// ============================================================================

type SettingKey =
  | 'depo'
  | 'harga-obat'
  | 'harga-obat-ralan'
  | 'harga-obat-ranap'
  | 'embalase-tuslah'
  | 'industri-farmasi'
  | 'suplier'
  | 'satuan-barang'
  | 'metode-racik'
  | 'konversi-satuan'
  | 'jenis'
  | 'kategori'
  | 'golongan'
  | 'printer';

const SETTING_LIST: { key: SettingKey; label: string; ready: boolean }[] = [
  { key: 'depo', label: 'Pengaturan Depo', ready: true },
  { key: 'harga-obat', label: 'Set Harga Obat', ready: true },
  { key: 'harga-obat-ralan', label: 'Set Harga Obat Ralan', ready: true },
  { key: 'harga-obat-ranap', label: 'Set Harga Obat Ranap', ready: true },
  { key: 'embalase-tuslah', label: 'Set Embalase dan Tuslah', ready: true },
  { key: 'industri-farmasi', label: 'Industri Farmasi', ready: true },
  { key: 'suplier', label: 'Suplier Obat/Alkes/BHP', ready: true },
  { key: 'satuan-barang', label: 'Satuan Barang', ready: true },
  { key: 'metode-racik', label: 'Metode Racik', ready: true },
  { key: 'konversi-satuan', label: 'Konversi Satuan', ready: true },
  { key: 'jenis', label: 'Jenis Obat/Alkes/BHP', ready: true },
  { key: 'kategori', label: 'Kategori Obat/Alkes/BHP', ready: true },
  { key: 'golongan', label: 'Golongan Obat/Alkes/BHP', ready: true },
  { key: 'printer', label: 'Pengaturan Printer', ready: true },
];

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

type KvOpsi = { kode: string; nama: string };

// ---- Tab: Pengaturan Lokasi -------------------------------------------------

type Lokasi = { kd_bangsal: string; nm_bangsal: string; asal_stok: string } | null;

const ASAL_STOK_OPSI = [
  { value: 'Gunakan Stok Utama Obat', label: 'Gunakan Stok Utama Obat' },
  { value: 'Gunakan Stok Bangsal', label: 'Gunakan Stok Bangsal' },
];

const TabLokasi: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [lokasi, setLokasi] = React.useState<Lokasi>(null);
  const [loading, setLoading] = React.useState(false);
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [asalStok, setAsalStok] = React.useState(ASAL_STOK_OPSI[0].value);
  const [saving, setSaving] = React.useState(false);

  const fetchLokasi = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/pengaturan/lokasi');
      const data = await res.json();
      setLokasi(data);
      if (data) {
        setKdBangsal(data.kd_bangsal);
        setAsalStok(data.asal_stok);
      }
    } catch {
      setLokasi(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLokasi();
  }, [fetchLokasi]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdBangsal) {
      Swal.fire({ icon: 'warning', title: 'Kode lokasi wajib dipilih' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/apotek/pengaturan/lokasi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_bangsal: kdBangsal, asal_stok: asalStok }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan lokasi');
      await fetchLokasi();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Lokasi?',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch('/api/apotek/pengaturan/lokasi', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      setKdBangsal('');
      setAsalStok(ASAL_STOK_OPSI[0].value);
      await fetchLokasi();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Menentukan sumber tampilan stok apotek: pakai stok utama obat (gudang pusat) atau stok per-bangsal. Hanya satu
        pengaturan yang berlaku di seluruh sistem — menyimpan yang baru akan menggantikan yang lama.
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Memuat...</div>
      ) : (
        <>
          <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi Stok Utama Obat</label>
              <PillSelect
                value={kdBangsal}
                onChange={setKdBangsal}
                options={[{ value: '', label: '- Pilih Bangsal -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]}
              />
            </div>
            <div style={{ minWidth: 240 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Penggunaan Stok Ranap</label>
              <PillSelect value={asalStok} onChange={setAsalStok} options={ASAL_STOK_OPSI} />
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
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Lokasi</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Lokasi</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Penggunaan Stok Ranap</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {!lokasi ? (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pengaturan</td></tr>
                ) : (
                  <tr>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{lokasi.kd_bangsal}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{lokasi.nm_bangsal}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{lokasi.asal_stok}</td>
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
        </>
      )}
    </div>
  );
};

// ---- Tab: Pengaturan Depo Ralan ---------------------------------------------

type DepoRalan = { kd_poli: string; nm_poli: string; kd_bangsal: string; nm_bangsal: string };

const TabDepoRalan: React.FC<{ bangsal: KvOpsi[]; poliklinik: KvOpsi[] }> = ({ bangsal, poliklinik }) => {
  const [items, setItems] = React.useState<DepoRalan[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [kdPoli, setKdPoli] = React.useState('');
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [editing, setEditing] = React.useState<{ kd_poli: string; kd_bangsal: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/pengaturan/depo-ralan');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetForm = () => {
    setKdPoli('');
    setKdBangsal('');
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdPoli || !kdBangsal) {
      Swal.fire({ icon: 'warning', title: 'Poliklinik dan depo wajib dipilih' });
      return;
    }
    setSaving(true);
    try {
      const url = '/api/apotek/pengaturan/depo-ralan';
      const body = editing
        ? { orig_kd_poli: editing.kd_poli, orig_kd_bangsal: editing.kd_bangsal, kd_poli: kdPoli, kd_bangsal: kdBangsal }
        : { kd_poli: kdPoli, kd_bangsal: kdBangsal };
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleEdit = (item: DepoRalan) => {
    setKdPoli(item.kd_poli);
    setKdBangsal(item.kd_bangsal);
    setEditing({ kd_poli: item.kd_poli, kd_bangsal: item.kd_bangsal });
  };

  const handleDelete = async (item: DepoRalan) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Ini?',
      text: `${item.nm_poli} — ${item.nm_bangsal}`,
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/pengaturan/depo-ralan?kd_poli=${encodeURIComponent(item.kd_poli)}&kd_bangsal=${encodeURIComponent(item.kd_bangsal)}`, { method: 'DELETE' });
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
        Menentukan depo obat mana yang melayani resep dari tiap poliklinik rawat jalan.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Poliklinik</label>
          <PillSelect
            value={kdPoli}
            onChange={setKdPoli}
            options={[{ value: '', label: '- Pilih Poliklinik -' }, ...poliklinik.map((p) => ({ value: p.kode, label: p.nama }))]}
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Depo Obat</label>
          <PillSelect
            value={kdBangsal}
            onChange={setKdBangsal}
            options={[{ value: '', label: '- Pilih Depo -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : editing ? 'Update' : '+ Tambah'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={resetForm}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Batal
          </button>
        )}
      </form>

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poliklinik</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Depo Obat</th>
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
                <tr key={`${item.kd_poli}-${item.kd_bangsal}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_poli}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
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

// ---- Tab: Pengaturan Depo Ranap ---------------------------------------------

type DepoRanap = { kd_bangsal: string; nm_bangsal: string; kd_depo: string; nm_depo: string };

const TabDepoRanap: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [items, setItems] = React.useState<DepoRanap[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [kdDepo, setKdDepo] = React.useState('');
  const [editing, setEditing] = React.useState<{ kd_bangsal: string; kd_depo: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/pengaturan/depo-ranap');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetForm = () => {
    setKdBangsal('');
    setKdDepo('');
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdBangsal || !kdDepo) {
      Swal.fire({ icon: 'warning', title: 'Bangsal dan depo wajib dipilih' });
      return;
    }
    setSaving(true);
    try {
      const url = '/api/apotek/pengaturan/depo-ranap';
      const body = editing
        ? { orig_kd_bangsal: editing.kd_bangsal, orig_kd_depo: editing.kd_depo, kd_bangsal: kdBangsal, kd_depo: kdDepo }
        : { kd_bangsal: kdBangsal, kd_depo: kdDepo };
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleEdit = (item: DepoRanap) => {
    setKdBangsal(item.kd_bangsal);
    setKdDepo(item.kd_depo);
    setEditing({ kd_bangsal: item.kd_bangsal, kd_depo: item.kd_depo });
  };

  const handleDelete = async (item: DepoRanap) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengaturan Ini?',
      text: `${item.nm_bangsal} — ${item.nm_depo}`,
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/pengaturan/depo-ranap?kd_bangsal=${encodeURIComponent(item.kd_bangsal)}&kd_depo=${encodeURIComponent(item.kd_depo)}`, { method: 'DELETE' });
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
        Menentukan depo obat mana yang melayani permintaan resep dari tiap bangsal/kamar rawat inap.
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Bangsal/Kamar</label>
          <PillSelect
            value={kdBangsal}
            onChange={setKdBangsal}
            options={[{ value: '', label: '- Pilih Bangsal -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]}
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Depo Obat</label>
          <PillSelect
            value={kdDepo}
            onChange={setKdDepo}
            options={[{ value: '', label: '- Pilih Depo -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : editing ? 'Update' : '+ Tambah'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={resetForm}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Batal
          </button>
        )}
      </form>

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Bangsal/Kamar</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Depo Obat</th>
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
                <tr key={`${item.kd_bangsal}-${item.kd_depo}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_depo}</td>
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

// ---- Pengaturan Depo (gabung 3 sub-tab di atas) -----------------------------

const PengaturanDepoView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'lokasi' | 'ralan' | 'ranap'>('lokasi');
  const [opsi, setOpsi] = React.useState<{ bangsal: KvOpsi[]; poliklinik: KvOpsi[] }>({ bangsal: [], poliklinik: [] });

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setOpsi(data))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'lokasi', label: 'Pengaturan Lokasi' },
    { key: 'ralan', label: 'Pengaturan Depo Ralan' },
    { key: 'ranap', label: 'Pengaturan Depo Ranap' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb' }}>
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
      {subTab === 'lokasi' && <TabLokasi bangsal={opsi.bangsal} />}
      {subTab === 'ralan' && <TabDepoRalan bangsal={opsi.bangsal} poliklinik={opsi.poliklinik} />}
      {subTab === 'ranap' && <TabDepoRanap bangsal={opsi.bangsal} />}
    </div>
  );
};

// ---- Shell Pengaturan (daftar 13 sub-menu) ----------------------------------

export const ApotekPengaturanView: React.FC = () => {
  const [active, setActive] = React.useState<SettingKey>('depo');
  const activeItem = SETTING_LIST.find((s) => s.key === active)!;

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      <nav style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {SETTING_LIST.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? '#e6f7ee' : 'transparent',
                color: isActive ? '#059669' : '#374151',
                fontWeight: isActive ? 600 : 400,
                fontSize: 12.5,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{item.label}</span>
              {!item.ready && <span style={{ fontSize: 10, color: '#9ca3af' }}>&#9679;</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>{activeItem.label}</div>
        {activeItem.ready ? (
          activeItem.key === 'depo' ? (
            <PengaturanDepoView />
          ) : activeItem.key === 'harga-obat' ? (
            <ApotekHargaObatView />
          ) : activeItem.key === 'harga-obat-ralan' ? (
            <ApotekHargaObatRalanView />
          ) : activeItem.key === 'harga-obat-ranap' ? (
            <ApotekHargaObatRanapView />
          ) : activeItem.key === 'embalase-tuslah' ? (
            <ApotekEmbalaseTuslahView />
          ) : activeItem.key === 'industri-farmasi' ? (
            <ApotekIndustriFarmasiView />
          ) : activeItem.key === 'suplier' ? (
            <ApotekSuplierView />
          ) : activeItem.key === 'satuan-barang' ? (
            <ApotekSatuanBarangView />
          ) : activeItem.key === 'metode-racik' ? (
            <ApotekMetodeRacikView />
          ) : activeItem.key === 'konversi-satuan' ? (
            <ApotekKonversiSatuanView />
          ) : activeItem.key === 'jenis' ? (
            <ApotekJenisView />
          ) : activeItem.key === 'kategori' ? (
            <ApotekKategoriView />
          ) : activeItem.key === 'golongan' ? (
            <ApotekGolonganView />
          ) : activeItem.key === 'printer' ? (
            <ApotekPengaturanPrinterView />
          ) : null
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, background: '#f9fafb' }}>
            Fitur {activeItem.label} akan dikembangkan nanti.
          </div>
        )}
      </div>
    </div>
  );
};
