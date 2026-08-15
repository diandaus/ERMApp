import 'dart:async';

import 'package:flutter/material.dart';

import '../models/cuti_izin_item.dart';
import '../models/pegawai_opsi.dart';
import '../services/cuti_izin_service.dart';
import '../services/jadwal_pegawai_service.dart';
import '../services/pegawai_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);

const _kUrgensiCuti = ['Tahunan', 'Besar', 'Sakit', 'Bersalin'];
const _kUrgensiIzin = ['Alasan Penting', 'Keterangan Lainnya'];

({Color bg, Color fg}) _cutiIzinStatusStyle(String status) {
  switch (status) {
    case 'Disetujui':
      return (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF166534));
    case 'Ditolak':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B));
    default:
      return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E));
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

int _hitungJumlahHari(DateTime awal, DateTime akhir) {
  final a = DateTime(awal.year, awal.month, awal.day);
  final b = DateTime(akhir.year, akhir.month, akhir.day);
  return b.difference(a).inDays;
}

/// Padanan CutiIzinView di PresensiMobile.tsx — satu komponen dipakai utk
/// Cuti maupun Izin lewat parameter `mode`, form rentang tanggal + jenis +
/// alamat + kepentingan + pilih PJ pengganti (dari departemen sendiri
/// lewat modal), + riwayat pengajuan (dgn tombol Batalkan utk yg masih
/// "Proses Pengajuan").
class CutiIzinView extends StatefulWidget {
  final String nik;
  final String mode; // 'cuti' | 'izin'
  const CutiIzinView({super.key, required this.nik, required this.mode});

  @override
  State<CutiIzinView> createState() => _CutiIzinViewState();
}

class _CutiIzinViewState extends State<CutiIzinView> {
  bool _showForm = false;
  bool _submitting = false;
  bool _loadingList = true;
  List<CutiIzinItem> _list = [];

  DateTime _tanggalAwal = DateTime.now();
  DateTime _tanggalAkhir = DateTime.now();
  late String _urgensi;
  final _alamatCtrl = TextEditingController();
  final _kepentinganCtrl = TextEditingController();

  PegawaiOpsi? _pjTerpilih;

  // Departemen & shift tetap pemohon sendiri (dicari dari data pegawai
  // lewat nik) — dipakai buat (1) batasi modal pilih PJ pengganti cuma
  // ke anggota departemen sendiri, (2) shift Reguler tak wajib punya
  // pengganti (lihat _submit & backend cuti_izin_handler.go
  // submitCutiIzin). _isRegulerShift default false (dianggap wajib)
  // sampai kebukti sebaliknya dari data server, spy gagal-aman kalau
  // _loadProfilInfo gagal diambil.
  String? _myDepartemen;
  bool _isRegulerShift = false;

  String get _judul => widget.mode == 'cuti' ? 'Cuti' : 'Izin';
  List<String> get _urgensiOpsi => widget.mode == 'cuti' ? _kUrgensiCuti : _kUrgensiIzin;

  @override
  void initState() {
    super.initState();
    _urgensi = _urgensiOpsi.first;
    _loadList();
    _loadProfilInfo();
  }

  Future<void> _loadProfilInfo() async {
    try {
      final now = DateTime.now();
      final list = await JadwalPegawaiService.getList(tahun: now.year, bulan: now.month, search: widget.nik);
      final match = list.where((p) => p.nik == widget.nik);
      if (match.isNotEmpty && mounted) {
        setState(() {
          _myDepartemen = match.first.departemen;
          _isRegulerShift = match.first.jadwalTetapShift.trim().toLowerCase() == 'reguler';
        });
      }
    } catch (_) {
      // Opsional — gagal diambil ya tetap anggap wajib PJ (aman); modal
      // pilih PJ akan kasih tau kalau departemen belum kedeteksi.
    }
  }

