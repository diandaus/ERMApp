import 'api_client.dart';
import 'api_config.dart';

/// Identitas RS utk navbar (nama + logo) — endpoint SAMA dgn web
/// (/api/admin/settings, dipakai kop cetak). Logo disajikan backend di
/// /uploads/..., jadi URL-nya digabung dgn kApiBaseUrl.
class InstansiInfo {
  final String nama;
  final String logoUrl;
  const InstansiInfo({required this.nama, required this.logoUrl});
}

class InstansiService {
  static Future<InstansiInfo> get() async {
    final m = await ApiClient.getJson('/api/admin/settings');
    final logo = (m['logo_url'] ?? '').toString();
    return InstansiInfo(
      nama: (m['nama_instansi'] ?? '').toString(),
      logoUrl: logo.isEmpty ? '' : (logo.startsWith('http') ? logo : '$kApiBaseUrl$logo'),
    );
  }
}
