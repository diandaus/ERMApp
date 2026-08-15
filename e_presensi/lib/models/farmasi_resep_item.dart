/// Padanan FarmasiResepItem di PresensiMobile.tsx (GET
/// /api/permintaan-resep/ralan).
class FarmasiResepItem {
  final String noResep;
  final String jamPeresepan;
  final String noRkmMedis;
  final String nmPasien;
  final String nmDokter;
  final String status;
  final String nmPoli;
  final String jenisBayar;

  FarmasiResepItem({
    required this.noResep,
    required this.jamPeresepan,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.nmDokter,
    required this.status,
    required this.nmPoli,
    required this.jenisBayar,
  });

  factory FarmasiResepItem.fromJson(Map<String, dynamic> json) {
    return FarmasiResepItem(
      noResep: json['no_resep'] as String? ?? '',
      jamPeresepan: json['jam_peresepan'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      status: json['status'] as String? ?? '',
      nmPoli: json['nm_poli'] as String? ?? '',
      jenisBayar: json['jenis_bayar'] as String? ?? '',
    );
  }
}
