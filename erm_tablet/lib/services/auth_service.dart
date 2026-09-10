import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/app_user.dart';
import 'api_client.dart';

/// Login & sesi — padanan localStorage 'ermapp_user' di Auth.tsx (web).
/// POST /api/auth/login sama persis dgn yg dipakai web, tidak ada
/// endpoint baru. Pola diadaptasi dari e_presensi/lib/services/
/// auth_service.dart (proven, sudah dipakai production).
class AuthService {
  static const _prefsKey = 'erm_tablet_user';
  static const _rememberedUsernameKey = 'erm_tablet_remembered_username';

  static Future<AppUser> login(String username, String password, {required bool rememberMe}) async {
    final data = await ApiClient.postJson('/api/auth/login', {
      'username': username,
      'password': password,
    });
    final user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    if (rememberMe) {
      await prefs.setString(_prefsKey, jsonEncode(user.toJson()));
      await prefs.setString(_rememberedUsernameKey, username);
    } else {
      await prefs.remove(_prefsKey);
      await prefs.remove(_rememberedUsernameKey);
    }
    return user;
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

  static Future<String?> getRememberedUsername() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_rememberedUsernameKey);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }
}
