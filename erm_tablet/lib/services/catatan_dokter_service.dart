import 'api_client.dart';

/// CatatanDokterService — endpoint SAMA PERSIS dgn CatatanDokterTab.tsx
/// (web): catatan bebas per kunjungan (tabel catatan_perawatan) +
/// template catatan per dokter (erm_template_catatan_dokter).
class CatatanDokterService {
  static Future<List<Map<String, dynamic>>> getCatatan(String noRawat) {
    return ApiClient.getJsonArray('/api/pemeriksaan/catatan-dokter/$noRawat');
  }

  static Future<void> saveCatatan({required String noRawat, required String kdDokter, required String catatan}) {
    return ApiClient.postJson('/api/pemeriksaan/catatan-dokter', {'no_rawat': noRawat, 'kd_dokter': kdDokter, 'catatan': catatan});
  }

  static Future<void> deleteCatatan({required String noRawat, required String tanggal, required String jam, required String kdDokter}) {
    final q = Uri(queryParameters: {'no_rawat': noRawat, 'tanggal': tanggal, 'jam': jam, 'kd_dokter': kdDokter}).query;
    return ApiClient.deleteJson('/api/pemeriksaan/catatan-dokter?$q');
  }

  static Future<List<Map<String, dynamic>>> getTemplates(String kdDokter) {
    return ApiClient.getJsonArray('/api/pemeriksaan/template-catatan-dokter', query: {'kd_dokter': kdDokter});
  }

  static Future<void> createTemplate({required String kdDokter, required String nama, required String isi}) {
    return ApiClient.postJson('/api/pemeriksaan/template-catatan-dokter', {'kd_dokter': kdDokter, 'nama_template': nama, 'isi': isi});
  }

  static Future<void> deleteTemplate(int id) {
    return ApiClient.deleteJson('/api/pemeriksaan/template-catatan-dokter/$id');
  }
}
