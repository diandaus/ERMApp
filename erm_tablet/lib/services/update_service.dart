import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

import 'api_client.dart';
import 'api_config.dart';

/// Pembaruan aplikasi mandiri (tanpa Play Store). Admin mengunggah APK di
/// web (Pengaturan > Aplikasi Tablet); tablet membandingkan build number
/// rilis terbaru di server (GET /api/tablet/rilis/terbaru) dgn miliknya
/// (versionCode = angka setelah "+" di pubspec.yaml), mengunduh APK, lalu
/// membuka installer Android lewat channel native (MainActivity.kt).
class RilisInfo {
  final String versi;
  final int buildNumber;
  final String catatan;
  final String url;
  final int ukuran;
  final String tanggal;
  const RilisInfo(
      {required this.versi,
      required this.buildNumber,
      required this.catatan,
      required this.url,
      required this.ukuran,
      required this.tanggal});

  factory RilisInfo.fromJson(Map<String, dynamic> j) => RilisInfo(
        versi: (j['versi'] ?? '').toString(),
        buildNumber: (j['build_number'] as num?)?.toInt() ?? 0,
        catatan: (j['catatan'] ?? '').toString(),
        url: (j['url'] ?? '').toString(),
        ukuran: (j['ukuran'] as num?)?.toInt() ?? 0,
        tanggal: (j['tanggal'] ?? '').toString(),
      );

  String get ukuranLabel => ukuran >= 1024 * 1024
      ? '${(ukuran / 1024 / 1024).toStringAsFixed(1)} MB'
      : '${(ukuran / 1024).round()} KB';
}

class CekUpdateHasil {
  final String versiTerpasang;
  final int buildTerpasang;
  final RilisInfo? terbaru; // null = server belum punya rilis
  const CekUpdateHasil(this.versiTerpasang, this.buildTerpasang, this.terbaru);

  bool get adaUpdate => terbaru != null && terbaru!.buildNumber > buildTerpasang;
}

class UpdateService {
  static const _ch = MethodChannel('erm_tablet/update');

  static bool get didukung => Platform.isAndroid;

  static Future<CekUpdateHasil> cek() async {
    final p = await PackageInfo.fromPlatform();
    final build = int.tryParse(p.buildNumber) ?? 0;
    final m = await ApiClient.getJson('/api/tablet/rilis/terbaru');
    final r = m['ada'] == true && m['rilis'] is Map<String, dynamic>
        ? RilisInfo.fromJson(m['rilis'] as Map<String, dynamic>)
        : null;
    return CekUpdateHasil(p.version, build, r);
  }

  /// Unduh APK ke cacheDir/update; [onProgress] 0..1 (null = ukuran tak diketahui).
  static Future<String> unduh(RilisInfo r, void Function(double? p) onProgress) async {
    final dir = await _ch.invokeMethod<String>('updateDir');
    final file = File('$dir/erm_tablet_${r.buildNumber}.apk');
    final url = r.url.startsWith('http') ? r.url : '$kApiBaseUrl${r.url}';
    final client = http.Client();
    try {
      final res = await client.send(http.Request('GET', Uri.parse(url)));
      if (res.statusCode != 200) {
        throw Exception('Gagal mengunduh APK (HTTP ${res.statusCode})');
      }
      final total = res.contentLength ?? r.ukuran;
      final sink = file.openWrite();
      var diterima = 0;
      try {
        await for (final chunk in res.stream) {
          sink.add(chunk);
          diterima += chunk.length;
          onProgress(total > 0 ? diterima / total : null);
        }
      } finally {
        await sink.close();
      }
      if (r.ukuran > 0 && diterima != r.ukuran) {
        throw Exception('Unduhan tidak lengkap ($diterima dari ${r.ukuran} byte)');
      }
      return file.path;
    } finally {
      client.close();
    }
  }

  static Future<bool> bisaInstal() async => await _ch.invokeMethod<bool>('canInstall') ?? false;

  static Future<void> bukaIzinInstal() => _ch.invokeMethod('openInstallSettings');

  static Future<void> instal(String path) => _ch.invokeMethod('installApk', {'path': path});
}
