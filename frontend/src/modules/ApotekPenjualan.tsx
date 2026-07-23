import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Input Penjualan Obat & BHP (tab utama modul Apotek). Cocok
// dengan inventory/DlgPenjualan.java (btnInputPenjualan) untuk sub-tab
// "Input Penjualan" + inventory/DlgCariPenjualan.java untuk sub-tab
// "Laporan Penjualan" — jalur verifikasi_penjualan_di_kasir="No" saja
// (tanpa racikan/member/batch/Kasir terpisah), lihat
// backend/apotek_penjualan_handler.go untuk rumus lengkap & penyederhanaan
// yang disengaja.
//
// Beda dari Resep (yang lewat PermintaanResep/ResepModal), fitur ini
// adalah penjualan LANGSUNG di depo Apotek (Jual Bebas/OTC) — pembeli
// SERING bukan pasien terdaftar, cukup nama bebas. Harga per baris
// mengikuti kategori jns_jual yang dipilih (databarang.jualbebas/
// karyawan/ralan/kelas1-3/utama/vip/vvip/beliluar — Khanza menyimpan
// harga jual per kategori, bukan satu h_jual tunggal), makanya daftar
// barang di-refetch ulang tiap kali jns_jual berubah.
//
// Status bayar (Sudah Dibayar/Belum Dibayar) SENGAJA tidak ada di form
// Input — transaksi baru selalu default "Sudah Dibayar" server-side,
// sesuai sifat Jual Bebas/OTC yang dianggap lunas saat itu juga. Status
// cuma dipakai sebagai FILTER di sub-tab Laporan Penjualan.
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

// Padanan enum penjualan.jns_jual — urutan sesuai skema DB.
const JNS_JUAL_OPTIONS = [
  'Jual Bebas', 'Karyawan', 'Beli Luar', 'Rawat Jalan',
  'Kelas 1', 'Kelas 2', 'Kelas 3', 'Utama/BPJS', 'VIP', 'VVIP',
];

type SubTab = 'input' | 'laporan';
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'input', label: 'Input Penjualan' },
  { key: 'laporan', label: 'Laporan Penjualan' },
];

