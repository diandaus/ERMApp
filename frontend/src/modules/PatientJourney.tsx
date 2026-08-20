import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// PatientJourney.tsx — "Perjalanan Pasien Satu Sehat": lacak satu kunjungan
// (no_rawat) dari datang sampai pulang, lihat resource FHIR mana saja yang
// sudah terkirim ke Satu Sehat dan mana yang belum + alasannya. Ini murni
// pengecekan pasif ke data lokal (backend TIDAK memanggil API Satu Sehat
// sama sekali di sini) — aman dipakai kapan saja tanpa risiko kirim ganda.

type JourneyListRow = {
  tgl_registrasi: string; jam_reg: string; no_rawat: string; no_rm: string;
  nama_pasien: string; nama_dokter: string; nama_poli: string;
  stts_rawat: string; stts_lanjut: string; id_encounter: string;
};

type PipelineErrorInfo = {
  http_status: number;
  body: string;
  updated_at: string;
};

type PipelineItem = {
  key: string; label: string; group: string; total: number; sent: number;
  status: 'terkirim' | 'sebagian' | 'belum_terkirim' | 'tidak_ada_data' | 'menunggu_prasyarat';
  reason?: string;
  last_error?: PipelineErrorInfo;
};

type JourneyDetail = {
  no_rawat: string; no_rkm_medis: string; nama_pasien: string; nama_dokter: string; nama_poli: string;
  tgl_registrasi: string; jam_reg: string; stts_rawat: string; stts_lanjut: string; id_encounter: string;
  items: PipelineItem[];
};

const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const GROUP_LABELS: Record<string, string> = {
  utama: 'Alur Utama',
  observasi_ttv: 'Observation - Tanda Vital',
  radiologi: 'Radiologi',
  lab_pk: 'Laboratorium - Patologi Klinik',
  lab_mb: 'Laboratorium - Mikrobiologi',
};
const GROUP_ORDER = ['utama', 'observasi_ttv', 'radiologi', 'lab_pk', 'lab_mb'];

const STATUS_BADGE: Record<PipelineItem['status'], { bg: string; fg: string; label: string }> = {
  terkirim: { bg: '#ecfdf5', fg: '#065f46', label: 'Terkirim' },
  sebagian: { bg: '#fffbeb', fg: '#92400e', label: 'Sebagian' },
  belum_terkirim: { bg: '#fef2f2', fg: '#991b1b', label: 'Belum Terkirim' },
  menunggu_prasyarat: { bg: '#eff6ff', fg: '#1e40af', label: 'Menunggu Prasyarat' },
  tidak_ada_data: { bg: '#f3f4f6', fg: '#6b7280', label: 'Tidak Ada Data' },
};

