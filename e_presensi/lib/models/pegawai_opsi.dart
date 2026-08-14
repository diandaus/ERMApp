/// Subset field dari /api/pegawai/list — dipakai utk autocomplete
/// pencarian Penanggung Jawab Pengganti di form Cuti/Izin.
class PegawaiOpsi {
  final String nik;
  final String nama;
  PegawaiOpsi({required this.nik, required this.nama});

  factory PegawaiOpsi.fromJson(Map<String, dynamic> json) {
    return PegawaiOpsi(nik: json['nik'] as String? ?? '', nama: json['nama'] as String? ?? '');
  }
}
