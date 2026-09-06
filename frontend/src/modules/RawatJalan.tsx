import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { toSpokenCase } from '../utils/tts';
import type { AppUser } from './Auth';
import { ModalPengajuanSEP, type SepItem } from '../components/ModalPengajuanSEP';
import { HistoriPelayananBpjsModal } from '../components/HistoriPelayananBpjsModal';
import { SepPrintView } from '../components/SepPrintView';

// Dipindah dari App.tsx (sebelumnya didefinisikan inline di sana dengan
// nama sama, sementara file ini sempat jadi versi lama yang tidak
// pernah di-import) — sekarang inilah implementasi aktif yang dipakai
// menu "Rawat Jalan" di App.tsx.
type RawatJalanViewProps = {
  onSelectPatient: (patient: any) => void;
  user: AppUser;
};

export const RawatJalanView: React.FC<RawatJalanViewProps> = ({ onSelectPatient, user }) => {
  // Role "dokter" -> Daftar Pasien Poli DIKUNCI ke kd_dokter akun ini
  // (app_users.kd_dokter, di-link admin lewat Pengaturan > User), tidak
  // bisa diganti ke "Semua Dokter"/dokter lain lewat dropdown. Kalau akun
  // belum di-link (kd_dokter kosong), daftar pasien SENGAJA dikosongkan
  // (bukan fallback ke semua pasien) supaya kesalahan link ketahuan cepat
  // alih-alih diam-diam bocor menampilkan pasien dokter lain.
  const isDokterLocked = user.role === 'dokter';
  const lockedKdDokter = user.kd_dokter || '';
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

  // Filter Poliklinik & Dokter — opsi diambil dari endpoint master yang
  // sudah ada (/api/pendaftaran/poli, /api/dokter), difilter di sisi
  // klien berdasarkan kd_poli/kd_dokter yang sudah ada di respons
  // poli-today & rujukan-internal.
  const [filterPoli, setFilterPoli] = React.useState<string>('');
  const [filterDokter, setFilterDokter] = React.useState<string>('');
  const [poliOptions, setPoliOptions] = React.useState<{ kd_poli: string; nm_poli: string }[]>([]);
  const [dokterOptions, setDokterOptions] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);

  // Card Daftar Poliklinik — flyout terpisah dari card Filter, dibuka di
  // sebelah kiri card Filter (bukan native <select>), sama pola posisi
  // rect-based dgn card Filter itu sendiri.
  const [showPoliCard, setShowPoliCard] = React.useState<boolean>(false);
  const [poliCardPos, setPoliCardPos] = React.useState<{ top: number; left: number } | null>(null);
  const poliCardRef = React.useRef<HTMLDivElement>(null);

  // Card Daftar Dokter — pola identik dgn card Poliklinik di atas.
  const [showDokterCard, setShowDokterCard] = React.useState<boolean>(false);
  const [dokterCardPos, setDokterCardPos] = React.useState<{ top: number; left: number } | null>(null);
  const dokterCardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch('/api/pendaftaran/poli')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPoliOptions(Array.isArray(data) ? data : []))
      .catch(() => setPoliOptions([]));
    fetch('/api/dokter')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDokterOptions(Array.isArray(data) ? data : []))
      .catch(() => setDokterOptions([]));
  }, []);
  const [showStatusDropdown, setShowStatusDropdown] = React.useState<string | null>(null);
  const [showSuratDropdown, setShowSuratDropdown] = React.useState<string | null>(null);
  const [suratDropdownPos, setSuratDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const [statusDropdownPos, setStatusDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = React.useState<{ top: number; left: number } | null>(null);

  const filterDropdownRef = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const suratDropdownRef = React.useRef<HTMLDivElement>(null);

  // Kolom Cara Bayar — pola persis dgn kolom Jenis Bayar di Registrasi.tsx
  // & IGDK.tsx: kalau png_jawab === 'BPJS', tampilkan tombol dropdown
  // [BPJS] > Pembuatan SEP / Riwayat Kunjungan (+ ikon "Lihat SEP" kalau
  // no_sep sudah terisi); selain itu teks biasa.
  const [showBpjsDropdown, setShowBpjsDropdown] = React.useState<string | null>(null);
  const [bpjsDropdownPos, setBpjsDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const bpjsDropdownRef = React.useRef<HTMLDivElement>(null);
  const [historiPelayananPatient, setHistoriPelayananPatient] = React.useState<any | null>(null);
  const [sepPrintNoRawat, setSepPrintNoRawat] = React.useState<string | null>(null);
  const [sepModal, setSepModal] = React.useState<{ mode: 'new'; initialData: Partial<SepItem> } | { mode: 'edit'; item: SepItem } | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bpjsDropdownRef.current && !bpjsDropdownRef.current.contains(event.target as Node)) {
        setShowBpjsDropdown(null);
      }
    };
    if (showBpjsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBpjsDropdown]);

  // handleOpenSep — persis pola Registrasi.tsx/IGDK.tsx: kalau kunjungan
  // ini sudah punya SEP (patient.no_sep terisi), buka ModalPengajuanSEP
  // mode Update dgn data lengkap (di-fetch dulu by no_rawat). Kalau belum,
  // buka mode Input baru, prefill dari baris + mapping DPJP BPJS.
  const handleOpenSep = async (patient: any) => {
    setShowBpjsDropdown(null);
    Swal.fire({ title: 'Memuat data SEP...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      if (patient.no_sep) {
        const res = await fetch(`/api/bridging/sep/by-no-rawat/${encodeURIComponent(patient.no_rawat)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengambil data SEP');
        Swal.close();
        setSepModal({ mode: 'edit', item: data });
        return;
      }

      let kdpolitujuan = '';
      let nmpolitujuan = '';
      try {
        const mapPoliRes = await fetch(`/api/bpjs/mapping-poli?q=${encodeURIComponent(patient.kd_poli)}`);
        if (mapPoliRes.ok) {
          const mapPoliData = await mapPoliRes.json();
          const match = (mapPoliData?.list || []).find((m: any) => m.kd_poli === patient.kd_poli);
          if (match) {
            kdpolitujuan = match.kd_poli_bpjs || '';
            nmpolitujuan = match.nm_poli_bpjs || '';
          }
        }
      } catch {
        // Mapping opsional — kalau gagal diambil, staf tetap bisa isi manual.
      }

      let kddpjp = '';
      let nmdpdjp = '';
      try {
        const mapDokterRes = await fetch(`/api/bpjs/mapping-dokter?q=${encodeURIComponent(patient.kd_dokter)}`);
        if (mapDokterRes.ok) {
          const mapDokterData = await mapDokterRes.json();
          const match = (mapDokterData?.list || []).find((m: any) => m.kd_dokter === patient.kd_dokter);
          if (match) {
            kddpjp = match.kd_dokter_bpjs || '';
            nmdpdjp = match.nm_dokter_bpjs || '';
          }
        }
      } catch {
        // Mapping opsional — kalau gagal diambil, staf tetap bisa isi manual.
      }

      Swal.close();
      setSepModal({
        mode: 'new',
        initialData: {
          no_rawat: patient.no_rawat,
          nomr: patient.no_rkm_medis,
          nama_pasien: patient.nm_pasien,
          jkel: patient.jk,
          no_kartu: patient.no_kartu || '',
          notelep: patient.no_tlp || '',
          jnspelayanan: '2',
          kdpolitujuan,
          nmpolitujuan,
          kddpjp,
          nmdpdjp,
        },
      });
    } catch (err) {
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const loadPoliToday = async () => {
    setLoading(true);
    setError(null);
    try {
      // kd_dokter — dikirim HANYA saat role dokter (isDokterLocked), walau
      // lockedKdDokter kosong (akun blm di-link), supaya server yg filter
      // (lebih cepat drpd download semua pasien poli se-RS lalu disaring
      // di sini kayak sebelumnya — lihat filteredPoliToday di bawah, yg
      // tetap dipertahankan sbg lapisan aman kedua).
      let url = `/api/rawat-jalan/poli-today?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (isDokterLocked) {
        url += `&kd_dokter=${encodeURIComponent(lockedKdDokter)}`;
      }
      const res = await fetch(url);
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
      let url = `/api/rawat-jalan/rujukan-internal?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (isDokterLocked) {
        url += `&kd_dokter=${encodeURIComponent(lockedKdDokter)}`;
      }
      const res = await fetch(url);
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
      const utterance = new SpeechSynthesisUtterance(toSpokenCase(text));
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

  // Auto-refresh tiap 30 detik — supaya pasien baru yang mendaftar
  // sementara layar ini terbuka langsung kelihatan tanpa perlu ganti
  // filter/reload manual. Interval di-reset tiap activeTab/tglDari/
  // tglSampai berubah (deps sama dgn efek load awal di atas) spy selalu
  // refresh tab & rentang tanggal yg sedang aktif, bukan closure basi.
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'poli-today') {
        void loadPoliToday();
      } else {
        void loadRujukanInternal();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, tglDari, tglSampai]);

  // Close filter dropdown when clicking outside — card poliklinik
  // di-portal ke document.body (supaya tidak ketimpa transform milik
  // panel ini, lihat poliCardRef), jadi juga dianggap "di dalam" di sini.
  // Kalau tidak, mousedown di card poliklinik dianggap "di luar", panel
  // ini keburu unmount sebelum event click sampai ke tombol poli.
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideFilter = filterDropdownRef.current && filterDropdownRef.current.contains(target);
      const insidePoliCard = poliCardRef.current && poliCardRef.current.contains(target);
      const insideDokterCard = dokterCardRef.current && dokterCardRef.current.contains(target);
      if (!insideFilter && !insidePoliCard && !insideDokterCard) {
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

  // Close poli card when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (poliCardRef.current && !poliCardRef.current.contains(event.target as Node)) {
        setShowPoliCard(false);
      }
    };

    if (showPoliCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPoliCard]);

  // Close dokter card when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dokterCardRef.current && !dokterCardRef.current.contains(event.target as Node)) {
        setShowDokterCard(false);
      }
    };

    if (showDokterCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDokterCard]);

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

    if (filterPoli) filtered = filtered.filter((p) => p.kd_poli === filterPoli);
    if (isDokterLocked) {
      filtered = lockedKdDokter ? filtered.filter((p) => p.kd_dokter === lockedKdDokter) : [];
    } else if (filterDokter) {
      filtered = filtered.filter((p) => p.kd_dokter === filterDokter);
    }

    // Sort: status "Belum" di atas, "Sudah" di bawah
    return filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
  }, [poliToday, searchText, filterPoli, filterDokter, isDokterLocked, lockedKdDokter]);

  const filteredRujukanInternal = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let filtered = search
      ? rujukanInternal.filter((r) => {
          const haystack = `${r.no_rkm_medis} ${r.nm_pasien} ${r.nm_dokter} ${r.nm_poli}`.toLowerCase();
          return haystack.includes(search);
        })
      : rujukanInternal;

    if (filterPoli) filtered = filtered.filter((r) => r.kd_poli === filterPoli);
    if (isDokterLocked) {
      filtered = lockedKdDokter ? filtered.filter((r) => r.kd_dokter === lockedKdDokter) : [];
    } else if (filterDokter) {
      filtered = filtered.filter((r) => r.kd_dokter === filterDokter);
    }

    // Sort: status "Belum" di atas, "Sudah" di bawah
    return filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
  }, [rujukanInternal, searchText, filterPoli, filterDokter, isDokterLocked, lockedKdDokter]);

  return (
    <>
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
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', display: 'flex', alignItems: 'center'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Cari No. RM / Nama / Dokter"
              style={{
                width: 250,
                padding: '6px 12px 6px 32px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filter Button with Dropdown */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={(e) => {
                if (showFilterDropdown) {
                  setShowFilterDropdown(false);
                  setFilterDropdownPos(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setFilterDropdownPos({ top: rect.bottom + 4, left: rect.right });
                  setShowFilterDropdown(true);
                }
              }}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M10 8L20 8" stroke="currentColor" strokeLinecap="round" />
                <path d="M4 16L14 16" stroke="currentColor" strokeLinecap="round" />
                <ellipse cx="7" cy="8" rx="3" ry="3" transform="rotate(90 7 8)" stroke="currentColor" strokeLinecap="round" />
                <ellipse cx="17" cy="16" rx="3" ry="3" transform="rotate(90 17 16)" stroke="currentColor" strokeLinecap="round" />
              </svg>
            </button>

            {/* Dropdown Filter — posisi dihitung dari rect tombol (sama
                pola dgn Status/Surat dropdown di tabel), diarahkan ke kiri
                lewat translateX(-100%) supaya sisi kanan panel sejajar
                dgn sisi kanan tombol Filter, bukan meluber ke kanan. */}
            {showFilterDropdown && filterDropdownPos && (
              <div
                style={{
                  position: 'fixed',
                  top: filterDropdownPos.top,
                  left: filterDropdownPos.left,
                  transform: 'translateX(-100%)',
                  padding: 8,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: 140,
                  colorScheme: 'light'
                }}
              >
                <input
                  type="date"
                  value={tglDari}
                  onChange={(e) => setTglDari(e.target.value)}
                  style={{
                    width: '100%',
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
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 12,
                    boxSizing: 'border-box'
                  }}
                />
                {/* Poliklinik — bukan native <select>, tapi tombol yang
                    membuka card terpisah (poliCardRef) di sebelah kiri
                    card Filter ini, sama pola rect-based dgn card Filter
                    sendiri. */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (showPoliCard) {
                      setShowPoliCard(false);
                      setPoliCardPos(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPoliCardPos({ top: rect.top, left: rect.left - 8 });
                      setShowPoliCard(true);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px 6px 22px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    fontSize: 12,
                    boxSizing: 'border-box',
                    color: filterPoli ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'left',
                    position: 'relative'
                  }}
                >
                  {/* Panah — mengarah ke bawah saat tertutup, berputar ke
                      kiri (rotate 90deg) saat card terbuka, nempel di kiri
                      tombol sama seperti panah select Dokter. */}
                  <svg
                    width="10" height="6" viewBox="0 0 10 6" fill="none"
                    stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      position: 'absolute', left: 8, top: '50%',
                      transform: showPoliCard ? 'translateY(-50%) rotate(90deg)' : 'translateY(-50%) rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <path d="M1 1L5 5L9 1"></path>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filterPoli ? (poliOptions.find((p) => p.kd_poli === filterPoli)?.nm_poli || 'Poliklinik') : 'Semua Poliklinik'}
                  </span>
                </button>

                {showPoliCard && poliCardPos && createPortal(
                  <div
                    ref={poliCardRef}
                    style={{
                      position: 'fixed',
                      top: poliCardPos.top,
                      left: poliCardPos.left,
                      transform: 'translateX(-100%)',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                      width: 220,
                      maxHeight: 260,
                      overflowY: 'auto',
                      colorScheme: 'light'
                    }}
                  >
                    <button
                      onClick={() => { setFilterPoli(''); setShowPoliCard(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: filterPoli === '' ? '#dbeafe' : 'transparent',
                        color: filterPoli === '' ? '#2563eb' : '#374151',
                        fontSize: 11,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontWeight: filterPoli === '' ? 600 : 400
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dbeafe';
                        e.currentTarget.style.color = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = filterPoli === '' ? '#dbeafe' : 'transparent';
                        e.currentTarget.style.color = filterPoli === '' ? '#2563eb' : '#374151';
                      }}
                    >
                      Semua Poliklinik
                    </button>
                    {poliOptions.map((p) => (
                      <button
                        key={p.kd_poli}
                        onClick={() => { setFilterPoli(p.kd_poli); setShowPoliCard(false); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '4px 12px',
                          border: 'none',
                          background: filterPoli === p.kd_poli ? '#dbeafe' : 'transparent',
                          color: filterPoli === p.kd_poli ? '#2563eb' : '#374151',
                          fontSize: 11,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: filterPoli === p.kd_poli ? 600 : 400
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                          e.currentTarget.style.color = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = filterPoli === p.kd_poli ? '#dbeafe' : 'transparent';
                          e.currentTarget.style.color = filterPoli === p.kd_poli ? '#2563eb' : '#374151';
                        }}
                      >
                        {p.nm_poli}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
                {/* Dokter — pola identik dgn tombol+card Poliklinik di atas,
                    KECUALI kalau role='dokter': dropdown dikunci, cuma
                    menampilkan badge non-interaktif nama dokter itu sendiri
                    (atau peringatan kalau akunnya belum di-link admin ke
                    kd_dokter manapun). Lihat isDokterLocked di atas. */}
                {isDokterLocked ? (
                  <div
                    title={lockedKdDokter ? 'Daftar Pasien Poli dikunci ke akun dokter yang login' : 'Akun ini belum di-link ke kode dokter manapun — hubungi admin (Pengaturan > User)'}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: `1px solid ${lockedKdDokter ? '#d1d5db' : '#fecaca'}`,
                      background: lockedKdDokter ? '#f9fafb' : '#fef2f2',
                      fontSize: 12,
                      boxSizing: 'border-box',
                      color: lockedKdDokter ? '#111827' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      overflow: 'hidden'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lockedKdDokter
                        ? (dokterOptions.find((d) => d.kd_dokter === lockedKdDokter)?.nm_dokter || user.full_name)
                        : 'Belum di-link ke dokter'}
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (showDokterCard) {
                          setShowDokterCard(false);
                          setDokterCardPos(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDokterCardPos({ top: rect.top, left: rect.left - 8 });
                          setShowDokterCard(true);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px 6px 22px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        fontSize: 12,
                        boxSizing: 'border-box',
                        color: filterDokter ? '#111827' : '#6b7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        textAlign: 'left',
                        position: 'relative'
                      }}
                    >
                      <svg
                        width="10" height="6" viewBox="0 0 10 6" fill="none"
                        stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{
                          position: 'absolute', left: 8, top: '50%',
                          transform: showDokterCard ? 'translateY(-50%) rotate(90deg)' : 'translateY(-50%) rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <path d="M1 1L5 5L9 1"></path>
                      </svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {filterDokter ? (dokterOptions.find((d) => d.kd_dokter === filterDokter)?.nm_dokter || 'Dokter') : 'Semua Dokter'}
                      </span>
                    </button>

                    {showDokterCard && dokterCardPos && createPortal(
                      <div
                        ref={dokterCardRef}
                        style={{
                          position: 'fixed',
                          top: dokterCardPos.top,
                          left: dokterCardPos.left,
                          transform: 'translateX(-100%)',
                          background: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 9999,
                          width: 220,
                          maxHeight: 260,
                          overflowY: 'auto',
                          colorScheme: 'light'
                        }}
                      >
                        <button
                          onClick={() => { setFilterDokter(''); setShowDokterCard(false); }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: filterDokter === '' ? '#dbeafe' : 'transparent',
                            color: filterDokter === '' ? '#2563eb' : '#374151',
                            fontSize: 11,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontWeight: filterDokter === '' ? 600 : 400
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dbeafe';
                            e.currentTarget.style.color = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = filterDokter === '' ? '#dbeafe' : 'transparent';
                            e.currentTarget.style.color = filterDokter === '' ? '#2563eb' : '#374151';
                          }}
                        >
                          Semua Dokter
                        </button>
                        {dokterOptions.map((d) => (
                          <button
                            key={d.kd_dokter}
                            onClick={() => { setFilterDokter(d.kd_dokter); setShowDokterCard(false); }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '4px 12px',
                              border: 'none',
                              background: filterDokter === d.kd_dokter ? '#dbeafe' : 'transparent',
                              color: filterDokter === d.kd_dokter ? '#2563eb' : '#374151',
                              fontSize: 11,
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontWeight: filterDokter === d.kd_dokter ? 600 : 400
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dbeafe';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = filterDokter === d.kd_dokter ? '#dbeafe' : 'transparent';
                              e.currentTarget.style.color = filterDokter === d.kd_dokter ? '#2563eb' : '#374151';
                            }}
                          >
                            {d.nm_dokter}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </>
                )}
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
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    {p.png_jawab === 'BPJS' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={(e) => {
                            if (showBpjsDropdown === p.no_rawat) {
                              setShowBpjsDropdown(null);
                              setBpjsDropdownPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              if (spaceBelow < 150) {
                                setBpjsDropdownPos({ top: rect.top, left: rect.left, alignBottom: true });
                              } else {
                                setBpjsDropdownPos({ top: rect.bottom, left: rect.left, alignBottom: false });
                              }
                              setShowBpjsDropdown(p.no_rawat);
                            }
                          }}
                          style={{
                            padding: '4px 8px', borderRadius: 2, border: '1px solid #2563eb',
                            background: '#ffffff', color: '#2563eb', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#2563eb'; }}
                        >
                          BPJS
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                        {showBpjsDropdown === p.no_rawat && bpjsDropdownPos && (
                          <div
                            ref={bpjsDropdownRef}
                            style={{
                              position: 'fixed', top: bpjsDropdownPos.top, left: bpjsDropdownPos.left,
                              transform: bpjsDropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                              background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9999, minWidth: 180,
                            }}
                          >
                            <button
                              onClick={() => handleOpenSep(p)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 9V2h12v7"></path>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                              </svg>
                              <span>Pembuatan SEP</span>
                            </button>
                            <button
                              onClick={() => { setShowBpjsDropdown(null); setHistoriPelayananPatient(p); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                                <path d="M12 7v5l4 2"></path>
                              </svg>
                              <span>Riwayat Kunjungan</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {p.no_sep && (
                        <button
                          onClick={() => setSepPrintNoRawat(p.no_rawat)}
                          title="Lihat SEP"
                          style={{
                            padding: '4px 8px', borderRadius: 2, border: '1px solid #16a34a',
                            background: '#ffffff', color: '#16a34a', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#16a34a'; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                      )}
                      </div>
                    ) : (
                      p.png_jawab || '-'
                    )}
                  </td>
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
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    {r.png_jawab === 'BPJS' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={(e) => {
                            if (showBpjsDropdown === r.no_rawat) {
                              setShowBpjsDropdown(null);
                              setBpjsDropdownPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              if (spaceBelow < 150) {
                                setBpjsDropdownPos({ top: rect.top, left: rect.left, alignBottom: true });
                              } else {
                                setBpjsDropdownPos({ top: rect.bottom, left: rect.left, alignBottom: false });
                              }
                              setShowBpjsDropdown(r.no_rawat);
                            }
                          }}
                          style={{
                            padding: '4px 8px', borderRadius: 2, border: '1px solid #2563eb',
                            background: '#ffffff', color: '#2563eb', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#2563eb'; }}
                        >
                          BPJS
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                        {showBpjsDropdown === r.no_rawat && bpjsDropdownPos && (
                          <div
                            ref={bpjsDropdownRef}
                            style={{
                              position: 'fixed', top: bpjsDropdownPos.top, left: bpjsDropdownPos.left,
                              transform: bpjsDropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                              background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9999, minWidth: 180,
                            }}
                          >
                            <button
                              onClick={() => handleOpenSep(r)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 9V2h12v7"></path>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                              </svg>
                              <span>Pembuatan SEP</span>
                            </button>
                            <button
                              onClick={() => { setShowBpjsDropdown(null); setHistoriPelayananPatient(r); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                                <path d="M12 7v5l4 2"></path>
                              </svg>
                              <span>Riwayat Kunjungan</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {r.no_sep && (
                        <button
                          onClick={() => setSepPrintNoRawat(r.no_rawat)}
                          title="Lihat SEP"
                          style={{
                            padding: '4px 8px', borderRadius: 2, border: '1px solid #16a34a',
                            background: '#ffffff', color: '#16a34a', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#16a34a'; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                      )}
                      </div>
                    ) : (
                      r.png_jawab || '-'
                    )}
                  </td>
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

    {historiPelayananPatient && (
      <HistoriPelayananBpjsModal
        noKartu={historiPelayananPatient.no_kartu || ''}
        namaPasien={historiPelayananPatient.nm_pasien}
        onClose={() => setHistoriPelayananPatient(null)}
      />
    )}
    {sepModal && (
      <ModalPengajuanSEP
        editingItem={sepModal.mode === 'edit' ? sepModal.item : null}
        initialData={sepModal.mode === 'new' ? sepModal.initialData : undefined}
        onClose={() => setSepModal(null)}
        onSaved={() => { if (activeTab === 'poli-today') { void loadPoliToday(); } else { void loadRujukanInternal(); } }}
      />
    )}
    {sepPrintNoRawat && (
      <SepPrintView noRawat={sepPrintNoRawat} onClose={() => setSepPrintNoRawat(null)} />
    )}
    </>
  );
};
