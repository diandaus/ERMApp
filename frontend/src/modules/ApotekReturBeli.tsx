import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';
import { localDateStr } from '../utils/date';
import { ModalCariPetugas } from '../components/ModalCariPetugas';

// ============================================================================
// APOTEK — Retur ke Suplier (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgReturBeli.java — kebalikan dari Penerimaan:
// barang yang sudah diterima dari suplier dikembalikan (rusak/kadaluwarsa/
// salah kirim), MENGURANGI stok. Dua sub-tab meniru pemisahan form Simpan
// vs daftar riwayat, sama pola dengan ApotekPenerimaan.tsx. Lihat
// backend/apotek_retur_beli_handler.go untuk rumus & penyederhanaan.
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

const formatRupiah = (v: number) => (v || 0).toLocaleString('id-ID');
const todayStr = () => localDateStr();
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

type KvOpsi = { kode: string; nama: string };

// ---- Tab: Buat Retur --------------------------------------------------------

type BarangOpsi = { no_faktur: string; kode_brng: string; nama_brng: string; kode_sat: string; satuan: string; h_beli: number; jml_beli: number; stok: number };
type ReturRow = BarangOpsi & { jml_retur: string; h_retur: string };

const TabBuatRetur: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [kodeSuplier, setKodeSuplier] = React.useState('');
  const [suplier, setSuplier] = React.useState<KvOpsi[]>([]);
  const [selectedPetugas, setSelectedPetugas] = React.useState<{ nip: string; nama: string } | null>(null);
  const [showCariPetugas, setShowCariPetugas] = React.useState(false);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<ReturRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnSuplier, setWarnSuplier] = React.useState(false);
  const [warnPetugas, setWarnPetugas] = React.useState(false);
  const [warnBangsal, setWarnBangsal] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/apotek/suplier')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuplier(Array.isArray(data) ? data.map((s: any) => ({ kode: s.kode_suplier, nama: s.nama_suplier })) : []))
      .catch(() => {});

    // Petugas — auto-isi dari NIP yang di-link ke akun login (tetap bisa
    // diganti manual lewat ModalCariPetugas).
    const nipLogin = getCurrentUserNip();
    if (nipLogin) setSelectedPetugas((prev) => prev || { nip: nipLogin, nama: getCurrentPetugas() || nipLogin });
  }, []);

  const fetchItems = React.useCallback(async () => {
    if (!kodeSuplier || !kdBangsal) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/apotek/retur-beli/barang-opsi?kode_suplier=${encodeURIComponent(kodeSuplier)}&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows((prev) => {
        const prevMap = new Map(prev.map((r) => [`${r.no_faktur}-${r.kode_brng}`, r]));
        return Array.isArray(data)
          ? data.map((it: BarangOpsi) => {
              const old = prevMap.get(`${it.no_faktur}-${it.kode_brng}`);
              return {
                ...it,
                jml_retur: old?.jml_retur || '',
                h_retur: old?.h_retur || String(it.h_beli || ''),
              };
            })
          : [];
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kodeSuplier, kdBangsal, searchText]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchItems(), 300);
    return () => clearTimeout(t);
  }, [fetchItems]);

  const setField = (key: string, field: 'jml_retur' | 'h_retur', value: string) => {
    setRows((prev) => prev.map((r) => (`${r.no_faktur}-${r.kode_brng}` === key ? { ...r, [field]: value } : r)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kodeSuplier || !selectedPetugas || !kdBangsal) {
      e.target.blur();
      setWarnSuplier(!kodeSuplier);
      setWarnPetugas(!selectedPetugas);
      setWarnBangsal(!kdBangsal);
      setTimeout(() => {
        setWarnSuplier(false);
        setWarnPetugas(false);
        setWarnBangsal(false);
      }, 1500);
    }
  };

  const hitung = (r: ReturRow) => {
    if (r.jml_retur.trim() === '') return null;
    const jml = Number(r.jml_retur);
    const harga = Number(r.h_retur || 0);
    return { total: jml * harga };
  };

  const filledRows = rows.filter((r) => r.jml_retur.trim() !== '' && Number(r.jml_retur) > 0);
  const totalRetur = filledRows.reduce((acc, r) => {
    const c = hitung(r);
    return acc + (c ? c.total : 0);
  }, 0);

  const handleBersihkan = () => {
    setRows((prev) => prev.map((r) => ({ ...r, jml_retur: '' })));
  };

  const handleSimpan = async () => {
    if (!kodeSuplier) {
      Swal.fire({ icon: 'warning', title: 'Pilih Supplier dulu' });
      return;
    }
    if (!selectedPetugas) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas dulu' });
      return;
    }
    if (!kdBangsal) {
      Swal.fire({ icon: 'warning', title: 'Pilih Lokasi dulu' });
      return;
    }
    const overStok = filledRows.find((r) => Number(r.jml_retur) > r.stok);
    if (overStok) {
      Swal.fire({ icon: 'warning', title: `Jumlah retur ${overStok.nama_brng} melebihi stok saat ini (${overStok.stok})` });
      return;
    }
    const items = filledRows.map((r) => ({
      no_faktur: r.no_faktur,
      kode_brng: r.kode_brng,
      kode_sat: r.kode_sat,
      h_beli: r.h_beli,
      jml_beli: r.jml_beli,
      h_retur: Number(r.h_retur || 0),
      jml_retur: Number(r.jml_retur),
    }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah retur-nya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Retur untuk ${items.length} Barang?`,
      text: `Stok akan langsung berkurang di lokasi ini. Total nilai retur: Rp ${formatRupiah(totalRetur)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/retur-beli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_suplier: kodeSuplier, nip: selectedPetugas.nip, tanggal, kd_bangsal: kdBangsal, petugas: getCurrentPetugas(), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkan();
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Retur: ${data.no_retur_beli}`, timer: 3500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldReturBeli {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-retur-beli { animation: blinkRedFieldReturBeli 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 150, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Supplier
            {warnSuplier && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnSuplier ? 'blink-red-field-retur-beli' : ''}>
            <PillSelect value={kodeSuplier} onChange={setKodeSuplier} options={[{ value: '', label: '- Pilih -' }, ...suplier.map((s) => ({ value: s.kode, label: s.nama }))]} />
          </div>
        </div>
        <div style={{ width: 120, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Petugas
            {warnPetugas && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnPetugas ? 'blink-red-field-retur-beli' : ''}>
            {selectedPetugas ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 0,
                border: '1px solid #1AB1E5', background: '#f0f9ff', borderRadius: 4,
                padding: '7px 8px', fontSize: 12,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${selectedPetugas.nip} - ${selectedPetugas.nama}`}>
                  {selectedPetugas.nama}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCariPetugas(true)}
                  style={{ flexShrink: 0, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10.5, fontWeight: 500 }}
                >Ganti</button>
              </div>
            ) : (
              <div
                onClick={() => setShowCariPetugas(true)}
                style={{
                  width: '100%', padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: 4,
                  fontSize: 12, boxSizing: 'border-box', cursor: 'pointer', color: '#9ca3af', background: '#ffffff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                - Pilih -
              </div>
            )}
          </div>
        </div>
        <div style={{ width: 105, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Lokasi
            {warnBangsal && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnBangsal ? 'blink-red-field-retur-beli' : ''}>
            <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 105, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 160, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <div style={{ position: 'relative', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              type="text"
              placeholder="Kode / Nama / No.Faktur..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchItems(); }}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
        </div>
        <button type="button" onClick={handleBersihkan} style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Bersihkan
        </button>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Retur'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-start', flexShrink: 0, whiteSpace: 'nowrap' }}>{filledRows.length} barang</span>
        {totalRetur > 0 && (
          <span style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
            Nilai Retur: <strong>Rp {formatRupiah(totalRetur)}</strong>
          </span>
        )}
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Jml Retur</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Faktur</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Saat Ini</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 100 }}>Harga Retur</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !kodeSuplier || !kdBangsal ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih Supplier dan Lokasi untuk melihat barang yang bisa diretur</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada riwayat pembelian dari supplier ini di lokasi tsb</td></tr>
            ) : (
              rows.map((r) => {
                const key = `${r.no_faktur}-${r.kode_brng}`;
                const c = hitung(r);
                const over = r.jml_retur.trim() !== '' && Number(r.jml_retur) > r.stok;
                return (
                  <tr key={key} style={{ background: over ? '#fef2f2' : '#ffffff' }}>
                    <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.jml_retur}
                        onChange={(e) => setField(key, 'jml_retur', e.target.value)}
                        onFocus={guardFocus}
                        style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: over ? '1px solid #dc2626' : '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{r.no_faktur}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{r.stok}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.h_retur}
                        onChange={(e) => setField(key, 'h_retur', e.target.value)}
                        style={{ width: 90, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{c ? formatRupiah(c.total) : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ModalCariPetugas
        isOpen={showCariPetugas}
        onClose={() => setShowCariPetugas(false)}
        onSelect={(nip, nama) => setSelectedPetugas({ nip, nama })}
      />
    </div>
  );
};

// ---- Tab: Riwayat Retur -----------------------------------------------------

type ReturDetailItem = {
  no_faktur: string;
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  h_beli: number;
  jml_beli: number;
  h_retur: number;
  jml_retur: number;
  total: number;
};
type ReturBeliRiwayat = {
  no_retur_beli: string;
  tanggal: string;
  kode_suplier: string;
  nama_suplier: string;
  nip: string;
  nama_petugas: string;
  kd_bangsal: string;
  nm_bangsal: string;
  total: number;
  items: ReturDetailItem[];
};

const TabRiwayatRetur: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<ReturBeliRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const fetchRiwayat = React.useCallback(async () => {
    if (!tgl1 || !tgl2) return;
    setLoading(true);
    setHasSearched(true);
    try {
      let url = `/api/apotek/retur-beli/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdBangsal) url += `&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, kdBangsal]);

  const displayedItems = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.no_retur_beli, item.nama_suplier, item.nama_petugas].some((field) => (field || '').toLowerCase().includes(q))
    );
  }, [items, searchText]);

  const handleHapus = async (item: ReturBeliRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Retur ${item.no_retur_beli}?`,
      text: `Stok sistem AKAN dikembalikan (ditambah) di ${item.nm_bangsal} untuk semua barang di retur ini. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/retur-beli/${encodeURIComponent(item.no_retur_beli)}?petugas=${encodeURIComponent(getCurrentPetugas())}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus, stok dikembalikan', timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
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
        <div style={{ width: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari (di hasil yang sudah dimuat)</label>
          <input style={inputStyle} placeholder="No. Retur / supplier / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={fetchRiwayat}
          disabled={loading || !tgl1 || !tgl2}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            border: 'none',
            background: loading || !tgl1 || !tgl2 ? '#9ca3af' : '#059669',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !tgl1 || !tgl2 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Retur</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Supplier</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Nilai Retur</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih rentang tanggal lalu klik "Cari" untuk menampilkan riwayat</td></tr>
            ) : displayedItems.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada retur pada rentang ini</td></tr>
            ) : (
              displayedItems.map((item, index) => {
                const isOpen = expanded === item.no_retur_beli;
                return (
                  <React.Fragment key={item.no_retur_beli}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.no_retur_beli)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_retur_beli}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_suplier}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_petugas}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>Rp {formatRupiah(item.total)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleHapus(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 8 }}>
                            <thead>
                              <tr style={{ color: '#6b7280' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Barang</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>No. Faktur Asal</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jml Retur</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Harga Retur</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it, idx) => (
                                <tr key={`${it.no_faktur}-${it.kode_brng}-${idx}`}>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.no_faktur}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml_retur}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.satuan}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_retur)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11.5, color: '#6b7280' }}>
                            <span style={{ fontWeight: 600, color: '#111827' }}>Total Nilai Retur: Rp {formatRupiah(item.total)}</span>
                          </div>
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
    </div>
  );
};

// ---- Shell Retur ke Suplier (gabung 2 sub-tab di atas) ---------------------

export const ApotekReturBeliView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'buat' | 'riwayat'>('buat');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'buat', label: 'Buat Retur' },
    { key: 'riwayat', label: 'Riwayat Retur' },
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
      {subTab === 'buat' && <TabBuatRetur bangsal={bangsal} />}
      {subTab === 'riwayat' && <TabRiwayatRetur bangsal={bangsal} />}
    </div>
  );
};
