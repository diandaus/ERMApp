import React from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { SepItem, formatTgl } from './ModalPengajuanSEP';

// SepPrintView — "Surat Elegibilitas Peserta" (SEP), layout 2 kolom persis
// contoh cetakan resmi yang dipasangkan user. Dipicu tombol "Lihat SEP" di
// dropdown [BPJS] Registrasi/IGD, hanya aktif kalau kunjungan itu SUDAH
// punya SEP (patient.no_sep terisi).
//
// Sumber data:
//  - bridging_sep lokal (GET /api/bridging/sep/by-no-rawat/:no_rawat) utk
//    sebagian besar field + no_reg (reg_periksa, ditambahkan backend).
//  - /api/admin/settings utk nama RS.
//  - Cek peserta LIVE ke BPJS (GET /api/bridging/peserta/nokartu/:no_kartu,
//    endpoint yg sama dipakai ModalPengajuanSEP) khusus utk "Kls. Hak" &
//    "Potensi PRB" — supaya datanya OTORITATIF dari BPJS, bukan dikarang.
//    Kalau gagal (mis. no. kartu tidak valid / BPJS unreachable), kedua
//    field ini ditampilkan "-" alih2 bikin seluruh halaman gagal tampil.
//
// Batasan jujur yg TIDAK bisa diisi krn datanya tidak kita punya:
//  - Jns.Kunjungan (mis. "Konsultasi dokter(pertama)") & Poli Perujuk —
//    tidak ada sumber lokal maupun endpoint BPJS yg sudah kita pakai utk
//    ini, ditampilkan "-".
//  - Barcode (No. SEP, CODE39 via lib 'jsbarcode') & QR (No. SEP, lib
//    'qrcode') di-generate LOKAL, bukan barcode/QR resmi BPJS (yg formatnya
//    tidak didokumentasikan/tidak kita punya endpoint-nya).
//  - Logo BPJS: frontend/public/images/bpjslogo.png (sudah ada).

type SepPrintViewProps = {
  noRawat: string;
  onClose: () => void;
};

const Row: React.FC<{ label: string; value: React.ReactNode; labelWidth?: number }> = ({ label, value, labelWidth = 92 }) => (
  <tr>
    <td style={{ width: labelWidth, padding: '2px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
    <td style={{ width: 10, padding: '2px 0', verticalAlign: 'top' }}>:</td>
    <td style={{ padding: '2px 0', verticalAlign: 'top' }}>{value}</td>
  </tr>
);

const jnsRawatLabel = (v: string) => (v === '1' ? 'Rawat Inap' : 'Rawat Jalan');

export const SepPrintView: React.FC<SepPrintViewProps> = ({ noRawat, onClose }) => {
  const [sep, setSep] = React.useState<SepItem | null>(null);
  const [namaInstansi, setNamaInstansi] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [klsHak, setKlsHak] = React.useState('-');
  const [potensiPrb, setPotensiPrb] = React.useState('-');
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
          const dataUrl = await QRCode.toDataURL(sepData.no_sep, { width: 110, margin: 1 });
          if (!cancelled) setQrDataUrl(dataUrl);
        }
        if (sepData?.no_kartu && sepData?.tglsep) {
          fetch(`/api/bridging/peserta/nokartu/${encodeURIComponent(sepData.no_kartu)}?tgl_sep=${sepData.tglsep.split('T')[0]}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (cancelled || !data) return;
              const p = data.peserta?.peserta ?? data.peserta ?? {};
              if (p.hakKelas?.keterangan || p.hakKelas?.kode) setKlsHak(p.hakKelas.keterangan || `Kelas ${p.hakKelas.kode}`);
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
      JsBarcode(barcodeRef.current, sep.no_sep, { format: 'CODE39', width: 1.4, height: 40, displayValue: false, margin: 0 });
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
      <div style={{ background: '#ffffff', borderRadius: 12, width: 900, maxWidth: '95%', padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.3)' }}>
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
          <div id="sep-print-area" style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#111827', border: '1px solid #9ca3af', borderRadius: 4, padding: 24 }}>
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td style={{ width: 260, verticalAlign: 'middle' }}>
                    <img src="/images/bpjslogo.png" alt="BPJS Kesehatan" style={{ maxWidth: 240, maxHeight: 60 }} />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>SURAT ELEGIBILITAS PESERTA</div>
                    <div style={{ fontSize: 15 }}>{namaInstansi}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Body 2 kolom */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  {/* Kolom kiri */}
                  <td style={{ width: '52%', verticalAlign: 'top', paddingRight: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <Row label="No. SEP" value={sep.no_sep} />
                        <Row label="Tgl. SEP" value={formatTgl(sep.tglsep)} />
                        <Row label="No. Kartu" value={<>{sep.no_kartu} ( MR : {sep.nomr} )</>} />
                        <Row label="Nama Peserta" value={sep.nama_pasien} />
                        <Row label="Tgl. Lahir" value={formatTgl(sep.tanggal_lahir)} />
                        <Row label="No.Telepon" value={sep.notelep || '-'} />
                        <Row label="Sub/Spesialis" value={sep.nmpolitujuan || '-'} />
                        <Row label="Dokter" value={sep.nmdpdjp || '-'} />
                        <Row label="Faskes Perujuk" value={sep.nmppkrujukan || '-'} />
                        <Row label="Diagnosa Awal" value={sep.nmdiagnosaawal || '-'} />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                      <tbody>
                        <Row label="Catatan" value={sep.catatan || '-'} />
                      </tbody>
                    </table>

                    <div style={{ marginTop: 20, fontSize: 11, fontStyle: 'italic', color: '#374151', lineHeight: 1.6 }}>
                      *Saya Menyetujui BPJS Kesehatan menggunakan informasi Medis Pasien jika diperlukan.<br />
                      **SEP bukan sebagai bukti penjaminan peserta<br />
                      Cetakan ke 1 {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID')}
                    </div>
                  </td>

                  {/* Kolom kanan */}
                  <td style={{ width: '48%', verticalAlign: 'top', borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
                    <div style={{ textAlign: 'center', marginBottom: 2 }}>
                      <svg ref={barcodeRef} style={{ maxWidth: '100%' }} />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 10 }}>Potensi PRB : {potensiPrb}</div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <Row label="No. Rawat" value={sep.no_rawat} labelWidth={100} />
                        <Row label="No. Reg" value={sep.no_reg || '-'} labelWidth={100} />
                        <Row label="Peserta" value={sep.peserta || '-'} labelWidth={100} />
                        <Row label="Jns. Rawat" value={jnsRawatLabel(sep.jnspelayanan)} labelWidth={100} />
                        <Row label="Jns.Kunjungan" value="-" labelWidth={100} />
                      </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                      <tbody>
                        <Row label="Poli Perujuk" value="-" labelWidth={100} />
                        <Row label="Kls. Hak" value={klsHak} labelWidth={100} />
                        <Row label="Kls. Rawat" value={sep.klsrawat ? `Kelas ${sep.klsrawat}` : '-'} labelWidth={100} />
                        <Row label="Penjamin" value="BPJS Kesehatan" labelWidth={100} />
                      </tbody>
                    </table>

                    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12 }}>Pasien/Keluarga Pasien</div>
                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                      {qrDataUrl && <img src={qrDataUrl} alt="QR No. SEP" width={100} />}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>{sep.nama_pasien}</div>
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
