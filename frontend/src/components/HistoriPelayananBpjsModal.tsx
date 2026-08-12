import React from 'react';
import { localDateStr } from '../utils/date';

// HistoriPelayananBpjsModal — diekstrak dari ModalPengajuanSEP.tsx
// (historiPelayananModal) supaya bisa dipakai ulang persis sama dari
// Pendaftaran ("[BPJS] > Riwayat Kunjungan") tanpa perlu buka form SEP.
// Padanan method tampil(nomorrujukan) di dialog Histori Pelayanan BPJS
// Khanza Desktop: GET monitoring/HistoriPelayanan/NoKartu/{noKartu}/
// tglMulai/{tgl}/tglAkhir/{tgl}. No. Kartu tetap editable di sini (bukan
// cuma prop tetap) karena dipanggil juga dari kunjungan yang belum punya
// SEP (no_kartu belum diketahui, staf isi manual).
const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

type HistoriPelayananRow = {
  diagnosa: string; jenis_pelayanan: string; kelas_rawat: string; nama_peserta: string;
  no_kartu: string; no_sep: string; no_rujukan: string; poli: string;
  ppk_pelayanan: string; tgl_pulang_sep: string; tgl_sep: string;
};

const rentang90Hari = () => {
  const tglAkhir = localDateStr();
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return { tglMulai: localDateStr(d), tglAkhir };
};

type Props = {
  noKartu: string; // prefill (mis. dari bridging_sep kunjungan ini kalau sudah ada), tetap bisa diedit
  namaPasien?: string;
  onClose: () => void;
};

export const HistoriPelayananBpjsModal: React.FC<Props> = ({ noKartu, namaPasien, onClose }) => {
  const [noKartuInput, setNoKartuInput] = React.useState(noKartu);
  const [state, setState] = React.useState<{
    loading: boolean; error: string; items: HistoriPelayananRow[]; tglMulai: string; tglAkhir: string;
  }>(() => ({ loading: false, error: '', items: [], ...rentang90Hari() }));

  const fetchHistori = React.useCallback(async (nk: string, tglMulai: string, tglAkhir: string) => {
    if (!nk.trim()) {
      setState((prev) => ({ ...prev, loading: false, error: 'Isi No. Kartu dulu untuk melihat histori pelayanan', items: [] }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: '', tglMulai, tglAkhir }));
    try {
      const res = await fetch(`/api/bridging/histori-pelayanan/${encodeURIComponent(nk.trim())}?tgl_mulai=${tglMulai}&tgl_akhir=${tglAkhir}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil histori pelayanan');
      setState({ loading: false, error: '', items: Array.isArray(data.list) ? data.list : [], tglMulai, tglAkhir });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', items: [] }));
    }
  }, []);

  React.useEffect(() => {
    if (noKartu.trim()) {
      const { tglMulai, tglAkhir } = rentang90Hari();
      fetchHistori(noKartu, tglMulai, tglAkhir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
            Histori Pelayanan BPJS{namaPasien ? ` — ${namaPasien}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#374151' }}>No. Kartu</span>
          <input
            type="text"
            placeholder="No. Kartu BPJS"
            style={{ ...pillInput, flex: '0 0 200px' }}
            value={noKartuInput}
            onChange={(e) => setNoKartuInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchHistori(noKartuInput, state.tglMulai, state.tglAkhir); }}
          />
          <span style={{ fontSize: 12, color: '#374151' }}>Tgl. Mulai</span>
          <input
            type="date"
            style={{ ...pillInput, flex: '0 0 160px' }}
            value={state.tglMulai}
            onChange={(e) => setState((prev) => ({ ...prev, tglMulai: e.target.value }))}
          />
          <span style={{ fontSize: 12, color: '#374151' }}>Tgl. Akhir</span>
          <input
            type="date"
            style={{ ...pillInput, flex: '0 0 160px' }}
            value={state.tglAkhir}
            onChange={(e) => setState((prev) => ({ ...prev, tglAkhir: e.target.value }))}
          />
          <button
            type="button"
            onClick={() => fetchHistori(noKartuInput, state.tglMulai, state.tglAkhir)}
            style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            Cari
          </button>
        </div>

        {state.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Mencari histori pelayanan...</div>}
        {state.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{state.error}</div>}
        {!state.loading && !state.error && state.items.length === 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ditemukan histori pelayanan untuk No. Kartu & rentang tanggal ini.</div>
        )}

        {state.items.length > 0 && (
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  {['No.', 'Diagnosa', 'Jenis Pelayanan', 'Kelas Rawat', 'Nama Peserta', 'No.Kartu', 'No.SEP', 'No.Rujukan', 'Poli', 'PPK Pelayanan', 'Pulang SEP', 'Tgl.SEP'].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}.</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.diagnosa || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.jenis_pelayanan || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.kelas_rawat || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_peserta || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_kartu || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_sep || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.no_rujukan || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.poli || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.ppk_pelayanan || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.tgl_pulang_sep || '-'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.tgl_sep || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
