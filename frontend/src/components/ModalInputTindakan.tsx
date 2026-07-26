import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentUserNip } from '../utils/currentUser';
import { ModalCariPetugas } from './ModalCariPetugas';

type ModalInputTindakanProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

// Penanganan — padanan 3 kategori tindakan yang sudah dipakai di sisi
// baca (Riwayat Perawatan, lihat renderTindakanSub di PermintaanResep.tsx
// dan getTindakanRanap di rad_handler.go): Dokter (rawat_jl_dr), Petugas
// (rawat_jl_pr), Dokter & Petugas (rawat_jl_drpr). Sebelum ini, modal
// input cuma bisa nyimpen ke rawat_jl_dr — dua tabel lain sudah dibaca
// tapi tidak pernah bisa diisi dari modal manapun.
type Penanganan = 'dokter' | 'petugas' | 'keduanya';

export const ModalInputTindakan: React.FC<ModalInputTindakanProps> = ({ patient, onClose, onSaved }) => {
  const [activePenanganan, setActivePenanganan] = React.useState<Penanganan>('dokter');

  const [searchTindakan, setSearchTindakan] = React.useState('');
  const [jenisTindakanList, setJenisTindakanList] = React.useState<any[]>([]);
  const [selectedTindakan, setSelectedTindakan] = React.useState<string[]>([]);
  const [selectedTindakanData, setSelectedTindakanData] = React.useState<any[]>([]);
  const [loadingTindakan, setLoadingTindakan] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // Petugas — cuma relevan utk tab Petugas/Dokter & Petugas. Prefill dari
  // NIP akun yang login (getCurrentUserNip, lihat utils/currentUser.ts),
  // tetap bisa diganti manual lewat ModalCariPetugas kalau petugas yang
  // menangani beda dari yang login.
  const [selectedPetugas, setSelectedPetugas] = React.useState<{ nip: string; nama: string } | null>(null);
  const [showCariPetugas, setShowCariPetugas] = React.useState(false);

  React.useEffect(() => {
    const nip = getCurrentUserNip();
    if (!nip) return;
    fetch(`/api/petugas?search=${encodeURIComponent(nip)}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data: { nip: string; nama: string }[]) => {
        const match = Array.isArray(data) ? data.find(p => p.nip === nip) : undefined;
        if (match) setSelectedPetugas(match);
      })
      .catch(() => { /* silent */ });
  }, []);

  // Panel daftar tindakan inline, selalu terlihat — dimuat begitu modal
  // dibuka (query kosong -> backend balikin 50 baris awal), lalu
  // difilter ulang (debounce) tiap kali user mengetik, padanan
  // ModalInputDiagnosa.tsx (bukan dropdown portal yang butuh min. 2
  // karakter & fokus).
  const fetchJenisTindakan = React.useCallback((q: string) => {
    setLoadingTindakan(true);
    const params = new URLSearchParams({ search: q });
    if (patient.kd_pj) params.append('kd_pj', patient.kd_pj);
    fetch(`/api/tindakan/jenis-perawatan?${params}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data) => setJenisTindakanList(Array.isArray(data) ? data : []))
      .catch(() => setJenisTindakanList([]))
      .finally(() => setLoadingTindakan(false));
  }, [patient.kd_pj]);

  React.useEffect(() => {
    fetchJenisTindakan('');
  }, [fetchJenisTindakan]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchJenisTindakan(searchTindakan.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTindakan, fetchJenisTindakan]);

  const toggleTindakan = (kdJenisPrw: string) => {
    setSelectedTindakan(prev => {
      if (prev.includes(kdJenisPrw)) {
        setSelectedTindakanData(d => d.filter(i => i.kd_jenis_prw !== kdJenisPrw));
        return prev.filter(k => k !== kdJenisPrw);
      } else {
        const itemData = jenisTindakanList.find(i => i.kd_jenis_prw === kdJenisPrw);
        if (itemData) {
          setSelectedTindakanData(d => d.some(i => i.kd_jenis_prw === kdJenisPrw) ? d : [...d, itemData]);
        }
        return [...prev, kdJenisPrw];
      }
    });
  };

  const getTarifTampil = (item: any) => {
    const tarifDr = item.total_byrdr || 0;
    const tarifPr = item.tarif_tindakanpr || 0;
    if (activePenanganan === 'dokter') return tarifDr;
    if (activePenanganan === 'petugas') return tarifPr;
    return tarifDr + tarifPr;
  };

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getDateTime = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      tgl: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      jam: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  };

  const handleSubmit = async () => {
    if (selectedTindakan.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih minimal satu jenis tindakan terlebih dahulu!' });
      return;
    }
    if (activePenanganan !== 'dokter' && !selectedPetugas) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih petugas terlebih dahulu!' });
      return;
    }
    setLoadingSubmit(true);
    try {
      const { tgl, jam } = getDateTime();
      let successCount = 0;
      let errorCount = 0;

      const endpoint =
        activePenanganan === 'dokter' ? '/api/tindakan/simpan' :
        activePenanganan === 'petugas' ? '/api/tindakan/simpan-petugas' :
        '/api/tindakan/simpan-drpr';

      for (const item of selectedTindakanData) {
        if (!item) continue;
        const tarifDr = item.total_byrdr || 0;
        const tarifPr = item.tarif_tindakanpr || 0;
        let payload: Record<string, unknown>;
        if (activePenanganan === 'dokter') {
          payload = {
            no_rawat: patient.no_rawat,
            kd_jenis_prw: item.kd_jenis_prw,
            kd_dokter: patient.kd_dokter || '',
            tgl_perawatan: tgl,
            jam_rawat: jam,
            material: item.material || 0,
            bhp: item.bhp || 0,
            tarif_tindakandr: tarifDr,
            kso: item.kso || 0,
            menejemen: item.menejemen || 0,
            biaya_rawat: tarifDr,
          };
        } else if (activePenanganan === 'petugas') {
          payload = {
            no_rawat: patient.no_rawat,
            kd_jenis_prw: item.kd_jenis_prw,
            nip: selectedPetugas!.nip,
            tgl_perawatan: tgl,
            jam_rawat: jam,
            material: item.material || 0,
            bhp: item.bhp || 0,
            tarif_tindakanpr: tarifPr,
            kso: item.kso || 0,
            menejemen: item.menejemen || 0,
            biaya_rawat: tarifPr,
          };
        } else {
          // keduanya (rawat_jl_drpr) — biaya_rawat = jumlah dr + pr,
          // penyederhanaan yang disengaja karena belum ada modul
          // Keuangan yang memisahkan alokasi biaya per pihak.
          payload = {
            no_rawat: patient.no_rawat,
            kd_jenis_prw: item.kd_jenis_prw,
            kd_dokter: patient.kd_dokter || '',
            nip: selectedPetugas!.nip,
            tgl_perawatan: tgl,
            jam_rawat: jam,
            material: item.material || 0,
            bhp: item.bhp || 0,
            tarif_tindakandr: tarifDr,
            tarif_tindakanpr: tarifPr,
            kso: item.kso || 0,
            menejemen: item.menejemen || 0,
            biaya_rawat: tarifDr + tarifPr,
          };
        }
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) successCount++; else errorCount++;
        } catch { errorCount++; }
      }

      if (successCount > 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: `${successCount} tindakan berhasil disimpan${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
          timer: 2000,
          showConfirmButton: false,
        });
        onSaved();
        onClose();
      } else {
        throw new Error('Gagal menyimpan semua tindakan');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan saat menyimpan tindakan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleReset = () => {
    setSelectedTindakan([]);
    setSelectedTindakanData([]);
    setSearchTindakan('');
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
            maxWidth: 1000, width: '60%', maxHeight: '90vh',
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Input Tindakan Rawat Jalan
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
            background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: '12px',
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>

            {/* Tab Penanganan — sama pola pill-switch dgn ModalInputLab.tsx
                (display:inline-flex + alignSelf:center supaya lebar
                background cuma seukuran nama tab, bukan selebar card). */}
            <div style={{ display: 'inline-flex', alignSelf: 'center', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 16, flexShrink: 0 }}>
              {([
                { key: 'dokter', label: 'Penanganan Dokter' },
                { key: 'petugas', label: 'Penanganan Petugas' },
                { key: 'keduanya', label: 'Penanganan Dokter & Petugas' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActivePenanganan(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: activePenanganan === t.key ? '1px solid #d1d5db' : 'none',
                    background: activePenanganan === t.key ? '#ffffff' : 'transparent',
                    color: activePenanganan === t.key ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: activePenanganan === t.key ? 500 : 400,
                    transition: 'all 0.2s ease',
                    boxShadow: activePenanganan === t.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Petugas — hanya utk tab Petugas/Dokter & Petugas. Kolom
                diklik -> buka ModalCariPetugas (padanan pola
                adimePetugasOpen di PemeriksaanRanap.tsx) alih-alih
                dropdown pencarian inline. */}
            {activePenanganan !== 'dokter' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Petugas <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {selectedPetugas ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '1px solid #1AB1E5', background: '#f0f9ff', borderRadius: 8,
                    padding: '8px 12px', fontSize: 13,
                  }}>
                    <span>{selectedPetugas.nip} - <strong>{selectedPetugas.nama}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowCariPetugas(true)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                    >Ganti</button>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowCariPetugas(true)}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      fontSize: 13, boxSizing: 'border-box', cursor: 'pointer',
                      color: '#9ca3af', background: '#ffffff',
                    }}
                  >
                    Klik untuk pilih petugas...
                  </div>
                )}
              </div>
            )}

            {/* Search + Selected Items — panel inline selalu terlihat,
                daftar dimuat begitu modal dibuka lalu difilter ulang
                (debounce) tiap kali user mengetik; item terpilih
                ditampilkan di bawah panel pencarian (bukan di samping),
                padanan ModalInputDiagnosa.tsx / ModalInputRad.tsx. */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                Cari Tindakan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchTindakan}
                  onChange={(e) => setSearchTindakan(e.target.value)}
                  placeholder="Cari nama/kode tindakan..."
                  style={{
                    width: '100%', padding: '10px 12px 10px 38px',
                    border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 13, boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                  onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{
                marginTop: 8, maxHeight: 220, overflowY: 'auto',
                border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
              }}>
                {loadingTindakan ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
                ) : jenisTindakanList.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada hasil</div>
                ) : jenisTindakanList.map((item, idx) => (
                  <label
                    key={item.kd_jenis_prw}
                    style={{
                      padding: '2px 12px',
                      background: selectedTindakan.includes(item.kd_jenis_prw) ? '#e0f2fe' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                      borderBottom: idx < jenisTindakanList.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTindakan.includes(item.kd_jenis_prw)}
                      onChange={() => toggleTindakan(item.kd_jenis_prw)}
                      style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_perawatan}</span>
                      <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.kd_jenis_prw} • {formatRupiah(getTarifTampil(item))}</span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Item Terpilih — kartu per item di bawah panel pencarian,
                  padanan selectedDiagnosa/selectedProsedur di
                  ModalInputDiagnosa.tsx (background biru muda, border
                  #1AB1E5, tombol hapus ikon X). */}
              {selectedTindakanData.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Item Terpilih ({selectedTindakan.length})</span>
                    <button
                      onClick={() => { setSelectedTindakan([]); setSelectedTindakanData([]); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: '2px 8px' }}
                    >Hapus Semua</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedTindakanData.map((item) => (
                      <div
                        key={item.kd_jenis_prw}
                        style={{ background: '#f0f9ff', border: '1px solid #1AB1E5', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_perawatan}</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{formatRupiah(getTarifTampil(item))}</div>
                        </div>
                        <button
                          onClick={() => toggleTindakan(item.kd_jenis_prw)}
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
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
              >{loadingSubmit ? 'Menyimpan...' : 'Simpan Tindakan'}</button>
            </div>
          </div>
        </div>
      </div>

      <ModalCariPetugas
        isOpen={showCariPetugas}
        onClose={() => setShowCariPetugas(false)}
        onSelect={(nip, nama) => setSelectedPetugas({ nip, nama })}
      />
    </>
  );
};
