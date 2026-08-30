import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Total Resep, card putih baru di Dashboard Apotek di bawah
// "Lama Pelayanan Apotek" (DashboardApotek.tsx). Menghitung jumlah resep
// (resep_obat, per no_resep) yang MASUK (tgl_peresepan) — bukan durasi
// pelayanan seperti ApotekLamaPelayanan.tsx — dipecah Rawat Jalan/Rawat
// Inap (resep_obat.status), tiap kelompok dibandingkan Hari Ini vs Bulan
// Ini, lalu dirinci lagi per cara bayar (reg_periksa.kd_pj ->
// penjab.png_jawab). Endpoint dipanggil 2x (tgl1=tgl2=hari ini, lalu
// tgl1=tanggal 1 bulan berjalan) — sama pola dgn ApotekLamaPelayanan.tsx
// — hasilnya digabung per cara_bayar jadi satu tabel kolom Hari Ini /
// Bulan Ini.
// ============================================================================

type TotalResepCaraBayar = { cara_bayar: string; jml: number };
type TotalResepGroup = { total: number; per_cara_bayar: TotalResepCaraBayar[] };
type TotalResepResponse = { ralan: TotalResepGroup; ranap: TotalResepGroup };

const firstDayOfMonthStr = () => {
  const n = new Date();
  return localDateStr(new Date(n.getFullYear(), n.getMonth(), 1));
};

const StatMini: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: '1 1 140px', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 8, height: 32, borderRadius: 4, background: color, flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#0b0b0b' }}>{value}</div>
    </div>
  </div>
);

const th: React.CSSProperties = { padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f9fafb' };
const tdLabel: React.CSSProperties = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6', color: '#374151' };
const tdNum: React.CSSProperties = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

type CaraBayarRow = { cara_bayar: string; hari_ini: number; bulan_ini: number };

const mergeCaraBayar = (hariIni: TotalResepCaraBayar[], bulanIni: TotalResepCaraBayar[]): CaraBayarRow[] => {
  const map = new Map<string, CaraBayarRow>();
  hariIni.forEach((x) => map.set(x.cara_bayar, { cara_bayar: x.cara_bayar, hari_ini: x.jml, bulan_ini: 0 }));
  bulanIni.forEach((x) => {
    const existing = map.get(x.cara_bayar);
    if (existing) existing.bulan_ini = x.jml;
    else map.set(x.cara_bayar, { cara_bayar: x.cara_bayar, hari_ini: 0, bulan_ini: x.jml });
  });
  return Array.from(map.values()).sort((a, b) => b.bulan_ini - a.bulan_ini || b.hari_ini - a.hari_ini);
};

type ResepGroupSectionProps = {
  title: string;
  color: string;
  hariIni: TotalResepGroup | null;
  bulanIni: TotalResepGroup | null;
  loading: boolean;
};

const ResepGroupSection: React.FC<ResepGroupSectionProps> = ({ title, color, hariIni, bulanIni, loading }) => {
  const rows = React.useMemo(
    () => mergeCaraBayar(hariIni?.per_cara_bayar ?? [], bulanIni?.per_cara_bayar ?? []),
    [hariIni, bulanIni]
  );

  return (
    <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b0b0b' }}>{title}</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatMini label="Hari Ini" value={loading ? '-' : String(hariIni?.total ?? 0)} color={color} />
        <StatMini label="Bulan Ini" value={loading ? '-' : String(bulanIni?.total ?? 0)} color={color} />
      </div>

      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12.5, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          Tidak ada resep
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Cara Bayar</th>
                <th style={{ ...th, textAlign: 'right' }}>Hari Ini</th>
                <th style={{ ...th, textAlign: 'right' }}>Bulan Ini</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cara_bayar}>
                  <td style={tdLabel}>{r.cara_bayar}</td>
                  <td style={tdNum}>{r.hari_ini}</td>
                  <td style={tdNum}>{r.bulan_ini}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ApotekTotalResepView: React.FC = () => {
  const tgl2 = React.useMemo(() => localDateStr(), []);
  const tgl1BulanIni = React.useMemo(() => firstDayOfMonthStr(), []);

  const [hariIni, setHariIni] = React.useState<TotalResepResponse | null>(null);
  const [bulanIni, setBulanIni] = React.useState<TotalResepResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/apotek/total-resep?tgl1=${tgl2}&tgl2=${tgl2}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/apotek/total-resep?tgl1=${tgl1BulanIni}&tgl2=${tgl2}`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([h, b]) => {
        setHariIni(h);
        setBulanIni(b);
      })
      .catch(() => {
        setHariIni(null);
        setBulanIni(null);
      })
      .finally(() => setLoading(false));
  }, [tgl1BulanIni, tgl2]);

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <ResepGroupSection title="Total Resep Rawat Jalan" color="#2a78d6" hariIni={hariIni?.ralan ?? null} bulanIni={bulanIni?.ralan ?? null} loading={loading} />
      <ResepGroupSection title="Total Resep Rawat Inap" color="#eb6834" hariIni={hariIni?.ranap ?? null} bulanIni={bulanIni?.ranap ?? null} loading={loading} />
    </div>
  );
};
