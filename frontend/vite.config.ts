import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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


