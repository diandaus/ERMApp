import 'package:flutter/material.dart';
import '../../models/app_user.dart';
import '../../services/api_config.dart';
import '../../services/auth_service.dart';
import '../../services/presensi_service.dart';
import '../../widgets/pengumuman_card.dart';
import '../ganti_password_view.dart';
import '../profil_detail_view.dart';

const _kGreenDark = Color(0xFF059669);

/// Padanan SayaTab di PresensiMobile.tsx — identitas (+ foto profil) +
/// menu (Profil, Pengaturan Akun) + tombol Keluar.
class SayaTab extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLoggedOut;
  const SayaTab({super.key, required this.user, required this.onLoggedOut});

  @override
  State<SayaTab> createState() => _SayaTabState();
}

class _SayaTabState extends State<SayaTab> {
  String? _photo;

  @override
  void initState() {
    super.initState();
    _loadPhoto();
  }

  Future<void> _loadPhoto() async {
    try {
      final profil = await PresensiService.getProfil(widget.user.nik);
      if (!mounted) return;
      setState(() => _photo = profil.photo);
    } catch (_) {
      // Opsional — kalau gagal, avatar cuma fallback ke inisial.
    }
  }

  String get _initials {
    final parts = widget.user.fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final hasPhoto = _photo != null && _photo!.isNotEmpty;
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
              CircleAvatar(
                radius: 26,
                backgroundColor: _kGreenDark,
                backgroundImage: hasPhoto ? NetworkImage('$kApiBaseUrl$_photo') : null,
                child: hasPhoto ? null : Text(_initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.user.fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(widget.user.role, style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => ProfilDetailView(nik: widget.user.nik, onFotoUpdated: _loadPhoto))),
              ),
              _MenuRow(
                icon: Icons.settings_outlined,
                label: 'Pengaturan Akun',
                isLast: true,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => GantiPasswordView(userId: widget.user.id))),
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
              widget.onLoggedOut();
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
            SizedBox(
              width: 32,
              height: 32,
              child: Icon(icon, size: 20, color: _kGreenDark),
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
