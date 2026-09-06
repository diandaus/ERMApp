import React from 'react';

// Dashboard.tsx — menu baru di sidebar (App.tsx), di atas "Menu Utama".
// Nampilin ringkasan kunjungan pasien (hari ini/bulan ini/tahun ini) +
// 2 card perbandingan cara bayar per periode yg sama, dipecah per jenis
// kunjungan: Pasien Poliklinik/Rawat Jalan & Pasien Rawat Inap. Data dari
// GET /api/dashboard/stats (backend/dashboard_handler.go). Donut chart
// dibikin manual pakai SVG (tanpa library tambahan), sama pola dgn mini
// line chart Grafik TTV di PemeriksaanRanap.tsx.

type DashboardStats = {
  kunjungan_hari_ini: number;
  kunjungan_bulan_ini: number;
  kunjungan_tahun_ini: number;
  cara_bayar_poli_hari_ini: { label: string; total: number }[];
  cara_bayar_poli_bulan_ini: { label: string; total: number }[];
  cara_bayar_poli_tahun_ini: { label: string; total: number }[];
  cara_bayar_ranap_hari_ini: { label: string; total: number }[];
  cara_bayar_ranap_bulan_ini: { label: string; total: number }[];
  cara_bayar_ranap_tahun_ini: { label: string; total: number }[];
};

type Periode = 'hari' | 'bulan' | 'tahun';

const PERIODE_OPTIONS: { key: Periode; label: string }[] = [
  { key: 'hari', label: 'Hari Ini' },
  { key: 'bulan', label: 'Bulan Ini' },
  { key: 'tahun', label: 'Tahun Ini' },
];

const PERIODE_KOSONG: Record<Periode, string> = {
  hari: 'Belum ada kunjungan hari ini.',
  bulan: 'Belum ada kunjungan bulan ini.',
  tahun: 'Belum ada kunjungan tahun ini.',
};

const PIE_COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#ec4899', '#10b981', '#6b7280'];

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{value.toLocaleString('id-ID')}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  </div>
);

// DonutChart — SVG murni ala "gauge ring": cincin tebal ujung membulat
// dgn celah antar-slice, dikelilingi garis-garis tick putus-putus, teks
// total di tengah. Tiap slice dihitung dari sudut kumulatif (mulai dari
// jam 12 / -90deg, searah jarum jam). Kalau cuma 1 kategori (mis. cuma
// BPJS), cincin digambar penuh tanpa celah.
const DonutChart: React.FC<{ data: { label: string; total: number }[]; total: number; size?: number }> = ({ data, total, size = 220 }) => {
  const scale = size / 220;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 26 * scale;
  const tickOuterR = size / 2 - 2;
  const tickInnerR = tickOuterR - 5 * scale;
  const ringR = tickInnerR - 6 * scale - strokeWidth / 2;

  if (total === 0) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: 12, boxSizing: 'border-box' }}>
        Belum ada data
      </div>
    );
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const gapDeg = data.length > 1 ? 8 : 0;

  let cumulativeAngle = -90; // mulai dari jam 12
  const slices = data.map((d, i) => {
    const fraction = d.total / total;
    const sliceAngle = fraction * 360;
    const rawStart = cumulativeAngle;
    const rawEnd = cumulativeAngle + sliceAngle;
    cumulativeAngle = rawEnd;

    let drawStart = rawStart + gapDeg / 2;
    let drawEnd = rawEnd - gapDeg / 2;
    if (drawEnd <= drawStart) drawEnd = drawStart + 1; // slice kecil tetap kelihatan

    const x1 = cx + ringR * Math.cos(toRad(drawStart));
    const y1 = cy + ringR * Math.sin(toRad(drawStart));
    const x2 = cx + ringR * Math.cos(toRad(drawEnd));
    const y2 = cy + ringR * Math.sin(toRad(drawEnd));
    const largeArc = drawEnd - drawStart > 180 ? 1 : 0;

    const path = `M ${x1} ${y1} A ${ringR} ${ringR} 0 ${largeArc} 1 ${x2} ${y2}`;
    return <path key={i} d={path} fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={strokeWidth} strokeLinecap="round" />;
  });

  // Tick putus-putus di luar cincin, statis 5deg sekali (72 garis).
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = toRad(deg);
    ticks.push(
      <line
        key={deg}
        x1={cx + tickInnerR * Math.cos(rad)}
        y1={cy + tickInnerR * Math.sin(rad)}
        x2={cx + tickOuterR * Math.cos(rad)}
        y2={cy + tickOuterR * Math.sin(rad)}
        stroke="#e5e7eb"
        strokeWidth={1.5}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {ticks}
      {slices}
      <text x={cx} y={cy - 14 * scale} textAnchor="middle" fontSize={12 * scale} fill="#9ca3af">Total</text>
      <text x={cx} y={cy + 12 * scale} textAnchor="middle" fontSize={28 * scale} fontWeight={700} fill="#111827">{total.toLocaleString('id-ID')}</text>
      <text x={cx} y={cy + 30 * scale} textAnchor="middle" fontSize={12 * scale} fill="#9ca3af">Pasien</text>
    </svg>
  );
};

