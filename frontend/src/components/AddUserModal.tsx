import React from 'react';
import { ModalCariPetugas } from './ModalCariPetugas';
import { ModalCariDokter } from './ModalCariDokter';

type AppUserRole = string;

const BASE_ROLES: { value: AppUserRole; label: string }[] = [
  { value: 'pendaftaran', label: 'Pendaftaran' },
  { value: 'dokter', label: 'Dokter' },
  { value: 'farmasi', label: 'Farmasi' },
  { value: 'kasir', label: 'Kasir' },
  { value: 'admin', label: 'Admin' },
];

type Dokter = {
  kd_dokter: string;
  nm_dokter: string;
};

type Petugas = {
  nip: string;
  nama: string;
};

type EditUser = {
  id: number;
  username: string;
  full_name: string;
  role: AppUserRole;
  allowed_modules?: string;
  nip?: string;
  kd_dokter?: string;
};

type AddUserModalProps = {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setError: (error: string | null) => void;
  editUser?: EditUser | null;
};

export const AddUserModal: React.FC<AddUserModalProps> = ({ show, onClose, onSuccess, setError, editUser }) => {
  const [userType, setUserType] = React.useState<'dokter' | 'petugas' | null>(null);
  const [dokterList, setDokterList] = React.useState<Dokter[]>([]);
  const [petugasList, setPetugasList] = React.useState<Petugas[]>([]);
  const [selectedDokter, setSelectedDokter] = React.useState<string>('');
  const [selectedPetugas, setSelectedPetugas] = React.useState<string>('');
  const [newUsername, setNewUsername] = React.useState<string>('');
  const [newFullName, setNewFullName] = React.useState<string>('');
  const [newPassword, setNewPassword] = React.useState<string>('');
  const [newRole, setNewRole] = React.useState<AppUserRole>('pendaftaran');
  const [isCustomRole, setIsCustomRole] = React.useState<boolean>(false);
  const [creating, setCreating] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedModules, setSelectedModules] = React.useState<string[]>([]);
  // NIP petugas Khanza yang di-link ke akun ini — dipakai auto-fill kolom
  // Petugas di form klinis (mis. Adime Gizi) berdasarkan user login,
  // terpisah dari username/role di atas (akun dokter pun bisa di-link
  // ke NIP kalau memang relevan).
  const [newNip, setNewNip] = React.useState<string>('');
  const [newNipNama, setNewNipNama] = React.useState<string>('');
  const [nipPickerOpen, setNipPickerOpen] = React.useState<boolean>(false);
  // kd_dokter yang di-link ke akun ini — dipakai RawatJalanView (App.tsx)
  // buat membatasi Daftar Pasien Poli ke pasien milik dokter ini saja saat
  // role='dokter'. Terpisah dari NIP di atas (dokter & petugas 2 tabel
  // identitas berbeda di Khanza) dan terpisah dari username/newFullName
  // (yang saat Tipe User=Dokter kebetulan sama dgn kd_dokter, tapi itu
  // cuma konvensi penamaan, bukan link eksplisit yang bisa diandalkan).
  const [newKdDokter, setNewKdDokter] = React.useState<string>('');
  const [newKdDokterNama, setNewKdDokterNama] = React.useState<string>('');
  const [kdDokterPickerOpen, setKdDokterPickerOpen] = React.useState<boolean>(false);

  // Define available modules
  const availableModules = [
    { key: 'menu-utama', label: 'Menu Utama' },
    { key: 'pendaftaran', label: 'Pendaftaran' },
    { key: 'igd', label: 'IGD' },
    { key: 'rawat-jalan', label: 'Rawat Jalan' },
    { key: 'rawat-inap', label: 'Rawat Inap' },
    { key: 'radiologi', label: 'Radiologi' },
    { key: 'laboratorium', label: 'Laboratorium' },
    { key: 'farmasi', label: 'Farmasi' },
    { key: 'kasir', label: 'Kasir' },
    { key: 'casemix', label: 'Casemix' },
    { key: 'bridging', label: 'Bridging' },
    { key: 'kepegawaian', label: 'Kepegawaian' },
    { key: 'it-support', label: 'IT Support' },
    { key: 'anjungan-antrian', label: 'Anjungan & Antrian' },
    { key: 'rekam-medis', label: 'Rekam Medis' },
    { key: 'berkas-digital', label: 'Berkas Digital' },
    { key: 'jadwal-operasi', label: 'Kamar Operasi (OK)' },
    { key: 'laporan', label: 'Laporan' },
    { key: 'admin', label: 'Pengaturan' }
  ];

  // Initialize form with editUser data when modal opens in edit mode
  React.useEffect(() => {
    if (show && editUser) {
      // Edit mode - fill form with existing data
      setNewUsername(editUser.username);
      setNewFullName(editUser.full_name);
      setNewRole(editUser.role);
      setIsCustomRole(!BASE_ROLES.some((r) => r.value === editUser.role));
      setNewPassword(''); // Password optional in edit mode
      if (editUser.allowed_modules) {
        setSelectedModules(editUser.allowed_modules.split(',').filter(Boolean));
      } else {
        setSelectedModules([]);
      }
      setNewNip(editUser.nip || '');
      setNewNipNama('');
      if (editUser.nip) {
        fetch(`/api/petugas?search=${encodeURIComponent(editUser.nip)}`)
          .then((res) => res.json())
          .then((data) => {
            const found = (Array.isArray(data) ? data : []).find((p: Petugas) => p.nip === editUser.nip);
            if (found) setNewNipNama(found.nama);
          })
          .catch(() => { /* ignore */ });
      }
      setNewKdDokter(editUser.kd_dokter || '');
      setNewKdDokterNama('');
      if (editUser.kd_dokter) {
        fetch(`/api/dokter?search=${encodeURIComponent(editUser.kd_dokter)}`)
          .then((res) => res.json())
          .then((data) => {
            const found = (Array.isArray(data) ? data : []).find((d: Dokter) => d.kd_dokter === editUser.kd_dokter);
            if (found) setNewKdDokterNama(found.nm_dokter);
          })
          .catch(() => { /* ignore */ });
      }
    } else if (!show) {
      // Reset form when modal closes
      setUserType(null);
      setSelectedDokter('');
      setSelectedPetugas('');
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setNewRole('pendaftaran');
      setIsCustomRole(false);
      setSearchQuery('');
      setSelectedModules([]);
      setNewNip('');
      setNewNipNama('');
      setNewKdDokter('');
      setNewKdDokterNama('');
    }
  }, [show, editUser]);

  // Fetch dokter list with search
  const fetchDokter = async (search: string = '') => {
    try {
      const url = search ? `/api/dokter?search=${encodeURIComponent(search)}` : '/api/dokter';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setDokterList(data);
      }
    } catch (e) {
      console.error('Gagal fetch dokter:', e);
    }
  };

  // Fetch petugas list with search
  const fetchPetugas = async (search: string = '') => {
    try {
      const url = search ? `/api/petugas?search=${encodeURIComponent(search)}` : '/api/petugas';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setPetugasList(data);
      }
    } catch (e) {
      console.error('Gagal fetch petugas:', e);
    }
  };

  // Debounce search effect
  React.useEffect(() => {
    if (!userType) return;

    const timer = setTimeout(() => {
      if (userType === 'dokter') {
        fetchDokter(searchQuery);
      } else if (userType === 'petugas') {
        fetchPetugas(searchQuery);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, userType]);

  // Handle user type selection
  const handleUserTypeChange = async (type: 'dokter' | 'petugas') => {
    setUserType(type);
    setSearchQuery(''); // Reset search when changing type
    setSelectedDokter('');
    setSelectedPetugas('');
    setNewUsername('');
    setNewFullName('');
    if (type === 'dokter') {
      await fetchDokter();
    } else if (type === 'petugas') {
      await fetchPetugas();
    }
  };

  // Handle search query change - reset selection when user types
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Reset selection when user starts typing to search again
    if (value && (selectedDokter || selectedPetugas)) {
      setSelectedDokter('');
      setSelectedPetugas('');
      setNewUsername('');
      setNewFullName('');
    }
  };

  // Handle dokter selection
  const handleDokterSelect = (kd_dokter: string) => {
    setSelectedDokter(kd_dokter);
    const dokter = dokterList.find((d) => d.kd_dokter === kd_dokter);
    if (dokter) {
      setNewUsername(dokter.kd_dokter);
      setNewFullName(dokter.nm_dokter);
      setNewRole('dokter');
      // Akun ini mewakili dokter yang sama — saran otomatis, admin tetap
      // bisa ganti/kosongkan lewat picker Kode Dokter kalau ternyata beda.
      setNewKdDokter(dokter.kd_dokter);
      setNewKdDokterNama(dokter.nm_dokter);
    }
  };

  // Handle petugas selection
  const handlePetugasSelect = (nip: string) => {
    setSelectedPetugas(nip);
    const petugas = petugasList.find((p) => p.nip === nip);
    if (petugas) {
      setNewUsername(petugas.nip);
      setNewFullName(petugas.nama);
      // Akun petugas ini kemungkinan besar mewakili orang yang sama —
      // saran otomatis, admin tetap bisa ganti/kosongkan lewat picker NIP.
      setNewNip(petugas.nip);
      setNewNipNama(petugas.nama);
    }
  };

  // Handle module checkbox toggle
  const handleModuleToggle = (moduleKey: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(moduleKey)) {
        return prev.filter((key) => key !== moduleKey);
      } else {
        return [...prev, moduleKey];
      }
    });
  };

  // Handle select all / deselect all
  const handleSelectAllModules = () => {
    if (selectedModules.length === availableModules.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(availableModules.map((m) => m.key));
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newUsername || !newFullName || !newRole) {
      setError('Lengkapi username, nama lengkap, dan role.');
      return;
    }
    // Password required only for create mode
    if (!editUser && !newPassword) {
      setError('Password wajib diisi untuk user baru.');
      return;
    }
    if (selectedModules.length === 0) {
      setError('Pilih minimal 1 modul yang bisa diakses.');
      return;
    }

    setCreating(true);
    try {
      if (editUser) {
        // Edit mode - PUT request
        const body: any = {
          full_name: newFullName,
          role: newRole,
          is_active: true,
          allowed_modules: selectedModules.join(','),
          nip: newNip.trim(),
          kd_dokter: newKdDokter.trim()
        };
        // Include password only if it's filled
        if (newPassword) {
          body.password = newPassword;
        }

        const res = await fetch(`/api/admin/users/${editUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any).error || 'Gagal mengupdate user');
        }
      } else {
        // Create mode - POST request
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: newUsername,
            password: newPassword,
            full_name: newFullName,
            role: newRole,
            allowed_modules: selectedModules.join(','),
            nip: newNip.trim(),
            kd_dokter: newKdDokter.trim()
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any).error || 'Gagal membuat user');
        }
      }
      // Success - reset and close
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Terjadi kesalahan saat ${editUser ? 'mengupdate' : 'membuat'} user`);
    } finally {
      setCreating(false);
    }
  };

  if (!show) return null;

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
        padding: 20
      }}
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            background: 'transparent',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: '#6b7280',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>

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
          {editUser ? 'Edit User' : 'Tambah User Baru'}
        </div>

        {/* White Card Content */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: 12,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto'
        }}>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Pilih Tipe User */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: '#374151' }}>
              Pilih Tipe User
            </label>
            <div style={{
              display: 'inline-flex',
              background: '#f3f4f6',
              borderRadius: 12,
              padding: 4,
              gap: 4
            }}>
              <button
                type="button"
                onClick={() => handleUserTypeChange('dokter')}
                style={{
                  padding: '8px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: userType === 'dokter' ? '#ffffff' : 'transparent',
                  color: userType === 'dokter' ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: userType === 'dokter' ? 500 : 400,
                  transition: 'all 0.2s ease',
                  boxShadow: userType === 'dokter' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                Dokter
              </button>
              <button
                type="button"
                onClick={() => handleUserTypeChange('petugas')}
                style={{
                  padding: '8px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: userType === 'petugas' ? '#ffffff' : 'transparent',
                  color: userType === 'petugas' ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: userType === 'petugas' ? 500 : 400,
                  transition: 'all 0.2s ease',
                  boxShadow: userType === 'petugas' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                Petugas
              </button>
            </div>
          </div>

          {/* Step 2: Cari dan Pilih */}
          {userType && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  Cari {userType === 'dokter' ? 'Dokter' : 'Petugas'}
                </label>

                {/* Search Input */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={`Ketik nama ${userType === 'dokter' ? 'dokter' : 'petugas'} untuk mencari...`}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                </div>

                {/* Results List - Only show when no selection */}
                {!selectedDokter && !selectedPetugas && (
                  <>
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        maxHeight: 280,
                        overflow: 'auto',
                        background: '#fff'
                      }}
                    >
                      {userType === 'dokter' && dokterList.length > 0 && (
                        <>
                          {dokterList.map((d) => (
                            <button
                              key={d.kd_dokter}
                              type="button"
                              onClick={() => handleDokterSelect(d.kd_dokter)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                borderBottom: '1px solid #f3f4f6',
                                background: '#fff',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                              }}
                            >
                              <div style={{ fontWeight: 500, color: '#111827', marginBottom: 2 }}>{d.nm_dokter}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>Kode: {d.kd_dokter}</div>
                            </button>
                          ))}
                        </>
                      )}

                      {userType === 'petugas' && petugasList.length > 0 && (
                        <>
                          {petugasList.map((p) => (
                            <button
                              key={p.nip}
                              type="button"
                              onClick={() => handlePetugasSelect(p.nip)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                borderBottom: '1px solid #f3f4f6',
                                background: '#fff',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                              }}
                            >
                              <div style={{ fontWeight: 500, color: '#111827', marginBottom: 2 }}>{p.nama}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>NIP: {p.nip}</div>
                            </button>
                          ))}
                        </>
                      )}

                      {((userType === 'dokter' && dokterList.length === 0) ||
                        (userType === 'petugas' && petugasList.length === 0)) && (
                        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                          <div style={{ marginBottom: 8 }}>🔍</div>
                          {searchQuery ? (
                            <p style={{ margin: 0 }}>Tidak ditemukan hasil untuk "{searchQuery}"</p>
                          ) : (
                            <p style={{ margin: 0 }}>Ketik untuk mencari {userType === 'dokter' ? 'dokter' : 'petugas'}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Result count */}
                    {((userType === 'dokter' && dokterList.length > 0) || (userType === 'petugas' && petugasList.length > 0)) && (
                      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                        Menampilkan {userType === 'dokter' ? dokterList.length : petugasList.length} hasil
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Nama Dokter/Petugas dan Username (Auto-fill) - Side by side */}
              {(editUser || selectedDokter || selectedPetugas) && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {/* Nama Dokter/Petugas */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                      Nama {editUser ? 'Lengkap' : (userType === 'dokter' ? 'Dokter' : 'Petugas')}
                    </label>
                    <input
                      type="text"
                      value={newFullName}
                      readOnly={!editUser}
                      onChange={editUser ? (e) => setNewFullName(e.target.value) : undefined}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: editUser ? '#fff' : '#f9fafb',
                        color: '#111827'
                      }}
                    />
                  </div>

                  {/* Username */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                      Username
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#f9fafb',
                        color: '#111827'
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Form Fields */}
          {(editUser || selectedDokter || selectedPetugas) && (
            <>
              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  Password {!editUser && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                  {editUser && <span style={{ color: '#6b7280', fontWeight: 400 }}>(opsional - kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={editUser ? "Kosongkan jika tidak ingin mengubah" : "Masukkan password"}
                  required={!editUser}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* NIP Petugas (link ke form klinis) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  NIP Petugas Klinis <span style={{ color: '#6b7280', fontWeight: 400 }}>(opsional — untuk auto-isi kolom Petugas di form seperti Adime Gizi)</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={newNip}
                    onChange={(e) => { setNewNip(e.target.value); setNewNipNama(''); }}
                    placeholder="NIP"
                    style={{ width: '30%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    value={newNipNama}
                    readOnly
                    placeholder="Nama petugas"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#f9fafb', color: '#374151' }}
                  />
                  <button
                    type="button"
                    onClick={() => setNipPickerOpen(true)}
                    style={{ padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Cari petugas"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Kode Dokter (link ke Daftar Pasien Poli) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  Kode Dokter <span style={{ color: '#6b7280', fontWeight: 400 }}>(wajib utk role Dokter — membatasi Daftar Pasien Poli ke pasien milik dokter ini saja)</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={newKdDokter}
                    onChange={(e) => { setNewKdDokter(e.target.value); setNewKdDokterNama(''); }}
                    placeholder="Kode"
                    style={{ width: '30%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    value={newKdDokterNama}
                    readOnly
                    placeholder="Nama dokter"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#f9fafb', color: '#374151' }}
                  />
                  <button
                    type="button"
                    onClick={() => setKdDokterPickerOpen(true)}
                    style={{ padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Cari dokter"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Role */}
              {(editUser || userType === 'petugas') && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                    Role
                  </label>
                  {isCustomRole ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        placeholder="Ketik nama role baru..."
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => { setIsCustomRole(false); setNewRole('pendaftaran'); }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#374151',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newRole}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomRole(true);
                          setNewRole('');
                        } else {
                          setNewRole(e.target.value);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#fff'
                      }}
                    >
                      {BASE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                      <option value="__custom__">+ Tambah role baru...</option>
                    </select>
                  )}
                  <p style={{ margin: '6px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                    Role custom hanya jadi label — hak akses tetap diatur lewat pilihan modul di bawah.
                  </p>
                </div>
              )}

              {/* Hak Akses Modul */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                    Hak Akses Modul
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllModules}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #2563eb',
                      background: '#fff',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 500
                    }}
                  >
                    {selectedModules.length === availableModules.length ? 'Batalkan Semua' : 'Pilih Semua'}
                  </button>
                </div>
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#f9fafb'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {availableModules.map((module) => (
                      <label
                        key={module.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#2563eb';
                          e.currentTarget.style.background = '#f0f9ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(module.key)}
                          onChange={() => handleModuleToggle(module.key)}
                          style={{ marginRight: 8, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                  Dipilih: {selectedModules.length} dari {availableModules.length} modul
                </p>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: creating ? '#9ca3af' : '#2563eb',
                    color: '#fff',
                    cursor: creating ? 'default' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  {creating ? 'Menyimpan…' : (editUser ? 'Update User' : 'Tambah User')}
                </button>
              </div>
            </>
          )}
        </form>
        </div>
      </div>
      <ModalCariPetugas
        isOpen={nipPickerOpen}
        onClose={() => setNipPickerOpen(false)}
        onSelect={(nip, nama) => { setNewNip(nip); setNewNipNama(nama); }}
      />
      <ModalCariDokter
        isOpen={kdDokterPickerOpen}
        onClose={() => setKdDokterPickerOpen(false)}
        onSelect={(kdDokter, nmDokter) => { setNewKdDokter(kdDokter); setNewKdDokterNama(nmDokter); }}
      />
    </div>
  );
};
