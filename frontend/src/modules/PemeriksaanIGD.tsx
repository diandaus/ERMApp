import React from 'react';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { TindakanTab } from '../components/TindakanTab';
import { DiagnosaTab } from '../components/DiagnosaTab';
import { ModalInputTriase } from '../components/ModalInputTriase';
import { RiwayatModal } from '../components/RiwayatModal';
import { renderTriasePrimer, renderTriaseSekunder } from '../utils/triaseIgdDisplay';
import { useBreakpoint, useMediaQuery } from '../hooks/useBreakpoint';
import type { Patient as IGDPatient } from './IGDK';

// PemeriksaanIGD.tsx — layar pemeriksaan pasien IGD, dibuka dari IGDK.tsx
// (klik tombol No.Rawat pada baris pasien), ditampilkan fullscreen (overlay
// position:fixed, menutupi sidebar/header aplikasi — pola sama dgn ApotekView
// dari App.tsx case 'farmasi'). Kerangka tab mengikuti pola PemeriksaanRanap.tsx/Pemeriksaan.tsx (shell
// sidebar info pasien + tab bar + area konten), TAPI urutan & isi tab
// spesifik alur IGD:
//   Triase | Awal Medis | SOAP/CPPT | Awal Keperawatan | Laboratorium |
//   Radiologi | Tindakan | Diagnosa
//
// STATUS SAAT INI (dikerjakan bertahap per keputusan user):
// - Laboratorium/Radiologi/Tindakan/Diagnosa: SIAP, reuse komponen yang
//   sama dipakai Pemeriksaan.tsx (Poli) & PemeriksaanRanap.tsx — LabTab/
//   RadTab/TindakanTab/DiagnosaTab semuanya cuma butuh `patient.no_rawat`
//   tanpa filter status/kd_poli di backend, jadi otomatis jalan utk IGD
//   (TindakanTab dipanggil TANPA isRanap → default ke /api/tindakan-ralan,
//   sama seperti Poli; DiagnosaTab demikian juga menulis ke status='Ralan'
//   di diagnosa_pasien/prosedur_pasien — konsisten dgn cara kunjungan IGD
//   sudah diperlakukan flavor Ralan di seluruh backend, no_rawat IGD tetap
//   lewat reg_periksa/status_lanjut='Ralan').
// - Triase: SIAP — tombol "Input Triase" buka ModalInputTriase.tsx (form +
//   POST /api/triase-igd/simpan, persis alur RMTriaseIGD.java), lalu
//   TriaseDisplay (di bawah) menampilkan data tersimpan dgn konsumsi
//   GET /api/triase-igd/{no_rawat}, tabelnya (label : value, baris skala
//   berwarna sesuai kegawatan) dari utils/triaseIgdDisplay.tsx — tampilan
//   IDENTIK dgn RiwayatModal.tsx (renderTriasePrimer/renderTriaseSekunder)
//   tapi file terpisah berdiri sendiri, RiwayatModal.tsx TIDAK diubah.
//   Tombol "Riwayat Pasien" (sejajar, rata kanan dari "Input Triase")
//   membuka RiwayatModal.tsx apa adanya (fullscreen, tanpa modifikasi).
// - Awal Medis/SOAP/CPPT/Awal Keperawatan: PLACEHOLDER. Backend-nya baru
//   ada endpoint GET (read-only, dipakai RiwayatModal.tsx nampilin data
//   lama dari Khanza Desktop — lihat penilaian_medis_igd, penilaian_awal_
//   keperawatan_igd). Belum ada endpoint SIMPAN. Form-nya menyusul setelah
//   referensi Java DlgAsuhanMedis/DlgAsuhanKeperawatan (dan keputusan
//   skema tabel SOAP/CPPT IGD) siap.
// ============================================================================

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

type PemeriksaanIGDProps = {
  patient: IGDPatient;
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

const TAB_LABELS: Record<TabKey, string> = {
  triase: 'TRIASE',
  medis: 'AWAL MEDIS',
  soap: 'SOAP/CPPT',
  keperawatan: 'AWAL KEPERAWATAN',
  lab: 'LABORATORIUM',
  rad: 'RADIOLOGI',
  tindakan: 'TINDAKAN',
  diagnosa: 'DIAGNOSA',
};

const TAB_ORDER: TabKey[] = ['triase', 'medis', 'soap', 'keperawatan', 'lab', 'rad', 'tindakan', 'diagnosa'];

type TabKey = 'triase' | 'medis' | 'soap' | 'keperawatan' | 'lab' | 'rad' | 'tindakan' | 'diagnosa';

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{title}</div>
    <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Fitur ini sedang dikembangkan dan akan segera hadir.</div>
  </div>
);

