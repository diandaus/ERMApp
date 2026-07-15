import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type DiagnosaKhusus = { status: 'P' | 'S'; kode: string; nama: string };
type ProsedurKhusus = { kode: string; nama: string };

type RujukanKhususItem = {
  no_rujukan: string;
  no_kartu: string;
  nama_peserta: string;
  tgl_rujukan_awal: string;
  tgl_rujukan_akhir: string;
};

type FormState = {
  no_rujukan: string;
  no_kartu: string;
  nama_peserta: string;
  tgl_rujukan_awal: string;
  tgl_rujukan_akhir: string;
  tgl_akhir_lama: string;
  kd_poli_terakhir: string;
  nm_poli_terakhir: string;
  diagnosa: DiagnosaKhusus[];
  prosedur: ProsedurKhusus[];
  user_entry: string;
};

const emptyForm = (): FormState => ({
  no_rujukan: '',
  no_kartu: '',
  nama_peserta: '',
  tgl_rujukan_awal: localDateStr(),
  tgl_rujukan_akhir: '',
  tgl_akhir_lama: '',
  kd_poli_terakhir: '',
  nm_poli_terakhir: '',
  diagnosa: [{ status: 'P', kode: '', nama: '' }],
  prosedur: [{ kode: '', nama: '' }],
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

export const BpjsRujukanKhususView: React.FC = () => {
  const [items, setItems] = React.useState<RujukanKhususItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [deletingNoRujukan, setDeletingNoRujukan] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/bridging/rujukan-khusus/list';
      if (searchText) url += `?search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data rujukan khusus');
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

  const openModal = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const updateDiagnosa = (idx: number, patch: Partial<DiagnosaKhusus>) => {
    setForm((p) => ({ ...p, diagnosa: p.diagnosa.map((d, i) => (i === idx ? { ...d, ...patch } : d)) }));
  };
  const updateProsedur = (idx: number, patch: Partial<ProsedurKhusus>) => {
    setForm((p) => ({ ...p, prosedur: p.prosedur.map((d, i) => (i === idx ? { ...d, ...patch } : d)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/rujukan-khusus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperpanjang rujukan khusus');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Rujukan khusus berhasil diperpanjang', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (item: RujukanKhususItem) => {
    const confirm = await Swal.fire({
      title: 'Hapus Perpanjangan Rujukan Khusus?',
      text: `No. Rujukan: ${item.no_rujukan}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingNoRujukan(item.no_rujukan);
    try {
      const res = await fetch(`/api/bridging/rujukan-khusus/${encodeURIComponent(item.no_rujukan)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus perpanjangan');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'Perpanjangan berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingNoRujukan(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text"
          placeholder="Cari No. Rujukan / No. Kartu / Nama Peserta"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...inputStyle, width: 300 }}
        />
        <button
          type="button"
          onClick={openModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Perpanjang Rujukan Khusus HD
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Kartu</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Peserta</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Berlaku s.d.</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data rujukan khusus</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.no_rujukan} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_rujukan}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_kartu}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama_peserta || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tgl_rujukan_akhir)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleHapus(item)}
                      disabled={deletingNoRujukan === item.no_rujukan}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: deletingNoRujukan === item.no_rujukan ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}
                    >
                      {deletingNoRujukan === item.no_rujukan ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Perpanjangan Rujukan Khusus — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 680, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Perpanjang Rujukan Khusus HD</span>
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
                <Field label="No. Rujukan *">
                  <input required style={inputStyle} value={form.no_rujukan} onChange={(e) => setForm((p) => ({ ...p, no_rujukan: e.target.value }))} />
                </Field>
                <Field label="No. Kartu BPJS">
                  <input style={inputStyle} value={form.no_kartu} onChange={(e) => setForm((p) => ({ ...p, no_kartu: e.target.value }))} />
                </Field>
                <Field label="Nama Peserta">
                  <input style={inputStyle} value={form.nama_peserta} onChange={(e) => setForm((p) => ({ ...p, nama_peserta: e.target.value }))} />
                </Field>
                <Field label="Tgl Akhir Masa Berlaku Lama (jika ada)">
                  <input type="date" style={inputStyle} value={form.tgl_akhir_lama} onChange={(e) => setForm((p) => ({ ...p, tgl_akhir_lama: e.target.value }))} />
                </Field>
                <Field label="Tgl Rujukan Awal">
                  <input type="date" style={inputStyle} value={form.tgl_rujukan_awal} onChange={(e) => setForm((p) => ({ ...p, tgl_rujukan_awal: e.target.value }))} />
                </Field>
                <Field label="Tgl Akhir Masa Berlaku Baru">
                  <input type="date" style={inputStyle} value={form.tgl_rujukan_akhir} onChange={(e) => setForm((p) => ({ ...p, tgl_rujukan_akhir: e.target.value }))} />
                </Field>
                <Field label="Kode Poli Terakhir (harus HD) *">
                  <input required style={inputStyle} value={form.kd_poli_terakhir} onChange={(e) => setForm((p) => ({ ...p, kd_poli_terakhir: e.target.value }))} />
                </Field>
                <Field label="Nama Poli Terakhir *">
                  <input required style={inputStyle} value={form.nm_poli_terakhir} onChange={(e) => setForm((p) => ({ ...p, nm_poli_terakhir: e.target.value }))} placeholder="Poli Hemodialisa" />
                </Field>
                <Field label="User Entry">
                  <input style={inputStyle} value={form.user_entry} onChange={(e) => setForm((p) => ({ ...p, user_entry: e.target.value }))} />
                </Field>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Diagnosa (wajib ada minimal 1 diagnosa primer)</div>
                {form.diagnosa.map((d, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr auto', gap: 8, marginBottom: 6 }}>
                    <select style={inputStyle} value={d.status} onChange={(e) => updateDiagnosa(idx, { status: e.target.value as 'P' | 'S' })}>
                      <option value="P">Primer</option>
                      <option value="S">Sekunder</option>
                    </select>
                    <input style={inputStyle} placeholder="Kode ICD-10" value={d.kode} onChange={(e) => updateDiagnosa(idx, { kode: e.target.value })} />
                    <input style={inputStyle} placeholder="Nama diagnosa" value={d.nama} onChange={(e) => updateDiagnosa(idx, { nama: e.target.value })} />
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, diagnosa: p.diagnosa.filter((_, i) => i !== idx) }))}
                      style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, diagnosa: [...p.diagnosa, { status: 'S', kode: '', nama: '' }] }))}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 12 }}
                >
                  + Tambah Diagnosa
                </button>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Prosedur (wajib ada minimal 1)</div>
                {form.prosedur.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, marginBottom: 6 }}>
                    <input style={inputStyle} placeholder="Kode ICD-9-CM" value={p.kode} onChange={(e) => updateProsedur(idx, { kode: e.target.value })} />
                    <input style={inputStyle} placeholder="Nama prosedur" value={p.nama} onChange={(e) => updateProsedur(idx, { nama: e.target.value })} />
                    <button
                      type="button"
                      onClick={() => setForm((fp) => ({ ...fp, prosedur: fp.prosedur.filter((_, i) => i !== idx) }))}
                      style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, prosedur: [...p.prosedur, { kode: '', nama: '' }] }))}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 12 }}
                >
                  + Tambah Prosedur
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Menyimpan...' : 'Perpanjang ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
