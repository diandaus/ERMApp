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
  // dipanggil ulang tiap klik baris tbTarifPK. Checkbox detail yang sudah
  // dicentang dipertahankan (bukan direset) selama id_template-nya masih
  // ada di hasil gabungan baru.
  React.useEffect(() => {
    if (activeLabTab !== 'pk') return;
    if (selectedPemeriksaanPK.length === 0) {
      setDetailPKList([]);
      setSelectedDetailPK([]);
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
        setSelectedDetailPK((prev) => prev.filter((id) => merged.some((t: any) => t.id_template === id)));
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Kolom Kiri - Search + Dropdown */}
        <div>
        <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
            Nama Pemeriksaan{selectedDetailPK.length > 0 && ` (${selectedDetailPK.length} dipilih)`}
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
                      display: 'flex', alignItems: 'center', padding: '2px 12px',
                      background: selected.includes(item.kd_jenis_prw) ? '#e0f2fe' : idx % 2 === 0 ? '#fef7f5' : '#ffffff',
                      borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { if (!selected.includes(item.kd_jenis_prw)) e.currentTarget.style.background = idx % 2 === 0 ? '#fef7f5' : '#ffffff'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.kd_jenis_prw)}
                      onChange={() => toggle(item.kd_jenis_prw)}
                      style={{ marginRight: 12, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.kd_jenis_prw}</div>
                    <div style={{ flex: 1, fontSize: 13, color: '#111827' }}>{item.nm_perawatan}</div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan - Item Dipilih */}
        <div>
        <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
            {selectedDetailPK.length > 0 && ` (${selectedDetailPK.length} dipilih)`}
          </label>
          {selected.map((kd, idx) => {
            const item = list.find(p => p.kd_jenis_prw === kd);
            return (
              <div key={idx} style={{
                borderBottom: idx < selected.length - 1 ? '1px solid #e5e7eb' : 'none',
                padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1, marginRight: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{kd}</div>
                  <div style={{ fontSize: 13, color: '#111827' }}>{item?.nm_perawatan || kd}</div>
                </div>
                <button
                  onClick={() => toggle(kd)}
                  style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >-</button>
              </div>
            );
          })}
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
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
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
              style={{ ...inputStyle, padding: '10px 12px 10px 38px', background: selectedPemeriksaanPK.length === 0 ? '#f9fafb' : '#ffffff' }}
            />
          </div>

          {selectedPemeriksaanPK.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12.5, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
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
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12.5, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              Tidak ada detail parameter untuk pemeriksaan yang dipilih
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', color: '#374151' }}>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'center', width: 36 }}>P</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left' }}>Pemeriksaan</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100 }}>Satuan</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 500 }}>Nilai Rujukan</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedDetailPK.map((g) => {
                    const groupIds = g.items.map((t) => t.id_template);
                    const allSelected = groupIds.every((id) => selectedDetailPK.includes(id));
                    const namaPemeriksaan = list.find((p) => p.kd_jenis_prw === g.kd_jenis_prw)?.nm_perawatan || g.kd_jenis_prw;
                    return (
                      <React.Fragment key={g.kd_jenis_prw}>
                        <tr
                          onClick={() => toggleGroupDetailPK(g.items)}
                          style={{ borderTop: '1px solid #f3f4f6', background: '#f9fafb', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleGroupDetailPK(g.items)}
                              style={{ cursor: 'pointer', width: 15, height: 15 }}
                              title="Centang semua detail pemeriksaan ini"
                            />
                          </td>
                          <td colSpan={3} style={{ padding: '6px 10px', color: '#111827', fontWeight: 700 }}>{namaPemeriksaan}</td>
                        </tr>
                        {g.items.map((t) => (
                          <tr
                            key={t.id_template}
                            onClick={() => toggleDetailPK(t.id_template)}
                            style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedDetailPK.includes(t.id_template)}
                                onChange={() => toggleDetailPK(t.id_template)}
                                style={{ cursor: 'pointer', width: 15, height: 15 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px 6px 26px', color: '#111827' }}>{t.pemeriksaan}</td>
                            <td style={{ padding: '6px 10px', color: '#374151' }}>{t.satuan || '-'}</td>
                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{formatNilaiRujukan(t)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Footer buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div>
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setLabForm({ diagnosa_klinis: '', informasi_tambahan: '' });
              if (type === 'pk') { setSelectedDetailPK([]); setSearchDetailPK(''); }
            }}
            style={{
              padding: '8px 16px', borderRadius: 4, border: 'none',
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
            style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loadingSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
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
            maxWidth: 1200,
            width: '62%',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — title + close button dalam satu baris flex, sejajar
              vertikal (bukan dua elemen absolute yang saling menumpuk). */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#000000', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              Form Permintaan Laboratorium
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none',
                fontSize: 20, cursor: 'pointer', color: '#6b7280',
                padding: 0, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* White Card Content */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #d1d5db',
            padding: '12px',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
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

            {/* Tab PK / PA — display:inline-flex supaya background cuma
                seukuran kolom nama tab (bukan selebar card), alignSelf:
                center supaya switch-nya di tengah (parent flex-column). */}
            <div style={{ display: 'inline-flex', alignSelf: 'center', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 20, flexShrink: 0 }}>
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
