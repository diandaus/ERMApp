import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Diagram Lama Pelayanan, dipasang di Dashboard Apotek
// (DashboardApotek.tsx) menggantikan placeholder "Fitur Dashboard Apotek
// akan dikembangkan nanti.". Cocok dengan report Khanza Desktop "Lama
// Pelayanan Apotek" — query & rumus durasi 1:1 dengan method tampil() di
// referensi Java (lihat backend/apotek_lama_pelayanan_handler.go untuk
// rincian lengkap). SENGAJA cuma tampilkan diagramnya saja (rata-rata +
// grouped bar 4 bucket durasi) — tanpa filter tanggal/pencarian atau
// tabel detail per-resep, karena ini widget ringkas di Dashboard, bukan
// laporan penuh.
//
// Dua panel waktu ("Hari Ini" dan "Bulan Ini", sama endpoint beda rentang
// tanggal) disusun BERSEBELAHAN (flex row, wrap di layar sempit). Di
// dalam tiap panel, ringkasan dipecah 2 kelompok — Non-Racikan & Racikan
// (resep tergolong Racikan jika punya baris di resep_dokter_racikan) —
// karena standar SPM RS membedakan target waktu tunggu racikan vs
// non-racikan, jadi digabung rata-rata akan menyesatkan.
//
// Diagram batang mengikuti method dataviz proyek ini: grouped bar (4
// kategori durasi 0-15/15-30/30-60/>60 menit di sumbu-x, 3 seri Validasi/
// Penyerahan/Pelayanan berbagi SATU skala count — bukan dual-axis), warna
// kategorikal 3 slot pertama palet referensi (blue/orange/aqua, sudah
// lolos validator all-pairs CVD), legend selalu ada, label nilai
// langsung di atas tiap bar (jumlah kategori kecil jadi aman, bukan
// "angka di tiap titik" ala line chart padat), hover tooltip per-bar
// lewat CSS (:hover) — konsisten pola <style> scoped yang sudah dipakai
// Apotek.tsx utk efek hover lain.
// ============================================================================

const SERIES = [
  { key: 'validasi', label: 'Validasi', color: '#2a78d6' },
  { key: 'penyerahan', label: 'Penyerahan', color: '#eb6834' },
  { key: 'pelayanan', label: 'Pelayanan', color: '#1baf7a' },
] as const;

const BUCKET_LABELS: { key: keyof LamaPelayananBucket; label: string }[] = [
  { key: 'b15', label: '0–15 Menit' },
  { key: 'b30', label: '>15–30 Menit' },
  { key: 'b60', label: '>30–60 Menit' },
  { key: 'over60', label: '>60 Menit' },
];

type LamaPelayananBucket = { b15: number; b30: number; b60: number; over60: number };

type LamaPelayananSummary = {
  count: number;
  rata_validasi: number;
  rata_penyerahan: number;
  rata_pelayanan: number;
  bucket_validasi: LamaPelayananBucket;
  bucket_penyerahan: LamaPelayananBucket;
  bucket_pelayanan: LamaPelayananBucket;
};

type LamaPelayananResponse = {
  summary_non_racikan: LamaPelayananSummary;
  summary_racikan: LamaPelayananSummary;
};

const firstDayOfMonthStr = () => {
  const n = new Date();
  return localDateStr(new Date(n.getFullYear(), n.getMonth(), 1));
};

const StatMini: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: '1 1 160px', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 8, height: 32, borderRadius: 4, background: color, flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#0b0b0b' }}>{value}</div>
    </div>
  </div>
);

type LamaPelayananGroupProps = {
  summary: LamaPelayananSummary | null;
  loading: boolean;
  emptyMessage: string;
};

