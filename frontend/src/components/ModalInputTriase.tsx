import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariPegawai } from './ModalCariPegawai';

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

interface ModalInputTriaseProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  onSuccess?: () => void;
  user?: AppUser;
}

type MacamKasus = { kode_kasus: string; macam_kasus: string };
type SkalaItem = { kode_pemeriksaan: string; nama_pemeriksaan: string; kode_skala: string; pengkajian: string };

// Enum PERSIS kolom data_triase_igd (backend/triase_igd_handler.go) —
// cara_masuk/alat_transportasi/alasan_kedatangan semuanya enum di DB,
// jadi opsi dropdown di bawah bukan tebakan, disalin dari DESCRIBE.
const CARA_MASUK_OPTIONS = ['Jalan', 'Brankar', 'Kursi Roda', 'Digendong'];
const TRANSPORTASI_OPTIONS = ['-', 'AGD', 'Sendiri', 'Swasta'];
const ALASAN_KEDATANGAN_OPTIONS = ['Datang Sendiri', 'Polisi', 'Rujukan', 'Bidan', 'Puskesmas', 'Rumah Sakit', 'Poliklinik', 'Faskes Lain', '-'];
// Enum PERSIS data_triase_igdprimer.kebutuhan_khusus/plan &
// data_triase_igdsekunder.plan.
const KEBUTUHAN_KHUSUS_OPTIONS = ['-', 'UPPA', 'Airborne', 'Dekontaminan'];
const PLAN_PRIMER_OPTIONS = ['Ruang Resusitasi', 'Ruang Kritis'];
const PLAN_SEKUNDER_OPTIONS = ['Zona Kuning', 'Zona Hijau'];

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const toggleSetValue = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 };
const inputStyle: React.CSSProperties = { width: '100%', height: 30, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
// headerInputStyle — Tgl.Kunjungan/Jam dipindah ke header (tanpa label),
// jadi butuh ukuran ringkas biar muat di baris header 14px padding.
const headerInputStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 64, fontFamily: 'inherit' };

// Fokus kolom = border + ring biru tosca (#1AB1E5), konsisten dgn tema
// PemeriksaanIGD.tsx.
const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#1AB1E5';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,177,229,0.15)';
};
const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow = 'none';
};

// TriaseStepperIcon — pengganti panah dropdown native pada <select>,
// biru tosca (#1AB1E5) sama dgn tema PemeriksaanIGD.tsx.
const TriaseStepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

// RadioOption — pengganti pasangan JRadioButton "Plan/Keputusan :" di
// RMTriaseIGD.java (PrimerResusitasi/PrimerKritis, SekunderZonaKuning/
// SekunderZonaHijau).
const RadioOption: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
    <input type="radio" checked={checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: '#1AB1E5', cursor: 'pointer' }} />
    {label}
  </label>
);

