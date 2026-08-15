import 'dart:async';

import 'package:flutter/material.dart';

import '../models/pengumuman.dart';
import '../services/pengumuman_service.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kCardHeight = 96.0;

const _kBulanId = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

String _formatTanggalId(String yyyyMMdd) {
  final d = DateTime.tryParse(yyyyMMdd);
  if (d == null) return yyyyMMdd;
  return '${d.day} ${_kBulanId[d.month]} ${d.year}';
}

({Color bg, Color fg, Color accent, IconData icon}) _prioritasStyle(String p) {
  switch (p) {
    case 'urgent':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B), accent: const Color(0xFFDC2626), icon: Icons.campaign_outlined);
    case 'penting':
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E), accent: const Color(0xFFF59E0B), icon: Icons.campaign_outlined);
    default:
      return (bg: const Color(0xFFDBEAFE), fg: const Color(0xFF1D4ED8), accent: const Color(0xFF2563EB), icon: Icons.campaign_outlined);
  }
}

void _bukaDetail(BuildContext context, Pengumuman p) {
  final style = _prioritasStyle(p.prioritas);
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(width: 36, height: 4, decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: Text(p.judul, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(p.prioritas, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: style.fg)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(_formatTanggalId(p.tanggal), style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 12),
          Text(p.isi, style: const TextStyle(fontSize: 13, color: Color(0xFF374151), height: 1.5)),
        ],
      ),
    ),
  );
}

/// Satu pengumuman = satu kartu (background putih + border sendiri),
/// tinggi TETAP (_kCardHeight) — wajib sama tiap halaman spy PageView
/// bisa swipe mulus. Kartu2 ini yg langsung "mengambang" di atas
/// background (bukan ditumpuk lagi di dalam satu kotak besar). Tap
/// kartu buka detail lengkap lewat bottom sheet (bukan expand di
/// tempat, krn tinggi kartu fixed).
class _PengumumanSlide extends StatelessWidget {
  final Pengumuman p;
  const _PengumumanSlide({required this.p});

  @override
  Widget build(BuildContext context) {
    final style = _prioritasStyle(p.prioritas);
    return GestureDetector(
      onTap: () => _bukaDetail(context, p),
      child: Container(
        height: _kCardHeight,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(8)),
              child: Icon(style.icon, size: 15, color: style.accent),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(p.judul, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
                        child: Text(p.prioritas, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: style.fg)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(_formatTanggalId(p.tanggal), style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 4),
                  Text(
                    p.isi,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Kartu "Pengumuman & Informasi Penting" — dipakai di Home dan Saya.
/// Kalau pengumuman aktif > 1, tampil sbg carousel yg bisa di-swipe
/// sendiri (spt banner iklan/info di DANA/ShopeePay) DAN otomatis
/// gonta-ganti tiap 5 detik. Render kosong (SizedBox.shrink) kalau
/// tidak ada pengumuman aktif. [margin] default cocok utk ListView
/// berpadding nol (mis. Home); beri margin custom (mis. cuma top) kalau
/// parent ListView-nya sudah punya padding horizontal sendiri (mis.
/// Saya).
class PengumumanCard extends StatefulWidget {
  final EdgeInsets margin;
  const PengumumanCard({super.key, this.margin = const EdgeInsets.fromLTRB(16, 16, 16, 0)});

  @override
  State<PengumumanCard> createState() => _PengumumanCardState();
}

class _PengumumanCardState extends State<PengumumanCard> {
  bool _loading = true;
  List<Pengumuman> _list = [];
  int _currentIndex = 0;
  Timer? _autoAdvanceTimer;
  late final PageController _pageController = PageController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _autoAdvanceTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await PengumumanService.getAktif();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
      _startAutoAdvance();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  // Auto-advance tiap 5 detik lewat animateToPage (bukan cuma ganti
  // state) spy transisinya geser mulus persis kayak user swipe sendiri,
  // konsisten sama interaksi manual. User tetap bisa swipe kapan saja —
  // onPageChanged di bawah yg jadi satu2nya sumber _currentIndex, jadi
  // auto-advance & swipe manual otomatis singkron.
  void _startAutoAdvance() {
    _autoAdvanceTimer?.cancel();
    if (_list.length <= 1) return;
    _autoAdvanceTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_currentIndex + 1) % _list.length;
      _pageController.animateToPage(next, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    if (_list.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: widget.margin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Pengumuman & Informasi Penting', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          const SizedBox(height: 10),
          SizedBox(
            height: _kCardHeight,
            child: PageView.builder(
              controller: _pageController,
              itemCount: _list.length,
              onPageChanged: (i) => setState(() => _currentIndex = i),
              itemBuilder: (context, i) => _PengumumanSlide(p: _list[i]),
            ),
          ),
        ],
      ),
    );
  }
}
