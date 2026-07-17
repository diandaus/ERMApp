import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Industri Farmasi (item #6 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Industri Farmasi"
// (inventory/DlgIndustriFarmasi.java) — CRUD master pabrik/distributor
// obat, tabel yang sama dipakai referensi dropdown "Industri / Pabrik" di
// Data Barang. Kode boleh diganti (mengikuti Java), tapi backend menolak
// kalau kode masih dipakai databarang. Lihat backend/apotek_industri_farmasi_handler.go.
// ============================================================================

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

type IndustriFarmasi = {
  kode_industri: string;
  nama_industri: string;
  alamat: string;
  kota: string;
  no_telp: string;
};

const emptyForm = (): IndustriFarmasi => ({ kode_industri: '', nama_industri: '', alamat: '', kota: '', no_telp: '' });

export const ApotekIndustriFarmasiView: React.FC = () => {
  const [items, setItems] = React.useState<IndustriFarmasi[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<IndustriFarmasi>(emptyForm());
  const [editingKode, setEditingKode] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingKode, setDeletingKode] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apotek/industri-farmasi${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`);
      if (!res.ok) throw new Error('Gagal mengambil data industri farmasi');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openTambahModal = () => {
    setForm(emptyForm());
    setEditingKode(null);
    setShowModal(true);
  };

  const openEditModal = (item: IndustriFarmasi) => {
    setForm(item);
    setEditingKode(item.kode_industri);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingKode ? `/api/apotek/industri-farmasi/${encodeURIComponent(editingKode)}` : '/api/apotek/industri-farmasi';
      const res = await fetch(url, {
        method: editingKode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: IndustriFarmasi) => {
    const confirm = await Swal.fire({
      title: 'Hapus Industri Farmasi?',
      text: `${item.kode_industri} — ${item.nama_industri}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setDeletingKode(item.kode_industri);
    try {
      const res = await fetch(`/api/apotek/industri-farmasi/${encodeURIComponent(item.kode_industri)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setDeletingKode(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Cari Kode / Nama / Kota..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...inputStyle, width: 280 }}
        />
        <button
          type="button"
          onClick={openTambahModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Tambah Industri Farmasi
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Industri Farmasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Alamat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kota</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Telp</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data industri farmasi</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.kode_industri} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kode_industri}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama_industri}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.alamat}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kota}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_telp}</td>
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
                        onClick={() => handleDelete(item)}
                        disabled={deletingKode === item.kode_industri}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: deletingKode === item.kode_industri ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {deletingKode === item.kode_industri ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: 16, padding: 20, maxWidth: 480, width: '95%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{editingKode ? 'Edit Industri Farmasi' : 'Tambah Industri Farmasi'}</span>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Kode *">
                <input required style={inputStyle} value={form.kode_industri} onChange={(e) => setForm((p) => ({ ...p, kode_industri: e.target.value }))} />
              </Field>
              <Field label="Nama Industri Farmasi *">
                <input required style={inputStyle} value={form.nama_industri} onChange={(e) => setForm((p) => ({ ...p, nama_industri: e.target.value }))} />
              </Field>
              <Field label="Alamat">
                <input style={inputStyle} value={form.alamat} onChange={(e) => setForm((p) => ({ ...p, alamat: e.target.value }))} />
              </Field>
              <Field label="Kota">
                <input style={inputStyle} value={form.kota} onChange={(e) => setForm((p) => ({ ...p, kota: e.target.value }))} />
              </Field>
              <Field label="No. Telp">
                <input style={inputStyle} value={form.no_telp} onChange={(e) => setForm((p) => ({ ...p, no_telp: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
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
