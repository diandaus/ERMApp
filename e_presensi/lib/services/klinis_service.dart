import '../models/farmasi_resep_item.dart';
import '../models/pasien_kunjungan_item.dart';
import '../models/permintaan_queue_item.dart';
import '../models/ranap_pasien_item.dart';
import 'api_client.dart';

/// Padanan pemanggilan antrean klinis (Poli/IGD/Ranap/Farmasi/Lab/
/// Radiologi) di PresensiMobile.tsx — semua endpoint sudah ada & dipakai
/// versi web, di sini cuma dikonsumsi apa adanya (read-only).
class KlinisService {
  static Future<List<PasienKunjunganItem>> getPoliToday() async {
    final list = await ApiClient.getJsonArray('/api/rawat-jalan/poli-today');
    return list.map(PasienKunjunganItem.fromJson).toList();
  }

  static Future<List<PasienKunjunganItem>> getIgdList() async {
    final list = await ApiClient.getJsonArray('/api/igd/list');
    return list.map(PasienKunjunganItem.fromJson).toList();
  }

  static Future<List<RanapPasienItem>> getRanapList({String? kdDokter}) async {
    final list = await ApiClient.getJsonArray(
      '/api/rawat-inap/list',
      query: {'status': 'belum-pulang', if (kdDokter != null && kdDokter.isNotEmpty) 'kd_dokter': kdDokter},
    );
    return list.map(RanapPasienItem.fromJson).toList();
  }

  static Future<List<FarmasiResepItem>> getFarmasiRalan() async {
    final list = await ApiClient.getJsonArray('/api/permintaan-resep/ralan');
    return list.map(FarmasiResepItem.fromJson).toList();
  }

  static Future<List<PermintaanQueueItem>> getLabList() async {
    final list = await ApiClient.getJsonArray('/api/lab/list');
    return list.map(PermintaanQueueItem.fromJson).toList();
  }

  static Future<List<PermintaanQueueItem>> getRadiologiList() async {
    final list = await ApiClient.getJsonArray('/api/radiologi/list');
    return list.map(PermintaanQueueItem.fromJson).toList();
  }
}
