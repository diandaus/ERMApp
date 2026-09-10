import '../models/lab_item.dart';
import 'api_client.dart';

/// LabService — endpoint SAMA PERSIS dgn web (LabTab.tsx): riwayat
/// permintaan PK/PA (pending) + hasil lab yg sudah keluar (PK+PA). Tidak
/// ada endpoint baru.
class LabService {
  /// no_rawat dikirim APA ADANYA (mengandung "/", mis. "2026/01/000123")
  /// krn backend pakai wildcard route (*no_rawat) yg justru butuh slash
  /// itu utuh — jangan di-encode, sama persis pola SoapService.getRiwayat.
  static Future<List<LabPermintaanItem>> getRiwayatPK(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/lab/riwayat-pk/$noRawat');
    return list.map((e) => LabPermintaanItem.fromJson(e, 'pk')).toList();
  }

  static Future<List<LabPermintaanItem>> getRiwayatPA(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/lab/riwayat-pa/$noRawat');
    return list.map((e) => LabPermintaanItem.fromJson(e, 'pa')).toList();
  }

  static Future<List<LabHasilItem>> getHasilDetail(String noRawat, String kategori) async {
    final res = await ApiClient.getJson('/api/lab/hasil-detail', query: {'kategori': kategori, 'no_rawat': noRawat});
    final hasil = res['hasil'] as List<dynamic>? ?? [];
    return hasil.map((e) => LabHasilItem.fromJson(e as Map<String, dynamic>, kategori.toLowerCase())).toList();
  }
}
