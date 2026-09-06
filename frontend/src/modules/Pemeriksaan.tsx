import React from 'react';
import Swal from 'sweetalert2';
import { ResepTab } from '../components/ResepTab';
import { RiwayatModal } from '../components/RiwayatModal';
import { RiwayatSoapieModal } from '../components/RiwayatSoapieModal';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { UploadTab } from '../components/UploadTab';
import { RujukanInternalModal } from '../components/RujukanInternalModal';
import { IcareRiwayatModal } from '../components/IcareRiwayatModal';
import { TindakanTab } from '../components/TindakanTab';
import { DiagnosaTab } from '../components/DiagnosaTab';
import { CatatanDokterTab } from '../components/CatatanDokterTab';
import { renderSoapCpptTable } from '../utils/soapCpptIgdDisplay';

type SoapViewProps = {
  patient: any;
  onBack: () => void;
};

// Helper component for info items
const InfoItem: React.FC<{ label: string; value: string; icon?: React.ReactNode; highlight?: boolean; multiline?: boolean; bold?: boolean; valueColor?: string }> = ({ label, value, icon, highlight, multiline, bold, valueColor }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: multiline ? 'flex-start' : 'center' }}>
    {icon && (
      <div style={{ 
        color: '#6b7280', 
        display: 'flex', 
        alignItems: 'center', 
        flexShrink: 0,
        marginTop: multiline ? 2 : 0
      }}>
        {icon}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        color: valueColor || (highlight ? '#1AB1E5' : '#111827'),
        fontWeight: bold === false ? 400 : highlight ? 600 : 400,
        lineHeight: multiline ? 1.5 : 1.4,
        wordBreak: 'break-word'
      }}>
        {value}
      </div>
    </div>
  </div>
);

// Lebar sidebar kiri (Informasi Pasien) & card kanan (Kunjungan Terakhir)
// dibuat responsif pakai clamp(min, vw, max) — dulu fixed px (280/300)
// yang kelihatan kecil sekali di monitor 24"/27" karena form tengah
// (flex:1) menyerap semua sisa lebar layar. vw dipilih supaya kedua
// panel ikut melebar proporsional di layar besar, tapi tidak menyusut
// di bawah batas minimum di layar kecil/laptop.
const SIDEBAR_WIDTH = 'clamp(280px, 16vw, 380px)';

// ── Tab SOAP/CPPT — style & komponen PERSIS SoapCpptFormIGD.tsx/
// soapCpptIgdDisplay.tsx (PemeriksaanIGD.tsx), per permintaan user
// "redesign total mengikuti desain SOAP/CPPT IGD": panel flat putih,
// label 12px, kolom 30px, tanpa card/shadow. Enum Kesadaran PERSIS kolom
// pemeriksaan_ralan.kesadaran (tabel yg sama dipakai IGD, lihat komentar
// KESADARAN_OPTIONS di SoapCpptFormIGD.tsx).
const KESADARAN_OPTIONS = ['Compos Mentis', 'Apatis', 'Somnolence', 'Sopor', 'Coma', 'Alert', 'Confusion', 'Voice', 'Pain', 'Unresponsive', 'Delirium', 'Meninggal'];

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

// soapActionBtn — style tombol aksi baris bawah form (Simpan/Clear/
// SOAPIE/Riwayat Perawatan/Rujuk/ICare/Selesai), radius 0 fontSize 12
// PERSIS tombol Simpan SoapCpptFormIGD.tsx — ganti dari versi lama
// (radius 4, fontSize 13 bold, shadow card pembungkus).
const soapActionBtn = (bg: string, disabled?: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 0, border: 'none',
  background: disabled ? '#9ca3af' : bg, color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 400,
  display: 'flex', alignItems: 'center', gap: 6,
});

const SoapStepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

