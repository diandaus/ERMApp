import React from 'react';

type ModalDetailPeriksaLabProps = {
  noRawat: string;
  onClose: () => void;
};

// Rincian pemeriksaan Laboratorium rawat inap (status='Ranap') di balik
// kolom "Laboratorium" — Monitoring Biaya Klaim BPJS (KlaimInacbg.tsx).
// Desain baris disamakan dgn PreviewBilling.tsx / ModalDetailPemberianObat.tsx
// (headerless, tdStyle/totalRowStyle bersama).
type DetailRow = {
  tgl_periksa: string;
  jam: string;
  nm_perawatan: string;
  biaya: number;
};

const formatAngka = (n: number): string => Math.round(n || 0).toLocaleString('en-US');

export const ModalDetailPeriksaLab: React.FC<ModalDetailPeriksaLabProps> = ({ noRawat, onClose }) => {
  const [rows, setRows] = React.useState<DetailRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const load = async () => {
      if (!noRawat) {
        setError('No. Rawat tidak lengkap');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/detail-periksa-lab/${noRawat}`);
        if (!res.ok) throw new Error('Gagal memuat data pemeriksaan lab');
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [noRawat]);

  const totalBiaya = rows.reduce((sum, r) => sum + (r.biaya || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          maxWidth: 800,
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Detail Pemeriksaan Laboratorium</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* White Card Content */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #d1d5db',
            padding: 12,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            fontFamily: 'Tahoma, Arial, sans-serif',
          }}
        >
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 12 }}>Memuat...</div>}
          {error && <div style={{ color: '#dc2626', padding: 12, fontSize: 12 }}>{error}</div>}

          {!loading && !error && rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
              Tidak ada data pemeriksaan lab untuk nomor rawat: {noRawat}
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td style={tdStyle}>{row.tgl_periksa || '-'}</td>
                    <td style={tdStyle}>{row.jam || '-'}</td>
                    <td style={tdStyle}>{row.nm_perawatan || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatAngka(row.biaya)}</td>
                  </tr>
                ))}
                <tr style={totalRowStyle}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }} colSpan={3}>TOTAL BIAYA</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{formatAngka(totalBiaya)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const tdStyle: React.CSSProperties = {
  padding: 4,
  borderBottom: '1px solid #e0e0e0',
  fontSize: 12,
};

const totalRowStyle: React.CSSProperties = {
  background: '#f3f4f6',
  borderTop: '2px solid #333',
};
