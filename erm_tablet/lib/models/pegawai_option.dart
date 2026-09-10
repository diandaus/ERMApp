/// Padanan Pegawai type di ModalCariPegawai.tsx (web) — GET /api/pegawai.
class PegawaiOption {
  final String nik;
  final String nama;
  final String jbtn;
  PegawaiOption({required this.nik, required this.nama, required this.jbtn});

  factory PegawaiOption.fromJson(Map<String, dynamic> json) {
    return PegawaiOption(
      nik: json['nik'] as String? ?? '',
      nama: json['nama'] as String? ?? '',
      jbtn: json['jbtn'] as String? ?? '',
    );
  }
}
