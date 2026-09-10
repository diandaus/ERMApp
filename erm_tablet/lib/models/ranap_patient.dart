/// Padanan Patient type di RawatInap.tsx (web) — GET /api/rawat-inap/list.
/// Field yg dipakai UI tablet ini aja (subset), backend balikin lebih
/// banyak tapi tidak semua relevan di sini.
class RanapPatient {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String jk;
  final String kamar;
  final String nmDokter;
  final String tglMasuk;
  final String jamMasuk;
  final String tglKeluar; // kosong '' kalau belum pulang
  final String sttsPulang; // '-' = belum pulang
  final String lama;
  final String statusBayar;
  final String pngJawab;
  final String diagnosaAwal;
  final String alamat;
  final String tglLahir;
  final String pekerjaan;

  RanapPatient({
    required this.noRawat,
    required this.noRkmMedis,
    required this.nmPasien,
    required this.umur,
    required this.jk,
    required this.kamar,
    required this.nmDokter,
    required this.tglMasuk,
    required this.jamMasuk,
    required this.tglKeluar,
    required this.sttsPulang,
    required this.lama,
    required this.statusBayar,
    required this.pngJawab,
    required this.diagnosaAwal,
    required this.alamat,
    required this.tglLahir,
    required this.pekerjaan,
  });

  factory RanapPatient.fromJson(Map<String, dynamic> json) {
    return RanapPatient(
      noRawat: json['no_rawat'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      nmPasien: json['nm_pasien'] as String? ?? '',
      umur: json['umur'] as String? ?? '',
      jk: json['jk'] as String? ?? '',
      kamar: json['kamar'] as String? ?? '',
      nmDokter: json['nm_dokter'] as String? ?? '',
      tglMasuk: json['tgl_masuk'] as String? ?? '',
      jamMasuk: json['jam_masuk'] as String? ?? '',
      tglKeluar: json['tgl_keluar'] as String? ?? '',
      sttsPulang: json['stts_pulang'] as String? ?? '-',
      lama: json['lama'] as String? ?? '',
      statusBayar: json['status_bayar'] as String? ?? '',
      pngJawab: json['png_jawab'] as String? ?? '',
      diagnosaAwal: json['diagnosa_awal'] as String? ?? '',
      alamat: json['alamat'] as String? ?? '',
      tglLahir: json['tgl_lahir'] as String? ?? '',
      pekerjaan: json['pekerjaan'] as String? ?? '',
    );
  }

  bool get sudahPulang => sttsPulang != '-' && tglKeluar.isNotEmpty;

  /// Padanan konversi kode jk ('L'/'P') -> label lengkap yg dipakai di
  /// banyak tempat web (mis. form pendaftaran pasien).
  String get jkLabel => jk == 'L' ? 'Laki-laki' : (jk == 'P' ? 'Perempuan' : '-');
}
