import 'package:flutter/material.dart';
import '../models/ranap_patient.dart';
import '../models/resep_ranap_item.dart';
import '../services/resep_ranap_service.dart';

const kBorder = Color(0xFFE5E7EB);

/// ResepTab — Riwayat Resep Rawat Inap, padanan (read-only dulu) dari
/// ResepTab.tsx (web, dipakai lewat prop isRanap). Endpoint SAMA PERSIS
/// (/api/resep-ranap/list), tidak ada endpoint baru. Input Resep (cari obat
/// dari stok, racikan builder — ResepModal.tsx >2000 baris di web) BELUM
/// dibangun di v1 tablet ini, sesuai keputusan user (mulai dari riwayat
/// dulu) — nyusul di fase berikutnya.
class ResepTab extends StatefulWidget {
  final RanapPatient patient;
  const ResepTab({super.key, required this.patient});

  @override
  State<ResepTab> createState() => _ResepTabState();
}

class _ResepTabState extends State<ResepTab> {
  bool _loading = true;
  String? _error;
  List<ResepRanapResult> _list = [];

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
      final list = await ResepRanapService.getList(widget.patient.noRawat);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil riwayat resep';
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
              : _list.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        SizedBox(height: 60),
                        Icon(Icons.medication_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Center(child: Text('Belum Ada Permintaan Resep', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        SizedBox(height: 4),
                        Center(child: Text('Belum ada permintaan resep untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _list.length,
                      itemBuilder: (context, i) => _ResepCard(resep: _list[i]),
                    ),
    );
  }
}

class _ResepCard extends StatelessWidget {
  final ResepRanapResult resep;
  const _ResepCard({required this.resep});

  @override
  Widget build(BuildContext context) {
    final status = resep.status.trim().toLowerCase();
    final belum = status == 'belum';
    final retur = status == 'retur';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(border: Border.all(color: belum ? kBorder : const Color(0xFFD1FAE5)), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kBorder))),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 4,
              children: [
                Text(resep.noResep.isEmpty ? '-' : resep.noResep, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
                Text('${_fmtTgl(resep.tglPeresepan)} ${resep.jamPeresepan}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                if (resep.nmDokter.isNotEmpty) Text(resep.nmDokter, style: const TextStyle(fontSize: 12, color: Color(0xFF7C3AED))),
                if (retur)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(999)),
                    child: const Text('Retur', style: TextStyle(fontSize: 11, color: Color(0xFF991B1B))),
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: belum ? const Color(0xFFFEF3C7) : const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(999)),
                  child: Text(belum ? 'Belum Terlayani' : 'Sudah Terlayani', style: TextStyle(fontSize: 11, color: belum ? const Color(0xFF92400E) : const Color(0xFF065F46))),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (resep.nonRacikan.isNotEmpty) _buildNonRacikan(resep.nonRacikan),
                for (int i = 0; i < resep.racikan.length; i++)
                  Padding(
                    padding: EdgeInsets.only(top: i > 0 || resep.nonRacikan.isNotEmpty ? 10 : 0),
                    child: _buildRacikan(resep.racikan[i], i),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNonRacikan(List<ResepNonRacikanItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('NON RACIKAN', style: TextStyle(fontSize: 11, color: Color(0xFF2563EB), letterSpacing: 0.4)),
        const SizedBox(height: 6),
        _resepTable(
          headers: const ['Nama Obat', 'Jml', 'Aturan Pakai'],
          rows: items
              .map((it) => [
                    it.namaBrng.isEmpty ? '-' : it.namaBrng,
                    it.jml == 0 ? '-' : '${it.jml}',
                    it.aturanPakai.isEmpty ? '-' : it.aturanPakai,
                  ])
              .toList(),
          col2Color: const Color(0xFF7C3AED),
        ),
      ],
    );
  }

  Widget _buildRacikan(ResepRacikanItem rc, int index) {
    final nama = rc.namaRacik.isNotEmpty ? rc.namaRacik : 'R${index + 1}';
    final headerParts = <String>[
      'Racikan — $nama',
      if (rc.metodeRacik.isNotEmpty) rc.metodeRacik,
      if (rc.aturanPakai.isNotEmpty) rc.aturanPakai,
      if (rc.jmlDr > 0) '${rc.jmlDr} bungkus',
    ];
    return Container(
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: kBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(headerParts.join('  ·  '), style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED), letterSpacing: 0.4)),
          const SizedBox(height: 4),
          _resepTable(
            headers: const ['Nama Obat', 'Kps', 'Jml'],
            rows: rc.detail
                .map((d) => [
                      d.namaBrng.isEmpty ? '-' : d.namaBrng,
                      d.kapasitas == 0 ? '-' : '${d.kapasitas}',
                      d.jml == 0 ? '-' : '${d.jml}',
                    ])
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _resepTable({required List<String> headers, required List<List<String>> rows, Color? col2Color}) {
    return Table(
      border: TableBorder.all(color: kBorder, width: 1),
      columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1), 2: FlexColumnWidth(2)},
      children: [
        TableRow(
          decoration: const BoxDecoration(color: Color(0xFFF9FAFB)),
          children: headers.map((h) => _tableCell(h, color: const Color(0xFF6B7280))).toList(),
        ),
        for (final row in rows)
          TableRow(
            children: [
              _tableCell(row[0], color: const Color(0xFF374151)),
              _tableCell(row[1], color: const Color(0xFF6B7280)),
              _tableCell(row[2], color: col2Color ?? const Color(0xFF6B7280)),
            ],
          ),
      ],
    );
  }

  Widget _tableCell(String text, {required Color color}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );

  String _fmtTgl(String tgl) {
    if (tgl.isEmpty) return '-';
    final parts = tgl.split('-');
    if (parts.length != 3) return tgl;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}
