import 'package:flutter/material.dart';

import '../services/jadwal_pegawai_service.dart';

const _kBlue = Color(0xFF2563EB);
const _kRed = Color(0xFFDC2626);
const _kRedBg = Color(0xFFFEE2E2);
const _kBorder = Color(0xFFE5E7EB);
const _kHariMinFirst = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const _kBulanIndo = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/// Hasil modal — bulan/tahun BISA beda dari yg dibuka (kalau user geser
/// ke bulan lain), jadi si pemanggil perlu tahu tanggal2 ini utk bulan
/// yg mana.
typedef TanggalPickerResult = ({int tahun, int bulan, Set<int> tanggal});

/// Modal kalender — user tap tanggal2 spesifik (jadi biru kalau
/// terpilih), lalu Simpan. Dipakai utk "Atur Tanggal Masuk" pd shift
/// selain Reguler (bukan hari berulang spt Jadwal Tetap). Bisa
/// digeser/swipe ke atas (bulan berikutnya) atau bawah (bulan
/// sebelumnya) — pindah bulan otomatis reset tanggal yg lagi dipilih &
/// muat ulang tanda merah "sudah kepakai" (h1..h31 beda tiap bulan)
/// utk [pegawaiIds] yg sama.
Future<TanggalPickerResult?> showTanggalPickerModal(
  BuildContext context, {
  required int tahun,
  required int bulan,
  required List<int> pegawaiIds,
  String? departemen,
  Set<int> pendingTanggal = const {},
}) {
  return showModalBottomSheet<TanggalPickerResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _TanggalPickerSheet(
      tahunAwal: tahun,
      bulanAwal: bulan,
      pegawaiIds: pegawaiIds,
      departemen: departemen,
      pendingTanggalAwal: pendingTanggal,
    ),
  );
}

class _TanggalPickerSheet extends StatefulWidget {
  final int tahunAwal;
  final int bulanAwal;
  final List<int> pegawaiIds;
  final String? departemen;
  // Tanggal yg sudah dipilih user sesi ini tapi belum disimpan ke
  // server (blue chip di Riwayat Tanggal outer view) — HANYA relevan
  // kalau modal masih di bulan awal (tahunAwal/bulanAwal), krn pending
  // itu spesifik ke bulan itu. Ikut ditandai merah sbg referensi
  // "sudah kepakai" (lihat _loadTerisi).
  final Set<int> pendingTanggalAwal;
  const _TanggalPickerSheet({
    required this.tahunAwal,
    required this.bulanAwal,
    required this.pegawaiIds,
    required this.departemen,
    required this.pendingTanggalAwal,
  });

  @override
  State<_TanggalPickerSheet> createState() => _TanggalPickerSheetState();
}

class _TanggalPickerSheetState extends State<_TanggalPickerSheet> {
  late int _tahun;
  late int _bulan;
  final Set<int> _selected = {};
  Set<int> _terisi = {};
  bool _loadingTerisi = true;

  @override
  void initState() {
    super.initState();
    _tahun = widget.tahunAwal;
    _bulan = widget.bulanAwal;
    _loadTerisi();
  }

