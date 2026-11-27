import React from 'react';
import Swal from 'sweetalert2';
import { ModalAksesTablet } from './ModalAksesTablet';

// TabletRilisTab — Pengaturan > Aplikasi Tablet: unggah APK ERM Tablet
// versi baru. Tablet mengecek GET /api/tablet/rilis/terbaru (menu
// Pengaturan > Lainnya > Pembaruan Aplikasi) dan memperbarui diri bila
// build number di server lebih besar dari miliknya.

type Rilis = {
  id: number;
  versi: string;
  build_number: number;
  catatan: string;
  url: string;
  ukuran: number;
  tanggal: string;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, color: '#111827', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' };

function formatUkuran(b: number) {
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

// Tebak versi & build dari nama file "erm_tablet_0.2.0+2.apk" / "..._0.2.0-2.apk".
function tebakVersi(nama: string): { versi: string; build: string } | null {
  const m = nama.match(/(\d+\.\d+\.\d+)[+_-](\d+)\.apk$/i);
  return m ? { versi: m[1], build: m[2] } : null;
}

export function TabletRilisTab() {
  const [list, setList] = React.useState<Rilis[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [versi, setVersi] = React.useState('');
  const [build, setBuild] = React.useState('');
  const [catatan, setCatatan] = React.useState('');
  const [progress, setProgress] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [showAkses, setShowAkses] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tablet/rilis');
      const data = await res.json();
      if (res.ok) setList(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { void load(); }, []);

  const pilihFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const t = tebakVersi(f.name);
      if (t) { setVersi(t.versi); setBuild(t.build); }
    }
  };

  const unggah = () => {
    if (!file) {
      Swal.fire({ icon: 'warning', title: 'Pilih file APK dulu', confirmButtonColor: '#2563eb' });
      return;
    }
    if (!versi.trim() || !(Number(build) > 0)) {
      Swal.fire({ icon: 'warning', title: 'Versi & build number wajib diisi', confirmButtonColor: '#2563eb' });
      return;
    }
    const fd = new FormData();
    fd.append('apk', file);
    fd.append('versi', versi.trim());
    fd.append('build_number', String(Number(build)));
    fd.append('catatan', catatan.trim());
    // XHR (bukan fetch) supaya ada progres unggah — APK ±25 MB.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/tablet/rilis');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = async () => {
      setProgress(null);
      let data: { error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* bukan JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setFile(null); setVersi(''); setBuild(''); setCatatan('');
        if (fileRef.current) fileRef.current.value = '';
        await load();
        Swal.fire({ icon: 'success', title: 'Rilis diunggah', text: 'Tablet akan menawarkan pembaruan ini.', timer: 1800, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || `Gagal unggah (${xhr.status})`, confirmButtonColor: '#2563eb' });
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Koneksi terputus saat mengunggah', confirmButtonColor: '#2563eb' });
    };
    setProgress(0);
    xhr.send(fd);
  };

  const hapus = async (r: Rilis) => {
    const ok = await Swal.fire({
      icon: 'warning', title: 'Hapus rilis ini?', text: `Versi ${r.versi} (build ${r.build_number})`,
      showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`/api/tablet/rilis/${r.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      Swal.fire({ icon: 'error', title: 'Gagal', text: d.error || 'Gagal hapus rilis', confirmButtonColor: '#2563eb' });
    }
    await load();
  };

  const terakhir = list[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" onClick={() => setShowAkses(true)}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Atur Hak Akses Tablet
        </button>
      </div>
      {showAkses && <ModalAksesTablet onClose={() => setShowAkses(false)} />}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Unggah Versi Baru ERM Tablet</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
          Build number = angka setelah "+" pada <code>version</code> di <code>erm_tablet/pubspec.yaml</code>, harus lebih besar dari rilis sebelumnya
          {terakhir ? ` (terakhir: ${terakhir.build_number})` : ''}. APK harus ditandatangani dengan kunci yang sama dengan versi terpasang.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) 140px 120px', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>File APK</label>
            <input ref={fileRef} type="file" accept=".apk" onChange={(e) => pilihFile(e.target.files?.[0] ?? null)} style={{ ...inputStyle, padding: '6px 8px' }} />
          </div>
          <div>
            <label style={labelStyle}>Versi</label>
            <input value={versi} onChange={(e) => setVersi(e.target.value)} placeholder="0.2.0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Build Number</label>
            <input value={build} onChange={(e) => setBuild(e.target.value.replace(/\D/g, ''))} placeholder="2" style={inputStyle} />
          </div>
        </div>
        <label style={labelStyle}>Catatan Rilis (ditampilkan di tablet)</label>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} placeholder="- Menu Pengaturan baru&#10;- Perbaikan ..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 12 }}>
          {progress !== null && <span style={{ fontSize: 12, color: '#6b7280' }}>Mengunggah... {progress}%</span>}
          <button
            type="button"
            onClick={unggah}
            disabled={progress !== null}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: progress !== null ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: progress !== null ? 'default' : 'pointer' }}
          >
            Unggah Rilis
          </button>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 10 }}>Riwayat Rilis</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f3f4f6', color: '#374151', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px' }}>Versi</th>
            <th style={{ padding: '10px 12px' }}>Build</th>
            <th style={{ padding: '10px 12px' }}>Catatan</th>
            <th style={{ padding: '10px 12px' }}>Ukuran</th>
            <th style={{ padding: '10px 12px' }}>Diunggah</th>
            <th style={{ padding: '10px 12px', width: 150 }} />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>{loading ? 'Memuat...' : 'Belum ada rilis'}</td></tr>
          )}
          {list.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                {r.versi}
                {i === 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>Terbaru</span>}
              </td>
              <td style={{ padding: '10px 12px' }}>{r.build_number}</td>
              <td style={{ padding: '10px 12px', whiteSpace: 'pre-line', color: '#4b5563' }}>{r.catatan || '-'}</td>
              <td style={{ padding: '10px 12px' }}>{formatUkuran(r.ukuran)}</td>
              <td style={{ padding: '10px 12px' }}>{r.tanggal}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <a href={r.url} download style={{ color: '#2563eb', fontSize: 12, marginRight: 12 }}>Unduh</a>
                <button type="button" onClick={() => void hapus(r)} style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
