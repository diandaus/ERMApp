import 'dart:async';
import 'package:flutter/material.dart';
import '../services/instansi_service.dart';
import '../models/app_user.dart';
import '../widgets/dalam_pengembangan.dart';
import 'main_shell.dart' show confirmLogout;
import 'poli_screen.dart';
import 'ranap_table_screen.dart';
import '../theme/app_theme.dart';

const kSidebarGreen = kPrimary;
const kSidebarBorder = kLine;
const double _kSidebarWidth = 210;

class _MenuEntry {
  final String label;
  final IconData icon;
  const _MenuEntry(this.label, this.icon);
}

/// 8 menu sidebar persis daftar yg diminta user. Baru index 2
/// (Poliklinik) & 3 (Rawat Inap) yg fitur nyata — sisanya "Dalam
/// Pengembangan", sama pola dgn portrait (MainShell).
const List<_MenuEntry> _kLandscapeMenu = [
  _MenuEntry('Dashboard', Icons.dashboard_outlined),
  _MenuEntry('IGD', Icons.emergency_outlined),
  _MenuEntry('Poliklinik', Icons.local_hospital_outlined),
  _MenuEntry('Rawat Inap', Icons.bed_outlined),
  _MenuEntry('Farmasi', Icons.medication_outlined),
  _MenuEntry('Laboratorium', Icons.science_outlined),
  _MenuEntry('Radiologi', Icons.image_search_outlined),
  _MenuEntry('Jadwal Operasi', Icons.event_note_outlined),
];

/// LandscapeShell — UI khusus orientasi landscape (beda dr portrait/
/// MainShell yg pakai navbar bawah), per arahan user: sidebar kiri berisi
/// 8 menu modul (padanan MenuUtama.tsx web, disederhanakan) + avatar akun
/// melayang pojok kanan-atas (satu-satunya jalan logout di landscape,
/// krn menu "Saya" sengaja tidak ada di daftar sidebar). TANPA navbar
/// bawah spt diminta.
class LandscapeShell extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLogout;
  const LandscapeShell({super.key, required this.user, required this.onLogout});

  @override
  State<LandscapeShell> createState() => _LandscapeShellState();
}

class _LandscapeShellState extends State<LandscapeShell> {
  int _index = 3; // default buka Rawat Inap — satu-satunya fitur nyata
  // Kolom cari navbar atas — cakupannya ikut tab aktif (skrg cuma Rawat
  // Inap yg punya data nyata utk dicari: No.RM/Nama/Dokter/dst), per
  // arahan user. Query TETAP tersimpan saat pindah tab (tidak direset),
  // cuma diterapkan ke halaman yg tau cara memakainya.
  String _searchQuery = '';
  // Tombol ☰ di navbar: buka/tutup sidebar (konten jadi selebar layar).
  bool _sidebarOpen = true;
  // Identitas RS + status koneksi ke backend (dicek ulang tiap 30 detik).
  InstansiInfo? _instansi;
  bool _online = false;
  Timer? _pingTimer;

  @override
  void initState() {
    super.initState();
    _cekInstansi();
    _pingTimer =
        Timer.periodic(const Duration(seconds: 30), (_) => _cekInstansi());
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    super.dispose();
  }

