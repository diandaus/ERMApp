import React from 'react';
import Swal from 'sweetalert2';

type ModalInputLabProps = {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputLab: React.FC<ModalInputLabProps> = ({ patient, onClose, onSaved }) => {
  // Redesain jadi panel slide-in dari kanan, PERSIS pola ModalInputTriase.tsx/
  // ResepModal.tsx (overlay fixed + panel anchor kanan full-height, header
  // breadcrumb pasien + tombol close bulat, body scrollable, footer sticky) —
  // ganti dari versi lama (dialog card mengambang di tengah, radius 20/16).
  // Komponen ini TIDAK menerima prop `isOpen` (parent langsung mount/unmount
  // <ModalInputLab/> saat buka/tutup), jadi animasi masuk dipicu sendiri lewat
  // effect on-mount, dan `handleClose` menunda pemanggilan `onClose` asli
  // sampai animasi keluar (translateX/opacity) selesai.
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const [activeLabTab, setActiveLabTab] = React.useState<'pk' | 'pa'>('pk');

  const [labForm, setLabForm] = React.useState({
    diagnosa_klinis: '',
    informasi_tambahan: ''
  });

  const [searchPK, setSearchPK] = React.useState('');
  const [pemeriksaanPKList, setPemeriksaanPKList] = React.useState<any[]>([]);
  const [selectedPemeriksaanPK, setSelectedPemeriksaanPK] = React.useState<string[]>([]);
  const [loadingPK, setLoadingPK] = React.useState(false);

  // Detail Pemeriksaan (PK saja — padanan tbDetailPK/tampil() di
  // DlgPermintaanLaboratorium.java, PA tidak punya konsep template detail
  // di Java maupun backend Go). Daftar parameter (template_laboratorium)
  // digabung dari SEMUA pemeriksaan yang sedang dicentang, dimuat ulang
  // tiap kali selectedPemeriksaanPK berubah — persis pola Java (checkbox
  // detail yang sudah dicentang dipertahankan lewat filter di bawah,
  // bukan direset penuh tiap toggle panel).
  const [detailPKList, setDetailPKList] = React.useState<any[]>([]);
  const [selectedDetailPK, setSelectedDetailPK] = React.useState<string[]>([]);
  const [loadingDetailPK, setLoadingDetailPK] = React.useState(false);
  const [searchDetailPK, setSearchDetailPK] = React.useState('');

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

  // Muat ulang Detail Pemeriksaan (template_laboratorium) tiap kali daftar
  // pemeriksaan PK yang dicentang berubah — gabungan (union) parameter dari
  // SEMUA panel yang sedang dicentang, padanan tampil() di Java yang
  // dipanggil ulang tiap klik baris tbTarifPK. Parameter yang BARU muncul
  // (pemeriksaan baru dicentang) otomatis tercentang semua by default —
  // dokter biasanya memang mau semua parameternya, tinggal uncek yang tidak
  // perlu. Parameter yang SUDAH pernah muncul sebelumnya (baik masih
  // tercentang maupun sudah sengaja di-uncek manual) dipertahankan apa
  // adanya, dilacak lewat prevDetailIdsRef supaya uncek manual tidak
  // ke-reset tiap kali daftar pemeriksaan berubah.
  const prevDetailIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (activeLabTab !== 'pk') return;
    if (selectedPemeriksaanPK.length === 0) {
      setDetailPKList([]);
      setSelectedDetailPK([]);
      prevDetailIdsRef.current = new Set();
      return;
    }
    let cancelled = false;
    setLoadingDetailPK(true);
    Promise.all(
      selectedPemeriksaanPK.map((kd) =>
        fetch(`/api/lab/template?kd_jenis_prw=${encodeURIComponent(kd)}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    )
      .then((results) => {
        if (cancelled) return;
        const merged = results.flat().filter(Boolean);
        setDetailPKList(merged);
        const mergedIds: string[] = merged.map((t: any) => t.id_template);
        const mergedIdSet = new Set(mergedIds);
        const newlyAppeared = mergedIds.filter((id) => !prevDetailIdsRef.current.has(id));
        setSelectedDetailPK((prev) => {
          const kept = prev.filter((id) => mergedIdSet.has(id));
          return Array.from(new Set([...kept, ...newlyAppeared]));
        });
        prevDetailIdsRef.current = mergedIdSet;
      })
      .finally(() => {
        if (!cancelled) setLoadingDetailPK(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPemeriksaanPK, activeLabTab]);

  const toggleDetailPK = (id: string) => setSelectedDetailPK((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Gabung 4 kolom nilai rujukan (LD/LA/PD/PA — Laki Dewasa/Laki Anak/
  // Perempuan Dewasa/Perempuan Anak) jadi satu string tampilan, padanan
  // persis format yang dirakit client-side di Java (tampil()).
  const formatNilaiRujukan = (t: any): string => {
    const parts: string[] = [];
    if (t.nilai_rujukan_ld) parts.push(`LD : ${t.nilai_rujukan_ld}`);
    if (t.nilai_rujukan_la) parts.push(`LA : ${t.nilai_rujukan_la}`);
    if (t.nilai_rujukan_pd) parts.push(`PD : ${t.nilai_rujukan_pd}`);
    if (t.nilai_rujukan_pa) parts.push(`PA : ${t.nilai_rujukan_pa}`);
    return parts.length ? parts.join(', ') : '-';
  };

  const filteredDetailPK = searchDetailPK.trim()
    ? detailPKList.filter((t) => (t.pemeriksaan || '').toLowerCase().includes(searchDetailPK.trim().toLowerCase()))
    : detailPKList;

  // Kelompokkan Detail Pemeriksaan per pemeriksaan induk (kd_jenis_prw) —
  // tiap kelompok dapat baris header (nama pemeriksaan) dengan checkbox
  // sendiri untuk mencentang/membatalkan SEMUA detail di bawahnya
  // sekaligus. Urutan kelompok mengikuti urutan kemunculan pertama di
  // filteredDetailPK (yang sendiri mengikuti urutan selectedPemeriksaanPK).
  const groupedDetailPK = React.useMemo(() => {
    const groups: { kd_jenis_prw: string; items: any[] }[] = [];
    const idxByKd: Record<string, number> = {};
    filteredDetailPK.forEach((t) => {
      const kd = t.kd_jenis_prw;
      if (!(kd in idxByKd)) {
        idxByKd[kd] = groups.length;
        groups.push({ kd_jenis_prw: kd, items: [] });
      }
      groups[idxByKd[kd]].items.push(t);
    });
    return groups;
  }, [filteredDetailPK]);

  const toggleGroupDetailPK = (items: any[]) => {
    const ids = items.map((t) => t.id_template);
    const allSelected = ids.every((id) => selectedDetailPK.includes(id));
    setSelectedDetailPK((prev) => (allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
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
        detail_pemeriksaan: selectedDetailPK,
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
        timer: 2000,
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
        timer: 2000,
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

  // Tinggi 30px PERSIS .form-control di ResepModal.css (bukan 26px spt
  // ModalInputAwalKeperawatanIGD.tsx lagi) — per permintaan user terbaru.
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
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 4,
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
    toggle: (kd: string) => void
  ) => (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* onScroll menutup dropdown pencarian — dulu kalau container ini
          di-scroll (baik langsung, atau lewat "scroll chaining" waktu
          list hasil pencarian sudah mentok scroll-nya), input & label
          "Nama Pemeriksaan" ikut tergulung ke atas sementara dropdown-nya
          (position:absolute, nempel ke input) rendernya jadi terpotong
          separuh & kelihatan "lepas" dari inputnya. Menutup dropdown saat
          scroll menghindari kondisi visual rusak itu; user tinggal fokus
          lagi ke input utk membuka dropdown & lanjut cari. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} onScroll={() => setShowDropdown(false)}>
      <div>
        {/* Search + Dropdown — kolom "Item Dipilih" di sebelahnya sudah
            dihapus per permintaan user, jadi search ini sekarang full
            width sendirian (bukan grid 2 kolom lagi). */}
        <div>
        <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
            Nama Pemeriksaan{selected.length > 0 && ` (${selected.length} dipilih)`}
          </label>
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
              style={{ ...inputStyle, padding: '5px 12px 5px 38px' }}
            />
            {showDropdown && search.length > 0 && (
              <div
                onWheel={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  marginTop: 4, maxHeight: 460, overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  border: '1px solid #e5e7eb', borderRadius: 8,
                  background: '#ffffff',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  zIndex: 20
                }}
              >
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                    <div style={{
                      display: 'inline-block', width: 20, height: 20,
                      border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5',
                      borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                ) : list.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
                    Tidak ada hasil pencarian
                  </div>
                ) : list.map((item, idx) => (
                  <label
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '2px 12px',
                      background: selected.includes(item.kd_jenis_prw) ? '#e0f2fe' : idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                      borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = idx % 2 === 0 ? '#f9fafb' : '#ffffff'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.kd_jenis_prw)}
                      onChange={() => toggle(item.kd_jenis_prw)}
                      style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ width: 90, flexShrink: 0, fontSize: 12, fontWeight: 400, color: '#111827' }}>{item.kd_jenis_prw}</div>
                    <div style={{ flex: 1, fontSize: 12, color: '#111827' }}>{item.nm_perawatan}</div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tabel item terpilih PERSIS di bawah kolom Nama Pemeriksaan
              (gantinya "Item Dipilih" yg dulu jadi kolom terpisah di
              samping) — header "P|Kode Periksa|Nama Pemeriksaan", checkbox
              P selalu tercentang (karena baris ini memang yg sudah
              dipilih); klik/uncek P = hapus dari daftar terpilih. Pola
              sama dgn ChecklistBox di ModalInputAwalKeperawatanIGD.tsx. */}
          <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
              <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
              <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode Periksa</div>
              <div style={{ flex: 1, padding: '0 8px' }}>Nama Pemeriksaan</div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {selected.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  Belum ada pemeriksaan dipilih
                </div>
              ) : selected.map((kd, idx) => {
                const item = list.find((p) => p.kd_jenis_prw === kd);
                return (
                  <div
                    key={kd}
                    onClick={() => toggle(kd)}
                    style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', cursor: 'pointer', borderBottom: idx < selected.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  >
                    <div style={{ width: 28, padding: '0 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked onChange={() => toggle(kd)} style={{ cursor: 'pointer', width: 14, height: 14 }} title="Hilangkan centang utk menghapus" />
                    </div>
                    <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{kd}</div>
                    <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827' }}>{item?.nm_perawatan || kd}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Pemeriksaan — padanan tbDetailPK di
          DlgPermintaanLaboratorium.java. Cuma untuk PK (PA tidak punya
          konsep template detail, baik di Java maupun backend Go).
          Menampilkan gabungan parameter (template_laboratorium) dari
          SEMUA pemeriksaan yang sedang dicentang di atas; tiap parameter
          punya checkbox sendiri yang dikirim sebagai detail_pemeriksaan
          saat submit (padanan permintaan_detail_permintaan_lab). */}
      {type === 'pk' && (
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
            Detail Pemeriksaan{selectedDetailPK.length > 0 && ` (${selectedDetailPK.length} dipilih)`}
          </label>
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
              value={searchDetailPK}
              onChange={(e) => setSearchDetailPK(e.target.value)}
              placeholder="Cari detail pemeriksaan..."
              disabled={selectedPemeriksaanPK.length === 0}
              style={{ ...inputStyle, padding: '5px 12px 5px 38px', background: selectedPemeriksaanPK.length === 0 ? '#f9fafb' : '#ffffff' }}
            />
          </div>

          {selectedPemeriksaanPK.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              Pilih pemeriksaan di atas dulu untuk melihat detail parameternya
            </div>
          ) : loadingDetailPK ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>
              <div style={{
                display: 'inline-block', width: 20, height: 20,
                border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5',
                borderRadius: '50%', animation: 'spin 1s linear infinite'
              }}></div>
            </div>
          ) : filteredDetailPK.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              Tidak ada detail parameter untuk pemeriksaan yang dipilih
            </div>
          ) : (
            // Desain tabel PERSIS tabel "item terpilih" di atas (flex-div
            // per baris, header bg #f3f4f6, garis pemisah antar kolom
            // borderRight, tinggi header & baris seragam) — ganti dari
            // <table> HTML lama, per permintaan user.
            <div style={{ border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 380, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151', position: 'sticky', top: 0, zIndex: 1 }}>
                <div style={{ width: 28, padding: '0 8px', borderRight: '1px solid #d1d5db', textAlign: 'center', flexShrink: 0 }}>P</div>
                <div style={{ flex: 1, padding: '0 8px', borderRight: '1px solid #d1d5db' }}>Pemeriksaan</div>
                <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Satuan</div>
                <div style={{ flex: 1, padding: '0 8px' }}>Nilai Rujukan</div>
              </div>
              <div>
                {groupedDetailPK.map((g) => {
                  const groupIds = g.items.map((t) => t.id_template);
                  const allSelected = groupIds.every((id) => selectedDetailPK.includes(id));
                  const namaPemeriksaan = list.find((p) => p.kd_jenis_prw === g.kd_jenis_prw)?.nm_perawatan || g.kd_jenis_prw;
                  return (
                    <React.Fragment key={g.kd_jenis_prw}>
                      <div
                        onClick={() => toggleGroupDetailPK(g.items)}
                        style={{ display: 'flex', alignItems: 'center', minHeight: 28, boxSizing: 'border-box', background: '#f9fafb', borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                      >
                        <div style={{ width: 28, padding: '4px 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleGroupDetailPK(g.items)}
                            style={{ cursor: 'pointer', width: 14, height: 14 }}
                            title="Centang semua detail pemeriksaan ini"
                          />
                        </div>
                        <div style={{ flex: 1, padding: '4px 8px', fontSize: 12, color: '#111827' }}>{namaPemeriksaan}</div>
                      </div>
                      {g.items.map((t) => (
                        <div
                          key={t.id_template}
                          onClick={() => toggleDetailPK(t.id_template)}
                          style={{ display: 'flex', alignItems: 'center', minHeight: 28, boxSizing: 'border-box', borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 28, padding: '4px 8px', textAlign: 'center', flexShrink: 0, borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedDetailPK.includes(t.id_template)}
                              onChange={() => toggleDetailPK(t.id_template)}
                              style={{ cursor: 'pointer', width: 14, height: 14 }}
                            />
                          </div>
                          <div style={{ flex: 1, padding: '4px 8px 4px 26px', fontSize: 12, color: '#111827', borderRight: '1px solid #f3f4f6' }}>{t.pemeriksaan}</div>
                          <div style={{ width: 90, padding: '4px 8px', fontSize: 12, color: '#374151', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{t.satuan || '-'}</div>
                          <div style={{ flex: 1, padding: '4px 8px', fontSize: 12, color: '#6b7280' }}>{formatNilaiRujukan(t)}</div>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );

  return (
    <>
      {/* Redesain jadi panel slide-in dari kanan, PERSIS pola
          ModalInputTriase.tsx/ResepModal.tsx (overlay fixed + panel anchor
          kanan full-height, header breadcrumb pasien + tombol close bulat,
          body scrollable, footer sticky) — ganti dari versi lama (dialog
          card mengambang di tengah, radius 20/16). */}
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

          {/* Body — scrollable, flat (tanpa nested white-card-dlm-card spt
              versi lama). */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Tab PK/PA — button group flat (radius 0, tombol nempel/
                berbagi border, aktif biru cyan #1AB1E5), PERSIS pola
                ResepModal.tsx (Non Racikan/Racikan) — ganti dari pill
                segmented control lama. */}
            <div style={{ display: 'inline-flex', marginBottom: 16, flexShrink: 0 }}>
              {(['pk', 'pa'] as const).map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveLabTab(tab)}
                  style={{
                    padding: '6px 20px',
                    borderRadius: 0,
                    border: '1px solid #1AB1E5',
                    borderLeft: i === 0 ? '1px solid #1AB1E5' : 'none',
                    background: activeLabTab === tab ? '#1AB1E5' : '#ffffff',
                    color: activeLabTab === tab ? '#ffffff' : '#1AB1E5',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 400,
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab === 'pk' ? 'Lab PK (Patologi Klinik)' : 'Lab PA (Patologi Anatomi)'}
                </button>
              ))}
            </div>

            {/* Diagnosa Klinis & Informasi Tambahan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
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
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
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
                <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
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
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
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
              pemeriksaanPKList, loadingPK, selectedPemeriksaanPK, togglePK
            )}
            {activeLabTab === 'pa' && renderPemeriksaanDropdown(
              'pa', searchPA, setSearchPA, showDropdownPA, setShowDropdownPA,
              pemeriksaanPAList, loadingPA, selectedPemeriksaanPA, togglePA
            )}
          </div>

          {/* Footer — sticky, PERSIS pola ModalInputTriase.tsx (tombol
              Simpan full-width, radius 4, fontSize 14). Reset & Tutup
              dihapus per permintaan user — Simpan mengikuti tab aktif
              (PK/PA masing2 punya state/handler submit sendiri), Tutup
              masih bisa lewat overlay/tombol close di header. */}
          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button
              type="button"
              onClick={activeLabTab === 'pk' ? handleSubmitPK : handleSubmitPA}
              disabled={loadingSubmit}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 2, border: 'none', background: loadingSubmit ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: loadingSubmit ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { if (!loadingSubmit) e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { if (!loadingSubmit) e.currentTarget.style.background = '#1AB1E5'; }}
            >
              {loadingSubmit ? 'Menyimpan...' : `Simpan Permintaan Lab ${activeLabTab.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