const LamaPelayananGroup: React.FC<LamaPelayananGroupProps> = ({ summary, loading, emptyMessage }) => {
  const buckets: Record<(typeof SERIES)[number]['key'], LamaPelayananBucket> | null = summary
    ? { validasi: summary.bucket_validasi, penyerahan: summary.bucket_penyerahan, pelayanan: summary.bucket_pelayanan }
    : null;
  const maxCount = buckets
    ? Math.max(1, ...BUCKET_LABELS.flatMap((b) => SERIES.map((s) => buckets[s.key][b.key])))
    : 1;
  const CHART_HEIGHT = 160;

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>;
  }
  if (!summary || summary.count === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5, border: '1px solid #e5e7eb', borderRadius: 12 }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatMini label="Rata-rata Validasi" value={`${summary.rata_validasi} menit`} color={SERIES[0].color} />
        <StatMini label="Rata-rata Penyerahan" value={`${summary.rata_penyerahan} menit`} color={SERIES[1].color} />
        <StatMini label="Rata-rata Pelayanan" value={`${summary.rata_pelayanan} menit`} color={SERIES[2].color} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 16px 8px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {SERIES.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52514e' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
              {s.label}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: CHART_HEIGHT, borderBottom: '1px solid #c3c2b7', padding: '0 8px' }}>
          {BUCKET_LABELS.map((b) => (
            <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
                {SERIES.map((s) => {
                  const count = buckets![s.key][b.key];
                  const h = Math.round((count / maxCount) * (CHART_HEIGHT - 24));
                  return (
                    <div key={s.key} className="lama-pelayanan-bar-wrap" style={{ position: 'relative', width: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {count > 0 && <div style={{ fontSize: 10.5, color: '#52514e', marginBottom: 2 }}>{count}</div>}
                      <div style={{ width: 22, height: Math.max(2, h), background: s.color, borderRadius: '4px 4px 0 0' }} />
                      <div className="lama-pelayanan-tooltip" style={{
                        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6,
                        background: '#0b0b0b', color: '#ffffff', fontSize: 11, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                        opacity: 0, pointerEvents: 'none', transition: 'opacity 0.12s', zIndex: 1,
                      }}>
                        {s.label}: {count} resep
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div style={{ display: 'flex', gap: 24, padding: '8px 8px 4px' }}>
          {BUCKET_LABELS.map((b) => (
            <div key={b.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#898781' }}>{b.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

type LamaPelayananPanelProps = {
  title: string;
  tgl1?: string;
  tgl2?: string;
};

const LamaPelayananPanel: React.FC<LamaPelayananPanelProps> = ({ title, tgl1, tgl2 }) => {
  const [data, setData] = React.useState<LamaPelayananResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const qs = tgl1 && tgl2 ? `?tgl1=${tgl1}&tgl2=${tgl2}` : '';
    fetch(`/api/apotek/lama-pelayanan${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tgl1, tgl2]);

  return (
    <div style={{ flex: '1 1 420px', minWidth: 340, display: 'flex', flexDirection: 'column', gap: 16, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b0b0b' }}>{title}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#52514e' }}>Non-Racikan</div>
        <LamaPelayananGroup
          summary={data?.summary_non_racikan ?? null}
          loading={loading}
          emptyMessage="Tidak ada resep non-racikan dengan validasi & penyerahan lengkap"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#52514e' }}>Racikan</div>
        <LamaPelayananGroup
          summary={data?.summary_racikan ?? null}
          loading={loading}
          emptyMessage="Tidak ada resep racikan dengan validasi & penyerahan lengkap"
        />
      </div>
    </div>
  );
};

export const ApotekLamaPelayananView: React.FC = () => {
  const tgl2 = React.useMemo(() => localDateStr(), []);
  const tgl1BulanIni = React.useMemo(() => firstDayOfMonthStr(), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0b0b0b' }}>Lama Pelayanan Apotek</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <LamaPelayananPanel title="Hari Ini" />
        <LamaPelayananPanel title="Bulan Ini" tgl1={tgl1BulanIni} tgl2={tgl2} />
      </div>

      <style>{`
        .lama-pelayanan-bar-wrap:hover .lama-pelayanan-tooltip { opacity: 1; }
      `}</style>
    </div>
  );
};
