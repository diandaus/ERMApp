import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/rad_service.dart';
import '../services/tindakan_service.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kInputBorder = Color(0xFFD1D5DB);
const _kGreen = Color(0xFF059669);

/// showTindakanInputPanel — modal Input Tindakan Rawat Jalan, geser dari
/// kanan selebar 50% layar (sama pola dgn modal Input Resep). Balikin true
/// kalau ada tindakan yg tersimpan.
Future<bool> showTindakanInputPanel(
  BuildContext context, {
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  required String kdDokter,
  required String kdPj,
  required String userNip,
}) async {
  final saved = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Input Tindakan',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.5,
        heightFactor: 1,
        child: _TindakanInputPanel(noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, kdDokter: kdDokter, kdPj: kdPj, userNip: userNip),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => SlideTransition(
      position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
      child: child,
    ),
  );
  return saved == true;
}

String _rupiah(num n) => NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0).format(n);

/// _TindakanInputPanel — padanan ModalInputTindakan.tsx (web, tanpa
/// isRanap). Tiga jenis Penanganan menentukan tabel tujuan & tarifnya:
/// Dokter (rawat_jl_dr, tarif dokter), Petugas (rawat_jl_pr, tarif
/// petugas), Dokter & Petugas (rawat_jl_drpr, jumlah keduanya). Dokter =
/// dokter kunjungan; Petugas default = akun yg login. Endpoint SAMA PERSIS
/// dgn web (/api/tindakan/jenis-perawatan, /api/tindakan/simpan*).
class _TindakanInputPanel extends StatefulWidget {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kdDokter;
  final String kdPj;
  final String userNip;
  const _TindakanInputPanel({required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, required this.kdDokter, required this.kdPj, required this.userNip});

  @override
  State<_TindakanInputPanel> createState() => _TindakanInputPanelState();
}

class _TindakanInputPanelState extends State<_TindakanInputPanel> {
  static const _penangananLabels = ['Penanganan Dokter', 'Penanganan Petugas', 'Dokter & Petugas'];
  int _penanganan = 0; // 0 dokter, 1 petugas, 2 keduanya

  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _results = [];
  final List<Map<String, dynamic>> _selected = [];

