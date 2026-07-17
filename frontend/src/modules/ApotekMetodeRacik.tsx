import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Metode Racik (item #9 dari 13 sub-menu Pengaturan). Cocok
// dengan dialog Khanza Desktop "Metode Racik"
// (inventory/DlgMetodeRacik.java) — CRUD master metode racikan obat
// (Puyer, Sirup, Salep, Kapsul, dll). Tabel ini SUDAH dikonsumsi fitur
// Resep Ranap yang ada (resep_ranap_handler.go, resep_dokter_racikan.kd_racik).
// Kode boleh diganti (mengikuti Java), tapi backend menolak kalau kode
// masih dipakai riwayat resep racikan. Lihat backend/apotek_metode_racik_handler.go.
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

type MetodeRacik = { kd_racik: string; nm_racik: string };
const emptyForm = (): MetodeRacik => ({ kd_racik: '', nm_racik: '' });

export const ApotekMetodeRacikView: React.FC = () => {
  const [items, setItems] = React.useState<MetodeRacik[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<MetodeRacik>(emptyForm());
  const [editingKode, setEditingKode] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingKode, setDeletingKode] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apotek/metode-racik${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`);
      if (!res.ok) throw new Error('Gagal mengambil data metode racik');
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

  const openEditModal = (item: MetodeRacik) => {
    setForm(item);
    setEditingKode(item.kd_racik);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingKode ? `/api/apotek/metode-racik/${encodeURIComponent(editingKode)}` : '/api/apotek/metode-racik';
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

  const handleDelete = async (item: MetodeRacik) => {
    const confirm = await Swal.fire({
      title: 'Hapus Metode Racik?',
      text: `${item.kd_racik} — ${item.nm_racik}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setDeletingKode(item.kd_racik);
    try {
      const res = await fetch(`/api/apotek/metode-racik/${encodeURIComponent(item.kd_racik)}`, { method: 'DELETE' });
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
          placeholder="Cari Kode / Nama Racik..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...inputStyle, width: 280 }}
        />
        <button
          type="button"
          onClick={openTambahModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Tambah Metode Racik
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Racik</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data metode racik</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.kd_racik} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kd_racik}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nm_racik}</td>
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
                        disabled={deletingKode === item.kd_racik}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: deletingKode === item.kd_racik ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {deletingKode === item.kd_racik ? 'Menghapus...' : 'Hapus'}
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
            style={{ background: '#ffffff', borderRadius: 16, padding: 20, maxWidth: 380, width: '95%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{editingKode ? 'Edit Metode Racik' : 'Tambah Metode Racik'}</span>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Kode Racik *">
                <input required style={inputStyle} value={form.kd_racik} onChange={(e) => setForm((p) => ({ ...p, kd_racik: e.target.value }))} />
              </Field>
              <Field label="Nama Racik *">
                <input required style={inputStyle} value={form.nm_racik} onChange={(e) => setForm((p) => ({ ...p, nm_racik: e.target.value }))} />
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
