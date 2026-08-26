import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore — worker Vite di-resolve sbg URL asset via ?url, tidak ada type declaration bawaan.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees } from 'pdf-lib';
import Swal from 'sweetalert2';
import { ModalBilling } from '../components/ModalBilling';
import { SepPrintView } from '../components/SepPrintView';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// GroupingInacbg.tsx — dibuka dari Casemix > List Klaim (klik No Rawat).
// BARU header (Data Pasien/Registrasi/Kunjungan, lihat
// backend/grouping_inacbg_handler.go) — bagian proses grouping (pilih
// diagnosa/prosedur, kirim ke aplikasi INA-CBG) menyusul, belum dibangun.
// Tab "Berkas Klaim" pakai BerkasKlaimGabungView (di bawah) — tampilan
// grid halaman spt aplikasi "gabung PDF" (screenshot referensi user):
// tiap PDF dipecah per-HALAMAN (bukan per-dokumen) jadi thumbnail bisa
// di-drag urut ulang/diputar/dihapus, lalu digabung jadi satu PDF baru
// via tombol Simpan PDF. Sumbernya GABUNGAN dua sumber yg sudah ada
// (sama2 disimpan di folder fisik berkasrawat/pages/upload, dikonfirmasi
// dari kode caller Java MnTampilkanBerkasActionPerformed):
//  1. Dokumen resmi hasil TTE (SEP_/Gruper_/Resume_/dst) — dicek by nama
//     file (getBerkasKlaimTte), TIDAK tercatat di tabel manapun.
//  2. Berkas upload manual (KTP, foto, dll) — berkas_digital_perawatan
//     (endpoint /api/berkas-rawat/list yg sudah ada, dipakai jg UploadTab.tsx).
// TIDAK ada tabel baru — Simpan PDF menyimpan hasil gabungan lewat
// endpoint upload yg SUDAH ADA (/api/berkas-rawat/upload), pilih salah
// satu jenis berkas dari master_berkas_digital yg sudah ada.

type BerkasRawatItem = {
  no_rawat: string; kode: string; nama_berkas: string;
  lokasi_file: string; nama_file: string; ekstensi: string;
};
type BerkasTteItem = { label: string; url: string; tag: string };
type MasterBerkas = { kode: string; nama: string };

type PdfPageItem = {
  id: string;
  sourceKey: string; // dipakai cari bytes asli pas digabung (Map sourceBytes)
  sourceTag: string; // label pendek per FILE sumber, dipakai deretan pill di atas card
  pageIndex: number; // 0-based di dalam source; 0 utk gambar (1 "halaman")
  isImage: boolean;
  label: string;
  thumbnail: string; // data URL kecil utk preview grid
  rotation: number; // 0/90/180/270 — visual + diterapkan bneran pas Simpan PDF
};

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
const berkasRawatUrl = (lokasiFile: string) => encodeURI('/berkasrawat/' + lokasiFile);

