import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/catatan_dokter_service.dart';
import '../theme/app_theme.dart';

const _kGreen = Color(0xFF04C99E);
const _kRed = Color(0xFFEF4444);
const _kLine = Color(0xFFE6E8E8);
const _kField = Color(0xFFCFD1D1);

/// CatatanDokterTab — padanan CatatanDokterTab.tsx (web) / tab "Catatan
/// Dokter" DlgRawatJalan.java: catatan bebas per kunjungan (terpisah dari
/// SOAP/CPPT), dokter = DPJP kunjungan ini. Kiri: form tambah + riwayat
/// (+ Jadikan Template / Hapus); kanan: Template Catatan milik dokter
/// (Pakai / Hapus / + Tambah). Gaya kartu & font SAMA dgn tab Tindakan.
class CatatanDokterTab extends StatefulWidget {
  final String noRawat;
  final String kdDokter;
  const CatatanDokterTab({super.key, required this.noRawat, required this.kdDokter});

  @override
  State<CatatanDokterTab> createState() => _CatatanDokterTabState();
}

class _CatatanDokterTabState extends State<CatatanDokterTab> {
  final _catatan = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  List<Map<String, dynamic>> _list = [];
  bool _loadingTemplate = true;
  List<Map<String, dynamic>> _templates = [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadTemplates();
  }

  @override
  void dispose() {
    _catatan.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final l = await CatatanDokterService.getCatatan(widget.noRawat);
      if (mounted) setState(() => _list = l);
    } catch (_) {
      if (mounted) setState(() => _list = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTemplates() async {
    if (widget.kdDokter.isEmpty) {
      setState(() => _loadingTemplate = false);
      return;
    }
    setState(() => _loadingTemplate = true);
    try {
      final l = await CatatanDokterService.getTemplates(widget.kdDokter);
      if (mounted) setState(() => _templates = l);
    } catch (_) {
      if (mounted) setState(() => _templates = []);
    } finally {
      if (mounted) setState(() => _loadingTemplate = false);
    }
  }

  void _toast(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? const Color(0xFFDC2626) : const Color(0xFF16A34A)));
  }

  String _err(Object e, String fallback) => e is ApiException ? e.message : fallback;

  Future<bool> _konfirmasi(String judul, String isi) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(judul),
        content: Text(isi),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Hapus', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _simpan() async {
    final isi = _catatan.text.trim();
    if (isi.isEmpty) {
      _toast('Catatan wajib diisi', error: true);
      return;
    }
    if (widget.kdDokter.isEmpty) {
      _toast('Dokter kunjungan ini belum diketahui', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await CatatanDokterService.saveCatatan(noRawat: widget.noRawat, kdDokter: widget.kdDokter, catatan: isi);
      _catatan.clear();
      if (mounted) _toast('Catatan dokter tersimpan');
      await _load();
    } catch (e) {
      if (mounted) _toast(_err(e, 'Gagal menyimpan catatan dokter'), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _hapus(Map<String, dynamic> it) async {
    if (!await _konfirmasi('Hapus Catatan?', 'Catatan ini akan dihapus permanen.')) return;
    try {
      await CatatanDokterService.deleteCatatan(
          noRawat: widget.noRawat, tanggal: '${it['tanggal']}', jam: '${it['jam']}', kdDokter: '${it['kd_dokter']}');
      if (mounted) _toast('Catatan dihapus');
      await _load();
    } catch (e) {
      if (mounted) _toast(_err(e, 'Gagal menghapus catatan'), error: true);
    }
  }

  /// Dialog nama (+ isi) template. [isiAwal] diisi = dari riwayat catatan
  /// (isi tidak perlu diketik ulang).
  Future<void> _tambahTemplate({String? isiAwal}) async {
    final nama = TextEditingController();
    final isi = TextEditingController(text: isiAwal ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isiAwal == null ? 'Tambah Template' : 'Jadikan Template'),
        content: SizedBox(
          width: 480,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: nama, autofocus: true, decoration: _deco('Nama template, mis. Kontrol 1 minggu'), style: const TextStyle(fontSize: 15)),
            const SizedBox(height: 12),
            TextField(controller: isi, minLines: 4, maxLines: 8, decoration: _deco('Isi template...'), style: const TextStyle(fontSize: 15)),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Simpan')),
        ],
      ),
    );
    final n = nama.text.trim(), i = isi.text.trim();
    // Dispose SETELAH animasi tutup dialog selesai — TextField di dialog
    // masih memakai controller selama animasi (dispose langsung = crash
    // "_dependents.isEmpty").
    Future.delayed(const Duration(milliseconds: 600), () {
      nama.dispose();
      isi.dispose();
    });
    if (ok != true || !mounted) return;
    if (n.isEmpty || i.isEmpty) {
      _toast('Nama dan isi template wajib diisi', error: true);
      return;
    }
    try {
      await CatatanDokterService.createTemplate(kdDokter: widget.kdDokter, nama: n, isi: i);
      if (mounted) _toast('Template "$n" tersimpan');
      await _loadTemplates();
    } catch (e) {
      if (mounted) _toast(_err(e, 'Gagal menyimpan template'), error: true);
    }
  }

