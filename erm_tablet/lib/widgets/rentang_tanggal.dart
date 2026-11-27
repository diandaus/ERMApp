import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme/app_theme.dart';

/// RentangTanggal — pemilih rentang tanggal gaya referensi user (aplikasi
/// kasir): dropdown preset di kiri ("Hari ini", "7 Hari Terakhir", ...) +
/// kotak [ ‹ | 08 Des 2024 - 08 Des 2024 | › ] di kanan. Panah menggeser
/// rentang satu periode (hari / bulan / sepanjang rentang); ketuk tanggal
/// di tengah membuka kalender rentang (preset jadi "Pilih Tanggal").
/// Dipakai modal Filter Rawat Inap & Poliklinik.
///
/// [value] null = tanpa batas tanggal — hanya bisa dipilih kalau
/// [bolehSemua] true (Rawat Inap: "Semua Tanggal").
class RentangTanggal extends StatelessWidget {
  final DateTimeRange? value;
  final ValueChanged<DateTimeRange?> onChanged;
  final bool bolehSemua;
  const RentangTanggal({super.key, required this.value, required this.onChanged, this.bolehSemua = false});

  static DateTime _d(DateTime t) => DateUtils.dateOnly(t);
  static DateTime get _today => _d(DateTime.now());

  static DateTimeRange? _rangeOf(_Preset p) {
    final t = _today;
    switch (p) {
      case _Preset.semua:
      case _Preset.custom:
        return null;
      case _Preset.hariIni:
        return DateTimeRange(start: t, end: t);
      case _Preset.kemarin:
        final k = t.subtract(const Duration(days: 1));
        return DateTimeRange(start: k, end: k);
      case _Preset.tujuhHari:
        return DateTimeRange(start: t.subtract(const Duration(days: 6)), end: t);
      case _Preset.tigaPuluhHari:
        return DateTimeRange(start: t.subtract(const Duration(days: 29)), end: t);
      case _Preset.bulanIni:
        return DateTimeRange(start: DateTime(t.year, t.month, 1), end: DateTime(t.year, t.month + 1, 0));
      case _Preset.bulanLalu:
        return DateTimeRange(start: DateTime(t.year, t.month - 1, 1), end: DateTime(t.year, t.month, 0));
    }
  }

  _Preset get _preset {
    final v = value;
    if (v == null) return _Preset.semua;
    for (final p in _Preset.values) {
      final r = _rangeOf(p);
      if (r != null && DateUtils.isSameDay(r.start, v.start) && DateUtils.isSameDay(r.end, v.end)) return p;
    }
    return _Preset.custom;
  }

  bool _isBulanPenuh(DateTimeRange r) =>
      r.start.day == 1 &&
      r.end.year == r.start.year &&
      r.end.month == r.start.month &&
      r.end.day == DateTime(r.start.year, r.start.month + 1, 0).day;

  void _geser(int arah) {
    final v = value;
    if (v == null) return;
    if (_isBulanPenuh(v)) {
      final s = DateTime(v.start.year, v.start.month + arah, 1);
      onChanged(DateTimeRange(start: s, end: DateTime(s.year, s.month + 1, 0)));
      return;
    }
    final hari = v.end.difference(v.start).inDays + 1;
    final delta = Duration(days: hari * arah);
    onChanged(DateTimeRange(start: _d(v.start.add(delta)), end: _d(v.end.add(delta))));
  }

  Future<void> _pilihKalender(BuildContext context) async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDateRange: value ?? DateTimeRange(start: _today, end: _today),
      helpText: 'Pilih rentang tanggal',
      saveText: 'Pilih',
    );
    if (picked != null) onChanged(DateTimeRange(start: _d(picked.start), end: _d(picked.end)));
  }

  @override
  Widget build(BuildContext context) {
    final preset = _preset;
    final presets = _Preset.values.where((p) => p != _Preset.semua || bolehSemua).toList();
    final fmt = DateFormat('dd MMM yyyy', 'id_ID');
    final label = value == null ? 'Semua tanggal' : '${fmt.format(value!.start)} - ${fmt.format(value!.end)}';

    final dropdown = Container(
      height: 48,
      padding: const EdgeInsets.only(left: 14, right: 8),
      decoration: BoxDecoration(border: Border.all(color: const Color(0xFFCFD1D1)), borderRadius: BorderRadius.circular(6)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<_Preset>(
          value: preset,
          isExpanded: true,
          icon: const Icon(Icons.arrow_drop_down, color: kText),
          style: const TextStyle(fontSize: 15, color: kText, fontFamily: 'Inter'),
          borderRadius: BorderRadius.circular(6),
          dropdownColor: Colors.white,
          items: [
            for (final p in presets)
              DropdownMenuItem(value: p, child: Text(p.label, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (p) {
            if (p == null || p == preset) return;
            if (p == _Preset.custom) {
              _pilihKalender(context);
            } else {
              onChanged(_rangeOf(p));
            }
          },
        ),
      ),
    );

    final aktif = value != null;
    Widget panah(IconData icon, int arah, BorderSide kiri, BorderSide kanan) => InkWell(
          onTap: aktif ? () => _geser(arah) : null,
          child: Container(
            width: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(border: Border(left: kiri, right: kanan)),
            child: Icon(icon, size: 22, color: aktif ? kText : const Color(0xFFCFD1D1)),
          ),
        );
    const garis = BorderSide(color: Color(0xFFCFD1D1));
    final kotak = Container(
      height: 48,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
      foregroundDecoration:
          BoxDecoration(border: Border.all(color: garis.color), borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.white,
        child: Row(children: [
          panah(Icons.chevron_left, -1, BorderSide.none, garis),
          Expanded(
            child: InkWell(
              onTap: () => _pilihKalender(context),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(label, style: const TextStyle(fontSize: 15, color: kText)),
                  ),
                ),
              ),
            ),
          ),
          panah(Icons.chevron_right, 1, garis, BorderSide.none),
        ]),
      ),
    );

    // Modal sempit (tablet kecil) -> susun atas-bawah; lebar -> sejajar.
    return LayoutBuilder(builder: (context, box) {
      if (box.maxWidth < 440) {
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          dropdown,
          const SizedBox(height: 10),
          kotak,
        ]);
      }
      return Row(children: [
        SizedBox(width: 180, child: dropdown),
        const SizedBox(width: 12),
        Expanded(child: kotak),
      ]);
    });
  }
}

enum _Preset {
  semua('Semua Tanggal'),
  hariIni('Hari ini'),
  kemarin('Kemarin'),
  tujuhHari('7 Hari Terakhir'),
  tigaPuluhHari('30 Hari Terakhir'),
  bulanIni('Bulan ini'),
  bulanLalu('Bulan lalu'),
  custom('Pilih Tanggal');

  final String label;
  const _Preset(this.label);
}
