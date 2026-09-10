/// Padanan 1 baris riwayat SOAP/CPPT — GET /api/pemeriksaan-ranap/:no_rawat
/// (backend/pemeriksaan_ranap_handler.go: PemeriksaanRanapDetail).
/// tgl_perawatan dari GET berformat DD/MM/YYYY (DATE_FORMAT backend),
/// BEDA dari format yg dikirim balik saat POST/PUT (YYYY-MM-DD) — jangan
/// dipakai bolak-balik tanpa konversi kalau nanti ada fitur edit.
class SoapItem {
  final String tglPerawatan;
  final String jamRawat;
  final String suhuTubuh;
  final String tensi;
  final String nadi;
  final String respirasi;
  final String tinggi;
  final String berat;
  final String spo2;
  final String gcs;
  final String kesadaran;
  final String keluhan;
  final String pemeriksaan;
  final String alergi;
  final String rtl; // Planning
  final String penilaian; // Assessment
  final String instruksi;
  final String evaluasi;
  final String nip;
  final String nama; // nama pegawai yg mengisi (join pegawai.nama)
  final String jbtn;

  SoapItem({
    required this.tglPerawatan,
    required this.jamRawat,
    required this.suhuTubuh,
    required this.tensi,
    required this.nadi,
    required this.respirasi,
    required this.tinggi,
    required this.berat,
    required this.spo2,
    required this.gcs,
    required this.kesadaran,
    required this.keluhan,
    required this.pemeriksaan,
    required this.alergi,
    required this.rtl,
    required this.penilaian,
    required this.instruksi,
    required this.evaluasi,
    required this.nip,
    required this.nama,
    required this.jbtn,
  });

  factory SoapItem.fromJson(Map<String, dynamic> json) {
    String s(String key) => json[key] as String? ?? '';
    return SoapItem(
      tglPerawatan: s('tgl_perawatan'),
      jamRawat: s('jam_rawat'),
      suhuTubuh: s('suhu_tubuh'),
      tensi: s('tensi'),
      nadi: s('nadi'),
      respirasi: s('respirasi'),
      tinggi: s('tinggi'),
      berat: s('berat'),
      spo2: s('spo2'),
      gcs: s('gcs'),
      kesadaran: s('kesadaran'),
      keluhan: s('keluhan'),
      pemeriksaan: s('pemeriksaan'),
      alergi: s('alergi'),
      rtl: s('rtl'),
      penilaian: s('penilaian'),
      instruksi: s('instruksi'),
      evaluasi: s('evaluasi'),
      nip: s('nip'),
      nama: s('nama'),
      jbtn: s('jbtn'),
    );
  }
}