// renderPagesFromUrl — muat 1 file (PDF/gambar) dari URL, render tiap
// halaman jadi thumbnail PNG kecil (scale 0.4, cukup utk grid), simpan
// byte aslinya ke sourceBytes (dipakai lagi pas gabung PDF final).
async function renderPagesFromUrl(
  url: string, label: string, tag: string, isImage: boolean, ekstensi: string,
  sourceBytes: Map<string, Uint8Array>,
): Promise<PdfPageItem[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal memuat ' + label);
  const buf = new Uint8Array(await res.arrayBuffer());
  sourceBytes.set(url, buf);

  if (isImage) {
    const b64 = btoa(buf.reduce((s, b) => s + String.fromCharCode(b), ''));
    return [{
      id: `${url}-0`, sourceKey: url, sourceTag: tag, pageIndex: 0, isImage: true, label,
      thumbnail: `data:image/${ekstensi === 'jpg' ? 'jpeg' : ekstensi};base64,${b64}`, rotation: 0,
    }];
  }
  if (ekstensi !== 'pdf') return [];

  const pdf = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
  const pages: PdfPageItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Scale 1.1 (bukan cuma buat thumbnail grid kecil) — dipakai juga di
    // PdfPreviewViewer full-screen, jadi harus cukup tajam saat diperbesar.
    const viewport = page.getViewport({ scale: 1.1 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push({
      id: `${url}-${i}`, sourceKey: url, sourceTag: tag, pageIndex: i - 1, isImage: false,
      label: pdf.numPages > 1 ? `${label} (hal. ${i}/${pdf.numPages})` : label,
      thumbnail: canvas.toDataURL('image/png'), rotation: 0,
    });
  }
  return pages;
}

const BerkasKlaimGabungView: React.FC<{ noRawat: string }> = ({ noRawat }) => {
  const [pages, setPages] = React.useState<PdfPageItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(150);
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const sourceBytesRef = React.useRef<Map<string, Uint8Array>>(new Map());
  const dragFromRef = React.useRef<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const dragCounterRef = React.useRef(0);

  const loadAll = React.useCallback(() => {
    setPages(null);
    setError(null);
    sourceBytesRef.current = new Map();
    Promise.all([
      fetch(`/api/casemix/berkas-klaim-tte/${encodeURIComponent(noRawat)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/berkas-rawat/list/${encodeURIComponent(noRawat)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(async ([tte, upload]: [BerkasTteItem[], BerkasRawatItem[]]) => {
        const sources = [
          ...((Array.isArray(tte) ? tte : []).map((t) => ({ url: t.url, label: t.label, tag: t.tag, isImage: false, ekstensi: 'pdf' }))),
          ...((Array.isArray(upload) ? upload : []).map((u) => ({
            url: berkasRawatUrl(u.lokasi_file), label: u.nama_berkas || u.nama_file, tag: u.nama_berkas || u.nama_file,
            isImage: IMAGE_EXT.includes(u.ekstensi), ekstensi: u.ekstensi,
          }))),
        ];
        const allPages: PdfPageItem[] = [];
        for (const s of sources) {
          try {
            allPages.push(...await renderPagesFromUrl(s.url, s.label, s.tag, s.isImage, s.ekstensi, sourceBytesRef.current));
          } catch {
            // Satu file gagal dirender (corrupt/format tak didukung) — lewati,
            // jangan gagalkan seluruh grid.
          }
        }
        setPages(allPages);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'));
  }, [noRawat]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  // processFiles — dipakai baik dari input file (klik "+ Tambah Halaman")
  // maupun drag langsung dari folder OS (onDrop di kartu Halaman PDF),
  // supaya keduanya lewat jalur render+tambah halaman yg sama persis.
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const added: PdfPageItem[] = [];
    for (const file of files) {
      const localUrl = `local-${file.name}-${Date.now()}-${Math.random()}`;
      const buf = new Uint8Array(await file.arrayBuffer());
      sourceBytesRef.current.set(localUrl, buf);
      const isImage = IMAGE_EXT.includes((file.name.split('.').pop() || '').toLowerCase());
      const ekstensi = isImage ? (file.name.split('.').pop() || '').toLowerCase() : 'pdf';
      if (!isImage && ekstensi !== 'pdf') continue;
      try {
        const blobUrl = URL.createObjectURL(new Blob([buf.slice() as BlobPart], { type: file.type }));
        const rendered = await renderPagesFromUrl(blobUrl, file.name, file.name, isImage, ekstensi, new Map());
        added.push(...rendered.map((p) => ({ ...p, sourceKey: localUrl })));
        URL.revokeObjectURL(blobUrl);
      } catch {
        Swal.fire({ icon: 'warning', title: 'Gagal', text: `Tidak bisa membaca berkas ${file.name}` });
      }
    }
    setPages((prev) => [...(prev || []), ...added]);
  };

  const handleTambahHalaman = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await processFiles(files);
  };

  // Drag file langsung dari folder OS ke kartu Halaman PDF — pakai counter
  // (bukan boolean langsung) krn dragenter/dragleave ikut ke-trigger tiap
  // masuk/keluar elemen ANAK di dalam drop zone, bukan cuma sekali di batas
  // terluar; counter balik ke 0 baru berarti benar-benar keluar drop zone.
  const handleExternalDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  };
  const handleExternalDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };
  const handleExternalDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };
  const handleExternalDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    await processFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleRotate = (id: string) => {
    setPages((prev) => (prev || []).map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  };
  const handleDelete = (id: string) => {
    setPages((prev) => (prev || []).filter((p) => p.id !== id));
  };

  const handleDragStart = (i: number) => { dragFromRef.current = i; };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (i: number) => {
    const from = dragFromRef.current;
    dragFromRef.current = null;
    if (from === null || from === i) return;
    setPages((prev) => {
      const list = [...(prev || [])];
      const [moved] = list.splice(from, 1);
      list.splice(i, 0, moved);
      return list;
    });
  };

  const handleSimpanPdf = async () => {
    if (!pages || pages.length === 0) return;
    const master: MasterBerkas[] = await fetch('/api/berkas-rawat/master').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const { value: kode } = await Swal.fire({
      title: 'Simpan sebagai jenis berkas apa?',
      input: 'select',
      inputOptions: Object.fromEntries(master.map((m) => [m.kode, m.nama])),
      showCancelButton: true,
      confirmButtonText: 'Simpan PDF',
      cancelButtonText: 'Batal',
    });
    if (!kode) return;

    setSaving(true);
    try {
      const merged = await PDFDocument.create();
      for (const p of pages) {
        const bytes = sourceBytesRef.current.get(p.sourceKey);
        if (!bytes) continue;
        if (p.isImage) {
          const ext = p.thumbnail.startsWith('data:image/png') ? 'png' : 'jpg';
          const img = ext === 'png' ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
          const page = merged.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
          if (p.rotation) page.setRotation(degrees(p.rotation));
        } else {
          const src = await PDFDocument.load(bytes);
          const [copied] = await merged.copyPages(src, [p.pageIndex]);
          if (p.rotation) copied.setRotation(degrees((copied.getRotation().angle + p.rotation) % 360));
          merged.addPage(copied);
        }
      }
      const mergedBytes = await merged.save();
      const form = new FormData();
      form.append('no_rawat', noRawat);
      form.append('kode', kode);
      form.append('file', new Blob([mergedBytes as BlobPart], { type: 'application/pdf' }), `BerkasKlaim_${noRawat.replace(/\//g, '_')}.pdf`);
      const res = await fetch('/api/berkas-rawat/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PDF gabungan');
      await Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'PDF gabungan berhasil disimpan', timer: 1800, showConfirmButton: false });
      loadAll();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const centerStyle: React.CSSProperties = { padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 };

  if (error) return <div style={{ ...centerStyle, color: '#dc2626' }}>{error}</div>;
  if (pages === null) return <div style={centerStyle}>Memuat & merender halaman PDF...</div>;

  // Deretan pill jenis berkas yg tampil (bukan per halaman, per FILE
  // sumber) — urutan kemunculan pertama, tanpa duplikat, radius 0 (selaras
  // tombol lain di tab ini). Klik pill loncat ke halaman pertama file itu.
  const distinctTags: string[] = [];
  const firstPageIdByTag: Record<string, string> = {};
  pages.forEach((p) => {
    if (!p.sourceTag) return;
    if (!(p.sourceTag in firstPageIdByTag)) {
      distinctTags.push(p.sourceTag);
      firstPageIdByTag[p.sourceTag] = p.id;
    }
  });
  const scrollToTag = (tag: string) => {
    document.getElementById(`page-${firstPageIdByTag[tag]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div style={{ padding: 20 }}>
      {distinctTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {distinctTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => scrollToTag(tag)}
              style={{
                padding: '5px 12px', borderRadius: 0, border: '1px solid #d1d5db', background: '#ffffff',
                color: '#374151', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      <div
        onDragEnter={handleExternalDragEnter}
        onDragLeave={handleExternalDragLeave}
        onDragOver={handleExternalDragOver}
        onDrop={handleExternalDrop}
        style={{
          background: '#ffffff', borderRadius: 0, overflow: 'hidden',
          border: isDraggingFile ? '2px dashed #16a34a' : '1px solid #e5e7eb',
          outline: isDraggingFile ? '2px solid #bbf7d0' : 'none', outlineOffset: -2,
        }}
      >
        {isDraggingFile && (
          <div style={{ padding: '10px 20px', background: '#ecfdf5', color: '#166534', fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>
            Lepas di sini untuk menambah halaman
          </div>
        )}
        {/* Header hijau — persis referensi: judul+badge jumlah halaman, Tambah Halaman, Simpan PDF */}
        <div style={{ background: '#16a34a', color: '#ffffff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <path d="M14 2v6h6"></path>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Halaman PDF</span>
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{pages.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple style={{ display: 'none' }} onChange={handleTambahHalaman} />
            <button
              type="button" onClick={() => fileInputRef.current?.click()}
              style={{ padding: '7px 14px', borderRadius: 0, border: 'none', background: '#ffffff', color: '#166534', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              + Tambah Halaman
            </button>
            <button
              type="button" onClick={handleSimpanPdf} disabled={saving || pages.length === 0}
              style={{ padding: '7px 14px', borderRadius: 0, border: 'none', background: saving ? '#d1d5db' : '#f59e0b', color: '#ffffff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Menyimpan...' : 'Simpan PDF'}
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            ⓘ Drag halaman untuk mengubah urutan. Gunakan tombol aksi untuk memutar atau menghapus halaman.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setZoom((z) => Math.max(90, z - 20))} style={{ padding: '6px 12px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}>− Perkecil</button>
            <button type="button" onClick={() => setZoom((z) => Math.min(260, z + 20))} style={{ padding: '6px 12px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}>+ Perbesar</button>
          </div>
        </div>

        {pages.length === 0 ? (
          <div style={centerStyle}>Belum ada berkas untuk No. Rawat: {noRawat}</div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {pages.map((p, i) => (
              <div
                key={p.id}
                id={`page-${p.id}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(i)}
                title={p.label}
                style={{
                  width: zoom, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa',
                  padding: 8, cursor: 'grab', position: 'relative', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{
                  position: 'absolute', top: 12, left: 12, width: 22, height: 22, borderRadius: '50%',
                  background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
                }}>
                  {i + 1}
                </div>
                <div style={{ display: 'flex', gap: 4, position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                  <button
                    type="button" onClick={() => setPreviewIndex(i)} title="Lihat penuh"
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7"></circle>
                      <path d="m21 21-4.3-4.3"></path>
                    </svg>
                  </button>
                  <button
                    type="button" onClick={() => handleRotate(p.id)} title="Putar"
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                      <path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                    </svg>
                  </button>
                  <button
                    type="button" onClick={() => handleDelete(p.id)} title="Hapus"
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                    </svg>
                  </button>
                </div>
                <div style={{ overflow: 'hidden', borderRadius: 6, background: '#ffffff', border: '1px solid #e5e7eb', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={p.thumbnail} alt={p.label} draggable={false}
                    style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${p.rotation}deg)`, transition: 'transform 0.15s ease' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewIndex !== null && (
        <PdfPreviewViewer pages={pages} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  );
};

// PdfPreviewViewer — full-screen, persis referensi desain user: BG gelap,
// sidebar kiri thumbnail semua halaman (halaman aktif diberi border biru),
// area kanan nampilin halaman aktif ukuran besar di tengah.
const PdfPreviewViewer: React.FC<{ pages: PdfPageItem[]; initialIndex: number; onClose: () => void }> = ({ pages, initialIndex, onClose }) => {
  const [active, setActive] = React.useState(initialIndex);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setActive((a) => Math.min(pages.length - 1, a + 1));
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setActive((a) => Math.max(0, a - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length, onClose]);

  const activePage = pages[active];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#292929', display: 'flex' }}>
      {/* Sidebar thumbnail */}
      <div style={{ width: 160, background: '#1f1f1f', overflowY: 'auto', padding: '16px 0', flexShrink: 0 }}>
        {pages.map((p, i) => {
          const isActive = i === active;
          return (
            <div key={p.id} onClick={() => setActive(i)} style={{ padding: '0 20px 24px', cursor: 'pointer' }}>
              <div style={{
                border: isActive ? '3px solid #60a5fa' : '3px solid transparent', borderRadius: 2,
                overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '3/4',
              }}>
                <img src={p.thumbnail} alt={p.label} style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${p.rotation}deg)` }} />
              </div>
              <div style={{ textAlign: 'center', color: '#ffffff', fontSize: 12, marginTop: 8 }}>{i + 1}</div>
            </div>
          );
        })}
      </div>

      {/* Halaman aktif — besar, di tengah */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {activePage && (
          <img
            src={activePage.thumbnail} alt={activePage.label}
            style={{ maxWidth: '100%', maxHeight: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', transform: `rotate(${activePage.rotation}deg)` }}
          />
        )}
      </div>

      <button
        type="button" onClick={onClose} title="Tutup"
        style={{
          position: 'fixed', top: 16, right: 20, width: 36, height: 36, borderRadius: '50%',
          border: 'none', background: 'rgba(255,255,255,0.12)', color: '#ffffff', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        &times;
      </button>
    </div>
  );
};

type GroupingHeader = {
  no_rawat: string; no_rm: string; nm_pasien: string; umur: string; jk: string; alamat: string;
  tgl_registrasi: string; tanggal_pulang: string; poliklinik: string; dpjp: string; status: string; jaminan: string;
  no_sep: string; no_kunjungan: string; no_kartu: string; tipe: string; cbg: string; petugas: string;
  dx_utama: string; pros_utama: string; cob: string;
  naik_kelas: string; ada_rawat_intensif: string; kelas_hak: string; cara_masuk: string; los: string;
  berat_lahir: string; adl_score: string; cara_pulang: string; jenis_tarif: string; pasien_tb: string;
};

const labelStyle: React.CSSProperties = { width: 100, flexShrink: 0, fontSize: 12, color: '#6b7280' };
const valueStyle: React.CSSProperties = { fontSize: 12, color: '#111827', fontWeight: 500 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 4, padding: '1px 0', lineHeight: 1.4 };

const HeaderField: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span style={{ ...valueStyle, color: accent ? '#ea580c' : valueStyle.color, fontWeight: accent ? 700 : valueStyle.fontWeight }}>
      : {value || '-'}
    </span>
  </div>
);

// Badge ikon warna per kolom — biar tiap seksi (Pasien/Registrasi/Kunjungan)
// gampang dibedakan sekilas, bukan cuma judul teks polos.
const ColumnTitle: React.FC<{ icon: React.ReactNode; iconBg: string; iconColor: string; children: React.ReactNode }> = ({ icon, iconBg, iconColor, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <div style={{ width: 24, height: 24, borderRadius: 7, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ fontSize: 13, color: '#111827' }}>{children}</div>
  </div>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);
const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>
  </svg>
);
const IconClipboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1"></rect>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <path d="M9 12h6"></path><path d="M9 16h6"></path>
  </svg>
);
const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>
);

// GroupingFormView — workflow iDRG → INACBG → Klaim sesuai 25 Kriteria
// resmi (docs/eklaim/DO 25 Kriteria...xlsx): grouping iDRG WAJIB duluan,
// baru INACBG, baru Final Klaim, baru Kirim/Cetak muncul. Tersambung ke
// 22 endpoint E-Klaim yg sudah dibangun (backend/eklaim_handler.go).
//
// PENTING: belum pernah diuji ke server E-Klaim NYATA (tidak ada akses
// dari sini) — alur/nama field ditranskripsi presisi dari manual resmi,
// tapi perilaku sebenarnya (pesan error, bentuk respons edge-case) baru
// bisa dipastikan pas dites di server RS. State (stage) TIDAK disimpan
// di DB — cuma di memori komponen ini, reload halaman = mulai dari 'awal'
// lagi (idealnya nanti disinkron ulang lewat get_claim_data, menyusul).
type GroupingFormData = {
  tanggal_masuk: string; tanggal_pulang: string; jaminan: string; no_sep: string; tipe: string;
  no_peserta: string; cob: boolean; jenis_rawat: 'jalan' | 'inap'; naik_kelas: boolean; kelas_hak: string;
  tgl_masuk_jam: string; tgl_pulang_jam: string; umur: string; cara_masuk: string; los: number;
  berat_lahir: string; cara_pulang: string; dpjp: string;
  tarif_rs: Record<string, number>;
  diagnosa_idrg: string; prosedur_idrg: string;
};

const TARIF_KOLOM: { key: string; label: string }[][] = [
  [{ key: 'prosedur_non_bedah', label: 'Prosedur Non Bedah' }, { key: 'tenaga_ahli', label: 'Tenaga Ahli' }, { key: 'radiologi', label: 'Radiologi' }, { key: 'rehabilitasi', label: 'Rehabilitasi' }, { key: 'obat', label: 'Obat' }, { key: 'alkes', label: 'Alkes' }],
  [{ key: 'prosedur_bedah', label: 'Prosedur Bedah' }, { key: 'keperawatan', label: 'Keperawatan' }, { key: 'laboratorium', label: 'Laboratorium' }, { key: 'kamar', label: 'Kamar / Akomodasi' }, { key: 'obat_kronis', label: 'Obat Kronis' }, { key: 'bmhp', label: 'BMHP' }],
  [{ key: 'konsultasi', label: 'Konsultasi' }, { key: 'penunjang', label: 'Penunjang' }, { key: 'pelayanan_darah', label: 'Pelayanan Darah' }, { key: 'rawat_intensif', label: 'Rawat Intensif' }, { key: 'obat_kemoterapi', label: 'Obat Kemoterapi' }, { key: 'sewa_alat', label: 'Sewa Alat' }],
];

const gLabel: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontStyle: 'italic' };
const gInput: React.CSSProperties = { padding: '6px 10px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box' };

// Style sub-section "Data Klinis" (Step 2) — dkRow/dkFieldLabel dipakai
// khusus kartu "Kelahiran" (per-bayi, tetap rata kiri krn banyak field),
// sisanya (Tekanan Darah/Persalinan/APGAR/ADL/dst) pakai style rata-tengah
// dkCenter* di bawah.
const dkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' };
const dkFieldLabel: React.CSSProperties = { ...gLabel, minWidth: 140 };
const dkNumInput: React.CSSProperties = { ...gInput, width: 90 };

// Style Data Klinis versi rata-tengah + divider (sepadan tampilan resmi
// E-Klaim) — dipakai gantiin dkSection/dkSectionTitle (kartu berbingkai
// rata-kiri) versi sebelumnya.
const dkCenterBlock: React.CSSProperties = { padding: '14px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' };
const dkCenterTitle: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginBottom: 8 };
const dkCenterCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 };
const dkCenterInput: React.CSSProperties = { ...gInput, width: 70, textAlign: 'center' };
const dkCenterSubLabel: React.CSSProperties = { fontSize: 10.5, color: '#374151', fontWeight: 600 };
const dkRevealLink: React.CSSProperties = { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 };

// Style tabel "Hasil Grouping iDRG/INACBG" — sepadan tampilan resmi
// E-Klaim (band judul abu-hijau + baris label/value bergaris), dipakai
// gantiin box ringkas <div><b>Label:</b> value</div> yg sebelumnya.
const grBox = (danger: boolean): React.CSSProperties => ({ marginTop: 12, border: `1px solid ${danger ? '#fecaca' : '#bbf7d0'}` });
const grHeader = (danger: boolean): React.CSSProperties => ({ padding: '6px 10px', background: danger ? '#fee2e2' : '#dcfce7', fontWeight: 700, fontSize: 12.5, textAlign: 'center', color: '#111827' });
const grRow = (danger: boolean): React.CSSProperties => ({ display: 'flex', borderTop: `1px solid ${danger ? '#fecaca' : '#bbf7d0'}` });
const grLabel = (danger: boolean): React.CSSProperties => ({ width: 150, flexShrink: 0, padding: '5px 10px', fontSize: 12, color: '#374151', background: danger ? '#fef2f2' : '#f0fdf4' });
const grValue: React.CSSProperties = { flex: 1, padding: '5px 10px', fontSize: 12.5, color: '#111827' };

// Data Klinis — field opsional method #4 (set_claim_data), persis nama &
// struktur field di Manual Web Service E-Klaim hal. 13-22 & contoh respons
// get_claim_data hal. 45-46 (field2 ini DIECHO balik apa adanya di top-level
// `data`, kecuali sub-objek `ventilator` yg tidak terlihat diecho — makanya
// use_ind/start/stop ventilator TIDAK direstore dari sync, isi ulang manual
// tiap sesi). "Akan selalu disimpan terlepas dari kondisi detail klaim
// namun hanya diperhitungkan ketika kondisi terpenuhi" (mis. apgar cuma
// dipakai kalau umur pasien <=1 hari, persalinan cuma kalau ranap dgn
// diagnosa persalinan, dst) — jadi field2 di bawah SELALU dikirim, biar
// E-Klaim sendiri yg memutuskan relevan atau tidak per kasus.
type DataKlinis = {
  sistole: string; diastole: string;
  adl_sub_acute: string; adl_chronic: string;
  icu_indikator: boolean; icu_los: string;
  ventilator_use_ind: boolean; ventilator_start: string; ventilator_stop: string; ventilator_hour: string;
  dializer_single_use: boolean;
  kantong_darah: string;
  alteplase_ind: boolean;
  upgrade_class_ind: boolean; upgrade_class_class: string; upgrade_class_los: string; upgrade_class_payor: string; add_payment_pct: string;
  bayi_lahir_status_cd: string;
  usia_kehamilan: string; gravida: string; partus: string; abortus: string; onset_kontraksi: string;
};

const DATA_KLINIS_DEFAULT: DataKlinis = {
  sistole: '', diastole: '',
  adl_sub_acute: '', adl_chronic: '',
  icu_indikator: false, icu_los: '',
  ventilator_use_ind: false, ventilator_start: '', ventilator_stop: '', ventilator_hour: '',
  dializer_single_use: false,
  kantong_darah: '',
  alteplase_ind: false,
  upgrade_class_ind: false, upgrade_class_class: 'kelas_1', upgrade_class_los: '', upgrade_class_payor: 'peserta', add_payment_pct: '',
  bayi_lahir_status_cd: '',
  usia_kehamilan: '', gravida: '', partus: '', abortus: '', onset_kontraksi: '',
};

type ApgarScore = { appearance: string; pulse: string; grimace: string; activity: string; respiration: string };
const APGAR_DEFAULT: ApgarScore = { appearance: '', pulse: '', grimace: '', activity: '', respiration: '' };

type DeliveryRow = {
  delivery_sequence: number; delivery_method: string; delivery_dttm: string;
  letak_janin: string; kondisi: string;
  use_manual: boolean; use_forcep: boolean; use_vacuum: boolean;
  shk_spesimen_ambil: string; shk_lokasi: string; shk_alasan: string; shk_spesimen_dttm: string;
};
const newDeliveryRow = (seq: number): DeliveryRow => ({
  delivery_sequence: seq, delivery_method: 'vaginal', delivery_dttm: '',
  letak_janin: 'kepala', kondisi: 'livebirth',
  use_manual: false, use_forcep: false, use_vacuum: false,
  shk_spesimen_ambil: 'tidak', shk_lokasi: 'tumit', shk_alasan: 'akses-sulit', shk_spesimen_dttm: '',
});

// discharge_status E-Klaim (1-5) dari raw kamar_inap.stts_pulang — padanan
// persis mapping discharge_status di klaimbarumanual.php (Khanza Java).
function caraPulangToDischargeStatus(v: string): string {
  const s = v.toLowerCase();
  if (['sembuh', 'sehat', 'atas persetujuan dokter'].includes(s)) return '1';
  if (s === 'rujuk') return '2';
  if (['aps', 'pulang paksa', 'atas permintaan sendiri'].includes(s)) return '3';
  if (['meninggal', '+'].includes(s)) return '4';
  return '5';
}
// cara_masuk E-Klaim dari label ringkas yg sudah kita punya (header
// backend cuma bisa bedakan Faskes 1/Faskes 2/Lainnya dari bridging_sep —
// enum E-Klaim py 10 opsi, jadi ini best-effort, bukan pemetaan lengkap).
function caraMasukToCode(label: string): string {
  if (label === 'Rujukan FKTP') return 'gp';
  if (label === 'Rujukan FKRTL') return 'hosp-trans';
  return 'other';
}

// Auto-fill (dari coding RM) / sync (dari get_claim_data) cuma kasih kode
// diagnosa mentah (dipisah '#'), bukan namanya — resolve satu-satu ke
// /api/penyakit/search (exact match kd_penyakit) spy list-nya bisa
// tampilkan nama, bukan cuma kode.
async function resolveDiagnosaCodes(codesStr: string): Promise<{ code: string; label: string }[]> {
  const codes = codesStr.split('#').map((s) => s.trim()).filter(Boolean);
  return Promise.all(codes.map(async (code) => {
    try {
      const r = await fetch(`/api/penyakit/search?q=${encodeURIComponent(code)}`);
      const d = await r.json();
      const match = Array.isArray(d) ? d.find((it: any) => it.kd_penyakit === code) : null;
      return { code, label: match ? match.nm_penyakit : '' };
    } catch {
      return { code, label: '' };
    }
  }));
}

// Sama pola dgn resolveDiagnosaCodes, tapi kode Prosedur bisa punya suffix
// "+N" (jumlah) yg perlu dipisah dulu sblm dicari ke /api/icd9/search.
async function resolveProsedurCodes(codesStr: string): Promise<{ code: string; label: string; jumlah: string }[]> {
  const tokens = codesStr.split('#').map((s) => s.trim()).filter(Boolean);
  return Promise.all(tokens.map(async (token) => {
    const [code, jumlah] = token.split('+');
    try {
      const r = await fetch(`/api/icd9/search?q=${encodeURIComponent(code)}`);
      const d = await r.json();
      const match = Array.isArray(d) ? d.find((it: any) => it.kode === code) : null;
      return { code, label: match ? match.deskripsi_panjang : '', jumlah: jumlah || '1' };
    } catch {
      return { code, label: '', jumlah: jumlah || '1' };
    }
  }));
}

type EklaimStage = 'awal' | 'idrg_input' | 'idrg_grouped' | 'idrg_final' | 'inacbg_input' | 'inacbg_grouped' | 'inacbg_final' | 'klaim_final';

async function eklaimCall(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`/api/bridging/eklaim/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memanggil E-Klaim');
  if (data?.metadata?.code && data.metadata.code !== 200) {
    throw new Error(data.metadata.message || 'E-Klaim mengembalikan error');
  }
  return data;
}

const stageStyle: React.CSSProperties = { padding: 16, border: '1px solid #e5e7eb', marginBottom: 12 };
const stageTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 0, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
const btnDisabled: React.CSSProperties = { padding: '8px 16px', borderRadius: 0, border: 'none', background: '#d1d5db', color: '#6b7280', fontSize: 12.5, fontWeight: 600, cursor: 'not-allowed' };

// Modal cari & pilih ICD-10 (Diagnosa) / ICD-9 (Prosedur) — endpoint sama
// persis dgn yg dipakai ModalInputDiagnosa.tsx (tab Diagnosa Pemeriksaan),
// cuma di sini hasil klik langsung digabung '#' ke field teks Diagnosa/
// Prosedur iDRG, bukan disimpan ke diagnosa_pasien/prosedur_pasien (field
// ini murni payload E-Klaim, terpisah dari coding RM).
const IcdPickerModal: React.FC<{
  kind: 'diagnosa' | 'prosedur';
  current: string;
  onPick: (item: { code: string; label: string }) => void;
  onClose: () => void;
}> = ({ kind, current, onPick, onClose }) => {
  const [q, setQ] = React.useState('');
  const [options, setOptions] = React.useState<{ code: string; label: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  // Kode Prosedur bisa punya suffix "+N" (jumlah) — dibandingkan tanpa
  // suffix-nya spy deteksi "sudah dipilih" tetap kena.
  const currentCodes = current.split('#').map((s) => s.trim().split('+')[0]).filter(Boolean);
  const searchUrl = kind === 'diagnosa' ? '/api/penyakit/search' : '/api/icd9/search';
  const fieldLabel = kind === 'diagnosa' ? 'Diagnosa (ICD-10) :' : 'Prosedur (ICD-9-CM) :';
  const placeholder = kind === 'diagnosa' ? 'Cari nama/kode ICD-10...' : 'Cari nama/kode ICD-9...';

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${searchUrl}?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((raw: any[]) => {
          if (cancelled) return;
          const mapped = Array.isArray(raw)
            ? raw.map((item) => (kind === 'diagnosa'
              ? { code: item.kd_penyakit, label: item.nm_penyakit }
              : { code: item.kode, label: item.deskripsi_panjang }))
            : [];
          setOptions(mapped);
        })
        .catch(() => { if (!cancelled) setOptions([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, q === '' ? 0 : 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, kind, searchUrl]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 480, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{fieldLabel}</span>
          <input
            type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
          />
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowY: 'auto', flex: 1, minHeight: 200 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>Memuat...</div>
          ) : options.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>Tidak ada hasil</div>
          ) : (
            options.map((item, idx) => {
              const already = currentCodes.includes(item.code);
              return (
                <div
                  key={item.code}
                  onClick={() => !already && onPick(item)}
                  style={{
                    padding: '8px 12px', cursor: already ? 'default' : 'pointer',
                    background: already ? '#e0f2fe' : '#fff',
                    borderBottom: idx < options.length - 1 ? '1px solid #f3f4f6' : 'none',
                    fontSize: 12.5, color: '#111827',
                  }}
                  onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { if (!already) e.currentTarget.style.background = '#fff'; }}
                >
                  <span style={{ fontWeight: 600 }}>{item.code}</span> — {item.label} {already && <span style={{ color: '#2563eb' }}>✓ sudah dipilih</span>}
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Selesai</button>
        </div>
      </div>
    </div>
  );
};

const GroupingFormView: React.FC<{ noRawat: string; header: GroupingHeader | null }> = ({ noRawat, header }) => {
  const [form, setForm] = React.useState<GroupingFormData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tarif, setTarif] = React.useState<Record<string, number>>({});
  const [coderNik, setCoderNik] = React.useState('');
  const [dataKlinis, setDataKlinis] = React.useState<DataKlinis>(DATA_KLINIS_DEFAULT);
  const setDK = (key: keyof DataKlinis, value: string | boolean) => setDataKlinis((prev) => ({ ...prev, [key]: value }));
  const [apgarMenit1, setApgarMenit1] = React.useState<ApgarScore>(APGAR_DEFAULT);
  const [apgarMenit5, setApgarMenit5] = React.useState<ApgarScore>(APGAR_DEFAULT);
  const [deliveryList, setDeliveryList] = React.useState<DeliveryRow[]>([]);
  // Grup Data Klinis TANPA kondisi diagnosa (ADL/ICU/Naik Kelas/Bayi Lahir)
  // default disembunyikan kalau semua field-nya kosong — "revealX" dipakai
  // spy staf tetap bisa buka grup itu manual (klik "+ Tambah ...") walau
  // belum ada isinya, tanpa itu grup yg disembunyikan tak akan pernah bisa
  // diisi pertama kali.
  const [revealAdl, setRevealAdl] = React.useState(false);
  const [revealIcu, setRevealIcu] = React.useState(false);
  const [revealNaikKelas, setRevealNaikKelas] = React.useState(false);
  const [revealBayiLahir, setRevealBayiLahir] = React.useState(false);
  // Payor ID/Code & Kode Tarif sekarang setting tetap per-RS (Admin >
  // Pengaturan Bridging > E-Klaim), bukan diisi ulang tiap klaim —
  // backend/eklaim_handler.go
  // otomatis menyisipkannya ke set_claim_data.

  const [stage, setStage] = React.useState<EklaimStage>('awal');
  const [busy, setBusy] = React.useState('');
  const [actionError, setActionError] = React.useState('');

  // Diagnosa iDRG disimpan sbg list {code,label} (bukan cuma string '#') spy
  // bisa ditampilkan sbg baris nama+kode+Primary/Secondary & digeser urutan
  // (drag) — urutan menentukan Primary (baris pertama) vs Secondary,
  // dikirim ke E-Klaim sbg string digabung '#' saat Group iDRG.
  const [idrgDiagnosaList, setIdrgDiagnosaList] = React.useState<{ code: string; label: string }[]>([]);
  const [dragDiagnosaIdx, setDragDiagnosaIdx] = React.useState<number | null>(null);
  // Sama pola dgn Diagnosa — list {code,label,jumlah}, urutan -> Primary/
  // Secondary, jumlah > 1 dikirim sbg suffix "+N" (jumlah=1 tanpa suffix,
  // persis konvensi klaimbarumanual.php).
  const [idrgProsedurList, setIdrgProsedurList] = React.useState<{ code: string; label: string; jumlah: string }[]>([]);
  const [dragProsedurIdx, setDragProsedurIdx] = React.useState<number | null>(null);
  const [idrgResult, setIdrgResult] = React.useState<any>(null);
  const [idrgTopupPick, setIdrgTopupPick] = React.useState('');
  const [showIcdDiagnosaModal, setShowIcdDiagnosaModal] = React.useState(false);
  const [showIcdProsedurModal, setShowIcdProsedurModal] = React.useState(false);
  const addIdrgDiagnosaCode = (item: { code: string; label: string }) => {
    setIdrgDiagnosaList((prev) => (prev.some((d) => d.code === item.code) ? prev : [...prev, item]));
  };
  const removeIdrgDiagnosaAt = (idx: number) => {
    setIdrgDiagnosaList((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveIdrgDiagnosa = (from: number, to: number) => {
    setIdrgDiagnosaList((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const addIdrgProsedurCode = (item: { code: string; label: string }) => {
    setIdrgProsedurList((prev) => (prev.some((p) => p.code === item.code) ? prev : [...prev, { ...item, jumlah: '1' }]));
  };
  const removeIdrgProsedurAt = (idx: number) => {
    setIdrgProsedurList((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveIdrgProsedur = (from: number, to: number) => {
    setIdrgProsedurList((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const setIdrgProsedurJumlah = (idx: number, jumlah: string) => {
    setIdrgProsedurList((prev) => prev.map((p, i) => (i === idx ? { ...p, jumlah } : p)));
  };

  const [inacbgDiagnosa, setInacbgDiagnosa] = React.useState('');
  const [inacbgProsedur, setInacbgProsedur] = React.useState('');
  const [inacbgResult, setInacbgResult] = React.useState<any>(null);
  const [inacbgCmgPick, setInacbgCmgPick] = React.useState('');
  // klaim_status_cd & kemenkes_dc_status_cd — persis field respons
  // get_claim_data (lihat contoh di Manual Web Service E-Klaim hal. 47),
  // dipakai utk tampilkan box "Status Klaim" spt tampilan resmi E-Klaim
  // (Status Klaim: Final, Status DC Kemkes: Terkirim) sesudah klaim final.
  const [klaimStatusCd, setKlaimStatusCd] = React.useState('');
  const [dcKemkesStatusCd, setDcKemkesStatusCd] = React.useState('');

  // Ambil form header + terapkan auto-fill (Tarif RS dari billing, Diagnosa/
  // Prosedur iDRG dari tab Diagnosa Pemeriksaan). Dipanggil saat halaman
  // dibuka DAN dipanggil ulang pas klik Buat Klaim Baru, spy kalau dokter
  // baru isi diagnosa di tab Pemeriksaan setelah halaman Grouping ini
  // dibuka duluan, datanya tetap ke-refresh sebelum mulai coding — bukan
  // data basi dari load pertama. Nilai yg SUDAH diketik manual (prev) tidak
  // ditimpa (prev||value / {...default,...prev}).
  const fetchAndApplyAutoFill = React.useCallback(async () => {
    const r = await fetch(`/api/casemix/grouping-form/${encodeURIComponent(noRawat)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Gagal memuat data grouping');
    setForm(d);
    if (d.tarif_rs) {
      const billingDefaults: Record<string, number> = {};
      TARIF_KOLOM.flat().forEach((k) => {
        if (d.tarif_rs[k.key] != null) billingDefaults[k.label] = Number(d.tarif_rs[k.key]);
      });
      setTarif((prev) => ({ ...billingDefaults, ...prev }));
    }
    if (d.diagnosa_idrg) {
      const resolved = await resolveDiagnosaCodes(d.diagnosa_idrg);
      setIdrgDiagnosaList((prev) => (prev.length > 0 ? prev : resolved));
    }
    if (d.prosedur_idrg) {
      const resolvedP = await resolveProsedurCodes(d.prosedur_idrg);
      setIdrgProsedurList((prev) => (prev.length > 0 ? prev : resolvedP));
    }
    return d as GroupingFormData;
  }, [noRawat]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAndApplyAutoFill()
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [fetchAndApplyAutoFill]);

  // Coder NIK tidak ditampilkan sbg field isian (mandatory di E-Klaim, tapi
  // bukan sesuatu yg perlu dipilih staf tiap klaim) — auto-resolve dari NIP
  // user yg login (session 'ermapp_user', field .nip = pegawai.nik jg dipakai
  // inacbg_coder_nik.nik, lihat auth_register_handler.go). Kalau user yg
  // login tidak terdaftar sbg coder, ambil salah satu (coder pertama) dari
  // daftar terdaftar (Admin > Pengaturan Bridging > E-Klaim > Kelola Coder
  // NIK) — prev||resolved supaya tidak menimpa kalau klaim ini sudah pernah
  // disimpan sebelumnya dgn coder_nik lain (sync effect di bawah menang).
  React.useEffect(() => {
    fetch('/api/bridging/eklaim/coder-nik/list')
      .then((r) => r.json())
      .then((d) => {
        const list: { nik: string; nama: string; no_ik: string }[] = Array.isArray(d) ? d : [];
        if (list.length === 0) return;
        let myNip = '';
        try {
          const stored = sessionStorage.getItem('ermapp_user');
          if (stored) myNip = JSON.parse(stored)?.nip || '';
        } catch { /* biarkan kosong, fallback ke coder pertama */ }
        const resolved = (list.find((c) => c.nik === myNip) || list[0]).nik;
        setCoderNik((prev) => prev || resolved);
      })
      .catch(() => { /* tidak fatal — handleGroupIdrg akan tetap validasi coderNik terisi */ });
  }, []);

  // Sinkronkan progres yang sudah ada di E-Klaim (kalau halaman ini pernah
  // dibuka & "Buat Klaim Baru" sudah pernah sukses sebelumnya) supaya user
  // yang keluar-masuk lagi tidak mulai dari nol / kena "Duplikasi nomor SEP"
  // saat coba Buat Klaim Baru ulang. Kalau klaim belum pernah dibuat,
  // get_claim_data akan error — diamkan saja, tetap mulai dari tahap 'awal'.
  // Diekstrak jadi callback (bukan cuma efek sekali jalan) supaya bisa
  // dipanggil ulang sesudah "Kirim Klaim" — kemenkes_dc_status_cd baru
  // berubah dari "unsent" ke "sent" SESUDAH kirim online sukses, jadi box
  // "Status Klaim" perlu data terbaru, bukan snapshot saat halaman dibuka.
  const syncFromEklaim = React.useCallback(async () => {
    try {
      const res = await eklaimCall('klaim/detail', { no_rawat: noRawat });
      const d = res?.response?.data;
      if (!d) return;
      // coder_nik cuma keisi kalau set_claim_data memang sudah pernah
      // dikirim (mandatory di E-Klaim) — dipakai sbg penanda "klaim ini
      // sudah pernah disimpan", supaya tarif_rs placeholder nol dari
      // klaim yg belum pernah disimpan tidak menimpa auto-fill billing.
      if (d.coder_nik) {
        setCoderNik(String(d.coder_nik));
        if (d.tarif_rs) {
          const restored: Record<string, number> = {};
          TARIF_KOLOM.flat().forEach((k) => {
            if (d.tarif_rs[k.key] != null) restored[k.label] = Number(d.tarif_rs[k.key]);
          });
          setTarif((prev) => ({ ...prev, ...restored }));
        }

        // Restore Data Klinis — field2 ini diecho balik di top-level `data`
        // (persis nama field request), KECUALI sub-objek ventilator
        // use_ind/start_dttm/stop_dttm yg tidak terlihat diecho di contoh
        // respons manual — jadi tetap kosong tiap sesi, isi ulang manual.
        setDataKlinis({
          sistole: d.sistole != null ? String(d.sistole) : '',
          diastole: d.diastole != null ? String(d.diastole) : '',
          adl_sub_acute: d.adl_sub_acute != null ? String(d.adl_sub_acute) : '',
          adl_chronic: d.adl_chronic != null ? String(d.adl_chronic) : '',
          icu_indikator: String(d.icu_indikator) === '1',
          icu_los: d.icu_los != null ? String(d.icu_los) : '',
          ventilator_use_ind: false, ventilator_start: '', ventilator_stop: '',
          ventilator_hour: d.ventilator_hour != null ? String(d.ventilator_hour) : '',
          dializer_single_use: String(d.dializer_single_use) === '1',
          kantong_darah: d.kantong_darah != null ? String(d.kantong_darah) : '',
          alteplase_ind: String(d.alteplase_ind) === '1',
          upgrade_class_ind: String(d.upgrade_class_ind) === '1',
          upgrade_class_class: d.upgrade_class_class || 'kelas_1',
          upgrade_class_los: d.upgrade_class_los != null ? String(d.upgrade_class_los) : '',
          upgrade_class_payor: d.upgrade_class_payor || 'peserta',
          add_payment_pct: d.add_payment_pct != null ? String(d.add_payment_pct) : '',
          bayi_lahir_status_cd: d.bayi_lahir_status_cd != null ? String(d.bayi_lahir_status_cd) : '',
          usia_kehamilan: d.persalinan?.usia_kehamilan != null ? String(d.persalinan.usia_kehamilan) : '',
          gravida: d.persalinan?.gravida != null ? String(d.persalinan.gravida) : '',
          partus: d.persalinan?.partus != null ? String(d.persalinan.partus) : '',
          abortus: d.persalinan?.abortus != null ? String(d.persalinan.abortus) : '',
          onset_kontraksi: d.persalinan?.onset_kontraksi || '',
        });
        if (d.apgar?.menit_1) {
          setApgarMenit1({
            appearance: d.apgar.menit_1.appearance != null ? String(d.apgar.menit_1.appearance) : '',
            pulse: d.apgar.menit_1.pulse != null ? String(d.apgar.menit_1.pulse) : '',
            grimace: d.apgar.menit_1.grimace != null ? String(d.apgar.menit_1.grimace) : '',
            activity: d.apgar.menit_1.activity != null ? String(d.apgar.menit_1.activity) : '',
            respiration: d.apgar.menit_1.respiration != null ? String(d.apgar.menit_1.respiration) : '',
          });
        }
        if (d.apgar?.menit_5) {
          setApgarMenit5({
            appearance: d.apgar.menit_5.appearance != null ? String(d.apgar.menit_5.appearance) : '',
            pulse: d.apgar.menit_5.pulse != null ? String(d.apgar.menit_5.pulse) : '',
            grimace: d.apgar.menit_5.grimace != null ? String(d.apgar.menit_5.grimace) : '',
            activity: d.apgar.menit_5.activity != null ? String(d.apgar.menit_5.activity) : '',
            respiration: d.apgar.menit_5.respiration != null ? String(d.apgar.menit_5.respiration) : '',
          });
        }
        if (Array.isArray(d.persalinan?.delivery)) {
          setDeliveryList(d.persalinan.delivery.map((x: any, i: number) => ({
            delivery_sequence: Number(x.delivery_sequence) || i + 1,
            delivery_method: x.delivery_method || 'vaginal',
            delivery_dttm: x.delivery_dttm || '',
            letak_janin: x.letak_janin || 'kepala',
            kondisi: x.kondisi || 'livebirth',
            use_manual: String(x.use_manual) === '1',
            use_forcep: String(x.use_forcep) === '1',
            use_vacuum: String(x.use_vacuum) === '1',
            shk_spesimen_ambil: x.shk_spesimen_ambil || 'tidak',
            shk_lokasi: x.shk_lokasi || 'tumit',
            shk_alasan: x.shk_alasan || 'akses-sulit',
            shk_spesimen_dttm: x.shk_spesimen_dttm || '',
          })));
        }
      }
      if (d.diagnosa_inagrouper) setIdrgDiagnosaList(await resolveDiagnosaCodes(String(d.diagnosa_inagrouper)));
      if (d.procedure_inagrouper) setIdrgProsedurList(await resolveProsedurCodes(String(d.procedure_inagrouper)));
      if (d.diagnosa) setInacbgDiagnosa(String(d.diagnosa));
      if (d.procedure) setInacbgProsedur(String(d.procedure));

      // response_idrg SELALU ada sbg object placeholder (status_cd:"normal",
      // total_cost_weight:"0", tanpa drg_code) walau grouping belum pernah
      // dijalankan sama sekali — dikonfirmasi dari data real server, BEDA
      // dari contoh di manual resmi. Jadi jangan pakai "ada objeknya" sbg
      // sinyal sudah di-grouping, pakai kemunculan drg_code (khusus utk
      // hasil grouping asli, bukan placeholder).
      const idrg = d.grouper?.response_idrg;
      const inacbg = d.grouper?.response_inacbg;
      const idrgGrouped = !!idrg?.drg_code;
      const inacbgGrouped = !!inacbg?.cbg?.code;
      if (idrgGrouped) setIdrgResult(idrg);
      if (inacbgGrouped) setInacbgResult(inacbg);

      let next: EklaimStage = 'idrg_input';
      if (idrgGrouped) next = 'idrg_grouped';
      if (idrgGrouped && idrg.status_cd === 'final') next = 'idrg_final';
      if (idrgGrouped && idrg.status_cd === 'final' && inacbgGrouped && !String(inacbg.cbg.code).startsWith('X')) next = 'inacbg_grouped';
      if (inacbgGrouped && inacbg.status_cd === 'final') next = 'inacbg_final';
      if (d.klaim_status_cd === 'final') next = 'klaim_final';
      setStage(next);

      setKlaimStatusCd(String(d.klaim_status_cd || ''));
      setDcKemkesStatusCd(String(d.kemenkes_dc_status_cd || ''));
    } catch {
      /* klaim belum pernah dibuat — tetap di tahap awal */
    }
  }, [noRawat]);

  React.useEffect(() => { syncFromEklaim(); }, [syncFromEklaim]);

  const totalTarif = Object.values(tarif).reduce((a, b) => a + (b || 0), 0);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusy('');
    }
  };

  const handleBuatKlaimBaru = () => runAction('buat', async () => {
    try {
      await eklaimCall('new-claim', { no_rawat: noRawat });
    } catch (e) {
      // Klaim untuk SEP ini sudah pernah dibuat sebelumnya (E-Klaim menolak
      // dgn "Duplikasi nomor SEP") — bukan error, lanjut saja ke tahap
      // berikutnya, sama seperti kalau sync di atas berhasil duluan.
      const msg = e instanceof Error ? e.message : '';
      if (!/duplikasi/i.test(msg)) throw e;
    }
    // Refresh Tarif & Diagnosa/Prosedur iDRG sebelum masuk tahap coding —
    // tangkap kalau ada isian baru di tab Diagnosa Pemeriksaan sejak
    // halaman ini pertama dibuka.
    await fetchAndApplyAutoFill().catch(() => { /* gagal refresh bukan blocker, data awal dari load pertama tetap dipakai */ });
    setStage('idrg_input');
  });

  // Digabung jadi satu klik "Group iDRG" — di aplikasi E-Klaim asli TIDAK
  // ada tombol simpan tarif terpisah, tarif/data klaim (set_claim_data)
  // langsung dikirim bareng saat klik tombol Grouping di bawahnya (lihat
  // screenshot 192.168.1.10/E-Klaim). Urutan: set_claim_data → set
  // diagnosa/prosedur iDRG → grouping stage 1.
  // Susun field2 Data Klinis utk dikirim bareng set_claim_data — SELALU
  // dikirim field skalar (tekanan darah/ADL/ICU/dst, kosong -> 0), tapi
  // sub-objek ventilator/apgar/persalinan cuma disertakan kalau memang
  // diisi (kirim objek kosong/nol semua tidak ada gunanya & bikin payload
  // sia-sia sesuai catatan manual "akan selalu disimpan ... namun hanya
  // diperhitungkan ketika kondisi terpenuhi").
  const buildDataKlinisFields = (): Record<string, unknown> => {
    const fields: Record<string, unknown> = {
      sistole: dataKlinis.sistole ? Number(dataKlinis.sistole) : 0,
      diastole: dataKlinis.diastole ? Number(dataKlinis.diastole) : 0,
      adl_sub_acute: dataKlinis.adl_sub_acute ? Number(dataKlinis.adl_sub_acute) : 0,
      adl_chronic: dataKlinis.adl_chronic ? Number(dataKlinis.adl_chronic) : 0,
      icu_indikator: dataKlinis.icu_indikator ? 1 : 0,
      icu_los: dataKlinis.icu_los ? Number(dataKlinis.icu_los) : 0,
      ventilator_hour: dataKlinis.ventilator_hour ? Number(dataKlinis.ventilator_hour) : 0,
      dializer_single_use: dataKlinis.dializer_single_use ? 1 : 0,
      kantong_darah: dataKlinis.kantong_darah ? Number(dataKlinis.kantong_darah) : 0,
      alteplase_ind: dataKlinis.alteplase_ind ? 1 : 0,
      upgrade_class_ind: dataKlinis.upgrade_class_ind ? 1 : 0,
      upgrade_class_class: dataKlinis.upgrade_class_ind ? dataKlinis.upgrade_class_class : '',
      upgrade_class_los: dataKlinis.upgrade_class_ind && dataKlinis.upgrade_class_los ? Number(dataKlinis.upgrade_class_los) : 0,
      upgrade_class_payor: dataKlinis.upgrade_class_ind ? dataKlinis.upgrade_class_payor : '',
      add_payment_pct: dataKlinis.upgrade_class_ind && dataKlinis.add_payment_pct ? Number(dataKlinis.add_payment_pct) : 0,
    };
    if (dataKlinis.bayi_lahir_status_cd) fields.bayi_lahir_status_cd = Number(dataKlinis.bayi_lahir_status_cd);
    if (dataKlinis.ventilator_use_ind) {
      fields.ventilator = { use_ind: 1, start_dttm: dataKlinis.ventilator_start, stop_dttm: dataKlinis.ventilator_stop };
    }
    const apgarFilled = (s: ApgarScore) => Object.values(s).some((v) => v !== '');
    if (apgarFilled(apgarMenit1) || apgarFilled(apgarMenit5)) {
      const toNum = (s: ApgarScore) => ({
        appearance: Number(s.appearance) || 0, pulse: Number(s.pulse) || 0, grimace: Number(s.grimace) || 0,
        activity: Number(s.activity) || 0, respiration: Number(s.respiration) || 0,
      });
      fields.apgar = { menit_1: toNum(apgarMenit1), menit_5: toNum(apgarMenit5) };
    }
    const persalinanFilled = dataKlinis.usia_kehamilan || dataKlinis.gravida || dataKlinis.partus
      || dataKlinis.abortus || dataKlinis.onset_kontraksi || deliveryList.length > 0;
    if (persalinanFilled) {
      fields.persalinan = {
        usia_kehamilan: dataKlinis.usia_kehamilan ? Number(dataKlinis.usia_kehamilan) : 0,
        gravida: dataKlinis.gravida ? Number(dataKlinis.gravida) : 0,
        partus: dataKlinis.partus ? Number(dataKlinis.partus) : 0,
        abortus: dataKlinis.abortus ? Number(dataKlinis.abortus) : 0,
        onset_kontraksi: dataKlinis.onset_kontraksi || undefined,
        delivery: deliveryList.map((row) => ({
          delivery_sequence: row.delivery_sequence,
          delivery_method: row.delivery_method,
          delivery_dttm: row.delivery_dttm,
          letak_janin: row.letak_janin,
          kondisi: row.kondisi,
          use_manual: row.use_manual ? 1 : 0,
          use_forcep: row.use_forcep ? 1 : 0,
          use_vacuum: row.use_vacuum ? 1 : 0,
          shk_spesimen_ambil: row.shk_spesimen_ambil,
          ...(row.shk_spesimen_ambil === 'ya'
            ? { shk_lokasi: row.shk_lokasi, shk_alasan: row.shk_alasan, shk_spesimen_dttm: row.shk_spesimen_dttm }
            : {}),
        })),
      };
    }
    return fields;
  };

  const handleGroupIdrg = () => runAction('idrg-group', async () => {
    if (!coderNik.trim()) throw new Error('Coder NIK wajib diisi (mandatory di E-Klaim)');
    if (!header) throw new Error('Data header belum termuat');
    const tarifRs: Record<string, number> = {};
    TARIF_KOLOM.flat().forEach((k) => { tarifRs[k.key] = tarif[k.label] ?? 0; });
    await eklaimCall('update-klaim', {
      no_rawat: noRawat,
      coder_nik: coderNik.trim(),
      tgl_masuk: header.tgl_registrasi.length > 10 ? header.tgl_registrasi + ':00' : header.tgl_registrasi + ' 00:00:00',
      tgl_pulang: header.tanggal_pulang ? header.tanggal_pulang + ' 00:00:00' : undefined,
      cara_masuk: caraMasukToCode(header.cara_masuk || ''),
      jenis_rawat: header.tipe === 'RI' ? '1' : '2',
      kelas_rawat: header.kelas_hak || '3',
      discharge_status: caraPulangToDischargeStatus(header.cara_pulang || ''),
      tarif_rs: tarifRs,
      ...buildDataKlinisFields(),
    });

    const idrgDiagnosaStr = idrgDiagnosaList.map((d) => d.code).join('#');
    if (idrgDiagnosaStr) await eklaimCall('idrg/diagnosa/set', { no_rawat: noRawat, diagnosa: idrgDiagnosaStr });
    const idrgProsedurStr = idrgProsedurList.map((p) => p.code + (p.jumlah && p.jumlah !== '1' ? `+${p.jumlah}` : '')).join('#');
    if (idrgProsedurStr) await eklaimCall('idrg/prosedur/set', { no_rawat: noRawat, procedure: idrgProsedurStr });
    const r = await eklaimCall('idrg/grouping', { no_rawat: noRawat, stage: 1 });
    setIdrgResult(r.response_idrg);
    setStage('idrg_grouped');
  });

  const handleGroupIdrgStage2 = () => runAction('idrg-stage2', async () => {
    const r = await eklaimCall('idrg/grouping', { no_rawat: noRawat, stage: 2, topup_codes: idrgTopupPick });
    setIdrgResult(r.response_idrg);
  });

  const handleFinalIdrg = () => runAction('idrg-final', async () => {
    await eklaimCall('idrg/final', { no_rawat: noRawat });
    setStage('idrg_final');
  });

  const handleEditUlangIdrg = () => runAction('idrg-reedit', async () => {
    await eklaimCall('idrg/reedit', { no_rawat: noRawat });
    setStage('idrg_grouped');
  });

  const handleImportKeInacbg = () => runAction('import', async () => {
    const r = await eklaimCall('idrg/import-to-inacbg', { no_rawat: noRawat });
    const dxList = (r.data?.diagnosa?.expanded || []).map((d: any) => d.code).join('#');
    const prList = (r.data?.procedure?.expanded || []).map((p: any) => p.code).join('#');
    setInacbgDiagnosa(dxList);
    setInacbgProsedur(prList);
    setStage('inacbg_input');
  });

  const handleGroupInacbg = () => runAction('inacbg-group', async () => {
    if (inacbgDiagnosa.trim()) await eklaimCall('inacbg/diagnosa/set', { no_rawat: noRawat, diagnosa: inacbgDiagnosa.trim() });
    if (inacbgProsedur.trim()) await eklaimCall('inacbg/prosedur/set', { no_rawat: noRawat, procedure: inacbgProsedur.trim() });
    const r = await eklaimCall('inacbg/grouping', { no_rawat: noRawat, stage: 1 });
    setInacbgResult(r.response_inacbg);
    setStage('inacbg_grouped');
  });

  const handleGroupInacbgStage2 = () => runAction('inacbg-stage2', async () => {
    const r = await eklaimCall('inacbg/grouping', { no_rawat: noRawat, stage: 2, special_cmg: inacbgCmgPick });
    setInacbgResult(r.response_inacbg);
  });

  const handleFinalInacbg = () => runAction('inacbg-final', async () => {
    // Dialyzer/Kantong Darah/Alteplase baru diisi di step ini (sesudah CBG
    // diketahui) — kirim ulang set_claim_data dulu spy nilainya kesimpan
    // sebelum Final INACBG, baru relevan kalau CBG-nya memang cocok.
    if (showDialyzerKantong || showAlteplase) {
      await eklaimCall('update-klaim', { no_rawat: noRawat, coder_nik: coderNik.trim(), ...buildDataKlinisFields() });
    }
    await eklaimCall('inacbg/final', { no_rawat: noRawat });
    setStage('inacbg_final');
  });

  const handleEditUlangInacbg = () => runAction('inacbg-reedit', async () => {
    await eklaimCall('inacbg/reedit', { no_rawat: noRawat });
    setStage('inacbg_grouped');
  });

  const handleFinalKlaim = () => runAction('klaim-final', async () => {
    if (!coderNik.trim()) throw new Error('Coder NIK wajib diisi');
    await eklaimCall('klaim/final', { no_rawat: noRawat, coder_nik: coderNik.trim() });
    setStage('klaim_final');
    setKlaimStatusCd('final');
  });

  const handleEditUlangKlaim = async () => {
    const confirm = await Swal.fire({
      title: 'Edit Ulang Klaim?',
      text: 'Anda akan membatalkan status final dan melakukan edit ulang klaim?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya (edit ulang)',
      cancelButtonText: 'Tidak (batal edit)',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    });
    if (!confirm.isConfirmed) return;
    await runAction('klaim-reedit', async () => {
      await eklaimCall('klaim/reedit', { no_rawat: noRawat });
      setStage('inacbg_final');
    });
  };

  const handleKirimKlaim = () => runAction('kirim', async () => {
    await eklaimCall('klaim/kirim-individual', { no_rawat: noRawat });
    // kemenkes_dc_status_cd baru berubah jadi "sent" SESUDAH kirim online
    // sukses — sync ulang supaya box Status Klaim langsung update.
    await syncFromEklaim();
  });

  // Nama file "Gruper_<no_rawat>.pdf" — PERSIS konvensi jenisBerkasKlaim
  // (berkas_klaim_tte_handler.go), disimpan langsung ke folder fisik
  // berkasrawat/pages/upload (tanpa tabel DB), jadi otomatis terdeteksi
  // di tab Berkas Klaim tanpa langkah tambahan.
  const handleCetakKlaim = () => runAction('cetak', async () => {
    const r = await eklaimCall('klaim/cetak', { no_rawat: noRawat });
    const base64 = r.data;
    if (typeof base64 !== 'string') throw new Error('Respons cetak tidak berisi data PDF');
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');

    const form = new FormData();
    form.append('no_rawat', noRawat);
    form.append('jenis', 'Gruper_');
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), `Gruper_${noRawat.replace(/\//g, '_')}.pdf`);
    const upRes = await fetch('/api/casemix/berkas-klaim-tte/save', { method: 'POST', body: form });
    if (!upRes.ok) {
      const upData = await upRes.json().catch(() => ({}));
      throw new Error(`PDF sudah dibuka, tapi gagal diupload otomatis ke Berkas Rawat: ${upData.error || 'terjadi kesalahan'}`);
    }
    await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'PDF klaim tersimpan otomatis ke Berkas Klaim', timer: 2000, showConfirmButton: false });
  });

  const idrgUngroupable = idrgResult?.mdc_number === '36';
  const inacbgCode = typeof inacbgResult?.cbg?.code === 'string' ? inacbgResult.cbg.code : '';
  const inacbgUngroupable = inacbgCode.startsWith('X');
  // Gating tampil grup Data Klinis — cuma yg PUNYA kondisi eksplisit di
  // manual resmi yg diotomasi (sisanya, mis. ICU/Naik Kelas/ADL/Bayi Lahir,
  // tetap selalu tampil krn bukan turunan diagnosa, murni fakta administratif
  // yg staf harus bisa isi kapan saja):
  //  - APGAR: khusus bayi umur <=1 hari — dipakai proxy "encounter ini
  //    tercatat sbg bayi/neonatus" (header.berat_lahir terisi, dari
  //    pasien_bayi), bukan hitung umur presisi hari dari tgl_lahir (header
  //    cuma punya umur dlm tahun, tidak cukup presisi).
  //  - Persalinan: khusus ranap dgn diagnosa persalinan — proxy: ada
  //    diagnosa iDRG berkode awalan "O" (ICD-10 bab XV, Pregnancy/
  //    Childbirth/Puerperium).
  //  - Dialyzer/Kantong Darah/Alteplase: TIDAK di sini — kondisinya (kode
  //    CBG N-3-15-0/G-4-14-*) baru diketahui SESUDAH grouping INACBG, jadi
  //    field2 ini dipindah ke Step 4 (lihat showDialyzerKantong/showAlteplase
  //    di bawah), bukan di Data Klinis (Step 2) spt versi sebelumnya.
  const isNewborn = !!header?.berat_lahir;
  const hasPersalinanDx = header?.tipe === 'RI' && idrgDiagnosaList.some((d) => /^O/i.test(d.code));
  // Grup tanpa kondisi diagnosa — tampil kalau salah satu field-nya terisi,
  // ATAU staf sudah buka manual lewat "+ Tambah ..." (revealX). "Terisi"
  // di sini HARUS > 0 (bukan cuma !== ''), krn get_claim_data SELALU
  // mengembalikan field numerik ini sbg "0" (bukan kosong/null) walau
  // memang belum pernah diisi — kalau cuma cek !== '' maka string "0" hasil
  // sync dianggap "terisi" dan grup ikut tampil terus meski sebenarnya
  // kosong (dikonfirmasi nyata: klaim final tanpa data ADL/ICU/Naik Kelas
  // tapi grupnya tetap muncul menampilkan 0).
  const numFilled = (v: string) => v !== '' && Number(v) !== 0;
  const adlFilled = numFilled(dataKlinis.adl_sub_acute) || numFilled(dataKlinis.adl_chronic);
  const icuFilled = dataKlinis.icu_indikator || numFilled(dataKlinis.icu_los) || dataKlinis.ventilator_use_ind
    || dataKlinis.ventilator_start !== '' || dataKlinis.ventilator_stop !== '' || numFilled(dataKlinis.ventilator_hour);
  const naikKelasFilled = dataKlinis.upgrade_class_ind || numFilled(dataKlinis.upgrade_class_los) || numFilled(dataKlinis.add_payment_pct);
  const bayiLahirFilled = dataKlinis.bayi_lahir_status_cd !== '' && dataKlinis.bayi_lahir_status_cd !== '0';
  const showAdl = adlFilled || revealAdl;
  const showIcu = icuFilled || revealIcu;
  const showNaikKelas = naikKelasFilled || revealNaikKelas;
  const showBayiLahir = bayiLahirFilled || revealBayiLahir;
  const showDialyzerKantong = inacbgCode === 'N-3-15-0';
  const showAlteplase = inacbgCode.startsWith('G-4-14-');

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</div>;
  if (!form) return null;

  return (
    <div style={{ padding: 20 }}>
      {actionError && (
        <div style={{ padding: 10, marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12.5 }}>
          {actionError}
        </div>
      )}

      {/* Step 1 — Buat Klaim Baru (method #1 new_claim) */}
      {stage === 'awal' && (
        <div style={stageStyle}>
          <div style={stageTitle}>1. Buat Klaim Baru di E-Klaim</div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
            Mendaftarkan No. SEP ini ke sistem E-Klaim sebelum bisa lanjut coding/grouping.
          </p>
          <button type="button" onClick={handleBuatKlaimBaru} disabled={!!busy} style={busy === 'buat' ? btnDisabled : btnPrimary}>
            {busy === 'buat' ? 'Memproses...' : 'Buat Klaim Baru'}
          </button>
        </div>
      )}

      {stage !== 'awal' && (
        <>
          {/* Step 2 — Data Klaim (method #4 set_claim_data): tarif breakdown.
              coder_nik & kode_tarif diisi otomatis (coder_nik dari user login
              / fallback, kode_tarif dari Pengaturan Bridging E-Klaim) — tidak
              ditampilkan sbg field isian, lihat effect di atas & eklaimProxy
              di backend. */}
          <div style={stageStyle}>
            <div style={{ textAlign: 'center', padding: '4px 0 10px' }}>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>Tarif Rumah Sakit : </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Rp {totalTarif.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px 24px', marginBottom: 12 }}>
              {TARIF_KOLOM.map((kolom, ki) => (
                <div key={ki} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kolom.map((item) => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...gLabel, width: 130, flexShrink: 0 }}>{item.label}</span>
                      <input
                        type="number" disabled={stage !== 'idrg_input'}
                        style={{ ...gInput, width: 110 }}
                        value={tarif[item.label] ?? 0}
                        onChange={(e) => setTarif((prev) => ({ ...prev, [item.label]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Data Klinis — sepadan tampilan resmi E-Klaim (field opsional
                method #4), disertakan bareng klik Group iDRG. Layout rata
                tengah + divider persis tampilan asli. Grup TANPA kondisi
                diagnosa jelas (ADL/ICU/Naik Kelas/Bayi Lahir) disembunyikan
                default kalau kosong — otomatis tampil begitu salah satu
                field-nya terisi, atau staf buka manual via "+ Tambah ...". */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 10, textAlign: 'center' }}>Data Klinis</div>

              <div style={dkCenterBlock}>
                <div style={dkCenterTitle}>Tekanan Darah (mmHg):</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <div style={dkCenterCol}>
                    <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.sistole} onChange={(e) => setDK('sistole', e.target.value)} />
                    <span style={dkCenterSubLabel}>Sistole</span>
                  </div>
                  <div style={dkCenterCol}>
                    <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.diastole} onChange={(e) => setDK('diastole', e.target.value)} />
                    <span style={dkCenterSubLabel}>Diastole</span>
                  </div>
                </div>
              </div>

              {hasPersalinanDx && (
                <>
                  <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ flex: 1, padding: '14px 10px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                      <div style={dkCenterTitle}>Usia Kehamilan (minggu):</div>
                      <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.usia_kehamilan} onChange={(e) => setDK('usia_kehamilan', e.target.value)} />
                    </div>
                    <div style={{ flex: 1, padding: '14px 10px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                      <div style={dkCenterTitle}>Riwayat Kehamilan Sebelumnya:</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                        <div style={dkCenterCol}>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.gravida} onChange={(e) => setDK('gravida', e.target.value)} />
                          <span style={dkCenterSubLabel}>Gravida</span>
                        </div>
                        <div style={dkCenterCol}>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.partus} onChange={(e) => setDK('partus', e.target.value)} />
                          <span style={dkCenterSubLabel}>Partus</span>
                        </div>
                        <div style={dkCenterCol}>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.abortus} onChange={(e) => setDK('abortus', e.target.value)} />
                          <span style={dkCenterSubLabel}>Abortus</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={dkCenterTitle}>Onset Kontraksi:</div>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        {([['spontan', 'Timbul Spontan'], ['induksi', 'Dengan Induksi'], ['non_spontan_non_induksi', 'SC Tanpa Kontraksi/Induksi']] as [string, string][]).map(([val, label]) => (
                          <label key={val} style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: stage === 'idrg_input' ? 'pointer' : 'default' }}>
                            <input type="radio" disabled={stage !== 'idrg_input'} checked={dataKlinis.onset_kontraksi === val} onChange={() => setDK('onset_kontraksi', val)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={dkCenterBlock}>
                    <div style={dkCenterTitle}>Kelahiran:</div>
                    {deliveryList.length > 0 && (
                      <div style={{ textAlign: 'left' }}>
                        {deliveryList.map((row, idx) => (
                          <div key={idx} style={{ border: '1px solid #e5e7eb', padding: 8, marginBottom: 6, background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151' }}>Bayi ke-{row.delivery_sequence}</span>
                              {stage === 'idrg_input' && (
                                <button type="button" onClick={() => setDeliveryList((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, delivery_sequence: i + 1 })))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11.5 }}>
                                  Hapus
                                </button>
                              )}
                            </div>
                            <div style={dkRow}>
                              <span style={{ ...dkFieldLabel, minWidth: 100 }}>Metode</span>
                              <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 130 }} value={row.delivery_method} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, delivery_method: e.target.value } : r)))}>
                                <option value="vaginal">Vaginal</option>
                                <option value="sc">SC</option>
                              </select>
                              <span style={{ ...dkFieldLabel, minWidth: 90 }}>Letak Janin</span>
                              <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 130 }} value={row.letak_janin} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, letak_janin: e.target.value } : r)))}>
                                <option value="kepala">Kepala</option>
                                <option value="sungsang">Sungsang</option>
                                <option value="lintang">Lintang</option>
                              </select>
                            </div>
                            <div style={dkRow}>
                              <span style={{ ...dkFieldLabel, minWidth: 100 }}>Waktu Lahir</span>
                              <input type="datetime-local" disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 190 }} value={row.delivery_dttm} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, delivery_dttm: e.target.value } : r)))} />
                              <span style={{ ...dkFieldLabel, minWidth: 90 }}>Kondisi Bayi</span>
                              <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 130 }} value={row.kondisi} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, kondisi: e.target.value } : r)))}>
                                <option value="livebirth">Livebirth</option>
                                <option value="stillbirth">Stillbirth</option>
                              </select>
                            </div>
                            <div style={dkRow}>
                              <label style={{ fontSize: 11.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" disabled={stage !== 'idrg_input'} checked={row.use_manual} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, use_manual: e.target.checked } : r)))} /> Manual
                              </label>
                              <label style={{ fontSize: 11.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" disabled={stage !== 'idrg_input'} checked={row.use_forcep} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, use_forcep: e.target.checked } : r)))} /> Forcep
                              </label>
                              <label style={{ fontSize: 11.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" disabled={stage !== 'idrg_input'} checked={row.use_vacuum} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, use_vacuum: e.target.checked } : r)))} /> Vacuum
                              </label>
                            </div>
                            <div style={dkRow}>
                              <span style={{ ...dkFieldLabel, minWidth: 100 }}>Spesimen SHK</span>
                              <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 100 }} value={row.shk_spesimen_ambil} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, shk_spesimen_ambil: e.target.value } : r)))}>
                                <option value="tidak">Tidak</option>
                                <option value="ya">Ya</option>
                              </select>
                              {row.shk_spesimen_ambil === 'ya' && (
                                <>
                                  <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 100 }} value={row.shk_lokasi} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, shk_lokasi: e.target.value } : r)))}>
                                    <option value="tumit">Tumit</option>
                                    <option value="vena">Vena</option>
                                  </select>
                                  <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 130 }} value={row.shk_alasan} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, shk_alasan: e.target.value } : r)))}>
                                    <option value="akses-sulit">Akses Sulit</option>
                                    <option value="tidak-dapat">Tidak Dapat</option>
                                  </select>
                                  <input type="datetime-local" disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 190 }} value={row.shk_spesimen_dttm} onChange={(e) => setDeliveryList((prev) => prev.map((r, i) => (i === idx ? { ...r, shk_spesimen_dttm: e.target.value } : r)))} />
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {stage === 'idrg_input' && (
                      <button type="button" onClick={() => setDeliveryList((prev) => [...prev, newDeliveryRow(prev.length + 1)])} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11.5 }}>
                        + Tambah Bayi
                      </button>
                    )}
                  </div>
                </>
              )}

              {isNewborn && (
                <div style={dkCenterBlock}>
                  <div style={dkCenterTitle}>APGAR (khusus bayi umur ≤ 1 hari):</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                    {([['Menit 1', apgarMenit1, setApgarMenit1], ['Menit 5', apgarMenit5, setApgarMenit5]] as [string, ApgarScore, React.Dispatch<React.SetStateAction<ApgarScore>>][]).map(([label, score, setScore]) => (
                      <div key={label} style={dkCenterCol}>
                        <span style={dkCenterSubLabel}>{label}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['appearance', 'pulse', 'grimace', 'activity', 'respiration'] as (keyof ApgarScore)[]).map((key) => (
                            <div key={key} style={dkCenterCol}>
                              <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 52 }} value={score[key]} onChange={(e) => setScore((prev) => ({ ...prev, [key]: e.target.value }))}>
                                <option value="">-</option>
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                              </select>
                              <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'capitalize' }}>{key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAdl ? (
                <div style={dkCenterBlock}>
                  <div style={dkCenterTitle}>ADL Score:</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                    <div style={dkCenterCol}>
                      <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.adl_sub_acute} onChange={(e) => setDK('adl_sub_acute', e.target.value)} />
                      <span style={dkCenterSubLabel}>Sub Acute (12-60)</span>
                    </div>
                    <div style={dkCenterCol}>
                      <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.adl_chronic} onChange={(e) => setDK('adl_chronic', e.target.value)} />
                      <span style={dkCenterSubLabel}>Chronic (12-60)</span>
                    </div>
                  </div>
                </div>
              ) : stage === 'idrg_input' && (
                <div style={{ ...dkCenterBlock, padding: '8px 10px' }}>
                  <button type="button" onClick={() => setRevealAdl(true)} style={dkRevealLink}>+ Tambah ADL Score</button>
                </div>
              )}

              {showIcu ? (
                <div style={dkCenterBlock}>
                  <div style={dkCenterTitle}>ICU & Ventilator:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" disabled={stage !== 'idrg_input'} checked={dataKlinis.icu_indikator} onChange={(e) => setDK('icu_indikator', e.target.checked)} /> Rawat ICU
                      </label>
                      {dataKlinis.icu_indikator && (
                        <>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Lama Hari (ICU LOS)</span>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.icu_los} onChange={(e) => setDK('icu_los', e.target.value)} />
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" disabled={stage !== 'idrg_input'} checked={dataKlinis.ventilator_use_ind} onChange={(e) => setDK('ventilator_use_ind', e.target.checked)} /> Pakai Ventilator
                      </label>
                      {dataKlinis.ventilator_use_ind && (
                        <>
                          <input type="datetime-local" disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 190 }} value={dataKlinis.ventilator_start} onChange={(e) => setDK('ventilator_start', e.target.value)} />
                          <span style={{ color: '#9ca3af' }}>s/d</span>
                          <input type="datetime-local" disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 190 }} value={dataKlinis.ventilator_stop} onChange={(e) => setDK('ventilator_stop', e.target.value)} />
                        </>
                      )}
                    </div>
                    <div style={dkCenterCol}>
                      <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.ventilator_hour} onChange={(e) => setDK('ventilator_hour', e.target.value)} />
                      <span style={dkCenterSubLabel}>Jam Pemakaian Ventilator</span>
                    </div>
                  </div>
                </div>
              ) : stage === 'idrg_input' && (
                <div style={{ ...dkCenterBlock, padding: '8px 10px' }}>
                  <button type="button" onClick={() => setRevealIcu(true)} style={dkRevealLink}>+ Tambah ICU & Ventilator</button>
                </div>
              )}

              {showNaikKelas ? (
                <div style={dkCenterBlock}>
                  <div style={dkCenterTitle}>Naik Kelas:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" disabled={stage !== 'idrg_input'} checked={dataKlinis.upgrade_class_ind} onChange={(e) => setDK('upgrade_class_ind', e.target.checked)} /> Naik Kelas
                    </label>
                    {dataKlinis.upgrade_class_ind && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Kenaikan Ke Kelas</span>
                          <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 130 }} value={dataKlinis.upgrade_class_class} onChange={(e) => setDK('upgrade_class_class', e.target.value)}>
                            <option value="kelas_1">Kelas 1</option>
                            <option value="kelas_2">Kelas 2</option>
                            <option value="vip">VIP</option>
                          </select>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Lama Hari</span>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.upgrade_class_los} onChange={(e) => setDK('upgrade_class_los', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Sumber Pembayaran Tambahan</span>
                          <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 170 }} value={dataKlinis.upgrade_class_payor} onChange={(e) => setDK('upgrade_class_payor', e.target.value)}>
                            <option value="peserta">Peserta</option>
                            <option value="pemberi_kerja">Pemberi Kerja</option>
                            <option value="asuransi_tambahan">Asuransi Tambahan</option>
                          </select>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>% Koefisien Tambahan</span>
                          <input type="number" disabled={stage !== 'idrg_input'} style={dkCenterInput} value={dataKlinis.add_payment_pct} onChange={(e) => setDK('add_payment_pct', e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : stage === 'idrg_input' && (
                <div style={{ ...dkCenterBlock, padding: '8px 10px' }}>
                  <button type="button" onClick={() => setRevealNaikKelas(true)} style={dkRevealLink}>+ Tambah Naik Kelas</button>
                </div>
              )}

              {showBayiLahir ? (
                <div style={{ ...dkCenterBlock, borderBottom: 'none' }}>
                  <div style={dkCenterTitle}>Status Bayi Lahir (khusus Jaminan Bayi Baru Lahir):</div>
                  <select disabled={stage !== 'idrg_input'} style={{ ...gInput, width: 190, margin: '0 auto' }} value={dataKlinis.bayi_lahir_status_cd} onChange={(e) => setDK('bayi_lahir_status_cd', e.target.value)}>
                    <option value="">— tidak berlaku —</option>
                    <option value="1">Tanpa Kelainan</option>
                    <option value="2">Dengan Kelainan</option>
                  </select>
                </div>
              ) : stage === 'idrg_input' && (
                <div style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <button type="button" onClick={() => setRevealBayiLahir(true)} style={dkRevealLink}>+ Tambah Status Bayi Lahir</button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — Grouping iDRG (method #5-11) */}
          <div style={stageStyle}>
            <div style={stageTitle}>iDRG</div>
            {(stage === 'idrg_input' || stage === 'idrg_grouped') ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ ...gLabel, whiteSpace: 'nowrap' }}>Diagnosa (ICD-10) :</span>
                      <button
                        type="button" onClick={() => setShowIcdDiagnosaModal(true)} title="Tambah dari daftar ICD-10"
                        style={{ padding: '0 12px', height: 26, borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    </div>
                    {idrgDiagnosaList.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Belum ada diagnosa dipilih.</div>
                    ) : (
                      idrgDiagnosaList.map((item, idx) => (
                        <div
                          key={item.code}
                          draggable
                          onDragStart={() => setDragDiagnosaIdx(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragDiagnosaIdx !== null && dragDiagnosaIdx !== idx) moveIdrgDiagnosa(dragDiagnosaIdx, idx);
                            setDragDiagnosaIdx(null);
                          }}
                          onDragEnd={() => setDragDiagnosaIdx(null)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                            borderBottom: idx < idrgDiagnosaList.length - 1 ? '1px solid #f3f4f6' : 'none',
                            cursor: 'grab', opacity: dragDiagnosaIdx === idx ? 0.4 : 1,
                          }}
                        >
                          <span style={{ color: '#9ca3af', fontSize: 13, letterSpacing: -1, flexShrink: 0 }}>⋮⋮</span>
                          <span style={{ fontSize: 12.5, color: '#111827', flexShrink: 0 }}>{item.label || item.code}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', border: '1px solid #d1d5db', padding: '1px 6px', flexShrink: 0 }}>{item.code}</span>
                          <span style={{ fontSize: 11, color: idx === 0 ? '#2563eb' : '#9ca3af', fontWeight: idx === 0 ? 700 : 400, flexShrink: 0 }}>
                            {idx === 0 ? 'Primary' : 'Secondary'}
                          </span>
                          <button
                            type="button" onClick={() => removeIdrgDiagnosaAt(idx)} title="Hapus"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0 }}
                          >×</button>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ ...gLabel, whiteSpace: 'nowrap' }}>Prosedur (ICD-9-CM) :</span>
                      <button
                        type="button" onClick={() => setShowIcdProsedurModal(true)} title="Tambah dari daftar ICD-9"
                        style={{ padding: '0 12px', height: 26, borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    </div>
                    {idrgProsedurList.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Belum ada prosedur dipilih.</div>
                    ) : (
                      idrgProsedurList.map((item, idx) => (
                        <div
                          key={item.code}
                          draggable
                          onDragStart={() => setDragProsedurIdx(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragProsedurIdx !== null && dragProsedurIdx !== idx) moveIdrgProsedur(dragProsedurIdx, idx);
                            setDragProsedurIdx(null);
                          }}
                          onDragEnd={() => setDragProsedurIdx(null)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                            borderBottom: idx < idrgProsedurList.length - 1 ? '1px solid #f3f4f6' : 'none',
                            cursor: 'grab', opacity: dragProsedurIdx === idx ? 0.4 : 1,
                          }}
                        >
                          <span style={{ color: '#9ca3af', fontSize: 13, letterSpacing: -1, flexShrink: 0 }}>⋮⋮</span>
                          <span style={{ fontSize: 12.5, color: '#111827', flexShrink: 0 }}>{item.label || item.code}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', border: '1px solid #d1d5db', padding: '1px 6px', flexShrink: 0 }}>{item.code}</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#6b7280', flexShrink: 0 }}>
                            Jml
                            <input
                              type="text" value={item.jumlah} onChange={(e) => setIdrgProsedurJumlah(idx, e.target.value)}
                              style={{ width: 28, padding: '2px 4px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 11, textAlign: 'center' }}
                            />
                          </label>
                          <span style={{ fontSize: 11, color: idx === 0 ? '#2563eb' : '#9ca3af', fontWeight: idx === 0 ? 700 : 400, flexShrink: 0 }}>
                            {idx === 0 ? 'Primary' : 'Secondary'}
                          </span>
                          <button
                            type="button" onClick={() => removeIdrgProsedurAt(idx)} title="Hapus"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0 }}
                          >×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <button type="button" onClick={handleGroupIdrg} disabled={!!busy} style={busy === 'idrg-group' ? btnDisabled : btnSecondary}>
                  {busy === 'idrg-group' ? 'Memproses...' : 'Group iDRG'}
                </button>
                {showIcdDiagnosaModal && (
                  <IcdPickerModal kind="diagnosa" current={idrgDiagnosaList.map((d) => d.code).join('#')} onPick={addIdrgDiagnosaCode} onClose={() => setShowIcdDiagnosaModal(false)} />
                )}
                {showIcdProsedurModal && (
                  <IcdPickerModal kind="prosedur" current={idrgProsedurList.map((p) => p.code).join('#')} onPick={addIdrgProsedurCode} onClose={() => setShowIcdProsedurModal(false)} />
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#16a34a' }}>✓ iDRG sudah final.</div>
            )}

            {idrgResult && (
              <div style={grBox(idrgUngroupable)}>
                <div style={grHeader(idrgUngroupable)}>
                  Hasil Grouping iDRG{idrgResult.status_cd === 'final' ? ' - Final' : ''}
                </div>
                {coderNik && (
                  <div style={grRow(idrgUngroupable)}>
                    <div style={grLabel(idrgUngroupable)}>Info</div>
                    <div style={grValue}>
                      Coder {coderNik}
                      {idrgResult.script_version ? ` — ${idrgResult.script_version}` : ''}
                      {idrgResult.logic_version ? ` / ${idrgResult.logic_version}` : ''}
                    </div>
                  </div>
                )}
                <div style={grRow(idrgUngroupable)}>
                  <div style={grLabel(idrgUngroupable)}>Jenis Rawat</div>
                  <div style={grValue}>{header?.tipe === 'RI' ? 'Rawat Inap' : 'Rawat Jalan'}{header?.los ? ` (${header.los})` : ''}</div>
                </div>
                <div style={grRow(idrgUngroupable)}>
                  <div style={grLabel(idrgUngroupable)}>MDC</div>
                  <div style={grValue}>{idrgResult.mdc_description} <span style={{ color: '#6b7280' }}>({idrgResult.mdc_number})</span></div>
                </div>
                <div style={grRow(idrgUngroupable)}>
                  <div style={grLabel(idrgUngroupable)}>DRG</div>
                  <div style={{ ...grValue, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{idrgResult.drg_description} <span style={{ color: '#6b7280' }}>({idrgResult.drg_code})</span></span>
                    {idrgResult.cost_weight != null && <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>CW: {idrgResult.cost_weight}</span>}
                  </div>
                </div>
                {idrgResult.kris_cost_weight != null && (
                  <div style={grRow(idrgUngroupable)}>
                    <div style={grLabel(idrgUngroupable)}>KRIS Cost Weight</div>
                    <div style={grValue}>{idrgResult.kris_cost_weight}</div>
                  </div>
                )}
                {idrgResult.total_cost_weight != null && (
                  <div style={grRow(idrgUngroupable)}>
                    <div style={grLabel(idrgUngroupable)}>Total Cost Weight</div>
                    <div style={grValue}>{idrgResult.total_cost_weight}</div>
                  </div>
                )}
                {idrgResult.nbr != null && (
                  <div style={grRow(idrgUngroupable)}>
                    <div style={grLabel(idrgUngroupable)}>NBR</div>
                    <div style={grValue}>Rp {Number(idrgResult.nbr).toLocaleString('id-ID')}</div>
                  </div>
                )}
                {idrgResult.total_tarif != null && (
                  <div style={grRow(idrgUngroupable)}>
                    <div style={grLabel(idrgUngroupable)}>Total Klaim</div>
                    <div style={{ ...grValue, fontWeight: 700, fontSize: 13.5 }}>Rp {Number(idrgResult.total_tarif).toLocaleString('id-ID')}</div>
                  </div>
                )}
                <div style={grRow(idrgUngroupable)}>
                  <div style={grLabel(idrgUngroupable)}>Status</div>
                  <div style={{ ...grValue, fontWeight: 600, color: idrgResult.status_cd === 'final' ? '#16a34a' : '#374151' }}>{idrgResult.status_cd || '-'}</div>
                </div>
                {idrgUngroupable && (
                  <div style={{ padding: '8px 10px', color: '#991b1b', fontWeight: 600, fontSize: 12, borderTop: '1px solid #fecaca' }}>
                    Ungroupable — tidak bisa lanjut Final iDRG.
                  </div>
                )}

                {Array.isArray(idrgResult.topup_options) && idrgResult.topup_options.length > 0 && stage === 'idrg_grouped' && (
                  <div style={{ padding: '8px 10px', borderTop: '1px solid #bbf7d0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select style={{ ...gInput, width: 240 }} value={idrgTopupPick} onChange={(e) => setIdrgTopupPick(e.target.value)}>
                      <option value="">— pilih top up —</option>
                      {idrgResult.topup_options.map((t: any) => (
                        <option key={t.code} value={t.code}>{t.description} ({t.type})</option>
                      ))}
                    </select>
                    <button type="button" onClick={handleGroupIdrgStage2} disabled={!idrgTopupPick || !!busy} style={!idrgTopupPick || busy ? btnDisabled : btnSecondary}>
                      Terapkan Top Up (Stage 2)
                    </button>
                  </div>
                )}
              </div>
            )}

            {stage === 'idrg_grouped' && !idrgUngroupable && (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={handleFinalIdrg} disabled={!!busy} style={busy === 'idrg-final' ? btnDisabled : btnPrimary}>
                  {busy === 'idrg-final' ? 'Memproses...' : 'Final iDRG'}
                </button>
              </div>
            )}
            {stage === 'idrg_final' && (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={handleEditUlangIdrg} disabled={!!busy} style={busy === 'idrg-reedit' ? btnDisabled : btnSecondary}>
                  Edit Ulang iDRG
                </button>
              </div>
            )}
          </div>

          {/* Step 4 — Import ke INACBG + Grouping INACBG (method #13-19) */}
          {(stage === 'idrg_final' || stage === 'inacbg_input' || stage === 'inacbg_grouped' || stage === 'inacbg_final' || stage === 'klaim_final') && (
            <div style={stageStyle}>
              <div style={stageTitle}>INACBG</div>
              {stage === 'idrg_final' && (
                <button type="button" onClick={handleImportKeInacbg} disabled={!!busy} style={busy === 'import' ? btnDisabled : btnPrimary}>
                  {busy === 'import' ? 'Memproses...' : 'Import Coding iDRG ke INACBG'}
                </button>
              )}

              {(stage === 'inacbg_input' || stage === 'inacbg_grouped') && (
                <>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 260px' }}>
                      <div style={gLabel}>Diagnosa INACBG</div>
                      <input style={gInput} value={inacbgDiagnosa} onChange={(e) => setInacbgDiagnosa(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 260px' }}>
                      <div style={gLabel}>Prosedur INACBG</div>
                      <input style={gInput} value={inacbgProsedur} onChange={(e) => setInacbgProsedur(e.target.value)} />
                    </div>
                  </div>
                  <button type="button" onClick={handleGroupInacbg} disabled={!!busy} style={busy === 'inacbg-group' ? btnDisabled : btnSecondary}>
                    {busy === 'inacbg-group' ? 'Memproses...' : 'Group INACBG'}
                  </button>
                </>
              )}
              {(stage === 'inacbg_final' || stage === 'klaim_final') && (
                <div style={{ fontSize: 12, color: '#16a34a' }}>✓ INACBG sudah final.</div>
              )}

              {inacbgResult && (
                <div style={grBox(inacbgUngroupable)}>
                  <div style={grHeader(inacbgUngroupable)}>
                    Hasil Grouping INACBG{inacbgResult.status_cd === 'final' ? ' - Final' : ''}
                  </div>
                  {coderNik && (
                    <div style={grRow(inacbgUngroupable)}>
                      <div style={grLabel(inacbgUngroupable)}>Info</div>
                      <div style={grValue}>
                        Coder {coderNik}
                        {inacbgResult.kelas ? ` — ${String(inacbgResult.kelas).replace('kelas_', 'Kelas ')}` : ''}
                        {inacbgResult.inacbg_version ? ` (${inacbgResult.inacbg_version})` : ''}
                      </div>
                    </div>
                  )}
                  <div style={grRow(inacbgUngroupable)}>
                    <div style={grLabel(inacbgUngroupable)}>Jenis Rawat</div>
                    <div style={grValue}>{header?.tipe === 'RI' ? 'Rawat Inap' : 'Rawat Jalan'}{header?.los ? ` (${header.los})` : ''}</div>
                  </div>
                  <div style={grRow(inacbgUngroupable)}>
                    <div style={grLabel(inacbgUngroupable)}>Group</div>
                    <div style={{ ...grValue, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{inacbgResult.cbg?.description} <span style={{ color: '#6b7280' }}>({inacbgResult.cbg?.code})</span></span>
                      {inacbgResult.tariff != null && <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>Rp {Number(inacbgResult.tariff).toLocaleString('id-ID')}</span>}
                    </div>
                  </div>

                  {/* Dialyzer/Kantong Darah/Alteplase — BUKAN bagian Data
                      Klinis (Step 2) krn kondisi munculnya (kode CBG N-3-15-0
                      / G-4-14-*) baru diketahui SESUDAH grouping INACBG,
                      persis posisinya di tampilan resmi (muncul sbg baris
                      tambahan di hasil grouping, sebelum Total Klaim/Final). */}
                  {showDialyzerKantong && (
                    <>
                      <div style={grRow(inacbgUngroupable)}>
                        <div style={grLabel(inacbgUngroupable)}>Penggunaan Dialyzer</div>
                        <div style={{ ...grValue, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="radio" disabled={stage !== 'inacbg_grouped'} checked={!dataKlinis.dializer_single_use} onChange={() => setDK('dializer_single_use', false)} /> Multiple Use (reuse)
                          </label>
                          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="radio" disabled={stage !== 'inacbg_grouped'} checked={dataKlinis.dializer_single_use} onChange={() => setDK('dializer_single_use', true)} /> Single Use
                          </label>
                        </div>
                      </div>
                      <div style={grRow(inacbgUngroupable)}>
                        <div style={grLabel(inacbgUngroupable)}>Transfusi Darah</div>
                        <div style={{ ...grValue, display: 'flex', alignItems: 'center', gap: 6 }}>
                          Jumlah kantong darah:
                          <input type="number" disabled={stage !== 'inacbg_grouped'} style={dkNumInput} value={dataKlinis.kantong_darah} onChange={(e) => setDK('kantong_darah', e.target.value)} />
                          kantong
                        </div>
                      </div>
                    </>
                  )}
                  {showAlteplase && (
                    <div style={grRow(inacbgUngroupable)}>
                      <div style={grLabel(inacbgUngroupable)}>Pemberian Alteplase</div>
                      <div style={{ ...grValue, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="radio" disabled={stage !== 'inacbg_grouped'} checked={!dataKlinis.alteplase_ind} onChange={() => setDK('alteplase_ind', false)} /> Tidak diberikan
                        </label>
                        <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="radio" disabled={stage !== 'inacbg_grouped'} checked={dataKlinis.alteplase_ind} onChange={() => setDK('alteplase_ind', true)} /> Diberikan
                        </label>
                      </div>
                    </div>
                  )}

                  {inacbgResult.tariff != null && (
                    <div style={grRow(inacbgUngroupable)}>
                      <div style={grLabel(inacbgUngroupable)}>Total Klaim</div>
                      <div style={{ ...grValue, fontWeight: 700, fontSize: 13.5 }}>Rp {Number(inacbgResult.tariff).toLocaleString('id-ID')}</div>
                    </div>
                  )}
                  <div style={grRow(inacbgUngroupable)}>
                    <div style={grLabel(inacbgUngroupable)}>Status</div>
                    <div style={{ ...grValue, fontWeight: 600, color: inacbgResult.status_cd === 'final' ? '#16a34a' : '#374151' }}>{inacbgResult.status_cd || '-'}</div>
                  </div>
                  {inacbgUngroupable && (
                    <div style={{ padding: '8px 10px', color: '#991b1b', fontWeight: 600, fontSize: 12, borderTop: '1px solid #fecaca' }}>
                      Ungroupable — tidak bisa lanjut Final INACBG.
                    </div>
                  )}

                  {Array.isArray(inacbgResult.special_cmg_option) && inacbgResult.special_cmg_option.length > 0 && stage === 'inacbg_grouped' && (
                    <div style={{ padding: '8px 10px', borderTop: '1px solid #bbf7d0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select style={{ ...gInput, width: 240 }} value={inacbgCmgPick} onChange={(e) => setInacbgCmgPick(e.target.value)}>
                        <option value="">— pilih special CMG —</option>
                        {inacbgResult.special_cmg_option.map((t: any) => (
                          <option key={t.code} value={t.code}>{t.description} ({t.type})</option>
                        ))}
                      </select>
                      <button type="button" onClick={handleGroupInacbgStage2} disabled={!inacbgCmgPick || !!busy} style={!inacbgCmgPick || busy ? btnDisabled : btnSecondary}>
                        Terapkan CMG (Stage 2)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {stage === 'inacbg_grouped' && !inacbgUngroupable && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" onClick={handleFinalInacbg} disabled={!!busy} style={busy === 'inacbg-final' ? btnDisabled : btnPrimary}>
                    {busy === 'inacbg-final' ? 'Memproses...' : 'Final INACBG'}
                  </button>
                </div>
              )}
              {stage === 'inacbg_final' && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" onClick={handleEditUlangInacbg} disabled={!!busy} style={busy === 'inacbg-reedit' ? btnDisabled : btnSecondary}>
                    Edit Ulang INACBG
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5+6 digabung — Finalisasi Klaim (method #20) sekarang jadi
              bagian dari box "Kirim & Cetak Klaim" (bukan box terpisah lagi),
              krn fungsinya memang cuma langkah awal sebelum kirim/cetak.
              Status box + tombol aksi dibuat sepadan tampilan resmi
              192.168.1.10/E-Klaim (box "Status Klaim" di atas, Cetak Klaim/
              Kirim Klaim Online rata kiri, Edit Ulang Klaim rata kanan
              sebaris). */}
          {(stage === 'inacbg_final' || stage === 'klaim_final') && (
            <div style={stageStyle}>
              <div style={stageTitle}>Status Klaim</div>

              {stage === 'inacbg_final' ? (
                <button type="button" onClick={handleFinalKlaim} disabled={!!busy} style={busy === 'klaim-final' ? btnDisabled : btnPrimary}>
                  {busy === 'klaim-final' ? 'Memproses...' : 'Final Klaim'}
                </button>
              ) : (
                <>
                  <div style={{ marginBottom: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex' }}>
                      <div style={{ flex: 1, padding: '6px 10px', fontSize: 12.5, color: '#6b7280' }}>Status Klaim</div>
                      <div style={{ flex: 2, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: '#111827' }}>
                        {klaimStatusCd === 'final' ? 'Final' : klaimStatusCd === 'normal' ? 'Normal' : (klaimStatusCd || '-')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ flex: 1, padding: '6px 10px', fontSize: 12.5, color: '#6b7280' }}>Status DC Kemkes</div>
                      <div style={{ flex: 2, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: '#111827' }}>
                        {dcKemkesStatusCd === 'sent' ? 'Terkirim' : dcKemkesStatusCd === 'unsent' ? 'Belum Terkirim' : (dcKemkesStatusCd || '-')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={handleCetakKlaim} disabled={!!busy} style={busy === 'cetak' ? btnDisabled : btnSecondary}>
                        {busy === 'cetak' ? 'Menyiapkan...' : 'Cetak Klaim'}
                      </button>
                      <button type="button" onClick={handleKirimKlaim} disabled={!!busy} style={busy === 'kirim' ? btnDisabled : btnPrimary}>
                        {busy === 'kirim' ? 'Mengirim...' : 'Kirim Klaim Online'}
                      </button>
                    </div>
                    <button type="button" onClick={handleEditUlangKlaim} disabled={!!busy} style={busy === 'klaim-reedit' ? btnDisabled : btnSecondary}>
                      Edit Ulang Klaim
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

type Section = 'grouping' | 'berkas-klaim';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'berkas-klaim', label: 'Berkas Klaim' },
  { key: 'grouping', label: 'Grouping' },
];

type Props = { noRawat: string; onBack: () => void };

export const GroupingInacbgView: React.FC<Props> = ({ noRawat, onBack }) => {
  const [data, setData] = React.useState<GroupingHeader | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<Section>('berkas-klaim');
  // Nama coder yg lagi aktif — resolve sama persis dgn logika Coder NIK di
  // GroupingFormView (NIP user login dicocokkan ke inacbg_coder_nik,
  // fallback coder pertama), ditampilkan di sini sbg indikator "petugas
  // yg mengerjakan", bukan lagi field "Petugas" placeholder ("INACBG") yg
  // sebelumnya hardcode di backend.
  const [coderName, setCoderName] = React.useState('');
  const [showBilling, setShowBilling] = React.useState(false);
  const [showSepPrint, setShowSepPrint] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/casemix/grouping-inacbg/${encodeURIComponent(noRawat)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal memuat data kunjungan');
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [noRawat]);

  React.useEffect(() => {
    fetch('/api/bridging/eklaim/coder-nik/list')
      .then((r) => r.json())
      .then((d) => {
        const list: { nik: string; nama: string }[] = Array.isArray(d) ? d : [];
        if (list.length === 0) return;
        let myNip = '';
        try {
          const stored = sessionStorage.getItem('ermapp_user');
          if (stored) myNip = JSON.parse(stored)?.nip || '';
        } catch { /* fallback ke coder pertama */ }
        setCoderName((list.find((c) => c.nik === myNip) || list[0]).nama);
      })
      .catch(() => {});
  }, []);

  // Full-bleed: strip putih di atas (tombol × + 3 kolom header) nempel
  // langsung ke tepi layar (tanpa card/shadow/rounded), garis pemisah
  // tipis, lalu badan abu-abu mengisi sisa layar — persis mockup yang
  // diminta (bukan lagi kartu putih dgn padding di semua sisi).
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#eeeeee', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar: kolom-kolom data (scroll horizontal sendiri kalau sempit,
          flex:1 minWidth:0) di kiri, nama coder + tombol Tutup di kanan
          dlm area TERPISAH yg flexShrink:0 — jadi selalu terlihat, tidak
          pernah ikut ter-scroll/terdorong keluar layar. */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 32, padding: '10px 12px 12px 24px', flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {loading && <span style={{ color: '#6b7280', fontSize: 13, flexShrink: 0 }}>Memuat...</span>}
          {error && <span style={{ color: '#dc2626', fontSize: 13, flexShrink: 0 }}>{error}</span>}
          {data && (
            <>
              <div style={{ minWidth: 240, flexShrink: 0 }}>
                <ColumnTitle icon={<IconUser />} iconBg="#dbeafe" iconColor="#2563eb">Data Pasien</ColumnTitle>
                <HeaderField label="No.Rawat" value={data.no_rawat} />
                <HeaderField label="No.RM" value={data.no_rm} />
                <HeaderField label="Nama Pasien" value={data.nm_pasien} />
                <HeaderField label="Umur" value={data.umur} />
                <HeaderField label="Jenis Kelamin" value={data.jk} />
                <HeaderField label="Alamat Pasien" value={data.alamat} />
                <HeaderField label="Berat Lahir" value={data.berat_lahir} />
              </div>
              <div style={{ minWidth: 240, flexShrink: 0 }}>
                <ColumnTitle icon={<IconCalendar />} iconBg="#dcfce7" iconColor="#16a34a">Data Registrasi</ColumnTitle>
                <HeaderField label="Tgl.Registrasi" value={data.tgl_registrasi} />
                <HeaderField label="Tgl.Pulang" value={data.tanggal_pulang} />
                <HeaderField label="Poliklinik" value={data.poliklinik} />
                <HeaderField label="DPJP" value={data.dpjp} />
                <HeaderField label="Status" value={data.status} />
                <HeaderField label="Kelas Hak" value={data.kelas_hak} />
                <HeaderField label="Cara Masuk" value={data.cara_masuk} />
              </div>
              <div style={{ minWidth: 260, flexShrink: 0 }}>
                <ColumnTitle icon={<IconClipboard />} iconBg="#fef3c7" iconColor="#d97706">Data Kunjungan</ColumnTitle>
                <HeaderField
                  label="No SEP"
                  value={data.no_sep ? (
                    <>
                      <button
                        type="button" onClick={() => setShowSepPrint(true)}
                        style={{ padding: '2px 10px', borderRadius: 2, border: '1px solid #16a34a', background: '#fff', color: '#16a34a', fontSize: 12, fontWeight: 400, cursor: 'pointer' }}
                      >
                        {data.no_sep}
                      </button>
                      {data.tipe ? ` (${data.tipe})` : ''}
                    </>
                  ) : data.no_sep}
                />
                <HeaderField label="No. Kartu" value={data.no_kartu} />
                <HeaderField label="CBG" value={data.cbg} />
                <HeaderField label="COB" value={data.cob} />
                <HeaderField label="Dx. Utama" value={data.dx_utama} accent />
                <HeaderField label="Pros. Utama" value={data.pros_utama} accent />
              </div>
              <div style={{ minWidth: 200, flexShrink: 0 }}>
                <ColumnTitle icon={<IconShield />} iconBg="#ede9fe" iconColor="#7c3aed">Info Klaim</ColumnTitle>
                <HeaderField label="Naik Kelas" value={data.naik_kelas} />
                <HeaderField label="Rawat Intensif" value={data.ada_rawat_intensif} />
                <HeaderField label="LOS" value={data.los} />
                <HeaderField label="ADL Score" value={data.adl_score} />
                <HeaderField label="Cara Pulang" value={data.cara_pulang} />
                <HeaderField label="Jenis Tarif" value={data.jenis_tarif} />
                <HeaderField label="Pasien TB" value={data.pasien_tb} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px 12px 12px', flexShrink: 0 }}>
          {coderName && <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>{coderName}</span>}
          <CloseBtn onClick={onBack} />
        </div>
        </div>
      </div>

      {showBilling && data && (
        <ModalBilling noRawat={noRawat} namaPasien={data.nm_pasien} jaminan={data.jaminan} onClose={() => setShowBilling(false)} />
      )}

      {showSepPrint && (
        <SepPrintView noRawat={noRawat} onClose={() => setShowSepPrint(false)} />
      )}

      {data && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {SECTIONS.map((s, i) => {
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  style={{
                    padding: '7px 16px', borderRadius: 0, border: '1px solid #d1d5db',
                    background: active ? '#2563eb' : '#ffffff', color: active ? '#ffffff' : '#374151',
                    borderColor: active ? '#2563eb' : '#d1d5db',
                    fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: 'pointer',
                    marginLeft: i === 0 ? 0 : -1,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <button
            type="button" onClick={() => setShowBilling(true)}
            style={{ padding: '7px 16px', borderRadius: 0, border: 'none', background: '#000000', color: '#ffffff', fontSize: 12.5, fontWeight: 400, cursor: 'pointer' }}
          >
            Billing
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {section === 'grouping' ? (
          // Khusus form Grouping — dibungkus card putih (bukan langsung di
          // atas BG abu-abu spt Berkas Klaim), formnya lebih enak dibaca
          // dgn batas jelas krn banyak input berdempetan.
          <div style={{ padding: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 0, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <GroupingFormView noRawat={noRawat} header={data} />
            </div>
          </div>
        ) : (
          <BerkasKlaimGabungView noRawat={noRawat} />
        )}
      </div>
    </div>
  );
};

const CloseBtn: React.FC<{ onClick: () => void; style?: React.CSSProperties }> = ({ onClick, style }) => (
  <button
    type="button"
    onClick={onClick}
    title="Tutup"
    style={{
      width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
      background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b7280', cursor: 'pointer', padding: 0, flexShrink: 0,
      ...style,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  </button>
);