  Future<void> _hapusTemplate(Map<String, dynamic> t) async {
    if (!await _konfirmasi('Hapus Template?', 'Template "${t['nama_template']}" akan dihapus.')) return;
    try {
      await CatatanDokterService.deleteTemplate((t['id'] as num).toInt());
      await _loadTemplates();
    } catch (e) {
      if (mounted) _toast(_err(e, 'Gagal menghapus template'), error: true);
    }
  }

  /// Form kosong -> diisi; sudah ada isi -> ditambahkan di bawahnya (= web).
  void _pakai(Map<String, dynamic> t) {
    final isi = '${t['isi'] ?? ''}';
    final now = _catatan.text.trimRight();
    _catatan.text = now.isEmpty ? isi : '$now\n$isi';
    _catatan.selection = TextSelection.collapsed(offset: _catatan.text.length);
  }

  InputDecoration _deco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kField)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kField)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kGreen, width: 1.5)),
      );

  String _tgl(String v) {
    final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(v);
    return m == null ? v : '${m[3]}/${m[2]}/${m[1]}';
  }

  Widget _card({required String title, Widget? action, required Widget child}) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF282A2A)))),
            if (action != null) action,
          ]),
          const SizedBox(height: 12),
          child,
        ]),
      );

  Widget _btn(String label, Color color, VoidCallback? onTap, {bool outline = false}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: outline ? Colors.white : color,
            border: outline ? Border.all(color: color, width: 1.5) : null,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: outline ? color : Colors.white)),
        ),
      );

  Widget _kosong(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
      );

  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(
        flex: 7,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 8, 16), children: [
            _card(
              title: 'Tambah Catatan',
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                TextField(
                  controller: _catatan,
                  minLines: 4,
                  maxLines: 10,
                  decoration: _deco('Tulis catatan dokter untuk kunjungan ini...'),
                  style: const TextStyle(fontSize: 15),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _saving ? null : _simpan,
                  icon: const Icon(Icons.add, size: 20, color: Colors.white),
                  label: Text(_saving ? 'Menyimpan...' : 'Tambah Catatan', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreen,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    minimumSize: const Size(0, 44),
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ]),
            ),
            _card(
              title: 'Riwayat Catatan Dokter',
              child: _loading
                  ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
                  : _list.isEmpty
                      ? _kosong('Belum ada catatan dokter untuk kunjungan ini')
                      : Column(children: [
                          for (var i = 0; i < _list.length; i++)
                            Container(
                              decoration: BoxDecoration(border: Border(top: i == 0 ? BorderSide.none : const BorderSide(color: _kLine))),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(
                                      '${_tgl('${_list[i]['tanggal'] ?? ''}')} ${_list[i]['jam'] ?? ''}  ·  ${('${_list[i]['nm_dokter'] ?? ''}').isEmpty ? _list[i]['kd_dokter'] : _list[i]['nm_dokter']}',
                                      style: const TextStyle(fontSize: 13, color: kTextMuted),
                                    ),
                                    const SizedBox(height: 6),
                                    Text('${_list[i]['catatan'] ?? ''}', style: const TextStyle(fontSize: 15, height: 1.4, color: kText)),
                                  ]),
                                ),
                                const SizedBox(width: 12),
                                if (widget.kdDokter.isNotEmpty) ...[
                                  _btn('+ Jadikan Template', _kGreen, () => _tambahTemplate(isiAwal: '${_list[i]['catatan'] ?? ''}'), outline: true),
                                  const SizedBox(width: 8),
                                ],
                                _btn('Hapus', _kRed, () => _hapus(_list[i])),
                              ]),
                            ),
                        ]),
            ),
          ]),
        ),
      ),
      Expanded(
        flex: 3,
        child: ListView(padding: const EdgeInsets.fromLTRB(8, 16, 16, 16), children: [
          _card(
            title: 'Template Catatan',
            action: widget.kdDokter.isEmpty ? null : _btn('+ Tambah', _kGreen, () => _tambahTemplate()),
            child: _loadingTemplate
                ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
                : _templates.isEmpty
                    ? _kosong('Belum ada template. Tekan "+ Jadikan Template" pada riwayat catatan atau "+ Tambah".')
                    : Column(children: [
                        for (var i = 0; i < _templates.length; i++)
                          Container(
                            decoration: BoxDecoration(border: Border(top: i == 0 ? BorderSide.none : const BorderSide(color: _kLine))),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(
                                  child: Text('${_templates[i]['nama_template'] ?? ''}',
                                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kText)),
                                ),
                                InkWell(
                                  onTap: () => _hapusTemplate(_templates[i]),
                                  child: const Padding(padding: EdgeInsets.all(6), child: Icon(Icons.delete_outline, size: 20, color: _kRed)),
                                ),
                              ]),
                              const SizedBox(height: 4),
                              Text('${_templates[i]['isi'] ?? ''}',
                                  maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, height: 1.4, color: kTextMuted)),
                              const SizedBox(height: 8),
                              _btn('Pakai', _kGreen, () => _pakai(_templates[i]), outline: true),
                            ]),
                          ),
                      ]),
          ),
        ]),
      ),
    ]);
  }
}
