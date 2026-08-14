import '../models/lapor_it_item.dart';
import 'api_client.dart';

class LaporItService {
  static Future<List<LaporItItem>> getSaya(String nik) async {
    final list = await ApiClient.getJsonArray('/api/lapor-it/saya', query: {'nik': nik});
    return list.map(LaporItItem.fromJson).toList();
  }

  static Future<String> uploadFoto(List<int> bytes) async {
    final filename = 'lapor-it-${DateTime.now().millisecondsSinceEpoch}.jpg';
    final data = await ApiClient.uploadFile('/api/upload', bytes, filename);
    return (data['url'] ?? data['path'] ?? data['filename'] ?? '') as String;
  }

  static Future<void> submit({
    required String nik,
    required String kategori,
    required String lokasi,
    required String judul,
    required String deskripsi,
    required String foto,
  }) {
    return ApiClient.postJson('/api/lapor-it', {
      'nik': nik,
      'kategori': kategori,
      'lokasi': lokasi,
      'judul': judul,
      'deskripsi': deskripsi,
      'foto': foto,
    });
  }

  static Future<void> batalkan(int id) {
    return ApiClient.deleteJson('/api/lapor-it/$id');
  }
}
