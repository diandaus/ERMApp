import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';

type RujukanInternalModalProps = {
  patient: any;
  onClose: () => void;
  onSuccess?: () => void;
};

export const RujukanInternalModal: React.FC<RujukanInternalModalProps> = ({ patient, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = React.useState<'internal' | 'keluar'>('internal');
  const [kdDokter, setKdDokter] = React.useState('');
  const [nmDokter, setNmDokter] = React.useState('');
  const [kdPoli, setKdPoli] = React.useState('');
  const [nmPoli, setNmPoli] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [loadingDokter, setLoadingDokter] = React.useState(false);
  const [loadingPoli, setLoadingPoli] = React.useState(false);

  // State untuk dropdown
  const [showDokterDropdown, setShowDokterDropdown] = React.useState(false);
  const [showPoliDropdown, setShowPoliDropdown] = React.useState(false);
  const [dokterList, setDokterList] = React.useState<any[]>([]);
  const [poliList, setPoliList] = React.useState<any[]>([]);
  const [searchDokter, setSearchDokter] = React.useState('');
  const [searchPoli, setSearchPoli] = React.useState('');

  // Posisi dropdown pencarian poli/dokter — dihitung dari wrapper input lalu
  // di-render via portal ke document.body (position: fixed), agar tidak
  // terpotong oleh overflow:hidden/auto pada card modal.
  const poliSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  const dokterSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  const [poliDropdownPos, setPoliDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [dokterDropdownPos, setDokterDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    if (!showPoliDropdown) { setPoliDropdownPos(null); return; }
    const updatePos = () => {
      const rect = poliSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setPoliDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showPoliDropdown]);

  React.useEffect(() => {
    if (!showDokterDropdown) { setDokterDropdownPos(null); return; }
    const updatePos = () => {
      const rect = dokterSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setDokterDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showDokterDropdown]);

  // Fetch dokter saat kode dokter berubah atau search
  React.useEffect(() => {
    if (kdDokter.trim()) {
      fetchDokterByKode(kdDokter);
    } else {
      setNmDokter('');
    }
  }, [kdDokter]);

  // Fetch poli saat kode poli berubah atau search
  React.useEffect(() => {
    if (kdPoli.trim()) {
      fetchPoliByKode(kdPoli);
    } else {
      setNmPoli('');
    }
  }, [kdPoli]);

  // Fetch list dokter untuk dropdown
  React.useEffect(() => {
    if (showDokterDropdown) {
      fetchDokterList(searchDokter);
    }
  }, [showDokterDropdown, searchDokter]);

  // Fetch list poli untuk dropdown
  React.useEffect(() => {
    if (showPoliDropdown) {
      fetchPoliList(searchPoli);
    }
  }, [showPoliDropdown, searchPoli]);

  const fetchDokterByKode = async (kode: string) => {
    try {
      const response = await fetch(`/api/pendaftaran/dokter/${encodeURIComponent(kode)}`);
      if (response.ok) {
        const data = await response.json();
        setNmDokter(data.nm_dokter || '');
      } else {
        setNmDokter('');
      }
    } catch (err) {
      console.error('Error fetching dokter:', err);
      setNmDokter('');
    }
  };

  const fetchPoliByKode = async (kode: string) => {
    try {
      const response = await fetch(`/api/pendaftaran/poli/${encodeURIComponent(kode)}`);
      if (response.ok) {
        const data = await response.json();
        setNmPoli(data.nm_poli || '');
      } else {
        setNmPoli('');
      }
    } catch (err) {
      console.error('Error fetching poli:', err);
      setNmPoli('');
    }
  };

  const fetchDokterList = async (search: string) => {
    setLoadingDokter(true);
    try {
      const url = search
        ? `/api/pendaftaran/dokter?search=${encodeURIComponent(search)}`
        : '/api/pendaftaran/dokter';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDokterList(Array.isArray(data) ? data : []);
      } else {
        setDokterList([]);
      }
    } catch (err) {
      console.error('Error fetching dokter list:', err);
      setDokterList([]);
    } finally {
      setLoadingDokter(false);
    }
  };

  const fetchPoliList = async (search: string) => {
    setLoadingPoli(true);
    try {
      const url = search
        ? `/api/pendaftaran/poli?search=${encodeURIComponent(search)}`
        : '/api/pendaftaran/poli';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPoliList(Array.isArray(data) ? data : []);
      } else {
        setPoliList([]);
      }
    } catch (err) {
      console.error('Error fetching poli list:', err);
      setPoliList([]);
    } finally {
      setLoadingPoli(false);
    }
  };

  const handleSimpan = async () => {
    // Validasi
    if (!patient.no_rawat || !patient.no_rkm_medis || !patient.nm_pasien) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Data pasien tidak lengkap!',
      });
      return;
    }

    if (!kdDokter.trim() || !nmDokter.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Dokter dituju wajib diisi!',
      });
      return;
    }

    if (!kdPoli.trim() || !nmPoli.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Poliklinik tujuan wajib diisi!',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/rujukan-internal/simpan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          kd_dokter: kdDokter.trim(),
          kd_poli: kdPoli.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan rujukan internal');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: data.message || 'Rujukan internal berhasil disimpan',
        timer: 2000,
        showConfirmButton: false,
      });

      // Reset form
      setKdDokter('');
      setNmDokter('');
      setKdPoli('');
      setNmPoli('');
      setSearchDokter('');
      setSearchPoli('');

      // Callback success
      if (onSuccess) {
        onSuccess();
      }

      // Tutup modal
      onClose();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan rujukan internal',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          maxWidth: 700,
          width: '85%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Rujuk</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* White Card Content */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #d1d5db',
            padding: 12,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Segmented Tab */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('internal')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'internal' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'internal' ? '#ffffff' : 'transparent',
                color: activeTab === 'internal' ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'internal' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Poli Internal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('keluar')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'keluar' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'keluar' ? '#ffffff' : 'transparent',
                color: activeTab === 'keluar' ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'keluar' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Rujuk Keluar
            </button>
          </div>

          {activeTab === 'keluar' ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Fitur Rujuk Keluar akan dikembangkan nanti.
            </div>
          ) : (
        <>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* No. Rawat, No. RM, Nama Pasien */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                No. Rawat
              </label>
              <input
                type="text"
                value={patient.no_rawat || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                No. RM
              </label>
              <input
                type="text"
                value={patient.no_rkm_medis || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                Nama Pasien
              </label>
              <input
                type="text"
                value={patient.nm_pasien || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Poli Tujuan */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Poli Tujuan <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }} ref={poliSearchWrapperRef}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={nmPoli || kdPoli}
                onChange={(e) => {
                  const value = e.target.value;
                  setKdPoli(value);
                  setSearchPoli(value);
                  setNmPoli(''); // Reset nama saat user mengetik
                }}
                onFocus={() => {
                  setShowPoliDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowPoliDropdown(false), 200);
                }}
                placeholder="Cari poliklinik..."
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
              {/* Dropdown Poli — portal ke document.body agar tidak terpotong overflow modal */}
              {showPoliDropdown && poliDropdownPos && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: poliDropdownPos.top,
                    left: poliDropdownPos.left,
                    width: poliDropdownPos.width,
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 999999
                  }}
                >
                  {loadingPoli ? (
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
                  ) : poliList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                      {kdPoli.length > 0 ? 'Tidak ada hasil pencarian' : 'Ketik untuk mencari poliklinik...'}
                    </div>
                  ) : (
                    poliList.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setKdPoli(p.kd_poli);
                          setNmPoli(p.nm_poli);
                          setSearchPoli('');
                          setShowPoliDropdown(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: idx < poliList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'all 0.2s',
                          background: '#ffffff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <div style={{ fontWeight: 500, color: '#111827' }}>{p.nm_poli}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {p.kd_poli}</div>
                      </div>
                    ))
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Dokter Dituju */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Dokter Dituju <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }} ref={dokterSearchWrapperRef}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={nmDokter || kdDokter}
                onChange={(e) => {
                  const value = e.target.value;
                  setKdDokter(value);
                  setSearchDokter(value);
                  setNmDokter(''); // Reset nama saat user mengetik
                }}
                onFocus={() => {
                  setShowDokterDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowDokterDropdown(false), 200);
                }}
                placeholder="Cari dokter..."
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
              {/* Dropdown Dokter — portal ke document.body agar tidak terpotong overflow modal */}
              {showDokterDropdown && dokterDropdownPos && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: dokterDropdownPos.top,
                    left: dokterDropdownPos.left,
                    width: dokterDropdownPos.width,
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 999999
                  }}
                >
                  {loadingDokter ? (
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
                  ) : dokterList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                      {kdDokter.length > 0 ? 'Tidak ada hasil pencarian' : 'Ketik untuk mencari dokter...'}
                    </div>
                  ) : (
                    dokterList.map((d, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setKdDokter(d.kd_dokter);
                          setNmDokter(d.nm_dokter);
                          setSearchDokter('');
                          setShowDokterDropdown(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: idx < dokterList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'all 0.2s',
                          background: '#ffffff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <div style={{ fontWeight: 500, color: '#111827' }}>{d.nm_dokter}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {d.kd_dokter}</div>
                      </div>
                    ))
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
        </>
          )}
        </div>
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

