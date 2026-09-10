/// Padanan data GET /api/radiologi/riwayat/:no_rawat (backend/
/// rad_handler.go) — permintaan radiologi yg BELUM ada hasil (Pending).
class RadPermintaanItem {
  final String noorder;
  final String tglPermintaan;
  final String jamPermintaan;
  final String nmDokter;
  final String status;
  final String informasiTambahan;
  final String diagnosaKlinis;
  final String tglHasil;
  final List<RadDetailPemeriksaan> detailPemeriksaan;

  RadPermintaanItem({
    required this.noorder,
    required this.tglPermintaan,
    required this.jamPermintaan,
    required this.nmDokter,
    required this.status,
    required this.informasiTambahan,
    required this.diagnosaKlinis,
    required this.tglHasil,
    required this.detailPemeriksaan,
  });

  /// Padanan persis `!item.tgl_hasil` di RadTab.tsx (web) — beda dari
  /// LabPermintaanItem, backend radiologi kirim string kosong '' (bukan
  /// zero-value Go/'0000-00-00') begitu belum ada hasil.
  bool get sudahAdaHasil => tglHasil.isNotEmpty;

  factory RadPermintaanItem.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key] as String? ?? '';
    return RadPermintaanItem(
      noorder: s('noorder'),
      tglPermintaan: s('tgl_permintaan'),
      jamPermintaan: s('jam_permintaan'),
      nmDokter: s('nm_dokter'),
      status: s('status'),
      informasiTambahan: s('informasi_tambahan'),
      diagnosaKlinis: s('diagnosa_klinis'),
      tglHasil: s('tgl_hasil'),
      detailPemeriksaan: (json['detail_pemeriksaan'] as List<dynamic>? ?? []).map((e) => RadDetailPemeriksaan.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class RadDetailPemeriksaan {
  final String kdJenisPrw;
  final String nmPerawatan;
  RadDetailPemeriksaan({required this.kdJenisPrw, required this.nmPerawatan});

  factory RadDetailPemeriksaan.fromJson(Map<String, dynamic> json) => RadDetailPemeriksaan(
        kdJenisPrw: json['kd_jenis_prw'] as String? ?? '',
        nmPerawatan: json['nm_perawatan'] as String? ?? '',
      );
}

/// Padanan data GET /api/radiologi-data/:no_rawat (backend/
/// radiologi_handler.go RadiologiResponse) — data pemeriksaan/hasil bacaan/
/// gambar radiologi yg SUDAH ada (tgl_periksa/jam sudah format DD/MM/YYYY
/// & HH:mm:ss dari backend, tidak perlu diformat ulang di client).
class RadiologiPemeriksaan {
  final String tglPeriksa;
  final String jam;
  final String kdJenisPrw;
  final String nmPerawatan;
  final String nmDokter;
  final String namaPetugas;
  final num biaya;
  final String proyeksi;

  RadiologiPemeriksaan({
    required this.tglPeriksa,
    required this.jam,
    required this.kdJenisPrw,
    required this.nmPerawatan,
    required this.nmDokter,
    required this.namaPetugas,
    required this.biaya,
    required this.proyeksi,
  });

  factory RadiologiPemeriksaan.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key] as String? ?? '';
    return RadiologiPemeriksaan(
      tglPeriksa: s('tgl_periksa'),
      jam: s('jam'),
      kdJenisPrw: s('kd_jenis_prw'),
      nmPerawatan: s('nm_perawatan'),
      nmDokter: s('nm_dokter'),
      namaPetugas: s('nama_petugas'),
      biaya: json['biaya'] as num? ?? 0,
      proyeksi: s('proyeksi'),
    );
  }
}

class RadiologiHasil {
  final String tglPeriksa;
  final String jam;
  final String hasil;
  RadiologiHasil({required this.tglPeriksa, required this.jam, required this.hasil});

  factory RadiologiHasil.fromJson(Map<String, dynamic> json) => RadiologiHasil(
        tglPeriksa: json['tgl_periksa'] as String? ?? '',
        jam: json['jam'] as String? ?? '',
        hasil: json['hasil'] as String? ?? '',
      );
}

class RadiologiGambar {
  final String tglPeriksa;
  final String jam;
  final String lokasiGambar;
  RadiologiGambar({required this.tglPeriksa, required this.jam, required this.lokasiGambar});

  factory RadiologiGambar.fromJson(Map<String, dynamic> json) => RadiologiGambar(
        tglPeriksa: json['tgl_periksa'] as String? ?? '',
        jam: json['jam'] as String? ?? '',
        lokasiGambar: json['lokasi_gambar'] as String? ?? '',
      );
}

class RadiologiData {
  final List<RadiologiPemeriksaan> pemeriksaan;
  final List<RadiologiHasil> hasil;
  final List<RadiologiGambar> gambar;
  RadiologiData({required this.pemeriksaan, required this.hasil, required this.gambar});

  bool get isEmpty => pemeriksaan.isEmpty && hasil.isEmpty && gambar.isEmpty;

  factory RadiologiData.fromJson(Map<String, dynamic> json) => RadiologiData(
        pemeriksaan: (json['pemeriksaan'] as List<dynamic>? ?? []).map((e) => RadiologiPemeriksaan.fromJson(e as Map<String, dynamic>)).toList(),
        hasil: (json['hasil'] as List<dynamic>? ?? []).map((e) => RadiologiHasil.fromJson(e as Map<String, dynamic>)).toList(),
        gambar: (json['gambar'] as List<dynamic>? ?? []).map((e) => RadiologiGambar.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
