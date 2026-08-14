import 'package:flutter/material.dart';
import '../services/api_client.dart';

const _kGreenDark = Color(0xFF059669);

// Padanan persis RegisterView di frontend/src/modules/App.tsx (versi
// web) — endpoint backend yg dipakai SAMA PERSIS, tidak ada endpoint
// baru:
//   GET  /api/auth/cari-pegawai?q= (NIP atau No.HP)
//   GET  /api/pegawai/departemen
//   POST /api/auth/register {nip, departemen, password}
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _queryCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _searching = false;
  String? _searchError;
  String? _foundNip;
  String? _foundNama;

  List<String> _departemenList = [];
  String? _departemen;
  bool _submitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _loadDepartemen();
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDepartemen() async {
    try {
      // Endpoint ini balikin array JSON polos (bukan {"...": [...]}),
      // jadi lewat getJsonList (bukan getJson yg mengasumsikan object).
      final res = await ApiClient.getJsonList('/api/pegawai/departemen');
      if (mounted) setState(() => _departemenList = res);
    } catch (_) {
      // Opsional — kalau gagal diambil, dropdown cuma kosong, staf tetap
      // bisa lanjut cuma tanpa pilihan (jarang terjadi, endpoint ringan).
    }
  }

  Future<void> _cari() async {
    final q = _queryCtrl.text.trim();
    if (q.isEmpty) {
      setState(() => _searchError = 'Isi NIP atau No. HP dulu.');
      return;
    }
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final data = await ApiClient.getJson('/api/auth/cari-pegawai', query: {'q': q});
      final sudahTerdaftar = data['sudah_terdaftar'] as bool? ?? false;
      if (sudahTerdaftar) {
        throw ApiException(409, 'NIP ini sudah terdaftar. Silakan masuk, atau hubungi admin kalau lupa kata sandi.');
      }
      setState(() {
        _foundNip = data['nip'] as String?;
        _foundNama = data['nama'] as String?;
      });
    } on ApiException catch (e) {
      setState(() {
        _foundNip = null;
        _foundNama = null;
        _searchError = e.message;
      });
    } catch (_) {
      setState(() {
        _foundNip = null;
        _foundNama = null;
        _searchError = 'Terjadi kesalahan. Cek koneksi internet/wifi RS.';
      });
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _gantiPencarian() {
    setState(() {
      _foundNip = null;
      _foundNama = null;
      _searchError = null;
      _departemen = null;
      _passwordCtrl.clear();
      _confirmCtrl.clear();
      _submitError = null;
    });
  }

  Future<void> _submit() async {
    if (_foundNip == null) return;
    setState(() => _submitError = null);
    if (_departemen == null) {
      setState(() => _submitError = 'Pilih Asal Unit dulu.');
      return;
    }
    if (_passwordCtrl.text.length < 6) {
      setState(() => _submitError = 'Kata sandi minimal 6 karakter.');
      return;
    }
    if (_passwordCtrl.text != _confirmCtrl.text) {
      setState(() => _submitError = 'Konfirmasi kata sandi tidak sama.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiClient.postJson('/api/auth/register', {
        'nip': _foundNip,
        'departemen': _departemen,
        'password': _passwordCtrl.text,
      });
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Pendaftaran berhasil'),
          content: const Text('Silakan masuk pakai NIP dan kata sandi yang baru dibuat.'),
          actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK'))],
        ),
      );
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _submitError = e.message);
    } catch (_) {
      setState(() => _submitError = 'Terjadi kesalahan. Cek koneksi internet/wifi RS.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxWidth: 380),
              padding: const EdgeInsets.fromLTRB(28, 32, 28, 28),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 30, offset: const Offset(0, 12)),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.arrow_back)),
                      const SizedBox(width: 4),
                      const Expanded(
                        child: Text('Daftar Akun Pegawai', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_foundNip == null) ...[
                    const Text('NIP Pegawai / No. HP', style: TextStyle(fontSize: 12.5, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _queryCtrl,
                      autofocus: true,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _cari(),
                      decoration: const InputDecoration(
                        hintText: 'Masukkan NIP atau No. HP',
                        border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text('Dipakai untuk menemukan data kepegawaian kamu.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    if (_searchError != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                        child: Text(_searchError!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12.5)),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        onPressed: _searching ? null : _cari,
                        style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                        child: _searching
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                            : const Text('Cari'),
                      ),
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFFF0FDF4), border: Border.all(color: const Color(0xFFBBF7D0)), borderRadius: BorderRadius.circular(8)),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text('✓ $_foundNama (NIP: $_foundNip)', style: const TextStyle(fontSize: 12.5, color: Color(0xFF166534))),
                          ),
                          TextButton(
                            onPressed: _gantiPencarian,
                            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                            child: const Text('Bukan saya', style: TextStyle(fontSize: 11.5, color: Color(0xFF166534), decoration: TextDecoration.underline)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text('Asal Unit', style: TextStyle(fontSize: 12.5, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: _departemen,
                      decoration: const InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10)))),
                      hint: const Text('Pilih unit/departemen'),
                      items: _departemenList.map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
                      onChanged: (v) => setState(() => _departemen = v),
                    ),
                    const SizedBox(height: 16),
                    const Text('Buat Kata Sandi', style: TextStyle(fontSize: 12.5, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _passwordCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(hintText: 'Masukkan kata sandi', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10)))),
                    ),
                    const SizedBox(height: 16),
                    const Text('Konfirmasi Kata Sandi', style: TextStyle(fontSize: 12.5, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _confirmCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(hintText: 'Ulangi kata sandi', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10)))),
                    ),
                    if (_submitError != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                        child: Text(_submitError!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12.5)),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                        child: _submitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                            : const Text('Daftar'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
