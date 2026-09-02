import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// awalMedisIgdPdf.ts — generate PDF "PENILAIAN AWAL MEDIS IGD" siap kirim
// ke Peruri utk TTE. Pola PERSIS triaseIgdPdf.ts (tabel bergaris penuh,
// kop 3-sel logo|instansi|info pasien + bar judul, tag "#A#" + SIGN_BOX
// utk posisi TTD — lihat backend/PERURI_TTE_DOKUMENTASI.md §2), TAPI
// struktur badan dokumen mengikuti seksi I-VI persis referensi cetak
// Khanza Desktop utk Awal Medis (sama urutan/pengelompokan field dgn
// utils/awalMedisIgdDisplay.tsx — bedanya di sini per-seksi digambar sbg
// baris tabel berbatas garis, bukan tabel HTML biasa).
//
// BELUM termasuk pengambilan email penandatangan (dokter pemeriksa) —
// itu baru dibutuhkan pas tombol TTE (kirim ke Peruri) dibuat, Preview
// tidak perlu kirim apa pun ke Peruri jadi tidak perlu email dulu.

export type AwalMedisSignBox = { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };

export type BuildAwalMedisPdfResult = {
  pdfBytes: Uint8Array;
  signBox: AwalMedisSignBox;
  kdDokter: string;
  namaDokter: string;
};

type AwalMedisPatientInfo = {
  no_rkm_medis?: string;
  nm_pasien?: string;
  jk?: string;
  tgl_lahir?: string;
  umur?: string;
  no_rawat?: string;
};

const TITLE_BAR_COLOR = '#EFEAD2';
const SECTION_HEADER_COLOR = '#E5E5E5';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const SIGN_BOX_WIDTH = 40;
const SIGN_BOX_HEIGHT = 40;