  @override
  void dispose() {
    _alamatCtrl.dispose();
    _kepentinganCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadList() async {
    setState(() => _loadingList = true);
    try {
      final list = await CutiIzinService.getSaya(widget.nik, widget.mode);
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

  String _tanggalStr(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

  Future<void> _pickTanggal(bool awal) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: awal ? _tanggalAwal : _tanggalAkhir,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (awal) {
        _tanggalAwal = picked;
      } else {
        _tanggalAkhir = picked;
      }
    });
  }

  Future<void> _openPjPicker() async {
    if (_myDepartemen == null || _myDepartemen!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Departemen Anda belum terdeteksi, coba lagi sebentar.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    final result = await showModalBottomSheet<PegawaiOpsi>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _PjPickerSheet(departemen: _myDepartemen!, excludeNik: widget.nik),
    );
    if (result != null && mounted) setState(() => _pjTerpilih = result);
  }

  Future<void> _submit() async {
    if (_alamatCtrl.text.trim().isEmpty || _kepentinganCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lengkapi alamat dan keperluan dulu.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    if (_pjTerpilih == null && !_isRegulerShift) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pilih penanggung jawab pengganti dulu.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    if (_tanggalAkhir.isBefore(_tanggalAwal)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tanggal akhir tidak boleh sebelum tanggal awal.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await CutiIzinService.submit(
        nik: widget.nik,
        tanggalAwal: _tanggalStr(_tanggalAwal),
        tanggalAkhir: _tanggalStr(_tanggalAkhir),
        urgensi: _urgensi,
        alamat: _alamatCtrl.text.trim(),
        kepentingan: _kepentinganCtrl.text.trim(),
        nikPj: _pjTerpilih?.nik ?? '',
      );
      if (!mounted) return;
      _alamatCtrl.clear();
      _kepentinganCtrl.clear();
      setState(() {
        _showForm = false;
        _pjTerpilih = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Pengajuan $_judul terkirim.'), backgroundColor: _kGreenDark),
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

  Future<void> _batalkan(CutiIzinItem item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Batalkan pengajuan?'),
        content: Text('Pengajuan $_judul tanggal ${item.tanggalAwal} akan dibatalkan.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Tidak')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Ya, Batalkan')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await CutiIzinService.batalkan(item.noPengajuan);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pengajuan dibatalkan.'), backgroundColor: _kGreenDark),
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
    final jumlahHari = _hitungJumlahHari(_tanggalAwal, _tanggalAkhir);
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: Text(_judul, style: const TextStyle(color: Color(0xFF111827), fontWeight: FontWeight.w700, fontSize: 16)),
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
                  label: Text('Ajukan $_judul Baru', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              )
            else
              _buildForm(jumlahHari),
            const SizedBox(height: 20),
            const Text('Riwayat Pengajuan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
            const SizedBox(height: 12),
            if (_loadingList)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else if (_list.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text('Belum ada pengajuan $_judul', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
              )
            else
              ..._list.map((item) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _CutiIzinCard(item: item, judul: _judul, onBatalkan: () => _batalkan(item)))),
          ],
        ),
      ),
    );
  }

  Widget _buildForm(int jumlahHari) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tanggal Awal', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    _FieldButton(text: _tanggalStr(_tanggalAwal), icon: Icons.calendar_today_outlined, onTap: () => _pickTanggal(true)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tanggal Akhir', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                    const SizedBox(height: 6),
                    _FieldButton(text: _tanggalStr(_tanggalAkhir), icon: Icons.calendar_today_outlined, onTap: () => _pickTanggal(false)),
                  ],
                ),
              ),
            ],
          ),
          if (jumlahHari > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('$jumlahHari hari', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
            ),
          const SizedBox(height: 14),
          Text('Jenis $_judul', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _urgensi,
                isExpanded: true,
                items: _urgensiOpsi.map((u) => DropdownMenuItem(value: u, child: Text(u, style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (v) => setState(() => _urgensi = v ?? _urgensi),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const Text('Alamat Tujuan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _alamatCtrl,
            maxLength: 100,
            decoration: InputDecoration(
              hintText: 'Alamat selama izin/cuti',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
              counterText: '',
            ),
          ),
          const SizedBox(height: 10),
          const Text('Keperluan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          TextField(
            controller: _kepentinganCtrl,
            maxLines: 2,
            maxLength: 70,
            decoration: InputDecoration(
              hintText: 'Alasan pengajuan',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
              contentPadding: const EdgeInsets.all(12),
              counterText: '',
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _isRegulerShift ? 'Penanggung Jawab Pengganti (opsional)' : 'Penanggung Jawab Pengganti',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
          ),
          if (_isRegulerShift)
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Text('Shift Reguler tidak wajib punya pengganti.', style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
            ),
          const SizedBox(height: 6),
          if (_pjTerpilih != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Expanded(child: Text(_pjTerpilih!.nama, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF047857)))),
                  TextButton(
                    onPressed: () => setState(() => _pjTerpilih = null),
                    child: const Text('Ganti'),
                  ),
                ],
              ),
            )
          else
            // Bukan text field cari-langsung lagi — tap buka modal yg
            // cuma nampilin anggota departemen sendiri (lihat
            // _openPjPicker & _PjPickerSheet), supaya user tak salah
            // pilih pengganti dari departemen lain.
            _FieldButton(text: 'Pilih penanggung jawab pengganti', icon: Icons.person_search_outlined, onTap: _openPjPicker),
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
            Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF111827)))),
          ],
        ),
      ),
    );
  }
}

