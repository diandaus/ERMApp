/// Padanan data GET /api/pemeriksaan/diagnosa/:no_rawat & /api/pemeriksaan/
/// prosedur/:no_rawat (backend/main.go getDiagnosaPasien/getProsedurPasien)
/// — endpoint generik berbasis no_rawat (bukan flavor Ralan/Ranap/IGD
/// spt Resep/Tindakan), dipakai DiagnosaTab.tsx (web, Poli/IGD; belum
/// pernah dipasang di Ranap tapi endpointnya generik jadi tetap berlaku).
class DiagnosaPasienItem {
  final String kdPenyakit;
  final String nmPenyakit;
  final String status;
  final String statusPenyakit; // "Kasus" di tabel web
  final String prioritas; // "Urut" di tabel web

  DiagnosaPasienItem({required this.kdPenyakit, required this.nmPenyakit, required this.status, required this.statusPenyakit, required this.prioritas});

  factory DiagnosaPasienItem.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key]?.toString() ?? '';
    return DiagnosaPasienItem(
      kdPenyakit: s('kd_penyakit'),
      nmPenyakit: s('nm_penyakit'),
      status: s('status'),
      statusPenyakit: s('status_penyakit'),
      prioritas: s('prioritas'),
    );
  }
}

class ProsedurPasienItem {
  final String kode;
  final String deskripsiPanjang;
  final String status;
  final String prioritas; // "Urut"
  final String jumlah; // "Jml"

  ProsedurPasienItem({required this.kode, required this.deskripsiPanjang, required this.status, required this.prioritas, required this.jumlah});

  factory ProsedurPasienItem.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key]?.toString() ?? '';
    return ProsedurPasienItem(
      kode: s('kode'),
      deskripsiPanjang: s('deskripsi_panjang'),
      status: s('status'),
      prioritas: s('prioritas'),
      jumlah: s('jumlah'),
    );
  }
}
