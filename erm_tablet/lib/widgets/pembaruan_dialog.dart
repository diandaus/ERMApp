import 'package:flutter/material.dart';

import '../services/update_service.dart';
import '../theme/app_theme.dart';

/// Alur pembaruan aplikasi: dialog info rilis (versi, ukuran, catatan) ->
/// cek izin "Instal aplikasi tak dikenal" -> unduh dgn progres -> buka
/// installer Android. Dipakai Pengaturan > Lainnya & notifikasi saat start.
Future<void> tawarkanPembaruan(BuildContext context, CekUpdateHasil hasil) async {
  final r = hasil.terbaru!;
  final setuju = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Pembaruan Tersedia'),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Versi ${r.versi} (build ${r.buildNumber}) — ${r.ukuranLabel}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('Terpasang: ${hasil.versiTerpasang} (build ${hasil.buildTerpasang})',
                  style: const TextStyle(fontSize: 13, color: kTextMuted)),
              if (r.catatan.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Yang baru:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(r.catatan, style: const TextStyle(fontSize: 14, height: 1.4)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Nanti')),
        ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Perbarui')),
      ],
    ),
  );
  if (setuju != true || !context.mounted) return;

  if (!await UpdateService.bisaInstal()) {
    if (!context.mounted) return;
    final buka = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Izinkan Instalasi'),
        content: const SizedBox(
          width: 460,
          child: Text('Agar bisa memperbarui sendiri, aktifkan "Izinkan dari sumber ini" untuk ERM Tablet '
              'di layar berikutnya, lalu kembali ke aplikasi dan tekan Perbarui lagi.'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Buka Pengaturan')),
        ],
      ),
    );
    if (buka == true) await UpdateService.bukaIzinInstal();
    return;
  }
  if (!context.mounted) return;

  final progress = ValueNotifier<double?>(0);
  final nav = Navigator.of(context, rootNavigator: true);
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => PopScope(
      canPop: false,
      child: AlertDialog(
        title: const Text('Mengunduh Pembaruan'),
        content: ValueListenableBuilder<double?>(
          valueListenable: progress,
          builder: (_, p, __) => Column(mainAxisSize: MainAxisSize.min, children: [
            LinearProgressIndicator(value: p, minHeight: 8, borderRadius: BorderRadius.circular(4)),
            const SizedBox(height: 12),
            Text(p == null ? 'Mengunduh...' : '${(p * 100).toStringAsFixed(0)}%',
                style: const TextStyle(fontSize: 14, color: kTextMuted)),
          ]),
        ),
      ),
    ),
  );
  try {
    final path = await UpdateService.unduh(r, (p) => progress.value = p);
    nav.pop();
    await UpdateService.instal(path);
  } catch (e) {
    nav.pop();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pembaruan gagal: $e'), backgroundColor: const Color(0xFFDC2626)));
    }
  } finally {
    // Setelah animasi tutup dialog progres (masih mendengarkan notifier).
    Future.delayed(const Duration(milliseconds: 600), progress.dispose);
  }
}
