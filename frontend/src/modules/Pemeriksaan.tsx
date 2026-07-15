import React from 'react';
import Swal from 'sweetalert2';
import { ResepModal } from '../components/ResepModal';
import { RiwayatModal } from '../components/RiwayatModal';
import { RiwayatSoapieModal } from '../components/RiwayatSoapieModal';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { UploadTab } from '../components/UploadTab';
import { RujukanInternalModal } from '../components/RujukanInternalModal';
import { TindakanTab } from '../components/TindakanTab';

type SoapViewProps = {
  patient: any;
  onBack: () => void;
};

// Helper component for info items
const InfoItem: React.FC<{ label: string; value: string; icon?: React.ReactNode; highlight?: boolean; multiline?: boolean }> = ({ label, value, icon, highlight, multiline }) => (
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
        fontSize: 13, 
        color: highlight ? '#1AB1E5' : '#111827', 
        fontWeight: highlight ? 600 : 400,
        lineHeight: multiline ? 1.5 : 1.4,
        wordBreak: 'break-word'
      }}>
        {value}
      </div>
    </div>
  </div>
);

export const PemeriksaanView: React.FC<SoapViewProps> = ({ patient, onBack }) => {
  const [activeTab, setActiveTab] = React.useState<'soap' | 'resep' | 'lab' | 'rad' | 'tindakan' | 'upload'>('soap');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any>(null); // Menyimpan item yang sedang diedit
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [soapHistory, setSoapHistory] = React.useState<any[]>([]);
  const [lastSoapie, setLastSoapie] = React.useState<any>(null); // Riwayat SOAPIE terakhir
  const [loadingLastSoapie, setLoadingLastSoapie] = React.useState(false);
  const [showResepModal, setShowResepModal] = React.useState(false);
  const [editingResep, setEditingResep] = React.useState<{ no_resep: string; items: any[]; racikan?: any[] } | null>(null);
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  const [showRiwayatSoapieModal, setShowRiwayatSoapieModal] = React.useState(false);
  const [showRujukanInternalModal, setShowRujukanInternalModal] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null); // Ref untuk form input
  const [patientData, setPatientData] = React.useState<any>(patient); // State untuk data pasien lengkap

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
    kesadaran: 'Compos Mentis'
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

  const fetchSoapHistory = async () => {
    try {
      const encodedNoRawat = encodeURIComponent(patient.no_rawat);
      const response = await fetch(`/api/pemeriksaan/soap-history/${encodedNoRawat}`);
      if (!response.ok) throw new Error('Failed to fetch SOAP history');
      const data = await response.json();

      setSoapHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching SOAP history:', err);
      setSoapHistory([]);
    }
  };

  // Fetch Last SOAPIE
  const fetchLastSoapie = async () => {
    setLoadingLastSoapie(true);
    try {
      const response = await fetch(`/api/pemeriksaan/riwayat-soapie/${encodeURIComponent(patient.no_rkm_medis)}?filter=last5`);
      if (!response.ok) throw new Error('Failed to fetch SOAPIE history');
      const data = await response.json();

      // Data struktur: [{no_reg, no_rawat, tgl_registrasi, soapie: [...]}, ...]
      // Cari SOAPIE terakhir dari kunjungan SEBELUM hari ini (SOAP hari ini
      // ditampilkan terpisah di SOAP History, supaya bisa dibandingkan)
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

  // Fetch Riwayat Resep untuk tab Resep — dibatasi hanya untuk no_rawat kunjungan ini
  const fetchRiwayatResep = async () => {
    setLoadingRiwayatResep(true);
    try {
      const response = await fetch(`/api/resep/history/${encodeURIComponent(patient.no_rkm_medis)}`);
      if (!response.ok) throw new Error('Failed to fetch riwayat resep');
      const data = await response.json();

      const list = Array.isArray(data) ? data : [];
      setRiwayatResep(list.filter((r: any) => r.no_rawat === patient.no_rawat));
    } catch (err) {
      console.error('Error fetching riwayat resep:', err);
      setRiwayatResep([]);
    } finally {
      setLoadingRiwayatResep(false);
    }
  };

  // Load riwayat resep saat tab resep aktif
  React.useEffect(() => {
    if (activeTab === 'resep') {
      fetchRiwayatResep();
    }
  }, [activeTab, patient.no_rkm_medis]);

  // Load last SOAPIE saat tab soap aktif
  React.useEffect(() => {
    if (activeTab === 'soap') {
      fetchLastSoapie();
    }
  }, [activeTab, patient.no_rkm_medis]);

  // Delete resep
  const handleDeleteResep = async (noResep: string) => {
    // Cari resep yang akan dihapus untuk validasi status
    const resepToDelete = riwayatResep.find(r => r.no_resep === noResep);
    
    // Normalisasi status (trim dan lowercase untuk konsistensi)
    const status = resepToDelete?.status?.toString().trim().toLowerCase() || '';
    
    // Validasi: hanya bisa hapus jika status = 'belum'
    if (!resepToDelete || status !== 'belum') {
      await Swal.fire({
        icon: 'warning',
        title: 'Tidak Dapat Dihapus',
        text: status === 'sudah' 
          ? 'Resep sudah tervalidasi, tidak dapat dihapus' 
          : 'Resep tidak dapat dihapus',
        confirmButtonColor: '#6b7280'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Resep?',
      text: `Apakah Anda yakin ingin menghapus resep ${noResep}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/resep/${encodeURIComponent(noResep)}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          // Tampilkan pesan error spesifik dari backend
          const errorMessage = data.message || data.error || 'Gagal menghapus resep';
          throw new Error(errorMessage);
        }

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: data.message || 'Resep berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh list: riwayat resep dan SOAP history (karena RTL sudah terupdate di backend)
        await Promise.all([
          fetchRiwayatResep(),
          fetchSoapHistory()
        ]);
      } catch (err: any) {
        console.error('Error deleting resep:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Gagal menghapus resep'
        });
      }
    }
  };

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
        spo2: '',
        gcs: form.gcs,
        kesadaran: form.kesadaran,
        keluhan: form.subjective,
        pemeriksaan: form.objective,
        alergi: '',
        lingkar_perut: '',
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
            btn.style.borderRadius = '8px';
          });
        },
      });

      // Reset form and refresh history
      clearForm();
      fetchSoapHistory();

      // Jika user klik "Input Resep", tampilkan modal resep
      if (result.isConfirmed) {
        setEditingResep(null);
        setShowResepModal(true);
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
      kesadaran: 'Compos Mentis'
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
      kesadaran: item.kesadaran || 'Compos Mentis'
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
      kesadaran: soapieData.kesadaran || 'Compos Mentis'
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
      
      // Gunakan query parameter untuk menghindari masalah encoding URL
      const params = new URLSearchParams({
        no_rawat: item.no_rawat,
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
          width: 280,
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
            <div style={{
              width: 56,
              height: 56,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              flexShrink: 0
            }}>
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
            </div>
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
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem 
                label="Jenis Kelamin" 
                value={patientData.jk === 'L' ? 'Laki-laki' : patientData.jk === 'P' ? 'Perempuan' : patientData.jk || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"></path></svg>}
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
            </div>
          </div>

          {/* Card: Data Sosial */}
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
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Data Sosial</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InfoItem 
                  label="Pendidikan" 
                  value={patientData.pnd || '-'}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>}
                />
                <InfoItem 
                  label="Pekerjaan" 
                  value={patientData.pekerjaan || '-'}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>}
                />
              </div>
              <InfoItem 
                label="Nama Ibu Kandung" 
                value={patientData.nm_ibu || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>}
              />
              {patientData.bahasa && (
                <InfoItem 
                  label="Bahasa" 
                  value={patientData.bahasa}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>}
                />
              )}
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
                highlight
              />
              <InfoItem 
                label="Tanggal & Jam" 
                value={`${patient.tgl_registrasi} • ${patient.jam_reg}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
              />
              <InfoItem 
                label="Poliklinik" 
                value={patient.nm_poli}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>}
              />
              <InfoItem 
                label="Dokter" 
                value={patient.nm_dokter}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>}
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
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151', lineHeight: '20px' }}>Pemeriksaan Rawat Jalan</h3>
          <button
            onClick={handleKeluar}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
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
            Tutup
          </button>
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
              fontWeight: activeTab === 'soap' ? 600 : 400,
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
              fontWeight: activeTab === 'resep' ? 600 : 400,
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
              fontWeight: activeTab === 'lab' ? 600 : 400,
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
              fontWeight: activeTab === 'rad' ? 600 : 400,
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
              fontWeight: activeTab === 'tindakan' ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            TINDAKAN
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
              fontWeight: activeTab === 'upload' ? 600 : 400,
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
              <div style={{ display: 'flex', gap: 20, minWidth: 0 }}>
                {/* Left: Form SOAP */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Edit Mode Indicator */}
                  {isEditMode && (
                    <div style={{
                      background: '#cffafe',
                      border: '1px solid #1AB1E5',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 16,
                      color: '#0e7490'
                    }}>
                      <strong>✏️ Mode Edit</strong> - Anda sedang mengedit SOAP yang sudah ada. Klik "Update SOAP" untuk simpan data.
                    </div>
                  )}

                  {/* SOAP Form */}
                  <form ref={formRef} onSubmit={handleSubmit}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 20,
                    marginBottom: 20
                  }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Subjective */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#1AB1E5',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>S</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Subjective (Keluhan)
                          </label>
                        </div>
                        <textarea
                          value={form.subjective}
                          onChange={(e) => handleInputChange('subjective', e.target.value)}
                          onFocus={() => {
                            filterSubjective(form.subjective);
                            setShowSubjectiveDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowSubjectiveDropdown(false), 200);
                          }}
                          rows={4}
                          required
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Keluhan yang disampaikan pasien..."
                        />
                        {/* Dropdown Subjective History */}
                        {showSubjectiveDropdown && filteredSubjective.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredSubjective.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('subjective', item);
                                  setShowSubjectiveDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredSubjective.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Objective */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#f59e0b',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>O</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Objective (Pemeriksaan)
                          </label>
                        </div>
                        <textarea
                          value={form.objective}
                          onChange={(e) => handleInputChange('objective', e.target.value)}
                          onFocus={() => {
                            filterObjective(form.objective);
                            setShowObjectiveDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowObjectiveDropdown(false), 200);
                          }}
                          rows={4}
                          required
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Hasil pemeriksaan fisik..."
                        />
                        {/* Dropdown Objective History */}
                        {showObjectiveDropdown && filteredObjective.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredObjective.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('objective', item);
                                  setShowObjectiveDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredObjective.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Vital Signs */}
                      <div style={{
                        background: '#f9fafb',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 10
                        }}>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>TD</label>
                            <input
                              type="text"
                              value={form.tensi}
                              onChange={(e) => handleInputChange('tensi', e.target.value)}
                              onFocus={() => {
                                filterTensi(form.tensi);
                                setShowTensiDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowTensiDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="mmHg"
                            />
                            {showTensiDropdown && filteredTensi.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredTensi.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('tensi', item);
                                      setShowTensiDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredTensi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Suhu</label>
                            <input
                              type="text"
                              value={form.suhu}
                              onChange={(e) => handleInputChange('suhu', e.target.value)}
                              onFocus={() => {
                                filterSuhu(form.suhu);
                                setShowSuhuDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowSuhuDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="°C"
                            />
                            {showSuhuDropdown && filteredSuhu.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredSuhu.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('suhu', item);
                                      setShowSuhuDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredSuhu.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nadi</label>
                            <input
                              type="text"
                              value={form.nadi}
                              onChange={(e) => handleInputChange('nadi', e.target.value)}
                              onFocus={() => {
                                filterNadi(form.nadi);
                                setShowNadiDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowNadiDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="/mnt"
                            />
                            {showNadiDropdown && filteredNadi.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredNadi.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('nadi', item);
                                      setShowNadiDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredNadi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>RR</label>
                            <input
                              type="text"
                              value={form.respirasi}
                              onChange={(e) => handleInputChange('respirasi', e.target.value)}
                              onFocus={() => {
                                filterRespirasi(form.respirasi);
                                setShowRespirasiDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowRespirasiDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="/mnt"
                            />
                            {showRespirasiDropdown && filteredRespirasi.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredRespirasi.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('respirasi', item);
                                      setShowRespirasiDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredRespirasi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>TB</label>
                            <input
                              type="text"
                              value={form.tinggi}
                              onChange={(e) => handleInputChange('tinggi', e.target.value)}
                              onFocus={() => {
                                filterTinggi(form.tinggi);
                                setShowTinggiDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowTinggiDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="cm"
                            />
                            {showTinggiDropdown && filteredTinggi.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredTinggi.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('tinggi', item);
                                      setShowTinggiDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredTinggi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>BB</label>
                            <input
                              type="text"
                              value={form.berat}
                              onChange={(e) => handleInputChange('berat', e.target.value)}
                              onFocus={() => {
                                filterBerat(form.berat);
                                setShowBeratDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowBeratDropdown(false), 200);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                              placeholder="kg"
                            />
                            {showBeratDropdown && filteredBerat.length > 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}>
                                {filteredBerat.map((item, index) => (
                                  <div
                                    key={index}
                                    onClick={() => {
                                      handleInputChange('berat', item);
                                      setShowBeratDropdown(false);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: index < filteredBerat.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Assessment */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>A</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Assessment (Diagnosis)
                          </label>
                        </div>
                        <textarea
                          value={form.assessment}
                          onChange={(e) => handleInputChange('assessment', e.target.value)}
                          onFocus={() => {
                            filterAssessment(form.assessment);
                            setShowAssessmentDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowAssessmentDropdown(false), 200);
                          }}
                          rows={3}
                          required
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Diagnosis atau assessment..."
                        />
                        {/* Dropdown Assessment History */}
                        {showAssessmentDropdown && filteredAssessment.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredAssessment.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('assessment', item);
                                  setShowAssessmentDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredAssessment.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Planning */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>P</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Planning (Rencana)
                          </label>
                        </div>
                        <textarea
                          value={form.planning}
                          onChange={(e) => handleInputChange('planning', e.target.value)}
                          onFocus={() => {
                            filterPlanning(form.planning);
                            setShowPlanningDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowPlanningDropdown(false), 200);
                          }}
                          rows={4}
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Rencana tindakan atau terapi (optional - akan terisi otomatis dari resep)..."
                        />
                        {/* Dropdown Planning History */}
                        {showPlanningDropdown && filteredPlanning.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredPlanning.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('planning', item);
                                  setShowPlanningDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredPlanning.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Evaluasi */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#14b8a6',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>E</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Evaluasi
                          </label>
                        </div>
                        <textarea
                          value={form.evaluasi}
                          onChange={(e) => handleInputChange('evaluasi', e.target.value)}
                          onFocus={() => {
                            filterEvaluasi(form.evaluasi);
                            setShowEvaluasiDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowEvaluasiDropdown(false), 200);
                          }}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Evaluasi dan catatan lanjutan..."
                        />
                        {/* Dropdown Evaluasi History */}
                        {showEvaluasiDropdown && filteredEvaluasi.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredEvaluasi.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('evaluasi', item);
                                  setShowEvaluasiDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredEvaluasi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Instruksi */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            background: '#6b7280',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}>I</span>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            Instruksi
                          </label>
                        </div>
                        <textarea
                          value={form.instruksi}
                          onChange={(e) => handleInputChange('instruksi', e.target.value)}
                          onFocus={() => {
                            filterInstruksi(form.instruksi);
                            setShowInstruksiDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowInstruksiDropdown(false), 200);
                          }}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Instruksi tambahan..."
                        />
                        {/* Dropdown Instruksi History */}
                        {showInstruksiDropdown && filteredInstruksi.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}>
                            {filteredInstruksi.map((item, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  handleInputChange('instruksi', item);
                                  setShowInstruksiDropdown(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderBottom: index < filteredInstruksi.length - 1 ? '1px solid #e5e7eb' : 'none',
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: 16,
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb'
                  }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: loading ? '#9ca3af' : '#1AB1E5',
                        color: '#ffffff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {loading ? (
                        <>⏳ Menyimpan...</>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                          </svg>
                          {isEditMode ? 'Update SOAP' : 'Simpan SOAP'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={clearForm}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6b7280',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRiwayatSoapieModal(true)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6b7280',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Riwayat SOAPIE
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRiwayatModal(true)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6b7280',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Riwayat Perawatan
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRujukanInternalModal(true)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6b7280',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                      Rujuk
                    </button>
                    <button
                      type="button"
                      onClick={handleKeluar}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#10b981',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      Selesai
                    </button>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div style={{
                      marginTop: 16,
                      padding: 12,
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: 8,
                      color: '#991b1b',
                      fontSize: 13
                    }}>
                      {error}
                    </div>
                  )}
                </form>

                {/* SOAP History */}
                {soapHistory && soapHistory.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h5 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                      Rincian Riwayat
                    </h5>
                    <div style={{ background: '#ffffff', borderRadius: 8, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th rowSpan={2} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>No</th>
                            <th rowSpan={2} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>Tanggal</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Suhu(C)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Tensi (mmHg)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Nadi(/menit)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>RR(/menit)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Tinggi(cm)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Berat(kg)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>GCS(E,V,M)</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>SPO2</th>
                            <th style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Alergi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soapHistory.map((item, index) => (
                            <React.Fragment key={`soap-${item.no_rawat}-${item.tgl_perawatan}-${item.jam_rawat}-${index}`}>
                              {/* Vital Signs Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td rowSpan={8} style={{ padding: 10, textAlign: 'center', borderRight: '1px solid #e5e7eb', verticalAlign: 'top' }}>{index + 1}</td>
                                <td rowSpan={8} style={{ padding: 10, borderRight: '1px solid #e5e7eb' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 11 }}>
                                      <strong style={{ display: 'block' }}>{item.no_rawat}</strong>
                                      {formatDateTime(item.tgl_perawatan || '', item.jam_rawat || '')}<br />
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        onClick={() => editSOAP(item)}
                                        title="Edit"
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: 4,
                                          border: '1px solid #1AB1E5',
                                          background: '#e0f2fe',
                                          color: '#1AB1E5',
                                          cursor: 'pointer',
                                          fontSize: 11,
                                          fontWeight: 500
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => deleteSOAP(item)}
                                        title="Hapus"
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: 4,
                                          border: '1px solid #ef4444',
                                          background: '#fef2f2',
                                          color: '#ef4444',
                                          cursor: 'pointer',
                                          fontSize: 11,
                                          fontWeight: 500
                                        }}
                                      >
                                        Hapus
                                      </button>
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
                              {/* Kesadaran Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Kesadaran</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.kesadaran || 'Compos Mentis'}</td>
                              </tr>
                              {/* Subjective Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Subjective</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.keluhan || '-'}</td>
                              </tr>
                              {/* Objective Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Objective</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.pemeriksaan || '-'}</td>
                              </tr>
                              {/* Assessment Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Assessment</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.penilaian || '-'}</td>
                              </tr>
                              {/* Plan Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Plan</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.rtl || '-'}</td>
                              </tr>
                              {/* Instruksi Row */}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Instruksi</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.instruksi || '-'}</td>
                              </tr>
                              {/* Evaluasi Row */}
                              <tr style={{ borderBottom: index < (soapHistory?.length || 0) - 1 ? '2px solid #9ca3af' : '1px solid #e5e7eb' }}>
                                <td style={{ padding: 8, background: '#f9fafb', fontWeight: 500, borderRight: '1px solid #e5e7eb', width: 120 }}>Evaluasi</td>
                                <td colSpan={9} style={{ padding: 8 }}>{item.evaluasi || '-'}</td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                </div>

                {/* Right: Card Last SOAPIE */}
                <div style={{ width: 300, flexShrink: 0, minWidth: 0 }}>
                  {loadingLastSoapie ? (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: 20,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      textAlign: 'center',
                      color: '#9ca3af'
                    }}>
                      Memuat...
                    </div>
                  ) : lastSoapie ? (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      position: 'fixed',
                      top: 120,
                      right: 20,
                      width: 300,
                      height: 'calc(100vh - 160px)',
                      overflow: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      zIndex: 10
                    }}>
                      {/* Header - Sticky di dalam card */}
                      <div style={{
                        position: 'sticky',
                        top: 0,
                        background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)',
                        margin: -1,
                        marginBottom: 0,
                        padding: '8px 16px',
                        borderRadius: '12px 12px 0 0',
                        borderBottom: '2px solid #0891B2',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ffffff', letterSpacing: 0.3, flex: 1, textAlign: 'left' }}>
                          Kunjungan Terakhir
                        </h5>
                        <button
                          type="button"
                          onClick={() => copySoapieToForm(lastSoapie)}
                          title="Copy ke Form"
                          style={{
                            padding: 4,
                            borderRadius: 4,
                            border: 'none',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>

                      {/* Content Area */}
                      <div style={{ padding: 16 }}>
                        {/* Tanggal & Jam */}
                        <div style={{
                          marginBottom: 12,
                          paddingBottom: 12,
                          borderBottom: '1px solid #e5e7eb',
                          textAlign: 'left'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: 12,
                            color: '#374151',
                            fontWeight: 600
                          }}>
                            {formatDateTime(lastSoapie.tgl_perawatan || '', lastSoapie.jam_rawat || '')}
                          </p>
                        </div>

                      {/* SOAPIE Content */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
                        {/* Subjective */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#1AB1E5',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 9,
                              fontWeight: 600
                            }}>S</div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#1AB1E5' }}>Subjective (Keluhan)</span>
                          </div>
                          <p style={{
                            margin: 0,
                            marginTop: 4,
                            color: '#374151',
                            lineHeight: 1.5,
                            fontSize: 11
                          }}>
                            {lastSoapie.keluhan || '-'}
                          </p>
                        </div>

                        {/* Objective */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#f59e0b',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 9,
                              fontWeight: 600
                            }}>O</div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b' }}>Objective (Pemeriksaan)</span>
                          </div>
                          <p style={{
                            margin: 0,
                            marginTop: 4,
                            color: '#374151',
                            lineHeight: 1.5,
                            fontSize: 11
                          }}>
                            {lastSoapie.pemeriksaan || '-'}
                          </p>
                        </div>

                        {/* Assessment */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#ef4444',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 9,
                              fontWeight: 600
                            }}>A</div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>Assessment (Diagnosis)</span>
                          </div>
                          <p style={{
                            margin: 0,
                            marginTop: 4,
                            color: '#374151',
                            lineHeight: 1.5,
                            fontSize: 11
                          }}>
                            {lastSoapie.penilaian || '-'}
                          </p>
                        </div>

                        {/* Planning */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#10b981',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 9,
                              fontWeight: 600
                            }}>P</div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#10b981' }}>Plan (Rencana)</span>
                          </div>
                          <p style={{
                            margin: 0,
                            marginTop: 4,
                            color: '#374151',
                            lineHeight: 1.5,
                            fontSize: 11
                          }}>
                            {lastSoapie.rtl || '-'}
                          </p>
                        </div>

                        {/* Instruksi */}
                        {lastSoapie.instruksi && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <div style={{
                                display: 'inline-block',
                                background: '#6b7280',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: 3,
                                fontSize: 9,
                                fontWeight: 600
                              }}>I</div>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280' }}>Instruction (Instruksi)</span>
                            </div>
                            <p style={{
                              margin: 0,
                              marginTop: 4,
                              color: '#374151',
                              lineHeight: 1.5,
                              fontSize: 11
                            }}>
                              {lastSoapie.instruksi}
                            </p>
                          </div>
                        )}

                        {/* Evaluasi */}
                        {lastSoapie.evaluasi && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <div style={{
                                display: 'inline-block',
                                background: '#14b8a6',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: 3,
                                fontSize: 9,
                                fontWeight: 600
                              }}>E</div>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#14b8a6' }}>Evaluation (Evaluasi)</span>
                            </div>
                            <p style={{
                              margin: 0,
                              marginTop: 4,
                              color: '#374151',
                              lineHeight: 1.5,
                              fontSize: 11
                            }}>
                              {lastSoapie.evaluasi}
                            </p>
                          </div>
                        )}

                        {/* Vital Signs */}
                        <div style={{
                          marginTop: 8,
                          padding: 10,
                          background: '#f9fafb',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 10, color: '#6b7280', marginBottom: 6 }}>Vital Signs</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                            <div>
                              <span style={{ color: '#9ca3af' }}>TD:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.tensi || '-'}</span>
                            </div>
                            <div>
                              <span style={{ color: '#9ca3af' }}>Suhu:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.suhu_tubuh || '-'}°C</span>
                            </div>
                            <div>
                              <span style={{ color: '#9ca3af' }}>Nadi:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.nadi || '-'}/mnt</span>
                            </div>
                            <div>
                              <span style={{ color: '#9ca3af' }}>RR:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.respirasi || '-'}/mnt</span>
                            </div>
                            <div>
                              <span style={{ color: '#9ca3af' }}>TB:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.tinggi || '-'} cm</span>
                            </div>
                            <div>
                              <span style={{ color: '#9ca3af' }}>BB:</span> <span style={{ color: '#374151', fontWeight: 500 }}>{lastSoapie.berat || '-'} kg</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: 20,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontSize: 12
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                      <p style={{ margin: 0 }}>Belum ada riwayat SOAPIE</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'resep' && (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>Riwayat Resep</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setEditingResep(null); setShowResepModal(true); }}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                    >
                      + Input Resep
                    </button>
                    <button
                      onClick={fetchRiwayatResep}
                      disabled={loadingRiwayatResep}
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: loadingRiwayatResep ? 'not-allowed' : 'pointer', opacity: loadingRiwayatResep ? 0.6 : 1, fontSize: 13, fontWeight: 500 }}
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Loading state */}
                {loadingRiwayatResep && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat data resep...</div>
                )}

                {/* Empty state */}
                {!loadingRiwayatResep && riwayatResep.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    Belum ada permintaan resep hari ini untuk pasien ini
                  </div>
                )}

                {/* Daftar Resep */}
                {!loadingRiwayatResep && riwayatResep.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {riwayatResep.map((resep, index) => {
                      const belum = resep.status?.toString().trim().toLowerCase() === 'belum';
                      const nonRacikan = resep.non_racikan || [];
                      const racikan = resep.racikan || [];
                      return (
                        <div key={index} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${belum ? '#e5e7eb' : '#d1fae5'}`, overflow: 'hidden' }}>
                          {/* Header card */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: belum ? '#f9fafb' : '#f0fdf4', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{resep.no_resep || '-'}</span>
                              <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(resep.tgl_peresepan, resep.jam_peresepan || '')}</span>
                              {resep.nm_dokter && <span style={{ fontSize: 12, color: '#7c3aed' }}>{resep.nm_dokter}</span>}
                              {resep.status === 'retur' && (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>Retur</span>
                              )}
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                                background: belum ? '#fef3c7' : '#d1fae5',
                                color: belum ? '#92400e' : '#065f46'
                              }}>
                                {belum ? 'Belum Terlayani' : 'Sudah Terlayani'}
                              </span>
                            </div>
                            {belum && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => {
                                    setEditingResep({
                                      no_resep: resep.no_resep,
                                      items: nonRacikan.map((it: any) => ({ ...it, aturan: it.aturan_pakai })),
                                      racikan,
                                    });
                                    setShowResepModal(true);
                                  }}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #1AB1E5', background: '#e0f2fe', color: '#1AB1E5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteResep(resep.no_resep)}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                                >
                                  Hapus
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Items */}
                          <div style={{ padding: '10px 16px' }}>
                            {nonRacikan.length > 0 && (
                              <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 160 }}>Aturan Pakai</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nonRacikan.map((item: any, j: number) => (
                                      <tr key={j}>
                                        <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#374151' }}>{item.nama_brng || '-'}</td>
                                        <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{item.jml || '-'}</td>
                                        <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#7c3aed' }}>{item.aturan_pakai || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {racikan.length > 0 && racikan.map((rack: any, ri: number) => (
                              <div key={ri} style={{ marginTop: ri > 0 ? 8 : 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Racikan — {rack.nama_racik || `R${ri + 1}`}
                                  {rack.metode_racik && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.metode_racik}</span>}
                                  {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                                  {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(rack.detail || []).map((det: any, di: number) => (
                                      <tr key={di}>
                                        <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#374151' }}>{det.nama_brng || '-'}</td>
                                        <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.jml || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'lab' && <LabTab patient={patient} />}

            {activeTab === 'rad' && <RadTab patient={patient} />}

            {activeTab === 'tindakan' && <TindakanTab patient={patient} />}

            {activeTab === 'upload' && <UploadTab patient={patient} />}
          </div>
        </div>
      </div>

      {/* Modal Resep */}
      {showResepModal && (
        <ResepModal
          patient={patient}
          editResep={editingResep || undefined}
          onClose={() => { setShowResepModal(false); setEditingResep(null); }}
          onResepSaved={async () => {
            // Tutup modal resep
            setShowResepModal(false);
            setEditingResep(null);

            // Refresh data: riwayat resep dan SOAP history (karena RTL sudah terupdate di backend)
            await Promise.all([
              fetchRiwayatResep(),
              fetchSoapHistory()
            ]);

            // Tampilkan notifikasi sukses
            await Swal.fire({
              icon: 'success',
              title: 'Berhasil!',
              text: 'Resep berhasil disimpan',
              timer: 2000,
              showConfirmButton: false
            });
          }}
        />
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
    </section>
  );
};
