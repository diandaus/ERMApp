import React from 'react';
import { localDateStr } from '../utils/date';

type AntreanQueueItem = {
  id: number;
  no_rawat: string;
  no_sep: string;
  no_rkm_medis: string;
  kd_poli: string;
  kodepoli_bpjs: string;
  namapoli_bpjs: string;
  kodedokter_bpjs: string;
  namadokter_bpjs: string;
  tgl_registrasi: string;
  no_rujukan: string;
  jeniskunjungan: number;
  status: string;
  keterangan: string;
  kodebooking: string;
  created_at: string;
  processed_at: string | null;
};

const JENIS_KUNJUNGAN: Record<number, string> = {
  1: 'Rujukan FKTP',
  2: 'Rujukan Internal',
  3: 'Kontrol',
  4: 'Rujukan Antar RS',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: '#fefce8', color: '#854d0e', border: '#fde68a', label: 'Menunggu' },
  processing: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', label: 'Diproses' },
  done: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Selesai' },
  error: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'Gagal' },
  skipped: { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb', label: 'Dilewati (Manual)' },
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const formatWaktu = (waktu: string | null) => {
  if (!waktu || waktu.startsWith('0000-00-00')) return '-';
  const d = new Date(waktu.replace(' ', 'T'));
  if (isNaN(d.getTime())) return waktu;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const AntreanOtomatisView: React.FC = () => {
  const [enabled, setEnabled] = React.useState(false);
  const [savingToggle, setSavingToggle] = React.useState(false);
  const [items, setItems] = React.useState<AntreanQueueItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [tglDari, setTglDari] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDateStr(d);
  });
  const [tglSampai, setTglSampai] = React.useState(localDateStr());
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/bridging/antrean-queue/status');
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
    } catch {
      // biarkan default (mati) kalau gagal ambil status
    }
  }, []);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/antrean-queue?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil log antrean otomatis');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari, tglSampai, statusFilter, searchText]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleToggle = async () => {
    const next = !enabled;
    setSavingToggle(true);
    setActionError(null);
    try {
      const res = await fetch('/api/bridging/antrean-queue/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan');
      setEnabled(Boolean(data.enabled));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingToggle(false);
    }
  };

  const handleSkip = async (id: number) => {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridging/antrean-queue/${id}/skip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menandai baris');
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (id: number) => {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridging/antrean-queue/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses ulang');
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Saklar on/off */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: enabled ? '#f0fdf4' : '#f9fafb',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Buat Antrean BPJS Otomatis Saat SEP Disimpan
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Kalau dimatikan, kunjungan tetap tercatat di tabel di bawah (status "Menunggu") tapi tidak dikirim ke
            BPJS — cocok kalau staf sedang memakai fitur Tambah Antrean bawaan Khanza Desktop.
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={savingToggle}
          style={{
            flexShrink: 0,
            width: 52,
            height: 28,
            borderRadius: 999,
            border: 'none',
            background: enabled ? '#16a34a' : '#d1d5db',
            position: 'relative',
            cursor: savingToggle ? 'default' : 'pointer',
            opacity: savingToggle ? 0.7 : 1,
            transition: 'background 0.15s ease',
          }}
          aria-label={enabled ? 'Matikan antrean otomatis' : 'Nyalakan antrean otomatis'}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 27 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </div>

      {actionError && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari No. Rawat / No. RM / Kode Booking"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="processing">Diproses</option>
            <option value="done">Selesai</option>
            <option value="error">Gagal</option>
            <option value="skipped">Dilewati (Manual)</option>
          </select>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>s.d.</span>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Kunjungan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Booking / Keterangan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Diproses</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada antrean di kisaran tanggal ini</td></tr>
            ) : (
              items.map((item, index) => {
                const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending;
                return (
                  <tr key={item.id} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_rawat}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.no_rkm_medis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.namapoli_bpjs || item.kd_poli || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.namadokter_bpjs || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                      {JENIS_KUNJUNGAN[item.jeniskunjungan] || item.jeniskunjungan}
                      {item.no_rujukan ? ` (${item.no_rujukan})` : ''}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151', maxWidth: 260 }}>
                      {item.status === 'done' ? item.kodebooking : item.keterangan || '-'}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatWaktu(item.processed_at)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(item.status === 'error' || item.status === 'skipped') && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleRetry(item.id)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', fontSize: 11, cursor: 'pointer' }}
                          >
                            Proses Ulang
                          </button>
                        )}
                        {(item.status === 'pending' || item.status === 'error') && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleSkip(item.id)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 11, cursor: 'pointer' }}
                          >
                            Sudah Manual
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
