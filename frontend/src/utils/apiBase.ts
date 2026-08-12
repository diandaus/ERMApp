// Dipakai HANYA saat build utk APK Capacitor (env VITE_API_BASE_URL diisi
// lewat `npm run build:capacitor`, lihat package.json). App yg dibundel jadi
// APK dijalankan dari origin lokal WebView-nya sendiri (bukan origin server
// ERMApp), jadi semua path relatif ('/api/...', '/uploads/...') yang tadinya
// otomatis resolve ke server yg sama (kasus web biasa: dev proxy Vite atau
// satu origin Apache) HARUS diarahkan eksplisit ke alamat backend
// sesungguhnya. Kosong di build web biasa -> tidak mengubah perilaku apa pun.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Dipakai utk src gambar yg datang dari respons backend (foto profil, foto
// Lapor IT, dll) yg formatnya path relatif ("/uploads/xxx.jpg").
export function mediaUrl(path: string): string {
  if (!path || !API_BASE || /^(https?:|data:|blob:)/i.test(path)) return path;
  return API_BASE + path;
}

// Patch window.fetch supaya request ke path relatif ('/api/...', dll) ikut
// diarahkan ke API_BASE — dipanggil sekali di main.tsx sebelum render,
// menjangkau SEMUA pemanggilan fetch() di seluruh app (LoginView, Presensi
// Mobile, dst) tanpa perlu ubah tiap titik panggil satu-satu.
export function patchFetchForCapacitor(): void {
  if (!API_BASE) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      return originalFetch(API_BASE + input, init);
    }
    return originalFetch(input, init);
  };
}
