import React from 'react';
import Swal from 'sweetalert2';

type UploadTabProps = {
  patient: any;
};

type MasterBerkas = { kode: string; nama: string };
type BerkasItem = {
  no_rawat: string;
  kode: string;
  nama_berkas: string;
  lokasi_file: string;
  nama_file: string;
  ekstensi: string;
};

const ICON: Record<string, string> = {
  pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
  doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
};
function fileIcon(ext: string) { return ICON[ext] ?? '📎'; }

function isImage(ext: string) { return ['jpg','jpeg','png','gif','bmp','webp'].includes(ext); }
function isPdf(ext: string) { return ext === 'pdf'; }

export const UploadTab: React.FC<UploadTabProps> = ({ patient }) => {
  const [master, setMaster] = React.useState<MasterBerkas[]>([]);
  const [list, setList] = React.useState<BerkasItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const [selectedKode, setSelectedKode] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewExt, setPreviewExt] = React.useState('');

  const noRawat = patient.no_rawat;

  React.useEffect(() => {
    fetchMaster();
    fetchList();
  }, [noRawat]);

  const fetchMaster = async () => {
    try {
      const res = await fetch('/api/berkas-rawat/master');
      if (res.ok) setMaster(await res.json());
    } catch { /* silent */ }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/berkas-rawat/list/${encodeURIComponent(noRawat)}`);
      if (res.ok) setList(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleUpload = async () => {
    if (!selectedKode) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih jenis berkas terlebih dahulu.' });
      return;
    }
    if (!selectedFile) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih file yang akan diupload.' });
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append('no_rawat', noRawat);
    form.append('kode', selectedKode);
    form.append('file', selectedFile);

    try {
      const res = await fetch('/api/berkas-rawat/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Berkas berhasil diupload.', timer: 2000, showConfirmButton: false });
      setSelectedFile(null);
      setSelectedKode('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: BerkasItem) => {
    const result = await Swal.fire({
      title: 'Hapus Berkas?',
      text: item.nama_file,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/berkas-rawat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: item.no_rawat, kode: item.kode, lokasi_file: item.lokasi_file }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hapus gagal');
      fetchList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const berkasUrl = (lokasiFile: string) =>
    encodeURI('/berkasrawat/' + lokasiFile);

  const openPreview = (item: BerkasItem) => {
    setPreviewUrl(berkasUrl(item.lokasi_file));
    setPreviewExt(item.ekstensi);
  };

  // Group list by nama_berkas
  const grouped = list.reduce<Record<string, BerkasItem[]>>((acc, item) => {
    const key = item.nama_berkas || item.kode;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>

      {/* ── FORM UPLOAD ── */}
      <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload Berkas Digital
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        {/* Jenis Berkas */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Jenis Berkas <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={selectedKode}
            onChange={(e) => setSelectedKode(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
          >
            <option value="">-- Pilih Jenis --</option>
            {master.map(m => <option key={m.kode} value={m.kode}>{m.kode} — {m.nama}</option>)}
          </select>
        </div>

        {/* File Input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            File <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
              id="berkas-file-input"
            />
            <label
              htmlFor="berkas-file-input"
              style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff', color: selectedFile ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {selectedFile ? selectedFile.name : 'Klik untuk pilih file...'}
            </label>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>PDF, JPG, PNG, DOC, XLS</div>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{ padding: '9px 20px', background: uploading ? '#9ca3af' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {uploading ? '⏳ Uploading...' : '⬆ Upload'}
        </button>
      </div>

      {/* ── DAFTAR BERKAS ── */}
      <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        Berkas Terupload
        <button onClick={fetchList} style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', color: '#374151' }}>↻ Refresh</button>
      </h4>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Memuat berkas...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, color: '#9ca3af', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          Belum ada berkas yang diupload
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([grupNama, items]) => (
            <div key={grupNama} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#f3f4f6', fontSize: 12, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                {grupNama}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 14px', width: 28 }}>
                        <span style={{ fontSize: 18 }}>{fileIcon(item.ekstensi)}</span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#111827', fontWeight: 500 }}>
                        {item.nama_file}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {/* Lihat */}
                          {(isImage(item.ekstensi) || isPdf(item.ekstensi)) && (
                            <button
                              onClick={() => openPreview(item)}
                              style={{ padding: '5px 10px', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                            >
                              👁 Lihat
                            </button>
                          )}
                          {/* Download */}
                          <a
                            href={berkasUrl(item.lokasi_file)}
                            download={item.nama_file}
                            style={{ padding: '5px 10px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          >
                            ⬇ Unduh
                          </a>
                          {/* Hapus */}
                          <button
                            onClick={() => handleDelete(item)}
                            style={{ padding: '5px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                          >
                            🗑 Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── PREVIEW MODAL ── */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, cursor: 'zoom-out' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {isImage(previewExt) ? (
              <img src={previewUrl} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }} />
            ) : isPdf(previewExt) ? (
              <iframe src={previewUrl} style={{ width: '80vw', height: '85vh', border: 'none', borderRadius: 8, background: '#fff' }} title="Preview PDF" />
            ) : null}
          </div>
          <button
            onClick={() => setPreviewUrl(null)}
            style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 22, width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>
      )}
    </div>
  );
};
