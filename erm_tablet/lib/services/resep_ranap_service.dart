import '../models/resep_ranap_item.dart';
import 'api_client.dart';

/// ResepRanapService — endpoint SAMA PERSIS dgn web (GET /api/resep-ranap/
/// list), dipakai modal "Pilih dari Resep" di JadwalObatTab.
class ResepRanapService {
  static Future<List<ResepRanapResult>> getList(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/resep-ranap/list', query: {'no_rawat': noRawat});
    return list.map(ResepRanapResult.fromJson).toList();
  }
}
