import React from 'react';
import Swal from 'sweetalert2';
import './ResepModal.css';

type ResepModalProps = {
  patient: any;
  onClose: () => void;
  onResepSaved?: (planningText: string) => void; // Callback untuk update planning setelah simpan resep
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

export const ResepModal: React.FC<ResepModalProps> = ({ patient, onClose, onResepSaved }) => {
  const [activeResepTab, setActiveResepTab] = React.useState<'non-racikan' | 'racikan'>('non-racikan');

  // Non Racikan State
  const [searchObatNonRacikan, setSearchObatNonRacikan] = React.useState('');
  const [obatList, setObatList] = React.useState<ObatItem[]>([]);
  const [showObatDropdown, setShowObatDropdown] = React.useState(false);
  const [resepNonRacikan, setResepNonRacikan] = React.useState<ObatItem[]>([]);
  const [selectedObatNonRacikan, setSelectedObatNonRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObat, setShowModalInputObat] = React.useState(false);

  // Racikan State
  const [searchObatRacikan, setSearchObatRacikan] = React.useState('');
  const [obatListRacikan, setObatListRacikan] = React.useState<ObatItem[]>([]);
  const [showObatDropdownRacikan, setShowObatDropdownRacikan] = React.useState(false);
  const [selectedObatRacikan, setSelectedObatRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObatRacikan, setShowModalInputObatRacikan] = React.useState(false);

  const [racikan, setRacikan] = React.useState<Racikan>({
    nama_racikan: '',
    keterangan: '',
    metode_racik: '',
    jml_dr: 1,
    aturan_pakai: '',
    detail: []
  });

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

  // Riwayat Resep State
  const [showModalRiwayatResep, setShowModalRiwayatResep] = React.useState(false);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);

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
      const response = await fetch(`/api/obat/search?query=${encodeURIComponent(searchObatNonRacikan)}`);
      if (!response.ok) throw new Error('Failed to search obat');
      const data = await response.json();
      setObatList(data || []);
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
      const response = await fetch(`/api/obat/search?query=${encodeURIComponent(searchObatRacikan)}`);
      if (!response.ok) throw new Error('Failed to search obat');
      const data = await response.json();
      setObatListRacikan(data || []);
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
        const jml = (num / denom) * racikan.jml_dr / kapasitas;
        setInputObatRacikanForm(prev => ({ ...prev, jml: parseFloat(jml.toFixed(2)) }));
      }
    } else {
      const kandunganNum = parseFloat(kandungan);
      if (!isNaN(kandunganNum) && kapasitas > 0) {
        const jml = kandunganNum * racikan.jml_dr / kapasitas;
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

    setRacikan(prev => ({
      ...prev,
      detail: [...prev.detail, newDetail]
    }));

    closeModalInputObatRacikan();
    setSearchObatRacikan('');
  };

  // Hapus Obat Racikan
  const hapusObatRacikan = (index: number) => {
    setRacikan(prev => ({
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
    if (racikan.nama_racikan && racikan.metode_racik && racikan.detail.length > 0) {
      lines.push(`1. ${racikan.nama_racikan} Jumlah ${racikan.jml_dr} ${racikan.metode_racik} Aturan Pakai ${racikan.aturan_pakai || ''}`);
      
      // Detail racikan (format: -- nama_brng jml)
      racikan.detail.forEach((det) => {
        const jmlStr = det.jml % 1 === 0 ? det.jml.toString() : det.jml.toFixed(2);
        lines.push(`-- ${det.nama_brng} ${jmlStr}`);
      });
    }
    
    return lines.join('\n');
  };

  // Submit Resep Unified
  const submitResepUnified = async () => {
    try {
      // Prepare payload based on active tab
      let payload: any = {
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter || '',
        non_racikan: [],
        racikan: []
      };

      // Validate: at least one type must have data
      const hasNonRacikan = resepNonRacikan.length > 0;
      // Changed validation: metode_racik is optional, only require nama_racikan and detail
      const hasRacikan = racikan.nama_racikan && racikan.detail.length > 0;

      if (!hasNonRacikan && !hasRacikan) {
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          text: 'Belum ada obat yang dipilih (non-racikan atau racikan)'
        });
        return;
      }

      // Map resep non racikan (if any)
      if (hasNonRacikan) {
        payload.non_racikan = resepNonRacikan.map(obat => ({
          kode_brng: obat.kode_brng,
          jml: obat.jml || 1,
          aturan_pakai: obat.aturan_pakai || ''
        }));
      }

      // Map resep racikan (if any)
      if (hasRacikan) {
        // Save racikan data to history
        if (racikan.nama_racikan.trim()) {
          saveNamaRacikanToHistory(racikan.nama_racikan);
        }
        if (racikan.keterangan.trim()) {
          saveKeteranganToHistory(racikan.keterangan);
        }
        if (racikan.aturan_pakai.trim()) {
          saveAturanPakaiToHistory(racikan.aturan_pakai);
        }

        payload.racikan = [{
          nama_racikan: racikan.nama_racikan,
          keterangan: racikan.keterangan || '',
          metode_racik: racikan.metode_racik,
          jml_dr: racikan.jml_dr,
          aturan_pakai: racikan.aturan_pakai,
          detail: racikan.detail.map(det => ({
            kode_brng: det.kode_brng,
            kandungan: det.kandungan,
            jml: det.jml
          }))
        }];
      }

      console.log('Submitting payload:', payload);

      // Submit to backend
      const response = await fetch('/api/resep/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menyimpan resep');
      }

      const result = await response.json();

      // Format resep untuk planning dan update kolom planning (seperti Khanza Java)
      if (onResepSaved) {
        const planningText = formatResepToPlanning();
        onResepSaved(planningText);
      }

      // Reset both forms (since both can be submitted together)
      setResepNonRacikan([]);
      setSearchObatNonRacikan('');
      setRacikan({
        nama_racikan: '',
        keterangan: '',
        metode_racik: '',
        jml_dr: 1,
        aturan_pakai: '',
        detail: []
      });
      setSearchObatRacikan('');

      // Close modal first
      onClose();

      // Then show success message
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Resep berhasil disimpan!\nNo. Resep: ${result.no_resep || '-'}`,
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

    // Copy racikan (first one)
    if (resep.racikan && resep.racikan.length > 0) {
      const firstRacikan = resep.racikan[0];
      setRacikan({
        nama_racikan: firstRacikan.nama_racik || '',
        keterangan: '',
        metode_racik: firstRacikan.metode || '',
        jml_dr: firstRacikan.jml_dr || 1,
        aturan_pakai: firstRacikan.aturan_pakai || '',
        detail: firstRacikan.detail || []
      });
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

  return (
    <>
      {/* Main Modal Resep */}
      <div className="modal-overlay">
        <div className="modal-resep">
          <div className="modal-header-resep">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg fill="currentColor" width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <path d="M480,224a31.991,31.991,0,0,0-32,32V448H64V256a32,32,0,0,0-64,0V480a31.991,31.991,0,0,0,32,32H480a31.991,31.991,0,0,0,32-32V256A31.991,31.991,0,0,0,480,224Z" fillRule="evenodd"/>
                <path d="M288,224V28.091C288,12.578,273.688,0,256,0s-32,12.578-32,28.091V224H128L256,352,384,224Z" fillRule="evenodd"/>
              </svg>
              Input Resep - {patient.nm_pasien} ({patient.no_rkm_medis})
            </h5>
            <button onClick={onClose} className="btn-close-modal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="modal-body-resep">
            {/* Tab Navigation */}
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${activeResepTab === 'non-racikan' ? 'active' : ''}`}
                  onClick={() => setActiveResepTab('non-racikan')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="16" height="16" viewBox="-0.003 0 99.979 99.979" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EBECED" d="M92.869 7.105c9.478 9.476 9.478 24.832 0 34.308L41.411 92.869c-9.475 9.474-24.833 9.474-34.307 0-9.476-9.475-9.476-24.832 0-34.308L58.562 7.105c9.475-9.473 24.834-9.473 34.307 0z"/>
                    <path fill="#3B97D3" d="M32.548 33.122L7.105 58.563c-9.476 9.476-9.476 24.833 0 34.308 9.474 9.475 24.832 9.475 34.307 0L66.85 67.43 32.548 33.122z"/>
                    <path fill="#2086BF" d="M65.43 68.862L31.134 34.568l1.414-1.414 34.294 34.294z"/>
                    <path fill="#55A6DC" d="M38.096 41.51L12.7 66.906a5.894 5.894 0 0 0 0 8.339 5.896 5.896 0 0 0 8.339 0l25.396-25.396-8.339-8.339z"/>
                    <path fill="#EFF0F1" d="M75.244 12.7a5.897 5.897 0 0 0-8.343 0L39.51 40.096l8.339 8.339 27.396-27.396a5.899 5.899 0 0 0-.001-8.339z"/>
                    <path fill="#4F9ED4" d="M47.862 48.444l-1.414 1.414-8.335-8.336 1.414-1.414z"/>
                  </svg>
                  Non Racikan
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${activeResepTab === 'racikan' ? 'active' : ''}`}
                  onClick={() => setActiveResepTab('racikan')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <svg fill="currentColor" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.51,19a4,4,0,0,0,4.61,1.9C19.87,20.37,21,18.68,21,16V7.15a4.39,4.39,0,0,0-2.79-4A4,4,0,0,0,13,7v3" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></path>
                    <line x1="14.32" y1="12" x2="21" y2="12" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></line>
                    <path d="M9,9a6,6,0,1,1-6,6A6,6,0,0,1,9,9ZM5,11l8,8" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></path>
                  </svg>
                  Racikan
                </button>
              </li>
            </ul>

            {/* Tab Content: Non Racikan */}
            {activeResepTab === 'non-racikan' && (
              <div className="tab-content-resep">
                <div className="mb-3">
                  <label className="form-label fw-bold">Cari Obat</label>
                  <div className="search-obat-wrapper">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ketik nama obat untuk mencari otomatis..."
                      value={searchObatNonRacikan}
                      onChange={(e) => setSearchObatNonRacikan(e.target.value)}
                      autoComplete="off"
                    />

                    {/* Dropdown hasil pencarian */}
                    {showObatDropdown && obatList && obatList.length > 0 && (
                      <div className="obat-dropdown">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%' }}>Kode Barang</th>
                              <th>Nama Barang</th>
                              <th style={{ width: '10%' }}>Satuan</th>
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
                      </div>
                    )}

                    {/* Pesan jika tidak ada hasil */}
                    {showObatDropdown && obatList && obatList.length === 0 && (
                      <div className="alert alert-info mt-2" style={{ fontSize: '13px' }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchObatNonRacikan}"
                      </div>
                    )}
                  </div>
                </div>

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
            )}

            {/* Tab Content: Racikan */}
            {activeResepTab === 'racikan' && (
              <div className="tab-content-resep">
                <div className="row mb-3">
                  <div className="col-md-6" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Nama Racikan</label>
                    <input
                      type="text"
                      className="form-control"
                      value={racikan.nama_racikan}
                      onChange={(e) => {
                        setRacikan(prev => ({ ...prev, nama_racikan: e.target.value }));
                        filterNamaRacikan(e.target.value);
                      }}
                      onFocus={() => {
                        filterNamaRacikan(racikan.nama_racikan);
                        setShowNamaRacikanDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowNamaRacikanDropdown(false), 200);
                      }}
                      placeholder="Contoh: Pulvis / Racikan Batuk"
                      autoComplete="off"
                    />
                    {/* Dropdown Nama Racikan History */}
                    {showNamaRacikanDropdown && filteredNamaRacikan.length > 0 && (
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
                        {filteredNamaRacikan.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setRacikan(prev => ({ ...prev, nama_racikan: item }));
                              setShowNamaRacikanDropdown(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              borderBottom: index < filteredNamaRacikan.length - 1 ? '1px solid #e5e7eb' : 'none',
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
                  <div className="col-md-6" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Keterangan</label>
                    <input
                      type="text"
                      className="form-control"
                      value={racikan.keterangan}
                      onChange={(e) => {
                        setRacikan(prev => ({ ...prev, keterangan: e.target.value }));
                        filterKeterangan(e.target.value);
                      }}
                      onFocus={() => {
                        filterKeterangan(racikan.keterangan);
                        setShowKeteranganDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowKeteranganDropdown(false), 200);
                      }}
                      placeholder="Keterangan tambahan"
                      autoComplete="off"
                    />
                    {/* Dropdown Keterangan History */}
                    {showKeteranganDropdown && filteredKeterangan.length > 0 && (
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
                        {filteredKeterangan.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setRacikan(prev => ({ ...prev, keterangan: item }));
                              setShowKeteranganDropdown(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              borderBottom: index < filteredKeterangan.length - 1 ? '1px solid #e5e7eb' : 'none',
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
                </div>

                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Metode Racik</label>
                    <select
                      className="form-select"
                      value={racikan.metode_racik}
                      onChange={(e) => setRacikan(prev => ({ ...prev, metode_racik: e.target.value }))}
                    >
                      <option value="">Pilih Metode</option>
                      <option value="Kapsul">Kapsul</option>
                      <option value="Puyer">Puyer</option>
                      <option value="Sirup">Sirup</option>
                      <option value="Salep">Salep</option>
                      <option value="Krim">Krim</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Jumlah Racikan /Bungkus</label>
                    <input
                      type="number"
                      className="form-control"
                      value={racikan.jml_dr}
                      onChange={(e) => setRacikan(prev => ({ ...prev, jml_dr: parseInt(e.target.value) || 1 }))}
                      placeholder="Jumlah"
                      min="1"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className="col-md-4" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Aturan Pakai</label>
                    <input
                      type="text"
                      className="form-control"
                      value={racikan.aturan_pakai}
                      onChange={(e) => {
                        setRacikan(prev => ({ ...prev, aturan_pakai: e.target.value }));
                        filterAturanPakaiRacikan(e.target.value);
                      }}
                      onFocus={() => {
                        filterAturanPakaiRacikan(racikan.aturan_pakai);
                        setShowAturanPakaiDropdownRacikan(true);
                      }}
                      onBlur={() => {
                        // Delay to allow click on dropdown
                        setTimeout(() => setShowAturanPakaiDropdownRacikan(false), 200);
                      }}
                      placeholder="3x1 sehari"
                      autoComplete="off"
                    />
                    {/* Dropdown Aturan Pakai History for Racikan */}
                    {showAturanPakaiDropdownRacikan && filteredAturanPakaiRacikan.length > 0 && (
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
                        {filteredAturanPakaiRacikan.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setRacikan(prev => ({ ...prev, aturan_pakai: item }));
                              setShowAturanPakaiDropdownRacikan(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              borderBottom: index < filteredAturanPakaiRacikan.length - 1 ? '1px solid #e5e7eb' : 'none',
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
                </div>

                <hr />

                <div className="mb-3">
                  <label className="form-label fw-bold">Detail Obat Racikan</label>
                  <div className="search-obat-wrapper">
                    <input
                      type="text"
                      className="form-control mb-2"
                      placeholder="Ketik nama obat untuk mencari otomatis..."
                      value={searchObatRacikan}
                      onChange={(e) => setSearchObatRacikan(e.target.value)}
                      autoComplete="off"
                    />

                    {/* Dropdown hasil pencarian racikan */}
                    {showObatDropdownRacikan && obatListRacikan && obatListRacikan.length > 0 && (
                      <div className="obat-dropdown">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%' }}>Kode Barang</th>
                              <th>Nama Barang</th>
                              <th style={{ width: '10%' }}>Satuan</th>
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
                      </div>
                    )}

                    {/* Pesan jika tidak ada hasil */}
                    {showObatDropdownRacikan && obatListRacikan && obatListRacikan.length === 0 && (
                      <div className="alert alert-info mt-2" style={{ fontSize: '13px' }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchObatRacikan}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Daftar Obat dalam Racikan</label>
                  {racikan.detail.length === 0 ? (
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
                          {racikan.detail.map((obat, index) => (
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
            )}
          </div>

          {/* Unified Save Button - Moved outside modal-body */}
          <div className="modal-footer-actions">
            <div className="d-flex justify-content-between align-items-center">
              <button type="button" onClick={openModalRiwayatResep} className="btn btn-info" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Riwayat Resep
              </button>
              <div className="d-flex gap-2">
                <button type="button" onClick={submitResepUnified} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Simpan Resep
                </button>
                <button type="button" onClick={onClose} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Tutup
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
        <div className="modal-overlay" onClick={closeModalRiwayatResep}>
          <div className="modal-riwayat-resep" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Riwayat Resep - {patient.nm_pasien} ({patient.no_rkm_medis})
              </h5>
              <button onClick={closeModalRiwayatResep} className="btn-close-modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body-custom">
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
                    <div key={index} className="resep-card mb-3">
                      {/* Resep Header */}
                      <div className="resep-header">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', flex: 1 }}>
                            <div style={{ fontSize: 14 }}>
                              <strong style={{ color: '#374151' }}>No. Resep:</strong> <span style={{ color: '#111827' }}>{resep.no_resep}</span>
                            </div>
                            <div style={{ fontSize: 14 }}>
                              <strong style={{ color: '#374151' }}>No. Rawat:</strong> <span style={{ color: '#111827' }}>{resep.no_rawat}</span>
                            </div>
                            <div style={{ fontSize: 14 }}>
                              <strong style={{ color: '#374151' }}>Tanggal:</strong> <span style={{ color: '#111827' }}>{formatTanggal(resep.tgl_peresepan)} {resep.jam_peresepan}</span>
                            </div>
                            <div style={{ fontSize: 14 }}>
                              <strong style={{ color: '#374151' }}>Dokter:</strong> <span style={{ color: '#111827' }}>{resep.nm_dokter}</span>
                            </div>
                          </div>
                          <div style={{ marginLeft: 24 }}>
                            <button
                              onClick={() => copyResepToForm(resep)}
                              className="btn btn-sm btn-primary"
                              title="Copy resep ini ke form input"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              Copy Resep
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Non Racikan */}
                      {resep.non_racikan && resep.non_racikan.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                            <svg width="18" height="18" viewBox="-0.003 0 99.979 99.979" xmlns="http://www.w3.org/2000/svg">
                              <path fill="#EBECED" d="M92.869 7.105c9.478 9.476 9.478 24.832 0 34.308L41.411 92.869c-9.475 9.474-24.833 9.474-34.307 0-9.476-9.475-9.476-24.832 0-34.308L58.562 7.105c9.475-9.473 24.834-9.473 34.307 0z"/>
                              <path fill="#3B97D3" d="M32.548 33.122L7.105 58.563c-9.476 9.476-9.476 24.833 0 34.308 9.474 9.475 24.832 9.475 34.307 0L66.85 67.43 32.548 33.122z"/>
                              <path fill="#2086BF" d="M65.43 68.862L31.134 34.568l1.414-1.414 34.294 34.294z"/>
                              <path fill="#55A6DC" d="M38.096 41.51L12.7 66.906a5.894 5.894 0 0 0 0 8.339 5.896 5.896 0 0 0 8.339 0l25.396-25.396-8.339-8.339z"/>
                              <path fill="#EFF0F1" d="M75.244 12.7a5.897 5.897 0 0 0-8.343 0L39.51 40.096l8.339 8.339 27.396-27.396a5.899 5.899 0 0 0-.001-8.339z"/>
                              <path fill="#4F9ED4" d="M47.862 48.444l-1.414 1.414-8.335-8.336 1.414-1.414z"/>
                            </svg>
                            Obat Non-Racikan
                          </h5>
                          <table className="table table-sm table-bordered">
                            <thead className="table-light">
                              <tr>
                                <th style={{ width: '5%' }}>No</th>
                                <th style={{ width: '15%' }}>Kode</th>
                                <th>Nama Obat</th>
                                <th style={{ width: '10%' }}>Jumlah</th>
                                <th style={{ width: '10%' }}>Satuan</th>
                                <th style={{ width: '25%' }}>Aturan Pakai</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resep.non_racikan.map((obat: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="text-center">{idx + 1}</td>
                                  <td>{obat.kode_brng}</td>
                                  <td>{obat.nama_brng}</td>
                                  <td className="text-center">{obat.jml}</td>
                                  <td className="text-center">{obat.kode_sat}</td>
                                  <td>{obat.aturan_pakai}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Racikan */}
                      {resep.racikan && resep.racikan.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-success" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                            <svg fill="currentColor" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="M13.51,19a4,4,0,0,0,4.61,1.9C19.87,20.37,21,18.68,21,16V7.15a4.39,4.39,0,0,0-2.79-4A4,4,0,0,0,13,7v3" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></path>
                              <line x1="14.32" y1="12" x2="21" y2="12" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></line>
                              <path d="M9,9a6,6,0,1,1-6,6A6,6,0,0,1,9,9ZM5,11l8,8" style={{ fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }}></path>
                            </svg>
                            Obat Racikan
                          </h5>
                          {resep.racikan.map((racikan: any, ridx: number) => (
                            <div key={ridx} className="racikan-item mb-3">
                              <div className="racikan-header-info">
                                <strong>No. Racik {racikan.no_racik}:</strong> {racikan.nama_racik}
                                <span className="ms-2 badge bg-secondary">{racikan.metode || 'N/A'}</span>
                                <span className="ms-2">| Jumlah: {racikan.jml_dr}</span>
                                <span className="ms-2">| Aturan: {racikan.aturan_pakai}</span>
                              </div>
                              <table className="table table-sm table-bordered mt-2">
                                <thead className="table-light">
                                  <tr>
                                    <th style={{ width: '5%' }}>No</th>
                                    <th style={{ width: '15%' }}>Kode</th>
                                    <th>Nama Obat</th>
                                    <th style={{ width: '12%' }}>Jumlah</th>
                                    <th style={{ width: '12%' }}>Satuan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {racikan.detail && racikan.detail.map((detail: any, didx: number) => (
                                    <tr key={didx}>
                                      <td className="text-center">{didx + 1}</td>
                                      <td><small>{detail.kode_brng}</small></td>
                                      <td><small>{detail.nama_brng}</small></td>
                                      <td className="text-center"><small>{detail.jml}</small></td>
                                      <td className="text-center"><small>{detail.kode_sat}</small></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
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
