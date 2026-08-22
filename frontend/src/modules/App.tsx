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

type MenuKey =
  | 'menu-utama'
  | 'pendaftaran'
  | 'igd'
  | 'rawat-jalan'
  | 'rawat-inap'
  | 'radiologi'
  | 'laboratorium'
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

export type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  allowed_modules?: string;
  nip?: string;
  kd_dokter?: string;
};

type LoginViewProps = {
  onLogin: (user: AppUser, remember: boolean) => void;
  onShowRegister: () => void;
};

type InstansiSettings = {
  nama_instansi: string;
  logo_url: string;
};

type LoginWallpaperSettings = {
  login_wallpaper_url: string;
};

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onShowRegister }) => {
  // Username diingat terpisah dari sesi login (ermapp_user) — supaya
  // tetap terisi otomatis di form login walau user sudah logout
  // (handleLogout cuma hapus sesi, bukan ermapp_remembered_username).
  const [username, setUsername] = React.useState<string>(
    () => window.localStorage.getItem('ermapp_remembered_username') || ''
  );
  const [password, setPassword] = React.useState<string>('');
  const [showPassword, setShowPassword] = React.useState<boolean>(false);
  const [rememberMe, setRememberMe] = React.useState<boolean>(true);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [instansi, setInstansi] = React.useState<InstansiSettings | null>(null);
  const [wallpaper, setWallpaper] = React.useState<LoginWallpaperSettings | null>(null);
  // Breakpoint HP (beda dari isMobileLogin di App — dipakai di sini
  // krn LoginView dirender SEBELUM login, jadi belum tahu account-nya
  // pegawai atau bukan; ini murni penyesuaian ukuran layar).
  const isMobile = useMediaQuery(480);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setInstansi(data); })
      .catch(() => {});
    fetch('/api/settings/display')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setWallpaper(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const namaInstansi = instansi?.nama_instansi || 'SIMRS WEB';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Isi username dan password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || 'Login gagal');
      }
      const user: AppUser = (data as any).user;
      if (rememberMe) {
        window.localStorage.setItem('ermapp_remembered_username', username);
      } else {
        window.localStorage.removeItem('ermapp_remembered_username');
      }
      onLogin(user, rememberMe);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        // 100dvh (bukan 100vh) — di iOS, 100vh TIDAK mengecil saat
        // keyboard muncul (tetap ukuran layar penuh), jadi konten yang
        // di-center vertikal ketutup keyboard tanpa bisa discroll.
        // dvh ikut ukuran viewport visual yang sebenarnya (menyempit
        // saat keyboard aktif), + overflowY auto sbg jaga-jaga kalau
        // konten masih lebih tinggi dari sisa ruang yang ada.
        minHeight: '100dvh',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: wallpaper?.login_wallpaper_url
          ? `linear-gradient(rgba(15,23,42,0.35), rgba(15,23,42,0.45)), center/cover no-repeat url(${wallpaper.login_wallpaper_url})`
          : 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)',
        fontFamily: 'Tahoma, Geneva, sans-serif',
        fontSize: 14,
        padding: isMobile ? 16 : 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: isMobile ? '100%' : 350,
          maxWidth: isMobile ? 380 : '90%',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(10px)',
          borderRadius: isMobile ? 16 : 8,
          padding: isMobile ? '28px 22px 22px' : '36px 32px 28px',
          boxShadow: '0 25px 60px rgba(15,23,42,0.3)',
          border: '1px solid rgba(148,163,184,0.2)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: isMobile ? 22 : 28 }}>
          {instansi?.logo_url ? (
            <img
              src={instansi.logo_url}
              alt="Logo"
              style={{ height: isMobile ? 76 : 96, maxWidth: '100%', objectFit: 'contain', marginBottom: 14 }}
            />
          ) : (
            <div
              style={{
                width: isMobile ? 56 : 64, height: isMobile ? 56 : 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1AB1E5, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, boxShadow: '0 8px 20px rgba(37,99,235,0.3)'
              }}
            >
              <svg width={isMobile ? 26 : 30} height={isMobile ? 26 : 30} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
            </div>
          )}
          <div
            style={{
              fontSize: isMobile ? 16 : 17,
              fontWeight: 700,
              color: '#111827',
              textAlign: 'center',
              lineHeight: 1.3
            }}
          >
            {namaInstansi}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            Masuk untuk melanjutkan
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 26,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}></label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                placeholder="Nama Pengguna"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1AB1E5'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}></label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 36px 9px 36px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1AB1E5'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', alignItems: 'center', color: '#9ca3af'
                }}
              >
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 12, color: '#374151', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }}
            />
            Ingat saya
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 4,
              border: 'none',
              background: loading ? '#9ca3af' : '#2563eb',
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: loading ? 'none' : '0 8px 20px rgba(37,99,235,0.3)',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#1d4ed8'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#2563eb'; }}
          >
            {loading && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
              </svg>
            )}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12.5, color: '#374151' }}>
          Belum punya akun?{' '}
          <button
            type="button"
            onClick={onShowRegister}
            style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Daftar
          </button>
        </div>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          © 2026 Firdaus | All Rights Reserved
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const registerInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  // 16px, bukan di bawahnya — di bawah 16px iOS Safari otomatis zoom
  // in tiap field ini fokus (sama spt fix di PresensiMobile.tsx utk
  // halaman Masuk; RegisterView beda file jadi gak ikut ke-cover
  // waktu itu).
  fontSize: 16,
  boxSizing: 'border-box',
  outline: 'none',
};

