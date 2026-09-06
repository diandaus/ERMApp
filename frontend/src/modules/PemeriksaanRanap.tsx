import React from 'react';
import Swal from 'sweetalert2';
import { ResepTab } from '../components/ResepTab';
import { ResepPulangModal } from '../components/ResepPulangModal';
import { RiwayatModal } from '../components/RiwayatModal';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { UploadTab } from '../components/UploadTab';
import { TindakanTab } from '../components/TindakanTab';
import { ModalCariPetugas } from '../components/ModalCariPetugas';
import { ModalCariPegawai } from '../components/ModalCariPegawai';
import { ResumeTab } from '../components/ResumeTab';
import { useMediaQuery } from '../hooks/useBreakpoint';
import { getCurrentUserNip } from '../utils/currentUser';

type RanapPatient = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  umur: string;
  alamat: string;
  p_jawab: string;
  hubunganpj: string;
  png_jawab: string;
  kamar: string;
  trf_kamar?: number;
  diagnosa_awal: string;
  diagnosa_akhir?: string;
  tgl_masuk: string;
  jam_masuk: string;
  tgl_keluar?: string;
  jam_keluar?: string;
  stts_pulang?: string;
  lama: string;
  nm_dokter: string;
  kd_kamar?: string;
  status_bayar?: string;
  agama?: string;
  jk?: string;
  tgl_lahir?: string;
  tmp_lahir?: string;
  gol_darah?: string;
  pnd?: string;
  pekerjaan?: string;
  nm_ibu?: string;
  kd_dokter?: string;
  kd_bangsal?: string;
};

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

type PemeriksaanRanapProps = {
  patient: RanapPatient;
  onBack: () => void;
  user?: AppUser;
};

const InfoItem: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  multiline?: boolean;
}> = ({ label, value, icon, highlight, multiline }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: multiline ? 'flex-start' : 'center' }}>
    {icon && (
      <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: multiline ? 2 : 0 }}>
        {icon}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: highlight ? '#1AB1E5' : '#111827', fontWeight: highlight ? 600 : 400, lineHeight: multiline ? 1.5 : 1.4, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  </div>
);

// ── Tab SOAP/CPPT — style & komponen PERSIS SoapCpptFormIGD.tsx/
// soapCpptIgdDisplay.tsx (PemeriksaanIGD.tsx), per permintaan user
// "redesign tab SOAP/CPPT seperti tab SOAP di PemeriksaanIGD, 70%/30%
// (30% utk Grafik TTV yg sudah ada)": panel flat putih, label 12px,
// kolom 30px, tanpa card/shadow/gradient.
const soapLabelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 };
const soapInputStyle: React.CSSProperties = { width: '100%', height: 30, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
const soapSelectStyle: React.CSSProperties = { ...soapInputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const soapTextareaStyle: React.CSSProperties = { ...soapInputStyle, height: 'auto', resize: 'vertical', minHeight: 64, fontFamily: 'inherit' };

const handleSoapFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#1AB1E5';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,177,229,0.15)';
};
const handleSoapFieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow = 'none';
};

const SoapStepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const soapActionBtn = (bg: string, disabled?: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 0, border: 'none', background: disabled ? '#9ca3af' : bg,
  color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 400,
  display: 'flex', alignItems: 'center', gap: 6,
});

// soapHistoryActionBtn — tombol Edit/Copy/Hapus di tabel Rincian Riwayat
// dijadikan satu strip (segmented, solid fill + font putih), PERSIS
// actionBtnStyle di utils/soapCpptIgdDisplay.tsx: border kanan dihapus
// kecuali tombol terakhir, marginLeft:-1 (kecuali tombol pertama) utk
// kolaps border ganda supaya benar-benar "tempel rapat".
const soapHistoryActionBtn = (bg: string, isFirst: boolean, isLast: boolean): React.CSSProperties => ({
  padding: '4px 8px', borderRadius: 0, border: `1px solid ${bg}`,
  borderRight: isLast ? `1px solid ${bg}` : 'none',
  marginLeft: isFirst ? 0 : -1,
  background: bg, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
});

