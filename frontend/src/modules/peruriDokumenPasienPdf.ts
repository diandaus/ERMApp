import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

// peruriDokumenPasienPdf.ts — rakit PDF "dokumen pasien yg akan di-TTE" utk
// submenu Peruri "Lihat Dokumen / Perlu Diproses" (tombol mata). Pola sama
// dgn buildHasilLabPKPdfUntukTtd di ModalHasilLabPK.tsx: data dari backend
// (GET /api/peruri/dokumen-pasien), kop dari /api/admin/settings, PDF dibuat
// di browser pakai pdf-lib.
//
// Isi & tata letak MASIH VERSI AWAL — akan dirapikan bertahap.
//
// Posisi stample TTE: tag teks "#A#" digambar di bawah konten terakhir,
// lalu SIGN_BOX 40x40 di-CENTER pd posisi tag itu — PERSIS pola
// buildHasilLabPKPdfUntukTtd / buildRadiologiPdfUntukTtd (padanan
// QRCodePositionHelper.java Khanza). Koordinat WAJIB integer (Math.trunc),
// nilai desimal ditolak Peruri dgn error [4012].

type Row = Record<string, string>;

export type DokumenPasienData = {
  pasien: Row;
  dpjp: Row[];
  kamar: Row[];
  soap: Row[];
  diagnosa: Row[];
  prosedur: Row[];
  tindakan: Row[];
  obat: Row[];
  lab: Row[];
  radiologi: Row[];
  peringatan: string[];
};

export type SignBox = { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };

const SIGN_BOX_WIDTH = 40;
const SIGN_BOX_HEIGHT = 40;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
// Batas bawah konten — di bawah ini dipakai footer legal & nomor halaman.
const BOTTOM = 60;

// Font standar pdf-lib (WinAnsi) tidak bisa menggambar karakter di luar
// Latin-1 → ganti '?' supaya PDF tidak gagal dibuat krn 1 karakter aneh.
const sanitize = (s: string | undefined | null) =>
  (s ?? '').replace(/\r/g, '').replace(/\t/g, '    ').replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');

// Nilai dianggap kosong kalau ""/spasi/"-" (Khanza sering isi "-" utk kosong).
const ada = (v: string | undefined | null) => !!v && v.trim() !== '' && v.trim() !== '-';

const formatRupiah = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? `Rp ${Math.round(n).toLocaleString('id-ID')}` : v || '-';
};

const formatTgl = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s || '-';
};

