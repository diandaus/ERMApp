import 'package:intl/intl.dart';
import '../models/soap_item.dart';
import 'api_client.dart';

/// Tanggal SOAP datang dlm 3 bentuk (ISO "2026-04-13T00:00:00+07:00",
/// "13/04/2026", "2026-04-13") tergantung endpoint — disamakan ke
/// YYYY-MM-DD, format yg diminta POST/PUT/DELETE /api/pemeriksaan/soap.
String soapDateToApi(String tgl) {
  if (tgl.contains('T')) return tgl.split('T').first;
  if (tgl.contains('/')) {
    final parts = tgl.split('/');
    if (parts.length == 3) return '${parts[2]}-${parts[1].padLeft(2, '0')}-${parts[0].padLeft(2, '0')}';
  }
  return tgl;
}

/// SOAP/CPPT Rawat Jalan — endpoint SAMA PERSIS dgn Pemeriksaan.tsx (web),
/// tidak ada endpoint baru. no_rawat dikirim apa adanya di path (mengandung
/// "/") krn backend pakai wildcard route (*no_rawat).
class SoapRalanService {
  static Future<List<SoapItem>> getRiwayat(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan-ralan/$noRawat');
    return list.map(SoapItem.fromJson).toList();
  }

  /// [edit] true -> PUT (kunci datanya no_rawat+tgl_perawatan+jam_rawat,
  /// jadi tgl/jam HARUS milik baris yg diedit), false -> POST.
  static Future<void> simpan(Map<String, dynamic> payload, {required bool edit}) {
    return edit ? ApiClient.putJson('/api/pemeriksaan/soap', payload) : ApiClient.postJson('/api/pemeriksaan/soap', payload);
  }

  static Future<void> hapus({required String noRawat, required String tglPerawatan, required String jamRawat}) {
    final query = Uri(queryParameters: {'no_rawat': noRawat, 'tgl_perawatan': tglPerawatan, 'jam_rawat': jamRawat}).query;
    return ApiClient.deleteJson('/api/pemeriksaan/soap?$query');
  }

  /// Set reg_periksa.stts = 'Sudah' — dipanggil web setelah SOAP tersimpan.
  static Future<void> setSudahPeriksa(String noRawat) {
    return ApiClient.putJson('/api/pendaftaran/update-status/$noRawat', {});
  }

  /// SOAPIE terakhir dari kunjungan SEBELUM hari ini (5 registrasi
  /// terakhir) — padanan fetchLastSoapie di Pemeriksaan.tsx, utk card
  /// "Riwayat Kunjungan Terakhir". null kalau belum ada.
  static Future<SoapItem?> getLastSoapie(String noRkmMedis) async {
    final regs = await ApiClient.getJsonArray('/api/pemeriksaan/riwayat-soapie/${Uri.encodeComponent(noRkmMedis)}', query: {'filter': 'last5'});
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    Map<String, dynamic>? latest;
    var latestDate = '';
    for (final reg in regs) {
      final soapie = reg['soapie'];
      if (soapie is! List) continue;
      final before = soapie.whereType<Map<String, dynamic>>().where((s) => soapDateToApi(s['tgl_perawatan'] as String? ?? '') != today).toList();
      if (before.isEmpty) continue;
      final date = soapDateToApi(before.last['tgl_perawatan'] as String? ?? '');
      if (latest == null || date.compareTo(latestDate) > 0) {
        latest = before.last;
        latestDate = date;
      }
    }
    return latest == null ? null : SoapItem.fromJson(latest);
  }
}
