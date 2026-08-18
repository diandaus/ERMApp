import React from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { SepItem, formatTgl } from './ModalPengajuanSEP';

// SepPrintView — "Surat Elegibilitas Peserta" (SEP), padanan PERSIS
// template cetak SEP asli (fieldset "cetaksep") yang dipasangkan user:
// single-column, label:value berpasangan per baris (sebagian baris 2
// pasang label:value), PRB bold-underline di atas barcode CODE39, QR di
// pojok kanan bawah berisi teks "No.SEP: {no_sep}", tombol Cetak/Tutup.
//
// Dipicu tombol "Lihat SEP" (sebelah tombol [BPJS]) di Registrasi/IGD,
// hanya aktif kalau kunjungan itu SUDAH punya SEP (patient.no_sep terisi).
//
// Sumber data:
//  - bridging_sep lokal (GET /api/bridging/sep/by-no-rawat/:no_rawat).
//  - /api/admin/settings utk nama RS.
//  - Cek peserta LIVE ke BPJS (GET /api/bridging/peserta/nokartu/:no_kartu,
//    endpoint yg sama dipakai ModalPengajuanSEP) khusus utk "potensi_prb"
//    (informasi.prolanisPRB/prb) — supaya datanya otoritatif dari BPJS,
//    bukan dikarang. Kalau gagal, baris itu ditampilkan kosong (spt
//    isset_or() di template asli kalau datanya tidak ada).
//
// Batasan jujur: barcode CODE39 (lib 'jsbarcode') & QR (lib 'qrcode')
// di-generate LOKAL di browser — bukan dari {?=url()?}/api/barcode/...
// atau $data_sep.qrCode (proxy/endpoint BPJS khusus yg tidak kita punya).
// batas_rujukan (akhir masa berlaku) juga tidak tersimpan lokal, jadi
// ditampilkan "-" alih2 dikarang.
// Logo BPJS: backend/uploads/images/bpjslogo.png (di-serve di /images/...).

type SepPrintViewProps = {
  noRawat: string;
  onClose: () => void;
};

const Row: React.FC<{
  label: string;
  value: React.ReactNode;
  label2?: string;
  value2?: React.ReactNode;
}> = ({ label, value, label2, value2 }) => (
  <tr>
    <td style={{ width: 170, padding: '2px 0', verticalAlign: 'top' }}>{label}</td>
    <td style={{ width: 12, padding: '2px 0', verticalAlign: 'top' }}>:</td>
    <td style={{ padding: '2px 0', verticalAlign: 'top', width: label2 ? 300 : undefined }}>{value}</td>
    {label2 !== undefined && (
      <>
        <td style={{ width: 90, padding: '2px 0', verticalAlign: 'top' }}>{label2}</td>
        <td style={{ width: 12, padding: '2px 0', verticalAlign: 'top' }}>:</td>
        <td style={{ padding: '2px 0', verticalAlign: 'top' }}>{value2}</td>
      </>
    )}
  </tr>
);

const jnsRawatLabel = (v: string) => (v === '1' ? '1. R. Inap' : '2. R.Jalan');
const cobLabel = (v?: string) => (v?.trim().startsWith('1') ? '1. Ya' : '0. Tidak');

