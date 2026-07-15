import React from 'react';
import Swal from 'sweetalert2';
import { MenuUtamaView } from './MenuUtama';
import { PemeriksaanView } from './Pemeriksaan';
import { RawatInapView } from './RawatInap';
import { CasemixView } from './Casemix';
import { BridgingView } from './Bridging';
import { RegistrasiView } from './Registrasi';
import { DisplayAntrianView } from './DisplayAntrian';
import { DisplayAntrianPoliView } from './DisplayAntrianPoli';
import { DisplayAntrianApotekView } from './DisplayAntrianApotek';
import { AntrianDashboardView } from './AntrianDashboard';
import { DisplaySettingsView } from './DisplaySettings';
import { AddUserModal } from '../components/AddUserModal';
import { SatuSehatView } from './SatuSehat';
import { MappingSatuSehatView } from './MappingSatuSehat';
import { PegawaiView } from './Pegawai';
import { AdminView } from './Admin';
import { useBreakpoint } from '../hooks/useBreakpoint';

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
  | 'anjungan-antrian'
  | 'rekam-medis'
  | 'berkas-digital'
  | 'jadwal-operasi'
  | 'laporan'
  | 'admin'
  | 'satu-sehat'
  | 'mapping-satu-sehat';

type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  allowed_modules?: string;
};

type LoginViewProps = {
  onLogin: (user: AppUser) => void;
};

type InstansiSettings = {
  nama_instansi: string;
  logo_url: string;
};

type LoginWallpaperSettings = {
  login_wallpaper_url: string;
};

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [instansi, setInstansi] = React.useState<InstansiSettings | null>(null);
  const [wallpaper, setWallpaper] = React.useState<LoginWallpaperSettings | null>(null);

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
      onLogin(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: wallpaper?.login_wallpaper_url
          ? `linear-gradient(rgba(15,23,42,0.35), rgba(15,23,42,0.45)), center/cover no-repeat url(${wallpaper.login_wallpaper_url})`
          : 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)',
        fontFamily: 'Tahoma, Geneva, sans-serif',
        fontSize: 14
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: '90%',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(6px)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
          border: '1px solid rgba(148,163,184,0.25)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          {instansi?.logo_url && (
            <img
              src={instansi.logo_url}
              alt="Logo"
              style={{ height: 112, maxWidth: '100%', objectFit: 'contain', marginBottom: 12 }}
            />
          )}
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
              textAlign: 'center',
              lineHeight: 1.3
            }}
          >
            {namaInstansi}
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 10,
              padding: 8,
              borderRadius: 8,
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 12
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Username</label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 999,
              border: 'none',
              background: loading ? '#9ca3af' : '#2563eb',
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          © 2026 Firdaus | All Rights Reserved
        </div>
      </div>
    </div>
  );
};

type RawatJalanViewProps = {
  onSelectPatient: (patient: any) => void;
  user: AppUser;
};

