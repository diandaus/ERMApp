import React from 'react';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ModalHasilRadiologi — "Input Data Hasil Periksa Radiologi", padanan
// header form DlgPeriksaRadiologi.java (Khanza Desktop): No.Rawat/No.RM/
// Pasien, Dokter P.J. (default dari set_pjlab.kd_dokterrad — Penanggung
// Jawab Radiologi, bisa diganti manual), Petugas (radiografer, dicari
// manual), Dokter Perujuk (tetap, dari permintaan), Tanggal+Jam (checkbox
// "Otomatis" = pakai waktu sekarang, sama seperti ChkJln di Java). Di
// bawah header: gambar dari PACS Orthanc (kiri, reuse endpoint preview yg
// sama dgn ModalityWorklist.tsx) dan input Hasil/Bacaan (kanan).

type ExamDetail = { kd_jenis_prw: string; nm_perawatan: string };

type OrderDetail = {
  noorder: string; no_rawat: string; no_rkm_medis: string; nm_pasien: string;
  dokter_perujuk: string; nm_dokter: string; status: string;
  diagnosa_klinis: string; informasi_tambahan: string;
  sudah_ada_hasil: boolean; pemeriksaan: ExamDetail[];
  kd_dokter_pj: string; nm_dokter_pj: string;
  hasil_terakhir: string;
};

type ExamForm = {
  kd_jenis_prw: string; nm_perawatan: string; checked: boolean;
  proyeksi: string; kV: string; mAS: string; FFD: string; BSF: string; inak: string; jml_penyinaran: string; dosis: string;
};

type DicomInstance = { id: string; series_id: string; modality: string };
type DicomSeries = { series_id: string; modality: string; study_date: string; instance_count: number; webviewer_url: string };

const pill: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', background: '#ffffff', color: '#111827',
};
const pillReadOnly: React.CSSProperties = { ...pill, background: '#f9fafb', color: '#374151' };
const labelSm: React.CSSProperties = { fontSize: 13, color: '#374151', flexShrink: 0, width: 96 };
const clipBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 4, border: '1px solid #e5e7eb', background: '#ffffff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, color: '#9ca3af',
};

const ClipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

type Props = { noorder: string; nip?: string; onClose: () => void; onSaved: () => void };

