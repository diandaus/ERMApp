import React from 'react';
import Swal from 'sweetalert2';
import { useMediaQuery } from '../hooks/useBreakpoint';

// Auth.tsx — LoginView/RegisterView dipisah dari App.tsx supaya bisa dipakai
// bareng oleh DUA entry point terpisah: App.tsx (aplikasi desktop penuh) DAN
// main-presensi.tsx (bundle mobile-only presensi.rsislamibnusinasigli.com).
// File ini SENGAJA cuma import React/Swal/useMediaQuery — TIDAK boleh import
// modul desktop (Casemix/Radiologi/dst) atau library berat (pdf-lib/qrcode/
// pdfjs-dist/antd/xlsx), supaya kalau di-import dari main-presensi.tsx tidak
// ikut menarik bundle raksasa itu ke situ.

export type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  allowed_modules?: string;
  nip?: string;
  kd_dokter?: string;
  // akun_mandiri — true kalau akun ini didaftarkan sendiri lewat halaman
  // "Daftar" (bukan dibuatkan admin). Role akun mandiri sekarang bisa
  // macam2 tergantung departemen (dokter/farmasi/radiologi/dst, bukan
  // cuma 'pegawai'), jadi field INI (bukan role) yang jadi penanda utk
  // paksa ke PresensiMobileView — lihat pemakaiannya di App.tsx.
  akun_mandiri?: boolean;
};

type LoginViewProps = {
  onLogin: (user: AppUser, remember: boolean) => void;
  onShowRegister: () => void;
};

// Auto-logout setelah 12 jam tanpa aktivitas — lihat handleLogin/handleLogout
// & effect pelacak aktivitas di App.tsx / main-presensi.tsx.
export const BATAS_TIDAK_AKTIF_MS = 12 * 60 * 60 * 1000;
export const catatAktivitas = () => {
  window.sessionStorage.setItem('ermapp_last_activity', String(Date.now()));
};

type InstansiSettings = {
  nama_instansi: string;
  logo_url: string;
};

type LoginWallpaperSettings = {
  login_wallpaper_url: string;
};

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onShowRegister }) => {
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
export const RegisterView: React.FC<RegisterViewProps> = ({ onBackToLogin }) => {
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
      // Username (NIP) ditampilkan besar + tombol copy di dialog sukses —
      // staf yang daftar pakai NIK KTP (bukan hafal NIP-nya) sering
      // bingung mau login pakai apa krn cuma inget password yg baru
      // dibuat. Padanan Flutter: e_presensi/lib/screens/register_screen.dart.
      const nipValue = found.nip;
      await Swal.fire({
        icon: 'success',
        title: 'Pendaftaran berhasil',
        html: `
          <div style="text-align:left;font-size:13px;color:#374151;">
            <div style="margin-bottom:10px;">Silakan masuk pakai username dan kata sandi yang baru dibuat.</div>
            <div style="font-size:11.5px;color:#6b7280;margin-bottom:4px;">Username Anda:</div>
            <div style="display:flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 4px 6px 12px;">
              <span style="flex:1;font-size:16px;font-weight:700;color:#166534;">${nipValue}</span>
              <button id="reg-copy-username-btn" type="button" title="Salin username" style="background:transparent;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;color:#166534;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </div>
        `,
        confirmButtonText: 'OK',
        didOpen: () => {
          const btn = document.getElementById('reg-copy-username-btn');
          if (!btn) return;
          btn.addEventListener('click', () => {
            navigator.clipboard.writeText(nipValue).catch(() => {});
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            window.setTimeout(() => {
              btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            }, 1500);
          });
        },
      });
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
