import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type RujukanKeluarItem = {
  no_rujukan: string;
  no_sep: string;
  tgl_rujukan: string;
  tgl_rencana_kunjungan: string;
  ppk_dirujuk: string;
  nm_ppk_dirujuk: string;
  jns_pelayanan: string;
  catatan: string;
  diag_rujukan: string;
  nama_diag_rujukan: string;
  tipe_rujukan: string;
  poli_rujukan: string;
  nama_poli_rujukan: string;
  user_entry: string;
};

const emptyForm = (): RujukanKeluarItem => ({
  no_rujukan: '',
  no_sep: '',
  tgl_rujukan: localDateStr(),
  tgl_rencana_kunjungan: '',
  ppk_dirujuk: '',
  nm_ppk_dirujuk: '',
  jns_pelayanan: '2',
  catatan: '',
  diag_rujukan: '',
  nama_diag_rujukan: '',
  tipe_rujukan: '0',
  poli_rujukan: '',
  nama_poli_rujukan: '',
  user_entry: '',
});

const tipeLabel = (t: string) => {
  if (t.startsWith('1')) return 'Partial';
  if (t.startsWith('2')) return 'Rujuk Balik';
  return 'Penuh';
};

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

export const BpjsRujukanKeluarView: React.FC = () => {
  const [items, setItems] = React.useState<RujukanKeluarItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [tglDari, setTglDari] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateStr(d);
  });
  const [tglSampai, setTglSampai] = React.useState(localDateStr());
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<RujukanKeluarItem>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [editingNoRujukan, setEditingNoRujukan] = React.useState<string | null>(null);
  const [checkingNoRujukan, setCheckingNoRujukan] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/rujukan-keluar/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data rujukan keluar');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari, tglSampai, searchText]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreateModal = () => {
    setForm(emptyForm());
    setEditingNoRujukan(null);
    setShowModal(true);
  };

  const openEditModal = (item: RujukanKeluarItem) => {
    setForm({
      ...item,
      tgl_rujukan: item.tgl_rujukan && !item.tgl_rujukan.startsWith('0000-00-00') ? item.tgl_rujukan.split('T')[0] : localDateStr(),
      tgl_rencana_kunjungan: item.tgl_rencana_kunjungan && !item.tgl_rencana_kunjungan.startsWith('0000-00-00') ? item.tgl_rencana_kunjungan.split('T')[0] : '',
      tipe_rujukan: item.tipe_rujukan.startsWith('1') ? '1' : item.tipe_rujukan.startsWith('2') ? '2' : '0',
    });
    setEditingNoRujukan(item.no_rujukan);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/rujukan-keluar', {
        method: editingNoRujukan ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan rujukan');
      setShowModal(false);
      setEditingNoRujukan(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Rujukan tersimpan', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCekBpjs = async (noRujukan: string) => {
    setCheckingNoRujukan(noRujukan);
    try {
      const res = await fetch(`/api/bridging/rujukan-keluar/bpjs/${encodeURIComponent(noRujukan)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rujukan tidak ditemukan');
      Swal.fire({
        icon: 'info',
        title: `Data BPJS — ${noRujukan}`,
        html: `<pre style="text-align:left;font-size:11px;white-space:pre-wrap;max-height:300px;overflow:auto;">${JSON.stringify(data.rujukan, null, 2)}</pre>`,
        width: 600,
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setCheckingNoRujukan(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari No. Rujukan / No. SEP / PPK Dirujuk"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s.d.</span>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Buat Rujukan
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rujukan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. SEP</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>PPK Dirujuk</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tipe</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Rujukan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data rujukan keluar</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.no_rujukan} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_rujukan}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_sep}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nm_ppk_dirujuk || item.ppk_dirujuk || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{tipeLabel(item.tipe_rujukan)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tgl_rujukan)}</td>
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
                        onClick={() => handleCekBpjs(item.no_rujukan)}
                        disabled={checkingNoRujukan === item.no_rujukan}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#ffffff', color: '#2563eb', cursor: checkingNoRujukan === item.no_rujukan ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {checkingNoRujukan === item.no_rujukan ? 'Mengecek...' : 'Cek BPJS'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Buat/Edit Rujukan — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 640, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingNoRujukan ? `Edit Rujukan — ${editingNoRujukan}` : 'Buat Rujukan'}</span>
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
                  <input required disabled={!!editingNoRujukan} style={{ ...inputStyle, background: editingNoRujukan ? '#f3f4f6' : '#fff' }} value={form.no_sep} onChange={(e) => setForm((p) => ({ ...p, no_sep: e.target.value }))} />
                </Field>
                <Field label="No. Rujukan">
                  <input disabled={!!editingNoRujukan} style={{ ...inputStyle, background: editingNoRujukan ? '#f3f4f6' : '#fff' }} value={form.no_rujukan} onChange={(e) => setForm((p) => ({ ...p, no_rujukan: e.target.value }))} placeholder="Isi manual / dari BPJS" />
                </Field>
                <Field label="Tgl Rujukan *">
                  <input required type="date" style={inputStyle} value={form.tgl_rujukan} onChange={(e) => setForm((p) => ({ ...p, tgl_rujukan: e.target.value }))} />
                </Field>
                <Field label="Tgl Rencana Kunjungan">
                  <input type="date" style={inputStyle} value={form.tgl_rencana_kunjungan} onChange={(e) => setForm((p) => ({ ...p, tgl_rencana_kunjungan: e.target.value }))} />
                </Field>
                <Field label="Kode PPK Dirujuk">
                  <input style={inputStyle} value={form.ppk_dirujuk} onChange={(e) => setForm((p) => ({ ...p, ppk_dirujuk: e.target.value }))} />
                </Field>
                <Field label="Nama PPK Dirujuk">
                  <input style={inputStyle} value={form.nm_ppk_dirujuk} onChange={(e) => setForm((p) => ({ ...p, nm_ppk_dirujuk: e.target.value }))} />
                </Field>
                <Field label="Jenis Pelayanan">
                  <select style={inputStyle} value={form.jns_pelayanan} onChange={(e) => setForm((p) => ({ ...p, jns_pelayanan: e.target.value }))}>
                    <option value="1">Rawat Jalan</option>
                    <option value="2">Rawat Inap</option>
                  </select>
                </Field>
                <Field label="Tipe Rujukan">
                  <select style={inputStyle} value={form.tipe_rujukan} onChange={(e) => setForm((p) => ({ ...p, tipe_rujukan: e.target.value }))}>
                    <option value="0">Penuh</option>
                    <option value="1">Partial</option>
                    <option value="2">Rujuk Balik</option>
                  </select>
                </Field>
                <Field label="Kode Diagnosa Rujukan">
                  <input style={inputStyle} value={form.diag_rujukan} onChange={(e) => setForm((p) => ({ ...p, diag_rujukan: e.target.value }))} placeholder="ICD-10" />
                </Field>
                <Field label="Nama Diagnosa Rujukan">
                  <input style={inputStyle} value={form.nama_diag_rujukan} onChange={(e) => setForm((p) => ({ ...p, nama_diag_rujukan: e.target.value }))} />
                </Field>
                <Field label="Kode Poli Rujukan">
                  <input style={inputStyle} value={form.poli_rujukan} onChange={(e) => setForm((p) => ({ ...p, poli_rujukan: e.target.value }))} />
                </Field>
                <Field label="Nama Poli Rujukan">
                  <input style={inputStyle} value={form.nama_poli_rujukan} onChange={(e) => setForm((p) => ({ ...p, nama_poli_rujukan: e.target.value }))} />
                </Field>
                <Field label="User Entry">
                  <input style={inputStyle} value={form.user_entry} onChange={(e) => setForm((p) => ({ ...p, user_entry: e.target.value }))} />
                </Field>
              </div>
              <Field label="Catatan">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.catatan} onChange={(e) => setForm((p) => ({ ...p, catatan: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingNoRujukan(null); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Menyimpan...' : editingNoRujukan ? 'Update ke BPJS' : 'Kirim ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
