import 'package:flutter/material.dart';

/// Ikon face-scan: bracket sudut (viewfinder) + siluet orang (kepala+bahu)
/// + garis scan merah horizontal dgn ujung bulat — viewBox 24x24.
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
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    Offset p(double x, double y) => Offset(x * scale, y * scale);

    // Bracket sudut kiri-atas, kanan-atas, kanan-bawah, kiri-bawah.
    canvas.drawPath(
      Path()
        ..moveTo(p(4, 8).dx, p(4, 8).dy)
        ..lineTo(p(4, 6).dx, p(4, 6).dy)
        ..arcToPoint(p(6, 4), radius: Radius.circular(2 * scale))
        ..lineTo(p(8, 4).dx, p(8, 4).dy),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(16, 4).dx, p(16, 4).dy)
        ..lineTo(p(18, 4).dx, p(18, 4).dy)
        ..arcToPoint(p(20, 6), radius: Radius.circular(2 * scale))
        ..lineTo(p(20, 8).dx, p(20, 8).dy),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(20, 16).dx, p(20, 16).dy)
        ..lineTo(p(20, 18).dx, p(20, 18).dy)
        ..arcToPoint(p(18, 20), radius: Radius.circular(2 * scale))
        ..lineTo(p(16, 20).dx, p(16, 20).dy),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(p(8, 20).dx, p(8, 20).dy)
        ..lineTo(p(6, 20).dx, p(6, 20).dy)
        ..arcToPoint(p(4, 18), radius: Radius.circular(2 * scale))
        ..lineTo(p(4, 16).dx, p(4, 16).dy),
      paint,
    );

    // Kepala.
    canvas.drawCircle(p(12, 10.2), 3.0 * scale, paint);

    // Bahu.
    canvas.drawPath(
      Path()
        ..moveTo(p(6.5, 19).dx, p(6.5, 19).dy)
        ..cubicTo(
          p(6.5, 15).dx, p(6.5, 15).dy,
          p(8.5, 13.2).dx, p(8.5, 13.2).dy,
          p(12, 13.2).dx, p(12, 13.2).dy,
        )
        ..cubicTo(
          p(15.5, 13.2).dx, p(15.5, 13.2).dy,
          p(17.5, 15).dx, p(17.5, 15).dy,
          p(17.5, 19).dx, p(17.5, 19).dy,
        ),
      paint,
    );

    // Garis scan merah + titik ujung.
    const scanRed = Color(0xFFDC2626);
    final scanLine = Paint()
      ..color = scanRed
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8 * scale
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(p(7.6, 10), p(16.4, 10), scanLine);

    final scanDot = Paint()..color = scanRed;
    canvas.drawCircle(p(7.6, 10), 1.0 * scale, scanDot);
    canvas.drawCircle(p(16.4, 10), 1.0 * scale, scanDot);
  }

  @override
  bool shouldRepaint(covariant _FaceScanPainter oldDelegate) => oldDelegate.color != color;
}
