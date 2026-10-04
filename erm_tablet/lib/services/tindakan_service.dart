import '../models/tindakan_item.dart';
import 'api_client.dart';

/// TindakanService — endpoint SAMA PERSIS dgn web (TindakanTab.tsx, isRanap
/// true). Tidak ada endpoint baru. no_rawat dikirim apa adanya (mengandung
/// "/") krn backend pakai wildcard route (*no_rawat).
class TindakanService {
  /// [ralan] true -> /api/tindakan-ralan (TindakanTab.tsx tanpa isRanap);
  /// bentuk responsnya sama dgn versi Ranap.
  static Future<TindakanRanapResult> getList(String noRawat, {bool ralan = false}) async {
    final res = await ApiClient.getJson('${ralan ? '/api/tindakan-ralan' : '/api/tindakan-ranap'}/$noRawat');
    return TindakanRanapResult.fromJson(res);
  }

  // ── Rawat Jalan: input & hapus — endpoint sama dgn TindakanTab.tsx /
  // ModalInputTindakan.tsx (tanpa isRanap).

  /// Daftar jenis tindakan + tarifnya ([kdPj] = cara bayar kunjungan).
  /// search kosong -> backend balikin 50 baris awal.
  static Future<List<Map<String, dynamic>>> searchJenis(String search, {String kdPj = ''}) {
    return ApiClient.getJsonArray('/api/tindakan/jenis-perawatan', query: {'search': search, if (kdPj.isNotEmpty) 'kd_pj': kdPj});
  }

  /// [endpoint]: 'simpan' (dokter), 'simpan-petugas', atau 'simpan-drpr'.
  static Future<void> simpan(String endpoint, Map<String, dynamic> payload) {
    return ApiClient.postJson('/api/tindakan/$endpoint', payload);
  }

  /// [endpoint]: 'delete' (dokter), 'delete-petugas', atau
  /// 'delete-dokter-petugas'; [params] = kunci barisnya.
  static Future<void> hapus(String endpoint, Map<String, String> params) {
    return ApiClient.deleteJson('/api/tindakan/$endpoint?${Uri(queryParameters: params).query}');
  }
}
