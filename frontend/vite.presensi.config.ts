import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import basicSsl from '@vitejs/plugin-basic-ssl';

// vite.presensi.config.ts — build TERPISAH khusus PresensiMobile.tsx
// (entry: index-presensi.html / src/main-presensi.tsx), dideploy ke
// presensi.rsislamibnusinasigli.com. Output ke folder BEDA (dist-presensi)
// dari build utama (vite.config.ts -> dist) supaya Apache DocumentRoot
// masing-masing domain bisa diarahkan terpisah tanpa saling menimpa.
// Jalankan: npm run build:presensi
export default defineConfig({
  plugins: [react(), basicSsl()],
  build: {
    outDir: 'dist-presensi',
    rollupOptions: {
      input: 'index-presensi.html',
    },
  },
  server: {
    port: 5174, // beda dari dev server utama (5173) spy bisa jalan bareng
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
