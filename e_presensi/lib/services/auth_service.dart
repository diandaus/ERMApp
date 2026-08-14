import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/app_user.dart';
import 'api_client.dart';

/// Login & sesi — padanan localStorage 'ermapp_user' di App.tsx (web).
/// POST /api/auth/login sama persis dgn yg dipakai web, tidak ada
/// endpoint baru.
class AuthService {
  static const _prefsKey = 'e_presensi_user';

  static Future<AppUser> login(String username, String password) async {
    final data = await ApiClient.postJson('/api/auth/login', {
      'username': username,
      'password': password,
    });
    final user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    await _saveSession(user);
    return user;
  }

  static Future<void> _saveSession(AppUser user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(user.toJson()));
  }

  static Future<AppUser?> getSavedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return null;
    try {
      return AppUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      await prefs.remove(_prefsKey);
      return null;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }

  /// Ganti password sendiri (wajib tahu password lama) — beda dari reset
  /// password admin-only. Padanan POST /api/auth/change-password.
  static Future<void> changePassword({
    required int id,
    required String oldPassword,
    required String newPassword,
  }) {
    return ApiClient.postJson('/api/auth/change-password', {
      'id': id,
      'old_password': oldPassword,
      'new_password': newPassword,
    });
  }
}
