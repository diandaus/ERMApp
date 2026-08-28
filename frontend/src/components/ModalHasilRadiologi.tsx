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

  // Kotak posisi tanda tangan elektronik Peruri — koordinat PDF (origin
  // kiri-bawah, satuan pt), pojok KIRI-bawah halaman (Penanggung Jawab
  // dipindah ke kiri, Petugas Radiologi di kanan — lihat komentar di
  // buildRadiologiPdfUntukTtd). Angka INI PERSIS yg dikirim ke Peruri
  // (signer.lowerLeftX/Y, upperRightX/Y) supaya area yg di-stample Peruri
  // match dgn kotak "Penanggung Jawab" yg digambar buildRadiologiPdfUntukTtd
  // di bawah — sengaja dibiarkan kosong di dalam kotaknya (bukan digambar
  // QR sendiri spt versi cetak/window.print), krn stample tanda tangan
  // asli yg ditaruh Peruri di posisi ini.
  const SIGN_BOX = { lowerLeftX: 40, lowerLeftY: 40, upperRightX: 200, upperRightY: 120, page: '1' };

  // buildRadiologiPdfUntukTtd — PENGECUALIAN dari CETAK_STANDAR.md §1
  // (sama pola dgn buildBillingPdf di ModalBilling.tsx): fitur kirim ke
  // Peruri genuinely butuh byte PDF asli (base64Document), window.print()
  // tidak bisa diambil sbg byte oleh JS. Layout best-effort mendekati
  // handleCetak (BUKAN identik — font Helvetica pdf-lib, bukan Tahoma asli).
  const buildRadiologiPdfUntukTtd = async (): Promise<{ pdfBytes: Uint8Array; email: string; namaDokterPj: string }> => {
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
    const alamatSingkat = (data.alamat || '-').length > 40 ? `${(data.alamat as string).slice(0, 40)}...` : (data.alamat || '-');
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
    y -= 30;

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
      x: petugasBoxCenterX - tglCetakW / 2, y: SIGN_BOX.upperRightY + 14, size: 8.5, font, color: rgb(0, 0, 0),
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

    const pdfBytes = await pdf.save();
    return { pdfBytes, email: emailDokterPj, namaDokterPj };
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
  // sekali klik menjalankan alur Digital Signature Peruri langkah 1-4
  // berurutan (persis diagram yg diberikan user):
  //   1. Send Document -> dapat orderId
  //   2. Set Signature Position (pakai orderId)
  //   3. Get OTP (Session Initiate) -> dapat tokenSession, Peruri kirim
  //      kode OTP ke email dokter P.J. lewat email/SMS/WhatsApp
  //   4. User diminta input OTP (dialog) -> Validate OTP (Session
  //      Validation) -> Signing (Signing Session)
  // PDF hasil generate (buildRadiologiPdfUntukTtd) diupload sbg file
  // SEMENTARA (dihapus otomatis di backend begitu terkirim ke Peruri,
  // lihat sendPeruriDocumentFromFile) — tidak pernah tersimpan permanen.
  const handleTandaTangan = async () => {
    setSigning(true);
    try {
      const { pdfBytes, email, namaDokterPj } = await buildRadiologiPdfUntukTtd();

      // 1. Send Document
      const form = new FormData();
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `HasilRadiologi_${noorder.replace(/\//g, '_')}.pdf`);
      form.append('email', email);
      form.append('isVisualSign', 'YES');
      form.append('lowerLeftX', String(SIGN_BOX.lowerLeftX));
      form.append('lowerLeftY', String(SIGN_BOX.lowerLeftY));
      form.append('upperRightX', String(SIGN_BOX.upperRightX));
      form.append('upperRightY', String(SIGN_BOX.upperRightY));
      form.append('page', SIGN_BOX.page);
      form.append('certificateLevel', 'NOT_CERTIFIED');
      form.append('varLocation', 'Jakarta');
      form.append('varReason', 'Signed');
      form.append('orderType', 'INDIVIDUAL');

      const sendRes = await fetch('/api/peruri/send-document-tmp', { method: 'POST', body: form });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Gagal mengirim dokumen ke Peruri');
      if (sendData.response && typeof sendData.response === 'object' && 'resultCode' in sendData.response && sendData.response.resultCode !== '0') {
        throw new Error(sendData.response.resultDesc || 'Send Document gagal');
      }
      const orderId = sendData?.response?.data?.orderId || sendData?.response?.orderId;
      if (!orderId) throw new Error('Peruri tidak mengembalikan orderId: ' + JSON.stringify(sendData.response));

      // 2. Set Signature Position
      await peruriPost('/api/peruri/set-signature', {
        orderId,
        signer: {
          isVisualSign: 'YES',
          lowerLeftX: String(SIGN_BOX.lowerLeftX), lowerLeftY: String(SIGN_BOX.lowerLeftY),
          upperRightX: String(SIGN_BOX.upperRightX), upperRightY: String(SIGN_BOX.upperRightY),
          page: SIGN_BOX.page, certificateLevel: 'NOT_CERTIFIED', varLocation: 'Jakarta', varReason: 'Signed',
        },
      });

      // 3. Get OTP (Session Initiate) — Peruri kirim kode OTP ke email ini.
      const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '1', sendWhatsapp: '1' });
      const tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
      if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

      // 4. Minta user input OTP, lalu Validate OTP + Signing.
      const { value: otpCode } = await Swal.fire({
        icon: 'info',
        title: 'Masukkan Kode OTP',
        html: `Kode OTP sudah dikirim ke <b>${email}</b> (email/SMS/WhatsApp).`,
        input: 'text',
        inputLabel: 'Kode OTP',
        inputPlaceholder: '6 digit kode OTP',
        inputAttributes: { maxlength: '6', inputmode: 'numeric' },
        showCancelButton: true,
        confirmButtonText: 'Verifikasi & Tanda Tangan',
        cancelButtonText: 'Batal',
        inputValidator: (value) => (!value ? 'Kode OTP wajib diisi' : undefined),
      });
      if (!otpCode) return; // user batal — orderId sudah dibuat di Peruri, tapi belum ditandatangani

      await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      await peruriPost('/api/peruri/signing', { orderId });

      await Swal.fire({
        icon: 'success', title: 'Berhasil ditandatangani',
        html: `Dokumen berhasil ditandatangani oleh <b>${namaDokterPj}</b> (${email}).<br/>Order ID: <b>${orderId}</b>`,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSigning(false);
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
                  onClick={handleTandaTangan}
                  disabled={signing}
                  title="Tanda Tangan Elektronik (Peruri)"
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: signing ? '#9ca3af' : '#374151', cursor: signing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
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
