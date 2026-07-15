import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type SuratKontrolItem = {
  no_surat_kontrol: string;
  no_sep: string;
  tgl_surat: string;
  tgl_rencana_kontrol: string;
  kd_dokter: string;
  nm_dokter: string;
  kd_poli: string;
  nm_poli: string;
};

type FormState = SuratKontrolItem & { user_entry: string };

const emptyForm = (): FormState => ({
  no_surat_kontrol: '',
  no_sep: '',
  tgl_surat: localDateStr(),
  tgl_rencana_kontrol: '',
  kd_dokter: '',
  nm_dokter: '',
  kd_poli: '',
  nm_poli: '',
  user_entry: '',
});

const formatTgl = (tgl: string) => {
  if (!tgl || tgl.startsWith('0000-00-00')) return '-';
  const datePart = tgl.includes('T') ? tgl.split('T')[0] : tgl;
  const [y, m, d] = datePart.split('-');
  return y && m && d ? `${d}/${m}/${y}` : datePart;
};

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

export const BpjsSuratKontrolView: React.FC = () => {
  const [items, setItems] = React.useState<SuratKontrolItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tglDari, setTglDari] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateStr(d);
  });
  const [tglSampai, setTglSampai] = React.useState(localDateStr());
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [editingNoSurat, setEditingNoSurat] = React.useState<string | null>(null);
  const [deletingNoSurat, setDeletingNoSurat] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bridging/surat-kontrol/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`);
      if (!res.ok) throw new Error('Gagal mengambil data surat kontrol');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari, tglSampai]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreateModal = () => {
    setForm(emptyForm());
    setEditingNoSurat(null);
    setShowModal(true);
  };

  const openEditModal = (item: SuratKontrolItem) => {
    setForm({
      ...emptyForm(),
      ...item,
      tgl_surat: item.tgl_surat && !item.tgl_surat.startsWith('0000-00-00') ? item.tgl_surat.split('T')[0] : localDateStr(),
      tgl_rencana_kontrol: item.tgl_rencana_kontrol && !item.tgl_rencana_kontrol.startsWith('0000-00-00') ? item.tgl_rencana_kontrol.split('T')[0] : '',
    });
    setEditingNoSurat(item.no_surat_kontrol);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/surat-kontrol', {
        method: editingNoSurat ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan surat kontrol');
      setShowModal(false);
      setEditingNoSurat(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Surat kontrol tersimpan', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (item: SuratKontrolItem) => {
    const confirm = await Swal.fire({
      title: 'Hapus Surat Kontrol?',
      text: `No. Surat: ${item.no_surat_kontrol}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingNoSurat(item.no_surat_kontrol);
    try {
      const res = await fetch(`/api/bridging/surat-kontrol/${encodeURIComponent(item.no_surat_kontrol)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus surat kontrol');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'Surat kontrol berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingNoSurat(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s.d.</span>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Buat Surat Kontrol
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Surat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. SEP</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli Kontrol</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Rencana Kontrol</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data surat kontrol</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.no_surat_kontrol} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_surat_kontrol}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_sep}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nm_poli || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.nm_dokter || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tgl_rencana_kontrol)}</td>
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
                        onClick={() => handleHapus(item)}
                        disabled={deletingNoSurat === item.no_surat_kontrol}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: deletingNoSurat === item.no_surat_kontrol ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {deletingNoSurat === item.no_surat_kontrol ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Buat/Edit Surat Kontrol — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 560, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingNoSurat ? `Edit Surat Kontrol — ${editingNoSurat}` : 'Buat Surat Kontrol'}</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="No. SEP *">
                  <input required style={inputStyle} value={form.no_sep} onChange={(e) => setForm((p) => ({ ...p, no_sep: e.target.value }))} />
                </Field>
                <Field label="No. Surat Kontrol">
                  <input disabled={!!editingNoSurat} style={{ ...inputStyle, background: editingNoSurat ? '#f3f4f6' : '#fff' }} value={form.no_surat_kontrol} onChange={(e) => setForm((p) => ({ ...p, no_surat_kontrol: e.target.value }))} placeholder="Isi manual / dari BPJS" />
                </Field>
                <Field label="Tgl Rencana Kontrol *">
                  <input required type="date" style={inputStyle} value={form.tgl_rencana_kontrol} onChange={(e) => setForm((p) => ({ ...p, tgl_rencana_kontrol: e.target.value }))} />
                </Field>
                <Field label="Kode Dokter">
                  <input style={inputStyle} value={form.kd_dokter} onChange={(e) => setForm((p) => ({ ...p, kd_dokter: e.target.value }))} />
                </Field>
                <Field label="Nama Dokter">
                  <input style={inputStyle} value={form.nm_dokter} onChange={(e) => setForm((p) => ({ ...p, nm_dokter: e.target.value }))} />
                </Field>
                <Field label="Kode Poli Kontrol">
                  <input style={inputStyle} value={form.kd_poli} onChange={(e) => setForm((p) => ({ ...p, kd_poli: e.target.value }))} />
                </Field>
                <Field label="Nama Poli Kontrol">
                  <input style={inputStyle} value={form.nm_poli} onChange={(e) => setForm((p) => ({ ...p, nm_poli: e.target.value }))} />
                </Field>
                <Field label="User Entry">
                  <input style={inputStyle} value={form.user_entry} onChange={(e) => setForm((p) => ({ ...p, user_entry: e.target.value }))} />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingNoSurat(null); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Menyimpan...' : editingNoSurat ? 'Update ke BPJS' : 'Terbitkan ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
