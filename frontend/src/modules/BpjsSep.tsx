import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type SepItem = {
  no_sep: string;
  no_rawat: string;
  tglsep: string;
  tglrujukan: string;
  no_rujukan: string;
  kdppkrujukan: string;
  nmppkrujukan: string;
  kdppkpelayanan: string;
  nmppkpelayanan: string;
  jnspelayanan: string;
  catatan: string;
  diagawal: string;
  nmdiagnosaawal: string;
  kdpolitujuan: string;
  nmpolitujuan: string;
  klsrawat: string;
  nomr: string;
  nama_pasien: string;
  tanggal_lahir: string;
  peserta: string;
  jkel: string;
  no_kartu: string;
  kddpjp: string;
  nmdpdjp: string;
  noskdp: string;
  klsnaik: string;
  pembiayaan: string;
  pjnaikkelas: string;
  // Kecelakaan Lalu Lintas (KLL) / Jasa Raharja
  lakalantas: string;
  kdprop: string;
  nmprop: string;
  kdkab: string;
  nmkab: string;
  kdkec: string;
  nmkec: string;
  tglkkl: string;
  keterangankkl: string;
  suplesi: string;
  no_sep_suplesi: string;
  // Wajib diisi untuk update SEP
  notelep: string;
  user_entry: string;
};

