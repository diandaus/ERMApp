import React from 'react';
import Swal from 'sweetalert2';
import { AkunPeruriView } from './AkunPeruri';
import { buildDokumenPasienPdf } from './peruriDokumenPasienPdf';
import { ModalCariDokter } from '../components/ModalCariDokter';
import { ModalCariCaraBayar } from '../components/ModalCariCaraBayar';
import { inputUlangOtp, kdDokterDariNamaRingkasan, opsiSimpanRingkasan, tandaTanganRingkasan, tandaTanganRingkasanMassal, unduhDokumenTte, unduhDokumenTteMassal } from './peruriTteRingkasan';

// Peruri.tsx — shell sidebar modul Bridging Peruri (integrasi TTE/e-meterai
// PERURI), dibuka fullscreen dari Bridging.tsx (persis pola BridgingBpjsView/
// SatuSehatView — <PeruriView onBack={...}> dibungkus position:fixed inset:0
// di Bridging.tsx). Tahap ini BARU shell (Dashboard + Penyimpanan Berkas Digital +
// Pengaturan), menu lain menyusul.

// LihatDokumenSection — daftar file dibaca LANGSUNG dari folder server
// webapps (bukan dari tabel DB manapun — ERMApp tidak mencatat riwayat
// auto-upload TTE sendiri, lihat komentar downloadPeruriDocument di
// peruri_handler.go), lewat GET /api/peruri/dokumen/list. Cuma didukung
// mode LOKAL server webapps (backend & webapps satu server); mode remote
// dibalas error jelas oleh backend.
type PeruriDokumenFile = { name: string; size: number; modified_at: string; url: string };

const FOLDER_OPTIONS: { key: string; label: string }[] = [
  { key: 'berkasrawat', label: 'Berkas Rawat (hasil TTE Lab/Radiologi)' },
  { key: 'radiologi', label: 'Radiologi' },
];

const formatUkuran = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const LihatDokumenSection: React.FC = () => {
  const [folder, setFolder] = React.useState('berkasrawat');
  const [search, setSearch] = React.useState('');
  const [files, setFiles] = React.useState<PeruriDokumenFile[]>([]);
  const [dir, setDir] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deletingName, setDeletingName] = React.useState<string | null>(null);
  // Daftar file baru dimuat setelah user klik "Tampilkan" (tidak auto-load).
  const [loaded, setLoaded] = React.useState(false);

  const fetchFiles = React.useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ folder });
    if (search.trim()) params.set('search', search.trim());
    fetch(`/api/peruri/dokumen/list?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar file');
        setFiles(Array.isArray(data.files) ? data.files : []);
        setDir(data.dir || '');
        setLoaded(true);
      })
      .catch((err) => { setFiles([]); setError(err instanceof Error ? err.message : 'Terjadi kesalahan'); })
      .finally(() => setLoading(false));
  }, [folder, search]);

  // Ganti folder → kosongkan daftar lama supaya aksi Hapus tidak salah folder.
  React.useEffect(() => {
    setLoaded(false);
    setFiles([]);
    setDir('');
    setError('');
  }, [folder]);

  const handleHapus = async (name: string) => {
    const result = await Swal.fire({
      icon: 'warning', title: 'Hapus File?',
      html: `File <b>${name}</b> akan dihapus permanen dari server webapps.`,
      showCancelButton: true, confirmButtonColor: '#dc2626', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    setDeletingName(name);
    try {
      const params = new URLSearchParams({ folder, name });
      const res = await fetch(`/api/peruri/dokumen?${params}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus file');
      setFiles((prev) => prev.filter((f) => f.name !== name));
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'File dihapus', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff' }}
        >
          {FOLDER_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Cari nama file..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) fetchFiles(); }}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
        />
        <button
          type="button"
          onClick={fetchFiles}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#a7f3d0' : '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Memuat...' : 'Tampilkan'}
        </button>
      </div>

      {dir && !error && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{dir}</div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>No</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Nama File</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Ukuran</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Terakhir Diubah</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Memuat...</td></tr>
            ) : !loaded && !error ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Klik "Tampilkan" untuk memuat daftar dokumen</td></tr>
            ) : !error && files.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada file di folder ini</td></tr>
            ) : (
              files.map((f, i) => (
                <tr key={f.name} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', wordBreak: 'break-all' }}>{f.name}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatUkuran(f.size)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{f.modified_at}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', color: '#059669', fontSize: 11.5, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginRight: 6 }}
                    >
                      Buka
                    </a>
                    <button
                      type="button"
                      onClick={() => handleHapus(f.name)}
                      disabled={deletingName === f.name}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626',
                        background: '#fff', color: '#dc2626', fontSize: 11.5, fontWeight: 600,
                        cursor: deletingName === f.name ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {deletingName === f.name ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loaded && !loading && !error && (
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{files.length} file</div>
      )}
    </div>
  );
};

