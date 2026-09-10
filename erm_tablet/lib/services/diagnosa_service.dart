import '../models/diagnosa_item.dart';
import 'api_client.dart';

/// DiagnosaService — endpoint SAMA PERSIS dgn web (DiagnosaTab.tsx). Tidak
/// ada endpoint baru. no_rawat dikirim apa adanya (mengandung "/") krn
/// backend pakai wildcard route (*no_rawat).
class DiagnosaService {
  static Future<List<DiagnosaPasienItem>> getDiagnosa(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan/diagnosa/$noRawat');
    return list.map(DiagnosaPasienItem.fromJson).toList();
  }

  static Future<List<ProsedurPasienItem>> getProsedur(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan/prosedur/$noRawat');
    return list.map(ProsedurPasienItem.fromJson).toList();
  }
}
