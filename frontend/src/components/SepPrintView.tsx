import React from 'react';
import QRCode from 'qrcode';
import { SepItem } from './ModalPengajuanSEP';

// SepPrintView — "Surat Elegibilitas Peserta" (SEP), padanan PERSIS
// tampilan cetak SEP asli sistem produksi (dikonfirmasi user dari
// screenshot cetakan sungguhan): 2 kolom label:value, TANPA barcode/PRB
// (versi ini beda dari template "cetaksep" yg sempat dicoba sebelumnya —
// user konfirmasi ini yg sebenarnya dipakai), teks persetujuan lengkap,
// tanggal format ISO (yyyy-mm-dd) apa adanya, QR + nama pasien + jam
// cetak di pojok kanan bawah.
//
// Dipicu tombol "Lihat SEP" (sebelah tombol [BPJS]) di Registrasi/IGD,
// hanya aktif kalau kunjungan itu SUDAH punya SEP (patient.no_sep terisi).
//
// Sumber data:
//  - bridging_sep lokal (GET /api/bridging/sep/by-no-rawat/:no_rawat).
//  - /api/admin/settings utk nama RS (dipakai di judul & butir consent b).
//  - Cek peserta LIVE ke BPJS (GET /api/bridging/peserta/nokartu/:no_kartu)
//    khusus utk "Kls.Hak" (hakKelas — kelas hak peserta sesuai BPJS) —
//    supaya datanya otoritatif dari BPJS, bukan dikarang. Gagal → tampil "-".
//
// Batasan jujur (field yg TIDAK ada sumber datanya, ditampilkan "-"):
//  - Poli Perujuk — dikonfirmasi dari source asli rptBridgingSEP3.jrxml
//    (JasperReports Khanza Desktop): field ini memang HARDCODE "-" di
//    reportnya sendiri, bukan field dinamis — jadi bukan keterbatasan kita.
//  - Kls.Rawat — belum jelas sumber datanya yg benar (BEDA dari Kls.Hak/
//    hakKelas di atas), jadi selalu "-" dulu sampai ada kejelasan.
//
// Jns.Kunjungan — dikonfirmasi PERSIS dari source rptBridgingSEP3.jrxml
// (2 baris terpisah, textFieldExpression):
//   baris 1: tujuankunjungan=="0" ? "Konsultasi dokter(pertama)" : "Kunjungan Kontrol(ulangan)"
//   baris 2: flagprosedur: "0"->"Prosedur Tidak Berkelanjutan", "1"->"Prosedur dan Terapi Berkelanjutan", ""->kosong
// (SEBELUMNYA sempat diarahkan ke Asesmen Pelayanan — itu keliru, source
// Jasper asli konfirmasi field yg benar adalah tujuankunjungan+flagprosedur).
// Logo BPJS: backend/uploads/images/bpjslogo.png (di-serve di /images/...).

type SepPrintViewProps = {
  noRawat: string;
  onClose: () => void;
};