export const SepPrintView: React.FC<SepPrintViewProps> = ({ noRawat, onClose }) => {
  const [sep, setSep] = React.useState<SepItem | null>(null);
  const [namaInstansi, setNamaInstansi] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [potensiPrb, setPotensiPrb] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const barcodeRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [sepRes, settingsRes] = await Promise.all([
          fetch(`/api/bridging/sep/by-no-rawat/${encodeURIComponent(noRawat)}`),
          fetch('/api/admin/settings'),
        ]);
        const sepData = await sepRes.json();
        if (!sepRes.ok) throw new Error(sepData.error || 'Gagal mengambil data SEP');
        if (cancelled) return;
        setSep(sepData);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (!cancelled) setNamaInstansi(settingsData?.nama_instansi || '');
        }
        if (sepData?.no_sep) {
          const dataUrl = await QRCode.toDataURL(`No.SEP: ${sepData.no_sep}`, { width: 90, margin: 1 });
          if (!cancelled) setQrDataUrl(dataUrl);
        }
        if (sepData?.no_kartu && sepData?.tglsep) {
          fetch(`/api/bridging/peserta/nokartu/${encodeURIComponent(sepData.no_kartu)}?tgl_sep=${sepData.tglsep.split('T')[0]}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (cancelled || !data) return;
              const p = data.peserta?.peserta ?? data.peserta ?? {};
              const prb = p.informasi?.prolanisPRB || p.informasi?.prb;
              if (prb) setPotensiPrb(prb);
            })
            .catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noRawat]);

  React.useEffect(() => {
    if (!sep?.no_sep || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, sep.no_sep, { format: 'CODE39', width: 1.6, height: 55, displayValue: false, margin: 0 });
    } catch {
      // No. SEP kosong/format tidak valid utk CODE39 — biarkan area barcode kosong.
    }
  }, [sep?.no_sep]);

  const handlePrint = () => window.print();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10010, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 0' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sep-print-area, #sep-print-area * { visibility: visible; }
          #sep-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .sep-no-print { display: none !important; }
        }
      `}</style>
      <div style={{ background: '#ffffff', borderRadius: 12, width: 850, maxWidth: '95%', padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.3)' }}>
        <div className="sep-no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!sep}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: sep ? '#2563eb' : '#9ca3af', color: '#fff', cursor: sep ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500 }}
          >
            Cetak SEP
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data SEP...</div>}
        {error && <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>}

        {!loading && !error && sep && (
          <div id="sep-print-area" style={{ fontFamily: 'Arial, sans-serif', fontSize: 16, color: '#111827' }}>
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: 420, verticalAlign: 'middle' }}>
                    <img src="/images/bpjslogo.png" alt="BPJS Kesehatan" width={400} height={68} style={{ maxWidth: '100%', height: 'auto' }} />
                  </td>
                  <td style={{ width: 580, verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center' }}>SURAT ELEGIBILITAS PESERTA</div>
                    <div style={{ fontSize: 21, textAlign: 'center' }}>{namaInstansi}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* PRB + Barcode */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: 420, verticalAlign: 'middle' }}>
                    <b><u>{potensiPrb}</u></b>
                  </td>
                  <td style={{ width: 580, textAlign: 'center' }}>
                    <svg ref={barcodeRef} style={{ maxWidth: 200 }} />
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="No. SEP" value={sep.no_sep} />
                <Row label="Tgl. SEP" value={formatTgl(sep.tglsep)} />
                <Row
                  label="No. Kartu" value={<>{sep.no_kartu} (MR: {sep.nomr})</>}
                  label2="Peserta" value2={sep.peserta}
                />
                <Row
                  label="Nama Peserta" value={<>{sep.nama_pasien} ({sep.jkel})</>}
                  label2="COB" value2={cobLabel(sep.cob)}
                />
                <Row
                  label="Tgl. Lahir" value={formatTgl(sep.tanggal_lahir)}
                  label2="Jns. Rawat" value2={jnsRawatLabel(sep.jnspelayanan)}
                />
                <Row
                  label="No. Telepon" value={sep.notelep || '-'}
                  label2="Kls. Rawat" value2={sep.klsrawat ? `Kelas ${sep.klsrawat}` : '-'}
                />
                <Row label="Spesialis/Sub Spesialis" value={sep.nmpolitujuan || '-'} />
                <Row label="DPJP Yg Melayani" value={sep.nmdpdjp || '-'} />
                <Row label="Faskes Perujuk" value={sep.nmppkrujukan || '-'} />
                <Row label="Diagnosa Awal" value={sep.diagawal ? `${sep.diagawal} - ${sep.nmdiagnosaawal}` : '-'} />
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: 170, padding: '2px 0', verticalAlign: 'top' }}>Catatan</td>
                  <td style={{ width: 12, padding: '2px 0', verticalAlign: 'top' }}>:</td>
                  <td style={{ width: 550, padding: '2px 0', verticalAlign: 'top' }}>{sep.catatan || '-'}</td>
                  <td style={{ width: 200, padding: '2px 0', verticalAlign: 'bottom', textAlign: 'center' }}>Pasien/Keluarga Pasien</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ verticalAlign: 'top', paddingTop: 8 }}>
                    <i style={{ fontSize: 11 }}>
                      *Saya Menyetujui BPJS Kesehatan menggunakan informasi Medis Pasien jika diperlukan.<br />
                      **SEP bukan sebagai bukti penjaminan peserta<br />
                      Cetakan ke 1 {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID')}<br />
                      Masa berlaku {formatTgl(sep.tglrujukan) || '-'} s/d -
                    </i>
                  </td>
                  <td style={{ verticalAlign: 'bottom', textAlign: 'center', padding: 0 }}>
                    {qrDataUrl && <img src={qrDataUrl} alt="QR No. SEP" width={90} />}
                    <br />
                    {sep.nama_pasien}
                    <br />
                    -----------------------------------
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
