import React from 'react';
import { localDateStr } from '../utils/date';

// Meratakan hasil (objek/array bertingkat) jadi baris path:value — bentuk
// respons persis SEP/Monitoring VClaim belum diverifikasi tanpa kredensial asli.
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

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const cariButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const ResultTable: React.FC<{ data: any }> = ({ data }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <tbody>
        {flattenRows(data).map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
            <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '35%' }}>{row.path}</td>
            <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Kolom hasil "Data SEP Internal" (GET SEP/Internal/{noSep}, bagian 14.2) —
// bentuk respons SUDAH terverifikasi dari dokumen resmi (bukan tebakan lagi
// seperti sebelumnya), jadi ditampilkan sebagai tabel kolom sungguhan alih-
// alih flatten path:value generik seperti SEP Induk/Monitoring yang bentuk
// responsnya masih belum diverifikasi.
const SEP_INTERNAL_COLUMNS: { key: string; label: string }[] = [
  { key: 'nosep', label: 'No. SEP Induk' },
  { key: 'nosepref', label: 'No. SEP Rujukan' },
  { key: 'tujuanrujuk', label: 'Kode Poli Tujuan' },
  { key: 'nmtujuanrujuk', label: 'Nama Poli Tujuan' },
  { key: 'kdpoliasal', label: 'Kode Poli Asal' },
  { key: 'nmpoliasal', label: 'Nama Poli Asal' },
  { key: 'tglrujukinternal', label: 'Tgl. Rujuk Internal' },
  { key: 'ppkpelsep', label: 'PPK Pelayanan' },
  { key: 'nokapst', label: 'No. Kartu' },
  { key: 'tglsep', label: 'Tgl. SEP' },
  { key: 'nosurat', label: 'No. Surat' },
  { key: 'flaginternal', label: 'Flag Internal' },
  { key: 'kdpenunjang', label: 'Kode Penunjang' },
  { key: 'nmpenunjang', label: 'Nama Penunjang' },
  { key: 'diagppk', label: 'Kode Diagnosa' },
  { key: 'nmdiag', label: 'Nama Diagnosa' },
  { key: 'kddokter', label: 'Kode Dokter' },
  { key: 'nmdokter', label: 'Nama Dokter' },
  { key: 'flagprosedur', label: 'Flag Prosedur' },
  { key: 'opsikonsul', label: 'Opsi Konsul' },
  { key: 'flagsep', label: 'Flag SEP' },
  { key: 'fuser', label: 'User Input' },
  { key: 'fdate', label: 'Tgl. Input' },
];

