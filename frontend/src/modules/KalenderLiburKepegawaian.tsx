import React from 'react';
import Swal from 'sweetalert2';

type HariLiburRow = {
  id: number;
  tanggal: string;
  keterangan: string;
  jenis: 'nasional' | 'cuti_bersama' | 'perusahaan';
};

const JENIS_STYLE: Record<HariLiburRow['jenis'], { bg: string; color: string; label: string }> = {
  nasional: { bg: '#dbeafe', color: '#1d4ed8', label: 'Nasional' },
  cuti_bersama: { bg: '#fef9c3', color: '#854d0e', label: 'Cuti Bersama' },
  perusahaan: { bg: '#e0e7ff', color: '#4338ca', label: 'Perusahaan' },
};

const iStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const lStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, marginBottom: 3, color: '#374151', fontWeight: 500,
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const formatTanggalPanjang = (tgl: string) => {
  const d = new Date(tgl + 'T00:00:00');
  if (isNaN(d.getTime())) return tgl;
  return `${HARI_INDO[d.getDay()]}, ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
};

type FormState = { tanggal: string; keterangan: string };
const EMPTY_FORM: FormState = { tanggal: todayStr(), keterangan: '' };

// Kalender Libur (Kepegawaian) — hari libur nasional/cuti bersama
// disinkron otomatis dari sumber resmi (tombol "Sinkron Nasional",
// lihat backend/hari_libur_handler.go), sedangkan libur perusahaan
// (cuti bersama internal, anniversary kantor, dll) ditambahkan manual
// di sini lewat "Tambah Libur Perusahaan". Efeknya otomatis ke jadwal
// kerja HANYA utk pegawai shift reguler (hari_aktif persis Senin-Jumat)
// — staf shift/rotasi (mis. IGD) tidak terpengaruh, tetap masuk sesuai
// jadwalnya. Data yang sama juga dipakai tab Jadwal di aplikasi
// Presensi Mandiri (web & Flutter) utk menandai "tanggal merah".
export const KalenderLiburKepegawaianView: React.FC = () => {
  const [tahun, setTahun] = React.useState(new Date().getFullYear());
  const [list, setList] = React.useState<HariLiburRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hari-libur?tahun=${tahun}`);
      if (!res.ok) throw new Error('Gagal mengambil data hari libur');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tahun]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const openTambah = () => {
    setForm({ tanggal: `${tahun}-01-01`, keterangan: '' });
    setShowModal(true);
  };

  const handleSinkronNasional = async () => {
    const result = await Swal.fire({
      icon: 'question',
      title: `Sinkron Hari Libur Nasional ${tahun}?`,
      text: 'Tarik daftar hari libur nasional & cuti bersama dari sumber resmi pemerintah. Libur perusahaan yang sudah ditambahkan manual tidak akan berubah.',
      showCancelButton: true,
      confirmButtonColor: '#4338ca',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Sinkron',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/hari-libur/sync?tahun=${tahun}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyinkron hari libur');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: `${data.jumlah ?? 0} hari libur tahun ${tahun} disinkron`, confirmButtonColor: '#4338ca', timer: 1800, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tanggal || !form.keterangan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Tanggal dan keterangan wajib diisi', confirmButtonColor: '#4338ca' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/hari-libur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: form.tanggal, keterangan: form.keterangan.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan libur perusahaan');
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Libur perusahaan ditambahkan', confirmButtonColor: '#4338ca', timer: 1500, showConfirmButton: false });
      setShowModal(false);
      const tahunBaru = Number(form.tanggal.slice(0, 4));
      if (tahunBaru !== tahun) setTahun(tahunBaru); else fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (row: HariLiburRow) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Hari Libur?',
      html: `<strong>${formatTanggalPanjang(row.tanggal)}</strong><br/>${row.keterangan} akan dihapus.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/hari-libur/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus hari libur');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Hari libur dihapus', confirmButtonColor: '#4338ca', timer: 1200, showConfirmButton: false });
      fetchList();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#4338ca' });
    }
  };

  const tahunOpsi = React.useMemo(() => {
    const now = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = now - 1; y <= now + 2; y++) arr.push(y);
    if (!arr.includes(tahun)) arr.push(tahun);
    return arr.sort((a, b) => a - b);
  }, [tahun]);

  return (<>
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 8, padding: '8px 12px', marginBottom: 12, flexShrink: 0 }}>
        Hari libur di sini otomatis membuat pegawai dengan jam kerja reguler (Senin–Jumat) libur di tanggal tersebut. Staf shift/rotasi (mis. IGD) tidak terpengaruh dan tetap masuk sesuai jadwalnya.
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#374151' }}>Tahun</label>
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} style={{ ...iStyle, width: 'auto', padding: '5px 10px' }}>
            {tahunOpsi.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleSinkronNasional}
            disabled={syncing}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid #4338ca',
              background: '#fff', color: '#4338ca', fontSize: 12, fontWeight: 500, cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {syncing ? 'Menyinkron...' : 'Sinkron Nasional'}
          </button>
          <button
            type="button"
            onClick={openTambah}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#4338ca', color: '#ffffff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Libur Perusahaan
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['Tanggal', 'Keterangan', 'Jenis', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada hari libur tahun {tahun}. Klik "Sinkron Nasional" atau "Tambah Libur Perusahaan".</td></tr>
            ) : (
              list.map((row, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const jst = JENIS_STYLE[row.jenis] || JENIS_STYLE.perusahaan;
                return (
                  <tr key={row.id} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {formatTanggalPanjang(row.tanggal)}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{row.keterangan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: jst.bg, color: jst.color }}>
                        {jst.label}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleHapus(row)}
                        title="Hapus"
                        style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="15" height="15" viewBox="0 0 24 24">
                          <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
                        </svg>
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
          {list.length} hari libur
        </div>
      )}
    </section>

    {showModal && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        onClick={() => setShowModal(false)}
      >
        <div
          style={{ background: '#f9fafb', borderRadius: 16, padding: '40px 8px 8px', position: 'relative', width: '95%', maxWidth: 460, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Tambah Libur Perusahaan</span>
            <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            <form onSubmit={handleSimpan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  Contoh: cuti bersama internal, HUT/anniversary kantor. Hanya berlaku utk pegawai berjam kerja reguler (Senin–Jumat).
                </div>
                <div>
                  <label style={lStyle}>Tanggal <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} style={iStyle} />
                </div>
                <div>
                  <label style={lStyle}>Keterangan <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={form.keterangan} onChange={e => setForm(p => ({ ...p, keterangan: e.target.value }))} placeholder="mis. Cuti Bersama HUT Rumah Sakit" maxLength={200} style={iStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#a5b4fc' : '#4338ca', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
  </>);
};
