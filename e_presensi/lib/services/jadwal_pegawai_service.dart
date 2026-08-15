import '../models/jadwal_pegawai_row.dart';
import '../models/jam_masuk_opsi.dart';
import 'api_client.dart';

/// Padanan pemanggilan API "Jadwal Tetap" di JadwalPegawai.tsx (versi
/// web) — bulk-assign shift berulang (per hari, bukan tanggal spesifik)
/// ke banyak pegawai sekaligus.
class JadwalPegawaiService {
  static Future<List<JadwalPegawaiRow>> getList({
    required int tahun,
    required int bulan,
    String? departemen,
    String? search,
  }) async {
    final list = await ApiClient.getJsonArray('/api/jadwal-pegawai/list', query: {
      'tahun': '$tahun',
      'bulan': _pad2(bulan),
      if (departemen != null && departemen.isNotEmpty) 'departemen': departemen,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return list.map(JadwalPegawaiRow.fromJson).toList();
  }

  // Kolom `bulan` di tabel jadwal_pegawai adalah ENUM string 2-digit
  // ('01'..'12', sama spt yg dikirim versi web) — kirim "8" tanpa
  // padding bikin MySQL diam2 nyimpen di baris/slot yg salah (tak
  // pernah ketemu lagi pas dibaca), padahal API balas sukses.
  static String _pad2(int n) => n.toString().padLeft(2, '0');

  static Future<List<JamMasukOpsi>> getJamMasukOpsi() async {
    final list = await ApiClient.getJsonArray('/api/jam-masuk/opsi');
    return list.map(JamMasukOpsi.fromJson).toList();
  }

  static Future<String> terapkanBulk({
    required List<int> ids,
    required String shift,
    required List<int> hariAktif,
  }) async {
    final data = await ApiClient.putJson('/api/pegawai-jadwal-tetap', {
      'ids': ids,
      'shift': shift,
      'hari_aktif': hariAktif,
    });
    return data['message'] as String? ?? 'Jadwal tetap berhasil diterapkan';
  }

  /// Set shift ke tanggal kalender spesifik (bukan hari berulang) — utk
  /// shift selain Reguler, mis. jaga malam rotasi tanggal tertentu saja.
  static Future<String> terapkanTanggal({
    required List<int> ids,
    required int tahun,
    required int bulan,
    required List<int> tanggal,
    required String shift,
  }) async {
    final data = await ApiClient.putJson('/api/pegawai-jadwal-tanggal', {
      'ids': ids,
      'tahun': '$tahun',
      'bulan': _pad2(bulan),
      'tanggal': tanggal,
      'shift': shift,
    });
    return data['message'] as String? ?? 'Jadwal tanggal berhasil diterapkan';
  }
}
