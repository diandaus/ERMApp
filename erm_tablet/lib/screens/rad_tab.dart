import 'package:flutter/material.dart';
import '../models/rad_item.dart';
import '../models/ranap_patient.dart';
import '../services/api_config.dart';
import '../services/rad_service.dart';

const kBorder = Color(0xFFE5E7EB);

/// RadTab — Radiologi Rawat Inap (read-only dulu, sama pola dgn ResepTab/
/// LabTab), padanan RadTab.tsx (web): Riwayat Permintaan (blm ada hasil) +
/// Pemeriksaan Radiologi + Bacaan/Hasil Radiologi + Gambar Radiologi.
/// Endpoint SAMA PERSIS (/api/radiologi/riwayat, /api/radiologi-data),
/// tidak ada endpoint baru. Buat Permintaan Radiologi (ModalInputRad.tsx)
/// BELUM dibangun di v1 tablet ini — nyusul di fase berikutnya spt Resep.
class RadTab extends StatefulWidget {
  final RanapPatient patient;
  const RadTab({super.key, required this.patient});

  @override
  State<RadTab> createState() => _RadTabState();
}

class _RadTabState extends State<RadTab> {
  bool _loading = true;
  String? _error;
  List<RadPermintaanItem> _pending = [];
  RadiologiData _data = RadiologiData(pemeriksaan: [], hasil: [], gambar: []);

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
      final results = await Future.wait([RadService.getRiwayat(noRawat), RadService.getData(noRawat)]);
      final riwayat = results[0] as List<RadPermintaanItem>;
      final data = results[1] as RadiologiData;
      if (!mounted) return;
      setState(() {
        _pending = riwayat.where((it) => !it.sudahAdaHasil).toList();
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data radiologi';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final kosong = _pending.isEmpty && _data.isEmpty;
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : kosong
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        SizedBox(height: 60),
                        Icon(Icons.image_search_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Center(child: Text('Belum Ada Data Radiologi', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        SizedBox(height: 4),
                        Center(child: Text('Belum ada permintaan atau hasil radiologi untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
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
                        if (_data.pemeriksaan.isNotEmpty) ...[
                          const _SectionHeader(title: 'Pemeriksaan Radiologi', color: Color(0xFF1E40AF), bg: Color(0xFFDBEAFE)),
                          const SizedBox(height: 8),
                          _PemeriksaanTable(items: _data.pemeriksaan),
                          const SizedBox(height: 16),
                        ],
                        if (_data.hasil.isNotEmpty) ...[
                          const _SectionHeader(title: 'Bacaan / Hasil Radiologi', color: Color(0xFF065F46), bg: Color(0xFFD1FAE5)),
                          const SizedBox(height: 8),
                          ..._data.hasil.map((h) => _HasilCard(item: h)),
                          const SizedBox(height: 16),
                        ],
                        if (_data.gambar.isNotEmpty) ...[
                          const _SectionHeader(title: 'Gambar Radiologi', color: Color(0xFF7C2D12), bg: Color(0xFFFFEDD5)),
                          const SizedBox(height: 8),
                          ..._data.gambar.map((g) => _GambarCard(item: g)),
                        ],
                      ],
                    ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Color color;
  final Color bg;
  const _SectionHeader({required this.title, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _PermintaanCard extends StatelessWidget {
  final RadPermintaanItem item;
  const _PermintaanCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('No. Permintaan: ${item.noorder}', style: const TextStyle(fontSize: 12, color: Color(0xFF1AB1E5))),
          const SizedBox(height: 4),
          Text('${item.tglPermintaan} ${item.jamPermintaan}'.trim(), style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
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
}

class _PemeriksaanTable extends StatelessWidget {
  final List<RadiologiPemeriksaan> items;
  const _PemeriksaanTable({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(2), 1: FlexColumnWidth(3), 2: FlexColumnWidth(2), 3: FlexColumnWidth(2)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFF3F4F6)),
            children: ['Tanggal/Jam', 'Nama Pemeriksaan', 'Dokter PJ', 'Biaya'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final p in items)
            TableRow(children: [
              _cell('${p.tglPeriksa} ${p.jam}'.trim(), color: const Color(0xFF6B7280)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.nmPerawatan.isEmpty ? '-' : p.nmPerawatan, style: const TextStyle(fontSize: 11, color: Color(0xFF111827))),
                    if (p.proyeksi.isNotEmpty) Text(p.proyeksi, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
              _cell(p.nmDokter.isEmpty ? '-' : p.nmDokter, color: const Color(0xFF6B7280)),
              _cell(p.biaya > 0 ? 'Rp ${_thousands(p.biaya)}' : '-', color: const Color(0xFF374151)),
            ]),
        ],
      ),
    );
  }

  Widget _cell(String text, {required Color color}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );

  String _thousands(num v) {
    final s = v.toInt().toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _HasilCard extends StatelessWidget {
  final RadiologiHasil item;
  const _HasilCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.tglPeriksa} ${item.jam}'.trim(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 4),
          Text(item.hasil.isEmpty ? '-' : item.hasil, style: const TextStyle(fontSize: 12, height: 1.5)),
        ],
      ),
    );
  }
}

class _GambarCard extends StatelessWidget {
  final RadiologiGambar item;
  const _GambarCard({required this.item});

  String get _url => item.lokasiGambar.isEmpty ? '' : '$kApiBaseUrl/radiologi/${item.lokasiGambar}';

  @override
  Widget build(BuildContext context) {
    if (_url.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.tglPeriksa} ${item.jam}'.trim(), style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: () => _openZoom(context),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                _url,
                height: 200,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(height: 120, color: const Color(0xFFF3F4F6), alignment: Alignment.center, child: const Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF))),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openZoom(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(child: Image.network(_url)),
      ),
    );
  }
}
