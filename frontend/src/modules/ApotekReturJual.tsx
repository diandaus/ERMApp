import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Retur dari Pembeli (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgReturJual.java — kebalikan dari Retur ke
// Suplier: barang yang sudah DIJUAL (Jual Bebas, `penjualan`/`detailjual`)
// dikembalikan oleh pembeli, MENAMBAH stok balik. Beda dari alur Retur
// Beli (browse per-suplier lintas faktur): di sini cari-per-NOTA dulu
// (`nota_jual`), baru pilih barang dari nota itu — satu retur = satu nota.
// Lihat backend/apotek_retur_jual_handler.go untuk detail & catatan
// penting soal fitur "Jual Bebas" yang belum ada di web app ini.
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

type NotaOpsi = { nota_jual: string; tanggal: string; no_rkm_medis: string; nm_pasien: string; jns_jual: string };
type ItemOpsi = { kode_brng: string; nama_brng: string; kode_sat: string; satuan: string; h_jual: number; jml_jual: number; stok: number };
type ReturRow = ItemOpsi & { jml_retur: string; h_retur: string };

const TabBuatRetur: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [notaSearch, setNotaSearch] = React.useState('');
  const [notaOptions, setNotaOptions] = React.useState<NotaOpsi[]>([]);
  const [loadingNota, setLoadingNota] = React.useState(false);
  const [selectedNota, setSelectedNota] = React.useState<NotaOpsi | null>(null);
  const [nip, setNip] = React.useState('');
  const [petugas, setPetugas] = React.useState<KvOpsi[]>([]);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [rows, setRows] = React.useState<ReturRow[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnNota, setWarnNota] = React.useState(false);
  const [warnPetugas, setWarnPetugas] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/petugas')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPetugas(Array.isArray(data) ? data.map((p: any) => ({ kode: p.nip, nama: p.nama })) : []))
      .catch(() => {});
  }, []);

  const fetchNota = React.useCallback(async () => {
    if (!kdBangsal) {
      setNotaOptions([]);
      return;
    }
    setLoadingNota(true);
    try {
      let url = `/api/apotek/retur-jual/nota-opsi?kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (notaSearch) url += `&search=${encodeURIComponent(notaSearch)}`;
      const res = await fetch(url);
      const data = await res.json();
      setNotaOptions(Array.isArray(data) ? data : []);
    } catch {
      setNotaOptions([]);
    } finally {
      setLoadingNota(false);
    }
  }, [kdBangsal, notaSearch]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchNota(), 300);
    return () => clearTimeout(t);
  }, [fetchNota]);

  const pilihNota = async (nota: NotaOpsi) => {
    setSelectedNota(nota);
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/apotek/retur-jual/nota/${encodeURIComponent(nota.nota_jual)}/items`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map((it: ItemOpsi) => ({ ...it, jml_retur: '', h_retur: String(it.h_jual || '') })) : []);
    } catch {
      setRows([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const gantiNota = () => {
    setSelectedNota(null);
    setRows([]);
  };

  const setField = (kodeBrng: string, field: 'jml_retur' | 'h_retur', value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!selectedNota || !nip) {
      e.target.blur();
      setWarnNota(!selectedNota);
      setWarnPetugas(!nip);
      setTimeout(() => {
        setWarnNota(false);
        setWarnPetugas(false);
      }, 1500);
    }
  };

  const hitung = (r: ReturRow) => {
    if (r.jml_retur.trim() === '') return null;
    const jml = Number(r.jml_retur);
    const harga = Number(r.h_retur || 0);
    return { subtotal: jml * harga };
  };

  const filledRows = rows.filter((r) => r.jml_retur.trim() !== '' && Number(r.jml_retur) > 0);
  const totalRetur = filledRows.reduce((acc, r) => {
    const c = hitung(r);
    return acc + (c ? c.subtotal : 0);
  }, 0);

  const handleBersihkan = () => {
    setRows((prev) => prev.map((r) => ({ ...r, jml_retur: '' })));
  };

  const handleSimpan = async () => {
    if (!selectedNota) {
      Swal.fire({ icon: 'warning', title: 'Pilih Nota Penjualan dulu' });
      return;
    }
    if (!nip) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas dulu' });
      return;
    }
    const items = filledRows.map((r) => ({
      kode_brng: r.kode_brng,
      kode_sat: r.kode_sat,
      h_jual: r.h_jual,
      jml_jual: r.jml_jual,
      h_retur: Number(r.h_retur || 0),
      jml_retur: Number(r.jml_retur),
    }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah retur-nya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Retur untuk ${items.length} Barang?`,
      text: `Stok akan langsung bertambah. Total nilai retur: Rp ${formatRupiah(totalRetur)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/retur-jual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota_jual: selectedNota.nota_jual, nip, tanggal, petugas: getCurrentPetugas(), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkan();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Retur: ${data.no_retur_jual}`, timer: 3500, showConfirmButton: false });
      gantiNota();
      setNotaSearch('');
      fetchNota();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldReturJual {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-retur-jual { animation: blinkRedFieldReturJual 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>

      {!selectedNota ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', flexShrink: 0 }}>
            <div style={{ width: 180, flexShrink: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
              <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
            </div>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari Nota Penjualan</label>
              <div style={{ position: 'relative', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
                <input
                  type="text"
                  placeholder="No. Nota / Nama Pembeli / No. RM..."
                  value={notaSearch}
                  onChange={(e) => setNotaSearch(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 30 }}
                  disabled={!kdBangsal}
                />
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Nota</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pembeli</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {!kdBangsal ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih Lokasi untuk mencari nota penjualan</td></tr>
                ) : loadingNota ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
                ) : notaOptions.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada nota penjualan ditemukan</td></tr>
                ) : (
                  notaOptions.map((n, index) => (
                    <tr key={n.nota_jual} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{n.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{n.nota_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{n.nm_pasien || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{n.jns_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <button type="button" onClick={() => pilihNota(n)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          Pilih
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', flexShrink: 0 }}>
            <div style={{ flexShrink: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nota Terpilih</label>
              <div className={warnNota ? 'blink-red-field-retur-jual' : ''} style={{ padding: '7px 14px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, background: '#f9fafb' }}>
                <strong>{selectedNota.nota_jual}</strong> — {selectedNota.nm_pasien || '-'}
              </div>
            </div>
            <button type="button" onClick={gantiNota} style={{ padding: '7px 12px', borderRadius: 4, border: '1px solid #6b7280', background: '#ffffff', color: '#6b7280', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Ganti Nota
            </button>
            <div style={{ width: 120, flexShrink: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Petugas
                {warnPetugas && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
              </label>
              <div className={warnPetugas ? 'blink-red-field-retur-jual' : ''}>
                <PillSelect value={nip} onChange={setNip} options={[{ value: '', label: '- Pilih -' }, ...petugas.map((p) => ({ value: p.kode, label: p.nama }))]} />
              </div>
            </div>
            <div style={{ width: 105, flexShrink: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
              <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
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
            {totalRetur > 0 && (
              <span style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
                Nilai Retur: <strong>Rp {formatRupiah(totalRetur)}</strong>
              </span>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'hidden', height: '100%' }}>
          <div style={{ overflow: 'auto', height: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Jml Retur</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jml Dibeli</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 100 }}>Harga Retur</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {loadingItems ? (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Nota ini tidak punya baris barang</td></tr>
                ) : (
                  rows.map((r) => {
                    const c = hitung(r);
                    return (
                      <tr key={r.kode_brng}>
                        <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={r.jml_retur}
                            onChange={(e) => setField(r.kode_brng, 'jml_retur', e.target.value)}
                            onFocus={guardFocus}
                            style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{r.jml_jual}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={r.h_retur}
                            onChange={(e) => setField(r.kode_brng, 'h_retur', e.target.value)}
                            style={{ width: 90, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{c ? formatRupiah(c.subtotal) : '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
          {!loadingItems && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                padding: '2px 8px', borderRadius: 10,
                fontSize: 11, color: '#6b7280', pointerEvents: 'none',
              }}
            >
              {filledRows.length} barang
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Tab: Riwayat Retur -----------------------------------------------------

type ReturDetailItem = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  h_jual: number;
  jml_jual: number;
  h_retur: number;
  jml_retur: number;
  subtotal: number;
};
type ReturJualRiwayat = {
  no_retur_jual: string;
  tanggal: string;
  nota_jual: string;
  no_rkm_medis: string;
  nm_pasien: string;
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
  const [items, setItems] = React.useState<ReturJualRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const fetchRiwayat = React.useCallback(async () => {
    if (!tgl1 || !tgl2) return;
    setLoading(true);
    setHasSearched(true);
    try {
      let url = `/api/apotek/retur-jual/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
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
      [item.no_retur_jual, item.nota_jual, item.nm_pasien, item.nama_petugas].some((field) => (field || '').toLowerCase().includes(q))
    );
  }, [items, searchText]);

  const handleHapus = async (item: ReturJualRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Retur ${item.no_retur_jual}?`,
      text: `Stok sistem AKAN dikurangi kembali di ${item.nm_bangsal} untuk semua barang di retur ini. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/retur-jual/${encodeURIComponent(item.no_retur_jual)}?petugas=${encodeURIComponent(getCurrentPetugas())}`, { method: 'DELETE' });
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
          <input style={inputStyle} placeholder="No. Retur / No. Nota / pembeli / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Nota</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pembeli</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Nilai Retur</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih rentang tanggal lalu klik "Cari" untuk menampilkan riwayat</td></tr>
            ) : displayedItems.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada retur pada rentang ini</td></tr>
            ) : (
              displayedItems.map((item, index) => {
                const isOpen = expanded === item.no_retur_jual;
                return (
                  <React.Fragment key={item.no_retur_jual}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.no_retur_jual)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_retur_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{item.nota_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_pasien || '-'}</td>
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
                        <td colSpan={9} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 8 }}>
                            <thead>
                              <tr style={{ color: '#6b7280' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Barang</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jml Retur</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Harga Retur</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it, idx) => (
                                <tr key={`${it.kode_brng}-${idx}`}>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml_retur}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.satuan}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_retur)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.subtotal)}</td>
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

// ---- Shell Retur dari Pembeli (gabung 2 sub-tab di atas) -------------------

export const ApotekReturJualView: React.FC = () => {
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
