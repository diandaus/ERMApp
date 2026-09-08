import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';

// ModalJadwalObat — pengganti digital Formulir Pemberian Obat RM.14
// (kertas), dibuka dari tombol "Jadwal Obat" di RawatInap.tsx utk pasien
// yg dipilih. Jam pemberian per frekuensi (1x1..6x1) FIXED, diambil dari
// backend (jadwal_obat_handler.go — satu sumber kebenaran, dikonfirmasi
// user persis dari kertas RM.14, TIDAK boleh diubah manual per pasien).
// Slide-in panel dari kanan, pola PERSIS ModalInputResume.tsx/ResepModal.tsx.
//
// Tampilan tabel — persis header kertas RM.14:
//   | Nama Obat | 07/09/2026     | 08/09/2026     | dst.. |
//   |           | PG SI SO ML    | PG SI SO ML    |       |
// PG/SI/SO/ML = slot ke-1/2/3/4+ (urutan, BUKAN dikelompokkan per jam
// beneran) — kertas cuma punya 4 kolom tetap, jadi utk obat 5x1/6x1
// (>4 slot/hari) slot ke-4 dst semua digabung ke kolom ML sekaligus.

type Patient = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  umur: string;
  tgl_masuk?: string; // format YYYY-MM-DD (RawatInap.tsx) — dipakai default Tgl. Mulai obat
  tgl_keluar?: string; // format YYYY-MM-DD, kosong '' kalau belum pulang
  stts_pulang?: string; // '-' = belum pulang, selain itu = sudah pulang
  kamar?: string;
  nm_dokter?: string; // DPJP
};

type TandaCell = {
  tanda: string;
  catatan: string;
  marked_by: string;
  marked_at: string;
};

type JadwalObatItem = {
  id: number;
  no_rawat: string;
  nama_obat: string;
  sumber: 'resep' | 'manual';
  frekuensi: string;
  tgl_mulai: string;
  status: 'aktif' | 'dihentikan';
  created_by: string;
  jam_list: string[];
  tanda: Record<string, Record<string, TandaCell>>; // tanggal -> slot_index(string) -> cell
};

type FrekuensiRef = { frekuensi: string; jam_list: string[] };

// Bentuk data persis resep_ranap_handler.go (GET /api/resep-ranap/list) —
// dipakai modal "Pilih dari Resep" supaya nampilin detail LENGKAP (bukan
// cuma nama obat), sama kayak modal "Lihat" referensi di ModalInputResume.tsx.
type ResepNonRacikanItem = { kode_brng: string; nama_brng: string; kode_sat: string; jml: number; aturan_pakai: string };
type ResepRacikanDetailItem = { kode_brng: string; nama_brng: string; kode_sat: string; jml: number; kandungan: string; kapasitas: number };
type ResepRacikanItem = {
  no_racik: string; nama_racik: string; kd_racik: string; nm_racik: string; metode_racik: string;
  jml_dr: number; aturan_pakai: string; keterangan: string; detail: ResepRacikanDetailItem[];
};
type ResepRanapResult = {
  no_resep: string; tgl_peresepan: string; jam_peresepan: string; kd_dokter: string; nm_dokter: string;
  status: string; non_racikan: ResepNonRacikanItem[]; racikan: ResepRacikanItem[];
};

type OpenCellState = { itemId: number; tanggal: string; slotIndex: number } | null;

const TANDA_INFO: Record<string, { label: string; color: string; bg: string }> = {
  V: { label: 'Obat sudah diberikan', color: '#166534', bg: '#dcfce7' },
  T: { label: 'Pasien menolak', color: '#991b1b', bg: '#fee2e2' },
  K: { label: 'Kondisi pasien menyebabkan ditundanya pemberian obat', color: '#92400e', bg: '#fef3c7' },
  A: { label: 'Reaksi alergi', color: '#5b21b6', bg: '#ede9fe' },
};

const SLOT_LABELS = ['PG', 'SI', 'SO', 'ML'] as const;

// getSlotGroups — petakan tiap slot_index (0..N-1, N = jml dosis/hari sesuai
// frekuensi) ke salah satu dari 4 kolom kertas: slot ke-0->PG, ke-1->SI,
// ke-2->SO, sisanya (ke-3, ke-4, ke-5, ...)->ML digabung jadi satu.
function getSlotGroups(jamCount: number): Record<typeof SLOT_LABELS[number], number[]> {
  const groups: Record<typeof SLOT_LABELS[number], number[]> = { PG: [], SI: [], SO: [], ML: [] };
  for (let i = 0; i < jamCount; i++) {
    if (i === 0) groups.PG.push(i);
    else if (i === 1) groups.SI.push(i);
    else if (i === 2) groups.SO.push(i);
    else groups.ML.push(i);
  }
  return groups;
}

