import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type JenisPengajuan = 'ritl_backdate' | 'rjtl_backdate' | 'tanpa_fingerprint';

type PengajuanItem = {
  id: number;
  no_sep: string;
  no_kartu: string;
  nama_pasien: string;
  jenis_pengajuan: JenisPengajuan;
  tgl_pengajuan: string;
  tgl_masuk: string;
  alasan: string;
  status: 'diajukan' | 'disetujui' | 'ditolak';
  catatan_approval: string;
  user_entry: string;
  created_at: string;
};

type FormState = {
  no_sep: string;
  no_kartu: string;
  nama_pasien: string;
  jenis_pengajuan: JenisPengajuan;
  tgl_pengajuan: string;
  tgl_masuk: string;
  alasan: string;
  user_entry: string;
};

const emptyForm = (): FormState => ({
  no_sep: '',
  no_kartu: '',
  nama_pasien: '',
  jenis_pengajuan: 'tanpa_fingerprint',
  tgl_pengajuan: localDateStr(),
  tgl_masuk: '',
  alasan: '',
  user_entry: '',
});

const jenisLabel: Record<JenisPengajuan, string> = {
  ritl_backdate: 'RITL Backdate (>3x24 jam)',
  rjtl_backdate: 'RJTL Backdate',
  tanpa_fingerprint: 'Persetujuan SEP tanpa Fingerprint',
};

const statusColor: Record<PengajuanItem['status'], { bg: string; color: string; border: string }> = {
  diajukan: { bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
  disetujui: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  ditolak: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
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

export const BpjsPengajuanPenjaminanView: React.FC = () => {
  const [items, setItems] = React.useState<PengajuanItem[]>([]);
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
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<number | null>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/pengajuan-penjaminan/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data pengajuan penjaminan');
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

  const openModal = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/pengajuan-penjaminan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengajuan penjaminan');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Pengajuan penjaminan berhasil dikirim', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (item: PengajuanItem) => {
    const confirm = await Swal.fire({
      title: 'Setujui Penjaminan?',
      html: `No. Kartu: ${item.no_kartu}<br/>Jenis: ${jenisLabel[item.jenis_pengajuan]}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Setujui',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    setApprovingId(item.id);
    try {
      const res = await fetch('/api/bridging/pengajuan-penjaminan/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, no_sep: item.no_sep, no_kartu: item.no_kartu, user_entry: item.user_entry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui penjaminan');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Disetujui!', text: data.message || 'Penjaminan berhasil disetujui' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari No. SEP / No. Kartu / Nama Pasien"
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
          onClick={openModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Pengajuan Penjaminan
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Kartu</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Pengajuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Pengajuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Catatan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data pengajuan penjaminan</td></tr>
            ) : (
              items.map((item, index) => {
                const sc = statusColor[item.status];
                const isBackdate = item.jenis_pengajuan === 'ritl_backdate' || item.jenis_pengajuan === 'rjtl_backdate';
                return (
                  <tr key={item.id} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_kartu}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama_pasien || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{jenisLabel[item.jenis_pengajuan]}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tgl_pengajuan)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', maxWidth: 220 }}>{item.catatan_approval || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {item.status === 'diajukan' && (
                        <button
                          type="button"
                          onClick={() => handleApproval(item)}
                          disabled={approvingId === item.id}
                          title={isBackdate ? 'Aproval backdate harus menghubungi Kantor Cabang (KC) BPJS' : 'Aproval via fingerprint'}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #16a34a',
                            background: '#ffffff',
                            color: '#16a34a',
                            cursor: approvingId === item.id ? 'not-allowed' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {approvingId === item.id ? 'Memproses...' : 'Approval'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Pengajuan Penjaminan — pola default_card.md */}
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
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Pengajuan Penjaminan</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Jenis Pengajuan *">
                <select
                  required
                  style={inputStyle}
                  value={form.jenis_pengajuan}
                  onChange={(e) => setForm((p) => ({ ...p, jenis_pengajuan: e.target.value as JenisPengajuan }))}
                >
                  <option value="tanpa_fingerprint">Persetujuan SEP tanpa Fingerprint</option>
                  <option value="rjtl_backdate">RJTL Backdate</option>
                  <option value="ritl_backdate">RITL Backdate (&gt;3x24 jam)</option>
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="No. Kartu BPJS *">
                  <input required style={inputStyle} value={form.no_kartu} onChange={(e) => setForm((p) => ({ ...p, no_kartu: e.target.value }))} />
                </Field>
                <Field label="Nama Pasien">
                  <input style={inputStyle} value={form.nama_pasien} onChange={(e) => setForm((p) => ({ ...p, nama_pasien: e.target.value }))} />
                </Field>
                <Field label="No. SEP">
                  <input style={inputStyle} value={form.no_sep} onChange={(e) => setForm((p) => ({ ...p, no_sep: e.target.value }))} />
                </Field>
                <Field label="Tgl Pengajuan *">
                  <input required type="date" style={inputStyle} value={form.tgl_pengajuan} onChange={(e) => setForm((p) => ({ ...p, tgl_pengajuan: e.target.value }))} />
                </Field>
                {form.jenis_pengajuan === 'ritl_backdate' && (
                  <Field label="Tgl Masuk Rawat *">
                    <input required type="date" style={inputStyle} value={form.tgl_masuk} onChange={(e) => setForm((p) => ({ ...p, tgl_masuk: e.target.value }))} />
                  </Field>
                )}
                <Field label="User Entry *">
                  <input required style={inputStyle} value={form.user_entry} onChange={(e) => setForm((p) => ({ ...p, user_entry: e.target.value }))} />
                </Field>
              </div>

              <Field label="Alasan">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.alasan} onChange={(e) => setForm((p) => ({ ...p, alasan: e.target.value }))} />
              </Field>

              {(form.jenis_pengajuan === 'ritl_backdate' || form.jenis_pengajuan === 'rjtl_backdate') && (
                <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12, background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
                  ⚠ Aproval untuk pengajuan backdate tidak bisa dilakukan lewat aplikasi ini — harus menghubungi Kantor Cabang (KC) BPJS.
                </div>
              )}

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
                  {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
