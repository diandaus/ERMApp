import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

/// Error dari backend — pesannya diambil dari field JSON {"error": "..."}
/// yang dipakai konsisten di semua endpoint Go (lihat backend/main.go,
/// c.JSON(status, gin.H{"error": ...})).
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

  /// Sebagian endpoint (mis. /api/pegawai/departemen) balikin array JSON
  /// polos, bukan {"...": [...]} — dipisah dari getJson supaya tetap
  /// type-safe.
  static Future<List<String>> getJsonList(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$kApiBaseUrl$path').replace(queryParameters: query);
    final res = await http.get(uri).timeout(const Duration(seconds: 20));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, 'Terjadi kesalahan (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is List) {
      return decoded.map((e) => e.toString()).toList();
    }
    return [];
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

  /// Sebagian endpoint (mis. /api/pengumuman) balikin array of object JSON
  /// polos — dipisah dari getJson supaya tetap type-safe.
  static Future<List<Map<String, dynamic>>> getJsonArray(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$kApiBaseUrl$path').replace(queryParameters: query);
    final res = await http.get(uri).timeout(const Duration(seconds: 20));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, 'Terjadi kesalahan (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is List) {
      return decoded.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Upload file (mis. foto absen) ke POST /api/upload — field "file",
  /// balikannya {"url": "/uploads/xxx.jpg", ...} (padanan persis alur di
  /// PresensiMobile.tsx: foto diupload dulu, url-nya baru dikirim ke
  /// /api/presensi/checkin|checkout).
  static Future<Map<String, dynamic>> uploadFile(String path, List<int> bytes, String filename) async {
    final uri = Uri.parse('$kApiBaseUrl$path');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
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
