import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:e_presensi/main.dart';

void main() {
  testWidgets('App boots and shows login screen', (WidgetTester tester) async {
    // Mock SharedPreferences (kosong = belum ada sesi tersimpan) — tanpa
    // ini, panggilan asli ke platform channel tidak pernah resolve di
    // lingkungan widget test, bikin pump()/pumpAndSettle() nunggu selamanya.
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const EPresensiApp());
    // pump() beberapa kali dgn durasi tetap (bukan pumpAndSettle) — krn
    // layar loading pakai CircularProgressIndicator yg animasinya tidak
    // pernah berhenti sendiri, pumpAndSettle() akan timeout nunggunya.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('E-Presensi'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Masuk'), findsOneWidget);
  });
}
