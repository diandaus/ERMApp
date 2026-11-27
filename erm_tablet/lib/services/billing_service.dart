import 'api_client.dart';

/// BillingService — GET /api/billing-preview/*no_rawat, SAMA dgn
/// PreviewBilling.tsx (web): baris rincian billing gaya Khanza
/// (no, nm_perawatan, biaya, jumlah, tambahan, totalbiaya).
/// no_rawat dikirim apa adanya (wildcard route, butuh "/" utuh).
///
/// Potongan Biaya (tabel Khanza pengurangan_biaya) — mis. dokter
/// menggratiskan konsultasi; tarif & jasa medis asli tidak diubah.
class BillingService {
  static Future<List<Map<String, dynamic>>> getPreview(String noRawat) {
    return ApiClient.getJsonArray('/api/billing-preview/$noRawat');
  }

  /// {nota_tersimpan: bool, potongan: [{nama, besar}]}
  static Future<Map<String, dynamic>> getPotongan(String noRawat) {
    return ApiClient.getJson('/api/billing/potongan/$noRawat');
  }

  static Future<void> savePotongan({required String noRawat, required String nama, required double besar}) {
    return ApiClient.postJson('/api/billing/potongan', {'no_rawat': noRawat, 'nama': nama, 'besar': besar});
  }

  static Future<void> deletePotongan({required String noRawat, required String nama}) {
    final q = Uri(queryParameters: {'no_rawat': noRawat, 'nama': nama}).query;
    return ApiClient.deleteJson('/api/billing/potongan?$q');
  }
}
