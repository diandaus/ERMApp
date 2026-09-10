/// Padanan ringkas data GET /api/dokter/list (backend/dokter_handler.go)
/// — cuma kd_dokter+nm_dokter yg dipakai di sini (combobox filter DPJP),
/// backend balikin field lebih banyak tapi tidak relevan utk kebutuhan
/// ini.
class DokterOption {
  final String kdDokter;
  final String nmDokter;
  DokterOption({required this.kdDokter, required this.nmDokter});

  factory DokterOption.fromJson(Map<String, dynamic> json) => DokterOption(
        kdDokter: json['kd_dokter'] as String? ?? '',
        nmDokter: json['nm_dokter'] as String? ?? '',
      );
}
