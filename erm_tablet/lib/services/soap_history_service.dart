import 'package:shared_preferences/shared_preferences.dart';

/// Riwayat isian form SOAP/CPPT per kolom utk saran (autocomplete) —
/// padanan localStorage `<kolom>_history` di Pemeriksaan.tsx (web): disimpan
/// DI PERANGKAT ini (bukan di server, jadi tidak ikut pindah perangkat &
/// dipakai bersama semua akun di tablet yg sama), maksimal 20 isian
/// terakhir per kolom, yg terbaru di depan.
class SoapHistoryService {
  static const maxItems = 20;
  static const maxSuggestions = 10;

  static Future<Map<String, List<String>>> loadAll(Iterable<String> keys) async {
    final prefs = await SharedPreferences.getInstance();
    return {for (final k in keys) k: prefs.getStringList(k) ?? const []};
  }

  /// Taruh [value] di depan riwayat [key] (duplikat dibuang), lalu simpan.
  /// Balikin riwayat terbarunya. Riwayat SELALU dibaca ulang dari
  /// penyimpanan (bukan dari [fallback] pemanggil) krn satu kunci bisa
  /// ditulis dari beberapa tempat — mis. Aturan Pakai dari modal obat &
  /// dari tabel racikan; [fallback] cuma dipakai kalau [value] kosong.
  static Future<List<String>> add(String key, String value, List<String> fallback) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return fallback;
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getStringList(key) ?? const <String>[];
    final next = [trimmed, ...current.where((v) => v != trimmed)].take(maxItems).toList();
    await prefs.setStringList(key, next);
    return next;
  }

  /// Saran utk [input]: kosong -> 10 isian terakhir; terisi -> yg DIAWALI
  /// input dulu, baru yg MENGANDUNG input (sama urutan dgn web).
  static List<String> suggest(List<String> history, String input) {
    final q = input.trim().toLowerCase();
    if (q.isEmpty) return history.take(maxSuggestions).toList();
    final startsWith = <String>[];
    final contains = <String>[];
    for (final item in history) {
      final lower = item.toLowerCase();
      if (lower == q) continue; // sama persis dgn yg sudah diketik — tak perlu disarankan
      if (lower.startsWith(q)) {
        startsWith.add(item);
      } else if (lower.contains(q)) {
        contains.add(item);
      }
    }
    return [...startsWith, ...contains].take(maxSuggestions).toList();
  }
}
