import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentUserNip } from '../utils/currentUser';
import { ModalCariPetugas } from './ModalCariPetugas';

type ModalInputTindakanProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
  // isRanap menentukan seluruh jalur data: pencarian jenis tindakan (tarif
  // rawat inap dari jns_perawatan_inap, bukan jns_perawatan) dan endpoint
  // simpan (rawat_inap_dr/pr/drpr, bukan rawat_jl_dr/pr/drpr). Tanpa flag
  // ini, tindakan yang diinput dari layar Rawat Inap akan selalu salah
  // tersimpan ke tabel rawat jalan.
  isRanap?: boolean;
};

// Penanganan — padanan 3 kategori tindakan yang sudah dipakai di sisi
// baca (Riwayat Perawatan, lihat renderTindakanSub di PermintaanResep.tsx
// dan getTindakanRanap di rad_handler.go): Dokter (rawat_jl_dr), Petugas
// (rawat_jl_pr), Dokter & Petugas (rawat_jl_drpr). Sebelum ini, modal
// input cuma bisa nyimpen ke rawat_jl_dr — dua tabel lain sudah dibaca
// tapi tidak pernah bisa diisi dari modal manapun.
type Penanganan = 'dokter' | 'petugas' | 'keduanya';

export const ModalInputTindakan: React.FC<ModalInputTindakanProps> = ({ patient, onClose, onSaved, isRanap }) => {
  // Redesain jadi panel slide-in dari kanan, PERSIS pola ModalInputLab.tsx/
  // ModalInputRad.tsx/ModalInputTriase.tsx (overlay fixed + panel anchor
  // kanan full-height, header breadcrumb pasien + tombol close bulat, body
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

  const [activePenanganan, setActivePenanganan] = React.useState<Penanganan>('dokter');

  const [searchTindakan, setSearchTindakan] = React.useState('');
  const [jenisTindakanList, setJenisTindakanList] = React.useState<any[]>([]);
  const [selectedTindakan, setSelectedTindakan] = React.useState<string[]>([]);
  const [selectedTindakanData, setSelectedTindakanData] = React.useState<any[]>([]);
  const [loadingTindakan, setLoadingTindakan] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

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

  // Panel daftar tindakan — dimuat begitu modal dibuka (query kosong ->
  // backend balikin 50 baris awal), lalu difilter ulang (debounce) tiap
  // kali user mengetik, padanan ModalInputLab.tsx/ModalInputRad.tsx.
  const fetchJenisTindakan = React.useCallback((q: string) => {
    setLoadingTindakan(true);
    const params = new URLSearchParams({ search: q });
    let endpoint = '/api/tindakan/jenis-perawatan';
    if (isRanap) {
      // GetJenisTindakanRanap resolve kd_pj/kd_bangsal/kelas sendiri dari
      // no_rawat (kamar_inap aktif terbaru) — tidak butuh kd_pj/kd_poli
      // dari frontend spt jalur ralan di bawah.
      endpoint = '/api/tindakan/jenis-perawatan-ranap';
      if (patient.no_rawat) params.append('no_rawat', patient.no_rawat);
    } else if (patient.kd_pj) {
      params.append('kd_pj', patient.kd_pj);
    }
    fetch(`${endpoint}?${params}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data) => setJenisTindakanList(Array.isArray(data) ? data : []))
      .catch(() => setJenisTindakanList([]))
      .finally(() => setLoadingTindakan(false));
  }, [patient.kd_pj, patient.no_rawat, isRanap]);

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

      const basePath = isRanap ? '/api/tindakan-ranap' : '/api/tindakan';
      const endpoint =
        activePenanganan === 'dokter' ? `${basePath}/simpan` :
        activePenanganan === 'petugas' ? `${basePath}/simpan-petugas` :
        `${basePath}/simpan-drpr`;

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
        handleClose();
      } else {
        throw new Error('Gagal menyimpan semua tindakan');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan saat menyimpan tindakan' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Tinggi 30px PERSIS .form-control di ResepModal.css (sama dgn
  // ModalInputLab.tsx/ModalInputRad.tsx) — bukan lagi padding 10px 12px
  // tanpa height eksplisit.
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

  return (
    <>
      {/* Redesain jadi panel slide-in dari kanan, PERSIS pola
          ModalInputLab.tsx/ModalInputRad.tsx/ModalInputTriase.tsx/
          ResepModal.tsx. */}
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
            {/* Tab Penanganan — button group flat (radius 0, tombol
                nempel/berbagi border, aktif biru cyan #1AB1E5), PERSIS
                pola ResepModal.tsx/ModalInputLab.tsx — ganti dari pill
                segmented control lama. */}
            <div style={{ display: 'inline-flex', marginBottom: 16, flexShrink: 0 }}>
              {([
                { key: 'dokter', label: 'Penanganan Dokter' },
                { key: 'petugas', label: 'Penanganan Petugas' },
                { key: 'keduanya', label: 'Dokter & Petugas' },
              ] as const).map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActivePenanganan(t.key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 0,
                    border: '1px solid #1AB1E5',
                    borderLeft: i === 0 ? '1px solid #1AB1E5' : 'none',
                    background: activePenanganan === t.key ? '#1AB1E5' : '#ffffff',
                    color: activePenanganan === t.key ? '#ffffff' : '#1AB1E5',
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

            {/* Petugas — hanya utk tab Petugas/Dokter & Petugas. Kolom
                diklik -> buka ModalCariPetugas (padanan pola
                adimePetugasOpen di PemeriksaanRanap.tsx) alih-alih
                dropdown pencarian inline. */}
            {activePenanganan !== 'dokter' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                  Petugas <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {selectedPetugas ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '1px solid #1AB1E5', background: '#f0f9ff', borderRadius: 4,
                    padding: '5px 12px', fontSize: 12, height: 30, boxSizing: 'border-box',
                  }}>
                    <span>{selectedPetugas.nip} - {selectedPetugas.nama}</span>
                    <button
                      type="button"
                      onClick={() => setShowCariPetugas(true)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}
                    >Ganti</button>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowCariPetugas(true)}
                    style={{ ...inputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    Klik untuk pilih petugas...
                  </div>
                )}
              </div>
            )}

            {/* Search + Dropdown — full width sendirian, PERSIS
                ModalInputLab.tsx/ModalInputRad.tsx. */}
            <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
              Cari Tindakan{selectedTindakan.length > 0 && ` (${selectedTindakan.length} dipilih)`} <span style={{ color: '#ef4444' }}>*</span>
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
                value={searchTindakan}
                onChange={(e) => { setSearchTindakan(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Cari nama/kode tindakan..."
                style={{ ...inputStyle, padding: '5px 12px 5px 38px' }}
              />
              {showDropdown && searchTindakan.length > 0 && (
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
                  {loadingTindakan ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                      <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                  ) : jenisTindakanList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada hasil pencarian</div>
                  ) : jenisTindakanList.map((item, idx) => (
                    <label
                      key={item.kd_jenis_prw}
                      style={{
                        padding: '2px 12px',
                        background: selectedTindakan.includes(item.kd_jenis_prw) ? '#e0f2fe' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                        borderBottom: idx < jenisTindakanList.length - 1 ? '1px solid #f3f4f6' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={(e) => { if (!selectedTindakan.includes(item.kd_jenis_prw)) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTindakan.includes(item.kd_jenis_prw)}
                        onChange={() => toggleTindakan(item.kd_jenis_prw)}
                        style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_perawatan}</span>
                        <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.kd_jenis_prw} • {formatRupiah(getTarifTampil(item))}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel item terpilih PERSIS di bawah kolom Cari Tindakan —
                header "P|Kode|Nama Tindakan|Tarif", checkbox P selalu
                tercentang (baris ini memang yg sudah dipilih); klik/uncek
                P = hapus dari daftar terpilih. Pola sama dgn
                ModalInputLab.tsx/ModalInputRad.tsx. */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
                <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid #d1d5db' }}>Nama Tindakan</div>
                <div style={{ width: 110, padding: '0 8px', textAlign: 'right' }}>Tarif</div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {selectedTindakanData.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    Belum ada tindakan dipilih
                  </div>
                ) : selectedTindakanData.map((item, idx) => (
                  <div
                    key={item.kd_jenis_prw}
                    onClick={() => toggleTindakan(item.kd_jenis_prw)}
                    style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', cursor: 'pointer', borderBottom: idx < selectedTindakanData.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  >
                    <div style={{ width: 28, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked onChange={() => toggleTindakan(item.kd_jenis_prw)} style={{ cursor: 'pointer', width: 14, height: 14 }} title="Hilangkan centang utk menghapus" />
                    </div>
                    <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{item.kd_jenis_prw}</div>
                    <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827', borderRight: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nm_perawatan}</div>
                    <div style={{ width: 110, padding: '0 8px', fontSize: 12, color: '#111827', textAlign: 'right', flexShrink: 0 }}>{formatRupiah(getTarifTampil(item))}</div>
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
              {loadingSubmit ? 'Menyimpan...' : 'Simpan Tindakan'}
            </button>
          </div>
        </div>
      </div>

      <ModalCariPetugas
        isOpen={showCariPetugas}
        onClose={() => setShowCariPetugas(false)}
        onSelect={(nip, nama) => setSelectedPetugas({ nip, nama })}
      />

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