  // Tanda merah "sudah kepakai" itu spesifik per bulan (kolom h1..h31
  // beda tiap bulan) — jadi tiap pindah bulan wajib difetch ulang,
  // bukan cuma dihitung sekali di awal spt sebelumnya.
  Future<void> _loadTerisi() async {
    setState(() => _loadingTerisi = true);
    try {
      final list = await JadwalPegawaiService.getList(tahun: _tahun, bulan: _bulan, departemen: widget.departemen);
      final rows = list.where((p) => widget.pegawaiIds.contains(p.id)).toList();
      final result = <int>{};
      if (rows.isNotEmpty) {
        for (var day = 1; day <= 31; day++) {
          final idx = day - 1;
          final first = idx < rows.first.h.length ? rows.first.h[idx] : '';
          if (first.isEmpty) continue;
          final sama = rows.every((p) => (idx < p.h.length ? p.h[idx] : '') == first);
          if (sama) result.add(day);
        }
      }
      if (_tahun == widget.tahunAwal && _bulan == widget.bulanAwal) {
        result.addAll(widget.pendingTanggalAwal);
      }
      if (!mounted) return;
      setState(() {
        _terisi = result;
        _loadingTerisi = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingTerisi = false);
    }
  }

  // Ganti bulan (geser/swipe atau tombol panah) — tanggal yg lagi
  // dipilih direset (spesifik ke bulan lama, gak nyambung ke bulan
  // baru), lalu muat ulang tanda merah utk bulan barunya.
  void _gantiBulan(int delta) {
    setState(() {
      var m = _bulan + delta;
      var y = _tahun;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      _bulan = m;
      _tahun = y;
      _selected.clear();
    });
    _loadTerisi();
  }

  void _onVerticalSwipe(DragEndDetails details) {
    final v = details.primaryVelocity ?? 0;
    if (v.abs() < 200) return; // geseran terlalu pelan, abaikan
    // Geser ke atas (jari dari bawah ke atas, velocity negatif) =
    // bulan berikutnya; ke bawah = bulan sebelumnya.
    _gantiBulan(v < 0 ? 1 : -1);
  }

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(_tahun, _bulan + 1, 0).day;
    final firstWeekday = DateTime(_tahun, _bulan, 1).weekday; // 1=Sen..7=Min
    final leadingBlanks = firstWeekday % 7; // 0=Min..6=Sab, cocok kolom Min-first

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 36, height: 4, decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 16),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onVerticalDragEnd: _onVerticalSwipe,
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: () => _gantiBulan(-1),
                          icon: const Icon(Icons.keyboard_arrow_up, color: Color(0xFF9CA3AF)),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    ),
                    Text('${_kBulanIndo[_bulan]} $_tahun', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                    const SizedBox(height: 4),
                    Text(
                      _selected.isEmpty ? 'Ketuk tanggal untuk memilih · geser utk ganti bulan' : '${_selected.length} tanggal dipilih',
                      style: TextStyle(fontSize: 12, color: _selected.isEmpty ? const Color(0xFF9CA3AF) : _kBlue, fontWeight: FontWeight.w600),
                      textAlign: TextAlign.center,
                    ),
                    if (_terisi.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 10, height: 10, decoration: const BoxDecoration(color: _kRedBg, shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: _kRed)))),
                          const SizedBox(width: 6),
                          const Text('= sudah ada shift lain', style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                        ],
                      ),
                    ],
                    const SizedBox(height: 12),
                    if (_loadingTerisi)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      )
                    else
                      GridView.count(
                        crossAxisCount: 7,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                        children: [
                          ..._kHariMinFirst.map((h) => Center(child: Text(h, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF9CA3AF))))),
                          ...List.generate(leadingBlanks, (_) => const SizedBox.shrink()),
                          ...List.generate(daysInMonth, (i) {
                            final day = i + 1;
                            final active = _selected.contains(day);
                            final terisi = !active && _terisi.contains(day);
                            return GestureDetector(
                              onTap: () => setState(() {
                                if (active) {
                                  _selected.remove(day);
                                } else {
                                  _selected.add(day);
                                }
                              }),
                              child: Container(
                                margin: const EdgeInsets.all(2),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: active ? _kBlue : (terisi ? _kRedBg : Colors.transparent),
                                  shape: BoxShape.circle,
                                  border: terisi ? Border.all(color: _kRed) : null,
                                ),
                                child: Text(
                                  '$day',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: active ? Colors.white : (terisi ? _kRed : const Color(0xFF111827)),
                                    fontWeight: active || terisi ? FontWeight.w700 : FontWeight.w400,
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    IconButton(
                      onPressed: () => _gantiBulan(1),
                      icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF9CA3AF)),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                      child: const Text('Batal'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop((tahun: _tahun, bulan: _bulan, tanggal: _selected)),
                      style: ElevatedButton.styleFrom(backgroundColor: _kBlue, padding: const EdgeInsets.symmetric(vertical: 12)),
                      child: const Text('Simpan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
