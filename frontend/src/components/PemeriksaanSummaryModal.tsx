import React from 'react';

// ============================================================================
// PemeriksaanSummaryModal — "Lihat Pemeriksaan", dipicu dari badge status
// "Belum dilayani"/"Selesai dilayani" di tabel "Antrian per Tanggal Mobile
// JKN" (AntreanRs.tsx). Ringkasan 1 kunjungan (no_rawat): identitas pasien +
// SOAP/CPPT + permintaan laboratorium + permintaan radiologi + permintaan
// resep — semuanya dari 1 endpoint agregasi (GET /api/pemeriksaan-summary,
// lihat backend/pemeriksaan_summary_handler.go utk sumber data & batasan
// jujurnya, mis. Lab PA belum diikutkan).
// ============================================================================

type SoapItem = { tanggal: string; jam: string; dokter: string };
type LabItem = { tanggal: string; jam: string; nama_pemeriksaan: string; status: string };
type RadItem = { tanggal: string; jam: string; nama_pemeriksaan: string; status: string };
type ResepItem = { tanggal: string; jam: string; status: string };

type PemeriksaanSummary = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  // status_periksa — reg_periksa.stts apa adanya, padanan persis kolom
  // "Status" (getStatusStyle) di RawatJalan.tsx.
  status_periksa: string;
  soap: SoapItem[] | null;
  lab: LabItem[] | null;
  radiologi: RadItem[] | null;
  resep: ResepItem[] | null;
};

type Props = {
  noRawat: string;
  onClose: () => void;
};

const formatTgl = (tgl: string) => {
  if (!tgl || tgl.startsWith('0000-00-00')) return '-';
  const datePart = tgl.includes('T') ? tgl.split('T')[0] : tgl;
  const [y, m, d] = datePart.split('-');
  return y && m && d ? `${d}/${m}/${y}` : datePart;
};

const formatJam = (jam: string) => (jam ? jam.slice(0, 5) : '-');

const statusColor = (status: string): { bg: string; color: string } => {
  const s = (status || '').toLowerCase();
  if (s.includes('belum')) return { bg: '#fefce8', color: '#854d0e' };
  if (s.includes('sudah') || s.includes('selesai')) return { bg: '#f0fdf4', color: '#166534' };
  return { bg: '#f3f4f6', color: '#374151' };
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = statusColor(status);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {status || '-'}
    </span>
  );
};

// getStatusPeriksaStyle — SALINAN PERSIS getStatusStyle di RawatJalan.tsx
// (warna & label kolom "Status" reg_periksa.stts), supaya badge "Status
// Periksa" di modal ini konsisten sama persis dgn yg dilihat user di
// RawatJalan.
const getStatusPeriksaStyle = (status: string): { bg: string; color: string; label: string } => {
  switch (status) {
    case 'Sudah':
      return { bg: '#ecfdf3', color: '#166534', label: 'Sudah' };
    case 'Belum':
      return { bg: '#fef3c7', color: '#92400e', label: 'Belum' };
    case 'Batal':
      return { bg: '#fee2e2', color: '#991b1b', label: 'Batal' };
    case 'Dirujuk':
      return { bg: '#dbeafe', color: '#1e40af', label: 'Dirujuk' };
    case 'Dirawat':
      return { bg: '#f3e8ff', color: '#6b21a8', label: 'Dirawat' };
    default:
      return { bg: '#f3f4f6', color: '#374151', label: status || '-' };
  }
};

const StatusPeriksaBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = getStatusPeriksaStyle(status);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 6, marginTop: 16 }}>{children}</div>
);

const thStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' };
const tdStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' };

const EmptyRow: React.FC<{ colSpan: number }> = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontSize: 11.5 }}>
      Belum ada data
    </td>
  </tr>
);

export const PemeriksaanSummaryModal: React.FC<Props> = ({ noRawat, onClose }) => {
  const [data, setData] = React.useState<PemeriksaanSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/pemeriksaan-summary/${encodeURIComponent(noRawat)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal mengambil data pemeriksaan');
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noRawat]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 720, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Detail Pemeriksaan</div>
              {data && <StatusPeriksaBadge status={data.status_periksa} />}
            </div>
            {data && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                No.Rawat {data.no_rawat} — {data.nm_pasien || '-'} ({data.no_rkm_medis || '-'})
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: 0, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
        ) : error ? (
          <div style={{ padding: 16, marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12.5 }}>
            {error}
          </div>
        ) : (
          <>
            <SectionTitle>SOAP/CPPT</SectionTitle>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Jam</th>
                    <th style={thStyle}>Dokter</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.soap?.length ? (
                    <EmptyRow colSpan={3} />
                  ) : (
                    data.soap.map((s, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{formatTgl(s.tanggal)}</td>
                        <td style={tdStyle}>{formatJam(s.jam)}</td>
                        <td style={tdStyle}>{s.dokter || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <SectionTitle>Permintaan Laboratorium</SectionTitle>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Jam</th>
                    <th style={thStyle}>Nama Pemeriksaan</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.lab?.length ? (
                    <EmptyRow colSpan={4} />
                  ) : (
                    data.lab.map((l, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{formatTgl(l.tanggal)}</td>
                        <td style={tdStyle}>{formatJam(l.jam)}</td>
                        <td style={tdStyle}>{l.nama_pemeriksaan || '-'}</td>
                        <td style={tdStyle}><StatusBadge status={l.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <SectionTitle>Permintaan Radiologi</SectionTitle>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Jam</th>
                    <th style={thStyle}>Nama Pemeriksaan</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.radiologi?.length ? (
                    <EmptyRow colSpan={4} />
                  ) : (
                    data.radiologi.map((r, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{formatTgl(r.tanggal)}</td>
                        <td style={tdStyle}>{formatJam(r.jam)}</td>
                        <td style={tdStyle}>{r.nama_pemeriksaan || '-'}</td>
                        <td style={tdStyle}><StatusBadge status={r.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <SectionTitle>Permintaan Resep</SectionTitle>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Jam</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.resep?.length ? (
                    <EmptyRow colSpan={3} />
                  ) : (
                    data.resep.map((r, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{formatTgl(r.tanggal)}</td>
                        <td style={tdStyle}>{formatJam(r.jam)}</td>
                        <td style={tdStyle}><StatusBadge status={r.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
