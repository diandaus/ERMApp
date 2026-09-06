import React from 'react';

// Dashboard.tsx — menu baru di sidebar (App.tsx), di atas "Menu Utama".
// Nampilin ringkasan kunjungan pasien (hari ini/bulan ini/tahun ini) +
// diagram lingkaran perbandingan cara bayar bulan berjalan. Data dari
// GET /api/dashboard/stats (backend/dashboard_handler.go). Pie chart
// dibikin manual pakai SVG (tanpa library tambahan), sama pola dgn mini
// line chart Grafik TTV di PemeriksaanRanap.tsx.

type DashboardStats = {
  kunjungan_hari_ini: number;
  kunjungan_bulan_ini: number;
  kunjungan_tahun_ini: number;
  cara_bayar: { label: string; total: number }[];
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
const DonutChart: React.FC<{ data: { label: string; total: number }[]; total: number }> = ({ data, total }) => {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 26;
  const tickOuterR = size / 2 - 2;
  const tickInnerR = tickOuterR - 5;
  const ringR = tickInnerR - 6 - strokeWidth / 2;

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
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={12} fill="#9ca3af">Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={28} fontWeight={700} fill="#111827">{total.toLocaleString('id-ID')}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fill="#9ca3af">Pasien</text>
    </svg>
  );
};

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

  const caraBayar = stats?.cara_bayar || [];
  const totalCaraBayar = caraBayar.reduce((sum, d) => sum + d.total, 0);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>Memuat data dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>Dashboard</h2>
        {isDokter && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Menampilkan kunjungan pasien Anda saja</div>}
      </div>

      {/* Kunjungan Pasien */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          label="Kunjungan Hari Ini"
          value={stats?.kunjungan_hari_ini || 0}
          color="#1AB1E5"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
        />
        <StatCard
          label="Kunjungan Bulan Ini"
          value={stats?.kunjungan_bulan_ini || 0}
          color="#f59e0b"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>}
        />
        <StatCard
          label="Kunjungan Tahun Ini"
          value={stats?.kunjungan_tahun_ini || 0}
          color="#10b981"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>}
        />
      </div>

      {/* Perbandingan Cara Bayar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>Perbandingan Cara Bayar</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Bulan berjalan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
          <DonutChart data={caraBayar} total={totalCaraBayar} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 220 }}>
            {caraBayar.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Belum ada kunjungan bulan ini.</div>
            ) : (
              caraBayar.map((d, i) => {
                const pct = totalCaraBayar > 0 ? Math.round((d.total / totalCaraBayar) * 100) : 0;
                return (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#374151', flex: 1 }}>{d.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{pct}%</span>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>({d.total})</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
