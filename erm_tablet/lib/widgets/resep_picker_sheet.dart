import 'package:flutter/material.dart';
import '../models/resep_ranap_item.dart';
import '../services/resep_ranap_service.dart';
import 'right_panel.dart';

const kBorder = Color(0xFFE5E7EB);

/// Hasil pilihan dari ResepPickerSheet — nama obat + aturan pakai mentah
/// (dipakai caller utk nebak Frekuensi via [detectFrekuensiFromAturanPakai]).
class ResepPickResult {
  final String namaObat;
  final String aturanPakai;
  ResepPickResult(this.namaObat, this.aturanPakai);
}

/// detectFrekuensiFromAturanPakai — coba tebak frekuensi (1x1..6x1) dari
/// teks aturan pakai resep (mis. "3 x 1 tab sehari" atau "2x1"). Padanan
/// persis detectFrekuensi() di ModalJadwalObat.tsx (web). Cuma DIISI
/// OTOMATIS sbg kemudahan awal, tetap bisa diganti manual, TIDAK pernah
/// override pilihan user setelahnya.
String detectFrekuensiFromAturanPakai(String aturanPakai, List<String> validFrekuensi) {
  final match = RegExp(r'([1-6])\s*[xX]\s*1\b').firstMatch(aturanPakai);
  if (match == null) return '';
  final guess = '${match.group(1)}x1';
  return validFrekuensi.contains(guess) ? guess : '';
}

/// showResepPickerSheet — landscape: panel geser dari kanan (40% layar,
/// konsisten dgn Filter Rawat Inap/Tambah Obat); portrait: layar PENUH
/// (bukan AlertDialog kecil lagi) — di production resepnya jauh lebih
/// banyak drpd data uji, dialog kecil ga cukup ruang, per arahan user.
/// Padanan persis ResepPickerModal di ModalJadwalObat.tsx (web): nampilin
/// detail LENGKAP tiap resep pasien ini (bukan cuma dropdown nama obat) —
/// tgl/jam peresepan + dokter, tiap item non-racikan (nama, jumlah,
/// satuan, aturan pakai) & racikan (metode, aturan pakai, daftar
/// kandungan). Tap 1 baris obat -> pilih nama+aturan pakai itu ke form
/// Tambah Obat. Endpoint SAMA PERSIS (/api/resep-ranap/list), tidak ada
/// endpoint baru.
Future<ResepPickResult?> showResepPickerSheet(BuildContext context, {required String noRawat}) {
  final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
  if (isLandscape) {
    return showRightPanel<ResepPickResult>(context, builder: (_) => _ResepPickerDialog(noRawat: noRawat, asPanel: true));
  }
  return Navigator.of(context).push<ResepPickResult>(
    MaterialPageRoute(fullscreenDialog: true, builder: (_) => _ResepPickerDialog(noRawat: noRawat, asPanel: false)),
  );
}

class _ResepPickerDialog extends StatefulWidget {
  final String noRawat;
  final bool asPanel;
  const _ResepPickerDialog({required this.noRawat, required this.asPanel});

  @override
  State<_ResepPickerDialog> createState() => _ResepPickerDialogState();
}

class _ResepPickerDialogState extends State<_ResepPickerDialog> {
  bool _loading = true;
  List<ResepRanapResult> _list = [];
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ResepRanapService.getList(widget.noRawat);
      if (mounted) setState(() { _list = list; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _searchCtrl.text.trim().toLowerCase();
    final searchField = TextField(
      controller: _searchCtrl,
      autofocus: true,
      decoration: const InputDecoration(isDense: true, hintText: 'Cari nama obat...', prefixIcon: Icon(Icons.search, size: 18), border: OutlineInputBorder()),
      style: const TextStyle(fontSize: 13),
    );
    final list = _loading
        ? const Center(child: CircularProgressIndicator())
        : _list.isEmpty
            ? const Center(child: Text('Belum ada resep untuk pasien ini.', style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))))
            : ListView(
                children: _list.map((resep) => _buildResepCard(resep, q)).whereType<Widget>().toList(),
              );

    if (widget.asPanel) {
      return Material(
        color: Colors.white,
        elevation: 8,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('Pilih Obat dari Resep', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
                    IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.of(context).pop(), padding: EdgeInsets.zero, constraints: const BoxConstraints(), visualDensity: VisualDensity.compact),
                  ],
                ),
                const SizedBox(height: 12),
                searchField,
                const SizedBox(height: 8),
                Expanded(child: list),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pilih Obat dari Resep', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            searchField,
            const SizedBox(height: 8),
            Expanded(child: list),
          ],
        ),
      ),
    );
  }

  Widget? _buildResepCard(ResepRanapResult resep, String q) {
    final nonRacikan = resep.nonRacikan.where((nr) => q.isEmpty || nr.namaBrng.toLowerCase().contains(q)).toList();
    final racikan = resep.racikan.where((rc) {
      if (q.isEmpty) return true;
      if ((rc.namaRacik.isNotEmpty ? rc.namaRacik : rc.metodeRacik).toLowerCase().contains(q)) return true;
      return rc.detail.any((d) => d.namaBrng.toLowerCase().contains(q));
    }).toList();
    if (nonRacikan.isEmpty && racikan.isEmpty) return null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: const BoxDecoration(color: Color(0xFFF9FAFB), border: Border(bottom: BorderSide(color: kBorder))),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              children: [
                Text('${_fmtTgl(resep.tglPeresepan)} ${resep.jamPeresepan} — ${resep.nmDokter.isEmpty ? '-' : resep.nmDokter}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                Text('No. Resep: ${resep.noResep}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
              ],
            ),
          ),
          for (final nr in nonRacikan)
            InkWell(
              onTap: () => Navigator.of(context).pop(ResepPickResult(nr.namaBrng, nr.aturanPakai)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 12, color: Color(0xFF111827)),
                    children: [
                      TextSpan(text: nr.namaBrng, style: const TextStyle(fontWeight: FontWeight.w600)),
                      TextSpan(text: ' — ${nr.jml} ${nr.kodeSat}', style: const TextStyle(color: Color(0xFF6B7280))),
                      if (nr.aturanPakai.isNotEmpty) TextSpan(text: ' · ${nr.aturanPakai}', style: const TextStyle(color: Color(0xFF9CA3AF))),
                    ],
                  ),
                ),
              ),
            ),
          for (final rc in racikan)
            InkWell(
              onTap: () => Navigator.of(context).pop(ResepPickResult(rc.namaRacik.isNotEmpty ? rc.namaRacik : (rc.metodeRacik.isNotEmpty ? rc.metodeRacik : 'Racikan'), rc.aturanPakai)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(fontSize: 12, color: Color(0xFF111827)),
                        children: [
                          TextSpan(text: 'Racikan — ${rc.metodeRacik.isNotEmpty ? rc.metodeRacik : rc.namaRacik}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (rc.jmlDr > 0) TextSpan(text: ' (${rc.jmlDr}x)', style: const TextStyle(color: Color(0xFF6B7280))),
                          if (rc.aturanPakai.isNotEmpty) TextSpan(text: ' · ${rc.aturanPakai}', style: const TextStyle(color: Color(0xFF9CA3AF))),
                        ],
                      ),
                    ),
                    if (rc.detail.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(rc.detail.map((d) => '${d.namaBrng} ${d.jml}${d.kodeSat}').join(', '), style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _fmtTgl(String tgl) {
    if (tgl.isEmpty) return '-';
    final parts = tgl.split('-');
    if (parts.length != 3) return tgl;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}
