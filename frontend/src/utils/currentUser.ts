import { safeStorage } from './safeStorage';

// readErmappUser — sesi login 'ermapp_user' disimpan di TEMPAT BEDA
// tergantung entry point: App.tsx (aplikasi desktop, mis. Apotek/
// Kepegawaian/PemeriksaanRanap — pemakai utama helper2 di file ini) pakai
// sessionStorage, sementara main-presensi.tsx (domain presensi berdiri
// sendiri) pakai localStorage (sengaja persisten, lihat komentar di
// main-presensi.tsx). Cek sessionStorage DULU (cocok utk mayoritas
// pemanggil file ini), localStorage sbg fallback — sebelumnya cuma baca
// localStorage, jadi SELALU kosong di app desktop (App.tsx malah aktif
// menghapus localStorage.ermapp_user tiap load), bikin field "Petugas"
// gagal auto-terisi dari user login sama sekali.
function readErmappUser(): Record<string, unknown> | null {
  const raw = safeStorage.get('session', 'ermapp_user') || safeStorage.get('local', 'ermapp_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Padanan akses.getkode() Java: identitas operator yang sedang login,
// dipakai sebagai "petugas" saat mencatat riwayat_barang_medis (lihat
// backend/apotek_riwayat_barang_medis.go) — BUKAN field bisnis
// "Petugas"/nip yang sudah ada di beberapa form (Penerimaan, Permintaan),
// yang punya arti berbeda (staf yang tercatat bertanggung jawab, bisa
// beda dari operator yang login).
export function getCurrentPetugas(): string {
  const user = readErmappUser() as { full_name?: string; username?: string } | null;
  return user?.full_name || user?.username || '';
}

// NIP petugas Khanza (tabel `petugas`) yang di-link ke akun login ini
// (kolom `app_users.nip`, diisi admin lewat Pengaturan > User) — dipakai
// buat auto-fill kolom "Petugas" di form klinis (mis. Adime Gizi di
// PemeriksaanRanap.tsx) berdasarkan siapa yang sedang login, tanpa perlu
// diketik/dicari manual tiap buka form. Kosong kalau akun belum di-link
// ke NIP manapun (mis. akun admin generik) — pemanggil harus tetap
// membiarkan field-nya bisa diisi manual sebagai fallback.
export function getCurrentUserNip(): string {
  const user = readErmappUser() as { nip?: string } | null;
  return user?.nip || '';
}

// Role akun yang sedang login ('admin', 'dokter', 'farmasi', dst — lihat
// Admin.tsx untuk daftar lengkap). Dipakai form yang auto-fill Petugas
// dari sesi login (getCurrentPetugas/getCurrentUserNip di atas) tapi
// perlu tetap membolehkan admin memilih petugas LAIN secara manual (mis.
// admin mengisikan form atas nama staf farmasi tertentu lewat
// ModalCariPetugas), sementara akun non-admin tetap terkunci ke
// identitasnya sendiri.
export function getCurrentUserRole(): string {
  const user = readErmappUser() as { role?: string } | null;
  return user?.role || '';
}

// canAccessFeature — cek hak akses fitur GRANULAR di dalam suatu modul (mis.
// tab "Pemeriksaan USG" di dalam Pemeriksaan.tsx), BEDA dari canAccessMenu
// di App.tsx yang menggerbang MENU LEVEL ATAS (sidebar). Reuse kolom
// app_users.allowed_modules yang SAMA (diatur admin lewat AddUserModal.tsx,
// key ditambahkan ke availableModules) — cukup daftarkan key fitur di sana
// spy admin bisa centang per-akun, tanpa perlu tabel/UI permission baru.
// Admin SELALU lolos (walau allowed_modules-nya tidak eksplisit menyebut
// key ini) — cuma role lain yang wajib di-whitelist eksplisit.
export function canAccessFeature(featureKey: string): boolean {
  const user = readErmappUser() as { role?: string; allowed_modules?: string } | null;
  if (!user) return false;
  if (user.role === 'admin') return true;
  const allowed = (user.allowed_modules || '').split(',').filter(Boolean);
  return allowed.includes(featureKey);
}
