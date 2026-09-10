import '../models/rad_item.dart';
import 'api_client.dart';

/// RadService — endpoint SAMA PERSIS dgn web (RadTab.tsx). Tidak ada
/// endpoint baru. no_rawat dikirim apa adanya (mengandung "/") krn backend
/// pakai wildcard route (*no_rawat), sama pola dgn LabService/SoapService.
class RadService {
  static Future<List<RadPermintaanItem>> getRiwayat(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/radiologi/riwayat/$noRawat');
    return list.map(RadPermintaanItem.fromJson).toList();
  }

  static Future<RadiologiData> getData(String noRawat) async {
    final res = await ApiClient.getJson('/api/radiologi-data/$noRawat');
    return RadiologiData.fromJson(res);
  }
}
