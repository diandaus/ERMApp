import 'dart:async';

import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/lab_service.dart';
import '../theme/app_theme.dart';
import 'modal_input_kit.dart';

/// showLabInputPanel — modal "Permintaan Laboratorium" (gaya modal Input
/// Tindakan), padanan ModalInputLab.tsx (web). Endpoint SAMA PERSIS:
/// GET /api/lab/jenis-perawatan, GET /api/lab/template, POST
/// /api/lab/permintaan-pk & /api/lab/permintaan-pa. Balikin noorder yg
/// tersimpan (null = batal).
Future<String?> showLabInputPanel(
  BuildContext context, {
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  required String kdDokter,
  required String kdPj,
  // 'ralan' / 'ranap' — permintaan_lab.status.
  String statusLanjut = 'ralan',
}) {
  return showModalInput<String>(
    context,
    label: 'Permintaan Laboratorium',
    builder: (_) => _LabInputPanel(noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, kdDokter: kdDokter, kdPj: kdPj, statusLanjut: statusLanjut),
  );
}

class _LabInputPanel extends StatefulWidget {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kdDokter;
  final String kdPj;
  final String statusLanjut;
  const _LabInputPanel({required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, required this.kdDokter, required this.kdPj, this.statusLanjut = 'ralan'});

  @override
  State<_LabInputPanel> createState() => _LabInputPanelState();
}

class _LabInputPanelState extends State<_LabInputPanel> {
  int _tab = 0; // 0 = PK, 1 = PA
  String get _kategori => _tab == 0 ? 'PK' : 'PA';

  final _diagnosa = TextEditingController();
  final _info = TextEditingController();
  final _search = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _results = [];

  // Pilihan disimpan terpisah per kategori (pindah tab tidak menghapus).
  final List<Map<String, dynamic>> _selPK = [];
  final List<Map<String, dynamic>> _selPA = [];
  List<Map<String, dynamic>> get _sel => _tab == 0 ? _selPK : _selPA;

