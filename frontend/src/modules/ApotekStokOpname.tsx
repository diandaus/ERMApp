import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Stok Opname (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop "Stok Opname" (inventory/DlgInputStok.java — form INPUT
// sebenarnya; DlgStokOpname.java cuma laporan riwayat READ-ONLY, tidak
// ada tombol Simpan). Dua sub-tab di sini meniru pemisahan itu: "Input
// Opname" (isi hasil hitung fisik, langsung koreksi gudangbarang.stok)
// dan "Riwayat Opname" (log historis, bisa dihapus tapi TIDAK
// mengembalikan stok — identik Java). Lihat
// backend/apotek_stok_opname_handler.go untuk rumus & penyederhanaan
// yang disengaja dari versi Java.
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

type KvOpsi = { kode: string; nama: string };

// ---- Tab: Input Opname -------------------------------------------------

type OpnameItem = {
  kode_brng: string;
  nama_brng: string;
  jenis: string;
  satuan: string;
  no_batch: string;
  no_faktur: string;
  h_beli: number;
  stok: number;
  expire: string;
};

type OpnameRow = OpnameItem & { real: string };

const TabInputOpname: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [keterangan, setKeterangan] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [rows, setRows] = React.useState<OpnameRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [warnLokasi, setWarnLokasi] = React.useState(false);
  const [warnKeterangan, setWarnKeterangan] = React.useState(false);

  // Dropdown filter/urutkan di tombol "Tampilkan" — pola sama seperti
  // dropdown Filter di RawatJalan.tsx (ref + klik-di-luar-tutup).
  const [showFilterDropdown, setShowFilterDropdown] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'nama' | 'kode' | 'kategori' | 'satuan'>('nama');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [showSortSubmenu, setShowSortSubmenu] = React.useState(false);
  const [opnameFilter, setOpnameFilter] = React.useState<'semua' | 'belum' | 'sudah'>('semua');
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  // Daftar barang langsung tampil begitu tab dibuka, TANPA perlu pilih
  // Lokasi dulu — identik tampil() awal di Java (DlgInputStok.java): list
  // dari databarang, stok hardcode 0 sampai staf pilih Lokasi. kd_bangsal
  // dikirim apa adanya (boleh kosong); backend fallback stok=0 kalau
  // kosong atau barang belum pernah distok di lokasi itu.
  const rowKey = (r: { kode_brng: string; no_batch: string; no_faktur: string }) => `${r.kode_brng}|${r.no_batch}|${r.no_faktur}`;

  // Setiap refetch (ganti Lokasi atau ketik pencarian) TIDAK BOLEH
  // menghapus nilai "Real" yang sudah staf isi di baris lain — identik
  // tampil2() di Java (DlgInputStok.java), yang eksplisit menyimpan dulu
  // isi kolom Real semua baris yang tidak kosong sebelum tabel di-refresh
  // dari cache/pencarian, lalu mengembalikannya. Di sini caranya lebih
  // sederhana: gabungkan hasil fetch baru dengan nilai `real` dari baris
  // lama yang cocok (key kode_brng+no_batch+no_faktur).
  //
  // KECUALI kalau Lokasi kosong — Java (getData()) eksplisit mengosongkan
  // SEMUA kolom Real begitu nmgudang kosong (`if(nmgudang...equals("")){
  // for(...) tbDokter.setValueAt("",index,0); }`), karena stok yang
  // ditampilkan saat Lokasi kosong cuma placeholder 0, bukan angka
  // sungguhan — mengisi Real di kondisi itu cuma menghasilkan
  // selisih/lebih yang tidak berarti.
  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/apotek/stok-opname/items?kd_bangsal=${encodeURIComponent(kdBangsal)}${searchText ? `&search=${encodeURIComponent(searchText)}` : ''}`;
      const res = await fetch(url);
      const data: OpnameItem[] = await res.json();
      setRows((prev) => {
        const prevReal = new Map(prev.map((r) => [rowKey(r), r.real]));
        return Array.isArray(data) ? data.map((it) => ({ ...it, real: kdBangsal ? prevReal.get(rowKey(it)) || '' : '' })) : [];
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kdBangsal, searchText]);

  // Ganti Lokasi selalu auto-refresh (stok sistem beda per lokasi, harus
  // langsung update).
  React.useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdBangsal]);

  // Ketik di kotak Cari langsung auto-search (mulai dari huruf pertama),
  // di-debounce 300ms supaya tidak nembak request tiap keystroke saat
  // staf masih mengetik cepat. Tombol "Tampilkan"/Enter tetap ada untuk
  // memicu manual kalau perlu. Skip fetch pertama (mount) karena sudah
  // ditangani efek Lokasi di atas.
  const isFirstSearch = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // Key by identity (bukan index array) supaya tetap benar walau baris
  // yang sedang ditampilkan (displayRows) sudah diurutkan/difilter beda
  // urutan dari `rows` aslinya.
  const setReal = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => (rowKey(r) === key ? { ...r, real: value } : r)));
  };

  // Klik/fokus ke kolom Real sebelum Lokasi & Keterangan diisi cuma
  // menghasilkan selisih/lebih yang tidak berarti (stok masih placeholder
  // 0) — kunci dulu inputnya dan kedipkan kolom yang masih kosong warna
  // merah (bukan SweetAlert) supaya tidak mengganggu alur ketik staf.
  const guardRealFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kdBangsal || !keterangan.trim()) {
      e.target.blur();
      if (!kdBangsal) setWarnLokasi(true);
      if (!keterangan.trim()) setWarnKeterangan(true);
      window.setTimeout(() => {
        setWarnLokasi(false);
        setWarnKeterangan(false);
      }, 1500);
    }
  };

  const hitung = (r: OpnameRow) => {
    if (r.real.trim() === '') return null;
    const real = Number(r.real);
    const kurang = r.stok - real;
    const selisih = kurang > 0 ? kurang : 0;
    const lebih = kurang > 0 ? 0 : -kurang;
    return { selisih, lebih, nomihilang: selisih * r.h_beli, nomilebih: lebih * r.h_beli };
  };

  const filledCount = rows.filter((r) => r.real.trim() !== '').length;

  // Filter "Belum/Sudah Diopname" (berdasarkan kolom Real terisi atau
  // tidak) + urutkan — semua dihitung client-side dari `rows` yang sudah
  // dimuat, tidak perlu fetch ulang ke server.
  const displayRows = React.useMemo(() => {
    let list = rows;
    if (opnameFilter === 'belum') list = list.filter((r) => r.real.trim() === '');
    if (opnameFilter === 'sudah') list = list.filter((r) => r.real.trim() !== '');

    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp: number;
      switch (sortBy) {
        case 'kode':
          cmp = a.kode_brng.localeCompare(b.kode_brng);
          break;
        case 'kategori':
          cmp = a.jenis.localeCompare(b.jenis);
          break;
        case 'satuan':
          cmp = a.satuan.localeCompare(b.satuan);
          break;
        case 'nama':
        default:
          cmp = a.nama_brng.localeCompare(b.nama_brng);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [rows, opnameFilter, sortBy, sortDir]);

  // "Bersihkan Jumlah" — kosongkan semua kolom Real yang sudah diisi,
  // tanpa perlu fetch ulang ke server (padanan tombol Batal per-baris di
  // Java, tapi sekaligus untuk semua baris).
  const handleBersihkanJumlah = () => {
    setRows((prev) => prev.map((r) => ({ ...r, real: '' })));
    setShowFilterDropdown(false);
  };

  // Total nominal hilang/lebih dari seluruh baris yang sudah diisi —
  // padanan label LTotal/LTotal1 (footer "Hilang :"/"Lebih :") di Java,
  // dijumlah ulang dari getData() setiap kali ada perubahan.
  const totals = rows.reduce(
    (acc, r) => {
      const calc = hitung(r);
      if (calc) {
        acc.nomihilang += calc.nomihilang;
        acc.nomilebih += calc.nomilebih;
      }
      return acc;
    },
    { nomihilang: 0, nomilebih: 0 }
  );

  const handleSimpan = async () => {
    if (!kdBangsal) {
      Swal.fire({ icon: 'warning', title: 'Pilih lokasi dulu' });
      return;
    }
    if (!keterangan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Keterangan wajib diisi' });
      return;
    }
    const items = rows
      .filter((r) => r.real.trim() !== '')
      .map((r) => ({
        kode_brng: r.kode_brng,
        no_batch: r.no_batch,
        no_faktur: r.no_faktur,
        h_beli: r.h_beli,
        stok: r.stok,
        real: Number(r.real),
      }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi hasil hitungnya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Opname untuk ${items.length} Barang?`,
      text: 'Stok sistem akan langsung dikoreksi mengikuti hasil hitung fisik ini. Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/stok-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_bangsal: kdBangsal, tanggal, keterangan, petugas: getCurrentPetugas(), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
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
        @keyframes blinkRedField {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field { animation: blinkRedField 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 105, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Lokasi
            {warnLokasi && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnLokasi ? 'blink-red-field' : ''}>
            <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: '- Pilih -' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
          </div>
        </div>
        <div style={{ width: 118, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 150, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Keterangan
            {warnKeterangan && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <input
            style={inputStyle}
            className={warnKeterangan ? 'blink-red-field' : ''}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Opname rutin"
          />
        </div>
        <div style={{ width: 230, flexShrink: 0 }}>
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
        <div ref={filterDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowFilterDropdown((v) => !v)}
            style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            Tampilkan
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>
          {showFilterDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: 220,
                padding: 8,
              }}
            >
              <button
                type="button"
                onClick={handleBersihkanJumlah}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 12.5, textAlign: 'left' }}
              >
                Bersihkan Jumlah
              </button>
              <button
                type="button"
                onClick={() => { setOpnameFilter('semua'); setShowFilterDropdown(false); }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 6, border: 'none', background: opnameFilter === 'semua' ? '#ecfdf5' : 'transparent', color: opnameFilter === 'semua' ? '#059669' : '#374151', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', fontWeight: opnameFilter === 'semua' ? 600 : 400 }}
              >
                Tampilkan Semua Stok
              </button>
              <button
                type="button"
                onClick={() => { setOpnameFilter('belum'); setShowFilterDropdown(false); }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 6, border: 'none', background: opnameFilter === 'belum' ? '#ecfdf5' : 'transparent', color: opnameFilter === 'belum' ? '#059669' : '#374151', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', fontWeight: opnameFilter === 'belum' ? 600 : 400 }}
              >
                Tampilkan Belum Diopname
              </button>
              <button
                type="button"
                onClick={() => { setOpnameFilter('sudah'); setShowFilterDropdown(false); }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 6, border: 'none', background: opnameFilter === 'sudah' ? '#ecfdf5' : 'transparent', color: opnameFilter === 'sudah' ? '#059669' : '#374151', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', fontWeight: opnameFilter === 'sudah' ? 600 : 400 }}
              >
                Tampilkan Sudah Diopname
              </button>
              <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
              <div
                onMouseEnter={() => setShowSortSubmenu(true)}
                onMouseLeave={() => setShowSortSubmenu(false)}
                style={{ position: 'relative' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 8px', borderRadius: 6, background: showSortSubmenu ? '#ecfdf5' : 'transparent', color: showSortSubmenu ? '#059669' : '#374151', cursor: 'default', fontSize: 12.5, boxSizing: 'border-box' }}
                >
                  Urutkan Data Berdasar
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 6 6 6-6 6"></path>
                  </svg>
                </div>
                {showSortSubmenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      paddingLeft: 4,
                      marginLeft: -4,
                      background: 'transparent',
                    }}
                  >
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 101,
                      minWidth: 200,
                      padding: 8,
                    }}
                  >
                    {([
                      ['kode', 'desc', 'Kode Barang Descending'],
                      ['kode', 'asc', 'Kode Barang Ascending'],
                      ['nama', 'desc', 'Nama Barang Descending'],
                      ['nama', 'asc', 'Nama Barang Ascending'],
                      ['kategori', 'asc', 'Kategori Ascending'],
                      ['kategori', 'desc', 'Kategori Descending'],
                      ['satuan', 'desc', 'Satuan Descending'],
                      ['satuan', 'asc', 'Satuan Ascending'],
                    ] as const).map(([field, dir, label]) => {
                      const active = sortBy === field && sortDir === dir;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => { setSortBy(field); setSortDir(dir); setShowSortSubmenu(false); setShowFilterDropdown(false); }}
                          style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 6, border: 'none', background: active ? '#ecfdf5' : 'transparent', color: active ? '#059669' : '#374151', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving || !kdBangsal}
          style={{ padding: '7px 12px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving || !kdBangsal ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Opname'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-start', flexShrink: 0, whiteSpace: 'nowrap' }}>{filledCount} siap disimpan</span>
        {(totals.nomihilang > 0 || totals.nomilebih > 0) && (
          <span style={{ fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {totals.nomihilang > 0 && <span style={{ color: '#dc2626' }}>Hilang: Rp {formatRupiah(totals.nomihilang)}</span>}
            {totals.nomihilang > 0 && totals.nomilebih > 0 && <span style={{ color: '#d1d5db' }}> · </span>}
            {totals.nomilebih > 0 && <span style={{ color: '#059669' }}>Lebih: Rp {formatRupiah(totals.nomilebih)}</span>}
          </span>
        )}
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 60 }}>Real</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kadaluwarsa</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Selisih</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Lebih</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada barang aktif</td></tr>
            ) : (
              displayRows.map((r, index) => {
                const calc = hitung(r);
                return (
                  <tr key={rowKey(r)} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        value={r.real}
                        onChange={(e) => setReal(rowKey(r), e.target.value)}
                        onFocus={guardRealFocus}
                        style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.jenis || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.expire || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' }}>{r.stok}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: calc && calc.selisih > 0 ? '#dc2626' : '#374151', fontWeight: calc && calc.selisih > 0 ? 600 : 400 }}>
                      {calc ? calc.selisih : '-'}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: calc && calc.lebih > 0 ? '#059669' : '#374151', fontWeight: calc && calc.lebih > 0 ? 600 : 400 }}>
                      {calc ? calc.lebih : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---- Tab: Riwayat Opname -------------------------------------------------

type OpnameRiwayat = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  h_beli: number;
  tanggal: string;
  stok: number;
  real: number;
  selisih: number;
  lebih: number;
  total_real: number;
  nomihilang: number;
  nomilebih: number;
  keterangan: string;
  kd_bangsal: string;
  nm_bangsal: string;
  no_batch: string;
  no_faktur: string;
};

const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

const TabRiwayatOpname: React.FC<{ bangsal: KvOpsi[] }> = ({ bangsal }) => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<OpnameRiwayat[]>([]);
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
      let url = `/api/apotek/stok-opname/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
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

  const handleDelete = async (item: OpnameRiwayat) => {
    const confirm = await Swal.fire({
      title: 'Hapus Riwayat Opname Ini?',
      text: `${item.nama_brng} — ${item.tanggal}. Stok sistem TIDAK akan dikembalikan, cuma catatan riwayatnya yang terhapus.`,
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
        tanggal: item.tanggal.slice(0, 10),
        kd_bangsal: item.kd_bangsal,
        no_batch: item.no_batch,
        no_faktur: item.no_faktur,
      });
      const res = await fetch(`/api/apotek/stok-opname?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  // handleCetak — cetak LAPORAN STOK OPNAME (rekap semua riwayat yang
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

    const grandHilang = items.reduce((sum, it) => sum + (it.nomihilang || 0), 0);
    const grandLebih = items.reduce((sum, it) => sum + (it.nomilebih || 0), 0);
    const rowsHtml = items.map((it, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${it.tanggal.slice(0, 10)}</td>
        <td>${it.nama_brng} (${it.satuan})</td>
        <td>${it.nm_bangsal}</td>
        <td style="text-align:right">${it.stok}</td>
        <td style="text-align:right">${it.real}</td>
        <td style="text-align:right">${it.selisih}</td>
        <td style="text-align:right">${it.lebih}</td>
        <td style="text-align:right">${it.nomihilang > 0 ? formatRupiah(it.nomihilang) : '-'}</td>
        <td style="text-align:right">${it.nomilebih > 0 ? formatRupiah(it.nomilebih) : '-'}</td>
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
          <title>Laporan Stok Opname ${tgl1} s.d. ${tgl2}</title>
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
          <center><font color="#000000" size="2" face="Tahoma"><b>LAPORAN STOK OPNAME</b></font></center>
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
                <th>Lokasi</th>
                <th>Stok</th>
                <th>Real</th>
                <th>Selisih</th>
                <th>Lebih</th>
                <th>Nominal Hilang</th>
                <th>Nominal Lebih</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Jumlah Baris</span><span>${items.length}</span></div>
            <div><span>Total Nominal Hilang</span><span>Rp ${formatRupiah(grandHilang)}</span></div>
            <div style="font-weight:bold"><span>Total Nominal Lebih</span><span>Rp ${formatRupiah(grandLebih)}</span></div>
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
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="Kode / nama barang / keterangan..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={handleCetak}
          title="Cetak Laporan Stok Opname"
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Real</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Selisih</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Lebih</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Nominal Hilang</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Nominal Lebih</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Keterangan</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada riwayat opname pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.kode_brng}-${item.tanggal}-${item.kd_bangsal}-${item.no_batch}-${item.no_faktur}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.nama_brng} <span style={{ color: '#9ca3af' }}>({item.satuan})</span>
                    {(item.no_batch || item.no_faktur) && (
                      <div style={{ fontSize: 10.5, color: '#9ca3af' }}>Batch: {item.no_batch || '-'} / Faktur: {item.no_faktur || '-'}</div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.stok}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.real}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.selisih > 0 ? '#dc2626' : '#374151' }}>{item.selisih}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.lebih > 0 ? '#059669' : '#374151' }}>{item.lebih}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.nomihilang > 0 ? `Rp ${formatRupiah(item.nomihilang)}` : '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.nomilebih > 0 ? `Rp ${formatRupiah(item.nomilebih)}` : '-'}</td>
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

// ---- Shell Stok Opname (gabung 2 sub-tab di atas) -----------------------

export const ApotekStokOpnameView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'input' | 'riwayat'>('input');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
  }, []);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'input', label: 'Input Opname' },
    { key: 'riwayat', label: 'Riwayat Opname' },
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
      {subTab === 'input' && <TabInputOpname bangsal={bangsal} />}
      {subTab === 'riwayat' && <TabRiwayatOpname bangsal={bangsal} />}
    </div>
  );
};
