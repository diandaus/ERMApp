import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_user.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';

/// DashboardScreen — padanan Dashboard.tsx (web): kartu Kunjungan Pasien
/// (hari/bulan/tahun ini) + Cara Bayar Poliklinik/Rawat Jalan & Rawat Inap
/// per periode (donut). Endpoint SAMA: GET /api/dashboard/stats — role
/// dokter dikunci ke kd_dokter akun (dikirim walau kosong spy hasil
/// konsisten kosong, bukan bocor semua dokter; sama dgn web).
class DashboardScreen extends StatefulWidget {
  final AppUser user;
  const DashboardScreen({super.key, required this.user});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

typedef _Slice = ({String label, int total});

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _stats = {};
  DateTime? _diperbarui;

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
      final s = await ApiClient.getJson('/api/dashboard/stats', query: widget.user.isDokter ? {'kd_dokter': widget.user.kdDokter} : null);
      if (!mounted) return;
      setState(() {
        _stats = s;
        _diperbarui = DateTime.now();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Gagal memuat data dashboard');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _n(String k) => (_stats[k] as num?)?.toInt() ?? 0;

  List<_Slice> _list(String k) => [
        for (final m in (_stats[k] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>())
          (label: '${m['label'] ?? '-'}', total: (m['total'] as num?)?.toInt() ?? 0),
      ];

  String _sapaan() => "Assalamu'alaikum";

  @override
  Widget build(BuildContext context) {
    if (_loading && _stats.isEmpty) return const Center(child: CircularProgressIndicator());
    final tgl = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now());
    return Container(
      color: kBg,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          // Sapaan + tanggal + muat ulang.
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${_sapaan()}, ${widget.user.fullName}',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: kText)),
                const SizedBox(height: 4),
                Text(
                  widget.user.isDokter ? '$tgl  ·  Data pasien Anda' : tgl,
                  style: const TextStyle(fontSize: 14, color: kTextMuted),
                ),
              ]),
            ),
            if (_diperbarui != null)
              Text('Diperbarui ${DateFormat('HH:mm').format(_diperbarui!)}', style: const TextStyle(fontSize: 13, color: kTextMuted)),
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Muat ulang',
              onPressed: _loading ? null : _load,
              icon: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh, color: kText),
            ),
          ]),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(6)),
              child: Text(_error!, style: const TextStyle(fontSize: 14, color: Color(0xFF991B1B))),
            ),
          ],
          const SizedBox(height: 16),
          _wrap([
            _StatCard(label: 'Kunjungan Pasien Hari Ini', value: _n('kunjungan_hari_ini'), color: const Color(0xFF1AB1E5), icon: Icons.calendar_today_outlined),
            _StatCard(label: 'Kunjungan Pasien Bulan Ini', value: _n('kunjungan_bulan_ini'), color: const Color(0xFFF59E0B), icon: Icons.groups_outlined),
            _StatCard(label: 'Kunjungan Pasien Tahun Ini', value: _n('kunjungan_tahun_ini'), color: const Color(0xFF10B981), icon: Icons.show_chart),
          ], minWidth: 240),
          const SizedBox(height: 24),
          _section('Poliklinik / Rawat Jalan', 'poli'),
          const SizedBox(height: 24),
          _section('Rawat Inap', 'ranap'),
        ]),
      ),
    );
  }

  /// Baris kartu yg menyesuaikan lebar: muat 3 -> sejajar; sempit -> turun.
  Widget _wrap(List<Widget> children, {required double minWidth}) {
    return LayoutBuilder(builder: (context, box) {
      const gap = 16.0;
      final kolom = math.max(1, math.min(children.length, ((box.maxWidth + gap) / (minWidth + gap)).floor()));
      final w = (box.maxWidth - gap * (kolom - 1)) / kolom;
      return Wrap(spacing: gap, runSpacing: gap, children: [for (final c in children) SizedBox(width: w, child: c)]);
    });
  }

  Widget _section(String judul, String jenis) {
    const periode = [('hari_ini', 'Hari Ini', 'Belum ada kunjungan hari ini.'), ('bulan_ini', 'Bulan Ini', 'Belum ada kunjungan bulan ini.'), ('tahun_ini', 'Tahun Ini', 'Belum ada kunjungan tahun ini.')];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(judul, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF282A2A))),
      const SizedBox(height: 12),
      _wrap([
        for (final p in periode) _DonutCard(title: p.$2, data: _list('cara_bayar_${jenis}_${p.$1}'), kosong: p.$3),
      ], minWidth: 260),
    ]);
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final IconData icon;
  const _StatCard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: Colors.white, size: 26),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(NumberFormat.decimalPattern('id_ID').format(value), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: kText, height: 1.1)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 14, color: kTextMuted)),
          ]),
        ),
      ]),
    );
  }
}

