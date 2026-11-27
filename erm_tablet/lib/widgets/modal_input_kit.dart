import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Kit modal input gaya "Input Tindakan" — dipakai bersama modal Permintaan
/// Lab, Permintaan Radiologi & Input Diagnosa: modal di tengah horizontal
/// (lebar 64%) menempel di bawah status bar s/d dasar layar, header ✕ +
/// judul (+ info pasien) dan blok "Simpan" tosca di pojok kanan atas.

const kKitBorder = Color(0xFFE6E8E8);
const kKitField = Color(0xFFCFD1D1);
const kKitGreen = Color(0xFF04C99E);
const kKitMint = Color(0xFFEBFAED);
const kKitRed = Color(0xFFDC2626);

Future<T?> showModalInput<T>(BuildContext context, {required String label, required WidgetBuilder builder}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: label,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Padding(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      child: Align(
        alignment: Alignment.topCenter,
        child: FractionallySizedBox(widthFactor: 0.64, heightFactor: 1, child: Material(color: Colors.white, child: builder(context))),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.96, end: 1).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)), child: child),
    ),
  );
}

/// Info pasien satu baris utk subjudul header.
String infoPasien(List<String> parts) => parts.where((v) => v.trim().isNotEmpty).join('  |  ');

class ModalInputHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool canSave;
  final bool saving;
  final VoidCallback onSave;
  const ModalInputHeader({super.key, required this.title, this.subtitle = '', required this.canSave, required this.saving, required this.onSave});

  @override
  Widget build(BuildContext context) {
    final aktif = canSave && !saving;
    return Container(
      height: 60,
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kKitBorder))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(width: 8),
          IconButton(tooltip: 'Tutup', onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close, size: 26, color: kText)),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: kText)),
                if (subtitle.isNotEmpty) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: kTextMuted)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Material(
            color: aktif ? kPrimary : const Color(0xFFDADDDD),
            child: InkWell(
              onTap: aktif ? onSave : null,
              child: Container(
                width: 170,
                alignment: Alignment.center,
                child: Text(saving ? 'Menyimpan...' : 'Simpan',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: aktif ? Colors.white : const Color(0xFFA3A8A8))),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Label form gaya referensi: 13, KAPITAL, renggang, semibold (+ * merah).
class KitLabel extends StatelessWidget {
  final String text;
  final bool required;
  const KitLabel(this.text, {super.key, this.required = false});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text.rich(
          TextSpan(text: text.toUpperCase(), children: [if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFEF4444)))]),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.8, color: kText),
        ),
      );
}

InputDecoration kitDeco({String? hint, Widget? prefixIcon}) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
      isDense: true,
      constraints: const BoxConstraints(minHeight: 44),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      prefixIcon: prefixIcon,
      prefixIconConstraints: const BoxConstraints(minWidth: 34, minHeight: 34),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kKitField)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kKitField)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kKitGreen, width: 1.5)),
    );

/// Switch segmen gaya "Tunai | Nontunai" (sama dgn switch Penanganan di
/// modal Input Tindakan).
class KitSegment extends StatelessWidget {
  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;
  const KitSegment({super.key, required this.labels, required this.index, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        height: 44,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
        foregroundDecoration: BoxDecoration(border: Border.all(color: kKitGreen, width: 1.5), borderRadius: BorderRadius.circular(6)),
        clipBehavior: Clip.antiAlias,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < labels.length; i++)
              InkWell(
                onTap: () => onChanged(i),
                child: Container(
                  constraints: const BoxConstraints(minWidth: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  alignment: Alignment.center,
                  color: index == i ? kKitGreen : Colors.white,
                  child: Text(labels[i], style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: index == i ? Colors.white : kText)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Satu baris hasil cari / pilihan: centang + nama (kata dicari tebal) +
/// kode abu di bawahnya, opsional teks kanan.
class KitOptionRow extends StatelessWidget {
  final String title;
  final String code;
  final String query;
  final bool selected;
  final VoidCallback onTap;
  final Widget? trailing;
  const KitOptionRow({super.key, required this.title, required this.code, this.query = '', required this.selected, required this.onTap, this.trailing});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        color: selected ? kKitMint : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(children: [
          Icon(selected ? Icons.check_box : Icons.check_box_outline_blank, size: 24, color: selected ? kKitGreen : const Color(0xFF9CA3AF)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(sorotTeks(title, query),
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.3, color: kText)),
                if (code.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(code, style: const TextStyle(fontSize: 12, color: Color(0xFF8A9190))),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ]),
      ),
    );
  }
}

/// Kotak daftar hasil cari (maks. tinggi [maxHeight]), dgn status memuat /
/// kosong.
class KitResultBox extends StatelessWidget {
  final bool loading;
  final int count;
  final IndexedWidgetBuilder itemBuilder;
  final double maxHeight;
  final String emptyText;
  const KitResultBox({super.key, required this.loading, required this.count, required this.itemBuilder, this.maxHeight = 320, this.emptyText = 'Tidak ada hasil pencarian'});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: kKitField), borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: loading
          ? const Padding(padding: EdgeInsets.all(16), child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))))
          : count == 0
              ? Padding(padding: const EdgeInsets.all(16), child: Text(emptyText, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280))))
              : ListView.separated(
                  padding: EdgeInsets.zero,
                  shrinkWrap: true,
                  itemCount: count,
                  separatorBuilder: (_, __) => const Divider(height: 1, color: kKitBorder),
                  itemBuilder: itemBuilder,
                ),
    );
  }
}

