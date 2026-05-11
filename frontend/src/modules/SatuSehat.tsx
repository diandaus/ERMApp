import React from 'react';
import DicomMonitor from '../components/DicomMonitor';

type TabKey = 'dashboard' | 'konfigurasi' | 'pasien' | 'imaging-study' | 'log';

type SatuSehatConfig = {
  org_id: string;
  client_id: string;
  client_secret: string;
  auth_url: string;
  fhir_url: string;
  is_production: boolean;
  orthanc_url?: string;
  orthanc_worklist_dir?: string;
};

type LogEntry = {
  id: number;
  waktu: string;
  tipe: string;
  status: 'sukses' | 'gagal' | 'pending';
  pesan: string;
  no_rawat?: string;
};

type ImagingStudyPemeriksaan = {
  kd_jenis_prw: string;
  nm_perawatan: string;
  code: string | null;
  system: string | null;
  display: string | null;
  modality_code: string | null;
  modality_display: string | null;
};

type ImagingStudyItem = {
  noorder: string;
  no_rawat: string;
  tgl_permintaan: string;
  jam_permintaan: string;
  nm_pasien: string;
  no_rkm_medis: string;
  nm_dokter: string;
  diagnosis_klinis: string;
  status: string;
  id_imagingstudy: string | null;
  id_encounter: string | null;
  pemeriksaan: ImagingStudyPemeriksaan[];
};

type MappingRadiologi = {
  kd_jenis_prw: string;
  nm_perawatan: string;
  code: string;
  system: string;
  display: string;
  modality_code: string;
  modality_display: string;
};

const MODALITY_OPTIONS = [
  { code: 'DX',  display: 'Digital Radiography' },
  { code: 'CR',  display: 'Computed Radiography' },
  { code: 'CT',  display: 'Computed Tomography' },
  { code: 'MR',  display: 'Magnetic Resonance' },
  { code: 'US',  display: 'Ultrasound' },
  { code: 'NM',  display: 'Nuclear Medicine' },
  { code: 'PT',  display: 'PET' },
  { code: 'XA',  display: 'X-Ray Angiography' },
  { code: 'MG',  display: 'Mammography' },
  { code: 'RF',  display: 'Radio Fluoroscopy' },
];

type ResourceItem = {
  key: string;
  label: string;
  count: number | null;
  icon: string;
  color: string;
  category: 'kunjungan' | 'klinis' | 'obat' | 'penunjang' | 'lainnya';
  description: string;
};

const RESOURCES: ResourceItem[] = [
  { key: 'encounter',              label: 'Encounter',              count: 552,   icon: '🏥', color: '#2563eb', category: 'kunjungan', description: 'Data kunjungan rawat jalan & rawat inap' },
  { key: 'episodeofcare',          label: 'EpisodeOfCare',          count: null,  icon: '📁', color: '#64748b', category: 'kunjungan', description: 'Episode perawatan pasien' },
  { key: 'condition',              label: 'Condition',              count: 156,   icon: '🩺', color: '#dc2626', category: 'klinis',   description: 'Diagnosis & kondisi klinis pasien' },
  { key: 'observation',            label: 'Observation',            count: 10477, icon: '📊', color: '#0891b2', category: 'klinis',   description: 'Tanda vital, hasil pemeriksaan & observasi' },
  { key: 'procedure',              label: 'Procedure',              count: 71,    icon: '⚕️', color: '#7c3aed', category: 'klinis',   description: 'Tindakan & prosedur medis' },
  { key: 'clinicalimpression',     label: 'ClinicalImpression',     count: 409,   icon: '📝', color: '#059669', category: 'klinis',   description: 'Catatan klinis & kesan dokter' },
  { key: 'careplan',               label: 'CarePlan',               count: 330,   icon: '📋', color: '#0284c7', category: 'klinis',   description: 'Rencana perawatan pasien' },
  { key: 'allergyintolerance',     label: 'AllergyIntolerance',     count: null,  icon: '⚠️', color: '#d97706', category: 'klinis',   description: 'Data alergi & intoleransi pasien' },
  { key: 'immunization',           label: 'Immunization',           count: null,  icon: '💉', color: '#16a34a', category: 'klinis',   description: 'Riwayat imunisasi pasien' },
  { key: 'medication',             label: 'Medication',             count: 2,     icon: '💊', color: '#c026d3', category: 'obat',     description: 'Data master obat' },
  { key: 'medicationrequest',      label: 'MedicationRequest',      count: 642,   icon: '📄', color: '#7c3aed', category: 'obat',     description: 'Resep / permintaan obat' },
  { key: 'medicationdispense',     label: 'MedicationDispense',     count: 344,   icon: '🧴', color: '#0891b2', category: 'obat',     description: 'Pemberian & dispensing obat' },
  { key: 'medicationstatement',    label: 'MedicationStatement',    count: 3,     icon: '📌', color: '#64748b', category: 'obat',     description: 'Pernyataan penggunaan obat' },
  { key: 'servicerequest',         label: 'ServiceRequest',         count: 89,    icon: '🔬', color: '#0284c7', category: 'penunjang','description': 'Permintaan pemeriksaan penunjang' },
  { key: 'diagnosticreport',       label: 'DiagnosticReport',       count: 16,    icon: '📑', color: '#059669', category: 'penunjang','description': 'Hasil laporan diagnostik' },
  { key: 'imagingstudy',           label: 'ImagingStudy',           count: null,  icon: '🩻', color: '#64748b', category: 'penunjang','description': 'Studi pencitraan radiologi' },
  { key: 'specimen',               label: 'Specimen',               count: 85,    icon: '🧪', color: '#d97706', category: 'penunjang','description': 'Data spesimen laboratorium' },
  { key: 'composition',            label: 'Composition',            count: null,  icon: '📃', color: '#64748b', category: 'lainnya',  description: 'Dokumen klinis terstruktur' },
  { key: 'questionnaireresponse',  label: 'QuestionnaireResponse',  count: null,  icon: '📋', color: '#64748b', category: 'lainnya',  description: 'Jawaban kuesioner klinis' },
];

