import 'package:flutter/material.dart';

import '../models/farmasi_resep_item.dart';
import '../services/klinis_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

/// Badge "Belum ..." (kuning, masih antre) vs "Sudah ..." (hijau,
/// selesai) — dipakai bersama Farmasi/Lab/Radiologi, sama seperti
/// queueStatusStyle di PresensiMobile.tsx.
({Color bg, Color fg}) queueStatusStyle(String s) {
  if (s.startsWith('Sudah')) return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534));
  if (s.startsWith('Belum')) return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E));
  return (bg: const Color(0xFFF3F4F6), fg: const Color(0xFF374151));
}

/// Padanan FarmasiMobileView di PresensiMobile.tsx — antrean permintaan
/// resep rawat jalan (ralan) hari ini (read-only). Resep ranap belum
/// diport, sama spt versi web (fase-1).
class FarmasiView extends StatefulWidget {
  const FarmasiView({super.key});

  @override
  State<FarmasiView> createState() => _FarmasiViewState();
}

class _FarmasiViewState extends State<FarmasiView> {
  bool _loading = true;
  String? _error;
  List<FarmasiResepItem> _list = [];
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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await KlinisService.getFarmasiRalan();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data permintaan resep';
        _loading = false;
      });
    }
  }

  List<FarmasiResepItem> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _list;
    return _list.where((p) => p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Permintaan Resep', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: _kGreenDark,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Cari nama / no. RM...',
                prefixIcon: const Icon(Icons.search, size: 18),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))),
              )
            else if (_filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Belum ada permintaan resep hari ini', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._filtered.map((p) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _FarmasiCard(item: p))),
          ],
        ),
      ),
    );
  }
}

class _FarmasiCard extends StatelessWidget {
  final FarmasiResepItem item;
  const _FarmasiCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final st = queueStatusStyle(item.status);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.nmPasien, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(item.noRkmMedis, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: st.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(item.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: st.fg)),
              ),
            ],
          ),
          Padding(padding: const EdgeInsets.only(top: 6), child: Text('${item.nmPoli} · ${item.nmDokter}', style: const TextStyle(fontSize: 11, color: Color(0xFF374151)))),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('Resep ${item.jamPeresepan} · ${item.jenisBayar}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
        ],
      ),
    );
  }
}
