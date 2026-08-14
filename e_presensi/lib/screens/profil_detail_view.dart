import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/presensi_profil.dart';
import '../services/api_config.dart';
import '../services/presensi_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kGreenLight = Color(0xFF34D399);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan ProfilDetailView di PresensiMobile.tsx — data diri read-only
/// (NIP/Nama/No.HP/Email/Departemen), satu-satunya field yg bisa diubah
/// dari sini adalah foto profil (via FAB kamera di avatar).
class ProfilDetailView extends StatefulWidget {
  final String nik;
  final VoidCallback onFotoUpdated;
  const ProfilDetailView({super.key, required this.nik, required this.onFotoUpdated});

  @override
  State<ProfilDetailView> createState() => _ProfilDetailViewState();
}

class _ProfilDetailViewState extends State<ProfilDetailView> {
  bool _loading = true;
  PresensiProfil? _profil;
  bool _uploadingFoto = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final profil = await PresensiService.getProfil(widget.nik);
      if (!mounted) return;
      setState(() {
        _profil = profil;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _showFotoSourceSheet() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Ambil Foto'),
              onTap: () {
                Navigator.pop(context);
                _pickFoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Pilih dari Galeri'),
              onTap: () {
                Navigator.pop(context);
                _pickFoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickFoto(ImageSource source) async {
    final picker = ImagePicker();
    final XFile? file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploadingFoto = true);
    try {
      final bytes = await file.readAsBytes();
      final url = await PresensiService.uploadFotoProfil(bytes);
      await PresensiService.updateFotoProfil(widget.nik, url);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto profil berhasil diperbarui.'), backgroundColor: _kGreenDark),
      );
      widget.onFotoUpdated();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal mengunggah foto: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _uploadingFoto = false);
    }
  }

  String get _initials {
    final parts = (_profil?.nama ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Profil', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _profil == null
              ? const Center(child: Text('Gagal memuat profil', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Center(
                      child: Column(
                        children: [
                          Stack(
                            children: [
                              CircleAvatar(
                                radius: 40,
                                backgroundColor: const Color(0xFFD1FAE5),
                                backgroundImage: _profil!.photo.isNotEmpty ? NetworkImage('$kApiBaseUrl${_profil!.photo}') : null,
                                child: _profil!.photo.isEmpty
                                    ? Text(_initials, style: const TextStyle(color: _kGreenDark, fontWeight: FontWeight.w700, fontSize: 24))
                                    : null,
                              ),
                              Positioned(
                                bottom: -2,
                                right: -2,
                                child: GestureDetector(
                                  onTap: _uploadingFoto ? null : _showFotoSourceSheet,
                                  child: Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(color: const Color(0xFFF3F4F6), width: 3),
                                      gradient: const LinearGradient(colors: [_kGreenLight, _kGreenDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                                    ),
                                    child: _uploadingFoto
                                        ? const Padding(padding: EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Icon(Icons.camera_alt, size: 13, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _uploadingFoto ? 'Mengunggah...' : 'Ketuk ikon kamera utk ganti foto',
                            style: TextStyle(fontSize: 11, color: _uploadingFoto ? _kGreenDark : const Color(0xFF9CA3AF)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      child: Column(
                        children: [
                          _ProfilRow(icon: Icons.badge_outlined, label: 'NIP', value: _profil!.nik),
                          _ProfilRow(icon: Icons.person_outline, label: 'Nama', value: _profil!.nama),
                          _ProfilRow(icon: Icons.phone_outlined, label: 'No. Handphone', value: _profil!.noTelp.isEmpty ? '-' : _profil!.noTelp),
                          _ProfilRow(icon: Icons.email_outlined, label: 'Email', value: _profil!.email.isEmpty ? '-' : _profil!.email),
                          _ProfilRow(icon: Icons.apartment_outlined, label: 'Departemen', value: _profil!.departemen.isEmpty ? '-' : _profil!.departemen, isLast: true),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _ProfilRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isLast;
  const _ProfilRow({required this.icon, required this.label, required this.value, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: isLast ? null : const Border(bottom: BorderSide(color: Color(0xFFF3F4F6)))),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 15, color: const Color(0xFF6B7280)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827)), overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