const StatusBadge: React.FC<{ status: PipelineItem['status'] }> = ({ status }) => {
  const s = STATUS_BADGE[status];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const showErrorDetail = (label: string, err: PipelineErrorInfo) => {
  let pretty = err.body;
  try {
    pretty = JSON.stringify(JSON.parse(err.body), null, 2);
  } catch {
    // bukan JSON valid, tampilkan apa adanya
  }
  Swal.fire({
    icon: 'error',
    title: label,
    width: 560,
    confirmButtonText: 'Tutup',
    html: `
      <div style="text-align:left; font-size: 12px; color: #6b7280; margin-bottom: 8px;">
        HTTP ${err.http_status} &middot; ${escapeHtml(err.updated_at)}
      </div>
      <pre style="text-align:left; white-space:pre-wrap; word-break:break-word; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px; font-size:11px; max-height:340px; overflow:auto; margin:0;">${escapeHtml(pretty)}</pre>
    `,
  });
};

const RAWAT_TABS: { key: 'Ralan' | 'Ranap'; label: string }[] = [
  { key: 'Ralan', label: 'Rawat Jalan' },
  { key: 'Ranap', label: 'Rawat Inap' },
];

export const PatientJourneySection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [rawatTab, setRawatTab] = React.useState<'Ralan' | 'Ranap'>('Ralan');
  const [list, setList] = React.useState<JourneyListRow[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);

  const [selectedNoRawat, setSelectedNoRawat] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<JourneyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/satu-sehat/pipeline?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar kunjungan');
      setList(Array.isArray(data.list) ? data.list : []);
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const fetchDetail = React.useCallback(async (noRawat: string) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/satu-sehat/pipeline/detail/${noRawat}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail perjalanan pasien');
      setDetail(data);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelectRow = (noRawat: string) => {
    setSelectedNoRawat(noRawat);
    fetchDetail(noRawat);
  };

  const filteredList = React.useMemo(() => list.filter((r) => r.stts_lanjut === rawatTab), [list, rawatTab]);

  const groupedItems = React.useMemo(() => {
    if (!detail) return [];
    const map = new Map<string, PipelineItem[]>();
    for (const it of detail.items) {
      if (!map.has(it.group)) map.set(it.group, []);
      map.get(it.group)!.push(it);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [detail]);

  const summary = React.useMemo(() => {
    if (!detail) return null;
    const applicable = detail.items.filter((it) => it.status !== 'tidak_ada_data');
    const terkirim = applicable.filter((it) => it.status === 'terkirim').length;
    return { applicable: applicable.length, terkirim };
  }, [detail]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb' }}>
        {RAWAT_TABS.map((t) => {
          const active = rawatTab === t.key;
          const count = list.filter((r) => r.stts_lanjut === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setRawatTab(t.key)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: active ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: active ? '#059669' : '#6b7280',
                fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="No.Rawat, No.RM, nama pasien, nama dokter..."
            style={inputSm}
          />
        </div>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', maxHeight: 280 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              {['No.Rawat', 'Tanggal', 'No.RM', 'Nama Pasien', 'Dokter', 'Poli', 'Rawat', 'Encounter'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : filteredList.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada kunjungan {rawatTab === 'Ralan' ? 'rawat jalan' : 'rawat inap'} pada rentang tanggal ini</td></tr>
            ) : (
              filteredList.map((row) => (
                <tr
                  key={row.no_rawat}
                  onClick={() => handleSelectRow(row.no_rawat)}
                  style={{
                    borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                    background: selectedNoRawat === row.no_rawat ? '#ecfdf5' : undefined,
                  }}
                >
                  <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap', fontWeight: 600 }}>{row.no_rawat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_registrasi} {row.jam_reg}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_dokter}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_poli}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.stts_lanjut}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {row.id_encounter ? (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>Sudah</span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedNoRawat && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setSelectedNoRawat(null)}
        >
          <div
            style={{ position: 'relative', background: '#ffffff', borderRadius: 16, maxWidth: 780, width: '95%', maxHeight: '90vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedNoRawat(null)}
              style={{
                position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
                background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {loadingDetail ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat detail perjalanan pasien...</div>
            ) : !detail ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Gagal memuat detail</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, padding: '20px 56px 14px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{detail.nama_pasien} <span style={{ fontWeight: 400, color: '#6b7280' }}>({detail.no_rkm_medis})</span></div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      No.Rawat {detail.no_rawat} &middot; {detail.tgl_registrasi} {detail.jam_reg} &middot; {detail.stts_lanjut} &middot; Dokter {detail.nama_dokter || '-'} &middot; Poli {detail.nama_poli || '-'}
                    </div>
                  </div>
                  {summary && (
                    <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <strong>{summary.terkirim}</strong> dari <strong>{summary.applicable}</strong> resource yang berlaku sudah terkirim
                    </div>
                  )}
                </div>

                <div style={{ overflowY: 'auto', padding: 20 }}>
                {groupedItems.map(({ group, items }) => (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {GROUP_LABELS[group] || group}
                    </div>
                    <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr key={it.key} style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                              <td style={{ padding: '8px 10px', color: '#111827', width: '30%' }}>{it.label}</td>
                              <td style={{ padding: '8px 10px', width: 130 }}><StatusBadge status={it.status} /></td>
                              <td style={{ padding: '8px 10px', color: '#6b7280', width: 90, whiteSpace: 'nowrap' }}>
                                {it.status !== 'tidak_ada_data' ? `${it.sent}/${it.total}` : '-'}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#6b7280' }}>
                                {it.reason || ''}
                                {it.last_error && (
                                  <button
                                    type="button"
                                    onClick={() => showErrorDetail(it.label, it.last_error!)}
                                    style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Detail
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
