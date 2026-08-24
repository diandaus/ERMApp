import React from 'react';
import { mediaUrl } from '../utils/apiBase';

type RekapRow = {
  nik: string; nama: string; tanggal: string; shift: string;
  jam_datang: string; jam_pulang: string; status: string;
  keterlambatan: string; durasi: string;
  foto_masuk: string; foto_pulang: string;
};

// Baris lama (mesin fingerprint Khanza / migrasi desktop) bisa berisi path
// legacy yang bukan URL (lihat komentar resolvePegawaiID di
// presensi_handler.go) — cuma dianggap bisa ditampilkan kalau sudah berupa
// URL upload baru (/uploads/...) atau http/https, sama pola isUsablePhotoUrl
// di PresensiMobile.tsx.
function isUsablePhotoUrl(photo: string): boolean {
  return !!photo && (photo.startsWith('/uploads/') || photo.startsWith('http://') || photo.startsWith('https://'));
}

const FotoThumb: React.FC<{ photo: string; label: string; onClick: () => void }> = ({ photo, label, onClick }) => {
  if (!isUsablePhotoUrl(photo)) return <span style={{ color: '#9ca3af' }}>-</span>;
  return (
    <img
      src={mediaUrl(photo)}
      alt={label}
      title={`Lihat ${label}`}
      onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid #d1d5db', cursor: 'pointer' }}
    />
  );
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getStatusStyle = (status: string) => {
  const base = status.replace(' & PSW', '');
  switch (base) {
    case 'Tepat Waktu':          return { bg: '#dcfce7', color: '#166534' };
    case 'Terlambat Toleransi':  return { bg: '#fef9c3', color: '#854d0e' };
    case 'Terlambat I':          return { bg: '#ffedd5', color: '#9a3412' };
    case 'Terlambat II':         return { bg: '#fee2e2', color: '#991b1b' };
    default:                     return { bg: '#f3f4f6', color: '#374151' };
  }
};

const filterInputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
};

// Presensi Mandiri (self check-in/out lewat HP, lihat backend/presensi_handler.go)
// — beda dari alur mesin fingerprint Khanza. Rekap ini menampilkan semua
// pegawai dalam rentang tanggal, dipakai HRD di desktop; UI mobile (Home/
// Absen/Kehadiran) ada di PresensiMobile.tsx.
export const PresensiRekapView: React.FC = () => {
  const [tanggalAwal, setTanggalAwal] = React.useState(todayStr());
  const [tanggalAkhir, setTanggalAkhir] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [list, setList] = React.useState<RekapRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{ url: string; label: string } | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('tanggal_awal', tanggalAwal);
      params.set('tanggal_akhir', tanggalAkhir);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/presensi/rekap?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data rekap presensi');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tanggalAwal, tanggalAkhir, searchText]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={tanggalAwal} onChange={e => setTanggalAwal(e.target.value)} style={filterInputStyle} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s/d</span>
          <input type="date" value={tanggalAkhir} onChange={e => setTanggalAkhir(e.target.value)} style={filterInputStyle} />
        </div>
        <input
          type="text"
          placeholder="Cari NIK / nama..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, width: 220, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              {['NIK', 'Nama', 'Tanggal', 'Shift', 'Jam Datang', 'Foto Masuk', 'Jam Pulang', 'Foto Pulang', 'Status', 'Keterlambatan', 'Durasi'].map((h) => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Tidak ada data presensi pada rentang tanggal ini</td></tr>
            ) : (
              list.map((r, index) => {
                const st = getStatusStyle(r.status);
                const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                return (
                  <tr key={`${r.nik}-${r.tanggal}-${r.jam_datang}`} style={{ background: baseBg }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4338ca', whiteSpace: 'nowrap' }}>{r.nik}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nama}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.shift || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.jam_datang || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <FotoThumb photo={r.foto_masuk} label={`Foto Masuk — ${r.nama} (${r.tanggal})`} onClick={() => setPreview({ url: r.foto_masuk, label: `Foto Masuk — ${r.nama} (${r.tanggal} ${r.jam_datang})` })} />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.jam_pulang || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <FotoThumb photo={r.foto_pulang} label={`Foto Pulang — ${r.nama} (${r.tanggal})`} onClick={() => setPreview({ url: r.foto_pulang, label: `Foto Pulang — ${r.nama} (${r.tanggal} ${r.jam_pulang})` })} />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: st.bg, color: st.color }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.keterlambatan || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{r.durasi || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {list.length} catatan presensi
        </div>
      )}

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 12, maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{preview.label}</span>
              <button
                type="button" onClick={() => setPreview(null)}
                style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >&times;</button>
            </div>
            <img src={mediaUrl(preview.url)} alt={preview.label} style={{ maxWidth: '88vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </section>
  );
};
