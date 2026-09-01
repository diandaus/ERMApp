import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// triaseIgdPdf.ts — generate PDF dokumen Triase (Primer/Sekunder) siap
// kirim ke Peruri utk TTE. BEDA dari buildRadiologiPdfUntukTtd (yang
// gaya laporan bebas/kop+label:value): Triase digambar sbg TABEL
// BERGARIS PENUH (tiap baris = sel-sel berborder, kadang berwarna),
// mengikuti persis referensi cetak Triase Khanza Desktop (per
// permintaan user, "lebih banyak menggunakan line/tabel") — bukan cuma
// mendekati tampilan HTML renderTriasePrimer/Sekunder (triaseIgdDisplay.tsx)
// yang gaya tabelnya sendiri sudah beda konvensi (grid HTML biasa vs
// cetak resmi RS). Teknik tag "#A#" + SIGN_BOX tetap PERSIS pola
// buildRadiologiPdfUntukTtd — lihat backend/PERURI_TTE_DOKUMENTASI.md §2.
//
// BELUM termasuk pengambilan email penandatangan (dokter/petugas IGD) —
// itu baru dibutuhkan pas tombol TTE (kirim ke Peruri) dibuat, Preview
// tidak perlu kirim apa pun ke Peruri jadi tidak perlu email dulu.

export type TriaseSignBox = { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };

export type BuildTriasePdfResult = {
  pdfBytes: Uint8Array;
  signBox: TriaseSignBox;
  nikPetugas: string;
  namaPetugas: string;
};

type TriasePatientInfo = {
  no_rkm_medis?: string;
  nm_pasien?: string;
  jk?: string;
  tgl_lahir?: string;
  umur?: string;
  no_rawat?: string;
};

// Warna Skala 1-5 (ESI) — PERSIS triaseSkalaInfo di triaseIgdDisplay.tsx.
const SKALA_COLOR_HEX: Record<number, string> = {
  1: '#AA0000',
  2: '#FF0000',
  3: '#C8C800',
  4: '#00AA00',
  5: '#969696',
};
const SKALA_LABEL: Record<number, string> = {
  1: 'IMMEDIATE/SEGERA',
  2: 'EMERGENSI',
  3: 'URGENSI',
  4: 'SEMI URGENSI/URGENSI RENDAH',
  5: 'NON URGENSI',
};
const SECTION_HEADER_COLOR = '#EFEAD2'; // krem, header "KETERANGAN"/"PEMERIKSAAN"/"Petugas ..."

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const SIGN_BOX_WIDTH = 40;
const SIGN_BOX_HEIGHT = 40;

