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
  // Redesain jadi panel slide-in dari kanan, PERSIS pola ModalInputLab.tsx/
  // ModalInputTriase.tsx/ResepModal.tsx (overlay fixed + panel anchor kanan
  // full-height, header breadcrumb pasien + tombol close bulat, body
  // scrollable, footer sticky cuma Simpan full-width) — ganti dari versi
  // lama (dialog card mengambang di tengah, radius 20/16). Komponen ini
  // TIDAK menerima prop `isOpen` (parent langsung mount/unmount saat buka/
  // tutup), jadi animasi masuk dipicu sendiri lewat effect on-mount, dan
  // `handleClose` menunda pemanggilan `onClose` asli sampai animasi keluar
  // selesai.
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const [infoRawat, setInfoRawat] = React.useState<InfoRawat>({ status: 'ralan', kelas: '', kamar: 'Poli', nama_kamar: '' });

  const [radForm, setRadForm] = React.useState({ diagnosa_klinis: '', informasi_tambahan: '' });

  const [searchRad, setSearchRad] = React.useState('');
  const [pemeriksaanRadList, setPemeriksaanRadList] = React.useState<any[]>([]);
  // Simpan objek lengkap (bukan cuma kd_jenis_prw) — padanan
  // selectedDiagnosa/selectedProsedur di ModalInputDiagnosa.tsx, supaya
  // nama tetap tampil benar di daftar terpilih walau item itu sudah
  // tidak ada lagi di pemeriksaanRadList (hasil pencarian berubah tiap
  // ketik, beda dari sebelumnya yang cuma simpan kode lalu .find() ulang
  // — bisa gagal ketemu kalau hasil pencarian sudah berganti).
  const [selectedPemeriksaanRad, setSelectedPemeriksaanRad] = React.useState<any[]>([]);
  const [loadingRad, setLoadingRad] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

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

  // Muat daftar awal begitu modal dibuka / kelas rawat sudah diketahui
  // (query kosong -> backend balikin 50 baris awal), lalu difilter ulang
  // (debounce) tiap kali user mengetik — padanan ModalInputDiagnosa.tsx.
  React.useEffect(() => {
    fetchPemeriksaanRadiologi();
  }, [infoRawat.kelas]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchPemeriksaanRadiologi(), 300);
    return () => clearTimeout(t);
  }, [searchRad]);

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

  const togglePemeriksaan = (item: any) =>
    setSelectedPemeriksaanRad(p =>
      p.some(i => i.kd_jenis_prw === item.kd_jenis_prw)
        ? p.filter(i => i.kd_jenis_prw !== item.kd_jenis_prw)
        : [...p, item]
    );

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
        pemeriksaan_list: selectedPemeriksaanRad.map(item => item.kd_jenis_prw),
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
        showConfirmButton: false,
      });
      onSaved();
      handleClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Tinggi 30px PERSIS .form-control di ResepModal.css (sama dgn
  // ModalInputLab.tsx) — bukan lagi padding 9px 12px tanpa height eksplisit.
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 30,
    padding: '5px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#ffffff', border: '1px solid #d1d5db',
    borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxHeight: 200, overflowY: 'auto', zIndex: 1100, marginTop: 4,
  };

  return (
    <>
      {/* Redesain jadi panel slide-in dari kanan, PERSIS pola
          ModalInputLab.tsx/ModalInputTriase.tsx/ResepModal.tsx. */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onClick={handleClose}
      >
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
            background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — breadcrumb pasien + close button bulat, PERSIS pola
              ModalInputTriase.tsx. */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
                .filter(Boolean)
                .map((v, i, arr) => (
                  <React.Fragment key={i}>
                    <span>{v}</span>
                    {i < arr.length - 1 && <span>|</span>}
                  </React.Fragment>
                ))}
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
                flexShrink: 0,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body — scrollable, flat. */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Diagnosa Klinis & Informasi Tambahan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
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
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < filteredDiagnosaKlinis.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >{item}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
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
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < filteredInformasiTambahan.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >{item}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search + Dropdown — full width sendirian (bukan grid 2
                kolom lagi, PERSIS ModalInputLab.tsx). */}
            <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
              Nama Pemeriksaan{selectedPemeriksaanRad.length > 0 && ` (${selectedPemeriksaanRad.length} dipilih)`}
            </label>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={searchRad}
                onChange={(e) => { setSearchRad(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Cari pemeriksaan radiologi..."
                style={{ ...inputStyle, padding: '5px 12px 5px 38px' }}
              />
              {showDropdown && searchRad.length > 0 && (
                <div
                  onWheel={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    marginTop: 4, maxHeight: 460, overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    border: '1px solid #e5e7eb', borderRadius: 8,
                    background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    zIndex: 20,
                  }}
                >
                  {loadingRad ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                      <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                  ) : pemeriksaanRadList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada hasil pencarian</div>
                  ) : pemeriksaanRadList.map((item, idx) => {
                    const isSelected = selectedPemeriksaanRad.some(p => p.kd_jenis_prw === item.kd_jenis_prw);
                    return (
                      <label
                        key={item.kd_jenis_prw}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '2px 12px',
                          background: isSelected ? '#e0f2fe' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                          borderBottom: idx < pemeriksaanRadList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePemeriksaan(item)}
                          style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <div style={{ width: 90, flexShrink: 0, fontSize: 12, color: '#111827' }}>{item.kd_jenis_prw}</div>
                        <div style={{ flex: 1, fontSize: 12, color: '#111827' }}>{item.nm_perawatan}</div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabel item terpilih PERSIS di bawah kolom Nama Pemeriksaan
                — header "P|Kode Periksa|Nama Pemeriksaan", checkbox P
                selalu tercentang (baris ini memang yg sudah dipilih);
                klik/uncek P = hapus dari daftar terpilih. Pola sama dgn
                ModalInputLab.tsx/ModalInputAwalKeperawatanIGD.tsx. */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
                <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode Periksa</div>
                <div style={{ flex: 1, padding: '0 8px' }}>Nama Pemeriksaan</div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {selectedPemeriksaanRad.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    Belum ada pemeriksaan dipilih
                  </div>
                ) : selectedPemeriksaanRad.map((item, idx) => (
                  <div
                    key={item.kd_jenis_prw}
                    onClick={() => togglePemeriksaan(item)}
                    style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', cursor: 'pointer', borderBottom: idx < selectedPemeriksaanRad.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  >
                    <div style={{ width: 28, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked onChange={() => togglePemeriksaan(item)} style={{ cursor: 'pointer', width: 14, height: 14 }} title="Hilangkan centang utk menghapus" />
                    </div>
                    <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{item.kd_jenis_prw}</div>
                    <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827' }}>{item.nm_perawatan}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer — sticky, PERSIS pola ModalInputTriase.tsx (tombol
              Simpan full-width, radius 4, fontSize 14). Reset & Tutup
              dihapus per konvensi ModalInputLab.tsx — Tutup masih bisa
              lewat overlay/tombol close di header. */}
          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loadingSubmit}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 4, border: 'none', background: loadingSubmit ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: loadingSubmit ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { if (!loadingSubmit) e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { if (!loadingSubmit) e.currentTarget.style.background = '#1AB1E5'; }}
            >
              {loadingSubmit ? 'Menyimpan...' : 'Simpan Radiologi'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
