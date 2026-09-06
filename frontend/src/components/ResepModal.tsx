import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { ModalCariDokter } from './ModalCariDokter';
import './ResepModal.css';

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTimeStr = (d = new Date()) => d.toTimeString().slice(0, 8);

type ResepModalProps = {
  patient: any;
  onClose: () => void;
  onResepSaved?: (planningText: string) => void; // Callback untuk update planning setelah simpan resep
  isRanap?: boolean;   // true = pasien rawat inap, simpan ke resep_obat+detail_pemberian_obat
  editResep?: { no_resep: string; items: any[]; racikan?: any[] }; // pre-fill untuk edit resep yang sudah ada
};

type ObatItem = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  stok: number;
  harga: number;
  jenis_obat?: string;
  nama_industri?: string;
  kapasitas?: string;
  jml?: number;
  aturan_pakai?: string;
  kandungan?: string;
  // ranap fields
  h_beli?: number;
  no_batch?: string;
  no_faktur?: string;
};

type RacikanDetail = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  kapasitas: string;
  kandungan: string;
  jml: number;
};

type Racikan = {
  nama_racikan: string;
  keterangan: string;
  metode_racik: string;
  jml_dr: number;
  aturan_pakai: string;
  detail: RacikanDetail[];
};

// Input inline tabel master racikan — tanpa garis tabel (borderless), cuma
// border tipis di tiap input sendiri, padanan gaya screenshot yang
// diminta user (beda dari tabel Bootstrap `table-bordered` yang dipakai
// tabel lain di modal ini).
const racikanInputStyle: React.CSSProperties = {
  width: '100%',
  height: 30,
  padding: '5px 10px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
};

