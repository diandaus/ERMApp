import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Permintaan Obat & BHP (tab utama modul Apotek). Cocok dengan
// dialog Khanza Desktop inventory/DlgPermintaan.java (form buat permintaan
// baru, satu-satunya yang punya tombol Simpan) + inventory/
// DlgCariPermintaan.java (daftar + klik-kanan Setujui/Tolak/Hapus). Dua
// sub-tab di sini meniru pemisahan itu: "Buat Permintaan" dan "Daftar
// Permintaan" (approve via Mutasi / tolak / hapus). Lihat
// backend/apotek_permintaan_handler.go untuk alur bisnis lengkap & kenapa
// field "Dari"/"Ke" Mutasi TERTUKAR dari sudut pandang form permintaan.
// ============================================================================

const pillSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 32px 7px 14px',
  borderRadius: 4,
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
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
}> = ({ value, onChange, options }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
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

const todayStr = () => localDateStr();
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

type KvOpsi = { kode: string; nama: string };

// ---- Tab: Buat Permintaan -------------------------------------------------

type BarangOpsi = { kode_brng: string; nama_brng: string; kode_sat: string; satuan: string };
type PermintaanRow = BarangOpsi & { jumlah: string; keterangan: string };

const TabBuatPermintaan: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [kdBangsalTujuan, setKdBangsalTujuan] = React.useState('');
  const [nip, setNip] = React.useState('');
  const [pegawai, setPegawai] = React.useState<KvOpsi[]>([]);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<PermintaanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnAsal, setWarnAsal] = React.useState(false);
  const [warnTujuan, setWarnTujuan] = React.useState(false);
  const [warnNip, setWarnNip] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/apotek/permintaan/pegawai-opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPegawai(Array.isArray(data) ? data.map((p: any) => ({ kode: p.nik, nama: p.nama })) : []))
      .catch(() => {});
  }, []);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/apotek/permintaan/barang-opsi${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows((prev) => {
        const prevMap = new Map(prev.map((r) => [r.kode_brng, { jumlah: r.jumlah, keterangan: r.keterangan }]));
        return Array.isArray(data)
          ? data.map((it) => ({ ...it, jumlah: prevMap.get(it.kode_brng)?.jumlah || '', keterangan: prevMap.get(it.kode_brng)?.keterangan || '' }))
          : [];
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  const isFirstSearch = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      fetchItems();
      return;
    }
    const t = setTimeout(() => fetchItems(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const setField = (kodeBrng: string, field: 'jumlah' | 'keterangan', value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kdBangsal || !kdBangsalTujuan || !nip) {
      e.target.blur();
      setWarnAsal(!kdBangsal);
      setWarnTujuan(!kdBangsalTujuan);
      setWarnNip(!nip);
      setTimeout(() => {
        setWarnAsal(false);
        setWarnTujuan(false);
        setWarnNip(false);
      }, 1500);
    }
  };

  const filledCount = rows.filter((r) => r.jumlah.trim() !== '' && Number(r.jumlah) > 0).length;

  const handleBersihkan = () => {
    setRows((prev) => prev.map((r) => ({ ...r, jumlah: '', keterangan: '' })));
  };

  const handleSimpan = async () => {
    if (!kdBangsal) {
      Swal.fire({ icon: 'warning', title: 'Pilih Asal Permintaan dulu' });
      return;
    }
    if (!kdBangsalTujuan) {
      Swal.fire({ icon: 'warning', title: 'Pilih Ditujukan Ke dulu' });
      return;
    }
    if (kdBangsal === kdBangsalTujuan) {
      Swal.fire({ icon: 'warning', title: 'Asal Permintaan dan Ditujukan Ke harus berbeda' });
      return;
    }
    if (!nip) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas dulu' });
      return;
    }
    const items = rows
      .filter((r) => r.jumlah.trim() !== '' && Number(r.jumlah) > 0)
      .map((r) => ({ kode_brng: r.kode_brng, kode_sat: r.kode_sat, jumlah: Number(r.jumlah), keterangan: r.keterangan }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah permintaannya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Permintaan untuk ${items.length} Barang?`,
      text: 'Permintaan akan dikirim ke lokasi tujuan untuk ditinjau dan disetujui.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/permintaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_bangsal: kdBangsal, kd_bangsal_tujuan: kdBangsalTujuan, nip, tanggal, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkan();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Permintaan: ${data.no_permintaan}`, timer: 3500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldPermintaan {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-permintaan { animation: blinkRedFieldPermintaan 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 130, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Asal Permintaan
            {warnAsal && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnAsal ? 'blink-red-field-permintaan' : ''}>
            <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 130, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Ditujukan Ke
            {warnTujuan && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnTujuan ? 'blink-red-field-permintaan' : ''}>
            <PillSelect value={kdBangsalTujuan} onChange={setKdBangsalTujuan} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 130, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Petugas
            {warnNip && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnNip ? 'blink-red-field-permintaan' : ''}>
            <PillSelect value={nip} onChange={setNip} options={[{ value: '', label: '- Pilih -' }, ...pegawai.map((p) => ({ value: p.kode, label: p.nama }))]} />
          </div>
        </div>
        <div style={{ width: 118, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 160, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <div style={{ position: 'relative', display: 'flex' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              type="text"
              placeholder="Kode / Nama Barang..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchItems(); }}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleBersihkan}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Bersihkan Jumlah
        </button>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Permintaan'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-start', flexShrink: 0, whiteSpace: 'nowrap' }}>{filledCount} siap diminta</span>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 70 }}>Jumlah</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada barang aktif</td></tr>
            ) : (
              rows.map((r, index) => (
                <tr key={r.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="any"
                      value={r.jumlah}
                      onChange={(e) => setField(r.kode_brng, 'jumlah', e.target.value)}
                      onFocus={guardFocus}
                      style={{ width: 70, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <input
                      type="text"
                      value={r.keterangan}
                      onChange={(e) => setField(r.kode_brng, 'keterangan', e.target.value)}
                      placeholder="opsional"
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
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

// ---- Tab: Daftar Permintaan -------------------------------------------------

type PermintaanDetailItem = { kode_brng: string; nama_brng: string; satuan: string; jumlah: number; keterangan: string };
type PermintaanRiwayat = {
  no_permintaan: string;
  tanggal: string;
  kd_bangsal: string;
  nm_bangsal: string;
  nip: string;
  nm_pegawai: string;
  status: string;
  kd_bangsal_tujuan: string;
  nm_bangsal_tujuan: string;
  items: PermintaanDetailItem[];
};

type MutasiLookupItem = { kode_brng: string; h_beli: number; stok_asal: number };
type ApproveRow = PermintaanDetailItem & { jml: string; h_beli: number; stok_asal: number };

const statusColor = (status: string) => {
  if (status === 'Disetujui') return { bg: '#ecfdf5', fg: '#059669' };
  if (status === 'Tidak Disetujui') return { bg: '#fef2f2', fg: '#dc2626' };
  return { bg: '#fffbeb', fg: '#d97706' };
};

const TabDaftarPermintaan: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<PermintaanRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const [approveTarget, setApproveTarget] = React.useState<PermintaanRiwayat | null>(null);
  const [approveRows, setApproveRows] = React.useState<ApproveRow[]>([]);
  const [approveKeterangan, setApproveKeterangan] = React.useState('');
  const [approveTanggal, setApproveTanggal] = React.useState(todayStr());
  const [approveLoading, setApproveLoading] = React.useState(false);
  const [approveSaving, setApproveSaving] = React.useState(false);

  const fetchRiwayat = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/permintaan/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdBangsal) url += `&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (status) url += `&status=${encodeURIComponent(status)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, kdBangsal, status, searchText]);

  React.useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  const handleTolak = async (item: PermintaanRiwayat) => {
    const confirm = await Swal.fire({
      title: `Tolak Permintaan ${item.no_permintaan}?`,
      text: 'Status akan diubah menjadi Tidak Disetujui. Tidak ada efek pada stok.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/permintaan/${encodeURIComponent(item.no_permintaan)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Tidak Disetujui' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menolak');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Permintaan ditolak', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const handleHapus = async (item: PermintaanRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Permintaan ${item.no_permintaan}?`,
      text: 'Data permintaan dan detail barangnya akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/permintaan/${encodeURIComponent(item.no_permintaan)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const openApprove = async (item: PermintaanRiwayat) => {
    setApproveTarget(item);
    setApproveKeterangan('');
    setApproveTanggal(todayStr());
    setApproveLoading(true);
    try {
      const url = `/api/apotek/mutasi/items?kd_bangsal_dari=${encodeURIComponent(item.kd_bangsal_tujuan)}&kd_bangsal_ke=${encodeURIComponent(item.kd_bangsal)}`;
      const res = await fetch(url);
      const data: MutasiLookupItem[] = await res.json();
      const lookup = new Map((Array.isArray(data) ? data : []).map((d) => [d.kode_brng, d]));
      setApproveRows(
        item.items.map((it) => {
          const found = lookup.get(it.kode_brng);
          return { ...it, jml: String(it.jumlah), h_beli: found?.h_beli || 0, stok_asal: found?.stok_asal || 0 };
        })
      );
    } catch {
      setApproveRows(item.items.map((it) => ({ ...it, jml: String(it.jumlah), h_beli: 0, stok_asal: 0 })));
    } finally {
      setApproveLoading(false);
    }
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveRows([]);
  };

  const setApproveJml = (kodeBrng: string, value: string) => {
    setApproveRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jml: value } : r)));
  };

  const submitApprove = async () => {
    if (!approveTarget) return;
    if (!approveKeterangan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Keterangan wajib diisi' });
      return;
    }
    const payloadItems = approveRows
      .filter((r) => r.jml.trim() !== '' && Number(r.jml) > 0)
      .map((r) => ({ kode_brng: r.kode_brng, h_beli: r.h_beli, jml: Number(r.jml) }));
    if (payloadItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlahnya' });
      return;
    }
    const confirm = await Swal.fire({
      title: `Setujui Permintaan ${approveTarget.no_permintaan}?`,
      text: `Stok akan dipindahkan dari ${approveTarget.nm_bangsal_tujuan} ke ${approveTarget.nm_bangsal}. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Setujui & Proses',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setApproveSaving(true);
    try {
      const res = await fetch(`/api/apotek/permintaan/${encodeURIComponent(approveTarget.no_permintaan)}/setujui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: approveTanggal, keterangan: approveKeterangan, petugas: getCurrentPetugas(), items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui');
      closeApprove();
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Permintaan disetujui!', text: data.message, timer: 3000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setApproveSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi (Asal/Tujuan)</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <PillSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Baru', label: 'Baru' },
              { value: 'Disetujui', label: 'Disetujui' },
              { value: 'Tidak Disetujui', label: 'Tidak Disetujui' },
            ]}
          />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="No. Permintaan / lokasi / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Permintaan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Asal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ditujukan Ke</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada permintaan pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => {
                const sc = statusColor(item.status);
                const isOpen = expanded === item.no_permintaan;
                return (
                  <React.Fragment key={item.no_permintaan}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.no_permintaan)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_permintaan}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal_tujuan}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_pegawai}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.fg }}>{item.status}</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        {item.status === 'Baru' ? (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button type="button" onClick={() => openApprove(item)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              Setujui (Mutasi)
                            </button>
                            <button type="button" onClick={() => handleTolak(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              Tolak
                            </button>
                            <button type="button" onClick={() => handleHapus(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              Hapus
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => handleHapus(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                            <thead>
                              <tr style={{ color: '#6b7280' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Barang</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Keterangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it) => (
                                <tr key={it.kode_brng}>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jumlah}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.satuan}</td>
                                  <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.keterangan || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {approveTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: 640, maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Setujui {approveTarget.no_permintaan} (Mutasi)</h3>
              <button type="button" onClick={closeApprove} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Mutasi stok dari <strong>{approveTarget.nm_bangsal_tujuan}</strong> ke <strong>{approveTarget.nm_bangsal}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 140 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal Mutasi</label>
                <input type="date" style={inputStyle} value={approveTanggal} onChange={(e) => setApproveTanggal(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Keterangan</label>
                <input style={inputStyle} value={approveKeterangan} onChange={(e) => setApproveKeterangan(e.target.value)} placeholder={`Memenuhi permintaan ${approveTarget.no_permintaan}`} />
              </div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', maxHeight: 300 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f3f4f6', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: 6, textAlign: 'left' }}>Barang</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Diminta</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Stok Asal</th>
                    <th style={{ padding: 6, textAlign: 'right', width: 80 }}>Jml Disetujui</th>
                  </tr>
                </thead>
                <tbody>
                  {approveLoading ? (
                    <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>Memuat stok...</td></tr>
                  ) : (
                    approveRows.map((r) => (
                      <tr key={r.kode_brng}>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f3f4f6' }}>{r.nama_brng} <span style={{ color: '#9ca3af' }}>({r.satuan})</span></td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{r.jumlah}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: r.stok_asal < Number(r.jml || 0) ? '#dc2626' : '#374151' }}>{r.stok_asal}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={r.jml}
                            onChange={(e) => setApproveJml(r.kode_brng, e.target.value)}
                            style={{ width: 70, padding: '4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={closeApprove} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Batal
              </button>
              <button
                type="button"
                onClick={submitApprove}
                disabled={approveSaving || approveLoading}
                style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: approveSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                {approveSaving ? 'Memproses...' : 'Setujui & Proses Mutasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Shell Permintaan (gabung 2 sub-tab di atas) --------------------------

export const ApotekPermintaanView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'buat' | 'daftar'>('buat');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'buat', label: 'Buat Permintaan' },
    { key: 'daftar', label: 'Daftar Permintaan' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
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
      {subTab === 'buat' && <TabBuatPermintaan bangsal={bangsal} />}
      {subTab === 'daftar' && <TabDaftarPermintaan bangsal={bangsal} />}
    </div>
  );
};
