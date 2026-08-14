/// Padanan LemburRow di backend/lembur_handler.go.
class LemburItem {
  final int id;
  final String tanggal;
  final String jamMulai;
  final String jamSelesai;
  final int durasiMenit;
  final String keterangan;
  final String status; // menunggu | disetujui | ditolak
  final String catatanApproval;
  final String disetujuiOleh;

  LemburItem({
    required this.id,
    required this.tanggal,
    required this.jamMulai,
    required this.jamSelesai,
    required this.durasiMenit,
    required this.keterangan,
    required this.status,
    required this.catatanApproval,
    required this.disetujuiOleh,
  });

  factory LemburItem.fromJson(Map<String, dynamic> json) {
    return LemburItem(
      id: json['id'] as int? ?? 0,
      tanggal: json['tanggal'] as String? ?? '',
      jamMulai: json['jam_mulai'] as String? ?? '',
      jamSelesai: json['jam_selesai'] as String? ?? '',
      durasiMenit: json['durasi_menit'] as int? ?? 0,
      keterangan: json['keterangan'] as String? ?? '',
      status: json['status'] as String? ?? 'menunggu',
      catatanApproval: json['catatan_approval'] as String? ?? '',
      disetujuiOleh: json['disetujui_oleh'] as String? ?? '',
    );
  }
}
