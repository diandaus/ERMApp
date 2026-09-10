import 'package:flutter/material.dart';

/// Placeholder "Dalam Pengembangan" — dipakai tab Home/IGD/Poli/Saya di
/// MainShell yg belum dibangun (cuma Ranap yg sudah jadi fitur nyata).
class DalamPengembangan extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> extraActions;
  const DalamPengembangan({super.key, required this.title, required this.icon, this.extraActions = const []});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: const Color(0xFFD1D5DB)),
            const SizedBox(height: 16),
            const Text('Dalam Pengembangan', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
            const SizedBox(height: 4),
            Text('Fitur "$title" akan segera hadir.', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
            if (extraActions.isNotEmpty) ...[
              const SizedBox(height: 24),
              ...extraActions,
            ],
          ],
        ),
      ),
    );
  }
}

/// Versi inline (tanpa Scaffold/AppBar) — dipakai di dalam TabBarView spt
/// tab RESEP/LAB/RAD/TINDAKAN/DIAGNOSA di PasienDetailScreen yg blm dibangun.
class DalamPengembanganInline extends StatelessWidget {
  final String title;
  const DalamPengembanganInline({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.construction_outlined, size: 48, color: Color(0xFFD1D5DB)),
          const SizedBox(height: 12),
          const Text('Dalam Pengembangan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
          const SizedBox(height: 4),
          Text('Fitur "$title" akan segera hadir.', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
        ],
      ),
    );
  }
}