export async function buildAwalMedisPdfUntukTtd(
  data: any,
  patient: AwalMedisPatientInfo,
): Promise<BuildAwalMedisPdfResult> {
  const settingsRes = await fetch('/api/admin/settings');
  let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
  if (settingsRes.ok) settings = await settingsRes.json();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 20;
  const marginBottom = 30;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;

  // wrapText — pecah dulu per baris baru ASLI (\n/\r\n dari textarea, mis.
  // isian Keluhan Utama/Tatalaksana dgn Enter) SEBELUM word-wrap per kata.
  // WAJIB: kalau karakter "\n" ikut kebawa ke page.drawText() (mis. karena
  // cuma di-split(' ') tanpa pisah newline dulu), WinAnsiEncoding pdf-lib
  // melempar error "WinAnsi cannot encode "\n" (0x000a)" — ini penyebab
  // persis error yg dilaporkan user di production (data Awal Medis asli
  // isinya multi-baris, beda dari data uji coba sebelumnya yg kebetulan
  // satu baris).
  const wrapText = (s: string, maxWidth: number, size: number): string[] => {
    const lines: string[] = [];
    s.split(/\r\n|\r|\n/).forEach((para) => {
      const words = para.split(' ');
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
      lines.push(line);
    });
    return lines;
  };

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

  // Gambar diagram lokalis statis (III. STATUS LOKALIS) — sama gambar yg
  // dipakai on-screen (awalMedisIgdDisplay.tsx) & RiwayatModal.tsx.
  let lokalisImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    const imgRes = await fetch(`${window.location.origin}/asuhan-medis-igd/semua.png`);
    if (imgRes.ok) {
      const bytes = await imgRes.arrayBuffer();
      lokalisImg = await pdf.embedPng(bytes);
    }
  } catch { /* lanjut tanpa gambar kalau gagal fetch/embed */ }

  const BORDER_COLOR = rgb(0.55, 0.55, 0.55);
  const drawCell = (x: number, yTop: number, w: number, h: number, bg?: ReturnType<typeof hexToRgb>) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: bg, borderColor: BORDER_COLOR, borderWidth: 0.75 });
  };
  const textInCell = (s: string, x: number, yTop: number, w: number, h: number, opts: { size?: number; color?: ReturnType<typeof rgb>; center?: boolean; padLeft?: number } = {}) => {
    const size = opts.size ?? 9;
    const color = opts.color ?? rgb(0, 0, 0);
    const ty = yTop - h / 2 - size * 0.35;
    if (opts.center) {
      const tw = font.widthOfTextAtSize(s, size);
      page.drawText(s, { x: x + Math.max(0, (w - tw) / 2), y: ty, size, font, color });
    } else {
      page.drawText(s, { x: x + (opts.padLeft ?? 6), y: ty, size, font, color });
    }
  };

  let y = pageHeight - margin;

  // ── Kop surat — 3 sel berborder (logo | instansi | info pasien), PERSIS
  // pola triaseIgdPdf.ts. Bar judul "PENILAIAN AWAL MEDIS IGD" di bawah
  // kolom logo+instansi saja, sel info pasien menyambung 1 sel utuh.
  const titleBarH = 20;
  const kopLogoW = tableWidth * 0.11;
  const kopPatientW = tableWidth * 0.38;
  const kopInstansiW = tableWidth - kopLogoW - kopPatientW;
  const kopLogoX = tableX;
  const kopInstansiX = tableX + kopLogoW;
  const kopPatientX = kopInstansiX + kopInstansiW;

  // Info pasien — WRAP dulu (terutama Nama, bisa panjang mis. "MUHAMMAD
  // SHIDQI AZZHAFRAN") SEBELUM digambar, supaya turun ke baris baru
  // (bukan tembus keluar sel spt page.drawText() langsung sebelumnya).
  // kopH TETAP (tidak ikut membesar walau ada field yg wrap >1 baris) —
  // sel info pasien (kopTotalH = kopH+titleBarH) sudah cukup lega utk
  // nampung baris tambahan tanpa perlu mengubah tinggi kop/header.
  const patientInfoLabelW = 62;
  const patientLinePitch = 12;
  const patientValueMaxWidth = kopPatientW - 8 - patientInfoLabelW - 8;
  const patientFields: [string, string][] = [
    ['Nomor RM', patient.no_rkm_medis || '-'],
    ['Nama', patient.nm_pasien || '-'],
    ['Tanggal Lahir', patient.tgl_lahir || '-'],
    ['Jenis Kelamin', patient.jk === 'L' ? 'Laki-Laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-'],
  ];
  const patientFieldLines = patientFields.map(([label, value]) => ({ label, lines: wrapText(value, patientValueMaxWidth, 8.5) }));
  const kopH = 55;
  const kopTotalH = kopH + titleBarH;

  drawCell(kopLogoX, y, kopLogoW, kopH);
  drawCell(kopInstansiX, y, kopInstansiW, kopH);
  drawCell(kopPatientX, y, kopPatientW, kopTotalH);
  drawCell(kopLogoX, y - kopH, kopLogoW + kopInstansiW, titleBarH, hexToRgb(TITLE_BAR_COLOR));
  textInCell('PENILAIAN AWAL MEDIS IGD', kopLogoX, y - kopH, kopLogoW + kopInstansiW, titleBarH, { size: 11, color: rgb(0, 0, 0), center: true });

  const logoSize = 40;
  if (logoImg) {
    page.drawImage(logoImg, { x: kopLogoX + (kopLogoW - logoSize) / 2, y: y - kopH / 2 - logoSize / 2, width: logoSize, height: logoSize });
  }

  const centerInBlock = (s: string, x: number, w: number, yPos: number, size: number) => {
    const tw = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: x + Math.max(0, (w - tw) / 2), y: yPos, size, font, color: rgb(0, 0, 0) });
  };
  let instansiY = y - 15;
  if (settings.nama_instansi) { centerInBlock(settings.nama_instansi, kopInstansiX, kopInstansiW, instansiY, 13); instansiY -= 13; }
  if (settings.alamat) { centerInBlock(settings.alamat, kopInstansiX, kopInstansiW, instansiY, 8.5); instansiY -= 11; }
  if (settings.kontak) { centerInBlock(settings.kontak, kopInstansiX, kopInstansiW, instansiY, 8.5); instansiY -= 11; }
  if (settings.email_rs) { centerInBlock(`E-mail : ${settings.email_rs}`, kopInstansiX, kopInstansiW, instansiY, 8.5); }

  // Label rata di baris pertama field; kalau value wrap >1 baris,
  // lanjutannya menjorok sejajar kolom value (bukan tembus keluar sel).
  let py = y - 17;
  patientFieldLines.forEach(({ label, lines }) => {
    page.drawText(label, { x: kopPatientX + 8, y: py, size: 8.5, font, color: rgb(0, 0, 0) });
    lines.forEach((line, i) => {
      // Baris lanjutan (i>0) ditambah 2 spasi biar sejajar isi value baris
      // pertama (yg diawali ": ", bukan cuma spasi tunggal, mendekati
      // lebar ": " itu sendiri).
      page.drawText(i === 0 ? `: ${line}` : `  ${line}`, { x: kopPatientX + 8 + patientInfoLabelW, y: py, size: 8.5, font, color: rgb(0, 0, 0) });
      py -= patientLinePitch;
    });
  });

  y -= kopTotalH;

  // ── Tabel bergaris — dari sini tiap baris digambar sbg sel berborder.

  // Baris split 50/50 — Tanggal | Anamnesis (+Hubungan).
  const splitH = 18;
  const halfW = tableWidth / 2;
  drawCell(tableX, y, halfW, splitH);
  drawCell(tableX + halfW, y, halfW, splitH);
  textInCell(`Tanggal : ${data.tanggal || '-'}`, tableX, y, halfW, splitH, { size: 9 });
  textInCell(`Anamnesis : ${data.anamnesis || '-'}${data.hubungan ? `, ${data.hubungan}` : ''}`, tableX + halfW, y, halfW, splitH, { size: 9 });
  y -= splitH;

  // sectionHeaderRow — bar krem lebar penuh, rata kiri (persis "I. RIWAYAT
  // KESEHATAN" dkk di referensi cetak — beda dari triaseIgdPdf.ts yg
  // headernya 2-kolom berpasangan, di sini cuma 1 judul per baris).
  const sectionHeaderRow = (title: string, h = 16) => {
    drawCell(tableX, y, tableWidth, h, hexToRgb(SECTION_HEADER_COLOR));
    textInCell(title, tableX, y, tableWidth, h, { size: 9 });
    y -= h;
  };

  // multiColRow — N sel sama lebar dlm satu baris, tiap sel "Label : Value"
  // (wrap otomatis), tinggi baris menyesuaikan sel dgn isi terpanjang.
  // Generalisasi fullTextRow (1 kolom)/splitRow (2 kolom)/splitRow3 (3 kolom).
  // opts.center — tiap baris teks di-center horizontal dlm sel (bukan rata
  // kiri spt default), dipakai baris "Tanda Vital" per permintaan user.
  const multiColRow = (cols: { label: string; value: string }[], minH = 16, size = 8.5, opts: { center?: boolean } = {}) => {
    const colW = tableWidth / cols.length;
    const colLines = cols.map((c) => wrapText(c.label ? `${c.label} : ${c.value?.trim() || '-'}` : (c.value?.trim() || '-'), colW - 12, size));
    const maxLines = Math.max(1, ...colLines.map((l) => l.length));
    const h = Math.max(minH, maxLines * 10 + 6);
    cols.forEach((_c, i) => {
      const cx = tableX + colW * i;
      drawCell(cx, y, colW, h);
      let ty = y - 11;
      colLines[i].forEach((line) => {
        const lx = opts.center ? cx + Math.max(0, (colW - font.widthOfTextAtSize(line, size)) / 2) : cx + 6;
        page.drawText(line, { x: lx, y: ty, size, font, color: rgb(0, 0, 0) });
        ty -= 10;
      });
    });
    y -= h;
  };

  // gridWithSidebar — grid label:value 2 kolom (N baris) di kiri (~65%
  // lebar) + 1 kolom lebar di kanan (~35%) yg tingginya menyamai TOTAL
  // tinggi grid (spt rowspan visual) — PERSIS referensi cetak Khanza
  // Desktop (kolom "hpht=.../TTP=.../DJJ=..." di kanan grid Kepala/
  // Thoraks dkk, dikonfirmasi user via screenshot PDF Khanza asli) — lebih
  // hemat ruang vertikal drpd sidebar ditumpuk sbg baris sendiri di bawah
  // grid (versi sebelumnya).
  const gridWithSidebar = (
    rows: { left: { label: string; value: string }; right: { label: string; value: string } }[],
    sidebar: { value: string },
    minRowH = 16,
    size = 8.5,
  ) => {
    const gridW = tableWidth * 0.65;
    const sidebarW = tableWidth - gridW;
    const colW = gridW / 2;

    const rowLines = rows.map((r) => [
      wrapText(`${r.left.label} : ${r.left.value?.trim() || '-'}`, colW - 12, size),
      wrapText(`${r.right.label} : ${r.right.value?.trim() || '-'}`, colW - 12, size),
    ]);
    const rowHeights = rowLines.map((lines) => Math.max(minRowH, Math.max(...lines.map((l) => l.length)) * 10 + 6));
    const totalH = rowHeights.reduce((a, b) => a + b, 0);

    const startY = y;
    rows.forEach((_r, i) => {
      const h = rowHeights[i];
      const cx0 = tableX;
      const cx1 = tableX + colW;
      drawCell(cx0, y, colW, h);
      drawCell(cx1, y, colW, h);
      let ty0 = y - 11;
      rowLines[i][0].forEach((line) => { page.drawText(line, { x: cx0 + 6, y: ty0, size, font, color: rgb(0, 0, 0) }); ty0 -= 10; });
      let ty1 = y - 11;
      rowLines[i][1].forEach((line) => { page.drawText(line, { x: cx1 + 6, y: ty1, size, font, color: rgb(0, 0, 0) }); ty1 -= 10; });
      y -= h;
    });

    // Sidebar — satu sel setinggi TOTAL grid, ditempel di kanan. TANPA
    // label ("Ket. Pemeriksaan Fisik :") di depan isinya — per permintaan
    // user, cukup teksnya saja (spt referensi Khanza yg isi bebasnya juga
    // tidak diawali label generik).
    const sbX = tableX + gridW;
    drawCell(sbX, startY, sidebarW, totalH);
    const sbLines = wrapText(sidebar.value?.trim() || '-', sidebarW - 12, size);
    let sty = startY - 11;
    sbLines.forEach((line) => { page.drawText(line, { x: sbX + 6, y: sty, size, font, color: rgb(0, 0, 0) }); sty -= 10; });
  };

  // ── I. RIWAYAT KESEHATAN
  sectionHeaderRow('I. RIWAYAT KESEHATAN');
  multiColRow([{ label: 'Keluhan Utama', value: data.keluhan_utama }], 18, 9);
  multiColRow([{ label: 'Riwayat Penyakit Sekarang', value: data.rps }], 18, 9);
  multiColRow([
    { label: 'Riwayat Penyakit Dahulu', value: data.rpd },
    { label: 'Riwayat Penyakit dalam Keluarga', value: data.rpk },
  ]);
  multiColRow([
    { label: 'Riwayat Pengobatan', value: data.rpo },
    { label: 'Riwayat Alergi', value: data.alergi },
  ]);

  // ── II. PEMERIKSAAN FISIK
  sectionHeaderRow('II. PEMERIKSAAN FISIK');
  multiColRow([
    { label: 'Keadaan Umum', value: data.keadaan },
    { label: 'Kesadaran', value: data.kesadaran },
    { label: 'GCS(E,V,M)', value: data.gcs },
  ]);
  const tandaVital = `TD : ${data.td || '-'} mmHg   N : ${data.nadi || '-'} x/m   R : ${data.rr || '-'} x/m   S : ${data.suhu || '-'}°   SPO2 : ${data.spo || '-'}%   BB : ${data.bb || '-'} Kg   TB : ${data.tb || '-'} cm`;
  multiColRow([{ label: 'Tanda Vital', value: tandaVital }], 18, 8.5, { center: true });
  gridWithSidebar(
    [
      { left: { label: 'Kepala', value: data.kepala }, right: { label: 'Thoraks', value: data.thoraks } },
      { left: { label: 'Mata', value: data.mata }, right: { label: 'Abdomen', value: data.abdomen } },
      { left: { label: 'Gigi & Mulut', value: data.gigi }, right: { label: 'Genital & Anus', value: data.genital } },
      { left: { label: 'Leher', value: data.leher }, right: { label: 'Ekstremitas', value: data.ekstremitas } },
    ],
    { value: data.ket_fisik },
  );

  // ── III. STATUS LOKALIS
  sectionHeaderRow('III. STATUS LOKALIS');
  if (lokalisImg) {
    const imgMaxW = tableWidth - 20;
    const imgMaxH = 140;
    const scale = Math.min(imgMaxW / lokalisImg.width, imgMaxH / lokalisImg.height, 1);
    const imgW = lokalisImg.width * scale;
    const imgH = lokalisImg.height * scale;
    const rowH = imgH + 12;
    drawCell(tableX, y, tableWidth, rowH);
    page.drawImage(lokalisImg, { x: tableX + (tableWidth - imgW) / 2, y: y - rowH + 6, width: imgW, height: imgH });
    y -= rowH;
  }
  multiColRow([{ label: 'Keterangan', value: data.ket_lokalis }], 18, 9);

  // ── IV. PEMERIKSAAN PENUNJANG
  sectionHeaderRow('IV. PEMERIKSAAN PENUNJANG');
  multiColRow([
    { label: 'EKG', value: data.ekg },
    { label: 'Radiologi', value: data.rad },
    { label: 'Laboratorium', value: data.lab },
  ]);

  // ── V. DIAGNOSIS/ASESMEN
  sectionHeaderRow('V. DIAGNOSIS/ASESMEN');
  multiColRow([{ label: '', value: data.diagnosis }], 18, 9);

  // ── VI. TATALAKSANA
  sectionHeaderRow('VI. TATALAKSANA');
  multiColRow([{ label: '', value: data.tata }], 28, 9);

  // Baris terakhir — Dokter Pemeriksa, tinggi diperbesar utk menampung
  // area tanda tangan (tag "#A#" + SIGN_BOX) di sisi kanan sel.
  const signRowH = 68;
  const labelColWidth = tableWidth * 0.30;
  const valueColX = tableX + labelColWidth;
  const valueColWidth = tableWidth - labelColWidth;
  drawCell(tableX, y, labelColWidth, signRowH);
  drawCell(valueColX, y, valueColWidth, signRowH);
  page.drawText('Dokter Pemeriksa', { x: tableX + 6, y: y - 14, size: 9, font, color: rgb(0, 0, 0) });
  const namaDokter = data.nm_dokter || '-';
  page.drawText(namaDokter, { x: valueColX + 6, y: y - 14, size: 9, font, color: rgb(0, 0, 0) });

  // Tag "#A#" + SIGN_BOX — persis formula QRCodePositionHelper (lihat
  // PERURI_TTE_DOKUMENTASI.md §2), box di-center TEPAT di posisi tag.
  const signAreaCenterX = valueColX + valueColWidth - 60;
  const tagX = signAreaCenterX - SIGN_BOX_WIDTH / 2 + SIGN_BOX_WIDTH / 2 - 5;
  const tagY = y - signRowH / 2;
  const centeredX = Math.trunc(tagX - SIGN_BOX_WIDTH / 2 + 5);
  const centeredY = Math.trunc(tagY - SIGN_BOX_HEIGHT / 2);
  const SIGN_BOX: AwalMedisSignBox = {
    lowerLeftX: centeredX, lowerLeftY: centeredY,
    upperRightX: centeredX + SIGN_BOX_WIDTH, upperRightY: centeredY + SIGN_BOX_HEIGHT,
    page: '1',
  };
  page.drawText('#A#', { x: tagX, y: tagY, size: 7, font, color: rgb(0.6, 0.6, 0.6) });

  y -= signRowH;

  // Footer legal — jarak tetap dari tepi bawah kertas (marginBottom,
  // beda dari margin atas/kiri/kanan per permintaan user).
  const footerSeparatorY = marginBottom - 10;
  if (footerSeparatorY < y) {
    page.drawLine({ start: { x: margin, y: footerSeparatorY }, end: { x: pageWidth - margin, y: footerSeparatorY }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    const footerText = 'Dokumen ini sah dan telah ditandatangani secara elektronik menggunakan sertifikat digital yang diterbitkan oleh Peruri';
    const footerLines = wrapText(footerText, tableWidth, 7.5);
    let footerLineY = footerSeparatorY - 10;
    footerLines.forEach((line) => {
      const w = font.widthOfTextAtSize(line, 7.5);
      page.drawText(line, { x: (pageWidth - w) / 2, y: footerLineY, size: 7.5, font, color: rgb(0.45, 0.45, 0.45) });
      footerLineY -= 9;
    });
  }

  const pdfBytes = await pdf.save();
  return { pdfBytes, signBox: SIGN_BOX, kdDokter: data.kd_dokter || '', namaDokter };
}
