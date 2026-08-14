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
