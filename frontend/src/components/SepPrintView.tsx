import React from 'react';
import QRCode from 'qrcode';
import { SepItem, formatTgl } from './ModalPengajuanSEP';

// SepPrintView — "Surat Elegibilitas Peserta" (SEP), padanan halaman cetak
// SEP versi lawas (anjungan/sep) yang dipasangkan user. Dipicu tombol
// "Lihat SEP" di dropdown [BPJS] Registrasi/IGD, hanya aktif kalau
// kunjungan itu SUDAH punya SEP (patient.no_sep terisi). Datanya diambil
// dari bridging_sep lokal (GET /api/bridging/sep/by-no-rawat/:no_rawat,
// endpoint yg sama dipakai mode Update SEP) + identitas RS (GET
// /api/admin/settings, dipakai jg di banyak modul lain).
//
// Batasan jujur dari referensi HTML aslinya:
//  - Barcode CODE39 & QR resmi BPJS (data_sep.qrCode) di template asli
//    berasal dari server BPJS/proxy khusus yg tidak kita punya datanya —
//    diganti QR lokal (lib 'qrcode', sudah dipakai jg di
//    DetailPemberianObat.tsx) berisi No. SEP saja, bukan QR verifikasi
//    resmi BPJS.
//  - potensi_prb & batas_rujukan (masa berlaku akhir) tidak tersimpan di
//    bridging_sep lokal, jadi ditampilkan "-" alih2 dikarang.
//  - Logo BPJS: taruh file di frontend/public/images/bpjslogo.png (folder
//    ini sudah ada, kosong) — otomatis ke-serve di /images/bpjslogo.png.

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
    <td style={{ width: 170, padding: '3px 0', verticalAlign: 'top' }}>{label}</td>
    <td style={{ width: 12, padding: '3px 0', verticalAlign: 'top' }}>:</td>
    <td style={{ padding: '3px 0', verticalAlign: 'top', width: label2 ? 320 : undefined }}>{value}</td>
    {label2 !== undefined && (
      <>
        <td style={{ width: 110, padding: '3px 0', verticalAlign: 'top' }}>{label2}</td>
        <td style={{ width: 12, padding: '3px 0', verticalAlign: 'top' }}>:</td>
        <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{value2}</td>
      </>
    )}
  </tr>
);

export const SepPrintView: React.FC<SepPrintViewProps> = ({ noRawat, onClose }) => {
  const [sep, setSep] = React.useState<SepItem | null>(null);
  const [namaInstansi, setNamaInstansi] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

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
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noRawat]);

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
          <div id="sep-print-area" style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#111827' }}>
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <tbody>
                <tr>
                  <td style={{ width: 240, verticalAlign: 'middle' }}>
                    <img src="/images/bpjslogo.png" alt="BPJS Kesehatan" style={{ maxWidth: 220, maxHeight: 60 }} />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}>SURAT ELEGIBILITAS PESERTA</div>
                    <div style={{ fontSize: 15, textAlign: 'center' }}>{namaInstansi}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <tbody>
                <tr>
                  <td style={{ width: 240 }} />
                  <td style={{ textAlign: 'center' }}>
                    {qrDataUrl && <img src={qrDataUrl} alt="QR No. SEP" width={110} />}
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
                  label2="COB" value2={sep.cob?.trim().startsWith('1') ? '1. Ya' : '0. Tidak'}
                />
                <Row
                  label="Tgl. Lahir" value={formatTgl(sep.tanggal_lahir)}
                  label2="Jns. Rawat" value2={sep.jnspelayanan === '1' ? '1. R. Inap' : '2. R. Jalan'}
                />
                <Row
                  label="No. Telepon" value={sep.notelep || '-'}
                  label2="Kls. Rawat" value2={`Kelas ${sep.klsrawat || '-'}`}
                />
                <Row label="Spesialis/Sub Spesialis" value={sep.nmpolitujuan} />
                <Row label="DPJP Yg Melayani" value={sep.nmdpdjp} />
                <Row label="Faskes Perujuk" value={sep.nmppkrujukan || '-'} />
                <Row label="Diagnosa Awal" value={sep.diagawal ? `${sep.diagawal} - ${sep.nmdiagnosaawal}` : '-'} />
                <Row label="Catatan" value={sep.catatan || '-'} />
              </tbody>
            </table>

            <div style={{ marginTop: 24, fontSize: 11, fontStyle: 'italic', color: '#374151', lineHeight: 1.6 }}>
              *Saya Menyetujui BPJS Kesehatan menggunakan informasi Medis Pasien jika diperlukan.<br />
              **SEP bukan sebagai bukti penjaminan peserta<br />
              Masa berlaku {formatTgl(sep.tglrujukan) || '-'} s/d -
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
