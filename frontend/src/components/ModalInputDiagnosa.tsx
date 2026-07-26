import React from 'react';
import Swal from 'sweetalert2';

type ModalInputDiagnosaProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

// Padanan tab "Diagnosa" di Khanza Java (laporan/PanelDiagnosa.java) yang
// menggabungkan input Diagnosa ICD10 (diagnosa_pasien) dan Prosedur ICD9
// (prosedur_pasien) dalam satu panel — di sini dipisah lewat switch
// sub-tab. Daftar ICD10/ICD9 langsung dimuat saat modal dibuka (query
// kosong -> backend balikin 50 baris awal), lalu difilter ulang tiap
// kali user mengetik. Panel daftar inline (bukan portal dropdown)
// supaya selalu terlihat, tidak perlu fokus dulu.
type SubTab = 'diagnosa' | 'prosedur';
type PenyakitOption = { kd_penyakit: string; nm_penyakit: string };
type Icd9Option = { kode: string; deskripsi_panjang: string };

export const ModalInputDiagnosa: React.FC<ModalInputDiagnosaProps> = ({ patient, onClose, onSaved }) => {
  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('diagnosa');
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // Diagnosa (ICD10)
  const [searchPenyakit, setSearchPenyakit] = React.useState('');
  const [penyakitOptions, setPenyakitOptions] = React.useState<PenyakitOption[]>([]);
  const [loadingPenyakit, setLoadingPenyakit] = React.useState(false);
  const [selectedDiagnosa, setSelectedDiagnosa] = React.useState<(PenyakitOption & { prioritas: number })[]>([]);

  // Prosedur (ICD9)
  const [searchIcd9, setSearchIcd9] = React.useState('');
  const [icd9Options, setIcd9Options] = React.useState<Icd9Option[]>([]);
  const [loadingIcd9, setLoadingIcd9] = React.useState(false);
  const [selectedProsedur, setSelectedProsedur] = React.useState<(Icd9Option & { prioritas: number; jumlah: string })[]>([]);

  const fetchPenyakit = React.useCallback((q: string) => {
    setLoadingPenyakit(true);
    fetch(`/api/penyakit/search?q=${encodeURIComponent(q)}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data) => setPenyakitOptions(Array.isArray(data) ? data : []))
      .catch(() => setPenyakitOptions([]))
      .finally(() => setLoadingPenyakit(false));
  }, []);

  const fetchIcd9 = React.useCallback((q: string) => {
    setLoadingIcd9(true);
    fetch(`/api/icd9/search?q=${encodeURIComponent(q)}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data) => setIcd9Options(Array.isArray(data) ? data : []))
      .catch(() => setIcd9Options([]))
      .finally(() => setLoadingIcd9(false));
  }, []);

  // Muat daftar awal begitu modal dibuka
  React.useEffect(() => {
    fetchPenyakit('');
    fetchIcd9('');
  }, [fetchPenyakit, fetchIcd9]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchPenyakit(searchPenyakit.trim()), 300);
    return () => clearTimeout(t);
  }, [searchPenyakit, fetchPenyakit]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchIcd9(searchIcd9.trim()), 300);
    return () => clearTimeout(t);
  }, [searchIcd9, fetchIcd9]);

  const addDiagnosa = (item: PenyakitOption) => {
    setSelectedDiagnosa(prev => {
      if (prev.some(d => d.kd_penyakit === item.kd_penyakit)) return prev;
      return [...prev, { ...item, prioritas: prev.length + 1 }];
    });
  };

  const addProsedur = (item: Icd9Option) => {
    setSelectedProsedur(prev => {
      if (prev.some(p => p.kode === item.kode)) return prev;
      return [...prev, { ...item, prioritas: prev.length + 1, jumlah: '1' }];
    });
  };

  const handleSubmit = async () => {
    if (selectedDiagnosa.length === 0 && selectedProsedur.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu diagnosa atau prosedur terlebih dahulu!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const item of selectedDiagnosa) {
        try {
          const res = await fetch('/api/pemeriksaan/diagnosa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              no_rawat: patient.no_rawat,
              no_rkm_medis: patient.no_rkm_medis,
              kd_penyakit: item.kd_penyakit,
              prioritas: item.prioritas,
            }),
          });
          if (res.ok) successCount++; else errorCount++;
        } catch { errorCount++; }
      }

      for (const item of selectedProsedur) {
        try {
          const res = await fetch('/api/pemeriksaan/prosedur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              no_rawat: patient.no_rawat,
              kode: item.kode,
              prioritas: item.prioritas,
              jumlah: item.jumlah || '1',
            }),
          });
          if (res.ok) successCount++; else errorCount++;
        } catch { errorCount++; }
      }

      if (successCount > 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: `${successCount} data berhasil disimpan${errorCount > 0 ? `, ${errorCount} gagal (kemungkinan sudah ada)` : ''}`,
          timer: 2000,
          showConfirmButton: false,
        });
        onSaved();
        onClose();
      } else {
        throw new Error('Gagal menyimpan semua data');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan saat menyimpan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleReset = () => {
    setSelectedDiagnosa([]);
    setSelectedProsedur([]);
    setSearchPenyakit('');
    setSearchIcd9('');
  };

  return (
    <>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}
      >
        <div
          style={{
            background: '#F3F4F6', borderRadius: 20,
            padding: '35px 8px 8px 8px', position: 'relative',
            maxWidth: 900, width: '90%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — title + close button dalam satu baris flex */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px', color: '#000000', fontSize: 13, fontWeight: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Input Diagnosa & Prosedur
            </span>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >×</button>
          </div>

          {/* White Card Content */}
          <div style={{
            background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: '12px',
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            {/* Sub-tab Diagnosa/Prosedur */}
            <div style={{ display: 'inline-flex', alignSelf: 'center', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 16, flexShrink: 0 }}>
              {([
                { key: 'diagnosa', label: `Diagnosa (ICD10)${selectedDiagnosa.length > 0 ? ` · ${selectedDiagnosa.length}` : ''}` },
                { key: 'prosedur', label: `Prosedur (ICD9)${selectedProsedur.length > 0 ? ` · ${selectedProsedur.length}` : ''}` },
              ] as const).map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveSubTab(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: activeSubTab === t.key ? '1px solid #d1d5db' : 'none',
                    background: activeSubTab === t.key ? '#ffffff' : 'transparent',
                    color: activeSubTab === t.key ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: activeSubTab === t.key ? 500 : 400,
                    transition: 'all 0.2s ease',
                    boxShadow: activeSubTab === t.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeSubTab === 'diagnosa' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Diagnosa (ICD10) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchPenyakit}
                    onChange={(e) => setSearchPenyakit(e.target.value)}
                    placeholder="Cari nama/kode ICD10..."
                    style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                    onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Daftar ICD10 — langsung tampil saat modal dibuka */}
                <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {loadingPenyakit ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
                  ) : penyakitOptions.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada hasil</div>
                  ) : (
                    penyakitOptions.map((item, idx) => {
                      const isSelected = selectedDiagnosa.some(d => d.kd_penyakit === item.kd_penyakit);
                      return (
                        <div
                          key={item.kd_penyakit}
                          onClick={() => !isSelected && addDiagnosa(item)}
                          style={{
                            padding: '8px 12px',
                            cursor: isSelected ? 'default' : 'pointer',
                            background: isSelected ? '#e0f2fe' : '#ffffff',
                            borderBottom: idx < penyakitOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                        >
                          <div style={{ fontSize: 12.5, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600 }}>{item.kd_penyakit}</span> - {item.nm_penyakit} {isSelected && <span style={{ color: '#1AB1E5' }}>✓</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedDiagnosa.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {selectedDiagnosa.map((item) => (
                      <div key={item.kd_penyakit} style={{ background: '#f0f9ff', border: '1px solid #1AB1E5', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_penyakit}</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.kd_penyakit} • Prioritas {item.prioritas === 1 ? 'Utama' : `Sekunder ${item.prioritas - 1}`}</div>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={item.prioritas}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setSelectedDiagnosa(prev => prev.map(d => d.kd_penyakit === item.kd_penyakit ? { ...d, prioritas: val } : d));
                          }}
                          title="Urutan prioritas (1=Utama)"
                          style={{ width: 40, padding: '4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, textAlign: 'center' }}
                        />
                        <button
                          onClick={() => setSelectedDiagnosa(prev => prev.filter(d => d.kd_penyakit !== item.kd_penyakit))}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                          title="Hapus"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'prosedur' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Prosedur (ICD9)
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchIcd9}
                    onChange={(e) => setSearchIcd9(e.target.value)}
                    placeholder="Cari nama/kode ICD9..."
                    style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                    onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Daftar ICD9 — langsung tampil saat modal dibuka */}
                <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {loadingIcd9 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
                  ) : icd9Options.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada hasil</div>
                  ) : (
                    icd9Options.map((item, idx) => {
                      const isSelected = selectedProsedur.some(p => p.kode === item.kode);
                      return (
                        <div
                          key={item.kode}
                          onClick={() => !isSelected && addProsedur(item)}
                          style={{
                            padding: '8px 12px',
                            cursor: isSelected ? 'default' : 'pointer',
                            background: isSelected ? '#e0f2fe' : '#ffffff',
                            borderBottom: idx < icd9Options.length - 1 ? '1px solid #f3f4f6' : 'none',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                        >
                          <div style={{ fontSize: 12.5, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600 }}>{item.kode}</span> - {item.deskripsi_panjang} {isSelected && <span style={{ color: '#1AB1E5' }}>✓</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedProsedur.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {selectedProsedur.map((item) => (
                      <div key={item.kode} style={{ background: '#f0f9ff', border: '1px solid #1AB1E5', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deskripsi_panjang}</div>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.kode}</div>
                          </div>
                          <button
                            onClick={() => setSelectedProsedur(prev => prev.filter(p => p.kode !== item.kode))}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                            title="Hapus"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Prioritas
                            <input
                              type="number"
                              min={1}
                              value={item.prioritas}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setSelectedProsedur(prev => prev.map(p => p.kode === item.kode ? { ...p, prioritas: val } : p));
                              }}
                              style={{ width: 40, padding: '4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, textAlign: 'center' }}
                            />
                          </label>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Jumlah
                            <input
                              type="text"
                              value={item.jumlah}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedProsedur(prev => prev.map(p => p.kode === item.kode ? { ...p, jumlah: val } : p));
                              }}
                              style={{ width: 40, padding: '4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, textAlign: 'center' }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button" onClick={handleReset}
                style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >Reset</button>
              <button
                type="button" onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >Tutup</button>
              <button
                type="button" onClick={handleSubmit} disabled={loadingSubmit}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >{loadingSubmit ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
