import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type SepItem = {
  no_sep: string;
  no_rawat: string;
  tglsep: string;
  tglrujukan: string;
  no_rujukan: string;
  kdppkrujukan: string;
  nmppkrujukan: string;
  kdppkpelayanan: string;
  nmppkpelayanan: string;
  jnspelayanan: string;
  catatan: string;
  diagawal: string;
  nmdiagnosaawal: string;
  kdpolitujuan: string;
  nmpolitujuan: string;
  klsrawat: string;
  nomr: string;
  nama_pasien: string;
  tanggal_lahir: string;
  peserta: string;
  jkel: string;
  no_kartu: string;
  kddpjp: string;
  nmdpdjp: string;
  noskdp: string;
  klsnaik: string;
  pembiayaan: string;
  pjnaikkelas: string;
  // Kecelakaan Lalu Lintas (KLL) / Jasa Raharja
  lakalantas: string;
  kdprop: string;
  nmprop: string;
  kdkab: string;
  nmkab: string;
  kdkec: string;
  nmkec: string;
  tglkkl: string;
  keterangankkl: string;
  no_laporan_polisi: string;
  tglpulang: string;
  suplesi: string;
  no_sep_suplesi: string;
  // Wajib diisi untuk update SEP
  notelep: string;
  user_entry: string;
  // Field tambahan VClaim SEP 2.0
  asal_rujukan: string;
  eksekutif: string;
  cob: string;
  katarak: string;
  tujuankunjungan: string;
  flagprosedur: string;
  penunjang: string;
  asesmenpelayanan: string;
  kddpjplayanan: string;
  nmdpjplayanan: string;
};

const emptyForm = (): SepItem => ({
  no_sep: '',
  no_rawat: '',
  tglsep: localDateStr(),
  tglrujukan: '',
  no_rujukan: '',
  kdppkrujukan: '',
  nmppkrujukan: '',
  kdppkpelayanan: '',
  nmppkpelayanan: '',
  jnspelayanan: '1',
  catatan: '',
  diagawal: '',
  nmdiagnosaawal: '',
  kdpolitujuan: '',
  nmpolitujuan: '',
  klsrawat: '2',
  nomr: '',
  nama_pasien: '',
  tanggal_lahir: '',
  peserta: '',
  jkel: '',
  no_kartu: '',
  kddpjp: '',
  nmdpdjp: '',
  noskdp: '',
  klsnaik: '',
  pembiayaan: '',
  pjnaikkelas: '',
  lakalantas: '',
  kdprop: '',
  nmprop: '',
  kdkab: '',
  nmkab: '',
  kdkec: '',
  nmkec: '',
  tglkkl: '',
  keterangankkl: '',
  no_laporan_polisi: '',
  tglpulang: '',
  suplesi: '',
  no_sep_suplesi: '',
  notelep: '',
  user_entry: '',
  asal_rujukan: '1',
  eksekutif: '',
  cob: '',
  katarak: '',
  tujuankunjungan: '0',
  flagprosedur: '',
  penunjang: '',
  asesmenpelayanan: '',
  kddpjplayanan: '',
  nmdpjplayanan: '',
});

