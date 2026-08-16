import React from 'react';
import Swal from 'sweetalert2';
import { mediaUrl } from '../utils/apiBase';

// Ikon garis (feather-style) senada dengan ikon lain di aplikasi ini
// (mis. Kepegawaian.tsx) — dipakai di sini menggantikan emoji supaya
// tampilannya konsisten lintas OS/browser.
type IconProps = { size?: number; color?: string };

const IconHome: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </svg>
);

const IconCamera: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const IconFaceScan: React.FC<IconProps> = ({ size = 28, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M9 10v1" />
    <path d="M15 10v1" />
    <path d="M9 15c.83.67 1.5 1 3 1s2.17-.33 3-1" />
  </svg>
);

const IconCalendar: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
  </svg>
);

const IconClipboard: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M8 11h8" /><path d="M8 15h5" />
  </svg>
);

const IconCalendarCheck: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    <path d="M9 16l2 2 4-4" />
  </svg>
);

// Tombol "Lihat Semua" di grid Home — cuma titik tiga polos (tanpa
// lingkaran), warna sama dgn ikon menu lain. Padanan Icons.more_horiz
// di Flutter.
const IconDots: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);

const IconLogOut: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Ikon panah masuk pintu — dipakai di panel jadwal HomeTab (masuk & keluar).
const IconArrowDoor: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 499.1 499.1" fill={color}>
    <path d="M0,249.6c0,9.5,7.7,17.2,17.2,17.2h327.6l-63.9,63.8c-6.7,6.7-6.7,17.6,0,24.3c3.3,3.3,7.7,5,12.1,5s8.8-1.7,12.1-5 l93.1-93.1c6.7-6.7,6.7-17.6,0-24.3l-93.1-93.1c-6.7-6.7-17.6-6.7-24.3,0c-6.7,6.7-6.7,17.6,0,24.3l63.8,63.8H17.2 C7.7,232.5,0,240.1,0,249.6z" />
    <path d="M396.4,494.2c56.7,0,102.7-46.1,102.7-102.8V107.7C499.1,51,453,4.9,396.4,4.9H112.7C56,4.9,10,51,10,107.7V166 c0,9.5,7.7,17.1,17.1,17.1c9.5,0,17.2-7.7,17.2-17.1v-58.3c0-37.7,30.7-68.5,68.4-68.5h283.7c37.7,0,68.4,30.7,68.4,68.5v283.7 c0,37.7-30.7,68.5-68.4,68.5H112.7c-37.7,0-68.4-30.7-68.4-68.5v-57.6c0-9.5-7.7-17.2-17.2-17.2S10,324.3,10,333.8v57.6 c0,56.7,46.1,102.8,102.7,102.8H396.4L396.4,494.2z" />
  </svg>
);

const IconUser: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
  </svg>
);

const IconAlertTriangle: React.FC<IconProps> = ({ size = 36, color = '#f59e0b' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconCheckCircle: React.FC<IconProps> = ({ size = 36, color = '#16a34a' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// Ikon menu kartu "Layanan Lainnya" (Lembur/Cuti/Izin/Poli/IGD/Ranap/
// Jadwal Obat/Permintaan Obat) — lihat LayananCard di bawah.
const IconOvertime: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M9 2h6" />
  </svg>
);

const IconUmbrella: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11a9 9 0 0 1 18 0z" />
    <path d="M12 11v9a2 2 0 0 1-4 0" />
    <path d="M12 2v2" />
  </svg>
);

const IconFileText: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6" /><path d="M9 17h6" /><path d="M9 9h1" />
  </svg>
);

const IconStethoscope: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3v6a4 4 0 0 0 8 0V3" />
    <path d="M9 15v2a4 4 0 0 0 8 0v-3a6 6 0 0 0-3-5.2" />
    <circle cx="20" cy="10" r="1.7" />
  </svg>
);

const IconSiren: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
    <path d="M19 18H5a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2z" />
    <path d="M12 2v3" /><path d="M4.5 7 6 8.3" /><path d="M19.5 7 18 8.3" />
  </svg>
);

const IconBed: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18v-7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
    <path d="M2 14h20" />
    <path d="M22 18v-4a2 2 0 0 0-2-2h-6" />
    <path d="M2 18v3" /><path d="M22 18v3" />
    <circle cx="7" cy="8" r="1.4" />
  </svg>
);

const IconPill: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 13.5)" />
    <line x1="9.5" y1="9" x2="14.5" y2="14" />
  </svg>
);

const IconFlask: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L15 8.5V2" />
    <path d="M9 2h6" /><path d="M7.5 15h9" />
  </svg>
);

const IconRadiology: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" />
  </svg>
);

const IconScalpel: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20 14 10" />
    <path d="M14 10 19 5a1.7 1.7 0 0 0-2.4-2.4L12 7" />
    <circle cx="5.5" cy="18.5" r="1.5" />
  </svg>
);

const IconTaskCheck: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="m9 13 2 2 4-4" />
  </svg>
);

const IconMonitor: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IconMegaphone: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

// Ikon tambahan utk tab Saya > Profil/Pengaturan Akun.
const IconSettings: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z" />
  </svg>
);

const IconChevronRight: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconArrowLeft: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconLock: React.FC<IconProps> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const IconPhone: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconMail: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="2 7 12 13 22 7" />
  </svg>
);

const IconBuilding: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <line x1="9" y1="7" x2="9" y2="7.01" /><line x1="15" y1="7" x2="15" y2="7.01" />
    <line x1="9" y1="11" x2="9" y2="11.01" /><line x1="15" y1="11" x2="15" y2="11.01" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const IconIdCard: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="8" cy="12" r="2" />
    <line x1="14" y1="10" x2="19" y2="10" /><line x1="14" y1="14" x2="19" y2="14" />
  </svg>
);

type AppUserLite = {
  id: number;
  full_name: string;
  role: string;
  nip?: string;
  kd_dokter?: string;
  allowed_modules?: string;
};

// Padanan canAccessMenu di modules/App.tsx (shell desktop) — Poli/IGD/
// Ranap/Farmasi/Lab/Radiologi/Operasi di kartu Layanan Lainnya cuma
// tampil kalau modul terkait diizinkan buat akun yang login, entah lewat
// allowed_modules (diatur admin) atau fallback per role. Sengaja
// disamakan persis (termasuk "celah" IGD yang cuma masuk fallback admin)
// supaya konsisten dgn kontrol akses shell utama. Kunci modul HARUS sama
// persis dgn App.tsx: 'laboratorium' (bukan 'lab'), 'jadwal-operasi'
// (bukan 'operasi').
type ModuleKey = 'rawat-jalan' | 'igd' | 'rawat-inap' | 'farmasi' | 'laboratorium' | 'radiologi' | 'jadwal-operasi';
function canAccessModule(user: AppUserLite, moduleKey: ModuleKey): boolean {
  if (user.allowed_modules) {
    return user.allowed_modules.split(',').filter(Boolean).includes(moduleKey);
  }
  switch (user.role) {
    case 'dokter':
      return moduleKey === 'rawat-jalan' || moduleKey === 'rawat-inap';
    case 'farmasi':
      return moduleKey === 'farmasi';
    case 'admin':
      return true;
    default:
      return false;
  }
}

type PresensiHariIni = {
  sudah_checkin: boolean;
  sudah_checkout: boolean;
  jam_datang: string;
  jam_pulang: string;
  status: string;
  keterlambatan: string;
  shift: string;
  jam_masuk_jadwal: string;
  jam_pulang_jadwal: string;
};

type PerformaBulanIni = {
  persentase_kehadiran: number;
  total_hari_kerja: number;
  total_hari_terjadwal: number;
  rata_rata_jam_kerja: number;
};

type MeResponse = {
  nama: string;
  photo: string;
  hari_ini: PresensiHariIni;
  performa: PerformaBulanIni;
};

// pegawai.photo sering berisi path legacy Khanza desktop (mis.
// "pages/pegawai/photo/xxx.jpg") yang tidak bisa diakses backend web ini
// — hanya dipakai kalau sudah berupa URL yang valid (/uploads/... hasil
// upload baru, atau http/https), selain itu fallback ke avatar inisial.
function isUsablePhotoUrl(photo: string): boolean {
  return photo.startsWith('/uploads/') || photo.startsWith('http://') || photo.startsWith('https://');
}

const Avatar: React.FC<{ nama: string; photo?: string; size?: number }> = ({ nama, photo, size = 44 }) => {
  const usable = photo && isUsablePhotoUrl(photo);
  const initial = (nama || '?').trim().charAt(0).toUpperCase();
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700, color: '#059669', background: '#d1fae5',
    overflow: 'hidden', border: '2px solid rgba(255,255,255,0.6)',
  };
  if (usable) {
    return <img src={mediaUrl(photo!)} alt={nama} style={{ ...base, objectFit: 'cover' }} />;
  }
  return <div style={base}>{initial}</div>;
};

type RiwayatRow = {
  tanggal: string; shift: string; jam_datang: string; jam_pulang: string;
  status: string; keterlambatan: string; durasi: string;
};

const GRADIENT = 'linear-gradient(135deg, #34d399 0%, #059669 100%)';

const getStatusStyle = (status: string) => {
  const base = status.replace(' & PSW', '');
  switch (base) {
    case 'Tepat Waktu':          return { bg: '#dcfce7', color: '#166534' };
    case 'Terlambat Toleransi':  return { bg: '#fef9c3', color: '#854d0e' };
    case 'Terlambat I':          return { bg: '#ffedd5', color: '#9a3412' };
    case 'Terlambat II':         return { bg: '#fee2e2', color: '#991b1b' };
    default:                     return { bg: '#f3f4f6', color: '#374151' };
  }
};

// Padanan getCurrentUserNip()/kd_dokter di utils/currentUser.ts — dokter.
// kd_dokter dan petugas.nip sama-sama FK ke pegawai.nik (lihat catatan
// backend/dokter_handler.go & petugas_handler.go), jadi presensi cukup
// pakai salah satu yang terisi utk resolve ke pegawai.id di backend.
function resolveNik(user: AppUserLite): string {
  if (user.role === 'dokter' && user.kd_dokter) return user.kd_dokter;
  return user.nip || '';
}

// Format YYYY-MM-DD sesuai yg dibutuhkan <input type="date"> — dipakai
// buat default tanggal hari ini (bukan kosong) di form Cuti/Izin.
function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ---------------------------------------------------------------------
// Tab: Absen — live camera preview + capture, lalu kirim foto + GPS ke
// backend. Otomatis menentukan check-in atau check-out berdasarkan
// status hari ini (bukan dipilih manual) supaya alurnya sesederhana
// mungkin di HP.
// ---------------------------------------------------------------------

