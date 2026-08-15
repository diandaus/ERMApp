/// Padanan JamMasukOpsi di backend/jadwal_pegawai_handler.go — satu
/// opsi shift (nama + jam masuk/pulang) utk dropdown pemilihan shift.
class JamMasukOpsi {
  final String shift;
  final String jamMasuk;
  final String jamPulang;

  JamMasukOpsi({required this.shift, required this.jamMasuk, required this.jamPulang});

  factory JamMasukOpsi.fromJson(Map<String, dynamic> json) {
    return JamMasukOpsi(
      shift: json['shift'] as String? ?? '',
      jamMasuk: json['jam_masuk'] as String? ?? '',
      jamPulang: json['jam_pulang'] as String? ?? '',
    );
  }

  String get label {
    final jm = jamMasuk.length >= 5 ? jamMasuk.substring(0, 5) : jamMasuk;
    final jp = jamPulang.length >= 5 ? jamPulang.substring(0, 5) : jamPulang;
    return '$shift ($jm–$jp)';
  }
}
