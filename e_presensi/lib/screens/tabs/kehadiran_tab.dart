import 'package:flutter/material.dart';

import '../../models/riwayat_row.dart';
import '../../services/api_config.dart';
import '../../services/presensi_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan getStatusStyle di PresensiMobile.tsx — suffix " & PSW" (Pulang
/// Sebelum Waktunya) dilepas dulu sblm dicocokkan, status yg tak dikenal
/// jatuh ke warna netral (bukan crash/kosong).
({Color bg, Color fg}) _statusStyle(String status) {
  final base = status.replaceAll(' & PSW', '');
  switch (base) {
    case 'Tepat Waktu':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534));
    case 'Terlambat Toleransi':
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E));
    case 'Terlambat I':
      return (bg: const Color(0xFFFFEDD5), fg: const Color(0xFF9A3412));
    case 'Terlambat II':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B));
    default:
      return (bg: const Color(0xFFF3F4F6), fg: const Color(0xFF374151));
  }
}

/// Padanan KehadiranTab di PresensiMobile.tsx — riwayat presensi aktual
/// bulan berjalan (read-only, tanpa filter/navigasi bulan, spt versi web).
class KehadiranTab extends StatefulWidget {
  final String nik;
  const KehadiranTab({super.key, required this.nik});

  @override
  State<KehadiranTab> createState() => _KehadiranTabState();
}

class _KehadiranTabState extends State<KehadiranTab> {
  bool _loading = true;
  List<RiwayatRow> _list = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await PresensiService.getRiwayat(widget.nik);
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

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      color: _kGreenDark,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Riwayat Kehadiran Bulan Ini',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
            )
          else if (_list.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('Belum ada riwayat presensi bulan ini', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
            )
          else
            ..._list.map((row) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _RiwayatRowTile(row: row),
                )),
        ],
      ),
    );
  }
}

void _showFotoPreview(BuildContext context, String url, String label) {
  showDialog(
    context: context,
    barrierColor: Colors.black87,
    builder: (_) => Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.all(10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(url, fit: BoxFit.contain),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _FotoThumb extends StatelessWidget {
  final String? url;
  final String label;
  const _FotoThumb({required this.url, required this.label});

  @override
  Widget build(BuildContext context) {
    if (url == null) return const SizedBox.shrink();
    return GestureDetector(
      onTap: () => _showFotoPreview(context, url!, label),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.network(
          url!,
          width: 36,
          height: 36,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
            child: const Icon(Icons.broken_image_outlined, size: 16, color: Color(0xFF9CA3AF)),
          ),
        ),
      ),
    );
  }
}

/// Leading (kiri) tiap kartu riwayat — foto masuk/pulang (kalau ada,
/// letaknya SEBELUM tanggal & jam, bukan di bawahnya lagi) atau placeholder
/// abu-abu kalau belum ada foto sama sekali (mis. presensi dari sblm fitur
/// foto ada, atau upload gagal) supaya layout tiap kartu tetap konsisten.
class _FotoLeading extends StatelessWidget {
  final String? fotoMasuk;
  final String? fotoPulang;
  final String labelMasuk;
  final String labelPulang;
  const _FotoLeading({required this.fotoMasuk, required this.fotoPulang, required this.labelMasuk, required this.labelPulang});

  @override
  Widget build(BuildContext context) {
    if (fotoMasuk == null && fotoPulang == null) {
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
        child: const Icon(Icons.image_not_supported_outlined, size: 16, color: Color(0xFF9CA3AF)),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _FotoThumb(url: fotoMasuk, label: labelMasuk),
        if (fotoMasuk != null && fotoPulang != null) const SizedBox(width: 4),
        _FotoThumb(url: fotoPulang, label: labelPulang),
      ],
    );
  }
}

class _RiwayatRowTile extends StatelessWidget {
  final RiwayatRow row;
  const _RiwayatRowTile({required this.row});

  @override
  Widget build(BuildContext context) {
    final style = _statusStyle(row.status);
    final jamDatang = row.jamDatang.isEmpty ? '--:--' : row.jamDatang;
    final jamPulang = row.jamPulang.isEmpty ? '--:--' : row.jamPulang;
    final fotoMasuk = resolvePhotoUrl(row.fotoMasuk);
    final fotoPulang = resolvePhotoUrl(row.fotoPulang);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          _FotoLeading(
            fotoMasuk: fotoMasuk,
            fotoPulang: fotoPulang,
            labelMasuk: 'Foto Masuk — ${row.tanggal} $jamDatang',
            labelPulang: 'Foto Pulang — ${row.tanggal} $jamPulang',
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(row.tanggal, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('$jamDatang → $jamPulang · ${row.durasi}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
            child: Text(row.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: style.fg)),
          ),
        ],
      ),
    );
  }
}
