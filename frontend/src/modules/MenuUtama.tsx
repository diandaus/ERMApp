import React from 'react';

type MenuKey =
  | 'menu-utama'
  | 'pendaftaran'
  | 'igd'
  | 'rawat-jalan'
  | 'rawat-inap'
  | 'radiologi'
  | 'laboratorium'
  | 'farmasi'
  | 'kasir'
  | 'kepegawaian'
  | 'anjungan-antrian'
  | 'rekam-medis'
  | 'berkas-digital'
  | 'jadwal-operasi'
  | 'laporan'
  | 'admin'
  | 'satu-sehat';

type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: 'pendaftaran' | 'dokter' | 'farmasi' | 'kasir' | 'admin';
  is_active?: boolean;
};

type MenuUtamaViewProps = {
  user: AppUser;
  setActiveMenu: (menu: MenuKey) => void;
  canAccessMenu: (menu: MenuKey, role: AppUser['role']) => boolean;
};

export const MenuUtamaView: React.FC<MenuUtamaViewProps> = ({ user, setActiveMenu, canAccessMenu }) => {
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const moduleCards = [
    {
      key: 'pendaftaran' as MenuKey,
      label: 'Pendaftaran',
      description: 'Pendaftaran pasien rawat jalan dan rawat inap',
      icon: '📋',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    {
      key: 'igd' as MenuKey,
      label: 'IGD',
      description: 'Instalasi Gawat Darurat & triase pasien',
      icon: '🚑',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)'
    },
    {
      key: 'rawat-jalan' as MenuKey,
      label: 'Rawat Jalan',
      description: 'Pemeriksaan poli, SOAP, resep & tindakan',
      icon: '👨‍⚕️',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.2)'
    },
    {
      key: 'rawat-inap' as MenuKey,
      label: 'Rawat Inap',
      description: 'Manajemen bed, DPJP & catatan perawatan',
      icon: '🏥',
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: 'rgba(139, 92, 246, 0.2)'
    },
    {
      key: 'radiologi' as MenuKey,
      label: 'Radiologi',
      description: 'Permintaan & hasil pemeriksaan radiologi',
      icon: '🩻',
      color: '#7c3aed',
      bgColor: 'rgba(124, 58, 237, 0.08)',
      borderColor: 'rgba(124, 58, 237, 0.2)'
    },
    {
      key: 'laboratorium' as MenuKey,
      label: 'Laboratorium',
      description: 'Pemeriksaan lab PK, PA & hasil laboratorium',
      icon: '🔬',
      color: '#0891b2',
      bgColor: 'rgba(8, 145, 178, 0.08)',
      borderColor: 'rgba(8, 145, 178, 0.2)'
    },
    {
      key: 'farmasi' as MenuKey,
      label: 'Farmasi',
      description: 'Pengelolaan stok obat & distribusi resep',
      icon: '💊',
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.08)',
      borderColor: 'rgba(6, 182, 212, 0.2)'
    },
    {
      key: 'kasir' as MenuKey,
      label: 'Kasir',
      description: 'Billing pasien & pembayaran',
      icon: '💳',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.08)',
      borderColor: 'rgba(245, 158, 11, 0.2)'
    },
    {
      key: 'kepegawaian' as MenuKey,
      label: 'Kepegawaian',
      description: 'Data pegawai, dokter, perawat & SDM',
      icon: '👥',
      color: '#14b8a6',
      bgColor: 'rgba(20, 184, 166, 0.08)',
      borderColor: 'rgba(20, 184, 166, 0.2)'
    },
    {
      key: 'anjungan-antrian' as MenuKey,
      label: 'Anjungan & Antrian',
      description: 'Sistem antrian & display anjungan pasien',
      icon: '🎫',
      color: '#f43f5e',
      bgColor: 'rgba(244, 63, 94, 0.08)',
      borderColor: 'rgba(244, 63, 94, 0.2)'
    },
    {
      key: 'rekam-medis' as MenuKey,
      label: 'Rekam Medis',
      description: 'Pengelolaan rekam medis & dokumentasi',
      icon: '📁',
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: 'rgba(139, 92, 246, 0.2)'
    },
    {
      key: 'berkas-digital' as MenuKey,
      label: 'Berkas Digital',
      description: 'Arsip dokumen & berkas digital pasien',
      icon: '📄',
      color: '#0ea5e9',
      bgColor: 'rgba(14, 165, 233, 0.08)',
      borderColor: 'rgba(14, 165, 233, 0.2)'
    },
    {
      key: 'jadwal-operasi' as MenuKey,
      label: 'Jadwal Operasi',
      description: 'Penjadwalan & manajemen operasi ruang OK',
      icon: '🏥',
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.08)',
      borderColor: 'rgba(220, 38, 38, 0.2)'
    },
    {
      key: 'laporan' as MenuKey,
      label: 'Laporan',
      description: 'Laporan kunjungan, BOR, LOS & pendapatan',
      icon: '📊',
      color: '#ec4899',
      bgColor: 'rgba(236, 72, 153, 0.08)',
      borderColor: 'rgba(236, 72, 153, 0.2)'
    },
    {
      key: 'admin' as MenuKey,
      label: 'Pengaturan',
      description: 'Manajemen user & hak akses sistem',
      icon: '⚙️',
      color: '#64748b',
      bgColor: 'rgba(100, 116, 139, 0.08)',
      borderColor: 'rgba(100, 116, 139, 0.2)'
    },
    {
      key: 'satu-sehat' as MenuKey,
      label: 'Satu Sehat',
      description: 'Integrasi data kesehatan Kemenkes RI',
      icon: '🏛️',
      color: '#0ea5e9',
      bgColor: 'rgba(14, 165, 233, 0.08)',
      borderColor: 'rgba(14, 165, 233, 0.2)'
    }
  ];

  // Filter modul berdasarkan search query dan hak akses
  const filteredModules = moduleCards.filter((mod) => {
    const matchesSearch =
      searchQuery === '' ||
      mod.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    const hasAccess = canAccessMenu(mod.key, user.role);
    return matchesSearch && hasAccess;
  });

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      {/* Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 250 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Cari modul..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 34px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box'
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Module Cards Section */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, color: '#111827' }}>
          Modul Aplikasi {filteredModules.length > 0 && `(${filteredModules.length})`}
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16
          }}
        >
          {filteredModules.map((mod) => (
            <button
              key={mod.key}
              onClick={() => setActiveMenu(mod.key)}
              style={{
                padding: 20,
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(37,99,235,0.15)';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  lineHeight: 1
                }}
              >
                {mod.icon}
              </div>
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#2563eb',
                    marginBottom: 4
                  }}
                >
                  {mod.label}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#6b7280',
                    lineHeight: 1.5
                  }}
                >
                  {mod.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {filteredModules.length === 0 && (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 14
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ margin: 0 }}>
              Tidak ada modul yang sesuai dengan pencarian "<strong>{searchQuery}</strong>"
            </p>
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(59, 130, 246, 0.05))',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          fontSize: 13,
          color: '#4b5563'
        }}
      >
        <strong style={{ display: 'block', marginBottom: 8, color: '#1e40af' }}>
          Petunjuk Penggunaan
        </strong>
        <ul style={{ marginTop: 0, paddingLeft: 18, marginBottom: 0 }}>
          <li>Klik pada card modul di atas untuk mengakses fitur yang tersedia</li>
          <li>Modul yang ditampilkan disesuaikan dengan hak akses role Anda</li>
          <li>Gunakan menu sidebar di sebelah kiri untuk navigasi cepat</li>
          <li>Gunakan kolom pencarian untuk menemukan modul dengan cepat</li>
        </ul>
      </div>
    </section>
  );
};
