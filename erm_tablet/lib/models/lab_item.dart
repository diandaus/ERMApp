/// Padanan data GET /api/lab/riwayat-pk/:no_rawat & /api/lab/riwayat-pa/
/// :no_rawat (backend/lab_handler.go) — permintaan lab yg BELUM ada hasil
/// (masih Pending). `kategori` ('pk'/'pa') diisi manual di client sesuai
/// endpoint yg dipanggil (backend tidak kirim field ini di sini).
class LabPermintaanItem {
  final String noorder;
  final String noRawat;
  final String tglPermintaan;
  final String jamPermintaan;
  final String tglHasil;
  final String nmDokter;
  final String status;
  final String informasiTambahan;
  final String diagnosaKlinis;
  final List<LabDetailPemeriksaan> detailPemeriksaan;
  final String kategori; // 'pk' | 'pa'

  LabPermintaanItem({
    required this.noorder,
    required this.noRawat,
    required this.tglPermintaan,
    required this.jamPermintaan,
    required this.tglHasil,
    required this.nmDokter,
    required this.status,
    required this.informasiTambahan,
    required this.diagnosaKlinis,
    required this.detailPemeriksaan,
    required this.kategori,
  });

  /// sudahAdaHasil — padanan persis sudahAdaHasil() di LabTab.tsx (web):
  /// tgl_hasil dari backend adalah zero-value Go "0001-01-01..." atau
  /// "0000-00-00" kalau belum ada hasil.
  bool get sudahAdaHasil => tglHasil.isNotEmpty && tglHasil != '0000-00-00' && !tglHasil.startsWith('0001-01-01');

  factory LabPermintaanItem.fromJson(Map<String, dynamic> json, String kategori) {
    String s(String key) => json[key] as String? ?? '';
    return LabPermintaanItem(
      noorder: s('noorder'),
      noRawat: s('no_rawat'),
      tglPermintaan: s('tgl_permintaan'),
      jamPermintaan: s('jam_permintaan'),
      tglHasil: s('tgl_hasil'),
      nmDokter: s('nm_dokter'),
      status: s('status'),
      informasiTambahan: s('informasi_tambahan'),
      diagnosaKlinis: s('diagnosa_klinis'),
      detailPemeriksaan: (json['detail_pemeriksaan'] as List<dynamic>? ?? []).map((e) => LabDetailPemeriksaan.fromJson(e as Map<String, dynamic>)).toList(),
      kategori: kategori,
    );
  }
}

class LabDetailPemeriksaan {
  final String kdJenisPrw;
  final String nmPerawatan;
  LabDetailPemeriksaan({required this.kdJenisPrw, required this.nmPerawatan});

  factory LabDetailPemeriksaan.fromJson(Map<String, dynamic> json) => LabDetailPemeriksaan(
        kdJenisPrw: json['kd_jenis_prw'] as String? ?? '',
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
      );
}

/// Padanan data GET /api/lab/hasil-detail?kategori=..&no_rawat=.. (dari
/// field `hasil` di response) — hasil lab yg SUDAH keluar, per jenis
/// pemeriksaan. `kategori` ('pk'/'pa') diisi manual di client.
class LabHasilItem {
  final String kdJenisPrw;
  final String nmPerawatan;
  final String tglPeriksa;
  final String jam;
  final List<LabHasilDetailItem> detail;
  final String kategori; // 'pk' | 'pa'

  LabHasilItem({
    required this.kdJenisPrw,
    required this.nmPerawatan,
    required this.tglPeriksa,
    required this.jam,
    required this.detail,
    required this.kategori,
  });

  factory LabHasilItem.fromJson(Map<String, dynamic> json, String kategori) {
    String s(String key) => json[key] as String? ?? '';
    return LabHasilItem(
      kdJenisPrw: s('kd_jenis_prw'),
      nmPerawatan: s('nm_perawatan'),
      tglPeriksa: s('tgl_periksa'),
      jam: s('jam'),
      detail: (json['detail'] as List<dynamic>? ?? []).map((e) => LabHasilDetailItem.fromJson(e as Map<String, dynamic>)).toList(),
      kategori: kategori,
    );
  }
}

class LabHasilDetailItem {
  final String pemeriksaan;
  final String nilai;
  final String satuan;
  final String nilaiRujukan;
  final String keterangan;

  LabHasilDetailItem({required this.pemeriksaan, required this.nilai, required this.satuan, required this.nilaiRujukan, required this.keterangan});

  factory LabHasilDetailItem.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key] as String? ?? '';
    return LabHasilDetailItem(
      pemeriksaan: s('pemeriksaan'),
      nilai: s('nilai'),
      satuan: s('satuan'),
      nilaiRujukan: s('nilai_rujukan'),
      keterangan: s('keterangan'),
    );
  }
}
