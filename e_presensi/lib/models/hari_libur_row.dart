/// Padanan HariLiburRow di backend/hari_libur_handler.go — satu baris hari
/// libur (nasional/cuti bersama, disinkron dari API publik, atau libur
/// perusahaan yg ditambah manual).
class HariLiburRow {
  final int id;
  final String tanggal; // "YYYY-MM-DD"
  final String keterangan;
  final String jenis; // 'nasional' | 'cuti_bersama' | 'perusahaan'

  HariLiburRow({
    required this.id,
    required this.tanggal,
    required this.keterangan,
    required this.jenis,
  });

  factory HariLiburRow.fromJson(Map<String, dynamic> json) {
    return HariLiburRow(
      id: json['id'] as int? ?? 0,
      tanggal: json['tanggal'] as String? ?? '',
      keterangan: json['keterangan'] as String? ?? '',
      jenis: json['jenis'] as String? ?? 'perusahaan',
    );
  }
}
