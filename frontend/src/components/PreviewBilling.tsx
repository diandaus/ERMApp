import React from 'react';

type PreviewBillingProps = {
  noRawat: string;
  onClose: () => void;
};

type BillingRow = {
  no: string;
  nm_perawatan: string;
  pemisah: string;
  biaya: number;
  jumlah: number;
  tambahan: number;
  totalbiaya: number;
};

// Format angka ala Khanza (Valid.SetAngka) — pemisah ribuan koma, tanpa desimal.
const formatAngka = (n: number): string => Math.round(n || 0).toLocaleString('en-US');

export const PreviewBilling: React.FC<PreviewBillingProps> = ({ noRawat, onClose }) => {
  const [rows, setRows] = React.useState<BillingRow[]>([]);
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
        const res = await fetch(`/api/billing-preview/${noRawat}`);
        if (!res.ok) throw new Error('Gagal memuat data billing');
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

  const total = rows.reduce((sum, r) => sum + (r.totalbiaya || 0), 0);

  // Cetak — buka jendela baru berisi tabel yang sama persis (row info,
  // subtotal, item) lalu panggil print bawaan browser, supaya tidak perlu
  // menambah CSS @media print global yang bisa mempengaruhi halaman lain.
  const handleCetak = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const rowsHtml = rows.map((row, index) => {
      const noTrim = (row.no || '').trim();
      const namaTrim = (row.nm_perawatan || '').trim();

      if (index < 6) {
        return `<tr><td width="20%">${noTrim}</td><td width="40%" colspan="5">${namaTrim}</td></tr>`;
      }

      if (noTrim === '' && row.biaya === 0) {
        const isTotal = namaTrim.startsWith('Total');
        return `<tr><td width="20%">${noTrim}</td><td width="40%" colspan="5" style="text-align:${isTotal ? 'right' : 'left'}">${namaTrim}</td></tr>`;
      }

      return `<tr>
        <td width="20%">${row.no}</td>
        <td width="48%">${row.nm_perawatan}</td>
        <td width="9%" style="text-align:right">${row.biaya === 0 ? '' : formatAngka(row.biaya)}</td>
        <td width="2%" style="text-align:right">${row.jumlah === 0 ? '' : formatAngka(row.jumlah)}</td>
        <td width="9%" style="text-align:right">${row.tambahan === 0 ? '' : formatAngka(row.tambahan)}</td>
        <td width="10%" style="text-align:right">${row.totalbiaya === 0 ? '' : formatAngka(row.totalbiaya)}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Preview Billing - ${noRawat}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            h2 { font-size: 14px; margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 4px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
            tr.total td { font-weight: 700; font-size: 13px; background: #f3f4f6; border-top: 2px solid #333; }
          </style>
        </head>
        <body>
          <h2>Billing</h2>
          <table>
            <tbody>
              ${rowsHtml}
              <tr class="total">
                <td width="20%">TOTAL BIAYA</td>
                <td width="40%" colspan="5" style="text-align:right">${formatAngka(total)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

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
          width: '85%',
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
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Preview Billing</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleCetak}
              disabled={loading || !!error || rows.length === 0}
              title="Cetak"
              style={{
                width: 26,
                height: 26,
                padding: 0,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !!error || rows.length === 0 ? 'default' : 'pointer',
                opacity: loading || !!error || rows.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
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
              Tidak ada data billing untuk nomor rawat: {noRawat}
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map((row, index) => {
                  const noTrim = (row.no || '').trim();
                  const namaTrim = (row.nm_perawatan || '').trim();

                  if (index < 6) {
                    return (
                      <tr key={index}>
                        <td style={tdStyle} width="20%">{noTrim}</td>
                        <td style={tdStyle} width="40%" colSpan={5}>{namaTrim}</td>
                      </tr>
                    );
                  }

                  if (noTrim === '' && row.biaya === 0) {
                    const isTotal = namaTrim.startsWith('Total');
                    return (
                      <tr key={index}>
                        <td style={tdStyle} width="20%">{noTrim}</td>
                        <td style={{ ...tdStyle, textAlign: isTotal ? 'right' : 'left' }} colSpan={5}>{namaTrim}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={index}>
                      <td style={tdStyle} width="20%">{row.no}</td>
                      <td style={tdStyle} width="48%">{row.nm_perawatan}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="9%">{row.biaya === 0 ? '' : formatAngka(row.biaya)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="2%">{row.jumlah === 0 ? '' : formatAngka(row.jumlah)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="9%">{row.tambahan === 0 ? '' : formatAngka(row.tambahan)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="10%">{row.totalbiaya === 0 ? '' : formatAngka(row.totalbiaya)}</td>
                    </tr>
                  );
                })}
                <tr style={totalRowStyle}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }} width="20%">TOTAL BIAYA</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>:</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, textAlign: 'right' }} colSpan={4}>{formatAngka(total)}</td>
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
