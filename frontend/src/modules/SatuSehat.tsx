import React from 'react';
import Swal from 'sweetalert2';
import { MappingRadiologi, LoincSearchBox, SpecimenSearchBox } from './MappingSatuSehat';
import { EncounterSection } from './Encounter';
import { ConditionSection } from './Condition';
import { ObservationSection } from './Observation';
import { ProcedureSection } from './Procedure';
import { MedicationSection } from './Medication';
import { MedicationRequestSection } from './MedicationRequest';
import { MedicationDispenseSection } from './MedicationDispense';
import { MedicationStatementSection } from './MedicationStatement';
import { AllergyIntoleranceSection } from './AllergyIntolerance';
import { ImagingStudySection } from './ImagingStudy';
import { ServiceRequestSection } from './ServiceRequest';
import { ClinicalImpressionSection } from './ClinicalImpression';
import { SpecimenSection } from './Specimen';
import { DiagnosticReportSection } from './DiagnosticReport';
import { CompositionSection } from './Composition';
import { ImmunizationSection } from './Immunization';
import { QuestionnaireResponseSection } from './QuestionnaireResponse';
import { CarePlanSection } from './CarePlan';
import { EpisodeOfCareSection } from './EpisodeOfCare';
import { PatientJourneySection } from './PatientJourney';
import { AutoSendSection } from './AutoSend';
import { ModalityWorklistSection } from './ModalityWorklist';

// SatuSehat.tsx — shell sidebar modul SATUSEHAT (integrasi Kemenkes),
// dibangun ulang dari kosong (sebelumnya file ini sengaja dikosongkan utk
// dibangun bertahap, persis pola ModalPermintaanRanap.tsx sebelumnya).
// Struktur & pola styling PERSIS meniru BridgingBpjsView (BridgingBpjs.tsx)
// — sidebar gradient, daftar menu utama scroll, "Pengaturan" terpisah di
// footer sidebar (bukan bagian daftar menu utama). Gradiennya sengaja
// beda warna (hijau teal, bukan biru BPJS) supaya dua modul bridging ini
// gampang dibedakan sekilas.
//
// Tahap ini BARU sidebar shell-nya saja — tiap menu masih placeholder
// (kecuali nanti diarahkan bangun satu per satu, spt pola Permintaan
// Ranap sebelumnya). Backend satu_sehat_handler.go sudah punya sebagian
// endpoint (Config/Pengaturan, ServiceRequest Radiologi, ImagingStudy),
// belum ada endpoint utk resource FHIR lain di daftar menu ini (Encounter,
// Condition, Observation, dst) — belum disambungkan di tahap ini.

type SatuSehatTab =
  | 'dashboard'
  | 'patient-journey'
  | 'auto-send'
  | 'referensi'
  | 'encounter'
  | 'condition'
  | 'observation'
  | 'procedure'
  | 'composition'
  | 'medication'
  | 'medication-request'
  | 'medication-dispense'
  | 'allergy-intolerance'
  | 'imaging-study'
  | 'modality-worklist'
  | 'service-request'
  | 'clinical-impression'
  | 'immunization'
  | 'questionnaire-response'
  | 'medication-statement'
  | 'care-plan'
  | 'specimen'
  | 'diagnostic-report'
  | 'episode-of-care'
  | 'pengaturan';

const MENU: { key: SatuSehatTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
      </svg>
    ),
  },
  {
    key: 'patient-journey',
    label: 'Perjalanan Pasien',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6"></path>
      </svg>
    ),
  },
  {
    key: 'auto-send',
    label: 'Kirim Otomatis',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path>
      </svg>
    ),
  },
  {
    key: 'referensi',
    label: 'Referensi Satu Sehat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    ),
  },
  {
    key: 'encounter',
    label: 'Encounter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    key: 'condition',
    label: 'Condition',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
      </svg>
    ),
  },
  {
    key: 'observation',
    label: 'Observation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ),
  },
  {
    key: 'procedure',
    label: 'Procedure',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3"></circle>
        <circle cx="6" cy="18" r="3"></circle>
        <path d="M20 4 8.12 15.88"></path>
        <path d="M14.47 14.48 20 20"></path>
        <path d="M8.12 8.12 12 12"></path>
      </svg>
    ),
  },
  {
    key: 'composition',
    label: 'Composition',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    ),
  },
  {
    key: 'medication',
    label: 'Medication',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path>
        <path d="m8.5 8.5 7 7"></path>
      </svg>
    ),
  },
  {
    key: 'medication-request',
    label: 'Medication Request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
  },
  {
    key: 'medication-dispense',
    label: 'Medication Dispense',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
        <path d="M3.3 7 12 12l8.7-5"></path>
        <path d="M12 22V12"></path>
      </svg>
    ),
  },
  {
    key: 'allergy-intolerance',
    label: 'Allergy Intolerance',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
  },
  {
    key: 'imaging-study',
    label: 'Imaging Study',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
      </svg>
    ),
  },
  {
    key: 'modality-worklist',
    label: 'Modality Worklist',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <line x1="8" y1="14" x2="16" y2="14"></line>
        <line x1="8" y1="18" x2="13" y2="18"></line>
      </svg>
    ),
  },
  {
    key: 'service-request',
    label: 'Service Request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1"></rect>
        <path d="m9 14 2 2 4-4"></path>
      </svg>
    ),
  },
  {
    key: 'clinical-impression',
    label: 'Clinical Impression',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path>
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path>
        <circle cx="20" cy="10" r="2"></circle>
      </svg>
    ),
  },
  {
    key: 'immunization',
    label: 'Immunization',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 2 4 4"></path>
        <path d="m17 7 3-3"></path>
        <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"></path>
        <path d="m9 11 4 4"></path>
        <path d="m5 19-3 3"></path>
        <path d="m14 4 6 6"></path>
      </svg>
    ),
  },
  {
    key: 'questionnaire-response',
    label: 'Questionnaire Response',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <path d="m9 12 2 2 4-4"></path>
      </svg>
    ),
  },
  {
    key: 'medication-statement',
    label: 'Medication Statement',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <circle cx="10" cy="15" r="2"></circle>
        <path d="M10 13v-2"></path>
      </svg>
    ),
  },
  {
    key: 'care-plan',
    label: 'Care Plan',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <path d="m9 16 2 2 4-4"></path>
      </svg>
    ),
  },
  {
    key: 'specimen',
    label: 'Specimen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2v6.4a4 4 0 0 1-.87 2.5L4.6 16.6A2 2 0 0 0 6.14 20h11.72a2 2 0 0 0 1.55-3.4l-3.53-5.7A4 4 0 0 1 15 8.4V2"></path>
        <path d="M8.5 2h7"></path>
        <path d="M7 16h10"></path>
      </svg>
    ),
  },
  {
    key: 'diagnostic-report',
    label: 'Diagnostic Report',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M9 15h1"></path>
        <path d="M9 11h6"></path>
        <path d="M12 15h3"></path>
      </svg>
    ),
  },
  {
    key: 'episode-of-care',
    label: 'Episode of Care',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
  },
];

// Dipisah dari MENU utama, ditampilkan sebagai footer di bagian paling
// bawah sidebar — persis pola SETTINGS_ITEM di BridgingBpjs.tsx.
const SETTINGS_ITEM: { key: SatuSehatTab; label: string; icon: React.ReactNode } = {
  key: 'pengaturan',
  label: 'Pengaturan',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff' }}>
    Fitur {title} akan dikembangkan nanti.
  </div>
);

// ── Referensi Satu Sehat — padanan SatuSehatReferensiPraktisi.java /
// SatuSehatReferensiPasien.java: cek NIK langsung ke FHIR Practitioner/Patient
// Satu Sehat (bukan tabel lokal), jadi pakai tombol "Cari" eksplisit (bukan
// debounce spt picker lokal) supaya tidak spam API eksternal tiap ketikan.
type ReferensiSubTab = 'praktisi' | 'pasien';

const REFERENSI_MENU: { key: ReferensiSubTab; label: string }[] = [
  { key: 'praktisi', label: 'Referensi Praktisi' },
  { key: 'pasien', label: 'Referensi Pasien' },
];

type ReferensiPraktisiRow = { kode_praktisi: string; nama_praktisi: string };
type ReferensiPasienItem = { item: string; data: string };

