import React from 'react';
import Swal from 'sweetalert2';
import { PemeriksaanRanapView } from './PemeriksaanRanap';
import { ModalPermintaanRanap } from '../components/ModalPermintaanRanap';
import { localDateStr } from '../utils/date';

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
  jk: string;
};

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

type RawatInapViewProps = {
  user?: AppUser;
};

export const RawatInapView: React.FC<RawatInapViewProps> = ({ user }) => {
  // Untuk user role dokter, username = kd_dokter (konvensi AddUserModal saat
  // membuat akun dari data dokter) — dipakai untuk membatasi hanya pasien
  // yang dokter ini jadi DPJP-nya. Role lain (petugas dll) tetap lihat semua.
  const isDokter = user?.role === 'dokter' && !!user?.username;
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);
  const [tglDari, setTglDari] = React.useState<string>(localDateStr());
  const [tglSampai, setTglSampai] = React.useState<string>(localDateStr());
  const [activeTab, setActiveTab] = React.useState<'belum-pulang' | 'pulang'>('belum-pulang');
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const [periksaPatient, setPeriksaPatient] = React.useState<Patient | null>(null);
  const [showPermintaanRanap, setShowPermintaanRanap] = React.useState(false);
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
      if (isDokter) {
        url += `&kd_dokter=${encodeURIComponent(user!.username)}`;
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
  }, [activeTab, tglDari, tglSampai, searchText, isDokter, user]);

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
        <PemeriksaanRanapView patient={periksaPatient} onBack={() => setPeriksaPatient(null)} user={user} />
      </div>
    );
  }

  return (
    <>
      {/* Content Section — langsung di atas background, tanpa card */}
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
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
                fontWeight: 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'belum-pulang' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'nowrap'
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
                fontWeight: 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'pulang' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Pulang
            </button>
          </div>

          {/* Action Buttons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Permintaan Ranap Button */}
            <button
              type="button"
              onClick={() => setShowPermintaanRanap(true)}
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 15h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 11h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Permintaan Ranap</span>
            </button>

            {/* Jadwal Obat Button */}
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
                console.log('Jadwal Obat patient:', selectedPatient);
                // TODO: Implement jadwal obat functionality
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#059669',
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
                <circle cx="12" cy="12" r="9" stroke="#ffffff" strokeWidth="2"/>
                <path d="M12 7v5l3.5 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Jadwal Obat</span>
            </button>
          </div>

          {/* Search Box + Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M10 8L20 8" stroke="currentColor" strokeLinecap="round" />
                  <path d="M4 16L14 16" stroke="currentColor" strokeLinecap="round" />
                  <ellipse cx="7" cy="8" rx="3" ry="3" transform="rotate(90 7 8)" stroke="currentColor" strokeLinecap="round" />
                  <ellipse cx="17" cy="16" rx="3" ry="3" transform="rotate(90 17 16)" stroke="currentColor" strokeLinecap="round" />
                </svg>
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

        {error && (
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              marginBottom: 16,
              fontSize: 13,
              flexShrink: 0
            }}
          >
            {error}
          </div>
        )}

        {/* Patient List Table */}
        <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kamar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>DPJP</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl. Masuk</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Diagnosa</th>
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
                  const isSelected = selectedPatient?.no_rawat === patient.no_rawat;
                  const baseBg = (idx: number) => (idx % 2 === 0 ? '#ffffff' : '#f9fafb');

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
                        background: isSelected ? '#dbeafe' : baseBg(index),
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
                          e.currentTarget.style.background = baseBg(index);
                        }
                      }}
                    >
                      <td
                        style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}
                        onClick={(e) => { e.stopPropagation(); setPeriksaPatient(patient); }}
                      >
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 2,
                          border: '1px solid #2563eb',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 400,
                          fontSize: 11,
                          background: '#2563eb'
                        }}>
                          {patient.no_rkm_medis}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 12, color: '#111827' }}>
                          {patient.nm_pasien} <span style={{ color: '#6b7280' }}>({patient.umur})</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.no_rawat}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>{patient.kamar}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: 12, color: '#374151' }}>{patient.nm_dokter}</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.png_jawab || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {formatDate(patient.tgl_masuk)}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.diagnosa_awal || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ModalPermintaanRanap open={showPermintaanRanap} onClose={() => setShowPermintaanRanap(false)} />
    </>
  );
};