// Switch sub-tab Input/Laporan — disematkan di dalam card kiri (bukan
// panel terpisah di atasnya), tetap satu switcher untuk kedua sub-tab
// lewat state yang dilift ke ApotekPenjualanView.
const TabSwitcher: React.FC<{ subTab: SubTab; onChange: (v: SubTab) => void }> = ({ subTab, onChange }) => (
  <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, marginBottom: 4 }}>
    {SUB_TABS.map((t) => (
      <button
        key={t.key}
        type="button"
        onClick={() => onChange(t.key)}
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
);

// ---- Sub-tab: Input Penjualan ----------------------------------------------

type BarangOpsi = { kode_brng: string; nama_brng: string; kode_sat: string; satuan: string; h_jual: number; h_beli: number; stok: number };
type PenjualanRow = BarangOpsi & { jumlah: string; dis: string };

const TabInputPenjualan: React.FC<{ bangsal: KvOpsi[]; subTab: SubTab; onSubTabChange: (v: SubTab) => void }> = ({ bangsal, subTab, onSubTabChange }) => {
  const [akunBayar, setAkunBayar] = React.useState<string[]>([]);
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [nmPasien, setNmPasien] = React.useState('');
  const [jnsJual, setJnsJual] = React.useState('Jual Bebas');
  const [nip, setNip] = React.useState('');
  const [petugas, setPetugas] = React.useState<KvOpsi[]>([]);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [ppnPercent, setPpnPercent] = React.useState('0');
  const [namaBayar, setNamaBayar] = React.useState('');
  const [keterangan, setKeterangan] = React.useState('');
  const [jumlahBayar, setJumlahBayar] = React.useState('');
  const [lastNota, setLastNota] = React.useState('');
  const [previewNota, setPreviewNota] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<PenjualanRow[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<PenjualanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnPetugas, setWarnPetugas] = React.useState(false);
  const [warnBangsal, setWarnBangsal] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/petugas')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPetugas(Array.isArray(data) ? data.map((p: any) => ({ kode: p.nip, nama: p.nama })) : []))
      .catch(() => {});
    fetch('/api/apotek/penjualan/akun-bayar-opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAkunBayar(list);
        // Default ke "Bayar Cash" (transaksi Jual Bebas/OTC lazimnya
        // tunai) kalau ada, kalau tidak fallback ke item pertama.
        setNamaBayar((prev) => prev || (list.includes('Bayar Cash') ? 'Bayar Cash' : list[0] || ''));
      })
      .catch(() => {});

    // Petugas — auto-isi dari NIP yang di-link ke akun login (tetap bisa
    // diganti manual, lihat dokumentasi getCurrentUserNip di utils/currentUser.ts).
    const nipLogin = getCurrentUserNip();
    if (nipLogin) setNip((prev) => prev || nipLogin);

    // Lokasi/Depo — auto-isi dari Pengaturan > Lokasi Stok Utama Obat.
    fetch('/api/apotek/pengaturan/lokasi')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.kd_bangsal) setKdBangsal((prev) => prev || data.kd_bangsal);
      })
      .catch(() => {});
  }, []);

  // No. Nota — langsung tampil begitu form dibuka (padanan autoNomor() di
  // Java yang dipanggil saat dialog dibuka, bukan nunggu sampai Simpan).
  // Cuma preview (server tidak mengunci/reserve nomor ini), makanya
  // di-refresh ulang tiap kali tanggal berubah supaya prefix tanggalnya
  // tetap akurat.
  const fetchPreviewNota = React.useCallback(() => {
    fetch(`/api/apotek/penjualan/next-nota?tanggal=${tanggal}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPreviewNota(data?.nota_jual || ''))
      .catch(() => {});
  }, [tanggal]);

  React.useEffect(() => {
    fetchPreviewNota();
  }, [fetchPreviewNota]);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ jns_jual: jnsJual, kd_bangsal: kdBangsal });
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/apotek/penjualan/barang-opsi?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map((it: BarangOpsi) => ({ ...it, jumlah: '', dis: '' })) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, jnsJual, kdBangsal]);

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
  }, [searchText, jnsJual, kdBangsal]);

  // Barang yang sudah diisi jumlahnya "pindah" jadi baris fixed di paling
  // atas tabel (selectedRows) — tetap terlihat & bisa diedit walau user
  // lanjut mencari barang lain, tidak lagi hilang begitu keluar dari hasil
  // pencarian saat ini.
  const upsertSelected = (item: PenjualanRow) => {
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

  // setField cuma update tampilan lokal saat mengetik — upsertSelected
  // (yang memindahkan baris ke bagian fixed & menyembunyikannya dari
  // hasil pencarian) BARU dipanggil saat blur (commitField), bukan tiap
  // keystroke. Kalau dipindah tiap keystroke, input-nya langsung
  // ke-unmount begitu nilai jadi valid (mis. baru ngetik "1"), jadi
  // keystroke berikutnya ("0") tidak nyangkut di mana pun — persis bug
  // "ketik 10 cuma kesimpen 1".
  const setField = (kodeBrng: string, field: 'jumlah' | 'dis', value: string) => {
    setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitField = (kodeBrng: string) => {
    const item = rows.find((r) => r.kode_brng === kodeBrng);
    if (!item) return;
    upsertSelected(item);
    // Reset salinan lokal di `rows` begitu barang dipindah ke pinned —
    // kalau tidak, ketika nanti dihapus dari pinned (jumlah dikosongkan)
    // dan baris ini balik muncul di hasil pencarian, jumlah lama masih
    // nyangkut di situ (baru kelihatan ke user karena visibleSearchRows
    // menyaring baris ini SELAMA masih ada di selectedRows, bukan karena
    // rows-nya ikut dibersihkan).
    if (item.jumlah.trim() !== '' && Number(item.jumlah) > 0) {
      setRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, jumlah: '', dis: '' } : r)));
    }
  };

  // setPinnedField cuma update nilai saat mengetik, TIDAK langsung buang
  // baris begitu jumlah sempat kosong (mis. user select-all lalu mau
  // ganti "10" jadi "5" — sempat kosong sesaat di tengah proses ngetik).
  // Baris baru dibuang saat blur kalau masih kosong/tidak valid
  // (commitPinnedField), sama pola dgn commitField utk baris pencarian —
  // ini yang sebelumnya jadi "bug hapus di kolom jumlah" (baris hilang
  // mendadak di tengah edit, bukan cuma saat benar-benar mau dihapus).
  const setPinnedField = (kodeBrng: string, field: 'jumlah' | 'dis', value: string) => {
    setSelectedRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  const commitPinnedField = (kodeBrng: string) => {
    setSelectedRows((prev) => prev.filter((r) => r.kode_brng !== kodeBrng || (r.jumlah.trim() !== '' && Number(r.jumlah) > 0)));
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!nip || !kdBangsal) {
      e.target.blur();
      setWarnPetugas(!nip);
      setWarnBangsal(!kdBangsal);
      setTimeout(() => {
        setWarnPetugas(false);
        setWarnBangsal(false);
      }, 1500);
    }
  };

  const hitung = (r: PenjualanRow) => {
    if (r.jumlah.trim() === '') return null;
    const jumlah = Number(r.jumlah);
    const harga = Number(r.h_jual || 0);
    const dis = Number(r.dis || 0);
    const subtotal = jumlah * harga;
    const bsrDis = subtotal * (dis / 100);
    const total = subtotal - bsrDis;
    return { subtotal, bsrDis, total };
  };

  const filledRows = selectedRows;
  const visibleSearchRows = rows.filter((r) => !selectedRows.some((s) => s.kode_brng === r.kode_brng));
  const total2 = filledRows.reduce((acc, r) => {
    const c = hitung(r);
    return acc + (c ? c.total : 0);
  }, 0);
  const ppnAmount = (Number(ppnPercent || 0) / 100) * total2;
  const tagihan = total2 + ppnAmount;
  const uangKembali = Number(jumlahBayar || 0) - tagihan;

  const handleBersihkan = () => {
    setSelectedRows([]);
    setRows((prev) => prev.map((r) => ({ ...r, jumlah: '', dis: '' })));
    setNmPasien('');
    setKeterangan('');
    setJumlahBayar('');
    setLastNota('');
  };

  const handleSimpan = async () => {
    if (!nip) {
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
      h_jual: Number(r.h_jual || 0),
      h_beli: Number(r.h_beli || 0),
      dis: Number(r.dis || 0),
    }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah penjualannya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Penjualan untuk ${items.length} Barang?`,
      text: `Stok akan langsung berkurang di lokasi asal. Total tagihan: Rp ${formatRupiah(tagihan)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/penjualan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nm_pasien: nmPasien,
          jns_jual: jnsJual,
          nip,
          tanggal,
          kd_bangsal: kdBangsal,
          ppn_percent: Number(ppnPercent || 0),
          nama_bayar: namaBayar,
          keterangan,
          petugas: getCurrentPetugas(),
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setSelectedRows([]);
      setRows((prev) => prev.map((r) => ({ ...r, jumlah: '', dis: '' })));
      setNmPasien('');
      setKeterangan('');
      setJumlahBayar('');
      setLastNota(data.nota_jual);
      fetchPreviewNota();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Nota: ${data.nota_jual}`, timer: 3500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldPenjualan {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-penjualan { animation: blinkRedFieldPenjualan 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>

      {/* Kolom kiri — cari & isi barang */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <TabSwitcher subTab={subTab} onChange={onSubTabChange} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
          <div style={{ width: 150, flexShrink: 0 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nama Pembeli</label>
            <input type="text" placeholder="Umum" style={inputStyle} value={nmPasien} onChange={(e) => setNmPasien(e.target.value)} />
          </div>
          <div style={{ width: 120, flexShrink: 0 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Petugas
              {warnPetugas && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
            </label>
            <div className={warnPetugas ? 'blink-red-field-penjualan' : ''}>
              <PillSelect value={nip} onChange={setNip} options={[{ value: '', label: '- Pilih -' }, ...petugas.map((p) => ({ value: p.kode, label: p.nama }))]} />
            </div>
          </div>
          <div style={{ width: 105, flexShrink: 0 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Lokasi
              {warnBangsal && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
            </label>
            <div className={warnBangsal ? 'blink-red-field-penjualan' : ''}>
              <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
            </div>
          </div>
          <div style={{ width: 360, flexShrink: 0 }}>
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
          <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-start', flexShrink: 0, whiteSpace: 'nowrap' }}>{filledRows.length} barang</span>
        </div>

        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Jumlah</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 70 }}>Stok</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 100 }}>Harga Jual</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Diskon %</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Total</th>
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
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', textAlign: 'right', color: Number(r.jumlah || 0) > r.stok ? '#dc2626' : '#374151', fontWeight: Number(r.jumlah || 0) > r.stok ? 700 : 400 }}>{r.stok}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #d1fae5', textAlign: 'right', color: '#374151' }}>{formatRupiah(r.h_jual)}</td>
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
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: r.stok <= 0 ? '#dc2626' : '#374151' }}>{r.stok}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{formatRupiah(r.h_jual)}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="any"
                          value={r.dis}
                          onChange={(e) => setField(r.kode_brng, 'dis', e.target.value)}
                          onBlur={() => commitField(r.kode_brng)}
                          style={{ width: 50, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
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
      </div>

      {/* Kolom kanan — ringkasan nota, cuma muncul begitu ada transaksi
          (minimal satu barang diisi jumlahnya). Sebelum itu card kiri
          full-width sendirian; begitu ada transaksi, card ini muncul dan
          "mendorong" card kiri jadi lebih sempit. */}
      {(filledRows.length > 0 || lastNota !== '') && (
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, height: 'fit-content' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', paddingBottom: 4, borderBottom: '1px solid #e5e7eb' }}>Ringkasan Nota</div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No. Nota</label>
            <div style={{ padding: '7px 14px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {lastNota || previewNota || '...'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis Jual</label>
            <PillSelect value={jnsJual} onChange={setJnsJual} options={JNS_JUAL_OPTIONS.map((j) => ({ value: j, label: j }))} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
            <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>PPN %</label>
            <input type="number" step="any" style={inputStyle} value={ppnPercent} onChange={(e) => setPpnPercent(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Pembayaran</label>
            <PillSelect value={namaBayar} onChange={setNamaBayar} options={akunBayar.map((a) => ({ value: a, label: a }))} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Catatan</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Catatan (opsional)..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Total Harga</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>Rp {formatRupiah(tagihan)}</div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jumlah Bayar</label>
            <input
              type="number"
              step="any"
              placeholder="0"
              style={inputStyle}
              value={jumlahBayar}
              onChange={(e) => setJumlahBayar(e.target.value)}
            />
          </div>

          {jumlahBayar.trim() !== '' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {uangKembali < 0 ? 'Kurang Bayar' : 'Uang Kembali'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: uangKembali < 0 ? '#dc2626' : '#059669' }}>
                Rp {formatRupiah(Math.abs(uangKembali))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={handleSimpan}
              disabled={saving}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Penjualan'}
            </button>
            <button
              type="button"
              onClick={handleBersihkan}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              Batalkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Sub-tab: Laporan Penjualan --------------------------------------------

type PenjualanDetailItem = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jumlah: number;
  h_jual: number;
  subtotal: number;
  dis: number;
  bsr_dis: number;
  total: number;
};
type PenjualanRiwayat = {
  nota_jual: string;
  tanggal: string;
  nm_pasien: string;
  jns_jual: string;
  nip: string;
  nama_petugas: string;
  kd_bangsal: string;
  nm_bangsal: string;
  nama_bayar: string;
  status: string;
  keterangan: string;
  ppn: number;
  tagihan: number;
  items: PenjualanDetailItem[];
};

const STATUS_OPTIONS = ['Sudah Dibayar', 'Belum Dibayar'];

const TabLaporanPenjualan: React.FC<{ bangsal: KvOpsi[]; subTab: SubTab; onSubTabChange: (v: SubTab) => void }> = ({ bangsal, subTab, onSubTabChange }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<PenjualanRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const fetchRiwayat = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/apotek/penjualan/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
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

  const handleHapus = async (item: PenjualanRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Penjualan ${item.nota_jual}?`,
      text: `Stok sistem AKAN dikembalikan (ditambah) di ${item.nm_bangsal} untuk semua barang di nota ini. Tindakan ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/penjualan/${encodeURIComponent(item.nota_jual)}?petugas=${encodeURIComponent(getCurrentPetugas())}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus, stok dikembalikan', timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
      <TabSwitcher subTab={subTab} onChange={onSubTabChange} />
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
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status Bayar</label>
          <PillSelect value={status} onChange={setStatus} options={[{ value: '', label: 'Semua Status' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]} />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="No. Nota / pembeli / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Nota</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pembeli</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Jual</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Tagihan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada penjualan pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => {
                const isOpen = expanded === item.nota_jual;
                return (
                  <React.Fragment key={item.nota_jual}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.nota_jual)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.nota_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_pasien}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jns_jual}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_petugas}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                          background: item.status === 'Sudah Dibayar' ? '#d1fae5' : '#fef3c7',
                          color: item.status === 'Sudah Dibayar' ? '#065f46' : '#92400e',
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>Rp {formatRupiah(item.tagihan)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleHapus(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
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
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it) => (
                                <tr key={it.kode_brng}>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jumlah}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{it.satuan}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_jual)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.dis}%</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', gap: 16 }}>
                            <span>Pembayaran: {item.nama_bayar}</span>
                            <span>PPN: Rp {formatRupiah(item.ppn)}</span>
                            {item.keterangan && <span>Catatan: {item.keterangan}</span>}
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

// ---- Shell Penjualan (gabung 2 sub-tab di atas) ----------------------------

export const ApotekPenjualanView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<SubTab>('input');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  return (
    <>
      {subTab === 'input' && <TabInputPenjualan bangsal={bangsal} subTab={subTab} onSubTabChange={setSubTab} />}
      {subTab === 'laporan' && <TabLaporanPenjualan bangsal={bangsal} subTab={subTab} onSubTabChange={setSubTab} />}
    </>
  );
};
