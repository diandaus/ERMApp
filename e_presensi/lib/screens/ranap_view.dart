import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/ranap_pasien_item.dart';
import '../services/klinis_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan RanapMobileView di PresensiMobile.tsx — daftar pasien rawat
/// inap yg belum pulang (read-only). Beda dr Poli: kalau akun dokter
/// belum ditautkan (kd_dokter kosong), filter kd_dokter SENGAJA tidak
/// dikirim shg daftar tampil semua pasien (bukan dikosongkan) — konsisten
/// dgn perilaku RawatInapView desktop yg sudah ada.
class RanapView extends StatefulWidget {
  final AppUser user;
  const RanapView({super.key, required this.user});

  @override
  State<RanapView> createState() => _RanapViewState();
}

class _RanapViewState extends State<RanapView> {
  bool _loading = true;
  String? _error;
  List<RanapPasienItem> _list = [];
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
      final kdDokter = widget.user.role == 'dokter' ? widget.user.kdDokter : null;
      final list = await KlinisService.getRanapList(kdDokter: kdDokter);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data pasien rawat inap';
        _loading = false;
      });
    }
  }

  List<RanapPasienItem> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _list;
    return _list.where((p) => p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Daftar Pasien Ranap', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
                child: Center(child: Text('Tidak ada pasien rawat inap', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._filtered.map((p) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _RanapCard(item: p))),
          ],
        ),
      ),
    );
  }
}

class _RanapCard extends StatelessWidget {
  final RanapPasienItem item;
  const _RanapCard({required this.item});

  @override
  Widget build(BuildContext context) {
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
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text('${item.noRkmMedis} · ${item.umur}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(999)),
                child: Text(item.lama.isEmpty ? '-' : item.lama, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6B21A8))),
              ),
            ],
          ),
          Padding(padding: const EdgeInsets.only(top: 6), child: Text('${item.kamar} · ${item.nmDokter}', style: const TextStyle(fontSize: 11, color: Color(0xFF374151)))),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('Masuk ${item.tglMasuk} ${item.jamMasuk} · ${item.statusBayar}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
        ],
      ),
    );
  }
}
