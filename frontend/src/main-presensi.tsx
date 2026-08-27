import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppUser, LoginView, RegisterView } from './modules/Auth';
import { PresensiMobileView } from './modules/PresensiMobile';
import { patchFetchForCapacitor } from './utils/apiBase';
import { safeStorage } from './utils/safeStorage';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

patchFetchForCapacitor();

// PresensiApp — entry TERPISAH dari App.tsx, khusus dibundel & di-deploy ke
// presensi.rsislamibnusinasigli.com. TIDAK mengimpor modul desktop
// (Casemix/Radiologi/dst) atau library berat (pdf-lib/qrcode/pdfjs-dist/
// antd/xlsx) sama sekali — cuma Auth.tsx (Login/Register) + PresensiMobile.tsx,
// supaya bundle-nya jauh lebih kecil dari app desktop penuh (yg 943KB gzip).
// Alasan pemisahan: HP yg sinyalnya lemah gagal/lama download bundle
// raksasa itu cuma buat nampilin form Login → layar putih tanpa error.
//
// Sesi login di localStorage (BUKAN sessionStorage spt App.tsx desktop) +
// TANPA auto-logout 12 jam — App.tsx sengaja logout otomatis krn satu
// komputer desktop bisa dipakai gantian banyak staf, tapi domain ini
// (padanan Flutter e_presensi) dipakai dari HP PRIBADI masing2 staf, jadi
// user TIDAK boleh dipaksa logout (baik krn nutup browser maupun idle
// terlalu lama) — cuma keluar kalau tap tombol Keluar sendiri.
const PresensiApp: React.FC = () => {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');
  const [checkedSession, setCheckedSession] = React.useState(false);

  React.useEffect(() => {
    const stored = safeStorage.get('local', 'ermapp_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AppUser);
      } catch {
        safeStorage.remove('local', 'ermapp_user');
      }
    }
    setCheckedSession(true);
  }, []);

  const handleLogin = (u: AppUser) => {
    setUser(u);
    safeStorage.set('local', 'ermapp_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    safeStorage.remove('local', 'ermapp_user');
  };

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
    <ErrorBoundary>
      <PresensiApp />
    </ErrorBoundary>
  </React.StrictMode>
);
