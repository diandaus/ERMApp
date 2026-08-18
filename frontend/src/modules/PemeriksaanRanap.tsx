import React from 'react';
import Swal from 'sweetalert2';
import { ResepModal } from '../components/ResepModal';
import { ResepPulangModal } from '../components/ResepPulangModal';
import { RiwayatModal } from '../components/RiwayatModal';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { UploadTab } from '../components/UploadTab';
import { TindakanTab } from '../components/TindakanTab';
import { ModalCariPetugas } from '../components/ModalCariPetugas';
import { ModalCariPegawai } from '../components/ModalCariPegawai';
import { ResumeTab } from '../components/ResumeTab';
import { useBreakpoint, useMediaQuery } from '../hooks/useBreakpoint';
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
  const [showSoapInAdime, setShowSoapInAdime] = React.useState(false);
  const [soapHistory, setSoapHistory] = React.useState<any[]>([]);
  const [showResepModal, setShowResepModal] = React.useState(false);
  const [editingResep, setEditingResep] = React.useState<{ no_resep: string; items: any[]; racikan?: any[] } | null>(null);
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);
  const [showResepPulangModal, setShowResepPulangModal] = React.useState(false);
  const [editingResepPulang, setEditingResepPulang] = React.useState<{ no_permintaan: string; items: any[]; racikan?: any[] } | null>(null);
  const [riwayatResepPulang, setRiwayatResepPulang] = React.useState<any[]>([]);
  const [loadingResepPulang, setLoadingResepPulang] = React.useState(false);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  const { isCompact } = useBreakpoint();
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

  const fetchRiwayatResep = async () => {
    setLoadingRiwayatResep(true);
    try {
      const res = await fetch(`/api/resep-ranap/list?no_rawat=${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRiwayatResep(Array.isArray(data) ? data : []);
    } catch {
      setRiwayatResep([]);
    } finally {
      setLoadingRiwayatResep(false);
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
    if (activeTab === 'resep') { fetchRiwayatResep(); fetchRiwayatResepPulang(); }
  }, [activeTab, patient.no_rkm_medis]);

  const handleDeleteResep = async (noResep: string) => {
    const result = await Swal.fire({
      title: 'Hapus Resep?', text: `Hapus resep ${noResep}?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/resep-ranap?no_resep=${encodeURIComponent(noResep)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Gagal menghapus resep');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Resep berhasil dihapus', timer: 2000, showConfirmButton: false });
      await fetchRiwayatResep();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus resep' });
    }
  };

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
        spo2: '',
        gcs: form.gcs,
        kesadaran: form.kesadaran,
        keluhan: form.subjective,
        pemeriksaan: form.objective,
        alergi: form.alergi,
        lingkar_perut: '',
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
      if (result.isConfirmed) setShowResepModal(true);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan SOAP');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setForm({ subjective: '', objective: '', assessment: '', planning: '', evaluasi: '', instruksi: '', tensi: '', suhu: '', nadi: '', respirasi: '', tinggi: '', berat: '', gcs: '', kesadaran: 'Compos Mentis', alergi: '' });
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
      alergi: item.alergi || '',
    });
    setSoapNip(item.nip || ''); setSoapPetugasNama(item.nama || '');
    setIsEditMode(true);
    setEditingItem(item);
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

  // ── Reusable dropdown renderer ────────────────────────────────────────────────

  const Dropdown = ({ items, onSelect, maxH = 200 }: { items: string[]; onSelect: (v: string) => void; maxH?: number }) => (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: maxH, overflowY: 'auto', zIndex: 1000, marginTop: 4 }}>
      {items.map((item, i) => (
        <div key={i} onClick={() => onSelect(item)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}
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
              <InfoItem label="Jenis Kelamin" value={patient.jk === 'L' ? 'Laki-laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>} />
              <InfoItem label="Umur" value={patient.umur || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
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
              <InfoItem label="DPJP" value={patient.nm_dokter || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
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
          <button
            onClick={onBack}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #1AB1E5', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
          >
            ← Keluar
          </button>
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

            {/* ── SOAP Tab ── */}
            {activeTab === 'soap' && (
              <div style={{ display: 'flex', gap: 20, minWidth: 0 }}>

                {/* Form area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditMode && (
                    <div style={{ background: '#cffafe', border: '1px solid #1AB1E5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#0e7490' }}>
                      <strong>✏️ Mode Edit</strong> — Anda sedang mengedit SOAP yang sudah ada.
                    </div>
                  )}

                  <form ref={formRef} onSubmit={handleSubmit}>
                    {/* Tgl/Jam + Pegawai + Alergi — satu baris di >=1366px, wrap ke baris berikutnya di layar lebih sempit */}
                    {!isEditMode && (
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: isPermanentSidebar ? 'nowrap' : 'wrap' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Tgl :</span>
                          <input type="date" value={soapTgl} onChange={(e) => { setSoapTgl(e.target.value); setSoapUseAutoTime(false); }}
                            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Jam :</span>
                          <input type="time" value={soapJam} onChange={(e) => { setSoapJam(e.target.value); setSoapUseAutoTime(false); }} step="1"
                            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                          <input type="checkbox" checked={soapUseAutoTime} onChange={(e) => setSoapUseAutoTime(e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }} title="Gunakan waktu saat ini" />
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 220 }}>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Pegawai :</span>
                          <div style={{ display: 'flex', gap: 2, flex: 1, position: 'relative' }}>
                            <input type="text" value={soapPetugasNama} readOnly placeholder="Nama pegawai"
                              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb' }} />
                            <button type="button" onClick={() => setSoapPetugasOpen(true)}
                              style={{ padding: '2px 2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Cari pegawai">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Alergi :</span>
                          <input
                            type="text"
                            value={form.alergi}
                            onChange={(e) => handleInputChange('alergi', e.target.value)}
                            style={{ width: 180, padding: '7px 10px', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 13, outline: 'none', background: form.alergi ? '#fef2f2' : '#fff', color: '#dc2626' }}
                            placeholder="Alergi..."
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 20, marginBottom: 20 }}>

                      {/* Left column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Subjective */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#1AB1E5', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>S</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Subjective (Keluhan)</label>
                          </div>
                          <textarea
                            value={form.subjective} rows={4} required
                            onChange={(e) => handleInputChange('subjective', e.target.value)}
                            onFocus={() => { filterSubjective(form.subjective); setShowSubjectiveDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowSubjectiveDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Keluhan yang disampaikan pasien..."
                          />
                          {showSubjectiveDropdown && filteredSubjective.length > 0 && (
                            <Dropdown items={filteredSubjective} onSelect={(v) => { handleInputChange('subjective', v); setShowSubjectiveDropdown(false); }} />
                          )}
                        </div>

                        {/* Objective */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>O</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Objective (Pemeriksaan)</label>
                          </div>
                          <textarea
                            value={form.objective} rows={4} required
                            onChange={(e) => handleInputChange('objective', e.target.value)}
                            onFocus={() => { filterObjective(form.objective); setShowObjectiveDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowObjectiveDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Hasil pemeriksaan fisik..."
                          />
                          {showObjectiveDropdown && filteredObjective.length > 0 && (
                            <Dropdown items={filteredObjective} onSelect={(v) => { handleInputChange('objective', v); setShowObjectiveDropdown(false); }} />
                          )}
                        </div>

                        {/* Vital Signs */}
                        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                            {([
                              ['tensi',     form.tensi,     filterTensi,     setShowTensiDropdown,     showTensiDropdown,     filteredTensi,     'TD',       'mmHg'],
                              ['suhu',      form.suhu,      filterSuhu,      setShowSuhuDropdown,      showSuhuDropdown,      filteredSuhu,      'Suhu',     '°C'],
                              ['nadi',      form.nadi,      filterNadi,      setShowNadiDropdown,      showNadiDropdown,      filteredNadi,      'Nadi',     '/mnt'],
                              ['respirasi', form.respirasi, filterRespirasi, setShowRespirasiDropdown, showRespirasiDropdown, filteredRespirasi, 'RR',       '/mnt'],
                              ['tinggi',    form.tinggi,    filterTinggi,    setShowTinggiDropdown,    showTinggiDropdown,    filteredTinggi,    'Tinggi',   'cm'],
                              ['berat',     form.berat,     filterBerat,     setShowBeratDropdown,     showBeratDropdown,     filteredBerat,     'Berat',    'kg'],
                            ] as const).map(([field, val, filter, setShow, show, filtered, label, placeholder]) => (
                              <div key={field} style={{ position: 'relative' }}>
                                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</label>
                                <input
                                  type="text" value={val}
                                  onChange={(e) => handleInputChange(field, e.target.value)}
                                  onFocus={() => { filter(val); setShow(true); }}
                                  onBlur={() => setTimeout(() => setShow(false), 200)}
                                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }}
                                  placeholder={placeholder}
                                />
                                {show && filtered.length > 0 && (
                                  <SmallDropdown items={filtered} onSelect={(v) => { handleInputChange(field, v); setShow(false); }} />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* GCS & Kesadaran */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>GCS</label>
                              <input
                                type="text" value={form.gcs}
                                onChange={(e) => handleInputChange('gcs', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }}
                                placeholder="E,V,M"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Kesadaran</label>
                              <select
                                value={form.kesadaran}
                                onChange={(e) => handleInputChange('kesadaran', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', background: '#fff' }}
                              >
                                {['Compos Mentis','Apatis','Delirium','Somnolen','Sopor','Coma'].map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Right column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Assessment */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>A</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Assessment (Diagnosis)</label>
                          </div>
                          <textarea
                            value={form.assessment} rows={3} required
                            onChange={(e) => handleInputChange('assessment', e.target.value)}
                            onFocus={() => { filterAssessment(form.assessment); setShowAssessmentDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowAssessmentDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Diagnosis atau assessment..."
                          />
                          {showAssessmentDropdown && filteredAssessment.length > 0 && (
                            <Dropdown items={filteredAssessment} onSelect={(v) => { handleInputChange('assessment', v); setShowAssessmentDropdown(false); }} />
                          )}
                        </div>

                        {/* Planning */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>P</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Planning (Rencana)</label>
                          </div>
                          <textarea
                            value={form.planning} rows={4}
                            onChange={(e) => handleInputChange('planning', e.target.value)}
                            onFocus={() => { filterPlanning(form.planning); setShowPlanningDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowPlanningDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Rencana tindakan atau terapi..."
                          />
                          {showPlanningDropdown && filteredPlanning.length > 0 && (
                            <Dropdown items={filteredPlanning} onSelect={(v) => { handleInputChange('planning', v); setShowPlanningDropdown(false); }} />
                          )}
                        </div>

                        {/* Evaluasi */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#14b8a6', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>E</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Evaluasi</label>
                          </div>
                          <textarea
                            value={form.evaluasi} rows={2}
                            onChange={(e) => handleInputChange('evaluasi', e.target.value)}
                            onFocus={() => { filterEvaluasi(form.evaluasi); setShowEvaluasiDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowEvaluasiDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Evaluasi dan catatan lanjutan..."
                          />
                          {showEvaluasiDropdown && filteredEvaluasi.length > 0 && (
                            <Dropdown items={filteredEvaluasi} onSelect={(v) => { handleInputChange('evaluasi', v); setShowEvaluasiDropdown(false); }} />
                          )}
                        </div>

                        {/* Instruksi */}
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ background: '#6b7280', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>I</span>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Instruksi</label>
                          </div>
                          <textarea
                            value={form.instruksi} rows={2}
                            onChange={(e) => handleInputChange('instruksi', e.target.value)}
                            onFocus={() => { filterInstruksi(form.instruksi); setShowInstruksiDropdown(true); }}
                            onBlur={() => setTimeout(() => setShowInstruksiDropdown(false), 200)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Instruksi perawatan..."
                          />
                          {showInstruksiDropdown && filteredInstruksi.length > 0 && (
                            <Dropdown items={filteredInstruksi} onSelect={(v) => { handleInputChange('instruksi', v); setShowInstruksiDropdown(false); }} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 12, justifyContent: 'center' }}>
                      <button type="submit" disabled={loading}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#10b981', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {loading ? <>⏳ Menyimpan...</> : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                            </svg>
                            {isEditMode ? 'Update SOAP' : 'Simpan SOAP'}
                          </>
                        )}
                      </button>
                      <button type="button" onClick={clearForm}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        Clear
                      </button>
                      <button type="button" onClick={() => setShowRiwayatModal(true)}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        Riwayat Perawatan
                      </button>
                    </div>

                    {error && (
                      <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                        {error}
                      </div>
                    )}
                  </form>

                  {/* SOAP History table */}
                  {soapHistory.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <h5 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Rincian Riwayat</h5>
                      <div style={{ background: '#fff', borderRadius: 8, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              <th rowSpan={2} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>No</th>
                              <th rowSpan={2} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>Tanggal</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Suhu(C)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Tensi(mmHg)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Nadi(/mnt)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>RR(/mnt)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Tinggi(cm)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Berat(kg)</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>GCS</th>
                              <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>SPO2</th>
                              <th style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Alergi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {soapHistory.map((item, index) => (
                              <React.Fragment key={`${item.no_rawat}-${item.tgl_perawatan}-${item.jam_rawat}-${index}`}>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td rowSpan={8} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', verticalAlign: 'top' }}>{index + 1}</td>
                                  <td rowSpan={8} style={{ padding: 10, borderRight: '1px solid #e5e7eb' }}>
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
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => editSOAP(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#e0f2fe', color: '#1AB1E5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Edit</button>
                                        <button onClick={() => deleteSOAP(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
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
                                  ['Objective',  item.pemeriksaan || '-'],
                                  ['Assessment', item.penilaian || '-'],
                                  ['Plan',       item.rtl || '-'],
                                  ['Instruksi',  item.instruksi || '-'],
                                  ['Evaluasi',   item.evaluasi || '-'],
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
                </div>

              </div>
            )}

            {/* ── Other Tabs ── */}
            {activeTab === 'resep' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>Riwayat Resep Rawat Inap</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditingResepPulang(null); setShowResepPulangModal(true); }}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      + Resep Pulang
                    </button>
                    <button onClick={() => setShowResepModal(true)}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      + Tambah Resep
                    </button>
                  </div>
                </div>
                {loadingRiwayatResep ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat...</div>
                ) : riwayatResep.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>Belum ada resep rawat inap</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {riwayatResep.map((resep: any, i: number) => {
                      const tglFmt = resep.tgl_peresepan
                        ? (() => { const d = resep.tgl_peresepan.split('T')[0]; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; })()
                        : '-';
                      // tgl_perawatan='0000-00-00' = belum divalidasi apotek
                      const sudahValidasi = resep.tgl_perawatan && resep.tgl_perawatan !== '0000-00-00';
                      const nonRacikan: any[] = resep.non_racikan || [];
                      const racikan: any[] = resep.racikan || [];

                      const renderNonRacikanRow = (item: any, j: number, total: number) => (
                        <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', paddingBottom: 4, borderBottom: j < total - 1 ? '1px solid #f3f4f6' : 'none', marginBottom: 4 }}>
                          <span style={{ flex: 1, fontWeight: 500 }}>{item.nama_brng}</span>
                          <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{item.jml} {item.kode_sat}</span>
                          {item.aturan_pakai && <span style={{ color: '#7c3aed', whiteSpace: 'nowrap' }}>{item.aturan_pakai}</span>}
                        </div>
                      );

                      return (
                        <div key={i} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${sudahValidasi ? '#d1fae5' : '#e5e7eb'}`, overflow: 'hidden' }}>
                          {/* Header card */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: sudahValidasi ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{resep.no_resep}</span>
                              <span style={{ fontSize: 12, color: '#6b7280' }}>{tglFmt} • {resep.jam_peresepan?.slice(0, 5)}</span>
                              {resep.nm_dokter && <span style={{ fontSize: 12, color: '#7c3aed' }}>{resep.nm_dokter}</span>}
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                                background: sudahValidasi ? '#d1fae5' : '#fef3c7',
                                color: sudahValidasi ? '#065f46' : '#92400e'
                              }}>
                                {sudahValidasi ? 'Sudah Tervalidasi' : 'Belum Tervalidasi'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  // pre-fill non_racikan + racikan untuk edit
                                  setEditingResep({
                                    no_resep: resep.no_resep,
                                    items: nonRacikan.map((it: any) => ({ ...it, aturan: it.aturan_pakai })),
                                    racikan,
                                  });
                                  setShowResepModal(true);
                                }}
                                disabled={sudahValidasi}
                                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${sudahValidasi ? '#d1d5db' : '#1AB1E5'}`, background: sudahValidasi ? '#f3f4f6' : '#e0f2fe', color: sudahValidasi ? '#9ca3af' : '#1AB1E5', cursor: sudahValidasi ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteResep(resep.no_resep)}
                                disabled={sudahValidasi}
                                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${sudahValidasi ? '#d1d5db' : '#ef4444'}`, background: sudahValidasi ? '#f3f4f6' : '#fef2f2', color: sudahValidasi ? '#9ca3af' : '#ef4444', cursor: sudahValidasi ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}>
                                Hapus
                              </button>
                            </div>
                          </div>
                          {/* Items */}
                          <div style={{ padding: '10px 16px' }}>
                            {nonRacikan.length > 0 && (
                              <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                                {nonRacikan.map((item: any, j: number) => renderNonRacikanRow(item, j, nonRacikan.length))}
                              </div>
                            )}
                            {racikan.length > 0 && racikan.map((rack: any, ri: number) => (
                              <div key={ri} style={{ marginTop: ri > 0 ? 8 : 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Racikan — {rack.nama_racik || `R${ri+1}`}
                                  {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                                  {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                                </div>
                                {(rack.detail || []).map((det: any, di: number) => (
                                  <div key={di} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', paddingBottom: 4, borderBottom: di < rack.detail.length - 1 ? '1px solid #f3f4f6' : 'none', marginBottom: 4, paddingLeft: 8 }}>
                                    <span style={{ flex: 1, fontWeight: 500 }}>{det.nama_brng}</span>
                                    <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{det.jml} {det.kode_sat}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Riwayat Resep Pulang ── */}
                <div style={{ marginTop: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>Riwayat Resep Pulang</h4>
                  </div>
                  {loadingResepPulang ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat...</div>
                  ) : riwayatResepPulang.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>Belum ada resep pulang</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {riwayatResepPulang.map((rp: any, i: number) => {
                        const tglFmt = rp.tgl_permintaan
                          ? (() => { const d = rp.tgl_permintaan.split('T')[0]; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; })()
                          : '-';
                        const sudah = rp.status === 'Sudah';
                        const nonRacikan: any[] = rp.items || [];
                        const racikan: any[] = rp.racikan || [];
                        return (
                          <div key={i} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${sudah ? '#d1fae5' : '#e5e7eb'}`, overflow: 'hidden' }}>
                            {/* Header card */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: sudah ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{rp.no_permintaan}</span>
                                <span style={{ fontSize: 12, color: '#6b7280' }}>{tglFmt} • {rp.jam?.slice(0, 5)}</span>
                                {rp.nm_dokter && <span style={{ fontSize: 12, color: '#7c3aed' }}>{rp.nm_dokter}</span>}
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                                  background: sudah ? '#d1fae5' : '#fef3c7',
                                  color: sudah ? '#065f46' : '#92400e'
                                }}>
                                  {sudah ? 'Sudah Tervalidasi' : 'Belum Tervalidasi'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button
                                  onClick={() => { setEditingResepPulang({ no_permintaan: rp.no_permintaan, items: rp.items, racikan: rp.racikan }); setShowResepPulangModal(true); }}
                                  disabled={sudah}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${sudah ? '#d1d5db' : '#16a34a'}`, background: sudah ? '#f3f4f6' : '#dcfce7', color: sudah ? '#9ca3af' : '#16a34a', cursor: sudah ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}>
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteResepPulang(rp.no_permintaan)}
                                  disabled={sudah}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${sudah ? '#d1d5db' : '#ef4444'}`, background: sudah ? '#f3f4f6' : '#fef2f2', color: sudah ? '#9ca3af' : '#ef4444', cursor: sudah ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500 }}>
                                  Hapus
                                </button>
                              </div>
                            </div>
                            {/* Items */}
                            <div style={{ padding: '10px 16px' }}>
                              {nonRacikan.length > 0 && (
                                <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                                  {nonRacikan.map((it: any, j: number) => (
                                    <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', paddingBottom: 4, borderBottom: j < nonRacikan.length - 1 ? '1px solid #f3f4f6' : 'none', marginBottom: 4 }}>
                                      <span style={{ flex: 1, fontWeight: 500 }}>{it.nama_brng}</span>
                                      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{it.jml} {it.kode_sat}</span>
                                      {it.dosis && <span style={{ color: '#7c3aed', whiteSpace: 'nowrap' }}>{it.dosis}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {racikan.length > 0 && racikan.map((rack: any, ri: number) => (
                                <div key={ri} style={{ marginTop: ri > 0 ? 8 : 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Racikan — {rack.nama_racik || `R${ri + 1}`}
                                    {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                                    {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                                  </div>
                                  {(rack.detail || []).map((det: any, di: number) => (
                                    <div key={di} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151', paddingBottom: 4, borderBottom: di < rack.detail.length - 1 ? '1px solid #f3f4f6' : 'none', marginBottom: 4, paddingLeft: 8 }}>
                                      <span style={{ flex: 1, fontWeight: 500 }}>{det.nama_brng}</span>
                                      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{det.jml} {det.kode_sat}</span>
                                      {det.kandungan && <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{det.kandungan}</span>}
                                    </div>
                                  ))}
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

            {activeTab === 'lab'      && <LabTab      patient={patient} />}
            {activeTab === 'rad'      && <RadTab      patient={patient} />}
            {activeTab === 'tindakan' && <TindakanTab patient={patient} />}
            {activeTab === 'upload'   && <UploadTab   patient={patient} />}

            {/* ── ADIME GIZI Tab ── */}
            {activeTab === 'adime' && (
              <div style={{ maxWidth: 900 }}>
                {/* Row: Tanggal/Jam + Petugas */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>

                  {/* Tanggal & Jam */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Tgl :</span>
                    <input
                      type="date"
                      value={adimeTgl}
                      onChange={(e) => { setAdimeTgl(e.target.value); setAdimeUseAutoTime(false); }}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Jam :</span>
                    <input
                      type="time"
                      value={adimeJam}
                      onChange={(e) => { setAdimeJam(e.target.value); setAdimeUseAutoTime(false); }}
                      step="1"
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                    />
                    <input
                      type="checkbox"
                      checked={adimeUseAutoTime}
                      onChange={(e) => setAdimeUseAutoTime(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                      title="Gunakan waktu saat ini"
                    />
                  </div>

                  {/* Petugas Gizi */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>Petugas :</span>
                    <div style={{ display: 'flex', gap: 6, flex: 1, position: 'relative' }}>
                      <input
                        type="text"
                        value={adimePetugasNama}
                        readOnly
                        placeholder="Nama petugas"
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }}
                      />
                      <button
                        type="button"
                        onClick={() => setAdimePetugasOpen(true)}
                        style={{ padding: '2px 2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Cari petugas"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <ModalCariPetugas
                  isOpen={adimePetugasOpen}
                  onClose={() => setAdimePetugasOpen(false)}
                  onSelect={(nip, nama) => { setAdimeNip(nip); setAdimePetugasNama(nama); }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>

                  {[
                    { key: 'asesmen',    label: 'Asesmen Gizi',   badge: 'A', color: '#2563eb', placeholder: 'Antropometri, biokimia, klinis, riwayat diet...' },
                    { key: 'diagnosis',  label: 'Diagnosis Gizi', badge: 'D', color: '#dc2626', placeholder: 'Problem (P) berkaitan dengan (BE) ditandai dengan (S)...' },
                    { key: 'intervensi', label: 'Intervensi Gizi',badge: 'I', color: '#10b981', placeholder: 'Preskripsi diet, edukasi, koordinasi asuhan gizi...' },
                    { key: 'monitoring', label: 'Monitoring',     badge: 'M', color: '#f59e0b', placeholder: 'Indikator yang dipantau...' },
                    { key: 'evaluasi',   label: 'Evaluasi',       badge: 'E', color: '#8b5cf6', placeholder: 'Hasil evaluasi intervensi gizi...' },
                    { key: 'instruksi',  label: 'Instruksi',      badge: 'I', color: '#ec4899', placeholder: 'Instruksi lanjutan...' },
                  ].map(({ key, label, badge, color, placeholder }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ background: color, color: '#fff', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{badge}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
                      </div>
                      <textarea
                        rows={4}
                        value={(adime as any)[key]}
                        onChange={(e) => setAdime((prev) => ({ ...prev, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
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
                    style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: savingAdime ? '#9ca3af' : '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: savingAdime ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                    </svg>
                    {savingAdime ? 'Menyimpan...' : editingAdime ? 'Update ADIME' : 'Simpan ADIME'}
                  </button>
                  {editingAdime && (
                    <button
                      onClick={() => { setAdime({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' }); setAdimeNip(''); setAdimePetugasNama('');  setEditingAdime(null); }}
                      style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setAdime({ asesmen: '', diagnosis: '', intervensi: '', monitoring: '', evaluasi: '', instruksi: '' }); setAdimeNip(''); setAdimePetugasNama('');  }}
                    style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#6b7280', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    Clear
                  </button>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowRiwayatModal(true)}
                      style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #10b981', background: '#fff', color: '#10b981', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                      </svg>
                      Riwayat Perawatan
                    </button>
                    <button
                      onClick={() => setShowSoapInAdime((v) => !v)}
                      style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #1AB1E5', background: showSoapInAdime ? '#1AB1E5' : '#fff', color: showSoapInAdime ? '#fff' : '#1AB1E5', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                      </svg>
                      {showSoapInAdime ? 'Sembunyikan SOAP/CPPT' : 'Tampilkan SOAP/CPPT'}
                    </button>
                  </div>
                </div>

                {/* Riwayat ADIME */}
                {adimeHistory.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Riwayat ADIME Gizi</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {adimeHistory.map((item, idx) => (
                        <div key={idx} style={{ borderRadius: 8, border: '1px solid #e5e7eb', padding: 14, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{item.tanggal}</span>
                              {item.nama_petugas && (
                                <span style={{ fontSize: 11, background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{item.nama_petugas}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => {
                                  setAdime({ asesmen: item.asesmen, diagnosis: item.diagnosis, intervensi: item.intervensi, monitoring: item.monitoring, evaluasi: item.evaluasi, instruksi: item.instruksi });
                                  setAdimeNip(item.nip || ''); setAdimePetugasNama(item.nama_petugas || '');
                                  setEditingAdime(item.tanggal);
                                }}
                                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
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
                                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 8 }}>
                            {[['A — Asesmen', item.asesmen, '#2563eb'], ['D — Diagnosis', item.diagnosis, '#dc2626'], ['I — Intervensi', item.intervensi, '#10b981'], ['M — Monitoring', item.monitoring, '#f59e0b'], ['E — Evaluasi', item.evaluasi, '#8b5cf6'], ['I — Instruksi', item.instruksi, '#ec4899']].filter(([, v]) => v).map(([label, val, color]) => (
                              <div key={label as string}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: color as string, marginBottom: 2 }}>{label as string}</div>
                                <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{val as string}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── Resume Tab ── */}
            {activeTab === 'resume' && <ResumeTab patient={patient} />}

          </div>
        </div>
      </div>

      {/* SOAP/CPPT fixed right panel — visible on ADIME tab */}
      {activeTab === 'adime' && showSoapInAdime && (
        <div style={{
          position: 'fixed', top: 120,
          right: isCompact ? 12 : 20,
          left: isCompact ? 12 : undefined,
          width: isCompact ? 'auto' : 300, height: 'calc(100vh - 160px)',
          background: '#ffffff', borderRadius: 12,
          border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)',
            padding: '10px 16px', borderRadius: '12px 12px 0 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>SOAP / CPPT</span>
            <button onClick={() => setShowSoapInAdime(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: 16, lineHeight: 1 }}>
              ×
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {soapHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingTop: 40 }}>Belum ada data SOAP/CPPT.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {soapHistory.map((item, idx) => (
                  <div key={idx} style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    {/* Entry header */}
                    <div style={{ background: '#f9fafb', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                        {formatDateTime(item.tgl_perawatan || '', item.jam_rawat || '')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.nama && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>{item.nama}</span>}
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
                          style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 5, cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', color: '#0369a1' }}
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
                          <div key={lbl as string}><span style={{ color: '#9ca3af' }}>{lbl}:</span> <span style={{ fontWeight: 600, color: '#374151' }}>{val}</span></div>
                        ) : null)}
                      </div>
                      {item.alergi && (
                        <div style={{ marginTop: 4, padding: '3px 6px', background: '#fef2f2', borderRadius: 4, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fecaca', padding: '1px 4px', borderRadius: 3 }}>ALERGI</span>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{item.alergi}</span>
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
                            <span style={{ background: color as string, color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{badge}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: color as string }}>{label}</span>
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
      )}

      {/* Modals */}
      {showResepModal && (
        <ResepModal
          patient={patient}
          onClose={() => { setShowResepModal(false); setEditingResep(null); }}
          onResepSaved={() => { fetchRiwayatResep(); }}
          isRanap={true}
          editResep={editingResep || undefined}
        />
      )}
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
