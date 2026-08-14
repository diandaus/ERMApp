import 'package:flutter/material.dart';

import '../models/lembur_item.dart';
import '../services/lembur_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

({Color bg, Color fg, String label}) _lemburStatusStyle(String status) {
  switch (status) {
    case 'disetujui':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534), label: 'Disetujui');
    case 'ditolak':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B), label: 'Ditolak');
    default:
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E), label: 'Menunggu');
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

/// Padanan LemburView di PresensiMobile.tsx — form ajukan lembur (tanggal
/// + jam mulai/selesai + keterangan) + riwayat pengajuan di bawahnya.
class LemburView extends StatefulWidget {
  final String nik;
  const LemburView({super.key, required this.nik});

  @override
  State<LemburView> createState() => _LemburViewState();
}

class _LemburViewState extends State<LemburView> {
  bool _showForm = false;
  bool _submitting = false;
  bool _loadingList = true;
  List<LemburItem> _list = [];

  DateTime _tanggal = DateTime.now();
  TimeOfDay _jamMulai = TimeOfDay.now();
  late TimeOfDay _jamSelesai;
  final _keteranganCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final now = TimeOfDay.now();
    _jamSelesai = TimeOfDay(hour: (now.hour + 1) % 24, minute: now.minute);
    _loadList();
  }

  @override
  void dispose() {
    _keteranganCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadList() async {
    setState(() => _loadingList = true);
    try {
      final list = await LemburService.getSaya(widget.nik);
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

  String get _tanggalStr => '${_tanggal.year}-${_two(_tanggal.month)}-${_two(_tanggal.day)}';
  String _jamStr(TimeOfDay t) => '${_two(t.hour)}:${_two(t.minute)}';

  Future<void> _pickTanggal() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _tanggal,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _tanggal = picked);
  }

  Future<void> _pickJam(bool mulai) async {
    final picked = await showTimePicker(context: context, initialTime: mulai ? _jamMulai : _jamSelesai);
    if (picked == null) return;
    setState(() {
      if (mulai) {
        _jamMulai = picked;
      } else {
        _jamSelesai = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (_keteranganCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lengkapi keterangan lembur dulu.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await LemburService.submit(
        nik: widget.nik,
        tanggal: _tanggalStr,
        jamMulai: _jamStr(_jamMulai),
        jamSelesai: _jamStr(_jamSelesai),
        keterangan: _keteranganCtrl.text.trim(),
      );
      if (!mounted) return;
      _keteranganCtrl.clear();
      setState(() => _showForm = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pengajuan lembur terkirim.'), backgroundColor: _kGreenDark),
      );
      await _loadList();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal mengirim pengajuan: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Lembur', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
                  label: const Text('Ajukan Lembur Baru', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              )
            else
              _buildForm(),
            const SizedBox(height: 20),
            const Text('Riwayat Pengajuan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
            const SizedBox(height: 12),
            if (_loadingList)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else if (_list.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Belum ada pengajuan lembur', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._list.map((item) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _LemburCard(item: item))),
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
          const Text('Tanggal', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          _FieldButton(text: _tanggalStr, icon: Icons.calendar_today_outlined, onTap: _pickTanggal),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Jam Mulai', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    _FieldButton(text: _jamStr(_jamMulai), icon: Icons.access_time, onTap: () => _pickJam(true)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Jam Selesai', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    _FieldButton(text: _jamStr(_jamSelesai), icon: Icons.access_time, onTap: () => _pickJam(false)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text('Keterangan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _keteranganCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Alasan/tugas lembur',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
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
                  child: Text(_submitting ? 'Mengirim...' : 'Kirim Pengajuan', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FieldButton extends StatelessWidget {
  final String text;
  final IconData icon;
  final VoidCallback onTap;
  const _FieldButton({required this.text, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF6B7280)),
            const SizedBox(width: 8),
            Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF111827))),
          ],
        ),
      ),
    );
  }
}

class _LemburCard extends StatelessWidget {
  final LemburItem item;
  const _LemburCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final style = _lemburStatusStyle(item.status);
    final jam = '${item.jamMulai} – ${item.jamSelesai}';
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
                    Text(item.tanggal, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(jam, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
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
          if (item.keterangan.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.keterangan, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
          if (item.status != 'menunggu' && item.catatanApproval.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Catatan (${item.disetujuiOleh}): ${item.catatanApproval}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF), fontStyle: FontStyle.italic),
              ),
            ),
        ],
      ),
    );
  }
}
