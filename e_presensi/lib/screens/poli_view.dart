import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/pasien_kunjungan_item.dart';
import '../services/klinis_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

({Color bg, Color fg, String label}) poliStatusStyle(String s) {
  switch (s) {
    case 'Sudah':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534), label: 'Sudah');
    case 'Belum':
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E), label: 'Belum');
    case 'Batal':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B), label: 'Batal');
    case 'Dirujuk':
      return (bg: const Color(0xFFDBEAFE), fg: const Color(0xFF1E40AF), label: 'Dirujuk');
    case 'Dirawat':
      return (bg: const Color(0xFFF3E8FF), fg: const Color(0xFF6B21A8), label: 'Dirawat');
    default:
      return (bg: const Color(0xFFF3F4F6), fg: const Color(0xFF374151), label: s.isEmpty ? '-' : s);
  }
}

/// Padanan PoliMobileView di PresensiMobile.tsx — daftar pasien poli hari
/// ini (read-only). Akun dokter dikunci ke pasiennya sendiri (kd_dokter);
/// kalau akun dokter belum ditautkan, daftar SENGAJA dikosongkan (bukan
/// tampil semua) supaya kesalahan tautan ketahuan, bukan diam-diam bocor
/// ke pasien dokter lain.
class PoliView extends StatefulWidget {
  final AppUser user;
  const PoliView({super.key, required this.user});

  @override
  State<PoliView> createState() => _PoliViewState();
}

class _PoliViewState extends State<PoliView> {
  bool _loading = true;
  String? _error;
  List<PasienKunjunganItem> _list = [];
  final _searchCtrl = TextEditingController();

  bool get _isDokterLocked => widget.user.role == 'dokter';
  String get _lockedKdDokter => widget.user.kdDokter;

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
      final list = await KlinisService.getPoliToday();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data pasien poli';
        _loading = false;
      });
    }
  }

  List<PasienKunjunganItem> get _filtered {
    var rows = _list;
    if (_isDokterLocked) {
      rows = _lockedKdDokter.isNotEmpty ? rows.where((p) => p.kdDokter == _lockedKdDokter).toList() : [];
    }
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      rows = rows.where((p) => p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q)).toList();
    }
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Daftar Pasien Poli', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
            if (_isDokterLocked && _lockedKdDokter.isEmpty)
              Container(
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(10)),
                child: const Text(
                  'Akun ini belum ditautkan ke data dokter (kd_dokter). Hubungi admin agar daftar pasien poli bisa ditampilkan.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
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
                child: Center(child: Text('Belum ada pasien poli hari ini', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._filtered.map((p) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _PoliCard(item: p))),
          ],
        ),
      ),
    );
  }
}

class _PoliCard extends StatelessWidget {
  final PasienKunjunganItem item;
  const _PoliCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final st = poliStatusStyle(item.stts);
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
                decoration: BoxDecoration(color: st.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(st.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: st.fg)),
              ),
            ],
          ),
          Padding(padding: const EdgeInsets.only(top: 6), child: Text('${item.nmPoli} · ${item.nmDokter}', style: const TextStyle(fontSize: 11, color: Color(0xFF374151)))),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('Jam daftar ${item.jamReg} · ${item.statusBayar}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
        ],
      ),
    );
  }
}
