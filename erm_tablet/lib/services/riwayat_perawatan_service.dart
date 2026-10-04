import 'api_client.dart';

/// Detail satu kunjungan utk layar Riwayat Perawatan — tiap bagian boleh
/// kosong (endpointnya gagal/ tidak ada data) tanpa menggagalkan yg lain.
class RiwayatKunjunganDetail {
  final List<Map<String, dynamic>> pemeriksaanRalan;
  final List<Map<String, dynamic>> pemeriksaanRanap;
  final Map<String, dynamic> tindakanRalan;
  final Map<String, dynamic> tindakanRanap;
  final Map<String, dynamic> obat;
  final Map<String, dynamic> radiologi;
  final Map<String, dynamic> laboratorium;
  RiwayatKunjunganDetail({
    required this.pemeriksaanRalan,
    required this.pemeriksaanRanap,
    required this.tindakanRalan,
    required this.tindakanRanap,
    required this.obat,
    required this.radiologi,
    required this.laboratorium,
  });
}

/// Riwayat Perawatan pasien — endpoint SAMA PERSIS dgn RiwayatModal.tsx
/// (web), tidak ada endpoint baru. no_rawat dikirim apa adanya di path
/// (mengandung "/") krn backend pakai wildcard route.
class RiwayatPerawatanService {
  /// {pasien: {...}, riwayat: [kunjungan + diagnosa/prosedur]}.
  static Future<Map<String, dynamic>> getRiwayat(String noRkmMedis) {
    return ApiClient.getJson('/api/riwayat-perawatan/${Uri.encodeComponent(noRkmMedis)}');
  }

  static Future<RiwayatKunjunganDetail> getDetail(String noRawat) async {
    Future<Map<String, dynamic>> map(String path) async {
      try {
        return await ApiClient.getJson('$path/$noRawat');
      } catch (_) {
        return {};
      }
    }

    Future<List<Map<String, dynamic>>> list(String path) async {
      try {
        return await ApiClient.getJsonArray('$path/$noRawat');
      } catch (_) {
        return [];
      }
    }

    final lists = await Future.wait([list('/api/pemeriksaan-ralan'), list('/api/pemeriksaan-ranap')]);
    final maps = await Future.wait([map('/api/tindakan-ralan'), map('/api/tindakan-ranap'), map('/api/obat-data'), map('/api/radiologi-data'), map('/api/laboratorium')]);
    return RiwayatKunjunganDetail(pemeriksaanRalan: lists[0], pemeriksaanRanap: lists[1], tindakanRalan: maps[0], tindakanRanap: maps[1], obat: maps[2], radiologi: maps[3], laboratorium: maps[4]);
  }
}
