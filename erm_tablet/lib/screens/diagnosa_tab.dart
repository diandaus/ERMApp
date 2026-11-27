import 'package:flutter/material.dart';
import '../models/diagnosa_item.dart';
import '../models/ranap_patient.dart';
import '../services/api_client.dart';
import '../services/diagnosa_service.dart';
import '../widgets/diagnosa_input_panel.dart';
import '../widgets/modal_input_kit.dart';

const kBorder = Color(0xFFE6E8E8);

/// DiagnosaTab — Diagnosa (ICD10) & Prosedur (ICD9) (read-only dulu, sama
/// pola dgn ResepTab/LabTab/RadTab/TindakanTab), padanan DiagnosaTab.tsx
/// (web) — endpoint generik berbasis no_rawat, sebelumnya cuma dipasang di
/// Poli/IGD, di sini dipasang pertama kali utk Ranap (endpointnya memang
/// generik, tidak butuh flavor Ralan/Ranap spt Resep/Tindakan). Input
/// Diagnosa & Prosedur (ModalInputDiagnosa.tsx) BELUM dibangun di v1
/// tablet ini — nyusul di fase berikutnya spt Resep/Lab/Rad/Tindakan.
class DiagnosaTab extends StatefulWidget {
  final RanapPatient patient;
  // true = kartu/tabel putih radius 4 (layar pemeriksaan Rawat Jalan),
  // sama dgn ResepTab(ralan).
  final bool flat;
  // true = tampilkan tombol "Input Diagnosa" (diagnosa_input_panel.dart).
  final bool bisaInput;
  // true = kunjungan Rawat Inap: diagnosa/prosedur berstatus 'Ranap'.
  final bool ranap;
  const DiagnosaTab({super.key, required this.patient, this.flat = false, this.bisaInput = false, this.ranap = false});

  @override
  State<DiagnosaTab> createState() => _DiagnosaTabState();
}

class _DiagnosaTabState extends State<DiagnosaTab> {
  String get _status => widget.ranap ? 'Ranap' : 'Ralan';

