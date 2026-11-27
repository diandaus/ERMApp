import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/soap_item.dart';
import '../theme/app_theme.dart';
import 'modal_input_kit.dart';

/// Grafik TTV (tanda-tanda vital) — padanan kartu "Grafik TTV" di
/// PemeriksaanRanap.tsx (web): sumber data = riwayat SOAP/CPPT kunjungan
/// ini, diurutkan lama→baru, tiap tanda vital punya grafik & skala sendiri
/// (Sistol/Diastol satu grafik krn satuannya sama). Ditampilkan dlm modal
/// gaya Input Tindakan (tengah, header ✕ + judul).
Future<void> showGrafikTtvPanel(BuildContext context, {required List<SoapItem> riwayat, required String subtitle}) {
  return showModalInput<void>(
    context,
    label: 'Grafik TTV',
    builder: (_) => _GrafikTtvPanel(riwayat: riwayat, subtitle: subtitle),
  );
}

class _Titik {
  final DateTime waktu;
  final double? sistol, diastol, suhu, nadi, respirasi, spo2;
  const _Titik(this.waktu, this.sistol, this.diastol, this.suhu, this.nadi, this.respirasi, this.spo2);
}

class _Seri {
  final String nama;
  final Color warna;
  final List<double?> nilai;
  const _Seri(this.nama, this.warna, this.nilai);
}

class _GrafikTtvPanel extends StatelessWidget {
  final List<SoapItem> riwayat;
  final String subtitle;
  const _GrafikTtvPanel({required this.riwayat, required this.subtitle});

  /// Maks. titik per grafik (web: 8 di kartu sempit; modal lebih lega).
  static const _maks = 14;

  static double? _angka(String v) => double.tryParse(v.trim().replaceAll(',', '.'));

  /// tgl_perawatan dari API = DD/MM/YYYY (bisa juga ISO/YYYY-MM-DD).
  static DateTime? _waktu(String tgl, String jam) {
    String iso;
    if (tgl.contains('T')) {
      iso = tgl.split('T').first;
    } else if (tgl.contains('/')) {
      final p = tgl.split('/');
      if (p.length != 3) return null;
      iso = '${p[2]}-${p[1].padLeft(2, '0')}-${p[0].padLeft(2, '0')}';
    } else {
      iso = tgl;
    }
    final j = jam.isEmpty ? '00:00:00' : (jam.length == 5 ? '$jam:00' : jam);
    return DateTime.tryParse('${iso}T$j');
  }

  List<_Titik> get _titik {
    final list = <_Titik>[];
    for (final s in riwayat) {
      final w = _waktu(s.tglPerawatan, s.jamRawat);
      if (w == null) continue;
      final td = s.tensi.split('/');
      list.add(_Titik(
        w,
        _angka(td.first),
        td.length > 1 ? _angka(td[1]) : null,
        _angka(s.suhuTubuh),
        _angka(s.nadi),
        _angka(s.respirasi),
        _angka(s.spo2),
      ));
    }
    list.sort((a, b) => a.waktu.compareTo(b.waktu));
    return list.length > _maks ? list.sublist(list.length - _maks) : list;
  }

  String _label(DateTime w) => '${w.day}/${w.month}\n${w.hour.toString().padLeft(2, '0')}:${w.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final t = _titik;
    final labels = t.map((p) => _label(p.waktu)).toList();
    final grafik = <Widget>[
      _KartuGrafik(judul: 'Tekanan Darah', satuan: 'mmHg', labels: labels, seri: [
        _Seri('Sistol', const Color(0xFF2563EB), t.map((p) => p.sistol).toList()),
        _Seri('Diastol', const Color(0xFF06B6D4), t.map((p) => p.diastol).toList()),
      ]),
      _KartuGrafik(judul: 'Suhu', satuan: '°C', desimal: true, labels: labels, seri: [
        _Seri('Suhu', const Color(0xFFF59E0B), t.map((p) => p.suhu).toList()),
      ]),
      _KartuGrafik(judul: 'Nadi', satuan: '/mnt', labels: labels, seri: [
        _Seri('Nadi', const Color(0xFFEF4444), t.map((p) => p.nadi).toList()),
      ]),
      _KartuGrafik(judul: 'Respirasi', satuan: '/mnt', labels: labels, seri: [
        _Seri('Respirasi', const Color(0xFF8B5CF6), t.map((p) => p.respirasi).toList()),
      ]),
      _KartuGrafik(judul: 'SpO2', satuan: '%', labels: labels, seri: [
        _Seri('SpO2', const Color(0xFF10B981), t.map((p) => p.spo2).toList()),
      ]),
    ];

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        height: 60,
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kKitBorder))),
        child: Row(children: [
          const SizedBox(width: 8),
          IconButton(tooltip: 'Tutup', onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close, size: 26, color: kText)),
          const SizedBox(width: 4),
          Expanded(
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Grafik TTV', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: kText)),
              if (subtitle.isNotEmpty) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: kTextMuted)),
            ]),
          ),
          const SizedBox(width: 16),
        ]),
      ),
      Expanded(
        child: t.isEmpty
            ? const Center(
                child: Text('Belum ada riwayat SOAP untuk digrafikkan', style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
              )
            : LayoutBuilder(builder: (context, box) {
                // Lebar -> 2 kolom; sempit -> 1 kolom.
                final dua = box.maxWidth >= 760;
                final lebar = dua ? (box.maxWidth - 40 - 16) / 2 : box.maxWidth - 40;
                return ListView(padding: const EdgeInsets.all(20), children: [
                  Wrap(spacing: 16, runSpacing: 16, children: [for (final g in grafik) SizedBox(width: lebar, child: g)]),
                  const SizedBox(height: 12),
                  Text(
                    '${t.length} data terakhir · ${t.first.waktu.day}/${t.first.waktu.month}/${t.first.waktu.year} – '
                    '${t.last.waktu.day}/${t.last.waktu.month}/${t.last.waktu.year}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: kTextMuted),
                  ),
                ]);
              }),
      ),
    ]);
  }
}

