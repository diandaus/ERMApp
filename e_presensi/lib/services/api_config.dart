/// Base URL backend ERMApp (Go, sama persis dgn yg dipakai versi web —
/// tidak ada endpoint baru, semua di /api/presensi/*, /api/auth/*, dst
/// sudah ada & dipakai apa adanya).
///
/// Dipakai domain publik (bukan IP), karena domain ini sudah di-setup
/// split-horizon DNS (lihat deploy/cloudflared/ + deploy/ermapp.conf di
/// repo ERMApp/backend) — otomatis resolve ke server internal RS kalau
/// HP terhubung ke wifi RS, atau lewat Cloudflare Tunnel kalau di luar
/// RS. Jadi APK ini juga otomatis "tahu" jaringan mana yg dipakai, sama
/// seperti versi web, tanpa perlu app ganti alamat manual.
const String kApiBaseUrl = 'https://presensi.rsislamibnusinasigli.com';

/// pegawai.photo kadang masih berisi path legacy dari sistem desktop lama
/// (mis. "pages/pegawai/photo/xxx.jpg", tanpa slash awal) — itu BUKAN URL
/// yang bisa diakses backend ini, cuma path relatif sisa data lama.
/// Foto yang benar-benar baru diupload lewat app ini selalu berupa path
/// hasil /api/upload yang diawali "/uploads/". Jadi apapun selain itu
/// dianggap "belum ada foto" (null) supaya UI jatuh ke fallback inisial,
/// bukan coba nge-load URL yang jelas rusak.
String? resolvePhotoUrl(String? photo) {
  if (photo == null || photo.isEmpty || !photo.startsWith('/')) return null;
  return '$kApiBaseUrl$photo';
}