const AbsenTab: React.FC<{
  nik: string;
  hariIni: PresensiHariIni | null;
  onSelesai: () => void;
  onBack: () => void;
}> = ({ nik, hariIni, onSelesai, onBack }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [ready, setReady] = React.useState(false);
  const [camError, setCamError] = React.useState<string | null>(null);
  const [captured, setCaptured] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Swipe-kanan-dari-tepi-kiri buat kembali (pola iOS "swipe back") —
  // touch cuma mulai dilacak kalau dimulai dekat tepi kiri layar (<=24px),
  // supaya tidak bentrok dgn tap/scroll biasa di tengah layar.
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX <= 24) {
      touchStartX.current = t.clientX;
      touchStartY.current = t.clientY;
    } else {
      touchStartX.current = null;
      touchStartY.current = null;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStartX.current;
    const deltaY = Math.abs(t.clientY - touchStartY.current);
    if (deltaX > 80 && deltaY < 60) {
      onBack();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const aksi: 'checkin' | 'checkout' = hariIni?.sudah_checkin && !hariIni?.sudah_checkout ? 'checkout' : 'checkin';
  const sudahSelesaiHariIni = hariIni?.sudah_checkin && hariIni?.sudah_checkout;

  const startCamera = React.useCallback(() => {
    // Browser HANYA mengizinkan kamera/GPS di secure context (HTTPS
    // atau localhost) — di luar itu `navigator.mediaDevices` betulan
    // `undefined` (bukan sekadar izin ditolak), jadi dicek eksplisit
    // dulu di sini supaya pesannya jelas, bukan crash diam-diam kalau
    // langsung dipanggil di atas undefined.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamError('Kamera tidak bisa diakses krn koneksi ini bukan HTTPS. Buka aplikasi lewat alamat https:// atau hubungi admin IT.');
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
        setReady(true);
      })
      .catch((err: unknown) => {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError') {
          setCamError('Izin kamera ditolak. Aktifkan izin kamera utk browser ini lewat Pengaturan HP, lalu muat ulang halaman.');
        } else if (name === 'NotFoundError') {
          setCamError('Kamera tidak ditemukan di perangkat ini.');
        } else {
          setCamError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.');
        }
      });
  }, []);

  React.useEffect(() => {
    if (sudahSelesaiHariIni) return;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sudahSelesaiHariIni]);

  // Satu klik: ambil foto lalu langsung kirim (GPS + upload + check-in/
  // out) tanpa langkah konfirmasi/preview lagi — sesuai permintaan biar
  // absen secepat mungkin buat pegawai.
  const handleCaptureAndSubmit = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(photoDataUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());

    setSubmitting(true);
    try {
      const lokasi = await getGeolocation();
      if (!lokasi) {
        await Swal.fire({ icon: 'warning', title: 'Lokasi tidak ditemukan', text: 'Aktifkan izin lokasi lalu coba lagi.', confirmButtonColor: '#059669' });
        setSubmitting(false);
        setCaptured(null);
        startCamera();
        return;
      }

      const blob = await (await fetch(photoDataUrl)).blob();
      const formData = new FormData();
      formData.append('file', blob, `presensi-${Date.now()}.jpg`);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Gagal mengunggah foto');
      const photoUrl: string = uploadData.url || uploadData.path || uploadData.filename || '';

      const alamat = `${lokasi.lat.toFixed(5)}, ${lokasi.lng.toFixed(5)}`;
      const endpoint = aksi === 'checkin' ? '/api/presensi/checkin' : '/api/presensi/checkout';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, lat: lokasi.lat, lng: lokasi.lng, alamat, photo: photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan presensi');

      await Swal.fire({
        icon: 'success',
        title: aksi === 'checkin' ? 'Check-in Berhasil' : 'Check-out Berhasil',
        text: `Jam ${data.jam} — ${data.status}`,
        confirmButtonColor: '#059669',
        timer: 2000,
        showConfirmButton: false,
      });
      onSelesai();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
      setCaptured(null);
      startCamera();
    } finally {
      setSubmitting(false);
    }
  };

  if (sudahSelesaiHariIni) {
    return (
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <SubPageHeader title="Absen" onBack={onBack} iconSize={28} fontSize={20} />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconCheckCircle size={40} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Presensi hari ini sudah lengkap</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Check-in {hariIni?.jam_datang} · Check-out {hariIni?.jam_pulang}</div>
        </div>
      </div>
    );
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <SubPageHeader title="Absen" onBack={onBack} iconSize={28} fontSize={20} />
      {/* paddingBottom ekstra — nyisain ruang di bawah supaya konten
          (preview kamera) tidak ketutup tombol fixed di bawah. */}
      <div style={{ padding: '24px 16px 130px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', borderRadius: 16, overflow: 'hidden', background: '#111827' }}>
          {camError ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, padding: 20, textAlign: 'center' }}>
              {camError}
            </div>
          ) : captured ? (
            <img src={captured} alt="Hasil foto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            // position:absolute + inset:0 (bukan width/height:100%) supaya
            // ukurannya dihitung dari kotak parent langsung — di sebagian
            // WebKit, height:100% pada elemen di dalam parent yg tingginya
            // ditentukan lewat CSS aspect-ratio tidak selalu ke-resolve dgn
            // benar, menyisakan celah kosong yg keliatan sbg bar hitam
            // (warna background parent) di bawah video.
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Tombol dipindah ke bawah (fixed) — lebih gampang dijangkau ibu
          jari drpd nempel langsung di bawah preview kamera. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 16px max(16px, env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginBottom: 8 }}>
          Foto & lokasi GPS langsung tersimpan begitu foto diambil.
        </div>
        <button
          type="button"
          onClick={handleCaptureAndSubmit}
          disabled={!ready || submitting}
          style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: ready && !submitting ? GRADIENT : '#d1d5db',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: ready && !submitting ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting ? 'Menyimpan...' : <><IconCamera size={18} /> Absen — {aksi === 'checkin' ? 'Masuk' : 'Pulang'}</>}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Home
// ---------------------------------------------------------------------

type LayananItem = { key: string; label: string; icon: React.ReactNode };

// Kartu "Layanan Lainnya" — menu jalan pintas ke fitur yang belum
// dibangun mobile-nya (Lembur/Cuti/Izin/Jadwal Obat/Permintaan Obat
// masih tahap placeholder, sama seperti pola tab Presensi/Rekap
// Kehadiran/Pengajuan Cuti di Kepegawaian.tsx sebelum dikembangkan).
// Poli/IGD/Ranap cuma tampil kalau modul terkait diizinkan buat akun
// yang login (lihat canAccessModule di atas).
type LayananHandlers = {
  onOpenLembur: () => void; onOpenCutiIzin: (mode: 'cuti' | 'izin') => void; onOpenLaporIt: () => void;
  onOpenPoli: () => void; onOpenIgd: () => void; onOpenRanap: () => void; onOpenFarmasi: () => void; onOpenLab: () => void; onOpenRadiologi: () => void;
  onOpenAturJadwal: () => void;
};

