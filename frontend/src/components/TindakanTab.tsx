import React from 'react';
import Swal from 'sweetalert2';

type TindakanTabProps = {
  patient: any;
};

export const TindakanTab: React.FC<TindakanTabProps> = ({ patient }) => {
  const [tindakanList, setTindakanList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTindakan, setSearchTindakan] = React.useState('');
  const [jenisTindakanList, setJenisTindakanList] = React.useState<any[]>([]);
  const [selectedTindakan, setSelectedTindakan] = React.useState<string[]>([]);
  const [selectedTindakanData, setSelectedTindakanData] = React.useState<any[]>([]); // Store full data of selected items
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // Fetch tindakan yang sudah dilakukan (hari ini)
  React.useEffect(() => {
    fetchTindakanList();
  }, [patient.no_rawat]);

  // Fetch daftar jenis tindakan saat search
  React.useEffect(() => {
    if (searchTindakan.length >= 2) {
      fetchJenisTindakan();
    } else {
      setJenisTindakanList([]);
      setShowDropdown(false);
    }
  }, [searchTindakan]);

  const fetchTindakanList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tindakan-ralan/${encodeURIComponent(patient.no_rawat)}`);
      if (!response.ok) throw new Error('Gagal fetch tindakan');

      const data = await response.json();

      // Combine all tindakan arrays
      const allTindakan = [
        ...(data.tindakan_dokter || []),
        ...(data.tindakan_paramedis || []),
        ...(data.tindakan_dokter_paramedis || [])
      ];

      // Filter hanya data hari ini
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const filteredData = allTindakan.filter((item: any) => {
        if (!item.tgl_perawatan) return false;

        // Parse DD/MM/YYYY format from backend
        const parts = item.tgl_perawatan.split('/');
        if (parts.length === 3) {
          const itemDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
          return itemDateStr === todayStr;
        }

        // Handle format ISO 8601
        if (item.tgl_perawatan.includes('T')) {
          const itemDate = new Date(item.tgl_perawatan);
          const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
          return itemDateStr === todayStr;
        }

        // Handle format YYYY-MM-DD
        if (item.tgl_perawatan.includes('-')) {
          const itemDateStr = item.tgl_perawatan.substring(0, 10);
          return itemDateStr === todayStr;
        }

        return false;
      });

      setTindakanList(filteredData);
    } catch (err) {
      console.error('Error fetching tindakan:', err);
      setTindakanList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJenisTindakan = async () => {
    try {
      // Endpoint untuk mendapatkan jenis perawatan/tindakan
      const params = new URLSearchParams();
      params.append('search', searchTindakan);

      // Only add kd_pj if available
      if (patient.kd_pj) {
        params.append('kd_pj', patient.kd_pj);
      }

      console.log('Fetching tindakan with params:', params.toString());
      const response = await fetch(`/api/tindakan/jenis-perawatan?${params.toString()}`);
      if (!response.ok) throw new Error('Gagal fetch jenis tindakan');

      const data = await response.json();
      console.log('Received tindakan data:', data.length, 'items');
      setJenisTindakanList(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('Error fetching jenis tindakan:', err);
      setJenisTindakanList([]);
      setShowDropdown(false);
    }
  };

  const toggleTindakan = (kdJenisPrw: string) => {
    setSelectedTindakan(prev => {
      if (prev.includes(kdJenisPrw)) {
        // Remove from selected
        setSelectedTindakanData(prevData => prevData.filter(item => item.kd_jenis_prw !== kdJenisPrw));
        return prev.filter(k => k !== kdJenisPrw);
      } else {
        // Add to selected - save full data
        const itemData = jenisTindakanList.find(item => item.kd_jenis_prw === kdJenisPrw);
        if (itemData) {
          setSelectedTindakanData(prevData => {
            // Prevent duplicates
            const exists = prevData.some(item => item.kd_jenis_prw === kdJenisPrw);
            if (exists) return prevData;
            return [...prevData, itemData];
          });
        }
        return [...prev, kdJenisPrw];
      }
    });
  };

  const handleSubmitTindakan = async () => {
    if (selectedTindakan.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Pilih minimal satu jenis tindakan terlebih dahulu!'
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
      const tglPerawatan = `${year}-${month}-${day}`;

      // Format time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const jamRawat = `${hours}:${minutes}:${seconds}`;

      // Save each selected tindakan
      let successCount = 0;
      let errorCount = 0;

      for (const selectedItem of selectedTindakanData) {
        if (!selectedItem) continue;
        const kdJenisPrw = selectedItem.kd_jenis_prw;

        const payload = {
          no_rawat: patient.no_rawat,
          kd_jenis_prw: kdJenisPrw,
          kd_dokter: patient.kd_dokter || '',
          tgl_perawatan: tglPerawatan,
          jam_rawat: jamRawat,
          material: selectedItem.material || 0,
          bhp: selectedItem.bhp || 0,
          tarif_tindakandr: selectedItem.total_byrdr || 0,
          kso: selectedItem.kso || 0,
          menejemen: selectedItem.menejemen || 0,
          biaya_rawat: selectedItem.total_byrdr || 0
        };

        try {
          const response = await fetch('/api/tindakan/simpan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: `${successCount} tindakan berhasil disimpan${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
          timer: 2000,
          showConfirmButton: false
        });

        // Reset form dan refresh list
        setSelectedTindakan([]);
        setSelectedTindakanData([]);
        setSearchTindakan('');
        setJenisTindakanList([]);
        fetchTindakanList();
      } else {
        throw new Error('Gagal menyimpan semua tindakan');
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan tindakan'
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleDeleteTindakan = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Tindakan?',
      text: `Apakah Anda yakin ingin menghapus tindakan "${item.nm_perawatan}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        // Normalize date format to YYYY-MM-DD
        let tglPerawatan = item.tgl_perawatan;
        if (tglPerawatan && tglPerawatan.includes('T')) {
          // ISO 8601 format - extract date part
          tglPerawatan = tglPerawatan.split('T')[0];
        }

        const params = new URLSearchParams({
          no_rawat: item.no_rawat,
          kd_jenis_prw: item.kd_jenis_prw,
          tgl_perawatan: tglPerawatan,
          jam_rawat: item.jam_rawat,
          kd_dokter: item.kd_dokter
        });

        const response = await fetch(`/api/tindakan/delete?${params.toString()}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Gagal menghapus tindakan');
        }

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Tindakan berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh list
        fetchTindakanList();
      } catch (err: any) {
        console.error('Error deleting tindakan:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Gagal menghapus tindakan'
        });
      }
    }
  };

  const formatDateTime = (tgl: string, jam: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';

    let formattedDate = '';
    let formattedTime = '';

    // Parse tanggal - support format ISO 8601 dan YYYY-MM-DD
    if (tgl.includes('T')) {
      const date = new Date(tgl);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    } else if (tgl.includes('-') && tgl.length >= 10) {
      const parts = tgl.split('-');
      const year = parts[0];
      const month = parts[1];
      const day = parts[2].substring(0, 2);
      formattedDate = `${day}/${month}/${year}`;
    } else {
      formattedDate = tgl;
    }

    // Ambil jam dari parameter terpisah
    if (jam && jam !== '00:00:00') {
      formattedTime = jam;
    }

    return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
      {/* Form Input Tindakan */}
      <div style={{ marginBottom: 32 }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Input Tindakan Rawat Jalan
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Kolom Kiri - Pencarian Tindakan */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Cari Tindakan <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={searchTindakan}
                onChange={(e) => setSearchTindakan(e.target.value)}
                onFocus={() => {
                  if (searchTindakan.length >= 2 && jenisTindakanList.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
                placeholder="Ketik minimal 2 karakter untuk mencari tindakan..."
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

              {/* Dropdown Tindakan */}
              {showDropdown && searchTindakan.length >= 2 && jenisTindakanList.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
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
                  {jenisTindakanList.map((item, idx) => (
                    <label
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: selectedTindakan.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                        borderBottom: idx < jenisTindakanList.length - 1 ? '1px solid #f3f4f6' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedTindakan.includes(item.kd_jenis_prw)) {
                          e.currentTarget.style.background = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedTindakan.includes(item.kd_jenis_prw)) {
                          e.currentTarget.style.background = '#ffffff';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTindakan.includes(item.kd_jenis_prw)}
                        onChange={() => toggleTindakan(item.kd_jenis_prw)}
                        style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                          {item.nm_perawatan}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          Kode: {item.kd_jenis_prw} • Tarif: {formatRupiah(item.total_byrdr || 0)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan - Item Yang Dipilih */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Item Terpilih
            </label>
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
                marginBottom: selectedTindakan.length > 0 ? 12 : 0
              }}>
                <span>✓ Item Dipilih ({selectedTindakan.length})</span>
                {selectedTindakan.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTindakan([]);
                      setSelectedTindakanData([]);
                    }}
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

              {selectedTindakan.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedTindakanData.map((item) => (
                    <div
                      key={item.kd_jenis_prw}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '8px 10px',
                        fontSize: 12,
                        color: '#374151',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ flex: 1, fontWeight: 500 }}>{item.nm_perawatan}</span>
                      <button
                        onClick={() => toggleTindakan(item.kd_jenis_prw)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Hapus"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tombol Simpan dan Reset */}
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button
            onClick={handleSubmitTindakan}
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
                Simpan Tindakan
              </>
            )}
          </button>
          <button
            onClick={() => {
              setSelectedTindakan([]);
              setSelectedTindakanData([]);
              setSearchTindakan('');
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

      {/* Riwayat Tindakan */}
      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 24 }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg> 
          Riwayat Tindakan Hari Ini
        </h4>

        {loading ? (
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
        ) : tindakanList.length === 0 ? (
          <div style={{
            padding: 20,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 8,
            color: '#92400e',
            textAlign: 'center'
          }}>
            Belum ada tindakan yang dilakukan hari ini
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tindakanList.map((item, idx) => (
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1AB1E5', marginBottom: 4 }}>
                      {item.nm_perawatan}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      📅 {formatDateTime(item.tgl_perawatan, item.jam_rawat)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      👨‍⚕️ {item.nm_dokter || '-'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{
                      padding: '4px 12px',
                      background: '#d1fae5',
                      color: '#065f46',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {formatRupiah(item.biaya_rawat || 0)}
                    </div>
                    <button
                      onClick={() => handleDeleteTindakan(item)}
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
                      title="Hapus Tindakan"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Hapus
                    </button>
                  </div>
                </div>
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
