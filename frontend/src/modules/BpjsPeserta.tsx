import React from 'react';
import { localDateStr } from '../utils/date';

type SearchMode = 'nokartu' | 'nik';

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

// Meratakan objek/array bertingkat jadi daftar baris "path : value" —
// dipakai supaya hasil respon BPJS tetap terbaca apa adanya walau bentuk
// nesting persisnya belum bisa diverifikasi tanpa kredensial/API asli.
function flattenRows(value: any, prefix = ''): { path: string; value: string }[] {
  if (value === null || value === undefined) return [{ path: prefix || '(kosong)', value: '-' }];
  if (typeof value !== 'object') return [{ path: prefix || '(nilai)', value: String(value) }];
  const rows: { path: string; value: string }[] = [];
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  for (const [key, val] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object') {
      rows.push(...flattenRows(val, path));
    } else {
      rows.push({ path, value: val === null || val === undefined ? '-' : String(val) });
    }
  }
  return rows;
}

// Beberapa kemungkinan lokasi field status peserta pada respon VClaim —
// dicoba satu-satu karena bentuk nesting persisnya belum diverifikasi live.
function findStatusPeserta(data: any): { kode?: string; keterangan?: string } | null {
  const candidates = [
    data?.peserta?.statusPeserta,
    data?.statusPeserta,
    data?.peserta?.status,
  ];
  for (const c of candidates) {
    if (c && (c.kode !== undefined || c.keterangan !== undefined)) return c;
  }
  return null;
}

export const BpjsPesertaView: React.FC = () => {
  const [mode, setMode] = React.useState<SearchMode>('nokartu');
  const [noKartu, setNoKartu] = React.useState('');
  const [nik, setNik] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const idValue = mode === 'nokartu' ? noKartu.trim() : nik.trim();
      if (!idValue) {
        throw new Error(mode === 'nokartu' ? 'No. Kartu wajib diisi' : 'NIK wajib diisi');
      }
      // BPJS mensyaratkan parameter tanggal pada endpoint ini, tapi konteksnya
      // cuma pengecekan status kepesertaan (bukan pembuatan SEP) — jadi
      // dipakai tanggal hari ini secara otomatis, tidak ditanyakan ke user.
      const tglCek = localDateStr();
      const url = mode === 'nokartu'
        ? `/api/bridging/peserta/nokartu/${encodeURIComponent(idValue)}?tgl_sep=${tglCek}`
        : `/api/bridging/peserta/nik/${encodeURIComponent(idValue)}?tgl_sep=${tglCek}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pencarian peserta gagal');
      setResult(data.peserta ?? data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const status = result ? findStatusPeserta(result) : null;
  const isAktif = status?.kode === '0' || /aktif/i.test(status?.keterangan || '') && !/non\s*aktif/i.test(status?.keterangan || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toggle mode pencarian */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setMode('nokartu')}
          style={{
            padding: '6px 20px', borderRadius: 8,
            border: mode === 'nokartu' ? '1px solid #2563eb' : '1px solid transparent',
            background: mode === 'nokartu' ? '#ffffff' : 'transparent',
            color: mode === 'nokartu' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: 13, fontWeight: mode === 'nokartu' ? 600 : 400,
          }}
        >
          Nomor Kartu
        </button>
        <button
          type="button"
          onClick={() => setMode('nik')}
          style={{
            padding: '6px 20px', borderRadius: 8,
            border: mode === 'nik' ? '1px solid #2563eb' : '1px solid transparent',
            background: mode === 'nik' ? '#ffffff' : 'transparent',
            color: mode === 'nik' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: 13, fontWeight: mode === 'nik' ? 600 : 400,
          }}
        >
          NIK
        </button>
      </div>

      {/* Form pencarian */}
      <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            {mode === 'nokartu' ? 'No. Kartu BPJS' : 'NIK'}
          </label>
          <input
            style={{ ...inputStyle, width: 260 }}
            value={mode === 'nokartu' ? noKartu : nik}
            onChange={(e) => (mode === 'nokartu' ? setNoKartu(e.target.value) : setNik(e.target.value))}
            placeholder={mode === 'nokartu' ? '0001234567890' : '3201xxxxxxxxxxxx'}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflow: 'auto' }}>
          {status && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: isAktif ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${isAktif ? '#86efac' : '#fecaca'}`,
                color: isAktif ? '#166534' : '#991b1b',
              }}
            >
              Status Peserta: {status.keterangan || (isAktif ? 'Aktif' : 'Non Aktif')}
            </div>
          )}

          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {flattenRows(result).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '35%' }}>{row.path}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
