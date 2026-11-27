import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../widgets/dalam_pengembangan.dart';
import 'dashboard_screen.dart';
import '../services/akses_service.dart';
import 'landscape_shell.dart';
import 'pengaturan_screen.dart';
import 'poli_screen.dart';
import 'ranap_list_screen.dart';

const kPrimary = Color(0xFF04B58E);

/// MainShell — shell utama app ini setelah login. UI-nya SENGAJA beda
/// antara portrait & landscape (per arahan user):
/// - Portrait: navbar bawah 5 tab (Home/IGD/Ranap/Poli/Saya), spt semula.
/// - Landscape: [LandscapeShell] — sidebar kiri 8 menu + avatar
///   akun/logout melayang pojok kanan-atas, TANPA navbar bawah.
/// Baru tab/menu Ranap (Rawat Inap) & Poli (Poliklinik) yg sudah jadi fitur
/// nyata di keduanya; sisanya placeholder "Dalam Pengembangan", TAPI tab Saya (portrait)
/// tetap punya tombol Keluar krn itu satu-satunya jalan logout di app ini
/// (landscape: logout dipindah ke avatar, lihat LandscapeShell).
class MainShell extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLogout;
  const MainShell({super.key, required this.user, required this.onLogout});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  // Posisi ASLI tab portrait: 0 Home, 1 IGD, 2 Ranap, 3 Poli, 4 Saya.
  // Kunci hak akses tiap tab (Saya selalu ada — tempat Pengaturan/Keluar).
  static const _aksesTab = ['menu.dashboard', 'menu.igd', 'menu.ranap', 'menu.poli', ''];
  List<int> get _tabAktif => [
        for (var i = 0; i < _aksesTab.length; i++)
          if (_aksesTab[i].isEmpty || AksesService.aktif(_aksesTab[i])) i,
      ];
  // Halaman awal = Home (Dashboard); dinonaktifkan -> tab aktif pertama.
  late int _index = _tabAktif.first;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).orientation == Orientation.landscape) {
      return LandscapeShell(user: widget.user, onLogout: widget.onLogout);
    }

    final tabs = [
      // Home (portrait) = Dashboard, dibungkus Scaffold+SafeArea krn tab
      // portrait tidak punya navbar atas.
      Scaffold(
        appBar: AppBar(
          title: const Text('Dashboard', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
        ),
        body: DashboardScreen(user: widget.user),
      ),
      const DalamPengembangan(title: 'IGD', icon: Icons.emergency_outlined),
      RanapListScreen(user: widget.user, onLogout: widget.onLogout),
      PoliScreen(user: widget.user, active: _index == 3),
      // Tab "Saya" = halaman Pengaturan langsung (profil, kata sandi,
      // server, pembaruan aplikasi, keluar) — tanpa tombol kembali.
      PengaturanScreen(user: widget.user, onLogout: widget.onLogout, embedded: true),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: tabs),
      // NavigationBar cuma menampilkan tab yg aktif; _index tetap posisi
      // ASLI di `tabs` (dipetakan lewat _tabAktif).
      // Navbar bawah putih (garis tipis di atas). Hanya tab AKTIF yg hijau
      // (ikon terisi + teks tebal + pil mint); lainnya abu.
      // NavigationBar butuh >= 2 tab; semua menu nonaktif -> cuma "Saya".
      bottomNavigationBar: _tabAktif.length < 2 ? null : Container(
        decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Color(0xFFE6E8E8)))),
        child: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            indicatorColor: const Color(0xFFEBFAED),
            iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
                color: s.contains(WidgetState.selected)
                    ? kPrimary
                    : const Color(0xFF6B7271),
                size: 24)),
            labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
                  fontSize: 13,
                  fontWeight: s.contains(WidgetState.selected)
                      ? FontWeight.w700
                      : FontWeight.w500,
                  color: s.contains(WidgetState.selected)
                      ? kPrimary
                      : const Color(0xFF6B7271),
                )),
          ),
          child: NavigationBar(
            selectedIndex: _tabAktif.indexOf(_index),
            onDestinationSelected: (n) => setState(() => _index = _tabAktif[n]),
            destinations: [for (final i in _tabAktif) _kDest[i]],
          ),
        ),
      ),
    );
  }
}

/// confirmLogout — dialog konfirmasi keluar, dipakai bareng oleh tab Saya
/// (portrait) & avatar akun (landscape, lihat LandscapeShell) supaya
/// perilakunya konsisten satu tempat.
void confirmLogout(BuildContext context, VoidCallback onLogout) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Keluar?'),
      content: const Text('Anda akan keluar dari aplikasi.'),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Batal')),
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            onLogout();
          },
          child:
              const Text('Keluar', style: TextStyle(color: Color(0xFFDC2626))),
        ),
      ],
    ),
  );
}

const _kDest = [
              NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home, color: kPrimary),
                  label: 'Home'),
              NavigationDestination(
                  icon: Icon(Icons.emergency_outlined),
                  selectedIcon: Icon(Icons.emergency, color: kPrimary),
                  label: 'IGD'),
              NavigationDestination(
                  icon: Icon(Icons.bed_outlined),
                  selectedIcon: Icon(Icons.bed, color: kPrimary),
                  label: 'Ranap'),
              NavigationDestination(
                  icon: Icon(Icons.local_hospital_outlined),
                  selectedIcon: Icon(Icons.local_hospital, color: kPrimary),
                  label: 'Poli'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person, color: kPrimary),
                  label: 'Saya'),
];
