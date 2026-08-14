import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/lapor_it_item.dart';
import '../services/api_config.dart';
import '../services/lapor_it_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

const _kKategoriLaporIt = [
  (value: 'hardware', label: 'Hardware'),
  (value: 'software', label: 'Software'),
  (value: 'jaringan', label: 'Jaringan'),
  (value: 'printer', label: 'Printer'),
  (value: 'lainnya', label: 'Lainnya'),
];

({Color bg, Color fg, String label}) _laporItStatusStyle(String status) {
  switch (status) {
    case 'diproses':
      return (bg: const Color(0xFFDBEAFE), fg: const Color(0xFF1E40AF), label: 'Diproses');
    case 'selesai':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534), label: 'Selesai');
    case 'ditolak':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B), label: 'Ditolak');
    default:
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E), label: 'Menunggu');
  }
}

/// Padanan LaporItView di PresensiMobile.tsx — form lapor kendala IT
/// (kategori + lokasi + judul + deskripsi + foto opsional) + riwayat
/// laporan dgn tombol Batalkan utk yg masih "menunggu".
class LaporItView extends StatefulWidget {
  final String nik;
  const LaporItView({super.key, required this.nik});

  @override
  State<LaporItView> createState() => _LaporItViewState();
}

class _LaporItViewState extends State<LaporItView> {
  bool _showForm = false;
  bool _submitting = false;
  bool _loadingList = true;
  List<LaporItItem> _list = [];

  String _kategori = _kKategoriLaporIt.first.value;
  final _lokasiCtrl = TextEditingController();
  final _judulCtrl = TextEditingController();
  final _deskripsiCtrl = TextEditingController();

  String? _fotoUrl;
  bool _uploadingFoto = false;

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  @override
  void dispose() {
    _lokasiCtrl.dispose();
    _judulCtrl.dispose();
    _deskripsiCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadList() async {
    setState(() => _loadingList = true);
    try {
      final list = await LaporItService.getSaya(widget.nik);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loadingList = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingList = false);
    }
  }

  Future<void> _pickFoto(ImageSource source) async {
    final picker = ImagePicker();
    final XFile? file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploadingFoto = true);
    try {
      final bytes = await file.readAsBytes();
      final url = await LaporItService.uploadFoto(bytes);
      if (!mounted) return;
      setState(() {
        _fotoUrl = url;
        _uploadingFoto = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadingFoto = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal upload foto: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
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

  Future<void> _submit() async {
    if (_lokasiCtrl.text.trim().isEmpty || _judulCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lokasi & judul wajib diisi.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await LaporItService.submit(
        nik: widget.nik,
        kategori: _kategori,
        lokasi: _lokasiCtrl.text.trim(),
        judul: _judulCtrl.text.trim(),
        deskripsi: _deskripsiCtrl.text.trim(),
        foto: _fotoUrl ?? '',
      );
      if (!mounted) return;
      _lokasiCtrl.clear();
      _judulCtrl.clear();
      _deskripsiCtrl.clear();
      setState(() {
        _showForm = false;
        _fotoUrl = null;
        _kategori = _kKategoriLaporIt.first.value;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Laporan berhasil dikirim ke tim IT.'), backgroundColor: _kGreenDark),
      );
      await _loadList();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal mengirim laporan: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _batalkan(LaporItItem item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Batalkan laporan?'),
        content: Text('Laporan "${item.judul}" akan dibatalkan.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Tidak')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Ya, Batalkan')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await LaporItService.batalkan(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Laporan dibatalkan.'), backgroundColor: _kGreenDark),
      );
      await _loadList();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal membatalkan: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Lapor IT', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _loadList,
        color: _kGreenDark,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (!_showForm)
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () => setState(() => _showForm = true),
                  style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  icon: const Icon(Icons.add, color: Colors.white),
                  label: const Text('Lapor Kendala Baru', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              )
            else
              _buildForm(),
            const SizedBox(height: 20),
            const Text('Riwayat Laporan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
            const SizedBox(height: 12),
            if (_loadingList)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else if (_list.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Belum ada laporan', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._list.map((item) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _LaporItCard(item: item, onBatalkan: () => _batalkan(item)))),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Kategori', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _kategori,
                isExpanded: true,
                items: _kKategoriLaporIt.map((k) => DropdownMenuItem(value: k.value, child: Text(k.label, style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (v) => setState(() => _kategori = v ?? _kategori),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const Text('Lokasi/Ruangan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _lokasiCtrl,
            maxLength: 100,
            decoration: InputDecoration(
              hintText: 'mis. Ruang Rekam Medis',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
              counterText: '',
            ),
          ),
          const SizedBox(height: 10),
          const Text('Judul Singkat', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _judulCtrl,
            maxLength: 150,
            decoration: InputDecoration(
              hintText: 'mis. Komputer tidak menyala',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
              counterText: '',
            ),
          ),
          const SizedBox(height: 10),
          const Text('Deskripsi (opsional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _deskripsiCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Jelaskan kendalanya lebih detail',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
          const SizedBox(height: 10),
          const Text('Foto (opsional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          _buildFotoPicker(),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _submitting ? null : () => setState(() => _showForm = false),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                  child: const Text('Batal'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, padding: const EdgeInsets.symmetric(vertical: 12)),
                  child: Text(_submitting ? 'Mengirim...' : 'Kirim Laporan', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFotoPicker() {
    if (_uploadingFoto) {
      return Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (_fotoUrl != null) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network('$kApiBaseUrl$_fotoUrl', width: 100, height: 100, fit: BoxFit.cover),
          ),
          Positioned(
            top: -8,
            right: -8,
            child: GestureDetector(
              onTap: () => setState(() => _fotoUrl = null),
              child: Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(color: Color(0xFFDC2626), shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 16, color: Colors.white),
              ),
            ),
          ),
        ],
      );
    }
    return InkWell(
      onTap: _showFotoSourceSheet,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          border: Border.all(color: _kBorder, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_a_photo_outlined, color: Color(0xFF9CA3AF), size: 22),
            SizedBox(height: 4),
            Text('Tambah Foto', style: TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}

class _LaporItCard extends StatelessWidget {
  final LaporItItem item;
  final VoidCallback onBatalkan;
  const _LaporItCard({required this.item, required this.onBatalkan});

  @override
  Widget build(BuildContext context) {
    final style = _laporItStatusStyle(item.status);
    final kategoriLabel = _kKategoriLaporIt.firstWhere((k) => k.value == item.kategori, orElse: () => _kKategoriLaporIt.last).label;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.judul, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text('$kategoriLabel · ${item.lokasi}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(style.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: style.fg)),
              ),
            ],
          ),
          if (item.deskripsi.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.deskripsi, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
          if (item.foto.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network('$kApiBaseUrl${item.foto}', width: 80, height: 80, fit: BoxFit.cover),
              ),
            ),
          if (item.createdAt.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.createdAt, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)))),
          if (item.catatanPenyelesaian.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Catatan (${item.ditanganiOleh}): ${item.catatanPenyelesaian}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF), fontStyle: FontStyle.italic),
              ),
            ),
          if (item.status == 'menunggu')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onBatalkan,
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                  child: const Text('Batalkan'),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