type RegisterViewProps = {
  onBackToLogin: () => void;
};

// RegisterView — "Belum punya akun? Daftar" di LoginView. Alur: pegawai
// masukin NIP/NIK KTP -> dicocokkan ke tabel petugas (GET
// /api/auth/cari-pegawai) -> kalau ketemu & belum ada akun, baru
// tampilkan sisa form (Asal Unit + kata sandi). NIP dipakai langsung
// sbg username (staf sudah pasti hafal NIP-nya sendiri), dan akun yang
// terbentuk dikunci ke modul Kepegawaian saja (lihat komentar di
// registerAkunMandiri, backend/auth_register_handler.go) — bukan modul
// RM pasien/billing/dll.
const RegisterView: React.FC<RegisterViewProps> = ({ onBackToLogin }) => {
  const [q, setQ] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<{ nip: string; nama: string } | null>(null);

  const [departemenList, setDepartemenList] = React.useState<{ kode: string; nama: string }[]>([]);
  const [departemen, setDepartemen] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [instansi, setInstansi] = React.useState<InstansiSettings | null>(null);
  const isMobile = useMediaQuery(480);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setInstansi(data); })
      .catch(() => {});
    fetch('/api/pegawai/departemen')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled && Array.isArray(data)) setDepartemenList(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const namaInstansi = instansi?.nama_instansi || 'SIMRS WEB';

  const handleCari = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      setSearchError('Isi NIP atau NIK dulu.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/auth/cari-pegawai?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || 'Data pegawai tidak ditemukan');
      }
      if ((data as any).sudah_terdaftar) {
        throw new Error('NIP ini sudah terdaftar. Silakan masuk, atau hubungi bagian Umum/Kepegawaian kalau lupa kata sandi.');
      }
      setFound({ nip: (data as any).nip, nama: (data as any).nama });
      // Auto-isi Asal Unit dari data kepegawaian yg ketemu — dropdown-nya
      // tetap bisa diganti manual (mis. staf pindah unit tapi data
      // pegawai belum diupdate admin), bukan dikunci. '-' bukan kode
      // departemen valid (gak ada di daftar /api/pegawai/departemen),
      // jadi dianggap sama spt kosong.
      const departemenAwal = (data as any).departemen || '';
      setDepartemen(departemenAwal === '-' ? '' : departemenAwal);
    } catch (err) {
      setFound(null);
      setSearchError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSearching(false);
    }
  };

  const handleGantiPencarian = () => {
    setFound(null);
    setSearchError(null);
    setDepartemen('');
    setPassword('');
    setConfirmPassword('');
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!found) return;
    setSubmitError(null);
    if (!departemen) {
      setSubmitError('Pilih Asal Unit dulu.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip: found.nip, departemen, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || 'Pendaftaran gagal');
      }
      // Prefill username di halaman Masuk, sama seperti kalau baru saja
      // centang "Ingat saya" — supaya staf tinggal ketik kata sandi.
      window.localStorage.setItem('ermapp_remembered_username', found.nip);
      await Swal.fire({ icon: 'success', title: 'Pendaftaran berhasil', text: 'Silakan masuk pakai NIP dan kata sandi yang baru dibuat.' });
      onBackToLogin();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)',
        fontFamily: 'Tahoma, Geneva, sans-serif',
        fontSize: 14,
        padding: isMobile ? 16 : 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: isMobile ? '100%' : 380,
          maxWidth: isMobile ? 380 : '90%',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(10px)',
          borderRadius: isMobile ? 16 : 8,
          padding: isMobile ? '28px 22px 22px' : '36px 32px 28px',
          boxShadow: '0 25px 60px rgba(15,23,42,0.3)',
          border: '1px solid rgba(148,163,184,0.2)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', textAlign: 'center' }}>{namaInstansi}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Daftar Akun Pegawai</div>
        </div>

        {!found ? (
          <form onSubmit={handleCari}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: '#374151', marginBottom: 6 }}>
                NIP Pegawai / NIK
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Masukan NIP pegawai atau NIK KTP"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={registerInputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#1AB1E5')}
                onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                Dipakai untuk menemukan data kepegawaian kamu.
              </div>
            </div>
            {searchError && (
              <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12.5 }}>
                {searchError}
              </div>
            )}
            <button
              type="submit"
              disabled={searching}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 4, border: 'none',
                background: searching ? '#9ca3af' : '#2563eb', color: '#fff',
                cursor: searching ? 'default' : 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              {searching ? 'Mencari...' : 'Cari'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12.5, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>✓ {found.nama} <span style={{ color: '#4b7c62' }}>(NIP: {found.nip})</span></span>
              <button type="button" onClick={handleGantiPencarian} style={{ background: 'transparent', border: 'none', color: '#166534', textDecoration: 'underline', cursor: 'pointer', fontSize: 11.5, padding: 0, whiteSpace: 'nowrap' }}>
                Bukan saya
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: '#374151', marginBottom: 6 }}>Asal Unit</label>
              <select
                value={departemen}
                onChange={(e) => setDepartemen(e.target.value)}
                style={{ ...registerInputStyle, background: '#fff' }}
              >
                <option value="">Pilih unit/departemen</option>
                {departemenList.map((d) => (
                  <option key={d.kode} value={d.kode}>{d.nama}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: '#374151', marginBottom: 6 }}>Buat Kata Sandi</label>
              <input
                type="password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={registerInputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: '#374151', marginBottom: 6 }}>Konfirmasi Kata Sandi</label>
              <input
                type="password"
                placeholder="Ulangi kata sandi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={registerInputStyle}
              />
            </div>

            {submitError && (
              <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12.5 }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 4, border: 'none',
                background: submitting ? '#9ca3af' : '#2563eb', color: '#fff',
                cursor: submitting ? 'default' : 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              {submitting ? 'Memproses...' : 'Daftar'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12.5, color: '#374151' }}>
          Sudah punya akun?{' '}
          <button
            type="button"
            onClick={onBackToLogin}
            style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Masuk
          </button>
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');
  const [activeMenu, setActiveMenu] = React.useState<MenuKey>('menu-utama');
  const [health, setHealth] = React.useState<string>('Belum cek');
  const [loadingHealth, setLoadingHealth] = React.useState<boolean>(false);
  const [selectedPatientForExam, setSelectedPatientForExam] = React.useState<any | null>(null);
  const { isCompact } = useBreakpoint();
  // Login dari HP (lebar layar <=640px, breakpoint khusus phone — beda
  // dari isCompact/900px yang dipakai buat tablet) -> tampilkan aplikasi
  // Presensi Mandiri mobile penuh layar, bukan shell SIMRS desktop.
  const isMobileLogin = useMediaQuery(640);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
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
    'laboratorium',
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
      label: 'Rawat Jalan',
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
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
      key: 'laboratorium',
      label: 'Laboratorium',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v10.5L5.5 19c-.5.9-.5 2 .5 2.5h12c1 -.5 1-1.6.5-2.5L15 13.5V3"></path>
          <path d="M6.5 16h11"></path>
          <path d="M9 3h6"></path>
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
    // "Ingat saya" dicentang -> disimpan di localStorage (tetap login
    // setelah browser ditutup). Tidak dicentang -> sessionStorage saja
    // (hilang begitu tab/browser ditutup).
    const stored = window.localStorage.getItem('ermapp_user') || window.sessionStorage.getItem('ermapp_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        setUser(parsed);
      } catch {
        window.localStorage.removeItem('ermapp_user');
        window.sessionStorage.removeItem('ermapp_user');
      }
    }
  }, []);

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

  const handleLogin = (u: AppUser, remember: boolean) => {
    setUser(u);
    if (remember) {
      window.localStorage.setItem('ermapp_user', JSON.stringify(u));
      window.sessionStorage.removeItem('ermapp_user');
    } else {
      window.sessionStorage.setItem('ermapp_user', JSON.stringify(u));
      window.localStorage.removeItem('ermapp_user');
    }
  };

  const handleLogout = () => {
    setUser(null);
    window.localStorage.removeItem('ermapp_user');
    window.sessionStorage.removeItem('ermapp_user');
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

  // role 'pegawai' (akun hasil Daftar mandiri, lihat RegisterView di atas)
  // SELALU dipaksa ke PresensiMobileView, walau login dari desktop —
  // PresensiMobileView sudah membatasi Menu Utama-nya ke Lembur/Cuti/Izin/
  // Tugas/Lapor IT saja (lihat LayananCard). Kalau cuma mengandalkan
  // isMobileLogin, akun ini bisa lolos lewat browser desktop lebar dan
  // mendarat di KepegawaianView (panel HR admin penuh, tanpa filter),
  // membocorkan akses yang seharusnya baru dibuka admin.
  if (isMobileLogin || user.role === 'pegawai') {
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
        return <IGDKView />;
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
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Radiologi</h2>
            <p style={{ color: '#6b7280' }}>Permintaan & hasil pemeriksaan radiologi</p>
          </section>
        );
      case 'laboratorium':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Laboratorium</h2>
            <p style={{ color: '#6b7280' }}>Pemeriksaan lab PK, PA & hasil laboratorium</p>
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
          width: 200,
          background: '#F9FAFB',
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 14px',
          height: '100vh',
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
                top: 0
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
          {visibleMenuItems.map((item) => {
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
                  setActiveMenu(item.key);
                  if (isCompact) setSidebarOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 10,
                  border: 'none',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : '#000000',
                  cursor: 'pointer',
                  fontSize: 13,
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
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
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
          {isCompact && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
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
          )}
          <div style={{ position: 'relative', width: 250 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari menu"
              style={{
                width: '100%',
                padding: '6px 12px 6px 34px',
                borderRadius: 25,
                border: '1px solid #d1d5db',
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

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

