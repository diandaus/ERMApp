import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/booking_operasi_item.dart';
import '../services/klinis_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

({Color bg, Color fg}) operasiStatusStyle(String status) {
  switch (status) {
    case 'Menunggu':
      return (bg: const Color(0xFFF97316), fg: Colors.white);
    case 'Proses Operasi':
      return (bg: const Color(0xFF2563EB), fg: Colors.white);
    case 'Selesai':
      return (bg: const Color(0xFF059669), fg: Colors.white);
    default:
      return (bg: const Color(0xFFF3F4F6), fg: const Color(0xFF374151));
  }
}

/// Padanan OperasiMobileView di PresensiMobile.tsx — jadwal operasi hari
/// ini (read-only), reuse endpoint yg sama dgn JadwalOperasi.tsx desktop.
/// Akun dokter dikunci ke operasi miliknya sendiri (kode_operator ==
/// kd_dokter), sama pola PoliView (fail-closed kalau belum ditautkan).
class OperasiView extends StatefulWidget {
  final AppUser user;
  const OperasiView({super.key, required this.user});

  @override
  State<OperasiView> createState() => _OperasiViewState();
}

class _OperasiViewState extends State<OperasiView> {
  bool _loading = true;
  String? _error;
  List<BookingOperasiItem> _list = [];
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
      final list = await KlinisService.getOperasiHariIni();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil jadwal operasi';
        _loading = false;
      });
    }
  }

  List<BookingOperasiItem> get _filtered {
    var rows = _list;
    if (_isDokterLocked) {
      rows = _lockedKdDokter.isNotEmpty ? rows.where((p) => p.kodeOperator == _lockedKdDokter).toList() : [];
    }
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      rows = rows.where((p) => p.namaPasien.toLowerCase().contains(q) || p.noRawat.toLowerCase().contains(q)).toList();
    }
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Jadwal Operasi Hari Ini', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
                hintText: 'Cari nama pasien / no. rawat...',
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
                  'Akun ini belum ditautkan ke data dokter (kd_dokter). Hubungi admin agar jadwal operasi bisa ditampilkan.',
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
                child: Center(child: Text('Belum ada jadwal operasi hari ini', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._filtered.map((p) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _OperasiCard(item: p))),
          ],
        ),
      ),
    );
  }
}

class _OperasiCard extends StatelessWidget {
  final BookingOperasiItem item;
  const _OperasiCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final st = operasiStatusStyle(item.status);
    final jamRange = item.jamSelesai.isNotEmpty && item.jamSelesai != '00:00:00'
        ? '${item.jamMulai.substring(0, 5)} - ${item.jamSelesai.substring(0, 5)}'
        : item.jamMulai.substring(0, 5);
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
                    Text(item.namaPasien, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text('${item.noRawat} · ${item.umur}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
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
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.operasi, style: const TextStyle(fontSize: 11, color: Color(0xFF374151)))),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('$jamRange · ${item.operator}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
          Padding(padding: const EdgeInsets.only(top: 2), child: Text('${item.kodeOk} · ${item.namaRuangOperasi}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
        ],
      ),
    );
  }
}
