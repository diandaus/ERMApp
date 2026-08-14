/// Padanan persis PresensiHariIni di backend/presensi_handler.go dan tipe
/// senama di PresensiMobile.tsx — status absen hari ini utk satu pegawai.
class PresensiHariIni {
  final bool sudahCheckin;
  final bool sudahCheckout;
  final String jamDatang;
  final String jamPulang;
  final String status;
  final String keterlambatan;
  final String shift;
  final String jamMasukJadwal;
  final String jamPulangJadwal;

  PresensiHariIni({
    required this.sudahCheckin,
    required this.sudahCheckout,
    required this.jamDatang,
    required this.jamPulang,
    required this.status,
    required this.keterlambatan,
    required this.shift,
    required this.jamMasukJadwal,
    required this.jamPulangJadwal,
  });

  factory PresensiHariIni.fromJson(Map<String, dynamic> json) {
    return PresensiHariIni(
      sudahCheckin: json['sudah_checkin'] as bool? ?? false,
      sudahCheckout: json['sudah_checkout'] as bool? ?? false,
      jamDatang: json['jam_datang'] as String? ?? '',
      jamPulang: json['jam_pulang'] as String? ?? '',
      status: json['status'] as String? ?? '',
      keterlambatan: json['keterlambatan'] as String? ?? '',
      shift: json['shift'] as String? ?? '',
      jamMasukJadwal: json['jam_masuk_jadwal'] as String? ?? '',
      jamPulangJadwal: json['jam_pulang_jadwal'] as String? ?? '',
    );
  }

  bool get sudahSelesaiHariIni => sudahCheckin && sudahCheckout;
  String get aksi => sudahCheckin && !sudahCheckout ? 'checkout' : 'checkin';
}

/// Padanan MeResponse di PresensiMobile.tsx (GET /api/presensi/me) —
/// field `performa` sengaja tidak diikutkan, sudah dead code juga di
/// versi web (di-fetch tapi tak pernah dipakai di UI).
class PresensiMe {
  final String nama;
  final String photo;
  final PresensiHariIni? hariIni;

  PresensiMe({required this.nama, required this.photo, required this.hariIni});

  factory PresensiMe.fromJson(Map<String, dynamic> json) {
    final hariIni = json['hari_ini'];
    return PresensiMe(
      nama: json['nama'] as String? ?? '',
      photo: json['photo'] as String? ?? '',
      hariIni: hariIni is Map<String, dynamic> ? PresensiHariIni.fromJson(hariIni) : null,
    );
  }
}
