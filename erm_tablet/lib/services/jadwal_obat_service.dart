import '../models/jadwal_obat_item.dart';
import 'api_client.dart';

/// Jadwal Obat — pengganti digital Formulir Pemberian Obat RM.14 (kertas).
/// Endpoint SAMA PERSIS dgn ModalJadwalObat.tsx (web,
/// backend/jadwal_obat_handler.go) — sudah dibangun & teruji sesi
/// sebelumnya, di sini cuma dikonsumsi apa adanya, TIDAK ada endpoint
/// baru dibuat khusus app tablet ini.
class JadwalObatService {
  static Future<List<FrekuensiRef>> getFrekuensiRef() async {
    final list = await ApiClient.getJsonArray('/api/jadwal-obat/frekuensi-ref');
    return list.map(FrekuensiRef.fromJson).toList();
  }

  static Future<List<JadwalObatItem>> getList(String noRawat, String tglDari, String tglSampai) async {
    final list = await ApiClient.getJsonArray('/api/jadwal-obat/list', query: {
      'no_rawat': noRawat,
      'tgl_dari': tglDari,
      'tgl_sampai': tglSampai,
    });
    return list.map(JadwalObatItem.fromJson).toList();
  }

  static Future<void> tambah({
    required String noRawat,
    required String namaObat,
    required String sumber,
    required String frekuensi,
    required String tglMulai,
    required String createdBy,
  }) {
    return ApiClient.postJson('/api/jadwal-obat', {
      'no_rawat': noRawat,
      'nama_obat': namaObat,
      'sumber': sumber,
      'frekuensi': frekuensi,
      'tgl_mulai': tglMulai,
      'created_by': createdBy,
    });
  }

  static Future<void> hentikan(int id) {
    return ApiClient.putJson('/api/jadwal-obat/$id/hentikan', {});
  }

  static Future<void> tandai({
    required int jadwalObatId,
    required String tanggal,
    required int slotIndex,
    required String tanda,
    String catatan = '',
    required String markedBy,
  }) {
    return ApiClient.putJson('/api/jadwal-obat/tanda', {
      'jadwal_obat_id': jadwalObatId,
      'tanggal': tanggal,
      'slot_index': slotIndex,
      'tanda': tanda,
      'catatan': catatan,
      'marked_by': markedBy,
    });
  }

  static Future<void> hapusTanda({required int jadwalObatId, required String tanggal, required int slotIndex}) {
    return ApiClient.deleteJson('/api/jadwal-obat/tanda?jadwal_obat_id=$jadwalObatId&tanggal=$tanggal&slot_index=$slotIndex');
  }
}
