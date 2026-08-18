import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';
import { HistoriPelayananBpjsModal } from './HistoriPelayananBpjsModal';

// ModalPengajuanSEP — SepItem, emptyForm, formatTgl, dan seluruh form Input/
// Update SEP diekstrak dari BpjsSep.tsx (modul Bridging > SEP) supaya bisa
// dipakai ulang persis sama dari Pendaftaran (tombol "[BPJS] > Cetak SEP")
// tanpa duplikasi ~400 baris form. BpjsSepView tetap jadi "pemilik"
// daftar/tabel SEP; komponen ini murni form input/update-nya saja.
export type SepItem = {
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

export const emptyForm = (): SepItem => ({
  no_sep: '',
  no_rawat: '',
  tglsep: localDateStr(),
  // Persis Khanza Desktop: Tgl. Rujuk otomatis terisi tanggal hari ini
  // saat dialog Cetak SEP dibuka (masih bisa diedit manual kalau rujukan
  // sebenarnya dari tanggal lain).
  tglrujukan: localDateStr(),
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

export const formatTgl = (tgl: string) => {
  if (!tgl || tgl.startsWith('0000-00-00')) return '-';
  const datePart = tgl.includes('T') ? tgl.split('T')[0] : tgl;
  const [y, m, d] = datePart.split('-');
  return y && m && d ? `${d}/${m}/${y}` : datePart;
};

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

// getLoggedInUsername — "user" yang dikirim ke BPJS Insert/Update SEP
// otomatis dari user yang sedang login (ermapp_user di localStorage,
// diisi App.tsx saat login), BUKAN diketik manual — meniru
// BPJSDataSEP.java (Khanza Desktop) yang mengambilnya dari sesi login.
// Diekspor krn dipakai juga di BpjsSep.tsx (handleHapus/handleHapusInternal).
export const getLoggedInUsername = (): string => {
  try {
    const stored = window.localStorage.getItem('ermapp_user');
    if (!stored) return '';
    const u = JSON.parse(stored);
    return u?.username || '';
  } catch {
    return '';
  }
};

// enumChecked converte teks enum lengkap ("1.Ya", "0. Tidak") dari DB jadi
// kode sederhana ('1' / '') dipakai checkbox di form.
const enumChecked = (v: string) => (v && v.startsWith('1') ? '1' : '');

// 16.1.1 — poli mata/jantung/IRM/hemodialisa wajib validasi sidik jari
// sebelum SEP diterbitkan. Cermin dari sepRequiresFingerprint di backend.
// Diekspor krn dipakai juga di BpjsSep.tsx (handleKirim, tombol "Kirim ke BPJS").
export const requiresFingerprint = (nmPoliTujuan: string) => {
  const poli = (nmPoliTujuan || '').toLowerCase();
  return ['mata', 'jantung', 'irm', 'rehabilitasi medik', 'fisioterapi', 'hemodialisa', 'hemodialisis'].some((kw) => poli.includes(kw));
};

const buildInitialForm = (editingItem: SepItem | null, initialData?: Partial<SepItem>): SepItem => {
  if (editingItem) {
    return {
      ...emptyForm(),
      ...editingItem,
      tglsep: editingItem.tglsep && !editingItem.tglsep.startsWith('0000-00-00') ? editingItem.tglsep.split('T')[0] : localDateStr(),
      tglrujukan: editingItem.tglrujukan && !editingItem.tglrujukan.startsWith('0000-00-00') ? editingItem.tglrujukan.split('T')[0] : '',
      tanggal_lahir: editingItem.tanggal_lahir && !editingItem.tanggal_lahir.startsWith('0000-00-00') ? editingItem.tanggal_lahir.split('T')[0] : '',
      tglkkl: editingItem.tglkkl && !editingItem.tglkkl.startsWith('0000-00-00') ? editingItem.tglkkl.split('T')[0] : '',
      suplesi: enumChecked(editingItem.suplesi),
      eksekutif: enumChecked(editingItem.eksekutif),
      cob: enumChecked(editingItem.cob),
      katarak: enumChecked(editingItem.katarak),
      asal_rujukan: editingItem.asal_rujukan && editingItem.asal_rujukan.startsWith('2') ? '2' : '1',
      tujuankunjungan: editingItem.tujuankunjungan || '0',
      // "user" pada update juga selalu staf yang SEDANG login melakukan
      // perubahan ini, bukan yang membuat SEP pertama kali.
      user_entry: getLoggedInUsername(),
    };
  }
  return { ...emptyForm(), ...initialData, user_entry: getLoggedInUsername() };
};

type ModalPengajuanSEPProps = {
  editingItem: SepItem | null; // null = mode Input baru, terisi = mode Update
  initialData?: Partial<SepItem>; // prefill utk mode baru (dari Pendaftaran)
  onClose: () => void;
  onSaved: () => void; // dipanggil setelah simpan/update berhasil (refresh daftar di pemanggil)
};

export const ModalPengajuanSEP: React.FC<ModalPengajuanSEPProps> = ({ editingItem, initialData, onClose, onSaved }) => {
  const [form, setForm] = React.useState<SepItem>(() => buildInitialForm(editingItem, initialData));
  const [saving, setSaving] = React.useState(false);
  const [statusPeserta, setStatusPeserta] = React.useState('');
  const [checkingPeserta, setCheckingPeserta] = React.useState(false);
  const editingNoSep = editingItem?.no_sep || null;

  // sepMenu — tombol "+" di sebelah No. Kartu, padanan combo box Khanza
  // Desktop (Pengajuan/Aproval SEP Backdate & Finger, Ambil SEP di VClaim,
  // Status Finger). Baru UI-nya dulu — fungsinya menyusul, jadi tiap item
  // sementara cuma nutup menu + kasih tahu belum tersedia.
  const [showSepMenu, setShowSepMenu] = React.useState(false);
  const [sepMenuPos, setSepMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const sepMenuRef = React.useRef<HTMLDivElement>(null);
  const sepMenuBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sepMenuRef.current && !sepMenuRef.current.contains(event.target as Node) &&
        sepMenuBtnRef.current && !sepMenuBtnRef.current.contains(event.target as Node)
      ) {
        setShowSepMenu(false);
      }
    };
    if (showSepMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSepMenu]);

  const SEP_MENU_ITEMS = [
    'Pengajuan SEP Backdate',
    'Aproval SEP Backdate',
    'Aproval SEP Finger',
    'Persetujuan SEP tanpa Fingerprint',
    'Ambil SEP di VClaim',
    'Status Finger',
  ];

  // handlePersetujuanTanpaFinger — 11.1 Pengajuan Penjaminan VClaim, jenis
  // "Persetujuan SEP tanpa Fingerprint". Data pasien (No.Kartu/Tgl.SEP/
  // Jns.Pelayanan) diambil LANGSUNG dari form Pengajuan SEP yang sedang
  // dibuka (sesuai instruksi "isi otomatis ambil semua data pasien yang
  // dibutuhkan yang ada pada modal") — staf cuma perlu isi "Keterangan"
  // (alasan pengajuan, mis. "Hari libur") sebelum dikirim ke BPJS lewat
  // endpoint backend yang sudah ada (submitPengajuanPenjaminan, POST
  // /api/bridging/pengajuan-penjaminan).
  const handlePersetujuanTanpaFinger = async () => {
    setShowSepMenu(false);
    if (!form.no_kartu.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu sebelum mengajukan persetujuan tanpa fingerprint.' });
      return;
    }
    if (!form.tglsep) {
      Swal.fire({ icon: 'warning', title: 'Tgl. SEP kosong', text: 'Isi Tgl. SEP dulu sebelum mengajukan persetujuan tanpa fingerprint.' });
      return;
    }

    const { value: keterangan } = await Swal.fire({
      title: 'Persetujuan SEP tanpa Fingerprint',
      html: `<div style="text-align:left;font-size:13px;line-height:1.8;margin-bottom:4px">
        <div>No. Kartu : <strong>${form.no_kartu}</strong></div>
        <div>Nama Pasien : <strong>${form.nama_pasien || '-'}</strong></div>
        <div>Tgl. SEP : <strong>${formatTgl(form.tglsep)}</strong></div>
        <div>Jns. Pelayanan : <strong>${form.jnspelayanan === '1' ? 'Rawat Inap' : 'Rawat Jalan'}</strong></div>
      </div>`,
      input: 'text',
      inputLabel: 'Keterangan',
      inputPlaceholder: 'Alasan pengajuan, mis. Hari libur',
      showCancelButton: true,
      confirmButtonText: 'Kirim ke BPJS',
      cancelButtonText: 'Batal',
      inputValidator: (value) => (!value ? 'Keterangan wajib diisi' : undefined),
    });
    if (keterangan === undefined) return;

    Swal.fire({ title: 'Mengirim ke BPJS...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/bridging/pengajuan-penjaminan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_sep: editingNoSep || '',
          no_kartu: form.no_kartu,
          nama_pasien: form.nama_pasien,
          jenis_pengajuan: 'tanpa_fingerprint',
          tgl_sep: form.tglsep,
          jns_pelayanan: form.jnspelayanan,
          alasan: keterangan,
          user_entry: getLoggedInUsername(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || 'Pengajuan berhasil dikirim ke BPJS' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  // handleAprovalSepFinger — 11.2 Aproval Penjaminan VClaim, khusus jenis
  // finger print (jnsPengajuan="2" dikirim eksplisit — kalau parameter ini
  // kosong BPJS default-nya ke "1"/Aproval Backdate, jadi WAJIB dikirim di
  // sini supaya sesuai nama tombolnya). Sama seperti Persetujuan tanpa
  // Fingerprint: data diambil otomatis dari form SEP yang sedang dibuka,
  // staf cuma isi Keterangan.
  const handleAprovalSepFinger = async () => {
    setShowSepMenu(false);
    if (!form.no_kartu.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu sebelum aproval SEP finger.' });
      return;
    }
    if (!form.tglsep) {
      Swal.fire({ icon: 'warning', title: 'Tgl. SEP kosong', text: 'Isi Tgl. SEP dulu sebelum aproval SEP finger.' });
      return;
    }

    const { value: keterangan } = await Swal.fire({
      title: 'Aproval SEP Finger',
      html: `<div style="text-align:left;font-size:13px;line-height:1.8;margin-bottom:4px">
        <div>No. Kartu : <strong>${form.no_kartu}</strong></div>
        <div>Nama Pasien : <strong>${form.nama_pasien || '-'}</strong></div>
        <div>Tgl. SEP : <strong>${formatTgl(form.tglsep)}</strong></div>
        <div>Jns. Pelayanan : <strong>${form.jnspelayanan === '1' ? 'Rawat Inap' : 'Rawat Jalan'}</strong></div>
      </div>`,
      input: 'text',
      inputLabel: 'Keterangan',
      inputPlaceholder: 'Alasan aproval, mis. Hari libur',
      showCancelButton: true,
      confirmButtonText: 'Aproval ke BPJS',
      cancelButtonText: 'Batal',
      inputValidator: (value) => (!value ? 'Keterangan wajib diisi' : undefined),
    });
    if (keterangan === undefined) return;

    Swal.fire({ title: 'Mengirim aproval ke BPJS...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/bridging/sep/aproval-langsung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_kartu: form.no_kartu,
          nama_pasien: form.nama_pasien,
          tgl_sep: form.tglsep,
          jns_pelayanan: form.jnspelayanan,
          jns_pengajuan: '2',
          keterangan,
          user_entry: getLoggedInUsername(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim aproval');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || 'Aproval SEP berhasil dikirim ke BPJS' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  // handlePengajuanSepBackdate — 11.1 Pengajuan Penjaminan, jenis backdate.
  // jenis_pengajuan lokal (ritl_backdate/rjtl_backdate — dipakai validasi
  // 11.1.1 & dedup 11.1.4, BUKAN dikirim apa adanya ke BPJS) diturunkan
  // OTOMATIS dari Jns.Pelayanan form: Rawat Inap → RITL, Rawat Jalan → RJTL.
  // RITL backdate wajib Tgl. Masuk Rawat (validasi backend: minimal 3x24
  // jam sebelum tanggal pengajuan) — field ini tidak ada di form SEP, jadi
  // diminta lewat dialog konfirmasi bareng Keterangan.
  const handlePengajuanSepBackdate = async () => {
    setShowSepMenu(false);
    if (!form.no_kartu.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu sebelum pengajuan SEP backdate.' });
      return;
    }
    if (!form.tglsep) {
      Swal.fire({ icon: 'warning', title: 'Tgl. SEP kosong', text: 'Isi Tgl. SEP dulu sebelum pengajuan SEP backdate.' });
      return;
    }
    const jenisPengajuan = form.jnspelayanan === '1' ? 'ritl_backdate' : 'rjtl_backdate';
    const needsTglMasuk = jenisPengajuan === 'ritl_backdate';

    const { value: formValues } = await Swal.fire({
      title: 'Pengajuan SEP Backdate',
      html: `<div style="text-align:left;font-size:13px;line-height:1.8;margin-bottom:8px">
          <div>No. Kartu : <strong>${form.no_kartu}</strong></div>
          <div>Nama Pasien : <strong>${form.nama_pasien || '-'}</strong></div>
          <div>Tgl. SEP : <strong>${formatTgl(form.tglsep)}</strong></div>
          <div>Jns. Pelayanan : <strong>${form.jnspelayanan === '1' ? 'Rawat Inap (RITL)' : 'Rawat Jalan (RJTL)'}</strong></div>
        </div>
        ${needsTglMasuk ? `<label for="swal-tgl-masuk" style="display:block;text-align:left;font-size:12px;margin-bottom:4px">Tgl. Masuk Rawat (min. 3x24 jam sebelum pengajuan)</label>
        <input id="swal-tgl-masuk" type="date" class="swal2-input" style="margin:0 0 10px 0">` : ''}
        <label for="swal-keterangan" style="display:block;text-align:left;font-size:12px;margin-bottom:4px">Keterangan</label>
        <input id="swal-keterangan" type="text" class="swal2-input" placeholder="Alasan pengajuan, mis. Hari libur" style="margin:0">`,
      showCancelButton: true,
      confirmButtonText: 'Kirim ke BPJS',
      cancelButtonText: 'Batal',
      focusConfirm: false,
      preConfirm: () => {
        const keterangan = (document.getElementById('swal-keterangan') as HTMLInputElement)?.value.trim();
        const tglMasuk = needsTglMasuk ? (document.getElementById('swal-tgl-masuk') as HTMLInputElement)?.value : '';
        if (!keterangan) {
          Swal.showValidationMessage('Keterangan wajib diisi');
          return;
        }
        if (needsTglMasuk && !tglMasuk) {
          Swal.showValidationMessage('Tgl. Masuk Rawat wajib diisi');
          return;
        }
        return { keterangan, tglMasuk };
      },
    });
    if (!formValues) return;

    Swal.fire({ title: 'Mengirim ke BPJS...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/bridging/pengajuan-penjaminan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_kartu: form.no_kartu,
          nama_pasien: form.nama_pasien,
          jenis_pengajuan: jenisPengajuan,
          tgl_sep: form.tglsep,
          jns_pelayanan: form.jnspelayanan,
          tgl_masuk: formValues.tglMasuk || '',
          alasan: formValues.keterangan,
          user_entry: getLoggedInUsername(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || 'Pengajuan berhasil dikirim ke BPJS' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  // handleAprovalSepBackdate — 11.2 Aproval Penjaminan, khusus backdate
  // (jnsPengajuan="1" dikirim eksplisit, konsisten dgn Aproval SEP Finger
  // yg selalu kirim "2" — walau BPJS default ke "1" kalau parameter ini
  // kosong, kita tetap kirim tegas supaya jelas aproval jenis apa).
  const handleAprovalSepBackdate = async () => {
    setShowSepMenu(false);
    if (!form.no_kartu.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu sebelum aproval SEP backdate.' });
      return;
    }
    if (!form.tglsep) {
      Swal.fire({ icon: 'warning', title: 'Tgl. SEP kosong', text: 'Isi Tgl. SEP dulu sebelum aproval SEP backdate.' });
      return;
    }

    const { value: keterangan } = await Swal.fire({
      title: 'Aproval SEP Backdate',
      html: `<div style="text-align:left;font-size:13px;line-height:1.8;margin-bottom:4px">
        <div>No. Kartu : <strong>${form.no_kartu}</strong></div>
        <div>Nama Pasien : <strong>${form.nama_pasien || '-'}</strong></div>
        <div>Tgl. SEP : <strong>${formatTgl(form.tglsep)}</strong></div>
        <div>Jns. Pelayanan : <strong>${form.jnspelayanan === '1' ? 'Rawat Inap' : 'Rawat Jalan'}</strong></div>
      </div>`,
      input: 'text',
      inputLabel: 'Keterangan',
      inputPlaceholder: 'Alasan aproval, mis. Hari libur',
      showCancelButton: true,
      confirmButtonText: 'Aproval ke BPJS',
      cancelButtonText: 'Batal',
      inputValidator: (value) => (!value ? 'Keterangan wajib diisi' : undefined),
    });
    if (keterangan === undefined) return;

    Swal.fire({ title: 'Mengirim aproval ke BPJS...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/bridging/sep/aproval-langsung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_kartu: form.no_kartu,
          nama_pasien: form.nama_pasien,
          tgl_sep: form.tglsep,
          jns_pelayanan: form.jnspelayanan,
          jns_pengajuan: '1',
          keterangan,
          user_entry: getLoggedInUsername(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim aproval');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || 'Aproval SEP berhasil dikirim ke BPJS' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const handleSepMenuItem = (label: string) => {
    if (label === 'Persetujuan SEP tanpa Fingerprint') {
      handlePersetujuanTanpaFinger();
      return;
    }
    if (label === 'Aproval SEP Finger') {
      handleAprovalSepFinger();
      return;
    }
    if (label === 'Pengajuan SEP Backdate') {
      handlePengajuanSepBackdate();
      return;
    }
    if (label === 'Aproval SEP Backdate') {
      handleAprovalSepBackdate();
      return;
    }
    setShowSepMenu(false);
    Swal.fire({ icon: 'info', title: label, text: 'Fitur ini akan dikembangkan lebih lanjut.' });
  };

  // handleCekPeserta — dipicu saat field No.Kartu kehilangan fokus (blur)
  // ATAU otomatis sekali saat dialog dibuka kalau No.Kartu sudah terisi
  // dari Pendaftaran (lihat useEffect di bawah) — meniru perilaku Khanza
  // Desktop: begitu No.Kartu ada, data peserta LANGSUNG terisi semua dari
  // BPJS tanpa nunggu staf ketik manual/klik apa pun:
  //   nama/tgl lahir/JK/jenis peserta/status keaktifan (sudah ada),
  //   + PPK Rujukan (provUmum = faskes 1 peserta) dan Kelas (hakKelas =
  //   kelas rawat sesuai hak peserta) — DUA field terakhir ini sebelumnya
  //   TIDAK diambil sama sekali dari respons cek-peserta, makanya di web
  //   selalu kosong padahal Khanza Java selalu menampilkannya.
  // "Status" cuma ditampilkan (tidak disimpan ke bridging_sep — tidak ada
  // kolomnya); field identitas pasien hanya diisi kalau masih kosong di
  // form, tapi PPK Rujukan & Kelas SELALU disamakan dgn data BPJS terbaru
  // (otoritatif dari BPJS, bukan sekadar draft staf).
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
      // Jaga-jaga thd kemungkinan respons dibungkus 2x ({peserta:{peserta:{...}}})
      // vs 1x ({peserta:{...}}) — tergantung apakah payload VClaim yg sudah
      // didekripsi backend masih bawa key "peserta" lagi di dalamnya.
      const p = data.peserta?.peserta ?? data.peserta ?? {};
      setForm((prev) => ({
        ...prev,
        nama_pasien: prev.nama_pasien || p.nama || '',
        tanggal_lahir: prev.tanggal_lahir || p.tglLahir || '',
        jkel: prev.jkel || (p.jenisKelamin ? String(p.jenisKelamin).charAt(0).toUpperCase() : ''),
        peserta: prev.peserta || p.jenisPeserta?.keterangan || '',
        kdppkrujukan: prev.kdppkrujukan || p.provUmum?.kdProviderUmum || '',
        nmppkrujukan: prev.nmppkrujukan || p.provUmum?.nmProviderUmum || '',
        klsrawat: p.hakKelas?.kode || prev.klsrawat,
      }));
      setStatusPeserta(p.statusPeserta?.keterangan || (typeof p.statusPeserta === 'string' ? p.statusPeserta : '') || '-');
    } catch (err) {
      setStatusPeserta('');
      Swal.fire({ icon: 'error', title: 'Cek Peserta Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setCheckingPeserta(false);
    }
  };

  // Auto-jalankan cek peserta SEKALI saat dialog dibuka mode "Input SEP
  // baru" (bukan Update) kalau No.Kartu sudah terisi dari Pendaftaran —
  // supaya tidak perlu klik/blur manual dulu spt Khanza Desktop.
  React.useEffect(() => {
    if (!editingNoSep && form.no_kartu.trim()) {
      handleCekPeserta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PPK Pelayanan = kode PPK BPJS rumah sakit sendiri (Pengaturan >
  // Identitas RS), SELALU sama utk semua SEP yg diterbitkan RS ini —
  // persis Khanza Desktop yg auto-isi dari akses.getkodeppk(). Hanya utk
  // mode Input baru & kalau field masih kosong (mode Update pakai data
  // SEP yg sudah tersimpan).
  React.useEffect(() => {
    if (editingNoSep) return;
    if (form.kdppkpelayanan.trim()) return;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setForm((prev) =>
          prev.kdppkpelayanan.trim()
            ? prev
            : { ...prev, kdppkpelayanan: data.kode_ppk_bpjs || '', nmppkpelayanan: data.nama_instansi || '' }
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // historiPelayananModal — tombol paperclip pertama ("Histori Pelayanan
  // BPJS") — dipakai bareng dgn tombol "[BPJS] > Riwayat Kunjungan" di
  // Pendaftaran lewat komponen standalone HistoriPelayananBpjsModal
  // (default rentang 90 hari terakhir, bisa diubah lewat input tanggal).
  const [showHistoriPelayanan, setShowHistoriPelayanan] = React.useState(false);
  const handleLihatHistoriPelayanan = () => setShowHistoriPelayanan(true);

  // riwayatRujukanModal — tombol paperclip kedua ("Riwayat Rujukan VClaim")
  // — padanan persis method tampil(nomorkartu, namapasien) di
  // BPJSCekRujukanKartuRS.java: gabungan riwayat rujukan FKTP + FKTL utk
  // No. Kartu ini, ditampilkan sbg modal (bukan panel inline spt
  // rujukanPicker) krn kolomnya lebih banyak (9 kolom) & sifatnya riwayat
  // lengkap, bukan cuma daftar pendek rujukan aktif.
  type RiwayatRujukanRow = {
    kode_diagnosa: string; nama_diagnosa: string; no_rujukan: string;
    kode_tujuan: string; nama_tujuan: string; tgl_rujukan: string;
    kode_ppk: string; nama_ppk: string; status: string;
  };
  const [riwayatRujukanModal, setRiwayatRujukanModal] = React.useState<{ loading: boolean; error: string; items: RiwayatRujukanRow[] } | null>(null);

  const handleLihatRiwayatRujukan = async () => {
    const noKartu = form.no_kartu.trim();
    if (!noKartu) {
      Swal.fire({ icon: 'warning', title: 'No. Kartu kosong', text: 'Isi No. Kartu dulu untuk melihat riwayat rujukan' });
      return;
    }
    setRiwayatRujukanModal({ loading: true, error: '', items: [] });
    try {
      const res = await fetch(`/api/bridging/rujukan-riwayat/${encodeURIComponent(noKartu)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil riwayat rujukan');
      setRiwayatRujukanModal({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [] });
    } catch (err) {
      setRiwayatRujukanModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] });
    }
  };

  const handlePilihRiwayatRujukan = (item: RiwayatRujukanRow) => {
    setForm((p) => ({
      ...p,
      no_rujukan: item.no_rujukan || p.no_rujukan,
      tglrujukan: item.tgl_rujukan || p.tglrujukan,
      kdppkrujukan: item.kode_ppk || p.kdppkrujukan,
      nmppkrujukan: item.nama_ppk || p.nmppkrujukan,
      diagawal: item.kode_diagnosa || p.diagawal,
      nmdiagnosaawal: item.nama_diagnosa || p.nmdiagnosaawal,
    }));
    setRiwayatRujukanModal(null);
  };

  // spriModal — tombol paperclip kedua ("Pilih dari SPRI Rawat Inap") —
  // padanan persis method tampil() di dialog pemilihan SPRI: JOIN
  // reg_periksa + pasien LIVE (bukan bridging_sep — SPRI diterbitkan
  // SEBELUM SEP RITL ada). mode="surat" (radio R1 Java) filter & urut lewat
  // tgl_surat; mode="kontrol" (radio R2) lewat tgl_rencana. search (TCari)
  // mencocokkan no_rawat/no_kartu/no_rkm_medis/nm_pasien/no_surat/
  // nm_poli_bpjs/nm_dokter_bpjs.
  type SpriPasienRow = {
    no_rawat: string; no_kartu: string; nomr: string; nama_pasien: string;
    tanggal_lahir: string; jkel: string; diagnosa: string; tgl_surat: string;
    no_surat: string; tgl_rencana: string; kd_dokter_bpjs: string; nm_dokter_bpjs: string;
    kd_poli_bpjs: string; nm_poli_bpjs: string; no_sep: string;
  };
  const [spriModal, setSpriModal] = React.useState<{
    loading: boolean; error: string; items: SpriPasienRow[];
    mode: 'surat' | 'kontrol'; tglDari: string; tglAkhir: string; search: string;
  } | null>(null);

  const fetchSpriPasien = async (opts: { mode: 'surat' | 'kontrol'; tglDari: string; tglAkhir: string; search: string }) => {
    setSpriModal((prev) => ({ loading: true, error: '', items: prev?.items || [], ...opts }));
    try {
      const params = new URLSearchParams({ mode: opts.mode, tgl_dari: opts.tglDari, tgl_sampai: opts.tglAkhir });
      if (opts.search.trim()) params.set('search', opts.search.trim());
      const res = await fetch(`/api/bridging/spri-ranap/list-pasien?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil daftar SPRI');
      setSpriModal({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [], ...opts });
    } catch (err) {
      setSpriModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [], ...opts });
    }
  };

  const handleLihatSpri = () => {
    const tglAkhir = localDateStr();
    const d = new Date();
    d.setDate(d.getDate() - 30);
    fetchSpriPasien({ mode: 'surat', tglDari: localDateStr(d), tglAkhir, search: '' });
  };

  const handlePilihSpri = (item: SpriPasienRow) => {
    setForm((p) => ({ ...p, noskdp: item.no_surat || p.noskdp }));
    setSpriModal(null);
  };

  // dpjpLayananModal — dipakai BERSAMA oleh dua tombol paperclip: "Dokter
  // DPJP" (target='dpjp') dan "DPJP Layanan" (target='dpjp_layanan') —
  // padanan BPJSCekReferensiDokterDPJP.java: daftar dokter versi BPJS
  // (kode+nama sisi BPJS, BUKAN dokter lokal RS) dari dokter yang SUDAH
  // di-mapping lewat Pengaturan > Bridging BPJS > Mapping Dokter DPJP
  // VCLAIM. Reuse endpoint /api/bpjs/mapping-dokter yang sudah ada (dipakai
  // juga oleh Registrasi.tsx utk auto-fill Dokter DPJP) — tidak perlu
  // endpoint baru, di sini cuma kolom sisi BPJS-nya yang ditampilkan.
  // `target` menentukan pasangan field mana yang diisi saat baris dipilih.
  type DokterDpjpBpjsRow = { kd_dokter: string; nm_dokter: string; kd_dokter_bpjs: string; nm_dokter_bpjs: string };
  const [dpjpLayananModal, setDpjpLayananModal] = React.useState<{
    loading: boolean; error: string; items: DokterDpjpBpjsRow[]; search: string; target: 'dpjp' | 'dpjp_layanan';
  } | null>(null);

  const fetchDpjpLayanan = async (search: string, target: 'dpjp' | 'dpjp_layanan') => {
    setDpjpLayananModal((prev) => ({ loading: true, error: '', items: prev?.items || [], search, target }));
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/bpjs/mapping-dokter?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil daftar dokter DPJP');
      setDpjpLayananModal({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [], search, target });
    } catch (err) {
      setDpjpLayananModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [], search, target });
    }
  };

  const handleCariDokterDpjp = () => fetchDpjpLayanan('', 'dpjp');
  const handleLihatDpjpLayanan = () => fetchDpjpLayanan('', 'dpjp_layanan');

  const handlePilihDpjpLayanan = (item: DokterDpjpBpjsRow) => {
    setForm((p) =>
      dpjpLayananModal?.target === 'dpjp'
        ? { ...p, kddpjp: item.kd_dokter_bpjs, nmdpdjp: item.nm_dokter_bpjs }
        : { ...p, kddpjplayanan: item.kd_dokter_bpjs, nmdpjplayanan: item.nm_dokter_bpjs }
    );
    setDpjpLayananModal(null);
  };

  // poliModal — tombol paperclip di sebelah "Poli Tujuan" — sama pola dgn
  // dpjpLayananModal: menampilkan poli versi BPJS (kode+nama sisi BPJS,
  // BUKAN poli lokal RS) dari poli yang SUDAH di-mapping lewat Pengaturan
  // > Bridging BPJS > Mapping Poli VCLAIM. Reuse endpoint
  // /api/bpjs/mapping-poli yang sudah ada (dipakai juga oleh Registrasi.tsx
  // utk auto-fill Poli Tujuan) — tidak perlu endpoint baru.
  type PoliBpjsRow = { kd_poli: string; nm_poli: string; kd_poli_bpjs: string; nm_poli_bpjs: string };
  const [poliModal, setPoliModal] = React.useState<{ loading: boolean; error: string; items: PoliBpjsRow[]; search: string } | null>(null);

  const fetchPoliBpjs = async (search: string) => {
    setPoliModal((prev) => ({ loading: true, error: '', items: prev?.items || [], search }));
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/bpjs/mapping-poli?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil daftar poli');
      setPoliModal({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [], search });
    } catch (err) {
      setPoliModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [], search });
    }
  };

  const handleLihatPoli = () => fetchPoliBpjs('');

  const handlePilihPoli = (item: PoliBpjsRow) => {
    setForm((p) => ({ ...p, kdpolitujuan: item.kd_poli_bpjs, nmpolitujuan: item.nm_poli_bpjs }));
    setPoliModal(null);
  };

  // faskesModal — tombol paperclip di sebelah "PPK Rujukan" — padanan
  // persis method tampil(faskes) di dialog cari referensi Faskes: DUA
  // panggilan live VClaim, referensi/faskes/{faskes}/1 (Faskes 1) dan
  // referensi/faskes/{faskes}/2 (Faskes 2/RS), digabung satu daftar dgn
  // label bagian ("Faskes 1"/"Faskes 2/RS") — reuse endpoint generik
  // /api/bridging/referensi/*path yang sudah ada (getReferensiBpjs), tidak
  // perlu endpoint baru. "faskes" adalah kata kunci pencarian (nama/kode),
  // wajib diisi dulu — beda dari picker lain, dialog Java ini juga selalu
  // butuh input pencarian sebelum tampil() dipanggil.
  type FaskesRow = { section: 'Faskes 1' | 'Faskes 2/RS'; kode: string; nama: string };
  const [faskesModal, setFaskesModal] = React.useState<{ loading: boolean; error: string; items: FaskesRow[]; search: string } | null>(null);

  const fetchFaskes = async (search: string) => {
    const term = search.trim();
    if (!term) {
      Swal.fire({ icon: 'warning', title: 'Kata kunci kosong', text: 'Isi nama/kode faskes yang dicari' });
      return;
    }
    setFaskesModal((prev) => ({ loading: true, error: '', items: prev?.items || [], search }));
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/bridging/referensi/faskes/${encodeURIComponent(term)}/1`),
        fetch(`/api/bridging/referensi/faskes/${encodeURIComponent(term)}/2`),
      ]);
      const items: FaskesRow[] = [];
      if (res1.ok) {
        const data1 = await res1.json();
        const list1 = data1?.data?.faskes;
        if (Array.isArray(list1)) {
          list1.forEach((f: any) => items.push({ section: 'Faskes 1', kode: f.kode || '', nama: f.nama || '' }));
        }
      }
      if (res2.ok) {
        const data2 = await res2.json();
        const list2 = data2?.data?.faskes;
        if (Array.isArray(list2)) {
          list2.forEach((f: any) => items.push({ section: 'Faskes 2/RS', kode: f.kode || '', nama: f.nama || '' }));
        }
      }
      if (!res1.ok && !res2.ok) {
        const errData = await res1.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mengambil data faskes');
      }
      setFaskesModal({ loading: false, error: '', items, search });
    } catch (err) {
      setFaskesModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [], search });
    }
  };

  const handleCariPpkRujukan = () => {
    setFaskesModal({ loading: false, error: '', items: [], search: '' });
  };

  const handlePilihFaskes = (item: FaskesRow) => {
    setForm((p) => ({ ...p, kdppkrujukan: item.kode, nmppkrujukan: item.nama }));
    setFaskesModal(null);
  };

  // diagnosaModal — tombol paperclip di sebelah "Diagnosa Awal" — padanan
  // persis method tampil(diagnosa) di BPJSCekReferensiPenyakit.java: SATU
  // panggilan live VClaim referensi/diagnosa/{kata_kunci}, reuse endpoint
  // generik /api/bridging/referensi/*path yang sudah ada, tidak perlu
  // endpoint baru. Sama seperti Cari PPK Rujukan, wajib isi kata kunci dulu.
  type DiagnosaRow = { kode: string; nama: string };
  const [diagnosaModal, setDiagnosaModal] = React.useState<{ loading: boolean; error: string; items: DiagnosaRow[]; search: string } | null>(null);

  const fetchDiagnosa = async (search: string) => {
    const term = search.trim();
    if (!term) {
      Swal.fire({ icon: 'warning', title: 'Kata kunci kosong', text: 'Isi kode/nama diagnosa yang dicari' });
      return;
    }
    setDiagnosaModal((prev) => ({ loading: true, error: '', items: prev?.items || [], search }));
    try {
      const res = await fetch(`/api/bridging/referensi/diagnosa/${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data diagnosa');
      const list = data?.data?.diagnosa;
      const items: DiagnosaRow[] = Array.isArray(list) ? list.map((d: any) => ({ kode: d.kode || '', nama: d.nama || '' })) : [];
      setDiagnosaModal({ loading: false, error: '', items, search });
    } catch (err) {
      setDiagnosaModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [], search });
    }
  };

  const handleCariDiagnosa = () => {
    setDiagnosaModal({ loading: false, error: '', items: [], search: '' });
  };

  const handlePilihDiagnosa = (item: DiagnosaRow) => {
    setForm((p) => ({ ...p, diagawal: item.kode, nmdiagnosaawal: item.nama }));
    setDiagnosaModal(null);
  };

  // suratKontrolModal — tombol paperclip pertama ("Pilih dari Surat
  // Kontrol") — padanan persis method tampil() di dialog pemilihan Surat
  // Kontrol: JOIN bridging_surat_kontrol_bpjs + bridging_sep supaya
  // kelihatan surat itu punya pasien/kunjungan mana, kolomnya 15 sesuai
  // Java (No.Rawat, No.SEP, No.Kartu, No.RM, Nama Pasien, Tgl.Lahir, J.K.,
  // Diagnosa, Tgl.Surat, No.Surat, Tgl.Kontrol, Kode Dokter, Nama
  // Dokter/Spesialis, Kode Poli, Nama Poli/Unit). Difilter ke No.Kartu/
  // No.Rawat form yg lagi diisi kalau sudah ada isinya.
  type SuratKontrolPasienRow = {
    no_rawat: string; no_sep: string; no_kartu: string; nomr: string; nama_pasien: string;
    tanggal_lahir: string; jkel: string; diagawal: string; nmdiagnosaawal: string;
    tgl_surat: string; no_surat: string; tgl_rencana: string;
    kd_dokter_bpjs: string; nm_dokter_bpjs: string; kd_poli_bpjs: string; nm_poli_bpjs: string;
  };
  const [suratKontrolModal, setSuratKontrolModal] = React.useState<{ loading: boolean; error: string; items: SuratKontrolPasienRow[] } | null>(null);

  const handleLihatSuratKontrol = async () => {
    setSuratKontrolModal({ loading: true, error: '', items: [] });
    try {
      const params = new URLSearchParams();
      if (form.no_kartu.trim()) params.set('no_kartu', form.no_kartu.trim());
      if (form.no_rawat.trim()) params.set('no_rawat', form.no_rawat.trim());
      const res = await fetch(`/api/bridging/surat-kontrol/list-pasien?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil daftar surat kontrol');
      setSuratKontrolModal({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [] });
    } catch (err) {
      setSuratKontrolModal({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] });
    }
  };

  const handlePilihSuratKontrol = (item: SuratKontrolPasienRow) => {
    setForm((p) => ({ ...p, noskdp: item.no_surat || p.noskdp }));
    setSuratKontrolModal(null);
  };

  // suplesiPicker — daftar potensi SEP suplesi Jasa Raharja, dipicu tombol
  // paperclip di sebelah No.SEP Suplesi. Parameter-nya No.Kartu Peserta.
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
  // peserta, dipicu tombol paperclip di sebelah "Laka Lantas".
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

  // handleSave — SEP baru langsung dikirim ke BPJS (POST .../sep/insert),
  // BUKAN disimpan lokal dulu sebagai draft. No. SEP resminya datang dari
  // BPJS di response, makanya tidak ada lagi field No. SEP di form.
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
      onSaved();
      onClose();
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
      onSaved();
      onClose();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'SEP berhasil diperbarui', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{editingNoSep ? `Update SEP — ${editingNoSep}` : 'Input SEP'}</span>
          <button
            type="button"
            onClick={onClose}
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
            <button
              ref={sepMenuBtnRef}
              type="button"
              title="Menu SEP Backdate/Finger"
              onClick={(e) => {
                if (showSepMenu) {
                  setShowSepMenu(false);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSepMenuPos({ top: rect.bottom + 4, left: rect.left });
                  setShowSepMenu(true);
                }
              }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: '1px solid #2563eb',
                background: '#ffffff', color: '#2563eb', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, fontSize: 16, fontWeight: 700, lineHeight: 1,
              }}
            >
              +
            </button>
            {showSepMenu && sepMenuPos && (
              <div
                ref={sepMenuRef}
                style={{
                  position: 'fixed', top: sepMenuPos.top, left: sepMenuPos.left,
                  background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10005, minWidth: 210, padding: 4,
                }}
              >
                {SEP_MENU_ITEMS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSepMenuItem(label)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12.5, textAlign: 'left', cursor: 'pointer', borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ width: 50, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Status :</div>
            <input readOnly style={{ ...pillInput, flex: '0 0 150px', background: '#f9fafb', color: '#374151' }} value={checkingPeserta ? 'Mengecek...' : statusPeserta} />
            <div style={{ width: 94, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>No. Rujukan :</div>
            <input style={pillInput} value={form.no_rujukan} onChange={(e) => setForm((p) => ({ ...p, no_rujukan: e.target.value }))} />
            <PaperclipButton title="Histori Pelayanan BPJS (berdasarkan No. Kartu)" onClick={handleLihatHistoriPelayanan} />
            <PaperclipButton title="Riwayat Rujukan VClaim (berdasarkan No. Kartu)" onClick={handleLihatRiwayatRujukan} />
          </Row>

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
                <PaperclipButton title="Pilih dari Surat Kontrol" onClick={handleLihatSuratKontrol} />
                <PaperclipButton title="Pilih dari SPRI Rawat Inap" onClick={handleLihatSpri} />
              </Row>
              <Row label="PPK Rujukan">
                <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdppkrujukan} onChange={(e) => setForm((p) => ({ ...p, kdppkrujukan: e.target.value }))} />
                <input style={pillInput} value={form.nmppkrujukan} onChange={(e) => setForm((p) => ({ ...p, nmppkrujukan: e.target.value }))} />
                <PaperclipButton title="Cari PPK rujukan" onClick={handleCariPpkRujukan} />
              </Row>
              <Row label="Diagnosa Awal">
                <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.diagawal} onChange={(e) => setForm((p) => ({ ...p, diagawal: e.target.value }))} placeholder="ICD-10" />
                <input style={pillInput} value={form.nmdiagnosaawal} onChange={(e) => setForm((p) => ({ ...p, nmdiagnosaawal: e.target.value }))} />
                <PaperclipButton title="Cari diagnosa" onClick={handleCariDiagnosa} />
              </Row>
              <Row label="Poli Tujuan">
                <input style={{ ...pillInput, flex: '0 0 90px' }} value={form.kdpolitujuan} onChange={(e) => setForm((p) => ({ ...p, kdpolitujuan: e.target.value }))} />
                <input style={pillInput} value={form.nmpolitujuan} onChange={(e) => setForm((p) => ({ ...p, nmpolitujuan: e.target.value }))} />
                <PaperclipButton title="Cari poli (Referensi Poli BPJS)" onClick={handleLihatPoli} />
              </Row>
              <Row label="Dokter DPJP">
                <input required style={{ ...pillInput, flex: '0 0 90px' }} value={form.kddpjp} onChange={(e) => setForm((p) => ({ ...p, kddpjp: e.target.value }))} />
                <input style={pillInput} value={form.nmdpdjp} onChange={(e) => setForm((p) => ({ ...p, nmdpdjp: e.target.value }))} />
                <PaperclipButton title="Cari dokter (Referensi Dokter DPJP BPJS)" onClick={handleCariDokterDpjp} />
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
                <PaperclipButton title="Cari dokter layanan (Referensi Dokter DPJP BPJS)" onClick={handleLihatDpjpLayanan} />
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
                  style={{ ...pillInput, resize: 'none' }}
                  value={form.keterangankkl}
                  onChange={(e) => setForm((p) => ({ ...p, keterangankkl: e.target.value }))}
                />
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
              onClick={onClose}
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

    {riwayatRujukanModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setRiwayatRujukanModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1000, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              Riwayat Rujukan VClaim — {form.no_kartu}{form.nama_pasien ? ` (${form.nama_pasien})` : ''}
            </span>
            <button
              type="button"
              onClick={() => setRiwayatRujukanModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          {riwayatRujukanModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari riwayat rujukan...</div>}
          {riwayatRujukanModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{riwayatRujukanModal.error}</div>}
          {!riwayatRujukanModal.loading && !riwayatRujukanModal.error && riwayatRujukanModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ditemukan rujukan untuk No. Kartu ini.</div>
          )}

          {riwayatRujukanModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['ICD 10', 'Nama Diagnosa', 'No.Rujukan', 'Kode Tujuan', 'Nama Tujuan', 'Tgl.Rujukan', 'Kode PPK', 'Nama PPK', 'Status'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riwayatRujukanModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihRiwayatRujukan(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kode_diagnosa || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_diagnosa || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_rujukan || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kode_tujuan || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_tujuan || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.tgl_rujukan || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kode_ppk || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_ppk || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi No.Rujukan, Tgl.Rujukan, PPK Rujukan & Diagnosa Awal di form.</div>
        </div>
      </div>
    )}

    {showHistoriPelayanan && (
      <HistoriPelayananBpjsModal
        noKartu={form.no_kartu.trim()}
        namaPasien={form.nama_pasien}
        onClose={() => setShowHistoriPelayanan(false)}
      />
    )}

    {suratKontrolModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setSuratKontrolModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1200, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Pilih dari Surat Kontrol</span>
            <button
              type="button"
              onClick={() => setSuratKontrolModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          {suratKontrolModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat daftar surat kontrol...</div>}
          {suratKontrolModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{suratKontrolModal.error}</div>}
          {!suratKontrolModal.loading && !suratKontrolModal.error && suratKontrolModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Belum ada data Surat Kontrol{(form.no_kartu || form.no_rawat) ? ' untuk pasien ini' : ''}.
            </div>
          )}

          {suratKontrolModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.Rawat', 'No.SEP', 'No.Kartu', 'No.RM', 'Nama Pasien', 'Tgl.Lahir', 'J.K.', 'Diagnosa', 'Tgl.Surat', 'No.Surat', 'Tgl.Kontrol', 'Kode Dokter', 'Nama Dokter/Spesialis', 'Kode Poli', 'Nama Poli/Unit'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suratKontrolModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihSuratKontrol(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_rawat || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_sep || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_kartu || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.nomr || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_pasien || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tanggal_lahir)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jkel || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.diagawal ? `${item.diagawal} - ${item.nmdiagnosaawal}` : '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tgl_surat)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_surat || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tgl_rencana)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_dokter_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_dokter_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_poli_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_poli_bpjs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi No.SKDP/SPRI di form.</div>
        </div>
      </div>
    )}

    {spriModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setSpriModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1200, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Pilih dari SPRI Rawat Inap</span>
            <button
              type="button"
              onClick={() => setSpriModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="radio" checked={spriModal.mode === 'surat'} onChange={() => setSpriModal((p) => (p ? { ...p, mode: 'surat' } : p))} />
              Berdasar Tgl.Surat
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="radio" checked={spriModal.mode === 'kontrol'} onChange={() => setSpriModal((p) => (p ? { ...p, mode: 'kontrol' } : p))} />
              Berdasar Tgl.Kontrol
            </label>
            <input
              type="date"
              style={{ ...pillInput, flex: '0 0 150px' }}
              value={spriModal.tglDari}
              onChange={(e) => setSpriModal((p) => (p ? { ...p, tglDari: e.target.value } : p))}
            />
            <span style={{ fontSize: 12, color: '#374151' }}>s.d.</span>
            <input
              type="date"
              style={{ ...pillInput, flex: '0 0 150px' }}
              value={spriModal.tglAkhir}
              onChange={(e) => setSpriModal((p) => (p ? { ...p, tglAkhir: e.target.value } : p))}
            />
            <input
              type="text"
              placeholder="Cari No.Rawat/No.Kartu/No.RM/Nama/No.Surat/Poli/Dokter"
              style={{ ...pillInput, flex: '0 0 260px' }}
              value={spriModal.search}
              onChange={(e) => setSpriModal((p) => (p ? { ...p, search: e.target.value } : p))}
            />
            <button
              type="button"
              onClick={() => fetchSpriPasien({ mode: spriModal.mode, tglDari: spriModal.tglDari, tglAkhir: spriModal.tglAkhir, search: spriModal.search })}
              style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Cari
            </button>
          </div>

          {spriModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat daftar SPRI...</div>}
          {spriModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{spriModal.error}</div>}
          {!spriModal.loading && !spriModal.error && spriModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ditemukan data SPRI untuk filter ini.</div>
          )}

          {spriModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.Rawat', 'No.Kartu', 'No.RM', 'Nama Pasien', 'Tgl.Lahir', 'J.K.', 'Diagnosa', 'Tgl.Surat', 'No.Surat', 'Tgl.Kontrol', 'Kode Dokter', 'Nama Dokter/Spesialis', 'Kode Poli', 'Nama Poli/Unit'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spriModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihSpri(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_rawat || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_kartu || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.nomr || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_pasien || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tanggal_lahir)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jkel || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.diagnosa || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tgl_surat)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_surat || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatTgl(item.tgl_rencana)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_dokter_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_dokter_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_poli_bpjs || '-'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_poli_bpjs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi No.SKDP/SPRI di form.</div>
        </div>
      </div>
    )}

    {dpjpLayananModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setDpjpLayananModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 480, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              Referensi Dokter DPJP BPJS — {dpjpLayananModal.target === 'dpjp' ? 'Dokter DPJP' : 'DPJP Layanan'}
            </span>
            <button
              type="button"
              onClick={() => setDpjpLayananModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Cari kode/nama dokter..."
              style={pillInput}
              value={dpjpLayananModal.search}
              onChange={(e) => setDpjpLayananModal((p) => (p ? { ...p, search: e.target.value } : p))}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchDpjpLayanan(dpjpLayananModal.search, dpjpLayananModal.target); }}
            />
            <button
              type="button"
              onClick={() => fetchDpjpLayanan(dpjpLayananModal.search, dpjpLayananModal.target)}
              style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Cari
            </button>
          </div>

          {dpjpLayananModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat daftar dokter...</div>}
          {dpjpLayananModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{dpjpLayananModal.error}</div>}
          {!dpjpLayananModal.loading && !dpjpLayananModal.error && dpjpLayananModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Belum ada dokter yang di-mapping. Tambahkan lewat Pengaturan &gt; Bridging BPJS &gt; Mapping Dokter DPJP VCLAIM.
            </div>
          )}

          {dpjpLayananModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.', 'Kode Dokter', 'Nama Dokter'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dpjpLayananModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihDpjpLayanan(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}.</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_dokter_bpjs}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_dokter_bpjs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>
            Klik satu baris untuk mengisi {dpjpLayananModal.target === 'dpjp' ? 'Kd DPJP & Dokter DPJP' : 'Kd DPJP Layanan & DPJP Layanan'} di form. Menampilkan kode/nama dokter versi BPJS (bukan dokter lokal).
          </div>
        </div>
      </div>
    )}

    {faskesModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setFaskesModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 560, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Cari Faskes Perujuk (PPK Rujukan)</span>
            <button
              type="button"
              onClick={() => setFaskesModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Nama/kode faskes yang dicari..."
              style={pillInput}
              value={faskesModal.search}
              onChange={(e) => setFaskesModal((p) => (p ? { ...p, search: e.target.value } : p))}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchFaskes(faskesModal.search); }}
            />
            <button
              type="button"
              onClick={() => fetchFaskes(faskesModal.search)}
              style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Cari
            </button>
          </div>

          {faskesModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari faskes...</div>}
          {faskesModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{faskesModal.error}</div>}
          {!faskesModal.loading && !faskesModal.error && faskesModal.search && faskesModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ditemukan faskes untuk kata kunci ini.</div>
          )}
          {!faskesModal.loading && !faskesModal.error && !faskesModal.search && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Ketik nama atau kode faskes, lalu tekan Enter/Cari.</div>
          )}

          {faskesModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.', 'Kode Faskes', 'Nama Faskes'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['Faskes 1', 'Faskes 2/RS'] as const).map((section) => {
                    const sectionItems = faskesModal.items.filter((it) => it.section === section);
                    if (sectionItems.length === 0) return null;
                    return (
                      <React.Fragment key={section}>
                        <tr style={{ background: '#eff6ff' }}>
                          <td colSpan={3} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#1e40af' }}>{section}</td>
                        </tr>
                        {sectionItems.map((item, idx) => (
                          <tr
                            key={idx}
                            onClick={() => handlePilihFaskes(item)}
                            style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                          >
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}.</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kode}</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi Kode/Nama PPK Rujukan di form.</div>
        </div>
      </div>
    )}

    {diagnosaModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setDiagnosaModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 560, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Cari Referensi Diagnosa (ICD-10)</span>
            <button
              type="button"
              onClick={() => setDiagnosaModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Kode ICD-10 atau nama penyakit..."
              style={pillInput}
              value={diagnosaModal.search}
              onChange={(e) => setDiagnosaModal((p) => (p ? { ...p, search: e.target.value } : p))}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchDiagnosa(diagnosaModal.search); }}
            />
            <button
              type="button"
              onClick={() => fetchDiagnosa(diagnosaModal.search)}
              style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Cari
            </button>
          </div>

          {diagnosaModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari diagnosa...</div>}
          {diagnosaModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{diagnosaModal.error}</div>}
          {!diagnosaModal.loading && !diagnosaModal.error && diagnosaModal.search && diagnosaModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ditemukan diagnosa untuk kata kunci ini.</div>
          )}
          {!diagnosaModal.loading && !diagnosaModal.error && !diagnosaModal.search && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Ketik kode ICD-10 atau nama penyakit, lalu tekan Enter/Cari.</div>
          )}

          {diagnosaModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.', 'Kode ICD X', 'Nama Penyakit'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diagnosaModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihDiagnosa(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}.</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kode}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi Kode/Nama Diagnosa Awal di form.</div>
        </div>
      </div>
    )}

    {poliModal && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={() => setPoliModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 480, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Referensi Poli BPJS</span>
            <button
              type="button"
              onClick={() => setPoliModal(null)}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Cari kode/nama poli..."
              style={pillInput}
              value={poliModal.search}
              onChange={(e) => setPoliModal((p) => (p ? { ...p, search: e.target.value } : p))}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchPoliBpjs(poliModal.search); }}
            />
            <button
              type="button"
              onClick={() => fetchPoliBpjs(poliModal.search)}
              style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Cari
            </button>
          </div>

          {poliModal.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat daftar poli...</div>}
          {poliModal.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{poliModal.error}</div>}
          {!poliModal.loading && !poliModal.error && poliModal.items.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Belum ada poli yang di-mapping. Tambahkan lewat Pengaturan &gt; Bridging BPJS &gt; Mapping Poli VCLAIM.
            </div>
          )}

          {poliModal.items.length > 0 && (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    {['No.', 'Kode Poli', 'Nama Poli'].map((h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {poliModal.items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handlePilihPoli(item)}
                      style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'; }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}.</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kd_poli_bpjs}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_poli_bpjs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Klik satu baris untuk mengisi Kode/Nama Poli Tujuan di form. Menampilkan kode/nama poli versi BPJS (bukan poli lokal).</div>
        </div>
      </div>
    )}
    </>
  );
};
