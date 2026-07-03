import React from 'react';

type RawatJalanViewProps = {
  onOpenSoap: (patient: any) => void;
};

// Helper function to get current date in local timezone (WIB)
const getCurrentLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const RawatJalanView: React.FC<RawatJalanViewProps> = ({ onOpenSoap }) => {
  const [activeTab, setActiveTab] = React.useState<'poli-today' | 'rujukan-internal'>('poli-today');
  const [poliToday, setPoliToday] = React.useState<any[]>([]);
  const [rujukanInternal, setRujukanInternal] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Inisialisasi tanggal langsung dengan nilai default
  const [tglDari, setTglDari] = React.useState<string>(getCurrentLocalDate());
  const [tglSampai, setTglSampai] = React.useState<string>(getCurrentLocalDate());
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);

  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  const loadPoliToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rawat-jalan/poli-today?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data poli hari ini');
      }
      setPoliToday(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const loadRujukanInternal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rawat-jalan/rujukan-internal?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data rujukan internal');
      }
      setRujukanInternal(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Pastikan tanggal sudah ada sebelum fetch data
    if (!tglDari || !tglSampai) {
      return;
    }

    if (activeTab === 'poli-today') {
      void loadPoliToday();
    } else {
      void loadRujukanInternal();
    }
  }, [activeTab, tglDari, tglSampai]);

  // Auto-refresh setiap 30 detik
  React.useEffect(() => {
    if (!tglDari || !tglSampai) {
      return;
    }

    const interval = setInterval(() => {
      if (activeTab === 'poli-today') {
        void loadPoliToday();
      } else {
        void loadRujukanInternal();
      }
    }, 30000); // 30 detik

    return () => clearInterval(interval);
  }, [activeTab, tglDari, tglSampai]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  const filteredPoliToday = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let filtered = search 
      ? poliToday.filter((p) => {
          const haystack = `${p.no_rkm_medis} ${p.nm_pasien} ${p.nm_dokter} ${p.nm_poli}`.toLowerCase();
          return haystack.includes(search);
        })
      : [...poliToday];
    
    // Urutkan: status "Sudah" di bawah, yang lain di atas
    filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
    
    return filtered;
  }, [poliToday, searchText]);

  const filteredRujukanInternal = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let filtered = search
      ? rujukanInternal.filter((r) => {
          const haystack = `${r.no_rkm_medis} ${r.nm_pasien} ${r.nm_dokter} ${r.nm_poli}`.toLowerCase();
          return haystack.includes(search);
        })
      : [...rujukanInternal];
    
    // Urutkan: status "Sudah" di bawah, yang lain di atas
    filtered.sort((a, b) => {
      if (a.stts === 'Sudah' && b.stts !== 'Sudah') return 1;
      if (a.stts !== 'Sudah' && b.stts === 'Sudah') return -1;
      return 0;
    });
    
    return filtered;
  }, [rujukanInternal, searchText]);

  return (
    <>
      {/* Header dengan Filter Button - Di atas card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        {/* Filter Button with Dropdown */}
        <div ref={filterDropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            style={{
              padding: '8px 16px',
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

      {/* Card Section */}
      <section

      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        border: '1px solid #e5e7eb'
      }}
    >

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '2px solid #e5e7eb'
        }}
      >
        <button
          onClick={() => setActiveTab('poli-today')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'poli-today' ? '3px solid #1AB1E5' : '3px solid transparent',
            color: activeTab === 'poli-today' ? '#1AB1E5' : '#6b7280',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'poli-today' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          Poli Hari Ini
        </button>
        <button
          onClick={() => setActiveTab('rujukan-internal')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'rujukan-internal' ? '3px solid #1AB1E5' : '3px solid transparent',
            color: activeTab === 'rujukan-internal' ? '#1AB1E5' : '#6b7280',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'rujukan-internal' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          Rujukan Poli Internal
        </button>

        {/* Search Box */}
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
              width: 250
            }}
          />
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
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}

      {/* Tab Poli Hari Ini */}
      {activeTab === 'poli-today' && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflow: 'auto',
            maxHeight: 600
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12
            }}
          >
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Umur</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Cara Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoliToday.map((p, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    background: p.stts === 'Sudah' 
                      ? 'rgba(16, 185, 129, 0.1)' // Hijau transparan untuk status "Sudah"
                      : (idx % 2 === 0 ? '#ffffff' : '#f9fafb')
                  }}
                >
                  <td
                    style={{
                      padding: '6px 8px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                    onClick={() => onOpenSoap(p)}
                  >
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 6,
                      border: '1px solid #1AB1E5',
                      color: '#1AB1E5',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 11,
                      background: '#f0faff'
                    }}>
                      {p.no_rkm_medis}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.no_reg}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_dokter}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_poli}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.umur}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.tgl_registrasi}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.jam_reg}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.png_jawab}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {p.no_rawat}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: p.stts === 'Sudah' ? '#ecfdf3' : '#fef3c7',
                        color: p.stts === 'Sudah' ? '#166534' : '#92400e',
                        fontSize: 11
                      }}
                    >
                      {p.stts}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPoliToday.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      color: '#9ca3af',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    {loading ? 'Memuat data...' : 'Tidak ada data poli hari ini'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Rujukan Internal */}
      {activeTab === 'rujukan-internal' && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflow: 'auto',
            maxHeight: 600
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12
            }}
          >
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli Tujuan</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Umur</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Cara Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRujukanInternal.map((r, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    background: r.stts === 'Sudah' 
                      ? 'rgba(16, 185, 129, 0.1)' // Hijau transparan untuk status "Sudah"
                      : (idx % 2 === 0 ? '#ffffff' : '#f9fafb')
                  }}
                >
                  <td
                    style={{
                      padding: '6px 8px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                    onClick={() => onOpenSoap(r)}
                  >
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 6,
                      border: '1px solid #1AB1E5',
                      color: '#1AB1E5',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 11,
                      background: '#f0faff'
                    }}>
                      {r.no_rkm_medis}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.nm_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.nm_dokter}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.nm_poli}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.umur}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.tgl_registrasi}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.jam_reg}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{r.png_jawab}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {r.no_rawat}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: r.stts === 'Sudah' ? '#ecfdf3' : '#fef3c7',
                        color: r.stts === 'Sudah' ? '#166534' : '#92400e',
                        fontSize: 11
                      }}
                    >
                      {r.stts}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRujukanInternal.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      color: '#9ca3af',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    {loading ? 'Memuat data...' : 'Tidak ada data rujukan internal hari ini'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </>
  );
};
