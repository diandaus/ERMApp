import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// MODAL PERMINTAAN RANAP — padanan permintaan/DlgPermintaanRanap.java
// (Khanza). Dibuka langsung dari tombol "Permintaan Ranap" di Rawat Inap
// TANPA perlu pilih pasien dulu — tombol ini untuk MELIHAT daftar
// permintaan pasien masuk rawat inap (booking kamar) dari IGD/Poli, bukan
// form utk satu pasien terpilih. Padanan 2 radio R1/R2 Java: R1 = pasien
// yg permintaan_ranap-nya BELUM masuk kamar_inap, R2 = yg SUDAH masuk
// (dgn filter rentang tanggal).
//
// Backend (backend/permintaan_ranap_handler.go: GET /api/permintaan-ranap/
// pasien/:no_rawat, GET /api/kamar/list, POST /api/permintaan-ranap) sudah
// ada dari tahap sebelumnya — dipakai lagi begitu tabel & form-nya
// dibangun ulang di sini.
// ============================================================================

type PermintaanTab = 'menunggu' | 'sudah-masuk';

// Kolom tabel — persis tabMode DlgPermintaanRanap.java. 3 kolom terakhir
// Java (No.Bad/Kamar, Kode Bangsal, KodeDokter) disembunyikan di sana
// (column.setMinWidth(0)/setMaxWidth(0)) — dipakai internal buat prefill
// form saat baris diklik, BUKAN kolom yg ditampilkan, jadi tidak
// dimasukkan ke header di sini juga.
const TABLE_COLUMNS = [
  'No.Rawat', 'No.RM', 'Nama Pasien', 'J.K.', 'Umur', 'No.Telp', 'Cara Bayar',
  'Asal Poli/Unit', 'Dokter Yang Memeriksa', 'Tanggal', 'Kamar Diminta',
  'Tarif Kamar', 'Diagnosa Awal', 'Catatan',
];

const TH: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap', background: '#f9fafb',
};

const TD: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6',
  whiteSpace: 'nowrap', color: '#374151',
};

const dateInputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

type PermintaanRanapRow = {
  no_rawat: string;
  no_rkm_medis: string;
  nama_pasien: string;
  jk: string;
  umur: string;
  no_telp: string;
  cara_bayar: string;
  poli: string;
  dokter: string;
  tanggal: string;
  kd_kamar: string;
  kd_bangsal: string;
  nm_bangsal: string;
  trf_kamar: number;
  diagnosa: string;
  catatan: string;
  kd_dokter: string;
};

const formatRupiah = (v: number) => Math.round(v || 0).toLocaleString('id-ID');

const tanggalIndo = (isoTanggal: string) => {
  const [y, m, d] = isoTanggal.split('-');
  if (!y || !m || !d) return isoTanggal;
  return `${d}-${m}-${y}`;
};

interface ModalPermintaanRanapProps {
  open: boolean;
  onClose: () => void;
}

export const ModalPermintaanRanap: React.FC<ModalPermintaanRanapProps> = ({ open, onClose }) => {
  const [tab, setTab] = React.useState<PermintaanTab>('menunggu');
  const [tglAwal, setTglAwal] = React.useState(localDateStr());
  const [tglAkhir, setTglAkhir] = React.useState(localDateStr());
  const [rows, setRows] = React.useState<PermintaanRanapRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (tab === 'sudah-masuk' && (!tglAwal || !tglAkhir)) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/permintaan-ranap/list?filter=${tab}`;
      if (tab === 'sudah-masuk') url += `&tanggal_awal=${tglAwal}&tanggal_akhir=${tglAkhir}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data permintaan rawat inap');
      setRows(Array.isArray(data.list) ? data.list : []);
    } catch (err: any) {
      setRows([]);
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [tab, tglAwal, tglAkhir]);

  React.useEffect(() => {
    if (!open) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, tglAwal, tglAkhir]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 1100, width: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Permintaan Rawat Inap</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* White Card Content */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 14, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Baris pertama — tab status (kiri, segmented control persis
              pola RawatJalan.tsx/RawatInap.tsx) + filter rentang tanggal
              (kanan, padanan DTPCari1/DTPCari2 Java, relevan utk tab
              "Sudah masuk rawat inap"). */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setTab('menunggu')}
                style={{
                  padding: '6px 20px',
                  borderRadius: 8,
                  border: tab === 'menunggu' ? '1px solid #d1d5db' : 'none',
                  background: tab === 'menunggu' ? '#ffffff' : 'transparent',
                  color: tab === 'menunggu' ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: tab === 'menunggu' ? 500 : 400,
                  transition: 'all 0.2s ease',
                  boxShadow: tab === 'menunggu' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Menunggu masuk rawat inap
              </button>
              <button
                type="button"
                onClick={() => setTab('sudah-masuk')}
                style={{
                  padding: '6px 20px',
                  borderRadius: 8,
                  border: tab === 'sudah-masuk' ? '1px solid #d1d5db' : 'none',
                  background: tab === 'sudah-masuk' ? '#ffffff' : 'transparent',
                  color: tab === 'sudah-masuk' ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: tab === 'sudah-masuk' ? 500 : 400,
                  transition: 'all 0.2s ease',
                  boxShadow: tab === 'sudah-masuk' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Sudah masuk rawat inap
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} style={dateInputStyle} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>s.d.</span>
              <input type="date" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} style={dateInputStyle} />
            </div>
          </div>

          {error && (
            <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, flexShrink: 0 }}>
              {error}
            </div>
          )}

          {/* Tabel — persis tabMode DlgPermintaanRanap.java */}
          <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col} style={TH}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={TABLE_COLUMNS.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={TABLE_COLUMNS.length} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.no_rawat}>
                      <td style={TD}>{row.no_rawat}</td>
                      <td style={TD}>{row.no_rkm_medis}</td>
                      <td style={{ ...TD, fontWeight: 600, color: '#111827' }}>{row.nama_pasien}</td>
                      <td style={TD}>{row.jk}</td>
                      <td style={TD}>{row.umur}</td>
                      <td style={TD}>{row.no_telp}</td>
                      <td style={TD}>{row.cara_bayar}</td>
                      <td style={TD}>{row.poli}</td>
                      <td style={TD}>{row.dokter}</td>
                      <td style={TD}>{tanggalIndo(row.tanggal)}</td>
                      <td style={TD}>{row.kd_kamar} — {row.nm_bangsal}</td>
                      <td style={TD}>Rp {formatRupiah(row.trf_kamar)}</td>
                      <td style={{ ...TD, whiteSpace: 'normal', minWidth: 160 }}>{row.diagnosa}</td>
                      <td style={{ ...TD, whiteSpace: 'normal', minWidth: 160 }}>{row.catatan}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