/// Warna cara bayar — SAMA dgn getCaraBayarColors web: UMUM ungu, BPJS
/// hijau, PLN oranye, lainnya bergiliran.
List<Color> _warna(List<_Slice> data) {
  const lain = [Color(0xFF3B82F6), Color(0xFFEC4899), Color(0xFF6366F1), Color(0xFF6B7280), Color(0xFF14B8A6), Color(0xFFEF4444)];
  var i = 0;
  return [
    for (final d in data)
      () {
        final l = d.label.trim().toUpperCase();
        if (l == 'UMUM') return const Color(0xFF8B5CF6);
        if (l == 'BPJS') return const Color(0xFF10B981);
        if (l.contains('PLN')) return const Color(0xFFF59E0B);
        return lain[i++ % lain.length];
      }(),
  ];
}

class _DonutCard extends StatelessWidget {
  final String title;
  final List<_Slice> data;
  final String kosong;
  const _DonutCard({required this.title, required this.data, required this.kosong});

  @override
  Widget build(BuildContext context) {
    final total = data.fold<int>(0, (s, d) => s + d.total);
    final warna = _warna(data);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
      child: Column(children: [
        Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kText)),
        const SizedBox(height: 14),
        SizedBox(
          width: 170,
          height: 170,
          child: total == 0
              ? DecoratedBox(
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFFD1D5DB))),
                  child: const Center(child: Text('Belum ada data', style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)))),
                )
              : CustomPaint(
                  painter: _DonutPainter(values: data.map((d) => d.total.toDouble()).toList(), colors: warna),
                  child: Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('Total', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                      Text(NumberFormat.decimalPattern('id_ID').format(total), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: kText)),
                      const Text('Pasien', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                    ]),
                  ),
                ),
        ),
        const SizedBox(height: 14),
        if (data.isEmpty)
          Text(kosong, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)))
        else
          Wrap(alignment: WrapAlignment.center, spacing: 14, runSpacing: 8, children: [
            for (var i = 0; i < data.length; i++)
              Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: warna[i], shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(data[i].label, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
                const SizedBox(width: 4),
                Text('${(data[i].total / total * 100).round()}%', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kText)),
                const SizedBox(width: 3),
                Text('(${data[i].total})', style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
              ]),
          ]),
      ]),
    );
  }
}

/// Donut gaya web: cincin tebal dgn ujung membulat + celah antar irisan,
/// cincin garis-garis tipis di tepi luar.
class _DonutPainter extends CustomPainter {
  final List<double> values;
  final List<Color> colors;
  _DonutPainter({required this.values, required this.colors});

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<double>(0, (a, b) => a + b);
    if (total <= 0) return;
    final c = size.center(Offset.zero);
    final scale = size.width / 220;
    final stroke = 26 * scale;
    final tickOuter = size.width / 2 - 2;
    final tickInner = tickOuter - 5 * scale;
    final r = tickInner - 6 * scale - stroke / 2;

    final tick = Paint()
      ..color = const Color(0xFFE5E7EB)
      ..strokeWidth = 1.5;
    for (var deg = 0; deg < 360; deg += 5) {
      final a = deg * math.pi / 180;
      canvas.drawLine(c + Offset(math.cos(a), math.sin(a)) * tickInner, c + Offset(math.cos(a), math.sin(a)) * tickOuter, tick);
    }

    final rect = Rect.fromCircle(center: c, radius: r);
    final gap = values.length > 1 ? 8 * math.pi / 180 : 0.0;
    var start = -math.pi / 2;
    for (var i = 0; i < values.length; i++) {
      final sweep = values[i] / total * 2 * math.pi;
      final p = Paint()
        ..color = colors[i]
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = values.length > 1 ? StrokeCap.round : StrokeCap.butt;
      if (values[i] / total >= 0.999) {
        canvas.drawCircle(c, r, p);
      } else {
        final s = start + gap / 2;
        final sw = math.max(sweep - gap, 0.02);
        canvas.drawArc(rect, s, sw, false, p);
      }
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.values != values || old.colors != colors;
}
