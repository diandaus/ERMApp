import React from 'react';
import Swal from 'sweetalert2';

type DataBarang = {
  kode_brng: string;
  nama_brng: string;
  kode_satbesar: string;
  kode_sat: string;
  letak_barang: string;
  dasar: number;
  h_beli: number;
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
  stokminimal: number;
  kdjns: string;
  isi: number;
  kapasitas: number;
  expire: string;
  status: string;
  kode_industri: string;
  kode_kategori: string;
  kode_golongan: string;
  // Hasil JOIN, read-only
  nama_satbesar: string;
  nama_sat: string;
  nama_jenis: string;
  nama_industri: string;
  nama_kategori: string;
  nama_golongan: string;
  total_stok: number;
};

type KvRef = { kode: string; nama: string };

type Referensi = {
  satuan: KvRef[];
  jenis: KvRef[];
  industri: KvRef[];
  kategori: KvRef[];
  golongan: KvRef[];
};

const emptyForm = (): DataBarang => ({
  kode_brng: '',
  nama_brng: '',
  kode_satbesar: '',
  kode_sat: '',
  letak_barang: '',
  dasar: 0,
  h_beli: 0,
  ralan: 0,
  kelas1: 0,
  kelas2: 0,
  kelas3: 0,
  utama: 0,
  vip: 0,
  vvip: 0,
  beliluar: 0,
  jualbebas: 0,
  karyawan: 0,
  stokminimal: 0,
  kdjns: '',
  isi: 0,
  kapasitas: 0,
  expire: '',
  status: '1',
  kode_industri: '',
  kode_kategori: '',
  kode_golongan: '',
  nama_satbesar: '',
  nama_sat: '',
  nama_jenis: '',
  nama_industri: '',
  nama_kategori: '',
  nama_golongan: '',
  total_stok: 0,
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

// PillSelect — dropdown dengan ikon stepper bulat, gaya yang sama dipakai
// modal Input SEP (BpjsSep.tsx), warna disesuaikan tema hijau Apotek.
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

// pillInput/Row/PaperclipButton — primitif gaya Khanza Desktop yang sama
// dipakai modal Input SEP (BpjsSep.tsx): input pil bulat + baris label:value
// dengan label rata kanan.
const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

// nominalInput — lebar tetap untuk semua input harga (Rp) di kolom kanan,
// disamakan dengan lebar input "Hrg Rnp Kelas 1" (dua input berbagi satu
// baris di kolom kiri) supaya seluruh kolom nominal rapi & sejajar.
const nominalInput: React.CSSProperties = { ...pillInput, flex: '0 0 130px' };

const Row: React.FC<{ label: string; labelWidth?: number; children: React.ReactNode }> = ({ label, labelWidth = 96, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>{label} :</div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
  </div>
);

const PaperclipButton: React.FC<{ title?: string; onClick?: () => void }> = ({ title, onClick }) => (
  <button
    type="button"
    title={title || 'Cari'}
    onClick={onClick}
    style={{
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid #d1d5db',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
      color: '#6b7280',
      flexShrink: 0,
      padding: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  </button>
);

const formatRupiah = (v: number) => (v || 0).toLocaleString('id-ID');

export const ApotekDataBarangView: React.FC = () => {
  const [items, setItems] = React.useState<DataBarang[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [referensi, setReferensi] = React.useState<Referensi>({ satuan: [], jenis: [], industri: [], kategori: [], golongan: [] });

  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<DataBarang>(emptyForm());
  const [editingKode, setEditingKode] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [togglingKode, setTogglingKode] = React.useState<string | null>(null);
  // Tanggal Kadaluwarsa punya checkbox aktif/tidak di Khanza Desktop
  // (ChkKadaluarsa) — kalau tidak dicentang, expire dikirim kosong dan
  // backend menyimpannya sebagai "0000-00-00" (nullIfEmptyDate).
  const [expireEnabled, setExpireEnabled] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/apotek/barang/list?';
      if (searchText) url += `search=${encodeURIComponent(searchText)}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data barang');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  React.useEffect(() => {
    fetch('/api/apotek/referensi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setReferensi(data))
      .catch(() => {});
  }, []);

  const openTambahModal = () => {
    setForm(emptyForm());
    setEditingKode(null);
    setExpireEnabled(false);
    setShowModal(true);
  };

  const openEditModal = (item: DataBarang) => {
    const hasExpire = !!item.expire && !item.expire.startsWith('0000-00-00');
    setForm({ ...item, expire: hasExpire ? item.expire.split('T')[0] : '' });
    setEditingKode(item.kode_brng);
    setExpireEnabled(hasExpire);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingKode ? `/api/apotek/barang/${encodeURIComponent(editingKode)}` : '/api/apotek/barang';
      const payload = { ...form, expire: expireEnabled ? form.expire : '' };
      const res = await fetch(url, {
        method: editingKode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan barang');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // handleToggleStatus — di Khanza Desktop (DlgBarang.java), tombol "Hapus"
  // di daftar barang sebenarnya bukan hapus baris, cuma UPDATE status='0'
  // (nonaktifkan). Field Status juga tidak pernah muncul di form tambah/edit
  // sama sekali — dikelola khusus lewat aksi ini. Dipakai juga untuk
  // aktifkan kembali barang yang nonaktif.
  const handleToggleStatus = async (item: DataBarang) => {
    const activating = item.status !== '1';
    const confirm = await Swal.fire({
      title: activating ? 'Aktifkan Barang?' : 'Nonaktifkan Barang?',
      text: `${item.kode_brng} — ${item.nama_brng}`,
      icon: activating ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: activating ? 'Aktifkan' : 'Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: activating ? '#059669' : '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setTogglingKode(item.kode_brng);
    try {
      const res = await fetch(`/api/apotek/barang/${encodeURIComponent(item.kode_brng)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: activating ? '1' : '0' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status barang');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setTogglingKode(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari Kode / Nama Barang"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
          <div style={{ width: 160 }}>
            <PillSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'Semua Status' },
                { value: '1', label: 'Aktif' },
                { value: '0', label: 'Nonaktif' },
              ]}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={openTambahModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Tambah Barang
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Harga Beli</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Harga Ralan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data barang</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kode_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.nama_jenis || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    {item.nama_sat || '-'}{item.nama_satbesar && item.nama_satbesar !== item.nama_sat ? ` / ${item.nama_satbesar}` : ''}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{formatRupiah(item.h_beli)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{formatRupiah(item.ralan)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: item.total_stok <= item.stokminimal ? '#dc2626' : '#374151', textAlign: 'right', fontWeight: item.total_stok <= item.stokminimal ? 600 : 400 }}>
                    {item.total_stok}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: item.status === '1' ? '#f0fdf4' : '#f3f4f6', color: item.status === '1' ? '#166534' : '#6b7280', border: `1px solid ${item.status === '1' ? '#bbf7d0' : '#e5e7eb'}` }}>
                      {item.status === '1' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        disabled={togglingKode === item.kode_brng}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${item.status === '1' ? '#dc2626' : '#059669'}`,
                          background: '#ffffff',
                          color: item.status === '1' ? '#dc2626' : '#059669',
                          cursor: togglingKode === item.kode_brng ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {togglingKode === item.kode_brng ? 'Memproses...' : item.status === '1' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit Barang — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 840, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingKode ? `Edit Barang — ${editingKode}` : 'Tambah Barang'}</span>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {/* Kolom kiri — identitas, klasifikasi, satuan, sebagian harga (dibuat lebih lebar, banyak field ganda per baris) */}
                <div style={{ flex: '1.3 1 0%', minWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Row label="Kode Barang">
                    <input
                      required
                      disabled={!!editingKode}
                      style={{ ...pillInput, flex: '0 0 160px', background: editingKode ? '#f3f4f6' : '#fff' }}
                      value={form.kode_brng}
                      onChange={(e) => setForm((p) => ({ ...p, kode_brng: e.target.value }))}
                    />
                    <div style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>I.F. :</div>
                    <PillSelect
                      value={form.kode_industri}
                      onChange={(v) => setForm((p) => ({ ...p, kode_industri: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.industri.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari industri farmasi" />
                  </Row>
                  <Row label="Nama Barang">
                    <input required style={pillInput} value={form.nama_brng} onChange={(e) => setForm((p) => ({ ...p, nama_brng: e.target.value }))} />
                  </Row>
                  <Row label="Kandungan">
                    <input style={pillInput} value={form.letak_barang} onChange={(e) => setForm((p) => ({ ...p, letak_barang: e.target.value }))} />
                  </Row>
                  <Row label="Satuan Besar">
                    <PillSelect
                      value={form.kode_satbesar}
                      onChange={(v) => setForm((p) => ({ ...p, kode_satbesar: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.satuan.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari satuan besar" />
                    <div style={{ width: 34, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>Isi :</div>
                    <input type="number" step="any" style={{ ...pillInput, flex: '0 0 80px' }} value={form.isi} onChange={(e) => setForm((p) => ({ ...p, isi: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Satuan Kecil">
                    <PillSelect
                      value={form.kode_sat}
                      onChange={(v) => setForm((p) => ({ ...p, kode_sat: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.satuan.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari satuan kecil" />
                    <div style={{ width: 58, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>Kapasitas :</div>
                    <input type="number" step="any" style={{ ...pillInput, flex: '0 0 80px' }} value={form.kapasitas} onChange={(e) => setForm((p) => ({ ...p, kapasitas: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Jenis">
                    <PillSelect
                      value={form.kdjns}
                      onChange={(v) => setForm((p) => ({ ...p, kdjns: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.jenis.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari jenis" />
                  </Row>
                  <Row label="Kategori">
                    <PillSelect
                      value={form.kode_kategori}
                      onChange={(v) => setForm((p) => ({ ...p, kode_kategori: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.kategori.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari kategori" />
                  </Row>
                  <Row label="Golongan">
                    <PillSelect
                      value={form.kode_golongan}
                      onChange={(v) => setForm((p) => ({ ...p, kode_golongan: v }))}
                      options={[{ value: '', label: '-' }, ...referensi.golongan.map((r) => ({ value: r.kode, label: r.nama }))]}
                    />
                    <PaperclipButton title="Cari golongan" />
                  </Row>
                  <Row label="Harga Dasar">
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={pillInput} value={form.dasar} onChange={(e) => setForm((p) => ({ ...p, dasar: Number(e.target.value) }))} />
                    <div style={{ width: 62, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>Harga Beli :</div>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={pillInput} value={form.h_beli} onChange={(e) => setForm((p) => ({ ...p, h_beli: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Ralan">
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={pillInput} value={form.ralan} onChange={(e) => setForm((p) => ({ ...p, ralan: Number(e.target.value) }))} />
                    <div style={{ width: 88, flexShrink: 0, textAlign: 'right', fontSize: 11.5, whiteSpace: 'nowrap', color: '#111827' }}>Hrg Rnp Kelas 1 :</div>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={pillInput} value={form.kelas1} onChange={(e) => setForm((p) => ({ ...p, kelas1: Number(e.target.value) }))} />
                  </Row>
                </div>

                {/* Kolom kanan — sisa harga, stok minimal, tanggal kadaluwarsa */}
                <div style={{ flex: '1 1 0%', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Row label="Hrg Rnp Kelas 2" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.kelas2} onChange={(e) => setForm((p) => ({ ...p, kelas2: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Rnp Kelas 3" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.kelas3} onChange={(e) => setForm((p) => ({ ...p, kelas3: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Rnp Utama/BPJS" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.utama} onChange={(e) => setForm((p) => ({ ...p, utama: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Rnp Kelas VIP" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.vip} onChange={(e) => setForm((p) => ({ ...p, vip: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Rnp Kelas VVIP" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.vvip} onChange={(e) => setForm((p) => ({ ...p, vvip: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Apotek Luar" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.beliluar} onChange={(e) => setForm((p) => ({ ...p, beliluar: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Jual Obat Bebas" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.jualbebas} onChange={(e) => setForm((p) => ({ ...p, jualbebas: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Hrg Karyawan" labelWidth={150}>
                    <span style={{ fontSize: 11.5, color: '#6b7280' }}>Rp.</span>
                    <input type="number" step="any" style={nominalInput} value={form.karyawan} onChange={(e) => setForm((p) => ({ ...p, karyawan: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Stok Minimal Barang" labelWidth={150}>
                    <input type="number" step="any" style={nominalInput} value={form.stokminimal} onChange={(e) => setForm((p) => ({ ...p, stokminimal: Number(e.target.value) }))} />
                  </Row>
                  <Row label="Tanggal Kadaluwarsa" labelWidth={150}>
                    <input
                      type="checkbox"
                      checked={expireEnabled}
                      onChange={(e) => setExpireEnabled(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#059669', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <input
                      type="date"
                      disabled={!expireEnabled}
                      style={{ ...nominalInput, flex: '0 0 150px', background: expireEnabled ? '#fff' : '#f3f4f6', color: expireEnabled ? '#111827' : '#9ca3af' }}
                      value={form.expire}
                      onChange={(e) => setForm((p) => ({ ...p, expire: e.target.value }))}
                    />
                  </Row>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  Tutup
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
