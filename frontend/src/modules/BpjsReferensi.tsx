import React from 'react';
import { localDateStr } from '../utils/date';

type ParamDef = { key: string; label: string; placeholder?: string };

type RefType = {
  key: string;
  label: string;
  params: ParamDef[];
  // Menyusun path (relatif terhadap "referensi/") dari nilai param yang diisi user.
  buildPath: (v: Record<string, string>) => string;
  defaults?: Record<string, string>;
  // Endpoint ini tidak menerima parameter keyword di URL (kembalikan daftar
  // penuh) — input "kw" di sini cuma dipakai untuk menyaring hasil di sisi
  // browser setelah data diambil, bukan dikirim ke BPJS.
  clientFilter?: boolean;
};

const REF_TYPES: RefType[] = [
  { key: 'diagnosa', label: 'Referensi Diagnosa', params: [{ key: 'kw', label: 'Masukan kata kunci' }], buildPath: (v) => `diagnosa/${v.kw}` },
  { key: 'dokter', label: 'Referensi Dokter', params: [{ key: 'kw', label: 'Masukan kata kunci' }], buildPath: (v) => `dokter/${v.kw}` },
  { key: 'poli', label: 'Referensi Poli', params: [{ key: 'kw', label: 'Masukan kata kunci' }], buildPath: (v) => `poli/${v.kw}` },
  {
    key: 'faskes1',
    label: 'Referensi Faskes I',
    params: [{ key: 'kw', label: 'Masukan kata kunci' }],
    buildPath: (v) => `faskes/1/${v.kw}`,
  },
  {
    key: 'faskes2',
    label: 'Referensi Faskes II',
    params: [{ key: 'kw', label: 'Masukan kata kunci' }],
    buildPath: (v) => `faskes/2/${v.kw}`,
  },
  { key: 'procedure', label: 'Referensi Procedure / Tindakan', params: [{ key: 'kw', label: 'Masukan kata kunci' }], buildPath: (v) => `procedure/${v.kw}` },
  { key: 'kelasrawat', label: 'Referensi Kelas Rawat', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `kelasrawat` },
  { key: 'ruangrawat', label: 'Referensi Ruang Rawat', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `ruangrawat` },
  { key: 'spesialistik', label: 'Referensi Spesialistik', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `spesialistik` },
  { key: 'carakeluar', label: 'Referensi Cara Keluar', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `carakeluar` },
  { key: 'pascapulang', label: 'Referensi Pasca Pulang', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `pascapulang` },
  { key: 'propinsi', label: 'Referensi Propinsi', params: [{ key: 'kw', label: 'Cari dalam hasil' }], clientFilter: true, buildPath: () => `propinsi` },
  { key: 'kabupaten', label: 'Referensi Dati II (Kabupaten)', params: [{ key: 'propinsi', label: 'Kode Propinsi' }], buildPath: (v) => `kabupaten/propinsi/${v.propinsi}` },
  { key: 'kecamatan', label: 'Referensi Kecamatan', params: [{ key: 'kabupaten', label: 'Kode Kabupaten' }], buildPath: (v) => `kecamatan/kabupaten/${v.kabupaten}` },
  {
    key: 'dpjp-rjtl',
    label: 'Referensi DPJP RJTL',
    params: [
      { key: 'tgl', label: 'Tgl Pelayanan' },
      { key: 'spesialis', label: 'Kode Spesialis' },
    ],
    defaults: { tgl: localDateStr() },
    buildPath: (v) => `dokter/pelayanan/1/tglPelayanan/${v.tgl}/Spesialis/${v.spesialis}`,
  },
  {
    key: 'dpjp-ritl',
    label: 'Referensi DPJP RITL',
    params: [
      { key: 'tgl', label: 'Tgl Pelayanan' },
      { key: 'spesialis', label: 'Kode Spesialis' },
    ],
    defaults: { tgl: localDateStr() },
    buildPath: (v) => `dokter/pelayanan/2/tglPelayanan/${v.tgl}/Spesialis/${v.spesialis}`,
  },
];

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

// Meratakan hasil (objek/array bertingkat) jadi baris path:value — bentuk
// respons persis referensi VClaim belum diverifikasi tanpa kredensial asli.
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

