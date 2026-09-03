import React from 'react';
import Swal from 'sweetalert2';

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

interface ModalInputAwalKeperawatanIGDProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  onSuccess?: () => void;
  user?: AppUser;
}

// Enum PERSIS kolom penilaian_awal_keperawatan_igd (DESCRIBE, dicek
// langsung ke DB — bukan tebakan). Urutan tiap opsi SAMA PERSIS urutan
// enum di DB (bukan diurut ulang), krn opsi pertama dipakai sbg default
// <select> saat form baru dibuka.
const INFORMASI_OPTIONS = ['Autoanamnesis', 'Alloanamnesis'];
const STATUS_HAMIL_OPTIONS = ['Tidak Hamil', 'Hamil'];
const TEKANAN_OPTIONS = ['TAK', 'Sakit Kepala', 'Muntah', 'Pusing', 'Bingung'];
const PUPIL_OPTIONS = ['Normal', 'Miosis', 'Isokor', 'Anisokor'];
const NEUROSENSORIK_OPTIONS = ['TAK', 'Spasme Otot', 'Perubahan Sensorik', 'Perubahan Motorik', 'Perubahan Bentuk Ekstremitas', 'Penurunan Tingkat Kesadaran', 'Fraktur/Dislokasi', 'Luksasio', 'Kerusakan Jaringan/Luka'];
const INTEGUMEN_OPTIONS = ['TAK', 'Luka Bakar', 'Luka Robek', 'Lecet', 'Luka Decubitus', 'Luka Gangren'];
const TURGOR_OPTIONS = ['Baik', 'Menurun'];
const EDEMA_OPTIONS = ['Tidak Ada', 'Ekstremitas', 'Seluruh Tubuh', 'Asites', 'Palpebrae'];
const MUKOSA_OPTIONS = ['Lembab', 'Kering'];
const PERDARAHAN_OPTIONS = ['Tidak Ada', 'Ada'];
const INTOKSIKASI_OPTIONS = ['Tidak Ada', 'Ada', 'Gigitan Binatang', 'Zat Kimia', 'Gas', 'Obat'];
const PSIKOLOGIS_OPTIONS = ['Tidak Ada Masalah', 'Marah', 'Takut', 'Depresi', 'Cepat Lelah', 'Cemas', 'Gelisah', 'Lain-lain'];
const JIWA_OPTIONS = ['Ya', 'Tidak'];
const PERILAKU_OPTIONS = ['Perilaku Kekerasan', 'Gangguan Efek', 'Gangguan Memori', 'Halusinasi', 'Kecenderungan Percobaan Bunuh Diri', 'Lainnya', '-'];
const HUBUNGAN_OPTIONS = ['Harmonis', 'Kurang Harmonis', 'Tidak Harmonis', 'Konflik Besar'];
const TINGGAL_DENGAN_OPTIONS = ['Sendiri', 'Orang Tua', 'Suami / Istri', 'Lainnya'];
const BUDAYA_OPTIONS = ['Tidak Ada', 'Ada'];
const PENDIDIKAN_PJ_OPTIONS = ['-', 'TS', 'TK', 'SD', 'SMP', 'SMA', 'SLTA/SEDERAJAT', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];
const EDUKASI_OPTIONS = ['Pasien', 'Keluarga'];
const KEMAMPUAN_OPTIONS = ['Mandiri', 'Bantuan Minimal', 'Bantuan Sebagian', 'Ketergantungan Total'];
const AKTIFITAS_OPTIONS = ['Tirah Baring', 'Duduk', 'Berjalan'];
const ALAT_BANTU_OPTIONS = ['Tidak', 'Ya'];
const NYERI_OPTIONS = ['Tidak Ada Nyeri', 'Nyeri Akut', 'Nyeri Kronis'];
const PROVOKES_OPTIONS = ['Proses Penyakit', 'Benturan', 'Lain-lain'];
const QUALITY_OPTIONS = ['Seperti Tertusuk', 'Berdenyut', 'Teriris', 'Tertindih', 'Tertiban', 'Lain-lain'];
const MENYEBAR_OPTIONS = ['Tidak', 'Ya'];
const SKALA_NYERI_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const NYERI_HILANG_OPTIONS = ['Istirahat', 'Medengar Musik', 'Minum Obat'];
const PADA_DOKTER_OPTIONS = ['Tidak', 'Ya'];
const BERJALAN_OPTIONS = ['Ya', 'Tidak'];
const HASIL_OPTIONS = ['Tidak beresiko (tidak ditemukan a dan b)', 'Resiko rendah (ditemukan a/b)', 'Resiko tinggi (ditemukan a dan b)'];
const LAPOR_OPTIONS = ['Ya', 'Tidak'];

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 };
const inputStyle: React.CSSProperties = { width: '100%', height: 26, padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' };
const headerInputStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 64, fontFamily: 'inherit' };

// Fokus kolom = border + ring biru tosca (#1AB1E5), konsisten dgn tema
// PemeriksaanIGD.tsx/ModalInputTriase.tsx/ModalInputAwalMedisIGD.tsx.
const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#1AB1E5';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,177,229,0.15)';
};
const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow = 'none';
};

const StepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

// Garis pemisah DI ATAS judul (bukan di bawah) — per permintaan user,
// berlaku sama utk semua judul section I s/d X.
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, color: '#111827', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>{children}</div>
);

// Catatan: SelectField/TextField (stacked, label di atas kolom) sudah tidak
// dipakai lagi — semua section (I s/d IX) sekarang pakai InlineSelectField/
// InlineTextField (label sebaris dgn kolomnya), jadi definisinya dihapus.

