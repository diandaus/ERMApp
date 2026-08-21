/// Padanan JadwalHarianRow di backend/presensi_handler.go — satu baris
/// per tanggal dalam sebulan. shift kosong = libur/belum ada jadwal.
class JadwalRow {
  final String tanggal; // "YYYY-MM-DD"
  final String shift;
  final String jamMasuk; // "HH:MM:SS"
  final String jamPulang;
  // Nama hari libur (Kalender Libur Otomatis, mis. "Maulid Nabi Muhammad
  // SAW") kalau tanggal ini hari libur nasional/cuti bersama/perusahaan,
  // kosong kalau bukan — murni informasi "tanggal merah", TIDAK berarti
  // shift-nya otomatis kosong (staf shift/rotasi bisa saja tetap ada
  // jadwal di hari libur, lihat getJadwalTetap di backend).
  final String keteranganLibur;

  JadwalRow({
    required this.tanggal,
    required this.shift,
    required this.jamMasuk,
    required this.jamPulang,
    this.keteranganLibur = '',
  });

  factory JadwalRow.fromJson(Map<String, dynamic> json) {
    return JadwalRow(
      tanggal: json['tanggal'] as String? ?? '',
      shift: json['shift'] as String? ?? '',
      jamMasuk: json['jam_masuk'] as String? ?? '',
      jamPulang: json['jam_pulang'] as String? ?? '',
      keteranganLibur: json['keterangan_libur'] as String? ?? '',
    );
  }

  bool get adaJadwal => shift.isNotEmpty;
  bool get isTanggalMerah => keteranganLibur.isNotEmpty;
}
