import React from 'react';

type ModalDetailPemberianObatProps = {
  noRawat: string;
  onClose: () => void;
};

// Padanan tabModePO di DlgPemberianObat.java (Khanza Desktop): "Tgl.Beri",
// "Jam Beri", "No.Rawat", "No.R.M.", "Nama Pasien", "Kode Obat", "Nama
// Obat/Alkes", "Embalase", "Tuslah", "Jml", "Biaya Obat", "Total",
// "Harga Beli", "Gudang", "No.Batch", "No.Faktur". Dibuka dari klik kolom
// "Biaya Obat" di Monitoring Biaya Klaim BPJS (KlaimInacbg.tsx), padanan
// pola PreviewBilling.tsx yang sudah ada utk kolom Billing.
type DetailRow = {
  tgl_beri: string;
  jam_beri: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  kode_obat: string;
  nama_obat: string;
  embalase: number;
  tuslah: number;
  jml: number;
  biaya_obat: number;
  total: number;
  harga_beli: number;
  gudang: string;
  no_batch: string;
  no_faktur: string;
};

const formatAngka = (n: number): string => Math.round(n || 0).toLocaleString('en-US');

export const ModalDetailPemberianObat: React.FC<ModalDetailPemberianObatProps> = ({ noRawat, onClose }) => {
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
        const res = await fetch(`/api/detail-pemberian-obat/${noRawat}`);
        if (!res.ok) throw new Error('Gagal memuat data pemberian obat');
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

  const totalBiaya = rows.reduce((sum, r) => sum + (r.total || 0), 0);

  const columns: { key: keyof DetailRow; label: string; align?: 'right' }[] = [
    { key: 'tgl_beri', label: 'Tgl.Beri' },
    { key: 'jam_beri', label: 'Jam Beri' },
    { key: 'nama_obat', label: 'Nama Obat/Alkes' },
    { key: 'jml', label: 'Jml', align: 'right' },
    { key: 'biaya_obat', label: 'Biaya Obat', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'gudang', label: 'Gudang' },
  ];

  const numericKeys = new Set<keyof DetailRow>(['jml', 'biaya_obat', 'total']);

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
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Detail Pemberian Obat</span>
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
              Tidak ada data pemberian obat untuk nomor rawat: {noRawat}
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{ ...tdStyle, textAlign: col.align === 'right' ? 'right' : 'left' }}
                      >
                        {numericKeys.has(col.key) ? formatAngka(row[col.key] as number) : (row[col.key] as string) || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={totalRowStyle}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }} colSpan={5}>TOTAL BIAYA</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{formatAngka(totalBiaya)}</td>
                  <td style={tdStyle}></td>
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