// SkalaChecklist — checklist master per skala (1-5), dikelompokkan per
// kategori "Pemeriksaan" (JALAN NAFAS/PERNAFASAN/dst). Padanan
// tbSkala1..5 + tampilskala1() dkk di RMTriaseIGD.java, TAPI disederhanakan:
// Java 2 langkah (klik kategori di tbPemeriksaan dulu baru tbSkalaN
// kefilter), di sini semua item (cuma ~12-14 baris) langsung dikirim
// sekaligus & dikelompokkan di klien — datanya kecil jadi tidak perlu
// klik kategori satu-satu ataupun kolom cari.
const SkalaChecklist: React.FC<{ skala: 1 | 2 | 3 | 4 | 5; checkedSet: Set<string>; onToggle: (kode: string) => void }> = ({ skala, checkedSet, onToggle }) => {
  const [items, setItems] = React.useState<SkalaItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/triase-igd-skala/${skala}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SkalaItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [skala]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SkalaItem[]>();
    items.forEach((it) => {
      const list = map.get(it.nama_pemeriksaan) || [];
      list.push(it);
      map.set(it.nama_pemeriksaan, list);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat...</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Tidak ada data</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, padding: 12, background: '#fff' }}>
          {grouped.map(([kategori, list]) => (
            <div key={kategori}>
              <div style={{ fontSize: 10.5, fontWeight: 400, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{kategori}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {list.map((it) => (
                  <label key={it.kode_skala} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={checkedSet.has(it.kode_skala)} onChange={() => onToggle(it.kode_skala)} style={{ width: 15, height: 15, accentColor: '#1AB1E5', cursor: 'pointer', flexShrink: 0 }} />
                    {it.pengkajian}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Warna Skala 1-5 mengikuti kode warna Triase ESI (Emergency Severity
// Index): 1=Merah (paling gawat) .. 5=Biru (paling ringan).
const ESI_SKALA_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#dc2626',
  2: '#f97316',
  3: '#ca8a04',
  4: '#16a34a',
  5: '#2563eb',
};

// SkalaSubTab — pill selector kecil, padanan TabSkala1dan2/
// TabSkala3dan4dan5 (JTabbedPane) di Java. `color` opsional — kalau diisi
// (Skala 1-5, warna ESI), border+font ikut warna itu di kedua state
// (aktif = isi warna+font putih, nonaktif = outline warna+font warna).
// Kalau tidak diisi (mis. tombol Triase Primer/Sekunder), tetap skema
// lama: abu-abu saat nonaktif, biru tosca saat aktif.
const SkalaSubTab: React.FC<{ label: string; active: boolean; count: number; onClick: () => void; color?: string }> = ({ label, active, count, onClick, color }) => {
  const activeColor = color || '#1AB1E5';
  const inactiveBorder = color || '#d1d5db';
  const inactiveText = color || '#374151';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 0, cursor: 'pointer', fontSize: 12, fontWeight: 400,
        border: `1px solid ${active ? activeColor : inactiveBorder}`,
        background: active ? activeColor : '#fff',
        color: active ? '#fff' : inactiveText,
        transition: 'all 0.15s ease',
      }}
    >
      {label}{count > 0 ? ` (${count})` : ''}
    </button>
  );
};

// ModalInputTriase.tsx — form input Triase IGD, dibuka dari tab "Triase"
// di PemeriksaanIGD.tsx (tombol "+ Input Triase"). Tampil sbg panel
// full-height yang slide-in dari kanan (bukan dialog di tengah layar) —
// pola dipilih user, dipakai lagi utk modal input IGD lain menyusul
// (Awal Medis/SOAP/CPPT/Awal Keperawatan).
//
// Field & alur PERSIS RMTriaseIGD.java (SIMRS Khanza Desktop,
// src/rekammedis/RMTriaseIGD.java) — dicek langsung dari
// BtnSimpanActionPerformed (validasi + Sequel.menyimpantf/menyimpantf2):
// header data_triase_igd (Tgl.Kunjungan, Cara Masuk, Transportasi,
// Alasan Kedatangan, Keterangan, Kode/Macam Kasus) + 2 kartu keputusan
// jalur triase (Java: JTabbedPane TabTriase, di sini radio-card) yang
// membuka field spesifik masing2 tabel:
//   - data_triase_igdprimer: Keluhan Utama, Kebutuhan Khusus, Plan
//     (radio: Ruang Resusitasi/Ruang Kritis — bkn dropdown, PERSIS Java),
//     Tgl.Triase, Dokter/Petugas IGD (nik, wajib — DlgCariPegawai di
//     Java = ModalCariPegawai di sini), Catatan.
//   - data_triase_igdsekunder: Anamnesa Singkat, Plan (radio: Zona
//     Kuning/Zona Hijau), Tgl.Triase, Dokter/Petugas IGD, Catatan.
// PENTING (temuan dari Java, BUKAN tebakan): vitals (Tensi/Nadi(/menit)/
// Respirasi(/menit)/Suhu(C)/Saturasi O²(%)/Nyeri) di-input DI DALAM
// masing2 jalur (PrimerTensi/SekunderTensi dst — dua set field
// terpisah), meski keduanya sama2 disimpan ke tabel data_triase_igd yang
// dipakai bersama (baris mana yg tersimpan tergantung jalur mana yg aktif
// saat Simpan) — BUKAN di header seperti dugaan awal.
// Checklist Skala 1-5 (data_triase_igddetail_skala1..5) SUDAH ada —
// SkalaChecklist di bawah, master-nya GET /api/triase-igd-skala/:n
// (backend/triase_igd_handler.go). Beda dari Java (2 langkah: pilih
// kategori "Pemeriksaan" di tbPemeriksaan dulu baru tbSkalaN kefilter) —
// di sini semua item dikirim sekaligus (cuma ~12-14 baris/skala) &
// dikelompokkan per kategori di klien, jadi tidak perlu klik kategori
// satu-satu. Sub-tab SkalaSubTab = padanan TabSkala1dan2 (Primer, pilih
// Skala 1 ATAU 2) / TabSkala3dan4dan5 (Sekunder, pilih Skala 3/4/5) —
// Java hanya menyimpan skala dari sub-tab yg aktif saat Simpan, arsitektur
// sama di sini (checkedSkala1..5 disimpan terpisah per skala, tapi cuma
// sub-tab aktif yg dikirim ke POST /api/triase-igd/simpan). Simpan aktif
// — validasi client-side urutan sama dgn BtnSimpanActionPerformed (lihat
// validationError()), transaksi 3-tabel (header + primer/sekunder +
// detail skala) ditangani backend (triase_igd_handler.go).
export const ModalInputTriase: React.FC<ModalInputTriaseProps> = ({ isOpen, onClose, patient, onSuccess, user }) => {
  // mounted tetap true selama animasi keluar (300ms) berjalan, supaya
  // panel tidak langsung hilang begitu isOpen jadi false.
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  const [tglKunjungan, setTglKunjungan] = React.useState(() => localDateStr());
  const [jamKunjungan, setJamKunjungan] = React.useState(() => localTimeStr());
  const [caraMasuk, setCaraMasuk] = React.useState('Jalan');
  const [alatTransportasi, setAlatTransportasi] = React.useState('-');
  const [alasanKedatangan, setAlasanKedatangan] = React.useState('-');
  const [keteranganKedatangan, setKeteranganKedatangan] = React.useState('');
  const [kodeKasus, setKodeKasus] = React.useState('');
  const [macamKasusList, setMacamKasusList] = React.useState<MacamKasus[]>([]);
  const [loadingMacamKasus, setLoadingMacamKasus] = React.useState(false);

  // Keputusan jalur triase — data_triase_igdprimer (kondisi mengancam
  // nyawa, langsung resusitasi/kritis) vs data_triase_igdsekunder
  // (kondisi stabil, assessment lanjutan). Dua tabel terpisah di DB,
  // jadi field-nya juga dipisah per jalur di bawah.
  const [jalurTriase, setJalurTriase] = React.useState<'primer' | 'sekunder' | null>(null);

  // Primer (data_triase_igdprimer)
  const [keluhanUtama, setKeluhanUtama] = React.useState('');
  const [kebutuhanKhusus, setKebutuhanKhusus] = React.useState('-');
  const [primerTensi, setPrimerTensi] = React.useState('');
  const [primerNadi, setPrimerNadi] = React.useState('');
  const [primerRespirasi, setPrimerRespirasi] = React.useState('');
  const [primerSuhu, setPrimerSuhu] = React.useState('');
  const [primerSaturasi, setPrimerSaturasi] = React.useState('');
  const [primerNyeri, setPrimerNyeri] = React.useState('');
  const [primerPetugasNik, setPrimerPetugasNik] = React.useState('');
  const [primerPetugasNama, setPrimerPetugasNama] = React.useState('');
  const [planPrimer, setPlanPrimer] = React.useState(PLAN_PRIMER_OPTIONS[0]);
  const [primerTglTriase, setPrimerTglTriase] = React.useState(() => localDateStr());
  const [primerJamTriase, setPrimerJamTriase] = React.useState(() => localTimeStr());
  const [catatanPrimer, setCatatanPrimer] = React.useState('');
  // Checklist Skala 1/2 (data_triase_igddetail_skala1/2) — sub-tab
  // TabSkala1dan2 di Java, minimal 1 item (gabungan skala1+skala2) wajib
  // dicentang sebelum Simpan.
  const [subSkalaPrimer, setSubSkalaPrimer] = React.useState<1 | 2>(1);
  const [checkedSkala1, setCheckedSkala1] = React.useState<Set<string>>(new Set());
  const [checkedSkala2, setCheckedSkala2] = React.useState<Set<string>>(new Set());

  // Sekunder (data_triase_igdsekunder)
  const [anamnesaSingkat, setAnamnesaSingkat] = React.useState('');
  const [sekunderTensi, setSekunderTensi] = React.useState('');
  const [sekunderNadi, setSekunderNadi] = React.useState('');
  const [sekunderRespirasi, setSekunderRespirasi] = React.useState('');
  const [sekunderSuhu, setSekunderSuhu] = React.useState('');
  const [sekunderSaturasi, setSekunderSaturasi] = React.useState('');
  const [sekunderNyeri, setSekunderNyeri] = React.useState('');
  const [sekunderPetugasNik, setSekunderPetugasNik] = React.useState('');
  const [sekunderPetugasNama, setSekunderPetugasNama] = React.useState('');
  const [planSekunder, setPlanSekunder] = React.useState(PLAN_SEKUNDER_OPTIONS[0]);
  const [sekunderTglTriase, setSekunderTglTriase] = React.useState(() => localDateStr());
  const [sekunderJamTriase, setSekunderJamTriase] = React.useState(() => localTimeStr());
  const [catatanSekunder, setCatatanSekunder] = React.useState('');
  // Checklist Skala 3/4/5 (data_triase_igddetail_skala3/4/5) — sub-tab
  // TabSkala3dan4dan5 di Java, minimal 1 item (gabungan skala3+4+5)
  // wajib dicentang sebelum Simpan.
  const [subSkalaSekunder, setSubSkalaSekunder] = React.useState<3 | 4 | 5>(3);
  const [checkedSkala3, setCheckedSkala3] = React.useState<Set<string>>(new Set());
  const [checkedSkala4, setCheckedSkala4] = React.useState<Set<string>>(new Set());
  const [checkedSkala5, setCheckedSkala5] = React.useState<Set<string>>(new Set());

  const [petugasPickerFor, setPetugasPickerFor] = React.useState<'primer' | 'sekunder' | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Dokter/Petugas IGD default = user yang login (konvensi AddUserModal:
  // username akun = nik/kd_dokter) — tetap bisa diganti manual lewat
  // ModalCariPegawai kalau perlu.
  React.useEffect(() => {
    if (isOpen && user?.username) {
      setPrimerPetugasNik(user.username);
      setPrimerPetugasNama(user.full_name || '');
      setSekunderPetugasNik(user.username);
      setSekunderPetugasNama(user.full_name || '');
    }
  }, [isOpen, user]);

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

  React.useEffect(() => {
    if (!isOpen) return;
    setLoadingMacamKasus(true);
    fetch('/api/triase-igd-macam-kasus')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MacamKasus[]) => {
        const list = Array.isArray(data) ? data : [];
        setMacamKasusList(list);
        setKodeKasus((prev) => prev || list[0]?.kode_kasus || '');
      })
      .catch(() => setMacamKasusList([]))
      .finally(() => setLoadingMacamKasus(false));
  }, [isOpen]);

  // Validasi urutan sama dgn BtnSimpanActionPerformed (RMTriaseIGD.java):
  // header dulu, baru field jalur (vitals/petugas/skala) yg aktif.
  const validationError = (): string | null => {
    if (!keteranganKedatangan.trim()) return 'Keterangan wajib diisi';
    if (!kodeKasus) return 'Macam Kasus wajib dipilih';
    if (!jalurTriase) return 'Pilih Triase Primer atau Triase Sekunder terlebih dahulu';

    if (jalurTriase === 'primer') {
      if (!keluhanUtama.trim()) return 'Keluhan Utama wajib diisi';
      if (!primerSuhu.trim()) return 'Suhu wajib diisi';
      if (!primerNyeri.trim()) return 'Nyeri wajib diisi';
      if (!primerTensi.trim()) return 'Tensi wajib diisi';
      if (!primerNadi.trim()) return 'Nadi wajib diisi';
      if (!primerSaturasi.trim()) return 'Saturasi O² wajib diisi';
      if (!primerRespirasi.trim()) return 'Respirasi wajib diisi';
      if (!catatanPrimer.trim()) return 'Catatan wajib diisi';
      if (!primerPetugasNik) return 'Dokter/Petugas IGD wajib dipilih';
      const skalaKode = subSkalaPrimer === 1 ? checkedSkala1 : checkedSkala2;
      if (skalaKode.size === 0) return `Minimal 1 checklist Skala ${subSkalaPrimer} harus dicentang`;
    } else {
      if (!anamnesaSingkat.trim()) return 'Anamnesa Singkat wajib diisi';
      if (!sekunderSuhu.trim()) return 'Suhu wajib diisi';
      if (!sekunderNyeri.trim()) return 'Nyeri wajib diisi';
      if (!sekunderTensi.trim()) return 'Tensi wajib diisi';
      if (!sekunderNadi.trim()) return 'Nadi wajib diisi';
      if (!sekunderSaturasi.trim()) return 'Saturasi O² wajib diisi';
      if (!sekunderRespirasi.trim()) return 'Respirasi wajib diisi';
      if (!catatanSekunder.trim()) return 'Catatan wajib diisi';
      if (!sekunderPetugasNik) return 'Dokter/Petugas IGD wajib dipilih';
      const skalaKode = subSkalaSekunder === 3 ? checkedSkala3 : subSkalaSekunder === 4 ? checkedSkala4 : checkedSkala5;
      if (skalaKode.size === 0) return `Minimal 1 checklist Skala ${subSkalaSekunder} harus dicentang`;
    }
    return null;
  };

  const handleSimpan = async () => {
    const err = validationError();
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: err, confirmButtonColor: '#1AB1E5' });
      return;
    }

    const skalaNomor = jalurTriase === 'primer' ? subSkalaPrimer : subSkalaSekunder;
    const skalaKodeSet = jalurTriase === 'primer'
      ? (subSkalaPrimer === 1 ? checkedSkala1 : checkedSkala2)
      : (subSkalaSekunder === 3 ? checkedSkala3 : subSkalaSekunder === 4 ? checkedSkala4 : checkedSkala5);

    const basePayload = {
      no_rawat: patient?.no_rawat,
      tgl_kunjungan: tglKunjungan,
      jam_kunjungan: jamKunjungan,
      cara_masuk: caraMasuk,
      alat_transportasi: alatTransportasi,
      alasan_kedatangan: alasanKedatangan,
      keterangan_kedatangan: keteranganKedatangan,
      kode_kasus: kodeKasus,
      jalur: jalurTriase,
      skala_nomor: skalaNomor,
      skala_kode: Array.from(skalaKodeSet),
    };

    const payload = jalurTriase === 'primer'
      ? {
          ...basePayload,
          tensi: primerTensi,
          nadi: primerNadi,
          respirasi: primerRespirasi,
          suhu: primerSuhu,
          saturasi: primerSaturasi,
          nyeri: primerNyeri,
          petugas_nik: primerPetugasNik,
          plan: planPrimer,
          tgl_triase: primerTglTriase,
          jam_triase: primerJamTriase,
          catatan: catatanPrimer,
          keluhan_utama: keluhanUtama,
          kebutuhan_khusus: kebutuhanKhusus,
        }
      : {
          ...basePayload,
          tensi: sekunderTensi,
          nadi: sekunderNadi,
          respirasi: sekunderRespirasi,
          suhu: sekunderSuhu,
          saturasi: sekunderSaturasi,
          nyeri: sekunderNyeri,
          petugas_nik: sekunderPetugasNik,
          plan: planSekunder,
          tgl_triase: sekunderTglTriase,
          jam_triase: sekunderJamTriase,
          catatan: catatanSekunder,
          anamnesa_singkat: anamnesaSingkat,
        };

    setSaving(true);
    try {
      const res = await fetch('/api/triase-igd/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan triase');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Triase berhasil disimpan', confirmButtonColor: '#1AB1E5' });
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={onClose}
    >
      {/* Panel — anchor kanan, full height, slide dari kanan ke kiri */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50vw',
          maxWidth: '90vw',
          background: '#ffffff',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
            <input type="date" value={tglKunjungan} onChange={(e) => setTglKunjungan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
            <input type="time" value={jamKunjungan} onChange={(e) => setJamKunjungan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Cara Masuk + Transportasi + Alasan Kedatangan + Macam Kasus + Keterangan */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 0.6 }}>
              <label style={labelStyle}>Cara Masuk</label>
              <div style={{ position: 'relative' }}>
                <select value={caraMasuk} onChange={(e) => setCaraMasuk(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {CARA_MASUK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <TriaseStepperIcon />
              </div>
            </div>
            <div style={{ flex: 0.6 }}>
              <label style={labelStyle}>Transportasi</label>
              <div style={{ position: 'relative' }}>
                <select value={alatTransportasi} onChange={(e) => setAlatTransportasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {TRANSPORTASI_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <TriaseStepperIcon />
              </div>
            </div>
            <div style={{ flex: 0.8 }}>
              <label style={labelStyle}>Alasan Kedatangan</label>
              <div style={{ position: 'relative' }}>
                <select value={alasanKedatangan} onChange={(e) => setAlasanKedatangan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {ALASAN_KEDATANGAN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <TriaseStepperIcon />
              </div>
            </div>
            <div style={{ flex: 1.3 }}>
              <label style={labelStyle}>Macam Kasus</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={kodeKasus}
                  onChange={(e) => setKodeKasus(e.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  disabled={loadingMacamKasus}
                  style={selectStyle}
                >
                  {macamKasusList.length === 0 && <option value="">{loadingMacamKasus ? 'Memuat...' : 'Tidak ada data'}</option>}
                  {macamKasusList.map((m) => (
                    <option key={m.kode_kasus} value={m.kode_kasus}>{m.macam_kasus}</option>
                  ))}
                </select>
                <TriaseStepperIcon />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Keterangan</label>
              <input
                type="text"
                value={keteranganKedatangan}
                onChange={(e) => setKeteranganKedatangan(e.target.value)}
                onFocus={handleFieldFocus}
                onBlur={handleFieldBlur}
                maxLength={100}
                placeholder="Keterangan..."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Keputusan jalur Triase */}
          <div style={{ display: 'flex', gap: 0 }}>
            <SkalaSubTab label="Triase Primer" active={jalurTriase === 'primer'} count={0} onClick={() => setJalurTriase('primer')} />
            <SkalaSubTab label="Triase Sekunder" active={jalurTriase === 'sekunder'} count={0} onClick={() => setJalurTriase('sekunder')} />
          </div>

          {jalurTriase === 'primer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Keluhan Utama + Kebutuhan Khusus (sebaris) — Kebutuhan Khusus
                  dipersempit fixed-width, opsi terpanjangnya cuma 12 huruf
                  ("Dekontaminan"), tidak perlu flex sama besar. */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Keluhan Utama</label>
                  <textarea
                    value={keluhanUtama}
                    onChange={(e) => setKeluhanUtama(e.target.value)}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    maxLength={400}
                    placeholder="Keluhan utama pasien..."
                    style={textareaStyle}
                  />
                </div>
                <div style={{ width: 160, flexShrink: 0 }}>
                  <label style={labelStyle}>Kebutuhan Khusus</label>
                  <div style={{ position: 'relative' }}>
                    <select value={kebutuhanKhusus} onChange={(e) => setKebutuhanKhusus(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                      {KEBUTUHAN_KHUSUS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <TriaseStepperIcon />
                  </div>
                </div>
              </div>

              {/* Vitals — data_triase_igd.tekanan_darah/nadi/pernapasan/suhu/saturasi_o2/nyeri */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Tensi</label>
                  <input type="text" value={primerTensi} onChange={(e) => setPrimerTensi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} placeholder="120/80" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nadi(/menit)</label>
                  <input type="text" value={primerNadi} onChange={(e) => setPrimerNadi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Respirasi(/menit)</label>
                  <input type="text" value={primerRespirasi} onChange={(e) => setPrimerRespirasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Suhu (C)</label>
                  <input type="text" value={primerSuhu} onChange={(e) => setPrimerSuhu(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Saturasi O²(%)</label>
                  <input type="text" value={primerSaturasi} onChange={(e) => setPrimerSaturasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nyeri</label>
                  <input type="text" value={primerNyeri} onChange={(e) => setPrimerNyeri(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
              </div>

              {/* Checklist Skala 1/2 — data_triase_igddetail_skala1/2 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Checklist Pemeriksaan</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SkalaSubTab label="Skala 1" active={subSkalaPrimer === 1} count={checkedSkala1.size} onClick={() => { setSubSkalaPrimer(1); setPlanPrimer('Ruang Resusitasi'); }} color={ESI_SKALA_COLOR[1]} />
                    <SkalaSubTab label="Skala 2" active={subSkalaPrimer === 2} count={checkedSkala2.size} onClick={() => { setSubSkalaPrimer(2); setPlanPrimer('Ruang Kritis'); }} color={ESI_SKALA_COLOR[2]} />
                  </div>
                </div>
                {subSkalaPrimer === 1 ? (
                  <SkalaChecklist skala={1} checkedSet={checkedSkala1} onToggle={(kode) => setCheckedSkala1((prev) => toggleSetValue(prev, kode))} />
                ) : (
                  <SkalaChecklist skala={2} checkedSet={checkedSkala2} onToggle={(kode) => setCheckedSkala2((prev) => toggleSetValue(prev, kode))} />
                )}
              </div>

              {/* Catatan + Plan/Keputusan (sebaris, Plan rata kanan) */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Catatan :</label>
                  <input
                    type="text"
                    value={catatanPrimer}
                    onChange={(e) => setCatatanPrimer(e.target.value)}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    maxLength={100}
                    placeholder="Catatan triase primer..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Plan/Keputusan :</label>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {PLAN_PRIMER_OPTIONS.map((v) => (
                      <RadioOption key={v} label={v} checked={planPrimer === v} onChange={() => setPlanPrimer(v)} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tgl.Triase + Jam + Dokter/Petugas IGD (sebaris, paling bawah, label sejajar) */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 200 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tgl. Triase :</label>
                  <input type="date" value={primerTglTriase} onChange={(e) => setPrimerTglTriase(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90 }}>
                  <input type="time" value={primerJamTriase} onChange={(e) => setPrimerJamTriase(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, marginLeft: 40 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Dokter/Petugas IGD :</label>
                  <div style={{ display: 'flex', gap: 2, position: 'relative', flex: 1 }}>
                    <input type="text" value={primerPetugasNama} readOnly placeholder="Cari dokter/petugas..." style={{ ...inputStyle, flex: 1, background: '#f9fafb' }} />
                    <button type="button" onClick={() => setPetugasPickerFor('primer')} title="Cari petugas"
                      style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {jalurTriase === 'sekunder' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Anamnesa Singkat</label>
                <textarea
                  value={anamnesaSingkat}
                  onChange={(e) => setAnamnesaSingkat(e.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  maxLength={400}
                  placeholder="Anamnesa singkat pasien..."
                  style={textareaStyle}
                />
              </div>

              {/* Vitals — data_triase_igd.tekanan_darah/nadi/pernapasan/suhu/saturasi_o2/nyeri */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Tensi</label>
                  <input type="text" value={sekunderTensi} onChange={(e) => setSekunderTensi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} placeholder="120/80" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nadi(/menit)</label>
                  <input type="text" value={sekunderNadi} onChange={(e) => setSekunderNadi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Respirasi(/menit)</label>
                  <input type="text" value={sekunderRespirasi} onChange={(e) => setSekunderRespirasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Suhu (C)</label>
                  <input type="text" value={sekunderSuhu} onChange={(e) => setSekunderSuhu(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Saturasi O²(%)</label>
                  <input type="text" value={sekunderSaturasi} onChange={(e) => setSekunderSaturasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nyeri</label>
                  <input type="text" value={sekunderNyeri} onChange={(e) => setSekunderNyeri(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={inputStyle} />
                </div>
              </div>

              {/* Checklist Skala 3/4/5 — data_triase_igddetail_skala3/4/5 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Checklist Pemeriksaan</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SkalaSubTab label="Skala 3" active={subSkalaSekunder === 3} count={checkedSkala3.size} onClick={() => { setSubSkalaSekunder(3); setPlanSekunder('Zona Kuning'); }} color={ESI_SKALA_COLOR[3]} />
                    <SkalaSubTab label="Skala 4" active={subSkalaSekunder === 4} count={checkedSkala4.size} onClick={() => { setSubSkalaSekunder(4); setPlanSekunder('Zona Hijau'); }} color={ESI_SKALA_COLOR[4]} />
                    <SkalaSubTab label="Skala 5" active={subSkalaSekunder === 5} count={checkedSkala5.size} onClick={() => { setSubSkalaSekunder(5); setPlanSekunder('Zona Hijau'); }} color={ESI_SKALA_COLOR[5]} />
                  </div>
                </div>
                {subSkalaSekunder === 3 ? (
                  <SkalaChecklist skala={3} checkedSet={checkedSkala3} onToggle={(kode) => setCheckedSkala3((prev) => toggleSetValue(prev, kode))} />
                ) : subSkalaSekunder === 4 ? (
                  <SkalaChecklist skala={4} checkedSet={checkedSkala4} onToggle={(kode) => setCheckedSkala4((prev) => toggleSetValue(prev, kode))} />
                ) : (
                  <SkalaChecklist skala={5} checkedSet={checkedSkala5} onToggle={(kode) => setCheckedSkala5((prev) => toggleSetValue(prev, kode))} />
                )}
              </div>

              {/* Catatan + Plan/Keputusan (sebaris, Plan rata kanan) */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Catatan :</label>
                  <input
                    type="text"
                    value={catatanSekunder}
                    onChange={(e) => setCatatanSekunder(e.target.value)}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    maxLength={100}
                    placeholder="Catatan triase sekunder..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Plan/Keputusan :</label>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {PLAN_SEKUNDER_OPTIONS.map((v) => (
                      <RadioOption key={v} label={v} checked={planSekunder === v} onChange={() => setPlanSekunder(v)} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tgl.Triase + Jam + Dokter/Petugas IGD (sebaris, paling bawah, label sejajar) */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 200 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tgl. Triase :</label>
                  <input type="date" value={sekunderTglTriase} onChange={(e) => setSekunderTglTriase(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90 }}>
                  <input type="time" value={sekunderJamTriase} onChange={(e) => setSekunderJamTriase(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, marginLeft: 40 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Dokter/Petugas IGD :</label>
                  <div style={{ display: 'flex', gap: 2, position: 'relative', flex: 1 }}>
                    <input type="text" value={sekunderPetugasNama} readOnly placeholder="Cari dokter/petugas..." style={{ ...inputStyle, flex: 1, background: '#f9fafb' }} />
                    <button type="button" onClick={() => setPetugasPickerFor('sekunder')} title="Cari petugas"
                      style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            {saving ? 'Menyimpan...' : 'Simpan Triase'}
          </button>
        </div>
      </div>

      {/* stopPropagation — ModalCariPegawai tidak pakai portal, jadi
          nested di dalam overlay panel ini; tanpa ini klik di backdrop-nya
          akan ikut bubble & memicu onClose panel Triase juga. */}
      <div onClick={(e) => e.stopPropagation()}>
        <ModalCariPegawai
          isOpen={petugasPickerFor !== null}
          onClose={() => setPetugasPickerFor(null)}
          onSelect={(nik, nama) => {
            if (petugasPickerFor === 'primer') {
              setPrimerPetugasNik(nik);
              setPrimerPetugasNama(nama);
            } else if (petugasPickerFor === 'sekunder') {
              setSekunderPetugasNik(nik);
              setSekunderPetugasNama(nama);
            }
          }}
        />
      </div>
    </div>
  );
};
