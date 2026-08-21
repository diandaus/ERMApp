import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/hari_libur_row.dart';
import '../services/api_client.dart';
import '../services/hari_libur_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBlue = Color(0xFF2563EB);
const _kBorder = Color(0xFFE5E7EB);

const _kNamaBulan = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

({Color bg, Color fg, String label}) _jenisStyle(String jenis) {
  switch (jenis) {
    case 'nasional':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534), label: 'Nasional');
    case 'cuti_bersama':
      return (bg: const Color(0xFFDDEAFE), fg: const Color(0xFF1E40AF), label: 'Cuti Bersama');
    default:
      return (bg: const Color(0xFFFEF3C7), fg: const Color(0xFF92400E), label: 'Perusahaan');
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

/// Kalender Libur Otomatis — hari libur nasional & cuti bersama disinkron
/// dari API publik (tombol "Sinkron"), tidak perlu diketik ulang manual
/// tiap tahun. Libur perusahaan ditambah manual lewat form di sini. Kedua
/// jenis otomatis memengaruhi jadwal kerja shift reguler (Senin-Jumat) —
/// lihat getJadwalTetap di backend/jadwal_pegawai_handler.go — TANPA perlu
/// langkah tambahan di sini, cukup tersimpan di tabel `hari_libur`.
class KalenderLiburView extends StatefulWidget {
  final AppUser user;
  const KalenderLiburView({super.key, required this.user});

  @override
  State<KalenderLiburView> createState() => _KalenderLiburViewState();
}

class _KalenderLiburViewState extends State<KalenderLiburView> {
  bool get _isAdmin => widget.user.role == 'admin';

  int _tahun = DateTime.now().year;
  bool _loading = true;
  bool _syncing = false;
  List<HariLiburRow> _list = [];

  bool _showForm = false;
  bool _submitting = false;
  DateTime _tanggalBaru = DateTime.now();
  final _keteranganCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _keteranganCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await HariLiburService.getList(tahun: _tahun);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _gantiTahun(int delta) {
    setState(() => _tahun += delta);
    _load();
  }

  Future<void> _sync() async {
    setState(() => _syncing = true);
    try {
      final jumlah = await HariLiburService.sync(tahun: _tahun);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$jumlah hari libur tahun $_tahun berhasil disinkron.'), backgroundColor: _kGreenDark),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal sinkron: ${e is ApiException ? e.message : e}'), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _pickTanggalBaru() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _tanggalBaru,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _tanggalBaru = picked);
  }

  Future<void> _submitTambah() async {
    if (_keteranganCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Keterangan libur wajib diisi.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final tanggalStr = '${_tanggalBaru.year}-${_two(_tanggalBaru.month)}-${_two(_tanggalBaru.day)}';
      await HariLiburService.tambah(tanggal: tanggalStr, keterangan: _keteranganCtrl.text.trim());
      if (!mounted) return;
      _keteranganCtrl.clear();
      setState(() => _showForm = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Libur perusahaan berhasil ditambahkan.'), backgroundColor: _kGreenDark),
      );
      if (_tanggalBaru.year != _tahun) {
        setState(() => _tahun = _tanggalBaru.year);
      }
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal menambah: ${e is ApiException ? e.message : e}'), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _hapus(HariLiburRow row) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus Hari Libur?'),
        content: Text('${row.tanggal} — ${row.keterangan}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Hapus', style: TextStyle(color: Color(0xFFDC2626))),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await HariLiburService.hapus(row.id);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal menghapus: ${e is ApiException ? e.message : e}'), backgroundColor: const Color(0xFFDC2626)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Kalender Libur', style: TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: _kGreenDark,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildTahunSelector(),
            if (_isAdmin) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _syncing ? null : _sync,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kBlue,
                        side: const BorderSide(color: _kBlue),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: _syncing
                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: _kBlue))
                          : const Icon(Icons.sync, size: 18),
                      label: Text(_syncing ? 'Menyinkron...' : 'Sinkron $_tahun'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => setState(() => _showForm = !_showForm),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kGreenDark,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: Icon(_showForm ? Icons.close : Icons.add, color: Colors.white, size: 18),
                      label: Text(_showForm ? 'Batal' : 'Tambah Libur', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Sinkron mengambil hari libur nasional & cuti bersama resmi — aman dijalankan ulang kapan saja.',
                style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
              ),
              if (_showForm) ...[
                const SizedBox(height: 14),
                _buildForm(),
              ],
            ],
            const SizedBox(height: 20),
            Text('Daftar Hari Libur $_tahun', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else if (_list.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Belum ada data hari libur tahun ini — coba Sinkron.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._list.map((row) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _HariLiburCard(row: row, canDelete: _isAdmin, onDelete: () => _hapus(row)),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildTahunSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(onPressed: () => _gantiTahun(-1), icon: const Icon(Icons.chevron_left)),
          Text('$_tahun', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          IconButton(onPressed: () => _gantiTahun(1), icon: const Icon(Icons.chevron_right)),
        ],
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
          const Text('Libur Perusahaan Baru', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          const SizedBox(height: 12),
          const Text('Tanggal', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          InkWell(
            onTap: _pickTanggalBaru,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF6B7280)),
                  const SizedBox(width: 8),
                  Text(
                    '${_tanggalBaru.year}-${_two(_tanggalBaru.month)}-${_two(_tanggalBaru.day)}',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF111827)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          const Text('Keterangan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _keteranganCtrl,
            decoration: InputDecoration(
              hintText: 'mis. HUT Rumah Sakit',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitTambah,
              style: ElevatedButton.styleFrom(backgroundColor: _kGreenDark, padding: const EdgeInsets.symmetric(vertical: 12)),
              child: Text(_submitting ? 'Menyimpan...' : 'Simpan', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

class _HariLiburCard extends StatelessWidget {
  final HariLiburRow row;
  final bool canDelete;
  final VoidCallback onDelete;
  const _HariLiburCard({required this.row, required this.canDelete, required this.onDelete});

  String get _tanggalIndo {
    final parts = row.tanggal.split('-');
    if (parts.length != 3) return row.tanggal;
    final bulan = int.tryParse(parts[1]) ?? 0;
    return '${parts[2]} ${_kNamaBulan[bulan.clamp(0, 12)]} ${parts[0]}';
  }

  @override
  Widget build(BuildContext context) {
    final style = _jenisStyle(row.jenis);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_tanggalIndo, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(row.keterangan, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
                  child: Text(style.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: style.fg)),
                ),
              ],
            ),
          ),
          if (canDelete)
            IconButton(
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFF9CA3AF)),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
