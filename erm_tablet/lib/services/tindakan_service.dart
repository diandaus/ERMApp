import '../models/tindakan_item.dart';
import 'api_client.dart';

/// TindakanService — endpoint SAMA PERSIS dgn web (TindakanTab.tsx, isRanap
/// true). Tidak ada endpoint baru. no_rawat dikirim apa adanya (mengandung
/// "/") krn backend pakai wildcard route (*no_rawat).
class TindakanService {
  static Future<TindakanRanapResult> getList(String noRawat) async {
    final res = await ApiClient.getJson('/api/tindakan-ranap/$noRawat');
    return TindakanRanapResult.fromJson(res);
  }
}
