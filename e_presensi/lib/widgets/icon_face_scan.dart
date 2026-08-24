import 'package:flutter/material.dart';

/// Ikon Absen: bracket sudut rounded (frame) + wajah senyum (2 titik mata +
/// garis senyum) — viewBox 24x24, padanan persis SVG yang diminta user
/// (bukan lagi versi "face-scan + garis merah" sebelumnya).
class IconFaceScan extends StatelessWidget {
  final double size;
  final Color color;
  const IconFaceScan({super.key, this.size = 28, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: _FaceScanPainter(color),
    );
  }
}

class _FaceScanPainter extends CustomPainter {
  final Color color;
  _FaceScanPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fillPaint = Paint()..color = color;

    Offset p(double x, double y) => Offset(x * scale, y * scale);

    // 4 bracket sudut rounded (frame), masing2 dari path SVG
    // "M.. C.. C.." (2 cubic bezier per sudut).
    canvas.drawPath(
      Path()
        ..moveTo(p(22, 14).dx, p(22, 14).dy)
        ..cubicTo(p(22, 17.7712).dx, p(22, 17.7712).dy, p(22, 19.6569).dx, p(22, 19.6569).dy, p(20.8284, 20.8284).dx, p(20.8284, 20.8284).dy)
        ..cubicTo(p(19.6569, 22).dx, p(19.6569, 22).dy, p(17.7712, 22).dx, p(17.7712, 22).dy, p(14, 22).dx, p(14, 22).dy),
      strokePaint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(10, 22).dx, p(10, 22).dy)
        ..cubicTo(p(6.22876, 22).dx, p(6.22876, 22).dy, p(4.34315, 22).dx, p(4.34315, 22).dy, p(3.17157, 20.8284).dx, p(3.17157, 20.8284).dy)
        ..cubicTo(p(2, 19.6569).dx, p(2, 19.6569).dy, p(2, 17.7712).dx, p(2, 17.7712).dy, p(2, 14).dx, p(2, 14).dy),
      strokePaint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(10, 2).dx, p(10, 2).dy)
        ..cubicTo(p(6.22876, 2).dx, p(6.22876, 2).dy, p(4.34315, 2).dx, p(4.34315, 2).dy, p(3.17157, 3.17157).dx, p(3.17157, 3.17157).dy)
        ..cubicTo(p(2, 4.34315).dx, p(2, 4.34315).dy, p(2, 6.22876).dx, p(2, 6.22876).dy, p(2, 10).dx, p(2, 10).dy),
      strokePaint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(14, 2).dx, p(14, 2).dy)
        ..cubicTo(p(17.7712, 2).dx, p(17.7712, 2).dy, p(19.6569, 2).dx, p(19.6569, 2).dy, p(20.8284, 3.17157).dx, p(20.8284, 3.17157).dy)
        ..cubicTo(p(22, 4.34315).dx, p(22, 4.34315).dy, p(22, 6.22876).dx, p(22, 6.22876).dy, p(22, 10).dx, p(22, 10).dy),
      strokePaint,
    );

    // Senyum.
    canvas.drawPath(
      Path()
        ..moveTo(p(9, 16).dx, p(9, 16).dy)
        ..cubicTo(p(9.85038, 16.6303).dx, p(9.85038, 16.6303).dy, p(10.8846, 17).dx, p(10.8846, 17).dy, p(12, 17).dx, p(12, 17).dy)
        ..cubicTo(p(13.1154, 17).dx, p(13.1154, 17).dy, p(14.1496, 16.6303).dx, p(14.1496, 16.6303).dy, p(15, 16).dx, p(15, 16).dy),
      strokePaint,
    );

    // 2 mata (ellipse terisi penuh).
    canvas.drawOval(Rect.fromCenter(center: p(15, 10.5), width: 2 * scale, height: 3 * scale), fillPaint);
    canvas.drawOval(Rect.fromCenter(center: p(9, 10.5), width: 2 * scale, height: 3 * scale), fillPaint);
  }

  @override
  bool shouldRepaint(covariant _FaceScanPainter oldDelegate) => oldDelegate.color != color;
}
