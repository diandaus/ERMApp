import 'dart:async';

import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/rad_service.dart';
import 'modal_input_kit.dart';

/// showRadInputPanel — modal "Permintaan Radiologi" (gaya modal Input
/// Tindakan), padanan ModalInputRad.tsx (web). Endpoint SAMA PERSIS:
/// GET /api/radiologi/info-rawat (status & kelas), GET
/// /api/radiologi/jenis-perawatan, POST /api/radiologi/permintaan.
/// Balikin noorder yg tersimpan (null = batal).
Future<String?> showRadInputPanel(
  BuildContext context, {
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  required String kdDokter,
  required String kdPj,
}) {
  return showModalInput<String>(
    context,
    label: 'Permintaan Radiologi',
    builder: (_) => _RadInputPanel(noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, kdDokter: kdDokter, kdPj: kdPj),
  );
}

class _RadInputPanel extends StatefulWidget {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kdDokter;
  final String kdPj;
  const _RadInputPanel({required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, required this.kdDokter, required this.kdPj});

  @override
  State<_RadInputPanel> createState() => _RadInputPanelState();
}

class _RadInputPanelState extends State<_RadInputPanel> {
  final _diagnosa = TextEditingController();
  final _info = TextEditingController();
  final _search = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _results = [];
  final List<Map<String, dynamic>> _sel = [];

  String _status = 'ralan';
  String _kelas = '';

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final info = await RadService.getInfoRawat(widget.noRawat);
      _status = (info['status'] as String? ?? '').isEmpty ? 'ralan' : info['status'] as String;
      _kelas = info['kelas'] as String? ?? '';
    } catch (_) {/* default ralan, sama dgn web */}
    if (mounted) _cari();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _diagnosa.dispose();
    _info.dispose();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _cari);
  }

  Future<void> _cari() async {
    final q = _search.text.trim();
    setState(() => _searching = true);
    try {
      final list = await RadService.searchJenisPerawatan(q, kdPj: widget.kdPj, kelas: _kelas);
      if (!mounted || q != _search.text.trim()) return;
      setState(() => _results = list);
    } catch (_) {
      if (mounted) setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  String _kd(Map<String, dynamic> m) => '${m['kd_jenis_prw'] ?? ''}';
  bool _isSel(Map<String, dynamic> m) => _sel.any((x) => _kd(x) == _kd(m));

  void _toggle(Map<String, dynamic> item) => setState(() {
        _error = null;
        _isSel(item) ? _sel.removeWhere((x) => _kd(x) == _kd(item)) : _sel.add(item);
      });

  Future<void> _simpan() async {
    if (_diagnosa.text.trim().isEmpty) {
      setState(() => _error = 'Diagnosis Klinis wajib diisi');
      return;
    }
    if (_sel.isEmpty) {
      setState(() => _error = 'Pilih minimal satu pemeriksaan');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final n = DateTime.now();
    String p(int v) => v.toString().padLeft(2, '0');
    try {
      final noorder = await RadService.createPermintaan({
        'no_rawat': widget.noRawat,
        'dokter_perujuk': widget.kdDokter,
        'status': _status,
        'diagnosis_klinis': _diagnosa.text.trim(),
        'informasi_tambahan': _info.text.trim(),
        'pemeriksaan_list': _sel.map(_kd).toList(),
        'tgl_permintaan': '${n.year}-${p(n.month)}-${p(n.day)}',
        'jam_permintaan': '${p(n.hour)}:${p(n.minute)}:${p(n.second)}',
      });
      if (mounted) Navigator.of(context).pop(noorder.isEmpty ? '-' : noorder);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Gagal menyimpan permintaan radiologi';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ModalInputHeader(
          title: 'Permintaan Radiologi',
          subtitle: infoPasien([widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur]),
          canSave: _sel.isNotEmpty,
          saving: _saving,
          onSave: _simpan,
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.all(20), children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const KitLabel('Diagnosis Klinis', required: true),
                  TextField(controller: _diagnosa, decoration: kitDeco(hint: 'Diagnosis klinis...'), style: const TextStyle(fontSize: 15)),
                ]),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const KitLabel('Informasi Tambahan'),
                  TextField(controller: _info, decoration: kitDeco(hint: 'Opsional...'), style: const TextStyle(fontSize: 15)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            KitLabel('Cari Pemeriksaan${_sel.isEmpty ? '' : ' (${_sel.length} dipilih)'}', required: true),
            TextField(
              controller: _search,
              onChanged: _onSearch,
              decoration: kitDeco(hint: 'Cari nama/kode pemeriksaan...', prefixIcon: const Icon(Icons.search, size: 16, color: kKitGreen)),
              style: const TextStyle(fontSize: 15),
            ),
            KitResultBox(
              loading: _searching,
              count: _results.length,
              itemBuilder: (_, i) {
                final it = _results[i];
                return KitOptionRow(title: '${it['nm_perawatan'] ?? ''}', code: _kd(it), query: _search.text, selected: _isSel(it), onTap: () => _toggle(it));
              },
            ),
            const SizedBox(height: 16),
            KitSelectedTable(
              headers: const ['Kode', 'Nama Pemeriksaan'],
              widths: const [140, null],
              emptyText: 'Belum ada pemeriksaan dipilih',
              rows: [
                for (final it in _sel)
                  [Text(_kd(it), style: kitCodeStyle), Text('${it['nm_perawatan'] ?? ''}', style: kitCellStyle, maxLines: 2, overflow: TextOverflow.ellipsis)],
              ],
              onRemove: [for (final it in _sel) () => _toggle(it)],
            ),
          ]),
        ),
        if (_error != null) KitErrorBox(_error!),
      ],
    );
  }
}
