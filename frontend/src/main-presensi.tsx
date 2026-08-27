import React from 'react';
import ReactDOM from 'react-dom/client';
import Swal from 'sweetalert2';
import { AppUser, LoginView, RegisterView, BATAS_TIDAK_AKTIF_MS, catatAktivitas } from './modules/Auth';
import { PresensiMobileView } from './modules/PresensiMobile';
import { patchFetchForCapacitor } from './utils/apiBase';
import './App.css';

patchFetchForCapacitor();

// PresensiApp — entry TERPISAH dari App.tsx, khusus dibundel & di-deploy ke
// presensi.rsislamibnusinasigli.com. TIDAK mengimpor modul desktop
// (Casemix/Radiologi/dst) atau library berat (pdf-lib/qrcode/pdfjs-dist/
// antd/xlsx) sama sekali — cuma Auth.tsx (Login/Register) + PresensiMobile.tsx,
// supaya bundle-nya jauh lebih kecil dari app desktop penuh (yg 943KB gzip).
// Alasan pemisahan: HP yg sinyalnya lemah gagal/lama download bundle
// raksasa itu cuma buat nampilin form Login → layar putih tanpa error.
// Sesi login (sessionStorage 'ermapp_user') & auto-logout 12 jam SENGAJA
// disamakan persis dgn App.tsx supaya kompatibel kalau suatu saat user
// pindah antara domain presensi & domain app penuh (subdomain lain,
// menyusul).
const PresensiApp: React.FC = () => {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');
  const [checkedSession, setCheckedSession] = React.useState(false);

  React.useEffect(() => {
    window.localStorage.removeItem('ermapp_user');
    const stored = window.sessionStorage.getItem('ermapp_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        const lastActivity = Number(window.sessionStorage.getItem('ermapp_last_activity') || '0');
        if (lastActivity && Date.now() - lastActivity > BATAS_TIDAK_AKTIF_MS) {
          window.sessionStorage.removeItem('ermapp_user');
          window.sessionStorage.removeItem('ermapp_last_activity');
        } else {
          setUser(parsed);
          catatAktivitas();
        }
      } catch {
        window.sessionStorage.removeItem('ermapp_user');
      }
    }
    setCheckedSession(true);
  }, []);

  const handleLogin = (u: AppUser) => {
    setUser(u);
    window.sessionStorage.setItem('ermapp_user', JSON.stringify(u));
    catatAktivitas();
  };

  const handleLogout = () => {
    setUser(null);
    window.sessionStorage.removeItem('ermapp_user');
    window.sessionStorage.removeItem('ermapp_last_activity');
  };

  // Auto-logout setelah 12 jam tanpa aktivitas — sama pola dgn App.tsx.
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
      const lastActivity = Number(window.sessionStorage.getItem('ermapp_last_activity') || '0');
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

  if (!checkedSession) return null;

  if (!user) {
    return authView === 'register' ? (
      <RegisterView onBackToLogin={() => setAuthView('login')} />
    ) : (
      <LoginView onLogin={(u) => handleLogin(u)} onShowRegister={() => setAuthView('register')} />
    );
  }

  return <PresensiMobileView user={user} onLogout={handleLogout} />;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PresensiApp />
  </React.StrictMode>
);
