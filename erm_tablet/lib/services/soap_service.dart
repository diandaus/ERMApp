import '../models/soap_item.dart';
import 'api_client.dart';

/// SOAP/CPPT Rawat Inap — endpoint sama persis dgn PemeriksaanRanap.tsx
/// (web), tidak ada endpoint baru.
class SoapService {
  static Future<List<SoapItem>> getRiwayat(String noRawat) async {
    final list = await ApiClient.getJsonArray('/api/pemeriksaan-ranap/$noRawat');
    return list.map(SoapItem.fromJson).toList();
  }

  /// tglPerawatan/jamRawat dibiarkan kosong -> backend otomatis pakai
  /// waktu sekarang (padanan checkbox "Otomatis" di web, default aktif).
  static Future<void> simpan({
    required String noRawat,
    required String nip,
    required String keluhan,
    required String pemeriksaan,
    required String penilaian,
    required String rtl,
    String instruksi = '',
    String evaluasi = '',
    String tensi = '',
    String suhuTubuh = '',
    String nadi = '',
    String respirasi = '',
    String tinggi = '',
    String berat = '',
    String spo2 = '',
    String gcs = '',
    String kesadaran = 'Compos Mentis',
    String alergi = '',
  }) {
    // Catatan: backend/pemeriksaan_ranap_handler.go (SoapRanapPayload) TIDAK
    // punya kolom lingkar_perut sama sekali (beda dari pemeriksaan_ralan yg
    // punya) — lihat komentar di satu_sehat_handler.go "pemeriksaan_ranap
    // tidak punya kolom lingkar_perut". Web msh nampilin field L.P. di form
    // Ranap tapi nilainya dibuang diam2 oleh backend, jadi SENGAJA tidak
    // direplikasi di sini spy tidak menyesatkan (nurse ngisi tp gak kesimpan).
    return ApiClient.postJson('/api/pemeriksaan-ranap', {
      'no_rawat': noRawat,
      'nip': nip,
      'keluhan': keluhan,
      'pemeriksaan': pemeriksaan,
      'penilaian': penilaian,
      'rtl': rtl,
      'instruksi': instruksi,
      'evaluasi': evaluasi,
      'tensi': tensi,
      'suhu_tubuh': suhuTubuh,
      'nadi': nadi,
      'respirasi': respirasi,
      'tinggi': tinggi,
      'berat': berat,
      'spo2': spo2,
      'gcs': gcs,
      'kesadaran': kesadaran,
      'alergi': alergi,
    });
  }
}
