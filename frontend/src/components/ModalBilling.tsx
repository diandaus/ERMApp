import React from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Swal from 'sweetalert2';

type ModalBillingProps = {
  noRawat: string;
  namaPasien?: string;
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

// ModalBilling.tsx — dipakai tombol "Billing" di header GroupingInacbg.tsx.
// Beda dari PreviewBilling.tsx (yg cuma lihat+window.print, lihat
// CETAK_STANDAR.md §1 — proyek ini sengaja TIDAK pakai library PDF utk form
// cetak biasa): di sini perlu PDF asli yg bisa di-upload otomatis (bukan
// dialog print manual), jadi generate PDF sendiri via pdf-lib (sudah jadi
// dependency dari fitur gabung PDF Berkas Klaim). Hasilnya PDF sederhana
// (kop dasar + tabel), TIDAK sepersis kop-surat HTML window.print() —
// fungsinya utk arsip di Berkas Rawat, bukan cetak resmi ke pasien.
export const ModalBilling: React.FC<ModalBillingProps> = ({ noRawat, namaPasien, onClose }) => {
  const [rows, setRows] = React.useState<BillingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

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
        // obat_mode=jual — sengaja SELALU harga jual (biaya_obat, yg
        // ditagihkan ke pasien), lepas dari Casemix > Pengaturan > Preview
        // Billing > Set Preview Obat (yg dipakai PreviewBilling.tsx).
        const res = await fetch(`/api/billing-preview/${noRawat}?obat_mode=jual`);
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

  // Bangun PDF billing sederhana: kop dasar (nama RS, No.Rawat, Nama
  // Pasien) + tabel rincian + total. Baris header (index < 6, sub-total,
  // dst) dari billing-preview cuma teks 1 kolom — sama pola dgn
  // PreviewBilling.tsx.
  const buildBillingPdf = async (): Promise<Uint8Array> => {
    let namaRs = '';
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) namaRs = (await res.json())?.nama_instansi || '';
    } catch { /* lanjut tanpa nama RS kalau gagal ambil settings */ }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28; // A4 pt
    const pageHeight = 841.89;
    const margin = 40;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const text = (s: string, x: number, size = 9, bold = false) => {
      page.drawText(s, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
    };
    const newPageIfNeeded = () => {
      if (y < margin + 30) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    if (namaRs) { text(namaRs, margin, 14, true); y -= 20; }
    text(`No. Rawat : ${noRawat}`, margin, 10); y -= 14;
    if (namaPasien) { text(`Nama Pasien : ${namaPasien}`, margin, 10); y -= 14; }
    y -= 6;
    text('RINCIAN BILLING', margin, 12, true); y -= 18;

    const col = { uraian: margin, biaya: margin + 260, jumlah: margin + 340, tambahan: margin + 390, total: margin + 460 };
    text('Uraian', col.uraian, 9, true);
    text('Biaya', col.biaya, 9, true);
    text('Jml', col.jumlah, 9, true);
    text('Tambahan', col.tambahan, 9, true);
    text('Total', col.total, 9, true);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    y -= 12;

    rows.forEach((row) => {
      newPageIfNeeded();
      const noTrim = (row.no || '').trim();
      const namaTrim = (row.nm_perawatan || '').trim();
      const isTextOnlyRow = noTrim === '' && row.biaya === 0 && row.jumlah === 0 && row.tambahan === 0 && row.totalbiaya === 0;
      if (isTextOnlyRow) {
        text(namaTrim, col.uraian, 8, namaTrim.startsWith('Total'));
      } else {
        text(namaTrim.slice(0, 60), col.uraian, 8);
        if (row.biaya) text(formatAngka(row.biaya), col.biaya, 8);
        if (row.jumlah) text(String(row.jumlah), col.jumlah, 8);
        if (row.tambahan) text(formatAngka(row.tambahan), col.tambahan, 8);
        if (row.totalbiaya) text(formatAngka(row.totalbiaya), col.total, 8);
      }
      y -= 12;
    });

    newPageIfNeeded();
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    y -= 14;
    text('TOTAL BIAYA', col.uraian, 10, true);
    text(formatAngka(total), col.total, 10, true);

    return pdf.save();
  };

  // Simpan ke Berkas Rawat — generate PDF (di atas) lalu upload sbg
  // "Billing_<no_rawat>.pdf" ke folder fisik yg sama dgn TTE, lewat endpoint
  // generik yg sama dipakai Cetak Klaim (jenis "Gruper_") di GroupingInacbg.tsx.
  const handleSimpanBerkasRawat = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const pdfBytes = await buildBillingPdf();
      const form = new FormData();
      form.append('no_rawat', noRawat);
      form.append('jenis', 'Billing_');
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `Billing_${noRawat.replace(/\//g, '_')}.pdf`);
      const res = await fetch('/api/casemix/berkas-klaim-tte/save', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PDF billing');
      await Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'PDF Billing tersimpan ke Berkas Rawat', timer: 1800, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative',
          maxWidth: 800, width: '85%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Billing</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button" onClick={handleSimpanBerkasRawat} disabled={saving || loading || !!error || rows.length === 0}
              title={saving ? 'Menyimpan...' : 'Simpan ke Berkas Rawat'}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 6, border: '1px solid #d1d5db',
                background: '#ffffff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: saving || loading || !!error || rows.length === 0 ? 'default' : 'pointer',
                opacity: saving || loading || !!error || rows.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >&times;</button>
          </div>
        </div>

        {/* White Card Content */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 12, overflowY: 'auto', flex: 1, minHeight: 0, fontFamily: 'Tahoma, Arial, sans-serif' }}>
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
