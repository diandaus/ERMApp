import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import './ResepModal.css';

type DropdownPos = { top: number; left: number; width: number };

// Posisi dropdown dihitung dari wrapper input lalu di-render via portal ke
// document.body (position: fixed), agar tidak terpotong overflow modal —
// pola sama seperti ResepModal.tsx.
function useDropdownPos(show: boolean): [React.RefObject<HTMLDivElement>, DropdownPos | null] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<DropdownPos | null>(null);
  React.useEffect(() => {
    if (!show) { setPos(null); return; }
    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [show]);
  return [ref, pos];
}

type Props = {
  patient: any;
  onClose: () => void;
  onSaved?: () => void;
  editData?: { no_permintaan: string; items: any[]; racikan?: any[] } | null;
};

type ObatItem = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  stok: number;
  kapasitas: string;
};

type ResepItem = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  jml: number;
  aturan_pakai: string;
};

type RacikanDetail = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  kapasitas: string;
  kandungan: string;
  jml: number;
};

type RacikanItem = {
  nama_racik: string;
  keterangan: string;
  kd_racik: string;
  jml_dr: number;
  aturan_pakai: string;
  detail: RacikanDetail[];
};

const searchObatApi = async (q: string): Promise<ObatItem[]> => {
  const res = await fetch(`/api/resep-ranap/obat?search=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Gagal mencari obat');
  const raw = await res.json();
  return (raw || []).map((o: any) => ({
    kode_brng: o.kode_brng,
    nama_brng: o.nama_brng,
    kode_sat: o.kode_sat,
    stok: o.stok,
    kapasitas: String(o.kapasitas ?? ''),
  }));
};

const useHistory = (storageKey: string) => {
  const [history, setHistory] = React.useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const save = (val: string) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    const next = [trimmed, ...history.filter(x => x !== trimmed)].slice(0, 20);
    setHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const filter = (input: string) => {
    if (!input.trim()) return history.slice(0, 10);
    const lo = input.toLowerCase();
    const starts = history.filter(x => x.toLowerCase().startsWith(lo));
    const contains = history.filter(x => !x.toLowerCase().startsWith(lo) && x.toLowerCase().includes(lo));
    return [...starts, ...contains].slice(0, 10);
  };
  return { history, save, filter };
};

export const ResepPulangModal: React.FC<Props> = ({ patient, onClose, onSaved, editData }) => {
  const [activeResepTab, setActiveResepTab] = React.useState<'non-racikan' | 'racikan'>('non-racikan');

  // ── Non-Racikan ──────────────────────────────────────────────
  const [searchNonRacikan, setSearchNonRacikan] = React.useState('');
  const [obatList, setObatList] = React.useState<ObatItem[]>([]);
  const [showObatDropdown, setShowObatDropdown] = React.useState(false);
  const [resepNonRacikan, setResepNonRacikan] = React.useState<ResepItem[]>([]);
  const [selectedObat, setSelectedObat] = React.useState<ObatItem | null>(null);
  const [showModalInputObat, setShowModalInputObat] = React.useState(false);
  const [inputObatForm, setInputObatForm] = React.useState({ jml: 1, aturan_pakai: '' });

  // ── Racikan ──────────────────────────────────────────────────
  const [searchRacikan, setSearchRacikan] = React.useState('');
  const [obatListRacikan, setObatListRacikan] = React.useState<ObatItem[]>([]);
  const [showObatDropdownRacikan, setShowObatDropdownRacikan] = React.useState(false);
  const [selectedObatRacikan, setSelectedObatRacikan] = React.useState<ObatItem | null>(null);
  const [showModalInputObatRacikan, setShowModalInputObatRacikan] = React.useState(false);
  const [inputObatRacikanForm, setInputObatRacikanForm] = React.useState({ kandungan: '', jml: 0 });

  const [racikanDraft, setRacikanDraft] = React.useState<RacikanItem>({
    nama_racik: '', keterangan: '', kd_racik: 'Puyer', jml_dr: 1, aturan_pakai: '', detail: [],
  });
  const [racikanList, setRacikanList] = React.useState<RacikanItem[]>([]);

  // ── History dropdowns ─────────────────────────────────────────
  const aturanH = useHistory('aturan_pakai_history');
  const namaRacH = useHistory('nama_racikan_history');
  const ketH = useHistory('keterangan_racikan_history');

  const [showAturanDD, setShowAturanDD] = React.useState(false);
  const [filteredAturan, setFilteredAturan] = React.useState<string[]>([]);
  const [showAturanRacDD, setShowAturanRacDD] = React.useState(false);
  const [filteredAturanRac, setFilteredAturanRac] = React.useState<string[]>([]);
  const [showNamaRacDD, setShowNamaRacDD] = React.useState(false);
  const [filteredNamaRac, setFilteredNamaRac] = React.useState<string[]>([]);
  const [showKetDD, setShowKetDD] = React.useState(false);
  const [filteredKet, setFilteredKet] = React.useState<string[]>([]);

  // ── Posisi dropdown Cari Obat (portal) ──────────────────────────
  const [obatWrapRef, obatDropdownPos] = useDropdownPos(showObatDropdown);
  const [obatRacWrapRef, obatRacDropdownPos] = useDropdownPos(showObatDropdownRacikan);

  const [submitting, setSubmitting] = React.useState(false);

  // ── Pre-fill when editing ─────────────────────────────────────
  React.useEffect(() => {
    if (editData?.items?.length) {
      setResepNonRacikan(editData.items.map((it: any) => ({
        kode_brng: it.kode_brng, nama_brng: it.nama_brng, kode_sat: it.kode_sat || '',
        jml: it.jml || 1, aturan_pakai: it.dosis || it.aturan_pakai || '',
      })));
    }
    if (editData?.racikan?.length) {
      setRacikanList(editData.racikan.map((r: any) => ({
        nama_racik: r.nama_racik || '',
        keterangan: r.keterangan || '',
        kd_racik: r.nm_racik || r.kd_racik || 'Puyer',
        jml_dr: r.jml_dr || 1,
        aturan_pakai: r.aturan_pakai || '',
        detail: (r.detail || []).map((d: any) => ({
          kode_brng: d.kode_brng, nama_brng: d.nama_brng, kode_sat: d.kode_sat || '',
          kapasitas: d.kapasitas || '', jml: d.jml || 0, kandungan: d.kandungan || '',
        })),
      })));
    }
  }, []);

  // ── Auto-search effects ───────────────────────────────────────
  React.useEffect(() => {
    if (searchNonRacikan.trim().length >= 2) {
      searchObatApi(searchNonRacikan)
        .then(data => { setObatList(data); setShowObatDropdown(true); })
        .catch(() => setObatList([]));
    } else {
      setObatList([]); setShowObatDropdown(false);
    }
  }, [searchNonRacikan]);

  React.useEffect(() => {
    if (searchRacikan.trim().length >= 2) {
      searchObatApi(searchRacikan)
        .then(data => { setObatListRacikan(data); setShowObatDropdownRacikan(true); })
        .catch(() => setObatListRacikan([]));
    } else {
      setObatListRacikan([]); setShowObatDropdownRacikan(false);
    }
  }, [searchRacikan]);

  // ── Non-racikan handlers ──────────────────────────────────────
  const pilihObatNonRacikan = (obat: ObatItem) => {
    setSelectedObat(obat);
    setShowObatDropdown(false);
    setShowModalInputObat(true);
    setInputObatForm({ jml: 1, aturan_pakai: '' });
  };

  const closeModalInputObat = () => {
    setShowModalInputObat(false);
    setSelectedObat(null);
    setInputObatForm({ jml: 1, aturan_pakai: '' });
  };

  const confirmTambahObat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObat) return;
    if (inputObatForm.aturan_pakai.trim()) aturanH.save(inputObatForm.aturan_pakai);
    const exists = resepNonRacikan.findIndex(x => x.kode_brng === selectedObat.kode_brng);
    if (exists >= 0) {
      setResepNonRacikan(prev => prev.map((x, i) => i === exists
        ? { ...x, jml: inputObatForm.jml, aturan_pakai: inputObatForm.aturan_pakai } : x));
    } else {
      setResepNonRacikan(prev => [...prev, {
        kode_brng: selectedObat.kode_brng, nama_brng: selectedObat.nama_brng,
        kode_sat: selectedObat.kode_sat, jml: inputObatForm.jml,
        aturan_pakai: inputObatForm.aturan_pakai,
      }]);
    }
    closeModalInputObat();
    setSearchNonRacikan('');
    setShowAturanDD(false);
  };

  const hapusNonRacikan = (i: number) => setResepNonRacikan(prev => prev.filter((_, idx) => idx !== i));

  // ── Racikan handlers ──────────────────────────────────────────
  const pilihObatRacikan = (obat: ObatItem) => {
    setSelectedObatRacikan(obat);
    setShowObatDropdownRacikan(false);
    setShowModalInputObatRacikan(true);
    setInputObatRacikanForm({ kandungan: '', jml: 0 });
  };

  const closeModalInputObatRacikan = () => {
    setShowModalInputObatRacikan(false);
    setSelectedObatRacikan(null);
    setInputObatRacikanForm({ kandungan: '', jml: 0 });
  };

  const hitungJmlRacikan = (kandungan: string) => {
    if (!selectedObatRacikan || !kandungan.trim()) {
      setInputObatRacikanForm(prev => ({ ...prev, jml: 0 })); return;
    }
    const kap = parseFloat(selectedObatRacikan.kapasitas || '0');
    if (kap <= 0) return;
    if (kandungan.includes('/')) {
      const [n, d] = kandungan.split('/').map(s => parseFloat(s.trim()));
      if (!isNaN(n) && !isNaN(d) && d !== 0)
        setInputObatRacikanForm(prev => ({ ...prev, jml: parseFloat(((n / d) * racikanDraft.jml_dr / kap).toFixed(2)) }));
    } else {
      const k = parseFloat(kandungan);
      if (!isNaN(k))
        setInputObatRacikanForm(prev => ({ ...prev, jml: parseFloat((k * racikanDraft.jml_dr / kap).toFixed(2)) }));
    }
  };

  const confirmTambahObatRacikan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObatRacikan) return;
    const newDetail: RacikanDetail = {
      kode_brng: selectedObatRacikan.kode_brng, nama_brng: selectedObatRacikan.nama_brng,
      kode_sat: selectedObatRacikan.kode_sat, kapasitas: selectedObatRacikan.kapasitas,
      kandungan: inputObatRacikanForm.kandungan, jml: inputObatRacikanForm.jml,
    };
    setRacikanDraft(prev => ({ ...prev, detail: [...prev.detail, newDetail] }));
    closeModalInputObatRacikan();
    setSearchRacikan('');
  };

  const hapusDetailRacikan = (i: number) =>
    setRacikanDraft(prev => ({ ...prev, detail: prev.detail.filter((_, idx) => idx !== i) }));

  const finalisasiRacikan = () => {
    if (!racikanDraft.nama_racik.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nama racikan wajib diisi', timer: 1500, showConfirmButton: false }); return;
    }
    if (racikanDraft.detail.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Tambahkan minimal 1 bahan', timer: 1500, showConfirmButton: false }); return;
    }
    if (racikanDraft.nama_racik.trim()) namaRacH.save(racikanDraft.nama_racik);
    if (racikanDraft.keterangan.trim()) ketH.save(racikanDraft.keterangan);
    if (racikanDraft.aturan_pakai.trim()) aturanH.save(racikanDraft.aturan_pakai);
    setRacikanList(prev => [...prev, { ...racikanDraft }]);
    setRacikanDraft({ nama_racik: '', keterangan: '', kd_racik: 'Puyer', jml_dr: 1, aturan_pakai: '', detail: [] });
    setSearchRacikan('');
  };

  const hapusRacikan = (i: number) => setRacikanList(prev => prev.filter((_, idx) => idx !== i));

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Auto-include racikanDraft jika ada bahan yang belum di-finalisasi
    const allRacikan = racikanDraft.detail.length > 0
      ? [...racikanList, { ...racikanDraft }]
      : racikanList;
    if (resepNonRacikan.length === 0 && allRacikan.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan!', text: 'Belum ada obat yang dipilih (non-racikan atau racikan)' }); return;
    }
    setSubmitting(true);
    try {
      const mappedItems = resepNonRacikan.map(it => ({ kode_brng: it.kode_brng, jml: it.jml, dosis: it.aturan_pakai }));
      const mappedRacikan = allRacikan.map(r => ({
        nama_racik: r.nama_racik, kd_racik: r.kd_racik, jml_dr: r.jml_dr,
        aturan_pakai: r.aturan_pakai, keterangan: r.keterangan,
        detail: r.detail.map(d => ({ kode_brng: d.kode_brng, jml: d.jml, kandungan: d.kandungan })),
      }));

      let data: any;
      if (editData?.no_permintaan) {
        const res = await fetch('/api/resep-pulang-req', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ no_permintaan: editData.no_permintaan, items: mappedItems, racikan: mappedRacikan }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengupdate');
      } else {
        const res = await fetch('/api/resep-pulang-req', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ no_rawat: patient.no_rawat, kd_dokter: patient.kd_dokter || '', items: mappedItems, racikan: mappedRacikan }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      }

      onSaved?.();
      onClose();
      await Swal.fire({
        icon: 'success', title: 'Berhasil!',
        text: `Resep pulang ${editData ? 'diperbarui' : 'tersimpan'}\nNo: ${data.no_permintaan || '-'}`,
        timer: 3000, showConfirmButton: true,
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── History dropdown helper ───────────────────────────────────
  const HistoryDropdown = ({ items, onSelect }: { items: string[]; onSelect: (v: string) => void }) => (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
      border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      maxHeight: 200, overflowY: 'auto', zIndex: 1000, marginTop: 4,
    }}>
      {items.map((item, i) => (
        <div key={i} onClick={() => onSelect(item)}
          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          {item}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ── Main Modal ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: 20,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px',
            position: 'relative', maxWidth: 850, width: '85%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '8px 16px 8px 20px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#000000', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              Resep Pulang
              <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>RANAP</span>
              — {patient.nm_pasien} ({patient.no_rkm_medis})
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          <div
            style={{
              background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db',
              padding: 12, overflowY: 'auto', flex: 1, minHeight: 0,
            }}
          >
            {/* Tab Navigation */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
              <button
                type="button"
                onClick={() => setActiveResepTab('non-racikan')}
                style={{
                  padding: '6px 24px',
                  borderRadius: 8,
                  border: activeResepTab === 'non-racikan' ? '1px solid #2563eb' : '1px solid transparent',
                  background: activeResepTab === 'non-racikan' ? '#ffffff' : 'transparent',
                  color: activeResepTab === 'non-racikan' ? '#2563eb' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeResepTab === 'non-racikan' ? 600 : 400,
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Non Racikan {resepNonRacikan.length > 0 && (
                  <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}>{resepNonRacikan.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveResepTab('racikan')}
                style={{
                  padding: '6px 24px',
                  borderRadius: 8,
                  border: activeResepTab === 'racikan' ? '1px solid #2563eb' : '1px solid transparent',
                  background: activeResepTab === 'racikan' ? '#ffffff' : 'transparent',
                  color: activeResepTab === 'racikan' ? '#2563eb' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeResepTab === 'racikan' ? 600 : 400,
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Racikan {racikanList.length > 0 && (
                  <span style={{ fontSize: 11, background: '#16a34a', color: '#fff', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}>{racikanList.length}</span>
                )}
              </button>
            </div>
            </div>

            {/* ── Tab: Non-Racikan ─────────────────────────────── */}
            {activeResepTab === 'non-racikan' && (
              <div className="tab-content-resep">
                <div className="mb-3">
                  <label className="form-label fw-bold">Cari Obat</label>
                  <div className="search-obat-wrapper" ref={obatWrapRef}>
                    <input type="text" className="form-control"
                      placeholder="Ketik nama obat untuk mencari otomatis..."
                      value={searchNonRacikan}
                      onChange={e => setSearchNonRacikan(e.target.value)}
                      autoComplete="off" />
                    {showObatDropdown && obatList.length > 0 && obatDropdownPos && createPortal(
                      <div
                        className="obat-dropdown"
                        style={{ position: 'fixed', top: obatDropdownPos.top, left: obatDropdownPos.left, width: obatDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                      >
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%' }}>Kode</th>
                              <th>Nama Obat</th>
                              <th style={{ width: '10%' }}>Satuan</th>
                              <th style={{ width: '10%' }}>Stok</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obatList.map((o, i) => (
                              <tr key={i} className="obat-item-row" onClick={() => pilihObatNonRacikan(o)}>
                                <td><small>{o.kode_brng}</small></td>
                                <td><div className="obat-name-cell">{o.nama_brng}</div></td>
                                <td className="text-center">{o.kode_sat}</td>
                                <td className="text-center">
                                  <span className={o.stok > 0 ? 'text-success' : 'text-danger'}>{o.stok}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>,
                      document.body
                    )}
                    {showObatDropdown && obatList.length === 0 && (
                      <div className="alert alert-info mt-2" style={{ fontSize: 13 }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchNonRacikan}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Daftar Obat yang Dipilih</label>
                  {resepNonRacikan.length === 0 ? (
                    <div className="alert alert-warning">Belum ada obat yang dipilih</div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th>Nama Obat</th>
                            <th style={{ width: '10%' }}>Jumlah</th>
                            <th style={{ width: '10%' }}>Satuan</th>
                            <th style={{ width: '28%' }}>Aturan Pakai</th>
                            <th style={{ width: '5%' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resepNonRacikan.map((obat, i) => (
                            <tr key={i}>
                              <td className="text-center">{i + 1}</td>
                              <td>{obat.nama_brng}</td>
                              <td>
                                <input type="number" className="form-control form-control-sm"
                                  value={obat.jml} min="1"
                                  onChange={e => setResepNonRacikan(prev => prev.map((x, idx) => idx === i ? { ...x, jml: parseInt(e.target.value) || 1 } : x))}
                                  onFocus={e => e.target.select()} />
                              </td>
                              <td>{obat.kode_sat}</td>
                              <td>
                                <input type="text" className="form-control form-control-sm"
                                  value={obat.aturan_pakai} placeholder="3x1 sehari"
                                  onChange={e => setResepNonRacikan(prev => prev.map((x, idx) => idx === i ? { ...x, aturan_pakai: e.target.value } : x))} />
                              </td>
                              <td className="text-center">
                                <button type="button" onClick={() => hapusNonRacikan(i)} className="btn btn-sm btn-danger"
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Racikan ─────────────────────────────────── */}
            {activeResepTab === 'racikan' && (
              <div className="tab-content-resep">
                <div className="row g-1 mb-3">
                  <div className="col" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Nama Racikan</label>
                    <input type="text" className="form-control"
                      value={racikanDraft.nama_racik} placeholder="Contoh: Pulvis Batuk"
                      autoComplete="off"
                      onChange={e => { setRacikanDraft(p => ({ ...p, nama_racik: e.target.value })); setFilteredNamaRac(namaRacH.filter(e.target.value)); }}
                      onFocus={() => { setFilteredNamaRac(namaRacH.filter(racikanDraft.nama_racik)); setShowNamaRacDD(true); }}
                      onBlur={() => setTimeout(() => setShowNamaRacDD(false), 200)} />
                    {showNamaRacDD && filteredNamaRac.length > 0 && (
                      <HistoryDropdown items={filteredNamaRac} onSelect={v => { setRacikanDraft(p => ({ ...p, nama_racik: v })); setShowNamaRacDD(false); }} />
                    )}
                  </div>
                  <div className="col">
                    <label className="form-label fw-bold">Metode Racik</label>
                    <select className="form-select" value={racikanDraft.kd_racik}
                      onChange={e => setRacikanDraft(p => ({ ...p, kd_racik: e.target.value }))}>
                      <option value="Puyer">Puyer</option>
                      <option value="Kapsul">Kapsul</option>
                      <option value="Sirup">Sirup</option>
                      <option value="Salep">Salep</option>
                      <option value="Krim">Krim</option>
                    </select>
                  </div>
                  <div className="col">
                    <label className="form-label fw-bold">Jumlah /Bungkus</label>
                    <input type="number" className="form-control" min="1"
                      value={racikanDraft.jml_dr} placeholder="Jumlah"
                      onChange={e => setRacikanDraft(p => ({ ...p, jml_dr: parseInt(e.target.value) || 1 }))}
                      onFocus={e => e.target.select()} />
                  </div>
                  <div className="col" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Aturan Pakai</label>
                    <input type="text" className="form-control"
                      value={racikanDraft.aturan_pakai} placeholder="3x1 sehari"
                      autoComplete="off"
                      onChange={e => { setRacikanDraft(p => ({ ...p, aturan_pakai: e.target.value })); setFilteredAturanRac(aturanH.filter(e.target.value)); }}
                      onFocus={() => { setFilteredAturanRac(aturanH.filter(racikanDraft.aturan_pakai)); setShowAturanRacDD(true); }}
                      onBlur={() => setTimeout(() => setShowAturanRacDD(false), 200)} />
                    {showAturanRacDD && filteredAturanRac.length > 0 && (
                      <HistoryDropdown items={filteredAturanRac} onSelect={v => { setRacikanDraft(p => ({ ...p, aturan_pakai: v })); setShowAturanRacDD(false); }} />
                    )}
                  </div>
                  <div className="col" style={{ position: 'relative' }}>
                    <label className="form-label fw-bold">Keterangan</label>
                    <input type="text" className="form-control"
                      value={racikanDraft.keterangan} placeholder="Keterangan tambahan"
                      autoComplete="off"
                      onChange={e => { setRacikanDraft(p => ({ ...p, keterangan: e.target.value })); setFilteredKet(ketH.filter(e.target.value)); }}
                      onFocus={() => { setFilteredKet(ketH.filter(racikanDraft.keterangan)); setShowKetDD(true); }}
                      onBlur={() => setTimeout(() => setShowKetDD(false), 200)} />
                    {showKetDD && filteredKet.length > 0 && (
                      <HistoryDropdown items={filteredKet} onSelect={v => { setRacikanDraft(p => ({ ...p, keterangan: v })); setShowKetDD(false); }} />
                    )}
                  </div>
                </div>

                <hr />

                <div className="mb-3">
                  <label className="form-label fw-bold">Detail Obat Racikan</label>
                  <div className="search-obat-wrapper" ref={obatRacWrapRef}>
                    <input type="text" className="form-control mb-2"
                      placeholder="Ketik nama obat/bahan untuk mencari..."
                      value={searchRacikan}
                      onChange={e => setSearchRacikan(e.target.value)}
                      autoComplete="off" />
                    {showObatDropdownRacikan && obatListRacikan.length > 0 && obatRacDropdownPos && createPortal(
                      <div
                        className="obat-dropdown"
                        style={{ position: 'fixed', top: obatRacDropdownPos.top, left: obatRacDropdownPos.left, width: obatRacDropdownPos.width, right: 'auto', marginTop: 0, zIndex: 999999 }}
                      >
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '15%' }}>Kode</th>
                              <th>Nama Obat</th>
                              <th style={{ width: '10%' }}>Satuan</th>
                              <th style={{ width: '10%' }}>Stok</th>
                              <th style={{ width: '15%' }}>Kapasitas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obatListRacikan.map((o, i) => (
                              <tr key={i} className="obat-item-row" onClick={() => pilihObatRacikan(o)}>
                                <td><small>{o.kode_brng}</small></td>
                                <td><div className="obat-name-cell">{o.nama_brng}</div></td>
                                <td className="text-center">{o.kode_sat}</td>
                                <td className="text-center">
                                  <span className={o.stok > 0 ? 'text-success' : 'text-danger'}>{o.stok}</span>
                                </td>
                                <td className="text-center">{o.kapasitas || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>,
                      document.body
                    )}
                    {showObatDropdownRacikan && obatListRacikan.length === 0 && (
                      <div className="alert alert-info mt-2" style={{ fontSize: 13 }}>
                        Tidak ada obat ditemukan dengan kata kunci "{searchRacikan}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabel bahan racikan yang sedang dibuat */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Daftar Obat dalam Racikan</label>
                  {racikanDraft.detail.length === 0 ? (
                    <div className="alert alert-warning" style={{ fontSize: 13 }}>Belum ada obat dalam racikan</div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th>Nama Obat</th>
                            <th style={{ width: '13%' }}>Kandungan</th>
                            <th style={{ width: '12%' }}>Jumlah</th>
                            <th style={{ width: '10%' }}>Satuan</th>
                            <th style={{ width: '5%' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {racikanDraft.detail.map((d, i) => (
                            <tr key={i}>
                              <td className="text-center">{i + 1}</td>
                              <td>{d.nama_brng}</td>
                              <td className="text-center">{d.kandungan}</td>
                              <td className="text-center">{d.jml}</td>
                              <td className="text-center">{d.kode_sat}</td>
                              <td className="text-center">
                                <button type="button" onClick={() => hapusDetailRacikan(i)} className="btn btn-sm btn-danger"
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {racikanDraft.detail.length > 0 && (
                  <div className="d-flex justify-content-end mb-3">
                    <button type="button" onClick={finalisasiRacikan} className="btn btn-success"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Racikan Baru
                    </button>
                  </div>
                )}

                {/* Daftar racikan yang sudah ditambahkan */}
                {racikanList.length > 0 && (
                  <div>
                    <label className="form-label fw-bold">Daftar Racikan ({racikanList.length})</label>
                    {racikanList.map((r, ri) => (
                      <div key={ri} className="racikan-item mb-3">
                        <div className="racikan-header-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>Racikan {ri + 1}:</strong> {r.nama_racik}
                            <span className="ms-2 badge bg-secondary">{r.kd_racik}</span>
                            <span className="ms-2">| Jumlah: {r.jml_dr}</span>
                            <span className="ms-2">| Aturan: {r.aturan_pakai || '-'}</span>
                            {r.keterangan && <span className="ms-2 text-muted">| {r.keterangan}</span>}
                          </div>
                          <button type="button" onClick={() => hapusRacikan(ri)} className="btn btn-sm btn-danger"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                        <table className="table table-sm table-bordered mt-2">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '5%' }}>No</th>
                              <th>Nama Obat</th>
                              <th style={{ width: '12%' }}>Kandungan</th>
                              <th style={{ width: '12%' }}>Jumlah</th>
                              <th style={{ width: '10%' }}>Satuan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.detail.map((d, di) => (
                              <tr key={di}>
                                <td className="text-center">{di + 1}</td>
                                <td>{d.nama_brng}</td>
                                <td className="text-center">{d.kandungan}</td>
                                <td className="text-center">{d.jml}</td>
                                <td className="text-center">{d.kode_sat}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: submitting ? '#9ca3af' : '#2563eb', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                {submitting ? 'Menyimpan...' : editData ? 'Update Resep Pulang' : 'Simpan Resep Pulang'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-modal: Input Obat Non-Racikan ──────────────────── */}
      {showModalInputObat && selectedObat && (
        <div className="modal-overlay" onClick={closeModalInputObat}>
          <div className="modal-input-obat-simple" onClick={e => e.stopPropagation()}>
            <form onSubmit={confirmTambahObat}>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ width: 120 }}>
                  <label className="form-label mb-1">Jumlah <span className="text-danger">*</span></label>
                  <input type="number" className="form-control" value={inputObatForm.jml} min="1"
                    onChange={e => setInputObatForm(p => ({ ...p, jml: parseInt(e.target.value) || 1 }))}
                    required autoFocus onFocus={e => e.target.select()} />
                </div>
                <div className="col" style={{ position: 'relative' }}>
                  <label className="form-label mb-1">Aturan Pakai <span className="text-danger">*</span></label>
                  <input type="text" className="form-control"
                    value={inputObatForm.aturan_pakai} placeholder="3x1 sehari setelah makan"
                    autoComplete="off"
                    onChange={e => { setInputObatForm(p => ({ ...p, aturan_pakai: e.target.value })); setFilteredAturan(aturanH.filter(e.target.value)); }}
                    onFocus={() => { setFilteredAturan(aturanH.filter(inputObatForm.aturan_pakai)); setShowAturanDD(true); }}
                    onBlur={() => setTimeout(() => setShowAturanDD(false), 200)} />
                  {showAturanDD && filteredAturan.length > 0 && (
                    <HistoryDropdown items={filteredAturan} onSelect={v => { setInputObatForm(p => ({ ...p, aturan_pakai: v })); setShowAturanDD(false); }} />
                  )}
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-primary">✅ Tambah</button>
                </div>
                <div className="col-auto">
                  <button type="button" onClick={closeModalInputObat} className="btn btn-secondary">❌ Batal</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-modal: Input Bahan Racikan ─────────────────────── */}
      {showModalInputObatRacikan && selectedObatRacikan && (
        <div className="modal-overlay" onClick={closeModalInputObatRacikan}>
          <div className="modal-input-obat-racikan" onClick={e => e.stopPropagation()}>
            <div className="obat-racikan-info">
              <div className="obat-racikan-name">{selectedObatRacikan.nama_brng}</div>
              <div className="obat-racikan-details">
                <span>Stok: <strong>{selectedObatRacikan.stok}</strong> {selectedObatRacikan.kode_sat}</span>
                {selectedObatRacikan.kapasitas && parseFloat(selectedObatRacikan.kapasitas) > 0 && (
                  <span className="ms-3">Kapasitas: <strong>{selectedObatRacikan.kapasitas}</strong></span>
                )}
              </div>
            </div>
            <form onSubmit={confirmTambahObatRacikan}>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ width: 160 }}>
                  <label className="form-label mb-1">Kandungan <span className="text-danger">*</span></label>
                  <input type="text" className="form-control"
                    value={inputObatRacikanForm.kandungan} placeholder="200 atau 1/2"
                    required autoFocus
                    onChange={e => { setInputObatRacikanForm(p => ({ ...p, kandungan: e.target.value })); hitungJmlRacikan(e.target.value); }} />
                </div>
                <div className="col-auto" style={{ width: 160 }}>
                  <label className="form-label mb-1">Jumlah <span className="text-muted">(otomatis)</span></label>
                  <input type="number" className="form-control" value={inputObatRacikanForm.jml}
                    min="0" step="0.01" readOnly style={{ backgroundColor: '#f8f9fa' }} />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-primary">✅ Tambah</button>
                </div>
                <div className="col-auto">
                  <button type="button" onClick={closeModalInputObatRacikan} className="btn btn-secondary">❌ Batal</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
