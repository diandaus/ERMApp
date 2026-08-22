import React from 'react';
import Swal from 'sweetalert2';
import * as qz from 'qz-tray';

// ============================================================================
// Pengaturan Printer Etiket Obat — pakai QZ Tray (aplikasi lokal di komputer
// apotek/kasir, https://qz.io) supaya nanti cetak etiket bisa langsung ke
// printer tanpa dialog pilih printer sama sekali. Browser TIDAK punya API
// standar utk daftar printer terpasang / cetak diam-diam — QZ Tray-lah yang
// menyediakan itu lewat koneksi WebSocket lokal (wss://localhost:8181 dst).
//
// PENTING: nama printer disimpan di localStorage (per-perangkat), BUKAN
// database backend — QZ Tray cuma bisa lihat printer yang terpasang di
// komputer itu sendiri, jadi kalau disimpan system-wide di DB, komputer lain
// dengan nama printer berbeda akan salah kirim print job. Tiap komputer
// apotek yang dipakai cetak etiket perlu diatur sendiri-sendiri sekali di sini.
//
// Koneksi QZ Tray di sini masih mode "unsigned" (belum pasang sertifikat
// digital) — QZ Tray akan tampilkan dialog "izinkan koneksi tidak
// terverifikasi" SEKALI per sesi di komputer itu. Utk cetak yang BENAR-BENAR
// tanpa dialog apapun (termasuk dialog trust QZ Tray ini), perlu setup
// sertifikat+signing (qz.security.setCertificatePromise/setSignaturePromise)
// nanti saat fitur cetak etiket beneran dibangun — di luar cakupan tab ini.
// ============================================================================

const STORAGE_KEY = 'ermapp_apotek_printer_etiket';

type ConnStatus = 'checking' | 'connected' | 'disconnected';

export const ApotekPengaturanPrinterView: React.FC = () => {
  const [status, setStatus] = React.useState<ConnStatus>('checking');
  const [printerList, setPrinterList] = React.useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = React.useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [savedPrinter, setSavedPrinter] = React.useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [connecting, setConnecting] = React.useState(false);
  const [loadingPrinters, setLoadingPrinters] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const loadPrinters = React.useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const result = await qz.printers.find();
      const list = Array.isArray(result) ? result : [result];
      setPrinterList(list.filter(Boolean));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal mengambil daftar printer', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  const connect = React.useCallback(async () => {
    if (qz.websocket.isActive()) {
      setStatus('connected');
      await loadPrinters();
      return;
    }
    setConnecting(true);
    setStatus('checking');
    try {
      await qz.websocket.connect();
      setStatus('connected');
      await loadPrinters();
    } catch {
      setStatus('disconnected');
    } finally {
      setConnecting(false);
    }
  }, [loadPrinters]);

  React.useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!selectedPrinter) {
      Swal.fire({ icon: 'warning', title: 'Pilih printer terlebih dahulu' });
      return;
    }
    localStorage.setItem(STORAGE_KEY, selectedPrinter);
    setSavedPrinter(selectedPrinter);
    Swal.fire({ icon: 'success', title: 'Tersimpan', text: `Printer etiket obat di komputer ini diatur ke "${selectedPrinter}"`, timer: 2000, showConfirmButton: false });
  };

  const handleHapus = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedPrinter('');
    setSelectedPrinter('');
    Swal.fire({ icon: 'success', title: 'Pengaturan dihapus', timer: 1500, showConfirmButton: false });
  };

  const handleTestPrint = async () => {
    if (!savedPrinter) {
      Swal.fire({ icon: 'warning', title: 'Simpan pilihan printer dulu sebelum test print' });
      return;
    }
    setTesting(true);
    try {
      const config = qz.configs.create(savedPrinter);
      await qz.print(config, [
        {
          type: 'html',
          format: 'plain',
          data: `
            <div style="width:5cm;padding:4px;font-family:sans-serif;font-size:10px;border:1px solid #000;">
              <strong>TEST PRINT — ETIKET OBAT</strong><br/>
              Printer: ${savedPrinter}<br/>
              Ini cuma tes koneksi, bukan etiket sungguhan.
            </div>
          `,
        },
      ]);
      Swal.fire({ icon: 'success', title: 'Test print terkirim', text: 'Cek hasil cetakan di printer.', timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal test print', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 620 }}>
      <div style={{ fontSize: 12.5, color: '#6b7280' }}>
        Atur printer khusus etiket obat di komputer ini lewat <strong>QZ Tray</strong> — nanti tombol cetak etiket obat akan langsung
        kirim ke printer ini tanpa perlu pilih printer lagi. Pengaturan ini <strong>khusus komputer/browser ini saja</strong>, tidak
        berlaku otomatis di komputer lain (tiap komputer apotek yang dipakai cetak etiket perlu diatur sendiri-sendiri).
      </div>

      {/* Status koneksi QZ Tray */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
          background: status === 'connected' ? '#ecfdf5' : status === 'checking' ? '#f9fafb' : '#fef2f2',
          border: `1px solid ${status === 'connected' ? '#a7f3d0' : status === 'checking' ? '#e5e7eb' : '#fecaca'}`,
        }}
      >
        <span
          style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: status === 'connected' ? '#059669' : status === 'checking' ? '#9ca3af' : '#dc2626',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: status === 'connected' ? '#065f46' : status === 'checking' ? '#374151' : '#991b1b' }}>
            {status === 'connected' ? 'QZ Tray Terhubung' : status === 'checking' ? 'Memeriksa koneksi QZ Tray...' : 'QZ Tray Tidak Terhubung'}
          </div>
          {status === 'disconnected' && (
            <div style={{ fontSize: 11.5, color: '#7f1d1d', marginTop: 2 }}>
              Pastikan aplikasi QZ Tray sudah terpasang &amp; berjalan di komputer ini. Belum punya? Unduh gratis di{' '}
              <a href="https://qz.io/download/" target="_blank" rel="noreferrer" style={{ color: '#991b1b', textDecoration: 'underline' }}>qz.io/download</a>.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: connecting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {connecting ? 'Menghubungkan...' : 'Coba Lagi'}
        </button>
      </div>

      {/* Pilih printer */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Printer utk Etiket Obat</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            disabled={status !== 'connected' || loadingPrinters}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#ffffff', color: '#111827' }}
          >
            <option value="">{loadingPrinters ? 'Memuat daftar printer...' : '- Pilih Printer -'}</option>
            {printerList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={status !== 'connected'}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: status !== 'connected' ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            Simpan
          </button>
        </div>
        {status === 'connected' && printerList.length === 0 && !loadingPrinters && (
          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 4 }}>Tidak ada printer terdeteksi di komputer ini.</div>
        )}
      </div>

      {/* Ringkasan printer tersimpan */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', padding: 14, background: '#f9fafb' }}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Printer Etiket Obat Saat Ini</div>
        {savedPrinter ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{savedPrinter}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={testing || status !== 'connected'}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: testing || status !== 'connected' ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                {testing ? 'Mencetak...' : 'Test Print'}
              </button>
              <button
                type="button"
                onClick={handleHapus}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Belum diatur</div>
        )}
      </div>
    </div>
  );
};
