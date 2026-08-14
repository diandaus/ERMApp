import '../models/cuti_izin_item.dart';
import 'api_client.dart';

class CutiIzinService {
  static Future<List<CutiIzinItem>> getSaya(String nik, String kategori) async {
    final list = await ApiClient.getJsonArray('/api/pengajuan-cuti/saya', query: {'nik': nik, 'kategori': kategori});
    return list.map(CutiIzinItem.fromJson).toList();
  }

  static Future<void> submit({
    required String nik,
    required String tanggalAwal,
    required String tanggalAkhir,
    required String urgensi,
    required String alamat,
    required String kepentingan,
    required String nikPj,
  }) {
    return ApiClient.postJson('/api/pengajuan-cuti', {
      'nik': nik,
      'tanggal_awal': tanggalAwal,
      'tanggal_akhir': tanggalAkhir,
      'urgensi': urgensi,
      'alamat': alamat,
      'kepentingan': kepentingan,
      'nik_pj': nikPj,
    });
  }

  static Future<void> batalkan(String noPengajuan) {
    return ApiClient.deleteJson('/api/pengajuan-cuti/$noPengajuan');
  }
}
