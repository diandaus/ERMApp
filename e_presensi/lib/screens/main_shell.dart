import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/app_user.dart';
import '../widgets/icon_face_scan.dart';
import 'tabs/absen_tab.dart';
import 'tabs/home_tab.dart';
import 'tabs/jadwal_tab.dart';
import 'tabs/kehadiran_tab.dart';
import 'tabs/saya_tab.dart';

const _kGreenDark = Color(0xFF059669);
const _kGreenLight = Color(0xFF34D399);

enum _Tab { home, jadwal, absen, kehadiran, saya }

/// Padanan PresensiMobileView di PresensiMobile.tsx (versi web) — shell
/// 5 tab dgn tombol Absen "melayang" (raised FAB) di tengah bottom nav.
/// Isi tab Home/Jadwal/Absen/Kehadiran masih placeholder, menyusul satu-
/// satu di iterasi berikutnya (Absen duluan, krn itu fitur utamanya).
class MainShell extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLoggedOut;
  const MainShell({super.key, required this.user, required this.onLoggedOut});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  _Tab _tab = _Tab.home;

  Widget _body() {
    switch (_tab) {
      case _Tab.home:
        return HomeTab(user: widget.user);
      case _Tab.jadwal:
        return JadwalTab(nik: widget.user.nik);
      case _Tab.absen:
        return AbsenTab(
          nik: widget.user.nik,
          onSelesai: () => setState(() => _tab = _Tab.home),
          onBack: () => setState(() => _tab = _Tab.home),
        );
      case _Tab.kehadiran:
        return KehadiranTab(nik: widget.user.nik);
      case _Tab.saya:
        return SayaTab(user: widget.user, onLoggedOut: widget.onLoggedOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Tab Home: status bar transparan + ikon putih, background hijau
    // banner-nya tembus sampai ke atas layar. Tab lain: status bar tetap
    // solid dgn ikon gelap spt biasa (background putih/abu).
    final isHome = _tab == _Tab.home;
    final isAbsen = _tab == _Tab.absen;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: isHome
          ? const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.light,
              statusBarBrightness: Brightness.dark,
            )
          : const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
              statusBarBrightness: Brightness.light,
            ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF3F4F6),
        body: SafeArea(top: !isHome, bottom: isAbsen, child: _body()),
        // Tab Absen: sembunyikan bottom nav sepenuhnya — cuma tombol
        // Absen Masuk/Pulang di dalam AbsenTab sendiri yg tampil, spy
        // fokus & tak ada gangguan navigasi lain saat proses absen.
        bottomNavigationBar: isAbsen ? null : _BottomNav(active: _tab, onTap: (t) => setState(() => _tab = t)),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final _Tab active;
  final void Function(_Tab) onTap;
  const _BottomNav({required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return SizedBox(
      height: 64 + bottomInset,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Container(
            decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade200))),
            padding: EdgeInsets.only(bottom: bottomInset, top: 6),
            child: Row(
              children: [
                _NavItem(icon: Icons.home_outlined, label: 'Home', active: active == _Tab.home, onTap: () => onTap(_Tab.home)),
                _NavItem(icon: Icons.calendar_month_outlined, label: 'Jadwal', active: active == _Tab.jadwal, onTap: () => onTap(_Tab.jadwal)),
                const Expanded(child: SizedBox()), // ruang kosong utk FAB Absen
                _NavItem(icon: Icons.checklist_outlined, label: 'Kehadiran', active: active == _Tab.kehadiran, onTap: () => onTap(_Tab.kehadiran)),
                _NavItem(icon: Icons.person_outline, label: 'Saya', active: active == _Tab.saya, onTap: () => onTap(_Tab.saya)),
              ],
            ),
          ),
          // Tombol Absen — melayang di tengah, lebih besar & terangkat dari
          // bar (padanan persis pola "raised FAB" di versi web).
          Positioned(
            top: -22,
            child: GestureDetector(
              onTap: () => onTap(_Tab.absen),
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFF3F4F6), width: 4),
                  gradient: const LinearGradient(colors: [_kGreenLight, _kGreenDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                ),
                child: const Center(child: IconFaceScan(size: 32, color: Colors.white)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _NavItem({required this.icon, required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? _kGreenDark : Colors.grey.shade500;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: active ? FontWeight.w600 : FontWeight.w400)),
          ],
        ),
      ),
    );
  }
}