const emptyForm = (): SepItem => ({
  no_sep: '',
  no_rawat: '',
  tglsep: localDateStr(),
  tglrujukan: '',
  no_rujukan: '',
  kdppkrujukan: '',
  nmppkrujukan: '',
  kdppkpelayanan: '',
  nmppkpelayanan: '',
  jnspelayanan: '2',
  catatan: '',
  diagawal: '',
  nmdiagnosaawal: '',
  kdpolitujuan: '',
  nmpolitujuan: '',
  klsrawat: '2',
  nomr: '',
  nama_pasien: '',
  tanggal_lahir: '',
  peserta: '',
  jkel: '',
  no_kartu: '',
  kddpjp: '',
  nmdpdjp: '',
  noskdp: '',
  klsnaik: '',
  pembiayaan: '',
  pjnaikkelas: '',
  lakalantas: '',
  kdprop: '',
  nmprop: '',
  kdkab: '',
  nmkab: '',
  kdkec: '',
  nmkec: '',
  tglkkl: '',
  keterangankkl: '',
  suplesi: '',
  no_sep_suplesi: '',
  notelep: '',
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

export const BpjsSepView: React.FC = () => {
  const [items, setItems] = React.useState<SepItem[]>([]);
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
  const [form, setForm] = React.useState<SepItem>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [sendingNoSep, setSendingNoSep] = React.useState<string | null>(null);
  const [deletingNoSep, setDeletingNoSep] = React.useState<string | null>(null);
  const [editingNoSep, setEditingNoSep] = React.useState<string | null>(null);
  const [pulangNoSep, setPulangNoSep] = React.useState<string | null>(null);
  const [pulangForm, setPulangForm] = React.useState({ tgl_pulang: localDateStr(), cara_pulang: '', no_surat_kematian: '', no_laporan_polisi: '', user_entry: '' });
  const [savingPulang, setSavingPulang] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/sep/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data SEP');
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

  const openInputModal = () => {
    setForm(emptyForm());
    setEditingNoSep(null);
    setShowModal(true);
  };

  const openEditModal = (item: SepItem) => {
    setForm({
      ...emptyForm(),
      ...item,
      tglsep: item.tglsep && !item.tglsep.startsWith('0000-00-00') ? item.tglsep.split('T')[0] : localDateStr(),
      tglrujukan: item.tglrujukan && !item.tglrujukan.startsWith('0000-00-00') ? item.tglrujukan.split('T')[0] : '',
      tanggal_lahir: item.tanggal_lahir && !item.tanggal_lahir.startsWith('0000-00-00') ? item.tanggal_lahir.split('T')[0] : '',
      tglkkl: item.tglkkl && !item.tglkkl.startsWith('0000-00-00') ? item.tglkkl.split('T')[0] : '',
      suplesi: item.suplesi && (item.suplesi.startsWith('1') ) ? '1' : '',
    });
    setEditingNoSep(item.no_sep);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/sep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan SEP');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'SEP tersimpan secara lokal', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/sep/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui SEP');
      setShowModal(false);
      setEditingNoSep(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'SEP berhasil diperbarui', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // 16.1.1 — poli mata/jantung/IRM/hemodialisa wajib validasi sidik jari
  // sebelum SEP diterbitkan. Cermin dari sepRequiresFingerprint di backend.
  const requiresFingerprint = (nmPoliTujuan: string) => {
    const poli = (nmPoliTujuan || '').toLowerCase();
    return ['mata', 'jantung', 'irm', 'rehabilitasi medik', 'fisioterapi', 'hemodialisa', 'hemodialisis'].some((kw) => poli.includes(kw));
  };

  const handleKirim = async (item: SepItem) => {
    const noSep = item.no_sep;
    let fingerprintVerified = false;

    if (requiresFingerprint(item.nmpolitujuan)) {
      const fpConfirm = await Swal.fire({
        title: 'Validasi Sidik Jari Diperlukan',
        html: `SEP untuk poli <strong>${item.nmpolitujuan}</strong> wajib divalidasi sidik jari sebelum diterbitkan.<br/>Sudah dilakukan validasi sidik jari?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sudah, Lanjutkan',
        cancelButtonText: 'Batal',
      });
      if (!fpConfirm.isConfirmed) return;
      fingerprintVerified = true;
    }

    const confirm = await Swal.fire({
      title: 'Kirim SEP ke BPJS?',
      text: `No. SEP: ${noSep}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Kirim',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    setSendingNoSep(noSep);
    try {
      const url = `/api/bridging/sep/kirim/${encodeURIComponent(noSep)}${fingerprintVerified ? '?fingerprint_verified=1' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim SEP ke BPJS');
      Swal.fire({ icon: 'success', title: 'Terkirim!', text: data.message || 'SEP berhasil dikirim ke BPJS' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Kirim', text: err.message });
    } finally {
      setSendingNoSep(null);
    }
  };

  const handleHapus = async (noSep: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus SEP?',
      text: `No. SEP: ${noSep} akan dihapus dari BPJS dan data lokal`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingNoSep(noSep);
    try {
      const res = await fetch(`/api/bridging/sep/${encodeURIComponent(noSep)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus SEP');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'SEP berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingNoSep(null);
    }
  };

  const openPulangModal = (noSep: string) => {
    setPulangForm({ tgl_pulang: localDateStr(), cara_pulang: '', no_surat_kematian: '', no_laporan_polisi: '', user_entry: '' });
    setPulangNoSep(noSep);
  };

  const handleUpdatePulang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pulangNoSep) return;
    setSavingPulang(true);
    try {
      const res = await fetch('/api/bridging/sep/update-tgl-pulang', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_sep: pulangNoSep, ...pulangForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tanggal pulang');
      setPulangNoSep(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Tanggal pulang berhasil diperbarui', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSavingPulang(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari No. SEP / No. Rawat / Nama Pasien"
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
          onClick={openInputModal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Input SEP
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. SEP</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli Tujuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl SEP</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data SEP</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.no_sep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_sep}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_rawat}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.nomr}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nama_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.nmpolitujuan || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tglsep)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleKirim(item)}
                        disabled={sendingNoSep === item.no_sep}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #2563eb',
                          background: '#ffffff',
                          color: '#2563eb',
                          cursor: sendingNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {sendingNoSep === item.no_sep ? 'Mengirim...' : 'Kirim ke BPJS'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #d97706',
                          background: '#ffffff',
                          color: '#d97706',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => openPulangModal(item.no_sep)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #16a34a',
                          background: '#ffffff',
                          color: '#16a34a',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        Pulang
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHapus(item.no_sep)}
                        disabled={deletingNoSep === item.no_sep}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #dc2626',
                          background: '#ffffff',
                          color: '#dc2626',
                          cursor: deletingNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {deletingNoSep === item.no_sep ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Input SEP — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 720, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingNoSep ? `Update SEP — ${editingNoSep}` : 'Input SEP'}</span>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingNoSep(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={editingNoSep ? handleUpdate : handleSave} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="No. Rawat *">
                  <input required style={inputStyle} value={form.no_rawat} onChange={(e) => setForm((p) => ({ ...p, no_rawat: e.target.value }))} placeholder="2026/07/15/000001" />
                </Field>
                <Field label="No. Kartu BPJS *">
                  <input required style={inputStyle} value={form.no_kartu} onChange={(e) => setForm((p) => ({ ...p, no_kartu: e.target.value }))} />
                </Field>
                <Field label="No. RM">
                  <input style={inputStyle} value={form.nomr} onChange={(e) => setForm((p) => ({ ...p, nomr: e.target.value }))} />
                </Field>
                <Field label="Nama Pasien">
                  <input style={inputStyle} value={form.nama_pasien} onChange={(e) => setForm((p) => ({ ...p, nama_pasien: e.target.value }))} />
                </Field>
                <Field label="Tgl SEP *">
                  <input required type="date" style={inputStyle} value={form.tglsep} onChange={(e) => setForm((p) => ({ ...p, tglsep: e.target.value }))} />
                </Field>
                <Field label="Jenis Pelayanan">
                  <select style={inputStyle} value={form.jnspelayanan} onChange={(e) => setForm((p) => ({ ...p, jnspelayanan: e.target.value }))}>
                    <option value="1">Rawat Jalan</option>
                    <option value="2">Rawat Inap</option>
                  </select>
                </Field>
                <Field label="Kelas Rawat">
                  <select style={inputStyle} value={form.klsrawat} onChange={(e) => setForm((p) => ({ ...p, klsrawat: e.target.value }))}>
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                  </select>
                </Field>
                <Field label="No. Rujukan">
                  <input style={inputStyle} value={form.no_rujukan} onChange={(e) => setForm((p) => ({ ...p, no_rujukan: e.target.value }))} />
                </Field>
                <Field label="Tgl Rujukan">
                  <input type="date" style={inputStyle} value={form.tglrujukan} onChange={(e) => setForm((p) => ({ ...p, tglrujukan: e.target.value }))} />
                </Field>
                <Field label="Kode Poli Tujuan">
                  <input style={inputStyle} value={form.kdpolitujuan} onChange={(e) => setForm((p) => ({ ...p, kdpolitujuan: e.target.value }))} />
                </Field>
                <Field label="Nama Poli Tujuan">
                  <input style={inputStyle} value={form.nmpolitujuan} onChange={(e) => setForm((p) => ({ ...p, nmpolitujuan: e.target.value }))} />
                </Field>
                <Field label="Kode Diagnosa Awal">
                  <input style={inputStyle} value={form.diagawal} onChange={(e) => setForm((p) => ({ ...p, diagawal: e.target.value }))} placeholder="ICD-10" />
                </Field>
                <Field label="Nama Diagnosa Awal">
                  <input style={inputStyle} value={form.nmdiagnosaawal} onChange={(e) => setForm((p) => ({ ...p, nmdiagnosaawal: e.target.value }))} />
                </Field>
                <Field label="No. SEP *">
                  <input required disabled={!!editingNoSep} style={{ ...inputStyle, background: editingNoSep ? '#f3f4f6' : '#fff' }} value={form.no_sep} onChange={(e) => setForm((p) => ({ ...p, no_sep: e.target.value }))} placeholder="Isi manual / dari BPJS" />
                </Field>
                <Field label="Kode DPJP *">
                  <input required style={inputStyle} value={form.kddpjp} onChange={(e) => setForm((p) => ({ ...p, kddpjp: e.target.value }))} />
                </Field>
                <Field label="Nama DPJP">
                  <input style={inputStyle} value={form.nmdpdjp} onChange={(e) => setForm((p) => ({ ...p, nmdpdjp: e.target.value }))} />
                </Field>
                <Field label="No. SKDP / SPRI (wajib jika Rawat Inap)">
                  <input style={inputStyle} value={form.noskdp} onChange={(e) => setForm((p) => ({ ...p, noskdp: e.target.value }))} />
                </Field>
                <Field label="Kelas Naik (opsional)">
                  <select style={inputStyle} value={form.klsnaik} onChange={(e) => setForm((p) => ({ ...p, klsnaik: e.target.value }))}>
                    <option value="">Tidak naik kelas</option>
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                  </select>
                </Field>
                <Field label="Pembiayaan Naik Kelas (jika naik kelas)">
                  <select style={inputStyle} value={form.pembiayaan} onChange={(e) => setForm((p) => ({ ...p, pembiayaan: e.target.value }))}>
                    <option value="">-</option>
                    <option value="1">Askes/BPJS Ketenagakerjaan</option>
                    <option value="2">Pemberi Kerja</option>
                    <option value="3">Asuransi Kesehatan Tambahan</option>
                  </select>
                </Field>
                <Field label="Penanggung Jawab Naik Kelas (jika naik kelas)">
                  <input style={inputStyle} value={form.pjnaikkelas} onChange={(e) => setForm((p) => ({ ...p, pjnaikkelas: e.target.value }))} />
                </Field>
                <Field label="No. HP *">
                  <input required style={inputStyle} value={form.notelep} onChange={(e) => setForm((p) => ({ ...p, notelep: e.target.value }))} />
                </Field>
                <Field label="User Entry *">
                  <input required style={inputStyle} value={form.user_entry} onChange={(e) => setForm((p) => ({ ...p, user_entry: e.target.value }))} />
                </Field>
              </div>

              <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Kecelakaan Lalu Lintas (KLL) / Jasa Raharja</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Lakalantas">
                    <select style={inputStyle} value={form.lakalantas} onChange={(e) => setForm((p) => ({ ...p, lakalantas: e.target.value }))}>
                      <option value="">Bukan KLL</option>
                      <option value="0">0 - Bukan Lakalantas</option>
                      <option value="1">1 - Lakalantas Tunggal</option>
                      <option value="2">2 - Lakalantas Ganda</option>
                      <option value="3">3 - Lakalantas Susulan</option>
                    </select>
                  </Field>
                  <Field label="Tgl Kejadian">
                    <input type="date" style={inputStyle} value={form.tglkkl} onChange={(e) => setForm((p) => ({ ...p, tglkkl: e.target.value }))} />
                  </Field>
                  <Field label="Kode Propinsi">
                    <input style={inputStyle} value={form.kdprop} onChange={(e) => setForm((p) => ({ ...p, kdprop: e.target.value }))} />
                  </Field>
                  <Field label="Nama Propinsi">
                    <input style={inputStyle} value={form.nmprop} onChange={(e) => setForm((p) => ({ ...p, nmprop: e.target.value }))} />
                  </Field>
                  <Field label="Kode Kabupaten/Kota">
                    <input style={inputStyle} value={form.kdkab} onChange={(e) => setForm((p) => ({ ...p, kdkab: e.target.value }))} />
                  </Field>
                  <Field label="Nama Kabupaten/Kota">
                    <input style={inputStyle} value={form.nmkab} onChange={(e) => setForm((p) => ({ ...p, nmkab: e.target.value }))} />
                  </Field>
                  <Field label="Kode Kecamatan">
                    <input style={inputStyle} value={form.kdkec} onChange={(e) => setForm((p) => ({ ...p, kdkec: e.target.value }))} />
                  </Field>
                  <Field label="Nama Kecamatan">
                    <input style={inputStyle} value={form.nmkec} onChange={(e) => setForm((p) => ({ ...p, nmkec: e.target.value }))} />
                  </Field>
                  <Field label="Suplesi">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 36 }}>
                      <input
                        type="checkbox"
                        checked={form.suplesi === '1'}
                        onChange={(e) => setForm((p) => ({ ...p, suplesi: e.target.checked ? '1' : '' }))}
                      />
                      SEP ini adalah SEP Suplesi
                    </label>
                  </Field>
                  <Field label="No. SEP Suplesi (wajib jika Suplesi dicentang)">
                    <input style={inputStyle} value={form.no_sep_suplesi} onChange={(e) => setForm((p) => ({ ...p, no_sep_suplesi: e.target.value }))} />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="Keterangan Kejadian">
                    <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.keterangankkl} onChange={(e) => setForm((p) => ({ ...p, keterangankkl: e.target.value }))} />
                  </Field>
                </div>
              </div>

              <Field label="Catatan">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.catatan} onChange={(e) => setForm((p) => ({ ...p, catatan: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingNoSep(null); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Menyimpan...' : editingNoSep ? 'Update ke BPJS' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Update Tanggal Pulang — pola default_card.md */}
      {pulangNoSep && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setPulangNoSep(null)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 480, width: '90%', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Update Tanggal Pulang — {pulangNoSep}</span>
              <button
                type="button"
                onClick={() => setPulangNoSep(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdatePulang} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Tgl Pulang *">
                <input required type="date" style={inputStyle} value={pulangForm.tgl_pulang} onChange={(e) => setPulangForm((p) => ({ ...p, tgl_pulang: e.target.value }))} />
              </Field>
              <Field label="Cara Pulang">
                <select style={inputStyle} value={pulangForm.cara_pulang} onChange={(e) => setPulangForm((p) => ({ ...p, cara_pulang: e.target.value }))}>
                  <option value="">- Lihat Referensi Cara Keluar -</option>
                  <option value="0">0 - Sembuh</option>
                  <option value="1">1 - Rujuk RS Lain</option>
                  <option value="2">2 - Atas Permintaan Sendiri</option>
                  <option value="4">4 - Meninggal</option>
                  <option value="5">5 - Lain-lain</option>
                </select>
              </Field>
              {pulangForm.cara_pulang === '4' && (
                <Field label="No. Surat Kematian * (min. 5 karakter)">
                  <input required style={inputStyle} value={pulangForm.no_surat_kematian} onChange={(e) => setPulangForm((p) => ({ ...p, no_surat_kematian: e.target.value }))} />
                </Field>
              )}
              <Field label="No. Laporan Polisi (wajib jika SEP KLL, min. 5 karakter)">
                <input style={inputStyle} value={pulangForm.no_laporan_polisi} onChange={(e) => setPulangForm((p) => ({ ...p, no_laporan_polisi: e.target.value }))} />
              </Field>
              <Field label="User Entry">
                <input style={inputStyle} value={pulangForm.user_entry} onChange={(e) => setPulangForm((p) => ({ ...p, user_entry: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setPulangNoSep(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingPulang}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingPulang ? '#9ca3af' : '#16a34a', color: '#fff', cursor: savingPulang ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {savingPulang ? 'Menyimpan...' : 'Update ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
