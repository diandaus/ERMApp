import '../models/jadwal_row.dart';
import '../models/presensi_hari_ini.dart';
import '../models/presensi_profil.dart';
import '../models/riwayat_row.dart';
import 'api_client.dart';

/// Padanan pemanggilan /api/presensi/* di PresensiMobile.tsx.
class PresensiService {
  static Future<PresensiMe> getMe(String nik) async {
    final data = await ApiClient.getJson('/api/presensi/me', query: {'nik': nik});
    return PresensiMe.fromJson(data);
  }

  static Future<PresensiHariIni?> getHariIni(String nik) async {
    return (await getMe(nik)).hariIni;
  }

  /// Padanan GET /api/presensi/jadwal?nik=... — spt versi web, tidak
  /// kirim bulan/tahun jadi selalu balikin bulan berjalan.
  static Future<List<JadwalRow>> getJadwal(String nik) async {
    final list = await ApiClient.getJsonArray('/api/presensi/jadwal', query: {'nik': nik});
    return list.map(JadwalRow.fromJson).toList();
  }

  /// Padanan GET /api/presensi/riwayat?nik=... — spt versi web, tidak
  /// kirim bulan/tahun jadi selalu balikin bulan berjalan.
  static Future<List<RiwayatRow>> getRiwayat(String nik) async {
    final list = await ApiClient.getJsonArray('/api/presensi/riwayat', query: {'nik': nik});
    return list.map(RiwayatRow.fromJson).toList();
  }

  static Future<PresensiProfil> getProfil(String nik) async {
    final data = await ApiClient.getJson('/api/presensi/profil', query: {'nik': nik});
    return PresensiProfil.fromJson(data);
  }

  static Future<void> updateFotoProfil(String nik, String photoUrl) {
    return ApiClient.putJson('/api/presensi/profil/foto', {'nik': nik, 'photo': photoUrl});
  }

  /// Padanan PUT /api/presensi/profil (updatePresensiProfil di
  /// presensi_handler.go) — Nama & Email disimpan ke pegawai, No.
  /// Handphone ke petugas/dokter (NIP tidak ikut dikirim, dipakai murni
  /// kunci pencarian baris). Balikin body mentah (bukan cuma void) krn
  /// backend bisa sisipkan {"peringatan": "..."} kalau No. Handphone
  /// gagal tersimpan (akun belum tertaut ke petugas/dokter) walau Nama/
  /// Email tetap berhasil.
  static Future<Map<String, dynamic>> updateProfil({
    required String nik,
    required String nama,
    required String noTelp,
    required String email,
  }) {
    return ApiClient.putJson('/api/presensi/profil', {
      'nik': nik,
      'nama': nama,
      'no_telp': noTelp,
      'email': email,
    });
  }

  static Future<String> uploadFotoProfil(List<int> bytes) async {
    final filename = 'profil-${DateTime.now().millisecondsSinceEpoch}.jpg';
    final data = await ApiClient.uploadFile('/api/upload', bytes, filename);
    return (data['url'] ?? data['path'] ?? data['filename'] ?? '') as String;
  }

  static Future<String> uploadFoto(List<int> bytes) async {
    final filename = 'presensi-${DateTime.now().millisecondsSinceEpoch}.jpg';
    final data = await ApiClient.uploadFile('/api/upload', bytes, filename);
    return (data['url'] ?? data['path'] ?? data['filename'] ?? '') as String;
  }

  static Future<Map<String, dynamic>> checkin({
    required String nik,
    required double lat,
    required double lng,
    required String alamat,
    required String photo,
  }) {
    return ApiClient.postJson('/api/presensi/checkin', {
      'nik': nik,
      'lat': lat,
      'lng': lng,
      'alamat': alamat,
      'photo': photo,
    });
  }

  static Future<Map<String, dynamic>> checkout({
    required String nik,
    required double lat,
    required double lng,
    required String alamat,
    required String photo,
  }) {
    return ApiClient.postJson('/api/presensi/checkout', {
      'nik': nik,
      'lat': lat,
      'lng': lng,
      'alamat': alamat,
      'photo': photo,
    });
  }
}