// InlineSelectField — label di kiri (boleh panjang/wrap), <select> di kanan
// LEBAR TETAP (bukan width:100% mengikuti kolom) — dipakai utk label
// panjang tapi isinya cuma "Ya"/"Tidak" dkk (mis. Cara Berjalan di
// Pengkajian Resiko Jatuh), supaya kotak dropdown tidak ikut melar sangat
// panjang cuma utk nampung teks pendek (persis proporsi referensi cetak
// Khanza Desktop — dropdown-nya kecil, label teks yg panjang).
const InlineSelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  selectWidth?: number;
}> = ({ label, value, onChange, options, selectWidth = 70 }) => (
  // Label SENGAJA tanpa flex:1 (beda dari SelectField/versi awal) — biar
  // ngikut lebar teksnya sendiri (label pendek = dropdown nempel rapat di
  // sebelahnya), tapi tetap boleh menyusut & wrap kalau labelnya panjang
  // (flex-shrink default browser + min-width:auto), krn dropdown-nya
  // flexShrink:0 (lebar tetap) jadi label yg "mengalah" duluan.
  <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <label style={{ ...labelStyle, marginBottom: 0, lineHeight: '26px' }}>{label} :</label>
    <div style={{ position: 'relative', width: selectWidth, flexShrink: 0 }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
        {options.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <StepperIcon />
    </div>
  </div>
);

// InlineTextField — padanan InlineSelectField utk <input> teks (mis. "Jam
// Dilaporkan" yg isinya cuma jam singkat, kotaknya TIDAK perlu selebar
// label-nya).
const InlineTextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  inputWidth?: number;
  placeholder?: string;
}> = ({ label, value, onChange, maxLength, inputWidth = 70, placeholder }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <label style={{ ...labelStyle, marginBottom: 0, lineHeight: '26px' }}>{label} :</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={maxLength} placeholder={placeholder} style={{ ...inputStyle, width: inputWidth, flexShrink: 0 }} />
  </div>
);

// PegawaiResult — bentuk respons GET /api/pegawai (nik, nama, jbtn).
type PegawaiResult = { nik: string; nama: string; jbtn: string };

// MasterMasalahItem/MasterRencanaItem — bentuk respons GET /api/master-
// masalah-rencana-keperawatan-igd (backend/asuhan_keperawatan_igd_handler.go).
// MasterRencanaItem.kode_masalah = masalah induknya, dipakai utk cascading
// filter di panel "Rencana Keperawatan".
type MasterMasalahItem = { kode_masalah: string; nama_masalah: string };
type MasterRencanaItem = { kode_masalah: string; kode_rencana: string; rencana_keperawatan: string };

// ModalInputAwalKeperawatanIGD.tsx — form input "Pengkajian Awal
// Keperawatan IGD", dibuka dari tab "Awal Keperawatan" di
// PemeriksaanIGD.tsx. Gaya SAMA persis dgn ModalInputAwalMedisIGD.tsx/
// ModalInputTriase.tsx — panel full-height slide-in dari kanan, header
// info pasien identik (no_rawat/no_rkm_medis/nm_pasien/umur + Tanggal &
// Jam di header).
//
// ChecklistBox — kotak checklist "Masalah Keperawatan"/"Rencana Keperawatan"
// (Section X), PERSIS bentuk screenshot Khanza: header kolom "P" + judul,
// list scrollable (baris tercentang jadi merah), "Key Word :" filter di
// bawahnya (live-filter client-side, dataset kecil jadi tidak perlu
// round-trip server per ketikan).
const ChecklistBox: React.FC<{
  title: string;
  items: { code: string; label: string }[];
  selected: string[];
  onToggle: (code: string) => void;
  keyword: string;
  onKeywordChange: (v: string) => void;
  emptyText: string;
}> = ({ title, items, selected, onToggle, keyword, onKeywordChange, emptyText }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ display: 'flex', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
        <div style={{ width: 28, padding: '6px 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
        <div style={{ flex: 1, padding: '6px 8px' }}>{title}</div>
      </div>
      <div style={{ height: 180, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>{emptyText}</div>
        ) : items.map((it) => {
          const checked = selected.includes(it.code);
          return (
            <div
              key={it.code}
              onClick={() => onToggle(it.code)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: checked ? '#fef2f2' : undefined }}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(it.code)} onClick={(e) => e.stopPropagation()} style={{ width: 14, height: 14, flexShrink: 0, accentColor: '#1AB1E5' }} />
              <span style={{ fontSize: 12, color: checked ? '#dc2626' : '#374151' }}>{it.label}</span>
            </div>
          );
        })}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Key Word :</label>
      <input type="text" value={keyword} onChange={(e) => onKeywordChange(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
    </div>
  </div>
);

// Field PERSIS kolom penilaian_awal_keperawatan_igd (referensi Khanza
// Desktop: RMPenilaianAwalKeperawatanIGD.java) — user cuma kasih daftar
// kolom tabMode (bukan setBounds() lengkap spt Awal Medis dulu), jadi
// pengelompokan section I-X di bawah adalah penataan baru (BUKAN salinan
// urutan Java persis), tapi field/opsi enum-nya tetap 1:1 dgn DB (DESCRIBE,
// bukan tebakan). Section X (RENCANA KEPERAWATAN) = 2 checklist bersebelahan
// (Masalah Keperawatan | tab Rencana Keperawatan/Rencana Keperawatan
// Lainnya) PERSIS screenshot referensi Khanza yg dikasih user — centang
// Masalah di kiri -> Rencana Keperawatan terkait (cascading by kode_masalah)
// nongol di kanan siap dicentang; tab "...Lainnya" = free text (kolom
// `rencana` yg sudah ada dari awal, dipindah ke sini). Simpan -> POST
// /api/asuhan-keperawatan-igd/simpan (INSERT SAJA, no_rawat PRIMARY KEY
// TUNGGAL — beda dari penilaian_medis_igd yg PK-nya no_rawat+tgl_perawatan,
// jadi HANYA SATU asuhan keperawatan per kunjungan IGD, mirip Triase).
export const ModalInputAwalKeperawatanIGD: React.FC<ModalInputAwalKeperawatanIGDProps> = ({ isOpen, onClose, patient, onSuccess, user }) => {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  const [tglAsuhan, setTglAsuhan] = React.useState(() => localDateStr());
  const [jamAsuhan, setJamAsuhan] = React.useState(() => localTimeStr());

  // Petugas (nip) — kolom `nip` di DB PUNYA foreign key ke tabel petugas
  // (SHOW CREATE TABLE, dicek langsung), jadi TIDAK cukup asal percaya
  // user.username spt ModalInputTriase.tsx (yg field petugas_nik-nya tidak
  // ada FK) — combobox ini WAJIB pilih dari hasil pencarian /api/pegawai
  // (asumsi nik pegawai = nip petugas utk orang yg sama, sama konvensi yg
  // dipakai getSignerEmail/ModalCariPegawai di seluruh app ini).
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasNama, setPetugasNama] = React.useState('');
  const [petugasResults, setPetugasResults] = React.useState<PegawaiResult[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);
  const petugasFieldRef = React.useRef<HTMLDivElement>(null);

  const [informasi, setInformasi] = React.useState(INFORMASI_OPTIONS[0]);
  const [keluhanUtama, setKeluhanUtama] = React.useState('');
  const [rpd, setRpd] = React.useState('');
  const [rpo, setRpo] = React.useState('');

  const [statusKehamilan, setStatusKehamilan] = React.useState(STATUS_HAMIL_OPTIONS[0]);
  const [gravida, setGravida] = React.useState('');
  const [para, setPara] = React.useState('');
  const [abortus, setAbortus] = React.useState('');
  const [hpht, setHpht] = React.useState('');

  const [tekanan, setTekanan] = React.useState(TEKANAN_OPTIONS[0]);
  const [pupil, setPupil] = React.useState(PUPIL_OPTIONS[0]);
  const [neurosensorik, setNeurosensorik] = React.useState(NEUROSENSORIK_OPTIONS[0]);
  const [integumen, setIntegumen] = React.useState(INTEGUMEN_OPTIONS[0]);
  const [turgor, setTurgor] = React.useState(TURGOR_OPTIONS[0]);
  const [mukosa, setMukosa] = React.useState(MUKOSA_OPTIONS[0]);
  const [edema, setEdema] = React.useState(EDEMA_OPTIONS[0]);
  const [perdarahan, setPerdarahan] = React.useState(PERDARAHAN_OPTIONS[0]);
  const [jumlahPerdarahan, setJumlahPerdarahan] = React.useState('');
  const [warnaPerdarahan, setWarnaPerdarahan] = React.useState('');
  const [intoksikasi, setIntoksikasi] = React.useState(INTOKSIKASI_OPTIONS[0]);

  const [bab, setBab] = React.useState('');
  const [xbab, setXbab] = React.useState('');
  const [kbab, setKbab] = React.useState('');
  const [wbab, setWbab] = React.useState('');
  const [bak, setBak] = React.useState('');
  const [xbak, setXbak] = React.useState('');
  const [wbak, setWbak] = React.useState('');
  const [lbak, setLbak] = React.useState('');

  const [psikologis, setPsikologis] = React.useState(PSIKOLOGIS_OPTIONS[0]);
  const [jiwa, setJiwa] = React.useState(JIWA_OPTIONS[0]);
  const [perilaku, setPerilaku] = React.useState(PERILAKU_OPTIONS[0]);
  const [dilaporkan, setDilaporkan] = React.useState('');
  const [sebutkan, setSebutkan] = React.useState('');
  const [hubungan, setHubungan] = React.useState(HUBUNGAN_OPTIONS[0]);
  const [tinggalDengan, setTinggalDengan] = React.useState(TINGGAL_DENGAN_OPTIONS[0]);
  const [ketTinggal, setKetTinggal] = React.useState('');
  const [budaya, setBudaya] = React.useState(BUDAYA_OPTIONS[0]);
  const [ketBudaya, setKetBudaya] = React.useState('');

  const [pendidikanPJ, setPendidikanPJ] = React.useState(PENDIDIKAN_PJ_OPTIONS[0]);
  const [ketPendidikanPJ, setKetPendidikanPJ] = React.useState('');
  const [edukasi, setEdukasi] = React.useState(EDUKASI_OPTIONS[0]);
  const [ketEdukasi, setKetEdukasi] = React.useState('');

  const [kemampuan, setKemampuan] = React.useState(KEMAMPUAN_OPTIONS[0]);
  const [aktifitas, setAktifitas] = React.useState(AKTIFITAS_OPTIONS[0]);
  const [alatBantu, setAlatBantu] = React.useState(ALAT_BANTU_OPTIONS[0]);
  const [ketBantu, setKetBantu] = React.useState('');

  const [nyeri, setNyeri] = React.useState(NYERI_OPTIONS[0]);
  const [provokes, setProvokes] = React.useState(PROVOKES_OPTIONS[0]);
  const [ketProvokes, setKetProvokes] = React.useState('');
  const [quality, setQuality] = React.useState(QUALITY_OPTIONS[0]);
  const [ketQuality, setKetQuality] = React.useState('');
  const [lokasi, setLokasi] = React.useState('');
  const [menyebar, setMenyebar] = React.useState(MENYEBAR_OPTIONS[0]);
  const [skalaNyeri, setSkalaNyeri] = React.useState(SKALA_NYERI_OPTIONS[0]);
  const [durasi, setDurasi] = React.useState('');
  const [nyeriHilang, setNyeriHilang] = React.useState(NYERI_HILANG_OPTIONS[0]);
  const [ketNyeri, setKetNyeri] = React.useState('');
  const [padaDokter, setPadaDokter] = React.useState(PADA_DOKTER_OPTIONS[0]);
  const [ketDokter, setKetDokter] = React.useState('');

  const [berjalanA, setBerjalanA] = React.useState(BERJALAN_OPTIONS[0]);
  const [berjalanB, setBerjalanB] = React.useState(BERJALAN_OPTIONS[0]);
  const [berjalanC, setBerjalanC] = React.useState(BERJALAN_OPTIONS[0]);
  const [hasil, setHasil] = React.useState(HASIL_OPTIONS[0]);
  const [lapor, setLapor] = React.useState(LAPOR_OPTIONS[0]);
  const [ketLapor, setKetLapor] = React.useState('');

  const [rencana, setRencana] = React.useState('');

  // Checklist "Masalah Keperawatan" / "Rencana Keperawatan" (Section X) —
  // master data di-fetch SEKALI (dataset kecil), panel Rencana Keperawatan
  // difilter client-side ter-cascade thd Masalah yg dicentang (PERSIS
  // perilaku yg dijelaskan user: centang Masalah -> rencananya nongol di
  // panel kanan, baru bisa dicentang lagi sesuai kondisi lapangan).
  // "Rencana Keperawatan Lainnya" (tab kedua) = free text `rencana` yg
  // sudah ada dari awal, dipindah ke dalam tab ini.
  const [masalahList, setMasalahList] = React.useState<MasterMasalahItem[]>([]);
  const [rencanaMasterList, setRencanaMasterList] = React.useState<MasterRencanaItem[]>([]);
  const [selectedMasalah, setSelectedMasalah] = React.useState<string[]>([]);
  const [selectedRencana, setSelectedRencana] = React.useState<string[]>([]);
  const [masalahKeyword, setMasalahKeyword] = React.useState('');
  const [rencanaKeyword, setRencanaKeyword] = React.useState('');
  const [rencanaTab, setRencanaTab] = React.useState<'utama' | 'lainnya'>('utama');

  React.useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch('/api/master-masalah-rencana-keperawatan-igd');
        if (!res.ok) return;
        const data = await res.json();
        setMasalahList(Array.isArray(data.masalah) ? data.masalah : []);
        setRencanaMasterList(Array.isArray(data.rencana) ? data.rencana : []);
      } catch {
        setMasalahList([]);
        setRencanaMasterList([]);
      }
    })();
  }, [isOpen]);

  const toggleMasalah = (kode: string) => {
    setSelectedMasalah((prev) => prev.includes(kode) ? prev.filter((k) => k !== kode) : [...prev, kode]);
  };
  const toggleRencana = (kode: string) => {
    setSelectedRencana((prev) => prev.includes(kode) ? prev.filter((k) => k !== kode) : [...prev, kode]);
  };

  const filteredMasalahList = masalahList.filter((m) => m.nama_masalah.toLowerCase().includes(masalahKeyword.trim().toLowerCase()));
  // Rencana Keperawatan ter-cascade: cuma tampil punya kode_masalah yg
  // sedang dicentang di panel Masalah Keperawatan.
  const cascadedRencanaList = rencanaMasterList.filter((r) => selectedMasalah.includes(r.kode_masalah));
  const filteredRencanaList = cascadedRencanaList.filter((r) => r.rencana_keperawatan.toLowerCase().includes(rencanaKeyword.trim().toLowerCase()));

  const [saving, setSaving] = React.useState(false);

  // Petugas default = user yang login — PERSIS pola ModalInputTriase.tsx
  // (langsung percaya user.full_name, TANPA verifikasi ke tabel petugas
  // dulu spt ModalInputAwalMedisIGD.tsx krn petugas keperawatan lazimnya
  // perawat, bukan dokter). Role "admin" DIKECUALIKAN eksplisit — admin yg
  // login TIDAK ikut auto-fill, field dibiarkan kosong wajib dicari manual.
  React.useEffect(() => {
    if (isOpen && user?.username && user.role !== 'admin') {
      setPetugasNip(user.username);
      setPetugasNama(user.full_name || '');
    }
  }, [isOpen, user]);

  const searchPegawaiList = async (q: string) => {
    try {
      const url = q ? `/api/pegawai?search=${encodeURIComponent(q)}` : '/api/pegawai';
      const res = await fetch(url);
      const data = res.ok ? await res.json() : [];
      setPetugasResults(Array.isArray(data) ? data : []);
    } catch {
      setPetugasResults([]);
    }
  };

  // Dependency sengaja cuma petugasNama (bukan showPetugasDropdown) — lihat
  // komentar panjang pola serupa di ModalInputAwalMedisIGD.tsx/
  // ModalInputTriase.tsx: effect ini murni reaksi ketikan, tidak ketimpa
  // ulang oleh onFocus yg sudah langsung panggil searchPegawaiList('').
  React.useEffect(() => {
    if (!showPetugasDropdown) return;
    const t = setTimeout(() => { searchPegawaiList(petugasNama.trim()); }, 250);
    return () => clearTimeout(t);
  }, [petugasNama]);

  React.useEffect(() => {
    if (!showPetugasDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (petugasFieldRef.current && !petugasFieldRef.current.contains(e.target as Node)) {
        setShowPetugasDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPetugasDropdown]);

  const pilihPetugas = (p: PegawaiResult) => {
    setPetugasNip(p.nik);
    setPetugasNama(p.nama);
    setShowPetugasDropdown(false);
  };

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  const resetForm = () => {
    setPetugasNip(''); setPetugasNama('');
    setInformasi(INFORMASI_OPTIONS[0]); setKeluhanUtama(''); setRpd(''); setRpo('');
    setStatusKehamilan(STATUS_HAMIL_OPTIONS[0]); setGravida(''); setPara(''); setAbortus(''); setHpht('');
    setTekanan(TEKANAN_OPTIONS[0]); setPupil(PUPIL_OPTIONS[0]); setNeurosensorik(NEUROSENSORIK_OPTIONS[0]);
    setIntegumen(INTEGUMEN_OPTIONS[0]); setTurgor(TURGOR_OPTIONS[0]); setMukosa(MUKOSA_OPTIONS[0]);
    setEdema(EDEMA_OPTIONS[0]); setPerdarahan(PERDARAHAN_OPTIONS[0]); setJumlahPerdarahan(''); setWarnaPerdarahan('');
    setIntoksikasi(INTOKSIKASI_OPTIONS[0]);
    setBab(''); setXbab(''); setKbab(''); setWbab(''); setBak(''); setXbak(''); setWbak(''); setLbak('');
    setPsikologis(PSIKOLOGIS_OPTIONS[0]); setJiwa(JIWA_OPTIONS[0]); setPerilaku(PERILAKU_OPTIONS[0]);
    setDilaporkan(''); setSebutkan(''); setHubungan(HUBUNGAN_OPTIONS[0]);
    setTinggalDengan(TINGGAL_DENGAN_OPTIONS[0]); setKetTinggal(''); setBudaya(BUDAYA_OPTIONS[0]); setKetBudaya('');
    setPendidikanPJ(PENDIDIKAN_PJ_OPTIONS[0]); setKetPendidikanPJ('');
    setEdukasi(EDUKASI_OPTIONS[0]); setKetEdukasi('');
    setKemampuan(KEMAMPUAN_OPTIONS[0]); setAktifitas(AKTIFITAS_OPTIONS[0]); setAlatBantu(ALAT_BANTU_OPTIONS[0]); setKetBantu('');
    setNyeri(NYERI_OPTIONS[0]); setProvokes(PROVOKES_OPTIONS[0]); setKetProvokes('');
    setQuality(QUALITY_OPTIONS[0]); setKetQuality(''); setLokasi(''); setMenyebar(MENYEBAR_OPTIONS[0]);
    setSkalaNyeri(SKALA_NYERI_OPTIONS[0]); setDurasi(''); setNyeriHilang(NYERI_HILANG_OPTIONS[0]); setKetNyeri('');
    setPadaDokter(PADA_DOKTER_OPTIONS[0]); setKetDokter('');
    setBerjalanA(BERJALAN_OPTIONS[0]); setBerjalanB(BERJALAN_OPTIONS[0]); setBerjalanC(BERJALAN_OPTIONS[0]);
    setHasil(HASIL_OPTIONS[0]); setLapor(LAPOR_OPTIONS[0]); setKetLapor('');
    setRencana('');
    setSelectedMasalah([]); setSelectedRencana([]); setMasalahKeyword(''); setRencanaKeyword(''); setRencanaTab('utama');
  };

  // Validasi minimal — konsisten pola ModalInputAwalMedisIGD.tsx (dropdown
  // selalu punya default, jadi cuma field bebas/wajib-pilih yg dicek).
  const validationError = (): string | null => {
    if (!petugasNip) return 'Petugas wajib dipilih';
    if (!keluhanUtama.trim()) return 'Keluhan Utama wajib diisi';
    return null;
  };

  const handleSimpan = async () => {
    const err = validationError();
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: err, confirmButtonColor: '#1AB1E5' });
      return;
    }

    const payload = {
      no_rawat: patient?.no_rawat,
      tanggal: `${tglAsuhan} ${jamAsuhan}:00`,
      informasi,
      keluhan_utama: keluhanUtama,
      rpd,
      rpo,
      status_kehamilan: statusKehamilan,
      gravida,
      para,
      abortus,
      hpht,
      tekanan,
      pupil,
      neurosensorik,
      integumen,
      turgor,
      edema,
      mukosa,
      perdarahan,
      jumlah_perdarahan: jumlahPerdarahan,
      warna_perdarahan: warnaPerdarahan,
      intoksikasi,
      bab,
      xbab,
      kbab,
      wbab,
      bak,
      xbak,
      wbak,
      lbak,
      psikologis,
      jiwa,
      perilaku,
      dilaporkan,
      sebutkan,
      hubungan,
      tinggal_dengan: tinggalDengan,
      ket_tinggal: ketTinggal,
      budaya,
      ket_budaya: ketBudaya,
      pendidikan_pj: pendidikanPJ,
      ket_pendidikan_pj: ketPendidikanPJ,
      edukasi,
      ket_edukasi: ketEdukasi,
      kemampuan,
      aktifitas,
      alat_bantu: alatBantu,
      ket_bantu: ketBantu,
      nyeri,
      provokes,
      ket_provokes: ketProvokes,
      quality,
      ket_quality: ketQuality,
      lokasi,
      menyebar,
      skala_nyeri: skalaNyeri,
      durasi,
      nyeri_hilang: nyeriHilang,
      ket_nyeri: ketNyeri,
      pada_dokter: padaDokter,
      ket_dokter: ketDokter,
      berjalan_a: berjalanA,
      berjalan_b: berjalanB,
      berjalan_c: berjalanC,
      hasil,
      lapor,
      ket_lapor: ketLapor,
      rencana,
      nip: petugasNip,
      kode_masalah: selectedMasalah,
      kode_rencana: selectedRencana,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/asuhan-keperawatan-igd/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan awal keperawatan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Awal keperawatan berhasil disimpan', confirmButtonColor: '#1AB1E5' });
      resetForm();
      onSuccess?.();
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan saat menyimpan', confirmButtonColor: '#1AB1E5' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
      onClick={onClose}
    >
      {/* Panel — anchor kanan, full height, slide dari kanan ke kiri, PERSIS ModalInputAwalMedisIGD.tsx/ModalInputTriase.tsx */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '60vw', maxWidth: '90vw',
          background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — identik ModalInputAwalMedisIGD.tsx */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
              .filter(Boolean)
              .map((v, i, arr) => (
                <React.Fragment key={i}>
                  <span>{v}</span>
                  {i < arr.length - 1 && <span>|</span>}
                </React.Fragment>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <input type="date" value={tglAsuhan} onChange={(e) => setTglAsuhan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
            <input type="time" value={jamAsuhan} onChange={(e) => setJamAsuhan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Petugas + Informasi — sebaris (label sejajar field, "Label :
              ( ... )"), PERSIS pola "Dokter/Petugas IGD :" +
              "Tgl.Triase :" di ModalInputTriase.tsx (beda dari label block
              di atas field spt sisa form di bawah). Informasi dipindah ke
              sini (bukan lagi baris sendiri di bawah Section I) per
              permintaan user. */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 350, flexShrink: 0 }}>
              <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Petugas :</label>
              <div ref={petugasFieldRef} style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={petugasNama}
                  onChange={(e) => { setPetugasNip(''); setPetugasNama(e.target.value); setShowPetugasDropdown(true); }}
                  onFocus={(e) => { handleFieldFocus(e); setShowPetugasDropdown(true); searchPegawaiList(''); }}
                  onBlur={handleFieldBlur}
                  placeholder="Cari petugas..."
                  autoComplete="off"
                  style={{ ...inputStyle, width: '100%', paddingRight: 32 }}
                />
                <StepperIcon />
                {showPetugasDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto', zIndex: 50 }}>
                    {petugasResults.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>Tidak ada petugas ditemukan</div>
                    ) : (
                      petugasResults.map((p) => (
                        <div
                          key={p.nik}
                          onMouseDown={() => pilihPetugas(p)}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ fontSize: 13, color: '#374151' }}>{p.nama}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.nik}{p.jbtn ? ` · ${p.jbtn}` : ''}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 280 }}>
              <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Informasi didapat dari:</label>
              <div style={{ position: 'relative', flex: 1 }}>
                <select value={informasi} onChange={(e) => setInformasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {INFORMASI_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
          </div>

          <SectionTitle>I. RIWAYAT KESEHATAN PASIEN</SectionTitle>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Keluhan Utama</label>
              <textarea value={keluhanUtama} onChange={(e) => setKeluhanUtama(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penggunaan Obat</label>
              <textarea value={rpo} onChange={(e) => setRpo(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penyakit Dahulu</label>
              <textarea value={rpd} onChange={(e) => setRpd(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <InlineSelectField label="Status Kehamilan" value={statusKehamilan} onChange={setStatusKehamilan} options={STATUS_HAMIL_OPTIONS} selectWidth={100} />
                <InlineTextField label="HPHT" value={hpht} onChange={setHpht} maxLength={20} inputWidth={100} />
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <InlineTextField label="Gravida" value={gravida} onChange={setGravida} maxLength={20} inputWidth={60} />
                <InlineTextField label="Para" value={para} onChange={setPara} maxLength={20} inputWidth={60} />
                <InlineTextField label="Abortus" value={abortus} onChange={setAbortus} maxLength={20} inputWidth={60} />
              </div>
            </div>
          </div>

          {/* II. PEMERIKSAAN FISIK — label sebaris dgn kolomnya ("Label :
              ( ... )"), PERSIS pola InlineSelectField di Pengkajian Resiko
              Jatuh, bukan lagi stacked (label di atas, select 100% lebar
              kolom) — per permintaan user. Lebar tiap kotak disesuaikan
              opsi terpanjangnya (default 70 kalau opsinya pendek). */}
          <SectionTitle>II. PEMERIKSAAN FISIK</SectionTitle>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InlineSelectField label="Tekanan Intrakranial" value={tekanan} onChange={setTekanan} options={TEKANAN_OPTIONS} selectWidth={130} />
              <InlineSelectField label="Pupil" value={pupil} onChange={setPupil} options={PUPIL_OPTIONS} selectWidth={90} />
              <InlineSelectField label="Neurosensorik/Muskuloskeletal" value={neurosensorik} onChange={setNeurosensorik} options={NEUROSENSORIK_OPTIONS} selectWidth={220} />
              <InlineSelectField label="Integumen" value={integumen} onChange={setIntegumen} options={INTEGUMEN_OPTIONS} selectWidth={140} />
            </div>
            <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InlineSelectField label="Turgor Kulit" value={turgor} onChange={setTurgor} options={TURGOR_OPTIONS} selectWidth={90} />
              <InlineSelectField label="Mukosa Mulut" value={mukosa} onChange={setMukosa} options={MUKOSA_OPTIONS} selectWidth={90} />
              <InlineSelectField label="Edema" value={edema} onChange={setEdema} options={EDEMA_OPTIONS} selectWidth={130} />
              <InlineSelectField label="Intoksikasi" value={intoksikasi} onChange={setIntoksikasi} options={INTOKSIKASI_OPTIONS} selectWidth={150} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <InlineSelectField label="Perdarahan" value={perdarahan} onChange={setPerdarahan} options={PERDARAHAN_OPTIONS} selectWidth={100} />
            <InlineTextField label="Jml Perdarahan (cc)" value={jumlahPerdarahan} onChange={setJumlahPerdarahan} maxLength={5} />
            <InlineTextField label="Warna Perdarahan" value={warnaPerdarahan} onChange={setWarnaPerdarahan} maxLength={40} inputWidth={140} />
          </div>

          <SectionTitle>III. ELIMINASI</SectionTitle>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
              <InlineTextField label="Frekuensi BAB" value={bab} onChange={setBab} maxLength={2} inputWidth={50} />
              <InlineTextField label="x/" value={xbab} onChange={setXbab} maxLength={10} placeholder="hari" inputWidth={70} />
            </div>
            <InlineTextField label="Konsistensi BAB" value={kbab} onChange={setKbab} maxLength={40} inputWidth={140} />
            <InlineTextField label="Warna BAB" value={wbab} onChange={setWbab} maxLength={40} inputWidth={140} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
              <InlineTextField label="Frekuensi BAK" value={bak} onChange={setBak} maxLength={2} inputWidth={50} />
              <InlineTextField label="x/" value={xbak} onChange={setXbak} maxLength={10} placeholder="hari" inputWidth={70} />
            </div>
            <InlineTextField label="Warna BAK" value={wbak} onChange={setWbak} maxLength={40} inputWidth={140} />
            <InlineTextField label="Lain-lain BAK" value={lbak} onChange={setLbak} maxLength={40} inputWidth={140} />
          </div>

          {/* V. PSIKOSOSIAL — label sebaris dgn kolomnya ("Label : ( ... )"),
              PERSIS pola InlineSelectField/InlineTextField di section lain
              — per permintaan user. */}
          <SectionTitle>IV. PSIKOSOSIAL</SectionTitle>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <InlineSelectField label="Kondisi Psikologis" value={psikologis} onChange={setPsikologis} options={PSIKOLOGIS_OPTIONS} selectWidth={150} />
            <InlineSelectField label="Gangguan Jiwa Di Masa Lalu" value={jiwa} onChange={setJiwa} options={JIWA_OPTIONS} selectWidth={80}/>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <InlineSelectField label="Adakah Perilaku" value={perilaku} onChange={setPerilaku} options={PERILAKU_OPTIONS} selectWidth={250} />
            <InlineTextField label="Dilaporkan Ke" value={dilaporkan} onChange={setDilaporkan} maxLength={50} inputWidth={140} />
            <InlineTextField label="Sebutkan" value={sebutkan} onChange={setSebutkan} maxLength={50} inputWidth={140} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <InlineSelectField label="Hubungan Pasien Dengan Anggota Keluarga" value={hubungan} onChange={setHubungan} options={HUBUNGAN_OPTIONS} selectWidth={130} />
            <InlineSelectField label="Tinggal Dengan" value={tinggalDengan} onChange={setTinggalDengan} options={TINGGAL_DENGAN_OPTIONS} selectWidth={120} />
            <InlineTextField label="Ket." value={ketTinggal} onChange={setKetTinggal} maxLength={50} inputWidth={140} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <InlineSelectField label="Nilai-nilai Kebudayaan" value={budaya} onChange={setBudaya} options={BUDAYA_OPTIONS} selectWidth={100} />
            <InlineTextField label="Ket." value={ketBudaya} onChange={setKetBudaya} maxLength={50} inputWidth={140} />
          </div>

          <SectionTitle>V. EDUKASI</SectionTitle>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <InlineSelectField label="Pendidikan PJ" value={pendidikanPJ} onChange={setPendidikanPJ} options={PENDIDIKAN_PJ_OPTIONS} selectWidth={130} />
            <InlineTextField label="Ket." value={ketPendidikanPJ} onChange={setKetPendidikanPJ} maxLength={50} inputWidth={140} />
            <InlineSelectField label="Edukasi Diberikan Kepada" value={edukasi} onChange={setEdukasi} options={EDUKASI_OPTIONS} selectWidth={100} />
            <InlineTextField label="Ket." value={ketEdukasi} onChange={setKetEdukasi} maxLength={50} inputWidth={140} />
          </div>

          <SectionTitle>VI. KEMAMPUAN AKTIFITAS</SectionTitle>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <InlineSelectField label="Kemampuan Aktifitas Sehari-hari" value={kemampuan} onChange={setKemampuan} options={KEMAMPUAN_OPTIONS} selectWidth={170} />
            <InlineSelectField label="Aktifitas" value={aktifitas} onChange={setAktifitas} options={AKTIFITAS_OPTIONS} selectWidth={110} />
            <InlineSelectField label="Alat Bantu" value={alatBantu} onChange={setAlatBantu} options={ALAT_BANTU_OPTIONS} />
            <InlineTextField label="Ket." value={ketBantu} onChange={setKetBantu} maxLength={50} inputWidth={120} />
          </div>

          {/* VIII. PENGKAJIAN NYERI — gambar Wong Baker Faces Pain Rating
              Scale di kiri (referensi Khanza Desktop), kolom2 isian di
              kanan, PERSIS tata letak screenshot yg dikasih user. */}
          <SectionTitle>VII. PENGKAJIAN NYERI</SectionTitle>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: 300 }}>
              <img src="/awal-keperawatan-igd/skala-nyeri.png" alt="Skala Nyeri (Wong Baker Faces Pain Rating Scale)" style={{ width: '100%', height: 'auto' }} />
            </div>
            <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <InlineSelectField label="Tingkat Nyeri" value={nyeri} onChange={setNyeri} options={NYERI_OPTIONS} selectWidth={127} />
                <InlineSelectField label="Penyebab" value={provokes} onChange={setProvokes} options={PROVOKES_OPTIONS} selectWidth={125} />
                <InlineTextField label="" value={ketProvokes} onChange={setKetProvokes} maxLength={40} inputWidth={100} />
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <InlineSelectField label="Kualitas" value={quality} onChange={setQuality} options={QUALITY_OPTIONS} selectWidth={140} />
                <InlineTextField label="Ket." value={ketQuality} onChange={setKetQuality} maxLength={50} inputWidth={140} />
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <InlineTextField label="Lokasi" value={lokasi} onChange={setLokasi} maxLength={50} inputWidth={140} />
                <InlineSelectField label="Menyebar" value={menyebar} onChange={setMenyebar} options={MENYEBAR_OPTIONS} selectWidth={90} />
              </div>
              {/* Severity/Waktu-Durasi — markup custom (bukan InlineSelectField/
                  InlineTextField biasa) krn ada teks "Skala Nyeri" &amp;
                  "Menit" nempel di sisi select/input, PERSIS screenshot
                  referensi Khanza yg dikasih user. */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, lineHeight: '26px' }}>Severity :</label>
                  <span style={{ fontSize: 12, color: '#374151', lineHeight: '26px' }}>Skala Nyeri</span>
                  <div style={{ position: 'relative', width: 70, flexShrink: 0 }}>
                    <select value={skalaNyeri} onChange={(e) => setSkalaNyeri(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                      {SKALA_NYERI_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <StepperIcon />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, lineHeight: '26px' }}>Waktu / Durasi :</label>
                  <input type="text" value={durasi} onChange={(e) => setDurasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={25} style={{ ...inputStyle, width: 100, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#374151', lineHeight: '26px' }}>Menit</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <InlineSelectField label="Nyeri Hilang Bila" value={nyeriHilang} onChange={setNyeriHilang} options={NYERI_HILANG_OPTIONS} selectWidth={130} />
            <InlineTextField label="Ket." value={ketNyeri} onChange={setKetNyeri} maxLength={40} inputWidth={140} />
            <InlineSelectField label="Diberitahukan Pada Dokter?" value={padaDokter} onChange={setPadaDokter} options={PADA_DOKTER_OPTIONS} selectWidth={90} />
            <InlineTextField label="Jam Lapor" value={ketDokter} onChange={setKetDokter} maxLength={15} />
          </div>

          {/* IX. PENGKAJIAN RESIKO JATUH — tata letak PERSIS referensi cetak
              Khanza Desktop (screenshot "VI. PENGKAJIAN RESIKO JATUH (GET
              UP AND GO)"): sub-label "a. Cara Berjalan :" menaungi
              berjalan_a+berjalan_b sebaris, lalu berjalan_c ("b. Menopang
              saat akan duduk...") baris sendiri, lalu Hasil + Dilaporkan
              Kepada Dokter + Jam Dilaporkan SEBARIS bertiga (bukan
              dipisah). Nomor seksi ("IX.") tetap ikut penomoran sendiri di
              form ini (bukan "VI." spt Java, krn seksi I-X di sini
              penataan baru — lihat komentar atas file). */}
          <SectionTitle>VIII. PENGKAJIAN RESIKO JATUH (GET UP AND GO)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#374151' }}>a. Cara Berjalan :</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <InlineSelectField label="1. Tidak seimbang / sempoyongan / limbung" value={berjalanA} onChange={setBerjalanA} options={BERJALAN_OPTIONS} />
              <InlineSelectField label="2. Jalan dengan menggunakan alat bantu (kruk, tripot, kursi roda, orang lain)" value={berjalanB} onChange={setBerjalanB} options={BERJALAN_OPTIONS} />
            </div>
            <InlineSelectField label="b. Menopang saat akan duduk, tampak memegang pinggiran kursi atau meja / benda lain sebagai penopang" value={berjalanC} onChange={setBerjalanC} options={BERJALAN_OPTIONS} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <InlineSelectField label="Hasil" value={hasil} onChange={setHasil} options={HASIL_OPTIONS} selectWidth={270} />
            <InlineSelectField label="Dilaporkan Kepada Dokter" value={lapor} onChange={setLapor} options={LAPOR_OPTIONS} />
            <InlineTextField label="Jam Dilaporkan" value={ketLapor} onChange={setKetLapor} maxLength={15} />
          </div>

          {/* Garis pemisah TETAP ada (konsisten dgn section lain), tapi
              TANPA judul teks "X. RENCANA KEPERAWATAN" — dianggap satu
              kelompok dgn IX. PENGKAJIAN RESIKO JATUH di atasnya. */}
          <div style={{ paddingTop: 8, borderTop: '1px solid #e5e7eb' }} />
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              {/* Spacer setinggi baris tab di kolom kanan, biar header
                  "P | MASALAH KEPERAWATAN" sejajar dgn header
                  "P | RENCANA KEPERAWATAN" (bukan ketimpa baris tab). */}
              <div style={{ height: 28, marginBottom: -1 }} />
              <ChecklistBox
                title="MASALAH KEPERAWATAN"
                items={filteredMasalahList.map((m) => ({ code: m.kode_masalah, label: m.nama_masalah }))}
                selected={selectedMasalah}
                onToggle={toggleMasalah}
                keyword={masalahKeyword}
                onKeywordChange={setMasalahKeyword}
                emptyText="Tidak ada data"
              />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: -1, position: 'relative', zIndex: 1 }}>
                <button
                  type="button"
                  onClick={() => setRencanaTab('utama')}
                  style={{ height: 28, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, border: '1px solid #d1d5db', borderBottom: rencanaTab === 'utama' ? '1px solid #fff' : '1px solid #d1d5db', background: rencanaTab === 'utama' ? '#fff' : '#f3f4f6', color: rencanaTab === 'utama' ? '#0f7fa3' : '#6b7280', cursor: 'pointer', borderRadius: '4px 4px 0 0' }}
                >
                  Rencana Keperawatan
                </button>
                <button
                  type="button"
                  onClick={() => setRencanaTab('lainnya')}
                  style={{ height: 28, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, border: '1px solid #d1d5db', borderBottom: rencanaTab === 'lainnya' ? '1px solid #fff' : '1px solid #d1d5db', background: rencanaTab === 'lainnya' ? '#fff' : '#f3f4f6', color: rencanaTab === 'lainnya' ? '#0f7fa3' : '#6b7280', cursor: 'pointer', borderRadius: '4px 4px 0 0' }}
                >
                  Rencana Keperawatan Lainnya
                </button>
              </div>
              {rencanaTab === 'utama' ? (
                <ChecklistBox
                  title="RENCANA KEPERAWATAN"
                  items={filteredRencanaList.map((r) => ({ code: r.kode_rencana, label: r.rencana_keperawatan }))}
                  selected={selectedRencana}
                  onToggle={toggleRencana}
                  keyword={rencanaKeyword}
                  onKeywordChange={setRencanaKeyword}
                  emptyText={selectedMasalah.length === 0 ? 'Centang Masalah Keperawatan dulu di sebelah kiri' : 'Tidak ada rencana keperawatan utk masalah yg dipilih'}
                />
              ) : (
                // Tanpa label lagi di atas (judul tab udah cukup jelas,
                // dobel sama teks tab kalau dipertahankan) — tinggi textarea
                // disamain dgn tinggi total ChecklistBox (header+list+Key
                // Word) biar kedua tab konsisten tingginya, tidak nyisain
                // ruang kosong gede spt sebelumnya.
                <textarea
                  value={rencana}
                  onChange={(e) => setRencana(e.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  maxLength={2000}
                  placeholder="Ketik jika memiliki keterangan lainnya yang tidak ada di tab Rencana Keperawatan"
                  style={{ ...textareaStyle, height: 244, minHeight: 244 }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer — sticky */}
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 4, border: 'none', background: saving ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
            onMouseOver={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
            onMouseOut={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Awal Keperawatan'}
          </button>
        </div>
      </div>
    </div>
  );
};