// DashboardSection — tahap ini baru "Test Koneksi" (panggil API Generate
// JSON Web Token pakai kredensial yg diatur di Pengaturan) — sisanya
// (statistik dokumen, dll) menyusul kalau menu lain sudah ditentukan.
// JWT Peruri berlaku 24 jam (dikonfirmasi user) — backend (getPeruriJWTCached
// di peruri_handler.go) reuse token tersimpan selama belum kadaluarsa, JADI
// klik tombol ini berulang TIDAK generate token baru tiap kali, cuma
// laporkan token yg lagi dipakai (freshly_generated menandai mana yg baru
// vs reuse).
const DashboardSection: React.FC = () => {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; jwt?: string; expiredAt?: string; fresh?: boolean; errorMsg?: string } | null>(null);

  const handleTestJwt = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/peruri/test-jwt', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memanggil API Peruri');
      setResult({ ok: true, jwt: data.jwt, expiredAt: data.expired_at, fresh: data.freshly_generated });
    } catch (err) {
      setResult({ ok: false, errorMsg: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Test Koneksi — Generate JSON Web Token</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          Panggil API Generate JWT Peruri pakai kredensial yang sudah diatur di menu Pengaturan. Token berlaku 24 jam — dipakai ulang selama belum kadaluarsa, tidak generate baru tiap klik.
        </div>
        <button
          type="button"
          onClick={handleTestJwt}
          disabled={testing}
          style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: testing ? '#a7f3d0' : '#059669', color: '#ffffff',
            fontSize: 13, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? 'Menghubungi...' : 'Generate JWT'}
        </button>

        {result && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: result.ok ? '#059669' : '#dc2626' }}>
              {result.ok
                ? (result.fresh ? 'Token baru berhasil dibuat' : 'Token tersimpan masih berlaku (dipakai ulang)') + (result.expiredAt ? ` — kadaluarsa ${result.expiredAt}` : '')
                : `Gagal: ${result.errorMsg}`}
            </div>
            {result.ok && (
              <pre
                style={{
                  margin: 0, padding: 12, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb',
                  fontSize: 11.5, color: '#111827', overflowX: 'auto', maxHeight: 320, overflowY: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                }}
              >
                {result.jwt}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// PerluDiprosesSection — submenu "Lihat Dokumen / Perlu Diproses": semua
// pasien (reg_periksa) dlm rentang tanggal, dikelompokkan per dokter. Data
// baru dimuat setelah klik "Tampilkan" (sama pola Penyimpanan Berkas Digital).
type PerluDiprosesRow = {
  no_rawat: string; no_rkm_medis: string; nm_pasien: string; tgl_registrasi: string; jam_reg: string;
  status_lanjut: string; kd_dokter: string; nm_dokter: string; nm_poli: string; png_jawab: string;
  dok_sudah: number; dok_belum: number;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const filterInputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff',
};
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f3f4f6' };

// JenisRawatTabs — switch tab Rawat Jalan / Rawat Inap, pengganti dropdown
// jenis rawat. Default Rawat Jalan (tab "Semua" sengaja ditiadakan).
type JenisRawat = 'Ralan' | 'Ranap';
const JENIS_RAWAT_TABS: { key: JenisRawat; label: string }[] = [
  { key: 'Ralan', label: 'Rawat Jalan' },
  { key: 'Ranap', label: 'Rawat Inap' },
];
// Gaya tab bergaris bawah PERSIS tab "Daftar Resep Dokter / Detail Rawat
// Jalan" di PermintaanResep.tsx, ditaruh di atas baris filter.
const JenisRawatTabs: React.FC<{ value: JenisRawat; onChange: (v: JenisRawat) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
    {JENIS_RAWAT_TABS.map((t) => {
      const active = value === t.key;
      return (
        <button
          key={t.key}
          type="button"
          onClick={() => !active && onChange(t.key)}
          disabled={disabled}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: active ? '2px solid #059669' : '2px solid transparent',
            background: 'transparent',
            color: active ? '#059669' : '#6b7280',
            fontWeight: active ? 600 : 400,
            fontSize: 13,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);

// StepperIcon — penanda kolom pilihan (pola sama dgn ApotekPenjualan.tsx
// dll), ditempel absolut di sisi kanan kolom.
const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
      width: 22, height: 22, borderRadius: '30%', background: '#059669',
      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

// FilterSelect — dropdown filter dgn StepperIcon (panah bawaan browser
// disembunyikan), pola sama dgn PillSelect di ApotekPenjualan.tsx.
const FilterSelect: React.FC<{
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; lebar?: number;
}> = ({ value, onChange, options, lebar = 170 }) => (
  <div style={{ position: 'relative', width: lebar }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...filterInputStyle, width: '100%', paddingRight: 36, cursor: 'pointer', boxSizing: 'border-box',
        appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        color: value ? '#111827' : '#9ca3af',
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value} style={{ color: '#111827' }}>{o.label}</option>)}
    </select>
    <StepperIcon />
  </div>
);

const STATUS_BAYAR_OPTIONS = [
  { value: '', label: 'Semua Status Bayar' },
  { value: 'Sudah Bayar', label: 'Sudah Bayar' },
  { value: 'Belum Bayar', label: 'Belum Bayar' },
];

// FilterPilihan — kolom filter yg dipilih lewat modal pencarian (dokter:
// ModalCariDokter, cara bayar: ModalCariCaraBayar — props keduanya sama).
// Kosong = placeholder ("Semua ..."); klik kolom → modal.
type ModalPilihProps = { isOpen: boolean; onClose: () => void; onSelect: (kode: string, nama: string) => void };
const FilterPilihan: React.FC<{
  kode: string; nama: string; placeholder: string; lebar?: number;
  Modal: React.FC<ModalPilihProps>; onChange: (kode: string, nama: string) => void;
}> = ({ kode, nama, placeholder, lebar = 220, Modal, onChange }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={kode ? `${nama} (${kode})` : `Klik untuk memilih (${placeholder})`}
          style={{
            ...filterInputStyle, position: 'relative', width: lebar, paddingRight: 36, textAlign: 'left', cursor: 'pointer',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box',
            color: kode ? '#111827' : '#9ca3af',
          }}
        >
          {kode ? nama : placeholder}
          <StepperIcon />
        </button>
      </div>
      <Modal isOpen={open} onClose={() => setOpen(false)} onSelect={(k, n) => onChange(k, n)} />
    </>
  );
};

// useFilterTersimpan — state filter yg BERTAHAN saat pindah submenu (komponen
// submenu di-unmount saat ditinggal, jadi state React biasa ikut hilang).
// Disimpan di sessionStorage: bertahan selama tab browser terbuka, hilang
// saat tab ditutup. Akses storage dibungkus try/catch (bisa diblokir
// browser/mode privat) — kalau gagal, perilakunya sama spt useState biasa.
function useFilterTersimpan<T>(kunci: string, awal: T | (() => T)): [T, (v: T) => void] {
  const [nilai, setNilai] = React.useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(kunci);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch { /* abaikan */ }
    return typeof awal === 'function' ? (awal as () => T)() : awal;
  });
  const simpan = React.useCallback((v: T) => {
    setNilai(v);
    try { window.sessionStorage.setItem(kunci, JSON.stringify(v)); } catch { /* abaikan */ }
  }, [kunci]);
  return [nilai, simpan];
}

const PerluDiprosesSection: React.FC = () => {
  // Filter disimpan (useFilterTersimpan) → tidak tereset saat pindah ke
  // submenu lain lalu kembali ke Perlu Diproses.
  const [tglAwal, setTglAwal] = useFilterTersimpan('peruri.perlu.tglAwal', todayStr);
  const [tglAkhir, setTglAkhir] = useFilterTersimpan('peruri.perlu.tglAkhir', todayStr);
  const [jenis, setJenis] = useFilterTersimpan<JenisRawat>('peruri.perlu.jenis', 'Ralan');
  const [kdDokter, setKdDokter] = useFilterTersimpan('peruri.perlu.kdDokter', '');
  const [nmDokter, setNmDokter] = useFilterTersimpan('peruri.perlu.nmDokter', '');
  const [kdPj, setKdPj] = useFilterTersimpan('peruri.perlu.kdPj', '');
  const [nmPj, setNmPj] = useFilterTersimpan('peruri.perlu.nmPj', '');
  const [statusBayar, setStatusBayar] = useFilterTersimpan('peruri.perlu.statusBayar', '');
  const [search, setSearch] = useFilterTersimpan('peruri.perlu.search', '');
  const [rows, setRows] = React.useState<PerluDiprosesRow[]>([]);
  const [tteTersedia, setTteTersedia] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');

  // Dimuat OTOMATIS (tanpa tombol Tampilkan): saat halaman dibuka & tiap
  // filter berubah. reqId mencegah respons lama (filter sebelumnya) yg
  // datang belakangan menimpa hasil filter terbaru.
  const reqId = React.useRef(0);
  const muatData = () => {
    if (tglAwal > tglAkhir) {
      setError('Tanggal awal tidak boleh lebih besar dari tanggal akhir');
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, jenis });
    if (kdDokter) params.set('kd_dokter', kdDokter);
    if (kdPj) params.set('kd_pj', kdPj);
    if (statusBayar) params.set('status_bayar', statusBayar);
    if (search.trim()) params.set('search', search.trim());
    fetch(`/api/peruri/perlu-diproses?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(data.error || `Gagal memuat data (HTTP ${res.status})`);
        setRows(Array.isArray(data.data) ? data.data : []);
        setDipilih(new Set());
        setTteTersedia(data.tte_tersedia !== false);
        setLoaded(true);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setRows([]);
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  // Muat otomatis tiap filter berubah. Kolom cari diberi jeda 400 ms supaya
  // tidak memanggil server di setiap ketukan huruf; filter lain langsung.
  const searchPertama = React.useRef(true);
  React.useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tglAwal, tglAkhir, jenis, kdDokter, kdPj, statusBayar]);
  React.useEffect(() => {
    if (searchPertama.current) { searchPertama.current = false; return; }
    const t = window.setTimeout(muatData, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Kelompokkan per dokter (urutan dari backend sudah ORDER BY nm_dokter).
  const groups = React.useMemo(() => {
    const map = new Map<string, { kd: string; nm: string; items: PerluDiprosesRow[] }>();
    for (const r of rows) {
      const g = map.get(r.kd_dokter) ?? { kd: r.kd_dokter, nm: r.nm_dokter || r.kd_dokter, items: [] };
      g.items.push(r);
      map.set(r.kd_dokter, g);
    }
    return Array.from(map.values());
  }, [rows]);

  // Status "Sudah" = ada dokumen tercatat & semuanya sudah TTE. Selain itu
  // (belum ada dokumen / masih ada yg belum / tabel tracking tidak ada)
  // tampilkan tombol Tanda Tangan.
  // Baris diidentifikasi no_rawat + kd_dokter (pasien ranap dgn >1 DPJP
  // muncul di beberapa kartu dokter, masing2 dokumen & TTE sendiri).
  const rowKey = (r: PerluDiprosesRow) => `${r.no_rawat}|${r.kd_dokter}`;
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  // Pilihan utk TTE massal (per kartu dokter — 1 OTP berlaku per dokter).
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set());
  const [massalDokter, setMassalDokter] = React.useState<string | null>(null);

  const togglePilih = (key: string) => setDipilih((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleTandaTanganMassal = async (items: PerluDiprosesRow[], kdDokter: string) => {
    setMassalDokter(kdDokter);
    try {
      await tandaTanganRingkasanMassal(items, (t) => {
        const key = rowKey(t as PerluDiprosesRow);
        // Sudah ditandatangani → hilang dari Perlu Diproses (pindah ke Selesai).
        setRows((prev) => prev.filter((x) => rowKey(x) !== key));
        setDipilih((prev) => { const next = new Set(prev); next.delete(key); return next; });
      });
    } finally {
      setMassalDokter(null);
    }
  };

  // Tombol mata — buka PDF dokumen yg AKAN di-TTE di tab baru, TANPA kirim
  // apa pun ke Peruri (pola handlePreviewTtd di ModalHasilLabPK.tsx). Nama
  // penanda tangan = dokter baris ini, sama dgn yg nanti dikirim ke Peruri.
  const handlePreview = async (r: PerluDiprosesRow) => {
    // Tab dibuka duluan (sinkron dgn klik) supaya tidak diblokir popup blocker.
    const win = window.open('', '_blank');
    setBusyKey(rowKey(r));
    try {
      const { pdfBytes } = await buildDokumenPasienPdf(r.no_rawat, { namaPengesah: r.nm_dokter });
      const url = URL.createObjectURL(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleTandaTangan = async (r: PerluDiprosesRow) => {
    setBusyKey(rowKey(r));
    try {
      const ok = await tandaTanganRingkasan(r);
      // Sukses → baris hilang dari Perlu Diproses (pindah ke submenu Selesai).
      if (ok) {
        setRows((prev) => prev.filter((x) => rowKey(x) !== rowKey(r)));
        setDipilih((prev) => { const next = new Set(prev); next.delete(rowKey(r)); return next; });
      }
    } finally {
      setBusyKey(null);
    }
  };

  const ikonBtnStyle = (busy: boolean): React.CSSProperties => ({
    width: 28, height: 26, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: busy ? '#9ca3af' : '#374151',
    cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  });

  const tombolLihat = (r: PerluDiprosesRow, busy: boolean) => (
    <button type="button" onClick={() => handlePreview(r)} disabled={busy} title="Lihat dokumen yang akan di-TTE" style={ikonBtnStyle(busy)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </button>
  );

  // Ringkasan yg SUDAH ditandatangani tidak dimuat backend lagi (pindah ke
  // submenu Selesai), jadi semua baris di sini memang belum di-TTE.
  const statusTte = (r: PerluDiprosesRow) => {
    const busy = busyKey === rowKey(r);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {tombolLihat(r, busy)}
        <button
          type="button"
          onClick={() => handleTandaTangan(r)}
          disabled={busy}
          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: busy ? '#a7f3d0' : '#059669', color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Memproses...' : 'Tanda Tangan'}
        </button>
        {tteTersedia && r.dok_belum > 0 && (
          <span style={{ fontSize: 11, color: '#92400e' }} title="Dokumen pernah dikirim ke Peruri tapi belum selesai ditandatangani">pernah dikirim, belum TTD</span>
        )}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <JenisRawatTabs value={jenis} onChange={setJenis} disabled={loading} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} style={filterInputStyle} />
        <span style={{ fontSize: 13, color: '#6b7280' }}>s/d</span>
        <input type="date" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} style={filterInputStyle} />
        <FilterPilihan kode={kdDokter} nama={nmDokter} placeholder="Semua Dokter" Modal={ModalCariDokter} onChange={(kd, nm) => { setKdDokter(kd); setNmDokter(nm); }} />
        <FilterPilihan kode={kdPj} nama={nmPj} placeholder="Semua Cara Bayar" lebar={180} Modal={ModalCariCaraBayar} onChange={(kd, nm) => { setKdPj(kd); setNmPj(nm); }} />
        <FilterSelect value={statusBayar} onChange={setStatusBayar} options={STATUS_BAYAR_OPTIONS} />
        <input
          type="text"
          placeholder="Cari No.Rawat / No.RM / Nama Pasien..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...filterInputStyle, flex: 1, minWidth: 200 }}
        />
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!loaded ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{loading ? 'Memuat...' : ''}</div>
        ) : groups.length === 0 ? (
          loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div> :
          !error && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 10 }}>Tidak ada pasien pada filter ini</div>
        ) : (
          groups.map((g) => (
            <div key={g.kd} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                  {g.nm} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>({g.kd})</span>
                </div>
                {(() => {
                  const bisaDipilih = g.items;
                  const terpilih = bisaDipilih.filter((r) => dipilih.has(rowKey(r)));
                  const sedangMassal = massalDokter === g.kd;
                  const adaProses = massalDokter !== null || busyKey !== null;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>{g.items.length} pasien</div>
                      <button
                        type="button"
                        onClick={() => inputUlangOtp({ kd_dokter: g.kd, nm_dokter: g.nm })}
                        disabled={adaProses}
                        title="Minta & masukkan OTP baru (mis. setelah salah input OTP)"
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          border: '1px solid #059669', background: '#fff', color: adaProses ? '#a7f3d0' : '#059669',
                          borderColor: adaProses ? '#a7f3d0' : '#059669',
                          cursor: adaProses ? 'not-allowed' : 'pointer',
                        }}
                      >
                        OTP
                      </button>
                      {bisaDipilih.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleTandaTanganMassal(terpilih, g.kd)}
                          disabled={terpilih.length === 0 || adaProses}
                          title="Tanda tangani semua dokumen yang dicentang (cukup 1x OTP)"
                          style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                            background: terpilih.length === 0 || adaProses ? '#a7f3d0' : '#059669', color: '#fff',
                            cursor: terpilih.length === 0 || adaProses ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {sedangMassal ? 'Memproses...' : `Tanda Tangan Terpilih (${terpilih.length})`}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>No</th>
                    <th style={thStyle}>No. Rawat</th>
                    <th style={thStyle}>No. RM</th>
                    <th style={thStyle}>Nama Pasien</th>
                    <th style={thStyle}>Tgl Registrasi</th>
                    <th style={thStyle}>Poli</th>
                    <th style={thStyle}>Cara Bayar</th>
                    <th style={thStyle}>Status TTE</th>
                    {/* Kolom pilih: header & baris SAMA2 rata kanan supaya checkbox
                        "Pilih Semua" sejajar vertikal dgn checkbox tiap baris. */}
                    <th style={{ ...thStyle, textAlign: 'right' }}>
                      {(() => {
                        const bisaDipilih = g.items;
                        if (bisaDipilih.length === 0) return null;
                        const semua = bisaDipilih.every((r) => dipilih.has(rowKey(r)));
                        return (
                          <label
                            title="Pilih semua yang belum ditandatangani"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: massalDokter !== null ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Pilih Semua
                            <input
                              type="checkbox"
                              checked={semua}
                              disabled={massalDokter !== null}
                              onChange={() => setDipilih((prev) => {
                                const next = new Set(prev);
                                bisaDipilih.forEach((r) => (semua ? next.delete(rowKey(r)) : next.add(rowKey(r))));
                                return next;
                              })}
                            />
                          </label>
                        );
                      })()}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((r, i) => (
                    <tr key={r.no_rawat} style={{ background: dipilih.has(rowKey(r)) ? '#ecfdf5' : i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.no_rawat}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.no_rkm_medis}</td>
                      <td style={tdStyle}>{r.nm_pasien}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.tgl_registrasi} {r.jam_reg}</td>
                      <td style={tdStyle}>{r.nm_poli}</td>
                      <td style={tdStyle}>{r.png_jawab}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{statusTte(r)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input type="checkbox" checked={dipilih.has(rowKey(r))} disabled={massalDokter !== null} onChange={() => togglePilih(rowKey(r))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {loaded && !loading && !error && (
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
          {new Set(rows.map((r) => r.no_rawat)).size} pasien · {groups.length} dokter
          {!tteTersedia && ' · tabel tracking_dokumen_ttd tidak ditemukan, status TTE tidak bisa dicek'}
        </div>
      )}
    </div>
  );
};

// SelesaiSection — submenu "Lihat Dokumen / Selesai": dokumen yg SUDAH
// ditandatangani (semua jenis: Ringkasan Perawatan, Hasil Lab, Hasil
// Radiologi, dst — tracking_dokumen_ttd dipakai bersama), dikelompokkan per
// dokter penandatangan. Data baru dimuat setelah klik "Tampilkan".
type SelesaiRow = {
  no_rawat: string; nama_dokumen: string; jenis_dokumen: string; tgl_kirim: string; order_id: string;
  email_ttd: string; user_pengirim: string; no_rkm_medis: string; nm_pasien: string; status_lanjut: string;
  kd_dokter: string; nm_dokter: string; png_jawab: string;
};

const JENIS_DOKUMEN_OPTIONS = ['Semua', 'Ringkasan Perawatan', 'Hasil Lab', 'Hasil Radiologi', 'Lainnya'];

const badgeJenisDokumen: Record<string, { bg: string; fg: string }> = {
  'Ringkasan Perawatan': { bg: '#dbeafe', fg: '#1e40af' },
  'Hasil Lab': { bg: '#fef3c7', fg: '#92400e' },
  'Hasil Radiologi': { bg: '#ede9fe', fg: '#5b21b6' },
  Lainnya: { bg: '#f3f4f6', fg: '#374151' },
};

const SelesaiSection: React.FC = () => {
  // Filter disimpan (useFilterTersimpan) → tidak tereset saat pindah ke
  // submenu lain lalu kembali ke Selesai. Kunci terpisah dari Perlu Diproses.
  const [tglAwal, setTglAwal] = useFilterTersimpan('peruri.selesai.tglAwal', todayStr);
  const [tglAkhir, setTglAkhir] = useFilterTersimpan('peruri.selesai.tglAkhir', todayStr);
  const [jenis, setJenis] = useFilterTersimpan<JenisRawat>('peruri.selesai.jenis', 'Ralan');
  const [jenisDokumen, setJenisDokumen] = useFilterTersimpan('peruri.selesai.jenisDokumen', 'Semua');
  const [kdDokter, setKdDokter] = useFilterTersimpan('peruri.selesai.kdDokter', '');
  const [nmDokter, setNmDokter] = useFilterTersimpan('peruri.selesai.nmDokter', '');
  const [kdPj, setKdPj] = useFilterTersimpan('peruri.selesai.kdPj', '');
  const [nmPj, setNmPj] = useFilterTersimpan('peruri.selesai.nmPj', '');
  const [search, setSearch] = useFilterTersimpan('peruri.selesai.search', '');
  const [rows, setRows] = React.useState<SelesaiRow[]>([]);
  const [tteTersedia, setTteTersedia] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busyOrder, setBusyOrder] = React.useState<string | null>(null);
  // Pilihan utk Unduh Terpilih (kunci = order_id, unik per dokumen).
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set());
  const [massalKunci, setMassalKunci] = React.useState<string | null>(null);

  // Dimuat OTOMATIS (tanpa tombol Tampilkan), sama dgn Perlu Diproses:
  // saat halaman dibuka & tiap filter berubah. reqId mencegah respons lama
  // menimpa hasil filter terbaru.
  const reqId = React.useRef(0);
  const muatData = () => {
    if (tglAwal > tglAkhir) {
      setError('Tanggal awal tidak boleh lebih besar dari tanggal akhir');
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, jenis, jenis_dokumen: jenisDokumen });
    if (kdDokter) params.set('kd_dokter', kdDokter);
    if (kdPj) params.set('kd_pj', kdPj);
    if (search.trim()) params.set('search', search.trim());
    fetch(`/api/peruri/selesai?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(data.error || `Gagal memuat data (HTTP ${res.status})`);
        setRows(Array.isArray(data.data) ? data.data : []);
        setDipilih(new Set());
        setTteTersedia(data.tte_tersedia !== false);
        setLoaded(true);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setRows([]);
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  // Muat otomatis tiap filter berubah; kolom cari diberi jeda 400 ms.
  const searchPertama = React.useRef(true);
  React.useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tglAwal, tglAkhir, jenis, jenisDokumen, kdDokter, kdPj]);
  React.useEffect(() => {
    if (searchPertama.current) { searchPertama.current = false; return; }
    const t = window.setTimeout(muatData, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Kelompokkan per dokter penandatangan; email yg tidak cocok dgn data
  // dokter mana pun dikelompokkan per email-nya.
  const groups = React.useMemo(() => {
    const map = new Map<string, { kunci: string; judul: string; sub: string; items: SelesaiRow[] }>();
    for (const r of rows) {
      const kunci = r.kd_dokter || `email:${r.email_ttd}`;
      const g = map.get(kunci) ?? {
        kunci,
        judul: r.nm_dokter || r.email_ttd || 'Penandatangan tidak diketahui',
        sub: r.kd_dokter || (r.email_ttd ? 'email tidak cocok dgn data dokter' : ''),
        items: [],
      };
      g.items.push(r);
      map.set(kunci, g);
    }
    return Array.from(map.values());
  }, [rows]);

  // Ringkasan → sekalian simpan ke Berkas Rawat. Lab/Radiologi → hanya
  // diunduh; simpan Berkas Rawat utk keduanya sudah diatur modal masing2
  // dgn penamaan sendiri.
  const opsiSimpan = (r: SelesaiRow) => {
    if (r.jenis_dokumen !== 'Ringkasan Perawatan') return undefined;
    return opsiSimpanRingkasan({ no_rawat: r.no_rawat, kd_dokter: kdDokterDariNamaRingkasan(r.nama_dokumen) });
  };

  const handleUnduh = async (r: SelesaiRow) => {
    setBusyOrder(r.order_id);
    try {
      await unduhDokumenTte(r.order_id, r.nama_dokumen || `${r.order_id}.pdf`, opsiSimpan(r));
    } finally {
      setBusyOrder(null);
    }
  };

  const togglePilih = (orderId: string) => setDipilih((prev) => {
    const next = new Set(prev);
    if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
    return next;
  });

  // Unduh Terpilih — 1x klik, diproses 1 per 1 (unduh + upload Berkas Rawat
  // utk Ringkasan). Pilihan dikosongkan setelah selesai.
  const handleUnduhMassal = async (items: SelesaiRow[], kunciGrup: string) => {
    setMassalKunci(kunciGrup);
    try {
      await unduhDokumenTteMassal(items.map((r) => ({
        orderId: r.order_id,
        namaFile: r.nama_dokumen || `${r.order_id}.pdf`,
        label: `${r.nm_pasien || '-'} (${r.no_rawat}) · ${r.jenis_dokumen}`,
        simpanKeBerkas: opsiSimpan(r),
      })));
      setDipilih((prev) => {
        const next = new Set(prev);
        items.forEach((r) => next.delete(r.order_id));
        return next;
      });
    } finally {
      setMassalKunci(null);
    }
  };

  const formatTglJam = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(s);
    return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : s || '-';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <JenisRawatTabs value={jenis} onChange={setJenis} disabled={loading} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} style={filterInputStyle} title="Tanggal kirim dari" />
        <span style={{ fontSize: 13, color: '#6b7280' }}>s/d</span>
        <input type="date" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} style={filterInputStyle} title="Tanggal kirim sampai" />
        <select value={jenisDokumen} onChange={(e) => setJenisDokumen(e.target.value)} style={filterInputStyle}>
          {JENIS_DOKUMEN_OPTIONS.map((j) => <option key={j} value={j}>{j === 'Semua' ? 'Semua Dokumen' : j}</option>)}
        </select>
        <FilterPilihan kode={kdDokter} nama={nmDokter} placeholder="Semua Dokter" Modal={ModalCariDokter} onChange={(kd, nm) => { setKdDokter(kd); setNmDokter(nm); }} />
        <FilterPilihan kode={kdPj} nama={nmPj} placeholder="Semua Cara Bayar" lebar={180} Modal={ModalCariCaraBayar} onChange={(kd, nm) => { setKdPj(kd); setNmPj(nm); }} />
        <input
          type="text"
          placeholder="Cari No.Rawat / No.RM / Nama Pasien / Dokumen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...filterInputStyle, flex: 1, minWidth: 200 }}
        />
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!loaded ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{loading ? 'Memuat...' : ''}</div>
        ) : !tteTersedia ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 10 }}>
            Tabel tracking_dokumen_ttd tidak ditemukan di database ini, belum ada riwayat tanda tangan.
          </div>
        ) : groups.length === 0 ? (
          loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div> :
          !error && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 10 }}>Tidak ada dokumen yang sudah ditandatangani pada filter ini</div>
        ) : (
          groups.map((g) => (
            <div key={g.kunci} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                  {g.judul} {g.sub && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>({g.sub})</span>}
                </div>
                {(() => {
                  const bisaDipilih = g.items.filter((r) => r.order_id);
                  const terpilih = bisaDipilih.filter((r) => dipilih.has(r.order_id));
                  const adaProses = massalKunci !== null || busyOrder !== null;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>{g.items.length} dokumen</div>
                      {bisaDipilih.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleUnduhMassal(terpilih, g.kunci)}
                          disabled={terpilih.length === 0 || adaProses}
                          title="Unduh semua dokumen yang dicentang satu per satu (Ringkasan sekalian disimpan ke Berkas Rawat)"
                          style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                            background: terpilih.length === 0 || adaProses ? '#a7f3d0' : '#059669', color: '#fff',
                            cursor: terpilih.length === 0 || adaProses ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {massalKunci === g.kunci ? 'Memproses...' : `Unduh Terpilih (${terpilih.length})`}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>No</th>
                    <th style={thStyle}>Tgl Kirim</th>
                    <th style={thStyle}>No. Rawat</th>
                    <th style={thStyle}>No. RM</th>
                    <th style={thStyle}>Nama Pasien</th>
                    <th style={thStyle}>Cara Bayar</th>
                    <th style={thStyle}>Dokumen</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
                    {/* Kolom pilih: header & baris rata kanan supaya checkbox
                        "Pilih Semua" sejajar vertikal dgn checkbox tiap baris. */}
                    <th style={{ ...thStyle, textAlign: 'right' }}>
                      {(() => {
                        const bisaDipilih = g.items.filter((r) => r.order_id);
                        if (bisaDipilih.length === 0) return null;
                        const semua = bisaDipilih.every((r) => dipilih.has(r.order_id));
                        return (
                          <label
                            title="Pilih semua dokumen di kartu ini"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: massalKunci !== null ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Pilih Semua
                            <input
                              type="checkbox"
                              checked={semua}
                              disabled={massalKunci !== null}
                              onChange={() => setDipilih((prev) => {
                                const next = new Set(prev);
                                bisaDipilih.forEach((r) => (semua ? next.delete(r.order_id) : next.add(r.order_id)));
                                return next;
                              })}
                            />
                          </label>
                        );
                      })()}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((r, i) => {
                    const badge = badgeJenisDokumen[r.jenis_dokumen] || badgeJenisDokumen.Lainnya;
                    const busy = busyOrder === r.order_id;
                    return (
                      <tr key={`${r.order_id}|${i}`} style={{ background: dipilih.has(r.order_id) ? '#ecfdf5' : i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatTglJam(r.tgl_kirim)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.no_rawat}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.no_rkm_medis || '-'}</td>
                        <td style={tdStyle}>{r.nm_pasien || '-'}</td>
                        <td style={tdStyle}>{r.png_jawab || '-'}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '2px 8px', borderRadius: 999, background: badge.bg, color: badge.fg, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.jenis_dokumen}</span>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, wordBreak: 'break-all' }}>{r.nama_dokumen}</div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleUnduh(r)}
                            disabled={busy || !r.order_id}
                            title={r.jenis_dokumen === 'Ringkasan Perawatan' ? 'Unduh dokumen bertanda tangan (otomatis tersimpan ke Berkas Rawat)' : 'Unduh dokumen bertanda tangan'}
                            style={{ width: 28, height: 26, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: busy ? '#9ca3af' : '#374151', cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </button>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {r.order_id && (
                            <input type="checkbox" checked={dipilih.has(r.order_id)} disabled={massalKunci !== null} onChange={() => togglePilih(r.order_id)} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {loaded && !loading && !error && tteTersedia && (
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
          {rows.length} dokumen · {groups.length} penandatangan
        </div>
      )}
    </div>
  );
};

// Placeholder submenu "Lihat Dokumen" — status dokumen TTE (Perlu Diproses/
// Selesai/Kadaluarsa) belum ada sumber datanya, tampilkan keterangan saja.
const DalamPengembanganSection: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: '#6b7280', textAlign: 'center' }}>
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>
    <div style={{ fontSize: 13 }}>Fitur ini masih dalam pengembangan.</div>
  </div>
);

type PeruriTab = 'dashboard' | 'lihat-dokumen' | 'dok-perlu-diproses' | 'dok-selesai' | 'dok-kadaluarsa' | 'data-pengguna' | 'pengaturan';

type PeruriMenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  // children ada → item ini cuma toggle buka/tutup submenu, bukan tab.
  children?: { key: PeruriTab; label: string }[];
};

const LIHAT_DOKUMEN_SUBMENU: { key: PeruriTab; label: string }[] = [
  { key: 'dok-perlu-diproses', label: 'Perlu Diproses' },
  { key: 'dok-selesai', label: 'Selesai' },
  { key: 'dok-kadaluarsa', label: 'Kadaluarsa' },
];

const MENU: PeruriMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    key: 'lihat-dokumen-group',
    label: 'Lihat Dokumen',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ),
    children: LIHAT_DOKUMEN_SUBMENU,
  },
  {
    key: 'lihat-dokumen',
    label: 'Penyimpanan Berkas Digital',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <path d="M14 2v6h6"></path>
        <line x1="9" y1="13" x2="15" y2="13"></line>
        <line x1="9" y1="17" x2="15" y2="17"></line>
      </svg>
    ),
  },
  {
    key: 'data-pengguna',
    label: 'Data Pengguna',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
  },
];

