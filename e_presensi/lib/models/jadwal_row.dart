/// Padanan JadwalHarianRow di backend/presensi_handler.go — satu baris
/// per tanggal dalam sebulan. shift kosong = libur/belum ada jadwal.
class JadwalRow {
  final String tanggal; // "YYYY-MM-DD"
  final String shift;
  final String jamMasuk; // "HH:MM:SS"
  final String jamPulang;

  JadwalRow({required this.tanggal, required this.shift, required this.jamMasuk, required this.jamPulang});

  factory JadwalRow.fromJson(Map<String, dynamic> json) {
    return JadwalRow(
      tanggal: json['tanggal'] as String? ?? '',
      shift: json['shift'] as String? ?? '',
      jamMasuk: json['jam_masuk'] as String? ?? '',
      jamPulang: json['jam_pulang'] as String? ?? '',
    );
  }

  bool get adaJadwal => shift.isNotEmpty;
}
