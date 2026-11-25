import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// hasilRadiologiPdf.ts — PDF hasil pemeriksaan radiologi yg dikirim ke
// Peruri utk TTE (dulu tertanam di ModalHasilRadiologi.tsx sbg
// buildRadiologiPdfUntukTtd). Dipindah ke sini supaya dipakai BERSAMA
// oleh ModalHasilRadiologi.tsx & ModalInputUSG.tsx (judul & label petugas
// beda, layout/koordinat stample Peruri sama persis).

// umurDariTglLahir — padanan persis calculateAgeDetails() di
// ModalCariPasien.tsx, diformat "X Th Y Bl Z Hr" spt pasien.umur Khanza.
export const umurDariTglLahir = (tglLahir: string): string => {
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

// Kotak tanda tangan elektronik Peruri (Penanggung Jawab, kiri) — posisi
// Y-nya dinamis, mengikuti bawah kotak "Hasil Pemeriksaan" (lihat tag
// "#A#" di buildRadiologiPdfUntukTtd). Beda dari percobaan SEBELUMNYA yg
// sempat bikin error [4012] Signing (koordinat cuma dihitung matematis
// tanpa penanda visual apa pun) — sekarang persis pola Khanza
// (QRCodePositionHelper.detectQRPosition, cari tag "#A#" di atas nama
// dokter): tag "#A#" BENAR2 digambar di PDF di posisi itu, lalu
// SIGN_BOX dihitung LANGSUNG dari koordinat gambar tag tsb (bukan
// deteksi ulang scan PDF — krn PDF-nya kita generate sendiri, kita
// sudah tau persis koordinatnya, tidak perlu scan ulang spt Khanza yg
// PDF-nya dari Jasper Report terpisah).
// Ukuran box — awalnya 35x34 (persis QR_WIDTH/QR_HEIGHT di
// QRCodePositionHelper.java), diperbesar ke 40x40 (msh integer, aman)
// supaya stample ASLI Peruri (yg dirender mengikuti ukuran box ini)
// sama besar dgn QR Petugas Radiologi (jg 40x40, lihat qrSize) — box
// di-CENTER pd posisi tag (offset -width/2+5 horizontal, -height/2
// vertikal), BUKAN tag ditaruh di dalam box yg dihitung duluan spt
// percobaan sebelumnya.
const SIGN_BOX_WIDTH = 40;
const SIGN_BOX_HEIGHT = 40;
// Jarak dari tepi bawah kotak Hasil Pemeriksaan ke TITIK TENGAH
// SIGN_BOX (blockCenterY/tagY) — HARUS cukup lebar utk menampung
// seluruh tumpukan visual di ATAS titik tengah itu (label +12, lalu
// Tgl.Cetak +14 lagi di atas label, +-8 tinggi teks, +10 jarak aman =
// ~64pt total dari blockCenterY). 16 (nilai lama) KURANG kalau hasil
// pemeriksaannya pendek — kotak Hasil Pemeriksaan jadi kecil/di atas,
// label & Tgl.Cetak ketimpa garis bawah kotaknya. Lihat blockCenterY,
// labelY, tglCetakText di buildRadiologiPdfUntukTtd.
const SIGN_BOX_GAP_BELOW_HASIL = 55;

// buildRadiologiPdfUntukTtd — PENGECUALIAN dari CETAK_STANDAR.md §1
// (sama pola dgn buildBillingPdf di ModalBilling.tsx): fitur kirim ke
// Peruri genuinely butuh byte PDF asli (base64Document), window.print()
// tidak bisa diambil sbg byte oleh JS. Layout best-effort mendekati
// handleCetak (BUKAN identik — font Helvetica pdf-lib, bukan Tahoma asli).
export type HasilRadiologiPdfOpts = {
  noorder: string;
  kdDokterPj: string;
  // Nama Dokter P.J. yg tampil di form (boleh kosong → dari data dokter).
  namaDokterPj?: string;
  // Teks hasil yg SEDANG diketik di form (bukan yg tersimpan).
  hasil: string;
  judul?: string;
  labelPetugas?: string;
  // true = hanya preview (tidak dikirim ke Peruri): email dokter P.J.
  // tidak wajib ada. Default false (alur Tanda Tangan butuh email).
  preview?: boolean;
  // 'usg' = layout khusus HASIL PEMERIKSAAN USG: tanpa baris Penanggung
  // Jawab (info kanan), No.Periksa, Pemeriksaan, Tgl.Cetak & Petugas;
  // tanda tangan Penanggung Jawab (area stample Peruri) di KANAN.
  varian?: 'radiologi' | 'usg';
  // Khusus varian 'usg': ditampilkan sbg bagian sendiri di kotak yg sama
  // dgn Hasil Pemeriksaan (hasil = teks hasil SAJA, tanpa kesan/saran).
  kesan?: string;
  saran?: string;
};

export async function buildHasilRadiologiPdfUntukTtd(opts: HasilRadiologiPdfOpts): Promise<{
  pdfBytes: Uint8Array; email: string; namaDokterPj: string;
  signBox: { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };
}> {
  const { noorder, kdDokterPj, hasil } = opts;
  const dokterPjQuery = opts.namaDokterPj || '';
  const judul = opts.judul || 'HASIL PEMERIKSAAN RADIOLOGI';
  const labelPetugas = opts.labelPetugas || 'Petugas Radiologi';
  const isUsg = opts.varian === 'usg';
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
  if (!emailRes.ok && !opts.preview) throw new Error(emailData.error || 'Dokter P.J. tidak ditemukan');
  const namaDokterPj = dokterPjQuery || emailData.nm_dokter || '-';
  if (!emailData.email && !opts.preview) {
    throw new Error(`Email dokter penanggung jawab (${namaDokterPj}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
  }
  const emailDokterPj = (emailData.email as string) || '';

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
  centerText(judul, 12, false);
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
    ...(isUsg ? [] : [['No.Periksa', data.no_periksa] as [string, string]]),
  ];
  const infoRight: [string, string][] = [
    ...(isUsg ? [] : [['Penanggung Jawab', namaDokterPj] as [string, string]]), ['Dokter Pengirim', data.dokter_pengirim || '-'],
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
  y = rowStartY - Math.max(infoLeft.length, infoRight.length) * 14;
  if (isUsg) {
    y -= 6;
  } else {
    text('Pemeriksaan', colLeftX, 9.5); text(`: ${data.pemeriksaan}`, colLeftX + 90, 9.5);
    y -= 20;
  }

  if (isUsg) {
    // USG: SATU kotak berisi 3 bagian — Hasil Pemeriksaan, Kesimpulan/
    // Kesan, Saran/Anjuran — judul masing2 di DALAM kotak.
    const lebar = pageWidth - margin * 2 - 16;
    const boxTop = y;
    y -= 16;
    const bagian: [string, string][] = [
      ['Hasil Pemeriksaan :', hasil],
      ['Kesimpulan/Kesan :', opts.kesan || ''],
      ['Saran/Anjuran :', opts.saran || ''],
    ];
    bagian.forEach(([judulBagian, isi], idx) => {
      if (idx > 0) y -= 8;
      text(judulBagian, margin + 8, 10, false);
      y -= 15;
      const lines = (isi.trim() || '-').split('\n').flatMap((line: string) => wrapText(line || ' ', lebar, 9.5));
      for (const line of lines) {
        text(line, margin + 8, 9.5);
        y -= 13;
      }
    });
    page.drawRectangle({
      x: margin, y: y - 6, width: pageWidth - margin * 2, height: boxTop - (y - 6),
      borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1,
    });
    y -= 6;
  } else {
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
    borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1,
  });
  y -= 6; // tepi bawah kotak hasil (sama spt y yg dipakai utk drawRectangle di atas)
  }

  // Tag "#A#" — posisi (tagX, tagY) dihitung DULU (dinamis, persis di
  // bawah kotak Hasil Pemeriksaan, diclamp ke margin bawah halaman),
  // BARU SIGN_BOX di-CENTER tepat di posisi tag ini — persis formula
  // QRCodePositionHelper.detectQRPosition milik Khanza (bridging/
  // QRCodePositionHelper.java): box 35x34 di-center pd (tagX,tagY)
  // dgn offset +5 ke kanan, BUKAN tag ditaruh di dalam box yg dihitung
  // duluan (itu kesalahan implementasi kita sebelumnya).
  // USG: Penanggung Jawab di KANAN — box center (tagX+5) = tengah kolom
  // kanan (475, sama dgn petugasBoxCenterX di bawah).
  const tagX = isUsg ? 470 : margin + 60;
  const tagY = Math.max(margin + SIGN_BOX_HEIGHT / 2, y - SIGN_BOX_GAP_BELOW_HASIL - SIGN_BOX_HEIGHT / 2);
  // (int) cast persis QRCodePositionHelper.java ("(int) centeredX") —
  // pageHeight A4 (841.89) bikin y berantai jadi desimal terus, kalau
  // koordinatnya dikirim ke Peruri sbg string desimal (mis. "87.5")
  // kemungkinan besar itu penyebab [4012] "Gagal melakukan proses
  // penandatanganan" (koordinat fixed sebelumnya SEMUA bilangan bulat).
  const centeredX = Math.trunc(tagX - SIGN_BOX_WIDTH / 2 + 5);
  const centeredY = Math.trunc(tagY - SIGN_BOX_HEIGHT / 2);
  const SIGN_BOX = {
    lowerLeftX: centeredX, lowerLeftY: centeredY,
    upperRightX: centeredX + SIGN_BOX_WIDTH, upperRightY: centeredY + SIGN_BOX_HEIGHT,
    page: '1',
  };

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

  // Layout label/gambar/nama kedua kolom dipisah TOTAL dari SIGN_BOX yg
  // kecil (35x34, cuma target koordinat API Peruri) — dianchor ke titik
  // tengah SIGN_BOX (blockCenterY, tetap ikut naik/turun dinamis) tapi
  // dikasih jarak lebar supaya QR petugas (40x40) & stample ASLI Peruri
  // (yg ternyata dirender LEBIH BESAR dari 35x34 yg diminta) tidak
  // menimpa label/nama di atas & bawahnya.
  const blockCenterY = (SIGN_BOX.lowerLeftY + SIGN_BOX.upperRightY) / 2;
  const qrSize = 40;
  const labelY = blockCenterY + qrSize / 2 + 12;
  const nameY = blockCenterY - qrSize / 2 - 12;

  // Tgl.Cetak — di atas label kolom kanan (Petugas Radiologi). Tidak ada di USG.
  if (!isUsg) {
    const tglCetakText = `Tgl.Cetak : ${tanggalCetak}`;
    const tglCetakW = font.widthOfTextAtSize(tglCetakText, 8.5);
    page.drawText(tglCetakText, {
      x: petugasBoxCenterX - tglCetakW / 2, y: labelY + 14, size: 8.5, font, color: rgb(0, 0, 0),
    });
  }

  // Kolom KIRI — Penanggung Jawab. Area stample Peruri (SIGN_BOX,
  // 40x40) — TIDAK digambar apa pun di sini (kosong, sengaja
  // dibiarkan tanpa border), stample-nya BENAR2 ditempel Peruri
  // sendiri di dokumen hasil tanda tangan.
  const visualBoxCenterX = (SIGN_BOX.lowerLeftX + SIGN_BOX.upperRightX) / 2;
  const signLabelW = font.widthOfTextAtSize('Penanggung Jawab', 9);
  page.drawText('Penanggung Jawab', {
    x: visualBoxCenterX - signLabelW / 2, y: labelY,
    size: 9, font, color: rgb(0, 0, 0),
  });
  // Tag "#A#" — digambar PERSIS di (tagX, tagY), titik anchor yg dipakai
  // buat hitung SIGN_BOX di atas (posisi karakter pertama tag — sama
  // dgn yg ditangkap TextPosition.getXDirAdj()/getYDirAdj() di
  // QRCodePositionHelper.java kalau discan ulang, tapi di sini kita
  // sudah tau persis nilainya krn kita yg menggambar).
  page.drawText('#A#', { x: tagX, y: tagY, size: 7, font, color: rgb(0.6, 0.6, 0.6) });
  const namaW = font.widthOfTextAtSize(namaDokterPj, 9);
  page.drawText(namaDokterPj, {
    x: visualBoxCenterX - namaW / 2, y: nameY,
    size: 9, font, color: rgb(0, 0, 0),
  });

  // Isi kolom kanan — Petugas Radiologi: label, QR lokal, nama. TANPA
  // border (bukan area reserved, ini tanda tangan yg sudah "jadi").
  // (Tidak ada di USG — kolom kanan dipakai Penanggung Jawab.)
  if (!isUsg) {
    const petugasLabelW = font.widthOfTextAtSize(labelPetugas, 9);
    page.drawText(labelPetugas, {
      x: petugasBoxCenterX - petugasLabelW / 2, y: labelY, size: 9, font, color: rgb(0, 0, 0),
    });
    if (qrPetugasImg) {
      page.drawImage(qrPetugasImg, { x: petugasBoxCenterX - qrSize / 2, y: blockCenterY - qrSize / 2, width: qrSize, height: qrSize });
    }
    const petugasNamaW = font.widthOfTextAtSize(data.petugas_nama || '-', 9);
    page.drawText(data.petugas_nama || '-', {
      x: petugasBoxCenterX - petugasNamaW / 2, y: nameY, size: 9, font, color: rgb(0, 0, 0),
    });
  }

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
}
