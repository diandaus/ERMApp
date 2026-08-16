/// Padanan OperasiItem di PresensiMobile.tsx — GET /api/booking-operasi/list
/// (backend/booking_operasi_handler.go), dipakai jadwal operasi hari ini di
/// tab Operasi.
class BookingOperasiItem {
  final String noRawat;
  final String noRkmMedis;
  final String namaPasien;
  final String umur;
  final String jk;
  final String tanggal;
  final String jamMulai;
  final String jamSelesai;
  final String status;
  final String rujukanDari;
  final String diagnosa;
  final String kodeOperasi;
  final String operasi;
  final String kodeOperator;
  final String operator;
  final String order;
  final String kodeOk;
  final String namaRuangOperasi;

  BookingOperasiItem({
    required this.noRawat,
    required this.noRkmMedis,
    required this.namaPasien,
    required this.umur,
    required this.jk,
    required this.tanggal,
    required this.jamMulai,
    required this.jamSelesai,
    required this.status,
    required this.rujukanDari,
    required this.diagnosa,
    required this.kodeOperasi,
    required this.operasi,
    required this.kodeOperator,
    required this.operator,
    required this.order,
    required this.kodeOk,
    required this.namaRuangOperasi,
  });

  factory BookingOperasiItem.fromJson(Map<String, dynamic> json) {
    return BookingOperasiItem(
      noRawat: json['no_rawat'] as String? ?? '',
      noRkmMedis: json['no_rkm_medis'] as String? ?? '',
      namaPasien: json['nama_pasien'] as String? ?? '',
      umur: json['umur'] as String? ?? '',
      jk: json['jk'] as String? ?? '',
      tanggal: json['tanggal'] as String? ?? '',
      jamMulai: json['jam_mulai'] as String? ?? '',
      jamSelesai: json['jam_selesai'] as String? ?? '',
      status: json['status'] as String? ?? '',
      rujukanDari: json['rujukan_dari'] as String? ?? '',
      diagnosa: json['diagnosa'] as String? ?? '',
      kodeOperasi: json['kode_operasi'] as String? ?? '',
      operasi: json['operasi'] as String? ?? '',
      kodeOperator: json['kode_operator'] as String? ?? '',
      operator: json['operator'] as String? ?? '',
      order: json['order'] as String? ?? '',
      kodeOk: json['kode_ok'] as String? ?? '',
      namaRuangOperasi: json['nama_ruang_operasi'] as String? ?? '',
    );
  }
}
