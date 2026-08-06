import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';
import { localDateStr } from '../utils/date';
import { ModalCariPetugas } from '../components/ModalCariPetugas';

// ============================================================================
// APOTEK — Penerimaan Obat & BHP (tab utama modul Apotek). Cocok dengan
// dialog Khanza Desktop inventory/DlgPembelian.java (form transaksi
// pembelian/penerimaan dari supplier, satu-satunya yang punya tombol
// Simpan) + inventory/DlgCariPembelian.java (daftar riwayat + Hapus). Dua
// sub-tab di sini meniru pemisahan itu: "Terima Barang" dan "Riwayat
// Penerimaan". Lihat backend/apotek_penerimaan_handler.go untuk rumus
// lengkap & penyederhanaan yang disengaja (tanpa Jurnal/akuntansi, tanpa
// konversi satuan besar/kecil, tanpa batch).
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

// ---- Tab: Terima Barang ----------------------------------------------------

type BarangOpsi = { kode_brng: string; nama_brng: string; kode_sat: string; satuan: string; h_beli: number };
type PenerimaanRow = BarangOpsi & { jumlah: string; harga: string; dis: string; kadaluwarsa: string };

const TabTerimaBarang: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [kodeSuplier, setKodeSuplier] = React.useState('');
  const [suplier, setSuplier] = React.useState<KvOpsi[]>([]);
  const [selectedPetugas, setSelectedPetugas] = React.useState<{ nip: string; nama: string } | null>(null);
  const [showCariPetugas, setShowCariPetugas] = React.useState(false);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [ppnPercent, setPpnPercent] = React.useState('11');
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<PenerimaanRow[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<PenerimaanRow[]>([]);
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
    setLoading(true);
    try {
      const url = `/api/apotek/penerimaan/barang-opsi${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map((it) => ({ ...it, jumlah: '', harga: String(it.h_beli || ''), dis: '', kadaluwarsa: '' })) : []);
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

  // Barang yang sudah diisi jumlahnya "pindah" jadi baris fixed di paling
  // atas tabel (selectedRows) — tetap terlihat & bisa diedit walau user
  // lanjut mencari barang lain, tidak lagi hilang (beserta jumlahnya)
  // begitu keluar dari hasil pencarian saat ini. Pola sama persis dengan
  // ApotekPenjualan.tsx/ApotekMutasi.tsx.
  const upsertSelected = (item: PenerimaanRow) => {
    setSelectedRows((prev) => {
      const jumlahNum = Number(item.jumlah);
      const isValid = item.jumlah.trim() !== '' && !isNaN(jumlahNum) && jumlahNum > 0;
      const idx = prev.findIndex((r) => r.kode_brng === item.kode_brng);
      if (!isValid) {
        return idx >= 0 ? prev.filter((r) => r.kode_brng !== item.kode_brng) : prev;
      }
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [...prev, item];
    });
  };

  // setField cuma update tampilan lokal saat mengetik di tabel pencarian —
  // upsertSelected BARU dipanggil saat blur (commitField), sama pola
  // dengan ApotekPenjualan.tsx (cegah bug "ketik 10 cuma kesimpen 1").
  const setField = (kodeBrng: string, field: 'jumlah' | 'harga' | 'dis' | 'kadaluwarsa', value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitField = (kodeBrng: string) => {
    const item = rows.find((r) => r.kode_brng === kodeBrng);
    if (!item) return;
    upsertSelected(item);
    if (item.jumlah.trim() !== '' && Number(item.jumlah) > 0) {
      setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jumlah: '', dis: '', kadaluwarsa: '' } : r)));
    }
  };

  // setPinnedField/commitPinnedField — sama pola dgn setField/commitField
  // di atas, tapi utk baris yang sudah pinned di selectedRows.
  const setPinnedField = (kodeBrng: string, field: 'jumlah' | 'harga' | 'dis' | 'kadaluwarsa', value: string) => {
    setSelectedRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitPinnedField = (kodeBrng: string) => {
    setSelectedRows((prev) => prev.filter((r) => r.kode_brng !== kodeBrng || (r.jumlah.trim() !== '' && Number(r.jumlah) > 0)));
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

  const hitung = (r: PenerimaanRow) => {
    if (r.jumlah.trim() === '') return null;
    const jumlah = Number(r.jumlah);
    const harga = Number(r.harga || 0);
    const dis = Number(r.dis || 0);
    const subtotal = jumlah * harga;
    const besardis = subtotal * (dis / 100);
    const total = subtotal - besardis;
    return { subtotal, besardis, total };
  };

  const visibleSearchRows = rows.filter((r) => !selectedRows.some((s) => s.kode_brng === r.kode_brng));
  const filledRows = selectedRows;
  const totals = filledRows.reduce(
    (acc, r) => {
      const c = hitung(r);
      if (c) {
        acc.subtotal += c.subtotal;
        acc.besardis += c.besardis;
      }
      return acc;
    },
    { subtotal: 0, besardis: 0 }
  );
  const total2 = totals.subtotal - totals.besardis;
  const ppnAmount = (Number(ppnPercent || 0) / 100) * total2;
  const tagihan = total2 + ppnAmount;

  const handleBersihkan = () => {
    setSelectedRows([]);
    setRows((prev) => prev.map((r) => ({ ...r, jumlah: '', dis: '', kadaluwarsa: '' })));
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
    const items = filledRows.map((r) => ({
      kode_brng: r.kode_brng,
      kode_sat: r.kode_sat,
      jumlah: Number(r.jumlah),
      h_beli: Number(r.harga || 0),
      dis: Number(r.dis || 0),
      kadaluwarsa: r.kadaluwarsa,
    }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah penerimaannya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Penerimaan untuk ${items.length} Barang?`,
      text: `Stok akan langsung bertambah di lokasi tujuan. Total tagihan: Rp ${formatRupiah(tagihan)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/penerimaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_suplier: kodeSuplier, nip: selectedPetugas.nip, tanggal, kd_bangsal: kdBangsal, ppn_percent: Number(ppnPercent || 0), petugas: getCurrentPetugas(), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkan();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Faktur: ${data.no_faktur}`, timer: 3500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldPenerimaan {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-penerimaan { animation: blinkRedFieldPenerimaan 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 130, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Supplier
            {warnSuplier && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnSuplier ? 'blink-red-field-penerimaan' : ''}>
            <PillSelect value={kodeSuplier} onChange={setKodeSuplier} options={[{ value: '', label: '- Pilih -' }, ...suplier.map((s) => ({ value: s.kode, label: s.nama }))]} />
          </div>
        </div>
        <div style={{ width: 120, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Petugas
            {warnPetugas && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnPetugas ? 'blink-red-field-penerimaan' : ''}>
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
          <div className={warnBangsal ? 'blink-red-field-penerimaan' : ''}>
            <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 105, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 65, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>PPN %</label>
          <input type="number" step="any" style={inputStyle} value={ppnPercent} onChange={(e) => setPpnPercent(e.target.value)} />
        </div>
        <div style={{ width: 140, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <div style={{ position: 'relative', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
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
        <button type="button" onClick={handleBersihkan} style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Bersihkan
        </button>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Penerimaan'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-start', flexShrink: 0, whiteSpace: 'nowrap' }}>{filledRows.length} barang</span>
        {totals.subtotal > 0 && (
          <span style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
            Tagihan: <strong>Rp {formatRupiah(tagihan)}</strong>
          </span>
        )}
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Jumlah</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 100 }}>Harga Beli</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Diskon %</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Total</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 130 }}>Kadaluwarsa</th>
            </tr>
          </thead>
          <tbody>
            {/* Barang terpilih — fixed di atas, tetap tampil walau user
                lanjut mencari barang lain di bawah. */}
            {selectedRows.map((r) => {
              const c = hitung(r);
              return (
                <tr key={`pinned-${r.kode_brng}`} style={{ background: '#ecfdf5' }}>
                  <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #d1fae5', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="any"
                      value={r.jumlah}
                      onChange={(e) => setPinnedField(r.kode_brng, 'jumlah', e.target.value)}
                      onBlur={() => commitPinnedField(r.kode_brng)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.kode_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#065f46', fontWeight: 600 }}>{r.nama_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.satuan}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #d1fae5', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="any"
                      value={r.harga}
                      onChange={(e) => setPinnedField(r.kode_brng, 'harga', e.target.value)}
                      style={{ width: 90, padding: '5px 4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #d1fae5', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="any"
                      value={r.dis}
                      onChange={(e) => setPinnedField(r.kode_brng, 'dis', e.target.value)}
                      style={{ width: 50, padding: '5px 4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', textAlign: 'right', color: '#065f46', fontWeight: 600 }}>{c ? formatRupiah(c.total) : '-'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #d1fae5' }}>
                    <input
                      type="date"
                      value={r.kadaluwarsa}
                      onChange={(e) => setPinnedField(r.kode_brng, 'kadaluwarsa', e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 11.5, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                </tr>
              );
            })}

            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : visibleSearchRows.length === 0 ? (
              selectedRows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada barang aktif</td></tr>
              )
            ) : (
              visibleSearchRows.map((r, index) => {
                const c = hitung(r);
                return (
                  <tr key={r.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.jumlah}
                        onChange={(e) => setField(r.kode_brng, 'jumlah', e.target.value)}
                        onFocus={guardFocus}
                        onBlur={() => commitField(r.kode_brng)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.harga}
                        onChange={(e) => setField(r.kode_brng, 'harga', e.target.value)}
                        style={{ width: 90, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.dis}
                        onChange={(e) => setField(r.kode_brng, 'dis', e.target.value)}
                        style={{ width: 50, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{c ? formatRupiah(c.total) : '-'}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>
                      <input
                        type="date"
                        value={r.kadaluwarsa}
                        onChange={(e) => setField(r.kode_brng, 'kadaluwarsa', e.target.value)}
                        style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11.5, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
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

// ---- Tab: Riwayat Penerimaan ------------------------------------------------

type PenerimaanDetailItem = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jumlah: number;
  h_beli: number;
  subtotal: number;
  dis: number;
  besardis: number;
  total: number;
  kadaluwarsa: string;
};
type PenerimaanRiwayat = {
  no_faktur: string;
  tanggal: string;
  kode_suplier: string;
  nama_suplier: string;
  nip: string;
  nama_petugas: string;
  kd_bangsal: string;
  nm_bangsal: string;
  total1: number;
  potongan: number;
  total2: number;
  ppn: number;
  tagihan: number;
  items: PenerimaanDetailItem[];
};

const TabRiwayatPenerimaan: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<PenerimaanRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const fetchRiwayat = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/penerimaan/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdBangsal) url += `&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, kdBangsal, searchText]);

  React.useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  const handleHapus = async (item: PenerimaanRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Penerimaan ${item.no_faktur}?`,
      text: `Stok sistem AKAN dikembalikan (dikurangi) di ${item.nm_bangsal} untuk semua barang di faktur ini. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/penerimaan/${encodeURIComponent(item.no_faktur)}?petugas=${encodeURIComponent(getCurrentPetugas())}`, { method: 'DELETE' });
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
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="No. Faktur / supplier / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Faktur</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Supplier</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Tagihan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada penerimaan pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => {
                const isOpen = expanded === item.no_faktur;
                return (
                  <React.Fragment key={item.no_faktur}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.no_faktur)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_faktur}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_suplier}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_petugas}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>Rp {formatRupiah(item.tagihan)}</td>
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
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Harga</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Diskon</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Total</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kadaluwarsa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it) => (
                                <tr key={it.kode_brng}>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jumlah}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.satuan}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_beli)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.dis}%</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.total)}</td>
                                  <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.kadaluwarsa || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', gap: 16 }}>
                            <span>Subtotal: Rp {formatRupiah(item.total1)}</span>
                            <span>Potongan: Rp {formatRupiah(item.potongan)}</span>
                            <span>PPN: Rp {formatRupiah(item.ppn)}</span>
                            <span style={{ fontWeight: 600, color: '#111827' }}>Tagihan: Rp {formatRupiah(item.tagihan)}</span>
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

// ---- Shell Penerimaan (gabung 2 sub-tab di atas) --------------------------

export const ApotekPenerimaanView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'terima' | 'riwayat'>('terima');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'terima', label: 'Terima Barang' },
    { key: 'riwayat', label: 'Riwayat Penerimaan' },
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
      {subTab === 'terima' && <TabTerimaBarang bangsal={bangsal} />}
      {subTab === 'riwayat' && <TabRiwayatPenerimaan bangsal={bangsal} />}
    </div>
  );
};