export const ModalHasilRadiologi: React.FC<Props> = ({ noorder, nip, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [detail, setDetail] = React.useState<OrderDetail | null>(null);
  const [exams, setExams] = React.useState<ExamForm[]>([]);
  const [hasil, setHasil] = React.useState('');

  const [petugasQuery, setPetugasQuery] = React.useState('');
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasList, setPetugasList] = React.useState<{ nip: string; nama: string }[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);

  const [dokterPjQuery, setDokterPjQuery] = React.useState('');
  const [kdDokterPj, setKdDokterPj] = React.useState('');
  const [dokterPjList, setDokterPjList] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [showDokterPjDropdown, setShowDokterPjDropdown] = React.useState(false);

  const [otomatisJam, setOtomatisJam] = React.useState(true);
  const [tglPeriksa, setTglPeriksa] = React.useState('');
  const [jamPeriksa, setJamPeriksa] = React.useState('');

  const [foto, setFoto] = React.useState<{ instances: DicomInstance[]; series: DicomSeries[] }>({ instances: [], series: [] });
  const [loadingFoto, setLoadingFoto] = React.useState(false);
  const [previewFoto, setPreviewFoto] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [previewingTtd, setPreviewingTtd] = React.useState(false);
  const [requestingOtp, setRequestingOtp] = React.useState(false);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan');
        setDetail(data);
        setExams((data.pemeriksaan || []).map((e: ExamDetail) => ({
          kd_jenis_prw: e.kd_jenis_prw, nm_perawatan: e.nm_perawatan, checked: true,
          proyeksi: '', kV: '', mAS: '', FFD: '', BSF: '', inak: '', jml_penyinaran: '', dosis: '',
        })));
        if (data.kd_dokter_pj) {
          setKdDokterPj(data.kd_dokter_pj);
          setDokterPjQuery(data.nm_dokter_pj || '');
          setDokterPjList([{ kd_dokter: data.kd_dokter_pj, nm_dokter: data.nm_dokter_pj || '' }]);
        }
        if (data.hasil_terakhir) {
          setHasil(data.hasil_terakhir);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    })();
    const now = new Date();
    setTglPeriksa(todayStr());
    setJamPeriksa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noorder]);

  React.useEffect(() => {
    (async () => {
      setLoadingFoto(true);
      try {
        const res = await fetch(`/api/satu-sehat/dicom/preview-list/${noorder}`);
        const data = await res.json();
        if (res.ok) {
          setFoto({ instances: Array.isArray(data.instances) ? data.instances : [], series: Array.isArray(data.series) ? data.series : [] });
        }
      } catch { /* silent — foto opsional */ }
      finally { setLoadingFoto(false); }
    })();
  }, [noorder]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(petugasQuery)}`);
      if (res.ok) setPetugasList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [petugasQuery]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/dokter?search=${encodeURIComponent(dokterPjQuery)}`);
      if (res.ok) setDokterPjList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [dokterPjQuery]);

  // Petugas default = user yg sedang login (nip), padanan KdPtg.setText
  // (akses.getkode()) di DlgPeriksaRadiologi.java saat form dibuka — cari
  // by nip persis (bukan substring) supaya tidak salah ambil petugas lain.
  React.useEffect(() => {
    if (!nip) return;
    (async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(nip)}`);
      if (!res.ok) return;
      const list: { nip: string; nama: string }[] = await res.json();
      const match = list.find((p) => p.nip === nip);
      if (match) {
        setPetugasNip(match.nip);
        setPetugasQuery(match.nama);
      }
    })();
  }, [nip]);

  const updateExam = (idx: number, patch: Partial<ExamForm>) => {
    setExams((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  // umurDariTglLahir — padanan persis calculateAgeDetails() di
  // ModalCariPasien.tsx, diformat "X Th Y Bl Z Hr" spt pasien.umur Khanza
  // (bukan cuma "X th" spt tampilan lain di app ini).
  const umurDariTglLahir = (tglLahir: string): string => {
    if (!tglLahir || tglLahir === '0000-00-00') return '-';
    const birth = new Date(tglLahir);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    if (days < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return `${years} Th ${months} Bl ${days} Hr`;
  };

  // handleCetak — "HASIL PEMERIKSAAN RADIOLOGI", padanan
  // BtnPrint1ActionPerformed di DlgCariPeriksaRadiologi.java (kop RS, info
  // pasien+pemeriksaan 2 kolom, kotak Hasil Pemeriksaan, tanda tangan
  // elektronik 2 kolom dgn QR code). Pola cetak SAMA dgn
  // DetailPemberianObat.tsx: buka jendela baru, tulis HTML siap-print,
  // window.print() bawaan browser (user pilih "Simpan sebagai PDF") —
  // proyek ini belum punya library PDF sisi server. Datanya dari
  // GET /api/radiologi/cetak/:noorder (backend ambil sesi periksa_radiologi
  // TERBARU utk no_rawat ini, bukan cuma apa yg sedang diketik di form —
  // jadi tombol ini cuma aktif kalau hasilnya SUDAH tersimpan).
  const handleCetak = async () => {
    setPrinting(true);
    try {
      const [dataRes, settingsRes] = await Promise.all([
        fetch(`/api/radiologi/cetak/${encodeURIComponent(noorder)}`),
        fetch('/api/admin/settings'),
      ]);
      const data = await dataRes.json();
      if (!dataRes.ok) throw new Error(data.error || 'Gagal memuat data cetak');
      let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
      if (settingsRes.ok) settings = await settingsRes.json();

      const printWindow = window.open('', '_blank', 'width=900,height=1000');
      if (!printWindow) return;

      const logoSrc = settings.logo_url
        ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
        : '';
      const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
        .filter(Boolean).join('<br/>');

      const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const fingerPj =
        `Dikeluarkan di ${settings.nama_instansi}, Kabupaten/Kota ${settings.kota_rs}\n` +
        `Ditandatangani secara elektronik oleh ${data.penanggung_jawab || '-'}\n` +
        `ID ${data.kd_penanggung_jawab || '-'}\n${tanggalCetak}`;
      const fingerPetugas =
        `Dikeluarkan di ${settings.nama_instansi}, Kabupaten/Kota ${settings.kota_rs}\n` +
        `Ditandatangani secara elektronik oleh ${data.petugas_nama || '-'}\n` +
        `ID ${data.petugas_nip || '-'}\n${tanggalCetak}`;

      let qrPj = '';
      let qrPetugas = '';
      try { qrPj = await QRCode.toDataURL(fingerPj, { width: 80, margin: 1 }); } catch { /* lanjut tanpa QR */ }
      try { qrPetugas = await QRCode.toDataURL(fingerPetugas, { width: 80, margin: 1 }); } catch { /* lanjut tanpa QR */ }

      const hasilHtml = (data.hasil || '-').split('\n').map((line: string) => `<div>${line || '&nbsp;'}</div>`).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Hasil Pemeriksaan Radiologi - ${data.no_periksa}</title>
            <style>
              @page { size: 210mm 297mm; margin-top: 14px; }
              body { font-family: Tahoma, Arial, sans-serif; font-size: 11pt; padding: 0 16px 16px; color: #000; }
              table.tbl_form td { border: 0; vertical-align: middle; }
              hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
              table.info { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 10px; font-size: 11pt; }
              table.info td { padding: 2px 4px; vertical-align: top; }
              table.info td.label { white-space: nowrap; }
              table.info td.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
              table.info td.nowrap { white-space: nowrap; }
              .hasil-box { border: 1px solid #333; border-radius: 4px; padding: 10px; min-height: 100px; margin-top: 6px; font-size: 11pt; line-height: 1.6; }
              .ttd { width: 45%; text-align: center; font-size: 11pt; }
              .rs-nama { font-size: 14pt; }
              .rs-alamat { font-size: 9pt; }
              .judul { font-size: 12pt; }
            </style>
          </head>
          <body>
            <table width="100%" align="center" border="0" class="tbl_form" cellspacing="0" cellpadding="0">
              <tr>
                <td width="15%">${logoSrc ? `<img width="65" height="65" src="${logoSrc}" />` : ''}</td>
                <td width="70%">
                  <center>
                    <div class="rs-nama">${settings.nama_instansi}</div>
                    <div class="rs-alamat">${settings.alamat}${kontakEmail ? `<br/>${kontakEmail}` : ''}</div>
                  </center>
                </td>
                <td width="15%"></td>
              </tr>
            </table>
            <hr/>
            <center><div class="judul">HASIL PEMERIKSAAN RADIOLOGI</div></center>

            <table class="info">
              <colgroup>
                <col style="width:14%"><col style="width:2%"><col style="width:36%">
                <col style="width:20%"><col style="width:2%"><col style="width:26%">
              </colgroup>
              <tr>
                <td class="label">No.RM</td><td class="sep">:</td><td>${data.no_rm}</td>
                <td class="label">Penanggung Jawab</td><td class="sep">:</td><td class="nowrap">${data.penanggung_jawab || '-'}</td>
              </tr>
              <tr>
                <td class="label">Nama Pasien</td><td class="sep">:</td><td>${data.nama_pasien}</td>
                <td class="label">Dokter Pengirim</td><td class="sep">:</td><td class="nowrap">${data.dokter_pengirim || '-'}</td>
              </tr>
              <tr>
                <td class="label">JK/Umur</td><td class="sep">:</td><td>${data.jk || '-'} / ${umurDariTglLahir(data.tgl_lahir)}</td>
                <td class="label">Tgl.Pemeriksaan</td><td class="sep">:</td><td>${data.tgl_pemeriksaan}</td>
              </tr>
              <tr>
                <td class="label">Alamat</td><td class="sep">:</td><td class="truncate" title="${data.alamat || '-'}">${data.alamat || '-'}</td>
                <td class="label">Jam Pemeriksaan</td><td class="sep">:</td><td>${data.jam_pemeriksaan}</td>
              </tr>
              <tr>
                <td class="label">No.Periksa</td><td class="sep">:</td><td>${data.no_periksa}</td>
                <td class="label">Poli</td><td class="sep">:</td><td>${data.poli || '-'}</td>
              </tr>
              <tr>
                <td class="label">Pemeriksaan</td><td class="sep">:</td><td colspan="4">${data.pemeriksaan}</td>
              </tr>
            </table>

            <div style="margin-top:14px;">Hasil Pemeriksaan :</div>
            <div class="hasil-box">${hasilHtml}</div>

            <table width="100%" style="margin-top:24px;">
              <tr>
                <td></td>
                <td class="ttd">Tgl.Cetak : ${tanggalCetak}</td>
              </tr>
              <tr>
                <td class="ttd">
                  <div>Penanggung Jawab</div>
                  ${qrPj ? `<img src="${qrPj}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
                  <div>${data.penanggung_jawab || '-'}</div>
                </td>
                <td class="ttd">
                  <div>Petugas Radiologi</div>
                  ${qrPetugas ? `<img src="${qrPetugas}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
                  <div>${data.petugas_nama || '-'}</div>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => printWindow.print();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPrinting(false);
    }
  };

  // Ukuran kotak tanda tangan elektronik Peruri (Penanggung Jawab, kiri) —
  // POSISI-nya (x/y) dihitung DINAMIS di dalam buildRadiologiPdfUntukTtd,
  // persis di bawah kotak "Hasil Pemeriksaan" (bukan posisi tetap di dasar
  // halaman) — supaya kalau hasil pemeriksaannya pendek/panjang, kotak TTD
  // ikut naik/turun mengikuti, tidak numpuk atau kejauhan dari kotak hasil.
  // Peruri sendiri sejauh ini cuma terima koordinat X/Y eksplisit (belum
  // ketemu fitur setara "tag_koordinat" Sertisign di curl manapun yg
  // dikirim user — beda vendor, jadi TIDAK diasumsikan ada), jadi
  // "otomatis"-nya dikerjakan di sisi kita: kita yg hitung Y-nya, bukan
  // Peruri yg deteksi sendiri dari isi dokumen.
  const SIGN_BOX_WIDTH = 160;
  const SIGN_BOX_HEIGHT = 80;
  const SIGN_BOX_GAP_BELOW_HASIL = 16;

  // buildRadiologiPdfUntukTtd — PENGECUALIAN dari CETAK_STANDAR.md §1
  // (sama pola dgn buildBillingPdf di ModalBilling.tsx): fitur kirim ke
  // Peruri genuinely butuh byte PDF asli (base64Document), window.print()
  // tidak bisa diambil sbg byte oleh JS. Layout best-effort mendekati
  // handleCetak (BUKAN identik — font Helvetica pdf-lib, bukan Tahoma asli).
  const buildRadiologiPdfUntukTtd = async (): Promise<{
    pdfBytes: Uint8Array; email: string; namaDokterPj: string;
    signBox: { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };
  }> => {
    if (!kdDokterPj) {
      throw new Error('Pilih Dokter P.J. dulu.');
    }
    // Dokter P.J. & email-nya diambil dari STATE FORM YANG SEDANG DIPILIH
    // (kdDokterPj/dokterPjQuery), BUKAN dari /api/radiologi/cetak/:noorder
    // — endpoint itu balikin data sesi TERSIMPAN TERAKHIR di DB, yg bisa
    // beda dari dokter yg baru saja dipilih user di form ini tapi belum
    // di-"Simpan Hasil" (ini akar penyebab bug "nama di pesan sukses
    // ternyata dokter perujuk, bukan dokter P.J. yg dipilih di form").
    const [dataRes, settingsRes, emailRes] = await Promise.all([
      fetch(`/api/radiologi/cetak/${encodeURIComponent(noorder)}`),
      fetch('/api/admin/settings'),
      fetch(`/api/dokter/${encodeURIComponent(kdDokterPj)}/email`),
    ]);
    const data = await dataRes.json();
    if (!dataRes.ok) throw new Error(data.error || 'Gagal memuat data cetak');
    let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
    if (settingsRes.ok) settings = await settingsRes.json();
    const emailData = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) throw new Error(emailData.error || 'Dokter P.J. tidak ditemukan');
    const namaDokterPj = dokterPjQuery || emailData.nm_dokter || '-';
    if (!emailData.email) {
      throw new Error(`Email dokter penanggung jawab (${namaDokterPj}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
    }
    const emailDokterPj = emailData.email as string;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const text = (s: string, x: number, size = 10, bold = false) => {
      page.drawText(s, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
    };
    const centerText = (s: string, size = 10, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: (pageWidth - w) / 2, y, size, font: f, color: rgb(0, 0, 0) });
    };
    // wrapText — pecah baris panjang sesuai lebar kolom (px), dipakai
    // Hasil Pemeriksaan yg bisa berisi paragraf panjang.
    const wrapText = (s: string, maxWidth: number, size = 10): string[] => {
      const words = s.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    // Kop 3-kolom PERSIS buildBillingPdf (ModalBilling.tsx, "Preview
    // Upload"/"Simpan ke Berkas Rawat") — 20% logo / 60% nama+alamat+
    // kontak+email / 20% kosong (di Billing kolom ke-3 dipakai cara
    // bayar, di sini tidak ada info setara jadi dibiarkan kosong, TAPI
    // proporsi kolom & posisi logo/teksnya disamakan persis).
    let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | Awaited<ReturnType<typeof pdf.embedJpg>> | null = null;
    if (settings.logo_url) {
      try {
        const logoSrc = settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url;
        const imgRes = await fetch(logoSrc);
        if (imgRes.ok) {
          const bytes = await imgRes.arrayBuffer();
          const isJpg = /\.(jpe?g)($|\?)/i.test(logoSrc) || (imgRes.headers.get('content-type') || '').includes('jpeg');
          logoImg = isJpg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        }
      } catch { /* lanjut tanpa logo kalau gagal fetch/embed */ }
    }

    const contentWidth = pageWidth - margin * 2;
    const col1X = margin;
    const col2X = margin + contentWidth * 0.20;
    const col2Width = contentWidth * 0.60;
    const centerInCol = (s: string, colX: number, colWidth: number, size = 9, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: colX + (colWidth - w) / 2, y, size, font: f, color: rgb(0, 0, 0) });
    };

    const kopTop = y;
    const logoSize = 45; // PERSIS buildBillingPdf (width/height 45)
    if (logoImg) {
      page.drawImage(logoImg, { x: col1X, y: kopTop - logoSize + 8, width: logoSize, height: logoSize });
    }
    if (settings.nama_instansi) { centerInCol(settings.nama_instansi, col2X, col2Width, 14, false); y -= 11; }
    if (settings.alamat) { centerInCol(settings.alamat, col2X, col2Width, 9); y -= 11; }
    if (settings.kontak) { centerInCol(settings.kontak, col2X, col2Width, 9); y -= 11; }
    if (settings.email_rs) { centerInCol(`E-mail : ${settings.email_rs}`, col2X, col2Width, 9); y -= 0; }
    // Batas minimum tinggi kop — PERSIS perhitungan buildBillingPdf (logo
    // digambar mulai kopTop-logoSize+8, jadi tepi bawahnya di situ, bukan
    // di kopTop-logoSize).
    y = Math.min(y, kopTop - logoSize + 8 - 4);
    y -= 1;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 18;
    centerText('HASIL PEMERIKSAAN RADIOLOGI', 12, false);
    y -= 22;

    const colLeftX = margin;
    const colRightX = pageWidth / 2 + 10;
    const infoValueX = colLeftX + 90;
    const infoValuePrefixWidth = font.widthOfTextAtSize(': ', 9.5);
    const alamatMaxWidth = colRightX - infoValueX - 8 - infoValuePrefixWidth;
    const truncateToWidth = (s: string, size: number, maxWidth: number) => {
      if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
      let truncated = s;
      while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return `${truncated}...`;
    };
    const alamatSingkat = truncateToWidth(data.alamat || '-', 9.5, alamatMaxWidth);
    const infoLeft: [string, string][] = [
      ['No.RM', data.no_rm], ['Nama Pasien', data.nama_pasien],
      ['JK/Umur', `${data.jk || '-'} / ${umurDariTglLahir(data.tgl_lahir)}`],
      ['Alamat', alamatSingkat],
      ['No.Periksa', data.no_periksa],
    ];
    const infoRight: [string, string][] = [
      ['Penanggung Jawab', namaDokterPj], ['Dokter Pengirim', data.dokter_pengirim || '-'],
      ['Tgl.Pemeriksaan', data.tgl_pemeriksaan], ['Jam Pemeriksaan', data.jam_pemeriksaan],
      [data.poli_label || 'Poli', data.poli || '-'],
    ];
    const rowStartY = y;
    infoLeft.forEach(([label, value], i) => {
      y = rowStartY - i * 14;
      text(label, colLeftX, 9.5); text(`: ${value}`, colLeftX + 90, 9.5);
    });
    infoRight.forEach(([label, value], i) => {
      y = rowStartY - i * 14;
      text(label, colRightX, 9.5); text(`: ${value}`, colRightX + 100, 9.5);
    });
    y = rowStartY - infoLeft.length * 14;
    text('Pemeriksaan', colLeftX, 9.5); text(`: ${data.pemeriksaan}`, colLeftX + 90, 9.5);
    y -= 20;

    text('Hasil Pemeriksaan :', margin, 10, false);
    y -= 18;
    // hasil dari STATE textarea yg sedang diketik user (konsisten dgn
    // penanggung jawab di atas), bukan data.hasil dari sesi tersimpan.
    const hasilLines = (hasil.trim() || '-').split('\n').flatMap((line: string) => wrapText(line || ' ', pageWidth - margin * 2 - 16, 9.5));
    const hasilBoxTop = y;
    for (const line of hasilLines) {
      text(line, margin + 8, 9.5);
      y -= 13;
    }
    page.drawRectangle({
      x: margin, y: y - 6, width: pageWidth - margin * 2, height: hasilBoxTop - y + 20,
      borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1,
    });
    y -= 6; // tepi bawah kotak hasil (sama spt y yg dipakai utk drawRectangle di atas)

    // SIGN_BOX — posisi kotak TTD dihitung DI SINI, persis di bawah kotak
    // Hasil Pemeriksaan (y saat ini) dikurangi jarak SIGN_BOX_GAP_BELOW_HASIL
    // — bukan lagi posisi tetap di dasar halaman. Diclamp ke margin bawah
    // halaman spy tidak digambar meluber keluar kalau hasil pemeriksaannya
    // sangat panjang (belum ada dukungan halaman baru/pagination di sini).
    const signBoxTop = Math.max(margin + SIGN_BOX_HEIGHT, y - SIGN_BOX_GAP_BELOW_HASIL);
    const SIGN_BOX = {
      lowerLeftX: margin, lowerLeftY: signBoxTop - SIGN_BOX_HEIGHT,
      upperRightX: margin + SIGN_BOX_WIDTH, upperRightY: signBoxTop,
      page: '1',
    };
    y = SIGN_BOX.lowerLeftY - 10;

    // Kolom KANAN — Petugas Radiologi. Ini BUKAN area stample Peruri (beda
    // dari kotak Penanggung Jawab di kiri) — QR-nya e-signature LOKAL biasa
    // (persis pola qrPetugas di handleCetak, digenerate sendiri lewat lib
    // "qrcode", bukan barcode resmi dari Peruri) krn Petugas Radiologi
    // memang tidak ikut proses tanda tangan digital Peruri, cuma dicatat
    // spt pola cetak PDF biasa.
    const petugasBoxX = { start: 395, end: 555 };
    const petugasBoxCenterX = (petugasBoxX.start + petugasBoxX.end) / 2;
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fingerPetugas =
      `Dikeluarkan di ${settings.nama_instansi || ''}, Kabupaten/Kota ${settings.kota_rs || ''}\n` +
      `Ditandatangani secara elektronik oleh ${data.petugas_nama || '-'}\n` +
      `ID ${data.petugas_nip || '-'}\n${tanggalCetak}`;
    let qrPetugasImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(fingerPetugas, { width: 80, margin: 1 });
      const qrBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
      qrPetugasImg = await pdf.embedPng(qrBytes);
    } catch { /* lanjut tanpa QR kalau gagal generate/embed */ }

    // Tgl.Cetak — di atas kolom kanan (Petugas Radiologi), persis posisi di handleCetak.
    const tglCetakText = `Tgl.Cetak : ${tanggalCetak}`;
    const tglCetakW = font.widthOfTextAtSize(tglCetakText, 8.5);
    page.drawText(tglCetakText, {
      x: petugasBoxCenterX - tglCetakW / 2, y: SIGN_BOX.upperRightY + 4, size: 8.5, font, color: rgb(0, 0, 0),
    });

    // Kotak KIRI — Penanggung Jawab. Area RESERVED utk stample Peruri (SAMA
    // PERSIS koordinatnya dgn SIGN_BOX yg dikirim ke Peruri), sengaja
    // dibiarkan kosong di dalamnya — border putus-putus jadi penanda "area
    // ini", bukan tanda tangan lokal spt kolom kanan.
    page.drawRectangle({
      x: SIGN_BOX.lowerLeftX, y: SIGN_BOX.lowerLeftY,
      width: SIGN_BOX.upperRightX - SIGN_BOX.lowerLeftX, height: SIGN_BOX.upperRightY - SIGN_BOX.lowerLeftY,
      borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.7, borderDashArray: [3, 2],
    });
    const signLabelY = SIGN_BOX.upperRightY - 12;
    const signLabelW = fontBold.widthOfTextAtSize('Penanggung Jawab', 9);
    page.drawText('Penanggung Jawab', {
      x: SIGN_BOX.lowerLeftX + (SIGN_BOX.upperRightX - SIGN_BOX.lowerLeftX - signLabelW) / 2, y: signLabelY,
      size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3),
    });
    const namaW = font.widthOfTextAtSize(namaDokterPj, 9);
    page.drawText(namaDokterPj, {
      x: SIGN_BOX.lowerLeftX + (SIGN_BOX.upperRightX - SIGN_BOX.lowerLeftX - namaW) / 2, y: SIGN_BOX.lowerLeftY + 8,
      size: 9, font, color: rgb(0.3, 0.3, 0.3),
    });

    // Isi kolom kanan — Petugas Radiologi: label, QR lokal, nama. TANPA
    // border (bukan area reserved, ini tanda tangan yg sudah "jadi").
    const petugasLabelW = fontBold.widthOfTextAtSize('Petugas Radiologi', 9);
    page.drawText('Petugas Radiologi', {
      x: petugasBoxCenterX - petugasLabelW / 2, y: signLabelY, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3),
    });
    if (qrPetugasImg) {
      const qrSize = 40;
      page.drawImage(qrPetugasImg, { x: petugasBoxCenterX - qrSize / 2, y: SIGN_BOX.lowerLeftY + 22, width: qrSize, height: qrSize });
    }
    const petugasNamaW = font.widthOfTextAtSize(data.petugas_nama || '-', 9);
    page.drawText(data.petugas_nama || '-', {
      x: petugasBoxCenterX - petugasNamaW / 2, y: SIGN_BOX.lowerLeftY + 8, size: 9, font, color: rgb(0.3, 0.3, 0.3),
    });

    // Footer legal — jarak TETAP dari tepi bawah kertas (bukan dari
    // SIGN_BOX, yg posisinya dinamis tp diclamp agar tidak pernah turun
    // sampai di bawah margin), jadi footer selalu di posisi yg sama.
    const footerSeparatorY = margin - 10;
    page.drawLine({
      start: { x: margin, y: footerSeparatorY }, end: { x: pageWidth - margin, y: footerSeparatorY },
      thickness: 0.5, color: rgb(0.75, 0.75, 0.75),
    });
    const footerText = 'Dokumen ini sah dan telah ditandatangani secara elektronik menggunakan sertifikat digital yang diterbitkan oleh Peruri';
    const footerLines = wrapText(footerText, pageWidth - margin * 2, 7.5);
    let footerLineY = footerSeparatorY - 10;
    footerLines.forEach((line) => {
      const w = font.widthOfTextAtSize(line, 7.5);
      page.drawText(line, { x: (pageWidth - w) / 2, y: footerLineY, size: 7.5, font, color: rgb(0.45, 0.45, 0.45) });
      footerLineY -= 9;
    });

    const pdfBytes = await pdf.save();
    return { pdfBytes, email: emailDokterPj, namaDokterPj, signBox: SIGN_BOX };
  };

  // handlePreviewTtd — "Review PDF", buka PDF yg AKAN dikirim ke Peruri
  // (buildRadiologiPdfUntukTtd, byte yg sama persis dgn yg diupload
  // handleTandaTangan) di tab baru TANPA benar-benar mengirim apa pun ke
  // Peruri — padanan handlePreviewUpload di ModalBilling.tsx, supaya user
  // bisa cek dulu isinya sebelum benar-benar submit ke Peruri.
  const handlePreviewTtd = async () => {
    setPreviewingTtd(true);
    try {
      const { pdfBytes } = await buildRadiologiPdfUntukTtd();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPreviewingTtd(false);
    }
  };

  // peruriPost — helper kecil, panggil endpoint proxy Peruri (JSON), balikin
  // response.response (raw upstream Peruri) sambil lempar Error kalau
  // gagal di level HTTP KITA (bukan level Peruri) ATAU resultCode Peruri
  // bukan "0" (envelope resultCode/resultDesc/data — sama pola dgn
  // response Generate JWT yg sudah dikonfirmasi, dipakai jaga2 di semua
  // endpoint lain krn belum semuanya dites langsung).
  const peruriPost = async (path: string, body: unknown): Promise<any> => {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal memanggil ${path}`);
    const upstream = data.response;
    if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
      throw new Error(upstream.resultDesc || `${path} gagal (resultCode ${upstream.resultCode})`);
    }
    return upstream;
  };

  // handleTandaTangan — tombol "Tanda Tangan" di samping tombol printer,
  // sekali klik menjalankan alur Digital Signature Peruri (SEMUA di
  // namespace digitalSignatureSession — sendDocument, sessionInitiate,
  // sessionValidation, signingSession, downloadDocument HARUS satu
  // namespace yg sama, lihat ApiPeruri.java referensi produksi; jangan
  // campur dgn digitalSignatureFullJwtSandbox spt setSignature, orderId
  // dari namespace beda tidak saling dikenali → "Failed to Sign"):
  //   1. Send Document -> dapat orderId (signer, termasuk posisi TTD &
  //      teraImage, SUDAH ikut di payload ini — TIDAK ADA API Set
  //      Signature terpisah)
  //   2. Get OTP (Session Initiate) -> dapat tokenSession, Peruri kirim
  //      kode OTP ke email dokter P.J. lewat email/SMS/WhatsApp
  //   3. User diminta input OTP (dialog) -> Validate OTP (Session
  //      Validation) -> Signing (Signing Session)
  // PDF hasil generate (buildRadiologiPdfUntukTtd) diupload sbg file
  // SEMENTARA (dihapus otomatis di backend begitu terkirim ke Peruri,
  // lihat sendPeruriDocumentFromFile) — tidak pernah tersimpan permanen.
  // showProcessing/hideProcessing — modal loading Swal (spinner + pesan)
  // supaya user tau proses TTE sedang berjalan (bukan hang), krn alur ini
  // memanggil beberapa API Peruri berurutan yg total bisa makan waktu
  // beberapa detik.
  const showProcessing = (html: string) => {
    Swal.fire({
      html,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
  };
  const hideProcessing = () => Swal.close();

  // showOtpDialog — dialog input kode OTP bergaya "Check your email" (ikon
  // amplop, judul besar, satu kolom input SAJA — bukan kotak per-digit —
  // link "Kirim ulang" di bawah input, tombol biru penuh), dipakai bareng
  // oleh handleTandaTangan & handleMintaOtpUlang. onResend dipanggil saat
  // link "Kirim ulang" diklik — caller yg update tokenSession-nya sendiri
  // (assign ke variabel `let` di closure-nya) krn tokenSession baru cuma
  // diketahui pemanggil, bukan dialog ini.
  const showOtpDialog = async (email: string, onResend: () => Promise<void>, confirmButtonText: string): Promise<string | undefined> => {
    const { value: otpCode } = await Swal.fire({
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
          </div>
          <div style="font-size:19px;font-weight:700;color:#111827;margin-bottom:6px;">Masukkan Kode OTP</div>
          <div style="font-size:13px;color:#6b7280;line-height:1.5;">Kode verifikasi sudah dikirim ke<br/><b style="color:#111827;">${email}</b></div>
        </div>
      `,
      input: 'text',
      inputAttributes: { maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' },
      showCancelButton: false,
      showCloseButton: true,
      confirmButtonText,
      confirmButtonColor: '#2563eb',
      inputValidator: (value) => (!value ? 'Kode OTP wajib diisi' : undefined),
      didOpen: (popup) => {
        const input = popup.querySelector('.swal2-input') as HTMLInputElement | null;
        if (input) {
          input.placeholder = '6 digit kode OTP';
          Object.assign(input.style, {
            textAlign: 'center', fontSize: '22px', fontWeight: '700', letterSpacing: '8px',
            maxWidth: '220px', margin: '4px auto 6px', borderRadius: '10px',
          });
        }
        const confirmBtn = popup.querySelector('.swal2-confirm') as HTMLButtonElement | null;
        if (confirmBtn) Object.assign(confirmBtn.style, { width: '85%', margin: '10px auto 0', borderRadius: '8px', fontWeight: '700' });

        const resendWrap = document.createElement('div');
        resendWrap.style.cssText = 'text-align:center;font-size:12.5px;color:#6b7280;margin-top:4px;';
        resendWrap.innerHTML = 'Tidak menerima kode? <button id="btnResendOtpDialog" type="button" style="background:none;border:none;color:#2563eb;font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:0;">Kirim ulang</button>';
        input?.insertAdjacentElement('afterend', resendWrap);

        const resendBtn = resendWrap.querySelector('#btnResendOtpDialog') as HTMLButtonElement | null;
        resendBtn?.addEventListener('click', async () => {
          resendBtn.disabled = true;
          resendBtn.textContent = 'Mengirim ulang...';
          try {
            await onResend();
            resendBtn.textContent = 'Kode baru terkirim';
          } catch (err) {
            resendBtn.textContent = err instanceof Error ? err.message : 'Gagal kirim ulang';
          } finally {
            window.setTimeout(() => {
              resendBtn.disabled = false;
              resendBtn.textContent = 'Kirim ulang';
            }, 3000);
          }
        });
      },
    });
    return otpCode as string | undefined;
  };

  const handleTandaTangan = async () => {
    setSigning(true);
    showProcessing('Menyiapkan & mengirim dokumen ke Peruri, mohon tunggu...');
    try {
      const { pdfBytes, email, namaDokterPj, signBox } = await buildRadiologiPdfUntukTtd();

      // 1. Send Document
      const form = new FormData();
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `HasilRadiologi_${noorder.replace(/\//g, '_')}.pdf`);
      form.append('email', email);
      form.append('isVisualSign', 'YES');
      form.append('lowerLeftX', String(signBox.lowerLeftX));
      form.append('lowerLeftY', String(signBox.lowerLeftY));
      form.append('upperRightX', String(signBox.upperRightX));
      form.append('upperRightY', String(signBox.upperRightY));
      form.append('page', signBox.page);
      form.append('certificateLevel', 'NOT_CERTIFIED');
      form.append('varLocation', 'Sigli');
      form.append('varReason', 'Signed');
      form.append('teraImage', 'QR-DETECSI');
      form.append('orderType', 'INDIVIDUAL');

      const sendRes = await fetch('/api/peruri/send-document-tmp', { method: 'POST', body: form });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Gagal mengirim dokumen ke Peruri');
      if (sendData.response && typeof sendData.response === 'object' && 'resultCode' in sendData.response && sendData.response.resultCode !== '0') {
        throw new Error(sendData.response.resultDesc || 'Send Document gagal');
      }
      const orderId = sendData?.response?.data?.orderId || sendData?.response?.orderId;
      if (!orderId) throw new Error('Peruri tidak mengembalikan orderId: ' + JSON.stringify(sendData.response));

      // Tampilkan dulu Order ID yg berhasil didapat dari Send Document
      // sebentar, supaya user tau dokumennya sudah benar2 terkirim ke
      // Peruri SEBELUM lanjut ke proses OTP/Signing berikutnya.
      showProcessing(`Dokumen berhasil terkirim ke Peruri.<br/>Order ID: <b>${orderId}</b><br/><span style="font-size:12px;color:#6b7280;">Melanjutkan proses tanda tangan...</span>`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      // (TIDAK ADA langkah "Set Signature Position" terpisah — posisi TTD,
      // certificateLevel, varLocation/varReason, & teraImage SUDAH ikut
      // terkirim di payload Send Document di atas (field signer), persis
      // referensi ApiPeruri.java produksi. Endpoint setSignature ada di
      // namespace digitalSignatureFullJwtSandbox yg BEDA dgn sendDocument/
      // sessionInitiate/sessionValidation/signingSession/downloadDocument
      // (semua digitalSignatureSession) — orderId dari sendDocument TIDAK
      // dikenali kalau dipakai lintas-namespace, itu penyebab
      // "Failed to Sign | %docSigningOutput/errorMessage%".)

      // 2. Cek dulu apakah email ini masih punya sesi OTP tervalidasi yg
      // belum expired (durasi bisa diatur s.d. 24 jam di Pengaturan) —
      // kalau masih valid, LEWATI Get OTP + dialog input OTP + Validate
      // OTP, langsung Signing. OTP hanya diminta ulang kalau sesi
      // sebelumnya sudah habis masa berlakunya.
      const sessionRes = await fetch(`/api/peruri/session-status?email=${encodeURIComponent(email)}`);
      const sessionData = await sessionRes.json().catch(() => ({ valid: false }));
      let sesiDipakaiUlang = false;

      if (sessionRes.ok && sessionData.valid) {
        sesiDipakaiUlang = true;
      } else {
        // 2a. Get OTP (Session Initiate) — Peruri kirim kode OTP ke email ini.
        const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
        if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

        // 2b. Minta user input OTP, lalu Validate OTP.
        hideProcessing();
        const otpCode = await showOtpDialog(email, async () => {
          const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
          const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
          if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
          tokenSession = newTokenSession;
        }, 'Verifikasi & Tanda Tangan');
        if (!otpCode) return; // user batal — orderId sudah dibuat di Peruri, tapi belum ditandatangani

        showProcessing('Memverifikasi OTP & menandatangani dokumen, mohon tunggu...');
        await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      }

      // 3. Signing — pakai orderId, tidak perlu OTP lagi (baik sesi lama
      // yg dipakai ulang, maupun sesi baru yg barusan divalidasi).
      if (sesiDipakaiUlang) showProcessing('Sesi OTP masih aktif, menandatangani dokumen, mohon tunggu...');
      try {
        await peruriPost('/api/peruri/signing', { orderId });
      } catch (err) {
        // Sesi "Aktif" di tracking_tte_session TIDAK menjamin sesi itu
        // masih valid persis di sisi Peruri (bisa saja Peruri sudah
        // menganggapnya expired lbh cepat dari 24 jam kita) — persis
        // ditangani sama di kode Khanza (MnKirimDanTandaTanganActionPerformed):
        // deteksi pesan error yg menyinggung otp/session/expired, arahkan
        // user klik "Minta OTP Ulang" dulu, BUKAN dianggap bug/gagal total.
        const msg = err instanceof Error ? err.message : '';
        if (/otp|session|expired/i.test(msg)) {
          throw new Error('Masa berlaku sesi OTP sudah habis di sisi Peruri. Silakan klik tombol "Minta OTP Ulang" terlebih dahulu, lalu coba Tanda Tangan lagi.');
        }
        throw err;
      }
      hideProcessing();

      await Swal.fire({
        icon: 'success', title: 'Berhasil ditandatangani',
        html: `Dokumen berhasil ditandatangani oleh <b>${namaDokterPj}</b> (${email}).<br/>Order ID: <b>${orderId}</b>`
          + (sesiDipakaiUlang ? '<br/><small>(Sesi OTP masih aktif, tidak perlu OTP ulang)</small>' : ''),
      });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSigning(false);
    }
  };

  // handleMintaOtpUlang — tombol terpisah di deretan aksi modal (sebelum
  // Tanda Tangan), dipakai kalau dokter P.J. ingin memperbarui/memvalidasi
  // ulang sesi OTP-nya SEBELUM benar2 menandatangani dokumen (mis. sesi
  // lama sudah/hampir expired). Alurnya cuma Get OTP -> input OTP ->
  // Validate OTP (sesi tervalidasi otomatis tersimpan di
  // peruri_signing_session, lihat handleTandaTangan poin 3) — TIDAK
  // menyentuh send-document/set-signature/signing sama sekali krn belum
  // tentu ada dokumen yg mau ditandatangani saat tombol ini diklik.
  const handleMintaOtpUlang = async () => {
    if (!kdDokterPj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Dokter P.J. dulu' });
      return;
    }
    setRequestingOtp(true);
    showProcessing('Mengirim kode OTP, mohon tunggu...');
    try {
      const emailRes = await fetch(`/api/dokter/${encodeURIComponent(kdDokterPj)}/email`);
      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error || 'Dokter P.J. tidak ditemukan');
      if (!emailData.email) {
        throw new Error(`Email dokter penanggung jawab (${dokterPjQuery || emailData.nm_dokter || '-'}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
      }
      const email = emailData.email as string;

      const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
      let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
      if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

      hideProcessing();
      const otpCode = await showOtpDialog(email, async () => {
        const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
        if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
        tokenSession = newTokenSession;
      }, 'Verifikasi');
      if (!otpCode) return;

      showProcessing('Memverifikasi OTP, mohon tunggu...');
      await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      hideProcessing();

      await Swal.fire({
        icon: 'success', title: 'Sesi OTP diperbarui',
        html: `Sesi OTP untuk <b>${email}</b> berhasil divalidasi ulang dan aktif selama 24 jam ke depan.`,
      });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!petugasNip) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Petugas dulu' });
      return;
    }
    if (!kdDokterPj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Dokter P.J. dulu' });
      return;
    }
    const checkedExams = exams.filter((e) => e.checked);
    if (checkedExams.length === 0 && !hasil.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Centang minimal satu pemeriksaan atau isi Hasil/Bacaan' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/radiologi/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: detail!.no_rawat,
          nip: petugasNip,
          kd_dokter: kdDokterPj,
          pemeriksaan: checkedExams.map((e) => ({
            kd_jenis_prw: e.kd_jenis_prw, proyeksi: e.proyeksi, kV: e.kV, mAS: e.mAS,
            FFD: e.FFD, BSF: e.BSF, inak: e.inak, jml_penyinaran: e.jml_penyinaran, dosis: e.dosis,
          })),
          hasil: hasil.trim(),
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Hasil pemeriksaan radiologi berhasil disimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Input Data Hasil Periksa Radiologi</span>
          <button
            type="button" onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
        ) : detail && (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header identitas — pill fields, padanan PanelInput DlgPeriksaRadiologi.java */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={labelSm}>No.Rawat :</span>
                <input readOnly value={detail.no_rawat} style={{ ...pillReadOnly, width: 190 }} />
                <input readOnly value={detail.no_rkm_medis} style={{ ...pillReadOnly, width: 100 }} />
                <input readOnly value={detail.nm_pasien} style={{ ...pillReadOnly, flex: 1 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={labelSm}>Dokter P.J. :</span>
                <input readOnly value={kdDokterPj} style={{ ...pillReadOnly, width: 100 }} />
                <div style={{ position: 'relative', width: 200 }}>
                  <input
                    value={dokterPjQuery}
                    onChange={(e) => { setDokterPjQuery(e.target.value); setKdDokterPj(''); setShowDokterPjDropdown(true); }}
                    onFocus={() => setShowDokterPjDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDokterPjDropdown(false), 200)}
                    placeholder="Cari dokter..."
                    style={{ ...pill, width: '100%' }}
                  />
                  {showDokterPjDropdown && dokterPjList.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                      {dokterPjList.map((d) => (
                        <div key={d.kd_dokter} onClick={() => { setKdDokterPj(d.kd_dokter); setDokterPjQuery(d.nm_dokter); setShowDokterPjDropdown(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                        >{d.nm_dokter}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={clipBtn}><ClipIcon /></div>

                <span style={{ ...labelSm, width: 60, marginLeft: 8 }}>Petugas :</span>
                <input readOnly value={petugasNip} style={{ ...pillReadOnly, width: 90 }} />
                <div style={{ position: 'relative', width: 200 }}>
                  <input
                    value={petugasQuery}
                    onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                    onFocus={() => setShowPetugasDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                    placeholder="Cari nama petugas..."
                    style={{ ...pill, width: '100%' }}
                  />
                  {showPetugasDropdown && petugasList.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                      {petugasList.map((p) => (
                        <div key={p.nip} onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                        >{p.nama} <span style={{ color: '#9ca3af' }}>({p.nip})</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={clipBtn}><ClipIcon /></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={labelSm}>Dokter Perujuk :</span>
                <input readOnly value={detail.dokter_perujuk} style={{ ...pillReadOnly, width: 100 }} />
                <input readOnly value={detail.nm_dokter} style={{ ...pillReadOnly, width: 200 }} />
                <div style={clipBtn}><ClipIcon /></div>

                <span style={{ ...labelSm, width: 60, marginLeft: 8 }}>Tanggal :</span>
                <input
                  type="date" value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 150, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <span style={{ fontSize: 13, color: '#374151' }}>Jam :</span>
                <input
                  type="time" value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 110, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
                  Otomatis
                </label>
              </div>
            </div>

            {/* Pemeriksaan — checklist + data teknis, padanan tabel pemeriksaan Java */}
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['', 'Pemeriksaan', 'Proyeksi', 'kV', 'mAS', 'FFD', 'BSF', 'Inak', 'Jml.Penyinaran', 'Dosis'].map((h) => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((e, idx) => (
                      <tr key={e.kd_jenis_prw} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={e.checked} onChange={(ev) => updateExam(idx, { checked: ev.target.checked })} />
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 500 }}>{e.nm_perawatan}</td>
                        {(['proyeksi', 'kV', 'mAS', 'FFD', 'BSF', 'inak', 'jml_penyinaran', 'dosis'] as const).map((f) => (
                          <td key={f} style={{ padding: '4px' }}>
                            <input
                              type="text" style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                              value={e[f]} onChange={(ev) => updateExam(idx, { [f]: ev.target.value } as Partial<ExamForm>)}
                              disabled={!e.checked}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Foto Orthanc (kiri) + Hasil (kanan) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 260 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Foto dari Orthanc</span>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, overflowY: 'auto', background: '#000', minHeight: 240 }}>
                  {loadingFoto ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat dari Orthanc...</div>
                  ) : foto.instances.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Belum ada gambar di Orthanc untuk order ini</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {foto.instances.map((inst) => {
                        const src = `/api/satu-sehat/dicom/preview-image/${inst.id}`;
                        return (
                          <div
                            key={inst.id}
                            onClick={() => setPreviewFoto(src)}
                            style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #374151', cursor: 'zoom-in' }}
                          >
                            <img
                              src={src}
                              alt={inst.modality || 'DICOM'}
                              style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'contain', background: '#111827' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Hasil</span>
                <textarea
                  value={hasil} onChange={(e) => setHasil(e.target.value)}
                  placeholder="Tulis hasil bacaan/expertise radiologi..."
                  style={{ flex: 1, minHeight: 240, width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {detail.sudah_ada_hasil && (
              <div style={{ fontSize: 12, color: '#92400e', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                ⚠ Permintaan ini sudah pernah diisi hasilnya — submit ulang akan menambahkan catatan pemeriksaan baru.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => Swal.fire({ icon: 'info', title: 'Segera Hadir', text: 'Fitur kirim hasil pemeriksaan radiologi ke WhatsApp akan dikembangkan.' })}
                title="Kirim Ke WA (segera hadir)"
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #25D366', background: '#fff', color: '#25D366', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.13c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.02.24-3.41-.71-2.9-1.16-4.76-4.06-4.9-4.25-.14-.19-1.17-1.56-1.17-2.98s.75-2.12 1.02-2.41c.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.83 2 .9 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.29.14.46.12.63-.07.17-.19.72-.83.91-1.12.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.71-.17 1.39z"></path>
                </svg>
                Kirim Ke WA
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCetak}
                  disabled={printing}
                  title="Cetak Hasil Pemeriksaan Radiologi"
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: printing ? '#9ca3af' : '#374151', cursor: printing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handlePreviewTtd}
                  disabled={previewingTtd}
                  title="Review PDF yang akan dikirim ke Peruri"
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: previewingTtd ? '#9ca3af' : '#374151', cursor: previewingTtd ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleMintaOtpUlang}
                  disabled={requestingOtp}
                  title="Minta OTP Ulang (perbarui sesi Peruri Dokter P.J.)"
                  style={{ padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: requestingOtp ? '#9ca3af' : '#374151', cursor: requestingOtp ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 15 15" fill="none">
                    <path d="M6 5.5H9M7.5 5.5V10M10.5 10V7.5M10.5 7.5V5.5H11.5C12.0523 5.5 12.5 5.94772 12.5 6.5C12.5 7.05228 12.0523 7.5 11.5 7.5H10.5ZM4.5 6.5V8.5C4.5 9.05228 4.05228 9.5 3.5 9.5C2.94772 9.5 2.5 9.05228 2.5 8.5V6.5C2.5 5.94772 2.94772 5.5 3.5 5.5C4.05228 5.5 4.5 5.94772 4.5 6.5ZM1.5 0.5H13.5C14.0523 0.5 14.5 0.947715 14.5 1.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H1.5C0.947716 14.5 0.5 14.0523 0.5 13.5V1.5C0.5 0.947716 0.947715 0.5 1.5 0.5Z" stroke="currentColor"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleTandaTangan}
                  disabled={signing}
                  title="Tanda Tangan Elektronik (Peruri)"
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: signing ? '#9ca3af' : '#374151', cursor: signing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="22" height="22" viewBox="0 1.5 14 11" fill="currentColor">
                    <path d="m 1.0324444,11.139308 c 0.0179,-0.1218 0.061,-0.2215 0.0958,-0.2215 0.0348,0 0.0633,-0.064 0.0633,-0.1428 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.064 0.0714,-0.1427 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.047 0.0714,-0.1045 0,-0.058 0.08,-0.2479001 0.17776,-0.4230001 0.12606,-0.2258 0.16557,-0.3794 0.13583,-0.528 -0.0254,-0.1269 0.002,-0.2942 0.0687,-0.4236 0.0608,-0.1177 0.18066,-0.4193 0.26627,-0.6702 0.0856,-0.251 0.17774,-0.4885 0.20472,-0.5277 0.027,-0.039 0.0925,-0.216 0.14571,-0.3927 0.0532,-0.1766 0.1232,-0.3517 0.15563,-0.389 0.0324,-0.037 0.059,-0.1417 0.059,-0.232 0,-0.09 0.0321,-0.1642 0.0714,-0.1642 0.0393,0 0.0714,-0.094 0.0714,-0.21 0,-0.1154 0.0321,-0.2298 0.0714,-0.254 0.0393,-0.024 0.073,-0.099 0.0749,-0.1649 0.002,-0.066 0.16547,-0.2492 0.36338,-0.4062 0.1979,-0.1571 0.43577,-0.3579 0.5286,-0.4462 0.0928,-0.088 0.1866,-0.1606 0.20838,-0.1606 0.0218,0 0.13637,-0.093 0.25466,-0.2056 0.11829,-0.113 0.3509,-0.2977 0.51691,-0.4104 0.16601,-0.1128 0.31254,-0.2291 0.32563,-0.2585 0.0131,-0.029 0.0683,-0.053 0.12276,-0.053 0.0544,0 0.21335,-0.064 0.35316,-0.1428 0.26925,-0.1512 0.60679,-0.1909 0.60679,-0.071 0,0.039 0.0421,0.071 0.0936,0.071 0.0515,0 0.15589,0.058 0.23201,0.1285 0.24872,0.231 0.37942,0.24 0.55068,0.038 0.30396,-0.3586 1.0957,-1.1308 1.25041,-1.2194 0.18638,-0.1068 0.51461,-0.1182 0.51461,-0.018 0,0.039 0.043,0.071 0.0956,0.071 0.12754,0 0.26131,0.3072 0.26131,0.6002 0,0.2369 -0.24982,0.6817 -0.50955,0.9073 -0.0731,0.063 -0.13294,0.139 -0.13294,0.1677 0,0.029 -0.0964,0.1422 -0.21416,0.2523 -0.23429,0.2188 -0.26247,0.3229 -0.12217,0.4512 0.18171,0.1662 0.89017,0.5482 1.01669,0.5482 0.0577,0 0.10491,0.029 0.10491,0.063 0,0.035 0.20949,0.1202 0.46554,0.1895 0.4572796,0.1237 0.4683696,0.1234 0.6246396,-0.018 0.1522,-0.1379 0.20395,-0.1411 1.19421,-0.074 0.56932,0.038 1.0438,0.078 1.05441,0.087 0.0106,0.01 0.0719,0.2706 0.13625,0.5806 0.22137,1.0669 0.1397,2.7256 -0.19548,3.9704001 l -0.0726,0.2698 -1.10376,0 -1.10375,0 0,-0.2142 c 0,-0.1178 -0.0321,-0.2142 -0.0714,-0.2142 -0.0393,0 -0.0714,-0.068 -0.0714,-0.1504 0,-0.1163 -0.0283,-0.1381 -0.12493,-0.096 -0.0687,0.03 -0.2373696,0.067 -0.3747896,0.083 -0.13742,0.016 -0.31799,0.063 -0.40128,0.1034 -0.15948,0.078 -0.59017,0.053 -1.4191,-0.084 -0.56756,-0.093 -0.48797,-0.091 -1.12627,-0.028 -0.26608,0.026 -0.50088,0.076 -0.52177,0.1096 -0.0539,0.087 -1.79571,0.078 -1.84994,-0.01 -0.0243,-0.039 -0.15276,-0.071 -0.28555,-0.071 -0.13279,0 -0.26128,-0.032 -0.28555,-0.071 -0.0243,-0.039 -0.15836,-0.071 -0.29798,-0.071 -0.20152,0 -0.30517,0.055 -0.50271,0.2677 -0.13687,0.1473 -0.29749,0.34 -0.35693,0.4284 -0.0594,0.088 -0.16674,0.1606 -0.23843,0.1606 -0.0717,0 -0.15021,0.032 -0.17447,0.071 -0.0243,0.039 -0.10154,0.071 -0.17172,0.071 -0.0702,0 -0.22087,0.046 -0.33487,0.1034 -0.11401,0.057 -0.33873,0.1244 -0.49939,0.1501 l -0.29211,0.047 0.0325,-0.2215 z m 0.83725,-0.2929 c 0.0243,-0.039 0.10648,-0.071 0.18268,-0.071 0.0762,0 0.13857,-0.032 0.13857,-0.071 0,-0.039 0.0482,-0.071 0.10708,-0.071 0.0589,0 0.10708,-0.048 0.10708,-0.1065 0,-0.1314 -0.28157,-0.4646 -0.39263,-0.4646 -0.11106,0 -0.39263,0.3332 -0.39263,0.4646 0,0.059 -0.0321,0.1065 -0.0714,0.1065 -0.0393,0 -0.0714,0.064 -0.0714,0.1428 0,0.1038 0.0476,0.1428 0.17426,0.1428 0.0958,0 0.19411,-0.032 0.21837,-0.071 z m 9.7914796,-0.4796 c 0.56959,-0.044 0.51279,0.02 0.6796,-0.7697001 0.10998,-0.5207 0.15529,-2.1091 0.0628,-2.2016 -0.0416,-0.042 -0.0756,-0.1661 -0.0756,-0.2766 0,-0.1106 -0.0399,-0.329 -0.0888,-0.4855 l -0.0888,-0.2844 -0.54608,0 c -0.62148,0 -0.64971,0.026 -0.55725,0.5046 0.11336,0.5873 0.075,1.9136 -0.0772,2.6663 -0.15299,0.7568001 -0.13618,1.0112001 0.0617,0.9332001 0.0652,-0.026 0.34848,-0.064 0.62959,-0.086 z M 6.1529444,9.9283079 c 0.15705,-0.042 0.48897,-0.1306 0.73759,-0.1971 0.4275,-0.1144 0.48566,-0.1141 1.07082,0.01 0.34032,0.07 0.81151,0.1273 1.04709,0.1279 0.50257,0.001 1.3830896,-0.1952 1.5309896,-0.3415 0.10718,-0.1061 0.23238,-0.8318 0.23976,-1.3898 0.005,-0.3722 -0.0687,-0.9074 -0.18342,-1.3327 -0.0786,-0.2915 -0.0876,-0.2983 -0.44116,-0.3348 -0.5742096,-0.059 -0.8963196,-0.1281 -0.8963196,-0.1915 0,-0.032 -0.0723,-0.082 -0.16062,-0.1096 -0.0883,-0.028 -0.36468,-0.1746 -0.61409,-0.326 -0.24941,-0.1514 -0.48231,-0.2753 -0.51756,-0.2753 -0.0352,0 -0.0641,-0.032 -0.0641,-0.071 0,-0.1875 -0.27918,-0.03 -0.65538,0.3706 -0.37178,0.3956 -0.41543,0.474 -0.41543,0.7454 0,0.1668 -0.0321,0.3232 -0.0714,0.3474 -0.0393,0.024 -0.0714,0.1069 -0.0714,0.1837 0,0.1551 -0.11414,0.3784 -0.30339,0.5936 -0.0687,0.078 -0.12493,0.1681 -0.12493,0.1999 0,0.1 0.34485,0.063 0.75135,-0.079 0.38822,-0.1364 0.39085,-0.1364 0.39085,0 0,0.078 -0.0993,0.2321 -0.22063,0.3429 l -0.22062,0.2015 -1.10194,0 c -0.7526,0 -1.12849,0.023 -1.18571,0.08 -0.0461,0.046 -0.17371,0.084 -0.28365,0.084 -0.10994,0 -0.19989,0.032 -0.19989,0.071 0,0.039 -0.0642,0.071 -0.14277,0.071 -0.0785,0 -0.14278,0.027 -0.14278,0.059 0,0.033 -0.0779,0.101 -0.17302,0.152 -0.18219,0.098 -0.28332,0.3465 -0.21403,0.5271 0.0461,0.1201 0.52553,0.3324 0.75054,0.3324 0.0805,0 0.19232,-0.046 0.24841,-0.1019 0.1151,-0.1151 0.14054,-0.6833 0.0306,-0.6833 -0.0393,0 -0.0714,-0.064 -0.0714,-0.1428 0,-0.1852 0.0407,-0.18 0.25311,0.033 0.12743,0.1274 0.17522,0.2528 0.17522,0.4598 0,0.1565 -0.0321,0.3044 -0.0714,0.3287 -0.13127,0.081 -0.0734,0.2215 0.12493,0.3028 0.22116,0.091 0.76798,0.071 1.19574,-0.043 z m -3.49888,-1.0793 c 0.20573,-0.3259 0.22956,-0.6039 0.0658,-0.7677 -0.0966,-0.097 -0.12355,-0.099 -0.1804,-0.013 -0.0368,0.055 -0.0861,0.1892 -0.10953,0.2971 -0.0235,0.108 -0.0656,0.1964 -0.0937,0.1964 -0.0642,0 -0.2167,0.3289 -0.2167,0.4673 0,0.063 0.0699,0.1038 0.17757,0.1038 0.12939,0 0.22625,-0.077 0.35694,-0.2842 z m 0.48514,0.048 c 0.26307,-0.271 0.4081,-0.5016 0.4081,-0.6489 0,-0.056 0.0241,-0.1128 0.0535,-0.1259 0.0294,-0.013 0.13385,-0.1992 0.23201,-0.4135 0.0982,-0.2144 0.31499,-0.5268 0.48186,-0.6942 0.16687,-0.1674 0.3034,-0.321 0.3034,-0.3412 0,-0.068 0.24679,-0.3411 1.08866,-1.2037 0.46134,-0.4727 0.8388,-0.888 0.8388,-0.9229 0,-0.1533 -0.39705,-0.4103 -0.63371,-0.4103 -0.16776,0 -0.63626,0.2586 -0.80241,0.443 -0.0635,0.071 -0.14859,0.1281 -0.18909,0.1281 -0.0405,0 -0.23766,0.1606 -0.43816,0.3569 -0.20049,0.1963 -0.3832,0.3569 -0.40602,0.3569 -0.0846,0 -0.78643,0.7789 -0.8785,0.9749 -0.0525,0.1117 -0.12374,0.2588 -0.15842,0.327 -0.0347,0.068 -0.0631,0.1726 -0.0631,0.232 0,0.059 -0.0321,0.1081 -0.0714,0.1081 -0.0393,0 -0.0714,0.094 -0.0714,0.2082 0,0.1145 -0.0388,0.2211 -0.0862,0.2369 -0.0576,0.019 -0.0357,0.083 0.0658,0.1919 0.22734,0.2441 0.34549,0.5655 0.24483,0.6662 -0.0449,0.045 -0.0817,0.1537 -0.0817,0.2417 0,0.088 -0.0321,0.1798 -0.0714,0.2041 -0.0732,0.045 -0.10182,0.3212 -0.0333,0.3212 0.0209,0 0.1414,-0.1064 0.2677,-0.2365 z m 2.72831,-1.0663 c 0.13638,-0.088 0.24836,-0.2008 0.24885,-0.2499 4.8e-4,-0.049 0.033,-0.089 0.0723,-0.089 0.0393,0 0.0714,-0.064 0.0714,-0.1428 0,-0.079 0.0321,-0.1427 0.0714,-0.1427 0.0393,0 0.0714,-0.08 0.0714,-0.1785 0,-0.2216 -0.0932,-0.2288 -0.23214,-0.018 -0.0582,0.088 -0.26617,0.3284 -0.4622,0.5335 -0.19602,0.2051 -0.3395,0.3899 -0.31884,0.4105 0.0753,0.075 0.23533,0.034 0.4779,-0.123 z"></path>
                  </svg>
                </button>
                <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
                <button
                  type="button" onClick={handleSubmit} disabled={saving}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Hasil'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview foto ukuran penuh — klik gambar mana pun di grid utk lihat, ganti klik foto lain utk ganti tampilan (sebelumnya cuma bisa lihat foto pertama lewat link Orthanc Viewer) */}
      {previewFoto && (
        <div
          onClick={(e) => { e.stopPropagation(); setPreviewFoto(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, cursor: 'zoom-out' }}
        >
          <img
            src={previewFoto}
            alt="Foto DICOM"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewFoto(null); }}
            style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
