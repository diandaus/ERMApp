/// Padanan data GET /api/tindakan-ranap/:no_rawat (backend/
/// tindakan_ranap_handler.go TindakanRanapResponse) — 3 kelompok tindakan
/// terpisah (padanan 3 tabel DlgRawatJalan.java: tabModeDr/tabModePr/
/// tabModeDrPr), SENGAJA tidak digabung jadi satu list.
class TindakanDokterItem {
  final String nmPerawatan;
  final num biayaRawat;
  TindakanDokterItem({required this.nmPerawatan, required this.biayaRawat});

  factory TindakanDokterItem.fromJson(Map<String, dynamic> json) => TindakanDokterItem(
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
        biayaRawat: json['biaya_rawat'] as num? ?? 0,
      );
}

class TindakanParamedisItem {
  final String nmPerawatan;
  final String namaParamedis;
  final num biayaRawat;
  TindakanParamedisItem({required this.nmPerawatan, required this.namaParamedis, required this.biayaRawat});

  factory TindakanParamedisItem.fromJson(Map<String, dynamic> json) => TindakanParamedisItem(
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
        namaParamedis: json['nama_paramedis'] as String? ?? '',
        biayaRawat: json['biaya_rawat'] as num? ?? 0,
      );
}

class TindakanRanapResult {
  final List<TindakanDokterItem> tindakanDokter;
  final List<TindakanParamedisItem> tindakanParamedis;
  final List<TindakanParamedisItem> tindakanDokterParamedis; // bentuk sama dgn Paramedis (nm_perawatan+nama_paramedis+biaya_rawat)

  TindakanRanapResult({required this.tindakanDokter, required this.tindakanParamedis, required this.tindakanDokterParamedis});

  bool get isEmpty => tindakanDokter.isEmpty && tindakanParamedis.isEmpty && tindakanDokterParamedis.isEmpty;

  factory TindakanRanapResult.fromJson(Map<String, dynamic> json) => TindakanRanapResult(
        tindakanDokter: (json['tindakan_dokter'] as List<dynamic>? ?? []).map((e) => TindakanDokterItem.fromJson(e as Map<String, dynamic>)).toList(),
        tindakanParamedis: (json['tindakan_paramedis'] as List<dynamic>? ?? []).map((e) => TindakanParamedisItem.fromJson(e as Map<String, dynamic>)).toList(),
        tindakanDokterParamedis: (json['tindakan_dokter_paramedis'] as List<dynamic>? ?? []).map((e) => TindakanParamedisItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