export async function buildTriasePdfUntukTtd(
  jenis: 'primer' | 'sekunder',
  data: any,
  patient: TriasePatientInfo,
): Promise<BuildTriasePdfResult> {
  const settingsRes = await fetch('/api/admin/settings');
  let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
  if (settingsRes.ok) settings = await settingsRes.json();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;
  const labelColWidth = tableWidth * 0.30;
  const valueColX = tableX + labelColWidth;
  const valueColWidth = tableWidth - labelColWidth;

  // wrapText — pecah dulu per baris baru ASLI (\n/\r\n dari textarea, mis.
  // isian Keluhan Utama/Catatan dgn Enter) SEBELUM word-wrap per kata.
  // WAJIB: kalau "\n" ikut kebawa ke page.drawText(), WinAnsiEncoding
  // pdf-lib melempar error "WinAnsi cannot encode "\n" (0x000a)" — lihat
  // catatan sama di awalMedisIgdPdf.ts (bug yg sama persis, dilaporkan
  // user di production utk Awal Medis, fix jaga2 di sini jg krn field
  // Triase yg berupa textarea rentan sama).
  const wrapText = (s: string, maxWidth: number, size: number, f = font): string[] => {
    const lines: string[] = [];
    s.split(/\r\n|\r|\n/).forEach((para) => {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
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

  // drawCell/textInCell didefinisikan di awal (bukan di dekat tabel
  // bawah) karena kop surat sekarang IKUT digambar sbg sel berborder —
  // permintaan user: "di header atau kop suratnya beri garis/tabel juga".
  const BORDER_COLOR = rgb(0.55, 0.55, 0.55);
  const drawCell = (x: number, yTop: number, w: number, h: number, bg?: ReturnType<typeof hexToRgb>) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: bg, borderColor: BORDER_COLOR, borderWidth: 0.75 });
  };
  const textInCell = (s: string, x: number, yTop: number, w: number, h: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; center?: boolean; padLeft?: number } = {}) => {
    const size = opts.size ?? 9;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? rgb(0, 0, 0);
    const ty = yTop - h / 2 - size * 0.35;
    if (opts.center) {
      const tw = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: x + Math.max(0, (w - tw) / 2), y: ty, size, font: f, color });
    } else {
      page.drawText(s, { x: x + (opts.padLeft ?? 6), y: ty, size, font: f, color });
    }
  };

  // Warna keputusan/kegawatan (skala tertinggi yg tercentang) — dipakai
  // DUA tempat: bar judul kop (per permintaan user, "titel barnya warna
  // mengikuti skala warna juga") DAN baris Plan/Keputusan di bawah.
  // Dihitung di awal (bukan cuma di dekat Plan) supaya kop bisa
  // memakainya duluan.
  let keputusanHex = '#969696';
  if (jenis === 'primer') {
    if (data.skala1?.length > 0) keputusanHex = '#AA0000';
    if (data.skala2?.length > 0) keputusanHex = '#FF0000';
  } else {
    if (data.skala3?.length > 0) keputusanHex = '#C8C800';
    if (data.skala4?.length > 0) keputusanHex = '#00AA00';
    if (data.skala5?.length > 0) keputusanHex = '#969696';
  }

  let y = pageHeight - margin;

  // ── Kop surat — 3 sel berborder (logo | instansi | info pasien).
  // Bar judul "TRIASE PASIEN GAWAT DARURAT" dipindah ke bawah kolom
  // logo+instansi SAJA (bukan lagi lebar penuh) — sel info pasien di
  // kanan menyambung 1 sel utuh dari atas s/d bawah bar judul, persis
  // referensi cetak. Warna bar JUGA mengikuti skala (keputusanHex),
  // bukan lagi warna maroon tetap.
  const titleBarH = 20;
  const kopH = 55;
  const kopTotalH = kopH + titleBarH;
  const kopLogoW = tableWidth * 0.11;
  const kopPatientW = tableWidth * 0.38;
  const kopInstansiW = tableWidth - kopLogoW - kopPatientW;
  const kopLogoX = tableX;
  const kopInstansiX = tableX + kopLogoW;
  const kopPatientX = kopInstansiX + kopInstansiW;

  drawCell(kopLogoX, y, kopLogoW, kopH);
  drawCell(kopInstansiX, y, kopInstansiW, kopH);
  drawCell(kopPatientX, y, kopPatientW, kopTotalH);
  drawCell(kopLogoX, y - kopH, kopLogoW + kopInstansiW, titleBarH, hexToRgb(keputusanHex));
  textInCell('TRIASE PASIEN GAWAT DARURAT', kopLogoX, y - kopH, kopLogoW + kopInstansiW, titleBarH, { size: 11, color: rgb(1, 1, 1), center: true });

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

  const patientInfoLabelW = 62;
  let py = y - 17;
  const patientRow = (label: string, value: string) => {
    page.drawText(label, { x: kopPatientX + 8, y: py, size: 8.5, font, color: rgb(0, 0, 0) });
    page.drawText(`: ${value || '-'}`, { x: kopPatientX + 8 + patientInfoLabelW, y: py, size: 8.5, font, color: rgb(0, 0, 0) });
    py -= 15;
  };
  patientRow('Nomor RM', patient.no_rkm_medis || '-');
  patientRow('Nama', patient.nm_pasien || '-');
  patientRow('Tanggal Lahir', patient.tgl_lahir || '-');
  patientRow('Jenis Kelamin', patient.jk === 'L' ? 'Laki-Laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-');

  y -= kopTotalH;

  // ── Tabel bergaris — dari sini tiap baris digambar sbg sel berborder
  // (drawCell), meniru cetak resmi Khanza. drawCell mengembalikan y baru
  // (bawah baris) supaya baris berikutnya nyambung tanpa celah.

  // Baris keterangan singkat.
  const noteH = 20;
  drawCell(tableX, y, tableWidth, noteH);
  textInCell('Triase dilakukan segera setelah pasien datang dan sebelum pasien/ keluarga mendaftar di TPP IGD', tableX, y, tableWidth, noteH, { size: 8.5, center: true });
  y -= noteH;

  // Baris split 50/50 — Tanggal Kunjungan | Pukul.
  const splitH = 20;
  const halfW = tableWidth / 2;
  drawCell(tableX, y, halfW, splitH);
  drawCell(tableX + halfW, y, halfW, splitH);
  textInCell(`Tanggal Kunjungan : ${data.tanggaltriase ? data.tanggaltriase.split(' ')[0] : '-'}`, tableX, y, halfW, splitH, { size: 9 });
  textInCell(`Pukul : ${data.tanggaltriase ? (data.tanggaltriase.split(' ')[1] || '-') : '-'}`, tableX + halfW, y, halfW, splitH, { size: 9 });
  y -= splitH;

  // Baris label:value standar (label kolom kiri, isi kolom kanan).
  const labelValueRow = (label: string, value: string, h = 20) => {
    drawCell(tableX, y, labelColWidth, h);
    drawCell(valueColX, y, valueColWidth, h);
    textInCell(label, tableX, y, labelColWidth, h, { size: 9 });
    textInCell(value || '-', valueColX, y, valueColWidth, h, { size: 9 });
    y -= h;
  };
  labelValueRow('Cara Datang', data.cara_masuk);
  labelValueRow('Macam Kasus', data.macam_kasus);

  // Baris header 2-kolom berwarna krem — "KETERANGAN" | "TRIASE PRIMER/SEKUNDER".
  const sectionHeaderRow = (leftText: string, rightText: string, h = 20) => {
    drawCell(tableX, y, labelColWidth, h, hexToRgb(SECTION_HEADER_COLOR));
    drawCell(valueColX, y, valueColWidth, h, hexToRgb(SECTION_HEADER_COLOR));
    textInCell(leftText, tableX, y, labelColWidth, h, { size: 9, center: true });
    textInCell(rightText, valueColX, y, valueColWidth, h, { size: 9, center: true });
    y -= h;
  };
  sectionHeaderRow('KETERANGAN', jenis === 'primer' ? 'TRIASE PRIMER' : 'TRIASE SEKUNDER');

  // Baris isi bebas panjang (Keluhan Utama/Anamnesa) — tinggi minimum
  // besar (meniru kotak kosong lega di referensi), tumbuh kalau isinya
  // panjang.
  const longTextRow = (label: string, value: string, minH = 70) => {
    const lines = wrapText(value?.trim() || '-', valueColWidth - 12, 9);
    const h = Math.max(minH, lines.length * 12 + 16);
    drawCell(tableX, y, labelColWidth, h);
    drawCell(valueColX, y, valueColWidth, h);
    textInCell(label, tableX, y, labelColWidth, h, { size: 9 });
    let ty = y - 12;
    lines.forEach((line) => { page.drawText(line, { x: valueColX + 6, y: ty, size: 9, font, color: rgb(0, 0, 0) }); ty -= 12; });
    y -= h;
  };
  longTextRow(jenis === 'primer' ? 'KELUHAN UTAMA' : 'ANAMNESA SINGKAT', jenis === 'primer' ? data.keluhan_utama : data.anamnesa_singkat);

  // Tanda Vital — satu sel, teks bisa wrap kalau kepanjangan.
  const vitalText = `Suhu (C) : ${data.suhu || '-'}, Nyeri : ${data.nyeri || '-'}, Tensi : ${data.tekanan_darah || '-'}, Nadi(/menit) : ${data.nadi || '-'}, Saturasi O²(%) : ${data.saturasi_o2 || '-'}, Respirasi(/menit) : ${data.pernapasan || '-'}`;
  {
    const lines = wrapText(vitalText, valueColWidth - 12, 8.5);
    const h = Math.max(20, lines.length * 11 + 10);
    drawCell(tableX, y, labelColWidth, h);
    drawCell(valueColX, y, valueColWidth, h);
    textInCell('TANDA VITAL', tableX, y, labelColWidth, h, { size: 9 });
    let ty = y - h / 2 + (lines.length - 1) * 5.5 - 3;
    lines.forEach((line) => { page.drawText(line, { x: valueColX + 6, y: ty, size: 8.5, font, color: rgb(0, 0, 0) }); ty -= 11; });
    y -= h;
  }

  if (jenis === 'primer') {
    labelValueRow('KEBUTUHAN KHUSUS', data.kebutuhan_khusus);
  }

  // Checklist Skala — header "PEMERIKSAAN | {LABEL SKALA}" (warna sesuai
  // kegawatan) lalu satu baris per item pemeriksaan, sel kanan berwarna
  // sama, teks putih — PERSIS pola renderTriaseSkalaRows.
  const drawSkalaGroup = (skalaNum: number, items: any[]) => {
    if (!items || items.length === 0) return;
    const color = hexToRgb(SKALA_COLOR_HEX[skalaNum]);
    const headerH = 20;
    drawCell(tableX, y, labelColWidth, headerH, hexToRgb(SECTION_HEADER_COLOR));
    drawCell(valueColX, y, valueColWidth, headerH, color);
    textInCell('PEMERIKSAAN', tableX, y, labelColWidth, headerH, { size: 9, center: true });
    textInCell(SKALA_LABEL[skalaNum], valueColX, y, valueColWidth, headerH, { size: 9, color: rgb(1, 1, 1), center: true });
    y -= headerH;

    items.forEach((item: any) => {
      const detailText = (item.details || []).map((d: any) => d[`pengkajian_skala${skalaNum}`]).filter(Boolean).join(', ');
      const lines = wrapText(detailText || '-', valueColWidth - 12, 9);
      const h = Math.max(18, lines.length * 12 + 6);
      drawCell(tableX, y, labelColWidth, h);
      drawCell(valueColX, y, valueColWidth, h, color);
      textInCell(item.nama_pemeriksaan || '-', tableX, y, labelColWidth, h, { size: 8.5 });
      let ty = y - h / 2 + (lines.length - 1) * 6 - 3;
      lines.forEach((line) => { page.drawText(line, { x: valueColX + 6, y: ty, size: 9, font, color: rgb(1, 1, 1) }); ty -= 12; });
      y -= h;
    });
  };
  if (jenis === 'primer') {
    drawSkalaGroup(1, data.skala1);
    drawSkalaGroup(2, data.skala2);
  } else {
    drawSkalaGroup(3, data.skala3);
    drawSkalaGroup(4, data.skala4);
    drawSkalaGroup(5, data.skala5);
  }

  // Plan/Keputusan — baris berwarna sesuai kegawatan (keputusanHex sudah
  // dihitung di awal fungsi, dipakai jg utk bar judul kop). Prefix "Zona
  // Merah" khusus Primer (logika PERSIS renderTriasePrimer/Sekunder).
  const planText = jenis === 'primer' ? `Zona Merah ${data.plan || '-'}` : (data.plan || '-');
  {
    const h = 20;
    drawCell(tableX, y, labelColWidth, h);
    drawCell(valueColX, y, valueColWidth, h, hexToRgb(keputusanHex));
    textInCell('PLAN', tableX, y, labelColWidth, h, { size: 9 });
    textInCell(planText, valueColX, y, valueColWidth, h, { size: 9, color: rgb(1, 1, 1) });
    y -= h;
  }

  // Header krem "Petugas Triase Primer/Sekunder" — sel kiri kosong.
  sectionHeaderRow('', jenis === 'primer' ? 'Petugas Triase Primer' : 'Petugas Triase Sekunder');

  labelValueRow('Tanggal & Jam', data.tanggaltriase);
  labelValueRow('Catatan', data.catatan);

  // Baris terakhir — Dokter/Petugas Jaga IGD, tinggi diperbesar utk
  // menampung area tanda tangan (tag "#A#" + SIGN_BOX) di sisi kanan sel.
  const signRowH = 68;
  drawCell(tableX, y, labelColWidth, signRowH);
  drawCell(valueColX, y, valueColWidth, signRowH);
  page.drawText('Dokter/Petugas Jaga IGD', { x: tableX + 6, y: y - 14, size: 9, font, color: rgb(0, 0, 0) });
  const namaPetugas = data.nama || '-';
  page.drawText(namaPetugas, { x: valueColX + 6, y: y - 14, size: 9, font, color: rgb(0, 0, 0) });

  // Tag "#A#" + SIGN_BOX — persis formula QRCodePositionHelper (lihat
  // PERURI_TTE_DOKUMENTASI.md §2), box di-center TEPAT di posisi tag,
  // ditaruh di sisi kanan sel Dokter/Petugas Jaga IGD (area stample
  // Peruri akan ditempel di situ nanti — TIDAK digambar apa pun selain
  // tag kecil abu-abu, kotaknya sengaja kosong).
  const signAreaCenterX = valueColX + valueColWidth - 60;
  const tagX = signAreaCenterX - SIGN_BOX_WIDTH / 2 + SIGN_BOX_WIDTH / 2 - 5;
  const tagY = y - signRowH / 2;
  const centeredX = Math.trunc(tagX - SIGN_BOX_WIDTH / 2 + 5);
  const centeredY = Math.trunc(tagY - SIGN_BOX_HEIGHT / 2);
  const SIGN_BOX: TriaseSignBox = {
    lowerLeftX: centeredX, lowerLeftY: centeredY,
    upperRightX: centeredX + SIGN_BOX_WIDTH, upperRightY: centeredY + SIGN_BOX_HEIGHT,
    page: '1',
  };
  page.drawText('#A#', { x: tagX, y: tagY, size: 7, font, color: rgb(0.6, 0.6, 0.6) });

  y -= signRowH;

  // Footer legal — jarak tetap dari tepi bawah kertas.
  const footerSeparatorY = margin - 10;
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
  return { pdfBytes, signBox: SIGN_BOX, nikPetugas: data.nik || '', namaPetugas };
}
