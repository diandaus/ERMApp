/// Padanan data GET /api/tindakan-ranap/:no_rawat (backend/
/// tindakan_ranap_handler.go TindakanRanapResponse) — 3 kelompok tindakan
/// terpisah (padanan 3 tabel DlgRawatJalan.java: tabModeDr/tabModePr/
/// tabModeDrPr), SENGAJA tidak digabung jadi satu list.
class TindakanDokterItem {
  final String nmPerawatan;
  final num biayaRawat;
  // Kunci baris utk Hapus (dipakai tab Tindakan Rawat Jalan).
  // tglPerawatan di kelompok ini berformat ISO (2026-04-13T00:00:00+07:00).
  final String kdJenisPrw;
  final String tglPerawatan;
  final String jamRawat;
  final String kdDokter;
  TindakanDokterItem({required this.nmPerawatan, required this.biayaRawat, this.kdJenisPrw = '', this.tglPerawatan = '', this.jamRawat = '', this.kdDokter = ''});

  factory TindakanDokterItem.fromJson(Map<String, dynamic> json) => TindakanDokterItem(
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
        biayaRawat: json['biaya_rawat'] as num? ?? 0,
        kdJenisPrw: json['kd_jenis_prw'] as String? ?? '',
        tglPerawatan: json['tgl_perawatan'] as String? ?? '',
        jamRawat: json['jam_rawat'] as String? ?? '',
        kdDokter: json['kd_dokter'] as String? ?? '',
      );
}

class TindakanParamedisItem {
  final String nmPerawatan;
  final String namaParamedis;
  final num biayaRawat;
  // Kunci baris utk Hapus. tglPerawatan di kelompok Perawat / Dokter &
  // Perawat berformat DD/MM/YYYY (beda dari Tindakan Dokter yg ISO);
  // kdDokter cuma terisi di kelompok Dokter & Perawat.
  final String kdJenisPrw;
  final String tglPerawatan;
  final String jamRawat;
  final String nip;
  final String kdDokter;
  TindakanParamedisItem({required this.nmPerawatan, required this.namaParamedis, required this.biayaRawat, this.kdJenisPrw = '', this.tglPerawatan = '', this.jamRawat = '', this.nip = '', this.kdDokter = ''});

  factory TindakanParamedisItem.fromJson(Map<String, dynamic> json) => TindakanParamedisItem(
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
        namaParamedis: json['nama_paramedis'] as String? ?? '',
        biayaRawat: json['biaya_rawat'] as num? ?? 0,
        kdJenisPrw: json['kd_jenis_prw'] as String? ?? '',
        tglPerawatan: json['tgl_perawatan'] as String? ?? '',
        jamRawat: json['jam_rawat'] as String? ?? '',
        nip: json['nip'] as String? ?? '',
        kdDokter: json['kd_dokter'] as String? ?? '',
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