export const BpjsReferensiView: React.FC = () => {
  const [values, setValues] = React.useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    REF_TYPES.forEach((r) => { init[r.key] = { ...(r.defaults || {}) }; });
    return init;
  });
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activeRef, setActiveRef] = React.useState<RefType | null>(null);
  const [result, setResult] = React.useState<any>(null);

  // Error validasi input (kolom kosong) ditampilkan langsung di baris terkait,
  // dipisah dari `error` (kegagalan pemanggilan API) yang tampil di panel hasil.
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});

  const setFieldValue = (refKey: string, paramKey: string, val: string) => {
    setValues((prev) => ({ ...prev, [refKey]: { ...prev[refKey], [paramKey]: val } }));
  };

  const handleSearch = async (ref: RefType) => {
    const v = values[ref.key] || {};
    // Untuk endpoint clientFilter, kolom "kw" cuma penyaring lokal (opsional) —
    // tidak wajib diisi dan tidak dikirim sebagai parameter ke BPJS.
    const missing = ref.params.find((p) => !(ref.clientFilter && p.key === 'kw') && !v[p.key]?.trim());
    if (missing) {
      setRowErrors((prev) => ({ ...prev, [ref.key]: `${missing.label} wajib diisi` }));
      return;
    }
    setRowErrors((prev) => ({ ...prev, [ref.key]: '' }));

    setLoadingKey(ref.key);
    setError(null);
    setResult(null);
    setActiveRef(ref);
    try {
      const path = ref.buildPath(v);
      const res = await fetch(`/api/bridging/referensi/${path}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data referensi');
      setResult(data.data ?? data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoadingKey(null);
    }
  };

  const rawResultList: any[] | null = Array.isArray(result)
    ? result
    : Array.isArray(result?.[Object.keys(result || {})[0]])
      ? result[Object.keys(result)[0]]
      : null;

  // Penyaringan lokal untuk endpoint clientFilter — cek apakah kata kunci
  // muncul di salah satu nilai field pada tiap baris hasil.
  const filterKw = activeRef?.clientFilter ? (values[activeRef.key]?.kw || '').trim().toLowerCase() : '';
  const resultList = rawResultList && filterKw
    ? rawResultList.filter((row) => Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(filterKw)))
    : rawResultList;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, overflow: 'hidden' }}>
      {/* Daftar seluruh jenis referensi — masing-masing baris punya input & tombol Cari sendiri */}
      <div style={{ overflowY: 'auto', flex: activeRef ? '0 0 auto' : 1, maxHeight: activeRef ? '40%' : undefined, border: '1px solid #e5e7eb', borderRadius: 12, background: '#ffffff' }}>
        {REF_TYPES.map((ref, i) => (
          <div
            key={ref.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: i < REF_TYPES.length - 1 ? '1px solid #e5e7eb' : 'none',
              background: activeRef?.key === ref.key ? '#eff6ff' : 'transparent',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: 220, flexShrink: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{ref.label}</div>
            {ref.params.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Tidak perlu parameter</div>
            ) : (
              ref.params.map((p) => (
                <input
                  key={p.key}
                  style={{ ...inputStyle, width: p.key === 'tgl' ? 140 : 200 }}
                  type={p.key === 'tgl' ? 'date' : 'text'}
                  value={values[ref.key]?.[p.key] || ''}
                  placeholder={p.placeholder || p.label}
                  onChange={(e) => setFieldValue(ref.key, p.key, e.target.value)}
                />
              ))
            )}
            <button
              type="button"
              onClick={() => handleSearch(ref)}
              disabled={loadingKey === ref.key}
              style={{
                padding: '7px 18px',
                borderRadius: 8,
                border: 'none',
                background: loadingKey === ref.key ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: loadingKey === ref.key ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {loadingKey === ref.key ? 'Mencari...' : 'Cari'}
            </button>
            {rowErrors[ref.key] && (
              <div style={{ fontSize: 12, color: '#dc2626', whiteSpace: 'nowrap' }}>{rowErrors[ref.key]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Hasil pencarian terakhir */}
      {(error || result) && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          {activeRef && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Hasil — {activeRef.label}</div>
          )}
          {error && (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              {error}
            </div>
          )}
          {result && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              {resultList && resultList.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
                    <tr>
                      {Object.keys(resultList[0]).map((col) => (
                        <th key={col} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultList.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        {Object.keys(resultList[0]).map((col) => (
                          <td key={col} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                            {String(row[col] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
