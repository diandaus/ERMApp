import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas, getCurrentUserNip, getCurrentUserRole } from '../utils/currentUser';
import { localDateStr } from '../utils/date';
import { ModalCariPetugas } from '../components/ModalCariPetugas';

// ============================================================================
// APOTEK — Pemesanan (Surat Pesanan Obat-obat Tertentu / Obat Mengandung
// Prekursor Farmasi, ditujukan ke Industri Farmasi/PBF — BUKAN ke
// supplier biasa, lihat catatan kode_industri di
// backend/apotek_pemesanan_handler.go). Cocok dengan
// inventory/InventorySuratPemesanan.java (form buat surat pemesanan) +
// inventory/DlgCariSuratPemesanan.java (daftar riwayat pemesanan). Dua tab
// di sini meniru pemisahan itu: "Surat Pemesanan" dan "Cari Surat
// Pemesanan". BEDA dari ApotekPenerimaan.tsx: Pemesanan cuma dokumen
// permintaan resmi, TIDAK mengubah stok sama sekali — lihat catatan
// lengkap di backend/apotek_pemesanan_handler.go.
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

// terbilang — konversi angka ke bilangan Indonesia (mis. 10 -> "sepuluh"),
// dipakai untuk kolom "Terbilang" di tabel Surat Pesanan Obat-obat
// Tertentu (format resmi BPOM/Kemenkes: No. | Nama Obat-Obat Tertentu |
// Zat Aktif | Bentuk dan Kekuatan Sediaan | Satuan/Kemasan | Jumlah |
// Terbilang). Dihitung otomatis dari Jumlah, bukan field database.
const SATUAN_KATA = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num < 12) return SATUAN_KATA[num];
  if (num < 20) return `${terbilang(num - 10)} belas`;
  if (num < 100) return `${terbilang(Math.floor(num / 10))} puluh${num % 10 !== 0 ? ` ${terbilang(num % 10)}` : ''}`;
  if (num < 200) return `seratus${num % 100 !== 0 ? ` ${terbilang(num % 100)}` : ''}`;
  if (num < 1000) return `${terbilang(Math.floor(num / 100))} ratus${num % 100 !== 0 ? ` ${terbilang(num % 100)}` : ''}`;
  if (num < 2000) return `seribu${num % 1000 !== 0 ? ` ${terbilang(num % 1000)}` : ''}`;
  if (num < 1000000) return `${terbilang(Math.floor(num / 1000))} ribu${num % 1000 !== 0 ? ` ${terbilang(num % 1000)}` : ''}`;
  if (num < 1000000000) return `${terbilang(Math.floor(num / 1000000))} juta${num % 1000000 !== 0 ? ` ${terbilang(num % 1000000)}` : ''}`;
  return String(num);
}

type KvOpsi = { kode: string; nama: string };

// ---- Tab: Surat Pemesanan --------------------------------------------------

type BarangOpsi = { kode_brng: string; nama_brng: string; kode_sat: string; satuan: string; h_beli: number; kapasitas: number };
type ZatAktifLine = { zatAktif: string; bentukKekuatan: string };
type PemesananRow = BarangOpsi & { jumlah: string; harga: string; dis: string; zatAktifList: ZatAktifLine[] };

const JENIS_SURAT_OPTIONS: { key: 'obat_tertentu' | 'prekursor'; label: string }[] = [
  { key: 'obat_tertentu', label: 'Obat-obat Tertentu' },
  { key: 'prekursor', label: 'Obat Mengandung Prekursor Farmasi' },
];

