import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // basicSsl: kamera/GPS di HP (PresensiMobile.tsx) cuma jalan di
  // secure context (HTTPS/localhost) — plugin ini bikin sertifikat
  // self-signed otomatis supaya bisa dites dari iPhone/Android lewat
  // IP LAN. Browser HP akan tampilkan peringatan "Not Private" sekali,
  // tinggal lanjutkan (tetap 100% di jaringan lokal, bukan lewat
  // pihak ketiga).
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    host: true, // bisa diakses dari IP LAN (mis. dari HP), bukan cuma localhost
    proxy: {
      '/api': 'http://localhost:8080',
      '/asuhan-medis-igd': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/radiologi': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/berkasrawat': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/labpa': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/images': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});


