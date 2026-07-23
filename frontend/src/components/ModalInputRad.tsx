import React from 'react';
import Swal from 'sweetalert2';

type InfoRawat = {
  status: 'ranap' | 'ralan';
  kelas: string;
  kamar: string;
  nama_kamar: string;
};

type ModalInputRadProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputRad: React.FC<ModalInputRadProps> = ({ patient, onClose, onSaved }) => {
  const [infoRawat, setInfoRawat] = React.useState<InfoRawat>({ status: 'ralan', kelas: '', kamar: 'Poli', nama_kamar: '' });

  const [radForm, setRadForm] = React.useState({ diagnosa_klinis: '', informasi_tambahan: '' });

  const [searchRad, setSearchRad] = React.useState('');
  const [pemeriksaanRadList, setPemeriksaanRadList] = React.useState<any[]>([]);
  const [selectedPemeriksaanRad, setSelectedPemeriksaanRad] = React.useState<string[]>([]);
  const [loadingRad, setLoadingRad] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [showDropdownRad, setShowDropdownRad] = React.useState(false);

  const [diagnosaKlinisHistory, setDiagnosaKlinisHistory] = React.useState<string[]>([]);
  const [informasiTambahanHistory, setInformasiTambahanHistory] = React.useState<string[]>([]);
  const [showDiagnosaKlinisDropdown, setShowDiagnosaKlinisDropdown] = React.useState(false);
  const [showInformasiTambahanDropdown, setShowInformasiTambahanDropdown] = React.useState(false);
  const [filteredDiagnosaKlinis, setFilteredDiagnosaKlinis] = React.useState<string[]>([]);
  const [filteredInformasiTambahan, setFilteredInformasiTambahan] = React.useState<string[]>([]);

  React.useEffect(() => {
    const fetchInfoRawat = async () => {
      try {
        const res = await fetch(`/api/radiologi/info-rawat/${encodeURIComponent(patient.no_rawat)}`);
        if (res.ok) setInfoRawat(await res.json());
      } catch { /* silent */ }
    };
    void fetchInfoRawat();
  }, [patient.no_rawat]);

  React.useEffect(() => {
    if (searchRad.length > 0) fetchPemeriksaanRadiologi();
  }, [searchRad, infoRawat.kelas]);

  React.useEffect(() => {
    const savedDiagnosa = localStorage.getItem('diagnosa_klinis_history');
    if (savedDiagnosa) { try { setDiagnosaKlinisHistory(JSON.parse(savedDiagnosa)); } catch {} }
    const savedInfo = localStorage.getItem('informasi_tambahan_history');
    if (savedInfo) { try { setInformasiTambahanHistory(JSON.parse(savedInfo)); } catch {} }
  }, []);

  const fetchPemeriksaanRadiologi = async () => {
    setLoadingRad(true);
    try {
      const params = new URLSearchParams({
        search: searchRad,
        kd_pj: patient.kd_pj || '',
        kelas: infoRawat.kelas || patient.kelas || '',
      });
      const res = await fetch(`/api/radiologi/jenis-perawatan?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPemeriksaanRadList(Array.isArray(data) ? data : []);
    } catch {
      setPemeriksaanRadList([]);
    } finally {
      setLoadingRad(false);
    }
  };

  const saveDiagnosaToHistory = (val: string) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    const h = [trimmed, ...diagnosaKlinisHistory.filter(i => i !== trimmed)].slice(0, 20);
    setDiagnosaKlinisHistory(h);
    localStorage.setItem('diagnosa_klinis_history', JSON.stringify(h));
  };

  const saveInformasiToHistory = (val: string) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    const h = [trimmed, ...informasiTambahanHistory.filter(i => i !== trimmed)].slice(0, 20);
    setInformasiTambahanHistory(h);
    localStorage.setItem('informasi_tambahan_history', JSON.stringify(h));
  };

  const filterDiagnosa = (input: string) => {
    if (!input.trim()) { setFilteredDiagnosaKlinis(diagnosaKlinisHistory.slice(0, 10)); return; }
    const lo = input.toLowerCase();
    const sw: string[] = [], cn: string[] = [];
    diagnosaKlinisHistory.forEach(i => { const li = i.toLowerCase(); if (li.startsWith(lo)) sw.push(i); else if (li.includes(lo)) cn.push(i); });
    setFilteredDiagnosaKlinis([...sw, ...cn].slice(0, 10));
  };

  const filterInformasi = (input: string) => {
    if (!input.trim()) { setFilteredInformasiTambahan(informasiTambahanHistory.slice(0, 10)); return; }
    const lo = input.toLowerCase();
    const sw: string[] = [], cn: string[] = [];
    informasiTambahanHistory.forEach(i => { const li = i.toLowerCase(); if (li.startsWith(lo)) sw.push(i); else if (li.includes(lo)) cn.push(i); });
    setFilteredInformasiTambahan([...sw, ...cn].slice(0, 10));
  };

  const togglePemeriksaan = (kd: string) =>
    setSelectedPemeriksaanRad(p => p.includes(kd) ? p.filter(k => k !== kd) : [...p, kd]);

  const getDateTime = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      tgl: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      jam: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  };

  const handleSubmit = async () => {
    if (!radForm.diagnosa_klinis.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Diagnosis Klinis wajib diisi!' });
      return;
    }
    if (selectedPemeriksaanRad.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu pemeriksaan!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      const { tgl, jam } = getDateTime();
      const payload = {
        no_rawat: patient.no_rawat,
        dokter_perujuk: patient.kd_dokter || '',
        status: infoRawat.status,
        diagnosis_klinis: radForm.diagnosa_klinis,
        informasi_tambahan: radForm.informasi_tambahan,
        pemeriksaan_list: selectedPemeriksaanRad,
        tgl_permintaan: tgl,
        jam_permintaan: jam,
      };
      const res = await fetch('/api/radiologi/permintaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan permintaan radiologi');
      }
      const result = await res.json();
      saveDiagnosaToHistory(radForm.diagnosa_klinis);
      if (radForm.informasi_tambahan.trim()) saveInformasiToHistory(radForm.informasi_tambahan);
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Permintaan Radiologi berhasil disimpan!\nNo. Permintaan: ${result.noorder}`,
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
    width: '100%', padding: '9px 12px',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, boxSizing: 'border-box', outline: 'none',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#ffffff', border: '1px solid #d1d5db',
    borderRadius: 6, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxHeight: 200, overflowY: 'auto', zIndex: 1100, marginTop: 4,
  };

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
            background: '#F3F4F6', borderRadius: 20,
            padding: '35px 8px 8px 8px', position: 'relative',
            maxWidth: 1200, width: '52%', height: '42vh', maxHeight: '94vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — title + close button dalam satu baris flex, sejajar
              vertikal (bukan dua elemen absolute yang saling menumpuk). */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px', color: '#000000', fontSize: 13, fontWeight: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Form Permintaan Radiologi
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button" onClick={onClose}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: 20, cursor: 'pointer', color: '#6b7280',
                  padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          </div>

          {/* White Card Content */}
          <div style={{
            background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: '12px',
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>

            {/* Diagnosa Klinis & Informasi Tambahan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Indikasi/Diagnosis Klinis <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={radForm.diagnosa_klinis}
                  onChange={(e) => { setRadForm({ ...radForm, diagnosa_klinis: e.target.value }); filterDiagnosa(e.target.value); }}
                  onFocus={() => { filterDiagnosa(radForm.diagnosa_klinis); setShowDiagnosaKlinisDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDiagnosaKlinisDropdown(false), 200)}
                  placeholder="Masukkan diagnosis klinis..."
                  style={inputStyle}
                />
                {showDiagnosaKlinisDropdown && filteredDiagnosaKlinis.length > 0 && (
                  <div style={dropdownStyle}>
                    {filteredDiagnosaKlinis.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => { setRadForm({ ...radForm, diagnosa_klinis: item }); setShowDiagnosaKlinisDropdown(false); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < filteredDiagnosaKlinis.length - 1 ? '1px solid #e5e7eb' : 'none' }}
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
                  value={radForm.informasi_tambahan}
                  onChange={(e) => { setRadForm({ ...radForm, informasi_tambahan: e.target.value }); filterInformasi(e.target.value); }}
                  onFocus={() => { filterInformasi(radForm.informasi_tambahan); setShowInformasiTambahanDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowInformasiTambahanDropdown(false), 200)}
                  placeholder="Informasi tambahan (opsional)..."
                  style={inputStyle}
                />
                {showInformasiTambahanDropdown && filteredInformasiTambahan.length > 0 && (
                  <div style={dropdownStyle}>
                    {filteredInformasiTambahan.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => { setRadForm({ ...radForm, informasi_tambahan: item }); setShowInformasiTambahanDropdown(false); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < filteredInformasiTambahan.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >{item}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search + Selected Items */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, flex: 1, minHeight: 0, overflowY: 'auto', alignItems: 'start' }}>
              {/* Kolom Kiri - Search Dropdown */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchRad}
                  onChange={(e) => { setSearchRad(e.target.value); setShowDropdownRad(true); }}
                  onFocus={() => setShowDropdownRad(true)}
                  onBlur={() => setTimeout(() => setShowDropdownRad(false), 200)}
                  placeholder="Cari pemeriksaan radiologi..."
                  style={{ ...inputStyle, padding: '10px 12px 10px 38px' }}
                />
                {showDropdownRad && searchRad.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    marginTop: 4, maxHeight: 460, overflowY: 'auto',
                    border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10,
                  }}>
                    {loadingRad ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                        <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      </div>
                    ) : pemeriksaanRadList.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Tidak ada hasil pencarian</div>
                    ) : pemeriksaanRadList.map((item, idx) => (
                      <label
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '2px 12px',
                          background: selectedPemeriksaanRad.includes(item.kd_jenis_prw) ? '#e0f2fe' : idx % 2 === 0 ? '#fef7f5' : '#ffffff',
                          borderBottom: idx < pemeriksaanRadList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { if (!selectedPemeriksaanRad.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (!selectedPemeriksaanRad.includes(item.kd_jenis_prw)) e.currentTarget.style.background = idx % 2 === 0 ? '#fef7f5' : '#ffffff'; }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPemeriksaanRad.includes(item.kd_jenis_prw)}
                          onChange={() => togglePemeriksaan(item.kd_jenis_prw)}
                          style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <div style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.kd_jenis_prw}</div>
                        <div style={{ flex: 1, fontSize: 13, color: '#111827' }}>{item.nm_perawatan}</div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Kolom Kanan - Item Dipilih */}
              <div>
                {selectedPemeriksaanRad.map((kd, idx) => {
                  const item = pemeriksaanRadList.find(p => p.kd_jenis_prw === kd);
                  return (
                    <div key={idx} style={{
                      borderBottom: idx < selectedPemeriksaanRad.length - 1 ? '1px solid #e5e7eb' : 'none',
                      padding: '10px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ flex: 1, marginRight: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{kd}</div>
                        <div style={{ fontSize: 13, color: '#111827' }}>{item?.nm_perawatan || kd}</div>
                      </div>
                      <button
                        onClick={() => togglePemeriksaan(kd)}
                        style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >-</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
              <div>
                <button
                  type="button"
                  onClick={() => { setSelectedPemeriksaanRad([]); setRadForm({ diagnosa_klinis: '', informasi_tambahan: '' }); setSearchRad(''); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >Reset</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6b7280', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >Tutup</button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loadingSubmit}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loadingSubmit ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loadingSubmit ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >{loadingSubmit ? 'Menyimpan...' : 'Simpan Permintaan'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
