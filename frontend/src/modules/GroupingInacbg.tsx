import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore — worker Vite di-resolve sbg URL asset via ?url, tidak ada type declaration bawaan.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees } from 'pdf-lib';
import Swal from 'sweetalert2';

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

  const handleTambahHalaman = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const added: PdfPageItem[] = [];
    for (const file of files) {
      const localUrl = `local-${file.name}-${Date.now()}-${Math.random()}`;
      const buf = new Uint8Array(await file.arrayBuffer());
      sourceBytesRef.current.set(localUrl, buf);
      const isImage = IMAGE_EXT.includes((file.name.split('.').pop() || '').toLowerCase());
      const ekstensi = isImage ? (file.name.split('.').pop() || '').toLowerCase() : 'pdf';
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
      <div style={{ background: '#ffffff', borderRadius: 0, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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

// GroupingFormView — padanan tampilan aplikasi E-Klaim (screenshot yg
// dikirim user) utk tab "Grouping". Field yg bisa diprefill dari data yg
// SUDAH ada (bridging_sep/reg_periksa/kamar_inap/dpjp_ranap, lihat
// backend/grouping_form_handler.go) langsung terisi; field yg belum ada
// sumber datanya di skema Khanza (ADL Score, Jenis Tarif/kelas RS, Pasien
// TB, breakdown tarif per kategori) dikosongkan/0 spy staf isi manual —
// SAMA PERSIS gaya form E-Klaim aslinya (form input, bukan laporan
// otomatis). Tombol Kirim sengaja nonaktif — kirim ke E-Klaim (webservice
// terenkripsi AES-256-CBC ke server terpisah) belum diimplementasikan.
type GroupingFormData = {
  tanggal_masuk: string; tanggal_pulang: string; jaminan: string; no_sep: string; tipe: string;
  no_peserta: string; cob: boolean; jenis_rawat: 'jalan' | 'inap'; naik_kelas: boolean; kelas_hak: string;
  tgl_masuk_jam: string; tgl_pulang_jam: string; umur: string; cara_masuk: string; los: number;
  berat_lahir: string; cara_pulang: string; dpjp: string;
};

const TARIF_KOLOM: { label: string }[][] = [
  [{ label: 'Prosedur Non Bedah' }, { label: 'Tenaga Ahli' }, { label: 'Radiologi' }, { label: 'Rehabilitasi' }, { label: 'Obat' }, { label: 'Alkes' }],
  [{ label: 'Prosedur Bedah' }, { label: 'Keperawatan' }, { label: 'Laboratorium' }, { label: 'Kamar / Akomodasi' }, { label: 'Obat Kronis' }, { label: 'BMHP' }],
  [{ label: 'Konsultasi' }, { label: 'Penunjang' }, { label: 'Pelayanan Darah' }, { label: 'Rawat Intensif' }, { label: 'Obat Kemoterapi' }, { label: 'Sewa Alat' }],
];

const gLabel: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontStyle: 'italic' };
const gInput: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box' };
const gRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' };

const GroupingFormView: React.FC<{ noRawat: string }> = ({ noRawat }) => {
  const [form, setForm] = React.useState<GroupingFormData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tarif, setTarif] = React.useState<Record<string, number>>({});
  const [setuju, setSetuju] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/casemix/grouping-form/${encodeURIComponent(noRawat)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal memuat data grouping');
        setForm(d);
        setTarif({});
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [noRawat]);

  const totalTarif = Object.values(tarif).reduce((a, b) => a + (b || 0), 0);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</div>;
  if (!form) return null;

  return (
    <div style={{ padding: 20 }}>
      {/* Semua field ringkasan (Jenis Rawat, Naik/Turun Kelas, Ada Rawat
          Intensif, Kelas Hak, Tanggal Rawat, Umur, Cara Masuk, LOS, Berat
          Lahir, ADL Score, Cara Pulang, Jenis Tarif, Pasien TB) sudah
          dipindah ke kolom "Info Klaim" di header halaman — form ini
          sekarang cuma isi breakdown tarif (satu-satunya bagian yg
          memang butuh diisi manual). */}

      {/* Tarif Rumah Sakit total */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <span style={{ fontSize: 12.5, color: '#6b7280' }}>Tarif Rumah Sakit : </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Rp {totalTarif.toLocaleString('id-ID')}</span>
      </div>

      {/* Breakdown tarif — 3 kolom, semua editable default 0 spt E-Klaim asli */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px 24px', marginBottom: 16 }}>
        {TARIF_KOLOM.map((kolom, ki) => (
          <div key={ki} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kolom.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...gLabel, width: 130, flexShrink: 0 }}>{item.label}</span>
                <input
                  type="number"
                  style={{ ...gInput, width: 110 }}
                  value={tarif[item.label] ?? 0}
                  onChange={(e) => setTarif((prev) => ({ ...prev, [item.label]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#374151', marginBottom: 16 }}>
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
        Menyatakan benar bahwa data tarif yang tersebut di atas adalah benar sesuai dengan kondisi yang sesungguhnya.
      </label>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          disabled
          title="Kirim ke E-Klaim belum diimplementasikan"
          style={{ padding: '10px 28px', borderRadius: 0, border: 'none', background: '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}
        >
          Kirim (Segera Hadir)
        </button>
      </div>
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

  // Full-bleed: strip putih di atas (tombol × + 3 kolom header) nempel
  // langsung ke tepi layar (tanpa card/shadow/rounded), garis pemisah
  // tipis, lalu badan abu-abu mengisi sisa layar — persis mockup yang
  // diminta (bukan lagi kartu putih dgn padding di semua sisi).
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#eeeeee', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
            <CloseBtn onClick={onBack} />
            <span style={{ color: '#6b7280', fontSize: 13 }}>Memuat...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
            <CloseBtn onClick={onBack} />
            <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>
          </div>
        ) : data ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, padding: '10px 24px 12px', flexWrap: 'wrap' }}>
            <CloseBtn onClick={onBack} />
            <div style={{ minWidth: 240 }}>
              <ColumnTitle icon={<IconUser />} iconBg="#dbeafe" iconColor="#2563eb">Data Pasien</ColumnTitle>
              <HeaderField label="No.Rawat" value={data.no_rawat} />
              <HeaderField label="No.RM" value={data.no_rm} />
              <HeaderField label="Nama Pasien" value={data.nm_pasien} />
              <HeaderField label="Umur" value={data.umur} />
              <HeaderField label="Jenis Kelamin" value={data.jk} />
              <HeaderField label="Alamat Pasien" value={data.alamat} />
            </div>
            <div style={{ minWidth: 240 }}>
              <ColumnTitle icon={<IconCalendar />} iconBg="#dcfce7" iconColor="#16a34a">Data Registrasi</ColumnTitle>
              <HeaderField label="Tgl.Registrasi" value={data.tgl_registrasi} />
              <HeaderField label="Tgl.Pulang" value={data.tanggal_pulang} />
              <HeaderField label="Poliklinik" value={data.poliklinik} />
              <HeaderField label="DPJP" value={data.dpjp} />
              <HeaderField label="Status" value={data.status} />
              <HeaderField label="Jaminan" value={data.jaminan} />
            </div>
            <div style={{ minWidth: 260 }}>
              <ColumnTitle icon={<IconClipboard />} iconBg="#fef3c7" iconColor="#d97706">Data Kunjungan</ColumnTitle>
              <HeaderField label="No SEP" value={data.no_sep} />
              <HeaderField label="No. Kunjungan" value={data.no_kunjungan} />
              <HeaderField label="No. Kartu" value={data.no_kartu} />
              <HeaderField label="Tipe" value={data.tipe} />
              <HeaderField label="CBG" value={data.cbg} />
              <HeaderField label="Petugas" value={data.petugas} />
              <HeaderField label="Dx. Utama" value={data.dx_utama} accent />
              <HeaderField label="Pros. Utama" value={data.pros_utama} accent />
            </div>
            <div style={{ minWidth: 200 }}>
              <ColumnTitle icon={<IconShield />} iconBg="#ede9fe" iconColor="#7c3aed">Info Klaim</ColumnTitle>
              <HeaderField label="COB" value={data.cob} />
              <HeaderField label="Naik Kelas" value={data.naik_kelas} />
              <HeaderField label="Rawat Intensif" value={data.ada_rawat_intensif} />
              <HeaderField label="Kelas Hak" value={data.kelas_hak} />
              <HeaderField label="Cara Masuk" value={data.cara_masuk} />
              <HeaderField label="LOS" value={data.los} />
              <HeaderField label="Berat Lahir" value={data.berat_lahir} />
              <HeaderField label="ADL Score" value={data.adl_score} />
              <HeaderField label="Cara Pulang" value={data.cara_pulang} />
              <HeaderField label="Jenis Tarif" value={data.jenis_tarif} />
              <HeaderField label="Pasien TB" value={data.pasien_tb} />
            </div>
          </div>
        ) : null}
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 0, padding: '12px 24px', flexShrink: 0 }}>
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
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {section === 'grouping' ? (
          // Khusus form Grouping — dibungkus card putih (bukan langsung di
          // atas BG abu-abu spt Berkas Klaim), formnya lebih enak dibaca
          // dgn batas jelas krn banyak input berdempetan.
          <div style={{ padding: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 0, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <GroupingFormView noRawat={noRawat} />
            </div>
          </div>
        ) : (
          <BerkasKlaimGabungView noRawat={noRawat} />
        )}
      </div>
    </div>
  );
};

const CloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Tutup"
    style={{
      width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
      background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b7280', cursor: 'pointer', padding: 0, flexShrink: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  </button>
);
