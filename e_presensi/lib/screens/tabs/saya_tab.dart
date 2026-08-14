import 'package:flutter/material.dart';
import '../../models/app_user.dart';
import '../../services/auth_service.dart';
import '../../widgets/pengumuman_card.dart';
import '../ganti_password_view.dart';
import '../profil_detail_view.dart';

const _kGreenDark = Color(0xFF059669);

/// Padanan SayaTab di PresensiMobile.tsx — identitas + menu (Profil,
/// Pengaturan Akun) + tombol Keluar.
class SayaTab extends StatelessWidget {
  final AppUser user;
  final VoidCallback onLoggedOut;
  const SayaTab({super.key, required this.user, required this.onLoggedOut});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 4)),
          ]),
          child: Row(
            children: [
              const CircleAvatar(radius: 26, backgroundColor: _kGreenDark, child: Icon(Icons.person, color: Colors.white)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(user.role, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFE5E7EB)), borderRadius: BorderRadius.circular(16)),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Column(
            children: [
              _MenuRow(
                icon: Icons.person_outline,
                label: 'Profil',
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProfilDetailView(nik: user.nik, onFotoUpdated: () {}))),
              ),
              _MenuRow(
                icon: Icons.settings_outlined,
                label: 'Pengaturan Akun',
                isLast: true,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => GantiPasswordView(userId: user.id))),
              ),
            ],
          ),
        ),
        const PengumumanCard(margin: EdgeInsets.only(top: 16)),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 4)),
          ]),
          child: ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Keluar', style: TextStyle(color: Colors.red)),
            onTap: () async {
              await AuthService.logout();
              onLoggedOut();
            },
          ),
        ),
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isLast;
  const _MenuRow({required this.icon, required this.label, required this.onTap, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
        decoration: BoxDecoration(border: isLast ? null : const Border(bottom: BorderSide(color: Color(0xFFF3F4F6)))),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 16, color: _kGreenDark),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF111827)))),
            const Icon(Icons.chevron_right, size: 16, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}
