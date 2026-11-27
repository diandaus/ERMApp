import 'dart:async';

import 'package:flutter/material.dart';

import '../services/diagnosa_service.dart';
import 'modal_input_kit.dart';

/// showDiagnosaInputPanel — modal "Input Diagnosa" (gaya modal Input
/// Tindakan), padanan ModalInputDiagnosa.tsx (web): switch Diagnosa
/// (ICD10) / Prosedur (ICD9). Endpoint SAMA PERSIS: GET /api/penyakit/search,
/// GET /api/icd9/search, POST /api/pemeriksaan/diagnosa & /prosedur (satu
/// POST per item, prioritas = urutan dipilih). Balikin jumlah tersimpan.
Future<int> showDiagnosaInputPanel(
  BuildContext context, {
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  String status = 'Ralan',
}) async {
  final n = await showModalInput<int>(
    context,
    label: 'Input Diagnosa',
    builder: (_) => _DiagnosaInputPanel(noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, status: status),
  );
  return n ?? 0;
}

class _DiagnosaInputPanel extends StatefulWidget {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String status;
  const _DiagnosaInputPanel({required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, this.status = 'Ralan'});

  @override
  State<_DiagnosaInputPanel> createState() => _DiagnosaInputPanelState();
}

class _DiagnosaInputPanelState extends State<_DiagnosaInputPanel> {
  int _tab = 0; // 0 = Diagnosa ICD10, 1 = Prosedur ICD9
  final _search = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _results = [];

