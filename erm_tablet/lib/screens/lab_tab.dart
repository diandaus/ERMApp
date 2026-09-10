import 'package:flutter/material.dart';
import '../models/lab_item.dart';
import '../models/ranap_patient.dart';
import '../services/lab_service.dart';

const kBorder = Color(0xFFE5E7EB);

/// LabTab — Laboratorium Rawat Inap (read-only dulu, sama pola dgn
/// ResepTab), padanan LabTab.tsx (web): Riwayat Permintaan (PK/PA yg
/// masih Pending, blm ada hasil) + Hasil Periksa Laboratorium (PK+PA yg
/// sudah keluar, digabung & diurutkan tgl terbaru). Endpoint SAMA PERSIS
/// (/api/lab/riwayat-pk, /api/lab/riwayat-pa, /api/lab/hasil-detail),
/// tidak ada endpoint baru. Buat Permintaan Lab (ModalInputLab.tsx) BELUM
/// dibangun di v1 tablet ini — nyusul di fase berikutnya spt Resep.
class LabTab extends StatefulWidget {
  final RanapPatient patient;
  const LabTab({super.key, required this.patient});

  @override
  State<LabTab> createState() => _LabTabState();
}

class _LabTabState extends State<LabTab> {
  bool _loading = true;
  String? _error;
  List<LabPermintaanItem> _pending = [];
  List<LabHasilItem> _hasil = [];

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
      final results = await Future.wait([
        LabService.getRiwayatPK(noRawat),
        LabService.getRiwayatPA(noRawat),
        LabService.getHasilDetail(noRawat, 'PK'),
        LabService.getHasilDetail(noRawat, 'PA'),
      ]);
      final riwayatPK = results[0] as List<LabPermintaanItem>;
      final riwayatPA = results[1] as List<LabPermintaanItem>;
      final hasilPK = results[2] as List<LabHasilItem>;
      final hasilPA = results[3] as List<LabHasilItem>;

      final pending = [...riwayatPK, ...riwayatPA].where((it) => !it.sudahAdaHasil).toList();
      final hasil = [...hasilPK, ...hasilPA]..sort((a, b) => '${b.tglPeriksa} ${b.jam}'.compareTo('${a.tglPeriksa} ${a.jam}'));

      if (!mounted) return;
      setState(() {
        _pending = pending;
        _hasil = hasil;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data laboratorium';
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
              : (_pending.isEmpty && _hasil.isEmpty)
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        SizedBox(height: 60),
                        Icon(Icons.science_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Center(child: Text('Belum Ada Data Laboratorium', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        SizedBox(height: 4),
                        Center(child: Text('Belum ada permintaan atau hasil laboratorium untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_pending.isNotEmpty) ...[
                          const Text('Riwayat Permintaan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          ..._pending.map((it) => _PermintaanCard(item: it)),
                          const SizedBox(height: 16),
                        ],
                        if (_hasil.isNotEmpty) ...[
                          const Text('Hasil Periksa Laboratorium', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          ..._hasil.map((it) => _HasilCard(item: it)),
                        ],
                      ],
                    ),
    );
  }
}

class _PermintaanCard extends StatelessWidget {
  final LabPermintaanItem item;
  const _PermintaanCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final pk = item.kategori == 'pk';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: pk ? const Color(0xFFE0F2FE) : const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(999)),
                child: Text(pk ? 'LAB PK' : 'LAB PA', style: TextStyle(fontSize: 11, color: pk ? const Color(0xFF0891B2) : const Color(0xFF7C3AED))),
              ),
              Text('No. Permintaan: ${item.noorder}', style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
            ],
          ),
          const SizedBox(height: 4),
          Text('${_fmtTgl(item.tglPermintaan)} ${item.jamPermintaan}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          Text(item.nmDokter.isEmpty ? '-' : item.nmDokter, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          Text('Diagnosis: ${item.diagnosaKlinis.isEmpty ? '-' : item.diagnosaKlinis}', style: const TextStyle(fontSize: 12)),
          if (item.informasiTambahan.isNotEmpty) Text('Info Tambahan: ${item.informasiTambahan}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          if (item.detailPemeriksaan.isNotEmpty) ...[
            const Padding(padding: EdgeInsets.only(top: 10, bottom: 6), child: Divider(height: 1, color: kBorder)),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: item.detailPemeriksaan
                  .map((d) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0xFFE0F2FE), border: Border.all(color: const Color(0xFF1AB1E5)), borderRadius: BorderRadius.circular(999)),
                        child: Text(d.nmPerawatan.isEmpty ? d.kdJenisPrw : d.nmPerawatan, style: const TextStyle(fontSize: 12, color: Color(0xFF0891B2))),
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  String _fmtTgl(String tgl) {
    if (tgl.isEmpty || tgl == '0000-00-00') return '-';
    final datePart = tgl.contains('T') ? tgl.split('T')[0] : tgl;
    final parts = datePart.split('-');
    if (parts.length != 3) return tgl;
    return '${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}';
  }
}

class _HasilCard extends StatelessWidget {
  final LabHasilItem item;
  const _HasilCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final pk = item.kategori == 'pk';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(color: Color(0xFFF9FAFB), border: Border(bottom: BorderSide(color: kBorder))),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: pk ? const Color(0xFFE0F2FE) : const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(999)),
                  child: Text(pk ? 'LAB PK' : 'LAB PA', style: TextStyle(fontSize: 10, color: pk ? const Color(0xFF0891B2) : const Color(0xFF7C3AED))),
                ),
                Text(item.nmPerawatan, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                Text('${_fmtTgl(item.tglPeriksa)} ${item.jam}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: item.detail.isEmpty
                ? const Text('Belum ada hasil detail', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF), fontStyle: FontStyle.italic))
                : Table(
                    border: TableBorder.all(color: kBorder, width: 1),
                    columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(2), 2: FlexColumnWidth(2), 3: FlexColumnWidth(2)},
                    children: [
                      TableRow(
                        decoration: const BoxDecoration(color: Color(0xFFF9FAFB)),
                        children: ['Pemeriksaan', 'Hasil', 'Nilai Rujukan', 'Keterangan'].map((h) => _cell(h, color: const Color(0xFF6B7280))).toList(),
                      ),
                      for (final d in item.detail)
                        TableRow(children: [
                          _cell(d.pemeriksaan.isEmpty ? '-' : d.pemeriksaan, color: const Color(0xFF374151)),
                          _cell('${d.nilai.isEmpty ? '-' : d.nilai} ${d.satuan}'.trim(), color: const Color(0xFF111827)),
                          _cell('${d.nilaiRujukan.isEmpty ? '-' : d.nilaiRujukan} ${d.satuan}'.trim(), color: const Color(0xFF6B7280)),
                          _cell(d.keterangan.isEmpty ? '-' : d.keterangan, color: const Color(0xFF6B7280)),
                        ]),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _cell(String text, {required Color color}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );

  String _fmtTgl(String tgl) {
    if (tgl.isEmpty || tgl == '0000-00-00') return '-';
    final datePart = tgl.contains('T') ? tgl.split('T')[0] : tgl;
    final parts = datePart.split('-');
    if (parts.length != 3) return tgl;
    return '${parts[2].substring(0, 2)}/${parts[1]}/${parts[0]}';
  }
}