const SepInternalTable: React.FC<{ data: any }> = ({ data }) => {
  const list: any[] = Array.isArray(data?.list) ? data.list : [];
  if (list.length === 0) {
    return <ResultTable data={data} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {typeof data?.count !== 'undefined' && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Jumlah: {data.count}</div>
      )}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              {SEP_INTERNAL_COLUMNS.map((col) => (
                <th key={col.key} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 400 }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                {SEP_INTERNAL_COLUMNS.map((col) => (
                  <td key={col.key} style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                    {row[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const formatRupiah = (v: string | number | undefined) => {
  const n = Number(v ?? 0);
  return isNaN(n) ? String(v ?? '-') : n.toLocaleString('id-ID');
};

// Tabel hasil "Data Klaim" (bagian 16, GET Monitoring/Klaim/Tanggal/{tglPulang}/
// JnsPelayanan/{jns}/Status/{status}) — bentuk respons sudah terverifikasi
// dari dokumen resmi (array `klaim`, tiap baris punya objek bersarang
// Inacbg/biaya/peserta), jadi ditampilkan sebagai tabel kolom sungguhan.
const KlaimTable: React.FC<{ data: any }> = ({ data }) => {
  const list: any[] = Array.isArray(data?.klaim) ? data.klaim : [];
  if (list.length === 0) {
    return <ResultTable data={data} />;
  }
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ background: '#f3f4f6' }}>
          <tr>
            {['No. SEP', 'Nama Peserta', 'No. Kartu', 'No. MR', 'Poli', 'Kelas Rawat', 'Tgl. SEP', 'Tgl. Pulang', 'Kode INACBG', 'Nama INACBG', 'Biaya Pengajuan', 'Biaya Disetujui', 'Biaya Tarif Gruper', 'Biaya Tarif RS', 'Biaya Top Up', 'No. FPK', 'Status'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.noSEP || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.peserta?.nama || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.peserta?.noKartu || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.peserta?.noMR || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.poli || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.kelasRawat || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.tglSep || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.tglPulang || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.Inacbg?.kode || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.Inacbg?.nama || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatRupiah(row.biaya?.byPengajuan)}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatRupiah(row.biaya?.bySetujui)}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatRupiah(row.biaya?.byTarifGruper)}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatRupiah(row.biaya?.byTarifRS)}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatRupiah(row.biaya?.byTopup)}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.noFPK || '-'}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>{row.status || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</div>
    {children}
  </div>
);

export const BpjsPencarianSepView: React.FC = () => {
  // 14.1 SEP Induk
  const [noSepInduk, setNoSepInduk] = React.useState('');
  const [loadingInduk, setLoadingInduk] = React.useState(false);
  const [errorInduk, setErrorInduk] = React.useState<string | null>(null);
  const [resultInduk, setResultInduk] = React.useState<any>(null);

  // 14.2 SEP Internal
  const [noSepInternal, setNoSepInternal] = React.useState('');
  const [loadingInternal, setLoadingInternal] = React.useState(false);
  const [errorInternal, setErrorInternal] = React.useState<string | null>(null);
  const [resultInternal, setResultInternal] = React.useState<any>(null);

  // 15 Monitoring SEP
  const [tglMonitoring, setTglMonitoring] = React.useState(localDateStr());
  const [jnsMonitoring, setJnsMonitoring] = React.useState('2');
  const [loadingMonitoring, setLoadingMonitoring] = React.useState(false);
  const [errorMonitoring, setErrorMonitoring] = React.useState<string | null>(null);
  const [resultMonitoring, setResultMonitoring] = React.useState<any>(null);

  // 16 Data Klaim
  const [tglKlaim, setTglKlaim] = React.useState(localDateStr());
  const [jnsKlaim, setJnsKlaim] = React.useState('2');
  const [statusKlaim, setStatusKlaim] = React.useState('1');
  const [loadingKlaim, setLoadingKlaim] = React.useState(false);
  const [errorKlaim, setErrorKlaim] = React.useState<string | null>(null);
  const [resultKlaim, setResultKlaim] = React.useState<any>(null);

  const cariSepInduk = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInduk(null);
    setResultInduk(null);
    if (!noSepInduk.trim()) {
      setErrorInduk('No. SEP wajib diisi');
      return;
    }
    setLoadingInduk(true);
    try {
      const res = await fetch(`/api/bridging/sep/cari/${encodeURIComponent(noSepInduk.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SEP tidak ditemukan');
      setResultInduk(data.sep ?? data);
    } catch (err: any) {
      setErrorInduk(err.message || 'Terjadi kesalahan');
    } finally {
      setLoadingInduk(false);
    }
  };

  const cariSepInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInternal(null);
    setResultInternal(null);
    if (!noSepInternal.trim()) {
      setErrorInternal('No. SEP internal wajib diisi');
      return;
    }
    setLoadingInternal(true);
    try {
      const res = await fetch(`/api/bridging/sep-internal/cari/${encodeURIComponent(noSepInternal.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SEP tidak ditemukan');
      setResultInternal(data.sep_internal ?? data);
    } catch (err: any) {
      setErrorInternal(err.message || 'Terjadi kesalahan');
    } finally {
      setLoadingInternal(false);
    }
  };

  const cariMonitoring = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMonitoring(null);
    setResultMonitoring(null);
    setLoadingMonitoring(true);
    try {
      const res = await fetch(`/api/bridging/sep/monitoring?tgl=${tglMonitoring}&jns_pelayanan=${jnsMonitoring}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Data tidak ditemukan');
      setResultMonitoring(data.monitoring ?? data);
    } catch (err: any) {
      setErrorMonitoring(err.message || 'Terjadi kesalahan');
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const cariKlaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKlaim(null);
    setResultKlaim(null);
    setLoadingKlaim(true);
    try {
      const res = await fetch(`/api/bridging/sep/monitoring-klaim?tgl_pulang=${tglKlaim}&jns_pelayanan=${jnsKlaim}&status=${statusKlaim}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Data tidak ditemukan');
      setResultKlaim(data.klaim ?? data);
    } catch (err: any) {
      setErrorKlaim(err.message || 'Terjadi kesalahan');
    } finally {
      setLoadingKlaim(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      <Section title="Pencarian SEP Induk">
        <form onSubmit={cariSepInduk} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>No. SEP</label>
            <input style={{ ...inputStyle, width: 260 }} value={noSepInduk} onChange={(e) => setNoSepInduk(e.target.value)} />
          </div>
          <button type="submit" disabled={loadingInduk} style={cariButtonStyle}>{loadingInduk ? 'Mencari...' : 'Cari'}</button>
          {errorInduk && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{errorInduk}</span>}
        </form>
        {resultInduk && <ResultTable data={resultInduk} />}
      </Section>

      <Section title="Pencarian SEP Internal">
        <form onSubmit={cariSepInternal} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>No. SEP Internal</label>
            <input style={{ ...inputStyle, width: 260 }} value={noSepInternal} onChange={(e) => setNoSepInternal(e.target.value)} />
          </div>
          <button type="submit" disabled={loadingInternal} style={cariButtonStyle}>{loadingInternal ? 'Mencari...' : 'Cari'}</button>
          {errorInternal && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{errorInternal}</span>}
        </form>
        {resultInternal && <SepInternalTable data={resultInternal} />}
      </Section>

      <Section title="Monitoring SEP / Kunjungan">
        <form onSubmit={cariMonitoring} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tanggal</label>
            <input type="date" style={{ ...inputStyle, width: 160 }} value={tglMonitoring} onChange={(e) => setTglMonitoring(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Jenis Pelayanan</label>
            <select style={{ ...inputStyle, width: 160 }} value={jnsMonitoring} onChange={(e) => setJnsMonitoring(e.target.value)}>
              <option value="1">Rawat Inap</option>
              <option value="2">Rawat Jalan</option>
            </select>
          </div>
          <button type="submit" disabled={loadingMonitoring} style={cariButtonStyle}>{loadingMonitoring ? 'Mencari...' : 'Cari'}</button>
          {errorMonitoring && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{errorMonitoring}</span>}
        </form>
        {resultMonitoring && <ResultTable data={resultMonitoring} />}
      </Section>

      <Section title="Data Klaim">
        <form onSubmit={cariKlaim} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tanggal Pulang</label>
            <input type="date" style={{ ...inputStyle, width: 160 }} value={tglKlaim} onChange={(e) => setTglKlaim(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Jenis Pelayanan</label>
            <select style={{ ...inputStyle, width: 160 }} value={jnsKlaim} onChange={(e) => setJnsKlaim(e.target.value)}>
              <option value="1">Rawat Inap</option>
              <option value="2">Rawat Jalan</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status Klaim</label>
            <select style={{ ...inputStyle, width: 180 }} value={statusKlaim} onChange={(e) => setStatusKlaim(e.target.value)}>
              <option value="1">Proses Verifikasi</option>
              <option value="2">Pending Verifikasi</option>
              <option value="3">Klaim</option>
            </select>
          </div>
          <button type="submit" disabled={loadingKlaim} style={cariButtonStyle}>{loadingKlaim ? 'Mencari...' : 'Cari'}</button>
          {errorKlaim && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{errorKlaim}</span>}
        </form>
        {resultKlaim && <KlaimTable data={resultKlaim} />}
      </Section>
    </div>
  );
};
