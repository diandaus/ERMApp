/// Padanan RanapPasienItem di PresensiMobile.tsx (GET
/// /api/rawat-inap/list?status=belum-pulang).
class RanapPasienItem {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kamar;
  final String tglMasuk;
  final String jamMasuk;
  final String lama;
  final String nmDokter;
  final String statusBayar;

  RanapPasienItem({
    required this.noRawat,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.umur,
    required this.kamar,
    required this.tglMasuk,
    required this.jamMasuk,
    required this.lama,
    required this.nmDokter,
    required this.statusBayar,
  });

  factory RanapPasienItem.fromJson(Map<String, dynamic> json) {
    return RanapPasienItem(
      noRawat: json['no_rawat'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      umur: json['umur'] as String? ?? '',
      kamar: json['kamar'] as String? ?? '',
      tglMasuk: json['tgl_masuk'] as String? ?? '',
      jamMasuk: json['jam_masuk'] as String? ?? '',
      lama: json['lama'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      statusBayar: json['status_bayar'] as String? ?? '',
    );
  }
}
