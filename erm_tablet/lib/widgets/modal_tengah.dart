import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Modal gaya referensi "Pilih Jenis Order" (sama dgn modal Input Tindakan):
/// di tengah horizontal, siku (radius 0), menempel tepat di bawah status bar
/// sampai dasar layar. Header setinggi navbar (60) — lihat [ModalTengahHeader].
Future<T?> showModalTengah<T>(BuildContext context, {required WidgetBuilder builder, double widthFactor = 0.5, String label = 'Modal'}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: label,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (context, _, __) => Padding(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      child: Align(
        alignment: Alignment.topCenter,
        child: FractionallySizedBox(
          widthFactor: widthFactor,
          heightFactor: 1,
          child: Material(color: Colors.white, child: builder(context)),
        ),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.96, end: 1).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)), child: child),
    ),
  );
}

/// Header modal: ✕ + judul di kiri; aksi sekunder teks tosca (mis. "Reset")
/// lalu blok aksi utama tosca (mis. "Terapkan") menempel di pojok kanan atas.
class ModalTengahHeader extends StatelessWidget {
  final String title;
  final String actionLabel;
  final VoidCallback? onAction;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  const ModalTengahHeader({super.key, required this.title, required this.actionLabel, this.onAction, this.secondaryLabel, this.onSecondary});

  @override
  Widget build(BuildContext context) {
    final aktif = onAction != null;
    return Container(
      height: 60,
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kLine))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Tutup',
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close, size: 26, color: kText),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: kText)),
            ),
          ),
          if (secondaryLabel != null)
            InkWell(
              onTap: onSecondary,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Center(
                  child: Text(secondaryLabel!, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: kPrimary)),
                ),
              ),
            ),
          Material(
            color: aktif ? kPrimary : const Color(0xFFDADDDD),
            child: InkWell(
              onTap: onAction,
              child: Container(
                width: 150,
                alignment: Alignment.center,
                child: Text(actionLabel, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: aktif ? Colors.white : const Color(0xFFA3A8A8))),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Label field gaya referensi ("JENIS ORDER"): 13, KAPITAL, renggang, semibold.
class ModalLabel extends StatelessWidget {
  final String text;
  const ModalLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.8, color: kText)),
      );
}
