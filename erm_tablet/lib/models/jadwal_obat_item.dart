/// Padanan JadwalObatItem/TandaCell di ModalJadwalObat.tsx (web) — GET
/// /api/jadwal-obat/list (backend/jadwal_obat_handler.go). Endpoint sama
/// persis, tidak ada endpoint baru dibuat khusus app ini.
class TandaCell {
  final String tanda; // V/T/K/A
  final String catatan;
  final String markedBy;
  final String markedAt;

  TandaCell({required this.tanda, required this.catatan, required this.markedBy, required this.markedAt});

  factory TandaCell.fromJson(Map<String, dynamic> json) {
    return TandaCell(
      tanda: json['tanda'] as String? ?? '',
      catatan: json['catatan'] as String? ?? '',
      markedBy: json['marked_by'] as String? ?? '',
      markedAt: json['marked_at'] as String? ?? '',
    );
  }
}

class JadwalObatItem {
  final int id;
  final String noRawat;
  final String namaObat;
  final String sumber; // 'resep' | 'manual'
  final String frekuensi;
  final String tglMulai;
  final String status; // 'aktif' | 'dihentikan'
  final String createdBy;
  final List<String> jamList;
  // tanggal (YYYY-MM-DD) -> slot_index (string) -> TandaCell
  final Map<String, Map<String, TandaCell>> tanda;

  JadwalObatItem({
    required this.id,
    required this.noRawat,
    required this.namaObat,
    required this.sumber,
    required this.frekuensi,
    required this.tglMulai,
    required this.status,
    required this.createdBy,
    required this.jamList,
    required this.tanda,
  });

  factory JadwalObatItem.fromJson(Map<String, dynamic> json) {
    final tandaRaw = json['tanda'] as Map<String, dynamic>? ?? {};
    final tanda = <String, Map<String, TandaCell>>{};
    tandaRaw.forEach((tgl, slots) {
      final slotMap = <String, TandaCell>{};
      (slots as Map<String, dynamic>).forEach((idx, cell) {
        slotMap[idx] = TandaCell.fromJson(cell as Map<String, dynamic>);
      });
      tanda[tgl] = slotMap;
    });
    return JadwalObatItem(
      id: json['id'] as int,
      noRawat: json['no_rawat'] as String? ?? '',
      namaObat: json['nama_obat'] as String? ?? '',
      sumber: json['sumber'] as String? ?? 'manual',
      frekuensi: json['frekuensi'] as String? ?? '',
      tglMulai: json['tgl_mulai'] as String? ?? '',
      status: json['status'] as String? ?? 'aktif',
      createdBy: json['created_by'] as String? ?? '',
      jamList: (json['jam_list'] as List<dynamic>? ?? []).map((e) => e as String).toList(),
      tanda: tanda,
    );
  }

  TandaCell? tandaAt(String tanggal, int slotIndex) => tanda[tanggal]?[slotIndex.toString()];
}

class FrekuensiRef {
  final String frekuensi;
  final List<String> jamList;
  FrekuensiRef({required this.frekuensi, required this.jamList});

  factory FrekuensiRef.fromJson(Map<String, dynamic> json) {
    return FrekuensiRef(
      frekuensi: json['frekuensi'] as String? ?? '',
      jamList: (json['jam_list'] as List<dynamic>? ?? []).map((e) => e as String).toList(),
    );
  }
}