const Row: React.FC<{ label: string; value: React.ReactNode; labelWidth?: number }> = ({ label, value, labelWidth = 140 }) => (
  <tr>
    <td style={{ width: labelWidth, padding: '2px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
    <td style={{ width: 14, padding: '2px 0', verticalAlign: 'top' }}>:</td>
    <td style={{ padding: '2px 0', verticalAlign: 'top' }}>{value}</td>
  </tr>
);

const jnsRawatLabel = (v: string) => (v === '1' ? 'R.Inap' : 'R.Jalan');
const kelaminLabel = (v: string) => (v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : '-');
const isoDate = (v: string) => (v ? v.split('T')[0] : '-');

// Persis textFieldExpression rptBridgingSEP3.jrxml (lihat komentar atas).
const jnsKunjunganLine1 = (v: string) => (v === '0' ? 'Konsultasi dokter(pertama)' : 'Kunjungan Kontrol(ulangan)');
const jnsKunjunganLine2 = (v: string) => {
  if (v === '0') return 'Prosedur Tidak Berkelanjutan';
  if (v === '1') return 'Prosedur dan Terapi Berkelanjutan';
  return '';
};

export const SepPrintView: React.FC<SepPrintViewProps> = ({ noRawat, onClose }) => {
  const [sep, setSep] = React.useState<SepItem | null>(null);
  const [namaInstansi, setNamaInstansi] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [klsHak, setKlsHak] = React.useState('-');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [potensiPrb, setPotensiPrb] = React.useState('');

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
        if (sepData?.no_kartu) {
          const dataUrl = await QRCode.toDataURL(sepData.no_kartu, { width: 75, margin: 1 });
          if (!cancelled) setQrDataUrl(dataUrl);
        }
        if (sepData?.no_kartu && sepData?.tglsep) {
          fetch(`/api/bridging/peserta/nokartu/${encodeURIComponent(sepData.no_kartu)}?tgl_sep=${sepData.tglsep.split('T')[0]}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (cancelled || !data) return;
              const p = data.peserta?.peserta ?? data.peserta ?? {};
              // Pakai kode + format "Kelas X" sendiri (bukan teks
              // keterangan mentah dari BPJS, mis. "KELAS I") supaya
              // konsisten dgn format "Kelas 1" yg dipakai di seluruh
              // halaman ini (Kls.Rawat dst).
              if (p.hakKelas?.kode) setKlsHak(`Kelas ${p.hakKelas.kode}`);
              else if (p.hakKelas?.keterangan) setKlsHak(p.hakKelas.keterangan);
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
      <div style={{ background: '#ffffff', borderRadius: 12, width: 950, maxWidth: '95%', padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.3)' }}>
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
          <div id="sep-print-area" style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#111827' }}>
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <tbody>
                <tr>
                  <td style={{ width: 280, verticalAlign: 'middle' }}>
                    <img src="/images/bpjslogo.png" alt="BPJS Kesehatan" style={{ maxWidth: 260, height: 'auto' }} />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>SURAT ELEGIBILITAS PESERTA</div>
                    <div style={{ fontSize: 15 }}>{namaInstansi}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Potensi PRB — cuma tampil kalau ada datanya (persis contoh
                RAHMAYANI yg tidak PRB, baris ini tidak ada sama sekali). */}
            {potensiPrb && (
              <div style={{ marginBottom: 8 }}>
                <b><u>{potensiPrb}</u></b>
              </div>
            )}

            {/* Body 2 kolom */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 20 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <Row label="No.SEP" value={sep.no_sep} />
                        <Row label="Tgl.SEP" value={isoDate(sep.tglsep)} />
                        <Row label="No.Kartu" value={<>{sep.no_kartu}  ( MR. {sep.nomr} )</>} />
                        <Row label="Nama Peserta" value={sep.nama_pasien} />
                        <Row label="Tgl.Lahir" value={<>{isoDate(sep.tanggal_lahir)}  Kelamin :{kelaminLabel(sep.jkel)}</>} />
                        <Row label="No.Telepon" value={sep.notelep || '-'} />
                        <Row label="Sub/Spesialis" value={sep.nmpolitujuan || '-'} />
                        <Row label="Dokter" value={sep.nmdpdjp || '-'} />
                        <Row label="Faskes Perujuk" value={sep.nmppkrujukan || '-'} />
                        <Row label="Diagnosa Awal" value={sep.diagawal ? `${sep.diagawal} - ${sep.nmdiagnosaawal}` : '-'} />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                      <tbody>
                        <Row label="Catatan" value={sep.catatan || '-'} />
                      </tbody>
                    </table>

                    {/* Persetujuan / disclaimer */}
                    <div style={{ fontSize: 9, lineHeight: 1.5, marginTop: 12 }}>
                      *Saya menyetujui BPJS Kesehatan untuk :<br />
                      a. membuka dan atau menggunakan informasi medis Pasien untuk keperluan administrasi, pembayaran asuransi atau<br />
                      &nbsp;&nbsp;&nbsp;jaminan pembiayaan kesehatan<br />
                      b. memberikan akses informasi medis atau riwayat pelayanan kepada dokter/tenaga medis pada {namaInstansi}<br />
                      &nbsp;&nbsp;&nbsp;untuk kepentingan pemeliharaan kesehatan, pengobatan, penyembuhan, dan perawatan Pasien<br />
                      *Saya mengetahui dan memahami :<br />
                      a. Rumah Sakit dapat melakukan koordinasi dengan PT Jasa Raharja / PT Taspen / PT ASABRI / BPJS Ketenagakerjaan atau<br />
                      &nbsp;&nbsp;&nbsp;Penjamin lainnya, jika Peserta merupakan pasien yang mengalami kecelakaan lalulintas dan / atau kecelakaan kerja<br />
                      b. SEP bukan sebagai bukti penjaminan peserta<br />
                      <br />
                      ** Dengan tampilnya luaran SEP elektronik ini merupakan hasil validasi terhadap eligibilitas Pasien secara elektronik<br />
                      &nbsp;&nbsp;(validasi finger print atau biometrik / sistem validasi lain)<br />
                      &nbsp;&nbsp;dan selanjutnya Pasien dapat mengakses pelayanan kesehatan rujukan sesuai ketentuan berlaku.<br />
                      &nbsp;&nbsp;Kebenaran dan keaslian atas informasi data Pasien menjadi tanggung jawab penuh FKRTL
                    </div>
                  </td>

                  <td style={{ width: '45%', verticalAlign: 'top', paddingLeft: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <Row label="Peserta" value={sep.peserta || '-'} labelWidth={110} />
                        <Row label="Jns.Rawat" value={jnsRawatLabel(sep.jnspelayanan)} labelWidth={110} />
                        <Row
                          label="Jns.Kunjungan"
                          value={
                            <>
                              - {jnsKunjunganLine1(sep.tujuankunjungan)}
                              {sep.flagprosedur && <><br />- {jnsKunjunganLine2(sep.flagprosedur)}</>}
                            </>
                          }
                          labelWidth={110}
                        />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                      <tbody>
                        <Row label="Poli Perujuk" value="-" labelWidth={110} />
                        <Row label="Kls.Hak" value={klsHak} labelWidth={110} />
                        <Row label="Kls.Rawat" value="-" labelWidth={110} />
                        <Row label="Penjamin" value="" labelWidth={110} />
                      </tbody>
                    </table>

                    <div style={{ textAlign: 'right', marginTop: 24 }}>
                      <div style={{ fontSize: 13 }}>Persetujuan</div>
                      <div style={{ fontSize: 13, marginBottom: 8 }}>Pasien/Keluarga Pasien</div>
                      {qrDataUrl && <img src={qrDataUrl} alt="QR" width={75} />}
                      <div style={{ fontSize: 13, marginTop: 4 }}>{sep.nama_pasien}</div>
                      <div style={{ fontSize: 11, marginTop: 8 }}>
                        Cetakan ke 1 {(() => {
                          const now = new Date();
                          const pad = (n: number) => String(n).padStart(2, '0');
                          const tgl = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
                          const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                          return `${tgl} ${jam}`;
                        })()}
                      </div>
                    </div>
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