/// Tabel item terpilih: header abu + baris (ketuk utk menghapus).
class KitSelectedTable extends StatelessWidget {
  final List<String> headers;
  final List<double?> widths; // null = Expanded
  final List<List<Widget>> rows;
  final List<VoidCallback> onRemove;
  final String emptyText;
  const KitSelectedTable({super.key, required this.headers, required this.widths, required this.rows, required this.onRemove, required this.emptyText});

  Widget _cell(double? w, Widget child) => w == null ? Expanded(child: child) : SizedBox(width: w, child: child);

  @override
  Widget build(BuildContext context) {
    const hs = TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: kText);
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kKitField), borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Container(
          color: const Color(0xFFF4F5F5),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(children: [
            for (var i = 0; i < headers.length; i++) _cell(widths[i], Text(headers[i], style: hs)),
            const SizedBox(width: 40),
          ]),
        ),
        if (rows.isEmpty)
          Padding(padding: const EdgeInsets.all(18), child: Text(emptyText, style: const TextStyle(fontSize: 16, color: Color(0xFF9CA3AF))))
        else
          for (var r = 0; r < rows.length; r++)
            Container(
              constraints: const BoxConstraints(minHeight: 52),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: kKitBorder))),
              padding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
              child: Row(children: [
                for (var i = 0; i < rows[r].length; i++) _cell(widths[i], rows[r][i]),
                SizedBox(
                  width: 40,
                  child: IconButton(
                    tooltip: 'Hapus',
                    onPressed: onRemove[r],
                    icon: const Icon(Icons.close, size: 20, color: kKitRed),
                  ),
                ),
              ]),
            ),
      ]),
    );
  }
}

const kitCellStyle = TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.3, color: kText);
const kitCodeStyle = TextStyle(fontSize: 16, color: Color(0xFF6B7271));

class KitErrorBox extends StatelessWidget {
  final String text;
  const KitErrorBox(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: const Color(0xFFFEE2E2), border: Border.all(color: const Color(0xFFFCA5A5)), borderRadius: BorderRadius.circular(6)),
        child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF991B1B))),
      );
}

/// Tombol aksi di atas tab (gaya tombol "Input Hasil Pemeriksaan USG").
class KitTabButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  const KitTabButton({super.key, required this.label, required this.onPressed});
  @override
  Widget build(BuildContext context) => ElevatedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.add, size: 16, color: Colors.white),
        label: Text(label, style: const TextStyle(fontSize: 13)),
        style: ElevatedButton.styleFrom(
          backgroundColor: kKitGreen,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
        ),
      );
}

/// Tebalkan bagian [text] yg cocok dgn [query] (tanpa beda huruf besar/kecil).
TextSpan sorotTeks(String text, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return TextSpan(text: text);
  final lower = text.toLowerCase();
  final spans = <TextSpan>[];
  var start = 0;
  while (true) {
    final idx = lower.indexOf(q, start);
    if (idx < 0) {
      spans.add(TextSpan(text: text.substring(start)));
      break;
    }
    if (idx > start) spans.add(TextSpan(text: text.substring(start, idx)));
    spans.add(TextSpan(text: text.substring(idx, idx + q.length), style: const TextStyle(fontWeight: FontWeight.w800)));
    start = idx + q.length;
  }
  return TextSpan(children: spans);
}