  final List<Map<String, dynamic>> _diagnosa = [];
  final List<Map<String, dynamic>> _prosedur = [];
  // Jumlah per kode prosedur (default 1).
  final Map<String, TextEditingController> _jumlah = {};

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cari();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    for (final c in _jumlah.values) {
      c.dispose();
    }
    super.dispose();
  }

  String _kode(Map<String, dynamic> m) => '${m[_tab == 0 ? 'kd_penyakit' : 'kode'] ?? ''}';
  String _nama(Map<String, dynamic> m) => '${m[_tab == 0 ? 'nm_penyakit' : 'deskripsi_panjang'] ?? ''}';
  List<Map<String, dynamic>> get _sel => _tab == 0 ? _diagnosa : _prosedur;
  bool _isSel(Map<String, dynamic> m) => _sel.any((x) => _kode(x) == _kode(m));

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _cari);
  }

  Future<void> _cari() async {
    final tab = _tab;
    final q = _search.text.trim();
    setState(() => _searching = true);
    try {
      final list = tab == 0 ? await DiagnosaService.searchPenyakit(q) : await DiagnosaService.searchIcd9(q);
      if (!mounted || tab != _tab || q != _search.text.trim()) return;
      setState(() => _results = list);
    } catch (_) {
      if (mounted) setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _gantiTab(int i) {
    if (i == _tab) return;
    setState(() {
      _tab = i;
      _results = [];
      _search.clear();
      _error = null;
    });
    _cari();
  }

  void _toggle(Map<String, dynamic> item) {
    final kode = _kode(item);
    setState(() {
      _error = null;
      if (_isSel(item)) {
        _sel.removeWhere((x) => _kode(x) == kode);
        if (_tab == 1) _jumlah.remove(kode)?.dispose();
      } else {
        _sel.add(item);
        if (_tab == 1) _jumlah[kode] = TextEditingController(text: '1');
      }
    });
  }

  Future<void> _simpan() async {
    if (_diagnosa.isEmpty && _prosedur.isEmpty) {
      setState(() => _error = 'Pilih minimal satu diagnosa atau prosedur');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    var ok = 0;
    final gagal = <String>[];
    for (var i = 0; i < _diagnosa.length; i++) {
      final kd = '${_diagnosa[i]['kd_penyakit'] ?? ''}';
      try {
        await DiagnosaService.saveDiagnosa(noRawat: widget.noRawat, noRkmMedis: widget.noRkmMedis, kdPenyakit: kd, prioritas: i + 1, status: widget.status);
        ok++;
      } catch (_) {
        gagal.add(kd);
      }
    }
    for (var i = 0; i < _prosedur.length; i++) {
      final kode = '${_prosedur[i]['kode'] ?? ''}';
      final jml = _jumlah[kode]?.text.trim() ?? '';
      try {
        await DiagnosaService.saveProsedur(noRawat: widget.noRawat, kode: kode, prioritas: i + 1, jumlah: jml.isEmpty ? '1' : jml, status: widget.status);
        ok++;
      } catch (_) {
        gagal.add(kode);
      }
    }
    if (!mounted) return;
    if (ok == 0) {
      setState(() {
        _error = 'Gagal menyimpan semua data (kemungkinan sudah ada): ${gagal.join(', ')}';
        _saving = false;
      });
      return;
    }
    if (gagal.isNotEmpty) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text('$ok data berhasil disimpan, ${gagal.length} gagal (kemungkinan sudah ada): ${gagal.join(', ')}'),
          actions: [TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK'))],
        ),
      );
      if (!mounted) return;
    }
    Navigator.of(context).pop(ok);
  }

  @override
  Widget build(BuildContext context) {
    final total = _diagnosa.length + _prosedur.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ModalInputHeader(
          title: 'Input Diagnosa',
          subtitle: infoPasien([widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur]),
          canSave: total > 0,
          saving: _saving,
          onSave: _simpan,
        ),
        Expanded(child: ListView(padding: const EdgeInsets.all(20), children: _body())),
        if (_error != null) KitErrorBox(_error!),
      ],
    );
  }

  List<Widget> _body() {
    final dx = _tab == 0;
    return [
      KitSegment(
        labels: [
          'Diagnosa (ICD10)${_diagnosa.isEmpty ? '' : ' · ${_diagnosa.length}'}',
          'Prosedur (ICD9)${_prosedur.isEmpty ? '' : ' · ${_prosedur.length}'}',
        ],
        index: _tab,
        onChanged: _gantiTab,
      ),
      const SizedBox(height: 16),
      KitLabel(dx ? 'Cari Diagnosa ICD10' : 'Cari Prosedur ICD9'),
      TextField(
        controller: _search,
        onChanged: _onSearch,
        decoration: kitDeco(hint: dx ? 'Cari kode/nama penyakit...' : 'Cari kode/deskripsi prosedur...', prefixIcon: const Icon(Icons.search, size: 16, color: kKitGreen)),
        style: const TextStyle(fontSize: 15),
      ),
      KitResultBox(
        loading: _searching,
        count: _results.length,
        itemBuilder: (_, i) {
          final it = _results[i];
          return KitOptionRow(title: _nama(it), code: _kode(it), query: _search.text, selected: _isSel(it), onTap: () => _toggle(it));
        },
      ),
      const SizedBox(height: 16),
      if (dx)
        KitSelectedTable(
          headers: const ['P', 'Kode', 'Nama Penyakit'],
          widths: const [40, 110, null],
          emptyText: 'Belum ada diagnosa dipilih',
          rows: [
            for (var i = 0; i < _diagnosa.length; i++)
              [
                Text('${i + 1}', style: kitCellStyle),
                Text('${_diagnosa[i]['kd_penyakit'] ?? ''}', style: kitCodeStyle),
                Text('${_diagnosa[i]['nm_penyakit'] ?? ''}', style: kitCellStyle, maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
          ],
          onRemove: [for (final it in List.of(_diagnosa)) () => _toggle(it)],
        )
      else
        KitSelectedTable(
          headers: const ['P', 'Kode', 'Deskripsi', 'Jumlah'],
          widths: const [40, 110, null, 90],
          emptyText: 'Belum ada prosedur dipilih',
          rows: [
            for (var i = 0; i < _prosedur.length; i++)
              [
                Text('${i + 1}', style: kitCellStyle),
                Text('${_prosedur[i]['kode'] ?? ''}', style: kitCodeStyle),
                Text('${_prosedur[i]['deskripsi_panjang'] ?? ''}', style: kitCellStyle, maxLines: 2, overflow: TextOverflow.ellipsis),
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: TextField(
                    controller: _jumlah['${_prosedur[i]['kode'] ?? ''}'],
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    decoration: kitDeco(),
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              ],
          ],
          onRemove: [for (final it in List.of(_prosedur)) () => _toggle(it)],
        ),
    ];
  }
}
