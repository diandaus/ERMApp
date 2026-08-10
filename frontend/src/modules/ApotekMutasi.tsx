import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Mutasi Obat & BHP (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgMutasiBarang.java (form INPUT, satu-satunya
// yang punya tombol Simpan) + inventory/DlgPindahGudang.java (laporan
// riwayat + tombol Hapus). Dua sub-tab di sini meniru pemisahan itu:
// "Input Mutasi" (pindahkan stok dari satu lokasi ke lokasi lain, langsung
// koreksi gudangbarang.stok DUA sisi sekaligus) dan "Riwayat Mutasi" (log
// historis, Hapus di sini JUSTRU MENGEMBALIKAN stok ke kedua lokasi —
// KEBALIKAN dari Stok Opname yang hapus riwayatnya tidak revert apa pun).
// Lihat backend/apotek_mutasi_handler.go untuk rumus & penyederhanaan yang
// disengaja dari versi Java.
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

// ---- Tab: Input Mutasi ---------------------------------------------------

type MutasiItem = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  h_beli: number;
  stok_asal: number;
  stok_tujuan: number;
  expire: string;
};
type MutasiRow = MutasiItem & { jml: string };

const TabInputMutasi: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsalDari, setKdBangsalDari] = React.useState('');
  const [kdBangsalKe, setKdBangsalKe] = React.useState('');
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [keterangan, setKeterangan] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<MutasiRow[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<MutasiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnDari, setWarnDari] = React.useState(false);
  const [warnKe, setWarnKe] = React.useState(false);
  const [warnKeterangan, setWarnKeterangan] = React.useState(false);

  // Beda dari Stok Opname yang selalu menampilkan seluruh katalog aktif:
  // Mutasi HARUS tahu Dari dulu (endpoint mengembalikan daftar kosong kalau
  // kd_bangsal_dari belum diisi — cuma barang berstok>0 di lokasi itu yang
  // relevan untuk dipindahkan, persis tampil() di DlgMutasiBarang.java).
  const fetchItems = React.useCallback(async () => {
    if (!kdBangsalDari) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/apotek/mutasi/items?kd_bangsal_dari=${encodeURIComponent(kdBangsalDari)}`;
      if (kdBangsalKe) url += `&kd_bangsal_ke=${encodeURIComponent(kdBangsalKe)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map((it) => ({ ...it, jml: '' })) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kdBangsalDari, kdBangsalKe, searchText]);

  // Ganti Dari mereset seluruh Jml yang sudah diisi (termasuk barang yang
  // sudah "pinned" di selectedRows) — Stok Asal barang jadi tidak relevan
  // lagi begitu lokasi asal berubah (padanan aturan "Lokasi kosong wipe
  // Real" di Stok Opname, digeneralisasi ke Dari berubah).
  React.useEffect(() => {
    setSelectedRows([]);
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdBangsalDari]);

  const isFirstOther = React.useRef(true);
  React.useEffect(() => {
    if (isFirstOther.current) {
      isFirstOther.current = false;
      return;
    }
    const t = setTimeout(() => fetchItems(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdBangsalKe, searchText]);

  // Barang yang sudah diisi jumlahnya "pindah" jadi baris fixed di paling
  // atas tabel (selectedRows) — tetap terlihat & bisa diedit walau user
  // lanjut mencari barang lain, tidak lagi hilang (beserta jumlahnya)
  // begitu keluar dari hasil pencarian saat ini. Pola sama persis dengan
  // upsertSelected di ApotekPenjualan.tsx.
  const upsertSelected = (item: MutasiRow) => {
    setSelectedRows((prev) => {
      const jmlNum = Number(item.jml);
      const isValid = item.jml.trim() !== '' && !isNaN(jmlNum) && jmlNum > 0;
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
  const setField = (kodeBrng: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jml: value } : r)));
  };

  // Blok jumlah melebihi Stok Asal — padanan tbDokterMouseClicked di Java
  // yang reset Jml+alert kalau jumlah melebihi stok tersedia di lokasi
  // asal. Dipanggil dari commitField/commitPinnedField (dua-duanya).
  const cekStokCukup = (r: MutasiRow): boolean => {
    const val = Number(r.jml);
    if (r.jml.trim() !== '' && val > r.stok_asal) {
      Swal.fire({ icon: 'warning', title: 'Stok tidak mencukupi', text: `Stok asal ${r.nama_brng} cuma ${r.stok_asal}` });
      return false;
    }
    return true;
  };

  const commitField = (kodeBrng: string) => {
    const item = rows.find((r) => r.kode_brng === kodeBrng);
    if (!item) return;
    if (!cekStokCukup(item)) {
      setField(kodeBrng, '');
      return;
    }
    upsertSelected(item);
    if (item.jml.trim() !== '' && Number(item.jml) > 0) {
      setField(kodeBrng, '');
    }
  };

  // setPinnedField cuma update nilai saat mengetik, TIDAK langsung buang
  // baris begitu jumlah sempat kosong (mis. user select-all mau ganti
  // "10" jadi "5"). Baris baru dibuang saat blur kalau masih kosong/tidak
  // valid (commitPinnedField), sama pola dgn ApotekPenjualan.tsx.
  const setPinnedField = (kodeBrng: string, value: string) => {
    setSelectedRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jml: value } : r)));
  };

  const commitPinnedField = (kodeBrng: string) => {
    const item = selectedRows.find((r) => r.kode_brng === kodeBrng);
    if (item && !cekStokCukup(item)) {
      setPinnedField(kodeBrng, '');
    }
    setSelectedRows((prev) => prev.filter((r) => r.kode_brng !== kodeBrng || (r.jml.trim() !== '' && Number(r.jml) > 0)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kdBangsalDari || !kdBangsalKe || !keterangan.trim()) {
      e.target.blur();
      setWarnDari(!kdBangsalDari);
      setWarnKe(!kdBangsalKe);
      setWarnKeterangan(!keterangan.trim());
      setTimeout(() => {
        setWarnDari(false);
        setWarnKe(false);
        setWarnKeterangan(false);
      }, 1500);
    }
  };

  const hitungTotal = (r: MutasiRow) => (r.jml.trim() === '' ? null : Number(r.jml) * r.h_beli);
  const visibleSearchRows = rows.filter((r) => !selectedRows.some((s) => s.kode_brng === r.kode_brng));
  const filledCount = selectedRows.length;

  const handleBersihkanJumlah = () => {
    setSelectedRows([]);
    setRows((prev) => prev.map((r) => ({ ...r, jml: '' })));
  };

  const handleSimpan = async () => {
    if (!kdBangsalDari) {
      Swal.fire({ icon: 'warning', title: 'Pilih lokasi asal (Dari) dulu' });
      return;
    }
    if (!kdBangsalKe) {
      Swal.fire({ icon: 'warning', title: 'Pilih lokasi tujuan (Ke) dulu' });
      return;
    }
    if (kdBangsalDari === kdBangsalKe) {
      Swal.fire({ icon: 'warning', title: 'Lokasi Dari dan Ke harus berbeda' });
      return;
    }
    if (!keterangan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Keterangan wajib diisi' });
      return;
    }
    const items = selectedRows
      .filter((r) => r.jml.trim() !== '' && Number(r.jml) > 0)
      .map((r) => ({ kode_brng: r.kode_brng, h_beli: r.h_beli, jml: Number(r.jml) }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah mutasinya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Mutasi ${items.length} Barang?`,
      text: 'Stok akan langsung dipindahkan dari lokasi asal ke lokasi tujuan. Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/mutasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_bangsal_dari: kdBangsalDari, kd_bangsal_ke: kdBangsalKe, tanggal, keterangan, petugas: getCurrentPetugas(), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkanJumlah();
      await fetchItems();
      setKeterangan('');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${data.message} (${data.affected} barang)`, timer: 3000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldMutasi {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-mutasi { animation: blinkRedFieldMutasi 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 100, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Dari
            {warnDari && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnDari ? 'blink-red-field-mutasi' : ''}>
            <PillSelect value={kdBangsalDari} onChange={setKdBangsalDari} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 100, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Ke
            {warnKe && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnKe ? 'blink-red-field-mutasi' : ''}>
            <PillSelect value={kdBangsalKe} onChange={setKdBangsalKe} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 118, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Keterangan
            {warnKeterangan && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <input
            style={inputStyle}
            className={warnKeterangan ? 'blink-red-field-mutasi' : ''}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Mutasi rutin"
          />
        </div>
        <div style={{ width: 360, flexShrink: 0 }}>
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
          onClick={handleBersihkanJumlah}
          style={{ marginLeft: 'auto', padding: '7px 12px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Bersihkan
        </button>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving || !kdBangsalDari || !kdBangsalKe}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving || !kdBangsalDari || !kdBangsalKe ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Mutasi'}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'hidden', height: '100%' }}>
      <div style={{ overflow: 'auto', height: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 70 }}>Jml</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Harga</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Total</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Asal</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Tujuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kadaluwarsa</th>
            </tr>
          </thead>
          <tbody>
            {/* Barang terpilih — fixed di atas, tetap tampil walau user
                lanjut mencari barang lain di bawah. */}
            {selectedRows.map((r) => {
              const total = hitungTotal(r);
              return (
                <tr key={`pinned-${r.kode_brng}`} style={{ background: '#ecfdf5' }}>
                  <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #d1fae5', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="any"
                      value={r.jml}
                      onChange={(e) => setPinnedField(r.kode_brng, e.target.value)}
                      onBlur={() => commitPinnedField(r.kode_brng)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ width: 70, padding: '5px 4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.kode_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#065f46', fontWeight: 600 }}>{r.nama_brng}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.satuan}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151', textAlign: 'right' }}>{formatRupiah(r.h_beli)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#065f46', fontWeight: 600, textAlign: 'right' }}>{total !== null ? formatRupiah(total) : '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: Number(r.jml || 0) > r.stok_asal ? '#dc2626' : '#374151', fontWeight: Number(r.jml || 0) > r.stok_asal ? 700 : 400, textAlign: 'right' }}>{r.stok_asal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151', textAlign: 'right' }}>{r.stok_tujuan}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.expire || '-'}</td>
                </tr>
              );
            })}

            {!kdBangsalDari ? (
              selectedRows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih lokasi Dari untuk menampilkan barang yang bisa dimutasi</td></tr>
              )
            ) : loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : visibleSearchRows.length === 0 ? (
              selectedRows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada barang berstok di lokasi ini</td></tr>
              )
            ) : (
              visibleSearchRows.map((r, index) => {
                const total = hitungTotal(r);
                return (
                  <tr key={r.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.jml}
                        onChange={(e) => setField(r.kode_brng, e.target.value)}
                        onFocus={guardFocus}
                        onBlur={() => commitField(r.kode_brng)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: 70, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{formatRupiah(r.h_beli)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{total !== null ? formatRupiah(total) : '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{r.stok_asal}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{r.stok_tujuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.expire || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
      {!loading && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            padding: '2px 8px', borderRadius: 10,
            fontSize: 11, color: '#6b7280', pointerEvents: 'none',
          }}
        >
          {filledCount} siap dimutasi
        </div>
      )}
      </div>
    </div>
  );
};

// ---- Tab: Riwayat Mutasi -------------------------------------------------

type MutasiRiwayat = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jml: number;
  harga: number;
  total: number;
  tanggal: string;
  keterangan: string;
  kd_bangsal_dari: string;
  nm_bangsal_dari: string;
  kd_bangsal_ke: string;
  nm_bangsal_ke: string;
  no_batch: string;
  no_faktur: string;
};

const TabRiwayatMutasi: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<MutasiRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<{ nama_instansi: string; alamat: string; logo_url: string; kontak: string; email_rs: string }>({
    nama_instansi: '', alamat: '', logo_url: '', kontak: '', email_rs: '',
  });

  React.useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => {});
  }, []);

  const fetchRiwayat = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/mutasi/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
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

  const handleDelete = async (item: MutasiRiwayat) => {
    const confirm = await Swal.fire({
      title: 'Hapus Riwayat Mutasi Ini?',
      text: `${item.nama_brng} — ${item.tanggal}. Stok sistem AKAN dikembalikan: ${item.nm_bangsal_dari} bertambah ${item.jml}, ${item.nm_bangsal_ke} berkurang ${item.jml}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const params = new URLSearchParams({
        kode_brng: item.kode_brng,
        tanggal: item.tanggal,
        kd_bangsal_dari: item.kd_bangsal_dari,
        kd_bangsal_ke: item.kd_bangsal_ke,
        no_batch: item.no_batch,
        no_faktur: item.no_faktur,
        petugas: getCurrentPetugas(),
      });
      const res = await fetch(`/api/apotek/mutasi?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus, stok dikembalikan', timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  // handleCetak — cetak LAPORAN MUTASI OBAT (rekap semua riwayat yang
  // lolos filter tanggal/lokasi/cari saat ini), pola print-HTML browser
  // sama dengan modul lain (window.open + document.write + print()
  // bawaan browser). Pakai `items` yang sudah di-fetch, tidak perlu
  // request baru.
  const handleCetak = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean)
      .join(', ');

    const grandTotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
    const rowsHtml = items.map((it, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${it.tanggal.slice(0, 10)}</td>
        <td>${it.nama_brng} (${it.satuan})</td>
        <td>${it.nm_bangsal_dari}</td>
        <td>${it.nm_bangsal_ke}</td>
        <td style="text-align:right">${it.jml}</td>
        <td style="text-align:right">${formatRupiah(it.harga)}</td>
        <td style="text-align:right">${formatRupiah(it.total)}</td>
        <td>${it.keterangan || '-'}</td>
      </tr>
    `).join('');

    const filterParts = [
      kdBangsal ? `Lokasi: ${bangsal.find((b) => b.kode === kdBangsal)?.nama || kdBangsal}` : '',
      searchText ? `Cari: "${searchText}"` : '',
    ].filter(Boolean).join(' — ');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Mutasi Obat ${tgl1} s.d. ${tgl2}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            .info { margin: 10px 0; font-size: 12px; }
            .info div { margin-bottom: 2px; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.tbl_data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            table.tbl_data th, table.tbl_data td { border: 1px solid #333; padding: 4px 6px; }
            table.tbl_data th { background: #f3f4f6; }
            .totals { margin-top: 8px; font-size: 12px; }
            .totals div { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 2px; }
            .totals span:first-child { width: 140px; }
            .totals span:last-child { width: 130px; text-align: right; }
          </style>
        </head>
        <body>
          <table width="100%" align="center" border="0" class="tbl_form" cellspacing="0" cellpadding="0">
            <tr>
              <td width="15%">
                ${logoSrc ? `<img width="50" height="50" src="${logoSrc}" />` : ''}
              </td>
              <td width="70%">
                <center>
                  <font color="#000000" size="3" face="Tahoma"><b>${settings.nama_instansi}</b></font><br/>
                  <font color="#000000" size="1" face="Tahoma">
                    ${settings.alamat}${kontakEmail ? `<br/>${kontakEmail}` : ''}
                  </font>
                </center>
              </td>
              <td width="15%"></td>
            </tr>
          </table>
          <hr/>
          <center><font color="#000000" size="2" face="Tahoma"><b>LAPORAN MUTASI OBAT</b></font></center>
          <div class="info">
            <div>Periode : ${tgl1} s.d. ${tgl2}</div>
            ${filterParts ? `<div>Filter : ${filterParts}</div>` : ''}
          </div>
          <table class="tbl_data">
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Barang</th>
                <th>Dari</th>
                <th>Ke</th>
                <th>Jumlah</th>
                <th>Harga</th>
                <th>Total</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Jumlah Baris</span><span>${items.length}</span></div>
            <div style="font-weight:bold"><span>Total</span><span>Rp ${formatRupiah(grandTotal)}</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi (Dari/Ke)</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="Kode / nama barang / keterangan..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={handleCetak}
          title="Cetak Laporan Mutasi"
          style={{ flexShrink: 0, width: 32, height: 32, padding: 0, borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dari</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ke</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jumlah</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Harga</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Total</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Keterangan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada riwayat mutasi pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.kode_brng}-${item.tanggal}-${item.kd_bangsal_dari}-${item.kd_bangsal_ke}-${item.no_batch}-${item.no_faktur}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.nama_brng} <span style={{ color: '#9ca3af' }}>({item.satuan})</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal_dari}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal_ke}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.jml}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatRupiah(item.harga)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatRupiah(item.total)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.keterangan}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <button type="button" onClick={() => handleDelete(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                      Hapus
                    </button>
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

// ---- Shell Mutasi (gabung 2 sub-tab di atas) -----------------------------

export const ApotekMutasiView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'input' | 'riwayat'>('input');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'input', label: 'Input Mutasi' },
    { key: 'riwayat', label: 'Riwayat Mutasi' },
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
      {subTab === 'input' && <TabInputMutasi bangsal={bangsal} />}
      {subTab === 'riwayat' && <TabRiwayatMutasi bangsal={bangsal} />}
    </div>
  );
};
