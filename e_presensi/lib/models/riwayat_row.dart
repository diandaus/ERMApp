/// Padanan RiwayatPresensiRow di backend/presensi_handler.go — satu baris
/// riwayat presensi aktual (bukan jadwal) per tanggal.
class RiwayatRow {
  final String tanggal;
  final String shift;
  final String jamDatang;
  final String jamPulang;
  final String status;
  final String keterlambatan;
  final String durasi;
  final String fotoMasuk;
  final String fotoPulang;

  RiwayatRow({
    required this.tanggal,
    required this.shift,
    required this.jamDatang,
    required this.jamPulang,
    required this.status,
    required this.keterlambatan,
    required this.durasi,
    required this.fotoMasuk,
    required this.fotoPulang,
  });

  factory RiwayatRow.fromJson(Map<String, dynamic> json) {
    return RiwayatRow(
      tanggal: json['tanggal'] as String? ?? '',
      shift: json['shift'] as String? ?? '',
      jamDatang: json['jam_datang'] as String? ?? '',
      jamPulang: json['jam_pulang'] as String? ?? '',
      status: json['status'] as String? ?? '',
      keterlambatan: json['keterlambatan'] as String? ?? '',
      durasi: json['durasi'] as String? ?? '-',
      fotoMasuk: json['foto_masuk'] as String? ?? '',
      fotoPulang: json['foto_pulang'] as String? ?? '',
    );
  }
}