const ReferensiPraktisiTab: React.FC = () => {
  const [nik, setNik] = React.useState('');
  const [list, setList] = React.useState<ReferensiPraktisiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const handleCari = async () => {
    if (!nik.trim()) {
      Swal.fire({ icon: 'warning', title: 'NIK belum diisi', text: 'Masukkan NIK praktisi terlebih dahulu' });
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/satu-sehat/referensi/praktisi?nik=${encodeURIComponent(nik.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencari praktisi');
      setList(Array.isArray(data.list) ? data.list : []);
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={nik}
          onChange={(e) => setNik(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCari()}
          placeholder="Masukkan NIK praktisi..."
          style={{ ...inputSm, width: 300 }}
        />
        <button
          type="button"
          onClick={handleCari}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#059669', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Kode Praktisi', 'Nama Praktisi'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Mencari...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>{searched ? 'Praktisi tidak ditemukan' : 'Masukkan NIK lalu klik Cari'}</td></tr>
            ) : (
              list.map((row, i) => (
                <tr key={`${row.kode_praktisi}-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_praktisi}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_praktisi}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReferensiPasienTab: React.FC = () => {
  const [nik, setNik] = React.useState('');
  const [list, setList] = React.useState<ReferensiPasienItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const handleCari = async () => {
    if (!nik.trim()) {
      Swal.fire({ icon: 'warning', title: 'NIK belum diisi', text: 'Masukkan NIK pasien terlebih dahulu' });
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/satu-sehat/referensi/pasien?nik=${encodeURIComponent(nik.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencari pasien');
      setList(Array.isArray(data.list) ? data.list : []);
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={nik}
          onChange={(e) => setNik(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCari()}
          placeholder="Masukkan NIK pasien..."
          style={{ ...inputSm, width: 300 }}
        />
        <button
          type="button"
          onClick={handleCari}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#059669', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', maxWidth: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Item', 'Data'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Mencari...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>{searched ? 'Pasien tidak ditemukan' : 'Masukkan NIK lalu klik Cari'}</td></tr>
            ) : (
              list.map((row, i) => (
                <tr key={`${row.item}-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.item}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.data || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReferensiSection: React.FC = () => {
  const [sub, setSub] = React.useState<ReferensiSubTab>('praktisi');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
        {REFERENSI_MENU.map((m) => {
          const active = sub === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSub(m.key)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: active ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: active ? '#059669' : '#6b7280',
                fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {sub === 'praktisi' && <ReferensiPraktisiTab />}
        {sub === 'pasien' && <ReferensiPasienTab />}
      </div>
    </div>
  );
};

// ── Pengaturan Satu Sehat — 6 kategori mapping lokal <-> referensi Satu
// Sehat, tab horizontal terpisah dari sidebar utama (persis pola tab
// header di MappingSatuSehatView). "Mapping Tindakan Radiologi" reuse
// komponen MappingRadiologi yg sudah ada & teruji (dipakai jg di menu
// "Mapping Satu Sehat" lama) — 5 kategori lain masih placeholder,
// menyusul dibangun satu per satu.
type PengaturanSubTab =
  | 'konfigurasi'
  | 'organisasi'
  | 'lokasi'
  | 'vaksin'
  | 'obat-alkes-bhp'
  | 'tindakan-radiologi'
  | 'tindakan-laboratorium';

const PENGATURAN_MENU: { key: PengaturanSubTab; label: string }[] = [
  { key: 'konfigurasi', label: 'Konfigurasi' },
  { key: 'organisasi', label: 'Mapping Organisasi' },
  { key: 'lokasi', label: 'Mapping Lokasi' },
  { key: 'vaksin', label: 'Mapping Vaksin' },
  { key: 'obat-alkes-bhp', label: 'Mapping Obat/Alkes/BHP' },
  { key: 'tindakan-radiologi', label: 'Mapping Tindakan Radiologi' },
  { key: 'tindakan-laboratorium', label: 'Mapping Tindakan Laboratorium PK & MB' },
];

// ── Mapping Organisasi — padanan DlgMappingOrganisasiSatuSehat.java: tabel
// satu_sehat_mapping_departemen INNER JOIN departemen (cuma yg sudah
// dipetakan yg tampil di daftar utama, persis tampil() Java), + modal
// "Tambah Mapping" utk departemen yang belum dipetakan (dropdown biasa,
// departemen cuma segelintir jadi tidak perlu search-as-you-type).
type MappingOrganisasiRow = { dep_id: string; nama_departemen: string; id_organisasi_satusehat: string };
type DepartemenBelumMapping = { dep_id: string; nama: string };

const MappingOrganisasiSection: React.FC = () => {
  const [list, setList] = React.useState<MappingOrganisasiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [savingDep, setSavingDep] = React.useState<string | null>(null);

  const [showTambah, setShowTambah] = React.useState(false);
  const [belumMapping, setBelumMapping] = React.useState<DepartemenBelumMapping[]>([]);
  const [tambahDepId, setTambahDepId] = React.useState('');
  const [tambahId, setTambahId] = React.useState('');
  const [savingTambah, setSavingTambah] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-organisasi?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const rows: MappingOrganisasiRow[] = Array.isArray(data.list) ? data.list : [];
      setList(rows);
      setEdits(Object.fromEntries(rows.map((r) => [r.dep_id, r.id_organisasi_satusehat])));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const openTambah = async () => {
    setTambahDepId('');
    setTambahId('');
    setShowTambah(true);
    try {
      const res = await fetch('/api/satu-sehat/departemen-belum-mapping');
      const data = await res.json();
      setBelumMapping(Array.isArray(data.list) ? data.list : []);
    } catch {
      setBelumMapping([]);
    }
  };

  const handleSaveRow = async (depId: string) => {
    const idOrganisasi = (edits[depId] || '').trim();
    if (!idOrganisasi) {
      Swal.fire({ icon: 'warning', title: 'ID Organisasi kosong', text: 'Isi ID Organisasi Satu Sehat dulu' });
      return;
    }
    setSavingDep(depId);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-organisasi/${encodeURIComponent(depId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_organisasi_satusehat: idOrganisasi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping');
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1200, showConfirmButton: false });
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSavingDep(null);
    }
  };

  const handleDeleteRow = async (row: MappingOrganisasiRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping?',
      html: `Mapping departemen <strong>${row.nama_departemen}</strong> akan dihapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-organisasi/${encodeURIComponent(row.dep_id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const handleSaveTambah = async () => {
    if (!tambahDepId || !tambahId.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Pilih departemen dan isi ID Organisasi Satu Sehat' });
      return;
    }
    setSavingTambah(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-organisasi/${encodeURIComponent(tambahDepId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_organisasi_satusehat: tambahId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping');
      setShowTambah(false);
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSavingTambah(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode/nama departemen atau ID Organisasi..."
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', width: 320, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={openTambah}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Tambah Mapping
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>Kode Departemen</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>Nama Departemen</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>ID Organisasi Satu Sehat</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 140 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping organisasi</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.dep_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', color: '#374151' }}>{row.dep_id}</td>
                  <td style={{ padding: '6px 12px', color: '#111827' }}>{row.nama_departemen}</td>
                  <td style={{ padding: '6px 12px' }}>
                    <input
                      type="text"
                      value={edits[row.dep_id] ?? ''}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.dep_id]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleSaveRow(row.dep_id)}
                        disabled={savingDep === row.dep_id}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11.5, fontWeight: 500 }}
                      >
                        {savingDep === row.dep_id ? '...' : 'Simpan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11.5, fontWeight: 500 }}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTambah && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }}
          onClick={() => setShowTambah(false)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 380, maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Tambah Mapping Organisasi</div>
              <button type="button" onClick={() => setShowTambah(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Departemen</label>
              <select
                value={tambahDepId}
                onChange={(e) => setTambahDepId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">-- Pilih Departemen --</option>
                {belumMapping.map((d) => (
                  <option key={d.dep_id} value={d.dep_id}>{d.nama}</option>
                ))}
              </select>
              {belumMapping.length === 0 && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>Semua departemen sudah punya mapping.</div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>ID Organisasi Satu Sehat</label>
              <input
                type="text"
                value={tambahId}
                onChange={(e) => setTambahId(e.target.value)}
                placeholder="ID organisasi dari portal Satu Sehat"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowTambah(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTambah}
                disabled={savingTambah}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingTambah ? '#9ca3af' : '#059669', color: '#fff', cursor: savingTambah ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                {savingTambah ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Mapping Lokasi — padanan SatuSehatMapingLokasi.java: 8 kategori lokasi,
// 3 (Poli/Kamar/Depo Farmasi) punya kode unit lokal + pencarian, 5 lainnya
// (Ruang OK/Lab PK/Lab PA/Lab MB/Radiologi) lokasi global tanpa kode unit &
// tanpa pencarian (persis tampil() Java). Semua baris WAJIB pilih ID
// Organisasi Satu Sehat yg SUDAH ada di Mapping Organisasi (dropdown,
// reuse GET /api/satu-sehat/mapping-organisasi).
type LokasiKategoriUnit = 'ralan' | 'ranap' | 'depo-farmasi';
type LokasiKategoriGlobal = 'ruang-ok' | 'ruang-lab-pk' | 'ruang-lab-pa' | 'ruang-lab-mb' | 'ruang-radiologi';
type LokasiSubTab = LokasiKategoriUnit | LokasiKategoriGlobal;

const LOKASI_UNIT_KATEGORI = new Set<LokasiSubTab>(['ralan', 'ranap', 'depo-farmasi']);

const LOKASI_MENU: { key: LokasiSubTab; label: string }[] = [
  { key: 'ralan', label: 'Poli / Rawat Jalan' },
  { key: 'ranap', label: 'Kamar / Rawat Inap' },
  { key: 'ruang-ok', label: 'Ruang OK' },
  { key: 'ruang-lab-pk', label: 'Ruang Lab PK' },
  { key: 'ruang-lab-pa', label: 'Ruang Lab PA' },
  { key: 'ruang-lab-mb', label: 'Ruang Lab MB' },
  { key: 'ruang-radiologi', label: 'Ruang Radiologi' },
  { key: 'depo-farmasi', label: 'Depo Farmasi' },
];

const LOKASI_UNIT_LABELS: Record<LokasiKategoriUnit, { kode: string; nama: string }> = {
  ralan: { kode: 'Kode Unit', nama: 'Nama Unit' },
  ranap: { kode: 'Nomor Ruang', nama: 'Kamar/Ruang' },
  'depo-farmasi': { kode: 'Kode Farmasi', nama: 'Nama Depo Farmasi' },
};

type MappingLokasiUnitRow = {
  kode_unit: string; nama_unit: string; id_lokasi_satusehat: string;
  longitude: string; latitude: string; altitude: string;
  dep_id: string; nama_departemen: string; id_organisasi_satusehat: string;
};
type MappingLokasiGlobalRow = {
  id_lokasi_satusehat: string; longitude: string; latitude: string; altitude: string;
  dep_id: string; nama_departemen: string; id_organisasi_satusehat: string;
};
type OrganisasiOption = { dep_id: string; nama_departemen: string; id_organisasi_satusehat: string };
type UnitOption = { kode: string; nama: string };

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// LokasiFormModal — dipakai bareng oleh kategori unit & global (kode unit
// disembunyikan/readonly utk kategori global krn tidak ada konsep unit lokal).
const LokasiFormModal: React.FC<{
  title: string;
  showUnitField: boolean;
  unitLabel?: string;
  unitOptions?: UnitOption[];
  fixedUnitLabel?: string; // dipakai saat mode edit (kode unit tidak bisa diganti)
  organisasiOptions: OrganisasiOption[];
  initial: { kode: string; idLokasi: string; longitude: string; latitude: string; altitude: string; idOrganisasi: string };
  onClose: () => void;
  onSave: (v: { kode: string; idLokasi: string; longitude: string; latitude: string; altitude: string; idOrganisasi: string }) => void;
  saving: boolean;
}> = ({ title, showUnitField, unitLabel, unitOptions, fixedUnitLabel, organisasiOptions, initial, onClose, onSave, saving }) => {
  const [kode, setKode] = React.useState(initial.kode);
  const [idLokasi, setIdLokasi] = React.useState(initial.idLokasi);
  const [longitude, setLongitude] = React.useState(initial.longitude);
  const [latitude, setLatitude] = React.useState(initial.latitude);
  const [altitude, setAltitude] = React.useState(initial.altitude);
  const [idOrganisasi, setIdOrganisasi] = React.useState(initial.idOrganisasi);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 420, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {showUnitField && (
          fixedUnitLabel ? (
            <div>
              <label style={labelSm}>{unitLabel}</label>
              <input type="text" value={fixedUnitLabel} readOnly style={{ ...inputSm, background: '#f9fafb', color: '#6b7280' }} />
            </div>
          ) : (
            <div>
              <label style={labelSm}>{unitLabel}</label>
              <select value={kode} onChange={(e) => setKode(e.target.value)} style={inputSm}>
                <option value="">-- Pilih --</option>
                {(unitOptions || []).map((u) => (
                  <option key={u.kode} value={u.kode}>{u.nama}</option>
                ))}
              </select>
              {(unitOptions || []).length === 0 && <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>Semua unit sudah punya mapping.</div>}
            </div>
          )
        )}

        <div>
          <label style={labelSm}>ID Lokasi Satu Sehat</label>
          <input type="text" value={idLokasi} onChange={(e) => setIdLokasi(e.target.value)} style={inputSm} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Longitude</label>
            <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Latitude</label>
            <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Altitude</label>
            <input type="text" value={altitude} onChange={(e) => setAltitude(e.target.value)} style={inputSm} />
          </div>
        </div>
        <div>
          <label style={labelSm}>ID Organisasi Satu Sehat (Departemen)</label>
          <select value={idOrganisasi} onChange={(e) => setIdOrganisasi(e.target.value)} style={inputSm}>
            <option value="">-- Pilih Departemen --</option>
            {organisasiOptions.map((o) => (
              <option key={o.dep_id} value={o.id_organisasi_satusehat}>{o.nama_departemen} ({o.id_organisasi_satusehat})</option>
            ))}
          </select>
          {organisasiOptions.length === 0 && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>Belum ada data di Mapping Organisasi — isi dulu di sana.</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave({ kode, idLokasi, longitude, latitude, altitude, idOrganisasi })}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MappingLokasiUnitTable: React.FC<{ kategori: LokasiKategoriUnit }> = ({ kategori }) => {
  const labels = LOKASI_UNIT_LABELS[kategori];
  const [list, setList] = React.useState<MappingLokasiUnitRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [organisasiOptions, setOrganisasiOptions] = React.useState<OrganisasiOption[]>([]);
  const [unitOptions, setUnitOptions] = React.useState<UnitOption[]>([]);
  const [modal, setModal] = React.useState<{ mode: 'tambah' | 'edit'; row?: MappingLokasiUnitRow } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi/${kategori}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [kategori]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const fetchOrganisasiOptions = async () => {
    try {
      const res = await fetch('/api/satu-sehat/mapping-organisasi');
      const data = await res.json();
      setOrganisasiOptions(Array.isArray(data.list) ? data.list : []);
    } catch {
      setOrganisasiOptions([]);
    }
  };

  const openTambah = async () => {
    await fetchOrganisasiOptions();
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi/${kategori}/unit-belum-mapping`);
      const data = await res.json();
      setUnitOptions(Array.isArray(data.list) ? data.list : []);
    } catch {
      setUnitOptions([]);
    }
    setModal({ mode: 'tambah' });
  };

  const openEdit = async (row: MappingLokasiUnitRow) => {
    await fetchOrganisasiOptions();
    setModal({ mode: 'edit', row });
  };

  const handleSave = async (v: { kode: string; idLokasi: string; longitude: string; latitude: string; altitude: string; idOrganisasi: string }) => {
    if (!v.kode || !v.idLokasi.trim() || !v.idOrganisasi) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Pilih unit, isi ID Lokasi, dan pilih departemen' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi/${kategori}/${encodeURIComponent(v.kode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lokasi_satusehat: v.idLokasi.trim(), longitude: v.longitude, latitude: v.latitude, altitude: v.altitude, id_organisasi_satusehat: v.idOrganisasi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping lokasi');
      setModal(null);
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MappingLokasiUnitRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping Lokasi?',
      html: `Mapping lokasi <strong>${row.nama_unit}</strong> akan dihapus.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi/${kategori}/${encodeURIComponent(row.kode_unit)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode/nama unit, departemen..." style={{ ...inputSm, width: 320 }} />
        <button type="button" onClick={openTambah} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Tambah Mapping</button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{labels.kode}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{labels.nama}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>ID Lokasi Satu Sehat</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Longitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Latitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Altitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Kode Departemen</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Nama Departemen</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>ID Organisasi Satu Sehat</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 140 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping lokasi</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.kode_unit} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_unit}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_unit}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.id_lokasi_satusehat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.longitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.latitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.altitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.dep_id}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_departemen}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.id_organisasi_satusehat}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button type="button" onClick={() => openEdit(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <LokasiFormModal
          title={modal.mode === 'tambah' ? 'Tambah Mapping Lokasi' : 'Edit Mapping Lokasi'}
          showUnitField
          unitLabel={labels.kode}
          unitOptions={unitOptions}
          fixedUnitLabel={modal.mode === 'edit' ? `${modal.row!.kode_unit} — ${modal.row!.nama_unit}` : undefined}
          organisasiOptions={organisasiOptions}
          initial={{
            kode: modal.row?.kode_unit || '',
            idLokasi: modal.row?.id_lokasi_satusehat || '',
            longitude: modal.row?.longitude || '',
            latitude: modal.row?.latitude || '',
            altitude: modal.row?.altitude || '',
            idOrganisasi: modal.row?.id_organisasi_satusehat || '',
          }}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

const MappingLokasiGlobalTable: React.FC<{ kategori: LokasiKategoriGlobal }> = ({ kategori }) => {
  const [list, setList] = React.useState<MappingLokasiGlobalRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [organisasiOptions, setOrganisasiOptions] = React.useState<OrganisasiOption[]>([]);
  const [showTambah, setShowTambah] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi-global/${kategori}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [kategori]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const openTambah = async () => {
    try {
      const res = await fetch('/api/satu-sehat/mapping-organisasi');
      const data = await res.json();
      setOrganisasiOptions(Array.isArray(data.list) ? data.list : []);
    } catch {
      setOrganisasiOptions([]);
    }
    setShowTambah(true);
  };

  const handleSave = async (v: { idLokasi: string; longitude: string; latitude: string; altitude: string; idOrganisasi: string }) => {
    if (!v.idLokasi.trim() || !v.idOrganisasi) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Isi ID Lokasi dan pilih departemen' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi-global/${kategori}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lokasi_satusehat: v.idLokasi.trim(), longitude: v.longitude, latitude: v.latitude, altitude: v.altitude, id_organisasi_satusehat: v.idOrganisasi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping lokasi');
      setShowTambah(false);
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MappingLokasiGlobalRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping Lokasi?',
      html: `Mapping lokasi <strong>${row.id_lokasi_satusehat}</strong> akan dihapus.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lokasi-global/${kategori}/${encodeURIComponent(row.id_lokasi_satusehat)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={openTambah} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Tambah Mapping</button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>ID Lokasi Satu Sehat</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Longitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Latitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Altitude</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Kode Departemen</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Nama Departemen</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>ID Organisasi Satu Sehat</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 90 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping lokasi</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.id_lokasi_satusehat} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.id_lokasi_satusehat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.longitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.latitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.altitude}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.dep_id}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_departemen}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.id_organisasi_satusehat}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <button type="button" onClick={() => handleDelete(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTambah && (
        <LokasiFormModal
          title="Tambah Mapping Lokasi"
          showUnitField={false}
          organisasiOptions={organisasiOptions}
          initial={{ kode: '', idLokasi: '', longitude: '', latitude: '', altitude: '', idOrganisasi: '' }}
          onClose={() => setShowTambah(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

const MappingLokasiSection: React.FC = () => {
  const [sub, setSub] = React.useState<LokasiSubTab>('ralan');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
        {LOKASI_MENU.map((m) => {
          const active = sub === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSub(m.key)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: active ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: active ? '#059669' : '#6b7280',
                fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {LOKASI_UNIT_KATEGORI.has(sub) ? (
          <MappingLokasiUnitTable kategori={sub as LokasiKategoriUnit} />
        ) : (
          <MappingLokasiGlobalTable kategori={sub as LokasiKategoriGlobal} />
        )}
      </div>
    </div>
  );
};

// ── Mapping Vaksin — padanan SatuSehatMapingVaksin.java: tabel
// satu_sehat_mapping_vaksin INNER JOIN databarang. databarang punya 2000+
// baris jadi picker "Tambah" pakai search-as-you-type (debounced), bukan
// dropdown biasa spt Mapping Organisasi/Lokasi.
type MappingVaksinRow = {
  vaksin_code: string; vaksin_system: string; kode_brng: string; nama_brng: string;
  vaksin_display: string; route_code: string; route_system: string; route_display: string;
  dose_quantity_code: string; dose_quantity_system: string; dose_quantity_unit: string;
};
type ObatOption = { kode_brng: string; nama_brng: string };

type VaksinFormValues = {
  vaksinCode: string; vaksinSystem: string; vaksinDisplay: string;
  routeCode: string; routeSystem: string; routeDisplay: string;
  doseCode: string; doseSystem: string; doseUnit: string;
};

const VaksinFormModal: React.FC<{
  title: string;
  fixedObat?: { kode: string; nama: string }; // mode edit: obat sudah tetap
  initial: VaksinFormValues;
  onClose: () => void;
  onSave: (kodeBrng: string, v: VaksinFormValues) => void;
  saving: boolean;
}> = ({ title, fixedObat, initial, onClose, onSave, saving }) => {
  const [obatSearch, setObatSearch] = React.useState('');
  const [obatResults, setObatResults] = React.useState<ObatOption[]>([]);
  const [obatLoading, setObatLoading] = React.useState(false);
  const [selectedObat, setSelectedObat] = React.useState<ObatOption | null>(fixedObat ? { kode_brng: fixedObat.kode, nama_brng: fixedObat.nama } : null);
  const [v, setV] = React.useState<VaksinFormValues>(initial);

  React.useEffect(() => {
    if (fixedObat) return;
    const t = setTimeout(async () => {
      if (!obatSearch.trim()) { setObatResults([]); return; }
      setObatLoading(true);
      try {
        const res = await fetch(`/api/satu-sehat/mapping-vaksin/cari-obat?q=${encodeURIComponent(obatSearch.trim())}`);
        const data = await res.json();
        setObatResults(Array.isArray(data.list) ? data.list : []);
      } catch {
        setObatResults([]);
      } finally {
        setObatLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [obatSearch, fixedObat]);

  const set = (key: keyof VaksinFormValues, val: string) => setV((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 480, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {fixedObat ? (
          <div>
            <label style={labelSm}>Kode Vaksin / Nama Vaksin</label>
            <input type="text" readOnly value={`${fixedObat.kode} — ${fixedObat.nama}`} style={{ ...inputSm, background: '#f9fafb', color: '#6b7280' }} />
          </div>
        ) : (
          <div>
            <label style={labelSm}>Cari Obat/Vaksin (kode atau nama)</label>
            <input
              type="text"
              value={obatSearch}
              onChange={(e) => { setObatSearch(e.target.value); setSelectedObat(null); }}
              placeholder="Ketik nama atau kode obat..."
              style={inputSm}
              autoFocus
            />
            {selectedObat && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12, color: '#065f46' }}>
                Terpilih: {selectedObat.kode_brng} — {selectedObat.nama_brng}
              </div>
            )}
            {!selectedObat && obatSearch.trim() && (
              <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
                {obatLoading ? (
                  <div style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>Mencari...</div>
                ) : obatResults.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: '#9ca3af' }}>Tidak ada hasil</div>
                ) : (
                  obatResults.map((o) => (
                    <div
                      key={o.kode_brng}
                      onClick={() => { setSelectedObat(o); setObatSearch(''); }}
                      style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <strong>{o.kode_brng}</strong> — {o.nama_brng}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Vaksin Code</label>
            <input type="text" value={v.vaksinCode} onChange={(e) => set('vaksinCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Vaksin System</label>
            <input type="text" value={v.vaksinSystem} onChange={(e) => set('vaksinSystem', e.target.value)} style={inputSm} placeholder="http://..." />
          </div>
        </div>
        <div>
          <label style={labelSm}>Vaksin Display</label>
          <input type="text" value={v.vaksinDisplay} onChange={(e) => set('vaksinDisplay', e.target.value)} style={inputSm} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Route Code</label>
            <input type="text" value={v.routeCode} onChange={(e) => set('routeCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Route System</label>
            <input type="text" value={v.routeSystem} onChange={(e) => set('routeSystem', e.target.value)} style={inputSm} placeholder="http://..." />
          </div>
        </div>
        <div>
          <label style={labelSm}>Route Display</label>
          <input type="text" value={v.routeDisplay} onChange={(e) => set('routeDisplay', e.target.value)} style={inputSm} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Dose Code</label>
            <input type="text" value={v.doseCode} onChange={(e) => set('doseCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Dose System</label>
            <input type="text" value={v.doseSystem} onChange={(e) => set('doseSystem', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Dose Unit</label>
            <input type="text" value={v.doseUnit} onChange={(e) => set('doseUnit', e.target.value)} style={inputSm} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => selectedObat && onSave(selectedObat.kode_brng, v)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MappingVaksinSection: React.FC = () => {
  const [list, setList] = React.useState<MappingVaksinRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState<{ mode: 'tambah' | 'edit'; row?: MappingVaksinRow } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-vaksin?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const handleSave = async (kodeBrng: string, v: VaksinFormValues) => {
    if (!v.vaksinCode.trim() || !v.vaksinSystem.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Vaksin Code dan Vaksin System wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-vaksin/${encodeURIComponent(kodeBrng)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaksin_code: v.vaksinCode, vaksin_system: v.vaksinSystem, vaksin_display: v.vaksinDisplay,
          route_code: v.routeCode, route_system: v.routeSystem, route_display: v.routeDisplay,
          dose_quantity_code: v.doseCode, dose_quantity_system: v.doseSystem, dose_quantity_unit: v.doseUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping vaksin');
      setModal(null);
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MappingVaksinRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping Vaksin?',
      html: `Mapping vaksin <strong>${row.nama_brng}</strong> akan dihapus.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-vaksin/${encodeURIComponent(row.kode_brng)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const emptyForm: VaksinFormValues = { vaksinCode: '', vaksinSystem: '', vaksinDisplay: '', routeCode: '', routeSystem: '', routeDisplay: '', doseCode: '', doseSystem: '', doseUnit: '' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode/nama obat, vaksin code/display, route..." style={{ ...inputSm, width: 340 }} />
        <button type="button" onClick={() => setModal({ mode: 'tambah' })} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Tambah Mapping</button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Vaksin Code', 'Vaksin System', 'Kode Vaksin', 'Nama Vaksin', 'Vaksin Display', 'Route Code', 'Route System', 'Route Display', 'Dose Code', 'Dose System', 'Dose Unit'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 140 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping vaksin</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.kode_brng} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.vaksin_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.vaksin_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_brng}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_brng}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.vaksin_display}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.route_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.route_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.route_display}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.dose_quantity_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.dose_quantity_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.dose_quantity_unit}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button type="button" onClick={() => setModal({ mode: 'edit', row })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <VaksinFormModal
          title={modal.mode === 'tambah' ? 'Tambah Mapping Vaksin' : 'Edit Mapping Vaksin'}
          fixedObat={modal.mode === 'edit' ? { kode: modal.row!.kode_brng, nama: modal.row!.nama_brng } : undefined}
          initial={modal.mode === 'edit' ? {
            vaksinCode: modal.row!.vaksin_code, vaksinSystem: modal.row!.vaksin_system, vaksinDisplay: modal.row!.vaksin_display,
            routeCode: modal.row!.route_code, routeSystem: modal.row!.route_system, routeDisplay: modal.row!.route_display,
            doseCode: modal.row!.dose_quantity_code, doseSystem: modal.row!.dose_quantity_system, doseUnit: modal.row!.dose_quantity_unit,
          } : emptyForm}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

// ── Mapping Obat/Alkes/BHP — padanan SatuSehatMapingObat.java: tabel
// satu_sehat_mapping_obat INNER JOIN databarang. databarang punya 2000+
// baris jadi picker "Tambah" pakai search-as-you-type (debounced), sama
// seperti Mapping Vaksin.
type MappingObatRow = {
  obat_code: string; obat_system: string; kode_brng: string; nama_brng: string;
  obat_display: string; form_code: string; form_system: string; form_display: string;
  numerator_code: string; numerator_system: string; denominator_code: string; denominator_system: string;
  route_code: string; route_system: string; route_display: string;
};

type ObatFormValues = {
  obatCode: string; obatSystem: string; obatDisplay: string;
  formCode: string; formSystem: string; formDisplay: string;
  numeratorCode: string; numeratorSystem: string;
  denominatorCode: string; denominatorSystem: string;
  routeCode: string; routeSystem: string; routeDisplay: string;
};

const ObatFormModal: React.FC<{
  title: string;
  fixedObat?: { kode: string; nama: string }; // mode edit: obat sudah tetap
  initial: ObatFormValues;
  onClose: () => void;
  onSave: (kodeBrng: string, v: ObatFormValues) => void;
  saving: boolean;
}> = ({ title, fixedObat, initial, onClose, onSave, saving }) => {
  const [obatSearch, setObatSearch] = React.useState('');
  const [obatResults, setObatResults] = React.useState<ObatOption[]>([]);
  const [obatLoading, setObatLoading] = React.useState(false);
  const [selectedObat, setSelectedObat] = React.useState<ObatOption | null>(fixedObat ? { kode_brng: fixedObat.kode, nama_brng: fixedObat.nama } : null);
  const [v, setV] = React.useState<ObatFormValues>(initial);

  React.useEffect(() => {
    if (fixedObat) return;
    const t = setTimeout(async () => {
      if (!obatSearch.trim()) { setObatResults([]); return; }
      setObatLoading(true);
      try {
        const res = await fetch(`/api/satu-sehat/mapping-obat/cari-obat?q=${encodeURIComponent(obatSearch.trim())}`);
        const data = await res.json();
        setObatResults(Array.isArray(data.list) ? data.list : []);
      } catch {
        setObatResults([]);
      } finally {
        setObatLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [obatSearch, fixedObat]);

  const set = (key: keyof ObatFormValues, val: string) => setV((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 520, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {fixedObat ? (
          <div>
            <label style={labelSm}>Kode Barang / Nama Obat</label>
            <input type="text" readOnly value={`${fixedObat.kode} — ${fixedObat.nama}`} style={{ ...inputSm, background: '#f9fafb', color: '#6b7280' }} />
          </div>
        ) : (
          <div>
            <label style={labelSm}>Cari Obat/Alkes/BHP (kode atau nama)</label>
            <input
              type="text"
              value={obatSearch}
              onChange={(e) => { setObatSearch(e.target.value); setSelectedObat(null); }}
              placeholder="Ketik nama atau kode barang..."
              style={inputSm}
              autoFocus
            />
            {selectedObat && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12, color: '#065f46' }}>
                Terpilih: {selectedObat.kode_brng} — {selectedObat.nama_brng}
              </div>
            )}
            {!selectedObat && obatSearch.trim() && (
              <div style={{ marginTop: 6, border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
                {obatLoading ? (
                  <div style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>Mencari...</div>
                ) : obatResults.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: '#9ca3af' }}>Tidak ada hasil</div>
                ) : (
                  obatResults.map((o) => (
                    <div
                      key={o.kode_brng}
                      onClick={() => { setSelectedObat(o); setObatSearch(''); }}
                      style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <strong>{o.kode_brng}</strong> — {o.nama_brng}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>KFA Code (Obat Code)</label>
            <input type="text" value={v.obatCode} onChange={(e) => set('obatCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>KFA System (Obat System)</label>
            <input type="text" value={v.obatSystem} onChange={(e) => set('obatSystem', e.target.value)} style={inputSm} placeholder="http://..." />
          </div>
        </div>
        <div>
          <label style={labelSm}>KFA Display (Obat Display)</label>
          <input type="text" value={v.obatDisplay} onChange={(e) => set('obatDisplay', e.target.value)} style={inputSm} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Form Code</label>
            <input type="text" value={v.formCode} onChange={(e) => set('formCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Form System</label>
            <input type="text" value={v.formSystem} onChange={(e) => set('formSystem', e.target.value)} style={inputSm} placeholder="http://..." />
          </div>
        </div>
        <div>
          <label style={labelSm}>Form Display</label>
          <input type="text" value={v.formDisplay} onChange={(e) => set('formDisplay', e.target.value)} style={inputSm} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Numerator Code</label>
            <input type="text" value={v.numeratorCode} onChange={(e) => set('numeratorCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Numerator System</label>
            <input type="text" value={v.numeratorSystem} onChange={(e) => set('numeratorSystem', e.target.value)} style={inputSm} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Denominator Code</label>
            <input type="text" value={v.denominatorCode} onChange={(e) => set('denominatorCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Denominator System</label>
            <input type="text" value={v.denominatorSystem} onChange={(e) => set('denominatorSystem', e.target.value)} style={inputSm} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelSm}>Route Code</label>
            <input type="text" value={v.routeCode} onChange={(e) => set('routeCode', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Route System</label>
            <input type="text" value={v.routeSystem} onChange={(e) => set('routeSystem', e.target.value)} style={inputSm} />
          </div>
        </div>
        <div>
          <label style={labelSm}>Route Display</label>
          <input type="text" value={v.routeDisplay} onChange={(e) => set('routeDisplay', e.target.value)} style={inputSm} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => selectedObat && onSave(selectedObat.kode_brng, v)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MappingObatSection: React.FC = () => {
  const [list, setList] = React.useState<MappingObatRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState<{ mode: 'tambah' | 'edit'; row?: MappingObatRow } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-obat?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const handleSave = async (kodeBrng: string, v: ObatFormValues) => {
    if (!v.obatCode.trim() || !v.obatSystem.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'KFA Code dan KFA System wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-obat/${encodeURIComponent(kodeBrng)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obat_code: v.obatCode, obat_system: v.obatSystem, obat_display: v.obatDisplay,
          form_code: v.formCode, form_system: v.formSystem, form_display: v.formDisplay,
          numerator_code: v.numeratorCode, numerator_system: v.numeratorSystem,
          denominator_code: v.denominatorCode, denominator_system: v.denominatorSystem,
          route_code: v.routeCode, route_system: v.routeSystem, route_display: v.routeDisplay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping obat');
      setModal(null);
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MappingObatRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping Obat?',
      html: `Mapping obat <strong>${row.nama_brng}</strong> akan dihapus.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-obat/${encodeURIComponent(row.kode_brng)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const emptyForm: ObatFormValues = {
    obatCode: '', obatSystem: '', obatDisplay: '',
    formCode: '', formSystem: '', formDisplay: '',
    numeratorCode: '', numeratorSystem: '',
    denominatorCode: '', denominatorSystem: '',
    routeCode: '', routeSystem: '', routeDisplay: '',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode/nama barang, obat code/display, form, route..." style={{ ...inputSm, width: 340 }} />
        <button type="button" onClick={() => setModal({ mode: 'tambah' })} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Tambah Mapping</button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['KFA Code', 'KFA System', 'Kode Barang', 'Nama Obat/Alkes/BHP', 'KFA Display', 'Form Code', 'Form System', 'Form Display', 'Numerator Code', 'Numerator System', 'Denominator Code', 'Denominator System', 'Route Code', 'Route System', 'Route Display'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 140 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping obat/alkes/bhp</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.kode_brng} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.obat_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.obat_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_brng}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_brng}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.obat_display}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.form_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.form_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.form_display}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.numerator_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.numerator_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.denominator_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.denominator_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.route_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.route_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.route_display}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button type="button" onClick={() => setModal({ mode: 'edit', row })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ObatFormModal
          title={modal.mode === 'tambah' ? 'Tambah Mapping Obat/Alkes/BHP' : 'Edit Mapping Obat/Alkes/BHP'}
          fixedObat={modal.mode === 'edit' ? { kode: modal.row!.kode_brng, nama: modal.row!.nama_brng } : undefined}
          initial={modal.mode === 'edit' ? {
            obatCode: modal.row!.obat_code, obatSystem: modal.row!.obat_system, obatDisplay: modal.row!.obat_display,
            formCode: modal.row!.form_code, formSystem: modal.row!.form_system, formDisplay: modal.row!.form_display,
            numeratorCode: modal.row!.numerator_code, numeratorSystem: modal.row!.numerator_system,
            denominatorCode: modal.row!.denominator_code, denominatorSystem: modal.row!.denominator_system,
            routeCode: modal.row!.route_code, routeSystem: modal.row!.route_system, routeDisplay: modal.row!.route_display,
          } : emptyForm}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

// ── Mapping Tindakan Laboratorium PK & MB — padanan SatuSehatMapingLab.java:
// tabel satu_sehat_mapping_lab INNER JOIN template_laboratorium (id_template
// PK/FK). Sama pola dgn Mapping Vaksin/Obat (template_laboratorium 2000+
// baris, picker "Tambah" search-as-you-type); id_template berupa angka.
type MappingLabRow = {
  periksa_code: string; pemeriksaan_system: string; id_template: number; detail_pemeriksaan: string;
  pemeriksaan_display: string; sampel_code: string; sampel_system: string; sampel_display: string;
};
type TemplateOption = { kd_jenis_prw: string; nm_perawatan: string; id_template: number; pemeriksaan: string; satuan: string };

type LabFormValues = {
  code: string; system: string; display: string;
  sampelCode: string; sampelSystem: string; sampelDisplay: string;
};

// TemplatePickerModal — modal terpisah (bukan dropdown kecil di bawah input)
// utk pilih pemeriksaan lab, persis pola tabMode di Java lama: kolom ID
// Periksa/Pemeriksaan (nama KELOMPOK, mis. "DARAH LENGKAP") ditampilkan
// eksplisit, krn nama detail tes sendiri (mis. "Leukosit") sering muncul di
// banyak kelompok berbeda — tanpa kolom kelompok user tidak bisa bedakan
// mau pilih yang mana.
const TemplatePickerModal: React.FC<{
  onClose: () => void;
  onPick: (t: TemplateOption) => void;
}> = ({ onClose, onPick }) => {
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<TemplateOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lab/cari-template?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10030 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, width: 820, maxWidth: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Pilih Pemeriksaan Laboratorium</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ID Periksa, nama kelompok, ID Detail, atau nama pemeriksaan..."
            style={inputSm}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{list.length} hasil (yang belum punya mapping)</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                {['ID Periksa', 'Pemeriksaan', 'ID Detail', 'Detail Pemeriksaan', 'Satuan', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Mencari...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada hasil</td></tr>
              ) : (
                list.map((t) => (
                  <tr
                    key={t.id_template}
                    onClick={() => { onPick(t); onClose(); }}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{t.kd_jenis_prw}</td>
                    <td style={{ padding: '6px 12px', color: '#111827', fontWeight: 500 }}>{t.nm_perawatan}</td>
                    <td style={{ padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{t.id_template}</td>
                    <td style={{ padding: '6px 12px', color: '#111827' }}>{t.pemeriksaan}</td>
                    <td style={{ padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{t.satuan}</td>
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: '#059669', color: '#fff', fontSize: 11, fontWeight: 600 }}>Pilih</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LabFormModal: React.FC<{
  title: string;
  fixedTemplate?: { idTemplate: number; pemeriksaan: string }; // mode edit: template sudah tetap
  initial: LabFormValues;
  onClose: () => void;
  onSave: (idTemplate: number, v: LabFormValues) => void;
  saving: boolean;
}> = ({ title, fixedTemplate, initial, onClose, onSave, saving }) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateOption | null>(
    fixedTemplate ? { kd_jenis_prw: '', nm_perawatan: '', id_template: fixedTemplate.idTemplate, pemeriksaan: fixedTemplate.pemeriksaan, satuan: '' } : null
  );
  const [showPicker, setShowPicker] = React.useState(false);
  const [v, setV] = React.useState<LabFormValues>(initial);

  const set = (key: keyof LabFormValues, val: string) => setV((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 480, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {fixedTemplate ? (
          <div>
            <label style={labelSm}>ID Detail / Detail Pemeriksaan</label>
            <input type="text" readOnly value={`${fixedTemplate.idTemplate} — ${fixedTemplate.pemeriksaan}`} style={{ ...inputSm, background: '#f9fafb', color: '#6b7280' }} />
          </div>
        ) : (
          <div>
            <label style={labelSm}>Cari Pemeriksaan Laboratorium (ID atau nama)</label>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              style={{ ...inputSm, textAlign: 'left', cursor: 'pointer', background: '#ffffff', color: selectedTemplate ? '#111827' : '#9ca3af' }}
            >
              {selectedTemplate ? `${selectedTemplate.id_template} — ${selectedTemplate.pemeriksaan}` : 'Klik untuk cari & pilih pemeriksaan...'}
            </button>
            {selectedTemplate && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12, color: '#065f46' }}>
                Kelompok: <strong>{selectedTemplate.nm_perawatan || '—'}</strong> ({selectedTemplate.kd_jenis_prw || '—'})
                {selectedTemplate.satuan && <> &middot; Satuan: {selectedTemplate.satuan}</>}
              </div>
            )}
          </div>
        )}

        {showPicker && (
          <TemplatePickerModal
            onClose={() => setShowPicker(false)}
            onPick={(t) => setSelectedTemplate(t)}
          />
        )}

        <div>
          <label style={labelSm}>Cari Kode LOINC Pemeriksaan</label>
          <LoincSearchBox
            value={v.code}
            display={v.display}
            onChange={(code, display, system) => setV((prev) => ({ ...prev, code, display, system }))}
            defaultQuery={selectedTemplate?.pemeriksaan}
          />
        </div>
        {v.code && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#9ca3af' }}>Bisa diedit manual jika hasil pencarian kurang tepat:</div>
            <label>
              <strong>Code:</strong>
              <input type="text" value={v.code} onChange={(e) => set('code', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
            <label>
              <strong>System:</strong>
              <input type="text" value={v.system} onChange={(e) => set('system', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
            <label>
              <strong>Display:</strong>
              <input type="text" value={v.display} onChange={(e) => set('display', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
          </div>
        )}
        <div>
          <label style={labelSm}>Cari Jenis Sampel (SNOMED CT)</label>
          <SpecimenSearchBox
            value={v.sampelCode}
            display={v.sampelDisplay}
            onChange={(sampelCode, sampelDisplay, sampelSystem) => setV((prev) => ({ ...prev, sampelCode, sampelDisplay, sampelSystem }))}
          />
        </div>
        {v.sampelCode && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#9ca3af' }}>Bisa diedit manual jika hasil pencarian kurang tepat:</div>
            <label>
              <strong>Code:</strong>
              <input type="text" value={v.sampelCode} onChange={(e) => set('sampelCode', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
            <label>
              <strong>System:</strong>
              <input type="text" value={v.sampelSystem} onChange={(e) => set('sampelSystem', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
            <label>
              <strong>Display:</strong>
              <input type="text" value={v.sampelDisplay} onChange={(e) => set('sampelDisplay', e.target.value)} style={{ ...inputSm, marginTop: 2 }} />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => selectedTemplate && onSave(selectedTemplate.id_template, v)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MappingLabSection: React.FC = () => {
  const [list, setList] = React.useState<MappingLabRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState<{ mode: 'tambah' | 'edit'; row?: MappingLabRow } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lab?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data.list) ? data.list : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const handleSave = async (idTemplate: number, v: LabFormValues) => {
    if (!v.system.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Pemeriksaan System wajib diisi' });
      return;
    }
    if (!v.sampelCode.trim() || !v.sampelSystem.trim() || !v.sampelDisplay.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Sampel Code, Sampel System, dan Sampel Display wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lab/${idTemplate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: v.code, system: v.system, display: v.display,
          sampel_code: v.sampelCode, sampel_system: v.sampelSystem, sampel_display: v.sampelDisplay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping laboratorium');
      setModal(null);
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MappingLabRow) => {
    const confirm = await Swal.fire({
      title: 'Hapus Mapping Laboratorium?',
      html: `Mapping pemeriksaan <strong>${row.detail_pemeriksaan}</strong> akan dihapus.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/satu-sehat/mapping-lab/${row.id_template}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus mapping');
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const emptyForm: LabFormValues = { code: '', system: '', display: '', sampelCode: '', sampelSystem: '', sampelDisplay: '' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari ID/nama pemeriksaan, periksa code, display..." style={{ ...inputSm, width: 340 }} />
        <button type="button" onClick={() => setModal({ mode: 'tambah' })} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Tambah Mapping</button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Periksa Code', 'Pemeriksaan System', 'ID Detail', 'Detail Pemeriksaan', 'Pemeriksaan Display', 'Sampel Code', 'Sampel System', 'Sampel Display'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, width: 140 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping tindakan laboratorium</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.id_template} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.periksa_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.pemeriksaan_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.id_template}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.detail_pemeriksaan}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.pemeriksaan_display}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.sampel_code}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.sampel_system}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.sampel_display}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button type="button" onClick={() => setModal({ mode: 'edit', row })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(row)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <LabFormModal
          title={modal.mode === 'tambah' ? 'Tambah Mapping Tindakan Laboratorium' : 'Edit Mapping Tindakan Laboratorium'}
          fixedTemplate={modal.mode === 'edit' ? { idTemplate: modal.row!.id_template, pemeriksaan: modal.row!.detail_pemeriksaan } : undefined}
          initial={modal.mode === 'edit' ? {
            code: modal.row!.periksa_code, system: modal.row!.pemeriksaan_system, display: modal.row!.pemeriksaan_display,
            sampelCode: modal.row!.sampel_code, sampelSystem: modal.row!.sampel_system, sampelDisplay: modal.row!.sampel_display,
          } : emptyForm}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
};

// ── Konfigurasi Satu Sehat — mengisi tabel satu_sehat_konfigurasi (kode/nilai:
// org_id, client_id, client_secret, auth_url, fhir_url, is_production,
// orthanc_url, orthanc_worklist_dir) lewat endpoint /api/satu-sehat/config
// yg sudah ada di backend sejak lama tapi belum pernah dipasang di UI mana pun.
// PENTING: ini TABEL BERBEDA dari "Pengaturan Bridging > Satu Sehat" di
// Admin.tsx (yg nyimpen ke setting_bridging dgn key CLIENTIDSATUSEHAT dst) —
// getSatuSehatToken()/getSatuSehatConfig() di backend HANYA baca dari
// satu_sehat_konfigurasi, jadi konfigurasi wajib diisi di sini supaya token
// Satu Sehat (dipakai Referensi Praktisi/Pasien, dll) bisa didapat.
type SatuSehatConfigForm = {
  org_id: string; client_id: string; client_secret: string;
  auth_url: string; fhir_url: string; is_production: boolean;
  orthanc_url: string; orthanc_worklist_dir: string;
  orthanc_user: string; orthanc_pass: string;
  dicom_router_name: string; dicom_router_host: string; dicom_router_port: string; dicom_router_aet: string;
};

const KonfigurasiSection: React.FC = () => {
  const [form, setForm] = React.useState<SatuSehatConfigForm>({
    org_id: '', client_id: '', client_secret: '', auth_url: '', fhir_url: '',
    is_production: false, orthanc_url: '', orthanc_worklist_dir: '',
    orthanc_user: '', orthanc_pass: '',
    dicom_router_name: '', dicom_router_host: '', dicom_router_port: '', dicom_router_aet: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [registering, setRegistering] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/satu-sehat/config');
      const data = await res.json();
      setForm({
        org_id: data.org_id || '', client_id: data.client_id || '', client_secret: data.client_secret || '',
        auth_url: data.auth_url || '', fhir_url: data.fhir_url || '',
        is_production: !!data.is_production,
        orthanc_url: data.orthanc_url || '', orthanc_worklist_dir: data.orthanc_worklist_dir || '',
        orthanc_user: data.orthanc_user || '', orthanc_pass: data.orthanc_pass || '',
        dicom_router_name: data.dicom_router_name || '', dicom_router_host: data.dicom_router_host || '',
        dicom_router_port: data.dicom_router_port || '', dicom_router_aet: data.dicom_router_aet || '',
      });
    } catch {
      // biarkan form kosong kalau gagal fetch
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const set = (key: keyof SatuSehatConfigForm, val: string | boolean) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.org_id.trim() || !form.client_id.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Org ID dan Client ID wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/satu-sehat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Konfigurasi Satu Sehat berhasil disimpan', timer: 1500, showConfirmButton: false });
      fetchConfig();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/satu-sehat/test-connection', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Koneksi gagal');
      Swal.fire({ icon: 'success', title: 'Koneksi Berhasil', text: `Token Satu Sehat berhasil didapat (panjang: ${data.token_length} karakter)` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterRouter = async () => {
    if (!form.dicom_router_name.trim() || !form.dicom_router_host.trim() || !form.dicom_router_aet.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Nama, Host, dan AET DICOM Router wajib diisi (simpan dulu sebelum daftarkan)' });
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/satu-sehat/dicom/register-router', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan DICOM Router');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || `DICOM Router '${form.dicom_router_name}' terdaftar di Orthanc` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
        Konfigurasi di sini terpisah dari "Admin &gt; Pengaturan Bridging &gt; Satu Sehat". Token OAuth2 Satu Sehat
        (dipakai Referensi Praktisi/Pasien dan fitur lain) hanya dibaca dari form ini.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelSm}>Org ID</label>
          <input type="text" value={form.org_id} onChange={(e) => set('org_id', e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Client ID</label>
          <input type="text" value={form.client_id} onChange={(e) => set('client_id', e.target.value)} style={inputSm} />
        </div>
      </div>
      <div>
        <label style={labelSm}>Client Secret</label>
        <input
          type="password"
          value={form.client_secret}
          onChange={(e) => set('client_secret', e.target.value)}
          style={inputSm}
          placeholder={form.client_secret === '***' ? 'Sudah tersimpan — isi ulang untuk mengganti' : ''}
        />
      </div>
      <div>
        <label style={labelSm}>Auth URL</label>
        <input type="text" value={form.auth_url} onChange={(e) => set('auth_url', e.target.value)} style={inputSm} placeholder="https://api-satusehat-dev.dto.kemkes.go.id/oauth2/v1" />
      </div>
      <div>
        <label style={labelSm}>FHIR URL</label>
        <input type="text" value={form.fhir_url} onChange={(e) => set('fhir_url', e.target.value)} style={inputSm} placeholder="https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_production} onChange={(e) => set('is_production', e.target.checked)} />
        Gunakan environment Production (bukan sandbox/dev)
      </label>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Orthanc PACS</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Dipakai fitur "Kirim DICOM" di menu ImagingStudy — mesin modality (CT/USG/X-Ray) push hasil scan langsung ke Orthanc, lalu di sini diteruskan ke DICOM Router Satu Sehat.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={labelSm}>Orthanc URL</label>
            <input type="text" value={form.orthanc_url} onChange={(e) => set('orthanc_url', e.target.value)} style={inputSm} placeholder="http://192.168.1.10:8042" />
          </div>
          <div>
            <label style={labelSm}>Orthanc Worklist Dir (opsional)</label>
            <input type="text" value={form.orthanc_worklist_dir} onChange={(e) => set('orthanc_worklist_dir', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Orthanc Username</label>
            <input type="text" value={form.orthanc_user} onChange={(e) => set('orthanc_user', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Orthanc Password</label>
            <input
              type="password"
              value={form.orthanc_pass}
              onChange={(e) => set('orthanc_pass', e.target.value)}
              style={inputSm}
              placeholder={form.orthanc_pass === '***' ? 'Sudah tersimpan — isi ulang untuk mengganti' : ''}
            />
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>DICOM Router Satu Sehat</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Isi persis sesuai yang sudah didaftarkan di dashboard provider Satu Sehat, lalu simpan dan klik "Daftarkan DICOM Router" supaya Orthanc tahu ke mana harus meneruskan studi.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={labelSm}>Nama Modality (bebas, label lokal)</label>
            <input type="text" value={form.dicom_router_name} onChange={(e) => set('dicom_router_name', e.target.value)} style={inputSm} placeholder="DICOM_ROUTER" />
          </div>
          <div>
            <label style={labelSm}>AET DICOM Router</label>
            <input type="text" value={form.dicom_router_aet} onChange={(e) => set('dicom_router_aet', e.target.value)} style={inputSm} placeholder="DICOMROUTER" />
          </div>
          <div>
            <label style={labelSm}>Host DICOM Router</label>
            <input type="text" value={form.dicom_router_host} onChange={(e) => set('dicom_router_host', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Port DICOM Router</label>
            <input type="text" value={form.dicom_router_port} onChange={(e) => set('dicom_router_port', e.target.value)} style={inputSm} placeholder="11112" />
          </div>
        </div>
        <button
          type="button"
          disabled={registering}
          onClick={handleRegisterRouter}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: registering ? '#9ca3af' : '#2563eb', cursor: registering ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {registering ? 'Mendaftarkan...' : 'Daftarkan DICOM Router ke Orthanc'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={handleTest}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: testing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {testing ? 'Menguji...' : 'Test Koneksi'}
        </button>
      </div>
    </div>
  );
};

const PengaturanSection: React.FC = () => {
  const [sub, setSub] = React.useState<PengaturanSubTab>('konfigurasi');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
        {PENGATURAN_MENU.map((m) => {
          const active = sub === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSub(m.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: active ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent',
                color: active ? '#059669' : '#6b7280',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {sub === 'konfigurasi' && <KonfigurasiSection />}
        {sub === 'organisasi' && <MappingOrganisasiSection />}
        {sub === 'lokasi' && <MappingLokasiSection />}
        {sub === 'vaksin' && <MappingVaksinSection />}
        {sub === 'obat-alkes-bhp' && <MappingObatSection />}
        {sub === 'tindakan-radiologi' && <MappingRadiologi />}
        {sub === 'tindakan-laboratorium' && <MappingLabSection />}
      </div>
    </div>
  );
};

type SatuSehatViewProps = {
  onBack?: () => void;
};

export const SatuSehatView: React.FC<SatuSehatViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<SatuSehatTab>('dashboard');
  const activeLabel = [...MENU, SETTINGS_ITEM].find((m) => m.key === activeTab)?.label || '';

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
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Satu Sehat
          </div>
        </div>

        {/* Menu — pola scrollbar auto-hide sama dgn BridgingBpjs.tsx
            (di-override manual krn scrollbar native Windows/Chrome selalu
            tampil tebal). */}
        <nav className="satusehat-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer — Pengaturan, terpisah dari daftar menu utama */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
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
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
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
            <span style={{ color: '#059669', fontWeight: 600 }}>Satu Sehat</span> / {activeLabel}
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
          {activeTab === 'dashboard' && <Placeholder title="Dashboard Satu Sehat" />}
          {activeTab === 'patient-journey' && <PatientJourneySection />}
          {activeTab === 'auto-send' && <AutoSendSection />}
          {activeTab === 'referensi' && <ReferensiSection />}
          {activeTab === 'encounter' && <EncounterSection />}
          {activeTab === 'condition' && <ConditionSection />}
          {activeTab === 'observation' && <ObservationSection />}
          {activeTab === 'procedure' && <ProcedureSection />}
          {activeTab === 'composition' && <CompositionSection />}
          {activeTab === 'medication' && <MedicationSection />}
          {activeTab === 'medication-request' && <MedicationRequestSection />}
          {activeTab === 'medication-dispense' && <MedicationDispenseSection />}
          {activeTab === 'allergy-intolerance' && <AllergyIntoleranceSection />}
          {activeTab === 'imaging-study' && <ImagingStudySection />}
          {activeTab === 'modality-worklist' && <ModalityWorklistSection />}
          {activeTab === 'service-request' && <ServiceRequestSection />}
          {activeTab === 'clinical-impression' && <ClinicalImpressionSection />}
          {activeTab === 'immunization' && <ImmunizationSection />}
          {activeTab === 'questionnaire-response' && <QuestionnaireResponseSection />}
          {activeTab === 'medication-statement' && <MedicationStatementSection />}
          {activeTab === 'care-plan' && <CarePlanSection />}
          {activeTab === 'specimen' && <SpecimenSection />}
          {activeTab === 'diagnostic-report' && <DiagnosticReportSection />}
          {activeTab === 'episode-of-care' && <EpisodeOfCareSection />}
          {activeTab === 'pengaturan' && <PengaturanSection />}
        </div>
      </div>

      <style>{`
        .satusehat-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .satusehat-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .satusehat-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .satusehat-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .satusehat-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .satusehat-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
  );
};