/// Modal pilih PJ pengganti — cuma nampilin pegawai AKTIF satu
/// departemen dgn pemohon (bukan cari lintas departemen), diri sendiri
/// dikecualikan. Ada search box buat filter nama di dalam daftar itu.
class _PjPickerSheet extends StatefulWidget {
  final String departemen;
  final String excludeNik;
  const _PjPickerSheet({required this.departemen, required this.excludeNik});

  @override
  State<_PjPickerSheet> createState() => _PjPickerSheetState();
}

class _PjPickerSheetState extends State<_PjPickerSheet> {
  final _searchCtrl = TextEditingController();
  List<PegawaiOpsi> _list = [];
  bool _loading = true;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load(String q) async {
    setState(() => _loading = true);
    try {
      final list = await PegawaiService.searchDepartemen(departemen: widget.departemen, query: q);
      if (!mounted) return;
      setState(() {
        _list = list.where((p) => p.nik != widget.excludeNik).toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _load(q.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 36, height: 4, decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            const Text('Pilih Penanggung Jawab Pengganti', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
            const SizedBox(height: 2),
            const Text('Anggota departemen Anda sendiri', style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
            const SizedBox(height: 12),
            TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Cari nama...',
                prefixIcon: const Icon(Icons.search, size: 18),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
                  : _list.isEmpty
                      ? const Center(child: Text('Tidak ada pegawai ditemukan', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
                      : ListView.separated(
                          controller: scrollController,
                          itemCount: _list.length,
                          separatorBuilder: (_, __) => const Divider(height: 1, color: _kBorder),
                          itemBuilder: (context, i) {
                            final p = _list[i];
                            return ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              title: Text(p.nama, style: const TextStyle(fontSize: 13, color: Color(0xFF111827))),
                              subtitle: Text(p.nik, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                              onTap: () => Navigator.of(context).pop(p),
                            );
                          },
                        ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _CutiIzinCard extends StatelessWidget {
  final CutiIzinItem item;
  final String judul;
  final VoidCallback onBatalkan;
  const _CutiIzinCard({required this.item, required this.judul, required this.onBatalkan});

  @override
  Widget build(BuildContext context) {
    final style = _cutiIzinStatusStyle(item.status);
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
                    Text('${item.tanggalAwal} – ${item.tanggalAkhir}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text('${item.urgensi} · ${item.jumlah} hari', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(item.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: style.fg)),
              ),
            ],
          ),
          if (item.kepentingan.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.kepentingan, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('PJ Pengganti: ${item.namaPj.isEmpty ? '-' : item.namaPj}', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          ),
          if (item.catatanApproval.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Catatan (${item.disetujuiOleh}): ${item.catatanApproval}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF), fontStyle: FontStyle.italic),
              ),
            ),
          if (item.status == 'Proses Pengajuan')
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
