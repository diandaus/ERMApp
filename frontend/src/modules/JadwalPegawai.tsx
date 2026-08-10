import React from 'react';
import Swal from 'sweetalert2';
import { ModalPilihShift } from '../components/ModalPilihShift';

type JadwalRow = {
  id: number; nik: string; nama: string; pendidikan: string; departemen: string;
  jadwal_tetap_shift: string;
  jadwal_tetap_hari: string; // CSV nomor hari ISO (1=Senin..7=Minggu), kosong kalau tak ada jadwal tetap
  h: string[]; // 31 elemen, index 0 = tanggal 1 — override eksplisit, kosong = ikut jadwal tetap
};

type JamMasukOpsi = { shift: string; jam_masuk: string; jam_pulang: string };

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' }, { value: '03', label: 'Maret' },
  { value: '04', label: 'April' }, { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' }, { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

// Index 0 = Minggu (matching Date.getDay()), dipakai utk header grid.
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Hari ISO 1..7 (Senin..Minggu), dipakai utk toggle "hari aktif" jadwal
// tetap — beda urutan dari HARI_SINGKAT krn ISO mulai dari Senin.
const HARI_ISO = [
  { iso: 1, label: 'Sen' }, { iso: 2, label: 'Sel' }, { iso: 3, label: 'Rab' }, { iso: 4, label: 'Kam' },
  { iso: 5, label: 'Jum' }, { iso: 6, label: 'Sab' }, { iso: 7, label: 'Min' },
];

const now = new Date();
const TAHUN_OPTIONS = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - 2 + i));

function jumlahHariDiBulan(tahun: string, bulan: string): number {
  return new Date(Number(tahun), Number(bulan), 0).getDate();
}