  Future<void> _cekInstansi() async {
    try {
      final info = await InstansiService.get();
      if (!mounted) return;
      setState(() {
        _instansi = info;
        _online = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _online = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DalamPengembanganInline(title: 'Dashboard'),
      const DalamPengembanganInline(title: 'IGD'),
      PoliScreen(
          user: widget.user,
          landscape: true,
          searchQuery: _searchQuery,
          active: _index == 2),
      RanapTableScreen(
          user: widget.user,
          onLogout: widget.onLogout,
          searchQuery: _searchQuery),
      const DalamPengembanganInline(title: 'Farmasi'),
      const DalamPengembanganInline(title: 'Laboratorium'),
      const DalamPengembanganInline(title: 'Radiologi'),
      const DalamPengembanganInline(title: 'Jadwal Operasi'),
    ];

    // Header tosca SELEBAR layar di atas sidebar + konten (gaya referensi
    // aplikasi kasir), status bar ikut tosca gelap.
    return Scaffold(
      backgroundColor: kPrimaryDark,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _TopBar(
              instansi: _instansi,
              online: _online,
              onMenu: () => setState(() => _sidebarOpen = !_sidebarOpen),
              user: widget.user,
              onLogout: widget.onLogout,
              onSearchChanged: (v) => setState(() => _searchQuery = v),
              hintText: _index == 2 || _index == 3
                  ? 'Cari no. RM / nama / dokter...'
                  : 'Cari...',
            ),
            Expanded(
              child: Container(
                color: kBg,
                // Stack (bukan Row) supaya sidebar digambar PALING ATAS —
                // bayangannya jatuh di atas konten, tidak tertutup latar halaman.
                child: Stack(
                  children: [
                    AnimatedPadding(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.only(
                          left: _sidebarOpen ? _kSidebarWidth : 0),
                      child: IndexedStack(index: _index, children: pages),
                    ),
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 200),
                      left: _sidebarOpen ? 0 : -_kSidebarWidth,
                      top: 0,
                      bottom: 0,
                      width: _kSidebarWidth,
                      child: _Sidebar(
                          selected: _index,
                          onSelect: (i) => setState(() => _index = i)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onSelect;
  const _Sidebar({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    // Daftar menu datar ala "Kategori Produk": baris setinggi 48 dgn garis
    // pemisah tipis; terpilih = latar mint + garis tosca.
    // Tanpa border & tanpa bayangan (sama dgn tabel & toolbar).
    return Container(
      decoration: const BoxDecoration(color: Colors.white),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 48,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.centerLeft,
            decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: kLine))),
            child: const Text('Menu',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w500, color: kText)),
          ),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.zero,
              itemCount: _kLandscapeMenu.length,
              itemBuilder: (context, i) {
                final entry = _kLandscapeMenu[i];
                final isSelected = i == selected;
                return InkWell(
                  onTap: () => onSelect(i),
                  child: Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? kPrimarySoft : Colors.white,
                      border: isSelected
                          ? Border.all(color: kPrimary, width: 1.5)
                          : const Border(bottom: BorderSide(color: kLine)),
                    ),
                    child: Row(
                      children: [
                        Icon(entry.icon,
                            size: 19,
                            color: isSelected ? kPrimaryDark : kTextMuted),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            entry.label,
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: isSelected
                                    ? FontWeight.w600
                                    : FontWeight.w500,
                                color: kText),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// _TopBar — navbar atas area konten (di kanan sidebar), padanan contoh
/// referensi user: kolom cari rata kiri (bulat, abu muda) + akun (nama+
/// role+avatar) rata kanan, dipisah divider tipis. Kolom cari sekarang
/// FUNGSIONAL — [onSearchChanged] diteruskan LandscapeShell ke halaman
/// tab yg sedang aktif (skrg baru RanapTableScreen yg pakai).
class _TopBar extends StatelessWidget {
  final InstansiInfo? instansi;
  final bool online;
  final VoidCallback onMenu;
  final AppUser user;
  final VoidCallback onLogout;
  final ValueChanged<String> onSearchChanged;
  final String hintText;
  const _TopBar(
      {required this.instansi,
      required this.online,
      required this.onMenu,
      required this.user,
      required this.onLogout,
      required this.onSearchChanged,
      required this.hintText});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: kPrimary,
      child: Row(
        children: [
          // ☰ + logo bulat + nama RS & status koneksi (gaya referensi).
          IconButton(
            onPressed: onMenu,
            tooltip: 'Buka/tutup menu',
            icon: const Icon(Icons.menu, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 6),
          Container(
            width: 40,
            height: 40,
            padding: const EdgeInsets.all(3),
            decoration: const BoxDecoration(
                color: Colors.white, shape: BoxShape.circle),
            child: ClipOval(
              child: (instansi?.logoUrl ?? '').isEmpty
                  ? const Icon(Icons.local_hospital,
                      color: kPrimaryDark, size: 22)
                  : Image.network(
                      instansi!.logoUrl,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(
                          Icons.local_hospital,
                          color: kPrimaryDark,
                          size: 22),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (instansi?.nama ?? '').isEmpty
                      ? 'ERM Tablet'
                      : instansi!.nama,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white),
                ),
                const SizedBox(height: 3),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                            color: online
                                ? const Color(0xFF22C55E)
                                : const Color(0xFFEF4444),
                            shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 5),
                      Text(online ? 'Status: Online' : 'Status: Offline',
                          style: const TextStyle(fontSize: 11, color: kText)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: TextField(
              onChanged: onSearchChanged,
              style: const TextStyle(fontSize: 13, color: Colors.white),
              cursorColor: Colors.white,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle:
                    const TextStyle(fontSize: 13, color: Color(0xCCFFFFFF)),
                isDense: true,
                filled: true,
                fillColor: kPrimaryDark,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                prefixIcon:
                    const Icon(Icons.search, size: 18, color: Colors.white),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: Colors.white70)),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Klik akun -> menu turun tepat di bawah navbar: Pengaturan & Keluar.
          PopupMenuButton<String>(
            tooltip: 'Akun',
            position: PopupMenuPosition.under,
            offset: const Offset(0, 8),
            color: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
                side: const BorderSide(color: kLine)),
            constraints: const BoxConstraints(minWidth: 220),
            onSelected: (v) {
              if (v == 'keluar') confirmLogout(context, onLogout);
              if (v == 'pengaturan') {
                // Halaman Pengaturan dikembangkan nanti.
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(const SnackBar(
                      content: Text('Pengaturan — dalam pengembangan')));
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem<String>(
                enabled: false,
                height: 56,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(user.fullName,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: kText)),
                    Text(user.role,
                        style:
                            const TextStyle(fontSize: 13, color: kTextMuted)),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 1),
              const PopupMenuItem<String>(
                value: 'pengaturan',
                height: 52,
                child: Row(children: [
                  Icon(Icons.settings_outlined, size: 22, color: kText),
                  SizedBox(width: 12),
                  Text('Pengaturan',
                      style: TextStyle(fontSize: 15, color: kText)),
                ]),
              ),
              const PopupMenuItem<String>(
                value: 'keluar',
                height: 52,
                child: Row(children: [
                  Icon(Icons.logout, size: 22, color: Color(0xFFDC2626)),
                  SizedBox(width: 12),
                  Text('Keluar',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFDC2626))),
                ]),
              ),
            ],
            child: Material(
              color: kPrimaryDark,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(user.fullName,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white)),
                        Text(user.role,
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xCCFFFFFF))),
                      ],
                    ),
                    const SizedBox(width: 10),
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                          color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.person,
                          size: 18, color: kPrimaryDark),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down,
                        size: 22, color: Colors.white),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
