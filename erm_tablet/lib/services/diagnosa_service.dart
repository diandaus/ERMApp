import '../models/diagnosa_item.dart';
import 'api_client.dart';

/// DiagnosaService — endpoint SAMA PERSIS dgn web (DiagnosaTab.tsx). Tidak
/// ada endpoint baru. no_rawat dikirim apa adanya (mengandung "/") krn
/// backend pakai wildcard route (*no_rawat).
class DiagnosaService {
  /// [status] 'Ralan' (default backend) / 'Ranap' — kolom status
  /// diagnosa_pasien & prosedur_pasien.
  static Future<List<DiagnosaPasienItem>> getDiagnosa(String noRawat, {String status = 'Ralan'}) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan/diagnosa/$noRawat', query: {'status': status});
    return list.map(DiagnosaPasienItem.fromJson).toList();
  }

  static Future<List<ProsedurPasienItem>> getProsedur(String noRawat, {String status = 'Ralan'}) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan/prosedur/$noRawat', query: {'status': status});
    return list.map(ProsedurPasienItem.fromJson).toList();
  }

  // ── Input Diagnosa & Prosedur (padanan ModalInputDiagnosa.tsx) ──

  static Future<List<Map<String, dynamic>>> searchPenyakit(String q) {
    return ApiClient.getJsonArray('/api/penyakit/search', query: {'q': q});
  }

  static Future<List<Map<String, dynamic>>> searchIcd9(String q) {
    return ApiClient.getJsonArray('/api/icd9/search', query: {'q': q});
  }

  static Future<void> saveDiagnosa({required String noRawat, required String noRkmMedis, required String kdPenyakit, required int prioritas, String status = 'Ralan'}) {
    return ApiClient.postJson('/api/pemeriksaan/diagnosa', {
      'status': status,
      'no_rawat': noRawat,
      'no_rkm_medis': noRkmMedis,
      'kd_penyakit': kdPenyakit,
      'prioritas': prioritas,
    });
  }

  static Future<void> saveProsedur({required String noRawat, required String kode, required int prioritas, required String jumlah, String status = 'Ralan'}) {
    return ApiClient.postJson('/api/pemeriksaan/prosedur', {
      'status': status,
      'no_rawat': noRawat,
      'kode': kode,
      'prioritas': prioritas,
      'jumlah': jumlah,
    });
  }

  static Future<void> deleteDiagnosa(String noRawat, String kdPenyakit, {String status = 'Ralan'}) {
    final q = Uri(queryParameters: {'no_rawat': noRawat, 'kd_penyakit': kdPenyakit, 'status': status}).query;
    return ApiClient.deleteJson('/api/pemeriksaan/diagnosa?$q');
  }

  static Future<void> deleteProsedur(String noRawat, String kode, {String status = 'Ralan'}) {
    final q = Uri(queryParameters: {'no_rawat': noRawat, 'kode': kode, 'status': status}).query;
    return ApiClient.deleteJson('/api/pemeriksaan/prosedur?$q');
  }
}
