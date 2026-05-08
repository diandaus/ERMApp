import React from 'react';
import Swal from 'sweetalert2';

type LabTabProps = {
  patient: any;
};

export const LabTab: React.FC<LabTabProps> = ({ patient }) => {
  const [activeLabTab, setActiveLabTab] = React.useState<'pk' | 'pa'>('pk');
  const [activeRiwayatTab, setActiveRiwayatTab] = React.useState<'pk' | 'pa'>('pk');

  // Form state
  const [labForm, setLabForm] = React.useState({
    diagnosa_klinis: '',
    informasi_tambahan: ''
  });

  // State untuk PK
  const [searchPK, setSearchPK] = React.useState('');
  const [pemeriksaanPKList, setPemeriksaanPKList] = React.useState<any[]>([]);
  const [selectedPemeriksaanPK, setSelectedPemeriksaanPK] = React.useState<string[]>([]);
  const [loadingPK, setLoadingPK] = React.useState(false);

  // State untuk PA
  const [searchPA, setSearchPA] = React.useState('');
  const [pemeriksaanPAList, setPemeriksaanPAList] = React.useState<any[]>([]);
  const [selectedPemeriksaanPA, setSelectedPemeriksaanPA] = React.useState<string[]>([]);
  const [loadingPA, setLoadingPA] = React.useState(false);

  // State untuk riwayat
  const [riwayatPK, setRiwayatPK] = React.useState<any[]>([]);
  const [riwayatPA, setRiwayatPA] = React.useState<any[]>([]);
  const [loadingRiwayatPK, setLoadingRiwayatPK] = React.useState(false);
  const [loadingRiwayatPA, setLoadingRiwayatPA] = React.useState(false);

  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // State untuk modal hasil lab
  const [showModalHasil, setShowModalHasil] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [hasilLabData, setHasilLabData] = React.useState<any>(null);

  // State untuk dropdown pencarian
  const [showDropdownPK, setShowDropdownPK] = React.useState(false);
  const [showDropdownPA, setShowDropdownPA] = React.useState(false);

  // History State untuk dropdown
  const [diagnosaKlinisHistory, setDiagnosaKlinisHistory] = React.useState<string[]>([]);
  const [informasiTambahanHistory, setInformasiTambahanHistory] = React.useState<string[]>([]);
  
  // Dropdown visibility state
  const [showDiagnosaKlinisDropdown, setShowDiagnosaKlinisDropdown] = React.useState(false);
  const [showInformasiTambahanDropdown, setShowInformasiTambahanDropdown] = React.useState(false);
  
  // Filtered history state
  const [filteredDiagnosaKlinis, setFilteredDiagnosaKlinis] = React.useState<string[]>([]);
  const [filteredInformasiTambahan, setFilteredInformasiTambahan] = React.useState<string[]>([]);

  // Fetch daftar pemeriksaan PK
  React.useEffect(() => {
    if (activeLabTab === 'pk') {
      fetchPemeriksaanPK();
    }
  }, [activeLabTab, searchPK]);

  // Fetch daftar pemeriksaan PA
  React.useEffect(() => {
    if (activeLabTab === 'pa') {
      fetchPemeriksaanPA();
    }
  }, [activeLabTab, searchPA]);

  // Fetch riwayat saat tab riwayat dibuka
  React.useEffect(() => {
    if (activeRiwayatTab === 'pk') {
      fetchRiwayatPK();
    } else {
      fetchRiwayatPA();
    }
  }, [activeRiwayatTab, patient.no_rawat]);

  // Load history from localStorage on mount
  React.useEffect(() => {
    // Load Diagnosa Klinis History
    const savedDiagnosaKlinis = localStorage.getItem('diagnosa_klinis_history');
    if (savedDiagnosaKlinis) {
      try {
        setDiagnosaKlinisHistory(JSON.parse(savedDiagnosaKlinis));
      } catch (e) {
        console.error('Failed to parse diagnosa klinis history:', e);
      }
    }

    // Load Informasi Tambahan History
    const savedInformasiTambahan = localStorage.getItem('informasi_tambahan_history');
    if (savedInformasiTambahan) {
      try {
        setInformasiTambahanHistory(JSON.parse(savedInformasiTambahan));
      } catch (e) {
        console.error('Failed to parse informasi tambahan history:', e);
      }
    }
  }, []);

  const fetchPemeriksaanPK = async () => {
    setLoadingPK(true);
    try {
      const params = new URLSearchParams({
        kategori: 'PK',
        search: searchPK,
        kd_pj: patient.kd_pj || '',
      });

      const response = await fetch(`/api/lab/jenis-perawatan?${params.toString()}`);
      if (!response.ok) throw new Error('Gagal fetch pemeriksaan PK');

      const data = await response.json();
      setPemeriksaanPKList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching pemeriksaan PK:', err);
      setPemeriksaanPKList([]);
    } finally {
      setLoadingPK(false);
    }
  };

  const fetchPemeriksaanPA = async () => {
    setLoadingPA(true);
    try {
      const params = new URLSearchParams({
        kategori: 'PA',
        search: searchPA,
        kd_pj: patient.kd_pj || '',
      });

      const response = await fetch(`/api/lab/jenis-perawatan?${params.toString()}`);
      if (!response.ok) throw new Error('Gagal fetch pemeriksaan PA');

      const data = await response.json();
      setPemeriksaanPAList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching pemeriksaan PA:', err);
      setPemeriksaanPAList([]);
    } finally {
      setLoadingPA(false);
    }
  };

  const fetchRiwayatPK = async () => {
    setLoadingRiwayatPK(true);
    try {
      const response = await fetch(`/api/lab/riwayat-pk/${encodeURIComponent(patient.no_rawat)}`);
      if (!response.ok) throw new Error('Gagal fetch riwayat PK');

      const data = await response.json();

      // Filter hanya data hari ini
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const filteredData = (Array.isArray(data) ? data : []).filter((item: any) => {
        if (!item.tgl_permintaan) return false;

        // Handle ISO 8601 format (dengan T dan timezone)
        if (item.tgl_permintaan.includes('T')) {
          const itemDate = new Date(item.tgl_permintaan);
          const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
          return itemDateStr === todayStr;
        }

        // Handle YYYY-MM-DD format
        if (item.tgl_permintaan.includes('-')) {
          const itemDateStr = item.tgl_permintaan.split(' ')[0]; // Remove time if exists
          return itemDateStr === todayStr;
        }

        return false;
      });

      setRiwayatPK(filteredData);
    } catch (err) {
      console.error('Error fetching riwayat PK:', err);
      setRiwayatPK([]);
    } finally {
      setLoadingRiwayatPK(false);
    }
  };

  const fetchRiwayatPA = async () => {
    setLoadingRiwayatPA(true);
    try {
      const response = await fetch(`/api/lab/riwayat-pa/${encodeURIComponent(patient.no_rawat)}`);
      if (!response.ok) throw new Error('Gagal fetch riwayat PA');

      const data = await response.json();

      // Filter hanya data hari ini
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const filteredData = (Array.isArray(data) ? data : []).filter((item: any) => {
        if (!item.tgl_permintaan) return false;

        // Handle ISO 8601 format (dengan T dan timezone)
        if (item.tgl_permintaan.includes('T')) {
          const itemDate = new Date(item.tgl_permintaan);
          const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
          return itemDateStr === todayStr;
        }

        // Handle YYYY-MM-DD format
        if (item.tgl_permintaan.includes('-')) {
          const itemDateStr = item.tgl_permintaan.split(' ')[0]; // Remove time if exists
          return itemDateStr === todayStr;
        }

        return false;
      });

      setRiwayatPA(filteredData);
    } catch (err) {
      console.error('Error fetching riwayat PA:', err);
      setRiwayatPA([]);
    } finally {
      setLoadingRiwayatPA(false);
    }
  };

  // Delete permintaan lab PK
  const handleDeleteLabPK = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PK?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/lab/permintaan-pk/${encodeURIComponent(noorder)}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Gagal menghapus permintaan lab');
        }

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Permintaan lab PK berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh list
        fetchRiwayatPK();
      } catch (err: any) {
        console.error('Error deleting lab PK:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Gagal menghapus permintaan lab'
        });
      }
    }
  };

  // Delete permintaan lab PA
  const handleDeleteLabPA = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PA?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/lab/permintaan-pa/${encodeURIComponent(noorder)}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Gagal menghapus permintaan lab');
        }

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Permintaan lab PA berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh list
        fetchRiwayatPA();
      } catch (err: any) {
        console.error('Error deleting lab PA:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Gagal menghapus permintaan lab'
        });
      }
    }
  };

  // Save to history functions
  const saveDiagnosaKlinisToHistory = (diagnosaKlinis: string) => {
    if (!diagnosaKlinis.trim()) return;
    const trimmed = diagnosaKlinis.trim();
    let newHistory = [...diagnosaKlinisHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setDiagnosaKlinisHistory(newHistory);
    localStorage.setItem('diagnosa_klinis_history', JSON.stringify(newHistory));
  };

  const saveInformasiTambahanToHistory = (informasiTambahan: string) => {
    if (!informasiTambahan.trim()) return;
    const trimmed = informasiTambahan.trim();
    let newHistory = [...informasiTambahanHistory];
    newHistory = newHistory.filter(item => item !== trimmed);
    newHistory.unshift(trimmed);
    newHistory = newHistory.slice(0, 20);
    setInformasiTambahanHistory(newHistory);
    localStorage.setItem('informasi_tambahan_history', JSON.stringify(newHistory));
  };

  // Filter history functions with smart prioritization
  const filterDiagnosaKlinis = (input: string) => {
    if (!input.trim()) {
      setFilteredDiagnosaKlinis(diagnosaKlinisHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    diagnosaKlinisHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredDiagnosaKlinis([...startsWith, ...contains].slice(0, 10));
  };

  const filterInformasiTambahan = (input: string) => {
    if (!input.trim()) {
      setFilteredInformasiTambahan(informasiTambahanHistory.slice(0, 10));
      return;
    }
    const lowerInput = input.toLowerCase().trim();
    const startsWith: string[] = [];
    const contains: string[] = [];
    informasiTambahanHistory.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.startsWith(lowerInput)) {
        startsWith.push(item);
      } else if (lowerItem.includes(lowerInput)) {
        contains.push(item);
      }
    });
    setFilteredInformasiTambahan([...startsWith, ...contains].slice(0, 10));
  };

  const togglePemeriksaanPK = (kdJenisPrw: string) => {
    setSelectedPemeriksaanPK(prev =>
      prev.includes(kdJenisPrw)
        ? prev.filter(k => k !== kdJenisPrw)
        : [...prev, kdJenisPrw]
    );
  };

  const togglePemeriksaanPA = (kdJenisPrw: string) => {
    setSelectedPemeriksaanPA(prev =>
      prev.includes(kdJenisPrw)
        ? prev.filter(k => k !== kdJenisPrw)
        : [...prev, kdJenisPrw]
    );
  };

  const handleSubmitPK = async () => {
    if (!labForm.diagnosa_klinis.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Diagnosis Klinis wajib diisi!',
      });
      return;
    }

    if (selectedPemeriksaanPK.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Pilih minimal satu pemeriksaan!',
      });
      return;
    }

    setLoadingSubmit(true);
    try {
      // Get current date/time in local timezone
      const now = new Date();

      // Format date as YYYY-MM-DD
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const tglPermintaan = `${year}-${month}-${day}`;

      // Format time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const jamPermintaan = `${hours}:${minutes}:${seconds}`;

      const payload = {
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter || '',
        status_lanjut: 'ralan',
        diagnosis_klinis: labForm.diagnosa_klinis,
        informasi_tambahan: labForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanPK,
        detail_pemeriksaan: [],
        tgl_permintaan: tglPermintaan,
        jam_permintaan: jamPermintaan,
      };

      console.log('Sending payload PK:', payload);

      const response = await fetch('/api/lab/permintaan-pk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Gagal menyimpan permintaan lab PK');
      }

      const result = await response.json();

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Lab PK berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
        timer: 3000,
        showConfirmButton: true,
      });

      // Save to history setelah berhasil submit
      if (labForm.diagnosa_klinis.trim()) {
        saveDiagnosaKlinisToHistory(labForm.diagnosa_klinis);
      }
      if (labForm.informasi_tambahan.trim()) {
        saveInformasiTambahanToHistory(labForm.informasi_tambahan);
      }

      // Reset form
      setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' });
      setSelectedPemeriksaanPK([]);
      fetchRiwayatPK();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan permintaan lab PK',
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleSubmitPA = async () => {
    if (!labForm.diagnosa_klinis.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Diagnosis Klinis wajib diisi!',
      });
      return;
    }

    if (selectedPemeriksaanPA.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Pilih minimal satu pemeriksaan!',
      });
      return;
    }

    setLoadingSubmit(true);
    try {
      // Get current date/time in local timezone
      const now = new Date();

      // Format date as YYYY-MM-DD
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const tglPermintaan = `${year}-${month}-${day}`;

      // Format time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const jamPermintaan = `${hours}:${minutes}:${seconds}`;

      const payload = {
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter || '',
        status_lanjut: 'ralan',
        diagnosis_klinis: labForm.diagnosa_klinis,
        informasi_tambahan: labForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanPA,
        tgl_permintaan: tglPermintaan,
        jam_permintaan: jamPermintaan,
        tgl_pengambilan_bahan: tglPermintaan,
        diperoleh_dengan: '',
        lokasi_pengambilan: '',
        diawetkan: '',
        dilakukan_pa: '',
        tgl_pa: '',
        nomor_pa: '',
        diagnosa_pa: '',
      };

      console.log('Sending payload PA:', payload);

      const response = await fetch('/api/lab/permintaan-pa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Gagal menyimpan permintaan lab PA');
      }

      const result = await response.json();

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Lab PA berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
        timer: 3000,
        showConfirmButton: true,
      });

      // Save to history setelah berhasil submit
      if (labForm.diagnosa_klinis.trim()) {
        saveDiagnosaKlinisToHistory(labForm.diagnosa_klinis);
      }
      if (labForm.informasi_tambahan.trim()) {
        saveInformasiTambahanToHistory(labForm.informasi_tambahan);
      }

      // Reset form
      setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' });
      setSelectedPemeriksaanPA([]);
      fetchRiwayatPA();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan permintaan lab PA',
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleLihatHasil = async (item: any) => {
    setSelectedOrder(item);
    // Temporarily set permintaan data saja
    setHasilLabData({ detail_pemeriksaan: item.detail_pemeriksaan || [] });
    setShowModalHasil(true);

    // Fetch data hasil lab lengkap dari backend
    try {
      const response = await fetch(
        `/api/lab/hasil-detail?noorder=${item.noorder}&kategori=${activeRiwayatTab.toUpperCase()}&no_rawat=${encodeURIComponent(patient.no_rawat)}`
      );

      if (response.ok) {
        const data = await response.json();
        setHasilLabData(data);
      }
    } catch (error) {
      console.error('Error fetching hasil lab detail:', error);
    }
  };

  const closeModalHasil = () => {
    setShowModalHasil(false);
    setSelectedOrder(null);
    setHasilLabData(null);
  };

  const formatDateTime = (tgl: string, jam: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';

    let formattedDate = '';
    let formattedTime = '';

    // Parse tanggal - support format ISO 8601 dan YYYY-MM-DD
    if (tgl.includes('T')) {
      // Format ISO 8601 (dengan timezone): 2025-12-09T00:00:00+07:00
      const date = new Date(tgl);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    } else if (tgl.includes('-') && tgl.length >= 10) {
      // Format YYYY-MM-DD
      const parts = tgl.split('-');
      const year = parts[0];
      const month = parts[1];
      const day = parts[2].substring(0, 2);
      formattedDate = `${day}/${month}/${year}`;
    } else {
      formattedDate = tgl;
    }

    // Ambil jam dari parameter terpisah (hanya tampilkan jika bukan 00:00:00)
    if (jam && jam !== '00:00:00') {
      formattedTime = jam;
    }

    return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
      {/* Form Input Lab */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Form Permintaan Laboratorium
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Indikasi/Diagnosis Klinis <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={labForm.diagnosa_klinis}
              onChange={(e) => {
                setLabForm({ ...labForm, diagnosa_klinis: e.target.value });
                filterDiagnosaKlinis(e.target.value);
              }}
              onFocus={() => {
                filterDiagnosaKlinis(labForm.diagnosa_klinis);
                setShowDiagnosaKlinisDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowDiagnosaKlinisDropdown(false), 200);
              }}
              placeholder="Masukkan diagnosis klinis..."
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
            {/* Dropdown Diagnosa Klinis History */}
            {showDiagnosaKlinisDropdown && filteredDiagnosaKlinis.length > 0 && (
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
                {filteredDiagnosaKlinis.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setLabForm({ ...labForm, diagnosa_klinis: item });
                      setShowDiagnosaKlinisDropdown(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderBottom: index < filteredDiagnosaKlinis.length - 1 ? '1px solid #e5e7eb' : 'none',
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
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Informasi Tambahan
            </label>
            <input
              type="text"
              value={labForm.informasi_tambahan}
              onChange={(e) => {
                setLabForm({ ...labForm, informasi_tambahan: e.target.value });
                filterInformasiTambahan(e.target.value);
              }}
              onFocus={() => {
                filterInformasiTambahan(labForm.informasi_tambahan);
                setShowInformasiTambahanDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowInformasiTambahanDropdown(false), 200);
              }}
              placeholder="Informasi tambahan (opsional)..."
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
            {/* Dropdown Informasi Tambahan History */}
            {showInformasiTambahanDropdown && filteredInformasiTambahan.length > 0 && (
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
                {filteredInformasiTambahan.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setLabForm({ ...labForm, informasi_tambahan: item });
                      setShowInformasiTambahanDropdown(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderBottom: index < filteredInformasiTambahan.length - 1 ? '1px solid #e5e7eb' : 'none',
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

        {/* Tab PK/PA */}
        <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveLabTab('pk')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeLabTab === 'pk' ? '#e0f2fe' : 'transparent',
                borderBottom: activeLabTab === 'pk' ? '3px solid #1AB1E5' : '3px solid transparent',
                color: activeLabTab === 'pk' ? '#1AB1E5' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeLabTab === 'pk' ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              🔬 Lab PK (Patologi Klinik)
            </button>
            <button
              onClick={() => setActiveLabTab('pa')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeLabTab === 'pa' ? '#e0f2fe' : 'transparent',
                borderBottom: activeLabTab === 'pa' ? '3px solid #1AB1E5' : '3px solid transparent',
                color: activeLabTab === 'pa' ? '#1AB1E5' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeLabTab === 'pa' ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              🧪 Lab PA (Patologi Anatomi)
            </button>
          </div>
        </div>

        {/* Tab Content PK */}
        {activeLabTab === 'pk' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
              {/* Kolom Kiri - Daftar Pemeriksaan dengan Dropdown */}
              <div>
                <div style={{ marginBottom: 12, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchPK}
                    onChange={(e) => {
                      setSearchPK(e.target.value);
                      setShowDropdownPK(true);
                    }}
                    onFocus={() => setShowDropdownPK(true)}
                    onBlur={() => setTimeout(() => setShowDropdownPK(false), 200)}
                    placeholder="Cari pemeriksaan PK..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                    onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                  />

                  {/* Dropdown Pemeriksaan */}
                  {showDropdownPK && searchPK.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      maxHeight: 300,
                      overflowY: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#ffffff',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      zIndex: 10
                    }}>
                      {loadingPK ? (
                        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                          <div style={{
                            display: 'inline-block',
                            width: 20,
                            height: 20,
                            border: '2px solid #f3f4f6',
                            borderTop: '2px solid #1AB1E5',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                        </div>
                      ) : pemeriksaanPKList.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                          Tidak ada hasil pencarian
                        </div>
                      ) : (
                        pemeriksaanPKList.map((item, idx) => (
                          <label
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              background: selectedPemeriksaanPK.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                              borderBottom: idx < pemeriksaanPKList.length - 1 ? '1px solid #f3f4f6' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!selectedPemeriksaanPK.includes(item.kd_jenis_prw)) {
                                e.currentTarget.style.background = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!selectedPemeriksaanPK.includes(item.kd_jenis_prw)) {
                                e.currentTarget.style.background = '#ffffff';
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPemeriksaanPK.includes(item.kd_jenis_prw)}
                              onChange={() => togglePemeriksaanPK(item.kd_jenis_prw)}
                              style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                                {item.nm_perawatan}
                              </div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                Kode: {item.kd_jenis_prw}
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Kolom Kanan - Item Yang Dipilih */}
              <div>
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #1AB1E5',
                  borderRadius: 8,
                  padding: '8px 12px',
                  minHeight: 42,
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1AB1E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: selectedPemeriksaanPK.length > 0 ? 12 : 0
                  }}>
                    <span>✓ Item Dipilih ({selectedPemeriksaanPK.length})</span>
                    {selectedPemeriksaanPK.length > 0 && (
                      <button
                        onClick={() => setSelectedPemeriksaanPK([])}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px'
                        }}
                      >
                        Hapus Semua
                      </button>
                    )}
                  </div>
                  {selectedPemeriksaanPK.length > 0 && (
                    <div style={{
                      overflowY: 'auto'
                    }}>
                      {selectedPemeriksaanPK.map((kdJenisPrw, idx) => {
                        const item = pemeriksaanPKList.find(p => p.kd_jenis_prw === kdJenisPrw);
                        return (
                          <div
                            key={idx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #1AB1E5',
                              borderRadius: 6,
                              padding: '8px 10px',
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>
                                {item?.nm_perawatan || kdJenisPrw}
                              </div>
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                                {kdJenisPrw}
                              </div>
                            </div>
                            <button
                              onClick={() => togglePemeriksaanPK(kdJenisPrw)}
                              style={{
                                background: '#fee2e2',
                                border: 'none',
                                color: '#ef4444',
                                borderRadius: 4,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 500
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button
                onClick={handleSubmitPK}
                disabled={loadingSubmit}
                style={{
                  padding: '10px 20px',
                  background: loadingSubmit ? '#9ca3af' : '#1AB1E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 500,
                  cursor: loadingSubmit ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => !loadingSubmit && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {loadingSubmit ? (
                  <>⏳ Menyimpan...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Simpan Permintaan Lab PK
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedPemeriksaanPK([]);
                  setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' });
                }}
                style={{
                  padding: '10px 20px',
                  background: '#ffffff',
                  color: '#1AB1E5',
                  border: '2px solid #1AB1E5',
                  borderRadius: 8,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Tab Content PA */}
        {activeLabTab === 'pa' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
              {/* Kolom Kiri - Daftar Pemeriksaan dengan Dropdown */}
              <div>
                <div style={{ marginBottom: 12, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchPA}
                    onChange={(e) => {
                      setSearchPA(e.target.value);
                      setShowDropdownPA(true);
                    }}
                    onFocus={() => setShowDropdownPA(true)}
                    onBlur={() => setTimeout(() => setShowDropdownPA(false), 200)}
                    placeholder="Cari pemeriksaan PA..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                    onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                  />

                  {/* Dropdown Pemeriksaan */}
                  {showDropdownPA && searchPA.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      maxHeight: 300,
                      overflowY: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#ffffff',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      zIndex: 10
                    }}>
                      {loadingPA ? (
                        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                          <div style={{
                            display: 'inline-block',
                            width: 20,
                            height: 20,
                            border: '2px solid #f3f4f6',
                            borderTop: '2px solid #1AB1E5',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                        </div>
                      ) : pemeriksaanPAList.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                          Tidak ada hasil pencarian
                        </div>
                      ) : (
                        pemeriksaanPAList.map((item, idx) => (
                          <label
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              background: selectedPemeriksaanPA.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                              borderBottom: idx < pemeriksaanPAList.length - 1 ? '1px solid #f3f4f6' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!selectedPemeriksaanPA.includes(item.kd_jenis_prw)) {
                                e.currentTarget.style.background = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!selectedPemeriksaanPA.includes(item.kd_jenis_prw)) {
                                e.currentTarget.style.background = '#ffffff';
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPemeriksaanPA.includes(item.kd_jenis_prw)}
                              onChange={() => togglePemeriksaanPA(item.kd_jenis_prw)}
                              style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                                {item.nm_perawatan}
                              </div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                Kode: {item.kd_jenis_prw}
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Kolom Kanan - Item Yang Dipilih */}
              <div>
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #1AB1E5',
                  borderRadius: 8,
                  padding: '8px 12px',
                  minHeight: 42,
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1AB1E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: selectedPemeriksaanPA.length > 0 ? 12 : 0
                  }}>
                    <span>✓ Item Dipilih ({selectedPemeriksaanPA.length})</span>
                    {selectedPemeriksaanPA.length > 0 && (
                      <button
                        onClick={() => setSelectedPemeriksaanPA([])}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px'
                        }}
                      >
                        Hapus Semua
                      </button>
                    )}
                  </div>
                  {selectedPemeriksaanPA.length > 0 && (
                    <div style={{
                      overflowY: 'auto'
                    }}>
                      {selectedPemeriksaanPA.map((kdJenisPrw, idx) => {
                        const item = pemeriksaanPAList.find(p => p.kd_jenis_prw === kdJenisPrw);
                        return (
                          <div
                            key={idx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #1AB1E5',
                              borderRadius: 6,
                              padding: '8px 10px',
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>
                                {item?.nm_perawatan || kdJenisPrw}
                              </div>
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                                {kdJenisPrw}
                              </div>
                            </div>
                            <button
                              onClick={() => togglePemeriksaanPA(kdJenisPrw)}
                              style={{
                                background: '#fee2e2',
                                border: 'none',
                                color: '#ef4444',
                                borderRadius: 4,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 500
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button
                onClick={handleSubmitPA}
                disabled={loadingSubmit}
                style={{
                  padding: '10px 20px',
                  background: loadingSubmit ? '#9ca3af' : '#1AB1E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 500,
                  cursor: loadingSubmit ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => !loadingSubmit && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {loadingSubmit ? (
                  <>⏳ Menyimpan...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Simpan Permintaan Lab PA
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedPemeriksaanPA([]);
                  setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' });
                }}
                style={{
                  padding: '10px 20px',
                  background: '#ffffff',
                  color: '#1AB1E5',
                  border: '2px solid #1AB1E5',
                  borderRadius: 8,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Riwayat Permintaan Lab */}
      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 24 }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Riwayat Permintaan Laboratorium
        </h4>

        {/* Tab Riwayat PK/PA */}
        <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveRiwayatTab('pk')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeRiwayatTab === 'pk' ? '#e0f2fe' : 'transparent',
                borderBottom: activeRiwayatTab === 'pk' ? '3px solid #1AB1E5' : '3px solid transparent',
                color: activeRiwayatTab === 'pk' ? '#1AB1E5' : '#6b7280',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeRiwayatTab === 'pk' ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              Lab PK
            </button>
            <button
              onClick={() => setActiveRiwayatTab('pa')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeRiwayatTab === 'pa' ? '#e0f2fe' : 'transparent',
                borderBottom: activeRiwayatTab === 'pa' ? '3px solid #1AB1E5' : '3px solid transparent',
                color: activeRiwayatTab === 'pa' ? '#1AB1E5' : '#6b7280',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeRiwayatTab === 'pa' ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              Lab PA
            </button>
          </div>
        </div>

        {/* Riwayat PK */}
        {activeRiwayatTab === 'pk' && (
          <>
            {loadingRiwayatPK ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <div style={{
                  display: 'inline-block',
                  width: 30,
                  height: 30,
                  border: '3px solid #f3f4f6',
                  borderTop: '3px solid #1AB1E5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: 12 }}>Memuat riwayat...</p>
              </div>
            ) : riwayatPK.length === 0 ? (
              <div style={{
                padding: 20,
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: 8,
                color: '#92400e',
                textAlign: 'center'
              }}>
                Belum ada riwayat permintaan lab PK
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {riwayatPK.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 16,
                      background: '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4 }}>
                          📄 No. Permintaan: {item.noorder}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          📅 {formatDateTime(item.tgl_permintaan, item.jam_permintaan)}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          👨‍⚕️ {item.nm_dokter || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{
                            padding: '4px 12px',
                            background: item.status === 'ralan' ? '#10b981' : '#f59e0b',
                            color: 'white',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            height: 'fit-content'
                          }}>
                            {item.status === 'ralan' ? '✅ Ralan' : '⏳ Pending'}
                          </div>
                          <button
                            onClick={() => activeRiwayatTab === 'pk' ? handleDeleteLabPK(item.noorder) : handleDeleteLabPA(item.noorder)}
                            style={{
                              padding: '6px 10px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                            title="Hapus Permintaan"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => handleLihatHasil(item)}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            color: '#1AB1E5',
                            border: '1.5px solid #1AB1E5',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.background = '#e0f2fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                          Lihat Hasil
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <strong>Diagnosis:</strong> {item.diagnosa_klinis}
                    </div>
                    {item.informasi_tambahan && (
                      <div style={{ fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
                        <strong>Info Tambahan:</strong> {item.informasi_tambahan}
                      </div>
                    )}
                    {item.detail_pemeriksaan && item.detail_pemeriksaan.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                          Detail Pemeriksaan:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.detail_pemeriksaan.map((detail: any, dIdx: number) => (
                            <div
                              key={dIdx}
                              style={{
                                padding: '4px 10px',
                                background: '#e0f2fe',
                                border: '1px solid #1AB1E5',
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#0891B2'
                              }}
                            >
                              {detail.nm_perawatan || detail.kd_jenis_prw}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Riwayat PA */}
        {activeRiwayatTab === 'pa' && (
          <>
            {loadingRiwayatPA ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <div style={{
                  display: 'inline-block',
                  width: 30,
                  height: 30,
                  border: '3px solid #f3f4f6',
                  borderTop: '3px solid #1AB1E5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: 12 }}>Memuat riwayat...</p>
              </div>
            ) : riwayatPA.length === 0 ? (
              <div style={{
                padding: 20,
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: 8,
                color: '#92400e',
                textAlign: 'center'
              }}>
                Belum ada riwayat permintaan lab PA
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {riwayatPA.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 16,
                      background: '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4 }}>
                          📄 No. Permintaan: {item.noorder}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          📅 {formatDateTime(item.tgl_permintaan, item.jam_permintaan)}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          👨‍⚕️ {item.nm_dokter || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{
                            padding: '4px 12px',
                            background: item.status === 'ralan' ? '#10b981' : '#f59e0b',
                            color: 'white',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            height: 'fit-content'
                          }}>
                            {item.status === 'ralan' ? '✅ Ralan' : '⏳ Pending'}
                          </div>
                          <button
                            onClick={() => activeRiwayatTab === 'pk' ? handleDeleteLabPK(item.noorder) : handleDeleteLabPA(item.noorder)}
                            style={{
                              padding: '6px 10px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                            title="Hapus Permintaan"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => handleLihatHasil(item)}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            color: '#1AB1E5',
                            border: '1.5px solid #1AB1E5',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.background = '#e0f2fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                          Lihat Hasil
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <strong>Diagnosis:</strong> {item.diagnosa_klinis}
                    </div>
                    {item.informasi_tambahan && (
                      <div style={{ fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
                        <strong>Info Tambahan:</strong> {item.informasi_tambahan}
                      </div>
                    )}
                    {item.detail_pemeriksaan && item.detail_pemeriksaan.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                          Detail Pemeriksaan:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.detail_pemeriksaan.map((detail: any, dIdx: number) => (
                            <div
                              key={dIdx}
                              style={{
                                padding: '4px 10px',
                                background: '#e0f2fe',
                                border: '1px solid #1AB1E5',
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#0891B2'
                              }}
                            >
                              {detail.nm_perawatan || detail.kd_jenis_prw}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Hasil Lab */}
      {showModalHasil && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
          onClick={closeModalHasil}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 800,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
                🔬 Hasil Pemeriksaan Lab
              </h3>
              <button
                onClick={closeModalHasil}
                style={{
                  background: '#fee2e2',
                  border: 'none',
                  color: '#ef4444',
                  borderRadius: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                ✕ Tutup
              </button>
            </div>

            {/* Info Permintaan */}
            {hasilLabData.header && (
              <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>No. Rawat</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.no_rawat}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>No. RM</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.no_rkm_medis}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Nama Pasien</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.nm_pasien}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cara Bayar</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.png_jawab}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tanggal Pemeriksaan</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {formatDateTime(hasilLabData.header.tgl_periksa, hasilLabData.header.jam)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Dokter</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.nm_dokter}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Petugas Lab</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{hasilLabData.header.nm_petugas || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabel Hasil */}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
              Detail Pemeriksaan:
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1AB1E5', color: 'white' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Pemeriksaan</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Hasil</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Satuan</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Nilai Rujukan</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasilLabData || !hasilLabData.hasil || hasilLabData.hasil.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                        {hasilLabData && hasilLabData.detail_pemeriksaan && hasilLabData.detail_pemeriksaan.length > 0 ? 'Menampilkan daftar permintaan pemeriksaan. Hasil lab belum tersedia.' : 'Belum ada data pemeriksaan'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {hasilLabData.hasil.map((item: any, idx: number) => (
                        <React.Fragment key={idx}>
                          {/* Header Jenis Pemeriksaan */}
                          <tr style={{ background: '#f0f9ff' }}>
                            <td colSpan={5} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1AB1E5' }}>
                              {item.nm_perawatan} (Rp {item.biaya?.toLocaleString() || 0})
                            </td>
                          </tr>
                          {/* Detail Item Pemeriksaan */}
                          {item.detail && item.detail.length > 0 ? (
                            item.detail.map((detail: any, dIdx: number) => (
                              <tr
                                key={dIdx}
                                style={{
                                  background: '#ffffff',
                                  borderBottom: '1px solid #f3f4f6'
                                }}
                              >
                                <td style={{ padding: '8px 12px 8px 24px', fontSize: 12, color: '#374151' }}>
                                  {detail.pemeriksaan}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151', textAlign: 'center', fontWeight: 500 }}>
                                  {detail.nilai || '-'}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                                  {detail.satuan || '-'}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                                  {detail.nilai_rujukan || '-'}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                                  {detail.keterangan || '-'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr style={{ background: '#ffffff' }}>
                              <td colSpan={5} style={{ padding: '8px 12px 8px 24px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
                                Belum ada hasil detail
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {/* Total Biaya */}
                      {hasilLabData.total_biaya > 0 && (
                        <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                          <td colSpan={5} style={{ padding: '12px', fontSize: 13, color: '#111827', textAlign: 'right' }}>
                            Total Biaya: Rp {hasilLabData.total_biaya.toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Kesan dan Saran */}
            {(hasilLabData.kesan || hasilLabData.saran) && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {hasilLabData.kesan && (
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>Kesan:</div>
                    <div style={{ fontSize: 12, color: '#166534' }}>{hasilLabData.kesan}</div>
                  </div>
                )}
                {hasilLabData.saran && (
                  <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, border: '1px solid #fbbf24' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Saran:</div>
                    <div style={{ fontSize: 12, color: '#92400e' }}>{hasilLabData.saran}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS Animation untuk spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
