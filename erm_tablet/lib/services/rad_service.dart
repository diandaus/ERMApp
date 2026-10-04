import '../models/rad_item.dart';
import 'api_client.dart';

/// RadService — endpoint SAMA PERSIS dgn web (RadTab.tsx). Tidak ada
/// endpoint baru. no_rawat dikirim apa adanya (mengandung "/") krn backend
/// pakai wildcard route (*no_rawat), sama pola dgn LabService/SoapService.
class RadService {
  /// [usg] true -> ?kategori=usg (RadTab.tsx kategoriUsg): backend cuma
  /// balikin permintaan/pemeriksaan/hasil/gambar USG.
  static Future<List<RadPermintaanItem>> getRiwayat(String noRawat, {bool usg = false}) async {
    final list = await ApiClient.getJsonArray('/api/radiologi/riwayat/$noRawat', query: usg ? {'kategori': 'usg'} : null);
    return list.map(RadPermintaanItem.fromJson).toList();
  }

  static Future<RadiologiData> getData(String noRawat, {bool usg = false}) async {
    final res = await ApiClient.getJson('/api/radiologi-data/$noRawat', query: usg ? {'kategori': 'usg'} : null);
    return RadiologiData.fromJson(res);
  }

  // ── Alur USG (tab "USG" Rawat Jalan) — endpoint sama dgn RadTab.tsx
  // (kategoriUsg) & ModalInputUSG.tsx di web.

  /// Batalkan permintaan yg belum ada hasilnya.
  static Future<void> deletePermintaan(String noorder) {
    return ApiClient.deleteJson('/api/radiologi/permintaan/${Uri.encodeComponent(noorder)}');
  }

  static Future<List<Map<String, dynamic>>> searchJenisPerawatan(String search) {
    return ApiClient.getJsonArray('/api/radiologi/jenis-perawatan', query: {'search': search});
  }

  /// Status kunjungan ('ralan'/'ranap') utk permintaan baru.
  static Future<Map<String, dynamic>> getInfoRawat(String noRawat) {
    return ApiClient.getJson('/api/radiologi/info-rawat/$noRawat');
  }

  /// Buat permintaan radiologi; balikin noorder-nya.
  static Future<String> createPermintaan(Map<String, dynamic> payload) async {
    final res = await ApiClient.postJson('/api/radiologi/permintaan', payload);
    return res['noorder'] as String? ?? '';
  }

  /// Detail satu permintaan: daftar pemeriksaan + hasil/petugas terakhir.
  static Future<Map<String, dynamic>> getPermintaanDetail(String noorder) {
    return ApiClient.getJson('/api/radiologi/permintaan/${Uri.encodeComponent(noorder)}');
  }

  static Future<void> saveHasil(Map<String, dynamic> payload) {
    return ApiClient.postJson('/api/radiologi/hasil', payload);
  }

  /// Status Modality Worklist satu order ('terkirim' kalau sudah dikirim).
  static Future<String> getMwlStatus(String noorder) async {
    final res = await ApiClient.getJson('/api/satu-sehat/mwl/status/$noorder');
    return res['status'] as String? ?? '';
  }

  static Future<void> sendMwl(String noorder) {
    return ApiClient.postJson('/api/satu-sehat/mwl/send/$noorder', {});
  }

  /// Daftar foto DICOM satu order dari Orthanc (+ search_mode backend).
  static Future<Map<String, dynamic>> getDicomPreviewList(String noorder) {
    return ApiClient.getJson('/api/satu-sehat/dicom/preview-list/$noorder');
  }

  static Future<List<Map<String, dynamic>>> searchPetugas(String search) {
    return ApiClient.getJsonArray('/api/petugas', query: {'search': search});
  }
}