  bool _loading = true;
  String? _error;
  List<DiagnosaPasienItem> _diagnosa = [];
  List<ProsedurPasienItem> _prosedur = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final noRawat = widget.patient.noRawat;
      final results = await Future.wait([DiagnosaService.getDiagnosa(noRawat, status: _status), DiagnosaService.getProsedur(noRawat, status: _status)]);
      if (!mounted) return;
      setState(() {
        _diagnosa = results[0] as List<DiagnosaPasienItem>;
        _prosedur = results[1] as List<ProsedurPasienItem>;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data diagnosa/prosedur';
        _loading = false;
      });
    }
  }

  /// Hapus satu diagnosa/prosedur (konfirmasi dulu) — endpoint SAMA dgn
  /// DiagnosaTab.tsx (DELETE ?no_rawat=&kd_penyakit= / &kode=).
  Future<void> _hapus({required String jenis, required String kode, required String nama, required Future<void> Function() aksi}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Hapus $jenis?'),
        content: Text('$kode — $nama'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Hapus', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await aksi();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('$jenis berhasil dihapus'), backgroundColor: const Color(0xFF16A34A)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Gagal menghapus $jenis'), backgroundColor: const Color(0xFFDC2626)));
    }
  }

  Widget _hapusButton(VoidCallback onPressed) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(6)),
              child: const Text('Hapus', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ),
      );

  Future<void> _inputDiagnosa() async {
    final p = widget.patient;
    final n = await showDiagnosaInputPanel(context, noRawat: p.noRawat, noRkmMedis: p.noRkmMedis, nmPasien: p.nmPasien, umur: p.umur, status: _status);
    if (n == 0 || !mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('$n diagnosa/prosedur berhasil disimpan'), backgroundColor: const Color(0xFF16A34A)));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.bisaInput) return _buildContent();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: KitTabButton(label: 'Input Diagnosa', onPressed: _inputDiagnosa),
        ),
        Expanded(child: _buildContent()),
      ],
    );
  }

  Widget _buildContent() {
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (widget.flat) ...[
                      // Rawat Jalan: gaya SAMA dgn tab Tindakan — kartu putih,
                      // judul 16 tebal di dalam kartu, tabel font 15.
                      _sectionCard('Diagnosa (ICD10)', _diagnosa.isEmpty ? _empty('Belum Ada Diagnosa', 'Belum ada diagnosa untuk kunjungan ini.') : _diagnosaTable(_diagnosa)),
                      _sectionCard('Prosedur (ICD9)', _prosedur.isEmpty ? _empty('Belum Ada Prosedur', 'Belum ada prosedur untuk kunjungan ini.') : _prosedurTable(_prosedur)),
                    ] else ...[
                      const Text('Diagnosa (ICD10)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      _diagnosa.isEmpty ? _empty('Belum Ada Diagnosa', 'Belum ada diagnosa untuk kunjungan ini.') : _diagnosaTable(_diagnosa),
                      const SizedBox(height: 20),
                      const Text('Prosedur (ICD9)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      _prosedur.isEmpty ? _empty('Belum Ada Prosedur', 'Belum ada prosedur untuk kunjungan ini.') : _prosedurTable(_prosedur),
                    ],
                  ],
                ),
    );
  }

  Widget _empty(String title, String subtitle) => Container(
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
        decoration: BoxDecoration(color: widget.flat ? Colors.white : null, border: Border.all(color: kBorder, style: BorderStyle.solid), borderRadius: BorderRadius.circular(widget.flat ? 4 : 12)),
        child: Column(
          children: [
            const Icon(Icons.fact_check_outlined, size: 28, color: Color(0xFF9CA3AF)),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center),
          ],
        ),
      );

  Widget _diagnosaTable(List<DiagnosaPasienItem> items) {
    return Container(
      decoration: widget.flat ? const BoxDecoration(color: Colors.white) : BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      clipBehavior: Clip.antiAlias,
      child: Table(
        border: widget.flat
            ? const TableBorder(top: BorderSide(color: kBorder), horizontalInside: BorderSide(color: kBorder))
            : TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        columnWidths: {0: const FlexColumnWidth(1.4), 1: const FlexColumnWidth(4), 2: const FlexColumnWidth(1.5), 3: const FlexColumnWidth(1.5), 4: const FlexColumnWidth(1), if (widget.bisaInput) 5: const FixedColumnWidth(100)},
        children: [
          TableRow(
            decoration: BoxDecoration(color: widget.flat ? Colors.white : const Color(0xFFF3F4F6)),
            children: ['Kode', 'Nama Penyakit', 'Status', 'Kasus', 'Urut', if (widget.bisaInput) 'Aksi'].map((h) => _cell(h, color: widget.flat ? const Color(0xFF5F6665) : const Color(0xFF374151), bold: true, align: h == 'Aksi' ? TextAlign.center : TextAlign.left)).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.kdPenyakit.isEmpty ? '-' : it.kdPenyakit, color: const Color(0xFF111827)),
              _cell(it.nmPenyakit.isEmpty ? '-' : it.nmPenyakit, color: const Color(0xFF111827)),
              _cell(it.status.isEmpty ? 'Ralan' : it.status, color: const Color(0xFF111827)),
              _cell(it.statusPenyakit.isEmpty ? '-' : it.statusPenyakit, color: const Color(0xFF111827)),
              _cell(it.prioritas, color: const Color(0xFF111827), align: TextAlign.center),
              if (widget.bisaInput)
                _hapusButton(() => _hapus(
                    jenis: 'Diagnosa',
                    kode: it.kdPenyakit,
                    nama: it.nmPenyakit,
                    aksi: () => DiagnosaService.deleteDiagnosa(widget.patient.noRawat, it.kdPenyakit, status: _status))),
            ]),
        ],
      ),
    );
  }

  Widget _prosedurTable(List<ProsedurPasienItem> items) {
    return Container(
      decoration: widget.flat ? const BoxDecoration(color: Colors.white) : BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      clipBehavior: Clip.antiAlias,
      child: Table(
        border: widget.flat
            ? const TableBorder(top: BorderSide(color: kBorder), horizontalInside: BorderSide(color: kBorder))
            : TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        columnWidths: {0: const FlexColumnWidth(1.4), 1: const FlexColumnWidth(4), 2: const FlexColumnWidth(1.5), 3: const FlexColumnWidth(1), 4: const FlexColumnWidth(1), if (widget.bisaInput) 5: const FixedColumnWidth(100)},
        children: [
          TableRow(
            decoration: BoxDecoration(color: widget.flat ? Colors.white : const Color(0xFFF3F4F6)),
            children: ['Kode', 'Nama Prosedur', 'Status', 'Urut', 'Jml', if (widget.bisaInput) 'Aksi'].map((h) => _cell(h, color: widget.flat ? const Color(0xFF5F6665) : const Color(0xFF374151), bold: true, align: h == 'Aksi' ? TextAlign.center : TextAlign.left)).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.kode.isEmpty ? '-' : it.kode, color: const Color(0xFF111827)),
              _cell(it.deskripsiPanjang.isEmpty ? '-' : it.deskripsiPanjang, color: const Color(0xFF111827)),
              _cell(it.status.isEmpty ? 'Ralan' : it.status, color: const Color(0xFF111827)),
              _cell(it.prioritas, color: const Color(0xFF111827), align: TextAlign.center),
              _cell(it.jumlah, color: const Color(0xFF111827), align: TextAlign.center),
              if (widget.bisaInput)
                _hapusButton(() => _hapus(
                    jenis: 'Prosedur',
                    kode: it.kode,
                    nama: it.deskripsiPanjang,
                    aksi: () => DiagnosaService.deleteProsedur(widget.patient.noRawat, it.kode, status: _status))),
            ]),
        ],
      ),
    );
  }

  /// Rawat Jalan (flat): SAMA dgn _cell tab Tindakan — font 15, header
  /// tebal, padding 12/16. Rawat Inap tetap gaya ringkas lama (font 11).
  Widget _cell(String text, {required Color color, TextAlign align = TextAlign.left, bool bold = false}) => widget.flat
      ? Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: bold ? 12 : 16),
          child: Text(text, textAlign: align, style: TextStyle(fontSize: 15, fontWeight: bold ? FontWeight.w600 : FontWeight.w400, color: color)),
        )
      : Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Text(text, textAlign: align, style: TextStyle(fontSize: 11, color: color)),
        );

  Widget _sectionCard(String title, Widget child) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF282A2A))),
            const SizedBox(height: 12),
            child,
          ],
        ),
      );
}
