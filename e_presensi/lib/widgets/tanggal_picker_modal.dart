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

// Jendela bulan yg ditampilkan di scroll menerus — 1 bulan ke belakang
// (koreksi tanggal baru lewat) s/d 11 bulan ke depan (setahun
// perencanaan shift ke depan), relatif ke bulan modal dibuka.
const _kBulanSebelum = 1;
const _kBulanSesudah = 11;

DateTime _tglOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// Modal kalender scroll-menerus (spt app Kalender bawaan HP — bulan
/// berikutnya udah keliatan dikit di bawah pas scroll) — user tap
/// tanggal2 spesifik (jadi biru), boleh nyebar di beberapa bulan
/// sekaligus, lalu Simpan. Dipakai utk "Atur Tanggal Masuk" pd shift
/// selain Reguler (bukan hari berulang spt Jadwal Tetap).
Future<Set<DateTime>?> showTanggalPickerModal(
  BuildContext context, {
  required int tahun,
  required int bulan,
  required List<int> pegawaiIds,
  String? departemen,
  Set<DateTime> pendingTanggal = const {},
}) {
  return showModalBottomSheet<Set<DateTime>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _TanggalPickerSheet(
      tahunAwal: tahun,
      bulanAwal: bulan,
      pegawaiIds: pegawaiIds,
      departemen: departemen,
      pendingTanggalAwal: pendingTanggal.map(_tglOnly).toSet(),
    ),
  );
}

class _TanggalPickerSheet extends StatefulWidget {
  final int tahunAwal;
  final int bulanAwal;
  final List<int> pegawaiIds;
  final String? departemen;
  final Set<DateTime> pendingTanggalAwal;
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
  final Set<DateTime> _selected = {};
  // Cache tanda merah per bulan (kunci "tahun-bulan") — supaya scroll
  // bolak-balik gak fetch ulang bulan yg sudah dimuat.
  final Map<String, Set<int>> _terisiCache = {};
  late final List<({int tahun, int bulan})> _bulanList;
  final _scrollController = ScrollController();
  final _todayKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _bulanList = List.generate(_kBulanSebelum + _kBulanSesudah + 1, (i) {
      final offset = i - _kBulanSebelum;
      var m = widget.bulanAwal + offset;
      var y = widget.tahunAwal;
      // Normalisasi manual (bukan DateTime(y, m).month) spy gak kena
      // pergeseran zona waktu/DST — bulan cuma butuh rollover sederhana.
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return (tahun: y, bulan: m);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollKeBulanAwal(animate: false));
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollKeBulanAwal({bool animate = true}) {
    final ctx = _todayKey.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      alignment: 0,
      duration: animate ? const Duration(milliseconds: 400) : Duration.zero,
      curve: Curves.easeInOut,
    );
  }

  // Tanda merah "sudah kepakai" spesifik per bulan — dimuat lazy pas
  // bagian bulan itu mau dirender (bukan semua 13 bulan sekaligus di
  // awal), dicache spy scroll bolak-balik gak fetch ulang. Tiap bulan
  // di [_bulanList] cuma muncul sekali & di-load sekali oleh
  // _BulanSection-nya sendiri, jadi gak ada race condition antar
  // pemanggil.
  Future<Set<int>> _loadTerisi(int tahun, int bulan) async {
    final key = '$tahun-$bulan';
    final cached = _terisiCache[key];
    if (cached != null) return cached;
    try {
      final list = await JadwalPegawaiService.getList(tahun: tahun, bulan: bulan, departemen: widget.departemen);
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
      _terisiCache[key] = result;
      return result;
    } catch (_) {
      _terisiCache[key] = {};
      return {};
    }
  }

