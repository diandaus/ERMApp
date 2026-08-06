import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';
import { localDateStr } from '../utils/date';
import { ModalCariPegawai } from '../components/ModalCariPegawai';

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
  const [selectedPegawai, setSelectedPegawai] = React.useState<{ nik: string; nama: string } | null>(null);
  const [showCariPegawai, setShowCariPegawai] = React.useState(false);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<PermintaanRow[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<PermintaanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnAsal, setWarnAsal] = React.useState(false);
  const [warnTujuan, setWarnTujuan] = React.useState(false);
  const [warnNip, setWarnNip] = React.useState(false);

  // Petugas — field ini disimpan sebagai pegawai.nik (padanan DlgCariPegawai
  // Java, BUKAN petugas.nip — lihat backend/apotek_permintaan_handler.go),
  // jadi pakai ModalCariPegawai (bukan ModalCariPetugas). Auto-isi dari NIP
  // yang di-link ke akun login (nilainya sama persis dengan pegawai.nik
  // berkat FK petugas.nip -> pegawai.nik), tetap bisa diganti manual.
  React.useEffect(() => {
    const nipLogin = getCurrentUserNip();
    if (nipLogin) setSelectedPegawai((prev) => prev || { nik: nipLogin, nama: getCurrentPetugas() || nipLogin });
  }, []);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/apotek/permintaan/barang-opsi${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map((it) => ({ ...it, jumlah: '', keterangan: '' })) : []);
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
  // ApotekPenjualan.tsx/ApotekMutasi.tsx/ApotekPenerimaan.tsx.
  const upsertSelected = (item: PermintaanRow) => {
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
  const setField = (kodeBrng: string, field: 'jumlah' | 'keterangan', value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitField = (kodeBrng: string) => {
    const item = rows.find((r) => r.kode_brng === kodeBrng);
    if (!item) return;
    upsertSelected(item);
    if (item.jumlah.trim() !== '' && Number(item.jumlah) > 0) {
      setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jumlah: '', keterangan: '' } : r)));
    }
  };

  // setPinnedField/commitPinnedField — sama pola dgn setField/commitField
  // di atas, tapi utk baris yang sudah pinned di selectedRows.
  const setPinnedField = (kodeBrng: string, field: 'jumlah' | 'keterangan', value: string) => {
    setSelectedRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitPinnedField = (kodeBrng: string) => {
    setSelectedRows((prev) => prev.filter((r) => r.kode_brng !== kodeBrng || (r.jumlah.trim() !== '' && Number(r.jumlah) > 0)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kdBangsal || !kdBangsalTujuan || !selectedPegawai) {
      e.target.blur();
      setWarnAsal(!kdBangsal);
      setWarnTujuan(!kdBangsalTujuan);
      setWarnNip(!selectedPegawai);
      setTimeout(() => {
        setWarnAsal(false);
        setWarnTujuan(false);
        setWarnNip(false);
      }, 1500);
    }
  };

  const visibleSearchRows = rows.filter((r) => !selectedRows.some((s) => s.kode_brng === r.kode_brng));
  const filledCount = selectedRows.length;

  const handleBersihkan = () => {
    setSelectedRows([]);
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
    if (!selectedPegawai) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas dulu' });
      return;
    }
    const items = selectedRows
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
        body: JSON.stringify({ kd_bangsal: kdBangsal, kd_bangsal_tujuan: kdBangsalTujuan, nip: selectedPegawai.nik, tanggal, items }),
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
            {selectedPegawai ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 0,
                border: '1px solid #1AB1E5', background: '#f0f9ff', borderRadius: 4,
                padding: '7px 8px', fontSize: 12,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${selectedPegawai.nik} - ${selectedPegawai.nama}`}>
                  {selectedPegawai.nama}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCariPegawai(true)}
                  style={{ flexShrink: 0, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10.5, fontWeight: 500 }}
                >Ganti</button>
              </div>
            ) : (
              <div
                onClick={() => setShowCariPegawai(true)}
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
            {/* Barang terpilih — fixed di atas, tetap tampil walau user
                lanjut mencari barang lain di bawah. */}
            {selectedRows.map((r) => (
              <tr key={`pinned-${r.kode_brng}`} style={{ background: '#ecfdf5' }}>
                <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #d1fae5', textAlign: 'right' }}>
                  <input
                    type="number"
                    step="any"
                    value={r.jumlah}
                    onChange={(e) => setPinnedField(r.kode_brng, 'jumlah', e.target.value)}
                    onBlur={() => commitPinnedField(r.kode_brng)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    style={{ width: 70, padding: '5px 4px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.kode_brng}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#065f46', fontWeight: 600 }}>{r.nama_brng}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', color: '#374151' }}>{r.satuan}</td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #d1fae5' }}>
                  <input
                    type="text"
                    value={r.keterangan}
                    onChange={(e) => setPinnedField(r.kode_brng, 'keterangan', e.target.value)}
                    placeholder="opsional"
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #6ee7b7', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </td>
              </tr>
            ))}

            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : visibleSearchRows.length === 0 ? (
              selectedRows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada barang aktif</td></tr>
              )
            ) : (
              visibleSearchRows.map((r, index) => (
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

      <ModalCariPegawai
        isOpen={showCariPegawai}
        onClose={() => setShowCariPegawai(false)}
        onSelect={(nik, nama) => setSelectedPegawai({ nik, nama })}
      />
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
  const [settings, setSettings] = React.useState<{ nama_instansi: string; alamat: string; logo_url: string; kontak: string; email_rs: string }>({
    nama_instansi: '', alamat: '', logo_url: '', kontak: '', email_rs: '',
  });

  React.useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => {});
  }, []);

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

  // handleCetak — cetak LAPORAN PERMINTAAN OBAT (rekap semua permintaan
  // yang lolos filter tanggal/lokasi/status/cari saat ini), pola
  // print-HTML browser sama dengan modul lain (window.open +
  // document.write + print() bawaan browser). Pakai `items` yang sudah
  // di-fetch, tidak perlu request baru. Tidak ada kolom harga/total —
  // Permintaan memang tidak menyimpan harga (murni dokumen permintaan
  // internal antar depo, beda dari Penerimaan/Penjualan).
  const handleCetak = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean)
      .join(', ');

    const rowsHtml = items.map((it, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${it.tanggal.slice(0, 10)}</td>
        <td>${it.no_permintaan}</td>
        <td>${it.nm_bangsal}</td>
        <td>${it.nm_bangsal_tujuan}</td>
        <td>${it.nm_pegawai}</td>
        <td style="text-align:center">${it.status}</td>
        <td style="text-align:right">${it.items.length}</td>
      </tr>
    `).join('');

    const filterParts = [
      kdBangsal ? `Lokasi: ${bangsal.find((b) => b.kode === kdBangsal)?.nama || kdBangsal}` : '',
      status ? `Status: ${status}` : '',
      searchText ? `Cari: "${searchText}"` : '',
    ].filter(Boolean).join(' — ');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Permintaan Obat ${tgl1} s.d. ${tgl2}</title>
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
          <center><font color="#000000" size="2" face="Tahoma"><b>LAPORAN PERMINTAAN OBAT</b></font></center>
          <div class="info">
            <div>Periode : ${tgl1} s.d. ${tgl2}</div>
            ${filterParts ? `<div>Filter : ${filterParts}</div>` : ''}
          </div>
          <table class="tbl_data">
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>No. Permintaan</th>
                <th>Asal</th>
                <th>Ditujukan Ke</th>
                <th>Petugas</th>
                <th>Status</th>
                <th>Jml Item</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div style="font-weight:bold"><span>Jumlah Permintaan</span><span>${items.length}</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
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
        <button
          type="button"
          onClick={handleCetak}
          title="Cetak Laporan Permintaan"
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
