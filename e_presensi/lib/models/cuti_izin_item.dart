/// Padanan CutiIzinRow di backend/cuti_izin_handler.go.
class CutiIzinItem {
  final String noPengajuan;
  final String tanggalAwal;
  final String tanggalAkhir;
  final String urgensi;
  final String alamat;
  final int jumlah;
  final String kepentingan;
  final String namaPj;
  final String status; // Proses Pengajuan | Disetujui | Ditolak
  final String catatanApproval;
  final String disetujuiOleh;

  CutiIzinItem({
    required this.noPengajuan,
    required this.tanggalAwal,
    required this.tanggalAkhir,
    required this.urgensi,
    required this.alamat,
    required this.jumlah,
    required this.kepentingan,
    required this.namaPj,
    required this.status,
    required this.catatanApproval,
    required this.disetujuiOleh,
  });

  factory CutiIzinItem.fromJson(Map<String, dynamic> json) {
    return CutiIzinItem(
      noPengajuan: json['no_pengajuan'] as String? ?? '',
      tanggalAwal: json['tanggal_awal'] as String? ?? '',
      tanggalAkhir: json['tanggal_akhir'] as String? ?? '',
      urgensi: json['urgensi'] as String? ?? '',
      alamat: json['alamat'] as String? ?? '',
      jumlah: json['jumlah'] as int? ?? 0,
      kepentingan: json['kepentingan'] as String? ?? '',
      namaPj: json['nama_pj'] as String? ?? '',
      status: json['status'] as String? ?? 'Proses Pengajuan',
      catatanApproval: json['catatan_approval'] as String? ?? '',
      disetujuiOleh: json['disetujui_oleh'] as String? ?? '',
    );
  }
}