export const ResepModal: React.FC<ResepModalProps> = ({ patient, onClose, onResepSaved, isRanap = false, editResep }) => {
  // visible — animasi slide-in dari kanan, persis pola mounted/visible di
  // ModalInputTriase.tsx/ModalInputAwalMedisIGD.tsx. Bedanya modal ini
  // di-mount/unmount langsung oleh parent (`{showResepModal && <ResepModal.../>}`,
  // BUKAN via prop isOpen), jadi cuma animasi masuk yg dipakai (tanpa
  // animasi keluar 300ms spt Triase/Awal Medis — parent langsung unmount).
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const [activeResepTab, setActiveResepTab] = React.useState<'non-racikan' | 'racikan'>('non-racikan');

  // Header Tgl.Resep/Jam/Peresep/No.Resep — KHUSUS isRanap, fully editable
  // PERSIS Java (per permintaan user): user boleh ganti tanggal/jam resep
  // & dokter peresep (beda dari DPJP kunjungan), No.Resep di-preview LIVE
  // dari backend (GET /api/resep-ranap/next-no) tiap Tgl.Resep berubah.
  const [resepTgl, setResepTgl] = React.useState(() => localDateStr());
  const [resepJam, setResepJam] = React.useState(() => localTimeStr());
  const [resepUseAutoTime, setResepUseAutoTime] = React.useState(true);
  const [resepDokterKode, setResepDokterKode] = React.useState('');
  const [resepDokterNama, setResepDokterNama] = React.useState('');
  const [showCariDokterResep, setShowCariDokterResep] = React.useState(false);
  const [previewNoResep, setPreviewNoResep] = React.useState('');
  // noResepAuto — checkbox ChkRM di DlgPeresepanDokter.java (dicek langsung
  // dari source Java, /Users/firdaus/SIMRS-Khanza): default TRUE (checked)
  // = No.Resep auto-generate & read-only, di-refresh tiap Tgl.Resep ganti
  // (ChkRMItemStateChanged + emptTeksobat()). Dimatikan = No.Resep
  // dikosongkan & jadi editable manual (NoResep.setEditable(true) di Java).
  // Peresep TIDAK terikat checkbox ini — di Java selalu auto-isi dari
  // dpjp_ranap→reg_periksa.kd_dokter tanpa syarat (setNoRm()), field-nya
  // memang selalu read-only, cuma bisa diganti lewat tombol cari dokter.
  const [noResepAuto, setNoResepAuto] = React.useState(true);
  const [manualNoResep, setManualNoResep] = React.useState('');

  React.useEffect(() => {
    if (!isRanap) return;
    setResepDokterKode(patient.kd_dokter || '');
    setResepDokterNama(patient.nm_dokter || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRanap]);

  // Auto-time tick — sama pola dgn Tgl/Jam SOAP di PemeriksaanRanap.tsx.
  React.useEffect(() => {
    if (!isRanap || !resepUseAutoTime) return;
    const tick = setInterval(() => {
      const now = new Date();
      setResepTgl(localDateStr(now));
      setResepJam(localTimeStr(now));
    }, 1000);
    return () => clearInterval(tick);
  }, [isRanap, resepUseAutoTime]);

  // Preview No.Resep berikutnya, refetch tiap Tgl.Resep berganti.
  React.useEffect(() => {
    if (!isRanap) return;
    fetch(`/api/resep-ranap/next-no?tanggal=${encodeURIComponent(resepTgl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPreviewNoResep(data?.no_resep || ''))
      .catch(() => setPreviewNoResep(''));
  }, [isRanap, resepTgl]);

  // Non Racikan State
  const searchObatNonRacikanRef = React.useRef<HTMLInputElement>(null);
  const nonRacikanSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  // Ref ke dropdown hasil pencarian (di-portal ke document.body, jadi klik di
  // dalamnya TIDAK otomatis dianggap "di dalam wrapper" oleh DOM biasa) —
  // dipakai handler klik-di-luar di bawah supaya klik di dalam dropdown
  // sendiri tidak ikut menutupnya.
  const nonRacikanDropdownRef = React.useRef<HTMLDivElement>(null);
  const [nonRacikanDropdownPos, setNonRacikanDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [searchObatNonRacikan, setSearchObatNonRacikan] = React.useState('');
  const [obatList, setObatList] = React.useState<ObatItem[]>([]);
  const [showObatDropdown, setShowObatDropdown] = React.useState(false);
  const [resepNonRacikan, setResepNonRacikan] = React.useState<ObatItem[]>([]);
  const [selectedObatNonRacikan, setSelectedObatNonRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObat, setShowModalInputObat] = React.useState(false);

  // Racikan State
  const namaRacikanRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const racikanSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  // Sama spt nonRacikanDropdownRef di atas — ref ke dropdown (di-portal)
  // supaya klik di dalamnya tidak dianggap "di luar" & menutup dropdown.
  const racikanDropdownRef = React.useRef<HTMLDivElement>(null);
  const [racikanDropdownPos, setRacikanDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [searchObatRacikan, setSearchObatRacikan] = React.useState('');
  const [obatListRacikan, setObatListRacikan] = React.useState<ObatItem[]>([]);
  const [showObatDropdownRacikan, setShowObatDropdownRacikan] = React.useState(false);
  const [selectedObatRacikan, setSelectedObatRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObatRacikan, setShowModalInputObatRacikan] = React.useState(false);
  // emptyRacikanWarnIdx — index racikan yg kolom Nama Racikan-nya disorot
  // merah krn user coba klik langsung ke Detail Obat Racikan padahal nama
  // racikan masih kosong. Direset begitu user mulai mengetik nama racikan.
  const [emptyRacikanWarnIdx, setEmptyRacikanWarnIdx] = React.useState<number | null>(null);

  const [racikanList, setRacikanList] = React.useState<Racikan[]>([
    { nama_racikan: '', keterangan: '', metode_racik: '', jml_dr: 0, aturan_pakai: '', detail: [] }
  ]);
  const [activeRacikanIdx, setActiveRacikanIdx] = React.useState<number>(0);

  // Input Form State
  const [inputObatForm, setInputObatForm] = React.useState({
    jml: 1,
    aturan_pakai: ''
  });

  const [inputObatRacikanForm, setInputObatRacikanForm] = React.useState({
    kandungan: '',
    jml: 0
  });

  // Aturan Pakai History State (for Non-Racikan)
  const [aturanPakaiHistory, setAturanPakaiHistory] = React.useState<string[]>([]);
  const [showAturanPakaiDropdown, setShowAturanPakaiDropdown] = React.useState(false);
  const [filteredAturanPakai, setFilteredAturanPakai] = React.useState<string[]>([]);

  // Aturan Pakai History State (for Racikan)
  const [showAturanPakaiDropdownRacikan, setShowAturanPakaiDropdownRacikan] = React.useState(false);
  const [filteredAturanPakaiRacikan, setFilteredAturanPakaiRacikan] = React.useState<string[]>([]);

  // Nama Racikan History State
  const [namaRacikanHistory, setNamaRacikanHistory] = React.useState<string[]>([]);
  const [showNamaRacikanDropdown, setShowNamaRacikanDropdown] = React.useState(false);
  const [filteredNamaRacikan, setFilteredNamaRacikan] = React.useState<string[]>([]);

  // Keterangan Racikan History State
  const [keteranganHistory, setKeteranganHistory] = React.useState<string[]>([]);
  const [showKeteranganDropdown, setShowKeteranganDropdown] = React.useState(false);
  const [filteredKeterangan, setFilteredKeterangan] = React.useState<string[]>([]);

  // Posisikan dropdown pencarian obat sebagai overlay di depan modal (via portal),
  // dihitung dari posisi wrapper-nya agar lebar/ukurannya tidak tergantung ruang
  // yang tersisa di bagian bawah modal.
  React.useEffect(() => {
    if (!showObatDropdown) { setNonRacikanDropdownPos(null); return; }
    const updatePos = () => {
      const rect = nonRacikanSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setNonRacikanDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showObatDropdown]);

  React.useEffect(() => {
    if (!showObatDropdownRacikan) { setRacikanDropdownPos(null); return; }
    const updatePos = () => {
      const rect = racikanSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setRacikanDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showObatDropdownRacikan]);

  // Tutup dropdown pencarian obat saat klik di luar area combobox (wrapper
  // input MAUPUN dropdown-nya sendiri, yg di-portal ke document.body jadi
  // secara DOM bukan child dari wrapper). mousedown (bukan click) supaya
  // konsisten dgn dropdown Filter dkk di modul lain & tidak race dgn
  // onClick item combobox (yg pakai click biasa).
  React.useEffect(() => {
    if (!showObatDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = nonRacikanSearchWrapperRef.current?.contains(target);
      const insideDropdown = nonRacikanDropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) setShowObatDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showObatDropdown]);

  React.useEffect(() => {
    if (!showObatDropdownRacikan) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = racikanSearchWrapperRef.current?.contains(target);
      const insideDropdown = racikanDropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) setShowObatDropdownRacikan(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showObatDropdownRacikan]);

  // Riwayat Resep State
  const [showModalRiwayatResep, setShowModalRiwayatResep] = React.useState(false);
  // riwayatVisible — animasi slide-in dari KIRI (panel Riwayat Resep
  // ditempatkan di sisa ruang 50% sebelah kiri, berdampingan dgn panel
  // Resep yg sudah nempel di kanan), sama pola dgn `visible` di atas.
  const [riwayatVisible, setRiwayatVisible] = React.useState(false);
  React.useEffect(() => {
    if (showModalRiwayatResep) {
      const t = setTimeout(() => setRiwayatVisible(true), 10);
      return () => clearTimeout(t);
    }
    setRiwayatVisible(false);
  }, [showModalRiwayatResep]);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);

  // Pre-fill items saat mode edit resep yang sudah ada
  React.useEffect(() => {
    if (editResep && editResep.items && editResep.items.length > 0) {
      const prefilled = editResep.items.map((it: any) => ({
        kode_brng: it.kode_brng,
        nama_brng: it.nama_brng,
        kode_sat: it.kode_sat || '',
        stok: 0,
        harga: 0,
        jml: it.jml || 1,
        aturan_pakai: it.aturan || '',
        h_beli: 0,
        no_batch: '',
        no_faktur: '',
        kapasitas: '',
      }));
      setResepNonRacikan(prefilled);
    }
    if (editResep && editResep.racikan && editResep.racikan.length > 0) {
      const prefilledRacikan = editResep.racikan.map((rac: any) => ({
        nama_racikan: rac.nama_racik || '',
        keterangan: rac.keterangan || '',
        metode_racik: rac.metode_racik || '',
        jml_dr: rac.jml_dr || 1,
        aturan_pakai: rac.aturan_pakai || '',
        detail: (rac.detail || []).map((d: any) => ({
          kode_brng: d.kode_brng,
          nama_brng: d.nama_brng,
          kode_sat: d.kode_sat || '',
          kapasitas: '',
          kandungan: d.kandungan || '',
          jml: d.jml || 0,
        })),
      }));
      setRacikanList(prefilledRacikan);
      setActiveRacikanIdx(0);
    }
  }, []);

  // Load aturan pakai history from localStorage on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('aturan_pakai_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setAturanPakaiHistory(parsed);
      } catch (e) {
        console.error('Failed to parse aturan pakai history:', e);
      }
    }
  }, []);

  // Load nama racikan history from localStorage on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('nama_racikan_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setNamaRacikanHistory(parsed);
      } catch (e) {
        console.error('Failed to parse nama racikan history:', e);
      }
    }
  }, []);

  // Load keterangan history from localStorage on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('keterangan_racikan_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setKeteranganHistory(parsed);
      } catch (e) {
        console.error('Failed to parse keterangan history:', e);
      }
    }
  }, []);

  // Save aturan pakai to history
  const saveAturanPakaiToHistory = (aturanPakai: string) => {
    if (!aturanPakai.trim()) return;

    const trimmed = aturanPakai.trim();
    let newHistory = [...aturanPakaiHistory];

    // Remove if already exists
    newHistory = newHistory.filter(item => item !== trimmed);

    // Add to beginning
    newHistory.unshift(trimmed);

    // Keep only last 20 items
    newHistory = newHistory.slice(0, 20);

    setAturanPakaiHistory(newHistory);
    localStorage.setItem('aturan_pakai_history', JSON.stringify(newHistory));
  };

  // Filter aturan pakai based on input with smart prioritization
  const filterAturanPakai = (input: string) => {
    if (!input.trim()) {
      setFilteredAturanPakai(aturanPakaiHistory.slice(0, 10));
      return;
    }

    const lowerInput = input.toLowerCase().trim();

    // Separate into two groups: starts with input, and contains input
    const startsWith: string[] = [];
    const contains: string[] = [];

    aturanPakaiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });

    // Combine: prioritize starts with, then contains
    const filtered = [...startsWith, ...contains].slice(0, 10);

    setFilteredAturanPakai(filtered);
  };

  // Filter aturan pakai for Racikan with smart prioritization
  const filterAturanPakaiRacikan = (input: string) => {
    if (!input.trim()) {
      setFilteredAturanPakaiRacikan(aturanPakaiHistory.slice(0, 10));
      return;
    }

    const lowerInput = input.toLowerCase().trim();

    // Separate into two groups: starts with input, and contains input
    const startsWith: string[] = [];
    const contains: string[] = [];

    aturanPakaiHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });

    // Combine: prioritize starts with, then contains
    const filtered = [...startsWith, ...contains].slice(0, 10);

    setFilteredAturanPakaiRacikan(filtered);
  };

  // Save nama racikan to history
  const saveNamaRacikanToHistory = (namaRacikan: string) => {
    if (!namaRacikan.trim()) return;

    const trimmed = namaRacikan.trim();
    let newHistory = [...namaRacikanHistory];

    // Remove if already exists
    newHistory = newHistory.filter(item => item !== trimmed);

    // Add to beginning
    newHistory.unshift(trimmed);

    // Keep only last 20 items
    newHistory = newHistory.slice(0, 20);

    setNamaRacikanHistory(newHistory);
    localStorage.setItem('nama_racikan_history', JSON.stringify(newHistory));
  };

  // Filter nama racikan with smart prioritization
  const filterNamaRacikan = (input: string) => {
    if (!input.trim()) {
      setFilteredNamaRacikan(namaRacikanHistory.slice(0, 10));
      return;
    }

    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];

    namaRacikanHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });

    const filtered = [...startsWith, ...contains].slice(0, 10);
    setFilteredNamaRacikan(filtered);
  };

  // Save keterangan to history
  const saveKeteranganToHistory = (keterangan: string) => {
    if (!keterangan.trim()) return;

    const trimmed = keterangan.trim();
    let newHistory = [...keteranganHistory];

    // Remove if already exists
    newHistory = newHistory.filter(item => item !== trimmed);

    // Add to beginning
    newHistory.unshift(trimmed);

    // Keep only last 20 items
    newHistory = newHistory.slice(0, 20);

    setKeteranganHistory(newHistory);
    localStorage.setItem('keterangan_racikan_history', JSON.stringify(newHistory));
  };

  // Filter keterangan with smart prioritization
  const filterKeterangan = (input: string) => {
    if (!input.trim()) {
      setFilteredKeterangan(keteranganHistory.slice(0, 10));
      return;
    }

    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];

    keteranganHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });

    const filtered = [...startsWith, ...contains].slice(0, 10);
    setFilteredKeterangan(filtered);
  };

  // Auto-search effect for Non Racikan (instant)
  React.useEffect(() => {
    if (searchObatNonRacikan.trim().length >= 2) {
      cariObatNonRacikan();
    } else if (searchObatNonRacikan.trim().length === 0) {
      setObatList([]);
      setShowObatDropdown(false);
    }
  }, [searchObatNonRacikan]);

  // Auto-search effect for Racikan (instant)
  React.useEffect(() => {
    if (searchObatRacikan.trim().length >= 2) {
      cariObatRacikan();
    } else if (searchObatRacikan.trim().length === 0) {
      setObatListRacikan([]);
      setShowObatDropdownRacikan(false);
    }
  }, [searchObatRacikan]);

  // Fokus otomatis ke kolom Nama Racikan saat tab Racikan dibuka
  React.useEffect(() => {
    if (activeResepTab === 'racikan') {
      namaRacikanRefs.current[activeRacikanIdx]?.focus();
    }
  }, [activeResepTab]);

  // Format Rupiah
  const formatRupiah = (value: number): string => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format Date - Handle various date formats
  const formatTanggal = (dateStr: string): string => {
    if (!dateStr || dateStr === '0000-00-00') return '-';

    try {
      // Handle ISO 8601 format (2025-12-04T00:00:00+07:00)
      // Extract just the date part before 'T'
      let cleanDate = dateStr.split('T')[0];

      // Now split by '-'
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}-${month}-${year}`;
      }

      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  // Cari Obat Non Racikan
  const cariObatNonRacikan = async () => {
    if (!searchObatNonRacikan.trim()) {
      setObatList([]);
      setShowObatDropdown(false);
      return;
    }

    try {
      let data: ObatItem[];
      if (isRanap) {
        const url = `/api/resep-ranap/obat?search=${encodeURIComponent(searchObatNonRacikan)}&no_rawat=${encodeURIComponent(patient.no_rawat || '')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to search obat');
        const raw = await res.json();
        // Map ranap API response ke ObatItem
        data = (raw || []).map((o: any) => ({
          kode_brng: o.kode_brng,
          nama_brng: o.nama_brng,
          kode_sat: o.kode_sat,
          stok: o.stok,
          harga: o.harga_jual,
          h_beli: o.h_beli,
          no_batch: o.no_batch,
          no_faktur: o.no_faktur,
          kapasitas: String(o.kapasitas ?? ''),
        }));
      } else {
        const response = await fetch(`/api/obat/search?query=${encodeURIComponent(searchObatNonRacikan)}&no_rawat=${encodeURIComponent(patient.no_rawat || '')}`);
        if (!response.ok) throw new Error('Failed to search obat');
        data = await response.json() || [];
      }
      setObatList(data);
      setShowObatDropdown(true);
    } catch (error) {
      console.error('Error searching obat:', error);
      setObatList([]);
      setShowObatDropdown(false);
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: 'Gagal mencari obat'
      });
    }
  };

  // Pilih Obat Non Racikan
  const pilihObatNonRacikan = (obat: ObatItem) => {
    if (obat.stok <= 0) {
      Swal.fire({ icon: 'warning', title: 'Stok Obat saat ini tidak tersedia' });
      return;
    }
    setSelectedObatNonRacikan(obat);
    setShowObatDropdown(false);
    setShowModalInputObat(true);
    setInputObatForm({
      jml: 1,
      aturan_pakai: ''
    });
  };

  // Close Modal Input Obat
  const closeModalInputObat = () => {
    setShowModalInputObat(false);
    setSelectedObatNonRacikan(null);
    setInputObatForm({
      jml: 1,
      aturan_pakai: ''
    });
  };

  // Confirm Tambah Obat
  const confirmTambahObat = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedObatNonRacikan) return;

    // Save aturan pakai to history
    if (inputObatForm.aturan_pakai.trim()) {
      saveAturanPakaiToHistory(inputObatForm.aturan_pakai);
    }

    const newObat: ObatItem = {
      ...selectedObatNonRacikan,
      jml: inputObatForm.jml,
      aturan_pakai: inputObatForm.aturan_pakai
    };

    setResepNonRacikan(prev => [...prev, newObat]);
    closeModalInputObat();
    setSearchObatNonRacikan('');
    setShowAturanPakaiDropdown(false);

    // Kembalikan fokus ke kolom Cari Obat supaya user bisa langsung ketik obat berikutnya
    setTimeout(() => searchObatNonRacikanRef.current?.focus(), 0);
  };

  // Hapus Obat Non Racikan
  const hapusObatNonRacikan = (index: number) => {
    setResepNonRacikan(prev => prev.filter((_, i) => i !== index));
  };

  // Cari Obat Racikan
  const cariObatRacikan = async () => {
    if (!searchObatRacikan.trim()) {
      setObatListRacikan([]);
      setShowObatDropdownRacikan(false);
      return;
    }

    try {
      let data: ObatItem[];
      if (isRanap) {
        const url = `/api/resep-ranap/obat?search=${encodeURIComponent(searchObatRacikan)}&no_rawat=${encodeURIComponent(patient.no_rawat || '')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to search obat');
        const raw = await res.json();
        data = (raw || []).map((o: any) => ({
          kode_brng: o.kode_brng,
          nama_brng: o.nama_brng,
          kode_sat: o.kode_sat,
          stok: o.stok,
          harga: o.harga_jual,
          h_beli: o.h_beli,
          no_batch: o.no_batch,
          no_faktur: o.no_faktur,
          kapasitas: String(o.kapasitas ?? ''),
        }));
      } else {
        const response = await fetch(`/api/obat/search?query=${encodeURIComponent(searchObatRacikan)}&no_rawat=${encodeURIComponent(patient.no_rawat || '')}`);
        if (!response.ok) throw new Error('Failed to search obat');
        data = await response.json() || [];
      }
      setObatListRacikan(data);
      setShowObatDropdownRacikan(true);
    } catch (error) {
      console.error('Error searching obat:', error);
      setObatListRacikan([]);
      setShowObatDropdownRacikan(false);
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: 'Gagal mencari obat'
      });
    }
  };

  const updateRacikanAt = (idx: number, updater: (prev: Racikan) => Racikan) => {
    setRacikanList(prev => {
      const copy = [...prev];
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  };
  const activeRacikan = racikanList[activeRacikanIdx] ?? racikanList[0];

  // Pilih Obat Racikan
  const pilihObatRacikan = (obat: ObatItem) => {
    if (obat.stok <= 0) {
      Swal.fire({ icon: 'warning', title: 'Stok Obat saat ini tidak tersedia' });
      return;
    }
    setSelectedObatRacikan(obat);
    setShowObatDropdownRacikan(false);
    setShowModalInputObatRacikan(true);
    setInputObatRacikanForm({
      kandungan: '',
      jml: 0
    });
  };

  // Close Modal Input Obat Racikan
  const closeModalInputObatRacikan = () => {
    setShowModalInputObatRacikan(false);
    setSelectedObatRacikan(null);
    setInputObatRacikanForm({
      kandungan: '',
      jml: 0
    });
  };

  // Hitung Jumlah Obat Racikan
  const hitungJumlahObatRacikan = (kandungan: string) => {
    if (!selectedObatRacikan || !kandungan.trim()) {
      setInputObatRacikanForm(prev => ({ ...prev, jml: 0 }));
      return;
    }

    const kapasitas = parseFloat(selectedObatRacikan.kapasitas || '0');

    // Handle fraction input like "2/3"
    if (kandungan.includes('/')) {
      const [num, denom] = kandungan.split('/').map(s => parseFloat(s.trim()));
      if (!isNaN(num) && !isNaN(denom) && denom !== 0 && kapasitas > 0) {
        const jml = (num / denom) * activeRacikan.jml_dr / kapasitas;
        setInputObatRacikanForm(prev => ({ ...prev, jml: parseFloat(jml.toFixed(2)) }));
      }
    } else {
      const kandunganNum = parseFloat(kandungan);
      if (!isNaN(kandunganNum) && kapasitas > 0) {
        const jml = kandunganNum * activeRacikan.jml_dr / kapasitas;
        setInputObatRacikanForm(prev => ({ ...prev, jml: parseFloat(jml.toFixed(2)) }));
      }
    }
  };

  // Hitung Kandungan Obat Racikan — kebalikan dari hitungJumlahObatRacikan
  // di atas: dipakai kalau user isi "Jumlah" (mis. 4 tab) langsung, bukan
  // "Kandungan" dulu. kandungan = jml * kapasitas / jml_dr (Jumlah Diminta
  // Racikan, di-set di header racikan). Hasilnya angka desimal biasa
  // (bukan pecahan seperti "2/3") — field Kandungan tetap teks bebas jadi
  // user boleh menimpanya manual kalau mau format pecahan.
  const hitungKandunganObatRacikan = (jmlStr: string) => {
    if (!selectedObatRacikan || !jmlStr.trim()) {
      setInputObatRacikanForm(prev => ({ ...prev, kandungan: '' }));
      return;
    }

    const kapasitas = parseFloat(selectedObatRacikan.kapasitas || '0');
    const jmlNum = parseFloat(jmlStr);
    if (!isNaN(jmlNum) && kapasitas > 0 && activeRacikan.jml_dr > 0) {
      const kandungan = jmlNum * kapasitas / activeRacikan.jml_dr;
      setInputObatRacikanForm(prev => ({ ...prev, kandungan: parseFloat(kandungan.toFixed(2)).toString() }));
    }
  };

  // Confirm Tambah Obat Racikan
  const confirmTambahObatRacikan = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedObatRacikan) return;

    if (!inputObatRacikanForm.jml || inputObatRacikanForm.jml <= 0) {
      Swal.fire({ icon: 'warning', title: 'Jumlah belum diisi', text: 'Isi Kandungan (untuk hitung otomatis) atau isi Jumlah secara langsung.' });
      return;
    }

    const newDetail: RacikanDetail = {
      kode_brng: selectedObatRacikan.kode_brng,
      nama_brng: selectedObatRacikan.nama_brng,
      kode_sat: selectedObatRacikan.kode_sat,
      kapasitas: selectedObatRacikan.kapasitas || '',
      kandungan: inputObatRacikanForm.kandungan,
      jml: inputObatRacikanForm.jml
    };

    updateRacikanAt(activeRacikanIdx, prev => ({
      ...prev,
      detail: [...prev.detail, newDetail]
    }));

    closeModalInputObatRacikan();
    setSearchObatRacikan('');
  };

  // Hapus Obat Racikan
  const hapusObatRacikan = (index: number) => {
    updateRacikanAt(activeRacikanIdx, prev => ({
      ...prev,
      detail: prev.detail.filter((_, i) => i !== index)
    }));
  };

  // Format Resep to Planning Text (sesuai format Khanza Java)
  const formatResepToPlanning = (): string => {
    const lines: string[] = [];
    
    // Header sesuai Khanza Java
    lines.push('Resep : ');
    
    // Non Racikan (format: nama_brng Jumlah jml Aturan Pakai aturan_pakai)
    resepNonRacikan.forEach((obat) => {
      const jml = obat.jml || 1;
      const jmlStr = jml % 1 === 0 ? jml.toString() : jml.toFixed(2);
      lines.push(`${obat.nama_brng} Jumlah ${jmlStr} Aturan Pakai ${obat.aturan_pakai || ''}`);
    });
    
    // Racikan (format: no_racik. nama_racik Jumlah jml_dr metode Aturan Pakai aturan_pakai)
    racikanList.forEach((rac, i) => {
      if (rac.nama_racikan && rac.metode_racik && rac.detail.length > 0) {
        lines.push(`${i + 1}. ${rac.nama_racikan} Jumlah ${rac.jml_dr} ${rac.metode_racik} Aturan Pakai ${rac.aturan_pakai || ''}`);
        rac.detail.forEach((det) => {
          const jmlStr = det.jml % 1 === 0 ? det.jml.toString() : det.jml.toFixed(2);
          lines.push(`-- ${det.nama_brng} ${jmlStr}`);
        });
      }
    });
    
    return lines.join('\n');
  };

  // Submit Resep Unified
  const submitResepUnified = async () => {
    try {
      const hasNonRacikan = resepNonRacikan.length > 0;
      const hasRacikan = racikanList.some(r => r.nama_racikan && r.detail.length > 0);

      if (!hasNonRacikan && !hasRacikan) {
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          text: 'Belum ada obat yang dipilih (non-racikan atau racikan)'
        });
        return;
      }

      // Mode manual No.Resep (checkbox ChkRM dimatikan) wajib diisi —
      // PERSIS validasi Valid.textKosong(NoResep,"No.Resep") di Java.
      if (isRanap && !noResepAuto && !manualNoResep.trim()) {
        Swal.fire({ icon: 'warning', title: 'Peringatan!', text: 'No.Resep wajib diisi' });
        return;
      }

      let result: any;

      if (isRanap) {
        // === RANAP: simpan ke resep_obat + resep_dokter (+ resep_dokter_racikan* untuk racikan) ===
        const nonRacikanPayload = hasNonRacikan
          ? resepNonRacikan.map(obat => ({
              kode_brng: obat.kode_brng,
              jml: obat.jml || 1,
              aturan_pakai: obat.aturan_pakai || '',
            }))
          : [];

        const racikanPayload = hasRacikan
          ? racikanList.filter(r => r.nama_racikan && r.detail.length > 0).map(rac => ({
              nama_racikan: rac.nama_racikan || '',
              metode_racik: rac.metode_racik || 'R01',
              jml_dr: rac.jml_dr || 1,
              aturan_pakai: rac.aturan_pakai || '',
              keterangan: rac.keterangan || '',
              detail: rac.detail.map(det => ({
                kode_brng: det.kode_brng,
                jml: det.jml,
                kandungan: det.kandungan || '',
              })),
            }))
          : [];

        const payload = {
          no_rawat: patient.no_rawat,
          kd_dokter: resepDokterKode || patient.kd_dokter || '',
          tgl_peresepan: resepTgl,
          jam_peresepan: resepJam,
          // no_resep cuma dikirim kalau mode manual (ChkRM dimatikan) —
          // mode auto (default) biarkan backend generate sendiri spy tidak
          // race dgn preview yg mungkin sudah basi.
          ...(!noResepAuto ? { no_resep: manualNoResep.trim() } : {}),
          non_racikan: nonRacikanPayload,
          racikan: racikanPayload,
        };

        // Jika mode edit, hapus resep lama dulu
        if (editResep?.no_resep) {
          const delRes = await fetch(`/api/resep-ranap?no_resep=${encodeURIComponent(editResep.no_resep)}`, { method: 'DELETE' });
          if (!delRes.ok) {
            const delErr = await delRes.json();
            throw new Error(delErr.error || 'Gagal menghapus resep lama');
          }
        }

        const response = await fetch('/api/resep-ranap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || 'Gagal menyimpan resep ranap');
        }
        result = await response.json();

      } else {
        // === RALAN: simpan ke tabel resep lama ===
        const payload: any = {
          no_rawat: patient.no_rawat,
          kd_dokter: patient.kd_dokter || '',
          non_racikan: [],
          racikan: []
        };

        if (hasNonRacikan) {
          payload.non_racikan = resepNonRacikan.map(obat => ({
            kode_brng: obat.kode_brng,
            jml: obat.jml || 1,
            aturan_pakai: obat.aturan_pakai || ''
          }));
        }

        if (hasRacikan) {
          racikanList.filter(r => r.nama_racikan && r.detail.length > 0).forEach(rac => {
            if (rac.nama_racikan.trim()) saveNamaRacikanToHistory(rac.nama_racikan);
            if (rac.keterangan.trim()) saveKeteranganToHistory(rac.keterangan);
            if (rac.aturan_pakai.trim()) saveAturanPakaiToHistory(rac.aturan_pakai);
          });
          payload.racikan = racikanList.filter(r => r.nama_racikan && r.detail.length > 0).map(rac => ({
            nama_racikan: rac.nama_racikan,
            keterangan: rac.keterangan || '',
            metode_racik: rac.metode_racik,
            jml_dr: rac.jml_dr,
            aturan_pakai: rac.aturan_pakai,
            detail: rac.detail.map(det => ({
              kode_brng: det.kode_brng,
              kandungan: det.kandungan,
              jml: det.jml
            }))
          }));
        }

        // Jika mode edit, hapus resep lama dulu baru buat yang baru
        if (editResep?.no_resep) {
          const delRes = await fetch(`/api/resep/${encodeURIComponent(editResep.no_resep)}`, { method: 'DELETE' });
          if (!delRes.ok) {
            const delErr = await delRes.json();
            throw new Error(delErr.error || delErr.message || 'Gagal menghapus resep lama');
          }
        }

        const response = await fetch('/api/resep/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Gagal menyimpan resep');
        }
        result = await response.json();
      }

      if (onResepSaved) {
        const planningText = formatResepToPlanning();
        onResepSaved(planningText);
      }

      setResepNonRacikan([]);
      setSearchObatNonRacikan('');
      setRacikanList([{ nama_racikan: '', keterangan: '', metode_racik: '', jml_dr: 0, aturan_pakai: '', detail: [] }]);
      setActiveRacikanIdx(0);
      setSearchObatRacikan('');

      onClose();

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Resep berhasil disimpan!\nNo: ${result.no_permintaan || result.no_resep || '-'}`,
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error submitting resep:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: error.message || 'Terjadi kesalahan saat menyimpan resep'
      });
    }
  };

  // Open Modal Riwayat Resep
  const openModalRiwayatResep = async () => {
    setShowModalRiwayatResep(true);
    setLoadingRiwayatResep(true);

    try {
      // TODO: Fetch riwayat resep from API
      const response = await fetch(`/api/resep/history/${encodeURIComponent(patient.no_rkm_medis)}`);
      if (!response.ok) throw new Error('Failed to fetch riwayat resep');
      const data = await response.json();

      // Add status_penyerahan based on tgl_penyerahan
      const dataWithStatus = data.map((resep: any) => ({
        ...resep,
        status_penyerahan: (resep.tgl_penyerahan && resep.tgl_penyerahan !== '0000-00-00')
          ? 'Sudah Terlayani'
          : 'Belum Terlayani',
        status_asal: resep.status // ralan/ranap
      }));

      setRiwayatResep(dataWithStatus);
    } catch (error) {
      console.error('Error fetching riwayat resep:', error);
      setRiwayatResep([]);
    } finally {
      setLoadingRiwayatResep(false);
    }
  };

  // Close Modal Riwayat Resep
  const closeModalRiwayatResep = () => {
    setShowModalRiwayatResep(false);
  };

  // Copy Resep to Form
  const copyResepToForm = (resep: any) => {
    let hasNonRacikan = false;
    let hasRacikan = false;

    // Copy non racikan
    if (resep.non_racikan && resep.non_racikan.length > 0) {
      setResepNonRacikan(resep.non_racikan);
      hasNonRacikan = true;
    }

    // Copy racikan (all entries)
    if (resep.racikan && resep.racikan.length > 0) {
      setRacikanList(resep.racikan.map((r: any) => ({
        nama_racikan: r.nama_racik || '',
        keterangan: '',
        metode_racik: r.metode_racik || '',
        jml_dr: r.jml_dr || 1,
        aturan_pakai: r.aturan_pakai || '',
        detail: r.detail || []
      })));
      setActiveRacikanIdx(0);
      hasRacikan = true;
    }

    // Set active tab - prioritize racikan if both exist, otherwise set to whichever has data
    if (hasRacikan) {
      setActiveResepTab('racikan');
    } else if (hasNonRacikan) {
      setActiveResepTab('non-racikan');
    }

    closeModalRiwayatResep();
  };

  // Total harga seluruh obat non-racikan yang sudah dipilih
  const totalHargaNonRacikan = resepNonRacikan.reduce((sum, obat) => sum + (obat.harga || 0) * (obat.jml || 1), 0);

  return (
    <>
      {/* Main Modal Resep — redesain jadi panel slide-in dari kanan, PERSIS
          pola ModalInputTriase.tsx/ModalInputAwalMedisIGD.tsx (overlay fixed
          + panel anchor kanan full-height 50vw, header breadcrumb pasien +
          tombol close bulat, body scrollable, footer sticky), ganti dari
          versi lama (dialog card mengambang di tengah, radius 20/16). */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onClick={onClose}
      >
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
            background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* Header — breadcrumb pasien + close button bulat, PERSIS pola
              ModalInputTriase.tsx. */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
                .filter(Boolean)
                .map((v, i, arr) => (
                  <React.Fragment key={i}>
                    <span>{v}</span>
                    {i < arr.length - 1 && <span>|</span>}
                  </React.Fragment>
                ))}
              {isRanap && <span style={{ fontSize: 12, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontWeight: 400 }}>RANAP</span>}
              {editResep && <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontWeight: 400 }}>Edit Resep {editResep.no_resep}</span>}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
                flexShrink: 0,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body — scrollable, flat (tanpa nested white-card-dlm-card
              spt versi lama). */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Header Tgl.Resep/Jam/Peresep/No.Resep — KHUSUS Ranap, fully
                editable PERSIS Java (referensi screenshot user): Tgl.Resep
                & Jam bisa diganti manual (auto-time checkbox spt SOAP/ADIME
                Ranap), Peresep bisa dicari dokter lain (beda dari DPJP
                kunjungan), No.Resep di-preview LIVE dari backend. */}
            {isRanap && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Tgl.Resep :</label>
                  <input
                    type="date" value={resepTgl}
                    onChange={(e) => { setResepTgl(e.target.value); setResepUseAutoTime(false); }}
                    style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}
                  />
                  <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Jam :</label>
                  <input
                    type="time" value={resepJam.slice(0, 5)} step="1"
                    onChange={(e) => { setResepJam(`${e.target.value}:00`); setResepUseAutoTime(false); }}
                    style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}
                  />
                  <input
                    type="checkbox" checked={resepUseAutoTime}
                    onChange={(e) => setResepUseAutoTime(e.target.checked)}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1AB1E5' }}
                    title="Gunakan waktu saat ini"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 380 }}>
                    <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Peresep :</label>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="text" value={resepDokterNama} readOnly placeholder="Cari dokter peresep..." style={{ width: '100%', padding: '5px 34px 5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#f9fafb', boxSizing: 'border-box' }} />
                      <button
                        type="button" onClick={() => setShowCariDokterResep(true)} title="Cari dokter peresep"
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, padding: 0, border: 'none', borderRadius: 4, background: '#1AB1E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
                          <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>No.Resep :</label>
                    {noResepAuto ? (
                      <input type="text" value={editResep?.no_resep || previewNoResep} readOnly style={{ width: 110, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#f9fafb', color: '#374151' }} />
                    ) : (
                      <input
                        type="text" value={manualNoResep}
                        onChange={(e) => setManualNoResep(e.target.value)}
                        placeholder="Isi No.Resep manual..."
                        style={{ width: 110, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#ffffff' }}
                      />
                    )}
                    <input
                      type="checkbox" checked={noResepAuto}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNoResepAuto(checked);
                        // Dimatikan — isi dulu dgn nomor preview yg lagi
                        // tampil (bukan dikosongkan paksa) spy user tinggal
                        // hapus/ubah manual, bukan mulai dari kosong.
                        setManualNoResep(checked ? '' : (editResep?.no_resep || previewNoResep));
                      }}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1AB1E5' }}
                      title="No.Resep otomatis (matikan utk isi manual)"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation — rata kiri + "+ Tambah Racikan" di kanan
                (cuma tab Racikan), per permintaan user (sebelumnya di
                tengah, pola grid 3-kolom ModalValidasiObat.tsx). */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {/* Button group flat (radius 0, tombol nempel/berbagi border,
                  aktif biru cyan #1AB1E5) — ganti dari pill segmented
                  control lama, per permintaan user. */}
              <div style={{ display: 'inline-flex' }}>
                {(['non-racikan', 'racikan'] as const).map((tab, i) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveResepTab(tab)}
                    style={{
                      padding: '6px 24px',
                      borderRadius: 0,
                      border: '1px solid #1AB1E5',
                      borderLeft: i === 0 ? '1px solid #1AB1E5' : 'none',
                      background: activeResepTab === tab ? '#1AB1E5' : '#ffffff',
                      color: activeResepTab === tab ? '#ffffff' : '#1AB1E5',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 400,
                      transition: 'all 0.2s ease',
                      boxShadow: 'none'
                    }}
                  >
                    {tab === 'non-racikan' ? `Non Racikan (${resepNonRacikan.length})` : `Racikan (${racikanList.filter(r => r.nama_racikan && r.detail.length > 0).length})`}
                  </button>
                ))}
              </div>
              <div>
                {activeResepTab === 'racikan' && (
                  <button type="button" onClick={() => {
                    setRacikanList(prev => [{ nama_racikan: '', keterangan: '', metode_racik: '', jml_dr: 0, aturan_pakai: '', detail: [] }, ...prev]);
                    setActiveRacikanIdx(0);
                  }} style={{
                    padding: '6px 14px', borderRadius: 0, border: '1px solid #000000',
                    background: '#000000', color: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 400,
                  }}>
                    + Tambah Racikan
                  </button>
                )}
              </div>
            </div>

            {/* Tab Content: Non Racikan */}
            {activeResepTab === 'non-racikan' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Cari Obat tetap di paling atas modal (di luar area scroll) agar daftar hasil pencarian tidak terpotong */}
                <div className="mb-3" style={{ flexShrink: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, alignItems: 'start' }}>
                    <div>
                      <label className="form-label">Cari Obat</label>
                      <div className="search-obat-wrapper" ref={nonRacikanSearchWrapperRef}>
                        <span className="search-obat-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                        </span>
                        <input
                          ref={searchObatNonRacikanRef}
                          type="text"
                          className="form-control"
                          placeholder="Ketik nama obat untuk mencari otomatis..."
                          value={searchObatNonRacikan}
                          onChange={(e) => setSearchObatNonRacikan(e.target.value)}
                          autoComplete="off"
                        />

                        {/* Dropdown hasil pencarian — portal ke body, mengambang di depan modal, tidak tergantung ruang di bawahnya */}
                        {showObatDropdown && obatList && obatList.length > 0 && nonRacikanDropdownPos && createPortal(
                          <div
                            ref={nonRacikanDropdownRef}
                            className="obat-dropdown"
                            style={{ position: 'fixed', top: nonRacikanDropdownPos.top, left: nonRacikanDropdownPos.left, width: nonRacikanDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                          >
                            <table className="table table-sm table-hover mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th style={{ width: '15%', whiteSpace: 'nowrap' }}>Kode Barang</th>
                                  <th>Nama Barang</th>
                                  <th style={{ width: '10%' }}>Satuan</th>
                                  <th style={{ width: '8%' }}>Kps</th>
                                  <th style={{ width: '10%' }}>Stok</th>
                                  <th style={{ width: '15%' }}>Harga (Rp)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {obatList.map((obat, index) => (
                                  <tr
                                    key={`${obat.kode_brng}-${index}`}
                                    className="obat-item-row"
                                    onClick={() => pilihObatNonRacikan(obat)}
                                  >
                                    <td><small>{obat.kode_brng}</small></td>
                                    <td>
                                      <div className="obat-name-cell">{obat.nama_brng}</div>
                                      <div className="obat-extra-info">
                                        <small className="text-muted">{obat.jenis_obat} - {obat.nama_industri}</small>
                                      </div>
                                    </td>
                                    <td className="text-center">{obat.kode_sat}</td>
                                    <td className="text-center">{obat.kapasitas || '-'}</td>
                                    <td className="text-center">
                                      <span className={obat.stok > 0 ? 'text-success' : 'text-danger'}>
                                        {obat.stok}
                                      </span>
                                    </td>
                                    <td className="text-end">{formatRupiah(obat.harga)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>,
                          document.body
                        )}

                        {/* Pesan jika tidak ada hasil */}
                        {showObatDropdown && obatList && obatList.length === 0 && (
                          <div className="alert alert-info mt-2" style={{ fontSize: '12px' }}>
                            Tidak ada obat ditemukan dengan kata kunci "{searchObatNonRacikan}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Total</label>
                      <div style={{
                        height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 10px',
                        fontSize: 12, fontWeight: 400, color: '#16a34a', background: '#f0fdf4',
                        textAlign: 'right', boxSizing: 'border-box',
                      }}>
                        Rp {formatRupiah(totalHargaNonRacikan)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tab-content-resep" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <div className="mb-3">
                  <label className="form-label">Daftar Obat yang Dipilih</label>
                  {resepNonRacikan.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                      <div style={{ fontSize: 12, color: '#374151' }}>Belum Ada Obat Dipilih</div>
                      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Cari &amp; pilih obat non-racikan di atas untuk ditambahkan ke resep.</div>
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th>Nama Obat</th>
                            <th style={{ width: '10%' }}>Jumlah</th>
                            <th style={{ width: '10%' }}>Satuan</th>
                            <th style={{ width: '25%' }}>Aturan Pakai</th>
                            <th style={{ width: '5%' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resepNonRacikan.map((obat, index) => (
                            <tr key={index}>
                              <td className="text-center">{index + 1}</td>
                              <td>{obat.nama_brng}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={obat.jml}
                                  onChange={(e) => {
                                    const newList = [...resepNonRacikan];
                                    newList[index].jml = parseInt(e.target.value) || 1;
                                    setResepNonRacikan(newList);
                                  }}
                                  min="1"
                                  max={obat.stok}
                                  onFocus={(e) => e.target.select()}
                                />
                              </td>
                              <td>{obat.kode_sat}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={obat.aturan_pakai}
                                  onChange={(e) => {
                                    const newList = [...resepNonRacikan];
                                    newList[index].aturan_pakai = e.target.value;
                                    setResepNonRacikan(newList);
                                  }}
                                  placeholder="3x1 sehari"
                                />
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => hapusObatNonRacikan(index)}
                                  className="btn btn-sm btn-danger"
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )}

            {/* Tab Content: Racikan */}
            {activeResepTab === 'racikan' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Tabel master racikan (Nama Racikan/Metode Racik/Jml.Racik/
                    Aturan Pakai/Keterangan/Aksi) — klik baris untuk pilih
                    racikan aktif, pola sama dengan tabel master racikan di
                    ModalValidasiObat.tsx supaya konsisten antar modal resep.
                    Tetap di luar area scroll (bareng Cari Obat) agar daftar
                    hasil pencarian tidak terpotong. */}
                <div style={{ flexShrink: 0 }}>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: '#6b7280', fontWeight: 400 }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400 }}>No</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400 }}>Nama Racikan</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400 }}>Metode Racik</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400, width: '1%', whiteSpace: 'nowrap' }}>Jml.Racik/Bungkus</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400 }}>Aturan Pakai</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 400 }}>Keterangan</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 400 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {racikanList.map((rac, idx) => {
                        const isSelected = activeRacikanIdx === idx;
                        return (
                        <tr
                          key={idx}
                          onClick={() => setActiveRacikanIdx(idx)}
                          style={{ cursor: 'pointer', background: isSelected ? '#eff6ff' : undefined }}
                        >
                          <td style={{ padding: '4px 6px', verticalAlign: 'middle', color: '#374151' }}>{idx + 1}</td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'middle' }}>
                            <div className={emptyRacikanWarnIdx === idx ? 'blink-red-field' : ''}>
                              <input
                                ref={(el) => { namaRacikanRefs.current[idx] = el; }}
                                type="text"
                                style={racikanInputStyle}
                                value={rac.nama_racikan}
                                onFocus={() => { setActiveRacikanIdx(idx); setEmptyRacikanWarnIdx(null); }}
                                onChange={(e) => { updateRacikanAt(idx, prev => ({ ...prev, nama_racikan: e.target.value })); setEmptyRacikanWarnIdx(null); }}
                                placeholder="Contoh: Pulvis / Racikan Batuk"
                                autoComplete="off"
                              />
                            </div>
                          </td>
                          <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                            <select
                              style={racikanInputStyle}
                              value={rac.metode_racik}
                              onFocus={() => setActiveRacikanIdx(idx)}
                              onChange={(e) => updateRacikanAt(idx, prev => ({ ...prev, metode_racik: e.target.value }))}
                            >
                              <option value="">Pilih Metode</option>
                              <option value="Kapsul">Kapsul</option>
                              <option value="Puyer">Puyer</option>
                              <option value="Sirup">Sirup</option>
                              <option value="Salep">Salep</option>
                              <option value="Krim">Krim</option>
                            </select>
                          </td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              style={{ ...racikanInputStyle, color: isSelected ? '#2563eb' : undefined }}
                              value={rac.jml_dr === 0 ? '' : rac.jml_dr}
                              placeholder="-"
                              onFocus={(e) => { setActiveRacikanIdx(idx); e.target.select(); }}
                              onChange={(e) => updateRacikanAt(idx, prev => ({ ...prev, jml_dr: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 }))}
                              min="1"
                            />
                          </td>
                          <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                            <input
                              type="text"
                              style={racikanInputStyle}
                              value={rac.aturan_pakai}
                              onFocus={() => setActiveRacikanIdx(idx)}
                              onChange={(e) => updateRacikanAt(idx, prev => ({ ...prev, aturan_pakai: e.target.value }))}
                              placeholder="3x1 sehari"
                              autoComplete="off"
                            />
                          </td>
                          <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                            <input
                              type="text"
                              style={racikanInputStyle}
                              value={rac.keterangan}
                              onFocus={() => setActiveRacikanIdx(idx)}
                              onChange={(e) => updateRacikanAt(idx, prev => ({ ...prev, keterangan: e.target.value }))}
                              placeholder="Keterangan"
                              autoComplete="off"
                            />
                          </td>
                          <td style={{ padding: '4px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                            {racikanList.length > 1 && (
                              <button type="button" onClick={(e) => {
                                e.stopPropagation();
                                setRacikanList(prev => prev.filter((_, i) => i !== idx));
                                setActiveRacikanIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
                              }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}>
                                Hapus
                              </button>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <hr />

                <div className="mb-3">
                  <label className="form-label">Detail Obat Racikan</label>
                  <div className="search-obat-wrapper" ref={racikanSearchWrapperRef}>
                    <span className="search-obat-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="form-control mb-2"
                      placeholder="Ketik nama obat untuk mencari otomatis..."
                      value={searchObatRacikan}
                      onChange={(e) => setSearchObatRacikan(e.target.value)}
                      onFocus={() => {
                        if (!activeRacikan?.nama_racikan.trim()) {
                          setEmptyRacikanWarnIdx(activeRacikanIdx);
                          namaRacikanRefs.current[activeRacikanIdx]?.focus();
                          window.setTimeout(() => setEmptyRacikanWarnIdx(null), 1500);
                        }
                      }}
                      autoComplete="off"
                    />

                    {/* Dropdown hasil pencarian racikan — portal ke body, mengambang di depan modal */}
                    {showObatDropdownRacikan && obatListRacikan && obatListRacikan.length > 0 && racikanDropdownPos && createPortal(
                      <div
                        ref={racikanDropdownRef}
                        className="obat-dropdown"
                        style={{ position: 'fixed', top: racikanDropdownPos.top, left: racikanDropdownPos.left, width: racikanDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                      >
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%', whiteSpace: 'nowrap' }}>Kode Barang</th>
                              <th>Nama Barang</th>
                              <th style={{ width: '10%' }}>Satuan</th>
                              <th style={{ width: '8%' }}>Kps</th>
                              <th style={{ width: '10%' }}>Stok</th>
                              <th style={{ width: '15%' }}>Harga (Rp)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obatListRacikan.map((obat, index) => (
                              <tr
                                key={`${obat.kode_brng}-${index}`}
                                className="obat-item-row"
                                onClick={() => pilihObatRacikan(obat)}
                              >
                                <td><small>{obat.kode_brng}</small></td>
                                <td>
                                  <div className="obat-name-cell">{obat.nama_brng}</div>
                                  <div className="obat-extra-info">
                                    <small className="text-muted">{obat.jenis_obat} - {obat.nama_industri}</small>
                                  </div>
                                </td>
                                <td className="text-center">{obat.kode_sat}</td>
                                <td className="text-center">{obat.kapasitas || '-'}</td>
                                <td className="text-center">
                                  <span className={obat.stok > 0 ? 'text-success' : 'text-danger'}>
                                    {obat.stok}
                                  </span>
                                </td>
                                <td className="text-end">{formatRupiah(obat.harga)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>,
                      document.body
                    )}

                    {/* Pesan jika tidak ada hasil */}
                    {showObatDropdownRacikan && obatListRacikan && obatListRacikan.length === 0 && (
                      <div className="alert alert-info mt-2" style={{ fontSize: '12px' }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchObatRacikan}"
                      </div>
                    )}
                  </div>
                </div>
                </div>

                <div className="tab-content-resep" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <div className="mb-3">
                  <label className="form-label">Daftar Obat — {activeRacikan?.nama_racikan || `Racikan ${activeRacikanIdx + 1}`}</label>
                  {(activeRacikan?.detail ?? []).length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                      <div style={{ fontSize: 12, color: '#374151' }}>Belum Ada Obat dalam Racikan</div>
                      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Cari &amp; pilih obat di atas untuk ditambahkan ke racikan ini.</div>
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: 250, overflowY: 'auto' }}>
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th>Nama Obat</th>
                            <th style={{ width: '10%' }}>Kandungan</th>
                            <th style={{ width: '10%' }}>Jumlah</th>
                            <th style={{ width: '10%' }}>Satuan</th>
                            <th style={{ width: '5%' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(activeRacikan?.detail ?? []).map((obat, index) => (
                            <tr key={index}>
                              <td className="text-center">{index + 1}</td>
                              <td>{obat.nama_brng}</td>
                              <td className="text-center">{obat.kandungan}</td>
                              <td className="text-center">{obat.jml}</td>
                              <td className="text-center">{obat.kode_sat}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => hapusObatRacikan(index)}
                                  className="btn btn-sm btn-danger"
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer — sticky, di luar area scroll body, PERSIS pola
              ModalInputTriase.tsx (padding 16, borderTop). */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button
              type="button"
              onClick={openModalRiwayatResep}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderRadius: 2, border: 'none', background: '#4b5563', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#374151'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#4b5563'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Riwayat Resep
            </button>
            <button
              type="button"
              onClick={submitResepUnified}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderRadius: 2, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Simpan
            </button>
          </div>
        </div>
      </div>

      {/* Modal Input Obat Non Racikan — overlay dibatasi ke lebar panel Resep
          (kanan, 50vw) supaya form Jumlah/Aturan Pakai kecentring DI DALAM
          panel, bukan di tengah layar penuh (dulu pakai .modal-overlay apa
          adanya yg full-viewport). */}
      {showModalInputObat && selectedObatNonRacikan && (
        <div className="modal-overlay" style={{ left: 'auto', right: 0, width: '50vw', maxWidth: '90vw' }} onClick={closeModalInputObat}>
          <div className="modal-input-obat-simple" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={confirmTambahObat}>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ width: 120 }}>
                  <label className="form-label mb-1">Jumlah <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className="form-control"
                    value={inputObatForm.jml}
                    onChange={(e) => setInputObatForm(prev => ({ ...prev, jml: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max={selectedObatNonRacikan.stok}
                    required
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="col" style={{ position: 'relative' }}>
                  <label className="form-label mb-1">Aturan Pakai <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={inputObatForm.aturan_pakai}
                    onChange={(e) => {
                      setInputObatForm(prev => ({ ...prev, aturan_pakai: e.target.value }));
                      filterAturanPakai(e.target.value);
                    }}
                    onFocus={() => {
                      filterAturanPakai(inputObatForm.aturan_pakai);
                      setShowAturanPakaiDropdown(true);
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown
                      setTimeout(() => setShowAturanPakaiDropdown(false), 200);
                    }}
                    placeholder="3x1 sehari setelah makan"
                    required
                    autoComplete="off"
                  />
                  {/* Dropdown Aturan Pakai History */}
                  {showAturanPakaiDropdown && filteredAturanPakai.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}>
                      {filteredAturanPakai.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setInputObatForm(prev => ({ ...prev, aturan_pakai: item }));
                            setShowAturanPakaiDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderBottom: index < filteredAturanPakai.length - 1 ? '1px solid #e5e7eb' : 'none',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-primary">
                    ✅ Tambah
                  </button>
                </div>
                <div className="col-auto">
                  <button type="button" onClick={closeModalInputObat} className="btn btn-secondary">
                    ❌ Batal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Obat Racikan — overlay dibatasi ke lebar panel Resep
          (kanan, 50vw), sama alasan spt Modal Input Obat Non Racikan
          di atas. */}
      {showModalInputObatRacikan && selectedObatRacikan && (
        <div className="modal-overlay" style={{ left: 'auto', right: 0, width: '50vw', maxWidth: '90vw' }} onClick={closeModalInputObatRacikan}>
          <div className="modal-input-obat-racikan" onClick={(e) => e.stopPropagation()}>
            <div className="obat-racikan-info">
              <div className="obat-racikan-name">{selectedObatRacikan.nama_brng}</div>
              <div className="obat-racikan-details">
                <span>Stok: {selectedObatRacikan.stok} {selectedObatRacikan.kode_sat}</span>
                {selectedObatRacikan.kapasitas && (
                  <span> &middot; Kapasitas: {selectedObatRacikan.kapasitas}</span>
                )}
              </div>
            </div>
            <form onSubmit={confirmTambahObatRacikan}>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ width: 150 }}>
                  <label className="form-label mb-1">Kandungan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={inputObatRacikanForm.kandungan}
                    onChange={(e) => {
                      setInputObatRacikanForm(prev => ({ ...prev, kandungan: e.target.value }));
                      hitungJumlahObatRacikan(e.target.value);
                    }}
                    placeholder="200 atau 2/3"
                    autoFocus
                  />
                </div>
                <div className="col-auto" style={{ width: 150 }}>
                  <label className="form-label mb-1">Jumlah <span className="text-muted">(TAB, dst)</span></label>
                  <input
                    type="number"
                    className="form-control"
                    value={inputObatRacikanForm.jml === 0 ? '' : inputObatRacikanForm.jml}
                    min="0.1"
                    step="0.1"
                    placeholder="4"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const jml = raw === '' ? 0 : parseFloat(raw);
                      setInputObatRacikanForm(prev => ({ ...prev, jml: isNaN(jml) ? 0 : jml }));
                      hitungKandunganObatRacikan(raw);
                    }}
                  />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-primary">
                    ✅ Tambah
                  </button>
                </div>
                <div className="col-auto">
                  <button type="button" onClick={closeModalInputObatRacikan} className="btn btn-secondary">
                    ❌ Batal
                  </button>
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Isi salah satu saja — Kandungan untuk hitung Jumlah otomatis, atau Jumlah (mis. 4 tablet) untuk hitung balik Kandungan-nya.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Resep — panel slide-in dari KIRI, lebar 50vw = sisa
          ruang di samping panel Resep yg sudah nempel di kanan (juga 50vw),
          jadi keduanya tampil BERDAMPINGAN — per permintaan user. Overlay
          TANPA warna gelap (transparan, cuma click-catcher utk tutup saat
          klik di luar panel) supaya panel Resep di kanan tetap kelihatan
          jelas, tidak ikut redup. zIndex di atas overlay modal Resep (1000)
          krn modal ini dibuka DARI DALAM modal Resep. */}
      {showModalRiwayatResep && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1001 }}
          onClick={closeModalRiwayatResep}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
              background: '#ffffff', boxShadow: '8px 0 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
              transform: riwayatVisible ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ color: '#000000', fontSize: 12, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Riwayat Resep</span>
                <span>|</span>
                <span>{patient.no_rkm_medis}</span>
                <span>|</span>
                <span>{patient.nm_pasien}</span>
              </span>
              <button
                type="button"
                onClick={closeModalRiwayatResep}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                  background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
                  flexShrink: 0,
                }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>
              {loadingRiwayatResep ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : riwayatResep.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                  <div style={{ fontSize: 12, color: '#374151' }}>Belum Ada Riwayat Resep</div>
                  <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada riwayat resep untuk pasien ini.</div>
                </div>
              ) : (
                <div className="resep-history-container">
                  {riwayatResep.map((resep, index) => (
                    // Daftar Obat & Racikan — tabel info resep terpisah dari tabel obat, kolom independen
                    <div key={index}>
                      <table className="table table-sm table-bordered mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>No. Resep</th>
                            <th>No. Rawat</th>
                            <th>Tanggal</th>
                            <th colSpan={2}>Dokter</th>
                            <th>
                              <button
                                onClick={() => copyResepToForm(resep)}
                                className="btn btn-sm btn-primary"
                                title="Copy resep ini ke form input"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontWeight: 400, fontSize: 11, borderRadius: 0 }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{resep.no_resep}</td>
                            <td>{resep.no_rawat}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatTanggal(resep.tgl_peresepan)} {resep.jam_peresepan}</td>
                            <td colSpan={3} style={{ whiteSpace: 'nowrap' }}>{resep.nm_dokter}</td>
                          </tr>
                        </tbody>
                      </table>
                      <table className="table table-sm table-bordered" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '5%' }} />
                          <col style={{ width: '15%' }} />
                          <col />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '20%' }} />
                        </colgroup>
                        <thead className="table-light">
                          <tr>
                            <th>No</th>
                            <th>Kode</th>
                            <th>Nama Obat / Racikan</th>
                            <th>Jumlah</th>
                            <th>Satuan</th>
                            <th>Aturan Pakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resep.non_racikan?.map((obat: any, idx: number) => (
                            <tr key={`nr-${idx}`}>
                              <td className="text-center">{idx + 1}</td>
                              <td>{obat.kode_brng}</td>
                              <td>{obat.nama_brng}</td>
                              <td className="text-center">{obat.jml}</td>
                              <td className="text-center">{obat.kode_sat}</td>
                              <td>{obat.aturan_pakai}</td>
                            </tr>
                          ))}
                          {resep.racikan?.map((racikan: any, ridx: number) => (
                            <React.Fragment key={`r-${ridx}`}>
                              <tr>
                                <td></td>
                                <td>No.Racik {racikan.no_racik}</td>
                                <td>{racikan.nama_racik}</td>
                                <td className="text-center">{racikan.jml_dr}</td>
                                <td className="text-center">{racikan.metode_racik || '-'}</td>
                                <td>{racikan.aturan_pakai}</td>
                              </tr>
                              {racikan.detail?.map((detail: any, didx: number) => (
                                <tr key={`r-${ridx}-${didx}`}>
                                  <td></td>
                                  <td>{detail.kode_brng}</td>
                                  <td style={{ paddingLeft: 24 }}>{detail.nama_brng}</td>
                                  <td className="text-center">{detail.jml}</td>
                                  <td className="text-center">{detail.kode_sat}</td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRanap && (
        <ModalCariDokter
          isOpen={showCariDokterResep}
          onClose={() => setShowCariDokterResep(false)}
          onSelect={(kode, nama) => { setResepDokterKode(kode); setResepDokterNama(nama); }}
        />
      )}
    </>
  );
};
