import React from 'react';
import Swal from 'sweetalert2';
import { PemeriksaanRanapView } from './PemeriksaanRanap';

type Patient = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  umur: string;
  alamat: string;
  p_jawab: string;
  hubunganpj: string;
  png_jawab: string;
  kamar: string;
  trf_kamar: number;
  diagnosa_awal: string;
  diagnosa_akhir: string;
  tgl_masuk: string;
  jam_masuk: string;
  tgl_keluar: string;
  jam_keluar: string;
  ttl_biaya: number;
  stts_pulang: string;
  lama: string;
  nm_dokter: string;
  kd_kamar: string;
  status_bayar: string;
  agama: string;
};

export const RawatInapView: React.FC = () => {
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);
  const [tglDari, setTglDari] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [tglSampai, setTglSampai] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = React.useState<'belum-pulang' | 'pulang'>('belum-pulang');
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const [periksaPatient, setPeriksaPatient] = React.useState<Patient | null>(null);
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch data from API
  const fetchPatients = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/rawat-inap/list?status=${activeTab}`;
      if (activeTab === 'pulang' && tglDari && tglSampai) {
        url += `&tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      }
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Gagal mengambil data pasien');
      }
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, tglDari, tglSampai, searchText]);

  // Load data on mount and when filters change
  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFilterDropdown]);

  if (periksaPatient) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f3f4f6', overflow: 'hidden' }}>
        <PemeriksaanRanapView patient={periksaPatient} onBack={() => setPeriksaPatient(null)} />
      </div>
    );
  }

  return (
    <div style={{
      background: '#F3F4F6',
      borderRadius: 20,
      padding: '35px 6px 6px 6px',
      position: 'relative'
    }}>
      {/* Header Title */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 20px',
        color: '#000000',
        fontSize: 13,
        fontWeight: 400
      }}>
        Daftar Pasien
      </div>

      {/* White Card Content */}
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #d1d5db',
        padding: '12px 12px 12px 12px',
      }}>
        {/* Search and Filter Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
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
              onClick={() => setActiveTab('belum-pulang')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'belum-pulang' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'belum-pulang' ? '#ffffff' : 'transparent',
                color: activeTab === 'belum-pulang' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'belum-pulang' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'belum-pulang' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              Belum Pulang
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pulang')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'pulang' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'pulang' ? '#ffffff' : 'transparent',
                color: activeTab === 'pulang' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'pulang' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'pulang' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              Pulang
            </button>
          </div>

          {/* Action Buttons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Masuk Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Silakan pilih pasien terlebih dahulu',
                    confirmButtonColor: '#2563eb'
                  });
                  return;
                }
                console.log('Masuk patient:', selectedPatient);
                // TODO: Implement masuk functionality
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <g id="Interface / Log_Out">
                  <path id="Vector" d="M12 15L15 12M15 12L12 9M15 12H4M9 7.24859V7.2002C9 6.08009 9 5.51962 9.21799 5.0918C9.40973 4.71547 9.71547 4.40973 10.0918 4.21799C10.5196 4 11.0801 4 12.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H12.1969C11.079 20 10.5192 20 10.0918 19.7822C9.71547 19.5905 9.40973 19.2839 9.21799 18.9076C9 18.4798 9 17.9201 9 16.8V16.75" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
              </svg>
              <span>Masuk</span>
            </button>

            {/* Keluar Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Silakan pilih pasien terlebih dahulu',
                    confirmButtonColor: '#2563eb'
                  });
                  return;
                }
                console.log('Keluar patient:', selectedPatient);
                // TODO: Implement keluar functionality
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M21.593 10.943c.584.585.584 1.53 0 2.116L18.71 15.95c-.39.39-1.03.39-1.42 0a.996.996 0 0 1 0-1.41 9.552 9.552 0 0 1 1.689-1.345l.387-.242-.207-.206a10 10 0 0 1-2.24.254H8.998a1 1 0 1 1 0-2h7.921a10 10 0 0 1 2.24.254l.207-.206-.386-.241a9.562 9.562 0 0 1-1.69-1.348.996.996 0 0 1 0-1.41c.39-.39 1.03-.39 1.42 0l2.883 2.893zM14 16a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v1.505a1 1 0 1 0 2 0V5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v13A2.5 2.5 0 0 0 5.5 21h7a2.5 2.5 0 0 0 2.5-2.5V17a1 1 0 0 0-1-1z" fill="#ffffff"/>
              </svg>
              <span>Keluar</span>
            </button>

            {/* Pindah Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Silakan pilih pasien terlebih dahulu',
                    confirmButtonColor: '#2563eb'
                  });
                  return;
                }
                console.log('Pindah patient:', selectedPatient);
                // TODO: Implement pindah functionality
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#f59e0b',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 3V9M12 3L9 6M12 3L15 6M12 15V21M12 21L15 18M12 21L9 18M3 12H9M3 12L6 15M3 12L6 9M15 12H21M21 12L18 9M21 12L18 15" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Pindah</span>
            </button>
          </div>

          {/* Right Section: Search Box and Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search Box */}
            <input
              type="text"
              placeholder="Cari pasien..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                width: 250,
                outline: 'none'
              }}
            />

            {/* Filter Button with Dropdown */}
            <div ref={filterDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                padding: '6px 16px',
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
              <span style={{ fontSize: 10 }}>▼</span>
            </button>

            {/* Dropdown Filter */}
            {showFilterDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  padding: 12,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  width: 120
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="date"
                    value={tglDari}
                    onChange={(e) => setTglDari(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 12,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={tglSampai}
                    onChange={(e) => setTglSampai(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 12,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Patient List Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderTopLeftRadius: 10, borderBottomLeftRadius: 10, borderBottom: '1px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Diagnosa</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Kamar</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Tanggal Masuk</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Tanggal Keluar</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderBottom: '1px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#000000', borderTopRightRadius: 10, borderBottomRightRadius: 10, borderBottom: '1px solid #e5e7eb' }}>DPJP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    Memuat data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
                    {error}
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    Tidak ada data pasien
                  </td>
                </tr>
              ) : (
                patients.map((patient, index) => {
                  const isLastRow = index === patients.length - 1;
                  const isSelected = selectedPatient?.no_rawat === patient.no_rawat;

                  // Format tanggal DD-MM-YYYY
                  const formatDate = (dateStr: string) => {
                    if (!dateStr || dateStr === '0000-00-00') return '-';
                    const date = new Date(dateStr);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                  };

                  return (
                    <tr
                      key={patient.no_rawat}
                      onClick={() => {
                        setSelectedPatient(patient);
                      }}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: isSelected ? '#dbeafe' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#fef3c7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#ffffff';
                        }
                      }}
                    >
                      <td
                        style={{ padding: '8px 12px', ...(isLastRow && { borderBottomLeftRadius: 10 }) }}
                        onClick={(e) => { e.stopPropagation(); setPeriksaPatient(patient); }}
                      >
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 6,
                          border: '1px solid #2563eb',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 11,
                          background: '#2563eb'
                        }}>
                          {patient.no_rkm_medis}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: 12, color: '#111827' }}>
                          {patient.nm_pasien} <span style={{ color: '#6b7280' }}>({patient.umur})</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                        {patient.diagnosa_awal || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>{patient.kamar}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                        {formatDate(patient.tgl_masuk)}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                        {formatDate(patient.tgl_keluar)}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#374151' }}>
                        {patient.png_jawab || '-'}
                      </td>
                      <td style={{ padding: '8px 12px', ...(isLastRow && { borderBottomRightRadius: 10 }) }}>
                        <span style={{ fontSize: 13, color: '#374151' }}>{patient.nm_dokter}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
