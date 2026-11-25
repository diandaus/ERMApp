import React from 'react';

// Kerangka layar display Anjungan & Antrian (Jadwal Operasi, Layanan
// Informasi, dst): navbar hijau (kiri logo RS saja, tengah judul, kanan
// hari/tanggal + jam berjalan) dan footer hijau running text "Tarif Kamar
// Umum" — padanan header/footer webapps Khanza (jadwaloperasi.php, bed5.php).

export type TarifKamar = { kelas: string; trf_kamar: number };

export const DISPLAY_GREEN = '#04C99E';
export const DISPLAY_GREEN_DARK = '#04B58E';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pad = (n: number) => String(n).padStart(2, '0');

export const tanggalIndo = (d: Date) => `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;

type Props = {
  title: string;
  icon?: React.ReactNode;
  tarif: TarifKamar[];
  children: React.ReactNode;
};

export const DisplayFrame: React.FC<Props> = ({ title, icon, tarif, children }) => {
  const [now, setNow] = React.useState(new Date());
  const [rs, setRs] = React.useState<{ nama: string; logo: string }>({ nama: '', logo: '' });

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setRs({ nama: d?.nama_instansi || '', logo: d?.logo_url || '' }))
      .catch(() => {});
  }, []);

  const jamText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const rupiah = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('en-US');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F4F5F5', fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', overflow: 'hidden' }}>
      <header style={{ background: DISPLAY_GREEN, color: '#fff', height: 96, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 4 }}>
            {rs.logo ? (
              <img src={rs.logo} alt={rs.nama || 'Logo'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 30, color: DISPLAY_GREEN_DARK }}>✚</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 36, fontWeight: 800, letterSpacing: 0.5 }}>
          {icon}
          {title}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{tanggalIndo(now)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{jamText}</div>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, padding: 24, display: 'flex', flexDirection: 'column' }}>{children}</main>

      <footer style={{ background: DISPLAY_GREEN, color: '#fff', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ background: DISPLAY_GREEN_DARK, height: '100%', display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Tarif Kamar Umum
        </div>
        <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-block', paddingLeft: '100%', animation: 'displayFrameMarquee 30s linear infinite', fontSize: 20, fontWeight: 500 }}>
            {tarif.length === 0 ? '—' : tarif.map((t) => `| ${t.kelas} ${rupiah(t.trf_kamar)}`).join('   ')}
          </div>
        </div>
      </footer>
      <style>{`@keyframes displayFrameMarquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
};

// Gaya tabel display (header abu tebal, baris dipisah garis tipis).
export const displayTh: React.CSSProperties = { padding: '16px 18px', textAlign: 'left', fontSize: 18, fontWeight: 700, color: '#5F6665', borderBottom: '2px solid #E6E8E8', whiteSpace: 'nowrap' };
export const displayTd: React.CSSProperties = { padding: '18px 18px', fontSize: 20, color: '#282A2A', borderBottom: '1px solid #E6E8E8', verticalAlign: 'middle' };
