/// Padanan persis type AppUser di frontend/src/modules/Auth.tsx (versi
/// web) — field & arti sama, supaya gampang dicocokkan kalau backend-nya
/// berubah nanti.
class AppUser {
  final int id;
  final String username;
  final String fullName;
  final String role;
  final bool isActive;
  final String allowedModules;
  final String nip;
  final String kdDokter;

  AppUser({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    required this.isActive,
    required this.allowedModules,
    required this.nip,
    required this.kdDokter,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      username: json['username'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      role: json['role'] as String? ?? '',
      isActive: json['is_active'] as bool? ?? true,
      allowedModules: json['allowed_modules'] as String? ?? '',
      nip: json['nip'] as String? ?? '',
      kdDokter: json['kd_dokter'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'full_name': fullName,
        'role': role,
        'is_active': isActive,
        'allowed_modules': allowedModules,
        'nip': nip,
        'kd_dokter': kdDokter,
      };

  /// Role dokter -> daftar pasien HARUS dikunci ke kd_dokter akun ini
  /// (di-link admin lewat Pengaturan > User di web). Kalau akun BELUM
  /// ditautkan (kd_dokter kosong), param tetap dikirim kosong ke backend
  /// (backend membedakan "param tak dikirim" vs "dikirim kosong" via
  /// c.GetQuery) supaya hasil KONSISTEN KOSONG, bukan malah bocor
  /// nampilin pasien semua dokter — padanan persis fix RawatJalan.tsx/
  /// Dashboard.tsx (frontend/src/modules) sesi sebelumnya.
  bool get isDokter => role == 'dokter';
}
