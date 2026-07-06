import React from 'react';
import Swal from 'sweetalert2';

type ModalInputLabProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputLab: React.FC<ModalInputLabProps> = ({ patient, onClose, onSaved }) => {
  const [activeLabTab, setActiveLabTab] = React.useState<'pk' | 'pa'>('pk');

  const [labForm, setLabForm] = React.useState({
    diagnosa_klinis: '',
    informasi_tambahan: ''
  });

  const [searchPK, setSearchPK] = React.useState('');
  const [pemeriksaanPKList, setPemeriksaanPKList] = React.useState<any[]>([]);
  const [selectedPemeriksaanPK, setSelectedPemeriksaanPK] = React.useState<string[]>([]);
  const [loadingPK, setLoadingPK] = React.useState(false);

  const [searchPA, setSearchPA] = React.useState('');
  const [pemeriksaanPAList, setPemeriksaanPAList] = React.useState<any[]>([]);
  const [selectedPemeriksaanPA, setSelectedPemeriksaanPA] = React.useState<string[]>([]);
  const [loadingPA, setLoadingPA] = React.useState(false);

  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  const [showDropdownPK, setShowDropdownPK] = React.useState(false);
  const [showDropdownPA, setShowDropdownPA] = React.useState(false);

  const [diagnosaKlinisHistory, setDiagnosaKlinisHistory] = React.useState<string[]>([]);
  const [informasiTambahanHistory, setInformasiTambahanHistory] = React.useState<string[]>([]);
  const [showDiagnosaKlinisDropdown, setShowDiagnosaKlinisDropdown] = React.useState(false);
  const [showInformasiTambahanDropdown, setShowInformasiTambahanDropdown] = React.useState(false);
  const [filteredDiagnosaKlinis, setFilteredDiagnosaKlinis] = React.useState<string[]>([]);
  const [filteredInformasiTambahan, setFilteredInformasiTambahan] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (activeLabTab === 'pk') fetchPemeriksaanPK();
  }, [activeLabTab, searchPK]);

  React.useEffect(() => {
    if (activeLabTab === 'pa') fetchPemeriksaanPA();
  }, [activeLabTab, searchPA]);

  React.useEffect(() => {
    const savedDiagnosa = localStorage.getItem('diagnosa_klinis_history');
    if (savedDiagnosa) {
      try { setDiagnosaKlinisHistory(JSON.parse(savedDiagnosa)); } catch {}
    }
    const savedInfo = localStorage.getItem('informasi_tambahan_history');
    if (savedInfo) {
      try { setInformasiTambahanHistory(JSON.parse(savedInfo)); } catch {}
    }
  }, []);

  const fetchPemeriksaanPK = async () => {
    setLoadingPK(true);
    try {
      const params = new URLSearchParams({ kategori: 'PK', search: searchPK, kd_pj: patient.kd_pj || '' });
      const res = await fetch(`/api/lab/jenis-perawatan?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPemeriksaanPKList(Array.isArray(data) ? data : []);
    } catch {
      setPemeriksaanPKList([]);
    } finally {
      setLoadingPK(false);
    }
  };

  const fetchPemeriksaanPA = async () => {
    setLoadingPA(true);
    try {
      const params = new URLSearchParams({ kategori: 'PA', search: searchPA, kd_pj: patient.kd_pj || '' });
      const res = await fetch(`/api/lab/jenis-perawatan?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPemeriksaanPAList(Array.isArray(data) ? data : []);
    } catch {
      setPemeriksaanPAList([]);
    } finally {
      setLoadingPA(false);
    }
  };

  const saveDiagnosaToHistory = (val: string) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    let h = [trimmed, ...diagnosaKlinisHistory.filter(i => i !== trimmed)].slice(0, 20);
    setDiagnosaKlinisHistory(h);
    localStorage.setItem('diagnosa_klinis_history', JSON.stringify(h));
  };

  const saveInformasiToHistory = (val: string) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    let h = [trimmed, ...informasiTambahanHistory.filter(i => i !== trimmed)].slice(0, 20);
    setInformasiTambahanHistory(h);
    localStorage.setItem('informasi_tambahan_history', JSON.stringify(h));
  };

  const filterDiagnosa = (input: string) => {
    const src = diagnosaKlinisHistory;
    if (!input.trim()) { setFilteredDiagnosaKlinis(src.slice(0, 10)); return; }
    const lo = input.toLowerCase();
    const sw: string[] = [], cn: string[] = [];
    src.forEach(i => { const li = i.toLowerCase(); if (li.startsWith(lo)) sw.push(i); else if (li.includes(lo)) cn.push(i); });
    setFilteredDiagnosaKlinis([...sw, ...cn].slice(0, 10));
  };

  const filterInformasi = (input: string) => {
    const src = informasiTambahanHistory;
    if (!input.trim()) { setFilteredInformasiTambahan(src.slice(0, 10)); return; }
    const lo = input.toLowerCase();
    const sw: string[] = [], cn: string[] = [];
    src.forEach(i => { const li = i.toLowerCase(); if (li.startsWith(lo)) sw.push(i); else if (li.includes(lo)) cn.push(i); });
    setFilteredInformasiTambahan([...sw, ...cn].slice(0, 10));
  };

  const togglePK = (kd: string) => setSelectedPemeriksaanPK(p => p.includes(kd) ? p.filter(k => k !== kd) : [...p, kd]);
  const togglePA = (kd: string) => setSelectedPemeriksaanPA(p => p.includes(kd) ? p.filter(k => k !== kd) : [...p, kd]);

  const getDateTime = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const tgl = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return { tgl, jam };
  };

  const handleSubmitPK = async () => {
    if (!labForm.diagnosa_klinis.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Diagnosis Klinis wajib diisi!' });
      return;
    }
    if (selectedPemeriksaanPK.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu pemeriksaan!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      const { tgl, jam } = getDateTime();
      const payload = {
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter || '',
        status_lanjut: 'ralan',
        diagnosis_klinis: labForm.diagnosa_klinis,
        informasi_tambahan: labForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanPK,
        detail_pemeriksaan: [],
        tgl_permintaan: tgl,
        jam_permintaan: jam,
      };
      const res = await fetch('/api/lab/permintaan-pk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan permintaan lab PK');
      }
      const result = await res.json();
      saveDiagnosaToHistory(labForm.diagnosa_klinis);
      if (labForm.informasi_tambahan.trim()) saveInformasiToHistory(labForm.informasi_tambahan);
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Lab PK berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
        timer: 3000,
        showConfirmButton: true,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleSubmitPA = async () => {
    if (!labForm.diagnosa_klinis.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Diagnosis Klinis wajib diisi!' });
      return;
    }
    if (selectedPemeriksaanPA.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu pemeriksaan!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      const { tgl, jam } = getDateTime();
      const payload = {
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter || '',
        status_lanjut: 'ralan',
        diagnosis_klinis: labForm.diagnosa_klinis,
        informasi_tambahan: labForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanPA,
        tgl_permintaan: tgl,
        jam_permintaan: jam,
        tgl_pengambilan_bahan: tgl,
        diperoleh_dengan: '',
        lokasi_pengambilan: '',
        diawetkan: '',
        dilakukan_pa: '',
        tgl_pa: '',
        nomor_pa: '',
        diagnosa_pa: '',
      };
      const res = await fetch('/api/lab/permintaan-pa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan permintaan lab PA');
      }
      const result = await res.json();
      saveDiagnosaToHistory(labForm.diagnosa_klinis);
      if (labForm.informasi_tambahan.trim()) saveInformasiToHistory(labForm.informasi_tambahan);
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Lab PA berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
        timer: 3000,
        showConfirmButton: true,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxHeight: 200,
    overflowY: 'auto',
    zIndex: 1100,
    marginTop: 4,
  };

  const renderPemeriksaanDropdown = (
    type: 'pk' | 'pa',
    search: string,
    setSearch: (v: string) => void,
    showDropdown: boolean,
    setShowDropdown: (v: boolean) => void,
    list: any[],
    loading: boolean,
    selected: string[],
    toggle: (kd: string) => void,
    setSelected: (v: string[]) => void,
    onSubmit: () => void
  ) => (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto', alignItems: 'start' }}>
        {/* Kolom Kiri - Search + Dropdown */}
        <div>
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', zIndex: 1
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder={`Cari pemeriksaan ${type.toUpperCase()}...`}
              style={{ ...inputStyle, padding: '10px 12px 10px 38px' }}
            />
            {showDropdown && search.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                marginTop: 4, maxHeight: 460, overflowY: 'auto',
                border: '1px solid #e5e7eb', borderRadius: 8,
                background: '#ffffff',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                zIndex: 10
              }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                    <div style={{
                      display: 'inline-block', width: 20, height: 20,
                      border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5',
                      borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                ) : list.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                    Tidak ada hasil pencarian
                  </div>
                ) : list.map((item, idx) => (
                  <label
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 12px',
                      background: selected.includes(item.kd_jenis_prw) ? '#e0f2fe' : '#ffffff',
                      borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.kd_jenis_prw)}
                      onChange={() => toggle(item.kd_jenis_prw)}
                      style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.nm_perawatan}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {item.kd_jenis_prw}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan - Item Dipilih */}
        <div>
          <div style={{
            background: '#f0f9ff', border: '1px solid #1AB1E5',
            borderRadius: 8, padding: '8px 12px', minHeight: 42
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#1AB1E5',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: selected.length > 0 ? 12 : 0
            }}>
              <span>✓ Item Dipilih ({selected.length})</span>
              {selected.length > 0 && (
                <button
                  onClick={() => setSelected([])}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: '2px 8px' }}
                >
                  Hapus Semua
                </button>
              )}
            </div>
            {selected.map((kd, idx) => {
              const item = list.find(p => p.kd_jenis_prw === kd);
              return (
                <div key={idx} style={{
                  background: '#ffffff', border: '1px solid #1AB1E5',
                  borderRadius: 6, padding: '8px 10px', marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{item?.nm_perawatan || kd}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{kd}</div>
                  </div>
                  <button
                    onClick={() => toggle(kd)}
                    style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}
                  >✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div>
          <button
            type="button"
            onClick={() => { setSelected([]); setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' }); }}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#6b7280', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
            }}
          >
            Reset
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
          <button
            type="button"
            onClick={onSubmit}
            disabled={loadingSubmit}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: loadingSubmit ? '#9ca3af' : '#2563eb',
              color: '#fff', cursor: loadingSubmit ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 500,
            }}
          >
            {loadingSubmit ? 'Menyimpan...' : `Simpan Lab ${type.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );

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
            background: '#F3F4F6',
            borderRadius: 20,
            padding: '35px 8px 8px 8px',
            position: 'relative',
            maxWidth: 900,
            width: '90%',
            height: '60vh',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
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
            padding: '12px 20px', color: '#000000',
            fontSize: 13, fontWeight: 400,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Form Permintaan Laboratorium
          </div>

          {/* White Card Content */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #d1d5db',
            padding: '16px',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Tab PK / PA */}
            <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 20, flexShrink: 0 }}>
              {(['pk', 'pa'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveLabTab(tab)}
                  style={{
                    padding: '6px 24px',
                    borderRadius: 8,
                    border: activeLabTab === tab ? '1px solid #d1d5db' : 'none',
                    background: activeLabTab === tab ? '#ffffff' : 'transparent',
                    color: activeLabTab === tab ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: activeLabTab === tab ? 500 : 400,
                    transition: 'all 0.2s ease',
                    boxShadow: activeLabTab === tab ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab === 'pk' ? 'Lab PK (Patologi Klinik)' : 'Lab PA (Patologi Anatomi)'}
                </button>
              ))}
            </div>

            {/* Diagnosa Klinis & Informasi Tambahan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Indikasi/Diagnosis Klinis <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={labForm.diagnosa_klinis}
                  onChange={(e) => { setLabForm({ ...labForm, diagnosa_klinis: e.target.value }); filterDiagnosa(e.target.value); }}
                  onFocus={() => { filterDiagnosa(labForm.diagnosa_klinis); setShowDiagnosaKlinisDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDiagnosaKlinisDropdown(false), 200)}
                  placeholder="Masukkan diagnosis klinis..."
                  style={inputStyle}
                />
                {showDiagnosaKlinisDropdown && filteredDiagnosaKlinis.length > 0 && (
                  <div style={dropdownStyle}>
                    {filteredDiagnosaKlinis.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => { setLabForm({ ...labForm, diagnosa_klinis: item }); setShowDiagnosaKlinisDropdown(false); }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                          borderBottom: i < filteredDiagnosaKlinis.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >{item}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Informasi Tambahan
                </label>
                <input
                  type="text"
                  value={labForm.informasi_tambahan}
                  onChange={(e) => { setLabForm({ ...labForm, informasi_tambahan: e.target.value }); filterInformasi(e.target.value); }}
                  onFocus={() => { filterInformasi(labForm.informasi_tambahan); setShowInformasiTambahanDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowInformasiTambahanDropdown(false), 200)}
                  placeholder="Informasi tambahan (opsional)..."
                  style={inputStyle}
                />
                {showInformasiTambahanDropdown && filteredInformasiTambahan.length > 0 && (
                  <div style={dropdownStyle}>
                    {filteredInformasiTambahan.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => { setLabForm({ ...labForm, informasi_tambahan: item }); setShowInformasiTambahanDropdown(false); }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                          borderBottom: i < filteredInformasiTambahan.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >{item}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Konten Tab */}
            {activeLabTab === 'pk' && renderPemeriksaanDropdown(
              'pk', searchPK, setSearchPK, showDropdownPK, setShowDropdownPK,
              pemeriksaanPKList, loadingPK, selectedPemeriksaanPK,
              togglePK, setSelectedPemeriksaanPK, handleSubmitPK
            )}
            {activeLabTab === 'pa' && renderPemeriksaanDropdown(
              'pa', searchPA, setSearchPA, showDropdownPA, setShowDropdownPA,
              pemeriksaanPAList, loadingPA, selectedPemeriksaanPA,
              togglePA, setSelectedPemeriksaanPA, handleSubmitPA
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