// Poli/IGD/Ranap/Farmasi/Lab/Radiologi/Operasi semuanya di-gate lewat
// canAccessModule (allowed_modules diatur admin, atau fallback per role
// kalau kosong) — konsisten dgn kontrol akses shell desktop (App.tsx
// canAccessMenu), bukan blanket "role bukan pegawai". Atur Jadwal
// sengaja TIDAK digating (menu default spt Cuti/Izin) — yg batasi
// cakupan aksesnya adalah dropdown Departemen di dalam
// AturJadwalMobileView sendiri (auto-isi departemen user login).
function buildLayananItems(user: AppUserLite): LayananItem[] {
  return [
    { key: 'lembur', label: 'Lembur', icon: <IconOvertime size={26} color="#059669" /> },
    { key: 'cuti', label: 'Cuti', icon: <IconUmbrella size={26} color="#059669" /> },
    { key: 'izin', label: 'Izin', icon: <IconFileText size={26} color="#059669" /> },
    { key: 'tugas', label: 'Tugas', icon: <IconTaskCheck size={26} color="#059669" /> },
    { key: 'lapor-it', label: 'Lapor IT', icon: <IconMonitor size={26} color="#059669" /> },
    { key: 'atur-jadwal', label: 'Atur Jadwal', icon: <IconCalendarCheck size={26} color="#059669" /> },
    ...(canAccessModule(user, 'rawat-jalan') ? [{ key: 'poli', label: 'Poli', icon: <IconStethoscope size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'igd') ? [{ key: 'igd', label: 'IGD', icon: <IconSiren size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'rawat-inap') ? [{ key: 'ranap', label: 'Ranap', icon: <IconBed size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'farmasi') ? [{ key: 'farmasi', label: 'Farmasi', icon: <IconPill size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'laboratorium') ? [{ key: 'lab', label: 'Lab', icon: <IconFlask size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'radiologi') ? [{ key: 'radiologi', label: 'Radiologi', icon: <IconRadiology size={26} color="#059669" /> }] : []),
    ...(canAccessModule(user, 'jadwal-operasi') ? [{ key: 'operasi', label: 'Operasi', icon: <IconScalpel size={26} color="#059669" /> }] : []),
  ];
}

function makeLayananClickHandler(h: LayananHandlers) {
  return (key: string, label: string) => {
    if (key === 'lembur') { h.onOpenLembur(); return; }
    if (key === 'cuti' || key === 'izin') { h.onOpenCutiIzin(key); return; }
    if (key === 'lapor-it') { h.onOpenLaporIt(); return; }
    if (key === 'atur-jadwal') { h.onOpenAturJadwal(); return; }
    if (key === 'poli') { h.onOpenPoli(); return; }
    if (key === 'igd') { h.onOpenIgd(); return; }
    if (key === 'ranap') { h.onOpenRanap(); return; }
    if (key === 'farmasi') { h.onOpenFarmasi(); return; }
    if (key === 'lab') { h.onOpenLab(); return; }
    if (key === 'radiologi') { h.onOpenRadiologi(); return; }
    Swal.fire({ icon: 'info', title: label, text: 'Fitur ini akan segera hadir.', confirmButtonColor: '#059669', timer: 1800, showConfirmButton: false });
  };
}

const LayananItemButton: React.FC<{ item: LayananItem; onClick: () => void }> = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 0 }}
  >
    <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {item.icon}
    </div>
    <span style={{ fontSize: 10, color: '#374151', textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
  </button>
);

// 3 baris x 4 kolom = 12 slot langsung tampil di Home; kalau menu yg
// diizinkan buat user > 12, slot terakhir diganti tombol "..." yg buka
// SemuaMenuMobileView (bukan expand di tempat) spy card Home tetap
// ringkas — padanan _LayananGrid + SemuaMenuView di home_tab.dart
// (Flutter).
const LAYANAN_GRID_SLOTS = 12;

const LayananCard: React.FC<LayananHandlers & { user: AppUserLite; onOpenSemuaMenu: () => void }> = (props) => {
  const { user, onOpenSemuaMenu } = props;
  const items = buildLayananItems(user);
  const hasMore = items.length > LAYANAN_GRID_SLOTS;
  const visibleItems = hasMore ? items.slice(0, LAYANAN_GRID_SLOTS - 1) : items;
  const handleClick = makeLayananClickHandler(props);

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 10 }}></div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {visibleItems.map((item) => (
            <LayananItemButton key={item.key} item={item} onClick={() => handleClick(item.key, item.label)} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={onOpenSemuaMenu}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 0 }}
            >
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconDots size={26} color="#059669" />
              </div>
              <span style={{ fontSize: 10, color: '#374151', textAlign: 'center', lineHeight: 1.2 }}>Lihat Semua</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Layar "Semua Menu" — dibuka dari tombol "Lihat Semua" di grid Home
// kalau menu yg diizinkan buat user > 12 (tidak muat di grid ringkas
// Home).
const SemuaMenuMobileView: React.FC<LayananHandlers & { user: AppUserLite; onBack: () => void }> = (props) => {
  const { user, onBack } = props;
  const items = buildLayananItems(user);
  const handleClick = makeLayananClickHandler(props);

  return (
    <div>
      <SubPageHeader title="Semua Menu" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {items.map((item) => (
              <LayananItemButton key={item.key} item={item} onClick={() => handleClick(item.key, item.label)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Kartu "Pengumuman & Informasi Penting" — di bawah kartu Layanan
// Lainnya. Dikelola HRD/admin lewat Kepegawaian > Pengumuman (desktop,
// lihat modules/PengumumanKepegawaian.tsx); di sini cuma tampilkan yang
// aktif=1. Kartu disembunyikan total kalau tidak ada pengumuman aktif
// (tidak menampilkan state kosong yang tidak berguna).
// ---------------------------------------------------------------------

type PengumumanItem = {
  id: number; judul: string; isi: string; prioritas: 'info' | 'penting' | 'urgent'; tanggal: string;
};

const pengumumanPrioritasStyle = (p: string) => {
  switch (p) {
    case 'urgent':
      return { border: '#dc2626', badgeBg: '#fee2e2', badgeColor: '#991b1b', label: 'Urgent' };
    case 'penting':
      return { border: '#f59e0b', badgeBg: '#fef9c3', badgeColor: '#854d0e', label: 'Penting' };
    default:
      return { border: '#2563eb', badgeBg: '#dbeafe', badgeColor: '#1d4ed8', label: 'Info' };
  }
};

const PENGUMUMAN_CARD_HEIGHT = 96;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const bukaDetailPengumuman = (item: PengumumanItem) => {
  Swal.fire({
    title: item.judul,
    html: `<div style="text-align:left"><div style="font-size:11px;color:#9ca3af;margin-bottom:8px">${escapeHtml(item.tanggal)}</div><div style="font-size:13px;color:#374151;white-space:pre-line;line-height:1.6">${escapeHtml(item.isi)}</div></div>`,
    confirmButtonColor: '#059669',
    confirmButtonText: 'Tutup',
  });
};

// Satu kartu pengumuman, tinggi TETAP (PENGUMUMAN_CARD_HEIGHT) — wajib
// sama tiap slide spy carousel bisa di-scroll-snap mulus. Tap kartu buka
// detail lengkap lewat SweetAlert (bukan expand di tempat, krn tinggi
// kartu fixed).
const PengumumanSlide: React.FC<{ item: PengumumanItem }> = ({ item }) => {
  const st = pengumumanPrioritasStyle(item.prioritas);
  return (
    <div
      onClick={() => bukaDetailPengumuman(item)}
      style={{
        height: PENGUMUMAN_CARD_HEIGHT, boxSizing: 'border-box', display: 'flex', gap: 10,
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 10, background: st.badgeBg, color: st.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconMegaphone size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.judul}</div>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: st.badgeBg, color: st.badgeColor, whiteSpace: 'nowrap' }}>
            {st.label}
          </span>
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{item.tanggal}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, whiteSpace: 'pre-line', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {item.isi}
        </div>
      </div>
    </div>
  );
};

// Carousel pengumuman — bisa di-swipe sendiri (spt banner iklan/info di
// DANA/ShopeePay, pakai scroll-snap horizontal) DAN otomatis
// gonta-ganti tiap 5 detik lewat scrollTo. onScroll jadi satu2nya
// sumber currentIndex, jadi auto-advance & swipe manual otomatis
// singkron. Padanan pengumuman_card.dart (Flutter, pakai PageView).
const PengumumanCard: React.FC = () => {
  const [list, setList] = React.useState<PengumumanItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentIndexRef = React.useRef(0);
  currentIndexRef.current = currentIndex;

  React.useEffect(() => {
    fetch('/api/pengumuman?aktif=1')
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const scrollToIndex = (i: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  React.useEffect(() => {
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      scrollToIndex((currentIndexRef.current + 1) % list.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [list.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== currentIndexRef.current) setCurrentIndex(i);
  };

  if (!loading && list.length === 0) return null;

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>Memuat...</div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
          >
            {list.map((item) => (
              <div key={item.id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', minWidth: 0 }}>
                <PengumumanSlide item={item} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const HomeTab: React.FC<{
  user: AppUserLite; me: MeResponse | null; loading: boolean; onOpenLembur: () => void; onOpenCutiIzin: (mode: 'cuti' | 'izin') => void; onOpenLaporIt: () => void;
  onOpenPoli: () => void; onOpenIgd: () => void; onOpenRanap: () => void; onOpenFarmasi: () => void; onOpenLab: () => void; onOpenRadiologi: () => void;
  onOpenAturJadwal: () => void; onOpenSemuaMenu: () => void;
}> = ({ user, me, loading, onOpenLembur, onOpenCutiIzin, onOpenLaporIt, onOpenPoli, onOpenIgd, onOpenRanap, onOpenFarmasi, onOpenLab, onOpenRadiologi, onOpenAturJadwal, onOpenSemuaMenu }) => {
  const hariIni = me?.hari_ini;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: GRADIENT, padding: '20px 16px 56px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar nama={me?.nama || user.full_name} photo={me?.photo} />
        <div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>Assalamualaikum Wr. Wb.</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{user.full_name}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, textTransform: 'capitalize' }}>{user.role}</div>
        </div>
      </div>

      <div style={{ margin: '-40px 16px 0', background: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(15,23,42,0.12)', padding: 16 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5 }}>MASUK</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 4 }}>{hariIni?.jam_datang || '--:--'}</div>
            <div style={{ fontSize: 10, color: hariIni?.keterlambatan && hariIni.keterlambatan !== '-' ? '#dc2626' : '#9ca3af' }}>
              {hariIni?.status || (loading ? 'Memuat...' : 'Belum absen')}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5 }}>PULANG</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 4 }}>{hariIni?.jam_pulang || '--:--'}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>{hariIni?.sudah_checkout ? 'Selesai' : ' '}</div>
          </div>
        </div>

        {/* Ganti tombol Absen Masuk/Pulang di sini — sudah ada tombol FAB
            khusus di bottom nav (scan wajah), jadi tombol ini cuma
            duplikat. Diganti info jadwal shift hari ini + status telat
            (kalau sudah check-in & terlambat) supaya lebih berguna. */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 700, letterSpacing: 0.5 }}>Jadwal Saya Hari Ini</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {hariIni?.jam_masuk_jadwal && hariIni?.jam_pulang_jadwal ? (
              <>
                <IconArrowDoor size={20} color="#111827" />
                <span>{hariIni.jam_masuk_jadwal}</span>
                <span style={{ color: '#9ca3af', fontWeight: 400 }}>---</span>
                <IconArrowDoor size={20} color="#111827" />
                <span>{hariIni.jam_pulang_jadwal}</span>
              </>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 400, color: '#9ca3af' }}>Tidak ada jadwal/libur</span>
            )}
          </div>
          {hariIni?.keterlambatan && hariIni.keterlambatan !== '-' && (
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: 600 }}>
              Anda telat {hariIni.keterlambatan}
            </div>
          )}
        </div>
      </div>

      <LayananCard
        user={user} onOpenLembur={onOpenLembur} onOpenCutiIzin={onOpenCutiIzin} onOpenLaporIt={onOpenLaporIt}
        onOpenPoli={onOpenPoli} onOpenIgd={onOpenIgd} onOpenRanap={onOpenRanap}
        onOpenFarmasi={onOpenFarmasi} onOpenLab={onOpenLab} onOpenRadiologi={onOpenRadiologi}
        onOpenAturJadwal={onOpenAturJadwal} onOpenSemuaMenu={onOpenSemuaMenu}
      />
      <PengumumanCard />
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Kehadiran (riwayat bulan berjalan)
// ---------------------------------------------------------------------

const KehadiranTab: React.FC<{ nik: string }> = ({ nik }) => {
  const [list, setList] = React.useState<RiwayatRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/presensi/riwayat?nik=${encodeURIComponent(nik)}`)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [nik]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Riwayat Kehadiran Bulan Ini</div>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Belum ada riwayat presensi bulan ini</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((r) => {
            const st = getStatusStyle(r.status);
            return (
              <div key={`${r.tanggal}-${r.jam_datang}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.tanggal}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {r.jam_datang || '--:--'} → {r.jam_pulang || '--:--'} · {r.durasi}
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Jadwal — jadwal shift sebulan (read-only), dari skema Khanza
// jadwal_pegawai + jam_masuk (lihat backend/presensi_handler.go). Tidak
// ada UI edit di sini — pengaturan jadwal shift tetap lewat menu Khanza
// yang sudah ada, ini cuma tampilan buat pegawai lihat jadwalnya sendiri
// lewat HP.
// ---------------------------------------------------------------------

type JadwalRow = { tanggal: string; shift: string; jam_masuk: string; jam_pulang: string };

const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

const JadwalTab: React.FC<{ nik: string }> = ({ nik }) => {
  const [list, setList] = React.useState<JadwalRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const today = new Date();

  React.useEffect(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/presensi/jadwal?nik=${encodeURIComponent(nik)}`)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [nik]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
        Jadwal Shift — {today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((r) => {
            const tglObj = new Date(r.tanggal + 'T00:00:00');
            const isToday = r.tanggal === todayStr;
            const adaJadwal = !!r.shift;
            return (
              <div
                key={r.tanggal}
                style={{
                  background: isToday ? '#ecfdf5' : '#fff',
                  border: isToday ? '1px solid #059669' : '1px solid #e5e7eb',
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                    {tglObj.getDate()} {HARI_INDO[tglObj.getDay()]}
                    {isToday && <span style={{ marginLeft: 6, fontSize: 9, color: '#059669', fontWeight: 700 }}>HARI INI</span>}
                  </div>
                  {adaJadwal && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {r.jam_masuk?.slice(0, 5)} – {r.jam_pulang?.slice(0, 5)}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                  background: adaJadwal ? '#d1fae5' : '#f3f4f6', color: adaJadwal ? '#047857' : '#9ca3af',
                }}>
                  {adaJadwal ? r.shift : 'Libur'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Saya — menu profil ringkas pegawai + akses ke Profil (data diri
// + upload foto) dan Pengaturan Akun (ubah password), tombol Keluar
// tetap di paling bawah.
// ---------------------------------------------------------------------

type PresensiProfilResp = {
  nik: string; nama: string; no_telp: string; email: string; departemen: string; photo: string;
};

const SubPageHeader: React.FC<{ title: string; onBack: () => void; iconSize?: number; fontSize?: number }> = ({ title, onBack, iconSize = 20, fontSize = 14 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px' }}>
    <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: '#111827' }}>
      <IconArrowLeft size={iconSize} />
    </button>
    <span style={{ fontSize, fontWeight: 700, color: '#111827' }}>{title}</span>
  </div>
);

const MenuRow: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px',
      borderBottom: '1px solid #f3f4f6', textAlign: 'left',
    }}
  >
    <div style={{ width: 32, height: 32, borderRadius: 10, background: '#eef2ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</span>
    <IconChevronRight size={16} color="#9ca3af" />
  </button>
);

const ProfilRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '-'}</div>
    </div>
  </div>
);

// Tab: Saya > Profil — data diri (read-only, sumber: pegawai + petugas/
// dokter, lihat backend/presensi_handler.go getPresensiProfil) + upload
// foto profil (satu-satunya field yang bisa diedit dari sini).
const ProfilDetailView: React.FC<{ nik: string; onBack: () => void; onFotoUpdated: () => void }> = ({ nik, onBack, onFotoUpdated }) => {
  const [profil, setProfil] = React.useState<PresensiProfilResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProfil = React.useCallback(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/presensi/profil?nik=${encodeURIComponent(nik)}`)
      .then(r => r.json())
      .then(d => setProfil(d))
      .catch(() => setProfil(null))
      .finally(() => setLoading(false));
  }, [nik]);

  React.useEffect(() => { fetchProfil(); }, [fetchProfil]);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Gagal mengunggah foto');

      const res = await fetch('/api/presensi/profil/foto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, photo: uploadData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui foto');

      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Foto profil diperbarui', confirmButtonColor: '#059669', timer: 1500, showConfirmButton: false });
      fetchProfil();
      onFotoUpdated();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <SubPageHeader title="Profil" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 20px' }}>
          <div style={{ position: 'relative' }}>
            <Avatar nama={profil?.nama || ''} photo={profil?.photo} size={80} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Ganti foto profil"
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%',
                background: GRADIENT, border: '3px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer', padding: 0,
              }}
            >
              <IconCamera size={13} color="#fff" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
          </div>
          <div style={{ fontSize: 11, color: uploading ? '#059669' : '#9ca3af', marginTop: 8 }}>
            {uploading ? 'Mengunggah...' : 'Ketuk ikon kamera utk ganti foto'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '4px 14px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
          ) : !profil ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Data profil tidak ditemukan</div>
          ) : (
            <>
              <ProfilRow icon={<IconIdCard size={15} />} label="NIP" value={profil.nik} />
              <ProfilRow icon={<IconUser size={15} />} label="Nama" value={profil.nama} />
              <ProfilRow icon={<IconPhone size={15} />} label="No. Handphone" value={profil.no_telp} />
              <ProfilRow icon={<IconMail size={15} />} label="Email" value={profil.email} />
              <ProfilRow icon={<IconBuilding size={15} />} label="Departemen" value={profil.departemen} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Tab: Saya > Pengaturan Akun > Ubah Password — reuse endpoint yang
// sama dgn ModalGantiPassword.tsx (shell desktop): POST /api/auth/
// change-password, wajib password lama.
const PengaturanAkunView: React.FC<{ userId: number; onBack: () => void }> = ({ userId, onBack }) => {
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Semua field wajib diisi', confirmButtonColor: '#059669' });
      return;
    }
    if (newPassword.length < 6) {
      Swal.fire({ icon: 'warning', title: 'Password baru minimal 6 karakter', confirmButtonColor: '#059669' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Konfirmasi password baru tidak cocok', confirmButtonColor: '#059669' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti password');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diganti', confirmButtonColor: '#059669', timer: 1800, showConfirmButton: false });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      onBack();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SubPageHeader title="Pengaturan Akun" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <IconLock size={16} color="#4338ca" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Ubah Password</span>
          </div>
          <form onSubmit={handleSimpan} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Password Lama</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password Baru</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Konfirmasi Password Baru</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 4, padding: '11px', borderRadius: 10, border: 'none',
                background: saving ? '#a7f3d0' : GRADIENT, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const SayaTab: React.FC<{ user: AppUserLite; nik: string; me: MeResponse | null; onLogout: () => void; onProfilUpdated: () => void }> = ({ user, nik, me, onLogout, onProfilUpdated }) => {
  const [view, setView] = React.useState<'menu' | 'profil' | 'pengaturan'>('menu');

  if (view === 'profil') {
    return <ProfilDetailView nik={nik} onBack={() => setView('menu')} onFotoUpdated={onProfilUpdated} />;
  }
  if (view === 'pengaturan') {
    return <PengaturanAkunView userId={user.id} onBack={() => setView('menu')} />;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
        <Avatar nama={me?.nama || user.full_name} photo={me?.photo} size={64} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 8 }}>{user.full_name}</div>
        <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{user.role}</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '2px 14px', marginTop: 16 }}>
        <MenuRow icon={<IconUser size={16} />} label="Profil" onClick={() => setView('profil')} />
        <MenuRow icon={<IconSettings size={16} />} label="Pengaturan Akun" onClick={() => setView('pengaturan')} />
      </div>

      <button
        type="button"
        onClick={onLogout}
        style={{
          width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: '1px solid #fecaca',
          background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <IconLogOut size={16} color="#dc2626" /> Keluar
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------
// Lembur — ajukan lembur dari HP (tanggal, jam mulai/selesai,
// keterangan) + riwayat status. Fitur baru murni ERMApp, lihat
// backend/lembur_handler.go. Disetujui/ditolak oleh HRD lewat desktop
// (Kepegawaian > Lembur, modules/LemburKepegawaian.tsx) — di sini cuma
// ajukan + pantau status, tidak ada approval.
// ---------------------------------------------------------------------

type LemburItem = {
  id: number; tanggal: string; jam_mulai: string; jam_selesai: string; durasi_menit: number;
  keterangan: string; status: 'menunggu' | 'disetujui' | 'ditolak'; catatan_approval: string; disetujui_oleh: string;
};

const lemburStatusStyle = (s: string) => {
  switch (s) {
    case 'disetujui': return { bg: '#dcfce7', color: '#166534', label: 'Disetujui' };
    case 'ditolak':   return { bg: '#fee2e2', color: '#991b1b', label: 'Ditolak' };
    default:          return { bg: '#fef9c3', color: '#854d0e', label: 'Menunggu' };
  }
};

function formatJamMenit(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return j > 0 ? `${j}j ${m}m` : `${m}m`;
}

// iOS/WebKit menampilkan input type="time" kosong dengan jam saat ini sbg
// "hantu" abu-abu yang mudah disalah-artikan sbg nilai terisi — supaya tidak
// ambigu, field jam selalu diberi nilai default nyata (bisa diubah user).
function jamOffsetSekarang(offsetMenit = 0): string {
  const d = new Date(Date.now() + offsetMenit * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const LemburView: React.FC<{ nik: string; onBack: () => void }> = ({ nik, onBack }) => {
  const [list, setList] = React.useState<LemburItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [tanggal, setTanggal] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [jamMulai, setJamMulai] = React.useState(() => jamOffsetSekarang());
  const [jamSelesai, setJamSelesai] = React.useState(() => jamOffsetSekarang(60));
  const [keterangan, setKeterangan] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  };
  // iOS merender widget date/time bawaan dgn lebar intrinsik yg lebih besar
  // dari box-nya kalau padding kiri-kanan terlalu lebar — dipersempit +
  // WebkitAppearance none supaya pas di kolom grid sempit tanpa meluber.
  const dateTimeInputStyle: React.CSSProperties = {
    ...inputStyle, padding: '9px 6px', WebkitAppearance: 'none',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 };

  const fetchList = React.useCallback(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/lembur/saya?nik=${encodeURIComponent(nik)}`)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [nik]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggal || !jamMulai || !jamSelesai || !keterangan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Semua field wajib diisi', confirmButtonColor: '#059669' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lembur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, tanggal, jam_mulai: jamMulai, jam_selesai: jamSelesai, keterangan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengajuan');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengajuan lembur terkirim, tunggu persetujuan HRD', confirmButtonColor: '#059669', timer: 2000, showConfirmButton: false });
      setShowForm(false);
      setJamMulai(jamOffsetSekarang()); setJamSelesai(jamOffsetSekarang(60)); setKeterangan('');
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SubPageHeader title="Lembur" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: GRADIENT,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <IconOvertime size={16} color="#fff" /> Ajukan Lembur Baru
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', boxSizing: 'border-box' }}>
            <div>
              <label style={labelStyle}>Tanggal</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={dateTimeInputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Jam Mulai</label>
                <input type="time" value={jamMulai} onChange={e => setJamMulai(e.target.value)} style={dateTimeInputStyle} />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Jam Selesai</label>
                <input type="time" value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} style={dateTimeInputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Keterangan</label>
              <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Alasan/tugas lembur" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Batal
              </button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: saving ? '#a7f3d0' : GRADIENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 10 }}>Riwayat Pengajuan</div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Belum ada pengajuan lembur</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((item) => {
                const st = lemburStatusStyle(item.status);
                return (
                  <div key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{item.tanggal}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {item.jam_mulai} – {item.jam_selesai} · {formatJamMenit(item.durasi_menit)}
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{item.keterangan}</div>
                    {item.status !== 'menunggu' && item.catatan_approval && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                        Catatan {item.disetujui_oleh ? `(${item.disetujui_oleh})` : ''}: {item.catatan_approval}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Cuti & Izin — padanan PengajuanCutiPegawai.java/PengajuanCutiAdmin
// .java (Khanza). SATU alur yang sama utk kedua menu ("Cuti" & "Izin"
// di kartu Menu Utama), cuma beda `mode` yang menyaring pilihan
// urgensi & riwayat yang ditampilkan (lihat backend/cuti_izin_handler
// .go, kategoriUrgensiList). Jumlah hari dihitung persis formula Java
// (to_days akhir - to_days awal, tidak inklusif, tidak mengecualikan
// akhir pekan/libur) dan TIDAK ada pengecekan sisa jatah cuti — Khanza
// sendiri tidak pernah mengecek itu di alur ini.
// ---------------------------------------------------------------------

type CutiIzinItem = {
  no_pengajuan: string; tanggal_awal: string; tanggal_akhir: string; urgensi: string;
  alamat: string; jumlah: number; kepentingan: string; nik_pj: string; nama_pj: string;
  status: string; catatan_approval: string; disetujui_oleh: string;
};

const URGENSI_CUTI = ['Tahunan', 'Besar', 'Sakit', 'Bersalin'];
const URGENSI_IZIN = ['Alasan Penting', 'Keterangan Lainnya'];

const cutiIzinStatusStyle = (s: string) => {
  switch (s) {
    case 'Disetujui': return { bg: '#dcfce7', color: '#166534' };
    case 'Ditolak':   return { bg: '#fee2e2', color: '#991b1b' };
    default:          return { bg: '#fef9c3', color: '#854d0e' };
  }
};

function hitungJumlahHariFE(awal: string, akhir: string): number {
  if (!awal || !akhir) return 0;
  const a = new Date(awal + 'T00:00:00');
  const b = new Date(akhir + 'T00:00:00');
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

type PegawaiOpsi = { nik: string; nama: string; jbtn: string };

// Modal pilih PJ pengganti — cuma nampilin pegawai AKTIF satu
// departemen dgn pemohon (bukan cari lintas departemen), diri sendiri
// dikecualikan. Ada search box buat filter nama di dalam daftar itu.
// Padanan _PjPickerSheet di cuti_izin_view.dart (Flutter).
const PjPickerModal: React.FC<{ departemen: string; excludeNik: string; onClose: () => void; onSelect: (p: PegawaiOpsi) => void }> = ({ departemen, excludeNik, onClose, onSelect }) => {
  const [query, setQuery] = React.useState('');
  const [list, setList] = React.useState<PegawaiOpsi[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ departemen, stts_aktif: 'AKTIF' });
      if (query.trim()) params.set('search', query.trim());
      fetch(`/api/pegawai/list?${params.toString()}`)
        .then(r => r.json())
        .then((d: PegawaiOpsi[]) => setList(Array.isArray(d) ? d.filter((p) => p.nik !== excludeNik) : []))
        .catch(() => setList([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [departemen, excludeNik, query]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', height: '80vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Pilih Penanggung Jawab Pengganti</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, marginBottom: 12 }}>Anggota departemen Anda sendiri</div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Tidak ada pegawai ditemukan</div>
          ) : (
            list.map((p) => (
              <div
                key={p.nik}
                onClick={() => onSelect(p)}
                style={{ padding: '10px 4px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              >
                <div style={{ fontWeight: 500, color: '#111827' }}>{p.nama}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.nik}{p.jbtn ? ` · ${p.jbtn}` : ''}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CutiIzinView: React.FC<{ nik: string; mode: 'cuti' | 'izin'; onBack: () => void }> = ({ nik, mode, onBack }) => {
  const judul = mode === 'cuti' ? 'Cuti' : 'Izin';
  const urgensiOpsi = mode === 'cuti' ? URGENSI_CUTI : URGENSI_IZIN;

  const [list, setList] = React.useState<CutiIzinItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [tanggalAwal, setTanggalAwal] = React.useState(todayDateStr());
  const [tanggalAkhir, setTanggalAkhir] = React.useState(todayDateStr());
  const [urgensi, setUrgensi] = React.useState(urgensiOpsi[0]);
  const [alamat, setAlamat] = React.useState('');
  const [kepentingan, setKepentingan] = React.useState('');
  const [pjTerpilih, setPjTerpilih] = React.useState<PegawaiOpsi | null>(null);
  const [showPjModal, setShowPjModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // Pegawai shift Reguler beneran tidak punya rekan sif buat gantian —
  // PJ pengganti jadi opsional khusus utk mereka (lihat backend
  // cuti_izin_handler.go submitCutiIzin). Default false (dianggap
  // wajib) sampai kebukti sebaliknya dari data server. myDepartemen
  // dipakai buat batasi modal pilih PJ cuma ke departemen sendiri.
  const [isRegulerShift, setIsRegulerShift] = React.useState(false);
  const [myDepartemen, setMyDepartemen] = React.useState<string | null>(null);

  const jumlahHari = hitungJumlahHariFE(tanggalAwal, tanggalAkhir);

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  };
  const dateTimeInputStyle: React.CSSProperties = {
    ...inputStyle, padding: '9px 6px', WebkitAppearance: 'none',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 };

  const fetchList = React.useCallback(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/pengajuan-cuti/saya?nik=${encodeURIComponent(nik)}&kategori=${mode}`)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [nik, mode]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  React.useEffect(() => {
    if (!nik) return;
    const now = new Date();
    const params = new URLSearchParams({ tahun: String(now.getFullYear()), bulan: pad2(now.getMonth() + 1), search: nik });
    fetch(`/api/jadwal-pegawai/list?${params.toString()}`)
      .then(r => r.json())
      .then((d: JadwalPegawaiRow[]) => {
        const match = Array.isArray(d) ? d.find((p) => p.nik === nik) : null;
        if (match) {
          setIsRegulerShift(match.jadwal_tetap_shift.trim().toLowerCase() === 'reguler');
          setMyDepartemen(match.departemen);
        }
      })
      .catch(() => {});
  }, [nik]);

  const resetForm = () => {
    setTanggalAwal(todayDateStr()); setTanggalAkhir(todayDateStr()); setUrgensi(urgensiOpsi[0]);
    setAlamat(''); setKepentingan(''); setPjTerpilih(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pjWajibTapiKosong = !isRegulerShift && !pjTerpilih;
    if (!tanggalAwal || !tanggalAkhir || !alamat.trim() || !kepentingan.trim() || pjWajibTapiKosong) {
      Swal.fire({ icon: 'warning', title: 'Semua field wajib diisi', text: pjWajibTapiKosong ? 'Pilih penanggung jawab pengganti dulu' : undefined, confirmButtonColor: '#059669' });
      return;
    }
    if (tanggalAkhir < tanggalAwal) {
      Swal.fire({ icon: 'warning', title: 'Tanggal akhir tidak boleh sebelum tanggal awal', confirmButtonColor: '#059669' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pengajuan-cuti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik, tanggal_awal: tanggalAwal, tanggal_akhir: tanggalAkhir, urgensi, alamat, kepentingan, nik_pj: pjTerpilih?.nik ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengajuan');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: `Pengajuan ${judul.toLowerCase()} terkirim, tunggu persetujuan HRD`, confirmButtonColor: '#059669', timer: 2000, showConfirmButton: false });
      setShowForm(false);
      resetForm();
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  const handleBatalkan = async (item: CutiIzinItem) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Batalkan Pengajuan?',
      html: `Pengajuan ${judul.toLowerCase()} ${item.tanggal_awal} – ${item.tanggal_akhir} akan dibatalkan.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Tidak',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/pengajuan-cuti/${item.no_pengajuan}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membatalkan pengajuan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengajuan dibatalkan', confirmButtonColor: '#059669', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    }
  };

  return (
    <div>
      <SubPageHeader title={judul} onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: GRADIENT,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {mode === 'cuti' ? <IconUmbrella size={16} color="#fff" /> : <IconFileText size={16} color="#fff" />}
            Ajukan {judul} Baru
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Tanggal Awal</label>
                <input type="date" value={tanggalAwal} onChange={e => setTanggalAwal(e.target.value)} style={dateTimeInputStyle} />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Tanggal Akhir</label>
                <input type="date" value={tanggalAkhir} onChange={e => setTanggalAkhir(e.target.value)} style={dateTimeInputStyle} />
              </div>
            </div>
            {jumlahHari > 0 && (
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{jumlahHari} hari</div>
            )}
            <div>
              <label style={labelStyle}>Jenis {judul}</label>
              <select value={urgensi} onChange={e => setUrgensi(e.target.value)} style={inputStyle}>
                {urgensiOpsi.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Alamat Tujuan</label>
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat selama izin/cuti" maxLength={100} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Keperluan</label>
              <textarea value={kepentingan} onChange={e => setKepentingan(e.target.value)} placeholder="Alasan pengajuan" rows={2} maxLength={70} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Penanggung Jawab Pengganti{isRegulerShift ? ' (opsional)' : ''}</label>
              {isRegulerShift && !pjTerpilih && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Shift Reguler tidak wajib punya pengganti.</div>
              )}
              {pjTerpilih ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 10, border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
                  <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{pjTerpilih.nama}</span>
                  <button type="button" onClick={() => setPjTerpilih(null)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>Ganti</button>
                </div>
              ) : (
                // Bukan cari-langsung lintas departemen lagi — tap buka
                // modal yg cuma nampilin anggota departemen sendiri
                // (lihat PjPickerModal), supaya user tak salah pilih
                // pengganti dari departemen lain.
                <button
                  type="button"
                  onClick={() => {
                    if (!myDepartemen) { Swal.fire({ icon: 'warning', title: 'Departemen Anda belum terdeteksi', text: 'Coba lagi sebentar.', confirmButtonColor: '#059669' }); return; }
                    setShowPjModal(true);
                  }}
                  style={{ ...inputStyle, textAlign: 'left', background: '#fff', color: '#9ca3af', cursor: 'pointer' }}
                >
                  Pilih penanggung jawab pengganti
                </button>
              )}
            </div>
            {showPjModal && myDepartemen && (
              <PjPickerModal
                departemen={myDepartemen}
                excludeNik={nik}
                onClose={() => setShowPjModal(false)}
                onSelect={(p) => { setPjTerpilih(p); setShowPjModal(false); }}
              />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Batal
              </button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: saving ? '#a7f3d0' : GRADIENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 10 }}>Riwayat Pengajuan</div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Belum ada pengajuan {judul.toLowerCase()}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((item) => {
                const st = cutiIzinStatusStyle(item.status);
                return (
                  <div key={item.no_pengajuan} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{item.tanggal_awal} – {item.tanggal_akhir}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.urgensi} · {item.jumlah} hari</div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{item.kepentingan}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>PJ Pengganti: {item.nama_pj || '-'}</div>
                    {item.catatan_approval && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                        Catatan{item.disetujui_oleh ? ` (${item.disetujui_oleh})` : ''}: {item.catatan_approval}
                      </div>
                    )}
                    {item.status === 'Proses Pengajuan' && (
                      <button
                        type="button"
                        onClick={() => handleBatalkan(item)}
                        style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Lapor IT
// ---------------------------------------------------------------------

type LaporItItem = {
  id: number; kategori: string; lokasi: string; judul: string; deskripsi: string; foto: string;
  status: 'menunggu' | 'diproses' | 'selesai' | 'ditolak'; catatan_penyelesaian: string; ditangani_oleh: string; created_at: string;
};

const KATEGORI_LAPOR_IT: { value: string; label: string }[] = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'jaringan', label: 'Jaringan' },
  { value: 'printer', label: 'Printer' },
  { value: 'lainnya', label: 'Lainnya' },
];

const laporItStatusStyle = (s: string) => {
  switch (s) {
    case 'diproses': return { bg: '#dbeafe', color: '#1e40af', label: 'Diproses' };
    case 'selesai':   return { bg: '#dcfce7', color: '#166534', label: 'Selesai' };
    case 'ditolak':   return { bg: '#fee2e2', color: '#991b1b', label: 'Ditolak' };
    default:          return { bg: '#fef9c3', color: '#854d0e', label: 'Menunggu' };
  }
};

const LaporItView: React.FC<{ nik: string; onBack: () => void }> = ({ nik, onBack }) => {
  const [list, setList] = React.useState<LaporItItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [kategori, setKategori] = React.useState('hardware');
  const [lokasi, setLokasi] = React.useState('');
  const [judul, setJudul] = React.useState('');
  const [deskripsi, setDeskripsi] = React.useState('');
  const [foto, setFoto] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 };

  const fetchList = React.useCallback(() => {
    if (!nik) return;
    setLoading(true);
    fetch(`/api/lapor-it/saya?nik=${encodeURIComponent(nik)}`)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [nik]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Gagal mengunggah foto');
      setFoto(uploadData.url || '');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setKategori('hardware'); setLokasi(''); setJudul(''); setDeskripsi(''); setFoto('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lokasi.trim() || !judul.trim()) {
      Swal.fire({ icon: 'warning', title: 'Lokasi & judul wajib diisi', confirmButtonColor: '#059669' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lapor-it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, kategori, lokasi, judul, deskripsi, foto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim laporan');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Laporan terkirim ke tim IT', confirmButtonColor: '#059669', timer: 2000, showConfirmButton: false });
      setShowForm(false);
      resetForm();
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  const handleBatalkan = async (item: LaporItItem) => {
    const result = await Swal.fire({
      icon: 'warning', title: 'Batalkan laporan ini?', showCancelButton: true,
      confirmButtonText: 'Ya, batalkan', cancelButtonText: 'Tidak', confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lapor-it/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membatalkan laporan');
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    }
  };

  return (
    <div>
      <SubPageHeader title="Lapor IT" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: GRADIENT,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <IconMonitor size={16} color="#fff" /> Lapor Kendala Baru
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', boxSizing: 'border-box' }}>
            <div>
              <label style={labelStyle}>Kategori</label>
              <select value={kategori} onChange={e => setKategori(e.target.value)} style={inputStyle}>
                {KATEGORI_LAPOR_IT.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lokasi/Ruangan</label>
              <input value={lokasi} onChange={e => setLokasi(e.target.value)} placeholder="mis. Ruang Rekam Medis" maxLength={100} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Judul Singkat</label>
              <input value={judul} onChange={e => setJudul(e.target.value)} placeholder="mis. Komputer tidak menyala" maxLength={150} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Deskripsi</label>
              <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Jelaskan kendalanya lebih detail" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={labelStyle}>Foto (opsional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                style={{ display: 'none' }}
                id="lapor-it-foto-input"
              />
              {foto ? (
                <div style={{ position: 'relative', width: 100 }}>
                  <img src={mediaUrl(foto)} alt="Foto kendala" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid #d1d5db' }} />
                  <button
                    type="button"
                    onClick={() => setFoto('')}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="lapor-it-foto-input"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: 100, height: 100, borderRadius: 10, border: '1px dashed #d1d5db', color: '#9ca3af', fontSize: 10, cursor: 'pointer', flexDirection: 'column' }}
                >
                  <IconCamera size={20} color="#9ca3af" />
                  {uploading ? 'Mengunggah...' : 'Tambah Foto'}
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || uploading ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: '#111827' }}>Riwayat Laporan</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada laporan</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {list.map((item) => {
              const st = laporItStatusStyle(item.status);
              const kategoriLabel = KATEGORI_LAPOR_IT.find((k) => k.value === item.kategori)?.label || item.kategori;
              return (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{item.judul}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{kategoriLabel} · {item.lokasi}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                  {item.deskripsi && <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{item.deskripsi}</div>}
                  {item.foto && <img src={mediaUrl(item.foto)} alt="Foto kendala" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 6 }} />}
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{item.created_at}</div>
                  {item.catatan_penyelesaian && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                      Catatan{item.ditangani_oleh ? ` (${item.ditangani_oleh})` : ''}: {item.catatan_penyelesaian}
                    </div>
                  )}
                  {item.status === 'menunggu' && (
                    <button
                      type="button"
                      onClick={() => handleBatalkan(item)}
                      style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Poli (Daftar Pasien Kunjungan Poli hari ini)
// ---------------------------------------------------------------------

type PoliPasienItem = {
  no_reg: string; no_rawat: string; tgl_registrasi: string; jam_reg: string;
  kd_dokter: string; nm_dokter: string; no_rkm_medis: string; nm_pasien: string;
  nm_poli: string; stts: string; status_bayar: string; umur: string; kd_poli: string;
};

const poliStatusStyle = (s: string) => {
  switch (s) {
    case 'Sudah':   return { bg: '#dcfce7', color: '#166534', label: 'Sudah' };
    case 'Belum':   return { bg: '#fef9c3', color: '#854d0e', label: 'Belum' };
    case 'Batal':   return { bg: '#fee2e2', color: '#991b1b', label: 'Batal' };
    case 'Dirujuk': return { bg: '#dbeafe', color: '#1e40af', label: 'Dirujuk' };
    case 'Dirawat': return { bg: '#f3e8ff', color: '#6b21a8', label: 'Dirawat' };
    default:        return { bg: '#f3f4f6', color: '#374151', label: s || '-' };
  }
};

// Padanan RawatJalanView (App.tsx) versi ringkas utk HP — cuma tab "Poli
// Hari Ini", tanpa rentang tanggal/dropdown filter kompleks. Kunci akun
// dokter ke pasiennya sendiri persis pola yg sama (App.tsx:366-373): kalau
// akun dokter belum ditautkan ke kd_dokter, daftar SENGAJA dikosongkan
// (bukan tampil semua) supaya kesalahan tautan ketahuan, bukan diam-diam
// bocor ke pasien dokter lain. IGDK (kode unit IGD) sudah difilter di
// backend (main.go, query poli-today) — bukan kunjungan poli terjadwal.
const PoliMobileView: React.FC<{ user: AppUserLite; onBack: () => void }> = ({ user, onBack }) => {
  const isDokterLocked = user.role === 'dokter';
  const lockedKdDokter = user.kd_dokter || '';
  const [list, setList] = React.useState<PoliPasienItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/rawat-jalan/poli-today')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Gagal mengambil data pasien poli');
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    let rows = list;
    if (isDokterLocked) {
      rows = lockedKdDokter ? rows.filter((p) => p.kd_dokter === lockedKdDokter) : [];
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => p.nm_pasien.toLowerCase().includes(q) || p.no_rkm_medis.toLowerCase().includes(q));
    }
    return rows;
  }, [list, isDokterLocked, lockedKdDokter, searchText]);

  return (
    <div>
      <SubPageHeader title="Daftar Pasien Poli" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cari nama / no. RM..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {isDokterLocked && !lockedKdDokter && (
          <div style={{ padding: 12, borderRadius: 10, background: '#fef3c7', color: '#92400e', fontSize: 11, marginBottom: 12 }}>
            Akun ini belum ditautkan ke data dokter (kd_dokter). Hubungi admin agar daftar pasien poli bisa ditampilkan.
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada pasien poli hari ini</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((p) => {
              const st = poliStatusStyle(p.stts);
              return (
                <div key={p.no_reg} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.nm_pasien}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.no_rkm_medis} · {p.umur}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{p.nm_poli} · {p.nm_dokter}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Jam daftar {p.jam_reg} · {p.status_bayar}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: IGD (Daftar Pasien IGD hari ini)
// ---------------------------------------------------------------------

// Kebalikan dari PoliMobileView: backend /api/igd/list HANYA mengembalikan
// kunjungan dgn kd_poli='IGDK' (poli-today justru mengecualikannya). Tidak
// dikunci ke kd_dokter seperti Poli — IGD sifatnya siapa saja petugas jaga
// yg perlu lihat seluruh antrean, bukan pasien milik satu dokter tertentu.
const IgdMobileView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [list, setList] = React.useState<PoliPasienItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/igd/list')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Gagal mengambil data pasien IGD');
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.nm_pasien.toLowerCase().includes(q) || p.no_rkm_medis.toLowerCase().includes(q));
  }, [list, searchText]);

  return (
    <div>
      <SubPageHeader title="Daftar Pasien IGD" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cari nama / no. RM..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada pasien IGD hari ini</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((p) => {
              const st = poliStatusStyle(p.stts);
              return (
                <div key={p.no_reg} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.nm_pasien}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.no_rkm_medis} · {p.umur}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{p.nm_dokter}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Jam daftar {p.jam_reg} · {p.status_bayar}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Ranap (Daftar Pasien Rawat Inap yang belum pulang)
// ---------------------------------------------------------------------

type RanapPasienItem = {
  no_rawat: string; no_rkm_medis: string; nm_pasien: string; umur: string;
  kamar: string; tgl_masuk: string; jam_masuk: string; lama: string;
  nm_dokter: string; kd_dokter: string; status_bayar: string; stts_pulang: string;
};

// Reuse endpoint yang sama dgn RawatInapView desktop (RawatInap.tsx) —
// bukan bikin endpoint baru spt Poli/IGD, krn modul Ranap sudah lengkap di
// desktop. Dokter-lock dilakukan lewat query param `kd_dokter` (backend
// filter via tabel dpjp_ranap), persis pola RawatInapView: kalau akun
// dokter belum ditautkan (kd_dokter kosong), filter itu SENGAJA tidak
// dikirim sehingga daftar tampil semua pasien — ini beda dr Poli yg
// sengaja mengosongkan daftar kalau belum ditautkan, tapi konsisten dgn
// perilaku RawatInapView desktop yg sudah ada (tidak fail-closed).
const RanapMobileView: React.FC<{ user: AppUserLite; onBack: () => void }> = ({ user, onBack }) => {
  const [list, setList] = React.useState<RanapPasienItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    let url = '/api/rawat-inap/list?status=belum-pulang';
    if (user.role === 'dokter' && user.kd_dokter) {
      url += `&kd_dokter=${encodeURIComponent(user.kd_dokter)}`;
    }
    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Gagal mengambil data pasien rawat inap');
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [user.role, user.kd_dokter]);

  const filtered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.nm_pasien.toLowerCase().includes(q) || p.no_rkm_medis.toLowerCase().includes(q));
  }, [list, searchText]);

  return (
    <div>
      <SubPageHeader title="Daftar Pasien Ranap" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cari nama / no. RM..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada pasien rawat inap</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((p) => (
              <div key={p.no_rawat} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.nm_pasien}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.no_rkm_medis} · {p.umur}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#f3e8ff', color: '#6b21a8', whiteSpace: 'nowrap' }}>
                    {p.lama || '-'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{p.kamar} · {p.nm_dokter}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Masuk {p.tgl_masuk} {p.jam_masuk} · {p.status_bayar}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Tab: Farmasi, Lab, Radiologi (antrean permintaan lintas pasien)
// ---------------------------------------------------------------------

// Badge "Belum ..." (kuning, masih antre) vs "Sudah ..." (hijau, selesai) —
// dipakai bersama oleh Farmasi/Lab/Radiologi, ketiganya pakai kosakata
// status yg sama polanya (dihitung dari kolom tgl_* di backend).
const queueStatusStyle = (s: string) => {
  if (s.startsWith('Sudah')) return { bg: '#dcfce7', color: '#166534' };
  if (s.startsWith('Belum')) return { bg: '#fef9c3', color: '#854d0e' };
  return { bg: '#f3f4f6', color: '#374151' };
};

type FarmasiResepItem = {
  no_resep: string; tgl_peresepan: string; jam_peresepan: string; no_rawat: string;
  no_rkm_medis: string; nm_pasien: string; nm_dokter: string; status: string;
  nm_poli: string; jenis_bayar: string;
};

// Reuse endpoint yg sama dgn dashboard "Permintaan Resep" desktop
// (Apotek.tsx > PermintaanResepView) — /api/permintaan-resep/ralan. Cuma
// antrean rawat jalan (ralan) yg diport dulu, sama pola inkremental fase-1
// yg dipakai modul itu sendiri (ranap menyusul kalau dibutuhkan).
const FarmasiMobileView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [list, setList] = React.useState<FarmasiResepItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/permintaan-resep/ralan')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Gagal mengambil data permintaan resep');
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.nm_pasien.toLowerCase().includes(q) || p.no_rkm_medis.toLowerCase().includes(q));
  }, [list, searchText]);

  return (
    <div>
      <SubPageHeader title="Permintaan Resep" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cari nama / no. RM..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada permintaan resep hari ini</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((p) => {
              const st = queueStatusStyle(p.status);
              return (
                <div key={p.no_resep} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.nm_pasien}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.no_rkm_medis}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{p.nm_poli} · {p.nm_dokter}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Resep {p.jam_peresepan} · {p.jenis_bayar}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

type PermintaanQueueItem = {
  noorder: string; tgl_permintaan: string; jam_permintaan: string; no_rawat: string;
  no_rkm_medis: string; nm_pasien: string; nm_dokter: string; status: string; diagnosa_klinis: string;
};

// Komponen generik dipakai oleh Lab & Radiologi — bentuk datanya identik
// (permintaan_lab & permintaan_radiologi punya kolom yg sama persis), cuma
// beda endpoint & judul halaman.
const PermintaanQueueMobileView: React.FC<{ title: string; endpoint: string; emptyText: string; onBack: () => void }> = ({ title, endpoint, emptyText, onBack }) => {
  const [list, setList] = React.useState<PermintaanQueueItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(endpoint)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Gagal mengambil data');
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [endpoint]);

  const filtered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.nm_pasien.toLowerCase().includes(q) || p.no_rkm_medis.toLowerCase().includes(q));
  }, [list, searchText]);

  return (
    <div>
      <SubPageHeader title={title} onBack={onBack} />
      <div style={{ padding: '8px 16px 16px' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cari nama / no. RM..."
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 12 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{emptyText}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((p) => {
              const st = queueStatusStyle(p.status);
              return (
                <div key={p.noorder} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.nm_pasien}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.no_rkm_medis}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>{p.nm_dokter}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Diminta {p.jam_permintaan}{p.diagnosa_klinis && p.diagnosa_klinis !== '-' ? ` · ${p.diagnosa_klinis}` : ''}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const LabMobileView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PermintaanQueueMobileView title="Permintaan Lab" endpoint="/api/lab/list" emptyText="Belum ada permintaan lab hari ini" onBack={onBack} />
);

const RadiologiMobileView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PermintaanQueueMobileView title="Permintaan Radiologi" endpoint="/api/radiologi/list" emptyText="Belum ada permintaan radiologi hari ini" onBack={onBack} />
);

// ---------------------------------------------------------------------
// Tab: Atur Jadwal — padanan AturJadwalView.dart (Flutter). Pilih
// departemen, centang pegawai, pilih shift. Shift "Reguler" pakai hari
// berulang tiap minggu (pegawai_jadwal_tetap); shift lain (rotasi/
// malam/dll) pakai tanggal kalender spesifik (grid jadwal_pegawai,
// kolom h1..h31) krn shift rotasi biasanya beda2 tiap orang tiap
// tanggal, bukan pola mingguan tetap.
// ---------------------------------------------------------------------

type JadwalPegawaiRow = {
  id: number; nik: string; nama: string; departemen: string;
  jadwal_tetap_shift: string; jadwal_tetap_hari: string; h: string[];
};

type JamMasukOpsi = { shift: string; jam_masuk: string; jam_pulang: string };

const HARI_OPSI = [
  { iso: 1, label: 'Sen' }, { iso: 2, label: 'Sel' }, { iso: 3, label: 'Rab' },
  { iso: 4, label: 'Kam' }, { iso: 5, label: 'Jum' }, { iso: 6, label: 'Sab' }, { iso: 7, label: 'Min' },
];

const HARI_MIN_FIRST = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_INDO = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Kolom `bulan` di tabel jadwal_pegawai adalah ENUM string 2-digit
// ('01'..'12', sama spt yg dipakai JadwalPegawai.tsx desktop) — kirim
// "8" tanpa padding bikin MySQL diam2 nyimpen di baris/slot yg salah.
const pad2 = (n: number) => String(n).padStart(2, '0');

// Jendela bulan yg ditampilkan di scroll menerus — 1 bulan ke belakang
// (koreksi tanggal baru lewat) s/d 11 bulan ke depan (setahun
// perencanaan shift ke depan), relatif ke bulan modal dibuka.
const BULAN_SEBELUM = 1;
const BULAN_SESUDAH = 11;

const tglKey = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

// Satu bagian bulan di dalam scroll menerus — header nama bulan + grid
// tanggalnya. Muat tanda merah sendiri (lazy, pas widget ini pertama
// kali dirender), dicache di parent spy scroll bolak-balik gak fetch
// ulang. Padanan _BulanSection di tanggal_picker_modal.dart (Flutter).
const BulanSection: React.FC<{
  tahun: number; bulan: number; pegawaiIds: number[]; departemen: string | null;
  selected: Set<string>; onToggle: (key: string) => void;
  pendingTanggalBulanIni: Set<string>;
  terisiCache: React.MutableRefObject<Map<string, Set<number>>>;
  sectionRef?: (el: HTMLDivElement | null) => void;
}> = ({ tahun, bulan, pegawaiIds, departemen, selected, onToggle, pendingTanggalBulanIni, terisiCache, sectionRef }) => {
  const cacheKey = `${tahun}-${bulan}`;
  const [terisi, setTerisi] = React.useState<Set<number>>(terisiCache.current.get(cacheKey) ?? new Set());
  const [loading, setLoading] = React.useState(!terisiCache.current.has(cacheKey));

  React.useEffect(() => {
    if (terisiCache.current.has(cacheKey)) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ tahun: String(tahun), bulan: pad2(bulan) });
        if (departemen) params.set('departemen', departemen);
        const res = await fetch(`/api/jadwal-pegawai/list?${params.toString()}`);
        const data: JadwalPegawaiRow[] = await res.json();
        const rows = (Array.isArray(data) ? data : []).filter((p) => pegawaiIds.includes(p.id));
        const result = new Set<number>();
        if (rows.length > 0) {
          for (let day = 1; day <= 31; day++) {
            const idx = day - 1;
            const first = rows[0].h[idx] || '';
            if (!first) continue;
            const sama = rows.every((p) => (p.h[idx] || '') === first);
            if (sama) result.add(day);
          }
        }
        if (cancelled) return;
        terisiCache.current.set(cacheKey, result);
        setTerisi(result);
      } catch {
        if (cancelled) return;
        terisiCache.current.set(cacheKey, new Set());
        setTerisi(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const firstWeekday = new Date(tahun, bulan - 1, 1).getDay(); // 0=Min..6=Sab, cocok kolom Min-first
  const now = new Date();
  const isBulanIni = tahun === now.getFullYear() && bulan === now.getMonth() + 1;

  return (
    <div ref={sectionRef} style={{ marginTop: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{BULAN_INDO[bulan]} {tahun}</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`blank-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = tglKey(tahun, bulan, day);
            const active = selected.has(key);
            const isTerisi = !active && (terisi.has(day) || pendingTanggalBulanIni.has(key));
            // Hari ini — merah solid + font putih, spt app Kalender
            // bawaan HP, biar user langsung ngeh tanggal berapa
            // sekarang. Kalah prioritas dari active (biru, lagi
            // dipilih), tapi menang dari terisi (merah tipis).
            const isHariIni = !active && isBulanIni && day === now.getDate();
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggle(key)}
                style={{
                  aspectRatio: '1', margin: 2, borderRadius: '50%', border: isTerisi && !isHariIni ? '1px solid #dc2626' : 'none',
                  background: active ? '#2563eb' : isHariIni ? '#dc2626' : isTerisi ? '#fee2e2' : 'transparent',
                  color: active || isHariIni ? '#fff' : isTerisi ? '#dc2626' : '#111827',
                  fontWeight: active || isTerisi || isHariIni ? 700 : 400, fontSize: 13, cursor: 'pointer',
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Modal kalender scroll-menerus (spt app Kalender bawaan HP — bulan
// berikutnya udah keliatan dikit di bawah pas scroll) — user tap
// tanggal2 spesifik (jadi biru), boleh nyebar di beberapa bulan
// sekaligus, lalu Simpan. Dipakai utk "Atur Tanggal Masuk" pd shift
// selain Reguler. Padanan tanggal_picker_modal.dart (Flutter).
const TanggalPickerModal: React.FC<{
  tahun: number; bulan: number; pegawaiIds: number[]; departemen: string | null;
  pendingTanggal: Set<string>;
  onCancel: () => void; onConfirm: (tanggal: Set<string>) => void;
}> = ({ tahun: tahunAwal, bulan: bulanAwal, pegawaiIds, departemen, pendingTanggal, onCancel, onConfirm }) => {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const terisiCache = React.useRef<Map<string, Set<number>>>(new Map());
  const todayRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const bulanList = React.useMemo(() => {
    const list: { tahun: number; bulan: number }[] = [];
    for (let i = -BULAN_SEBELUM; i <= BULAN_SESUDAH; i++) {
      let m = bulanAwal + i;
      let y = tahunAwal;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      list.push({ tahun: y, bulan: m });
    }
    return list;
  }, [tahunAwal, bulanAwal]);

  const scrollKeBulanAwal = (smooth: boolean) => {
    todayRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  React.useEffect(() => { scrollKeBulanAwal(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel} />
      <div style={{ position: 'relative', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selected.size === 0 ? '#9ca3af' : '#2563eb' }}>
            {selected.size === 0 ? 'Ketuk tanggal untuk memilih' : `${selected.size} tanggal dipilih`}
          </span>
          <button type="button" onClick={() => scrollKeBulanAwal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 12, fontWeight: 600, padding: '4px 10px' }}>
            Hari ini
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginTop: 4 }}>
          {HARI_MIN_FIRST.map((h) => (
            <div key={h} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{h}</div>
          ))}
        </div>
        <div style={{ borderBottom: '1px solid #e5e7eb', margin: '8px 0' }} />
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          {bulanList.map(({ tahun, bulan }) => {
            const isBulanAwal = tahun === tahunAwal && bulan === bulanAwal;
            const pendingBulanIni = new Set([...pendingTanggal].filter((k) => k.startsWith(`${tahun}-${pad2(bulan)}-`)));
            return (
              <BulanSection
                key={`${tahun}-${bulan}`}
                tahun={tahun}
                bulan={bulan}
                pegawaiIds={pegawaiIds}
                departemen={departemen}
                selected={selected}
                onToggle={toggle}
                pendingTanggalBulanIni={pendingBulanIni}
                terisiCache={terisiCache}
                sectionRef={isBulanAwal ? (el) => { todayRef.current = el; } : undefined}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Batal
          </button>
          <button type="button" onClick={() => onConfirm(selected)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

const AturJadwalMobileView: React.FC<{ user: AppUserLite; onBack: () => void }> = ({ user, onBack }) => {
  const isAdmin = user.role === 'admin';
  const nik = resolveNik(user);
  const now = new Date();

  // tahun/bulan = bulan "acuan" (bulan berjalan) — dipakai buat muat
  // daftar pegawai (subtitle "Saat ini: X" & tanda merah Riwayat
  // Tanggal), sekaligus titik awal scroll pas modal kalender dibuka.
  // TIDAK berubah walau user pilih tanggal di bulan lain di dalam
  // modal (itu udah aman krn modal sendiri yg validasi tanda merah
  // per-bulan saat milih — lihat TanggalPickerModal).
  const tahun = now.getFullYear();
  const bulan = now.getMonth() + 1;

  const [departemenList, setDepartemenList] = React.useState<{ kode: string; nama: string }[]>([]);
  const [departemen, setDepartemen] = React.useState<string | null>(null);
  const [shiftList, setShiftList] = React.useState<JamMasukOpsi[]>([]);
  const [shift, setShift] = React.useState<string>('');
  const [pegawaiList, setPegawaiList] = React.useState<JadwalPegawaiRow[]>([]);
  const [loadingPegawai, setLoadingPegawai] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [hariAktif, setHariAktif] = React.useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  // Kunci "YYYY-MM-DD" — bisa nyebar di beberapa bulan sekaligus, krn
  // modal kalendernya scroll menerus (spt app Kalender bawaan HP).
  const [selectedTanggal, setSelectedTanggal] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [showTanggalModal, setShowTanggalModal] = React.useState(false);

  const isReguler = shift.trim().toLowerCase() === 'reguler';

  const loadPegawai = React.useCallback(async (dept: string | null) => {
    setLoadingPegawai(true);
    try {
      const params = new URLSearchParams({ tahun: String(tahun), bulan: pad2(bulan) });
      if (dept) params.set('departemen', dept);
      const res = await fetch(`/api/jadwal-pegawai/list?${params.toString()}`);
      const data = await res.json();
      const list: JadwalPegawaiRow[] = Array.isArray(data) ? data : [];
      setPegawaiList(list);
      setSelectedIds((prev) => new Set([...prev].filter((id) => list.some((p) => p.id === id))));
    } catch {
      setPegawaiList([]);
    } finally {
      setLoadingPegawai(false);
    }
  }, [tahun, bulan]);

  // Init: muat opsi departemen/shift + pegawai (tanpa filter) sekaligus,
  // lalu utk non-admin cari departemen pegawai yg login dari hasilnya &
  // auto-isi dropdown Departemen (TETAP bisa diganti, gak dikunci).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [depRes, shiftRes] = await Promise.all([
        fetch('/api/pegawai/departemen').then((r) => r.json()).catch(() => []),
        fetch('/api/jam-masuk/opsi').then((r) => r.json()).catch(() => []),
      ]);
      if (cancelled) return;
      setDepartemenList(Array.isArray(depRes) ? depRes : []);
      setShiftList(Array.isArray(shiftRes) ? shiftRes : []);

      setLoadingPegawai(true);
      const params = new URLSearchParams({ tahun: String(tahun), bulan: pad2(bulan) });
      const res = await fetch(`/api/jadwal-pegawai/list?${params.toString()}`);
      const data = await res.json();
      const list: JadwalPegawaiRow[] = Array.isArray(data) ? data : [];
      if (cancelled) return;
      setPegawaiList(list);
      setLoadingPegawai(false);

      if (!isAdmin) {
        const diriSendiri = list.find((p) => p.nik === nik);
        if (diriSendiri && diriSendiri.departemen && diriSendiri.departemen !== '-') {
          setDepartemen(diriSendiri.departemen);
          loadPegawai(diriSendiri.departemen);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRows = React.useMemo(() => pegawaiList.filter((p) => selectedIds.has(p.id)), [pegawaiList, selectedIds]);

  // Tanggal (di bulan acuan tahun/bulan) yg ditandai merah — cuma kalau
  // jadwal SEBELUMNYA sama persis di semua pegawai yg dicentang & tidak
  // kosong.
  const tanggalTerisiSama = React.useMemo(() => {
    const result = new Set<string>();
    if (selectedRows.length === 0) return result;
    for (let day = 1; day <= 31; day++) {
      const idx = day - 1;
      const first = selectedRows[0].h[idx] || '';
      if (!first) continue;
      const sama = selectedRows.every((p) => (p.h[idx] || '') === first);
      if (sama) result.add(tglKey(tahun, bulan, day));
    }
    return result;
  }, [selectedRows, tahun, bulan]);

  // Nama shift yg sudah terisi (dipakai riwayat) — null kalau key
  // bukan bagian dari tanggalTerisiSama (di luar bulan acuan).
  const shiftUntukTanggal = (key: string): string | null => {
    if (selectedRows.length === 0 || !key.startsWith(`${tahun}-${pad2(bulan)}-`)) return null;
    const day = Number(key.slice(-2));
    const value = selectedRows[0].h[day - 1] || '';
    return value || null;
  };

  // Label ringkas tanggal di chip Riwayat — polos "5" kalau di bulan
  // acuan (kasus umum), "5/9" kalau di bulan lain (user sempat scroll
  // ke bulan lain di modal) spy gak ambigu.
  const labelTanggal = (key: string): string => {
    const [y, m, d] = key.split('-').map(Number);
    if (y === tahun && m === bulan) return String(d);
    return `${d}/${m}`;
  };

  const canSave = selectedIds.size > 0 && shift !== '' && !saving && (isReguler ? hariAktif.size > 0 : selectedTanggal.size > 0);

  const toggleSelectAll = () => {
    if (selectedIds.size === pegawaiList.length && pegawaiList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pegawaiList.map((p) => p.id)));
    }
    setSelectedTanggal(new Set());
  };

  const toggleHari = (iso: number) => {
    setHariAktif((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };

  const handleSimpan = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let message: string;
      if (isReguler) {
        const res = await fetch('/api/pegawai-jadwal-tetap', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [...selectedIds], shift, hari_aktif: [...hariAktif].sort((a, b) => a - b) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal');
        message = data.message || 'Jadwal tetap berhasil diterapkan';
      } else {
        // Tanggal terpilih bisa nyebar di beberapa bulan (modal
        // kalendernya scroll menerus) — kelompokkan per (tahun, bulan)
        // dulu, krn API-nya nerima satu bulan per panggilan.
        const byBulan = new Map<string, number[]>();
        for (const key of selectedTanggal) {
          const [y, m, d] = key.split('-');
          const groupKey = `${y}-${m}`;
          const arr = byBulan.get(groupKey) || [];
          arr.push(Number(d));
          byBulan.set(groupKey, arr);
        }
        for (const [groupKey, hariList] of byBulan) {
          const [y, m] = groupKey.split('-');
          const res = await fetch('/api/pegawai-jadwal-tanggal', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: [...selectedIds], tahun: y, bulan: m,
              tanggal: hariList.sort((a, b) => a - b), shift,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal');
        }
        message = `Jadwal tanggal berhasil diterapkan ke ${selectedIds.size} pegawai`;
      }
      await Swal.fire({ icon: 'success', title: message, confirmButtonColor: '#059669', timer: 2000, showConfirmButton: false });
      // Pegawai TETAP dicentang (bukan direset) — begitu loadPegawai
      // selesai refresh data h dari server, tanggal yg baru disimpan
      // langsung kebaca tanggalTerisiSama & tampil merah kalau modal
      // dibuka lagi, dan user bisa langsung lanjut atur shift
      // berikutnya utk pegawai yg sama tanpa centang ulang.
      setSelectedTanggal(new Set());
      await loadPegawai(departemen);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  const allSelected = pegawaiList.length > 0 && selectedIds.size === pegawaiList.length;
  // Kunci "YYYY-MM-DD" — sort string biasa udah otomatis urut
  // kronologis.
  const biru = [...selectedTanggal].sort();
  const merah = [...tanggalTerisiSama].filter((d) => !selectedTanggal.has(d)).sort();
  const riwayatKosong = biru.length === 0 && merah.length === 0;

  return (
    <div style={{ paddingBottom: 100 }}>
      <SubPageHeader title="Atur Jadwal Tetap" onBack={onBack} />
      <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Departemen</div>
            <select
              value={departemen || ''}
              onChange={(e) => { const v = e.target.value || null; setDepartemen(v); loadPegawai(v); }}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, boxSizing: 'border-box' }}
            >
              <option value="">Semua Departemen</option>
              {departemenList.map((d) => <option key={d.kode} value={d.kode}>{d.nama}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shift</div>
            <select
              value={shift}
              onChange={(e) => { setShift(e.target.value); setSelectedTanggal(new Set()); }}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, boxSizing: 'border-box' }}
            >
              <option value="">Pilih Shift</option>
              {shiftList.map((s) => (
                <option key={s.shift} value={s.shift}>
                  {s.shift} ({(s.jam_masuk || '').slice(0, 5)}–{(s.jam_pulang || '').slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: pegawaiList.length ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={allSelected} disabled={!pegawaiList.length} onChange={toggleSelectAll} style={{ width: 18, height: 18, accentColor: '#059669' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: selectedIds.size ? '#059669' : '#6b7280' }}>
              {selectedIds.size === 0 ? 'Centang pegawai untuk atur jadwal' : `${selectedIds.size} pegawai dipilih`}
            </span>
          </label>
          <div style={{ borderTop: '1px solid #e5e7eb' }} />
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loadingPegawai ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
            ) : pegawaiList.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada pegawai</div>
            ) : (
              pegawaiList.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox" checked={checked} style={{ width: 18, height: 18, accentColor: '#059669', flexShrink: 0 }}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(p.id); else next.delete(p.id);
                          return next;
                        });
                        setSelectedTanggal(new Set());
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#111827' }}>{p.nama}</div>
                      {p.jadwal_tetap_shift && <div style={{ fontSize: 11, color: '#9ca3af' }}>Saat ini: {p.jadwal_tetap_shift}</div>}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {shift !== '' && (isReguler ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Hari Berlaku</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Shift ini berulang tiap minggu pada hari yg dipilih.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {HARI_OPSI.map((h) => {
                const active = hariAktif.has(h.iso);
                return (
                  <button
                    key={h.iso} type="button" onClick={() => toggleHari(h.iso)}
                    style={{
                      width: 44, height: 36, borderRadius: 8, cursor: 'pointer',
                      background: active ? '#059669' : '#fff', border: `1px solid ${active ? '#059669' : '#e5e7eb'}`,
                      color: active ? '#fff' : '#9ca3af', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              <button type="button" onClick={() => setHariAktif(new Set([1, 2, 3, 4, 5]))} style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 8px' }}>Sen–Jum</button>
              <button type="button" onClick={() => setHariAktif(new Set([1, 2, 3, 4, 5, 6, 7]))} style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 8px' }}>7 Hari</button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
            <button
              type="button" onClick={() => setShowTanggalModal(true)}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <IconCalendar size={18} color="#2563eb" />
              Atur Tanggal Masuk
            </button>
          </div>
        ))}

        {shift !== '' && !isReguler && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Riwayat Tanggal</div>
            {selectedRows.length === 0 && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Centang pegawai dulu utk lihat jadwal yg sudah ada.</div>
            )}
            <div style={{ marginTop: 10 }}>
              {riwayatKosong ? (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Belum ada jadwal.</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {merah.map((d) => (
                    <span key={`m-${d}`} style={{ padding: '6px 10px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600 }}>
                      {labelTanggal(d)} — {shiftUntukTanggal(d) || '-'}
                    </span>
                  ))}
                  {biru.map((d) => (
                    <span key={`b-${d}`} style={{ padding: '6px 10px', borderRadius: 10, background: '#dbeafe', color: '#2563eb', fontSize: 11, fontWeight: 600 }}>
                      {labelTanggal(d)} — {shift || '-'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 16, background: '#fff', borderTop: '1px solid #e5e7eb', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button
          type="button" onClick={handleSimpan} disabled={!canSave}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: canSave ? '#059669' : '#d1d5db', color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: canSave ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

      {showTanggalModal && (
        <TanggalPickerModal
          tahun={tahun} bulan={bulan}
          pegawaiIds={[...selectedIds]}
          departemen={departemen}
          pendingTanggal={selectedTanggal}
          onCancel={() => setShowTanggalModal(false)}
          onConfirm={(tanggal) => {
            setShowTanggalModal(false);
            setSelectedTanggal((prev) => new Set([...prev, ...tanggal]));
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------

type TabKey = 'home' | 'absen' | 'kehadiran' | 'jadwal' | 'saya' | 'lembur' | 'cuti' | 'izin' | 'lapor-it' | 'poli' | 'igd' | 'ranap' | 'farmasi' | 'lab' | 'radiologi' | 'atur-jadwal' | 'semua-menu';

export const PresensiMobileView: React.FC<{ user: AppUserLite; onLogout: () => void }> = ({ user, onLogout }) => {
  const nik = resolveNik(user);
  const [tab, setTab] = React.useState<TabKey>('home');
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);

  const fetchMe = React.useCallback(async () => {
    if (!nik) { setNotFound(true); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/presensi/me?nik=${encodeURIComponent(nik)}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setMe(data);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [nik]);

  React.useEffect(() => { fetchMe(); }, [fetchMe]);

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: <IconHome size={18} /> },
    { key: 'jadwal', label: 'Jadwal', icon: <IconClipboard size={18} /> },
    { key: 'kehadiran', label: 'Kehadiran', icon: <IconCalendar size={18} /> },
    { key: 'saya', label: 'Saya', icon: <IconUser size={18} /> },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f3f4f6', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: (tab === 'absen' || tab === 'atur-jadwal' || tab === 'semua-menu') ? 0 : 88 }}>
        {notFound ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconAlertTriangle size={36} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Akun belum terhubung ke data Pegawai</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Hubungi admin untuk menautkan akun ini ke NIP/data pegawai.</div>
            <button type="button" onClick={onLogout} style={{ marginTop: 20, padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Keluar
            </button>
          </div>
        ) : tab === 'home' ? (
          <HomeTab
            user={user} me={me} loading={loading} onOpenLembur={() => setTab('lembur')}
            onOpenCutiIzin={(mode) => setTab(mode)} onOpenLaporIt={() => setTab('lapor-it')}
            onOpenPoli={() => setTab('poli')} onOpenIgd={() => setTab('igd')} onOpenRanap={() => setTab('ranap')}
            onOpenFarmasi={() => setTab('farmasi')} onOpenLab={() => setTab('lab')} onOpenRadiologi={() => setTab('radiologi')}
            onOpenAturJadwal={() => setTab('atur-jadwal')} onOpenSemuaMenu={() => setTab('semua-menu')}
          />
        ) : tab === 'absen' ? (
          <AbsenTab nik={nik} hariIni={me?.hari_ini || null} onSelesai={() => { fetchMe(); setTab('home'); }} onBack={() => setTab('home')} />
        ) : tab === 'jadwal' ? (
          <JadwalTab nik={nik} />
        ) : tab === 'saya' ? (
          <SayaTab user={user} nik={nik} me={me} onLogout={onLogout} onProfilUpdated={fetchMe} />
        ) : tab === 'lembur' ? (
          <LemburView nik={nik} onBack={() => setTab('home')} />
        ) : tab === 'cuti' ? (
          <CutiIzinView nik={nik} mode="cuti" onBack={() => setTab('home')} />
        ) : tab === 'izin' ? (
          <CutiIzinView nik={nik} mode="izin" onBack={() => setTab('home')} />
        ) : tab === 'lapor-it' ? (
          <LaporItView nik={nik} onBack={() => setTab('home')} />
        ) : tab === 'poli' ? (
          <PoliMobileView user={user} onBack={() => setTab('home')} />
        ) : tab === 'igd' ? (
          <IgdMobileView onBack={() => setTab('home')} />
        ) : tab === 'ranap' ? (
          <RanapMobileView user={user} onBack={() => setTab('home')} />
        ) : tab === 'farmasi' ? (
          <FarmasiMobileView onBack={() => setTab('home')} />
        ) : tab === 'lab' ? (
          <LabMobileView onBack={() => setTab('home')} />
        ) : tab === 'radiologi' ? (
          <RadiologiMobileView onBack={() => setTab('home')} />
        ) : tab === 'atur-jadwal' ? (
          <AturJadwalMobileView user={user} onBack={() => setTab('home')} />
        ) : tab === 'semua-menu' ? (
          <SemuaMenuMobileView
            user={user} onBack={() => setTab('home')} onOpenLembur={() => setTab('lembur')}
            onOpenCutiIzin={(mode) => setTab(mode)} onOpenLaporIt={() => setTab('lapor-it')}
            onOpenPoli={() => setTab('poli')} onOpenIgd={() => setTab('igd')} onOpenRanap={() => setTab('ranap')}
            onOpenFarmasi={() => setTab('farmasi')} onOpenLab={() => setTab('lab')} onOpenRadiologi={() => setTab('radiologi')}
            onOpenAturJadwal={() => setTab('atur-jadwal')}
          />
        ) : (
          <KehadiranTab nik={nik} />
        )}
      </div>

      {/* Footer disembunyikan di tab Absen (fokus ke tombol Absen Masuk/
          Keluar, tanpa distraksi nav bar) dan di Atur Jadwal/Semua Menu
          (padanan Flutter: keduanya route terpisah yg di-push di atas
          MainShell, jadi bottom nav utama otomatis ketutup — di web yg
          strukturnya flat lewat satu shell, disembunyikan manual). */}
      {!notFound && tab !== 'absen' && tab !== 'atur-jadwal' && tab !== 'semua-menu' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', padding: '18px 0 max(8px, env(safe-area-inset-bottom))' }}>
            {navItems.slice(0, 2).map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  style={{
                    flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    color: active ? '#059669' : '#9ca3af', fontSize: 10, fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
            {/* Ruang kosong di tengah utk tombol Absen melayang di bawah */}
            <div style={{ flex: 1 }} />
            {navItems.slice(2).map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  style={{
                    flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    color: active ? '#059669' : '#9ca3af', fontSize: 10, fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Tombol Absen — melayang di tengah, lebih besar & terangkat
              dari bar (pola "raised FAB" bottom nav), pakai ikon scan
              wajah sesuai alur AbsenTab (kamera depan + GPS). FAB + label
              digabung jadi satu kolom flex dgn padding-bottom yang SAMA
              persis dengan baris nav lain, supaya label "Absen" sejajar
              dengan label Home/Jadwal/dst apa pun nilai safe-area-inset
              perangkatnya (bukan dihitung manual pakai `bottom` terpisah). */}
          <div style={{
            position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}>
            <button
              type="button"
              onClick={() => setTab('absen')}
              style={{
                width: 76, height: 76, marginTop: -52, borderRadius: '50%', border: '4px solid #f3f4f6',
                background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <IconFaceScan size={34} color="#fff" />
            </button>
            {/* Label ini selalu tampil inactive — footer (termasuk label
                ini) disembunyikan total begitu tab='absen' aktif, jadi
                state "active"-nya tidak akan pernah kelihatan. */}
            <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca3af' }}>
              Absen
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