  String _petugasNip = '';
  String _petugasNama = '';
  bool _pilihPetugas = false; // kolom cari petugas sedang dibuka
  final _petugasCtrl = TextEditingController();
  Timer? _petugasDebounce;
  List<Map<String, dynamic>> _petugasList = [];

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _defaultPetugas();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _petugasDebounce?.cancel();
    _searchCtrl.dispose();
    _petugasCtrl.dispose();
    super.dispose();
  }

  /// Petugas default = akun yg login (dicocokkan PERSIS by NIP); tetap
  /// bisa diganti lewat "Ganti".
  Future<void> _defaultPetugas() async {
    if (widget.userNip.isEmpty) return;
    try {
      final list = await RadService.searchPetugas(widget.userNip);
      final match = list.where((p) => p['nip'] == widget.userNip).firstOrNull;
      if (match == null || !mounted || _petugasNip.isNotEmpty) return;
      setState(() {
        _petugasNip = widget.userNip;
        _petugasNama = match['nama'] as String? ?? '';
      });
    } catch (_) {/* diam, petugas dipilih manual */}
  }

  void _onPetugasChanged(String value) {
    _petugasDebounce?.cancel();
    _petugasDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final list = await RadService.searchPetugas(value.trim());
        if (mounted && _petugasCtrl.text == value) setState(() => _petugasList = list);
      } catch (_) {/* diam */}
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final q = value.trim();
    if (q.isEmpty) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      var list = <Map<String, dynamic>>[];
      try {
        list = await TindakanService.searchJenis(q, kdPj: widget.kdPj);
      } catch (_) {/* diam, tampil "Tidak ada hasil pencarian" */}
      if (!mounted || _searchCtrl.text.trim() != q) return;
      setState(() {
        _results = list;
        _searching = false;
      });
    });
  }

  bool _isSelected(Map<String, dynamic> item) => _selected.any((s) => s['kd_jenis_prw'] == item['kd_jenis_prw']);

  void _toggle(Map<String, dynamic> item) {
    setState(() {
      if (_isSelected(item)) {
        _selected.removeWhere((s) => s['kd_jenis_prw'] == item['kd_jenis_prw']);
      } else {
        _selected.add(item);
      }
      _error = null;
    });
  }

  num _n(Map<String, dynamic> item, String key) => item[key] as num? ?? 0;

  /// Tarif yg ditampilkan & disimpan mengikuti Penanganan aktif.
  num _tarif(Map<String, dynamic> item) {
    final dr = _n(item, 'total_byrdr');
    final pr = _n(item, 'tarif_tindakanpr');
    return _penanganan == 0 ? dr : (_penanganan == 1 ? pr : dr + pr);
  }

  Future<void> _submit() async {
    if (_selected.isEmpty) {
      setState(() => _error = 'Pilih minimal satu jenis tindakan terlebih dahulu!');
      return;
    }
    if (_penanganan != 0 && _petugasNip.isEmpty) {
      setState(() => _error = 'Pilih petugas terlebih dahulu!');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final now = DateTime.now();
    final tgl = DateFormat('yyyy-MM-dd').format(now);
    final jam = DateFormat('HH:mm:ss').format(now);
    final endpoint = const ['simpan', 'simpan-petugas', 'simpan-drpr'][_penanganan];
    var ok = 0;
    var gagal = 0;
    for (final item in _selected) {
      final tarifDr = _n(item, 'total_byrdr');
      final tarifPr = _n(item, 'tarif_tindakanpr');
      try {
        await TindakanService.simpan(endpoint, {
          'no_rawat': widget.noRawat,
          'kd_jenis_prw': item['kd_jenis_prw'],
          if (_penanganan != 1) 'kd_dokter': widget.kdDokter,
          if (_penanganan != 0) 'nip': _petugasNip,
          'tgl_perawatan': tgl,
          'jam_rawat': jam,
          'material': _n(item, 'material'),
          'bhp': _n(item, 'bhp'),
          if (_penanganan != 1) 'tarif_tindakandr': tarifDr,
          if (_penanganan != 0) 'tarif_tindakanpr': tarifPr,
          'kso': _n(item, 'kso'),
          'menejemen': _n(item, 'menejemen'),
          'biaya_rawat': _tarif(item),
        });
        ok++;
      } catch (_) {
        gagal++;
      }
    }
    if (!mounted) return;
    if (ok == 0) {
      setState(() {
        _error = 'Gagal menyimpan semua tindakan';
        _saving = false;
      });
      return;
    }
    if (gagal > 0) {
      // Sebagian gagal: tetap tutup & muat ulang (yg berhasil sudah
      // tersimpan), tapi beri tahu jumlahnya dulu.
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text('$ok tindakan berhasil disimpan, $gagal gagal'),
          actions: [TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK'))],
        ),
      );
      if (!mounted) return;
    }
    Navigator.of(context).pop(true);
  }

  InputDecoration _deco({String? hint}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(
          TextSpan(text: text, children: const [TextSpan(text: ' *', style: TextStyle(color: Color(0xFFEF4444)))]),
          style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final breadcrumb = [widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur].where((v) => v.isNotEmpty).join('  |  ');
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
              child: Row(
                children: [
                  const Icon(Icons.person_outline, size: 16, color: _kGreen),
                  const SizedBox(width: 6),
                  Expanded(child: Text(breadcrumb, style: const TextStyle(fontSize: 12, color: Colors.black))),
                  const SizedBox(width: 10),
                  InkWell(
                    onTap: () => Navigator.of(context).pop(),
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, border: Border.all(color: _kBorder)),
                      child: const Icon(Icons.close, size: 16, color: Color(0xFF6B7280)),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: _kBorder),
            Expanded(child: ListView(padding: const EdgeInsets.all(20), children: _buildBody())),
            if (_error != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFFEE2E2), border: Border.all(color: const Color(0xFFFCA5A5)), borderRadius: BorderRadius.circular(2)),
                child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B))),
              ),
            const Divider(height: 1, color: _kBorder),
            Padding(
              padding: const EdgeInsets.all(16),
              child: ElevatedButton(
                onPressed: _saving ? null : _submit,
                style: ElevatedButton.styleFrom(backgroundColor: _kGreen, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)), padding: const EdgeInsets.symmetric(vertical: 14)),
                child: Text(_saving ? 'Menyimpan...' : 'Simpan Tindakan', style: const TextStyle(fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildBody() {
    final query = _searchCtrl.text.trim();
    return [
      // Tab Penanganan — button group flat, sama dgn tab modal Resep.
      Align(
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < _penangananLabels.length; i++)
              InkWell(
                onTap: () => setState(() {
                  _penanganan = i;
                  _error = null;
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(color: _penanganan == i ? _kGreen : Colors.white, border: Border.all(color: _kGreen)),
                  child: Text(_penangananLabels[i], style: TextStyle(fontSize: 12, color: _penanganan == i ? Colors.white : _kGreen)),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      if (_penanganan != 0) ...[_label('Petugas'), _buildPetugas(), const SizedBox(height: 16)],
      _label('Cari Tindakan${_selected.isEmpty ? '' : ' (${_selected.length} dipilih)'}'),
      TextField(
        controller: _searchCtrl,
        onChanged: _onSearchChanged,
        decoration: _deco(hint: 'Cari nama/kode tindakan...').copyWith(
          prefixIcon: const Icon(Icons.search, size: 16, color: _kGreen),
          prefixIconConstraints: const BoxConstraints(minWidth: 34, minHeight: 34),
        ),
        style: const TextStyle(fontSize: 13),
      ),
      if (query.isNotEmpty) _buildResults(),
      const SizedBox(height: 12),
      // Tabel tindakan terpilih — ketuk baris/centang utk menghapusnya.
      Container(
        decoration: BoxDecoration(border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(4)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Container(
              color: const Color(0xFFF3F4F6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              child: const Row(
                children: [
                  SizedBox(width: 30, child: Text('P', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF374151)))),
                  SizedBox(width: 90, child: Text('Kode', style: TextStyle(fontSize: 12, color: Color(0xFF374151)))),
                  Expanded(child: Text('Nama Tindakan', style: TextStyle(fontSize: 12, color: Color(0xFF374151)))),
                  SizedBox(width: 110, child: Text('Tarif', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, color: Color(0xFF374151)))),
                ],
              ),
            ),
            if (_selected.isEmpty)
              const Padding(padding: EdgeInsets.all(16), child: Text('Belum ada tindakan dipilih', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
            else
              for (final item in _selected)
                InkWell(
                  onTap: () => _toggle(item),
                  child: Container(
                    decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFF3F4F6)))),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                    child: Row(
                      children: [
                        const SizedBox(width: 30, child: Icon(Icons.check_box, size: 16, color: _kGreen)),
                        SizedBox(width: 90, child: Text('${item['kd_jenis_prw'] ?? ''}', style: const TextStyle(fontSize: 12))),
                        Expanded(child: Text('${item['nm_perawatan'] ?? ''}', style: const TextStyle(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        SizedBox(width: 110, child: Text(_rupiah(_tarif(item)), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12))),
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ),
    ];
  }

  Widget _buildPetugas() {
    if (_petugasNip.isNotEmpty && !_pilihPetugas) {
      return Container(
        padding: const EdgeInsets.fromLTRB(12, 2, 4, 2),
        decoration: BoxDecoration(color: const Color(0xFFECFDF5), border: Border.all(color: _kGreen), borderRadius: BorderRadius.circular(4)),
        child: Row(
          children: [
            Expanded(child: Text('$_petugasNip - $_petugasNama', style: const TextStyle(fontSize: 12))),
            TextButton(
              onPressed: () => setState(() {
                _pilihPetugas = true;
                _petugasCtrl.clear();
                _onPetugasChanged('');
              }),
              style: TextButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
              child: const Text('Ganti', style: TextStyle(fontSize: 12, color: Color(0xFFEF4444))),
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _petugasCtrl,
          onChanged: _onPetugasChanged,
          onTap: () {
            if (_petugasList.isEmpty) _onPetugasChanged(_petugasCtrl.text);
          },
          decoration: _deco(hint: 'Cari nama petugas...'),
          style: const TextStyle(fontSize: 12),
        ),
        if (_petugasList.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            constraints: const BoxConstraints(maxHeight: 200),
            decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(4)),
            child: ListView.separated(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              itemCount: _petugasList.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: _kBorder),
              itemBuilder: (context, i) {
                final p = _petugasList[i];
                return InkWell(
                  onTap: () => setState(() {
                    _petugasNip = p['nip'] as String? ?? '';
                    _petugasNama = p['nama'] as String? ?? '';
                    _pilihPetugas = false;
                    _error = null;
                  }),
                  child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9), child: Text('${p['nama'] ?? ''} (${p['nip'] ?? ''})', style: const TextStyle(fontSize: 12))),
                );
              },
            ),
          ),
      ],
    );
  }

  /// Hasil pencarian — daftar bercentang (bisa pilih banyak sekaligus),
  /// tampil tepat di bawah kolom cari selama ada ketikan.
  Widget _buildResults() {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      constraints: const BoxConstraints(maxHeight: 300),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(8), boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 12, offset: Offset(0, 6))]),
      clipBehavior: Clip.antiAlias,
      child: _searching
          ? const Padding(padding: EdgeInsets.all(16), child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))))
          : _results.isEmpty
              ? const Padding(padding: EdgeInsets.all(16), child: Text('Tidak ada hasil pencarian', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))))
              : ListView.builder(
                  padding: EdgeInsets.zero,
                  shrinkWrap: true,
                  itemCount: _results.length,
                  itemBuilder: (context, i) {
                    final item = _results[i];
                    final selected = _isSelected(item);
                    return InkWell(
                      onTap: () => _toggle(item),
                      child: Container(
                        color: selected ? const Color(0xFFECFDF5) : (i.isEven ? const Color(0xFFF9FAFB) : Colors.white),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(
                          children: [
                            Icon(selected ? Icons.check_box : Icons.check_box_outline_blank, size: 18, color: selected ? _kGreen : const Color(0xFF9CA3AF)),
                            const SizedBox(width: 10),
                            Expanded(child: Text('${item['nm_perawatan'] ?? ''}', style: const TextStyle(fontSize: 12, color: Color(0xFF111827)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Text('${item['kd_jenis_prw'] ?? ''} • ${_rupiah(_tarif(item))}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
