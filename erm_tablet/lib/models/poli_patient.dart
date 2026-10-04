/// Padanan baris data GET /api/rawat-jalan/poli-today & /rujukan-internal
/// (backend/main.go) yg dipakai RawatJalan.tsx (web). Field yg dipakai UI
/// tablet ini aja (subset). Dua endpoint itu balikin bentuk yg sama,
/// KECUALI rujukan-internal tidak punya no_reg (dibiarkan '' di sini).
class PoliPatient {
  final String noReg;
  final String noRawat;
  final String tglRegistrasi; // sudah diformat backend: dd/MM/yyyy
  final String jamReg;
  final String kdDokter;
  final String nmDokter;
  final String noRkmMedis;
  final String nmPasien;
  final String kdPoli;
  final String nmPoli;
  final String kdPj; // cara bayar — menentukan tarif di pencarian jenis tindakan
  final String umur;
  final String pngJawab;
  final String noSep;
  // Satu-satunya field yg tidak final — diubah lokal setelah PUT
  // /api/rawat-jalan/update-status sukses (padanan setPoliToday(prev.map)
  // di RawatJalan.tsx), tanpa perlu muat ulang seluruh daftar.
  String stts;

  PoliPatient({
    required this.noReg,
    required this.noRawat,
    required this.tglRegistrasi,
    required this.jamReg,
    required this.kdDokter,
    required this.nmDokter,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.kdPoli,
    required this.nmPoli,
    required this.kdPj,
    required this.umur,
    required this.pngJawab,
    required this.noSep,
    required this.stts,
  });

  factory PoliPatient.fromJson(Map<String, dynamic> json) {
    return PoliPatient(
      noReg: json['no_reg'] as String? ?? '',
      noRawat: json['no_rawat'] as String? ?? '',
      tglRegistrasi: json['tgl_registrasi'] as String? ?? '',
      jamReg: json['jam_reg'] as String? ?? '',
      kdDokter: json['kd_dokter'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      kdPoli: json['kd_poli'] as String? ?? '',
      nmPoli: json['nm_poli'] as String? ?? '',
      kdPj: json['kd_pj'] as String? ?? '',
      umur: json['umur'] as String? ?? '',
      pngJawab: json['png_jawab'] as String? ?? '',
      noSep: json['no_sep'] as String? ?? '',
      stts: json['stts'] as String? ?? '',
    );
  }
}

/// Padanan data GET /api/pendaftaran/poli — opsi filter Poliklinik.
class PoliOption {
  final String kdPoli;
  final String nmPoli;
  PoliOption({required this.kdPoli, required this.nmPoli});

  factory PoliOption.fromJson(Map<String, dynamic> json) => PoliOption(
        kdPoli: json['kd_poli'] as String? ?? '',
        nmPoli: json['nm_poli'] as String? ?? '',
      );
}
