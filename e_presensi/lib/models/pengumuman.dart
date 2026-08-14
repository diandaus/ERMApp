/// Padanan PengumumanRow di backend/pengumuman_handler.go.
class Pengumuman {
  final int id;
  final String judul;
  final String isi;
  final String prioritas; // info | penting | urgent
  final String tanggal;

  Pengumuman({required this.id, required this.judul, required this.isi, required this.prioritas, required this.tanggal});

  factory Pengumuman.fromJson(Map<String, dynamic> json) {
    return Pengumuman(
      id: json['id'] as int? ?? 0,
      judul: json['judul'] as String? ?? '',
      isi: json['isi'] as String? ?? '',
      prioritas: json['prioritas'] as String? ?? 'info',
      tanggal: json['tanggal'] as String? ?? '',
    );
  }
}