// Date.getDay() JS: 0=Minggu..6=Sabtu -> ISO 1=Senin..7=Minggu.
function isoWeekday(d: Date): number {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 18, height: 18, borderRadius: '50%', background: '#4338ca',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const filterSelectStyle: React.CSSProperties = {
  padding: '6px 28px 6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 12, outline: 'none', background: '#ffffff', appearance: 'none',
  WebkitAppearance: 'none', cursor: 'pointer',
};

function formatHariAktif(csv: string): string {
  if (!csv) return '';
  const set = new Set(csv.split(',').map(Number));
  if (HARI_ISO.every(h => set.has(h.iso))) return '7 hari';
  if ([1, 2, 3, 4, 5].every(v => set.has(v)) && set.size === 5) return 'Sen-Jum';
  return HARI_ISO.filter(h => set.has(h.iso)).map(h => h.label).join(',');
}

// Jadwal Pegawai (Kepegawaian) — grid shift bulanan, padanan
// kepegawaian/DlgJadwalPegawai.java, DITAMBAH konsep "Jadwal Tetap"
// (fitur baru ERMApp, di luar Khanza): HRD set shift + hari aktif
// berulang per pegawai sekali (mis. staf IGD -> Pagi/Malam 7 hari, staf
// kantor -> 08:00-17:00 Senin-Jumat saja), berlaku otomatis tiap minggu
// tanpa perlu isi grid tiap bulan. Grid di bawah cuma dipakai utk
// PENGECUALIAN (override hari tertentu — tukar shift, dll); sel yang
// tidak diisi otomatis mengikuti Jadwal Tetap SELAMA hari itu termasuk
// hari aktifnya (di luar itu = libur). Backend: getShiftHariIni di
// presensi_handler.go, lihat jadwal_pegawai_handler.go utk
// pegawai_jadwal_tetap.
export const JadwalPegawaiView: React.FC = () => {
  const [tahun, setTahun] = React.useState(String(now.getFullYear()));
  const [bulan, setBulan] = React.useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [departemen, setDepartemen] = React.useState('');
  const [departemenList, setDepartemenList] = React.useState<string[]>([]);
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<JadwalRow[]>([]);
  const [jamMasukOpsi, setJamMasukOpsi] = React.useState<JamMasukOpsi[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [bulkShift, setBulkShift] = React.useState('');
  const [bulkHari, setBulkHari] = React.useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [applyingBulk, setApplyingBulk] = React.useState(false);
  const [showPilihShift, setShowPilihShift] = React.useState(false);

  const jumlahHari = jumlahHariDiBulan(tahun, bulan);

  const fetchJamMasukOpsi = React.useCallback(() => {
    fetch('/api/jam-masuk/opsi').then(r => r.json()).then(d => setJamMasukOpsi(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch('/api/pegawai/departemen').then(r => r.json()).then(d => setDepartemenList(Array.isArray(d) ? d : [])).catch(() => {});
    fetchJamMasukOpsi();
  }, [fetchJamMasukOpsi]);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('tahun', tahun);
      params.set('bulan', bulan);
      if (departemen) params.set('departemen', departemen);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/jadwal-pegawai/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data jadwal pegawai');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
      setDirty(false);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tahun, bulan, departemen, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const handleSetShift = (rowId: number, dayIndex: number, value: string) => {
    setList(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const h = [...r.h];
      h[dayIndex] = value;
      return { ...r, h };
    }));
    setDirty(true);
  };

  const handleSimpanSemua = async () => {
    if (list.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/jadwal-pegawai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahun, bulan,
          rows: list.map(r => ({ id: r.id, h: r.h })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal berhasil disimpan', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      setDirty(false);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSaving(false);
    }
  };

  const handleHapusBaris = async (row: JadwalRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Kosongkan Override?',
      html: `Semua override tanggal tertentu utk <strong>${row.nama}</strong> bulan ${BULAN_OPTIONS.find(b => b.value === bulan)?.label} ${tahun} akan dihapus (kembali mengikuti Jadwal Tetap).`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Kosongkan',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/jadwal-pegawai/${row.id}?tahun=${tahun}&bulan=${bulan}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus jadwal');
      setList(prev => prev.map(r => r.id === row.id ? { ...r, h: Array(31).fill('') } : r));
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Override dikosongkan', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === list.length ? new Set() : new Set(list.map(r => r.id)));
  };

  const toggleBulkHari = (iso: number) => {
    setBulkHari(prev => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };

  const handleTerapkanBulk = async () => {
    if (selectedIds.size === 0 || !bulkShift || bulkHari.size === 0) return;
    setApplyingBulk(true);
    try {
      const res = await fetch('/api/pegawai-jadwal-tetap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), shift: bulkShift, hari_aktif: Array.from(bulkHari) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan jadwal tetap');
      const hariCSV = Array.from(bulkHari).sort((a, b) => a - b).join(',');
      setList(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, jadwal_tetap_shift: bulkShift, jadwal_tetap_hari: hariCSV } : r));
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, confirmButtonColor: '#4338ca', timer: 1800, showConfirmButton: false });
      setSelectedIds(new Set());
      setBulkShift('');
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleHapusJadwalTetapBulk = async () => {
    if (selectedIds.size === 0) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Jadwal Tetap?',
      text: `Jadwal tetap utk ${selectedIds.size} pegawai terpilih akan dihapus (jadwal harian jadi kosong kecuali diisi manual).`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/pegawai-jadwal-tetap/${id}`, { method: 'DELETE' })));
      setList(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, jadwal_tetap_shift: '', jadwal_tetap_hari: '' } : r));
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal tetap dihapus', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      setSelectedIds(new Set());
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const dayColumns = Array.from({ length: jumlahHari }, (_, i) => i);

  return (<>
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <select value={tahun} onChange={e => setTahun(e.target.value)} style={filterSelectStyle}>
              {TAHUN_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <StepperIcon />
          </div>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <select value={bulan} onChange={e => setBulan(e.target.value)} style={filterSelectStyle}>
              {BULAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <StepperIcon />
          </div>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <select value={departemen} onChange={e => setDepartemen(e.target.value)} style={filterSelectStyle}>
              <option value="">Semua Departemen</option>
              {departemenList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <StepperIcon />
          </div>
          <input
            type="text"
            placeholder="Cari NIK / nama..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 200, outline: 'none' }}
          />
        </div>

        <button
          type="button"
          onClick={handleSimpanSemua}
          disabled={saving || !dirty}
          style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: !dirty ? '#d1d5db' : saving ? '#a5b4fc' : '#4338ca',
            color: '#ffffff', fontSize: 12, fontWeight: 500,
            cursor: saving || !dirty ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan Grid'}
        </button>
      </div>

      {/* Bulk-assign Jadwal Tetap */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0,
        padding: '10px 12px', borderRadius: 10, background: selectedIds.size > 0 ? '#eef2ff' : '#f9fafb',
        border: selectedIds.size > 0 ? '1px solid #c7d2fe' : '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {selectedIds.size > 0 ? `${selectedIds.size} pegawai dipilih` : 'Centang pegawai di tabel untuk atur Jadwal Tetap'}
        </span>
        <button
          type="button"
          onClick={() => setShowPilihShift(true)}
          disabled={selectedIds.size === 0}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12,
            background: '#fff', color: bulkShift ? '#111827' : '#9ca3af', fontWeight: bulkShift ? 600 : 400,
            cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedIds.size === 0 ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {bulkShift || 'Pilih Shift...'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {HARI_ISO.map(h => (
            <button
              key={h.iso}
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => toggleBulkHari(h.iso)}
              style={{
                width: 30, height: 26, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                border: bulkHari.has(h.iso) ? '1px solid #059669' : '1px solid #d1d5db',
                background: bulkHari.has(h.iso) ? '#059669' : '#ffffff',
                color: bulkHari.has(h.iso) ? '#ffffff' : '#9ca3af',
                opacity: selectedIds.size === 0 ? 0.5 : 1,
              }}
            >
              {h.label}
            </button>
          ))}
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkHari(new Set([1, 2, 3, 4, 5]))}
            style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 10, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            Sen-Jum
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkHari(new Set([1, 2, 3, 4, 5, 6, 7]))}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 10, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            7 Hari
          </button>
        </div>

        <button
          type="button"
          onClick={handleTerapkanBulk}
          disabled={selectedIds.size === 0 || !bulkShift || bulkHari.size === 0 || applyingBulk}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
            background: selectedIds.size === 0 || !bulkShift || bulkHari.size === 0 ? '#d1d5db' : '#059669', color: '#fff',
            cursor: selectedIds.size === 0 || !bulkShift || bulkHari.size === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {applyingBulk ? 'Menerapkan...' : 'Terapkan Jadwal Tetap'}
        </button>
        <button
          type="button"
          onClick={handleHapusJadwalTetapBulk}
          disabled={selectedIds.size === 0}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, fontWeight: 500,
            background: '#fff', color: selectedIds.size === 0 ? '#d1d5db' : '#dc2626',
            cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Hapus Jadwal Tetap
        </button>
      </div>

      {/* Legenda shift */}
      {jamMasukOpsi.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, flexShrink: 0 }}>
          {jamMasukOpsi.map(j => (
            <span key={j.shift} title={`${j.jam_masuk.slice(0, 5)} - ${j.jam_pulang.slice(0, 5)}`} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', border: '1px solid #e0e7ff' }}>
              {j.shift}: {j.jam_masuk.slice(0, 5)}–{j.jam_pulang.slice(0, 5)}
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 2 }}>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: '#f3f4f6', zIndex: 3, padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', minWidth: 30 }}>
                <input type="checkbox" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th style={{ position: 'sticky', left: 30, background: '#f3f4f6', zIndex: 3, padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', minWidth: 160 }}>Nama</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 85 }}>Departemen</th>
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 100 }}>Jadwal Tetap</th>
              {dayColumns.map(i => {
                const tgl = new Date(Number(tahun), Number(bulan) - 1, i + 1);
                return (
                  <th key={i} style={{ padding: '4px 2px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', minWidth: 62 }}>
                    <div>{i + 1}</div>
                    <div style={{ fontWeight: 400, color: '#9ca3af', fontSize: 9 }}>{HARI_SINGKAT[tgl.getDay()]}</div>
                  </th>
                );
              })}
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', minWidth: 70 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={dayColumns.length + 5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={dayColumns.length + 5} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={dayColumns.length + 5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data pegawai</td></tr>
            ) : (
              list.map((row, rowIndex) => {
                const baseBg = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
                const checked = selectedIds.has(row.id);
                const hariAktifSet = new Set(row.jadwal_tetap_hari ? row.jadwal_tetap_hari.split(',').map(Number) : []);
                return (
                  <tr key={row.id}>
                    <td style={{ position: 'sticky', left: 0, background: checked ? '#eef2ff' : baseBg, zIndex: 1, padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(row.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ position: 'sticky', left: 30, background: checked ? '#eef2ff' : baseBg, zIndex: 1, padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                      {row.nama}
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>{row.nik}</div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', background: baseBg }}>{row.departemen || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', background: baseBg }}>
                      {row.jadwal_tetap_shift ? (
                        <span title={formatHariAktif(row.jadwal_tetap_hari)} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#d1fae5', color: '#047857', whiteSpace: 'nowrap' }}>
                          {row.jadwal_tetap_shift} · {formatHariAktif(row.jadwal_tetap_hari)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#d1d5db' }}>-</span>
                      )}
                    </td>
                    {dayColumns.map(i => {
                      const override = row.h[i] || '';
                      const isOverride = override !== '';
                      const tglSel = new Date(Number(tahun), Number(bulan) - 1, i + 1);
                      const hariBerlaku = row.jadwal_tetap_shift !== '' && hariAktifSet.has(isoWeekday(tglSel));
                      const effective = isOverride ? override : (hariBerlaku ? row.jadwal_tetap_shift : '');
                      const placeholderLabel = isOverride ? '-' : hariBerlaku ? `Tetap (${row.jadwal_tetap_shift})` : row.jadwal_tetap_shift ? 'Libur' : '-';
                      return (
                        <td key={i} style={{ padding: 2, borderBottom: '1px solid #e5e7eb', textAlign: 'center', background: baseBg }}>
                          <select
                            value={override}
                            onChange={e => handleSetShift(row.id, i, e.target.value)}
                            title={isOverride ? 'Override manual utk tanggal ini' : hariBerlaku ? `Mengikuti Jadwal Tetap (${row.jadwal_tetap_shift})` : row.jadwal_tetap_shift ? 'Libur (di luar hari aktif jadwal tetap)' : 'Tidak ada jadwal'}
                            style={{
                              width: '100%', fontSize: 10, padding: '4px 2px', borderRadius: 6, textAlign: 'center',
                              border: isOverride ? '1px solid #c7d2fe' : effective ? '1px dashed #a7f3d0' : '1px solid #e5e7eb',
                              background: isOverride ? '#eef2ff' : effective ? '#f0fdf4' : '#ffffff',
                              color: isOverride ? '#4338ca' : effective ? '#059669' : '#9ca3af',
                              cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value="">{placeholderLabel}</option>
                            {jamMasukOpsi.map(j => <option key={j.shift} value={j.shift}>{j.shift}</option>)}
                          </select>
                        </td>
                      );
                    })}
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', background: baseBg }}>
                      <button
                        type="button"
                        onClick={() => handleHapusBaris(row)}
                        title="Kosongkan override tanggal tertentu bulan ini"
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Kosongkan
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {list.length} pegawai{dirty && <span style={{ color: '#dc2626', marginLeft: 8 }}>• Ada perubahan grid belum disimpan</span>}
        </div>
      )}
    </section>

    <ModalPilihShift
      isOpen={showPilihShift}
      onClose={() => { setShowPilihShift(false); fetchJamMasukOpsi(); }}
      onSelect={(shift) => setBulkShift(shift)}
    />
  </>);
};
