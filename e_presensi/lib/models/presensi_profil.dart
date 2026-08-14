/// Padanan PresensiProfil di backend/presensi_handler.go (GET
/// /api/presensi/profil?nik=) — semua field read-only kecuali photo.
class PresensiProfil {
  final String nik;
  final String nama;
  final String noTelp;
  final String email;
  final String departemen;
  final String photo;

  PresensiProfil({
    required this.nik,
    required this.nama,
    required this.noTelp,
    required this.email,
    required this.departemen,
    required this.photo,
  });

  factory PresensiProfil.fromJson(Map<String, dynamic> json) {
    return PresensiProfil(
      nik: json['nik'] as String? ?? '',
      nama: json['nama'] as String? ?? '',
      noTelp: json['no_telp'] as String? ?? '',
      email: json['email'] as String? ?? '',
      departemen: json['departemen'] as String? ?? '',
      photo: json['photo'] as String? ?? '',
    );
  }
}