export const PemeriksaanRanapView: React.FC<PemeriksaanRanapProps> = ({ patient, onBack, user }) => {
  const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [activeTab, setActiveTab] = React.useState<'soap' | 'resep' | 'lab' | 'rad' | 'tindakan' | 'adime' | 'resume' | 'upload'>('soap');
  const [adime, setAdime] = React.useState({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' });
  const [adimeHistory, setAdimeHistory] = React.useState<any[]>([]);
  const [savingAdime, setSavingAdime] = React.useState(false);
  const [editingAdime, setEditingAdime] = React.useState<string | null>(null);
  const [adimeNip, setAdimeNip] = React.useState('');
  const [adimePetugasNama, setAdimePetugasNama] = React.useState('');
  const [adimePetugasOpen, setAdimePetugasOpen] = React.useState(false);
  const [adimeTgl, setAdimeTgl] = React.useState(() => localDateStr());
  const [adimeJam, setAdimeJam] = React.useState(() => new Date().toTimeString().slice(0, 8));
  const [adimeUseAutoTime, setAdimeUseAutoTime] = React.useState(true);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [soapHistory, setSoapHistory] = React.useState<any[]>([]);
  // Tab Resep sekarang pakai komponen ResepTab.tsx (self-contained, SAMA
  // persis dipakai Pemeriksaan.tsx/PemeriksaanIGD.tsx) — resepOpenSignal
  // dinaikkan dari sini saat user klik "Lanjutkan Input Resep" di dialog
  // sukses simpan SOAP, ResepTab otomatis buka modal input begitu signal
  // berubah.
  const [resepOpenSignal, setResepOpenSignal] = React.useState(0);
  const [showResepPulangModal, setShowResepPulangModal] = React.useState(false);
  const [editingResepPulang, setEditingResepPulang] = React.useState<{ no_permintaan: string; items: any[]; racikan?: any[] } | null>(null);
  const [riwayatResepPulang, setRiwayatResepPulang] = React.useState<any[]>([]);
  const [loadingResepPulang, setLoadingResepPulang] = React.useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  // Grid form (S/O/A/P, ADIME) boleh tetap 2 kolom sampai lebih sempit dari breakpoint
  // shell/drawer di atas — sidebar sekarang selalu drawer jadi tidak makan lebar konten.
  const isNarrow = useMediaQuery(640);
  // Di layar 1366px ke atas (laptop/desktop umum), Panel Info Pasien tetap permanen
  // seperti semula — drawer hanya dipakai di bawah itu (tablet, dsb).
  const isPermanentSidebar = !useMediaQuery(1365);
  const [showPatientInfo, setShowPatientInfo] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // History state
  const [subjectiveHistory, setSubjectiveHistory] = React.useState<string[]>([]);
  const [objectiveHistory, setObjectiveHistory] = React.useState<string[]>([]);
  const [assessmentHistory, setAssessmentHistory] = React.useState<string[]>([]);
  const [planningHistory, setPlanningHistory] = React.useState<string[]>([]);
  const [instruksiHistory, setInstruksiHistory] = React.useState<string[]>([]);
  const [evaluasiHistory, setEvaluasiHistory] = React.useState<string[]>([]);
  const [tensiHistory, setTensiHistory] = React.useState<string[]>([]);
  const [suhuHistory, setSuhuHistory] = React.useState<string[]>([]);
  const [nadiHistory, setNadiHistory] = React.useState<string[]>([]);
  const [respirasiHistory, setRespirasiHistory] = React.useState<string[]>([]);
  const [tinggiHistory, setTinggiHistory] = React.useState<string[]>([]);
  const [beratHistory, setBeratHistory] = React.useState<string[]>([]);

  // Dropdown visibility
  const [showSubjectiveDropdown, setShowSubjectiveDropdown] = React.useState(false);
  const [showObjectiveDropdown, setShowObjectiveDropdown] = React.useState(false);
  const [showAssessmentDropdown, setShowAssessmentDropdown] = React.useState(false);
  const [showPlanningDropdown, setShowPlanningDropdown] = React.useState(false);
  const [showInstruksiDropdown, setShowInstruksiDropdown] = React.useState(false);
  const [showEvaluasiDropdown, setShowEvaluasiDropdown] = React.useState(false);
  const [showTensiDropdown, setShowTensiDropdown] = React.useState(false);
  const [showSuhuDropdown, setShowSuhuDropdown] = React.useState(false);
  const [showNadiDropdown, setShowNadiDropdown] = React.useState(false);
  const [showRespirasiDropdown, setShowRespirasiDropdown] = React.useState(false);
  const [showTinggiDropdown, setShowTinggiDropdown] = React.useState(false);
  const [showBeratDropdown, setShowBeratDropdown] = React.useState(false);

  // Filtered history
  const [filteredSubjective, setFilteredSubjective] = React.useState<string[]>([]);
  const [filteredObjective, setFilteredObjective] = React.useState<string[]>([]);
  const [filteredAssessment, setFilteredAssessment] = React.useState<string[]>([]);
  const [filteredPlanning, setFilteredPlanning] = React.useState<string[]>([]);
  const [filteredInstruksi, setFilteredInstruksi] = React.useState<string[]>([]);
  const [filteredEvaluasi, setFilteredEvaluasi] = React.useState<string[]>([]);
  const [filteredTensi, setFilteredTensi] = React.useState<string[]>([]);
  const [filteredSuhu, setFilteredSuhu] = React.useState<string[]>([]);
  const [filteredNadi, setFilteredNadi] = React.useState<string[]>([]);
  const [filteredRespirasi, setFilteredRespirasi] = React.useState<string[]>([]);
  const [filteredTinggi, setFilteredTinggi] = React.useState<string[]>([]);
  const [filteredBerat, setFilteredBerat] = React.useState<string[]>([]);

  const [form, setForm] = React.useState({
    subjective: '',
    objective: '',
    assessment: '',
    planning: '',
    evaluasi: '',
    instruksi: '',
    tensi: '',
    suhu: '',
    nadi: '',
    respirasi: '',
    tinggi: '',
    berat: '',
    gcs: '',
    kesadaran: 'Compos Mentis',
    alergi: '',
    // spo2/lingkarPerut — BARU (dulu selalu dikirim '' krn belum ada
    // input-nya), ditambahkan supaya field-nya PERSIS SoapCpptFormIGD.tsx.
    spo2: '',
    lingkarPerut: '',
  });
  const [soapTgl, setSoapTgl] = React.useState(() => localDateStr());
  const [soapJam, setSoapJam] = React.useState(() => new Date().toTimeString().slice(0, 8));
  const [soapUseAutoTime, setSoapUseAutoTime] = React.useState(true);
  const [soapNip, setSoapNip] = React.useState(() => '');
  const [soapPetugasNama, setSoapPetugasNama] = React.useState('');
  const [soapPetugasOpen, setSoapPetugasOpen] = React.useState(false);

  // Isi kolom Pegawai otomatis dari user yang login — baik dokter maupun
  // petugas, karena username akun = nip/kd_dokter (konvensi AddUserModal).
  // Tetap bisa diganti manual lewat input/cari pegawai kalau diperlukan.
  React.useEffect(() => {
    if (user?.username) {
      setSoapNip(user.username);
      setSoapPetugasNama(user.full_name || '');
    }
  }, [user]);

  // Load history from localStorage
  React.useEffect(() => {
    const keys: [string, React.Dispatch<React.SetStateAction<string[]>>][] = [
      ['subjective_history', setSubjectiveHistory],
      ['objective_history', setObjectiveHistory],
      ['assessment_history', setAssessmentHistory],
      ['planning_history', setPlanningHistory],
      ['instruksi_history', setInstruksiHistory],
      ['evaluasi_history', setEvaluasiHistory],
      ['tensi_history', setTensiHistory],
      ['suhu_history', setSuhuHistory],
      ['nadi_history', setNadiHistory],
      ['respirasi_history', setRespirasiHistory],
      ['tinggi_history', setTinggiHistory],
      ['berat_history', setBeratHistory],
    ];
    keys.forEach(([key, setter]) => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try { setter(JSON.parse(saved)); } catch (_) { /* ignore */ }
      }
    });
  }, []);

  // Fetch SOAP history
  React.useEffect(() => {
    fetchSoapHistory();
    fetchAdimeHistory();
  }, [patient.no_rawat]);

  // Auto-time tick for SOAP
  React.useEffect(() => {
    if (!soapUseAutoTime) return;
    const tick = setInterval(() => {
      const now = new Date();
      setSoapTgl(localDateStr(now));
      setSoapJam(now.toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(tick);
  }, [soapUseAutoTime]);

  // Auto-time tick for ADIME
  React.useEffect(() => {
    if (!adimeUseAutoTime) return;
    const tick = setInterval(() => {
      const now = new Date();
      setAdimeTgl(localDateStr(now));
      setAdimeJam(now.toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(tick);
  }, [adimeUseAutoTime]);

  // Auto-fill kolom Petugas ADIME dari user yang sedang login (app_users.nip,
  // di-link admin lewat Pengaturan > User) — staf gizi tidak perlu cari/ketik
  // NIP-nya sendiri tiap buka tab ini. Cuma isi kalau field masih kosong dan
  // akun ini memang sudah di-link ke NIP petugas (kalau belum, tetap kosong —
  // field manual/tombol cari tetap tersedia sebagai fallback).
  React.useEffect(() => {
    if (adimeNip) return;
    const nip = getCurrentUserNip();
    if (!nip) return;
    setAdimeNip(nip);
    (async () => {
      try {
        const res = await fetch(`/api/petugas?search=${encodeURIComponent(nip)}`);
        const data = await res.json();
        const found = (Array.isArray(data) ? data : []).find((p: any) => p.nip === nip);
        if (found) setAdimePetugasNama(found.nama);
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdimeHistory = async () => {
    try {
      const res = await fetch(`/api/adime/${patient.no_rawat}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAdimeHistory(Array.isArray(data) ? data : []);
    } catch {
      setAdimeHistory([]);
    }
  };

  const fetchSoapHistory = async () => {
    try {
      const res = await fetch(`/api/pemeriksaan-ranap/${patient.no_rawat}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSoapHistory(Array.isArray(data) ? data : []);
    } catch {
      setSoapHistory([]);
    }
  };

  const fetchRiwayatResepPulang = async () => {
    setLoadingResepPulang(true);
    try {
      const res = await fetch(`/api/resep-pulang-req/list?no_rawat=${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRiwayatResepPulang(Array.isArray(data) ? data : []);
    } catch {
      setRiwayatResepPulang([]);
    } finally {
      setLoadingResepPulang(false);
    }
  };

  const handleDeleteResepPulang = async (noPerm: string) => {
    const result = await Swal.fire({
      title: 'Hapus Resep Pulang?', text: `Hapus ${noPerm}?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/resep-pulang-req?no_permintaan=${encodeURIComponent(noPerm)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
      await fetchRiwayatResepPulang();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  React.useEffect(() => {
    if (activeTab === 'resep') { fetchRiwayatResepPulang(); }
  }, [activeTab, patient.no_rkm_medis]);

  // ── History save helpers ──────────────────────────────────────────────────────

  const pushHistory = (
    value: string,
    history: string[],
    setHistory: React.Dispatch<React.SetStateAction<string[]>>,
    key: string
  ) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    const next = [trimmed, ...history.filter((i) => i !== trimmed)].slice(0, 20);
    setHistory(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  // ── Filter helpers ────────────────────────────────────────────────────────────

  const makeFilter = (history: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => (input: string) => {
    if (!input.trim()) { setter(history.slice(0, 10)); return; }
    const q = input.toLowerCase().trim();
    const starts: string[] = [], contains: string[] = [];
    history.forEach((item) => {
      const l = item.toLowerCase();
      if (l.startsWith(q)) starts.push(item);
      else if (l.includes(q)) contains.push(item);
    });
    setter([...starts, ...contains].slice(0, 10));
  };

  const filterSubjective  = makeFilter(subjectiveHistory,  setFilteredSubjective);
  const filterObjective   = makeFilter(objectiveHistory,   setFilteredObjective);
  const filterAssessment  = makeFilter(assessmentHistory,  setFilteredAssessment);
  const filterPlanning    = makeFilter(planningHistory,    setFilteredPlanning);
  const filterInstruksi   = makeFilter(instruksiHistory,   setFilteredInstruksi);
  const filterEvaluasi    = makeFilter(evaluasiHistory,    setFilteredEvaluasi);
  const filterTensi       = makeFilter(tensiHistory,       setFilteredTensi);
  const filterSuhu        = makeFilter(suhuHistory,        setFilteredSuhu);
  const filterNadi        = makeFilter(nadiHistory,        setFilteredNadi);
  const filterRespirasi   = makeFilter(respirasiHistory,   setFilteredRespirasi);
  const filterTinggi      = makeFilter(tinggiHistory,      setFilteredTinggi);
  const filterBerat       = makeFilter(beratHistory,       setFilteredBerat);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const map: Record<string, () => void> = {
      subjective: () => filterSubjective(value),
      objective:  () => filterObjective(value),
      assessment: () => filterAssessment(value),
      planning:   () => filterPlanning(value),
      instruksi:  () => filterInstruksi(value),
      evaluasi:   () => filterEvaluasi(value),
      tensi:      () => filterTensi(value),
      suhu:       () => filterSuhu(value),
      nadi:       () => filterNadi(value),
      respirasi:  () => filterRespirasi(value),
      tinggi:     () => filterTinggi(value),
      berat:      () => filterBerat(value),
    };
    map[field]?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let tglPerawatan: string;
      let jamRawat: string;

      if (isEditMode && editingItem) {
        const tgl = editingItem.tgl_perawatan;
        tglPerawatan = tgl.includes('T') ? tgl.split('T')[0] : tgl.includes('/') ? (() => { const [d,m,y]=tgl.split('/'); return `${y}-${m}-${d}`; })() : tgl;
        jamRawat = editingItem.jam_rawat?.length === 5 ? `${editingItem.jam_rawat}:00` : editingItem.jam_rawat || '00:00:00';
      } else {
        tglPerawatan = soapTgl;
        jamRawat = soapJam;
      }

      const payload = {
        no_rawat: patient.no_rawat,
        tgl_perawatan: tglPerawatan,
        jam_rawat: jamRawat,
        suhu_tubuh: form.suhu,
        tensi: form.tensi,
        nadi: form.nadi,
        respirasi: form.respirasi,
        tinggi: form.tinggi,
        berat: form.berat,
        spo2: form.spo2,
        gcs: form.gcs,
        kesadaran: form.kesadaran,
        keluhan: form.subjective,
        pemeriksaan: form.objective,
        alergi: form.alergi,
        lingkar_perut: form.lingkarPerut,
        rtl: form.planning,
        penilaian: form.assessment,
        instruksi: form.instruksi,
        evaluasi: form.evaluasi,
        nip: soapNip || patient.kd_dokter || '',
      };

      const res = await fetch('/api/pemeriksaan-ranap', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || (isEditMode ? 'Gagal mengupdate SOAP' : 'Gagal menyimpan SOAP'));
      }

      // Save to history
      [
        [form.subjective, subjectiveHistory, setSubjectiveHistory, 'subjective_history'],
        [form.objective,  objectiveHistory,  setObjectiveHistory,  'objective_history'],
        [form.assessment, assessmentHistory, setAssessmentHistory, 'assessment_history'],
        [form.planning,   planningHistory,   setPlanningHistory,   'planning_history'],
        [form.instruksi,  instruksiHistory,  setInstruksiHistory,  'instruksi_history'],
        [form.evaluasi,   evaluasiHistory,   setEvaluasiHistory,   'evaluasi_history'],
        [form.tensi,      tensiHistory,      setTensiHistory,      'tensi_history'],
        [form.suhu,       suhuHistory,       setSuhuHistory,       'suhu_history'],
        [form.nadi,       nadiHistory,       setNadiHistory,       'nadi_history'],
        [form.respirasi,  respirasiHistory,  setRespirasiHistory,  'respirasi_history'],
        [form.tinggi,     tinggiHistory,     setTinggiHistory,     'tinggi_history'],
        [form.berat,      beratHistory,      setBeratHistory,      'berat_history'],
      ].forEach(([v, h, s, k]) => pushHistory(v as string, h as string[], s as any, k as string));

      const result = await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: isEditMode ? 'SOAP berhasil diupdate!' : 'SOAP berhasil disimpan!',
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Lanjutkan Input Resep',
        cancelButtonText: 'Tidak, tutup',
        confirmButtonColor: '#1AB1E5',
        cancelButtonColor: '#6b7280',
        reverseButtons: false,
        didOpen: (popup) => {
          const actions = popup.querySelector('.swal2-actions') as HTMLElement | null;
          if (actions) {
            actions.style.flexDirection = 'column';
            actions.style.width = '100%';
            actions.style.gap = '8px';
          }
          popup.querySelectorAll<HTMLElement>('.swal2-actions button').forEach((btn) => {
            btn.style.width = '80%';
            btn.style.margin = '0';
            btn.style.borderRadius = '8px';
          });
        },
      });

      clearForm();
      fetchSoapHistory();
      if (result.isConfirmed) {
        setActiveTab('resep');
        setResepOpenSignal((s) => s + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan SOAP');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setForm({ subjective: '', objective: '', assessment: '', planning: '', evaluasi: '', instruksi: '', tensi: '', suhu: '', nadi: '', respirasi: '', tinggi: '', berat: '', gcs: '', kesadaran: 'Compos Mentis', alergi: '', spo2: '', lingkarPerut: '' });
    setIsEditMode(false);
    setEditingItem(null);
    setError('');
  };

  const editSOAP = (item: any) => {
    setForm({
      subjective: item.keluhan || '', objective: item.pemeriksaan || '',
      assessment: item.penilaian || '', planning: item.rtl || '',
      evaluasi: item.evaluasi || '', instruksi: item.instruksi || '',
      tensi: item.tensi || '', suhu: item.suhu_tubuh || '',
      nadi: item.nadi || '', respirasi: item.respirasi || '',
      tinggi: item.tinggi || '', berat: item.berat || '',
      gcs: item.gcs || '', kesadaran: item.kesadaran || 'Compos Mentis',
      alergi: item.alergi || '', spo2: item.spo2 || '', lingkarPerut: item.lingkar_perut || '',
    });
    setSoapNip(item.nip || ''); setSoapPetugasNama(item.nama || '');
    setIsEditMode(true);
    setEditingItem(item);
    setActiveTab('soap');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // copySOAP — "Copy" dari SoapCpptTableActions (renderSoapCpptTable):
  // salin isi baris riwayat ke form sbg ENTRI BARU (POST, bukan PUT) dgn
  // tanggal/jam SEKARANG (auto-time aktif lagi), beda dgn editSOAP yg
  // mengunci tanggal/jam record lama krn itu primary key. Sama pola dgn
  // copySoapieToForm di Pemeriksaan.tsx (Poli)/PemeriksaanIGD.tsx.
  const copySOAP = (item: any) => {
    setForm({
      subjective: item.keluhan || '', objective: item.pemeriksaan || '',
      assessment: item.penilaian || '', planning: item.rtl || '',
      evaluasi: item.evaluasi || '', instruksi: item.instruksi || '',
      tensi: item.tensi || '', suhu: item.suhu_tubuh || '',
      nadi: item.nadi || '', respirasi: item.respirasi || '',
      tinggi: item.tinggi || '', berat: item.berat || '',
      gcs: item.gcs || '', kesadaran: item.kesadaran || 'Compos Mentis',
      alergi: item.alergi || '', spo2: item.spo2 || '', lingkarPerut: item.lingkar_perut || '',
    });
    setIsEditMode(false);
    setEditingItem(null);
    setSoapUseAutoTime(true);
    setActiveTab('soap');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const deleteSOAP = async (item: any) => {
    const result = await Swal.fire({
      title: 'Yakin ingin menghapus?', text: 'Data SOAP ini akan dihapus secara permanen', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus!', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      let tglPerawatan = item.tgl_perawatan;
      if (tglPerawatan?.includes('T')) tglPerawatan = tglPerawatan.split('T')[0];
      else if (tglPerawatan?.includes('/')) { const [d,m,y]=tglPerawatan.split('/'); tglPerawatan=`${y}-${m}-${d}`; }
      let jamRawat = item.jam_rawat || '';
      if (jamRawat.length === 5) jamRawat = `${jamRawat}:00`;
      else if (!jamRawat) jamRawat = '00:00:00';

      const params = new URLSearchParams({ no_rawat: patient.no_rawat, tgl_perawatan: tglPerawatan, jam_rawat: jamRawat });
      const res = await fetch(`/api/pemeriksaan-ranap?${params}`, { method: 'DELETE' });
      const ct = res.headers.get('content-type');
      if (!res.ok) {
        const msg = ct?.includes('application/json') ? (await res.json()).error : await res.text();
        throw new Error(msg || 'Gagal menghapus SOAP');
      }
      const data = ct?.includes('application/json') ? await res.json() : { message: 'SOAP berhasil dihapus' };
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 2000, showConfirmButton: false });
      fetchSoapHistory();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string, time: string) => {
    let d = '', t = '';
    if (date?.includes('T')) {
      const dp = date.split('T')[0].split('-');
      d = `${dp[2]}/${dp[1]}/${dp[0]}`;
      t = time || date.split('T')[1]?.split(/[+\-Z]/)[0] || '00:00:00';
    } else if (date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y,m,dy] = date.split('-');
      d = `${dy}/${m}/${y}`;
      t = time || '00:00:00';
    } else if (date?.includes('/')) {
      d = date; t = time || '00:00:00';
    } else {
      d = date || ''; t = time || '00:00:00';
    }
    if (t.length === 5) t = `${t}:00`;
    return `${d} ${t}`;
  };

  // ── Grafik TTV (kartu di sisa ruang kanan tab SOAP/CPPT) ────────────────────
  // Sumber data sama dengan tabel "Rincian Riwayat" (soapHistory), cuma
  // diurutkan kronologis lama→baru (API-nya balikin terbaru dulu) supaya
  // grafik terbaca kiri-ke-kanan, lalu diambil beberapa entri terakhir saja
  // biar tetap kebaca di kartu yang sempit.
  const toDateTime = (tgl: string, jam: string): Date | null => {
    if (!tgl) return null;
    if (tgl.includes('T')) return new Date(tgl);
    if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return new Date(`${tgl}T${jam || '00:00:00'}`);
    if (tgl.includes('/')) {
      const [d, m, y] = tgl.split('/');
      return new Date(`${y}-${m}-${d}T${jam || '00:00:00'}`);
    }
    return null;
  };

  const vitalTrend = React.useMemo(() => {
    const parsed = soapHistory
      .map((item) => {
        const dt = toDateTime(item.tgl_perawatan || '', item.jam_rawat || '');
        if (!dt || Number.isNaN(dt.getTime())) return null;
        const [sistolStr, diastolStr] = String(item.tensi || '').split('/');
        const sistol = parseFloat(sistolStr);
        const diastol = parseFloat(diastolStr);
        const suhu = parseFloat(item.suhu_tubuh);
        const nadi = parseFloat(item.nadi);
        const respirasi = parseFloat(item.respirasi);
        return {
          time: dt.getTime(),
          label: `${dt.getDate()}/${dt.getMonth() + 1}`,
          sistol: Number.isFinite(sistol) ? sistol : null,
          diastol: Number.isFinite(diastol) ? diastol : null,
          suhu: Number.isFinite(suhu) ? suhu : null,
          nadi: Number.isFinite(nadi) ? nadi : null,
          respirasi: Number.isFinite(respirasi) ? respirasi : null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.time - b.time);
    return parsed.slice(-8);
  }, [soapHistory]);

  // Mini line chart tanpa library — tiap vital tanda punya skala sendiri
  // (bukan digabung 1 sumbu, kecuali Sistol/Diastol yg satuannya sama),
  // garis tipis 2px + titik data. Grid horizontal (4 ticks + label angka)
  // & vertikal (per titik data) ditambahkan spt referensi grafik Excel —
  // tetap tipis & abu-abu muda (#f3f4f6) supaya recessive, tidak
  // mengalahkan garis data.
  const renderVitalChart = (series: { color: string; values: (number | null)[] }[]) => {
    const width = 280;
    const height = 90;
    const leftPad = 28;
    const rightPad = 8;
    const topPad = 8;
    const bottomPad = 8;
    const plotW = width - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;
    const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    if (allValues.length === 0) {
      return <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '14px 0' }}>-</div>;
    }
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const margin = (rawMax - rawMin) * 0.15 || 5;
    const min = rawMin - margin;
    const max = rawMax + margin;
    const span = max - min || 1;
    const n = vitalTrend.length;
    const stepX = n > 1 ? plotW / (n - 1) : 0;
    const scaleX = (i: number) => leftPad + i * stepX;
    const scaleY = (v: number) => topPad + plotH - ((v - min) / span) * plotH;

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => min + (span * i) / tickCount);

    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* Grid horizontal + label sumbu Y */}
        {yTicks.map((tick, i) => (
          <g key={`h-${i}`}>
            <line x1={leftPad} y1={scaleY(tick)} x2={width - rightPad} y2={scaleY(tick)} stroke="#f3f4f6" strokeWidth={1} />
            <text x={leftPad - 5} y={scaleY(tick)} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="#9ca3af">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {/* Grid vertikal per titik data */}
        {vitalTrend.map((_, i) => (
          <line key={`v-${i}`} x1={scaleX(i)} y1={topPad} x2={scaleX(i)} y2={height - bottomPad} stroke="#f3f4f6" strokeWidth={1} />
        ))}
        {series.map((s, si) => {
          let d = '';
          s.values.forEach((v, i) => {
            if (v === null) return;
            d += (d === '' ? 'M' : 'L') + `${scaleX(i)},${scaleY(v)} `;
          });
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) => (v === null ? null : (
                <circle key={i} cx={scaleX(i)} cy={scaleY(v)} r={2.5} fill={s.color} />
              )))}
            </g>
          );
        })}
      </svg>
    );
  };

  // ── Reusable dropdown renderer ────────────────────────────────────────────────

  const Dropdown = ({ items, onSelect, maxH = 200 }: { items: string[]; onSelect: (v: string) => void; maxH?: number }) => (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: maxH, overflowY: 'auto', zIndex: 1000, marginTop: 4 }}>
      {items.map((item, i) => (
        <div key={i} onMouseDown={() => onSelect(item)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
        >{item}</div>
      ))}
    </div>
  );

  const SmallDropdown = ({ items, onSelect }: { items: string[]; onSelect: (v: string) => void }) => (
    <Dropdown items={items} onSelect={onSelect} maxH={150} />
  );

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '10px 20px', border: 'none',
    background: activeTab === tab ? '#e0f2fe' : 'transparent',
    borderBottom: activeTab === tab ? '3px solid #1AB1E5' : '3px solid transparent',
    color: activeTab === tab ? '#1AB1E5' : '#6b7280',
    cursor: 'pointer', fontSize: 13,
    fontWeight: 400,
    transition: 'all 0.2s',
    whiteSpace: 'nowrap', flexShrink: 0,
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <section style={{ background: '#f3f4f6', borderRadius: 0, padding: 0, height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>

      {/* Overlay drawer info pasien — hanya di bawah 1366px; di layar lebar sidebar permanen jadi tidak perlu overlay */}
      {!isPermanentSidebar && showPatientInfo && (
        <div
          onClick={() => setShowPatientInfo(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
        />
      )}

      {/* Sidebar — permanen di >=1366px, drawer (dipicu tombol nama pasien di header) di bawah itu */}
      <aside style={{
        width: 280, background: '#ffffff', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'auto', overscrollBehavior: 'none',
        ...(isPermanentSidebar
          ? { position: 'sticky' as const, top: 0, height: '100vh' }
          : {
              position: 'fixed' as const,
              top: 0, left: 0, height: '100vh', zIndex: 95,
              boxShadow: '2px 0 16px rgba(0,0,0,0.2)',
              transform: showPatientInfo ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.25s ease'
            })
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px', background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Informasi Pasien</h3>
            <div style={{ fontSize: 10, color: '#059669', background: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {patient.png_jawab || 'UMUM'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white"/>
                <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="white"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.nm_pasien}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{patient.no_rkm_medis}</div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: '#f9fafb' }}>

          {/* Identitas */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Identitas Diri</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem
                label="Jenis Kelamin"
                value={`${patient.jk === 'L' ? 'Laki-laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-'}${patient.umur ? ` (${patient.umur})` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>} />
              {patient.gol_darah && (
                <InfoItem label="Golongan Darah" value={patient.gol_darah}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>}
                  highlight />
              )}
              <InfoItem label="Alamat" value={patient.alamat || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                multiline />
              {patient.agama && (
                <InfoItem label="Agama" value={patient.agama}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>} />
              )}
            </div>
          </div>

          {/* Rawat Inap Info */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Rawat Inap</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem label="No. Rawat" value={patient.no_rawat}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>}
                highlight />
              <InfoItem label="Kamar / Ruangan" value={patient.kamar || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} />
              <InfoItem label="Tanggal & Jam Masuk" value={`${(() => { const d = patient.tgl_masuk?.split('T')[0] || ''; const [y,m,day] = d.split('-'); return d ? `${day}/${m}/${y}` : '-'; })()}${patient.jam_masuk ? ` • ${patient.jam_masuk}` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
              <InfoItem label="Lama Rawat" value={patient.lama || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
              {patient.diagnosa_awal && (
                <InfoItem label="Diagnosa Awal" value={patient.diagnosa_awal} multiline
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>} />
              )}
              {/* Status pulang */}
              {patient.stts_pulang && (() => {
                const s = patient.stts_pulang;
                const isMasih = s === '-';
                const isSembuh = s === 'Sembuh';
                const isMeninggal = s === 'Meninggal';
                const bg = isMasih ? '#dbeafe' : isSembuh ? '#d1fae5' : isMeninggal ? '#f3f4f6' : '#fef3c7';
                const border = isMasih ? '#bfdbfe' : isSembuh ? '#a7f3d0' : isMeninggal ? '#d1d5db' : '#fde68a';
                const color = isMasih ? '#1d4ed8' : isSembuh ? '#059669' : isMeninggal ? '#374151' : '#92400e';
                const label = isMasih ? 'Masih Dirawat' : s;
                return (
                  <div style={{ padding: '10px 12px', background: bg, borderRadius: 8, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
                      {isMasih ? <path d="M22 12h-4l-3 9L9 3l-3 9H2"/> : isSembuh ? <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/> : isMeninggal ? <path d="M17 11.5A5 5 0 0 0 7 12v4l-2 2h14l-2-2v-4.5M12 3v2M12 18v2"/> : <path d="M5 12l7-7 7 7M5 12l7 7 7-7"/>}
                    </svg>
                    <div>
                      <div style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Pulang</div>
                      <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 52, boxSizing: 'border-box', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {!isPermanentSidebar && (
              <button
                type="button"
                onClick={() => setShowPatientInfo(true)}
                title="Info Pasien"
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{patient.nm_pasien}</span>
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pemeriksaan Rawat Inap</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* DPJP — dipindah dari card sidebar "Rawat Inap" ke navbar,
                sebelum tombol Kembali, per permintaan user. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>DPJP:</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.nm_dokter || '-'}</span>
            </div>
            <button
              onClick={onBack}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #1AB1E5', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
            >
              Kembali
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '0 24px', borderBottom: '2px solid #e5e7eb', background: '#fff', flexShrink: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
          {(['soap', 'resep', 'lab', 'rad', 'tindakan', 'adime', 'resume', 'upload'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {tab === 'soap' ? 'SOAP/CPPT' : tab === 'resep' ? 'RESEP' : tab === 'lab' ? 'LABORATORIUM' : tab === 'rad' ? 'RADIOLOGI' : tab === 'tindakan' ? 'TINDAKAN' : tab === 'upload' ? 'UPLOAD' : tab === 'adime' ? 'ADIME GIZI' : 'RESUME'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f9fafb', overscrollBehavior: 'none' }}>
          <div style={{ padding: '24px 20px' }}>

            {/* ── SOAP Tab — redesain flat PERSIS SoapCpptFormIGD.tsx
                (PemeriksaanIGD.tsx): panel putih tanpa shadow/gradient,
                label 12px, input tinggi 30px, tombol aksi flat radius 0.
                Layout 70% (form + Rincian Riwayat, tabelnya DIPERTAHANKAN
                apa adanya per permintaan user) / 30% (Grafik TTV yg sudah
                ada, dipindah dari position:fixed ke kolom sticky biasa
                krn sekarang sudah kebagian ruang tetap 30%). ── */}
            {activeTab === 'soap' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: '70%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {isEditMode && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', background: '#e0f2fe', border: '1px solid #1AB1E5', color: '#0369a1', fontSize: 12, fontWeight: 400 }}>
                      <span>Mode Edit — mengubah data SOAP/CPPT tanggal {soapTgl} {soapJam}. Tanggal/Jam dikunci karena jadi kunci data.</span>
                      <button
                        type="button"
                        onClick={clearForm}
                        style={{ padding: '4px 10px', borderRadius: 0, border: '1px solid #0369a1', background: '#fff', color: '#0369a1', cursor: 'pointer', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}
                      >
                        Batal Edit
                      </button>
                    </div>
                  )}

                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <form ref={formRef} onSubmit={handleSubmit}>
                      {/* Petugas + Tanggal + Jam — SELALU tampil (PERSIS pola
                          SoapCpptFormIGD.tsx), Tanggal/Jam dikunci saat edit
                          krn jadi bagian kunci data. */}
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 16, flexWrap: isPermanentSidebar ? 'nowrap' : 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.4, minWidth: 220 }}>
                          <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Pegawai :</label>
                          <div style={{ display: 'flex', gap: 2, position: 'relative', flex: 1 }}>
                            <input type="text" value={soapPetugasNama} readOnly placeholder="Cari pegawai..." style={{ ...soapInputStyle, flex: 1, background: '#f9fafb' }} />
                            <button
                              type="button" onClick={() => setSoapPetugasOpen(true)} title="Cari pegawai"
                              style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tanggal :</label>
                          <input type="date" value={soapTgl} onChange={(e) => { setSoapTgl(e.target.value); setSoapUseAutoTime(false); }} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} readOnly={isEditMode} style={{ ...soapInputStyle, width: 130, background: isEditMode ? '#f3f4f6' : '#fff', cursor: isEditMode ? 'not-allowed' : 'text' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Jam :</label>
                          <input type="time" value={soapJam} onChange={(e) => { setSoapJam(e.target.value); setSoapUseAutoTime(false); }} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} step="1" readOnly={isEditMode} style={{ ...soapInputStyle, width: 110, background: isEditMode ? '#f3f4f6' : '#fff', cursor: isEditMode ? 'not-allowed' : 'text' }} />
                        </div>
                        {!isEditMode && (
                          <input type="checkbox" checked={soapUseAutoTime} onChange={(e) => setSoapUseAutoTime(e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }} title="Gunakan waktu saat ini" />
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 24 }}>
                        {/* Kiri — Keluhan (S), Pemeriksaan+Vital Sign (O) */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Keluhan</label>
                            <textarea
                              value={form.subjective} required
                              onChange={(e) => handleInputChange('subjective', e.target.value)}
                              onFocus={(e) => { filterSubjective(form.subjective); setShowSubjectiveDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowSubjectiveDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Keluhan yang disampaikan pasien..."
                              style={soapTextareaStyle}
                            />
                            {showSubjectiveDropdown && filteredSubjective.length > 0 && (
                              <Dropdown items={filteredSubjective} onSelect={(v) => { handleInputChange('subjective', v); setShowSubjectiveDropdown(false); }} />
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Pemeriksaan</label>
                            <textarea
                              value={form.objective} required
                              onChange={(e) => handleInputChange('objective', e.target.value)}
                              onFocus={(e) => { filterObjective(form.objective); setShowObjectiveDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowObjectiveDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Hasil pemeriksaan fisik..."
                              style={soapTextareaStyle}
                            />
                            {showObjectiveDropdown && filteredObjective.length > 0 && (
                              <Dropdown items={filteredObjective} onSelect={(v) => { handleInputChange('objective', v); setShowObjectiveDropdown(false); }} />
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                            {([
                              ['tensi', form.tensi, filterTensi, setShowTensiDropdown, showTensiDropdown, filteredTensi, 'Tensi', '120/80'],
                              ['nadi', form.nadi, filterNadi, setShowNadiDropdown, showNadiDropdown, filteredNadi, 'Nadi', ''],
                              ['suhu', form.suhu, filterSuhu, setShowSuhuDropdown, showSuhuDropdown, filteredSuhu, 'Suhu', ''],
                              ['respirasi', form.respirasi, filterRespirasi, setShowRespirasiDropdown, showRespirasiDropdown, filteredRespirasi, 'Respirasi', ''],
                            ] as const).map(([field, val, filter, setShow, show, filtered, label, placeholder]) => (
                              <div key={field} style={{ position: 'relative' }}>
                                <label style={soapLabelStyle}>{label}</label>
                                <input
                                  type="text" value={val}
                                  onChange={(e) => handleInputChange(field, e.target.value)}
                                  onFocus={(e) => { filter(val); setShow(true); handleSoapFieldFocus(e); }}
                                  onBlur={(e) => { setTimeout(() => setShow(false), 200); handleSoapFieldBlur(e); }}
                                  placeholder={placeholder}
                                  style={soapInputStyle}
                                />
                                {show && filtered.length > 0 && (
                                  <SmallDropdown items={filtered} onSelect={(v) => { handleInputChange(field, v); setShow(false); }} />
                                )}
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                            <div>
                              <label style={soapLabelStyle}>SpO2</label>
                              <input type="text" value={form.spo2} onChange={(e) => handleInputChange('spo2', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={3} style={soapInputStyle} />
                            </div>
                            <div>
                              <label style={soapLabelStyle}>L.P. (cm)</label>
                              <input type="text" value={form.lingkarPerut} onChange={(e) => handleInputChange('lingkarPerut', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={5} style={soapInputStyle} />
                            </div>
                            <div>
                              <label style={soapLabelStyle}>GCS</label>
                              <input type="text" value={form.gcs} onChange={(e) => handleInputChange('gcs', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} placeholder="E,V,M" style={soapInputStyle} />
                            </div>
                            {([
                              ['tinggi', form.tinggi, filterTinggi, setShowTinggiDropdown, showTinggiDropdown, filteredTinggi, 'TB (cm)'],
                              ['berat', form.berat, filterBerat, setShowBeratDropdown, showBeratDropdown, filteredBerat, 'BB (Kg)'],
                            ] as const).map(([field, val, filter, setShow, show, filtered, label]) => (
                              <div key={field} style={{ position: 'relative' }}>
                                <label style={soapLabelStyle}>{label}</label>
                                <input
                                  type="text" value={val}
                                  onChange={(e) => handleInputChange(field, e.target.value)}
                                  onFocus={(e) => { filter(val); setShow(true); handleSoapFieldFocus(e); }}
                                  onBlur={(e) => { setTimeout(() => setShow(false), 200); handleSoapFieldBlur(e); }}
                                  style={soapInputStyle}
                                />
                                {show && filtered.length > 0 && (
                                  <SmallDropdown items={filtered} onSelect={(v) => { handleInputChange(field, v); setShow(false); }} />
                                )}
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                            <div>
                              <label style={soapLabelStyle}>Kesadaran</label>
                              <div style={{ position: 'relative' }}>
                                <select value={form.kesadaran} onChange={(e) => handleInputChange('kesadaran', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} style={soapSelectStyle}>
                                  {['Compos Mentis', 'Apatis', 'Delirium', 'Somnolen', 'Sopor', 'Coma'].map((k) => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <SoapStepperIcon />
                              </div>
                            </div>
                            <div>
                              <label style={soapLabelStyle}>Alergi</label>
                              <input type="text" value={form.alergi} onChange={(e) => handleInputChange('alergi', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={80} style={soapInputStyle} />
                            </div>
                          </div>
                        </div>

                        {/* Kanan — Asesmen (A), Planning (P), Instruksi/Implementasi (I), Evaluasi (E) */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Asesmen</label>
                            <textarea
                              value={form.assessment} required
                              onChange={(e) => handleInputChange('assessment', e.target.value)}
                              onFocus={(e) => { filterAssessment(form.assessment); setShowAssessmentDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowAssessmentDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Diagnosis atau assessment..."
                              style={soapTextareaStyle}
                            />
                            {showAssessmentDropdown && filteredAssessment.length > 0 && (
                              <Dropdown items={filteredAssessment} onSelect={(v) => { handleInputChange('assessment', v); setShowAssessmentDropdown(false); }} />
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Planning</label>
                            <textarea
                              value={form.planning}
                              onChange={(e) => handleInputChange('planning', e.target.value)}
                              onFocus={(e) => { filterPlanning(form.planning); setShowPlanningDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowPlanningDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Rencana tindakan atau terapi..."
                              style={soapTextareaStyle}
                            />
                            {showPlanningDropdown && filteredPlanning.length > 0 && (
                              <Dropdown items={filteredPlanning} onSelect={(v) => { handleInputChange('planning', v); setShowPlanningDropdown(false); }} />
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Instruksi/Implementasi</label>
                            <textarea
                              value={form.instruksi}
                              onChange={(e) => handleInputChange('instruksi', e.target.value)}
                              onFocus={(e) => { filterInstruksi(form.instruksi); setShowInstruksiDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowInstruksiDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Instruksi perawatan..."
                              style={soapTextareaStyle}
                            />
                            {showInstruksiDropdown && filteredInstruksi.length > 0 && (
                              <Dropdown items={filteredInstruksi} onSelect={(v) => { handleInputChange('instruksi', v); setShowInstruksiDropdown(false); }} />
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <label style={soapLabelStyle}>Evaluasi</label>
                            <textarea
                              value={form.evaluasi}
                              onChange={(e) => handleInputChange('evaluasi', e.target.value)}
                              onFocus={(e) => { filterEvaluasi(form.evaluasi); setShowEvaluasiDropdown(true); handleSoapFieldFocus(e); }}
                              onBlur={(e) => { setTimeout(() => setShowEvaluasiDropdown(false), 200); handleSoapFieldBlur(e); }}
                              placeholder="Evaluasi dan catatan lanjutan..."
                              style={{ ...soapTextareaStyle, minHeight: 50 }}
                            />
                            {showEvaluasiDropdown && filteredEvaluasi.length > 0 && (
                              <Dropdown items={filteredEvaluasi} onSelect={(v) => { handleInputChange('evaluasi', v); setShowEvaluasiDropdown(false); }} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons — flat radius 0, PERSIS pola tombol
                          aksi tab SOAP Pemeriksaan.tsx (Poli)/PemeriksaanIGD.tsx,
                          3 tombol Ranap yg sudah ada dipertahankan semua. */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 16 }}>
                        <button type="submit" disabled={loading} style={soapActionBtn('#1AB1E5', loading)}>
                          {loading ? 'Menyimpan...' : isEditMode ? 'Update SOAP' : 'Simpan SOAP'}
                        </button>
                        <button type="button" onClick={clearForm} style={soapActionBtn('#f59e0b')}>
                          Clear
                        </button>
                        <button type="button" onClick={() => setShowRiwayatModal(true)} style={soapActionBtn('#6b7280')}>
                          Riwayat Perawatan
                        </button>
                      </div>

                      {error && (
                        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12 }}>
                          {error}
                        </div>
                      )}
                    </form>
                  </div>

                  {/* SOAP History table — DIPERTAHANKAN APA ADANYA (tabel
                      "Rincian Riwayat" sudah ada sebelumnya) per permintaan
                      user, cuma dipindah ke kolom 70% ini. */}
                  {soapHistory.length > 0 && (
                    <div>
                      <div style={{ background: '#fff', borderRadius: 0, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f9fafb', fontWeight: 400 }}>
                              <th rowSpan={2} style={{ width: 36, padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle', fontWeight: 400 }}>No</th>
                              <th rowSpan={2} style={{ width: 150, padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle', fontWeight: 400 }}>Tanggal</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Suhu(C)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Tensi(mmHg)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Nadi(/mnt)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>RR(/mnt)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Tinggi(cm)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Berat(kg)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>GCS</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>SPO2</th>
                              <th style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 400 }}>Alergi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {soapHistory.map((item, index) => (
                              <React.Fragment key={`${item.no_rawat}-${item.tgl_perawatan}-${item.jam_rawat}-${index}`}>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td rowSpan={8} style={{ width: 36, padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', verticalAlign: 'top' }}>{index + 1}</td>
                                  <td rowSpan={8} style={{ width: 150, padding: 10, borderRight: '1px solid #e5e7eb', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <div style={{ fontSize: 11 }}>
                                        <strong style={{ display: 'block' }}>{item.no_rawat}</strong>
                                        {formatDateTime(item.tgl_perawatan || '', item.jam_rawat || '')}
                                      </div>
                                      {(item.nama || item.jbtn) && (
                                        <div style={{ fontSize: 11 }}>
                                          {item.nama && <strong style={{ display: 'block', color: '#374151' }}>{item.nama}</strong>}
                                          {item.jbtn && <span style={{ color: '#7c3aed', fontSize: 10 }}>{item.jbtn}</span>}
                                        </div>
                                      )}
                                      <div style={{ display: 'flex' }}>
                                        <button onClick={() => editSOAP(item)} style={soapHistoryActionBtn('#f59e0b', true, false)}>Edit</button>
                                        <button onClick={() => copySOAP(item)} style={soapHistoryActionBtn('#2563eb', false, false)}>Copy</button>
                                        <button onClick={() => deleteSOAP(item)} style={soapHistoryActionBtn('#ef4444', false, true)}>Hapus</button>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.suhu_tubuh || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.tensi || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.nadi || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.respirasi || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.tinggi || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.berat || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.gcs || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{item.spo2 || '-'}</td>
                                  <td style={{ padding: 8, textAlign: 'center' }}>{item.alergi || '-'}</td>
                                </tr>
                                {[
                                  ['Kesadaran', item.kesadaran || 'Compos Mentis'],
                                  ['Subjective', item.keluhan || '-'],
                                  ['Objective', item.pemeriksaan || '-'],
                                  ['Assessment', item.penilaian || '-'],
                                  ['Plan', item.rtl || '-'],
                                  ['Instruksi', item.instruksi || '-'],
                                  ['Evaluasi', item.evaluasi || '-'],
                                ].map(([label, val], ri) => (
                                  <tr key={ri} style={{ borderBottom: ri === 6 && index < soapHistory.length - 1 ? '2px solid #9ca3af' : '1px solid #e5e7eb' }}>
                                    <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>{label}</td>
                                    <td colSpan={9} style={{ padding: 8 }}>{val}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {soapHistory.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data SOAP/CPPT</div>
                      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada riwayat SOAP/CPPT untuk pasien ini.</div>
                    </div>
                  )}
                </div>

                {/* Grafik TTV — sisi 30%, sumber data & grafik SVG-nya
                    (renderVitalChart/vitalTrend) DIPERTAHANKAN apa adanya,
                    cuma dipindah dari position:fixed ke kolom sticky biasa
                    krn sekarang sudah kebagian ruang tetap 30% (dulu perlu
                    fixed krn cuma "numpang" di sisa ruang kanan form yg
                    dibatasi maxWidth 900 tanpa kolom sendiri). Restyle flat
                    (radius 0, header polos) samakan dgn card sidebar
                    "Kunjungan Terakhir" Pemeriksaan.tsx. */}
                <div style={{ width: '30%', flexShrink: 0 }}>
                  <div style={{ position: 'sticky', top: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0 }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Grafik TTV</span>
                    </div>
                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {vitalTrend.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                          Belum ada riwayat SOAP untuk digrafikkan
                        </div>
                      ) : (
                        <>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Tekanan Darah</span>
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>mmHg</span>
                            </div>
                            {renderVitalChart([
                              { color: '#2563eb', values: vitalTrend.map((p) => p.sistol) },
                              { color: '#06b6d4', values: vitalTrend.map((p) => p.diastol) },
                            ])}
                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />Sistol
                              </span>
                              <span style={{ fontSize: 10, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }} />Diastol
                              </span>
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Suhu</span>
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>°C</span>
                            </div>
                            {renderVitalChart([{ color: '#f59e0b', values: vitalTrend.map((p) => p.suhu) }])}
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Nadi</span>
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>/mnt</span>
                            </div>
                            {renderVitalChart([{ color: '#ef4444', values: vitalTrend.map((p) => p.nadi) }])}
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Respirasi</span>
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>/mnt</span>
                            </div>
                            {renderVitalChart([{ color: '#8b5cf6', values: vitalTrend.map((p) => p.respirasi) }])}
                          </div>

                          <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                            {vitalTrend.length} data terakhir &middot; {vitalTrend[0]?.label} &ndash; {vitalTrend[vitalTrend.length - 1]?.label}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ── Other Tabs ── */}
            {activeTab === 'resep' && (
              <div style={{ width: '70%' }}>
                {/* Riwayat Resep Rawat Inap — pakai komponen ResepTab.tsx
                    (SAMA PERSIS dgn tab Resep Pemeriksaan.tsx/PemeriksaanIGD.tsx),
                    isRanap switch endpoint ke /api/resep-ranap/* di dalamnya.
                    Tombol "+ Resep Pulang" (khusus Ranap) dirender sejajar
                    "+ Input Resep" bawaan ResepTab lewat extraActions. */}
                <ResepTab
                  patient={patient}
                  isRanap
                  openInputSignal={resepOpenSignal}
                  onResepChanged={fetchSoapHistory}
                  extraActions={
                    <button onClick={() => { setEditingResepPulang(null); setShowResepPulangModal(true); }}
                      style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400 }}>
                      + Resep Pulang
                    </button>
                  }
                />

                {/* ── Riwayat Resep Pulang — gaya/desain card & tabel item
                    disamakan dgn "Riwayat Resep" (ResepTab.tsx): card
                    flat radius 0, header polos (bg putih, no_permintaan
                    tidak bold), badge status radius 0, item non-racikan/
                    racikan dirender pakai tabel (bukan baris flex),
                    tombol Edit/Batalkan solid-fill radius 0. */}
                <div style={{ marginTop: 28 }}>
                  {loadingResepPulang ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat data resep...</div>
                  ) : riwayatResepPulang.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Resep Pulang</div>
                      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada permintaan resep pulang untuk pasien ini.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {riwayatResepPulang.map((rp: any, i: number) => {
                        const tglFmt = rp.tgl_permintaan
                          ? (() => { const d = rp.tgl_permintaan.split('T')[0]; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; })()
                          : '-';
                        const sudah = rp.status === 'Sudah';
                        const belum = !sudah;
                        const nonRacikan: any[] = rp.items || [];
                        const racikan: any[] = rp.racikan || [];
                        return (
                          <div key={i} style={{ background: '#fff', borderRadius: 0, border: `1px solid ${belum ? '#e5e7eb' : '#d1fae5'}`, overflow: 'hidden' }}>
                            {/* Header card */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: '#374151' }}>{rp.no_permintaan}</span>
                                <span style={{ fontSize: 12, color: '#6b7280' }}>{tglFmt} • {rp.jam?.slice(0, 5)}</span>
                                {rp.nm_dokter && <span style={{ fontSize: 12, color: '#7c3aed' }}>{rp.nm_dokter}</span>}
                                <span style={{
                                  fontSize: 12, fontWeight: 400, padding: '2px 8px', borderRadius: 0,
                                  background: belum ? '#fef3c7' : '#d1fae5',
                                  color: belum ? '#92400e' : '#065f46'
                                }}>
                                  {belum ? 'Belum Tervalidasi' : 'Sudah Tervalidasi'}
                                </span>
                              </div>
                              {belum && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <button
                                    type="button"
                                    style={{ padding: '4px 10px', borderRadius: 0, border: 'none', background: '#16a34a', color: '#fff', cursor: 'default', fontSize: 12, fontWeight: 400 }}>
                                    Resep Pulang
                                  </button>
                                  <div style={{ display: 'flex', gap: 0 }}>
                                    <button
                                      onClick={() => { setEditingResepPulang({ no_permintaan: rp.no_permintaan, items: rp.items, racikan: rp.racikan }); setShowResepPulangModal(true); }}
                                      style={{ padding: '4px 10px', borderRadius: 0, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteResepPulang(rp.no_permintaan)}
                                      style={{ padding: '4px 10px', borderRadius: 0, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}>
                                      Batalkan
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Items */}
                            <div style={{ padding: '10px 16px' }}>
                              {nonRacikan.length > 0 && (
                                <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 400, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: '#f9fafb' }}>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 160 }}>Aturan Pakai</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {nonRacikan.map((it: any, j: number) => (
                                        <tr key={j}>
                                          <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 400, color: '#374151' }}>{it.nama_brng || '-'}</td>
                                          <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{it.jml || '-'} {it.kode_sat}</td>
                                          <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#7c3aed' }}>{it.dosis || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {racikan.length > 0 && racikan.map((rack: any, ri: number) => (
                                <div key={ri} style={{ marginTop: ri > 0 ? 8 : 0 }}>
                                  <div style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, borderTop: ri > 0 ? '1px solid #e5e7eb' : 'none', paddingTop: ri > 0 ? 8 : 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 400, color: '#7c3aed', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Racikan — {rack.nama_racik || `R${ri + 1}`}
                                      {rack.kd_racik && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.kd_racik}</span>}
                                      {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                                      {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ background: '#f9fafb' }}>
                                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Kps</th>
                                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(rack.detail || []).map((det: any, di: number) => (
                                          <tr key={di}>
                                            <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 400, color: '#374151' }}>{det.nama_brng || '-'}</td>
                                            <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.kapasitas || '-'}</td>
                                            <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.jml || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'lab' && (
              <div style={{ width: '70%' }}>
                <LabTab patient={patient} />
              </div>
            )}
            {activeTab === 'rad' && (
              <div style={{ width: '70%' }}>
                <RadTab patient={patient} />
              </div>
            )}
            {activeTab === 'tindakan' && (
              <div style={{ width: '70%' }}>
                <TindakanTab patient={patient} isRanap />
              </div>
            )}
            {activeTab === 'upload'   && <UploadTab   patient={patient} />}

            {/* ── ADIME GIZI Tab — desain input flat disamakan dgn tab
                SOAP/CPPT (panel putih tanpa shadow, label 12px, input
                tinggi 30px, tombol aksi radius 0), per permintaan user
                "ubah juga desain inputnya seperti tab soap". Riwayat ADIME
                Gizi di bawahnya TIDAK diubah. Layout 70%/30% (30% = card
                SOAP/CPPT yg dulu position:fixed floating, sekarang jadi
                kolom sticky inline, SELALU tampil per permintaan user —
                tombol toggle "Tampilkan/Sembunyikan SOAP/CPPT" dihapus). ── */}
            {activeTab === 'adime' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: '70%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {editingAdime && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', background: '#e0f2fe', border: '1px solid #1AB1E5', color: '#0369a1', fontSize: 12, fontWeight: 400 }}>
                    <span>Mode Edit — mengubah data ADIME Gizi tanggal {editingAdime}.</span>
                    <button
                      type="button"
                      onClick={() => { setAdime({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' }); setAdimeNip(''); setAdimePetugasNama(''); setEditingAdime(null); }}
                      style={{ padding: '4px 10px', borderRadius: 0, border: '1px solid #0369a1', background: '#fff', color: '#0369a1', cursor: 'pointer', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}
                    >
                      Batal Edit
                    </button>
                  </div>
                )}

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Petugas + Tanggal + Jam */}
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: isPermanentSidebar ? 'nowrap' : 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.4, minWidth: 220 }}>
                      <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Petugas :</label>
                      <div style={{ display: 'flex', gap: 2, position: 'relative', flex: 1 }}>
                        <input type="text" value={adimePetugasNama} readOnly placeholder="Cari petugas..." style={{ ...soapInputStyle, flex: 1, background: '#f9fafb' }} />
                        <button
                          type="button" onClick={() => setAdimePetugasOpen(true)} title="Cari petugas"
                          style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tanggal :</label>
                      <input type="date" value={adimeTgl} onChange={(e) => { setAdimeTgl(e.target.value); setAdimeUseAutoTime(false); }} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} style={{ ...soapInputStyle, width: 130 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ ...soapLabelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Jam :</label>
                      <input type="time" value={adimeJam} onChange={(e) => { setAdimeJam(e.target.value); setAdimeUseAutoTime(false); }} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} step="1" style={{ ...soapInputStyle, width: 110 }} />
                    </div>
                    <input
                      type="checkbox"
                      checked={adimeUseAutoTime}
                      onChange={(e) => setAdimeUseAutoTime(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                      title="Gunakan waktu saat ini"
                    />
                  </div>

                  <ModalCariPetugas
                    isOpen={adimePetugasOpen}
                    onClose={() => setAdimePetugasOpen(false)}
                    onSelect={(nip, nama) => { setAdimeNip(nip); setAdimePetugasNama(nama); }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16 }}>
                    {[
                      { key: 'asesmen', label: 'Asesmen Gizi', placeholder: 'Antropometri, biokimia, klinis, riwayat diet...' },
                      { key: 'diagnosis', label: 'Diagnosis Gizi', placeholder: 'Problem (P) berkaitan dengan (BE) ditandai dengan (S)...' },
                      { key: 'intervensi', label: 'Intervensi Gizi', placeholder: 'Preskripsi diet, edukasi, koordinasi asuhan gizi...' },
                      { key: 'monitoring', label: 'Monitoring', placeholder: 'Indikator yang dipantau...' },
                      { key: 'evaluasi', label: 'Evaluasi', placeholder: 'Hasil evaluasi intervensi gizi...' },
                      { key: 'instruksi', label: 'Instruksi', placeholder: 'Instruksi lanjutan...' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label style={soapLabelStyle}>{label}</label>
                        <textarea
                          value={(adime as any)[key]}
                          onChange={(e) => setAdime((prev) => ({ ...prev, [key]: e.target.value }))}
                          onFocus={handleSoapFieldFocus}
                          onBlur={handleSoapFieldBlur}
                          placeholder={placeholder}
                          style={soapTextareaStyle}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Action buttons — flat radius 0, PERSIS pola soapActionBtn tab SOAP/CPPT */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      disabled={savingAdime}
                      onClick={async () => {
                        setSavingAdime(true);
                        try {
                          const url = editingAdime ? '/api/adime' : '/api/adime';
                          const method = editingAdime ? 'PUT' : 'POST';
                          const payload = {
                            no_rawat: patient.no_rawat,
                            asesmen: adime.asesmen,
                            diagnosis: adime.diagnosis,
                            intervensi: adime.intervensi,
                            monitoring: adime.monitoring,
                            evaluasi: adime.evaluasi,
                            instruksi: adime.instruksi,
                            nip: adimeNip,
                            ...(editingAdime
                              ? { tanggal: editingAdime }
                              : !adimeUseAutoTime ? { tanggal: `${adimeTgl} ${adimeJam}` } : {}),
                          };
                          const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });
                          if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan');
                          Swal.fire({ icon: 'success', title: 'Berhasil!', text: editingAdime ? 'ADIME Gizi berhasil diupdate' : 'ADIME Gizi berhasil disimpan', timer: 2000, showConfirmButton: false });
                          setAdime({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' });
                          setAdimeNip(''); setAdimePetugasNama('');
                          setEditingAdime(null);
                          fetchAdimeHistory();
                        } catch (err: any) {
                          Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
                        } finally {
                          setSavingAdime(false);
                        }
                      }}
                      style={soapActionBtn('#1AB1E5', savingAdime)}
                    >
                      {savingAdime ? 'Menyimpan...' : editingAdime ? 'Update ADIME' : 'Simpan ADIME'}
                    </button>
                    <button
                      onClick={() => { setAdime({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' }); setAdimeNip(''); setAdimePetugasNama(''); }}
                      style={soapActionBtn('#f59e0b')}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowRiwayatModal(true)}
                      style={soapActionBtn('#6b7280')}
                    >
                      Riwayat Perawatan
                    </button>
                  </div>
                </div>

                {/* Riwayat ADIME — tabel No/Tanggal/Catatan/Petugas, PERSIS
                    pola tabel Rincian Riwayat SOAP (No & Tanggal & Petugas
                    rowSpan, satu baris per field di kolom Catatan). */}
                {adimeHistory.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 0, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#1AB1E5' }}>
                          <th style={{ width: 28, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400, fontSize: 12, color: '#fff' }}>No.</th>
                          <th style={{ width: 150, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 400, fontSize: 12, color: '#fff' }}>Tanggal</th>
                          <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 400, fontSize: 12, color: '#fff' }}>Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adimeHistory.map((item, idx) => {
                          const fields: [string, string][] = [
                            ['Asesmen', item.asesmen],
                            ['Diagnosis', item.diagnosis],
                            ['Intervensi', item.intervensi],
                            ['Monitoring', item.monitoring],
                            ['Evaluasi', item.evaluasi],
                            ['Instruksi', item.instruksi],
                          ];
                          return (
                            <React.Fragment key={idx}>
                              {fields.map(([label, val], ri) => (
                                <tr key={ri} style={{ borderBottom: ri === fields.length - 1 && idx < adimeHistory.length - 1 ? '2px solid #9ca3af' : '1px solid #e5e7eb' }}>
                                  {ri === 0 && (
                                    <td rowSpan={fields.length} style={{ width: 28, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e5e7eb', verticalAlign: 'top' }}>{idx + 1}</td>
                                  )}
                                  {ri === 0 && (
                                    <td rowSpan={fields.length} style={{ width: 150, padding: 10, borderRight: '1px solid #e5e7eb', verticalAlign: 'top', wordBreak: 'break-word' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div>
                                          {item.tanggal}
                                          {item.nama_petugas && <div style={{ color: '#000000', fontWeight: 700 }}>{item.nama_petugas}</div>}
                                        </div>
                                        <div style={{ display: 'flex' }}>
                                          <button
                                            onClick={() => {
                                              setAdime({ asesmen: item.asesmen, diagnosis: item.diagnosis, intervensi: item.intervensi, monitoring: item.monitoring, evaluasi: item.evaluasi, instruksi: item.instruksi });
                                              setAdimeNip(item.nip || ''); setAdimePetugasNama(item.nama_petugas || '');
                                              setEditingAdime(item.tanggal);
                                            }}
                                            style={soapHistoryActionBtn('#f59e0b', true, false)}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={async () => {
                                              const conf = await Swal.fire({ icon: 'warning', title: 'Hapus?', text: 'Data ADIME ini akan dihapus', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' });
                                              if (!conf.isConfirmed) return;
                                              await fetch(`/api/adime?no_rawat=${encodeURIComponent(patient.no_rawat)}&tanggal=${encodeURIComponent(item.tanggal)}`, { method: 'DELETE' });
                                              fetchAdimeHistory();
                                            }}
                                            style={soapHistoryActionBtn('#ef4444', false, true)}
                                          >
                                            Hapus
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  )}
                                  <td style={{ padding: '4px 8px' }}>{label} : {val || '-'}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {adimeHistory.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data ADIME Gizi</div>
                    <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada riwayat ADIME Gizi untuk pasien ini.</div>
                  </div>
                )}

              </div>

              {/* Card SOAP/CPPT — kolom 30%, dulu position:fixed floating
                  panel, sekarang inline sticky sama pola card Grafik TTV
                  di tab SOAP/CPPT. SELALU tampil (tombol toggle dihapus
                  per permintaan user). */}
              <div style={{ width: '30%', flexShrink: 0 }}>
                  <div style={{ position: 'sticky', top: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0 }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <span style={{ fontSize: 13, fontWeight: 400, color: '#374151' }}>SOAP / CPPT</span>
                    </div>
                    <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: 12 }}>
                      {soapHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingTop: 40 }}>Belum ada data SOAP/CPPT.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {soapHistory.map((item, idx) => (
                            <div key={idx} style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                              {/* Entry header */}
                              <div style={{ background: '#f9fafb', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 400, color: '#374151' }}>
                                  {formatDateTime(item.tgl_perawatan || '', item.jam_rawat || '')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {item.nama && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 400 }}>{item.nama}</span>}
                                  <button
                                    title="Copy Subjective + Vital Signs ke Asesmen Gizi"
                                    onClick={() => {
                                      const vitals: string[] = [];
                                      if (item.tensi)       vitals.push(`TD: ${item.tensi}`);
                                      if (item.suhu_tubuh)  vitals.push(`Suhu: ${item.suhu_tubuh}°C`);
                                      if (item.nadi)        vitals.push(`Nadi: ${item.nadi}/mnt`);
                                      if (item.respirasi)   vitals.push(`RR: ${item.respirasi}/mnt`);
                                      if (item.berat)       vitals.push(`BB: ${item.berat} kg`);
                                      if (item.tinggi)      vitals.push(`TB: ${item.tinggi} cm`);
                                      if (item.gcs)         vitals.push(`GCS: ${item.gcs}`);
                                      if (item.spo2)        vitals.push(`SpO2: ${item.spo2}`);
                                      if (item.alergi)      vitals.push(`Alergi: ${item.alergi}`);
                                      const parts: string[] = [];
                                      if (item.keluhan)     parts.push(`Keluhan: ${item.keluhan}`);
                                      if (vitals.length)    parts.push(`Vital Signs:\n${vitals.map(v => `- ${v}`).join('\n')}`);
                                      setAdime((prev) => ({ ...prev, asesmen: parts.join('\n\n') }));
                                    }}
                                    style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 0, cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', color: '#0369a1' }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Vital signs */}
                              <div style={{ padding: '6px 10px', background: '#f0f9ff', borderBottom: '1px solid #e5e7eb', fontSize: 10 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', marginBottom: item.alergi ? 6 : 0 }}>
                                  {[['TD', item.tensi], ['Suhu', item.suhu_tubuh ? item.suhu_tubuh + '°C' : ''], ['Nadi', item.nadi ? item.nadi + '/mnt' : ''], ['RR', item.respirasi ? item.respirasi + '/mnt' : ''], ['BB', item.berat ? item.berat + ' kg' : ''], ['GCS', item.gcs]].map(([lbl, val]) => val ? (
                                    <div key={lbl as string}><span style={{ color: '#9ca3af' }}>{lbl}:</span> <span style={{ fontWeight: 400, color: '#374151' }}>{val}</span></div>
                                  ) : null)}
                                </div>
                                {item.alergi && (
                                  <div style={{ marginTop: 4, padding: '3px 6px', background: '#fef2f2', borderRadius: 0, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 9, fontWeight: 400, color: '#dc2626', background: '#fecaca', padding: '1px 4px', borderRadius: 3 }}>ALERGI</span>
                                    <span style={{ color: '#dc2626', fontWeight: 400 }}>{item.alergi}</span>
                                  </div>
                                )}
                              </div>

                              {/* SOAP fields */}
                              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                                {[
                                  ['S', 'Subjective',  item.keluhan,     '#1AB1E5'],
                                  ['O', 'Objective',   item.pemeriksaan, '#f59e0b'],
                                  ['A', 'Assessment',  item.penilaian,   '#ef4444'],
                                  ['P', 'Plan',        item.rtl,         '#10b981'],
                                  ['E', 'Evaluasi',    item.evaluasi,    '#14b8a6'],
                                  ['I', 'Instruksi',   item.instruksi,   '#6b7280'],
                                ].filter(([,, val]) => val).map(([badge, label, val, color]) => (
                                  <div key={badge as string}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                      <span style={{ background: color as string, color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 400 }}>{badge}</span>
                                      <span style={{ fontSize: 10, fontWeight: 400, color: color as string }}>{label}</span>
                                    </div>
                                    <p style={{ margin: 0, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{val as string}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Resume Tab ── */}
            {activeTab === 'resume' && (
              <div style={{ width: '70%' }}>
                <ResumeTab patient={patient} />
              </div>
            )}

          </div>
        </div>
      </div>


      {/* Modals */}
      {showResepPulangModal && (
        <ResepPulangModal
          patient={patient}
          onClose={() => { setShowResepPulangModal(false); setEditingResepPulang(null); }}
          onSaved={() => fetchRiwayatResepPulang()}
          editData={editingResepPulang}
        />
      )}
      {showRiwayatModal && (
        <RiwayatModal
          patient={patient}
          onClose={() => setShowRiwayatModal(false)}
        />
      )}
      <ModalCariPegawai
        isOpen={soapPetugasOpen}
        onClose={() => setSoapPetugasOpen(false)}
        onSelect={(nik, nama) => { setSoapNip(nik); setSoapPetugasNama(nama); }}
      />
    </section>
  );
};
