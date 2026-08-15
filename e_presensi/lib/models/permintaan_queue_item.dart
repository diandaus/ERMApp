/// Padanan PermintaanQueueItem di PresensiMobile.tsx — dipakai bersama
/// utk Lab (GET /api/lab/list) dan Radiologi (GET /api/radiologi/list),
/// bentuk datanya identik.
class PermintaanQueueItem {
  final String noorder;
  final String jamPermintaan;
  final String noRkmMedis;
  final String nmPasien;
  final String nmDokter;
  final String status;
  final String diagnosaKlinis;

  PermintaanQueueItem({
    required this.noorder,
    required this.jamPermintaan,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.nmDokter,
    required this.status,
    required this.diagnosaKlinis,
  });

  factory PermintaanQueueItem.fromJson(Map<String, dynamic> json) {
    return PermintaanQueueItem(
      noorder: json['noorder'] as String? ?? '',
      jamPermintaan: json['jam_permintaan'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      status: json['status'] as String? ?? '',
      diagnosaKlinis: json['diagnosa_klinis'] as String? ?? '',
    );
  }
}
