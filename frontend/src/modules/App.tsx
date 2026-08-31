import React from 'react';
import Swal from 'sweetalert2';
import { MenuUtamaView } from './MenuUtama';
import { RawatJalanView } from './RawatJalan';
import { PemeriksaanView } from './Pemeriksaan';
import { RawatInapView } from './RawatInap';
import { CasemixView } from './Casemix';
import { BridgingView } from './Bridging';
import { ApotekView } from './Apotek';
import { JadwalOperasiView } from './JadwalOperasi';
import { RadiologiView } from './Radiologi';
import { LaboratoriumPKView } from './LaboratoriumPK';
import { RegistrasiView } from './Registrasi';
import { IGDKView } from './IGDK';
import { DisplayAntrianView } from './DisplayAntrian';
import { DisplayAntrianPoliView } from './DisplayAntrianPoli';
import { DisplayAntrianApotekView } from './DisplayAntrianApotek';
import { AntrianDashboardView } from './AntrianDashboard';
import { DisplaySettingsView } from './DisplaySettings';
import { AddUserModal } from '../components/AddUserModal';
import { ModalGantiPassword } from '../components/ModalGantiPassword';
import { SatuSehatView } from './SatuSehat';
import { MappingSatuSehatView } from './MappingSatuSehat';
import { KepegawaianView } from './Kepegawaian';
import { ItSupportView } from './ItSupport';
import { AdminView } from './Admin';
import { PresensiMobileView } from './PresensiMobile';
import { useBreakpoint, useMediaQuery } from '../hooks/useBreakpoint';
import { AppUser, LoginView, RegisterView, BATAS_TIDAK_AKTIF_MS, catatAktivitas } from './Auth';
import { safeStorage } from '../utils/safeStorage';

type MenuKey =
  | 'menu-utama'
  | 'pendaftaran'
  | 'igd'
  | 'rawat-jalan'
  | 'rawat-inap'
  | 'radiologi'
  | 'laboratorium-pk'
  | 'laboratorium-pa'
  | 'farmasi'
  | 'kasir'
  | 'casemix'
  | 'bridging'
  | 'kepegawaian'
  | 'it-support'
  | 'anjungan-antrian'
  | 'rekam-medis'
  | 'berkas-digital'
  | 'jadwal-operasi'
  | 'laporan'
  | 'admin'
  | 'satu-sehat'
  | 'mapping-satu-sehat';

