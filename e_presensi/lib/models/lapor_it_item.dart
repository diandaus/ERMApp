/// Padanan LaporItRow di backend/lapor_it_handler.go.
class LaporItItem {
  final int id;
  final String kategori;
  final String lokasi;
  final String judul;
  final String deskripsi;
  final String foto;
  final String status; // menunggu | diproses | selesai | ditolak
  final String catatanPenyelesaian;
  final String ditanganiOleh;
  final String createdAt;

  LaporItItem({
    required this.id,
    required this.kategori,
    required this.lokasi,
    required this.judul,
    required this.deskripsi,
    required this.foto,
    required this.status,
    required this.catatanPenyelesaian,
    required this.ditanganiOleh,
    required this.createdAt,
  });

  factory LaporItItem.fromJson(Map<String, dynamic> json) {
    return LaporItItem(
      id: json['id'] as int? ?? 0,
      kategori: json['kategori'] as String? ?? '',
      lokasi: json['lokasi'] as String? ?? '',
      judul: json['judul'] as String? ?? '',
      deskripsi: json['deskripsi'] as String? ?? '',
      foto: json['foto'] as String? ?? '',
      status: json['status'] as String? ?? 'menunggu',
      catatanPenyelesaian: json['catatan_penyelesaian'] as String? ?? '',
      ditanganiOleh: json['ditangani_oleh'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}
