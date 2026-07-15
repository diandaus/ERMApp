import React from 'react';

type Jenis = '1' | '2';
type Mode = 'rujukan' | 'kartu';

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

// Meratakan hasil (objek/array bertingkat) jadi baris path:value — bentuk
// respons persis rujukan VClaim belum diverifikasi tanpa kredensial asli.
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

// Mencoba beberapa kemungkinan lokasi field tanggal rujukan / DPJP pada
// respons — bentuk nesting persisnya belum diverifikasi tanpa kredensial asli.
function findField(data: any, paths: string[]): string {
  for (const p of paths) {
    const val = p.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), data);
    if (val !== undefined && val !== null && val !== '') return String(val);
  }
  return '';
}

const parseTgl = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const BpjsRujukanView: React.FC = () => {
  const [jenis, setJenis] = React.useState<Jenis>('1');
  const [mode, setMode] = React.useState<Mode>('rujukan');
  const [idValue, setIdValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (!idValue.trim()) {
        throw new Error(mode === 'rujukan' ? 'No. Rujukan wajib diisi' : 'No. Kartu wajib diisi');
      }
      const url = `/api/bridging/rujukan/${encodeURIComponent(idValue.trim())}?jenis=${jenis}&mode=${mode}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pencarian rujukan gagal');
      setResult(data.rujukan ?? data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const tglRujukanStr = result ? findField(result, ['rujukan.tglRujukan', 'tglRujukan', 'rujukan.tglKunjungan']) : '';
  const tglRujukan = parseTgl(tglRujukanStr);
  const lebih90Hari = tglRujukan ? (Date.now() - tglRujukan.getTime()) / (1000 * 60 * 60 * 24) > 90 : false;

  const dpjp = result ? findField(result, ['rujukan.peserta.dpjp', 'rujukan.dpjp', 'dpjp', 'rujukan.namaDokter']) : '';
  const dpjpKosong = result ? !dpjp : false;

  const poliTujuan = result ? findField(result, ['rujukan.poliRujukan.nama', 'rujukan.poliTujuan', 'poliTujuan']) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toggle Faskes I / II */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setJenis('1')}
          style={{
            padding: '6px 20px', borderRadius: 8,
            border: jenis === '1' ? '1px solid #2563eb' : '1px solid transparent',
            background: jenis === '1' ? '#ffffff' : 'transparent',
            color: jenis === '1' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: 13, fontWeight: jenis === '1' ? 600 : 400,
          }}
        >
          Rujukan Faskes I
        </button>
        <button
          type="button"
          onClick={() => setJenis('2')}
          style={{
            padding: '6px 20px', borderRadius: 8,
            border: jenis === '2' ? '1px solid #2563eb' : '1px solid transparent',
            background: jenis === '2' ? '#ffffff' : 'transparent',
            color: jenis === '2' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: 13, fontWeight: jenis === '2' ? 600 : 400,
          }}
        >
          Rujukan Faskes II
        </button>
      </div>

      {/* Toggle cara pencarian */}
      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="radio" checked={mode === 'rujukan'} onChange={() => setMode('rujukan')} />
          Berdasarkan No. Rujukan
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="radio" checked={mode === 'kartu'} onChange={() => setMode('kartu')} />
          Berdasarkan No. Kartu
        </label>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            {mode === 'rujukan' ? 'No. Rujukan' : 'No. Kartu BPJS'}
          </label>
          <input
            style={{ ...inputStyle, width: 260 }}
            value={idValue}
            onChange={(e) => setIdValue(e.target.value)}
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
          {lebih90Hari && (
            <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              ⚠ Rujukan lebih dari 90 hari — tidak dapat digunakan untuk membuat SEP
            </div>
          )}
          {dpjpKosong && (
            <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
              ⚠ DPJP kosong — wajib diisi sebelum membuat SEP
            </div>
          )}
          {poliTujuan && (
            <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
              Poli tujuan: <strong>{poliTujuan}</strong> — mengikuti rujukan online, tidak bisa diubah manual saat membuat SEP.
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

          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            No. Rujukan / No. Kartu ini bisa disalin ke form "Input SEP" pada tab SEP untuk membuat SEP dari rujukan ini.
          </div>
        </div>
      )}
    </div>
  );
};
