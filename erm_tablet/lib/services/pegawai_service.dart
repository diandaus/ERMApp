import '../models/pegawai_option.dart';
import 'api_client.dart';

/// GET /api/pegawai?search= — sama persis endpoint dipakai
/// ModalCariPegawai.tsx (web), dipakai field "Pegawai" di form SOAP.
class PegawaiService {
  static Future<List<PegawaiOption>> search(String q) async {
    final list = await ApiClient.getJsonArray('/api/pegawai', query: q.isEmpty ? null : {'search': q});
    return list.map(PegawaiOption.fromJson).toList();
  }
}
