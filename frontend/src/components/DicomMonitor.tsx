import React from 'react';
import { localDateStr } from '../utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────

type MonitorOrder = {
  noorder: string;
  no_rawat: string;
  tgl_permintaan: string;
  nm_pasien: string;
  no_rkm_medis: string;
  mwl_status: string;
  sr_total: number;
  sr_done: number;
  imagingstudy_id: string;
  imagingstudy_status: string;
};

type Summary = {
  total: number;
  mwl_done: number;
  sr_done: number;
  imaging_done: number;
};

type Props = {
  /** Callback saat baris diklik — bisa navigasi ke tab daftar studi */
  onSelectOrder?: (noorder: string) => void;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function today() {
  return localDateStr();
}

function StatusBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 600,
      padding: '2px 7px', borderRadius: 10,
      background: done ? '#dcfce7' : '#f3f4f6',
      color: done ? '#16a34a' : '#9ca3af',
      border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`,
      whiteSpace: 'nowrap',
    }}>
      {done ? '✓' : '○'} {label}
    </span>
  );
}

function SummaryCard({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '12px 16px', flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>dari {total} order ({pct}%)</div>
      <div style={{
        marginTop: 6, height: 4, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden',
      }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DicomMonitor({ onSelectOrder }: Props) {
  const [tglDari, setTglDari] = React.useState(today());
  const [tglSampai, setTglSampai] = React.useState(today());
  const [loading, setLoading] = React.useState(false);
  const [orders, setOrders] = React.useState<MonitorOrder[]>([]);
  const [summary, setSummary] = React.useState<Summary>({ total: 0, mwl_done: 0, sr_done: 0, imaging_done: 0 });
  const [filter, setFilter] = React.useState<'semua' | 'selesai' | 'proses' | 'belum'>('semua');
  const [error, setError] = React.useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/satu-sehat/monitoring/radiologi?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal memuat data'); return; }
      setOrders(data.orders ?? []);
      setSummary(data.summary ?? { total: 0, mwl_done: 0, sr_done: 0, imaging_done: 0 });
    } catch (e) {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  // ─── Status helpers ──────────────────────────────────────────────────────────

  function getOverallStatus(o: MonitorOrder) {
    const mwlOk = o.mwl_status !== '';
    const srOk  = o.sr_done > 0 && o.sr_done >= o.sr_total;
    const imgOk = o.imagingstudy_id !== '';
    if (mwlOk && srOk && imgOk) return 'selesai';
    if (mwlOk || srOk || imgOk) return 'proses';
    return 'belum';
  }

  const filtered = orders.filter(o => {
    if (filter === 'semua') return true;
    return getOverallStatus(o) === filter;
  });

  const statusLabel = (s: string) => {
    if (s === 'selesai') return { label: 'Selesai', bg: '#dcfce7', color: '#16a34a' };
    if (s === 'proses')  return { label: 'Sebagian', bg: '#fef3c7', color: '#d97706' };
    return { label: 'Belum', bg: '#f3f4f6', color: '#6b7280' };
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Filter bar */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
        padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Dari</span>
        <input type="date" value={tglDari} onChange={e => setTglDari(e.target.value)}
          style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>Sampai</span>
        <input type="date" value={tglSampai} onChange={e => setTglSampai(e.target.value)}
          style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }} />
        <button onClick={fetchData} disabled={loading} style={{
          padding: '5px 16px', borderRadius: 7, border: 'none',
          background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer',
        }}>
          {loading ? 'Memuat...' : 'Tampilkan'}
        </button>
        {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
          {summary.total} order
        </span>
      </div>

      {/* Summary cards */}
      {summary.total > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryCard label="MWL Terkirim"         value={summary.mwl_done}     total={summary.total} color="#7c3aed" />
          <SummaryCard label="ServiceRequest FHIR"   value={summary.sr_done}      total={summary.total} color="#0284c7" />
          <SummaryCard label="ImagingStudy FHIR"     value={summary.imaging_done} total={summary.total} color="#059669" />
          <SummaryCard label="Selesai Semua Langkah" value={orders.filter(o => getOverallStatus(o) === 'selesai').length} total={summary.total} color="#16a34a" />
        </div>
      )}

      {/* Status filter pills */}
      {summary.total > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['semua', 'selesai', 'proses', 'belum'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: filter === f ? '1px solid #2563eb' : '1px solid #e5e7eb',
              background: filter === f ? '#eff6ff' : '#fff',
              color: filter === f ? '#2563eb' : '#6b7280',
              fontWeight: filter === f ? 600 : 400,
            }}>
              {f === 'semua' ? `Semua (${orders.length})` :
               f === 'selesai' ? `Selesai (${orders.filter(o => getOverallStatus(o) === 'selesai').length})` :
               f === 'proses' ? `Sebagian (${orders.filter(o => getOverallStatus(o) === 'proses').length})` :
               `Belum (${orders.filter(o => getOverallStatus(o) === 'belum').length})`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '55vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr style={{ background: '#f9fafb' }}>
                {['No. Order', 'Tanggal', 'Pasien', 'MWL', 'ServiceRequest', 'ImagingStudy FHIR', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  {orders.length === 0 ? 'Klik Tampilkan untuk memuat data' : 'Tidak ada data sesuai filter'}
                </td></tr>
              ) : filtered.map(o => {
                const srOk  = o.sr_done > 0 && o.sr_done >= o.sr_total;
                const imgOk = o.imagingstudy_id !== '';
                const overall = getOverallStatus(o);
                const { label: ovLabel, bg: ovBg, color: ovColor } = statusLabel(overall);

                return (
                  <tr key={o.noorder}
                    onClick={() => onSelectOrder?.(o.noorder)}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      verticalAlign: 'middle',
                      cursor: onSelectOrder ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (onSelectOrder) e.currentTarget.style.background = '#f8faff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>
                      {o.noorder}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {o.tgl_permintaan}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{o.nm_pasien}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{o.no_rkm_medis}</div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <StatusBadge done={o.mwl_status !== ''} label={o.mwl_status || 'Belum'} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <StatusBadge done={srOk} label={`${o.sr_done}/${o.sr_total}`} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {imgOk ? (
                        <div>
                          <StatusBadge done label="Terkirim" />
                          {o.imagingstudy_id !== 'via-dicom-router' && (
                            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, wordBreak: 'break-all', maxWidth: 140 }}>
                              {o.imagingstudy_id}
                            </div>
                          )}
                          {o.imagingstudy_id === 'via-dicom-router' && (
                            <div style={{ fontSize: 9, color: '#0284c7', marginTop: 2 }}>via DICOM Router</div>
                          )}
                        </div>
                      ) : (
                        <StatusBadge done={false} label="Belum" />
                      )}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px',
                        borderRadius: 10, background: ovBg, color: ovColor,
                      }}>
                        {ovLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
