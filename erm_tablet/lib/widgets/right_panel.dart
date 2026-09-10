import 'package:flutter/material.dart';

/// showRightPanel — modal geser dari kanan ke kiri, lebar sebagian layar
/// (default 40%), dipakai landscape (Filter Rawat Inap, Tambah Obat,
/// Pilih dari Resep) — lebih pas di layar lebar drpd AlertDialog di
/// tengah. Padanan pola _openFilterPanel di RanapTableScreen, dipusatkan
/// di sini spy tidak diduplikasi.
Future<T?> showRightPanel<T>(BuildContext context, {required WidgetBuilder builder, double widthFraction = 0.4}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: '',
    barrierColor: Colors.black38,
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (context, _, __) {
      return Align(
        alignment: Alignment.centerRight,
        child: SizedBox(
          width: MediaQuery.of(context).size.width * widthFraction,
          height: double.infinity,
          child: builder(context),
        ),
      );
    },
    transitionBuilder: (context, anim, __, child) {
      return SlideTransition(
        position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
        child: child,
      );
    },
  );
}
