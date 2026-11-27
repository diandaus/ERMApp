import 'api_client.dart';

/// Hak akses ERM Tablet per akun — diatur admin di web (Pengaturan >
/// Aplikasi Tablet > Atur Hak Akses Tablet), GET /api/tablet/akses/:user_id
/// balikin daftar kunci menu/tab yg DINONAKTIFKAN. Kunci HARUS sama dgn
/// frontend/src/components/ModalAksesTablet.tsx:
///   menu.dashboard|igd|poli|ranap|farmasi|lab|rad|operasi
///   ralan.soap|resep|usg|tindakan|lab|rad|diagnosa|catatan|billing
///   ranap.soap|resep|lab|rad|tindakan|diagnosa
/// Gagal dimuat (offline / server lama) = semua aktif, spy tablet tetap
/// bisa dipakai.
class AksesService {
  static Set<String> _nonaktif = {};

  static bool aktif(String key) => !_nonaktif.contains(key);

  static Future<void> load(int userId) async {
    try {
      final m = await ApiClient.getJson('/api/tablet/akses/$userId');
      _nonaktif = {for (final k in (m['nonaktif'] as List<dynamic>? ?? [])) '$k'};
    } catch (_) {
      _nonaktif = {};
    }
  }

  static void reset() => _nonaktif = {};
}
