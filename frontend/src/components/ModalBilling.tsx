import React from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import Swal from 'sweetalert2';

type ModalBillingProps = {
  noRawat: string;
  namaPasien?: string;
  // jaminan — cara bayar/penjamin (mis. "JKN", "Umum"), ditampilkan di
  // kolom kanan kop cetak PERSIS SIMRS-Khanza/webapps/billing/LaporanBilling2.php
  // (kolom "$carabayar"). Opsional — kalau tidak dikirim caller, kolom
  // itu kosong (bukan error).
  jaminan?: string;
  onClose: () => void;
};

type BillingRow = {
  no: string;
  nm_perawatan: string;
  pemisah: string;
  biaya: number;
  jumlah: number;
  tambahan: number;
  totalbiaya: number;
};

// Format angka ala Khanza (Valid.SetAngka) — pemisah ribuan koma, tanpa desimal.
const formatAngka = (n: number): string => Math.round(n || 0).toLocaleString('en-US');

// Section yg rinciannya SENGAJA disembunyikan (baik di Cetak/window.print
// maupun PDF upload Berkas Rawat) — cukup baris header + baris "Total ..."
// yg mengikutinya yg ditampilkan, item satu-satu (bisa puluhan baris)
// disembunyikan. Dipakai bareng oleh handleCetak & buildBillingPdf.
const RINGKAS_SAJA = [/obat/i, /resep pulang/i, /tambahan biaya/i];