export const App: React.FC = () => {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');
  const [activeMenu, setActiveMenu] = React.useState<MenuKey>('menu-utama');
  // Accordion "Laboratorium" di sidebar — satu tombol induk yg expand jadi
  // 2 anak (Laboratorium PK/PA), sama pola dgn "Daftar Resep Dokter" >
  // Rawat Jalan/Rawat Inap di sidebar Apotek. Toggle manual lewat klik
  // induk, TAPI juga otomatis kebuka kalau activeMenu lagi ada di salah
  // satu anaknya (mis. reload halaman / navigasi langsung).
  const [labMenuOpen, setLabMenuOpen] = React.useState(false);
  const [health, setHealth] = React.useState<string>('Belum cek');
  const [loadingHealth, setLoadingHealth] = React.useState<boolean>(false);
  const [selectedPatientForExam, setSelectedPatientForExam] = React.useState<any | null>(null);
  const { isCompact } = useBreakpoint();
  // Login dari HP (lebar layar <=640px, breakpoint khusus phone — beda
  // dari isCompact/900px yang dipakai buat tablet) -> tampilkan aplikasi
  // Presensi Mandiri mobile penuh layar, bukan shell SIMRS desktop.
  const isMobileLogin = useMediaQuery(640);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  // Collapse sidebar sticky di layar desktop (bukan drawer overlay compact
  // di atas — itu dikontrol sidebarOpen). Toggle-nya lewat tombol hamburger
  // di topbar (menggantikan kolom "Cari menu" yang sebelumnya tidak
  // berfungsi apa-apa).
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = React.useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = React.useState<boolean>(false);
  const [showGantiPassword, setShowGantiPassword] = React.useState<boolean>(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const [displayType, setDisplayType] = React.useState<string | null>(null);
  const [instansi, setInstansi] = React.useState<{ nama_instansi: string; logo_url: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setInstansi(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Check if this is a display window (opened from dashboard)
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#display-')) {
      const type = hash.replace('#display-', '');
      setDisplayType(type);
    }
  }, []);

  // Berubah setiap kali sidebar "Casemix" diklik, dipakai sebagai key agar
  // CasemixView remount dan reset kembali ke grid sub-menu-nya.
  const [casemixResetKey, setCasemixResetKey] = React.useState(0);
  // Sama seperti casemixResetKey, untuk sub-menu grid Bridging.
  const [bridgingResetKey, setBridgingResetKey] = React.useState(0);

  // Sidebar menu keys (modul yang ditampilkan di sidebar)
  const sidebarMenuKeys: MenuKey[] = [
    'menu-utama',
    'igd',
    'rawat-jalan',
    'rawat-inap',
    'farmasi',
    'radiologi',
    'laboratorium-pk',
    'laboratorium-pa',
    'jadwal-operasi',
    'casemix',
    'bridging',
    'it-support'
  ];

  const menuItems: { key: MenuKey; label: string; icon: string | React.ReactNode }[] = [
    {
      key: 'menu-utama',
      label: 'Menu Utama',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 96 96">
          <rect width="32" height="32" x="10" y="54" stroke="currentColor" strokeWidth="5" rx="9"/>
          <rect width="32" height="32" x="10" y="10" stroke="currentColor" strokeWidth="5" rx="9"/>
          <rect width="32" height="32" x="54" y="54" stroke="currentColor" strokeWidth="5" rx="9"/>
          <rect width="32" height="32" x="54" y="10" stroke="currentColor" strokeWidth="5" rx="9"/>
        </svg>
      )
    },
    { key: 'pendaftaran', label: 'Pendaftaran', icon: '📋' },
    {
      key: 'igd',
      label: 'IGD',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
          <path d="M19 18H5a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2z" />
          <path d="M12 2v3" /><path d="M4.5 7 6 8.3" /><path d="M19.5 7 18 8.3" />
        </svg>
      )
    },
    {
      key: 'rawat-jalan',
      label: 'Poliklinik',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      key: 'rawat-inap',
      label: 'Rawat Inap',
      icon: (
        <svg width="18" height="18" viewBox="0 0 910 910" fill="currentColor">
          <path d="M789.1,449.9H879V369c0-16.8-13.7-30.5-30.5-30.5H342.1c1.601,3.3,3.101,6.6,4.601,10c10.2,24.2,15.399,49.9,15.399,76.4    c0,8.399-0.5,16.8-1.6,25H789.1z"/>
          <path d="M165.9,263.7c-3.4,0-6.7,0.1-10,0.3v185.8H267h58.1c1.301-8.2,1.9-16.5,1.9-25c0-31.8-9.2-61.399-25.1-86.3    C273.4,293.5,223.1,263.7,165.9,263.7z"/>
          <path d="M30,731.5h60.9c16.6,0,30-13.4,30-30v-95.7h668.2v95.7c0,16.6,13.4,30,30,30H880c16.6,0,30-13.4,30-30V514.9    c0-16.601-13.4-30-30-30h-90.9H120.9V270.1v-61.6c0-16.6-13.4-30-30-30H30c-16.6,0-30,13.4-30,30v111.7v38.5V491v38.5v172    C0,718,13.4,731.5,30,731.5z"/>
        </svg>
      )
    },
    {
      key: 'radiologi',
      label: 'Radiologi',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <circle cx="12" cy="8" r="2"></circle>
          <path d="M12 10v4"></path>
          <path d="M10 14h4"></path>
          <path d="M9 18l3-2 3 2"></path>
        </svg>
      )
    },
    {
      key: 'laboratorium-pk',
      label: 'Laboratorium PK',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v10.5L5.5 19c-.5.9-.5 2 .5 2.5h12c1 -.5 1-1.6.5-2.5L15 13.5V3"></path>
          <path d="M6.5 16h11"></path>
          <path d="M9 3h6"></path>
        </svg>
      )
    },
    {
      key: 'laboratorium-pa',
      label: 'Laboratorium PA',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3"></circle>
          <path d="M8.12 8.12 12 12"></path>
          <path d="M20 4 8.12 15.88"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <path d="M14.8 14.8 20 20"></path>
        </svg>
      )
    },
    {
      key: 'farmasi',
      label: 'Farmasi',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10,12V8m2,2H8m8.73,2.73a2.52,2.52,0,0,1,3.54,0h0a2.52,2.52,0,0,1,0,3.54l-4,4a2.52,2.52,0,0,1-3.54,0h0a2.52,2.52,0,0,1,0-3.54Zm1.39,5.39-3.24-3.24"/>
          <path d="M8,21H4a1,1,0,0,1-1-1V4A1,1,0,0,1,4,3H16a1,1,0,0,1,1,1V8"/>
        </svg>
      )
    },
    { key: 'kasir', label: 'Kasir', icon: '💳' },
    { key: 'kepegawaian', label: 'Kepegawaian', icon: '👥' },
    {
      key: 'it-support',
      label: 'IT Support',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      )
    },
    { key: 'anjungan-antrian', label: 'Anjungan & Antrian', icon: '🎫' },
    { key: 'rekam-medis', label: 'Rekam Medis', icon: '📁' },
    { key: 'berkas-digital', label: 'Berkas Digital', icon: '📄' },
    {
      key: 'jadwal-operasi',
      label: 'Jadwal Operasi',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    },
    {
      key: 'casemix',
      label: 'Casemix',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      )
    },
    {
      key: 'bridging',
      label: 'Bridging',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      )
    },
    { key: 'laporan', label: 'Laporan', icon: '📈' },
    { key: 'admin', label: 'Pengaturan', icon: '⚙️' },
    {
      key: 'satu-sehat',
      label: 'Satu Sehat',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      )
    },
    {
      key: 'mapping-satu-sehat',
      label: 'Mapping Satu Sehat',
      icon: '🗺️'
    }
  ];

  const checkBackend = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(`Status: ${data.status}, DB: ${data.db}`);
    } catch (e) {
      setHealth('Gagal konek ke backend');
    } finally {
      setLoadingHealth(false);
    }
  };

  React.useEffect(() => {
    void checkBackend();
  }, []);

  React.useEffect(() => {
    // Sesi lama dari sebelum perubahan ini mungkin masih ada di
    // localStorage — sengaja TIDAK dipakai lagi (localStorage bertahan
    // lintas restart komputer, yang justru mau dihindari), langsung
    // dibuang. Sesi yang valid sekarang cuma dari sessionStorage.
    safeStorage.remove('local', 'ermapp_user');
    const stored = safeStorage.get('session', 'ermapp_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        // Cek 12 jam tanpa aktivitas dulu sebelum melanjutkan sesi —
        // tab yang dibiarkan terbuka lama tanpa disentuh tetap harus
        // login ulang, bukan cuma dipertahankan krn browsernya belum
        // ditutup.
        const lastActivity = Number(safeStorage.get('session', 'ermapp_last_activity') || '0');
        if (lastActivity && Date.now() - lastActivity > BATAS_TIDAK_AKTIF_MS) {
          safeStorage.remove('session', 'ermapp_user');
          safeStorage.remove('session', 'ermapp_last_activity');
        } else {
          setUser(parsed);
          catatAktivitas();
        }
      } catch {
        safeStorage.remove('session', 'ermapp_user');
      }
    }
  }, []);

  // Auto-logout setelah 12 jam tanpa aktivitas (mouse/keyboard/tap/scroll).
  // Waktu aktivitas terakhir disimpan di sessionStorage (bukan state React)
  // supaya tidak trigger re-render tiap gerakan mouse — throttle 30 detik
  // saat menulis, tapi pengecekan timeout jalan tiap menit lewat interval.
  React.useEffect(() => {
    if (!user) return;

    let lastWrite = 0;
    const catat = () => {
      const now = Date.now();
      if (now - lastWrite < 30_000) return;
      lastWrite = now;
      catatAktivitas();
    };
    catat();

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, catat, { passive: true }));

    const cekTimeout = () => {
      const lastActivity = Number(safeStorage.get('session', 'ermapp_last_activity') || '0');
      if (lastActivity && Date.now() - lastActivity > BATAS_TIDAK_AKTIF_MS) {
        handleLogout();
        Swal.fire({ icon: 'info', title: 'Sesi Berakhir', text: 'Anda otomatis keluar karena 12 jam tidak ada aktivitas.', confirmButtonColor: '#2563eb' });
      }
    };
    const interval = window.setInterval(cekTimeout, 60_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, catat));
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle click outside user menu
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Sesi login SELALU di sessionStorage (bukan localStorage) — supaya
  // otomatis hilang begitu browser/komputer ditutup (satu komputer bisa
  // dipakai gantian oleh beberapa dokter). "Ingat saya" cuma memengaruhi
  // ermapp_remembered_username (auto-isi username di form login), TIDAK
  // lagi bikin sesi login bertahan lintas restart.
  const handleLogin = (u: AppUser, _remember: boolean) => {
    setUser(u);
    safeStorage.set('session', 'ermapp_user', JSON.stringify(u));
    safeStorage.remove('local', 'ermapp_user');
    catatAktivitas();
  };

  const handleLogout = () => {
    setUser(null);
    safeStorage.remove('local', 'ermapp_user');
    safeStorage.remove('session', 'ermapp_user');
    safeStorage.remove('session', 'ermapp_last_activity');
  };

  const canAccessMenu = (menu: MenuKey, role: AppUser['role']) => {
    // Use allowed_modules from database if available
    if (user && user.allowed_modules) {
      const allowedModules = user.allowed_modules.split(',').filter(Boolean);
      return allowedModules.includes(menu);
    }

    // Fallback to role-based access (for backward compatibility)
    switch (role) {
      case 'pendaftaran':
        return menu === 'menu-utama' || menu === 'pendaftaran';
      case 'dokter':
        return menu === 'menu-utama' || menu === 'rawat-jalan' || menu === 'rawat-inap' || menu === 'laporan';
      case 'farmasi':
        return menu === 'menu-utama' || menu === 'farmasi' || menu === 'laporan';
      case 'kasir':
        return menu === 'menu-utama' || menu === 'kasir' || menu === 'casemix' || menu === 'laporan';
      case 'admin':
      default:
        return true;
    }
  };

  // If this is a display window, render the appropriate display component (no login required)
  if (displayType) {
    // Render specific display component based on type
    if (displayType === 'poli') {
      return <DisplayAntrianPoliView />;
    }
    if (displayType === 'apotek') {
      return <DisplayAntrianApotekView />;
    }
    // For other display types, use generic DisplayAntrianView for now
    return <DisplayAntrianView type={displayType} />;
  }

  if (!user) {
    return authView === 'register' ? (
      <RegisterView onBackToLogin={() => setAuthView('login')} />
    ) : (
      <LoginView onLogin={handleLogin} onShowRegister={() => setAuthView('register')} />
    );
  }

  // Akun mandiri (hasil "Daftar", lihat RegisterView di atas) SELALU
  // dipaksa ke PresensiMobileView, walau login dari desktop —
  // PresensiMobileView sudah membatasi Menu Utama-nya ke Lembur/Cuti/Izin/
  // Tugas/Lapor IT saja (lihat LayananCard). Kalau cuma mengandalkan
  // isMobileLogin, akun ini bisa lolos lewat browser desktop lebar dan
  // mendarat di KepegawaianView (panel HR admin penuh, tanpa filter),
  // membocorkan akses yang seharusnya baru dibuka admin.
  // PENTING: dicek lewat `user.akun_mandiri`, BUKAN `user.role === 'pegawai'`
  // — sejak role akun mandiri diturunkan otomatis dari departemen (bisa
  // 'dokter'/'farmasi'/'radiologi'/dst, lihat auth_register_handler.go),
  // role sendiri sudah tidak cukup jadi penanda "ini akun mandiri".
  if (isMobileLogin || user.akun_mandiri) {
    return <PresensiMobileView user={user} onLogout={handleLogout} />;
  }

  // Jika ada pasien yang dipilih untuk pemeriksaan, tampilkan fullscreen tanpa sidebar/header
  if (selectedPatientForExam) {
    return (
      <PemeriksaanView
        patient={selectedPatientForExam}
        onBack={() => setSelectedPatientForExam(null)}
      />
    );
  }

  const visibleMenuItems = menuItems.filter(
    (m) => sidebarMenuKeys.includes(m.key) && canAccessMenu(m.key, user.role)
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'menu-utama':
        return <MenuUtamaView user={user} setActiveMenu={setActiveMenu} canAccessMenu={canAccessMenu} />;
      case 'pendaftaran':
        return <RegistrasiView />;
      case 'igd':
        return <IGDKView user={user} />;
      case 'rawat-jalan':
        return <RawatJalanView onSelectPatient={setSelectedPatientForExam} user={user} />;
      case 'rawat-inap':
        return <RawatInapView user={user} />;
      case 'farmasi':
        // Layout sendiri (sidebar + full layar), lepas dari shell aplikasi
        // sepenuhnya — persis pola BridgingBpjsView dipakai dari Bridging.tsx.
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
            <ApotekView onBack={() => setActiveMenu('menu-utama')} />
          </div>
        );
      case 'kasir':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Kasir</h2>
            <p style={{ color: '#6b7280' }}>Billing pasien, pembayaran, dan rekapitulasi kas harian.</p>
          </section>
        );
      case 'casemix':
        return <CasemixView key={casemixResetKey} user={user} onBack={() => setActiveMenu('menu-utama')} />;
      case 'bridging':
        return <BridgingView key={bridgingResetKey} />;
      case 'radiologi':
        return <RadiologiView user={user} />;
      case 'laboratorium-pk':
        return <LaboratoriumPKView user={user} />;
      case 'laboratorium-pa':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Laboratorium PA</h2>
            <p style={{ color: '#6b7280' }}>Pemeriksaan lab PA & hasil laboratorium — segera hadir, menyusul Laboratorium PK.</p>
          </section>
        );
      case 'kepegawaian':
        // Layout sendiri (sidebar + full layar), lepas dari shell aplikasi
        // sepenuhnya — persis pola ApotekView/BridgingBpjsView.
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
            <KepegawaianView onBack={() => setActiveMenu('menu-utama')} />
          </div>
        );
      case 'it-support':
        return <ItSupportView />;
      case 'anjungan-antrian':
        return <AntrianDashboardView />;
      case 'rekam-medis':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Rekam Medis</h2>
            <p style={{ color: '#6b7280' }}>Pengelolaan rekam medis & dokumentasi</p>
          </section>
        );
      case 'berkas-digital':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Berkas Digital</h2>
            <p style={{ color: '#6b7280' }}>Arsip dokumen & berkas digital pasien</p>
          </section>
        );
      case 'jadwal-operasi':
        return <JadwalOperasiView />;
      case 'laporan':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Laporan</h2>
            <p style={{ color: '#6b7280' }}>
              Laporan kunjungan, BOR, LOS, pendapatan, dan pelaporan ke dinas/BPJS.
            </p>
          </section>
        );
      case 'admin':
        return <AdminView />;
      case 'satu-sehat':
        // Layout sendiri (sidebar + full layar), lepas dari shell aplikasi
        // sepenuhnya — persis pola ApotekView/BridgingBpjsView.
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
            <SatuSehatView onBack={() => setActiveMenu('menu-utama')} />
          </div>
        );
      case 'mapping-satu-sehat':
        return <MappingSatuSehatView />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        fontFamily: 'Tahoma, Geneva, sans-serif',
        fontSize: 14,
        background: '#F9FAFB',
        minHeight: '100vh',
        display: 'flex'
      }}
    >
      {/* Overlay drawer sidebar, hanya muncul di layar compact (tablet portrait) saat dibuka */}
      {isCompact && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
        />
      )}

      {/* Sidebar 2901,2996*/}
      <aside
        style={{
          width: !isCompact && desktopSidebarCollapsed ? 0 : 200,
          background: '#F9FAFB',
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
          padding: !isCompact && desktopSidebarCollapsed ? 0 : '16px 14px',
          height: '100vh',
          overflow: 'hidden',
          flexShrink: 0,
          ...(isCompact
            ? {
                position: 'fixed' as const,
                top: 0,
                left: 0,
                zIndex: 50,
                boxShadow: '2px 0 16px rgba(0,0,0,0.2)',
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.25s ease'
              }
            : {
                position: 'sticky' as const,
                top: 0,
                transition: 'width 0.2s ease, padding 0.2s ease'
              })
        }}
      >
        <div style={{ padding: '10px 10px 20px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
          {instansi?.logo_url && (
            <img
              src={instansi.logo_url}
              alt="Logo"
              style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.4, color: '#2563eb' }}>
              SIMRS
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>E-Medical Record</div>
          </div>
        </div>

        <nav style={{ marginTop: 16, flex: 1, overflowY: 'auto' }}>
          {(() => {
            const labChildren = visibleMenuItems.filter((i) => i.key === 'laboratorium-pk' || i.key === 'laboratorium-pa');
            const labActive = labChildren.some((i) => i.key === activeMenu);
            const labExpanded = labMenuOpen || labActive;

            const renderNavButton = (item: { key: MenuKey; label: string; icon: string | React.ReactNode }, indent = false) => {
              const active = activeMenu === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    // Klik ulang menu Casemix/Bridging (walau sudah aktif) reset kembali
                    // ke grid sub-menu-nya, karena tidak ada tombol "kembali" di dalamnya.
                    if (item.key === 'casemix') {
                      setCasemixResetKey((k) => k + 1);
                    }
                    if (item.key === 'bridging') {
                      setBridgingResetKey((k) => k + 1);
                    }
                    // Pindah ke menu LAIN (bukan salah satu anak Laboratorium)
                    // -> tutup accordion Laboratorium otomatis, supaya tidak
                    // nyangkut kebuka terus walau lagi di menu lain.
                    if (item.key !== 'laboratorium-pk' && item.key !== 'laboratorium-pa') {
                      setLabMenuOpen(false);
                    }
                    setActiveMenu(item.key);
                    if (isCompact) setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: indent ? '7px 10px 7px 20px' : '8px 10px',
                    marginBottom: 4,
                    borderRadius: 10,
                    border: 'none',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#000000',
                    cursor: 'pointer',
                    fontSize: indent ? 12.5 : 13,
                    fontWeight: 400,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = '#f3f4f6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {indent ? (
                      <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.7 }}>›</span>
                    ) : (
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                    )}
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            };

            return visibleMenuItems.map((item) => {
              // "Laboratorium PA" tidak dirender sendiri — sudah ikut
              // ditampilkan sebagai anak accordion di posisi "laboratorium-pk".
              if (item.key === 'laboratorium-pa') return null;

              // Grup accordion "Laboratorium" — cuma dipakai kalau user
              // punya akses ke KEDUA anak (PK & PA). Kalau cuma satu yg
              // diizinkan (mis. lewat allowed_modules per akun), tampilkan
              // sbg tombol biasa spy tidak ada accordion kosong sebelah.
              if (item.key === 'laboratorium-pk' && labChildren.length >= 2) {
                // Satu panel biru solid membungkus induk + semua anak begitu
                // expanded (bukan cuma anak aktif yg diwarnai) — persis
                // referensi "Daftar Resep Dokter" di sidebar Apotek.
                return (
                  <div
                    key="laboratorium-group"
                    style={{
                      marginBottom: 4,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: labExpanded ? '#2563eb' : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // Klik induk "Laboratorium" — expand/collapse
                        // panelnya SEKALIGUS langsung aktifkan & buka
                        // Laboratorium PK sbg default (bukan cuma expand
                        // tanpa navigasi kemana2).
                        setLabMenuOpen((v) => !v);
                        setActiveMenu('laboratorium-pk');
                        if (isCompact) setSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: 'none',
                        // Ikut labExpanded (bukan selalu 'transparent') —
                        // supaya React mendeteksi PERUBAHAN nilai style tiap
                        // kali accordion dibuka/tutup dan otomatis menimpa
                        // efek hover abu-abu yg dimanipulasi langsung ke DOM
                        // (onMouseEnter/Leave di bawah). Kalau nilainya selalu
                        // sama ('transparent' terus), React tidak pernah
                        // menulis ulang style itu shg hover abu-abu jadi
                        // "nyangkut" permanen begitu accordion di-expand.
                        background: labExpanded ? '#2563eb' : 'transparent',
                        color: labExpanded ? '#ffffff' : '#000000',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 400,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                      onMouseEnter={(e) => {
                        if (!labExpanded) e.currentTarget.style.background = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        if (!labExpanded) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                        <span>Laboratorium</span>
                      </div>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: labExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {labExpanded && (
                      <div style={{ paddingBottom: 4 }}>
                        {labChildren.map((child) => {
                          const childActive = activeMenu === child.key;
                          return (
                            <button
                              key={child.key}
                              onClick={() => {
                                setActiveMenu(child.key);
                                if (isCompact) setSidebarOpen(false);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: childActive ? '7px 10px 7px 26px' : '7px 10px 7px 20px',
                                border: 'none',
                                // Tanpa background sama sekali (biar panel biru
                                // di belakangnya yg tampil apa adanya) — cuma
                                // font putih+bold yg membedakan item aktif.
                                // TIDAK pakai onMouseEnter/Leave imperatif di
                                // sini spy tidak kena bug yg sama dgn header
                                // (background bernilai konstan antar render
                                // bikin React tidak pernah menimpa ulang
                                // mutasi DOM dari hover, jadi nyangkut).
                                background: 'transparent',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: 12.5,
                                fontWeight: childActive ? 700 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.85 }}>›</span>
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return renderNavButton(item);
            });
          })()}
        </nav>

        <div
          style={{
            marginTop: 8,
            padding: '10px 10px 6px 10px',
            borderTop: '1px solid #e5e7eb',
            fontSize: 11,
            color: '#6b7280'
          }}
        >
          <div>© 2026 Firdaus | All Rights Reserved</div>
          <div>Versi: 0.0.1 (layout awal)</div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Topbar */}
        <header
          style={{
            height: 48,
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F9FAFB',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            gap: 12
          }}
        >
          {/* Hamburger — dulu di sini ada kolom "Cari menu" yang tidak
              tersambung ke apa-apa (tidak ada onChange/filter), diganti
              tombol untuk buka/tutup sidebar. Di layar compact toggle
              drawer overlay (sidebarOpen), di desktop toggle collapse
              sidebar sticky (desktopSidebarCollapsed). */}
          <button
            type="button"
            onClick={() => (isCompact ? setSidebarOpen((v) => !v) : setDesktopSidebarCollapsed((v) => !v))}
            aria-label={isCompact ? (sidebarOpen ? 'Tutup menu' : 'Buka menu') : (desktopSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar')}
            title={isCompact ? (sidebarOpen ? 'Tutup menu' : 'Buka menu') : (desktopSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7"></line>
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="17" x2="20" y2="17"></line>
            </svg>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13,
              color: '#4b5563'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 2
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                {user.full_name}
              </div>
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: '#dbeafe',
                  color: '#2563eb',
                  fontSize: 10,
                  fontWeight: 600
                }}
              >
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </div>
            </div>

            {/* User Menu Dropdown */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #2563eb, #1e40af)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {user.full_name
                  .split(' ')
                  .map((p) => p.charAt(0))
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: '#ffffff',
                    borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e5e7eb',
                    minWidth: 180,
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}
                >
                  {/* Menu Items */}
                  <div style={{ padding: 6 }}>
                    <button
                      onClick={() => {
                        // Non-admin cuma boleh ganti password sendiri —
                        // AdminView (User, Bridging, Set Tarif, dll) khusus
                        // role 'admin'.
                        if (user.role === 'admin') {
                          setActiveMenu('admin');
                        } else {
                          setShowGantiPassword(true);
                        }
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 8,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.color = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#374151';
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48" fill="currentColor">
                        <path d="M 24 4 C 22.423103 4 20.902664 4.1994284 19.451172 4.5371094 A 1.50015 1.50015 0 0 0 18.300781 5.8359375 L 17.982422 8.7382812 C 17.878304 9.6893592 17.328913 10.530853 16.5 11.009766 C 15.672739 11.487724 14.66862 11.540667 13.792969 11.15625 L 13.791016 11.15625 L 11.125 9.9824219 A 1.50015 1.50015 0 0 0 9.4257812 10.330078 C 7.3532865 12.539588 5.7626807 15.215064 4.859375 18.201172 A 1.50015 1.50015 0 0 0 5.4082031 19.845703 L 7.7734375 21.580078 C 8.5457929 22.147918 9 23.042801 9 24 C 9 24.95771 8.5458041 25.853342 7.7734375 26.419922 L 5.4082031 28.152344 A 1.50015 1.50015 0 0 0 4.859375 29.796875 C 5.7625845 32.782665 7.3519262 35.460112 9.4257812 37.669922 A 1.50015 1.50015 0 0 0 11.125 38.015625 L 13.791016 36.841797 C 14.667094 36.456509 15.672169 36.511947 16.5 36.990234 C 17.328913 37.469147 17.878304 38.310641 17.982422 39.261719 L 18.300781 42.164062 A 1.50015 1.50015 0 0 0 19.449219 43.460938 C 20.901371 43.799844 22.423103 44 24 44 C 25.576897 44 27.097336 43.800572 28.548828 43.462891 A 1.50015 1.50015 0 0 0 29.699219 42.164062 L 30.017578 39.261719 C 30.121696 38.310641 30.671087 37.469147 31.5 36.990234 C 32.327261 36.512276 33.33138 36.45738 34.207031 36.841797 L 36.875 38.015625 A 1.50015 1.50015 0 0 0 38.574219 37.669922 C 40.646713 35.460412 42.237319 32.782983 43.140625 29.796875 A 1.50015 1.50015 0 0 0 42.591797 28.152344 L 40.226562 26.419922 C 39.454197 25.853342 39 24.95771 39 24 C 39 23.04229 39.454197 22.146658 40.226562 21.580078 L 42.591797 19.847656 A 1.50015 1.50015 0 0 0 43.140625 18.203125 C 42.237319 15.217017 40.646713 12.539588 38.574219 10.330078 A 1.50015 1.50015 0 0 0 36.875 9.984375 L 34.207031 11.158203 C 33.33138 11.54262 32.327261 11.487724 31.5 11.009766 C 30.671087 10.530853 30.121696 9.6893592 30.017578 8.7382812 L 29.699219 5.8359375 A 1.50015 1.50015 0 0 0 28.550781 4.5390625 C 27.098629 4.2001555 25.576897 4 24 4 z M 24 7 C 24.974302 7 25.90992 7.1748796 26.847656 7.3398438 L 27.035156 9.0644531 C 27.243038 10.963375 28.346913 12.652335 30 13.607422 C 31.654169 14.563134 33.668094 14.673009 35.416016 13.904297 L 37.001953 13.207031 C 38.219788 14.669402 39.183985 16.321182 39.857422 18.130859 L 38.451172 19.162109 C 36.911538 20.291529 36 22.08971 36 24 C 36 25.91029 36.911538 27.708471 38.451172 28.837891 L 39.857422 29.869141 C 39.183985 31.678818 38.219788 33.330598 37.001953 34.792969 L 35.416016 34.095703 C 33.668094 33.326991 31.654169 33.436866 30 34.392578 C 28.346913 35.347665 27.243038 37.036625 27.035156 38.935547 L 26.847656 40.660156 C 25.910002 40.82466 24.973817 41 24 41 C 23.025698 41 22.09008 40.82512 21.152344 40.660156 L 20.964844 38.935547 C 20.756962 37.036625 19.653087 35.347665 18 34.392578 C 16.345831 33.436866 14.331906 33.326991 12.583984 34.095703 L 10.998047 34.792969 C 9.7799772 33.330806 8.8159425 31.678964 8.1425781 29.869141 L 9.5488281 28.837891 C 11.088462 27.708471 12 25.91029 12 24 C 12 22.08971 11.087719 20.290363 9.5488281 19.160156 L 8.1425781 18.128906 C 8.8163325 16.318532 9.7814501 14.667839 11 13.205078 L 12.583984 13.902344 C 14.331906 14.671056 16.345831 14.563134 18 13.607422 C 19.653087 12.652335 20.756962 10.963375 20.964844 9.0644531 L 21.152344 7.3398438 C 22.089998 7.1753403 23.026183 7 24 7 z M 24 16 C 19.599487 16 16 19.59949 16 24 C 16 28.40051 19.599487 32 24 32 C 28.400513 32 32 28.40051 32 24 C 32 19.59949 28.400513 16 24 16 z M 24 19 C 26.779194 19 29 21.220808 29 24 C 29 26.779192 26.779194 29 24 29 C 21.220806 29 19 26.779192 19 24 C 19 21.220808 21.220806 19 24 19 z"></path>
                      </svg>
                      Pengaturan
                    </button>

                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 8,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#374151';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {showGantiPassword && (
          <ModalGantiPassword userId={user.id} onClose={() => setShowGantiPassword(false)} />
        )}

        {/* Content */}
        <main
          style={{
            padding: '0 12px 24px 24px',
            flex: 1,
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 15,
              padding: 24,
              boxShadow: '0 4px 20px rgba(255, 255, 255, 0.08)',
              border: '1px solid #d1d5db',
              height: 'calc(100vh - 72px)',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}
          >
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