// SoapAutoField — textarea/input + dropdown saran dari riwayat
// localStorage (fitur lama Poli yg dipertahankan, cuma dibungkus ulang
// biar tidak dobel ~50 baris JSX per field x 12 field). Logic filter/
// simpan riwayat TETAP di komponen induk (filterX/saveXToHistory) —
// field ini cuma terima hasilnya lewat props, tidak generalisir logic-nya.
const SoapAutoField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocusFilter: () => void;
  show: boolean;
  setShow: (v: boolean) => void;
  filtered: string[];
  onPick: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  minHeight?: number;
}> = ({ label, value, onChange, onFocusFilter, show, setShow, filtered, onPick, multiline, required, maxLength, placeholder, minHeight }) => (
  <div style={{ position: 'relative' }}>
    <label style={soapLabelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { onFocusFilter(); setShow(true); handleSoapFieldFocus(e); }}
        onBlur={(e) => { setTimeout(() => setShow(false), 200); handleSoapFieldBlur(e); }}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        style={{ ...soapTextareaStyle, minHeight: minHeight ?? 64 }}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { onFocusFilter(); setShow(true); handleSoapFieldFocus(e); }}
        onBlur={(e) => { setTimeout(() => setShow(false), 200); handleSoapFieldBlur(e); }}
        maxLength={maxLength}
        placeholder={placeholder}
        style={soapInputStyle}
      />
    )}
    {show && filtered.length > 0 && (
      <div style={{ position: 'absolute', top: '100%', right: 0, width: '80%', marginTop: 4, background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', zIndex: 1000 }}>
        {filtered.map((item, i) => (
          <div
            key={i}
            onMouseDown={() => onPick(item)}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < filtered.length - 1 ? '1px solid #e5e7eb' : 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            {item}
          </div>
        ))}
      </div>
    )}
  </div>
);

export const PemeriksaanView: React.FC<SoapViewProps> = ({ patient, onBack }) => {
  const [activeTab, setActiveTab] = React.useState<'soap' | 'resep' | 'lab' | 'rad' | 'tindakan' | 'diagnosa' | 'catatan_dokter' | 'upload'>('soap');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any>(null); // Menyimpan item yang sedang diedit
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [soapHistory, setSoapHistory] = React.useState<any[]>([]);
  const [lastSoapie, setLastSoapie] = React.useState<any>(null); // Riwayat SOAPIE terakhir (card sidebar 30%)
  const [loadingLastSoapie, setLoadingLastSoapie] = React.useState(false);
  // Tab Resep sekarang pakai komponen ResepTab.tsx (self-contained, SAMA
  // persis dipakai PemeriksaanIGD.tsx) — resepOpenSignal dinaikkan dari
  // handleSubmit saat user klik "Lanjutkan Input Resep" di dialog sukses
  // simpan SOAP, ResepTab otomatis buka modal input begitu signal berubah.
  const [resepOpenSignal, setResepOpenSignal] = React.useState(0);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  const [showRiwayatSoapieModal, setShowRiwayatSoapieModal] = React.useState(false);
  const [showRujukanInternalModal, setShowRujukanInternalModal] = React.useState(false);
  const [showIcareModal, setShowIcareModal] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null); // Ref untuk form input
  const [patientData, setPatientData] = React.useState<any>(patient); // State untuk data pasien lengkap
  // showIdCard — modal Kartu Identitas Pasien, dibuka lewat klik avatar
  // svg user di sidebar.
  const [showIdCard, setShowIdCard] = React.useState(false);

  // History State untuk dropdown
  const [subjectiveHistory, setSubjectiveHistory] = React.useState<string[]>([]);
  const [objectiveHistory, setObjectiveHistory] = React.useState<string[]>([]);
  const [assessmentHistory, setAssessmentHistory] = React.useState<string[]>([]);
  const [planningHistory, setPlanningHistory] = React.useState<string[]>([]);
  const [instruksiHistory, setInstruksiHistory] = React.useState<string[]>([]);
  const [evaluasiHistory, setEvaluasiHistory] = React.useState<string[]>([]);
  
  // Vital Signs History State
  const [tensiHistory, setTensiHistory] = React.useState<string[]>([]);
  const [suhuHistory, setSuhuHistory] = React.useState<string[]>([]);
  const [nadiHistory, setNadiHistory] = React.useState<string[]>([]);
  const [respirasiHistory, setRespirasiHistory] = React.useState<string[]>([]);
  const [tinggiHistory, setTinggiHistory] = React.useState<string[]>([]);
  const [beratHistory, setBeratHistory] = React.useState<string[]>([]);
  
  // Dropdown visibility state
  const [showSubjectiveDropdown, setShowSubjectiveDropdown] = React.useState(false);
  const [showObjectiveDropdown, setShowObjectiveDropdown] = React.useState(false);
  const [showAssessmentDropdown, setShowAssessmentDropdown] = React.useState(false);
  const [showPlanningDropdown, setShowPlanningDropdown] = React.useState(false);
  const [showInstruksiDropdown, setShowInstruksiDropdown] = React.useState(false);
  const [showEvaluasiDropdown, setShowEvaluasiDropdown] = React.useState(false);
  
  // Vital Signs Dropdown visibility state
  const [showTensiDropdown, setShowTensiDropdown] = React.useState(false);
  const [showSuhuDropdown, setShowSuhuDropdown] = React.useState(false);
  const [showNadiDropdown, setShowNadiDropdown] = React.useState(false);
  const [showRespirasiDropdown, setShowRespirasiDropdown] = React.useState(false);
  const [showTinggiDropdown, setShowTinggiDropdown] = React.useState(false);
  const [showBeratDropdown, setShowBeratDropdown] = React.useState(false);
  
  // Filtered history state
  const [filteredSubjective, setFilteredSubjective] = React.useState<string[]>([]);
  const [filteredObjective, setFilteredObjective] = React.useState<string[]>([]);
  const [filteredAssessment, setFilteredAssessment] = React.useState<string[]>([]);
  const [filteredPlanning, setFilteredPlanning] = React.useState<string[]>([]);
  const [filteredInstruksi, setFilteredInstruksi] = React.useState<string[]>([]);
  const [filteredEvaluasi, setFilteredEvaluasi] = React.useState<string[]>([]);
  
  // Filtered Vital Signs history state
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
    // spo2/alergi/lingkarPerut — BARU (dulu selalu dikirim '' krn belum ada
    // input-nya), ditambahkan supaya field-nya PERSIS SoapCpptFormIGD.tsx.
    spo2: '',
    alergi: '',
    lingkarPerut: '',
  });

  // Load history from localStorage on mount
  React.useEffect(() => {
    // Load Subjective History
    const savedSubjective = localStorage.getItem('subjective_history');
    if (savedSubjective) {
      try {
        setSubjectiveHistory(JSON.parse(savedSubjective));
      } catch (e) {
        console.error('Failed to parse subjective history:', e);
      }
    }

    // Load Objective History
    const savedObjective = localStorage.getItem('objective_history');
    if (savedObjective) {
      try {
        setObjectiveHistory(JSON.parse(savedObjective));
      } catch (e) {
        console.error('Failed to parse objective history:', e);
      }
    }

    // Load Assessment History
    const savedAssessment = localStorage.getItem('assessment_history');
    if (savedAssessment) {
      try {
        setAssessmentHistory(JSON.parse(savedAssessment));
      } catch (e) {
        console.error('Failed to parse assessment history:', e);
      }
    }

    // Load Planning History
    const savedPlanning = localStorage.getItem('planning_history');
    if (savedPlanning) {
      try {
        setPlanningHistory(JSON.parse(savedPlanning));
      } catch (e) {
        console.error('Failed to parse planning history:', e);
      }
    }

    // Load Instruksi History
    const savedInstruksi = localStorage.getItem('instruksi_history');
    if (savedInstruksi) {
      try {
        setInstruksiHistory(JSON.parse(savedInstruksi));
      } catch (e) {
        console.error('Failed to parse instruksi history:', e);
      }
    }

    // Load Evaluasi History
    const savedEvaluasi = localStorage.getItem('evaluasi_history');
    if (savedEvaluasi) {
      try {
        setEvaluasiHistory(JSON.parse(savedEvaluasi));
      } catch (e) {
        console.error('Failed to parse evaluasi history:', e);
      }
    }

    // Load Vital Signs History
    const savedTensi = localStorage.getItem('tensi_history');
    if (savedTensi) {
      try {
        setTensiHistory(JSON.parse(savedTensi));
      } catch (e) {
        console.error('Failed to parse tensi history:', e);
      }
    }

    const savedSuhu = localStorage.getItem('suhu_history');
    if (savedSuhu) {
      try {
        setSuhuHistory(JSON.parse(savedSuhu));
      } catch (e) {
        console.error('Failed to parse suhu history:', e);
      }
    }

    const savedNadi = localStorage.getItem('nadi_history');
    if (savedNadi) {
      try {
        setNadiHistory(JSON.parse(savedNadi));
      } catch (e) {
        console.error('Failed to parse nadi history:', e);
      }
    }

    const savedRespirasi = localStorage.getItem('respirasi_history');
    if (savedRespirasi) {
      try {
        setRespirasiHistory(JSON.parse(savedRespirasi));
      } catch (e) {
        console.error('Failed to parse respirasi history:', e);
      }
    }

    const savedTinggi = localStorage.getItem('tinggi_history');
    if (savedTinggi) {
      try {
        setTinggiHistory(JSON.parse(savedTinggi));
      } catch (e) {
        console.error('Failed to parse tinggi history:', e);
      }
    }

    const savedBerat = localStorage.getItem('berat_history');
    if (savedBerat) {
      try {
        setBeratHistory(JSON.parse(savedBerat));
      } catch (e) {
        console.error('Failed to parse berat history:', e);
      }
    }
  }, []);

  // Fetch patient complete data if not available
  React.useEffect(() => {
    const fetchPatientCompleteData = async () => {
      // Check if we already have complete patient data
      if (patient.agama || patient.gol_darah || patient.tmp_lahir) {
        setPatientData(patient);
        return;
      }

      // Fetch complete patient data
      if (patient.no_rkm_medis) {
        try {
          const res = await fetch(`/api/pendaftaran/pasien/${encodeURIComponent(patient.no_rkm_medis)}`);
          if (res.ok) {
            const completeData = await res.json();
            // Merge with existing patient data
            setPatientData({ ...patient, ...completeData });
          }
        } catch (e) {
          console.error('Failed to fetch complete patient data:', e);
          setPatientData(patient);
        }
      } else {
        setPatientData(patient);
      }
    };

    void fetchPatientCompleteData();
  }, [patient]);

  // Fetch SOAP History
  React.useEffect(() => {
    fetchSoapHistory();
  }, [patient.no_rawat]);

  // GET /api/pemeriksaan-ralan/{no_rawat} — endpoint GENERIK yg sama dipakai
  // PemeriksaanIGD.tsx (SoapCpptDisplay), beda dari /api/pemeriksaan/soap-
  // history/{no_rawat} yg dipakai versi lama krn endpoint itu TIDAK join
  // nama/jbtn petugas (dibutuhkan utk kolom "Dokter/Paramedis"/"Profesi/
  // Jabatan/Departemen" di renderSoapCpptTable). Per permintaan user
  // "redesign total ikut desain SOAP/CPPT IGD".
  const fetchSoapHistory = async () => {
    try {
      const encodedNoRawat = encodeURIComponent(patient.no_rawat);
      const response = await fetch(`/api/pemeriksaan-ralan/${encodedNoRawat}`);
      if (!response.ok) throw new Error('Failed to fetch SOAP history');
      const data = await response.json();

      setSoapHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching SOAP history:', err);
      setSoapHistory([]);
    }
  };

  // Fetch Last SOAPIE — dipakai card sidebar 30% "Kunjungan Terakhir"
  // (dikembalikan per permintaan user, sisi 30% yg tersisa dari form 70%).
  const fetchLastSoapie = async () => {
    setLoadingLastSoapie(true);
    try {
      const response = await fetch(`/api/pemeriksaan/riwayat-soapie/${encodeURIComponent(patient.no_rkm_medis)}?filter=last5`);
      if (!response.ok) throw new Error('Failed to fetch SOAPIE history');
      const data = await response.json();

      // Data struktur: [{no_reg, no_rawat, tgl_registrasi, soapie: [...]}, ...]
      // Cari SOAPIE terakhir dari kunjungan SEBELUM hari ini (SOAP hari ini
      // ditampilkan terpisah di riwayat tersimpan, supaya bisa dibandingkan)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const toDateStr = (tgl: string) => {
        if (!tgl) return '';
        if (tgl.includes('T')) return tgl.split('T')[0];
        if (tgl.match(/^\d{4}-\d{2}-\d{2}$/)) return tgl;
        if (tgl.includes('/')) {
          const [d, m, y] = tgl.split('/');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return '';
      };

      let latestSoapie = null;

      if (Array.isArray(data) && data.length > 0) {
        // Iterasi semua registrasi dan ambil semua soapie sebelum hari ini
        for (const reg of data) {
          if (reg.soapie && Array.isArray(reg.soapie) && reg.soapie.length > 0) {
            // Ambil soapie terakhir dari registrasi ini yang bukan hari ini
            const soapieSebelumHariIni = reg.soapie.filter((s: any) => toDateStr(s.tgl_perawatan) !== todayStr);
            if (soapieSebelumHariIni.length === 0) continue;
            const lastFromReg = soapieSebelumHariIni[soapieSebelumHariIni.length - 1];

            // Jika ini soapie pertama atau lebih baru dari yang sudah ada
            if (!latestSoapie) {
              latestSoapie = lastFromReg;
            } else {
              // Bandingkan tanggal
              const currentDate = new Date(latestSoapie.tgl_perawatan);
              const newDate = new Date(lastFromReg.tgl_perawatan);

              if (newDate > currentDate) {
                latestSoapie = lastFromReg;
              }
            }
          }
        }
      }

      setLastSoapie(latestSoapie);
    } catch (err) {
      console.error('Error fetching last SOAPIE:', err);
      setLastSoapie(null);
    } finally {
      setLoadingLastSoapie(false);
    }
  };

  // Load last SOAPIE saat tab soap aktif
  React.useEffect(() => {
    if (activeTab === 'soap') {
      fetchLastSoapie();
    }
  }, [activeTab, patient.no_rkm_medis]);

  // Save to history functions
  const saveSubjectiveToHistory = (subjective: string) => {
    if (!subjective.trim()) return;
    const trimmed = subjective.trim();
    let newHistory = [...subjectiveHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setSubjectiveHistory(newHistory);
    localStorage.setItem('subjective_history', JSON.stringify(newHistory));
  };

  const saveObjectiveToHistory = (objective: string) => {
    if (!objective.trim()) return;
    const trimmed = objective.trim();
    let newHistory = [...objectiveHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setObjectiveHistory(newHistory);
    localStorage.setItem('objective_history', JSON.stringify(newHistory));
  };

  const saveAssessmentToHistory = (assessment: string) => {
    if (!assessment.trim()) return;
    const trimmed = assessment.trim();
    let newHistory = [...assessmentHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setAssessmentHistory(newHistory);
    localStorage.setItem('assessment_history', JSON.stringify(newHistory));
  };

  const savePlanningToHistory = (planning: string) => {
    if (!planning.trim()) return;
    const trimmed = planning.trim();
    let newHistory = [...planningHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setPlanningHistory(newHistory);
    localStorage.setItem('planning_history', JSON.stringify(newHistory));
  };

  const saveInstruksiToHistory = (instruksi: string) => {
    if (!instruksi.trim()) return;
    const trimmed = instruksi.trim();
    let newHistory = [...instruksiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setInstruksiHistory(newHistory);
    localStorage.setItem('instruksi_history', JSON.stringify(newHistory));
  };

  const saveEvaluasiToHistory = (evaluasi: string) => {
    if (!evaluasi.trim()) return;
    const trimmed = evaluasi.trim();
    let newHistory = [...evaluasiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setEvaluasiHistory(newHistory);
    localStorage.setItem('evaluasi_history', JSON.stringify(newHistory));
  };

  // Save Vital Signs to history functions
  const saveTensiToHistory = (tensi: string) => {
    if (!tensi.trim()) return;
    const trimmed = tensi.trim();
    let newHistory = [...tensiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setTensiHistory(newHistory);
    localStorage.setItem('tensi_history', JSON.stringify(newHistory));
  };

  const saveSuhuToHistory = (suhu: string) => {
    if (!suhu.trim()) return;
    const trimmed = suhu.trim();
    let newHistory = [...suhuHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setSuhuHistory(newHistory);
    localStorage.setItem('suhu_history', JSON.stringify(newHistory));
  };

  const saveNadiToHistory = (nadi: string) => {
    if (!nadi.trim()) return;
    const trimmed = nadi.trim();
    let newHistory = [...nadiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setNadiHistory(newHistory);
    localStorage.setItem('nadi_history', JSON.stringify(newHistory));
  };

  const saveRespirasiToHistory = (respirasi: string) => {
    if (!respirasi.trim()) return;
    const trimmed = respirasi.trim();
    let newHistory = [...respirasiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setRespirasiHistory(newHistory);
    localStorage.setItem('respirasi_history', JSON.stringify(newHistory));
  };

  const saveTinggiToHistory = (tinggi: string) => {
    if (!tinggi.trim()) return;
    const trimmed = tinggi.trim();
    let newHistory = [...tinggiHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setTinggiHistory(newHistory);
    localStorage.setItem('tinggi_history', JSON.stringify(newHistory));
  };

  const saveBeratToHistory = (berat: string) => {
    if (!berat.trim()) return;
    const trimmed = berat.trim();
    let newHistory = [...beratHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setBeratHistory(newHistory);
    localStorage.setItem('berat_history', JSON.stringify(newHistory));
  };

  // Filter history functions with smart prioritization
  const filterSubjective = (input: string) => {
    if (!input.trim()) {
      setFilteredSubjective(subjectiveHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    subjectiveHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredSubjective([...startsWith, ...contains].slice(0, 10));
  };

  const filterObjective = (input: string) => {
    if (!input.trim()) {
      setFilteredObjective(objectiveHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    objectiveHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredObjective([...startsWith, ...contains].slice(0, 10));
  };

  const filterAssessment = (input: string) => {
    if (!input.trim()) {
      setFilteredAssessment(assessmentHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    assessmentHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredAssessment([...startsWith, ...contains].slice(0, 10));
  };

  const filterPlanning = (input: string) => {
    if (!input.trim()) {
      setFilteredPlanning(planningHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    planningHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredPlanning([...startsWith, ...contains].slice(0, 10));
  };

  const filterInstruksi = (input: string) => {
    if (!input.trim()) {
      setFilteredInstruksi(instruksiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    instruksiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredInstruksi([...startsWith, ...contains].slice(0, 10));
  };

  const filterEvaluasi = (input: string) => {
    if (!input.trim()) {
      setFilteredEvaluasi(evaluasiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    evaluasiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredEvaluasi([...startsWith, ...contains].slice(0, 10));
  };

  // Filter Vital Signs history functions
  const filterTensi = (input: string) => {
    if (!input.trim()) {
      setFilteredTensi(tensiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    tensiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredTensi([...startsWith, ...contains].slice(0, 10));
  };

  const filterSuhu = (input: string) => {
    if (!input.trim()) {
      setFilteredSuhu(suhuHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    suhuHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredSuhu([...startsWith, ...contains].slice(0, 10));
  };

  const filterNadi = (input: string) => {
    if (!input.trim()) {
      setFilteredNadi(nadiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    nadiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredNadi([...startsWith, ...contains].slice(0, 10));
  };

  const filterRespirasi = (input: string) => {
    if (!input.trim()) {
      setFilteredRespirasi(respirasiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    respirasiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredRespirasi([...startsWith, ...contains].slice(0, 10));
  };

  const filterTinggi = (input: string) => {
    if (!input.trim()) {
      setFilteredTinggi(tinggiHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    tinggiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredTinggi([...startsWith, ...contains].slice(0, 10));
  };

  const filterBerat = (input: string) => {
    if (!input.trim()) {
      setFilteredBerat(beratHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    beratHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredBerat([...startsWith, ...contains].slice(0, 10));
  };

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Filter history saat user mengetik
    if (field === 'subjective') {
      filterSubjective(value);
    } else if (field === 'objective') {
      filterObjective(value);
    } else if (field === 'assessment') {
      filterAssessment(value);
    } else if (field === 'planning') {
      filterPlanning(value);
    } else if (field === 'instruksi') {
      filterInstruksi(value);
    } else if (field === 'evaluasi') {
      filterEvaluasi(value);
    } else if (field === 'tensi') {
      filterTensi(value);
    } else if (field === 'suhu') {
      filterSuhu(value);
    } else if (field === 'nadi') {
      filterNadi(value);
    } else if (field === 'respirasi') {
      filterRespirasi(value);
    } else if (field === 'tinggi') {
      filterTinggi(value);
    } else if (field === 'berat') {
      filterBerat(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let tglPerawatan: string;
      let jamRawat: string;

      // Jika mode edit, gunakan tanggal dan jam dari item yang sedang diedit
      if (isEditMode && editingItem) {
        // Konversi format tanggal jika perlu
        if (editingItem.tgl_perawatan && editingItem.tgl_perawatan.includes('T')) {
          tglPerawatan = editingItem.tgl_perawatan.split('T')[0];
        } else if (editingItem.tgl_perawatan && editingItem.tgl_perawatan.includes('/')) {
          const [day, month, year] = editingItem.tgl_perawatan.split('/');
          tglPerawatan = `${year}-${month}-${day}`;
        } else {
          tglPerawatan = editingItem.tgl_perawatan;
        }

        // Pastikan jam dalam format HH:MM:SS
        if (editingItem.jam_rawat && editingItem.jam_rawat.length === 5) {
          jamRawat = `${editingItem.jam_rawat}:00`;
        } else {
          jamRawat = editingItem.jam_rawat || '00:00:00';
        }
      } else {
        // Mode baru: gunakan tanggal dan jam sekarang (local timezone)
        const now = new Date();

        // Format date as YYYY-MM-DD
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        tglPerawatan = `${year}-${month}-${day}`;

        // Format time as HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        jamRawat = `${hours}:${minutes}:${seconds}`;
      }

      // Prepare payload
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
        nip: patient.kd_dokter // Use kd_dokter from patient data as NIP
      };

      // Pilih method dan endpoint berdasarkan mode
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await fetch('/api/pemeriksaan/soap', {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isEditMode ? 'Gagal mengupdate SOAP' : 'Gagal menyimpan SOAP'));
      }

      // Update status pasien menjadi "Sudah" setelah berhasil simpan SOAP
      try {
        const updateStatusResponse = await fetch(`/api/pendaftaran/update-status/${patient.no_rawat}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!updateStatusResponse.ok) {
          console.error('Gagal update status pasien, tapi SOAP sudah tersimpan');
        }
      } catch (statusErr) {
        console.error('Error saat update status:', statusErr);
        // Continue execution meskipun update status gagal
      }

      // Save to history setelah berhasil submit
      if (form.subjective.trim()) {
        saveSubjectiveToHistory(form.subjective);
      }
      if (form.objective.trim()) {
        saveObjectiveToHistory(form.objective);
      }
      if (form.assessment.trim()) {
        saveAssessmentToHistory(form.assessment);
      }
      if (form.planning.trim()) {
        savePlanningToHistory(form.planning);
      }
      if (form.instruksi.trim()) {
        saveInstruksiToHistory(form.instruksi);
      }
      if (form.evaluasi.trim()) {
        saveEvaluasiToHistory(form.evaluasi);
      }
      // Save Vital Signs to history
      if (form.tensi.trim()) {
        saveTensiToHistory(form.tensi);
      }
      if (form.suhu.trim()) {
        saveSuhuToHistory(form.suhu);
      }
      if (form.nadi.trim()) {
        saveNadiToHistory(form.nadi);
      }
      if (form.respirasi.trim()) {
        saveRespirasiToHistory(form.respirasi);
      }
      if (form.tinggi.trim()) {
        saveTinggiToHistory(form.tinggi);
      }
      if (form.berat.trim()) {
        saveBeratToHistory(form.berat);
      }

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
            btn.style.borderRadius = '0';
          });
        },
      });

      // Reset form and refresh history
      clearForm();
      fetchSoapHistory();

      // Jika user klik "Input Resep" — pindah ke tab Resep + naikkan
      // resepOpenSignal (ResepTab.tsx otomatis buka modal input begitu
      // signal berubah), PERSIS alur "Lanjutkan Input Resep" di
      // PemeriksaanIGD.tsx (bukan langsung buka ResepModal sendiri lagi).
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
    setForm({
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
      spo2: '',
      alergi: '',
      lingkarPerut: '',
    });
    setIsEditMode(false);
    setEditingItem(null);
    setError('');
  };

  const editSOAP = (item: any) => {
    setForm({
      subjective: item.keluhan || '',
      objective: item.pemeriksaan || '',
      assessment: item.penilaian || '',
      planning: item.rtl || '',
      evaluasi: item.evaluasi || '',
      instruksi: item.instruksi || '',
      tensi: item.tensi || '',
      suhu: item.suhu_tubuh || '',
      nadi: item.nadi || '',
      respirasi: item.respirasi || '',
      tinggi: item.tinggi || '',
      berat: item.berat || '',
      gcs: item.gcs || '',
      kesadaran: item.kesadaran || 'Compos Mentis',
      spo2: item.spo2 || '',
      alergi: item.alergi || '',
      lingkarPerut: item.lingkar_perut || '',
    });
    setIsEditMode(true);
    setEditingItem(item); // Simpan item yang sedang diedit
    setActiveTab('soap'); // Pastikan tab SOAP aktif

    // Scroll ke form input dengan delay kecil untuk memastikan state sudah terupdate
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const copySoapieToForm = (soapieData: any) => {
    // Copy data SOAPIE ke form (mode input baru, bukan edit)
    setForm({
      subjective: soapieData.keluhan || '',
      objective: soapieData.pemeriksaan || '',
      assessment: soapieData.penilaian || '',
      planning: soapieData.rtl || '',
      evaluasi: soapieData.evaluasi || '',
      instruksi: soapieData.instruksi || '',
      tensi: soapieData.tensi || '',
      suhu: soapieData.suhu_tubuh || '',
      nadi: soapieData.nadi || '',
      respirasi: soapieData.respirasi || '',
      tinggi: soapieData.tinggi || '',
      berat: soapieData.berat || '',
      gcs: soapieData.gcs || '',
      kesadaran: soapieData.kesadaran || 'Compos Mentis',
      spo2: soapieData.spo2 || '',
      alergi: soapieData.alergi || '',
      lingkarPerut: soapieData.lingkar_perut || '',
    });
    setIsEditMode(false); // Mode input baru, bukan edit
    setEditingItem(null);
    setActiveTab('soap'); // Pastikan tab SOAP aktif

    // Scroll ke form input
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    // Tampilkan notifikasi sukses
    Swal.fire({
      icon: 'success',
      title: 'Berhasil!',
      text: 'Data SOAPIE berhasil di-copy ke form pemeriksaan',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const deleteSOAP = async (item: any) => {
    const result = await Swal.fire({
      title: 'Yakin ingin menghapus?',
      text: 'Data SOAP ini akan dihapus secara permanen',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      
      // Konversi format tanggal jika perlu (dari ISO 8601 ke YYYY-MM-DD)
      let tglPerawatan = item.tgl_perawatan;
      if (tglPerawatan && tglPerawatan.includes('T')) {
        // Format ISO 8601: ambil bagian tanggal saja
        tglPerawatan = tglPerawatan.split('T')[0];
      } else if (tglPerawatan && tglPerawatan.includes('/')) {
        // Format DD/MM/YYYY: convert ke YYYY-MM-DD
        const [day, month, year] = tglPerawatan.split('/');
        tglPerawatan = `${year}-${month}-${day}`;
      }
      
      // Pastikan jam dalam format HH:MM:SS
      let jamRawat = item.jam_rawat || '';
      if (jamRawat && jamRawat.length === 5) {
        // Format HH:MM, tambahkan :00
        jamRawat = `${jamRawat}:00`;
      } else if (!jamRawat || jamRawat.length === 0) {
        jamRawat = '00:00:00';
      }
      
      // Gunakan query parameter untuk menghindari masalah encoding URL —
      // no_rawat dari `patient` (bukan item.no_rawat), krn endpoint GET
      // /api/pemeriksaan-ralan/{no_rawat} yg dipakai sekarang tidak
      // menyertakan no_rawat per-baris (lihat komentar fetchSoapHistory).
      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        tgl_perawatan: tglPerawatan,
        jam_rawat: jamRawat
      });
      
      const response = await fetch(
        `/api/pemeriksaan/soap?${params.toString()}`,
        {
          method: 'DELETE',
        }
      );

      // Cek content type sebelum parse JSON
      const contentType = response.headers.get('content-type');
      let errorMessage = 'Gagal menghapus SOAP';
      
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (jsonErr) {
            // Jika gagal parse JSON, coba ambil text
            const textResponse = await response.text();
            errorMessage = textResponse || errorMessage;
          }
        } else {
          // Jika bukan JSON, ambil text response
          const textResponse = await response.text();
          errorMessage = textResponse || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse response jika sukses
      let responseData;
      if (contentType && contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch (jsonErr) {
          // Jika response sukses tapi bukan JSON, anggap berhasil
          responseData = { message: 'SOAP berhasil dihapus' };
        }
      }

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: responseData?.message || 'SOAP berhasil dihapus!',
        timer: 2000,
        showConfirmButton: false
      });
      fetchSoapHistory();
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Gagal menghapus SOAP'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string, time: string) => {
    let formattedDate = '';
    let formattedTime = '';
    
    // Handle ISO 8601 format (2025-12-01T00:00:00+07:00)
    if (date && date.includes('T')) {
      const datePart = date.split('T')[0]; // Ambil bagian tanggal saja
      const [year, month, day] = datePart.split('-');
      formattedDate = `${day}/${month}/${year}`;
      
      // Extract time from ISO format if time parameter is empty
      if (!time || time.length === 0) {
        const timePart = date.split('T')[1];
        if (timePart) {
          const timeOnly = timePart.split('+')[0].split('-')[0].split('Z')[0]; // Remove timezone
          formattedTime = timeOnly.length === 8 ? timeOnly : `${timeOnly}:00`.substring(0, 8);
        } else {
          formattedTime = '00:00:00';
        }
      } else {
        formattedTime = time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00');
      }
    } 
    // Handle YYYY-MM-DD format
    else if (date && date.includes('-') && date.length === 10) {
      const [year, month, day] = date.split('-');
      formattedDate = `${day}/${month}/${year}`;
      formattedTime = time && time.length > 0 
        ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
        : '00:00:00';
    }
    // Handle DD/MM/YYYY format (sudah benar)
    else if (date && date.includes('/')) {
      formattedDate = date;
      formattedTime = time && time.length > 0 
        ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
        : '00:00:00';
    }
    // Default fallback
    else {
      formattedDate = date || '';
      formattedTime = time && time.length > 0 
        ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
        : '00:00:00';
    }
    
    return `${formattedDate} ${formattedTime}`;
  };

  const handleKeluar = async () => {
    // Jika ada data di Rincian Riwayat (SOAP history), update status menjadi "Sudah"
    if (soapHistory && soapHistory.length > 0) {
      try {
        // Gunakan wildcard route, tidak perlu encode karena backend menggunakan *no_rawat
        const response = await fetch(`/api/pendaftaran/update-status/${patient.no_rawat}`, {
          method: 'PUT'
        });

        if (!response.ok) {
          // Cek content type sebelum parse JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              const errorData = await response.json();
              console.error('Error updating status:', errorData);
            } catch (jsonErr) {
              const textResponse = await response.text();
              console.error('Error updating status (text):', textResponse);
            }
          } else {
            const textResponse = await response.text();
            console.error('Error updating status (text):', textResponse);
          }
          // Tetap lanjutkan keluar meskipun update gagal
        } else {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              const result = await response.json();
              console.log('Status updated:', result);
            } catch (jsonErr) {
              console.log('Status updated (non-JSON response)');
            }
          } else {
            console.log('Status updated (non-JSON response)');
          }
        }
      } catch (err) {
        console.error('Error updating status:', err);
        // Tetap lanjutkan keluar meskipun update gagal
      }
    }

    // Keluar dari halaman pemeriksaan
    onBack();
  };

  return (
    <section
      style={{
        fontFamily: 'Tahoma, Geneva, sans-serif',
        fontSize: 14,
        background: '#f3f4f6',
        borderRadius: 0,
        padding: 0,
        height: '100%',
        display: 'flex',
        overflow: 'hidden'
      }}
    >
      {/* Sidebar - Info Pasien */}
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'auto',
          overscrollBehavior: 'none'
        }}
      >
        {/* Sidebar Header - Modern Design */}
        <div style={{
          padding: '20px 16px',
          background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' }}>
              Informasi Pasien
            </h3>
            <div style={{
              fontSize: 10,
              color: '#059669',
              background: '#ffffff',
              padding: '4px 10px',
              borderRadius: 12,
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {patientData.png_jawab || 'UMUM'}
            </div>
          </div>
          
          {/* Patient Avatar & Basic Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowIdCard(true)}
              title="Lihat Kartu Identitas Pasien"
              style={{
                width: 56,
                height: 56,
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                flexShrink: 0,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                  fill="white"
                />
                <path
                  d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z"
                  fill="white"
                />
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {patientData.nm_pasien || '-'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                {patientData.no_rkm_medis || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Content - Card Based Design */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f9fafb' }}>
          {/* Card: Identitas Diri */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Identitas Diri</h4>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <InfoItem 
                label="Jenis Kelamin"
                value={patientData.jk === 'L' ? 'Laki-laki' : patientData.jk === 'P' ? 'Perempuan' : patientData.jk || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M215.96008,23.20947c-.01111-.11377-.03271-.22412-.04858-.33642-.02063-.146-.038-.29248-.06677-.4375-.02588-.13086-.06214-.2583-.09449-.38721-.03112-.124-.05835-.24854-.09545-.37158-.03846-.12647-.08594-.24854-.13038-.37256-.04394-.12256-.08435-.24609-.13427-.3667-.04785-.11523-.104-.22559-.157-.33838-.05835-.124-.11364-.249-.17871-.3706-.05774-.10791-.12353-.21-.186-.31495-.07105-.11914-.13867-.24023-.21655-.35644-.07593-.11328-.16065-.22022-.242-.3291-.0747-.1001-.14429-.20264-.22436-.3003-.1521-.18505-.31372-.36181-.48169-.53271-.0166-.01709-.0304-.03564-.04712-.05225-.01929-.01953-.04077-.03515-.0603-.05468-.16846-.165-.34253-.32422-.525-.47413-.09424-.07763-.19372-.145-.29053-.21728-.1123-.084-.22229-.1709-.339-.249-.11242-.0752-.229-.14063-.34423-.20948-.10913-.06494-.21582-.1333-.32813-.19384-.115-.06153-.23328-.11329-.35058-.16895-.11963-.05664-.23755-.11621-.36036-.167-.11071-.0459-.22387-.08252-.33618-.123-.13415-.04883-.267-.09961-.40429-.1416-.1084-.03223-.21851-.05615-.32789-.084-.14331-.03663-.28515-.07666-.43151-.10547-.12085-.02393-.2428-.03711-.36451-.05567-.13659-.02051-.27136-.04541-.41-.05908-.2019-.01953-.40442-.02588-.60693-.03076C208.11768,16.00781,208.05981,16,208,16H168a8,8,0,0,0,0,16h20.686L164.2522,56.43359A67.97437,67.97437,0,1,0,112,175.51367V196H88a8,8,0,0,0,0,16h24v20a8,8,0,0,0,16,0V212h24a8,8,0,0,0,0-16H128V175.51367A67.9301,67.9301,0,0,0,175.09692,68.2168L200,43.314V64a8,8,0,0,0,16,0V24.00244C216,23.73779,215.98608,23.47314,215.96008,23.20947ZM120,160a52,52,0,1,1,52-52A52.059,52.059,0,0,1,120,160Z"></path></svg>}
              />
              <InfoItem 
                label="Tempat, Tanggal Lahir" 
                value={`${patientData.tmp_lahir ? `${patientData.tmp_lahir}, ` : ''}${patientData.tgl_lahir ? new Date(patientData.tgl_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}${patientData.umur ? ` (${patientData.umur})` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
              />
              <InfoItem 
                label="Golongan Darah" 
                value={patientData.gol_darah || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"></path></svg>}
                highlight={!!patientData.gol_darah}
              />
              <InfoItem
                label="Alamat"
                value={patientData.alamat || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>}
                multiline
              />
              <InfoItem
                label="Pendidikan"
                value={patientData.pnd || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>}
              />
              <InfoItem
                label="Nama Ibu Kandung"
                value={patientData.nm_ibu || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>}
              />
            </div>
          </div>

          {/* Card: Informasi Registrasi */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Registrasi</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem 
                label="No. Rawat"
                value={patient.no_rawat}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>}
                valueColor="#000000"
                bold={false}
              />
              <InfoItem 
                label="Tanggal & Jam" 
                value={`${patient.tgl_registrasi} | ${patient.jam_reg}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
              />
              <InfoItem 
                label="Poliklinik" 
                value={patient.nm_poli}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>}
              />
              <div style={{
                padding: '10px 12px',
                background: patient.stts === 'Sudah' ? '#d1fae5' : '#fee2e2',
                borderRadius: 8,
                border: `1px solid ${patient.stts === 'Sudah' ? '#a7f3d0' : '#fecaca'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={patient.stts === 'Sudah' ? '#059669' : '#dc2626'} strokeWidth="2.5">
                  {patient.stts === 'Sudah' ? (
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  ) : (
                    <circle cx="12" cy="12" r="10"></circle>
                  )}
                  {patient.stts === 'Sudah' && <polyline points="22 4 12 14.01 9 11.01"></polyline>}
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: patient.stts === 'Sudah' ? '#065f46' : '#991b1b', fontWeight: 600, marginBottom: 2 }}>Status Pemeriksaan</div>
                  <div style={{ fontSize: 12, color: patient.stts === 'Sudah' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {patient.stts === 'Sudah' ? '' : 'Belum Periksa'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#ffffff',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '52px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onClick={handleKeluar}
              title="Kembali ke halaman sebelumnya"
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"></path>
                <path d="M12 19l-7-7 7-7"></path>
              </svg>
            </button>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151', lineHeight: '20px' }}>Pemeriksaan Rawat Jalan</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* Dokter — dipindah dari sidebar ke navbar, sebelum tombol Kembali. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Dokter:</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.nm_dokter || '-'}</span>
            </div>
            <button
              onClick={handleKeluar}
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                border: '1px solid #1AB1E5',
                background: '#1AB1E5',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#0891B2';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#1AB1E5';
              }}
            >
              Kembali
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 24px',
            borderBottom: '2px solid #e5e7eb',
            background: '#ffffff',
            flexShrink: 0
          }}
        >
          <button
            onClick={() => setActiveTab('soap')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'soap' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'soap' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'soap' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            SOAP/CPPT
          </button>
          <button
            onClick={() => setActiveTab('resep')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'resep' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'resep' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'resep' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            RESEP
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'lab' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'lab' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'lab' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            LABORATORIUM
          </button>
          <button
            onClick={() => setActiveTab('rad')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'rad' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'rad' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'rad' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            RADIOLOGI
          </button>
          <button
            onClick={() => setActiveTab('tindakan')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'tindakan' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'tindakan' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'tindakan' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            TINDAKAN
          </button>
          <button
            onClick={() => setActiveTab('diagnosa')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'diagnosa' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'diagnosa' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'diagnosa' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            DIAGNOSA
          </button>
          <button
            onClick={() => setActiveTab('catatan_dokter')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'catatan_dokter' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'catatan_dokter' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'catatan_dokter' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            CATATAN DOKTER
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'upload' ? '#e0f2fe' : 'transparent',
              borderBottom: activeTab === 'upload' ? '3px solid #1AB1E5' : '3px solid transparent',
              color: activeTab === 'upload' ? '#1AB1E5' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              transition: 'all 0.2s'
            }}
          >
            UPLOAD
          </button>
        </div>

        {/* Tab Content - Scrollable Container */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#f9fafb',
          overscrollBehavior: 'none'
        }}>
          <div style={{ padding: '24px 20px' }}>
            {activeTab === 'soap' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {isEditMode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', background: '#e0f2fe', border: '1px solid #1AB1E5', color: '#0369a1', fontSize: 12, fontWeight: 400 }}>
                    <span>Mode Edit — mengubah data SOAP/CPPT tanggal {editingItem?.tgl_perawatan} {editingItem?.jam_rawat}. Tanggal/Jam dikunci karena jadi kunci data.</span>
                    <button
                      type="button"
                      onClick={clearForm}
                      style={{ padding: '4px 10px', borderRadius: 0, border: '1px solid #0369a1', background: '#fff', color: '#0369a1', cursor: 'pointer', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}
                    >
                      Batal Edit
                    </button>
                  </div>
                )}

                {/* Form SOAP/CPPT — panel flat putih PERSIS SoapCpptFormIGD.tsx
                    (ganti dari grid 2-kolom badge S/O/A/P berwarna + card
                    "Last SOAPIE" di kanan, dihapus per keputusan user). */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <form ref={formRef} onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: 24 }}>
                      {/* Kiri — Keluhan (S), Pemeriksaan+Vital Sign (O) */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <SoapAutoField
                          label="Subjective" value={form.subjective} onChange={(v) => handleInputChange('subjective', v)}
                          onFocusFilter={() => filterSubjective(form.subjective)} show={showSubjectiveDropdown} setShow={setShowSubjectiveDropdown}
                          filtered={filteredSubjective} onPick={(v) => { handleInputChange('subjective', v); setShowSubjectiveDropdown(false); }}
                          multiline required maxLength={2000} placeholder="Keluhan yang disampaikan pasien..."
                        />
                        <SoapAutoField
                          label="Objective" value={form.objective} onChange={(v) => handleInputChange('objective', v)}
                          onFocusFilter={() => filterObjective(form.objective)} show={showObjectiveDropdown} setShow={setShowObjectiveDropdown}
                          filtered={filteredObjective} onPick={(v) => { handleInputChange('objective', v); setShowObjectiveDropdown(false); }}
                          multiline required maxLength={2000} placeholder="Hasil pemeriksaan fisik..."
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          <SoapAutoField
                            label="Suhu" value={form.suhu} onChange={(v) => handleInputChange('suhu', v)}
                            onFocusFilter={() => filterSuhu(form.suhu)} show={showSuhuDropdown} setShow={setShowSuhuDropdown}
                            filtered={filteredSuhu} onPick={(v) => { handleInputChange('suhu', v); setShowSuhuDropdown(false); }}
                            maxLength={5}
                          />
                          <SoapAutoField
                            label="Tensi" value={form.tensi} onChange={(v) => handleInputChange('tensi', v)}
                            onFocusFilter={() => filterTensi(form.tensi)} show={showTensiDropdown} setShow={setShowTensiDropdown}
                            filtered={filteredTensi} onPick={(v) => { handleInputChange('tensi', v); setShowTensiDropdown(false); }}
                            placeholder="120/80" maxLength={8}
                          />
                          <SoapAutoField
                            label="BB (Kg)" value={form.berat} onChange={(v) => handleInputChange('berat', v)}
                            onFocusFilter={() => filterBerat(form.berat)} show={showBeratDropdown} setShow={setShowBeratDropdown}
                            filtered={filteredBerat} onPick={(v) => { handleInputChange('berat', v); setShowBeratDropdown(false); }}
                            maxLength={5}
                          />
                          <SoapAutoField
                            label="TB (cm)" value={form.tinggi} onChange={(v) => handleInputChange('tinggi', v)}
                            onFocusFilter={() => filterTinggi(form.tinggi)} show={showTinggiDropdown} setShow={setShowTinggiDropdown}
                            filtered={filteredTinggi} onPick={(v) => { handleInputChange('tinggi', v); setShowTinggiDropdown(false); }}
                            maxLength={5}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                          <SoapAutoField
                            label="Nadi" value={form.nadi} onChange={(v) => handleInputChange('nadi', v)}
                            onFocusFilter={() => filterNadi(form.nadi)} show={showNadiDropdown} setShow={setShowNadiDropdown}
                            filtered={filteredNadi} onPick={(v) => { handleInputChange('nadi', v); setShowNadiDropdown(false); }}
                            maxLength={3}
                          />
                          <SoapAutoField
                            label="Respirasi" value={form.respirasi} onChange={(v) => handleInputChange('respirasi', v)}
                            onFocusFilter={() => filterRespirasi(form.respirasi)} show={showRespirasiDropdown} setShow={setShowRespirasiDropdown}
                            filtered={filteredRespirasi} onPick={(v) => { handleInputChange('respirasi', v); setShowRespirasiDropdown(false); }}
                            maxLength={3}
                          />
                          <div>
                            <label style={soapLabelStyle}>SpO2</label>
                            <input type="text" value={form.spo2} onChange={(e) => handleInputChange('spo2', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={3} style={soapInputStyle} />
                          </div>
                          <div>
                            <label style={soapLabelStyle}>L.P. (cm)</label>
                            <input type="text" value={form.lingkarPerut} onChange={(e) => handleInputChange('lingkarPerut', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={5} style={soapInputStyle} />
                          </div>
                          <div>
                            <label style={soapLabelStyle}>GCS (E,V,M)</label>
                            <input type="text" value={form.gcs} onChange={(e) => handleInputChange('gcs', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} maxLength={10} style={soapInputStyle} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                          <div>
                            <label style={soapLabelStyle}>Kesadaran</label>
                            <div style={{ position: 'relative' }}>
                              <select value={form.kesadaran} onChange={(e) => handleInputChange('kesadaran', e.target.value)} onFocus={handleSoapFieldFocus} onBlur={handleSoapFieldBlur} style={soapSelectStyle}>
                                {KESADARAN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
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
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <SoapAutoField
                          label="Asesmen" value={form.assessment} onChange={(v) => handleInputChange('assessment', v)}
                          onFocusFilter={() => filterAssessment(form.assessment)} show={showAssessmentDropdown} setShow={setShowAssessmentDropdown}
                          filtered={filteredAssessment} onPick={(v) => { handleInputChange('assessment', v); setShowAssessmentDropdown(false); }}
                          multiline required maxLength={2000} placeholder="Diagnosis atau assessment..."
                        />
                        <SoapAutoField
                          label="Planning" value={form.planning} onChange={(v) => handleInputChange('planning', v)}
                          onFocusFilter={() => filterPlanning(form.planning)} show={showPlanningDropdown} setShow={setShowPlanningDropdown}
                          filtered={filteredPlanning} onPick={(v) => { handleInputChange('planning', v); setShowPlanningDropdown(false); }}
                          multiline maxLength={2000} placeholder="Terisi otomatis dari input resep..."
                        />
                        <SoapAutoField
                          label="Instruksi/Implementasi" value={form.instruksi} onChange={(v) => handleInputChange('instruksi', v)}
                          onFocusFilter={() => filterInstruksi(form.instruksi)} show={showInstruksiDropdown} setShow={setShowInstruksiDropdown}
                          filtered={filteredInstruksi} onPick={(v) => { handleInputChange('instruksi', v); setShowInstruksiDropdown(false); }}
                          multiline maxLength={2000}
                        />
                        <SoapAutoField
                          label="Evaluasi" value={form.evaluasi} onChange={(v) => handleInputChange('evaluasi', v)}
                          onFocusFilter={() => filterEvaluasi(form.evaluasi)} show={showEvaluasiDropdown} setShow={setShowEvaluasiDropdown}
                          filtered={filteredEvaluasi} onPick={(v) => { handleInputChange('evaluasi', v); setShowEvaluasiDropdown(false); }}
                          multiline maxLength={2000} minHeight={50}
                        />
                      </div>
                    </div>

                    {/* Action Buttons — Clear/SOAPIE/Riwayat Perawatan/Rujuk/
                        ICare/Selesai DIPERTAHANKAN semua (fungsi Poli-spesifik,
                        per keputusan user), cuma direstyle flat radius 0 PERSIS
                        tombol Simpan SoapCpptFormIGD.tsx — bukan dihapus. */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
                      <button type="submit" disabled={loading} style={soapActionBtn('#1AB1E5', loading)}>
                        {loading ? 'Menyimpan...' : isEditMode ? 'Update SOAP' : 'Simpan SOAP/CPPT'}
                      </button>
                      <button type="button" onClick={clearForm} style={soapActionBtn('#6b7280')}>Clear</button>
                      <button type="button" onClick={() => setShowRiwayatSoapieModal(true)} style={soapActionBtn('#6b7280')}>SOAPIE</button>
                      <button type="button" onClick={() => setShowRiwayatModal(true)} style={soapActionBtn('#6b7280')}>Riwayat Perawatan</button>
                      <button type="button" onClick={() => setShowRujukanInternalModal(true)} style={soapActionBtn('#6b7280')}>Rujuk</button>
                      <button type="button" onClick={() => setShowIcareModal(true)} style={soapActionBtn('#6b7280')}>ICare</button>
                      <button type="button" onClick={handleKeluar} style={soapActionBtn('#10b981')}>Selesai</button>
                    </div>

                    {error && (
                      <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12 }}>
                        {error}
                      </div>
                    )}
                  </form>
                </div>

                {/* Riwayat SOAP/CPPT tersimpan — PERSIS SoapCpptDisplay
                    (PemeriksaanIGD.tsx): tabel dari renderSoapCpptTable
                    (utils/soapCpptIgdDisplay.tsx), Edit/Copy/Hapus per-baris,
                    ganti dari tabel custom "Rincian Riwayat" lama. */}
                {soapHistory && soapHistory.length > 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
                    {renderSoapCpptTable(soapHistory, {
                      onEdit: editSOAP,
                      onCopy: copySoapieToForm,
                      onDelete: deleteSOAP,
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data SOAP/CPPT</div>
                    <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Catatan perkembangan pasien ini belum tersimpan.</div>
                  </div>
                )}
              </div>

              {/* Sidebar 30% — Card "Kunjungan Terakhir" (riwayat SOAPIE
                  sebelum hari ini), dikembalikan per permintaan user tapi
                  direstyle flat (radius 0, fontSize 12, tanpa shadow/
                  gradient) PERSIS bahasa desain form/tabel di sebelahnya —
                  bukan gaya card lama (rounded 12, header gradient biru). */}
              <div style={{ width: '30%', flexShrink: 0 }}>
                <div style={{ position: 'sticky', top: 0 }}>
                  {loadingLastSoapie ? (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                      Memuat...
                    </div>
                  ) : lastSoapie ? (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, background: '#fff' }}>
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#111827' }}>Riwayat Kunjungan Terakhir</span>
                        <button
                          type="button"
                          onClick={() => copySoapieToForm(lastSoapie)}
                          title="Copy ke Form"
                          style={{ padding: '4px 8px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 400 }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{formatDateTime(lastSoapie.tgl_perawatan || '', lastSoapie.jam_rawat || '')}</div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Keluhan</div>
                          <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.keluhan || '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Pemeriksaan</div>
                          <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.pemeriksaan || '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Asesmen</div>
                          <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.penilaian || '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Planning</div>
                          <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.rtl || '-'}</div>
                        </div>
                        {lastSoapie.instruksi && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Instruksi/Implementasi</div>
                            <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.instruksi}</div>
                          </div>
                        )}
                        {lastSoapie.evaluasi && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Evaluasi</div>
                            <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{lastSoapie.evaluasi}</div>
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11 }}>
                          <div><span style={{ color: '#9ca3af' }}>TD:</span> <span style={{ color: '#374151' }}>{lastSoapie.tensi || '-'}</span></div>
                          <div><span style={{ color: '#9ca3af' }}>Suhu:</span> <span style={{ color: '#374151' }}>{lastSoapie.suhu_tubuh || '-'}°C</span></div>
                          <div><span style={{ color: '#9ca3af' }}>Nadi:</span> <span style={{ color: '#374151' }}>{lastSoapie.nadi || '-'}/mnt</span></div>
                          <div><span style={{ color: '#9ca3af' }}>RR:</span> <span style={{ color: '#374151' }}>{lastSoapie.respirasi || '-'}/mnt</span></div>
                          <div><span style={{ color: '#9ca3af' }}>TB:</span> <span style={{ color: '#374151' }}>{lastSoapie.tinggi || '-'} cm</span></div>
                          <div><span style={{ color: '#9ca3af' }}>BB:</span> <span style={{ color: '#374151' }}>{lastSoapie.berat || '-'} kg</span></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 20px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 0, background: '#fff' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                      <div style={{ fontSize: 12, textAlign: 'center' }}>Belum ada riwayat SOAPIE</div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}

            {activeTab === 'resep' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ResepTab
                  patient={patient}
                  openInputSignal={resepOpenSignal}
                  onResepChanged={fetchSoapHistory}
                />
              </div>
            )}

            {activeTab === 'lab' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <LabTab patient={patient} />
              </div>
            )}

            {activeTab === 'rad' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <RadTab patient={patient} />
              </div>
            )}

            {activeTab === 'tindakan' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TindakanTab patient={patient} />
              </div>
            )}

            {activeTab === 'diagnosa' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <DiagnosaTab patient={patient} />
              </div>
            )}

            {activeTab === 'catatan_dokter' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CatatanDokterTab patient={patient} />
              </div>
            )}

            {activeTab === 'upload' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <UploadTab patient={patient} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Kartu Identitas Pasien — dibuka lewat klik avatar svg user
          di sidebar, tampilan ringkas identitas pasien (bukan cetak). */}
      {showIdCard && (
        <div
          onClick={() => setShowIdCard(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 360, maxWidth: '100%', background: '#fff', borderRadius: 0, overflow: 'hidden', boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}
          >
            {/* Header cyan — identik gradient sidebar */}
            <div style={{ background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)', padding: '20px 20px 16px', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowIdCard(false)}
                style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Kartu Identitas Pasien</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white" />
                    <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="white" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', wordBreak: 'break-word', lineHeight: 1.3 }}>{patientData.nm_pasien || '-'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>No. RM: {patientData.no_rkm_medis || '-'}</div>
                </div>
              </div>
            </div>

            {/* Body — daftar identitas */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {[
                ['Jenis Kelamin', patientData.jk === 'L' ? 'Laki-laki' : patientData.jk === 'P' ? 'Perempuan' : patientData.jk || '-'],
                ['Tempat, Tanggal Lahir', `${patientData.tmp_lahir ? `${patientData.tmp_lahir}, ` : ''}${patientData.tgl_lahir ? new Date(patientData.tgl_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`],
                ['Umur', patientData.umur || '-'],
                ['Golongan Darah', patientData.gol_darah || '-'],
                ['Alamat', patientData.alamat || '-'],
                ['Pendidikan', patientData.pnd || '-'],
                ['Nama Ibu Kandung', patientData.nm_ibu || '-'],
                // Field tambahan (skip yg sudah ada di atas: alamat, TTL,
                // umur, gol darah, pendidikan, nama ibu, penjamin) — ref.
                // tampil() DlgPasien.java, via /api/pendaftaran/pasien/:no_rkm_medis.
                ['Agama', patientData.agama || '-'],
                ['Status Nikah', patientData.stts_nikah || '-'],
                ['Suku Bangsa', patientData.suku_bangsa_nama || '-'],
                ['Bahasa', patientData.bahasa || '-'],
                ['Cacat Fisik', patientData.cacat_fisik || '-'],
                ['No. KTP', patientData.no_ktp || '-'],
                ['No. Telepon', patientData.no_tlp || '-'],
                ['Email', patientData.email || '-'],
                ['No. Peserta (BPJS)', patientData.no_peserta || '-'],
                ['Tanggal Daftar', patientData.tgl_daftar ? new Date(patientData.tgl_daftar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
                ['Hubungan Keluarga', patientData.keluarga || '-'],
                ['Nama Penanggung Jawab', patientData.namakeluarga || '-'],
                ['NIP', patientData.nip || '-'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#111827', wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Riwayat Perawatan */}
      {showRiwayatModal && (
        <RiwayatModal
          patient={patient}
          onClose={() => setShowRiwayatModal(false)}
        />
      )}

      {/* Modal Riwayat SOAPIE */}
      {showRiwayatSoapieModal && (
        <RiwayatSoapieModal
          patient={patient}
          onClose={() => setShowRiwayatSoapieModal(false)}
          onCopySoapie={copySoapieToForm}
        />
      )}

      {/* Modal Rujukan Internal */}
      {showRujukanInternalModal && (
        <RujukanInternalModal
          patient={patient}
          onClose={() => setShowRujukanInternalModal(false)}
          onSuccess={() => {
            // Refresh data jika perlu
            console.log('Rujukan internal berhasil disimpan');
          }}
        />
      )}

      {/* Modal Riwayat Pelayanan I-Care BPJS */}
      {showIcareModal && (
        <IcareRiwayatModal
          noRkmMedis={patient.no_rkm_medis}
          kdDokter={patient.kd_dokter}
          namaPasien={patientData.nm_pasien}
          onClose={() => setShowIcareModal(false)}
        />
      )}
    </section>
  );
};
