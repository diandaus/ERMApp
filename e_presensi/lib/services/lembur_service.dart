import '../models/lembur_item.dart';
import 'api_client.dart';

class LemburService {
  static Future<List<LemburItem>> getSaya(String nik) async {
    final list = await ApiClient.getJsonArray('/api/lembur/saya', query: {'nik': nik});
    return list.map(LemburItem.fromJson).toList();
  }

  static Future<void> submit({
    required String nik,
    required String tanggal,
    required String jamMulai,
    required String jamSelesai,
    required String keterangan,
  }) {
    return ApiClient.postJson('/api/lembur', {
      'nik': nik,
      'tanggal': tanggal,
      'jam_mulai': jamMulai,
      'jam_selesai': jamSelesai,
      'keterangan': keterangan,
    });
  }
}
