import 'package:flutter/material.dart';

import '../models/permintaan_queue_item.dart';
import 'farmasi_view.dart' show queueStatusStyle;

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan PermintaanQueueMobileView di PresensiMobile.tsx — dipakai
/// bersama utk Lab & Radiologi, bentuk datanya identik, cuma beda
/// judul/fetcher/teks kosong.
class PermintaanQueueView extends StatefulWidget {
  final String title;
  final String emptyText;
  final Future<List<PermintaanQueueItem>> Function() fetcher;
  const PermintaanQueueView({super.key, required this.title, required this.emptyText, required this.fetcher});

  @override
  State<PermintaanQueueView> createState() => _PermintaanQueueViewState();
}

class _PermintaanQueueViewState extends State<PermintaanQueueView> {
  bool _loading = true;
  String? _error;
  List<PermintaanQueueItem> _list = [];
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
      final list = await widget.fetcher();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data';
        _loading = false;
      });
    }
  }

  List<PermintaanQueueItem> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _list;
    return _list.where((p) => p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text(widget.emptyText, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._filtered.map((p) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _QueueCard(item: p))),
          ],
        ),
      ),
    );
  }
}

class _QueueCard extends StatelessWidget {
  final PermintaanQueueItem item;
  const _QueueCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final st = queueStatusStyle(item.status);
    final diagnosa = item.diagnosaKlinis.isNotEmpty && item.diagnosaKlinis != '-' ? ' · ${item.diagnosaKlinis}' : '';
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
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.nmDokter, style: const TextStyle(fontSize: 11, color: Color(0xFF374151)))),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('Diminta ${item.jamPermintaan}$diagnosa', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
        ],
      ),
    );
  }
}
