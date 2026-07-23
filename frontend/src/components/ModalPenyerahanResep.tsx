import React from 'react';
import Swal from 'sweetalert2';
import type { ResepRalanRow } from '../modules/PermintaanResep';

// ============================================================================
// Modal "Penyerahan Resep" — padanan BtnPenyerahanActionPerformed di
// DlgDaftarPermintaanResep.java, yang di Khanza Desktop membuka jendela
// browser terpisah ke webapps/penyerahanresep/index.php?act=Kamera untuk
// ambil foto bukti serah-terima obat lewat webcam (pakai library JS lama
// `webcam.min.js`). Di sini pola yang sama direplikasi native pakai
// getUserMedia + <canvas> (tanpa dependency luar), langsung di modal —
// tidak perlu buka jendela/tab terpisah seperti Java karena semua state
// (no_resep dari row yang diklik) sudah ada di tangan React.
//
// Alur simpan: ambil foto -> upload lewat endpoint generik POST
// /api/upload (multipart) yang sudah ada -> hasil URL-nya dikirim ke
// POST /api/permintaan-resep/penyerahan (lihat
// backend/permintaan_resep_penyerahan_handler.go) yang insert ke
// bukti_penyerahan_resep_obat + update resep_obat.tgl_penyerahan/
// jam_penyerahan — hasil akhir identik dengan storeImage.php Java.
// ============================================================================

type ModalPenyerahanResepProps = {
  resep: ResepRalanRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalPenyerahanResep: React.FC<ModalPenyerahanResepProps> = ({ resep, onClose, onSaved }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState('');
  const [capturedUrl, setCapturedUrl] = React.useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = React.useState<Blob | null>(null);
  const [saving, setSaving] = React.useState(false);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!resep) return;
    setCameraError('');
    setCapturedUrl(null);
    setCapturedBlob(null);

    navigator.mediaDevices?.getUserMedia({ video: { width: 490, height: 390 } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setCameraError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan, atau unggah foto secara manual di bawah.');
      });

    return () => stopCamera();
  }, [resep, stopCamera]);

  if (!resep) return null;

  const handleAmbilFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 490;
    canvas.height = video.videoHeight || 390;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handleAmbilUlang = () => {
    setCapturedUrl(null);
    setCapturedBlob(null);
    navigator.mediaDevices?.getUserMedia({ video: { width: 490, height: 390 } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan, atau unggah foto secara manual di bawah.'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedBlob(file);
    setCapturedUrl(URL.createObjectURL(file));
    stopCamera();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleSimpan = async () => {
    if (!capturedBlob) {
      Swal.fire({ icon: 'warning', title: 'Ambil atau unggah foto dulu' });
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', capturedBlob, `penyerahan_${resep.no_resep}.jpg`);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Gagal mengunggah foto');

      const res = await fetch('/api/permintaan-resep/penyerahan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_resep: resep.no_resep, photo: uploadData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penyerahan');

      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Penyerahan resep tersimpan', timer: 2500, showConfirmButton: false });
      onSaved();
      handleClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={handleClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 540, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Penyerahan Resep Obat Rawat Jalan</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
          No. Resep {resep.no_resep} — {resep.nm_pasien} ({resep.no_rkm_medis})
        </div>

        <div style={{ borderRadius: 12, overflow: 'hidden', background: '#111827', width: '100%', aspectRatio: '490 / 390', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {capturedUrl ? (
            <img src={capturedUrl} alt="Bukti penyerahan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : cameraError ? (
            <div style={{ color: '#fca5a5', fontSize: 12.5, textAlign: 'center', padding: 20 }}>{cameraError}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!capturedUrl && cameraError && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Unggah foto manual</label>
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ fontSize: 12.5 }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div>
            {!capturedUrl && !cameraError && (
              <button
                type="button"
                onClick={handleAmbilFoto}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Ambil Foto
              </button>
            )}
            {capturedUrl && (
              <button
                type="button"
                onClick={handleAmbilUlang}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Ambil Ulang
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSimpan}
              disabled={saving || !capturedBlob}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (saving || !capturedBlob) ? '#9ca3af' : '#059669', color: '#fff', cursor: (saving || !capturedBlob) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
