import 'package:flutter/material.dart';
import '../models/ranap_patient.dart';
import '../models/tindakan_item.dart';
import '../services/tindakan_service.dart';

const kBorder = Color(0xFFE5E7EB);

/// TindakanTab — Tindakan Rawat Inap (read-only dulu, sama pola dgn
/// ResepTab/LabTab/RadTab), padanan TindakanTab.tsx (web, isRanap=true):
/// 3 tabel terpisah — Tindakan Dokter, Tindakan Perawat, Tindakan Dokter &
/// Perawat (padanan 3 tabel DlgRawatJalan.java). Endpoint SAMA PERSIS
/// (/api/tindakan-ranap/:no_rawat), tidak ada endpoint baru. Input Tindakan
/// (ModalInputTindakan.tsx) BELUM dibangun di v1 tablet ini — nyusul di
/// fase berikutnya spt Resep/Lab/Rad.
class TindakanTab extends StatefulWidget {
  final RanapPatient patient;
  const TindakanTab({super.key, required this.patient});

  @override
  State<TindakanTab> createState() => _TindakanTabState();
}

class _TindakanTabState extends State<TindakanTab> {
  bool _loading = true;
  String? _error;
  TindakanRanapResult _data = TindakanRanapResult(tindakanDokter: [], tindakanParamedis: [], tindakanDokterParamedis: []);

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
      final data = await TindakanService.getList(widget.patient.noRawat);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil riwayat tindakan';
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
              : _data.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        SizedBox(height: 60),
                        Icon(Icons.medical_services_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Center(child: Text('Belum Ada Riwayat Tindakan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        SizedBox(height: 4),
                        Center(child: Text('Belum ada riwayat tindakan untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_data.tindakanDokter.isNotEmpty) ...[
                          const Text('Tindakan Dokter', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _dokterTable(_data.tindakanDokter),
                          const SizedBox(height: 16),
                        ],
                        if (_data.tindakanParamedis.isNotEmpty) ...[
                          const Text('Tindakan Perawat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _paramedisTable(_data.tindakanParamedis),
                          const SizedBox(height: 16),
                        ],
                        if (_data.tindakanDokterParamedis.isNotEmpty) ...[
                          const Text('Tindakan Dokter & Perawat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _paramedisTable(_data.tindakanDokterParamedis),
                        ],
                      ],
                    ),
    );
  }

  Widget _dokterTable(List<TindakanDokterItem> items) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(2)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFF3F4F6)),
            children: ['Perawatan/Tindakan', 'Biaya'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.nmPerawatan.isEmpty ? '-' : it.nmPerawatan, color: const Color(0xFF111827)),
              _cell(_rupiah(it.biayaRawat), color: const Color(0xFF111827), align: TextAlign.right),
            ]),
        ],
      ),
    );
  }

  Widget _paramedisTable(List<TindakanParamedisItem> items) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(2), 2: FlexColumnWidth(2)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFF3F4F6)),
            children: ['Perawatan/Tindakan', 'Petugas Yg Menangani', 'Biaya'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.nmPerawatan.isEmpty ? '-' : it.nmPerawatan, color: const Color(0xFF111827)),
              _cell(it.namaParamedis.isEmpty ? '-' : it.namaParamedis, color: const Color(0xFF374151)),
              _cell(_rupiah(it.biayaRawat), color: const Color(0xFF111827), align: TextAlign.right),
            ]),
        ],
      ),
    );
  }

  Widget _cell(String text, {required Color color, TextAlign align = TextAlign.left}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text, textAlign: align, style: TextStyle(fontSize: 11, color: color)),
      );

  String _rupiah(num v) {
    final s = v.toInt().toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return 'Rp $buf';
  }
}
