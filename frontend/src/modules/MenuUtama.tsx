import React from 'react';

type MenuKey =
  | 'menu-utama'
  | 'pendaftaran'
  | 'igd'
  | 'rawat-jalan'
  | 'rawat-inap'
  | 'radiologi'
  | 'laboratorium-pk'
  | 'laboratorium-pa'
  | 'farmasi'
  | 'kasir'
  | 'casemix'
  | 'bridging'
  | 'kepegawaian'
  | 'anjungan-antrian'
  | 'rekam-medis'
  | 'berkas-digital'
  | 'jadwal-operasi'
  | 'laporan'
  | 'admin'
  | 'satu-sehat'
  | 'mapping-satu-sehat';

type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active?: boolean;
};

type MenuUtamaViewProps = {
  user: AppUser;
  setActiveMenu: (menu: MenuKey) => void;
  canAccessMenu: (menu: MenuKey, role: AppUser['role']) => boolean;
};

type Category = 'semua' | 'klinik' | 'penunjang' | 'manajemen' | 'integrasi';

type ModuleCard = {
  key: MenuKey;
  label: string;
  description: string;
  icon: string;
  category: Category;
};

export const MenuUtamaView: React.FC<MenuUtamaViewProps> = ({ user, setActiveMenu, canAccessMenu }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState<Category>('semua');

  const moduleCards: ModuleCard[] = [
    {
      key: 'pendaftaran',
      label: 'Pendaftaran',
      description: 'Pendaftaran pasien rawat jalan dan rawat inap',
      icon: '📋',
      category: 'klinik',
    },
    {
      key: 'igd',
      label: 'IGD',
      description: 'Instalasi Gawat Darurat & triase pasien',
      icon: '🚑',
      category: 'klinik',
    },
    {
      key: 'rawat-jalan',
      label: 'Rawat Jalan',
      description: 'Pemeriksaan poli, SOAP, resep & tindakan',
      icon: '👨‍⚕️',
      category: 'klinik',
    },
    {
      key: 'rawat-inap',
      label: 'Rawat Inap',
      description: 'Manajemen bed, DPJP & catatan perawatan',
      icon: '🏥',
      category: 'klinik',
    },
    {
      key: 'radiologi',
      label: 'Radiologi',
      description: 'Permintaan & hasil pemeriksaan radiologi',
      icon: '🩻',
      category: 'penunjang',
    },
    {
      key: 'laboratorium-pk',
      label: 'Laboratorium PK',
      description: 'Pemeriksaan lab Patologi Klinik & hasil laboratorium',
      icon: '🔬',
      category: 'penunjang',
    },
    {
      key: 'laboratorium-pa',
      label: 'Laboratorium PA',
      description: 'Pemeriksaan lab Patologi Anatomi & hasil laboratorium',
      icon: '🧫',
      category: 'penunjang',
    },
    {
      key: 'farmasi',
      label: 'Farmasi',
      description: 'Pengelolaan stok obat & distribusi resep',
      icon: '💊',
      category: 'penunjang',
    },
    {
      key: 'kasir',
      label: 'Kasir',
      description: 'Billing pasien & pembayaran',
      icon: '💳',
      category: 'klinik',
    },
    {
      key: 'casemix',
      label: 'Casemix',
      description: 'Grouping, analisis casemix & klaim INA-CBG',
      icon: '📦',
      category: 'klinik',
    },
    {
      key: 'bridging',
      label: 'Bridging',
      description: 'Integrasi & bridging sistem eksternal (BPJS, SATUSEHAT, dll)',
      icon: '🔗',
      category: 'integrasi',
    },
    {
      key: 'kepegawaian',
      label: 'Kepegawaian',
      description: 'Data pegawai, dokter, perawat & SDM',
      icon: '👥',
      category: 'manajemen',
    },
    {
      key: 'anjungan-antrian',
      label: 'Anjungan & Antrian',
      description: 'Sistem antrian & display anjungan pasien',
      icon: '🎫',
      category: 'manajemen',
    },
    {
      key: 'rekam-medis',
      label: 'Rekam Medis',
      description: 'Pengelolaan rekam medis & dokumentasi',
      icon: '📁',
      category: 'manajemen',
    },
    {
      key: 'berkas-digital',
      label: 'Berkas Digital',
      description: 'Arsip dokumen & berkas digital pasien',
      icon: '📄',
      category: 'manajemen',
    },
    {
      key: 'jadwal-operasi',
      label: 'Jadwal Operasi',
      description: 'Penjadwalan & manajemen operasi ruang OK',
      icon: '🗓️',
      category: 'klinik',
    },
    {
      key: 'laporan',
      label: 'Laporan',
      description: 'Laporan kunjungan, BOR, LOS & pendapatan',
      icon: '📊',
      category: 'manajemen',
    },
    {
      key: 'admin',
      label: 'Pengaturan',
      description: 'Manajemen user, hak akses & konfigurasi sistem',
      icon: '⚙️',
      category: 'manajemen',
    },
    {
      key: 'satu-sehat',
      label: 'Satu Sehat',
      description: 'Integrasi data kesehatan Kemenkes RI',
      icon: '🏛️',
      category: 'integrasi',
    },
    {
      key: 'mapping-satu-sehat',
      label: 'Mapping Satu Sehat',
      description: 'Mapping LOINC, modality & kode obat nasional',
      icon: '🗺️',
      category: 'integrasi',
    },
  ];

  const categories: { key: Category; label: string }[] = [
    { key: 'semua',      label: 'Semua' },
    { key: 'klinik',     label: 'Klinik' },
    { key: 'penunjang',  label: 'Penunjang' },
    { key: 'manajemen',  label: 'Manajemen' },
    { key: 'integrasi',  label: 'Integrasi' },
  ];

  const filtered = moduleCards.filter((mod) => {
    const matchSearch =
      searchQuery === '' ||
      mod.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = activeCategory === 'semua' || mod.category === activeCategory;
    const hasAccess = canAccessMenu(mod.key, user.role);
    return matchSearch && matchCategory && hasAccess;
  });

  return (
    <div
      style={{
        background: '#F3F4F6',
        borderRadius: 20,
        padding: '35px 6px 6px 6px',
        position: 'relative',
      }}
    >
      {/* Header Title */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400,
        }}
      >
        Menu Utama
      </div>

      {/* White Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: 12,
        }}
      >
        {/* Toolbar: Tab + Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Category segmented tabs */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f3f4f6',
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  padding: '5px 16px',
                  borderRadius: 8,
                  border: activeCategory === cat.key ? '1px solid #d1d5db' : 'none',
                  background: activeCategory === cat.key ? '#ffffff' : 'transparent',
                  color: activeCategory === cat.key ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: activeCategory === cat.key ? 500 : 400,
                  transition: 'all 0.15s ease',
                  boxShadow: activeCategory === cat.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <div
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari modul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                outline: 'none',
                color: '#111827',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            />
          </div>
        </div>

        {/* Module Grid */}
        {filtered.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: 4,
            }}
          >
            {filtered.map((mod) => (
              <button
                key={mod.key}
                type="button"
                onClick={() => setActiveMenu(mod.key)}
                style={{
                  padding: '14px 8px 10px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    flexShrink: 0,
                  }}
                >
                  {mod.icon}
                </div>

                {/* Label */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#111827',
                    lineHeight: 1.35,
                    wordBreak: 'break-word',
                  }}
                >
                  {mod.label}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '48px 0',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            Tidak ada modul yang sesuai
            {searchQuery && (
              <span style={{ color: '#374151', fontWeight: 500 }}> "{searchQuery}"</span>
            )}
          </div>
        )}

        {/* Footer info */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {filtered.length} modul ditampilkan
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Login sebagai <strong style={{ color: '#374151' }}>{user.full_name}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