const CATEGORY_LABELS: Record<ResourceItem['category'], string> = {
  kunjungan: 'Kunjungan',
  klinis:    'Klinis',
  obat:      'Obat & Farmasi',
  penunjang: 'Penunjang',
  lainnya:   'Lainnya',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

export const SatuSehatView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');
  const [activeCat, setActiveCat] = React.useState<ResourceItem['category'] | 'semua'>('semua');
  const [config, setConfig] = React.useState<SatuSehatConfig>({
    org_id: '',
    client_id: '',
    client_secret: '',
    auth_url: 'https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1',
    fhir_url: 'https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1',
    is_production: false,
  });
  const [configLoading, setConfigLoading] = React.useState(true);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [configMsg, setConfigMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingConn, setTestingConn] = React.useState(false);
  const [connStatus, setConnStatus] = React.useState<'idle' | 'ok' | 'error'>('idle');
  const [searchNik, setSearchNik] = React.useState('');
  const [searchingPatient, setSearchingPatient] = React.useState(false);
  const [patientResult, setPatientResult] = React.useState<Record<string, unknown> | null>(null);
  const [patientError, setPatientError] = React.useState<string | null>(null);

  // ImagingStudy state
  const [isSubTab, setIsSubTab] = React.useState<'daftar' | 'mapping' | 'monitor'>('daftar');
  const [isTglDari, setIsTglDari] = React.useState(new Date().toISOString().split('T')[0]);
  const [isTglSampai, setIsTglSampai] = React.useState(new Date().toISOString().split('T')[0]);
  const [isStatusFilter, setIsStatusFilter] = React.useState('');
  const [imagingList, setImagingList] = React.useState<ImagingStudyItem[]>([]);
  const [imagingLoading, setImagingLoading] = React.useState(false);
  const [sendingOrders, setSendingOrders] = React.useState<Set<string>>(new Set());
  const [sendResults, setSendResults] = React.useState<Record<string, { ok: boolean; msg: string }>>({});
  const [mappingList, setMappingList] = React.useState<MappingRadiologi[]>([]);
  const [mappingLoading, setMappingLoading] = React.useState(false);
  const [editingMapping, setEditingMapping] = React.useState<Record<string, MappingRadiologi>>({});
  const [savingMapping, setSavingMapping] = React.useState<Set<string>>(new Set());
  // MWL state
  const [mwlSending, setMwlSending] = React.useState<Set<string>>(new Set());
  const [mwlResults, setMwlResults] = React.useState<Record<string, { ok: boolean; msg: string }>>({});
  // ServiceRequest state
  const [srSending, setSrSending] = React.useState<Set<string>>(new Set());
  const [srResults, setSrResults] = React.useState<Record<string, { ok: boolean; msg: string }>>({});
  // Orthanc config state
  const [orthancUrl, setOrthancUrl] = React.useState('http://localhost:8042');
  const [worklistDir, setWorklistDir] = React.useState('/etc/orthanc/worklists');
  // DICOM send state
  const [dicomSending, setDicomSending] = React.useState<Set<string>>(new Set());
  const [dicomResults, setDicomResults] = React.useState<Record<string, { ok: boolean; msg: string }>>({});
  const [dicomStudies, setDicomStudies] = React.useState<Record<string, boolean>>({});
  // Register router state
  const [registeringRouter, setRegisteringRouter] = React.useState(false);
  const [registerMsg, setRegisterMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const fetchImagingList = React.useCallback(async () => {
    setImagingLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/imaging-study?tgl_dari=${isTglDari}&tgl_sampai=${isTglSampai}&status=${isStatusFilter}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setImagingList(list);
      // cek study Orthanc untuk setiap order
      list.forEach((item: ImagingStudyItem) => checkDicomStudy(item.noorder));
    } catch { setImagingList([]); }
    finally { setImagingLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTglDari, isTglSampai, isStatusFilter]);

  const fetchMapping = React.useCallback(async () => {
    setMappingLoading(true);
    try {
      const res = await fetch('/api/satu-sehat/mapping/radiologi');
      const data = await res.json();
      setMappingList(Array.isArray(data) ? data : []);
      const init: Record<string, MappingRadiologi> = {};
      (Array.isArray(data) ? data : []).forEach((m: MappingRadiologi) => { init[m.kd_jenis_prw] = { ...m }; });
      setEditingMapping(init);
    } catch { setMappingList([]); }
    finally { setMappingLoading(false); }
  }, []);

  React.useEffect(() => {
    fetch('/api/satu-sehat/config')
      .then(r => r.json())
      .then(d => {
        if (d && d.org_id !== undefined) {
          setConfig(prev => ({
            ...prev,
            org_id: d.org_id ?? '',
            client_id: d.client_id ?? '',
            client_secret: prev.client_secret,
            auth_url: d.auth_url || prev.auth_url,
            fhir_url: d.fhir_url || prev.fhir_url,
            is_production: d.is_production ?? false,
          }));
          if (d.orthanc_url) setOrthancUrl(d.orthanc_url);
          if (d.orthanc_worklist_dir) setWorklistDir(d.orthanc_worklist_dir);
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  React.useEffect(() => {
    if (activeTab === 'imaging-study') {
      if (isSubTab === 'daftar') fetchImagingList();
      else fetchMapping();
    }
  }, [activeTab, isSubTab, fetchImagingList, fetchMapping]);

  const handleSendImaging = async (noOrder: string) => {
    setSendingOrders(prev => new Set(prev).add(noOrder));
    setSendResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: '' } }));
    try {
      const res = await fetch(`/api/satu-sehat/imaging-study/send/${noOrder}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSendResults(prev => ({ ...prev, [noOrder]: { ok: true, msg: `Terkirim. ID: ${data.id_imagingstudy || '-'}` } }));
        fetchImagingList();
      } else {
        setSendResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: data.error || 'Gagal' } }));
      }
    } catch {
      setSendResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: 'Koneksi gagal' } }));
    } finally {
      setSendingOrders(prev => { const s = new Set(prev); s.delete(noOrder); return s; });
    }
  };

  const handleSendMWL = async (noOrder: string) => {
    setMwlSending(prev => new Set(prev).add(noOrder));
    try {
      const res = await fetch(`/api/satu-sehat/mwl/send/${noOrder}`, { method: 'POST' });
      const data = await res.json();
      setMwlResults(prev => ({ ...prev, [noOrder]: { ok: res.ok, msg: res.ok ? `MWL terkirim (${data.steps} step)` : (data.error || 'Gagal') } }));
    } catch {
      setMwlResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: 'Koneksi gagal' } }));
    } finally {
      setMwlSending(prev => { const s = new Set(prev); s.delete(noOrder); return s; });
    }
  };

  const handleSendServiceRequest = async (noOrder: string) => {
    setSrSending(prev => new Set(prev).add(noOrder));
    try {
      const res = await fetch(`/api/satu-sehat/servicerequest-radiologi/send/${noOrder}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const ok = (data.results || []).filter((r: { id_servicerequest?: string }) => r.id_servicerequest).length;
        setSrResults(prev => ({ ...prev, [noOrder]: { ok: true, msg: `${ok} ServiceRequest terkirim` } }));
        fetchImagingList();
      } else {
        setSrResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: data.error || 'Gagal' } }));
      }
    } catch {
      setSrResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: 'Koneksi gagal' } }));
    } finally {
      setSrSending(prev => { const s = new Set(prev); s.delete(noOrder); return s; });
    }
  };

  const handleSendDicom = async (noOrder: string) => {
    setDicomSending(prev => new Set(prev).add(noOrder));
    try {
      const res = await fetch(`/api/satu-sehat/dicom/send/${noOrder}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDicomResults(prev => ({ ...prev, [noOrder]: { ok: true, msg: `${data.count} study terkirim ke DICOM Router` } }));
        fetchImagingList();
      } else {
        setDicomResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: data.error || 'Gagal' } }));
      }
    } catch {
      setDicomResults(prev => ({ ...prev, [noOrder]: { ok: false, msg: 'Koneksi gagal' } }));
    } finally {
      setDicomSending(prev => { const s = new Set(prev); s.delete(noOrder); return s; });
    }
  };

  const checkDicomStudy = async (noOrder: string) => {
    try {
      const res = await fetch(`/api/satu-sehat/dicom/studies/${noOrder}`);
      const data = await res.json();
      setDicomStudies(prev => ({ ...prev, [noOrder]: data.found === true }));
    } catch { /* ignore */ }
  };

  const handleRegisterRouter = async () => {
    setRegisteringRouter(true);
    setRegisterMsg(null);
    try {
      const res = await fetch('/api/satu-sehat/dicom/register-router', { method: 'POST' });
      const data = await res.json();
      setRegisterMsg({ ok: res.ok, text: res.ok ? data.message : (data.error || 'Gagal') });
    } catch {
      setRegisterMsg({ ok: false, text: 'Koneksi gagal' });
    } finally {
      setRegisteringRouter(false);
    }
  };

  const handleSaveMapping = async (kd: string) => {
    const m = editingMapping[kd];
    if (!m) return;
    setSavingMapping(prev => new Set(prev).add(kd));
    try {
      await fetch(`/api/satu-sehat/mapping/radiologi/${kd}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      fetchMapping();
    } finally {
      setSavingMapping(prev => { const s = new Set(prev); s.delete(kd); return s; });
    }
  };

  const [logs] = React.useState<LogEntry[]>([
    { id: 1, waktu: '2026-05-08 08:12:33', tipe: 'Encounter',         status: 'sukses', pesan: 'Kunjungan berhasil dikirim',          no_rawat: '2026/05/08/000001' },
    { id: 2, waktu: '2026-05-08 08:15:10', tipe: 'Observation',       status: 'sukses', pesan: 'Tanda vital berhasil dikirim',         no_rawat: '2026/05/08/000001' },
    { id: 3, waktu: '2026-05-07 14:02:55', tipe: 'MedicationRequest', status: 'gagal',  pesan: 'Token expired, silakan refresh token', no_rawat: '2026/05/07/000012' },
    { id: 4, waktu: '2026-05-07 09:44:21', tipe: 'Condition',         status: 'sukses', pesan: 'Diagnosis berhasil dikirim',           no_rawat: '2026/05/07/000008' },
    { id: 5, waktu: '2026-05-07 09:45:02', tipe: 'CarePlan',          status: 'sukses', pesan: 'Rencana perawatan berhasil dikirim',   no_rawat: '2026/05/07/000008' },
    { id: 6, waktu: '2026-05-06 16:30:11', tipe: 'Specimen',          status: 'pending',pesan: 'Menunggu konfirmasi server',           no_rawat: '2026/05/06/000021' },
  ]);

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard',     label: 'Dashboard',     icon: '📊' },
    { key: 'konfigurasi',   label: 'Konfigurasi',   icon: '⚙️' },
    { key: 'pasien',        label: 'Cari Pasien',   icon: '🔍' },
    { key: 'imaging-study', label: 'ImagingStudy',  icon: '🩻' },
    { key: 'log',           label: 'Log Kirim',     icon: '📋' },
  ];

  const totalSent   = RESOURCES.reduce((s, r) => s + (r.count ?? 0), 0);
  const activeRes   = RESOURCES.filter(r => (r.count ?? 0) > 0).length;
  const pendingRes  = RESOURCES.filter(r => r.count === null).length;

  const filteredResources = activeCat === 'semua'
    ? RESOURCES
    : RESOURCES.filter(r => r.category === activeCat);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const res = await fetch('/api/satu-sehat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, orthanc_url: orthancUrl, orthanc_worklist_dir: worklistDir }),
      });
      if (res.ok) {
        setConfigMsg({ type: 'success', text: 'Konfigurasi berhasil disimpan' });
      } else {
        const d = await res.json();
        setConfigMsg({ type: 'error', text: d.error || 'Gagal menyimpan' });
      }
    } catch {
      setConfigMsg({ type: 'error', text: 'Tidak dapat terhubung ke server' });
    } finally {
      setSavingConfig(false);
      setTimeout(() => setConfigMsg(null), 3000);
    }
  };

  const handleTestConn = async () => {
    setTestingConn(true);
    setConnStatus('idle');
    try {
      const res = await fetch('/api/satu-sehat/test-connection', { method: 'POST' });
      setConnStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnStatus('error');
    } finally {
      setTestingConn(false);
    }
  };

  const handleSearchPatient = async () => {
    if (!searchNik.trim()) return;
    setSearchingPatient(true);
    setPatientResult(null);
    setPatientError(null);
    try {
      const res = await fetch(`/api/satu-sehat/patient?nik=${encodeURIComponent(searchNik)}`);
      const data = await res.json();
      if (res.ok) setPatientResult(data);
      else setPatientError(data.error || 'Pasien tidak ditemukan');
    } catch {
      setPatientError('Tidak dapat terhubung ke server');
    } finally {
      setSearchingPatient(false);
    }
  };

  const statusColor = (s: LogEntry['status']) =>
    s === 'sukses' ? '#16a34a' : s === 'gagal' ? '#dc2626' : '#d97706';
  const statusBg = (s: LogEntry['status']) =>
    s === 'sukses' ? '#f0fdf4' : s === 'gagal' ? '#fef2f2' : '#fffbeb';

  const fmtCount = (n: number | null) =>
    n === null ? <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
               : <span style={{ fontWeight: 700, fontSize: 18, color: n === 0 ? '#9ca3af' : '#111827' }}>{n.toLocaleString('id-ID')}</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
        borderRadius: 16,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        color: '#fff'
      }}>
        <div style={{
          width: 44, height: 44,
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0
        }}>🏛️</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Satu Sehat</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            Integrasi Platform Data Kesehatan — Kementerian Kesehatan RI
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            background: config.is_production ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)',
            border: `1px solid ${config.is_production ? 'rgba(34,197,94,0.5)' : 'rgba(251,191,36,0.5)'}`,
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600
          }}>
            {config.is_production ? '🟢 Production' : '🟡 Sandbox'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '4px 8px',
        display: 'flex',
        gap: 4,
        width: 'fit-content'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: activeTab === tab.key ? '1px solid #d1d5db' : 'none',
              background: activeTab === tab.key ? '#f9fafb' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Data Terkirim', value: totalSent.toLocaleString('id-ID'), color: '#2563eb' },
              { label: 'Resource Aktif',       value: activeRes,                         color: '#16a34a' },
              { label: 'Belum Dikonfigurasi',  value: pendingRes,                        color: '#9ca3af' },
              { label: 'Total Resource',       value: RESOURCES.length,                  color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130
              }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['semua', 'kunjungan', 'klinis', 'obat', 'penunjang', 'lainnya'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12,
                  border: activeCat === cat ? '1px solid #2563eb' : '1px solid #e5e7eb',
                  background: activeCat === cat ? '#eff6ff' : '#fff',
                  color: activeCat === cat ? '#2563eb' : '#6b7280',
                  cursor: 'pointer', fontWeight: activeCat === cat ? 600 : 400
                }}
              >
                {cat === 'semua' ? 'Semua' : CATEGORY_LABELS[cat as ResourceItem['category']]}
              </button>
            ))}
          </div>

          {/* Resource grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {filteredResources.map(r => {
              const isClickable = r.key === 'imagingstudy';
              return (
              <div key={r.key}
                onClick={() => { if (isClickable) setActiveTab('imaging-study'); }}
                style={{
                background: '#fff',
                border: `1px solid ${isClickable ? '#bfdbfe' : (r.count ?? 0) > 0 ? '#e5e7eb' : '#f3f4f6'}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: r.count === null && !isClickable ? 0.6 : 1,
                transition: 'box-shadow 0.15s',
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = isClickable ? '0 2px 12px rgba(37,99,235,0.15)' : '0 2px 8px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{r.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.label}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    background: `${r.color}18`,
                    color: r.color,
                    padding: '1px 6px', borderRadius: 10,
                    border: `1px solid ${r.color}30`
                  }}>
                    {CATEGORY_LABELS[r.category]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{r.description}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                  {fmtCount(r.count)}
                  {r.count !== null && (
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>data terkirim</span>
                  )}
                  {r.count === null && !isClickable && (
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>belum dikonfigurasi</span>
                  )}
                  {isClickable && (
                    <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>Lihat Monitor →</span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KONFIGURASI ── */}
      {activeTab === 'konfigurasi' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, maxWidth: 560 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 20 }}>Konfigurasi Koneksi Satu Sehat</div>
          {configLoading ? (
            <div style={{ fontSize: 12, color: '#9ca3af', padding: '12px 0' }}>Memuat konfigurasi...</div>
          ) : (
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL_STYLE}>Organization ID (IHS Number Fasyankes)</label>
              <input style={INPUT_STYLE} value={config.org_id}
                onChange={e => setConfig(p => ({ ...p, org_id: e.target.value }))}
                placeholder="Contoh: 10000004" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Client ID</label>
              <input style={INPUT_STYLE} value={config.client_id}
                onChange={e => setConfig(p => ({ ...p, client_id: e.target.value }))}
                placeholder="Client ID dari developer.satusehat.kemkes.go.id" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Client Secret</label>
              <input type="password" style={INPUT_STYLE} value={config.client_secret}
                onChange={e => setConfig(p => ({ ...p, client_secret: e.target.value }))}
                placeholder="Kosongkan jika tidak ingin mengubah" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Auth URL (OAuth2)</label>
              <input style={INPUT_STYLE} value={config.auth_url}
                onChange={e => setConfig(p => ({ ...p, auth_url: e.target.value }))}
                placeholder="https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1" />
            </div>
            <div>
              <label style={LABEL_STYLE}>FHIR Base URL</label>
              <input style={INPUT_STYLE} value={config.fhir_url}
                onChange={e => setConfig(p => ({ ...p, fhir_url: e.target.value }))}
                placeholder="https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="is_production" checked={config.is_production}
                onChange={e => {
                  const prod = e.target.checked;
                  setConfig(p => ({
                    ...p,
                    is_production: prod,
                    auth_url: prod
                      ? 'https://api-satusehat.kemkes.go.id/oauth2/v1'
                      : 'https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1',
                    fhir_url: prod
                      ? 'https://api-satusehat.kemkes.go.id/fhir-r4/v1'
                      : 'https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1',
                  }));
                }}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="is_production" style={{ fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Mode Production (hilangkan centang untuk Sandbox)
              </label>
            </div>

            {/* Divider Orthanc / PACS */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                Konfigurasi PACS (Orthanc) &amp; MWL
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={LABEL_STYLE}>Orthanc REST API URL</label>
                  <input style={INPUT_STYLE} value={orthancUrl}
                    onChange={e => setOrthancUrl(e.target.value)}
                    placeholder="http://localhost:8042" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Direktori Worklist (path di server)</label>
                  <input style={INPUT_STYLE} value={worklistDir}
                    onChange={e => setWorklistDir(e.target.value)}
                    placeholder="/etc/orthanc/worklists" />
                  <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                    Folder yang dibaca oleh plugin ModalityWorklists Orthanc
                  </span>
                </div>
                <div>
                  <label style={LABEL_STYLE}>DICOM Router AE Title</label>
                  <input
                    readOnly
                    style={{ ...INPUT_STYLE, background: '#f9fafb', color: '#6b7280' }}
                    value="DICOM_ROUTER"
                    placeholder="DICOM_ROUTER (dari pengaturan server)"
                  />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={handleRegisterRouter} disabled={registeringRouter} style={{
                      padding: '6px 14px', borderRadius: 7, border: '1px solid #2563eb',
                      background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 500
                    }}>
                      {registeringRouter ? 'Mendaftarkan...' : '⚡ Daftarkan DICOM Router ke Orthanc'}
                    </button>
                    {registerMsg && (
                      <span style={{ fontSize: 11, color: registerMsg.ok ? '#16a34a' : '#dc2626' }}>
                        {registerMsg.ok ? '✓' : '✗'} {registerMsg.text}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                    Otomatis tambahkan DICOM Router ke daftar modality Orthanc (perlu Orthanc 1.9+)
                  </span>
                </div>
              </div>
            </div>
            {configMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 12,
                background: configMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: configMsg.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${configMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
              }}>{configMsg.text}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={savingConfig} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500
              }}>
                {savingConfig ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button type="button" onClick={handleTestConn} disabled={testingConn} style={{
                padding: '8px 20px', borderRadius: 8,
                border: '1px solid #d1d5db', background: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: connStatus === 'ok' ? '#16a34a' : connStatus === 'error' ? '#dc2626' : '#374151'
              }}>
                {testingConn ? 'Menguji...' : connStatus === 'ok' ? '✓ Terhubung' : connStatus === 'error' ? '✗ Gagal' : 'Tes Koneksi'}
              </button>
            </div>
          </form>
          )}
        </div>
      )}

      {/* ── CARI PASIEN ── */}
      {activeTab === 'pasien' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Cari Pasien di Satu Sehat</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...INPUT_STYLE, flex: 1 }}
                value={searchNik}
                onChange={e => setSearchNik(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchPatient()}
                placeholder="Masukkan NIK (16 digit)"
                maxLength={16}
              />
              <button onClick={handleSearchPatient}
                disabled={searchingPatient || !searchNik.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13,
                  opacity: !searchNik.trim() ? 0.5 : 1
                }}>
                {searchingPatient ? '...' : 'Cari'}
              </button>
            </div>
            {patientError && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {patientError}
              </div>
            )}
            {patientResult && (
              <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>✓ Pasien Ditemukan</div>
                <pre style={{ fontSize: 11, margin: 0, color: '#374151', overflowX: 'auto' }}>
                  {JSON.stringify(patientResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IMAGING STUDY ── */}
      {activeTab === 'imaging-study' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Sub-tab */}
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { key: 'daftar',   label: '🩻 Daftar Studi' },
              { key: 'monitor',  label: '📊 Monitor DICOM' },
              { key: 'mapping',  label: '🗺️ Mapping Modalitas' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setIsSubTab(t.key)} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: isSubTab === t.key ? '1px solid #2563eb' : '1px solid #e5e7eb',
                background: isSubTab === t.key ? '#eff6ff' : '#fff',
                color: isSubTab === t.key ? '#2563eb' : '#6b7280',
                fontWeight: isSubTab === t.key ? 600 : 400,
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Sub: Daftar Studi ── */}
          {isSubTab === 'daftar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Filter bar */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Dari</span>
                  <input type="date" value={isTglDari} onChange={e => setIsTglDari(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Sampai</span>
                  <input type="date" value={isTglSampai} onChange={e => setIsTglSampai(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }} />
                </div>
                <select value={isStatusFilter} onChange={e => setIsStatusFilter(e.target.value)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
                  <option value="">Semua Status</option>
                  <option value="terkirim">Sudah Dikirim</option>
                  <option value="belum">Belum Dikirim</option>
                </select>
                <button onClick={fetchImagingList} disabled={imagingLoading}
                  style={{ padding: '5px 16px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                  {imagingLoading ? 'Memuat...' : 'Tampilkan'}
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
                  {imagingList.length} data
                </span>
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                      <tr style={{ background: '#f9fafb' }}>
                        {['No. Order', 'Tanggal', 'Pasien', 'Pemeriksaan', 'Workflow (MWL → SR → ImagingStudy)'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {imagingLoading ? (
                        <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
                      ) : imagingList.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
                      ) : imagingList.map(item => {
                        const mwlDone  = !!mwlResults[item.noorder]?.ok;
                        const mwlMsg   = mwlResults[item.noorder];
                        const srDone   = false; // akan di-track via API
                        const srMsg    = srResults[item.noorder];
                        const isSent   = !!item.id_imagingstudy;
                        const hasMapping = item.pemeriksaan.every(p => p.modality_code);

                        const StepBtn = ({ step, done, sending, label, onClick, disabled = false }: {
                          step: number; done: boolean; sending: boolean; label: string;
                          onClick: () => void; disabled?: boolean;
                        }) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              background: done ? '#dcfce7' : '#f3f4f6',
                              color: done ? '#16a34a' : '#6b7280',
                              border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`,
                            }}>{done ? '✓' : step}</div>
                            <button onClick={onClick} disabled={sending || disabled} style={{
                              padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 500, cursor: (sending || disabled) ? 'not-allowed' : 'pointer',
                              border: `1px solid ${done ? '#bbf7d0' : disabled ? '#e5e7eb' : '#2563eb'}`,
                              background: done ? '#f0fdf4' : disabled ? '#f9fafb' : '#eff6ff',
                              color: done ? '#16a34a' : disabled ? '#9ca3af' : '#2563eb',
                              whiteSpace: 'nowrap', opacity: disabled ? 0.6 : 1,
                            }}>
                              {sending ? '...' : label}
                            </button>
                          </div>
                        );

                        return (
                          <tr key={item.noorder} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>{item.noorder}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#374151' }}>
                              {item.tgl_permintaan}<br />
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.jam_permintaan}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{item.nm_pasien}</div>
                              <div style={{ fontSize: 10, color: '#6b7280' }}>{item.no_rkm_medis}</div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {item.pemeriksaan.map(p => (
                                <div key={p.kd_jenis_prw} style={{ marginBottom: 2 }}>
                                  <span style={{ fontSize: 11 }}>{p.nm_perawatan}</span>
                                  {p.modality_code
                                    ? <span style={{ marginLeft: 4, fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: 4 }}>{p.modality_code}</span>
                                    : <span style={{ marginLeft: 4, fontSize: 10, background: '#fef3c7', color: '#d97706', padding: '1px 5px', borderRadius: 4 }}>mapping?</span>}
                                </div>
                              ))}
                            </td>

                            {/* Workflow Steps */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

                                {/* Step 1: MWL */}
                                <StepBtn step={1} done={mwlDone}
                                  sending={mwlSending.has(item.noorder)}
                                  label="Kirim ke MWL"
                                  onClick={() => handleSendMWL(item.noorder)} />
                                {mwlMsg && <div style={{ fontSize: 10, paddingLeft: 26, color: mwlMsg.ok ? '#16a34a' : '#dc2626' }}>{mwlMsg.msg}</div>}

                                {/* Step 2: ServiceRequest → Satu Sehat FHIR */}
                                <StepBtn step={2} done={srDone}
                                  sending={srSending.has(item.noorder)}
                                  label="ServiceRequest"
                                  onClick={() => handleSendServiceRequest(item.noorder)} />
                                {srMsg && <div style={{ fontSize: 10, paddingLeft: 26, color: srMsg.ok ? '#16a34a' : '#dc2626' }}>{srMsg.msg}</div>}

                                {/* Step 3: ImagingStudy (via DICOM Router otomatis / manual fallback) */}
                                <StepBtn step={3} done={isSent}
                                  sending={sendingOrders.has(item.noorder)}
                                  label={isSent ? 'ImagingStudy ✓' : 'ImagingStudy'}
                                  disabled={!hasMapping}
                                  onClick={() => handleSendImaging(item.noorder)} />
                                {sendResults[item.noorder] && (
                                  <div style={{ fontSize: 10, paddingLeft: 26, color: sendResults[item.noorder].ok ? '#16a34a' : '#dc2626' }}>
                                    {sendResults[item.noorder].msg}
                                  </div>
                                )}

                                {/* Step 4: Kirim file DICOM via Orthanc → DICOM Router */}
                                <StepBtn step={4} done={!!dicomResults[item.noorder]?.ok}
                                  sending={dicomSending.has(item.noorder)}
                                  label={dicomStudies[item.noorder] ? 'Kirim DICOM' : 'DICOM (belum ada)'}
                                  disabled={!dicomStudies[item.noorder]}
                                  onClick={() => handleSendDicom(item.noorder)} />
                                {dicomResults[item.noorder] && (
                                  <div style={{ fontSize: 10, paddingLeft: 26, color: dicomResults[item.noorder].ok ? '#16a34a' : '#dc2626' }}>
                                    {dicomResults[item.noorder].msg}
                                  </div>
                                )}
                                {!dicomStudies[item.noorder] && (
                                  <div style={{ fontSize: 9, paddingLeft: 26, color: '#9ca3af' }}>
                                    Menunggu gambar dari mesin CR AGFA
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Info */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#1e40af' }}>
                <strong>Catatan:</strong> Sebelum mengirim, pastikan (1) konfigurasi Client ID & Secret sudah diisi, (2) mapping modalitas sudah dilengkapi, (3) Encounter untuk kunjungan sudah dikirim terlebih dahulu.
              </div>
            </div>
          )}

          {/* ── Sub: Monitor DICOM ── */}
          {isSubTab === 'monitor' && (
            <DicomMonitor
              onSelectOrder={noorder => {
                setIsSubTab('daftar');
                // scroll ke order tersebut setelah daftar dimuat
              }}
            />
          )}

          {/* ── Sub: Mapping ── */}
          {isSubTab === 'mapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>
                  Petakan setiap jenis pemeriksaan radiologi ke kode DICOM dan modalitas FHIR ImagingStudy.
                </span>
                <button onClick={fetchMapping} disabled={mappingLoading}
                  style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  {mappingLoading ? 'Memuat...' : '↺ Refresh'}
                </button>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Kode', 'Nama Pemeriksaan', 'Modality Code', 'Modality Display', 'Procedure Code', 'System', 'Aksi'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappingLoading ? (
                        <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                      ) : mappingList.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada jenis pemeriksaan radiologi aktif</td></tr>
                      ) : mappingList.map(m => {
                        const ed = editingMapping[m.kd_jenis_prw] || m;
                        const saving = savingMapping.has(m.kd_jenis_prw);
                        const mapped = !!ed.modality_code;
                        return (
                          <tr key={m.kd_jenis_prw} style={{ borderBottom: '1px solid #f3f4f6', background: mapped ? '#fff' : '#fffbeb' }}>
                            <td style={{ padding: '6px 12px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{m.kd_jenis_prw}</td>
                            <td style={{ padding: '6px 12px', color: '#111827', maxWidth: 180 }}>{m.nm_perawatan}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={ed.modality_code}
                                onChange={e => {
                                  const opt = MODALITY_OPTIONS.find(o => o.code === e.target.value);
                                  setEditingMapping(prev => ({
                                    ...prev,
                                    [m.kd_jenis_prw]: { ...ed, modality_code: e.target.value, modality_display: opt?.display || '' }
                                  }));
                                }}
                                style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, minWidth: 80 }}
                              >
                                <option value="">-- pilih --</option>
                                {MODALITY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: 11, color: '#6b7280' }}>{ed.modality_display || '-'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                value={ed.code}
                                onChange={e => setEditingMapping(prev => ({ ...prev, [m.kd_jenis_prw]: { ...ed, code: e.target.value } }))}
                                placeholder="LOINC/kode"
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, width: 100 }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                value={ed.system}
                                onChange={e => setEditingMapping(prev => ({ ...prev, [m.kd_jenis_prw]: { ...ed, system: e.target.value } }))}
                                placeholder="http://loinc.org"
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, width: 160 }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <button
                                onClick={() => handleSaveMapping(m.kd_jenis_prw)}
                                disabled={saving}
                                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                              >
                                {saving ? '...' : 'Simpan'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOG ── */}
      {activeTab === 'log' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 600 }}>
            Log Pengiriman Data
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Waktu', 'Resource', 'No. Rawat', 'Status', 'Pesan'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{log.waktu}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151', fontWeight: 500 }}>{log.tipe}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#2563eb' }}>{log.no_rawat || '-'}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: statusBg(log.status),
                        color: statusColor(log.status),
                        padding: '2px 8px', borderRadius: 20,
                        border: `1px solid ${statusColor(log.status)}33`
                      }}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151' }}>{log.pesan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
