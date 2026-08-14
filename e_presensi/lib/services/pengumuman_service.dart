import '../models/pengumuman.dart';
import 'api_client.dart';

class PengumumanService {
  static Future<List<Pengumuman>> getAktif() async {
    final list = await ApiClient.getJsonArray('/api/pengumuman', query: {'aktif': '1'});
    return list.map(Pengumuman.fromJson).toList();
  }
}
