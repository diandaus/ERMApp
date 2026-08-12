import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';
import { ModalPengajuanSEP, type SepItem, formatTgl, getLoggedInUsername, requiresFingerprint } from '../components/ModalPengajuanSEP';

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

// SEP_COLUMNS — kolom tabel daftar SEP disamakan persis dengan tabMode di
// BPJSDataSEP.java (Khanza Desktop), supaya staf yang terbiasa dengan
// aplikasi desktop melihat susunan kolom yang sama di web ini. Didata-kan
// (bukan ditulis tangan di JSX) supaya thead & tbody selalu sinkron.
const SEP_COLUMNS: { label: string; render: (item: SepItem) => React.ReactNode }[] = [
  { label: 'No.SEP', render: (i) => i.no_sep },
  { label: 'No.Rawat', render: (i) => i.no_rawat },
  { label: 'No.RM', render: (i) => i.nomr },
  { label: 'Nama Pasien', render: (i) => i.nama_pasien },
  { label: 'Tgl.SEP', render: (i) => formatTgl(i.tglsep) },
  { label: 'Tgl.Rujukan', render: (i) => formatTgl(i.tglrujukan) },
  { label: 'No.Rujukan', render: (i) => i.no_rujukan || '-' },
  { label: 'Kode PPK Rujukan', render: (i) => i.kdppkrujukan || '-' },
  { label: 'Nama PPK Rujukan', render: (i) => i.nmppkrujukan || '-' },
  { label: 'Kode PPK Pelayanan', render: (i) => i.kdppkpelayanan || '-' },
  { label: 'Nama PPK Pelayanan', render: (i) => i.nmppkpelayanan || '-' },
  { label: 'Jenis', render: (i) => (i.jnspelayanan === '1' ? '1. Ranap' : i.jnspelayanan === '2' ? '2. Ralan' : i.jnspelayanan || '-') },
  { label: 'Catatan', render: (i) => i.catatan || '-' },
  { label: 'Kode Diagnosa', render: (i) => i.diagawal || '-' },
  { label: 'Nama Diagnosa', render: (i) => i.nmdiagnosaawal || '-' },
  { label: 'Kode Poli', render: (i) => i.kdpolitujuan || '-' },
  { label: 'Nama Poli', render: (i) => i.nmpolitujuan || '-' },
  { label: 'Kelas Rawat', render: (i) => i.klsrawat || '-' },
  { label: 'Naik Kelas', render: (i) => i.klsnaik || '-' },
  { label: 'Pembiayaan', render: (i) => i.pembiayaan || '-' },
  { label: 'P.J.Naik Kelas', render: (i) => i.pjnaikkelas || '-' },
  { label: 'Laka Lantas', render: (i) => i.lakalantas || '-' },
  { label: 'User Input', render: (i) => i.user_entry || '-' },
  { label: 'Tgl.Lahir', render: (i) => formatTgl(i.tanggal_lahir) },
  { label: 'Peserta', render: (i) => i.peserta || '-' },
  { label: 'J.K', render: (i) => i.jkel || '-' },
  { label: 'No.Kartu', render: (i) => i.no_kartu || '-' },
  { label: 'Tanggal Pulang', render: (i) => formatTgl(i.tglpulang) },
  { label: 'Asal Rujukan', render: (i) => i.asal_rujukan || '-' },
  { label: 'Eksekutif', render: (i) => i.eksekutif || '-' },
  { label: 'COB', render: (i) => i.cob || '-' },
  { label: 'No.Telp', render: (i) => i.notelep || '-' },
  { label: 'Katarak', render: (i) => i.katarak || '-' },
  { label: 'Tanggal KKL', render: (i) => formatTgl(i.tglkkl) },
  { label: 'Keterangan KKL', render: (i) => i.keterangankkl || '-' },
  { label: 'Suplesi', render: (i) => i.suplesi || '-' },
  { label: 'No.SEP Suplesi', render: (i) => i.no_sep_suplesi || '-' },
  { label: 'Kd Prop', render: (i) => i.kdprop || '-' },
  { label: 'Propinsi', render: (i) => i.nmprop || '-' },
  { label: 'Kd Kab', render: (i) => i.kdkab || '-' },
  { label: 'Kabupaten', render: (i) => i.nmkab || '-' },
  { label: 'Kd Kec', render: (i) => i.kdkec || '-' },
  { label: 'Kecamatan', render: (i) => i.nmkec || '-' },
  { label: 'No.SKDP', render: (i) => i.noskdp || '-' },
  { label: 'Kd DPJP', render: (i) => i.kddpjp || '-' },
  { label: 'DPJP', render: (i) => i.nmdpdjp || '-' },
  { label: 'Tujuan Kunjungan', render: (i) => i.tujuankunjungan || '-' },
  { label: 'Flag Prosedur', render: (i) => i.flagprosedur || '-' },
  { label: 'Penunjang', render: (i) => i.penunjang || '-' },
  { label: 'Asesmen Pelayanan', render: (i) => i.asesmenpelayanan || '-' },
  { label: 'Kd DPJP Layan', render: (i) => i.kddpjplayanan || '-' },
  { label: 'DPJP Layanan', render: (i) => i.nmdpjplayanan || '-' },
];

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
  const [editingItem, setEditingItem] = React.useState<SepItem | null>(null);
  const [sendingNoSep, setSendingNoSep] = React.useState<string | null>(null);
  const [deletingNoSep, setDeletingNoSep] = React.useState<string | null>(null);
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
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (item: SepItem) => {
    setEditingItem(item);
    setShowModal(true);
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
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terkirim!', text: data.no_sep ? `No. SEP: ${data.no_sep}` : data.message || 'SEP berhasil dikirim ke BPJS' });
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
      const url = `/api/bridging/sep/${encodeURIComponent(noSep)}?user=${encodeURIComponent(getLoggedInUsername())}`;
      const res = await fetch(url, { method: 'DELETE' });
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

  // Tab "Data SEP Internal" — bagian 10 VClaim (SEP internal antar
  // instalasi/RS), tabel bridging_sep_internal, kolomnya identik dengan
  // "Data SEP" (tabModeInternal di BPJSDataSEP.java sama persis dengan
  // tabMode). Dimuat lewat endpoint terpisah, hanya sekali saat tab
  // pertama kali dibuka.
  const [sepTab, setSepTab] = React.useState<'sep' | 'internal'>('sep');
  const [internalItems, setInternalItems] = React.useState<SepItem[]>([]);
  const [internalLoading, setInternalLoading] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string | null>(null);
  const [deletingInternalNoSep, setDeletingInternalNoSep] = React.useState<string | null>(null);

  const fetchInternalItems = React.useCallback(async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      let url = `/api/bridging/sep-internal/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data SEP Internal');
      const data = await res.json();
      setInternalItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setInternalItems([]);
    } finally {
      setInternalLoading(false);
    }
  }, [tglDari, tglSampai, searchText]);

  React.useEffect(() => {
    if (sepTab === 'internal') {
      fetchInternalItems();
    }
  }, [sepTab, fetchInternalItems]);

  const handleHapusInternal = async (noSep: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus SEP Internal?',
      text: `No. SEP: ${noSep} akan dihapus dari BPJS dan data lokal`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingInternalNoSep(noSep);
    try {
      const url = `/api/bridging/sep-internal/${encodeURIComponent(noSep)}?user=${encodeURIComponent(getLoggedInUsername())}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus SEP Internal');
      await fetchInternalItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'SEP Internal berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingInternalNoSep(null);
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
      {/* Tab switch — "Data SEP" / "Data SEP Internal" (bagian 10 VClaim,
          tabel bridging_sep_internal, kolomnya sama persis dengan Data SEP,
          lihat tabMode/tabModeInternal di BPJSDataSEP.java) */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
        {(['sep', 'internal'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSepTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: sepTab === tab ? '#ffffff' : 'transparent',
              color: sepTab === tab ? '#111827' : '#6b7280',
              fontWeight: sepTab === tab ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: sepTab === tab ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'sep' ? 'Data SEP' : 'Data SEP Internal'}
          </button>
        ))}
      </div>

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
        {sepTab === 'sep' && (
          <button
            type="button"
            onClick={openInputModal}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            + Input SEP
          </button>
        )}
      </div>

      {(sepTab === 'sep' ? error : internalError) && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {sepTab === 'sep' ? error : internalError}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {SEP_COLUMNS.map((col) => (
                <th key={col.label} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 400 }}>{col.label}</th>
              ))}
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', position: 'sticky', right: 0, background: '#f3f4f6', fontWeight: 400 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sepTab === 'sep' ? (
              loading ? (
                <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data SEP</td></tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.no_sep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    {SEP_COLUMNS.map((col) => (
                      <td key={col.label} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                        {col.render(item)}
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', right: 0, background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
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
              )
            ) : internalLoading ? (
              <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : internalItems.length === 0 ? (
              <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data SEP Internal</td></tr>
            ) : (
              internalItems.map((item, index) => (
                <tr key={item.no_sep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  {SEP_COLUMNS.map((col) => (
                    <td key={col.label} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                      {col.render(item)}
                    </td>
                  ))}
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', right: 0, background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <button
                      type="button"
                      onClick={() => handleHapusInternal(item.no_sep)}
                      disabled={deletingInternalNoSep === item.no_sep}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #dc2626',
                        background: '#ffffff',
                        color: '#dc2626',
                        cursor: deletingInternalNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {deletingInternalNoSep === item.no_sep ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ModalPengajuanSEP
          editingItem={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSaved={fetchItems}
        />
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
