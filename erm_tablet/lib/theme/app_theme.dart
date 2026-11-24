import 'package:flutter/material.dart';

/// Tema ERM Tablet — mengikuti referensi gaya aplikasi kasir (header hijau
/// tosca penuh, latar konten abu muda, kartu & tabel putih bergaris tipis,
/// menu terpilih mint + garis tosca). Font: Inter (dibundel di
/// assets/fonts, TIDAK diunduh saat runtime — tablet RS bisa tanpa internet).
const kPrimary = Color(0xFF04C99E); // header / aksen utama
const kPrimaryDark = Color(0xFF04B58E); // tombol di atas header, teks aksen
const kPrimarySoft = Color(0xFFEBFAED); // latar item terpilih
const kBg = Color(0xFFF4F5F5); // latar area konten
const kLine = Color(0xFFE6E8E8); // garis/border tipis
const kText = Color(0xFF2B2F2E); // teks utama
const kTextMuted = Color(0xFF8A9190); // teks sekunder/placeholder

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: kPrimary, primary: kPrimaryDark, surface: Colors.white);
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    dividerColor: kLine,
    dividerTheme: const DividerThemeData(color: kLine, thickness: 1, space: 1),
    textTheme: ThemeData.light().textTheme.apply(fontFamily: 'Inter', bodyColor: kText, displayColor: kText),
    appBarTheme: const AppBarTheme(backgroundColor: kPrimary, foregroundColor: Colors.white, elevation: 0),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimary, foregroundColor: Colors.white, elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kText, side: const BorderSide(color: kLine), backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        side: const WidgetStatePropertyAll(BorderSide(color: kLine)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? kPrimarySoft : Colors.white),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? kPrimaryDark : kText),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kLine)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
    ),
    // Material 3 memberi rona warna (surface tint) ke dialog/sheet/menu
    // sehingga tampak hijau keabuan — dipaksa PUTIH bersih.
    dialogTheme: const DialogThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent, modalBackgroundColor: Colors.white),
    popupMenuTheme: const PopupMenuThemeData(color: Colors.white, surfaceTintColor: Colors.transparent),
    datePickerTheme: const DatePickerThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent),
    timePickerTheme: const TimePickerThemeData(backgroundColor: Colors.white),
    dropdownMenuTheme: const DropdownMenuThemeData(menuStyle: MenuStyle(backgroundColor: WidgetStatePropertyAll(Colors.white), surfaceTintColor: WidgetStatePropertyAll(Colors.transparent))),
    cardTheme: CardThemeData(color: Colors.white, surfaceTintColor: Colors.transparent, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: kPrimary),
  );
}
