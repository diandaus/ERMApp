import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../widgets/dalam_pengembangan.dart';
import 'landscape_shell.dart';
import 'ranap_list_screen.dart';

const kPrimary = Color(0xFF2563EB);

/// MainShell — shell utama app ini setelah login. UI-nya SENGAJA beda
/// antara portrait & landscape (per arahan user):
/// - Portrait: navbar bawah 5 tab (Home/IGD/Ranap/Poli/Saya), spt semula.
/// - Landscape: [LandscapeShell] — sidebar kiri 8 menu + avatar
///   akun/logout melayang pojok kanan-atas, TANPA navbar bawah.
/// Cuma tab/menu Ranap (Rawat Inap) yg sudah jadi fitur nyata di keduanya;
/// sisanya placeholder "Dalam Pengembangan", TAPI tab Saya (portrait)
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
  int _index = 2; // default buka tab Ranap — satu-satunya fitur nyata

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).orientation == Orientation.landscape) {
      return LandscapeShell(user: widget.user, onLogout: widget.onLogout);
    }

    final tabs = [
      const DalamPengembangan(title: 'Home', icon: Icons.home_outlined),
      const DalamPengembangan(title: 'IGD', icon: Icons.emergency_outlined),
      RanapListScreen(user: widget.user, onLogout: widget.onLogout),
      const DalamPengembangan(title: 'Poli', icon: Icons.local_hospital_outlined),
      DalamPengembangan(
        title: 'Saya',
        icon: Icons.person_outline,
        extraActions: [
          Text(widget.user.fullName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          Text(widget.user.role, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => confirmLogout(context, widget.onLogout),
            icon: const Icon(Icons.logout, size: 16, color: Color(0xFFDC2626)),
            label: const Text('Keluar', style: TextStyle(color: Color(0xFFDC2626))),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFECACA))),
          ),
        ],
      ),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: kPrimary), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.emergency_outlined), selectedIcon: Icon(Icons.emergency, color: kPrimary), label: 'IGD'),
          NavigationDestination(icon: Icon(Icons.bed_outlined), selectedIcon: Icon(Icons.bed, color: kPrimary), label: 'Ranap'),
          NavigationDestination(icon: Icon(Icons.local_hospital_outlined), selectedIcon: Icon(Icons.local_hospital, color: kPrimary), label: 'Poli'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: kPrimary), label: 'Saya'),
        ],
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
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Batal')),
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            onLogout();
          },
          child: const Text('Keluar', style: TextStyle(color: Color(0xFFDC2626))),
        ),
      ],
    ),
  );
}
