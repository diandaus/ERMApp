import '../models/pegawai_opsi.dart';
import 'api_client.dart';

class PegawaiService {
  static Future<List<PegawaiOpsi>> search(String query) async {
    final list = await ApiClient.getJsonArray('/api/pegawai/list', query: {'search': query});
    return list.map(PegawaiOpsi.fromJson).take(8).toList();
  }
}