  void _toggle(DateTime tgl) {
    setState(() {
      if (_selected.contains(tgl)) {
        _selected.remove(tgl);
      } else {
        _selected.add(tgl);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Center(
              child: Container(width: 36, height: 4, decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _selected.isEmpty ? 'Ketuk tanggal untuk memilih' : '${_selected.length} tanggal dipilih',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _selected.isEmpty ? const Color(0xFF9CA3AF) : _kBlue),
                    ),
                  ),
                  TextButton(
                    onPressed: () => _scrollKeBulanAwal(),
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), minimumSize: Size.zero),
                    child: const Text('Hari ini', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: _kHariMinFirst
                    .map((h) => Expanded(child: Center(child: Text(h, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF9CA3AF))))))
                    .toList(),
              ),
            ),
            const Divider(height: 12, color: _kBorder),
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.55,
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                itemCount: _bulanList.length,
                itemBuilder: (context, i) {
                  final b = _bulanList[i];
                  final isBulanAwal = b.tahun == widget.tahunAwal && b.bulan == widget.bulanAwal;
                  final pendingBulanIni = widget.pendingTanggalAwal
                      .where((d) => d.year == b.tahun && d.month == b.bulan)
                      .toSet();
                  return _BulanSection(
                    key: isBulanAwal ? _todayKey : null,
                    tahun: b.tahun,
                    bulan: b.bulan,
                    selected: _selected,
                    onToggle: _toggle,
                    loadTerisi: () => _loadTerisi(b.tahun, b.bulan),
                    pendingTanggalBulanIni: pendingBulanIni,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Row(
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
                      onPressed: () => Navigator.of(context).pop(_selected),
                      style: ElevatedButton.styleFrom(backgroundColor: _kBlue, padding: const EdgeInsets.symmetric(vertical: 12)),
                      child: const Text('Simpan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Satu bagian bulan di dalam scroll menerus — header nama bulan + grid
/// tanggalnya. Muat tanda merah sendiri (lazy, lewat [loadTerisi]) pas
/// widget ini pertama kali dirender.
class _BulanSection extends StatefulWidget {
  final int tahun;
  final int bulan;
  final Set<DateTime> selected;
  final void Function(DateTime) onToggle;
  final Future<Set<int>> Function() loadTerisi;
  final Set<DateTime> pendingTanggalBulanIni;
  const _BulanSection({
    super.key,
    required this.tahun,
    required this.bulan,
    required this.selected,
    required this.onToggle,
    required this.loadTerisi,
    required this.pendingTanggalBulanIni,
  });

  @override
  State<_BulanSection> createState() => _BulanSectionState();
}

class _BulanSectionState extends State<_BulanSection> {
  late Future<Set<int>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loadTerisi();
  }

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(widget.tahun, widget.bulan + 1, 0).day;
    final firstWeekday = DateTime(widget.tahun, widget.bulan, 1).weekday; // 1=Sen..7=Min
    final leadingBlanks = firstWeekday % 7; // 0=Min..6=Sab, cocok kolom Min-first
    final now = DateTime.now();
    final isBulanIni = widget.tahun == now.year && widget.bulan == now.month;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Text('${_kBulanIndo[widget.bulan]} ${widget.tahun}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        const SizedBox(height: 8),
        FutureBuilder<Set<int>>(
          future: _future,
          builder: (context, snapshot) {
            final terisiHari = snapshot.data ?? {};
            return GridView.count(
              crossAxisCount: 7,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              children: [
                ...List.generate(leadingBlanks, (_) => const SizedBox.shrink()),
                ...List.generate(daysInMonth, (i) {
                  final day = i + 1;
                  final tgl = DateTime(widget.tahun, widget.bulan, day);
                  final active = widget.selected.contains(tgl);
                  final terisi = !active && (terisiHari.contains(day) || widget.pendingTanggalBulanIni.contains(tgl));
                  // Hari ini — merah solid + font putih, spt app Kalender
                  // bawaan HP, biar user langsung ngeh tanggal berapa
                  // sekarang. Kalah prioritas dari active (biru, lagi
                  // dipilih), tapi menang dari terisi (merah tipis).
                  final isHariIni = !active && isBulanIni && day == now.day;
                  return GestureDetector(
                    onTap: () => widget.onToggle(tgl),
                    child: Container(
                      margin: const EdgeInsets.all(2),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: active
                            ? _kBlue
                            : (isHariIni ? _kRed : (terisi ? _kRedBg : Colors.transparent)),
                        shape: BoxShape.circle,
                        border: (terisi && !isHariIni) ? Border.all(color: _kRed) : null,
                      ),
                      child: Text(
                        '$day',
                        style: TextStyle(
                          fontSize: 13,
                          color: (active || isHariIni) ? Colors.white : (terisi ? _kRed : const Color(0xFF111827)),
                          fontWeight: active || terisi || isHariIni ? FontWeight.w700 : FontWeight.w400,
                        ),
                      ),
                    ),
                  );
                }),
              ],
            );
          },
        ),
      ],
    );
  }
}