  // Detail Pemeriksaan PK (template_laboratorium) per kd_jenis_prw; id yg
  // dicentang. Parameter pemeriksaan yg BARU dipilih otomatis tercentang
  // semua (sama dgn web), tinggal uncek yg tak perlu.
  final Map<String, List<Map<String, dynamic>>> _detail = {};
  final Set<String> _detailDipilih = {};
  final Set<String> _detailMemuat = {};

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
    final kategori = _kategori;
    final q = _search.text.trim();
    setState(() => _searching = true);
    try {
      final list = await LabService.searchJenis(kategori, q, widget.kdPj);
      if (!mounted || kategori != _kategori || q != _search.text.trim()) return;
      setState(() => _results = list);
    } catch (_) {
      if (mounted) setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  String _kd(Map<String, dynamic> m) => '${m['kd_jenis_prw'] ?? ''}';
  bool _isSel(Map<String, dynamic> m) => _sel.any((x) => _kd(x) == _kd(m));

  void _toggle(Map<String, dynamic> item) {
    final kd = _kd(item);
    setState(() {
      _error = null;
      if (_isSel(item)) {
        _sel.removeWhere((x) => _kd(x) == kd);
        if (_tab == 0) {
          for (final t in _detail.remove(kd) ?? const <Map<String, dynamic>>[]) {
            _detailDipilih.remove('${t['id_template']}');
          }
        }
      } else {
        _sel.add(item);
        if (_tab == 0) _muatDetail(kd);
      }
    });
  }

  Future<void> _muatDetail(String kd) async {
    setState(() => _detailMemuat.add(kd));
    try {
      final list = await LabService.getTemplate(kd);
      if (!mounted || !_selPK.any((x) => _kd(x) == kd)) return;
      setState(() {
        _detail[kd] = list;
        _detailDipilih.addAll(list.map((t) => '${t['id_template']}'));
      });
    } catch (_) {/* tanpa detail */} finally {
      if (mounted) setState(() => _detailMemuat.remove(kd));
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

  String _now(bool tgl) {
    final n = DateTime.now();
    String p(int v) => v.toString().padLeft(2, '0');
    return tgl ? '${n.year}-${p(n.month)}-${p(n.day)}' : '${p(n.hour)}:${p(n.minute)}:${p(n.second)}';
  }

  Future<void> _simpan() async {
    if (_diagnosa.text.trim().isEmpty) {
      setState(() => _error = 'Diagnosis Klinis wajib diisi');
      return;
    }
    if (_sel.isEmpty) {
      setState(() => _error = 'Pilih minimal satu pemeriksaan $_kategori');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final tgl = _now(true);
    final base = {
      'no_rawat': widget.noRawat,
      'kd_dokter': widget.kdDokter,
      'status_lanjut': widget.statusLanjut,
      'diagnosis_klinis': _diagnosa.text.trim(),
      'informasi_tambahan': _info.text.trim(),
      'pemeriksaan_list': _sel.map(_kd).toList(),
      'tgl_permintaan': tgl,
      'jam_permintaan': _now(false),
    };
    try {
      final String noorder;
      if (_tab == 0) {
        final ids = _detail.values.expand((l) => l).map((t) => '${t['id_template']}').where(_detailDipilih.contains).toList();
        noorder = await LabService.createPermintaanPK({...base, 'detail_pemeriksaan': ids});
      } else {
        noorder = await LabService.createPermintaanPA({
          ...base,
          'tgl_pengambilan_bahan': tgl,
          'diperoleh_dengan': '',
          'lokasi_pengambilan': '',
          'diawetkan': '',
          'dilakukan_pa': '',
          'tgl_pa': '',
          'nomor_pa': '',
          'diagnosa_pa': '',
        });
      }
      if (mounted) Navigator.of(context).pop(noorder.isEmpty ? '-' : noorder);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Gagal menyimpan permintaan lab $_kategori';
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
          title: 'Permintaan Laboratorium',
          subtitle: infoPasien([widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur]),
          canSave: _sel.isNotEmpty,
          saving: _saving,
          onSave: _simpan,
        ),
        Expanded(child: ListView(padding: const EdgeInsets.all(20), children: _body())),
        if (_error != null) KitErrorBox(_error!),
      ],
    );
  }

  List<Widget> _body() {
    return [
      KitSegment(labels: const ['Patologi Klinis', 'Patologi Anatomi'], index: _tab, onChanged: _gantiTab),
      const SizedBox(height: 16),
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
      KitLabel('Cari Pemeriksaan $_kategori${_sel.isEmpty ? '' : ' (${_sel.length} dipilih)'}', required: true),
      TextField(
        controller: _search,
        onChanged: _onSearch,
        decoration: kitDeco(hint: 'Cari nama/kode pemeriksaan...', prefixIcon: const Icon(Icons.search, size: 16, color: kKitGreen)),
        style: const TextStyle(fontSize: 15),
      ),
      KitResultBox(
        loading: _searching,
        count: _results.length,
        maxHeight: 280,
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
      if (_tab == 0 && _selPK.isNotEmpty) ...[
        const SizedBox(height: 20),
        KitLabel('Detail Pemeriksaan (${_detailDipilih.length} parameter)'),
        _detailPK(),
      ],
    ];
  }

  String _rujukan(Map<String, dynamic> t) {
    final parts = <String>[
      for (final e in const {'ld': 'LD', 'la': 'LA', 'pd': 'PD', 'pa': 'PA'}.entries)
        if ('${t['nilai_rujukan_${e.key}'] ?? ''}'.trim().isNotEmpty) '${e.value}: ${t['nilai_rujukan_${e.key}']}',
    ];
    return parts.isEmpty ? '-' : parts.join(', ');
  }

  /// Parameter tiap pemeriksaan PK terpilih, dikelompokkan per pemeriksaan
  /// (centang header = centang/batal semua parameter di bawahnya).
  Widget _detailPK() {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: kKitField), borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (final p in _selPK) ...[
          Builder(builder: (_) {
            final kd = _kd(p);
            final items = _detail[kd] ?? const <Map<String, dynamic>>[];
            final ids = items.map((t) => '${t['id_template']}').toList();
            final semua = ids.isNotEmpty && ids.every(_detailDipilih.contains);
            return InkWell(
              onTap: ids.isEmpty
                  ? null
                  : () => setState(() => semua ? _detailDipilih.removeAll(ids) : _detailDipilih.addAll(ids)),
              child: Container(
                color: const Color(0xFFF4F5F5),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  Icon(semua ? Icons.check_box : Icons.check_box_outline_blank, size: 22, color: semua ? kKitGreen : const Color(0xFF9CA3AF)),
                  const SizedBox(width: 12),
                  Expanded(child: Text('${p['nm_perawatan'] ?? ''}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kText))),
                  if (_detailMemuat.contains(kd)) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                ]),
              ),
            );
          }),
          for (final t in _detail[_kd(p)] ?? const <Map<String, dynamic>>[])
            Builder(builder: (_) {
              final id = '${t['id_template']}';
              final on = _detailDipilih.contains(id);
              return InkWell(
                onTap: () => setState(() => on ? _detailDipilih.remove(id) : _detailDipilih.add(id)),
                child: Container(
                  decoration: const BoxDecoration(border: Border(top: BorderSide(color: kKitBorder))),
                  padding: const EdgeInsets.fromLTRB(48, 8, 14, 8),
                  child: Row(children: [
                    Icon(on ? Icons.check_box : Icons.check_box_outline_blank, size: 20, color: on ? kKitGreen : const Color(0xFF9CA3AF)),
                    const SizedBox(width: 12),
                    Expanded(flex: 3, child: Text('${t['pemeriksaan'] ?? ''}'.trim(), style: const TextStyle(fontSize: 14, color: kText))),
                    Expanded(flex: 2, child: Text('${t['satuan'] ?? ''}', style: const TextStyle(fontSize: 13, color: kTextMuted))),
                    Expanded(flex: 3, child: Text(_rujukan(t), style: const TextStyle(fontSize: 13, color: kTextMuted))),
                  ]),
                ),
              );
            }),
          if (!_detailMemuat.contains(_kd(p)) && (_detail[_kd(p)] ?? const []).isEmpty)
            Container(
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: kKitBorder))),
              padding: const EdgeInsets.fromLTRB(48, 10, 14, 10),
              child: const Text('Tidak ada detail parameter', style: TextStyle(fontSize: 13, color: kTextMuted)),
            ),
        ],
      ]),
    );
  }
}
