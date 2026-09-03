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
// PenyakitOption — bentuk respons GET /api/penyakit/search (backend/
// diagnosa_prosedur_handler.go), PERSIS kolom penyakit + Kategori/
// Ciri-ciri Umum yg di-JOIN dari kategori_penyakit.
type PenyakitOption = {
  kd_penyakit: string;
  nm_penyakit: string;
  ciri_ciri: string;
  keterangan: string;
  kategori: string;
  ciri_umum: string;
  validcode: string;
  accpdx: string;
  asterisk: string;
  im: string;
};
// Icd9Option — bentuk respons GET /api/icd9/search (backend/
// diagnosa_prosedur_handler.go), PERSIS kolom icd9.
type Icd9Option = {
  kode: string;
  deskripsi_panjang: string;
  deskripsi_pendek: string;
  validcode: string;
  accpdx: string;
  im: string;
};

export const ModalInputDiagnosa: React.FC<ModalInputDiagnosaProps> = ({ patient, onClose, onSaved }) => {
  // Redesain jadi panel slide-in dari kanan, PERSIS pola ModalInputLab.tsx/
  // ModalInputRad.tsx/ModalInputTindakan.tsx/ModalInputTriase.tsx (overlay
  // fixed + panel anchor kanan full-height, header breadcrumb pasien +
  // tombol close bulat, body scrollable, footer sticky cuma Simpan full-
  // width) — ganti dari versi lama (dialog card mengambang di tengah,
  // radius 20/16). Komponen ini TIDAK menerima prop `isOpen` (parent
  // langsung mount/unmount saat buka/tutup), jadi animasi masuk dipicu
  // sendiri lewat effect on-mount, dan `handleClose` menunda pemanggilan
  // `onClose` asli sampai animasi keluar selesai.
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('diagnosa');
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // Diagnosa (ICD10)
  const [searchPenyakit, setSearchPenyakit] = React.useState('');
  const [penyakitOptions, setPenyakitOptions] = React.useState<PenyakitOption[]>([]);
  const [loadingPenyakit, setLoadingPenyakit] = React.useState(false);
  const [selectedDiagnosa, setSelectedDiagnosa] = React.useState<(PenyakitOption & { prioritas: number })[]>([]);
  const [showDropdownDiagnosa, setShowDropdownDiagnosa] = React.useState(false);

  // Prosedur (ICD9)
  const [searchIcd9, setSearchIcd9] = React.useState('');
  const [icd9Options, setIcd9Options] = React.useState<Icd9Option[]>([]);
  const [loadingIcd9, setLoadingIcd9] = React.useState(false);
  const [selectedProsedur, setSelectedProsedur] = React.useState<(Icd9Option & { prioritas: number; jumlah: string })[]>([]);
  const [showDropdownProsedur, setShowDropdownProsedur] = React.useState(false);

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
        handleClose();
      } else {
        throw new Error('Gagal menyimpan semua data');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan saat menyimpan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Tinggi 30px PERSIS .form-control di ResepModal.css (sama dgn
  // ModalInputLab.tsx/ModalInputRad.tsx/ModalInputTindakan.tsx) — bukan
  // lagi padding 10px 12px tanpa height eksplisit.
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

  const prioritasInputStyle: React.CSSProperties = {
    width: 40, height: 20, padding: '0 4px', border: '1px solid #d1d5db',
    borderRadius: 4, fontSize: 11, textAlign: 'center', boxSizing: 'border-box',
  };

  return (
    <>
      {/* Redesain jadi panel slide-in dari kanan, PERSIS pola
          ModalInputLab.tsx/ModalInputRad.tsx/ModalInputTindakan.tsx/
          ModalInputTriase.tsx/ResepModal.tsx. */}
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
            {/* Sub-tab Diagnosa/Prosedur — button group flat (radius 0,
                tombol nempel/berbagi border, aktif biru cyan #1AB1E5),
                PERSIS pola ResepModal.tsx/ModalInputLab.tsx — ganti dari
                pill segmented control lama. */}
            <div style={{ display: 'inline-flex', marginBottom: 16, flexShrink: 0 }}>
              {([
                { key: 'diagnosa', label: `Diagnosa (ICD10)${selectedDiagnosa.length > 0 ? ` (${selectedDiagnosa.length})` : ''}` },
                { key: 'prosedur', label: `Prosedur (ICD9)${selectedProsedur.length > 0 ? ` (${selectedProsedur.length})` : ''}` },
              ] as const).map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveSubTab(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 0,
                    border: '1px solid #1AB1E5',
                    borderLeft: i === 0 ? '1px solid #1AB1E5' : 'none',
                    background: activeSubTab === t.key ? '#1AB1E5' : '#ffffff',
                    color: activeSubTab === t.key ? '#ffffff' : '#1AB1E5',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 400,
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeSubTab === 'diagnosa' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Diagnosa (ICD10) <span style={{ color: '#ef4444' }}>*</span>
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
                    value={searchPenyakit}
                    onChange={(e) => { setSearchPenyakit(e.target.value); setShowDropdownDiagnosa(true); }}
                    onFocus={() => setShowDropdownDiagnosa(true)}
                    onBlur={() => setTimeout(() => setShowDropdownDiagnosa(false), 200)}
                    placeholder="Cari nama/kode ICD10..."
                    style={{ ...inputStyle, padding: '5px 12px 5px 38px' }}
                  />
                  {showDropdownDiagnosa && searchPenyakit.length > 0 && (
                    <div
                      onWheel={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        marginTop: 4, maxHeight: 320, overflow: 'auto', overscrollBehavior: 'contain',
                        border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 20,
                      }}
                    >
                      {loadingPenyakit ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Memuat...</div>
                      ) : penyakitOptions.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada hasil pencarian</div>
                      ) : (
                        // Grid pencarian ICD10 PERSIS referensi Khanza Desktop
                        // (screenshot user): Kode|Nama Penyakit|Ciri-ciri
                        // Penyakit|Keterangan|Kategori|Ciri-ciri Umum|VC|AP|
                        // Ast|IM|Urut. Lebar minimum > lebar input supaya
                        // seluruh kolom kebaca, di-scroll horizontal kalau
                        // panel sempit. Baris yg sudah dipilih ditandai teks
                        // merah (bukan background biru lagi), PERSIS pola
                        // highlight "tercentang" di ChecklistBox lain
                        // (ModalInputAwalKeperawatanIGD.tsx).
                        <div style={{ minWidth: 882 }}>
                          <div style={{ display: 'flex', alignItems: 'center', height: 26, boxSizing: 'border-box', background: '#eee', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#111827', position: 'sticky', top: 0, zIndex: 1 }}>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                            <div style={{ width: 70, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                            <div style={{ width: 200, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Nama Penyakit</div>
                            <div style={{ width: 200, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Ciri-ciri Penyakit</div>
                            <div style={{ width: 76, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Keterangan</div>
                            <div style={{ width: 62, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kategori</div>
                            <div style={{ width: 92, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Ciri-ciri Umum</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>VC</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>AP</div>
                            <div style={{ width: 30, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>Ast</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>IM</div>
                            <div style={{ width: 40, padding: '0 6px', textAlign: 'center', flexShrink: 0 }}>Urut</div>
                          </div>
                          {penyakitOptions.map((item, idx) => {
                            const isSelected = selectedDiagnosa.some(d => d.kd_penyakit === item.kd_penyakit);
                            const textColor = isSelected ? '#dc2626' : '#111827';
                            return (
                              <div
                                key={item.kd_penyakit}
                                onClick={() => !isSelected && addDiagnosa(item)}
                                style={{
                                  display: 'flex', alignItems: 'center', height: 26, boxSizing: 'border-box',
                                  cursor: isSelected ? 'default' : 'pointer',
                                  background: isSelected ? '#fef2f2' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                                  borderBottom: idx < penyakitOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f3f4f6'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                              >
                                <div style={{ width: 28, padding: '0 6px', textAlign: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={isSelected} onChange={() => (isSelected ? undefined : addDiagnosa(item))} disabled={isSelected} style={{ cursor: isSelected ? 'default' : 'pointer', width: 13, height: 13 }} />
                                </div>
                                <div style={{ width: 70, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kd_penyakit}</div>
                                <div style={{ width: 200, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_penyakit}</div>
                                <div style={{ width: 200, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ciri_ciri || '-'}</div>
                                <div style={{ width: 76, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keterangan || '-'}</div>
                                <div style={{ width: 62, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kategori || '-'}</div>
                                <div style={{ width: 92, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ciri_umum || '-'}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.validcode}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.accpdx}</div>
                                <div style={{ width: 30, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.asterisk}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.im}</div>
                                <div style={{ width: 40, padding: '0 6px', flexShrink: 0 }}></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabel item terpilih PERSIS di bawah kolom Diagnosa —
                    header "P|Kode|Nama Penyakit|Prioritas", checkbox P
                    selalu tercentang; klik/uncek P = hapus. Pola sama dgn
                    ModalInputLab.tsx/ModalInputRad.tsx/
                    ModalInputTindakan.tsx. */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#eee', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#111827' }}>
                    <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                    <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                    <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid #d1d5db' }}>Nama Penyakit</div>
                    <div style={{ width: 90, padding: '0 8px', textAlign: 'center', flexShrink: 0 }}>Prioritas</div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {selectedDiagnosa.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                        Belum ada diagnosa dipilih
                      </div>
                    ) : selectedDiagnosa.map((item, idx) => (
                      <div
                        key={item.kd_penyakit}
                        onClick={() => setSelectedDiagnosa(prev => prev.filter(d => d.kd_penyakit !== item.kd_penyakit))}
                        style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', cursor: 'pointer', borderBottom: idx < selectedDiagnosa.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                      >
                        <div style={{ width: 28, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked onChange={() => setSelectedDiagnosa(prev => prev.filter(d => d.kd_penyakit !== item.kd_penyakit))} style={{ cursor: 'pointer', width: 14, height: 14 }} title="Hilangkan centang utk menghapus" />
                        </div>
                        <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{item.kd_penyakit}</div>
                        <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827', borderRight: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_penyakit}</div>
                        <div style={{ width: 90, padding: '0 8px', textAlign: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min={1}
                            value={item.prioritas}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setSelectedDiagnosa(prev => prev.map(d => d.kd_penyakit === item.kd_penyakit ? { ...d, prioritas: val } : d));
                            }}
                            title="Urutan prioritas (1=Utama)"
                            style={prioritasInputStyle}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'prosedur' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Prosedur (ICD9)
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
                    value={searchIcd9}
                    onChange={(e) => { setSearchIcd9(e.target.value); setShowDropdownProsedur(true); }}
                    onFocus={() => setShowDropdownProsedur(true)}
                    onBlur={() => setTimeout(() => setShowDropdownProsedur(false), 200)}
                    placeholder="Cari nama/kode ICD9..."
                    style={{ ...inputStyle, padding: '5px 12px 5px 38px' }}
                  />
                  {showDropdownProsedur && searchIcd9.length > 0 && (
                    <div
                      onWheel={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        marginTop: 4, maxHeight: 320, overflow: 'auto', overscrollBehavior: 'contain',
                        border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 20,
                      }}
                    >
                      {loadingIcd9 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Memuat...</div>
                      ) : icd9Options.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada hasil pencarian</div>
                      ) : (
                        // Grid pencarian ICD9 PERSIS referensi Khanza Desktop
                        // (screenshot user): Kode|Deskripsi Panjang|
                        // Deskripsi Pendek|VC|AP|IM|Urut|Jml — pola sama dgn
                        // grid Diagnosa (ICD10) di atas.
                        <div style={{ minWidth: 740 }}>
                          <div style={{ display: 'flex', alignItems: 'center', height: 26, boxSizing: 'border-box', background: '#eee', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#111827', position: 'sticky', top: 0, zIndex: 1 }}>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                            <div style={{ width: 70, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                            <div style={{ width: 300, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Deskripsi Panjang</div>
                            <div style={{ width: 180, padding: '0 6px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Deskripsi Pendek</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>VC</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>AP</div>
                            <div style={{ width: 28, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>IM</div>
                            <div style={{ width: 40, padding: '0 6px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>Urut</div>
                            <div style={{ width: 36, padding: '0 6px', textAlign: 'center', flexShrink: 0 }}>Jml</div>
                          </div>
                          {icd9Options.map((item, idx) => {
                            const isSelected = selectedProsedur.some(p => p.kode === item.kode);
                            const textColor = isSelected ? '#dc2626' : '#111827';
                            return (
                              <div
                                key={item.kode}
                                onClick={() => !isSelected && addProsedur(item)}
                                style={{
                                  display: 'flex', alignItems: 'center', height: 26, boxSizing: 'border-box',
                                  cursor: isSelected ? 'default' : 'pointer',
                                  background: isSelected ? '#fef2f2' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                                  borderBottom: idx < icd9Options.length - 1 ? '1px solid #f3f4f6' : 'none',
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f3f4f6'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                              >
                                <div style={{ width: 28, padding: '0 6px', textAlign: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={isSelected} onChange={() => (isSelected ? undefined : addProsedur(item))} disabled={isSelected} style={{ cursor: isSelected ? 'default' : 'pointer', width: 13, height: 13 }} />
                                </div>
                                <div style={{ width: 70, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kode}</div>
                                <div style={{ width: 300, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deskripsi_panjang}</div>
                                <div style={{ width: 180, padding: '0 6px', fontSize: 12, color: textColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deskripsi_pendek || '-'}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.validcode}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.accpdx}</div>
                                <div style={{ width: 28, padding: '0 6px', fontSize: 12, color: textColor, textAlign: 'center', flexShrink: 0 }}>{item.im}</div>
                                <div style={{ width: 40, padding: '0 6px', flexShrink: 0 }}></div>
                                <div style={{ width: 36, padding: '0 6px', flexShrink: 0 }}></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabel item terpilih PERSIS di bawah kolom Prosedur —
                    header "P|Kode|Deskripsi|Prioritas|Jumlah". */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#eee', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#111827' }}>
                    <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                    <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                    <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid #d1d5db' }}>Deskripsi</div>
                    <div style={{ width: 70, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>Prioritas</div>
                    <div style={{ width: 60, padding: '0 8px', textAlign: 'center', flexShrink: 0 }}>Jumlah</div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {selectedProsedur.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                        Belum ada prosedur dipilih
                      </div>
                    ) : selectedProsedur.map((item, idx) => (
                      <div
                        key={item.kode}
                        onClick={() => setSelectedProsedur(prev => prev.filter(p => p.kode !== item.kode))}
                        style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', cursor: 'pointer', borderBottom: idx < selectedProsedur.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                      >
                        <div style={{ width: 28, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked onChange={() => setSelectedProsedur(prev => prev.filter(p => p.kode !== item.kode))} style={{ cursor: 'pointer', width: 14, height: 14 }} title="Hilangkan centang utk menghapus" />
                        </div>
                        <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{item.kode}</div>
                        <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827', borderRight: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deskripsi_panjang}</div>
                        <div style={{ width: 70, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min={1}
                            value={item.prioritas}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setSelectedProsedur(prev => prev.map(p => p.kode === item.kode ? { ...p, prioritas: val } : p));
                            }}
                            style={prioritasInputStyle}
                          />
                        </div>
                        <div style={{ width: 60, padding: '0 8px', textAlign: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={item.jumlah}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedProsedur(prev => prev.map(p => p.kode === item.kode ? { ...p, jumlah: val } : p));
                            }}
                            style={prioritasInputStyle}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
              {loadingSubmit ? 'Menyimpan...' : 'Simpan Diagnosa & Prosedur'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
