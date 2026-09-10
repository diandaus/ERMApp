import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

/// Error dari backend — pesannya diambil dari field JSON {"error": "..."}
/// yang dipakai konsisten di semua endpoint Go (lihat backend/main.go,
/// c.JSON(status, gin.H{"error": ...})).
///
/// File ini PERSIS diadaptasi dari e_presensi/lib/services/api_client.dart
/// (pola sudah teruji production) — cuma ganti kApiBaseUrl.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// Wrapper tipis di atas package:http — satu tempat utk base URL,
/// header, dan parsing error {"error": "..."} yang konsisten dipakai
/// backend Go ERMApp di semua endpoint.
class ApiClient {
  static Future<Map<String, dynamic>> getJson(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$kApiBaseUrl$path').replace(queryParameters: query);
    final res = await http.get(uri).timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  static Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$kApiBaseUrl$path');
    final res = await http
        .post(uri, headers: {'Content-Type': 'application/json'}, body: jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  static Future<Map<String, dynamic>> putJson(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$kApiBaseUrl$path');
    final res = await http
        .put(uri, headers: {'Content-Type': 'application/json'}, body: jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  static Future<Map<String, dynamic>> deleteJson(String path) async {
    final uri = Uri.parse('$kApiBaseUrl$path');
    final res = await http.delete(uri).timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  /// Sebagian endpoint (mis. /api/rawat-inap/list, /api/jadwal-obat/list)
  /// balikin array JSON polos, bukan {"...": [...]} — dipisah dari
  /// getJson supaya tetap type-safe.
  static Future<List<Map<String, dynamic>>> getJsonArray(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$kApiBaseUrl$path').replace(queryParameters: query);
    final res = await http.get(uri).timeout(const Duration(seconds: 20));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _tryErrorMsg(res) ?? 'Terjadi kesalahan (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is List) {
      return decoded.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  static String? _tryErrorMsg(http.Response res) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) return decoded['error'] as String?;
    } catch (_) {/* bukan JSON, biarkan null */}
    return null;
  }

  static Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> data = {};
    if (res.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) data = decoded;
      } catch (_) {
        // Respons bukan JSON (mis. halaman error HTML dari Apache) —
        // dibiarkan map kosong, ditangani sbg pesan error generik di bawah.
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = data['error'] as String? ?? 'Terjadi kesalahan (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return data;
  }
}
