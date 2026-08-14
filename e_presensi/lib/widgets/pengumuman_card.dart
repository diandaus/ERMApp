import 'package:flutter/material.dart';

import '../models/pengumuman.dart';
import '../services/pengumuman_service.dart';

const _kBorder = Color(0xFFE5E7EB);

const _kBulanId = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

String _formatTanggalId(String yyyyMMdd) {
  final d = DateTime.tryParse(yyyyMMdd);
  if (d == null) return yyyyMMdd;
  return '${d.day} ${_kBulanId[d.month]} ${d.year}';
}

/// Kartu "Pengumuman & Informasi Penting" — dipakai di Home dan Saya.
/// Render kosong (SizedBox.shrink) kalau tidak ada pengumuman aktif.
/// [margin] default cocok utk ListView berpadding nol (mis. Home); beri
/// margin custom (mis. cuma top) kalau parent ListView-nya sudah punya
/// padding horizontal sendiri (mis. Saya).
class PengumumanCard extends StatefulWidget {
  final EdgeInsets margin;
  const PengumumanCard({super.key, this.margin = const EdgeInsets.fromLTRB(16, 16, 16, 0)});

  @override
  State<PengumumanCard> createState() => _PengumumanCardState();
}

class _PengumumanCardState extends State<PengumumanCard> {
  bool _loading = true;
  List<Pengumuman> _list = [];
  int? _expandedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await PengumumanService.getAktif();
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    if (_list.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: widget.margin,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Pengumuman & Informasi Penting', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          const SizedBox(height: 10),
          ..._list.map((p) {
            final style = _prioritasStyle(p.prioritas);
            final expanded = _expandedId == p.id;
            return GestureDetector(
              onTap: () => setState(() => _expandedId = expanded ? null : p.id),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: _kBorder),
                  borderRadius: BorderRadius.circular(12),
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
                              Expanded(child: Text(p.judul, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
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
                            maxLines: expanded ? null : 2,
                            overflow: expanded ? TextOverflow.visible : TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
