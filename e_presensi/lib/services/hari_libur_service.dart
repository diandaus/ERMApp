import '../models/hari_libur_row.dart';
import 'api_client.dart';

/// Padanan pemanggilan API Kalender Libur Otomatis di
/// backend/hari_libur_handler.go.
class HariLiburService {
  static Future<List<HariLiburRow>> getList({required int tahun, int? bulan}) async {
    final list = await ApiClient.getJsonArray('/api/hari-libur', query: {
      'tahun': '$tahun',
      if (bulan != null) 'bulan': bulan.toString().padLeft(2, '0'),
    });
    return list.map(HariLiburRow.fromJson).toList();
  }

  /// Tarik hari libur nasional & cuti bersama dari API publik, simpan
  /// lokal — dipicu manual (butuh koneksi luar), hasilnya jumlah baris
  /// yg berhasil disinkron.
  static Future<int> sync({required int tahun}) async {
    final data = await ApiClient.postJson('/api/hari-libur/sync?tahun=$tahun', {});
    return data['jumlah'] as int? ?? 0;
  }

  static Future<String> tambah({required String tanggal, required String keterangan}) async {
    final data = await ApiClient.postJson('/api/hari-libur', {
      'tanggal': tanggal,
      'keterangan': keterangan,
    });
    return data['message'] as String? ?? 'Hari libur berhasil ditambahkan';
  }

  static Future<void> hapus(int id) async {
    await ApiClient.deleteJson('/api/hari-libur/$id');
  }
}
