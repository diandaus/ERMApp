import React from 'react';

type RekapRow = {
  nik: string; nama: string; departemen: string;
  hadir: number; pagi: number; siang: number; malam: number;
  tepat_waktu: number; toleransi: number; terlambat_1: number; terlambat_2: number;
  keterlambatan: string; durasi: string; wajib_masuk: number; persen_hadir: number;
};

type SttsKerjaOpsi = { kode: string; nama: string };

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' }, { value: '03', label: 'Maret' },
  { value: '04', label: 'April' }, { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' }, { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

const now = new Date();
const TAHUN_OPTIONS = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - 2 + i));

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

const persenStyle = (persen: number) => {
  if (persen >= 90) return { bg: '#dcfce7', color: '#166534' };
  if (persen >= 75) return { bg: '#fef9c3', color: '#854d0e' };
  return { bg: '#fee2e2', color: '#991b1b' };
};

// Rekap Kehadiran (Kepegawaian) — laporan agregat BULANAN per pegawai,
// padanan kepegawaian/DlgKehadiran.java. Beda dari tab Presensi (log
// harian mentah): di sini satu baris = satu pegawai, merangkum seluruh
// bulan (total hadir, breakdown shift, breakdown keterlambatan, total
// jam telat/kerja, wajib masuk, % kehadiran).
export const RekapKehadiranView: React.FC = () => {
  const [tahun, setTahun] = React.useState(String(now.getFullYear()));
  const [bulan, setBulan] = React.useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [departemen, setDepartemen] = React.useState('');
  const [departemenList, setDepartemenList] = React.useState<string[]>([]);
  const [sttsKerja, setSttsKerja] = React.useState('');
  const [sttsKerjaList, setSttsKerjaList] = React.useState<SttsKerjaOpsi[]>([]);
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<RekapRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/pegawai/departemen').then(r => r.json()).then(d => setDepartemenList(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/pegawai/master').then(r => r.json()).then(d => setSttsKerjaList(Array.isArray(d?.stts_kerja) ? d.stts_kerja : [])).catch(() => {});
  }, []);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('tahun', tahun);
      params.set('bulan', bulan);
      if (departemen) params.set('departemen', departemen);
      if (sttsKerja) params.set('stts_kerja', sttsKerja);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/rekap-kehadiran/list?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data rekap kehadiran');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tahun, bulan, departemen, sttsKerja, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
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
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select value={sttsKerja} onChange={e => setSttsKerja(e.target.value)} style={filterSelectStyle}>
            <option value="">Semua Status Kerja</option>
            {sttsKerjaList.map(s => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
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

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['NIP', 'Nama', 'Departemen', 'Kehadiran', 'Pagi', 'Siang', 'Malam', 'Tepat Waktu', 'Toleransi', 'Terlambat I', 'Terlambat II', 'Keterlambatan', 'Durasi', 'Wajib Masuk', '% Hadir'].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data pegawai</td></tr>
            ) : (
              list.map((r, index) => {
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const st = persenStyle(r.persen_hadir);
                return (
                  <tr key={r.nik} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4338ca', whiteSpace: 'nowrap' }}>{r.nik}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nama}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.departemen || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', textAlign: 'center' }}>{r.hadir}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' }}>{r.pagi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' }}>{r.siang}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' }}>{r.malam}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#166534', textAlign: 'center' }}>{r.tepat_waktu}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#854d0e', textAlign: 'center' }}>{r.toleransi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#9a3412', textAlign: 'center' }}>{r.terlambat_1}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#991b1b', textAlign: 'center' }}>{r.terlambat_2}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.keterlambatan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.durasi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' }}>{r.wajib_masuk}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {Math.round(r.persen_hadir)}%
                      </span>
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
          {list.length} pegawai
        </div>
      )}
    </section>
  );
};