// ── Tampilan data Triase tersimpan (tab "Triase", di bawah tombol Input
// Triase) — konsumsi GET /api/triase-igd/{no_rawat}. Render tabelnya
// (label : value, baris skala berwarna) dipakai dari
// utils/triaseIgdDisplay.tsx — SENGAJA file terpisah berdiri sendiri
// (bukan reuse langsung dari RiwayatModal.tsx) supaya RiwayatModal.tsx
// tidak ikut berubah/diotak-atik sama sekali; tapi tampilannya tetap
// identik sama seperti histori Khanza Desktop.
const TriaseDisplay: React.FC<{ noRawat: string; refreshKey: number }> = ({ noRawat, refreshKey }) => {
  const [data, setData] = React.useState<{ triase_primer?: any; triase_sekunder?: any } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/triase-igd/${encodeURIComponent(noRawat)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [noRawat, refreshKey]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data triase...</div>;
  }

  if (!data?.triase_primer && !data?.triase_sekunder) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data Triase</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Klik &quot;Input Triase&quot; untuk memulai penilaian triase pasien ini.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.triase_primer && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
          {renderTriasePrimer(data.triase_primer)}
        </div>
      )}
      {data.triase_sekunder && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
          {renderTriaseSekunder(data.triase_sekunder)}
        </div>
      )}
    </div>
  );
};

// ── Panel kanan (40%) tab Triase — Riwayat SOAPIE Terakhir (TANPA judul
// di kartunya, per keputusan user). Konsumsi endpoint yang sama dipakai
// RiwayatSoapieModal.tsx (Pemeriksaan.tsx Poli): GET /api/pemeriksaan/
// riwayat-soapie/{no_rkm_medis}?filter=last5 — registrasi sudah terurut
// DESC (tgl_registrasi), soapie per registrasi ASC (tgl_perawatan/
// jam_rawat), jadi item TERAKHIR pada registrasi PERTAMA yg punya data =
// SOAPIE paling baru lintas kunjungan.
type SoapieLatestItem = {
  tgl_perawatan: string; jam_rawat: string;
  suhu_tubuh: string; tensi: string; nadi: string; respirasi: string; tinggi: string; berat: string;
  gcs: string; spo2: string; kesadaran: string; lingkar_perut: string;
  keluhan: string; pemeriksaan: string; alergi: string;
  penilaian: string; rtl: string; instruksi: string; evaluasi: string;
  nip: string; nama: string; jbtn: string;
};
type SoapieRegistration = { no_reg: string; no_rawat: string; tgl_registrasi: string; status_lanjut: string; soapie: SoapieLatestItem[] };

const formatTglSoapie = (tgl?: string) => {
  if (!tgl) return '-';
  const d = tgl.split('T')[0];
  const [y, m, day] = d.split('-');
  return d && y && m && day ? `${day}/${m}/${y}` : '-';
};

const SoapieVitalChip: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={{ padding: '5px 8px', borderRadius: 0, background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: 11.5 }}>
      <span style={{ color: '#6b7280' }}>{label}: </span>
      <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
    </div>
  );
};

const SoapieRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
};

const RiwayatSoapieTerakhir: React.FC<{ noRkmMedis: string; onOpenRiwayat: () => void }> = ({ noRkmMedis, onOpenRiwayat }) => {
  const [item, setItem] = React.useState<SoapieLatestItem | null>(null);
  const [noRawat, setNoRawat] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!noRkmMedis) return;
    setLoading(true);
    fetch(`/api/pemeriksaan/riwayat-soapie/${encodeURIComponent(noRkmMedis)}?filter=last5`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SoapieRegistration[]) => {
        const list = Array.isArray(data) ? data : [];
        const reg = list.find((r) => r.soapie && r.soapie.length > 0);
        if (reg) {
          setItem(reg.soapie[reg.soapie.length - 1]);
          setNoRawat(reg.no_rawat);
        } else {
          setItem(null);
        }
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [noRkmMedis]);

  return (
    <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onOpenRiwayat}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#000', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#262626'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#000'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
          </svg>
          Riwayat Pasien
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 16 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat...</div>
        ) : !item ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '48px 16px', color: '#9ca3af' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
            <div style={{ fontSize: 12.5, textAlign: 'center' }}>Belum ada riwayat SOAPIE</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{formatTglSoapie(item.tgl_perawatan)} • {(item.jam_rawat || '').slice(0, 5)}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{noRawat}</div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Petugas: <strong style={{ color: '#111827' }}>{item.nama || '-'}</strong>{item.jbtn ? ` (${item.jbtn})` : ''}
            </div>

            <SoapieRow label="Subjek (Keluhan)" value={item.keluhan} />
            <SoapieRow label="Objek (Pemeriksaan)" value={item.pemeriksaan} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <SoapieVitalChip label="Tensi" value={item.tensi} />
              <SoapieVitalChip label="Nadi" value={item.nadi} />
              <SoapieVitalChip label="Respirasi" value={item.respirasi} />
              <SoapieVitalChip label="Suhu" value={item.suhu_tubuh} />
              <SoapieVitalChip label="SpO2" value={item.spo2} />
              <SoapieVitalChip label="GCS" value={item.gcs} />
              <SoapieVitalChip label="Kesadaran" value={item.kesadaran} />
              {item.alergi && <SoapieVitalChip label="Alergi" value={item.alergi} />}
            </div>

            <SoapieRow label="Asesmen" value={item.penilaian} />
            <SoapieRow label="Plan" value={item.rtl} />
            <SoapieRow label="Inst/Impl" value={item.instruksi} />
            <SoapieRow label="Evaluasi" value={item.evaluasi} />
          </div>
        )}
      </div>
    </div>
  );
};

