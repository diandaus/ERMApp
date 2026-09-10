import 'package:flutter/material.dart';
import '../models/diagnosa_item.dart';
import '../models/ranap_patient.dart';
import '../services/diagnosa_service.dart';

const kBorder = Color(0xFFE5E7EB);

/// DiagnosaTab — Diagnosa (ICD10) & Prosedur (ICD9) (read-only dulu, sama
/// pola dgn ResepTab/LabTab/RadTab/TindakanTab), padanan DiagnosaTab.tsx
/// (web) — endpoint generik berbasis no_rawat, sebelumnya cuma dipasang di
/// Poli/IGD, di sini dipasang pertama kali utk Ranap (endpointnya memang
/// generik, tidak butuh flavor Ralan/Ranap spt Resep/Tindakan). Input
/// Diagnosa & Prosedur (ModalInputDiagnosa.tsx) BELUM dibangun di v1
/// tablet ini — nyusul di fase berikutnya spt Resep/Lab/Rad/Tindakan.
class DiagnosaTab extends StatefulWidget {
  final RanapPatient patient;
  const DiagnosaTab({super.key, required this.patient});

  @override
  State<DiagnosaTab> createState() => _DiagnosaTabState();
}

class _DiagnosaTabState extends State<DiagnosaTab> {
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
      final results = await Future.wait([DiagnosaService.getDiagnosa(noRawat), DiagnosaService.getProsedur(noRawat)]);
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

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text('Diagnosa (ICD10)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    _diagnosa.isEmpty ? _empty('Belum Ada Diagnosa', 'Belum ada diagnosa untuk kunjungan ini.') : _diagnosaTable(_diagnosa),
                    const SizedBox(height: 20),
                    const Text('Prosedur (ICD9)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    _prosedur.isEmpty ? _empty('Belum Ada Prosedur', 'Belum ada prosedur untuk kunjungan ini.') : _prosedurTable(_prosedur),
                  ],
                ),
    );
  }

  Widget _empty(String title, String subtitle) => Container(
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
        decoration: BoxDecoration(border: Border.all(color: kBorder, style: BorderStyle.solid), borderRadius: BorderRadius.circular(12)),
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
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(1.4), 1: FlexColumnWidth(4), 2: FlexColumnWidth(1.5), 3: FlexColumnWidth(1.5), 4: FlexColumnWidth(1)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFF3F4F6)),
            children: ['Kode', 'Nama Penyakit', 'Status', 'Kasus', 'Urut'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.kdPenyakit.isEmpty ? '-' : it.kdPenyakit, color: const Color(0xFF111827)),
              _cell(it.nmPenyakit.isEmpty ? '-' : it.nmPenyakit, color: const Color(0xFF111827)),
              _cell(it.status.isEmpty ? 'Ralan' : it.status, color: const Color(0xFF111827)),
              _cell(it.statusPenyakit.isEmpty ? '-' : it.statusPenyakit, color: const Color(0xFF111827)),
              _cell(it.prioritas, color: const Color(0xFF111827), align: TextAlign.center),
            ]),
        ],
      ),
    );
  }

  Widget _prosedurTable(List<ProsedurPasienItem> items) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(1.4), 1: FlexColumnWidth(4), 2: FlexColumnWidth(1.5), 3: FlexColumnWidth(1), 4: FlexColumnWidth(1)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFF3F4F6)),
            children: ['Kode', 'Nama Prosedur', 'Status', 'Urut', 'Jml'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.kode.isEmpty ? '-' : it.kode, color: const Color(0xFF111827)),
              _cell(it.deskripsiPanjang.isEmpty ? '-' : it.deskripsiPanjang, color: const Color(0xFF111827)),
              _cell(it.status.isEmpty ? 'Ralan' : it.status, color: const Color(0xFF111827)),
              _cell(it.prioritas, color: const Color(0xFF111827), align: TextAlign.center),
              _cell(it.jumlah, color: const Color(0xFF111827), align: TextAlign.center),
            ]),
        ],
      ),
    );
  }

  Widget _cell(String text, {required Color color, TextAlign align = TextAlign.left}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text, textAlign: align, style: TextStyle(fontSize: 11, color: color)),
      );
}
