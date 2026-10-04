import '../models/app_user.dart';
import '../models/poli_patient.dart';
import 'api_client.dart';

/// Rawat Jalan (Poliklinik) — endpoint SAMA PERSIS dgn web
/// (RawatJalan.tsx), tidak ada endpoint baru.
class RawatJalanService {
  /// Role dokter -> kd_dokter SELALU dikirim (walau kosong kalau akun
  /// belum ditautkan) supaya backend konsisten balikin KOSONG, sama pola
  /// dgn RanapService.getList & isDokterLocked di RawatJalan.tsx.
  static Map<String, String> _query(AppUser user, String tglDari, String tglSampai) {
    final query = <String, String>{'tgl_dari': tglDari, 'tgl_sampai': tglSampai};
    if (user.isDokter) query['kd_dokter'] = user.kdDokter;
    return query;
  }

  static Future<List<PoliPatient>> getPoliToday(AppUser user, {required String tglDari, required String tglSampai}) async {
    final list = await ApiClient.getJsonArray('/api/rawat-jalan/poli-today', query: _query(user, tglDari, tglSampai));
    return list.map(PoliPatient.fromJson).toList();
  }

  static Future<List<PoliPatient>> getRujukanInternal(AppUser user, {required String tglDari, required String tglSampai}) async {
    final list = await ApiClient.getJsonArray('/api/rawat-jalan/rujukan-internal', query: _query(user, tglDari, tglSampai));
    return list.map(PoliPatient.fromJson).toList();
  }

  static Future<void> updateStatus(String noRawat, String status) {
    return ApiClient.putJson('/api/rawat-jalan/update-status', {'no_rawat': noRawat, 'status': status});
  }

  /// Panggil pasien ke display antrian poli. Balikin objek "antrian" dari
  /// respons (no_antrian, nm_poli, dst).
  static Future<Map<String, dynamic>> callPatient(AppUser user, PoliPatient patient) async {
    final res = await ApiClient.postJson('/api/antrian/poli/call-patient', {
      'no_rkm_medis': patient.noRkmMedis,
      'kd_poli': patient.kdPoli,
      'petugas_nip': user.username.isEmpty ? 'UNKNOWN' : user.username,
      'petugas_nama': user.fullName.isEmpty ? 'UNKNOWN' : user.fullName,
    });
    return res['antrian'] as Map<String, dynamic>? ?? {};
  }

  /// Data pasien lengkap (tmp_lahir, gol_darah, alamat, pnd, nm_ibu, dst)
  /// utk sidebar Informasi Pasien di layar pemeriksaan.
  static Future<Map<String, dynamic>> getPasien(String noRkmMedis) {
    return ApiClient.getJson('/api/pendaftaran/pasien/${Uri.encodeComponent(noRkmMedis)}');
  }

  static Future<List<PoliOption>> getPoliList() async {
    final list = await ApiClient.getJsonArray('/api/pendaftaran/poli');
    return list.map(PoliOption.fromJson).toList();
  }
}
