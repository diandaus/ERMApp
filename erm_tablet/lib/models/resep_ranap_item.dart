/// Bentuk data persis resep_ranap_handler.go (GET /api/resep-ranap/list) —
/// padanan persis type ResepRanapResult/dst di ModalJadwalObat.tsx (web),
/// dipakai modal "Pilih dari Resep" supaya nampilin detail LENGKAP (bukan
/// cuma nama obat): tgl/jam peresepan, dokter, tiap item non-racikan
/// (nama, jumlah, satuan, aturan pakai) & racikan (metode, aturan pakai,
/// daftar kandungan).
class ResepNonRacikanItem {
  final String kodeBrng;
  final String namaBrng;
  final String kodeSat;
  final num jml;
  final String aturanPakai;

  ResepNonRacikanItem({required this.kodeBrng, required this.namaBrng, required this.kodeSat, required this.jml, required this.aturanPakai});

  factory ResepNonRacikanItem.fromJson(Map<String, dynamic> json) => ResepNonRacikanItem(
        kodeBrng: json['kode_brng'] as String? ?? '',
        namaBrng: json['nama_brng'] as String? ?? '',
        kodeSat: json['kode_sat'] as String? ?? '',
        jml: json['jml'] as num? ?? 0,
        aturanPakai: json['aturan_pakai'] as String? ?? '',
      );
}

class ResepRacikanDetailItem {
  final String kodeBrng;
  final String namaBrng;
  final String kodeSat;
  final num jml;
  final String kandungan;
  final num kapasitas;

  ResepRacikanDetailItem({required this.kodeBrng, required this.namaBrng, required this.kodeSat, required this.jml, required this.kandungan, required this.kapasitas});

  factory ResepRacikanDetailItem.fromJson(Map<String, dynamic> json) => ResepRacikanDetailItem(
        kodeBrng: json['kode_brng'] as String? ?? '',
        namaBrng: json['nama_brng'] as String? ?? '',
        kodeSat: json['kode_sat'] as String? ?? '',
        jml: json['jml'] as num? ?? 0,
        kandungan: json['kandungan'] as String? ?? '',
        kapasitas: json['kapasitas'] as num? ?? 0,
      );
}

class ResepRacikanItem {
  final String noRacik;
  final String namaRacik;
  final String kdRacik;
  final String nmRacik;
  final String metodeRacik;
  final num jmlDr;
  final String aturanPakai;
  final String keterangan;
  final List<ResepRacikanDetailItem> detail;

  ResepRacikanItem({
    required this.noRacik,
    required this.namaRacik,
    required this.kdRacik,
    required this.nmRacik,
    required this.metodeRacik,
    required this.jmlDr,
    required this.aturanPakai,
    required this.keterangan,
    required this.detail,
  });

  factory ResepRacikanItem.fromJson(Map<String, dynamic> json) => ResepRacikanItem(
        noRacik: json['no_racik'] as String? ?? '',
        namaRacik: json['nama_racik'] as String? ?? '',
        kdRacik: json['kd_racik'] as String? ?? '',
        nmRacik: json['nm_racik'] as String? ?? '',
        metodeRacik: json['metode_racik'] as String? ?? '',
        jmlDr: json['jml_dr'] as num? ?? 0,
        aturanPakai: json['aturan_pakai'] as String? ?? '',
        keterangan: json['keterangan'] as String? ?? '',
        detail: (json['detail'] as List<dynamic>? ?? []).map((e) => ResepRacikanDetailItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class ResepRanapResult {
  final String noResep;
  final String tglPeresepan;
  final String jamPeresepan;
  final String kdDokter;
  final String nmDokter;
  final String status;
  final List<ResepNonRacikanItem> nonRacikan;
  final List<ResepRacikanItem> racikan;

  ResepRanapResult({
    required this.noResep,
    required this.tglPeresepan,
    required this.jamPeresepan,
    required this.kdDokter,
    required this.nmDokter,
    required this.status,
    required this.nonRacikan,
    required this.racikan,
  });

  factory ResepRanapResult.fromJson(Map<String, dynamic> json) => ResepRanapResult(
        noResep: json['no_resep'] as String? ?? '',
        tglPeresepan: json['tgl_peresepan'] as String? ?? '',
        jamPeresepan: json['jam_peresepan'] as String? ?? '',
        kdDokter: json['kd_dokter'] as String? ?? '',
        nmDokter: json['nm_dokter'] as String? ?? '',
        status: json['status'] as String? ?? '',
        nonRacikan: (json['non_racikan'] as List<dynamic>? ?? []).map((e) => ResepNonRacikanItem.fromJson(e as Map<String, dynamic>)).toList(),
        racikan: (json['racikan'] as List<dynamic>? ?? []).map((e) => ResepRacikanItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
