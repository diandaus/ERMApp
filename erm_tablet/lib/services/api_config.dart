import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Base URL backend ERMApp (Go, sama persis dgn versi web ERMApp/frontend
/// dan e_presensi — tidak ada endpoint baru dibuat khusus app ini,
/// semua /api/auth/*, /api/rawat-inap/*, /api/jadwal-obat/*,
/// /api/pemeriksaan-ranap/*, dst sudah ada & dipakai apa adanya).
///
/// Default (mis. `flutter run` di emulator utk iterasi UI) TETAP ke
/// backend lokal (localhost:8080, DB dev `sik`) — belum production.
/// Utk BUILD PRODUCTION (dites di tablet fisik), override lewat
/// --dart-define, sama persis domain yg sudah dipakai e_presensi
/// (lihat e_presensi/lib/services/api_config.dart) — SATU backend Go yg
/// sama, split-horizon DNS: otomatis resolve ke server internal RS kalau
/// tablet di wifi RS, atau lewat Cloudflare Tunnel kalau di luar RS:
///
///   flutter build apk --release \
///     --dart-define=API_BASE_URL=https://presensi.rsislamibnusinasigli.com
///
/// Host "localhost" beda arti per platform saat backend jalan di Mac ini:
/// - macOS/iOS Simulator/web (Chrome) -> localhost = Mac ini sendiri, benar.
/// - Emulator Android -> localhost = emulator itu sendiri (BUKAN Mac host),
///   harus pakai alias khusus 10.0.2.2 (padanan loopback ke host, disediakan
///   Android emulator). Kalau nanti dites di HP/tablet Android FISIK (bukan
///   emulator) tanpa override di atas, 10.0.2.2 juga TIDAK jalan.
const String _apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

String get kApiBaseUrl {
  if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
  if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:8080';
  return 'http://localhost:8080';
}