const formatTgl = (tgl: string) => {
  if (!tgl || tgl.startsWith('0000-00-00')) return '-';
  const datePart = tgl.includes('T') ? tgl.split('T')[0] : tgl;
  const [y, m, d] = datePart.split('-');
  return y && m && d ? `${d}/${m}/${y}` : datePart;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

// SEP_COLUMNS — kolom tabel daftar SEP disamakan persis dengan tabMode di
// BPJSDataSEP.java (Khanza Desktop), supaya staf yang terbiasa dengan
// aplikasi desktop melihat susunan kolom yang sama di web ini. Didata-kan
// (bukan ditulis tangan di JSX) supaya thead & tbody selalu sinkron.
const SEP_COLUMNS: { label: string; render: (item: SepItem) => React.ReactNode }[] = [
  { label: 'No.SEP', render: (i) => i.no_sep },
  { label: 'No.Rawat', render: (i) => i.no_rawat },
  { label: 'No.RM', render: (i) => i.nomr },
  { label: 'Nama Pasien', render: (i) => i.nama_pasien },
  { label: 'Tgl.SEP', render: (i) => formatTgl(i.tglsep) },
  { label: 'Tgl.Rujukan', render: (i) => formatTgl(i.tglrujukan) },
  { label: 'No.Rujukan', render: (i) => i.no_rujukan || '-' },
  { label: 'Kode PPK Rujukan', render: (i) => i.kdppkrujukan || '-' },
  { label: 'Nama PPK Rujukan', render: (i) => i.nmppkrujukan || '-' },
  { label: 'Kode PPK Pelayanan', render: (i) => i.kdppkpelayanan || '-' },
  { label: 'Nama PPK Pelayanan', render: (i) => i.nmppkpelayanan || '-' },
  { label: 'Jenis', render: (i) => (i.jnspelayanan === '1' ? '1. Ranap' : i.jnspelayanan === '2' ? '2. Ralan' : i.jnspelayanan || '-') },
  { label: 'Catatan', render: (i) => i.catatan || '-' },
  { label: 'Kode Diagnosa', render: (i) => i.diagawal || '-' },
  { label: 'Nama Diagnosa', render: (i) => i.nmdiagnosaawal || '-' },
  { label: 'Kode Poli', render: (i) => i.kdpolitujuan || '-' },
  { label: 'Nama Poli', render: (i) => i.nmpolitujuan || '-' },
  { label: 'Kelas Rawat', render: (i) => i.klsrawat || '-' },
  { label: 'Naik Kelas', render: (i) => i.klsnaik || '-' },
  { label: 'Pembiayaan', render: (i) => i.pembiayaan || '-' },
  { label: 'P.J.Naik Kelas', render: (i) => i.pjnaikkelas || '-' },
  { label: 'Laka Lantas', render: (i) => i.lakalantas || '-' },
  { label: 'User Input', render: (i) => i.user_entry || '-' },
  { label: 'Tgl.Lahir', render: (i) => formatTgl(i.tanggal_lahir) },
  { label: 'Peserta', render: (i) => i.peserta || '-' },
  { label: 'J.K', render: (i) => i.jkel || '-' },
  { label: 'No.Kartu', render: (i) => i.no_kartu || '-' },
  { label: 'Tanggal Pulang', render: (i) => formatTgl(i.tglpulang) },
  { label: 'Asal Rujukan', render: (i) => i.asal_rujukan || '-' },
  { label: 'Eksekutif', render: (i) => i.eksekutif || '-' },
  { label: 'COB', render: (i) => i.cob || '-' },
  { label: 'No.Telp', render: (i) => i.notelep || '-' },
  { label: 'Katarak', render: (i) => i.katarak || '-' },
  { label: 'Tanggal KKL', render: (i) => formatTgl(i.tglkkl) },
  { label: 'Keterangan KKL', render: (i) => i.keterangankkl || '-' },
  { label: 'Suplesi', render: (i) => i.suplesi || '-' },
  { label: 'No.SEP Suplesi', render: (i) => i.no_sep_suplesi || '-' },
  { label: 'Kd Prop', render: (i) => i.kdprop || '-' },
  { label: 'Propinsi', render: (i) => i.nmprop || '-' },
  { label: 'Kd Kab', render: (i) => i.kdkab || '-' },
  { label: 'Kabupaten', render: (i) => i.nmkab || '-' },
  { label: 'Kd Kec', render: (i) => i.kdkec || '-' },
  { label: 'Kecamatan', render: (i) => i.nmkec || '-' },
  { label: 'No.SKDP', render: (i) => i.noskdp || '-' },
  { label: 'Kd DPJP', render: (i) => i.kddpjp || '-' },
  { label: 'DPJP', render: (i) => i.nmdpdjp || '-' },
  { label: 'Tujuan Kunjungan', render: (i) => i.tujuankunjungan || '-' },
  { label: 'Flag Prosedur', render: (i) => i.flagprosedur || '-' },
  { label: 'Penunjang', render: (i) => i.penunjang || '-' },
  { label: 'Asesmen Pelayanan', render: (i) => i.asesmenpelayanan || '-' },
  { label: 'Kd DPJP Layan', render: (i) => i.kddpjplayanan || '-' },
  { label: 'DPJP Layanan', render: (i) => i.nmdpjplayanan || '-' },
];

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

// ============================================================================
// Primitives ala Khanza Desktop (form Pembuatan SEP) — dipakai khusus modal
// Input SEP: input pil bulat, dropdown dengan ikon stepper biru, tombol
// paperclip (browse/lookup, sebagian besar dekoratif — belum ada picker
// sungguhan di balik tombolnya), dan baris label:value dengan label rata
// kanan seperti "No.Rawat :".
// ============================================================================

const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

const pillSelect: React.CSSProperties = {
  ...pillInput,
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 32,
  cursor: 'pointer',
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
      background: '#2563eb',
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
  style?: React.CSSProperties;
}> = ({ value, onChange, options, style }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', ...style }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={pillSelect}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

const PaperclipButton: React.FC<{ title?: string; onClick?: () => void }> = ({ title, onClick }) => (
  <button
    type="button"
    title={title || 'Cari'}
    onClick={onClick}
    style={{
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid #d1d5db',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
      color: '#6b7280',
      flexShrink: 0,
      padding: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  </button>
);

// Row — satu baris label:value ala form Khanza Desktop ("No.Rawat :" rata
// kanan, diikuti satu atau beberapa input pil di sebelah kanannya).
const Row: React.FC<{ label: string; labelWidth?: number; children: React.ReactNode }> = ({ label, labelWidth = 116, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>{label} :</div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
  </div>
);

const YA_TIDAK_OPTIONS = [
  { value: '', label: '0. Tidak' },
  { value: '1', label: '1. Ya' },
];

export const BpjsSepView: React.FC = () => {
  const [items, setItems] = React.useState<SepItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [tglDari, setTglDari] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateStr(d);
  });
  const [tglSampai, setTglSampai] = React.useState(localDateStr());
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<SepItem>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [sendingNoSep, setSendingNoSep] = React.useState<string | null>(null);
  const [deletingNoSep, setDeletingNoSep] = React.useState<string | null>(null);
  const [editingNoSep, setEditingNoSep] = React.useState<string | null>(null);
  const [pulangNoSep, setPulangNoSep] = React.useState<string | null>(null);
  const [pulangForm, setPulangForm] = React.useState({ tgl_pulang: localDateStr(), cara_pulang: '', no_surat_kematian: '', no_laporan_polisi: '', user_entry: '' });
  const [savingPulang, setSavingPulang] = React.useState(false);
  const [statusPeserta, setStatusPeserta] = React.useState('');
  const [checkingPeserta, setCheckingPeserta] = React.useState(false);

  // handleCekPeserta — dipicu saat field No.Kartu kehilangan fokus (blur),
  // meniru perilaku Khanza Desktop: ketik no. kartu lalu Tab, data pasien
  // (nama/tgl lahir/JK/jenis peserta/status keaktifan) otomatis terisi dari
  // BPJS. "Status" cuma ditampilkan (tidak disimpan ke bridging_sep — tidak
  // ada kolomnya), field lain hanya diisi kalau masih kosong di form.
  const handleCekPeserta = async () => {
    const noKartu = form.no_kartu.trim();
    if (!noKartu) return;
    setCheckingPeserta(true);
    setStatusPeserta('');
    try {
      const tgl = form.tglsep || localDateStr();
      const res = await fetch(`/api/bridging/peserta/nokartu/${encodeURIComponent(noKartu)}?tgl_sep=${tgl}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal cek peserta');
      const p = data.peserta || {};
      setForm((prev) => ({
        ...prev,
        nama_pasien: prev.nama_pasien || p.nama || '',
        tanggal_lahir: prev.tanggal_lahir || p.tglLahir || '',
        jkel: prev.jkel || (p.jenisKelamin ? String(p.jenisKelamin).charAt(0).toUpperCase() : ''),
        peserta: prev.peserta || p.jenisPeserta?.keterangan || '',
      }));
      setStatusPeserta(p.statusPeserta?.keterangan || (typeof p.statusPeserta === 'string' ? p.statusPeserta : '') || '-');
    } catch (err) {
      setStatusPeserta('');
      Swal.fire({ icon: 'error', title: 'Cek Peserta Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setCheckingPeserta(false);
    }
  };

  // rujukanPicker — daftar rujukan aktif hasil cek ke BPJS (Rujukan/Peserta/
  // {noKartu}), dipicu tombol paperclip di sebelah No.Rujukan supaya staf
  // bisa MEMILIH no rujukan baru dari BPJS langsung, bukan cuma isi manual.
  // Bentuk respons VClaim belum diverifikasi tanpa kredensial asli (sama
  // seperti catatan di BpjsRujukan.tsx), jadi field diambil defensif dengan
  // beberapa kemungkinan nama, dan kalau tidak ketemu field yang cocok baris
  // tetap ditampilkan dalam bentuk JSON mentah supaya tidak hilang begitu saja.
  const [rujukanPicker, setRujukanPicker] = React.useState<{ loading: boolean; error: string; items: any[] } | null>(null);

  const findRujukanField = (item: any, paths: string[]): string => {
    for (const p of paths) {
      const val = p.split('.').reduce((acc: any, k: string) => (acc && typeof acc === 'object' ? acc[k] : undefined), item);
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '';
  };

  // handleCariRujukan — dipakai dua tombol paperclip di sebelah No.Rujukan:
  // mode="kartu" (tombol 1) mencari SEMUA rujukan aktif milik peserta lewat
  // No. Kartu (buat pilih rujukan baru); mode="rujukan" (tombol 2) mengecek
  // detail satu No. Rujukan yang sudah diketik di field (buat verifikasi
  // sebelum SEP dikirim). Keduanya pakai endpoint & panel hasil yang sama.
  const handleCariRujukan = async (mode: 'kartu' | 'rujukan') => {
    const id = mode === 'kartu' ? form.no_kartu.trim() : form.no_rujukan.trim();
    if (!id) {
      Swal.fire({
        icon: 'warning',
        title: mode === 'kartu' ? 'No. Kartu kosong' : 'No. Rujukan kosong',
        text: mode === 'kartu' ? 'Isi No. Kartu dulu untuk mencari rujukan aktif' : 'Isi No. Rujukan dulu untuk dicek',
      });
      return;
    }
    setRujukanPicker({ loading: true, error: '', items: [] });
    try {
      const res = await fetch(`/api/bridging/rujukan/${encodeURIComponent(id)}?jenis=1&mode=${mode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data rujukan');
      const raw = data.rujukan ?? data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.list) ? raw.list : raw ? [raw] : [];
      setRujukanPicker({ loading: false, error: '', items: list });
    } catch (err) {
      setRujukanPicker({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] });
    }
  };

  const handlePilihRujukan = (item: any) => {
    const noRujukan = findRujukanField(item, ['noRujukan', 'no_rujukan', 'nomorRujukan', 'noKunjungan']);
    const tglRujukan = findRujukanField(item, ['tglRujukan', 'tgl_rujukan', 'tglKunjungan']);
    const kdppk = findRujukanField(item, ['ppkDirujuk.kode', 'ppkRujukan', 'kdPpkRujukan']);
    const nmppk = findRujukanField(item, ['ppkDirujuk.nama', 'nmPpkRujukan', 'namaPelayanan']);
    setForm((p) => ({
      ...p,
      no_rujukan: noRujukan || p.no_rujukan,
      tglrujukan: tglRujukan ? tglRujukan.slice(0, 10) : p.tglrujukan,
      kdppkrujukan: kdppk || p.kdppkrujukan,
      nmppkrujukan: nmppk || p.nmppkrujukan,
    }));
    setRujukanPicker(null);
  };

  // skdpPicker — daftar Surat Kontrol / SPRI lokal (dibuat lewat tab Surat
  // Kontrol / SPRI Rawat Inap yang sudah ada), dipicu dua tombol paperclip
  // di sebelah No.SKDP/SPRI supaya staf tinggal pilih no. surat yang sudah
  // ada alih-alih ketik manual. Untuk SPRI difilter ke No. Kartu/No. Rawat
  // yang sedang diisi di form (kalau ada); Surat Kontrol tidak punya kolom
  // identitas pasien lokal (cuma no_sep), jadi ditampilkan apa adanya
  // (terbaru dulu) dan staf yang mencocokkan lewat No. SEP/dokter/poli.
  const [skdpPicker, setSkdpPicker] = React.useState<{ loading: boolean; error: string; type: 'kontrol' | 'spri'; items: any[] } | null>(null);

  const handleCariSkdp = async (type: 'kontrol' | 'spri') => {
    setSkdpPicker({ loading: true, error: '', type, items: [] });
    try {
      const url = type === 'kontrol' ? '/api/bridging/surat-kontrol/list' : '/api/bridging/spri-ranap/list';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || 'Gagal mengambil daftar');
      let items: any[] = Array.isArray(data) ? data : [];
      if (type === 'spri' && (form.no_kartu.trim() || form.no_rawat.trim())) {
        items = items.filter(
          (it) => (form.no_kartu.trim() && it.no_kartu === form.no_kartu.trim()) || (form.no_rawat.trim() && it.no_rawat === form.no_rawat.trim())
        );
      }
      setSkdpPicker({ loading: false, error: '', type, items });
    } catch (err) {
      setSkdpPicker({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', type, items: [] });
    }
  };

  const handlePilihSkdp = (item: any) => {
    const noSurat = skdpPicker?.type === 'kontrol' ? item.no_surat_kontrol : item.no_surat_spri;
    setForm((p) => ({ ...p, noskdp: noSurat || p.noskdp }));
    setSkdpPicker(null);
  };

  // suplesiPicker — daftar potensi SEP suplesi Jasa Raharja (GET
  // sep/JasaRaharja/Suplesi/{noKartu}/tglPelayanan/{tgl}, bagian 6.2),
  // dipicu tombol paperclip di sebelah No.SEP Suplesi. Parameter-nya
  // No.Kartu Peserta (bukan No.SEP — sempat salah sebelum dicek ulang).
  const [suplesiPicker, setSuplesiPicker] = React.useState<{ loading: boolean; error: string; items: any[] } | null>(null);

  const handleCariSuplesi = async () => {
    const noKartu = form.no_kartu.trim();
    if (!noKartu) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu untuk mencari potensi SEP suplesi' });
      return;
    }
    setSuplesiPicker({ loading: true, error: '', items: [] });
    try {
      const tgl = form.tglsep || localDateStr();
      const res = await fetch(`/api/bridging/sep/suplesi/${encodeURIComponent(noKartu)}?tgl_pelayanan=${tgl}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data suplesi');
      const raw = data.suplesi ?? data;
      const items = Array.isArray(raw?.jaminan) ? raw.jaminan : [];
      setSuplesiPicker({ loading: false, error: '', items });
    } catch (err) {
      setSuplesiPicker({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] });
    }
  };

  const handlePilihSuplesi = (item: any) => {
    setForm((p) => ({ ...p, suplesi: '1', no_sep_suplesi: item.noSep || p.no_sep_suplesi }));
    setSuplesiPicker(null);
  };

  // kllIndukPicker — daftar SEP induk KLL (Kecelakaan Lalu Lintas) milik
  // peserta (GET sep/KllInduk/List/{noKartu}), dipicu tombol paperclip di
  // sebelah "Laka Lantas". Pilih satu untuk otomatis mengisi lokasi
  // kejadian & keterangan dari kasus KLL yang sudah ada — dipakai saat
  // membuat SEP suplesi/lanjutan untuk kasus yang sama.
  const [kllIndukPicker, setKllIndukPicker] = React.useState<{ loading: boolean; error: string; items: any[] } | null>(null);

  const handleCariKllInduk = async () => {
    const noKartu = form.no_kartu.trim();
    if (!noKartu) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu untuk mencari SEP induk kecelakaan' });
      return;
    }
    setKllIndukPicker({ loading: true, error: '', items: [] });
    try {
      const res = await fetch(`/api/bridging/sep/kll-induk/${encodeURIComponent(noKartu)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data induk kecelakaan');
      const raw = data.kll_induk ?? data;
      const items = Array.isArray(raw?.list) ? raw.list : [];
      setKllIndukPicker({ loading: false, error: '', items });
    } catch (err) {
      setKllIndukPicker({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] });
    }
  };

  const handlePilihKllInduk = (item: any) => {
    setForm((p) => ({
      ...p,
      lakalantas: p.lakalantas || '1',
      tglkkl: item.tglKejadian || p.tglkkl,
      kdprop: item.kdProp || p.kdprop,
      kdkab: item.kdKab || p.kdkab,
      kdkec: item.kdKec || p.kdkec,
      keterangankkl: item.ketKejadian || p.keterangankkl,
    }));
    setKllIndukPicker(null);
  };

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/sep/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data SEP');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari, tglSampai, searchText]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // getLoggedInUsername — "user" yang dikirim ke BPJS Insert/Update SEP
  // otomatis dari user yang sedang login (ermapp_user di localStorage,
  // diisi App.tsx saat login), BUKAN diketik manual — meniru
  // BPJSDataSEP.java (Khanza Desktop) yang mengambilnya dari sesi login,
  // bukan field terpisah di form.
  const getLoggedInUsername = (): string => {
    try {
      const stored = window.localStorage.getItem('ermapp_user');
      if (!stored) return '';
      const u = JSON.parse(stored);
      return u?.username || '';
    } catch {
      return '';
    }
  };

  const openInputModal = () => {
    setForm({ ...emptyForm(), user_entry: getLoggedInUsername() });
    setEditingNoSep(null);
    setStatusPeserta('');
    setRujukanPicker(null);
    setSkdpPicker(null);
    setSuplesiPicker(null);
    setKllIndukPicker(null);
    setShowModal(true);
  };

  // enumChecked converte teks enum lengkap ("1.Ya", "0. Tidak") dari DB jadi
  // kode sederhana ('1' / '') dipakai checkbox di form — sama seperti
  // suplesi yang sudah lebih dulu dikonversi begini.
  const enumChecked = (v: string) => (v && v.startsWith('1') ? '1' : '');

  const openEditModal = (item: SepItem) => {
    setForm({
      ...emptyForm(),
      ...item,
      tglsep: item.tglsep && !item.tglsep.startsWith('0000-00-00') ? item.tglsep.split('T')[0] : localDateStr(),
      tglrujukan: item.tglrujukan && !item.tglrujukan.startsWith('0000-00-00') ? item.tglrujukan.split('T')[0] : '',
      tanggal_lahir: item.tanggal_lahir && !item.tanggal_lahir.startsWith('0000-00-00') ? item.tanggal_lahir.split('T')[0] : '',
      tglkkl: item.tglkkl && !item.tglkkl.startsWith('0000-00-00') ? item.tglkkl.split('T')[0] : '',
      suplesi: enumChecked(item.suplesi),
      eksekutif: enumChecked(item.eksekutif),
      cob: enumChecked(item.cob),
      katarak: enumChecked(item.katarak),
      asal_rujukan: item.asal_rujukan && item.asal_rujukan.startsWith('2') ? '2' : '1',
      tujuankunjungan: item.tujuankunjungan || '0',
      // "user" pada update juga selalu staf yang SEDANG login melakukan
      // perubahan ini, bukan yang membuat SEP pertama kali.
      user_entry: getLoggedInUsername(),
    });
    setEditingNoSep(item.no_sep);
    setStatusPeserta('');
    setRujukanPicker(null);
    setSkdpPicker(null);
    setSuplesiPicker(null);
    setKllIndukPicker(null);
    setShowModal(true);
  };

  // handleSave — SEP baru langsung dikirim ke BPJS (POST .../sep/insert),
  // BUKAN disimpan lokal dulu sebagai draft. No. SEP resminya datang dari
  // BPJS di response, makanya tidak ada lagi field No. SEP di form (lihat
  // BPJSDataSEP.java, method insertSEP() — VClaim Insert SEP sama sekali
  // tidak menerima noSep sebagai input).
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let fingerprintVerified = false;
    if (requiresFingerprint(form.nmpolitujuan)) {
      const fpConfirm = await Swal.fire({
        title: 'Validasi Sidik Jari Diperlukan',
        html: `SEP untuk poli <strong>${form.nmpolitujuan}</strong> wajib divalidasi sidik jari sebelum diterbitkan.<br/>Sudah dilakukan validasi sidik jari?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sudah, Lanjutkan',
        cancelButtonText: 'Batal',
      });
      if (!fpConfirm.isConfirmed) return;
      fingerprintVerified = true;
    }

    setSaving(true);
    try {
      const url = `/api/bridging/sep/insert${fingerprintVerified ? '?fingerprint_verified=1' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat SEP');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `SEP berhasil dibuat — No. SEP: ${data.no_sep}`, timer: 3000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/sep/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui SEP');
      setShowModal(false);
      setEditingNoSep(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'SEP berhasil diperbarui', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // 16.1.1 — poli mata/jantung/IRM/hemodialisa wajib validasi sidik jari
  // sebelum SEP diterbitkan. Cermin dari sepRequiresFingerprint di backend.
  const requiresFingerprint = (nmPoliTujuan: string) => {
    const poli = (nmPoliTujuan || '').toLowerCase();
    return ['mata', 'jantung', 'irm', 'rehabilitasi medik', 'fisioterapi', 'hemodialisa', 'hemodialisis'].some((kw) => poli.includes(kw));
  };

  const handleKirim = async (item: SepItem) => {
    const noSep = item.no_sep;
    let fingerprintVerified = false;

    if (requiresFingerprint(item.nmpolitujuan)) {
      const fpConfirm = await Swal.fire({
        title: 'Validasi Sidik Jari Diperlukan',
        html: `SEP untuk poli <strong>${item.nmpolitujuan}</strong> wajib divalidasi sidik jari sebelum diterbitkan.<br/>Sudah dilakukan validasi sidik jari?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sudah, Lanjutkan',
        cancelButtonText: 'Batal',
      });
      if (!fpConfirm.isConfirmed) return;
      fingerprintVerified = true;
    }

    const confirm = await Swal.fire({
      title: 'Kirim SEP ke BPJS?',
      text: `No. SEP: ${noSep}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Kirim',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    setSendingNoSep(noSep);
    try {
      const url = `/api/bridging/sep/kirim/${encodeURIComponent(noSep)}${fingerprintVerified ? '?fingerprint_verified=1' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim SEP ke BPJS');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terkirim!', text: data.no_sep ? `No. SEP: ${data.no_sep}` : data.message || 'SEP berhasil dikirim ke BPJS' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Kirim', text: err.message });
    } finally {
      setSendingNoSep(null);
    }
  };

  const handleHapus = async (noSep: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus SEP?',
      text: `No. SEP: ${noSep} akan dihapus dari BPJS dan data lokal`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingNoSep(noSep);
    try {
      const url = `/api/bridging/sep/${encodeURIComponent(noSep)}?user=${encodeURIComponent(getLoggedInUsername())}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus SEP');
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'SEP berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingNoSep(null);
    }
  };

  // Tab "Data SEP Internal" — bagian 10 VClaim (SEP internal antar
  // instalasi/RS), tabel bridging_sep_internal, kolomnya identik dengan
  // "Data SEP" (tabModeInternal di BPJSDataSEP.java sama persis dengan
  // tabMode). Dimuat lewat endpoint terpisah, hanya sekali saat tab
  // pertama kali dibuka.
  const [sepTab, setSepTab] = React.useState<'sep' | 'internal'>('sep');
  const [internalItems, setInternalItems] = React.useState<SepItem[]>([]);
  const [internalLoading, setInternalLoading] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string | null>(null);
  const [deletingInternalNoSep, setDeletingInternalNoSep] = React.useState<string | null>(null);

  const fetchInternalItems = React.useCallback(async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      let url = `/api/bridging/sep-internal/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data SEP Internal');
      const data = await res.json();
      setInternalItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setInternalItems([]);
    } finally {
      setInternalLoading(false);
    }
  }, [tglDari, tglSampai, searchText]);

  React.useEffect(() => {
    if (sepTab === 'internal') {
      fetchInternalItems();
    }
  }, [sepTab, fetchInternalItems]);

  const handleHapusInternal = async (noSep: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus SEP Internal?',
      text: `No. SEP: ${noSep} akan dihapus dari BPJS dan data lokal`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingInternalNoSep(noSep);
    try {
      const url = `/api/bridging/sep-internal/${encodeURIComponent(noSep)}?user=${encodeURIComponent(getLoggedInUsername())}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus SEP Internal');
      await fetchInternalItems();
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message || 'SEP Internal berhasil dihapus' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message });
    } finally {
      setDeletingInternalNoSep(null);
    }
  };

  const openPulangModal = (noSep: string) => {
    setPulangForm({ tgl_pulang: localDateStr(), cara_pulang: '', no_surat_kematian: '', no_laporan_polisi: '', user_entry: '' });
    setPulangNoSep(noSep);
  };

  const handleUpdatePulang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pulangNoSep) return;
    setSavingPulang(true);
    try {
      const res = await fetch('/api/bridging/sep/update-tgl-pulang', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_sep: pulangNoSep, ...pulangForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tanggal pulang');
      setPulangNoSep(null);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Tanggal pulang berhasil diperbarui', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSavingPulang(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Tab switch — "Data SEP" / "Data SEP Internal" (bagian 10 VClaim,
          tabel bridging_sep_internal, kolomnya sama persis dengan Data SEP,
          lihat tabMode/tabModeInternal di BPJSDataSEP.java) */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
        {(['sep', 'internal'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSepTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: sepTab === tab ? '#ffffff' : 'transparent',
              color: sepTab === tab ? '#111827' : '#6b7280',
              fontWeight: sepTab === tab ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: sepTab === tab ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'sep' ? 'Data SEP' : 'Data SEP Internal'}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari No. SEP / No. Rawat / Nama Pasien"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s.d.</span>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        {sepTab === 'sep' && (
          <button
            type="button"
            onClick={openInputModal}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            + Input SEP
          </button>
        )}
      </div>

      {(sepTab === 'sep' ? error : internalError) && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {sepTab === 'sep' ? error : internalError}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {SEP_COLUMNS.map((col) => (
                <th key={col.label} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 400 }}>{col.label}</th>
              ))}
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb', position: 'sticky', right: 0, background: '#f3f4f6', fontWeight: 400 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sepTab === 'sep' ? (
              loading ? (
                <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data SEP</td></tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.no_sep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    {SEP_COLUMNS.map((col) => (
                      <td key={col.label} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                        {col.render(item)}
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', right: 0, background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleKirim(item)}
                          disabled={sendingNoSep === item.no_sep}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #2563eb',
                            background: '#ffffff',
                            color: '#2563eb',
                            cursor: sendingNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {sendingNoSep === item.no_sep ? 'Mengirim...' : 'Kirim ke BPJS'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #d97706',
                            background: '#ffffff',
                            color: '#d97706',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => openPulangModal(item.no_sep)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #16a34a',
                            background: '#ffffff',
                            color: '#16a34a',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          Pulang
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHapus(item.no_sep)}
                          disabled={deletingNoSep === item.no_sep}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #dc2626',
                            background: '#ffffff',
                            color: '#dc2626',
                            cursor: deletingNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {deletingNoSep === item.no_sep ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : internalLoading ? (
              <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : internalItems.length === 0 ? (
              <tr><td colSpan={SEP_COLUMNS.length + 1} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data SEP Internal</td></tr>
            ) : (
              internalItems.map((item, index) => (
                <tr key={item.no_sep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  {SEP_COLUMNS.map((col) => (
                    <td key={col.label} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                      {col.render(item)}
                    </td>
                  ))}
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', position: 'sticky', right: 0, background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <button
                      type="button"
                      onClick={() => handleHapusInternal(item.no_sep)}
                      disabled={deletingInternalNoSep === item.no_sep}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #dc2626',
                        background: '#ffffff',
                        color: '#dc2626',
                        cursor: deletingInternalNoSep === item.no_sep ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {deletingInternalNoSep === item.no_sep ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Input SEP — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingNoSep ? `Update SEP — ${editingNoSep}` : 'Input SEP'}</span>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingNoSep(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={editingNoSep ? handleUpdate : handleSave} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 20, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Row label="No. Rawat">
                <input
                  required
                  style={{ ...pillInput, flex: '0 0 180px' }}
                  value={form.no_rawat}
                  onChange={(e) => setForm((p) => ({ ...p, no_rawat: e.target.value }))}
                  placeholder="2026/07/16/000001"
                />
                <input style={{ ...pillInput, flex: '0 0 130px' }} value={form.nomr} onChange={(e) => setForm((p) => ({ ...p, nomr: e.target.value }))} placeholder="No. RM" />
                <input style={pillInput} value={form.nama_pasien} onChange={(e) => setForm((p) => ({ ...p, nama_pasien: e.target.value }))} placeholder="Nama Pasien" />
              </Row>

              <Row label="Tgl. Lahir">
                <input
                  disabled
                  type="date"
                  style={{ ...pillInput, flex: '0 0 170px', background: '#f3f4f6', color: '#6b7280' }}
                  value={form.tanggal_lahir}
                  onChange={(e) => setForm((p) => ({ ...p, tanggal_lahir: e.target.value }))}
                />
                <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Peserta :</div>
                <input style={pillInput} value={form.peserta} onChange={(e) => setForm((p) => ({ ...p, peserta: e.target.value }))} placeholder="Jenis kepesertaan" />
                <div style={{ width: 42, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>J.K. :</div>
                <input style={{ ...pillInput, flex: '0 0 60px' }} value={form.jkel} onChange={(e) => setForm((p) => ({ ...p, jkel: e.target.value }))} placeholder="JK" maxLength={1} />
                <div style={{ width: 94, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Asal Rujukan :</div>
                <PillSelect
                  value={form.asal_rujukan}
                  onChange={(v) => setForm((p) => ({ ...p, asal_rujukan: v }))}
                  options={[{ value: '1', label: '1. Faskes 1' }, { value: '2', label: '2. Faskes 2 (RS)' }]}
                  style={{ flex: '0 0 170px' }}
                />
              </Row>

              <Row label="No. Kartu">
                <input
                  required
                  style={{ ...pillInput, flex: '0 0 220px' }}
                  value={form.no_kartu}
                  onChange={(e) => setForm((p) => ({ ...p, no_kartu: e.target.value }))}
                  onBlur={handleCekPeserta}
                />
                <div style={{ width: 50, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Status :</div>
                <input readOnly style={{ ...pillInput, flex: '0 0 150px', background: '#f9fafb', color: '#374151' }} value={checkingPeserta ? 'Mengecek...' : statusPeserta} />
                <div style={{ width: 94, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>No. Rujukan :</div>
                <input style={pillInput} value={form.no_rujukan} onChange={(e) => setForm((p) => ({ ...p, no_rujukan: e.target.value }))} />
                <PaperclipButton title="Pilih rujukan baru dari BPJS (berdasarkan No. Kartu)" onClick={() => handleCariRujukan('kartu')} />
                <PaperclipButton title="Cek No. Rujukan yang diketik" onClick={() => handleCariRujukan('rujukan')} />
              </Row>

              {rujukanPicker && (
                <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Pilih No. Rujukan Baru (Rujukan Aktif BPJS)</span>
                    <button type="button" onClick={() => setRujukanPicker(null)} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                      &times;
                    </button>
                  </div>
                  {rujukanPicker.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari rujukan aktif...</div>}
                  {rujukanPicker.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{rujukanPicker.error}</div>}
                  {!rujukanPicker.loading && !rujukanPicker.error && rujukanPicker.items.length === 0 && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ada rujukan aktif untuk No. Kartu ini.</div>
                  )}
                  {rujukanPicker.items.map((item, idx) => {
                    const noRujukan = findRujukanField(item, ['noRujukan', 'no_rujukan', 'nomorRujukan', 'noKunjungan']) || `Data ${idx + 1}`;
                    const tglRujukan = findRujukanField(item, ['tglRujukan', 'tgl_rujukan', 'tglKunjungan']);
                    const poli = findRujukanField(item, ['poliRujukan.nama', 'poliTujuan', 'namaPoli']);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePilihRujukan(item)}
                        style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#ffffff', cursor: 'pointer', fontSize: 12, color: '#111827' }}
                      >
                        <strong>{noRujukan}</strong>
                        {tglRujukan ? ` — ${tglRujukan}` : ''}
                        {poli ? ` — ${poli}` : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {/* Kolom kiri — identitas pasien & routing kunjungan */}
                <div style={{ flex: 1, minWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Row label="Tgl. Rujuk">
                    <input type="date" style={pillInput} value={form.tglrujukan} onChange={(e) => setForm((p) => ({ ...p, tglrujukan: e.target.value }))} />
                    <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Tgl. SEP :</div>
                    <input required type="date" style={pillInput} value={form.tglsep} onChange={(e) => setForm((p) => ({ ...p, tglsep: e.target.value }))} />
                  </Row>
                  <Row label="No. SKDP/SPRI">
                    <input style={pillInput} value={form.noskdp} onChange={(e) => setForm((p) => ({ ...p, noskdp: e.target.value }))} placeholder="Wajib jika Rawat Inap" />
                    <PaperclipButton title="Pilih dari Surat Kontrol" onClick={() => handleCariSkdp('kontrol')} />
                    <PaperclipButton title="Pilih dari SPRI Rawat Inap" onClick={() => handleCariSkdp('spri')} />
                  </Row>

                  {skdpPicker && (
                    <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>
                          Pilih No. {skdpPicker.type === 'kontrol' ? 'Surat Kontrol' : 'SPRI Rawat Inap'}
                        </span>
                        <button type="button" onClick={() => setSkdpPicker(null)} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                          &times;
                        </button>
                      </div>
                      {skdpPicker.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat daftar...</div>}
                      {skdpPicker.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{skdpPicker.error}</div>}
                      {!skdpPicker.loading && !skdpPicker.error && skdpPicker.items.length === 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          Belum ada data {skdpPicker.type === 'kontrol' ? 'Surat Kontrol' : 'SPRI'}
                          {skdpPicker.type === 'spri' && (form.no_kartu || form.no_rawat) ? ' untuk pasien ini' : ''}.
                        </div>
                      )}
                      {skdpPicker.items.map((item, idx) => {
                        const noSurat = skdpPicker.type === 'kontrol' ? item.no_surat_kontrol : item.no_surat_spri;
                        const tgl = skdpPicker.type === 'kontrol' ? item.tgl_rencana_kontrol : item.tgl_rencana_ranap;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handlePilihSkdp(item)}
                            style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#ffffff', cursor: 'pointer', fontSize: 12, color: '#111827' }}
                          >
                            <strong>{noSurat}</strong> — {tgl} — {item.nm_dokter || '-'} — {item.nm_poli || '-'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Row label="PPK Rujukan">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdppkrujukan} onChange={(e) => setForm((p) => ({ ...p, kdppkrujukan: e.target.value }))} />
                    <input style={pillInput} value={form.nmppkrujukan} onChange={(e) => setForm((p) => ({ ...p, nmppkrujukan: e.target.value }))} />
                    <PaperclipButton title="Cari PPK rujukan" />
                  </Row>
                  <Row label="Diagnosa Awal">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.diagawal} onChange={(e) => setForm((p) => ({ ...p, diagawal: e.target.value }))} placeholder="ICD-10" />
                    <input style={pillInput} value={form.nmdiagnosaawal} onChange={(e) => setForm((p) => ({ ...p, nmdiagnosaawal: e.target.value }))} />
                    <PaperclipButton title="Cari diagnosa" />
                  </Row>
                  <Row label="Poli Tujuan">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdpolitujuan} onChange={(e) => setForm((p) => ({ ...p, kdpolitujuan: e.target.value }))} />
                    <input style={pillInput} value={form.nmpolitujuan} onChange={(e) => setForm((p) => ({ ...p, nmpolitujuan: e.target.value }))} />
                    <PaperclipButton title="Cari poli" />
                  </Row>
                  <Row label="Dokter DPJP">
                    <input required style={{ ...pillInput, flex: '0 0 90px' }} value={form.kddpjp} onChange={(e) => setForm((p) => ({ ...p, kddpjp: e.target.value }))} />
                    <input style={pillInput} value={form.nmdpdjp} onChange={(e) => setForm((p) => ({ ...p, nmdpdjp: e.target.value }))} />
                    <PaperclipButton title="Cari dokter" />
                  </Row>
                  <Row label="PPK Pelayanan">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdppkpelayanan} onChange={(e) => setForm((p) => ({ ...p, kdppkpelayanan: e.target.value }))} />
                    <input style={pillInput} value={form.nmppkpelayanan} onChange={(e) => setForm((p) => ({ ...p, nmppkpelayanan: e.target.value }))} />
                  </Row>
                  <Row label="Jns. Pelayanan">
                    <PillSelect
                      value={form.jnspelayanan}
                      onChange={(v) => setForm((p) => ({ ...p, jnspelayanan: v }))}
                      options={[{ value: '1', label: '1. Ranap' }, { value: '2', label: '2. Ralan' }]}
                    />
                    <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Kelas :</div>
                    <PillSelect
                      value={form.klsrawat}
                      onChange={(v) => setForm((p) => ({ ...p, klsrawat: v }))}
                      options={[{ value: '1', label: '1. Kelas 1' }, { value: '2', label: '2. Kelas 2' }, { value: '3', label: '3. Kelas 3' }]}
                    />
                  </Row>
                  <Row label="Naik Kelas">
                    <PillSelect
                      value={form.klsnaik}
                      onChange={(v) => setForm((p) => ({ ...p, klsnaik: v }))}
                      options={[
                        { value: '', label: 'Tidak naik kelas' },
                        { value: '1', label: '1. Kelas 1' },
                        { value: '2', label: '2. Kelas 2' },
                        { value: '3', label: '3. Kelas 3' },
                      ]}
                    />
                    <PillSelect
                      value={form.pembiayaan}
                      onChange={(v) => setForm((p) => ({ ...p, pembiayaan: v }))}
                      options={[
                        { value: '', label: 'Pembiayaan -' },
                        { value: '1', label: '1. Askes/BPJS TK' },
                        { value: '2', label: '2. Pemberi Kerja' },
                        { value: '3', label: '3. Asuransi Tambahan' },
                      ]}
                    />
                  </Row>
                  <Row label="P.J. Naik Kelas">
                    <input style={pillInput} value={form.pjnaikkelas} onChange={(e) => setForm((p) => ({ ...p, pjnaikkelas: e.target.value }))} />
                  </Row>
                  <Row label="Eksekutif">
                    <PillSelect value={form.eksekutif} onChange={(v) => setForm((p) => ({ ...p, eksekutif: v }))} options={YA_TIDAK_OPTIONS} />
                    <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>COB :</div>
                    <PillSelect value={form.cob} onChange={(v) => setForm((p) => ({ ...p, cob: v }))} options={YA_TIDAK_OPTIONS} />
                  </Row>
                  <Row label="Catatan">
                    <textarea rows={1} style={{ ...pillInput, resize: 'none' }} value={form.catatan} onChange={(e) => setForm((p) => ({ ...p, catatan: e.target.value }))} />
                  </Row>
                </div>

                {/* Kolom kanan — klasifikasi SEP, KLL/Jasa Raharja, DPJP layanan */}
                <div style={{ flex: 1, minWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Row label="Katarak">
                    <PillSelect value={form.katarak} onChange={(v) => setForm((p) => ({ ...p, katarak: v }))} options={YA_TIDAK_OPTIONS} style={{ flex: '0 0 170px' }} />
                    <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>No. Telp :</div>
                    <input required style={pillInput} value={form.notelep} onChange={(e) => setForm((p) => ({ ...p, notelep: e.target.value }))} />
                  </Row>
                  <Row label="Tujuan Kunjungan">
                    <PillSelect
                      value={form.tujuankunjungan}
                      onChange={(v) => setForm((p) => ({ ...p, tujuankunjungan: v }))}
                      options={[
                        { value: '0', label: '0. Normal' },
                        { value: '1', label: '1. Konsul Dokter Lain' },
                        { value: '2', label: '2. Prosedur / Tindakan Lanjutan' },
                      ]}
                    />
                  </Row>
                  <Row label="Flag Prosedur">
                    <PillSelect
                      value={form.flagprosedur}
                      onChange={(v) => setForm((p) => ({ ...p, flagprosedur: v }))}
                      options={[
                        { value: '', label: '-' },
                        { value: '0', label: '0. Tidak Ada Prosedur' },
                        { value: '1', label: '1. Ada Prosedur' },
                      ]}
                    />
                  </Row>
                  <Row label="Penunjang">
                    <PillSelect
                      value={form.penunjang}
                      onChange={(v) => setForm((p) => ({ ...p, penunjang: v }))}
                      options={[{ value: '', label: '-' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Kode ${i + 1}` }))]}
                    />
                  </Row>
                  <Row label="Asesmen Pelayanan">
                    <PillSelect
                      value={form.asesmenpelayanan}
                      onChange={(v) => setForm((p) => ({ ...p, asesmenpelayanan: v }))}
                      options={[{ value: '', label: '-' }, ...Array.from({ length: 5 }, (_, i) => ({ value: String(i + 1), label: `Kode ${i + 1}` }))]}
                    />
                  </Row>
                  <Row label="DPJP Layanan">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kddpjplayanan} onChange={(e) => setForm((p) => ({ ...p, kddpjplayanan: e.target.value }))} />
                    <input style={pillInput} value={form.nmdpjplayanan} onChange={(e) => setForm((p) => ({ ...p, nmdpjplayanan: e.target.value }))} />
                    <PaperclipButton title="Cari dokter layanan" />
                  </Row>

                  <div style={{ borderTop: '1px dashed #d1d5db', marginTop: 4, paddingTop: 10, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Kecelakaan Lalu Lintas (KLL) / Jasa Raharja
                  </div>
                  <Row label="Laka Lantas">
                    <PillSelect
                      value={form.lakalantas}
                      onChange={(v) => setForm((p) => ({ ...p, lakalantas: v }))}
                      options={[
                        { value: '', label: 'Bukan KLL' },
                        { value: '0', label: '0. Bukan Lakalantas' },
                        { value: '1', label: '1. Lakalantas Tunggal' },
                        { value: '2', label: '2. Lakalantas Ganda' },
                        { value: '3', label: '3. Lakalantas Susulan' },
                      ]}
                    />
                    <div style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Tgl :</div>
                    <input type="date" style={pillInput} value={form.tglkkl} onChange={(e) => setForm((p) => ({ ...p, tglkkl: e.target.value }))} />
                    <PaperclipButton title="Cari SEP induk kecelakaan (berdasarkan No. Kartu)" onClick={handleCariKllInduk} />
                  </Row>

                  {kllIndukPicker && (
                    <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Pilih SEP Induk Kecelakaan</span>
                        <button type="button" onClick={() => setKllIndukPicker(null)} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                          &times;
                        </button>
                      </div>
                      {kllIndukPicker.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari...</div>}
                      {kllIndukPicker.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{kllIndukPicker.error}</div>}
                      {!kllIndukPicker.loading && !kllIndukPicker.error && kllIndukPicker.items.length === 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ada data induk kecelakaan untuk No. Kartu ini.</div>
                      )}
                      {kllIndukPicker.items.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePilihKllInduk(item)}
                          style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#ffffff', cursor: 'pointer', fontSize: 12, color: '#111827' }}
                        >
                          <strong>{item.noSEP}</strong> — Tgl Kejadian: {item.tglKejadian || '-'} — {item.ketKejadian || '-'}
                        </button>
                      ))}
                    </div>
                  )}
                  <Row label="Propinsi KLL">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdprop} onChange={(e) => setForm((p) => ({ ...p, kdprop: e.target.value }))} />
                    <input style={pillInput} value={form.nmprop} onChange={(e) => setForm((p) => ({ ...p, nmprop: e.target.value }))} />
                    <PaperclipButton title="Cari propinsi" />
                  </Row>
                  <Row label="Kabupaten KLL">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdkab} onChange={(e) => setForm((p) => ({ ...p, kdkab: e.target.value }))} />
                    <input style={pillInput} value={form.nmkab} onChange={(e) => setForm((p) => ({ ...p, nmkab: e.target.value }))} />
                    <PaperclipButton title="Cari kabupaten" />
                  </Row>
                  <Row label="Kecamatan KLL">
                    <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdkec} onChange={(e) => setForm((p) => ({ ...p, kdkec: e.target.value }))} />
                    <input style={pillInput} value={form.nmkec} onChange={(e) => setForm((p) => ({ ...p, nmkec: e.target.value }))} />
                    <PaperclipButton title="Cari kecamatan" />
                  </Row>
                  <Row label="Keterangan">
                    <textarea
                      rows={1}
                      style={{ ...pillInput, flex: '0 0 55%', resize: 'none' }}
                      value={form.keterangankkl}
                      onChange={(e) => setForm((p) => ({ ...p, keterangankkl: e.target.value }))}
                    />
                    <div style={{ width: 50, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>No.LP :</div>
                    <input style={pillInput} value={form.no_laporan_polisi} onChange={(e) => setForm((p) => ({ ...p, no_laporan_polisi: e.target.value }))} />
                  </Row>
                  <Row label="Suplesi">
                    <PillSelect
                      value={form.suplesi}
                      onChange={(v) => setForm((p) => ({ ...p, suplesi: v }))}
                      options={[{ value: '', label: '0. Bukan Suplesi' }, { value: '1', label: '1. SEP Suplesi' }]}
                      style={{ flex: '0 0 170px' }}
                    />
                    <input style={pillInput} value={form.no_sep_suplesi} onChange={(e) => setForm((p) => ({ ...p, no_sep_suplesi: e.target.value }))} placeholder="No. SEP Suplesi" />
                    <PaperclipButton title="Cari potensi SEP suplesi Jasa Raharja (berdasarkan No. Kartu)" onClick={handleCariSuplesi} />
                  </Row>

                  {suplesiPicker && (
                    <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Pilih Potensi SEP Suplesi Jasa Raharja</span>
                        <button type="button" onClick={() => setSuplesiPicker(null)} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
                          &times;
                        </button>
                      </div>
                      {suplesiPicker.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari...</div>}
                      {suplesiPicker.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{suplesiPicker.error}</div>}
                      {!suplesiPicker.loading && !suplesiPicker.error && suplesiPicker.items.length === 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ada potensi SEP suplesi untuk No. Kartu ini.</div>
                      )}
                      {suplesiPicker.items.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePilihSuplesi(item)}
                          style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#ffffff', cursor: 'pointer', fontSize: 12, color: '#111827' }}
                        >
                          <strong>{item.noSep}</strong> — Tgl Kejadian: {item.tglKejadian || '-'} — Tgl SEP: {item.tglSep || '-'} — No. Register: {item.noRegister || '-'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingNoSep(null); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Menyimpan...' : editingNoSep ? 'Update ke BPJS' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Update Tanggal Pulang — pola default_card.md */}
      {pulangNoSep && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setPulangNoSep(null)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 480, width: '90%', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Update Tanggal Pulang — {pulangNoSep}</span>
              <button
                type="button"
                onClick={() => setPulangNoSep(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdatePulang} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Tgl Pulang *">
                <input required type="date" style={inputStyle} value={pulangForm.tgl_pulang} onChange={(e) => setPulangForm((p) => ({ ...p, tgl_pulang: e.target.value }))} />
              </Field>
              <Field label="Cara Pulang">
                <select style={inputStyle} value={pulangForm.cara_pulang} onChange={(e) => setPulangForm((p) => ({ ...p, cara_pulang: e.target.value }))}>
                  <option value="">- Lihat Referensi Cara Keluar -</option>
                  <option value="0">0 - Sembuh</option>
                  <option value="1">1 - Rujuk RS Lain</option>
                  <option value="2">2 - Atas Permintaan Sendiri</option>
                  <option value="4">4 - Meninggal</option>
                  <option value="5">5 - Lain-lain</option>
                </select>
              </Field>
              {pulangForm.cara_pulang === '4' && (
                <Field label="No. Surat Kematian * (min. 5 karakter)">
                  <input required style={inputStyle} value={pulangForm.no_surat_kematian} onChange={(e) => setPulangForm((p) => ({ ...p, no_surat_kematian: e.target.value }))} />
                </Field>
              )}
              <Field label="No. Laporan Polisi (wajib jika SEP KLL, min. 5 karakter)">
                <input style={inputStyle} value={pulangForm.no_laporan_polisi} onChange={(e) => setPulangForm((p) => ({ ...p, no_laporan_polisi: e.target.value }))} />
              </Field>
              <Field label="User Entry">
                <input style={inputStyle} value={pulangForm.user_entry} onChange={(e) => setPulangForm((p) => ({ ...p, user_entry: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setPulangNoSep(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingPulang}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingPulang ? '#9ca3af' : '#16a34a', color: '#fff', cursor: savingPulang ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {savingPulang ? 'Menyimpan...' : 'Update ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
