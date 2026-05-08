import React from 'react';
import Swal from 'sweetalert2';

type RadTabProps = {
  patient: any;
};

export const RadTab: React.FC<RadTabProps> = ({ patient }) => {
  // Form state
  const [radForm, setRadForm] = React.useState({
    diagnosa_klinis: '',
    informasi_tambahan: ''
  });

  // State untuk daftar pemeriksaan
  const [searchRad, setSearchRad] = React.useState('');
  const [pemeriksaanRadList, setPemeriksaanRadList] = React.useState<any[]>([]);
  const [selectedPemeriksaanRad, setSelectedPemeriksaanRad] = React.useState<string[]>([]);
  const [loadingRad, setLoadingRad] = React.useState(false);

  // State untuk riwayat
  const [riwayatRad, setRiwayatRad] = React.useState<any[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = React.useState(false);

  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // State untuk dropdown pencarian
  const [showDropdownRad, setShowDropdownRad] = React.useState(false);

  // History State untuk dropdown
  const [diagnosaKlinisHistory, setDiagnosaKlinisHistory] = React.useState<string[]>([]);
  const [informasiTambahanHistory, setInformasiTambahanHistory] = React.useState<string[]>([]);
  
  // Dropdown visibility state
  const [showDiagnosaKlinisDropdown, setShowDiagnosaKlinisDropdown] = React.useState(false);
  const [showInformasiTambahanDropdown, setShowInformasiTambahanDropdown] = React.useState(false);
  
  // Filtered history state
  const [filteredDiagnosaKlinis, setFilteredDiagnosaKlinis] = React.useState<string[]>([]);
  const [filteredInformasiTambahan, setFilteredInformasiTambahan] = React.useState<string[]>([]);

  // Fetch daftar pemeriksaan radiologi
  React.useEffect(() => {
    if (searchRad.length > 0) {
      fetchPemeriksaanRadiologi();
    }
  }, [searchRad]);

  // Fetch riwayat saat komponen dimuat
  React.useEffect(() => {
    fetchRiwayatRadiologi();
  }, [patient.no_rawat]);

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

  const fetchPemeriksaanRadiologi = async () => {
    setLoadingRad(true);
    try {
      const params = new URLSearchParams({
        search: searchRad,
        kd_pj: patient.kd_pj || '',
        kelas: patient.kelas || '',
      });

      const response = await fetch(`/api/radiologi/jenis-perawatan?${params.toString()}`);
      if (!response.ok) throw new Error('Gagal fetch pemeriksaan radiologi');

      const data = await response.json();
      setPemeriksaanRadList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching pemeriksaan radiologi:', err);
      setPemeriksaanRadList([]);
    } finally {
      setLoadingRad(false);
    }
  };

  const fetchRiwayatRadiologi = async () => {
    setLoadingRiwayat(true);
    try {
      const response = await fetch(`/api/radiologi/riwayat/${encodeURIComponent(patient.no_rawat)}`);
      if (!response.ok) throw new Error('Gagal fetch riwayat radiologi');

      const data = await response.json();
      setRiwayatRad(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching riwayat radiologi:', err);
      setRiwayatRad([]);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  // Delete permintaan radiologi
  const handleDeleteRadiologi = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Radiologi?',
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
        const response = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Gagal menghapus permintaan radiologi');
        }

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Permintaan radiologi berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh list
        fetchRiwayatRadiologi();
      } catch (err: any) {
        console.error('Error deleting radiologi:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Gagal menghapus permintaan radiologi'
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

  const togglePemeriksaanRad = (kdJenisPrw: string) => {
    setSelectedPemeriksaanRad(prev =>
      prev.includes(kdJenisPrw)
        ? prev.filter(k => k !== kdJenisPrw)
        : [...prev, kdJenisPrw]
    );
  };

  const handleSubmitRadiologi = async () => {
    if (!radForm.diagnosa_klinis.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Diagnosis Klinis wajib diisi!',
      });
      return;
    }

    if (selectedPemeriksaanRad.length === 0) {
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
        dokter_perujuk: patient.kd_dokter || '',
        status: 'ralan',
        diagnosis_klinis: radForm.diagnosa_klinis,
        informasi_tambahan: radForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanRad,
        tgl_permintaan: tglPermintaan,
        jam_permintaan: jamPermintaan,
      };

      console.log('Sending payload Radiologi:', payload);

      const response = await fetch('/api/radiologi/permintaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Gagal menyimpan permintaan radiologi');
      }

      const result = await response.json();

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Radiologi berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
        timer: 3000,
        showConfirmButton: true,
      });

      // Save to history setelah berhasil submit
      if (radForm.diagnosa_klinis.trim()) {
        saveDiagnosaKlinisToHistory(radForm.diagnosa_klinis);
      }
      if (radForm.informasi_tambahan.trim()) {
        saveInformasiTambahanToHistory(radForm.informasi_tambahan);
      }

      // Reset form
      setRadForm({ diagnosa_klinis: '', informasi_tambahan: '' });
      setSelectedPemeriksaanRad([]);
      setSearchRad('');
      fetchRiwayatRadiologi();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan permintaan radiologi',
      });
    } finally {
      setLoadingSubmit(false);
    }
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
      {/* Form Input Radiologi */}
      <div style={{ marginBottom: 32 }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Form Permintaan Radiologi
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Indikasi/Diagnosis Klinis <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={radForm.diagnosa_klinis}
              onChange={(e) => {
                setRadForm({ ...radForm, diagnosa_klinis: e.target.value });
                filterDiagnosaKlinis(e.target.value);
              }}
              onFocus={() => {
                filterDiagnosaKlinis(radForm.diagnosa_klinis);
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
                      setRadForm({ ...radForm, diagnosa_klinis: item });
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
              value={radForm.informasi_tambahan}
              onChange={(e) => {
                setRadForm({ ...radForm, informasi_tambahan: e.target.value });
                filterInformasiTambahan(e.target.value);
              }}
              onFocus={() => {
                filterInformasiTambahan(radForm.informasi_tambahan);
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
                      setRadForm({ ...radForm, informasi_tambahan: item });
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
                value={searchRad}
                onChange={(e) => {
                  setSearchRad(e.target.value);
                  setShowDropdownRad(true);
                }}
                onFocus={() => setShowDropdownRad(true)}
                onBlur={() => setTimeout(() => setShowDropdownRad(false), 200)}
                placeholder="Cari pemeriksaan radiologi..."
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
              {showDropdownRad && searchRad.length > 0 && (
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
                  {loadingRad ? (
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
                  ) : pemeriksaanRadList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                      Tidak ada hasil pencarian
                    </div>
                  ) : (
                    pemeriksaanRadList.map((item, idx) => (
                      <label
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: selectedPemeriksaanRad.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                          borderBottom: idx < pemeriksaanRadList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!selectedPemeriksaanRad.includes(item.kd_jenis_prw)) {
                            e.currentTarget.style.background = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selectedPemeriksaanRad.includes(item.kd_jenis_prw)) {
                            e.currentTarget.style.background = '#ffffff';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPemeriksaanRad.includes(item.kd_jenis_prw)}
                          onChange={() => togglePemeriksaanRad(item.kd_jenis_prw)}
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
                marginBottom: selectedPemeriksaanRad.length > 0 ? 12 : 0
              }}>
                <span>✓ Item Dipilih ({selectedPemeriksaanRad.length})</span>
                {selectedPemeriksaanRad.length > 0 && (
                  <button
                    onClick={() => setSelectedPemeriksaanRad([])}
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
              {selectedPemeriksaanRad.length > 0 && (
                <div style={{
                  overflowY: 'auto'
                }}>
                  {selectedPemeriksaanRad.map((kdJenisPrw, idx) => {
                    const item = pemeriksaanRadList.find(p => p.kd_jenis_prw === kdJenisPrw);
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
                          onClick={() => togglePemeriksaanRad(kdJenisPrw)}
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
            onClick={handleSubmitRadiologi}
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
                Simpan Permintaan Radiologi
              </>
            )}
          </button>
          <button
            onClick={() => {
              setSelectedPemeriksaanRad([]);
              setRadForm({ diagnosa_klinis: '', informasi_tambahan: '' });
              setSearchRad('');
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

      {/* Riwayat Permintaan Radiologi */}
      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 24 }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Riwayat Permintaan Radiologi
        </h4>

        {loadingRiwayat ? (
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
        ) : riwayatRad.length === 0 ? (
          <div style={{
            padding: 20,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 8,
            color: '#92400e',
            textAlign: 'center'
          }}>
            Belum ada riwayat permintaan radiologi
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {riwayatRad.map((item, idx) => (
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
                        onClick={() => handleDeleteRadiologi(item.noorder)}
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
      </div>

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
