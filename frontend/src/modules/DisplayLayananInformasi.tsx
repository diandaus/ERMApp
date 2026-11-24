import React from 'react';
import { DisplayFrame, displayTd, displayTh, type TarifKamar } from '../components/DisplayFrame';

// Display Layanan Informasi (Anjungan & Antrian) — padanan webapps/bed5.php
// + data_jadwal_kamar.php Khanza: kiri "Jadwal Praktek Dokter" hari ini,
// kanan "Daftar Ruang Rawat Inap" (jumlah bed / terisi / kosong per kelas),
// dimuat ulang tiap 5 detik. Kerangka (navbar & footer tarif kamar) sama
// dgn Display Jadwal Operasi. Dibuka lewat #display-informasi tanpa login.

type JadwalDokter = { nm_dokter: string; nm_poli: string; jam_mulai: string; jam_selesai: string };
// nama_kamar diisi khusus Kelas Utama (ICU, NICU, ...) — dipecah per ruang.
type KamarKelas = { kelas: string; nama_kamar?: string; total: number; isi: number; kosong: number };

const POLL_MS = 5000;
const PAGE_SIZE = 9;
const PAGE_INTERVAL_MS = 8000;

const SectionTitle: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 14px', fontSize: 24, fontWeight: 800, color: '#282A2A' }}>
    {icon}
    {text}
  </div>
);

export const DisplayLayananInformasiView: React.FC = () => {
  const [jadwal, setJadwal] = React.useState<JadwalDokter[]>([]);
  const [kamar, setKamar] = React.useState<KamarKelas[]>([]);
  const [tarif, setTarif] = React.useState<TarifKamar[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    let aktif = true;
    const load = () =>
      fetch('/api/display/informasi')
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
          if (!aktif) return;
          setJadwal(Array.isArray(d.jadwal_dokter) ? d.jadwal_dokter : []);
          setKamar(Array.isArray(d.kamar) ? d.kamar : []);
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

  // Jadwal dokter > PAGE_SIZE -> halaman berganti otomatis.
  const totalPages = Math.max(1, Math.ceil(jadwal.length / PAGE_SIZE));
  React.useEffect(() => {
    if (page >= totalPages) setPage(0);
    if (totalPages <= 1) return;
    const t = window.setInterval(() => setPage((p) => (p + 1) % totalPages), PAGE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [totalPages, page]);
  const jadwalTampil = jadwal.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const card: React.CSSProperties = { background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 };
  const center: React.CSSProperties = { textAlign: 'center' };
  const total = kamar.reduce((a, k) => ({ total: a.total + k.total, isi: a.isi + k.isi, kosong: a.kosong + k.kosong }), { total: 0, isi: 0, kosong: 0 });

  return (
    <DisplayFrame
      title="INFORMASI"
      tarif={tarif}
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      }
    >
      {error && <div style={{ marginBottom: 12, textAlign: 'center', fontSize: 16, color: '#DC2626' }}>Gagal memuat data: {error}</div>}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 24 }}>
        {/* Kiri: Jadwal Praktek Dokter hari ini */}
        <div style={card}>
          <SectionTitle
            text="Jadwal Praktek Dokter"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#04B58E" aria-hidden>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            }
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #E6E8E8' }}>
            <thead>
              <tr>
                <th style={displayTh}>Nama Dokter</th>
                <th style={displayTh}>Poliklinik</th>
                <th style={{ ...displayTh, ...center }}>Mulai</th>
                <th style={{ ...displayTh, ...center }}>Selesai</th>
              </tr>
            </thead>
            <tbody>
              {jadwalTampil.map((j, i) => (
                <tr key={`${j.nm_dokter}-${j.nm_poli}-${i}`}>
                  <td style={{ ...displayTd, fontWeight: 600 }}>{j.nm_dokter}</td>
                  <td style={displayTd}>{j.nm_poli}</td>
                  <td style={{ ...displayTd, ...center, fontVariantNumeric: 'tabular-nums' }}>{j.jam_mulai || '-'}</td>
                  <td style={{ ...displayTd, ...center, fontVariantNumeric: 'tabular-nums' }}>{j.jam_selesai || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loaded && jadwal.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#8A9190', padding: 40 }}>
              Tidak ada jadwal praktek dokter hari ini
            </div>
          )}
          {!loaded && !error && <div style={{ padding: 40, textAlign: 'center', fontSize: 20, color: '#8A9190' }}>Memuat...</div>}
          {totalPages > 1 && (
            <div style={{ marginTop: 'auto', padding: '10px 18px', textAlign: 'right', fontSize: 16, color: '#5F6665' }}>
              Halaman {page + 1} / {totalPages} · {jadwal.length} jadwal
            </div>
          )}
        </div>

        {/* Kanan: Daftar Ruang Rawat Inap per kelas */}
        <div style={card}>
          <SectionTitle
            text="Daftar Ruang Rawat Inap"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#04B58E" aria-hidden>
                <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" />
              </svg>
            }
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #E6E8E8' }}>
            <thead>
              <tr>
                <th style={displayTh}>Kelas Kamar</th>
                <th style={{ ...displayTh, ...center }}>Jumlah Bed</th>
                <th style={{ ...displayTh, ...center }}>Bed Terisi</th>
                <th style={{ ...displayTh, ...center }}>Bed Kosong</th>
              </tr>
            </thead>
            <tbody>
              {kamar.map((k) => (
                <tr key={`${k.kelas}-${k.nama_kamar || ''}`}>
                  <td style={{ ...displayTd, fontWeight: 600 }}>
                    {k.nama_kamar ? (
                      <>
                        {k.nama_kamar}
                        <div style={{ fontSize: 15, fontWeight: 400, color: '#8A9190' }}>{k.kelas}</div>
                      </>
                    ) : (
                      k.kelas
                    )}
                  </td>
                  <td style={{ ...displayTd, ...center }}>{k.total}</td>
                  <td style={{ ...displayTd, ...center }}>
                    <span style={{ display: 'inline-block', minWidth: 44, padding: '4px 12px', borderRadius: 999, background: '#FEE2E2', color: '#991B1B', fontWeight: 700 }}>{k.isi}</span>
                  </td>
                  <td style={{ ...displayTd, ...center }}>
                    <span style={{ display: 'inline-block', minWidth: 44, padding: '4px 12px', borderRadius: 999, background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>{k.kosong}</span>
                  </td>
                </tr>
              ))}
              {kamar.length > 0 && (
                <tr style={{ background: '#F4F5F5' }}>
                  <td style={{ ...displayTd, fontWeight: 800 }}>Total</td>
                  <td style={{ ...displayTd, ...center, fontWeight: 800 }}>{total.total}</td>
                  <td style={{ ...displayTd, ...center, fontWeight: 800, color: '#991B1B' }}>{total.isi}</td>
                  <td style={{ ...displayTd, ...center, fontWeight: 800, color: '#166534' }}>{total.kosong}</td>
                </tr>
              )}
            </tbody>
          </table>
          {loaded && kamar.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 20, color: '#8A9190' }}>Belum ada data kamar</div>
          )}
        </div>
      </div>
    </DisplayFrame>
  );
};