export async function buildDokumenPasienPdf(noRawat: string): Promise<{ pdfBytes: Uint8Array; data: DokumenPasienData; signBox: SignBox; namaPengesah: string }> {
  const [dataRes, settingsRes] = await Promise.all([
    fetch(`/api/peruri/dokumen-pasien?no_rawat=${encodeURIComponent(noRawat)}`),
    fetch('/api/admin/settings'),
  ]);
  const data = (await dataRes.json().catch(() => ({}))) as DokumenPasienData & { error?: string };
  if (!dataRes.ok) throw new Error(data.error || 'Gagal memuat data dokumen pasien');
  let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
  if (settingsRes.ok) settings = { ...settings, ...(await settingsRes.json().catch(() => ({}))) };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (s: string, x: number, size = 9, bold = false, color = rgb(0, 0, 0)) => {
    page.drawText(sanitize(s), { x, y, size, font: bold ? fontBold : font, color });
  };
  const wrap = (raw: string, maxWidth: number, size = 9, f: PDFFont = font): string[] => {
    const out: string[] = [];
    for (const para of sanitize(raw).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          out.push(line);
          line = w;
          // kata tunggal yg lebih lebar dari kolom → potong paksa
          while (f.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
            out.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        } else {
          line = test;
        }
      }
      out.push(line);
    }
    return out;
  };
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) newPage();
  };

  // ── Kop (pola 3 kolom sama dgn PDF Lab/Radiologi) ──
  let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (settings.logo_url) {
    try {
      const logoSrc = settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url;
      const imgRes = await fetch(logoSrc);
      if (imgRes.ok) {
        const bytes = await imgRes.arrayBuffer();
        const isJpg = /\.(jpe?g)($|\?)/i.test(logoSrc) || (imgRes.headers.get('content-type') || '').includes('jpeg');
        logoImg = isJpg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      }
    } catch { /* lanjut tanpa logo */ }
  }
  const col2X = MARGIN + CONTENT_W * 0.2;
  const col2W = CONTENT_W * 0.6;
  const centerIn = (s: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const t = sanitize(s);
    page.drawText(t, { x: col2X + (col2W - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f });
  };
  const kopTop = y;
  const logoSize = 45;
  if (logoImg) page.drawImage(logoImg, { x: MARGIN, y: kopTop - logoSize + 8, width: logoSize, height: logoSize });
  if (settings.nama_instansi) { centerIn(settings.nama_instansi, 14); y -= 11; }
  if (settings.alamat) { centerIn(settings.alamat, 9); y -= 11; }
  if (settings.kontak) { centerIn(settings.kontak, 9); y -= 11; }
  if (settings.email_rs) { centerIn(`E-mail : ${settings.email_rs}`, 9); }
  y = Math.min(y, kopTop - logoSize + 8 - 4) - 1;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1 });
  y -= 18;
  const judul = 'RINGKASAN PERAWATAN PASIEN';
  page.drawText(judul, { x: (PAGE_W - fontBold.widthOfTextAtSize(judul, 12)) / 2, y, size: 12, font: fontBold });
  y -= 22;

  // ── Identitas pasien (2 kolom) ──
  const p = data.pasien || {};
  const ranap = p.status_lanjut === 'Ranap';
  const dpjpNama = (data.dpjp || []).map((d) => d.nm_dokter).filter(Boolean).join(', ');
  const infoLeft: [string, string][] = [
    ['No. Rawat', p.no_rawat],
    ['No. RM', p.no_rkm_medis],
    ['Nama Pasien', p.nm_pasien],
    ['JK / Umur', [p.jk, p.umur].filter(ada).join(' / ')],
    ['Tgl. Lahir', [p.tmp_lahir, ada(p.tgl_lahir) && p.tgl_lahir !== '0000-00-00' ? formatTgl(p.tgl_lahir) : ''].filter(ada).join(', ')],
    ['Alamat', p.alamat],
  ];
  const infoRight: [string, string][] = [
    ['Tgl. Registrasi', `${formatTgl(p.tgl_registrasi)} ${p.jam_reg || ''}`],
    ['Jenis Rawat', ranap ? 'Rawat Inap' : 'Rawat Jalan'],
    [ranap ? 'Poli Asal' : 'Poli', p.nm_poli],
    [ranap ? 'DPJP' : 'Dokter', ranap && dpjpNama ? dpjpNama : p.nm_dokter],
    ['Cara Bayar', p.png_jawab],
    ['No. Peserta', p.no_peserta],
  ];
  const drawInfo = (items: [string, string][], x: number, labelW: number, valueW: number) => {
    let yy = y;
    for (const [label, value] of items) {
      if (!ada(value)) continue;
      const lines = wrap(value, valueW, 9);
      page.drawText(label, { x, y: yy, size: 9, font });
      lines.slice(0, 2).forEach((ln, i) => {
        page.drawText(`${i === 0 ? ': ' : '  '}${ln}`, { x: x + labelW, y: yy - i * 11, size: 9, font });
      });
      yy -= 13 + (Math.min(lines.length, 2) - 1) * 11;
    }
    return yy;
  };
  const half = CONTENT_W / 2;
  const yLeft = drawInfo(infoLeft, MARGIN, 70, half - 85);
  const yRight = drawInfo(infoRight, MARGIN + half + 10, 80, half - 100);
  y = Math.min(yLeft, yRight) - 6;

  // ── Helper seksi & tabel ──
  const sectionTitle = (title: string) => {
    ensure(40);
    y -= 4;
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 16, color: rgb(0.9, 0.96, 0.93) });
    draw(title, MARGIN + 6, 10, true, rgb(0.02, 0.37, 0.27));
    y -= 20;
  };

  type Col = { label: string; width: number; get: (r: Row, i: number) => string; align?: 'right' };
  // reserveAfter: ruang yg harus tersisa setelah baris TERAKHIR (mis. baris
  // total) supaya total tidak terpisah sendirian ke halaman berikutnya.
  const table = (cols: Col[], rows: Row[], reserveAfter = 0) => {
    const size = 8.5;
    const lineH = 10.5;
    const drawHeader = () => {
      page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: PAGE_W - MARGIN, y: y + 10 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      let x = MARGIN;
      for (const c of cols) {
        const lx = c.align === 'right' ? x + c.width - 3 - fontBold.widthOfTextAtSize(c.label, size) : x + 3;
        page.drawText(c.label, { x: lx, y, size, font: fontBold });
        x += c.width;
      }
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      y -= lineH;
    };
    ensure(40);
    drawHeader();
    rows.forEach((r, i) => {
      const cells = cols.map((c) => wrap(c.get(r, i) || '-', c.width - 6, size));
      const h = Math.max(...cells.map((l) => l.length)) * lineH;
      const need = h + (i === rows.length - 1 ? reserveAfter : 0);
      if (y - need < BOTTOM) { newPage(); y -= 10; drawHeader(); }
      let x = MARGIN;
      cells.forEach((lines, ci) => {
        const right = cols[ci].align === 'right';
        lines.forEach((ln, li) => page.drawText(ln, {
          x: right ? x + cols[ci].width - 3 - font.widthOfTextAtSize(ln, size) : x + 3,
          y: y - li * lineH, size, font,
        }));
        x += cols[ci].width;
      });
      y -= h + 2;
    });
    y -= 8;
  };
  // Baris total di bawah tabel terakhir (garis + label & nominal rata kanan).
  const totalRow = (label: string, nominal: string) => {
    const size = 8.5;
    y += 8; // batalkan jarak bawah tabel, total menempel ke tabel
    if (y - 16 < BOTTOM) newPage();
    page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 3;
    const right = PAGE_W - MARGIN - 3;
    const nomW = fontBold.widthOfTextAtSize(nominal, size);
    page.drawText(nominal, { x: right - nomW, y, size, font: fontBold });
    page.drawText(label, { x: right - nomW - 20 - fontBold.widthOfTextAtSize(label, size), y, size, font: fontBold });
    y -= 18;
  };
  // Seksi tabel HANYA digambar kalau ada datanya (seksi kosong disembunyikan).
  const seksiTabel = (title: string, cols: Col[], rows: Row[] | undefined, reserveAfter = 0) => {
    if (!rows?.length) return;
    sectionTitle(title);
    table(cols, rows, reserveAfter);
  };

  // ── Kamar (ranap) ──
  if (ranap) {
    seksiTabel('Riwayat Kamar', [
      { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
      { label: 'Kamar / Bangsal', width: 170, get: (r) => `${r.kd_kamar} - ${r.nm_bangsal || ''}` },
      { label: 'Masuk', width: 85, get: (r) => `${formatTgl(r.tgl_masuk)} ${r.jam_masuk || ''}` },
      { label: 'Keluar', width: 70, get: (r) => (r.tgl_keluar ? formatTgl(r.tgl_keluar) : '-') },
      { label: 'Lama', width: 35, get: (r) => r.lama },
      { label: 'Status Pulang', width: CONTENT_W - 385, get: (r) => r.stts_pulang },
    ], data.kamar);
  }

  // ── Diagnosa & prosedur ──
  seksiTabel('Diagnosa (ICD-10)', [
    { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
    { label: 'Kode', width: 60, get: (r) => r.kd_penyakit },
    { label: 'Nama Penyakit', width: CONTENT_W - 205, get: (r) => r.nm_penyakit },
    { label: 'Status', width: 60, get: (r) => r.status },
    { label: 'Prioritas', width: 60, get: (r) => r.prioritas },
  ], data.diagnosa);

  seksiTabel('Prosedur (ICD-9-CM)', [
    { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
    { label: 'Kode', width: 60, get: (r) => r.kode },
    { label: 'Deskripsi', width: CONTENT_W - 205, get: (r) => r.deskripsi_panjang },
    { label: 'Status', width: 60, get: (r) => r.status },
    { label: 'Prioritas', width: 60, get: (r) => r.prioritas },
  ], data.prosedur);

  // ── SOAP ──
  if (data.soap?.length) sectionTitle('Catatan Perkembangan (SOAP)');
  (data.soap || []).forEach((s) => {
    ensure(50);
    draw(`${formatTgl(s.tgl_perawatan)} ${s.jam_rawat || ''}  |  ${s.jenis === 'Ranap' ? 'Rawat Inap' : 'Rawat Jalan'}  |  ${s.nama_petugas || s.nip || '-'}`, MARGIN + 6, 9, true);
    y -= 12;
    const vital = [
      ['Suhu', s.suhu_tubuh, 'C'], ['Tensi', s.tensi, 'mmHg'], ['Nadi', s.nadi, '/mnt'], ['RR', s.respirasi, '/mnt'],
      ['SpO2', s.spo2, '%'], ['TB', s.tinggi, 'cm'], ['BB', s.berat, 'kg'], ['GCS', s.gcs, ''], ['Kesadaran', s.kesadaran, ''],
    ].filter(([, v]) => ada(v)).map(([k, v, u]) => `${k}: ${v}${u ? ` ${u}` : ''}`).join('   ');
    const fields: [string, string][] = [
      ['TTV', vital], ['Subjek', s.keluhan], ['Objek', s.pemeriksaan], ['Alergi', s.alergi], ['Asesmen', s.penilaian],
      ['Plan', s.rtl], ['Instruksi', s.instruksi], ['Evaluasi', s.evaluasi],
    ];
    for (const [label, value] of fields) {
      if (!ada(value)) continue;
      const lines = wrap(value, CONTENT_W - 80, 9);
      lines.forEach((ln, i) => {
        ensure(12);
        if (i === 0) draw(label, MARGIN + 12, 9, false, rgb(0.35, 0.35, 0.35));
        draw(`${i === 0 ? ': ' : '  '}${ln}`, MARGIN + 66, 9);
        y -= 11;
      });
    }
    y -= 4;
    page.drawLine({ start: { x: MARGIN + 6, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    y -= 8;
  });

  // ── Tindakan, obat, penunjang ──
  seksiTabel('Tindakan', [
    { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
    { label: 'Tanggal', width: 85, get: (r) => `${formatTgl(r.tgl)} ${r.jam || ''}` },
    { label: 'Tindakan', width: CONTENT_W - 220, get: (r) => r.nm_perawatan },
    { label: 'Biaya', width: 110, get: (r) => formatRupiah(r.biaya), align: 'right' },
  ], data.tindakan);

  seksiTabel('Pemberian Obat', [
    { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
    { label: 'Tanggal', width: 85, get: (r) => `${formatTgl(r.tgl)} ${r.jam || ''}` },
    { label: 'Nama Obat', width: CONTENT_W - 290, get: (r) => r.nama_brng },
    { label: 'Jumlah', width: 70, get: (r) => `${r.jml} ${r.kode_sat || ''}` },
    { label: 'Harga', width: 110, get: (r) => formatRupiah(r.total), align: 'right' },
  ], data.obat, 20);
  if (data.obat?.length) {
    const totalObat = data.obat.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    totalRow('Total Biaya Obat', formatRupiah(String(totalObat)));
  }

  const penunjangCols: Col[] = [
    { label: 'No', width: 25, get: (_r, i) => String(i + 1) },
    { label: 'Tanggal', width: 85, get: (r) => `${formatTgl(r.tgl)} ${r.jam || ''}` },
    { label: 'Pemeriksaan', width: CONTENT_W - 360, get: (r) => r.nm_perawatan },
    { label: 'Dokter', width: 140, get: (r) => r.nm_dokter },
    { label: 'Biaya', width: 110, get: (r) => formatRupiah(r.biaya), align: 'right' },
  ];
  seksiTabel('Pemeriksaan Laboratorium', penunjangCols, data.lab);
  seksiTabel('Pemeriksaan Radiologi', penunjangCols, data.radiologi);

  // ── TOTAL BIAYA (baris akhir isi dokumen) — tindakan + obat + lab +
  // radiologi, yaitu bagian yg memang menampilkan harga. Format angka mengikuti contoh user
  // ("107,930": pemisah ribuan koma, tanpa "Rp").
  const sumOf = (rows: Row[] | undefined, key: string) => (rows || []).reduce((t, r) => t + (Number(r[key]) || 0), 0);
  const totalBiaya = sumOf(data.tindakan, 'biaya') + sumOf(data.obat, 'total') + sumOf(data.lab, 'biaya') + sumOf(data.radiologi, 'biaya');
  if (data.tindakan?.length || data.obat?.length || data.lab?.length || data.radiologi?.length) {
    ensure(30);
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: PAGE_W - MARGIN, y: y + 12 }, thickness: 1, color: rgb(0, 0, 0) });
    const nominal = Math.round(totalBiaya).toLocaleString('en-US');
    page.drawText('TOTAL BIAYA', { x: MARGIN, y, size: 10, font: fontBold });
    page.drawText(nominal, { x: PAGE_W - MARGIN - fontBold.widthOfTextAtSize(nominal, 10), y, size: 10, font: fontBold });
    y -= 20;
  }

  if (data.peringatan?.length) {
    ensure(30);
    draw('Sebagian data tidak dapat dimuat:', MARGIN, 8, true, rgb(0.6, 0.1, 0.1));
    y -= 10;
    for (const w of data.peringatan) {
      for (const ln of wrap(w, CONTENT_W, 7.5)) { ensure(10); draw(ln, MARGIN, 7.5, false, rgb(0.6, 0.1, 0.1)); y -= 9; }
    }
  }

  // ── Blok tanda tangan + tag "#A#" (halaman terakhir, di bawah konten) ──
  const pengesah = sanitize(ranap && dpjpNama ? dpjpNama : p.nm_dokter || '-');
  const now = new Date();
  const kotaTgl = sanitize(`${settings.kota_rs ? `${settings.kota_rs}, ` : ''}${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`);
  // Tumpukan visual: kota/tgl (tagY+46) s/d nama (tagY-32) ≈ 120pt.
  ensure(125);
  // Blok di sisi KANAN: titik tengah kotak stample ≈ 80pt dari margin kanan
  // (boxCenterX = trunc(tagX - 15) + 20 ≈ tagX + 5).
  const tagX = Math.trunc(PAGE_W - MARGIN - 85);
  const tagY = y - 75;
  const centeredX = Math.trunc(tagX - SIGN_BOX_WIDTH / 2 + 5);
  const centeredY = Math.trunc(tagY - SIGN_BOX_HEIGHT / 2);
  const signBox: SignBox = {
    lowerLeftX: centeredX, lowerLeftY: centeredY,
    upperRightX: centeredX + SIGN_BOX_WIDTH, upperRightY: centeredY + SIGN_BOX_HEIGHT,
    page: String(pdf.getPageCount()),
  };
  const blockCenterY = (signBox.lowerLeftY + signBox.upperRightY) / 2;
  const boxCenterX = (signBox.lowerLeftX + signBox.upperRightX) / 2;
  const labelY = blockCenterY + SIGN_BOX_HEIGHT / 2 + 12;
  const nameY = blockCenterY - SIGN_BOX_HEIGHT / 2 - 12;
  const centerAt = (t: string, cx: number, yy: number, size = 9, bold = false) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(t, size);
    // Teks panjang (mis. nama dokter + gelar) jangan sampai lewat margin kanan.
    const x = Math.min(cx - w / 2, PAGE_W - MARGIN - w);
    page.drawText(t, { x, y: yy, size, font: f });
  };
  centerAt(kotaTgl, boxCenterX, labelY + 14);
  centerAt('Dokter Penanggung Jawab', boxCenterX, labelY);
  // Area SIGN_BOX TIDAK digambar apa pun — stample ditempel Peruri sendiri.
  page.drawText('#A#', { x: tagX, y: tagY, size: 7, font, color: rgb(0.6, 0.6, 0.6) });
  centerAt(pengesah, boxCenterX, nameY, 9, true);

  // Footer legal + nomor halaman (semua halaman).
  const footerText = 'Dokumen ini sah dan telah ditandatangani secara elektronik menggunakan sertifikat digital yang diterbitkan oleh Peruri';
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const sepY = MARGIN - 10;
    pg.drawLine({ start: { x: MARGIN, y: sepY }, end: { x: PAGE_W - MARGIN, y: sepY }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    const fw = font.widthOfTextAtSize(footerText, 7);
    pg.drawText(footerText, { x: (PAGE_W - fw) / 2, y: sepY - 10, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
    const t = `Halaman ${i + 1} dari ${pages.length}  -  ${sanitize(p.no_rawat)}`;
    pg.drawText(t, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(t, 7), y: sepY - 20, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
  });

  return { pdfBytes: await pdf.save(), data, signBox, namaPengesah: pengesah };
}
