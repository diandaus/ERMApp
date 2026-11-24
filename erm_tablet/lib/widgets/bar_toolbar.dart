import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Komponen toolbar putih yg MENEMPEL di bawah navbar (gaya referensi
/// aplikasi kasir): tinggi 48, tombol datar dipisah garis vertikal.
/// Dipakai daftar Poliklinik (sama tampilannya dgn toolbar Rawat Inap).

const _kBarDivider = Border(left: BorderSide(color: kLine));

class BarToolbar extends StatelessWidget {
  final String title;
  final List<Widget> actions;
  const BarToolbar({super.key, required this.title, required this.actions});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      color: Colors.white,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: kText)),
            ),
          ),
          const Spacer(),
          ...actions,
        ],
      ),
    );
  }
}

/// Satu tombol dropdown (gaya "Jenis Order"): teks tosca + ▼.
class BarDropdown<T> extends StatelessWidget {
  final T value;
  final Map<T, String> options;
  final ValueChanged<T> onChanged;
  final String tooltip;
  const BarDropdown({super.key, required this.value, required this.options, required this.onChanged, this.tooltip = ''});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<T>(
      tooltip: tooltip,
      onSelected: onChanged,
      position: PopupMenuPosition.under,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: const BorderSide(color: kLine)),
      itemBuilder: (_) => options.entries.map((e) => PopupMenuItem<T>(
        value: e.key,
        child: Row(
          children: [
            SizedBox(width: 22, child: e.key == value ? const Icon(Icons.check, size: 18, color: kPrimaryDark) : null),
            const SizedBox(width: 6),
            Text(e.value, style: TextStyle(fontSize: 14, fontWeight: e.key == value ? FontWeight.w600 : FontWeight.w400, color: e.key == value ? kPrimaryDark : kText)),
          ],
        ),
      )).toList(),
      child: Container(
        constraints: const BoxConstraints(minWidth: 190),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        decoration: const BoxDecoration(border: _kBarDivider),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(options[value] ?? '$value', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kPrimaryDark)),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_drop_down, size: 26, color: kPrimaryDark),
          ],
        ),
      ),
    );
  }
}

/// Tombol datar (Filter, Muat ulang) dipisah garis vertikal.
class BarButton extends StatelessWidget {
  final IconData icon;
  final String? label;
  final String? tooltip;
  final bool active;
  final VoidCallback onTap;
  const BarButton({super.key, required this.icon, this.label, this.tooltip, this.active = false, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? kPrimaryDark : kText;
    final child = InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: label == null ? 16 : 20),
        decoration: const BoxDecoration(border: _kBarDivider),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            if (label != null) ...[
              const SizedBox(width: 8),
              Text(label!, style: TextStyle(fontSize: 14, fontWeight: active ? FontWeight.w600 : FontWeight.w400, color: color)),
            ],
          ],
        ),
      ),
    );
    return tooltip == null ? child : Tooltip(message: tooltip!, child: child);
  }
}
