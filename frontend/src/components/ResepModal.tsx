import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import './ResepModal.css';

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
  padding: '5px 10px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
};

export const ResepModal: React.FC<ResepModalProps> = ({ patient, onClose, onResepSaved, isRanap = false, editResep }) => {
  const [activeResepTab, setActiveResepTab] = React.useState<'non-racikan' | 'racikan'>('non-racikan');

  // Non Racikan State
  const searchObatNonRacikanRef = React.useRef<HTMLInputElement>(null);
  const nonRacikanSearchWrapperRef = React.useRef<HTMLDivElement>(null);
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
  const [racikanDropdownPos, setRacikanDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [searchObatRacikan, setSearchObatRacikan] = React.useState('');
  const [obatListRacikan, setObatListRacikan] = React.useState<ObatItem[]>([]);
  const [showObatDropdownRacikan, setShowObatDropdownRacikan] = React.useState(false);
  const [selectedObatRacikan, setSelectedObatRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObatRacikan, setShowModalInputObatRacikan] = React.useState(false);

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

  // Riwayat Resep State
  const [showModalRiwayatResep, setShowModalRiwayatResep] = React.useState(false);
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

  // Confirm Tambah Obat Racikan
  const confirmTambahObatRacikan = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedObatRacikan) return;

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
          kd_dokter: patient.kd_dokter || '',
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
        timer: 3000,
        showConfirmButton: true
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
        metode_racik: r.metode || '',
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
      {/* Main Modal Resep */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
        <div style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 900, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

          {/* Header — title + close button dalam satu baris flex, sejajar
              vertikal (bukan dua elemen absolute yang saling menumpuk). */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 20px', color: '#000000', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Input Resep
              {isRanap && <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>RANAP</span>}
            </span>
            <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          {/* White Card Content */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* Tab Navigation — segmented control di tengah + "+ Tambah
                Racikan" di kanan (cuma tab Racikan), pola sama dengan
                ModalValidasiObat.tsx supaya konsisten antar modal resep. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 16 }}>
              <span />
              <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, justifySelf: 'center' }}>
                {(['non-racikan', 'racikan'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveResepTab(tab)}
                    style={{
                      padding: '6px 24px',
                      borderRadius: 8,
                      border: activeResepTab === tab ? '1px solid #2563eb' : '1px solid transparent',
                      background: activeResepTab === tab ? '#ffffff' : 'transparent',
                      color: activeResepTab === tab ? '#2563eb' : '#6b7280',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: activeResepTab === tab ? 600 : 400,
                      transition: 'all 0.2s ease',
                      boxShadow: 'none'
                    }}
                  >
                    {tab === 'non-racikan' ? `Non Racikan (${resepNonRacikan.length})` : `Racikan (${racikanList.length})`}
                  </button>
                ))}
              </div>
              <div style={{ justifySelf: 'end' }}>
                {activeResepTab === 'racikan' && (
                  <button type="button" onClick={() => {
                    setRacikanList(prev => [{ nama_racikan: '', keterangan: '', metode_racik: '', jml_dr: 0, aturan_pakai: '', detail: [] }, ...prev]);
                    setActiveRacikanIdx(0);
                  }} style={{
                    padding: '6px 14px', borderRadius: 4, border: '1px solid #2563eb',
                    background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'start' }}>
                    <div>
                      <label className="form-label fw-bold">Cari Obat</label>
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
                            className="obat-dropdown"
                            style={{ position: 'fixed', top: nonRacikanDropdownPos.top, left: nonRacikanDropdownPos.left, width: nonRacikanDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                          >
                            <table className="table table-sm table-hover mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th style={{ width: '15%' }}>Kode Barang</th>
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
                          <div className="alert alert-info mt-2" style={{ fontSize: '13px' }}>
                            Tidak ada obat ditemukan dengan kata kunci "{searchObatNonRacikan}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="form-label fw-bold">Total</label>
                      <div style={{
                        border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px',
                        fontSize: 13, fontWeight: 600, color: '#16a34a', background: '#f0fdf4',
                        textAlign: 'right', boxSizing: 'border-box',
                      }}>
                        Rp {formatRupiah(totalHargaNonRacikan)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tab-content-resep" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <div className="mb-3">
                  <label className="form-label fw-bold">Daftar Obat yang Dipilih</label>
                  {resepNonRacikan.length === 0 ? (
                    <div className="alert alert-warning">
                      Belum ada obat yang dipilih
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ color: '#6b7280', fontWeight: 700 }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>No</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>Nama Racikan</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>Metode Racik</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700, width: '1%', whiteSpace: 'nowrap' }}>Jml.Racik/Bungkus</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>Aturan Pakai</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>Keterangan</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}>Aksi</th>
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
                            <input
                              ref={(el) => { namaRacikanRefs.current[idx] = el; }}
                              type="text"
                              style={racikanInputStyle}
                              value={rac.nama_racikan}
                              onFocus={() => setActiveRacikanIdx(idx)}
                              onChange={(e) => updateRacikanAt(idx, prev => ({ ...prev, nama_racikan: e.target.value }))}
                              placeholder="Contoh: Pulvis / Racikan Batuk"
                              autoComplete="off"
                            />
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
                              style={{ ...racikanInputStyle, color: isSelected ? '#2563eb' : undefined, fontWeight: isSelected ? 600 : undefined }}
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
                              }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
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
                  <label className="form-label fw-bold">Detail Obat Racikan</label>
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
                      autoComplete="off"
                    />

                    {/* Dropdown hasil pencarian racikan — portal ke body, mengambang di depan modal */}
                    {showObatDropdownRacikan && obatListRacikan && obatListRacikan.length > 0 && racikanDropdownPos && createPortal(
                      <div
                        className="obat-dropdown"
                        style={{ position: 'fixed', top: racikanDropdownPos.top, left: racikanDropdownPos.left, width: racikanDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                      >
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%' }}>Kode Barang</th>
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
                      <div className="alert alert-info mt-2" style={{ fontSize: '13px' }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchObatRacikan}"
                      </div>
                    )}
                  </div>
                </div>
                </div>

                <div className="tab-content-resep" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <div className="mb-3">
                  <label className="form-label fw-bold">Daftar Obat — {activeRacikan?.nama_racikan || `Racikan ${activeRacikanIdx + 1}`}</label>
                  {(activeRacikan?.detail ?? []).length === 0 ? (
                    <div className="alert alert-warning">
                      Belum ada obat dalam racikan
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
            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <button type="button" onClick={openModalRiwayatResep} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Riwayat Resep
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Tutup
                </button>
                <button type="button" onClick={submitResepUnified} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
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
        </div>
      </div>

      {/* Modal Input Obat Non Racikan */}
      {showModalInputObat && selectedObatNonRacikan && (
        <div className="modal-overlay" onClick={closeModalInputObat}>
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
                            fontSize: '13px',
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

      {/* Modal Input Obat Racikan */}
      {showModalInputObatRacikan && selectedObatRacikan && (
        <div className="modal-overlay" onClick={closeModalInputObatRacikan}>
          <div className="modal-input-obat-racikan" onClick={(e) => e.stopPropagation()}>
            <div className="obat-racikan-info">
              <div className="obat-racikan-name">{selectedObatRacikan.nama_brng}</div>
              <div className="obat-racikan-details">
                <span>Stok: <strong>{selectedObatRacikan.stok}</strong> {selectedObatRacikan.kode_sat}</span>
              </div>
            </div>
            <form onSubmit={confirmTambahObatRacikan}>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ width: 150 }}>
                  <label className="form-label mb-1">Kandungan <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={inputObatRacikanForm.kandungan}
                    onChange={(e) => {
                      setInputObatRacikanForm(prev => ({ ...prev, kandungan: e.target.value }));
                      hitungJumlahObatRacikan(e.target.value);
                    }}
                    placeholder="200 atau 2/3"
                    required
                    autoFocus
                  />
                </div>
                <div className="col-auto" style={{ width: 150 }}>
                  <label className="form-label mb-1">Jumlah <span className="text-muted">(otomatis)</span></label>
                  <input
                    type="number"
                    className="form-control"
                    value={inputObatRacikanForm.jml}
                    min="0.1"
                    step="0.1"
                    readOnly
                    style={{ backgroundColor: '#f8f9fa' }}
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
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Resep */}
      {showModalRiwayatResep && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
          onClick={closeModalRiwayatResep}
        >
          <div
            style={{
              background: '#F3F4F6', borderRadius: 20,
              padding: '35px 8px 8px 8px', position: 'relative',
              maxWidth: 900, width: '90%', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Riwayat Resep — {patient.nm_pasien} ({patient.no_rkm_medis})
              </span>
              <button
                type="button" onClick={closeModalRiwayatResep}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: 20, cursor: 'pointer', color: '#6b7280',
                  padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* White Card Content */}
            <div style={{
              background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db',
              padding: 16, overflowY: 'auto', flex: 1, minHeight: 0,
            }}>
              {loadingRiwayatResep ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : riwayatResep.length === 0 ? (
                <div className="alert alert-info">
                  Belum ada riwayat resep untuk pasien ini
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
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontWeight: 400 }}
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
                                <td><strong>{racikan.nama_racik}</strong></td>
                                <td className="text-center">{racikan.jml_dr}</td>
                                <td className="text-center">{racikan.metode || '-'}</td>
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
    </>
  );
};