// Pengaturan — terpisah dari MENU (footer sidebar, sama pola SETTINGS_ITEM
// di SatuSehat.tsx), bukan bagian daftar menu utama yang scroll.
const SETTINGS_ITEM: { key: PeruriTab; label: string; icon: React.ReactNode } = {
  key: 'pengaturan',
  label: 'Pengaturan',
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

// ── Pengaturan — kredensial & endpoint API gateway PERURI (sandbox), diambil
// persis dari dokumentasi yang diberikan user. Dikelompokkan sesuai kategori
// aslinya (Generate JWT/Certificate/Single/System/Hierarchy/Parallel/Bulk
// Signing/Signing Session/Peruri Tera/Gerber Service). Backend simpan tiap
// field sbg satu baris kode/nilai di peruri_konfigurasi (lihat
// backend/peruri_handler.go) — bukan struct tetap, supaya gampang nambah
// field baru nanti tanpa migrasi kolom.
type PeruriField = { key: string; label: string; defaultValue: string };
type PeruriSection = { title: string; fields: PeruriField[] };

const PERURI_SECTIONS: PeruriSection[] = [
  {
    title: 'Generate JSON Web Token',
    fields: [
      { key: 'JWT_GET_TOKEN', label: 'API Generate JWT', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/jwtSandbox/1.0/getJsonWebToken/v1' },
    ],
  },
  {
    title: 'Generate Certificate',
    fields: [
      { key: 'CERT_ONBOARDING_LINK', label: 'API Generate Onboarding Link', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureOnboarding/1.0/generateOnboardingLink/v1' },
      { key: 'CERT_REGISTRATION', label: 'API Registration', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/registration/v1' },
      { key: 'CERT_VIDEO_VERIFICATION', label: 'API Video Verification', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/videoVerification/v1' },
      { key: 'CERT_VIDEO_VERIFICATION_RENEWAL', label: 'API Video Verification for Renewal', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/videoVerificationForRenewal/v1' },
      { key: 'CERT_SEND_SPECIMEN', label: 'API Send Specimen', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendSpeciment/v1' },
      { key: 'CERT_CHECK_BY_EMAIL', label: 'API Check Certificate By Email', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/checkCertificate/v1' },
      { key: 'CERT_CHECK_BY_KTP', label: 'API Check Certificate By KTP', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkCertificateByKTP/v1' },
    ],
  },
  {
    title: 'Single Signing',
    fields: [
      { key: 'SINGLE_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sendDocument/v1' },
      { key: 'SINGLE_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'SINGLE_VIEW_DOCUMENT', label: 'API View Document (Unsigned)', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/viewDocument/v1' },
      { key: 'SINGLE_UPDATE_DOCUMENT_PASSWORD', label: 'API Update Document Password', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/updateDocumentPassword/v1' },
      { key: 'SINGLE_SEND_OTP', label: 'API Send OTP', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendOtp/v1' },
      { key: 'SINGLE_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signing/v2' },
      { key: 'SINGLE_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/downloadDocument/v1' },
      { key: 'SINGLE_CHECK_DOCUMENT_STATUS', label: 'API Check Document Status', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkDocumentStatus/v1' },
      { key: 'SINGLE_DELETE_ORDER', label: 'API Delete Order', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/deleteOrder/v1' },
    ],
  },
  {
    title: 'System Signing',
    fields: [
      { key: 'SYSTEM_SET_KEY', label: 'API Set Key', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setKey/v1' },
      { key: 'SYSTEM_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingSystem/v2' },
    ],
  },
  {
    title: 'Hierarchy Signing',
    fields: [
      { key: 'HIERARCHY_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentTier/v1' },
      { key: 'HIERARCHY_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'HIERARCHY_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingTier/v2' },
      { key: 'HIERARCHY_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/downloadDocumentTier/v1' },
      { key: 'HIERARCHY_CHECK_ORDER_STATUS', label: 'API Check Order ID Status Per Order Type', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkOrderIdStatusPerOrderType/v1' },
    ],
  },
  {
    title: 'Parallel Signing',
    fields: [
      { key: 'PARALLEL_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentParallel/v1' },
      { key: 'PARALLEL_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'PARALLEL_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingParallel/v2' },
      { key: 'PARALLEL_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/downloadDocumentParallel/v1' },
      { key: 'PARALLEL_CHECK_ORDER_STATUS', label: 'API Check Order ID Status Per Order Type', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkOrderIdStatusPerOrderType/v1' },
    ],
  },
  {
    title: 'Bulk Signing',
    fields: [
      { key: 'BULK_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentBulk/v1' },
      { key: 'BULK_SEND_OTP', label: 'API Send OTP Bulk', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendOtpBulk/v1' },
      { key: 'BULK_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingBulk/v2' },
      { key: 'BULK_SIGNING_ASYNC', label: 'API Signing Async', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingAsyncBulk/v2' },
    ],
  },
  {
    title: 'Signing Session',
    fields: [
      { key: 'SESSION_INITIATE', label: 'API Session Initiate', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sessionInitiate/v1' },
      { key: 'SESSION_VALIDATION', label: 'API Session Validation', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sessionValidation/v1' },
      { key: 'SESSION_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocument/v1' },
      { key: 'SESSION_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'SESSION_SIGNING', label: 'API Signing Session', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/signingSession/v1' },
    ],
  },
  {
    title: 'Peruri Tera',
    fields: [
      { key: 'TERA_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingPeruriTera/v2' },
    ],
  },
  {
    title: 'Gerber Service',
    fields: [
      { key: 'GERBER_ORDER_LIST_BY_UPLOADER', label: 'API Get Parallel/Hierarchy Order List', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/getOrderByUploader/v1' },
      { key: 'GERBER_ORDER_LIST_BY_EMAIL', label: 'API Get Order List', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/gerber/getOrderListByEmail/v1' },
    ],
  },
];

const pengaturanLabelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#6b7280', marginBottom: 5 };
const pengaturanInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const PengaturanSection: React.FC = () => {
  const [apiKey, setApiKey] = React.useState('');
  const [systemId, setSystemId] = React.useState('');
  const [urls, setUrls] = React.useState<Record<string, string>>(
    () => Object.fromEntries(PERURI_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f.defaultValue]))
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/peruri/config')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, string>) => {
        if (cancelled) return;
        if (typeof data.API_KEY === 'string') setApiKey(data.API_KEY);
        if (typeof data.SYSTEM_ID === 'string') setSystemId(data.SYSTEM_ID);
        setUrls((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (typeof data[key] === 'string' && data[key] !== '') next[key] = data[key];
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setUrl = (key: string, val: string) => setUrls((prev) => ({ ...prev, [key]: val }));

  const handleSimpan = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { API_KEY: apiKey, SYSTEM_ID: systemId, ...urls };
      const res = await fetch('/api/peruri/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Konfigurasi Peruri berhasil disimpan', confirmButtonColor: '#059669', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Kredensial */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Kredensial</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={pengaturanLabelStyle}>x-Gateway-APIKey</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={pengaturanInputStyle} placeholder="0fff6fb9-1a7a-4025-b10f-5f7640eff999" />
          </div>
          <div>
            <label style={pengaturanLabelStyle}>System ID</label>
            <input type="text" value={systemId} onChange={(e) => setSystemId(e.target.value)} style={pengaturanInputStyle} placeholder="RSI-IBNUSINA-SIGLI" />
          </div>
        </div>
      </div>

      {/* Endpoint API per kategori */}
      {PERURI_SECTIONS.map((section) => (
        <div key={section.title} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>{section.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {section.fields.map((field) => (
              <div key={field.key}>
                <label style={pengaturanLabelStyle}>{field.label}</label>
                <input
                  type="text"
                  value={urls[field.key] ?? ''}
                  onChange={(e) => setUrl(field.key, e.target.value)}
                  style={pengaturanInputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ position: 'sticky', bottom: 0, background: '#ffffff', paddingTop: 4 }}>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: saving ? '#a7f3d0' : '#059669', color: '#ffffff',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
};

type PeruriViewProps = {
  onBack?: () => void;
};

export const PeruriView: React.FC<PeruriViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<PeruriTab>('dashboard');
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
  const activeLabel = (() => {
    for (const m of [...MENU, SETTINGS_ITEM] as PeruriMenuItem[]) {
      if (m.key === activeTab) return m.label;
      const child = m.children?.find((c) => c.key === activeTab);
      if (child) return `${m.label} / ${child.label}`;
    }
    return '';
  })();
  const activeSubLabel = LIHAT_DOKUMEN_SUBMENU.find((c) => c.key === activeTab)?.label;

  return (
    <section
      style={{
        background: '#F3F4F6',
        padding: 20,
        height: '100%',
        display: 'flex',
        gap: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Sidebar — putih, bukan gradient, persis pola PermintaanResep.tsx */}
      <aside
        style={{
          width: 240,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 3 6v6c0 5.25 3.75 9.75 9 11 5.25-1.25 9-5.75 9-11V6z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>
          <div style={{ color: '#111827', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Peruri
          </div>
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const children = item.children;
            const childActive = !!children?.some((c) => c.key === activeTab);
            const open = !!openGroups[item.key];
            const active = !children && activeTab === item.key;
            return (
              <React.Fragment key={item.key}>
              <button
                type="button"
                onClick={() => {
                  if (children) setOpenGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                  else setActiveTab(item.key as PeruriTab);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? '#059669' : 'transparent',
                  color: active ? '#ffffff' : childActive ? '#059669' : '#6b7280',
                  fontWeight: childActive ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {children && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </button>
              {children && open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 27 }}>
                  {children.map((c) => {
                    const subActive = activeTab === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setActiveTab(c.key)}
                        style={{
                          padding: '8px 14px', borderRadius: 10, border: 'none', textAlign: 'left',
                          background: subActive ? '#059669' : 'transparent',
                          color: subActive ? '#ffffff' : '#6b7280',
                          fontSize: 12.5, cursor: 'pointer', transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (!subActive) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (!subActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer — Pengaturan, terpisah dari daftar menu utama */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          {(() => {
            const active = activeTab === SETTINGS_ITEM.key;
            return (
              <button
                type="button"
                onClick={() => setActiveTab(SETTINGS_ITEM.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? '#059669' : 'transparent',
                  color: active ? '#ffffff' : '#6b7280',
                  fontWeight: 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {SETTINGS_ITEM.icon}
                {SETTINGS_ITEM.label}
              </button>
            );
          })()}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header — langsung di atas background, tanpa card */}
        <div
          style={{
            padding: '0 4px 16px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            <span style={{ color: '#111827', fontWeight: 600 }}>Peruri</span> / {activeLabel}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #059669',
                background: '#059669',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Tutup
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          {activeTab === 'dashboard' && <DashboardSection />}
          {activeTab === 'lihat-dokumen' && <LihatDokumenSection />}
          {activeTab === 'dok-perlu-diproses' && <PerluDiprosesSection />}
          {activeTab === 'dok-selesai' && <SelesaiSection />}
          {activeSubLabel && activeTab !== 'dok-perlu-diproses' && activeTab !== 'dok-selesai' && <DalamPengembanganSection title={activeSubLabel} />}
          {activeTab === 'data-pengguna' && <AkunPeruriView />}
          {activeTab === 'pengaturan' && <PengaturanSection />}
        </div>
      </div>
    </section>
  );
};