const TabSuratPemesanan: React.FC = () => {
  const [jenisSurat, setJenisSurat] = React.useState<'obat_tertentu' | 'prekursor'>('obat_tertentu');
  const [noPemesanan, setNoPemesanan] = React.useState('');
  const noPemesananManual = React.useRef(false);
  const [kodeIndustri, setKodeIndustri] = React.useState('');
  const [industriList, setIndustriList] = React.useState<KvOpsi[]>([]);
  const [tanggal, setTanggal] = React.useState(todayStr());
  const [ppnPercent, setPpnPercent] = React.useState('11');
  const [meterai, setMeterai] = React.useState('0');
  const [orderRows, setOrderRows] = React.useState<PemesananRow[]>([]);
  const [search, setSearch] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<BarangOpsi[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [warnIndustri, setWarnIndustri] = React.useState(false);

  // Nama Petugas — default otomatis dari user yang sedang login (sama
  // pola dengan penandatangan cetak di DetailPemberianObat.tsx), sesuai
  // alur Surat Pesanan Obat Tertentu/Prekursor: No.Surat -> Petugas
  // (auto) -> Nama Industri -> baru pilih obat. KHUSUS akun role
  // 'admin', field ini tetap bisa diganti manual lewat ModalCariPetugas
  // (mis. admin mengisi form atas nama staf farmasi tertentu) — akun
  // non-admin tetap terkunci ke identitasnya sendiri, sama pola dengan
  // isDokterLocked di App.tsx/RawatInap.tsx (field terkunci berdasarkan
  // role, bukan hardcode per-form).
  const isAdmin = getCurrentUserRole() === 'admin';
  const [nip, setNip] = React.useState(() => getCurrentUserNip());
  const [namaPetugas, setNamaPetugas] = React.useState(() => getCurrentPetugas() || '-');
  const [petugasPickerOpen, setPetugasPickerOpen] = React.useState(false);

  // Nama Industri yang Dituju — padanan picker "Cari Industri Farmasi" di
  // InventorySuratPemesanan.java (select * from industrifarmasi order by
  // nama_industri), BUKAN tabel datasuplier (lihat catatan besar di
  // backend/apotek_pemesanan_handler.go soal kolom kode_industri).
  React.useEffect(() => {
    fetch('/api/apotek/pemesanan/industri-opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIndustriList(Array.isArray(data) ? data.map((s: any) => ({ kode: s.kode_industri, nama: s.nama_industri })) : []))
      .catch(() => {});
  }, []);

  // fetchNextNo — preview No.Surat berikutnya dari backend
  // (GET /pemesanan/next-no), supaya field "No. Surat" otomatis terisi
  // begitu tanggal dipilih, TAPI tetap bisa ditimpa manual (noManual
  // ref mencegah auto-fill menimpa ketikan user).
  const fetchNextNo = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/apotek/pemesanan/next-no?tanggal=${tanggal}`);
      const data = await res.json();
      if (data.no_pemesanan) setNoPemesanan(data.no_pemesanan);
    } catch {
      // biarkan kosong kalau gagal — user masih bisa isi manual
    }
  }, [tanggal]);

  React.useEffect(() => {
    if (!noPemesananManual.current) fetchNextNo();
  }, [fetchNextNo]);

  // Pencarian & tambah obat — pola typeahead sama dengan "Cari Obat" di
  // ResepModal.tsx (ketik, dropdown hasil muncul di bawah input, klik
  // satu baris -> langsung masuk ke tabel di bawah, input kembali
  // kosong & fokus siap untuk pencarian berikutnya) — BUKAN modal
  // terpisah, supaya alurnya konsisten dengan pola yang sudah dikenal
  // user di form resep.
  React.useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(true);
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/apotek/pemesanan/barang-opsi?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAddObat = (item: BarangOpsi) => {
    setOrderRows((prev) => {
      if (prev.some((r) => r.kode_brng === item.kode_brng)) return prev;
      return [...prev, { ...item, jumlah: '1', harga: String(item.h_beli || ''), dis: '', zatAktifList: [{ zatAktif: '', bentukKekuatan: item.kapasitas ? String(item.kapasitas) : '' }] }];
    });
    setSearch('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (kodeBrng: string) => {
    setOrderRows((prev) => prev.filter((r) => r.kode_brng !== kodeBrng));
  };

  const setField = (kodeBrng: string, field: 'jumlah' | 'harga' | 'dis', value: string) => {
    setOrderRows((prev) => prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, [field]: value } : r)));
  };

  // setZatAktifAt/addZatAktifLine/removeZatAktifLine — dipakai KEDUA
  // tabel untuk kolom Zat Aktif/Bentuk & Kekuatan Sediaan, TAPI tombol
  // tambah/hapus baris zat aktif hanya dimunculkan di tabel Prekursor
  // Farmasi (produk kombinasi seperti pseudoefedrin+triprolidin butuh >1
  // baris zat aktif per obat). Tabel Obat-obat Tertentu selalu cuma
  // pakai zatAktifList[0], baris tambahan (kalau ada secara data) tidak
  // ditampilkan di tabel itu.
  const setZatAktifAt = (kodeBrng: string, index: number, field: 'zatAktif' | 'bentukKekuatan', value: string) => {
    setOrderRows((prev) =>
      prev.map((r) => {
        if (r.kode_brng !== kodeBrng) return r;
        const list = r.zatAktifList.map((l, i) => (i === index ? { ...l, [field]: value } : l));
        return { ...r, zatAktifList: list };
      })
    );
  };

  const addZatAktifLine = (kodeBrng: string) => {
    setOrderRows((prev) =>
      prev.map((r) => (r.kode_brng === kodeBrng ? { ...r, zatAktifList: [...r.zatAktifList, { zatAktif: '', bentukKekuatan: '' }] } : r))
    );
  };

  const removeZatAktifLine = (kodeBrng: string, index: number) => {
    setOrderRows((prev) =>
      prev.map((r) => {
        if (r.kode_brng !== kodeBrng) return r;
        if (r.zatAktifList.length <= 1) return r;
        return { ...r, zatAktifList: r.zatAktifList.filter((_, i) => i !== index) };
      })
    );
  };

  const guardFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!kodeIndustri) {
      e.target.blur();
      setWarnIndustri(true);
      setTimeout(() => setWarnIndustri(false), 1500);
    }
  };

  const filledRows = orderRows.filter((r) => r.jumlah.trim() !== '' && Number(r.jumlah) > 0);
  const meteraiAmount = Number(meterai || 0);

  const handleBersihkan = () => {
    setOrderRows([]);
    setMeterai('0');
  };

  const handleSimpan = async () => {
    if (!kodeIndustri) {
      Swal.fire({ icon: 'warning', title: 'Pilih Nama Industri yang dituju dulu' });
      return;
    }
    if (!noPemesanan.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Surat wajib diisi' });
      return;
    }
    const items = filledRows.map((r) => ({
      kode_brng: r.kode_brng,
      kode_sat: r.kode_sat,
      jumlah: Number(r.jumlah),
      h_pesan: Number(r.harga || 0),
      dis: Number(r.dis || 0),
      zat_aktif_list: r.zatAktifList.map((l) => ({ zat_aktif: l.zatAktif, bentuk_kekuatan: l.bentukKekuatan })),
    }));
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum ada barang yang diisi jumlah pemesanannya' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Simpan Surat Pemesanan untuk ${items.length} Barang?`,
      text: 'Stok TIDAK berubah — hanya membuat dokumen surat pesanan resmi ke industri farmasi.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apotek/pemesanan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_pemesanan: noPemesanan.trim(), jenis_surat: jenisSurat, kode_industri: kodeIndustri, nip, tanggal, ppn_percent: Number(ppnPercent || 0), meterai: meteraiAmount, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      handleBersihkan();
      noPemesananManual.current = false;
      fetchNextNo();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `No. Pemesanan: ${data.no_pemesanan}`, timer: 3500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blinkRedFieldPemesanan {
          0%, 100% { background-color: transparent; box-shadow: none; }
          50% { background-color: #fee2e2; box-shadow: 0 0 0 2px #dc2626; }
        }
        .blink-red-field-pemesanan { animation: blinkRedFieldPemesanan 0.4s ease-in-out 3; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2, minWidth: 0, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ width: 210, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis Surat</label>
          <PillSelect
            value={jenisSurat}
            onChange={(v) => setJenisSurat(v as 'obat_tertentu' | 'prekursor')}
            options={JENIS_SURAT_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
          />
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No. Surat</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={noPemesanan}
              onChange={(e) => { setNoPemesanan(e.target.value); noPemesananManual.current = true; }}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => { noPemesananManual.current = false; fetchNextNo(); }}
              title="Generate ulang No. Surat"
              style={{ padding: '0 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
            >
              ↻
            </button>
          </div>
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nama Petugas</label>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={{ ...inputStyle, background: '#f3f4f6', color: '#374151', display: 'flex', alignItems: 'center', boxSizing: 'border-box', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {namaPetugas}
              </div>
              <button
                type="button"
                onClick={() => setPetugasPickerOpen(true)}
                title="Ganti petugas"
                style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: 4, background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ ...inputStyle, background: '#f3f4f6', color: '#374151', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
              {namaPetugas}
            </div>
          )}
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Industri Farmasi
            {warnIndustri && <span style={{ color: '#dc2626', marginLeft: 6 }}>! Wajib isi</span>}
          </label>
          <div className={warnIndustri ? 'blink-red-field-pemesanan' : ''}>
            <PillSelect value={kodeIndustri} onChange={setKodeIndustri} options={[{ value: '', label: '- Pilih -' }, ...industriList.map((s) => ({ value: s.kode, label: s.nama }))]} />
          </div>
        </div>
        <div style={{ width: 115, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, padding: '7px 8px' }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div style={{ width: 65, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>PPN %</label>
          <input type="number" step="any" style={inputStyle} value={ppnPercent} onChange={(e) => setPpnPercent(e.target.value)} />
        </div>
        <div style={{ width: 90, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Meterai</label>
          <input type="number" step="any" style={inputStyle} value={meterai} onChange={(e) => setMeterai(e.target.value)} />
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari &amp; Tambah Obat</label>
        <div style={{ position: 'relative', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            placeholder="Ketik kode / nama obat untuk mencari otomatis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={guardFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            style={{ ...inputStyle, paddingLeft: 30, maxWidth: 420 }}
          />
        </div>

        {showDropdown && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 420, maxWidth: '100%',
              background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto', zIndex: 50,
            }}
          >
            {searchLoading ? (
              <div style={{ padding: 14, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Mencari...</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada obat ditemukan</div>
            ) : (
              searchResults.map((it) => {
                const added = orderRows.some((r) => r.kode_brng === it.kode_brng);
                return (
                  <div
                    key={it.kode_brng}
                    onMouseDown={(e) => { e.preventDefault(); if (!added) handleAddObat(it); }}
                    style={{
                      padding: '8px 12px', cursor: added ? 'default' : 'pointer', borderBottom: '1px solid #f3f4f6',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      background: added ? '#ecfdf5' : '#ffffff',
                    }}
                    onMouseEnter={(e) => { if (!added) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { if (!added) e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{it.nama_brng}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Kode: {it.kode_brng} · Satuan: {it.satuan || '-'}</div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: added ? '#059669' : '#9ca3af' }}>
                      {added ? '✓ Ditambahkan' : '+ Tambah'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          {jenisSurat === 'obat_tertentu' ? (
            <>
              {/* Format resmi Surat Pesanan Obat-obat Tertentu: No. | Nama
                  Obat-Obat Tertentu | Zat Aktif | Bentuk dan Kekuatan
                  Sediaan | Satuan/Kemasan | Jumlah | Terbilang. Bentuk
                  dan Kekuatan Sediaan di-default dari databarang.kapasitas
                  (tetap bisa diedit manual karena kapasitas belum tentu
                  terisi rapi untuk semua barang); Zat Aktif TIDAK ada
                  field padanannya di skema databarang sama sekali, jadi
                  tetap murni manual. Terbilang dihitung otomatis dari
                  Jumlah. */}
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 36 }}>No.</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Obat-Obat Tertentu</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 150 }}>Zat Aktif</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 170 }}>Bentuk dan Kekuatan Sediaan</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 110 }}>Satuan/Kemasan</th>
                  <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 70 }}>Jumlah</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 150 }}>Terbilang</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {orderRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada obat dipilih. Gunakan kolom pencarian di atas untuk menambahkan.</td></tr>
                ) : (
                  orderRows.map((r, index) => (
                    <tr key={r.kode_brng} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>{index + 1}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.nama_brng}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>
                        <input
                          type="text"
                          value={r.zatAktifList[0].zatAktif}
                          onChange={(e) => setZatAktifAt(r.kode_brng, 0, 'zatAktif', e.target.value)}
                          placeholder="cth. Tramadol HCl"
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>
                        <input
                          type="text"
                          value={r.zatAktifList[0].bentukKekuatan}
                          onChange={(e) => setZatAktifAt(r.kode_brng, 0, 'bentukKekuatan', e.target.value)}
                          placeholder="cth. Tablet 50mg"
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.satuan}</td>
                      <td style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="any"
                          value={r.jumlah}
                          onChange={(e) => setField(r.kode_brng, 'jumlah', e.target.value)}
                          style={{ width: 60, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontStyle: 'italic', textTransform: 'capitalize' }}>
                        {r.jumlah.trim() !== '' && Number(r.jumlah) > 0 ? terbilang(Number(r.jumlah)) : '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(r.kode_brng)}
                          title="Hapus dari pesanan"
                          style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          ) : (
            <>
              {/* Format resmi Surat Pesanan Obat Mengandung Prekursor
                  Farmasi: No. | Nama Obat Mengandung Prekursor Farmasi |
                  Zat Aktif Prekursor Farmasi | Bentuk dan Kekuatan
                  Sediaan | Satuan | Jumlah Dengan Angka. Sama seperti
                  tabel Obat-obat Tertentu: Bentuk dan Kekuatan Sediaan
                  di-default dari databarang.kapasitas (tetap bisa
                  diedit), Zat Aktif tetap manual. TIDAK ada kolom
                  Terbilang di format ini (beda dengan Obat-obat
                  Tertentu).
                  Satu obat kombinasi bisa punya >1 zat aktif (mis.
                  pseudoefedrin HCl + triprolidin dalam satu produk flu),
                  jadi kolom Zat Aktif & Bentuk-Kekuatan Sediaan bisa
                  py beberapa baris per obat (rowSpan pada kolom
                  No./Nama/Satuan/Jumlah/Hapus supaya tidak berulang). */}
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 36 }}>No.</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Obat Mengandung Prekursor Farmasi</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 170 }}>Zat Aktif Prekursor Farmasi</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 170 }}>Bentuk dan Kekuatan Sediaan</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 46 }}></th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 90 }}>Satuan</th>
                  <th style={{ padding: '8px 6px 8px 4px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', width: 130 }}>Jumlah Dengan Angka</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {orderRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada obat dipilih. Gunakan kolom pencarian di atas untuk menambahkan.</td></tr>
                ) : (
                  orderRows.map((r, index) => {
                    const n = r.zatAktifList.length;
                    const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                    return (
                      <React.Fragment key={r.kode_brng}>
                        {r.zatAktifList.map((line, li) => (
                          <tr key={`${r.kode_brng}-${li}`} style={{ background: rowBg }}>
                            {li === 0 && (
                              <>
                                <td rowSpan={n} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', verticalAlign: 'top' }}>{index + 1}</td>
                                <td rowSpan={n} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', verticalAlign: 'top' }}>{r.nama_brng}</td>
                              </>
                            )}
                            <td style={{ padding: '4px 6px', borderBottom: li === n - 1 ? '1px solid #e5e7eb' : '1px dashed #e5e7eb' }}>
                              <input
                                type="text"
                                value={line.zatAktif}
                                onChange={(e) => setZatAktifAt(r.kode_brng, li, 'zatAktif', e.target.value)}
                                placeholder="cth. Pseudoefedrin HCl"
                                style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                              />
                            </td>
                            <td style={{ padding: '4px 6px', borderBottom: li === n - 1 ? '1px solid #e5e7eb' : '1px dashed #e5e7eb' }}>
                              <input
                                type="text"
                                value={line.bentukKekuatan}
                                onChange={(e) => setZatAktifAt(r.kode_brng, li, 'bentukKekuatan', e.target.value)}
                                placeholder="cth. Tablet 60mg"
                                style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                              />
                            </td>
                            <td style={{ padding: '4px 2px', borderBottom: li === n - 1 ? '1px solid #e5e7eb' : '1px dashed #e5e7eb', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {li === n - 1 && (
                                <button
                                  type="button"
                                  onClick={() => addZatAktifLine(r.kode_brng)}
                                  title="Tambah zat aktif lain (obat kombinasi)"
                                  style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1 }}
                                >
                                  +
                                </button>
                              )}
                              {n > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeZatAktifLine(r.kode_brng, li)}
                                  title="Hapus baris zat aktif ini"
                                  style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 13, lineHeight: 1, marginLeft: 2 }}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                            {li === 0 && (
                              <>
                                <td rowSpan={n} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', verticalAlign: 'top' }}>{r.satuan}</td>
                                <td rowSpan={n} style={{ padding: '4px 6px 4px 4px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', verticalAlign: 'top' }}>
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.jumlah}
                                    onChange={(e) => setField(r.kode_brng, 'jumlah', e.target.value)}
                                    style={{ width: 70, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                </td>
                                <td rowSpan={n} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'top' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(r.kode_brng)}
                                    title="Hapus obat ini dari pesanan"
                                    style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                                  >
                                    ×
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', gap: 14, flex: 1 }}>
          <span>{orderRows.length} obat dipesan</span>
        </div>
        <button type="button" onClick={handleBersihkan} style={{ padding: '8px 14px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}>
          Bersihkan
        </button>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{ padding: '8px 14px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Pemesanan'}
        </button>
      </div>

      {isAdmin && (
        <ModalCariPetugas
          isOpen={petugasPickerOpen}
          onClose={() => setPetugasPickerOpen(false)}
          onSelect={(selectedNip, selectedNama) => { setNip(selectedNip); setNamaPetugas(selectedNama); }}
        />
      )}
    </div>
  );
};

// ---- Tab: Cari Surat Pemesanan --------------------------------------------

// ZatAktifLineApi — bentuk snake_case field zat aktif persis seperti yang
// dikirim/diterima backend (beda dari ZatAktifLine di TabSuratPemesanan
// yang camelCase, mengikuti konvensi state React di sana).
type ZatAktifLineApi = { zat_aktif: string; bentuk_kekuatan: string };

type PemesananDetailItem = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jumlah: number;
  h_pesan: number;
  subtotal: number;
  dis: number;
  besardis: number;
  total: number;
  zat_aktif_list: ZatAktifLineApi[];
};
type PemesananRiwayat = {
  no_pemesanan: string;
  jenis_surat: 'obat_tertentu' | 'prekursor';
  tanggal: string;
  kode_industri: string;
  nama_industri: string;
  alamat_industri: string;
  kota_industri: string;
  telp_industri: string;
  nip: string;
  nama_petugas: string;
  alamat_petugas: string;
  jabatan_petugas: string;
  sipa_petugas: string;
  total1: number;
  potongan: number;
  total2: number;
  ppn: number;
  meterai: number;
  tagihan: number;
  status: string;
  items: PemesananDetailItem[];
};

const JENIS_SURAT_LABEL: Record<string, string> = {
  obat_tertentu: 'Obat-obat Tertentu',
  prekursor: 'Prekursor Farmasi',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  'Proses Pesan': { bg: '#fef3c7', text: '#92400e' },
  'Sudah Datang': { bg: '#d1fae5', text: '#065f46' },
};

const TabCariSuratPemesanan: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [status, setStatus] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<PemesananRiwayat[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<{ nama_instansi: string; alamat: string; logo_url: string; kota_rs: string; kontak: string; email_rs: string; nomor_izin_sarana: string }>({
    nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '', nomor_izin_sarana: '',
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
      let url = `/api/apotek/pemesanan/riwayat?tgl1=${tgl1}&tgl2=${tgl2}`;
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
  }, [tgl1, tgl2, status, searchText]);

  React.useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  const handleTandaiDatang = async (item: PemesananRiwayat) => {
    const confirm = await Swal.fire({
      title: `Tandai ${item.no_pemesanan} sebagai "Sudah Datang"?`,
      text: 'Ini cuma penanda administratif — stok TIDAK otomatis bertambah. Input Penerimaan Barang secara terpisah saat barang fisik diterima.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Tandai',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/pemesanan/${encodeURIComponent(item.no_pemesanan)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Sudah Datang' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status');
      await fetchRiwayat();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const handleHapus = async (item: PemesananRiwayat) => {
    const confirm = await Swal.fire({
      title: `Hapus Surat Pemesanan ${item.no_pemesanan}?`,
      text: 'Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/pemesanan/${encodeURIComponent(item.no_pemesanan)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchRiwayat();
      Swal.fire({ icon: 'success', title: 'Berhasil dihapus', timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  // handleCetak — cetak "SURAT PEMESANAN" (kop RS + tabel item + tanda
  // tangan petugas), pola print-HTML browser sama dengan
  // DetailPemberianObat.tsx (window.open + document.write + print()
  // bawaan browser). Disederhanakan dari Jasper Java yang minta 2 tanda
  // tangan (Apoteker+Kabid.Keu lewat DlgCariPegawai) jadi 1 tanda tangan
  // (petugas yang mengisi form) — dokumen ini surat internal ke supplier,
  // bukan dokumen medis pasien yang butuh e-signature/QR seperti Rincian
  // Pemakaian Obat.
  const handleCetak = (item: PemesananRiwayat) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean)
      .join(', ');
    const namaPenandatangan = getCurrentPetugas() || '-';
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const kotaTanggal = settings.kota_rs ? `${settings.kota_rs}, ${tanggalCetak}` : tanggalCetak;

    // Format cetak beda per jenis_surat, mengikuti struktur tabel yang
    // sama dengan tampilan form Surat Pemesanan (lihat TabSuratPemesanan):
    // Obat-obat Tertentu selalu 1 baris zat aktif per obat + kolom
    // Terbilang, Prekursor Farmasi bisa >1 baris zat aktif per obat
    // (rowspan) tanpa kolom Terbilang. Tidak ada harga/tagihan di kedua
    // format — surat ini dokumen permintaan resmi, bukan invoice.
    const isObatTertentu = item.jenis_surat === 'obat_tertentu';
    const heading = isObatTertentu ? 'SURAT PESANAN OBAT-OBAT TERTENTU' : 'SURAT PESANAN OBAT MENGANDUNG PREKURSOR FARMASI';

    const theadHtml = isObatTertentu
      ? `<tr><th>No.</th><th>Nama Obat-Obat Tertentu</th><th>Zat Aktif</th><th>Bentuk dan Kekuatan Sediaan</th><th>Satuan/Kemasan</th><th>Jumlah</th><th>Terbilang</th></tr>`
      : `<tr><th>No.</th><th>Nama Obat Mengandung Prekursor Farmasi</th><th>Zat Aktif Prekursor Farmasi</th><th>Bentuk dan Kekuatan Sediaan</th><th>Satuan</th><th>Jumlah Dengan Angka</th></tr>`;

    const rowsHtml = isObatTertentu
      ? item.items.map((it, index) => {
          const line = it.zat_aktif_list[0] || { zat_aktif: '', bentuk_kekuatan: '' };
          return `
            <tr>
              <td style="text-align:center">${index + 1}</td>
              <td>${it.nama_brng}</td>
              <td>${line.zat_aktif || '-'}</td>
              <td>${line.bentuk_kekuatan || '-'}</td>
              <td>${it.satuan}</td>
              <td style="text-align:right">${formatRupiah(it.jumlah)}</td>
              <td style="text-transform:capitalize">${it.jumlah > 0 ? terbilang(it.jumlah) : '-'}</td>
            </tr>
          `;
        }).join('')
      : item.items.map((it, index) => {
          const lines = it.zat_aktif_list.length > 0 ? it.zat_aktif_list : [{ zat_aktif: '-', bentuk_kekuatan: '-' }];
          return lines.map((l, li) => `
            <tr>
              ${li === 0 ? `<td style="text-align:center" rowspan="${lines.length}">${index + 1}</td>` : ''}
              ${li === 0 ? `<td rowspan="${lines.length}">${it.nama_brng}</td>` : ''}
              <td>${l.zat_aktif || '-'}</td>
              <td>${l.bentuk_kekuatan || '-'}</td>
              ${li === 0 ? `<td rowspan="${lines.length}">${it.satuan}</td>` : ''}
              ${li === 0 ? `<td style="text-align:right" rowspan="${lines.length}">${formatRupiah(it.jumlah)}</td>` : ''}
            </tr>
          `).join('');
        }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${heading} - ${item.no_pemesanan}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            .info { margin: 10px 0; font-size: 12px; }
            .info div { margin-bottom: 2px; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.tbl_data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            table.tbl_data th, table.tbl_data td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
            table.tbl_data th { background: #f3f4f6; }
            table.tbl_pihak { border-collapse: collapse; margin: 4px 0 4px 20px; }
            table.tbl_pihak td { border: 0; padding: 1px 4px 1px 0; vertical-align: top; font-size: 12px; }
            table.tbl_pihak td.label { width: 190px; }
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
          <center><font color="#000000" size="2" face="Tahoma"><b>${heading}</b></font></center>
          <center><font color="#000000" size="1" face="Tahoma">Nomor : ${item.no_pemesanan}</font></center>
          
          <div class="info">
            <div>Yang bertanda tangan dibawah ini :</div>
            <table class="tbl_pihak">
              <tr><td class="label">Nama</td><td>: ${item.nama_petugas || '-'}</td></tr>
              <tr><td class="label">Alamat</td><td>: ${item.alamat_petugas || '-'}</td></tr>
              <tr><td class="label">Jabatan</td><td>: ${item.jabatan_petugas || '-'}</td></tr>
              <tr><td class="label">SIPA</td><td>: ${item.sipa_petugas || '-'}</td></tr>
            </table>
            <div>Mengajukan permohonan kepada :</div>
            <table class="tbl_pihak">
              <tr><td class="label">Nama Industri Farmasi/PBF</td><td>: ${item.nama_industri || '-'}</td></tr>
              <tr><td class="label">Alamat Lengkap</td><td>: ${[item.alamat_industri, item.kota_industri].filter(Boolean).join(', ') || '-'}</td></tr>
              <tr><td class="label">Telp</td><td>: ${item.telp_industri || '-'}</td></tr>
            </table>
          </div>
          ${isObatTertentu ? `<div class="info"><div>Jenis Obat-Obat Tertentu yang di pesan adalah :</div></div>` : ''}
          <table class="tbl_data">
            <thead>
              ${theadHtml}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${isObatTertentu ? `
            <div class="info">
              <div>Obat-Obat Tertentu tersebut akan di gunakan untuk memenuhi kebutuhan :</div>
              <table class="tbl_pihak">
                <tr><td class="label">Nama Sarana</td><td>: ${settings.nama_instansi || '-'}</td></tr>
                <tr><td class="label">Alamat Lengkap</td><td>: ${settings.alamat || '-'}</td></tr>
                <tr><td class="label">Nomor Izin Sarana</td><td>: ${settings.nomor_izin_sarana || '-'}</td></tr>
              </table>
            </div>
          ` : ''}

          <div style="width:220px; margin:32px 40px 0 auto; text-align:center;">
            <div>${kotaTanggal}</div>
            <div>Pemesan</div>
            <div style="height:60px;"></div>
            <div style="font-weight:bold; text-decoration:underline;">${namaPenandatangan}</div>
            <div>SIPA : ${item.sipa_petugas || '-'}</div>
          </div>

          <div style="margin-top:16px; font-size:10px; font-style:italic;">
            <div>Catatan :</div>
            <div>1. Jumlah Produk ditulis dalam bentuk angka dan huruf</div>
            <div>2. Surat Pesanan hanya berlaku 7 hari dari tanggal terbit</div>
            <div>3. Surat pesanan di buat sekurang-kurangnya 3 rangkap</div>
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
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 170 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <PillSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Proses Pesan', label: 'Proses Pesan' },
              { value: 'Sudah Datang', label: 'Sudah Datang' },
            ]}
          />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="No. Pemesanan / industri farmasi / petugas..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Pemesanan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Industri Farmasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Surat</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada pemesanan pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => {
                const isOpen = expanded === item.no_pemesanan;
                const sc = STATUS_COLOR[item.status] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <React.Fragment key={item.no_pemesanan}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.no_pemesanan)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggal.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_pemesanan}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_industri}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_petugas}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{JENIS_SURAT_LABEL[item.jenis_surat] || item.jenis_surat}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text }}>{item.status}</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => handleCetak(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                            Cetak
                          </button>
                          {item.status === 'Proses Pesan' && (
                            <button type="button" onClick={() => handleTandaiDatang(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              Tandai Datang
                            </button>
                          )}
                          <button type="button" onClick={() => handleHapus(item)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 8 }}>
                            <thead>
                              <tr style={{ color: '#6b7280' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Zat Aktif</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Bentuk &amp; Kekuatan Sediaan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it) => {
                                const lines = it.zat_aktif_list.length > 0 ? it.zat_aktif_list : [{ zat_aktif: '-', bentuk_kekuatan: '-' }];
                                return lines.map((l, li) => (
                                  <tr key={`${it.kode_brng}-${li}`}>
                                    {li === 0 && (
                                      <td rowSpan={lines.length} style={{ padding: '3px 6px', color: '#111827', verticalAlign: 'top' }}>{it.nama_brng}</td>
                                    )}
                                    <td style={{ padding: '3px 6px', color: '#374151' }}>{l.zat_aktif || '-'}</td>
                                    <td style={{ padding: '3px 6px', color: '#374151' }}>{l.bentuk_kekuatan || '-'}</td>
                                    {li === 0 && (
                                      <>
                                        <td rowSpan={lines.length} style={{ padding: '3px 6px', color: '#374151', verticalAlign: 'top' }}>{it.satuan}</td>
                                        <td rowSpan={lines.length} style={{ padding: '3px 6px', textAlign: 'right', color: '#374151', verticalAlign: 'top' }}>{it.jumlah}</td>
                                      </>
                                    )}
                                  </tr>
                                ));
                              })}
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
    </div>
  );
};

// ---- Shell PemesananApotek (gabung 2 tab di atas) --------------------------

export const PemesananApotekView: React.FC = () => {
  const [tab, setTab] = React.useState<'surat' | 'cari'>('surat');

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'surat', label: 'Surat Pemesanan' },
    { key: 'cari', label: 'Cari Surat Pemesanan' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? '#059669' : '#6b7280',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'surat' && <TabSuratPemesanan />}
      {tab === 'cari' && <TabCariSuratPemesanan />}
    </div>
  );
};