// ModalBilling.tsx — dipakai tombol "Billing" di header GroupingInacbg.tsx.
// DUA jalur cetak, sengaja beda — user PRIORITASKAN desain cetak ikut
// CETAK_STANDAR.md persis drpd byte cetak=upload identik:
//  - handleCetak (tombol "Cetak") — pola STANDAR window.print() + HTML,
//    PERSIS CETAK_STANDAR.md/PreviewBilling.tsx (kop 15/70/15, font Tahoma
//    asli, dst). INI desain resmi yg dipakai user.
//  - buildBillingPdf + handleSimpanBerkasRawat (tombol upload) —
//    PENGECUALIAN dari CETAK_STANDAR.md §1 ("tidak ada library PDF di
//    project ini"): fitur auto-upload ke Berkas Rawat genuinely butuh byte
//    PDF asli (window.print() tidak bisa diambil sbg byte oleh JS), jadi
//    generate sendiri via pdf-lib. Kop-nya dibuat sedekat mungkin ke
//    CETAK_STANDAR.md tapi TIDAK bisa identik 100% (font Tahoma tidak
//    tersedia di pdf-lib StandardFonts, dipakai Helvetica) — hasilnya utk
//    arsip Berkas Rawat, BUKAN desain cetak resmi yg dilihat user.
export const ModalBilling: React.FC<ModalBillingProps> = ({ noRawat, namaPasien, jaminan, onClose }) => {
  const [rows, setRows] = React.useState<BillingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      if (!noRawat) {
        setError('No. Rawat tidak lengkap');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        // obat_mode=jual — sengaja SELALU harga jual (biaya_obat, yg
        // ditagihkan ke pasien), lepas dari Casemix > Pengaturan > Preview
        // Billing > Set Preview Obat (yg dipakai PreviewBilling.tsx).
        const res = await fetch(`/api/billing-preview/${noRawat}?obat_mode=jual`);
        if (!res.ok) throw new Error('Gagal memuat data billing');
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [noRawat]);

  const total = rows.reduce((sum, r) => sum + (r.totalbiaya || 0), 0);

  // Bangun PDF billing (dipakai "Preview Upload" & "Simpan ke Berkas
  // Rawat") — layout PERSIS SIMRS-Khanza/webapps/billing/LaporanBilling2.php
  // (kop logo+nama+CARA BAYAR, judul "BILLING", kolom pemisah, blok tanda
  // tangan Direktur/Kabid/Kasir + QR e-signature petugas, catatan NB) —
  // digambar pakai pdf-lib (bukan HTML window.print()) krn perlu byte
  // asli utk auto-upload. TIDAK memengaruhi tombol "Cetak" (handleCetak,
  // tetap desain CETAK_STANDAR.md/PreviewBilling.tsx spt sebelumnya).
  const buildBillingPdf = async (): Promise<Uint8Array> => {
    let settings: { nama_instansi?: string; alamat?: string; logo_url?: string; kota_rs?: string; kontak?: string; email_rs?: string } = {};
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) settings = await res.json();
    } catch { /* lanjut tanpa kop lengkap kalau gagal ambil settings */ }

    // Petugas yg lagi login (session 'ermapp_user', sama sumbernya dgn
    // coderNik di GroupingInacbg.tsx) — dipakai QR e-signature, PERSIS
    // konsep $petugas (GET param) di LaporanBilling2.php, cuma sumbernya
    // beda (session login, bukan parameter URL).
    let petugasNip = '';
    let petugasNama = '';
    try {
      const stored = sessionStorage.getItem('ermapp_user');
      if (stored) {
        const u = JSON.parse(stored);
        petugasNip = u?.nip || '';
        petugasNama = u?.full_name || '';
      }
    } catch { /* lanjut tanpa info petugas kalau gagal baca session */ }

    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fingerPetugas =
      `Dikeluarkan di ${settings.nama_instansi || ''}, Kabupaten/Kota ${settings.kota_rs || ''}\n` +
      `Ditandatangani secara elektronik oleh ${petugasNama || 'Admin Utama'}\n` +
      `ID ${petugasNip || 'ADMIN'}\n${tanggalCetak}`;
    let qrPetugasDataUrl = '';
    try { qrPetugasDataUrl = await QRCode.toDataURL(fingerPetugas, { width: 80, margin: 1 }); } catch { /* lanjut tanpa QR */ }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28; // A4 pt
    const pageHeight = 841.89;
    const margin = 40;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const text = (s: string, x: number, size = 9, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(s, { x, y, size, font: bold ? fontBold : font, color });
    };
    // rightText — rata kanan terhadap margin kanan halaman (dipakai baris
    // "Total <kategori> : <nilai>" per section, mis. "Total Kamar Inap").
    const rightText = (s: string, size = 9, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: pageWidth - margin - w, y, size, font: f, color: rgb(0, 0, 0) });
    };
    // rightAlignAt — rata kanan TERHADAP UJUNG KANAN SATU KOLOM (endX),
    // dipakai nilai numerik per baris item (Biaya/Jumlah/Tambahan/Total)
    // spy angka2 rapi rata kanan per kolom (mis. "1" dan "120,000" tidak
    // rata kiri berantakan), bukan rata kanan halaman penuh spt rightText.
    const rightAlignAt = (s: string, endX: number, size = 9, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: endX - w, y, size, font: f, color: rgb(0, 0, 0) });
    };
    // centerText — rata tengah TERHADAP SATU HALAMAN PENUH (dipakai judul
    // "BILLING" di bawah <hr/>, bukan bagian kop/ttd 3-kolom).
    const centerText = (s: string, size = 9, bold = false, color = rgb(0, 0, 0)) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: (pageWidth - w) / 2, y, size, font: f, color });
    };
    const newPageIfNeeded = () => {
      if (y < margin + 30) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    // Logo — embed byte asli (bukan <img> HTML), coba PNG dulu baru JPG
    // sesuai ekstensi/content-type, gagal embed jangan gagalkan seluruh
    // PDF (lanjut tanpa logo).
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
    let qrPetugasImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
    if (qrPetugasDataUrl) {
      try {
        const qrBytes = await fetch(qrPetugasDataUrl).then((r) => r.arrayBuffer());
        qrPetugasImg = await pdf.embedPng(qrBytes);
      } catch { /* lanjut tanpa QR kalau gagal embed */ }
    }

    // Kop 3-kolom PERSIS LaporanBilling2.php (20% logo / nama+alamat / 20%
    // cara bayar) — beda dari rasio 15/70/15 CETAK_STANDAR.md (kop Lab/
    // Radiologi tidak punya kolom "cara bayar").
    const contentWidth = pageWidth - margin * 2;
    const col1X = margin;
    const col2X = margin + contentWidth * 0.20;
    const col2Width = contentWidth * 0.60;
    const col3X = margin + contentWidth * 0.80;
    const col3Width = contentWidth * 0.20;
    const centerInCol = (s: string, colX: number, colWidth: number, size = 9, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: colX + (colWidth - w) / 2, y, size, font: f, color: rgb(0, 0, 0) });
    };

    const kopTop = y;
    const logoSize = 45; // PERSIS width='45' height='45' LaporanBilling2.php (bukan 65 spt Lab/Radiologi)
    if (logoImg) {
      page.drawImage(logoImg, { x: col1X, y: kopTop - logoSize + 8, width: logoSize, height: logoSize });
    }
    if (settings.nama_instansi) { centerInCol(settings.nama_instansi, col2X, col2Width, 14, false); y -= 11; }
    if (settings.alamat) { centerInCol(settings.alamat, col2X, col2Width, 9); y -= 11; }
    if (settings.kontak) { centerInCol(settings.kontak, col2X, col2Width, 9); y -= 11; }
    if (settings.email_rs) { centerInCol(`E-mail : ${settings.email_rs}`, col2X, col2Width, 9); y -= 0; }
    // Batas minimum tinggi kop (walau nama RS/alamat kosong) — logo
    // digambar mulai y: kopTop-logoSize+8 (baris di atas), jadi tepi
    // BAWAH logo sebenarnya ada di kopTop-logoSize+8, BUKAN kopTop-logoSize.
    // Sebelumnya batas ini lupa hitung offset +8 itu, jadi ketarik 8pt
    // lebih jauh dari tepi bawah logo yg sebenarnya (garis jadi kejauhan
    // dari teks email).
    y = Math.min(y, kopTop - logoSize + 8 - 4);
    y -= 1;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 12;
    centerText('BILLING', 10, false, rgb(0.2, 0.2, 0.2)); // color='333333' PERSIS PHP
    y -= 18;

    // col.pemisah — posisi titik dua, CUMA dipakai baris label:value (info
    // pasien/header kategori), bukan baris item (item tidak ada titik dua
    // sama sekali, sesuai referensi tampilan asli — nama item lalu jarak
    // kosong lalu harga/jml/total dikelompokkan di sisi kanan).
    // col.biaya/jumlah/total: dikelompokkan ke kanan (bukan nempel nama)
    // — kolom "tambahan" DIHAPUS (jarang/tidak pernah terisi di data
    // nyata), ruangnya dipakai memperlebar 5 kolom sisanya.
    const col = { uraian: margin, pemisah: margin + 100, biaya: margin + 280, jumlah: margin + 400, total: margin + 440 };
    const itemIndent = 100; // nama item menjorok ke kolom ke-2, lihat pemakaian di bawah
    // colEnd — batas kanan tiap kolom angka (dipakai rightAlignAt), diambil
    // dari titik mulai kolom berikutnya dikurangi sedikit jarak; kolom
    // "total" (kolom terakhir) batasnya margin kanan halaman.
    const colEnd = { biaya: col.jumlah - 10, jumlah: col.total - 10, total: pageWidth - margin };

    let insideRingkas = false;
    rows.forEach((row) => {
      const noTrim = (row.no || '').trim();
      const namaTrim = (row.nm_perawatan || '').trim();

      if (namaTrim === ':' && RINGKAS_SAJA.some((re) => re.test(noTrim))) {
        insideRingkas = true;
      } else if (insideRingkas && namaTrim.startsWith('Total')) {
        insideRingkas = false;
      } else if (insideRingkas) {
        return;
      }

      newPageIfNeeded();
      const isTextOnlyRow = noTrim === '' && row.biaya === 0 && row.jumlah === 0 && row.tambahan === 0 && row.totalbiaya === 0;
      if (isTextOnlyRow) {
        if (namaTrim.startsWith('Total')) {
          // Baris subtotal per kategori (mis. "Total Kamar Inap : 325,000")
          // — dipecah jadi label / titik dua / nilai, masing2 digambar di
          // posisi kolom yg SAMA dgn baris lain (col.uraian/col.pemisah/
          // colEnd.total), supaya titik duanya sejajar vertikal dgn baris
          // item & label:value lain, bukan ikut geser krn seluruh baris
          // dirata-kanankan sbg satu string utuh.
          const idxColon = namaTrim.indexOf(' : ');
          if (idxColon === -1) {
            rightText(namaTrim, 8);
          } else {
            // Label "Total <kategori> :" SENGAJA diindentasi (itemIndent),
            // bukan rata kiri sejajar header kategori — biar keliatan
            // menjorok ke dalam, sama spt nama item. Titik dua digabung
            // jadi SATU string dgn labelnya (bukan digambar terpisah di
            // col.pemisah) — krn col.pemisah kebetulan == col.uraian+
            // itemIndent, kalau dipisah keduanya numpuk di titik yg sama.
            text(namaTrim.slice(0, idxColon) + ' :', col.uraian + itemIndent, 8);
            rightAlignAt(namaTrim.slice(idxColon + 3), colEnd.total, 8);
          }
        } else {
          // Teks polos anak baris label (mis. "dr. Hilyatul Nadia" di
          // bawah "Dokter :") — SAMA indentasinya dgn nama item (itemIndent),
          // bukan rata kiri sejajar label.
          text(namaTrim, col.uraian + itemIndent, 8);
        }
      } else if (noTrim !== '') {
        // Baris label:value — info pasien (Bangsal/Kamar, No.R.M., dst,
        // dari addInfo di computeBillingPreview) ATAU header kategori
        // (mis. "1. Obat & BHP :") — item ASLI (addItem) SELALU No="",
        // jadi noTrim!=='' cukup jadi penanda "ini baris label", tidak
        // perlu heuristik posisi (index<6) yg gampang salah kalau jumlah
        // baris info berubah. namaTrim SUDAH diawali ": " (dari addInfo di
        // biaya_handler.go), digambar mulai col.pemisah spy titik-duanya
        // sejajar vertikal antar baris label:value (bukan dgn item, item
        // tidak ada titik dua sama sekali — lihat cabang else di bawah).
        text(noTrim, col.uraian, 8);
        text(namaTrim, col.pemisah, 8);
      } else {
        // Baris item — TANPA titik dua (beda dari baris label:value di
        // atas), nama lalu jarak kosong lalu harga/jml/total dikelompokkan
        // di sisi kanan. Nama item SENGAJA diindentasi (col.uraian +
        // itemIndent) — bukan rata kiri sejajar label/header kategori —
        // spy kelihatan "menjorok" sbg anak baris di bawah kategorinya
        // (mis. "1. Akomodasi" di kiri, "ADM & BHP Ruangan" indented di
        // bawahnya), bukan rata kiri sama persis.
        text(namaTrim.slice(0, 38), col.uraian + itemIndent, 8);
        if (row.biaya) rightAlignAt(formatAngka(row.biaya), colEnd.biaya, 8);
        if (row.jumlah) rightAlignAt(String(row.jumlah), colEnd.jumlah, 8);
        if (row.totalbiaya) rightAlignAt(formatAngka(row.totalbiaya), colEnd.total, 8);
      }
      y -= 9;
    });

    newPageIfNeeded();
    // Baris terakhir (mis. "Total Tambahan Biaya") sudah dapat jarak 12pt
    // dari trailing y-=12 di loop item di atas — di sini SENGAJA y
    // dinaikkan lagi (+3) spy garis tidak numpuk 12+gap, cukup ~9pt dari
    // baris terakhir sebelum garis.
    y += 3;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    y -= 10;
    text('TOTAL BIAYA', col.uraian, 8, true);
    rightAlignAt(formatAngka(total), colEnd.total, 8, true);

    // Blok tanda tangan — PERSIS LaporanBilling2.php: Direktur & Kabid
    // Umum/Keuangan tanda tangan manual (placeholder titik-titik, kolom
    // kiri 40%), Kasir (petugas yg login) tanda tangan elektronik via QR
    // (kolom kanan 40%, gap 20% di tengah).
    newPageIfNeeded();
    y -= 28;
    const sigCol1X = margin;
    const sigCol1Width = contentWidth * 0.40;
    const sigCol3X = margin + contentWidth * 0.60;
    const sigCol3Width = contentWidth * 0.40;
    const centerInSigCol = (s: string, colX: number, colWidth: number, size = 9) => {
      const w = font.widthOfTextAtSize(s, size);
      page.drawText(s, { x: colX + (colWidth - w) / 2, y, size, font, color: rgb(0, 0, 0) });
    };
    centerInSigCol('Kasir', sigCol3X, sigCol3Width, 9);
    const kasirLabelY = y;
    // QR 40×40 (sebelumnya 50×50) — x-centering & jarak vertikal ikut
    // disesuaikan ke ukuran baru ini (qrSize), bukan lagi angka 50
    // hardcode, spy "Kasir"/QR/nama kasir tetap center & berjarak wajar.
    const qrSize = 40;
    const qrTop = kasirLabelY - 8;
    const qrBottom = qrTop - qrSize;
    if (qrPetugasImg) {
      page.drawImage(qrPetugasImg, { x: sigCol3X + (sigCol3Width - qrSize) / 2, y: qrBottom, width: qrSize, height: qrSize });
    }
    y = qrBottom - 12;
    centerInSigCol(`( ${petugasNama || 'Admin Utama'} )`, sigCol3X, sigCol3Width, 9);
    y -= 24;

    // Catatan NB — PERSIS teks LaporanBilling2.php.
    newPageIfNeeded();
    text('NB : Mohon maaf apabila ada tagihan yang belum tertagihkan dalam perincian ini akan ditagihkan kemudian,', margin, 7);
    y -= 10;
    text('dan apabila berlebih akan dikembalikan.', margin, 7);

    return pdf.save();
  };

  // Preview Upload — generate PDF (buildBillingPdf, pdf-lib) yg SAMA
  // dipakai handleSimpanBerkasRawat, tapi cuma dibuka di tab baru (tidak
  // ikut upload) — biar staf bisa lihat dulu persis seperti apa hasil
  // PDF yg bakal ter-upload ke Berkas Rawat, sebelum diputuskan desainnya
  // sudah cukup mirip CETAK_STANDAR.md atau perlu disamakan lebih lanjut.
  const [previewing, setPreviewing] = React.useState(false);
  const handlePreviewUpload = async () => {
    if (rows.length === 0) return;
    setPreviewing(true);
    try {
      const pdfBytes = await buildBillingPdf();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan' });
    } finally {
      setPreviewing(false);
    }
  };

  // Simpan ke Berkas Rawat — generate PDF (buildBillingPdf, pdf-lib) lalu
  // upload sbg "Billing_<no_rawat>.pdf" ke folder fisik yg sama dgn TTE,
  // lewat endpoint generik yg sama dipakai Cetak Klaim (jenis "Gruper_")
  // di GroupingInacbg.tsx. Desainnya cuma MENDEKATI CETAK_STANDAR.md
  // (lihat catatan di atas komponen) — utk arsip Berkas Rawat, bukan
  // desain cetak resmi yg dipakai user.
  const handleSimpanBerkasRawat = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const pdfBytes = await buildBillingPdf();
      const form = new FormData();
      form.append('no_rawat', noRawat);
      form.append('jenis', 'Billing_');
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `Billing_${noRawat.replace(/\//g, '_')}.pdf`);
      const res = await fetch('/api/casemix/berkas-klaim-tte/save', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PDF billing');
      await Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'PDF Billing tersimpan ke Berkas Rawat', timer: 1800, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  // Cetak — PERSIS pola standar CETAK_STANDAR.md / PreviewBilling.tsx
  // (window.open + document.write + printWindow.print()), font Tahoma asli
  // — INI desain yg dipakai user, beda dari buildBillingPdf (pdf-lib) yg
  // cuma utk arsip Berkas Rawat. Window dibuka SEBELUM await fetch
  // settings (bukan sesudah) supaya tidak kena popup blocker.
  const handleCetak = async () => {
    if (rows.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) settings = await res.json();
    } catch { /* lanjut cetak tanpa kop lengkap */ }

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean).join('<br/>');

    // RINGKAS_SAJA (module-level, di atas) — dideteksi dgn flag berjalan:
    // mulai skip item sesudah header "X. <Label> :" cocok salah satu
    // pattern, berhenti skip pas ketemu baris "Total ..." pertama
    // sesudahnya (baris itu sendiri TETAP ditampilkan).
    let insideRingkas = false;
    const rowsHtml = rows.map((row, index) => {
      const noTrim = (row.no || '').trim();
      const namaTrim = (row.nm_perawatan || '').trim();

      if (namaTrim === ':' && RINGKAS_SAJA.some((re) => re.test(noTrim))) {
        insideRingkas = true;
      } else if (insideRingkas && namaTrim.startsWith('Total')) {
        insideRingkas = false;
      } else if (insideRingkas) {
        return '';
      }

      if (index < 6) {
        return `<tr><td width="20%">${noTrim}</td><td width="40%" colspan="5">${namaTrim}</td></tr>`;
      }

      if (noTrim === '' && row.biaya === 0) {
        const isTotal = namaTrim.startsWith('Total');
        return `<tr><td width="20%">${noTrim}</td><td width="40%" colspan="5" style="text-align:${isTotal ? 'right' : 'left'}">${namaTrim}</td></tr>`;
      }

      // row.no SELALU kosong utk item asli (addItem di biaya_handler.go
      // tidak pernah mengisi No) — kalau tetap dipisah jadi <td width=20%>
      // kosong + <td> nama, nama-nya keliatan "nyantol" di bawah titik dua
      // baris header di atasnya (krn sama-sama mulai di kolom ke-2, 20%
      // dari kiri). Gabung jadi satu td (colspan 2) spy nama mulai rata
      // kiri, sejajar dgn label header ("2. Konsultasi" dst) — BUKAN
      // sejajar dgn titik duanya.
      return `<tr>
        <td width="68%" colspan="2">${row.nm_perawatan}</td>
        <td width="9%" style="text-align:right">${row.biaya === 0 ? '' : formatAngka(row.biaya)}</td>
        <td width="2%" style="text-align:right">${row.jumlah === 0 ? '' : formatAngka(row.jumlah)}</td>
        <td width="9%" style="text-align:right">${row.tambahan === 0 ? '' : formatAngka(row.tambahan)}</td>
        <td width="10%" style="text-align:right">${row.totalbiaya === 0 ? '' : formatAngka(row.totalbiaya)}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Billing - ${noRawat}</title>
          <style>
            @page { size: 210mm 297mm; margin-top: 14px; }
            body { font-family: Tahoma, Arial, sans-serif; font-size: 11pt; padding: 0 16px 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.rincian { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 10px; }
            table.rincian td { padding: 1px 4px; vertical-align: top; border-bottom: 1px solid #e0e0e0; }
            table.rincian tr.total td { font-weight: 700; background: #f3f4f6; border-top: 2px solid #333; }
            .rs-nama { font-size: 14pt; }
            .rs-alamat { font-size: 9pt; }
            .judul { font-size: 10pt; }
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
          <center><div class="judul">Billing</div></center>

          <table class="rincian">
            <tbody>
              ${rowsHtml}
              <tr class="total">
                <td width="68%" colspan="2">TOTAL BIAYA</td>
                <td width="9%"></td>
                <td width="2%"></td>
                <td width="9%"></td>
                <td width="10%" style="text-align:right">${formatAngka(total)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative',
          maxWidth: 800, width: '85%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Billing</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button" onClick={handleCetak} disabled={loading || !!error || rows.length === 0}
              title="Cetak"
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 6, border: '1px solid #d1d5db',
                background: '#ffffff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !!error || rows.length === 0 ? 'default' : 'pointer',
                opacity: loading || !!error || rows.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7"></path>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
            <button
              type="button" onClick={handlePreviewUpload} disabled={previewing || loading || !!error || rows.length === 0}
              title={previewing ? 'Menyiapkan...' : 'Preview Upload'}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 6, border: '1px solid #d1d5db',
                background: '#ffffff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: previewing || loading || !!error || rows.length === 0 ? 'default' : 'pointer',
                opacity: previewing || loading || !!error || rows.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button
              type="button" onClick={handleSimpanBerkasRawat} disabled={saving || loading || !!error || rows.length === 0}
              title={saving ? 'Menyimpan...' : 'Simpan ke Berkas Rawat'}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 6, border: '1px solid #d1d5db',
                background: '#ffffff', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: saving || loading || !!error || rows.length === 0 ? 'default' : 'pointer',
                opacity: saving || loading || !!error || rows.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >&times;</button>
          </div>
        </div>

        {/* White Card Content */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 12, overflowY: 'auto', flex: 1, minHeight: 0, fontFamily: 'Tahoma, Arial, sans-serif' }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 12 }}>Memuat...</div>}
          {error && <div style={{ color: '#dc2626', padding: 12, fontSize: 12 }}>{error}</div>}

          {!loading && !error && rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
              Tidak ada data billing untuk nomor rawat: {noRawat}
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map((row, index) => {
                  const noTrim = (row.no || '').trim();
                  const namaTrim = (row.nm_perawatan || '').trim();

                  if (index < 6) {
                    return (
                      <tr key={index}>
                        <td style={tdStyle} width="20%">{noTrim}</td>
                        <td style={tdStyle} width="40%" colSpan={5}>{namaTrim}</td>
                      </tr>
                    );
                  }

                  if (noTrim === '' && row.biaya === 0) {
                    const isTotal = namaTrim.startsWith('Total');
                    return (
                      <tr key={index}>
                        <td style={tdStyle} width="20%">{noTrim}</td>
                        <td style={{ ...tdStyle, textAlign: isTotal ? 'right' : 'left' }} colSpan={5}>{namaTrim}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={index}>
                      <td style={tdStyle} width="20%">{row.no}</td>
                      <td style={tdStyle} width="48%">{row.nm_perawatan}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="9%">{row.biaya === 0 ? '' : formatAngka(row.biaya)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="2%">{row.jumlah === 0 ? '' : formatAngka(row.jumlah)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="9%">{row.tambahan === 0 ? '' : formatAngka(row.tambahan)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} width="10%">{row.totalbiaya === 0 ? '' : formatAngka(row.totalbiaya)}</td>
                    </tr>
                  );
                })}
                <tr style={totalRowStyle}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }} width="20%">TOTAL BIAYA</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>:</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, textAlign: 'right' }} colSpan={4}>{formatAngka(total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const tdStyle: React.CSSProperties = {
  padding: 4,
  borderBottom: '1px solid #e0e0e0',
  fontSize: 12,
};

const totalRowStyle: React.CSSProperties = {
  background: '#f3f4f6',
  borderTop: '2px solid #333',
};