// Simbol tanda — V ditampilkan sbg centang sukses (bukan huruf "V", lebih
// intuitif "obat sudah diberikan" = checklist), tanda lain (T/K/A) tetap
// huruf krn tidak ada ikon universal yg pas.
const TandaSymbol: React.FC<{ tanda: string; color: string; size?: number }> = ({ tanda, color, size = 12 }) => {
  if (tanda === 'V') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return <>{tanda}</>;
};

function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTglIndo(tgl: string): string {
  if (!tgl) return '-';
  const [y, m, d] = tgl.split('-');
  return `${d}/${m}/${y}`;
}

// detectFrekuensi — coba tebak frekuensi (1x1..6x1) dari teks aturan pakai
// resep (mis. "3 x 1 tab sehari" atau "2x1"). Cuma DIISI OTOMATIS sbg
// kemudahan awal — tetap bisa diganti manual lewat dropdown Frekuensi,
// TIDAK pernah override pilihan user setelahnya.
function detectFrekuensi(aturanPakai: string, validFrekuensi: string[]): string {
  const match = aturanPakai.match(/([1-6])\s*[xX]\s*1\b/);
  if (!match) return '';
  const guess = `${match[1]}x1`;
  return validFrekuensi.includes(guess) ? guess : '';
}

// getDateRange — daftar tanggal dari tglDari..tglSampai (inklusif), dibatasi
// max 31 hari sbg pengaman kalau rentang kepilih kelewat lebar (tabel bisa
// jadi ribuan kolom).
function getDateRange(dari: string, sampai: string): string[] {
  const result: string[] = [];
  if (!dari || !sampai) return result;
  const d = new Date(dari + 'T00:00:00');
  const end = new Date(sampai + 'T00:00:00');
  let guard = 0;
  while (d <= end && guard < 31) {
    result.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return result;
}

export const ModalJadwalObat: React.FC<{
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  currentUsername: string;
}> = ({ open, onClose, patient, currentUsername }) => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [open]);

  // modalBoxRef/modalBoxRect — dipakai posisi modal "Pilih dari Resep" di
  // bawah, PERSIS pola modalBoxRef di ModalInputResume.tsx (modal referensi
  // ditumpuk pas di atas panel ini, bukan full-screen terpisah).
  const modalBoxRef = React.useRef<HTMLDivElement>(null);
  const [modalBoxRect, setModalBoxRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const [tglDari, setTglDari] = React.useState<string>(localDateStr());
  const [tglSampai, setTglSampai] = React.useState<string>(localDateStr());
  const dates = React.useMemo(() => getDateRange(tglDari, tglSampai), [tglDari, tglSampai]);

  // Rentang tabel default: dari tanggal pasien masuk s/d hari ini — atau
  // s/d tanggal pulang kalau pasien sudah pulang (stts_pulang != '-' &
  // tgl_keluar terisi), supaya jadwal obat yg ditutup pas pasien pulang
  // langsung kelihatan penuh tanpa geser tanggal manual. Tetap bisa diubah.
  React.useEffect(() => {
    if (!open) return;
    const today = localDateStr();
    const sudahPulang = !!patient?.tgl_keluar && patient?.stts_pulang !== '-';
    setTglDari(patient?.tgl_masuk || today);
    setTglSampai(sudahPulang ? patient!.tgl_keluar! : today);
  }, [open, patient?.tgl_masuk, patient?.tgl_keluar, patient?.stts_pulang]);

  const [items, setItems] = React.useState<JadwalObatItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [frekuensiRef, setFrekuensiRef] = React.useState<FrekuensiRef[]>([]);

  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addSumber, setAddSumber] = React.useState<'manual' | 'resep'>('manual');
  const [addNamaObat, setAddNamaObat] = React.useState('');
  const [addFrekuensi, setAddFrekuensi] = React.useState('');
  const [addTglMulai, setAddTglMulai] = React.useState(localDateStr());
  const [savingAdd, setSavingAdd] = React.useState(false);

  // Tgl. Mulai default ke tanggal pasien masuk/registrasi (patient.tgl_masuk),
  // bukan selalu hari ini — jadwal obat yg dientri belakangan tetap
  // tercatat mulai sejak pasien dirawat. Tetap bisa diganti manual.
  React.useEffect(() => {
    if (showAddForm) setAddTglMulai(patient?.tgl_masuk || localDateStr());
  }, [showAddForm, patient?.tgl_masuk]);

  // resepPickerMode — modal "Pilih dari Resep" dipakai 2 tempat: isi Nama
  // Obat form Tambah Obat ('obat'), atau tambah baris ke tabel Alergi Obat
  // ('alergi') — sama persis modal & data resepnya, cuma beda aksi onPick.
  const [showResepPicker, setShowResepPicker] = React.useState(false);
  const [resepPickerMode, setResepPickerMode] = React.useState<'obat' | 'alergi'>('obat');
  const [resepList, setResepList] = React.useState<ResepRanapResult[]>([]);
  const [resepLoading, setResepLoading] = React.useState(false);
  const [resepSearch, setResepSearch] = React.useState('');

  const [alergiList, setAlergiList] = React.useState<{ id: number; nama_obat: string }[]>([]);
  const [alergiLoading, setAlergiLoading] = React.useState(false);

  const [openCell, setOpenCell] = React.useState<OpenCellState>(null);
  const [cellTanda, setCellTanda] = React.useState<string>('');
  const [cellCatatan, setCellCatatan] = React.useState('');
  const [savingCell, setSavingCell] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch('/api/jadwal-obat/frekuensi-ref')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setFrekuensiRef(Array.isArray(data) ? data : []))
      .catch(() => setFrekuensiRef([]));
  }, [open]);

  const loadItems = React.useCallback(() => {
    if (!open || !patient?.no_rawat || dates.length === 0) return;
    setLoading(true);
    fetch(`/api/jadwal-obat/list?no_rawat=${encodeURIComponent(patient.no_rawat)}&tgl_dari=${dates[0]}&tgl_sampai=${dates[dates.length - 1]}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, patient?.no_rawat, dates]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const loadAlergi = React.useCallback(() => {
    if (!open || !patient?.no_rawat) return;
    setAlergiLoading(true);
    fetch(`/api/jadwal-obat/alergi?no_rawat=${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAlergiList(Array.isArray(data) ? data : []))
      .catch(() => setAlergiList([]))
      .finally(() => setAlergiLoading(false));
  }, [open, patient?.no_rawat]);

  React.useEffect(() => {
    loadAlergi();
  }, [loadAlergi]);

  const handleAddAlergi = async (namaObat: string) => {
    if (!patient?.no_rawat) return;
    try {
      const res = await fetch('/api/jadwal-obat/alergi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: patient.no_rawat, nama_obat: namaObat, created_by: currentUsername }),
      });
      if (!res.ok) throw new Error('Gagal simpan alergi');
      loadAlergi();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    }
  };

  const handleHapusAlergi = async (id: number) => {
    const confirm = await Swal.fire({
      icon: 'warning', title: 'Hapus alergi ini?', showCancelButton: true,
      confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/jadwal-obat/alergi/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal hapus alergi');
      loadAlergi();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    }
  };

  // Fetch detail resep LENGKAP (bukan cuma nama obat) tiap modal "Pilih
  // dari Resep" dibuka — sekaligus ukur modalBoxRect biar kartunya
  // nempel pas di atas panel ini, PERSIS pola modal referensi "Lihat" di
  // ModalInputResume.tsx.
  React.useEffect(() => {
    if (!showResepPicker || !patient?.no_rawat) return;
    setResepSearch('');
    setResepLoading(true);
    fetch(`/api/resep-ranap/list?no_rawat=${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setResepList(Array.isArray(data) ? data : []))
      .catch(() => setResepList([]))
      .finally(() => setResepLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [showResepPicker, patient?.no_rawat]);

  const resetAddForm = () => {
    setShowAddForm(false);
    setAddSumber('manual');
    setAddNamaObat('');
    setAddFrekuensi('');
    setAddTglMulai(localDateStr());
  };

  const handleSaveAdd = async () => {
    if (!patient?.no_rawat) return;
    if (!addNamaObat.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nama obat belum diisi', confirmButtonColor: '#2563eb' });
      return;
    }
    if (!addFrekuensi) {
      Swal.fire({ icon: 'warning', title: 'Frekuensi belum dipilih', confirmButtonColor: '#2563eb' });
      return;
    }
    setSavingAdd(true);
    try {
      const res = await fetch('/api/jadwal-obat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          nama_obat: addNamaObat.trim(),
          sumber: addSumber,
          frekuensi: addFrekuensi,
          tgl_mulai: addTglMulai,
          created_by: currentUsername,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal simpan jadwal obat');
      }
      resetAddForm();
      loadItems();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setSavingAdd(false);
    }
  };

  const handleHentikan = async (item: JadwalObatItem) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Hentikan obat ini?',
      text: `${item.nama_obat} tidak akan muncul lagi di jadwal aktif. Histori tanda tetap tersimpan.`,
      showCancelButton: true,
      confirmButtonText: 'Hentikan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/jadwal-obat/${item.id}/hentikan`, { method: 'PUT' });
      if (!res.ok) throw new Error('Gagal hentikan obat');
      loadItems();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    }
  };

  const openCellEditor = (item: JadwalObatItem, tanggal: string, slotIndex: number) => {
    const existing = item.tanda[tanggal]?.[String(slotIndex)];
    setOpenCell({ itemId: item.id, tanggal, slotIndex });
    setCellTanda(existing?.tanda || '');
    setCellCatatan(existing?.catatan || '');
  };

  const closeCellEditor = () => {
    setOpenCell(null);
    setCellTanda('');
    setCellCatatan('');
  };

  const handleSaveCell = async () => {
    if (!openCell || !cellTanda) return;
    setSavingCell(true);
    try {
      const res = await fetch('/api/jadwal-obat/tanda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jadwal_obat_id: openCell.itemId,
          tanggal: openCell.tanggal,
          slot_index: openCell.slotIndex,
          tanda: cellTanda,
          catatan: cellCatatan,
          marked_by: currentUsername,
        }),
      });
      if (!res.ok) throw new Error('Gagal simpan tanda');
      closeCellEditor();
      loadItems();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setSavingCell(false);
    }
  };

  const handleDeleteCell = async () => {
    if (!openCell) return;
    setSavingCell(true);
    try {
      const res = await fetch(
        `/api/jadwal-obat/tanda?jadwal_obat_id=${openCell.itemId}&tanggal=${openCell.tanggal}&slot_index=${openCell.slotIndex}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Gagal hapus tanda');
      closeCellEditor();
      loadItems();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setSavingCell(false);
    }
  };

  if (!open) return null;

  const aktifItems = items.filter((it) => it.status === 'aktif');
  const dihentikanItems = items.filter((it) => it.status !== 'aktif');

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '60vw', maxWidth: '1400px', minWidth: 480,
          background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — breadcrumb pasien + close button bulat, pola ResepModal.tsx/ModalInputResume.tsx. */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
            </svg>
            {[
              patient?.no_rawat,
              patient?.no_rkm_medis,
              patient?.nm_pasien,
              patient?.umur ? `${patient.umur}` : '',
              patient?.kamar ? `Kamar ${patient.kamar}` : '',
              patient?.nm_dokter ? `DPJP ${patient.nm_dokter}` : '',
            ]
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
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>

          {/* Rentang tanggal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Dari</span>
            <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13 }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>s/d</span>
            <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13 }} />
            <button type="button" onClick={() => { const t = localDateStr(); setTglDari(t); setTglSampai(t); }}
              style={{ padding: '4px 10px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12 }}>
              Hari Ini
            </button>
          </div>

          {/* Legend V/T/K/A */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 14px', marginBottom: 16, fontSize: 11, color: '#6b7280' }}>
            {Object.entries(TANDA_INFO).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <b style={{ color: v.color, display: 'inline-flex', alignItems: 'center' }}><TandaSymbol tanda={k} color={v.color} /></b> = {v.label}
              </span>
            ))}
          </div>

          {/* Tombol Tambah Obat + Input Alergi (sebaris, Input Alergi rata kanan) */}
          {!showAddForm && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Tambah Obat
              </button>
              <button
                type="button"
                onClick={() => { setResepPickerMode('alergi'); setShowResepPicker(true); }}
                style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></svg>
                Input Alergi
              </button>
            </div>
          )}

          {/* Tabel Alergi Obat — 1 kolom, kertas RM.14 (kolom "ALERGI OBAT"). */}
          {(alergiLoading || alergiList.length > 0) && (
            <div style={{ marginBottom: 16, border: '1px solid #fecaca', maxWidth: 320 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', textAlign: 'left', background: '#fef2f2', color: '#991b1b', fontWeight: 400, fontSize: 12 }}>Alergi Obat</th>
                  </tr>
                </thead>
                <tbody>
                  {alergiLoading ? (
                    <tr><td style={{ padding: '8px 10px', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (
                    alergiList.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: '6px 10px', color: '#111827', borderTop: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{a.nama_obat}</span>
                          <button
                            type="button"
                            onClick={() => handleHapusAlergi(a.id)}
                            title="Hapus"
                            style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                          >×</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Tambah Obat */}
          {showAddForm && (
            <div style={{ background: '#F9FAFB', borderRadius: 0, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: '#111827', marginBottom: 12 }}>Tambah Obat</div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {(['manual', 'resep'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setAddSumber(s);
                      setAddNamaObat('');
                      if (s === 'resep') { setResepPickerMode('obat'); setShowResepPicker(true); }
                    }}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 400, cursor: 'pointer',
                      border: '1px solid ' + (addSumber === s ? '#2563eb' : '#d1d5db'),
                      background: addSumber === s ? '#2563eb' : '#fff',
                      color: addSumber === s ? '#fff' : '#6b7280',
                      borderRadius: 0,
                    }}
                  >
                    {s === 'manual' ? 'Ketik Manual' : 'Dari Resep'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151' }}>Nama Obat</label>
                  {addSumber === 'resep' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={addNamaObat}
                        readOnly
                        placeholder="Belum dipilih"
                        style={{ flex: 1, height: 32, padding: '4px 8px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', background: '#f3f4f6', color: '#374151' }}
                      />
                      <button
                        type="button"
                        onClick={() => { setResepPickerMode('obat'); setShowResepPicker(true); }}
                        style={{ height: 32, padding: '0 12px', borderRadius: 0, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                      >
                        {addNamaObat ? 'Ganti' : 'Pilih'}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={addNamaObat}
                      onChange={(e) => setAddNamaObat(e.target.value)}
                      placeholder="Nama obat oral/topikal"
                      style={{ width: '100%', height: 32, padding: '4px 8px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151' }}>Frekuensi</label>
                  <select
                    value={addFrekuensi}
                    onChange={(e) => setAddFrekuensi(e.target.value)}
                    style={{ width: '100%', height: 32, padding: '4px 8px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', background: '#fff' }}
                  >
                    <option value="">—</option>
                    {frekuensiRef.map((f) => <option key={f.frekuensi} value={f.frekuensi}>{f.frekuensi}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151' }}>Tgl. Mulai</label>
                  <input
                    type="date"
                    value={addTglMulai}
                    onChange={(e) => setAddTglMulai(e.target.value)}
                    style={{ width: '100%', height: 32, padding: '4px 8px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {addFrekuensi && (
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                  Jam pemberian: {(frekuensiRef.find((f) => f.frekuensi === addFrekuensi)?.jam_list || []).join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveAdd}
                  disabled={savingAdd}
                  style={{ padding: '6px 16px', borderRadius: 0, border: 'none', background: savingAdd ? '#9ca3af' : '#2563eb', color: '#fff', cursor: savingAdd ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 400 }}
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={resetAddForm}
                  style={{ padding: '6px 16px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12 }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Tabel jadwal — header persis kertas RM.14 (Nama Obat | tanggal > PG/SI/SO/ML) */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Memuat data...</div>
          ) : aktifItems.length === 0 && dihentikanItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #d1d5db', borderRadius: 0 }}>
              Belum ada obat terjadwal untuk pasien ini.
            </div>
          ) : dates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Pilih rentang tanggal dulu.</div>
          ) : (
            <JadwalObatTable
              items={aktifItems}
              dihentikanItems={dihentikanItems}
              dates={dates}
              openCell={openCell}
              cellTanda={cellTanda}
              cellCatatan={cellCatatan}
              savingCell={savingCell}
              onOpenCell={openCellEditor}
              onCloseCell={closeCellEditor}
              onChangeTanda={setCellTanda}
              onChangeCatatan={setCellCatatan}
              onSaveCell={handleSaveCell}
              onDeleteCell={handleDeleteCell}
              onHentikan={handleHentikan}
            />
          )}
        </div>
      </div>

      {/* Pilih dari Resep — kartu detail LENGKAP tiap resep (bukan cuma
          nama obat), posisi/ukuran diambil dari modalBoxRect PERSIS pola
          modal "Lihat" referensi di ModalInputResume.tsx. */}
      {showResepPicker && modalBoxRect && (
        <ResepPickerModal
          rect={modalBoxRect}
          resepList={resepList}
          loading={resepLoading}
          search={resepSearch}
          onChangeSearch={setResepSearch}
          onClose={() => setShowResepPicker(false)}
          onPick={(namaObat, aturanPakai) => {
            if (resepPickerMode === 'alergi') {
              handleAddAlergi(namaObat);
              setShowResepPicker(false);
              return;
            }
            setAddNamaObat(namaObat);
            // Isi frekuensi otomatis dari aturan pakai resep kalau kepend
            // -eteksi (mis. "3x1") — tetap bisa diganti manual lewat
            // dropdown Frekuensi, ini cuma bantu isi awal.
            const guess = detectFrekuensi(aturanPakai, frekuensiRef.map((f) => f.frekuensi));
            if (guess) setAddFrekuensi(guess);
            setShowResepPicker(false);
          }}
        />
      )}
    </div>
  );
};

// ResepPickerModal — kartu detail LENGKAP semua resep pasien ini (bukan
// cuma dropdown nama obat): per resep ditampilkan tgl/jam peresepan +
// dokter, lalu tiap item non-racikan (nama, jumlah, satuan, aturan pakai)
// & racikan (metode, aturan pakai, daftar kandungan). Klik 1 baris obat ->
// pilih nama itu ke form Tambah Obat. Posisi/ukuran kartu PERSIS pola
// modal referensi "Lihat" di ModalInputResume.tsx (nempel di atas rect
// panel induk, bukan dialog terpisah).
const ResepPickerModal: React.FC<{
  rect: { top: number; left: number; width: number; height: number };
  resepList: ResepRanapResult[];
  loading: boolean;
  search: string;
  onChangeSearch: (v: string) => void;
  onClose: () => void;
  onPick: (namaObat: string, aturanPakai: string) => void;
}> = ({ rect, resepList, loading, search, onChangeSearch, onClose, onPick }) => {
  const q = search.trim().toLowerCase();

  const rowStyle: React.CSSProperties = {
    padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#111827',
    borderBottom: '1px solid #f3f4f6',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: rect.top, left: rect.left, width: rect.width * 0.7, height: rect.height,
          background: '#ffffff', borderRadius: 0, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Pilih Obat dari Resep</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onChangeSearch(e.target.value)}
          placeholder="Cari nama obat..."
          autoFocus
          style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat...</div>
          ) : resepList.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada resep untuk pasien ini.</div>
          ) : (
            resepList.map((resep) => {
              const nonRacikan = (resep.non_racikan || []).filter((nr) => !q || nr.nama_brng.toLowerCase().includes(q));
              const racikan = (resep.racikan || []).filter((rc) => !q || (rc.nama_racik || rc.metode_racik || '').toLowerCase().includes(q) ||
                (rc.detail || []).some((d) => d.nama_brng.toLowerCase().includes(q)));
              if (nonRacikan.length === 0 && racikan.length === 0) return null;

              return (
                <div key={resep.no_resep} style={{ marginBottom: 14, border: '1px solid #e5e7eb' }}>
                  <div style={{ padding: '6px 10px', background: '#f9fafb', fontSize: 11, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formatTglIndo(resep.tgl_peresepan)} {resep.jam_peresepan} — {resep.nm_dokter || '-'}</span>
                    <span>No. Resep: {resep.no_resep}</span>
                  </div>
                  {nonRacikan.map((nr) => (
                    <div key={nr.kode_brng} style={rowStyle} onClick={() => onPick(nr.nama_brng, nr.aturan_pakai || '')}>
                      <b style={{ fontWeight: 400 }}>{nr.nama_brng}</b>
                      <span style={{ color: '#6b7280' }}> — {nr.jml} {nr.kode_sat}</span>
                      {nr.aturan_pakai && <span style={{ color: '#9ca3af' }}> · {nr.aturan_pakai}</span>}
                    </div>
                  ))}
                  {racikan.map((rc, idx) => (
                    <div key={idx} style={rowStyle} onClick={() => onPick(rc.nama_racik || rc.metode_racik || 'Racikan', rc.aturan_pakai || '')}>
                      <b style={{ fontWeight: 400 }}>Racikan — {rc.metode_racik || rc.nama_racik}</b>
                      {rc.jml_dr ? <span style={{ color: '#6b7280' }}> ({rc.jml_dr}x)</span> : null}
                      {rc.aturan_pakai && <span style={{ color: '#9ca3af' }}> · {rc.aturan_pakai}</span>}
                      {(rc.detail || []).length > 0 && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {(rc.detail || []).map((d) => `${d.nama_brng} ${d.jml}${d.kode_sat}`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const thBase: React.CSSProperties = { border: '1px solid #e5e7eb', padding: '6px 4px', fontSize: 11, fontWeight: 400, color: '#374151', background: '#F9FAFB', textAlign: 'center', whiteSpace: 'nowrap' };
const tdBase: React.CSSProperties = { border: '1px solid #e5e7eb', padding: 2, textAlign: 'center', verticalAlign: 'middle' };

const JadwalObatTable: React.FC<{
  items: JadwalObatItem[];
  dihentikanItems: JadwalObatItem[];
  dates: string[];
  openCell: OpenCellState;
  cellTanda: string;
  cellCatatan: string;
  savingCell: boolean;
  onOpenCell: (item: JadwalObatItem, tanggal: string, slotIndex: number) => void;
  onCloseCell: () => void;
  onChangeTanda: (v: string) => void;
  onChangeCatatan: (v: string) => void;
  onSaveCell: () => void;
  onDeleteCell: () => void;
  onHentikan: (item: JadwalObatItem) => void;
}> = ({ items, dihentikanItems, dates, openCell, cellTanda, cellCatatan, savingCell, onOpenCell, onCloseCell, onChangeTanda, onChangeCatatan, onSaveCell, onDeleteCell, onHentikan }) => {
  const allRows: { item: JadwalObatItem; readOnly: boolean }[] = [
    ...items.map((item) => ({ item, readOnly: false })),
    ...(dihentikanItems.length > 0 ? [{ item: null as any, readOnly: false, isDivider: true }] as any : []),
    ...dihentikanItems.map((item) => ({ item, readOnly: true })),
  ];

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 0 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...thBase, position: 'sticky', left: 0, zIndex: 3, minWidth: 200, textAlign: 'center', padding: '6px 10px', fontSize: 13 }}>
              Nama Obat
            </th>
            {dates.map((date) => (
              <th key={date} colSpan={4} style={thBase}>{formatTglIndo(date)}</th>
            ))}
          </tr>
          <tr>
            {dates.map((date) => (
              <React.Fragment key={date}>
                {SLOT_LABELS.map((label) => (
                  <th key={label} style={{ ...thBase, minWidth: 24 }}>{label}</th>
                ))}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => {
            if ((row as any).isDivider) {
              return (
                <tr key="divider">
                  <td colSpan={1 + dates.length * 4} style={{ ...tdBase, position: 'sticky', left: 0, background: '#f3f4f6', color: '#9ca3af', fontWeight: 400, fontSize: 11, textAlign: 'left', padding: '6px 10px', border: 'none' }}>
                    Obat Dihentikan
                  </td>
                </tr>
              );
            }
            const { item, readOnly } = row;
            const groups = getSlotGroups(item.jam_list.length);
            return (
              <tr key={item.id} style={{ opacity: readOnly ? 0.55 : 1 }}>
                <td style={{ ...tdBase, position: 'sticky', left: 0, background: '#fff', zIndex: 2, textAlign: 'left', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#111827' }}>{item.nama_obat}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 0, background: '#dbeafe', color: '#1e40af', fontWeight: 400, flexShrink: 0 }}>{item.frekuensi}</span>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onHentikan(item)}
                        title="Hentikan obat ini"
                        style={{ padding: '2px 6px', borderRadius: 0, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 9, flexShrink: 0 }}
                      >
                        Hentikan
                      </button>
                    )}
                  </div>
                </td>
                {dates.map((date) => (
                  <React.Fragment key={date}>
                    {SLOT_LABELS.map((label) => (
                      <td key={label} style={tdBase}>
                        <SlotGroupCell
                          item={item}
                          tanggal={date}
                          slotIndexes={groups[label]}
                          readOnly={readOnly}
                          openCell={openCell}
                          cellTanda={cellTanda}
                          cellCatatan={cellCatatan}
                          savingCell={savingCell}
                          onOpenCell={onOpenCell}
                          onCloseCell={onCloseCell}
                          onChangeTanda={onChangeTanda}
                          onChangeCatatan={onChangeCatatan}
                          onSaveCell={onSaveCell}
                          onDeleteCell={onDeleteCell}
                        />
                      </td>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// SlotGroupCell — isi 1 sel PG/SI/SO/ML utk 1 obat x 1 tanggal. Biasanya 1
// slot (bulatan kecil), tapi kolom ML bisa berisi >1 slot sekaligus
// (obat 5x1/6x1, slot ke-3 dst ditumpuk di sini — lihat getSlotGroups).
const SlotGroupCell: React.FC<{
  item: JadwalObatItem;
  tanggal: string;
  slotIndexes: number[];
  readOnly: boolean;
  openCell: OpenCellState;
  cellTanda: string;
  cellCatatan: string;
  savingCell: boolean;
  onOpenCell: (item: JadwalObatItem, tanggal: string, slotIndex: number) => void;
  onCloseCell: () => void;
  onChangeTanda: (v: string) => void;
  onChangeCatatan: (v: string) => void;
  onSaveCell: () => void;
  onDeleteCell: () => void;
}> = ({ item, tanggal, slotIndexes, readOnly, openCell, cellTanda, cellCatatan, savingCell, onOpenCell, onCloseCell, onChangeTanda, onChangeCatatan, onSaveCell, onDeleteCell }) => {
  if (slotIndexes.length === 0) {
    return <span style={{ color: '#e5e7eb' }}>–</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
      {slotIndexes.map((slotIndex) => {
        const jam = item.jam_list[slotIndex];
        const cell = item.tanda[tanggal]?.[String(slotIndex)];
        const isOpen = openCell?.itemId === item.id && openCell?.tanggal === tanggal && openCell?.slotIndex === slotIndex;

        return (
          <SlotButton
            key={slotIndex}
            jam={jam}
            cell={cell}
            readOnly={readOnly}
            isOpen={isOpen}
            cellTanda={cellTanda}
            cellCatatan={cellCatatan}
            savingCell={savingCell}
            onOpen={() => onOpenCell(item, tanggal, slotIndex)}
            onClose={onCloseCell}
            onChangeTanda={onChangeTanda}
            onChangeCatatan={onChangeCatatan}
            onSaveCell={onSaveCell}
            onDeleteCell={onDeleteCell}
          />
        );
      })}
    </div>
  );
};

// SlotButton — tombol bulat kecil 1 slot + popover tandai V/T/K/A. Popover
// di-portal ke document.body (position:fixed, posisi dihitung dari
// getBoundingClientRect tombolnya) supaya TIDAK terpotong oleh
// overflow-x:auto pembungkus tabel (yg otomatis clip overflow-y jg).
const SlotButton: React.FC<{
  jam: string;
  cell: TandaCell | undefined;
  readOnly: boolean;
  isOpen: boolean;
  cellTanda: string;
  cellCatatan: string;
  savingCell: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeTanda: (v: string) => void;
  onChangeCatatan: (v: string) => void;
  onSaveCell: () => void;
  onDeleteCell: () => void;
}> = ({ jam, cell, readOnly, isOpen, cellTanda, cellCatatan, savingCell, onOpen, onClose, onChangeTanda, onChangeCatatan, onSaveCell, onDeleteCell }) => {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const info = cell ? TANDA_INFO[cell.tanda] : null;

  React.useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const popoverWidth = 220;
    const popoverHeightEstimate = 160;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
    // Kalau ruang di bawah tombol tidak cukup (dekat tepi bawah layar),
    // tampilkan popover di ATAS tombol — itulah biang keroknya kepotong.
    let top = rect.bottom + 4;
    if (top + popoverHeightEstimate > window.innerHeight) {
      top = rect.top - popoverHeightEstimate - 4;
    }
    setPos({ top, left });
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        disabled={readOnly}
        title={jam + (cell ? ` — ${TANDA_INFO[cell.tanda]?.label || ''}` : '')}
        onClick={() => (isOpen ? onClose() : onOpen())}
        style={{
          width: 16, height: 16, borderRadius: 0, cursor: readOnly ? 'default' : 'pointer', padding: 0,
          border: info ? '1px solid ' + info.color : '1px dashed #e5e7eb',
          background: info ? info.bg : 'transparent',
          color: info ? info.color : '#d1d5db',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 400,
        }}
      >
        {cell ? <TandaSymbol tanda={cell.tanda} color={info ? info.color : '#374151'} size={10} /> : ''}
      </button>

      {isOpen && !readOnly && pos && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 12, width: 220, textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{jam} — Tandai:</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {Object.keys(TANDA_INFO).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onChangeTanda(k)}
                title={TANDA_INFO[k].label}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 0, cursor: 'pointer', fontSize: 12, fontWeight: 400,
                  border: '1px solid ' + (cellTanda === k ? TANDA_INFO[k].color : '#d1d5db'),
                  background: cellTanda === k ? TANDA_INFO[k].bg : '#fff',
                  color: cellTanda === k ? TANDA_INFO[k].color : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <TandaSymbol tanda={k} color={cellTanda === k ? TANDA_INFO[k].color : '#9ca3af'} />
              </button>
            ))}
          </div>
          <input
            type="text"
            value={cellCatatan}
            onChange={(e) => onChangeCatatan(e.target.value)}
            placeholder="Catatan (opsional)"
            style={{ width: '100%', padding: '5px 8px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 11, boxSizing: 'border-box', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onSaveCell}
              disabled={!cellTanda || savingCell}
              style={{ flex: 1, padding: '6px 0', borderRadius: 0, border: 'none', background: !cellTanda || savingCell ? '#9ca3af' : '#2563eb', color: '#fff', cursor: !cellTanda || savingCell ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 400 }}
            >
              Simpan
            </button>
            {cell && (
              <button
                type="button"
                onClick={onDeleteCell}
                disabled={savingCell}
                style={{ padding: '6px 10px', borderRadius: 0, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}
              >
                Hapus
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '6px 10px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 11 }}
            >
              Batal
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
