import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan PengaturanAkunView di PresensiMobile.tsx — form ubah password
/// sendiri, wajib password lama. Reuse endpoint yg sama dgn
/// ModalGantiPassword.tsx (desktop): POST /api/auth/change-password.
class GantiPasswordView extends StatefulWidget {
  final int userId;
  const GantiPasswordView({super.key, required this.userId});

  @override
  State<GantiPasswordView> createState() => _GantiPasswordViewState();
}

class _GantiPasswordViewState extends State<GantiPasswordView> {
  final _oldCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _oldCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_oldCtrl.text.isEmpty || _newCtrl.text.isEmpty || _confirmCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Semua field wajib diisi.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    if (_newCtrl.text.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password baru minimal 6 karakter.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    if (_newCtrl.text != _confirmCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Konfirmasi password baru tidak cocok.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await AuthService.changePassword(id: widget.userId, oldPassword: _oldCtrl.text, newPassword: _newCtrl.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password berhasil diganti.'), backgroundColor: _kGreenDark),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : 'Gagal mengganti password.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Pengaturan Akun', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.lock_outline, size: 18, color: _kGreenDark),
                    SizedBox(width: 8),
                    Text('Ubah Password', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                  ],
                ),
                const SizedBox(height: 16),
                _passwordField('Password Lama', _oldCtrl),
                const SizedBox(height: 12),
                _passwordField('Password Baru', _newCtrl),
                const SizedBox(height: 12),
                _passwordField('Konfirmasi Password Baru', _confirmCtrl),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: Text(_submitting ? 'Menyimpan...' : 'Simpan Password Baru', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _passwordField(String label, TextEditingController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: true,
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
            contentPadding: const EdgeInsets.all(12),
          ),
        ),
      ],
    );
  }
}
