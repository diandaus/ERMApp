import '../models/resep_ranap_item.dart';
import 'api_client.dart';

/// ResepRanapService — endpoint SAMA PERSIS dgn web (GET /api/resep-ranap/
/// list), dipakai modal "Pilih dari Resep" di JadwalObatTab.
class ResepRanapService {
  static Future<List<ResepRanapResult>> getList(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/resep-ranap/list', query: {'no_rawat': noRawat});
    return list.map(ResepRanapResult.fromJson).toList();
  }

  /// Rawat Jalan — GET /api/resep/history/{no_rkm_medis} (sama dgn
  /// ResepTab.tsx tanpa isRanap): balikin resep SEMUA kunjungan pasien,
  /// disaring ke no_rawat kunjungan ini di sini, persis spt web.
  static Future<List<ResepRanapResult>> getRalanList({required String noRkmMedis, required String noRawat}) async {
    final list = await ApiClient.getJsonArray('/api/resep/history/${Uri.encodeComponent(noRkmMedis)}');
    return list.where((r) => r['no_rawat'] == noRawat).map(ResepRanapResult.fromJson).toList();
  }

  /// Hapus/batalkan resep Rawat Jalan — DELETE /api/resep/{no_resep}
  /// (backend menolak kalau resep sudah tervalidasi).
  static Future<void> deleteRalan(String noResep) {
    return ApiClient.deleteJson('/api/resep/${Uri.encodeComponent(noResep)}');
  }

  /// Riwayat resep pasien (SEMUA kunjungan), mentah — dipakai panel
  /// Riwayat Resep di modal Input Resep (Copy ke form).
  static Future<List<Map<String, dynamic>>> getRiwayatRaw(String noRkmMedis) {
    return ApiClient.getJsonArray('/api/resep/history/${Uri.encodeComponent(noRkmMedis)}');
  }

  /// Template Resep Racikan — pribadi per dokter (backend balas kosong
  /// kalau kd_dokter kosong).
  static Future<List<Map<String, dynamic>>> getRacikanTemplates(String kdDokter) {
    return ApiClient.getJsonArray('/api/resep/racikan-template', query: {'kd_dokter': kdDokter});
  }

  static Future<void> saveRacikanTemplate(Map<String, dynamic> payload) {
    return ApiClient.postJson('/api/resep/racikan-template', payload);
  }

  /// Cari obat utk resep Rawat Jalan — GET /api/obat/search (stok ikut
  /// depo kunjungan lewat no_rawat), sama dgn ResepModal.tsx.
  static Future<List<Map<String, dynamic>>> searchObatRalan(String query, String noRawat) {
    return ApiClient.getJsonArray('/api/obat/search', query: {'query': query, 'no_rawat': noRawat});
  }

  /// Simpan resep Rawat Jalan — POST /api/resep/submit, payload sama dgn
  /// ResepModal.tsx bagian RALAN (non-racikan + racikan sekali kirim).
  static Future<void> submitRalan({required String noRawat, required String kdDokter, required List<Map<String, dynamic>> nonRacikan, required List<Map<String, dynamic>> racikan}) {
    return ApiClient.postJson('/api/resep/submit', {'no_rawat': noRawat, 'kd_dokter': kdDokter, 'non_racikan': nonRacikan, 'racikan': racikan});
  }
}
