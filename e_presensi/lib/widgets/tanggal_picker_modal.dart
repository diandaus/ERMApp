import 'package:flutter/material.dart';

const _kBlue = Color(0xFF2563EB);
const _kRed = Color(0xFFDC2626);
const _kRedBg = Color(0xFFFEE2E2);
const _kBorder = Color(0xFFE5E7EB);
const _kHariMinFirst = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const _kBulanIndo = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/// Modal kalender — user tap tanggal2 spesifik (jadi biru kalau
/// terpilih), lalu Simpan. Dipakai utk "Atur Tanggal Masuk" pd shift
/// selain Reguler (bukan hari berulang spt Jadwal Tetap).
Future<Set<int>?> showTanggalPickerModal(
  BuildContext context, {
  required int tahun,
  required int bulan,
  required Set<int> initialSelected,
  Set<int> tanggalTerisi = const {},
}) {
  return showModalBottomSheet<Set<int>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _TanggalPickerSheet(tahun: tahun, bulan: bulan, initialSelected: initialSelected, tanggalTerisi: tanggalTerisi),
  );
}

class _TanggalPickerSheet extends StatefulWidget {
  final int tahun;
  final int bulan;
  final Set<int> initialSelected;
  final Set<int> tanggalTerisi;
  const _TanggalPickerSheet({required this.tahun, required this.bulan, required this.initialSelected, required this.tanggalTerisi});

  @override
  State<_TanggalPickerSheet> createState() => _TanggalPickerSheetState();
}

class _TanggalPickerSheetState extends State<_TanggalPickerSheet> {
  late Set<int> _selected;

  @override
  void initState() {
    super.initState();
    _selected = {...widget.initialSelected};
  }

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(widget.tahun, widget.bulan + 1, 0).day;
    final firstWeekday = DateTime(widget.tahun, widget.bulan, 1).weekday; // 1=Sen..7=Min
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
              Text('${_kBulanIndo[widget.bulan]} ${widget.tahun}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
              const SizedBox(height: 4),
              Text(
                _selected.isEmpty ? 'Ketuk tanggal untuk memilih' : '${_selected.length} tanggal dipilih',
                style: TextStyle(fontSize: 12, color: _selected.isEmpty ? const Color(0xFF9CA3AF) : _kBlue, fontWeight: FontWeight.w600),
              ),
              if (widget.tanggalTerisi.isNotEmpty) ...[
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
                    final terisi = !active && widget.tanggalTerisi.contains(day);
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
              const SizedBox(height: 20),
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
                      onPressed: () => Navigator.of(context).pop(_selected),
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
