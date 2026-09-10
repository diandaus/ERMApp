import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import 'api_client.dart';

/// Rawat Inap — GET /api/rawat-inap/list (sama persis endpoint web
/// RawatInap.tsx, tidak ada endpoint baru).
class RanapService {
  /// Role dokter -> kd_dokter SELALU dikirim (walau kosong kalau akun
  /// belum ditautkan) supaya backend konsisten balikin KOSONG utk akun
  /// yg belum di-link, BUKAN diam-diam nampilin pasien semua dokter.
  /// Ini beda dgn pola lama e_presensi/KlinisService.getRanapList yg
  /// omit param kalau kosong (celah info-leak) — padanan fix
  /// RawatJalan.tsx/Dashboard.tsx (frontend web) sesi sebelumnya.
  static Future<List<RanapPatient>> getList(AppUser user, {String status = 'belum-pulang', String? search}) async {
    final query = <String, String>{'status': status};
    if (user.isDokter) query['kd_dokter'] = user.kdDokter;
    if (search != null && search.isNotEmpty) query['search'] = search;
    final list = await ApiClient.getJsonArray('/api/rawat-inap/list', query: query);
    return list.map(RanapPatient.fromJson).toList();
  }
}
