import React from 'react';
import Swal from 'sweetalert2';

type ModalInputTindakanProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputTindakan: React.FC<ModalInputTindakanProps> = ({ patient, onClose, onSaved }) => {
  const [searchTindakan, setSearchTindakan] = React.useState('');
  const [jenisTindakanList, setJenisTindakanList] = React.useState<any[]>([]);
  const [selectedTindakan, setSelectedTindakan] = React.useState<string[]>([]);
  const [selectedTindakanData, setSelectedTindakanData] = React.useState<any[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  React.useEffect(() => {
    if (searchTindakan.length >= 2) {
      fetchJenisTindakan();
    } else {
      setJenisTindakanList([]);
      setShowDropdown(false);
    }
  }, [searchTindakan]);

  const fetchJenisTindakan = async () => {
    try {
      const params = new URLSearchParams({ search: searchTindakan });
      if (patient.kd_pj) params.append('kd_pj', patient.kd_pj);
      const res = await fetch(`/api/tindakan/jenis-perawatan?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setJenisTindakanList(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setShowDropdown(true);
    } catch {
      setJenisTindakanList([]);
      setShowDropdown(false);
    }
  };

  const toggleTindakan = (kdJenisPrw: string) => {
    setSelectedTindakan(prev => {
      if (prev.includes(kdJenisPrw)) {
        setSelectedTindakanData(d => d.filter(i => i.kd_jenis_prw !== kdJenisPrw));
        return prev.filter(k => k !== kdJenisPrw);
      } else {
        const itemData = jenisTindakanList.find(i => i.kd_jenis_prw === kdJenisPrw);
        if (itemData) {
          setSelectedTindakanData(d => d.some(i => i.kd_jenis_prw === kdJenisPrw) ? d : [...d, itemData]);
        }
        return [...prev, kdJenisPrw];
      }
    });
  };

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getDateTime = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      tgl: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      jam: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  };

  const handleSubmit = async () => {
    if (selectedTindakan.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu jenis tindakan terlebih dahulu!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      const { tgl, jam } = getDateTime();
      let successCount = 0;
      let errorCount = 0;

      for (const item of selectedTindakanData) {
        if (!item) continue;
        const payload = {
          no_rawat: patient.no_rawat,
          kd_jenis_prw: item.kd_jenis_prw,
          kd_dokter: patient.kd_dokter || '',
          tgl_perawatan: tgl,
          jam_rawat: jam,
          material: item.material || 0,
          bhp: item.bhp || 0,
          tarif_tindakandr: item.total_byrdr || 0,
          kso: item.kso || 0,
          menejemen: item.menejemen || 0,
          biaya_rawat: item.total_byrdr || 0,
        };
        try {
          const res = await fetch('/api/tindakan/simpan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) successCount++; else errorCount++;
        } catch { errorCount++; }
      }

      if (successCount > 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: `${successCount} tindakan berhasil disimpan${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
          timer: 2000,
          showConfirmButton: false,
        });
        onSaved();
        onClose();
      } else {
        throw new Error('Gagal menyimpan semua tindakan');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan saat menyimpan tindakan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleReset = () => {
    setSelectedTindakan([]);
    setSelectedTindakanData([]);
    setSearchTindakan('');
    setJenisTindakanList([]);
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}
        onClick={onClose}
      >
        {/* Modal Container */}
        <div
          style={{
            background: '#F3F4F6', borderRadius: 20,
            padding: '35px 8px 8px 8px', position: 'relative',
            maxWidth: 800, width: '90%', maxHeight: '90vh', overflowY: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button" onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 16,
              background: 'transparent', border: 'none',
              fontSize: 24, cursor: 'pointer', color: '#6b7280',
              padding: 0, lineHeight: 1,
            }}
          >×</button>

          {/* Header Title */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '12px 20px', color: '#000000', fontSize: 13, fontWeight: 400,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Input Tindakan Rawat Jalan
          </div>

          {/* White Card Content */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: '16px' }}>

            {/* Search + Selected Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start', marginBottom: 16 }}>

              {/* Kolom Kiri - Pencarian */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Cari Tindakan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchTindakan}
                    onChange={(e) => setSearchTindakan(e.target.value)}
                    onFocus={() => { if (searchTindakan.length >= 2 && jenisTindakanList.length > 0) setShowDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
                    placeholder="Ketik minimal 2 karakter untuk mencari tindakan..."
                    style={{
                      width: '100%', padding: '10px 12px 10px 38px',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      fontSize: 13, boxSizing: 'border-box', outline: 'none',
                    }}
                    onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                    onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                  />

                  {/* Dropdown */}
                  {showDropdown && searchTindakan.length >= 2 && jenisTindakanList.length > 0 && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        marginTop: 4, maxHeight: 300, overflowY: 'auto',
                        border: '1px solid #e5e7eb', borderRadius: 8,
                        background: '#ffffff',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        zIndex: 10,
                      }}
                    >
                      {jenisTindakanList.map((item, idx) => (
                        <label
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            background: selectedTindakan.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                            borderBottom: idx < jenisTindakanList.length - 1 ? '1px solid #f3f4f6' : 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#ffffff'; }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTindakan.includes(item.kd_jenis_prw)}
                            onChange={() => toggleTindakan(item.kd_jenis_prw)}
                            style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.nm_perawatan}</div>
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

              {/* Kolom Kanan - Item Terpilih */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Item Terpilih
                </label>
                <div style={{
                  background: '#f0f9ff', border: '1px solid #1AB1E5',
                  borderRadius: 8, padding: '8px 12px', minHeight: 42,
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#1AB1E5',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: selectedTindakan.length > 0 ? 12 : 0,
                  }}>
                    <span>✓ Item Dipilih ({selectedTindakan.length})</span>
                    {selectedTindakan.length > 0 && (
                      <button
                        onClick={() => { setSelectedTindakan([]); setSelectedTindakanData([]); }}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: '2px 8px' }}
                      >Hapus Semua</button>
                    )}
                  </div>
                  {selectedTindakanData.map((item) => (
                    <div
                      key={item.kd_jenis_prw}
                      style={{
                        background: '#ffffff', border: '1px solid #e5e7eb',
                        borderRadius: 6, padding: '8px 10px', marginBottom: 8,
                        fontSize: 12, color: '#374151',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{item.nm_perawatan}</div>
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {formatRupiah(item.total_byrdr || 0)}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleTindakan(item.kd_jenis_prw)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
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
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button" onClick={handleReset}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >Reset</button>
              <button
                type="button" onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >Tutup</button>
              <button
                type="button" onClick={handleSubmit} disabled={loadingSubmit}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loadingSubmit ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loadingSubmit ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >{loadingSubmit ? 'Menyimpan...' : 'Simpan Tindakan'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
