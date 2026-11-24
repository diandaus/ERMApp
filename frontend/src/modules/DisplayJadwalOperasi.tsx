import React from 'react';
import { DisplayFrame, displayTd, displayTh, tanggalIndo, type TarifKamar } from '../components/DisplayFrame';

// Display Jadwal Operasi (Anjungan & Antrian) — padanan webapps/
// jadwaloperasi.php + data_operasi.php Khanza: jadwal operasi HARI INI,
// dimuat ulang tiap 5 detik (sama dgn PHP), running text "Tarif Kamar
// Umum" di footer. Tampilan: navbar hijau (kiri logo + nama RS, tengah
// "Jadwal Operasi", kanan hari/tanggal + jam). Dibuka lewat #display-operasi
// tanpa login. Kolom sama dgn PHP + Nama Pasien (No.RM tidak ditampilkan).

type OperasiRow = {
  no_rawat: string;
  nm_pasien: string;
  umur: string;
  jk: string;
  jam_mulai: string;
  jam_selesai: string;
  status: string;
  operasi: string;
  operator: string;
  ruang_ok: string;
};


const POLL_MS = 5000;
const PAGE_SIZE = 10;
const PAGE_INTERVAL_MS = 8000;

const jam5 = (t: string) => (t && t !== '00:00:00' ? t.slice(0, 5) : '-');

const statusStyle = (status: string): { bg: string; fg: string } => {
  const s = status.toLowerCase();
  if (s.includes('selesai')) return { bg: '#DCFCE7', fg: '#166534' };
  if (s.includes('proses')) return { bg: '#DBEAFE', fg: '#1E40AF' };
  if (s.includes('batal')) return { bg: '#FEE2E2', fg: '#991B1B' };
  return { bg: '#FEF3C7', fg: '#92400E' }; // Menunggu / lainnya
};

export const DisplayJadwalOperasiView: React.FC = () => {
  const [rows, setRows] = React.useState<OperasiRow[]>([]);
  const [tarif, setTarif] = React.useState<TarifKamar[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(0);

  // Data jadwal — dimuat ulang tiap 5 detik (padanan setInterval di PHP).
  React.useEffect(() => {
    let aktif = true;
    const load = () =>
      fetch('/api/display/jadwal-operasi')
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
          if (!aktif) return;
          setRows(Array.isArray(d.data) ? d.data : []);
          setTarif(Array.isArray(d.tarif_kamar) ? d.tarif_kamar : []);
          setError('');
          setLoaded(true);
        })
        .catch((e) => {
          if (aktif) setError(e instanceof Error ? e.message : 'Gagal memuat data');
        });
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => {
      aktif = false;
      window.clearInterval(t);
    };
  }, []);

  // Lebih dari PAGE_SIZE baris -> halaman berganti otomatis.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  React.useEffect(() => {
    if (page >= totalPages) setPage(0);
    if (totalPages <= 1) return;
    const t = window.setInterval(() => setPage((p) => (p + 1) % totalPages), PAGE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [totalPages, page]);
  const tampil = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const tanggalText = tanggalIndo(new Date());
  const th = displayTh;
  const td = displayTd;

  return (
    <DisplayFrame
      title="JADWAL OPERASI"
      tarif={tarif}
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      }
    >
      {/* Tabel jadwal (kolom sama dgn data_operasi.php) */}
        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>No. Rawat</th>
                <th style={th}>Nama Pasien</th>
                <th style={th}>Umur</th>
                <th style={{ ...th, textAlign: 'center' }}>J.K.</th>
                <th style={{ ...th, textAlign: 'center' }}>Mulai</th>
                <th style={{ ...th, textAlign: 'center' }}>Selesai</th>
                <th style={th}>Status</th>
                <th style={th}>Operasi</th>
                <th style={th}>Operator</th>
                <th style={th}>Ruang Operasi</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r, i) => {
                const st = statusStyle(r.status);
                return (
                  <tr key={`${r.no_rawat}-${i}`}>
                    <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.no_rawat}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.nm_pasien || '-'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.umur}</td>
                    <td style={{ ...td, textAlign: 'center' }}>{r.jk || '-'}</td>
                    <td style={{ ...td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{jam5(r.jam_mulai)}</td>
                    <td style={{ ...td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{jam5(r.jam_selesai)}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.status || '-'}</span>
                    </td>
                    <td style={td}>{r.operasi || '-'}</td>
                    <td style={td}>{r.operator || '-'}</td>
                    <td style={td}>{r.ruang_ok || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loaded && rows.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8A9190', gap: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>Tidak ada jadwal operasi hari ini</div>
              <div style={{ fontSize: 18 }}>{tanggalText}</div>
            </div>
          )}
          {!loaded && !error && <div style={{ padding: 40, textAlign: 'center', fontSize: 20, color: '#8A9190' }}>Memuat jadwal operasi...</div>}
          {error && <div style={{ padding: 16, textAlign: 'center', fontSize: 16, color: '#DC2626' }}>Gagal memuat data: {error}</div>}
        </div>
        {totalPages > 1 && (
          <div style={{ marginTop: 10, textAlign: 'right', fontSize: 16, color: '#5F6665' }}>
            Halaman {page + 1} / {totalPages} · {rows.length} jadwal
          </div>
        )}
    </DisplayFrame>
  );
};
