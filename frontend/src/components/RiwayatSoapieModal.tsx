import React from 'react';

type RiwayatSoapieModalProps = {
  patient: any;
  onClose: () => void;
  onCopySoapie?: (soapieData: SoapieData) => void;
};

type FilterType = 'last5' | 'all' | 'dateRange' | 'specific';

type RegistrationData = {
  no_reg: string;
  no_rawat: string;
  tgl_registrasi: string;
  status_lanjut: string;
  soapie: SoapieData[];
};

type SoapieData = {
  tgl_perawatan: string;
  jam_rawat: string;
  suhu_tubuh: string;
  tensi: string;
  nadi: string;
  respirasi: string;
  tinggi: string;
  berat: string;
  gcs: string;
  spo2: string;
  kesadaran: string;
  keluhan: string;
  pemeriksaan: string;
  alergi: string;
  lingkar_perut: string;
  rtl: string;
  penilaian: string;
  instruksi: string;
  evaluasi: string;
  nip: string;
  nama: string;
  jbtn: string;
};

export const RiwayatSoapieModal: React.FC<RiwayatSoapieModalProps> = ({ patient, onClose, onCopySoapie }) => {
  const [filterType, setFilterType] = React.useState<FilterType>('last5');
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<RegistrationData[]>([]);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [specificNoRawat, setSpecificNoRawat] = React.useState('');

  React.useEffect(() => {
    // Set default dates to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    setDateFrom(formattedDate);
    setDateTo(formattedDate);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/api/pemeriksaan/riwayat-soapie/${encodeURIComponent(patient.no_rkm_medis)}?filter=${filterType}`;

      if (filterType === 'dateRange') {
        url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      } else if (filterType === 'specific') {
        url += `&no_rawat=${encodeURIComponent(specificNoRawat)}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch SOAPIE history');
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Error fetching SOAPIE history:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (filterType === 'last5' || filterType === 'all') {
      fetchData();
    }
  }, [filterType, patient.no_rkm_medis]);

  const handleSearch = () => {
    if (filterType === 'dateRange' && (!dateFrom || !dateTo)) {
      alert('Silakan pilih tanggal dari dan sampai');
      return;
    }
    if (filterType === 'specific' && !specificNoRawat) {
      alert('Silakan masukkan No. Rawat');
      return;
    }
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    if (dateStr.includes('T')) {
      const parts = dateStr.split('T')[0].split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 8);
  };

  const handleCopySoapie = (item: SoapieData) => {
    if (onCopySoapie) {
      onCopySoapie(item);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6', borderRadius: 20,
          padding: '35px 8px 8px 8px', position: 'relative',
          maxWidth: 1400, width: '95%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>
            Riwayat SOAPIE — {patient.nm_pasien} ({patient.no_rkm_medis})
          </span>
          <button
            type="button" onClick={onClose}
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
          padding: 16, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden',
        }}>
        {/* Filter Options - fixed, tidak ikut scroll bersama data */}
        <div style={{ flexShrink: 0, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            {/* Tab Segmented Control */}
            <div style={{
              display: 'inline-flex',
              background: '#f3f4f6',
              borderRadius: 12,
              padding: 4,
              gap: 4
            }}>
              {(
                [
                  { value: 'last5', label: '5 Kunjungan Terakhir' },
                  { value: 'all', label: 'Semua Kunjungan' },
                  { value: 'dateRange', label: 'Berdasarkan Tanggal' },
                  { value: 'specific', label: 'No. Rawat Tertentu' },
                ] as { value: FilterType; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterType(opt.value)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: filterType === opt.value ? '1px solid #d1d5db' : 'none',
                    background: filterType === opt.value ? '#ffffff' : 'transparent',
                    color: filterType === opt.value ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: filterType === opt.value ? 500 : 400,
                    transition: 'all 0.2s ease',
                    boxShadow: filterType === opt.value ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          {filterType === 'dateRange' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Dari:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: 13
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Sampai:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: 13
                  }}
                />
              </div>
              <button
                onClick={handleSearch}
                style={{
                  padding: '6px 16px',
                  background: '#1AB1E5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Tampilkan
              </button>
            </div>
          )}

          {/* Specific No. Rawat Filter */}
          {filterType === 'specific' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>No. Rawat:</label>
              <input
                type="text"
                value={specificNoRawat}
                onChange={(e) => setSpecificNoRawat(e.target.value)}
                placeholder="Masukkan No. Rawat"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  width: 250
                }}
              />
              <button
                onClick={handleSearch}
                style={{
                  padding: '6px 16px',
                  background: '#1AB1E5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Tampilkan
              </button>
            </div>
          )}
        </div>

        {/* Content - scrollable, terpisah dari filter yang fixed */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 40,
                  height: 40,
                  border: '4px solid #f3f4f6',
                  borderTop: '4px solid #1AB1E5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              ></div>
              <p style={{ marginTop: 16, color: '#6b7280' }}>Memuat data...</p>
            </div>
          )}

          {!loading && data.length === 0 && (
            <div style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>
              Tidak ada data riwayat SOAPIE ditemukan
            </div>
          )}

          {!loading && data.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {data.map((registration, regIdx) => (
                <div
                  key={`${registration.no_rawat}-${regIdx}`}
                  style={{
                    border: '1px solid #ddd',
                    background: '#ffffff'
                  }}
                >
                  {/* Registration Header */}
                  <div
                    style={{
                      background: '#eee',
                      padding: 12,
                      borderBottom: '1px solid #ddd'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 600 }}>
                      <span>Tgl.Reg: {formatDate(registration.tgl_registrasi)}</span>
                      <span>No.Rawat: {registration.no_rawat}</span>
                      <span>Status: {registration.status_lanjut}</span>
                    </div>
                  </div>

                  {/* SOAPIE Table */}
                  {registration.soapie && registration.soapie.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 12
                        }}
                      >
                        <thead>
                          <tr style={{ background: '#eee' }}>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', width: '80px' }}>
                              Tanggal
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', width: '120px' }}>
                              Dokter/Paramedis
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Subjek
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Objek
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Asesmen
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Plan
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Inst/Impl
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                              Evaluasi
                            </th>
                            <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', width: '80px' }}>
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {registration.soapie.map((item, idx) => (
                            <tr key={`${registration.no_rawat}-${idx}`}>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'center',
                                  verticalAlign: 'top'
                                }}
                              >
                                {formatDate(item.tgl_perawatan)}
                                <br />
                                {formatTime(item.jam_rawat)}
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'center',
                                  verticalAlign: 'top'
                                }}
                              >
                                {item.nip}
                                <br />
                                {item.nama}
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.keluhan || '-')
                                      .replace(/</g, '&lt;')
                                      .replace(/>/g, '&gt;')
                                      .replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.pemeriksaan || '-')
                                      .replace(/</g, '&lt;')
                                      .replace(/>/g, '&gt;')
                                      .replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                                {item.alergi && (
                                  <div>
                                    <br />
                                    <strong>Alergi:</strong> {item.alergi}
                                  </div>
                                )}
                                {item.suhu_tubuh && (
                                  <div>
                                    <br />
                                    <strong>Suhu(C):</strong> {item.suhu_tubuh}
                                  </div>
                                )}
                                {item.tensi && (
                                  <div>
                                    <br />
                                    <strong>Tensi:</strong> {item.tensi}
                                  </div>
                                )}
                                {item.nadi && (
                                  <div>
                                    <br />
                                    <strong>Nadi(/menit):</strong> {item.nadi}
                                  </div>
                                )}
                                {item.respirasi && (
                                  <div>
                                    <br />
                                    <strong>Respirasi(/menit):</strong> {item.respirasi}
                                  </div>
                                )}
                                {item.tinggi && (
                                  <div>
                                    <br />
                                    <strong>Tinggi(Cm):</strong> {item.tinggi}
                                  </div>
                                )}
                                {item.berat && (
                                  <div>
                                    <br />
                                    <strong>Berat(Kg):</strong> {item.berat}
                                  </div>
                                )}
                                {item.lingkar_perut && (
                                  <div>
                                    <br />
                                    <strong>Lingkar Perut(Cm):</strong> {item.lingkar_perut}
                                  </div>
                                )}
                                {item.spo2 && (
                                  <div>
                                    <br />
                                    <strong>SpO2(%):</strong> {item.spo2}
                                  </div>
                                )}
                                {item.gcs && (
                                  <div>
                                    <br />
                                    <strong>GCS(E,V,M):</strong> {item.gcs}
                                  </div>
                                )}
                                {item.kesadaran && (
                                  <div>
                                    <br />
                                    <strong>Kesadaran:</strong> {item.kesadaran}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.penilaian || '-').replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.rtl || '-').replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.instruksi || '-').replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'left',
                                  verticalAlign: 'top'
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: (item.evaluasi || '-').replace(/(\r\n|\r|\n|\n\r)/g, '<br>')
                                  }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  border: '1px solid #ddd',
                                  textAlign: 'center',
                                  verticalAlign: 'top'
                                }}
                              >
                                <button
                                  onClick={() => handleCopySoapie(item)}
                                  title="Copy data SOAPIE ke form pemeriksaan"
                                  style={{
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#059669';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#10b981';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                  Copy
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                      Tidak ada data SOAPIE untuk kunjungan ini
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
            }}
          >
            Tutup
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};
