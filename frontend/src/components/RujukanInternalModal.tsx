import React from 'react';
import Swal from 'sweetalert2';

type RujukanInternalModalProps = {
  patient: any;
  onClose: () => void;
  onSuccess?: () => void;
};

export const RujukanInternalModal: React.FC<RujukanInternalModalProps> = ({ patient, onClose, onSuccess }) => {
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
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 800,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
            🏥 Rujukan Poli Internal
          </h3>
          <button
            onClick={onClose}
            style={{
              background: '#fee2e2',
              border: 'none',
              color: '#ef4444',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ✕ Tutup
          </button>
        </div>

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

          {/* Dokter Dituju */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Dokter Dituju <span style={{ color: '#ef4444' }}>*</span>
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
              {/* Dropdown Dokter */}
              {showDokterDropdown && (
                <div
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
                </div>
              )}
            </div>
          </div>

          {/* Poli Tujuan */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Poli Tujuan <span style={{ color: '#ef4444' }}>*</span>
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
              {/* Dropdown Poli */}
              {showPoliDropdown && (
                <div
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Tutup
          </button>
          <button
            onClick={handleSimpan}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {loading ? '⏳ Menyimpan...' : '💾 Simpan'}
          </button>
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

