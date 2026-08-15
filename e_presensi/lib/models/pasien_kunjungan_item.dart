/// Padanan PoliPasienItem di PresensiMobile.tsx — dipakai bersama utk
/// Poli (GET /api/rawat-jalan/poli-today) dan IGD (GET /api/igd/list),
/// bentuk datanya identik.
class PasienKunjunganItem {
  final String noReg;
  final String jamReg;
  final String kdDokter;
  final String nmDokter;
  final String noRkmMedis;
  final String nmPasien;
  final String nmPoli;
  final String stts;
  final String statusBayar;
  final String umur;

  PasienKunjunganItem({
    required this.noReg,
    required this.jamReg,
    required this.kdDokter,
    required this.nmDokter,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.nmPoli,
    required this.stts,
    required this.statusBayar,
    required this.umur,
  });

  factory PasienKunjunganItem.fromJson(Map<String, dynamic> json) {
    return PasienKunjunganItem(
      noReg: json['no_reg'] as String? ?? '',
      jamReg: json['jam_reg'] as String? ?? '',
      kdDokter: json['kd_dokter'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      nmPoli: json['nm_poli'] as String? ?? '',
      stts: json['stts'] as String? ?? '',
      statusBayar: json['status_bayar'] as String? ?? '',
      umur: json['umur'] as String? ?? '',
    );
  }
}
