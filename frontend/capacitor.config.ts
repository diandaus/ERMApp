import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rsislamibnusinasigli.ermapp',
  appName: 'ERMApp Presensi',
  webDir: 'dist',
  // Backend server (192.168.0.100:8080, lihat VITE_API_BASE_URL di
  // package.json > build:capacitor) masih HTTP biasa, bukan HTTPS — Android
  // 9+ blokir traffic cleartext by default, jadi harus diizinkan eksplisit.
  // App tetap "secure context" utk kamera/GPS krn origin WebView-nya
  // sendiri (localhost via Capacitor) dianggap aman, terlepas dari skema
  // yang dipakai fetch() ke backend.
  server: {
    cleartext: true,
    // Default Capacitor = "https" -> app sendiri jalan dari origin
    // https://localhost, sementara backend masih http://192.168.0.100:8080.
    // Kombinasi ini kena blokir "mixed content" oleh WebView (halaman HTTPS
    // fetch ke HTTP) TERLEPAS dari izin cleartext di atas — beda lapisan
    // proteksi. Disamakan ke "http" supaya originnya http://localhost, yang
    // tetap dianggap secure context (loopback dikecualikan dari aturan itu),
    // jadi kamera/GPS tetap jalan tanpa kena blokir mixed-content ke backend.
    androidScheme: 'http',
  },
};

export default config;