const RawatJalanView: React.FC<RawatJalanViewProps> = ({ onSelectPatient, user }) => {
  const [activeTab, setActiveTab] = React.useState<'poli-today' | 'rujukan-internal'>('poli-today');
  const [poliToday, setPoliToday] = React.useState<any[]>([]);
  const [rujukanInternal, setRujukanInternal] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Helper function untuk format tanggal lokal (WIB)
  const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [tglDari, setTglDari] = React.useState<string>(getLocalDateString());
  const [tglSampai, setTglSampai] = React.useState<string>(getLocalDateString());
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);
  const [showStatusDropdown, setShowStatusDropdown] = React.useState<string | null>(null);
  const [showSuratDropdown, setShowSuratDropdown] = React.useState<string | null>(null);
  const [suratDropdownPos, setSuratDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const [statusDropdownPos, setStatusDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);

  const filterDropdownRef = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const suratDropdownRef = React.useRef<HTMLDivElement>(null);

  const loadPoliToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rawat-jalan/poli-today?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data poli hari ini');
      }
      setPoliToday(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const loadRujukanInternal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rawat-jalan/rujukan-internal?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data rujukan internal');
      }
      setRujukanInternal(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Sudah':
        return { bg: '#ecfdf3', color: '#166534', label: 'Sudah', dropdownLabel: 'Sudah Periksa' };
      case 'Belum':
        return { bg: '#fef3c7', color: '#92400e', label: 'Belum', dropdownLabel: 'Belum Periksa' };
      case 'Batal':
        return { bg: '#fee2e2', color: '#991b1b', label: 'Batal', dropdownLabel: 'Batal Periksa' };
      case 'Dirujuk':
        return { bg: '#dbeafe', color: '#1e40af', label: 'Dirujuk', dropdownLabel: 'Dirujuk' };
      case 'Dirawat':
        return { bg: '#f3e8ff', color: '#6b21a8', label: 'Dirawat', dropdownLabel: 'Dirawat' };
      default:
        return { bg: '#f3f4f6', color: '#374151', label: status, dropdownLabel: status };
    }
  };

  // Fungsi untuk mengkonversi nomor antrian ke format suara
  const speakQueueNumber = (noAntrian: string, namaPasien: string, namaPoli: string) => {
    // Konversi nomor antrian: P-001 -> "P KOSONG KOSONG SATU"
    const parts = noAntrian.split('-');
    const prefix = parts[0]; // Huruf (P, A, I, dll)
    const numbers = parts[1] || ''; // Angka (001)

    // Konversi setiap digit menjadi kata
    const digitMap: { [key: string]: string } = {
      '0': 'KOSONG',
      '1': 'SATU',
      '2': 'DUA',
      '3': 'TIGA',
      '4': 'EMPAT',
      '5': 'LIMA',
      '6': 'ENAM',
      '7': 'TUJUH',
      '8': 'DELAPAN',
      '9': 'SEMBILAN'
    };

    const spokenNumbers = numbers
      .split('')
      .map(digit => digitMap[digit] || digit)
      .join(' ');

    // Format teks yang akan diucapkan
    const text = `NOMOR ANTRIAN ${spokenNumbers} ATAS NAMA ${namaPasien} SILAHKAN MENUJU POLI ${namaPoli}`;

    // Gunakan Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Bahasa Indonesia
      utterance.rate = 0.9; // Kecepatan bicara (0.1 - 10)
      utterance.pitch = 1; // Nada suara (0 - 2)
      utterance.volume = 1; // Volume (0 - 1)

      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Browser tidak mendukung Text-to-Speech');
    }
  };

  const handleCallPatient = async (patient: any) => {
    try {
      const res = await fetch('/api/antrian/poli/call-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rkm_medis: patient.no_rkm_medis,
          kd_poli: patient.kd_poli,
          petugas_nip: user.username || 'UNKNOWN',
          petugas_nama: user.full_name || 'UNKNOWN'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memanggil pasien');
      }

      // Mainkan suara panggilan
      speakQueueNumber(
        data.antrian.no_antrian,
        patient.nm_pasien,
        data.antrian.nm_poli
      );

      alert(`✓ Pasien berhasil dipanggil!\n\nNo. Antrian: ${data.antrian.no_antrian}\nNama: ${patient.nm_pasien}\nPoli: ${data.antrian.nm_poli}\n\nPasien akan muncul di display antrian.`);
    } catch (e) {
      alert(`✗ Gagal memanggil pasien:\n${e instanceof Error ? e.message : 'Terjadi kesalahan'}`);
    }
  };

  const handleChangeStatus = async (noRawat: string, newStatus: string) => {
    try {
      // Call API untuk update status ke database
      const res = await fetch('/api/rawat-jalan/update-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: noRawat, status: newStatus })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah status');
      }

      // Update local state setelah berhasil update ke database
      if (activeTab === 'poli-today') {
        setPoliToday((prev) =>
          prev.map((p) => (p.no_rawat === noRawat ? { ...p, stts: newStatus } : p))
        );
      } else {
        setRujukanInternal((prev) =>
          prev.map((r) => (r.no_rawat === noRawat ? { ...r, stts: newStatus } : r))
        );
      }

      setShowStatusDropdown(null);

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Status berhasil diubah menjadi: ${getStatusStyle(newStatus).dropdownLabel}`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#2563eb'
      });
    } catch (e) {
      await Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: 'Gagal mengubah status: ' + (e instanceof Error ? e.message : 'Terjadi kesalahan'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  React.useEffect(() => {
    if (activeTab === 'poli-today') {
      void loadPoliToday();
    } else {
      void loadRujukanInternal();
    }
  }, [activeTab, tglDari, tglSampai]);

  // Close filter dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  // Close status dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(null);
      }
    };

    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown]);

  // Close surat dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suratDropdownRef.current && !suratDropdownRef.current.contains(event.target as Node)) {
        setShowSuratDropdown(null);
      }
    };

    if (showSuratDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuratDropdown]);

  const filteredPoliToday = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let filtered = search
      ? poliToday.filter((p) => {
          const haystack = `${p.no_rkm_medis} ${p.nm_pasien} ${p.nm_dokter} ${p.nm_poli}`.toLowerCase();
          return haystack.includes(search);
        })
      : poliToday;

    // Sort: status "Belum" di atas, "Sudah" di bawah
    return filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
  }, [poliToday, searchText]);

  const filteredRujukanInternal = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let filtered = search
      ? rujukanInternal.filter((r) => {
          const haystack = `${r.no_rkm_medis} ${r.nm_pasien} ${r.nm_dokter} ${r.nm_poli}`.toLowerCase();
          return haystack.includes(search);
        })
      : rujukanInternal;

    // Sort: status "Belum" di atas, "Sudah" di bawah
    return filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
  }, [rujukanInternal, searchText]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            borderRadius: 8,
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 13,
            flexShrink: 0
          }}
        >
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        {/* Tab Segmented Control */}
        <div style={{
          display: 'inline-flex',
          background: '#f3f4f6',
          borderRadius: 12,
          padding: 4,
          gap: 4
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('poli-today')}
            style={{
              padding: '6px 24px',
              borderRadius: 8,
              border: activeTab === 'poli-today' ? '1px solid #d1d5db' : 'none',
              background: activeTab === 'poli-today' ? '#ffffff' : 'transparent',
              color: activeTab === 'poli-today' ? '#111827' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'poli-today' ? 500 : 400,
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'poli-today' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Poli Hari Ini ({filteredPoliToday.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rujukan-internal')}
            style={{
              padding: '6px 24px',
              borderRadius: 8,
              border: activeTab === 'rujukan-internal' ? '1px solid #d1d5db' : 'none',
              background: activeTab === 'rujukan-internal' ? '#ffffff' : 'transparent',
              color: activeTab === 'rujukan-internal' ? '#111827' : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'rujukan-internal' ? 500 : 400,
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'rujukan-internal' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Rujukan Poli Internal ({filteredRujukanInternal.length})
          </button>
        </div>

        {/* Search box & Filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Cari No. RM / Nama / Dokter"
            style={{
              width: 250,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 12
            }}
          />

          {/* Filter Button with Dropdown */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>Filter</span>
              <span style={{ fontSize: 10 }}>▼</span>
            </button>

            {/* Dropdown Filter */}
            {showFilterDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  padding: 12,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <input
                  type="date"
                  value={tglDari}
                  onChange={(e) => setTglDari(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 12,
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="date"
                  value={tglSampai}
                  onChange={(e) => setTglSampai(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 12,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'poli-today' && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflow: 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12
            }}
          >
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Umur</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Cara Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoliToday.map((p, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: p.stts === 'Batal' ? '#fee2e2' : (p.stts === 'Sudah' ? '#ecfdf3' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb'))
                  }}
                >
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span
                      onClick={() => onSelectPatient(p)}
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 2,
                        border: '1px solid #2563eb',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 400,
                        fontSize: 11,
                        background: '#2563eb'
                      }}
                    >
                      {p.no_rkm_medis}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => handleCallPatient(p)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 2,
                        border: '1px solid #2563eb',
                        background: '#ffffff',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#2563eb';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.color = '#2563eb';
                      }}
                    >
                      {p.no_reg}
                    </button>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => {
                          if (showSuratDropdown === p.no_rawat) {
                            setShowSuratDropdown(null);
                            setSuratDropdownPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;

                            // Jika ruang di bawah kurang dari 250px, dropdown tampil dari bawah ke atas
                            if (spaceBelow < 250) {
                              setSuratDropdownPos({
                                top: rect.bottom,
                                left: rect.right + 8,
                                alignBottom: true
                              });
                            } else {
                              setSuratDropdownPos({
                                top: rect.top,
                                left: rect.right + 8,
                                alignBottom: false
                              });
                            }
                            setShowSuratDropdown(p.no_rawat);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 2,
                          border: '1px solid #2563eb',
                          background: '#ffffff',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2563eb';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.color = '#2563eb';
                        }}
                      >
                        {p.nm_dokter}
                        {showSuratDropdown === p.no_rawat ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                      {showSuratDropdown === p.no_rawat && suratDropdownPos && (
                        <div
                          ref={suratDropdownRef}
                          style={{
                            position: 'fixed',
                            top: suratDropdownPos.top,
                            left: suratDropdownPos.left,
                            transform: suratDropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 9999,
                            minWidth: 220
                          }}
                        >
                          {[
                            'Surat Keterangan Sakit',
                            'Surat Cuti',
                            'Surat Rujukan',
                            'Surat Keterangan Sehat',
                            'Surat Keterangan Rawat'
                          ].map((surat, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setShowSuratDropdown(null);
                                Swal.fire({
                                  icon: 'info',
                                  title: surat,
                                  text: `Fitur ${surat} untuk pasien ${p.nm_pasien} akan segera tersedia`,
                                  confirmButtonText: 'OK',
                                  confirmButtonColor: '#2563eb'
                                });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                background: 'transparent',
                                color: '#374151',
                                fontSize: 12,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.color = '#2563eb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#374151';
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                              <span>{surat}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_poli}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.umur}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.tgl_registrasi}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.jam_reg}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.png_jawab}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {p.no_rawat}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => {
                          if (showStatusDropdown === p.no_rawat) {
                            setShowStatusDropdown(null);
                            setStatusDropdownPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;

                            // Jika ruang di bawah kurang dari 200px, dropdown tampil dari bawah ke atas
                            if (spaceBelow < 200) {
                              setStatusDropdownPos({
                                top: rect.bottom,
                                left: rect.right,
                                alignBottom: true
                              });
                            } else {
                              setStatusDropdownPos({
                                top: rect.bottom + 4,
                                left: rect.right,
                                alignBottom: false
                              });
                            }
                            setShowStatusDropdown(p.no_rawat);
                          }
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: 'none',
                          background: getStatusStyle(p.stts).bg,
                          color: getStatusStyle(p.stts).color,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {getStatusStyle(p.stts).label}
                        {showStatusDropdown === p.no_rawat ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                      {showStatusDropdown === p.no_rawat && statusDropdownPos && (
                        <div
                          ref={statusDropdownRef}
                          style={{
                            position: 'fixed',
                            top: statusDropdownPos.top,
                            left: statusDropdownPos.left,
                            transform: statusDropdownPos.alignBottom ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 9999,
                            minWidth: 140
                          }}
                        >
                          {['Sudah', 'Belum', 'Batal', 'Dirujuk', 'Dirawat'].map((status) => (
                            <button
                              key={status}
                              onClick={() => handleChangeStatus(p.no_rawat, status)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: p.stts === status ? '#dbeafe' : 'transparent',
                                color: p.stts === status ? '#2563eb' : '#374151',
                                fontSize: 11,
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontWeight: p.stts === status ? 600 : 400
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.color = '#2563eb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = p.stts === status ? '#dbeafe' : 'transparent';
                                e.currentTarget.style.color = p.stts === status ? '#2563eb' : '#374151';
                              }}
                            >
                              {getStatusStyle(status).dropdownLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPoliToday.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      color: '#9ca3af',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    {loading ? 'Memuat data...' : 'Tidak ada data pasien poli hari ini'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'rujukan-internal' && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflow: 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12
            }}
          >
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli Tujuan</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Umur</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Cara Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRujukanInternal.map((r, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: r.stts === 'Batal' ? '#fee2e2' : (r.stts === 'Sudah' ? '#ecfdf3' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb'))
                  }}
                >
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span
                      onClick={() => onSelectPatient(r)}
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 2,
                        border: '1px solid #2563eb',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 400,
                        fontSize: 11,
                        background: '#2563eb'
                      }}
                    >
                      {r.no_rkm_medis}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.nm_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => {
                          if (showSuratDropdown === r.no_rawat) {
                            setShowSuratDropdown(null);
                            setSuratDropdownPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;

                            // Jika ruang di bawah kurang dari 250px, dropdown tampil dari bawah ke atas
                            if (spaceBelow < 250) {
                              setSuratDropdownPos({
                                top: rect.bottom,
                                left: rect.right + 8,
                                alignBottom: true
                              });
                            } else {
                              setSuratDropdownPos({
                                top: rect.top,
                                left: rect.right + 8,
                                alignBottom: false
                              });
                            }
                            setShowSuratDropdown(r.no_rawat);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 2,
                          border: '1px solid #2563eb',
                          background: '#ffffff',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2563eb';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.color = '#2563eb';
                        }}
                      >
                        {r.nm_dokter}
                        {showSuratDropdown === r.no_rawat ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                      {showSuratDropdown === r.no_rawat && suratDropdownPos && (
                        <div
                          ref={suratDropdownRef}
                          style={{
                            position: 'fixed',
                            top: suratDropdownPos.top,
                            left: suratDropdownPos.left,
                            transform: suratDropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 9999,
                            minWidth: 220
                          }}
                        >
                          {[
                            'Surat Keterangan Sakit',
                            'Surat Cuti',
                            'Surat Rujukan',
                            'Surat Keterangan Sehat',
                            'Surat Keterangan Rawat'
                          ].map((surat, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setShowSuratDropdown(null);
                                Swal.fire({
                                  icon: 'info',
                                  title: surat,
                                  text: `Fitur ${surat} untuk pasien ${r.nm_pasien} akan segera tersedia`,
                                  confirmButtonText: 'OK',
                                  confirmButtonColor: '#2563eb'
                                });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                background: 'transparent',
                                color: '#374151',
                                fontSize: 12,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.color = '#2563eb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#374151';
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                              <span>{surat}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.nm_poli}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.umur}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.tgl_registrasi}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.jam_reg}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.png_jawab}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {r.no_rawat}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => {
                          if (showStatusDropdown === r.no_rawat) {
                            setShowStatusDropdown(null);
                            setStatusDropdownPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;

                            // Jika ruang di bawah kurang dari 200px, dropdown tampil dari bawah ke atas
                            if (spaceBelow < 200) {
                              setStatusDropdownPos({
                                top: rect.bottom,
                                left: rect.right,
                                alignBottom: true
                              });
                            } else {
                              setStatusDropdownPos({
                                top: rect.bottom + 4,
                                left: rect.right,
                                alignBottom: false
                              });
                            }
                            setShowStatusDropdown(r.no_rawat);
                          }
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: 'none',
                          background: getStatusStyle(r.stts).bg,
                          color: getStatusStyle(r.stts).color,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {getStatusStyle(r.stts).label}
                        {showStatusDropdown === r.no_rawat ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                      {showStatusDropdown === r.no_rawat && statusDropdownPos && (
                        <div
                          ref={statusDropdownRef}
                          style={{
                            position: 'fixed',
                            top: statusDropdownPos.top,
                            left: statusDropdownPos.left,
                            transform: statusDropdownPos.alignBottom ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 9999,
                            minWidth: 140
                          }}
                        >
                          {['Sudah', 'Belum', 'Batal', 'Dirujuk', 'Dirawat'].map((status) => (
                            <button
                              key={status}
                              onClick={() => handleChangeStatus(r.no_rawat, status)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: r.stts === status ? '#dbeafe' : 'transparent',
                                color: r.stts === status ? '#2563eb' : '#374151',
                                fontSize: 11,
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontWeight: r.stts === status ? 600 : 400
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.color = '#2563eb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = r.stts === status ? '#dbeafe' : 'transparent';
                                e.currentTarget.style.color = r.stts === status ? '#2563eb' : '#374151';
                              }}
                            >
                              {getStatusStyle(status).dropdownLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRujukanInternal.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      color: '#9ca3af',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    {loading ? 'Memuat data...' : 'Tidak ada data rujukan internal hari ini'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
export const App: React.FC = () => {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [activeMenu, setActiveMenu] = React.useState<MenuKey>('menu-utama');
  const [health, setHealth] = React.useState<string>('Belum cek');
  const [loadingHealth, setLoadingHealth] = React.useState<boolean>(false);
  const [selectedPatientForExam, setSelectedPatientForExam] = React.useState<any | null>(null);
  const { isCompact } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = React.useState<boolean>(false);
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
    'rawat-jalan',
    'rawat-inap',
    'farmasi',
    'radiologi',
    'laboratorium',
    'jadwal-operasi',
    'casemix',
    'bridging'
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
    { key: 'igd', label: 'IGD', icon: '🚑' },
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
    const stored = window.localStorage.getItem('ermapp_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        setUser(parsed);
      } catch {
        window.localStorage.removeItem('ermapp_user');
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

  const handleLogin = (u: AppUser) => {
    setUser(u);
    window.localStorage.setItem('ermapp_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    window.localStorage.removeItem('ermapp_user');
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
    return <LoginView onLogin={handleLogin} />;
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
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>IGD</h2>
            <p style={{ color: '#6b7280' }}>Monitoring pasien IGD, triase, dan tindakan emergensi.</p>
          </section>
        );
      case 'rawat-jalan':
        return <RawatJalanView onSelectPatient={setSelectedPatientForExam} user={user} />;
      case 'rawat-inap':
        return <RawatInapView user={user} />;
      case 'farmasi':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Farmasi</h2>
            <p style={{ color: '#6b7280' }}>Pengelolaan stok obat, resep, dan distribusi ke unit.</p>
          </section>
        );
      case 'kasir':
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Kasir</h2>
            <p style={{ color: '#6b7280' }}>Billing pasien, pembayaran, dan rekapitulasi kas harian.</p>
          </section>
        );
      case 'casemix':
        return <CasemixView key={casemixResetKey} user={user} />;
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
        return <PegawaiView />;
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
        return (
          <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Jadwal Operasi</h2>
            <p style={{ color: '#6b7280' }}>Penjadwalan & manajemen operasi ruang OK</p>
          </section>
        );
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
        return <SatuSehatView />;
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
                        setActiveMenu('admin');
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

