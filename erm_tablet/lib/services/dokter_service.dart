import '../models/dokter_option.dart';
import 'api_client.dart';

/// DokterService — endpoint SAMA PERSIS dgn web (/api/dokter/list), tidak
/// ada endpoint baru. Dipakai combobox filter DPJP di RanapTableScreen
/// (landscape) — status=1 (aktif) default, sama pola dgn web.
class DokterService {
  static Future<List<DokterOption>> getList() async {
    final list = await ApiClient.getJsonArray('/api/dokter/list');
    return list.map(DokterOption.fromJson).toList();
  }
}