class _KartuGrafik extends StatelessWidget {
  final String judul;
  final String satuan;
  final List<String> labels;
  final List<_Seri> seri;
  final bool desimal;
  const _KartuGrafik({required this.judul, required this.satuan, required this.labels, required this.seri, this.desimal = false});

  @override
  Widget build(BuildContext context) {
    final ada = seri.any((s) => s.nilai.any((v) => v != null));
    // Nilai terakhir tiap seri (yg terisi) — ditampilkan di header kartu.
    String terakhir(_Seri s) {
      final v = s.nilai.lastWhere((v) => v != null, orElse: () => null);
      if (v == null) return '-';
      return desimal ? v.toStringAsFixed(1) : v.round().toString();
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: kKitBorder), borderRadius: BorderRadius.circular(6)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(judul, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kText))),
          Text(
            '${seri.map(terakhir).join('/')} $satuan',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText),
          ),
        ]),
        const SizedBox(height: 10),
        SizedBox(
          height: 170,
          child: ada
              ? CustomPaint(size: Size.infinite, painter: _GrafikPainter(seri: seri, labels: labels, desimal: desimal))
              : const Center(child: Text('Tidak ada data', style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)))),
        ),
        if (seri.length > 1) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 14, children: [
            for (final s in seri)
              Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: s.warna, shape: BoxShape.circle)),
                const SizedBox(width: 5),
                Text(s.nama, style: TextStyle(fontSize: 12, color: s.warna, fontWeight: FontWeight.w500)),
              ]),
          ]),
        ],
      ]),
    );
  }
}

/// Grafik garis sederhana: grid horizontal 4 tick + label Y, grid vertikal
/// per titik + label waktu (tgl & jam), garis 2px + titik data — sama gaya
/// renderVitalChart web. Nilai kosong dilewati (garis menyambung).
class _GrafikPainter extends CustomPainter {
  final List<_Seri> seri;
  final List<String> labels;
  final bool desimal;
  _GrafikPainter({required this.seri, required this.labels, required this.desimal});

  static const _kiri = 40.0, _kanan = 12.0, _atas = 8.0, _bawah = 34.0;
  static const _grid = Color(0xFFF0F1F1);
  static const _teks = Color(0xFF9CA3AF);

  void _tulis(Canvas c, String s, Offset pos, {TextAlign align = TextAlign.center, double size = 10}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, color: _teks, height: 1.2)),
      textAlign: align,
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = align == TextAlign.right ? pos.dx - tp.width : pos.dx - tp.width / 2;
    tp.paint(c, Offset(dx, pos.dy - (align == TextAlign.right ? tp.height / 2 : 0)));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final semua = [for (final s in seri) ...s.nilai.whereType<double>()];
    if (semua.isEmpty) return;
    final mn = semua.reduce(math.min), mx = semua.reduce(math.max);
    final margin = (mx - mn) * 0.15 == 0 ? 5.0 : (mx - mn) * 0.15;
    final lo = mn - margin, hi = mx + margin, span = hi - lo;
    final w = size.width - _kiri - _kanan, h = size.height - _atas - _bawah;
    final n = labels.length;
    double x(int i) => _kiri + (n > 1 ? w * i / (n - 1) : w / 2);
    double y(double v) => _atas + h - (v - lo) / span * h;

    final gridPaint = Paint()
      ..color = _grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final v = lo + span * i / 4;
      canvas.drawLine(Offset(_kiri, y(v)), Offset(size.width - _kanan, y(v)), gridPaint);
      _tulis(canvas, desimal ? v.toStringAsFixed(1) : v.round().toString(), Offset(_kiri - 6, y(v)), align: TextAlign.right);
    }
    // Label waktu: semua titik kalau muat, selain itu dijarangkan.
    final tiap = math.max(1, (n * 46 / math.max(w, 1)).ceil());
    for (var i = 0; i < n; i++) {
      canvas.drawLine(Offset(x(i), _atas), Offset(x(i), _atas + h), gridPaint);
      if (i % tiap == 0 || i == n - 1) _tulis(canvas, labels[i], Offset(x(i), _atas + h + 5), size: 9);
    }

    for (final s in seri) {
      final garis = Paint()
        ..color = s.warna
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      final titik = Paint()..color = s.warna;
      final path = Path();
      var mulai = true;
      for (var i = 0; i < s.nilai.length; i++) {
        final v = s.nilai[i];
        if (v == null) continue;
        final o = Offset(x(i), y(v));
        mulai ? path.moveTo(o.dx, o.dy) : path.lineTo(o.dx, o.dy);
        mulai = false;
      }
      canvas.drawPath(path, garis);
      for (var i = 0; i < s.nilai.length; i++) {
        final v = s.nilai[i];
        if (v != null) canvas.drawCircle(Offset(x(i), y(v)), 3.5, titik);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _GrafikPainter old) => old.seri != seri || old.labels != labels;
}