// CaraBayarCard — card "Pasien Poliklinik/Rawat Jalan" atau "Pasien Rawat
// Inap", isinya 3 donut chart perbandingan cara bayar bersebelahan
// (hari ini/bulan ini/tahun ini), dipakai 2x di DashboardView dgn data yg
// sudah difilter status_lanjut ('Ralan'/'Ranap') dari backend.
const CaraBayarCard: React.FC<{ title: string; byPeriode: Record<Periode, { label: string; total: number }[]> }> = ({ title, byPeriode }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20 }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>{title}</div>
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {PERIODE_OPTIONS.map((p) => {
        const data = byPeriode[p.key];
        const totalData = data.reduce((sum, d) => sum + d.total, 0);
        return (
          <div key={p.key} style={{ flex: '1 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{p.label}</div>
            <DonutChart data={data} total={totalData} size={170} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {data.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>{PERIODE_KOSONG[p.key]}</div>
              ) : (
                data.map((d, i) => {
                  const pct = totalData > 0 ? Math.round((d.total / totalData) * 100) : 0;
                  return (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{d.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{pct}%</span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>({d.total})</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

type DashboardUser = {
  username: string;
  role: string;
};

export const DashboardView: React.FC<{ user: DashboardUser }> = ({ user }) => {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Role dokter — username = kd_dokter (konvensi login), dashboard di-scope
  // hanya ke kunjungan dokter yg login saja. Role lain (admin/pendaftaran/
  // farmasi/kasir dst) tetap lihat dashboard rumah sakit secara keseluruhan.
  const isDokter = user?.role === 'dokter';
  const url = isDokter ? `/api/dashboard/stats?kd_dokter=${encodeURIComponent(user.username)}` : '/api/dashboard/stats';

  React.useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setStats(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  const caraBayarPoli: Record<Periode, { label: string; total: number }[]> = {
    hari: stats?.cara_bayar_poli_hari_ini || [],
    bulan: stats?.cara_bayar_poli_bulan_ini || [],
    tahun: stats?.cara_bayar_poli_tahun_ini || [],
  };
  const caraBayarRanap: Record<Periode, { label: string; total: number }[]> = {
    hari: stats?.cara_bayar_ranap_hari_ini || [],
    bulan: stats?.cara_bayar_ranap_bulan_ini || [],
    tahun: stats?.cara_bayar_ranap_tahun_ini || [],
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>Memuat data dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Kunjungan Pasien */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          label="Kunjungan Pasien Hari Ini"
          value={stats?.kunjungan_hari_ini || 0}
          color="#1AB1E5"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
        />
        <StatCard
          label="Kunjungan Pasien Bulan Ini"
          value={stats?.kunjungan_bulan_ini || 0}
          color="#f59e0b"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>}
        />
        <StatCard
          label="Kunjungan Pasien Tahun Ini"
          value={stats?.kunjungan_tahun_ini || 0}
          color="#10b981"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>}
        />
      </div>

      <CaraBayarCard title="Poliklinik/Rawat Jalan" byPeriode={caraBayarPoli} />
      <CaraBayarCard title="Rawat Inap" byPeriode={caraBayarRanap} />
    </div>
  );
};
