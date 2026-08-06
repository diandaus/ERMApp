// Padanan akses.getkode() Java: identitas operator yang sedang login,
// dipakai sebagai "petugas" saat mencatat riwayat_barang_medis (lihat
// backend/apotek_riwayat_barang_medis.go) — BUKAN field bisnis
// "Petugas"/nip yang sudah ada di beberapa form (Penerimaan, Permintaan),
// yang punya arti berbeda (staf yang tercatat bertanggung jawab, bisa
// beda dari operator yang login).
export function getCurrentPetugas(): string {
  try {
    const stored = window.localStorage.getItem('ermapp_user');
    if (!stored) return '';
    const user = JSON.parse(stored) as { full_name?: string; username?: string };
    return user.full_name || user.username || '';
  } catch {
    return '';
  }
}

// NIP petugas Khanza (tabel `petugas`) yang di-link ke akun login ini
// (kolom `app_users.nip`, diisi admin lewat Pengaturan > User) — dipakai
// buat auto-fill kolom "Petugas" di form klinis (mis. Adime Gizi di
// PemeriksaanRanap.tsx) berdasarkan siapa yang sedang login, tanpa perlu
// diketik/dicari manual tiap buka form. Kosong kalau akun belum di-link
// ke NIP manapun (mis. akun admin generik) — pemanggil harus tetap
// membiarkan field-nya bisa diisi manual sebagai fallback.
export function getCurrentUserNip(): string {
  try {
    const stored = window.localStorage.getItem('ermapp_user');
    if (!stored) return '';
    const user = JSON.parse(stored) as { nip?: string };
    return user.nip || '';
  } catch {
    return '';
  }
}

// Role akun yang sedang login ('admin', 'dokter', 'farmasi', dst — lihat
// Admin.tsx untuk daftar lengkap). Dipakai form yang auto-fill Petugas
// dari sesi login (getCurrentPetugas/getCurrentUserNip di atas) tapi
// perlu tetap membolehkan admin memilih petugas LAIN secara manual (mis.
// admin mengisikan form atas nama staf farmasi tertentu lewat
// ModalCariPetugas), sementara akun non-admin tetap terkunci ke
// identitasnya sendiri.
export function getCurrentUserRole(): string {
  try {
    const stored = window.localStorage.getItem('ermapp_user');
    if (!stored) return '';
    const user = JSON.parse(stored) as { role?: string };
    return user.role || '';
  } catch {
    return '';
  }
}