export const PemeriksaanIGDView: React.FC<PemeriksaanIGDProps> = ({ patient, onBack, user }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('triase');
  const [showPatientInfo, setShowPatientInfo] = React.useState(false);
  const [showInputTriase, setShowInputTriase] = React.useState(false);
  const [triaseRefreshKey, setTriaseRefreshKey] = React.useState(0);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  const { isCompact } = useBreakpoint();
  void isCompact;
  // Sidebar info pasien permanen di layar >=1366px (laptop/desktop umum),
  // jadi overlay drawer di bawah itu — pola sama dgn PemeriksaanRanap.tsx.
  const isPermanentSidebar = !useMediaQuery(1365);

  const tabStyle = (tab: TabKey): React.CSSProperties => ({
    padding: '10px 20px', border: 'none',
    background: activeTab === tab ? '#e0f2fe' : 'transparent',
    borderBottom: activeTab === tab ? '3px solid #1AB1E5' : '3px solid transparent',
    color: activeTab === tab ? '#1AB1E5' : '#6b7280',
    cursor: 'pointer', fontSize: 13,
    fontWeight: 400,
    transition: 'all 0.2s',
    whiteSpace: 'nowrap', flexShrink: 0,
  });

  const formatTgl = (tgl?: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';
    const d = tgl.split('T')[0];
    const [y, m, day] = d.split('-');
    return d ? `${day}/${m}/${y}` : '-';
  };

  return (
    <section style={{ background: '#f3f4f6', borderRadius: 0, padding: 0, height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>

      {/* Overlay drawer info pasien — hanya di bawah 1366px */}
      {!isPermanentSidebar && showPatientInfo && (
        <div
          onClick={() => setShowPatientInfo(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
        />
      )}

      {/* Sidebar — permanen di >=1366px, drawer di bawah itu */}
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
            <div style={{ fontSize: 10, color: '#0891B2', background: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {patient.png_jawab || 'UMUM'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white" />
                <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="white" />
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Identitas Diri</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem
                label="Jenis Kelamin"
                value={`${patient.jk === 'L' ? 'Laki-laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-'}${patient.umur ? ` (${patient.umur})` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>} />
              <InfoItem label="Alamat Penanggung Jawab" value={patient.almt_pj || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>}
                multiline />
              {patient.no_tlp && (
                <InfoItem label="No. Telepon" value={patient.no_tlp}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>} />
              )}
            </div>
          </div>

          {/* Kunjungan IGD */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Kunjungan IGD</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem label="No. Rawat" value={patient.no_rawat}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
                highlight />
              <InfoItem label="Tanggal & Jam Masuk" value={`${formatTgl(patient.tgl_registrasi)}${patient.jam_reg ? ` • ${patient.jam_reg}` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
              <InfoItem label="Dokter" value={patient.nm_dokter || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} />
              <InfoItem label="Cara Bayar" value={patient.png_jawab || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>} />
              <InfoItem label="Status" value={patient.stts || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>} />
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{patient.nm_pasien}</span>
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pemeriksaan IGD</h3>
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

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '0 24px', borderBottom: '2px solid #e5e7eb', background: '#fff', flexShrink: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
          {TAB_ORDER.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f9fafb', overscrollBehavior: 'none' }}>
          <div style={{ padding: '24px 20px' }}>
            {activeTab === 'triase' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowInputTriase(true)}
                      style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Input Triase
                    </button>
                  </div>
                  <TriaseDisplay noRawat={patient.no_rawat} refreshKey={triaseRefreshKey} />
                </div>

                <RiwayatSoapieTerakhir noRkmMedis={patient.no_rkm_medis} onOpenRiwayat={() => setShowRiwayatModal(true)} />
              </div>
            )}
            {activeTab === 'medis' && <ComingSoon title="Awal Medis" />}
            {activeTab === 'soap' && <ComingSoon title="SOAP/CPPT" />}
            {activeTab === 'keperawatan' && <ComingSoon title="Awal Keperawatan" />}
            {activeTab === 'lab' && <LabTab patient={patient} />}
            {activeTab === 'rad' && <RadTab patient={patient} />}
            {activeTab === 'tindakan' && <TindakanTab patient={patient} />}
            {activeTab === 'diagnosa' && <DiagnosaTab patient={patient} />}
          </div>
        </div>
      </div>

      <ModalInputTriase
        isOpen={showInputTriase}
        onClose={() => setShowInputTriase(false)}
        patient={patient}
        user={user}
        onSuccess={() => setTriaseRefreshKey((k) => k + 1)}
      />

      {showRiwayatModal && (
        <RiwayatModal patient={patient} onClose={() => setShowRiwayatModal(false)} />
      )}
    </section>
  );
};
