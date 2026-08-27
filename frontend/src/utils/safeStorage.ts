// safeStorage.ts — pembungkus localStorage/sessionStorage yang aman dari
// exception. Akses langsung ke window.localStorage/sessionStorage bisa
// melempar SecurityError di Safari (mis. Settings > Safari > "Block All
// Cookies" aktif) — tanpa ErrorBoundary, exception yang tidak tertangkap
// di useEffect bikin SELURUH aplikasi React unmount jadi layar putih
// kosong tanpa pesan error apa pun ke user. Semua akses storage yang
// dijalankan otomatis saat aplikasi dimuat (bukan respons klik user)
// WAJIB lewat helper ini, bukan window.localStorage/sessionStorage langsung.
type Area = 'local' | 'session';

const storageOf = (area: Area): Storage => (area === 'local' ? window.localStorage : window.sessionStorage);

export const safeStorage = {
  get(area: Area, key: string): string | null {
    try {
      return storageOf(area).getItem(key);
    } catch {
      return null;
    }
  },
  set(area: Area, key: string, value: string): void {
    try {
      storageOf(area).setItem(key, value);
    } catch {
      // Storage penuh/diblokir — abaikan, jangan jatuhkan aplikasi.
    }
  },
  remove(area: Area, key: string): void {
    try {
      storageOf(area).removeItem(key);
    } catch {
      // sda.
    }
  },
};
