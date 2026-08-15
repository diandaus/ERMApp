import '../models/pegawai_opsi.dart';
import 'api_client.dart';

class PegawaiService {
  // stts_aktif=AKTIF — dipakai pencarian PJ pengganti di form Izin/Cuti,
  // jangan sampai muncul pegawai yg sudah KELUAR.
  static Future<List<PegawaiOpsi>> search(String query) async {
    final list = await ApiClient.getJsonArray('/api/pegawai/list', query: {'search': query, 'stts_aktif': 'AKTIF'});
    return list.map(PegawaiOpsi.fromJson).take(8).toList();
  }
}
