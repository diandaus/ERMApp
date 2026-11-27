#!/bin/bash
# Build APK production ERM Tablet utk dirilis lewat web
# (Pengaturan > Aplikasi Tablet). Sebelum menjalankan, NAIKKAN version di
# pubspec.yaml, mis. 0.2.0+2 -> 0.2.1+3 (angka setelah "+" = build number,
# wajib lebih besar dari rilis sebelumnya).
#
# PENTING: APK ditandatangani debug key Mac ini (~/.android/debug.keystore).
# Pembaruan hanya bisa dipasang di atas versi yg ditandatangani kunci SAMA,
# jadi build rilis selalu dari Mac ini (atau salin keystore tsb).
set -e
cd "$(dirname "$0")"
VER=$(grep '^version:' pubspec.yaml | awk '{print $2}')
flutter build apk --release --dart-define=API_BASE_URL=https://presensi.rsislamibnusinasigli.com
OUT="$HOME/Desktop/erm_tablet_${VER}.apk"
cp build/app/outputs/flutter-apk/app-release.apk "$OUT"
echo ""
echo "APK siap: $OUT"
echo "Unggah di web: Pengaturan > Aplikasi Tablet (versi & build terisi otomatis dari nama file)."
