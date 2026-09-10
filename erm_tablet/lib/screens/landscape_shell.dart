import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../widgets/dalam_pengembangan.dart';
import 'main_shell.dart' show confirmLogout;
import 'ranap_table_screen.dart';

const kSidebarGreen = Color(0xFF059669);
const kSidebarBorder = Color(0xFFE5E7EB);

class _MenuEntry {
  final String label;
  final IconData icon;
  const _MenuEntry(this.label, this.icon);
}

/// 8 menu sidebar persis daftar yg diminta user. Cuma index 3 (Rawat
/// Inap) yg fitur nyata — sisanya "Dalam Pengembangan", sama pola dgn
/// portrait (MainShell) yg jg cuma Ranap yg jadi.
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

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DalamPengembanganInline(title: 'Dashboard'),
      const DalamPengembanganInline(title: 'IGD'),
      const DalamPengembanganInline(title: 'Poliklinik'),
      RanapTableScreen(user: widget.user, onLogout: widget.onLogout, searchQuery: _searchQuery),
      const DalamPengembanganInline(title: 'Farmasi'),
      const DalamPengembanganInline(title: 'Laboratorium'),
      const DalamPengembanganInline(title: 'Radiologi'),
      const DalamPengembanganInline(title: 'Jadwal Operasi'),
    ];

    return Scaffold(
      body: Row(
        children: [
          _Sidebar(selected: _index, onSelect: (i) => setState(() => _index = i)),
          Expanded(
            child: Column(
              children: [
                _TopBar(
                  user: widget.user,
                  onLogout: widget.onLogout,
                  onSearchChanged: (v) => setState(() => _searchQuery = v),
                  hintText: _index == 3 ? 'Cari no. RM / nama / dokter...' : 'Cari...',
                ),
                Expanded(child: IndexedStack(index: _index, children: pages)),
              ],
            ),
          ),
        ],
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
    return Container(
      width: 230,
      decoration: const BoxDecoration(color: Colors.white, border: Border(right: BorderSide(color: kSidebarBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            color: Colors.white,
            child: const Text('ERM Tablet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              itemCount: _kLandscapeMenu.length,
              itemBuilder: (context, i) {
                final entry = _kLandscapeMenu[i];
                final isSelected = i == selected;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: () => onSelect(i),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? kSidebarGreen : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(entry.icon, size: 20, color: isSelected ? Colors.white : const Color(0xFF6B7280)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                entry.label,
                                style: TextStyle(fontSize: 13, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500, color: isSelected ? Colors.white : const Color(0xFF374151)),
                              ),
                            ),
                          ],
                        ),
                      ),
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
  final AppUser user;
  final VoidCallback onLogout;
  final ValueChanged<String> onSearchChanged;
  final String hintText;
  const _TopBar({required this.user, required this.onLogout, required this.onSearchChanged, required this.hintText});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: kSidebarBorder))),
      child: Row(
        children: [
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 220),
                child: TextField(
                  onChanged: onSearchChanged,
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFFF3F4F6),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    suffixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF6B7280)),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          InkWell(
            onTap: () => _openAccountSheet(context),
            borderRadius: BorderRadius.circular(999),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(user.fullName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                      Text(user.role, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(color: Color(0xFFECFDF5), shape: BoxShape.circle),
                    child: const Icon(Icons.person, size: 20, color: kSidebarGreen),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openAccountSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(color: Color(0xFFECFDF5), shape: BoxShape.circle),
                  child: const Icon(Icons.person, size: 24, color: kSidebarGreen),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                      Text(user.role, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  confirmLogout(context, onLogout);
                },
                icon: const Icon(Icons.logout, size: 16, color: Color(0xFFDC2626)),
                label: const Text('Keluar', style: TextStyle(color: Color(0xFFDC2626))),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA)), padding: const EdgeInsets.symmetric(vertical: 12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
