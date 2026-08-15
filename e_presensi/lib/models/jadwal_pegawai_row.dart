/// Padanan JadwalPegawaiRow di backend/jadwal_pegawai_handler.go — satu
/// baris pegawai utk checklist "Atur Jadwal". `h` = shift per tanggal
/// 1-31 bulan berjalan (dari grid jadwal_pegawai), kosong kalau belum
/// diisi — dipakai utk tandai tanggal yg sudah ada shift lain (merah) di
/// modal kalender "Atur Tanggal Masuk".
class JadwalPegawaiRow {
  final int id;
  final String nik;
  final String nama;
  final String departemen;
  final String jadwalTetapShift;
  final String jadwalTetapHari;
  final List<String> h;

  JadwalPegawaiRow({
    required this.id,
    required this.nik,
    required this.nama,
    required this.departemen,
    required this.jadwalTetapShift,
    required this.jadwalTetapHari,
    required this.h,
  });

  factory JadwalPegawaiRow.fromJson(Map<String, dynamic> json) {
    final rawH = json['h'];
    return JadwalPegawaiRow(
      id: json['id'] as int? ?? 0,
      nik: json['nik'] as String? ?? '',
      nama: json['nama'] as String? ?? '',
      departemen: json['departemen'] as String? ?? '',
      jadwalTetapShift: json['jadwal_tetap_shift'] as String? ?? '',
      jadwalTetapHari: json['jadwal_tetap_hari'] as String? ?? '',
      h: rawH is List ? rawH.map((e) => e?.toString() ?? '').toList() : List.filled(31, ''),
    );
  }

  /// Tanggal (1-31) yg sudah punya shift apapun terisi di bulan berjalan.
  Set<int> get tanggalTerisi {
    final result = <int>{};
    for (var i = 0; i < h.length; i++) {
      if (h[i].isNotEmpty) result.add(i + 1);
    }
    return result;
  }
}
