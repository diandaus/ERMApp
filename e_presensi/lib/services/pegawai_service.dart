import '../models/pegawai_opsi.dart';
import 'api_client.dart';

class PegawaiService {
  // Daftar pegawai AKTIF satu departemen (buat modal pilih PJ pengganti
  // di form Izin/Cuti — cuma boleh dari departemen sendiri, bukan cari
  // lintas departemen). `query` opsional buat filter nama di dalam
  // modal.
  static Future<List<PegawaiOpsi>> searchDepartemen({required String departemen, String query = ''}) async {
    final list = await ApiClient.getJsonArray('/api/pegawai/list', query: {
      'departemen': departemen,
      'stts_aktif': 'AKTIF',
      if (query.isNotEmpty) 'search': query,
    });
    return list.map(PegawaiOpsi.fromJson).toList();
  }
}
